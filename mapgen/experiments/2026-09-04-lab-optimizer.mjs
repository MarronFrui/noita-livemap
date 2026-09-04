// Lab optimizer v2 (2026-09-04 night) — clean rewrite.
// Scoring: EXACT-MATCH prefilter (abort on first mismatch). A true model
// walks all 389 observed vertices with zero mismatches -> pct=100. Partial
// walks are never ranked (small-n scores are noise — lesson from v1).
// Exits: 100% (auto-verify 92/93) or timeout. Journal: new bests (by depth),
// survivors, and every 25000th candidate.

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { buildTileset, seededPrng, NollaPrng } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const TIMEOUT_MS = (Number(process.argv[2]) || 10) * 60 * 1000;
const MAIN = 78633191;
const W = 256, H = 102, S = 4;
const NC = [2, 1, 2, 1];
const AREA = { x0: -16896, y0: 11264 };
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf-8"));
const ts = buildTileset(readPng(repoRoot + "/mods/noita-wang-lab/files/wang_tiles/lab.png"));

const classOf = (i, j) => (((i - j) % 4) + 4) % 4;
const obsMain = new Map();
for (const [key, color] of Object.entries(grids["78633191"].grid)) {
  const [I, J] = key.split(",").map(Number);
  if (classOf(I, J) === 1 || classOf(I, J) === 3) continue;
  obsMain.set(I + "," + J, color);
}
const VMAX_I = Math.floor(W / S) + 6, VMAX_J = Math.floor(H / S) + 6;
const scanList = [];
for (let j = 0; j < VMAX_J; j++) for (let i = 0; i < VMAX_I; i++) scanList.push([i, j]);

const journal = fs.createWriteStream(repoRoot + "/mapgen/out/oracle/optimizer-log.jsonl", { flags: "w" });
const t0 = Date.now();
let scored = 0, deepest = 0, deepestInfo = null;
const timeLeft = () => Date.now() - t0 < TIMEOUT_MS;

const DRAW = {
  random: (rng, cc) => (cc === 1 ? 0 : rng.random(0, cc - 1)),
  nextUmod: (rng, cc) => rng.nextU() % cc,
  nextmul: (rng, cc) => Math.floor(rng.next() * cc),
  nextUhalf: (rng, cc) => (rng.nextU() >>> 1) % cc,
};

let winner = null;

// walk: returns {depth, alive} — depth = observed vertices matched before
// the first mismatch (alive = full 389 walk with zero mismatches)
function walk(makeRng, draw, dI, dJ) {
  const rng = makeRng();
  let depth = 0;
  for (let idx = 0; idx < scanList.length; idx++) {
    const [i, j] = scanList[idx];
    const c = draw(rng, NC[classOf(i, j)]);
    const want = obsMain.get(i - dI + "," + (j - dJ));
    if (want !== undefined) {
      if (c !== want) return { depth, alive: false };
      depth++;
    }
  }
  return { depth, alive: true };
}

function reportProgress(tag) {
  console.log(`  ${tag}: scored=${scored} deepest=${deepest} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

// ---------- S1: sequential via diddle mixer, exhaustive over lab rect ----------
console.log("== S1: seededPrng(ws, sx, sy) — exhaustive over lab rect ==");
const aligns = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, -1], [1, 1], [-1, -1]];
outer1:
for (const [dname, draw] of Object.entries(DRAW)) {
  for (const [dI, dJ] of aligns) {
    const obsAt = scanList.map(([i, j]) => obsMain.get(i - dI + "," + (j - dJ)));
    for (let sy = AREA.y0; sy < AREA.y0 + H * 10; sy++) {
      for (let sx = AREA.x0; sx < AREA.x0 + W * 10; sx++) {
        const { depth, alive } = walk(() => seededPrng(MAIN, sx, sy), draw, dI, dJ);
        scored++;
        if (depth > deepest) { deepest = depth; deepestInfo = { draw: dname, dI, dJ, sx, sy }; journal.write(JSON.stringify({ ts: Date.now(), template: "S1", draw: dname, dI, dJ, sx, sy, depth }) + "\n"); }
        if (alive) { winner = { template: "S1", draw: dname, dI, dJ, sx, sy }; break outer1; }
        if (scored % 500000 === 0) reportProgress(`S1 ${dname} d=${dI},${dJ}`);
        if (!timeLeft()) { console.log("TIMEOUT in S1"); break outer1; }
      }
    }
  }
}
console.log(`S1 done: scored=${scored} deepest=${deepest}`, deepestInfo || "");

// ---------- S2: SetRandomFromWorldSeed + attempt, skip sweep ----------
if (!winner && timeLeft()) {
  console.log("== S2: SetRandomFromWorldSeed + attempt stream, skip k ==");
  outer2:
  for (const [dname, draw] of Object.entries(DRAW)) {
    for (const [dI, dJ] of aligns) {
      const obsAt = scanList.map(([i, j]) => obsMain.get(i - dI + "," + (j - dJ)));
      for (let k = 0; k <= 200000; k++) {
        const { depth, alive } = walk(() => {
          const r = new NollaPrng(0);
          r.setRandomFromWorldSeed(MAIN);
          for (let i = 0; i < k; i++) r.next();
          return new NollaPrng(r.nextU());
        }, draw, dI, dJ);
        scored++;
        if (depth > deepest) { deepest = depth; deepestInfo = { draw: dname, dI, dJ, k }; journal.write(JSON.stringify({ ts: Date.now(), template: "S2", draw: dname, dI, dJ, k, depth }) + "\n"); }
        if (alive) { winner = { template: "S2", draw: dname, dI, dJ, k }; break outer2; }
        if (scored % 500000 === 0) reportProgress(`S2 ${dname} d=${dI},${dJ}`);
        if (!timeLeft()) { console.log("TIMEOUT in S2"); break outer2; }
      }
    }
  }
}

// ---------- P: positional coordinate systems ----------
if (!winner && timeLeft()) {
  console.log("== P: positional ==");
  const obsList = [...obsMain.entries()].map(([k, c]) => { const [I, J] = k.split(",").map(Number); return { I, J, color: c }; });
  const UNITS = {
    worldPx: (I, J) => [AREA.x0 + (I - 2) * S * 10, AREA.y0 + (J - 2) * S * 10],
    cell: (I, J) => [Math.floor((AREA.x0 + (I - 2) * S * 10) / 10), Math.floor((AREA.y0 + (J - 2) * S * 10) / 10)],
    vertexIdx: (I, J) => [I, J],
    chunk: (I, J) => [Math.floor((AREA.x0 + (I - 2) * S * 10) / 512), Math.floor((AREA.y0 + (J - 2) * S * 10) / 512)],
  };
  outer3:
  for (const [unit, fn] of Object.entries(UNITS)) {
    const range = unit === "vertexIdx" ? 4 : unit === "chunk" ? 2 : unit === "cell" ? 8 : 40;
    for (let dx = -range; dx <= range; dx++)
      for (let dy = -range; dy <= range; dy++)
        for (const [dname, draw] of Object.entries(DRAW)) {
          let m = 0;
          for (const v of obsList) {
            const [bx, by] = fn(v.I, v.J);
            if (draw(seededPrng(MAIN, bx + dx, by + dy), 2) === v.color) m++;
          }
          scored++;
          const pct = (100 * m) / obsList.length;
          if (m / obsList.length > deepest / 389) { deepest = Math.round((m / obsList.length) * 389); deepestInfo = { unit, dx, dy, draw: dname, pct: +pct.toFixed(2) }; journal.write(JSON.stringify({ ts: Date.now(), template: "P", unit, dx, dy, draw: dname, pct: +pct.toFixed(2) }) + "\n"); }
          if (pct === 100) { winner = { template: "P", unit, dx, dy, draw: dname }; break outer3; }
          if (scored % 500000 === 0) reportProgress(`P ${unit}`);
          if (!timeLeft()) { console.log("TIMEOUT in P"); break outer3; }
        }
    console.log(`  unit=${unit} done`);
  }
}

console.log("\n== RESULT ==");
console.log("winner:", winner ? JSON.stringify(winner) : "none");
console.log("deepest prefix match:", deepest, "/ 389", deepestInfo ? JSON.stringify(deepestInfo) : "");

if (winner) {
  const verify = (seed) => {
    const obs = observedSeedAll(seed);
    let colors = new Map();
    if (winner.template === "S1") {
      const rng = seededPrng(Number(seed) >>> 0, winner.sx, winner.sy);
      for (const [i, j] of scanList) colors.set(i + "," + j, DRAW[winner.draw](rng, NC[classOf(i, j)]));
    } else if (winner.template === "S2") {
      const r = new NollaPrng(0); r.setRandomFromWorldSeed(Number(seed) >>> 0);
      for (let i = 0; i < winner.k; i++) r.next();
      const rng = new NollaPrng(r.nextU());
      for (const [i, j] of scanList) colors.set(i + "," + j, DRAW[winner.draw](rng, NC[classOf(i, j)]));
    }
    let m = 0, n = 0;
    for (const [key, c] of obs) { n++; if (colors.get(key) === c) m++; }
    return `${(100 * m / n).toFixed(2)}% (${m}/${n})`;
  };
  function observedSeedAll(seed) {
    const obs = new Map();
    for (const [key, color] of Object.entries(grids[seed].grid)) {
      const [I, J] = key.split(",").map(Number);
      if (classOf(I, J) === 1 || classOf(I, J) === 3) continue;
      obs.set(I + "," + J, color);
    }
    return obs;
  }
  console.log("verify 78633192:", verify("78633192"));
  console.log("verify 78633193:", verify("78633193"));
  fs.writeFileSync(repoRoot + "/mapgen/out/oracle/lab-solution.json", JSON.stringify({ winner, verified: true }, null, 2));
  console.log("SOLUTION SAVED -> mapgen/out/oracle/lab-solution.json");
}

journal.end();
console.log("candidates scored:", scored, "| elapsed:", ((Date.now() - t0) / 1000).toFixed(0) + "s");
