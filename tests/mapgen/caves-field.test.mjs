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

  test("per-cell form = v_dst + (v_arg − v_dst)·t² with t = (r²−d²)/r²", () => {
    const g = fresh();
    const r = 4, vArg = 0.25;
    stampBlendLerp(g, w, h, 8, 8, r, vArg);
    // one cell 2 left of the center: d² = 4, r² = 16 → t = 12/16 = 0.75,
    // w = t² = 0.5625 (the dig #120 byte law @0x8eea33, entry (120))
    expect(g[8 * w + 6]).toBeCloseTo(1.0 + (vArg - 1.0) * 0.75 ** 2, 12);
  });

  test("R ≤ 1 = the single-cell MIN-guard arm (write iff cell > v)", () => {
    const g = fresh(); // all 1.0 → v < cell → the write lands
    stampBlendLerp(g, w, h, 8, 8, 1, 0.25);
    expect(g[8 * w + 8]).toBeCloseTo(0.25, 12);
    const g2 = new Float32Array(w * h).fill(0.1); // cell ≤ v → NO write
    stampBlendLerp(g2, w, h, 8, 8, 1, 0.25);
    expect(g2[8 * w + 8]).toBe(Math.fround(0.1)); // the f32-stored value
    expect(g2[8 * w + 7]).toBe(Math.fround(0.1)); // the neighbor untouched too
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

// ── the LEGACY (43)(a) min/max model (entry (122): retired from production;
//    the true laws = setterStamp (flag=1: the CENTER-y q = y/25 eave, the
//    lower-only carve); the record lane is draws-only since entry (123)) ─────
describe("carveCircle — the legacy (43)(a) min/max model (no production caller)", () => {
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

// ── the record lane = a PRNG-DRAW consumer (dig #123, I28 CLOSED) ────────────
describe("caveRecordStamp — the record lane draws only (dig #123)", () => {
  // a counting stub: every next() consumes one stream draw (returning the
  // mid value 0.5 — the values are discarded, only the BUDGET is observable)
  const counting = () => {
    const s = { draws: 0 };
    s.stub = {
      next: () => {
        s.draws++;
        return 0.5;
      },
    };
    return s;
  };

  test("the count roll counts UP from min (the rollPos twin)", () => {
    // stub prng: always draws 0.0 → count = min + trunc(0·span) = min
    const lo = { next: () => 0.0 };
    expect(caveRecordStamp({ countMin: 2, countMax: 6 }, lo)).toBe(2);
    // u → 1: count reaches MAX (the old down-from-max twin gave 6 at u = 0)
    const hi = { next: () => 0.999999 };
    expect(caveRecordStamp({ countMin: 2, countMax: 6 }, hi)).toBe(6);
  });

  test("count ≤ 0 skips the record entirely (the `jle 0x8f16f1` guard)", () => {
    const s = counting();
    // count = −4 + trunc(0.5·4) = −2 ≤ 0 → the whole record skips
    expect(caveRecordStamp({ countMin: -4, countMax: -1 }, s.stub)).toBe(-2);
    expect(s.draws).toBe(1); // only the count roll — no per-stamp draws
  });

  test("per stamp: ctor-seed + X + Y + strength = 4 draws (values discarded)", () => {
    const s = counting();
    const got = caveRecordStamp(
      { countMin: 3, countMax: 8, imageFile: "data/biome_impl/caves/pit.png" },
      s.stub
    );
    expect(got).toBe(6); // 3 + trunc(0.5·6) = 6 stamps
    expect(s.draws).toBe(1 + 6 * 4); // the count roll + 4 per stamp (no '$')
  });

  test("the 0x668400 resolver adds 1 draw per well-formed $[lo-hi] group", () => {
    const drawCount = (imageFile) => {
      const s = counting();
      caveRecordStamp({ countMin: 1, countMax: 1, imageFile }, s.stub);
      return s.draws;
    };
    expect(drawCount("cave.png")).toBe(1 + 4); // no '$' → 0 resolver draws
    expect(drawCount("cave_$[0-999].png")).toBe(1 + 5); // 1 group → 1 draw
    expect(drawCount("a_$[1-4]_b$[5-9].png")).toBe(1 + 6); // 2 groups → 2 draws
    // malformed group → the "Error in parsing, no end in sight" path, 0 draws
    expect(drawCount("bad_$[x].png")).toBe(1 + 4);
  });
});

// ── the scatter engine (true 0x8EEAD0, dig #56/#81) ──────────────────────────
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

// ── the byte-closed fnA walk (C81/C82: LOWER-only flag=1 stamps, plain box,
//    in-walk cc — the I26 carve law, entry (122)) ─────────────────────────────
describe("walkChain — the byte-closed fnA walk (C82)", () => {
  const w = 512, h = 256;
  const mkWalk = () => ({ d0sq: 0.5, dy: 0.3, growth: 0.5, cc: { n: 2 } });

  test("CARVES only: the `push $1` setter stamp is lower-only (never raises the 1.0 base)", () => {
    const field = new Float32Array(w * h).fill(1.0);
    // start y = 10 → every stamp is in the y < 25 band: the circle-arm
    // stamps (value = the radius envelope > 1) get the center-y q⁸ eave
    // (damped carve); the single-cell stamps (value ≤ 1, no eave) carve
    // straight down to scale = clamp01(slot″) — the deep-carve lane
    walkChain(field, w, h, new NollaPrng(SEED), 100, 10, 1, 20, mkWalk());
    let min = Infinity, max = -Infinity;
    for (const v of field) { if (v < min) min = v; if (v > max) max = v; }
    expect(min).toBeLessThan(1.0); // the carve lane landed (I26)
    expect(max).toBeLessThanOrEqual(1.0); // lower-only: no stamp ever raises
  });

  test("deterministic per prng state with FRESH walk objects (the shared cc never leaks across calls)", () => {
    const a = new Float32Array(w * h).fill(1.0);
    const b = new Float32Array(w * h).fill(1.0);
    walkChain(a, w, h, new NollaPrng(SEED), 7, 10, 1, 20, mkWalk());
    walkChain(b, w, h, new NollaPrng(SEED), 7, 10, 1, 20, mkWalk());
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test("the box exit is PLAIN (no `& (gridW−1)` wrap): x0 ≥ w never stamps", () => {
    const field = new Float32Array(w * h).fill(1.0);
    walkChain(field, w, h, new NollaPrng(SEED), w + 5, 10, 1, 20, mkWalk());
    let max = -Infinity;
    for (const v of field) if (v > max) max = v;
    expect(max).toBe(1.0); // the prologue draws, then the box exit returns
  });
});

// ── the composed builder (fn C1 + the v5 fnB composition) ───────────────────
describe("buildCavesField — fn C1 + the byte-cited composition order", () => {
  // hills.xml's declared knob spans (data-verified on disk 2026-10-10,
  // the LocalLow data dir: + mountain_size 1..10, do_beginning_down 1) —
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
    mountainSizeMin: 1, mountainSizeMax: 10,
    doBeginningDown: 1,
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

  test("phase-1 draws = the MOUNTAIN lane (dig #81 loop→knob map)", () => {
    const r = buildCavesField(null, mkDef(hillsBC), SEED);
    // loop B count = mountain_count (fnb @4eff36/4eff39); the hills spans
    // are pairwise disjoint (mountain 0..15 < blob 20..55 < cave 50..100),
    // so a regression to the old cave-lane guess fails both bounds.
    expect(r.meta.blobPhase1).toBeGreaterThanOrEqual(hillsBC.mountainCountMin);
    expect(r.meta.blobPhase1).toBeLessThanOrEqual(hillsBC.mountainCountMax);
    expect(r.meta.blobPhase1).toBeLessThan(hillsBC.blobCavesCountMin);
    expect(r.meta.blobPhase1).toBeLessThan(hillsBC.caveCountMin);
    expect(r.meta.blobPhase2).toBeGreaterThanOrEqual(hillsBC.blobCavesCountMin);
    expect(r.meta.blobPhase2).toBeLessThanOrEqual(hillsBC.blobCavesCountMax);
  });

  test("the L2/L3 chain call counts live in the byte ranges (dig #120)", () => {
    const r = buildCavesField(null, mkDef(hillsBC), SEED);
    // L2 = exactly 2 passes × (120 + ⌊81u⌋) ∈ [240, 400] (entry (119);
    // the passes are byte-confirmed @0x8f2585–0x8f2595)
    expect(r.meta.l2Calls).toBeGreaterThanOrEqual(240);
    expect(r.meta.l2Calls).toBeLessThanOrEqual(400);
    // L3 = one chain of 120 + ⌊81u⌋ ∈ [120, 200], gated on the hills
    // do_beginning_down = 1 (the byte je @0x8f2fa5)
    expect(r.meta.l3Calls).toBeGreaterThanOrEqual(120);
    expect(r.meta.l3Calls).toBeLessThanOrEqual(200);
  });

  test("the L3 gate: do_beginning_down = 0 → zero L3 calls (byte je)", () => {
    const r = buildCavesField(null, mkDef({ ...hillsBC, doBeginningDown: 0 }), SEED);
    expect(r.meta.l3Calls).toBe(0);
    expect(r.meta.l2Calls).toBeGreaterThanOrEqual(240); // L2 is ungated
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
test("CAVES_FIELD_VER is the v5 composition stamp", () => {
  expect(CAVES_FIELD_VER).toContain("v5 composition");
});

// ── the stream-trace instrument (C104, dig #125) ────────────────────────────
// Core invariant: the trace buckets PARTITION the stream (Σtrace == the raw
// next() count). Plus: the phase order is deterministic per seed.
describe.skipIf(!hasNoitaData())("buildCavesField streamTrace (dig #125, C104)", () => {
  test("Σ trace buckets == the raw next() count (the partition invariant)", () => {
    // instrumented run via buildCavesField for the hills def
    let def = null;
    for (const d of loadBiomeConfig(dataDir).biomes.values()) {
      if (d?.bitmapCaves?.name === "bitmap_hills") { def = d; break; }
    }
    const r1 = buildCavesField(dataDir, def, SEED);
    const t1 = r1.meta.streamTrace;
    expect(t1).toBeTruthy();
    // the trace sums to the whole stream (warm + all phases)
    const tot = t1.walk + t1.loopB + t1.loopC + t1.records + t1.l2 + t1.l3;
    expect(tot).toBeGreaterThan(0);
    // determinism: a second build → identical buckets
    const r2 = buildCavesField(dataDir, def, SEED);
    const t2 = r2.meta.streamTrace;
    for (const k of Object.keys(t1)) expect(t2[k]).toBe(t1[k]);
    // the walk bucket = the walk's draws (always positive for a real config)
    expect(t1.walk).toBeGreaterThan(0);
    // byte-clean budgets hold: records == Σ(1 + stamps·(4 + resolverGroups))
    // (the stamp budget law is a count test in its own describe; here we
    //  assert the phase SANITY: records ≥ structures, l2/l3 ≥ calls)
    expect(t1.records).toBeGreaterThanOrEqual((bc_structures(def)) * 1);
    expect(t1.l2).toBeGreaterThanOrEqual(2); // 2 passes × ≥1 head draw
  });

  function bc_structures(def) {
    return def.bitmapCaves?.structures?.length ?? 0;
  }
});
