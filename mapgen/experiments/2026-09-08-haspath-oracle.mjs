// HASPATH ORACLE VALIDATION (2026-09-08).
// The chain-vs-spawn run fixed the game's accept decisions:
//   excavationsite 91 -> attempt 0 accepted;  92 -> 0,1,2 rejected, 3 accepted;
//   93 -> 0 rejected, 1 accepted.  coalmine 91 -> (CE hint) 0..98 rejected, 99
//   accepted IF the runtime-observed last fill was this area (w=256).
// A hasPath port is correct iff it reproduces these verdicts exactly.
// Result -> ABOUT_MATH §6 / VERIFIED.md.

import path from "node:path";
import fs from "node:fs";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { loadBiomeConfig } from "../lib/biomes.mjs";
import { buildTileset, NollaPrng } from "../lib/wang-js.mjs";
import { generateCorner } from "../lib/wang-js.mjs";
import { readPng } from "../lib/images.mjs";
import { hasPath } from "../lib/has-path.mjs";

const C1 = 4.656612875e-10;
const SEED = 78633191;
const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
function defFor(name) { for (const d of config.biomes.values()) if (d.name === name) return d; }

// area + flags + oracle (first accepted attempt; null = unknown)
const ORACLE = [
  { biome: "excavationsite", area: { x1: 31, y1: 17 }, accept: 0 },
  { biome: "excavationsite", area: { x1: 31, y1: 17 }, accept: 3, seed: 78633192 },
  { biome: "excavationsite", area: { x1: 31, y1: 17 }, accept: 1, seed: 78633193 },
  { biome: "coalmine", area: { x1: 34, y1: 14 }, accept: null, seed: 78633191, hint99: true },
];

const widthCells = (a, b) => Math.trunc((b * 512) / 10) - Math.trunc((a * 512) / 10);

function fillAttempt(ts, w, h, param9) {
  const tls = new NollaPrng(param9);
  try {
    const res = generateCorner(
      ts, w, h + 4,
      (i, j, p) => tls.nextU() % ts.numColor[p],
      (i, j, n) => tls.nextU() % n,
      (i, j, p, old) => { const off = 1 + (tls.nextU() % (ts.numColor[p] - 1)); return (old + off) % ts.numColor[p]; }
    );
    return res.rgb.subarray(3 * w * 4);
  } catch (e) {
    return null;
  }
}

function chainParam9(seedN, w, A) {
  const driver = new NollaPrng(0);
  driver.seed = seedN;
  driver.next();
  const skip = (w % 11) + (seedN % 12);
  for (let t = 0; t < skip; t++) driver.next();
  for (let a = 0; a <= A; a++) driver.next();
  return driver.seed * C1 * 2147483645.0;
}

let allOk = true;
const summary = [];

for (const o of ORACLE) {
  const seedN = (o.seed ?? SEED) >>> 0;
  const def = defFor(o.biome);
  // resolve the full connected-component area from the classification groups
  // (same source as the chain-vs-spawn run)
  const classif = JSON.parse(fs.readFileSync(path.join(repoRoot, "mapgen/out/oracle/classification.json"), "utf-8"));
  let realArea = null;
  for (const r of classif.seeds[String(seedN)].rows) {
    if (r.biome !== o.biome) continue;
    const { biomeAt } = await import("../lib/biomes.mjs");
    const at = biomeAt(config, r.cx + 35, r.cy + 14);
    if (at) { realArea = at.area; break; }
  }
  if (!realArea) { console.log(`SKIP ${o.biome}: no area`); continue; }
  const w = widthCells(realArea.x1, realArea.x2 + 1);
  const h = widthCells(realArea.y1, realArea.y2 + 1);
  const ts = buildTileset(readPng(path.join(dataDir, def.templateFile.replace(/^data\//, ""))));
  const worldX = realArea.x1 - 35, worldY = realArea.y1 - 14;

  const verdicts = [];
  let firstAccept = null;
  for (let A = 0; A < 100; A++) {
    const rgb = fillAttempt(ts, w, h, chainParam9(seedN, w, A));
    if (!rgb) { verdicts.push({ A, err: "fill-failed" }); continue; }
    const copy = Buffer.from(rgb); // hasPath mutates; keep pristine fill out of it
    const r = hasPath(copy, w, h, {
      isCoalMine: !!def.isCoalMine,
      shouldBlockOutRooms: !!def.shouldBlockOutRooms,
      worldX, worldY,
    });
    verdicts.push({ A, ok: r.ok });
    if (r.ok) { firstAccept = A; break; }
  }
  const expect = o.accept;
  const pass = expect === null || firstAccept === expect;
  if (!pass) allOk = false;
  summary.push({ biome: o.biome, seed: seedN, w, h, firstAccept, expect, pass });
  console.log(
    `${pass ? "OK " : "FAIL"} ${o.biome} seed ${seedN} w=${w} h=${h}: first accepted = ${firstAccept} (oracle: ${expect ?? "?"}${o.hint99 ? ", hint 99" : ""})`
  );
  console.log(`   verdicts A0..: ${verdicts.slice(0, 8).map((v) => `A${v.A}:${v.ok ?? v.err}`).join(" ")}${verdicts.length > 8 ? " ..." : ""}`);
}

console.log(allOk ? "\nALL ORACLE CONSTRAINTS SATISFIED" : "\nORACLE MISMATCH — targeted asm diff needed");
fs.writeFileSync(
  path.join(repoRoot, "mapgen/out/oracle/haspath-oracle.json"),
  JSON.stringify(summary, null, 2)
);
