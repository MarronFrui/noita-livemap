// 2026-09-24-l3-anchor-fit.mjs — L3 anchor fit (Phase 5 step 2, dig #99).
//
// Goal (SESSION_CONTEXT.md:340-343): fit the gen→capture registration offset
// from mapcap foreground STRUCTURE so the wall-hug marker offset can be fixed
// by one rule in world-gen's sampling. Decision = constant-vs-sawtooth per
// the §4 constant-offset principle (VERIFIED.md:208 — a constant is only
// valid if the drift it corrects is zero or sawtooth-shaped; any linear
// component makes a constant wrong far from where it was measured).
//
// Why not plain solid IoU: a smoke test this session showed solid masks
// SATURATE at zero shift on deep chunks (refSolid ≈ 1.0 — both sides ~all
// "solid" under a non-black rule: capture cave backgrounds render as dark
// material ~ (13,14,18), not black; our air cells colorize to the same
// capture-calibrated airDark (colorize.mjs:52)). No discriminating signal.
// This instrument therefore scores three STRUCTURE-SENSITIVE metrics:
//   air  — IoU of air masks (lum < AIR_THRESHOLD = 24, the pipeline constant
//          at mapgen/pipeline/3-compare.mjs:18; rock ≈ (70,65,40) lum ≈ 64).
//   edge — IoU of strong-luminance-step masks (central-diff |gx|+|gy| ≥ 30):
//          boundary agreement; peak is sharper than region overlap.
//   lum  — zero-mean NCC of the raw luminance fields (parameter-free,
//          brightness-affine tolerant; independent cross-check).
// Plus 1-D column/row air-fraction profile NCC (dx/dy decoupled, cheap).
//
// Frame (verified in experiments/2026-09-21-surface-shape.mjs:66 this
// session): ref = mapgen/out/ref/<tx>_<bty>.png (biome coords, 512×512);
// gen = worldColorAt(world, tx*512+x, (bty+SKY_ROWS)*512+y), SKY_ROWS=48
// (world-gen.mjs:20). Default render only — SURFACE_V2/V3/PROC_FILL lanes
// are env-gated and MUST stay off (this script refuses to run with them on).
//
// Scan range: certified spawn-constraint bound x∈[−1..3], y∈[0..2] ATLAS px
// (VERIFIED.md:1083; 1 atlas px = 10 world px ⇒ x∈[−10..30], y∈[0..20] world
// px) with ±5 px margin: dx ∈ [−15..35], dy ∈ [−5..25] world px, step 1.
// Two stages: coarse (spatial stride 4) over the full range, then full-
// resolution refinement (±6 px) around the top-3 distinct coarse peaks.
//
// Sign convention: score(dx,dy) compares ref(x,y) with gen(x+dx, y+dy).
// A peak at (DX,DY) means gen features sit (DX,DY) right/down of their true
// position ⇒ the sampling correction reads gen at world+(DX,DY), i.e.
// output(x) := gen(x+DX) = ref(x).
//
// Output: per-chunk table + per-axis constant/linear/sawtooth model RMSEs
// (sawtooth phase = (512·coord) mod 10 lattice phase — 512 ≡ 2 (mod 10),
// so phase cycles {0,2,4,6,8} with period 5 chunks) + JSON at
// mapgen/out/l3-anchor-2026-09-24.json.
//
// Usage: node mapgen/experiments/2026-09-24-l3-anchor-fit.mjs [--limit N]

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, repoRoot, CAPTURE_SEED } from "../lib/paths.mjs";
import {
  ensureWorld,
  worldColorAt,
  SKY_ROWS,
  WORLD_CHUNKS_W,
} from "../lib/world-gen.mjs";
import { readPng } from "../lib/images.mjs";

function arg(name, fb) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fb : process.argv[i + 1];
}
const LIMIT = Number(arg("limit", 0)); // 0 = all enumerated chunks

// env-gate guard: measure the DEFAULT render only (AGENTS/ABOUT_MATH (52))
for (const k of ["SURFACE_V2", "SURFACE_V3", "PROC_FILL"]) {
  if (process.env[k]) {
    console.error(`refusing: ${k}=1 — the anchor fit must measure the default render`);
    process.exit(2);
  }
}

const AIR_THRESHOLD = 24; // CONSTANTS/pipeline: mapgen/pipeline/3-compare.mjs:18
const EDGE_THRESHOLD = 30; // strong-step detector on summed central diffs
const DX0 = -15, DX1 = 35, DY0 = -5, DY1 = 25; // world px, ±5 margin on the certified bound
const COARSE_STRIDE = 4;
const FINE_PAD = 6;
const TOPK = 3;
// candidate constant corrections (world px) scored full-res per chunk after the
// scan: medians from the three metrics + the certified-bound center (1,1) atlas
// = (10,10) world, a sign control (−11,−12) and axis-only controls.
const CANDS = [
  [0, 0], [10, 10], [11, 12], [12, 12], [6, 11], [11, 14],
  [-11, -12], [11, 0], [0, 12],
];
const TX0 = 29, TX1 = 47; // capture window (ref stitch)
const ROWS = [14, 15, 17, 18]; // wang rows in the window; 16/19 = HM — excluded from scoring (mapcap/PREDICTABLE_ZONES.md)
const N = 512 * 512;

const lum = (r, g, b) => Math.round(0.299 * r + 0.587 * g + 0.114 * b);

// --- mask builders -----------------------------------------------------------
function edgeMask(L, valid) {
  // central diff |gx|+|gy| ≥ EDGE_THRESHOLD; gen side needs all 5 px valid
  const e = new Uint8Array(N);
  for (let y = 1; y < 511; y++) {
    for (let x = 1; x < 511; x++) {
      const i = y * 512 + x;
      if (valid && !(valid[i] && valid[i - 1] && valid[i + 1] && valid[i - 512] && valid[i + 512])) continue;
      const gx = Math.abs(L[i + 1] - L[i - 1]);
      const gy = Math.abs(L[i + 512] - L[i - 512]);
      if (gx + gy >= EDGE_THRESHOLD) e[i] = 1;
    }
  }
  return e;
}

// --- scoring -----------------------------------------------------------------
// IoU of mask A (ref) vs mask B (gen sampled at x+dx,y+dy), skipping pixels
// where gen is invalid (unrendered). stride > 1 = coarse spatial subsample.
function iouShift(A, B, valid, dx, dy, stride) {
  let inter = 0, na = 0, nb = 0;
  for (let y = 0; y < 512; y += stride) {
    const ys = y + dy;
    if (ys < 0 || ys >= 512) continue;
    for (let x = 0; x < 512; x += stride) {
      const xs = x + dx;
      if (xs < 0 || xs >= 512) continue;
      const j = ys * 512 + xs;
      if (valid && !valid[j]) continue;
      const a = A[y * 512 + x], b = B[j];
      if (a) na++;
      if (b) nb++;
      if (a && b) inter++;
    }
  }
  const uni = na + nb - inter;
  return uni ? inter / uni : 0;
}

// zero-mean NCC of luminance fields (Uint8) over the same shifted window
function nccShift(R, G, valid, dx, dy, stride) {
  let n = 0, sr = 0, sg = 0, srr = 0, sgg = 0, srg = 0;
  for (let y = 0; y < 512; y += stride) {
    const ys = y + dy;
    if (ys < 0 || ys >= 512) continue;
    for (let x = 0; x < 512; x += stride) {
      const xs = x + dx;
      if (xs < 0 || xs >= 512) continue;
      const j = ys * 512 + xs;
      if (valid && !valid[j]) continue;
      const r = R[y * 512 + x], g = G[j];
      n++; sr += r; sg += g; srr += r * r; sgg += g * g; srg += r * g;
    }
  }
  if (n < 1000) return 0;
  const num = n * srg - sr * sg;
  const den = Math.sqrt((n * srr - sr * sr) * (n * sgg - sg * sg));
  return den > 0 ? num / den : 0;
}

const METRICS = [
  { name: "air", fn: iouShift },
  { name: "edge", fn: iouShift },
  { name: "lum", fn: nccShift },
];

// coarse (stride 4) over the full range → top-K distinct peaks → full-res
// refinement around each; returns best + zero score + coarse landscape stats.
function scan(fn, A, B, valid) {
  const cand = [];
  let n = 0, sum = 0, sum2 = 0;
  for (let dy = DY0; dy <= DY1; dy++) {
    for (let dx = DX0; dx <= DX1; dx++) {
      const s = fn(A, B, valid, dx, dy, COARSE_STRIDE);
      cand.push({ dx, dy, s });
      n++; sum += s; sum2 += s * s;
    }
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  cand.sort((p, q) => q.s - p.s);
  const peaks = [];
  for (const c of cand) {
    if (peaks.length >= TOPK) break;
    if (peaks.every((p) => Math.abs(p.dx - c.dx) >= 5 && Math.abs(p.dy - c.dy) >= 5)) peaks.push(c);
  }
  let best = { dx: 0, dy: 0, s: -Infinity };
  for (const p of peaks) {
    for (let dy = Math.max(DY0, p.dy - FINE_PAD); dy <= Math.min(DY1, p.dy + FINE_PAD); dy++) {
      for (let dx = Math.max(DX0, p.dx - FINE_PAD); dx <= Math.min(DX1, p.dx + FINE_PAD); dx++) {
        const s = fn(A, B, valid, dx, dy, 1);
        if (s > best.s) best = { dx, dy, s };
      }
    }
  }
  const zero = fn(A, B, valid, 0, 0, 1);
  const border =
    best.dx <= DX0 || best.dx >= DX1 || best.dy <= DY0 || best.dy >= DY1;
  return { best, zero, coarseMean: mean, coarseStd: std, border };
}

// --- 1-D profile cross-checks (air only) -------------------------------------
function profileNcc(refProf, genProf, lo, hi) {
  // best lag in [lo,hi]: correlate ref[t] with gen[t+lag]
  let best = { lag: 0, s: -2 };
  const n = refProf.length;
  for (let lag = lo; lag <= hi; lag++) {
    let c = 0, nr = 0, ng = 0, srr = 0, sgg = 0, srg = 0, m = 0;
    for (let t = 0; t < n; t++) {
      const u = t + lag;
      if (u < 0 || u >= n) continue;
      const r = refProf[t], g = genProf[u];
      m++; c += 0; srr += r * r; sgg += g * g; srg += r * g; nr += r; ng += g;
    }
    if (m < 100) continue;
    const num = m * srg - nr * ng;
    const den = Math.sqrt((m * srr - nr * nr) * (m * sgg - ng * ng));
    const s = den > 0 ? num / den : 0;
    if (s > best.s) best = { lag, s };
  }
  return best;
}

// --- model fits (constant vs linear vs sawtooth) ------------------------------
function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
}
function lsq(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = my - b * mx;
  let se = 0;
  for (let i = 0; i < n; i++) se += (ys[i] - (a + b * xs[i])) ** 2;
  return { a, b, rmse: Math.sqrt(se / n) };
}
function fitAxis(ys, coords, phaseFn) {
  const med = median(ys);
  let se = 0;
  for (const y of ys) se += (y - med) ** 2;
  const m = { rmse: Math.sqrt(se / ys.length) };
  const lin = lsq(coords, ys);
  const saw = lsq(coords.map(phaseFn), ys);
  m.const = { pred: med, rmse: m.rmse };
  m.lin = lin;
  m.saw = saw;
  const models = [
    ["constant", m.rmse],
    ["linear", lin.rmse],
    ["sawtooth", saw.rmse],
  ];
  models.sort((p, q) => p[1] - q[1]);
  m.winner = models[0][0];
  // heuristic classification (stated in entry (99))
  if (m.rmse <= 2) m.verdict = "constant (const RMSE ≤ 2 px)";
  else if (m.winner === "sawtooth" && saw.rmse < 0.8 * m.rmse) m.verdict = "sawtooth (RMSE 20%+ below constant)";
  else if (m.winner === "linear" && lin.rmse < 0.8 * m.rmse && Math.abs(lin.b) > 0.15)
    m.verdict = "LINEAR DRIFT — a constant is invalid far from fit (§4 principle)";
  else m.verdict = "no coherent rule (scatter ≈ noise)";
  return m;
}

// --- main ---------------------------------------------------------------------
const refDir = path.join(repoRoot, "mapgen/out/ref");
const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i");
console.log(`seed ${CAPTURE_SEED} · cache ${path.relative(repoRoot, cacheDir)} · default render`);
const world = ensureWorld(CAPTURE_SEED, findNoitaDataDir(), { cacheDir });
await world.ready;

const chunks = [];
for (const bty of ROWS) {
  for (let tx = TX0; tx <= TX1; tx++) {
    const refFile = path.join(refDir, `${tx}_${bty}.png`);
    if (!fs.existsSync(refFile)) continue;
    const idx = world.grid[(bty + SKY_ROWS) * WORLD_CHUNKS_W + tx];
    if (idx < 0) continue;
    const area = world.areas[idx];
    if (!world.maps.has(area.key)) continue;
    chunks.push({ tx, bty, key: area.key });
  }
}
let picked = chunks;
if (LIMIT > 0 && chunks.length > LIMIT) {
  // evenly spread across the sorted list so model fits keep x/y span
  const step = chunks.length / LIMIT;
  picked = Array.from({ length: LIMIT }, (_, i) => chunks[Math.floor(i * step)]);
}
console.log(`chunks: ${chunks.length} enumerated, scanning ${picked.length}\n`);
if (picked.length === 0) { console.error("no chunks — check data"); process.exit(1); }

const results = [];
for (const c of picked) {
  const ref = readPng(path.join(refDir, `${c.tx}_${c.bty}.png`));
  if (ref.width !== 512 || ref.height !== 512)
    throw new Error(`ref ${c.tx}_${c.bty} is ${ref.width}×${ref.height}, expected 512×512`);
  const refL = new Uint8Array(N), genL = new Uint8Array(N), valid = new Uint8Array(N);
  for (let i = 0; i < N; i++)
    refL[i] = lum(ref.data[4 * i], ref.data[4 * i + 1], ref.data[4 * i + 2]);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const col = worldColorAt(world, c.tx * 512 + x, (c.bty + SKY_ROWS) * 512 + y);
      if (col) { const i = y * 512 + x; valid[i] = 1; genL[i] = lum(col[0], col[1], col[2]); }
    }
  const validN = valid.reduce((a, b) => a + b, 0);
  const refAir = new Uint8Array(N), genAir = new Uint8Array(N);
  let ra = 0, ga = 0;
  for (let i = 0; i < N; i++) {
    refAir[i] = refL[i] < AIR_THRESHOLD ? 1 : 0;
    genAir[i] = valid[i] && genL[i] < AIR_THRESHOLD ? 1 : 0;
    if (refAir[i]) ra++;
    if (valid[i] && genAir[i]) ga++;
  }
  const validE = new Uint8Array(N); // eroded validity for the edge metric
  for (let y = 1; y < 511; y++)
    for (let x = 1; x < 511; x++) {
      const i = y * 512 + x;
      if (valid[i] && valid[i - 1] && valid[i + 1] && valid[i - 512] && valid[i + 512]) validE[i] = 1;
    }
  const inputs = {
    air: [refAir, genAir, valid],
    edge: [edgeMask(refL, null), edgeMask(genL, validE), validE],
    lum: [refL, genL, valid],
  };
  // paired candidate evaluation: does each candidate constant beat (0,0) on
  // THIS chunk? (the medians alone don't prove the correction helps)
  const candScores = Object.fromEntries(
    METRICS.map((m) => {
      const [A, B, V] = inputs[m.name];
      return [m.name, CANDS.map(([cx, cy]) => m.fn(A, B, V, cx, cy, 1))];
    })
  );
  const perMetric = {};
  for (const m of METRICS) {
    const [A, B, V] = inputs[m.name];
    perMetric[m.name] = scan(m.fn, A, B, V);
  }
  // profile cross-checks (air)
  const colRef = new Float64Array(512), colGen = new Float64Array(512);
  const colDen = new Float64Array(512);
  const rowRef = new Float64Array(512), rowGen = new Float64Array(512);
  const rowDen = new Float64Array(512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const i = y * 512 + x;
      if (refAir[i]) colRef[x]++;
      if (valid[i]) { colDen[x]++; if (genAir[i]) colGen[x]++; }
      if (refAir[i]) rowRef[y]++;
    }
  for (let t = 0; t < 512; t++) {
    colGen[t] = colDen[t] ? colGen[t] / colDen[t] : 0;
    rowGen[t] = rowRef[t]; // placeholder, recomputed below
  }
  // row profiles: gen rows need their own denominator
  const rowDen2 = new Float64Array(512);
  const rowGen2 = new Float64Array(512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const i = y * 512 + x;
      if (valid[i]) { rowDen2[y]++; if (genAir[i]) rowGen2[y]++; }
    }
  for (let t = 0; t < 512; t++) {
    rowGen2[t] = rowDen2[t] ? rowGen2[t] / rowDen2[t] : 0;
    rowRef[t] = rowRef[t] / 512;
  }
  for (let t = 0; t < 512; t++) colRef[t] = colRef[t] / 512;
  const profDx = profileNcc(colRef, colGen, DX0, DX1);
  const profDy = profileNcc(rowRef, rowGen2, DY0, DY1);

  const row = {
    ...c,
    validFrac: +(validN / N).toFixed(3),
    refAirFrac: +(ra / N).toFixed(3),
    genAirFrac: +(ga / Math.max(1, validN)).toFixed(3),
    metrics: Object.fromEntries(
      METRICS.map((m) => [m.name, {
        best: perMetric[m.name].best,
        zero: +perMetric[m.name].zero.toFixed(4),
        std: +perMetric[m.name].coarseStd.toFixed(4),
        border: perMetric[m.name].border,
      }])
    ),
    profile: { dx: profDx.lag, dxNcc: +profDx.s.toFixed(3), dy: profDy.lag, dyNcc: +profDy.s.toFixed(3) },
    cand: candScores,
  };
  results.push(row);
  const fmt = METRICS.map((m) => {
    const r = row.metrics[m.name];
    return `${m.name}: best(${r.best.dx},${r.best.dy})=${r.best.s.toFixed(3)} zero=${r.zero}${r.border ? " BORDER!" : ""}`;
  }).join("  ");
  console.log(
    `${c.key.padEnd(26)} tx=${c.tx} bty=${c.bty} valid=${row.validFrac} air ref/gen=${row.refAirFrac}/${row.genAirFrac}\n  ${fmt}\n  profile dx=${row.profile.dx} (${row.profile.dxNcc}) dy=${row.profile.dy} (${row.profile.dyNcc})`
  );
}

// --- aggregation + model decision --------------------------------------------
console.log("\n=== aggregate (per metric) ===");
const phaseDx = (tx) => ((2 * tx) % 10 + 10) % 10; // (512·tx) mod 10, 512≡2 (mod 10)
const phaseDy = (bty) => (((bty + SKY_ROWS) * 512) % 10 + 10) % 10; // world-y origin mod 10
const summary = {};
for (const m of METRICS) {
  const dxs = results.map((r) => r.metrics[m.name].best.dx);
  const dys = results.map((r) => r.metrics[m.name].best.dy);
  const fx = fitAxis(dxs, results.map((r) => r.tx), phaseDx);
  const fy = fitAxis(dys, results.map((r) => r.bty), phaseDy);
  summary[m.name] = { dx: fx, dy: fy, medianDx: median(dxs), medianDy: median(dys) };
  console.log(
    `${m.name.padEnd(5)} dx: median=${median(dxs)} constRMSE=${fx.const.rmse.toFixed(2)} linRMSE=${fx.lin.rmse.toFixed(2)} (b=${fx.lin.b.toFixed(3)}) sawRMSE=${fx.saw.rmse.toFixed(2)} → ${fx.verdict}\n` +
    `      dy: median=${median(dys)} constRMSE=${fy.const.rmse.toFixed(2)} linRMSE=${fy.lin.rmse.toFixed(2)} (b=${fy.lin.b.toFixed(3)}) sawRMSE=${fy.saw.rmse.toFixed(2)} → ${fy.verdict}`
  );
}
// paired candidate-constant evaluation: mean/median score per candidate vs the
// (0,0) baseline on the same chunks (stride 1, same windowing as `zero`)
console.log("\n=== candidate constants (full-res, paired vs (0,0)) ===");
for (const m of METRICS) {
  const zeroScores = results.map((r) => r.cand[m.name][0]);
  const zeroMean = zeroScores.reduce((a, b) => a + b, 0) / zeroScores.length;
  console.log(`${m.name}:`);
  const rows = CANDS.map(([cx, cy], i) => {
    const ss = results.map((r) => r.cand[m.name][i]);
    const mean = ss.reduce((a, b) => a + b, 0) / ss.length;
    const wins = ss.filter((s, k) => s > zeroScores[k]).length;
    return { c: `(${cx},${cy})`, mean: +mean.toFixed(4), delta: +(mean - zeroMean).toFixed(4), wins: `${wins}/${ss.length}` };
  });
  for (const r of rows)
    console.log(`  ${r.c.padEnd(10)} mean=${r.mean}  Δ=${r.delta >= 0 ? "+" : ""}${r.delta}  wins=${r.wins}`);
  summary[m.name].cand = rows;
}
// metric agreement on the joint best
let agree = 0;
for (const r of results) {
  const b = METRICS.map((m) => r.metrics[m.name].best);
  if (Math.max(...b.map((p) => p.dx)) - Math.min(...b.map((p) => p.dx)) <= 2 &&
      Math.max(...b.map((p) => p.dy)) - Math.min(...b.map((p) => p.dy)) <= 2) agree++;
}
console.log(`\nmetric agreement (all three within ±2 px): ${agree}/${results.length}`);
// certified-bound containment (world px: x∈[−10..30], y∈[0..20])
for (const m of METRICS) {
  const { medianDx, medianDy } = summary[m.name];
  const inside = medianDx >= -10 && medianDx <= 30 && medianDy >= 0 && medianDy <= 20;
  console.log(`${m.name.padEnd(5)} median (${medianDx},${medianDy}) ${inside ? "INSIDE" : "OUTSIDE"} certified bound (VERIFIED:1083)`);
}

const outPath = path.join(repoRoot, "mapgen/out/l3-anchor-2026-09-24.json");
fs.writeFileSync(outPath, JSON.stringify({
  seed: CAPTURE_SEED,
  scan: { dx: [DX0, DX1], dy: [DY0, DY1], airThreshold: AIR_THRESHOLD, edgeThreshold: EDGE_THRESHOLD },
  chunks: results,
  summary,
}, null, 2));
console.log(`\nwrote ${path.relative(repoRoot, outPath)}`);
