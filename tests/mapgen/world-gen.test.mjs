// world-gen.mjs contracts: virtual canvas, area/chunk mapping, seralized
// per-area cache format, chunk sampling. Requires extracted data for full
// world loads; worldColorAt runs against an injected world (no data).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, test, expect, afterAll } from "vitest";
import {
  CHUNK, WORLD_CHUNKS_W, WORLD_CHUNKS_H, SKY_ROWS, WORLD_W, WORLD_H,
  loadWangWorld, worldColorAt, ensureWorld, areaKey, L3_ANCHOR, binAnchor,
} from "../../mapgen/lib/world-gen.mjs";
import { blitBackdrop } from "../../mapgen/lib/template-render.mjs";
import { writePng } from "../../mapgen/lib/images.mjs";
import { dataDir, hasNoitaData, CAPTURE_SEED, repoRoot } from "../helpers/data.mjs";
import { biomeByName } from "../helpers/golden.mjs";
import { releaseWorld } from "../helpers/world.mjs";

// ONE in-process world per file (memory law, 2026-11-08): an ensureWorld()
// world WAS ~4.6 GB RSS (renderTemplateWorld's 4643 eager template chunk
// buffers ≈ 3.8 GB; lazy since chunk-store.mjs, ~0.6 GB). Five separate builds in
// the singleFork worker plus child-process probes holding their own copy
// drove the battery to an OOM kill (exit 137) and starved the whole WSL VM
// (the VS Code server lost its ptyHost heartbeat). Every in-process test
// shares this one world; only probes that need module-load env flags
// (SURFACE_V3=1) still spawn a child, and they run BEFORE the shared world
// exists (the dig #177 describe sits above the cached-generation describe).
const SHARED_CACHE_DIR = path.join(repoRoot, "mapgen/out/gen-cache/r3o");
let _sharedWorld = null;
const sharedWorld = async () => {
  _sharedWorld ??= ensureWorld(CAPTURE_SEED, dataDir, { cacheDir: SHARED_CACHE_DIR, onProgress: () => {} });
  await _sharedWorld.ready;
  return _sharedWorld;
};
afterAll(() => { releaseWorld(_sharedWorld); _sharedWorld = null; });

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

  test("C192 the bin anchor per area: +5 + 10·frac(c·51.2) on each axis (dig #222)", () => {
    expect(binAnchor({ area: { x1: 35, y1: 14 } })).toEqual({ x: 5, y: 13 }); // 1792 exact / 716.8
    expect(binAnchor({ area: { x1: 34, y1: 15 } })).toEqual({ x: 13, y: 5 }); // 1740.8 / 768 exact
    expect(binAnchor({ area: { x1: 36, y1: 17 } })).toEqual({ x: 7, y: 9 }); // 1843.2 / 870.4
  });

  test("samples the area map with 1 atlas px = 10 world px scale (the C192 per-area anchor)", () => {
    const w = mkWorld();
    const { x: AX, y: AY } = binAnchor(w.areas[0]); // (5, 13)
    // back-shifted display: display origin − anchor samples content exactly at
    // the area's world origin: biome (35,14) -> canvas (35, 62) -> world (17920, 31744)
    expect(worldColorAt(w, 35 * CHUNK - AX, 62 * CHUNK - AY)).toEqual([1, 2, 3]);
    expect(worldColorAt(w, 35 * CHUNK + 15 - AX, 62 * CHUNK + 5 - AY)).toEqual([4, 5, 6]); // cell x=1
    expect(worldColorAt(w, 35 * CHUNK + 5 - AX, 62 * CHUNK + 15 - AY)).toEqual([7, 8, 9]); // cell y=1
    // unshifted display reads content 5/13 px further = atlas cell (0,1)
    // (the C78 constant (11,12) read cell (1,1) = [10,11,12] here)
    expect(worldColorAt(w, 35 * CHUNK, 62 * CHUNK)).toEqual([7, 8, 9]);
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
    expect(worldColorAt(w, 40, 100)).toBeNull();
    const buf = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    const o = 3 * (100 * CHUNK + 40);
    buf[o] = 120; buf[o + 1] = 121; buf[o + 2] = 122;
    w.templates.set("0,0", buf);
    // dig #170 (C145): the template lane reads at the DISPLAY frame —
    // cell (40,100) of chunk "0,0" shows at display (40,100). The pre-#170
    // generator-local read sampled local (51,112) here (9 -> null) and
    // returned this color at (40-11, 100-12) — both old-law coordinates
    // fail the pins below.
    expect(worldColorAt(w, 40, 100)).toEqual([120, 121, 122]);
    expect(worldColorAt(w, 40 - 11, 100 - 12)).toBeNull(); // old-law coord: local (29,88) = unset
  });

  test("C145 frame law (dig #170): the template lane reads at the DISPLAY frame in both branches", () => {
    const w = mkWorld();
    // underground branch: chunk "40,62" = the game-frame origin (0,0) via
    // setWorldPx's +35/+62 map; art pixel (0,0) writes local (0,0).
    const buf = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    buf[0] = 10; buf[1] = 20; buf[2] = 30; // art (0,0)
    w.templates.set("40,62", buf);
    expect(worldColorAt(w, 40 * CHUNK, 62 * CHUNK)).toEqual([10, 20, 30]);
    // fail-under-old: the generator-local read samples local (11,12)
    const buf11 = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    const o11 = 3 * (12 * CHUNK + 11);
    buf11[o11] = 77; buf11[o11 + 1] = 78; buf11[o11 + 2] = 79;
    w.templates.set("40,62", buf11);
    expect(worldColorAt(w, 40 * CHUNK, 62 * CHUNK)).toBeNull(); // old law: [77, 78, 79]
    // sky branch (ty < 62): art pixel (7,5) of chunk "0,10"
    const sky = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    const os = 3 * (5 * CHUNK + 7);
    sky[os] = 55; sky[os + 1] = 56; sky[os + 2] = 57;
    w.templates.set("0,10", sky);
    expect(worldColorAt(w, 7, 10 * CHUNK + 5)).toEqual([55, 56, 57]); // old law: local (18,17) = 9 -> null
  });

  // dig #210 (entry (210), I49): the worldColorAt arm-order pins the obs-1
  // fix touches. Each test names whether it SURVIVES the fix (the arm the
  // fix keeps) or is CONSCIOUSLY REVISED with it (the fix commit replaces it
  // with a test that FAILS under this law's arithmetic).
  test("bin material px: raw rgb returned AND it beats the template lane (I49 pre-fix pin, survives)", () => {
    const w = mkWorld();
    const buf = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    buf[0] = 77; buf[1] = 78; buf[2] = 79; // template sentinel at display local (0,0)
    w.templates.set("35,62", buf);
    // display (35*512, 62*512) -> generator (+5,+13) (C192) = atlas cell (0,1) = [7,8,9]
    // (non-airDark ⇒ the wang terrain); the bin lane precedes the template
    // lane, so the sentinel [77,78,79] must NOT surface (old-law order:
    // template first ⇒ [77,78,79]).
    expect(worldColorAt(w, 35 * CHUNK, 62 * CHUNK)).toEqual([7, 8, 9]);
  });

  test("bin airDark px with no backdrop source (no def.filename, then no dataDir) leaks the raw rgb (I49 pre-fix pin, the bd-null arm)", () => {
    const w = mkWorld();
    const m = w.maps.get("coalmine_29_14");
    m.rgb[0] = 13; m.rgb[1] = 14; m.rgb[2] = 18; // atlas cell (0,0) = the airDark family
    const an = binAnchor(w.areas[0]);
    const at = () => worldColorAt(w, 35 * CHUNK - an.x, 62 * CHUNK - an.y);
    // guard 1: no declared bg filename -> biomeBackdrop null (world-gen.mjs:22)
    expect(at()).toEqual([13, 14, 18]);
    // guard 2: filename declared but world.dataDir unset -> still null
    w.areas[0].def = { filename: "data/biomes/coalmine.xml" };
    expect(at()).toEqual([13, 14, 18]);
  });

  test("fg template art beats the noise lane (order: bin material -> template -> noise; survives)", () => {
    const w = mkWorld();
    // canvas chunk (36,63) has no area on the grid (only (35,62) is set)
    const buf = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    const o = 3 * (5 * CHUNK + 7);
    buf[o] = 44; buf[o + 1] = 45; buf[o + 2] = 46;
    w.templates.set("36,63", buf);
    w.noiseSolidAt = () => 1; // the noise lane would claim the cell if consulted first
    w.noiseMatAt = () => null;
    expect(worldColorAt(w, 36 * CHUNK + 7, 63 * CHUNK + 5)).toEqual([44, 45, 46]);
  });

  test("noise-air routing (dig #177 C151 sky law / C109 per-area bg): generator row 62 -> skyAt, row 63 -> bgImageAt", () => {
    const w = mkWorld();
    w.noiseSolidAt = () => 0; // everything air
    w.noiseMatAt = () => null;
    w.skyAt = () => [90, 90, 90];
    w.bgImageAt = () => [70, 70, 70];
    // wy = row*512 − 12 puts the generator row exactly at the row edge
    expect(worldColorAt(w, 39 * CHUNK, 62 * CHUNK - L3_ANCHOR.y)).toEqual([90, 90, 90]);
    expect(worldColorAt(w, 39 * CHUNK, 63 * CHUNK - L3_ANCHOR.y)).toEqual([70, 70, 70]);
  });

  // dig #212 (C184, the backdrop CLIP law, 0x72c180): a row-62 air cell
  // renders the BACKDROP at world y >= the biome's background_image_height
  // (default 225.0f) and the SKY above it; a limit-off biome renders the
  // backdrop at every height; the limit_y edge sprite fills
  // [height − edge.h, height). The display row 62 starts at world y 0.
  describe("dig #212 backdrop clip law (row 62)", () => {
    const Y0 = 62 * CHUNK; // display y of world y 0
    const mk = (backdrop) => {
      const w = mkWorld();
      w.noiseSolidAt = () => 0; // all air
      w.noiseMatAt = () => null;
      w.noiseAt = () => ({ backdrop });
      w.skyAt = () => [90, 90, 90];
      w.bgImageAt = () => [70, 70, 70];
      return w;
    };
    test("limit on (default 225): world y 300 = BACKDROP (fails under the dig-#177 all-sky law), world y 100 = SKY", () => {
      const w = mk({ limit: true, height: 225, edge: null });
      expect(worldColorAt(w, 39 * CHUNK, Y0 + 300)).toEqual([70, 70, 70]);
      expect(worldColorAt(w, 39 * CHUNK, Y0 + 100)).toEqual([90, 90, 90]);
    });
    test("the boundary is the height itself: y = 224 sky, y = 225 backdrop", () => {
      const w = mk({ limit: true, height: 225, edge: null });
      expect(worldColorAt(w, 39 * CHUNK, Y0 + 224)).toEqual([90, 90, 90]);
      expect(worldColorAt(w, 39 * CHUNK, Y0 + 225)).toEqual([70, 70, 70]);
    });
    test("limit off (coalmine/liquidcave/pyramid): the backdrop at world y 10 (fails under the all-sky law)", () => {
      const w = mk({ limit: false, height: 225, edge: null });
      expect(worldColorAt(w, 39 * CHUNK, Y0 + 10)).toEqual([70, 70, 70]);
    });
    test("the limit_y edge sprite sits on [height − edge.h, height), composited over the sky by its alpha", () => {
      const ew = 512, eh = 31;
      const px = new Uint8Array(4 * ew * eh);
      for (let i = 0; i < ew * eh; i++) { px[4 * i] = 200; px[4 * i + 3] = 255; }
      const w = mk({ limit: true, height: 225, edge: { w: ew, h: eh, pixels: px } });
      expect(worldColorAt(w, 39 * CHUNK + 5, Y0 + 194)).toEqual([200, 0, 0]);
      expect(worldColorAt(w, 39 * CHUNK + 5, Y0 + 224)).toEqual([200, 0, 0]);
      expect(worldColorAt(w, 39 * CHUNK + 5, Y0 + 193)).toEqual([90, 90, 90]);
    });
    test("no backdrop record = the default law (limit on, 225): the sky above, the bg lane below", () => {
      const w = mk(null);
      w.noiseAt = () => null;
      expect(worldColorAt(w, 39 * CHUNK, Y0 + 50)).toEqual([90, 90, 90]);
      expect(worldColorAt(w, 39 * CHUNK, Y0 + 400)).toEqual([70, 70, 70]);
    });
  });

  // dig #211 (the winter-band rows law): the surface band's SKY-row rows
  // (bty 6..13 = display 54..61) carry the winter/mountain noise band, and
  // its cell decisions run the SAME classify-or-air law the ty >= 62 arm
  // runs (the dig-#208 law). The classify's miss (idx 255 / unresolvable)
  // = AIR — under the previous law every mask-solid sky-row cell painted
  // the flat unclassified noiseColor (0x6a5a44), the over-fill class.
  test("dig #211: a sky-row (ty<62) mask-solid cell whose classify misses = AIR (fails under the flat-fill law)", () => {
    const w = mkWorld();
    // canvas (17,61) = a bty13 sky-row chunk; the probe lands on the
    // noise-solid path with the classify missing
    w.noiseSolidAt = () => 1;
    w.noiseMatAt = () => ({ idx: 255, names: null });
    // old law: noiseColor(..., null) = [106,90,68] returned here
    expect(worldColorAt(w, 17 * CHUNK + 5, 61 * CHUNK + 5)).toBeNull();
  });

  // --- I49 (dig #210 obs-1 fix): the background_file fg/bg plane split ------
  // The real write path: a 2×2 opaque airDark PNG (the right_stub_background
  // color family) blitted through blitBackdrop at a game-frame origin.
  // Frames: setWorldPx keys game (wx,wy) at canvas chunk floor(w/512)+(+35,+62)
  // with local = w mod 512; worldColorAt reads the DISPLAY frame, so canvas =
  // game + (35*512, 62*512). Game (2567,5) -> key "40,62" local (7,5) ->
  // canvas (40*512+7, 62*512+5); mkWorld's grid has an area only at (35,62),
  // so chunk (40,62) has no bin lane (grid -1).
  const blitFixtureBg = (buffers, wx, wy) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dig210-i49-"));
    try {
      fs.mkdirSync(path.join(dir, "fixture"), { recursive: true });
      writePng(path.join(dir, "fixture", "bg.png"), 2, 2,
        Buffer.from([13, 14, 18, 255, 13, 14, 18, 255, 13, 14, 18, 255, 13, 14, 18, 255]));
      return blitBackdrop(buffers, dir, "data/fixture/bg.png", wx, wy);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  test("I49 fix: blitBackdrop writes the bg plane (not the fg buffer) and the bg surfaces for scene air (fails under old law)", () => {
    const buffers = new Map();
    expect(blitFixtureBg(buffers, 2567, 5)).toBe(4); // 2x2 opaque px kept
    const bg = buffers.get("bg");
    expect(bg).toBeInstanceOf(Map);
    const o = 3 * (5 * CHUNK + 7);
    expect([bg.get("40,62")[o], bg.get("40,62")[o + 1], bg.get("40,62")[o + 2]]).toEqual([13, 14, 18]);
    // old law: the px landed in the FG buffer (and no "bg" plane existed) —
    // the fg lane then returned them pre-noise at every scene cell
    expect(buffers.get("40,62")).toBeUndefined();
    // contract: at the scene-air cell (no bin, no fg art, no noise lane) the
    // bg plane now surfaces the backdrop color instead of null
    const w = mkWorld();
    w.templates = buffers;
    expect(worldColorAt(w, 40 * CHUNK + 7, 62 * CHUNK + 5)).toEqual([13, 14, 18]);
  });

  test("I49 fix: the bg plane is air-only — the noise lane still wins (fails under old law: bg-as-fg preempted noise)", () => {
    const buffers = new Map();
    blitFixtureBg(buffers, 2567, 5);
    const w = mkWorld();
    w.templates = buffers;
    w.noiseSolidAt = () => 1; // the noise evaluator solids every cell
    w.noiseMatAt = () => null;
    // noiseColor(62, solid) = the provisional surface shade 0x6a5a44;
    // old law (px in the fg buffer): the fg lane returned [13,14,18] pre-noise
    expect(worldColorAt(w, 40 * CHUNK + 7, 62 * CHUNK + 5)).toEqual([106, 90, 68]);
  });

  test("I49 fix: fg template art beats the bg plane at the same cell (contract)", () => {
    const buffers = new Map();
    blitFixtureBg(buffers, 2567, 5);
    const fg = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    const o = 3 * (5 * CHUNK + 7);
    fg[o] = 44; fg[o + 1] = 45; fg[o + 2] = 46;
    buffers.set("40,62", fg);
    const w = mkWorld();
    w.templates = buffers;
    expect(worldColorAt(w, 40 * CHUNK + 7, 62 * CHUNK + 5)).toEqual([44, 45, 46]);
  });

  test("dig #227 (replaces I49's sky-band clause): the bg plane shows over the sky band when no fg art / terrain owns the px", () => {
    const buffers = new Map();
    // game y -507 -> canvas chunk row 61 (floor(-507/512) = -1 -> 61), local 5
    blitFixtureBg(buffers, 2567, -507);
    const w = mkWorld();
    w.templates = buffers;
    // I49's clause returned null (the sky) here; the capture shows the init
    // LoadBackgroundSprite art in the sky-band rows (the pyramid hallway
    // 53_13: exact px 2,337 → 30,550; 11 tiles 449,278 → 517,165, ABOUT (227))
    expect(worldColorAt(w, 40 * CHUNK + 7, 61 * CHUNK + 5)).toEqual([13, 14, 18]);
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

describe.skipIf(!hasNoitaData())("surface-band sky (dig #177) — the row-62 air renders the SKY, not the cave backdrop", () => {
  // dig #177 port (world-gen.mjs: the noise lane's air branch): the AIR
  // cell of canvas row 62 (display y 0..511 = the surface band; capture
  // Y14 = the C151 frame + SKY_ROWS=48) renders the SKY (black + stars,
  // the C110 NIGHT law); rows >= 63 keep the cave backdrop (the C109
  // per-area bg). M-grade anchor: the capture census ref/39_13..39_19 =
  // black 237,697 / 21,669 / 0 / 0 / 0 / 0 px (repro: the family census
  // per tile). Count laws (child probe, SURFACE_V3=1; the flags are
  // module-load captured, and the singleFork worker env is set by other
  // suites):
  //   C1: tile (39,62) black px >= 1000 — FAILS under the old law (the
  //       row-62 air fell through to bgImageAt = the hills'
  //       background_cave_04_alt — non-black; verified fail-under-old
  //       this session: port reverted ⇒ the probe measures black62 = 0).
  //   C2: tile (39,63) black px = 0 — pins the measured sky/cave
  //       boundary (the capture's Y15+ tiles carry zero black); an
  //       over-broad fix (the sky leaking below the band) fails this.
  //   C3: tile (39,61) (the sky-band row above, ty < 62 — the lane this
  //       dig does NOT touch) keeps its sky: black >= 100,000 px — a
  //       regression guard on the edit's blast radius.
  const probe = `
    process.env.SURFACE_V3 = "1";
    const { findNoitaDataDir, repoRoot } = await import(process.env.PROBE_REPO + "/mapgen/lib/paths.mjs");
    const { ensureWorld, worldColorAt } = await import(process.env.PROBE_REPO + "/mapgen/lib/world-gen.mjs");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dataDir = findNoitaDataDir();
    const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3o");
    const world = ensureWorld(78633191, dataDir, { cacheDir, onProgress: () => {} });
    await world.ready;
    const isBlack = (c) => !c || (c[0] < 3 && c[1] < 3 && c[2] < 3);
    let black61 = 0, black62 = 0, black63 = 0;
    for (let j = 0; j < 512; j++) {
      for (let i = 0; i < 512; i++) {
        if (isBlack(worldColorAt(world, 39 * 512 + i, 61 * 512 + j))) black61++;
        if (isBlack(worldColorAt(world, 39 * 512 + i, 62 * 512 + j))) black62++;
        if (isBlack(worldColorAt(world, 39 * 512 + i, 63 * 512 + j))) black63++;
      }
    }
    process.stdout.write(JSON.stringify({ black61, black62, black63 }));
  `;
  const run = () => {
    const env = { ...process.env, PROBE_REPO: repoRoot };
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      env, encoding: "utf8", cwd: repoRoot, timeout: 240000,
    });
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(r.stdout);
  };
  let s = null;
  const stats = () => (s ??= run());

  test("C1: the surface-band tile (39,62) renders sky (black) — >= 1000 px (old law: 0)", () => {
    expect(stats().black62).toBeGreaterThanOrEqual(1000);
  });

  test("C2: the sky stops at the band — tile (39,63) renders 0 black px (the cave backdrop below)", () => {
    expect(stats().black63).toBe(0);
  });

  test("C3: the sky-band row above (39,61) keeps its sky — black >= 100,000 px (regression guard)", () => {
    expect(stats().black61).toBeGreaterThanOrEqual(100000);
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
  afterAll(() => { if (world !== _sharedWorld) releaseWorld(world); world = null; });

  test("loads all areas from the disk cache", async () => {
    if (!cacheDir) return; // no cached seed — cold gen out of scope for the battery
    // The I36 yield law (closed with entry (173)): ensureWorld MUST yield
    // per area on BOTH branches — the cache-HIT path's old contiguous
    // span (342 readFileSync in one sync block; 64.2/70.4/70.6 s measured
    // per battery run on 2026-10-20) starved the single-fork worker's
    // birpc channel, and every `Timeout calling "onTaskUpdate"` battery
    // abort landed at that span's end. Count the scheduled ticks: ≥1 per
    // area proves the load interleaves with the event loop instead of
    // blocking it for the whole span (other setImmediate users in the
    // window only add ticks, so the lower bound never false-fails).
    let ticks = 0;
    const origSetImmediate = globalThis.setImmediate;
    globalThis.setImmediate = (fn, ...args) => { ticks++; return origSetImmediate(fn, ...args); };
    try {
      world = ensureWorld(CAPTURE_SEED, dataDir, { cacheDir });
      if (cacheDir === SHARED_CACHE_DIR) _sharedWorld ??= world; // reuse it file-wide
      await world.ready;
    } finally {
      globalThis.setImmediate = origSetImmediate;
    }
    expect(ticks).toBeGreaterThanOrEqual(world.areas.length);
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

  test("dig #216 (C187): the Hell west wall's tongues follow the biome-edge law in the render", async () => {
    if (!cacheDir || !world) return;
    // the wall family (rock_hard / rock_hard_border textures: R ≥ 35, G ≥ 19)
    const isWall = (c) => !!c && c[0] >= 35 && c[1] >= 19;
    const win = (x0, x1, y0, y1) => {
      let n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isWall(worldColorAt(world, x, y))) n++;
      return n;
    };
    // capture edge at wy 70160 = line − 36: a the_end tongue INSIDE the wall
    // chunk (old law: the chunk's wall fill = 35/35)
    expect(win(27 * 512 - 33, 27 * 512 - 27, 70158, 70162)).toBeLessThanOrEqual(12);
    // capture edge at wy 72080 = line + 34: a wall tongue INSIDE the_end's
    // chunk (old law: the Work lane's interior, ~20% wall-family)
    expect(win(27 * 512 + 27, 27 * 512 + 32, 72078, 72082)).toBeGreaterThanOrEqual(22);
    // control: deep inside the wall chunk = all wall under both laws
    expect(win(26 * 512 + 200, 26 * 512 + 206, 70158, 70162)).toBe(35);
  });

  test("dig #218 (I53): a main-band solid_wall tongue inside the lake_deep chunk renders as rock", async () => {
    if (!cacheDir || !world) return;
    // the rock family is red-dominant (rock_hard / rock_hard_border textures);
    // lake water (39,67,63) is teal — the dig-#216 predicate (R ≥ 35, G ≥ 19)
    // would count it, so this pin uses R > G
    const isRock = (c) => !!c && c[0] >= 35 && c[0] > c[1];
    const win = (x0, x1, y0, y1) => {
      let n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isRock(worldColorAt(world, x, y))) n++;
      return n;
    };
    // the solid_wall | lake_deep line at x 2048 (map row 18): at map y 9624 the
    // law pushes the wall 33 px into the lake chunk (old law: the lake's own
    // wang fill = 0/45 rock)
    expect(win(2062, 2076, 34199, 34201)).toBeGreaterThanOrEqual(40);
    // controls: the lake interior stays lake, the wall interior stays wall
    expect(win(2300, 2314, 34199, 34201)).toBe(0);
    expect(win(1800, 1814, 34199, 34201)).toBe(45);
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

// default-lane attach contract (user report 2026-10-15, "no more sky
// background"): worldColorAt's sky band (ty < 62) falls through to
// `world.skyAt?.() ?? null`, and C110's sky law (VERIFIED §12 p2c) is
// written unconditionally — so skyAt/bgImageAt must attach WITHOUT the
// SURFACE_* flags. Under the pre-fix law both were undefined in the
// default lane (every sky/void/bin-less px = null → the tile renderer's
// opaque black; seed 78633191 tiles z0(34,14)/z1(17,28..29) measured
// 100% black / 512×512 px). DIG #192 PRODUCT FLIP (2026-10-23): the flip
// is INVERTED — the band is ON by default (the C165/C166 byte-backed
// port ships); the OUT = SURFACE_V3=0/2=0 (the instrument baselines).
// The probe runs as a child process with SURFACE_* stripped: noise-
// terrain.mjs captures the flags at module load and the singleFork
// worker's env is set by other suites (surface-compositor.test.mjs:13
// sets SURFACE_V3).
describe("default lane (no SURFACE_* flags) — attach noise-terrain contract", () => {
  const probe = `
    const { attachNoiseTerrain } = await import(process.env.PROBE_REPO + "/mapgen/lib/noise-terrain.mjs");
    const w = attachNoiseTerrain({ config: null }, null, 0);
    process.stdout.write(JSON.stringify({
      sky: typeof w.skyAt, bg: typeof w.bgImageAt,
      solid: typeof w.noiseSolidAt, mask: typeof w.noiseAt, mat: typeof w.noiseMatAt,
    }));
  `;
  const run = () => {
    const env = { ...process.env, PROBE_REPO: repoRoot };
    delete env.SURFACE_V2;
    delete env.SURFACE_V3;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      env, encoding: "utf8", cwd: repoRoot,
    });
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(r.stdout);
  };

  test("skyAt + bgImageAt attach unconditionally (the pre-fix law left them undefined → null → black sky)", () => {
    const s = run();
    expect(s.sky).toBe("function");
    expect(s.bg).toBe("function");
  });

  test("the noise band is ON by default (the dig #192 product flip — C165/C166: the byte-backed port ships); the out-lane = SURFACE_V3=0/2=0 explicitly", () => {
    // default (env stripped) = attached:
    const s = run();
    expect(s.solid).toBe("function");
    expect(s.mask).toBe("function");
    expect(s.mat).toBe("function");
    // explicit opt-out = the old detached lane (the instrument baselines):
    const env0 = { ...process.env, PROBE_REPO: repoRoot, SURFACE_V2: "0", SURFACE_V3: "0" };
    const r0 = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      env: env0, encoding: "utf8", cwd: repoRoot,
    });
    expect(r0.status, r0.stderr).toBe(0);
    const s0 = JSON.parse(r0.stdout);
    expect(s0.solid).toBe("undefined");
    expect(s0.mask).toBe("undefined");
  });
});

describe.skipIf(!hasNoitaData())("default lane sky color (data-gated)", () => {
  // NIGHT law (2026-10-19, I32 amended): the sky band = BLACK air (null)
  // + hash-placed stars at EVERY altitude. Fail-under-old-law pins: the
  // old parallax-row law returned the gold horizon (254,206,108) at
  // t=0.9766 and the blue rows (100,168,198 family) at t=0.094 (both
  // non-null ⇒ the toBeNull asserts fail), and its t<0.75 star gate
  // excluded the horizon scan band entirely (pale star count = 0).
  test("skyAt = the NIGHT law: null at the horizon and high sky; stars present below t=0.75", () => {
    const env = { ...process.env, PROBE_REPO: repoRoot, PROBE_DATA: dataDir };
    delete env.SURFACE_V2;
    delete env.SURFACE_V3;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
      const { attachNoiseTerrain } = await import(process.env.PROBE_REPO + "/mapgen/lib/noise-terrain.mjs");
      const w = attachNoiseTerrain({ config: null }, process.env.PROBE_DATA, 0);
      const lum = (c) => 0.299*c[0] + 0.587*c[1] + 0.114*c[2];
      const pale = (c) => Math.abs(c[0] - c[2]) < 60 && lum(c) >= 60;
      let stars = 0;
      for (let gx = 8700; gx < 9212; gx++) for (let gy = 31000; gy < 31744; gy += 4) {
        const c = w.skyAt(17, 60, gx, gy);
        if (c && pale(c)) stars++;
      }
      process.stdout.write(JSON.stringify({
        horizon: w.skyAt(17, 60, 8800, 31000), // t = 31000/31744 = 0.9766 (old: gold)
        high: w.skyAt(17, 1, 8800, 3000),      // t = 0.094 (old: blue rows)
        stars,                                  // old: 0 (the t<0.75 gate excluded the band)
      }));
    `], { env, encoding: "utf8", cwd: repoRoot });
    expect(r.status, r.stderr).toBe(0);
    const s = JSON.parse(r.stdout);
    expect(s.horizon).toBeNull();
    expect(s.high).toBeNull();
    expect(s.stars).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasNoitaData())("winter-band rows law (dig #211) — the surface band's sky-row rows classify, never the flat noiseColor", () => {
  // dig #211 (the classify-or-air law at the sky-band rows; bty 6..13 =
  // display rows 54..61 = the mask's winter/mountain noise band): the OLD
  // law painted EVERY mask-solid sky-row cell the flat unclassified
  // (106,90,68) — measured (METER-CLASS: E1, the lane attribution, repro
  // mapgen/experiments/2026-11-03-dig211-lane-attribution.mjs): the winter
  // tile (17,61) = 75.7% solid with 73.2% flat vs the capture's 40.7%.
  // The fix (world-gen.mjs, the ty < 62 arm) = the classify (the ty>=62
  // arm's law) + the miss = air. Fail-under-old: the flat family's share
  // at (17,61) was 73.2% and must now be ~0.
  test("tile (17,61) carries no flat noiseColor px (old law: 73.2%)", async () => {
    const world = await sharedWorld();
      let flat = 0, n = 0;
      for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) {
        const c = worldColorAt(world, 17 * 512 + x, 61 * 512 + y);
        n++;
        if (c && c[0] === 106 && c[1] === 90 && c[2] === 68) flat++;
      }
      expect(n).toBeGreaterThan(0);
      expect(flat / n).toBeLessThan(0.005);
    });
  });
  describe.skipIf(!hasNoitaData())("backdrop clip law (dig #212, C184) — data-gated", () => {
    // The parser carries the clip pair with the byte-read ctor defaults
    // (0x495ecf: 225.0f, 0x495ed9: 1) and the shipped overrides.
    test("defs: empty.xml = the defaults (limit on, 225); coalmine.xml = limit off; liquidcave.xml = height 0 + limit off", async () => {
      const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
      const config = loadBiomeConfig(dataDir);
      const find = (f) => [...config.biomes.values()].find((d) => d?.filename?.endsWith(f));
      const empty = find("/empty.xml"), coal = find("/coalmine.xml"), liq = find("/liquidcave.xml");
      expect(empty).toBeTruthy();
      expect(empty.limitBackgroundImage).toBe(true);
      expect(empty.backgroundImageHeight).toBe(225);
      expect(coal.limitBackgroundImage).toBe(false);
      expect(liq.backgroundImageHeight).toBe(0);
      expect(liq.limitBackgroundImage).toBe(false);
    });
    // The count law (E1, entry (212)): the capture's bty-14 tiles carry 0
    // sky px below world y 240 in every limit-on biome. Tile 15 = the
    // empty.xml chasm under the bridge (all air): the old all-sky law
    // rendered 130,066 black px there below y 240; the capture has 0 and
    // 98,619 above y 225.
    // in-process on the shared world (it was a child probe: a second world build)
    let s = null;
    const stats = () => (s ??= (async () => {
    const world = await sharedWorld();
    const isBlack = (c) => !c || (c[0] < 3 && c[1] < 3 && c[2] < 3);
    let above = 0, below = 0;
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      if (isBlack(worldColorAt(world, 15 * 512 + i, 62 * 512 + j))) { if (j < 225) above++; else if (j >= 240) below++; }
    }
    return { above, below };
  })());
  test("tile (15,62): 0 black px below world y 240 (old law: 130,066)", async () => {
    expect((await stats()).below).toBe(0);
  }, 240000);
  test("tile (15,62): the sky above the height stays — >= 90,000 black px above y 225 (capture 98,619)", async () => {
    expect((await stats()).above).toBeGreaterThanOrEqual(90000);
  }, 240000);
});

describe.skipIf(!hasNoitaData())("cell colour law in the noise band (dig #213, C185) — data-gated", () => {
  // The noise band paints the material TEXTURE at the world pixel, never the
  // raw wang_color. Tile (38,62) (the tree-west cell, I51's anchor): the old
  // law painted (53,57,35) 43.6% + (82,79,45) 41.5% there; the capture's
  // 38_14 families are rock.png (39,40,45)/(62,69,85) + earth.png
  // (70,65,40)/(95,87,49).
  // in-process on the shared world (it was a child probe: a second world build)
  let s = null;
  const stats = () => (s ??= (async () => {
    const world = await sharedWorld();
    let raw = 0, rock = 0, earth = 0;
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const c = worldColorAt(world, 38 * 512 + i, 62 * 512 + j); if (!c) continue;
      const k = c.join(",");
      if (k === "53,57,35" || k === "82,79,45") raw++;
      if (k === "39,40,45" || k === "62,69,85") rock++;
      if (k === "70,65,40" || k === "95,87,49") earth++;
    }
    return { raw, rock, earth };
  })());
  test("tile (38,62): 0 px of the raw wang_color pair (old law: 85.1% of the tile)", async () => {
    expect((await stats()).raw).toBe(0);
  }, 240000);
  test("tile (38,62): the rock.png and earth.png families each cover >= 25% of the tile (old law: (70,65,40) 1.6%, (39,40,45) ~0)", async () => {
    const st = await stats();
    expect(st.rock).toBeGreaterThanOrEqual(0.25 * 262144);
    expect(st.earth).toBeGreaterThanOrEqual(0.25 * 262144);
  }, 240000);
});

// THE SKY-BAND FIX (2026-11-08, biome rows 0..13 = canvas 48..61: the band
// between the Work's heaven end and the surface — clouds, the static sky
// rooms, the floating island, the mountain tree). Count laws on the capture
// seed; every pin FAILS under the old law (measured on HEAD 2026-11-08,
// old values in the titles).
describe.skipIf(!hasNoitaData())("sky band (biome rows 0..13) — the cloud / static-room / roadblock / art-colour laws", () => {
  const share = async (tx, ty) => {
    const world = await sharedWorld();
    const m = new Map(); let n = 0;
    for (let j = 0; j < 512; j += 2) for (let i = 0; i < 512; i += 2) {
      const c = worldColorAt(world, tx * 512 + i, ty * 512 + j);
      const k = !c || (c[0] < 3 && c[1] < 3 && c[2] < 3) ? "sky" : c.join(",");
      m.set(k, (m.get(k) ?? 0) + 1); n++;
    }
    return (k) => (m.get(k) ?? 0) / n;
  };

  test("clouds (6,50): air = the sky (C184: limit-on backdrop never above world y 225), cloud = (48,48,52) (old: navy backdrop 80 %, cloud 0)", async () => {
    const s = await share(6, 50);
    expect(s("sky")).toBeGreaterThanOrEqual(0.7); // capture 0.764
    expect(s("48,48,52")).toBeGreaterThanOrEqual(0.18); // capture 0.223
    expect(s("12,16,25")).toBe(0);
  }, 240000);

  test("roadblock (33,59): a BIOME_WANG_TILE with no template generates no terrain — all sky (old: sky 5 %)", async () => {
    expect((await share(33, 59))("sky")).toBeGreaterThanOrEqual(0.99); // capture 1.000
  }, 240000);

  test("potion_mimics (30,51): the bg mask's black px = sky, the solids = templeslab.png (old: sky 0, backdrop 56 %, templeslab 0)", async () => {
    const s = await share(30, 51);
    expect(s("sky")).toBeGreaterThanOrEqual(0.6);
    expect(s("78,67,67")).toBeGreaterThanOrEqual(0.03); // templeslab.png's main colour
  }, 240000);

  test("the mountain tree (31,60): wood_tree paints its C185 texture, never the flat fallback grey (old: (90,90,95) 55 % + (80,80,85) 22 %)", async () => {
    const s = await share(31, 60);
    expect(s("90,90,95") + s("80,80,85")).toBe(0);
  }, 240000);
});

describe.skipIf(!hasNoitaData())("image-spawned scenes (the spliced tree's spawn_pillars) — 2026-11-08", () => {
  test("tree.png's 0xc2d0b4 px runs mountain_tree.lua spawn_pillars: 6 pillars × (1 under + fade + 3 above + end) with no persistent flags (old: none)", async () => {
    const world = await sharedWorld();
    const pillars = world.imageSpawnLog.filter((c) => c.fn === "spawn_pillars");
    expect(pillars.length).toBe(36);
    expect(new Set(pillars.map((c) => c.x)).size).toBe(6);
    // the pillar art paints over the sky above the tree (world y −1399..−1159 = canvas row 59)
    let px = 0;
    for (let j = 0; j < 512; j += 2) for (let i = 0; i < 512; i += 2) {
      const c = worldColorAt(world, 31 * 512 + i, 59 * 512 + j);
      if (c && c[2] > c[0] + 20) px++; // the teal pillar_part art
    }
    expect(px).toBeGreaterThan(100);
  }, 240000);
});

// dig #227: the template background plane (init LoadBackgroundSprite art)
// shows over the SKY band too — the old law returned the sky (null) there.
describe("worldColorAt — the template bg plane in the sky band (dig #227, no data)", () => {
  test("a sky-band px with no fg art reads the bg plane before the sky", () => {
    const world = {
      grid: new Int16Array(WORLD_CHUNKS_W * WORLD_CHUNKS_H).fill(-1),
      errors: new Map(), templates: new Map(), maps: new Map(), areas: [], ready: Promise.resolve(),
    };
    const bg = new Uint8Array(CHUNK * CHUNK * 3).fill(9);
    bg.set([26, 26, 36], 3 * (100 * CHUNK + 100));
    world.templates.set("bg", new Map([["53,61", bg]]));
    expect(worldColorAt(world, 53 * CHUNK + 100, 61 * CHUNK + 100)).toEqual([26, 26, 36]);
    expect(worldColorAt(world, 53 * CHUNK + 101, 61 * CHUNK + 100)).toBeNull(); // unset = the sky (no skyAt here)
  });
});

// dig #230: the backdrop is sampled at the DISPLAY px (the capture's phase
// (0,0), 4/4 pyramid tiles exact) — the bin-air read used the per-area
// sample point (+5..13 px) and so drew the backdrop shifted.
describe("worldColorAt — the bin-air backdrop phase (dig #230, no data)", () => {
  test("a bin-air cell shows backdrop px (wx mod w, wy mod h), not the anchor-shifted one", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bgph-"));
    const pixels = new Uint8Array(4 * 4 * 4); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) pixels.set([x, y, 200, 255], 4 * (y * 4 + x));
    writePng(path.join(dir, "bgphase.png"), 4, 4, pixels);
    const world = {
      grid: new Int16Array(WORLD_CHUNKS_W * WORLD_CHUNKS_H).fill(-1),
      errors: new Map(), templates: new Map(), maps: new Map(), ready: Promise.resolve(), dataDir: dir,
    };
    const rgb = Buffer.alloc(3 * 52 * 52); for (let p = 0; p < rgb.length; p += 3) { rgb[p] = 13; rgb[p + 1] = 14; rgb[p + 2] = 18; } // all bin air
    world.grid[63 * WORLD_CHUNKS_W + 36] = 0;
    world.areas = [{ key: "a", def: { filename: `data/biome/bgphase-${Date.now()}.xml`, backgroundImage: "data/bgphase.png" }, area: { x1: 36, y1: 15 }, w: 52, h: 52 }];
    world.maps.set("a", { w: 52, h: 52, attempt: 0, rgb });
    const wx = 36 * CHUNK + 101, wy = 63 * CHUNK + 102;
    expect(worldColorAt(world, wx, wy)).toEqual([wx % 4, wy % 4, 200]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// dig #231 (C185 per pixel in the bin lane): an explicit solid material cell
// = its texture at the DISPLAY px, varying inside the 10-px cell (the old
// law: one colorized colour for the whole cell).
describe.skipIf(!hasNoitaData())("worldColorAt — per-pixel C185 for solid bin cells (dig #231)", () => {
  test("a wood_static cell shows wood's texture px by px", async () => {
    const { materialColorAt, materialColorByName } = await import("../../mapgen/lib/colorize.mjs");
    const [wr, wg, wb] = materialColorByName(dataDir, "wood_static");
    const world = {
      grid: new Int16Array(WORLD_CHUNKS_W * WORLD_CHUNKS_H).fill(-1),
      errors: new Map(), templates: new Map(), maps: new Map(), rawMaps: new Map(), ready: Promise.resolve(), dataDir,
    };
    world.grid[63 * WORLD_CHUNKS_W + 36] = 0;
    world.areas = [{ key: "a", def: {}, area: { x1: 36, y1: 15 }, w: 52, h: 52 }];
    const col = Buffer.alloc(3 * 52 * 52, 77), raw = Buffer.alloc(3 * 52 * 52);
    for (let p = 0; p < raw.length; p += 3) { raw[p] = wr; raw[p + 1] = wg; raw[p + 2] = wb; }
    world.maps.set("a", { w: 52, h: 52, attempt: 0, rgb: col });
    world.rawMaps.set("a", { w: 52, h: 52, attempt: 0, rgb: raw });
    const seen = new Set();
    for (let k = 0; k < 10; k++) {
      const wx = 36 * CHUNK + 200, wy = 63 * CHUNK + 200 + k; // wood = horizontal planks: vary y
      const c = worldColorAt(world, wx, wy);
      expect(c).toEqual(materialColorAt(dataDir, "wood_static", wx - 35 * CHUNK, wy - 62 * CHUNK));
      seen.add(c.join());
    }
    expect(seen.size).toBeGreaterThan(1); // varies inside one cell (old law: one colour [77,77,77])
  });
});

// dig #232: a grey placeholder bin cell painted with the soil family is
// coloured per pixel by the biome's material whose texture holds that
// family's dominant colour (coalmine: (70,65,40) ⇒ sand_static / earth.png).
describe.skipIf(!hasNoitaData())("worldColorAt — placeholder cells take the matching material's texture (dig #232)", () => {
  test("coalmine soil-family cell = sand_static's texture px by px (old law: the hashed family colour)", async () => {
    const { materialColorAt } = await import("../../mapgen/lib/colorize.mjs");
    const world = {
      grid: new Int16Array(WORLD_CHUNKS_W * WORLD_CHUNKS_H).fill(-1),
      errors: new Map(), templates: new Map(), maps: new Map(), rawMaps: new Map(), ready: Promise.resolve(), dataDir,
    };
    world.grid[63 * WORLD_CHUNKS_W + 36] = 0;
    world.areas = [{ key: "a", def: { filename: "data/biome/coalmine.xml" }, area: { x1: 36, y1: 15 }, w: 52, h: 52 }];
    const col = Buffer.alloc(3 * 52 * 52), raw = Buffer.alloc(3 * 52 * 52, 200); // raw = grey 200
    for (let p = 0; p < col.length; p += 3) { col[p] = 89; col[p + 1] = 83; col[p + 2] = 59; } // a soil-family shade
    world.maps.set("a", { w: 52, h: 52, attempt: 0, rgb: col });
    world.rawMaps.set("a", { w: 52, h: 52, attempt: 0, rgb: raw });
    for (let k = 0; k < 12; k++) {
      const wx = 36 * CHUNK + 150 + 3 * k, wy = 63 * CHUNK + 160 + k;
      expect(worldColorAt(world, wx, wy)).toEqual(materialColorAt(dataDir, "sand_static", wx - 35 * CHUNK, wy - 62 * CHUNK));
    }
  });
});
