// Fill-sweep: test WHERE/HOW the game's fill draws vertex colors, using the
// game-verified RNG (seededPrng) + the v2 oracle truth table + the capture.
//
// Hypothesis space (v1):
//   encoding:  worldPx | cell (worldPx/10) | lattice (i,j) + area origin
//   swap:      (x,y) vs (y,x)
//   draw:      ProceduralRandomi-style one-shot per vertex
//   color:     cc[p]==1 -> 0 (no draw); cc==2 -> pr01; cc==3 -> pr02
//   anchor:    offsets around the area origin (world px, step 10)
//
// Score: air/solid agreement vs capture per chunk (spike detection above the
// gen-vs-gen noise floor 60-66%).
//
// Usage: node mapgen/experiments/2026-09-03-fill-sweep.mjs [--seed N]
//   (requires noita-rng-probe2 dump for that seed + out/ref chunks)

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, CAPTURE_SEED } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { readPng } from "../lib/images.mjs";
import { buildTileset, generateCorner } from "../lib/wang-js.mjs";
import { worldOfBiomePx, OFFSET_X, OFFSET_Y } from "../lib/coords.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? Number(process.argv[i + 1]) : fallback;
}
const SEED = Number(arg("seed", CAPTURE_SEED)) >>> 0;

const dataDir = findNoitaDataDir();
const save00 = path.join(dataDir, "..", "save00");
const metaPath = path.join(save00, `noita-rng-probe2-meta.json`);
if (!fs.existsSync(metaPath)) {
  console.log(`no v2 dump for seed ${SEED} — run the game with the RNG probe mod (v2) first`);
  process.exit(0);
}
const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
if (Number(meta.seed) !== SEED) {
  console.log(`WARNING: dump seed ${meta.seed} != requested seed ${SEED}`);
  console.log(`→ vertex colors are seed-specific: geometry scoring vs the capture`);
  console.log(`  (seed 78633191) is only valid for a dump made in a world with that seed.`);
  console.log(`  Use --seed ${meta.seed} to analyze this dump against same-seed constraints`);
  console.log(`  (entity-spawn equations), or force the world seed in-game (noita-mapcap).`);
  if (Number(meta.seed) !== Number(arg("seed", NaN))) {
    // explicit --seed matching the dump is allowed (spawn-equation mode)
  }
}
console.log(`oracle v2: seed ${meta.seed}, ${meta.rows} rows`);

// --- oracle lookup table ---
const oracle = new Map();
{
  const csv = fs.readFileSync(path.join(save00, `noita-rng-probe2-${meta.seed}.csv`), "utf-8");
  for (const line of csv.split("\n").slice(1)) {
    if (!line) continue;
    const p = line.split(",");
    oracle.set(`${p[0]},${p[1]}`, [Number(p[2]), Number(p[3]), Number(p[4]), Number(p[5])]);
    // [pr01, pr02, s01a, s02a]  (draw1 of each sequence)
  }
}
console.log(`oracle positions: ${oracle.size}`);

const GRID = 128;
const agreement = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) s++;
  return s / a.length;
};
function maskFromRgb(rgb, w, h) {
  const g = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const gx = Math.min(w - 1, Math.floor((x * w) / GRID));
      const gy = Math.min(h - 1, Math.floor((y * h) / GRID));
      const i = 3 * (gy * w + gx);
      const lum = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
      g[y * GRID + x] = lum >= 24 ? 1 : 0;
    }
  return g;
}

const config = loadBiomeConfig(dataDir);

// areas under test (spawn window biomes with wang tilesets)
const targets = [];
for (const [tx, ty] of [[35, 15], [34, 17], [28, 15]]) {
  const entry = biomeAt(config, tx, ty);
  if (entry && !targets.some((t) => t.color === entry.color)) targets.push(entry);
}
console.log(`areas: ${targets.map((t) => t.biome.name).join(", ")}`);

// tilesets + reference masks
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
const refMasks = new Map();
for (const f of fs.readdirSync("mapgen/out/ref").filter((f) => f.endsWith(".png"))) {
  const tx = Number(f.split("_")[0]);
  const ty = Number(f.split("_")[1].split(".")[0]);
  const png = readPng(path.join("mapgen/out/ref", f));
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
  refMasks.set(`${tx}_${ty}`, g);
}

// vertex color under a hypothesis
// encoding worldPx: seeded at (ax + i*s*10, ay + j*s*10)   (world px)
// encoding cell:    seeded at (ax + i*s*10)/10 rounded      (10px cell units)
// ax, ay = area world origin + delta (delta swept per area)
function vertexColor(oracle, encoding, swap, i, j, cc, ax, ay, s) {
  if (cc === 1) return 0;
  let x, y;
  if (encoding === "worldPx") {
    x = ax + i * s * 10;
    y = ay + j * s * 10;
  } else {
    x = Math.round((ax + i * s * 10) / 10);
    y = Math.round((ay + j * s * 10) / 10);
  }
  if (swap) [x, y] = [y, x];
  const v = oracle.get(`${x},${y}`);
  if (!v) return undefined;
  return cc === 2 ? v[0] : v[1]; // pr01 or pr02
}

// generate one area under hypothesis
function generate(entry, encoding, swap, offX, offY) {
  const ts = getTs(entry);
  const s = ts.shortSideLen;
  const { area } = entry;
  const ax = worldOfBiomePx(area.x1, OFFSET_X) + offX;
  const ay = worldOfBiomePx(area.y1, OFFSET_Y) + offY;
  const wCells = Math.floor(((area.x2 + 1 - area.x1) * 512) / 10);
  const hCells = Math.floor(((area.y2 + 1 - area.y1) * 512) / 10);
  const xmax = Math.floor(wCells / s) + 6;
  const ymax = Math.floor(hCells / s) + 6;
  for (let j = 0; j < ymax; j++)
    for (let i = 0; i < xmax; i++) {
      const p = (((i - j + 1) & 3) & 3);
      if (ts.numColor[p] === 1) continue;
      if (vertexColor(oracle, encoding, swap, i, j, ts.numColor[p], ax, ay, s) === undefined) {
        return null; // oracle doesn't cover this hypothesis
      }
    }
  return generateCorner(
    ts,
    wCells,
    hCells,
    (i, j, p) => vertexColor(oracle, encoding, swap, i, j, ts.numColor[p], ax, ay, s),
    () => 0,
    null
  );
}

function sampleChunk(res, area, tx, ty) {
  const g = new Uint8Array(GRID * GRID);
  const stepW = 512 / GRID;
  const bxW = (tx - area.x1) * 512;
  const byW = (ty - area.y1) * 512;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const gx = Math.min(res.width - 1, Math.floor((bxW + x * stepW) / 10));
      const gy = Math.min(res.height - 1, Math.floor((byW + y * stepW) / 10));
      const i = 3 * (gy * res.width + gx);
      const lum = 0.2126 * res.rgb[i] + 0.7152 * res.rgb[i + 1] + 0.0722 * res.rgb[i + 2];
      g[y * GRID + x] = lum >= 24 ? 1 : 0;
    }
  return g;
}

// chunk<->area mapping for scoring: ALL ref chunks belonging to target areas
const areaChunks = [];
for (const [key, ref] of refMasks) {
  const [tx, ty] = key.split("_").map(Number);
  const entry = biomeAt(config, tx, ty);
  if (entry && targets.some((t) => t.color === entry.color)) {
    areaChunks.push({ tx, ty, entry, ref });
  }
}
console.log(`scored chunks: ${areaChunks.map((c) => `${c.tx}_${c.ty}(${c.entry.biome.name})`).join(", ")}`);

// --- sweep ---
// Coverage constraint: the oracle dump holds positions ≡ (X_MIN mod 10) in x
// and (Y_MIN mod 10) in y. Vertex world positions = anchor + delta + i*s*10
// share one residue per (area, axis). So delta is swept in steps of 10 within
// the valid residue class, over one full lattice period [0, s*10).
const results = [];
for (const target of targets) {
  const ts = getTs(target);
  const s = ts.shortSideLen;
  const period = s * 10;
  const anchorX = worldOfBiomePx(target.area.x1, OFFSET_X);
  const anchorY = worldOfBiomePx(target.area.y1, OFFSET_Y);
  // required delta residues so vertices land on dump positions
  const rx = ((meta.x_min - anchorX) % 10 + 10) % 10;
  const ry = ((meta.y_min - anchorY) % 10 + 10) % 10;
  const chunks = areaChunks.filter((c) => c.entry.color === target.color);

  for (const encoding of ["worldPx", "cell"]) {
    for (const swap of [false, true]) {
      for (let dx = rx; dx < period; dx += 10) {
        for (let dy = ry; dy < period; dy += 10) {
          const res = generate(target, encoding, swap, dx, dy);
          if (!res) continue;
          let sum = 0, count = 0;
          for (const c of chunks) {
            sum += agreement(sampleChunk(res, target.area, c.tx, c.ty), c.ref);
            count++;
          }
          if (count > 0) {
            results.push({ area: target.biome.name, encoding, swap, dx, dy, score: sum / count, chunks: count });
          }
        }
      }
    }
  }
}

results.sort((a, b) => b.score - a.score);
console.log(`\n${results.length} hypotheses scored; top 12:`);
for (const r of results.slice(0, 12))
  console.log(
    `${r.area.padEnd(15)} ${r.encoding.padEnd(8)} swap=${r.swap ? "Y" : "n"} d=(${r.dx},${r.dy})  ${(r.score * 100).toFixed(1)}%  [${r.chunks} chunks]`
  );
console.log(`\nnoise floor reference: 60-66% (gen-vs-gen); baseline noitool: ~60%`);
