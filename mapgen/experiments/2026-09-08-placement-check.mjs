// Placement-level validation (2026-09-08): simulate the lab fill's tile scan
// with the verified sub-seed stream (S=1228813614 for seed 91) and diff the
// simulated placements against the game's placement log
// (lab-vertex-grids.json placements). Separates key corruption from model bug.
//
// Scan replica = wang-js.mjs generateCorner's herringbone loop (incl. its
// fully-off-image skip guards), with placement recording instead of drawTile.

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { buildTileset, NollaPrng } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const S = Number(process.argv[2] ?? 1228813614);
const SEED = process.argv[3] ?? "78633191";

const ts = buildTileset(readPng(repoRoot + "/mods/noita-wang-lab/files/wang_tiles/lab.png"));
const s = ts.shortSideLen; // 4
const cc = ts.numColor;    // [2,1,2,1]
const w = 256, hCells = 102, h = hCells + 4; // stb window (h+4), discard handled by log frame
const xmax = Math.floor(w / s) + 6; // 70
const ymax = Math.floor(h / s) + 6; // 32

// --- vertex coloring + rep-reduce (asm-exact, same as the sweep walk) -------
const rng = new NollaPrng(S);
const cColor = [];
for (let j = 0; j < ymax; j++) {
  cColor[j] = [];
  for (let i = 0; i < xmax; i++) cColor[j][i] = rng.nextU() % cc[((i - j + 1) & 3) & 3];
}
{
  const reroll = (old, p) => {
    const off = 1 + (rng.nextU() % (cc[p] - 1));
    return (old + off) % cc[p];
  };
  const match = (x, y) => cColor[y][x] === cColor[y + 1][x + 1];
  for (let j = 0; j < ymax - 3; j++)
    for (let i = 0; i < xmax - 3; i++) {
      if (match(i, j) && match(i, j + 1) && match(i, j + 2) && match(i + 1, j) && match(i + 1, j + 1) && match(i + 1, j + 2)) {
        const p = ((i + 1) - (j + 1) + 1) & 3;
        if (cc[p] > 1) cColor[j + 1][i + 1] = reroll(cColor[j + 1][i + 1], p);
      }
      if (match(i, j) && match(i + 1, j) && match(i + 2, j) && match(i, j + 1) && match(i + 1, j + 1) && match(i + 2, j + 1)) {
        const p = ((i + 2) - (j + 1) + 1) & 3;
        if (cc[p] > 1) cColor[j + 1][i + 2] = reroll(cColor[j + 1][i + 2], p);
      }
    }
}

// --- herringbone scan with placement recording ------------------------------
const placements = []; // {tile, isH, cx, cy, fullyVisible}
const cell = (i, j) => ({ v: cColor[j]?.[i], i, j });
const setCell = (cr) => { cColor[cr.j][cr.i] = cr.v; };
const chooseTile = (list, cells) => {
  const [A, B, C, D, E, F] = cells;
  let m = 1 << 30;
  for (let pass = 0; pass < 2; pass++) {
    let n = 0;
    for (const t of list) {
      if ((A.v >= 0 && A.v !== t.a) || (B.v >= 0 && B.v !== t.b) || (C.v >= 0 && C.v !== t.c) ||
          (D.v >= 0 && D.v !== t.d) || (E.v >= 0 && E.v !== t.e) || (F.v >= 0 && F.v !== t.f)) continue;
      n += 1;
      if (n > m) {
        A.v = t.a; B.v = t.b; C.v = t.c; D.v = t.d; E.v = t.e; F.v = t.f;
        return t;
      }
    }
    if (n === 0) throw new Error(`no tile matches at scan (${A.i},${A.j})`);
    m = rng.nextU() % n;
  }
  throw new Error("unreachable");
};

let ypos = -s;
for (let j = -1; ypos < h; j++) {
  const phase = j & 3;
  let i = phase === 0 ? 0 : phase - 4;
  for (;; i += 4) {
    let xpos = i * s;
    if (xpos >= w) break;
    if (xpos + 2 * s >= 0 && ypos >= 0) {
      const cells = [
        cell(i + 2, j + 2), cell(i + 3, j + 2), cell(i + 4, j + 2),
        cell(i + 2, j + 3), cell(i + 3, j + 3), cell(i + 4, j + 3),
      ];
      const t = chooseTile(ts.hTiles, cells);
      cells.forEach(setCell);
      const idx = ts.hTiles.indexOf(t);
      placements.push({ tile: idx, isH: true, cx: xpos, cy: ypos,
        fullyVisible: xpos >= 0 && ypos >= 0 && xpos + 2 * s <= w && ypos + s <= h });
    }
    xpos += 2 * s;
    xpos += s;
    if (xpos < w) {
      const cells = [
        cell(i + 5, j + 2), cell(i + 5, j + 3), cell(i + 5, j + 4),
        cell(i + 6, j + 2), cell(i + 6, j + 3), cell(i + 6, j + 4),
      ];
      const t = chooseTile(ts.vTiles, cells);
      cells.forEach(setCell);
      const idx = ts.vTiles.indexOf(t);
      placements.push({ tile: idx, isH: false, cx: xpos, cy: ypos,
        fullyVisible: xpos >= 0 && ypos >= 0 && xpos + s <= w && ypos + 2 * s <= h });
    }
  }
  ypos += s;
}
console.log(`simulated placements: ${placements.length} (fully visible: ${placements.filter(p => p.fullyVisible).length})`);

// --- compare with the game log ----------------------------------------------
const g = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf8"));
const log = g[SEED].placements;
console.log(`game log placements: ${log.length}`);

// find the constant offset (log.X vs my cx). The herringbone position lattice
// is invariant under (16k, 4m) shifts, so position matching alone cannot pick
// the coset member — derive it from the key-math instead:
//   key I = gen i_read + 5 (sweep offset dI=-5) and key I = (X+1)/4 + 2
//   => X = cx + 19 ; likewise key J = gen j_read + 6 = (Y+1)/4 + 2 => Y = cy + 23
//   => my = log + (-19, -23). Position-scan kept only as a sanity print.
const mine = placements.filter(p => p.fullyVisible);
const mineSet = new Map();
for (const p of mine) mineSet.set(p.cx + "," + p.cy + "," + (p.isH ? 1 : 0), p.tile);
let bestOff = [-19, -23];
{
  let score = 0;
  for (const pl of log) {
    const t = mineSet.get((pl.X + bestOff[0]) + "," + (pl.Y + bestOff[1]) + "," + (pl.isH ? 1 : 0));
    if (t !== undefined) score++;
  }
  console.log(`key-math offset log=mine+(${bestOff[0]},${bestOff[1]}): ${score}/${log.length} log placements have a same-position simulated tile`);
}

// position+tile agreement and disagreement detail
let posTileOk = 0, posOkTileBad = 0, missing = [];
const mine2 = new Map();
for (const p of mine) mine2.set((p.cx - bestOff[0]) + "," + (p.cy - bestOff[1]) + "," + (p.isH ? 1 : 0), p.tile);
for (const pl of log) {
  const k = pl.X + "," + pl.Y + "," + (pl.isH ? 1 : 0);
  const t = mine2.get(k);
  if (t === undefined) missing.push(pl);
  else if (t === pl.tile) posTileOk++;
  else posOkTileBad++;
}
console.log(`of ${log.length} log placements: ${posTileOk} position+tile MATCH, ${posOkTileBad} position match but TILE differs, ${missing.length} no simulated tile at position`);
for (const pl of missing.slice(0, 12)) {
  console.log(`  MISSING log tile${pl.tile}${pl.isH ? "h" : "v"} @(${pl.X},${pl.Y})`);
}
const bad = [];
for (const pl of log) {
  const k = pl.X + "," + pl.Y + "," + (pl.isH ? 1 : 0);
  const t = mine2.get(k);
  if (t !== undefined && t !== pl.tile) bad.push(`log tile${pl.tile}${pl.isH ? "h" : "v"} @(${pl.X},${pl.Y}) vs sim tile${t}`);
}
for (const b of bad.slice(0, 12)) console.log("  TILEDIFF " + b);
// reverse: simulated placements with no log entry
let extra = 0;
for (const p of mine) {
  const k = (p.cx - bestOff[0]) + "," + (p.cy - bestOff[1]) + "," + (p.isH ? 1 : 0);
  if (!log.some(pl => pl.X + "," + pl.Y + "," + (pl.isH ? 1 : 0) === k)) extra++;
}
console.log(`simulated fully-visible placements with no log entry: ${extra} / ${mine.length}`);
