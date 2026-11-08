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
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { clearGenCache } from "./gen-cache.mjs";
import { TileService, sourceRevision } from "./tile-service.mjs";
import { CAPTURE_SEED, CAPTURE_DEFAULT } from "./capture-layer.mjs";
import { TilePool } from "./tile-pool.mjs";
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
const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3j"); // r3j (r3i + the spawn-colour → air display law, wang-scenes lane): this cache dir stores ONLY the wang-area bins (world.maps, seed+area-keyed) — independent of the cave-field lane. DIG #192 PRODUCT FLIP (2026-10-23): the caves-field lane is ON by default (no env needed — `npm run gen:server` starts ALL lanes); the old opt-in belonged to the D-grade era, superseded by the C165/C166 port. SURFACE_V3=0/2=0 = the old detached lane (the instrument baselines). Bump to a fresh rev only when a cached build's output observably changes.

const worlds = new Map(); // seed -> { world, progress, ready }
// A world was ~4.6 GB RSS when the template planes rendered eagerly; with the
// lazy chunk store (chunk-store.mjs, 2026-11-08) it is ~0.6 GB at ready and
// bounded by the chunk cache (MAPGEN_CHUNK_CACHE) after browsing. Keep only
// the most recently used seeds resident; in-flight requests keep their entry.
const MAX_WORLDS = Math.max(1, Number(process.env.GENMAP_MAX_WORLDS ?? 3));
// The tile revision (perf C, 2026-11-08): a hash of the generator + tile-law
// sources, the gen-cache rev and the paint-affecting env flags. Tiles persist
// on disk under it (mapgen/out/tile-cache/<rev>/…), so a restart keeps every
// valid tile and a code change can never serve a stale one. The viewer's
// `?e=` epoch = `<rev>.<clears>` — /gen/clear still bumps it.
const LIB_DIR = path.join(repoRoot, "mapgen/lib");
const TILE_REV = sourceRevision(
  [
    ...fs.readdirSync(LIB_DIR).filter((f) => f.endsWith(".mjs") || f.endsWith(".js")).map((f) => path.join(LIB_DIR, f)),
    path.join(repoRoot, "mapgen/server/tile-render.mjs"),
    path.join(repoRoot, "mapgen/server/tile-service.mjs"),
    path.join(repoRoot, "mapgen/server/tile-worker.mjs"),
    path.join(repoRoot, "mapgen/server/capture-layer.mjs"),
  ],
  [path.basename(cacheDir), dataDir, ...["SURFACE_V2", "SURFACE_V3", "PROC_FILL", "CAPTURE_LAYER"].map((k) => `${k}=${process.env[k] ?? ""}`)].join("|")
);
let clears = 0;
const epochNow = () => `${TILE_REV}.${clears}`;

function getWorld(seed) {
  let entry = worlds.get(seed);
  if (entry) {
    worlds.delete(seed); // LRU: re-insert as the most recent
    worlds.set(seed, entry);
    return entry;
  }
  while (worlds.size >= MAX_WORLDS) {
    const oldest = worlds.keys().next().value;
    worlds.delete(oldest);
    console.log(`[genmap] evicted seed ${oldest} (GENMAP_MAX_WORLDS=${MAX_WORLDS})`);
  }
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

// Direct-law tiles render on the worker pool (perf D, tile-pool.mjs):
// GENMAP_WORKERS threads (default 4), each with its own lazy world and a
// GENMAP_WORKER_CHUNKS chunk cache (default 192 ≈ 150 MB).
const pool = new TilePool({
  size: Number(process.env.GENMAP_WORKERS ?? 4),
  chunkCache: Number(process.env.GENMAP_WORKER_CHUNKS ?? 192),
  dataDir,
  cacheDir,
  log: (m) => console.log(m),
});
const renderDirect = (seed, z, x, y, captureOn, { key, priority } = {}) =>
  pool.render({ key, seed, z, x, y, captureOn, priority });
const tiles = new TileService({
  root: path.join(repoRoot, "mapgen/out/tile-cache"),
  rev: TILE_REV,
  renderDirect,
  gridW: WORLD_CHUNKS_W,
  gridH: WORLD_CHUNKS_H,
  onBump: (k) => pool.bump(k),
  log: (m) => console.log(m),
});

// Prewarm (perf D): the first touch of a seed queues, at LOW priority, the
// opening view (z1 around spawn), then the whole z4 level (every zoomed-out
// view is then a cheap pyramid of cached tiles), then z2 around spawn. The
// tiles land in the disk cache, so each seed prewarms once per revision.
const prewarmed = new Set();
function prewarm(seed) {
  const k = `${seed}`;
  if (prewarmed.has(k)) return;
  prewarmed.add(k);
  const SPAWN = { x: 35 * 512, y: 62 * 512 };
  const ring = (z, rx, ry) => {
    const span = 512 * 2 ** z, out = [];
    const cx = Math.floor(SPAWN.x / span), cy = Math.floor(SPAWN.y / span);
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) if (tiles.inGrid(z, x, y)) out.push([z, x, y]);
    return out.sort((a, b) => Math.hypot(a[1] - cx, a[2] - cy) - Math.hypot(b[1] - cx, b[2] - cy));
  };
  const z4 = [];
  for (let y = 0; y < Math.ceil(WORLD_CHUNKS_H / 16); y++) for (let x = 0; x < Math.ceil(WORLD_CHUNKS_W / 16); x++) z4.push([4, x, y]);
  const plan = [...ring(1, 3, 2), ...z4, ...ring(2, 3, 3)];
  const t0 = Date.now();
  Promise.allSettled(plan.map(([z, x, y]) => tiles.png(seed, z, x, y, CAPTURE_DEFAULT, "low"))).then((r) => {
    const failed = r.filter((x) => x.status === "rejected").length;
    console.log(`[genmap] prewarm seed ${seed}: ${plan.length - failed}/${plan.length} tiles in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
{
  const gone = tiles.pruneOldRevisions();
  if (gone.length) console.log(`[genmap] tile cache: removed ${gone.length} stale revision dir(s)`);
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
      const cParam = url.searchParams.get("c");
      const captureOn = cParam != null ? cParam !== "0" : CAPTURE_DEFAULT;
      prewarm(seed);
      const png = await tiles.png(seed, z, x, y, captureOn);
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" });
      res.end(png);
      return;
    }
    if ((m = url.pathname.match(/^\/gen\/status\/(-?\d+)$/))) {
      const seed = Number(m[1]) >>> 0;
      prewarm(seed); // the viewer polls status first: start the seed's workers now
      const st = pool.progress(seed);
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
      res.end(JSON.stringify({ ready: st.ready, done: st.done, total: st.total, errors: [], epoch: epochNow(), capture: CAPTURE_DEFAULT && seed === CAPTURE_SEED, pool: pool.stats, tiles: tiles.stats }));
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
      tiles.clear(seed);
      pool.dropSeed(seed);
      if (seed === null) prewarmed.clear(); else prewarmed.delete(`${seed}`);
      clears++;
      console.log(
        `[genmap] cache cleared (seed ${seed ?? "ALL"}, epoch ${epochNow()}, ${removed.length} seed dir(s) removed)${wasGenerating ? " — was mid-generation" : ""}`
      );
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ cleared: true, seed, epoch: epochNow(), removed: removed.length, wasGenerating }));
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
