// 2026-10-13 — dig #127: I30 — the walk's carve EXIT-law + the lane-band-1
// carry, ported into walkChain (CONSTANTS C105(b); ABOUT_MATH (126));
// the ORACLE count-test then the C97 A/B.
//
// Parts:
//  1. the walk-length census instrument (bimodal byte-side vs the old port's
//     uniform budget-length): single walks over fresh grids, carved-cell count
//     per run, 150 fresh seeds, cursor 0.45 / budget 60 vs the no-exit control
//     (cursor 8 > the walk's value ceiling 1 → never exits).
//  2. the C48 oracle compare (out/oracle/caves-grid-2026-09-21.json,
//     grid_0x26599020 = the 512x256 bitmap_hills cache, seed 78633191):
//     per sampled row meanAbs / maxDelta / rms / >0.25-delta / gate mismatches.
//  3. the C97 surface-shape A/B is run separately
//     (mapgen/experiments/2026-10-10-surface-shape-iou.mjs).
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { loadBiomeConfig } from "../lib/biomes.mjs";
import { buildCavesField, CAVES_FIELD_VER, walkChain } from "../lib/caves-field.mjs";
import { NollaPrng } from "../lib/wang-js.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";

// ── 1. the walk-length census ────────────────────────────────────────────────
function carvedCount(seed, cursor, budget) {
  const w = 220, h = 300;
  const field = new Float32Array(w * h).fill(1.0);
  walkChain(field, w, h, new NollaPrng(seed), 60, 128, cursor, budget,
    { d0sq: 0.5, dy: 0, growth: 0.5, cc: { n: 0 } });
  let n = 0;
  for (const v of field) if (v < 1.0) n++;
  return n;
}
export function census(N = 150, budget = 60) {
  const lo = [], hi = [];
  for (let i = 0; i < N; i++) {
    lo.push(carvedCount(1000 + i, 0.45, budget));
    hi.push(carvedCount(1000 + i, 8.0, budget));
  }
  const st = (a) => {
    const s = [...a].sort((x, y) => x - y);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return { min: s[0], p25: q(0.25), med: q(0.5), p75: q(0.75), max: s[s.length - 1] };
  };
  const loS = st(lo), hiS = st(hi);
  // the 1-stamp murmur: runs that carved ≤ 10 cells (a t=0 radius < 1 lane)
  const murmur = lo.filter((n) => n <= 10).length;
  console.log(`census(N=${N}, budget=${budget}) exits@cursor0.45:`, JSON.stringify(loS),
    `1-stamp-murmur(${murmur}/${N})`);
  console.log(`census control (cursor 8 = never exits = the uniform-budget lane):`,
    JSON.stringify(hiS));
  console.log(`median ratio (exit/no-exit): ${(loS.med / hiS.med).toFixed(4)}`);
  return { loS, hiS, murmur, N };
}

// ── 2. the C48 oracle compare ────────────────────────────────────────────────
const dataDir = findNoitaDataDir();
const oracle = JSON.parse(
  readFileSync(path.join(repoRoot, "mapgen/out/oracle/caves-grid-2026-09-21.json"), "utf8")
);
const grid = oracle["grid_0x26599020"];
const config = loadBiomeConfig(dataDir);
let def = null;
for (const d of config.biomes.values()) {
  if (d && d.bitmapCaves && d.bitmapCaves.name === "bitmap_hills") { def = d; break; }
}
if (!def) { console.error("no biome def carries bitmap_hills"); process.exit(1); }
console.log("ver:", CAVES_FIELD_VER);
const r = buildCavesField(dataDir, def, 78633191);
console.log("meta:", JSON.stringify(r.meta));
console.log("verify:", JSON.stringify(r.verify));

// [AB#1 ab-repro] C79-set replay
const rows = Object.keys(grid).filter((k) => /^y\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
let worst = 0;
for (const k of rows) {
  const y = Number(k.slice(1));
  const ref = grid[k];
  const port = ref.map((_, i) => r.field[y * r.w + i]);
  let abs = 0, maxd = 0, sq = 0, big = 0, gate = 0;
  for (let i = 0; i < ref.length; i++) {
    const d = port[i] - ref[i];
    abs += Math.abs(d); sq += d * d;
    maxd = Math.max(maxd, Math.abs(d));
    if (Math.abs(d) > 0.25) big++;
    if ((port[i] > 0.5) !== (ref[i] > 0.5)) gate++;
  }
  const rms = Math.sqrt(sq / ref.length);
  worst = Math.max(worst, rms);
  console.log(
    `${k.padEnd(9)} meanAbs ${(abs / ref.length).toFixed(4)}  maxDelta ${maxd.toFixed(4)}  rms ${rms.toFixed(4)}  >0.25delta ${big}/${ref.length}  gate-mismatch ${gate}/${ref.length}`
  );
}
{
  const ref = grid["y0_x0_31"];
  const port = ref.map((_, i) => r.field[i]);
  let abs = 0, maxd = 0, sq = 0;
  for (let i = 0; i < ref.length; i++) {
    const d = port[i] - ref[i];
    abs += Math.abs(d); sq += d * d; maxd = Math.max(maxd, Math.abs(d));
  }
  console.log(`y0(x0..31) meanAbs ${(abs / ref.length).toFixed(4)} maxDelta ${maxd.toFixed(4)} rms ${Math.sqrt(sq / ref.length).toFixed(4)} (the bump = the image-lane writer, not in this port)`);
}
let solid = 0;
for (let i = 0; i < r.field.length; i++) if (r.field[i] > 0.5) solid++;
console.log("port solid share:", (solid / r.field.length).toFixed(4));
console.log("worst sampled-row rms:", worst.toFixed(4));

if (process.argv[2] === "--census-only") census();
else census();
