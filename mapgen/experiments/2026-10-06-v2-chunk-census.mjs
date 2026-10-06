#!/usr/bin/env node
// Full-map SURFACE_V2 chunk census (dig #113 follow-up, 2026-10-06).
//
// WHY: the entry-(26) V2 full-map smoke ("computes 2194 chunks: winter 253,
// desert 265, pyramid 4, snowcastle 2 … ~48-51% solid density", ABOUT_MATH
// 2026-09-20 (26)) was an ad-hoc run with no in-repo instrument, and the
// dig-#113 default-arm port (ISSUES I20(2): addNoise=0 hills_flat /
// mountain_lake / laboratory no longer throws) changes which chunks compute
// instead of null-falling. This script is the reproducible census.
//
// Scope note (verified 2026-10-06): `2026-09-28-surface-census.mjs` — the
// script earlier handovers called "the V2 chunk census" — is a Ghidra
// call-graph region census (reads ~/work/ghidra-logs/p0_*.csv), NOT a
// rendering census. This file is the chunk/texture census.
//
// Buckets are keyed by biome FILENAME: many defs share a `name` attribute
// (hills.xml / solid_wall.xml / empty.xml … all carry name="_EMPTY_";
// measured 2026-10-06 on seed 78633191), so name-keyed rows hide biomes.
//
// Run:  SURFACE_V2=1 node mapgen/experiments/2026-10-06-v2-chunk-census.mjs
// (SURFACE_V2=1 required — the lane under measurement; without it every
// procedural chunk is honest air and the census is vacuous.)
//
// Definitions (mirrors lib/noise-terrain.mjs noiseChunkMask):
//   procedural chunk = biomeAt hit AND no templateFile (wang/static lanes)
//   COMPUTES         = noiseAt(tx,ty) returns {mask, def} (no fall-through)
//   falls-through    = null (surfaceField/noiseDispatch throw, V2 :237-241)
//   density          = solid cells / mask cells (52x52) — the (26) "solid density"
//   textured         = 0 < density < 1 (real texture vs all-air/all-solid)
//
// Fall reasons are DERIVED from the def (the V2 lane swallows the throw):
//   noise_type absent/not SIN_CAPPED -> noiseDispatch kind -1 throw
//     (VERIFIED §8 row 30)
//   kind 5 + addNoise ∉ {1,2,3}      -> surfaceField default-arm throw —
//     LIVE ONLY PRE-#113; post-#113 this lane computes (ISSUES I20 ②)
//   else                             -> UNKNOWN (flag it)

import { ensureWorld, SKY_ROWS } from "../lib/world-gen.mjs";
import { findNoitaDataDir, CAPTURE_SEED } from "../lib/paths.mjs";
import { biomeAt } from "../lib/biomes.mjs";

if (process.env.SURFACE_V2 !== "1") {
  console.error("refusing: SURFACE_V2=1 required (the lane under measurement)");
  process.exit(2);
}

const seed = CAPTURE_SEED;
const TX0 = 0, TX1 = 70;      // full canvas width (71 chunks)
const TY0 = 0, TY1 = 143;     // full canvas height (144 chunks)
const SMOKE_TY1 = 96;         // entry (25)/(26) smoke scope was ty 0..96

const world = ensureWorld(seed, findNoitaDataDir(), {});
await world.ready;

function fallReason(def) {
  if (def.noiseType !== "SIN_CAPPED_SIMPLEX") return "noiseDispatch kind -1 (no noise_type)";
  const a = Number(def.mGradientAddNoise ?? 1);
  if (![1, 2, 3].includes(a)) return "surfaceField default arm (I20, pre-#113 only)";
  return "UNKNOWN";
}

const buckets = new Map(); // file -> {proc, compute, fall, reasons, dens[], tex, air, solid}
function bucket(key) {
  let b = buckets.get(key);
  if (!b) buckets.set(key, (b = { proc: 0, compute: 0, fall: 0, reasons: {}, dens: [], tex: 0, air: 0, solid: 0 }));
  return b;
}
const fileOf = (def) => def.filename ?? def.name ?? "?";

let procTotal = 0, computeTotal = 0, fallTotal = 0;
let densSum = 0, texTotal = 0, airTotal = 0, solidTotal = 0;
let procSmoke = 0, computeSmoke = 0;
const unknowns = [];

for (let ty = TY0; ty <= TY1; ty++) {
  for (let tx = TX0; tx <= TX1; tx++) {
    const at = biomeAt(world.config, tx, ty - SKY_ROWS);
    if (!at || !at.biome || at.biome.templateFile) continue; // wang/static lane
    const b = bucket(fileOf(at.biome));
    b.proc++;
    procTotal++;
    const inSmoke = ty <= SMOKE_TY1;
    if (inSmoke) procSmoke++;
    const r = world.noiseAt(tx, ty);
    if (r) {
      let s = 0;
      for (let i = 0; i < r.mask.length; i++) s += r.mask[i];
      const d = s / r.mask.length;
      b.compute++;
      b.dens.push(d);
      computeTotal++;
      densSum += d;
      if (inSmoke) computeSmoke++;
      if (d === 0) { b.air++; airTotal++; }
      else if (d === 1) { b.solid++; solidTotal++; }
      else { b.tex++; texTotal++; }
    } else {
      b.fall++;
      fallTotal++;
      const why = fallReason(at.biome);
      b.reasons[why] = (b.reasons[why] ?? 0) + 1;
      if (why === "UNKNOWN") unknowns.push(`${fileOf(at.biome)} @${tx},${ty}`);
    }
  }
}

const f = (x, n = 4) => (Number.isFinite(x) ? x.toFixed(n) : "-");
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const allDens = [];
for (const b of buckets.values()) allDens.push(...b.dens);

console.log(`# V2 chunk census — seed ${seed}, SURFACE_V2=1, scope tx ${TX0}..${TX1} x ty ${TY0}..${TY1} (smoke scope ty <= ${SMOKE_TY1})`);
console.log(`# procedural (non-template) chunks: ${procTotal} | COMPUTES: ${computeTotal} | falls through: ${fallTotal}`);
console.log(`# density over computing chunks: mean ${f(mean(allDens))} | all-air ${airTotal} | textured ${texTotal} | all-solid ${solidTotal}`);
console.log(`# entry-(25)/(26) scope (ty <= ${SMOKE_TY1}): procedural ${procSmoke} | COMPUTES ${computeSmoke}  [baseline (26): 2194 @ ~48-51% density]`);
if (unknowns.length) console.log(`# !! UNKNOWN fall reasons (${unknowns.length}): ${unknowns.slice(0, 10).join(" | ")}`);
console.log("");
console.log("file                                          proc  compute  fall   density(mean)  air  tex  solid  fall-reasons");
for (const [key, b] of [...buckets.entries()].sort((a, z) => z.compute - a.compute || z.proc - a.proc)) {
  const reasons = Object.entries(b.reasons).map(([k, v]) => `${k}=${v}`).join(",");
  console.log(
    `${key.padEnd(43)} ${String(b.proc).padStart(4)} ${String(b.compute).padStart(7)} ${String(b.fall).padStart(5)}  ` +
    `${f(mean(b.dens)).padStart(12)}  ${String(b.air).padStart(3)} ${String(b.tex).padStart(4)} ${String(b.solid).padStart(5)}  ${reasons}`
  );
}
