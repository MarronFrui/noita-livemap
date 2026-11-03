// dig #211 — the per-LANE attribution at the surface-line's worst tiles
// (15,17,18,27,34,39 + the aligned control 56): which of our render lanes
// paints the cells that push our first-solid line away from the capture's —
// the planes = the bins' wang map, the fg template buffer, the noise classify,
// the bgImage fallback, the I49 bg plane. Same colors/branches as the obs-1/2
// probes; columns sampled at the capSurface miss sites (top rows 61-62).
import { ensureWorld, worldColorAt } from '/home/marron/work/Noita-livemap/mapgen/lib/world-gen.mjs';
import { findNoitaDataDir } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import { readPng } from '/home/marron/work/Noita-livemap/mapgen/lib/images.mjs';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = findNoitaDataDir();
const SEED = 78633191;
const world = ensureWorld(SEED, dataDir, { cacheDir: '/home/marron/work/Noita-livemap/mapgen/out/gen-cache/r3i' });
await world.ready;
const T = 512;
const TILES = [[15, 60], [15, 61], [17, 61], [18, 61], [27, 61], [34, 61], [39, 61], [56, 61]];
const AIR = 24;
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
for (const [cx, cy] of TILES) {
  console.log(`=== tile (${cx},${cy}) ===`);
  // the OUT: our final render's first-solid profile per column + the family shares
  const out = new Map(); let solid = 0, nulls = 0, top = [];
  for (let y = 0; y < T; y += 2) for (let x = 0; x < T; x += 2) {
    const c = worldColorAt(world, cx * T + x, cy * T + y);
    if (!c) { nulls++; continue; }
    solid++;
    const f = c.join(',');
    out.set(f, (out.get(f) ?? 0) + 1);
  }
  const tot = (T / 2) * (T / 2);
  top = [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `${f}:${(100 * n / tot).toFixed(1)}%`).join(' | ');
  console.log(`  OUT top: ${top} | solid:${(100 * solid / tot).toFixed(1)}% null:${(100 * nulls / tot).toFixed(1)}%`);
  // the capture tile (bty = cy - 48)
  const p = path.join('/home/marron/work/Noita-livemap/mapgen/out/ref', `${cx}_${cy - 48}.png`);
  if (fs.existsSync(p)) {
    const t = readPng(p);
    let csolid = 0;
    for (let y = 0; y < T; y += 2) for (let x = 0; x < T; x += 2) {
      const i = 4 * (y * T + x);
      if (lum(t.data[i], t.data[i + 1], t.data[i + 2]) >= AIR) csolid++;
    }
    console.log(`  REF solid:${(100 * csolid / tot).toFixed(1)}%`);
  }
  // the planes
  const key = `${cx},${cy}`;
  const fg = world.templates?.get(key);
  if (fg) {
    let set = 0; const fam = new Map();
    for (let o = 0; o < fg.length; o += 3 * 16) {
      if (fg[o] === 9 && fg[o + 1] === 9 && fg[o + 2] === 9) continue;
      set++;
      const f = `${fg[o]},${fg[o + 1]},${fg[o + 2]}`;
      fam.set(f, (fam.get(f) ?? 0) + 1);
    }
    const n = Math.ceil(fg.length / (3 * 16));
    const topFg = [...fam.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f, k]) => `${f}:${(100 * k / Math.max(1, set)).toFixed(1)}%`).join(' | ');
    console.log(`  FG  set:${(100 * set / n).toFixed(1)}% | ${topFg}`);
  } else console.log('  FG (none)');
  const bg = world.templates?.get('bg')?.get(key);
  if (bg) {
    let set = 0; const fam = new Map();
    for (let o = 0; o < bg.length; o += 3 * 16) {
      if (bg[o] === 9 && bg[o + 1] === 9 && bg[o + 2] === 9) continue;
      set++;
      const f = `${bg[o]},${bg[o + 1]},${bg[o + 2]}`;
      fam.set(f, (fam.get(f) ?? 0) + 1);
    }
    const n = Math.ceil(bg.length / (3 * 16));
    const topBg = [...fam.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f, k]) => `${f}:${(100 * k / Math.max(1, set)).toFixed(1)}%`).join(' | ');
    console.log(`  BG  set:${(100 * set / n).toFixed(1)}% | ${topBg}`);
  } else console.log('  BG (none)');
  const idx = world.grid[cy * 71 + cx];
  if (idx >= 0) {
    const a = world.areas[idx];
    console.log(`  BIN area ${a.key} rect x${a.area.x1}..${a.area.x2}/y${a.area.y1}..${a.area.y2}`);
  } else console.log('  BIN (no area)');
  // the noise classify (rows 62 only for the mask; use the component at row 61 as air!)
  if (cy >= 62) {
    try {
      const { noiseChunkMask } = await import('/home/marron/work/Noita-livemap/mapgen/lib/noise-terrain.mjs');
      const cfg = (await import('/home/marron/work/Noita-livemap/mapgen/lib/biomes.mjs')).loadBiomeConfig(dataDir);
      const r = noiseChunkMask(cfg, cx, cy, SEED);
      if (r) {
        let s = 0; for (const v of r.mask) if (v) s++;
        console.log(`  NOISE mask solid ${s}/${r.mask.length}`);
      } else console.log('  NOISE (null mask)');
    } catch (e) { console.log('  NOISE err', String(e).slice(0, 80)); }
  }
}
