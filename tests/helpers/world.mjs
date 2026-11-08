// Drop a test world's big buffers once its file is done (memory law,
// 2026-11-08). A world is ~4.6 GB RSS (the template chunk Map ≈ 3.8 GB);
// the singleFork worker runs every file in ONE process, and a finished
// file's world lingered into the next world-building file (battery peak
// ≥ 8 GB, two worlds resident — the WSL-starving OOM class). Clearing the
// Maps frees the Buffers even if a stale module graph still points at the
// world object.
export function releaseWorld(world) {
  if (!world) return;
  for (const k of ["templates", "maps", "rawMaps", "wangScenes", "workDefs", "errors"]) {
    world[k]?.clear?.();
  }
  world.wangSceneLog = null;
}
