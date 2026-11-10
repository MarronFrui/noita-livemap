// A tile worker: owns its own lazy world per seed and
// renders direct-law tiles (tile-render.mjs) on request. Started by
// tile-pool.mjs; protocol (parent ⇄ worker):
//   → { type: "render", id, seed, z, x, y, captureOn }
//   ← { type: "tile", id, rgba: ArrayBuffer (transferred) } | { type: "error", id, message }
//   ← { type: "progress", seed, done, total } while a world builds
//   ← { type: "ready", seed } once a seed's world is built
//   → { type: "drop", seed | null } forget a seed's world (/gen/clear)
// Worlds: a small LRU (workerData.maxWorlds, default 1) — one world per seed
// per worker is the memory unit the pool's GENMAP_WORKERS multiplies.

import { parentPort, workerData } from "node:worker_threads";
import { ensureWorld } from "../lib/world-gen.mjs";
import { renderTileRGBA } from "./tile-render.mjs";
import { worldColorComposedAt } from "./capture-layer.mjs";

const { dataDir, cacheDir, maxWorlds = 1 } = workerData;
const worlds = new Map(); // seed -> world (insertion-order LRU)

function worldFor(seed) {
  let w = worlds.get(seed);
  if (w) { worlds.delete(seed); worlds.set(seed, w); return w; }
  while (worlds.size >= maxWorlds) worlds.delete(worlds.keys().next().value);
  let done = 0;
  w = ensureWorld(seed, dataDir, {
    cacheDir,
    onProgress: () => {
      done++;
      if (done % 10 === 0) parentPort.postMessage({ type: "progress", seed, done, total: w?.areas?.length ?? 0 });
    },
  });
  w.ready.then(() => parentPort.postMessage({ type: "ready", seed, total: w.areas.length, errors: w.errors.size }));
  worlds.set(seed, w);
  return w;
}

parentPort.on("message", async (msg) => {
  if (msg.type === "drop") { // /gen/clear: forget a seed's world (null = all)
    if (msg.seed == null) worlds.clear(); else worlds.delete(msg.seed);
    return;
  }
  if (msg.type !== "render") return;
  const { id, seed, z, x, y, captureOn } = msg;
  try {
    const world = worldFor(seed);
    await world.ready;
    const rgba = renderTileRGBA((wx, wy) => worldColorComposedAt(world, seed, captureOn, wx, wy), z, x, y);
    parentPort.postMessage({ type: "tile", id, rgba: rgba.buffer }, [rgba.buffer]);
  } catch (e) {
    parentPort.postMessage({ type: "error", id, message: String(e?.stack ?? e) });
  }
});
