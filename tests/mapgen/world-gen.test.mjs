// world-gen.mjs contracts: virtual canvas, area/chunk mapping, seralized
// per-area cache format, chunk sampling. Requires extracted data for full
// world loads; worldColorAt runs against an injected world (no data).

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "vitest";
import {
  CHUNK, WORLD_CHUNKS_W, WORLD_CHUNKS_H, SKY_ROWS, WORLD_W, WORLD_H,
  loadWangWorld, worldColorAt, ensureWorld, areaKey, L3_ANCHOR,
} from "../../mapgen/lib/world-gen.mjs";
import { dataDir, hasNoitaData, CAPTURE_SEED, repoRoot } from "../helpers/data.mjs";
import { biomeByName } from "../helpers/golden.mjs";

describe("canvas constants (VERIFIED.md / mapgen/ISSUES.md verified extensions)", () => {
  test("chunk = 512 world px; world = 71x144 chunks + 48 sky rows", () => {
    expect(CHUNK).toBe(512);
    expect(SKY_ROWS).toBe(48);
    expect(WORLD_W).toBe(36352);
    expect(WORLD_H).toBe(73728);
  });
});

describe("worldColorAt — injected world (no data needed)", () => {
  const mkWorld = () => {
    const rgb = Buffer.alloc(3 * 2 * 2);
    rgb[0] = 1; rgb[1] = 2; rgb[2] = 3;          // cell (0,0)
    rgb[3] = 4; rgb[4] = 5; rgb[5] = 6;          // cell (1,0)
    rgb[6] = 7; rgb[7] = 8; rgb[8] = 9;          // cell (0,1)
    rgb[9] = 10; rgb[10] = 11; rgb[11] = 12;     // cell (1,1)
    const world = {
      grid: new Int16Array(WORLD_CHUNKS_W * WORLD_CHUNKS_H).fill(-1),
      errors: new Map(),
      templates: new Map(),
      maps: new Map(),
      ready: Promise.resolve(),
    };
    const area = { key: "coalmine_29_14", def: {}, area: { x1: 35, y1: 14 }, w: 2, h: 2, worldX: 0, worldY: 0 };
    world.grid[62 * WORLD_CHUNKS_W + 35] = 0; // canvas ty 62 = biome ty 14
    world.areas = [area];
    world.maps.set("coalmine_29_14", { w: 2, h: 2, attempt: 0, rgb });
    return world;
  };

  test("canvas constants (C78): L3_ANCHOR = (+11, +12) world px", () => {
    expect(L3_ANCHOR).toEqual({ x: 11, y: 12 });
  });

  test("samples the area map with 1 atlas px = 10 world px scale (anchor applied)", () => {
    const w = mkWorld();
    const { x: AX, y: AY } = L3_ANCHOR;
    // back-shifted display: display origin − anchor samples content exactly at
    // the area's world origin: biome (35,14) -> canvas (35, 62) -> world (17920, 31744)
    expect(worldColorAt(w, 35 * CHUNK - AX, 62 * CHUNK - AY)).toEqual([1, 2, 3]);
    expect(worldColorAt(w, 35 * CHUNK + 15 - AX, 62 * CHUNK + 5 - AY)).toEqual([4, 5, 6]); // cell x=1
    expect(worldColorAt(w, 35 * CHUNK + 5 - AX, 62 * CHUNK + 15 - AY)).toEqual([7, 8, 9]); // cell y=1
    // unshifted display now reads content 11/12 px further = atlas cell (1,1)
    expect(worldColorAt(w, 35 * CHUNK, 62 * CHUNK)).toEqual([10, 11, 12]);
  });

  test("returns null outside the canvas", () => {
    const w = mkWorld();
    expect(worldColorAt(w, -1, 0)).toBeNull();
    expect(worldColorAt(w, 0, WORLD_H)).toBeNull();
    expect(worldColorAt(w, WORLD_W, 0)).toBeNull();
    // display in bounds but the anchor pushes the sample past the canvas:
    // right 11 px / bottom 12 px strips render as background (C78)
    expect(worldColorAt(w, WORLD_W - 1, WORLD_H - 1)).toBeNull();
  });

  test("outside the loaded area's map -> template overlay (9 = unset) or null", () => {
    const w = mkWorld();
    expect(worldColorAt(w, 0, 0)).toBeNull(); // grid -1, no template
    w.templates.set("0,0", new Uint8Array(CHUNK * CHUNK * 3).fill(9)); // all 9 = unset
    expect(worldColorAt(w, 40 - 11, 100 - 12)).toBeNull();
    const buf = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    const o = 3 * (100 * CHUNK + 40);
    buf[o] = 120; buf[o + 1] = 121; buf[o + 2] = 122;
    w.templates.set("0,0", buf);
    expect(worldColorAt(w, 40 - 11, 100 - 12)).toEqual([120, 121, 122]);
  });
});

describe.skipIf(!hasNoitaData())("loadWangWorld — full biome/world skeleton", () => {
  const world = hasNoitaData() ? loadWangWorld(dataDir) : null;

  test("one entry per connected wang biome area, sorted top-left first", () => {
    expect(world.areas.length).toBeGreaterThan(40);
    for (let i = 1; i < world.areas.length; i++) {
      const a = world.areas[i - 1], b = world.areas[i];
      const cmp = a.area.y1 - b.area.y1 || a.area.x1 - b.area.x1;
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });

  test("spawn coalmine chunk maps to the right area entry on the grid", () => {
    const entry = biomeByName(world.config, "coalmine");
    const idx = world.grid[63 * WORLD_CHUNKS_W + 35]; // canvas ty 63 = biome ty 15
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(world.areas[idx].def.name).toBe(entry.name);
    expect(areaKey(entry, world.areas[idx].area)).toContain("coalmine");
  });

  test("per-area dims use truncating GetWidthFromPix (non-integer cells/chunk area span)", () => {
    for (const a of world.areas.slice(0, 10)) {
      expect(a.w).toBe(Math.trunc(((a.area.x2 + 1) * 512) / 10) - Math.trunc((a.area.x1 * 512) / 10));
    }
  });
});

describe.skipIf(!hasNoitaData())("ensureWorld — cached generation (repo gen-cache, seed 78633191)", () => {
  // Use the freshest repo-hosted cache revision that covers the reference
  // seed (genmap server artifacts); skip when no cache exists (cold gen is
  // ~25 s/seed, out of scope for the unit battery).
  function findCacheDir() {
    const base = path.join(repoRoot, "mapgen/out/gen-cache");
    try {
      const revs = fs.readdirSync(base).sort().reverse();
      for (const rev of revs) {
        if (fs.existsSync(path.join(base, rev, String(CAPTURE_SEED)))) {
          return path.join(base, rev);
        }
      }
    } catch {}
    return null;
  }
  const cacheDir = findCacheDir();
  let world = null;

  test("loads all areas from the disk cache", async () => {
    if (!cacheDir) return; // no cached seed — cold gen out of scope for the battery
    world = ensureWorld(CAPTURE_SEED, dataDir, { cacheDir });
    await world.ready;
    // some areas legitimately end with no accepted attempt (lake / rainforest_dark — VERIFIED.md §5/open frontier)
    expect(world.errors.size).toBeLessThanOrEqual(10);
    expect(world.maps.size).toBe(world.areas.length - world.errors.size);
  });

  test("accepted attempts stay in the 100-attempt driver range", async () => {
    if (!cacheDir || !world) return;
    for (const [key, m] of world.maps) {
      expect(m.attempt).toBeGreaterThanOrEqual(0);
      expect(m.attempt).toBeLessThanOrEqual(99);
      expect(m.rgb.length).toBe(3 * m.w * m.h);
      expect(m.key ?? key).toBeTypeOf("string");
    }
  });

  test("per-area .bin cache format: u32 w | u32 h | u32 attempt | rgb", async () => {
    if (!cacheDir || !world) return;
    const [key, m] = world.maps.entries().next().value;
    const buf = fs.readFileSync(path.join(cacheDir, String(CAPTURE_SEED), `${key}.bin`));
    expect(buf.readUInt32LE(0)).toBe(m.w);
    expect(buf.readUInt32LE(4)).toBe(m.h);
    expect(buf.readUInt32LE(8)).toBe(m.attempt);
    expect(buf.length).toBe(12 + m.rgb.length);
  });
});
