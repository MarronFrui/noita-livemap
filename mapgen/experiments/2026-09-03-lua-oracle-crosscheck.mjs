// Lua RNG oracle crosscheck.
//
// Reads the truth table dumped by mods/noita-livemap-rng-probe (from the
// running game) and compares it against our JS reconstruction of the game's
// RNG (seededPrng in lib/wang-js.mjs, ported from noitool's zig).
//
// If mismatches exist, sweeps implementation variants (extra warm-up draws,
// draw method) and reports the best-fitting variant — the delta tells us
// exactly what to fix in the reconstruction.
//
// Usage: node mapgen/experiments/2026-09-03-lua-oracle-crosscheck.mjs
//   (run the game with the RNG probe mod enabled first)

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir } from "../lib/paths.mjs";
import { seededPrng } from "../lib/wang-js.mjs";

const dataDir = findNoitaDataDir();
const save00 = path.join(dataDir, "..", "save00");

const metaPath = path.join(save00, "noita-rng-probe-meta.json");
if (!fs.existsSync(metaPath)) {
  console.log(`no probe dump found at ${metaPath}`);
  console.log(`→ run Noita with the "Noita RNG Probe" mod enabled, start a game,`);
  console.log(`  then re-run this script.`);
  process.exit(0);
}
const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
const seed = Number(meta.seed);
console.log(`oracle dump: world seed ${meta.seed}, ${meta.rows} rows, grid ±${meta.half} step ${meta.step}, ${meta.draws} draws/position`);

const csvPath = path.join(save00, `noita-rng-probe-${meta.seed}.csv`);
const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n").slice(1);

const rows = lines.map((l) => l.split(",").map(Number));
console.log(`parsed ${rows.length} rows`);

// --- our reconstruction, as-is ---
function ourSeq(x, y, extraWarmups = 0) {
  const rng = seededPrng(seed, x, y);
  for (let i = 0; i < extraWarmups; i++) rng.next();
  return rng;
}

const methods = {
  "random(min,max)": (rng) => rng.random(0, 255),
  "trunc(256*next)": (rng) => Math.trunc(rng.next() * 256),
  "nextU()%256": (rng) => rng.nextU() % 256,
};

function rate(methodFn, warmups, values) {
  // values: array of 8 game numbers; returns match fraction over 8 draws
  const rng = ourSeq(values.x, values.y, warmups);
  let match = 0;
  for (let k = 0; k < 8; k++) {
    const ours = methodFn(rng);
    if (ours === values.seq[k]) match++;
  }
  return match / 8;
}

// prepare per-row values
const data = rows.map((r) => ({
  x: r[0],
  y: r[1],
  proc: r[2],
  seq: r.slice(3, 3 + meta.draws),
}));

// baseline: port as-is
{
  const m = methods["random(min,max)"];
  let cells = 0;
  let matches = 0;
  let procMatch = 0;
  for (const d of data) {
    const rng = ourSeq(d.x, d.y);
    for (let k = 0; k < d.seq.length; k++) {
      cells++;
      if (m(rng) === d.seq[k]) matches++;
    }
    procMatch += ourSeq(d.x, d.y).random(0, 255) === d.proc ? 1 : 0;
  }
  console.log(
    `\nport as-is: sequence match ${(100 * matches / cells).toFixed(2)}%  ` +
      `ProceduralRandomi match ${(100 * procMatch / data.length).toFixed(2)}%`
  );
  if (matches / cells === 1) {
    console.log("→ RNG reconstruction CONFIRMED: the game's numbers match our port exactly.");
  }
}

// variant sweep (only meaningful if baseline isn't perfect)
let best = { rate: -1 };
for (const [name, fn] of Object.entries(methods)) {
  for (let warmups = 0; warmups <= 5; warmups++) {
    let cells = 0;
    let matches = 0;
    for (const d of data) {
      const rng = ourSeq(d.x, d.y, warmups);
      for (let k = 0; k < d.seq.length; k++) {
        cells++;
        if (fn(rng) === d.seq[k]) matches++;
      }
    }
    const r = matches / cells;
    if (r > best.rate) best = { rate: r, method: name, warmups };
  }
}
console.log(
  `\nbest variant: ${best.method} with ${best.warmups} extra warm-up(s) → ${(best.rate * 100).toFixed(2)}% match`
);

// show first few mismatches under the port-as-is for diagnosis
if (best.rate < 1) {
  console.log("\nfirst mismatches (game vs our port, draw 1..8):");
  let shown = 0;
  for (const d of data.slice(0, 2048)) {
    const rng = ourSeq(d.x, d.y);
    const ours = Array.from({ length: d.seq.length }, () => methods["random(min,max)"](rng));
    if (ours.some((v, i) => v !== d.seq[i])) {
      console.log(`  (${d.x},${d.y}) game=[${d.seq}] ours=[${ours}]`);
      if (++shown >= 5) break;
    }
  }
}
