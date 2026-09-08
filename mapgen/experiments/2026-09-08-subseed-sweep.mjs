// Sub-seed sweep groundwork (2026-09-08) — probe targets the [area+0x4c] seed
// by INVERTING the sub-RNG state instead of hooking the exe.
//
// The accepted fill attempt is fully driven by the TLS sub-RNG state
// (CreateHerringboneWang_Threaded seeds TLS Random with the attempt's
// sub_seed, one warm-up Next()). Sweep trunc(sub) over [0, 2^31) against the
// 548-vertex lab key => if the walk mechanics are right, exactly one S hits
// 100%; the Lehmer chain is then invertible (16807 is invertible mod 2^31-1)
// to recover the base seed C and compare against ws+13589.
//
// This file (JS, slow but authoritative):
//   1. plants a known sub-seed as a synthetic key and re-judges it through the
//      candidates-script judge -> validates walk + judge + offset conventions
//   2. calibrates the rep-reduce flip rate (pre-reduce vs key mismatch share)
//      -> sets the C sweeper's early-abort threshold
//   3. times one full walk (for C cost math)

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { buildTileset, NollaPrng } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const W = 256, H = 102, S = 4;
const xmax = Math.floor(W / S) + 6;            // 70
const ymax = Math.floor((H + 4) / S) + 6;      // 32

const ts = buildTileset(readPng(repoRoot + "/mods/noita-wang-lab/files/wang_tiles/lab.png"));
const NC = ts.numColor; // [2,1,2,1]
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf8"));

// --- exact replica of the candidates script's post-sub walk ---------------
function gridFromSub(sub, withRereduce = true) {
  const rng = new NollaPrng(sub); // ctor warm-up == TLS warm-up
  const draw = (rng, cc) => rng.nextU() % cc; // DRAWS.nextUmod, asm-confirmed
  const c = [];
  for (let j = 0; j < ymax; j++) {
    c[j] = new Array(xmax);
    for (let i = 0; i < xmax; i++) c[j][i] = draw(rng, NC[(i - j + 1) & 3]);
  }
  if (!withRereduce) return c;
  const reroll = (old, p) => {
    const cc = NC[p];
    rng.next();
    return (old + 1 + (rng.seed % (cc - 1))) % cc;
  };
  const match = (x, y) => c[y][x] === c[y + 1][x + 1];
  for (let j = 0; j < ymax - 3; j++) {
    for (let i = 0; i < xmax - 3; i++) {
      if (match(i, j) && match(i, j + 1) && match(i, j + 2) && match(i + 1, j) && match(i + 1, j + 1) && match(i + 1, j + 2)) {
        const p = ((i + 1) - (j + 1) + 1) & 3;
        if (NC[p] > 1) c[j + 1][i + 1] = reroll(c[j + 1][i + 1], p);
      }
      if (match(i, j) && match(i + 1, j) && match(i + 2, j) && match(i, j + 1) && match(i + 1, j + 1) && match(i + 2, j + 1)) {
        const p = ((i + 2) - (j + 1) + 1) & 3;
        if (NC[p] > 1) c[j + 1][i + 2] = reroll(c[j + 1][i + 2], p);
      }
    }
  }
  return c;
}

// --- real key (seed 91) ----------------------------------------------------
const key = [];
for (const [k, color] of Object.entries(grids["78633191"].grid)) {
  const [I, J] = k.split(",").map(Number);
  key.push({ I, J, color, informative: ((((I - J) % 4) + 4) % 4) % 2 === 0 });
}
const keyInf = key.filter((v) => v.informative);
console.log(`key: ${key.length} vertices, ${keyInf.length} informative`);

// --- judge (same as candidates script) -------------------------------------
function judge(c) {
  const colors = new Map();
  for (let j = 0; j < ymax; j++) for (let i = 0; i < xmax; i++) colors.set(i + "," + j, c[j][i]);
  let best = null;
  for (let dJ = -6; dJ <= 10; dJ++) {
    for (let dI = -6; dI <= 6; dI++) {
      let m = 0, n = 0;
      for (const v of keyInf) {
        const got = colors.get((v.I + dI) + "," + (v.J + dJ));
        if (got === undefined) continue;
        n++;
        if (got === v.color) m++;
      }
      if (n < 10) continue;
      const pct = m / n;
      if (!best || pct > best.pct) best = { dI, dJ, pct, n };
    }
  }
  return best;
}

// --- test 1: planted solution ----------------------------------------------
{
  const S0 = 123456789;
  const dI0 = 3, dJ0 = -2; // dI-dJ odd => key-informative lands on cc=2 classes
  const g = gridFromSub(S0);
  const planted = {};
  for (let j = 0; j < ymax; j++) {
    for (let i = 0; i < xmax; i++) {
      const I = i - dI0, J = j - dJ0;
      if (I < 0 || J < 0) continue;
      planted[I + "," + J] = g[j][i];
    }
  }
  // judge planted key through the same offset-sweep machinery: expect exactly
  // (dI0,dJ0) at 100%
  const plantInf = [];
  for (const [k, color] of Object.entries(planted)) {
    const [I, J] = k.split(",").map(Number);
    if (((((I - J) % 4) + 4) % 4) % 2 === 0) plantInf.push({ I, J, color });
  }
  console.log(`planted: ${plantInf.length} informative vertices from S0=${S0} at offset (${dI0},${dJ0})`);
  const colors = new Map();
  for (let j = 0; j < ymax; j++) for (let i = 0; i < xmax; i++) colors.set(i + "," + j, g[j][i]);
  let perfect = [];
  for (let dJ = -6; dJ <= 10; dJ++) {
    for (let dI = -6; dI <= 6; dI++) {
      let m = 0, n = 0;
      for (const v of plantInf) {
        const got = colors.get((v.I + dI) + "," + (v.J + dJ));
        if (got === undefined) continue;
        n++;
        if (got === v.color) m++;
      }
      if (n >= 10 && m === n) perfect.push(`${dI},${dJ}`);
    }
  }
  console.log(`planted self-check: 100% offsets = [${perfect.join(" ")}]  ${perfect.join(",") === `${dI0},${dJ0}` ? "PASS" : "FAIL"}`);
  // and the real key must NOT match this random S anywhere (sanity)
  const realBest = judge(g);
  console.log(`real key vs random S0: best ${(100 * realBest.pct).toFixed(2)}% at (${realBest.dI},${realBest.dJ}) — expect ~50-60%`);
}

// --- test 2: flip-rate calibration (pre-reduce vs post-reduce) --------------
{
  const dI = 1, dJ = 0; // odd parity (dI-dJ=1): key-informative <=> gen (i-j) odd = cc=2
  let rates = [];
  let rerollCounts = [];
  let t0 = Date.now();
  for (let t = 0; t < 50; t++) {
    const S0 = (Math.floor(Math.random() * 2147483647)) >>> 0;
    const pre = gridFromSub(S0, false);
    const post = gridFromSub(S0, true);
    let flips = 0;
    for (let j = 0; j < ymax; j++) for (let i = 0; i < xmax; i++) if (pre[j][i] !== post[j][i]) flips++;
    rerollCounts.push(flips);
    let m = 0, n = 0;
    for (let j = 0; j < ymax; j++) {
      for (let i = 0; i < xmax; i++) {
        const I = i - dI, J = j - dJ;
        if (((((I - J) % 4) + 4) % 4) % 2 !== 0) continue; // informative only
        n++;
        if (pre[j][i] !== post[j][i]) m++; // pre-reduce wrong vs final (key-like)
      }
    }
    rates.push(m / n);
  }
  const dt = Date.now() - t0;
  rates.sort((a, b) => a - b);
  const q = (p) => (100 * rates[Math.floor(p * (rates.length - 1))]).toFixed(1);
  rerollCounts.sort((a, b) => a - b);
  console.log(`rerolls per grid: min ${rerollCounts[0]} / med ${rerollCounts[25]} / max ${rerollCounts[49]}`);
  console.log(`flip rates (informative, pre-reduce mismatches, n=50): min ${q(0)}% / med ${q(0.5)}% / p90 ${q(0.9)}% / max ${q(1)}%`);
  console.log(`50 walks (x2 each) took ${dt} ms -> ${dt / 100} ms per full walk`);
}

// --- test 3: real-key sanity of the walk mechanics --------------------------
// The correct-S walk must exist SOMEWHERE if mechanics are right; here just
// record the current best-of-200 random walks against the real key for scale.
{
  let best = { pct: 0 };
  let t0 = Date.now();
  for (let t = 0; t < 200; t++) {
    const S0 = (Math.floor(Math.random() * 2147483647)) >>> 0;
    const b = judge(gridFromSub(S0));
    if (b.pct > best.pct) best = { ...b, S0 };
  }
  console.log(`200 random S vs real key: best ${(100 * best.pct).toFixed(2)}% (S=${best.S0 ?? "-"} at (${best.dI},${best.dJ})), ${((Date.now() - t0) / 200).toFixed(1)} ms/walk-with-judge`);
}
