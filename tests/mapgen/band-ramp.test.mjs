// tests/mapgen/band-ramp.test.mjs — dig #142: the kind-0 band-ramp lane
// count tests. Byte law: r-eval true 0x90B280 (X82, prologue→ret fresh
// this session), params true 0x90B680 (dig137 asm, fresh re-read), fbm
// true 0x9FAD90 (X98, fresh incl. the 9fae16..9fae45 gap), cell accessor
// 0x909C70, frame C119 (baseX 17920 / baseY 7168 / 70x48 / count 3360),
// Phase-S draw 0x10098C0 (Lehmer 16807 mod 2147483647, INV
// 4.656612875e-10 — NOT wang-js's tile LCG).
//
// Structure per the count-test charter: every branch gets 0/1/N counts
// plus the skip path; every replacement/discriminator below FAILS under
// the old arithmetic (pre-#142 = the noiseDispatch surrogate r-site, and
// per-sub-law the no-clamp / unscaled-args / 3-octave / surrogate restat-
// ements). Port-only fixtures — the one data-gated block is marked.
//
// METER-CLASS: n/a — these are E0/E1 byte-law pins (golden literals +
// branch counts), not composed-output meters; no IoU/fG/rms/meanAbs
// numbers are cited here.

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import {
  bandRampEval,
  bandParams,
  fbmGradient,
  surfaceField,
  simplex2DDeriv,
  noiseDispatch,
} from "../../mapgen/lib/noise-proto.mjs";
import { phaseSXBase, makeBandDriver, bandBlockOf } from "../../mapgen/lib/noise-terrain.mjs";
import { loadBiomeConfig, biomeAt } from "../../mapgen/lib/biomes.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

const f = Math.fround;

// ---------------------------------------------------------------------------
// fixtures — bandBlockOf's field set / makeBandDriver's frame, mirror-built
// (bandBlockOf itself is pinned in its own test below).
// ---------------------------------------------------------------------------
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
// driver fixture; xBase defaults 0 (Phase-S pin below). cellAt/bandAt are
// injectable counters so branch counts are observable.
const drvOf = (band, over = {}) => ({
  baseX: 17920,
  baseY: 7168,
  w: 70,
  h: 48,
  bandCount: 3360,
  xBase: 0,
  bandAt: () => band,
  cellAt: () => band,
  ...over,
});
// the uid-as-band config (the two r-eval fallback arms pass it through)
const cfgOf = (over = {}) => ({
  gradStartY: 100,
  gradEndY: 200,
  gradSlopeStartX: 0,
  gradSlopeDelta: 0.01,
  mode: 0,
  gradNoiseScale: 0,
  gradLowNoise: -100,
  gradHighNoise: 100,
  ...over,
});

describe("ramp gates: 0/1/N + B===A + NaN (true 0x90B280 tail)", () => {
  // const band (100,200) mode 0 — params exact, so every expectation is
  // the gate law alone: t = f((y−A)/(B−A)) (one f32 rounding of the f64
  // chain = divsd+cvtpd2ps)
  const d = drvOf(BAND(100, 200, { mode: 0 }));
  const uid = cfgOf();
  const r = (y) => bandRampEval(d, uid, 0, y);

  test("0-arm: y ≤ A returns 0.0 exactly (2 boundaries + N below)", () => {
    expect(r(99)).toBe(0);
    expect(r(100)).toBe(0); // A ≥ y is inclusive
    for (const y of [-4000, -7.5, 0, 50, 99.99999]) {
      expect(r(y), `y=${y}`).toBe(0);
    }
  });

  test("1-arm: y ≥ B returns 1.0 exactly (2 boundaries + N above)", () => {
    expect(r(200)).toBe(1); // y ≥ B inclusive
    expect(r(200.00001)).toBe(1);
    for (const y of [201, 1000, 379, 379.999]) {
      expect(r(y), `y=${y}`).toBe(1);
    }
  });

  test("t-arm: A < y < B matches the single-rounding restatement (N samples)", () => {
    for (const y of [100.001, 125, 150, 175.5, 199.999]) {
      expect(r(y), `y=${y}`).toBe(f((y - 100) / (200 - 100)));
    }
    expect(r(150)).toBe(f(50 / 100));
    expect(r(150)).toBe(0.5); // exact: 0.5 is representable
  });

  test("B===A arm: only reachable via unordered compares (y = NaN) → 1.0", () => {
    // finite y can never reach it (A ≥ y or y ≥ B always fires first when
    // A === B) — the ucomisd+lahf idiom's reachable corner:
    const dEq = drvOf(BAND(150, 150, { mode: 0 }));
    expect(bandRampEval(dEq, cfgOf(), 0, NaN)).toBe(1);
    // 0/1/N over the A === B band values
    for (const v of [-1024, 0, 0.5, 1024]) {
      const dv = drvOf(BAND(v, v, { mode: 0 }));
      expect(bandRampEval(dv, cfgOf(), 0, NaN), `A=B=${v}`).toBe(1);
    }
  });

  test("NaN y with A ≠ B falls to t → NaN (the unordered pass-through, 0-count of the 0/1 arms)", () => {
    const y = r(NaN);
    expect(Number.isNaN(y)).toBe(true);
    // count: neither 0-arm nor 1-arm fired (they would be 0/1 exactly)
    expect(y).not.toBe(0);
    expect(y).not.toBe(1);
  });
});

describe("config arms: y > 380 / bandCount === 0 + boundary counts", () => {
  test("y > 380 uses the uid-as-band params (t value pins the config band, not the table band)", () => {
    // config band (0,500); table band would be (−100,100) → different t
    const uid = cfgOf({ gradStartY: 0, gradEndY: 500 });
    const d = drvOf(BAND(-100, 100, { mode: 0 }));
    expect(bandRampEval(d, uid, 0, 400)).toBe(f((400 - 0) / (500 - 0))); // config arm
    // N samples above 380, all against the config band
    for (const y of [380.0001, 390, 450, 1e6]) {
      const got = bandRampEval(d, uid, 0, y);
      const viaConfig = y >= 500 ? 1 : f((y - 0) / (500 - 0));
      expect(got, `y=${y}`).toBe(viaConfig);
    }
    // y = 1e6: ≥ B → 1 via the gate (still the config arm)
    expect(bandRampEval(d, uid, 0, 1e6)).toBe(1);
  });

  test("boundary count: y = 380 exactly → TABLE; y > 380 → config (bandAt call counter)", () => {
    let calls = 0;
    const d = drvOf(BAND(-100, 100, { mode: 0 }), { bandAt: () => { calls++; return BAND(-100, 100, { mode: 0 }); } });
    const uid = cfgOf({ gradStartY: 0, gradEndY: 500 });
    // y = 380: NOT > 380 → table path → bandAt called once
    bandRampEval(d, uid, 0, 380);
    expect(calls).toBe(1);
    // y = 380 + 2**-10 (> in f64): config arm → bandAt NOT called
    bandRampEval(d, uid, 0, 380 + 2 ** -10);
    expect(calls).toBe(1);
    // NaN y: unordered → falls to the COUNT path → table (bandAt called)
    bandRampEval(d, uid, 0, NaN);
    expect(calls).toBe(2);
    // and the NaN result comes from the TABLE band (A ≠ B → NaN gate t)
    expect(Number.isNaN(bandRampEval(d, uid, 0, NaN))).toBe(true);
  });

  test("bandCount === 0 → the config fallback, table skipped (0-count bandAt)", () => {
    let calls = 0;
    const d = drvOf(BAND(-100, 100, { mode: 0 }), {
      bandCount: 0,
      bandAt: () => { calls++; return BAND(-100, 100, { mode: 0 }); }, // must not run
      cellAt: () => { throw new Error("cellAt must not run on the count==0 arm"); },
    });
    const uid = cfgOf({ gradStartY: 0, gradEndY: 500 });
    expect(bandRampEval(d, uid, 0, 250)).toBe(f((250 - 0) / (500 - 0)));
    // N samples on the fallback arm, 0 table reads
    for (const y of [0, 100, 250, 379]) {
      const got = bandRampEval(d, uid, 0, y);
      expect(got, `y=${y}`).toBe(y >= 500 ? 1 : y <= 0 ? 0 : f(y / 500));
    }
    expect(calls).toBe(0);
    // both arms of a count==0 driver read the config band (y > 380 is
    // checked first — same config value either way, 0 table reads)
    expect(bandRampEval(d, uid, 0, 400)).toBe(f(400 / 500)); // t arm of the config band
    expect(bandRampEval(d, uid, 0, 600)).toBe(1); // y ≥ B → 1
    expect(calls).toBe(0);
  });

  test("count > 0 + y ≤ 380 → table (the skip path of both config arms)", () => {
    let calls = 0;
    const d = drvOf(BAND(-100, 100, { mode: 0 }), { bandAt: () => { calls++; return BAND(-100, 100, { mode: 0 }); } });
    bandRampEval(d, cfgOf({ gradStartY: 0, gradEndY: 500 }), 0, 3.5);
    expect(calls).toBe(1);
    expect(calls).toBeGreaterThan(0); // the config arms were skipped (0-count for them)
  });
});

describe("left seam: fl = f(1 − f(lx/41)), identity skip, branch counts", () => {
  // own (0,1000), distinct neighbor (−500,500), both mode 0; y = 3.5 →
  // t arm; x = lx picks the tile-local offset (ox = 17920 + lx)
  const own = BAND(0, 1000, { mode: 0 });
  const nb = BAND(-500, 500, { mode: 0 });
  const uid = cfgOf();
  const flOf = (lx) => f(1 - f(lx / 41)); // the byte weight (divss 41 @0x90b55b..581)
  const blendR = (lx) => {
    const fl = flOf(lx);
    const A = 0 + fl * (-500 - 0);
    const B = 1000 + fl * (500 - 1000);
    return f((3.5 - A) / (B - A));
  };

  test("seam ON (lx 0..41): N samples match the fl blend; fl(0)=1 → full neighbor", () => {
    let cellCalls = 0;
    const d = drvOf(own, { cellAt: () => { cellCalls++; return nb; } });
    expect(flOf(0)).toBe(1); // f(1 − f(0)) — full neighbor weight
    expect(bandRampEval(d, uid, 0, 3.5)).toBe(blendR(0)); // lx = 0
    expect(bandRampEval(d, uid, 20, 3.5)).toBe(blendR(20));
    for (let lx = 0; lx <= 41; lx++) {
      expect(bandRampEval(d, uid, lx, 3.5), `lx=${lx}`).toBe(blendR(lx));
    }
    expect(cellCalls).toBe(44); // 2 probes + the 42 lx samples (one cellAt per seam eval)
    // fl(41) = f(1 − f(41/41)) = 0 → neighbor contributes nothing
    expect(flOf(41)).toBe(0);
    expect(bandRampEval(d, uid, 41, 3.5)).toBe(f((3.5 - 0) / (1000 - 0)));
    // blend differs from both endpoints at partial weight (the branch is
    // actually doing arithmetic, not clamping)
    expect(blendR(20)).not.toBe(f(3.5 / 1000)); // ≠ own
    expect(blendR(20)).not.toBe(f((3.5 + 500) / 1000)); // ≠ full neighbor
  });

  test("seam OFF (lx = 42): 0 cellAt calls, own params exactly", () => {
    let cellCalls = 0;
    const d = drvOf(own, { cellAt: () => { cellCalls++; return nb; } });
    expect(bandRampEval(d, uid, 42, 3.5)).toBe(f(3.5 / 1000));
    for (const lx of [42, 100, 511]) {
      expect(bandRampEval(d, uid, lx, 3.5), `lx=${lx}`).toBe(f(3.5 / 1000));
    }
    expect(cellCalls).toBe(0);
  });

  test("identity skip: nb === own object → params read once (blend skipped), value = own", () => {
    let cellCalls = 0;
    const d = drvOf(own, { cellAt: () => { cellCalls++; return own; } });
    expect(bandRampEval(d, uid, 20, 3.5)).toBe(f(3.5 / 1000)); // own, not blended
    expect(bandRampEval(d, uid, 20, 3.5)).not.toBe(blendR(20));
    expect(cellCalls).toBe(2); // cellAt still runs — only the params read is skipped
  });
});

describe("table index: col wrap + row clamp (0/1/N + no-law discriminators)", () => {
  // index-keyed bands: bandAt(idx) → A = idx − 100000, B = idx + 100000
  // (mode 0, width 200000 so the t-arm stays reachable at every y probed,
  // including the y = 30000 row-clamp sample)
  const W = 100000;
  const idxBand = (idx) => BAND(idx - W, idx + W, { mode: 0 });
  const idxDriver = () => drvOf(null, {
    bandAt: (idx) => idxBand(idx),
    cellAt: () => { throw new Error("cellAt must not run (lx > 41 probes)"); },
  });
  const uid = cfgOf();
  // independent restatement of the full law (index + wrap/clamp + gates)
  const idxR = (x, y) => {
    const ox = Math.trunc(17920 + x) | 0;
    const col0 = ox >> 9;
    let col = col0 % 70;
    if (col < 0) col += 70;
    const oy = Math.trunc(7168 + y) | 0;
    let row = Math.min(oy >> 9, 47);
    if (row < 0) row = 0;
    const idx = 70 * row + col;
    const A = idx - W, B = idx + W;
    if (A >= y) return 0;
    if (y >= B) return 1;
    if (B === A) return 1;
    return f((y - A) / (B - A));
  };
  // probes chosen with lx = 100 > 41 → no seam (cellAt throws above)
  const P = (x, y) => bandRampEval(idxDriver(), uid, x, y);

  test("base cell (col 35, row 14) at the standard frame", () => {
    // x = 100 → ox = 18020 → col0 35, lx 100; y = 3.5 → row 14
    expect(P(100, 3.5)).toBe(idxR(100, 3.5));
    expect(P(100, 3.5)).toBe(f((3.5 - (70 * 14 + 35 - W)) / (2 * W)));
  });

  test("col wrap: col0 = −1 → col 69 equals the direct col-69 read (1 wrap vs 0)", () => {
    // x = −18332 → ox = −412 → col0 = −1, lx = 100; y = 3.5 → row 14
    // (the table path only sees y ≤ 380 ⇒ rows 0..14 — see the config-
    // arm test below)
    const wrapped = P(-18332, 3.5);
    const direct = P(17508, 3.5); // ox = 35428 → col0 = 69, lx = 100
    expect(wrapped).toBe(direct);
    expect(wrapped).toBe(idxR(-18332, 3.5));
    // the sign-wrong rem readings differ: col 0 and the raw −1 both give
    // different indexes than the +W fixup's col 69
    expect(wrapped).not.toBe(f((3.5 - ((70 * 14 + 0) - W)) / (2 * W))); // col 0
    expect(wrapped).not.toBe(f((3.5 - ((70 * 14 - 1) - W)) / (2 * W))); // raw col0 = −1
    // N samples across the wrap boundary
    for (const dx of [0, 1, 41, 42, 511]) {
      const xw = -18332 + dx;
      expect(P(xw, 3.5), `x=${xw}`).toBe(idxR(xw, 3.5));
    }
  });

  test("row clamp LOW: row0 < 0 → 0 (1 clamp; the unclamped row differs)", () => {
    const got = P(100, -10000); // oy = −2832 → row0 = −6
    expect(got).toBe(idxR(100, -10000));
    expect(got).toBe(f((-10000 - (70 * 0 + 35 - W)) / (2 * W)));
    // no-clamp discriminator: row −6 → idx −385 → a different t
    const un = 70 * -6 + 35;
    expect(got).not.toBe(f((-10000 - (un - W)) / (2 * W)));
    // N samples below the origin row (incl. one past the 0-arm boundary)
    for (const y of [-7169, -9000, -10000, -20000]) {
      expect(P(100, y), `y=${y}`).toBe(idxR(100, y));
    }
    // 0-arm count at the far end: y below every possible A → exactly 0
    expect(P(100, -400000)).toBe(0);
  });

  test("the y > 380 arm steals every row0 > 14 sample (high clamp = cellAt-only law)", () => {
    // table path is y ≤ 380 ⇒ oy ≤ 7548 ⇒ row0 ≤ 14, so the row0 > 47
    // clamp can NEVER fire through bandRampEval — those y take the config
    // arm first. Pinned two-sided with the bandAt counter:
    let calls = 0;
    const d = drvOf(BAND(-100, 100, { mode: 0 }), {
      bandAt: (idx) => { calls++; return idxBand(idx); },
      cellAt: () => { throw new Error("cellAt must not run (lx > 41)"); },
    });
    const uid = cfgOf();
    for (const y of [381, 5000, 30000]) {
      expect(bandRampEval(d, uid, 100, y), `y=${y}`).toBe(1); // uid (100,200): y ≥ B → 1
    }
    expect(calls).toBe(0); // 0 table reads above the 380 gate
    // and the table path's own boundary row: y = 380 → row 14 (no clamp)
    expect(bandRampEval(d, uid, 100, 380)).toBe(idxR(100, 380));
    expect(calls).toBe(1);
    // the high clamp itself lives in cellAt (0x909C70) — pinned in the
    // data-gated block below (cellAt(0, 999) → row 47)
  });
});

describe("bandParams mode arms (true 0x90B680): 0/1/2/3 + else-arm", () => {
  const d = drvOf(BAND(0, 1, { mode: 0 })); // frame only; xBase below
  const uid = cfgOf();

  test("mode 0: const arm returns (A, B) bit-exactly, coord-independent", () => {
    const b = BAND(-1024, 1024, { mode: 0 });
    expect(bandParams(d, b, 0)).toEqual([-1024, 1024]);
    expect(bandParams(d, b, -18432)).toEqual([-1024, 1024]);
    expect(bandParams(d, b, 1e6)).toEqual([-1024, 1024]);
  });

  test("mode 0 + NULL band → {0,0} (the zeroed out-pair arm)", () => {
    expect(bandParams(d, null, 0)).toEqual([0, 0]);
    expect(bandParams(d, undefined, 7.5)).toEqual([0, 0]);
  });

  test("mode 3: slope on the RAW coord — both outs += (coord − startX)·delta", () => {
    const b = BAND(10, 20, { mode: 3, gradSlopeStartX: -12000, gradSlopeDelta: -0.37 });
    for (const coord of [-7.5, 0, 41, 17920]) {
      const s = (coord - -12000) * -0.37;
      expect(bandParams(d, b, coord), `coord=${coord}`).toEqual([10 + s, 20 + s]);
    }
    // raw-coord discriminator: with a nonzero xBase the xr-based
    // restatement (coord → xBase+coord) gives a different slope
    const dX = { ...d, xBase: 24155.7109375 };
    const raw = bandParams(dX, b, -7.5);
    const viaXr = (24155.7109375 + -7.5 - -12000) * -0.37;
    expect(raw[0]).toBe(10 + (-7.5 - -12000) * -0.37);
    expect(raw[0]).not.toBe(10 + viaXr);
    // y-independence is structural (params take coord only) — pin it
    expect(raw).toEqual(bandParams(dX, b, -7.5));
  });

  test("mode 1: args-scaled core (scale·xr, scale·A) + the scaled-B tail", () => {
    const scale = 0.00128571;
    const b = BAND(10, 20, { mode: 1, gradNoiseScale: scale });
    const coord = -7.5;
    const xr = 0 + coord; // xBase 0
    const out = bandParams(d, b, coord);
    const expA = 10 + simplex2DDeriv(scale * xr, scale * 10) * -100;
    const expB = 20 + simplex2DDeriv(scale * xr, scale * 20) * 100;
    expect(out[0]).toBe(expA);
    expect(out[1]).toBe(expB);
    // args-scaled discriminator: the UNSCALED restatement (xr, A) is a
    // different value — the scale multiplies both args (C114 amendment)
    const unscaled = 10 + simplex2DDeriv(xr, 10) * -100;
    expect(unscaled).not.toBe(expA);
    // the tail's B arg is scale·B (not scale·A — the reload pin)
    const tailW_A = 20 + simplex2DDeriv(scale * xr, scale * 10) * 100;
    expect(expB).not.toBe(tailW_A);
    // count: exactly two core calls per params (out0 + tail) — observe
    // via a mode-1 band with scale 0 ⇒ core(0,0) = 0 ⇒ (A,B) exact
    const b0 = BAND(10, 20, { mode: 1, gradNoiseScale: 0 });
    expect(bandParams(d, b0, coord)).toEqual([10, 20]);
  });

  test("mode 2: fbm OUT0-only (f32 args) + the SHARED core tail (f64 args)", () => {
    const scale = 0.00128571;
    const b = BAND(10, 20, { mode: 2, gradNoiseScale: scale });
    const coord = -7.5;
    const out = bandParams(d, b, coord);
    // out0 = the fbm arm, args f32-rounded before the call (cvtpd2ps @
    // 0x90b732..3c)
    const expA = 10 + fbmGradient(f(scale * coord), f(scale * 10)) * -100;
    expect(out[0]).toBe(expA);
    // out1 = the SHARED TAIL: engine ALWAYS the simplex core with f64
    // args (@0x90b79b → 0x8fc020; the jmp @0x90b74e lands mode 2 on the
    // same tail head @0x90b77f) — the pre-#142 fbm-tail expectation
    // FAILS here
    const expB = 20 + simplex2DDeriv(scale * coord, scale * 20) * 100;
    expect(out[1]).toBe(expB);
    expect(out[1]).not.toBe(20 + fbmGradient(f(scale * coord), f(scale * 20)) * 100);
    // shared-tail identity: mode 1 and mode 2 tails are the SAME code
    // path — same band ⇒ bit-identical out1 (1-count discriminator vs
    // the old "mode-2 tail = fbm" law)
    const b1 = BAND(10, 20, { mode: 1, gradNoiseScale: scale });
    expect(bandParams(d, b1, coord)[1]).toBe(out[1]);
    // mode-1 vs mode-2 discriminator at the same inputs (out0: core vs fbm)
    expect(bandParams(d, b1, coord)[0]).not.toBe(out[0]);
  });

  test("else arm: mode ∉ {0,2,3} dispatches to the core arm (0/1/N counts)", () => {
    const scale = 0.00128571;
    const core = (mode) => bandParams(d, BAND(10, 20, { mode, gradNoiseScale: scale }), -7.5);
    const base = core(1);
    for (const mode of [4, 5, 99, -1, 7]) {
      expect(core(mode), `mode=${mode}`).toEqual(base);
    }
    expect(core(2)).not.toEqual(base); // the fbm OUT0 arm is distinct (1-count)
    // …but its tail is the shared core path: bit-identical out1 (the
    // (mode 2: fbm) tail reading was the dig-#142 port bug)
    expect(core(2)[1]).toBe(base[1]);
    expect(core(3)).not.toEqual(base); // the slope arm is distinct
    expect(core(0)).toEqual([10, 20]); // const arm distinct from the rest
  });

  test("r-eval end-to-end at the census frame (the band-law rp, dig #142)", () => {
    const dC = drvOf(BAND(-100, 100));
    const r = bandRampEval(dC, uid, -7.5, 3.5); // no seam: lx = 504
    expect(r).toBe(f(103.5 / 200));
    expect(f(r * 10)).toBe(5.174999713897705);
    // replacement discriminator: the pre-#142 surrogate arithmetic gives
    // a different r entirely — this pin FAILS under the old law
    expect(f(r * 10)).not.toBe(f(noiseDispatch(5, -7.5, 3.5) * 10));
  });
});

describe("fbmGradient octave structure (true 0x9FAD90): 4 core + 3 rotations", () => {
  const T = [0.8414700031280518, 0.5403000116348267, 0.5403000116348267, -0.8414700031280518];
  const LAC = [2.02, 2.33, 2.01];
  const W = [0.5, 0.25, 0.125, 0.0625];

  // independent restatement of the byte law (rotations x-first, f32 at
  // every mul/add, /0.9375 at the end)
  const restatement = (a, b, rotations = 3) => {
    let x = f(a), y = f(b);
    let acc = f(f(simplex2DDeriv(x, y)) * W[0]);
    for (let k = 0; k < rotations; k++) {
      const nx = f(f(f(T[0] * x) + f(T[2] * y)) * LAC[k]);
      const ny = f(f(f(T[1] * x) + f(T[3] * y)) * LAC[k]);
      x = nx;
      y = ny;
      acc = f(acc + f(simplex2DDeriv(x, y) * W[k + 1]));
    }
    return f(acc / 0.9375);
  };

  test("matches the independent restatement (N input samples)", () => {
    for (const [a, b] of [[0, 0], [0.5, -0.25], [3.25, 7.75], [-12, 0.125], [1e6, -1e6]]) {
      expect(fbmGradient(a, b), `(${a},${b})`).toBe(restatement(a, b));
    }
  });

  test("3-rotation discriminator: dropping an octave changes the value", () => {
    // rotations=3 IS the full law (initial call + 3 = 4 core calls) —
    // it must EQUAL fbmGradient (the structural pin); 2 and 1 rotations
    // (3 and 2 core calls) must differ — the 4-call count discriminators
    expect(restatement(0.5, -0.25, 3)).toBe(fbmGradient(0.5, -0.25));
    expect(restatement(0.5, -0.25, 2)).not.toBe(fbmGradient(0.5, -0.25));
    expect(restatement(0.5, -0.25, 1)).not.toBe(fbmGradient(0.5, -0.25));
    expect(restatement(0.5, -0.25, 0)).not.toBe(fbmGradient(0.5, -0.25)); // initial only
  });

  test("normalization discriminator: ÷0.9375 lands (unnormalized acc differs)", () => {
    // unnormalized = the same chain without the final div
    let x = f(0.5), y = f(-0.25);
    let acc = f(f(simplex2DDeriv(x, y)) * W[0]);
    for (let k = 0; k < 3; k++) {
      const nx = f(f(f(T[0] * x) + f(T[2] * y)) * LAC[k]);
      const ny = f(f(f(T[1] * x) + f(T[3] * y)) * LAC[k]);
      x = nx;
      y = ny;
      acc = f(acc + f(simplex2DDeriv(x, y) * W[k + 1]));
    }
    expect(acc).not.toBe(fbmGradient(0.5, -0.25));
    expect(f(acc / 0.9375)).toBe(fbmGradient(0.5, -0.25));
  });

  test("zero-input pin: acc starts at f(f(n0)·0.5) with core(0,0) = 0", () => {
    // independent decomposition: the initial acc = f(f(core(0,0))·0.5)
    // = 0 exactly (core(0,0) = 0, all zero-sign variants), so fbm(0,0)
    // reduces to the 3 tail octaves from (0,0), normalized
    const tailAcc = () => {
      let x = f(0), y = f(0);
      let acc = 0;
      for (let k = 0; k < 3; k++) {
        const nx = f(f(f(T[0] * x) + f(T[2] * y)) * LAC[k]);
        const ny = f(f(f(T[1] * x) + f(T[3] * y)) * LAC[k]);
        x = nx;
        y = ny;
        acc = f(acc + f(simplex2DDeriv(x, y) * W[k + 1]));
      }
      return acc;
    };
    expect(fbmGradient(0, 0)).toBe(f(tailAcc() / 0.9375));
    expect(fbmGradient(-0, -0)).toBe(fbmGradient(0, 0)); // zero-sign invariance
  });
});

describe("phaseSXBase: the Lehmer draw law + Phase-S stores (0x10098C0)", () => {
  // independent BigInt instruction mirror of the draw sequence:
  // diddle {0,2^32} → clamp ≥2147483647 → ×0.5 → warm draw → u1,u2,u3;
  // each step: s = cvttsd2si (i32 wrap), r = 16807·s mod 2147483647
  // (BigInt % truncates toward zero = the JS/scharm form), r ≤ 0 → +=MOD,
  // draw = f64(r)·4.656612875e-10; the stores are the f32 chains.
  const mirror = (seedInt) => {
    let num = BigInt(seedInt < 0 ? seedInt + 4294967296 : seedInt);
    let div = 1n;
    if (num >= 2147483647n * div) div = 2n; // the ×0.5 clamp (exact here)
    const draw = () => {
      if (num === 0n) throw new Error("state 0");
      const trunc = num / div; // positive states: BigInt div = floor = trunc
      const s = BigInt.asIntN(32, trunc); // cvttsd2si range semantics
      let r = (16807n * s) % 2147483647n;
      if (r <= 0n) r += 2147483647n;
      num = r;
      div = 1n;
      return Number(r) * 4.656612875e-10;
    };
    draw(); // the ctor's warm draw
    const u1 = draw(), u2 = draw(), u3 = draw();
    return {
      s1: f(f(f(u1) * 9999) + 1),
      xBase: f(f(f(u2) * 200000) - 100000),
      u3slot: f(f(f(u3) * 200000) - 100000),
    };
  };

  test("goldens (byte-pinned; the warm draw + 3 live draws = 4-step count)", () => {
    expect(phaseSXBase(78633191)).toEqual({
      s1: 188.77249145507812,
      xBase: 24155.7109375,
      u3slot: -14857.640625,
    });
    expect(phaseSXBase(-12345)).toEqual({
      s1: 1488.5670166015625,
      xBase: -19209.71875,
      u3slot: -57722.84375,
    });
    expect(phaseSXBase(2147483647).s1).toBe(4342.876953125);
    expect(phaseSXBase(2147483647).xBase).toBe(-75560.53125);
    expect(phaseSXBase(-2147483648).s1).toBe(5658.123046875); // INT_MIN trunc path
    expect(phaseSXBase(-2147483648).xBase).toBe(75560.53125);
    expect(phaseSXBase(1).s1).toBe(1316.2464599609375);
    expect(phaseSXBase(1).xBase).toBe(51121.0625);
    expect(phaseSXBase(2147483646).s1).toBe(8684.75390625);
    expect(phaseSXBase(2147483646).xBase).toBe(-51121.06640625);
  });

  test("BigInt mirror agreement over N seeds (incl. both signs + boundaries)", () => {
    for (const seed of [78633191, -12345, 1, 2, 100, 2147483647, 2147483646, -2147483648, -1, -2]) {
      expect(phaseSXBase(seed), `seed=${seed}`).toEqual(mirror(seed));
    }
  });

  test("seed 0 → the state-0 assert throws (0-draw path)", () => {
    expect(() => phaseSXBase(0)).toThrow(/state 0/);
    expect(() => mirror(0)).toThrow(/state 0/); // the mirror agrees on the skip
  });
});

describe("driver frame contract (C119) + the surfaceField guard", () => {
  test("bandBlockOf: C116 defaults + f32 slots f32-rounded", () => {
    expect(bandBlockOf({})).toEqual({
      gradStartY: -512,
      gradEndY: 512,
      gradSlopeStartX: 0,
      // dig #145 (fresh ctor read): [+0x280] gradSlopeDelta default = f64
      // 1.0 (movsd %xmm1,[0x11e0b40] @0x49615d) — the port's old invented
      // 0.01 default is gone (C121).
      gradSlopeDelta: 1.0,
      mode: 1,
      gradNoiseScale: 0,
      gradLowNoise: -100,
      gradHighNoise: 100,
    });
    expect(bandBlockOf(null)).toBeNull();
    const hillsLike = bandBlockOf({
      mGradientStartY: "-1024",
      mGradientEndY: "1024",
      mGradientNoiseScale: "0.00128571",
      mGradientLowNoise: "-292.571",
      mGradientHighNoise: "234.057",
      mGradientAddNoise: "1",
    });
    expect(hillsLike.gradStartY).toBe(-1024);
    expect(hillsLike.gradLowNoise).toBe(f(-292.571)); // f32 slot: ≠ the f64 literal
    expect(hillsLike.gradLowNoise).not.toBe(-292.571);
    expect(hillsLike.gradHighNoise).toBe(f(234.057));
    // the lake family's slope attrs ride through (biomes.mjs parse)
    const lakeLike = bandBlockOf({
      mGradientSlopeStartX: "-12000",
      mGradientSlopeDelta: "-0.37",
      mGradientAddNoise: "3",
    });
    expect(lakeLike.gradSlopeStartX).toBe(-12000);
    expect(lakeLike.gradSlopeDelta).toBe(-0.37);
    expect(lakeLike.mode).toBe(3);
  });

  test("makeBandDriver cache: same (config, seed) → identical object; seeds separate", () => {
    const c = {}; // never resolved (bandAt lazy)
    const a = makeBandDriver(c, 1);
    expect(makeBandDriver(c, 1)).toBe(a);
    expect(makeBandDriver(c, 2)).not.toBe(a);
    expect(makeBandDriver({}, 1)).not.toBe(a); // separate config keys
    expect(a.baseX).toBe(17920);
    expect(a.baseY).toBe(7168);
    expect(a.w).toBe(70);
    expect(a.h).toBe(48);
    expect(a.bandCount).toBe(3360);
    expect(a.xBase).toBe(phaseSXBase(1).xBase); // the Phase-S u2 store
  });

  test("surfaceField guard: uid without driver throws (fail loud, dig #142)", () => {
    const base = {
      noiseKind: 5, gradWCoef: 0, perlinCoef: 0.871429, addNoise: 1,
      addValue: 0, ...cfgOf(),
    };
    expect(() => surfaceField({ ...base, driver: undefined }, 0, 0, () => 1, 0, 0))
      .toThrow(/driver missing/);
    // with a driver attached the lane runs: band (100,200) at (0,0) →
    // r = 0 → rp = 0 → the gates are skipped → FINAL = 0, no throw
    const ok = { ...base, driver: drvOf(BAND(100, 200, { mode: 0 })) };
    expect(surfaceField(ok, 0, 0, () => 1, 0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// data-gated: the driver against the REAL biome config (biomeAt resolution)
// ---------------------------------------------------------------------------
describe.skipIf(!hasNoitaData())("makeBandDriver on the real config (data-gated)", () => {
  test("frame + xBase + bandAt/cellAt resolution for the capture seed", async () => {
    const cfg = loadBiomeConfig(dataDir);
    const dr = makeBandDriver(cfg, 78633191);
    expect({ baseX: dr.baseX, baseY: dr.baseY, w: dr.w, h: dr.h, bandCount: dr.bandCount })
      .toEqual({ baseX: 17920, baseY: 7168, w: 70, h: 48, bandCount: 3360 });
    expect(dr.xBase).toBe(24155.7109375); // the golden
    expect(makeBandDriver(cfg, 78633191)).toBe(dr); // the cache
    // biome resolution: (35,14) is the coalmine band
    expect(biomeAt(cfg, 35, 14)?.biome?.filename).toContain("coalmine.xml");
    const band = dr.bandAt(14 * 70 + 35);
    expect(band).not.toBeNull();
    expect(band.gradStartY).toBe(f(-512)); // coalmine carries no mGradient* → defaults
    // cellAt laws: signed col wrap + row clamp
    expect(dr.cellAt(-1, 14)).toBe(dr.bandAt(14 * 70 + 69));
    expect(dr.cellAt(0, 999)).toBe(dr.bandAt(47 * 70 + 0));
    expect(dr.cellAt(-1, -5)).toBe(dr.bandAt(69)); // wrap → col 69, clamp → row 0
    // unmapped col 70 does not occur (cellAt clamps/wraps into 0..69)
    // full-lane probes (both arms) stay finite on real bands
    const cfgBand = cfgOf();
    expect(Number.isFinite(bandRampEval(dr, cfgBand, -7.5, 3.5))).toBe(true);
    expect(bandRampEval(dr, cfgBand, 0, 400)).toBe(1); // y > 380 → config arm
  });

  test("cellAt clamp counts: rows > 47 → 47 (N), rows < 0 → 0 (N), in-range 0-clamp", () => {
    const cfg = loadBiomeConfig(dataDir);
    const dr = makeBandDriver(cfg, 78633191);
    // high clamp (the cmovl max — unreachable through bandRampEval's
    // y ≤ 380 table path, so cellAt is its only observation site)
    const r47 = dr.bandAt(47 * 70 + 35);
    expect(r47).not.toBeNull(); // non-vacuous: (35,47) = the_end.xml
    for (const row of [47, 48, 60, 999, 1e6]) {
      expect(dr.cellAt(35, row), `row=${row}`).toBe(r47);
    }
    // in-range row: the clamp must NOT fire (identity with the direct read)
    expect(dr.cellAt(35, 14)).toBe(dr.bandAt(14 * 70 + 35));
    // low clamp (the cmovg min)
    const r0 = dr.bandAt(69);
    expect(r0).not.toBeNull(); // non-vacuous: (69,0) maps
    for (const row of [-1, -5, -999]) {
      expect(dr.cellAt(69, row), `row=${row}`).toBe(r0);
    }
    // col wrap N-count incl. double wraps (single signed add suffices —
    // the 0x909C70 idiv remainder is in (−70, 70))
    for (const c of [-1, -69, -70, -71, -140, -141, -1000]) {
      const want = ((c % 70) + 70) % 70;
      expect(dr.cellAt(c, 14), `c=${c}`).toBe(dr.bandAt(14 * 70 + want));
    }
  });
});
