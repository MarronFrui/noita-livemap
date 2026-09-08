// Invert the sub-seed S back to the fill's base seed C (the [area+0x4c] value).
//
// Chain (asm-verified, experiments/2026-09-07-area-seed-candidates.mjs):
//   d = C (u32); if (d >= 2147483647) d *= 0.5        // diddle promote + halve
//   state0 = trunc(d)
//   state = step(state0)                               // ctor warm-up (1)
//   skip = (256 % 11) + (C % 12)  =  3 + (C % 12)      // advance skip
//   per attempt a (0-based):  state mode: 1 step, sub = state
//                             nextU mode: 2 steps, sub = trunc(f(state))
//   f(x) = trunc(x * 4.656612875e-10 * 2147483645.0)
// All steps are x -> 16807*x mod (2^31-1); 16807 invertible => walk BACKWARD
// from S to state0 for every (mode, attempt, skip), re-verify forward.

const M = 2147483647n;

function powmod(b, e, m) {
  let r = 1n; b %= m;
  while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; }
  return r;
}
const INV = powmod(16807n, M - 2n, M); // 16807^-1 mod M
const step = (x) => Number(BigInt(16807) * BigInt(x) % M);
const stepBack = (x) => Number(BigInt(INV) * BigInt(x) % M);

const C1 = 4.656612875e-10, C2 = 2147483645.0;
const f = (x) => Math.trunc(x * C1 * C2) >>> 0;

// forward chain from C, returns { sub, state } at attempt A (or null paths)
function forwardSub(C, mode, attempt, skip) {
  let d = C >>> 0;
  if (d >= 2147483647) d = d * 0.5;
  let state = Math.trunc(d);
  state = step(state); // warm-up
  for (let k = 0; k < skip; k++) state = step(state);
  const reps = attempt + 1;
  for (let a = 0; a < reps; a++) {
    state = step(state);
    if (mode === "nextU") state = step(state);
  }
  const sub = mode === "state" ? state : f(state);
  return { sub, state };
}

export function invert(S, opts = {}) {
  const out = [];
  const sBig = BigInt(S);
  // candidate chain states that produce sub == S
  const states = [];
  if (opts.stateMode !== false) states.push({ mode: "state", x: S });
  if (opts.nextUmode !== false) {
    // f(x) == S  =>  x in [S*2^31/2147483645, (S+1)*2^31/2147483645)
    const lo = Math.ceil(S * 2147483648 / 2147483645);
    const hi = Math.ceil((S + 1) * 2147483648 / 2147483645);
    for (let x = lo; x < hi && x < 2147483647; x++) states.push({ mode: "nextU", x });
  }
  for (const { mode, x } of states) {
    for (let attempt = 0; attempt <= 99; attempt++) {
      for (let cmod = 0; cmod < 12; cmod++) {
        const skip = 3 + cmod;
        const back = 1 + skip + (attempt + 1) * (mode === "state" ? 1 : 2);
        let st = x;
        for (let k = 0; k < back; k++) st = stepBack(st);
        // st = state0 = trunc(d); C candidates:
        for (const C of [st, 2 * st, 2 * st + 1]) {
          if (C < 0 || C > 4294967295) continue;
          // halve branch consistency: C = 2*st/2*st+1 only valid if C >= 2147483647
          if (C !== st && C < 2147483647) continue;
          if (C === st && C >= 2147483647) continue; // would have been halved
          if (C % 12 !== cmod) continue;
          const fwd = forwardSub(C >>> 0, mode, attempt, skip);
          if ((fwd.sub >>> 0) === (S >>> 0)) {
            out.push({ C: C >>> 0, mode, attempt, skip, chainState: x });
          }
        }
      }
    }
  }
  return out;
}

// --- main -------------------------------------------------------------------
import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf8"));

const CASES = [
  ["78633191", 1228813614],
  ["78633192", 1319606147],
  ["78633193", 1966969580],
];
for (const [seed, S] of CASES) {
  const ws = Number(seed) >>> 0;
  const hits = invert(S);
  console.log(`seed ${seed} S=${S}: ${hits.length} inversion(s)`);
  for (const h of hits) {
    const delta = (h.C - ws) >>> 0 > 2147483648 ? h.C - ws : h.C - ws;
    console.log(`  C=${h.C} (0x${(h.C >>> 0).toString(16)})  C-ws=${h.C - ws}  mode=${h.mode} attempt=${h.attempt} skip=${h.skip} (C%12=${h.C % 12})`);
  }
  console.log(`  reference: ws=${ws}  ws+13589=${(ws + 13589) >>> 0}`);
}
