// Follow-up: is the (3,2..5)-shift signal real? (2026-09-08)
// 1. Peak sharpness: full vote histogram around the winning shift for the
//    perfect attempts (excavationsite 92/A=3, 93/A=1).
// 2. Wrong-seed controls: score each group's items against fills from the
//    OTHER seeds' chains -> the honest noise ceiling for "perfect" scores.
// 3. The CE prediction: the runtime-observed last fill = w=256 or 102 area
//    accepted at A=99 (dist 115). Check coalmine/coalmine_alt 91 A=99 rows.

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { buildTileset, NollaPrng, generateCorner } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const CLASSIF = path.join(repoRoot, "mapgen/out/oracle/classification.json");
const C1 = 4.656612875e-10;
const WXD = [-2, -1, 0, 1, 2];
const WYD = [-3, -2, -1, 0, 1];
const R = 70;

const rgbOf = (a) => [(a >> 16) & 0xff, (a >> 8) & 0xff, a & 0xff];
const TRIG = { green: rgbOf(0xff00ff00), heart: rgbOf(0xff78ffff), chest: rgbOf(0xff55ff8c) };

function colorsFor(item, biomeName) {
  switch (item.class) {
    case "wand": case "other:wand_level_01.xml": case "other:wand_level_02.xml":
    case "other:wand_level_02_better.xml": case "other:wand_unshuffle_01.xml":
    case "other:wand_unshuffle_02.xml": case "potion":
    case "other:pickup/thunderstone.xml": case "other:pickup/brimstone.xml":
    case "other:pickup/broken_wand.xml": case "egg":
      return ["green"];
    case "heart": return ["heart"];
    case "chest": return biomeName === "coalmine" ? ["heart", "chest"] : ["heart"];
    default: return null;
  }
}

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const classif = JSON.parse(fs.readFileSync(CLASSIF, "utf-8"));
function defFor(name) { for (const d of config.biomes.values()) if (d.name === name) return d; }
const atlasCache = new Map();
function atlasFor(def) {
  if (!atlasCache.has(def.name)) {
    const p = path.join(dataDir, def.templateFile.replace(/^data\//, ""));
    atlasCache.set(def.name, readPng(p));
  }
  return atlasCache.get(def.name);
}
const widthCells = (a, b) => Math.trunc((b * 512) / 10) - Math.trunc((a * 512) / 10);

function chainParam9(seedN, w, A) {
  const driver = new NollaPrng(0);
  driver.seed = seedN;
  driver.next();
  const skip = (w % 11) + (seedN % 12);
  for (let t = 0; t < skip; t++) driver.next();
  for (let a = 0; a <= A; a++) driver.next();
  return driver.seed * C1 * 2147483645.0;
}

function fillAttempt(ts, w, h, param9) {
  const tls = new NollaPrng(param9);
  try {
    const res = generateCorner(ts, w, h + 4,
      (i, j, p) => tls.nextU() % ts.numColor[p],
      (i, j, n) => tls.nextU() % n,
      (i, j, p, old) => { const off = 1 + (tls.nextU() % (ts.numColor[p] - 1)); return (old + off) % ts.numColor[p]; });
    return res.rgb.subarray(3 * w * 4);
  } catch { return null; }
}

function extractTriggers(rgb, w, h) {
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = 3 * (y * w + x);
    const r = rgb[i];
    if (r !== 0 && r !== 85 && r !== 120) continue;
    const g = rgb[i + 1], b = rgb[i + 2];
    if (g === 255 && b === 0) out.push({ x, y, c: "green" });
    else if (g === 255 && b === 255) out.push({ x, y, c: "heart" });
    else if (g === 255 && b === 140) out.push({ x, y, c: "chest" });
  }
  return out;
}

function voteGrid(items, triggers) {
  const votes = new Map();
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    for (const t of triggers) {
      if (!it.colors.includes(t.c)) continue;
      const ddx = t.x - it.ax, ddy = t.y - it.ay;
      if (Math.abs(ddx) > R + 3 || Math.abs(ddy) > R + 4) continue;
      for (const dx of WXD) for (const dy of WYD) {
        const gx = ddx - dx, gy = ddy - dy;
        if (Math.abs(gx) > R || Math.abs(gy) > R) continue;
        const key = gx + "," + gy;
        let s = votes.get(key);
        if (!s) { s = new Set(); votes.set(key, s); }
        s.add(k);
      }
    }
  }
  return votes;
}
function topShifts(votes, n) {
  return [...votes.entries()].map(([k, s]) => ({ k, n: s.size }))
    .sort((a, b) => b.n - a.n).slice(0, n);
}

// group model shared with the main run
function groupFor(seed, name) {
  const rows = classif.seeds[seed].rows;
  for (const r of rows) {
    if (r.biome !== name) continue;
    const at = biomeAt(config, r.cx + 35, r.cy + 14);
    if (!at) continue;
    const def = defFor(name);
    const items = [];
    for (const r2 of classif.seeds[seed].rows) {
      if (r2.biome !== name) continue;
      const at2 = biomeAt(config, r2.cx + 35, r2.cy + 14);
      if (!at2 || at2.area.x1 !== at.area.x1 || at2.area.y1 !== at.area.y1) continue;
      const colors = colorsFor(r2, name);
      if (!colors) continue;
      items.push({
        ax: Math.floor((r2.x - 512 * (at.area.x1 - 35)) / 10),
        ay: Math.floor((r2.y - 512 * (at.area.y1 - 14)) / 10),
        colors, cls: r2.class, x: r2.x, y: r2.y,
      });
    }
    return { def, area: at.area, items };
  }
  return null;
}

console.log("=== 1. PEAK SHARPNESS (perfect attempts) ===");
for (const [seed, A] of [["78633192", 3], ["78633193", 1]]) {
  const g = groupFor(seed, "excavationsite");
  const ts = buildTileset(atlasFor(g.def));
  const w = widthCells(g.area.x1, g.area.x2 + 1), h = widthCells(g.area.y1, g.area.y2 + 1);
  const rgb = fillAttempt(ts, w, h, chainParam9(Number(seed) >>> 0, w, A));
  const trig = extractTriggers(rgb, w, h);
  const votes = voteGrid(g.items, trig);
  console.log(`excavationsite ${seed} A=${A} (${g.items.length} items) top shifts:`);
  for (const { k, n } of topShifts(votes, 8)) console.log(`   shift (${k}): ${n}/${g.items.length}`);
}

console.log("\n=== 2. WRONG-SEED CONTROLS (excavationsite, 30 fills each) ===");
const g92 = groupFor("78633192", "excavationsite");
const g93 = groupFor("78633193", "excavationsite");
const tsEx = buildTileset(atlasFor(g92.def));
const wEx = widthCells(g92.area.x1, g92.area.x2 + 1), hEx = widthCells(g92.area.y1, g92.area.y2 + 1);
const controlMax = { "92items|93fills": 0, "93items|92fills": 0 };
const controlAt = [];
for (const [itemsTag, items, fillSeed] of [["92items|93fills", g92.items, "78633193"], ["93items|92fills", g93.items, "78633192"]]) {
  for (let A = 0; A < 30; A++) {
    const rgb = fillAttempt(tsEx, wEx, hEx, chainParam9(Number(fillSeed) >>> 0, wEx, A));
    const votes = voteGrid(items, extractTriggers(rgb, wEx, hEx));
    const t = topShifts(votes, 1)[0];
    if (t && t.n > controlMax[itemsTag]) {
      controlMax[itemsTag] = t.n;
      controlAt.push(`${itemsTag} A=${A} shift (${t.k}) = ${t.n}/${items.length}`);
    }
  }
}
console.log("control maxes:", JSON.stringify(controlMax));
console.log("control details:", controlAt.join("; ") || "(none above 0)");

console.log("\n=== 3. CE PREDICTION CHECK: last fill = A=99, w=256 or 102 (seed 91) ===");
const prev = JSON.parse(fs.readFileSync(path.join(repoRoot, "mapgen/out/oracle/chain-judge.json"), "utf-8"));
for (const key of ["78633191|coalmine|34,14", "78633191|coalmine_alt|32,15"]) {
  const r = prev[key];
  if (!r) continue;
  const a99 = r.stats.find((s) => s.A === 99);
  console.log(`${key}: items=${r.items}  A=99 -> max ${a99.max}/${r.items} at shift (${a99.gx},${a99.gy})`);
  const fam = r.stats.filter((s) => Math.abs(s.gx - 3) <= 2 && s.max >= Math.ceil(r.items * 0.5));
  console.log(`   family-shift (gx≈3) attempts ≥50%: ${fam.map((f) => `A=${f.A}:${f.max}/${r.items}@(${f.gx},${f.gy})`).join(", ") || "none"}`);
}
