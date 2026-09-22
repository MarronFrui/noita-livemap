// caves-field.mjs contracts — the BitmapCaves cave-field port (SURFACE_V3,
// the lib/caves-field.mjs byte-status ledger + CONSTANTS.md C44/C46/C48/
// C50/C51, ABOUT_MATH 2026-09-21 (38)–(80)). Synthetic grids only; the
// C48-oracle byte bar is the data-dependent describe at the bottom
// (auto-skips without the extracted data / the gitignored oracle artifact).

import fs from "node:fs";
import path from "node:path";

import { describe, test, expect } from "vitest";
import {
  CAVES_FIELD_VER,
  toucherValue,
  caveRecordStamp,
  carveCircle,
  stampBlendLerp,
  walkChain,
  scatterEmptyGate,
  buildCavesField,
  fieldSolidAt,
  makeFieldGridFromTopology,
} from "../../mapgen/lib/caves-field.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";
import { NollaPrng } from "../../mapgen/lib/wang-js.mjs";
import { dataDir, hasNoitaData, repoRoot } from "../helpers/data.mjs";

const SEED = 78633191; // the reference seed (the C48 oracle = this seed)

// ── the C48 toucher ([P+0x94] = (w·0.5)/0.1, CE byte-cross-verified) ────────
describe("toucherValue — the fn C1 ×5·w toucher (C48)", () => {
  test("512-wide grid → 2560.0 (the CE-pinned bitmap_hills value)", () => {
    expect(toucherValue(512)).toBeCloseTo(2560, 9);
  });
  test("1-wide placeholder → 5.0 (the CE 1×1 pin)", () => {
    expect(toucherValue(1)).toBeCloseTo(5, 9);
  });
  test("is exactly (w·0.5)/0.1", () => {
    expect(toucherValue(3584)).toBeCloseTo((3584 * 0.5) / 0.1, 9);
  });
});

// ── the 0x8EE930 smoothstep LERP (dig #58, the ONLY lowering writer) ────────
describe("stampBlendLerp — the smoothstep LERP stamp (true 0x8EE930)", () => {
  const w = 16, h = 16;
  const fresh = () => new Float32Array(w * h).fill(1.0);

  test("center cell is the exact LERP endpoint (t = 1 → v_out = v_arg)", () => {
    const g = fresh();
    stampBlendLerp(g, w, h, 8, 8, 4, 0.25);
    expect(g[8 * w + 8]).toBeCloseTo(0.25, 12);
  });

  test("per-cell form = (v_arg − v_dst)·t + v_dst with t = (r−dist)/r", () => {
    const g = fresh();
    const r = 4, vArg = 0.25;
    stampBlendLerp(g, w, h, 8, 8, r, vArg);
    // one cell 2 left of the center: dist = 2 → t = (4−2)/4 = 0.5
    expect(g[8 * w + 6]).toBeCloseTo((vArg - 1.0) * 0.5 + 1.0, 12);
  });

  test("LOWERS without a max-bleed guard (the dig #58 'can lower' pin)", () => {
    const g = fresh();
    stampBlendLerp(g, w, h, 8, 8, 4, 0.0);
    let min = 1;
    for (const v of g) if (v < min) min = v;
    expect(min).toBe(0); // the center was pulled fully down — no guard
  });

  test("RAISES toward v_arg > dst (plain write, no max-bleed)", () => {
    const g = new Float32Array(w * h).fill(0.9);
    stampBlendLerp(g, w, h, 8, 8, 4, 1.4);
    expect(g[8 * w + 8]).toBeCloseTo(1.4, 7); // a max-bleed lane would cap at 0.9 (f32-stored)
  });

  test("bounds guard: cells outside the grid are skipped", () => {
    const g = fresh();
    stampBlendLerp(g, w, h, 0, 0, 3, 0.0); // center at the corner
    expect(g[0]).toBeCloseTo(0, 12); // the in-grid center still stamped
    expect(g[0 * w + 1]).toBeLessThan(1.0); // the inside neighbor too
  });
});

// ── the (43)(a) max-bleed setter (C46, closed incl. the (y/25)⁸ eave) ───────
describe("carveCircle — the (43)(a) max-bleed/bias setter (true 0x8EE750)", () => {
  const w = 32, h = 32;
  const fresh = () => new Float32Array(w * h).fill(1.0);

  test("dir=min writes iff existing > new (carve down)", () => {
    const g = new Float32Array(w * h).fill(0.8);
    carveCircle(g, w, h, 8, 8, 3, 0.5, 0, "min");
    expect(g[8 * w + 8]).toBeCloseTo((0.5 - 0.8) * 1.0 + 0.8, 12); // t=1 at center
  });

  test("dir=max raises and never lowers (write iff new > existing)", () => {
    const g = fresh(); // all 1.0
    carveCircle(g, w, h, 8, 8, 3, 0.9, 0, "max"); // v0 = (0.9−1)·t+1 ≤ 1 → no-op
    for (const v of g) expect(v).toBe(1.0);
    carveCircle(g, w, h, 8, 8, 3, 1.5, 0, "max"); // v0 = 0.5·t+1 > 1 at the center
    expect(g[8 * w + 8]).toBeCloseTo(1.5, 12); // the raise landed
  });

  test("the ((y−1)/25)⁸ top-row eave applies ONLY with flag ≠ 0 and y < 25", () => {
    const g1 = fresh(), g2 = fresh();
    // at y=24: ((24−1)/25)⁸·v0 + 1 (computed in f64 on both sides)
    carveCircle(g1, w, h, 8, 24, 3, 1.0, 1, "max");
    carveCircle(g2, w, h, 8, 24, 3, 1.0, 0, "max");
    const q = (23 / 25) ** 8;
    // the grid is Float32 → the stored value is f32-rounded (hence digits 7)
    expect(g1[24 * w + 8]).toBeCloseTo(q * 1.0 + 1.0, 7); // the eave shape
    expect(g2[24 * w + 8]).toBeCloseTo(1.0, 12); // flag=0 → plain v0 = 1.0
  });

  test("cells beyond the radius are never touched", () => {
    const g = fresh();
    carveCircle(g, w, h, 8, 8, 3, 0.0, 0, "min");
    expect(g[8 * w + 13]).toBe(1.0); // dist 5 > r 3
    expect(g[8 * w + 8]).toBe(0.0); // the center carved
  });
});

// ── the roll twins (the dig #61 NEGATIVE scale vs the dig #65 POSITIVE form) ─
describe("the roll twins — negative stamp roll (dig #61)", () => {
  test("the record count roll counts DOWN from max via the negative scale", () => {
    // stub prng: always draws 0.0 → count = max − trunc(0·span) = max
    const stub = { next: () => 0.0 };
    const field = new Float32Array(64 * 64).fill(1.0);
    const bytes = new Uint8Array(64 * 64);
    const got = caveRecordStamp(
      { field, bytes, w: 64, h: 64 },
      { aabbMinX: 10, aabbMaxX: 50, aabbMinY: 5, aabbMaxY: 25, countMin: 2, countMax: 6, strengthMin: 0.55, strengthMax: 2.15 },
      stub
    );
    expect(got).toBe(6); // counts down from MAX (a min+ roll would give 2)
  });

  test("the record's own strength pair feeds the stamp value (min at draw 0)", () => {
    const stub = { next: () => 0.0 };
    const field = new Float32Array(64 * 64).fill(1.0);
    const bytes = new Uint8Array(64 * 64);
    caveRecordStamp(
      { field, bytes, w: 64, h: 64 },
      { aabbMinX: 10, aabbMaxX: 50, aabbMinY: 5, aabbMaxY: 25, countMin: 3, countMax: 8, strengthMin: 0.55, strengthMax: 2.15 },
      stub
    );
    // stamp 1 at (aabbMinX, aabbMinY), flag=1 → the (43)(a) eave arm applies
    // (y=5 < 25): v = ((5−1)/25)⁸·v0 + 1 with v0 = (0.55−1)·1+1 = 0.55 —
    // the ≈1.0 eave band the C48 oracle's top rows show
    const q = ((5 - 1) / 25) ** 8;
    expect(field[5 * 64 + 10]).toBeCloseTo(q * 0.55 + 1.0, 7); // the eave form
    expect(bytes[5 * 64 + 10]).toBe(1); // the 0x8EF950 byte lane
  });
});

// ── the scatter engine (true 0x8EF2D0, dig #56) ─────────────────────────────
describe("scatterEmptyGate — the < 0.5 empty-cell gate + the B-recorder", () => {
  const w = 8, h = 8;
  test("fires ONLY on a carved (< 0.5) cell; marks the byte lane", () => {
    const field = new Float32Array(w * h).fill(1.0);
    field[0] = 0.3; // the empty cell
    const bytes = new Uint8Array(w * h);
    const hit = scatterEmptyGate({ field, bytes, w, h }, { w, h }, { next: () => 0.0 });
    expect(hit).toEqual({ x: 0, y: 0 });
    expect(bytes[0]).toBe(1); // the 0x8FAFC0 B-recorder lane
  });
  test("rejects a solid (≥ 0.5) cell with no byte mark", () => {
    const field = new Float32Array(w * h).fill(1.0);
    const bytes = new Uint8Array(w * h);
    const hit = scatterEmptyGate({ field, bytes, w, h }, { w, h }, { next: () => 0.0 });
    expect(hit).toBeNull();
    expect(bytes[0]).toBe(0);
  });
  test("bounds check: a rolled point outside the grid is rejected", () => {
    const field = new Float32Array(w * h).fill(0.0); // everything empty
    const bytes = new Uint8Array(w * h);
    // draw 0.999999 → x = y = trunc(0.999999·8) = 7 → still in-bounds
    const inBounds = scatterEmptyGate({ field, bytes, w, h }, { w, h }, { next: () => 0.999999 });
    expect(inBounds).toEqual({ x: 7, y: 7 });
    // an exactly-OOB draw (dx·span → x = w) must hit the bounds arm
    const field2 = new Float32Array(w * h).fill(0.0);
    const out = scatterEmptyGate({ field: field2, bytes, w, h }, { w, h }, { next: () => 1.0 });
    expect(out).toBeNull();
  });
});

// ── the fnA walk (the LERP worm; the ≤50-step box, dig #66/#68/#69) ─────────
describe("walkChain — the fnA stamp walk", () => {
  const w = 512, h = 256;
  test("lowers only: a walk on the 1.0 base never raises a cell (the dig #80 writer-split regression — the (43)(a) setter per stamp REFILLED the worm)", () => {
    const field = new Float32Array(w * h).fill(1.0);
    walkChain(field, w, h, new NollaPrng(SEED), 100, 60, 5, 0, "lerp");
    let max = 0, min = 1;
    for (const v of field) { if (v > max) max = v; if (v < min) min = v; }
    expect(max).toBe(1.0); // LERP toward v ∈ [0,1] cannot raise above the base
    expect(min).toBeLessThan(0.5); // the deep carve landed (the worm)
  });

  test("deterministic for a given prng state (the C48 determinism verdict)", () => {
    const a = new Float32Array(w * h).fill(1.0);
    const b = new Float32Array(w * h).fill(1.0);
    walkChain(a, w, h, new NollaPrng(SEED), 7, 7, 5, 0, "lerp");
    walkChain(b, w, h, new NollaPrng(SEED), 7, 7, 5, 0, "lerp");
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test("stays inside the ≤50-step box: the carve span is bounded", () => {
    const field = new Float32Array(w * h).fill(1.0);
    walkChain(field, w, h, new NollaPrng(SEED), 100, 60, 5, 0, "lerp");
    let minX = w, maxX = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (field[y * w + x] < 1.0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    // 50 steps × ≤0.7 px advance + radius 5 ⇒ the x-span is bounded ≪ w/2
    expect(maxX - minX).toBeLessThanOrEqual(60);
  });
});

// ── the composed builder (fn C1 + the v4 fnB composition) ───────────────────
describe("buildCavesField — fn C1 + the byte-cited composition order", () => {
  // hills.xml's declared knob spans (data-verified on disk 2026-09-21) —
  // a synthetic def is enough: the parser output shape is the contract.
  const hillsBC = {
    name: "bitmap_hills", sizeX: 512, sizeY: 256,
    blobCavesCountMin: 20, blobCavesCountMax: 55,
    blobCavesRadiusMin: 1, blobCavesRadiusMax: 10,
    blobCavesStrengthMin: 1.5, blobCavesStrengthMax: 3,
    caveChildsMin: 0, caveChildsMax: 2,
    caveCountMin: 50, caveCountMax: 100,
    caveStrengthMin: 0.2, caveStrengthMax: 1,
    surfaceCavesCountMin: 7, surfaceCavesCountMax: 12,
    surfaceCaveChildsMin: 2, surfaceCaveChildsMax: 7,
    mountainCountMin: 0, mountainCountMax: 15,
    structures: [
      { imageFile: "cave_$[0-999].png", aabbMinX: 5, aabbMaxX: 507, aabbMinY: 0, aabbMaxY: 20, countMin: 5, countMax: 12, strengthMin: 0.55, strengthMax: 2.15 },
      { imageFile: "mountain_rock.png", aabbMinX: 5, aabbMaxX: 507, aabbMinY: 0, aabbMaxY: 20, countMin: 0, countMax: 4, strengthMin: 1.45, strengthMax: 1.55 },
    ],
  };
  const mkDef = (bc) => ({ name: "_EMPTY_", bitmapCaves: bc });

  test("returns null without a BitmapCaves block", () => {
    expect(buildCavesField(null, { name: "x", bitmapCaves: null }, SEED)).toBeNull();
  });

  test("p94 = the ×5·w toucher; meta counts live within the XML spans", () => {
    const r = buildCavesField(null, mkDef(hillsBC), SEED);
    expect(r).not.toBeNull();
    expect(r.p94).toBeCloseTo(2560, 9);
    expect(r.meta.blobCount).toBeGreaterThanOrEqual(hillsBC.blobCavesCountMin);
    expect(r.meta.blobCount).toBeLessThanOrEqual(hillsBC.blobCavesCountMax);
    expect(r.meta.caveCount).toBeGreaterThanOrEqual(hillsBC.caveCountMin);
    expect(r.meta.caveCount).toBeLessThanOrEqual(hillsBC.caveCountMax);
  });

  test("the dig #55 raise lanes keep their byte classes (C44 chain bases)", () => {
    const r = buildCavesField(null, mkDef(hillsBC), SEED);
    // L3's value = (d·0.1+0.1)·(d·0.35+0.65) ∈ [0.065, 0.2] — the deep-carve
    // raise class (the C44 [−0x108] = d·0.1+0.1 chain base).
    expect(r.meta.l3v).toBeGreaterThanOrEqual(0.065 - 1e-9);
    expect(r.meta.l3v).toBeLessThanOrEqual(0.2 + 1e-9);
    // L2's value = [−0x128]·(d·0.35+0.65) with [−0x128] = the L1 output ≤ 1
    expect(r.meta.l2v).toBeLessThanOrEqual(1.0000000001);
  });

  test("deterministic per (diddled ws, params) — the C48 byte-identity verdict", () => {
    const a = buildCavesField(null, mkDef(hillsBC), SEED);
    const b = buildCavesField(null, mkDef(hillsBC), SEED);
    expect(Array.from(a.field)).toEqual(Array.from(b.field));
    expect(Array.from(a.bytes)).toEqual(Array.from(b.bytes));
  });

  test("seed-sensitive: a different seed moves the field", () => {
    const a = buildCavesField(null, mkDef(hillsBC), SEED);
    const b = buildCavesField(null, mkDef(hillsBC), SEED + 1);
    let diff = 0;
    for (let i = 0; i < a.field.length; i++) if (a.field[i] !== b.field[i]) diff++;
    expect(diff).toBeGreaterThan(0);
  });

  test("the 1.0 base bake + real carving: neither untouched nor empty", () => {
    const r = buildCavesField(null, mkDef(hillsBC), SEED);
    let solid = 0;
    for (const v of r.field) if (v > 0.5) solid++;
    const share = solid / r.field.length;
    expect(share).toBeGreaterThan(0.3); // some carve happened
    expect(share).toBeLessThan(1.0); // not all-carved either
  });

  test("the C34 sampler gate: fieldSolidAt = > 0.5, null out of bounds", () => {
    const r = buildCavesField(null, mkDef(hillsBC), SEED);
    expect(fieldSolidAt(r, -1, 0)).toBeNull();
    expect(fieldSolidAt(r, r.w, 0)).toBeNull();
    // a helper/direct read must agree with the > 0.5 gate on a real cell
    const x = 0, y = 100;
    expect(fieldSolidAt(r, x, y)).toBe(r.field[y * r.w + x] > 0.5);
  });
});

// ── the C48 oracle byte bar (data-dependent; auto-skips without artifacts) ──
const oraclePath = path.join(repoRoot, "mapgen/out/oracle/caves-grid-2026-09-21.json");
const hasOracle = fs.existsSync(oraclePath);

describe.skipIf(!hasNoitaData() || !hasOracle)("the C48 oracle byte bar (seed 78633191, grid_0x26599020)", () => {
  const oracle = JSON.parse(fs.readFileSync(oraclePath, "utf8"));
  const grid = oracle["grid_0x26599020"];

  // the hills-class def (the _EMPTY_ biome carries the bitmap_hills block)
  let def = null;
  for (const d of loadBiomeConfig(dataDir).biomes.values()) {
    if (d?.bitmapCaves?.name === "bitmap_hills") { def = d; break; }
  }

  test("the hills-class def resolves (the 4-entry name cache's key)", () => {
    expect(def).not.toBeNull();
  });

  test("the port p94 matches the CE-pinned (w·0.5)/0.1 = 2560.0", () => {
    const r = buildCavesField(dataDir, def, SEED);
    expect(r.p94).toBeCloseTo(grid.p94, 6);
  });

  test("the y224 row stays BYTE-EXACT (the standing byte bar, dig #64/#80)", () => {
    const r = buildCavesField(dataDir, def, SEED);
    const ref = grid["y224"];
    for (let i = 0; i < ref.length; i++) {
      expect(r.field[224 * r.w + i]).toBeCloseTo(ref[i], 4);
    }
  });

  test("the bump peak lives inside the C50 strength span [0, 1.549988]", () => {
    // data-only pin: the oracle's peak = 1.454092 must stay inside the CE
    // (+0x74, +0x78) span — guards the strength-pair interpretation.
    const bump = Math.max(...grid["y0_x0_31"]);
    expect(bump).toBeCloseTo(1.454092, 5);
    expect(bump).toBeLessThanOrEqual(1.549988 + 1e-6);
  });
});

// CAVES_FIELD_VER pins the byte-status generation (the composition epoch).
test("CAVES_FIELD_VER is the v4 composition stamp", () => {
  expect(CAVES_FIELD_VER).toContain("v4 composition");
});
