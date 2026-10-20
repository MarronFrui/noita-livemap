// 2026-10-20-dig177-surface-band-sky.mjs — dig #177's E1 render census: the
// surface-band sky counts, GEN vs CAPTURE, for canvas rows 61/62/63 at
// X=39, plus the lane cross-check (which field's air actually renders).
//
// METER-CLASS: E1 — PER-TILE BLACK-PRESENCE COUNTS (units: px, 0..262,144
// per 512×512 tile, stride 1). Two rules recorded side by side:
//   census rule = family-census's (2026-10-20-family-census.mjs): alpha>=10
//                 ∧ r=g=b=0 — the rule behind the committed capture numbers;
//   test rule   = the count-test's (tests/mapgen/world-gen.test.mjs):
//                 null-as-black ∨ all channels < 3.
// The gen z=0 tile path paints worldColorAt's null (the sky-air return of
// the C110 NIGHT law) as opaque black (genmap-server.mjs z=0 loop: alpha 255,
// RGB only when c is truthy), so null ≡ black on the gen side under both
// rules.
//
// PREDICTION (pre-registered BEFORE this instrument's first run, the meter
// law; a pre-instrument scratch probe this session read the gen row-62 black
// at ~31k px, disclosed up front): gen(39,62) census-black RISES from 0 (the
// old law: the row-62 air fell through to the biome's background_cave — the
// committed family-census header records "ours ... sky 0", the dig-#177
// target) to a value EXCEEDING the capture's 21,669 px (our air = the caves
// field's scattered ≤0.5 pockets, which over-fill the row vs the capture's
// contiguous above-silhouette sky); gen(39,63) = 0 black and gen(39,61) ≥
// 100,000 black (the C2/C3 count laws). FALSIFIERS: gen62 < 1000 (the fix
// not in the render path); gen62 ≤ 21,669 (the sky UNDER-covers — the
// port's black would not be the capture's air class); gen63 > 0 (the sky
// leaked below the band); gen61 < 100,000 (the edit broke the sky band
// above).
//
// Lane section (M-grade cross-check of the dig #121 code law — the live
// mask for BitmapCaves biomes = the caves field gradAt, noise-terrain.mjs
// cavesSrc, NOT surfaceField): the tile's mask air cells vs surfaceField's
// air at the same cell centers (the C80 frame: wx = gx − 17920,
// wy = gy − 31744; two offset forms recorded — the live lane's integer
// cell-center and the driver kind-0's +0.5 frame).
//
// Reproduction: SURFACE_V3=1 node mapgen/experiments/2026-10-20-dig177-surface-band-sky.mjs
// Output: mapgen/out/dig177-surface-band-sky.json + printed table.

import fs from "node:fs";
import path from "node:path";

if (process.env.SURFACE_V3 !== "1") {
  console.error("refusing: SURFACE_V3=1 required (the noise lane attaches only with a flag)");
  process.exit(2);
}

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { ensureWorld, worldColorAt } = await import("../lib/world-gen.mjs");
const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
const nt = await import("../lib/noise-terrain.mjs");
const proto = await import("../lib/noise-proto.mjs");
const { readPng } = await import("../lib/images.mjs");

const DATA = findNoitaDataDir();
const SEED = CAPTURE_SEED;
const TX = 39;
const ROWS = [61, 62, 63];
const CAPTURE_TILES = ["39_13", "39_14", "39_15", "39_16", "39_17", "39_18", "39_19"];

// the two black rules (see the header)
const genCensus = (c) => { const [r, g, b, a] = c ?? [0, 0, 0, 255]; return a >= 10 && r === 0 && g === 0 && b === 0; };
const genTest = (c) => !c || (c[0] < 3 && c[1] < 3 && c[2] < 3);
const pngCensus = (d, q) => d[q + 3] >= 10 && d[q] === 0 && d[q + 1] === 0 && d[q + 2] === 0;
const pngTest = (d, q) => d[q] < 3 && d[q + 1] < 3 && d[q + 2] < 3;

// ── the GEN render census ──────────────────────────────────────────────────
const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i");
const world = ensureWorld(SEED, DATA, { cacheDir });
await world.ready;

const gen = {};
for (const ty of ROWS) {
  let censusBlack = 0, testBlack = 0;
  for (let j = 0; j < 512; j++) {
    for (let i = 0; i < 512; i++) {
      const c = worldColorAt(world, TX * 512 + i, ty * 512 + j);
      if (genCensus(c)) censusBlack++;
      if (genTest(c)) testBlack++;
    }
  }
  gen[ty] = { censusBlack, testBlack };
  console.log(`gen row ${ty}: censusBlack=${censusBlack} testBlack=${testBlack}`);
}

// ── the CAPTURE render census (the same two rules) ─────────────────────────
const capture = {};
for (const name of CAPTURE_TILES) {
  const p = path.join(repoRoot, `mapgen/out/ref/${name}.png`);
  if (!fs.existsSync(p)) { capture[name] = null; continue; }
  const img = readPng(p);
  let censusBlack = 0, testBlack = 0;
  const N = img.width * img.height;
  for (let i = 0; i < N; i++) {
    const q = 4 * i;
    if (pngCensus(img.data, q)) censusBlack++;
    if (pngTest(img.data, q)) testBlack++;
  }
  capture[name] = { censusBlack, testBlack };
  console.log(`capture ${name}: censusBlack=${censusBlack} testBlack=${testBlack}`);
}

// ── the LANE cross-check (the dig #121 law): the tile's live mask (the
// caves field for BitmapCaves biomes) vs surfaceField's air at the same
// cell centers (C80 frame; the mask = 52×52 cells of 10 world px).
const config = loadBiomeConfig(DATA);
const at = biomeAt(config, TX, 14);
if (!at) { console.error("biomeAt(39,14) = null"); process.exit(2); }
const def = at.biome;
const laneObj = nt.surfaceFillLane(config, def, SEED);
if (!laneObj) { console.error("surfaceFillLane => null"); process.exit(2); }
const uid = laneObj.uid;
const ch = world.noiseAt(TX, 62);
if (!ch || !ch.mask) { console.error("world.noiseAt(39,62) = no mask"); process.exit(2); }

let maskAir = 0, sfAirInt = 0, sfAirHalf = 0, maskAndSfInt = 0, maskAndSfHalf = 0;
for (let cy = 0; cy < 52; cy++) {
  for (let cx = 0; cx < 52; cx++) {
    const gx = TX * 512 + cx * 10 + 5, gy = 62 * 512 + cy * 10 + 5;
    const wx = gx - 17920, wy = gy - 31744;              // the C80 field frame
    const m = ch.mask[cy * 52 + cx] === 0;               // 0 = air
    let vInt, vHalf;
    try {
      vInt = proto.surfaceField(uid, wx, wy, SEED);
      vHalf = proto.surfaceField(uid, wx + 0.5, wy + 0.5, SEED);
    } catch (e) { console.error(`surfaceField threw: ${e.message}`); process.exit(3); }
    const sInt = vInt <= 0.5, sHalf = vHalf <= 0.5;
    if (m) maskAir++;
    if (sInt) sfAirInt++;
    if (sHalf) sfAirHalf++;
    if (m && sInt) maskAndSfInt++;
    if (m && sHalf) maskAndSfHalf++;
  }
}
const lane = {
  biome: def.filename ?? def.name,
  bitmapCaves: !!def.bitmapCaves,
  maskAir, sfAirInt, sfAirHalf, maskAndSfInt, maskAndSfHalf,
  maskOnlyVsInt: maskAir - maskAndSfInt, sfIntOnly: sfAirInt - maskAndSfInt,
  maskOnlyVsHalf: maskAir - maskAndSfHalf, sfHalfOnly: sfAirHalf - maskAndSfHalf,
  uid: {
    noiseKind: uid.noiseKind, gradWCoef: uid.gradWCoef, perlinCoef: uid.perlinCoef,
    addValue: uid.addValue, addNoise: uid.addNoise, gradStartY: uid.gradStartY,
    gradEndY: uid.gradEndY, mode: uid.mode, slopeFlag: uid.slopeFlag ?? null,
  },
};
console.log(`\nlane (${lane.biome}, bitmapCaves=${lane.bitmapCaves}): maskAir=${maskAir} ` +
  `sfAirInt=${sfAirInt} sfAirHalf=${sfAirHalf} both(mask∩sfInt)=${maskAndSfInt} ` +
  `both(mask∩sfHalf)=${maskAndSfHalf}`);

fs.mkdirSync(path.join(repoRoot, "mapgen/out"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "mapgen/out/dig177-surface-band-sky.json"), JSON.stringify({
  meta: {
    dig: 177, seed: SEED, tileX: TX, canvasRows: ROWS, captureTiles: CAPTURE_TILES,
    laneEnv: "SURFACE_V3=1",
    rules: { census: "alpha>=10 && r=g=b=0 (family-census)", test: "null-as-black || all channels < 3 (count test)" },
    repro: "SURFACE_V3=1 node mapgen/experiments/2026-10-20-dig177-surface-band-sky.mjs",
  },
  gen, capture, lane,
}, null, 2));
console.log("\nwrote mapgen/out/dig177-surface-band-sky.json");
