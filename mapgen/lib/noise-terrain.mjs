// mapgen/lib/noise-terrain.mjs — F3 noise-terrain integration
import fs from "node:fs";
import path from "node:path";
//
//   - noise evaluator = true 0x908e70 (lower clamp at 0.5, single
//     anisotropic q warping both axes, C30) — via lib/noise-proto.mjs.
//   - sampler gate (FUN_0090d860, slab 0x50d3c3): cells processed only when
//     the field value > 0.5 (comiss 0x11dfa94). Full three-way gate (C153):
//     AIR MARK = v < 0 strictly, [0, 0.5] = unmarked base fill. Not ported
//     as the mask rule — FLAGGED (D, ISSUES A11, owner I47): the hills field
//     never goes negative, so the byte law alone collapses the band (§8 row
//     62; see the mask site below).
//   - per-cell noise input = cell coords + the per-biome "Wang offset"
//     doubles (C24 runtime config; 159/223 = engine ConfigRegistry defaults,
//     @prov noitool). Spatial diversity is location-driven (C27/C28: one
//     seed draw per generator cell, no per-cell RNG in the noise).
//   - the 10-px wang cell is the noise input unit: noiseTransform's
//     (adj+0.5)·0.1 recovers the cell index (C26: f64 0.1 @0x11dfd08).
//
// Shape-first approximation: solid where the evaluator value passes the
// sampler's >0.5 gate. Material IDs are shape-only (config-side naming
// 0xb78e0/0x603fd0 out of scope; I4/I7 render artifacts apply).

import { K2, evaluator2, noiseDispatch, surfaceField } from "./noise-proto.mjs";
import { biomeAt } from "./biomes.mjs";
import { buildCavesField, cavesCellAt, cavesShapedCellAt } from "./caves-field.mjs";
import { readPng } from "./images.mjs";
import { findNoitaDataDir } from "./paths.mjs";
import {
  componentFromXml,
  buildMaterialsTable,
  classify,
} from "./surface-level.mjs";

// Caves-field cache (the binary's std::map @0x132aae8: one cave grid per
// (seed, CaveStructure package); (seed, name)-deterministic per C49).
// Keyed by the biome FILE, not def.name: hills/hills2/mountain_tree all
// have def.name = "_EMPTY_" and would collide. A per-config identity
// matches the game memo keyed on &config+0xa8 (VERIFIED:600).
const cavesFieldCache = new Map(); // key -> buildCavesField result
const dataDirRef = { dataDir: null };
function ensureCavesField(dataDir, def, seed) {
  if (dataDir && !dataDirRef.dataDir) dataDirRef.dataDir = dataDir;
  if (!dataDirRef.dataDir) dataDirRef.dataDir = findNoitaDataDir();
  const key = `${def.filename ?? def.name}|${seed}|${SURFACE_STAMPS ? "s" : ""}`;
  let entry = cavesFieldCache.get(key);
  if (entry) return entry;
  entry = buildCavesField(dataDir, def, seed, SURFACE_STAMPS);
  cavesFieldCache.set(key, entry);
  return entry;
}

// The biome <Materials> table feeding the SURFACE_V3 classify chain (C76),
// cached per XML file (classify mutates nothing; comps take their celldata
// records at build time). No <MaterialComponent> blocks → null = the
// game's mBiomeMaterials == 0 arm (@0x90dd01 → je @0x90ddb0) → air. The
// band seed {min:0, max:0} is a proxy — the game's seed init is unread
// (OPEN, C76); extend-if-narrower makes the band = comps' hull ∪ {0,0} =
// [0, 3.5] for hills.
//
// Sky (I32): every world row above the datum (canvas py < 31744 = bty
// 0..13 + the vmap sky up to the Heaven end) = black air (null; C78's
// lum<24 mask rule) + the star sprite star_007.png at hash-deterministic
// positions at every altitude. The parallax gradient
// (weather_gfx/parallax_background.png, the game's daytime layer) is not
// rendered: the noitamap/mapcap reference sky is opaque black + stars
// (census mapgen/out/surface-color-census-2026-10-19-*.json). Why the
// capture is night = OPEN. Per-biome bg art (cave_04_alt etc.) paints only
// the underground bands (bty ≥ 14), not the sky. Hell = the_end's own
// background_the_end.png (template-lane air bg for hell rows = OPEN).
const skyBackdropCache = { done: false, star: null };
function ensureSkyBackdrop(dataDir) {
  if (skyBackdropCache.done) return skyBackdropCache;
  skyBackdropCache.done = true;
  const dir = dataDir ?? dataDirRef.dataDir;
  try {
    const star = readPng(path.join(dir, "weather_gfx/star_007.png"));
    skyBackdropCache.star = { w: star.width, h: star.height, px: star.data };
  } catch { /* missing art → plain black sky (honest) */ }
  return skyBackdropCache;
}
const skyStarHash = (cx, cy) =>
  (Math.imul(cx, 2654435761) ^ Math.imul(cy, 340573321)) >>> 0;

const surfaceTableCache = new Map(); // def.filename -> table | null
// Per-biome AIR backdrop (I32): the Topology background_image, loaded once
// per def; {w,h,pixels} | {fill} | null.
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
  if (bd) {
    // Clip pair + limit_y edge sprite (C184). 0x72c180 builds
    // "data/weather_gfx/limit_y/" + the backdrop's file name when the limit
    // cuts into the chunk and places it at (chunk centre x, trunc(height))
    // via 0x72e330 (shipped folder_desc.txt states the same rule). Its
    // bottom sits on the height (capture ref/15_14: top = height − 31 = 194).
    bd.limit = def.limitBackgroundImage ?? true;
    bd.height = def.backgroundImageHeight ?? 225;
    bd.edge = null;
    try {
      const edgeRel = path.join("weather_gfx/limit_y", path.basename(rel));
      const png = readPng(path.join((dataDir ?? dataDirRef.dataDir), edgeRel));
      bd.edge = { w: png.width, h: png.height, pixels: png.data };
    } catch { bd.edge = null; } // no limit_y file for this backdrop → a hard clip
  }
  backdropCache.set(def.filename, bd);
  return bd;
}
export function ensureSurfaceTable(dataDir, def) {
  if (!def.filename) return null;
  if (surfaceTableCache.has(def.filename)) return surfaceTableCache.get(def.filename);
  let table = null;
  const dir = dataDir ?? dataDirRef.dataDir;
  if (dir) {
    const xml = fs.readFileSync(path.join(dir, def.filename.replace(/^data\//, "")), "utf-8");
    // XML comments are not components: the game's parser never sees
    // commented-out elements (temple_wall/boss_arena/end_wall ship all their
    // polygon comps inside <!-- -->). Capture the full component body,
    // including child <polygon> blocks — the polygon arm @0x8f5418 reads
    // the comp's vertex list (+0x78..+0x7c), parsed by surface-level.mjs
    // from the nested <Vec2/> nodes.
    const xmlActive = xml.replace(/<!--[\s\S]*?-->/g, "");
    if (/<MaterialComponent\b[^>]*\/>/.test(xmlActive)) {
      // The full-body matcher below would silently drop a self-closing
      // component; fail loud (none exists in shipped biome/ + biome_impl/).
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

// The noise band is on by default (C165/C166 port). The surface band's
// shape = the topology lane (surfaceField evaluator — mGradient heightmap /
// topology images), not the caves field (C178, §8 row 75): V2 = the
// topology surface, on by default (SURFACE_V2=0 = out-lane for instrument
// baselines); V3 = the caves field, opt-in (SURFACE_V3=1).
const SURFACE_V2 = process.env.SURFACE_V2 !== "0";  // topology surface — on by default; SURFACE_V2=0 = out-lane
const SURFACE_V3 = process.env.SURFACE_V3 === "1";  // caves field — opt-in
// CaveStructure stamp-field lane (C175): the fn870 α-blend paints the
// stamps' decoded values (alpha × lum × strength) into the field at the
// record-lane positions. Opt-in until the instrument verdict; the
// byte-plane stencil is unaffected.
const SURFACE_STAMPS = process.env.SURFACE_STAMPS === "1";

// Per-biome "Wang offset" (C24/C28): ConfigRegistry defaults, engine-side.
// Tagged @prov noitool (the 159/223 family); validated only at runtime.
function biomeCfg(_biome) {
  return { minX: 159.0, maxX: 223.0 };
}

// ============ Band-ramp driver frame (C119/C113) ============
// The kind-0 r-site (true 0x90B280) reads its bands through a
// frame object: baseX/baseY (Phase G's world origin), the 70x48 tile
// grid dims, bandCount, the Phase-S x-seed slot, and the two accessors
// (GetAt on the biome matrix / the 0x909C70 cell accessor).
const f = Math.fround;

// bandBlockOf — the per-biome band block = the slots bandParams
// (true 0x90B680) reads off the band pointer (C118 key map; f32 slots
// stored f32-rounded, C116 defaults). Also spread into uid
// (uidFrom below) because the two r-eval config arms pass the uid itself
// as the band.
export function bandBlockOf(def) {
  if (!def) return null;
  const n = (v, d) => { const p = parseFloat(v); return Number.isFinite(p) ? p : d; };
  return {
    gradStartY: f(n(def.mGradientStartY, -512)),      // f32 [+0x270]
    gradEndY: f(n(def.mGradientEndY, 512)),           // f32 [+0x274]
    gradSlopeStartX: n(def.mGradientSlopeStartX, 0),  // f64 [+0x278]
    gradSlopeDelta: n(def.mGradientSlopeDelta, 1.0),  // f64 [+0x280] (ctor default 1.0 — movsd %xmm1 @0x49615d, [0x11e0b40] f64 1.0)
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
// 0x10098C0 = the Lehmer/MINSTD law (not wang-js's tile LCG — a
// different RNG class): state' = 16807*trunc(state) mod
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
  // FLAGGED (D, ISSUES §A A4 residual): the band-matrix value producer
  // (Init's fill via 0x9FEE40 + the Table-B consumer) is unread; cells
  // resolve through the biome-map image instead (same image C119 pins:
  // TopLeft world x -17920 / row0 y -7168); equivalence unproven.
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

// uid-config adapter (C37 offset map) ← the XML attrs extracted in
// biomes.mjs. Attrs absent from the exe (mGradientSinMultiple*/
// mGradientType/mInsidePerlinFunc, winter-only) → number("") guards.
// Slot binding (CE-verified, C43): gradWCoef = [+0x268] = XML
// mMultiplierPerlin (hills 1.0 with the attr absent; winter.xml 0.642857);
// perlinCoef = [+0x264] = XML mMultiplierGradient (hills 0.871429).
// The noise attrs are distinct slots (I33):
//   noise_type      → [+0x220] (sink 0x4909b0 → strcmp enum parser
//                     0x490650; the enum feeds the r-eval case switch)
//   mInsideNoiseType → [+0x224] (sink 0x4911a0 → name→kind parser 0x490dc0;
//                     the noiseDispatch arg; ctor default 5)
//   mGradientAddNoise → [+0x288] = bandParams' mode (noise-proto; dead in
//                     the r-eval uid switch)
// Both parsers' name tables (X104):
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
                           // config arms pass this as the band
    noiseKind: def.mInsideNoiseType !== undefined ? (NOISE_NAME_KIND[def.mInsideNoiseType] ?? 0) : 5, // [+0x224] (X104); never -1 ⇒ the kind-default arm (I33a) rides along
    gradient: 0,           // unused until the field-source read (see C44)
    sx: n(def.mInsidePerlinScaleX, 1), sy: n(def.mInsidePerlinScaleY, 1), // ctor {1,1}
    ox: 0, oy: 0,          // mInsidePerlinOffsetX/Y not present in current XMLs (census)
    offsetBySeed: def.mInsideOffsetBySeed === "1", // [+0x24d] gate — 0 live files (ctor clears the slot, C126); parsed for completeness
    fbm: n(def.mInsideNoiseFBM, 1) === 1, // [+0x228] ctor default 1 (movb $1 @0x4960e6) — the 6 live files all carry "1"
    squared: n(def.mInsidePerlinSquared, 0) === 1,
    clamped: n(def.mInsidePerlinClamped, 0) === 1,
    scaled: n(def.mInsidePerlinScaled, 0) === 1,
    scaleMin: n(def.mInsidePerlinScaleMin, 0),   // ctor [+0x244] = 0
    scaleMax: n(def.mInsidePerlinScaleMax, 0),   // ctor [+0x248] = 0
    gradWCoef: n(def.mMultiplierPerlin, 1.0),   // [+0x268] (CE hills=1.0)
    perlinCoef: n(def.mMultiplierGradient, 1.0), // [+0x264] ctor default 1.0f (CE hills=0.871429 attr value)
    addValue: n(def.mInsideAddValue, 0),         // [+0x260] ctor default 0; live on the 4 lake-family files (all "5.0")
    addNoise: NOISE_TYPE_KIND[def.noiseType] ?? 0, // [+0x220] = the noise_type enum (X104), not mGradientAddNoise ([+0x288] mode)
    minX: cfg.minX, maxX: cfg.maxX,         // C24 lane (passed through)
    field0: def.bitmapNoiseFile ? 0 : 1.0,  // I52 fix (A19 stand-in): the lake family's topology body ⇒ the early-zero arm (see surfaceField)
  };
}

// gradAt: the mGradient y-ramp instrument for biomes without
// bitmap_noise_file (not byte-backed, C39 stand-in): linear ramp
// StartY→EndY mapping to LowNoise→HighNoise on world-y. Not used by the
// lanes: the kind-0 byte law is field0 ≡ 1.0 for P == NULL (the lake
// family carries bitmap_noise_file → topology_lake.png; its P-wire
// [+0xa8] path → [uid+0x1d4] is OPEN, C144). This ramp and the topology
// loader below survive only for experiments/2026-10-15-kind-default-probe.mjs
// and 2026-10-15-noodle-throw.mjs (I35).
function makeGradAt(def) {
  const y0 = parseFloat(def.mGradientStartY ?? "-1024");
  const y1 = def.mGradientEndY ?? 1024;
  const lo = parseFloat(def.mGradientLowNoise ?? "0");
  const hi = parseFloat(def.mGradientHighNoise ?? "0");
  // The ramp's contract is world-y px (StartY/EndY; C80's 0.5-crossing at
  // wy≈+235 px), while surfaceField hands gradAt grid units
  // (u = 0.049162514·px + 0.1a, C95), so recover px here. The
  // bitmap/topology gradAts stay grid-indexed (byte law). (A) debt, C39.
  const gridToPx = 1 / (K2.f64_049162514 * K2.f32_0p1); // ≈ 20.34 px/texel
  // Range (C45): the stand-in for the game's BitmapNoise float grid, whose
  // cells are ±1.0 (lane A) or the fallback grey (R+2G)/3 ∈ [0,1] (lane
  // B). Unclamped, empty.xml's LowNoise/HighNoise (−292.6/+234.1) push
  // field0 to ~102 and the case-3 acos arm out of domain (NaN ⇒ air). The
  // clamp does not move the 0.5-crossing.
  return (gx, gy) => {
    const wy = gy * gridToPx;
    const t = Math.max(0, Math.min(1, (wy - y0) / Math.max(1e-6, y1 - y0)));
    return Math.max(-1, Math.min(1, lo + (hi - lo) * t));
  };
}

// gradAt via the C39 image lane = the `bitmap_noise_file` topology
// PNG baked to a per-cell float grid (CONSTANTS.md::<C45>): the SetSize+Load
// wrapper true 0x8fa930 = (this, src{w,h,pixels}, flag) → realloc own float
// grid w·h ×4 B + memset, then LoadFromImageData true 0x8f9ab0 (per cell:
// color → A-resolver [+0xb0] → u16 = id+1, float grid [+0x18] = ±1.0;
// the B-map [+0xb4] fallback-grey lane = (R+2G)/3.0 float). The per-biome
// A-resolver is config-side and unresolved → this lane bakes the fallback
// grey (FLAGGED). The wrap-mod getter true 0x9fe620 (idx mod w/h).
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
// SURFACE_V3: for biomes carrying <BitmapCaves> the field source = lib/caves-field.mjs buildCavesField (the byte-canonical
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
  // A21 (registered approximation): a template-less BIOME_WANG_TILE room
  // above the surface (world y < 0 ⇔ canvas ty < 62) gets no noise
  // terrain; captured sky-band rooms are air there while underground ones
  // need the solid lane. Engine mechanism unread (candidate: the topology
  // gradient mGradientStartY = −1024, which the kind-0 lane drops).
  if (def.topologyType === "BIOME_WANG_TILE" && ty < 62) return null;
  const mask = new Uint8Array(52 * 52);
  const matIdx = new Uint8Array(52 * 52); // 255 = air/unclassified; else the comp index
  const cfg = biomeCfg(def);
  if (!dataDirRef.dataDir) {
    try { dataDirRef.dataDir = findNoitaDataDir(); } catch { dataDirRef.dataDir = null; }
  }
  if (SURFACE_V2) {
    // true 0x90a860 lane: surfaceField. Unread noise cores 0/1/2/4 throw —
    // those biomes yield null (caller falls through). uidFrom's [+0x224]
    // ctor default 5 never yields -1 (I33a).
    const uid = uidFrom(def, cfg);
    uid.driver = makeBandDriver(config, seed);  // the kind-0 r-site frame; the lane feeds it world px below (I21)
    // Caves-field source when the biome carries <BitmapCaves> (hills/
    // desert/pyramid family). For other shipped biomes the in-binary P
    // (BitmapNoise [uid+0x1d4]) is NULL, so field0 ≡ 1.0 inside
    // surfaceField and no gradAt is built (lake family: P-wire OPEN, C144).
    let gradAt = null;
    // When the caves field attaches, the value = the field read directly at
    // cell coords (I25): the sampler reads it via getter 0x9499f0 on
    // &owner+0xb4 with idx = W·y + x (stride [0x9c] = grid[0]) and the
    // >0.5 gate (@0x90dba5..0x90dbd0), not through surfaceField (the kind-0
    // combine never touches the caves grid). Mod-wrap = the tile repeat;
    // canvas vs world px agree under it (C80 origins are multiples of 512).
    let cavesSrc = false;
    let byteAt = null; // byte-plane reader (assigned by the caves branch)
    // The attach is row-gated to the underground (map rows 15+ = ty ≥
    // SKY_ROWS+15): the caves field's band origin = the wy 0-line; surface-
    // band chunks (bty ≤ 14) must not use it (§8 row 75).
    if (SURFACE_V3 && def.bitmapCaves && def.bitmapCaves.sizeX) {
      const caves = ensureCavesField(dataDirRef.dataDir, def, seed);
      const { w: fw, h: fh, field, bytes: fbytes } = caves;
      // Byte-plane gate (C136): the sampler's first gate per cell = the
      // [P+0x58] byte plane (cmp slot,0 → skip = air, @0x90D912); only
      // byte-nonzero cells reach the field gate. The plane's writer = the
      // record lane's stencil (C98).
      // Read window: the caves grid lives in the world frame (C80 origin =
      // canvas py 31744 = biome row 14). The getter 0x9499f0 bounds-checks:
      // negative world rows (surface band bty 1..13) read nothing ⇒ air;
      // the field repeats (row mod fh) only at/below the band origin.
      const bandY0 = 31744; // (SKY_ROWS+14)·512 = C80 worldY0
      const bandX0 = 17920; // C80 worldX0
      gradAt = (gx, gy) => {
        const row = gy - bandY0;
        if (row < 0) return 0; // above the band origin: OOB read ⇒ air
        const col = gx - bandX0;
        return field[(((row % fh) + fh) % fh) * fw + (((col % fw) + fw) % fw)];
      };
      // Byte-plane reader — same mod-wrap frame as the field (shared grid
      // dims + getter frame).
      byteAt = (gx, gy) => {
        const row = gy - bandY0;
        if (row < 0) return 0;
        const col = gx - bandX0;
        return fbytes[(((row % fh) + fh) % fh) * fw + (((col % fw) + fw) % fw)];
      };
      cavesSrc = true;
    }
    // Feed pixels: the game's caller frame is px+0.5 (0x908f7e adds 0.5
    // then calls @0x908f96, C95); every kind-0 consumer (r-eval @0x90b280,
    // insidePerlin, case arms) reads raw world px (tx·512+cx·10+5 =
    // 10·(tx·51.2+cx+0.5)). The field build feeds world px (C80: wx =
    // canvas − 17920, wy = canvas − 31744). The BitmapCaves wrapper above
    // takes canvas args (it subtracts the origins itself).
    const worldX0 = 35 * CHUNK; // 17920 — C80 world x origin (biome px 35)
    const worldY0 = (SKY_ROWS + 14) * CHUNK; // 31744 — C80 world y origin (biome row 14)
    for (let cy = 0; cy < 52; cy++) {
      for (let cx = 0; cx < 52; cx++) {
        const gx = tx * CHUNK + cx * 10 + 5;
        const gy = ty * CHUNK + cy * 10 + 5;
        let v;
        // Caves lane = underground rows only (§8 row 75); surface-band
        // chunks (ty < SKY_ROWS+15) run the noise lane even under SURFACE_V3.
        const useCaves = cavesSrc && ty >= SKY_ROWS + 15;
        try {
          // The byte-plane gate is not wired: the port's plane coverage
          // (0.0/2.3/2.1% desert/_EMPTY_/winter) is 20–30× short of the
          // capture's solid shares (65/47/37%), and desert has zero
          // CaveStructure records ⇒ the record lane is not the plane's sole
          // writer. Wire when the writer lane is byte-resolved; gate shape:
          // byte===0 ⇒ mask 0, matIdx 255, continue.
          // Caves lane value = the direct cell read; the kind-0 combine
          // takes world px and no gradAt (field0 ≡ 1.0).
          v = useCaves ? gradAt(gx, gy)
            : surfaceField(uid, gx - worldX0, gy - worldY0, DEF_SEED);
        } catch {
          return null; // unread-core lane
        }
        // Sampler 0x90d860 (C153, X178): the AIR MARK = strictly negative
        // cells — the air arm @0x90e02b (`xorps; comiss %xmm0,%xmm1; jbe
        // skip`) stamps `movb $1` into the u8 plane at [owner+0x1a0] only
        // when v < 0. v ∈ [0, 0.5] gets no stamp (base fill); only v > 0.5
        // opens the claim path (comiss 0x11dfa94 `jbe` @0x90dbd0 = the
        // gate's entry threshold, not the air mark).
        // Kind-0 cell law = classify-or-air (X215): the walk 0x792580's
        // post-classify arm @0x7930D8 (`test eax,eax; jne 0x7935F4` = paint;
        // fallthrough = no paint = air) + the classify miss-exit 0x8F574C
        // (`xor eax,eax; ret 0x8`). On the surfaceField branch the cell is
        // solid iff the classifier matches (band gate + per-comp windows +
        // limit_y flag/limits). Classify y = world px (hills soil [−1024,
        // 424.229], lake water [225, 512000] are world-y bands; A18); x =
        // canvas px (shift-invariant rare-pattern seed, C76). The caves lane
        // keeps its own law: field > 0.5 gate (@0x90DBD0) + classify
        // (0x90DD7E).
        let mi = 255;
        let solidBit;
        if (useCaves) {
          solidBit = v > 0.5 ? 1 : 0;
          if (solidBit) {
            const table = ensureSurfaceTable(dataDirRef.dataDir, def);
            // same classify as the walk's arm (world-y limits); only the
            // material layer classifies, the mask keeps the >0.5 gate
            const rec = table ? classify(table, gx, gy - worldY0, v) : null;
            if (rec) mi = rec.i;
          }
        } else {
          const table = ensureSurfaceTable(dataDirRef.dataDir, def);
          if (table) {
            const rec = classify(table, gx, gy - worldY0, v);
            if (rec) { mi = rec.i; solidBit = 1; }
          }
        }
        mask[52 * cy + cx] = solidBit ? 1 : 0;
        matIdx[52 * cy + cx] = mi;
      }
    }
    // matNames = the classify table's component names in order
    // (the render maps name → materials.xml wang_color).
    const matTable = ensureSurfaceTable(dataDirRef.dataDir, def);
    const matNames = matTable ? matTable.components.map((c) => c.material_name) : null;
    const backdrop = ensureBiomeBackdrop(dataDirRef.dataDir, def);
    return { mask, def, v2: true, matIdx, matNames, backdrop };
  }
  // Sampler classify chain (C76), V3 lane. Chain order mirrors the bytes: field > 0.5 gate (@0x90dbc3 comiss → jbe @0x90dbd0) →
  // mBiomeMaterials-null ⇒ air (@0x90dd01 → je @0x90ddb0 = table null) →
  // evaluator2(x, y, field) (@0x90dd24 — arg order = C76) → floor-fix →
  // classify (@0x90dd7e) → record null ⇒ no window-write ⇒ air
  // (@0x90dd8b). kind/intern/planter arms are byte-observed but their
  // enum semantics are OPEN (C76); any non-null record renders solid.
  // Fail-loud: a component that throws (unknown attr, polygon, null
  // celldata) propagates to noiseAt's catch → the chunk falls through.
  //
  // Gate value (C80): for kind-0 biomes = surfaceField's return (the final
  // combine; the driver 0x908F40 kind-0 arm feeds it into the f32 grid the
  // gate reads, VERIFIED:593) at world px (wx = canvas px − 17920, wy =
  // canvas py − 31744), field0 ≡ 1.0, no gradAt. For BitmapCaves biomes the
  // sampler reads the caves field directly (idx = W·y + x via getter
  // 0x9499f0 on &owner+0xb4, stride [0x9c] = grid[0]; gate > 0.5
  // @0x90dba5..0x90dbd0; writer 0x8EE750 uses the same W·y+x, I25). This
  // branch has no SURFACE_V3 conjunct so env-free test calls mirror the
  // instrument. A field-build throw ⇒ null (whole chunk falls through).
  // Evaluate/classify use the C76 lane frame (frame flip = I21).
  const surfaceTable = ensureSurfaceTable(dataDirRef.dataDir, def);
  const uid = uidFrom(def, cfg);
  uid.driver = makeBandDriver(config, seed);  // the kind-0 r-site frame (world-px coords, C80)
  let gradAt = null;
  let gradKind = "field0"; // caves = the cell read; field0 = kind-0 (field ≡ 1.0) — logged by SURFACE_LOG below
  if (def.bitmapCaves && def.bitmapCaves.sizeX) {
    const caves = ensureCavesField(dataDirRef.dataDir, def, seed);
    const { w: fw, h: fh, field, overlays } = caves;
    // Band-anchored finite cell read (C165/X205): the field's row 0 = one
    // full field height (fh) above the C80 datum (worldY0 = 31744); 24576
    // and 31744 are 256 multiples, so the slab grid holds for any
    // `<BitmapCaves>` sizeY. Rows above the slab top = air. Rows ≥ fh keep
    // the mod wrap (deeper slabs reuse the field); per-slab multi-band
    // stacking is deferred — FLAGGED, ISSUES A14.
    // Stamp-overlay lane (C175): CaveStructure stamp rects materialized from
    // the stamp's own image by its own wg (C171: local image read, no warp,
    // no G). Image frame: stamp X/Y = biome-image cell coords; col = wx/10
    // (image col 0 = wx 0 = canvas 17920), row = (wy + fh)/10 (image row 0 =
    // wy −fh). The overlay lookup runs first; the shaped base field only
    // outside the stamps. FLAGGED (ISSUES §A): the shaped base's G-shifted
    // frame vs the overlay's image frame (+256-col offset question).
    const stampAt = overlays && overlays.length
      ? (wx, wy) => {
          const col = Math.floor(wx / 10), row = Math.floor((wy + fh) / 10);
          for (const o of overlays) {
            const dx = col - o.x, dy = row - o.y;
            if (dx >= 0 && dy >= 0 && dx < o.w && dy < o.h) return o.values[dy * o.w + dx];
          }
          return null;
        }
      : null;
    gradAt = (wx, wy) => {
      if (stampAt) {
        const v = stampAt(wx, wy);
        if (v != null) return v;
      }
      return cavesShapedCellAt(field, fw, fh, wx, wy);
    };
    gradKind = "caves";
  }
  const bandTopPx = SKY_ROWS * CHUNK; // 24576 — classify y frame origin (C76)
  const worldX0 = 35 * CHUNK; // 17920 — C80 world x origin (biome px 35)
  const worldY0 = (SKY_ROWS + 14) * CHUNK; // 31744 — C80 world y origin (biome row 14)
  // Value logger: SURFACE_LOG=<path> ⇒ every evaluated cell is appended as
  // one JSONL record — lane x/y (C76), world wx/wy (C80), gradKind
  // (caves|field0), the lane value, the >0.5 gate, classify's v + the solid
  // verdict. The directory must exist; without the env var nothing is
  // written.
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
      // field build — world px per C80 (canvas py = y + 24576)
      const wx = x - worldX0;
      const wy = y + bandTopPx - worldY0;
      let field;
      try {
        // BitmapCaves ⇒ the direct cell read (the sampler's law); kind-0 ⇒
        // the combine itself, no gradAt (field0 ≡ 1.0).
        field = gradKind === "caves" ? gradAt(wx, wy)
          : surfaceField(uid, wx, wy, DEF_SEED);
      } catch {
        flushLog();
        return null; // unread-core lane → whole chunk falls through (V2 mirror)
      }
      let solid = 0;
      let v = null;
      let mi = 255;
      // The sampler's gate: process only when field > 0.5 — comiss
      // 0x11dfa94 @0x90dbc3 → jbe @0x90e02b (P/P-table null arm = the &&
      // below, @0x90dd01).
      if (field > 0.5 && surfaceTable) {
        // evaluator2 @0x90dd24 = (x, y, field): xmm0/xmm1 = the same
        // origin-added counters classify receives after the floor-fix
        // (identity pinned C76)
        v = evaluator2(x, y, field);
        // The polygon arm is ported (X106) — a throw here is a real defect
        // and propagates to noiseAt's catch (the chunk falls through).
        const rec = classify(surfaceTable, x, y, v);
        if (rec) {
          solid = 1;
          // The record index + name list ride the chunk so worldColorAt
          // paints the material's materials.xml wang_color.
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
  // Surface-lane compositor output — per-cell classify
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

// ------------------------------------------------------- fill lane ---
// Scene-blit grey-placeholder fill — the game's per-cell driver law
// (X148/X149: dig172-driver-908f40-909380.asm,
// dig172-sceneblit-792e00-794400.asm):
//   walk 0x792f98..0x793332 (the asserted 512×512 scene-chunk walk; scene
//   rect origin = chunkX<<9 / chunkY<<9, setup 0x794187-0x79419b, size
//   assert cmpl $0x200 @0x793ebc/0x793f93): per cell, the ART-RECORD plane
//   gate (plane[(row<<9)|col] != 0 → skip, the art-classified cells) then
//   call the driver @0x7930d3 with x = originX+col, y = originY+row;
//   driver NULL → the cell is not painted (the base lane shows through).
//   driver 0x908F40 (this = [+0x70] of the scene): kind-0 arm (mountain_lake
//   and every non-ATTR biome: empty wang_template ⇒ no kind-1 image, P =
//   [config+0x1d4] NULL ⇒ no kind-2 evaluator; other kinds return 0):
//     v = surfaceField(x+0.5, y+0.5)   (the +0.5 const 0x11dfdd8 = C95
//                                      pixel centers; stack arg = config,
//                                      ecx = the driver)
//     chosen = classify([config+0x2a4] = mBiomeMaterials, trunc(x),
//                       trunc(y), v)   (first non-rare window match;
//                       rare comps fall to the polka arm; NULL = no paint)
// Frame (I39(a3) OPEN, D-knob below): the field reads the port's calibrated
// world px (C97 0.5 surface line, M-grade); the classify y-gate frame
// carries the residual game-vs-port frame offset as yOff — capture-fit at
// the mountain_lake anchor (experiments/2026-10-19-dig172-fill-mix-profile.mjs),
// D-flagged in ISSUES §A until a game-lab dump pins it.
const fillLaneCache = new Map();
export function surfaceFillLane(config, def, seed) {
  const key = `${seed}|${def?.filename ?? ""}`;
  let lane = fillLaneCache.get(key);
  if (lane === undefined) {
    lane = null;
    try {
      if (dataDirRef.dataDir == null) {
        try { dataDirRef.dataDir = findNoitaDataDir(); } catch { dataDirRef.dataDir = null; }
      }
      const uid = uidFrom(def, biomeCfg(def));
      uid.driver = makeBandDriver(config, seed); // the kind-0 r-site frame
      const table = ensureSurfaceTable(dataDirRef.dataDir, def);
      if (table) lane = { uid, table };
    } catch {
      lane = null; // unread-core lane → the caller defers
    }
    fillLaneCache.set(key, lane);
  }
  return lane;
}

// The per-cell law: v = surfaceField(world px + 0.5) (the driver's +0.5);
// classify on (x, y + yOff). yOff = the I39(a3) gate-frame knob (px).
// Returns the classify record { i, name } | null (null = the cell stays).
export function surfaceFillAt(lane, wx, wy, yOff = 0) {
  const v = surfaceField(lane.uid, wx + 0.5, wy + 0.5, DEF_SEED);
  return classify(lane.table, wx, wy + yOff, v);
}

// Lazily-memoized chunk mask cache attached onto the world object.
// The caves field is (seed, name)-deterministic (C49), so the ensureWorld
// caller passes the run's worldseed here.
export function attachNoiseTerrain(world, dataDir, seed = 0) {
  // Sky/backdrop attach is unconditional, independent of the SURFACE_*
  // gate: worldColorAt's sky band (ty < 62) falls through to
  // `world.skyAt?.() ?? null` (C110 sky law); without it every sky / void /
  // bin-less px renders opaque black. Tested by the default-lane attach
  // contract in tests/mapgen/world-gen.test.mjs.
  // AIR backdrop (I32) = the chunk biome's Topology background_image (hills
  // = weather_gfx/background_cave_04_alt, coalmine = background_coalmine…),
  // tiled in the chunk frame; defs with no bg art (the_sky = "") → null =
  // transparent air. The game's true parallax/layering = OPEN; this is the
  // prototype tile law.
  // `bgImageAt` = the void/bins-air path (the caller decides); `skyAt` =
  // the pure sky (black air + stars, see the sky note at the top of this
  // file) for rows above the datum (ty < 62). Per-biome backgrounds (C109)
  // = the underground bands (ty >= 62).
  const skyAt = (tx, ty, gx, gy) => {
    // Plain sky = null (transparent air — the renderer's black + C78 air in
    // the capture's mask); stars = hash-placed sprite px composited over
    // black (C110).
    const sb = ensureSkyBackdrop(dataDir);
    if (!sb.star) return null;
    const cx = Math.floor(gx / 32), cy = Math.floor(gy / 32);
    if (skyStarHash(cx, cy) % 23 !== 0) return null;
    const h2 = skyStarHash(cx + 7919, cy + 104729);
    const ox = h2 % 32, oy = (h2 >> 5) % 32;
    const lx = gx - cx * 32 - ox, ly = gy - cy * 32 - oy;
    if (lx < 0 || ly < 0 || lx >= sb.star.w || ly >= sb.star.h) return null;
    const sq = 4 * (ly * sb.star.w + lx);
    const a = sb.star.px[sq + 3] / 255;
    if (a <= 0) return null;
    return [
      Math.round(sb.star.px[sq] * a),
      Math.round(sb.star.px[sq + 1] * a),
      Math.round(sb.star.px[sq + 2] * a),
    ];
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

  // With both lanes disabled the noise band never attaches and the
  // procedural band renders as air; warn once so the state is visible
  // (I33c).
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
  // The world-level probe worldColorAt calls:
  world.noiseSolidAt = (wx, wy) => noiseSolidAt(world, wx, wy);
  // Per-cell material probe — the chunk's classify-record index (255 =
  // air/unclassified).
  world.noiseMatAt = (wx, wy) => {
    const tx = Math.floor(wx / CHUNK), ty = Math.floor(wy / CHUNK);
    const ch = world.noiseAt?.(tx, ty);
    if (!ch || !ch.matIdx) return { idx: 255, names: null };
    const lx = (wx - tx * CHUNK) / 10, ly = (wy - ty * CHUNK) / 10;
    if (lx < 0 || ly < 0 || lx >= 52 || ly >= 52) return { idx: 255, names: null }; // cell 51 = the 2-px remainder (CELLS_PER_CHUNK)
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
  if (lx < 0 || ly < 0 || lx >= 52 || ly >= 52) return 0; // cell 51 = px 510..511
  return ch.mask[52 * Math.floor(ly) + Math.floor(lx)];
}

// Noise lane evaluated for an arbitrary biome (I53, C187) at one canvas
// pixel — the pixel's biome from GetBiomeAt
// 0x909da0 (biomeAtPixel) may differ from its chunk's within 41 px of an
// edge, and the field driver 0x908f40 then runs the kind-0 arm with that
// biome's config: surfaceField(config) → BiomeMaterials_Classify (X223).
// Mirrors noiseChunkMask's V2 branch exactly (the 10-px cell centre, the
// world-px field frame, classify-or-air), so an undisplaced pixel returns the
// chunk mask's own verdict. Returns null when the lane does not apply (a
// wang/template def, no table, the opt-in caves lane, no data dir), else
// { solid, name } (name = the classified material, null when air).
const pixelUidCache = new Map(); // `${seed}|${file}` → { uid, table } | null
export function noisePixelFor(config, def, seed, gx, gy, dataDir = dataDirRef.dataDir) {
  if (!def || def.templateFile) return null;
  const SKY_ROWS = 48;
  const ty = Math.floor(gy / CHUNK);
  if (SURFACE_V3 && def.bitmapCaves && def.bitmapCaves.sizeX && ty >= SKY_ROWS + 15) return null;
  // the data dir is the CALLER's (world.dataDir): the module-global
  // dataDirRef is shared by every suite in the single test fork
  if (!dataDir) { try { dataDir = findNoitaDataDir(); } catch { return null; } }
  const key = `${seed}|${dataDir}|${def.filename}`;
  let lane = pixelUidCache.get(key);
  if (lane === undefined) {
    lane = null;
    const table = ensureSurfaceTable(dataDir, def);
    if (table) {
      const uid = uidFrom(def, biomeCfg(def));
      uid.driver = makeBandDriver(config, seed);
      lane = { uid, table };
    }
    pixelUidCache.set(key, lane);
  }
  if (!lane) return null;
  const tx = Math.floor(gx / CHUNK);
  const cx = Math.floor((gx - tx * CHUNK) / 10), cy = Math.floor((gy - ty * CHUNK) / 10);
  const x = tx * CHUNK + cx * 10 + 5, y = ty * CHUNK + cy * 10 + 5;
  const worldX0 = 35 * CHUNK, worldY0 = (SKY_ROWS + 14) * CHUNK;
  const v = surfaceField(lane.uid, x - worldX0, y - worldY0, DEF_SEED);
  const rec = classify(lane.table, x, y - worldY0, v);
  if (!rec) return { solid: 0, name: null };
  return { solid: 1, name: lane.table.components[rec.i]?.material_name ?? null };
}
