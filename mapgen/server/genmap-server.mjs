// genmap server — on-demand tiles of the generated world for any seed.
//
// Routes:
//   GET /gen/tile/:seed/:z/:x/:y.png   z=0 native (512x512 world-px tiles,
//                                      one per chunk), z+1 halves resolution
//   GET /gen/status/:seed              generation progress JSON (includes `epoch`)
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
const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3f"); // r3f: F3 noise-terrain integration (procedural-biome evaluator chain, 2026-09-20 — observable change: noise bands render)

const worlds = new Map(); // seed -> { world, progress, ready }
let cacheEpoch = 0; // bumped on every /gen/clear — the viewer appends it to tile URLs to bust the browser's immutable tile cache

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

function renderTile(world, z, x, y) {
  const scale = 2 ** z;
  const png = new PNG({ width: 512, height: 512 });
  const data = png.data;
  let p = 0;
  for (let j = 0; j < 512; j++) {
    const wy = (y * 512 + j) * scale;
    for (let i = 0; i < 512; i++) {
      const wx = (x * 512 + i) * scale;
      const c = worldColorAt(world, wx, wy);
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
      const entry = getWorld(seed);
      if (!entry.progress.ready) await entry.ready;
      entry.progress.ready = true;
      const png = renderTile(entry.world, z, x, y);
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" });
      res.end(png);
      return;
    }
    if ((m = url.pathname.match(/^\/gen\/status\/(-?\d+)$/))) {
      const seed = Number(m[1]) >>> 0;
      const entry = getWorld(seed);
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
      res.end(JSON.stringify({ ready: entry.progress.done >= entry.progress.total, epoch: cacheEpoch, ...entry.progress }));
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
