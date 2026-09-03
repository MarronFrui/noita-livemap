// Generate wang-layer chunks for a seed: biome-map pixel window -> PNGs in out/gen/.
// Usage: node mapgen/render.mjs [--seed N] [--x0 N --x1 N --y0 N --y1 N] [--out dir]

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, CAPTURE_SEED } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { loadWang } from "../lib/wang-wasm.mjs";
import { chunkToBigMapRect } from "../lib/coords.mjs";
import { readPng, writePng } from "../lib/images.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const seed = Number(arg("seed", CAPTURE_SEED)) >>> 0;
const x0 = Number(arg("x0", 30));
const x1 = Number(arg("x1", 45));
const y0 = Number(arg("y0", 12));
const y1 = Number(arg("y1", 17));
const outDir = arg("out", "mapgen/out/gen");

const dataDir = findNoitaDataDir();
console.log(`data: ${dataDir}`);
console.log(`seed: ${seed}, window: x ${x0}..${x1}, y ${y0}..${y1}`);

const config = loadBiomeConfig(dataDir);
const wang = await loadWang();

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

// One generation per (biome color, area); areas are shared by all their chunks
const areaCache = new Map();
const getArea = (entry) => {
  const key = `${entry.color}:${entry.area.x1},${entry.area.y1}`;
  if (!areaCache.has(key)) {
    const started = Date.now();
    const result = wang.generateArea({
      seed,
      color: entry.color,
      area: entry.area,
      atlasPngBytes: getAtlas(entry.biome.templateFile),
      isCoalMine: entry.biome.isCoalMine,
      shouldBlockOutRooms: entry.biome.shouldBlockOutRooms,
      randomMaterials: entry.biome.randomMaterials,
    });
    console.log(
      `generated ${entry.biome.name} area [${entry.area.x1},${entry.area.y1}..${entry.area.x2},${entry.area.y2}] (${result.bigWidth}x${result.bigHeight}) in ${Date.now() - started}ms`
    );
    areaCache.set(key, result);
  }
  return areaCache.get(key);
};

fs.mkdirSync(outDir, { recursive: true });
const manifest = { seed, window: { x0, x1, y0, y1 }, chunks: {} };

for (let ty = y0; ty <= y1; ty++) {
  for (let tx = x0; tx <= x1; tx++) {
    const entry = biomeAt(config, tx, ty);
    if (!entry) {
      manifest.chunks[`${tx}_${ty}`] = { biome: null };
      continue;
    }

    const big = getArea(entry);
    const { bx, by } = chunkToBigMapRect(wang, big, entry.area, tx, ty);

    const chunk = Buffer.alloc(512 * 512 * 4);
    const sx0 = Math.max(0, bx);
    const sy0 = Math.max(0, by);
    const sx1 = Math.min(big.bigWidth, bx + 512);
    const sy1 = Math.min(big.bigHeight, by + 512);
    for (let y = sy0; y < sy1; y++) {
      const srcStart = 4 * (y * big.bigWidth + sx0);
      const dstStart = 4 * ((y - by) * 512 + (sx0 - bx));
      Buffer.from(big.bigMap.buffer, big.bigMap.byteOffset + srcStart, 4 * (sx1 - sx0)).copy(
        chunk,
        dstStart
      );
    }

    const file = `${tx}_${ty}.png`;
    writePng(path.join(outDir, file), 512, 512, chunk);
    manifest.chunks[`${tx}_${ty}`] = {
      biome: entry.biome.name,
      area: entry.area,
      crop: { bx, by },
      worldX: big.worldX,
      worldY: big.worldY,
    };
  }
}

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`wrote ${Object.keys(manifest.chunks).length} chunk entries to ${outDir}`);
