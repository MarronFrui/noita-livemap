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

test("golden: spawn Mines area hash is stable", async (t) => {
  if (!fs.existsSync(goldenPath)) {
    t.skip("no golden snapshot yet (run bench first)");
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
  assert.equal(hash, golden.hash, "wang output drifted from golden snapshot");
});
