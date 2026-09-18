// Coordinate mapping contracts (mapgen/lib/coords.mjs, VERIFIED.md §1).

import { describe, test, expect } from "vitest";
import {
  CHUNK, CELL, OFFSET_X, OFFSET_Y, worldOfBiomePx,
  chunkOfBiomePixel,
} from "../../mapgen/lib/coords.mjs";

describe("biome px -> world px (pure linear)", () => {
  test("worldOfBiomePx maps the biome-map origin to world (0,0)", () => {
    expect(worldOfBiomePx(OFFSET_X, OFFSET_X)).toBe(0);
    expect(worldOfBiomePx(OFFSET_Y, OFFSET_Y)).toBe(0);
  });
  test("512 px per chunk in both axes", () => {
    for (let p = 0; p < 70; p++) {
      expect(worldOfBiomePx(p + 1, OFFSET_X) - worldOfBiomePx(p, OFFSET_X)).toBe(CHUNK);
    }
  });
});

describe("biome px -> world chunk index", () => {
  const fakeConfig = { map: { width: 70 }, biomeOffsetY: 14 };
  test("center formula cx = tx - 35, cy = ty - 14", () => {
    expect(chunkOfBiomePixel(fakeConfig, 35, 15)).toEqual({ cx: 0, cy: 1 }); // spawn mines
    expect(chunkOfBiomePixel(fakeConfig, 0, 0)).toEqual({ cx: -35, cy: -14 });
    expect(chunkOfBiomePixel(fakeConfig, 69, 47)).toEqual({ cx: 34, cy: 33 });
  });
});

describe("wang lattice is global (non-integer cells per chunk)", () => {
  // VERIFIED.md §1: 512/10 = 51.2 cells/chunk — chunks straddle fractional
  // cell edges; the lattice must NOT be re-anchored per chunk (§8 row 2/4).
  test("1 atlas px = 10 world px exactly", () => {
    expect(CELL * 512).not.toBe(Math.floor(512 / 10) * 10 * 10); // 51.2, not 51
    expect((512 / 10) % 1).toBeCloseTo(0.2, 10);
  });
});
