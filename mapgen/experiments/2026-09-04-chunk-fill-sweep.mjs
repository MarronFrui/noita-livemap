// Chunk-sequential fill test: the game seeds once per chunk (at its origin?),
// then fills that chunk's wang lattice sequentially from that stream.
//
// Stream source: v4 probe dump (8x Random(0,255) anchors + 4088x Randomf per
// chunk origin). Draws 1..8 are 8-bit quantized but exact for cc<=3 ranges
// (except 2/256 boundary cases for cc=3, treated as wildcards); draws 9+ are
// full-precision floats.
//
// Variants: tile-choice draws on/off x draw-for-cc1-vertices on/off x +4-row
// discard on/off. Scored against the same-seed capture (air/solid).
//
// Usage: node mapgen/experiments/2026-09-04-chunk-fill-sweep.mjs

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, CAPTURE_SEED } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { readPng } from "../lib/images.mjs";
import { buildTileset, generateCorner } from "../lib/wang-js.mjs";

const GRID = 128;
const agreement = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) s++;
  return s / a.length;
};

const dataDir = findNoitaDataDir();
const save00 = path.join(dataDir, "..", "save00");
const csvPath = path.join(save00, `noita-rng-probe4-sequences-${CAPTURE_SEED}.csv`);
if (!fs.existsSync(csvPath)) {
  console.log(`no v4 dump at ${csvPath} — run the game (seed ${CAPTURE_SEED}) with the probe mod`);
  process.exit(0);
}

// --- load streams ---
const streams = new Map(); // "ox,oy" -> { anchors: int[8], floats: float[4088] }
{
  const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n").slice(1);
  for (const line of lines) {
    const cells = line.split(",");
    const ox = Number(cells[0]);
    const oy = Number(cells[1]);
    streams.set(`${ox},${oy}`, {
      anchors: cells.slice(2, 10).map(Number),
      floats: cells.slice(10).map(Number),
    });
  }
}
console.log(`v4 streams: ${streams.size} chunk origins`);

// --- validate anchors against our verified RNG ---
{
  const { seededPrng } = await import("../lib/wang-js.mjs");
  let cells = 0, ok = 0;
  for (const [key, s] of streams) {
    const [ox, oy] = key.split(",").map(Number);
    const rng = seededPrng(CAPTURE_SEED, ox, oy);
    for (let k = 0; k < 8; k++) {
      cells++;
      if (rng.random(0, 255) === s.anchors[k]) ok++;
    }
  }
  console.log(`anchor validation: ${(100 * ok / cells).toFixed(2)}% (${cells} draws)`);
}

// --- stream adapter: successive draws, exact for cc<=3 ---
function makeStream(s) {
  let k = 0; // draw index (0-based)
  const nextVal = () => {
    const i = k++;
    if (i < 8) {
      // 8-bit quantized: exact for cc=2; cc=3 ambiguous for anchors 85,170
      return { q: s.anchors[i], ambiguousCC3: s.anchors[i] === 85 || s.anchors[i] === 170 };
    }
    return { f: s.floats[i - 8], ambiguousCC3: false };
  };
  return {
    color(cc) {
      const d = nextVal();
      if (d.ambiguousCC3 && cc === 3) return -1; // wildcard
      if (d.q !== undefined) {
        if (cc === 2) return d.q >= 128 ? 1 : 0;
        if (cc === 3) return d.q >= 171 ? 2 : d.q >= 86 ? 1 : 0;
        return 0;
      }
      return Math.trunc(cc * d.f);
    },
    raw() {
      const d = nextVal();
      if (d.q !== undefined) return d.q / 256;
      return d.f;
    },
    position: () => k,
  };
}

// --- capture masks ---
function refMask(tx, ty) {
  const p = `mapgen/out/ref/${tx}_${ty}.png`;
  if (!fs.existsSync(p)) return null;
  const png = readPng(p);
  const g = new Uint8Array(GRID * GRID);
  const step = 512 / GRID;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      let solid = 0, count = 0;
      for (let sy = Math.floor(y * step); sy < Math.floor((y + 1) * step); sy += 2)
        for (let sx = Math.floor(x * step); sx < Math.floor((x + 1) * step); sx += 2) {
          const i = 4 * (sy * 512 + sx);
          const lum = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
          if (lum >= 24) solid++;
          count++;
        }
      g[y * GRID + x] = count > 0 && solid / count >= 0.5 ? 1 : 0;
    }
  return g;
}

function maskFromRgb(rgb, w, h, cropX, cropY) {
  // sample the crop region (512x512 world px starting at cropX,cropY within the window)
  const g = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const gx = Math.min(w - 1, cropX + Math.floor((x * 512) / GRID / 10));
      const gy = Math.min(h - 1, cropY + Math.floor((y * 512) / GRID / 10));
      const i = 3 * (gy * w + gx);
      const lum = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
      g[y * GRID + x] = lum >= 24 ? 1 : 0;
    }
  return g;
}

// --- tilesets per biome color ---
const config = loadBiomeConfig(dataDir);
const tsCache = new Map();
const getTs = (entry) => {
  if (!tsCache.has(entry.color)) {
    tsCache.set(
      entry.color,
      buildTileset(readPng(path.join(dataDir, entry.biome.templateFile.replace(/^data\//, ""))))
    );
  }
  return tsCache.get(entry.color);
};

// --- fill one chunk under a variant ---
function fillChunk(entry, cx, cy, variant) {
  const ts = getTs(entry);
  const s = ts.shortSideLen;
  const ox = (cx - 35) * 512;
  const oy = (cy - 14) * 512;
  const key = `${ox},${oy}`;
  const streamSrc = streams.get(key);
  if (!streamSrc) return null;
  const stream = makeStream(streamSrc);

  const wCells = 52;
  const hCells = variant.discard4 ? 56 : 52;
  let failed = false;
  const res = generateCorner(
    ts,
    wCells,
    hCells,
    (i, j, p) => {
      if (failed) return 0;
      if (variant.skipCC1 && ts.numColor[p] === 1) return 0;
      const c = stream.color(ts.numColor[p]);
      if (c === -1) { failed = true; return 0; } // wildcard: abort this fill
      return c;
    },
    (i, j, n) => (variant.tileDraws ? Math.min(n - 1, Math.trunc(n * stream.raw())) : 0),
    null
  );
  if (failed) return null;

  const c0x = Math.floor(ox / 10);
  const c0y = Math.floor(oy / 10);
  const cropX = ox - c0x * 10;
  const cropY = variant.discard4 ? oy - c0y * 10 : oy - c0y * 10;
  return maskFromRgb(res.rgb, wCells, hCells, cropX, variant.discard4 ? cropY + 4 : cropY);
}

// --- sweep ---
const variants = [];
for (const tileDraws of [false, true])
  for (const skipCC1 of [false, true])
    for (const discard4 of [false, true])
      variants.push({ tileDraws, skipCC1, discard4 });

// chunks to test: all origins in the dump that have a ref chunk
const testChunks = [];
for (const key of streams.keys()) {
  const [ox, oy] = key.split(",").map(Number);
  const cx = ox / 512 + 35;
  const cy = oy / 512 + 14;
  const ref = refMask(cx, cy);
  if (ref) {
    const entry = biomeAt(config, cx, cy);
    if (entry) testChunks.push({ cx, cy, entry, ref });
  }
}
console.log(`testable chunks: ${testChunks.length}`);

const results = [];
for (const variant of variants) {
  let sum = 0, count = 0;
  for (const c of testChunks) {
    const m = fillChunk(c.entry, c.cx, c.cy, variant);
    if (!m) continue;
    sum += agreement(m, c.ref);
    count++;
  }
  if (count > 0) results.push({ variant, score: sum / count, count });
}

results.sort((a, b) => b.score - a.score);
console.log(`\nchunk-fill variants (vs same-seed capture):`);
for (const r of results)
  console.log(
    `tiles=${r.variant.tileDraws ? "Y" : "n"} skipCC1=${r.variant.skipCC1 ? "Y" : "n"} discard4=${r.variant.discard4 ? "Y" : "n"}  ${(r.score * 100).toFixed(1)}%  [${r.count} chunks]`
  );
console.log(`\nnoise floor reference: 60-66% (gen-vs-gen); baseline noitool: ~60%`);
