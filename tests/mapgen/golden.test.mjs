// Determinism L0 of the mapcap testing ladder (mapcap/README.md §Testing
// ladder) + the wang-js golden snapshot (mapgen/update-golden.mjs).

import path from "node:path";
import { createHash } from "node:crypto";

import { describe, test, expect } from "vitest";
import { readPng } from "../../mapgen/lib/images.mjs";
import { buildTileset, seqAttempt } from "../../mapgen/lib/wang-js.mjs";
import { spawnMinesEntry, loadGolden } from "../helpers/golden.mjs";
import { dataDir, hasNoitaData, CAPTURE_SEED } from "../helpers/data.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";

const entry = () => spawnMinesEntry(loadBiomeConfig(dataDir));

// wang-js sequential port → canonical RGBA sha256 (the golden's map hash).
const wangjsHash = (seed, entry, cells) => {
  const atlas = readPng(path.join(dataDir, entry.biome.templateFile.replace(/^data\//, "")));
  const ts = buildTileset(atlas);
  const seq = seqAttempt(ts, cells[0], cells[1], seed);
  const rgba = Buffer.alloc(seq.width * seq.height * 4);
  for (let p = 0; p < seq.width * seq.height; p++) {
    rgba[4 * p] = seq.rgb[3 * p];
    rgba[4 * p + 1] = seq.rgb[3 * p + 1];
    rgba[4 * p + 2] = seq.rgb[3 * p + 2];
    rgba[4 * p + 3] = 255;
  }
  return { ts, hash: createHash("sha256").update(rgba).digest("hex") };
};

// The spawn Mines area (5×2 chunks) in wang cells: 512 px / 10 px per cell.
const areaCells = (area) => [Math.ceil((area.x2 - area.x1 + 1) * 51.2), Math.ceil((area.y2 - area.y1 + 1) * 51.2)];

describe.skipIf(!hasNoitaData())("determinism L0 (mapcap ladder)", () => {
  test("wang generation is deterministic for a seed (wang-js)", () => {
    const e = entry();
    const cells = areaCells(e.area);
    expect(wangjsHash(CAPTURE_SEED, e, cells).hash).toBe(wangjsHash(CAPTURE_SEED, e, cells).hash);
  });

  test("different seeds produce different wang output (wang-js)", () => {
    const e = entry();
    const cells = areaCells(e.area);
    expect(wangjsHash(CAPTURE_SEED, e, cells).hash).not.toBe(wangjsHash(CAPTURE_SEED + 1, e, cells).hash);
  });
});

describe.skipIf(!hasNoitaData() || !loadGolden())("golden snapshots (update-golden.mjs baselines)", () => {
  const golden = loadGolden();
  test("golden: wang-js sequential port is stable", () => {
    if (!golden.wangjs) throw new Error("golden.json predates the wang-js baseline (re-run update-golden)");
    const e = entry();
    const cells = golden.cells ?? golden.wasm.cells;
    expect(areaCells(e.area)).toEqual(cells);
    const { ts, hash } = wangjsHash(golden.seed, e, cells);
    expect(ts.hTiles.length).toBe(golden.wangjs.hTiles);
    expect(ts.vTiles.length).toBe(golden.wangjs.vTiles);
    expect(hash).toBe(golden.wangjs.mapHash);
  });
});
