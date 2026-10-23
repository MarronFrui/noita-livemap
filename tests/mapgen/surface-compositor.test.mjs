// tests/mapgen/surface-compositor.test.mjs — the art-first surface-band
// compositor count tests (the E1-class pins):
//   #130 — the per-cell material classify (matNames + matIdx + wang_color);
//   #131 — the read-window law (sky band all-air; the mines chunk stable);
//   #132 — the per-area background law (the def carries its Topology
//          backgroundImage; the loader tiles it as the chunk backdrop).
// Data-dependent: skips without the game data. The lane flags are
// module-load consts — set the env BEFORE the dynamic imports.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// dig #145 (measured leak): composed-content.test.mjs sets SURFACE_V2=1 at
// module load; when both files land in the same vitest worker the leak
// re-routes hills (41,62) from THIS suite's V3-only caves lane (2409 solids,
// byte-identical pre/post dig #145) to the V2 lane (2436) — the pin fails
// for infrastructure, not law. Clear the leak: this suite pins the V3-ONLY
// lane (the dig-#131 read-window law).
delete process.env.SURFACE_V2;
process.env.SURFACE_V3 = "1";

const DATA_DIR = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const hasData = fs.existsSync(DATA_DIR + "/scripts");

// ONE world per file (dig #168): ensureWorld()'s CALL is one contiguous SYNC
// span — renderTemplateWorld (world-gen.mjs:277) PLUS the eager readFileSync
// cache load (readCache per area inside the world.ready map, 342 .bin files).
// Three per-file rebuilds put that span under a pending worker->host RPC reply
// and tripped vitest single-fork's 60 s birpc window (`Timeout calling
// "onTaskUpdate"`, the I36 class — battery deaths at the art-crust test, dig
// #168). Same seed 78633191 + same dataDir ⇒ byte-identical world; sharing
// removes the two redundant rebuilds. Assertions unchanged.
let sharedWorld = null;
async function getWorld() {
  if (!sharedWorld) {
    const { ensureWorld } = await import("../../mapgen/lib/world-gen.mjs");
    sharedWorld = ensureWorld(78633191, DATA_DIR, { onProgress: () => {} });
  }
  await sharedWorld.ready;
  return sharedWorld;
}

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
    const airCells = [...r.mask].filter((v) => v === 0).length;
    // both sides: classified materials exist (≠ flat slab), air exists
    // (≠ the full-solid wall) — flips if the compositor regresses.
    expect(classified).toBeGreaterThan(1000);
    expect(airCells).toBeGreaterThan(100);
    expect(classified + airCells).toBeLessThanOrEqual(52 * 52);
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
    // bounds-check ⇒ air. FAILS under the old mod-wrap (which painted the
    // field's mass rows into the sky).
    for (const ty of [49, 55, 60]) {
      const r = noiseChunkMask(cfg, 41, ty, 78633191);
      expect(r).not.toBeNull();
      expect([...r.mask].filter((v) => v).length).toBe(0);
      expect([...r.matIdx].filter((v) => v !== 255).length).toBe(0);
    }
    // ty 62 = the mines band's first chunk (world rows ≥ 0): unchanged
    const r62 = noiseChunkMask(cfg, 41, 62, 78633191);
    expect([...r62.mask].filter((v) => v).length).toBe(2501); // dig #193 re-pin (was 2409): the shaped read (warp + smoothstep snap)
    expect([...r62.matIdx].filter((v) => v !== 255).length).toBe(2501);
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
    // The dig-#178 E1 law: C153's byte truth is that the sampler's air arm
    // stamps ONLY on v < 0 (the [0, 0.5] cells stay unmarked base fill) —
    // and on our data the field never reaches v < 0, so that arm is inert.
    // This is the load-bearing reason the ported gate (`v >= 0 ⇒ solid`)
    // had to be REVERTED: it marked the whole band solid (row-62 sky
    // 28,323 → 946 vs the capture's 21,669, §8 row 62).
    // dig #185 (C158): countNeg === 0 is the PERMANENT law for the caves
    // field — every setter/blend stamp writes `scale ≥ 0`, so the field
    // cannot go negative (byte-proven). The earlier "make countNeg > 0"
    // contract is RETRACTED as impossible: C153's `v < 0` air arm is inert
    // on this field, and the sampler reads a DIFFERENT field (the gradient).
    expect(countNeg).toBe(0);
    // the [0, 0.5] band carries mass ⇒ the flip was never a no-op
    expect(countLE05).toBeGreaterThan(0);
  });

  test("the NIGHT sky law (2026-10-19, I32 amended): the sky band = black air + stars at every altitude; the mines band unchanged", async () => {
    const { worldColorAt } = await import("../../mapgen/lib/world-gen.mjs");
    const world = await getWorld();
    // the high sky = plain air (null). The OLD parallax law returned the
    // blue rows (100,168,198 family) here ⇒ fails under the old law.
    const high = worldColorAt(world, 35 * 512 + 256, 1 * 512 + 10);
    expect(high).toBeNull();
    // the horizon row (t = 0.977): plain air. The OLD law sampled the
    // parallax png's bottom rows = gold (254,206,108) ⇒ non-null ⇒ fails.
    const horizon = worldColorAt(world, 48 * 512 + 256, 31000);
    expect(horizon).toBeNull();
    // the warm share over the desert sky window: ~0 now (stars are pale,
    // art is absent at these rows); the OLD law = gold ≈ 0.98 ⇒ fails.
    let n = 0, warm = 0;
    for (let x = 0; x < 512; x += 2) for (let wy = 31000; wy < 31744; wy += 8) {
      const c = worldColorAt(world, 48 * 512 + x, wy);
      n++;
      if (c && c[0] >= 200 && c[0] - c[2] >= 60) warm++;
    }
    expect(n).toBeGreaterThan(0);
    expect(warm / n).toBeLessThan(0.05);
    // the stars at EVERY altitude (the old t<0.75 gate excluded the
    // horizon band): pale sprite px exist across the sky band — standing
    // pin (the pale rule excludes the old gold AND the ice-blue silhouette)
    let stars = 0;
    for (let ty = 5; ty < 55; ty++) for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) {
      const c = worldColorAt(world, 40 * 512 + x, ty * 512 + y);
      if (c && c[0] > 200 && c[1] > 200 && c[2] > 230) stars++;
    }
    expect(stars).toBeGreaterThan(100);
    // the mines band's first chunk: the terrain's shaped count (dig #193 re-pin; was 2409)
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const cfg2 = (await import("../../mapgen/lib/biomes.mjs")).loadBiomeConfig(DATA_DIR);
    const r62 = noiseChunkMask(cfg2, 41, 62, 78633191);
    expect([...r62.mask].filter((v) => v).length).toBe(2501);
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
    // the blitted art (non-9 pixels) — the first cut's `dynamic > 0` gate
    // skipped the whole blit (the pyramid's init has unresolvable callsites
    // mixed with the static ones); this pin FAILS under that gate.
    // ensureWorld ALREADY ran renderTemplateWorld into world.templates
    // (world-gen.mjs:277 — same fn, same dataDir, same seed 78633191 ⇒
    // byte-identical output). The explicit SECOND render that used to live
    // here was a ~49 s sync span immediately after a microtask-only gap —
    // the recipe that trips vitest single-fork's 60 s worker-RPC timeout
    // (`Timeout calling "onTaskUpdate"`, the I36 class, measured 48783 ms
    // cold by mapgen/experiments/2026-10-18-splice-chunk-equiv.mjs, dig
    // #168). Read the world's copy; both halves of this test now read the
    // SAME template layer (worldColorAt probes below read world too).
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
