// 2026-10-20-dig177-tile-vprof.mjs — dig #177 instrument (METER-CLASS: E1 —
// the FIELD-VALUE DISTRIBUTION (histogram + the air count) of surfaceField
// on tile (39,62); no IoU/fG — C97 stays its own instrument).
//
// LANE SCOPE (retagged dig #177, honesty fix): this instrument measures the
// surfaceField CHAIN (the 0x90a860 field; the second-gate/classify lane)
// directly. For BitmapCaves biomes — hills at this tile — the LIVE mask is
// NOT surfaceField: noise-terrain.mjs's cavesSrc gate (the dig #121 law)
// reads the caves field gradAt for the <= 0.5 classify, so the tile's
// rendered air cells = the CAVES field's air, and this histogram's air set
// is a DIFFERENT (near-disjoint) set of cells. The lane comparison + the
// render census (gen vs capture black counts) live in the sibling
// instrument 2026-10-20-dig177-surface-band-sky.mjs.
//
// Context: the capture at tile (39,62) shows sky 21,669 px while the
// pre-fix generated tile showed sky 0 — root cause = the RENDER law (the
// row-62 air fell through to the biome's background_cave; fixed in
// world-gen.mjs, dig #177), not the field's distribution. The field's
// composition = gradWCoef*gradW*per + perlinCoef*w' + add (0x90b0d9..b106
// exit, fresh dig #177 window) — with the ctor defaults gradWCoef=1.0,
// perlinCoef=1.0, add=0 (fresh ctor window dig177-ctor-495c10-496220).
// This probe dumps, for the field lane (world frame, wx = gx-17920,
// wy = gy-31744):
//   1) the tile's biome (biomeAt(39,14)) + its band block (A,B,mode,slope),
//   2) the band driver's cell band + the rampGate profile over y,
//   3) the v histogram + the air/soil/sand shares over the tile,
//   4) the same for the SURFACE_V3 env opt-in vs the live default path.
//
// Units: v = the surfaceField f32 output (dimensionless, the classify
// input; the windows per C136/C146: air <= 0.5 < soil [0.5,0.53) <
// sand [0.53,0.95)); counts = px over the 512x512 full-density sample.
//
// Reproduction: node mapgen/experiments/2026-10-20-dig177-tile-vprof.mjs
// Output: mapgen/out/dig177-tile-vprof.json + printed table.

import fs from "node:fs";
import path from "node:path";

const { findNoitaDataDir, repoRoot } = await import("../lib/paths.mjs");
const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
const nt = await import("../lib/noise-terrain.mjs");
const proto = await import("../lib/noise-proto.mjs");

const DATA = findNoitaDataDir();
const SEED = 78633191;
const CHUNK = 512;

// The tile (39,62) canvas = the world cell (39,14) (C151: capture X_Y =
// canvas chunk (X,Y+48); the biome map frame = the world rows [0,20)).
const config = loadBiomeConfig(DATA);
const at = biomeAt(config, 39, 14);
if (!at) { console.error("biomeAt(39,14) = null"); process.exit(2); }
const def = at.biome;
console.log(`tile biome = ${def.filename ?? def.name ?? "?"}  name=${def.name ?? ""}`);

const lane = nt.surfaceFillLane(config, def, SEED);
if (!lane) { console.error("surfaceFillLane => null (no table/lane)"); process.exit(2); }
const uid = lane.uid;   // the LIVE uid (uidFrom + makeBandDriver, noise-terrain:757)
console.log(`uid: noiseKind=${uid.noiseKind} fbm=${uid.fbm} sx=${uid.sx} sy=${uid.sy} ` +
  `ox=${uid.ox} oy=${uid.oy} squared=${uid.squared} clamped=${uid.clamped} scaled=${uid.scaled} ` +
  `scaleMin=${uid.scaleMin} scaleMax=${uid.scaleMax} gradWCoef=${uid.gradWCoef} ` +
  `perlinCoef=${uid.perlinCoef} addValue=${uid.addValue} addNoise=${uid.addNoise}`);
console.log(`uid band [A,B]=${uid.gradStartY},${uid.gradEndY} mode=${uid.mode} ` +
  `slopeX=${uid.gradSlopeStartX} slopeDelta=${uid.gradSlopeDelta} ` +
  `noiseScale=${uid.gradNoiseScale} lowN=${uid.gradLowNoise} highN=${uid.gradHighNoise}`);

// the driver's band cell for the tile (the live bandRampEval path):
const d = uid.driver;
const band = d.bandAt(d.w * 14 + 39);
console.log(`driver: w=${d.w} h=${d.h} bandCount=${d.bandCount} baseX=${d.baseX} baseY=${d.baseY}`);
if (band) {
  console.log(`band[14,39]: A=${band.gradStartY} B=${band.gradEndY} mode=${band.mode} ` +
    `slopeX=${band.gradSlopeStartX} slopeDelta=${band.gradSlopeDelta} ` +
    `noiseScale=${band.gradNoiseScale} lowN=${band.gradLowNoise} highN=${band.gradHighNoise}`);
} else console.log("band[14,39] = NULL");

// the ramp profile over the tile rows (the band params + rampGate at the
// tile's mid column, world frame x = 2048+256 = 2304):
const X = 2048 + 256;
const rows = [];
for (let y = 0; y < CHUNK; y += 32) {
  const p = proto.bandParams(d, band ?? uid, X + 0.5);
  const R = proto.bandRampEval(d, band ?? uid, X + 0.5, y + 0.5);
  rows.push({ y, A: +p[0].toFixed(2), B: +p[1].toFixed(2), R: +R.toFixed(4) });
}
console.log("ramp profile (y, A, B, R):");
for (const r of rows) console.log(`  y=${String(r.y).padStart(3)} A=${String(r.A).padStart(9)} B=${String(r.B).padStart(9)} R=${r.R}`);

// the v histogram over the tile at FULL density (world px frame):
const H = 64, edges = [];
for (let i = 0; i <= H; i++) edges.push(-0.5 + (2.0 * i) / H); // v ∈ [-0.5, 1.5]
const hist = new Array(H).fill(0);
let n = 0, air = 0, soil = 0, sand = 0, hi = 0, lo = 0, sum = 0, min = Infinity, max = -Infinity;
for (let y = 0; y < CHUNK; y++) {
  for (let x = 2048; x < 2048 + CHUNK; x++) {
    let v;
    try { v = proto.surfaceField(uid, x + 0.5, y + 0.5, SEED); }
    catch (e) { console.error(`surfaceField threw at ${x},${y}: ${e.message}`); process.exit(3); }
    n++; sum += v;
    if (v < min) min = v; if (v > max) max = v;
    if (v <= 0.5) air++;
    else if (v < 0.53) soil++;
    else if (v < 0.95) sand++;
    else hi++;
    if (v < -0.5) lo++;
    const b = Math.min(H - 1, Math.max(0, Math.floor(((v + 0.5) * H) / 2.0)));
    hist[b]++;
  }
}
console.log(`\nv stats over ${n} px: min=${min.toFixed(4)} mean=${(sum / n).toFixed(4)} max=${max.toFixed(4)}`);
console.log(`air(v<=0.5)=${air} (${((100 * air) / n).toFixed(1)}%)  soil(0.5..0.53)=${soil}  ` +
  `sand(0.53..0.95)=${sand}  hi(>=0.95)=${hi}  below-min=${lo}`);
console.log("v histogram (bucket: count):");
for (let i = 0; i < H; i++) {
  if (!hist[i]) continue;
  const bar = "#".repeat(Math.min(60, Math.round((60 * hist[i]) / n)));
  console.log(`  [${edges[i].toFixed(3)},${edges[i + 1].toFixed(3)}): ${String(hist[i]).padStart(6)} ${bar}`);
}

fs.mkdirSync(path.join(repoRoot, "mapgen/out"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "mapgen/out/dig177-tile-vprof.json"), JSON.stringify({
  tile: [39, 62], worldCell: [39, 14], seed: SEED,
  biome: def.filename ?? def.name, uid, band: band ?? null,
  rampProfile: rows,
  vStats: { n, min, mean: sum / n, max, air, soil, sand, hi, belowMin: lo },
  hist, edges,
}, null, 2));
console.log("\nwrote mapgen/out/dig177-tile-vprof.json");
