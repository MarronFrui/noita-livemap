// Golden-snapshot + biome fixture helpers.

import fs from "node:fs";
import path from "node:path";
import { biomeAt } from "../../mapgen/lib/biomes.mjs";
import { repoRoot } from "../../mapgen/lib/paths.mjs";

export const GOLDEN_PATH = path.join(repoRoot, "mapgen/out/golden.json");

export function loadGolden() {
  try {
    return JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf-8"));
  } catch {
    return null;
  }
}

// The center column of the Mines area at spawn (biome-map px 35, 15) —
// the canonical spawn coalmine area used by golden/oracle tests.
export function spawnMinesEntry(config) {
  const entry = biomeAt(config, 35, 15);
  if (!entry) throw new Error("no biome at biome-map px (35,15) — check biome map/areas");
  return entry;
}

export function biomeByName(config, name) {
  for (const def of config.biomes.values()) {
    if (def.name === name) return def;
  }
  return null;
}
