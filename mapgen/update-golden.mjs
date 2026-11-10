// Deliberately re-bless mapgen/out/golden.json — the regression baseline for
// our wang-js port. Baselines pin behavior; they are not game references.
//
// Run this only when you intend to change golden-covered output, then commit
// the reasoning to ABOUT_MATH.md §6. Without --force it refuses to overwrite.
//
// Usage:
//   node mapgen/update-golden.mjs            // refuses if golden.json exists
//   node mapgen/update-golden.mjs --force    // overwrites

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { repoRoot, findNoitaDataDir, CAPTURE_SEED } from "./lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "./lib/biomes.mjs";
import { readPng } from "./lib/images.mjs";
import { buildTileset, seqAttempt } from "./lib/wang-js.mjs";

const force = process.argv.includes("--force");
const goldenPath = path.join(repoRoot, "mapgen/out/golden.json");

if (fs.existsSync(goldenPath) && !force) {
  console.error(`refusing to overwrite ${goldenPath}`);
  console.error(`if you INTEND to re-bless the golden baseline, run:`);
  console.error(`  node mapgen/update-golden.mjs --force`);
  process.exit(1);
}

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const entry = biomeAt(config, 35, 15); // spawn Mines chunk
if (!entry) throw new Error("no biome at biome-map px (35,15)");

const atlasPath = path.join(dataDir, entry.biome.templateFile.replace(/^data\//, ""));

console.log(`golden target: ${entry.biome.name} area [${entry.area.x1},${entry.area.y1}..${entry.area.x2},${entry.area.y2}], seed ${CAPTURE_SEED}`);

// the area in wang cells: 512 px per chunk / 10 px per cell
const cells = [Math.ceil((entry.area.x2 - entry.area.x1 + 1) * 51.2), Math.ceil((entry.area.y2 - entry.area.y1 + 1) * 51.2)];

// our JS port (sequential attempt) — canonical RGBA map hash + parse counts
const ts = buildTileset(readPng(atlasPath));
const seq = seqAttempt(ts, cells[0], cells[1], CAPTURE_SEED);
const rgba = Buffer.alloc(seq.width * seq.height * 4);
for (let p = 0; p < seq.width * seq.height; p++) {
  rgba[4 * p] = seq.rgb[3 * p];
  rgba[4 * p + 1] = seq.rgb[3 * p + 1];
  rgba[4 * p + 2] = seq.rgb[3 * p + 2];
  rgba[4 * p + 3] = 255;
}
const jsHash = createHash("sha256").update(rgba).digest("hex");

const golden = {
  generatedAt: new Date().toISOString(),
  seed: CAPTURE_SEED,
  biome: entry.biome.name,
  area: entry.area,
  cells,
  wangjs: { mapHash: jsHash, hTiles: ts.hTiles.length, vTiles: ts.vTiles.length },
};

fs.mkdirSync(path.dirname(goldenPath), { recursive: true });
fs.writeFileSync(goldenPath, JSON.stringify(golden, null, 2));

console.log(`wangjs map   sha256: ${jsHash}  (${ts.hTiles.length}h+${ts.vTiles.length}v tiles)`);
console.log(`wrote ${goldenPath}`);
