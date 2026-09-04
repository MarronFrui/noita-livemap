// Classify probe v3 entity dumps into spawn-equation constraint material.
//
// Question: which observed items are (a) seed-independent fixed spawns
// (exclude — they constrain nothing about the wang fill) and (b) seed-dependent
// wang-triggered candidates, and in which biome/area did each appear?
//
// Inputs:  mapgen/fixtures/oracle/noita-rng-probe3-entities-<seed>.csv (committed)
// Output:  mapgen/out/oracle/classification.json + console tables
//
// Verdict goes to ABOUT_MATH.md §6 per the mapgen/README convention.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";

const SEEDS = ["78633191", "78633192", "78633193"];
const FIXTURES = path.join(repoRoot, "mapgen/fixtures/oracle");
const OUT = path.join(repoRoot, "mapgen/out/oracle/classification.json");

function loadSeed(seed) {
  const p = path.join(FIXTURES, `noita-rng-probe3-entities-${seed}.csv`);
  const lines = fs.readFileSync(p, "utf-8").trim().split("\n").slice(1);
  const rows = lines.map((l) => {
    const [x, y, ...rest] = l.split(",");
    return { x: Number(x), y: Number(y), file: rest.join(",") };
  });
  // Dedupe exact (x,y,file) sightings (stacked entity IDs)
  const seen = new Map();
  for (const r of rows) seen.set(`${r.x},${r.y},${r.file}`, r);
  return [...seen.values()];
}

function itemClass(file) {
  const f = file.replace("data/entities/items/", "");
  if (f.startsWith("orbs/")) return "orb";
  if (f.startsWith("books/")) return "book";
  if (f.startsWith("wands/")) return "wand";
  if (f.startsWith("pickup/goldnugget")) return "gold";
  if (f.startsWith("pickup/potion")) return "potion";
  if (f.startsWith("pickup/heart")) return "heart";
  if (f.startsWith("pickup/chest")) return "chest";
  if (f.startsWith("pickup/egg")) return "egg";
  if (f.startsWith("pickup/perk")) return "perk";
  return `other:${f}`;
}

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);

const perSeed = new Map(SEEDS.map((s) => [s, loadSeed(s)]));

// 3-way fixed-spawn set: identical (x,y,file) in all three seeds
const key = (r) => `${r.x},${r.y},${r.file}`;
const setA = new Set(perSeed.get(SEEDS[0]).map(key));
const setB = new Set(perSeed.get(SEEDS[1]).map(key));
const setC = new Set(perSeed.get(SEEDS[2]).map(key));
const fixedKeys = [...setA].filter((k) => setB.has(k) && setC.has(k));

const result = { seeds: {}, fixedSpawns: [], classes: {} };
for (const k of fixedKeys) {
  const [x, y, ...f] = k.split(",");
  result.fixedSpawns.push({ x: Number(x), y: Number(y), file: f.join(","), class: itemClass(f.join(",")) });
}

for (const seed of SEEDS) {
  const rows = perSeed.get(seed);
  const wangCandidates = [];
  for (const r of rows) {
    if (fixedKeys.has ? fixedKeys.includes(key(r)) : false) continue;
    if (fixedKeys.includes(key(r))) continue;
    const cx = Math.floor(r.x / 512);
    const cy = Math.floor(r.y / 512);
    const at = biomeAt(config, cx + 35, cy + 14);
    wangCandidates.push({
      ...r,
      class: itemClass(r.file),
      cx,
      cy,
      biome: at?.biome.name ?? "unknown",
      areaX1: at?.area.x1,
      areaY1: at?.area.y1,
    });
  }
  const byClass = {};
  for (const r of wangCandidates) (byClass[r.class] ??= []).push(r);
  result.seeds[seed] = {
    total: rows.length,
    deduped: rows.length,
    wangCandidates: wangCandidates.length,
    byClass: Object.fromEntries(
      Object.entries(byClass).map(([c, rs]) => [c, rs.length])
    ),
    rows: wangCandidates,
  };
}

// Cross-seed class totals
const classTotals = {};
for (const seed of SEEDS) {
  for (const [c, n] of Object.entries(result.seeds[seed].byClass)) {
    classTotals[c] ??= {};
    classTotals[c][seed] = n;
  }
}
result.classes = classTotals;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

console.log(`Fixed spawns (all 3 seeds identical): ${result.fixedSpawns.length}`);
for (const f of result.fixedSpawns) {
  console.log(`  (${f.x},${f.y}) ${f.class.padEnd(8)} ${f.file}`);
}
console.log("\nSeed-dependent candidates per class:");
console.log("class        " + SEEDS.join("  "));
for (const [c, totals] of Object.entries(classTotals)) {
  console.log(
    c.padEnd(12) + SEEDS.map((s) => String(totals[s] ?? 0).padStart(6)).join("  ")
  );
}
console.log("\nPer-seed biome breakdown (wang candidates):");
for (const seed of SEEDS) {
  const byBiome = {};
  for (const r of result.seeds[seed].rows) {
    byBiome[r.biome] ??= 0;
    byBiome[r.biome]++;
  }
  console.log(`  ${seed}:`, byBiome);
}
console.log(`\nWrote ${OUT}`);
