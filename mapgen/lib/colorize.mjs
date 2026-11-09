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
import { readPng } from "./images.mjs";

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

// dig #213 (C185, the cell COLOUR law — cellfactory.cpp): a cell's rendered
// colour = its material's <Graphics texture_file> sampled at the cell's
// WORLD pixel, wrapped by positive modulo: 0x7409B0(celldata; ecx = world
// x, edx = world y) → 0x740580: tex[pmod(x, W), pmod(y, H)] (ARGB from
// RGBA bytes). No texture ([cd+0x88] == 0) ⇒ the packed colour [cd+0x64] =
// the <Graphics color>, which the parser 0x7364f0 back-fills from the
// parsed wang_color ([cd+0x40]) when absent. The jitter arm ([cd+0x6c] =
// randomize_colors) has 0 shipped uses. Alpha < 255 composites over black
// (the capture's flat water (35,61,56) = Graphics A0376259 over black).
// Measured phase: the capture 38_14's rock/earth px match
// tex[pmod(wx,W), pmod(wy,H)] at offset (0,0): 98.3% / 98.8% (entry (213)).
// Scope: own <Graphics> only — no CellDataChild inheritance (none of the
// 46 biome-classify materials needs it; the inheritance law is unread).
let _materialGfx = null; // name -> { tex: rel|null, color: [r,g,b,a] }
const _texCache = new Map(); // rel -> { w, h, px } | null
const argbHex = (h) => {
  const v = h.length === 8 ? h : "ff" + h;
  return [Number.parseInt(v.slice(2, 4), 16), Number.parseInt(v.slice(4, 6), 16), Number.parseInt(v.slice(6, 8), 16), Number.parseInt(v.slice(0, 2), 16)];
};
function loadMaterialGfx(dataDir) {
  if (_materialGfx) return _materialGfx;
  _materialGfx = new Map();
  const xml = fs.readFileSync(path.join(dataDir, "materials.xml"), "utf-8").replace(/<!--[\s\S]*?-->/g, "");
  const blockRe = /<(CellData|CellDataChild|VariableData)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;
  let m;
  while ((m = blockRe.exec(xml))) {
    const attrs = m[2], body = m[4] ?? "";
    const name = (attrs.match(/\bname="([^"]+)"/) ?? [])[1];
    if (!name || _materialGfx.has(name)) continue;
    const wc = (attrs.match(/wang_color="([0-9a-fA-F]{6,8})"/) ?? [])[1];
    const g = (body.match(/<Graphics\b([^>]*?)\/?>/) ?? [])[1] ?? "";
    const tex = (g.match(/texture_file="([^"]*)"/) ?? [])[1] || null;
    const gc = (g.match(/\bcolor="([0-9a-fA-F]{6,8})"/) ?? [])[1];
    const hex = gc ?? wc;
    const at = (k) => (attrs.match(new RegExp(`\\b${k}="([^"]*)"`)) ?? [])[1];
    _materialKind.set(name, { cellType: at("cell_type"), sand: at("liquid_sand"), stat: at("liquid_static"), parent: at("_parent") });
    if (!hex && !tex) continue;
    _materialGfx.set(name, { tex, color: hex ? argbHex(hex) : null });
  }
  return _materialGfx;
}
// the material's render class (materials.xml; a CellDataChild inherits each
// unset attribute from its _parent): "gas", "flow" (a flowing liquid:
// cell_type liquid, neither liquid_sand nor liquid_static) or "solid"
// (powders, static solids and the rest).
const _materialKind = new Map();
export function materialRenderClass(dataDir, name) {
  loadMaterialGfx(dataDir);
  const get = (k) => {
    let n = name;
    for (let d = 0; n && d < 8; d++) {
      const e = _materialKind.get(n);
      if (!e) return undefined;
      if (e[k] !== undefined) return e[k];
      n = e.parent;
    }
    return undefined;
  };
  const ct = get("cellType");
  if (ct === "gas" || ct === "fire") return "gas";
  if (ct === "liquid" && get("sand") !== "1" && get("stat") !== "1") return "flow";
  return "solid";
}
function loadTex(dataDir, rel) {
  if (_texCache.has(rel)) return _texCache.get(rel);
  let t = null;
  try {
    const png = readPng(path.join(dataDir, rel.replace(/^data\//, "")));
    t = { w: png.width, h: png.height, px: png.data };
  } catch { t = null; }
  _texCache.set(rel, t);
  return t;
}
// the C185 texture's period (its w×h), or null when the material has none
export function materialTexSize(dataDir, name) {
  const e = loadMaterialGfx(dataDir).get(name);
  const t = e?.tex ? loadTex(dataDir, e.tex) : null;
  return t ? { w: t.w, h: t.h } : null;
}
export function materialColorAt(dataDir, name, worldX, worldY) {
  const e = loadMaterialGfx(dataDir).get(name);
  if (!e) return null;
  let r, g, b, a;
  const t = e.tex ? loadTex(dataDir, e.tex) : null;
  if (t) {
    const x = ((Math.floor(worldX) % t.w) + t.w) % t.w;
    const y = ((Math.floor(worldY) % t.h) + t.h) % t.h;
    const q = 4 * (y * t.w + x);
    [r, g, b, a] = [t.px[q], t.px[q + 1], t.px[q + 2], t.px[q + 3]];
  } else if (e.color) {
    [r, g, b, a] = e.color;
  } else return null;
  if (a >= 255) return [r, g, b];
  const k = a / 255;
  return [Math.round(r * k), Math.round(g * k), Math.round(b * k)];
}

// dig #130 (the surface-lane compositor): material NAME → its materials.xml
// wang_color RGB (the same element pair extract uses above). One call builds
// the byName map lazily on first use.
let _materialsByName = null;
export function materialColorByName(dataDir, name) {
  if (!_materialsByName) {
    _materialsByName = new Map();
    const xml = fs.readFileSync(path.join(dataDir, "materials.xml"), "utf-8");
    const tagRe = /<(\/?)(CellData|CellDataChild|VariableData)\b([^>]*?)(\/?)>/g;
    let buf = null;
    const add = (blk) => {
      const n = (blk.match(/name="([^"]+)"/) ?? [])[1];
      const wc = (blk.match(/wang_color="([0-9a-fA-F]{6,8})"/) ?? [])[1];
      if (!n || !wc) return;
      const rgb = Number.parseInt(wc.length === 8 ? wc.slice(-6) : wc, 16);
      if (!_materialsByName.has(n)) _materialsByName.set(n, [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255]);
    };
    let m2;
    while ((m2 = tagRe.exec(xml))) {
      const [, closing, tag, attrs, selfClose] = m2;
      if (closing) { if (tag === "CellData" || tag === "VariableData") { if (buf) { add(buf); buf = null; } } continue; }
      if (selfClose) { add(attrs); continue; }
      if (tag === "CellDataChild") { add(attrs); continue; }
      buf = attrs;
    }
  }
  return _materialsByName.get(name) ?? null;
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
  // the clouds biome's cloud cells (capture census 2026-11-08, every capture
  // chunk of the clouds areas 4..14×1..5: (48,48,52) = 21.31% flat, the only
  // cloud-hued colour; (21,21,23) 0.52% = unattributed). The C185 alpha law
  // would give (87,87,95) from wang_color 7fAFAFBF — the gas cells' map
  // colour is NOT the alpha-composited wang_color (the gas render law unread).
  cloud: [S([48, 48, 52], 1)],
  // the_sky's cloud_lighter cells (capture census 2026-11-08, the 15 the_sky
  // chunks 27..41×0: (48,48,63) = 6.95%) — the same 70/255 gas factor as
  // cloud: (175,175,229)·70/255 = (48,48,62.9)
  cloudLighter: [S([48, 48, 63], 1)],
};

// dig #224 (C185 in the bin lane, I51(c)): a SOLID material cell's colour =
// C185 (its texture at the cell's world px) whenever the world origin is
// known. The families below remain (a) as the fallback without an origin and
// (b) for the GAS and FLOWING-LIQUID materials, whose map colour is NOT C185:
// the capture's cloud = (48,48,52) vs C185 (87,87,95); the coalmine wang
// water = (39,67,63)/(42,70,67)/(45,73,71) vs C185's flat (35,61,56) (which
// only the pixel-scene art water shows) — their render laws are unread (A23).
// (a gas / flowing liquid with NO calibrated family keeps C185 — the pre-#224
// law for family-less materials; lava's (255,96,0) is capture-confirmed, I5)
const c185Applies = (dataDir, name) => materialRenderClass(dataDir, name) === "solid" || !MATERIAL_SHADE.has(name);
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
  ["cloud", "cloud"], // ✅ (48,48,52) flat — the clouds capture census
  ["cloud_lighter", "cloudLighter"], // ✅ (48,48,63) flat — the the_sky capture census
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

// data/scripts/wang_scripts.csv — the engine's default spawn colours (rgb hex)
let _wangCsv = null;
function wangScriptsColors(dataDir) {
  if (_wangCsv) return _wangCsv;
  _wangCsv = new Set();
  try {
    const txt = fs.readFileSync(path.join(dataDir, "scripts/wang_scripts.csv"), "utf-8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^[0-9a-fA-F]{2}([0-9a-fA-F]{6}),/);
      if (m) _wangCsv.add(m[1].toLowerCase());
    }
  } catch {
    // no csv — the static TRIGGERS set below still applies
  }
  return _wangCsv;
}

// --- biome XML extras (RandomColors + MaterialComponents) -------------------
const _biomeExtras = new Map();
export function loadBiomeExtras(dataDir, biomeName) {
  const key = `${dataDir}|${biomeName}`;
  if (_biomeExtras.has(key)) return _biomeExtras.get(key);
  const out = { randomColors: [], mainMaterial: null, spawnColors: new Set() };
  try {
    // data/biome/<name>.xml, or a full "data/…" path (the static tiles live in
    // data/biome_impl/static_tile/ — their materials were never read before)
    const rel = biomeName.startsWith("data/") ? `${biomeName.replace(/^data\//, "")}.xml` : path.join("biome", `${biomeName}.xml`);
    const xml = fs.readFileSync(path.join(dataDir, rel), "utf-8");
    // the biome's spawn colours = the engine table (scripts/wang_scripts.csv)
    // + the lua_script's RegisterSpawnFunction(colour, …) lines: an out_map
    // cell of such a colour is a spawn TRIGGER (the function runs there; the
    // cell holds no material ⇒ air) — the wang spawn-scene lane
    // (wang-scenes.mjs) paints whatever art the function loads.
    for (const hex of wangScriptsColors(dataDir)) out.spawnColors.add(hex);
    const lua = (xml.match(/lua_script="([^"]+)"/) ?? [])[1];
    if (lua) {
      try {
        const src = fs.readFileSync(path.join(dataDir, lua.replace(/^data\//, "")), "utf-8");
        for (const line of src.split(/\r?\n/)) {
          const m = line.match(/^\s*RegisterSpawnFunction\s*\(\s*0x[0-9a-fA-F]{2}([0-9a-fA-F]{6})\s*,/);
          if (m && m[1].toLowerCase() !== "ffeedd") out.spawnColors.add(m[1].toLowerCase());
        }
      } catch {
        // script missing — the engine table alone
      }
    }
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
        return {
          name: (b[0].match(/material_name="([^"]*)"/) ?? [])[1], min: g("material_min"), max: g("material_max"),
          rare: (b[0].match(/is_rare="([^"]*)"/) ?? [])[1] === "1",
          // the classify's y gate (surface-level.mjs, @0x8f53f0): limit_y on ⇒ the
          // component applies only on the CLOSED world-y window [limit_min_y, limit_max_y]
          limitY: (b[0].match(/\blimit_y="([^"]*)"/) ?? [])[1] === "1", limitMinY: g("limit_min_y"), limitMaxY: g("limit_max_y"),
        };
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

// Stage 1 of colorizeArea, exported for the Work lane (the-work.mjs needs
// the RAW atlas after the floods, before the display-shade pass).
export function applyRandomFloods(map, w, h, opts) {
  const { dataDir, biomeName, biomeFile, seed } = opts;
  const extras = loadBiomeExtras(dataDir, biomeFile ?? biomeName);
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
}

export function colorizeArea(map, w, h, opts) {
  const { dataDir, biomeName, biomeFile, seed } = opts;
  const materials = loadMaterials(dataDir);
  const extras = loadBiomeExtras(dataDir, biomeFile ?? biomeName);
  // per-biome display overrides (hosted-ref calibrated): the_end renders as
  // dark hell-rock ((37,21,17) family) with pure-black air, the_sky air black.
  const ov = SHADE_OVERRIDES[biomeFile ?? biomeName] ?? null;

  applyRandomFloods(map, w, h, opts);

  // 2. per-pixel classification -> display shades
  const noiseSalt = Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9;
  // Single-material biomes (e.g. lake_deep declares only water): the game
  // fills the atlas's white placeholder art with the biome's material, not a
  // generic soil/sand/rock mix. (I8, mapgen/ISSUES.md)
  const singleMaterial =
    extras.materials?.length === 1 && !extras.materials[0].rare
      ? extras.materials[0].name
      : null;
  // ... and its y-gated generalization (2026-11-08, the sky-band fix): when
  // the area's world origin is known, the placeholder takes the biome's ONE
  // non-rare component whose limit_y gate admits the cell's world y (the
  // classify's own gate) — the clouds' cloud_lighter is gated to
  // [-1024, 424.229], so the cloud rows (world y < -4096) are cloud-only.
  const worldY0 = opts.worldY0, worldX0 = opts.worldX0;
  // C185 (the cell colour law) at the cell's world px — for materials with no
  // capture-calibrated family (the bin lane paints one colour per 10-px cell;
  // the cell's top-left world px samples the texture). Needs the world origin.
  const c185 = (name, xCell, yCell) =>
    worldX0 == null || worldY0 == null ? null : materialColorAt(dataDir, name, worldX0 + 10 * xCell, worldY0 + 10 * yCell);
  // the DISTINCT non-rare materials whose y gate admits the cell (several
  // windows of one material count once: the clouds' cloud ×2)
  const yActive = (yCell) => {
    if (worldY0 == null || !extras.materials?.length) return [];
    const wy = worldY0 + 10 * yCell;
    const names = [];
    for (const c of extras.materials) {
      if (c.limitY && !(wy >= (c.limitMinY ?? -Infinity) && wy <= (c.limitMaxY ?? Infinity))) continue;
      if (!names.includes(c.name)) names.push(c.name);
    }
    return names;
  };
  const shadeFor = (r, g, b, x, y) => {
    if (r === 0 && g === 0 && b === 0) return pick(ov?.air ?? SHADES.airDark, x, y, noiseSalt ^ 1);
    if (r === g && g === b) { // grey ramp placeholder
      if (singleMaterial) {
        const c = c185Applies(dataDir, singleMaterial) ? c185(singleMaterial, x, y) : null;
        if (c) return c;
        if (SHADES[MATERIAL_SHADE.get(singleMaterial) ?? ""]) return pick(SHADES[MATERIAL_SHADE.get(singleMaterial)], x, y, noiseSalt ^ 3);
      }
      const ya = yActive(y);
      if (ya.length === 1) {
        const c = c185Applies(dataDir, ya[0]) ? c185(ya[0], x, y) : null;
        if (c) return c;
        if (SHADES[MATERIAL_SHADE.get(ya[0]) ?? ""]) return pick(SHADES[MATERIAL_SHADE.get(ya[0])], x, y, noiseSalt ^ 3);
      }
      // the classify picks ONE of the active materials (its noise windows are
      // not ported in this lane) — when every candidate renders the SAME C185
      // colour at the cell (the static tiles: templeslab_static and
      // templeslab_crumbling_static share templeslab.png), the pick is moot
      if (ya.length >= 1) {
        const c0 = c185(ya[0], x, y);
        if (c0 && ya.every((n) => { const c = c185(n, x, y); return c && c[0] === c0[0] && c[1] === c0[1] && c[2] === c0[2]; })) return c0;
      }
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
    // dig #226 (C143's 'air' arm in the bin lane): an air-keyed cell (wang
    // 000042) is EMPTY — it takes the bin-air shade, so worldColorAt's bin-air
    // backdrop law shows the biome's background_image there (it was painted
    // air's own colour (0,0,66): the pyramid's dark-blue rooms)
    if (mat === "air") return pick(ov?.air ?? SHADES.airDark, x, y, noiseSalt ^ 1);
    if (mat) {
      const c = c185Applies(dataDir, mat) ? c185(mat, x, y) : null; // the game's own cell colour law
      if (c) return c;
      const fam = MATERIAL_SHADE.get(mat);
      if (fam) return pick(SHADES[fam], x, y, noiseSalt ^ 8);
      return pick(SHADES.fallbackSolid, x, y, noiseSalt ^ 9);
    }
    if (TRIGGERS.has(hex) || extras.spawnColors?.has(hex)) return pick(ov?.air ?? SHADES.airDark, x, y, noiseSalt ^ 10);
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
