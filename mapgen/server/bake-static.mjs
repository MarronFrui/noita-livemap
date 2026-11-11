// bake-static — pre-render the generated-world pyramid for the static demo.
//
// The genmap server renders tiles on demand (Node + the Noita data dir), so
// GitHub Pages cannot serve them. This script renders ONCE, locally, through
// the exact same tile law (TileService + TilePool, so the existing
// mapgen/out/tile-cache disk cache is reused), and writes the PNGs under
// public/static-tiles/<seed>/ for the Pages build to ship.
//
// Coverage (user call 2026-11-11 — "the entrance of the mountain with
// earlier levels"):
//   z0..z2  native detail for the mountain-entrance region
//           (chunks x 35..46, y 58..76: spawn column, the peak, the entrance
//           cave and the two biome bands below it)
//   z3..z7  the whole world, coarse — zooming out always works
// Tiles outside the baked set simply do not exist; the static viewer maps
// their 404 to air (black), never an error.
//
// Run: node mapgen/server/bake-static.mjs   (resumable: existing files skip)
// Keep TILE_REV in sync with genmap-server.mjs — same inputs, same hash, so
// the disk cache is shared.

import fs from "node:fs";
import path from "node:path";
import { repoRoot, findNoitaDataDir } from "../lib/paths.mjs";
import { GEN_CACHE_DIR } from "./gen-cache.mjs";
import { TileService, sourceRevision } from "./tile-service.mjs";
import { TilePool } from "./tile-pool.mjs";
import { WORLD_CHUNKS_W, WORLD_CHUNKS_H } from "../lib/world-gen.mjs";

// --- keep in sync with genmap-server.mjs -------------------------------------
const LIB_DIR = path.join(repoRoot, "mapgen/lib");
const TILE_REV = sourceRevision(
  [
    ...fs.readdirSync(LIB_DIR).filter((f) => f.endsWith(".mjs") || f.endsWith(".js")).map((f) => path.join(LIB_DIR, f)),
    path.join(repoRoot, "mapgen/server/tile-render.mjs"),
    path.join(repoRoot, "mapgen/server/tile-service.mjs"),
    path.join(repoRoot, "mapgen/server/tile-worker.mjs"),
    path.join(repoRoot, "mapgen/server/capture-layer.mjs"),
  ],
  [path.basename(GEN_CACHE_DIR), findNoitaDataDir(), ...["SURFACE_V2", "SURFACE_V3", "CAPTURE_LAYER"].map((k) => `${k}=${process.env[k] ?? ""}`)].join("|")
);

const SEED = 78633191;
const REGION = { x0: 35, x1: 46, y0: 58, y1: 76 }; // inclusive, chunks
const REGION_MAX_Z = 2; // native detail up to this level, region only
const OUT_ROOT = path.join(repoRoot, "public/static-tiles");

const dataDir = findNoitaDataDir();
const pool = new TilePool({
  size: Number(process.env.GENMAP_WORKERS ?? 4),
  chunkCache: Number(process.env.GENMAP_WORKER_CHUNKS ?? 192),
  dataDir,
  cacheDir: GEN_CACHE_DIR,
  log: (m) => console.log(`[bake] ${m}`),
});
const tiles = new TileService({
  root: path.join(repoRoot, "mapgen/out/tile-cache"),
  rev: TILE_REV,
  renderDirect: (seed, z, x, y, captureOn, opts) => pool.render({ ...opts, seed, z, x, y, captureOn }),
  gridW: WORLD_CHUNKS_W,
  gridH: WORLD_CHUNKS_H,
  log: (m) => console.log(`[bake] ${m}`),
});

function plan() {
  const jobs = [];
  for (let z = 0; z <= REGION_MAX_Z; z++) {
    const s = 2 ** z;
    for (let y = Math.floor(REGION.y0 / s); y <= Math.floor(REGION.y1 / s); y++) {
      for (let x = Math.floor(REGION.x0 / s); x <= Math.floor(REGION.x1 / s); x++) {
        jobs.push([z, x, y]);
      }
    }
  }
  for (let z = REGION_MAX_Z + 1; z <= 7; z++) {
    const gw = Math.ceil(WORLD_CHUNKS_W / 2 ** z), gh = Math.ceil(WORLD_CHUNKS_H / 2 ** z);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) jobs.push([z, x, y]);
  }
  return jobs;
}

const jobs = plan();
const outDir = path.join(OUT_ROOT, String(SEED));
fs.mkdirSync(outDir, { recursive: true });
console.log(`[bake] rev ${TILE_REV} · seed ${SEED} · ${jobs.length} tiles → public/static-tiles/${SEED}/`);

let done = 0, bytes = 0, skipped = 0;
const t0 = Date.now();
for (const [z, x, y] of jobs) {
  const dir = path.join(outDir, String(z));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${x}_${y}.png`);
  if (fs.existsSync(file)) { skipped++; continue; }
  const png = await tiles.png(SEED, z, x, y, false, "high");
  fs.writeFileSync(file, png);
  done++; bytes += png.length;
  if (done % 25 === 0) {
    console.log(`[bake] ${done}/${jobs.length - skipped} rendered (${(bytes / 1e6).toFixed(1)} MB) · ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}

fs.writeFileSync(
  path.join(OUT_ROOT, "manifest.json"),
  JSON.stringify({
    seed: SEED,
    rev: TILE_REV,
    bakedAt: new Date().toISOString(),
    world: { chunksW: WORLD_CHUNKS_W, chunksH: WORLD_CHUNKS_H },
    region: REGION,
    nativeMaxZ: REGION_MAX_Z,
    coarseMinZ: REGION_MAX_Z + 1,
    maxZ: 7,
  }, null, 2)
);
console.log(`[bake] done: ${done} rendered, ${skipped} already present, ${(bytes / 1e6).toFixed(1)} MB new · ${Math.round((Date.now() - t0) / 1000)} s total`);
process.exit(0);
