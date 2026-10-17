// mapgen/lib/noise-terrain.mjs — F3 noise-terrain integration (2026-09-20)
import fs from "node:fs";
import path from "node:path";
//
// Binary-derived per ABOUT_MATH 2026-09-19 (12)/(13) + 2026-09-20 (15)/(16):
//   - the noise evaluator = true 0x908e70 (lower clamp at 0.5, single
//     anisotropic q warping both axes, C30) — via lib/noise-proto.mjs
//   - the sampler gate (FUN_0090d860, slab 0x50d3c3) = process cells only
//     when the field value > 0.5 (comiss 0x11dfa94)
//   - per-cell noise input = the cell coords + the per-biome "Wang offset"
//     doubles (C24 runtime config; the port's BIOME_PATH_FIND_WORLD_POS_*
//     159/223 = the engine ConfigRegistry defaults, @prov noitool) — the
//     noise layer's spatial diversity is LOCATION-driven (C27/C28: one
//     seed draw per generator cell, no per-cell RNG in the noise itself)
//   - the 10-px wang cell is the noise input unit: noiseTransform's
//     (adj+0.5)·0.1 recovers the CELL index (C26: f64 0.1 @0x11dfd08).
//
// SHAPE-FIRST approximation (user mandate 2026-09-20): solid where the
// binary evaluator value passes the sampler's own >0.5 gate. Material IDs
// are shape-only (config-side naming 0xb78e0/0x603fd0 stays out of scope;
// I4/I7 render artifacts still apply). The C24 offsets are engine runtime
// config — the only non-static constants used here, tagged @prov noitool
// per CONSTANTS.md::C24.

import { K2, evaluator2, noiseDispatch, surfaceField } from "./noise-proto.mjs";
import { biomeAt } from "./biomes.mjs";
import { buildCavesField } from "./caves-field.mjs";
import { readPng } from "./images.mjs";
import { findNoitaDataDir } from "./paths.mjs";
import {
  componentFromXml,
  buildMaterialsTable,
  classify,
} from "./surface-level.mjs";

// dig #30: the caves-field cache (the binary's std::map @0x132aae8
// semantics — one cached cave grid per (seed, CaveStructure package);
// the bytes are (seed, name)-deterministic per the C49 proof).
// dig #101 CORRECTION: keyed by the biome FILE, not def.name — Noita's
// biome name attr is empty for hills/hills2/mountain_tree (census this
// session: all three def.name = "_EMPTY_"), so the old `${def.name}|${seed}`
// key collided across biomes sharing that slot (measured: hills chunks
// served another _EMPTY_ biome's grid ⇒ mask ≠ test mirror). A per-biome
// config identity matches the binary's per-package keying (game memo
// keyed &config+0xa8 = the per-config address, VERIFIED:600).
const cavesFieldCache = new Map(); // key -> buildCavesField result
const dataDirRef = { dataDir: null };
function ensureCavesField(dataDir, def, seed) {
  if (dataDir && !dataDirRef.dataDir) dataDirRef.dataDir = dataDir;
  if (!dataDirRef.dataDir) dataDirRef.dataDir = findNoitaDataDir();
  const key = `${def.filename ?? def.name}|${seed}`;
  let entry = cavesFieldCache.get(key);
  if (entry) return entry;
  entry = buildCavesField(dataDir, def, seed);
  cavesFieldCache.set(key, entry);
  return entry;
}

// dig #97 (C76): the biome <Materials> table feeding the SURFACE_V3
// classify chain — cached per XML file (classify mutates nothing; the
// comps are owned by this cache and take their celldata records at build
// time). No <MaterialComponent> blocks → null = the game's
// mBiomeMaterials == 0 arm (@0x90dd01 → je @0x90ddb0) → air. The band
// seed {min:0, max:0} is the documented proxy — the game's seed init is
// unread (OPEN, C76) and buildMaterialsTable's extend-if-narrower rule
// makes the real band = the comps' hull ∪ {0,0} = [0, 3.5] for hills.
// dig #133 (I32 p2c, the SKY/Hell layer law): ONE sky backdrop for every
// world row above the datum (canvas py < 31744 = bty 0..13 + the vmap
// sky above, all the way up to the Heaven end) — the parallax gradient
// (weather_gfx/parallax_background.png: blue high → warm at the horizon)
// + the star sprite (star_007.png) at hash-deterministic positions.
// The per-biome bg art (cave_04_alt etc.) = the UNDERGROUND bands only
// (bty ≥ 14); the hills def's cave-bg declaration does NOT paint the sky
// (the user's in-game observation + the biome-map rows 1..12 = hills with
// sky visible). Hell = the_end's own background_the_end.png (its
// declaration; the template-lane air bg for the hell rows = tagged OPEN).
const skyBackdropCache = { done: false, sky: null, star: null };
function ensureSkyBackdrop(dataDir) {
  if (skyBackdropCache.done) return skyBackdropCache;
  skyBackdropCache.done = true;
  const dir = dataDir ?? dataDirRef.dataDir;
  try {
    const sky = readPng(path.join(dir, "weather_gfx/parallax_background.png"));
    skyBackdropCache.sky = { w: sky.width, h: sky.height, px: sky.data };
    const star = readPng(path.join(dir, "weather_gfx/star_007.png"));
    skyBackdropCache.star = { w: star.width, h: star.height, px: star.data };
  } catch { /* missing art → transparent sky (honest) */ }
  return skyBackdropCache;
}
const skyStarHash = (cx, cy) =>
  (Math.imul(cx, 2654435761) ^ Math.imul(cy, 340573321)) >>> 0;

const surfaceTableCache = new Map(); // def.filename -> table | null
// dig #132 (I32 p2b): the per-biome AIR backdrop — the Topology
// background_image loaded once per def; {w,h,pixels} | {fill} | null.
const backdropCache = new Map(); // def.filename -> backdrop | null
export function ensureBiomeBackdrop(dataDir, def) {  if (!def?.filename) return null;
  if (backdropCache.has(def.filename)) return backdropCache.get(def.filename);
  let bd = null;
  const rel = def.backgroundImage;
  if (rel) {
    try {
      const png = readPng(path.join((dataDir ?? dataDirRef.dataDir), rel.replace(/^data\//, "")));
      bd = { w: png.width, h: png.height, pixels: png.data, fill: null };
    } catch { bd = null; } // unreadable/missing bg art → transparent air (honest)
  }
  backdropCache.set(def.filename, bd);
  return bd;
}
function ensureSurfaceTable(dataDir, def) {
  if (!def.filename) return null;
  if (surfaceTableCache.has(def.filename)) return surfaceTableCache.get(def.filename);
  let table = null;
  const dir = dataDir ?? dataDirRef.dataDir;
  if (dir) {
    const xml = fs.readFileSync(path.join(dir, def.filename.replace(/^data\//, "")), "utf-8");
    // XML comments are NOT components: the game's parser never sees
    // commented-out elements. dig #147 matched RAW text and built PHANTOM
    // tables — temple_wall/boss_arena/end_wall ship ALL their polygon comps
    // inside <!-- --> and wandcave 1 of 4 (census 647 raw → 640 active,
    // 128 files: experiments/2026-10-16-dig148-xml-comp-census.mjs) — the
    // phantom polygon comps painted rock_hard_border diamonds the game
    // never renders (the retracted #147 "temple_wall 398" pin).
    // Capture the FULL component body, including child <polygon> blocks —
    // the polygon arm @0x8f5418 reads comp's vertex list (+0x78..+0x7c),
    // which surface-level.mjs parses from the nested <Vec2/> nodes.
    const xmlActive = xml.replace(/<!--[\s\S]*?-->/g, "");
    if (/<MaterialComponent\b[^>]*\/>/.test(xmlActive)) {
      // the full-body matcher below would silently DROP a self-closing
      // component (fail loud instead; none exists in shipped data as of
      // dig #148 — swept biome/*.xml + biome_impl/*.xml).
      throw new Error(`noise-terrain: ensureSurfaceTable: self-closing <MaterialComponent/> in ${def.filename} would be dropped by the full-body matcher`);
    }
    const blocks = xmlActive.match(/<MaterialComponent\b[^>]*>[\s\S]*?<\/MaterialComponent>/g) ?? [];
    if (blocks.length > 0) {
      const comps = blocks.map((b) => componentFromXml(b));
      const records = comps.map((c, i) => ({ i, name: c.material_name }));
      table = buildMaterialsTable(comps, { min: 0, max: 0 }, records);
    }
  }
  surfaceTableCache.set(def.filename, table);
  return table;
}

const CHUNK = 512; // (matches world-gen CHUNK; local to avoid the ESM cycle)
const CELLS_PER_CHUNK = CHUNK / 10; // 51.2 → subrect 0..51 (C11 grid shape — cell 51 is the 20px remainder)

// dig #31 revert made canonical (VERIFIED.md §12, the no-guessing mandate):
// the true-0x90a860 lane is OPT-IN again — the ramp `gradAt` placeholder (and
// the un-carve'd caves lane) all-solid masks must not ship as default; the
// honest default render = template painter + the art scenes + wang areas,
// with the procedural-noise band deprecated to env opt-in for A/B
// instruments. Flip with SURFACE_V2=1 (V2 lane) and/or SURFACE_V3=1 (the
// caves-field composition lane, still flagged placement).
const SURFACE_V2 = process.env.SURFACE_V2 === "1";
const SURFACE_V3 = process.env.SURFACE_V3 === "1";

// Per-biome "Wang offset" (C24/C28): ConfigRegistry defaults, engine-side.
// Tagged @prov noitool (the 159/223 family); validated only at runtime.
function biomeCfg(_biome) {
  return { minX: 159.0, maxX: 223.0 };
}

// ============ THE BAND-RAMP DRIVER FRAME (dig #142, C119/C113) ============
// The kind-0 r-site (true 0x90B280, dig #142) reads its bands through a
// frame object: baseX/baseY (Phase G's world origin), the 70x48 tile
// grid dims, bandCount, the Phase-S x-seed slot, and the two accessors
// (GetAt on the biome matrix / the 0x909C70 cell accessor).
const f = Math.fround;

// bandBlockOf — the per-biome band block = the slots bandParams
// (true 0x90B680) reads off the band pointer (C118 key map; f32 slots
// stored f32-rounded, C116 defaults — dig #142). Also spread into uid
// (uidFrom below) because the two r-eval config arms pass the uid itself
// as the band.
export function bandBlockOf(def) {
  if (!def) return null;
  const n = (v, d) => { const p = parseFloat(v); return Number.isFinite(p) ? p : d; };
  return {
    gradStartY: f(n(def.mGradientStartY, -512)),      // f32 [+0x270]
    gradEndY: f(n(def.mGradientEndY, 512)),           // f32 [+0x274]
    gradSlopeStartX: n(def.mGradientSlopeStartX, 0),  // f64 [+0x278]
    gradSlopeDelta: n(def.mGradientSlopeDelta, 1.0),  // f64 [+0x280] (ctor default 1.0 — movsd %xmm1 @0x49615d, [0x11e0b40] f64 1.0; dig #145 — the port's old 0.01 was invented)
    mode: n(def.mGradientAddNoise, 1) | 0,            // i32 [+0x288] (ctor default 1)
    gradNoiseScale: n(def.mGradientNoiseScale, 0),    // f64 [+0x290] (ctor default 0)
    gradLowNoise: f(n(def.mGradientLowNoise, -100)),  // f32 [+0x298]
    gradHighNoise: f(n(def.mGradientHighNoise, 100)), // f32 [+0x29C]
  };
}

// phaseSXBase — Init Phase S (x72.dis 0x9060fd..0x9061d0; X72 window)
// computed LOCALLY: GetSeed's diddled f64 seed ({0.0, 2^32} by sign bit,
// [eax*8+0x11E0BA0]) → the 0x452BA0 ctor clamp (>= 2147483647.0 → x0.5)
// → the ctor's WARM draw → three live draws u1/u2/u3. Every draw is
// 0x10098C0 = the LEHMER/MINSTD law (NOT wang-js's tile LCG — that is a
// different RNG class; dig #142): state' = 16807*trunc(state) mod
// 2147483647 with the <=0 → +=2147483647 fixup, draw = f64(state') x
// [0x11DF988] = 4.656612875e-10 (truncated decimal, byte-read); state 0
// = the debug assert (log + crash) → seed 0 is invalid. Returns the
// three f32-chained stores: [+0x30] = f(f(f(u1)*9999)+1), [+0x48] xBase
// = f(f(f(u2)*200000)-100000), [+0x38] = the same of u3 (Phase S value;
// Phase G overwrites it with 17920 on every completed Init, so it is
// dead there and only informational here).
export function phaseSXBase(seedInt) {
  let st = seedInt < 0 ? seedInt + 4294967296 : seedInt; // the diddle add
  if (st >= 2147483647) st *= 0.5;                       // ctor clamp
  const draw = () => {
    if (st === 0) throw new Error("phaseSXBase: rng state 0 (the 0x10098C0 debug assert)");
    const s = Math.trunc(st) | 0;                // cvttsd2si (i32 range incl. INT_MIN wrap)
    let r = (16807 * s) % 2147483647;            // Lehmer step (exact in f64: |16807*s| < 2^53)
    if (r <= 0) r += 2147483647;
    st = r;
    return r * 4.656612875e-10;                  // f64 [0x11DF988]
  };
  draw();                                        // the ctor's warm draw (0x452BA0)
  const u1 = draw(), u2 = draw(), u3 = draw();
  return {
    s1: f(f(f(u1) * 9999) + 1),                  // [+0x30] (mulss 9999/addss 1)
    xBase: f(f(f(u2) * 200000) - 100000),        // [+0x48] (mulss 200000/subss 100000)
    u3slot: f(f(f(u3) * 200000) - 100000),       // [+0x38] (Phase G overwrites)
  };
}

// makeBandDriver — the frame object (config, seed)-cached. The driver
// resolves bands LAZILY through closures (bandAt/cellAt) so a driver
// stays tiny under JSON.stringify (the SURFACE_LOG logs uid wholesale).
const driverCache = new WeakMap();   // config -> Map<seed, driver>
export function makeBandDriver(config, seed) {
  let perSeed = driverCache.get(config);
  if (!perSeed) driverCache.set(config, perSeed = new Map());
  let d = perSeed.get(seed);
  if (!d) perSeed.set(seed, d = buildBandDriver(config, seed));
  return d;
}

function buildBandDriver(config, seed) {
  const w = 70, h = 48;                      // C119: driver[+0x50]/[+0x54] = the Phase-G dims
  const { xBase } = phaseSXBase(seed);       // C119: driver[+0x48] = Phase-S u2 (live)
  const bandMemo = new Map();                // biome def -> band block | null (per driver)
  // FLAGGED (ISSUES §A A4 residual, dig #142): the band-matrix VALUE
  // producer (Init's fill via 0x9FEE40 + the Table-B consumer) was never
  // read; this resolves cells through the biome-map image instead —
  // same image C119 pins (TopLeft world x -17920 / row0 y -7168), but
  // the exact equivalence to the game's matrix fill is unproven (D).
  const bandAtIdx = (idx) => {
    const col = idx % w, row = (idx / w) | 0;   // GetAt decodes W*row+col
    const def = biomeAt(config, col, row)?.biome;
    if (!def) return null;                       // unmapped color/area -> NULL band -> params {0,0}
    let band = bandMemo.get(def);
    if (band === undefined) bandMemo.set(def, band = bandBlockOf(def));
    return band;
  };
  // cellAt — true 0x909C70: single signed col mod-w (idiv + one add if
  // <0), row clamp [0, h-1], then the same W*row+col GetAt.
  const cellAt = (col, row) => {
    let c = col % w;
    if (c < 0) c += w;
    let r = row;
    if (r > h - 1) r = h - 1;
    if (r < 0) r = 0;
    return bandAtIdx(w * r + c);
  };
  return {
    baseX: w * 256,          // 17920.0 = f64(w)*0.5*512 (C119 @0x906c27: x-base Phase G)
    baseY: 14 * 512,         // 7168.0  (C119 @0x906c45 = [0x11E00E0]: y-base)
    w, h,
    bandCount: w * h,        // driver[+0x6c] = 3360 (element count)
    xBase,                   // driver[+0x48]
    bandAt: bandAtIdx,       // (idx) -> band | null
    cellAt,                  // (col, row) -> band | null
  };
}

// uid-config adapter (C37 offset map) ← the extracted XML attrs (dig #8
// extraction in biomes.mjs, ABOUT_MATH (22)). MISSING surfaces (the
// mGradientSinMultiple*/mGradientType/mInsidePerlinFunc pair of the
// winter-only attrs never appears in the exe) → number("") guards.
// SLOT BINDING (CE-verified 2026-09-20 (35), CONSTANTS.md C43; term offsets
// C37): gradWCoef = [+0x268] = XML mMultiplierPerlin (CE: hills 1.0 with
// the attr ABSENT; winter.xml 0.642857); perlinCoef = [+0x264] =
// XML mMultiplierGradient (hills 0.871429 ✓).
// dig #145 (I33 fix): THE TWO NOISE ATTRS ARE DISTINCT SLOTS — the old
// adapter derived noiseKind FROM noise_type (the C42-era proxy) and
// sourced addNoise from mGradientAddNoise; both are byte-wrong:
//   noise_type      → [+0x220] (sink 0x4909b0 → strcmp enum parser
//                     0x490650; the enum feeds the r-eval case switch)
//   mInsideNoiseType → [+0x224] (sink 0x4911a0 → name→kind parser 0x490dc0;
//                     the noiseDispatch arg; ctor default 5)
//   mGradientAddNoise → [+0x288] = bandParams' mode (read at :699 of
//                     noise-proto — DEAD in the r-eval uid switch)
// Both parsers' name tables are now fully extracted (X104):
export const NOISE_TYPE_KIND = { // noise_type name → [+0x220] enum (@0x490650; .rdata names 0x117880c/0x1178834/0x1178850/0x1178878)
  IQ2_SIMPLEX1234: 0, IQ_SIMPLEX: 1, SIN_CAPPED_EVERYTHING: 2, SIN_CAPPED_SIMPLEX: 3,
}; // unknown name → the parser's error arm returns 0 (game logs NOISE_TYPE); absent attr → the ctor default 0 (movl $0 @0x4960d2). Live census: all 36 noise_type attrs = SIN_CAPPED_SIMPLEX ⇒ 3 ⇒ case 3
export const NOISE_NAME_KIND = { // mInsideNoiseType name → [+0x224] kind (parser @0x490dc0; getter table @0x490d9c)
  IQNoise: 0, DirtyPeeNoise: 1, QemNoise: 2, WhiteNoise: 3, MixNoise: 4,
  SimplexNoise: 5, STB_Perlin: 6, FastBlockNoise: 7, SimplexNoise1234: 8,
}; // unknown name → error + return 0; absent attr → the ctor default 5 (movl $5 @0x4960dc). Live: 6 files carry SimplexNoise1234 ⇒ 8 (0x8fca60 simplex2d)
function uidFrom(def, cfg) {
  const n = (v, d) => { const p = parseFloat(v); return Number.isFinite(p) ? p : d; };
  return {
    ...bandBlockOf(def),   // the band block (C118 slots; f32-rounded) — the r-eval
                           // config arms pass THIS as the band (dig #142)
    noiseKind: def.mInsideNoiseType !== undefined ? (NOISE_NAME_KIND[def.mInsideNoiseType] ?? 0) : 5, // [+0x224] (X104); never -1 ⇒ the kind-default arm (I33a) rides along
    gradient: 0,           // unused until the field-source read (see C44)
    sx: n(def.mInsidePerlinScaleX, 1), sy: n(def.mInsidePerlinScaleY, 1), // ctor {1,1}
    ox: 0, oy: 0,          // mInsidePerlinOffsetX/Y not present in current XMLs (census)
    offsetBySeed: def.mInsideOffsetBySeed === "1", // [+0x24d] gate — 0 live files (dig #155 sweep; ctor clears the slot per C126), parse wired for map completion
    fbm: n(def.mInsideNoiseFBM, 1) === 1, // [+0x228] ctor default 1 (movb $1 @0x4960e6) — the 6 live files all carry "1"
    squared: n(def.mInsidePerlinSquared, 0) === 1,
    clamped: n(def.mInsidePerlinClamped, 0) === 1,
    scaled: n(def.mInsidePerlinScaled, 0) === 1,
    scaleMin: n(def.mInsidePerlinScaleMin, 0),   // ctor [+0x244] = 0 (the port's old 0.057143 was invented)
    scaleMax: n(def.mInsidePerlinScaleMax, 0),   // ctor [+0x248] = 0
    gradWCoef: n(def.mMultiplierPerlin, 1.0),   // [+0x268] (CE hills=1.0)
    perlinCoef: n(def.mMultiplierGradient, 1.0), // [+0x264] ctor default 1.0f (dig #145; CE hills=0.871429 attr value)
    addValue: n(def.mInsideAddValue, 0),         // [+0x260] ctor default 0; LIVE on 4 files = exactly the lake family (all "5.0", dig #155 sweep — the (151)-era "no live attr" line was swept on the wrong slot family)
    addNoise: NOISE_TYPE_KIND[def.noiseType] ?? 0, // [+0x220] = the noise_type enum (X104) — NOT mGradientAddNoise (that is [+0x288] mode)
    minX: cfg.minX, maxX: cfg.maxX,         // C24 lane (passed through)
  };
}

// gradAt: the mGradient y-ramp INSTRUMENT for biomes WITHOUT bitmap_noise_file
// (NOT byte-backed — the C39 open item "per-biome image path resolution for
// hills/winter"; registered in CONSTANTS.md C39 / VERIFIED.md §12). Shape model: linear
// ramp StartY→EndY mapping to LowNoise→HighNoise on world-y. Isolated here
// so the instrument can swap it once the rasterize read lands.
// **dig #146 SCOPE — RETIRED FROM THE LANES (C39 demoted):** the kind-0
// lanes no longer build any gradAt — the byte law is field0 ≡ 1.0 for P == NULL
// (every shipped biome; entry (146)) — so neither this ramp nor the
// topology loader below is load-bearing any more (D-claim retired). Both
// survive HERE only for the dated probes that still construct them:
// experiments/2026-10-15-kind-default-probe.mjs (dig #144 pre-port
// measurement) and 2026-10-15-noodle-throw.mjs (I35's audit instrument).
function makeGradAt(def) {
  const y0 = parseFloat(def.mGradientStartY ?? "-1024");
  const y1 = def.mGradientEndY ?? 1024;
  const lo = parseFloat(def.mGradientLowNoise ?? "0");
  const hi = parseFloat(def.mGradientHighNoise ?? "0");
  // dig #117 (I23② action; C39/C80/C95): the ramp's contract is WORLD-Y PX
  // (StartY/EndY — C80's capture-validated 0.5-crossing at wy≈+235 px),
  // while surfaceField now hands gradAt the GAME's grid units
  // (u = 0.049162514·px + 0.1a, C95). Recover px here so the (A) placeholder
  // keeps its calibrated behaviour instead of collapsing to C80's
  // degenerate clamped-flat; the bitmap/topology gradAts stay grid-indexed
  // (byte law) — only the invented ramp converts. (A) debt, C39.
  const gridToPx = 1 / (K2.f64_049162514 * K2.f32_0p1); // ≈ 20.34 px/texel
  // dig #145 (C45 byte-law range): this instrument stands in for the
  // game's BitmapNoise FLOAT GRID, whose per-cell values are ±1.0 (lane A)
  // or the fallback grey (R+2G)/3 ∈ [0,1] (lane B) — the ramp must live in
  // THAT range. Unclamped, empty.xml's LowNoise/HighNoise (−292.6/+234.1)
  // fed field0 up to ~102 ⇒ rp ≫ 0.85 ⇒ the case-3 acos arm went out of
  // domain (NaN ⇒ air) — measured falsifier, dig #145 probe P-1a. The
  // clamp does not move the 0.5-crossing (raw ramp hits ±1 within wy
  // 110..118); it caps the extremes the way the grid bake does. (A) debt
  // C39 unchanged — only the range is now byte-anchored.
  return (gx, gy) => {
    const wy = gy * gridToPx;
    const t = Math.max(0, Math.min(1, (wy - y0) / Math.max(1e-6, y1 - y0)));
    return Math.max(-1, Math.min(1, lo + (hi - lo) * t));
  };
}

// dig #24: gradAt via the C39 IMAGE-LANE = the `bitmap_noise_file` topology
// PNG baked to a per-cell float grid (CONSTANTS.md::<C45>): the SetSize+Load
// wrapper true 0x8fa930 = (this, src{w,h,pixels}, flag) → realloc own float
// grid w·h ×4 B + memset, then LoadFromImageData true 0x8f9ab0 (per cell:
// color → A-resolver [+0xb0] → u16 = id+1, float grid [+0x18] = ±1.0;
// the B-map [+0xb4] fallback-grey lane = (R+2G)/3.0 float). The per-biome
// A-resolver = config-side, UNRESOLVED → this lane bakes the fallback grey,
// flagged. The wrap-mod getter true 0x9fe620 (idx mod w/h).
const fieldGridCache = new Map(); // absPath -> {w, h, grid}
function loadFieldGrid(dataDir, relPath) {
  const key = path.join(dataDir, relPath.replace(/^data\//, ""));
  let entry = fieldGridCache.get(key);
  if (entry) return entry;
  const png = readPng(key);
  const w = png.width, h = png.height, data = png.data;
  const grid = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const R = data[4*i], G = data[4*i+1], B = data[4*i+2];
    grid[i] = (R + 2 * G) / (3.0 * 255.0); // the C32 fallback-grey bake (flagged)
  }
  entry = { w, h, grid };
  fieldGridCache.set(key, entry);
  return entry;
}

export function makeGradAtFromTopology(dataDir, def) {
  if (!def.bitmapNoiseFile || !dataDir) return null;
  const entry = loadFieldGrid(dataDir, def.bitmapNoiseFile);
  return (gx, gy) => {
    const xr = ((Math.floor(gx) % entry.w) + entry.w) % entry.w;
    const yr = ((Math.floor(gy) % entry.h) + entry.h) % entry.h;
    return entry.grid[yr * entry.w + xr];
  };
}

// Solid mask for one 512-chunk in a procedural (non-wang-template) biome.
// Returns a 52×52 Uint8Array (cell grid; 1 = solid, 0 = air/empty).
// SURFACE_V3 (dig #30, 2026-09-21): for biomes carrying <BitmapCaves> the
// field source = lib/caves-field.mjs buildCavesField (the byte-canonical
// core: the fn C1 all-1.0 base + the C27 diddled-ws ctor chain + the C50
// knob interp + the (43)(a) falloff; the fn A ≤50-step chain walk) with
// the XML knobs — replacing the injected gradAt ramp for those biomes.
// The field is (seed, name)-deterministic per the binary's name-keyed
// cache (C49's byte-identical-grids proof), cached per (name, seed).
export function noiseChunkMask(config, tx, ty, seed = 0) {
  const SKY_ROWS = 48;
  const at = biomeAt(config, tx, ty - SKY_ROWS);
  const def = at?.biome;
  if (!def || def.templateFile) return null; // wang/template chunks handled elsewhere
  const mask = new Uint8Array(52 * 52);
  const matIdx = new Uint8Array(52 * 52); // 255 = air/unclassified; else the comp index (dig #130)
  const cfg = biomeCfg(def);
  if (!dataDirRef.dataDir) {
    try { dataDirRef.dataDir = findNoitaDataDir(); } catch { dataDirRef.dataDir = null; }
  }
  if (SURFACE_V2) {
    // dig #9c lane (true 0x90a860): surfaceField with the ramp-prototype
    // gradAt; noise cores below kind 3 THROW until W3/W4 land — those
    // biomes yield null (caller falls through), honestly. (dig #145, I33a:
    // the kind-1 throw path is CLOSED — uidFrom's [+0x224] ctor default 5
    // never yields -1; only UNREAD cores 0/1/2/4 can still throw.)
    const uid = uidFrom(def, cfg);
    uid.driver = makeBandDriver(config, seed);  // dig #142: the kind-0 r-site frame; dig #145 (I21 flip landed): the lane feeds it WORLD px below
    // dig #30: the caves-field source when the biome carries <BitmapCaves>
    // (the hills/desert/pyramid family). Dig #146 closed the kind-0 else-
    // arm: for EVERY shipped biome the in-binary P (BitmapNoise [uid+0x1d4])
    // is NULL, so field0 ≡ 1.0 inside surfaceField and NO gradAt is built
    // for kind-0 lanes (the C39 image-lane/ramp instruments are retired from
    // the lanes — see makeGradAt's header for their surviving scope).
    let gradAt = null;
    // dig #121 (entry (121), I25 index half): when the caves field
    // attaches, the lane's VALUE = the field read DIRECTLY at cell
    // coords — the game's sampler reads it via getter 0x9499f0 on
    // &owner+0xb4 with idx = W·y + x (stride [0x9c] = grid[0]) and the
    // >0.5 gate (@0x90dba5..0x90dbd0), NOT through surfaceField (the
    // kind-0 combine never touches the caves grid — dig #121; its u-law
    // grad chain died with the P==NULL law, dig #146). The wrapper below is
    // the byte law (mod-wrap = the tile repeat; canvas vs world px agree
    // under it — the C80 origins are multiples of 512 and 256).
    let cavesSrc = false;
    let byteAt = null; // dig #164: the byte-plane reader (the caves branch assigns)
    if (SURFACE_V3 && def.bitmapCaves && def.bitmapCaves.sizeX) {
      const caves = ensureCavesField(dataDirRef.dataDir, def, seed);
      const { w: fw, h: fh, field, bytes: fbytes } = caves;
      // dig #164 (the byte-plane gate, C136): the sampler's FIRST gate per
      // cell = the [P+0x58] byte plane (cmp slot,0 → skip = air,
      // @0x90D912); only byte-nonzero cells reach the field gate below.
      // The plane's writer = the record lane's stencil (the dig-#162 law;
      // the dig-#163 spawn-lane claim RETRACTED — spawn_percent = 0 × 55
      // biomes = the never-fires item side-lane, the C98 original stands).
      // dig #131 (the read-window law): the caves grid lives in the WORLD
      // frame (C80 origin = canvas py 31744 = biome row 14; C49's name-
      // keyed cache). The sampler's getter (0x9499f0, dig #121)
      // bounds-checks: the surface band bty 1..13 reads NEGATIVE world
      // rows ⇒ out of bounds ⇒ nothing read ⇒ AIR (the sky stays sky);
      // the field repeats (row mod fh) only at/below the band origin.
      // The old mod-wrap read constant rows 5/125/255 in EVERY chunk
      // (512 % 256 = 0) — the terrain-fills-the-sky defect.
      const bandY0 = 31744; // (SKY_ROWS+14)·512 = C80 worldY0
      const bandX0 = 17920; // C80 worldX0
      gradAt = (gx, gy) => {
        const row = gy - bandY0;
        if (row < 0) return 0; // above the band origin: OOB read ⇒ air
        const col = gx - bandX0;
        return field[(((row % fh) + fh) % fh) * fw + (((col % fw) + fw) % fw)];
      };
      // dig #164: the byte-plane reader — the same mod-wrap frame as the
      // field (the plane shares the grid dims + the getter's frame).
      byteAt = (gx, gy) => {
        const row = gy - bandY0;
        if (row < 0) return 0;
        const col = gx - bandX0;
        return fbytes[(((row % fh) + fh) % fh) * fw + (((col % fw) + fw) % fw)];
      };
      cavesSrc = true;
    }
    // (dig #146: the kind-0 else-arm that built topology/ramp gradAts is
    // GONE — surfaceField's field0 ≡ 1.0 makes any gradAt unreachable.)
    // dig #117 (I23② action): FEED PIXELS — the game's caller frame is
    // px+0.5 (0x908f7e adds 0.5 then calls @0x908f96, C95). V2's old cell
    // pre-scale (÷10 via CELLS_PER_CHUNK) STARVED every noise/r-eval
    // consumer 10× (I23②); every kind-0 consumer (r-eval @0x90b280,
    // insidePerlin, case arms) reads RAW WORLD px. Same canvas registration
    // as before (tx·512+cx·10+5 = 10·(tx·51.2+cx+0.5)). (The dig-#117
    // surfaceField ×0.1 GRID feed died with the u-law — dig #146.)
    // dig #145 (I33(b) fix, I21's frame flip landed): the FIELD build feeds
    // WORLD px (C80: wx = canvas − 17920, wy = canvas − 31744) — the binary's
    // kind-0 lane reads world coords everywhere. The old canvas feed put the
    // ground band at wy ≈ 31745+, far above the band window (B ≤ ~1258), so
    // rampGate saturated r ≡ 1.0 with the 0.5-capped field0 ⇒ a CONSTANT
    // field below the 0.5 gate ⇒ the all-air NOISE→AIR collapse (I33).
    // The BitmapCaves wrapper above keeps its CANVAS args (it subtracts the
    // origins itself — dig #131), and classify keeps the parked C76 frame
    // (canvas x, canvas y − 24576 — I21's classify flip stays parked).
    const worldX0 = 35 * CHUNK; // 17920 — C80 world x origin (biome px 35)
    const worldY0 = (SKY_ROWS + 14) * CHUNK; // 31744 — C80 world y origin (biome row 14)
    for (let cy = 0; cy < 52; cy++) {
      for (let cx = 0; cx < 52; cx++) {
        const gx = tx * CHUNK + cx * 10 + 5;
        const gy = ty * CHUNK + cy * 10 + 5;
        let v;
        try {
          // dig #164: the byte plane EXISTS in the grid now (the record
          // lane's stamps write it — caves-field), but the sampler gate is
          // NOT wired yet: the count test showed the port's plane coverage
          // (0.0/2.3/2.1% per desert/_EMPTY_/winter) is 20–30× short of the
          // capture's solid shares (65/47/37%) AND desert — with ZERO
          // CaveStructure records — still shows 65% capture ⇒ the record
          // lane is NOT the plane's (sole) writer. The gate wires when the
          // writer lane is byte-resolved (dig #165). Gate shape (kept for
          // that wiring): byte===0 ⇒ mask 0, matIdx 255, continue.
          // dig #121: the caves-lane value = the direct cell read
          // (gradAt above is the cell-law wrapper); the kind-0 combine
          // takes world px and no gradAt (field0 ≡ 1.0, dig #146).
          v = cavesSrc ? gradAt(gx, gy)
            : surfaceField(uid, gx - worldX0, gy - worldY0, DEF_SEED);
        } catch {
          return null; // unread-core lane
        }
        mask[52 * cy + cx] = v > 0.5 ? 1 : 0;
        // dig #130 (the surface-lane compositor): the per-cell MATERIAL bands
        // = classify(table, x, y, v) (0x8f5030 byte law; C76 frame: x = the
        // canvas px (shift-invariant, no limit_x), y = canvas_py − 24576).
        // Only the gate-solid cells classify; air cells stay idx 255.
        // matNames = the per-comp material_name list (pre-resolved Once per
        // chunk; the render maps name → materials.xml wang_color).
        let mi = 255;
        if (v > 0.5) {
          const table = ensureSurfaceTable(dataDirRef.dataDir, def);
          if (table) {
            // dig #148: the polygon arm IS ported (X106) and classify runs
            // it; the comps for these defs come from comment-stripped XML
            // (phantom comps retracted). A throw here = a real defect —
            // fail loud (the chunk-null mapping lives in noiseAt's catch).
            const rec = classify(table, gx, gy - 24576, v);
            // classify returns comp.celldata (the per-comp record built at
            // table build time = { i, name } via noise-terrain's records arg)
            if (rec) mi = rec.i;
          }
        }
        matIdx[52 * cy + cx] = mi;
      }
    }
    // dig #130: matNames = the classify table's component names in order
    // (the render maps name → materials.xml wang_color).
    // matNames = the classify table's component names in order
    // (the render maps name → materials.xml wang_color).
    const matTable = ensureSurfaceTable(dataDirRef.dataDir, def);
    const matNames = matTable ? matTable.components.map((c) => c.material_name) : null;
    const backdrop = ensureBiomeBackdrop(dataDirRef.dataDir, def);
    return { mask, def, v2: true, matIdx, matNames, backdrop };
  }
  // dig #97 (C76) — Phase 4 step 3: the sampler's classify chain wired
  // into the SURFACE_V3 lane (attach-gated @:235). Chain order mirrors
  // the bytes: field > 0.5 gate (@0x90dbc3 comiss → jbe @0x90dbd0) →
  // mBiomeMaterials-null ⇒ air (@0x90dd01 → je @0x90ddb0 = table null) →
  // evaluator2(x, y, field) (@0x90dd24 — arg order = C76) → floor-fix →
  // classify (@0x90dd7e) → record null ⇒ no window-write ⇒ air
  // (@0x90dd8b). kind/intern/planter arms are byte-observed but their
  // enum semantics are OPEN (C76); any non-null record renders solid.
  // Fail-loud: a component that throws (unknown attr, polygon, null
  // celldata) propagates to noiseAt's catch → the chunk falls through
  // honestly (same contract as the V2 lane's unread-core arm).
  //
  // dig #101 (entry (101), C80): THE FIELD IS WIRED. The gate value is
  // no longer the a=1.0 single-call proxy (the dig-#100 flood root
  // cause) — it is surfaceField's RETURN (the final combine,
  // noise-proto.mjs:713; the driver 0x908F40 kind-0 arm feeds exactly
  // that into the f32 grid the gate reads, VERIFIED:593) computed at
  // WORLD px (C80: wx = canvas px − 17920, wy = canvas py − 31744).
  // Value source selection = the V3 model (the V2 lane's :219-231
  // semantics, WITHOUT its SURFACE_V3 conjunct: this branch only runs
  // under the V3 candidate — attach gate :340 — or direct env-free test
  // calls, and the conjunct would desync the test mirror from the
  // instrument): caves-field grid for <BitmapCaves> biomes; every other
  // biome is kind-0 and takes surfaceField with field0 ≡ 1.0 — no gradAt
  // exists for it (dig #146, entry (146)). Field build throws (noiseKind
  // −1 on winter/mountain_center per VERIFIED §8 row 30; the I20 default
  // arm no longer throws — ported dig #113) ⇒ return null = whole chunk
  // falls through honestly (V2 :237-241 mirror). Evaluate/classify keep the C76 lane frame unchanged this
  // dig (evaluator2≡classify floor-fix identity; frame flip = I21).
  // **dig #121 correction (entry (121), I25 index half):** the
  // "surfaceField's RETURN" sentence above = the kind-0 law ONLY. For
  // BitmapCaves biomes the game's sampler reads the caves field
  // DIRECTLY (idx = W·y + x via getter 0x9499f0 on &owner+0xb4,
  // stride [0x9c] = grid[0]; gate value > 0.5 @0x90dba5..0x90dbd0) —
  // surfaceField's kind-0 path never touches the caves grid (writer
  // 0x8EE750 uses the same W·y+x, reader/writer closure verified dig
  // #121). The caves lane's gate value below is therefore the DIRECT
  // cell read, not the combine.
  const surfaceTable = ensureSurfaceTable(dataDirRef.dataDir, def);
  const uid = uidFrom(def, cfg);
  uid.driver = makeBandDriver(config, seed);  // dig #142: the kind-0 r-site frame (world-px coords, C80)
  let gradAt = null;
  let gradKind = "field0"; // caves = the cell read; field0 = kind-0 (field ≡ 1.0, dig #146) — logged by SURFACE_LOG below
  if (def.bitmapCaves && def.bitmapCaves.sizeX) {
    const caves = ensureCavesField(dataDirRef.dataDir, def, seed);
    const { w: fw, h: fh, field } = caves;
    // dig #131 (the read-window law): this branch's caller passes WORLD
    // coords (wx = canvas − 17920, wy = canvas − 31744, C80) — the getters
    // bounds-check ⇒ wy < 0 (the sky band) reads NOTHING ⇒ air; below, the
    // grid repeats mod fh/fw. (The V2 branch's wrapper above subtracts the
    // origins itself — canvas args there.)
    gradAt = (wx, wy) => {
      if (wy < 0) return 0; // negative world row ⇒ OOB read ⇒ air
      return field[(((wy % fh) + fh) % fh) * fw + (((wx % fw) + fw) % fw)];
    };
    gradKind = "caves";
  }
  // (dig #146: the else-arm that built the topology/ramp gradAts is GONE —
  // kind-0 takes surfaceField with field0 ≡ 1.0 and never consults it.)
  const bandTopPx = SKY_ROWS * CHUNK; // 24576 — classify y frame origin (C76)
  const worldX0 = 35 * CHUNK; // 17920 — C80 world x origin (biome px 35)
  const worldY0 = (SKY_ROWS + 14) * CHUNK; // 31744 — C80 world y origin (biome row 14)
  // L1 value logger (Task 0 of the post-(101)-FAIL plan, SESSION_CONTEXT
  // Update 2026-09-24 (1)): SURFACE_LOG=<path> ⇒ every evaluated cell is
  // appended as one JSONL record — lane x/y (C76), world wx/wy (C80),
  // gradKind (caves|field0), the lane value (`field` = surfaceField's
  // return for kind-0, the caves cell read for BitmapCaves), the >0.5
  // gate, classify's
  // v + the solid verdict — so each patch's coordinates can be checked
  // against what actually flowed. The directory must exist; with no env
  // var nothing is allocated to disk and the lane runs as before.
  const logPath = process.env.SURFACE_LOG || null;
  const logBuf = [];
  const flushLog = () => {
    if (logPath && logBuf.length) {
      fs.appendFileSync(logPath, logBuf.join("\n") + "\n");
      logBuf.length = 0;
    }
  };
  for (let cy = 0; cy < 52; cy++) {
    for (let cx = 0; cx < 52; cx++) {
      // classify/evaluator coords — the C76 lane frame (integer math
      // keeps the 51.2-cell sums exact): x = canvas px (an x shift only
      // phases the field — no limit_x anywhere), y = canvas py − 24576
      // (0 = surface-band top; +5 = cell center). Game classifies per
      // pixel (counters step 1 px); we sample one px per cell —
      // deviation tagged in C76.
      const x = tx * CHUNK + cx * 10 + 5;
      const y = ty * CHUNK + cy * 10 + 5 - bandTopPx;
      // field build — WORLD px per C80 (canvas py = y + 24576)
      const wx = x - worldX0;
      const wy = y + bandTopPx - worldY0;
      let field;
      try {
        // dig #121: BitmapCaves ⇒ the DIRECT cell read (the sampler's
        // law, see the correction block above); kind-0 ⇒ the combine
        // itself, no gradAt (field0 ≡ 1.0, dig #146).
        field = gradKind === "caves" ? gradAt(wx, wy)
          : surfaceField(uid, wx, wy, DEF_SEED);
      } catch {
        flushLog();
        return null; // unread-core lane → whole chunk falls through (V2 mirror)
      }
      let solid = 0;
      let v = null;
      let mi = 255;
      // the sampler's own gate: process only when the FIELD > 0.5 —
      // comiss 0x11dfa94 @0x90dbc3 → jbe @0x90e02b (P/P-table null arm
      // stays the && below, @0x90dd01). dig #121: "the FIELD" = the
      // surfaceField return for the kind-0 lanes, the DIRECT cell read
      // of the caves grid for BitmapCaves biomes (the sampler's own
      // source — the same getter, the same gate).
      if (field > 0.5 && surfaceTable) {
        // evaluator2 @0x90dd24 = (x, y, field): xmm0/xmm1 = the same
        // origin-added counters classify receives after the floor-fix
        // (identity pinned C76) — NOT the wang-cell+config proxy
        v = evaluator2(x, y, field);
        // dig #148: the polygon arm IS ported (X106) — a throw here is a
        // real defect and propagates to noiseAt's catch (the chunk falls
        // through honestly, the lane contract). The #147 polygon-message
        // catch arms are gone with the phantom comps that motivated them.
        const rec = classify(surfaceTable, x, y, v);
        if (rec) {
          solid = 1;
          // dig #130 (the surface-lane compositor): the record index + the
          // name list ride the chunk so worldColorAt can paint the material's
          // materials.xml wang_color (the C76-lane values, not the flat
          // band shade).
          mi = rec.i;
        }
      }
      mask[52 * cy + cx] = solid;
      matIdx[52 * cy + cx] = mi;
      if (logPath) {
        logBuf.push(JSON.stringify({
          tx, ty, cx, cy, x, y, wx, wy, uid, gradKind,
          field, above: field > 0.5, hasTable: !!surfaceTable, v, solid,
        }));
      }
    }
  }
  flushLog();
  // dig #130: the surface-lane compositor's output — per-cell classify
  // record index (255 = air/unclassified) + the comp-name list; the
  // caves-band chunk paints the material's materials.xml wang_color,
  // unclassified solids keep the flat band shade.
  const matNames = surfaceTable ? surfaceTable.components.map((c) => c.material_name) : null;
  const backdrop = ensureBiomeBackdrop(dataDirRef.dataDir, def);
  return { mask, def, matIdx, matNames, backdrop };
}

// DEF_SEED: the per-cell seed draw for the OffsetBySeed path — the
// current XMLs never set that attr, so this stays 0 until C27's generator
// walk feeds it; kept here so the V2 lane has an explicit injection point.
const DEF_SEED = 0;

// Lazily-memoized chunk mask cache attached onto the world object.
// dig #30: the seed plumbs through (the caves field is (seed, name)-
// deterministic per the binary's ctor chain — the C49 proof), so the
// ensureWorld caller passes the run's worldseed here.
export function attachNoiseTerrain(world, dataDir, seed = 0) {
  // sky/backdrop attach — UNCONDITIONAL (default-lane fix, the user's
  // 2026-10-15 report "no more sky background"): worldColorAt's sky band
  // (ty < 62) falls through to `world.skyAt?.() ?? null`, and C110's sky
  // law (VERIFIED §12 p2c) is written unconditionally — placing these
  // below the SURFACE_* gate made every default-lane sky / void /
  // bin-less px null → the tile renderer's opaque black (their viewer's
  // black sky rows). The data-image backdrop carries zero D (it reads
  // the game's own parallax PNG), so it ships with the honest default
  // render; the NOISE band stays OPT-IN below (VERIFIED.md §12's D-law:
  // the placeholder ramp + the un-carve'd filler shape must not ship as
  // default). Tests: the default-lane attach contract in
  // tests/mapgen/world-gen.test.mjs (this thread runs the child with the
  // SURFACE_* env stripped — the singleFork worker env is polluted by
  // other suites).
  // dig #132 (I32 p2b, the per-area background law): the AIR backdrop = the
  // chunk biome's Topology background_image (hills =
  // weather_gfx/background_cave_04_alt, coalmine = background_coalmine…),
  // tiled in the chunk frame; defs with no bg art (the_sky = "") fall
  // back to null = transparent air (the sky row's blue = the template
  // lane's biome_color, landed later). The game's true parallax/layering
  // = OPEN (tagged): this is the prototype tile law.
  // dig #133 (I32 p2c, the SKY/Hell layer law) + dig #134 fix-3: the
  // backdrop is split — `bgImageAt` = the VOID/bins-air path (the caller
  // decides); `skyAt` = the pure sky (the parallax gradient + the stars),
  // called for the world rows above the datum (the caller's ty < 62 = the
  // sky band, to the Heaven end). The per-biome backgrounds (the C109
  // law) = the UNDERGROUND bands (ty >= 62).
  // dig #133 (I32 p2c, the SKY/Hell layer law) + dig #134 fix-3: the
  // backdrop is split — `skyAt` = the pure sky (the parallax gradient +
  // the stars; the world rows above the datum = the caller's ty < 62 =
  // the band to the Heaven end) and `bgImageAt` = the C109 per-biome
  // backdrop for the UNDERGROUND bands (ty ≥ 62).
  const skyAt = (tx, ty, gx, gy) => {
    const sb = ensureSkyBackdrop(dataDir);
    if (!sb.sky) return null;
    // the vertical gradient: the png's top = high altitude (blue), its
    // bottom = the horizon (warm). t: 1 at the datum → 0 at the canvas top.
    const tRaw = gy / 31744;
    const t = tRaw < 0 ? 0 : tRaw > 1 ? 1 : tRaw;
    const sr = Math.floor(t * (sb.sky.h - 1)); // the png's top = blue (high), bottom = warm (horizon)
    const sx = ((gx % sb.sky.w) + sb.sky.w) % sb.sky.w;
    const q = 4 * (sr * sb.sky.w + sx);
    let r = sb.sky.px[q], g = sb.sky.px[q + 1], b = sb.sky.px[q + 2];
    // the stars: hash-placed in the upper sky, alpha-composited
    if (t < 0.75) {
      const cx = Math.floor(gx / 32), cy = Math.floor(gy / 32);
      if (skyStarHash(cx, cy) % 23 === 0 && sb.star) {
        const h2 = skyStarHash(cx + 7919, cy + 104729);
        const ox = h2 % 32, oy = (h2 >> 5) % 32;
        const lx = gx - cx * 32 - ox, ly = gy - cy * 32 - oy;
        if (lx >= 0 && ly >= 0 && lx < sb.star.w && ly < sb.star.h) {
          const sq = 4 * (ly * sb.star.w + lx);
          const a = sb.star.px[sq + 3] / 255;
          if (a > 0) {
            r = Math.round(sb.star.px[sq] * a + r * (1 - a));
            g = Math.round(sb.star.px[sq + 1] * a + g * (1 - a));
            b = Math.round(sb.star.px[sq + 2] * a + b * (1 - a));
          }
        }
      }
    }
    return [r, g, b];
  };
  const bgImageAtInner = (tx, ty, gx, gy, skyInstead) => {
    if (skyInstead || ty < 62) return skyAt(tx, ty, gx, gy);
    const ch = world.noiseAt?.(tx, ty);
    const bd = ch?.backdrop;
    if (!bd) return null;
    if (bd.fill) return bd.fill;
    if (!bd.pixels) return null;
    const lx = gx - tx * CHUNK, ly = gy - ty * CHUNK;
    const bx = ((lx % bd.w) + bd.w) % bd.w, by = ((ly % bd.h) + bd.h) % bd.h;
    const q = 4 * (by * bd.w + bx);
    return [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]];
  };
  world.skyAt = skyAt;
  world.bgImageAt = (tx, ty, gx, gy) => bgImageAtInner(tx, ty, gx, gy, false);

  // OPT-IN (VERIFIED.md §12): with neither lane flag set the NOISE band
  // never attaches and the procedural band renders as honest air (the
  // art-scenes + wang areas carry the whole visible band) — the sky/
  // backdrop attach above is unconditional (see the function head).
  // dig #145 (I33c): surface the state ONCE to the operator — before this
  // the opt-in gate was silent and env loss manifested as black chunks
  // (I33's flags-OFF black).
  if (!SURFACE_V2 && !SURFACE_V3) {
    console.warn("[noita-livemap] NOISE band detached (VERIFIED §12 opt-in): set SURFACE_V2=1 and/or SURFACE_V3=1 to render the procedural band");
    return world;
  }
  const cache = new Map(); // "tx,ty" -> {mask, def} | null
  world.noiseAt = (tx, ty) => {
    const key = `${tx},${ty}`;
    if (cache.has(key)) return cache.get(key);
    let r = null;
    try {
      r = noiseChunkMask(world.config, tx, ty, seed);
    } catch {
      r = null;
    }
    cache.set(key, r);
    return r;
  };
  // dig #31: the world-level probe the worldColorAt actually calls —
  // without this the noise branch never runs (the pre-V3 wiring hole):
  world.noiseSolidAt = (wx, wy) => noiseSolidAt(world, wx, wy);
  // dig #130 (the surface-lane compositor): the per-cell MATERIAL probe —
  // the caves-band chunk's classify-record index (255 = air/unclassified).
  world.noiseMatAt = (wx, wy) => {
    const tx = Math.floor(wx / CHUNK), ty = Math.floor(wy / CHUNK);
    const ch = world.noiseAt?.(tx, ty);
    if (!ch || !ch.matIdx) return { idx: 255, names: null };
    const lx = (wx - tx * CHUNK) / 10, ly = (wy - ty * CHUNK) / 10;
    if (lx < 0 || ly < 0 || lx >= 51 || ly >= 51) return { idx: 255, names: null };
    return {
      idx: ch.matIdx[52 * Math.floor(ly) + Math.floor(lx)],
      names: ch.matNames ?? null,
    };
  };
  return world;
}

// Solidity probe in world pixel space: 1 = noise-solid, 0 = not, null =
// chunk not a procedural-noise chunk (caller falls through to defaults).
export function noiseSolidAt(world, wx, wy) {
  const tx = Math.floor(wx / CHUNK), ty = Math.floor(wy / CHUNK);
  const ch = world.noiseAt?.(tx, ty);
  if (!ch) return null;
  const lx = (wx - tx * CHUNK) / 10, ly = (wy - ty * CHUNK) / 10;
  if (lx < 0 || ly < 0 || lx >= 51 || ly >= 51) return 0;
  return ch.mask[52 * Math.floor(ly) + Math.floor(lx)];
}
