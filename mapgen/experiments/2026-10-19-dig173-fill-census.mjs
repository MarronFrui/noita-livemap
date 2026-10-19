// 2026-10-19-dig173-fill-census.mjs — dig #173 instrument (METER-CLASS: E1 —
// family COUNTS/SHARES on the art-grey mask; no IoU/fG/rms — C97 stays its
// own instrument).
//
// Question: dig #172 wired the fill lane to the driver law
// classify(surfaceField) (C146). The census measures the resulting family
// mix on tile 40_14's 104002 art-grey cells, per 64-row band, and compares
// three states: capture (committed #172 measurement, recomputed here),
// OLD fill (the fBm slab profile read from the committed #172 artifact),
// NEW fill (current lib = the driver-law fill).
//
// PREDICTION (pre-registered BEFORE the first run, 2026-10-19, entry (173)):
//   P1: NEW fill band 128-191 → soil share >= 0.90 (v ramp mid-range stays
//     in soil's window [0.45,0.53); the committed L1 test asserted this on
//     the fill buffer; this census re-measures it as a family profile).
//   P2: NEW fill bands 256-511 → sand share >= 0.90 (v saturates at
//     gradW*per + 0.871429*easedRamp ≈ 0.87, inside sand's window
//     [0.53,0.95), per C136/C146) while the OLD fill was rock-family
//     ~1.0 row-invariant.
//   FALSIFIER: NEW fill's per-band shares deviate from the classify-window
//     prediction in either direction (soil leaking below 256, sand below
//     0.9 at 128-191) ⇒ the wired fill lane disagrees with the driver law
//     ⇒ re-read the bytes (X149/X148), never accommodate.
//   P3 (the residual, quantified for I44): capture bands 320-511 remain
//     soil/rock-dominant (soil >= 0.4 at 320-447, rock >= 0.35 at 448-511)
//     where the NEW fill is sand ≈ 1 — the game's post-walk record stamp
//     (X150 phase) — the dig #173 residual, not this dig's port.
//
// Family classifier: nearest palette color over SHADES + TEMPLATE_SHADES,
// unmatched when min distance > 60^2 (the #172 M-grade rule, unchanged).
// Units: shares = fraction 0..1 over the band's mask cells; counts = px.
//
// Reproduction: SURFACE_V3=1 node mapgen/experiments/2026-10-19-dig173-fill-census.mjs
// Output: mapgen/out/dig173-fill-census.json + printed table.

import fs from "node:fs";
import path from "node:path";

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { blitSplicedScenes, TEMPLATE_SHADES } = await import("../lib/template-render.mjs");
const { loadBiomeConfig } = await import("../lib/biomes.mjs");
const { readPng } = await import("../lib/images.mjs");
const { SHADES } = await import("../lib/colorize.mjs");

const TX = 40, BTY = 14, CHUNK = 512;
const UNMATCHED = 3600;

const families = new Map();
const addFam = (key, rgb) => {
  if (!families.has(key)) families.set(key, []);
  families.get(key).push(rgb);
};
for (const [k, list] of Object.entries(SHADES)) for (const s of list) addFam(k, s.rgb);
for (const [name, list] of Object.entries(TEMPLATE_SHADES)) {
  if (name === "water") continue;
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
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

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

const capPng = readPng(path.join(repoRoot, `mapgen/out/ref/${TX}_${BTY}.png`));
const config = loadBiomeConfig(DATA);
const fillBuf = new Map();
blitSplicedScenes(fillBuf, DATA, config, CAPTURE_SEED);
const buf = fillBuf.get("40,62");
if (!buf) { console.error("no fill buffer 40,62"); process.exit(2); }

const BANDS = [];
for (let y0 = 0; y0 < CHUNK; y0 += 64) BANDS.push([y0, y0 + 63]);

const tally = () => ({ count: 0, fam: new Map() });
const add = (t, r, g, b) => {
  t.count++;
  const f = lum(r, g, b) < 24 ? "air" : nearest(r, g, b) ?? "unmatched";
  t.fam.set(f, (t.fam.get(f) ?? 0) + 1);
};
const dump = (t) => ({
  count: t.count,
  shares: Object.fromEntries([...t.fam.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / t.count).toFixed(4)])),
});
const capAt = (i, j) => { const q = 4 * (j * CHUNK + i); return [capPng.data[q], capPng.data[q + 1], capPng.data[q + 2]]; };
const fillAt = (i, j) => { const p = 3 * (j * CHUNK + i); const r = buf[p], g = buf[p + 1], b = buf[p + 2]; return r === 9 && g === 9 && b === 9 ? null : [r, g, b]; };
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

const capProf = profile(capAt);
const newProf = profile(fillAt);
const old = JSON.parse(fs.readFileSync(path.join(repoRoot, "mapgen/out/dig172-fill-mix.json"), "utf8"));
const oldProf = old.bands.map((b) => ({ rows: b.rows, count: b.fill.count, shares: b.fill.shares }));

const top = (s, n = 2) => Object.entries(s).slice(0, n).map(([k, v]) => `${k} ${v}`).join(" / ") || "-";
console.log(`grey mask ${greyN} cells | tile 40_14 | seed ${CAPTURE_SEED}`);
console.log("rows      count   cap                              old-fill              new-fill");
for (let k = 0; k < BANDS.length; k++) {
  console.log(
    `${String(capProf[k].rows[0]).padStart(4)}-${String(capProf[k].rows[1]).padEnd(4)} ` +
    `${String(capProf[k].count).padStart(6)}  ${top(capProf[k].shares).padEnd(32)} ` +
    `${top(oldProf[k].shares).padEnd(22)} ${top(newProf[k].shares)}`,
  );
}

const out = {
  instrument: "2026-10-19-dig173-fill-census.mjs",
  meterClass: "E1 (family counts/shares on the art-grey mask; no shape metrics)",
  units: "shares = fraction 0..1 over the band's mask cells; counts = px",
  seed: CAPTURE_SEED, tile: `${TX}_${BTY}`, greyMaskCells: greyN,
  classifier: "nearest palette over SHADES+TEMPLATE_SHADES, unmatched > 60^2, lum<24 = air (the #172 M-grade rule)",
  prediction: "P1 soil>=0.90 @128-191; P2 sand>=0.90 @256-511 (v≈0.871429 in sand window); P3 capture 320+ soil/rock vs our sand = the I44 residual; FALSIFIER: new-fill shares off the classify windows => byte re-read",
  bands: BANDS.map((rows, k) => ({ rows, cap: capProf[k], oldFill: oldProf[k], newFill: newProf[k] })),
};
fs.writeFileSync(path.join(repoRoot, "mapgen/out/dig173-fill-census.json"), JSON.stringify(out, null, 1));
console.log("wrote mapgen/out/dig173-fill-census.json");
