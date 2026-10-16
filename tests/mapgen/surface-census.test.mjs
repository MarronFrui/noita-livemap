// tests/mapgen/surface-census.test.mjs — dig #98 (Phase 5 step 1): the
// Phase-0 census as unit fixtures + the surfaceField switch/tail frame
// pins (CONSTANTS C77).
//
// Layer 1 (data-gated): per-P1-file <Topology> census. The five cells
// the (82)-era census had wrong are pinned against the extracted XMLs
// (the engine's own input, per the AGENTS data-source rule):
//   ① noise_type is NOT uniform — winter + winter_caves (and
//      mountain_center + pyramid) have NO noise_type ⇒ uidFrom:114
//      yields noiseKind −1 for those lanes;
//   ② mountain_lake mGradientStartY = "-835" (not -1024);
//   ③ mGradientAddNoise = "0" for hills_flat + mountain_lake (the live
//      default-arm values — laboratory too, outside this 30-file P1 set);
//   ④ desert mMultiplierGradient = "0.881426" (not 0.871429);
//   ⑤ mountain_center + pyramid carry a <Topology> WITHOUT the
//      mGradient/noise block (element present, attrs all null).
// Plus: MC/mx/mn literals, the band fold (buildMaterialsTable vs an
// independent f32 extremum fold over the literal mx/mn arrays), a zero
// is_polygon/celldata tripwire, and loadBiomeConfig parser-chain pins
// for the def fields uidFrom actually reads (uidFrom itself is not
// exported — the consequence is pinned two-sided below).
//
// Layer 2 (port-only, always runs): frame pins at (xd, yd) = (−7.5, 3.5)
// with gradAt ≡ 10 ⇒ field0 = 10 (≥ KERNEL 0.5) ⇒ rp = f(s·10), where s
// is the BAND-RAMP r (true 0x90B280, dig #142 — replaces the
// noiseDispatch surrogate): fixture band (−100,100), mode 1,
// gradNoiseScale 0 ⇒ params exactly (−100,100) (core(0,0)=0), no seam
// at this frame (lx = 504 > 41) ⇒ t = f(103.5/200) = 0.5175 ⇒ rp ≈
// 5.1749997 > 0.85 (the comiss precondition is asserted in-test):
//   - origin identity: band (100,200) ⇒ A ≥ y = 0 ⇒ r = 0.0 DIRECT (the
//     gate's first return) ⇒ every addNoise lane, incl. the live default
//     arm (0), returns 0 with NO throw (switch never entered);
//   - winter consequence: census attr null → uidFrom noiseKind −1 →
//     insidePerlin dispatch throws kind=-1 (two-sided pin; reachable now
//     only with gradWCoef ≠ 0 — the rp gate passes with rp ≈ 5);
//   - old-law discriminators: the surrogate f(noiseDispatch(5,x,y)·10)
//     is 0.9005438 at the probe frame and ≠ 0 at (0,−5000), while the
//     band law gives 5.1749997 and exactly 0 (band (−1024,1024), A ≥ y);
//   - default arm byte-tail pin (I20②, dig #113): live addNoise 0 +
//     stale 4 both COMPUTE the byte chain a = parityLattice2d(x·0.025,
//     y·0.025), g = a·0.05+0.05, n = simplex2d(x·0.5·0.02·g, y·0.5·0.02·g)
//     [the f32 slot K2.h02 @0x11df908, NOT case-1's f64_002], r2 =
//     f(n·rp), C77 tail — no throw anymore — plus a whiteLattice-
//     substituted sensitivity (C83 vs C40: the parity weight mix);
//   - lanes 1/3: byte-tail pins — expected = the byte-exact chain
//     rpost = f(f(f(r2−rp)·f((rp−0.85)/0.1))+rp), r2 = f(n·rp) — plus
//     an old-sign discriminator (the pre-fix port computed (rp−r2) with
//     unrounded t/add; separated by ≳0.1 at this frame);
//   - lane 2: r2 = f(n) BARE (case-2 jmp 0x90b079 skips the mulsd
//     @0x90b075) with a sensitivity assert vs the r2 = f(n·rp) variant;
//   - cross-lane distinctness + evaluator2(·,·,0.5) ≡ 0.5 (arg3 = field).
//
// Sources re-read this session: /tmp/opencode/fulltext86.asm (switch
// @0x90ab48..0x90b0fb), /tmp/opencode/rdata.bin (PE consts), census98b
// literals; code: noise-proto.mjs surfaceField :596.., evaluator2 :341,
// FINAL :703; uidFrom (noise-terrain.mjs) :111-132; biomes.mjs :88-132.
// dig #142: the r-site source = bandRampEval (true 0x90B280 full window
// fresh-dumped this session, X82); the band fixtures below mirror
// bandBlockOf (noise-terrain.mjs) field-for-field.

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  K,
  K2,
  evaluator2,
  whiteLattice2d,
  parityLattice2d,
  fnvLattice2d,
  simplex2d,
  simplex2DDeriv,
  noiseDispatch,
  surfaceField,
  bandRampEval,
} from "../../mapgen/lib/noise-proto.mjs";
import {
  componentFromXml,
  buildMaterialsTable,
} from "../../mapgen/lib/surface-level.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

const f = Math.fround;

// ---------------------------------------------------------------------------
// Layer 1 — the P1 census (30 files; names = the Phase-0 census list).
// tuple A = [noise_type, StartY, EndY, HighNoise, LowNoise, NoiseScale,
//            AddNoise, mMultiplierGradient, bitmap_noise_file]
// (null = the attr is ABSENT from <Topology>). Values are the exact XML
// strings (census98b literals, re-extracted this session).
// ---------------------------------------------------------------------------
const HILL = ["SIN_CAPPED_SIMPLEX", "-1024", "1024", "234.057", "-292.571", "0.00128571", "1", "0.871429", null];
const H2 = ["SIN_CAPPED_SIMPLEX", "-1024", "1024", "75.123", "-12.0564", "0.0068571", "2", "0.871429", null];
const HFLAT = ["SIN_CAPPED_SIMPLEX", "-750", "1024", "234.057", "-292.571", "0.00128571", "0", "0.871429", null];
const DES = ["SIN_CAPPED_SIMPLEX", "-1024", "1024", "100.123", "-100.123", "0.00128571", "1", "0.881426", null];
const MTOP = ["SIN_CAPPED_SIMPLEX", "-1024", "1024", "100.123", "-100.123", "0.00128571", "1", "0.871429", null];
const WIN = [null, "-1024", "1024", "234.057", "-292.571", "0.00128571", "1", "0.871429", null];
const LAKE = ["SIN_CAPPED_SIMPLEX", "-1024", "1024", "134.057", "-292.571", "0.00128571", "3", "0.871429", "data/biome_impl/topology_lake.png"];
const MLAKE = ["SIN_CAPPED_SIMPLEX", "-835", "1024", "234.057", "-292.571", "0.00128571", "0", "0.871429", null];
const NONE = [null, null, null, null, null, null, null, null, null];
const PYR = ["SIN_CAPPED_SIMPLEX", "-1024", "1024", "100.123", "-100.123", "0.00128571", "1", "0.871429", null];
const PTOP = ["SIN_CAPPED_SIMPLEX", "-1024", "1024", "234.057", "-292.571", "0.00128571", "1", "0.871429", null];

// mx/mn literal families (material_max / material_min, file order).
const H6 = [0.55, 0.53, 0.95, 1.2, 1.25, 3.5];
const H6N = [0.51, 0.45, 0.53, 1.1, 1.05, 0.9];
const H7 = [0.55, 0.53, 0.95, 1.2, 1.25, 1.2, 3.5];
const H7N = [0.51, 0.45, 0.53, 1.1, 1.05, 1.05, 0.9];
const H4 = [0.55, 0.53, 0.95, 3.5];
const H4N = [0.51, 0.45, 0.53, 0.9];
const D8 = [0.48, 0.6, 0.73, 0.95, 1.25, 0.95, 3.5, 3.5];
const D8N = [0.45, 0.48, 0.59, 0.72, 1.05, 0.68, 0.9, 0.9];
const W7 = [2.55, 0.9, 0.9, 0.95, 1.2, 1.25, 3.5];
const W7N = [0.5, 0.35, 0.35, 0.53, 1.1, 1.05, 0.9];
const L5 = [0.5, 0.68, 0.95, 4.95, 5.5];
const L5N = [-1, 0.5, 0.68, 4.68, 4.9];
const MCL = [0.55, 0.53, 1.55, 1.2, 1.25, 1.2, 3.5];
const MCLN = [0.51, 0.45, 0.53, 1.1, 1.05, 1.05, 0.9];
const P4 = [0.55, 1.2, 1, 3.6];
const P4N = [0.45, 1.1, 0.6, 0.8];
const P6 = [0.51, 0.6, 0.73, 0.95, 1.25, 3.5];
const P6N = [0.45, 0.5, 0.59, 0.72, 1.05, 0.9];

const ATTRS = [
  "noise_type",
  "mGradientStartY",
  "mGradientEndY",
  "mGradientHighNoise",
  "mGradientLowNoise",
  "mGradientNoiseScale",
  "mGradientAddNoise",
  "mMultiplierGradient",
  "bitmap_noise_file",
];

// name → [A, MC count, mx, mn]
const FILES = {
  hills: [HILL, 6, H6, H6N],
  hills2: [H2, 6, H6, H6N],
  hills_flat: [HFLAT, 6, H6, H6N],
  desert: [DES, 8, D8, D8N],
  winter: [WIN, 7, W7, W7N],
  winter_caves: [WIN, 7, W7, W7N],
  lake: [LAKE, 5, L5, L5N],
  lake_blood: [LAKE, 5, L5, L5N],
  lake_deep: [LAKE, 1, [10.5], [-1]],
  lake_statue: [LAKE, 5, L5, L5N],
  mountain_left: [HILL, 7, H7, H7N],
  mountain_left_2: [HILL, 7, H7, H7N],
  mountain_left_3: [HILL, 7, H7, H7N],
  mountain_left_entrance: [HILL, 4, H4, H4N],
  mountain_left_stub: [HILL, 7, H7, H7N],
  mountain_right: [HILL, 7, H7, H7N],
  mountain_right_2: [HILL, 7, H7, H7N],
  mountain_right_entrance: [HILL, 7, H7, H7N],
  mountain_right_entrance_2: [HILL, 7, H7, H7N],
  mountain_right_stub: [HILL, 6, H6, H6N],
  mountain_top: [MTOP, 7, H7, H7N],
  mountain_tree: [HILL, 6, H6, H6N],
  mountain_lake: [MLAKE, 6, H6, H6N],
  mountain_center: [NONE, 7, MCL, MCLN],
  pyramid: [NONE, 4, P4, P4N],
  pyramid_entrance: [PYR, 6, P6, P6N],
  pyramid_hallway: [PYR, 4, P4, P4N],
  pyramid_left: [PYR, 6, P6, P6N],
  pyramid_right: [PYR, 6, P6, P6N],
  pyramid_top: [PTOP, 6, P6, P6N],
};

describe.skipIf(!hasNoitaData())("P1 Topology census (dig #98, data-gated)", () => {
  test.each(Object.entries(FILES))("%s census + band", (name, [A, mc, mx, mn]) => {
    const xml = fs.readFileSync(path.join(dataDir, "biome", `${name}.xml`), "utf-8");

    // ⑤ the Topology element itself (bare for mountain_center/pyramid)
    const m = xml.match(/<Topology\b[^>]*>/);
    expect(m, `${name}: <Topology> present`).not.toBeNull();

    // ①-④ + bitmap: named-attr pins (null = absent from the element)
    for (let i = 0; i < ATTRS.length; i++) {
      const got = m[0].match(new RegExp(`${ATTRS[i]}="([^"]*)"`))?.[1] ?? null;
      expect(got, `${name}.${ATTRS[i]}`).toBe(A[i]);
    }

    // MaterialComponents: count + band fold (buildMaterialsTable vs an
    // independent f32 extremum fold over the literal mx/mn arrays)
    const blocks = xml.match(/<MaterialComponent\b[^>]*>/g) ?? [];
    expect(blocks.length, `${name}: MC count`).toBe(mc);
    const comps = blocks.map((b) => componentFromXml(b));
    const records = comps.map((c, i) => ({ i, name: c.material_name }));
    const table = buildMaterialsTable(comps, { min: 0, max: 0 }, records);
    expect(table.components.length, `${name}: table size`).toBe(mc);
    expect(table.bandMax, `${name}: bandMax`).toBeCloseTo(
      mx.reduce((a, v) => Math.max(a, f(v)), 0),
      7,
    );
    expect(table.bandMin, `${name}: bandMin`).toBeCloseTo(
      mn.reduce((a, v) => Math.min(a, f(v)), 0),
      7,
    );

    // zero is_polygon / celldata in the P1 set (the rare/planter attrs
    // live only on boss_arena/end_wall/lava_90percent/temple_wall)
    expect(/is_polygon=|celldata/.test(xml), `${name}: no planter attrs`).toBe(false);
  });

  test("loadBiomeConfig parser-chain pins (the def fields uidFrom reads)", () => {
    // NOTE: cfg.biomes is COLOR-keyed (first-color-wins), so same-color
    // files (hills_flat, mountain_center) have no entry here — their
    // cells stay pinned by the raw-XML census layer above. The d()
    // helper asserts presence so `?.` can't make a pin vacuous.
    const cfg = loadBiomeConfig(dataDir);
    const d = (b) => {
      const def = [...cfg.biomes.values()].find((x) => x.filename?.endsWith(b));
      expect(def, `${b} in cfg.biomes`).toBeDefined();
      return def;
    };
    // winter/winter_caves: noise_type absent ⇒ uidFrom:114 noiseKind −1
    // (the dispatch consequence is pinned two-sided in the frame layer)
    expect(d("winter.xml").noiseType, "winter.noiseType").toBeUndefined();
    expect(d("winter.xml").mGradientAddNoise, "winter.AddNoise").toBe("1");
    expect(d("winter_caves.xml").noiseType, "winter_caves.noiseType").toBeUndefined();
    // hills + the (82)-fix cells through the real parser
    expect(d("hills.xml").noiseType).toBe("SIN_CAPPED_SIMPLEX");
    expect(d("hills.xml").mGradientStartY).toBe("-1024");
    expect(d("hills.xml").mMultiplierGradient).toBe("0.871429");
    expect(d("mountain_lake.xml").mGradientStartY, "mountain_lake.StartY").toBe("-835");
    expect(d("mountain_lake.xml").mGradientAddNoise, "mountain_lake.AddNoise").toBe("0");
    expect(d("desert.xml").mMultiplierGradient, "desert.MultGrad").toBe("0.881426");
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — port-only frame pins (C77). Frame: (−7.5, 3.5), gradAt ≡ 10.
// uid mirror = uidFrom (noise-terrain.mjs) incl. the dig-#142 band-block
// spread + driver attach; gradWCoef 0 is a legal byte state (+0x268 guard
// skips the insidePerlin lane) and isolates the FINAL to f(P·rpost) so the
// tail is pinned cleanly.
// ---------------------------------------------------------------------------
const XD = -7.5;
const YD = 3.5;
const G10 = () => 10; // field0 = 10 ≥ KERNEL ⇒ rp = f(s·10)

// band fixture = bandBlockOf's field set (noise-terrain.mjs, dig #142);
// gradNoiseScale 0 ⇒ mode-1 core(0·xr, 0·A) = core(0,0) = 0 exactly
// (verified: all four zero-sign variants return 0), so params are the
// (A, B) pair bit-exactly.
const BAND = (A, B, over = {}) => ({
  gradStartY: A,
  gradEndY: B,
  gradSlopeStartX: 0,
  gradSlopeDelta: 0.01,
  mode: 1,
  gradNoiseScale: 0,
  gradLowNoise: -100,
  gradHighNoise: 100,
  ...over,
});
// driver fixture = makeBandDriver's frame (all indexes hit the one band
// so the seam's cellAt reads pointer-identity-equal → the blend skips)
const drvOf = (band) => ({
  baseX: 17920,
  baseY: 7168,
  w: 70,
  h: 48,
  bandCount: 3360,
  xBase: 0,
  bandAt: () => band,
  cellAt: () => band,
});
const uidOf = (over = {}) => ({
  ...BAND(-100, 100), // the band-block spread uidFrom now carries (dig #142)
  driver: drvOf(BAND(-100, 100)), // the r-site frame (dig #142)
  noiseKind: 5,
  gradient: 0,
  sx: 1,
  sy: 1,
  ox: 0,
  oy: 0,
  offsetBySeed: false,
  fbm: false, // explicit probe value — the attr law defaults fbm ON (dig #145), but gradWCoef 0 below guards the insidePerlin lane off
  squared: false,
  clamped: false,
  scaled: false,
  scaleMin: 0.057143,
  scaleMax: 2,
  gradWCoef: 0, // +0x268 lane guarded off (byte ucomiss test)
  perlinCoef: 0.871429, // hills mMultiplierGradient [+0x264]
  addValue: 0,
  addNoise: 1,
  minX: 0,
  maxX: 0,
  ...over,
});
// rp = f(r·10) with r = the band-ramp law (true 0x90B280, dig #142):
// at the probe frame the table path resolves the fixture band with no
// seam (lx = 504 > 41) ⇒ r = f(103.5/200), rp = 5.1749997.
const RAMP_UID = uidOf();
const rpAt = (x, y) => f(bandRampEval(RAMP_UID.driver, RAMP_UID, x, y) * 10);
const rpPre = (x, y) => {
  const rp = rpAt(x, y);
  expect(rp).toBeGreaterThan(0.85); // comiss 0x11dfb84 @0x90ab48 precondition
  return rp;
};
// byte-exact tail: subss @0x90b08b → divss @0x90b08f → mulss @0x90b097
// → addss @0x90b09b (C77)
const tail = (r2, rp) => f(f(f(r2 - rp) * f((rp - K2.h085) / K.wBias)) + rp);
// FINAL (noise-proto :703) with gradWCoef 0 / addValue 0:
// out = f(0·gradW·per) + f(P·rpost) + 0
const expOut = (rpost) => f(0.871429 * rpost);
// the pre-fix port tail: sign-flipped (rp − r2), unrounded t and add
const oldTail = (r2, rp) => f(f(rp - r2) * ((rp - K2.h085) / K.wBias)) + rp;

describe("surfaceField switch/tail frame pins (dig #98, port-only)", () => {
  test("evaluator2(·,·,0.5) ≡ 0.5 (the third arg is the field)", () => {
    for (const [x, y] of [
      [0, 0],
      [XD, YD],
      [12.25, -3.75],
    ]) {
      expect(evaluator2(x, y, 0.5)).toBe(0.5);
    }
  });

  test("origin identity: band (100,200) ⇒ A ≥ y=0 ⇒ r = 0.0 DIRECT ⇒ lanes 1/2/3 + live default arm all return 0, no throw", () => {
    // dig #142: the origin's zero now comes from the ramp gate's FIRST
    // return (A ≥ y, ordered) — no table arithmetic, no surrogate needed
    const O = () => uidOf({ ...BAND(100, 200), driver: drvOf(BAND(100, 200)) });
    const o = O();
    expect(bandRampEval(o.driver, o, 0, 0)).toBe(0);
    expect(f(bandRampEval(o.driver, o, 0, 0) * 10)).toBe(0);
    for (const an of [0, 1, 2, 3, 4]) {
      expect(surfaceField(uidOf({ ...BAND(100, 200), addNoise: an, driver: drvOf(BAND(100, 200)) }), 0, 0, G10, 0, 0), `lane ${an}`).toBe(0);
    }
  });

  test("old-r surrogate discriminator (dig #142): the band law replaces noiseDispatch", () => {
    // probe frame: the band law gives rp = 5.1749997; the pre-dig-#142
    // surrogate f(noiseDispatch(5,x,y)·10) gives 0.9005438 — same test
    // inputs, different law ⇒ a replacement test that FAILS under the
    // old arithmetic (rpAt's value would be the surrogate's)
    expect(rpAt(XD, YD)).not.toBe(f(noiseDispatch(5, XD, YD) * 10));
    expect(rpAt(XD, YD)).toBe(5.174999713897705);
    // (0,−5000): band (−1024,1024) ⇒ A ≥ y ⇒ r = 0 EXACTLY (the gate's
    // first return) while the surrogate is ≈ −2.941 there — the count
    // law on the 0-arm at an out-of-range y
    const H = uidOf({ ...BAND(-1024, 1024), driver: drvOf(BAND(-1024, 1024)) });
    expect(bandRampEval(H.driver, H, 0, -5000)).toBe(0);
    expect(f(noiseDispatch(5, 0, -5000) * 10)).not.toBe(0);
  });

  test("winter consequence: census noise_type null ⇒ noiseKind −1 ⇒ kind=-1 throw (two-sided)", () => {
    expect(() => noiseDispatch(-1, 0, 0)).toThrow(/kind=-1/);
    // gradWCoef 1 makes the rp > 0.51 lane REACH insidePerlin (with the
    // default 0 the +0x268 guard skips it — rp ≈ 5 passes the gate)
    expect(() => surfaceField(uidOf({ noiseKind: -1, gradWCoef: 1 }), 0, 0, G10, 0, 0)).toThrow(/kind=-1/);
    // guarded-off side: gradWCoef 0 ⇒ no dispatch ⇒ no throw (two-sided)
    expect(() => surfaceField(uidOf({ noiseKind: -1, gradWCoef: 0 }), 0, 0, G10, 0, 0)).not.toThrow();
  });

  test("default arm byte-tail pin (I20②): live 0 + stale 4 compute, no throw", () => {
    const rp = rpPre(XD, YD);
    const a = parityLattice2d(f(XD * K2.h025), f(YD * K2.h025));
    const g = f(a * K2.h05 + K2.h05);
    const n = simplex2d(f(XD * K.KERNEL) * K2.h02 * g, f(YD * K.KERNEL) * K2.h02 * g);
    const exp = expOut(tail(f(n * rp), rp));
    for (const an of [0, 4]) {
      expect(surfaceField(uidOf({ addNoise: an }), XD, YD, G10, 0, 0), `lane ${an}`).toBeCloseTo(
        exp,
        7,
      );
    }
    // sensitivity: the arm's lattice is parityLattice2d (C83), NOT the
    // plain-smoothstep whiteLattice2d (C40). The substitution moves the
    // LATTICE input by ≈1.28e-2 at this frame and the pinned output by
    // ≈9.2e-5 (the g → simplex → tail chain compresses it), so both
    // asserts are stated at their own measured scale.
    const aPlain = whiteLattice2d(f(XD * K2.h025), f(YD * K2.h025));
    expect(Math.abs(a - aPlain)).toBeGreaterThan(1e-3);
    const gPlain = f(aPlain * K2.h05 + K2.h05);
    const nPlain = simplex2d(f(XD * K.KERNEL) * K2.h02 * gPlain, f(YD * K.KERNEL) * K2.h02 * gPlain);
    expect(Math.abs(exp - expOut(tail(f(nPlain * rp), rp)))).toBeGreaterThan(1e-5);
  });

  test("lane 1 byte-tail pin (+ old-sign discriminator)", () => {
    const rp = rpPre(XD, YD);
    const a = whiteLattice2d(f(XD * K2.h025), f(YD * K2.h025));
    const g = f(a * K2.h05 + K2.h05);
    const n = simplex2DDeriv(
      f(XD * K.KERNEL) * K2.f64_002 * g,
      f(YD * K.KERNEL) * K2.f64_002 * g,
    );
    const exp = expOut(tail(f(n * rp), rp));
    expect(Math.abs(exp - expOut(oldTail(f(n * rp), rp)))).toBeGreaterThan(1e-3);
    expect(surfaceField(uidOf({ addNoise: 1 }), XD, YD, G10, 0, 0)).toBeCloseTo(exp, 7);
  });

  test("lane 3 byte-tail pin (+ old-sign discriminator)", () => {
    const rp = rpPre(XD, YD);
    const a = whiteLattice2d(f(XD * K2.f64_002), f(YD * K2.f64_0021));
    const g = f(a * K2.h05 + K2.h05);
    const sCh = Math.sin(YD * K2.one1024) * (1024.0 * 0.5 * 0.06) * g;
    const cCh = Math.acos(XD * K2.one1024) * (1024.0 * 0.5 * 0.06) * g;
    const n = simplex2DDeriv(cCh, sCh);
    const exp = expOut(tail(f(n * rp), rp));
    expect(Math.abs(exp - expOut(oldTail(f(n * rp), rp)))).toBeGreaterThan(1e-3);
    expect(surfaceField(uidOf({ addNoise: 3 }), XD, YD, G10, 0, 0)).toBeCloseTo(exp, 7);
  });

  test("lane 2 byte-tail pin: case-2 r2 = f(n) BARE (sensitivity vs f(n·rp))", () => {
    const rp = rpPre(XD, YD);
    const wl = whiteLattice2d(f(XD / 100.0 * K2.h025), f(YD / 100.0 * K2.h025));
    const fn = fnvLattice2d(f(XD / 100.0 * K2.h0241), f(YD / 100.0 * K2.h0241));
    const s1 = simplex2d(
      f(XD / 100.0 * wl * K2.h02789),
      f(fn * (YD / 100.0) * K2.h02789),
    );
    const aux = f(s1 * wl * K2.f64_5 + K.KERNEL);
    const yCh = Math.acos(XD / 100.0 * K2.f64_001313) * aux + f(fn * K2.hneg20);
    const xCh = Math.sin(YD / 100.0 * K2.f64_001123) * aux + f(wl * K2.hneg20);
    const n = simplex2DDeriv(yCh, xCh);
    const bare = expOut(tail(f(n), rp));
    const mult = expOut(tail(f(n * rp), rp));
    expect(Math.abs(bare - mult)).toBeGreaterThan(1e-4); // the factor is pinned
    expect(surfaceField(uidOf({ addNoise: 2 }), XD, YD, G10, 0, 0)).toBeCloseTo(bare, 7);
  });

  test("cross-lane distinctness at the probe frame", () => {
    const outs = [1, 2, 3].map((an) =>
      surfaceField(uidOf({ addNoise: an }), XD, YD, G10, 0, 0),
    );
    for (const o of outs) expect(Number.isFinite(o)).toBe(true);
    expect(Math.abs(outs[0] - outs[1])).toBeGreaterThan(1e-6);
    expect(Math.abs(outs[1] - outs[2])).toBeGreaterThan(1e-6);
    expect(Math.abs(outs[0] - outs[2])).toBeGreaterThan(1e-6);
  });
});

describe("lattice byte pins (I22 fix + I20② parity core, dig #113)", () => {
  test("whiteLattice2d endpoint pin: (12.5,−3.25) = floor-cell byte-literal; round-cell + endpoint-flip excluded", () => {
    // Byte law re-derived dig #113 with the CORRECT lattice cell: the
    // helper 0x44d0b0 = the CRT `floor` wrapper — thunk 0x1033a52 =
    // `ff 25 [0x114a534]`, IAT 0x114a534 name record = "floor" hint
    // 1646 (PE import dir read this session), NOT C40's "fld/fistp
    // round" gloss. At this point floor ≠ round ⇒
    //   c0 = 57·floor(−3.25) + floor(12.5) = −216   (round: −158)
    //   floor + standard (C91 blend idiom)  = 0.898207068  ← the binary
    //   round + standard                    = 0.493832439  (entry (112)'s
    //                                          literal — STALE, round-derived)
    //   floor + endpoint-inverted           = 0.723673105
    //   round + endpoint-inverted           = 0.833995283 = the pre-fix
    //                                          port = (26)'s smoke "0.834"
    expect(whiteLattice2d(12.5, -3.25)).toBeCloseTo(0.898207068, 6);
    expect(Math.abs(whiteLattice2d(12.5, -3.25) - 0.493832439)).toBeGreaterThan(0.3);
    expect(Math.abs(whiteLattice2d(12.5, -3.25) - 0.723673105)).toBeGreaterThan(0.1);
  });

  test("integer cell (3,5): wx = wy = 0 ⇒ out = h0 = 0.371890724 for BOTH lattices", () => {
    // C91: the binary's value at (3,5) = 0.371890724 = h0; the pre-fix
    // port collapsed to h58 = 0.907893717. parityLattice2d shares the
    // lattice: its parity weights also hit 0 at fx = fy = 0.
    expect(whiteLattice2d(3, 5)).toBeCloseTo(0.371890724, 6);
    expect(parityLattice2d(3, 5)).toBeCloseTo(0.371890724, 6);
  });

  test("parity branches both diverge from the plain-smoothstep lattice", () => {
    // floor(2.25) = 2 even / floor(1.25) = 1 odd ⇒ (w0,w1) = (sf,lin)
    // vs (lin,sf) per C83 (`and 0x80000001` @0x8fb613); whiteLattice2d
    // uses plain sf — both parities must differ (measured ≈1.1e-3 /
    // ≈3.1e-3 at this frame).
    for (const [x, y] of [
      [2.25, 0.25],
      [1.25, 0.25],
    ]) {
      expect(Math.abs(parityLattice2d(x, y) - whiteLattice2d(x, y)), `(${x},${y})`).toBeGreaterThan(
        1e-4,
      );
    }
  });
});
