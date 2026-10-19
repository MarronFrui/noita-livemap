// 2026-10-19-dig172-fill-mix-profile.mjs — dig #172 instrument (METER-CLASS:
// E1 — family COUNTS/SHARES; no IoU/fG/rms — C97 stays its own instrument).
//
// Question: the art-grey cells of tile 40_14 (mountain_lake's placeholder
// region, 104002 px per entry (170)) are filled by OUR seeded-fBm band choice
// (I39(d): rock-family 103746 / sand 906 / soil 1). The capture at those
// cells is CLAIMED soil-dominant over rows 160-400 with copper rising
// 416-496 (entry (170) (4)) — but that claim has NO committed instrument.
// This run measures it directly: capture vs gen vs raw-fill family profiles
// restricted to the art-grey mask, per 64-row band.
//
// PREDICTION (pre-registered BEFORE the first run, 2026-10-19):
//   F1 (the (170) soil claim, CONFIRMED or REFUTED): on grey-mask cells the
//     capture's soil-family share in rows 160-400 >= 0.5 while our fill's
//     fallback/rock-family share >= 0.9.
//     FALSIFIER: capture soil-family share < 0.3 in rows 160-400 => the
//     (170) "soil-dominant" clause is wrong => correct entry (170)/I39(d)
//     (VERIFIED §8 row) and re-derive the law from the measured profile.
//   F2 (stratification): the capture's dominant family CHANGES with row band
//     (soil family high in the upper grey bands, rock-family high lower)
//     while our fill's family profile is row-invariant (fbm is stationary).
//     FALSIFIER: capture dominant family = rock-family at >= 0.9 in EVERY
//     band (the capture mix equals ours => the visible gap is not the mix).
//
// Family classifier (M-grade rule, documented): nearest palette color by
// squared RGB distance over SHADES + TEMPLATE_SHADES (colorize/template-
// render palettes = the port's own display families); unmatched bucket when
// min distance > 60^2 = 3600 (family maps to its first shade's rgb in the
// family PNGs). lum < 24 = air/sky (C78 rule); (0,0,0) excluded as art air.
// Units: shares = fraction 0..1 over the stated cell set; counts = px.
//
// Reproduction: SURFACE_V3=1 node mapgen/experiments/2026-10-19-dig172-fill-mix-profile.mjs
// Output: mapgen/out/dig172-fill-mix.json + mapgen/out/dig172-{gen,capfam,genfam}-40_14.png

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { ensureWorld, worldColorAt, SKY_ROWS, CHUNK } = await import("../lib/world-gen.mjs");
const { blitSplicedScenes, TEMPLATE_SHADES } = await import("../lib/template-render.mjs");
const { loadBiomeConfig } = await import("../lib/biomes.mjs");
const { readPng } = await import("../lib/images.mjs");
const { SHADES, MATERIAL_SHADE, loadMaterials } = await import("../lib/colorize.mjs");

const TX = 40, BTY = 14; // capture tile 40_14 = display chunks (40,62)
const UNMATCHED = 3600; // (60 rgb)^2

// --- family palette (M-grade rule; every entry = a port display family) -----
const families = new Map(); // familyKey -> [[r,g,b], ...]
const addFam = (key, rgb) => {
  if (!families.has(key)) families.set(key, []);
  families.get(key).push(rgb);
};
for (const [k, list] of Object.entries(SHADES)) for (const s of list) addFam(k, s.rgb);
for (const [name, list] of Object.entries(TEMPLATE_SHADES)) {
  if (name === "water") continue; // same rgb set as SHADES.water
  addFam(`t:${name}`, list[0].rgb);
}
const famKeys = [...families.keys()];
const nearest = (r, g, b) => {
  let best = null, bd = Infinity;
  for (const k of famKeys) {
    for (const [pr, pg, pb] of families.get(k)) {
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
  }
  return bd > UNMATCHED ? null : best;
};
const famColor = (k) => (k ? families.get(k)[0] : [255, 0, 255]);
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// --- the art-grey mask (the fill's cell set, entry (170) law) ---------------
const DATA = findNoitaDataDir();
const artImg = readPng(DATA + "/biome_impl/spliced/mountain_lake.png");
const greyMask = new Uint8Array(CHUNK * CHUNK);
let greyN = 0;
for (let j = 0; j < CHUNK; j++) {
  for (let i = 0; i < CHUNK; i++) {
    const q = 4 * (j * artImg.width + i);
    const r = artImg.data[q], g = artImg.data[q + 1], b = artImg.data[q + 2];
    if (artImg.data[q + 3] >= 10 && r === g && g === b && !(r === 0 && g === 0 && b === 0)) {
      greyMask[j * CHUNK + i] = 1; greyN++;
    }
  }
}

// --- three color sources -----------------------------------------------------
const t0 = Date.now();
const world = ensureWorld(CAPTURE_SEED, DATA, { cacheDir: path.join(repoRoot, "mapgen/out/gen-cache/r3i") });
await world.ready;
console.log(`world ready in ${Date.now() - t0} ms`);

const capPng = readPng(path.join(repoRoot, `mapgen/out/ref/${TX}_${BTY}.png`));
const config = loadBiomeConfig(DATA);
const fillBuf = new Map();
blitSplicedScenes(fillBuf, DATA, config, CAPTURE_SEED);
const buf = fillBuf.get("40,62");
if (!buf) { console.error("no fill buffer 40,62"); process.exit(2); }

// --- profile: per row band, family shares on grey-mask cells -----------------
const BANDS = [];
for (let y0 = 0; y0 < CHUNK; y0 += 64) BANDS.push([y0, y0 + 63]);
const BANDS2 = [[160, 400], [416, 496], [0, 511]]; // entry (170)'s stated windows + full

const tally = () => ({ count: 0, fam: new Map(), top: new Map() });
const add = (t, r, g, b) => {
  t.count++;
  const k = (r << 16) | (g << 8) | b;
  t.top.set(k, (t.top.get(k) ?? 0) + 1);
  const f = lum(r, g, b) < 24 ? "air" : nearest(r, g, b) ?? "unmatched";
  t.fam.set(f, (t.fam.get(f) ?? 0) + 1);
};
const profile = (colorAt) => {
  const out = [];
  for (const [y0, y1] of BANDS) {
    const t = tally();
    for (let j = y0; j <= y1; j++) for (let i = 0; i < CHUNK; i++) {
      if (!greyMask[j * CHUNK + i]) continue;
      const c = colorAt(i, j);
      if (c) add(t, c[0], c[1], c[2]);
    }
    out.push({ rows: [y0, y1], ...dump(t) });
  }
  return out;
};
const dump = (t) => ({
  count: t.count,
  shares: Object.fromEntries([...t.fam.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / t.count).toFixed(4)])),
  top3: [...t.top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `#${k.toString(16).padStart(6, "0")}:${v}`),
});
const range = (colorAt, y0, y1) => {
  const t = tally();
  for (let j = y0; j <= y1; j++) for (let i = 0; i < CHUNK; i++) {
    if (!greyMask[j * CHUNK + i]) continue;
    const c = colorAt(i, j);
    if (c) add(t, c[0], c[1], c[2]);
  }
  return dump(t);
};

const capAt = (i, j) => { const q = 4 * (j * CHUNK + i); return [capPng.data[q], capPng.data[q + 1], capPng.data[q + 2]]; };
const genAt = (i, j) => worldColorAt(world, TX * CHUNK + i, (BTY + SKY_ROWS) * CHUNK + j);
const fillAt = (i, j) => { const p = 3 * (j * CHUNK + i); const r = buf[p], g = buf[p + 1], b = buf[p + 2]; return r === 9 && g === 9 && b === 9 ? null : [r, g, b]; };

const capProf = profile(capAt), genProf = profile(genAt), fillProf = profile(fillAt);

// --- PNG dumps (visual artifacts) --------------------------------------------
const dumpPng = (file, colorAt) => {
  const png = new PNG({ width: CHUNK, height: CHUNK });
  for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) {
    const c = colorAt(i, j) ?? [0, 0, 0];
    const q = 4 * (j * CHUNK + i);
    png.data[q] = c[0]; png.data[q + 1] = c[1]; png.data[q + 2] = c[2]; png.data[q + 3] = 255;
  }
  fs.writeFileSync(path.join(repoRoot, `mapgen/out/${file}`), PNG.sync.write(png));
};
dumpPng("dig172-gen-40_14.png", genAt);
dumpPng("dig172-capfam-40_14.png", (i, j) => {
  const c = capAt(i, j);
  return greyMask[j * CHUNK + i] ? famColor(lum(c[0], c[1], c[2]) < 24 ? "airDark" : nearest(c[0], c[1], c[2])) : [0, 0, 0];
});
dumpPng("dig172-genfam-40_14.png", (i, j) => {
  const c = genAt(i, j);
  return greyMask[j * CHUNK + i] && c ? famColor(lum(c[0], c[1], c[2]) < 24 ? "airDark" : nearest(c[0], c[1], c[2])) : [0, 0, 0];
});

// --- output --------------------------------------------------------------------
const summary = {
  instrument: "2026-10-19-dig172-fill-mix-profile.mjs", meterClass: "E1",
  units: "shares = fraction 0..1 over art-grey cells of tile 40_14 per row band; counts = px",
  seed: CAPTURE_SEED, tile: `${TX}_${BTY}`, greyMaskCells: greyN,
  classifier: `nearest palette color over SHADES+TEMPLATE_SHADES; unmatched if min-dist^2 > ${UNMATCHED}; lum<24 = air`,
  prediction: "F1 capture soil share rows160-400 >= 0.5 vs our fill rock/fallback >= 0.9 (falsifier < 0.3); F2 capture stratified, fill row-invariant",
  fillBufferMs: Date.now() - t0,
  bands: BANDS.map(([y0, y1], k) => ({ rows: [y0, y1], cap: capProf[k], gen: genProf[k], fill: fillProf[k] })),
  stated: BANDS2.map(([y0, y1]) => ({ rows: [y0, y1], cap: range(capAt, y0, y1), gen: range(genAt, y0, y1), fill: range(fillAt, y0, y1) })),
};
const outPath = path.join(repoRoot, "mapgen/out/dig172-fill-mix.json");
fs.writeFileSync(outPath, JSON.stringify(summary, null, 1));

console.log(`grey-mask cells: ${greyN}`);
console.log("rows    | capture (top families)              | gen                                   | fill");
for (const b of summary.bands) {
  const f = (o) => Object.entries(o.shares).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(" ").padEnd(36);
  console.log(`${String(b.rows[0]).padStart(3)}-${String(b.rows[1]).padEnd(3)} | ${f(b.cap)} | ${f(b.gen)} | ${f(b.fill)}`);
}
for (const s of summary.stated) {
  console.log(`\n[stated ${s.rows[0]}-${s.rows[1]}] cap top3: ${s.cap.top3.join(" ")} | shares: ${JSON.stringify(s.cap.shares)}`);
  console.log(`[stated ${s.rows[0]}-${s.rows[1]}] gen top3: ${s.gen.top3.join(" ")} | shares: ${JSON.stringify(s.gen.shares)}`);
  console.log(`[stated ${s.rows[0]}-${s.rows[1]}] fill top3: ${s.fill.top3.join(" ")} | shares: ${JSON.stringify(s.fill.shares)}`);
}
console.log(`\n# json -> ${outPath}`);
