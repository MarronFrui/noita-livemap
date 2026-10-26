// cave-stamps.mjs contracts — dig #202/#203: the CaveStructure stamp-field
// lane (the fn870 blend dst' = dst + srcVal·(strength − dst) — the lerp
// toward the DRAWN STRENGTH weighted by the stamp's decoded pixel, the
// 0x8EF870 byte law) + the C175 hard overlay. The draws are BYTE-IDENTICAL
// with the paint on/off (the stream parity = the port's load-bearing
// invariant). The srcVal's scale = the α·lum stand-in (the C32 decode =
// the A17 d2 read). The data-dependent tests auto-skip without the data.

import { describe, test, expect } from "vitest";

import {
  caveRecordStamp,
  buildCavesField,
  makeMinstd,
} from "../../mapgen/lib/caves-field.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

const SEED = 78633191; // the reference seed

// ── the draw parity (the paint consumes NO draws — the stream invariant) ────
describe("caveRecordStamp — the fn870 field paint (dig #202/#203)", () => {
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

  test("the strength roll is CONSUMED: the blend's target = min + u·(max−min)", () => {
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
    // the fn870 law (dig #203): dst' = dst + srcVal·(strength − dst) with
    // the strength = 0.3 (the drawn min) and the srcVal = THE ALPHA (the
    // coverage — the measured blends REACH the target exactly on the
    // opaque body: the pit = the flat strength-colored region; the white =
    // the tRNS-transparent surround, α = 0 ⇒ skipped) — the deepest blend
    // = 0.3 exactly
    let sawBlend = false;
    for (let i = 0; i < field.length; i++) {
      if (field[i] !== 1.0) {
        sawBlend = true;
        expect(field[i]).toBeLessThan(1.0);
        expect(field[i]).toBeGreaterThanOrEqual(0.3 - 1e-9); // the lerp's floor = the target
      }
    }
    expect(sawBlend).toBe(true); // the paint happened
    expect(Math.min(...[...field].filter((v) => v !== 1.0))).toBeCloseTo(0.3, 5);
  });

  test("the fn870 blend formula: dst' = dst + srcVal·(strength − dst)", () => {
    // scripted: count=1, ctor(0.5), X(0), Y(0), strength(0.5) — the target
    // = 0.5; the pit's body = the dark grays (the max srcVal = 20/255 — the
    // white = the tRNS-transparent surround) ⇒ the deepest blend =
    // 1 − 0.5·(20/255) = 0.9608 — the lerp toward the 0.5 target
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
    const blended = [...field].filter((v) => v !== 1.0);
    expect(blended.length).toBeGreaterThan(0);
    expect(Math.min(...blended)).toBeCloseTo(0.5, 5);
    // the lerp property: every blended value ∈ [target, dst] = [0.5, 1]
    for (const v of blended) {
      expect(v).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(v).toBeLessThanOrEqual(1.0 + 1e-9);
    }
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

// ── the MINSTD engine (dig #204: the game's fnB draw chain) ──────────────────
describe("makeMinstd — the Schrage MINSTD engine (dig #204)", () => {
  test("the classic MINSTD vector: seed 1 → 16807 → 282475249", () => {
    const m = makeMinstd(1);
    expect(Math.round(m.next() * 2 ** 31)).toBe(16807);
    expect(Math.round(m.next() * 2 ** 31)).toBe(282475249);
  });

  test("the seed = the signed-32 wrap (the ctor's cvttsd2si trunc law)", () => {
    // the seed ≥ 2^31 wraps negative; the first step's ≤0 correction fires
    const m = makeMinstd(0x80000000); // → the signed −2^31
    const u = m.next();
    expect(u).toBeGreaterThan(0); // the correction forces the positive state
    expect(u).toBeLessThan(1);
  });

  test("the u ∈ (0,1) and the state stays positive across 1000 draws", () => {
    const m = makeMinstd(78633191);
    for (let i = 0; i < 1000; i++) {
      const u = m.next();
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThan(1);
    }
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
    // the blend is SYMMETRIC in effect direction (the fn870 lerp toward the
    // drawn strength): the stamps' strength > the base's local value ⇒ the
    // pull UP; the strength < ⇒ the pull DOWN — both directions occur (the
    // dig-#202 measured signature: the net = a slight carve on the hills
    // seed, 117230 vs 118051 solids)
    let up = 0, down = 0;
    for (let i = 0; i < base.field.length; i++) {
      if (stamped.field[i] > base.field[i]) up++;
      else if (stamped.field[i] < base.field[i]) down++;
    }
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
  });
});
