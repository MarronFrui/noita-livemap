// Dig #118 / I23③ — SURFACE SHAPE (2-D solid-mask) IoU: the noise lanes
// vs the noitamap ref stitch (seed 78633191). Metric spec = CONSTANTS.md::C97.
//
// Why this exists (I23③): C79's IoU (2026-09-24-surface-y-iou.mjs) is a
// LINE metric — first solid run ≥ RUN_MIN per column — and its gate
// REFUSES SURFACE_V2; the shape gate 2026-09-21-surface-shape.mjs reaches
// only wang/template bands (procedural 0 / v2masks 0) ⇒ before this file
// nothing measured what the noise lanes actually RENDER. This instrument
// judges the full 512×512 solid mask: iou, the cavity-curve distance
// (profL1), and the registration-vs-interior partition (dyOpt/iouShift).
//
// Lane gate (C97; the INVERSE of C79): any combo of SURFACE_V2/SURFACE_V3
// is accepted and recorded — neither flag means the noise branch never
// attaches (noise-terrain.mjs:383) ⇒ all-air masks ⇒ refuse. PROC_FILL
// refused (template-band lane; C79 parity). One lane per process: the
// flags are module-load-time consts (noise-terrain.mjs:96-97) and the V2
// block early-returns before the V3 classify chain (:219) with its
// caves-field gradAt gated on the SURFACE_V3 conjunct (:231) — see C97.
//
// Outputs: mapgen/out/surface-shape-2026-10-10-<lane>.json + overlays
// mapgen/out/surface-shape-2026-10-10-<lane>/<tx>_<bty>_<label>.png
//   panel1 = ref, panel2 = gen (solid 96 / air 16 gray), panel3 = diff
//   (yellow = both solid, red = ref-only = miss, green = gen-only =
//   hallucination, dark = neither air) — best + worst tile per family.

import fs from "node:fs";
import path from "node:path";

// --- lane gate (C97) -------------------------------------------------------
const LANE_V2 = process.env.SURFACE_V2 === "1";
const LANE_V3 = process.env.SURFACE_V3 === "1";
if (!LANE_V2 && !LANE_V3) {
  console.error("refusing: SURFACE_V2=1 and/or SURFACE_V3=1 required — neither attaches the noise branch (noise-terrain.mjs:383, CONSTANTS.md::C97)");
  process.exit(2);
}
if (process.env.PROC_FILL) {
  console.error("refusing: PROC_FILL set — the template-band lane must stay at its default (C79 parity, CONSTANTS.md::C97)");
  process.exit(2);
}
const LANE = LANE_V2 && LANE_V3 ? "v2v3" : LANE_V2 ? "v2" : "v3";

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { ensureWorld, worldColorAt, SKY_ROWS, CHUNK } = await import("../lib/world-gen.mjs");
const { readPng, writePng } = await import("../lib/images.mjs");
const { loadBiomeConfig } = await import("../lib/biomes.mjs");

// --- C79 constants reused verbatim (C97: identical tile set) ---------------
const AIR_THRESHOLD = 24;   // lum < 24 = air (pipeline/3-compare.mjs:18, C78)
const RUN_MIN = 20;         // px solid run to count as a surface line (filter only)
const SKY_TOP_ROWS = 8;     // ref sky-top check window
const SKY_TOP_MIN_AIR = 6;  // ≥6 of rows [0..7] air else column = no transition
const MIN_VALID_FRAC = 0.25;// tile scored iff y_ref on ≥25% of columns
const BTY_FROM = 6, BTY_TO = 15; // bty 16 = HM row excluded (C79)
const TX_FROM = 4, TX_TO = 58;
const P1 = /^(mountain|hills|desert|winter|lake)/;
const DY_MAX = 256;         // dyOpt search half-range (C97)
const N = 512 * 512;

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

// --- C79 refLine (census filter only; line metrics stay C79's job) ---------
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

// --- phase 1: ref census + ref masks (no world load) -----------------------
const refDir = path.join(repoRoot, "mapgen/out/ref");
const scorable = [];
let p1Scanned = 0;
console.log(`# lane=${LANE}  ref census: bty ${BTY_FROM}..${BTY_TO}, tx ${TX_FROM}..${TX_TO}, P1 labels, HM row excluded`);
for (let bty = BTY_FROM; bty <= BTY_TO; bty++) {
  for (let tx = TX_FROM; tx <= TX_TO; tx++) {
    const label = labelAt(tx, bty);
    if (!P1.test(label)) continue;
    p1Scanned++;
    const f = path.join(refDir, `${tx}_${bty}.png`);
    if (!fs.existsSync(f)) continue;
    const png = readPng(f);
    const R = new Uint8Array(N);
    const rcR = new Uint16Array(512);
    for (let y = 0; y < 512; y++) {
      let cnt = 0;
      for (let x = 0; x < 512; x++) {
        const i = 4 * (y * 512 + x);
        const s = lum(png.data[i], png.data[i + 1], png.data[i + 2]) >= AIR_THRESHOLD ? 1 : 0;
        R[y * 512 + x] = s;
        cnt += s;
      }
      rcR[y] = cnt;
    }
    // column pass for the C79 filter (column-major, as C79 did)
    const col = new Uint8Array(512);
    let n = 0;
    for (let x = 0; x < 512; x++) {
      for (let y = 0; y < 512; y++) col[y] = R[y * 512 + x];
      if (refLine(col) != null) n++;
    }
    if (n / 512 >= MIN_VALID_FRAC) scorable.push({ tx, bty, label, R, rcR, nRef: n });
  }
}
console.log(`# P1 tiles scanned: ${p1Scanned}, scorable (y_ref ≥25% cols): ${scorable.length}`);

// --- C79 tile-set cross-check (C97) ----------------------------------------
let c79Check = null;
const c79Json = path.join(repoRoot, "mapgen/out/surface-y-2026-09-24.json");
if (fs.existsSync(c79Json)) {
  const j = JSON.parse(fs.readFileSync(c79Json, "utf8"));
  const want = new Set((j.tiles ?? []).map((t) => `${t.tx}_${t.bty}_${t.label}`));
  const got = new Set(scorable.map((s) => `${s.tx}_${s.bty}_${s.label}`));
  const missing = [...want].filter((k) => !got.has(k));
  const extra = [...got].filter((k) => !want.has(k));
  c79Check = { c79Scorable: j.scorableTiles, thisRun: scorable.length, missing, extra, match: !missing.length && !extra.length };
  if (!c79Check.match) console.warn(`# WARN: tile set diverged from C79 (missing ${missing.length}, extra ${extra.length}) — see JSON c79Check`);
  else console.log(`# tile set matches C79 exactly (${scorable.length} tiles)`);
}

// --- phase 2: gen masks + per-tile shape metrics ---------------------------
const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i");
const world = ensureWorld(CAPTURE_SEED, dataDir, { cacheDir });
await world.ready;

const outDir = path.join(repoRoot, `mapgen/out/surface-shape-2026-10-10-${LANE}`);
fs.mkdirSync(outDir, { recursive: true });

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
};
const r5 = (v) => v == null ? null : +v.toFixed(5);

console.log(`label              tile      iou  iouSh  dyOpt  profL1     fR     fG    b0    b1    b2    b3`);
for (const s of scorable) {
  const { tx, bty, label, R, rcR } = s;
  // gen solidity for this tile (L3_ANCHOR C78 applies inside worldColorAt)
  const G = new Uint8Array(N);
  const rcG = new Uint16Array(512);
  for (let y = 0; y < 512; y++) {
    let cnt = 0;
    for (let x = 0; x < 512; x++) {
      const col0 = worldColorAt(world, tx * CHUNK + x, (bty + SKY_ROWS) * CHUNK + y);
      const solid = col0 ? lum(col0[0], col0[1], col0[2]) >= AIR_THRESHOLD : 0;
      G[y * 512 + x] = solid;
      cnt += solid;
    }
    rcG[y] = cnt;
  }
  // (a) raw iou over solid cells, (e) fractions, (d) per-quarter bands
  let inter = 0, uni = 0, sumR = 0, sumG = 0;
  const bandInter = [0, 0, 0, 0], bandUni = [0, 0, 0, 0];
  for (let y = 0; y < 512; y++) {
    const b = y >> 7; // 0..3 row quarters
    for (let x = 0; x < 512; x++) {
      const i = y * 512 + x;
      const r = R[i], g = G[i];
      sumR += r; sumG += g;
      if (r & g) { inter++; bandInter[b]++; }
      if (r | g) { uni++; bandUni[b]++; }
    }
  }
  const iou = uni > 0 ? inter / uni : null;
  const fR = sumR / N, fG = sumG / N;
  // (b) cavity-curve distance
  let profL1num = 0;
  for (let y = 0; y < 512; y++) {
    const d = rcR[y] - rcG[y];
    profL1num += d < 0 ? -d : d;
  }
  const profL1 = profL1num / N;
  // (c) dyOpt: argmin profile L1, ties prefer smaller |dy| (scan 0,±1,…)
  const cost = (dy) => {
    let c = 0;
    for (let y = 0; y < 512; y++) {
      const gy = y + dy;
      const gv = gy >= 0 && gy < 512 ? rcG[gy] : 0;
      const d = gv - rcR[y];
      c += d < 0 ? -d : d;
    }
    return c;
  };
  let dyOpt = 0, bestCost = cost(0);
  for (let k = 1; k <= DY_MAX; k++) {
    for (const dy of [-k, k]) {
      const c = cost(dy);
      if (c < bestCost) { bestCost = c; dyOpt = dy; }
    }
  }
  // iouShift: G shifted by dyOpt (gen row y+dyOpt ↔ ref row y; OOR = empty)
  let interS = 0, uniS = 0;
  for (let y = 0; y < 512; y++) {
    const gy = y + dyOpt;
    if (gy < 0 || gy >= 512) { uniS += rcR[y]; continue; }
    for (let x = 0; x < 512; x++) {
      const r = R[y * 512 + x], g = G[gy * 512 + x];
      if (r & g) interS++;
      if (r | g) uniS++;
    }
  }
  const iouShift = uniS > 0 ? interS / uniS : null;
  s.G = G;       // retained for overlays + band/profile aggregates
  s.rcG = rcG;
  s.bandRaw = bandInter.map((i, b) => ({ i, u: bandUni[b] }));
  s.st = {
    label, tx, bty, nRef: s.nRef,
    iou: r5(iou), iouShift: r5(iouShift), dyOpt,
    profL1: r5(profL1), fR: r5(fR), fG: r5(fG),
    band: Object.fromEntries([0, 1, 2, 3].map((b) => [`b${b}`, r5(bandUni[b] ? bandInter[b] / bandUni[b] : null)])),
    inter, uni, interS, uniS,
  };
  const st = s.st;
  const f = (v, w) => v == null ? "-".padStart(w) : String(v).padStart(w);
  console.log(
    `${label.padEnd(18)} ${String(tx).padStart(3)}_${String(bty).padEnd(3)}` +
    `${f(st.iou, 8)} ${f(st.iouShift, 7)} ${f(st.dyOpt, 6)} ${f(st.profL1, 7)}` +
    `${f(st.fR, 7)} ${f(st.fG, 7)} ${f(st.band.b0, 6)} ${f(st.band.b1, 6)} ${f(st.band.b2, 6)} ${f(st.band.b3, 6)}`
  );
}
const stats = scorable.map((s) => s.st);

// --- aggregates (C97) ------------------------------------------------------
const r5v = r5;
const pw = (list, ik, uk) => {
  const i = list.reduce((a, s) => a + s[ik], 0);
  const u = list.reduce((a, s) => a + s[uk], 0);
  return u > 0 ? r5v(i / u) : null;
};
const mean = (list, f) => list.length ? r5v(list.reduce((a, s) => a + f(s), 0) / list.length) : null;
const aggBands = (list) => {
  const out = {};
  for (let b = 0; b < 4; b++) {
    const i = list.reduce((a, s) => a + s.bandRaw[b].i, 0);
    const u = list.reduce((a, s) => a + s.bandRaw[b].u, 0);
    out[`b${b}`] = u > 0 ? r5v(i / u) : null;
  }
  return out;
};
// list elements are STATS (st) — band raw lives on the parent tile, so
// aggregates take tile objects and read .st where needed
const aggTiles = (tiles) => {
  const list = tiles.map((t) => t.st);
  return {
    tiles: tiles.length,
    iou: pw(list, "inter", "uni"),
    iouShift: pw(list, "interS", "uniS"),
    band: aggBands(tiles),
    profL1: mean(list, (s) => s.profL1),
    fR: mean(list, (s) => s.fR),
    fG: mean(list, (s) => s.fG),
    dyOptMean: mean(list, (s) => s.dyOpt),
    dyOptMed: median(list.map((s) => s.dyOpt)),
  };
};

const byFamily = {};
for (const s of scorable) (byFamily[P1.exec(s.label)[1]] ??= []).push(s);
const byRow = {};
for (const s of scorable) (byRow[s.bty] ??= []).push(s);

// --- row profiles (C97: overall ref/gen/genAligned @3dp, byFamily ref/gen) --
const acc3 = (arr, n) => Array.from(arr, (v) => +(v / n).toFixed(3)); // Array.from: typed-array .map keeps the typed type → JSON would emit an object
const pR = new Float64Array(512), pG = new Float64Array(512), pGA = new Float64Array(512);
const famPR = {}, famPG = {};
for (const s of scorable) {
  const fam = P1.exec(s.label)[1];
  (famPR[fam] ??= new Float64Array(512));
  (famPG[fam] ??= new Float64Array(512));
  for (let y = 0; y < 512; y++) {
    pR[y] += s.rcR[y] / 512;
    pG[y] += s.rcG[y] / 512;
    const gy = y + s.st.dyOpt;
    pGA[y] += gy >= 0 && gy < 512 ? s.rcG[gy] / 512 : 0;
    famPR[fam][y] += s.rcR[y] / 512;
    famPG[fam][y] += s.rcG[y] / 512;
  }
}
const nT = scorable.length;

// --- overlays: best + worst tile per family by iou -------------------------
const writeOverlay = (s) => {
  const { R, G, tx, bty, label } = s;
  const rgba = Buffer.alloc(1536 * 512 * 4);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = y * 512 + x;
      const r = R[i], g = G[i];
      // panel1: ref
      let o = 4 * (y * 1536 + x);
      let v = r ? 96 : 16;
      rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255;
      // panel2: gen
      o = 4 * (y * 1536 + 512 + x);
      v = g ? 96 : 16;
      rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255;
      // panel3: diff
      o = 4 * (y * 1536 + 1024 + x);
      if (r && g) { rgba[o] = 255; rgba[o + 1] = 255; rgba[o + 2] = 0; }        // both
      else if (r) { rgba[o] = 255; rgba[o + 1] = 0; rgba[o + 2] = 0; }          // ref-only = miss
      else if (g) { rgba[o] = 0; rgba[o + 1] = 255; rgba[o + 2] = 0; }          // gen-only = hallucination
      else { rgba[o] = 16; rgba[o + 1] = 16; rgba[o + 2] = 16; }                // neither
      rgba[o + 3] = 255;
    }
  }
  writePng(path.join(outDir, `${tx}_${bty}_${label}.png`), 1536, 512, rgba);
};
const overlays = [];
for (const [fam, tiles] of Object.entries(byFamily)) {
  const sorted = [...tiles].sort((a, b) => (b.st.iou ?? -1) - (a.st.iou ?? -1));
  const picks = [sorted[0], sorted[sorted.length - 1]];
  for (const s of picks) {
    writeOverlay(s);
    overlays.push(`${s.tx}_${s.bty}_${s.label} (iou ${s.st.iou})`);
  }
}

// --- JSON + console summary -------------------------------------------------
const summary = {
  spec: "CONSTANTS.md::C97", instrument: "2026-10-10-surface-shape-iou.mjs",
  env: { SURFACE_V2: LANE_V2 ? "1" : null, SURFACE_V3: LANE_V3 ? "1" : null, PROC_FILL: null },
  lane: LANE,
  seed: CAPTURE_SEED, refDir: "mapgen/out/ref", anchor: "+11 +12 world px (C78)",
  p1Scanned, scorableTiles: scorable.length, c79Check,
  overall: aggTiles(scorable),
  byFamily: Object.fromEntries(Object.entries(byFamily).map(([k, v]) => [k, aggTiles(v)])),
  byRow: Object.fromEntries(Object.entries(byRow).map(([k, v]) => [k, aggTiles(v)])),
  profiles: {
    ref: acc3(pR, nT), gen: acc3(pG, nT), genAligned: acc3(pGA, nT),
    byFamily: Object.fromEntries(Object.entries(famPR).map(([k, v]) => [k, { ref: acc3(v, byFamily[k].length), gen: acc3(famPG[k], byFamily[k].length) }])),
  },
  overlays,
  tiles: stats,
};
const jsonPath = path.join(repoRoot, `mapgen/out/surface-shape-2026-10-10-${LANE}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 1));

console.log(`\n# aggregates (lane ${LANE})`);
const show = (name, a) =>
  console.log(`${name.padEnd(10)} tiles ${String(a.tiles).padStart(3)} iou=${String(a.iou).padStart(7)} iouShift=${String(a.iouShift).padStart(7)} dyOpt=${String(a.dyOptMean).padStart(7)} (med ${String(a.dyOptMed).padStart(4)}) profL1=${String(a.profL1).padStart(7)} fR=${String(a.fR).padStart(6)} fG=${String(a.fG).padStart(6)} b0..b3=${a.band.b0}/${a.band.b1}/${a.band.b2}/${a.band.b3}`);
show("overall", summary.overall);
for (const [k, v] of Object.entries(summary.byFamily)) show(k, v);
for (const [k, v] of Object.entries(summary.byRow)) show(`bty${k}`, v);
console.log(`\n# json -> ${jsonPath}\n# overlays -> ${outDir}`);
