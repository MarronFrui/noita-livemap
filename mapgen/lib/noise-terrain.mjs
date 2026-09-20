// mapgen/lib/noise-terrain.mjs — F3 noise-terrain integration (2026-09-20)
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

const CHUNK = 512; // (matches world-gen CHUNK; local to avoid the ESM cycle)
const CELLS_PER_CHUNK = CHUNK / 10; // 51.2 → subrect 0..51 (C11 grid shape — cell 51 is the 20px remainder)

// V2 wiring flag (2026-09-20 dig #9c): the true 0x90a860 lane
// (surfaceField + noiseDispatch, dig #9 port) is OPT-IN via SURFACE_V2=1 —
// the default path stays evaluator2(a=1.0) so the r3f render stays stable
// until the shape instruments (I1/I3) gate the bump.
const SURFACE_V2 = process.env.SURFACE_V2 === "1";

// Per-biome "Wang offset" (C24/C28): ConfigRegistry defaults, engine-side.
// Tagged @prov noitool (the 159/223 family); validated only at runtime.
function biomeCfg(_biome) {
  return { minX: 159.0, maxX: 223.0 };
}

// uid-config adapter (C37 offset map) ← the extracted XML attrs (dig #8
// extraction in biomes.mjs, ABOUT_MATH (22)). MISSING surfaces (the
// mGradientSinMultiple*/mGradientType/mInsidePerlinFunc pair of the
// winter-only attrs never appears in the exe) → number("") guards.
function uidFrom(def, cfg) {
  const n = (v, d) => { const p = parseFloat(v); return Number.isFinite(p) ? p : d; };
  return {
    noiseKind: 8,          // SIN_CAPPED_SIMPLEX → dispatcher case: UNMAPPED
                           // (w2 open; 8 = the C25 simplex — flagged proxy)
    gradient: 0,           // unused until W5 (gradAt is injected)
    sx: n(def.mInsidePerlinScaleX, 1), sy: n(def.mInsidePerlinScaleY, 1),
    ox: 0, oy: 0,          // mInsidePerlinOffsetX/Y not present in current XMLs
    offsetBySeed: false,   // attr absent → false (byte: [+0x24d] gate)
    fbm: false,            // [uid+0x228]
    noiseTypeInt: -1,      // W2 open
    squared: n(def.mInsidePerlinSquared, 0) === 1,
    clamped: n(def.mInsidePerlinClamped, 0) === 1,
    scaled: n(def.mInsidePerlinScaled, 0) === 1,
    scaleMin: n(def.mInsidePerlinScaleMin, 0.057143),
    scaleMax: n(def.mInsidePerlinScaleMax, 2),
    multGradient: n(def.mMultiplierGradient, 0),
    multPerlin: 0,         // present in winter.xml only (see W-native gate)
    addValue: 0,
    addNoise: n(def.mGradientAddNoise, 1),
    minX: cfg.minX, maxX: cfg.maxX,         // C24 lane (passed through)
  };
}

// gradAt: the mGradient y-ramp PROTOTYPE (NOT byte-backed — the C39 open
// byte is the mGradient*→image rasterize step; registered in
// WIRING_SURFACE.md W5). Shape model: linear ramp StartY→EndY mapping to
// LowNoise→HighNoise on world-y. Isolated here so the instrument can
// swap it once the rasterize read lands.
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

// Solid mask for one 512-chunk in a procedural (non-wang-template) biome.
// Returns a 52×52 Uint8Array (cell grid; 1 = solid, 0 = air/empty).
export function noiseChunkMask(config, tx, ty) {
  const SKY_ROWS = 48;
  const at = biomeAt(config, tx, ty - SKY_ROWS);
  const def = at?.biome;
  if (!def || def.templateFile) return null; // wang/template chunks handled elsewhere
  const mask = new Uint8Array(52 * 52);
  const cfg = biomeCfg(def);
  if (SURFACE_V2) {
    // dig #9c lane (true 0x90a860): surfaceField with the ramp-prototype
    // gradAt; the mGradientAddNoise=1..3 inner-core lanes THROW until W3/W4
    // land — those biomes yield null (caller falls through), honestly.
    const uid = uidFrom(def, cfg);
    const gradAt = makeGradAt(def);
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
  for (let cy = 0; cy < 52; cy++) {
    for (let cx = 0; cx < 52; cx++) {
      // global wang-cell coords (10 world px per cell, C10/C11)
      const gx = tx * CELLS_PER_CHUNK + cx + 0.5;
      const gy = ty * CELLS_PER_CHUNK + cy + 0.5;
      // the sampler's own gate: process only when the field > 0.5 —
      // here the field IS the binary evaluator (single-call shape proxy)
      const v = evaluator2(gx + cfg.minX, gy + cfg.maxX, 1.0);
      mask[52 * cy + cx] = v > 0.5 ? 1 : 0;
    }
  }
  return { mask, def };
}

// DEF_SEED: the per-cell seed draw for the OffsetBySeed path — the
// current XMLs never set that attr, so this stays 0 until C27's generator
// walk feeds it; kept here so the V2 lane has an explicit injection point.
const DEF_SEED = 0;

// Lazily-memoized chunk mask cache attached onto the world object.
export function attachNoiseTerrain(world, dataDir) {
  const cache = new Map(); // "tx,ty" -> {mask, def} | null
  world.noiseAt = (tx, ty) => {
    const key = `${tx},${ty}`;
    if (cache.has(key)) return cache.get(key);
    let r = null;
    try {
      r = noiseChunkMask(world.config, tx, ty);
    } catch {
      r = null;
    }
    cache.set(key, r);
    return r;
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
  if (lx < 0 || ly < 0 || lx >= 52 || ly >= 52) return 0;
  return ch.mask[52 * Math.floor(ly) + Math.floor(lx)];
}
