// surface-level.mjs (dig #96): ctor defaults, band builder, classifier gate
// order, and the rarePolka ramp — port contracts + byte-exact f32 pins.
// Byte cites live in the module header (CONSTANTS C74/C75); this file pins
// BEHAVIOR: every expected value is either a literal from the hills.xml
// fixture (read this session), an f32 identity, or the independent chain
// oracle below (regression pin for the ramp math).
//
// Float bars: toBe(Math.fround(x)) = exact f32 slot pin (authoritative);
// toBeCloseTo(x, 7) where the f32 half-ulp fits under 5e-8 (small fractions),
// precision 4 for 424.229 (f32 ulp there = 3.05e-5 > 5e-8 ⇒ 7 impossible).

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  componentFromXml,
  buildMaterialsTable,
  classify,
  rarePolka,
} from "../../mapgen/lib/surface-level.mjs";
import { simplex2DDeriv } from "../../mapgen/lib/noise-proto.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

const f32 = Math.fround;

// ---------------------------------------------------------------------------
// Independent chain oracle — re-transcription of the ramp flow
// (rarePolka 0x8fbe60 → hashes 0x8f9200/0x8f92f0) used as the expected-value
// source for gate-boundary + fixture pins. `skipProbGate` exposes the full
// path past the r1 ≥ prob check (needed to contrast the jae-at-equality).
// Constants PE-verified this session: Q 0x11df8f4, K9200 0x11df8ac,
// K92F0 0x11df8b0→0x13476e4, K1 imm 0x3acbdc41→0x13476e8, K2 imm
// 0x3aa32fcf→0x13476ec, bases 26 0x11e01f8 / 161 0x11e031c / 71 0x11e02b8.
const Q = 0.014084506779909134; // 0x11df8f4
const K9200 = 0.00101319863460958; // 0x11df8ac (@8f92be mulss)
const K92F0 = 0.0010513747110962868; // 0x11df8b0 → 0x13476e4
const K1 = 0.0015553311677649617; // imm32 0x3acbdc41 (@8f934f)
const K2 = 0.0012450161157175899; // imm32 0x3aa32fcf (@8f9359)

function foldRef(t, base) {
  const q = f32(Q * t);
  const fl = f32(Math.floor(q)); // floor-fix idiom (comiss/dec = Math.floor)
  const m = f32(71 * fl);
  return f32(f32(t - m) + base);
}
function fracRef(t) {
  return f32(t - f32(Math.trunc(t))); // cvttss2si→cvtdq2ps→subss, inputs ≥ 0
}
function prodRef(x, y) {
  // 0x8f9200/0x8f92f0 core: squared product with x→base 26, y→base 161.
  const fx = foldRef(x, 26);
  const fy = foldRef(y, 161);
  return f32(f32(fy * fy) * f32(fx * fx));
}
function rampRef(px, py, low, high, boxed, prob, skipProbGate = false) {
  px = f32(px);
  py = f32(py);
  low = f32(low);
  high = f32(high);
  prob = f32(prob);
  const cellX = f32(Math.floor(px)); // floor-fix cell (esi/edi path)
  const cellY = f32(Math.floor(py));
  if (!skipProbGate) {
    const t1 = f32(K9200 * prodRef(cellX, cellY));
    if (f32(t1 - f32(Math.trunc(t1))) >= prob) return 0; // jae 0x8fbfxx → 0
  }
  const fracX = f32(px - cellX);
  const fracY = f32(py - cellY);
  const p0 = prodRef(cellX, cellY); // [w0, w1, r2] from 0x8f92f0
  const w0 = fracRef(f32(K92F0 * p0));
  const w1 = fracRef(f32(K1 * p0));
  const r2 = fracRef(f32(K2 * p0));
  const R = f32(f32(f32(high - low) * r2) + low);
  if (!(R > 0)) return 0; // comiss/jae @0x8fbfbd → 0
  const k = f32(2 / R); // divss const 2.0 @8fbf38
  const km1 = f32(k - 1);
  const km2 = f32(k - 2);
  const p = f32(f32(km2 * w1) + f32(f32(fracY * k) - km1));
  const q = f32(f32(km2 * w0) + f32(f32(fracX * k) - km1));
  const p2 = f32(p * p);
  const q2 = f32(q * q);
  let d;
  if (boxed) {
    d = f32(f32(p2 * p2) + f32(q2 * q2)); // p⁴+q⁴ ≤ 1 else 0
    if (!(d <= 1)) return 0;
  } else {
    d = f32(p2 + q2); // d ≥ 1 → d = 1
    if (!(1 > d)) d = 1;
  }
  const t = f32(1 - d);
  return f32(f32(t * t) * t); // (1−d)³ as f32 (widened to f64 by cvtps2pd)
}

const xml = (attrs) =>
  `<MaterialComponent\n${attrs.map((a) => `      ${a} `).join("\n")}\n    >`;

// ---------------------------------------------------------------------------

describe("componentFromXml (C74 defaults + attr→slot)", () => {
  test("bare block gets the ctor defaults (fail-loud on absent name)", () => {
    const c = componentFromXml(xml(['material_name="x"']));
    expect(c.material_name).toBe("x");
    expect(c.material_index).toBe(10);
    expect(c.material_min).toBe(f32(0.1));
    expect(c.material_min).toBeCloseTo(0.1, 7);
    expect(c.material_max).toBe(f32(0.1));
    expect(c.material_max).toBeCloseTo(0.1, 7);
    expect(c.add_perlin).toBe(false);
    expect(c.add_perlin_scale_x).toBe(1);
    expect(c.add_perlin_scale_y).toBe(1);
    expect(c.is_rare).toBe(false);
    expect(c.limit_y).toBe(false);
    expect(c.limit_min_y).toBe(100);
    expect(c.limit_max_y).toBe(2048);
    expect(c.rare_use_perlin).toBe(false);
    expect(c.rare_use_fbm_perlin).toBe(false);
    expect(c.rare_use_polka).toBe(true); // ctor 1
    expect(c.rare_scale_x).toBeCloseTo(0.05, 7);
    expect(c.rare_scale_y).toBeCloseTo(0.05, 7);
    expect(c.rare_offset_by_seed).toBe(false);
    expect(c.rare_offset_x).toBe(0);
    expect(c.rare_offset_y).toBe(0);
    expect(c.rare_polka_radius_low).toBeCloseTo(0.2, 7);
    expect(c.rare_polka_radius_high).toBeCloseTo(0.65, 7);
    expect(c.rare_polka_is_boxed).toBe(true); // ctor 1
    expect(c.rare_polka_probability).toBeCloseTo(0.2, 7);
    expect(c.rare_required_min).toBeCloseTo(0.2, 7);
    expect(c.rare_required_max).toBe(1);
    expect(c.is_polygon).toBe(false);
    expect(c.polygon).toEqual([]);
    expect(c.celldata).toBe(null);
  });

  test("float attrs land in f32 slots (Math.fround)", () => {
    const c = componentFromXml(xml([
      'material_min="0.51"',
      'material_max="0.55"',
      'rare_scale_x="0.0100004"',
      'rare_polka_probability="0.160871"',
      'limit_max_y="424.229"',
      'limit_min_y="-1024"',
      'rare_required_min="0"',
      'material_index="10"',
    ]));
    expect(c.material_min).toBe(f32(0.51)); // exact f32 slot pin
    expect(c.material_min).toBeCloseTo(0.51, 7); // f64 literal within half-ulp
    expect(c.material_max).toBe(f32(0.55));
    expect(c.material_max).toBeCloseTo(0.55, 7);
    expect(c.rare_scale_x).toBe(f32(0.0100004));
    expect(c.rare_scale_x).toBeCloseTo(0.0100004, 7);
    expect(c.rare_polka_probability).toBe(f32(0.160871));
    expect(c.rare_polka_probability).toBeCloseTo(0.160871, 7);
    expect(c.limit_max_y).toBe(f32(424.229));
    expect(c.limit_max_y).toBeCloseTo(424.229, 4); // f32 ulp 3.05e-5 ⇒ p7 impossible
    expect(c.limit_min_y).toBe(-1024); // exact in f32
    expect(c.rare_required_min).toBe(0);
    expect(c.material_index).toBe(10);
    expect(Number.isInteger(c.material_index)).toBe(true);
  });

  test("bool attrs accept only \"0\"/\"1\"", () => {
    expect(componentFromXml(xml(['is_rare="1"'])).is_rare).toBe(true);
    expect(componentFromXml(xml(['is_rare="0"'])).is_rare).toBe(false);
    expect(() => componentFromXml(xml(['is_rare="2"']))).toThrow(/bool attr is_rare="2"/);
    expect(() => componentFromXml(xml(['limit_y="yes"']))).toThrow(/only "0"\/"1"/);
  });

  test("_enabled parses to no slot (1096×\"1\"/0×\"0\" census)", () => {
    const c = componentFromXml(xml(['_enabled="1"', 'material_name="coal"']));
    expect(c.material_name).toBe("coal"); // no throw = ignored
    expect(Object.keys(c)).not.toContain("_enabled");
    expect(componentFromXml(xml(['_enabled="0"', 'material_name="y"'])).material_name).toBe("y");
  });

  test("registered-but-unread attrs throw (celldata, polygon)", () => {
    expect(() => componentFromXml(xml(['celldata="7"']))).toThrow(/its parse is unread/);
    expect(() => componentFromXml(xml(['polygon="1,2,3"']))).toThrow(/C74/);
  });

  test("unknown attrs throw (fail-loud, not in the C74 slot map)", () => {
    expect(() => componentFromXml(xml(['not_a_slot="1"']))).toThrow(/unknown attribute "not_a_slot"/);
  });

  test("malformed inputs throw honestly", () => {
    expect(() => componentFromXml("hello")).toThrow(/one <MaterialComponent/);
    expect(() => componentFromXml(xml(['material_min="abc"']))).toThrow(/is not a finite/);
    expect(() => componentFromXml(xml(['material_min=""']))).toThrow(/is not a finite/);
    expect(() => componentFromXml(xml(['material_index="10.5"']))).toThrow(/is not an integer/);
  });
});

describe("buildMaterialsTable (band seed + celldata assign)", () => {
  const mk = (min, max, name = "m") =>
    componentFromXml(xml([`material_name="${name}"`, `material_min="${min}"`, `material_max="${max}"`]));

  test("band accumulates by replace-if-narrower (8f8fe4..8f8fff)", () => {
    const a = mk("0.45", "0.53", "a");
    const b = mk("0.51", "0.55", "b");
    const t = buildMaterialsTable([a, b], { min: 0, max: 0 }, [{ id: "a" }, { id: "b" }]);
    expect(t.bandMin).toBe(0); // seed lo kept (narrower than comps)
    expect(t.bandMax).toBe(f32(0.55)); // comps widen past the seed
    expect(t.mInitialized).toBe(true);
    expect(t.cellFactory).toBe(true);
    expect(a.celldata).toEqual({ id: "a" });
    expect(b.celldata).toEqual({ id: "b" });
    // narrower seed wins both ends:
    const t2 = buildMaterialsTable([mk("0.45", "0.53")], { min: 0.4, max: 0.99 }, []);
    expect(t2.bandMin).toBeCloseTo(0.4, 7);
    expect(t2.bandMax).toBeCloseTo(0.99, 7);
  });

  test("celldata parallel array assigns; missing → null; null array → all null", () => {
    const t = buildMaterialsTable(
      [mk("0.1", "0.2"), mk("0.1", "0.2")],
      { min: 0, max: 1 },
      [{ id: 0 }],
    );
    expect(t.components[0].celldata).toEqual({ id: 0 });
    expect(t.components[1].celldata).toBe(null);
    const t2 = buildMaterialsTable([mk("0.1", "0.2")], { min: 0, max: 1 }, null);
    expect(t2.components[0].celldata).toBe(null);
  });

  test("band validation throws (game's seed unread ⇒ required param)", () => {
    expect(() => buildMaterialsTable([], undefined, null)).toThrow(/band must be \{min, max\}/);
    expect(() => buildMaterialsTable([], { min: NaN, max: 0 }, null)).toThrow(/band must be/);
    expect(() => buildMaterialsTable([], { min: 0 }, null)).toThrow(/band must be/); // missing max
  });

  test("null component + inverted range throw (honest P1-dead arms)", () => {
    expect(() => buildMaterialsTable([null], { min: 0, max: 1 }, null)).toThrow(/null component at \[0\]/);
    expect(() => buildMaterialsTable([mk("0.5", "0.4")], { min: 0, max: 1 }, null))
      .toThrow(/material_min \(0.5\) > material_max/);
    expect(() => buildMaterialsTable([mk("0.5", "0.4")], { min: 0, max: 1 }, null))
      .toThrow(/is unread \(OPEN\)/); // log strings 0x11735f0.. unread ⇒ port throws
  });
});

describe("classify (0x8f5030 gate order, byte-cited)", () => {
  const build = (attrLists, band = { min: 0, max: 1 }, recs = null) => {
    const comps = attrLists.map((a) => componentFromXml(xml(a)));
    return { comps, table: buildMaterialsTable(comps, band, recs) };
  };
  const plain = (name, min, max) => [
    `material_name="${name}"`,
    `material_min="${min}"`,
    `material_max="${max}"`,
  ];

  test("null / unbuilt / broken tables throw the honest asserts", () => {
    expect(() => classify(null, 0, 0, 0)).toThrow(/null table/);
    const { table } = build([plain("m", "0", "1")], { min: 0, max: 1 }, [{ id: 0 }]);
    expect(() => classify({ ...table, mInitialized: false }, 0, 0, 0.5)).toThrow(/at line 254/);
    expect(() => classify({ ...table, components: null }, 0, 0, 0.5)).toThrow(/vector ptrs/);
    expect(() => classify({ ...table, cellFactory: null }, 0, 0, 0.5)).toThrow(/at line 264/);
    expect(() => classify({ ...table, components: [null] }, 0, 0, 0.5)).toThrow(/at line 263/);
    // assertThrow's FILE string (0x1173240 biome_materials.cpp) rides every 0xNNN:
    expect(() => classify({ ...table, mInitialized: false }, 0, 0, 0.5))
      .toThrow(/Assert failed: \(mInitialized\) in .*biome_materials\.cpp at line 254/);
  });

  test("band gate CLOSED → null before the loop (comiss → 0x8f574c)", () => {
    const { comps } = build([plain("m", "0", "10")], { min: 0, max: 1 }, [{ id: "m" }]);
    // As-built bands are seed∪comps (replace-if-narrower), so build() can
    // never produce a band that rejects a comp-matching v — pin the gate
    // ORDER with a hand-built band [1,2] narrower than the comp (the game's
    // band-seed init value is unread ⇒ band-as-param, tagged OPEN):
    const table = {
      components: comps,
      bandMin: f32(1),
      bandMax: f32(2),
      mInitialized: true,
      cellFactory: true,
    };
    expect(classify(table, 0, 0, 0.5)).toBe(null); // comp [0,10) matches, band rejects first
    expect(classify(table, 0, 0, 0.999)).toBe(null); // below bandMin
    expect(classify(table, 0, 0, 1)).toEqual({ id: "m" }); // v == bandMin (closed)
    expect(classify(table, 0, 0, 2)).toEqual({ id: "m" }); // v == bandMax (closed)
    expect(classify(table, 0, 0, 2.0001)).toBe(null); // above band, comp still matches
  });

  test("0x10f: null record + named → line-271 throw with the log prefix", () => {
    const { table } = build([plain("coal", "0", "1")], { min: 0, max: 1 }, null); // no record
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/Error! couldn't find material: coal/);
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/at line 271/);
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/biome_materials\.cpp/);
    expect(() => classify(table, 0, 0, 0.5))
      .toThrow(/false && "this should be done outside of this"/);
  });

  test("null record + empty name defers to the second-null skip (@0x8f5572)", () => {
    const { comps, table } = build(
      [plain("", "0", "1"), plain("ok", "0", "1")],
      { min: 0, max: 1 },
      [null, { id: 1 }],
    );
    expect(comps[0].material_name).toBe("");
    expect(classify(table, 0, 0, 0.5)).toEqual({ id: 1 }); // first deferred, second wins
    const { table: alone } = build([plain("", "0", "1")], { min: 0, max: 1 }, [null]);
    expect(classify(alone, 0, 0, 0.5)).toBe(null);
  });

  test("diag @0x8f52e9 runs before the limit_y gate (byte order)", () => {
    const { table } = build(
      [
        [
          'material_name="coal"',
          'material_min="0"',
          'material_max="1"',
          'limit_y="1"',
          'limit_min_y="100"',
          'limit_max_y="200"',
        ],
      ],
      { min: 0, max: 1 },
      null, // null record ⇒ 0x10f even though y is out of limit range
    );
    expect(() => classify(table, 0, -500, 0.5)).toThrow(/at line 271/);
  });

  test("limit_y gate CLOSED on f32(y) ([+0x3c], [+0x40])", () => {
    const base = (flag) => [
      'material_name="m"',
      'material_min="0"',
      'material_max="1"',
      `limit_y="${flag}"`,
      'limit_min_y="100"',
      'limit_max_y="100"',
    ];
    const { table } = build([base("1")], { min: 0, max: 1 }, [{ id: "L" }]);
    expect(classify(table, 0, 99, 0.5)).toBe(null);
    expect(classify(table, 0, 100, 0.5)).toEqual({ id: "L" }); // closed lower
    expect(classify(table, 0, 101, 0.5)).toBe(null);
    const { table: off } = build([base("0")], { min: 0, max: 1 }, [{ id: "x" }]);
    expect(classify(off, 0, 0, 0.5)).toEqual({ id: "x" }); // flag off ⇒ limits inert
    // hills-style negative bound (fixture also pins −1024):
    const { table: neg } = build(
      [
        [
          'material_name="m"',
          'material_min="0"',
          'material_max="1"',
          'limit_y="1"',
          'limit_min_y="-1024"',
          'limit_max_y="424.229"',
        ],
      ],
      { min: 0, max: 1 },
      [{ id: "N" }],
    );
    expect(classify(neg, 0, -1024, 0.5)).toEqual({ id: "N" });
    expect(classify(neg, 0, -1025, 0.5)).toBe(null);
    expect(classify(neg, 0, 424, 0.5)).toEqual({ id: "N" }); // 424 ≤ f32(424.229)
    expect(classify(neg, 0, 425, 0.5)).toBe(null);
  });

  test("is_polygon throws (0x10096a0 unread); diag precedes it", () => {
    const poly = [
      'material_name="m"',
      'material_min="0"',
      'material_max="1"',
      'is_polygon="1"',
    ];
    const { table } = build([poly], { min: 0, max: 1 }, [{ id: "p" }]);
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/polygon arm not ported/);
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/0x10096a0/);
    const { table: named } = build([poly], { min: 0, max: 1 }, null);
    expect(() => classify(named, 0, 0, 0.5)).toThrow(/at line 271/); // 0x10f @8f52e9 first
  });

  test("main gate HALF-OPEN [material_min, material_max) on v′", () => {
    const { table } = build([plain("m", "0.51", "0.55")], { min: 0, max: 1 }, [{ id: "M" }]);
    expect(classify(table, 0, 0, f32(0.509))).toBe(null);
    expect(classify(table, 0, 0, f32(0.51))).toEqual({ id: "M" }); // closed lower
    expect(classify(table, 0, 0, f32(0.549))).toEqual({ id: "M" });
    expect(classify(table, 0, 0, f32(0.55))).toBe(null); // open upper
  });

  test("first-match wins; the full component list is scanned", () => {
    const { table } = build(
      [plain("a", "0.51", "0.55"), plain("b", "0.4", "0.9")],
      { min: 0, max: 1 },
      [{ id: "first" }, { id: "second" }],
    );
    expect(classify(table, 0, 0, f32(0.53))).toEqual({ id: "first" });
    // match only in the LAST component (chained half-open ranges):
    const { table: last } = build(
      [plain("p0", "0", "0.1"), plain("p1", "0.1", "0.2"), plain("p2", "0.2", "1")],
      { min: 0, max: 1 },
      [{ id: 0 }, { id: 1 }, { id: 2 }],
    );
    expect(classify(last, 0, 0, f32(0.2))).toEqual({ id: 2 });
    expect(classify(last, 0, 0, f32(0.15))).toEqual({ id: 1 });
  });

  test("add_perlin v′ wiring: raw f32(x)·scale simplex + f32 add", () => {
    // Derive v′ outside the DUT from the same byte-arg chain (nx = f32(f32(x)·
    // scale_x), s32 = f32(simplex…), v′ = f32(s32 + v) with v = 0), then gate
    // on [v′, v′+1) (or [v′−1, v′/2) when negative) — only a port that really
    // computes v′ can pass; raw-v falls out of the dynamic gate either sign.
    const nx = f32(f32(7) * f32(0.31));
    const ny = f32(f32(11) * f32(0.17));
    const s32 = f32(simplex2DDeriv(nx, ny));
    expect(s32).not.toBe(0); // precondition (static candidate coords)
    const lo = s32 > 0 ? s32 : f32(s32 - 1);
    const hi = s32 > 0 ? f32(s32 + 1) : f32(s32 / 2);
    const on = componentFromXml(xml([
      'material_name="v"',
      `material_min="${lo}"`,
      `material_max="${hi}"`,
      'add_perlin="1"',
      'add_perlin_scale_x="0.31"',
      'add_perlin_scale_y="0.17"',
    ]));
    const table = buildMaterialsTable([on], { min: 0, max: 0 }, [{ id: "v" }]);
    expect(classify(table, 7, 11, 0)).toEqual({ id: "v" });
    // control: transform off ⇒ the same dynamic gate can never see v′:
    const off = componentFromXml(xml([
      'material_name="v"',
      `material_min="${lo}"`,
      `material_max="${hi}"`,
      'add_perlin_scale_x="0.31"',
      'add_perlin_scale_y="0.17"',
    ]));
    const ctl = buildMaterialsTable([off], { min: 0, max: 0 }, [{ id: "v0" }]);
    expect(classify(ctl, 7, 11, 0)).toBe(null);
  });

  test("jitter arm throws (0x9119d0) only after the main gate", () => {
    const { table } = build(
      [
        [
          'material_name="j"',
          'material_min="0"',
          'material_max="1"',
          'is_rare="1"',
          'rare_offset_by_seed="1"',
          'rare_use_polka="0"',
        ],
      ],
      { min: 0, max: 1 },
      [{ id: "j" }],
    );
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/jitter arm not ported/);
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/0x9119d0/);
    expect(classify(table, 0, 0, f32(1))).toBe(null); // [0,1) rejects ⇒ no jitter call
  });

  test("fbm selector nested under rare_use_perlin (je only in the perlin arm)", () => {
    const { table } = build(
      [
        [
          'material_name="f"',
          'material_min="0"',
          'material_max="1"',
          'is_rare="1"',
          'rare_use_perlin="1"',
          'rare_use_fbm_perlin="1"',
        ],
      ],
      { min: 0, max: 1 },
      [{ id: "f" }],
    );
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/fbm arm not ported/);
    expect(() => classify(table, 0, 0, 0.5)).toThrow(/0x9fad90/);
    // perlin off ⇒ the fbm flag is never consulted (byte order: perlin first):
    const { table: noPerlin } = build(
      [
        [
          'material_name="f"',
          'material_min="0"',
          'material_max="1"',
          'is_rare="1"',
          'rare_use_fbm_perlin="1"',
          'rare_use_polka="0"',
        ],
      ],
      { min: 0, max: 1 },
      [{ id: "f0" }],
    );
    expect(classify(noPerlin, 0, 0, 0.5)).toEqual({ id: "f0" });
  });

  test("noise out-gate is (min, max] — exact lower edge rejected, upper kept", () => {
    const { comps, table } = build(
      [
        [
          'material_name="n"',
          'material_min="0"',
          'material_max="1"',
          'is_rare="1"',
          'rare_use_perlin="1"',
          'rare_use_polka="0"',
          'rare_scale_x="0.05"',
          'rare_scale_y="0.05"',
        ],
      ],
      { min: 0, max: 1 },
      [{ id: "n" }],
    );
    const px = f32(f32(3) * f32(0.05)); // transform @0x8f55dc (offsets 0)
    const py = f32(f32(7) * f32(0.05));
    const noise = f32(simplex2DDeriv(px, py));
    comps[0].rare_required_min = noise;
    comps[0].rare_required_max = noise;
    expect(classify(table, 3, 7, 0.5)).toBe(null); // noise > noise fails ⇒ (min,·]
    comps[0].rare_required_min = f32(noise - 0.5);
    expect(classify(table, 3, 7, 0.5)).toEqual({ id: "n" }); // [noise−0.5, noise] passes
  });

  test("polka out-gate is (min, max] — ramp edge pins the same shape", () => {
    const { comps, table } = build(
      [
        [
          'material_name="p"',
          'material_min="0"',
          'material_max="1"',
          'is_rare="1"',
          'rare_use_polka="1"',
          'rare_scale_x="0.05"',
          'rare_scale_y="0.05"',
          'rare_polka_radius_low="0.2"',
          'rare_polka_radius_high="0.65"',
          'rare_polka_is_boxed="1"',
          'rare_polka_probability="0.2"',
        ],
      ],
      { min: 0, max: 1 },
      [{ id: "p" }],
    );
    const px = f32(f32(3) * f32(0.05));
    const py = f32(f32(7) * f32(0.05));
    const ramp = rampRef(px, py, 0.2, 0.65, true, 0.2);
    comps[0].rare_required_min = ramp;
    comps[0].rare_required_max = ramp;
    expect(classify(table, 3, 7, 0.5)).toBe(null); // ramp > ramp fails ⇒ (min,·]
    comps[0].rare_required_min = f32(ramp - 0.5);
    expect(classify(table, 3, 7, 0.5)).toEqual({ id: "p" });
  });

  test("noise+polka legs are SEQUENTIAL — exactly one gate passing ⇒ reject", () => {
    const { comps, table } = build(
      [
        [
          'material_name="b"',
          'material_min="0"',
          'material_max="1"',
          'is_rare="1"',
          'rare_use_perlin="1"',
          'rare_use_polka="1"',
          'rare_scale_x="0.05"',
          'rare_scale_y="0.05"',
          'rare_polka_radius_low="0.2"',
          'rare_polka_radius_high="0.65"',
          'rare_polka_is_boxed="1"',
          'rare_polka_probability="0.2"',
        ],
      ],
      { min: 0, max: 1 },
      [{ id: "b" }],
    );
    // Fixed candidate list (deterministic given the pinned simplex): find a
    // cell where noise ≠ ramp so the two bounds can be placed asymmetrically.
    const probes = [[3, 7], [11, 5], [2, 13], [9, 4], [17, 6], [5, 19]];
    let p = null;
    for (const [qx, qy] of probes) {
      const pxx = f32(f32(qx) * f32(0.05));
      const pyy = f32(f32(qy) * f32(0.05));
      const n = f32(simplex2DDeriv(pxx, pyy));
      const r = rampRef(pxx, pyy, 0.2, 0.65, true, 0.2);
      if (n !== r) {
        p = { x: qx, y: qy, n, r };
        break;
      }
    }
    expect(p).not.toBe(null);
    if (p.n > p.r) {
      // bounds (r, n]: noise passes ((min,max]), polka's own edge rejects it.
      comps[0].rare_required_min = p.r;
      comps[0].rare_required_max = p.n;
    } else {
      // bounds (n, r]: polka passes, noise rejects at its exact lower edge.
      comps[0].rare_required_min = p.n;
      comps[0].rare_required_max = p.r;
    }
    expect(classify(table, p.x, p.y, 0.5)).toBe(null); // an either-leg port would accept
  });
});

describe("rarePolka (0x8fbe60 ramp)", () => {
  test("probability gate: r1 ≥ prob → 0 (equality trips the jae)", () => {
    // Independent r1 for the (0.5,0.5)→cell (0,0) path (f64≤24-bit products:
    // every op below is exact, so this equals the f32 chain byte-for-byte).
    const p00 = f32(f32(161 * 161) * f32(26 * 26));
    expect(p00).toBe(17522596); // exact (≤ 2^25, even)
    const t1 = f32(K9200 * p00);
    const r1 = f32(t1 - f32(Math.trunc(t1)));
    // Search a cell with r1 > 0 whose full-path ramp ≠ 0 (so the 0/non-0
    // contrast isolates the gate, not an always-zero branch):
    const cands = [[0.5, 0.5], [1.5, 2.5], [-4.25, 7.75], [10.375, -2.625], [133.75, -97.625]];
    let eq = null;
    for (const [cx, cy] of cands) {
      const tx = f32(K9200 * prodRef(f32(Math.floor(cx)), f32(Math.floor(cy))));
      const rr = f32(tx - f32(Math.trunc(tx)));
      if (!(rr > 0)) continue;
      const probBelow = f32(rr + 1e-6); // strictly above rr after f32 rounding
      const full = rampRef(cx, cy, 0.3, 0.9, false, probBelow, true);
      if (full !== 0) {
        eq = { cx, cy, rr, probBelow, full };
        break;
      }
    }
    expect(eq).not.toBe(null);
    expect(rarePolka(eq.cx, eq.cy, 0.3, 0.9, false, eq.rr)).toBe(0); // jae (≥) at equality
    expect(rarePolka(eq.cx, eq.cy, 0.3, 0.9, false, eq.probBelow)).toBe(eq.full); // proceeds, ≠ 0
    // (0.5, 0.5) cell-r1 spot pin — the literal chain above:
    expect(rarePolka(0.5, 0.5, 0.3, 0.9, false, r1)).toBe(0);
  });

  test("R ≤ 0 → 0 (R = low + (high−low)·r2 from hash92f0's r2)", () => {
    expect(rarePolka(1.5, 2.5, 0, 0, true, 1)).toBe(0); // R = 0
    expect(rarePolka(1.5, 2.5, -1, -1, false, 1)).toBe(0); // R = −1
    expect(rarePolka(1.5, 2.5, -2, -0.5, false, 1)).toBe(0); // R ∈ [−2, −0.5) always < 0
  });

  test("prob=1 runs the full path: f32-exact, finite, within [0,1]", () => {
    for (const [x, y] of [[0.5, 0.5], [3.25, -1.75], [120.5, 44.5], [-9.5, 0.25]]) {
      const v = rarePolka(x, y, 0.2, 0.65, true, 1);
      expect(Number.isFinite(v)).toBe(true);
      expect(f32(v)).toBe(v); // cvtps2pd widening is exact ⇒ result is f32
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBe(rampRef(x, y, 0.2, 0.65, true, 1)); // oracle pin
    }
  });

  test("golden chain at the hills-comp1 params (oracle + f32 identity)", () => {
    const v = rarePolka(0.5, 0.5, 0.357143, 0.771429, false, 0.160871);
    const e = rampRef(0.5, 0.5, 0.357143, 0.771429, false, 0.160871);
    expect(v).toBeCloseTo(e, 7);
    expect(f32(v)).toBe(f32(e));
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  test("boxed vs unboxed select different values (p⁴+q⁴ vs p²+q²≤1)", () => {
    const cands = [[0.5, 0.5], [3.25, -1.75], [-4.25, 7.75], [10.375, -2.625], [0.25, 0.125]];
    let diff = null;
    for (const [x, y] of cands) {
      const bT = rampRef(x, y, 0.3, 0.9, true, 1);
      const bF = rampRef(x, y, 0.3, 0.9, false, 1);
      if (bT !== bF) {
        diff = { x, y, bT, bF };
        break;
      }
    }
    expect(diff).not.toBe(null); // the shapes are algebraically different
    expect(rarePolka(diff.x, diff.y, 0.3, 0.9, true, 1)).toBe(diff.bT);
    expect(rarePolka(diff.x, diff.y, 0.3, 0.9, false, 1)).toBe(diff.bF);
  });

  test("low/high order matters (R = low + (high−low)·r2 is asymmetric)", () => {
    const cands = [[0.5, 0.5], [3.25, -1.75], [-4.25, 7.75], [10.375, -2.625]];
    let ord = null;
    for (const [x, y] of cands) {
      const ab = rampRef(x, y, 0.2, 0.65, false, 1);
      const ba = rampRef(x, y, 0.65, 0.2, false, 1);
      if (ab !== ba) {
        ord = { x, y, ab, ba };
        break;
      }
    }
    expect(ord).not.toBe(null);
    expect(rarePolka(ord.x, ord.y, 0.2, 0.65, false, 1)).toBe(ord.ab);
    expect(rarePolka(ord.x, ord.y, 0.65, 0.2, false, 1)).toBe(ord.ba);
  });

  test("sampled grid: every result is f32-exact within [0,1]", () => {
    for (let i = -3; i <= 3; i++) {
      for (let j = -2; j <= 2; j++) {
        const v = rarePolka(i * 13.75 + 0.5, j * 7.25 - 0.25, 0.2, 0.65, (i & 1) === 0, 1);
        expect(Number.isFinite(v)).toBe(true);
        expect(f32(v)).toBe(v);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// hills.xml fixture — real P1 component data (read this session: 6 blocks,
// material_name lines 196/218/240/262/284/306, band seed {0,0} → [0, 3.5]).
describe.skipIf(!hasNoitaData())("hills.xml fixture (data-gated)", () => {
  const readComps = () => {
    const xmlSrc = fs.readFileSync(path.join(dataDir, "biome", "hills.xml"), "utf-8");
    const blocks = xmlSrc.match(/<MaterialComponent\b[^>]*>/g) ?? [];
    return blocks.map((b) => componentFromXml(b));
  };
  const withRecords = () => {
    const comps = readComps();
    const records = comps.map((c, i) => ({ i, name: c.material_name }));
    return { records, table: buildMaterialsTable(comps, { min: 0, max: 0 }, records) };
  };

  test("6 components parse with the byte-read attrs", () => {
    const comps = readComps();
    expect(comps).toHaveLength(6);
    expect(comps.map((c) => c.material_name)).toEqual([
      "coal", "soil", "sand_static", "coal", "copper", "rock_static",
    ]);
    const [coal1, soil, , coal4, copper, rock] = comps;
    // comp 1 — coal [0.51, 0.55) rare/polka-only:
    expect(coal1.material_min).toBe(f32(0.51));
    expect(coal1.material_min).toBeCloseTo(0.51, 7);
    expect(coal1.material_max).toBe(f32(0.55));
    expect(coal1.material_max).toBeCloseTo(0.55, 7);
    expect(coal1.is_rare).toBe(true);
    expect(coal1.limit_y).toBe(false);
    expect(coal1.limit_min_y).toBe(100);
    expect(coal1.limit_max_y).toBe(2048);
    expect(coal1.material_index).toBe(10);
    expect(coal1.rare_polka_is_boxed).toBe(false); // attr "0" ≠ ctor default 1
    expect(coal1.rare_use_polka).toBe(true);
    expect(coal1.rare_use_perlin).toBe(false);
    expect(coal1.rare_use_fbm_perlin).toBe(false);
    expect(coal1.add_perlin).toBe(false); // attr absent ⇒ ctor default
    expect(coal1.rare_polka_probability).toBeCloseTo(0.160871, 7);
    expect(coal1.rare_polka_radius_low).toBeCloseTo(0.357143, 7);
    expect(coal1.rare_polka_radius_high).toBeCloseTo(0.771429, 7);
    expect(coal1.rare_required_min).toBe(0);
    expect(coal1.rare_required_max).toBeCloseTo(10, 7);
    expect(coal1.rare_scale_x).toBeCloseTo(0.0100004, 7);
    expect(coal1.rare_scale_y).toBeCloseTo(0.00357165, 7);
    // comp 2 — soil [0.45, 0.53) plain with the tight y window:
    expect(soil.is_rare).toBe(false);
    expect(soil.limit_y).toBe(true);
    expect(soil.limit_min_y).toBe(-1024);
    expect(soil.limit_max_y).toBe(f32(424.229));
    expect(soil.limit_max_y).toBeCloseTo(424.229, 4); // f32 ulp 3.05e-5 ⇒ p4
    // comps 4/5 — the only hills components enabling the noise leg:
    expect(coal4.rare_use_perlin).toBe(true);
    expect(copper.rare_use_perlin).toBe(true);
    expect(copper.limit_y).toBe(true);
    expect(copper.limit_min_y).toBe(750);
    // comp 6 — rock [0.9, 3.5] band-closing plain:
    expect(rock.material_min).toBeCloseTo(0.9, 7);
    expect(rock.material_max).toBe(f32(3.5));
    expect(rock.material_max).toBe(3.5);
    expect(rock.is_rare).toBe(false);
  });

  test("band from seed {0,0} accumulates to [0, 3.5] + celldata assign", () => {
    const { table, records } = withRecords();
    expect(table.bandMin).toBe(0);
    expect(table.bandMax).toBe(3.5);
    expect(table.mInitialized).toBe(true);
    expect(table.cellFactory).toBe(true);
    table.components.forEach((c, i) => expect(c.celldata).toBe(records[i]));
  });

  test("decision walk: half-open chain, band edge, limit_y edges", () => {
    const { table, records } = withRecords();
    expect(classify(table, 0, 0, f32(0.45))).toBe(records[1]); // soil lower CLOSED
    expect(classify(table, 0, 0, f32(0.46))).toBe(records[1]); // interior
    expect(classify(table, 0, 0, f32(0.95))).toBe(records[5]); // sand upper OPEN → rock
    expect(classify(table, 0, 0, f32(-1))).toBe(null); // band lower CLOSED at seed 0
    expect(classify(table, 0, 0, f32(3.5))).toBe(null); // rock upper OPEN (and band edge)
    expect(classify(table, 0, -1024, f32(0.46))).toBe(records[1]); // soil closed lower
    expect(classify(table, 0, -1025, f32(0.46))).toBe(null); // no other comp matches 0.46
    expect(classify(table, 0, 424, f32(0.46))).toBe(records[1]);
    expect(classify(table, 0, 425, f32(0.46))).toBe(null); // 425 > f32(424.229)
  });

  test("comp 1 rare walk at v = 0.53: ramp decides coal vs sand", () => {
    const { table, records } = withRecords();
    const ramp = rampRef(0, 0, 0.357143, 0.771429, false, 0.160871); // px=py=0 at (0,0)
    expect(classify(table, 0, 0, f32(0.53))).toBe(ramp > 0 ? records[0] : records[2]);
  });
});
