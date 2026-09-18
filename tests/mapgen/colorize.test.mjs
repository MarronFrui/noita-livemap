// colorize.mjs contracts + issue-regression I8 (mapgen/ISSUES.md).

import { describe, test, expect } from "vitest";
import {
  loadMaterials, loadBiomeExtras, pick, colorizeArea, SHADES, MATERIAL_SHADE,
} from "../../mapgen/lib/colorize.mjs";
import { generateAreaExact } from "../../mapgen/lib/generate-exact.mjs";
import { buildTileset } from "../../mapgen/lib/wang-js.mjs";
import { readPng } from "../../mapgen/lib/images.mjs";
import { loadWangWorld } from "../../mapgen/lib/world-gen.mjs";
import { CAPTURE_SEED, dataDir, hasNoitaData } from "../helpers/data.mjs";
import path from "node:path";

const hexOf = (rgb) =>
  rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

describe("materials parser (materials.xml wang_color table)", () => {
  test.skipIf(!hasNoitaData())("loads a large RGB -> name map", () => {
    const mats = loadMaterials(dataDir);
    expect(mats.size).toBeGreaterThan(400);
    for (const [hex, name] of mats) {
      expect(hex).toMatch(/^[0-9a-f]{6}$/);
      expect(name).toBeTypeOf("string");
      break;
    }
  });
});

describe("loadBiomeExtras", () => {
  test.skipIf(!hasNoitaData())("lake_deep main material is water (I8 fact)", () => {
    const extras = loadBiomeExtras(dataDir, "lake_deep");
    expect(extras.mainMaterial).toBe("water");
    expect(extras.materials).toHaveLength(1);
  });

  test.skipIf(!hasNoitaData())("missing biome XML yields empty-not-crash", () => {
    const extras = loadBiomeExtras(dataDir, "no_such_biome_xyz");
    expect(extras.randomColors).toEqual([]);
    expect(extras.mainMaterial).toBeNull();
  });
});

describe("pick() — deterministic weighted choice", () => {
  const list = [
    { rgb: [1, 1, 1], w: 6 },
    { rgb: [2, 2, 2], w: 2 },
  ];
  test("is stable for a given (x, y, salt)", () => {
    expect(pick(list, 10, 4, 7)).toEqual(pick(list, 10, 4, 7));
  });
  test("respects weights statistically (~75/25 for 6:2)", () => {
    let first = 0;
    for (let i = 0; i < 2000; i++) if (pick(list, i, i + 1, 3)[0] === 1) first++;
    const frac = first / 2000;
    expect(frac).toBeGreaterThan(0.68);
    expect(frac).toBeLessThan(0.82);
  });
  test("falls back to the first entry on degenerate weights", () => {
    expect(pick([{ rgb: [5, 5, 5], w: 0 }], 0, 0, 0)).toEqual([5, 5, 5]);
  });
});

describe("colorizeArea — I8 regression (west deep lake must render water)", () => {
  test.skipIf(!hasNoitaData())("lake_deep area is majority water shades, not generic dirt", () => {
    const world = loadWangWorld(dataDir);
    const lake = world.areas.find((a) => a.def.filename.includes("lake_deep"));
    expect(lake).toBeTruthy();

    const atlas = readPng(path.join(dataDir, lake.def.templateFile.replace(/^data\//, "")));
    const ts = buildTileset(atlas);
    const r = generateAreaExact(ts, lake.w, lake.h, CAPTURE_SEED, {
      worldX: lake.worldX, worldY: lake.worldY,
    });
    expect(r).toBeTruthy(); // an attempt accepted
    const { unknown } = colorizeArea(r.rgb, lake.w, lake.h, {
      dataDir, biomeName: lake.def.name, biomeFile: "lake_deep", seed: CAPTURE_SEED,
    });
    expect(unknown).toBeGreaterThanOrEqual(0);

    const waterShades = new Set(SHADES.water.map((s) => hexOf(s.rgb)));
    let waterPx = 0;
    for (let i = 0; i < lake.w * lake.h; i++) {
      const p = [r.rgb[3 * i], r.rgb[3 * i + 1], r.rgb[3 * i + 2]];
      if (waterShades.has(hexOf(p))) waterPx++;
    }
    expect(waterPx).toBeGreaterThan(0.5 * lake.w * lake.h);
  });
});

describe("colorizeArea — behavioral contract", () => {
  test.skipIf(!hasNoitaData())("seed-seeded grey-ramp noise is reproducible per seed and differs across seeds", () => {
    const makeMap = () => {
      const m = Buffer.alloc(3 * 40 * 40);
      for (let i = 0; i < 40 * 40; i++) { m[3 * i] = 200; m[3 * i + 1] = 200; m[3 * i + 2] = 200; }
      return m;
    };
    const a = makeMap();
    const b = makeMap();
    const c = makeMap();
    colorizeArea(a, 40, 40, { dataDir, biomeName: "coalmine", biomeFile: "coalmine", seed: CAPTURE_SEED });
    colorizeArea(b, 40, 40, { dataDir, biomeName: "coalmine", biomeFile: "coalmine", seed: CAPTURE_SEED });
    colorizeArea(c, 40, 40, { dataDir, biomeName: "coalmine", biomeFile: "coalmine", seed: CAPTURE_SEED + 1 });
    expect(Buffer.compare(a, b)).toBe(0);
    expect(Buffer.compare(a, c)).not.toBe(0);
  });

  test.skipIf(!hasNoitaData())("unknown raw colors are left in place and counted", () => {
    const m = Buffer.alloc(3 * 4, 0);
    m[0] = 0x12; m[1] = 0x34; m[2] = 0x56; // not a material, not a trigger
    m[3] = 200; m[4] = 200; m[5] = 200;
    m[6] = 200; m[7] = 200; m[8] = 200;
    m[9] = 200; m[10] = 200; m[11] = 200;
    const { unknown } = colorizeArea(m, 2, 2, { dataDir, biomeName: "coalmine", biomeFile: "coalmine", seed: 1 });
    expect(unknown).toBe(1);
    expect([...m.slice(0, 3)]).toEqual([0x12, 0x34, 0x56]);
  });
});
