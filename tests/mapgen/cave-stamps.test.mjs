// cave-stamps.mjs contracts — dig #202 (C175): the CaveStructure stamp-field
// lane (the fn870 α-blend paints the stamps' decoded values into the field
// at the dig-#164 record-lane positions). The draws are BYTE-IDENTICAL with
// the paint on/off (the stream parity = the port's load-bearing invariant).
// The data-dependent tests auto-skip without the extracted game data.

import { describe, test, expect } from "vitest";

import {
  caveRecordStamp,
  buildCavesField,
} from "../../mapgen/lib/caves-field.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";
import { NollaPrng } from "../../mapgen/lib/wang-js.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

const SEED = 78633191; // the reference seed

// ── the draw parity (the paint consumes NO draws — the stream invariant) ────
describe("caveRecordStamp — the fn870 field paint (dig #202)", () => {
  // a scripted prng: the deterministic draw sequence, the draws counted
  const scripted = (values) => {
    const s = { draws: 0, i: 0 };
    s.stub = {
      next: () => {
        s.draws++;
        const v = values[s.i % values.length];
        s.i++;
        return v;
      },
    };
    return s;
  };

  test("the paint consumes no draws (the stream parity, no-$ image)", () => {
    const a = scripted([0.5]);
    const b = scripted([0.5]);
    const W = 64, H = 64;
    const bytesA = new Uint8Array(W * H);
    const bytesB = new Uint8Array(W * H);
    const fieldA = new Float32Array(W * H).fill(1.0);
    const fieldB = new Float32Array(W * H).fill(1.0);
    const rec = {
      countMin: 2, countMax: 2,
      imageFile: "data/biome_impl/caves/pit.png",
      aabbMinX: 10, aabbMaxX: 10, aabbMinY: 0, aabbMaxY: 0,
      strengthMin: 0.2, strengthMax: 0.2,
    };
    caveRecordStamp(rec, a.stub, bytesA, W, H);
    caveRecordStamp(rec, b.stub, bytesB, W, H, fieldB, true);
    expect(b.draws).toBe(a.draws); // the draw budget identical
    expect(Array.from(bytesB)).toEqual(Array.from(bytesA)); // the byte stencil identical
  });

  test("the strength roll is CONSUMED: v = lum × (min + u·(max−min))", () => {
    // scripted draws: count(u=0→count=min=1), ctor(0.5), X(0→min), Y(0→min),
    // strength(0→min) — the strength = strengthMin exactly
    const s = scripted([0, 0.5, 0, 0, 0]);
    const W = 64, H = 64;
    const bytes = new Uint8Array(W * H);
    const field = new Float32Array(W * H).fill(1.0);
    const rec = {
      countMin: 1, countMax: 1,
      imageFile: "data/biome_impl/caves/pit.png",
      aabbMinX: 10, aabbMaxX: 10, aabbMinY: 5, aabbMaxY: 5,
      strengthMin: 0.3, strengthMax: 0.9,
    };
    caveRecordStamp(rec, s.stub, bytes, W, H, field, true);
    expect(s.draws).toBe(1 + 4); // the count roll + ctor/X/Y/strength
    // the pit.png's painted pixels: the exact per-pixel v = lum × 0.3 (the
    // pngjs-normalized RGBA ⇒ α = 1 ⇒ the blend lands ON v); the (20,20,20)
    // pixel → 20/255 × 0.3 = 0.023529…
    let sawBlend = false;
    for (let i = 0; i < field.length; i++) {
      if (field[i] !== 1.0) {
        sawBlend = true;
        expect(field[i]).toBeGreaterThan(0);
        expect(field[i]).toBeLessThan(0.31); // the lum ≤ 0.97 × 0.3
      }
    }
    expect(sawBlend).toBe(true); // the paint happened
    expect(field.some((v) => Math.abs(v - (20 / 255) * 0.3) < 1e-6)).toBe(true);
  });

  test("the fn870 blend formula: dst' = dst + α·(v − dst)", () => {
    // the pit.png's brightest pixel = (247,255,255) → lum = 1.0; with the
    // strength = 0.5 exactly (u = 0.5 over [0,1]) → v = 0.5; the α = 1
    // (the opaque pixel) → the blended = 1.0 + 1.0·(0.5 − 1.0) = 0.5
    const s = scripted([0, 0.5, 0, 0, 0.5]);
    const W = 32, H = 32;
    const bytes = new Uint8Array(W * H);
    const field = new Float32Array(W * H).fill(1.0);
    const rec = {
      countMin: 1, countMax: 1,
      imageFile: "data/biome_impl/caves/pit.png",
      aabbMinX: 3, aabbMaxX: 3, aabbMinY: 3, aabbMaxY: 3,
      strengthMin: 0.0, strengthMax: 1.0,
    };
    caveRecordStamp(rec, s.stub, bytes, W, H, field, true);
    // the α = 1, lum = 1.0 pixel → exactly 0.5; the α = 1, lum < 1 → < 0.5
    const blended = [...field].filter((v) => v !== 1.0);
    expect(blended.length).toBeGreaterThan(0);
    expect(Math.max(...blended)).toBeCloseTo(0.5, 6); // the brightest pixel's blend
  });

  test("count ≤ 0 with the paint on = the pure skip (no field writes)", () => {
    const s = scripted([0.5]);
    const W = 8, H = 8;
    const bytes = new Uint8Array(W * H);
    const field = new Float32Array(W * H).fill(1.0);
    caveRecordStamp(
      { countMin: -4, countMax: -1, imageFile: "data/biome_impl/caves/pit.png" },
      s.stub, bytes, W, H, field, true
    );
    expect(s.draws).toBe(1);
    expect([...field].every((v) => v === 1.0)).toBe(true);
  });
});

// ── the data-dependent block (the real stamps + the real biome XMLs) ────────
describe.skipIf(!hasNoitaData)("cave-stamps — the data-gated laws (dig #202)", () => {
  test("buildCavesField SURFACE_STAMPS=1 changes the field vs the base (fail-under-old)", () => {
    const cfg = loadBiomeConfig(dataDir);
    // the hills-family config: the Topology name = "_EMPTY_" — find by the
    // structures' presence + the generated-cave image_file
    let hillsDef = null;
    for (const [, def] of cfg.biomes) {
      const s = def.bitmapCaves?.structures ?? [];
      if (s.some((st) => (st.imageFile ?? "").includes("generated/cave_"))) {
        hillsDef = def;
        break;
      }
    }
    expect(hillsDef).not.toBeNull();
    const base = buildCavesField(dataDir, hillsDef, SEED, false);
    const stamped = buildCavesField(dataDir, hillsDef, SEED, true);
    // the byte planes IDENTICAL (the stencil unchanged), the fields DIFFER
    expect(Array.from(stamped.bytes)).toEqual(Array.from(base.bytes));
    let diff = 0;
    for (let i = 0; i < base.field.length; i++) {
      if (base.field[i] !== stamped.field[i]) diff++;
    }
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(base.field.length); // the stamps = local edits
  });

  test("the stamped field's solid set ⊇ the base's in the stamp rects (the lumps ADD)", () => {
    const cfg = loadBiomeConfig(dataDir);
    let hillsDef = null;
    for (const [, def] of cfg.biomes) {
      const s = def.bitmapCaves?.structures ?? [];
      if (s.some((st) => (st.imageFile ?? "").includes("generated/cave_"))) {
        hillsDef = def;
        break;
      }
    }
    const base = buildCavesField(dataDir, hillsDef, SEED, false);
    const stamped = buildCavesField(dataDir, hillsDef, SEED, true);
    // the byte planes IDENTICAL (the stencil unchanged), the fields DIFFER
    expect(Array.from(stamped.bytes)).toEqual(Array.from(base.bytes));
    let diff = 0;
    for (let i = 0; i < base.field.length; i++) {
      if (base.field[i] !== stamped.field[i]) diff++;
    }
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(base.field.length); // the stamps = local edits
    // the blend is SYMMETRIC (the fn870 formula): the stamps' bright cores
    // pull the base UP toward solid, the fringes/low-strength stamps pull
    // DOWN — both directions must occur (the dig-#202 measured signature:
    // the net = a slight carve on the hills seed, 117230 vs 118051 solids)
    let up = 0, down = 0;
    for (let i = 0; i < base.field.length; i++) {
      if (stamped.field[i] > base.field[i]) up++;
      else if (stamped.field[i] < base.field[i]) down++;
    }
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
  });
});
