// Positional-lattice sweep: vertex colors = SetRandomSeed(worldSeed, worldX, worldY)
// at each vertex's world position; tile choice is uniquely determined by the
// 6 corner colors (verified: constraint combos == tile count for our tilesets).
//
// Swept: lattice anchor offset (world px steps) x RNG call shape.
// Judged against the capture (air/solid agreement).
//
// Usage: node mapgen/possweep.mjs [--x0 N --x1 N --y0 N --y1 N]

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, CAPTURE_SEED } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { loadWang } from "../lib/wang-wasm.mjs";
import { readPng } from "../lib/images.mjs";
import { buildTileset, generateCorner, seededPrng } from "../lib/wang-js.mjs";
import { worldOfBiomePx, OFFSET_X, OFFSET_Y } from "../lib/coords.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? Number(process.argv[i + 1]) : fallback;
}
const x0 = arg("x0", 30), x1 = arg("x1", 45), y0 = arg("y0", 12), y1 = arg("y1", 17);

const GRID = 128;
const agreement = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) s++;
  return s / a.length;
};

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);

// --- precompute per-chunk reference masks ---
const chunks = [];
for (let ty = y0; ty <= y1; ty++)
  for (let tx = x0; tx <= x1; tx++) {
    const refPath = `mapgen/out/ref/${tx}_${ty}.png`;
    if (!fs.existsSync(refPath)) continue;
    const entry = biomeAt(config, tx, ty);
    if (!entry) continue;
    const refPng = readPng(refPath);
    const mask = new Uint8Array(GRID * GRID);
    const step = 512 / GRID;
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        let solid = 0, count = 0;
        for (let sy = Math.floor(y * step); sy < Math.floor((y + 1) * step); sy += 2)
          for (let sx = Math.floor(x * step); sx < Math.floor((x + 1) * step); sx += 2) {
            const i = 4 * (sy * 512 + sx);
            const lum = 0.2126 * refPng.data[i] + 0.7152 * refPng.data[i + 1] + 0.0722 * refPng.data[i + 2];
            if (lum >= 24) solid++;
            count++;
          }
        mask[y * GRID + x] = count > 0 && solid / count >= 0.5 ? 1 : 0;
      }
    chunks.push({ tx, ty, entry, refMask: mask });
  }

// tilesets cache
const tilesetCache = new Map();
const getTs = (entry) => {
  if (!tilesetCache.has(entry.color)) {
    const png = readPng(path.join(dataDir, entry.biome.templateFile.replace(/^data\//, "")));
    tilesetCache.set(entry.color, buildTileset(png));
  }
  return tilesetCache.get(entry.color);
};

// --- generate one area under a given lattice anchor ---
function generateAreaPositional(entry, ax, ay, callShape) {
  const ts = getTs(entry);
  const s = ts.shortSideLen;
  const { area } = entry;
  const wCells = Math.floor(((area.x2 + 1 - area.x1) * 512) / 10);
  const hCells = Math.floor(((area.y2 + 1 - area.y1) * 512) / 10);

  // vertex (i,j) -> world px; lattice anchor (ax, ay) = world pos of vertex (2,2)
  const worldX = (i) => ax + (i - 2) * s * 10;
  const worldY = (j) => ay + (j - 2) * s * 10;

  let colorSource, choiceSource;
  if (callShape === "random-pct") {
    colorSource = (i, j, p) => seededPrng(CAPTURE_SEED, worldX(i), worldY(j)).random(0, ts.numColor[p] - 1);
    choiceSource = (i, j, n) => seededPrng(CAPTURE_SEED, worldX(i), worldY(j)).random(0, n - 1);
  } else if (callShape === "nextu-mod") {
    colorSource = (i, j, p) => seededPrng(CAPTURE_SEED, worldX(i), worldY(j)).nextU() % ts.numColor[p];
    choiceSource = (i, j, n) => seededPrng(CAPTURE_SEED, worldX(i), worldY(j)).nextU() % n;
  } else {
    // 'x-swap': the game often calls SetRandomSeed(y, x)? test swapped coords
    colorSource = (i, j, p) => seededPrng(CAPTURE_SEED, worldY(j), worldX(i)).random(0, ts.numColor[p] - 1);
    choiceSource = (i, j, n) => seededPrng(CAPTURE_SEED, worldY(j), worldX(i)).random(0, n - 1);
  }

  return generateCorner(ts, wCells, hCells, colorSource, choiceSource, null);
}

// sample a cell-scale result at a chunk window, matching the ref sampling
function sampleChunk(res, area, tx, ty) {
  const g = new Uint8Array(GRID * GRID);
  const stepW = 512 / GRID; // world px per sample
  // chunk top-left in world px relative to area origin
  const bxW = (tx - area.x1) * 512;
  const byW = (ty - area.y1) * 512;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      // world px of sample relative to result pixel grid (1 result px = 10 world px)
      const gx = Math.min(res.width - 1, Math.floor((bxW + x * stepW) / 10));
      const gy = Math.min(res.height - 1, Math.floor((byW + y * stepW) / 10));
      const i = 3 * (gy * res.width + gx);
      const lum = 0.2126 * res.rgb[i] + 0.7152 * res.rgb[i + 1] + 0.0722 * res.rgb[i + 2];
      g[y * GRID + x] = lum >= 24 ? 1 : 0;
    }
  return g;
}

// --- sweep ---
const modes = ["random-pct", "nextu-mod", "x-swap"];
const results = [];
const wx0 = worldOfBiomePx(34, OFFSET_X); // area origins differ per area; anchor is per-area
const wy0 = worldOfBiomePx(14, OFFSET_Y);

for (const callShape of modes) {
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      // anchor offset in world px, stepped by one vertex lattice unit later;
      // here step by 10 world px (one cell) across +-2 vertex steps
      const offX = dx * 10;
      const offY = dy * 10;
      let sum = 0;
      let count = 0;
      const areaAnchors = new Map();
      for (const c of chunks) {
        const key = `${c.entry.color}:${c.entry.area.x1},${c.entry.area.y1}`;
        if (!areaAnchors.has(key)) {
          const ax = worldOfBiomePx(c.entry.area.x1, OFFSET_X) + offX;
          const ay = worldOfBiomePx(c.entry.area.y1, OFFSET_Y) + offY;
          areaAnchors.set(key, generateAreaPositional(c.entry, ax, ay, callShape));
        }
        const res = areaAnchors.get(key);
        sum += agreement(sampleChunk(res, c.entry.area, c.tx, c.ty), c.refMask);
        count++;
      }
      results.push({ callShape, dx, dy, score: sum / count });
    }
  }
}

results.sort((a, b) => b.score - a.score);
console.log(`scored ${results.length} combos over ${chunks.length} chunks`);
console.log("\ntop 10:");
for (const r of results.slice(0, 10))
  console.log(`${r.callShape.padEnd(11)} dx=${r.dx} dy=${r.dy}  ${(r.score * 100).toFixed(1)}%`);
const worst = results[results.length - 1];
console.log(`\nworst: ${worst.callShape} dx=${worst.dx} dy=${worst.dy} ${(worst.score * 100).toFixed(1)}%`);
