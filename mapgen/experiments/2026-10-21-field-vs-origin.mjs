// E1 FIELD-VS-ORIGIN census — does the hills caves field contain AIR at its
// TOP rows (the band origin), or is it solid all the way up?
//
// Why (I47 / the main-priority surface shape): our rendered horizon sits
// pinned ~12 px above the band origin with IQR 0 px at tx38/tx39 while the
// capture's horizon floats 160-311 px above the origin (IQR 73-193 px).
// Two candidate mechanisms:
//   (A) OOB-only: above the origin there is NO field (gradAt returns the
//       -1 sentinel) but the field's own top rows are AIR — the horizon
//       would then sit inside the band, not at its edge.
//   (B) uniformly-solid: the field is solid from its first row down, so the
//       horizon can only be the origin boundary itself.
// This distinguishes them by counting solid share per 32-row band of the
// 512x256 field, top bands first.
//
// METER-CLASS: E1 — COUNTS (cells; units: cells over the 512x256 grid,
// 0..131,072; row bands of 32 cells; solid = v > 0.5, the sampler's own
// C34 gate). No IoU/fG/rms/meanAbs.
//
// PREDICTION (pre-registered BEFORE the run):
//   P1: top bands (rows 0..31, 32..63) have solid share >= 0.85 — supports
//       (B).  Falsified if either top band < 0.85 (then the field DOES carry
//       air at its top and the origin pin is not explained this way).
//   P2: no band's solid share falls below 0.5 (the grid has no deep air
//       region) — falsified if any band < 0.5.
//   P3: countNeg = 0 across the whole grid (re-confirms the dig #178
//       artifact, now under the solidity framing).
// Out-of-prediction = a byte read, never accommodation.

const DATA_DIR = process.env.NOITA_DATA_DIR
  ?? "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const { findNoitaDataDir, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
const { buildCavesField } = await import("../lib/caves-field.mjs");

const dir = process.env.NOITA_DATA_DIR ?? findNoitaDataDir();
const cfg = loadBiomeConfig(dir);
// the hills anchor at the same tile the dig #177/#178 instruments use
const at = biomeAt(cfg, 39, 14);
if (!at) { console.error("biomeAt(39,14) = null"); process.exit(2); }
const def = at.biome;

const { w, h, field, bytes } = buildCavesField(dir, def, CAPTURE_SEED);
console.log(`grid ${w}x${h} = ${w * h} cells (hills.xml size_x/size_y)`);

const BAND = 32;
const bands = [];
let countNeg = 0, countLE05 = 0, countGT05 = 0;
for (let b = 0; b * BAND < h; b++) {
  let solid = 0, n = 0;
  for (let y = b * BAND; y < Math.min((b + 1) * BAND, h); y++) {
    for (let x = 0; x < w; x++) {
      const v = field[y * w + x];
      if (v < 0) countNeg++;
      if (v <= 0.5) countLE05++; else countGT05++;
      if (v > 0.5) solid++;
      n++;
    }
  }
  bands.push({ rows: `${b * BAND}..${b * BAND + BAND - 1}`, solidShare: +(solid / n).toFixed(4) });
}
// byte plane coverage (the I38/A9 lever) for the same grid
let byteNonzero = 0;
if (bytes) for (let i = 0; i < bytes.length; i++) if (bytes[i]) byteNonzero++;

const out = {
  grid: `${w}x${h}`, total: w * h,
  countNeg, countLE05, countGT05,
  byteNonzero, byteNonzeroShare: +(byteNonzero / (w * h)).toFixed(4),
  bands,
  repro: "SURFACE_V3=1 node mapgen/experiments/2026-10-21-field-vs-origin.mjs",
};
console.log(JSON.stringify(out, null, 1));
const fs = await import("node:fs");
fs.writeFileSync("mapgen/out/field-vs-origin.json", JSON.stringify(out, null, 1));
console.log("wrote mapgen/out/field-vs-origin.json");
