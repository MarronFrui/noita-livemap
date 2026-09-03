// Validate our wasm wrapper against noita-tools' own test fixtures.
// The fixtures hold their expected raw map buffer (1 RGBA color per 10px cell)
// for (seed, biome-map px) pairs. If we reproduce them byte-for-byte, our
// pipeline is faithful to noitool and any capture mismatch is algorithm-level.
//
// Usage: node mapgen/verify.mjs

import fs from "node:fs";
import path from "node:path";
import { repoRoot, findNoitaDataDir, CAPTURE_SEED } from "./paths.mjs";
import { loadBiomeConfig, biomeAt } from "./biomes.mjs";
import { loadWang } from "./wang.mjs";
import { readPng } from "./pngio.mjs";

// paramMap from vendor/noita-tools .../Map/index.spec.ts
const PARAM_MAP = {
  "clouds.png": { x: 53, y: 3 },
  "coalmine.png": { x: 53, y: 31 },
  "coalmine_alt.png": { x: 32, y: 15 },
  "crypt.png": { x: 26, y: 36 },
  "excavationsite.png": { x: 53, y: 30 },
  "fungicave.png": { x: 34, y: 28 },
  "fungiforest.png": { x: 59, y: 36 },
  "liquidcave.png": { x: 28, y: 14 },
  "pyramid.png": { x: 52, y: 12 },
  "rainforest_dark.png": { x: 25, y: 26 },
  "rainforest_open.png": { x: 30, y: 28 },
  "rainforest.png": { x: 30, y: 27 },
  "robobase.png": { x: 2, y: 47 },
  "sandcave.png": { x: 2, y: 47 },
  "snowcastle.png": { x: 53, y: 28 },
  "snowcave.png": { x: 30, y: 20 },
  "snowchasm.png": { x: 20, y: 16 },
  "the_end.png": { x: 32, y: 44 },
  "the_sky.png": { x: 27, y: 0 },
  "vault_frozen.png": { x: 12, y: 15 },
  "vault.png": { x: 32, y: 31 },
  "wand.png": { x: 53, y: 39 },
  "wizardcave.png": { x: 53, y: 40 },
};

const fixturesDir = path.join(
  repoRoot,
  "vendor/noita-tools/src/services/SeedInfo/infoHandler/InfoProviders/Map/fixtures"
);

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const wang = await loadWang();

const atlasCache = new Map();
const getAtlas = (templateFile) => {
  if (!atlasCache.has(templateFile)) {
    atlasCache.set(
      templateFile,
      fs.readFileSync(path.join(dataDir, templateFile.replace(/^data\//, "")))
    );
  }
  return atlasCache.get(templateFile);
};

let pass = 0;
let fail = 0;

for (const seedDir of fs.readdirSync(fixturesDir)) {
  const seed = Number(seedDir);
  for (const biomeFile of fs.readdirSync(path.join(fixturesDir, seedDir))) {
    const params = PARAM_MAP[biomeFile];
    if (!params) {
      console.log(`SKIP ${seedDir}/${biomeFile} (no paramMap entry)`);
      continue;
    }
    const expected = readPng(path.join(fixturesDir, seedDir, biomeFile));

    const entry = biomeAt(config, params.x, params.y);
    if (!entry) {
      console.log(`FAIL ${seedDir}/${biomeFile}: no biome/area at (${params.x},${params.y})`);
      fail++;
      continue;
    }

    const res = wang.generateArea({
      seed,
      color: entry.color,
      area: entry.area,
      atlasPngBytes: getAtlas(entry.biome.templateFile),
      isCoalMine: entry.biome.isCoalMine,
      shouldBlockOutRooms: entry.biome.shouldBlockOutRooms,
      randomMaterials: entry.biome.randomMaterials,
    });

    const dimsOk =
      res.map.length === expected.width * expected.height * 4 &&
      res.w === expected.width &&
      res.h === expected.height;

    // Compare RGB only: fixture alpha may differ due to their canvas PNG encoding.
    let diffPx = 0;
    if (dimsOk) {
      for (let p = 0; p < res.map.length / 4; p++) {
        if (
          res.map[4 * p] !== expected.data[4 * p] ||
          res.map[4 * p + 1] !== expected.data[4 * p + 1] ||
          res.map[4 * p + 2] !== expected.data[4 * p + 2]
        ) {
          diffPx++;
        }
      }
    }

    const label = `${seedDir}/${biomeFile} [${entry.biome.name} @${entry.area.x1},${entry.area.y1}]`;
    if (dimsOk && diffPx === 0) {
      console.log(`PASS ${label}`);
      pass++;
    } else {
      console.log(
        `FAIL ${label} dims ${res.w}x${res.h} vs ${expected.width}x${expected.height}, diff px: ${diffPx}`
      );
      fail++;
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail > 0 ? 1 : 0;
