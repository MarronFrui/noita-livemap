// dig #148 — the XML component census: raw vs comment-stripped (ACTIVE)
// <MaterialComponent> counts per biome XML. Motivation: dig #147's polygon
// count pins were built on components that exist only inside <!-- -->
// comments (temple_wall / boss_arena / end_wall — ALL their comps; wandcave
// 1 of 4). The game's XML loader (a real parser) never sees commented-out
// elements; the port's regex matched raw text and built phantom tables.
//
// Reproduction: node mapgen/experiments/2026-10-16-dig148-xml-comp-census.mjs
//   (uses NOITA_DATA_DIR or the standard Windows/Proton fallback)
// Output: per-file (raw, active) for every file where they differ, plus the
// totals. E1 meter (presence counts) — no composed-output reading.

import fs from "node:fs";
import path from "node:path";

const dataDir =
  process.env.NOITA_DATA_DIR ??
  "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";

const dirs = ["biome", "biome_impl"];
let totRaw = 0;
let totAct = 0;
const changed = [];
let filesWithComps = 0;

for (const d of dirs) {
  const dir = path.join(dataDir, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".xml")) continue;
    const p = path.join(dir, f);
    const s = fs.readFileSync(p, "utf-8");
    const raw = (s.match(/<MaterialComponent\b/g) ?? []).length;
    if (raw === 0) continue;
    filesWithComps++;
    const active = (s.replace(/<!--[\s\S]*?-->/g, "").match(/<MaterialComponent\b/g) ?? []).length;
    totRaw += raw;
    totAct += active;
    if (raw !== active) changed.push({ file: `${d}/${f}`, raw, active });
  }
}

console.log(`files with <MaterialComponent>: ${filesWithComps}`);
console.log(`total raw comps: ${totRaw}   total active (comment-stripped): ${totAct}`);
console.log(`is_polygon active census: see ABOUT_MATH entry (148)`);
console.log(`files CHANGED by comment-stripping (raw -> active):`);
for (const c of changed) console.log(`  ${c.file}: ${c.raw} -> ${c.active}`);
