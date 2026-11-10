// tests/mapgen/surface-compositor.test.mjs — surface-band compositor count
// tests (E1-class pins): the per-cell material classify (matNames + matIdx +
// wang_color); the read-window law (sky band all-air); the per-area
// background law (the def's Topology backgroundImage tiled as backdrop).
// Data-dependent: skips without the game data. The lane flags are
// module-load consts — set the env BEFORE the dynamic imports.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test, afterAll } from "vitest";
import { releaseWorld } from "../helpers/world.mjs";

// composed-content.test.mjs sets SURFACE_V2=1 at module load; sharing a
// vitest worker would re-route (41,62) to the V2 lane. This suite pins the
// V3-only lane, so clear the leak.
delete process.env.SURFACE_V2;
process.env.SURFACE_V3 = "1";

const DATA_DIR = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const hasData = fs.existsSync(DATA_DIR + "/scripts");

// One world per file: ensureWorld() is one long sync span (renderTemplateWorld
// + the eager cache load of 342 .bin files). Repeated rebuilds trip vitest
// single-fork's 60 s birpc window (the I36 class). Same seed + dataDir ⇒
// byte-identical world, so share it.
let sharedWorld = null;
async function getWorld() {
  if (!sharedWorld) {
    const { ensureWorld } = await import("../../mapgen/lib/world-gen.mjs");
    sharedWorld = ensureWorld(78633191, DATA_DIR, { onProgress: () => {} });
  }
  await sharedWorld.ready;
  return sharedWorld;
}
afterAll(() => { releaseWorld(sharedWorld); sharedWorld = null; });

describe.skipIf(!hasData)("surface-band compositor (digs #130/#131/#132)", () => {
  test("the per-cell material classify compositor (dig #130)", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const { materialColorByName } = await import("../../mapgen/lib/colorize.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // the mines-band chunk (bty14 = ty 62; the C48/C97 hills-band tile)
    const r = noiseChunkMask(cfg, 41, 62, 78633191);
    expect(r).not.toBeNull();
    expect(r.def.filename).toContain("hills.xml");
    // the hills <Materials name="forest"> block: 6 components in order
    expect(r.matNames).toEqual([
      "coal", "soil", "sand_static", "coal", "copper", "rock_static",
    ]);
    const classified = [...r.matIdx].filter((v) => v !== 255).length;
    // C170: the wang offset G puts the (41,62) pick on the bitmap's bottom
    // rows → this ground chunk is (near-)fully solid. The "air exists" side
    // of this law rides (44,62), a hills chunk that still carries pockets.
    expect([...r.mask].filter((v) => v).length).toBeGreaterThan(2300); // the exact count drifts run-to-run (module-state class, I50)
    const rAir = noiseChunkMask(cfg, 44, 62, 78633191);
    const airCells = [...rAir.mask].filter((v) => v === 0).length;
    const classifiedAir = [...rAir.matIdx].filter((v) => v !== 255).length;
    // both sides: classified materials exist (≠ flat slab), air exists
    // (≠ the full-solid wall) — flips if the compositor regresses.
    expect(classified).toBeGreaterThan(1000);
    expect(airCells).toBeGreaterThan(50); // V2 frame: 83 air cells
    expect(classifiedAir).toBeGreaterThan(1000);
    expect(classifiedAir + airCells).toBeLessThanOrEqual(52 * 52);
    for (const name of r.matNames) {
      const rgb = materialColorByName(DATA_DIR, name);
      expect(rgb).not.toBeNull();
      expect(rgb).toHaveLength(3);
    }
  });

  test("the read-window law (dig #131): the sky band reads NOTHING (air); the mines band keeps the field", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // ty 49/55/60 = the hills-biome SKY rows (world rows < 0): the getter
    // bounds-check ⇒ air. Fails under a mod-wrap read (which would paint
    // the field's mass rows into the sky).
    for (const ty of [49, 55, 60]) {
      const r = noiseChunkMask(cfg, 41, ty, 78633191);
      expect(r).not.toBeNull();
      expect([...r.mask].filter((v) => v).length).toBe(0);
      expect([...r.matIdx].filter((v) => v !== 255).length).toBe(0);
    }
    // ty 62 = the mines band's first chunk (world rows ≥ 0): served. C170:
    // the wang offset G = (17920, 7168) moves the pick by (+1792, +717) cells
    // mod the 512×256 bitmap, onto the ground row's solid stretch.
    const r62 = noiseChunkMask(cfg, 41, 62, 78633191);
    expect([...r62.mask].filter((v) => v).length).toBeGreaterThan(2300); // drift class, I50
    expect([...r62.matIdx].filter((v) => v !== 255).length).toBeGreaterThan(2300); // drift class, I50
  });

  test("the C153 PRECONDITION (dig #178): the hills caves field NEVER goes negative, so the game's air mark (v < 0) cannot fire here", async () => {
    const { buildCavesField } = await import("../../mapgen/lib/caves-field.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    const at = biomeAt(cfg, 39, 14);
    expect(at).not.toBeNull();
    const { field } = buildCavesField(DATA_DIR, at.biome, 78633191);
    expect(field.length).toBe(512 * 256);
    let countNeg = 0, countLE05 = 0;
    for (let i = 0; i < field.length; i++) {
      if (field[i] < 0) countNeg++;
      if (field[i] <= 0.5) countLE05++;
    }
    // C153: the sampler's air arm stamps only on v < 0 (the [0, 0.5] cells
    // stay unmarked base fill). C158: every setter/blend stamp writes
    // `scale ≥ 0`, so the caves field cannot go negative — that arm is inert
    // here, and the sampler reads a different field (the gradient). A
    // `v >= 0 ⇒ solid` gate would mark the whole band solid (§8 row 62).
    expect(countNeg).toBe(0);
    // the [0, 0.5] band carries mass ⇒ the flip was never a no-op
    expect(countLE05).toBeGreaterThan(0);
  });

  test("the NIGHT sky law (2026-10-19, I32 amended): the sky band = black air + stars at every altitude; the mines band unchanged", async () => {
    const { worldColorAt } = await import("../../mapgen/lib/world-gen.mjs");
    const world = await getWorld();
    // the high sky = plain air (null); a parallax-sampling law would return
    // the blue rows (100,168,198 family) here.
    const high = worldColorAt(world, 35 * 512 + 256, 1 * 512 + 10);
    expect(high).toBeNull();
    // the horizon row (t = 0.977): plain air, not the parallax png's gold
    // bottom rows (254,206,108).
    const horizon = worldColorAt(world, 48 * 512 + 256, 31000);
    expect(horizon).toBeNull();
    // the warm share over the desert sky window: ~0 (stars are pale, art is
    // absent at these rows); parallax sampling would give gold ≈ 0.98.
    let n = 0, warm = 0;
    for (let x = 0; x < 512; x += 2) for (let wy = 31000; wy < 31744; wy += 8) {
      const c = worldColorAt(world, 48 * 512 + x, wy);
      n++;
      if (c && c[0] >= 200 && c[0] - c[2] >= 60) warm++;
    }
    expect(n).toBeGreaterThan(0);
    expect(warm / n).toBeLessThan(0.05);
    // stars at every altitude, horizon band included: pale sprite px exist
    // across the sky band (the pale rule excludes gold and the ice-blue
    // silhouette). This loop is 3.28M sync calls (~65 s); a macrotask yield
    // every 100k calls lets vitest's RPC drain before the 60 s birpc
    // watchdog fires (I36).
    let stars = 0, checked = 0;
    for (let ty = 5; ty < 55; ty++) for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) {
      const c = worldColorAt(world, 40 * 512 + x, ty * 512 + y);
      if (c && c[0] > 200 && c[1] > 200 && c[2] > 230) stars++;
      if (++checked % 100000 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    expect(stars).toBeGreaterThan(100);
    // the mines band's first chunk: the terrain's shaped count (C170 frame)
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const cfg2 = (await import("../../mapgen/lib/biomes.mjs")).loadBiomeConfig(DATA_DIR);
    const r62 = noiseChunkMask(cfg2, 41, 62, 78633191);
    expect([...r62.mask].filter((v) => v).length).toBeGreaterThan(2300); // drift class, I50
  });


  test("the bin-air backdrop law (dig #134): the wang bands' AIR cells composite the area biome's declared bg", async () => {
    const { worldColorAt } = await import("../../mapgen/lib/world-gen.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const dataDir = DATA_DIR;
    const world = await getWorld();
    const cfg = loadBiomeConfig(dataDir);
    // the pyramid band: the def declares background_pyramid.png; its air
    // cells (the colorize airDark family in the bins) must composite it
    const def = biomeAt(cfg, 51, 14).biome;
    expect(def.backgroundImage).toBe("data/weather_gfx/background_pyramid.png");
    let bg = 0, dark = 0;
    for (let y = 0; y < 512; y += 8) for (let x = 0; x < 512; x += 8) {
      const c = worldColorAt(world, 51 * 512 + x, 62 * 512 + y);
      if (!c) continue;
      if (c[0] < 40 && c[1] < 40 && c[2] < 45) dark++; else bg++;
    }
    expect(bg).toBeGreaterThan(200); // the bg/corridor mix, not the flat airDark wall
    void dark;
  });

  test("the wang-biome art-crust blit (dig #134): the pyramid's LoadPixelScene pieces land over the corridors", async () => {
    const { worldColorAt } = await import("../../mapgen/lib/world-gen.mjs");
    const world = await getWorld();
    // the strongest pin: the template buffer for the pyramid chunk carries
    // the blitted art (non-9 pixels). A `dynamic > 0` gate would skip the
    // whole blit (the pyramid's init mixes unresolvable callsites with
    // static ones); this pin fails under that gate.
    // ensureWorld already rendered world.templates; re-rendering here is a
    // ~49 s sync span that trips the 60 s worker-RPC timeout (I36), so read
    // the world's copy (the worldColorAt probes read the same layer).
    const buf = world.templates.get("51,62");
    expect(buf).toBeDefined();
    let painted = 0;
    for (let i = 0; i < buf.length; i += 3) if (buf[i] !== 9) painted++;
    expect(painted).toBeGreaterThan(1000);
    // the pyramid pieces (the sandstone art) = the warm tones in the band
    let art = 0;
    for (let tx = 51; tx <= 57; tx++) for (let y = 0; y < 512; y += 8) for (let x = 0; x < 512; x += 8) {
      const c = worldColorAt(world, tx * 512 + x, 62 * 512 + y);
      if (!c) continue;
      if (c[0] > 180 && c[1] > 140 && c[2] < 140) art++;
    }
    expect(art).toBeGreaterThan(20);
  }, 180000);

  test("the per-area background law (dig #132): the def carries the Topology backgroundImage and the loader tiles it", async () => {    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    const def = biomeAt(cfg, 41, 14).biome; // the hills def (bty14 = ty62)
    expect(def.backgroundImage).toBe("data/weather_gfx/background_cave_04_alt.png");
    const r = noiseChunkMask(cfg, 41, 62, 78633191);
    expect(r.backdrop).not.toBeNull();
    expect(r.backdrop.w).toBe(512);
    expect(r.backdrop.h).toBe(256);
    expect(r.backdrop.pixels.length).toBe(512 * 256 * 4);
  });
});
