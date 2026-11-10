// World generation for the genmap server: all wang areas for a seed,
// cached to disk. 1 atlas px = 10 world px; canvas = 71x144 chunks
// (36352 x 73728 world px) — the clamped virtual map: 48 sky rows above +
// the 70x48 biome band + 48 deep rows below + 1 east column (biome col 69
// clamped). Canvas (0,0) = biome px (0,-48) = world (-17920,-31744).

import fs from "node:fs";
import path from "node:path";
import { loadBiomeConfig, biomeAt, biomeAtPixel, biomeChunkDef } from "./biomes.mjs";
import { buildTileset } from "./wang-js.mjs";
import { generateAreaExact } from "./generate-exact.mjs";
import { colorizeArea, applyRandomFloods, loadMaterials, SHADES } from "./colorize.mjs";
import { workWrapY, workCellAt } from "./the-work.mjs"; // C186: the Work y-wrap law
import { renderTemplateWorld, blitScene, blitBackdrop, SPLICE_PNGS, loadPixelSceneTable } from "./template-render.mjs";
import { LazyChunkStore } from "./chunk-store.mjs";
import { WangLuaHost, areaSceneCalls, loadWangScriptsCsv, sceneImageSpawnCalls, spawnCallOrigin } from "./wang-scenes.mjs"; // the wang spawn-scene lane
import { readPng } from "./images.mjs";
import { materialColorAt, materialRenderClass } from "./colorize.mjs"; // C185: the cell colour law
import { ensureBiomeBackdrop, ensureSurfaceTable, noisePixelFor } from "./noise-terrain.mjs";

// Bin-air backdrop memo (per def.filename): the wang bands' AIR cells
// composite the area biome's declared bg art.
const binBackdrops = new Map();
// Static tile bg mask (biomes.mjs staticTileBgMask): true ⇒ the area cell
// (ax, ay) shows no backdrop.
const staticMasks = new Map(); // rel -> { w, h, px } | null
function staticBgMasked(def, dataDir, ax, ay) {
  const rel = def?.staticTileBgMask;
  if (!rel) return false;
  let m = staticMasks.get(rel);
  if (m === undefined) {
    try {
      const img = readPng(path.join(dataDir, rel.replace(/^data\//, "")));
      m = { w: img.width, h: img.height, px: img.data };
    } catch { m = null; }
    staticMasks.set(rel, m);
  }
  if (!m) return false;
  if (ax < 0 || ay < 0 || ax >= m.w || ay >= m.h) return true; // spill past the mask = outside the room
  return m.px[4 * (ay * m.w + ax)] < 128;
}
function biomeBackdrop(def, dataDir) {
  if (!def?.filename || !dataDir) return null;
  const key = def.filename;
  if (binBackdrops.has(key)) return binBackdrops.get(key);
  const bd = ensureBiomeBackdrop(dataDir, def);
  binBackdrops.set(key, bd);
  return bd;
}
import { attachNoiseTerrain } from "./noise-terrain.mjs";

export const CHUNK = 512;
export const WORLD_CHUNKS_W = 71;
export const WORLD_CHUNKS_H = 144;
export const SKY_ROWS = 48; // canvas ty = biome ty + SKY_ROWS
export const WORLD_W = WORLD_CHUNKS_W * CHUNK;
export const WORLD_H = WORLD_CHUNKS_H * CHUNK;

export const areaKey = (def, area) => `${def.name}_${area.x1}_${area.y1}`;

// per-term truncating GetWidthFromPix
const widthCells = (a, b) => Math.trunc((b * 512) / 10) - Math.trunc((a * 512) / 10);

export function loadWangWorld(dataDir) {
  const config = loadBiomeConfig(dataDir);
  const areas = [];
  for (const [colorInt, def] of config.biomes) {
    if (!def.templateFile) continue;
    for (const area of def.areas) {
      areas.push({
        key: areaKey(def, area),
        def,
        area,
        w: widthCells(area.x1, area.x2 + 1),
        h: widthCells(area.y1, area.y2 + 1),
        worldX: area.x1 - 35,
        worldY: area.y1 - 14,
      });
    }
  }
  areas.sort((a, b) => a.area.y1 - b.area.y1 || a.area.x1 - b.area.x1 || (a.key < b.key ? -1 : 1));

  // chunk (tx, ty) canvas coords -> area index (-1 = not a wang biome / outside)
  const grid = new Int16Array(WORLD_CHUNKS_W * WORLD_CHUNKS_H).fill(-1);
  const keyToIdx = new Map(areas.map((a, i) => [a.key, i]));
  for (let ty = 0; ty < WORLD_CHUNKS_H; ty++) {
    for (let tx = 0; tx < WORLD_CHUNKS_W; tx++) {
        const at = biomeAt(config, tx, ty - SKY_ROWS);
        if (!at || !at.biome.templateFile) continue;
        const idx = keyToIdx.get(areaKey(at.biome, at.area));
        if (idx !== undefined) grid[ty * WORLD_CHUNKS_W + tx] = idx;
      }
    }
    return { config, areas, grid, errors: new Map() };
}

// L3 anchor (C78): gen↔capture registration fitted on seed 78633191; the
// peak (11,12) ⇒ display (wx,wy) reads GENERATOR-lane content at
// (wx+11, wy+12). Bounds are checked on the display coordinate first;
// content past the canvas edge (right 11 px / bottom 12 px) → null.
// Sampling-only: the gen-cache .bin format is untouched.
// C145: the anchor applies to the generator lanes (area bins, noise) only,
// not the template lane. The template buffer is display-frame (setWorldPx
// keys it by the chunk-aligned game→display map +35/+62 and writes
// game-frame locals), so template reads sample (wx, wy), not (gx, gy).
// M: water-mask cross-correlation of spliced/mountain_lake.png vs capture
// 40_14 peaks at offset (0,0) (99.97% coverage; ±16 sweep —
// mapgen/experiments/2026-10-19-dig170-lake-band-counts.mjs).
export const L3_ANCHOR = { x: 11, y: 12 };
// C192 (I60): the wang bin lane's registration is per area, not the C78
// constant: the game's P read rounds (0x8fae40) and an area's cells start
// at (x1·512)/10 truncating (Init 0x907673), so out_map cell i sits at canvas
// 10·(trunc(x1·51.2) + i) − 5 while the generator draws it at x1·512 + 10·i
// ⇒ the display reads the generator at +5 + 10·frac(x1·51.2) (5..13 px; same
// in y). The wang-scene buffers ride the same generator frame. The noise /
// edge / Work lanes keep C78; the template lane keeps the display frame (C145).
export function binSampleAt(world, wx, wy, tx, ty, gx, gy) {
  const grid = world.grid, areas = world.areas;
  if (!grid || !areas) return { idx: -1, x: gx, y: gy, hit: false };
  let own = null; // the C78 chunk's own area (fallback: its bounds check fails, the lanes below decide)
  for (const [dx, dy] of BIN_CANDIDATES) {
    const cx = tx + dx, cy = ty + dy;
    if (cx < 0 || cy < 0 || cx >= WORLD_CHUNKS_W || cy >= WORLD_CHUNKS_H) continue;
    const idx = grid[cy * WORLD_CHUNKS_W + cx];
    if (idx < 0) continue;
    const a = areas[idx];
    if (!a?.area) continue;
    const an = binAnchor(a);
    const x = wx + an.x, y = wy + an.y;
    if (dx === 0 && dy === 0) own = { idx, x, y };
    const lx = x - a.area.x1 * CHUNK, ly = y - (a.area.y1 + SKY_ROWS) * CHUNK;
    if (lx < 0 || ly < 0 || lx >= a.w * 10 || ly >= a.h * 10) continue;
    const sx = Math.floor(x / CHUNK), sy = Math.floor(y / CHUNK);
    if (sx >= 0 && sy >= 0 && sx < WORLD_CHUNKS_W && sy < WORLD_CHUNKS_H && grid[sy * WORLD_CHUNKS_W + sx] === idx) return { idx, x, y, hit: true };
  }
  return own ? { ...own, hit: false } : { idx: -1, x: gx, y: gy, hit: false };
}
// FLAGGED D (A25, the bin edge strip): an area spanning n chunks = n·512 px
// has only trunc(n·51.2) cells (C192), so up to 9 px at its far x / y edge
// read past its last cell. When no neighbour area covers them (a bin miss),
// the game reads the next P cell (outside the area; its content is unread);
// the stand-in = the area's own last cell (E1 solid agreement 0.765 over
// 51,981 capture px).
function binLocal(a, m, bx, by, hit) {
  let lx = bx - a.area.x1 * CHUNK, ly = by - (a.area.y1 + SKY_ROWS) * CHUNK;
  if (!hit) {
    if (lx >= m.w * 10 && lx < m.w * 10 + 10) lx = m.w * 10 - 1;
    if (ly >= m.h * 10 && ly < m.h * 10 + 10) ly = m.h * 10 - 1;
  }
  return { lx, ly };
}
const BIN_CANDIDATES = [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1], [1, 1], [1, -1], [-1, 1]];
// A grey placeholder cell = the game's P-empty arm (same law as the Work
// lane, C186): field = the grey's luminance; field ≤ 0.5 ⇒ AIR; else the
// cell's own biome classify at v = 0x908e70(x, y, field), per pixel (game
// world px), coloured by C185.
export const AIR_CELL = Object.freeze({ air: true });
// I62 (C196): template buffer px states — (9,9,9) unset (lanes below
// paint), (9,9,10) = TPL_AIR (a scene wrote AIR: lanes below are blocked,
// the backdrop shows), else the art colour.
const tplUnset = (b, o) => b[o] === 9 && b[o + 1] === 9 && b[o + 2] === 9;
const tplAir = (b, o) => b[o] === 9 && b[o + 1] === 9 && b[o + 2] === 10;
function placeholderPx(world, a, ax, ay, wx, wy, rr, gg, bb) {
  if (!a.def?.filename || !world.dataDir) return null;
  const table = ensureSurfaceTable(world.dataDir, a.def);
  world.workMaterials ??= loadMaterials(world.dataDir);
  const x = wx - DISPLAY_X0, y = wy - DISPLAY_Y0;
  const cell = workCellAt(rr, gg, bb, world.workMaterials, table, x, y);
  if (cell.air) return table ? AIR_CELL : null; // no table ⇒ the colorized cell (unknown biome)
  return materialColorAt(world.dataDir, cell.material, x, y);
}
// the raw out_map cell's explicit solid material → C185 at the display px
const _solidHex = new Map();
function solidCellPx(world, a, ax, ay, wx, wy) {
  const raw = world.rawMaps?.get(a.key);
  if (!raw || !world.dataDir || ax >= raw.w || ay >= raw.h) return null;
  const p = 3 * (ay * raw.w + ax);
  const rr = raw.rgb[p], gg = raw.rgb[p + 1], bb = raw.rgb[p + 2];
  if (rr === 0 && gg === 0 && bb === 0) return null; // black = air
  if (rr === gg && gg === bb) return placeholderPx(world, a, ax, ay, wx, wy, rr, gg, bb); // the grey placeholder ramp
  const hex = (rr << 16) | (gg << 8) | bb;
  let name = _solidHex.get(hex);
  if (name === undefined) {
    const m = loadMaterials(world.dataDir).get(hex.toString(16).padStart(6, "0"));
    name = m && m !== "air" && materialRenderClass(world.dataDir, m) === "solid" ? m : null;
    _solidHex.set(hex, name);
  }
  return name ? materialColorAt(world.dataDir, name, wx - DISPLAY_X0, wy - DISPLAY_Y0) : null;
}
export const binAnchor = (a) => ({ x: 5 + ((a.area.x1 * 512) % 10), y: 5 + ((a.area.y1 * 512) % 10) });
// Display frame world origin (C145): world px = display px − (35·512, 62·512);
// the cell colour law (C185) samples the material texture at the world pixel.
export const DISPLAY_X0 = 35 * CHUNK, DISPLAY_Y0 = (SKY_ROWS + 14) * CHUNK;

export function worldColorAt(world, wx, wy) {
  if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) return null;
  let gx = wx + L3_ANCHOR.x, gy = wy + L3_ANCHOR.y;
  if (gx >= WORLD_W || gy >= WORLD_H) return null;
  let tx = Math.floor(gx / CHUNK), ty = Math.floor(gy / CHUNK);
  // Bin-lane sample point (C192): the wang area whose map holds the display
  // px under its anchor (the true area boundary sits up to ±6 px from the C78
  // chunk boundary, so neighbours are candidates too).
  const { idx: binIdx, x: bx, y: by, hit: binHit } = binSampleAt(world, wx, wy, tx, ty, gx, gy);
  // The px's chunk = the chunk its per-area sample falls in. When that is not
  // the C78 chunk, the px lies in the ≤ 6 px strip between the boundaries:
  // the other lanes (C78 frame) read in that chunk, clamped to its edge.
  if (binIdx >= 0) {
    const sx = Math.floor(bx / CHUNK), sy = Math.floor(by / CHUNK);
    if (sx < tx) gx = tx * CHUNK - 1; else if (sx > tx) gx = (tx + 1) * CHUNK;
    if (sy < ty) gy = ty * CHUNK - 1; else if (sy > ty) gy = (ty + 1) * CHUNK;
    if (gx < 0 || gy < 0 || gx >= WORLD_W || gy >= WORLD_H) return null;
    tx = Math.floor(gx / CHUNK); ty = Math.floor(gy / CHUNK);
  }
  // C186 (Work y-wrap): rows above/below the 48-row biome map whose
  // vmap-clamped chunk biome is a wang biome (the_sky / the_end on cols
  // 27..41) re-read the main band's wang content at y mod 24570 px,
  // re-classified by the chunk biome (the-work.mjs).
  if (ty < SKY_ROWS || ty >= SKY_ROWS + 48) {
    const w = workColorAt(world, tx, ty, gx, gy, wx, wy);
    if (w !== undefined) return w;
  }
  // Wang spawn-scene lane (wang-scenes.mjs): LoadPixelScene writes over the
  // wang fill (blocked-out rooms are black until their art loads), so it is
  // first among the band lanes.
  const scene = wangSceneAt(world, bx, by);
  if (scene) return scene;
  // I53, C187: within 41 px of a chunk edge the pixel's biome (GetBiomeAt
  // 0x909da0) may be the neighbour's; when that is a noise biome, the field
  // driver 0x908f40 runs its kind-0 arm here.
  if (ty >= 62 && ty < SKY_ROWS + 48) {
    const e = edgePixelAt(world, gx, gy, wx, wy);
    if (e !== undefined) return e;
  }
  // I32: the sky band = chunk rows 0..61 (vmap sky clamp + biome map rows
  // 0..13, the_sky/hills sky region). One backdrop (black air + stars at
  // every altitude) with the template lane's art pieces over it (mountain/
  // hills pixel scenes, the moon, spliced scenes). The hills def's cave-bg
  // belongs to underground pockets, not the sky.
  if (ty < 62) {
    // Wang biomes inside the sky-band rows are terrain, not sky (biome map
    // rows 12..13 carry the pyramid mosaic + boss room). Order:
    // 1) the wang bin fill (airDark cells composite the area def's bg);
    // 2) the template art over it; 3) void defs (the_sky/barren/darkness
    // family) and bin-less chunks = the sky backdrop.
    let binPx = null, voidChunk = false;
    {
      const idxB = binIdx;
      if (idxB >= 0) {
        const a = world.areas[idxB];
        const m = world.maps.get(a.key);
        if (m) {
          const { lx, ly } = binLocal(a, m, bx, by, binHit);
          if (lx >= 0 && ly >= 0 && lx < m.w * 10 && ly < m.h * 10) {
            const ax = Math.floor(lx / 10), ay = Math.floor(ly / 10);
            const p = 3 * (ay * m.w + ax);
            const r = m.rgb[p], g = m.rgb[p + 1], b = m.rgb[p + 2];
            const airDark =
              (r === 13 && g === 14 && b === 18) || (r === 12 && g === 13 && b === 17) ||
              (r === 16 && g === 16 && b === 18) || (r === 21 && g === 23 && b === 30);
            voidChunk = /(?:^|\/)(the_sky|barren|darkness|potion_mimics|boss_sky|sky_light_injector)\.xml$/.test(a.def?.filename ?? "");
            if (voidChunk) {
              // a void-sky bin's own (black) pixels never paint; the sky
              // backdrop handles the whole chunk
            } else if (!airDark) {
              return [r, g, b]; // wang terrain
            } else {
              // bin air = a loaded scene's background_file when one covers
              // the cell, else the area def's declared bg (C111)
              const sbg = wangSceneBgAt(world, bx, by);
              if (sbg) return sbg;
              // C184 (backdrop clip, 0x72c180): a limit-on biome's
              // background_image draws only at world y >= its height
              // (default 225); above it the air is the sky.
              const clipped = (a.def.limitBackgroundImage !== false && wy - 62 * CHUNK < (a.def.backgroundImageHeight ?? 225))
                || staticBgMasked(a.def, world.dataDir, ax, ay); // static tile mask px = no backdrop
              const bd = clipped ? null : biomeBackdrop(a.def, world.dataDir);
              if (bd) {
                const bx = ((wx % bd.w) + bd.w) % bd.w, by = ((wy % bd.h) + bd.h) % bd.h; // backdrop phase = the display px (capture: phase (0,0))
                const q = 4 * (by * bd.w + bx);
                binPx = [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]];
              }
            }
          }
        }
      }
    }
    // C145: template lane = display frame; the bin lane above and skyAt
    // below keep the generator frame.
    const ttx = Math.floor(wx / CHUNK), tty = Math.floor(wy / CHUNK);
    const tbuf = world.templates?.get(`${ttx},${tty}`);
    let skyAir = false; // I62: a scene's written AIR blocks the noise terrain
    if (tbuf) {
      const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
      skyAir = tplAir(tbuf, o);
      if (!skyAir && !tplUnset(tbuf, o)) return [tbuf[o], tbuf[o + 1], tbuf[o + 2]];
    }
    if (!voidChunk && binPx) return binPx;
    // C165 (X205): noise-biome terrain serves the sky-band rows too (the
    // capture's hills carry solid inside bty13). Solid cells = caves-mask
    // terrain; mask-air cells and null lanes fall through to the sky.
    // Precedence after the template/bin art, as in the ty ≥ 62 arm.
    {
      const nzSky = skyAir ? null : world.noiseSolidAt?.(gx, gy);
      if (nzSky != null) {
      // bty 6..13 (display rows 54..61) = the winter/mountain noise band;
      // its solid cells run the same classify-or-air law as the ty >= 62
      // arm: paint iff the classify matches, a miss = air → sky art below.
      if (nzSky) {
        const matSky = world.noiseMatAt?.(gx, gy);
        if (matSky && matSky.idx !== 255 && matSky.names && matSky.names[matSky.idx] && world.dataDir) {
          return noiseColor(world, tx, ty, nzSky, materialColorAt(world.dataDir, matSky.names[matSky.idx], wx - DISPLAY_X0, wy - DISPLAY_Y0));
        }
        // classify miss (idx 255 / unresolvable) = AIR: fall through
      }
    }
    }
    // image-spawned scenes (the tree's pillars): fg art, then their
    // background_file art over the sky (display frame, like the templates)
    {
      const fg = sceneBufAt(world.imageSpawns, wx, wy);
      if (fg) return fg;
      const bgp = sceneBufAt(world.imageSpawns?.get("bg"), wx, wy);
      if (bgp) return bgp;
    }
    // the template lane's background plane (init() LoadBackgroundSprite /
    // background_file art) over the sky too: an explicit backdrop sprite is
    // art, not the biome's clipped background_image (C184)
    {
      const tbg = world.templates?.get("bg")?.get(`${ttx},${tty}`);
      if (tbg) {
        const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
        if (!tplUnset(tbg, o) && !tplAir(tbg, o)) return [tbg[o], tbg[o + 1], tbg[o + 2]];
      }
    }
    return world.skyAt?.(tx, ty, gx, gy) ?? null;
  }
  const idx = binIdx;
  if (idx >= 0) {
    const a = world.areas[idx];
    const m = world.maps.get(a.key);
    if (m) {
      const { lx, ly } = binLocal(a, m, bx, by, binHit);
      // area maps are in atlas px: 1 atlas px = 10 world px
      if (lx >= 0 && ly >= 0 && lx < m.w * 10 && ly < m.h * 10) {
        const ax = Math.floor(lx / 10), ay = Math.floor(ly / 10);
        const p = 3 * (ay * m.w + ax);
        // Bin-air backdrop (C109/C110 applied to the bin lane): the wang
        // bands' AIR cells (colorize airDark family) show the area biome's
        // Topology background_image (each def declares its bg).
        const r = m.rgb[p], g = m.rgb[p + 1], b = m.rgb[p + 2];
        const airDark = (r === 13 && g === 14 && b === 18) || (r === 12 && g === 13 && b === 17)
          || (r === 16 && g === 16 && b === 18) || (r === 21 && g === 23 && b === 30);
        // per-pixel cell law (explicit solids = C185; grey placeholders =
        // the P-empty classify, which may also yield AIR)
        const pxc = airDark ? null : solidCellPx(world, a, ax, ay, wx, wy);
        if (airDark || pxc === AIR_CELL) {
          const sbg = wangSceneBgAt(world, bx, by); // a loaded scene's background_file
          if (sbg) return sbg;
          const bd = staticBgMasked(a.def, world.dataDir, ax, ay) ? null : biomeBackdrop(a.def, world.dataDir); // static tile mask
          if (bd) {
            const bx = ((wx % bd.w) + bd.w) % bd.w, by = ((wy % bd.h) + bd.h) % bd.h; // backdrop phase = the display px
            const q = 4 * (by * bd.w + bx);
            return [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]];
          }
          return airDark ? [r, g, b] : SHADES.airDark[0].rgb;
        }
        if (pxc) return pxc;
        return [r, g, b];
      }
    }
  }
  // template-biome overlay (temple scenes, procedural fills); display frame (C145)
  const ttx = Math.floor(wx / CHUNK), tty = Math.floor(wy / CHUNK);
  const buf = world.templates?.get(`${ttx},${tty}`);
  let sceneAir = false; // I62: a scene wrote AIR here — the terrain lanes are blocked
  // I62: scenes spawned from scene images (buildImageSpawns: the watercave's
  // random_layout trigger 0xffb539 inside spliced watercave.png, the tree's
  // pillars) load after their host image, so they paint over it.
  const isb = world.imageSpawns?.get(`${ttx},${tty}`);
  if (isb) {
    const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
    if (tplAir(isb, o)) sceneAir = true;
    else if (!tplUnset(isb, o)) return [isb[o], isb[o + 1], isb[o + 2]];
  }
  if (buf && !sceneAir) {
    const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
    sceneAir = tplAir(buf, o);
    if (!sceneAir && !tplUnset(buf, o)) {
      return [buf[o], buf[o + 1], buf[o + 2]];
    }
  }
  // Noise terrain: procedural biomes get the binary evaluator chain per wang
  // cell (the >0.5 gate value decides solidity; material naming is
  // config-side).
  // I62: scene AIR = the scene's own background_file px first, else a noise
  // AIR cell (the air arm: C184, the backdrop)
  if (sceneAir) {
    for (const sb of [world.imageSpawns?.get("bg")?.get(`${ttx},${tty}`), world.templates?.get("bg")?.get(`${ttx},${tty}`)]) {
      if (!sb) continue;
      const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
      if (!tplUnset(sb, o) && !tplAir(sb, o)) return [sb[o], sb[o + 1], sb[o + 2]];
    }
  }
  const nz = sceneAir || roomChunkAir(world, tx, ty) ? 0 : world.noiseSolidAt?.(gx, gy);
  if (nz != null) {
    // ground = the biome <Materials> classify per cell (C76 frame) → the
    // material's colour; unclassified solids keep the band shade.
    const mat = world.noiseMatAt?.(gx, gy);
    let rgb = null;
    if (mat && mat.idx !== 255 && mat.names && mat.names[mat.idx] && world.dataDir) {
      rgb = materialColorAt(world.dataDir, mat.names[mat.idx], wx - DISPLAY_X0, wy - DISPLAY_Y0);
    }
    if (nz) return noiseColor(world, tx, ty, nz, rgb);
    // C184 (backdrop clip): the per-chunk backdrop builder 0x72c180 starts
    // the biome backdrop at max(chunk top, height) when the biome's limit
    // is on (defaults: height 225.0f, limit 1), so a row-62 air cell shows
    // the sky above the height and the backdrop below; a limit-off biome
    // shows the backdrop at every height. The limit_y edge sprite occupies
    // [height − edge.h, height), composited over the sky. World y = display
    // y − (SKY_ROWS+14)·512 (C145); the chunk's def comes from the
    // generator tx/ty (approximation in the ≤12 px anchor strip).
    if (ty === 62) {
      const bd = world.noiseAt?.(tx, ty)?.backdrop ?? null;
      const yW = wy - DISPLAY_Y0;
      const limit = bd?.limit ?? true, h = bd?.height ?? 225;
      if (limit && yW < h) {
        const sky = world.skyAt?.(tx, ty, gx, gy) ?? null;
        const e = bd?.edge;
        if (e && yW >= h - e.h) {
          const ex = (((wx % CHUNK) + CHUNK) % CHUNK) - ((CHUNK - e.w) >> 1);
          const ey = Math.floor(yW - (h - e.h));
          if (ex >= 0 && ex < e.w && ey >= 0 && ey < e.h) {
            const q = 4 * (ey * e.w + ex);
            const a = e.pixels[q + 3] / 255;
            if (a > 0) {
              const s = sky ?? [0, 0, 0];
              return [0, 1, 2].map((k) => Math.round(e.pixels[q + k] * a + s[k] * (1 - a)));
            }
          }
        }
        return sky;
      }
    }
    // I32: an AIR cell in a procedural chunk composites the chunk biome's
    // Topology `background_image`; a def with no bg art fills its
    // `biome_color`. Approximation: the backdrop tiles in the chunk frame;
    // the game's per-area parallax is not modelled.
    // I62: a loaded scene's background_file is drawn over the biome
    // backdrop in its air cells.
    for (const sb of [world.imageSpawns?.get("bg")?.get(`${ttx},${tty}`), world.templates?.get("bg")?.get(`${ttx},${tty}`)]) {
      if (!sb) continue;
      const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
      if (!tplUnset(sb, o) && !tplAir(sb, o)) return [sb[o], sb[o + 1], sb[o + 2]];
    }
    const bgr = world.bgImageAt?.(tx, ty, wx, wy); // sampled at the display px (the backdrop's phase)
    if (bgr) return bgr;
  }
  // I49: pixel-scene background art (LoadPixelScene background layer,
  // blitBackdrop's bg plane) = the air-only last fallback, consulted only
  // when no bin, fg-template, noise or bgImage lane owns the cell; never
  // preempts a material lane.
  const bgBuf = world.templates?.get("bg")?.get(`${ttx},${tty}`);
  if (bgBuf) {
    const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
    if (!tplUnset(bgBuf, o) && !tplAir(bgBuf, o)) {
      return [bgBuf[o], bgBuf[o + 1], bgBuf[o + 2]];
    }
  }
  return null;
}

// FLAGGED D (A24, I62; approximation): a template-less BIOME_WANG_TILE chunk
// — the per-biome rooms (dragoncave, secret_lab, mystery_teleport, the orb
// rooms, …) — generates no terrain of its own: its init()/spliced scene is
// the room, and the scene's black (C143) shows AIR, not the noise lane's
// rock. Known loss: the lavalake chunks (I63). The engine mechanism for an
// empty-template wang biome is unread.
function roomChunkAir(world, tx, ty) {
  if (!world.config?.map) return false; // injected worlds: no biome map
  const d = biomeChunkDef(world.config, tx, ty - SKY_ROWS);
  return !!d && !d.templateFile && d.topologyType === "BIOME_WANG_TILE";
}
// Noise-terrain display colour: solid cells get their classified material's
// colour when available, else one baseline shade per band; air cells return
// null so the background rules apply.
function noiseColor(world, tx, ty, solid, materialRgb = null) {
  if (!solid) return null;
  void tx; void ty; void world;
  if (materialRgb) return materialRgb;
  const dark = ty - SKY_ROWS > 26 || ty - SKY_ROWS < -6;
  const hex = dark ? 0x1b1b1b : 0x6a5a44; // deep rock band vs provisional surface
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

// cache writes land whole or not at all (tmp + rename): the gen server's tile
// workers build the same seed concurrently and must never read a torn .bin
function writeFileAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
function readCache(cacheFile) {
  try {
    const buf = fs.readFileSync(cacheFile);
    const w = buf.readUInt32LE(0), h = buf.readUInt32LE(4), attempt = buf.readUInt32LE(8);
    return { w, h, attempt, rgb: buf.subarray(12) };
  } catch {
    return null;
  }
}

// --- static-tile lane (biome XML `static_tile="1"`) -------------------------
// barrens/darkness/boss_sky/potion_mimics/watchtower carry per-biome fixed
// artworks (wang_map_width/height = the fg PNG dims) instead of a herringbone
// wang atlas; the corner-type fill throws on them. Render = artwork anchored
// top-left in the area (later: anchored per its own alignment rule), every
// pixel 1 austere atlas px = 10 world px, then the shared display-color pass.
function buildStaticTileArea(a, dataDir) {
  const tf = a.def.templateFile.replace(/^data\//, "");
  const png = readPng(path.join(dataDir, tf)); // throws → area error, visible in the log
  const rgb = Buffer.alloc(3 * a.w * a.h, 0); // uncovered = black = air (colorize)
  for (let y = 0; y < Math.min(a.h, png.height); y++) {
    for (let x = 0; x < Math.min(a.w, png.width); x++) {
      const q = 4 * (y * png.width + x);
      const p = 3 * (y * a.w + x);
      rgb[p] = png.data[q];
      rgb[p + 1] = png.data[q + 1];
      rgb[p + 2] = png.data[q + 2];
    }
  }
  return { w: a.w, h: a.h, attempt: 0, rgb };
}

// --- the Work lane (C186; bytes in the-work.mjs) --------------------------
const WORK_BAND_TOP = SKY_ROWS * CHUNK; // canvas px of biome-map row 0 = P row 0
// the chunk biome of a Work row = the vmap clamp of biome row 0 / 47; only
// WANG chunk biomes take the P re-read (non-wang biomes keep their lanes).
function workDefAt(world, tx, ty) {
  const key = `${tx},${ty < SKY_ROWS ? 0 : 1}`;
  world.workDefs ??= new Map();
  if (world.workDefs.has(key)) return world.workDefs.get(key);
  // the vmap clamp: biome row 0 above the map, row 47 below; col 70 = col 69
  const at = biomeAt(world.config, Math.min(tx, 69), ty < SKY_ROWS ? 0 : 47);
  const def = at?.biome?.templateFile ? at.biome : null;
  world.workDefs.set(key, def);
  return def;
}
// the RAW atlas of a main-band area (post-flood, pre-shade) — the Work
// re-classifies its placeholder cells, so it needs the grey ramp itself.
export function rawAreaMap(world, a) {
  world.rawMaps ??= new Map();
  if (world.rawMaps.has(a.key)) return world.rawMaps.get(a.key);
  const cacheFile = world.cacheDir ? path.join(world.cacheDir, String(world.seed), "raw", `${a.key}.bin`) : null;
  let m = cacheFile ? readCache(cacheFile) : null;
  if (!m || m.w !== a.w || m.h !== a.h) {
    m = null;
    try {
      const r = a.def.staticTile
        ? buildStaticTileArea(a, world.dataDir)
        : generateAreaExact(
            buildTileset(readPng(path.join(world.dataDir, a.def.templateFile.replace(/^data\//, "")))),
            a.w, a.h, world.seed,
            { isCoalMine: !!a.def.isCoalMine, shouldBlockOutRooms: !!a.def.shouldBlockOutRooms, worldX: a.worldX, worldY: a.worldY },
          );
      if (r) {
        applyRandomFloods(r.rgb, a.w, a.h, {
          dataDir: world.dataDir,
          biomeName: a.def.name,
          biomeFile: a.def.filename.replace(/^data\/biome\//, "").replace(/\.xml$/, ""),
          seed: world.seed,
        });
        m = { w: a.w, h: a.h, attempt: r.attempt, rgb: Buffer.from(r.rgb) };
        storeRawAreaMap(world, a, m);
      }
    } catch {
      m = null;
    }
  }
  world.rawMaps.set(a.key, m);
  return m;
}
const rawCacheFile = (world, a) =>
  world.cacheDir ? path.join(world.cacheDir, String(world.seed), "raw", `${a.key}.bin`) : null;
function storeRawAreaMap(world, a, m) {
  world.rawMaps ??= new Map();
  world.rawMaps.set(a.key, m);
  const cacheFile = rawCacheFile(world, a);
  if (!cacheFile) return;
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    const out = Buffer.alloc(12 + m.rgb.length);
    out.writeUInt32LE(m.w, 0); out.writeUInt32LE(m.h, 4); out.writeUInt32LE(m.attempt, 8);
    m.rgb.copy(out, 12);
    writeFileAtomic(cacheFile, out);
  } catch {
    // the raw cache is an accelerator only
  }
}
// --- the wang spawn-scene lane (wang-scenes.mjs) ---------------------------
// The art the game LoadPixelScene()s into the wang layers from the out_map's
// spawn colours (the blocked-out rooms + the structure pieces). Built once per
// world from the RAW out_maps (the trigger colours are gone after the display
// pass); blitted in the GENERATOR frame — the scene sits at the same offset
// from its trigger cell as in the game, and the bin lane reads the generator
// frame (gx, gy) too, so the art lands exactly in its room. Buffers keyed
// like setWorldPx (game chunk + (35, 62) = the generator-canvas chunk).
// Async: one event-loop tick per area (I36): a raw-map regeneration is ~1 s
// per area, and one contiguous sync span over all of them starves the vitest
// worker's RPC and the gen server's requests.
export async function buildWangScenes(world) {
  // recorded ops, per-chunk materialization (chunk-store.mjs); MAPGEN_EAGER_TEMPLATES=1 = the eager Map reference
  const scenes = process.env.MAPGEN_EAGER_TEMPLATES === "1" ? new Map() : new LazyChunkStore();
  const csv = loadWangScriptsCsv(world.dataDir);
  const hosts = new Map();
  const log = [];
  for (const a of world.areas) {
    if (a.def.staticTile || !a.def.luaScript) continue;
    await new Promise((r) => setImmediate(r));
    const raw = rawAreaMap(world, a);
    if (!raw) continue;
    let host = hosts.get(a.def.luaScript);
    if (!host) {
      host = new WangLuaHost(world.dataDir, a.def.luaScript, world.seed, csv);
      hosts.set(a.def.luaScript, host);
    }
    const r = areaSceneCalls(host, a, raw);
    // LoadPixelScene(…, skip_biome_checks = false): the scene writes only the
    // cells inside its own biome (a room at an area's bottom edge must not
    // paint into the Holy Mountain below). The biome at a pixel = GetBiomeAt
    // with the C187 edge displacement.
    const gate = (X, Y) => biomeAtPixel(world.config, X + 35 * CHUNK, Y + 14 * CHUNK) === a.def;
    for (const sc of r.scenes) {
      if (sc.mat) blitScene(scenes, world.dataDir, a.def, sc.mat, sc.vis || null, sc.x, sc.y, a.def.name, world.seed, gate);
      if (sc.bg) blitBackdrop(scenes, world.dataDir, sc.bg, sc.x, sc.y, gate);
    }
    log.push({ key: a.key, calls: r.calls, scenes: r.scenes });
  }
  world.wangScenes = scenes;
  world.wangSceneLog = log;
  return scenes;
}
// The scenes spawned FROM pixel-scene images (wang-scenes.mjs
// sceneImageSpawnCalls): the spliced scenes + the fixed _pixel_scenes table,
// each trigger px run through the hosting biome's real Lua. Painted in the
// DISPLAY frame (the splice lane's world px → canvas, like world.templates),
// with no biome gate (the calls pass skip_biome_checks = true — spawn_pillars).
// HasFlagPersistent (player progress) is a stub ⇒ false: the pillars render
// with NO flags held (the capture's extra segments = its player's unlocks).
function buildImageSpawns(world) {
  const store = new LazyChunkStore();
  const csv = loadWangScriptsCsv(world.dataDir);
  const hosts = new Map();
  const hostFor = (x, y) => {
    const def = biomeAt(world.config, Math.floor(x / CHUNK) + 35, Math.floor(y / CHUNK) + 14)?.biome;
    if (!def?.luaScript) return null;
    let h = hosts.get(def.luaScript);
    if (!h) { h = new WangLuaHost(world.dataDir, def.luaScript, world.seed, csv); hosts.set(def.luaScript, h); }
    return h;
  };
  const images = [
    ...SPLICE_PNGS.map((s) => ({ file: "data/biome_impl/spliced/" + s.file, x: s.x, y: s.y })),
    ...loadPixelSceneTable(world.dataDir).filter((e) => e.material && !e.entityOnly).map((e) => ({ file: e.material, x: e.x, y: e.y })),
  ];
  const readImage = (rel) => { try { return readPng(path.join(world.dataDir, rel.replace(/^data\//, ""))); } catch { return null; } };
  let calls = [];
  try { calls = sceneImageSpawnCalls(world.dataDir, images, hostFor, readImage); } catch { calls = []; }
  for (const sc of calls) {
    if (sc.mat) blitScene(store, world.dataDir, { materialBands: [] }, sc.mat, sc.vis || null, sc.x, sc.y, "", world.seed);
    if (sc.bg) blitBackdrop(store, world.dataDir, sc.bg, sc.x, sc.y);
  }
  world.imageSpawnLog = calls;
  return store;
}
function sceneBufAt(bufs, gx, gy) {
  if (!bufs) return null;
  const cx = Math.floor(gx / CHUNK), cy = Math.floor(gy / CHUNK);
  const buf = bufs.get(`${cx},${cy}`);
  if (!buf) return null;
  const o = 3 * ((gy - cy * CHUNK) * CHUNK + (gx - cx * CHUNK));
  if (tplUnset(buf, o) || tplAir(buf, o)) return null; // I62: AIR in the wang-scene planes lets the lanes below show (unmeasured)
  return [buf[o], buf[o + 1], buf[o + 2]];
}
// the scene's material/visual px (fg) and its background_file px (bg)
export const wangSceneAt = (world, gx, gy) => sceneBufAt(world.wangScenes, gx, gy);
export const wangSceneBgAt = (world, gx, gy) => sceneBufAt(world.wangScenes?.get("bg"), gx, gy);

// I53: the main band's displaced-edge pixel. undefined = the pixel
// keeps its chunk's lanes (undisplaced, or displaced into a wang/template
// biome — the global P outside a wang area is unread, ISSUES I53 residual);
// else the pixel biome's noise verdict: the classified material's colour, or
// AIR = that biome's backdrop (tiled in the chunk frame, C109). The chunk's
// own scene art (the template lane) still wins: LoadPixelScene writes over
// the terrain.
function edgePixelAt(world, gx, gy, wx, wy) {
  if (!world.config || !world.dataDir || !world.noiseAt) return undefined;
  const Y = wy - SKY_ROWS * CHUNK;
  const ccx = Math.floor(wx / CHUNK), ccy = Math.floor(wy / CHUNK);
  const lx = wx - ccx * CHUNK, ly = wy - ccy * CHUNK;
  // the edge law reads the display frame; the lanes below read the generator
  // frame (gx = wx + L3_ANCHOR) — compare against the chunk the lanes would
  // serve, so the 11/12-px anchor strip takes the pixel biome's verdict too
  const gcx = Math.floor(gx / CHUNK), gcy = Math.floor(gy / CHUNK);
  const near = (v) => v <= 41 + L3_ANCHOR.x || v >= 471 - L3_ANCHOR.x;
  if (!near(lx) && !near(ly)) return undefined; // interior: no probe fires
  const laneDef = biomeChunkDef(world.config, gcx, gcy - SKY_ROWS);
  const pix = biomeAtPixel(world.config, wx, Y);
  if (!pix || pix === laneDef) return undefined;
  const r = noisePixelFor(world.config, pix, world.seed ?? 0, gx, gy, world.dataDir);
  if (!r) return undefined;
  const tbuf = biomeChunkDef(world.config, ccx, ccy - SKY_ROWS) === pix ? null : world.templates?.get(`${ccx},${ccy}`);
  let edgeAir = false;
  if (tbuf) {
    const o = 3 * (ly * CHUNK + lx);
    edgeAir = tplAir(tbuf, o); // I62: the chunk's scene wrote AIR over the terrain
    if (!edgeAir && !tplUnset(tbuf, o)) return [tbuf[o], tbuf[o + 1], tbuf[o + 2]];
  }
  if (r.solid && !edgeAir) {
    const rgb = r.name ? materialColorAt(world.dataDir, r.name, wx - DISPLAY_X0, wy - DISPLAY_Y0) : null;
    return noiseColor(world, Math.floor(gx / CHUNK), Math.floor(gy / CHUNK), 1, rgb);
  }
  const bd = biomeBackdrop(pix, world.dataDir);
  if (!bd) return null;
  if (bd.fill) return bd.fill;
  if (!bd.pixels) return null;
  const bx = (((gx % CHUNK) % bd.w) + bd.w) % bd.w, by = (((gy % CHUNK) % bd.h) + bd.h) % bd.h;
  const q = 4 * (by * bd.w + bx);
  return [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]];
}

// The fill of the adjacent chunk whose biome = def, read at the same
// in-chunk offset (the wall lanes are per-chunk fills; the tongue continues it).
function neighbourFillAt(world, def, wx, wy) {
  const ttx = Math.floor(wx / CHUNK), tty = Math.floor(wy / CHUNK);
  for (const dx of [-1, 1]) {
    if (biomeChunkDef(world.config, ttx + dx, tty - SKY_ROWS) !== def) continue;
    const tbuf = world.templates?.get(`${ttx + dx},${tty}`);
    if (!tbuf) return undefined;
    const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
    if (tplUnset(tbuf, o) || tplAir(tbuf, o)) return undefined;
    return [tbuf[o], tbuf[o + 1], tbuf[o + 2]];
  }
  return undefined;
}
// undefined = not a Work column (the caller's lanes run); else the colour/null.
function workColorAt(world, tx, ty, gx, gy, wx, wy) {
  if (!world.config || !world.dataDir) return undefined; // injected worlds: no Work lane
  // C187 (biome edge): the pixel's biome = GetBiomeAt 0x909da0
  // (biomeAtPixel) at biome-map px (wx, wy − 48·512); within 41 px of a
  // chunk edge the boundary is displaced by 30·sin/cos(·0.005) + 11·simplex.
  const pix = biomeAtPixel(world.config, wx, wy - SKY_ROWS * CHUNK);
  const def = pix?.templateFile ? pix : null;
  if (!def) {
    // a wang chunk's pixel taken by its non-wang neighbour (the solid_wall
    // tongue): the neighbour chunk's own fill. The display chunk's biome is
    // tested (the edge law is display-frame).
    if (!pix || !biomeChunkDef(world.config, Math.floor(wx / CHUNK), Math.floor(wy / CHUNK) - SKY_ROWS)?.templateFile) return undefined;
    return neighbourFillAt(world, pix, wx, wy);
  }
  const gyM = workWrapY(gy, WORK_BAND_TOP);
  const idx = world.grid[Math.floor(gyM / CHUNK) * WORLD_CHUNKS_W + tx];
  if (idx >= 0) {
    const a = world.areas[idx];
    const raw = rawAreaMap(world, a);
    if (raw) {
      const lx = gx - a.area.x1 * CHUNK, ly = gyM - (a.area.y1 + SKY_ROWS) * CHUNK;
      if (lx >= 0 && ly >= 0 && lx < raw.w * 10 && ly < raw.h * 10) {
        const p = 3 * (Math.floor(ly / 10) * raw.w + Math.floor(lx / 10));
        world.workMaterials ??= loadMaterials(world.dataDir);
        // the classify table = the JOB biome = GetBiomeAt at the job-area
        // centre (dispatcher 0x90d1cf..0x90d1fb) = the display chunk's own
        // biome (the centre is ≥ 41 px from every edge ⇒ undisplaced, C187)
        const jobDef = biomeChunkDef(world.config, Math.floor(wx / CHUNK), Math.floor(wy / CHUNK) - SKY_ROWS) ?? def;
        const cell = workCellAt(raw.rgb[p], raw.rgb[p + 1], raw.rgb[p + 2],
          world.workMaterials, ensureSurfaceTable(world.dataDir, jobDef), gx - DISPLAY_X0, gy - DISPLAY_Y0);
        if (cell.material) return materialColorAt(world.dataDir, cell.material, wx - DISPLAY_X0, wy - DISPLAY_Y0);
      }
    }
  }
  // P air: the template lane's art (the moon altars, spliced scenes) first
  const ttx = Math.floor(wx / CHUNK), tty = Math.floor(wy / CHUNK);
  // only the pixel biome's own chunk art: a the_end tongue inside a
  // solid_wall chunk must not read that chunk's wall fill.
  const tbuf = biomeChunkDef(world.config, ttx, tty - SKY_ROWS) === def ? world.templates?.get(`${ttx},${tty}`) : null;
  if (tbuf) {
    const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
    if (!tplUnset(tbuf, o) && !tplAir(tbuf, o)) return [tbuf[o], tbuf[o + 1], tbuf[o + 2]];
  }
  // then the chunk biome's backdrop (the_end = background_the_end.png, tiled
  // per chunk — the C109 frame; limit_background_image="0"); none (the_sky =
  // "") ⇒ the sky.
  const bd = biomeBackdrop(def, world.dataDir);
  if (bd) {
    const lx = gx - tx * CHUNK, ly = gy - ty * CHUNK;
    const q = 4 * ((ly % bd.h) * bd.w + (lx % bd.w));
    return [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]];
  }
  return world.skyAt?.(tx, ty, gx, gy) ?? null;
}

// Ensures all wang areas for `seed` are generated. Immediate skeleton return
// + onProgress(done, total, key); await world.ready for completion.
export function ensureWorld(seed, dataDir, { cacheDir = null, onProgress = () => {} } = {}) {
  const world = loadWangWorld(dataDir);
  world.dataDir = dataDir; // the noise band's material colours resolve from here
  world.seed = seed; world.cacheDir = cacheDir; // the Work lane's raw-bin cache
  world.maps = new Map();
  world.templates = renderTemplateWorld(dataDir, world.config, seed); // template biomes (sync, cached art)
  world.imageSpawns = buildImageSpawns(world); // spawn triggers inside the spliced/fixed scene images (the tree's pillars)
  attachNoiseTerrain(world, dataDir, seed); // noise terrain; the seed reaches the caves-field lane
  world.ready = Promise.all(
    world.areas.map(
      (a) =>
        new Promise((resolve) => {
          // Yield before the per-area work on both branches (I36): reading
          // every cached .bin in one sync span blocks the vitest worker's
          // event loop long enough for its birpc timers to expire and abort
          // the run. One tick per area keeps the channel live and the gen
          // server responsive during startup loads.
          setImmediate(() => {
            const cacheFile = cacheDir ? path.join(cacheDir, String(seed), `${a.key}.bin`) : null;
            const cached = cacheFile ? readCache(cacheFile) : null;
            if (cached && cached.w === a.w && cached.h === a.h) {
              world.maps.set(a.key, cached);
              onProgress(1, a.key, null);
              resolve();
              return;
            }
            let r = null, err = null;
            try {
              // static-tile biomes carry fixed artworks, not herringbone
              // wang atlases (their on-image wang header is all zeros) —
              // render straight to the display buffer, no fill attempts.
              r = a.def.staticTile
                ? buildStaticTileArea(a, dataDir)
                : (() => {
                    const ts = buildTileset(readPng(path.join(dataDir, a.def.templateFile.replace(/^data\//, ""))));
                    return generateAreaExact(ts, a.w, a.h, seed, {
                      isCoalMine: !!a.def.isCoalMine,
                      shouldBlockOutRooms: !!a.def.shouldBlockOutRooms,
                      worldX: a.worldX,
                      worldY: a.worldY,
                    });
                  })();
              if (r) {
                // the RAW out_map (post-flood, pre-shade = rawAreaMap's
                // definition) — the spawn-scene lane reads its trigger
                // colours, which the display pass below erases.
                const floodOpts = {
                  dataDir,
                  biomeName: a.def.name,
                  biomeFile: a.def.filename.replace(/^data\/biome\//, "").replace(/\.xml$/, ""),
                  seed,
                };
                const raw = Buffer.from(r.rgb);
                if (!a.def.staticTile) applyRandomFloods(raw, a.w, a.h, floodOpts);
                storeRawAreaMap(world, a, { w: a.w, h: a.h, attempt: r.attempt, rgb: raw });
                // display-color pass (capture-calibrated); mutates r.rgb in place
                const { unknown } = colorizeArea(r.rgb, a.w, a.h, {
                  dataDir,
                  biomeName: a.def.name,
                  biomeFile: a.def.filename.replace(/^data\/biome\//, "").replace(/\.xml$/, ""),
                  seed,
                  // the area's first cell origin in the game frame (C192:
                  // 10·trunc(c·51.2) − 5 − G) — for the y-gated placeholder
                  // law and the C185 colour of every material cell
                  worldX0: spawnCallOrigin(a.area.x1, a.area.y1).x,
                  worldY0: spawnCallOrigin(a.area.x1, a.area.y1).y,
                });
                r.unknown = unknown;
              }
            } catch (e) {
              err = e;
            }
            if (!r) {
              world.errors.set(a.key, String(err?.message ?? `no attempt accepted (${a.key})`));
              onProgress(0, a.key, err ?? new Error(`no attempt accepted (${a.key})`));
            } else {
              const m = { w: a.w, h: a.h, attempt: r.attempt, rgb: Buffer.from(r.rgb) };
              world.maps.set(a.key, m);
              if (cacheFile) {
                fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
                const out = Buffer.alloc(12 + m.rgb.length);
                out.writeUInt32LE(m.w, 0);
                out.writeUInt32LE(m.h, 4);
                out.writeUInt32LE(m.attempt, 8);
                m.rgb.copy(out, 12);
                writeFileAtomic(cacheFile, out);
              }
              onProgress(1, a.key, null, r.attempt);
            }
            resolve();
          });
        })
    )
  ).then(() =>
    // the wang spawn-scene lane needs every area's raw out_map (the Lua
    // hosts are per biome script and shared across its areas)
    buildWangScenes(world)
  );
  return world;
}
