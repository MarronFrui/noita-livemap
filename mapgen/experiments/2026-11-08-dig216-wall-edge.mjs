// dig #216 instrument (METER-CLASS: E1 per-row edge position + E2 sentinel):
// the Hell side walls (solid_wall | the_end at display cols 26|27 and 41|42,
// rows 96..143) — per sampled display row wy, the capture's wall→interior
// boundary x vs (a) the straight chunk line and (b) the C187 GetBiomeAt
// prediction (the first X where biomeAtPixel turns from the wall biome).
// Usage: node mapgen/experiments/2026-11-08-dig216-wall-edge.mjs [census]
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { loadBiomeConfig, biomeAtPixel } from "../lib/biomes.mjs";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";

const cache = path.join(repoRoot, "mapgen/out/cache/tiles");
const B = "https://regular-main-branch-middle.acidflow.stream/maps/regular-main-branch-middle/regular-main-branch-middle-2024-08-12-78633191_files";
const T = new Map();
async function tile(tx, ty) {
  const k = `${tx}_${ty}`;
  if (T.has(k)) return T.get(k);
  const cp = path.join(cache, `regular-main-branch-middle-2024-08-12-78633191-17-${k}.webp`);
  if (!fs.existsSync(cp)) {
    const r = await fetch(`${B}/17/${k}.webp`);
    fs.writeFileSync(cp, Buffer.from(await r.arrayBuffer()));
  }
  const { data, info } = await sharp(cp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = { data, info, l: tx > 0 ? 2 : 0, t: ty > 0 ? 2 : 0 };
  T.set(k, t);
  return t;
}
async function px(wx, wy) {
  const t = await tile(wx >> 9, wy >> 9);
  const p = 3 * (((wy & 511) + t.t) * t.info.width + (wx & 511) + t.l);
  return [t.data[p], t.data[p + 1], t.data[p + 2]];
}

if (process.argv[2] === "census") {
  for (const [x0, x1] of [[26 * 512 + 100, 26 * 512 + 400], [27 * 512 + 200, 27 * 512 + 500]]) {
    const h = new Map();
    for (let wy = 104 * 512; wy < 105 * 512; wy += 2)
      for (let wx = x0; wx < x1; wx += 2) {
        const c = (await px(wx, wy)).join(",");
        h.set(c, (h.get(c) || 0) + 1);
      }
    console.log(x0 >> 9, [...h].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e.join(":")).join("  "));
  }
  process.exit(0);
}

// wall pixel = the solid_wall render family (census @ display row 104:
// (37,21,17) 70% / (55,34,29) / (64,35,28) / (98,59,50)); the_end's interior =
// (4,0,0) / (20,10,10) / (14,7,7) / (32,16,14) ⇒ split on R ≥ 35 && G ≥ 19.
const isWall = ([r, g]) => r >= 35 && g >= 19;
const config = loadBiomeConfig(findNoitaDataDir());
// mode "render": the prediction = OUR render (worldColorAt) through the same
// wall classifier; default: the bare C187 law (biomeAtPixel).
let wallBiome = (X, Y) => /solid_wall/.test(biomeAtPixel(config, X, Y)?.filename ?? "");
if (process.argv.includes("render")) {
  const { ensureWorld, worldColorAt } = await import("../lib/world-gen.mjs");
  const world = ensureWorld(78633191, findNoitaDataDir(), { cacheDir: path.join(repoRoot, "mapgen/out/gen-cache/r3i") });
  await world.ready;
  wallBiome = (X, Y) => { const c = worldColorAt(world, X, Y + 48 * 512); return !!c && isWall(c); };
}

const out = { west: [], east: [] };
for (let wy = 96 * 512 + 16; wy < 144 * 512; wy += 64) {
  const Y = wy - 48 * 512;
  for (const side of ["west", "east"]) {
    const line = side === "west" ? 27 * 512 : 42 * 512;
    const dir = side === "west" ? 1 : -1; // scan from inside the wall toward the interior
    // capture: first non-wall px (run of 3) scanning from line − 80·dir
    let cap = null;
    for (let k = 0; k <= 160; k++) {
      const wx = line - 80 * dir + k * dir;
      if (!isWall(await px(wx, wy)) && !isWall(await px(wx + dir, wy)) && !isWall(await px(wx + 2 * dir, wy))) { cap = wx; break; }
    }
    let pred = null;
    for (let k = 0; k <= 160; k++) {
      const wx = line - 80 * dir + k * dir;
      if (!wallBiome(wx, Y)) { pred = wx; break; }
    }
    out[side].push({ wy, cap, pred, line });
  }
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const side of ["west", "east"]) {
  const rows = out[side].filter((r) => r.cap != null && r.pred != null);
  const dPred = rows.map((r) => Math.abs(r.cap - r.pred));
  const dLine = rows.map((r) => Math.abs(r.cap - r.line));
  const in41 = rows.filter((r) => Math.abs(r.cap - r.line) <= 42).length;
  console.log(`${side}: rows=${rows.length}/${out[side].length}  median|cap−pred|=${med(dPred)}  ≤4px ${(dPred.filter((d) => d <= 4).length / rows.length * 100).toFixed(1)}%  | control median|cap−line|=${med(dLine)}  cap within ±42 of line ${in41}/${rows.length}`);
}
if (process.argv.includes("rows")) for (const r of out.west) console.log(r.wy, r.cap - r.line, r.pred - r.line);
