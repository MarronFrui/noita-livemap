// The tile service — every tile the viewer asks for, rendered at most once
// per generator revision (perf C, 2026-11-08).
//
//   memory LRU (PNG bytes) → disk (mapgen/out/tile-cache/<rev>/<seed>/…) →
//   compute (deduplicated: concurrent asks share one render)
//
// compute:
//   z ≤ directMaxZ  the direct tile law (tile-render.mjs renderTileRGBA) —
//                   a z ≤ 4 tile samples ≤ 4 world px per output px and touches
//                   ≤ ~120 chunks (measured: z4 cold 4.1 s / warm 0.23 s)
//   z > directMaxZ  the PYRAMID: the 4 child tiles at z−1, combined 2×2 → 1
//                   by the direct law's own rule (solid iff solid·2 ≥ total;
//                   colour = the most frequent solid child px). The direct
//                   law at z ≥ 5 touched 900–7500 chunks per tile and
//                   thrashed the chunk cache (12–42 s per tile, warm).
// A pyramid px reads "air" as RGB (0,0,0) — the direct law's own air output;
// a painted pure-black child px therefore also counts as air at the coarser
// level (display-only; black is black either way).
//
// The revision key = a hash of the generator + tile-law sources and the env
// flags that change the paint, so a code change never serves a stale tile and
// a server restart never discards a valid one (the old Date.now() epoch did).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";
import { encodeTilePng } from "./tile-render.mjs";

export const TILE = 512;

// 2×2 → 1 combine of four child RGBA tiles (null = absent child = all air)
// children order: [top-left, top-right, bottom-left, bottom-right]
export function combineChildren(children) {
  const out = new Uint8Array(TILE * TILE * 4);
  const H = TILE / 2;
  const tally = new Map();
  for (let j = 0; j < TILE; j++) {
    for (let i = 0; i < TILE; i++) {
      const c = children[(j >= H ? 2 : 0) + (i >= H ? 1 : 0)];
      const p = 4 * (j * TILE + i);
      out[p + 3] = 255;
      if (!c) continue;
      const ci = 2 * (i % H), cj = 2 * (j % H);
      let solid = 0, best = -1, bestN = 0;
      tally.clear();
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const q = 4 * ((cj + dy) * TILE + ci + dx);
          const r = c[q], g = c[q + 1], b = c[q + 2];
          if ((r | g | b) === 0) continue; // air
          solid++;
          const key = (r << 16) | (g << 8) | b;
          const n = (tally.get(key) ?? 0) + 1;
          tally.set(key, n);
          if (n > bestN) { bestN = n; best = key; }
        }
      }
      if (solid * 2 >= 4 && best >= 0) {
        out[p] = best >> 16; out[p + 1] = (best >> 8) & 255; out[p + 2] = best & 255;
      }
    }
  }
  return out;
}

export function sourceRevision(files, extra = "") {
  const h = crypto.createHash("sha1");
  for (const f of [...files].sort()) {
    h.update(f);
    try { h.update(fs.readFileSync(f)); } catch { h.update("<missing>"); }
  }
  h.update(extra);
  return h.digest("hex").slice(0, 12);
}

export class TileService {
  // renderDirect(seed, z, x, y, captureOn) -> Promise<Uint8Array RGBA>
  constructor({ root, rev, renderDirect, gridW, gridH, directMaxZ = 4, maxZ = 7, memTiles = 1024, log = () => {} }) {
    Object.assign(this, { root, rev, renderDirect, gridW, gridH, directMaxZ, maxZ, log });
    this.mem = new Map(); // key -> PNG Buffer (insertion-order LRU)
    this.memCap = memTiles;
    this.inflight = new Map(); // key -> Promise<{ png, rgba }>
    this.stats = { mem: 0, disk: 0, direct: 0, pyramid: 0 };
  }
  inGrid(z, x, y) {
    const s = 2 ** z;
    return z >= 0 && z <= this.maxZ && x >= 0 && y >= 0 && x < Math.ceil(this.gridW / s) && y < Math.ceil(this.gridH / s);
  }
  key(seed, z, x, y, captureOn) { return `${seed}/${z}/${x}_${y}${captureOn ? "" : "_nc"}`; }
  file(k) { return path.join(this.root, this.rev, `${k}.png`); }
  remember(k, png) {
    this.mem.delete(k);
    this.mem.set(k, png);
    while (this.mem.size > this.memCap) this.mem.delete(this.mem.keys().next().value);
  }
  // PNG bytes for a tile (the HTTP path)
  async png(seed, z, x, y, captureOn) {
    const k = this.key(seed, z, x, y, captureOn);
    const hit = this.mem.get(k);
    if (hit) { this.stats.mem++; this.remember(k, hit); return hit; }
    return (await this.load(k, seed, z, x, y, captureOn)).png;
  }
  // RGBA for a tile (the pyramid's children)
  async rgba(seed, z, x, y, captureOn) {
    if (!this.inGrid(z, x, y)) return null;
    const k = this.key(seed, z, x, y, captureOn);
    const r = await this.load(k, seed, z, x, y, captureOn);
    return r.rgba ?? new Uint8Array(PNG.sync.read(r.png).data);
  }
  load(k, seed, z, x, y, captureOn) {
    let p = this.inflight.get(k);
    if (p) return p;
    p = (async () => {
      const mem = this.mem.get(k);
      if (mem) return { png: mem, rgba: null };
      const f = this.file(k);
      try {
        const png = await fs.promises.readFile(f);
        this.stats.disk++;
        this.remember(k, png);
        return { png, rgba: null };
      } catch { /* not on disk — compute */ }
      let rgba;
      if (z <= this.directMaxZ) {
        rgba = await this.renderDirect(seed, z, x, y, captureOn);
        this.stats.direct++;
      } else {
        const kids = await Promise.all([
          this.rgba(seed, z - 1, 2 * x, 2 * y, captureOn),
          this.rgba(seed, z - 1, 2 * x + 1, 2 * y, captureOn),
          this.rgba(seed, z - 1, 2 * x, 2 * y + 1, captureOn),
          this.rgba(seed, z - 1, 2 * x + 1, 2 * y + 1, captureOn),
        ]);
        rgba = combineChildren(kids);
        this.stats.pyramid++;
      }
      const png = encodeTilePng(rgba);
      this.remember(k, png);
      fs.promises.mkdir(path.dirname(f), { recursive: true })
        .then(() => fs.promises.writeFile(f, png))
        .catch((e) => this.log(`[tiles] disk write failed ${k}: ${e.message}`));
      return { png, rgba };
    })();
    this.inflight.set(k, p);
    p.finally(() => this.inflight.delete(k)).catch(() => {});
    return p;
  }
  // drop a seed's tiles (every revision) — or everything when seed is null
  clear(seed = null) {
    for (const k of [...this.mem.keys()]) if (seed === null || k.startsWith(`${seed}/`)) this.mem.delete(k);
    let revs = [];
    try { revs = fs.readdirSync(this.root); } catch { return; }
    for (const rev of revs) {
      const t = seed === null ? path.join(this.root, rev) : path.join(this.root, rev, String(seed));
      fs.rmSync(t, { recursive: true, force: true });
    }
  }
  // delete every revision directory except the current one (startup hygiene)
  pruneOldRevisions() {
    let revs = [];
    try { revs = fs.readdirSync(this.root); } catch { return []; }
    const gone = revs.filter((r) => r !== this.rev);
    for (const r of gone) fs.rmSync(path.join(this.root, r), { recursive: true, force: true });
    return gone;
  }
}
