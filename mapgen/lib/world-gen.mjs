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

export function worldColorAt(world, wx, wy) {
  if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) return null;
  const tx = Math.floor(wx / CHUNK), ty = Math.floor(wy / CHUNK);
  const idx = world.grid[ty * WORLD_CHUNKS_W + tx];
  if (idx >= 0) {
    const a = world.areas[idx];
    const m = world.maps.get(a.key);
    if (m) {
      const lx = wx - a.area.x1 * CHUNK, ly = wy - (a.area.y1 + SKY_ROWS) * CHUNK;
      // area maps are in atlas px: 1 atlas px = 10 world px
      if (lx >= 0 && ly >= 0 && lx < m.w * 10 && ly < m.h * 10) {
        const ax = Math.floor(lx / 10), ay = Math.floor(ly / 10);
        const p = 3 * (ay * m.w + ax);
        return [m.rgb[p], m.rgb[p + 1], m.rgb[p + 2]];
      }
    }
  }
  // template-biome overlay (temple scenes, procedural fills); 9 = unset
  const key = `${tx},${ty}`;
  const buf = world.templates?.get(key);
  if (buf) {
    const o = 3 * ((wy - ty * CHUNK) * CHUNK + (wx - tx * CHUNK));
    if (buf[o] !== 9 || buf[o + 1] !== 9 || buf[o + 2] !== 9) {
      return [buf[o], buf[o + 1], buf[o + 2]];
    }
  }
  return null;
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

// Ensures all wang areas for `seed` are generated. Immediate skeleton return
// + onProgress(done, total, key); await world.ready for completion.
export function ensureWorld(seed, dataDir, { cacheDir = null, onProgress = () => {} } = {}) {
  const world = loadWangWorld(dataDir);
  world.maps = new Map();
  world.templates = renderTemplateWorld(dataDir, world.config, seed); // template biomes (sync, cached art)
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
              const ts = buildTileset(readPng(path.join(dataDir, a.def.templateFile.replace(/^data\//, ""))));
              r = generateAreaExact(ts, a.w, a.h, seed, {
                isCoalMine: !!a.def.isCoalMine,
                shouldBlockOutRooms: !!a.def.shouldBlockOutRooms,
                worldX: a.worldX,
                worldY: a.worldY,
              });
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
