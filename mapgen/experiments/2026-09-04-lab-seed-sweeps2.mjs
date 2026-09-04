// Lab seeding sweeps round 2 (2026-09-04 evening) — seed 91 focus.
//
// C: cross-seed agreement of observed vertex grids (structure diagnostic).
// A2: seed-mixer variants x skip k x draw shapes x choice-consumption:
//     m1 SetRandomFromWorldSeed + skip k + attempt stream   (noitool shape)
//     m2 NollaPrng(worldSeed) direct + skip k
//     m3 seededPrng(ws, 0, 0)          (world seed through diddle mixer)
//     m4 seededPrng(ws, ws, 0)
//     m5 seededPrng(ws, 0, ws)
//     choice: consumes nextU()%n (stbhw) OR fixed 0 (no consumption)

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { buildTileset, generateCorner, seededPrng, NollaPrng } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const SEEDS = ["78633191", "78633192", "78633193"];
const W = 256, H = 102;
const NC = [2, 1, 2, 1];
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf-8"));
const ts = buildTileset(readPng(repoRoot + "/mods/noita-wang-lab/files/wang_tiles/lab.png"));

const classOf = (i, j) => (((i - j) % 4) + 4) % 4;
function observed(seed) {
  const out = [];
  for (const [key, color] of Object.entries(grids[seed].grid)) {
    const [I, J] = key.split(",").map(Number);
    const cl = classOf(I, J);
    if (cl === 1 || cl === 3) continue;
    out.push({ I, J, color });
  }
  return out;
}

const DRAW = {
  random: (rng, cc) => (cc === 1 ? 0 : rng.random(0, cc - 1)),
  nextUmod: (rng, cc) => rng.nextU() % cc,
  nextmul: (rng, cc) => Math.floor(rng.next() * cc),
};

function vertexMatch(colors, obs) {
  let best = 0, bestD = null;
  for (let dI = -6; dI <= 6; dI++)
    for (let dJ = -6; dJ <= 6; dJ++) {
      let m = 0;
      for (const v of obs) if (colors.get(v.I + dI + "," + (v.J + dJ)) === v.color) m++;
      if (m > best) { best = m; bestD = [dI, dJ]; }
    }
  return { pct: (100 * best) / obs.length, d: bestD };
}

function runFill(seed, makeRng, drawName, choiceConsumes) {
  const rng = makeRng(Number(seed) >>> 0);
  const draw = DRAW[drawName];
  const colors = new Map();
  generateCorner(
    ts, W, H,
    (i, j, p) => { const c = draw(rng, NC[p]); colors.set(i + "," + j, c); return c; },
    choiceConsumes ? (i, j, n) => rng.nextU() % n : () => 0,
    null
  );
  return colors;
}

const MIXERS = {
  m1_setFromWorld: (ws, k) => { const r = new NollaPrng(0); r.setRandomFromWorldSeed(ws); for (let i = 0; i < k; i++) r.next(); return new NollaPrng(r.nextU()); },
  m2_direct: (ws, k) => { const r = new NollaPrng(ws); for (let i = 0; i < k; i++) r.next(); return r; },
  m3_diddle0: (ws, k) => { const r = seededPrng(ws, 0, 0); for (let i = 0; i < k; i++) r.next(); return r; },
  m4_diddleSelf: (ws, k) => { const r = seededPrng(ws, ws, 0); for (let i = 0; i < k; i++) r.next(); return r; },
  m5_diddleSelfY: (ws, k) => { const r = seededPrng(ws, 0, ws); for (let i = 0; i < k; i++) r.next(); return r; },
};

// ---- C: cross-seed agreement ----
console.log("== C: cross-seed vertex agreement ==");
const g = Object.fromEntries(SEEDS.map((s) => [s, grids[s].grid]));
let agree12 = 0, agree13 = 0, agree23 = 0, all3 = 0, n = 0;
const agreeMap = {};
for (const [key, c1] of Object.entries(g["78633191"])) {
  const c2 = g["78633192"][key], c3 = g["78633193"][key];
  if (c2 === undefined || c3 === undefined) continue;
  const [I, J] = key.split(",").map(Number);
  const cl = classOf(I, J);
  if (cl === 1 || cl === 3) continue;
  n++;
  if (c1 === c2) agree12++;
  if (c1 === c3) agree13++;
  if (c2 === c3) agree23++;
  if (c1 === c2 && c2 === c3) { all3++; agreeMap[key] = c1; }
}
console.log(`informative vertices in all 3 seeds: ${n}`);
console.log(`pairwise agreement: 91=92 ${(100 * agree12 / n).toFixed(1)}%  91=93 ${(100 * agree13 / n).toFixed(1)}%  92=93 ${(100 * agree23 / n).toFixed(1)}%  all-equal ${(100 * all3 / n).toFixed(1)}% (coin-flip expectation: 50/50/50/25)`);

// ---- A2: mixer x skip x draw x choice ----
console.log("== A2: mixer variants ==");
const obs91 = observed("78633191");
const hits = [];
let tried = 0;
for (const [mname, mixer] of Object.entries(MIXERS)) {
  for (let k = 0; k <= 600; k++) {
    for (const drawName of Object.keys(DRAW)) {
      for (const choiceConsumes of [true, false]) {
        const colors = runFill("78633191", (ws) => mixer(ws, k), drawName, choiceConsumes);
        tried++;
        const r = vertexMatch(colors, obs91);
        if (r.pct > 70) hits.push({ mixer: mname, k, drawName, choiceConsumes, ...r });
      }
    }
  }
  console.log(`  ${mname} done (${tried} fills total)`);
}
hits.sort((a, b) => b.pct - a.pct);
console.log("hits >70%:", hits.length ? JSON.stringify(hits.slice(0, 6)) : "none");
for (const h of hits.slice(0, 3)) {
  const others = SEEDS.slice(1).map((s) => {
    const obs = observed(s);
    const r = vertexMatch(runFill(s, (ws) => MIXERS[h.mixer](ws, h.k), h.drawName, h.choiceConsumes), obs);
    return s + ": " + r.pct.toFixed(1) + "%";
  });
  console.log("verify", JSON.stringify(h), "→", others.join("  "));
}
