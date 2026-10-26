// dig #207 — THE WINTER WAVE OVERLAY: the capture's surface profile vs the
// port's bandRampEval 0.5-crossing, per column, winter band (map cols 11..30).
// The capture profile = the first solid row from the top of bty 12 across
// bty 12..14 ref tiles (wy frame). The port crossing = bisection on
// bandRampEval(driver, uid, wx, y) over y ∈ [-2560, +512].
import { loadBiomeConfig } from '/home/marron/work/Noita-livemap/mapgen/lib/biomes.mjs';
import { findNoitaDataDir, repoRoot, CAPTURE_SEED } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import { makeBandDriver } from '/home/marron/work/Noita-livemap/mapgen/lib/noise-terrain.mjs';
import { bandRampEval } from '/home/marron/work/Noita-livemap/mapgen/lib/noise-proto.mjs';
import { readPng } from '/home/marron/work/Noita-livemap/mapgen/lib/images.mjs';
import fs from 'node:fs';
import path from 'node:path';

const f = Math.fround;
const dataDir = findNoitaDataDir();
const cfg = loadBiomeConfig(dataDir);
const SEED = CAPTURE_SEED;

// the winter uid (the def whose filename = winter.xml) with the driver
const winterDef = [...cfg.biomes.values()].find((d) => path.basename(d.filename ?? '') === 'winter.xml');
if (!winterDef) { console.log('winter def NOT FOUND'); process.exit(1); }
// rebuild uid via bandBlockOf-equivalents (uidFrom is module-private):
const n = (v, d) => { const q = parseFloat(v); return Number.isFinite(q) ? q : d; };
const NOISE_TYPE_KIND = { IQ2_SIMPLEX1234: 0, IQ_SIMPLEX: 1, SIN_CAPPED_EVERYTHING: 2, SIN_CAPPED_SIMPLEX: 3 };
const uid = {
  gradStartY: f(n(winterDef.mGradientStartY, -512)), gradEndY: f(n(winterDef.mGradientEndY, 512)),
  gradSlopeStartX: n(winterDef.mGradientSlopeStartX, 0), gradSlopeDelta: n(winterDef.mGradientSlopeDelta, 1.0),
  mode: n(winterDef.mGradientAddNoise, 1) | 0, gradNoiseScale: n(winterDef.mGradientNoiseScale, 0),
  gradLowNoise: f(n(winterDef.mGradientLowNoise, -100)), gradHighNoise: f(n(winterDef.mGradientHighNoise, 100)),
  noiseKind: 5, sx: n(winterDef.mInsidePerlinScaleX, 1), sy: n(winterDef.mInsidePerlinScaleY, 1), ox: 0, oy: 0,
  offsetBySeed: false, fbm: true, squared: false, clamped: false, scaled: n(winterDef.mInsidePerlinScaled, 0) === 1,
  scaleMin: n(winterDef.mInsidePerlinScaleMin, 0), scaleMax: n(winterDef.mInsidePerlinScaleMax, 0),
  gradWCoef: n(winterDef.mMultiplierPerlin, 1.0), perlinCoef: n(winterDef.mMultiplierGradient, 1.0),
  addValue: n(winterDef.mInsideAddValue, 0),
  addNoise: NOISE_TYPE_KIND[winterDef.noiseType] ?? 0,
  driver: makeBandDriver(cfg, SEED),
};
console.log('winter uid: A', uid.gradStartY, 'B', uid.gradEndY, 'mode', uid.mode, 'low', uid.gradLowNoise, 'high', uid.gradHighNoise, 'scale', uid.gradNoiseScale, 'addNoise', uid.addNoise, 'gradWCoef', uid.gradWCoef, 'xBase', uid.driver.xBase);

// the port's crossing per world-x column: bisection on bandRampEval
function crossing(wx) {
  // r is monotone-ish in y; scan coarsely then bisect the 0.5 upward crossing
  let lo = -2560, hi = 512;
  if (bandRampEval(uid.driver, uid, wx, lo) >= 0.5) return lo;   // solid from the top?
  if (bandRampEval(uid.driver, uid, wx, hi) < 0.5) return null;  // never solid
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bandRampEval(uid.driver, uid, wx, mid) < 0.5) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// the capture's surface profile per column: first solid from wy -1024 down
// through bty 12,13,14 (the ref tiles (tx,12),(tx,13),(tx,14))
const AIR = 24;
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
  const t12 = refTile(tx, 12), t13 = refTile(tx, 13), t14 = refTile(tx, 14);
  if (!t13) return null;
  const out = new Array(512).fill(null);
  for (let x = 0; x < 512; x++) {
    // scan bty12 rows (wy -1024..-512), bty13 (wy -512..0), bty14 (0..512)
    const tiles = [[t12, -1024], [t13, -512], [t14, 0]];
    for (const [t, y0] of tiles) {
      if (!t) continue;
      for (let y = 0; y < 512; y++) {
        const i = 4 * (y * 512 + x);
        if (lum(t.data[i], t.data[i + 1], t.data[i + 2]) >= AIR) { out[x] = y0 + y; break; }
      }
      if (out[x] != null) break;
    }
  }
  return out;
}

console.log('\ncol | capWy med (p10..p90) | port crossing med | n');
for (let tx = 11; tx <= 30; tx++) {
  const cap = capSurface(tx);
  const capVals = cap.filter((v) => v != null).sort((a, b) => a - b);
  const portVals = [];
  for (let x = 0; x < 512; x += 32) {
    const wx = tx * 512 + x - 17920;
    const c = crossing(wx);
    if (c != null) portVals.push(c);
  }
  portVals.sort((a, b) => a - b);
  const med = (a) => a.length ? a[a.length >> 1] : null;
  const p = (a, q) => a.length ? a[Math.floor(a.length * q)] : null;
  const cm = med(capVals), pm = med(portVals);
  console.log(`${tx}  | ${cm == null ? '-' : cm.toFixed(0)} (${p(capVals, 0.1)?.toFixed(0)}..${p(capVals, 0.9)?.toFixed(0)}) n=${capVals.length} | ${pm == null ? '-' : pm.toFixed(0)} n=${portVals.length} | capCov ${((capVals.length / 512) * 100).toFixed(0)}%`);
}
// one detailed column sweep for the wave shape
console.log('\nport crossing wave (per 256px):');
const row = [];
for (let wx = -13000; wx <= -1000; wx += 256) {
  const c = crossing(wx);
  row.push(`${wx}:${c == null ? 'air' : c.toFixed(0)}`);
}
console.log(row.join(' '));
