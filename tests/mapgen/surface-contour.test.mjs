// tests/mapgen/surface-contour.test.mjs — the hills surface = the r = 0.51
// contour of the band ramp, and the Phase-S xBase stream goldens for the
// three current-build capture seeds.
//
// Law (surfaceField, noise-proto.mjs; bytes C77/C120/C125): while the band
// ramp r ≤ 0.51 the gradW·per lane is off (the 0.51 gate), so
// v = perlinCoef·r ≤ 0.871429·0.51 = 0.4444 — below every hills classify
// window (the lowest = soil's material_min 0.45) ⇒ classify-or-air (C180)
// paints AIR. Every solid surface-band cell therefore lies where r > 0.51:
// the hills' surface line = the r = 0.51 contour y = A(x) + 0.51·(B(x) − A(x)),
// a smooth 1-D function of x whose only seed input is xBase (driver[+0x48]).
//
// The lane = SURFACE_V2 (ON by default, noise-terrain.mjs; only "0" disables).
// METER-CLASS: n/a — E0/E1 law pins (golden literals + cell counts).

import { describe, test, expect } from "vitest";
import { bandRampEval } from "../../mapgen/lib/noise-proto.mjs";
import { phaseSXBase, makeBandDriver, bandBlockOf, noiseChunkMask, ensureSurfaceTable } from "../../mapgen/lib/noise-terrain.mjs";
import { loadBiomeConfig, biomeAt } from "../../mapgen/lib/biomes.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

describe("dig #217 — Phase-S xBase goldens (the three capture seeds)", () => {
  // Stream goldens: a regression in the xBase draw is visible here.
  test("78633191 → 24155.7109375 (the C120 golden, unchanged)", () => {
    expect(phaseSXBase(78633191).xBase).toBe(24155.7109375);
  });
  test("78633192 → −24723.21875", () => {
    expect(phaseSXBase(78633192).xBase).toBe(-24723.21875);
  });
  test("78633193 → −73602.15625", () => {
    expect(phaseSXBase(78633193).xBase).toBe(-73602.15625);
  });
});

describe.skipIf(!hasNoitaData())("dig #217 — the hills surface = the r = 0.51 contour", () => {
  test("the hills' lowest classify window sits above 0.871429·0.51", () => {
    const cfg = loadBiomeConfig(dataDir);
    const def = biomeAt(cfg, 43, 14).biome;
    const table = ensureSurfaceTable(dataDir, def);
    // v′ = v unless add_perlin (classify @0x8f557c) — none of the hills comps carry it
    expect(table.components.filter((c) => c.add_perlin).length).toBe(0);
    const mins = table.components.map((c) => Math.fround(c.material_min));
    expect(Math.min(...mins)).toBe(Math.fround(0.45));
    expect(Math.fround(Math.fround(0.871429) * 0.51)).toBeLessThan(Math.fround(0.45));
  });
  test("no solid cell at r ≤ 0.51; ≥ 1 solid cell per column (game chunks x 6..9)", () => {
    const cfg = loadBiomeConfig(dataDir);
    const seed = 78633192;
    const driver = makeBandDriver(cfg, seed);
    let solid = 0, violations = 0;
    for (let cx = 6; cx <= 9; cx++) {
      const band = bandBlockOf(biomeAt(cfg, cx + 35, 14).biome);
      const colHit = new Array(51).fill(false);
      for (const cy of [-1, 0]) {
        const m = noiseChunkMask(cfg, cx + 35, cy + 62, seed);
        expect(m).not.toBeNull();
        for (let r = 0; r < 51; r++) for (let c = 0; c < 51; c++) {
          if (!m.mask[52 * r + c]) continue;
          solid++; colHit[c] = true;
          const wx = cx * 512 + c * 10 + 5, wy = cy * 512 + r * 10 + 5;
          if (bandRampEval(driver, band, wx, wy) <= 0.51) violations++;
        }
      }
      expect(colHit.every(Boolean)).toBe(true);
    }
    expect(solid).toBeGreaterThan(1000);
    expect(violations).toBe(0);
  });
});
