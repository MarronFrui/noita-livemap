// 2026-10-19-dig170-lake-band-counts.mjs — dig #170 count-law instrument
// (E1). Lake tile 40_14, band rows 160-287 (display rows 31904-32031):
// the NEW law (C145: template lane reads at the DISPLAY frame + the splice
// lane's grey -> hosting-biome band fill) vs the OLD law (generator-local
// template read + grey = keep-content skip). Also the identity-alignment
// water count: gen-water intersect capture-water.
// Reproduction: node mapgen/experiments/2026-10-19-dig170-lake-band-counts.mjs

import { blitSplicedScenes } from "../lib/template-render.mjs";
import { loadBiomeConfig } from "../lib/biomes.mjs";
import { worldColorAt } from "../lib/world-gen.mjs";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { readPng } from "../lib/images.mjs";

const DATA = findNoitaDataDir();
const SEED = 78633191;
const config = loadBiomeConfig(DATA);

// NEW law: splice blit with config+seed (the grey fill runs)
const nb = new Map();
const t0 = Date.now();
blitSplicedScenes(nb, DATA, config, SEED);
const tNew = Date.now() - t0;

// OLD law: splice blit without config (grey = keep-content skip, the pre-#170 law)
const ob = new Map();
const t1 = Date.now();
blitSplicedScenes(ob, DATA);
const tOld = Date.now() - t1;

// --- M-grade identity law: the art water mask vs the capture water mask ---
// mountain_lake.png at offset (0,0) = its TRUE world position (setWorldPx's
// game→display chunk map is chunk-aligned); the capture's flat water
// [35,61,56] ±12 must be covered at (0,0), and (0,0) must beat every
// neighbor offset — a (−11,−12) art shift (the pre-#170 read) loses the
// boundary strip.
const capImg = readPng(repoRoot + "/mapgen/out/ref/40_14.png");
const artImg = readPng(DATA + "/biome_impl/spliced/mountain_lake.png");
const { loadMaterials } = await import("../lib/colorize.mjs");
const materials = loadMaterials(DATA);
const flatWater = (r, g, b) => Math.abs(r - 35) <= 12 && Math.abs(g - 61) <= 12 && Math.abs(b - 56) <= 12;
const artMask = new Uint8Array(512 * 512);
const capMask = new Uint8Array(512 * 512);
let capWCount = 0;
for (let j = 0; j < 512; j++) {
  for (let i = 0; i < 512; i++) {
    const cq = 4 * (j * 512 + i);
    if (flatWater(capImg.data[cq], capImg.data[cq + 1], capImg.data[cq + 2])) { capMask[j * 512 + i] = 1; capWCount++; }
    // art side = the paint-classification law (dig #168/#170): a water
    // materials.xml hit (the art's own hex family, e.g. 2f554c)
    const aq = 4 * (j * artImg.width + i); // art is 512x512
    const hex = `${artImg.data[aq].toString(16).padStart(2, "0")}${artImg.data[aq + 1].toString(16).padStart(2, "0")}${artImg.data[aq + 2].toString(16).padStart(2, "0")}`;
    if (artImg.data[aq + 3] >= 128 && materials.get(hex) === "water") artMask[j * 512 + i] = 1;
  }
}
// overlap(dx,dy) = capture water ∩ art water shifted by (dx,dy): capture px
// (i,j) covered iff art px (i-dx, j-dy) is art-water.
const overlap = (dx, dy) => {
  let n = 0;
  for (let j = 0; j < 512; j++) {
    const sj = j - dy;
    if (sj < 0 || sj >= 512) continue;
    for (let i = 0; i < 512; i++) {
      const si = i - dx;
      if (si < 0 || si >= 512) continue;
      if (capMask[j * 512 + i] && artMask[sj * 512 + si]) n++;
    }
  }
  return n;
};
let best = { dx: 0, dy: 0, n: -1 };
const sweep = [];
for (let dy = -16; dy <= 16; dy++) {
  for (let dx = -16; dx <= 16; dx++) {
    const n = overlap(dx, dy);
    sweep.push({ dx, dy, n });
    if (n > best.n) best = { dx, dy, n };
  }
}
sweep.sort((a, b) => b.n - a.n);
const idN = overlap(0, 0);
let artMaskCount = 0;
for (let p = 0; p < 512 * 512; p++) artMaskCount += artMask[p];
console.log(`identity water law: capW=${capWCount} artW=${artMaskCount}`);
console.log(`  overlap(0,0)=${idN} = ${((100 * idN) / capWCount).toFixed(3)}% of capture water`);
console.log(`  sweep ±16 peak: (${best.dx},${best.dy}) n=${best.n}; top5 = ${sweep.slice(0, 5).map((s) => `(${s.dx},${s.dy})${s.n}`).join(" ")}`);
console.log(`  overlap(−11,−12)=${overlap(-11, -12)} (the pre-#170 read shift)`);

const mkWorld = (templates) => ({
  grid: new Int16Array(71 * 144).fill(-1),
  errors: new Map(),
  templates,
  maps: new Map(),
  areas: [],
  ready: Promise.resolve(),
});
const wn = mkWorld(nb), wo = mkWorld(ob);

const cap = readPng(repoRoot + "/mapgen/out/ref/40_14.png");
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const isWater = (p) => p && Math.abs(p[0] - 35) <= 12 && Math.abs(p[1] - 61) <= 12 && Math.abs(p[2] - 56) <= 12;

const OX = 40 * 512, OY = 62 * 512; // capture tile 40_14 = display chunks (40,62)
let fR = 0, capW = 0;
let fGn = 0, genWn = 0, wIntNew = 0;
let fGo = 0, genWo = 0, wIntOld = 0;
const N = 128 * 512;
for (let j = 160; j <= 287; j++) {
  for (let i = 0; i < 512; i++) {
    const q = 4 * (j * 512 + i);
    const cr = cap.data[q], cg = cap.data[q + 1], cb = cap.data[q + 2];
    const cSolid = lum(cr, cg, cb) >= 24;
    const cWater = isWater([cr, cg, cb]);
    if (cSolid) fR++;
    if (cWater) capW++;
    // NEW law: display-frame read of the new buffers
    const pn = worldColorAt(wn, OX + i, OY + j);
    if (pn) fGn++;
    if (isWater(pn)) { genWn++; if (cWater) wIntNew++; }
    // OLD law: generator-local read = the new read shifted by (+11,+12)
    const po = worldColorAt(wo, OX + i + 11, OY + j + 12);
    if (po) fGo++;
    if (isWater(po)) { genWo++; if (cWater) wIntOld++; }
  }
}

console.log(`splice blit ms: new ${tNew} / old ${tOld}`);
console.log(`band rows 160-287 (N=${N}):`);
console.log(`  fR (capture solid, lum>=24)      = ${(fR / N).toFixed(4)}`);
console.log(`  fG NEW (display read + grey fill) = ${(fGn / N).toFixed(4)}  (solid px ${fGn})`);
console.log(`  fG OLD (gen-local read, no fill)  = ${(fGo / N).toFixed(4)}  (solid px ${fGo})`);
console.log(`water counts (rows 160-287): capW=${capW} genWn=${genWn} genWo=${genWo}`);
console.log(`  gen-water ∩ capture-water: NEW=${wIntNew} OLD=${wIntOld}`);

// full-tile sanity: the fill's color families at the art-grey cells
const buf = nb.get("40,62");
let painted = 0;
const colors = new Map();
for (let i = 0; i < buf.length; i += 3) {
  if (buf[i] === 9 && buf[i + 1] === 9 && buf[i + 2] === 9) continue;
  painted++;
  const k = `${buf[i]},${buf[i + 1]},${buf[i + 2]}`;
  colors.set(k, (colors.get(k) ?? 0) + 1);
}
console.log(`chunk 40,62 NEW: unset=${262144 - painted} painted=${painted} distinct colors=${colors.size}`);
const top = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log(`  top colors: ${top.map(([k, v]) => `${k}:${v}`).join(" | ")}`);

// --- the TWO-SCENE fill/defer attribution (METER-CLASS: E1 count law) ---
// The chunk's fill count (104653) = mountain_lake's own grey fill (104002)
// + 651 fill-THROUGH cells from lavalake2 (2560x2392 at game (2048,0),
// blitted FIRST per SPLICE_PNGS): its grey->band fill survives under 651 of
// mountain_lake's below-shows cells (transparent / black / non-grey miss),
// because mountain_lake overwrites only the cells it paints. Hence
// unset = mountain_lake's 79142 skip cells - 651 = 78491.
const mlArt = readPng(DATA + "/biome_impl/spliced/mountain_lake.png");
const mlSkipMask = new Uint8Array(512 * 512);
let mlPaint = 0, mlSkip = 0, mlAir = 0, mlBlack = 0, mlMiss = 0, mlGrey = 0;
for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
  const q = 4 * (j * 512 + i);
  const r = mlArt.data[q], g = mlArt.data[q + 1], b = mlArt.data[q + 2], a = mlArt.data[q + 3];
  let skip = false;
  if (a < 10) { skip = true; mlAir++; }
  else if (r === 0 && g === 0 && b === 0) { skip = true; mlBlack++; }
  else if (r === g && g === b) { mlGrey++; }              // the grey -> band fill
  else {
    const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    const m = materials.get(hex);
    if (m === "air" || !m) { skip = true; mlMiss++; }      // non-grey miss = keep-content
  }
  mlSkipMask[j * 512 + i] = skip ? 1 : 0;
  if (skip) mlSkip++; else mlPaint++;
}
let through = 0;
const throughColors = new Map();
for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
  const p = 3 * (j * 512 + i);
  const isPainted = !(buf[p] === 9 && buf[p + 1] === 9 && buf[p + 2] === 9);
  if (mlSkipMask[j * 512 + i] && isPainted) {
    through++;
    const k = `${buf[p]},${buf[p + 1]},${buf[p + 2]}`;
    throughColors.set(k, (throughColors.get(k) ?? 0) + 1);
  }
}
console.log(`two-scene attribution (METER-CLASS: E1 count law):`);
console.log(`  mountain_lake own law: paints=${mlPaint} skips=${mlSkip} (air ${mlAir} + black ${mlBlack} + non-grey miss ${mlMiss}; grey ${mlGrey})`);
console.log(`  fill-THROUGH (ml skips, buffer painted = lavalake2's band fill): ${through}`);
console.log(`  through colors: ${[...throughColors.entries()].map(([k, v]) => `${k}:${v}`).join(" | ")}`);
console.log(`  check: mlPaint + through = ${mlPaint + through} (buffer painted ${painted}); mlSkip - through = ${mlSkip - through} (unset ${262144 - painted})`);
