// Display-color pass for the genmap renderer. Transforms the accepted wang
// out_map (raw atlas art colors) into capture-calibrated display colors.
//
// Authority: capture-calibrated tables measured this session on the frozen91
// coalmine band (alignment 78.4%, ABOUT_MATH §6 2026-09-08 late-night entry)
// + game data (materials.xml wang_colors, biome XML RandomMaterials,
// scripts/biomes/*.lua registers). The grey→material noise semantics are an
// approximation (coherent world-seeded fill); exact band/vein math is open.

import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.mjs";

// --- materials.xml wang_color table (RGB, alpha-agnostic) -------------------
let _materials = null;
export function loadMaterials(dataDir) {
  if (_materials) return _materials;
  const xml = fs.readFileSync(path.join(dataDir, "materials.xml"), "utf-8");
  const byRgb = new Map();
  // per-element scan so name and wang_color come from the SAME element
  const tagRe = /<(\/?)(CellData|CellDataChild|VariableData)\b([^>]*?)(\/?)>/g;
  let m, depth = 0, buf = null;
  const extract = (blk) => {
    const name = (blk.match(/name="([^"]+)"/) ?? [])[1];
    const wc = (blk.match(/wang_color="([0-9a-fA-F]{6,8})"/) ?? [])[1];
    if (!name || !wc) return;
    const hex = (wc.length === 8 ? wc.slice(2) : wc).toLowerCase();
    if (!byRgb.has(hex)) byRgb.set(hex, name);
  };
  while ((m = tagRe.exec(xml))) {
    const [ , closing, tag, attrs, selfClose ] = m;
    if (closing) {
      if (tag === "CellData" || tag === "VariableData") { if (buf) { extract(buf); buf = null; } depth = 0; }
      // CellDataChild never nests here; attrs-only children need no buffer
      continue;
    }
    if (selfClose) { extract(attrs); continue; }
    if (tag === "CellDataChild") { extract(attrs); continue; }
    // opening CellData/VariableData: buffer until its closing tag
    buf = attrs;
    depth = 1;
  }
  if (buf) extract(buf);
  _materials = byRgb;
  return byRgb;
}

// --- capture-calibrated display shades (frozen91 coalmine band) ------------
// weights pick a shade per pixel via a deterministic hash (texture jitter)
const S = (rgb, w = 1) => ({ rgb, w });
export const SHADES = {
  airDark: [S([13, 14, 18], 7), S([12, 13, 17], 2), S([16, 16, 18], 1), S([21, 23, 30], 2)],
  rock: [S([39, 40, 45], 6), S([36, 37, 42], 2), S([42, 43, 48], 2)],
  soil: [S([70, 65, 40], 6), S([64, 58, 41], 3), S([89, 83, 59], 3), S([81, 74, 49], 4)],
  sand: [S([95, 87, 49], 6), S([132, 114, 54], 2), S([62, 69, 85], 2)],
  moss: [S([58, 78, 17], 6), S([65, 86, 28], 3), S([57, 78, 17], 2)],
  water: [S([39, 67, 63], 5), S([42, 70, 67], 4), S([39, 66, 62], 2), S([45, 73, 71], 1)],
  oil: [S([56, 51, 38], 6), S([57, 52, 39], 3), S([58, 53, 40], 2)],
  steel: [S([110, 95, 78], 5), S([105, 91, 75], 2), S([76, 65, 55], 1)],
  wood: [S([76, 64, 38], 3), S([86, 72, 42], 3), S([50, 43, 24], 2), S([98, 82, 57], 1)],
  woodV: [S([63, 52, 30], 3), S([70, 58, 34], 3), S([56, 47, 28], 2), S([45, 38, 22], 1)],
  coal: [S([33, 33, 33], 4), S([38, 38, 38], 3), S([50, 50, 50], 2), S([42, 42, 42], 2)],
  gunpowder: [S([181, 72, 68], 4), S([200, 95, 70], 3), S([126, 63, 68], 1), S([222, 129, 92], 1)],
  gold: [S([146, 116, 60], 5), S([120, 94, 48], 2)],
  radioactive: [S([96, 157, 64], 5), S([84, 140, 56], 2)],
  fallbackSolid: [S([90, 90, 95], 5), S([80, 80, 85], 2)],
};

// material name -> display shade family (capture-calibrated where marked ✅)
export const MATERIAL_SHADE = new Map([
  ["rock_static_wet", "rock"], // ✅ (39,40,45) 47%
  ["water", "water"], // ✅
  ["oil", "oil"], // ✅
  ["steel_static", "steel"], // ✅
  ["wood_static", "wood"], // ✅
  ["wood_static_vertical", "woodV"], // ✅
  ["coal", "coal"], // ✅ pure greys
  ["gunpowder_explosive", "gunpowder"], // ✅ red
  ["gold", "gold"],
  ["rock_static_radioactive", "radioactive"],
]);

// spawn-trigger / scene-marker colors consumed at generation (never visible).
// Union of: VERIFIED-known wang triggers, coalmine.lua registers, blocked-room
// colors, observed unmapped brights. 00ff33 is special (moss scene marker).
const TRIGGERS = new Set([
  "00ff00", "78ffff", "55ff8c", "ff0000", "ffff00", "800000",
  "967896", "967878", "969678", "80ff5a", "50a000", "c35700",
  "c88d1a", "c88000", "c84040", "4e175e", "55af4b", "23b9c3",
  "55af8c", "33934c", "50fafa", "f12ab5", "005cfd", "00b5fc",
  "93ca00", "b97300", "b40000", "0000ff", "bf26a9", "6b26a6",
  // blockOutRooms colors (room already handled; trigger px -> air)
  "00ac6e", "70d79e", "70d79f", "70d7a1", "7868ff", "ff0080", "ff00ff", "ff0aff",
]);

// --- biome XML extras (RandomColors + MaterialComponents) -------------------
const _biomeExtras = new Map();
export function loadBiomeExtras(dataDir, biomeName) {
  const key = `${dataDir}|${biomeName}`;
  if (_biomeExtras.has(key)) return _biomeExtras.get(key);
  const out = { randomColors: [], mainMaterial: null };
  try {
    const xml = fs.readFileSync(path.join(dataDir, "biome", `${biomeName}.xml`), "utf-8");
    const rc = /<RandomColor\s+input_color="([0-9a-fA-F]{8})"\s+output_colors="([^"]+)"/g;
    let m;
    while ((m = rc.exec(xml))) {
      out.randomColors.push({
        from: m[1].slice(2).toLowerCase(),
        to: m[2].split(",").map((s) => s.trim().slice(2).toLowerCase()),
      });
    }
    // main (non-rare) material = widest [min,max) band
    const comps = [...xml.matchAll(/<MaterialComponent[\s\S]*?<\/MaterialComponent>/g)]
      .map((b) => {
        const g = (k) => { const x = b[0].match(new RegExp(`${k}="([^"]*)"`)); return x ? Number(x[1]) : null; };
        return { name: (b[0].match(/material_name="([^"]*)"/) ?? [])[1], min: g("material_min"), max: g("material_max"), rare: (b[0].match(/is_rare="([^"]*)"/) ?? [])[1] === "1" };
      })
      .filter((c) => c.name && !c.rare && c.min != null && c.max != null);
    comps.sort((a, b) => (b.max - b.min) - (a.max - a.min));
    out.mainMaterial = comps[0]?.name ?? null;
    out.materials = comps;
  } catch {
    // biome xml missing — leave empty
  }
  _biomeExtras.set(key, out);
  return out;
}

// --- deterministic hash + value noise ---------------------------------------
function hash2(x, y, s) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, y, scale, salt) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = smooth(fx - x0), ty = smooth(fy - y0);
  const a = hash2(x0, y0, salt), b = hash2(x0 + 1, y0, salt);
  const c = hash2(x0, y0 + 1, salt), d = hash2(x0 + 1, y0 + 1, salt);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const fbm = (x, y, salt) =>
  0.55 * valueNoise(x, y, 14, salt) + 0.45 * valueNoise(x, y, 8, salt ^ 0x5bd1e995);

export function pick(shadeList, x, y, salt) {
  let total = 0;
  for (const s of shadeList) total += s.w;
  let r = hash2(x, y, salt) * total;
  for (const s of shadeList) {
    if ((r -= s.w) <= 0) return s.rgb;
  }
  return shadeList[0].rgb;
}

// --- coffee / RandomColor flood (per-region single choice) ------------------
function flood(map, w, h, x0, y0, from, to) {
  const stack = [[x0, y0]];
  const seen = new Set([y0 * w + x0]);
  while (stack.length) {
    const [x, y] = stack.pop();
    const p = 3 * (y * w + x);
    map[p] = to[0]; map[p + 1] = to[1]; map[p + 2] = to[2];
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen.has(ni)) continue;
      const q = 3 * ni;
      if (map[q] === from[0] && map[q + 1] === from[1] && map[q + 2] === from[2]) {
        seen.add(ni);
        stack.push([nx, ny]);
      }
    }
  }
}

// per-biome display overrides (hosted-ref stitch calibration, 2026-09-08):
// the_end = "the Work" deep hell — dark red-brown rock, pure black air;
// the_sky = heaven band — pure black air (speckles come from its atlas art).
const HELL_ROCK = [
  { rgb: [37, 21, 17], w: 6 }, { rgb: [55, 34, 29], w: 3 },
  { rgb: [64, 35, 28], w: 2 }, { rgb: [98, 59, 50], w: 1 },
];
const BLACK_AIR = [{ rgb: [0, 0, 0], w: 1 }];
const SHADE_OVERRIDES = {
  the_end: { air: BLACK_AIR, solid: HELL_ROCK },
  the_sky: { air: BLACK_AIR },
};

export function colorizeArea(map, w, h, opts) {
  const { dataDir, biomeName, biomeFile, seed } = opts;
  const materials = loadMaterials(dataDir);
  const extras = loadBiomeExtras(dataDir, biomeFile ?? biomeName);
  // per-biome display overrides (hosted-ref calibrated): the_end renders as
  // dark hell-rock ((37,21,17) family) with pure-black air, the_sky air black.
  const ov = SHADE_OVERRIDES[biomeFile ?? biomeName] ?? null;

  // 1. random-block floods: c0ffee (engine) + biome-XML RandomColors.
  //    Per contiguous region one 50/50 draw -> air-dark or white (-> fill).
  //    (exact game RNG semantics still open — approximate by choice, not stream)
  const rngSalt = seed | 0;
  let regionIdx = 0;
  const scanFloods = (fromHex) => {
    const from = [parseInt(fromHex.slice(0, 2), 16), parseInt(fromHex.slice(2, 4), 16), parseInt(fromHex.slice(4, 6), 16)];
    const seen = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (seen[i]) continue;
      const p = 3 * i;
      if (map[p] !== from[0] || map[p + 1] !== from[1] || map[p + 2] !== from[2]) continue;
      // collect the region first so the 50/50 draw is per-region
      const pixels = [];
      const stack = [[x, y]];
      seen[i] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        pixels.push([cx, cy]);
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (seen[ni]) continue;
          const q = 3 * ni;
          if (map[q] === from[0] && map[q + 1] === from[1] && map[q + 2] === from[2]) {
            seen[ni] = 1;
            stack.push([nx, ny]);
          }
        }
      }
      // BIOME_RANDOM_BLOCK_CHANCE 0.5: one draw per contiguous region
      const toWhite = hash2(x, y, rngSalt + Math.imul(regionIdx++, 0x85ebca6b)) < 0.5;
      const to = toWhite ? [255, 255, 255] : [0, 0, 0]; // white -> grey fill; black -> air
      for (const [cx, cy] of pixels) {
        const p2 = 3 * (cy * w + cx);
        map[p2] = to[0]; map[p2 + 1] = to[1]; map[p2 + 2] = to[2];
      }
    }
  };
  scanFloods("c0ffee");
  for (const rc of extras.randomColors) scanFloods(rc.from);

  // 2. per-pixel classification -> display shades
  const noiseSalt = Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9;
  const shadeFor = (r, g, b, x, y) => {
    if (r === 0 && g === 0 && b === 0) return pick(ov?.air ?? SHADES.airDark, x, y, noiseSalt ^ 1);
    if (r === g && g === b) { // grey ramp placeholder
      if (ov?.solid) return pick(ov.solid, x, y, noiseSalt ^ 3);
      if (g <= 100) return pick(SHADES.airDark, x, y, noiseSalt ^ 2);
      if (g < 250) return pick(SHADES.soil, x, y, noiseSalt ^ 3);
      const n = fbm(x, y, noiseSalt);
      return n < 0.33 ? pick(SHADES.rock, x, y, noiseSalt ^ 4)
           : n < 0.86 ? pick(SHADES.soil, x, y, noiseSalt ^ 5)
           : pick(SHADES.sand, x, y, noiseSalt ^ 6);
    }
    const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
    if (hex === "00ff33") return pick(SHADES.moss, x, y, noiseSalt ^ 7); // engine scene marker
    const mat = materials.get(hex);
    if (mat) {
      const fam = MATERIAL_SHADE.get(mat);
      if (fam) return pick(SHADES[fam], x, y, noiseSalt ^ 8);
      return pick(SHADES.fallbackSolid, x, y, noiseSalt ^ 9);
    }
    if (TRIGGERS.has(hex)) return pick(ov?.air ?? SHADES.airDark, x, y, noiseSalt ^ 10);
    if (ov?.solid) return pick(ov.solid, x, y, noiseSalt ^ 11); // unknown -> biome base
    return null; // unknown — keep raw
  };

  let unknown = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = 3 * (y * w + x);
    const c = shadeFor(map[p], map[p + 1], map[p + 2], x, y);
    if (c) {
      map[p] = c[0]; map[p + 1] = c[1]; map[p + 2] = c[2];
    } else {
      unknown++;
    }
  }
  return { unknown };
}
