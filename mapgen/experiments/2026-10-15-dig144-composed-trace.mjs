// 2026-10-15-dig144-composed-trace.mjs — DIG #144 instrument: THE
// COMPOSED-CONTENT LAW (ISSUES I34 (a) lane attribution, (b) anchor law,
// (c) desert palette; (d) I33 field facts re-counted). Flags-ON lane only
// (the §12 flags-OFF black = by design, unchanged). No server — in-process
// ensureWorld against the r3i disk cache; the user's :8082 untouched.
//
// METER-CLASS: E1 (lane counts per chunk, tile-hash equality counts,
// seam-row/column diffs, material-cell counts, field-solid counts).
//
// PREDICTIONS (pre-registered 2026-10-15 BEFORE the first run; falsifiers named):
// P-A  kind-0 filler, ground band (ty>=62, no BitmapCaves): >=90% px composed
//      by the bgImageAt per-chunk backdrop lane (post-#142 field all-air =>
//      nz=0). FALSIFIED if noise-solid >10% or bg lane <90%.
// P-B  BitmapCaves filler, ground band (desert/winter/hills): >=80% px
//      noise-solid lane. FALSIFIED if <80%.
// P-C  surface-band filler (ty 48..61): noise lane structurally unreachable
//      (worldColorAt ty<62 never calls noiseSolidAt — fresh read this session)
//      => sky/template lanes >=95%. FALSIFIED by ANY noise-lane px.
// P-D  adjacent same-def caves chunk pairs: tile hashes IDENTICAL (the 512/256
//      mod-wrap => per-chunk re-anchor); wang + sky control pairs DIFFER.
//      FALSIFIED if any caves pair differs or any control pair matches.
// P-E  same-def kind-0 pairs (adjacent AND distant): tile hashes IDENTICAL
//      (bgImageAt chunk-frame tiling). FALSIFIED if any differs.
// P-F  surface-band filler pairs: hashes DIFFER (the sky lane is gx/gy-
//      anchored = continuous). FALSIFIED if identical.
// P-G  desert ground-filler solid cells: limit-rejected names (sand_surface /
//      sandstone_surface / sand_static_bright — limit_max_y <= 2048 vs
//      y = canvas_py - 24576 >= 7168 at rows >= 62) paint EXACTLY 0 cells;
//      >=40% of solid cells = idx 255 -> the 0x6a5a44 band shade (plains
//      dirt/mud). FALSIFIED if the limit-rejected family paints >0 or the
//      255-fallback share is <40%.
//
// (d) field facts re-counted fresh: per kind-0/caves chunk the solid count
// over the 52x52 mask (2704 cells) — I33's 0/2704 claim re-measured here.
//
// The trace mirror (traceAt) re-implements worldColorAt's branch order from
// the fresh 2026-10-15 read of world-gen.mjs:85-223 and asserts rgb identity
// against the real worldColorAt for EVERY px (mirror_mismatch must be 0 —
// a nonzero count = the mirror is wrong, re-read, never accommodate).
//
// Run:
//   node mapgen/experiments/2026-10-15-dig144-composed-trace.mjs \
//     [--seed 78633191 --seed 500412504] [--label dig144] [--no-png]
//
// RUN-1 ADDENDUM (2026-10-15, after the first run — predictions above stay
// as pre-registered, never rewritten): run 1 FALSIFIED P-D's full-tile arm
// (caves pairs differ as rgb tiles while the seam columns are pixel-exact
// eq=512/512) and P-G's >=40% idx-255 arm (the desert paints rock_static
// 2617-2651/2704 solids; idx255 = 7-9). Two discriminating measurements
// added for run 2: (1) maskHash/matHash — the raw 52x52 shape+material
// grids hashed SEPARATELY from the rgb tile, so "shape re-anchor with
// continuous color" is separable from "all varies"; (2) the desert.xml
// Materials re-read (B-level, this session): only sand_surface /
// sandstone_surface / sand_static_bright / copper carry limit_y="1"
// (gate live, y-window [-1024,700] never reaches the mines band y>=7168);
// sand_static x2 + rock_static x2 carry limit_y="0" => the limit caps are
// INERT and the [0.9,3.5) v-window comps paint rock_static at any depth.
//
// Output: stdout table + mapgen/out/dig144-trace-<label>-<seed>.json
//         + mapgen/out/dig144-<seed>-<cat>-<band>-<tx>_<ty>.png (visual record)

process.env.SURFACE_V2 ??= "1"; // must precede the lib imports (module-load flags)
process.env.SURFACE_V3 ??= "1";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

const { findNoitaDataDir, repoRoot } = await import("../lib/paths.mjs");
const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
const wg = await import("../lib/world-gen.mjs");
const { materialColorByName } = await import("../lib/colorize.mjs");
const { ensureBiomeBackdrop } = await import("../lib/noise-terrain.mjs");

const { ensureWorld, worldColorAt, WORLD_W, WORLD_H, SKY_ROWS, CHUNK, WORLD_CHUNKS_W, L3_ANCHOR } = wg;

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const seeds = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === "--seed") seeds.push(Number(argv[++i]));
if (!seeds.length) seeds.push(78633191, 500412504);
const label = opt("label", "dig144");
const noPng = argv.includes("--no-png");

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i");
const W = WORLD_CHUNKS_W;
const BAND = { sky: [44, 47], surface: [48, 61], ground: [62, 95] };
const bandOf = (ty) => (ty < 48 ? "sky" : ty < 62 ? "surface" : ty <= 95 ? "ground" : "deep");

// ---- chunk categorization -------------------------------------------------
function categorize(tx, ty) {
  const idx = (world ?? null) && world.grid[ty * W + tx];
  const at = biomeAt(config, tx, ty - SKY_ROWS);
  const def = at?.biome ?? null;
  const fn = def?.filename ?? null;
  if (idx >= 0) return { cat: "wang", def, fn };
  if (!def) return { cat: "sky", def: null, fn: null };
  if (def.bitmapCaves && def.bitmapCaves.sizeX) return { cat: "caves", def, fn };
  if (!def.noiseType) return { cat: "kind-1", def, fn };
  return { cat: "kind0", def, fn };
}
let world = null;

// ---- the trace mirror (fresh read of world-gen.mjs:85-223, 2026-10-15) ----
const AIRDARK = (r, g, b) =>
  (r === 13 && g === 14 && b === 18) || (r === 12 && g === 13 && b === 17) ||
  (r === 16 && g === 16 && b === 18) || (r === 21 && g === 23 && b === 30);
const VOID_RE = /(?:^|\/)(the_sky|barren|darkness|potion_mimics|boss_sky|sky_light_injector)\.xml$/;

function noiseColorMirror(tx, ty, solid, materialRgb) {
  if (!solid) return null;
  if (materialRgb) return materialRgb;
  const dark = ty - SKY_ROWS > 26 || ty - SKY_ROWS < -6;
  const hex = dark ? 0x1b1b1b : 0x6a5a44;
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function traceAt(w, wx, wy) {
  if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) return { lane: "oob", rgb: null };
  const gx = wx + L3_ANCHOR.x, gy = wy + L3_ANCHOR.y;
  if (gx >= WORLD_W || gy >= WORLD_H) return { lane: "oob", rgb: null };
  const tx = Math.floor(gx / CHUNK), ty = Math.floor(gy / CHUNK);
  if (ty < 62) {
    let binPx = null, voidChunk = false;
    const idxB = w.grid[ty * W + tx];
    if (idxB >= 0) {
      const a = w.areas[idxB];
      const m = w.maps.get(a.key);
      if (m) {
        const lx = gx - a.area.x1 * CHUNK, ly = gy - (a.area.y1 + SKY_ROWS) * CHUNK;
        if (lx >= 0 && ly >= 0 && lx < m.w * 10 && ly < m.h * 10) {
          const ax = Math.floor(lx / 10), ay = Math.floor(ly / 10);
          const p = 3 * (ay * m.w + ax);
          const r = m.rgb[p], g = m.rgb[p + 1], b = m.rgb[p + 2];
          const airDark = AIRDARK(r, g, b);
          voidChunk = VOID_RE.test(a.def?.filename ?? "");
          if (voidChunk) {
            // the void-sky bin never paints (sky fallback below)
          } else if (!airDark) {
            return { lane: "wang-bin", rgb: [r, g, b] };
          } else {
            const bd = ensureBiomeBackdrop(w.dataDir, a.def);
            if (bd) {
              const bx = ((lx % bd.w) + bd.w) % bd.w, by = ((ly % bd.h) + bd.h) % bd.h;
              const q = 4 * (by * bd.w + bx);
              binPx = [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]];
            }
          }
        }
      }
    }
    const buf = w.templates?.get(`${tx},${ty}`);
    if (buf) {
      const o = 3 * ((gy - ty * 512) * 512 + (gx - tx * 512));
      if (buf[o] !== 9) return { lane: "template-sky", rgb: [buf[o], buf[o + 1], buf[o + 2]] };
    }
    if (!voidChunk && binPx) return { lane: "binpx", rgb: binPx };
    const sk = w.skyAt?.(tx, ty, gx, gy) ?? null;
    return { lane: "sky", rgb: sk };
  }
  const idx = w.grid[ty * W + tx];
  if (idx >= 0) {
    const a = w.areas[idx];
    const m = w.maps.get(a.key);
    if (m) {
      const lx = gx - a.area.x1 * CHUNK, ly = gy - (a.area.y1 + SKY_ROWS) * CHUNK;
      if (lx >= 0 && ly >= 0 && lx < m.w * 10 && ly < m.h * 10) {
        const ax = Math.floor(lx / 10), ay = Math.floor(ly / 10);
        const p = 3 * (ay * m.w + ax);
        const r = m.rgb[p], g = m.rgb[p + 1], b = m.rgb[p + 2];
        if (AIRDARK(r, g, b)) {
          const bd = ensureBiomeBackdrop(w.dataDir, a.def);
          if (bd) {
            const bx = ((lx % bd.w) + bd.w) % bd.w, by = ((ly % bd.h) + bd.h) % bd.h;
            const q = 4 * (by * bd.w + bx);
            return { lane: "wang-airbg", rgb: [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]] };
          }
          return { lane: "wang-airbg-null", rgb: null };
        }
        return { lane: "wang-bin", rgb: [r, g, b] };
      }
    }
  }
  const key = `${tx},${ty}`;
  const buf = w.templates?.get(key);
  if (buf) {
    const o = 3 * ((gy - ty * CHUNK) * CHUNK + (gx - tx * CHUNK));
    if (buf[o] !== 9 || buf[o + 1] !== 9 || buf[o + 2] !== 9) {
      return { lane: "template", rgb: [buf[o], buf[o + 1], buf[o + 2]] };
    }
  }
  const nz = w.noiseSolidAt?.(gx, gy);
  if (nz != null) {
    const mat = w.noiseMatAt?.(gx, gy);
    let rgb = null;
    if (mat && mat.idx !== 255 && mat.names && mat.names[mat.idx] && w.dataDir) {
      rgb = materialColorByName(w.dataDir, mat.names[mat.idx]);
    }
    if (nz) return { lane: rgb ? "noise-solid-mat" : "noise-solid-band", rgb: noiseColorMirror(tx, ty, nz, rgb) };
    const bgr = w.bgImageAt?.(tx, ty, gx, gy);
    return { lane: bgr ? "noise-air-bg" : "noise-air-null", rgb: bgr ?? null };
  }
  return { lane: "noise-chunk-null", rgb: null };
}

// ---- render + trace one chunk tile ---------------------------------------
function renderTraceTile(x, y) {
  const rgb = new Uint8Array(512 * 512 * 3);
  const lanes = {};
  let mirrorMismatch = 0;
  for (let j = 0; j < 512; j++) {
    const wy = y * 512 + j;
    for (let i = 0; i < 512; i++) {
      const wx = x * 512 + i;
      const c = worldColorAt(world, wx, wy); // renderTile z0 semantics
      const t = traceAt(world, wx, wy);
      const a = c ?? [0, 0, 0], b = t.rgb ?? [0, 0, 0];
      if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) mirrorMismatch++;
      lanes[t.lane] = (lanes[t.lane] ?? 0) + 1;
      const p = 3 * (j * 512 + i);
      rgb[p] = a[0]; rgb[p + 1] = a[1]; rgb[p + 2] = a[2];
    }
  }
  const hash = crypto.createHash("sha256").update(rgb).digest("hex");
  // distinct colors + top6
  const hist = new Map();
  for (let p = 0; p < rgb.length; p += 3) {
    const k = (rgb[p] << 16) | (rgb[p + 1] << 8) | rgb[p + 2];
    hist.set(k, (hist.get(k) ?? 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([k, n]) => ({ hex: "#" + k.toString(16).padStart(6, "0"), n, pct: +(100 * n / (512 * 512)).toFixed(2) }));
  return { rgb, hash, lanes, mirrorMismatch, distinct: hist.size, top };
}

function seamStats(A, B, dir) {
  // dir "H": A's col511 vs B's col0 (display-adjacent), ref = A col511 vs A col510
  // dir "V": A's row511 vs B's row0, ref = A row511 vs A row510
  const colDiff = (X, c1, c2) => {
    let s = 0, eq = 0;
    for (let j = 0; j < 512; j++) {
      const p1 = 3 * (j * 512 + c1), p2 = 3 * (j * 512 + c2);
      const d = Math.abs(X[p1] - X[p2]) + Math.abs(X[p1 + 1] - X[p2 + 1]) + Math.abs(X[p1 + 2] - X[p2 + 2]);
      s += d; if (d === 0) eq++;
    }
    return { mean: s / 512, eq };
  };
  const rowDiff = (X, r1, r2) => {
    let s = 0, eq = 0;
    for (let i = 0; i < 512; i++) {
      const p1 = 3 * (r1 * 512 + i), p2 = 3 * (r2 * 512 + i);
      const d = Math.abs(X[p1] - X[p2]) + Math.abs(X[p1 + 1] - X[p2 + 1]) + Math.abs(X[p1 + 2] - X[p2 + 2]);
      s += d; if (d === 0) eq++;
    }
    return { mean: s / 512, eq };
  };
  if (dir === "H") {
    let s = 0, eq = 0; // A col511 vs B col0 across the display seam
    for (let j = 0; j < 512; j++) {
      const p1 = 3 * (j * 512 + 511), p2 = 3 * (j * 512 + 0);
      const d = Math.abs(A[p1] - B[p2]) + Math.abs(A[p1 + 1] - B[p2 + 1]) + Math.abs(A[p1 + 2] - B[p2 + 2]);
      s += d; if (d === 0) eq++;
    }
    return { seam: { mean: s / 512, eq }, ref: colDiff(A, 511, 510) };
  }
  let s = 0, eq = 0;
  for (let i = 0; i < 512; i++) {
    const p1 = 3 * (511 * 512 + i), p2 = 3 * (0 * 512 + i);
    const d = Math.abs(A[p1] - B[p2]) + Math.abs(A[p1 + 1] - B[p2 + 1]) + Math.abs(A[p1 + 2] - B[p2 + 2]);
    s += d; if (d === 0) eq++;
  }
  return { seam: { mean: s / 512, eq }, ref: rowDiff(A, 511, 510) };
}

// ---- material + field census for one chunk (E1) --------------------------
function chunkCensus(tx, ty) {
  const ch = world.noiseAt?.(tx, ty);
  if (!ch) return { noiseChunkNull: true };
  if (!ch.mask) return { noiseChunkNull: true };
  let solids = 0;
  const matHist = new Map();
  for (let k = 0; k < ch.mask.length; k++) {
    if (!ch.mask[k]) continue;
    solids++;
    const mi = ch.matIdx ? ch.matIdx[k] : 255;
    const name = mi !== 255 && ch.matNames && ch.matNames[mi] ? ch.matNames[mi] : "(idx255)";
    matHist.set(name, (matHist.get(name) ?? 0) + 1);
  }
  const cells = ch.mask.length;
  // P-D discriminator (2026-10-15, post-run-1): the SHAPE re-anchor question —
  // hash the raw 52x52 mask and the matIdx separately from the rgb tile, so
  // "identical shape, continuous color" is distinguishable from "all varies".
  const maskHash = crypto.createHash("sha256").update(Buffer.from(ch.mask)).digest("hex").slice(0, 16);
  const matHash = ch.matIdx ? crypto.createHash("sha256").update(Buffer.from(ch.matIdx)).digest("hex").slice(0, 16) : null;
  const mats = [...matHist.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({
    name, n,
    rgb: name === "(idx255)" ? "BANDSHADE" : (materialColorByName(dataDir, name) ?? "NO-COLOR"),
  }));
  const bd = ch.backdrop ?? null;
  return {
    noiseChunkNull: false, cells, solids, solidFrac: +(solids / cells).toFixed(4),
    maskHash, matHash,
    mats, backdrop: bd ? { w: bd.w ?? null, h: bd.h ?? null, fill: bd.fill ?? null } : null,
    v2: !!ch.v2,
  };
}

function writePng(tag, rgb) {
  if (noPng) return null;
  const png = new PNG({ width: 512, height: 512 });
  rgb.forEach((v, i) => { png.data[i] = v; });
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  const out = path.join(REPO, "mapgen/out", `dig144-${tag}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, PNG.sync.write(png));
  return out;
}

// ---- main ----------------------------------------------------------------
const results = {};
for (const seed of seeds) {
  console.log(`\n=== seed ${seed} (SURFACE_V2=${process.env.SURFACE_V2} SURFACE_V3=${process.env.SURFACE_V3} PROC_FILL=${process.env.PROC_FILL ?? "unset"}) ===`);
  world = ensureWorld(seed, dataDir, { cacheDir });
  await world.ready;

  // categorize every chunk in the measured bands
  const byKey = new Map(); // `${cat}|${band}|${fn}` -> [chunks]
  const all = [];
  for (let ty = BAND.sky[0]; ty <= BAND.ground[1]; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const c = categorize(tx, ty);
      const band = bandOf(ty);
      const entry = { tx, ty, ...c, band };
      all.push(entry);
      const k = `${c.cat}|${band}|${c.fn ?? "(null)"}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(entry);
    }
  }

  // pair selection: adjacent H, adjacent V, distant — PER GROUP (def-level cap)
  const pairs = [];
  for (const [k, list] of byKey) {
    const [cat, band, fn] = k.split("|");
    const at = (tx, ty) => list.find((e) => e.tx === tx && e.ty === ty);
    const cap = (kind) => pairs.filter((p) => p.group === k && p.kind === kind).length;
    const add = (kind, a, b) => { if (a && b && a !== b && cap(kind) < 2) pairs.push({ group: k, cat, band, def: fn, kind, a, b }); };
    for (const e of list) {
      add("H", e, at(e.tx + 1, e.ty));
      add("V", e, at(e.tx, e.ty + 1));
    }
    if (list.length >= 2) add("far", list[0], list[list.length - 1]);
  }
  // FORCE-include the (c) desert + (d) audit-relevant groups (P-G + I33's
  // black pockets) regardless of scan order — the whole point of the dig.
  const forceDef = (suffix, cat, band) => {
    const list = all.filter((e) => e.cat === cat && e.band === band && e.fn?.endsWith(suffix));
    if (list.length < 2) { if (list.length) { lone.push(list[0]); console.log(`  [force] ${suffix} ${cat}/${band}: only ${list.length} chunk(s) — single render`); } return; }
    const k = `${cat}|${band}|${list[0].fn}`;
    const at = (tx, ty) => list.find((e) => e.tx === tx && e.ty === ty);
    for (const e of list) {
      if (at(e.tx + 1, e.ty) && !pairs.some((p) => p.group === k && p.kind === "H")) pairs.push({ group: k, cat, band, def: list[0].fn, kind: "H", a: e, b: at(e.tx + 1, e.ty) });
      if (at(e.tx, e.ty + 1) && !pairs.some((p) => p.group === k && p.kind === "V")) pairs.push({ group: k, cat, band, def: list[0].fn, kind: "V", a: e, b: at(e.tx, e.ty + 1) });
    }
    if (!pairs.some((p) => p.group === k && p.kind === "far")) pairs.push({ group: k, cat, band, def: list[0].fn, kind: "far", a: list[0], b: list[list.length - 1] });
    // ensure the pair's chunks get rendered even if no pair formed
  };
  const forceChunk = (suffix, cat, band) => {
    const e = all.find((x) => x.cat === cat && x.band === band && x.fn?.endsWith(suffix));
    if (e) lone.push(e); else console.log(`  [force] ${suffix} ${cat}/${band}: NOT FOUND`);
  };
  const lone = [];
  forceDef("desert.xml", "caves", "ground");
  forceDef("hills.xml", "caves", "ground");
  forceDef("empty.xml", "kind0", "ground");
  forceDef("lake.xml", "kind0", "ground");
  forceDef("winter.xml", "caves", "ground");
  // I33's kind-1 black-pocket defs (audit list) — census + lane each
  for (const s of ["solid_wall_hidden_cavern.xml", "teleroom.xml", "friend_1.xml", "friend_4.xml", "solid_wall.xml"]) forceChunk(s, "kind-1", "ground");
  // wang control: same-area adjacent pair (ground)
  {
    const wlist = all.filter((e) => e.cat === "wang" && e.band === "ground");
    outer:
    for (const e of wlist) {
      for (const d of [[1, 0], [0, 1]]) {
        const n = wlist.find((o) => o.tx === e.tx + d[0] && o.ty === e.ty + d[1]);
        if (n && world.grid[e.ty * W + e.tx] === world.grid[n.ty * W + n.tx]) {
          pairs.push({ cat: "wang", band: "ground", def: "(same area)", kind: d[0] ? "H" : "V", a: e, b: n });
          break outer;
        }
      }
    }
  }

  // render + trace unique chunks
  const tiles = new Map(); // `${tx},${ty}` -> record
  const pngs = new Set();
  const ensureTile = (e) => {
    const key = `${e.tx},${e.ty}`;
    if (tiles.has(key)) return tiles.get(key);
    const t = renderTraceTile(e.tx, e.ty);
    const cen = (e.cat === "caves" || e.cat === "kind0" || e.cat === "kind-1") ? chunkCensus(e.tx, e.ty) : null;
    const rec = { ...e, ...t, census: cen };
    delete rec.rgb; // keep rgb only inside the map for seam stats
    rec._rgb = t.rgb;
    tiles.set(key, rec);
    // PNG: first chunk of each (cat, band) group + both sides of the first cave/kind0 pair
    const gk = `${e.cat}-${e.band}`;
    if (!pngs.has(gk)) {
      pngs.add(gk);
      rec.png = path.basename(writePng(`${seed}-${gk}-${e.tx}_${e.ty}.png`, t.rgb) ?? "");
    }
    return rec;
  };

  // pair evaluation
  const pairRows = [];
  for (const p of pairs) {
    const A = ensureTile(p.a), B = ensureTile(p.b);
    const seam = seamStats(A._rgb, B._rgb, p.kind === "H" ? "H" : p.kind === "V" ? "V" : "H");
    pairRows.push({
      cat: p.cat, band: p.band, def: p.def, kind: p.kind,
      A: `${p.a.tx},${p.a.ty}`, B: `${p.b.tx},${p.b.ty}`,
      hashA: A.hash.slice(0, 16), hashB: B.hash.slice(0, 16),
      identical: A.hash === B.hash,
      maskA: A.census?.maskHash ?? null, maskB: B.census?.maskHash ?? null,
      maskIdentical: A.census?.maskHash != null && A.census.maskHash === B.census?.maskHash,
      matIdentical: A.census?.matHash != null && A.census.matHash === B.census?.matHash,
      seamMeanAbs: +seam.seam.mean.toFixed(3), seamEqCols: seam.seam.eq,
      refMeanAbs: +seam.ref.mean.toFixed(3), refEq: seam.ref.eq,
    });
    // second PNG for the first pair of each cat+kind (visual repetition record)
    if (!pngs.has(`${p.cat}-${p.kind}-pair`)) {
      pngs.add(`${p.cat}-${p.kind}-pair`);
      if (!noPng) {
        const f = writePng(`${seed}-${p.cat}-${p.kind}-B-${p.b.tx}_${p.b.ty}.png`, B._rgb);
        if (f) B.png = path.basename(f);
      }
    }
  }

  // lone (forced, unpaired) chunks — render + trace them too (census/P-G)
  for (const e of lone) ensureTile(e);

  // lane rollup per (cat, band)
  const laneRoll = {};
  for (const t of tiles.values()) {
    const k = `${t.cat}|${t.band}`;
    if (!laneRoll[k]) laneRoll[k] = { chunks: 0, lanes: {}, defs: new Set(), mirrorMismatch: 0, solidFracs: [], png: null };
    const r = laneRoll[k];
    r.chunks++; r.defs.add(t.fn ?? "(null)"); r.mirrorMismatch += t.mirrorMismatch;
    if (!r.png && t.png) r.png = t.png;
    for (const [lane, n] of Object.entries(t.lanes)) r.lanes[lane] = (r.lanes[lane] ?? 0) + n;
    if (t.census && !t.census.noiseChunkNull) r.solidFracs.push(t.census.solidFrac);
  }
  const laneOut = {};
  for (const [k, r] of Object.entries(laneRoll)) {
    const total = Object.values(r.lanes).reduce((a, b) => a + b, 0);
    laneOut[k] = {
      chunks: r.chunks, defs: [...r.defs], mirrorMismatch: r.mirrorMismatch,
      lanes: Object.fromEntries(Object.entries(r.lanes).sort((a, b) => b[1] - a[1])
        .map(([l, n]) => [l, { n, pct: +(100 * n / total).toFixed(2) }])),
      solidFracMean: r.solidFracs.length ? +(r.solidFracs.reduce((a, b) => a + b, 0) / r.solidFracs.length).toFixed(4) : null,
      png: r.png,
    };
  }

  // per-chunk detail dump (first chunk of each group) + desert census
  const detail = [];
  const seen = new Set();
  for (const t of tiles.values()) {
    const k = `${t.cat}|${t.band}|${t.fn}`;
    if (seen.has(k)) continue;
    seen.add(k);
    detail.push({
      cat: t.cat, band: t.band, def: t.fn, tx: t.tx, ty: t.ty,
      hash: t.hash, distinct: t.distinct, top: t.top, lanes: t.lanes,
      census: t.census, png: t.png ?? null,
    });
  }

  const pairSummary = {};
  for (const p of pairRows) {
    const k = `${p.cat}|${p.band}|${p.kind}`;
    if (!pairSummary[k]) pairSummary[k] = { n: 0, identical: 0, rows: [] };
    pairSummary[k].n++; if (p.identical) pairSummary[k].identical++;
    pairSummary[k].rows.push(p);
  }

  results[seed] = { flags: { V2: process.env.SURFACE_V2, V3: process.env.SURFACE_V3, PROC_FILL: process.env.PROC_FILL ?? null }, laneRoll: laneOut, pairSummary, detail };

  // stdout
  console.log(`--- lane rollup (seed ${seed}; mirrorMismatch MUST be 0) ---`);
  for (const [k, r] of Object.entries(laneOut)) {
    const top = Object.entries(r.lanes).slice(0, 5).map(([l, v]) => `${l} ${v.pct}%`).join("  ");
    console.log(`${k.padEnd(26)} chunks=${String(r.chunks).padStart(2)} mirrorMis=${r.mirrorMismatch} solidFrac=${r.solidFracMean ?? "-"}  ${top}`);
  }
  console.log(`--- pair hash counts (identical/n) ---`);
  for (const [k, s] of Object.entries(pairSummary)) {
    console.log(`${k.padEnd(30)} ${s.identical}/${s.n} identical` + (s.n === s.identical ? "  [REPEAT]" : "  [varies]"));
    for (const r of s.rows) console.log(`     ${r.def} A=(${r.A}) B=(${r.B}) seam=${r.seamMeanAbs} ref=${r.refMeanAbs} eq=${r.seamEqCols}/512 tile=${r.identical} mask=${r.maskIdentical} mat=${r.matIdentical}`);
  }
  // desert palette (P-G)
  for (const d of detail.filter((d) => d.def?.includes("desert") && d.census && !d.census.noiseChunkNull)) {
    console.log(`--- desert census ${d.def} (${d.tx},${d.ty}) band=${d.band}: solids=${d.census.solids}/${d.census.cells} ---`);
    for (const m of d.census.mats) console.log(`     ${m.name.padEnd(24)} n=${String(m.n).padStart(5)} rgb=${JSON.stringify(m.rgb)}`);
  }

  const out = path.join(REPO, "mapgen/out", `dig144-trace-${label}-${seed}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results[seed], null, 1));
  console.log(`wrote ${out}`);
}
