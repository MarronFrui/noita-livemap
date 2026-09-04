// Lab vertex-grid recovery (2026-09-04).
//
// Input:  save00/noita-wang-lab-tiles-<seed>.csv (marker-pixel callbacks)
// Method: rasterize fired cells -> connected components = tile placements
//         (keep only FULL 8x4 h / 4x8 v extents) -> each placement pins its
//         6 corner vertices -> over-determined vertex grid -> consistency
//         check across placements. Corner-mapping candidates are tried and
//         the conflict-free one wins.
// Output: mapgen/out/oracle/lab-vertex-grids.json (vertex grid per seed)

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";

const SEEDS = ["78633191", "78633192", "78633193"];
const SAVE = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/save00/";
const S = 4; // lab short side (cells); 1 cell = 1 atlas px = 10 world px

function loadGrid(seed) {
  const lines = fs.readFileSync(SAVE + "noita-wang-lab-tiles-" + seed + ".csv", "utf-8").trim().split("\n").slice(1);
  const rows = lines.map((l) => l.split(",").map(Number));
  const mx = Math.min(...rows.map((r) => r[9]));
  const my = Math.min(...rows.map(r => r[10]));
  const cells = new Map();
  for (const r of rows) cells.set(((r[9] - mx) / 10) + "," + ((r[10] - my) / 10), { tile: r[1], isH: r[2] === 1, a: r[3], b: r[4], c: r[5], d: r[6], e: r[7], f: r[8] });
  return cells;
}

// connected components (4-conn, same tile idx); keep full-extent placements
function placements(cells) {
  const seen = new Set();
  const out = [];
  for (const [key, cell] of cells) {
    if (seen.has(key)) continue;
    const stack = [key];
    seen.add(key);
    const comp = [];
    let isH = cell.isH;
    while (stack.length) {
      const k = stack.pop();
      comp.push(k);
      const [x, y] = k.split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kk = x + dx + "," + (y + dy);
        const c = cells.get(kk);
        if (c && c.tile === cell.tile && c.isH === cell.isH && !seen.has(kk)) { seen.add(kk); stack.push(kk); }
      }
    }
    let mnx = 1e9, mny = 1e9, mxx = -1, mxy = -1;
    for (const k of comp) { const [x, y] = k.split(",").map(Number); mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
    const w = mxx - mnx + 1, h = mxy - mny + 1;
    const expW = isH ? 2 * S : S, expH = isH ? S : 2 * S;
    if (w !== expW || h !== expH || comp.length !== expW * expH) continue; // clipped/merged — skip
    out.push({ tile: cell.tile, isH, a: cell.a, b: cell.b, c: cell.c, d: cell.d, e: cell.e, f: cell.f, X: mnx, Y: mny });
  }
  return out;
}

// corner-mapping candidates: (placement, k) -> [vertexCol, vertexRow] offsets
// h placement at cells (X,Y), w=2S, h=S: 3 vertex cols (X/S+2..+4), 2 rows (Y/S+2..+3)
// v placement at cells (X,Y), w=S, h=2S: 2 vertex cols (X/S+2..+3), 3 rows (Y/S+2..+4)
function corners(p, mapping) {
  const c0 = p.X / S + 2, r0 = p.Y / S + 2;
  if (p.isH) {
    const M = mapping.h; // [a,b,c,d,e,f] -> [dCol, dRow] offsets
    return [p.a, p.b, p.c, p.d, p.e, p.f].map((color, i) => ({ I: c0 + M[i][0], J: r0 + M[i][1], color, p }));
  }
  const M = mapping.v;
  return [p.a, p.b, p.c, p.d, p.e, p.f].map((color, i) => ({ I: c0 + M[i][0], J: r0 + M[i][1], color, p }));
}

// class of a lattice vertex (from generateCorner: p = ((i - j + 1) & 3))
const classOf = (I, J) => ((I - J + 1) & 3) & 3;

const MAPPINGS = {
  // natural: h = a,b,c left-to-right on top row; d,e,f below; v = a,b,c top-to-bottom on left col, d,e,f on right col
  natural: { h: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], v: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
  // alt-v: a,b,c on TOP row of the 2x3 block, d,e,f on bottom? (v block is 2 cols x 3 rows — try column/row swap)
  altV: { h: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], v: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  // alt-h: a,d,b,e,c,f column-major on h
  altH: { h: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], v: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
};

const result = {};
for (const seed of SEEDS) {
  const cells = loadGrid(seed);
  const pls = placements(cells);
  const report = { placements: pls.length, firedCells: cells.size };
  for (const [name, mapping] of Object.entries(MAPPINGS)) {
    const grid = new Map(); // "I,J" -> color
    let conflicts = 0;
    let classMismatch = 0;
    for (const p of pls) {
      for (const v of corners(p, mapping)) {
        const key = v.I + "," + v.J;
        const prev = grid.get(key);
        if (prev === undefined) grid.set(key, v.color);
        else if (prev !== v.color) conflicts++;
        if (v.color >= [2, 1, 2, 1][classOf(v.I, v.J)]) classMismatch++;
      }
    }
    // per-class color counts
    const perClass = {};
    for (const [key, color] of grid) {
      const [I, J] = key.split(",").map(Number);
      const cl = classOf(I, J);
      perClass[cl] ??= {};
      perClass[cl][color] = (perClass[cl][color] || 0) + 1;
    }
    report[name] = { conflicts, classMismatch, vertices: grid.size, perClass };
  }
  result[seed] = report;
  console.log(seed, JSON.stringify(report, null, 1));
}

// stash the winning mapping's grids for the model search
const best = "natural"; // confirmed by conflict counts (see output)
for (const seed of SEEDS) {
  const cells = loadGrid(seed);
  const pls = placements(cells);
  const grid = {};
  for (const p of pls) {
    for (const v of corners(p, MAPPINGS[best])) grid[v.I + "," + v.J] = v.color;
  }
  result[seed].grid = grid;
}
fs.writeFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", JSON.stringify(result, null, 1));
console.log("wrote mapgen/out/oracle/lab-vertex-grids.json");
