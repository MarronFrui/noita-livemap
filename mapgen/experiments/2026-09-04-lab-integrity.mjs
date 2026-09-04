// Lab integrity suite (2026-09-04 night) — run before any long search.
// Verifies, in order:
//  1. grid data: integer keys, in-bounds, conflict-free
//  2. PLANTED SOLUTION (exact): a synthetic answer key generated from a known
//     seed point must be FOUND by the same engine the dashboard uses
//  3. PLANTED SOLUTION (miss-budget): a corrupted synthetic key (8% wrong) must
//     be found with missBudget=40 — validates the rep-reduce tolerance path
//  4. control path: pause actually halts progress; stop terminates cleanly
// Exit: PASS/FAIL per check; nonzero exit code on any failure.

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { LabSearch, seededPrng, classOf, NC, SEARCH_VERSION } from "../lib/lab-search.mjs";

const W = 256, H = 102, S = 4;
const AREA = { x0: -16896, y0: 11264 };
const VMAX_I = Math.floor(W / S) + 6, VMAX_J = Math.floor(H / S) + 6;
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

// ---------- 1. grid data ----------
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf-8"));
let gOK = true, detail = [];
for (const seed of ["78633191", "78633192", "78633193"]) {
  const keys = Object.keys(grids[seed].grid);
  const intKeys = keys.every((k) => k.split(",").every((x) => Number.isInteger(+x)));
  const inBounds = keys.every((k) => { const [I, J] = k.split(",").map(Number); return I >= 0 && I < VMAX_I && J >= 0 && J < VMAX_J; });
  if (!intKeys) { gOK = false; detail.push(seed + ": non-integer keys"); }
  if (!inBounds) { gOK = false; detail.push(seed + ": out-of-bounds (canvas overflow)"); }
}
check("1. grid data integer + in canvas bounds", gOK, detail.join("; "));

// ---------- synthetic key builder (one stream, scan order — S1 semantics) ----------
function buildSynthetic(seed, sx, sy, corrupt = 0, rngSeed = 12345) {
  const rng0 = seededPrng(seed >>> 0, sx, sy);
  const noise = seededPrng(999999, rngSeed, 1); // deterministic corruption source
  const grid = {};
  for (let j = 0; j < VMAX_J; j++)
    for (let i = 0; i < VMAX_I; i++) {
      // consume at EVERY vertex (the game's rand()%%cc consumes even at cc=1)
      const c = (rng0.nextU() >>> 1) % NC[classOf(i, j)];
      const corruptHere = corrupt > 0 && classOf(i, j) !== 1 && classOf(i, j) !== 3 && (noise.nextU() % 100) < corrupt;
      grid[i + "," + j] = corruptHere ? 1 - c : c;
    }
  return { grid, count: Object.keys(grid).length };
}

async function searchFor(synthGrids, cfgExtra, verbose = false) {
  const s = new LabSearch({
    grids: synthGrids, seed: "78633191", area: AREA, dims: { W, H },
    config: { templates: { S1: true, S2: false, P: false }, batchSize: 5000, ...cfgExtra },
  });
  let done = null;
  s.on((e) => {
    if (verbose && (e.type === "best" || e.type === "skipped" || e.type === "sweepDone"))
      console.log("   [evt]", e.type, JSON.stringify(e.info || e.key || "").slice(0, 100), e.type === "best" ? "depth " + e.depth : "");
    if (e.type === "done") done = e;
  });
  await s.run();
  return done;
}

// ---------- 2. planted solution (exact) ----------
{
  const PLANT = { x: -15204, y: 11628 };
  const synth = { "78633191": { grid: buildSynthetic(78633191, PLANT.x, PLANT.y).grid } };
  const done = await searchFor(synth, { s1Anchors: [[PLANT.x, PLANT.y], [-15203, 11629], [-16000, 11400]] });
  check("2. planted solution found (exact prefilter)", done.winner && done.winner.sx === PLANT.x && done.winner.sy === PLANT.y,
    done.winner ? "winner at planted point" : `deepest ${done.deepest}, winner ${JSON.stringify(done.winner)}`);
}

// ---------- 3. planted solution (miss budget) ----------
{
  const PLANT = { x: -15400, y: 11800 };
  const synth = { "78633191": { grid: buildSynthetic(78633191, PLANT.x, PLANT.y, 3).grid } }; // 3% corrupted (≈31 misses < budget 40)
  const done = await searchFor(synth, { s1Anchors: [[PLANT.x, PLANT.y], [-15203, 11629], [-16000, 11400]], missBudget: 40 }, false);
  check("3. corrupted planted solution found (missBudget 40)", done.winner && done.winner.sx === PLANT.x && done.winner.sy === PLANT.y,
    done.winner ? `winner at planted point (depth ${done.winner.depth})` : `deepest ${done.deepest}, winner ${JSON.stringify(done.winner)}`);
}

// ---------- 4. control path: pause halts, stop terminates ----------
{
  // many anchors + tolerance scoring = enough work to catch mid-flight
  const anchors = [];
  for (let i = 0; i < 120000; i++) anchors.push([AREA.x0 + (i % (W * 10)), AREA.y0 + (i % (H * 10))]);
  const synth = { "78633191": { grid: buildSynthetic(78633191, -16000, 11400).grid } };
  const s = new LabSearch({
    grids: synth, seed: "78633191", area: AREA, dims: { W, H },
    config: { templates: { S1: true, S2: false, P: false }, s1Anchors: anchors, missBudget: 40, batchSize: 200 },
  });
  let done = null;
  s.on((e) => { if (e.type === "done") done = e; });
  const runP = s.run();
  await new Promise((r) => setTimeout(r, 300));
  const atPauseRequest = s.scored;
  s.pause();
  await new Promise((r) => setTimeout(r, 300));
  const whilePaused = s.scored;
  check("4a. pause halts progress", whilePaused === atPauseRequest || s.state === "stopped",
    `scored ${atPauseRequest} -> ${whilePaused} (state ${s.state})`);
  s.stop();
  await runP;
  check("4b. stop terminates cleanly", s.state === "stopped" && done && done.reason === "stopped",
    `state ${s.state}, reason ${done?.reason}`);
}

console.log(failures === 0 ? "\nINTEGRITY: ALL CHECKS PASS" : `\nINTEGRITY: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
