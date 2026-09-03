// Experiment: is the game's wang fill position-seeded (chunk-order-independent)
// rather than sequential-stream like noitool's port?
//
// Step 1 (validation): our JS port in 'seq' mode vs the actual wasm output —
//         they should match unless noitool's hasPath rejection re-rolled.
// Step 2 (hypothesis): 'pos' mode — every vertex colored by
//         SetRandomSeed(worldSeed, worldX, worldY) at the vertex's world pos —
//         scored against the capture.
//
// Usage: node mapgen/wangtest.mjs

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, CAPTURE_SEED } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { loadWang } from "../lib/wang-wasm.mjs";
import { readPng } from "../lib/images.mjs";
import { NollaPrng, buildTileset, generateCorner, makePositionalSource } from "../lib/wang-js.mjs";
import { worldOfBiomePx, OFFSET_X, OFFSET_Y } from "../lib/coords.mjs";

const GRID = 128;
function solidMaskFromRgb(rgb, w, h) {
  // rgb: Buffer of w*h*3 (black = air)
  const g = new Uint8Array(GRID * GRID);
  const step = w / GRID;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      let solid = 0;
      let count = 0;
      for (let sy = Math.floor(y * step); sy < Math.floor((y + 1) * step); sy += 2)
        for (let sx = Math.floor(x * step); sx < Math.floor((x + 1) * step); sx += 2) {
          const i = 3 * (sy * w + sx);
          const lum = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
          if (lum >= 24) solid++;
          count++;
        }
      g[y * GRID + x] = count > 0 && solid / count >= 0.5 ? 1 : 0;
    }
  return g;
}
function solidMaskFromRgba(rgba, w) {
  const rgb = Buffer.alloc(w * w * 3);
  for (let i = 0; i < w * w; i++) {
    rgb[3 * i] = rgba[4 * i];
    rgb[3 * i + 1] = rgba[4 * i + 1];
    rgb[3 * i + 2] = rgba[4 * i + 2];
  }
  return solidMaskFromRgb(rgb, w, w);
}
const agreement = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) s++;
  return s / a.length;
};

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const wang = await loadWang();
const posRng = makePositionalSource(CAPTURE_SEED);

async function runBiome(tx, ty) {
  const entry = biomeAt(config, tx, ty);
  const atlasPng = readPng(path.join(dataDir, entry.biome.templateFile.replace(/^data\//, "")));
  const ts = buildTileset(atlasPng);
  const { area } = entry;

  const wCells = wang.wasm.GetWidthFromPixRaw(area.x1, area.x2 + 1);
  const hCells = wang.wasm.GetWidthFromPixRaw(area.y1, area.y2 + 1);

  console.log(
    `\n=== ${entry.biome.name} @${area.x1},${area.y1} (${wCells}x${hCells} cells, ` +
      `${ts.hTiles.length}h+${ts.vTiles.length}v tiles, short=${ts.shortSideLen}, colors=[${ts.numColor}]) ===`
  );

  // --- wasm reference ---
  const wasm = wang.generateArea({
    seed: CAPTURE_SEED,
    color: entry.color,
    area,
    atlasPngBytes: fs.readFileSync(path.join(dataDir, entry.biome.templateFile.replace(/^data\//, ""))),
    isCoalMine: entry.biome.isCoalMine,
    shouldBlockOutRooms: entry.biome.shouldBlockOutRooms,
    randomMaterials: entry.biome.randomMaterials,
  });

  // --- JS port, sequential mode (noitool model, single attempt) ---
  const rng = new NollaPrng(0);
  rng.setRandomFromWorldSeed(CAPTURE_SEED >>> 0);
  rng.next();
  let iters = wCells + (CAPTURE_SEED >>> 0) + 11 * -truncDiv(wCells, 11) - 12 * truncDiv(CAPTURE_SEED, 12);
  while (iters > 0) {
    rng.next();
    iters--;
  }
  const attemptRng = new NollaPrng(rng.nextU());

  const jsSeq = generateCorner(
    ts,
    wCells,
    hCells + 4,
    (i, j, p) => attemptRng.nextU() % ts.numColor[p],
    (i, j, n) => attemptRng.nextU() % n,
    (i, j, p, old) => {
      const off = 1 + (attemptRng.nextU() % (ts.numColor[p] - 1));
      return (old + off) % ts.numColor[p];
    }
  );
  // drop the top 4 rows (noitool's memcpy skip)
  const seqRows = jsSeq.rgb.subarray(3 * wCells * 4 * 3);

  // compare with wasm raw map (cell colors)
  let diffPx = 0;
  const n = wCells * hCells;
  for (let p = 0; p < n; p++) {
    if (
      seqRows[3 * p] !== wasm.map[4 * p] ||
      seqRows[3 * p + 1] !== wasm.map[4 * p + 1] ||
      seqRows[3 * p + 2] !== wasm.map[4 * p + 2]
    ) {
      diffPx++;
    }
  }
  console.log(`JS-seq vs wasm: ${(100 * (1 - diffPx / n)).toFixed(2)}% identical cells (${diffPx} differ)`);

  // --- positional mode vs capture ---
  const s = ts.shortSideLen;
  // world px of output pixel (0,0): the area's world origin (noitool crop anchor)
  const wx0 = worldOfBiomePx(area.x1, OFFSET_X);
  const wy0 = worldOfBiomePx(area.y1, OFFSET_Y);
  const worldX = (i) => wx0 + (i - 2) * s * 10;
  const worldY = (j) => wy0 + (j - 2) * s * 10;

  const jsPos = generateCorner(
    ts,
    wCells,
    hCells + 4,
    (i, j, p) => posRng(worldX(i), worldY(j), 0, ts.numColor[p] - 1),
    (i, j, n) => posRng(worldX(i), worldY(j), 0, n - 1),
    null
  );

  // crop chunk (tx,ty) from a cell-grid result: chunk top-left = cells between
  // area origin and this biome px (noitool formula) — content-level comparison
  const cropAndScore = (res) => {
    const mask = solidMaskFromRgb(res.rgb, res.width, res.height);
    // the ref is a 512x512 chunk = 51.2 cells; compare the overlapping window:
    // chunk starts at world (tx-x1)*512 -> cell index floor(((tx-x1)*512)/10)
    const cx = Math.floor(((tx - area.x1) * 512) / 10);
    const cy = Math.floor(((ty - area.y1) * 512) / 10);
    // sample GRID over 512 world px starting at that cell
    const g = new Uint8Array(GRID * GRID);
    const stepW = 512 / GRID; // world px per sample
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        const wxp = Math.floor(cx * 10 + x * stepW);
        const wyp = Math.floor(cy * 10 + y * stepW);
        const gx = Math.min(res.width - 1, Math.floor(wxp / 10));
        const gy = Math.min(res.height - 1, Math.floor(wyp / 10));
        const i = 3 * (gy * res.width + gx);
        const lum = 0.2126 * res.rgb[i] + 0.7152 * res.rgb[i + 1] + 0.0722 * res.rgb[i + 2];
        g[y * GRID + x] = lum >= 24 ? 1 : 0;
      }
    return g;
  };

  const refPath = `mapgen/out/ref/${tx}_${ty}.png`;
  if (fs.existsSync(refPath)) {
    const refMask = solidMaskFromRgba(readPng(refPath).data, 512);
    const seqScore = agreement(solidMaskFromRgba(wasm.bigMapCrop ? wasm.bigMapCrop : wasm.bigMap.subarray(0, 0), 1), refMask);
    // score wasm crop with the same sampling
    const wasmScore = agreement(
      cropSample(wasm.bigMap, wasm.bigWidth, area, tx, ty),
      refMask
    );
    const posScore = agreement(cropAndScore(jsPos), refMask);
    console.log(`vs capture: wasm=${(wasmScore * 100).toFixed(1)}%  js-seq~wasm  js-pos=${(posScore * 100).toFixed(1)}%`);
  }
}

function truncDiv(a, b) {
  return Math.trunc(a / b);
}

// sample the wasm bigMap like cropAndScore samples the JS result
function cropSample(bigMap, bigWidth, area, tx, ty) {
  const g = new Uint8Array(GRID * GRID);
  const cx = Math.floor(((tx - area.x1) * 512) / 10);
  const cy = Math.floor(((ty - area.y1) * 512) / 10);
  const stepW = 512 / GRID;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const gx = Math.min(bigWidth - 1, cx + Math.floor((x * stepW) / 10));
      const gy = Math.min(1e9, cy + Math.floor((y * stepW) / 10));
      const i = 4 * (gy * bigWidth + gx);
      const lum = 0.2126 * bigMap[i] + 0.7152 * bigMap[i + 1] + 0.0722 * bigMap[i + 2];
      g[y * GRID + x] = lum >= 24 ? 1 : 0;
    }
  return g;
}

await runBiome(30, 15); // liquidcave (no special flags) — clean port validation
await runBiome(35, 15); // spawn Mines (coalmine flags + randomMaterials)
