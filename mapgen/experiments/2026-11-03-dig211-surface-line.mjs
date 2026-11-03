// dig #211 — THE LEFT-TO-RIGHT SURFACE LINE: the user's "perfect match left to
// right" as an E1 meter. Per map column (tx 0..70, 64 samples/tile), the
// FIRST SOLID row from wy -1024 through +512 (bty 12..14 = display rows
// 60..62): the capture's (lum >= 24, the #207 convention) vs OUR FULL RENDER
// (worldColorAt != null, stars included as air via the pale filter). Output =
// the per-tile medians + the median delta (our - cap, px; negative = ours
// lower) + the class (the tile's area bin / the biome map row-14 def) — the
// left-to-right residual profile and its lane owners.
import { ensureWorld, worldColorAt } from '/home/marron/work/Noita-livemap/mapgen/lib/world-gen.mjs';
import { loadBiomeConfig } from '/home/marron/work/Noita-livemap/mapgen/lib/biomes.mjs';
import { findNoitaDataDir, repoRoot, CAPTURE_SEED } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import { readPng } from '/home/marron/work/Noita-livemap/mapgen/lib/images.mjs';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = findNoitaDataDir();
const cfg = loadBiomeConfig(dataDir);
const SEED = CAPTURE_SEED;
const world = ensureWorld(SEED, dataDir, { cacheDir: path.join(repoRoot, 'mapgen/out/gen-cache/r3i') });
await world.ready;

const AIR = 24;
const RUN = 3; // consecutive SOLID SAMPLES (the scan steps 4 world px ⇒ the
// run = >= ~12 world px of vertical mass); the stars/sky art = isolated dots
// and never build the run — replaces the broken pale-star filter (v1 caught
// the classified snow (235,235,236) as "stars" and shifted the winter
// medians by ~+700).
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const refCache = new Map();
function refTile(tx, bty) {
  const k = tx + '_' + bty;
  if (refCache.has(k)) return refCache.get(k);
  const p = path.join(repoRoot, 'mapgen/out/ref', k + '.png');
  const v = fs.existsSync(p) ? readPng(p) : null;
  refCache.set(k, v); return v;
}
// the capture's first-solid wy per column, on a SOLID RUN (bty 12..14)
function capSurface(tx) {
  const tiles = [[refTile(tx, 12), -1024], [refTile(tx, 13), -512], [refTile(tx, 14), 0]];
  if (!tiles[1][0] && !tiles[2][0]) return null;
  const out = new Array(512).fill(null);
  for (let x = 0; x < 512; x++) {
    let run = 0, start = null;
    for (const [t, y0] of tiles) {
      if (!t) continue;
      for (let y = 0; y < 512; y += 4) {
        const i = 4 * (y * 512 + x);
        if (lum(t.data[i], t.data[i + 1], t.data[i + 2]) >= AIR) {
          if (run === 0) start = y0 + y;
          run++;
          if (run >= RUN) { out[x] = start; break; }
        } else run = 0;
      }
      if (out[x] != null) break;
    }
  }
  return out;
}
// our first-solid display y per column on the same solid-run law — worldColorAt
// = the DISPLAY frame: display col = map col (the biome col = display col + 35
// = game + 35·512 per the splice lane's frame law, dig #172; display row =
// bty + 48), so NO x offset here — the -17920 offset belongs to the GAME
// frame (bandRampEval).
function ourSurface(tx) {
  const out = new Array(512).fill(null);
  for (let x = 0; x < 512; x++) {
    const wx = tx * 512 + x;
    let run = 0, start = null;
    for (let wy = -1024; wy < 512; wy += 4) {
      const c = worldColorAt(world, wx, wy + 31744);
      if (c) {
        if (run === 0) start = wy;
        run++;
        if (run >= RUN) { out[x] = start; break; }
      } else run = 0;
    }
  }
  return out;
}
const med = (a) => a.length ? a[a.length >> 1] : null;
const pct = (a, q) => a.length ? a[Math.floor(a.length * q)] : null;
const f0 = (v) => v == null ? '-' : v.toFixed(0);

console.log('tx | cap med(p10..p90) cov | our med(p10..p90) cov | dMed dP50(w) | bin/def');
let totD = [], nCols = 0, worst = [];
for (let tx = 0; tx <= 70; tx++) {
  const cap = capSurface(tx);
  if (!cap) continue;
  const capS = [], ourS = [], deltas = [];
  const our = ourSurface(tx);
  for (let x = 0; x < 512; x += 8) {
    nCols++;
    const c = cap[x], o = our[x];
    if (c != null) capS.push(c);
    if (o != null) ourS.push(o);
    if (c != null && o != null) { deltas.push(o - c); totD.push(o - c); }
    else if (c != null || o != null) { deltas.push(c == null ? +1024 : -1024); totD.push(c == null ? +1024 : -1024); }
  }
  capS.sort((a, b) => a - b); ourS.sort((a, b) => a - b); deltas.sort((a, b) => a - b);
  const cm = med(capS), om = med(ourS), dm = med(deltas);
  const bin = world.grid[62 * 71 + (tx - 35)] ?? -1;
  const a = bin >= 0 ? world.areas[bin] : null;
  const def = a ? path.basename(a.def?.filename ?? a.key) : (cfg.biomeAt ? '' : '');
  console.log(`${String(tx).padStart(2)} | ${f0(cm)}(${f0(pct(capS, .1))}..${f0(pct(capS, .9))}) ${((capS.length / 64) * 100).toFixed(0)}% | ${f0(om)}(${f0(pct(ourS, .1))}..${f0(pct(ourS, .9))}) ${((ourS.length / 64) * 100).toFixed(0)}% | ${f0(dm)} ${f0(pct(deltas, .5))} | ${a ? a.key + ' ' + def : '--'}`);
  if (dm != null) worst.push([Math.abs(dm), tx, dm]);
}
totD.sort((a, b) => a - b);
console.log(`\nTOTAL columns=${nCols} | delta median=${med(totD)?.toFixed(0)} p10=${pct(totD, .1)?.toFixed(0)} p90=${pct(totD, .9)?.toFixed(0)} | |d|<=50: ${(100 * totD.filter(d => Math.abs(d) <= 50).length / totD.length).toFixed(1)}%`);
worst.sort((a, b) => b[0] - a[0]);
console.log('worst tiles (|dMed|): ' + worst.slice(0, 10).map(([_, tx, d]) => `${tx}:${d.toFixed(0)}`).join(' '));
