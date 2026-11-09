// dig #217 — THE SURFACE PHASE TEST + THE TERRAIN-ONLY SURFACE LINE.
//
// Our hills surface depends on the seed ONLY through the band driver's
// xBase (driver[+0x48] = Phase S u2, C119/C120). This instrument:
//   rank  — scores the computed xBase against every xBase in [-1e5, 1e5]
//           step 500 (401 phases) and prints its percentile rank: a wrong
//           seed→xBase chain would land near the median (50 %).
//   draws — scores the first 10 Lehmer draws d0..d9 as the xBase candidate
//           (the port uses d2 = u2, after the ctor's warm draw d0).
//   chunks — the per-chunk median |dy| (ours vs capture).
// The capture line: first px (top-down) with r+g+b > 40; with TERRAIN=1 the
// vegetation is skipped (green px, the pink flowers) and the px must sit on a
// solid mass (x±8, y..y+20 all non-dark) — rejects canopies, grass, trunks.
// Ours: the first solid 10-px cell of noiseChunkMask (SURFACE_V2 lane).
//
// METER-CLASS: E2 (shape/registration score; a sentinel + the phase
// discriminator — it rules on the xBase chain only through the rank test).
//
// Repro (current-build captures, mapcap/out/frozen9{1,2,3}):
//   SURFACE_V2=1 SEED=78633191 REF=frozen91 MODE=rank   node <this>
//   SURFACE_V2=1 SEED=78633192 REF=frozen92 MODE=draws  node <this>
//   SURFACE_V2=1 SEED=78633193 REF=frozen93 MODE=chunks TERRAIN=1 CX=3,11 node <this>
import { noiseChunkMask, makeBandDriver, phaseSXBase } from '../lib/noise-terrain.mjs';
import { loadBiomeConfig } from '../lib/biomes.mjs';
import { findNoitaDataDir, repoRoot } from '../lib/paths.mjs';
import { readPng } from '../lib/images.mjs';
import fs from 'node:fs';
import path from 'node:path';

const SEED = +(process.env.SEED || 78633192);
const REF = process.env.REF || 'frozen92';
const MODE = process.env.MODE || 'rank';
const TERRAIN = !!process.env.TERRAIN;
const CX = (process.env.CX || '4,9').split(',').map(Number);
const CYS = [-2, -1, 0, 1];
const cfg = loadBiomeConfig(findNoitaDataDir());

function capLine() {
  const out = [];
  for (let cx = CX[0]; cx <= CX[1]; cx++) for (let c = 0; c < 51; c++) {
    let y = null;
    for (const cy of CYS) {
      const p = path.join(repoRoot, 'mapcap/out', REF, 'chunks', `chunk_${cx}_${cy}.png`);
      if (!fs.existsSync(p)) continue;
      const t = readPng(p); const x = c * 10 + 5;
      const dark = (xx, yy) => {
        if (xx < 0 || xx > 511) return false;
        const i = 4 * (Math.min(511, yy) * 512 + xx);
        return t.data[i] + t.data[i + 1] + t.data[i + 2] <= 40;
      };
      const veg = (yy) => {
        const i = 4 * (yy * 512 + x); const r = t.data[i], g = t.data[i + 1], b = t.data[i + 2];
        return (g > r + 8 && g > b) || (r > 180 && b > 100 && g < 100);
      };
      for (let yy = 0; yy < 512; yy++) {
        if (dark(x, yy) || (TERRAIN && veg(yy))) continue;
        if (TERRAIN) {
          let ok = true;
          for (let dy = 0; dy <= 20 && ok; dy += 4) for (const dx of [-8, 0, 8]) if (dark(x + dx, yy + dy)) { ok = false; break; }
          if (!ok) continue;
        }
        y = cy * 512 + yy; break;
      }
      if (y != null) break;
    }
    out.push(y);
  }
  return out;
}

function ourLine(xBase) {
  makeBandDriver(cfg, SEED).xBase = xBase; // the driver is (config, seed)-cached
  const out = [];
  for (let cx = CX[0]; cx <= CX[1]; cx++) {
    const masks = CYS.map((cy) => noiseChunkMask(cfg, cx + 35, cy + 62, SEED));
    for (let c = 0; c < 51; c++) {
      let y = null;
      for (let k = 0; k < CYS.length && y == null; k++) {
        const m = masks[k]; if (!m) continue;
        for (let r = 0; r < 51; r++) if (m.mask[52 * r + c]) { y = CYS[k] * 512 + r * 10; break; }
      }
      out.push(y);
    }
  }
  return out;
}

const cap = capLine();
const score = (o) => {
  let s = 0, n = 0;
  for (let i = 0; i < o.length; i++) if (o[i] != null && cap[i] != null) { s += Math.abs(o[i] - cap[i]); n++; }
  return n ? s / n : Infinity;
};
const x0 = phaseSXBase(SEED).xBase;
const o0 = ourLine(x0);
console.log(`seed ${SEED} ref ${REF} xBase ${x0} mean|dy| ${score(o0).toFixed(1)} px (cx ${CX[0]}..${CX[1]}, terrain-only ${TERRAIN})`);

if (MODE === 'rank') {
  const all = [];
  for (let xb = -100000; xb <= 100000; xb += 500) all.push(score(ourLine(xb)));
  all.sort((a, b) => a - b);
  const s0 = score(o0);
  const pct = all.filter((v) => v < s0).length / all.length;
  console.log(`rank: computed ${s0.toFixed(1)} | min ${all[0].toFixed(1)} p10 ${all[all.length / 10 | 0].toFixed(1)} median ${all[all.length >> 1].toFixed(1)} | computed-rank ${(100 * pct).toFixed(1)} % of ${all.length}`);
} else if (MODE === 'draws') {
  let st = SEED < 0 ? SEED + 4294967296 : SEED;
  if (st >= 2147483647) st *= 0.5;
  const f = Math.fround; const line = [];
  for (let k = 0; k < 10; k++) {
    const s = Math.trunc(st) | 0; let r = (16807 * s) % 2147483647; if (r <= 0) r += 2147483647; st = r;
    const xb = f(f(f(r * 4.656612875e-10) * 200000) - 100000);
    line.push(`d${k}:${xb.toFixed(0)}=${score(ourLine(xb)).toFixed(1)}`);
  }
  console.log(`draws (port = d2): ${line.join(' ')}`);
} else if (MODE === 'chunks') {
  const row = [];
  for (let cx = CX[0]; cx <= CX[1]; cx++) {
    const k = (cx - CX[0]) * 51; const d = [];
    for (let i = k; i < k + 51; i++) if (o0[i] != null && cap[i] != null) d.push(Math.abs(o0[i] - cap[i]));
    d.sort((a, b) => a - b);
    row.push(`cx${cx}:${d.length ? d[d.length >> 1] : '-'}`);
  }
  console.log(`median |dy| per chunk (px): ${row.join(' ')}`);
}
