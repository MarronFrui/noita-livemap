// Shared generated-world cache clearing for the genmap server (HTTP
// /gen/clear endpoints) and the CLI (`npm run gen:clear`).
//
// Cache layout: mapgen/out/gen-cache/<revision>/<seed>/<areaKey>.bin. The
// cache stores only the wang-area bins (world.maps, seed+area-keyed).
// GEN_CACHE_REV is bumped by hand, and only when a cached build's output
// observably changes; delete the previous revision's directory when you do.
// clearGenCache removes cache trees so the next ensureWorld() regenerates.

import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../lib/paths.mjs";

export const GEN_CACHE_ROOT = path.join(repoRoot, "mapgen/out/gen-cache");
export const GEN_CACHE_REV = "r3o";
export const GEN_CACHE_DIR = path.join(GEN_CACHE_ROOT, GEN_CACHE_REV);

/**
 * Remove generated-world cache trees.
 * @param {{ seed?: number|null, root?: string }} opts
 *   seed=null (default) removes every revision + seed (the whole cache);
 *   a seed number removes that seed's directory under every revision.
 *   `root` overrides the cache root (used by tests).
 * @returns {string[]} removed paths relative to the cache root
 *   ([] when the cache dir or the target did not exist).
 */
export function clearGenCache({ seed = null, root = GEN_CACHE_ROOT } = {}) {
  const removed = [];
  let revisions;
  try {
    revisions = fs.readdirSync(root);
  } catch {
    return removed; // no cache dir yet — nothing to clear
  }
  for (const rev of revisions) {
    const target = seed === null ? path.join(root, rev) : path.join(root, rev, String(seed));
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(path.relative(root, target));
  }
  return removed;
}
