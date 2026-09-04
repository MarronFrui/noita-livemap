// Diff two analyzed mapcap captures (same dirs produced by analyze-capture.mjs).
//
//   node mapcap/diff-captures.mjs --a run1 --b run2
//
// Use cases:
//   run1 vs run2 (same world, recaptured)  -> true cross-run noise floor
//   run1 vs run3 (different worlds)        -> seed determinism / seed sensitivity
//
// Outputs mapcap/out/<a>_vs_<b>/ : diff.json, diff-heatmap.png, chunkmap.png, report.md

import fs from "node:fs";
import path from "node:path";
import { readPng, writePng } from "../mapgen/lib/images.mjs";
import { execFileSync } from "node:child_process";

const CHUNK = 512;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}
const { a, b } = parseArgs(process.argv);
if (!a || !b) {
  console.error("usage: node mapcap/diff-captures.mjs --a run1 --b run2");
  process.exit(1);
}
const dirA = path.resolve("mapcap/out", a);
const dirB = path.resolve("mapcap/out", b);
const outDir = path.resolve("mapcap/out", `${a}_vs_${b}`);
fs.mkdirSync(outDir, { recursive: true });

const manA = JSON.parse(fs.readFileSync(path.join(dirA, "manifest.json")));
const manB = JSON.parse(fs.readFileSync(path.join(dirB, "manifest.json")));
for (const k of ["grid", "worldRect"]) {
  if (JSON.stringify(manA[k]) !== JSON.stringify(manB[k])) {
    console.error(`manifest mismatch on ${k}: ${JSON.stringify(manA[k])} vs ${JSON.stringify(manB[k])}`);
    process.exit(1);
  }
}
// origin may be null in re-analysis (--chunks) mode; grid+worldRect pin the geometry
const [cx0, cx1] = manA.grid.cx;
const [cy0, cy1] = manA.grid.cy;
const seedsDiffer = manA.seed !== manB.seed;

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

const chunkResults = [];
const winW = (cx1 - cx0 + 1) * CHUNK;
const winH = (cy1 - cy0 + 1) * CHUNK;
const heat = Buffer.alloc(winW * winH * 4); // assembled diff heatmap
let gIdent = 0,
  gCnt = 0,
  gSum = 0;
const hist = [0, 0, 0, 0, 0]; // d=0; 1-2; 3-5; 6-20; >20

for (let cy = cy0; cy <= cy1; cy++) {
  const rowOff = (cy - cy0) * CHUNK;
  for (let cx = cx0; cx <= cx1; cx++) {
    const A = readPng(path.join(dirA, "chunks", `chunk_${cx}_${cy}.png`)).data;
    const B = readPng(path.join(dirB, "chunks", `chunk_${cx}_${cy}.png`)).data;
    const n = CHUNK * CHUNK;
    let sum = 0,
      ident = 0,
      max = 0;
    const colOff = (cx - cx0) * CHUNK;
    const diffs = new Float32Array(n);
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
      diffs[p] = d;
      sum += d;
      if (d === 0) ident++;
      if (d > max) max = d;
      if (d === 0) hist[0]++;
      else if (d <= 6) hist[1]++;
      else if (d <= 15) hist[2]++;
      else if (d <= 60) hist[3]++;
      else hist[4]++;
      const hi = ((rowOff + ((p / CHUNK) | 0)) * winW + colOff + (p % CHUNK)) * 4;
      const v = Math.min(255, (d / 3) * 12);
      heat[hi] = v;
      heat[hi + 1] = v;
      heat[hi + 2] = v;
      heat[hi + 3] = 255;
    }
    gIdent += ident;
    gCnt += n;
    gSum += sum;
    const sorted = Float32Array.from(diffs).sort();
    const px = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
    chunkResults.push({
      cx,
      cy,
      meanDiff: +(sum / n / 3).toFixed(3),
      p50: +(px(0.5) / 3).toFixed(2),
      p99: +(px(0.99) / 3).toFixed(2),
      max: +(max / 3).toFixed(1),
      identPct: +((100 * ident) / n).toFixed(2),
    });
  }
  console.log(`row cy=${cy} done`);
}

const heatPath = path.join(outDir, "diff-heatmap-full.png");
writePng(heatPath, winW, winH, heat);

// per-chunk map (mean diff false colour)
const gw = cx1 - cx0 + 1,
  gh = cy1 - cy0 + 1;
const cm = Buffer.alloc(gw * gh * 4);
for (const c of chunkResults) {
  const i = ((c.cy - cy0) * gw + (c.cx - cx0)) * 4;
  const t = Math.min(1, c.meanDiff / 20);
  cm[i] = 255 * t;
  cm[i + 1] = 255 * (1 - t);
  cm[i + 2] = 30;
  cm[i + 3] = 255;
}
writePng(path.join(outDir, "chunkmap.png"), gw, gh, cm);

// downscaled full heatmap via sharp
const smallPath = path.join(outDir, "diff-heatmap.png");
execFileSync(
  process.execPath,
  [
    "-e",
    `const sharp=require('sharp');sharp(${JSON.stringify(heatPath)}).resize(${Math.min(1408, winW)},${Math.round((Math.min(1408, winW) * winH) / winW)}).png().toFile(${JSON.stringify(smallPath)}).then(()=>console.log('ok'))`,
  ],
  { stdio: "inherit" }
);
fs.rmSync(heatPath);

const identPct = (100 * gIdent) / gCnt;
const meanDiff = gSum / gCnt / 3;
const pctBucket = (i) => +((100 * hist.reduce((s, v, j) => (j <= i ? s + v : s), 0)) / gCnt).toFixed(3);

const sorted = [...chunkResults].sort((x, y) => y.meanDiff - x.meanDiff);
const top10 = sorted.slice(0, 10);
const stableChunks = chunkResults.filter((c) => c.identPct >= 99.9).length;
const changedChunks = chunkResults.filter((c) => c.identPct < 50).length;

const verdict = seedsDiffer
  ? "different worlds (seeds differ): identical chunks are seed-independent regions"
  : "same world (recapture): diffs measure cross-run temporal noise";

const report = `# diff — ${a} vs ${b} (${verdict})

- ${a}: seed ${manA.seed ?? "?"}, ${b}: seed ${manB.seed ?? "?"}
- world rect: ${manA.worldRect.join(", ")}

## Global
- identical pixels: ${identPct.toFixed(3)}%
- mean per-channel diff: ${meanDiff.toFixed(3)}
- diff histogram (per-pixel RGB L1): =0: ${pctBucket(0)}%  <=6: ${pctBucket(1)}%  <=15: ${pctBucket(2)}%  <=60: ${pctBucket(3)}%  >60: ${pctBucket(4)}%

## Chunks
- fully stable chunks (>=99.9% identical): ${stableChunks} / ${chunkResults.length}
- heavily changed chunks (<50% identical): ${changedChunks}
- top-10 changed:
${top10
  .map(
    (c) =>
      `  chunk_${c.cx}_${c.cy}: ident=${c.identPct}% mean=${c.meanDiff} p99=${c.p99} max=${c.max}`
  )
  .join("\n")}

- chunk mean-diff map: chunkmap.png; per-pixel heatmap: diff-heatmap.png
`;

fs.writeFileSync(path.join(outDir, "diff.json"), JSON.stringify({ global: { identPct, meanDiff, hist }, chunks: chunkResults }, null, 2));
fs.writeFileSync(path.join(outDir, "report.md"), report);

console.log(`\ndone -> ${outDir}`);
console.log(`identical: ${identPct.toFixed(3)}%  mean diff: ${meanDiff.toFixed(3)}`);
console.log(`stable chunks: ${stableChunks}/${chunkResults.length}, changed(<50%): ${changedChunks}`);
