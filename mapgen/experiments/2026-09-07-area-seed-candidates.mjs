// Area-seed candidate sweep (2026-09-07) — the numeric resolution attempt for
// the fill's [area+0x4c] seed input (FUN_00904c20 reads the int at this+0x4c).
//
// VERDICT (after ~40 seed candidates × 4 draw conventions × attempts 0..99 ×
// offsets (dI −6..6, dJ −6..10) × widths 248..266 × skip deltas): NO candidate
// walks the 548-vertex lab key (best ≈ 60-65% = the extreme-value noise
// ceiling). The binary-exact recipe below is asm-verified at every link;
// therefore the fill's runtime seed is NOT any statically-decoded derivation
// of the worldseed. See ABOUT_MATH §7novies + ghidra-ledger.md (hunt 37-45).
//
// Binary-exact recipe (all asm-verified this session):
//   seed = (int)[area+0x4c]                         (asm 0x904d3b: MOV EAX,[ESI+0x4c])
//   [area+0x4c] = areaCtorArg = GetSeed() + 13589   (asm 0x9062d4, 0x904b71;
//                    DAT_01328010 = NEW_GAME_PLUS_COUNT magic default 13589)
//   d = diddle(seed); if (d >= 2147483647) d *= 0.5 (asm 0x905238-0x90525c)
//   Next(&d) warm-up                                (asm 0x905264: LEA ECX,[ESP+0x24])
//   skip = (width % 11) + (u32)seed % 12            (asm 0x905273-0x9052b1; the
//                    width term in the decompile is PART of the %11 algebra)
//   per attempt: d = Schrage(d); sub = d * 4.656612875e-10 * 2147483645
//                   (untruncated double, asm 0x905697/0x90569f)
//   TLS Random: state = sub (halved if >= 2^31: never), one Next() warm-up
//                   (asm 0x8edb10-0x8edb14)
//   vertex coloring (FUN_008ec9f0, asm 0x8eca53-0x8ecac5):
//     row-major; class = (col + (1 - row)) & 3  ← row counter starts 1, DECREMENTS
//       (the 2026-09-07 "(i+j)&3 correction" was a misread of this counter;
//        in key space after the +4-row discard it equals the lab's (I-J)&3)
//     draw: Next(); XMM0 = state * 4.656612875e-10 (Next's RETURN, asm 0x109932);
//           *= 2147483645 (asm 0x8eca9e); (u64)trunc (FUN_01033781); % cc
//       => color = nextU() % cc   (the port's convention, asm-confirmed)
//   rep-reduce: reroll = (old + 1 + nextU() % (cc-1)) % cc, gated cc > 1
//       (FUN_008ec8e0 asm: Next; MULSD x2147483645; (u64); DIV)
//   choose_tile: 2-pass count-then-pick, draw = nextU() % count
//       (FUN_008ec710 asm: inline Schrage; CVTDQ2PD; MULSD x2; (u64); DIV)
//   +4-row discard (FUN_008eda10 copy loop j=-4.., asm/decompile verified)
//   hasPath retry: ONE advance per attempt (no extra failure draw)
//
// The mSeed ctor (FUN_00904730 / Init-inlined): Nexts advance the LOCAL chain
// (codegen pattern asm-confirmed in 00904c20); with x86 CVTTSD2SI saturation
// stateA/stateB become SEED-CONSTANT for ws >= ~214844 — they cannot be the
// fill's seed (the lab's 91-vs-93 outputs are coin-flips apart) — consistent
// with the negative sweep.

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { buildTileset, NollaPrng } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const f32 = Math.fround;

function cvttsd2si(x) {
  if (!Number.isFinite(x)) return -2147483648;
  const t = Math.trunc(x);
  if (t < -2147483648 || t > 2147483647) return -2147483648;
  return t;
}

function schrageBin(state) {
  const n = cvttsd2si(state);
  const q = Math.trunc(n / 127773);
  let v = (Math.imul(16807, n) - Math.imul(2147483647, q)) | 0;
  if (v <= 0) v = (v + 2147483647) | 0;
  return v;
}

const _dv = new DataView(new ArrayBuffer(8));
const f32bits = (v) => { _dv.setFloat32(0, f32(v)); return _dv.getUint32(0); };
const dblHi32 = (v) => { _dv.setFloat64(0, v); return _dv.getUint32(4); };
const dblLo32 = (v) => { _dv.setFloat64(0, v); return _dv.getUint32(0); };
const truncWrap = (v) => Number(BigInt.asUintN(32, BigInt(Math.trunc(v))));
const truncSat = (v) => cvttsd2si(v) >>> 0;

function ctorChainV1(ws) {
  let d = ws >>> 0;
  d = schrageBin(d);
  const mSeed = f32(f32(f32(d) * 9999.0) + 1.0);
  d = schrageBin(mSeed);
  const stateA = f32(f32(f32(d) * 200000.0) - 100000.0);
  d = schrageBin(stateA);
  const stateB = f32(f32(f32(d) * 200000.0) - 100000.0);
  return { mSeed, stateA, stateB };
}

function ctorChainV2(ws) {
  const fd = f32(ws >>> 0);
  const mSeed = f32(f32(fd * 9999.0) + 1.0);
  const stateA = f32(f32(mSeed * 200000.0) - 100000.0);
  const stateB = f32(f32(stateA * 200000.0) - 100000.0);
  return { mSeed, stateA, stateB };
}

function ctorG94(seed) {
  let d = seed >>> 0;
  if (d >= 2147483647) d = d * 0.5;
  d = schrageBin(d);
  d = schrageBin(d);
  return f32(f32(d) * 200000.0) - 100000.0;
}

const W = 256, H = 102, S = 4;

const DRAWS = {
  state: (rng, cc) => (rng.next(), rng.seed % cc),
  nextUmod: (rng, cc) => rng.nextU() % cc,
  nextmul: (rng, cc) => Math.trunc(rng.next() * cc),
  uhalf: (rng, cc) => (rng.nextU() >>> 1) % cc,
};

function vertexGrid(seedU32, attemptIdx, drawName, NC, xmax, ymax, skipDelta, subMode) {
  let d = seedU32;
  if (d >= 2147483647) d = d * 0.5;
  const area = new NollaPrng(0);
  area.seed = d;
  area.next();
  const skip = Math.max(0, (W % 11) + (seedU32 % 12) + skipDelta);
  for (let k = 0; k < skip; k++) area.next();
  let sub = 0;
  for (let a = 0; a <= attemptIdx; a++) {
    area.next();
    sub = subMode === "state" ? area.seed : area.nextU();
  }
  const rng = new NollaPrng(sub);
  const draw = DRAWS[drawName];
  const c = [];
  for (let j = 0; j < ymax; j++) {
    c[j] = new Array(xmax);
    for (let i = 0; i < xmax; i++) c[j][i] = draw(rng, NC[(i - j + 1) & 3]);
  }
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

const SEEDS = ["78633191", "78633192", "78633193"];
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf8"));
const ts = buildTileset(readPng(repoRoot + "/mods/noita-wang-lab/files/wang_tiles/lab.png"));
const NC = ts.numColor;
const xmax = Math.floor(W / S) + 6;
const ymax = Math.floor((H + 4) / S) + 6;

const keys = {};
for (const seed of SEEDS) {
  const list = [];
  for (const [k, color] of Object.entries(grids[seed].grid)) {
    const [I, J] = k.split(",").map(Number);
    list.push({ I, J, color, informative: ((((I - J) % 4) + 4) % 4) % 2 === 0 });
  }
  keys[seed] = list;
}

function candidatesFor(ws) {
  const cands = [{ name: "raw.ws", u32: ws >>> 0 }];
  for (let C = 13580; C <= 13600; C++) cands.push({ name: "ws+" + C, u32: (ws + C) >>> 0 });
  let d = ws >>> 0;
  for (let k = 1; k <= 16; k++) { d = schrageBin(d); cands.push({ name: "schrage^" + k, u32: d >>> 0 }); }
  const r0 = new NollaPrng(0); r0.seed = ws >>> 0;
  cands.push({ name: "nextU(ws)", u32: r0.nextU() });
  for (const [label, x, y] of [["0,0", 0, 0], ["world", -16896, 11264], ["biome", 2, 36], ["chunk", -33, 22]]) {
    cands.push({ name: "mixer(" + label + ").state", u32: seededPrngState(ws, x, y) });
  }
  const V1 = ctorChainV1(ws);
  const V2 = ctorChainV2(ws);
  const encs = [
    { label: "f32bits", fn: f32bits }, { label: "hi32", fn: dblHi32 }, { label: "lo32", fn: dblLo32 },
    { label: "truncwrap", fn: truncWrap }, { label: "truncsat", fn: truncSat },
  ];
  for (const [name, v] of [["V1.mSeed", V1.mSeed], ["V1.stateA", V1.stateA], ["V1.stateB", V1.stateB],
                           ["V2.mSeed", V2.mSeed], ["V2.stateA", V2.stateA], ["V2.stateB", V2.stateB]]) {
    for (const e of encs) cands.push({ name: name + ":" + e.label, u32: e.fn(v) });
  }
  for (const base of [ws, (ws + 13589) >>> 0]) {
    const g = ctorG94(base);
    for (const e of encs) cands.push({ name: "g94(" + base + "):" + e.label, u32: e.fn(g) });
  }
  const seen = new Set();
  return cands.filter((c) => (seen.has(c.u32) ? false : (seen.add(c.u32), true)));

  function seededPrngState(ws2, x, y) {
    // local copy of the verified mixer (seededPrng) returning the final state
    const a = (ws2 >>> 0) ^ 0x93262e6f;
    const b = a & 0xfff, c2 = (a >>> 0x0c) & 0xfff;
    const U32 = 4294967296;
    const usub = (p, q) => (p - q + U32) >>> 0;
    const uadd = (p, q) => (p + q) >>> 0;
    const helper = (v) => {
      if (!Number.isFinite(v) || v < -9.223372036854776e18 || v >= 9.223372036854776e18) return 0;
      return Number(BigInt.asUintN(32, BigInt(Math.trunc(v))));
    };
    const helper2 = (a2, b2, ws3) => {
      let v2 = usub(usub(a2, b2), ws3) ^ (ws3 >>> 0x0d);
      let v1 = usub(usub(b2, v2), ws3) ^ u32v(v2 << 8);
      let v3 = usub(usub(ws3, v2), v1) ^ (v1 >>> 0x0d);
      v2 = usub(usub(v2, v1), v3) ^ (v3 >>> 0x0c);
      v1 = usub(usub(v1, v2), v3) ^ u32v(v2 << 0x10);
      v3 = usub(usub(v3, v2), v1) ^ (v1 >>> 5);
      v2 = usub(usub(v2, v1), v3) ^ (v3 >>> 3);
      v1 = usub(usub(v1, v2), v3) ^ u32v(v2 << 10);
      return u32(usub(usub(v3, v2), v1) ^ (v1 >>> 0x0f));
      function u32v(x) { return x >>> 0; }
      function u32(x) { return x >>> 0; }
    };
    const xAdj = x + b;
    let yAdj = y + c2;
    let material = xAdj * 134217727.0;
    const e = helper(material);
    if (Math.abs(yAdj) >= 102400.0 || Math.abs(xAdj) <= 1.0) material = yAdj * 134217727.0;
    else { let yWork = yAdj * 3483.328; yWork += e; yAdj *= yWork; material = yAdj; }
    const f = helper(material);
    const g = helper2(e, f, ws2 >>> 0);
    const DIDDLERS = [0, 4, 6, 25, 12, 39, 52, 9, 21, 64, 78, 92, 104, 118, 18, 32, 44];
    const MAGIC = 252645135;
    let t = g;
    const asU32 = (b3) => (b3 ? 1 : 0);
    t = uadd(t, uadd(asU32(g < 2147483648), asU32(g === 0)));
    t = usub(t, Math.floor(g / MAGIC));
    t = uadd(t, asU32(g % MAGIC < DIDDLERS[Math.floor(g / MAGIC)] && (g < 0xc3c3c3c3 + 4 || g >= 0xc3c3c3c3 + 62)));
    t = ((uadd(t, asU32(g > 2147483648))) >>> 1) >>> 0;
    t = uadd(t, asU32(g === 0xffffffff));
    const rng = new NollaPrng(0);
    rng.seed = t;
    rng.next();
    for (let h2 = (ws2 >>> 0) & 3; h2 !== 0; h2--) rng.next();
    return rng.seed >>> 0;
  }
}

const results = [];
for (const seed of SEEDS) {
  const ws = Number(seed) >>> 0;
  const key = keys[seed];
  for (const cand of candidatesFor(ws)) {
    for (const drawName of Object.keys(DRAWS)) {
      for (const attempt of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        for (const skipDelta of [-2, -1, 0, 1, 2]) {
          for (const subMode of ["nextU", "state"]) {
            const c = vertexGrid(cand.u32, attempt, drawName, NC, xmax, ymax, skipDelta, subMode);
            const colors = new Map();
            for (let j = 0; j < ymax; j++) for (let i = 0; i < xmax; i++) colors.set(i + "," + j, c[j][i]);
            let best = null;
            for (let dJ = -6; dJ <= 10; dJ++) {
              for (let dI = -6; dI <= 6; dI++) {
                let m = 0, n = 0;
                for (const v of key) {
                  if (!v.informative) continue;
                  const got = colors.get((v.I + dI) + "," + (v.J + dJ));
                  if (got === undefined) continue;
                  n++;
                  if (got === v.color) m++;
                }
                if (n < 10) continue;
                const pct = m / n;
                if (!best || pct > best.pct) best = { dI, dJ, pct };
                if (pct === 1) break;
              }
              if (best && best.pct === 1) break;
            }
            results.push({ seed, cand: cand.name, draw: drawName, attempt, skipDelta, subMode, best });
            if (best && best.pct === 1) {
              console.log(`*** PERFECT: ${seed} ${cand.name} draw=${drawName} attempt=${attempt} skipDelta=${skipDelta} sub=${subMode} off=(${best.dI},${best.dJ})`);
            }
          }
        }
      }
    }
  }
  console.log(`seed ${seed} done (${results.filter((r) => r.seed === seed).length} walks)`);
}

console.log("\n=== TOP 10 per seed ===");
for (const seed of SEEDS) {
  const rs = results.filter((r) => r.seed === seed && r.best).sort((a, b) => b.best.pct - a.best.pct).slice(0, 10);
  console.log(`--- ${seed} ---`);
  for (const r of rs) console.log(`  ${(100 * r.best.pct).toFixed(2)}%  ${r.cand} draw=${r.draw} att=${r.attempt} sd=${r.skipDelta} sub=${r.subMode} off=(${r.best.dI},${r.best.dJ})`);
}
const anyPerfect = results.find((r) => r.best && r.best.pct === 1);
console.log(anyPerfect ? "\nWINNER — extend verification to 92/93 + save." : "\nNEGATIVE (expected — see header): the fill's runtime seed is not any statically-decoded derivation. Next: in-game probe of [area+0x4c] / the TLS stream at fill time.");
