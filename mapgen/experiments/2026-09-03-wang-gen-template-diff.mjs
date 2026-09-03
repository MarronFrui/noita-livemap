// Diff Nolla's official wang_gen.exe template output against the real atlas.
//
// The tool generates a BLANK template PNG from CLI params (corner/edge mode,
// short side, per-class color counts, vary counts) — the artist-side canvas.
// If our template walk parses the official template into exactly the same
// tile constraint enumeration as the real painted atlas, our layout logic is
// proven against the canonical tool.
//
// Usage: node mapgen/experiments/2026-09-03-wang-gen-template-diff.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir } from "../lib/paths.mjs";
import { readPng } from "../lib/images.mjs";
import { buildTileset } from "../lib/wang-js.mjs";

const WANG_GEN =
  process.env.WANG_GEN_EXE ||
  "/mnt/e/Programmes/Steam/steamapps/common/Noita/tools_modding/wang_gen.exe";
const WORKDIR = process.env.WANG_GEN_WORKDIR || "/mnt/c/Users/xan98/AppData/LocalLow/Temp/wgm";

function runTool(args) {
  fs.mkdirSync(WORKDIR, { recursive: true });
  execFileSync(WANG_GEN, args, { cwd: WORKDIR });
  return path.join(WORKDIR, args[0]);
}

function headerOf(png) {
  const w = png.width;
  const hdr = [];
  for (let i = 0; i < 9; i++) {
    const b = w * 3 - 1 - i;
    hdr.push((png.data[Math.floor(b / 3) * 4 + (b % 3)] ^ (i * 55)) & 0xff);
  }
  return hdr;
}

// constraint sixtuples (a..f) of all parsed tiles, order-independent
const constraintSet = (ts) =>
  [...ts.hTiles, ...ts.vTiles]
    .map((t) => [t.a, t.b, t.c, t.d, t.e, t.f].join(","))
    .sort();

// --- corner: coalmine params ---
const coalmineParams = ["wgm_template.png", "c", "13", "1", "2", "1", "2", "3", "3"];
const cornerTemplatePath = runTool(coalmineParams);
const dataDir = findNoitaDataDir();
const real = readPng(path.join(dataDir, "wang_tiles/coalmine.png"));
const tpl = readPng(cornerTemplatePath);

console.log(`corner template: ${tpl.width}x${tpl.height}  real atlas: ${real.width}x${real.height}`);
console.log(`dims match: ${tpl.width === real.width && tpl.height === real.height}`);
const hT = headerOf(tpl), hR = headerOf(real);
console.log(`header bytes: template=[${hT}]  real=[${hR}]  match=${hT.every((v, i) => v === hR[i])}`);

const tsT = buildTileset(tpl);
const tsR = buildTileset(real);
console.log(
  `tiles parsed: template ${tsT.hTiles.length}h+${tsT.vTiles.length}v  real ${tsR.hTiles.length}h+${tsR.vTiles.length}v`
);

const setT = constraintSet(tsT);
const setR = constraintSet(tsR);
const same =
  setT.length === setR.length && setT.every((v, i) => v === setR[i]);
console.log(`constraint enumeration identical: ${same}`);
if (!same) {
  const onlyT = setT.filter((v) => !setR.includes(v));
  const onlyR = setR.filter((v) => !setT.includes(v));
  console.log(`  only in template (${onlyT.length}):`, onlyT.slice(0, 5));
  console.log(`  only in real    (${onlyR.length}):`, onlyR.slice(0, 5));
}

// --- edge: winter_caves params ---
const edgePath = runTool(["wgm_template_edge.png", "e", "32", "3", "3", "2", "2", "1", "1", "1", "1"]);
const edgeTpl = readPng(edgePath);
const edgeHdr = headerOf(edgeTpl);
console.log(
  `\nedge template: ${edgeTpl.width}x${edgeTpl.height} (expected 1206x278)  header=[${edgeHdr}]`
);
console.log(`edge header is edge-mode (hdr[7] != 0xc0): ${edgeHdr[7] !== 0xc0}`);
console.log(
  `edge params roundtrip: colors=[${edgeHdr.slice(0, 6)}] vary=${edgeHdr[6]}/${edgeHdr[7]} short=${edgeHdr[8]}`
);
