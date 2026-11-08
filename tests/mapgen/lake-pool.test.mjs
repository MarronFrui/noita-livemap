// tests/mapgen/lake-pool.test.mjs — the west lake = a flat water pool (E1).
// The lake.xml chunks under the surface (biome row 15, canvas ty 63) are
// water on EVERY cell: the lake family's topology body takes surfaceField's
// early-zero arm (field0 ≤ 0 ⇒ v = 0 ⇒ the water window [−1, 0.5) with
// limit_y [225, 512000]); the capture (seed 78633191, tx 4..10 × rows 14–15)
// shows pure water there.
//
// COUNT-TEST NOTE: under the old field0 ≡ 1.0 law the mode-3 slope ramp
// (Δ −0.37 from x = −12000) pushed v past 0.5 along a diagonal ⇒ mud /
// sand_static / unmatched-air cells in these chunks (the "dirt band") — the
// all-water pins below fail under it.
//
// Auto-skips without extracted game data; RUNS in this repo's gates.

import { describe, test, expect } from "vitest";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

describe.skipIf(!hasNoitaData())("west lake — lake.xml = a flat water pool (E1)", () => {
  test.each([[5, 63], [9, 63], [10, 63], [10, 62]])("chunk (%i,%i): every cell at wy ≥ 225 is water, none above", async (tx, ty) => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(dataDir);
    const r = noiseChunkMask(cfg, tx, ty, 78633191);
    expect(r).not.toBeNull();
    expect(r.def.filename).toBe("data/biome/lake.xml");
    let water = 0, other = 0, expectWater = 0;
    for (let cy = 0; cy < 52; cy++) {
      const wy = (ty - 62) * 512 + cy * 10 + 5;
      for (let cx = 0; cx < 52; cx++) {
        const mi = r.matIdx[52 * cy + cx];
        if (wy >= 225) expectWater++;
        if (mi !== 255 && r.matNames[mi] === "water") water++;
        else if (mi !== 255) other++;
      }
    }
    expect(other).toBe(0);
    expect(water).toBe(expectWater);
  });
});
