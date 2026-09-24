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

import { evaluator2, noiseDispatch, surfaceField } from "./noise-proto.mjs";
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
const surfaceTableCache = new Map(); // def.filename -> table | null
function ensureSurfaceTable(dataDir, def) {
  if (!def.filename) return null;
  if (surfaceTableCache.has(def.filename)) return surfaceTableCache.get(def.filename);
  let table = null;
  const dir = dataDir ?? dataDirRef.dataDir;
  if (dir) {
    const xml = fs.readFileSync(path.join(dir, def.filename.replace(/^data\//, "")), "utf-8");
    const blocks = xml.match(/<MaterialComponent\b[^>]*>/g) ?? [];
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

// uid-config adapter (C37 offset map) ← the extracted XML attrs (dig #8
// extraction in biomes.mjs, ABOUT_MATH (22)). MISSING surfaces (the
// mGradientSinMultiple*/mGradientType/mInsidePerlinFunc pair of the
// winter-only attrs never appears in the exe) → number("") guards.
// SLOT BINDING (CE-verified 2026-09-20 (35), CONSTANTS.md C43; term offsets
// C37): gradWCoef = [+0x268] = XML mMultiplierPerlin (CE: hills 1.0 with
// the attr ABSENT; winter.xml 0.642857); perlinCoef = [+0x264] =
// XML mMultiplierGradient (hills 0.871429 ✓). noiseType census (extracted
// data, 2026-09-21): ALL 36 live noise_type attrs = "SIN_CAPPED_SIMPLEX"
// and the CE read [uid+0x224] = 5 ⇒ kind 5 (= the 0x8fc020 core,
// simplex2DDeriv) — replaces the old kind-8 proxy (still the honest
// default -1 for any other name; the name-blob has NO static table, C42).
function uidFrom(def, cfg) {
  const n = (v, d) => { const p = parseFloat(v); return Number.isFinite(p) ? p : d; };
  return {
    noiseKind: def.noiseType === "SIN_CAPPED_SIMPLEX" ? 5 : -1, // CE (35): 5
    gradient: 0,           // unused until the field-source read (see C44)
    sx: n(def.mInsidePerlinScaleX, 1), sy: n(def.mInsidePerlinScaleY, 1),
    ox: 0, oy: 0,          // mInsidePerlinOffsetX/Y not present in current XMLs
    offsetBySeed: false,   // attr absent → false (byte: [+0x24d] gate)
    fbm: false,            // [uid+0x228]
    noiseTypeInt: def.noiseType === "SIN_CAPPED_SIMPLEX" ? 5 : -1, // CE (35); else -1 (C42)
    squared: n(def.mInsidePerlinSquared, 0) === 1,
    clamped: n(def.mInsidePerlinClamped, 0) === 1,
    scaled: n(def.mInsidePerlinScaled, 0) === 1,
    scaleMin: n(def.mInsidePerlinScaleMin, 0.057143),
    scaleMax: n(def.mInsidePerlinScaleMax, 2),
    gradWCoef: n(def.mMultiplierPerlin, 1.0),   // [+0x268] (CE hills=1.0)
    perlinCoef: n(def.mMultiplierGradient, 0),  // [+0x264] (CE hills=0.871429)
    addValue: 0,
    addNoise: n(def.mGradientAddNoise, 1),
    minX: cfg.minX, maxX: cfg.maxX,         // C24 lane (passed through)
  };
}

// gradAt: the mGradient y-ramp INSTRUMENT for biomes WITHOUT bitmap_noise_file
// (NOT byte-backed — the C39 open item "per-biome image path resolution for
// hills/winter"; registered in CONSTANTS.md C39 / VERIFIED.md §12). Shape model: linear
// ramp StartY→EndY mapping to LowNoise→HighNoise on world-y. Isolated here
// so the instrument can swap it once the rasterize read lands.
function makeGradAt(def) {
  const y0 = parseFloat(def.mGradientStartY ?? "-1024");
  const y1 = def.mGradientEndY ?? 1024;
  const lo = parseFloat(def.mGradientLowNoise ?? "0");
  const hi = parseFloat(def.mGradientHighNoise ?? "0");
  return (gx, gy) => {
    const t = Math.max(0, Math.min(1, (gy - y0) / Math.max(1e-6, y1 - y0)));
    return lo + (hi - lo) * t;
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
  const cfg = biomeCfg(def);
  if (!dataDirRef.dataDir) {
    try { dataDirRef.dataDir = findNoitaDataDir(); } catch { dataDirRef.dataDir = null; }
  }
  if (SURFACE_V2) {
    // dig #9c lane (true 0x90a860): surfaceField with the ramp-prototype
    // gradAt; the mGradientAddNoise=1..3 inner-core lanes THROW until W3/W4
    // land — those biomes yield null (caller falls through), honestly.
    const uid = uidFrom(def, cfg);
    // dig #30: the caves-field source when the biome carries <BitmapCaves>
    // (the hills/desert/pyramid family); otherwise the C39 IMAGE-LANE
    // gradAt when a bitmap_noise_file exists (the lake family), else the
    // ramp instrument.
    let gradAt = null;
    // THE open lane: the caves-field composition is still a model (the
    // fn B per-phase placement is un-read) — visual = VERIFIED.md §12.
    if (SURFACE_V3 && def.bitmapCaves && def.bitmapCaves.sizeX) {
      const caves = ensureCavesField(dataDirRef.dataDir, def, seed);
      const { w: fw, h: fh, field } = caves;
      gradAt = (gx, gy) =>
        field[(((Math.floor(gy) % fh) + fh) % fh) * fw
            + (((Math.floor(gx) % fw) + fw) % fw)];
    } else {
      gradAt =
        makeGradAtFromTopology(dataDirRef.dataDir, def) ?? makeGradAt(def);
    }
    for (let cy = 0; cy < 52; cy++) {
      for (let cx = 0; cx < 52; cx++) {
        const gx = tx * CELLS_PER_CHUNK + cx + 0.5;
        const gy = ty * CELLS_PER_CHUNK + cy + 0.5;
        let v;
        try {
          v = surfaceField(uid, gx, gy, gradAt, 0, DEF_SEED);
        } catch {
          return null; // unread-core lane → whole chunk falls through
        }
        mask[52 * cy + cx] = v > 0.5 ? 1 : 0;
      }
    }
    return { mask, def, v2: true };
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
  // gradAt selection = the V3 model (the V2 lane's :219-231 semantics,
  // WITHOUT its SURFACE_V3 conjunct: this branch only runs under the
  // V3 candidate — attach gate :340 — or direct env-free test calls,
  // and the conjunct would desync the test mirror from the instrument):
  // caves-field grid for <BitmapCaves> biomes, else the C39 image lane,
  // else the world-y ramp. Field build throws (I20 default arm,
  // noiseKind −1 on winter/mountain_center per VERIFIED §8 row 30) ⇒
  // return null = whole chunk falls through honestly (V2 :237-241
  // mirror). Evaluate/classify keep the C76 lane frame unchanged this
  // dig (evaluator2≡classify floor-fix identity; frame flip = I21).
  const surfaceTable = ensureSurfaceTable(dataDirRef.dataDir, def);
  const uid = uidFrom(def, cfg);
  let gradAt = null;
  if (def.bitmapCaves && def.bitmapCaves.sizeX) {
    const caves = ensureCavesField(dataDirRef.dataDir, def, seed);
    const { w: fw, h: fh, field } = caves;
    gradAt = (gx, gy) =>
      field[(((Math.floor(gy) % fh) + fh) % fh) * fw
          + (((Math.floor(gx) % fw) + fw) % fw)];
  } else {
    gradAt =
      makeGradAtFromTopology(dataDirRef.dataDir, def) ?? makeGradAt(def);
  }
  const bandTopPx = SKY_ROWS * CHUNK; // 24576 — classify y frame origin (C76)
  const worldX0 = 35 * CHUNK; // 17920 — C80 world x origin (biome px 35)
  const worldY0 = (SKY_ROWS + 14) * CHUNK; // 31744 — C80 world y origin (biome row 14)
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
        field = surfaceField(uid, wx, wy, gradAt, 0, DEF_SEED);
      } catch {
        return null; // unread-core lane → whole chunk falls through (V2 mirror)
      }
      let solid = 0;
      // the sampler's own gate: process only when the FIELD (the
      // surfaceField return) > 0.5 — comiss 0x11dfa94 @0x90dbc3 →
      // jbe @0x90e02b (P/P-table null arm stays the && below, @0x90dd01)
      if (field > 0.5 && surfaceTable) {
        // evaluator2 @0x90dd24 = (x, y, field): xmm0/xmm1 = the same
        // origin-added counters classify receives after the floor-fix
        // (identity pinned C76) — NOT the wang-cell+config proxy
        const v = evaluator2(x, y, field);
        solid = classify(surfaceTable, x, y, v) ? 1 : 0;
      }
      mask[52 * cy + cx] = solid;
    }
  }
  return { mask, def };
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
  // OPT-IN (VERIFIED.md §12): with neither lane flag set the noise branch
  // never attaches and the procedural band renders as honest air (the
  // art-scenes + wang areas carry the whole visible band).
  if (!SURFACE_V2 && !SURFACE_V3) return world;
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
