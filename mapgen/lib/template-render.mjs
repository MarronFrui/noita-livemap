// Template-biome rendering (non-wang biomes): LoadPixelScene port for PNG
// scenes + per-biome terrain fills. Authority: the game's own data (biome
// XML Topology/Materials, scripts/biomes/*.lua compositions) + capture
// calibration. The banded fills below are approximations on world-seeded
// fBm (stand-in). The plz codec lives in mapgen/lib/plz.mjs (VERIFIED §10);
// the splice-scene paint classification (air/miss skips in
// blitSplicedScenes) is capture-verified (I9). Open (I40): the
// *_visual.png / _visual.plz layers are not applied and blitFixedArt paints
// raw colors (unmeasured vs capture). The template lane reads at the
// DISPLAY frame (the anchor belongs to the generator lanes) and splice grey
// placeholders get the hosting biome's band fill (C145).

import { readPng, rgbToRgbaInt } from "./images.mjs";
import { SHADES, MATERIAL_SHADE, pick, loadMaterials, materialColorAt, materialRenderClass, materialTexSize } from "./colorize.mjs";
import { seededPrng } from "./wang-js.mjs";
import { biomeAt, biomeAtPixel, biomeChunkDef } from "./biomes.mjs"; // ownership gate source; I64: the edge law
import { ensureSurfaceTable } from "./noise-terrain.mjs"; // I63: classify table of the P-empty arm
import { workCellAt } from "./the-work.mjs";
import path from "node:path";
import { LazyChunkStore } from "./chunk-store.mjs"; // lazy per-chunk planes
import { WangLuaHost, loadWangScriptsCsv } from "./wang-scenes.mjs"; // init() runs as the real biome Lua

// the replay clip: [lo, hi) loop bounds of an image placed at `o` (size n)
// against the target chunk's world-px span — full range on eager Maps
const clipRange = (clip, o, n, axis) => {
  if (!clip) return [0, n];
  const lo = axis ? clip.y0 : clip.x0, hi = axis ? clip.y1 : clip.x1;
  // integer loop indices (scene origins from Lua can be fractional): i
  // lands in the chunk iff lo <= o + i < hi  <=>  ceil(lo - o) <= i < ceil(hi - o)
  return [Math.max(0, Math.ceil(lo - o)), Math.min(n, Math.ceil(hi - o))];
};

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

// The splice fill's shade families — the capture's colors at the
// mountain_lake art-grey cells (I39(d)): soil (70,65,40) = the soil family;
// sand_static = the dark sand family (95,87,49), not the light template
// sand_static shade (that belongs to desert-surface art); rock_static = the
// rock family (39,40,45). Other names keep materialShadeFor.
const FILL_SHADES = { sand_static: SHADES.sand, rock_static: SHADES.rock };
const fillShadeFor = (dataDir, name) => FILL_SHADES[name] ?? materialShadeFor(dataDir, name);

// One art px of material `name` at world (x, y), family-first: the
// capture-calibrated family when the material has one, else the game's cell
// colour law (C185 — texture at the world px / Graphics colour / wang_color,
// alpha composited), else the generic fallback. Used by the driver fill
// (fillPx): at the mountain_lake anchor the families stand in for the fill's
// unresolved material assignment (stand-in, C146 / I42).
const familyPx = (dataDir, name, x, y, salt) => {
  const fam = MATERIAL_SHADE.get(name);
  if (fam && SHADES[fam]) return pick(SHADES[fam], x, y, salt);
  if (TEMPLATE_SHADES[name]) return pick(TEMPLATE_SHADES[name], x, y, salt);
  return materialColorAt(dataDir, name, x, y) ?? pick(SHADES.fallbackSolid, x, y, salt);
};
// C195: a solid scene-art material px = C185 (its texture at the world px);
// gases / flowing liquids keep the families (A23).
const materialPx = (dataDir, name, x, y, salt) => {
  if (materialRenderClass(dataDir, name) === "solid") {
    const c = materialColorAt(dataDir, name, x, y);
    if (c) return c;
  }
  return familyPx(dataDir, name, x, y, salt);
};
const fillPx = (dataDir, name, x, y, salt) => (FILL_SHADES[name] ? pick(FILL_SHADES[name], x, y, salt) : familyPx(dataDir, name, x, y, salt));

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
// filled with the materials defined in the biome's <Materials>" rule); the
// band/vein noise semantics are an open read (C32), so this is the shared
// seeded approximation fill (stand-in).
export function blitScene(buffers, dataDir, def, matFile, visFile, wx, wy, biomeName, seed = 0, gate = null) {
  const mat = art(dataDir, matFile);
  if (!mat) return 0;
  if (buffers.recording) {
    buffers.record(wx, wy, wx + mat.width, wy + mat.height,
      (b) => blitScene(b, dataDir, def, matFile, visFile, wx, wy, biomeName, seed, gate));
    return 0;
  }
  const vis = visFile ? art(dataDir, visFile) : null;
  const materials = loadMaterials(dataDir);
  const bands = (def.materialBands ?? []).filter((b) => !b.rare);
  const bandLo = bands.length ? Math.min(...bands.map((b) => b.min)) : 0;
  const bandHi = bands.length ? Math.max(...bands.map((b) => b.max)) : 1;
  let n = 0;
  const [j0, j1] = clipRange(buffers.clip, wy, mat.height, 1), [i0, i1] = clipRange(buffers.clip, wx, mat.width, 0);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const q = 4 * (j * mat.width + i);
      const al = mat.data[q + 3];
      const r = mat.data[q], g = mat.data[q + 1], b = mat.data[q + 2];
      if (al < 128) continue; // transparent: below shows
      if (gate && !gate(wx + i, wy + j)) continue; // the caller's biome check
      const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      let shade = null;
      if (r === 0 && g === 0 && b === 0) continue; // scene air: below shows
      if (r === g && g === b) {
        // grey/white placeholder -> the biome's MaterialComponent fill.
        // The splice lane uses the driver law (classify(surfaceField));
        // this lane runs the seeded-fBm approximation (A5, FLAGGED; I43).
        if (!bands.length) continue;
        const active = bands.filter(
          (b2) => !b2.limitMinY || !b2.limitMaxY || (wy + j >= b2.limitMinY && wy + j <= b2.limitMaxY)
        );
        const use = active.length ? active : bands;
        const v = bandLo + fbm2(wx + i, wy + j, seed | 0) * (bandHi - bandLo);
        const chosen = use.filter((b) => v >= b.min && v < b.max).pop() ?? use[use.length - 1];
        shade = materialPx(dataDir, chosen.name, wx + i, wy + j, 0x51ce3f);
      } else {
        const mname = materials.get(hex);
        if (!mname) { if (TRIGGER_HINT.has(hex)) continue; continue; }
        // C143's 'air' arm: an air-keyed cell (wang 000042) writes air —
        // the backdrop shows, not air's own colour
        if (mname === "air") { n += clearWorldPx(buffers, wx + i, wy + j); continue; }
        shade = materialPx(dataDir, mname, wx + i, wy + j, 0x51ce3f);
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

// I49: the LoadPixelScene background layer lives on a separate bg plane —
// the nested Map under `buffers.get("bg")` — never the fg art buffers
// worldColorAt's fg-template lane consults, so backdrop px cannot preempt
// the noise/terrain lanes. Exported for the I49 write-path pin
// (tests/mapgen/world-gen.test.mjs).
export function blitBackdrop(buffers, dataDir, file, wx, wy, gate = null) {
  const img = art(dataDir, file);
  if (!img) return 0;
  if (buffers.recording) {
    buffers.get("bg").record(wx, wy, wx + img.width, wy + img.height,
      (b) => blitBackdrop(b, dataDir, file, wx, wy, gate));
    return 0;
  }
  let bg = buffers.get("bg");
  if (!bg) { bg = new Map(); buffers.set("bg", bg); }
  let n = 0;
  const [j0, j1] = clipRange(buffers.clip, wy, img.height, 1), [i0, i1] = clipRange(buffers.clip, wx, img.width, 0);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const q = 4 * (j * img.width + i);
      if (img.data[q + 3] < 10) continue;
      if (gate && !gate(wx + i, wy + j)) continue;
      n += setWorldPx(bg, wx + i, wy + j, [img.data[q], img.data[q + 1], img.data[q + 2]]);
    }
  }
  return n;
}

// I62 / C143: an `air` hit writes AIR — a distinct buffer state, not
// "unset" (unset lets the lanes below paint, which would fill air-keyed
// rooms such as friendroom/teleroom with noise rock). Consumer: the
// backdrop arm (world-gen tplAir).
export const TPL_AIR = [9, 9, 10];
function clearWorldPx(buffers, wx, wy) {
  setWorldPx(buffers, wx, wy, TPL_AIR);
  return 0;
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
// Source: data/scripts/biomes/** (256 callsites across biomes/**).

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
  const backdrops = []; // the LoadBackgroundSprite pieces
  let dynamic = 0;
  for (let i = head; i <= endIdx; i++) {
    const raw = lines[i];
    const code = raw.replace(/--.*$/, "").trim();
    if (code.startsWith("--") || code === "") continue;
    const isScene = /^LoadPixelScene\s*\(/.test(code);
    const isBackdrop = /^LoadBackgroundSprite\s*\(/.test(code);
    if (!isScene && !isBackdrop) continue;
    const args = splitArgsLine(code);
    if (isBackdrop) {
      // LoadBackgroundSprite: per-chunk bg art pieces (e.g. the pyramid
      // family's left_background.png); same chunk-local frame.
      const bgp = unquote(args[0]);
      if (!bgp) { dynamic++; continue; }
      const bdx = evalXY(args[1]); const bdy = evalXY(args[2]);
      if (bdx == null || bdy == null) { dynamic++; continue; }
      backdrops.push({ bg: bgp, dx: bdx[0] + bdx[1], dy: bdy[0] + bdy[1] });
      continue;
    }
    if (args.length < 4) { dynamic++; continue; }
    const mat = unquote(args[0]);
    if (!mat) { dynamic++; continue; }
    const vis = args[1] !== '""' ? unquote(args[1]) : null;
    const dxE = evalXY(args[2]); const dyE = evalXY(args[3]);
    if (dxE == null || dyE == null) { dynamic++; continue; }
    const bg = args[4] && args[4] !== '""' ? unquote(args[4]) : null;
    scenes.push({ mat, vis, bg, dx: dxE[0] + dxE[1], dy: dyE[0] + dyE[1] });
    continue;
  }
  return { scenes, backdrops, dynamic };
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

// The per-chunk init(x, y, w, h) runs as the real biome Lua (the wang-scenes
// host: fengari + the byte-exact SetRandomSeed / Random / ProceduralRandom*
// ports), so its branches decide — e.g. snowcastle_cavern's left XOR right
// cavern on `ProceduralRandom(0,0) > 0.5`, solid_wall_hidden_cavern's one
// seeded location of four, snowcave's seeded statue hands.
// parseInitPixelScenes (static parse) only serves as the init-hook probe.
// RaytracePlatforms = the byte-exact tracer (C194, wang-scenes.mjs) with no
// terrain probe: nothing blocks, so it returns the engine's miss output
// (A22 — the init lane runs before the terrain exists).
const initHosts = new Map(); // `${dataDir}|${seed}|${luaScript}` -> WangLuaHost
const initRuns = new Map();  // `${dataDir}|${seed}|${file}|${x},${y}` -> { scenes, backdrops }
export function runInitScenes(dataDir, def, seed, x, y) {
  if (!def.luaScript) return null;
  const k = `${dataDir}|${seed}|${def.filename}|${x},${y}`;
  if (initRuns.has(k)) return initRuns.get(k);
  const hk = `${dataDir}|${seed}|${def.luaScript}`;
  let host = initHosts.get(hk);
  if (!host) {
    host = new WangLuaHost(dataDir, def.luaScript, seed, loadWangScriptsCsv(dataDir));
    initHosts.set(hk, host);
  }
  const n0 = host.scenes.length, b0 = host.backdrops.length;
  host.call("init", x, y, 512, 512);
  const out = {
    scenes: host.scenes.slice(n0).map((sc) => ({ mat: sc.mat, vis: sc.vis || null, bg: sc.bg || null, x: sc.x, y: sc.y })),
    backdrops: host.backdrops.slice(b0).map((bd) => ({ bg: bd.bg, x: bd.x, y: bd.y })),
  };
  initRuns.set(k, out);
  return out;
}

// the temple family's init() is hand-ported in renderTemplateChunk's arms
const TEMPLE_ARMS = /(?:^|\/)temple_(?:wall|altar|altar_left|altar_right)\.xml$/;

function blitInitScenes(buffers, dataDir, def, x, y, seed) {
  if (TEMPLE_ARMS.test(def.filename)) return false;
  const run = runInitScenes(dataDir, def, seed, x, y);
  if (process.env.TEMPLATE_DEBUG) console.log('[blitInitScenes]', def.name, def.filename, 'scenes:', run?.scenes.length ?? 'no-lua', 'backdrops:', run?.backdrops.length ?? 0);
  if (!run || (run.scenes.length === 0 && run.backdrops.length === 0)) return false;
  // the bg pieces first (LoadBackgroundSprite), then the scenes over them
  for (const bd of run.backdrops) blitBackdrop(buffers, dataDir, bd.bg, bd.x, bd.y);
  for (const sc of run.scenes) {
    if (sc.bg) blitBackdrop(buffers, dataDir, sc.bg, sc.x, sc.y);
    blitScene(buffers, dataDir, def, sc.mat, sc.vis, sc.x, sc.y, def.name, seed);
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
// `biome_impl/spliced/_*.bat` + the boss_arena 24-scene grid positions in
// biome_impl/spliced/boss_arena.xml.
export const SPLICE_PNGS = [
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

export function blitSplicedScenes(buffers, dataDir, config, seed = 0) {
  const materials = loadMaterials(dataDir);
  // The scene walk calls the per-cell driver at (originX+col, originY+row)
  // for every art-miss cell (walk site 0x7930d3; driver NULL = no paint →
  // the base lane shows). Frame = the raw chunk frame (origin = chunkY<<9
  // @0x794195; X148/X149). The capture's deep-band soil below the soil gate
  // (424.229) does not come from this lane; its writer is open (I42).
  for (const sc of SPLICE_PNGS) {
    const img = art(dataDir, "data/biome_impl/spliced/" + sc.file);
    if (!img) continue;
    if (buffers.recording) {
      buffers.record(sc.x, sc.y, sc.x + img.width, sc.y + img.height, (b) => blitSpliceImage(b, sc, img));
      continue;
    }
    blitSpliceImage(buffers, sc, img);
  }
  function blitSpliceImage(buffers, sc, img) {
    const [j0, j1] = clipRange(buffers.clip, sc.y, img.height, 1), [i0, i1] = clipRange(buffers.clip, sc.x, img.width, 0);
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const q = 4 * (j * img.width + i);
        if (img.data[q + 3] < 10) continue; // transparent: below shows
        const r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
        if (r === 0 && g === 0 && b === 0) continue; // scene air: below shows
        const gx = sc.x + i, gy = sc.y + j;
        let color;
        if (r === g && g === b) {
          // grey placeholder = the P-empty arm (I63; the Work lane's and
          // the bins' law, C186/C199): field = the grey's luminance,
          // ≤ 0.5 ⇒ keep, else the hosting biome's classify at
          // v = 0x908e70(x, y, field). No config or no classify match:
          // the cell keeps its content — the base lane shows through.
          const def = config ? biomeAt(config, Math.floor(gx / 512) + 35, Math.floor(gy / 512) + 14)?.biome : null;
          if (!def) continue;
          const cell = workCellAt(r, g, b, materials, ensureSurfaceTable(dataDir, def), gx, gy);
          if (!cell.material) continue;
          color = fillPx(dataDir, cell.material, gx, gy, 0x51ce3f);
        } else {
          const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
          const mname = materials.get(hex);
          if (mname === "air" || !mname) {
            // Paint classification (I9, capture-verified over
            // mountain_lake/lake_statue/watercave): cell value = the
            // wang_color->material lookup. 'air' hit -> open scene sky;
            // miss (raw art detail) -> the cell keeps its content — the
            // fill shows through, never the art's own color. Pure black is
            // a miss too (no 000000 key), skipped above; pure grey = the
            // band fill (above).
            continue;
          }
          color = materialPx(dataDir, mname, gx, gy, 0x51ce3f);
        }
        setWorldPx(buffers, gx, gy, color);
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
export function loadPixelSceneTable(dataDir) {
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

// FLAGGED D (I40): fixed-absolute scenes paint non-material art px with the
// art's raw RGB. The splice lane shows fill there, so this is likely wrong
// too, but _pixel_scenes entries are unmeasured against the capture; kept
// until a capture window pins the classification.
export function blitFixedArt(buffers, dataDir, matFile, visFile, sx, sy) {
  const img = art(dataDir, matFile);
  if (!img) return 0;
  if (buffers.recording) {
    buffers.record(sx, sy, sx + img.width, sy + img.height, (b) => blitFixedArt(b, dataDir, matFile, visFile, sx, sy));
    return 0;
  }
  const vis = visFile ? art(dataDir, visFile) : null;
  const materials = loadMaterials(dataDir);
  let n = 0;
  const [j0, j1] = clipRange(buffers.clip, sy, img.height, 1), [i0, i1] = clipRange(buffers.clip, sx, img.width, 0);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const q = 4 * (j * img.width + i);
      if (img.data[q + 3] < 10) continue;
      const r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
      if (r === 0 && g === 0 && b === 0) continue; // scene air: below shows
      const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      const mname = materials.get(hex);
      if (mname === "air") { n += clearWorldPx(buffers, sx + i, sy + j); continue; } // C143's air arm (C196): the cell becomes air
      let color;
      if (mname) {
        color = materialPx(dataDir, mname, sx + i, sy + j, 0x51ce3f);
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
// Lazy by default: the walk only records the paint ops (chunk-store.mjs);
// a chunk materializes on its first read. `eager: true` (or
// MAPGEN_EAGER_TEMPLATES=1) = a whole-world Map (the equivalence reference,
// tests/mapgen/chunk-store.test.mjs).
export function renderTemplateWorld(dataDir, config, seed, { eager = process.env.MAPGEN_EAGER_TEMPLATES === "1" } = {}) {
  const buffers = eager ? new Map() : new LazyChunkStore();
  for (const [colorInt, def] of config.biomes) {
    if (!def.template) continue;
    const file = def.filename.replace(/^data\/biome\//, "");
    for (const area of def.areas) {
      for (let ty = area.y1; ty <= area.y2; ty++) {
        for (let tx = area.x1; tx <= area.x2; tx++) {
          // Ownership gate: areas are bounding boxes of connected biome-map
          // components, and a concave component's rect reaches into other
          // biomes' chunks (e.g. the solid_wall bbox {41,0}..{68,47} covers
          // the east surface). Paint only chunks whose own biome (biomeAt)
          // is this def.
          const at = biomeAt(config, tx, ty);
          if (!at || at.biome !== def) continue;
          const wx = (tx - 35) * 512, wy = (ty - 14) * 512;
          try {
            renderTemplateChunk(buffers, dataDir, file, def, wx, wy, seed, config);
          } catch (e) {
            if (process.env.TEMPLATE_DEBUG) console.error('[template-render]', file, tx, ty, String(e.stack ?? e).split("\n").slice(0, 3).join(" | "));
            // leave chunk black on composition errors
          }
        }
      }
    }
  }
  renderWorldExtension(buffers, dataDir, config, seed);
  blitSplicedScenes(buffers, dataDir, config, seed);
  blitFixedScenes(buffers, dataDir);
  // The per-chunk init() art pass (I32), for every def whose lua_script
  // registers an init() — including wang biomes and mosaics such as the
  // pyramid (pyramid_left/right/entrance/hallway, which carry no
  // templateFile). Blit at each owned chunk origin (X63); the template
  // buffer is checked before the wang bins in worldColorAt, so the art
  // lands over them. The Lua decides per chunk what loads; the temple arms
  // are excluded in blitInitScenes.
  for (const [, def] of config.biomes) {
    const parsed = getPixelScenes(dataDir, def);
    if (!parsed || parsed.noInitHook) continue;
    for (const area of def.areas ?? []) {
      for (let ty = area.y1; ty <= area.y2; ty++) {
        for (let tx = area.x1; tx <= area.x2; tx++) {
          const at = biomeAt(config, tx, ty);
          if (!at || at.biome !== def) continue;
          const wx = (tx - 35) * 512, wy = (ty - 14) * 512;
          blitInitScenes(buffers, dataDir, def, wx, wy, seed);
        }
      }
    }
  }
  return buffers;
}

// -------------------------------------------------- clamped-extension paint ---
// The world continues above/below the 70x48 biome map (clamped sampling):
// 48 sky rows, 48 deep rows, 1 east column. Wang biomes are covered by their
// (extended) area art; the procedural ones are approximated here from the
// hosted-ref stitch (solid_wall bg + edge strips, lava columns; everything
// else void; approximation). Source: ref tiles i1/i60/i10/i0 at j30/j110.

const isWallFile = (f) => /(^|\/)solid_wall\.xml$/.test(f);
const isTowerFile = (f) => /(^|\/)solid_wall_tower\.xml$/.test(f);

const WALL_BG = [{ rgb: [37, 21, 17], w: 9 }, { rgb: [64, 35, 28], w: 1 }];
const STRIP = [
  { rgb: [86, 67, 65], w: 6 }, { rgb: [163, 82, 87], w: 2 }, { rgb: [217, 147, 150], w: 1 },
];
const DEEP_ROCK = [
  { rgb: [37, 21, 17], w: 6 }, { rgb: [55, 34, 29], w: 3 }, { rgb: [64, 35, 28], w: 2 }, { rgb: [98, 59, 50], w: 1 },
];

function renderWorldExtension(buffers, dataDir, config, seed) {
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
        if (ty >= 48) renderLavaFill(buffers, dataDir, wx, wy);
      } else if (isTowerFile(file)) {
        towerEdgeFill(buffers, dataDir, config, wx, wy, seed, ty <= -1 ? WALL_BG : DEEP_ROCK); // I64
      } else if (isWallFile(file)) {
        const base = ty <= -1 ? WALL_BG : DEEP_ROCK;
        if (towerBeside(config, vx, ty)) towerEdgeFill(buffers, dataDir, config, wx, wy, seed, base); // I64: the cursed rock's displaced edge
        else fillChunk(buffers, wx, wy, seed, base);
      } else if (/lake\.xml$/.test(file)) {
        if (ty <= -1 && cx === -31) fillStrip(buffers, wx, wy, seed, true); // lake west wall
      }
      // everything else stays void (matches the reference stitch)
    }
  }
}

// I64: the world-edge cursed rock. solid_wall_tower (map columns 0 and 69)
// holds one material, rock_static_cursed (window [−100, 3.95],
// solid_wall_tower.xml), coloured by C185 (rock_cursed.png at the world px);
// its boundary with the solid_wall columns is the biome-edge law (GetBiomeAt
// 0x909da0 = biomeAtPixel, C187: 30·sin/cos + 11·simplex displacement inside
// 41 px). Per px: tower ⇒ cursed rock; solid_wall ⇒ `base` (the wall's own
// fill); any other biome ⇒ left unset (its lanes).
// The cursed texture is cached over one period (C185 wraps at the texture
// size, 96×96): materialPx per px is too slow for a whole-world render.
const _cursedTile = new Map();
function cursedTile(dataDir) {
  let t = _cursedTile.get(dataDir);
  if (!t) {
    const sz = materialTexSize(dataDir, "rock_static_cursed") ?? { w: 1, h: 1 };
    t = { w: sz.w, h: sz.h, px: new Uint8Array(sz.w * sz.h * 3) };
    for (let y = 0; y < sz.h; y++) for (let x = 0; x < sz.w; x++) t.px.set(materialPx(dataDir, "rock_static_cursed", x, y, 0), 3 * (y * sz.w + x));
    _cursedTile.set(dataDir, t);
  }
  return t;
}
function towerEdgeFill(buffers, dataDir, config, wx, wy, seed, base) {
  if (buffers.recording) { buffers.record(wx, wy, wx + 512, wy + 512, (b) => towerEdgeFill(b, dataDir, config, wx, wy, seed, base)); return; }
  const [cx, cy] = canvasChunk(wx, wy);
  const buf = chunkBuffer(buffers, cx, cy);
  const salt = (Math.imul(wx >> 9, 0x9e3779b1) ^ Math.imul(wy >> 9, 0x85ebca6b) ^ (seed | 0)) | 0;
  const X0 = wx + 35 * 512, Y0 = wy + 14 * 512; // game world px → biome-map px (C145)
  // fast path: biomeAtPixel only differs from the chunk's own def inside the
  // 41-px probe band facing a neighbour chunk of another biome (its probes)
  const tx = X0 >> 9, ty = Y0 >> 9, own = biomeChunkDef(config, tx, ty);
  const tile = cursedTile(dataDir);
  const kind = new Map(); // def → 1 tower / 2 wall / 0 other (no regex per px)
  const kindOf = (d) => { let k = kind.get(d); if (k === undefined) { const f = d?.filename ?? ""; k = isTowerFile(f) ? 1 : isWallFile(f) ? 2 : 0; kind.set(d, k); } return k; };
  const nb = (dx, dy) => biomeChunkDef(config, tx + dx, Math.min(Math.max(ty, 0), config.map.height - 1) + dy) !== own;
  const L = nb(-1, 0) || nb(-1, -1) || nb(-1, 1), R = nb(1, 0) || nb(1, -1) || nb(1, 1);
  const U = nb(0, -1) || nb(-1, -1) || nb(1, -1), Dn = nb(0, 1) || nb(-1, 1) || nb(1, 1);
  for (let j = 0; j < 512; j++) {
    for (let i = 0; i < 512; i++) {
      const probe = (L && i <= 41) || (R && i >= 471) || (U && j <= 41) || (Dn && j >= 471);
      const d = probe ? biomeAtPixel(config, X0 + i, Y0 + j) : own;
      const k = kindOf(d);
      const o = 3 * (j * 512 + i);
      if (k === 1) {
        const q = 3 * ((((wy + j) % tile.h + tile.h) % tile.h) * tile.w + (((wx + i) % tile.w + tile.w) % tile.w));
        buf[o] = tile.px[q]; buf[o + 1] = tile.px[q + 1]; buf[o + 2] = tile.px[q + 2];
      } else if (k === 2) {
        const c = pick(base, wx + i, wy + j, salt);
        buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
      }
    }
  }
}
// a solid_wall chunk whose left/right neighbour column is the tower
const towerBeside = (config, tx, ty) => !!config && [-1, 1].some((dx) => isTowerFile(biomeChunkDef(config, tx + dx, ty)?.filename ?? ""));

function fillChunk(buffers, wx, wy, seed, shades) {
  if (buffers.recording) { buffers.record(wx, wy, wx + 512, wy + 512, (b) => fillChunk(b, wx, wy, seed, shades)); return; }
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
  if (buffers.recording) { buffers.record(wx, wy, wx + 512, wy + 512, (b) => fillStrip(b, wx, wy, seed, leftEdge)); return; }
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

export function renderTemplateChunk(buffers, dataDir, file, def, x, y, seed, config = null) {
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
    // The Work's lava sea: pure lava at every row (see renderLavaFill).
    renderLavaFill(buffers, dataDir, x, y);
  } else if (isWallFile(file)) {
    // solid_wall border/filler columns: dark hell-rock matrix + edge strips
    // (hosted-ref calibrated: (37,21,17)/(55,34,29) family)
    const tx = Math.floor(x / 512) + 35, ty = Math.floor(y / 512) + 14;
    if (towerBeside(config, tx, ty)) towerEdgeFill(buffers, dataDir, config, x, y, seed, DEEP_ROCK); // I64: the cursed rock's displaced edge
    else fillChunk(buffers, x, y, seed, DEEP_ROCK);
  } else if (isTowerFile(file) && config) {
    towerEdgeFill(buffers, dataDir, config, x, y, seed, DEEP_ROCK); // I64: rock_static_cursed (C185) + the edge law
  } else if (isTowerFile(file)) {
    fillChunk(buffers, x, y, seed, STRIP); // no config (direct callers): speckle stand-in
  } else if (blitInitScenes(buffers, dataDir, def, x, y, seed)) {
    // generic per-chunk init() LoadPixelScene lane (mountain/pyramid
    // pieces, floating island, halls, bosses — the game's own art).
  }
}

// The lava biome = ONE MaterialComponent `lava` over [−100, 100], limit_y 0
// (data/biome/lava.xml) ⇒ every cell is lava at EVERY row; its colour = the
// C185 cell colour law (`lava` has no <Graphics> ⇒ wang_color ffff6000 =
// (255,96,0) flat); capture-confirmed on all lava.xml chunks.
// lava_90percent rides the same fill: its rock_hard_border polygon band
// (~2.3% of the chunk, A8) stays unpainted.
function renderLavaFill(buffers, dataDir, x, y) {
  if (buffers.recording) { buffers.record(x, y, x + 512, y + 512, (b) => renderLavaFill(b, dataDir, x, y)); return; }
  const [cx, cy] = canvasChunk(x, y);
  const buf = chunkBuffer(buffers, cx, cy);
  for (let j = 0; j < 512; j++) {
    for (let i = 0; i < 512; i++) {
      const c = materialColorAt(dataDir, "lava", x + i, y + j);
      const o = 3 * (j * 512 + i);
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
    }
  }
}

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

// Seeded value noise (A5 stand-in, used by the grey placeholder fill):
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
