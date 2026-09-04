// Diff an in-game capture (mapcap/out/<name>/chunks) against the noitamap
// built-in reference capture (seed 78633191, level-17 DZI tiles cached in
// mapgen/out/ref). Coordinate mapping: ref tile i_j = biome px (i, j-48)
// = world chunk (i-35, j-14).
//
//   node mapcap/diff-vs-reference.mjs --name run1b
//
// Outputs mapcap/out/<name>_vs_ref78633191/ : diff.json, diff-heatmap.png,
// chunkmap.png, report.md

import fs from "node:fs";
import path from "node:path";
import { readPng, writePng } from "../mapgen/lib/images.mjs";

const CHUNK = 512;
const REF_DX = 35; // ref tile i = world chunk cx + 35
const REF_DY = 14; // ref tile j = world chunk cy + 14

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}
const { name = "run1b" } = parseArgs(process.argv);
const capDir = path.resolve("mapcap/out", name);
const refDir = path.resolve("mapgen/out/ref");
const capMan = JSON.parse(fs.readFileSync(path.join(capDir, "manifest.json")));
const refMan = JSON.parse(fs.readFileSync(path.join(refDir, "manifest.json")));
const outDir = path.resolve("mapcap/out", `${name}_vs_ref78633191`);
fs.mkdirSync(outDir, { recursive: true });

// overlap in world-chunk coords
const [ccx0, ccx1] = capMan.grid.cx;
const [ccy0, ccy1] = capMan.grid.cy;
const [wx0, wx1] = refMan.window.x0 - REF_DX >= ccx0 ? [refMan.window.x0 - REF_DX, Math.min(refMan.window.x1 - REF_DX, ccx1)] : [null, null];
const [wy0, wy1] = refMan.window.y0 - REF_DY >= ccy0 ? [refMan.window.y0 - REF_DY, Math.min(refMan.window.y1 - REF_DY, ccy1)] : [null, null];
if (wx0 == null || wy0 == null) {
  console.error("no overlap between capture grid and reference window");
  process.exit(1);
}
const W = (wx1 - wx0 + 1) * CHUNK;
const H = (wy1 - wy0 + 1) * CHUNK;

const heat = Buffer.alloc(W * H * 4); // assembled heatmap (grayscale diff)
const chunkResults = [];
let gIdent = 0, gCnt = 0, gSum = 0;
const hist = [0, 0, 0, 0, 0]; // d=0; 1-2; 3-5; 6-20; >20

for (let cy = wy0; cy <= wy1; cy++) {
  for (let cx = wx0; cx <= wx1; cx++) {
    const a = readPng(path.join(capDir, "chunks", `chunk_${cx}_${cy}.png`));
    const b = readPng(path.join(refDir, `${cx + REF_DX}_${cy + REF_DY}.png`));
    if (a.width !== CHUNK || b.width !== CHUNK) throw new Error("bad chunk size");
    const res = { cx, cy, ident: 0, cnt: 0, sum: 0, max: 0 };
    const xo = (cx - wx0) * CHUNK, yo = (cy - wy0) * CHUNK;
    for (let y = 0; y < CHUNK; y++) {
      for (let x = 0; x < CHUNK; x++) {
        const ia = (y * CHUNK + x) * 4, ib = ia;
        const d = Math.abs(a.data[ia] - b.data[ib]) + Math.abs(a.data[ia + 1] - b.data[ib + 1]) + Math.abs(a.data[ia + 2] - b.data[ib + 2]);
        res.cnt++; gCnt++;
        if (d === 0) { res.ident++; gIdent++; hist[0]++; }
        else {
          res.sum += d; gSum += d;
          if (d > res.max) res.max = d;
          if (d <= 6) hist[1]++; else if (d <= 15) hist[2]++; else if (d <= 60) hist[3]++; else hist[4]++;
        }
        const g = Math.min(255, d); // L1(0..765) -> clamp for visualization
        const hi = ((yo + y) * W + xo + x) * 4;
        heat[hi] = heat[hi + 1] = heat[hi + 2] = g; heat[hi + 3] = 255;
      }
    }
    res.identPct = (100 * res.ident / res.cnt);
    res.mean = res.sum / Math.max(1, res.cnt - res.ident);
    chunkResults.push(res);
  }
}

const pct = (n) => (100 * n / gCnt).toFixed(3) + "%";
const identicalPct = 100 * gIdent / gCnt;
chunkResults.sort((a, b) => a.identPct - b.identPct);
const stable = chunkResults.filter(r => r.identPct >= 99.9);
const heavilyChanged = chunkResults.filter(r => r.identPct < 50);

const json = {
  a: { name, seed: capMan.seed },
  b: { name: "ref78633191", seed: 78633191 },
  overlapChunks: [wx0, wx1, wy0, wy1],
  identicalPct, meanDiff: gSum / Math.max(1, gCnt - gIdent), hist, chunkResults,
};
fs.writeFileSync(path.join(outDir, "diff.json"), JSON.stringify(json, null, 1));

writePng(path.join(outDir, "diff-heatmap.png"), W, H, heat);

// chunk map: 1px per chunk, grayscale = mean diff (chunk-sized blocks for visibility)
const cmW = wx1 - wx0 + 1, cmH = wy1 - wy0 + 1, S = 16;
const cm = Buffer.alloc(cmW * S * cmH * S * 4);
for (const r of chunkResults) {
  const v = Math.min(255, Math.round(r.mean * 2));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (((r.cy - wy0) * S + y) * cmW * S + (r.cx - wx0) * S + x) * 4;
    cm[i] = cm[i + 1] = cm[i + 2] = v; cm[i + 3] = 255;
  }
}
writePng(path.join(outDir, "chunkmap.png"), cmW * S, cmH * S, cm);

const top10 = chunkResults.slice(0, 10);
let md = `# diff — ${name} (in-game capture, parallax off) vs noitamap reference (seed 78633191)\n`;
md += `\n- ${name}: seed ${capMan.seed}; ref: seed 78633191 (adjacent seeds, +1)\n`;
md += `- overlap chunks: cx ${wx0}..${wx1}, cy ${wy0}..${wy1} (${chunkResults.length} chunks)\n`;
md += `\n## Global\n- identical pixels: ${identicalPct.toFixed(3)}%\n- mean per-channel diff (changed px): ${(gSum / Math.max(1, gCnt - gIdent)).toFixed(3)}\n`;
md += `- diff histogram (per-pixel RGB L1): =0: ${pct(hist[0])}  <=6: ${pct(hist[0] + hist[1])}  <=15: ${pct(hist[0] + hist[1] + hist[2])}  <=60: ${pct(hist.slice(0, 4).reduce((a, b) => a + b, 0))}  >60: ${pct(hist[4])}\n`;
md += `\n## Chunks\n- fully stable chunks (>=99.9% identical): ${stable.length} / ${chunkResults.length}${stable.length ? ` -> ${stable.map(r => `chunk_${r.cx}_${r.cy}`).join(", ")}` : ""}\n`;
md += `- heavily changed chunks (<50% identical): ${heavilyChanged.length}\n`;
md += `- top-10 changed:\n`;
for (const r of top10) md += `  chunk_${r.cx}_${r.cy}: ident=${r.identPct.toFixed(1)}% mean=${r.mean.toFixed(3)} max=${r.max}\n`;
md += `\n- chunk mean-diff map: chunkmap.png; per-pixel heatmap: diff-heatmap.png\n`;
fs.writeFileSync(path.join(outDir, "report.md"), md);
console.log(`done -> ${outDir}`);
console.log(`identical: ${identicalPct.toFixed(3)}%  mean diff(changed px): ${(gSum / Math.max(1, gCnt - gIdent)).toFixed(3)}`);
console.log(`stable chunks: ${stable.length}/${chunkResults.length}, heavily changed(<50%): ${heavilyChanged.length}`);
