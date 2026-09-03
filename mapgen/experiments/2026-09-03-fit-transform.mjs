// Fit the transform: cross-correlate air/solid masks (generated vs captured)
// over shifts and flips. Reports the best alignment per chunk and aggregates.
//
// Usage: node mapgen/fit.mjs [--range 64] [--step 2]

import fs from "node:fs";
import path from "node:path";
import { readPng } from "../lib/images.mjs";

const AIR_THRESHOLD = 24;
const GRID = 128; // downsampled mask size (4 chunk-px per cell)

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? Number(process.argv[i + 1]) : fallback;
}
const range = arg("range", 64);
const step = arg("step", 2);

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
          if (lum >= AIR_THRESHOLD) solid++;
          count++;
        }
      }
      g[y * GRID + x] = count > 0 && solid / count >= 0.5 ? 1 : 0;
    }
  }
  return g;
}

function agreement(a, b, dx, dy, flipX, flipY) {
  let same = 0;
  let total = 0;
  for (let y = 0; y < GRID; y++) {
    const sy = flipY ? GRID - 1 - y : y;
    for (let x = 0; x < GRID; x++) {
      const sx = flipX ? GRID - 1 - x : x;
      const ox = sx + dx;
      const oy = sy + dy;
      if (ox < 0 || oy < 0 || ox >= GRID || oy >= GRID) continue;
      total++;
      if (a[sy * GRID + sx] === b[oy * GRID + ox]) same++;
    }
  }
  return total > GRID * GRID * 0.5 ? same / total : -1;
}

const genDir = "mapgen/out/gen";
const refDir = "mapgen/out/ref";
const files = fs
  .readdirSync(genDir)
  .filter((f) => f.endsWith(".png") && fs.existsSync(path.join(refDir, f)));

const results = [];
for (const file of files) {
  const gen = solidMask(readPng(path.join(genDir, file)));
  const ref = solidMask(readPng(path.join(refDir, file)));

  let best = { score: -1 };
  const atZero = agreement(gen, ref, 0, 0, false, false);
  for (const flipX of [false, true]) {
    for (const flipY of [false, true]) {
      for (let dy = -range; dy <= range; dy += step) {
        for (let dx = -range; dx <= range; dx += step) {
          const score = agreement(gen, ref, dx, dy, flipX, flipY);
          if (score > best.score) best = { score, dx, dy, flipX, flipY };
        }
      }
    }
  }
  results.push({ chunk: file.replace(".png", ""), atZero, best });
  console.log(
    `${file.replace(".png", "")}: zero=${(atZero * 100).toFixed(1)}%  best=${(best.score * 100).toFixed(1)}%  ` +
      `dx=${best.dx} dy=${best.dy} flipX=${best.flipX} flipY=${best.flipY}`
  );
}

const agg = (key) => {
  const vals = results.map((r) => r.best[key]).filter((v) => typeof v === "number");
  vals.sort((a, b) => a - b);
  return vals.length ? vals[(vals.length / 2) | 0] : null;
};

console.log("\n--- aggregate ---");
console.log(`avg zero-shift agreement: ${(avg(results.map((r) => r.atZero)) * 100).toFixed(1)}%`);
console.log(`avg best agreement:       ${(avg(results.map((r) => r.best.score)) * 100).toFixed(1)}%`);
console.log(`median best shift: dx=${agg("dx")} dy=${agg("dy")}`);
console.log(
  `flip votes: flipX=${results.filter((r) => r.best.flipX).length}/${results.length} flipY=${results.filter((r) => r.best.flipY).length}/${results.length}`
);

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}
