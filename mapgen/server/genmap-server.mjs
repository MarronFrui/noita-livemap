// genmap server — on-demand tiles of the generated world for any seed.
//
// Routes:
//   GET /gen/tile/:seed/:z/:x/:y.png   z=0 native (512x512 world-px tiles,
//                                      one per chunk), z+1 halves resolution
//   GET /gen/tile/:seed/:z/:x/:y.png?c=0|1     override the capture-composite
//                                      display layer for this request
//                                      (ISSUES A10; default OFF since
//                                      2026-10-21, fires at seed 78633191)
//   GET /gen/status/:seed              generation progress JSON (includes `epoch`
//                                      + the `capture` layer state)
//   GET|POST /gen/clear/:seed          dev: drop one seed's disk cache + memory,
//                                      next request regenerates from scratch
//   GET|POST /gen/clear                dev: same, for every cached seed
//
// Coordinate system: "canvas px" = biome-map px * 512 — canvas (0,0) is
// biome px (0,0) = world (-17920, -7168). Area maps are placed at
// area.x1*512, area.y1*512 directly. True world px = canvas - (17920, 7168).
//
// Run: npm run gen:server  (port GENMAP_PORT, default 8082)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { clearGenCache } from "./gen-cache.mjs";
import {
  ensureWorld,
  worldColorAt,
  WORLD_W,
  WORLD_H,
  WORLD_CHUNKS_W,
  WORLD_CHUNKS_H,
} from "../lib/world-gen.mjs";

const PORT = Number(process.env.GENMAP_PORT ?? 8082);
const dataDir = findNoitaDataDir();
const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i"); // r3i: this cache dir stores ONLY the wang-area bins (world.maps, seed+area-keyed) — independent of the cave-field lane. The caves-field lane is OPT-IN via SURFACE_V3=1 (noise-terrain.mjs); the default render is the template painter + static-tile + wang lanes (see VERIFIED.md §12). Bump to a fresh rev only when a cached build's output observably changes.

const worlds = new Map(); // seed -> { world, progress, ready }
// Bump-per-start epoch (Date.now()): every server restart invalidates the
// browser's immutable `?e=` tile URLs, so no stale pre-fix tiles can
// survive a deploy; /gen/clear still explicit-bumps (epoch is monotonic
// within a session).
let cacheEpoch = Date.now(); // bumped on every /gen/clear — the viewer appends it to tile URLs to bust the browser's immutable tile cache

// the tile memory cache (LRU-ish; see the tile route)
const tileCache = new Map();

// ── capture-composite display layer (ISSUES A10) ───────────────────────────
// The game's runtime-computed lanes (the splice/fixed-scene driver fills, the
// deep fill bands) are only partially recovered — their cells currently show
// approximations. At the CAPTURED seed the viewer can instead take those world
// px straight from the capture tiles (mapgen/out/ref = noita-mapcap's own
// output for seed 78633191 = the game's true pixels, M-grade ground truth,
// mapcap/README). Frame law: canvas px = world px + (17920, 31744) (C145),
// so capture `X_Y.png` (the game chunk X−35, Y−14) = canvas chunk (X, Y+48),
// 1:1 px (empirically pinned: our tile 40_63 lava-family count = 81,897 vs
// the capture's 40_15 = 80,268, and 40_64 = 242,351 both).
// Scope honesty: the fill pixels are SEED-DEPENDENT, so the layer is
// registered at the captured seed only (the world-fixed landmark ART is
// seed-independent — I9 — but its driver fill is not). Display-only by
// construction: it wraps worldColorAt here in the server; the lib lanes and
// the E1/E2 instruments read the generator directly and are unaffected.
// Default OFF (user call 2026-10-21): the layer only ever shows the
// noitamap capture of seed 78633191 — a world that is never the live
// run's — so it is pointless at any other seed and a per-px lookup cost
// at this one. CAPTURE_LAYER=1 re-enables it globally (benchmark use at
// the demo seed); the viewer overrides per request with ?c=0 / ?c=1 on
// the tile URL. It dies when the field's noise law + the scene fill
// laws compose at the demo seed (the dig #177+ lane work).
const CAPTURE_SEED = 78633191;
const CAPTURE_DIR = path.join(repoRoot, "mapgen/out/ref");
const CAPTURE_DEFAULT = process.env.CAPTURE_LAYER === "1";
const captureTiles = new Map(); // "tx,ty" -> Uint8Array(512*512*3) | null (absent)
const captureLru = [];
function captureTileAt(tx, ty) {
  const key = `${tx},${ty}`;
  let t = captureTiles.get(key);
  if (t === undefined) {
    t = null; // miss sentinel — absent tiles are not re-read per px
    try {
      const png = PNG.sync.read(fs.readFileSync(path.join(CAPTURE_DIR, `${tx}_${ty - 48}.png`)));
      if (png.width === 512 && png.height === 512) {
        const rgb = new Uint8Array(512 * 512 * 3);
        for (let i = 0, p = 0; p < rgb.length; i += 4, p += 3) {
          rgb[p] = png.data[i]; rgb[p + 1] = png.data[i + 1]; rgb[p + 2] = png.data[i + 2];
        }
        t = rgb;
      }
    } catch { /* no capture coverage at this chunk */ }
    captureTiles.set(key, t);
    captureLru.push(key);
    if (captureLru.length > 192) captureTiles.delete(captureLru.shift());
  }
  return t;
}
function worldColorComposedAt(world, seed, captureOn, wx, wy) {
  if (captureOn && seed === CAPTURE_SEED && wx >= 0 && wy >= 0) {
    const t = captureTileAt(Math.floor(wx / 512), Math.floor(wy / 512));
    if (t) {
      const p = 3 * ((wy & 511) * 512 + (wx & 511));
      return [t[p], t[p + 1], t[p + 2]];
    }
  }
  return worldColorAt(world, wx, wy);
}

function getWorld(seed) {
  let entry = worlds.get(seed);
  if (entry) return entry;
  const progress = { done: 0, total: 0, errors: [] };
  const world = ensureWorld(seed, dataDir, {
    cacheDir,
    onProgress: (ok, key, err) => {
      progress.done++;
      if (err) progress.errors.push(String(err.message ?? err));
      if (progress.done % 10 === 0 || progress.done === progress.total) {
        console.log(`[genmap] seed ${seed}: ${progress.done}/${progress.total} areas${progress.errors.length ? ` (${progress.errors.length} errors)` : ""}`);
      }
    },
  });
  progress.total = world.areas.length;
  entry = { world, progress, ready: world.ready };
  worlds.set(seed, entry);
  return entry;
}

// Tile rendering. Zoom semantics dig (52) — the moiré fix:
// z=0: 1:1 per world px (the canonical paint).
// z>0: a tile's scale-block covers `scale` world px per axis. The global
// point-sample `(y*512+j)*scale` aliases badly across lanes (art px, wang
// cells and the old noise speckle) — it made the zoomed-out map "pop"
// solid/air inconsistently with zoom level (the dense-rock-at-out-zoom
// report). The honest downsample: per output pixel, enumerate the distinct
// 10-world-px wang cells inside the block (steps of 10, cell centers),
// count solid vs air, and emit the majority's color (air = transparent).
function renderTile(world, z, x, y, seed, captureOn) {
  const png = new PNG({ width: 512, height: 512 });
  const data = png.data;
  let p = 0;
  if (z === 0) {
    for (let j = 0; j < 512; j++) {
      const wy = (y * 512 + j);
      for (let i = 0; i < 512; i++) {
        const wx = (x * 512 + i);
        const c = worldColorComposedAt(world, seed, captureOn, wx, wy);
        if (c) {
          data[p] = c[0];
          data[p + 1] = c[1];
          data[p + 2] = c[2];
        }
        data[p + 3] = 255;
        p += 4;
      }
    }
    return PNG.sync.write(png);
  }
  const scale = 2 ** z;
  const step = Math.min(scale, 10);
  // one reused tally scratch (cleared per pixel — no 512² Map churn)
  const tally = new Map();
  for (let j = 0; j < 512; j++) {
    const wy0 = (y * 512 + j) * scale;
    for (let i = 0; i < 512; i++) {
      const wx0 = (x * 512 + i) * scale;
      let solid = 0, total = 0, best = null, bestN = 0;
      tally.clear();
      for (let sy = 0; sy < scale; sy += step) {
        const wy = wy0 + Math.min(sy + (step >> 1), scale - 1);
        for (let sx = 0; sx < scale; sx += step) {
          const wx = wx0 + Math.min(sx + (step >> 1), scale - 1);
          const c = worldColorComposedAt(world, seed, captureOn, wx, wy);
          total++;
          if (!c) continue;
          solid++;
          const key = ((c[0] >> 2) << 10) | ((c[1] >> 2) << 5) | (c[2] >> 2);
          const it = (tally.get(key) ?? 0) + 1;
          tally.set(key, it);
          if (it > bestN) { bestN = it; best = c; }
        }
      }
      if (solid * 2 >= total && best) {
        data[p] = best[0]; data[p + 1] = best[1]; data[p + 2] = best[2];
      }
      data[p + 3] = 255;
      p += 4;
    }
  }
  return PNG.sync.write(png);
}

process.on("uncaughtException", (e) => console.error("[genmap] uncaught:", e));
process.on("unhandledRejection", (e) => console.error("[genmap] unhandled:", e));

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url, "http://localhost");
  try {
    let m;
    if ((m = url.pathname.match(/^\/gen\/tile\/(-?\d+)\/(\d+)\/(\d+)\/(\d+)\.png$/))) {
      const seed = Number(m[1]) >>> 0;
      const z = Number(m[2]), x = Number(m[3]), y = Number(m[4]);
      const scale = 2 ** z;
      const gw = Math.ceil(WORLD_CHUNKS_W / scale), gh = Math.ceil(WORLD_CHUNKS_H / scale);
      if (z > 7 || x < 0 || y < 0 || x >= gw || y >= gh) {
        res.writeHead(404).end("bad tile coords");
        return;
      }
      // the tile memory cache (dig: the scroll UX — re-scrolling a visited
      // area served from the RAM instead of the per-request re-render;
      // LRU-capped at 512 tiles; cleared on /gen/clear via the epoch change
      // (the epoch rides the viewer's tile urls)).
      const cParam = url.searchParams.get("c");
      const captureOn = cParam != null ? cParam !== "0" : CAPTURE_DEFAULT;
      const tkey = `${seed}/${z}/${x}/${y}${captureOn ? "" : "/nc"}`;
      const cached = tileCache.get(tkey);
      if (cached && cached.epoch === cacheEpoch) {
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" });
        res.end(cached.buf);
        return;
      }
      const entry = getWorld(seed);
      if (!entry.progress.ready) await entry.ready;
      entry.progress.ready = true;
      const png = renderTile(entry.world, z, x, y, seed, captureOn);
      tileCache.set(tkey, { buf: png, epoch: cacheEpoch });
      if (tileCache.size > 512) {
        // cheap eviction: drop the oldest inserted keys
        for (const k of tileCache.keys()) {
          tileCache.delete(k);
          if (tileCache.size <= 384) break;
        }
      }
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" });
      res.end(png);
      return;
    }
    if ((m = url.pathname.match(/^\/gen\/status\/(-?\d+)$/))) {
      const seed = Number(m[1]) >>> 0;
      const entry = getWorld(seed);
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
      res.end(JSON.stringify({ ready: entry.progress.done >= entry.progress.total, epoch: cacheEpoch, capture: CAPTURE_DEFAULT && seed === CAPTURE_SEED, ...entry.progress }));
      return;
    }
    if ((m = url.pathname.match(/^\/gen\/clear(?:\/(-?\d+))?$/))) {
      // Dev tool: drop the generated-world cache and force a fresh generation.
      // POST is canonical; GET is allowed for convenience (local-only server).
      const seed = m[1] !== undefined ? Number(m[1]) >>> 0 : null;
      const entry = seed !== null ? worlds.get(seed) : undefined;
      const wasGenerating = !!entry && entry.progress.done < entry.progress.total;
      const removed = clearGenCache({ seed });
      if (seed === null) worlds.clear();
      else worlds.delete(seed);
      cacheEpoch++;
      console.log(
        `[genmap] cache cleared (seed ${seed ?? "ALL"}, epoch ${cacheEpoch}, ${removed.length} seed dir(s) removed)${wasGenerating ? " — was mid-generation" : ""}`
      );
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ cleared: true, seed, epoch: cacheEpoch, removed: removed.length, wasGenerating }));
      return;
    }
    if ((m = url.pathname.match(/^\/gen\/zones\/(-?\d+)$/))) {
      // per-chunk classification (mostly seed-independent; errors need the run)
      // tags: 0 template/sky/no-wang · 1 wang generated · 2 unsupported atlas ·
      //       3 no attempt accepted · 5 Holy Mountain band (non-wang)
      const seed = Number(m[1]) >>> 0;
      const entry = getWorld(seed);
      await entry.ready; // error tags need full generation
      const w = entry.world;
      const HM_ROWS = new Set([64, 67, 71, 74, 78, 82, 87]); // biome rows +48 (canvas)
      const tags = new Array(WORLD_CHUNKS_W * WORLD_CHUNKS_H);
      for (let ty = 0; ty < WORLD_CHUNKS_H; ty++) {
        for (let tx = 0; tx < WORLD_CHUNKS_W; tx++) {
          const gi = ty * WORLD_CHUNKS_W + tx;
          const idx = w.grid[gi];
          if (idx >= 0) {
            tags[gi] = w.errors.has(w.areas[idx].key) ? (String(w.errors.get(w.areas[idx].key)).includes("corner-type") ? 2 : 3) : 1;
          } else {
            tags[gi] = HM_ROWS.has(ty) ? 5 : 0;
          }
        }
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
      res.end(JSON.stringify({ w: WORLD_CHUNKS_W, h: WORLD_CHUNKS_H, tags }));
      return;
    }
    if (url.pathname === "/" || url.pathname === "/genmap.html") {
      res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
      res.end(fs.readFileSync(path.join(repoRoot, "public/genmap.html")));
      return;
    }
    res.writeHead(404).end("not found");
  } catch (e) {
    console.error("[genmap]", e);
    res.writeHead(500).end(String(e.message ?? e));
  }
});

server.listen(PORT, () => {
  console.log(`[genmap] listening on http://localhost:${PORT} (data: ${dataDir})`);
  console.log(`[genmap] try: http://localhost:${PORT}/gen/tile/78633191/0/34/14.png`);
});
