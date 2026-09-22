// 2026-09-21 — the caves-field port × the C48 oracle compare (the byte bar)
// AFTER the queue-#1 composition swap (the dig #55/#61/#64/#65/#68/#69
// byte-cited phase order + draw-budget mapping).
//
// Question: does the reordered composition move the sampled rows toward the
// C48 oracle (out/oracle/caves-grid-2026-09-21.json, grid_0x26599020 =
// the 512×256 bitmap_hills cache, seed 78633191)?
// Metric (the standing byte bar, ABOUT_MATH (59)):
//   per sampled row: rms(port vs oracle) + the >0.25-delta count (of 12)
//   + the solid-gate (>0.5, C34) disagreement count.
// The y224 row was BYTE-EXACT before this dig (the standing bar) — it must
// stay exact (the record stamps' aabb y ≤ 35 keeps it untouched).
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { loadBiomeConfig } from "../lib/biomes.mjs";
import { buildCavesField, CAVES_FIELD_VER } from "../lib/caves-field.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";

const dataDir = findNoitaDataDir();
const oracle = JSON.parse(
  readFileSync(path.join(repoRoot, "mapgen/out/oracle/caves-grid-2026-09-21.json"), "utf8")
);
const grid = oracle["grid_0x26599020"];

// the biome def that carries the bitmap_hills BitmapCaves block
const config = loadBiomeConfig(dataDir);
let def = null;
for (const d of config.biomes.values()) {
  if (d && d.bitmapCaves && d.bitmapCaves.name === "bitmap_hills") { def = d; break; }
}
if (!def) { console.error("no biome def carries bitmap_hills"); process.exit(1); }

const r = buildCavesField(dataDir, def, 78633191);
console.log("ver:", CAVES_FIELD_VER);
console.log("meta:", JSON.stringify(r.meta));

const rows = Object.keys(grid).filter((k) => /^y\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
let worst = 0;
for (const k of rows) {
  const y = Number(k.slice(1));
  const ref = grid[k];
  const xs = k === "y0_x0_31" ? null : ref.map((_, i) => i); // rows sample x 0..11
  const port = ref.map((_, i) => r.field[y * r.w + i]);
  let sum = 0, big = 0, gate = 0;
  for (let i = 0; i < ref.length; i++) {
    const d = port[i] - ref[i];
    sum += d * d;
    if (Math.abs(d) > 0.25) big++;
    if ((port[i] > 0.5) !== (ref[i] > 0.5)) gate++;
  }
  const rms = Math.sqrt(sum / ref.length);
  worst = Math.max(worst, rms);
  console.log(
    `${k.padEnd(9)} rms ${rms.toFixed(4)}  >0.25δ ${big}/${ref.length}  gate-mismatch ${gate}/${ref.length}`
  );
}
// the y0 bump row (x 0..31) — the image-lane stamp (the C48 identify target)
{
  const ref = grid["y0_x0_31"];
  const port = ref.map((_, i) => r.field[i]);
  let sum = 0, big = 0;
  for (let i = 0; i < ref.length; i++) {
    const d = port[i] - ref[i];
    sum += d * d;
    if (Math.abs(d) > 0.25) big++;
  }
  const rms = Math.sqrt(sum / ref.length);
  console.log(`y0(x0..31) rms ${rms.toFixed(4)}  >0.25δ ${big}/${ref.length}  (the bump = the image-lane writer, not in this port)`);
}
let solid = 0;
for (let i = 0; i < r.field.length; i++) if (r.field[i] > 0.5) solid++;
console.log("port solid share:", (solid / r.field.length).toFixed(4), "(the dig #30 oracle row samples ≈ 0.5)");
console.log("worst sampled-row rms:", worst.toFixed(4));

