// Lab seeding sweeps (2026-09-04 evening) — seed 78633191 focus.
//
// Sweep A: SetRandomFromWorldSeed + SKIP k draws (k = 0..1200) + attempt
//          stream (NewNollaPrng(nextU)) + draw shapes — covers "the stream
//          was pre-consumed by an unknown constant amount".
// Sweep B: hybrid positional seeding at CANONICAL anchor points (area corner
//          phases, fired-bbox origin, area center, chunk origins/centers,
//          world origin) x warmups 0..3 x draw shapes.
// Sweep C: cross-seed agreement of the recovered vertex grids (structure vs
//          coin flips) — identifies seed-independent vertices beyond the
//          single-color classes and rep-reduce fingerprints.
// Metric: vertex-level match after alignment sweep dI,dJ in [-6..6].
// A candidate that tops seed 91 is auto-verified on 92/93.

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
  return { pct: (100 * best) / obs.length, d: bestD, n: obs.length };
}

function runStream(seed, makeRng, drawName) {
  const rng = makeRng(Number(seed) >>> 0);
  const draw = DRAW[drawName];
  const colors = new Map();
  generateCorner(
    ts, W, H,
    (i, j, p) => { const c = draw(rng, NC[p]); colors.set(i + "," + j, c); return c; },
    (i, j, n) => rng.nextU() % n,
    null
  );
  return colors;
}

const obs91 = observed("78633191");
const hits = [];

// ---- Sweep A: skip-constant variants ----
console.log("== Sweep A: SetRandomFromWorldSeed + skip k, NewNollaPrng(nextU) attempt ==");
for (let k = 0; k <= 1200; k++) {
  for (const drawName of Object.keys(DRAW)) {
    const colors = runStream("78633191", (ws) => {
      const rng = new NollaPrng(0);
      rng.setRandomFromWorldSeed(ws);
      for (let i = 0; i < k; i++) rng.next();
      const attempt = new NollaPrng(rng.nextU());
      return attempt;
    }, drawName);
    const r = vertexMatch(colors, obs91);
    if (r.pct > 70) hits.push({ sweep: "A", k, drawName, ...r });
  }
}
console.log("A done,", hits.length, "hits >70%");

// ---- Sweep B: canonical hybrid anchor points ----
console.log("== Sweep B: hybrid seeding at canonical anchors ==");
const anchors = [];
for (const [name, x, y] of [
  ["corner", -16896, 11264], ["corner+1", -16895, 11264], ["corner+3y", -16896, 11267],
  ["firedOrigin", -16895, 11267], ["center", -15616, 11776], ["worldOrigin", 0, 0],
  ["biomepx*512", 2 * 512, 36 * 512],
]) {
  anchors.push([name, x, y]);
}
for (let cx = 2; cx <= 6; cx++) for (let cy = 36; cy <= 37; cy++) {
  anchors.push([`chunk${cx},${cy}origin`, (cx - 35) * 512, (cy - 14) * 512]);
  anchors.push([`chunk${cx},${cy}center`, (cx - 35) * 512 + 256, (cy - 14) * 512 + 256]);
}
for (const [name, ax, ay] of anchors) {
  for (let warmups = 0; warmups <= 3; warmups++)
    for (const drawName of Object.keys(DRAW)) {
      const colors = runStream("78633191", () => seededPrng(78633191, ax, ay), drawName);
      // warmups for seededPrng handled via extra nexts:
      const colors2 = colors; // warmups>0 need re-run; do it only if base close
      const r = vertexMatch(colors, obs91);
      if (r.pct > 55) hits.push({ sweep: "B", anchor: name, warmups, drawName, ...r });
      if (warmups > 0 && r.pct > 40) {
        const rng = seededPrng(78633191, ax, ay);
        for (let i = 0; i < warmups; i++) rng.next();
        const colorsW = (() => {
          const draw = DRAW[drawName];
          const c2 = new Map();
          generateCorner(ts, W, H, (i, j, p) => { const c = draw(rng, NC[p]); c2.set(i + "," + j, c); return c; }, (i, j, n) => rng.nextU() % n, null);
          return c2;
        })();
        const r2 = vertexMatch(colorsW, obs91);
        if (r2.pct > 70) hits.push({ sweep: "B+warm", anchor: name, warmups, drawName, ...r2 });
      }
    }
}
console.log("B done");

// ---- auto-verify A hits on 92/93 ----
const aHits = hits.filter((h) => h.sweep === "A");
for (const h of aHits.slice(0, 5)) {
  const others = SEEDS.slice(1).map((s) => {
    const obs = observed(s);
    const colors = runStream(s, (ws) => {
      const rng = new NollaPrng(0);
      rng.setRandomFromWorldSeed(ws);
      for (let i = 0; i < h.k; i++) rng.next();
      return new NollaPrng(rng.nextU());
    }, h.drawName);
    return s + ": " + vertexMatch(colors, obs).pct.toFixed(1) + "%";
  });
  console.log("hit", JSON.stringify(h), "→ verify:", others.join("  "));
}
if (!aHits.length) console.log("NO A-HITS >70% — pre-consumption family open");
