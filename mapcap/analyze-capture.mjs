// Slice a stitched noita-mapcap capture into 512px biome-grid chunks and run:
//   1. skeleton test  — raw-tile overlap consistency (capture stability) +
//                       seam discontinuity at every 512px grid line vs interior baseline
//   2. noise floor    — flat-region high-pass luminance RMS per chunk
//   3. region map     — coarse per-chunk classification (void/sky/water/ice/lava/rock/structure)
//
// Usage:
//   node mapcap/analyze-capture.mjs --name run1 [--stitched <png>] [--tiles <dir>]
//        [--origin 3840,2304] [--grid -6,12,-3,5] [--seed 78633192]
//
// origin = stitched-image pixel coordinates of world pixel (0,0).
// For the stock stitcher (tiles named by top-left world coord): origin = -minTileCoord.
// Outputs in mapcap/out/<name>/ : chunks/*.png, manifest.json, analysis.json,
// classification.png, noise-heatmap.png, report.md

import fs from "node:fs";
import path from "node:path";
import { readImageRaw, writePng, readPng } from "../mapgen/lib/images.mjs";

const CHUNK = 512;

// --- pixel-level detectors (0..255 scales) --------------------------------
const DETECT = {
  voidMaxLum: 8,
  sky: { hueMin: 5, hueMax: 60, satMax: 0.6, valMin: 100, flatMax: 8 },
  water: { bOverR: 8, bOverG: 4, valMin: 10, valMax: 200, flatMax: 6 },
  ice: { valMin: 140, bOverR: 6 },
  lava: { rMin: 140, rOverG: 1.6 },
  flatWindow: 2, // radius of the local window for flatness
  flatStdMax: 2.0, // local std below this = flat
};
const STRUCT = { edgeMin: 0.06, straightMin: 0.45 };
const DOM = { lava: 0.2, water: 0.25, ice: 0.3, sky: 0.4 };
const LABEL_COLORS = {
  void: [20, 20, 20],
  sky: [240, 160, 60],
  water: [40, 90, 220],
  ice: [170, 215, 255],
  lava: [255, 70, 20],
  rock: [130, 95, 60],
  structure: [220, 40, 160],
  mixed: [90, 200, 120],
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) args[k.slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv);
const name = args.name ?? "run1";
const chunksOnly = args.chunks === "true";
let stitchedPath =
  args.stitched ??
  "/mnt/e/Programmes/Steam/steamapps/common/Noita/mods/noita-mapcap/bin/stitch/output.png";
const tilesDir =
  args.tiles ??
  "/mnt/e/Programmes/Steam/steamapps/common/Noita/mods/noita-mapcap/output";
const [gx0, gx1, gy0, gy1] = (args.grid ?? "-6,12,-3,5").split(",").map(Number);
const [cx0, cx1, cy0, cy1] = [gx0, gx1, gy0, gy1];
const seed = args.seed ? Number(args.seed) : null;

const outDir = path.resolve("mapcap/out", name);
const chunksDir = path.join(outDir, "chunks");
fs.mkdirSync(chunksDir, { recursive: true });

const winW = (cx1 - cx0 + 1) * CHUNK;
const winH = (cy1 - cy0 + 1) * CHUNK;
let ox, oy, W, H, data;

if (chunksOnly) {
  // re-analyze existing chunks (source stitched image may be gone);
  // the window image IS the chunk mosaic, so place chunk (cx0,cy0) at (0,0)
  ox = -cx0 * CHUNK;
  oy = -cy0 * CHUNK;
  W = winW;
  H = winH;
  data = Buffer.alloc(W * H * 4);
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = readPng(path.join(chunksDir, `chunk_${cx}_${cy}.png`));
      const dx = (cx - cx0) * CHUNK,
        dy = (cy - cy0) * CHUNK;
      for (let r = 0; r < CHUNK; r++)
        c.data.copy(data, ((dy + r) * W + dx) * 4, r * CHUNK * 4, (r + 1) * CHUNK * 4);
    }
  stitchedPath = "(existing chunk files)";
  console.log(`loaded ${(cx1 - cx0 + 1) * (cy1 - cy0 + 1)} chunks from ${chunksDir}`);
} else {
  console.log(`decoding ${stitchedPath} ...`);
  ({ width: W, height: H, data } = await readImageRaw(stitchedPath));
  [ox, oy] = (args.origin ?? "3840,2304").split(",").map(Number);
}

// slice window in stitched px
const wx0 = ox + cx0 * CHUNK;
const wy0 = oy + cy0 * CHUNK;
if (wx0 < 0 || wy0 < 0 || wx0 + winW > W || wy0 + winH > H) {
  console.error(
    `window (${wx0},${wy0})+${winW}x${winH} exceeds stitched image ${W}x${H}; check --origin`
  );
  process.exit(1);
}

console.log(`slicing ${cx1 - cx0 + 1}x${cy1 - cy0 + 1} chunks -> ${chunksDir}`);
const winL = new Float32Array(winW * winH); // window luminance
const chunkStats = [];

for (let cy = cy0; cy <= cy1; cy++) {
  for (let cx = cx0; cx <= cx1; cx++) {
    const sx = wx0 + (cx - cx0) * CHUNK;
    const sy = wy0 + (cy - cy0) * CHUNK;
    const rgba = Buffer.alloc(CHUNK * CHUNK * 4);
    for (let r = 0; r < CHUNK; r++) {
      data.copy(
        rgba,
        r * CHUNK * 4,
        ((sy + r) * W + sx) * 4,
        ((sy + r) * W + sx + CHUNK) * 4
      );
    }
    if (!chunksOnly) {
      writePng(path.join(chunksDir, `chunk_${cx}_${cy}.png`), CHUNK, CHUNK, rgba);
    }

    const wyOff = sy - wy0;
    for (let r = 0; r < CHUNK; r++) {
      const dst = (wyOff + r) * winW + (sx - wx0);
      const absRow = sy + r; // absolute row in the stitched image
      for (let c = 0; c < CHUNK; c++) {
        const i = (absRow * W + sx + c) * 4;
        winL[dst + c] =
          0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
    }

    chunkStats.push(analyzeChunk(cx, cy, rgba, winL, sx - wx0, sy - wy0, winW));
  }
  console.log(`  row cy=${cy} done`);
}

if (!chunksOnly) {
  // verify winL matches the source image at absolute coordinates
  let bad = 0;
  for (let t = 0; t < 500; t++) {
    const wr = (Math.random() * winH) | 0,
      wc = (Math.random() * winW) | 0;
    const i = ((wy0 + wr) * W + wx0 + wc) * 4;
    const expect = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (Math.abs(winL[wr * winW + wc] - expect) > 0.01) bad++;
  }
  if (bad) {
    console.error(`winL sanity check FAILED (${bad}/500 mismatches)`);
    process.exit(1);
  }
  console.log("winL sanity check ok");
}

function analyzeChunk(cx, cy, rgba, L, lx, ly, lw) {
  const n = CHUNK * CHUNK;
  let sumL = 0,
    sumL2 = 0,
    nBlack = 0,
    nSky = 0,
    nWater = 0,
    nIce = 0,
    nLava = 0,
    nFlat = 0,
    noiseSum2 = 0;
  const hist = new Map();

  // integral images of L and L^2 for local stats
  const ii = new Float64Array((CHUNK + 1) * (CHUNK + 1));
  const ii2 = new Float64Array((CHUNK + 1) * (CHUNK + 1));
  for (let y = 0; y < CHUNK; y++) {
    let rowS = 0,
      rowS2 = 0;
    for (let x = 0; x < CHUNK; x++) {
      const l = L[(ly + y) * lw + lx + x];
      rowS += l;
      rowS2 += l * l;
      ii[(y + 1) * (CHUNK + 1) + x + 1] = ii[y * (CHUNK + 1) + x + 1] + rowS;
      ii2[(y + 1) * (CHUNK + 1) + x + 1] =
        ii2[y * (CHUNK + 1) + x + 1] + rowS2;
    }
  }
  const R = DETECT.flatWindow;
  const boxAt = (y0, x0, y1, x1, integral) =>
    integral[y1 * (CHUNK + 1) + x1] - integral[y0 * (CHUNK + 1) + x1] -
    integral[y1 * (CHUNK + 1) + x0] + integral[y0 * (CHUNK + 1) + x0];

  for (let y = 0; y < CHUNK; y++) {
    for (let x = 0; x < CHUNK; x++) {
      const i = (y * CHUNK + x) * 4;
      const r = rgba[i],
        g = rgba[i + 1],
        b = rgba[i + 2];
      const l = L[(ly + y) * lw + lx + x];
      sumL += l;
      sumL2 += l * l;
      if (l < DETECT.voidMaxLum) nBlack++;

      const y0 = Math.max(0, y - R),
        x0 = Math.max(0, x - R),
        y1 = Math.min(CHUNK, y + R + 1),
        x1 = Math.min(CHUNK, x + R + 1);
      const cnt = (y1 - y0) * (x1 - x0);
      const mean = boxAt(y0, x0, y1, x1, ii) / cnt;
      const localStd = Math.sqrt(
        Math.max(0, boxAt(y0, x0, y1, x1, ii2) / cnt - mean * mean)
      );

      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      const v = mx;
      const s = mx === 0 ? 0 : (mx - mn) / mx;
      let hue = 0;
      if (mx !== mn) {
        const d = mx - mn;
        if (mx === r) hue = ((g - b) / d) % 6;
        else if (mx === g) hue = (b - r) / d + 2;
        else hue = (r - g) / d + 4;
        hue = (hue * 60 + 360) % 360;
      }

      const sky = DETECT.sky;
      if (
        hue >= sky.hueMin && hue <= sky.hueMax && s <= sky.satMax &&
        v >= sky.valMin && localStd <= sky.flatMax
      ) nSky++;
      const wat = DETECT.water;
      if (
        b - r >= wat.bOverR && b - g >= wat.bOverG &&
        l >= wat.valMin && l <= wat.valMax && localStd <= wat.flatMax
      ) nWater++;
      if (l >= DETECT.ice.valMin && b - r >= DETECT.ice.bOverR) nIce++;
      if (r >= DETECT.lava.rMin && r > g * DETECT.lava.rOverG) nLava++;

      if (localStd <= DETECT.flatStdMax) {
        nFlat++;
        noiseSum2 += (l - mean) * (l - mean);
      }

      const q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      hist.set(q, (hist.get(q) ?? 0) + 1);
    }
  }

  // gradients from window L (1px inset)
  let gradSum = 0,
    nGrad = 0,
    nStrong = 0,
    straight = 0;
  for (let y = 1; y < CHUNK - 1; y++) {
    for (let x = 1; x < CHUNK - 1; x++) {
      const base = (ly + y) * lw + lx + x;
      const gx = L[base + 1] - L[base - 1];
      const gy = L[base + lw] - L[base - lw];
      const mag = Math.hypot(gx, gy);
      gradSum += mag;
      nGrad++;
      if (mag > 30) {
        nStrong++;
        const a = (((Math.atan2(gy, gx) * 180) / Math.PI) % 180 + 180) % 180;
        if (a < 12 || a > 168 || (a > 78 && a < 102)) straight++;
      }
    }
  }

  const meanLum = sumL / n;
  const stdLum = Math.sqrt(Math.max(0, sumL2 / n - meanLum * meanLum));
  const topColors = [...hist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([q, c]) => ({
      rgb: [
        ((q >> 8) & 15) * 16 + 8,
        ((q >> 4) & 15) * 16 + 8,
        (q & 15) * 16 + 8,
      ],
      frac: +(c / n).toFixed(3),
    }));

  const fr = {
    black: nBlack / n,
    sky: nSky / n,
    water: nWater / n,
    ice: nIce / n,
    lava: nLava / n,
    flat: nFlat / n,
  };
  const contentFrac = 1 - fr.black;
  const edgeDensity = gradSum / nGrad / 255;
  const straightFrac = nStrong > 0 ? straight / nStrong : 0;

  let label, conf;
  if (meanLum < 2 && stdLum < 2) {
    label = "void";
    conf = 1;
  } else if (fr.lava >= DOM.lava) {
    label = "lava";
    conf = Math.min(1, fr.lava / 0.4);
  } else if (fr.water >= DOM.water) {
    label = "water";
    conf = Math.min(1, fr.water / 0.5);
  } else if (fr.ice >= DOM.ice) {
    label = "ice";
    conf = Math.min(1, fr.ice / 0.5);
  } else if (fr.sky >= DOM.sky) {
    label = "sky";
    conf = Math.min(1, fr.sky / 0.7);
  } else if (edgeDensity > STRUCT.edgeMin && straightFrac > STRUCT.straightMin) {
    label = "structure";
    conf = Math.min(1, straightFrac / 0.6);
  } else if (contentFrac < 0.02) {
    label = "void";
    conf = 1 - contentFrac;
  } else {
    label = "rock";
    conf = Math.max(0, 1 - Math.max(fr.sky, fr.water, fr.ice, fr.lava) * 2);
  }
  if (label !== "void" && conf < 0.45) label = "mixed";

  return {
    cx,
    cy,
    label,
    conf: +conf.toFixed(2),
    meanLum: +meanLum.toFixed(2),
    stdLum: +stdLum.toFixed(2),
    edgeDensity: +edgeDensity.toFixed(4),
    straightFrac: +straightFrac.toFixed(3),
    frac: {
      black: +fr.black.toFixed(3),
      sky: +fr.sky.toFixed(3),
      water: +fr.water.toFixed(3),
      ice: +fr.ice.toFixed(3),
      lava: +fr.lava.toFixed(3),
      flat: +fr.flat.toFixed(3),
    },
    noiseRms: nFlat > 100 ? +Math.sqrt(noiseSum2 / nFlat).toFixed(3) : null,
    topColors,
  };
}

// --- 1a. raw-tile overlap consistency (true capture stability) ------------
// (skipped in --chunks re-analysis mode: the source tiles may no longer exist)
let pairSummary = null,
  overlapStats = null;
if (!chunksOnly) {
console.log("tile overlap consistency ...");
const tileFiles = fs
  .readdirSync(tilesDir)
  .filter((f) => /^-?\d+,-?\d+\.png$/.test(f))
  .map((f) => f.replace(".png", "").split(",").map(Number));
const tileSet = new Map(tileFiles.map(([x, y]) => [`${x},${y}`, true]));
overlapStats = { h: [], v: [] };

function compareOverlap(fileA, rectA, fileB, rectB, orientation) {
  const A = readPng(path.join(tilesDir, fileA + ".png")).data;
  const B = readPng(path.join(tilesDir, fileB + ".png")).data;
  const [ax, ay, w, h] = rectA;
  const [bx, by] = rectB;
  let sum = 0,
    ident = 0,
    cnt = 0,
    max = 0;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ia = ((ay + r) * 1024 + ax + c) * 4;
      const ib = ((by + r) * 1024 + bx + c) * 4;
      const d =
        Math.abs(A[ia] - B[ib]) +
        Math.abs(A[ia + 1] - B[ib + 1]) +
        Math.abs(A[ia + 2] - B[ib + 2]);
      if (d === 0) ident++;
      if (d > max) max = d;
      sum += d;
      cnt++;
    }
  }
  return { mean: sum / cnt / 3, identPct: (100 * ident) / cnt, max };
}

for (const [x, y] of tileFiles) {
  if (tileSet.has(`${x + 512},${y}`)) {
    overlapStats.h.push({
      at: [x, y],
      ...compareOverlap(
        `${x},${y}`, [512, 0, 512, 1024],
        `${x + 512},${y}`, [0, 0, 512, 1024]
      ),
    });
  }
  if (tileSet.has(`${x},${y + 512}`)) {
    overlapStats.v.push({
      at: [x, y],
      ...compareOverlap(
        `${x},${y}`, [0, 512, 512, 512],
        `${x},${y + 512}`, [0, 0, 512, 512]
      ),
    });
  }
}
const allPairs = [...overlapStats.h, ...overlapStats.v];
pairSummary = {
  pairs: allPairs.length,
  meanDiff: +(allPairs.reduce((s, p) => s + p.mean, 0) / allPairs.length).toFixed(4),
  identPct: +(allPairs.reduce((s, p) => s + p.identPct, 0) / allPairs.length).toFixed(3),
  maxDiff: Math.max(...allPairs.map((p) => p.max)),
  worstPairs: allPairs.sort((a, b) => b.mean - a.mean).slice(0, 5),
};
}

// --- 1b. stitched-grid seam analysis --------------------------------------
console.log("seam analysis ...");
function colDiff(x1, x2) {
  let s = 0;
  for (let y = 0; y < winH; y++)
    s += Math.abs(winL[y * winW + x1] - winL[y * winW + x2]);
  return s / winH;
}
function rowDiff(y1, y2) {
  let s = 0;
  for (let x = 0; x < winW; x++)
    s += Math.abs(winL[y1 * winW + x] - winL[y2 * winW + x]);
  return s / winW;
}
function seamShift(diffFn, seamCoord) {
  // compare the row/col before the seam with rows/cols at offsets;
  // sh=-1 would compare the line with itself (always 0) and is excluded
  let best = { shift: 0, diff: Infinity };
  const scores = [];
  for (const sh of [-2, 0, 1, 2, 3]) {
    const d = diffFn(seamCoord - 1, seamCoord + sh);
    scores.push({ shift: sh, diff: +d.toFixed(2) });
    if (d < best.diff) best = { shift: sh, diff: d };
  }
  return { best, scores };
}

const seams = { vertical: [], horizontal: [] };
let baseSum = 0,
  baseN = 0;
for (let k = 1; k < cx1 - cx0 + 1; k++) {
  const sxv = k * CHUNK;
  const d = colDiff(sxv - 1, sxv);
  const bl = [
    colDiff(sxv - 3, sxv - 4), colDiff(sxv - 6, sxv - 7),
    colDiff(sxv + 2, sxv + 3), colDiff(sxv + 5, sxv + 6),
  ].sort((a, b) => a - b);
  const baseline = (bl[1] + bl[2]) / 2;
  baseSum += baseline;
  baseN++;
  const { best, scores } = seamShift(colDiff, sxv);
  seams.vertical.push({
    atWorldX: (cx0 + k) * CHUNK,
    diff: +d.toFixed(3),
    baseline: +baseline.toFixed(3),
    ratio: +(d / baseline).toFixed(3),
    shift: best.shift,
    shiftScores: scores,
  });
}
for (let k = 1; k < cy1 - cy0 + 1; k++) {
  const syh = k * CHUNK;
  const d = rowDiff(syh - 1, syh);
  const bl = [
    rowDiff(syh - 3, syh - 4), rowDiff(syh - 6, syh - 7),
    rowDiff(syh + 2, syh + 3), rowDiff(syh + 5, syh + 6),
  ].sort((a, b) => a - b);
  const baseline = (bl[1] + bl[2]) / 2;
  baseSum += baseline;
  baseN++;
  const { best, scores } = seamShift(rowDiff, syh);
  seams.horizontal.push({
    atWorldY: (cy0 + k) * CHUNK,
    diff: +d.toFixed(3),
    baseline: +baseline.toFixed(3),
    ratio: +(d / baseline).toFixed(3),
    shift: best.shift,
    shiftScores: scores,
  });
}
seams.globalBaseline = +(baseSum / baseN).toFixed(3);

// --- outputs ----------------------------------------------------------------
const manifest = {
  name,
  seed,
  source: stitchedPath,
  tilesDir,
  stitchedSize: [W, H],
  origin: chunksOnly ? null : [ox, oy],
  grid: { cx: [cx0, cx1], cy: [cy0, cy1], chunk: CHUNK },
  worldRect: [cx0 * CHUNK, cy0 * CHUNK, (cx1 + 1) * CHUNK, (cy1 + 1) * CHUNK],
  chunks: chunkStats.length,
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);

const vRatios = seams.vertical.map((s) => s.ratio);
const hRatios = seams.horizontal.map((s) => s.ratio);
const badSeams = [...seams.vertical, ...seams.horizontal].filter(
  (s) => s.ratio > 1.5
);
const noiseVals = chunkStats.map((c) => c.noiseRms ?? 0);
const sortedNoise = [...noiseVals].sort((a, b) => a - b);
const noiseMedian = sortedNoise[Math.floor(sortedNoise.length / 2)];
const labelCounts = {};
for (const c of chunkStats) labelCounts[c.label] = (labelCounts[c.label] ?? 0) + 1;

fs.writeFileSync(
  path.join(outDir, "analysis.json"),
  JSON.stringify({ tileOverlap: pairSummary, seams, chunks: chunkStats }, null, 2)
);

// classification overview PNG (1 cell per chunk)
const gw = cx1 - cx0 + 1,
  gh = cy1 - cy0 + 1;
const ov = Buffer.alloc(gw * gh * 4);
for (const c of chunkStats) {
  const i = ((c.cy - cy0) * gw + (c.cx - cx0)) * 4;
  const col = LABEL_COLORS[c.label] ?? [128, 128, 128];
  const v = 90 + 140 * c.conf;
  ov[i] = (col[0] * v) / 255;
  ov[i + 1] = (col[1] * v) / 255;
  ov[i + 2] = (col[2] * v) / 255;
  ov[i + 3] = 255;
}
writePng(path.join(outDir, "classification.png"), gw, gh, ov);

const maxNoise = Math.max(...noiseVals, 0.01);
const nh = Buffer.alloc(gw * gh * 4);
for (const c of chunkStats) {
  const i = ((c.cy - cy0) * gw + (c.cx - cx0)) * 4;
  const t = (c.noiseRms ?? 0) / maxNoise;
  nh[i] = 255 * Math.min(1, 2 * t);
  nh[i + 1] = 255 * Math.min(1, 2 * (1 - t));
  nh[i + 2] = 40;
  nh[i + 3] = 255;
}
writePng(path.join(outDir, "noise-heatmap.png"), gw, gh, nh);

const worstChunks = [...chunkStats]
  .sort((a, b) => (b.noiseRms ?? 0) - (a.noiseRms ?? 0))
  .slice(0, 10)
  .map((c) => `  chunk_${c.cx}_${c.cy} noiseRms=${c.noiseRms} label=${c.label}`);

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

const report = `# mapcap analysis — ${name}

- source: \`${stitchedPath}\` (${W}x${H}), origin ${ox},${oy}
- world rect: ${manifest.worldRect.join(", ")}  seed: ${seed ?? "?"}
- chunks: ${chunkStats.length} (${gw}x${gh})

## Capture stability (raw tile overlap consistency)
Adjacent tiles overlap by 512px; identical rendering => identical overlap pixels.
${pairSummary ? `- pairs checked: ${pairSummary.pairs} (h: ${overlapStats.h.length}, v: ${overlapStats.v.length})
- mean per-channel diff: ${pairSummary.meanDiff} (0 = pixel-identical)
- identical pixels: ${pairSummary.identPct}%
- max channel diff seen: ${pairSummary.maxDiff}
- worst pairs: ${JSON.stringify(pairSummary.worstPairs)}` : "- (skipped in re-analysis mode — see original run report)"}

## Skeleton test (512px grid seams in stitched image)
- global interior baseline diff: ${seams.globalBaseline}
- vertical seams: median ratio ${median(vRatios).toFixed(2)}, max ${Math.max(...vRatios).toFixed(2)}
- horizontal seams: median ratio ${median(hRatios).toFixed(2)}, max ${Math.max(...hRatios).toFixed(2)}
- seams with ratio>1.5: ${badSeams.length}
${badSeams.map((s) => `- ${JSON.stringify(s)}`).join("\n")}
- NOTE: if tile overlaps are identical, grid seams are real world-generation
  content (material/structure seams at wang-chunk boundaries), not stitch artifacts.

## Known capture caveats
- Parallax background (sky bands, mountain silhouettes) is camera-dependent:
  overlapping tiles DISAGREE there, and the stitcher median-blends it into a
  ghost layer. Only world-anchored foreground is pixel-stable — exclude
  background from any cross-run/mapgen comparison.
- The mod bakes a seed/build debug text overlay into every tile at a fixed
  screen offset. Median blending removes it in overlap zones, but single-
  coverage tiles (capture edges) keep it.
- Vegetation (trees) sways between tile captures -> small scattered diffs.

## Noise floor (flat-region high-pass RMS, 0-255 scale)
- median ${noiseMedian}, p90 ${sortedNoise[Math.floor(sortedNoise.length * 0.9)]}, max ${Math.max(...noiseVals)}
- worst chunks:
${worstChunks.join("\n")}

## Region map
- counts: ${JSON.stringify(labelCounts)}
- overview: classification.png (1 cell per chunk), noise-heatmap.png

## Per-chunk table (label / conf / meanLum / stdLum / edge / straight / noise)
${chunkStats
  .map(
    (c) =>
      `chunk_${c.cx}_${c.cy}: ${c.label} ${c.conf} ${c.meanLum} ${c.stdLum} ${c.edgeDensity} ${c.straightFrac} ${c.noiseRms}`
  )
  .join("\n")}
`;
fs.writeFileSync(path.join(outDir, "report.md"), report);

console.log(`\ndone -> ${outDir}`);
if (pairSummary) console.log(`tile overlap: ${pairSummary.pairs} pairs, mean diff ${pairSummary.meanDiff}, identical ${pairSummary.identPct}%`);
console.log(`seam ratios: v-median ${median(vRatios).toFixed(2)} h-median ${median(hRatios).toFixed(2)}, flagged: ${badSeams.length}`);
console.log(`noise floor median: ${noiseMedian}`);
console.log(`labels: ${JSON.stringify(labelCounts)}`);
