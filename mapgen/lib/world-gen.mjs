// World generation for the genmap server: all wang areas for a seed,
// cached to disk. 1 atlas px = 10 world px; canvas = 71x144 chunks
// (36352 x 73728 world px) — the clamped virtual map: 48 sky rows above +
// the 70x48 biome band + 48 deep rows below + 1 east column (biome col 69
// clamped). Canvas (0,0) = biome px (0,-48) = world (-17920,-31744).

import fs from "node:fs";
import path from "node:path";
import { loadBiomeConfig, biomeAt } from "./biomes.mjs";
import { buildTileset } from "./wang-js.mjs";
import { generateAreaExact } from "./generate-exact.mjs";
import { colorizeArea } from "./colorize.mjs";
import { renderTemplateWorld } from "./template-render.mjs";
import { readPng } from "./images.mjs";
import { materialColorByName } from "./colorize.mjs"; // dig #130 surface-lane colors
import { ensureBiomeBackdrop } from "./noise-terrain.mjs"; // dig #134 bin-air backdrop

// dig #134: the bin-air backdrop memo (per def.filename) — the wang
// bands' AIR cells composite the area biome's declared bg art.
const binBackdrops = new Map();
function biomeBackdrop(def, dataDir) {
  if (!def?.filename || !dataDir) return null;
  const key = def.filename;
  if (binBackdrops.has(key)) return binBackdrops.get(key);
  const bd = ensureBiomeBackdrop(dataDir, def);
  binBackdrops.set(key, bd);
  return bd;
}
import { attachNoiseTerrain } from "./noise-terrain.mjs"; // F3 (2026-09-20)

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

// L3 anchor (CONSTANTS C78, dig #99): gen↔capture registration fitted on
// seed 78633191 (ABOUT_MATH (99)). score(dx,dy) compared ref(x,y) with
// gen(x+dx,y+dy); the CONSTANT verdict peak (11,12) ⇒ display (wx,wy) reads
// GENERATOR-lane content at (wx+11, wy+12). Bounds are checked on the
// DISPLAY coordinate first; content past the canvas edge is background
// (right 11 px / bottom 12 px strips → null). Sampling-only: the gen-cache
// .bin format is untouched.
// dig #170 (C145): the anchor registers the GENERATOR lanes (area bins,
// noise) only — NOT the template lane. The template buffer is a
// DISPLAY-frame buffer (setWorldPx keys it by the game→display CHUNK map
// (+35/+62, chunk-aligned) and writes game-frame locals, so the display
// chunk = the write chunk and the display local = the write local); the
// template reads below sample (wx, wy), not (gx, gy). Reading the template
// at generator-local had shifted every scene (−11,−12) (M-grade: the
// water-mask cross-correlation of spliced/mountain_lake.png vs capture
// 40_14 peaks at IDENTITY — 56450/56467 = 99.97% of the capture's flat
// [35,61,56] water covered by art water at offset (0,0); no neighbor
// offset beats (0,0) in the ±16 sweep — instrument:
// mapgen/experiments/2026-10-19-dig170-lake-band-counts.mjs).
export const L3_ANCHOR = { x: 11, y: 12 };

export function worldColorAt(world, wx, wy) {
  if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) return null;
  const gx = wx + L3_ANCHOR.x, gy = wy + L3_ANCHOR.y;
  if (gx >= WORLD_W || gy >= WORLD_H) return null;
  const tx = Math.floor(gx / CHUNK), ty = Math.floor(gy / CHUNK);
  // dig #133 (I32 p2c, the SKY/Hell layer law): the SKY BAND = chunk rows
  // 0..61 (the vmap sky clamp + the biome map's rows 0..13 = the_sky/hills
  // sky region, all the way up to the Heaven end). ONE backdrop (BLACK
  // air + stars at every altitude — the NIGHT law 2026-10-19; the old
  // parallax gradient = the user's "brown chunk" gold band) with the
  // template lane's ART pieces over
  // it (the mountain/hills LoadPixelScene pieces, the moon, the spliced
  // scenes). The area-bin lane NEVER paints here (the_sky's bin = the
  // void black; the extension's airDark = superseded by the sky). The
  // hills def's declared cave-bg belongs to the underground pockets, not
  // the sky (the user's in-game observation; the biome map rows 1..12 =
  // hills = the sky region per the byte map).
  if (ty < 62) {
    // dig #134 fix-3 (the boss-room law, the user's "3 squares" report):
    // the WANG BIOMES inside the sky-band rows = terrain, not sky. The
    // biome map rows 12..13 carry the pyramid's mosaic (the pyramid/
    // left/right/entrance/hallway + the boss room), and their chunks' wang
    // bins = the real corridor/wall fill (the "art and corridors mix")
    // — the #133 sky-first decision erased them (the 3 squares missing).
    // Order now: 1) the wang bin fill (the terrain; the bin's airDark
    // cells composite the area def's bg via the #134 bin-air law);
    // 2) the template buffer's art pieces over it; 3) the VOID defs (the
    // _sky/barren/darkness family = the "renders black" set) + the bin-less
    // chunks = the sky backdrop (black + stars, the NIGHT law 2026-10-19). The hills def's
    // cave-bg = still NOT in the sky (only the VOID bgs route here).
    let binPx = null, voidChunk = false;
    {
      const idxB = world.grid[ty * WORLD_CHUNKS_W + tx];
      if (idxB >= 0) {
        const a = world.areas[idxB];
        const m = world.maps.get(a.key);
        if (m) {
          const lx = gx - a.area.x1 * CHUNK, ly = gy - (a.area.y1 + SKY_ROWS) * CHUNK;
          if (lx >= 0 && ly >= 0 && lx < m.w * 10 && ly < m.h * 10) {
            const ax = Math.floor(lx / 10), ay = Math.floor(ly / 10);
            const p = 3 * (ay * m.w + ax);
            const r = m.rgb[p], g = m.rgb[p + 1], b = m.rgb[p + 2];
            const airDark =
              (r === 13 && g === 14 && b === 18) || (r === 12 && g === 13 && b === 17) ||
              (r === 16 && g === 16 && b === 18) || (r === 21 && g === 23 && b === 30);
            voidChunk = /(?:^|\/)(the_sky|barren|darkness|potion_mimics|boss_sky|sky_light_injector)\.xml$/.test(a.def?.filename ?? "");
            if (voidChunk) {
              // the void-sky bin's own pixels (the colorized black) NEVER
              // paint — the = the sky backdrop handles the whole chunk (the
              // first fix's order bug: the black passed the non-airDark
              // "terrain" branch and returned as ground)
            } else if (!airDark) {
              return [r, g, b]; // the wang terrain (the boss room walls, the mines fill)
            } else {
              // the bin air = the area def's declared bg (the C111 law)
              const bd = biomeBackdrop(a.def, world.dataDir);
              if (bd) {
                const bx = ((lx % bd.w) + bd.w) % bd.w, by = ((ly % bd.h) + bd.h) % bd.h;
                const q = 4 * (by * bd.w + bx);
                binPx = [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]];
              }
            }
          }
        }
      }
    }
    // dig #170 (C145): template lane = DISPLAY frame (see the anchor
    // comment); the bin lane above and skyAt below keep the generator frame.
    const ttx = Math.floor(wx / CHUNK), tty = Math.floor(wy / CHUNK);
    const tbuf = world.templates?.get(`${ttx},${tty}`);
    if (tbuf) {
      const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
      if (tbuf[o] !== 9) return [tbuf[o], tbuf[o + 1], tbuf[o + 2]];
    }
    if (!voidChunk && binPx) return binPx;
    return world.skyAt?.(tx, ty, gx, gy) ?? null;
  }
  const idx = world.grid[ty * WORLD_CHUNKS_W + tx];
  if (idx >= 0) {
    const a = world.areas[idx];
    const m = world.maps.get(a.key);
    if (m) {
      const lx = gx - a.area.x1 * CHUNK, ly = gy - (a.area.y1 + SKY_ROWS) * CHUNK;
      // area maps are in atlas px: 1 atlas px = 10 world px
      if (lx >= 0 && ly >= 0 && lx < m.w * 10 && ly < m.h * 10) {
        const ax = Math.floor(lx / 10), ay = Math.floor(ly / 10);
        const p = 3 * (ay * m.w + ax);
        // dig #134 (the bin-air backdrop law; C109/C110 extended to the
        // bin lane): the wang bands' AIR cells (the colorize airDark
        // family) = the area biome's Topology background_image (the
        // pyramid band's bg, the mines' air = the coalmine bg, the HM
        // walls = the temple def's own). The per-biome law = byte-backed
        // (each def declares its bg); the sky band never reaches here
        // (the ty<62 sky-first branch).
        const r = m.rgb[p], g = m.rgb[p + 1], b = m.rgb[p + 2];
        if ((r === 13 && g === 14 && b === 18) || (r === 12 && g === 13 && b === 17)
          || (r === 16 && g === 16 && b === 18) || (r === 21 && g === 23 && b === 30)) {
          const bd = biomeBackdrop(a.def, world.dataDir);
          if (bd) {
            const bx = ((lx % bd.w) + bd.w) % bd.w, by = ((ly % bd.h) + bd.h) % bd.h;
            const q = 4 * (by * bd.w + bx);
            return [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]];
          }
        }
        return [r, g, b];
      }
    }
  }
  // template-biome overlay (temple scenes, procedural fills); 9 = unset
  // dig #170 (C145): template lane = DISPLAY frame (anchor comment).
  const ttx = Math.floor(wx / CHUNK), tty = Math.floor(wy / CHUNK);
  const buf = world.templates?.get(`${ttx},${tty}`);
  if (buf) {
    const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
    if (buf[o] !== 9 || buf[o + 1] !== 9 || buf[o + 2] !== 9) {
      return [buf[o], buf[o + 1], buf[o + 2]];
    }
  }
  // F3 noise-terrain (2026-09-20, ABOUT_MATH (15)/(16)): procedural biomes
  // get the binary evaluator chain per wang cell (shape-first priority:
  // the >0.5 gate value decides solidity, material naming is config-side).
  const nz = world.noiseSolidAt?.(gx, gy);
  if (nz != null) {
    // dig #130 (the surface-lane compositor): the art band's ground = the
    // biome <Materials> classify per cell (C76 frame) → the material's
    // materials.xml wang_color; unclassified solids keep the band shade.
    const mat = world.noiseMatAt?.(gx, gy);
    let rgb = null;
    if (mat && mat.idx !== 255 && mat.names && mat.names[mat.idx] && world.dataDir) {
      rgb = materialColorByName(world.dataDir, mat.names[mat.idx]);
    }
    if (nz) return noiseColor(world, tx, ty, nz, rgb);
    // dig #132 (I32 p2b, the per-area background law): an AIR cell in a
    // procedural chunk composites the chunk's biome Topology
    // `background_image` (the game's per-area backdrop; hills =
    // weather_gfx/background_cave_04_alt, coalmine =
    // weather_gfx/background_coalmine); a def with NO bg art (the_sky =
    // "") fills its `biome_color` (the pale blue the byte map carries).
    // The backdrop tiles in the CHUNK frame (per 512×512 cell region —
    // the game's own per-area parallax is a later lane; tagged).
    const bgr = world.bgImageAt?.(tx, ty, gx, gy);
    return bgr ?? null;
  }
  return null;
}

// Noise-terrain display color (shape-first, user mandate 2026-09-20):
// solid cells get their classified material's wang_color (dig #130) when
// available, else one baseline shade per band (the pre-#130 shape-first
// palette); air cells return null so the renderer's own background rules
// apply.
function noiseColor(world, tx, ty, solid, materialRgb = null) {
  if (!solid) return null;
  void tx; void ty; void world;
  if (materialRgb) return materialRgb;
  const dark = ty - SKY_ROWS > 26 || ty - SKY_ROWS < -6;
  const hex = dark ? 0x1b1b1b : 0x6a5a44; // deep rock band vs provisional surface
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
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

// Ensures all wang areas for `seed` are generated. Immediate skeleton return
// + onProgress(done, total, key); await world.ready for completion.
export function ensureWorld(seed, dataDir, { cacheDir = null, onProgress = () => {} } = {}) {
  const world = loadWangWorld(dataDir);
  world.dataDir = dataDir; // dig #130: the noise band's material colors resolve from here
  world.maps = new Map();
  world.templates = renderTemplateWorld(dataDir, world.config, seed); // template biomes (sync, cached art)
  attachNoiseTerrain(world, dataDir, seed); // F3 noise terrain (2026-09-20) — the seed reaches the caves-field lane (dig #30)
  world.ready = Promise.all(
    world.areas.map(
      (a) =>
        new Promise((resolve) => {
          const cacheFile = cacheDir ? path.join(cacheDir, String(seed), `${a.key}.bin`) : null;
          const cached = cacheFile ? readCache(cacheFile) : null;
          if (cached && cached.w === a.w && cached.h === a.h) {
            world.maps.set(a.key, cached);
            onProgress(1, a.key, null);
            resolve();
            return;
          }
          // let the caller tick before each generation (keeps logs responsive)
          setImmediate(() => {
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
                // display-color pass (capture-calibrated); mutates r.rgb in place
                const { unknown } = colorizeArea(r.rgb, a.w, a.h, {
                  dataDir,
                  biomeName: a.def.name,
                  biomeFile: a.def.filename.replace(/^data\/biome\//, "").replace(/\.xml$/, ""),
                  seed,
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
                fs.writeFileSync(cacheFile, out);
              }
              onProgress(1, a.key, null, r.attempt);
            }
            resolve();
          });
        })
    )
  );
  return world;
}
