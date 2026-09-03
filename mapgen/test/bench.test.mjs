// Determinism + sanity tests for the mapgen bench (node:test, no deps).
// Golden values are captured on first run and re-checked afterwards.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { findNoitaDataDir, CAPTURE_SEED } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { loadWang } from "../lib/wang-wasm.mjs";
import { readPng } from "../lib/images.mjs";
import { buildTileset, seqAttempt } from "../lib/wang-js.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const goldenPath = path.join(here, "../../mapgen/out/golden.json");

const spawnMinesEntry = (config) => {
  // Center column of the Mines area at spawn (biome-map px 35, 15)
  const entry = biomeAt(config, 35, 15);
  assert.ok(entry, "no biome at biome-map px (35,15) — check biome map/areas");
  return entry;
};

test("wang generation is deterministic for a seed", async () => {
  const dataDir = findNoitaDataDir();
  const config = loadBiomeConfig(dataDir);
  const entry = spawnMinesEntry(config);
  const atlas = fs.readFileSync(
    path.join(dataDir, entry.biome.templateFile.replace(/^data\//, ""))
  );

  const gen = async () => {
    const wang = await loadWang();
    const res = wang.generateArea({
      seed: CAPTURE_SEED,
      color: entry.color,
      area: entry.area,
      atlasPngBytes: atlas,
      isCoalMine: entry.biome.isCoalMine,
      shouldBlockOutRooms: entry.biome.shouldBlockOutRooms,
      randomMaterials: entry.biome.randomMaterials,
    });
    return createHash("sha256").update(res.bigMap).digest("hex");
  };

  const a = await gen();
  const b = await gen();
  assert.equal(a, b, "same seed must produce byte-identical output");
});

test("different seeds produce different wang output", async () => {
  const dataDir = findNoitaDataDir();
  const config = loadBiomeConfig(dataDir);
  const entry = spawnMinesEntry(config);
  const atlas = fs.readFileSync(
    path.join(dataDir, entry.biome.templateFile.replace(/^data\//, ""))
  );

  const gen = async (seed) => {
    const wang = await loadWang();
    const res = wang.generateArea({
      seed,
      color: entry.color,
      area: entry.area,
      atlasPngBytes: atlas,
      isCoalMine: entry.biome.isCoalMine,
      shouldBlockOutRooms: entry.biome.shouldBlockOutRooms,
      randomMaterials: entry.biome.randomMaterials,
    });
    return createHash("sha256").update(res.bigMap).digest("hex");
  };

  assert.notEqual(await gen(CAPTURE_SEED), await gen(CAPTURE_SEED + 1));
});

test("golden: wasm (noitool model) output is stable", async (t) => {
  if (!fs.existsSync(goldenPath)) {
    t.skip("no golden snapshot yet (run mapgen/update-golden.mjs --force)");
    return;
  }
  const golden = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));
  const dataDir = findNoitaDataDir();
  const config = loadBiomeConfig(dataDir);
  const entry = spawnMinesEntry(config);
  const atlas = fs.readFileSync(
    path.join(dataDir, entry.biome.templateFile.replace(/^data\//, ""))
  );
  const wang = await loadWang();
  const res = wang.generateArea({
    seed: golden.seed,
    color: entry.color,
    area: entry.area,
    atlasPngBytes: atlas,
    isCoalMine: entry.biome.isCoalMine,
    shouldBlockOutRooms: entry.biome.shouldBlockOutRooms,
    randomMaterials: entry.biome.randomMaterials,
  });
  const hash = createHash("sha256").update(res.bigMap).digest("hex");
  const expected = golden.wasm?.hash ?? golden.hash; // legacy flat format
  assert.equal(hash, expected, "wasm wang output drifted from golden snapshot");
});

test("golden: wang-js sequential port is stable", async (t) => {
  if (!fs.existsSync(goldenPath)) {
    t.skip("no golden snapshot yet (run mapgen/update-golden.mjs --force)");
    return;
  }
  const golden = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));
  if (!golden.wangjs) {
    t.skip("golden.json predates the wang-js baseline (re-run update-golden)");
    return;
  }
  const dataDir = findNoitaDataDir();
  const config = loadBiomeConfig(dataDir);
  const entry = spawnMinesEntry(config);
  const atlas = readPng(
    path.join(dataDir, entry.biome.templateFile.replace(/^data\//, ""))
  );
  const ts = buildTileset(atlas);
  assert.equal(
    ts.hTiles.length,
    golden.wangjs.hTiles,
    "h-tile parse count drifted (template walk changed?)"
  );
  assert.equal(
    ts.vTiles.length,
    golden.wangjs.vTiles,
    "v-tile parse count drifted (template walk changed?)"
  );
  const seq = seqAttempt(ts, golden.wasm.cells[0], golden.wasm.cells[1], golden.seed);
  const rgba = Buffer.alloc(seq.width * seq.height * 4);
  for (let p = 0; p < seq.width * seq.height; p++) {
    rgba[4 * p] = seq.rgb[3 * p];
    rgba[4 * p + 1] = seq.rgb[3 * p + 1];
    rgba[4 * p + 2] = seq.rgb[3 * p + 2];
    rgba[4 * p + 3] = 255;
  }
  const hash = createHash("sha256").update(rgba).digest("hex");
  // NOTE: the JS port is an independent model (no hasPath rejection loop, no
  // MapGen post-processing) — its golden is its own snapshot, NOT the wasm's.
  assert.equal(hash, golden.wangjs.mapHash, "wang-js output drifted from golden snapshot");
});
