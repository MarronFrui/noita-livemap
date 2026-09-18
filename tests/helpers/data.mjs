// Shared test environment helpers.

import { statSync } from "node:fs";
import { join } from "node:path";
import { findNoitaDataDir, repoRoot, CAPTURE_SEED } from "../../mapgen/lib/paths.mjs";

// Resolved extracted-game-data dir (OS-specific; may not exist in CI).
let _resolved = null;
try {
  _resolved = findNoitaDataDir();
} catch {
  _resolved = null;
}

let _exists = false;
if (_resolved) {
  try {
    _exists = statSync(join(_resolved, "biome_impl/biome_map.png")).isFile();
  } catch {
    _exists = false;
  }
}

export { repoRoot, CAPTURE_SEED };
export const dataDir = _exists ? _resolved : null;
export const hasNoitaData = () => _exists;

// Skip guard for vitest: use as `test.skipIf(!hasNoitaData())`.
