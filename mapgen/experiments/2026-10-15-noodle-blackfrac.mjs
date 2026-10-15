// 2026-10-15-noodle-blackfrac.mjs — AUDIT instrument (E1 counts): the
// FULL underground band (canvas ty 62..95) black-fraction census in
// worldColorAt terms — what fraction of the band renders null (= opaque
// black in every viewer zoom) per lane, per commit, plus the template-art
// coverage per def (why a DEAD noise chunk may still paint).
// Run (flags BEFORE import):  SURFACE_V2=1 SURFACE_V3=1 node .../2026-10-15-noodle-blackfrac.mjs <label>
// Output: per-def + band totals on stdout; mapgen/out/noodle-blackfrac-<label>.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const label = process.argv[2] ?? "run";
const seed = Number(process.env.MASK_SEED ?? 78633191);
console.log(`[blackfrac:${label}] V2=${process.env.SURFACE_V2 ?? "-"} V3=${process.env.SURFACE_V3 ?? "-"} seed=${seed}`);

const { findNoitaDataDir } = await import("../lib/paths.mjs");
const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
const wg = await import("../lib/world-gen.mjs");

const dataDir = findNoitaDataDir();
const world = wg.ensureWorld(seed, dataDir, { cacheDir: path.join(REPO, "mapgen/out/gen-cache/r3i") });
await world.ready;
const config = world.config;

const SKY = 48, W = 71;
const STEP = 4; // sample every 4th world px (band = 36352 x 17408 px)
const perDef = new Map();
let tot = 0, black = 0;
for (let ty = 62; ty <= 95; ty++) {
  for (let tx = 0; tx < 71; tx++) {
    const at = biomeAt(config, tx, ty - SKY);
    const def = world.grid[ty * W + tx] >= 0 ? "(wang-area)" : at ? at.biome.filename.split("/").pop() : "(no-def)";
    // template art coverage for this chunk (px where buf != 9)
    let tplPx = 0, tplPxTot = 0;
    const buf = world.templates?.get(`${tx},${ty}`);
    for (let j = 0; j < 512; j += STEP) for (let i = 0; i < 512; i += STEP) {
      const gy = ty * 512 + j + 2, gx = tx * 512 + i + 2; // +2 = mid-block
      tplPxTot++;
      if (buf) {
        const o = 3 * ((gy - ty * 512) * 512 + (gx - tx * 512));
        if (buf[o] !== 9 || buf[o + 1] !== 9 || buf[o + 2] !== 9) tplPx++;
      }
      const c = worldColorAtSafe(world, gx, gy);
      if (!c) black++;
      tot++;
      let s = perDef.get(def);
      if (!s) perDef.set(def, (s = { chunks: 0, samples: 0, black: 0, tplCovered: 0, tplChunks: 0 }));
      s.samples++;
      if (!c) s.black++;
      if (buf && tplPxTot && tplPx / tplPxTot > 0.5) { /* counted below */ }
    }
    let s = perDef.get(def);
    s.chunks++;
    if (buf) {
      // coverage = fraction of sampled px painted by the template lane
      s.tplChunks++;
      // recompute cheaply: one pass above already did px; approximate via tplPx/tplPxTot
      if (tplPx / tplPxTot > 0.5) s.tplCovered++;
    }
  }
}
function worldColorAtSafe(w, gx, gy) {
  try { return wg.worldColorAt(w, gx, gy); } catch { return null; } // escaping throw = 500 in viewer; count as black
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(2) : "0.00");
console.log(`[blackfrac:${label}] BAND ty62..95 step ${STEP}: black ${black}/${tot} = ${pct(black, tot)}%`);
const rows = [...perDef.entries()].sort((a, b) => b[1].samples - a[1].samples);
for (const [def, s] of rows.filter(([, s]) => s.samples >= 256)) {
  console.log(`[blackfrac:${label}] ${def.padEnd(34)} ch=${String(s.chunks).padStart(3)} black=${pct(s.black, s.samples).padStart(6)}% tplChunks=${s.tplChunks}/${s.chunks} tplCovered>50%=${s.tplCovered}`);
}
const out = path.join(REPO, "mapgen/out", `noodle-blackfrac-${label}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  label, seed, flags: { v2: process.env.SURFACE_V2 ?? null, v3: process.env.SURFACE_V3 ?? null },
  band: { samples: tot, black, pct: +(100 * black / tot).toFixed(3) },
  perDef: Object.fromEntries([...perDef.entries()].map(([k, v]) => [k, { ...v, blackPct: +(100 * v.black / v.samples).toFixed(3) }])),
}, null, 2));
console.log(`[blackfrac:${label}] wrote ${out}`);
process.exit(0);
