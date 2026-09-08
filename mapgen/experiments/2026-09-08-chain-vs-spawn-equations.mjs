// CHAIN vs SPAWN EQUATIONS — the decisive offline test (2026-09-08).
//
// The sub-seed chain is runtime-confirmed (VERIFIED.md §5): driver input C = ws,
// one warm-up Next, skip = (w%11)+(ws%12), attempt A: state = schrage^(16+A)(ws),
// param_9 = ((double)state * C1) * 2147483645.0, TLS seed = param_9, one warm-up.
// Chain validated bit-exact against the CE reading: schrage^115(78633191) ->
// param_9 = 1444051512.578899 (the value the user measured in DAT_013276c8).
//
// This script fills EVERY attempt A=0..99 for each frozen-seed area group with
// the corrected wang-js mechanics and scores each fill against the frozen
// spawn equations (root trigger colors near item positions), using SHIFT
// VOTING over a global anchor offset — this absorbs the port's known constant
// placement offset (§9 item 3) instead of poisoning the score.
//
// Verdict rule: the game-accepted attempt must spike to ~all constraints at a
// consistent shift; all other attempts stay at the chance maximum.
// Result -> ABOUT_MATH §6 + VERIFIED.md.

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { buildTileset, NollaPrng, generateCorner } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";

const SEEDS = ["78633191", "78633192", "78633193"];
const CLASSIF = path.join(repoRoot, "mapgen/out/oracle/classification.json");
const C1 = 4.656612875e-10;

// frozen-physics tolerance (items sit at exact spawn offsets)
const WXD = [-2, -1, 0, 1, 2];
const WYD = [-3, -2, -1, 0, 1];
const R = 70; // global-shift search radius (absorbs 3s-scan offset: 3*26=78? no, max s=26 -> widen if needed)

const rgbOf = (argb) => [(argb >> 16) & 0xff, (argb >> 8) & 0xff, argb & 0xff];
const TRIGGERS = {
  green: rgbOf(0xff00ff00), // [0,255,0]
  heart: rgbOf(0xff78ffff), // [120,255,255]
  chest: rgbOf(0xff55ff8c), // [85,255,140]
};

function colorsFor(item, biomeName) {
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
      return ["green"];
    case "heart":
      return ["heart"];
    case "chest":
      return biomeName === "coalmine" ? ["heart", "chest"] : ["heart"];
    default:
      return null;
  }
}

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const classif = JSON.parse(fs.readFileSync(CLASSIF, "utf-8"));

function defFor(name) {
  for (const def of config.biomes.values()) if (def.name === name) return def;
  return undefined;
}

const atlasCache = new Map();
function atlasFor(def) {
  if (!atlasCache.has(def.name)) {
    const p = path.join(dataDir, def.templateFile.replace(/^data\//, ""));
    atlasCache.set(def.name, { bytes: null, png: readPng(p) });
  }
  return atlasCache.get(def.name);
}

// game's per-term truncating GetWidthFromPix
const widthCells = (a, b) => Math.trunc((b * 512) / 10) - Math.trunc((a * 512) / 10);

function fillAttempt(ts, w, h, param9) {
  const tls = new NollaPrng(param9); // TLS seed = param9 (double); ctor = 1 warm-up
  try {
    const res = generateCorner(
      ts, w, h + 4,
      (i, j, p) => tls.nextU() % ts.numColor[p],
      (i, j, n) => tls.nextU() % n,
      (i, j, p, old) => {
        const off = 1 + (tls.nextU() % (ts.numColor[p] - 1));
        return (old + off) % ts.numColor[p];
      }
    );
    return res.rgb.subarray(3 * w * 4); // discard top 4 rows -> h rows
  } catch (e) {
    return null;
  }
}

function extractTriggers(rgb, w, h) {
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 3 * (y * w + x);
      const r = rgb[i];
      if (r !== 0 && r !== 85 && r !== 120) continue;
      const g = rgb[i + 1], b = rgb[i + 2];
      if (g === 255 && b === 0) out.push({ x, y, c: "green" });
      else if (g === 255 && b === 255) out.push({ x, y, c: "heart" });
      else if (g === 255 && b === 140) out.push({ x, y, c: "chest" });
    }
  }
  return out;
}

// shift-voting judge: returns {max, gx, gy, dist}
function judge(items, triggers) {
  const votes = new Map(); // "gx,gy" -> Set(itemIdx)
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    const cs = it.colors;
    for (const t of triggers) {
      if (!cs.includes(t.c)) continue;
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
  let max = 0, arg = null;
  for (const [key, s] of votes) {
    if (s.size > max) { max = s.size; arg = key; }
  }
  return { max, gx: arg ? +arg.split(",")[0] : 0, gy: arg ? +arg.split(",")[1] : 0 };
}

const results = {};
let chainValidated = false;

for (const seed of SEEDS) {
  const rows = classif.seeds[seed].rows;
  const groups = new Map();
  for (const r of rows) {
    if (r.biome === "unknown") continue;
    const at = biomeAt(config, r.cx + 35, r.cy + 14);
    if (!at) continue;
    const k = `${r.biome}|${at.area.x1},${at.area.y1}`;
    if (!groups.has(k)) groups.set(k, { def: defFor(r.biome), area: { ...at.area }, items: [] });
    groups.get(k).items.push(r);
  }

  for (const [k, g] of groups) {
    const def = g.def;
    if (!def) { console.log(`! no biome def for ${k}`); continue; }
    const ts = buildTileset(atlasFor(def).png);
    const s = ts.shortSideLen;
    const w = widthCells(g.area.x1, g.area.x2 + 1);
    const h = widthCells(g.area.y1, g.area.y2 + 1);
    const seedN = Number(seed) >>> 0;
    const skip = (w % 11) + (seedN % 12);
    const worldX = 512 * (g.area.x1 - 35);
    const worldY = 512 * (g.area.y1 - 14);

    const items = [];
    for (const r of g.items) {
      const colors = colorsFor(r, def.name);
      if (!colors) continue;
      items.push({
        ax: Math.floor((r.x - worldX) / 10),
        ay: Math.floor((r.y - worldY) / 10),
        colors,
        cls: r.class,
      });
    }
    if (items.length === 0) { console.log(`${seed} ${k}: no root-trigger items`); continue; }

    // chain validation once (A=99 of a w=256 area must reproduce the CE reading)
    if (!chainValidated && w === 256 && seedN === 78633191) {
      const driver = new NollaPrng(0);
      driver.seed = seedN;
      driver.next();
      for (let t = 0; t < skip; t++) driver.next();
      for (let a = 0; a <= 99; a++) driver.next();
      const p9 = driver.seed * C1 * 2147483645.0;
      chainValidated = Math.abs(p9 - 1444051512.578899) < 1e-6;
      console.log(`chain validation (schrage^115): param_9=${p9} ${chainValidated ? "== CE reading OK" : "MISMATCH!"}`);
      if (!chainValidated) process.exit(1);
    }

    console.log(`\n=== ${seed} ${k} (${def.name}) w=${w} h=${h} s=${s} skip=${skip} items=${items.length} ===`);
    const attemptStats = [];
    for (let A = 0; A <= 99; A++) {
      const driver = new NollaPrng(0);
      driver.seed = seedN;
      driver.next();
      for (let t = 0; t < skip; t++) driver.next();
      for (let a = 0; a <= A; a++) driver.next();
      const param9 = driver.seed * C1 * 2147483645.0;
      const rgb = fillAttempt(ts, w, h, param9);
      if (!rgb) { attemptStats.push({ A, max: -1 }); continue; }
      const triggers = extractTriggers(rgb, w, h);
      const j = judge(items, triggers);
      attemptStats.push({ A, ...j });
      if (j.max >= Math.ceil(items.length * 0.6)) {
        console.log(`  *** A=${A}: ${j.max}/${items.length} constraints at shift (${j.gx},${j.gy}) <<< SPIKE`);
      }
    }
    attemptStats.sort((a, b) => b.max - a.max);
    console.log(`top5 attempts by satisfied constraints:`);
    for (const st of attemptStats.slice(0, 5)) {
      console.log(`  A=${st.A}: ${st.max}/${items.length} at shift (${st.gx},${st.gy})`);
    }
    results[`${seed}|${k}`] = { w, h, s, skip, items: items.length, stats: attemptStats };
  }
}

fs.writeFileSync(
  path.join(repoRoot, "mapgen/out/oracle/chain-judge.json"),
  JSON.stringify(results, null, 2)
);
console.log("\nWrote mapgen/out/oracle/chain-judge.json");
