// A stand-in tile worker for tests/mapgen/tile-pool.test.mjs: answers each
// render after `delay` ms with a 1-byte tile = the task's z, logs the order,
// and exits on seed 666 (the crash path).
import { parentPort } from "node:worker_threads";

parentPort.on("message", (m) => {
  if (m.type !== "render") return;
  if (m.seed === 666) process.exit(3);
  parentPort.postMessage({ type: "ready", seed: m.seed, total: 1 });
  setTimeout(() => {
    const b = new Uint8Array([m.z, m.x, m.y]);
    parentPort.postMessage({ type: "tile", id: m.id, rgba: b.buffer }, [b.buffer]);
  }, m.x === 99 ? 200 : 20);
});
