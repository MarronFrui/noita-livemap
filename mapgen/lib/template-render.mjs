// Template-biome rendering (non-wang biomes): LoadPixelScene port for PNG
// scenes + per-biome terrain fills. Authority: the game's own data (biome
// XML Topology/Materials, scripts/biomes/*.lua compositions) + capture
// calibration. Deferred (logged ABOUT_MATH 2026-09-09): plz-spliced scenes
// (tree/moon/skull — container format RE), poro noise-terrain port (exact
// shapes for hills/winter/desert/lake/mountains — banded fills below are
// first-order approximations on world-seeded fBm).

import { readPng, rgbToRgbaInt } from "./images.mjs";
import { SHADES, MATERIAL_SHADE, pick, loadMaterials } from "./colorize.mjs";
import { seededPrng } from "./wang-js.mjs";
import { biomeAt } from "./biomes.mjs"; // the OWNERSHIP GATE source (dig 52)
import path from "node:path";

// ---------------------------------------------------------------- caches ---
const artCache = new Map();
function art(dataDir, rel) {
  const key = `${dataDir}|${rel}`;
  if (!artCache.has(key)) {
    try {
      // game paths are "data/..." while dataDir already ends in /data
      artCache.set(key, readPng(path.join(dataDir, rel.replace(/^data\//, ""))));
    } catch {
      artCache.set(key, null);
    }
  }
  return artCache.get(key);
}

const materialShadeFor = (dataDir, name) => {
  const fam = MATERIAL_SHADE.get(name);
  if (fam && SHADES[fam]) return SHADES[fam];
  if (TEMPLATE_SHADES[name]) return TEMPLATE_SHADES[name];
  return SHADES.fallbackSolid;
};

// template-only display shades (capture/stitch-calibrated, seed-independent zones)
export const TEMPLATE_SHADES = {
  templebrick_static: [ { rgb: [79, 73, 50], w: 6 }, { rgb: [81, 76, 52], w: 3 }, { rgb: [76, 71, 48], w: 2 } ],
  lava: [ { rgb: [255, 96, 0], w: 6 }, { rgb: [240, 88, 0], w: 3 }, { rgb: [224, 80, 0], w: 2 } ],
  rock_hard: [ { rgb: [54, 55, 60], w: 6 }, { rgb: [48, 49, 54], w: 3 }, { rgb: [60, 61, 66], w: 2 } ],
  snow_static: [ { rgb: [205, 214, 228], w: 6 }, { rgb: [190, 200, 216], w: 3 }, { rgb: [220, 228, 240], w: 2 } ],
  snowrock_static: [ { rgb: [120, 130, 148], w: 6 }, { rgb: [104, 114, 132], w: 3 }, { rgb: [136, 146, 164], w: 2 } ],
  sand_surface: [ { rgb: [194, 178, 128], w: 6 }, { rgb: [182, 166, 118], w: 3 } ],
  sandstone_surface: [ { rgb: [178, 158, 104], w: 6 }, { rgb: [166, 148, 96], w: 3 } ],
  sand_static_bright: [ { rgb: [222, 205, 160], w: 6 }, { rgb: [208, 192, 150], w: 3 } ],
  sand_static: [ { rgb: [190, 170, 120], w: 6 }, { rgb: [178, 158, 112], w: 3 } ],
  mud: [ { rgb: [64, 52, 40], w: 6 }, { rgb: [56, 46, 36], w: 3 } ],
  soil: [ { rgb: [70, 65, 40], w: 6 }, { rgb: [64, 58, 41], w: 3 } ],
  water: SHADES.water,
};

const TRIGGER_HINT = new Set([
  "00ff00", "78ffff", "55ff8c", "ff0000", "ffff00", "ff0080", "ff0aff",
  "ff00ff", "967896", "967878", "969678", "c35700", "55af4b", "23b9c3",
]);

// --------------------------------------------------------- scene renderer ---
// LoadPixelScene port: material PNG px -> display. visual px (alpha>0) draw
// only over non-air material cells; air/transparent show what's below
// (backdrop / wang terrain / black). White/grey placeholder px get the
// biome's own MaterialComponent band fill (the game's "shades of grey get
// filled with the materials defined in the biome's <Materials>" rule) —
// the exact band/vein noise semantics remain an open read (C32 resolver
// family); here it is the shared seeded-approximation fill.
function blitScene(buffers, dataDir, def, matFile, visFile, wx, wy, biomeName, seed = 0) {
  const mat = art(dataDir, matFile);
  if (!mat) return 0;
  const vis = visFile ? art(dataDir, visFile) : null;
  const materials = loadMaterials(dataDir);
  const bands = (def.materialBands ?? []).filter((b) => !b.rare);
  const bandLo = bands.length ? Math.min(...bands.map((b) => b.min)) : 0;
  const bandHi = bands.length ? Math.max(...bands.map((b) => b.max)) : 1;
  let n = 0;
  for (let j = 0; j < mat.height; j++) {
    for (let i = 0; i < mat.width; i++) {
      const q = 4 * (j * mat.width + i);
      const al = mat.data[q + 3];
      const r = mat.data[q], g = mat.data[q + 1], b = mat.data[q + 2];
      if (al < 128) continue; // transparent: below shows
      const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      let shade = null;
      if (r === 0 && g === 0 && b === 0) continue; // scene air: below shows
      if (r === g && g === b) {
        // grey/white placeholder family -> the biome's MaterialComponent fill
        // (Approximation, flagged: exact band/vein noise = the C32 open read)
        if (!bands.length) continue;
        const active = bands.filter(
          (b2) => !b2.limitMinY || !b2.limitMaxY || (wy + j >= b2.limitMinY && wy + j <= b2.limitMaxY)
        );
        const use = active.length ? active : bands;
        const v = bandLo + fbm2(wx + i, wy + j, seed | 0) * (bandHi - bandLo);
        const chosen = use.filter((b) => v >= b.min && v < b.max).pop() ?? use[use.length - 1];
        shade = pick(materialShadeFor(dataDir, chosen.name), wx + i, wy + j, 0x51ce3f);
      } else {
        const mname = materials.get(hex);
        if (!mname) { if (TRIGGER_HINT.has(hex)) continue; continue; }
        shade = pick(materialShadeFor(dataDir, mname), wx + i, wy + j, 0x51ce3f);
      }
      let color = shade;
      if (vis) {
        const vq = 4 * (j * mat.width + i); // same dims in practice
        if (vis.data[vq + 3] > 10) {
          color = [vis.data[vq], vis.data[vq + 1], vis.data[vq + 2]];
        }
      }
      n += setWorldPx(buffers, wx + i, wy + j, color);
    }
  }
  return n;
}

function blitBackdrop(buffers, dataDir, file, wx, wy) {
  const img = art(dataDir, file);
  if (!img) return 0;
  let n = 0;
  for (let j = 0; j < img.height; j++) {
    for (let i = 0; i < img.width; i++) {
      const q = 4 * (j * img.width + i);
      if (img.data[q + 3] < 10) continue;
      n += setWorldPx(buffers, wx + i, wy + j, [img.data[q], img.data[q + 1], img.data[q + 2]]);
    }
  }
  return n;
}

function setWorldPx(buffers, wx, wy, [r, g, b]) {
  const ccx = Math.floor(wx / 512) + 35, ccy = Math.floor(wy / 512) + 62;
  if (ccx < 0 || ccy < 0 || ccx > 70 || ccy > 143) return 0; // 71x144 canvas
  const key = `${ccx},${ccy}`;
  let buf = buffers.get(key);
  if (!buf) {
    buf = new Uint8Array(512 * 512 * 3).fill(9); // 9 = "unset" sentinel byte
    buffers.set(key, buf);
  }
  const lx = wx - (ccx - 35) * 512, ly = wy - (ccy - 62) * 512;
  const o = 3 * (ly * 512 + lx);
  buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
  return 1;
}

// ------------------------------------------------- per-chunk init() scenes ---
// The generic LoadPixelScene sweep: each template biome's lua carries a
// per-chunk init (RegisterSpawnFunction(0xffffeedd, "init") -> function
// init(x, y, w, h)) whose LoadPixelScene(materials, visual, x+dx, y+dy,
// background, ...) calls place seed-independent art at the CHUNK's world
// origin (x, y = the chunk's top-left world px). We parse only that
// function body; offset expressions limited to linear x/y + int chains
// (dynamic offset expressions = unhandled, counted, never guessed).
// Source: data/scripts/biomes/** (mountain/pyramid quotes byte-read;
// callsite census measured 2026-09-21: 256 across biomes/**).

import fs from "node:fs";

const luaSceneCache = new Map();

function splitArgs(body) {
  const out = [];
  let depth = 0, inStr = false, q = "", cur = "";
  for (const c of body) {
    if (inStr) { cur += c; if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; cur += c; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function splitArgsLine(code) {
  const open = code.indexOf("(");
  let depth = 0, inStr = false, q = "", end = code.length;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (inStr) { if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === "(") depth++;
    if (c === ")") { depth--; if (depth === 0) { end = i; break; } }
  }
  return splitArgs(code.slice(open + 1, end));
}

function unquote(s) {
  const m = s.match(/^"([^"]*)"$/);
  return m ? m[1] : null;
}

// linear offset expression over x/y (int sums) -> [dx, dy]; null otherwise
function evalXY(expr) {
  if (!expr) return null;
  const t = expr.replace(/\s+/g, "");
  if (!/^[xy+\-\d]+$/.test(t)) return null;
  const tokens = t.match(/[xy]|\d+|[+\-]/g);
  if (!tokens) return null;
  let dx = 0, dy = 0, s = 1, num = "", pendingVar = null;
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok === "+" || tok === "-") {
      if (num === "" && pendingVar === null) s = tok === "+" ? 1 : -1;
      else { // previous bare var or number already applied; reset sign
        s = tok === "+" ? 1 : -1;
      }
      continue;
    }
    if (tok === "x" || tok === "y") {
      if (num !== "") return null; // "x512"/"512x" forms not in data
      pendingVar = tok; // a bare variable term contributes +0 (the origin itself)
    } else { // digit(s)
      num += tok;
      const next = tokens[k + 1];
      if (next == null || !/\d/.test(next)) {
        if (pendingVar === "y") dy += s * Number(num); else dx += s * Number(num);
        num = ""; s = 1; pendingVar = null;
      }
    }
  }
  return [dx, dy];
}

export function parseInitPixelScenes(src) {
  const lines = src.split(/\r?\n/);
  const hookIdx = lines.findIndex((l) => /RegisterSpawnFunction\s*\(\s*0xffffeedd\s*,\s*"init"\s*\)/.test(l));
  if (hookIdx < 0) return { scenes: [], dynamic: 0, noInitHook: true };
  let head = -1;
  for (let i = hookIdx; i < lines.length; i++) {
    if (/\bfunction\s+init\s*\(/.test(lines[i])) { head = i; break; }
  }
  if (head < 0) return { scenes: [], dynamic: 1 };
  let depth = 1, endIdx = lines.length - 1;
  for (let i = head + 1; i < lines.length; i++) {
    const l = lines[i].replace(/--.*$/, "").trim();
    if (/\bfunction\b/.test(l)) depth++;
    if (/\bif\b/.test(l) && /\bthen\b/.test(l)) depth++;
    if (/\bfor\b/.test(l) && /\bdo\b/.test(l)) depth++;
    if (/\bwhile\b/.test(l) && /\bdo\b/.test(l)) depth++;
    if (/\bend\b/.test(l)) depth--;
    if (depth <= 0) { endIdx = i; break; }
  }
  const scenes = [];
  let dynamic = 0;
  for (let i = head; i <= endIdx; i++) {
    const raw = lines[i];
    const code = raw.replace(/--.*$/, "").trim();
    if (code.startsWith("--") || code === "") continue;
    if (!/^LoadPixelScene\s*\(/.test(code)) continue;
    const args = splitArgsLine(code);
    if (args.length < 4) { dynamic++; continue; }
    const mat = unquote(args[0]);
    if (!mat) { dynamic++; continue; }
    const vis = args[1] !== '""' ? unquote(args[1]) : null;
    const dxE = evalXY(args[2]); const dyE = evalXY(args[3]);
    if (dxE == null || dyE == null) { dynamic++; continue; }
    const bg = args[4] && args[4] !== '""' ? unquote(args[4]) : null;
    scenes.push({ mat, vis, bg, dx: dxE[0] + dxE[1], dy: dyE[0] + dyE[1] });
  }
  return { scenes, dynamic };
}

function getPixelScenes(dataDir, def) {
  if (luaSceneCache.has(def.filename)) return luaSceneCache.get(def.filename);
  let parsed = null;
  if (def.luaScript) {
    try {
      const p = path.join(dataDir, def.luaScript.replace(/^data\//, ""));
      parsed = parseInitPixelScenes(fs.readFileSync(p, "utf-8"));
    } catch { parsed = { scenes: [], dynamic: 1 }; }
  }
  luaSceneCache.set(def.filename, parsed);
  return parsed;
}

function blitInitScenes(buffers, dataDir, def, x, y, seed) {
  const parsed = getPixelScenes(dataDir, def);
  if (process.env.TEMPLATE_DEBUG) console.log('[blitInitScenes]', def.name, def.filename, 'scenes:', parsed?.scenes.length ?? 'no-parse');
  if (!parsed || parsed.scenes.length === 0) return false;
  for (const sc of parsed.scenes) {
    if (sc.bg) blitBackdrop(buffers, dataDir, sc.bg, x + sc.dx, y + sc.dy);
    blitScene(buffers, dataDir, def, sc.mat, sc.vis, x + sc.dx, y + sc.dy, def.name, seed);
  }
  return true;
}

// ------------------------------------------------------- biome compositions ---
// Spliced pixel scenes (_pixel_scenes.xml): the game SPLICES one big
// pre-colored art PNG into per-chunk N.plz/N_visual.plz/N_background pieces
// via wizard_physics.exe -splice_pixel_scene <png> -x <wx> -y <wy> (the
// origins live in biome_impl/spliced/_*.bat). The splice source PNG IS the
// full visual art at a FIXED seed-independent world position — no seed
// machinery involved. Render = plain blit at (x,y). Sources: each
// `biome_impl/spliced/_*.bat` (verified on disk 2026-09-17) + the
// boss_ arena 24-scene grid positions in biome_impl/spliced/boss_arena.xml.
const SPLICE_PNGS = [
  { file: "boss_arena.png", x: 1536, y: 12288 },
  { file: "tree.png", x: -2048, y: -1324 },
  { file: "moon.png", x: 0, y: -26112 },
  { file: "moon_dark.png", x: 0, y: 37512 },
  { file: "skull.png", x: 14645, y: 18395 },
  { file: "watercave.png", x: -2048, y: 0 },
  { file: "lake_statue.png", x: -14848, y: 0 },
  { file: "lavalake2.png", x: 2048, y: 0 },
  { file: "gourd_room.png", x: -16896, y: -7168 },
  { file: "mountain_lake.png", x: 2560, y: 0 },
  { file: "lavalake_pit_bottom.png", x: 2560, y: 3072 },
];

function blitSplicedScenes(buffers, dataDir) {
  const materials = loadMaterials(dataDir);
  for (const sc of SPLICE_PNGS) {
    const img = art(dataDir, "data/biome_impl/spliced/" + sc.file);
    if (!img) continue;
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        const q = 4 * (j * img.width + i);
        if (img.data[q + 3] < 10) continue; // transparent: below shows
        const r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
        if (r === 0 && g === 0 && b === 0) continue; // scene air: below shows
        const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        const mname = materials.get(hex);
        let color;
        if (mname) {
          color = pick(materialShadeFor(dataDir, mname), sc.x + i, sc.y + j, 0x51ce3f);
        } else {
          color = [r, g, b]; // non-material palette pixel (art detail) — draw raw
        }
        setWorldPx(buffers, sc.x + i, sc.y + j, color);
      }
    }
  }
}

// ------------------------------------------------- _pixel_scenes.xml lane ----
// The game's GLOBAL fixed-absolute scene table (data/biome/_pixel_scenes.xml,
// 95 <PixelScene> entries at exact world px): overworld landmarks — the
// snowy-ruins eye pillar + the evil_eye entity load, the essence altars,
// the fishing hut, the pyramid reward/boss-limbs tables, snowcastle forge,
// the vault/snowcave/hills altar capsules, the_end shops… Same deterministic
// lane as the spliced scenes (I9): pos_x/pos_y are constants in the game's
// own data — seed-independent. Render = the same materials mapping; entries
// with just_load_an_entity only (no art) are registered but not painted.
function loadPixelSceneTable(dataDir) {
  const key = `${dataDir}|_pixel_scenes`;
  if (!artCache.has(key)) {
    let entries = [];
    try {
      const xml = fs.readFileSync(
        path.join(dataDir, "biome/_pixel_scenes.xml"), "utf-8"
      );
      entries = [...xml.matchAll(/<PixelScene\b([^>]*)>/g)].map((m) => {
        const a = m[1];
        const attr = (k) => (a.match(new RegExp(`${k}="([^"]*)"`)) ?? [])[1] ?? "";
        return {
          material: attr("material_filename"),
          visual: attr("colors_filename"),
          background: attr("background_filename"),
          x: Number(attr("pos_x")),
          y: Number(attr("pos_y")),
          entityOnly: !!attr("just_load_an_entity"),
        };
      }).filter((e) => Number.isFinite(e.x) && Number.isFinite(e.y));
    } catch { entries = []; }
    artCache.set(key, entries);
  }
  return artCache.get(key);
}

function blitFixedScenes(buffers, dataDir) {
  let artPainted = 0;
  for (const sc of loadPixelSceneTable(dataDir)) {
    if (sc.entityOnly) continue; // entity-only entries (the evil eye item, etc.)
    if (sc.background) blitBackdrop(buffers, dataDir, sc.background, sc.x, sc.y);
    if (sc.material) {
      artPainted += blitFixedArt(buffers, dataDir, sc.material, sc.visual, sc.x, sc.y);
    }
  }
  return artPainted;
}

// fixed-absolute scenes keep their RAW palette for non-material art px (the
// spliced-scene rule), not the full band fill — they are the scene's own art.
function blitFixedArt(buffers, dataDir, matFile, visFile, sx, sy) {
  const img = art(dataDir, matFile);
  if (!img) return 0;
  const vis = visFile ? art(dataDir, visFile) : null;
  const materials = loadMaterials(dataDir);
  let n = 0;
  for (let j = 0; j < img.height; j++) {
    for (let i = 0; i < img.width; i++) {
      const q = 4 * (j * img.width + i);
      if (img.data[q + 3] < 10) continue;
      const r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
      if (r === 0 && g === 0 && b === 0) continue; // scene air: below shows
      const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      const mname = materials.get(hex);
      let color;
      if (mname) {
        color = pick(materialShadeFor(dataDir, mname), sx + i, sy + j, 0x51ce3f);
      } else {
        color = [r, g, b]; // raw art detail
      }
      if (vis) {
        const vq = 4 * (j * img.width + i);
        if (vis.data[vq + 3] > 10) color = [vis.data[vq], vis.data[vq + 1], vis.data[vq + 2]];
      }
      n += setWorldPx(buffers, sx + i, sy + j, color);
    }
  }
  return n;
}

// Returns Map("cx,cy" -> Uint8Array 512*512*3, 9=unset) for a seed.
// x,y passed to the biome scripts' init() = chunk world origin (top-left).
export function renderTemplateWorld(dataDir, config, seed) {
  const buffers = new Map();
  for (const [colorInt, def] of config.biomes) {
    if (!def.template) continue;
    const file = def.filename.replace(/^data\/biome\//, "");
    for (const area of def.areas) {
      for (let ty = area.y1; ty <= area.y2; ty++) {
        for (let tx = area.x1; tx <= area.x2; tx++) {
          // OWNERSHIP GATE (the cross-biome overpaint fix, dig 52): areas are
          // bounding boxes of connected biome-map components and a concave
          // component's rect reaches far into OTHER biomes' chunks (the
          // solid_wall edge-matrix bbox = {41,0}..{68,47} covers the east
          // surface's hills chunks; its DEEP_ROCK fill painted "solid rock in
          // the sky" over the whole west/east surface + pyramid surroundings —
          // histogram-pinned 6:3:2:1 DEEP_ROCK in foreign chunks). Paint ONLY
          // chunks whose own biome is THIS def; per-biomeApprox-rect chunk
          // ownership stays in the biome map (biomeAt).
          const at = biomeAt(config, tx, ty);
          if (!at || at.biome !== def) continue;
          const wx = (tx - 35) * 512, wy = (ty - 14) * 512;
          try {
            renderTemplateChunk(buffers, dataDir, file, def, wx, wy, seed);
          } catch (e) {
            if (process.env.TEMPLATE_DEBUG) console.error('[template-render]', file, tx, ty, String(e.stack ?? e).split("\n").slice(0, 3).join(" | "));
            // leave chunk black on composition errors
          }
        }
      }
    }
  }
  renderWorldExtension(buffers, config, seed);
  blitSplicedScenes(buffers, dataDir);
  blitFixedScenes(buffers, dataDir);
  return buffers;
}

// -------------------------------------------------- clamped-extension paint ---
// The world continues above/below the 70x48 biome map (clamped sampling):
// 48 sky rows, 48 deep rows, 1 east column. Wang biomes are covered by their
// (extended) area art; the procedural ones are approximated here from the
// hosted-ref stitch (solid_wall bg + edge strips, lava columns; everything
// else void). Source: ref tiles i1/i60/i10/i0 at j30/j110, 2026-09-08.

const isWallFile = (f) => /(^|\/)solid_wall\.xml$/.test(f);
const isTowerFile = (f) => /(^|\/)solid_wall_tower\.xml$/.test(f);

const WALL_BG = [{ rgb: [37, 21, 17], w: 9 }, { rgb: [64, 35, 28], w: 1 }];
const STRIP = [
  { rgb: [86, 67, 65], w: 6 }, { rgb: [163, 82, 87], w: 2 }, { rgb: [217, 147, 150], w: 1 },
];
const DEEP_ROCK = [
  { rgb: [37, 21, 17], w: 6 }, { rgb: [55, 34, 29], w: 3 }, { rgb: [64, 35, 28], w: 2 }, { rgb: [98, 59, 50], w: 1 },
];

function renderWorldExtension(buffers, config, seed) {
  const { vmap, V_OFF_Y, biomes } = config;
  for (let vy = 0; vy < vmap.height; vy++) {
    const ty = vy - V_OFF_Y;
    for (let vx = 0; vx < vmap.width; vx++) {
      if (ty >= 0 && ty <= 47 && vx <= 69) continue; // in-band handled by the area loop
      const i = 4 * (vy * vmap.width + vx);
      const color = rgbToRgbaInt(vmap.data[i], vmap.data[i + 1], vmap.data[i + 2]);
      const def = biomes.get(color);
      if (!def || def.templateFile) continue; // wang area art covers these chunks
      const file = def.filename.replace(/^data\/biome\//, "");
      const cx = vx - 35; // canvas chunk x (-35..35)
      const wx = cx * 512, wy = (ty - 14) * 512;
      if (/lava\.xml$/.test(file)) {
        if (ty >= 48) fillChunk(buffers, wx, wy, seed, LAVA_SHADES.sea);
      } else if (isTowerFile(file)) {
        fillChunk(buffers, wx, wy, seed, STRIP);
      } else if (isWallFile(file)) {
        if (ty <= -1) {
          fillChunk(buffers, wx, wy, seed, WALL_BG);
          if (cx === -34 || cx === 33) fillStrip(buffers, wx, wy, seed, cx === -34);
        } else {
          fillChunk(buffers, wx, wy, seed, DEEP_ROCK);
          if (cx === -34 || cx === 33) fillStrip(buffers, wx, wy, seed, cx === -34);
        }
      } else if (/lake\.xml$/.test(file)) {
        if (ty <= -1 && cx === -31) fillStrip(buffers, wx, wy, seed, true); // lake west wall
      }
      // everything else stays void (matches the reference stitch)
    }
  }
}

function fillChunk(buffers, wx, wy, seed, shades) {
  const [cx, cy] = canvasChunk(wx, wy);
  const buf = chunkBuffer(buffers, cx, cy);
  const salt = (Math.imul(wx >> 9, 0x9e3779b1) ^ Math.imul(wy >> 9, 0x85ebca6b) ^ (seed | 0)) | 0;
  for (let j = 0; j < 512; j++) {
    for (let i = 0; i < 512; i++) {
      const c = pick(shades, wx + i, wy + j, salt);
      const o = 3 * (j * 512 + i);
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
    }
  }
}

function fillStrip(buffers, wx, wy, seed, leftEdge) {
  const [cx, cy] = canvasChunk(wx, wy);
  const buf = chunkBuffer(buffers, cx, cy);
  const salt = (Math.imul(wx >> 9, 0x9e3779b1) ^ Math.imul(wy >> 9, 0x85ebca6b) ^ (seed | 0)) | 0;
  for (let j = 0; j < 512; j++) {
    for (let i = 0; i < 32; i++) {
      const px = leftEdge ? i : 512 - 1 - i;
      const c = pick(STRIP, wx + px, wy + j, salt ^ 0x51ce3f);
      const o = 3 * (j * 512 + px);
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
    }
  }
}

// biomes that render as void/black (sky, void, light-only layers) — matched
// by FILENAME suffix: the xml name attr is NOT reliable (the mountain
// family's name attr is literally "_EMPTY_" and they render real scene art).
const VOID_FILES = /(?:biome_)?(?:barren|darkness|potion_mimics|boss_sky|sky_light_injector)\.xml$/;

export function renderTemplateChunk(buffers, dataDir, file, def, x, y, seed) {
  const T = "data/biome_impl/temple/";
  if (file === "temple_wall.xml") {
    // temple_wall.lua init -> spawn_altar_top(x, y, true)
    const rng = seededPrng(seed, x, y);
    const randomtop = rng.random(1, 50);
    const variant = randomtop === 5 ? "altar_top_water.png"
      : randomtop === 8 ? "altar_top_blood.png"
      : randomtop === 11 ? "altar_top_oil.png"
      : randomtop === 13 ? "altar_top_radioactive.png"
      : randomtop === 15 ? "altar_top_lava.png"
      : "altar_top.png";
    blitBackdrop(buffers, dataDir, T + "wall_background.png", x - 1, y - 30);
    blitScene(buffers, dataDir, def, T + variant, T + "altar_top_visual.png", x, y - 40, "holymountain");
    blitScene(buffers, dataDir, def, T + "solid.png", null, x, y - 40 + 300, "holymountain");
  } else if (file === "temple_altar.xml") {
    // temple_altar.lua: spawn_altar_top(x,y,false) + altar.png scene + bg
    const rng = seededPrng(seed, x, y);
    const randomtop = rng.random(1, 50);
    const variant = randomtop === 5 ? "altar_top_water.png"
      : randomtop === 8 ? "altar_top_blood.png"
      : randomtop === 11 ? "altar_top_oil.png"
      : randomtop === 13 ? "altar_top_radioactive.png"
      : randomtop === 15 ? "altar_top_lava.png"
      : "altar_top.png";
    blitBackdrop(buffers, dataDir, T + "wall_background.png", x - 1, y - 30);
    blitScene(buffers, dataDir, def, T + variant, T + "altar_top_visual.png", x, y - 40, "holymountain");
    blitBackdrop(buffers, dataDir, T + "altar_background.png", x, y - 40 + 300);
    blitScene(buffers, dataDir, def, T + "altar.png", T + "altar_visual.png", x, y - 40 + 300, "holymountain");
    // shop_second_row item art deferred (item loop + seeded picks)
  } else if (file === "temple_altar_left.xml") {
    const rng = seededPrng(seed, x, y);
    const randomtop = rng.random(1, 50);
    const variant = randomtop === 5 ? "altar_top_water.png"
      : randomtop === 8 ? "altar_top_blood.png"
      : randomtop === 11 ? "altar_top_oil.png"
      : randomtop === 13 ? "altar_top_radioactive.png"
      : randomtop === 15 ? "altar_top_lava.png"
      : "altar_top.png";
    blitBackdrop(buffers, dataDir, T + "wall_background.png", x - 1, y - 30);
    blitScene(buffers, dataDir, def, T + variant, T + "altar_top_visual.png", x, y - 40, "holymountain");
    blitBackdrop(buffers, dataDir, T + "altar_left_background.png", x, y - 40 + 300);
    blitScene(buffers, dataDir, def, T + "altar_left.png", T + "altar_left_visual.png", x, y - 40 + 300, "holymountain");
  } else if (file === "temple_altar_right.xml") {
    const rng = seededPrng(seed, x, y);
    const randomtop = rng.random(1, 50);
    const variant = randomtop === 5 ? "altar_top_water.png"
      : randomtop === 8 ? "altar_top_blood.png"
      : randomtop === 11 ? "altar_top_oil.png"
      : randomtop === 13 ? "altar_top_radioactive.png"
      : randomtop === 15 ? "altar_top_lava.png"
      : "altar_top.png";
    blitBackdrop(buffers, dataDir, T + "wall_background.png", x - 1, y - 30);
    blitScene(buffers, dataDir, def, T + variant, T + "altar_top_visual.png", x, y - 40, "holymountain");
    blitBackdrop(buffers, dataDir, T + "altar_right_background.png", x, y - 40 + 300);
    blitScene(buffers, dataDir, def, T + "altar_right.png", T + "altar_right_visual.png", x, y - 40 + 300, "holymountain");
    blitScene(buffers, dataDir, def, T + "altar_right_extra.png", null, x, y - 40 + 300 + 282, "holymountain");
  } else if (file === "sky_light_injector.xml") {
    // light-injection layer; nothing static to draw (below shows)
    return;
  } else if (VOID_FILES.test(file)) {
    return; // void/sky — renders black like the reference stitch
  } else if (def.name === "lava" || file === "lava_90percent.xml") {
    // The Work's lava: orange sea above world y≈14600 (rows ≤42), dark
    // hell-rock matrix below (stitch-calibrated; noise-pocket detail open).
    renderLavaFill(buffers, x, y, seed);
  } else if (isWallFile(file)) {
    // solid_wall border/filler columns: dark hell-rock matrix + edge strips
    // (hosted-ref calibrated: (37,21,17)/(55,34,29) family)
    fillChunk(buffers, x, y, seed, DEEP_ROCK);
    const ccx = Math.floor(x / 512) + 35; // canvas chunk x == biome tx
    if (ccx === 1 || ccx === 68) fillStrip(buffers, x, y, seed, ccx === 1);
  } else if (isTowerFile(file)) {
    // border tower columns: full pink-speckle wall strip
    fillChunk(buffers, x, y, seed, STRIP);
  } else if (blitInitScenes(buffers, dataDir, def, x, y, seed)) {
    // generic per-chunk init() LoadPixelScene lane (mountain/pyramid
    // pieces, floating island, halls, bosses — the game's own art,
    // data-side; dynamic-offset callsites are still skipped, see §12).
  } else if (PROC_FILL) {
    // procedural material-band fill (full-range + banded routes) = the
    // A-flagged approximation family: it paints every non-art pixel a
    // material band (flat rock in air: the west winter / east desert
    // surface bands, the pyramid surroundings, the _EMPTY_-named unique
    // areas). No-guessing mandate: NOT shipping by default — honest air
    // until the caves-field lane (fn B) lands. Verify with PROC_FILL=1.
    renderProceduralFill(buffers, dataDir, file, def, x, y, seed);
  }
}

function renderLavaFill(buffers, x, y, seed) {
  const [cx, cy] = canvasChunk(x, y);
  const buf = chunkBuffer(buffers, cx, cy);
  const chunkSalt = (Math.imul(cx, 0x9e3779b1) ^ Math.imul(cy, 0x85ebca6b) ^ (seed | 0)) | 0;
  const sea = y + 512 <= 14600; // whole chunk in the orange sea band
  for (let j = 0; j < 512; j++) {
    const wy = y + j;
    for (let i = 0; i < 512; i++) {
      let c;
      if (sea) {
        c = pick(LAVA_SHADES.sea, i, j, chunkSalt);
      } else {
        const n = fbm2(x + i, wy, chunkSalt);
        c = n < 0.14 ? pick(LAVA_SHADES.pocket, i, j, chunkSalt)
          : n < 0.26 ? [4, 0, 0]
          : pick(LAVA_SHADES.dark, i, j, chunkSalt);
      }
      const o = 3 * (j * 512 + i);
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
    }
  }
}

const LAVA_SHADES = {
  sea: [{ rgb: [255, 96, 0], w: 6 }, { rgb: [240, 88, 0], w: 3 }, { rgb: [224, 80, 0], w: 2 }],
  pocket: [{ rgb: [255, 96, 0], w: 6 }, { rgb: [240, 88, 0], w: 3 }],
  dark: [{ rgb: [37, 21, 17], w: 6 }, { rgb: [55, 34, 29], w: 3 }, { rgb: [20, 10, 10], w: 2 }, { rgb: [29, 16, 16], w: 2 }],
};

// --- procedural material fills (BIOME_PROCEDURAL banded materials) ---------
// Full-range bands (-100..) render flat; narrow bands sample on world-seeded
// fBm (shape approximation pending the poro noise port). Noise is periodic on
// the 512px chunk lattice so tiled chunks stay seamless.
// OPT-IN since the 2026-09-21 air-overfill fix (dig 52): the fill paints
// every non-art pixel of its biome rect — inside AIR regions too (the
// mountain-tree rectangle, the desert around the pyramid, the west winter /
// east desert surface bands). Honest default = air; the real shape lives in
// the caves-field lane (fn B read). A/B with PROC_FILL=1.
const PROC_FILL = process.env.PROC_FILL === "1";
const fillPatterns = new Map(); // biome file -> shared 512x512x3 pattern (flat fills)

function chunkBuffer(buffers, ccx, ccy) {
  const key = `${ccx},${ccy}`;
  let buf = buffers.get(key);
  if (!buf) {
    buf = new Uint8Array(512 * 512 * 3).fill(9); // 9 = "unset" sentinel byte
    buffers.set(key, buf);
  }
  return buf;
}

// world px -> canvas chunk (canvas = world + (35, 62) chunks)
const canvasChunk = (wx, wy) => [Math.floor(wx / 512) + 35, Math.floor(wy / 512) + 62];

function renderProceduralFill(buffers, dataDir, file, def, x, y, seed) {
  const bands = def.materialBands; // [{name, min, max, rare, limitMinY, limitMaxY}]
  if (!bands || bands.length === 0) return;
  const main = bands.filter((b) => !b.rare);
  if (main.length === 0) return;
  const lo = Math.min(...main.map((b) => b.min));
  const hi = Math.max(...main.map((b) => b.max));
  const fullRange = lo <= -100 && hi >= 100;
  const [cx, cy] = canvasChunk(x, y);
  const buf = chunkBuffer(buffers, cx, cy);
  const chunkSalt = (Math.imul(cx, 0x9e3779b1) ^ Math.imul(cy, 0x85ebca6b) ^ (seed | 0)) | 0;

  if (fullRange) {
    // shared pattern per biome (position-jittered texture, chunk-independent)
    let pat = fillPatterns.get(file);
    if (!pat) {
      pat = new Uint8Array(512 * 512 * 3);
      for (let j = 0; j < 512; j++) {
        const anyLimit = main.some((b) => b.limitMinY != null || b.limitMaxY != null);
        for (let i = 0; i < 512; i++) {
          const c = pick(materialShadeFor(dataDir, main[0].name), i, j, 0x3ad55e1f);
          const o = 3 * (j * 512 + i);
          pat[o] = c[0]; pat[o + 1] = c[1]; pat[o + 2] = c[2];
        }
        void anyLimit;
      }
      fillPatterns.set(file, pat);
    }
    buf.set(pat);
    return;
  }

  // banded fill: per-px noise value -> component by [min,max) + world-y gates
  for (let j = 0; j < 512; j++) {
    const wy = y + j;
    const active = main.filter(
      (b) => (b.limitMinY == null || wy >= b.limitMinY) && (b.limitMaxY == null || wy <= b.limitMaxY)
    );
    if (active.length === 0) continue;
    for (let i = 0; i < 512; i++) {
      const wx = x + i;
      const v = lo + fbm2(wx, wy, chunkSalt) * (hi - lo);
      let chosen = null;
      for (const b of active) {
        if (v >= b.min && v < b.max) chosen = b;
      }
      if (!chosen) continue;
      const c = pick(materialShadeFor(dataDir, chosen.name), i, j, chunkSalt);
      const o = 3 * (j * 512 + i);
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
    }
  }
}

function fbm2(x, y, salt) {
  // periodic value noise on the 512px lattice (two octaves) -> [0,1)
  const h = (a, b, s) => {
    let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(s, 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  const vn = (X, Y, period, s) => {
    const fx = X * (period / 512), fy = Y * (period / 512);
    const x0 = Math.floor(fx) % period, y0 = Math.floor(fy) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const tx = sm(fx - Math.floor(fx)), ty = sm(fy - Math.floor(fy));
    const a = h(x0, y0, s), b = h(x1, y0, s);
    const c = h(x0, y1, s), d = h(x1, y1, s);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return 0.62 * vn(x, y, 16, salt) + 0.38 * vn(x, y, 64, salt ^ 0x5bd1e995);
}
