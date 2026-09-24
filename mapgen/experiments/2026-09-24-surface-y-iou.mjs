// Dig #100 / Phase 5 step 2b — SURFACE-Y LINE IoU on P1 biomes vs the
// noitamap ref stitch (seed 78633191), L3 anchor (C78) applied at
// worldColorAt sampling. Metric spec = CONSTANTS.md::C79.
//
// Env gate (C79): SURFACE_V3=1 REQUIRED (the candidate lane whose
// default-ization Phase 5 gates), SURFACE_V2/PROC_FILL REFUSED so the
// measurement isolates exactly what step 3 would drop the gate from
// (noise-terrain.mjs:297 attach gate off ⇒ the classify chain at
// noise-terrain.mjs:241 runs).
//
// Outputs: mapgen/out/surface-y-2026-09-24.json + per-tile overlays
// mapgen/out/surface-y-2026-09-24/<tx>_<bty>_<label>.png
//   base = dim ref (solid 96 / air 16 gray), red = y_ref, green = y_gen,
//   yellow fill = |Δy| ≤ 3 px band, dark-red fill = gap > 3 px.
//
// Task-0 fit extension (additive; every C79 core field above unchanged):
// per-tile OLS fits Δy = a·x + b (fitX) and Δy = a·y_ref + b (fitDepth),
// plus nPairs-weighted aggregates — the offset-vs-scale signature
// partition (b shared across families ⇒ frame offset; a ≠ 0 ⇒ unit/tilt;
// family-local b with lake/ramp flat ⇒ shape). The per-cell L1 value log
// (the sibling instrument) = env SURFACE_LOG=<jsonl> in noise-terrain.mjs.

import fs from "node:fs";
import path from "node:path";

if (process.env.SURFACE_V3 !== "1") {
  console.error("refusing: SURFACE_V3=1 required (candidate-lane measurement, CONSTANTS.md::C79)");
  process.exit(2);
}
if (process.env.SURFACE_V2 || process.env.PROC_FILL) {
  console.error("refusing: SURFACE_V2/PROC_FILL set — isolate the V3 candidate (CONSTANTS.md::C79)");
  process.exit(2);
}

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { ensureWorld, worldColorAt, SKY_ROWS, CHUNK } = await import("../lib/world-gen.mjs");
const { readPng, writePng } = await import("../lib/images.mjs");
const { loadBiomeConfig } = await import("../lib/biomes.mjs");

// --- C79 metric constants --------------------------------------------------
const AIR_THRESHOLD = 24;   // lum < 24 = air (pipeline/3-compare.mjs:18, C78)
const RUN_MIN = 20;         // px solid run to count as a surface line
const SKY_TOP_ROWS = 8;     // ref sky-top check window
const SKY_TOP_MIN_AIR = 6;  // ≥6 of rows [0..7] air else column = no transition
const MIN_VALID_FRAC = 0.25;// tile scored iff y_ref on ≥25% of columns
const BANDS = [1, 2, 3];    // world px band hit-rates
const BTY_FROM = 6, BTY_TO = 15; // bty 16 = HM row excluded (C79)
const TX_FROM = 4, TX_TO = 58;
const P1 = /^(mountain|hills|desert|winter|lake)/;

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// --- P1 labels: first-wins _biomes_all.xml color -> filename basename ------
const dataDir = findNoitaDataDir();
const xml = fs.readFileSync(path.join(dataDir, "biome/_biomes_all.xml"), "utf-8");
const labelOf = new Map();
for (const m of xml.matchAll(/<Biome\b([^>]*)>/g)) {
  const f = /biome_filename="([^"]*)"/.exec(m[1])?.[1];
  const c = /color="([0-9a-fA-F]{8})"/.exec(m[1])?.[1];
  if (!f || !c) continue;
  const key = parseInt(c, 16) >>> 0;
  if (!labelOf.has(key)) labelOf.set(key, path.basename(f, ".xml"));
}
const rgbKey = (r, g, b) => ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;
const cfg = loadBiomeConfig(dataDir);
const labelAt = (tx, bty) => {
  const i = 4 * ((bty + cfg.V_OFF_Y) * cfg.vmap.width + tx);
  return labelOf.get(rgbKey(cfg.vmap.data[i], cfg.vmap.data[i + 1], cfg.vmap.data[i + 2])) ?? "unlabeled";
};

// --- line extraction (C79) -------------------------------------------------
// y_ref: sky top required (≥SKY_TOP_MIN_AIR air of rows [0..SKY_TOP_ROWS))
// then first solid run ≥ RUN_MIN → start; else null.
function refLine(col) {
  let air = 0;
  for (let y = 0; y < SKY_TOP_ROWS; y++) if (!col[y]) air++;
  if (air < SKY_TOP_MIN_AIR) return null;
  let run = 0, start = 0;
  for (let y = 0; y < 512; y++) {
    if (col[y]) {
      if (run === 0) start = y;
      if (++run >= RUN_MIN) return start;
    } else run = 0;
  }
  return null;
}
// y_gen: first solid run ≥ RUN_MIN, start ≥ 0 (flood signature y=0 kept).
function genLine(col) {
  let run = 0, start = 0;
  for (let y = 0; y < 512; y++) {
    if (col[y]) {
      if (run === 0) start = y;
      if (++run >= RUN_MIN) return start;
    } else run = 0;
  }
  return null;
}

// --- phase 1: ref census (no world load) ----------------------------------
const refDir = path.join(repoRoot, "mapgen/out/ref");
const scorable = [];
let p1Scanned = 0;
console.log(`# ref census: bty ${BTY_FROM}..${BTY_TO}, tx ${TX_FROM}..${TX_TO}, P1 labels, HM row excluded`);
for (let bty = BTY_FROM; bty <= BTY_TO; bty++) {
  for (let tx = TX_FROM; tx <= TX_TO; tx++) {
    const label = labelAt(tx, bty);
    if (!P1.test(label)) continue;
    p1Scanned++;
    const f = path.join(refDir, `${tx}_${bty}.png`);
    if (!fs.existsSync(f)) continue;
    const png = readPng(f);
    const refLines = new Int16Array(512).fill(-1);
    let n = 0;
    const col = new Uint8Array(512);
    for (let x = 0; x < 512; x++) {
      for (let y = 0; y < 512; y++) {
        const i = 4 * (y * 512 + x);
        col[y] = lum(png.data[i], png.data[i + 1], png.data[i + 2]) >= AIR_THRESHOLD ? 1 : 0;
      }
      const L = refLine(col);
      refLines[x] = L ?? -1;
      if (L != null) n++;
    }
    if (n / 512 >= MIN_VALID_FRAC) scorable.push({ tx, bty, label, ref: png, refLines, nRef: n });
  }
}
console.log(`# P1 tiles scanned: ${p1Scanned}, scorable (y_ref ≥25% cols): ${scorable.length}`);

// --- phase 2: gen lines + stats + overlays ---------------------------------
const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i");
const world = ensureWorld(CAPTURE_SEED, dataDir, { cacheDir });
await world.ready;

const outDir = path.join(repoRoot, "mapgen/out/surface-y-2026-09-24");
fs.mkdirSync(outDir, { recursive: true });

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
};
// OLS y = a·x + b over paired samples; null when the predictor is
// degenerate (< 2 points or zero variance). Rounded for the JSON only.
const ols = (xs, ys) => {
  const n = xs.length;
  if (n < 2) return null;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    sxy += dx * (ys[i] - my); sxx += dx * dx;
  }
  if (sxx < 1e-9) return null;
  const a = sxy / sxx;
  return { a: +a.toFixed(5), b: +(my - a * mx).toFixed(3) };
};
const stats = [];
const colGen = new Uint8Array(512);
const genSolid = new Uint8Array(512 * 512);

console.log(`label              tile      nPairs meanAbs  med bias    ±1    ±2    ±3  genNo topAir`);
for (const s of scorable) {
  const { tx, bty, label, ref, refLines } = s;
  // gen solidity for this tile (L3_ANCHOR C78 applies inside worldColorAt)
  let topAirPx = 0;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const col0 = worldColorAt(world, tx * CHUNK + x, (bty + SKY_ROWS) * CHUNK + y);
      const solid = col0 ? lum(col0[0], col0[1], col0[2]) >= AIR_THRESHOLD : false;
      genSolid[y * 512 + x] = solid ? 1 : 0;
      if (y < SKY_TOP_ROWS && !solid) topAirPx++;
    }
  }
  const topAirFrac = topAirPx / (SKY_TOP_ROWS * 512);
  // pairs + metrics
  let nPairs = 0, genNoLine = 0, sumAbs = 0, sumD = 0;
  const absList = [];
  const genLines = new Int16Array(512).fill(-1);
  const fitXs = [], fitDs = [], fitRefs = []; // paired Δy samples for the fits
  for (let x = 0; x < 512; x++) {
    if (refLines[x] < 0) continue;
    for (let y = 0; y < 512; y++) { colGen[y] = genSolid[y * 512 + x]; }
    const g = genLine(colGen);
    genLines[x] = g ?? -1;
    if (g == null) { genNoLine++; continue; }
    const d = g - refLines[x];
    nPairs++; sumAbs += Math.abs(d); sumD += d; absList.push(Math.abs(d));
    fitXs.push(x); fitDs.push(d); fitRefs.push(refLines[x]);
  }
  const bandFrac = {};
  for (const b of BANDS) bandFrac[b] = nPairs ? absList.filter((v) => v <= b).length / nPairs : null;
  const st = {
    label, tx, bty, nRef: s.nRef, nPairs, genNoLine,
    fracRef: +(s.nRef / 512).toFixed(3),
    meanAbs: nPairs ? +(sumAbs / nPairs).toFixed(2) : null,
    medAbs: nPairs ? median(absList) : null,
    bias: nPairs ? +(sumD / nPairs).toFixed(2) : null,
    band: Object.fromEntries(BANDS.map((b) => [b, bandFrac[b] != null ? +bandFrac[b].toFixed(3) : null])),
    genTopAir: +topAirFrac.toFixed(3),
    fitX: ols(fitXs, fitDs),        // Δy = a·x + b  (tilt/unit vs const offset)
    fitDepth: ols(fitRefs, fitDs),  // Δy = a·y_ref + b (depth/ramp-window shape)
  };
  stats.push(st);

  // overlay
  const rgba = Buffer.alloc(512 * 512 * 4);
  for (let i = 0; i < 512 * 512; i++) {
    const solidRef = lum(ref.data[4 * i], ref.data[4 * i + 1], ref.data[4 * i + 2]) >= AIR_THRESHOLD;
    const g0 = solidRef ? 96 : 16;
    rgba[4 * i] = g0; rgba[4 * i + 1] = g0; rgba[4 * i + 2] = g0; rgba[4 * i + 3] = 255;
  }
  for (let x = 0; x < 512; x++) {
    const yr = refLines[x], yg = genLines[x];
    if (yr >= 0 && yg >= 0) {
      const lo = Math.min(yr, yg), hi = Math.max(yr, yg);
      const close = Math.abs(yg - yr) <= BANDS[BANDS.length - 1];
      for (let y = lo; y <= hi; y++) {
        const i = 4 * (y * 512 + x);
        if (close) { rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 0; }
        else { rgba[i] = 72; rgba[i + 1] = 0; rgba[i + 2] = 0; }
      }
    }
    if (yg >= 0) { const i = 4 * (yg * 512 + x); rgba[i] = 0; rgba[i + 1] = 255; rgba[i + 2] = 0; }
    if (yr >= 0) { const i = 4 * (yr * 512 + x); rgba[i] = 255; rgba[i + 1] = 0; rgba[i + 2] = 0; }
  }
  writePng(path.join(outDir, `${tx}_${bty}_${label}.png`), 512, 512, rgba);

  const f = (v, w) => v == null ? "-".padStart(w) : String(v).padStart(w);
  console.log(
    `${label.padEnd(18)} ${String(tx).padStart(3)}_${String(bty).padEnd(3)}` +
    `${f(st.nPairs, 7)} ${f(st.meanAbs, 7)} ${f(st.medAbs, 5)} ${f(st.bias, 6)}` +
    `${f(st.band[1], 6)} ${f(st.band[2], 6)} ${f(st.band[3], 6)}` +
    `${f(st.genNoLine, 6)} ${f(st.genTopAir, 7)}`
  );
}

// --- aggregates -------------------------------------------------------------
// nPairs-weighted mean of a per-tile OLS fit (tiles without a fit skip)
const fitAgg = (list, key) => {
  const ts = list.filter((s) => s[key] && s.nPairs > 0);
  const n = ts.reduce((p, s) => p + s.nPairs, 0);
  if (!n) return null;
  return {
    a: +(ts.reduce((p, s) => p + s[key].a * s.nPairs, 0) / n).toFixed(5),
    b: +(ts.reduce((p, s) => p + s[key].b * s.nPairs, 0) / n).toFixed(3),
  };
};
const agg = (list) => {
  const withPairs = list.filter((s) => s.nPairs > 0);
  const nAll = list.reduce((a, s) => a + s.nPairs, 0);
  const wmean = (key) => nAll ? list.reduce((a, s) => a + (s[key] ?? 0) * s.nPairs, 0) / nAll : null;
  return {
    tiles: list.length, tilesWithPairs: withPairs.length, nPairs: nAll,
    genNoLine: list.reduce((a, s) => a + s.genNoLine, 0),
    meanAbs: nAll ? +wmean("meanAbs").toFixed(2) : null,
    bias: nAll ? +wmean("bias").toFixed(2) : null,
    band: Object.fromEntries(BANDS.map((b) => [
      b,
      nAll ? +(list.reduce((a, s) => a + (s.band[b] ?? 0) * s.nPairs, 0) / nAll).toFixed(3) : null,
    ])),
    genTopAir: list.length ? +(list.reduce((a, s) => a + s.genTopAir, 0) / list.length).toFixed(3) : null,
    fitX: fitAgg(list, "fitX"),
    fitDepth: fitAgg(list, "fitDepth"),
  };
};
const byFamily = {};
for (const s of stats) {
  const fam = /^(mountain|hills|desert|winter|lake)/.exec(s.label)[1];
  (byFamily[fam] ??= []).push(s);
}
const byRow = {};
for (const s of stats) (byRow[s.bty] ??= []).push(s);

const summary = {
  spec: "CONSTANTS.md::C79", instrument: "2026-09-24-surface-y-iou.mjs",
  env: { SURFACE_V3: "1", SURFACE_V2: null, PROC_FILL: null },
  seed: CAPTURE_SEED, refDir: "mapgen/out/ref", anchor: "+11 +12 world px (C78)",
  p1Scanned, scorableTiles: scorable.length,
  overall: agg(stats),
  byFamily: Object.fromEntries(Object.entries(byFamily).map(([k, v]) => [k, agg(v)])),
  byRow: Object.fromEntries(Object.entries(byRow).map(([k, v]) => [k, agg(v)])),
  tiles: stats,
};
fs.writeFileSync(path.join(repoRoot, "mapgen/out/surface-y-2026-09-24.json"), JSON.stringify(summary, null, 1));

console.log("\n# aggregates");
const fitStr = (a) =>
  a.fitX || a.fitDepth
    ? ` fitX(a=${a.fitX?.a ?? "-"},b=${a.fitX?.b ?? "-"}) fitDepth(a=${a.fitDepth?.a ?? "-"},b=${a.fitDepth?.b ?? "-"})`
    : "";
const show = (name, a) =>
  console.log(`${name.padEnd(10)} tiles ${String(a.tiles).padStart(3)} (pairs ${String(a.tilesWithPairs).padStart(3)}) n=${String(a.nPairs).padStart(6)} meanAbs=${String(a.meanAbs).padStart(7)} bias=${String(a.bias).padStart(8)} ±1=${String(a.band[1]).padStart(6)} ±2=${String(a.band[2]).padStart(6)} ±3=${String(a.band[3]).padStart(6)} genNoLine=${String(a.genNoLine).padStart(5)} topAir=${a.genTopAir}${fitStr(a)}`);
show("overall", summary.overall);
for (const [k, v] of Object.entries(summary.byFamily)) show(k, v);
for (const [k, v] of Object.entries(summary.byRow)) show(`bty${k}`, v);
console.log(`\n# json -> mapgen/out/surface-y-2026-09-24.json\n# overlays -> ${outDir}`);
