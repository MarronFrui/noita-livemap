// tests/mapgen/surface-compositor.test.mjs — dig #130's the art-first
// surface-band compositor (count tests; the E1-class pins):
//   (1) the caves-band chunk carries the classify outputs (matNames + matIdx);
//   (2) the chunk mixes classified cell materials AND air cells (the both-
//       sides pin the flat-shade-only era never had);
//   (3) the wang_color resolver maps the classify names to RGB.
// Data-dependent: skips without the game data. The lane flags are
// module-load consts — set the env BEFORE the dynamic imports.
import fs from "node:fs";
import { expect, test } from "vitest";

process.env.SURFACE_V3 = "1";

const DATA_DIR = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const hasData = fs.existsSync(DATA_DIR + "/scripts");

test("the read-window law (dig #131): the sky band reads NOTHING (air); the mines band keeps the field", async () => {
  const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
  const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
  const cfg = loadBiomeConfig(DATA_DIR);
  // ty 49/55/60 = the hills-biome SKY rows (world rows < 0): the getter
  // bounds-check ⇒ air. FAILS under the old mod-wrap (which painted the
  // field's mass rows into the sky).
  for (const ty of [49, 55, 60]) {
    const r = noiseChunkMask(cfg, 41, ty, 78633191);
    expect(r).not.toBeNull();
    expect([...r.mask].filter((v) => v).length).toBe(0);
    expect([...r.matIdx].filter((v) => v !== 255).length).toBe(0);
  }
  // ty 62 = the mines band's first chunk (world rows ≥ 0): unchanged
  const r62 = noiseChunkMask(cfg, 41, 62, 78633191);
  expect([...r62.mask].filter((v) => v).length).toBe(2409);
  expect([...r62.matIdx].filter((v) => v !== 255).length).toBe(2409);
});

test("the surface band material-classify compositor (dig #130)", async () => {
  const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
  const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
  const { materialColorByName } = await import("../../mapgen/lib/colorize.mjs");

  const dataDir = DATA_DIR;
  const cfg = loadBiomeConfig(dataDir);
  // hills-band underground chunk (bty14 = ty 62; the C97 hills-band tile)
  const r = noiseChunkMask(cfg, 41, 62, 78633191);
  expect(r).not.toBeNull();
  expect(r.def.filename).toContain("hills.xml");
  // the hills <Materials name="forest"> block: 6 components in order
  expect(r.matNames).toEqual([
    "coal", "soil", "sand_static", "coal", "copper", "rock_static",
  ]);
  const classified = [...r.matIdx].filter((v) => v !== 255).length;
  const airCells = [...r.mask].filter((v) => v === 0).length;
  // the band carries BOTH sides: classified materials exist (≠ flat slab),
  // and air cells exist (≠ the full-solid wall) — the count flips only if
  // the compositor regresses to either monotone state.
  expect(classified).toBeGreaterThan(1000);
  expect(airCells).toBeGreaterThan(100);
  expect(classified + airCells).toBeLessThanOrEqual(52 * 52);

  // the crust's classified names classify to real wang_color RGBs
  for (const name of r.matNames) {
    const rgb = materialColorByName(dataDir, name);
    expect(rgb).not.toBeNull();
    expect(rgb).toHaveLength(3);
  }
  expect(materialColorByName(dataDir, "soil")).not.toBe(null);
});
