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
// (backdrop / wang terrain / black).
function blitScene(buffers, dataDir, def, matFile, visFile, wx, wy, biomeName) {
  const mat = art(dataDir, matFile);
  if (!mat) return 0;
  const vis = visFile ? art(dataDir, visFile) : null;
  const materials = loadMaterials(dataDir);
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
      if (hex === "ffffff") continue; // biome-materials fill: TODO (deferred)
      const mname = materials.get(hex);
      if (!mname) { if (TRIGGER_HINT.has(hex)) continue; continue; }
      shade = pick(materialShadeFor(dataDir, mname), wx + i, wy + j, 0x51ce3f);
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

// ------------------------------------------------------- biome compositions ---
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
          const wx = (tx - 35) * 512, wy = (ty - 14) * 512;
          try {
            renderTemplateChunk(buffers, dataDir, file, def, wx, wy, seed);
          } catch (e) {
            // leave chunk black on composition errors
          }
        }
      }
    }
  }
  renderWorldExtension(buffers, config, seed);
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

// biomes that render as void/black (sky, void, light-only layers) — matches
// the reference stitch where these regions show no world content
const VOID_BIOMES = new Set([
  "_EMPTY_", "barren", "darkness", "potion_mimics", "boss_sky",
  "sky_light_injector",
]);

function renderTemplateChunk(buffers, dataDir, file, def, x, y, seed) {
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
  } else if (VOID_BIOMES.has(def.name)) {
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
  } else {
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
