// Lab hybrid-model sweep (2026-09-04).
//
// Family: the fill stream is seeded ONCE per area from a POSITION HASH
// (SetRandomSeed(seedX, seedY) — the verified mixer), then vertices are
// colored SEQUENTIALLY from that stream (stbhw scan order), with optional
// warm-up draws and draw shapes. This is the "seed propagated through a
// hash into the RNG" model. Compared at VERTEX level against the observed
// lab grids (alignment swept).
//
// Variants: seed point offsets (world px around the area corner),
// warm-up draws 0..4, draw shape (random(0,cc-1) vs nextU()%cc vs next()*cc),
// choice draws from the same stream (mirrors stbhw).

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { buildTileset, generateCorner, seededPrng, NollaPrng } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const SEEDS = ["78633191", "78633192", "78633193"];
const W = 256, H = 102;
const ORIGIN = { x: -16896, y: 11264 };
const NC = [2, 1, 2, 1];
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf-8"));
const ts = buildTileset(readPng(repoRoot + "/mods/noita-wang-lab/files/wang_tiles/lab.png"));

const classOf = (i, j) => (((i - j) % 4) + 4) % 4; // lab-confirmed rule

const DRAW = {
  random: (rng, cc) => (cc === 1 ? 0 : rng.random(0, cc - 1)),
  nextUmod: (rng, cc) => rng.nextU() % cc,
  nextmul: (rng, cc) => Math.floor(rng.next() * cc),
};

function observed(seed) {
  const grid = grids[seed].grid;
  const out = [];
  for (const [key, color] of Object.entries(grid)) {
    const [I, J] = key.split(",").map(Number);
    if ((((I - J) % 4) + 4) % 4 === 1 || (((I - J) % 4) + 4) % 4 === 3) continue;
    out.push({ I, J, color });
  }
  return out;
}

function runHybrid(seed, offX, offY, warmups, drawName) {
  const rng = seededPrng(Number(seed) >>> 0, ORIGIN.x + offX, ORIGIN.y + offY);
  for (let i = 0; i < warmups; i++) rng.next();
  const draw = DRAW[drawName];
  const colors = new Map(); // "i,j" -> color (pre-choice)
  const out = generateCorner(
    ts, W, H,
    (i, j, p) => { const c = draw(rng, NC[p]); colors.set(i + "," + j, c); return c; },
    (i, j, n) => rng.nextU() % n,
    null // repReduce off
  );
  return colors;
}

for (const seed of SEEDS) {
  const obs = observed(seed);
  const results = [];
  for (let offX = -40; offX <= 40; offX += 4)
    for (let offY = -40; offY <= 40; offY += 4)
      for (let warmups = 0; warmups <= 4; warmups++)
        for (const drawName of Object.keys(DRAW)) {
          const colors = runHybrid(seed, offX, offY, warmups, drawName);
          // alignment sweep on vertex indices
          for (let dI = -4; dI <= 4; dI++)
            for (let dJ = -4; dJ <= 4; dJ++) {
              let match = 0;
              for (const v of obs) {
                const c = colors.get(v.I + dI + "," + (v.J + dJ));
                if (c === v.color) match++;
              }
              const pct = (100 * match) / obs.length;
              if (pct > 60) results.push({ offX, offY, warmups, drawName, dI, dJ, pct: +pct.toFixed(2) });
            }
        }
  results.sort((a, b) => b.pct - a.pct);
  console.log(`seed ${seed}: ${results.length} candidates >60%`, results.slice(0, 6));
}
