// dig #210 obs-1 — the L3-anchor edge-sliver mechanism (resolves the probe's
// known "stray bin-airDark attributions at grid=-1 slots" instrument debt).
// worldColorAt computes the grid slot from the ANCHORED pixel (gx=wx+11,
// gy=wy+12 — world-gen.mjs:99), while the probe's owner dump labels a chunk
// by its RAW slot (cx,ty). The anchor is 11x12 PIXELS, so the last 11 columns
// / 12 rows of a display chunk belong to the NEXT grid slot — ~1536 of 65536
// samples (2.3%). Predicted: strays only occur inside that sliver, at
// most 1536 samples; observed probe strays = 1434/1429/1404 (ty 61) and
// 1329/1404/1388 (chunk 38,62) — all <= 1536.
import { ensureWorld, L3_ANCHOR } from '/home/marron/work/Noita-livemap/mapgen/lib/world-gen.mjs';
import { findNoitaDataDir, repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import path from 'node:path';

const dataDir = findNoitaDataDir();
const world = ensureWorld(123456789, dataDir, { cacheDir: path.join(repoRoot, 'mapgen/out/gen-cache/r3i') });
await world.ready;

const slot = (gx, gy) => (gx < 0 || gy < 0 || gx >= 71 * 512 || gy >= 144 * 512 ? -1 : world.grid[Math.floor(gy / 512) * 71 + Math.floor(gx / 512)]);
const def = (i) => (i < 0 ? 'idx<0' : `${i}@${path.basename(world.areas[i].def?.filename ?? '')}`);

for (const [cx, ty] of [[35, 61], [36, 61], [37, 61], [38, 62], [35, 62]]) {
  const raw = world.grid[ty * 71 + cx];
  let cross = 0, crossToBin = 0;
  const targets = new Map();
  for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) {
    const wx = cx * 512 + x, wy = ty * 512 + y;
    const a = slot(wx + L3_ANCHOR.x, wy + L3_ANCHOR.y);
    if (a !== raw) {
      cross++;
      const k = def(a);
      targets.set(k, (targets.get(k) ?? 0) + 1);
      if (raw < 0 && a >= 0) crossToBin++;
    }
  }
  console.log(`chunk(${cx},${ty}) raw=${def(raw)}: crossing=${cross} (${(cross / 65536 * 100).toFixed(1)}%) raw<0->slot>=0=${crossToBin} targets=${[...targets.entries()].map(([k, n]) => `${k}:${n}`).join(' ')}`);
}
