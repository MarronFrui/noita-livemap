// 2026-09-21-surface-shape.mjs — SHAPE-FIRST surface validation instrument
// (the shape/validation contract, distilled in VERIFIED.md §12;
// run after the dig #21 wiring).
//
// Compares OUR generated world (ensureWorld, seed 78633191, SURFACE_V2=1)
// against the frozen91 reference tiles (mapgen/out/ref/, tx 29..47 ×
// ty 11..19 = chunks cx −6..12, cy −3..5, seed 78633191) with two
// shape-first metrics (OVERALL color/texture detail stays out of scope —
// P4 deferred):
//   1. flat-region rms: over ref pixels whose 5×5 luminance std ≤ 2.0
//      (mapcap DETECT flatStdMax), RMS of the luminance difference
//      gen-vs-ref. Flat pixels = the texture-noise-immune fraction.
//   2. solid density: per-chunk fraction of "solid" = non-void
//      (void = lum ≤ 8) and non-sky (mapcap sky hue rule) on BOTH sides;
//      our side's solid = non-null color from worldColorAt.
//
// Usage: SURFACE_V2=1 node mapgen/experiments/2026-09-21-surface-shape.mjs \
//        [--x0 29 --x1 47 --y0 11 --y1 19]
import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, repoRoot, CAPTURE_SEED } from "../lib/paths.mjs";
import { ensureWorld, worldColorAt, SKY_ROWS } from "../lib/world-gen.mjs";
import { readPng } from "../lib/images.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? Number(process.argv[i + 1]) : fallback;
}

const seed = CAPTURE_SEED;
const x0 = arg("x0", 29), x1 = arg("x1", 47), y0 = arg("y0", 11), y1 = arg("y1", 19);
const refDir = path.join(repoRoot, "mapgen/out/ref");

const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
function isSky(ref) {
  // mapcap sky rule: warm hue 5..60, sat ≤ 0.6, val ≥ 100
  const [r, g, b] = ref;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max, s = max === 0 ? 0 : (max - min) / max;
  if (v < 100 || s > 0.6) return false;
  let h = 0;
  const d = max - min;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return h >= 5 && h <= 60;
}

const world = ensureWorld(seed, findNoitaDataDir(), {});
await world.ready;

const rows = [];
const sum = { n: 0, flatN: 0, flatSq: 0, sq: 0, genSolid: 0, refSolid: 0, refSky: 0, refVoid: 0, n2: 0 };
for (let ty = y0; ty <= y1; ty++) {
  for (let tx = x0; tx <= x1; tx++) {
    const ref = readPng(path.join(refDir, `${tx}_${ty}.png`)); // RGBA
    const w = ref.width;
    const refL = new Float32Array(w * ref.height);
    const refR = [], refG = [], refB = [];
    for (let i = 0; i < w * ref.height; i++) {
      const R = ref.data[4 * i], G = ref.data[4 * i + 1], B = ref.data[4 * i + 2];
      refR.push(R); refG.push(G); refB.push(B);
      refL[i] = 0.299 * R + 0.587 * G + 0.114 * B;
    }
    // 5x5 local std on ref luminance (flat mask)
    const flat = new Uint8Array(w * ref.height);
    for (let y = 2; y < ref.height - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        let s2 = 0, s = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const v = refL[(y + dy) * w + x + dx];
            s += v; n++;
            s2 += v * v;
          }
        const mean = s / n;
        const std = Math.sqrt(Math.max(0, s2 / n - mean * mean));
        flat[y * w + x] = std <= 2.0 ? 1 : 0;
      }
    }
  let r = { chunk: `${tx}_${ty}`, n: 0, flatN: 0, flatSq: 0, sq: 0, genSolid: 0, refSolid: 0, refSky: 0, refVoid: 0 };
    for (let y = 0; y < ref.height; y++) {
      for (let x = 0; x < w; x++) {
        // our render at the SAME canvas coords (canvas ty = biome ty + 48)
        const c = worldColorAt(world, tx * 512 + x, (ty + 48) * 512 + y);
        const gl = c ? lum(c) : null;
        const rl = refL[y * w + x];
        const isVoid = rl <= 8;
        const isSkyc = !isVoid && isSky([refR[y * w + x], refG[y * w + x], refB[y * w + x]]);
        r.n++;
        if (isVoid) r.refVoid++;
        else if (isSkyc) r.refSky++;
        else r.refSolid++;
        if (gl != null && !(c[0] === 9 && c[1] === 9 && c[2] === 9)) r.genSolid++;
        const d = gl == null ? null : gl - rl;
        if (d != null) {
          r.sq += d * d;
          sum.sq += d * d; sum.n++;
          if (flat[y * w + x]) {
            r.flatSq += d * d; r.flatN++;
          }
        }
      }
    }
    const rms = (sq, n) => (n ? Math.sqrt(sq / n) : null);
    rows.push({
      chunk: r.chunk, refSolid: +(r.refSolid / r.n).toFixed(3), refSkyP: +(r.refSky / r.n).toFixed(3),
      genSolid: +(r.genSolid / r.n).toFixed(3),
      flatRms: rms(r.flatSq, r.flatN), rms: rms(r.sq, r.n),
      flatN: r.flatN,
    });
    sum.flatN += r.flatN; sum.flatSq += r.flatSq;
    sum.refSolid += r.refSolid; sum.refSky += r.refSky; sum.refVoid += r.refVoid;
    sum.genSolid += r.genSolid;
    sum.n2 += r.n;
  }
}

const out = {
  seed, window: { x0, x1, y0, y1 },
  allPixelRms: Math.sqrt(sum.sq / sum.n),
  flatPixelRms: (sum.flatN ? Math.sqrt(sum.flatSq / sum.flatN) : null),
  flatCoverage: sum.flatN / sum.n,
  refSolidFrac: sum.refSolid / sum.n2,
  refSkyFrac: sum.refSky / sum.n2,
  refVoidFrac: sum.refVoid / sum.n2,
  genSolidFrac: sum.genSolid / sum.n2,
  rows,
};
const outPath = path.join(repoRoot, "mapgen/out/gen-shape-2026-09-21.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
const worst = rows.filter((r) => r.flatRms != null).sort((a, b) => b.flatRms - a.flatRms).slice(0, 12);
console.log("== summary ==");
console.log("allPixelRms", out.allPixelRms.toFixed(3), "flatPixelRms", out.flatPixelRms?.toFixed(3));
console.log("refSolidFrac", out.refSolidFrac.toFixed(3), "skyFrac", out.refSkyFrac.toFixed(3), "voidFrac", out.refVoidFrac.toFixed(3));
console.log("worst flatRms chunks:", worst);
console.log("wrote", outPath);
