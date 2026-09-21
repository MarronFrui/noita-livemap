// 2026-09-21-noise-window.mjs — the NOISE-BAND SELF-INSTRUMENT (dig #24).
// Root-cause of the "zero procedural chunks" diagnostic: the earlier passes
// probed noiseChunkMask with BIOME-ty windows (the handoff window ty 11..19),
// while the hills-family noise band lives at CANVAS ty 48..50 (= biome rows
// 0..2); noiseChunkMask takes CANVAS chunk coords (it subtracts SKY_ROWS
// itself) so the biome/canvas slip pointed every pass at the wrong rows.
//
// This instrument enumerates the exact V2 masks in the ref window
// (tx 29..47 × canvas ty 48..50) and measures PER-CHUNK:
//   - flat-mask luminance RMS (ref 5×5 local std ≤ 2.0, mapcap DETECT rule)
//   - solid density on BOTH sides (gen = non-null worldColorAt, mapcap
//     void = luma ≤ 8, sky = the mapcap warm-hue rule)
// Output: mapgen/out/noise-window-2026-09-21.json
import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, repoRoot, CAPTURE_SEED } from "../lib/paths.mjs";
import { ensureWorld, worldColorAt } from "../lib/world-gen.mjs";
import { loadBiomeConfig } from "../lib/biomes.mjs";
import { noiseChunkMask } from "../lib/noise-terrain.mjs";
import { readPng } from "../lib/images.mjs";

const seed = CAPTURE_SEED;
const x0 = 4, x1 = 10;   // dig #24's second window = the LAKE set (bitmap_noise_file!)
// dig #24 enumerating turned the coordinate model on its head: the noise
// lane's areas live at tx (lake 4–10, hills 6–42, desert 45–58, pyramid
// 53–57) × canvas cy 48+. We measure EVERY V2 chunk mask and fetch the
// ref tile for it on the fly (bench:ref writes per-biome-px tile files).
const CY0 = 48, CY1 = 82;
const refDir = path.join(repoRoot, "mapgen/out/ref");
const lumr = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
function isSky(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max < 100) return false;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  if (s > 0.6) return false;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return h >= 5 && h <= 60;
}

const config = loadBiomeConfig(findNoitaDataDir());
const world = ensureWorld(seed, findNoitaDataDir(), {});
await world.ready;

const rows = [];
let sumN = 0, sumFlatSq = 0, sumSq = 0, sumFlatN = 0, genSolid = 0, refSolid = 0, refSky = 0, refVoid = 0, probeV2 = 0;
for (let cy = CY0; cy <= CY1; cy++) {
  const tyBiome = cy - 48; // ref tiles are written by BIOME-px ty (bench:ref)
  for (let tx = x0; tx <= x1; tx++) {
    const maskInfo = noiseChunkMask(config, tx, cy);
    const refPath = path.join(refDir, `${tx}_${tyBiome}.png`);
    if (!fs.existsSync(refPath)) continue; // no ref coverage for this chunk
    if (!maskInfo) continue; // not a procedural chunk — not our judge
    const isV2 = !!maskInfo.v2;
    if (isV2) probeV2++;
    const ref = readPng(refPath);
    if (!ref?.data) continue;
    const w = ref.width, h = ref.height;
    const refL = new Float32Array(w * h);
    const refR = new Uint8Array(w * h), refG = new Uint8Array(w * h), refB = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const R = ref.data[4*i], G = ref.data[4*i+1], B = ref.data[4*i+2];
      refR[i] = R; refG[i] = G; refB[i] = B; refL[i] = lumr(R, G, B);
    }
    const flat = new Uint8Array(w * h);
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      let s2 = 0, s = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const v = refL[(y+dy)*w + x + dx]; s += v; s2 += v*v; n++;
      }
      const mean = s/n;
      flat[y*w + x] = Math.sqrt(Math.max(0, s2/n - mean*mean)) <= 2.0 ? 1 : 0;
    }
    let nPx = 0, sq = 0, flatSq = 0, flatN = 0, gs = 0, rs = 0, rsky = 0, rvoid = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = worldColorAt(world, tx * 512 + x, cy * 512 + y);
      const gl = c ? lumr(c[0], c[1], c[2]) : null;
      const i = y * w + x;
      const isVoid = refL[i] <= 8;
      if (isVoid) { rvoid++; } else if (isSky(refR[i], refG[i], refB[i])) { rsky++; } else { rs++; }
      nPx++; if (gl != null) gs++;
      const d = gl == null ? null : gl - refL[i];
      if (d != null) { sq += d*d; if (flat[i]) { flatSq += d*d; flatN++; } }
    }
    rows.push({ chunkId: `${tx}_${cy}`, v2: isV2, flatN,
      flatRms: flatN ? Math.sqrt(flatSq / flatN) : null,
      rmS: Math.sqrt(sq / nPx), genSolid: +(gs / nPx).toFixed(3),
      refSolid: +(rs / nPx).toFixed(3), refSky: +(rsky / nPx).toFixed(3) });
    sumN += nPx; sumSq += sq; sumFlatSq += flatSq; sumFlatN += flatN;
    genSolid += gs; refSolid += rs; refSky += rsky; refVoid += rvoid;
  }
}
const out = {
  seed, window: { tx: [x0, x1], canvasCy: [CY0, CY1] },
  v2ChunkCount: probeV2,
  allPixelRms: Math.sqrt(sumSq / sumN),
  flatPixelRms: sumFlatN ? Math.sqrt(sumFlatSq / sumFlatN) : null,
  flatCoverage: sumFlatN / sumN,
  genSolidFrac: genSolid / sumN, refSolidFrac: refSolid / sumN,
  refSkyFrac: refSky / sumN, refVoidFrac: refVoid / sumN,
  rows,
};
const outPath = path.join(repoRoot, "mapgen/out/noise-window-lake-2026-09-21.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
const worst = rows.filter((r) => r.flatRms != null).sort((a, b) => b.flatRms - a.flatRms).slice(0, 10);
console.log("== noise-window summary ==");
console.log("v2 chunks measured:", probeV2, "of", rows.length, "procedural chunks");
console.log("allPixelRms", out.allPixelRms.toFixed(3), "flatPixelRms", out.flatPixelRms?.toFixed(3), "flatCov", out.flatCoverage.toFixed(3));
console.log("genSolid", out.genSolidFrac.toFixed(3), "refSolid", out.refSolidFrac.toFixed(3), "skyFrac", out.refSkyFrac.toFixed(3));
console.log("worst:", worst);
console.log("wrote", outPath);
