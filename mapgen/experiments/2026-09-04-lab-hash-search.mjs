// Lab hash-shape search (2026-09-04).
//
// Question: what function of (worldSeed, position, class) produces the
// observed lab vertex colors? The RNG machinery is game-verified
// (seededPrng = SetRandomSeed exactly), so the search is over CALL SHAPES:
//   S1  ProceduralRandomi(wx+dx, wy+dy, 0, cc-1)      (position hash, int draw)
//   S2  ProceduralRandomf(wx+dx, wy+dy) -> floor(f*cc) (position hash, float draw)
//   S3  ProceduralRandomi(I+dx, J+dy, 0, cc-1)        (lattice-index hash)
//   S4  S1 with one warm-up draw discarded
// dx,dy swept over a full vertex period (40 world px) — absorbs any origin
// phase. A true shape+offset matches ~100% of vertices on ALL seeds.
//
// Empirical class rule (lab-confirmed): binary classes at (I-J)&3 in {0,2};
// classes {1,3} are single-color (0) by construction.

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { seededPrng } from "../lib/wang-js.mjs";

const SEEDS = ["78633191", "78633192", "78633193"];
const ORIGIN = { x: -16896, y: 11264 }; // lab area corner (biome px 2,36)
const S = 4;
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf-8"));

function observedVertices(seed) {
  const grid = grids[seed].grid;
  const out = [];
  for (const [key, color] of Object.entries(grid)) {
    const [I, J] = key.split(",").map(Number);
    const cl = (((I - J) & 3) + 4) & 4 === 4 ? 0 : ((I - J) & 3); // normalize
    const cls = ((I - J) % 4 + 4) % 4;
    const cc = cls === 0 || cls === 2 ? 2 : 1;
    if (cc === 1) continue; // single-color class — no information
    out.push({ I, J, color, cc });
  }
  return out;
}

const SHAPES = {
  S1_int: (rng, cc) => rng.random(0, cc - 1),
  S2_float: (rng, cc) => Math.floor(rng.next() * cc), // Randomf = next() in [0,1)
  S4_warmup: (rng, cc) => { rng.next(); return rng.random(0, cc - 1); },
};

function score(seed, verts, shape, hashMode, dx, dy) {
  let match = 0;
  for (const v of verts) {
    const wx = ORIGIN.x + (v.I - 2) * S * 10;
    const wy = ORIGIN.y + (v.J - 2) * S * 10;
    let rng;
    if (hashMode === "world") rng = seededPrng(Number(seed) >>> 0, wx + dx, wy + dy);
    else rng = seededPrng(Number(seed) >>> 0, v.I + dx, v.J + dy);
    const c = shape(rng, v.cc);
    if (c === v.color) match++;
  }
  return match / verts.length;
}

for (const seed of SEEDS) {
  const verts = observedVertices(seed);
  console.log(`seed ${seed}: ${verts.length} informative vertices`);
  const results = [];
  for (const [sname, shape] of Object.entries(SHAPES)) {
    for (const hashMode of ["world", "index"]) {
      const range = hashMode === "world" ? 40 : 4;
      for (let dx = -range; dx <= range; dx++)
        for (let dy = -range; dy <= range; dy++) {
          const m = score(seed, verts, shape, hashMode, dx, dy);
          if (m > 0.55) results.push({ sname, hashMode, dx, dy, pct: +(100 * m).toFixed(2) });
        }
    }
  }
  results.sort((a, b) => b.pct - a.pct);
  console.log("  top hits:", results.slice(0, 8).map((r) => `${r.sname}/${r.hashMode} d=(${r.dx},${r.dy}) ${r.pct}%`).join("  |  ") || "none above 55%");
}
