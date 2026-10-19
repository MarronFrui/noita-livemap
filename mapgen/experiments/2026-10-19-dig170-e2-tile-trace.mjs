// 2026-10-19-dig170-e2-tile-trace.mjs — dig #170's E2 falsifier (M/E2,
// sentinel only): the C97 A/B (surface-shape-2026-10-10-v3-pre170.json vs
// -v3.json, SURFACE_V3 lane, seed 78633191) reports the tiles whose IoU
// moved. The frame fix's lane = the template lane (the splice/init scene
// reads); the prediction (entry (170)): a CHANGED tile must carry
// template-lane content (any non-9 px in its 4 display chunks), and an
// ALL-9 tile must change 0. This script checks changed ⊆ touched.
// Reproduction: node mapgen/experiments/2026-10-19-dig170-e2-tile-trace.mjs

import fs from "node:fs";
import path from "node:path";
import { ensureWorld, SKY_ROWS } from "../lib/world-gen.mjs";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";

const DATA = findNoitaDataDir();
const SEED = 78633191;

// the freshest repo gen-cache covering the seed (tests/mapgen/world-gen.test.mjs pattern)
function findCacheDir() {
  const base = path.join(repoRoot, "mapgen/out/gen-cache");
  try {
    const revs = fs.readdirSync(base).sort().reverse();
    for (const rev of revs) {
      if (fs.existsSync(path.join(base, rev, String(SEED)))) return path.join(base, rev);
    }
  } catch {}
  return null;
}
const cacheDir = findCacheDir();
if (!cacheDir) { console.error("no gen-cache for the seed"); process.exit(2); }

const a = JSON.parse(fs.readFileSync(path.join(repoRoot, "mapgen/out/surface-shape-2026-10-10-v3-pre170.json"), "utf8"));
const b = JSON.parse(fs.readFileSync(path.join(repoRoot, "mapgen/out/surface-shape-2026-10-10-v3.json"), "utf8"));
const ta = new Map(a.tiles.map((t) => [`${t.tx}_${t.bty}`, t]));
const changed = [], unchanged = [];
for (const t of b.tiles) {
  const u = ta.get(`${t.tx}_${t.bty}`);
  if (!u) continue;
  (Math.abs(t.iou - u.iou) > 1e-9 ? changed : unchanged).push(`${t.tx}_${t.bty}`);
}

const world = ensureWorld(SEED, DATA, { cacheDir });
await world.ready;

const touched = (tx, bty) => {
  const ty = bty + SKY_ROWS;
  // a tile spans 2x2 display chunks — content in ANY of them counts
  for (const dy of [0, 1]) for (const dx of [0, 1]) {
    const buf = world.templates?.get(`${tx + dx},${ty + dy}`);
    if (!buf) continue;
    for (let i = 0; i < buf.length; i += 3) {
      if (buf[i] !== 9 || buf[i + 1] !== 9 || buf[i + 2] !== 9) return true;
    }
  }
  return false;
};
const bad = changed.filter((k) => {
  const [tx, bty] = k.split("_").map(Number);
  return !touched(tx, bty);
});
console.log(`E2 A/B tile trace (v3 lane): changed=${changed.length} unchanged=${unchanged.length}`);
console.log(`changed tiles: ${changed.sort().join(" ")}`);
console.log(`changed tiles WITHOUT template content (the falsifier): ${bad.length} ${bad.length ? bad.join(" ") : ""}`);
console.log(bad.length === 0 ? "PREDICTION (3) CONFIRMED: every changed tile carries template-lane content" : "PREDICTION (3) FALSIFIED");
