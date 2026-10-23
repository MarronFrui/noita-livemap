// world-gen.mjs contracts: virtual canvas, area/chunk mapping, seralized
// per-area cache format, chunk sampling. Requires extracted data for full
// world loads; worldColorAt runs against an injected world (no data).

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
    const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i");
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
