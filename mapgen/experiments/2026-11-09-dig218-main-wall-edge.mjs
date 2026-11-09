// dig #218 — the MAIN-BAND wall edge meter (METER-CLASS: E1): at every vertical
// `solid_wall | wang` chunk line in map rows 15..46, per row (every 8 px) the
// edge position walked from 60 px inside the wall until 4 consecutive non-rock
// px — in the capture (the 2024 stitch tiles mapgen/out/ref; the law is
// seed-free) or, with RENDER=1, in our render (worldColorAt, seed 78633191) —
// compared with the law (biomeAtPixel's first non-solid_wall px, C187) and with
// the straight chunk line. Repro: node <this>   |   RENDER=1 node <this>

import { loadBiomeConfig, biomeChunkDef, biomeAtPixel } from '../lib/biomes.mjs';
import { findNoitaDataDir } from '../lib/paths.mjs';
import { readPng } from '../lib/images.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../lib/paths.mjs';
import { ensureWorld, worldColorAt } from '../lib/world-gen.mjs';
const world = ensureWorld(78633191, findNoitaDataDir(), { cacheDir: path.join(repoRoot, 'mapgen/out/gen-cache/r3n') }); await world.ready;
const cfg = loadBiomeConfig(findNoitaDataDir());
const nm = (d) => d?.filename.split('/').pop().replace('.xml', '');
const isWall = (r, g, b) => r >= 35 && g >= 19 && r <= 110 && g <= 70 && b <= 60 && r > g && g >= b; // the rock_hard family (dig #216 census)
const tiles = new Map();
const tile = (cx, cy) => { const k = cx + '_' + cy; if (!tiles.has(k)) { const p = path.join(repoRoot, 'mapgen/out/ref', k + '.png'); tiles.set(k, fs.existsSync(p) ? readPng(p) : null); } return tiles.get(k); };
const pxCap = (X, Y) => { const t = tile(Math.floor(X / 512), Math.floor(Y / 512)); if (!t) return null; const i = 4 * ((Y & 511) * 512 + (X & 511)); return [t.data[i], t.data[i + 1], t.data[i + 2]]; };
const px = process.env.RENDER ? (X, Y) => worldColorAt(world, X, Y + 48 * 512) ?? [0, 0, 0] : pxCap;
const law = [], line = [];
let segs = 0;
for (let y = 15; y < 47; y++) for (let x = 0; x < 69; x++) {
  const a = biomeChunkDef(cfg, x, y), b = biomeChunkDef(cfg, x + 1, y);
  if (!a || !b || a === b || !a.noiseBiomeEdges || !b.noiseBiomeEdges) continue;
  const wallLeft = nm(a) === 'solid_wall' && b.templateFile, wallRight = nm(b) === 'solid_wall' && a.templateFile;
  if (!wallLeft && !wallRight) continue;
  segs++;
  const X0 = (x + 1) * 512;
  for (let Y = y * 512 + 50; Y < y * 512 + 462; Y += 8) {
    // capture edge: from the wall side, walk toward the cave until 4 consecutive non-wall px
    const dir = wallLeft ? 1 : -1; let start = X0 - dir * 60, cap = null, miss = 0;
    for (let k = 0; k <= 120; k++) { const X = start + dir * k; const c = px(X, Y); if (!c) { cap = null; break; }
      if (isWall(...c)) miss = 0; else if (++miss === 4) { cap = X - dir * 3; break; } }
    if (cap == null) continue;
    let pred = null;
    for (let k = 0; k <= 120; k++) { const X = start + dir * k; if (biomeAtPixel(cfg, X, Y) !== (wallLeft ? a : b)) { pred = X; break; } }
    if (pred == null) continue;
    law.push(Math.abs(cap - pred)); line.push(Math.abs(cap - X0));
  }
}
const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
const le = (a, t) => (100 * a.filter((v) => v <= t).length / a.length).toFixed(1);
console.log(`segments ${segs}, rows ${law.length}`);
console.log(`law:      median ${med(law)} px, ≤4 px ${le(law, 4)} %, ≤8 px ${le(law, 8)} %`);
console.log(`straight: median ${med(line)} px, ≤4 px ${le(line, 4)} %, ≤8 px ${le(line, 8)} %`);
