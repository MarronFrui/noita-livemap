// dig #212 — WINTER PLACEMENT PROFILE: E1 measurement of the winter band's
// first-solid row per column (our full render vs capture) to isolate the
// level error. Winter tiles are tx 14..28 (biome map row 14, the spawn
// surface band's west half). Output: per-tile median delta (our - cap, px).
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
const RUN = 3;
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const refCache = new Map();
function refTile(tx, bty) {
  const k = tx + '_' + bty;
  if (refCache.has(k)) return refCache.get(k);
  const p = path.join(repoRoot, 'mapgen/out/ref', k + '.png');
  const v = fs.existsSync(p) ? readPng(p) : null;
  refCache.set(k, v); return v;
}
function capSurface(tx) {
  const tiles = [[refTile(tx, 12), -1024], [refTile(tx, 13), -512], [refTile(tx, 14), 0]];
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
const med = (a) => { if (!a.length) return null; const s = [...a].sort((u,v)=>u-v); return s[s.length>>1]; };
for (let tx = 14; tx <= 28; tx++) {
  const cap = capSurface(tx);
  const ours = ourSurface(tx);
  const deltas = [];
  for (let x = 0; x < 512; x += 8) {
    if (cap[x] != null && ours[x] != null) deltas.push(ours[x] - cap[x]);
  }
  const biome = cfg.biomeAt ? cfg.biomeAt(tx, 14) : '?';
  console.log(`tx=${tx} biome=${biome} n=${deltas.length} medDelta=${med(deltas)} capMed=${med(cap.filter(v=>v!=null))} oursMed=${med(ours.filter(v=>v!=null))}`);
}