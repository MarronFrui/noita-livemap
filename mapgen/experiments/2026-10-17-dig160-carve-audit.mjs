// dig #160 — THE CARVE AUDIT: the port's caves field vs the reference capture,
// per caves-kind tile, cell-aligned. Deliverables:
//   1. the per-def carve-share table (the port's field vs the capture's solid
//      share = the I31 verdict numbers),
//   2. the DIFF maps (the missing carve = the capture-air ∧ the port-solid)
//      as PNGs — the missing carve's SHAPE names the under-ported lane,
//   3. the best-dy registration per tile (the L3 anchor / any offset absorbed).
// Inputs: mapgen/out/dig152-kind-split.json (the 43 caves tiles), mapgen/out/ref/
// (the capture tiles), buildCavesField (the port's grids). AIR_THRESHOLD 24 = C97.
import fs from "node:fs";
import path from "node:path";

const AIR_THRESHOLD = 24;
const SEED = 78633191;

const { findNoitaDataDir } = await import("../lib/paths.mjs");
const { loadBiomeConfig } = await import("../lib/biomes.mjs");
const { buildCavesField } = await import("../lib/caves-field.mjs");
const { readPng, writePng } = await import("../lib/images.mjs");

const dataDir = findNoitaDataDir();
const cfg = loadBiomeConfig(dataDir);
const fields = new Map(); // def -> {w,h,field}
function fieldFor(defName) {
  if (!fields.has(defName)) {
    const def = [...cfg.biomes.values()].find((d) => d.name === defName);
    if (!def?.bitmapCaves) return null;
    fields.set(defName, buildCavesField(dataDir, def, SEED));
  }
  return fields.get(defName);
}

const art = JSON.parse(fs.readFileSync("mapgen/out/dig152-kind-split.json", "utf8"));
const SKY_ROWS = 48, CHUNK = 512;
const refDir = "mapgen/out/ref";
if (import.meta.url !== `file://${process.argv[1]}`) {
  // the import-safe gate (the dig-#158 pattern): the module = the defs only
  // unless run directly; the smoke test imports it for the parse check.
} else {
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

const summary = { seed: SEED, tiles: [], perDef: {} };
const diffJobs = [];
let nDone = 0;

for (const t of tiles) {
  const { tx, def } = t; const bty = t.row_used ?? t.bty_in;
  const cf = fieldFor(def);
  if (!cf) { summary.tiles.push({ tx, bty, def, error: "no field" }); continue; }
  const refPath = path.join(refDir, `${tx}_${bty}.png`);
  if (!fs.existsSync(refPath)) { summary.tiles.push({ tx, bty, def, error: "no ref tile" }); continue; }
  const ref = readPng(refPath);
  const N = 512 * 512;
  // the capture mask
  const R = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    R[i] = lum(ref.data[4 * i], ref.data[4 * i + 1], ref.data[4 * i + 2]) >= AIR_THRESHOLD ? 1 : 0;
  }
  // the port's field mask per px (mod-wrap into the 512×256 grid), with the
  // best-dy shift absorbed later via the profile scan
  const fW = cf.w, fH = cf.h, field = cf.field;
  const baseY = (bty + SKY_ROWS) * CHUNK - 31744;
  const baseX = tx * CHUNK - 17920;
  const G = new Uint8Array(N);
  for (let py = 0; py < 512; py++) {
    const wy = (((baseY + py) % fH) + fH) % fH;
    const rowOff = wy * fW;
    for (let px = 0; px < 512; px++) {
      const wx = (((baseX + px) % fW) + fW) % fW;
      G[py * 512 + px] = field[rowOff + wx] > 0.5 ? 1 : 0;
    }
  }
  // the best dy (shift the field's rows relative to the capture): argmax agreement
  let bestDy = 0, bestAgree = -1;
  for (let dy = -200; dy <= 200; dy += 4) {
    let agree = 0;
    for (let py = 0; py < 512; py += 2) {
      const wy = (((baseY + py + dy) % fH) + fH) % fH;
      const rowOff = wy * fW;
      for (let px = 0; px < 512; px += 2) {
        const wx = (((baseX + px) % fW) + fW) % fW;
        if ((field[rowOff + wx] > 0.5 ? 1 : 0) === R[py * 512 + px]) agree++;
      }
    }
    if (agree > bestAgree) { bestAgree = agree; bestDy = dy; }
  }
  // the final masks at bestDy (full res)
  const G2 = new Uint8Array(N);
  let inter = 0, uni = 0, capSolid = 0, portSolid = 0, missingCarve = 0, extraCarve = 0;
  for (let py = 0; py < 512; py++) {
    const wy = (((baseY + py + bestDy) % fH) + fH) % fH;
    const rowOff = wy * fW;
    for (let px = 0; px < 512; px++) {
      const wx = (((baseX + px) % fW) + fW) % fW;
      const g = field[rowOff + wx] > 0.5 ? 1 : 0;
      const r = R[py * 512 + px];
      G2[py * 512 + px] = g;
      if (g && r) inter++;
      if (g || r) uni++;
      if (r) capSolid++;
      if (g) portSolid++;
      if (!g && r) missingCarve++;   // the capture air, the port solid = THE MISSING CARVE
      if (g && !r) extraCarve++;     // the port air, the capture solid
    }
  }
  const iou = uni ? +(inter / uni).toFixed(4) : null;
  summary.tiles.push({
    tx, bty, def, dyOpt: bestDy, iou,
    capSolidPct: +(capSolid / N * 100).toFixed(2),
    portSolidPct: +(portSolid / N * 100).toFixed(2),
    missingCarvePct: +(missingCarve / N * 100).toFixed(2),
    extraCarvePct: +(extraCarve / N * 100).toFixed(2),
  });
  diffJobs.push({ tx, bty, def, missingCarve, G: G2, R, bestDy });
  nDone++;
}

// the per-def aggregates
for (const t of summary.tiles) {
  if (t.error || t.iou == null) continue;
  const d = (summary.perDef[t.def] ??= { n: 0, cap: 0, port: 0, missing: 0, extra: 0, iou: 0 });
  d.n++; d.cap += t.capSolidPct; d.port += t.portSolidPct; d.missing += t.missingCarvePct; d.extra += t.extraCarvePct; d.iou += t.iou;
}
for (const d of Object.values(summary.perDef)) {
  d.capMean = +(d.cap / d.n).toFixed(2); d.portMean = +(d.port / d.n).toFixed(2);
  d.missingMean = +(d.missing / d.n).toFixed(2); d.extraMean = +(d.extra / d.n).toFixed(2);
  d.iouMean = +(d.iou / d.n).toFixed(4);
  delete d.cap; delete d.port; delete d.missing; delete d.extra; delete d.iou;
}

// the diff PNGs: the 3 worst missing-carve tiles (one per def if possible)
diffJobs.sort((a, b) => b.missingCarve - a.missingCarve);
const picked = [];
for (const j of diffJobs) {
  if (picked.length >= 3) break;
  if (!picked.some((p) => p.def === j.def)) picked.push(j);
}
for (const j of picked) {
  const px = Buffer.alloc(512 * 512 * 4);
  for (let i = 0; i < 512 * 512; i++) {
    const g = j.G[i], r = j.R[i];
    // gray = agree-solid, black = agree-air, RED = the missing carve (the capture air, the port solid), GREEN = the extra carve
    const [R, Gc, B] = g && r ? [120, 120, 120] : !g && r ? [255, 40, 40] : g && !r ? [40, 255, 40] : [0, 0, 0];
    px[4 * i] = R; px[4 * i + 1] = Gc; px[4 * i + 2] = B; px[4 * i + 3] = 255;
  }
  writePng(`mapgen/out/dig160-diff-${j.def}-${j.tx}_${j.bty}.png`, 512, 512, px);
  summary.diffs = summary.diffs ?? [];
  summary.diffs.push(`dig160-diff-${j.def}-${j.tx}_${j.bty}.png`);
}

summary.tilesDone = nDone;
fs.writeFileSync("mapgen/out/dig160-carve-audit.json", JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ perDef: summary.perDef, diffs: summary.diffs, tilesDone: nDone }, null, 1));
}
