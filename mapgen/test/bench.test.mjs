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
import { generateAreaExact } from "../lib/generate-exact.mjs";
import { colorizeArea, loadBiomeExtras, SHADES } from "../lib/colorize.mjs";
import { loadWangWorld, worldColorAt, SKY_ROWS, CHUNK } from "../lib/world-gen.mjs";

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

test("golden: legacy wasm (obsolete noitool model) output is stable", async (t) => {
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

// I8 (mapgen/ISSUES.md): the west deep lake (lake_deep, water.png atlas) is a
// single-material biome (lake_deep.xml: water, min -1.0 / max 10.5). The game
// fills the atlas's white placeholder art with the biome's material, so the
// genmap must render water there — not the generic grey-ramp rock/soil/sand.
test("I8: lake_deep renders water, not generic dirt", async () => {
  const dataDir = findNoitaDataDir();
  const world = loadWangWorld(dataDir);
  const lake = world.areas.find((a) => a.def.filename.includes("lake_deep"));
  assert.ok(lake, "lake_deep area missing from wang world");
  const extras = loadBiomeExtras(dataDir, "lake_deep");
  assert.equal(extras.mainMaterial, "water", "lake_deep main material should be water");

  const atlas = readPng(
    path.join(dataDir, lake.def.templateFile.replace(/^data\//, ""))
  );
  const ts = buildTileset(atlas);
  const r = generateAreaExact(ts, lake.w, lake.h, CAPTURE_SEED, {
    worldX: lake.worldX, worldY: lake.worldY,
  });
  assert.ok(r, "no attempt accepted for lake_deep");
  colorizeArea(r.rgb, lake.w, lake.h, {
    dataDir, biomeName: lake.def.name, biomeFile: "lake_deep", seed: CAPTURE_SEED,
  });

  // Count display shades over the whole area (upsampled 10x: sample per cell)
  const waterShades = new Set(
    SHADES.water.map((s) => s.rgb.map((v) => v.toString(16).padStart(2, "0")).join(""))
  );
  let waterPx = 0;
  for (let i = 0; i < lake.w * lake.h; i++) {
    const hex = [r.rgb[3 * i], r.rgb[3 * i + 1], r.rgb[3 * i + 2]]
      .map((v) => v.toString(16).padStart(2, "0")).join("");
    if (waterShades.has(hex)) waterPx++;
  }
  // The lake is essentially all water; require a solid majority.
  assert.ok(
    waterPx > 0.5 * lake.w * lake.h,
    `expected majority water shades, got ${waterPx}/${lake.w * lake.h}`
  );
});
