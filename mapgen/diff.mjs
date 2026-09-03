// Diff generated chunks (out/gen) against captured reference chunks (out/ref).
// Outputs: out/stats.json (scores), out/report.html (heatmap + side-by-sides).
//
// Metrics per chunk:
//  - meanAbsDiff: mean |a-b| over RGB, 0..255
//  - solidMismatch %: air/solid classification (luminance threshold) disagreement
// Both are texture-sensitive to a degree; the heatmap pattern is the primary
// diagnostic tool (see SESSION_CONTEXT: failure-signature table).

import fs from "node:fs";
import path from "node:path";
import { readPng } from "./pngio.mjs";

const genDir = "mapgen/out/gen";
const refDir = "mapgen/out/ref";
const outDir = "mapgen/out";

const AIR_THRESHOLD = 24;

function grayscaleDownscaled(data, width, height, target = 64) {
  const step = width / target;
  const out = new Float32Array(target * target);
  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      let sum = 0;
      let count = 0;
      for (let sy = Math.floor(y * step); sy < Math.floor((y + 1) * step); sy++) {
        for (let sx = Math.floor(x * step); sx < Math.floor((x + 1) * step); sx++) {
          const i = 4 * (sy * width + sx);
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          count++;
        }
      }
      out[y * target + x] = count ? sum / count : 0;
    }
  }
  return out;
}

function chunkScore(genPath, refPath) {
  const gen = readPng(genPath);
  const ref = readPng(refPath);
  const n = Math.min(gen.width, ref.width) * Math.min(gen.height, ref.height);

  const g = grayscaleDownscaled(gen.data, gen.width, gen.height);
  const r = grayscaleDownscaled(ref.data, ref.width, ref.height);
  let dsSum = 0;
  for (let i = 0; i < g.length; i++) dsSum += Math.abs(g[i] - r[i]);
  const meanAbsDiff = dsSum / g.length;

  let solidMismatch = 0;
  for (let i = 0; i < n; i++) {
    const gi = 4 * i;
    const gl = 0.2126 * gen.data[gi] + 0.7152 * gen.data[gi + 1] + 0.0722 * gen.data[gi + 2];
    const rl = 0.2126 * ref.data[gi] + 0.7152 * ref.data[gi + 1] + 0.0722 * ref.data[gi + 2];
    if ((gl >= AIR_THRESHOLD) !== (rl >= AIR_THRESHOLD)) solidMismatch++;
  }

  return { meanAbsDiff, solidMismatchPct: (100 * solidMismatch) / n };
}

const scoreColor = (pct) => {
  const t = Math.min(1, pct / 40);
  const r = Math.round(60 + 195 * t);
  const g = Math.round(200 - 160 * t);
  return `rgb(${r},${g},80)`;
};

const genFiles = fs.existsSync(genDir)
  ? fs.readdirSync(genDir).filter((f) => f.endsWith(".png"))
  : [];
const results = [];
for (const file of genFiles) {
  const refPath = path.join(refDir, file);
  if (!fs.existsSync(refPath)) continue;
  const { meanAbsDiff, solidMismatchPct } = chunkScore(
    path.join(genDir, file),
    refPath
  );
  results.push({
    chunk: file.replace(".png", ""),
    meanAbsDiff,
    solidMismatchPct,
  });
}
results.sort((a, b) => a.chunk.localeCompare(b.chunk));

const scored = results.filter((r) => r.chunk.split("_").map(Number));
const txs = scored.map((r) => Number(r.chunk.split("_")[0]));
const tys = scored.map((r) => Number(r.chunk.split("_")[1]));
const tx0 = Math.min(...txs), tx1 = Math.max(...txs);
const ty0 = Math.min(...tys), ty1 = Math.max(...tys);

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const stats = {
  chunks: results.length,
  meanAbsDiff: { avg: avg(results.map((r) => r.meanAbsDiff)) },
  solidMismatchPct: {
    avg: avg(results.map((r) => r.solidMismatchPct)),
    best: results.reduce((a, b) => (b.solidMismatchPct < a.solidMismatchPct ? b : a), results[0]),
    worst: results.reduce((a, b) => (b.solidMismatchPct > a.solidMismatchPct ? b : a), results[0]),
  },
  perChunk: results,
};
fs.writeFileSync(path.join(outDir, "stats.json"), JSON.stringify(stats, null, 2));

const scoreOf = {};
for (const r of results) scoreOf[r.chunk] = r;

let heatmap = "";
for (let ty = ty0; ty <= ty1; ty++) {
  heatmap += "<tr>";
  for (let tx = tx0; tx <= tx1; tx++) {
    const s = scoreOf[`${tx}_${ty}`];
    heatmap += s
      ? `<td title="${tx},${ty}: ${s.solidMismatchPct.toFixed(1)}%" style="background:${scoreColor(s.solidMismatchPct)}">${tx},${ty}<br>${s.solidMismatchPct.toFixed(0)}%</td>`
      : `<td title="${tx},${ty}" style="background:#222"></td>`;
  }
  heatmap += "</tr>\n";
}

const gallery = results
  .map(
    (r) => `
<details>
  <summary>${r.chunk} — solid mismatch ${r.solidMismatchPct.toFixed(1)}%, mean diff ${r.meanAbsDiff.toFixed(1)}</summary>
  <div class="pair">
    <figure><img src="ref/${r.chunk}.png"><figcaption>captured (seed 78633191)</figcaption></figure>
    <figure><img src="gen/${r.chunk}.png"><figcaption>generated (wang layer)</figcaption></figure>
  </div>
</details>`
  )
  .join("\n");

fs.writeFileSync(
  path.join(outDir, "report.html"),
  `<!doctype html>
<html><head><meta charset="utf-8"><title>mapgen bench report</title>
<style>
body{background:#111;color:#ddd;font-family:monospace;margin:20px}
table{border-collapse:collapse}
td{width:72px;height:44px;border:1px solid #000;font-size:10px;text-align:center;color:#000}
img{width:384px;image-rendering:pixelated;border:1px solid #333}
.pair{display:flex;gap:16px;flex-wrap:wrap}
details{margin:8px 0}
summary{cursor:pointer}
h2,h3{color:#fff}
</style></head><body>
<h2>mapgen bench — ${results.length} chunks</h2>
<p>avg solid mismatch: <b>${stats.solidMismatchPct.avg.toFixed(1)}%</b> ·
avg mean diff: <b>${stats.meanAbsDiff.avg.toFixed(1)}</b> ·
best: ${stats.solidMismatchPct.best.chunk} (${stats.solidMismatchPct.best.solidMismatchPct.toFixed(1)}%) ·
worst: ${stats.solidMismatchPct.worst.chunk} (${stats.solidMismatchPct.worst.solidMismatchPct.toFixed(1)}%)</p>
<h3>chunk heatmap (solid mismatch %)</h3>
<table>${heatmap}</table>
<h3>side-by-sides</h3>
${gallery}
</body></html>`
);

console.log(`scored ${results.length} chunks`);
console.log(`avg solid mismatch: ${stats.solidMismatchPct.avg.toFixed(1)}%`);
console.log(`best:  ${stats.solidMismatchPct.best.chunk} ${stats.solidMismatchPct.best.solidMismatchPct.toFixed(1)}%`);
console.log(`worst: ${stats.solidMismatchPct.worst.chunk} ${stats.solidMismatchPct.worst.solidMismatchPct.toFixed(1)}%`);
console.log(`report: ${path.join(outDir, "report.html")}`);
