// Determinism + golden migration of the former node:test bench suite
// (mapgen/test/bench.test.mjs → vitest). Determinism L0 of the mapcap
// testing ladder (mapcap/README.md §Testing ladder).

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { describe, test, expect } from "vitest";
import { readPng } from "../../mapgen/lib/images.mjs";
import { loadWang } from "../../mapgen/lib/wang-wasm.mjs";
import { buildTileset, seqAttempt } from "../../mapgen/lib/wang-js.mjs";
import { spawnMinesEntry, loadGolden } from "../helpers/golden.mjs";
import { dataDir, hasNoitaData, CAPTURE_SEED } from "../helpers/data.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";

const entry = () => spawnMinesEntry(loadBiomeConfig(dataDir));
const atlasOf = (entry) =>
  fs.readFileSync(path.join(dataDir, entry.biome.templateFile.replace(/^data\//, "")));

const wasmHash = async (seed, entry, atlas) => {
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

describe.skipIf(!hasNoitaData())("determinism L0 (mapcap ladder)", () => {
  // same seed must produce byte-identical wang output; run from
  // mapcap/README's L0 determinism gate.
  test("wang generation is deterministic for a seed (wasm legacy model)", async () => {
    const e = entry();
    const atlas = atlasOf(e);
    const [a, b] = await Promise.all([wasmHash(CAPTURE_SEED, e, atlas), wasmHash(CAPTURE_SEED, e, atlas)]);
    expect(a).toBe(b);
  });

  test("different seeds produce different wang output (wasm legacy model)", async () => {
    const e = entry();
    const atlas = atlasOf(e);
    expect(await wasmHash(CAPTURE_SEED, e, atlas)).not.toBe(await wasmHash(CAPTURE_SEED + 1, e, atlas));
  });
});

describe.skipIf(!hasNoitaData() || !loadGolden())("golden snapshots (update-golden.mjs baselines)", () => {
  const golden = loadGolden();
  test("golden: legacy wasm (obsolete noitool model) output is stable", async () => {
    const e = entry();
    const atlas = atlasOf(e);
    const wang = await loadWang();
    const res = wang.generateArea({
      seed: golden.seed,
      color: e.color,
      area: e.area,
      atlasPngBytes: atlas,
      isCoalMine: e.biome.isCoalMine,
      shouldBlockOutRooms: e.biome.shouldBlockOutRooms,
      randomMaterials: e.biome.randomMaterials,
    });
    const hash = createHash("sha256").update(res.bigMap).digest("hex");
    expect(hash).toBe(golden.wasm?.hash ?? golden.hash);
  });

  test("golden: wang-js sequential port is stable", () => {
    if (!golden.wangjs) throw new Error("golden.json predates the wang-js baseline (re-run update-golden)");
    const e = entry();
    const atlas = readPng(path.join(dataDir, e.biome.templateFile.replace(/^data\//, "")));
    const ts = buildTileset(atlas);
    expect(ts.hTiles.length).toBe(golden.wangjs.hTiles);
    expect(ts.vTiles.length).toBe(golden.wangjs.vTiles);
    const seq = seqAttempt(ts, golden.wasm.cells[0], golden.wasm.cells[1], golden.seed);
    const rgba = Buffer.alloc(seq.width * seq.height * 4);
    for (let p = 0; p < seq.width * seq.height; p++) {
      rgba[4 * p] = seq.rgb[3 * p];
      rgba[4 * p + 1] = seq.rgb[3 * p + 1];
      rgba[4 * p + 2] = seq.rgb[3 * p + 2];
      rgba[4 * p + 3] = 255;
    }
    const hash = createHash("sha256").update(rgba).digest("hex");
    // independent model — its golden is its own snapshot, NOT the wasm's.
    expect(hash).toBe(golden.wangjs.mapHash);
  });
});
