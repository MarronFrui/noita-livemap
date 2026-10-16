// mapgen/lib/surface-level.mjs — biome <Materials> MaterialComponent build +
// the biome-materials CLASSIFIER, ported from noita_dev.exe
// (md5 8b611494212a69492dd0a4527d9c92e0). dig #96 (Phase 4 step 2):
// module-as-library + tests; dig #97 (Phase 4 step 3) wires these into
// noise-terrain.mjs's SURFACE_V3 default branch (attach-gated @:235;
// chain + classify-frame cites CONSTANTS C76). The PROC_FILL lane
// (template-render.mjs:661) stays unwired until Phase 5.
//
// Every address/byte/constant below was read/verified THIS session from
// /tmp/opencode/fulltext86.asm or PE reads of the exe (.rdata file = VA −
// 0x400E00, .data file = VA − 0x401A00); XML facts from data/biome/*.xml
// greps + reads this session. Slot map + ctor defaults: CONSTANTS.md C74.
//
//   classifier  0x8f5030..0x8f574e (ret $8) — call site 0x90dd7e passes the
//               table in ecx (= [config+0x2a4] = mBiomeMaterials), v as f32
//               in xmm3, x/y as floor-fixed int coords — frame pinned in
//               C76 (x = canvas px, y = canvas py − 24576; edi = x [ebp+8],
//               esi = y [ebp+0xc] — reloaded @0x8f550c/0x8f53f4)
//   builder     0x8f8720 — band store 8f8fe4..8f8fff (replace-if-narrower
//               min/max accumulation), mInitialized := 1 @0x8f9054
//   ramp        0x8fbe60..0x8fbfc3 → rarePolka()
//   cell hashes 0x8f9200 / 0x8f92f0 — K lazy-init 8f9337..8f9359 (K92f0
//               movss 0x11df8b0→0x13476e4, K1 imm 0x3acbdc41→0x13476e8, K2
//               imm 0x3aa32fcf→0x13476ec), reads 8f9365/8f940c/8f9439,
//               K9200 mul directly from rdata @8f92be
//   XML parse   ctor 0x7daeb0 + 3 deserializer passes → C74 slot map
//
// Gate semantics (all byte-confirmed this session):
//   band gate     [bandMin, bandMax] CLOSED        reject → RETURN null (0x8f574c)
//   limit_y gate  [limit_min_y, limit_max_y] CLOSED on (float)y  reject → skip
//   main gate     [material_min, material_max) HALF-OPEN on v′    reject → skip
//   noise out-gate (rare_required_min, rare_required_max]         reject → skip
//   polka out-gate (rare_required_min, rare_required_max]         reject → skip
//   The noise gate FALLS THROUGH into the polka dispatch (8f56b4 → 8f56b6):
//   the legs are SEQUENTIAL — when both are enabled BOTH must pass; polka
//   disabled → straight accept (je 0x8f5740). First match wins (stride 0x84
//   = 132 B, count = (end−begin)/132 recomputed per iter, magic 0x3e0f83e1);
//   accept returns comp.celldata (= [comp+0x04]); miss returns null (0x8f574e).
//
// Tagged deviations / OPENs (sources in the throws and below):
//   - band SEED source unread (accumulation bytes pinned) → band is a param.
//   - membership diag 0x442610 predicate unread → non-null records taken as
//     "found" (P1-consistent, tagged OPEN — the mismatch behavior is unread).
//   - assert printer 0x10078c0 can return al=0 (log-and-continue); port always
//     throws (fail-loud). The game's stdout log at 0x11732d0 is folded into
//     the thrown message (port does not print).
//   - builder material_min>material_max: min≤max → jbe 0x8f8fde (continue);
//     min>max falls through to a log path whose target + strings 0x11735f0..
//     are UNREAD (OPEN) → port throws instead of guessing.
//   - lookup 0x741890 / record RESOLVE (material_name → +0x04) unread →
//     celldata comes from the caller (parallel array).
//   - jitter 0x9119d0 / fbm 0x9fad90 / polygon 0x10096a0 bodies unread →
//     honest throws (all three arms P1-dead per this session's censuses).
//   - simplex2DDeriv reused from noise-proto.mjs:422 — INHERITS its FLAGGED
//     runtime skew BSS 0x132ab68/0x132ac70 (UNPINNED).

import { simplex2DDeriv } from "./noise-proto.mjs";

// ---------------------------------------------------------------------------
// Assert format (0x1150f60) + file string (0x1173240), PE-read this session.
// Assert CODES are line numbers in the file below; expr strings PE-verified:
// mInitialized 0x118c9f4 (line 0xfe=254), component 0x1151e28 (0x107=263),
// mCellFactory 0x11732c0 (0x108=264), false&&… 0x1173304 (0x10f=271),
// polygon.size>=3 0x1173340 (0x118=280).
const FILE = String.raw`d:\projects\nollagames\fallingeverything\build\vc12\..\..\source\procedural_utils\biome_materials.cpp`;
function assertLine(expr, line) {
  return `Assert failed: (${expr}) in ${FILE} at line ${line}`;
}

// Cell-fold constants (all f32, PE-verified this session):
//   Q     0x11df8f4 = 0.014084506779909134
//   26    0x11e01f8   161  0x11e031c   71  0x11e02b8
const FOLD_Q = 0.014084506779909134;
const FOLD_BASE_X = 26;
const FOLD_BASE_Y = 161;
const FOLD_MUL = 71;
// Hash multipliers (f32): K9200 rdata 0x11df8ac used directly @8f92be;
// K92F0 rdata 0x11df8b0 → 0x13476e4; K1/K2 = imm32s into 0x13476e8/ec.
const K9200 = 0.00101319863460958;
const K92F0 = 0.0010513747110962868;
const K1 = 0.0015553311677649617; // f32 bits 0x3acbdc41 @8f934f
const K2 = 0.0012450161157175899; // f32 bits 0x3aa32fcf @8f9359

// Shared cell fold: t − 71·⌊FOLD_Q·t⌋ + base, byte order mulss→cvttss2si
// (+comiss/dec floor-fix = Math.floor)→cvtdq2ps→mulss 71→subss→addss (8f9376..8f93d8).
function fold(t, base) {
  const q = Math.fround(FOLD_Q * t);
  const fl = Math.fround(Math.floor(q));
  const m = Math.fround(FOLD_MUL * fl);
  return Math.fround(Math.fround(t - m) + base);
}
// frac via cvttss2si→cvtdq2ps→subss (inputs ≥ 0 here, trunc = floor).
function frac(t) {
  return Math.fround(t - Math.fround(Math.trunc(t)));
}
// 0x8f9200 — ecx = &[floorX, floorY] (f32 pair), r1 in xmm0: frac(K9200·fy²·fx²).
function hash9200(x, y) {
  const fx = fold(x, FOLD_BASE_X); // 26 → xmm4 @8f9209
  const fy = fold(y, FOLD_BASE_Y); // 161 → xmm5 @8f9214
  const p = Math.fround(Math.fround(fy * fy) * Math.fround(fx * fx));
  return frac(Math.fround(K9200 * p)); // mulss 0x11df8ac @8f92be
}
// 0x8f92f0 — same cell input, edx = &out[3] in the binary: [w0, w1, r2] =
// [frac(K92F0·P), frac(K1·P), frac(K2·P)] (8f93e8/8f940c/8f9439).
function hash92f0(x, y) {
  const fx = fold(x, FOLD_BASE_X);
  const fy = fold(y, FOLD_BASE_Y);
  const p = Math.fround(Math.fround(fy * fy) * Math.fround(fx * fx));
  return [
    frac(Math.fround(K92F0 * p)),
    frac(Math.fround(K1 * p)),
    frac(Math.fround(K2 * p)),
  ];
}

// ---------------------------------------------------------------------------
// componentFromXml — ctor 0x7daeb0 defaults + the C74 attr→slot map applied
// to one `<MaterialComponent …>` block (attr regex: every data/biome block is
// double-quoted `name="value"`, 23-attr census this session).
const F32_ATTRS = new Set([
  "material_min", "material_max", "add_perlin_scale_x", "add_perlin_scale_y",
  "limit_min_y", "limit_max_y", "rare_scale_x", "rare_scale_y",
  "rare_offset_x", "rare_offset_y", "rare_polka_radius_low",
  "rare_polka_radius_high", "rare_polka_probability",
  "rare_required_min", "rare_required_max",
]);
const BOOL_ATTRS = new Set([
  "add_perlin", "is_rare", "limit_y", "rare_use_perlin",
  "rare_use_fbm_perlin", "rare_use_polka", "rare_offset_by_seed",
  "rare_polka_is_boxed", "is_polygon",
]);
// Registered attr names whose parse we do not implement: absent from the
// 23-attr data/biome census this session (celldata comes from the parse
// context — `mov %ecx,0x4(%eax)` @0x8f3650/0x8f3a04; polygon = child list).
const UNREAD_ATTRS = new Set(["celldata", "polygon"]);
// `_enabled` is registered?? No — absent from all three deserializer passes
// (C74) → the game has no slot for it; census this session: 1096 × "1",
// 0 × "0" across data/biome/*.xml → ignored (never disables in P1).
const IGNORED_ATTRS = new Set(["_enabled"]);

function parseF32(name, v) {
  const n = Number(v); // Number("") = 0, Number("abc") = NaN → both rejected below
  if (v.trim() === "" || !Number.isFinite(Math.fround(n))) {
    // fail-loud on empty/NaN/Inf AND on f32 overflow (the game's strtof
    // ERANGE/±inf behavior is unread; P1 data has neither — census this session).
    throw new Error(`surface-level: componentFromXml: attribute ${name}="${v}" is not a finite f32`);
  }
  return Math.fround(n); // slots are f32 (movss/comiss in the classifier)
}
function parseBool(name, v) {
  if (v === "1") return true;
  if (v === "0") return false;
  // Only "0"/"1" occur for every bool attr (23-attr census this session);
  // the game's parse of anything else is unread → fail-loud.
  throw new Error(`surface-level: componentFromXml: bool attr ${name}="${v}" (only "0"/"1" occur in data; other values unread)`);
}

export function componentFromXml(xml) {
  if (typeof xml !== "string" || !xml.includes("<MaterialComponent")) {
    throw new Error("surface-level: componentFromXml expects one <MaterialComponent …> block string");
  }
  const comp = {
    celldata: null, // +0x04 (C74); assigned by buildMaterialsTable
    material_name: "", // +0x08 SSO (size +0x18 = 0, cap +0x1c = 0xf)
    material_index: 10, // +0x20
    material_min: Math.fround(0.1), // +0x24 ctor 0.1f
    material_max: Math.fround(0.1), // +0x28 ctor 0.1f
    add_perlin: false, // +0x2c
    add_perlin_scale_x: 1, // +0x30 ctor 1.0f
    add_perlin_scale_y: 1, // +0x34 ctor 1.0f
    is_rare: false, // +0x38 (ctor word 0 with limit_y)
    limit_y: false, // +0x39
    limit_min_y: Math.fround(100), // +0x3c ctor 100.0f
    limit_max_y: Math.fround(2048), // +0x40 ctor 2048.0f
    rare_use_perlin: false, // +0x44 (ctor word 0 with fbm)
    rare_use_fbm_perlin: false, // +0x45
    rare_use_polka: true, // +0x46 ctor 1 (!)
    rare_scale_x: Math.fround(0.05), // +0x48 ctor 0.05f
    rare_scale_y: Math.fround(0.05), // +0x4c ctor 0.05f
    rare_offset_by_seed: false, // +0x50
    rare_offset_x: 0, // +0x54 ctor 0 (type unread; P1-absent attr)
    rare_offset_y: 0, // +0x58 ctor 0
    rare_polka_radius_low: Math.fround(0.2), // +0x5c ctor 0.2f
    rare_polka_radius_high: Math.fround(0.65), // +0x60 ctor 0.65f
    rare_polka_is_boxed: true, // +0x64 ctor 1 (!)
    rare_polka_probability: Math.fround(0.2), // +0x68 ctor 0.2f
    rare_required_min: Math.fround(0.2), // +0x6c out-gate lo default
    rare_required_max: Math.fround(1), // +0x70 ctor 1.0f (out-gate hi)
    is_polygon: false, // +0x74
    polygon: [], // +0x78 vector (init fn 0x92baa0 = empty)
  };
  // (dig #147 — polygon vertex list, loaded from the XML child element)
  // The attr-tagged "polygon" key in UNREAD_ATTRS stays unread (it is an
  // attr mis-census by design — the bytes live in the nested child).
  // Cargo-shape (<polygon><Vec2 x="" y=""/></polygon>) mirrors the game's
  // init fn 0x92baa0 loader (a stride-8 vertex list into +0x78..+0x7c).
  {
    const mPoly = /<polygon[^>]*>([\s\S]*?)<\/polygon>/i.exec(xml);
    if (mPoly) {
      for (const vm of mPoly[1].matchAll(/<\s*Vec\s*2\s+([^>]*?)\/?>/gi)) {
        const tag = vm[1];
        const xy = /x\s*=\s*"([^"]*)"/.exec(tag);
        const yy = /y\s*=\s*"([^"]*)"/.exec(tag);
        if (!xy || !yy) {
          throw new Error(`surface-level: componentFromXml: malformed polygon vertex "${tag}"`);
        }
        const vx = Number(xy[1]);
        const vy = Number(yy[1]);
        if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
          throw new Error(`surface-level: componentFromXml: polygon vertex ("${xy[1]}", "${yy[1]}") is not a finite float`);
        }
        comp.polygon.push({ x: Math.fround(vx), y: Math.fround(vy) });
      }
    }
  }

  const startTagMatch = /^\s*<MaterialComponent\b[^>]*>/i.exec(xml);
  const scope = startTagMatch ? startTagMatch[0] : xml;
  for (const [, name, value] of scope.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/g)) {
    if (IGNORED_ATTRS.has(name)) continue; // no slot — see census above
    if (UNREAD_ATTRS.has(name)) {
      throw new Error(
        `surface-level: componentFromXml: attribute ${name} is registered (C74) but its parse is unread and it appears in 0 data/biome files (23-attr census this session)`,
      );
    }
    if (F32_ATTRS.has(name)) comp[name] = parseF32(name, value);
    else if (BOOL_ATTRS.has(name)) comp[name] = parseBool(name, value);
    else if (name === "material_name") comp[name] = value;
    else if (name === "material_index") {
      const n = Number(value);
      if (!Number.isInteger(n)) throw new Error(`surface-level: componentFromXml: material_index="${value}" is not an integer`);
      comp[name] = n;
    } else {
      // Fail-loud: not in the C74 slot map. (The binary's unknown-attr
      // behavior is unread; data/biome has none besides _enabled.)
      throw new Error(`surface-level: componentFromXml: unknown attribute "${name}" (not in the C74 slot map)`);
    }
  }
  return comp;
}

// ---------------------------------------------------------------------------
// buildMaterialsTable — from fn 0x8f8720: per-comp min/max accumulation onto
// a seed band (8f8fe4..8f8fff: replace only when the comp is narrower), the
// parse-time celldata assign idiom, mInitialized := 1 (@0x8f9054) and a
// truthy mCellFactory (table+0x30 — the classifier asserts both).
//
// band = {min, max}: the game's SEED for table[+0]/[+4] is UNREAD (OPEN) —
// accumulation bytes are pinned, the initial value is not — so the seed is a
// caller param per the dig-#96 plan (band-as-param fallback).
// celldata = array parallel to components (record RESOLVE / lookup 0x741890
// unread per C74 → caller supplies; missing entries leave +0x04 null, which
// the classifier then rejects via the 0x10f/skip path).
export function buildMaterialsTable(components, band, celldata) {
  if (!Array.isArray(components)) {
    throw new Error("surface-level: buildMaterialsTable(components, band, celldata): components must be an array");
  }
  if (!band || !Number.isFinite(band.min) || !Number.isFinite(band.max)) {
    throw new Error("surface-level: buildMaterialsTable: band must be {min, max} finite numbers (game's seed value unread — required param)");
  }
  let bandMin = Math.fround(band.min);
  let bandMax = Math.fround(band.max);
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    if (comp == null) {
      // The binary's builder derefs the comp (lea slots) → AV; port is fail-loud.
      throw new Error(`surface-level: buildMaterialsTable: null component at [${i}] (game would deref → AV)`);
    }
    const min = Math.fround(comp.material_min);
    const max = Math.fround(comp.material_max);
    if (!(min <= max)) {
      // Game: min≤max → jbe 0x8f8fde (continue); min>max falls through to a
      // log path whose target + strings (0x11735f0..) are UNREAD (OPEN).
      throw new Error(
        `surface-level: buildMaterialsTable: comp [${i}] "${comp.material_name}" has material_min (${min}) > material_max (${max}) — game's min>max log path (target + strings 0x11735f0..) is unread (OPEN)`,
      );
    }
    // band accumulation — byte order: min first (8f8fe4..8f8ff1), max (8f8ff5..8f8fff)
    if (min < bandMin) bandMin = min;
    if (max > bandMax) bandMax = max;
    // parse-time assign `mov %ecx,0x4(%eax)` @0x8f3650/0x8f3a04 (ecx = [ctx+0x28])
    comp.celldata = celldata && i < celldata.length ? (celldata[i] ?? null) : null;
  }
  return {
    components, // table+0x08/+0x0c vector (stride 0x84 = 132 B in the binary)
    bandMin, // table+0x00 f32 band lo (closed gate)
    bandMax, // table+0x04 f32 band hi (closed gate)
    mInitialized: true, // table+0x2c byte, :=1 @0x8f9054; assert 0xfe (line 254)
    cellFactory: true, // table+0x30 ptr; null → assert 0x108 (line 264) @0x8f5224
  };
}

// ---------------------------------------------------------------------------
// classify — 0x8f5030: first-match material decision for one cell.
// x/y = integer cell coords (the caller floor-fixes at 0x90dd7e; not re-floored
// here), v = raw f32 evaluator value. Returns comp.celldata | null.
export function classify(table, x, y, v) {
  if (table == null) {
    // Game: ecx = [config+0x2a4] dereferenced at the prologue → AV; fail-loud.
    throw new Error("surface-level: classify: null table (game derefs table+0x2c at entry → AV)");
  }
  if (table.mInitialized !== true) assertThrow("mInitialized", 254);
  if (!Array.isArray(table.components)) {
    throw new Error("surface-level: classify: table.components must be an array (game = vector ptrs table+0x08/+0x0c, null → AV)");
  }
  const vF = Math.fround(v);
  const bandLo = Math.fround(table.bandMin);
  const bandHi = Math.fround(table.bandMax);
  // band gate CLOSED both ends → reject returns null (comiss/ja → 0x8f574c)
  if (!(vF >= bandLo)) return null;
  if (!(vF <= bandHi)) return null;

  const comps = table.components;
  for (let i = 0; i < comps.length; i++) {
    const comp = comps[i];
    if (comp == null) assertThrow("component", 263); // loop head → assert 0x107
    if (!table.cellFactory) assertThrow("mCellFactory", 264); // @0x8f5224 → 0x108

    // celldata diag @0x8f52e9: null record + name≠"" → game logs 0x11732d0
    // then asserts 0x10f (line 271); null + empty name defers to the second
    // null check at 0x8f5572 (below, after limit/polygon — byte order kept).
    // Non-null record → membership diag 0x442610 whose predicate is UNREAD
    // (OPEN); P1-consistent → taken as found here (tagged in the header).
    if (comp.celldata == null && comp.material_name.length !== 0) {
      throw new Error(
        `surface-level: Error! couldn't find material: ${comp.material_name}\n` + // log @0x11732d0 (game prints; port folds)
        `surface-level: ${assertLine('false && "this should be done outside of this"', 271)}`,
      );
    }

    // limit_y gate @0x8f53f0 (flag +0x39 `cmpb`) — slots +0x3c/+0x40
    // (`movss 0x3c(%ebx)` @0x8f53f9, `comiss 0x40(%ebx)` @0x8f540e), CLOSED
    // on (float)y, reject = skip (ja → 0x8f5704)
    if (comp.limit_y) {
      const yF = Math.fround(y);
      if (!(yF >= Math.fround(comp.limit_min_y))) continue;
      if (!(yF <= Math.fround(comp.limit_max_y))) continue;
    }

    // polygon arm @0x8f5418 (flag +0x74; vector begin/end +0x78/+0x7c, count
    // = (end−begin)>>3 @0x8f5422..0x8f5428) — count<3 → assert 0x118 (line
    // 280), else point query 0x10096a0 (signed-mod-512 + 1/512 scale).
    // Body UNREAD → throw.
    // --- polygon arm @0x8f5418 → 0x10096a0 (BYTE-READ dig #147; PROVEN
    // byte-perfect even-odd per the unsigned+bias algo below at line
    // 0x10096a9: test-point ≈ mod512×(1/512) of both x and y).
    if (comp.is_polygon) {
      if (comp.polygon.length < 3) {
        throw new Error(assertLine("polygon.size() >= 3", 280));
      }
      const px = modSigned512Float(x);
      const py = modSigned512Float(y);
      if (!pointInPolygon(comp.polygon, px, py)) continue;
    }

    // second null check @0x8f5572 — record still null → skip comp
    if (comp.celldata == null) continue;

    // v′ @0x8f557c..0x8f55b1: add_perlin → simplex over RAW x/y scaled by
    // add_perlin_scale_{x,y} ([comp+0x30]/[+0x34]), then v′ = fround(s32 + v).
    // Call args (byte order): xin = f64(f32(x)·scale_x), yin = f64(f32(y)·scale_y).
    let vGate = vF;
    if (comp.add_perlin) {
      const nx = Math.fround(Math.fround(x) * comp.add_perlin_scale_x);
      const ny = Math.fround(Math.fround(y) * comp.add_perlin_scale_y);
      const s32 = Math.fround(simplex2DDeriv(nx, ny)); // cvtsd2ss @0x8f55ad
      vGate = Math.fround(s32 + vF); // addss -0x8(%ebp) @0x8f55b1
    }
    // main gate HALF-OPEN [min, max) on v′ (jb @0x8f55b6 / jbe @0x8f55c5)
    if (!(vGate >= Math.fround(comp.material_min))) continue;
    if (!(vGate < Math.fround(comp.material_max))) continue;

    if (!comp.is_rare) return comp.celldata; // accept @0x8f5740 = [comp+0x04]

    // ---- rare path ----
    // transform @0x8f55dc..0x8f560b (always; offsets +0x54/+0x58 included):
    // px = fround(f32(x)·rare_scale_x + rare_offset_x), py likewise.
    const px = Math.fround(Math.fround(Math.fround(x) * comp.rare_scale_x) + comp.rare_offset_x);
    const py = Math.fround(Math.fround(Math.fround(y) * comp.rare_scale_y) + comp.rare_offset_y);

    // jitter head @0x8f55d8 (flag +0x50 `cmpb`, je 0x8f5678 = skip; call
    // 0x9119d0) — body UNREAD.
    if (comp.rare_offset_by_seed) {
      throw new Error(
        "surface-level: jitter arm not ported (rare_offset_by_seed=1): rng 0x9119d0 unread. " +
        "Census this session: rare_offset_by_seed absent from data/biome/*.xml (0 files).",
      );
    }

    const rMin = Math.fround(comp.rare_required_min);
    const rMax = Math.fround(comp.rare_required_max);

    // noise leg @0x8f5678: rare_use_perlin off → straight to polka dispatch.
    if (comp.rare_use_perlin) {
      if (comp.rare_use_fbm_perlin) {
        throw new Error(
          "surface-level: fbm arm not ported (rare_use_fbm_perlin=1): 0x9fad90 unread. " +
          "Census this session: rare_use_fbm_perlin absent from data/biome/*.xml (0 files).",
        );
      }
      // plain arm @0x8f5694: simplex over the TRANSFORMED px/py, f64-widened.
      const noise = Math.fround(simplex2DDeriv(px, py));
      // out-gate (min, max] @0x8f56a6..0x8f56b4 (jae / ja → skip 0x8f5704)
      if (!(noise > rMin)) continue;
      if (!(noise <= rMax)) continue;
      // fall-through = polka dispatch @0x8f56b6 (sequential legs)
    }

    // polka leg @0x8f56b6: disabled → accept (je 0x8f5740)
    if (!comp.rare_use_polka) return comp.celldata;
    // call @0x8f56c0..0x8f56e5: px→xmm0, py→xmm1, low [0x5c]→xmm2,
    // high [0x60]→xmm3, is_boxed [0x64]→cl, probability [0x68]→stack.
    const ramp32 = Math.fround(rarePolka(
      px, py,
      comp.rare_polka_radius_low,
      comp.rare_polka_radius_high,
      comp.rare_polka_is_boxed,
      comp.rare_polka_probability,
    ));
    // out-gate (min, max] @0x8f56f4..0x8f5702 (jae → skip / jbe → ACCEPT)
    if (!(ramp32 > rMin)) continue;
    if (ramp32 > rMax) continue;
    return comp.celldata;
  }
  return null; // miss @0x8f574e (xor eax, ret $8)
}

function assertThrow(expr, line) {
  throw new Error(`surface-level: ${assertLine(expr, line)}`);
}

// ---------------------------------------------------------------------------
// rarePolka — ramp fn 0x8fbe60..0x8fbfc3 (all f32 ops, f64-widened return).
// px/py = f32 transformed coords, low/high/boxed/prob = comp slots
// (+0x5c/+0x60/+0x64/+0x68), boxed coerced from the cl register.
// Flow (byte order): floor-fix cell → r1 = hash9200(cell) → r1 ≥ prob → 0 →
// fracX/fracY → [w0,w1,r2] = hash92f0(cell) → R = low+(high−low)·r2 → R ≤ 0 → 0
// → k = 2/R → p = (k−2)·w1 + (fracY·k − (k−1)), q = (k−2)·w0 + (fracX·k − (k−1))
// → boxed: p⁴+q⁴ ≤ 1 else 0, d = p⁴+q⁴ · unboxed: d = p²+q², d ≥ 1 → d = 1
// → (1−d)³ as f32, widened to f64.
export function rarePolka(px, py, low, high, boxed, prob) {
  const px32 = Math.fround(px);
  const py32 = Math.fround(py);
  const low32 = Math.fround(low);
  const high32 = Math.fround(high);
  const prob32 = Math.fround(prob);

  const cellX = Math.fround(Math.floor(px32)); // cvttss2si + comiss/dec fix
  const cellY = Math.fround(Math.floor(py32)); // → cvtdq2ps stores -0x1c/-0x18
  if (!(hash9200(cellX, cellY) < prob32)) return 0; // comiss prob @0x8fbec7 jae → 0

  const fracX = Math.fround(px32 - cellX); // subss → -0x8
  const fracY = Math.fround(py32 - cellY); // subss → -0xc
  const [w0, w1, r2] = hash92f0(cellX, cellY); // call @0x8fbf01, out -0x28/-0x24/-0x20

  const range = Math.fround(high32 - low32); // subss
  const R = Math.fround(Math.fround(range * r2) + low32); // mulss, addss
  if (!(R > 0)) return 0; // xorps(0) vs R @0x8fbf1d jae (0 ≥ R) → pre-zeroed return

  const k = Math.fround(2 / R); // divss from const 2.0 (0x11dfe68)
  const km1 = Math.fround(k - 1); // subss const 1.0 (0x11dfbf0)
  const km2 = Math.fround(k - 2); // subss const 2.0 (0x11dfe68)
  const p = Math.fround(Math.fround(km2 * w1) + Math.fround(Math.fround(fracY * k) - km1)); // xmm2 @0x8fbf70
  const q = Math.fround(Math.fround(km2 * w0) + Math.fround(Math.fround(fracX * k) - km1)); // xmm0 @0x8fbf74
  const p2 = Math.fround(p * p);
  const q2 = Math.fround(q * q);
  let d;
  if (boxed) { // cl test @0x8fbf80
    d = Math.fround(Math.fround(p2 * p2) + Math.fround(q2 * q2)); // p⁴+q⁴
    if (!(d <= 1)) return 0; // comiss 1.0 @0x8fbf90 jbe-converge, else 0
  } else {
    d = Math.fround(p2 + q2); // p²+q² @0x8fbf9f
    if (!(1 > d)) d = 1; // ja keep when d < 1; else clamp to 1.0
  }
  const t = Math.fround(1 - d); // subss @0x8fbfab
  return Math.fround(Math.fround(t * t) * t); // two mulss → cvtps2pd widen (exact in JS)
}

// dig #147 -- helpers for the polygon arm (point-in-polygon, byte-level)
function modSigned512Int(n) {
  let a = n | 0;
  a = a & 0x800001ff;
  if (a < 0) {
    a = (a - 1) | 0;
    a = (a & 0xfffffe00) | 0;
    a = (a + 1) | 0;
    if (a < 0) a = a + 0x200;
  }
  return a;
}
function modSigned512Float(n) {
  return Math.fround((modSigned512Int(n) | 0) * (1.0 / 512.0));
}
function pointInPolygon(poly, tx, ty) {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  const testX = Math.fround(tx);
  const testY = Math.fround(ty);
  let inside = false;
  let prevX = Math.fround(poly[poly.length - 1].x);
  let prevY = Math.fround(poly[poly.length - 1].y);
  for (let i = 0; i < poly.length; i++) {
    const curX = Math.fround(poly[i].x);
    const curY = Math.fround(poly[i].y);
    const prevGe = (prevY >= testY);
    const curGe  = (curY  >= testY);
    if (prevGe !== curGe) {
      // even-odd cross X at +X direction
      const edgeX = Math.fround(curX - prevX);
      const edgeY = Math.fround(curY - prevY);
      const t = Math.fround(testY - prevY);
      const xIntersect = (edgeY === 0) ?
        Math.fround(prevX + curX) :             // degenerate horizontal
        Math.fround(Math.fround(prevX) + Math.fround(Math.fround(edgeX) * Math.fround(t / edgeY)));
      // closing byte all-paths normalize via 1/512 already; compare floats
      if ((testX < xIntersect) || testX === xIntersect) {
        inside = !inside;
      }
    }
    prevX = curX;
    prevY = curY;
  }
  return inside;
}

export { pointInPolygon, modSigned512Float };
