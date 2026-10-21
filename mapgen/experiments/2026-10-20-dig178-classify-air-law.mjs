// 2026-10-20-dig178-classify-air-law.mjs — dig #178's E1 census: the
// THREE-WAY CLASSIFY LAW's render + field consequences, gen vs capture,
// at the hills anchor (the BitmapCaves lane) — the air-mark flip
// (v <= 0.5 ⇒ air  →  v < 0 ⇒ air, the [0, 0.5] band = the base fill).
//
// METER-CLASS: E1 — CELL/PIXEL COUNTS (units: cells over the 512x256
// caves grid, 0..131,072; px per 512x512 tile, 0..262,144; stride 1).
// No IoU/fG/rms/meanAbs — C97 stays its own instrument.
//
// The law being measured (dig #178, C153; the sampler fn 0x90d860
// full-window read, X178): the game's air arm @0x90e02b stamps the u8
// air plane ([owner+0x1a0]) ONLY when v < 0 (xorps/comiss/jbe); the
// v ∈ [0, 0.5] cells receive NO stamp (= the band's base fill); v > 0.5
// = the claim path.
//
// THE PORT WAS FALSIFIED AND REVERTED (entry (178), §8 row 62). At
// write time the code read `mask = v >= 0 ? 1 : 0` (the ported gate,
// plus the band-origin sentinel switched to -1); the run below
// FALSIFIED it and both edits were REVERTED in the same dig, so this
// instrument now measures the COMMITTED `v > 0.5` rule. The law itself
// STANDS as a byte law (C153) — only its use as the MASK rule is
// eliminated. Root cause = countNeg = 0 (F1): the v < 0 arm can never
// fire on our field, so the missing lever is the field's NEGATIVE
// region, upstream of the gate → dig #179.
//
// PREDICTION (pre-registered BEFORE this instrument's first run, the
// meter law):
//   R1: gen(39,62) black DROPS strictly below 30,961 (the old rule's
//       rendered count, dig #177's artifact) and stays > 0 (the sky
//       remains); the landing is UNPINNED — if it ≈ 21,669 (the capture)
//       the port field's negative mass matches the game's air class; a
//       count >= 30,961 or = 0 is OUT-OF-PREDICTION (= a byte read).
//   R2: gen(39,61) stays ~254,921 (the rows above the band origin take
//       the OOB -1 sentinel and never consult the field — a DROP here =
//       a sentinel defect, falsifier < 250,000).
//   R3: gen(39,63) = 0 (the bg lane, untouched).
//   F1: the field census: countNeg (v < 0) > 0 AND strictly below
//       countLE05 (v <= 0.5) — the [0, 0.5] band has mass and the flip
//       is not a no-op; countNeg == countLE05 is OUT-OF-PREDICTION.
//   D1 (direction only, no pass/fail — I37's interim): the per-def-row
//       negative share over the caves grid (the deep-band air's E1
//       profile under the new law; the claim-material carve port is a
//       later dig).
//
// OUTCOMES (recorded AFTER the runs; the predictions above stand as
// pre-registered and are NOT rewritten):
//   R1 OUT-OF-PREDICTION, twice over. (i) The first run reproduced dig
//       #177's number EXACTLY (30,961 px) — no change at all. The
//       mandated byte read (never accommodation) found the LANE
//       MISMATCH: the edited lines sit inside
//       `if (SURFACE_V2) { … return {v2:true} }`, while this
//       instrument only requires SURFACE_V3=1 ⇒ the port never
//       executed. (ii) Once the port was made to execute the count was
//       946 px — R1's other OUT-OF-PREDICTION branch (≈ 0).
//   R2 IN-PREDICTION under the port: 254,629 (>= the 250,000
//       falsifier); R3 IN-PREDICTION: 0.
//   F1 OUT-OF-PREDICTION: countNeg = 0 (F1 predicted > 0) — the flip
//       is not merely oversized, it CANNOT work: the v < 0 arm is dead
//       on our field. This is exactly what makes the byte law true and
//       the port unusable at the same time.
//
// LANE-CONTROLLED A/B (pre-registered BEFORE the arm-B run;
// transcribed here from the in-session pre-registration). BOTH arms run
// SURFACE_V2=1 SURFACE_V3=1 — the same lane — so ONLY the mask rule
// differs. (A naive lane A/B is confounded: with the ORIGINAL rule the
// V3 lane yields 30,961 and the V2 lane 28,323 — a 2,638-px lane delta
// — so comparing V3+original against V2+ported mixes two variables and
// overstates the effect.)
//   Arm A — the ORIGINAL rule `v > 0.5 ? 1 : 0`: row-62 black
//       = **28,323** px.
//   Arm B — the PORTED rule `v >= 0 ? 1 : 0`: row-62 black
//       = **946** px. Capture = **21,669** px.
//   B1 (the flip removes sky): CONFIRMED, −27,377 px.
//   B2 (it OVERSHOOTS): CONFIRMED — only −6,654 px of correction was
//       needed (28,323 − 21,669), so the flip applies 4.11x too much
//       and lands 20,723 px short. The falsifier (a landing inside
//       [21,000, 23,000] = the port fixed the shape) was NOT met.
//   Repro: `SURFACE_V2=1 SURFACE_V3=1 node <this file>`. Arm B needs
//       the two reverted edits present (`gradAt`'s OOB sentinel → -1;
//       the mask rule → `v >= 0`); with them reverted the identical
//       command yields arm A's 28,323 — which is the committed state's
//       own measurement.
//
// Reproduction: SURFACE_V3=1 node mapgen/experiments/2026-10-20-dig178-classify-air-law.mjs
// Output: mapgen/out/dig178-classify-air-law.json + printed table.

import fs from "node:fs";
import path from "node:path";

if (process.env.SURFACE_V3 !== "1") {
  console.error("refusing: SURFACE_V3=1 required (the noise lane attaches only with a flag)");
  process.exit(2);
}

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { ensureWorld, worldColorAt } = await import("../lib/world-gen.mjs");
const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
const { buildCavesField } = await import("../lib/caves-field.mjs");
const { readPng } = await import("../lib/images.mjs");

const DATA = findNoitaDataDir();
const SEED = CAPTURE_SEED;
const TX = 39;
const ROWS = [61, 62, 63];
const CAPTURE_TILES = ["39_13", "39_14", "39_15", "39_16", "39_17", "39_18", "39_19"];

// the two black rules (identical to the dig #177 instrument — the census
// rule = family-census's; the test rule = the count tests')
const genCensus = (c) => { const [r, g, b, a] = c ?? [0, 0, 0, 255]; return a >= 10 && r === 0 && g === 0 && b === 0; };
const genTest = (c) => !c || (c[0] < 3 && c[1] < 3 && c[2] < 3);
const pngCensus = (d, q) => d[q + 3] >= 10 && d[q] === 0 && d[q + 1] === 0 && d[q + 2] === 0;

// ── the GEN render census (rows 61/62/63 under the NEW gate) ────────────────
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

// ── the CAPTURE census (unchanged reference) ────────────────────────────────
const capture = {};
for (const name of CAPTURE_TILES) {
  const p = path.join(repoRoot, `mapgen/out/ref/${name}.png`);
  if (!fs.existsSync(p)) { capture[name] = null; continue; }
  const img = readPng(p);
  let censusBlack = 0;
  const N = img.width * img.height;
  for (let i = 0; i < N; i++) if (pngCensus(img.data, 4 * i)) censusBlack++;
  capture[name] = { censusBlack };
  console.log(`capture ${name}: censusBlack=${censusBlack}`);
}

// ── the FIELD dual-rule census (the caves grid, the hills def) + the
// per-def-row negative profile (D1) ─────────────────────────────────────────
const config = loadBiomeConfig(DATA);
const at = biomeAt(config, TX, 14);
if (!at) { console.error("biomeAt(39,14) = null"); process.exit(2); }
const def = at.biome;
const caves = buildCavesField(DATA, def, SEED);
const { field, w: fw, h: fh } = caves;
let countNeg = 0, countLE05 = 0;
const rowNeg = new Array(fh).fill(0), rowTot = new Array(fh).fill(0);
for (let r = 0; r < fh; r++) {
  for (let c = 0; c < fw; c++) {
    const v = field[r * fw + c];
    if (v < 0) { countNeg++; rowNeg[r]++; }
    if (v <= 0.5) countLE05++;
    rowTot[r]++;
  }
}
// the deep-band profile in 32-row bands (the def grid's rows 0..255)
const bands = [];
for (let b = 0; b < fh; b += 32) {
  let n = 0, t = 0;
  for (let r = b; r < b + 32 && r < fh; r++) { n += rowNeg[r]; t += rowTot[r]; }
  bands.push({ rows: `${b}..${b + 31}`, negShare: +(n / t).toFixed(5) });
}
console.log(`\nfield (${def.filename ?? def.name}, ${fw}x${fh}): countNeg(v<0)=${countNeg} ` +
  `countLE05(v<=0.5)=${countLE05}  bandNegShares: ${bands.map((x) => `${x.rows}:${x.negShare}`).join(" ")}`);

fs.mkdirSync(path.join(repoRoot, "mapgen/out"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "mapgen/out/dig178-classify-air-law.json"), JSON.stringify({
  meta: {
    dig: 178, seed: SEED, tileX: TX, canvasRows: ROWS, captureTiles: CAPTURE_TILES,
    laneEnv: "SURFACE_V3=1",
    laws: { air: "v < 0 (strictly) = the air stamp; [0, 0.5] = unmarked = the base fill; > 0.5 = the claim path (C153)" },
    repro: "SURFACE_V3=1 node mapgen/experiments/2026-10-20-dig178-classify-air-law.mjs",
  },
  gen, capture, field: { countNeg, countLE05, bands },
}, null, 2));
console.log("\nwrote mapgen/out/dig178-classify-air-law.json");
