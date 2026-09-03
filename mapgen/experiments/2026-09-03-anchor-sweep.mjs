// Sweep the anchor/phase hypotheses: crop each window chunk from the
// (content-invariant) bigMaps under every (mode, phaseX, phaseY) combination
// and score zero-shift air/solid agreement against the capture.
//
// Content generation runs ONCE; only the crop mapping changes per combo.
//
// Usage: node mapgen/sweep.mjs [--x0 N --x1 N --y0 N --y1 N] [--seed N]

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, CAPTURE_SEED } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { loadWang } from "../lib/wang-wasm.mjs";
import { ANCHOR, chunkToBigMapRect, CHUNK } from "../lib/coords.mjs";
import { readPng } from "../lib/images.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const seed = Number(arg("seed", CAPTURE_SEED)) >>> 0;
const x0 = Number(arg("x0", 30));
const x1 = Number(arg("x1", 45));
const y0 = Number(arg("y0", 12));
const y1 = Number(arg("y1", 17));

const GRID = 128;

function solidMask(png) {
  const g = new Uint8Array(GRID * GRID);
  const stepPx = png.width / GRID;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      let solid = 0;
      let count = 0;
      for (let sy = Math.floor(y * stepPx); sy < Math.floor((y + 1) * stepPx); sy += 2) {
        for (let sx = Math.floor(x * stepPx); sx < Math.floor((x + 1) * stepPx); sx += 2) {
          const i = 4 * (sy * png.width + sx);
          const lum =
            0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
          if (lum >= 24) solid++;
          count++;
        }
      }
      g[y * GRID + x] = count > 0 && solid / count >= 0.5 ? 1 : 0;
    }
  }
  return g;
}

function agreement(a, b) {
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const wang = await loadWang();

// --- generate content once per area (content does NOT depend on the crop) ---
const atlasCache = new Map();
const getAtlas = (templateFile) => {
  if (!atlasCache.has(templateFile)) {
    atlasCache.set(
      templateFile,
      fs.readFileSync(path.join(dataDir, templateFile.replace(/^data\//, "")))
    );
  }
  return atlasCache.get(templateFile);
};

const areaCache = new Map();
const getArea = (entry) => {
  const key = `${entry.color}:${entry.area.x1},${entry.area.y1}`;
  if (!areaCache.has(key)) {
    areaCache.set(
      key,
      wang.generateArea({
        seed,
        color: entry.color,
        area: entry.area,
        atlasPngBytes: getAtlas(entry.biome.templateFile),
        isCoalMine: entry.biome.isCoalMine,
        shouldBlockOutRooms: entry.biome.shouldBlockOutRooms,
        randomMaterials: entry.biome.randomMaterials,
      })
    );
  }
  return areaCache.get(key);
};

// --- reference masks (captured chunks) ---
const refDir = "mapgen/out/ref";
const chunks = [];
for (let ty = y0; ty <= y1; ty++) {
  for (let tx = x0; tx <= x1; tx++) {
    const refPath = path.join(refDir, `${tx}_${ty}.png`);
    if (!fs.existsSync(refPath)) continue;
    const entry = biomeAt(config, tx, ty);
    if (!entry) continue;
    chunks.push({
      tx,
      ty,
      entry,
      refMask: solidMask(readPng(refPath)),
    });
  }
}
console.log(`${chunks.length} chunks in scope`);

function cropMask(big, area, tx, ty) {
  const { bx, by } = chunkToBigMapRect(wang, big, area, tx, ty);
  const rgba = Buffer.alloc(CHUNK * CHUNK * 4);
  const sx0 = Math.max(0, bx);
  const sy0 = Math.max(0, by);
  const sx1 = Math.min(big.bigWidth, bx + CHUNK);
  const sy1 = Math.min(big.bigHeight, by + CHUNK);
  for (let y = sy0; y < sy1; y++) {
    const srcStart = 4 * (y * big.bigWidth + sx0);
    const dstStart = 4 * ((y - by) * CHUNK + (sx0 - bx));
    Buffer.from(big.bigMap.buffer, big.bigMap.byteOffset + srcStart, 4 * (sx1 - sx0)).copy(
      rgba,
      dstStart
    );
  }
  return solidMask({ width: CHUNK, data: rgba });
}

// --- sweep ---
const modes = ["noitool", "snap", "exact"];
const results = [];
for (const mode of modes) {
  const phases =
    mode === "snap"
      ? [...Array(10).keys()]
      : [0];
  for (const phaseX of phases) {
    for (const phaseY of phases) {
      ANCHOR.mode = mode;
      ANCHOR.phaseX = phaseX;
      ANCHOR.phaseY = phaseY;

      let sum = 0;
      for (const c of chunks) {
        const big = getArea(c.entry);
        const m = cropMask(big, c.entry.area, c.tx, c.ty);
        sum += agreement(m, c.refMask);
      }
      const score = sum / chunks.length;
      results.push({ mode, phaseX, phaseY, score });
    }
  }
}

results.sort((a, b) => b.score - a.score);
console.log("\ntop 12 combos (zero-shift air/solid agreement):");
for (const r of results.slice(0, 12)) {
  console.log(
    `${r.mode.padEnd(8)} phaseX=${r.phaseX} phaseY=${r.phaseY}  ${(r.score * 100).toFixed(1)}%`
  );
}
const baseline = results.find((r) => r.mode === "noitool");
console.log(`\nbaseline (noitool crop): ${(baseline.score * 100).toFixed(1)}%`);
console.log(`best vs baseline: +${((results[0].score - baseline.score) * 100).toFixed(1)} pts`);
