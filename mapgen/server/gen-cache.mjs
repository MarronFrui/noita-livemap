// Shared generated-world cache clearing for the genmap server (HTTP
// /gen/clear endpoints) and the CLI (`npm run gen:clear`).
//
// Cache layout: mapgen/out/gen-cache/<revision>/<seed>/<areaKey>.bin — the
// <revision> (r3b, r3c, r3d, …) is bumped manually when the render pipeline
// changes (SESSION_CONTEXT updates); old revisions stay on disk until
// cleared. clearGenCache removes those trees so the next ensureWorld() call
// regenerates everything from scratch.

import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../lib/paths.mjs";

export const GEN_CACHE_ROOT = path.join(repoRoot, "mapgen/out/gen-cache");

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
