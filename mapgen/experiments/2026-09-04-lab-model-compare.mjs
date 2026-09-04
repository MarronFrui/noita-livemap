// Lab model comparison (2026-09-04): run candidate fills on the lab lattice
// (w=256, h=102 cells, the 5x2-chunk lab area) and compare cell-by-cell
// against the observed tile ids from the marker callbacks. EXACT match test —
// no statistics, no capture pollution.
//
// Model 1: seqAttempt (noitool-style sequential: GetRNG seeding + NewNollaPrng
//          per attempt + repReduce) — our existing JS twin of the wasm model.
// Alignment: sweep dX,dY in [-8..8] (fill origin vs fired-cell bbox).

import fs from "node:fs";
import { repoRoot, findNoitaDataDir } from "../lib/paths.mjs";
import { buildTileset, seqAttempt } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const SEEDS = ["78633191", "78633192", "78633193"];
const W = 256, H = 102; // lab area cells (5x2 chunks, trunc((5*512)/10) etc.)
const SAVE = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/save00/";

const ts = buildTileset(readPng(repoRoot + "/mods/noita-wang-lab/files/wang_tiles/lab.png"));

// marker hex -> tile idx (from the writer's markerOf)
import { markerOf } from "../lib/wang-template-writer.mjs";
const markerToTile = new Map();
for (let i = 0; i < ts.hTiles.length + ts.vTiles.length; i++) {
  const [r, g, b] = markerOf(i);
  markerToTile.set(`${r},${g},${b}`, i);
}

function loadObserved(seed) {
  const lines = fs.readFileSync(SAVE + "noita-wang-lab-tiles-" + seed + ".csv", "utf-8").trim().split("\n").slice(1);
  const rows = lines.map((l) => l.split(",").map(Number));
  const mx = Math.min(...rows.map((r) => r[9]));
  const my = Math.min(...rows.map((r) => r[10]));
  const cells = new Map();
  for (const r of rows) cells.set(((r[9] - mx) / 10) + "," + ((r[10] - my) / 10), r[1]);
  return cells;
}

for (const seed of SEEDS) {
  const observed = loadObserved(seed);
  const gen = seqAttempt(ts, W, H, Number(seed) >>> 0);
  // model cell -> tile idx via marker color
  const model = new Map();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = 3 * (y * W + x);
      const t = markerToTile.get(`${gen.rgb[i]},${gen.rgb[i + 1]},${gen.rgb[i + 2]}`);
      if (t !== undefined) model.set(x + "," + y, t);
    }
  // best alignment
  let best = { match: -1, dX: 0, dY: 0, compared: 0 };
  for (let dY = -8; dY <= 8; dY++)
    for (let dX = -8; dX <= 8; dX++) {
      let match = 0, compared = 0;
      for (const [key, t] of observed) {
        const [x, y] = key.split(",").map(Number);
        const m = model.get(x + dX + "," + (y + dY));
        if (m === undefined) continue;
        compared++;
        if (m === t) match++;
      }
      if (compared > best.compared || (compared === best.compared && match / compared > best.match / best.compared)) {
        best = { match, dX, dY, compared, pct: compared ? +(100 * match / compared).toFixed(2) : 0 };
      }
    }
  console.log(seed, "seqAttempt:", `${best.match}/${best.compared} cells (${best.pct}%) at dX=${best.dX} dY=${best.dY}`);
}
