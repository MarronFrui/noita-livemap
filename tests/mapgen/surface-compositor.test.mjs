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

  test("the per-area background law (dig #132): the def carries the Topology backgroundImage and the loader tiles it", async () => {
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
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
