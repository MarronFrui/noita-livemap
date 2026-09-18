// Biome config contracts (mapgen/lib/biomes.mjs) — requires extracted data.

import { describe, test, expect } from "vitest";
import { loadBiomeConfig, biomeAt } from "../../mapgen/lib/biomes.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";
import { biomeByName } from "../helpers/golden.mjs";

describe.skipIf(!hasNoitaData())("biome map (game-truth parser)", () => {
  // Loaded once (VERIFIED.md §1: biome map 70x48 px, 1 px = 1 chunk).
  const config = hasNoitaData() ? loadBiomeConfig(dataDir) : null;

  test("map is exactly 70x48 chunks; 9 virtual rows per side + 1 east", () => {
    expect(config.map.width).toBe(70);
    expect(config.map.height).toBe(48);
    expect(config.V_OFF_Y).toBe(48);
    expect(config.biomeOffsetY).toBe(14);
    expect(config.vmap.width).toBe(71);
    expect(config.vmap.height).toBe(48 + 2 * 48);
  });

  test("spawn Mines chunk resolves to the coalmine area at biome px (35,15)", () => {
    const entry = biomeAt(config, 35, 15);
    expect(entry).toBeTruthy();
    expect(entry.biome.name).toBe("coalmine");
    expect(entry.area.x1).toBeLessThanOrEqual(35);
    expect(entry.area.y1).toBeLessThanOrEqual(15);
    expect(entry.area.y2).toBeGreaterThanOrEqual(15);
  });

  test("out-of-range lookups return undefined (clamped virtual bounds)", () => {
    expect(biomeAt(config, -1, 15)).toBeUndefined();
    expect(biomeAt(config, 35, -49)).toBeUndefined(); // below vmap (V_OFF_Y = 48)
    expect(biomeAt(config, 35, 96)).toBeUndefined();
    expect(biomeAt(config, 71, 15)).toBeUndefined();
  });

  test("clamping: virtual east col 70 mirrors real col 69 byte-for-byte", () => {
    for (const ty of [0, 15, 20, 47]) {
      const i69 = 4 * ((ty + config.V_OFF_Y) * config.vmap.width + 69);
      const i70 = 4 * ((ty + config.V_OFF_Y) * config.vmap.width + 70);
      expect([...config.vmap.data.slice(i70, i70 + 3)]).toEqual([...config.vmap.data.slice(i69, i69 + 3)]);
    }
  });

  test("flags: coalmine isCoalMine + shouldBlockOutRooms; excavation only blockOut", () => {
    const mine = biomeByName(config, "coalmine");
    const excav = biomeByName(config, "excavationsite");
    expect(mine?.isCoalMine).toBe(true);
    expect(mine?.shouldBlockOutRooms).toBe(true);
    expect(excav?.isCoalMine).toBe(false);
    expect(excav?.shouldBlockOutRooms).toBe(true);
  });

  test("every biome def carries the documented shape", () => {
    for (const def of config.biomes.values()) {
      expect(def.filename).toBeTypeOf("string");
      expect(def.name).toBeTypeOf("string");
      expect(typeof def.templateFile === "string" || def.templateFile == null).toBe(true);
      expect(Array.isArray(def.randomMaterials)).toBe(true);
      expect(Array.isArray(def.materialBands)).toBe(true);
      expect(Array.isArray(def.areas)).toBe(true);
      for (const a of def.areas) {
        expect(typeof a.x1).toBe("number");
        expect(typeof a.y1).toBe("number");
        expect(typeof a.x2).toBe("number");
        expect(typeof a.y2).toBe("number");
        expect(a.x1).toBeLessThanOrEqual(a.x2);
        expect(a.y1).toBeLessThanOrEqual(a.y2);
        if (def.templateFile) expect(a.y1).toBeGreaterThanOrEqual(-48); // extended areas keep biome coords
      }
    }
  });

  test("each biome color maps to exactly one definition", () => {
    for (const color of config.biomes.keys()) {
      const def = config.biomes.get(color);
      expect(def).toBeTruthy();
    }
  });
});
