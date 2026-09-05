// Derived-state families from the binary decode (2026-09-05).
import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";
import { NollaPrng, seededPrng } from "../lib/wang-js.mjs";

const MAIN = 78633191;
const W = 256, H = 102, S = 4;
const NC = [2, 1, 2, 1];
const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf-8"));
const classOfL = (i, j) => (((i - j) % 4) + 4) % 4;
const obs = [];
for (const [key, color] of Object.entries(grids["78633191"].grid)) {
  const [I, J] = key.split(",").map(Number);
  if (classOfL(I, J) === 1 || classOfL(I, J) === 3) continue;
  obs.push({ I, J, color });
}
console.log("informative vertices:", obs.length);


const derivedFloat = Math.fround(Math.fround(MAIN) * 200000.0 - 100000.0);
const derivedInt = Math.abs(Math.trunc(derivedFloat)) % 2147483646 + 1;
const VMAX_I = Math.floor(W / S) + 6, VMAX_J = Math.floor(H / S) + 6;
function walk(makeRng) {
  const rng = makeRng();
  let m = 0;
  for (let j = 0; j < VMAX_J; j++)
    for (let i = 0; i < VMAX_I; i++) {
      const c = rng.nextU() % NC[classOfL(i, j)];
      const want = obs.find((v) => v.I === i && v.J === j);
      if (want && c === want.color) m++;
    }
  return (100 * m / obs.length).toFixed(2);
}

// derived state from the binary
const f32 = Math.fround;
const derivedF32 = f32(f32(MAIN) * 200000.0 - 100000.0);
console.log("derived float32:", derivedF32);

const results = [];

// F1
results.push({ f: "F1: derived_int→NollaPrng walk", pct: walk(() => new NollaPrng(derivedInt)) });

// F2: float bits as u32
const fbuf = Buffer.alloc(4);
fbuf.writeFloatLE(derivedFloat);
const bitsSeed = fbuf.readUInt32LE() % 2147483646 + 1;
results.push({ f: "F2: float_bits→u32→NollaPrng walk", pct: walk(() => new NollaPrng(bitsSeed)) });

// F3
results.push({ f: "F3: seededPrng(ws,area) walk", pct: walk(() => seededPrng(MAIN, -16896, 11264)) });

// F4
results.push({ f: "F4: worldseed→2×Next→walk", pct: walk(() => {
  const r = new NollaPrng(0);
  r.setRandomFromWorldSeed(MAIN);
  r.next(); r.next();
  return r;
}) });

// F5
results.push({ f: "F5: raw_seed→NollaPrng walk", pct: walk(() => new NollaPrng(MAIN)) });

// F6
results.push({ f: "F6: derived_int→NollaPrng warm+random walk", pct: walk(() => {
  const r = new NollaPrng(derivedInt);
  r.next();
  return r;
}) });

// F7
const binBuf = fs.readFileSync("/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe");
const df988 = binBuf.readDoubleLE(0x11df988 - 0x400e00);
const de0220 = binBuf.readDoubleLE(0x11e0220 - 0x400e00);
console.log("FUN_008efdd0 constants: df988 =", df988, "e0220 =", de0220);
const efdd0Derived = Math.trunc(MAIN * df988 * de0220);
results.push({ f: "F7: efdd0_derived→NollaPrng walk", pct: walk(() => new NollaPrng(Math.abs(efdd0Derived) % 2147483646 + 1)) });

console.log("\n=== RESULTS (sorted) ===");
results.sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));
for (const r of results) console.log(`  ${r.f}: ${r.pct}`);
console.log("\nnoise floor at n=548: ~58.5% — anything at or below is chance");
console.log("a TRUE hit = 100.00%");
