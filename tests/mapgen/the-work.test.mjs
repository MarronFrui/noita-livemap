// tests/mapgen/the-work.test.mjs — the Work y-wrap law (dig #215, C186).
//
// Bytes: P = ONE wang image over the 70x48 biome map (Init 0x905fb0: grid
// ctor 0x8f95c0(P, floor(70*512/10), floor(48*512/10)) @0x90738f), every read
// wrapped by the getter 0x9fe4e0, read at the warp's x0.1 frame ⇒ the rows
// above/below the map re-read the main band every 24570 px; P-empty cells are
// classified by the chunk biome with v = 0x908e70(x, y, field).
//
// COUNT-TEST NOTE (charter: must FAIL under the old law): the old law computed
// wang areas over the clamped vmap — the_end's area ran y 43..95 (53 rows) and
// filled every hell row with its own speckle atlas (grid >= 0 on the Work rows),
// the_sky's ran −48..0. The pins below (in-map areas, grid −1 on the Work rows,
// the 24570-px period) fail that arithmetic.

import { describe, test, expect } from "vitest";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";
import { WORK_P_ROWS, WORK_PERIOD_Y, workWrapY, workClassifyValue, workCellAt } from "../../mapgen/lib/the-work.mjs";

describe("the Work — pure law", () => {
  test("P rows = floor(48*512/10) = 2457 ⇒ period 24570 px (not 24576)", () => {
    expect(WORK_P_ROWS).toBe(2457);
    expect(WORK_PERIOD_Y).toBe(24570);
  });
  test("workWrapY = positive modulo onto the main band", () => {
    const top = 24576;
    expect(workWrapY(top, top)).toBe(top);
    expect(workWrapY(top - 1, top)).toBe(top + 24569); // heaven's last px → main's last P row
    expect(workWrapY(top + 24570, top)).toBe(top); // hell's first period px → main row 0
    expect(workWrapY(top + 24570 + 5123, top)).toBe(top + 5123);
    expect(workWrapY(top - 2 * 24570 + 77, top)).toBe(top + 77);
  });
  test("0x908e70: field 1.0 ⇒ v in [0.5, 1.32]; field ≤ 0.5 clamps to 0.5", () => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 4000; i++) {
      const v = workClassifyValue((i * 7919) % 9000 - 4500, (i * 104729) % 9000, 1.0);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    // amp = ((1−0.5)·0.5)²·5.35·0.95 = 0.31766 ⇒ v = 1 ± 0.31766·|s|
    expect(lo).toBeGreaterThanOrEqual(1 - 0.3177);
    expect(hi).toBeLessThanOrEqual(1 + 0.3177);
    expect(hi - lo).toBeGreaterThan(0.2); // the simplex term is live
    expect(workClassifyValue(10, 20, 0.5)).toBe(0.5); // d = 0 ⇒ v = field = 0.5
    expect(workClassifyValue(10, 20, 0.3)).toBe(0.5); // max(v, 0.5)
  });
  test("workCellAt: black/marker/dim grey = air; explicit material passes; bright grey → classify", () => {
    const mats = new Map([["f4e55b", "sand"], ["000001", "air"]]);
    const table = { components: [], bandMin: 0, bandMax: 0, mInitialized: true, cellFactory: true };
    expect(workCellAt(0, 0, 0, mats, table, 0, 0).air).toBe(true);
    expect(workCellAt(0xf4, 0xe5, 0x5b, mats, table, 0, 0).material).toBe("sand");
    expect(workCellAt(0, 0, 1, mats, table, 0, 0).air).toBe(true); // explicit air id
    expect(workCellAt(0x12, 0x34, 0x56, mats, table, 0, 0).air).toBe(true); // script colour: no field
    expect(workCellAt(100, 100, 100, mats, table, 0, 0).air).toBe(true); // field 0.39 ≤ 0.5
    expect(workCellAt(255, 255, 255, mats, null, 0, 0).air).toBe(true); // no table ⇒ skip
  });
});

describe.skipIf(!hasNoitaData())("the Work — data (E1, seed 78633191 frame)", () => {
  test("wang areas are in-map: the_end = rows 43..47, the_sky = row 0", async () => {
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(dataDir);
    const byFile = (f) => [...cfg.biomes.values()].find((d) => d.filename === f);
    const end = byFile("data/biome/the_end.xml");
    const sky = byFile("data/biome/the_sky.xml");
    expect(Math.max(...end.areas.map((a) => a.y2))).toBe(47); // old law: 95
    expect(Math.min(...end.areas.map((a) => a.y1))).toBe(43);
    expect(sky.areas.every((a) => a.y1 === 0 && a.y2 === 0)).toBe(true); // old law: y1 = −48
    for (const def of cfg.biomes.values()) {
      if (!def.templateFile) continue;
      for (const a of def.areas) {
        expect(a.y1).toBeGreaterThanOrEqual(0);
        expect(a.y2).toBeLessThanOrEqual(47);
      }
    }
  });
  test("no wang area owns a Work-row chunk (the P re-read serves them)", async () => {
    const { loadWangWorld, WORLD_CHUNKS_W, SKY_ROWS } = await import("../../mapgen/lib/world-gen.mjs");
    const w = loadWangWorld(dataDir);
    let owned = 0;
    for (const ty of [0, 20, SKY_ROWS - 1, SKY_ROWS + 48, 120, 143]) {
      for (let tx = 0; tx < WORLD_CHUNKS_W; tx++) if (w.grid[ty * WORLD_CHUNKS_W + tx] >= 0) owned++;
    }
    expect(owned).toBe(0); // old law: the_end/the_sky/robobase columns owned (≥ 31 per row)
  });
  test("the classify tables: the_end → skullrock, the_sky → cloud at field 1.0 (first match, 0x8f5030)", async () => {
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const { ensureSurfaceTable } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadMaterials } = await import("../../mapgen/lib/colorize.mjs");
    const cfg = loadBiomeConfig(dataDir);
    const mats = loadMaterials(dataDir);
    for (const [f, want] of [["the_end", "skullrock"], ["the_sky", "cloud"]]) {
      const def = [...cfg.biomes.values()].find((d) => d.filename === `data/biome/${f}.xml`);
      const table = ensureSurfaceTable(dataDir, def);
      const got = new Map();
      for (let i = 0; i < 400; i++) {
        const r = workCellAt(255, 255, 255, mats, table, (i * 131) % 4000, 20000 + ((i * 977) % 4000));
        got.set(r.material ?? "air", (got.get(r.material ?? "air") ?? 0) + 1);
      }
      expect(got.get(want) ?? 0).toBeGreaterThan(380);
    }
  });
});
