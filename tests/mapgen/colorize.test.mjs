// colorize.mjs contracts + issue-regression I8 (mapgen/ISSUES.md).

import { describe, test, expect } from "vitest";
import {
  loadMaterials, loadBiomeExtras, pick, colorizeArea, SHADES, MATERIAL_SHADE, materialColorAt, materialColorByName, materialRenderClass,
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

// dig #213 (C185, the cell colour law — cellfactory.cpp 0x7409B0/0x740580):
// colour = the material's <Graphics texture_file> at the WORLD pixel,
// positive-modulo wrapped; no texture ⇒ the <Graphics color> (back-filled
// from wang_color by 0x7364f0), alpha composited over black.
describe.skipIf(!hasNoitaData())("the cell colour law (dig #213, C185)", () => {
  const tex = (rel) => readPng(path.join(dataDir, rel));
  const px = (t, x, y) => { const q = 4 * (y * t.width + x); return [t.data[q], t.data[q + 1], t.data[q + 2]]; };
  test("rock_static samples rock.png at the world pixel (old law: the raw wang_color (53,57,35))", () => {
    const t = tex("materials_gfx/rock.png");
    expect(materialColorAt(dataDir, "rock_static", 0, 0)).toEqual(px(t, 0, 0));
    expect(materialColorAt(dataDir, "rock_static", 5, 7)).toEqual(px(t, 5, 7));
    expect(materialColorAt(dataDir, "rock_static", 0, 0)).not.toEqual([53, 57, 35]);
  });
  test("the wrap is a POSITIVE modulo (world x = −1 → column W−1; a truncating % would read column −1)", () => {
    const t = tex("materials_gfx/earth.png");
    expect(materialColorAt(dataDir, "sand_static", -1, -1)).toEqual(px(t, t.width - 1, t.height - 1));
    expect(materialColorAt(dataDir, "sand_static", t.width * 3 + 2, -t.height * 2 + 1)).toEqual(px(t, 2, 1));
  });
  test("every sand_static sample over one texture period lies in earth.png's palette, never the wang_color (82,79,45)", () => {
    const t = tex("materials_gfx/earth.png");
    const pal = new Set(); for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) pal.add(px(t, x, y).join(","));
    for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) {
      const c = materialColorAt(dataDir, "sand_static", x + 17920, y + 300).join(",");
      expect(pal.has(c)).toBe(true);
      expect(c).not.toBe("82,79,45");
    }
  });
  test("no texture ⇒ the <Graphics color> with its alpha over black: water = (35,61,56) = the capture's flat water (wang_color would give (27,48,43))", () => {
    expect(materialColorAt(dataDir, "water", 123, 456)).toEqual([35, 61, 56]);
  });
  test("no <Graphics> at all ⇒ the wang_color back-fill (0x7364f0: [cd+0x64] = [cd+0x40]): lava = ff6000", () => {
    expect(materialColorAt(dataDir, "lava", 0, 0)).toEqual([255, 96, 0]);
  });
});

// the sky-band fix (2026-11-08): the placeholder material laws
describe.skipIf(!hasNoitaData())("placeholder material — the y gate, the static-tile path, the shared-texture rule", () => {
  const white = () => Buffer.from([255, 255, 255, 255, 255, 255]); // a 2×1 all-placeholder map
  test("clouds at their altitude: cloud_lighter is y-gated out ⇒ the placeholder = cloud (48,48,52); without the world origin the old generic mix stays", () => {
    const m = white();
    colorizeArea(m, 2, 1, { dataDir, biomeName: "clouds", biomeFile: "clouds", seed: 1, worldX0: -15872, worldY0: -6656 });
    expect([m[0], m[1], m[2]]).toEqual([48, 48, 52]);
    const old = white();
    colorizeArea(old, 2, 1, { dataDir, biomeName: "clouds", biomeFile: "clouds", seed: 1 });
    expect([old[0], old[1], old[2]]).not.toEqual([48, 48, 52]);
  });

  test("a static tile's biome XML resolves under data/biome_impl (its materials were never read)", () => {
    const e = loadBiomeExtras(dataDir, "data/biome_impl/static_tile/biome_potion_mimics");
    expect((e.materials ?? []).map((c) => c.name).sort()).toEqual(["templeslab_crumbling_static", "templeslab_static"]);
  });

  test("two active materials sharing one texture (templeslab.png) ⇒ the C185 texture colour", () => {
    const m = white();
    colorizeArea(m, 2, 1, { dataDir, biomeName: "x", biomeFile: "data/biome_impl/static_tile/biome_potion_mimics", seed: 1, worldX0: 0, worldY0: 0 });
    expect([m[0], m[1], m[2]]).toEqual(materialColorAt(dataDir, "templeslab_static", 0, 0));
  });
});

// dig #224 (I51(c)): with the world origin known, a SOLID material cell of the
// bin lane takes C185 at its world px; the hand families stay for the GAS and
// FLOWING-LIQUID materials that have one (their render laws unread, A23) and
// for the no-origin path.
describe.skipIf(!hasNoitaData())("C185 in the bin lane (dig #224)", () => {
  const cellsOf = (name, n = 4) => {
    const [r, g, b] = materialColorByName(dataDir, name);
    const m = Buffer.alloc(3 * n * n);
    for (let i = 0; i < n * n; i++) { m[3 * i] = r; m[3 * i + 1] = g; m[3 * i + 2] = b; }
    return m;
  };
  const run = (name, x0, y0) => {
    const m = cellsOf(name);
    colorizeArea(m, 4, 4, { dataDir, biomeName: "coalmine", biomeFile: "coalmine", seed: 1, worldX0: x0, worldY0: y0 });
    return m;
  };
  test("flowing-liquid water keeps its capture-calibrated family (the coalmine wang water ≠ C185's flat (35,61,56), A23)", () => {
    const m = run("water", -5, -13);
    const fam = new Set(SHADES.water.map((s) => s.rgb.join()));
    for (let i = 0; i < 16; i++) expect(fam.has([m[3 * i], m[3 * i + 1], m[3 * i + 2]].join())).toBe(true);
  });
  test("the render class: water/oil/lava = flow, cloud = gas, gold/coal/steel_static/rock_static_wet = solid (_parent inherited)", () => {
    for (const n of ["water", "oil", "lava"]) expect(materialRenderClass(dataDir, n)).toBe("flow");
    expect(materialRenderClass(dataDir, "cloud")).toBe("gas");
    for (const n of ["gold", "coal", "steel_static", "rock_static_wet"]) expect(materialRenderClass(dataDir, n)).toBe("solid");
  });
  test("a family-less flowing liquid keeps C185 (lava = (255,96,0))", () => {
    const m = run("lava", 0, 0);
    expect([m[0], m[1], m[2]]).toEqual(materialColorAt(dataDir, "lava", 0, 0));
  });
  test("gold cells = gold's texture at each cell's world px (x0 + 10·i, y0 + 10·j)", () => {
    const m = run("gold", 1235, 777);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const q = 3 * (j * 4 + i);
      expect([m[q], m[q + 1], m[q + 2]]).toEqual(materialColorAt(dataDir, "gold", 1235 + 10 * i, 777 + 10 * j));
    }
  });
  test("cloud keeps the capture-calibrated gas shade (48,48,52), not C185 (87,87,95)", () => {
    const m = run("cloud", 0, -5000);
    expect([m[0], m[1], m[2]]).toEqual([48, 48, 52]);
  });
});
