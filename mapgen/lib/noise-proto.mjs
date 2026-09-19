// mapgen/lib/noise-proto.mjs — F3 noise prototype SKELETON (digs #1–#3, 2026-09-19/20)
//
// Binary-derived per ABOUT_MATH 2026-09-19 (12)/(13). Constants per
// CONSTANTS.md: C25 (2D/3D simplex cores + perm tables), C26
// (FUN_00908cb0 transform), C29 (quintic lattice), C30 (0x908e70
// evaluator). Perm tables byte-extracted from noita_dev.exe .rdata
// (VA 0x114ced0 / 0x114d700, each 256 unique entries mirrored to 512
// in-binary — verified this session). C13 anchor re-pinned each dig
// (slab 0x50124d = true 0x901a4d).
//
// STATUS: SKELETON ONLY — the runnable JS formulas await dig #4
// (the decompile prose lives in ABOUT_MATH 2026-09-19 (13)).
// Known-open inputs: the lattice gradient VALUE table is runtime .data
// @0x12eec08 (not statically extractable, C29) and the clamp direction
// in C30 needs re-verification at port time. Do NOT cite as validated.

// 512-mirror of .rdata @0x114ced0 (first 256 entries shown; in-binary
// the table repeats, code indexes mod the 512 layout).
export const PERM_SIMPLEX_HEAD = new Uint8Array([
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
  140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,
]);

// 512-mirror @0x114d700 (C29).
export const PERM_LATTICE_HEAD = new Uint8Array([
  23,125,161,52,103,117,70,37,247,101,203,169,124,126,44,123,
]);

// C25 — simplex core constants (byte-pinned .rdata):
export const SIMPLEX_2D = {
  F2: 0.3660254,        // 0x11dfa34
  G2: 0.21132487,       // 0x11df9c0
  G2X2: 0.42264974,     // 0x11dfa4c
  kernel: 0.5,          // 0x11dfa94
  outScale: 40.0,       // 0x11e0270
  permVA: 0x114ced0,
};

// C26 — FUN_00908cb0 (slab 0x5084b0) transform knobs (f64 fields noted):
export const TRANSFORM = {
  scale01: 0.1,        // f64 @0x11dfd08
  latticeA: 0.13715,   // f64 @0x11dfd30 (x)
  latticeB: 0.13717,   // f64 @0x11dfd38 (y)
  ninth: 0.11111111,   // f64 @0x11dfd20 = 1/9
  wMult: 0.45,         // 0x11dfa5c
  wBias: 0.1,          // 0x11df974
  yMult: 0.33,         // 0x11dfa10
  yBias: 0.111,        // 0x11df97c
  cfgMinVA: 0x1327670, // C24 runtime globals feed adjX/adjY (see C24)
  cfgMaxVA: 0x13289a8,
};

// C29 — quintic lattice (true 0x8fc740 / 0x900900):
export const LATTICE = {
  quintic: [6.0, 15.0, 10.0],  // 0x11e00e8 / 0x11e01a0 / 0x11e015c
  permVA: 0x114d700,
  gradTableVA: 0x12eec08,      // stride 8; runtime-only (C29) — OPEN input
};

// C30 — second evaluator (true 0x908e70):
export const EVAL2 = {
  anisoX: 0.035,        // f64 @0x11dfc98
  anisoY: 0.07,         // f64 @0x11dfce8
  warp: 15.5,           // @0x11e01b0
  warpScale: 0.0489275, // @0x11df944
  gain: 5.35,           // @0x11e00b4
  gamma: 0.95,          // @0x11dfbac
};

// Simplex2D skeleton (structured; NOT yet runnable-validated).
// Full op trace: ABOUT_MATH 2026-09-19 (12)/(13).
export function simplex2d(xin, yin) {
  void xin; void yin;
  throw new Error('noise-proto: simplex2d port pending dig #4 (see mapgen/lib/noise-proto.mjs header)');
}
