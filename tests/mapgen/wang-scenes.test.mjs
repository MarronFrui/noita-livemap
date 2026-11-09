// The wang spawn-scene lane (mapgen/lib/wang-scenes.mjs + world-gen's
// buildWangScenes / wangSceneAt): the art the game LoadPixelScene()s into the
// wang layers from the out_map's spawn colours (the blocked-out rooms — the
// "missing tiles" of layers 1-7 — and the structure pieces).

import { describe, test, expect } from "vitest";
import {
  CHUNK, WORLD_CHUNKS_W, WORLD_CHUNKS_H, L3_ANCHOR, worldColorAt, wangSceneAt, wangSceneBgAt,
} from "../../mapgen/lib/world-gen.mjs";
import { WangLuaHost, areaSceneCalls, loadWangScriptsCsv, INIT_COLOR, spawnCallOrigin } from "../../mapgen/lib/wang-scenes.mjs";
import { loadBiomeExtras } from "../../mapgen/lib/colorize.mjs";
import { seededPrng } from "../../mapgen/lib/wang-js.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

const SEED = 78633191;
// a synthetic out_map: w×h black cells with the given trigger cells
const mkRaw = (w, h, cells) => {
  const rgb = Buffer.alloc(3 * w * h);
  for (const [i, j, c] of cells) {
    const p = 3 * (j * w + i);
    rgb[p] = (c >> 16) & 255; rgb[p + 1] = (c >> 8) & 255; rgb[p + 2] = c & 255;
  }
  return { w, h, attempt: 0, rgb };
};
const COALMINE_AREA = { key: "coalmine_34_14", area: { x1: 34, y1: 14 } }; // generator origin (−512, 0); spawn-call origin (−525, −13)
const OILTANK = 0xc35700; // coalmine.lua: RegisterSpawnFunction( 0xffC35700, "load_oiltank" )

describe.skipIf(!hasNoitaData)("wang spawn-scene lane — the Lua host (game data)", () => {
  const csv = hasNoitaData ? loadWangScriptsCsv(dataDir) : new Map();
  const host = () => new WangLuaHost(dataDir, "data/scripts/biomes/coalmine.lua", SEED, csv);

  test("the engine colour table = scripts/wang_scripts.csv (the room loaders)", () => {
    expect(csv.get(0xff0aff)).toBe("load_pixel_scene");
    expect(csv.get(0xff0080)).toBe("load_pixel_scene2");
    expect(csv.get(0xff0000)).toBe("spawn_small_enemies");
  });

  test("the biome script's RegisterSpawnFunction lines extend the table; the script loads clean", () => {
    const h = host();
    expect(h.errors).toEqual([]);
    expect(h.table.get(OILTANK)).toBe("load_oiltank");
    expect(h.table.get(0x969678)).toBe("load_structures");
    expect(h.table.get(0xff0aff)).toBe("load_pixel_scene"); // the engine default survives
  });

  test("count law 0/1/N: one call per trigger cell at (call origin + 10·cell); init colour skipped", () => {
    const h = host();
    expect(areaSceneCalls(h, COALMINE_AREA, mkRaw(8, 8, [])).calls).toBe(0);
    expect(areaSceneCalls(h, COALMINE_AREA, mkRaw(8, 8, [[2, 3, INIT_COLOR]])).calls).toBe(0);
    const one = areaSceneCalls(h, COALMINE_AREA, mkRaw(8, 8, [[2, 3, OILTANK]]));
    expect(one.calls).toBe(1);
    expect(one.scenes).toHaveLength(1);
    // game frame: 10·t − 5 − G (t = 1740 + 2, 716 + 3) = the game cell origin;
    // generator frame: the generator cell origin (zero offset from the trigger cell)
    expect(one.scenes[0]).toMatchObject({ fn: "load_oiltank", callX: -505, callY: 17, x: -512 + 20, y: 30 });
    const n = areaSceneCalls(h, COALMINE_AREA, mkRaw(64, 8, [[10, 1, OILTANK], [30, 1, OILTANK], [50, 1, OILTANK]]));
    expect(n.calls).toBe(3);
    expect(n.scenes.map((s) => s.x)).toEqual([-412, -212, -12]);
    expect(n.scenes.map((s) => s.callX)).toEqual([-425, -225, -25]);
  });

  test("C191 the spawn-record origin: 10·trunc(c·51.2) − 5 − G (G2 = 17920, G1 = 7168)", () => {
    expect(spawnCallOrigin(35, 14)).toEqual({ x: -5, y: -13 }); // 1792 exact / 716.8 → 716
    expect(spawnCallOrigin(34, 14)).toEqual({ x: -525, y: -13 }); // 1740.8 → 1740
    expect(spawnCallOrigin(36, 15)).toEqual({ x: 505, y: 507 }); // 1843.2 → 1843 / 768 exact
    // the old law ((c − 35)·512, (c − 14)·512) differs on every axis
    for (const [x1, y1] of [[34, 14], [35, 14], [36, 15]]) {
      const o = spawnCallOrigin(x1, y1);
      expect(o.x).not.toBe((x1 - 35) * 512);
      expect(o.y).not.toBe((y1 - 14) * 512);
    }
  });

  test("load_even_if_duplicate = false: the same scene at the same spot loads once", () => {
    const h = host();
    const r = areaSceneCalls(h, COALMINE_AREA, mkRaw(8, 8, [[2, 3, OILTANK]]));
    const again = areaSceneCalls(h, COALMINE_AREA, mkRaw(8, 8, [[2, 3, OILTANK]]));
    expect(r.scenes).toHaveLength(1);
    expect(again.calls).toBe(1);
    expect(again.scenes).toHaveLength(0);
  });

  test("the RNG law: load_oiltank's branch = SetRandomSeed(x, y); Random(1, 100) <= 50 (seededPrng)", () => {
    // fails under any other seeding/arity: the branch must track the port
    let tank = 0, pit = 0;
    for (let k = 0; k < 24; k++) {
      const h = host();
      const i = 3 + k, j = 5 + 2 * k;
      const r = areaSceneCalls(h, COALMINE_AREA, mkRaw(64, 64, [[i, j, OILTANK]]));
      const x = -525 + 10 * i, y = -13 + 10 * j; // the spawn-record frame (C191)
      const wantTank = seededPrng(SEED, x, y).random(1, 100) <= 50;
      const isTank = /oiltank_/.test(r.scenes[0].mat);
      expect(isTank).toBe(wantTank);
      if (isTank) tank++; else pit++;
    }
    expect(tank).toBeGreaterThan(0); // both arms exercised
    expect(pit).toBeGreaterThan(0);
  });

  test("colorize: every spawn colour of the biome = a trigger (air), the init colour excluded", () => {
    const vault = loadBiomeExtras(dataDir, "vault");
    expect(vault.spawnColors.has("be82a0")).toBe(true); // spawn_pipes_ver (vault.lua)
    expect(vault.spawnColors.has("ff0aff")).toBe(true); // load_pixel_scene (wang_scripts.csv)
    expect(vault.spawnColors.has("ffeedd")).toBe(false);
  });
});

describe("wang spawn-scene lane — worldColorAt precedence (injected world, no data)", () => {
  const mkWorld = () => {
    const rgb = Buffer.alloc(3 * 4 * 4); // 4×4 cells, all black (bin air)
    for (let p = 0; p < rgb.length; p += 3) { rgb[p] = 70; rgb[p + 1] = 65; rgb[p + 2] = 40; } // soil
    const world = {
      grid: new Int16Array(WORLD_CHUNKS_W * WORLD_CHUNKS_H).fill(-1),
      errors: new Map(), templates: new Map(), maps: new Map(), ready: Promise.resolve(),
    };
    world.grid[62 * WORLD_CHUNKS_W + 35] = 0;
    world.areas = [{ key: "a", def: {}, area: { x1: 35, y1: 14 }, w: 4, h: 4 }];
    world.maps.set("a", { w: 4, h: 4, attempt: 0, rgb });
    return world;
  };
  const sceneBuf = (fill) => new Uint8Array(CHUNK * CHUNK * 3).fill(fill);

  test("a scene px beats the wang bin; an unset (9) scene px falls through to the bin", () => {
    const w = mkWorld();
    const { x: AX, y: AY } = L3_ANCHOR;
    const buf = sceneBuf(9);
    buf.set([200, 10, 10], 3 * (5 * CHUNK + 5)); // generator px (35·512+5, 62·512+5)
    w.wangScenes = new Map([["35,62", buf]]);
    expect(wangSceneAt(w, 35 * CHUNK + 5, 62 * CHUNK + 5)).toEqual([200, 10, 10]);
    expect(worldColorAt(w, 35 * CHUNK + 5 - AX, 62 * CHUNK + 5 - AY)).toEqual([200, 10, 10]);
    expect(worldColorAt(w, 35 * CHUNK + 6 - AX, 62 * CHUNK + 5 - AY)).toEqual([70, 65, 40]);
    delete w.wangScenes; // no lane = the old law
    expect(worldColorAt(w, 35 * CHUNK + 5 - AX, 62 * CHUNK + 5 - AY)).toEqual([70, 65, 40]);
  });

  test("a scene's background_file paints the bin AIR cells only", () => {
    const w = mkWorld();
    const { x: AX, y: AY } = L3_ANCHOR;
    const m = w.maps.get("a").rgb;
    m[0] = 13; m[1] = 14; m[2] = 18; // cell (0,0) = bin air (airDark)
    w.wangScenes = new Map([["bg", new Map([["35,62", sceneBuf(33)]])]]);
    expect(wangSceneBgAt(w, 35 * CHUNK, 62 * CHUNK)).toEqual([33, 33, 33]);
    expect(worldColorAt(w, 35 * CHUNK + 2 - AX, 62 * CHUNK + 2 - AY)).toEqual([33, 33, 33]); // air cell
    expect(worldColorAt(w, 35 * CHUNK + 12 - AX, 62 * CHUNK + 2 - AY)).toEqual([70, 65, 40]); // soil cell
  });
});
