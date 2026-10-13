// tests/mapgen/surface-compositor.test.mjs — the art-first surface-band
// compositor count tests (the E1-class pins):
//   #130 — the per-cell material classify (matNames + matIdx + wang_color);
//   #131 — the read-window law (sky band all-air; the mines chunk stable);
//   #132 — the per-area background law (the def carries its Topology
//          backgroundImage; the loader tiles it as the chunk backdrop).
// Data-dependent: skips without the game data. The lane flags are
// module-load consts — set the env BEFORE the dynamic imports.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

process.env.SURFACE_V3 = "1";

const DATA_DIR = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const hasData = fs.existsSync(DATA_DIR + "/scripts");

describe.skipIf(!hasData)("surface-band compositor (digs #130/#131/#132)", () => {
  test("the per-cell material classify compositor (dig #130)", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const { materialColorByName } = await import("../../mapgen/lib/colorize.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // the mines-band chunk (bty14 = ty 62; the C48/C97 hills-band tile)
    const r = noiseChunkMask(cfg, 41, 62, 78633191);
    expect(r).not.toBeNull();
    expect(r.def.filename).toContain("hills.xml");
    // the hills <Materials name="forest"> block: 6 components in order
    expect(r.matNames).toEqual([
      "coal", "soil", "sand_static", "coal", "copper", "rock_static",
    ]);
    const classified = [...r.matIdx].filter((v) => v !== 255).length;
    const airCells = [...r.mask].filter((v) => v === 0).length;
    // both sides: classified materials exist (≠ flat slab), air exists
    // (≠ the full-solid wall) — flips if the compositor regresses.
    expect(classified).toBeGreaterThan(1000);
    expect(airCells).toBeGreaterThan(100);
    expect(classified + airCells).toBeLessThanOrEqual(52 * 52);
    for (const name of r.matNames) {
      const rgb = materialColorByName(DATA_DIR, name);
      expect(rgb).not.toBeNull();
      expect(rgb).toHaveLength(3);
    }
  });

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

  test("the sky/Hell layer law (dig #133): the sky band = ONE backdrop (the parallax gradient + stars) over every air row above the datum; the mines band unchanged", async () => {
    const { ensureWorld, worldColorAt } = await import("../../mapgen/lib/world-gen.mjs");
    const world = ensureWorld(78633191, DATA_DIR, { onProgress: () => {} });
    await world.ready;
    // the high sky = the parallax png's blue top rows (105,170,200 family)
    const high = worldColorAt(world, 35 * 512 + 256, 1 * 512 + 10);
    expect(high).not.toBeNull();
    expect(high[1]).toBeGreaterThan(120); // green channel high = blue, not airDark/cave-bg
    expect(high[0]).toBeLessThan(160);
    // the stars: bright specks exist in the sky band (the hash-placed sprites)
    let stars = 0;
    for (let ty = 5; ty < 55; ty++) for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) {
      const c = worldColorAt(world, 40 * 512 + x, ty * 512 + y);
      if (c && c[0] > 200 && c[1] > 200 && c[2] > 230) stars++;
    }
    expect(stars).toBeGreaterThan(100);
    // the mines band's first chunk: the terrain unchanged (2409 classified)
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const cfg2 = (await import("../../mapgen/lib/biomes.mjs")).loadBiomeConfig(DATA_DIR);
    const r62 = noiseChunkMask(cfg2, 41, 62, 78633191);
    expect([...r62.mask].filter((v) => v).length).toBe(2409);
  });


  test("the bin-air backdrop law (dig #134): the wang bands' AIR cells composite the area biome's declared bg", async () => {
    const { ensureWorld, worldColorAt } = await import("../../mapgen/lib/world-gen.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const dataDir = DATA_DIR;
    const world = ensureWorld(78633191, dataDir, { onProgress: () => {} });
    await world.ready;
    const cfg = loadBiomeConfig(dataDir);
    // the pyramid band: the def declares background_pyramid.png; its air
    // cells (the colorize airDark family in the bins) must composite it
    const def = biomeAt(cfg, 51, 14).biome;
    expect(def.backgroundImage).toBe("data/weather_gfx/background_pyramid.png");
    let bg = 0, dark = 0;
    for (let y = 0; y < 512; y += 8) for (let x = 0; x < 512; x += 8) {
      const c = worldColorAt(world, 51 * 512 + x, 62 * 512 + y);
      if (!c) continue;
      if (c[0] < 40 && c[1] < 40 && c[2] < 45) dark++; else bg++;
    }
    expect(bg).toBeGreaterThan(200); // the bg/corridor mix, not the flat airDark wall
    void dark;
  });

  test("the wang-biome art-crust blit (dig #134): the pyramid's LoadPixelScene pieces land over the corridors", async () => {
    const { ensureWorld, worldColorAt } = await import("../../mapgen/lib/world-gen.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const world = ensureWorld(78633191, DATA_DIR, { onProgress: () => {} });
    await world.ready;
    void loadBiomeConfig;
    // the pyramid pieces (the sandstone art) = the non-airDark, non-bg
    // bright/sandy pixels INSIDE the band — count them across the band's chunks
    let art = 0;
    for (let tx = 51; tx <= 57; tx++) for (let y = 0; y < 512; y += 8) for (let x = 0; x < 512; x += 8) {
      const c = worldColorAt(world, tx * 512 + x, 62 * 512 + y);
      if (!c) continue;
      // the pyramid's sandstone art = the warm yellow/tan tones (the bg
      // = the cooler dusk tones) — the presence of BOTH = the mix
      if (c[0] > 180 && c[1] > 140 && c[2] < 140) art++;
    }
    expect(art).toBeGreaterThan(50);
  });

  test("the per-area background law (dig #132): the def carries the Topology backgroundImage and the loader tiles it", async () => {    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    const def = biomeAt(cfg, 41, 14).biome; // the hills def (bty14 = ty62)
    expect(def.backgroundImage).toBe("data/weather_gfx/background_cave_04_alt.png");
    const r = noiseChunkMask(cfg, 41, 62, 78633191);
    expect(r.backdrop).not.toBeNull();
    expect(r.backdrop.w).toBe(512);
    expect(r.backdrop.h).toBe(256);
    expect(r.backdrop.pixels.length).toBe(512 * 256 * 4);
  });
});
