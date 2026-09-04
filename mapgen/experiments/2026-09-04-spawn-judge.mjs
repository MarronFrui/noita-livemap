// L1 spawn-equation judge — first run (2026-09-04).
//
// Constraint material: probe v3 entity dumps (seeds 78633191/92/93), minus
// fixed spawns (3-way intersection). Each seed-dependent item implies:
//   "the wang pixel at (approximately) this world position carried the trigger
//    color of a spawn function that produces this item class."
// Trigger mapping (verified this session in game data):
//   Tile atlases carry ONLY these wang spawn colors (pixel-counted this session):
//     ff00ff00 spawn_items  -> biome-local fn -> RNG gate -> wand_altar pixel
//                              scene (20x30) whose art contains ONE ff50A0F0 px
//                              -> spawn_wands -> per-biome g_items (wands AND
//                              potion entries); fungicave green = 94% altar
//     ff78FFFF spawn_heart  -> 70% heart.xml, else chest_random/mimic
//     ff55FF8C spawn_chest  -> chest_random (coalmine registration only)
//   Downstream classes (potion, wand_*, thunderstone, brimstone, broken_wand,
//   eggs) all cascade from the GREEN root trigger -> constrain on root.
//   goldnugget* -> physics debris (props/orbs break during the sweep; no
//   static spawner exists) — excluded per user insight 2026-09-04.
// Models judged: (A) noitool wasm full pipeline; (B) wang-js sequential attempt.
// Tolerance: item may fall after spawn -> trigger pixel searched at
//   dx in [-2..2], dy in [-4..0] atlas px around floor((world-origin)/10).
// Output: satisfaction per model x seed x class + chance baseline (color share).
// Verdict -> ABOUT_MATH.md §6 per mapgen/README convention.

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { loadWang } from "../lib/wang-wasm.mjs";
import { buildTileset, seqAttempt } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const SEEDS = ["78633191", "78633192", "78633193"];
const CLASSIF = path.join(repoRoot, "mapgen/out/oracle/classification.json");

const DX = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const DY = [-6, -5, -4, -3, -2, -1, 0, 1];

// ARGB int -> [r, g, b]
const rgbOf = (argb) => [(argb >> 16) & 0xff, (argb >> 8) & 0xff, argb & 0xff];
const eq = (px, rgb) => px[0] === rgb[0] && px[1] === rgb[1] && px[2] === rgb[2];

function colorsFor(item, biomeName) {
  // Root-trigger mapping: green ff00ff00 covers every altar-cascade class
  switch (item.class) {
    case "wand":
    case "other:wand_level_01.xml":
    case "other:wand_level_02.xml":
    case "other:wand_level_02_better.xml":
    case "other:wand_unshuffle_01.xml":
    case "other:wand_unshuffle_02.xml":
    case "potion":
    case "other:pickup/thunderstone.xml":
    case "other:pickup/brimstone.xml":
    case "other:pickup/broken_wand.xml":
    case "egg":
      return [0xff00ff00];
    case "heart":
      return [0xff78ffff];
    case "chest":
      return biomeName === "coalmine"
        ? [0xff78ffff, 0xff55ff8c]
        : [0xff78ffff];
    default:
      return null; // gold (physics debris), books, orbs, misc -> excluded
  }
}

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const classif = JSON.parse(fs.readFileSync(CLASSIF, "utf-8"));

// Preload per-biome generation inputs
const biomeByColor = config.biomes; // Map<colorInt, def>
function defFor(name) {
  for (const def of biomeByColor.values()) if (def.name === name) return def;
  return undefined;
}

const atlasCache = new Map();
function atlasFor(def) {
  if (!atlasCache.has(def.name)) {
    const p = path.join(dataDir, def.templateFile.replace(/^data\//, ""));
    atlasCache.set(def.name, { bytes: fs.readFileSync(p), png: readPng(p) });
  }
  return atlasCache.get(def.name);
}

const wang = await loadWang();

function checkWindow(rgb, width, height, ax, ay, rgbs) {
  for (const dy of DY) {
    for (const dx of DX) {
      const x = ax + dx;
      const y = ay + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = 3 * (y * width + x);
      const px = [rgb[i], rgb[i + 1], rgb[i + 2]];
      if (rgbs.some((c) => eq(px, c))) return true;
    }
  }
  return false;
}

const report = {};
const perModel = { wasm: {}, js: {} };
const baselines = {};

for (const seed of SEEDS) {
  const rows = classif.seeds[seed].rows;
  // Group items by biome+area — use the FULL connected-component bbox from
  // biomeAt (generation dims depend on it: GetRNG skip = f(area width)).
  const groups = new Map();
  for (const r of rows) {
    if (r.biome === "unknown") continue;
    const at = biomeAt(config, r.cx + 35, r.cy + 14);
    if (!at) continue;
    const k = `${r.biome}|${at.area.x1},${at.area.y1}`;
    if (!groups.has(k)) {
      groups.set(k, { def: defFor(r.biome), area: { ...at.area }, items: [] });
    }
    groups.get(k).items.push(r);
  }

  for (const [k, g] of groups) {
    const def = g.def;
    if (!def) {
      console.log(`  ! no biome def for ${k}, skipping`);
      continue;
    }
    const { bytes, png } = atlasFor(def);
    const seedN = Number(seed) >>> 0;

    // Model A: noitool wasm (full pipeline incl. rejection + finalize-ish)
    const gen = wang.generateArea({
      seed: seedN,
      color: Number(def.colorInt ?? def.color ?? 0),
      area: g.area,
      atlasPngBytes: bytes,
      isCoalMine: def.isCoalMine,
      shouldBlockOutRooms: def.shouldBlockOutRooms,
      randomMaterials: def.randomMaterials,
    });

    // Model B: JS sequential attempt (single, no hasPath)
    const ts = buildTileset(png);
    const wCells = Math.trunc(((g.area.x2 + 1 - g.area.x1) * 512) / 10);
    const hCells = Math.trunc(((g.area.y2 + 1 - g.area.y1) * 512) / 10);
    const js = seqAttempt(ts, wCells, hCells, seedN);

    for (const item of g.items) {
      const colors = colorsFor(item, def.name);
      if (!colors) continue;
      const ax = Math.floor((item.x - gen.worldX) / 10);
      const ay = Math.floor((item.y - gen.worldY) / 10);
      const satW = checkWindow(gen.bigMap ? toRgb(gen.bigMap) : null, gen.bigWidth, gen.bigHeight, ax, ay, colors.map(rgbOf));
      const satJ = checkWindow(js.rgb, js.width, js.height, ax, ay, colors.map(rgbOf));
      perModel.wasm[seed] ??= { n: 0, sat: 0 };
      perModel.js[seed] ??= { n: 0, sat: 0 };
      perModel.wasm[seed].n++;
      perModel.js[seed].n++;
      if (satW) perModel.wasm[seed].sat++;
      if (satJ) perModel.js[seed].sat++;
      (report[seed] ??= []).push({ ...item, satWasm: satW, satJs: satJ });
    }

    // Chance baseline: share of trigger-colored pixels in the wasm bigMap
    const counts = {};
    const rgbsAll = [...colorsForClassesSeen(g.items, def.name)];
    for (const c of rgbsAll) counts[c] = { px: 0 };
    const total = gen.bigWidth * gen.bigHeight;
    for (let i = 0; i < total; i++) {
      const r = gen.bigMap[4 * i], gg = gen.bigMap[4 * i + 1], b = gen.bigMap[4 * i + 2];
      for (const c of rgbsAll) if (r === c[0] && gg === c[1] && b === c[2]) { counts[c].px++; break; }
    }
    baselines[`${seed}|${k}`] = Object.fromEntries(
      rgbsAll.map((c) => [c.map((v) => v.toString(16).padStart(2, "0")).join(""), +(counts[c].px / total).toFixed(4)])
    );
  }
}

function colorsForClassesSeen(items, biomeName) {
  const set = new Set();
  for (const it of items) {
    for (const c of colorsFor(it, biomeName) ?? []) set.add(c);
  }
  return [...set].map(rgbOf);
}

function toRgb(rgbaBuf) {
  // wasm bigMap is RGBA; return an RGB-strided view-equivalent buffer
  const n = rgbaBuf.length / 4;
  const out = Buffer.alloc(3 * n);
  for (let i = 0; i < n; i++) {
    out[3 * i] = rgbaBuf[4 * i];
    out[3 * i + 1] = rgbaBuf[4 * i + 1];
    out[3 * i + 2] = rgbaBuf[4 * i + 2];
  }
  return out;
}

console.log("=== L1 spawn-equation judge — v1 (root triggers, tolerance dx±4, dy[-6..1]) ===");
for (const model of ["wasm", "js"]) {
  console.log(`\nModel ${model}:`);
  for (const seed of SEEDS) {
    const s = perModel[model][seed] ?? { n: 0, sat: 0 };
    console.log(`  ${seed}: ${s.sat}/${s.n} constraints satisfied (${((100 * s.sat) / Math.max(1, s.n)).toFixed(1)}%)`);
  }
}
console.log("\nChance baseline (trigger-color pixel share per seed|area):");
for (const [k, v] of Object.entries(baselines)) console.log(`  ${k}: ${JSON.stringify(v)}`);

fs.writeFileSync(
  path.join(repoRoot, "mapgen/out/oracle/judge-v1.json"),
  JSON.stringify({ perModel, baselines, detail: report }, null, 2)
);
console.log("\nWrote mapgen/out/oracle/judge-v1.json");
