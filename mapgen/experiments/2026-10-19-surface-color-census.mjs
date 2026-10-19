// SURFACE-BAND COLOR/STRUCTURE CENSUS — the visual failure class that
// C97's solid-mask metric cannot see (flat/wrong-color fills that mask
// as "solid == solid": gold sky where capture = black, one-color slabs
// where capture = mixed material). User mandate 2026-10-19: "the
// surface band is the only objective".
//
// METER-CLASS: E1 — pixel COLOR COUNTS + SHARES (units: distinct =
// distinct RGB values (count), all shares = fraction 0..1 over 512×512
// = 262144 sampled px per tile per side, stride 1). This instrument
// produces NO IoU/fG/rms numbers (E2 territory — C97 stays
// 2026-10-10-surface-shape-iou.mjs).
//
// PREDICTION (pre-registered BEFORE the first run, 2026-10-19 — the
// meter law, AGENTS.md "Measurement law"; falsifiers named up front):
//   BEFORE (the old sky law: parallax-row sample, stars gated t<0.75):
//     sky-band tiles (bty <= 13) gen warmShare ~= 1.0, gen airShare
//     ~= 0 vs ref airShare ~0.6..0.95 (the gold horizon family
//     (254,206,108) from parallax_background.png's bottom rows; the
//     whole scorable band sits at t >= 0.87 ⇒ the old star gate
//     excluded it ⇒ gen brightShare = the gold, no stars).
//   AFTER (the NIGHT law, fixed same session): gen warmShare ≈ 0 on
//     bin-less sky, gen airShare moves TOWARD ref (mean |gen−ref| air
//     gap over bty<=13 shrinks), gen brightShare > 0 (stars at every
//     altitude), and bty >= 14 tiles are BYTE-IDENTICAL before/after
//     (the fix touches only ty<62 reads).
//   FALSIFIER #1: warmShare stays > 0.05 on bin-less sky after the fix
//   (a second warm source exists). FALSIFIER #2: any bty>=14 tile
//   changes before/after (unexpected coupling outside the sky band).
//
// Tile list = the C97 scorable set (surface-shape-2026-10-10-*.json
// `tiles[]`, CONSTANTS.md::C97) — the dashboard's exact 56 tiles.
// Gen = worldColorAt (L3_ANCHOR +11/+12 applied inside, C78);
// ref = mapgen/out/ref/<tx>_<bty>.png (the noitamap/mapcap stitch).
// Repro (one lane per process — flags are module-load-time consts):
//   SURFACE_V3=1 node mapgen/experiments/2026-10-19-surface-color-census.mjs before
// Output: mapgen/out/surface-color-census-2026-10-19-<lane>-<tag>.json

import fs from "node:fs";
import path from "node:path";

const TAG = process.argv[2] ?? "run";
const LANE = process.env.SURFACE_V2 === "1" && process.env.SURFACE_V3 === "1" ? "v2v3"
  : process.env.SURFACE_V2 === "1" ? "v2"
  : process.env.SURFACE_V3 === "1" ? "v3"
  : "default"; // the census is valid in any lane (skyAt attaches unconditionally);
               // comparability holds WITHIN a lane — the output records which.

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { ensureWorld, worldColorAt, SKY_ROWS, CHUNK } = await import("../lib/world-gen.mjs");
const { readPng } = await import("../lib/images.mjs");

// --- classification rules (documented; units: rgb / lum 0..255) -------------
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const AIR_LUM = 24;        // C78: lum < 24 = air (matches the C97 mask rule)
const BRIGHT_LUM = 60;     // star proxy floor (the star sprite is white/blue-white)
// warm family = the parallax-gradient/warm-horizon class: light warm px.
// (255,228,184) cream, (255,213,134), (254,206,108) gold all pass;
// the blue sky (100,168,198) and dark cave bg fail (r-b >= 60, r >= 200).
// NOTE: on bty >= 14 tiles warm = legitimately warm MATERIALS (sand…) —
// warmShare is only evidence for the sky band (bty <= 13).
const isWarm = (r, g, b) => r >= 200 && r - b >= 60 && g >= 140 && g <= 245;
const isBlack = (r, g, b) => r === 0 && g === 0 && b === 0;

// --- tile list (the C97 scorable set) ---------------------------------------
const candidates = [
  process.env.TILE_JSON,
  path.join(repoRoot, "mapgen/out/surface-shape-2026-10-10-v3.json"),
  path.join(repoRoot, "mapgen/out/surface-shape-2026-10-10-v2v3.json"),
].filter(Boolean);
const tileJson = candidates.find((f) => fs.existsSync(f));
if (!tileJson) { console.error("refusing: no surface-shape tile-list JSON found"); process.exit(2); }
const tiles = JSON.parse(fs.readFileSync(tileJson, "utf8")).tiles;
if (!Array.isArray(tiles) || !tiles.length) { console.error(`refusing: tiles[] empty in ${tileJson}`); process.exit(2); }

// --- census core ------------------------------------------------------------
function census(rgbOf, n) { // rgbOf(i) -> [r,g,b] | null (null = transparent air)
  const counts = new Map();
  let black = 0, warm = 0, air = 0, bright = 0;
  for (let i = 0; i < n; i++) {
    const c = rgbOf(i);
    if (!c) { air++; continue; }
    const [r, g, b] = c;
    const k = (r << 16) | (g << 8) | b;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (isBlack(r, g, b)) black++;
    if (isWarm(r, g, b)) warm++;
    const l = lum(r, g, b);
    if (l < AIR_LUM) air++;
    if (l >= BRIGHT_LUM) bright++;
  }
  let top = [0, 0, 0];
  for (const v of counts.values()) {
    if (v > top[0]) { top = [v, top[0], top[1]]; }
    else if (v > top[1]) { top = [top[0], v, top[1]]; }
    else if (v > top[2]) { top = [top[0], top[1], v]; }
  }
  const f = (v) => +(v / n).toFixed(5);
  return {
    distinct: counts.size,
    top1: f(top[0]), top3: f(top[0] + top[1] + top[2]),
    black: f(black), warm: f(warm), air: f(air), bright: f(bright),
  };
}

// --- run ---------------------------------------------------------------------
const dataDir = findNoitaDataDir();
const world = ensureWorld(CAPTURE_SEED, dataDir, { cacheDir: path.join(repoRoot, "mapgen/out/gen-cache/r3i") });
await world.ready;
const refDir = path.join(repoRoot, "mapgen/out/ref");
const N = CHUNK * CHUNK;

console.log(`# color census tag=${TAG} lane=${LANE} tiles=${tiles.length} (${tileJson.split("/").pop()})`);
console.log("label            tile    | gen: dist  top1   top3  black   warm   air bright | ref: dist  top1   top3  black   warm   air bright");
const rows = [];
for (const t of tiles) {
  const { tx, bty, label } = t;
  const refPng = readPng(path.join(refDir, `${tx}_${bty}.png`));
  const g = census((i) => {
    const x = i % CHUNK, y = (i / CHUNK) | 0;
    return worldColorAt(world, tx * CHUNK + x, (bty + SKY_ROWS) * CHUNK + y);
  }, N);
  const r = census((i) => {
    const q = 4 * i;
    return [refPng.data[q], refPng.data[q + 1], refPng.data[q + 2]];
  }, N);
  rows.push({ label, tx, bty, gen: g, ref: r });
  const c = (s, w) => String(s).padStart(w);
  console.log(
    `${label.padEnd(16)} ${String(tx).padStart(3)}_${String(bty).padEnd(3)} |` +
    `${c(g.distinct, 6)} ${c(g.top1, 6)} ${c(g.top3, 6)} ${c(g.black, 6)} ${c(g.warm, 6)} ${c(g.air, 6)} ${c(g.bright, 6)} |` +
    `${c(r.distinct, 6)} ${c(r.top1, 6)} ${c(r.top3, 6)} ${c(r.black, 6)} ${c(r.warm, 6)} ${c(r.air, 6)} ${c(r.bright, 6)}`
  );
}

// --- aggregates --------------------------------------------------------------
const meanOf = (list, side, key) => +(list.reduce((a, t) => a + t[side][key], 0) / list.length).toFixed(5);
const agg = (list) => {
  if (!list.length) return null;
  const out = { tiles: list.length };
  for (const side of ["gen", "ref"]) for (const key of ["distinct", "top1", "top3", "black", "warm", "air", "bright"])
    out[`${side}${key[0].toUpperCase()}${key.slice(1)}`] = meanOf(list, side, key);
  out.airAbsGap = +(list.reduce((a, t) => a + Math.abs(t.gen.air - t.ref.air), 0) / list.length).toFixed(5);
  out.warmAbsGap = +(list.reduce((a, t) => a + Math.abs(t.gen.warm - t.ref.warm), 0) / list.length).toFixed(5);
  return out;
};
const sky = rows.filter((t) => t.bty <= 13);   // the sky band (ty < 62, the gold's home)
const ground = rows.filter((t) => t.bty >= 14); // the surface datum row (untouched by the fix)
const summary = {
  instrument: "2026-10-19-surface-color-census.mjs", meterClass: "E1",
  units: "distinct = RGB count; shares = 0..1 over 262144 px per tile per side (stride 1)",
  tag: TAG, lane: LANE, env: { SURFACE_V2: process.env.SURFACE_V2 ?? null, SURFACE_V3: process.env.SURFACE_V3 ?? null },
  seed: CAPTURE_SEED, tileJson: tileJson.split("/").pop(),
  rules: { airLum: AIR_LUM, brightLum: BRIGHT_LUM, warm: "r>=200 && r-b>=60 && 140<=g<=245 (evidence on sky band only)" },
  overall: agg(rows), skyBand: agg(sky), groundRow: agg(ground),
  tiles: rows,
};
const outPath = path.join(repoRoot, `mapgen/out/surface-color-census-2026-10-19-${LANE}-${TAG}.json`);
fs.writeFileSync(outPath, JSON.stringify(summary, null, 1));

const show = (name, a) => a && console.log(
  `${name.padEnd(9)} tiles=${String(a.tiles).padStart(3)}` +
  ` | gen warm=${a.genWarm} air=${a.genAir} bright=${a.genBright} top3=${a.genTop3} dist=${a.genDistinct}` +
  ` | ref warm=${a.refWarm} air=${a.refAir} bright=${a.refBright} top3=${a.refTop3} dist=${a.refDistinct}` +
  ` | gaps air=${a.airAbsGap} warm=${a.warmAbsGap}`
);
console.log("\n# aggregates (means per tile)");
show("overall", summary.overall);
show("sky<=13", summary.skyBand);
show("ground>=14", summary.groundRow);
console.log(`\n# json -> ${outPath}`);
