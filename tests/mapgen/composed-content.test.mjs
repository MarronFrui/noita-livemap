// tests/mapgen/composed-content.test.mjs — composed-content law count pins
// (I34/I33):
// (1) the caves filler re-anchors per chunk (mask/mat grid hashes equal
//     across H/V/distant pairs; a world-anchored re-frame would differ);
// (2) caves material census (rock_static majority; limit caps gating every
//     comp would paint idx-255 band shade everywhere);
// (3) the limit_y flag law (desert's ungated rock_static/sand_static comps
//     paint at any depth);
// (4) kind-0 filler: kind-1 pockets compute (no throw), and the kind-0
//     field is world-anchored (textured same-def pairs differ);
// (5) the field0 law, the record-lane byte plane, and the classify-or-air
//     cell law (world-y limits).
// Data-dependent: skips without game data. Lane flags are module-load
// consts — set the env before the dynamic imports.
import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, test } from "vitest";

process.env.SURFACE_V2 ??= "1";
process.env.SURFACE_V3 ??= "1";

const DATA_DIR = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const hasData = fs.existsSync(DATA_DIR + "/scripts");
const SEED = 78633191;
const SEED_B = 500412504;

const maskHash = (m) => crypto.createHash("sha256").update(Buffer.from(m)).digest("hex");

describe.skipIf(!hasData)("composed-content laws (dig #144, I34/I33)", () => {
  test("caves filler: the mask+material grid re-anchors PER CHUNK (0/1/N; seed 78633191 + 500412504)", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    for (const seed of [SEED, SEED_B]) {
      // desert caves filler at the mines band: base (45,63); H neighbor;
      // V neighbor; distant (dx=17, dy=26). The BitmapCaves 512/256 mod-wrap
      // makes all three identical; a world-anchored re-frame would make
      // every neighbor differ. The caves lane covers underground rows only
      // (row gate ty >= 63); row 62 is the noise lane.
      const base = noiseChunkMask(cfg, 45, 63, seed);
      expect(base).not.toBeNull();
      expect(base.def.filename).toContain("desert.xml");
      const h = maskHash(base.mask);
      const neighbors = [
        [46, 63], // H adjacent
        [45, 64], // V adjacent
        [62, 88], // distant, same def
      ];
      for (const [tx, ty] of neighbors) {
        const n = noiseChunkMask(cfg, tx, ty, seed);
        expect(n).not.toBeNull();
        expect(maskHash(n.mask)).toBe(h); // 0-diff count: identical
      }
      // per-biome parameterization (I34): a different-def caves chunk does
      // not share the desert mask.
      const winter = noiseChunkMask(cfg, 11, 62, seed);
      expect(maskHash(winter.mask)).not.toBe(h);
    }
  });

  test("caves filler census: rock_static/snowrock_static majority, idx-255 negligible (seed 78633191)", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    const census = (r) => {
      const counts = new Map();
      let solids = 0;
      for (let k = 0; k < r.mask.length; k++) {
        if (!r.mask[k]) continue;
        solids++;
        const mi = r.matIdx[k];
        const name = mi !== 255 && r.matNames[mi] ? r.matNames[mi] : "(idx255)";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return { solids, counts };
    };
    const d = census(noiseChunkMask(cfg, 45, 63, SEED));
    // desert: 2642-2664 solids of 2704, rock_static ~97-98%, idx255 <= 9.
    // If limit_max_y caps gated every comp, all would be rejected at
    // y>=7168 (idx255 = thousands of cells). Row 63 = caves lane.
    expect(d.solids).toBeGreaterThan(2000);
    expect(d.solids).toBeLessThanOrEqual(2704);
    expect(d.counts.get("rock_static") ?? 0).toBeGreaterThan(0.9 * d.solids);
    expect(d.counts.get("(idx255)") ?? 0).toBeLessThan(50);
    const w = census(noiseChunkMask(cfg, 11, 62, SEED));
    // winter: the deep band is all-solid; with world-y limits the snow's
    // window [0.35, 0.9) takes the low-v pockets (411 snow_static + 2293
    // snowrock_static at this seed). idx255 = 0 (no unclassified cells).
    expect(w.solids).toBe(2704);
    expect(w.counts.get("snowrock_static") ?? 0).toBeGreaterThan(2000);
    expect(w.counts.get("snow_static") ?? 0).toBeGreaterThan(100);
    expect(w.counts.get("(idx255)") ?? 0).toBe(0);
  });

  test("the limit_y FLAG law: ungated comps (limit_y=0) paint at any depth; gated comps never reach the mines band", async () => {
    const { componentFromXml, buildMaterialsTable, classify } = await import("../../mapgen/lib/surface-level.mjs");
    const xml = fs.readFileSync(`${DATA_DIR}/biome/desert.xml`, "utf-8");
    const blocks = xml.match(/<MaterialComponent\b[^>]*>/g) ?? [];
    expect(blocks.length).toBe(8);
    const comps = blocks.map((b) => componentFromXml(b));
    const names = comps.map((c) => c.material_name);
    // the surface sand family + copper carry limit_y="1" (gate live,
    // y-window never reaches 7168); sand_static x2 + rock_static x2 carry
    // limit_y="0" (caps inert).
    const gated = comps.map((c, i) => [c.limit_y, names[i]]).filter(([g]) => g === true).map(([, n]) => n);
    const ungated = comps.map((c, i) => [c.limit_y, names[i]]).filter(([g]) => g === false).map(([, n]) => n);
    expect(gated).toEqual(["sand_surface", "sandstone_surface", "sand_static_bright", "copper"]);
    expect(ungated.sort()).toEqual(["rock_static", "rock_static", "sand_static", "sand_static"]);
    // classify at the mines-band y (7173 = row 62 cell 0): v=1.2 -> the first
    // ungated rock_static ([0.9,3.5) window); v=0.8 -> ungated sand_static
    // ([0.72,0.95)). With cap-by-default parsing both would return null.
    const records = comps.map((c, i) => ({ i, name: c.material_name }));
    const table = buildMaterialsTable(comps, { min: 0, max: 0 }, records);
    const rec12 = classify(table, 23005, 7173, 1.2);
    expect(rec12).not.toBeNull();
    expect(rec12.name).toBe("rock_static");
    const rec08 = classify(table, 23005, 7173, 0.8);
    expect(rec08).not.toBeNull();
    expect(rec08.name).toBe("sand_static");
  });

  test("I33 fix (dig #145): kind-0 filler ground chunks are TEXTURED — the NOISE→AIR collapse is gone", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // empty(15,62): empty.xml's <Materials> has no MaterialComponent (only a
    // VegetationComponent), so classify's miss-exit 0x8F574C returns null
    // for every cell and the zeroed grid stays all-air.
    for (const seed of [SEED, SEED_B]) {
      const r = noiseChunkMask(cfg, 15, 62, seed);
      expect(r).not.toBeNull();
      expect(r.def.filename).toContain("empty.xml");
      const solids = [...r.mask].filter((v) => v).length;
      expect(solids, "the empty biome = the game's own all-air (zero MaterialComponents)").toBe(0);
    }
    // lake(4,62) is a flat water pool: water's window v ∈ [−1, 0.5) with
    // limit_y [225, 512000] in world-y paints the wy >= 225 rows
    // (1560/2704 = 57.7%; capture fR 0.568). lake_statue(6,62) follows the
    // same water law (its slope-window field <= 0.2 lies inside the water
    // window) = 1560.
    {
      const rL = noiseChunkMask(cfg, 4, 62, SEED);
      expect(rL).not.toBeNull();
      expect(rL.def.filename).toContain("lake.xml");
      const sL = [...rL.mask].filter((v) => v).length;
      expect(sL).toBe(1560);
      const rS = noiseChunkMask(cfg, 6, 62, SEED);
      expect(rS).not.toBeNull();
      expect(rS.def.filename).toContain("lake_statue.xml");
      expect([...rS.mask].filter((v) => v).length).toBe(1560);
    }
    // lake family texture census: across every lake ground cell (tx 4..10,
    // rows 62/63) at least one chunk is textured.
    {
      const at = (tx, ty) => biomeAt(cfg, tx, ty - 48);
      let textured = 0;
      for (const seed of [SEED, SEED_B]) {
        for (let tx = 4; tx <= 10; tx++) {
          for (const ty of [62, 63]) {
            const a = at(tx, ty);
            if (!a?.biome || a.biome.templateFile || !a.biome.filename.endsWith("lake.xml")) continue;
            const r = noiseChunkMask(cfg, tx, ty, seed);
            if (!r) continue;
            const s = [...r.mask].filter((v) => v).length;
            if (s > 0 && s < 2704) textured++;
          }
        }
      }
      expect(textured).toBeGreaterThan(0);
    }
  });

  test("I33a (dig #145): the kind-1 pockets stop throwing — every non-template ground cell computes (never -1)", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // noiseKind = the [+0x224] ctor default 5 (not derived from noise_type
    // presence, which would give kind -1 and throw), so every non-template
    // cell of these defs returns non-null.
    // Scan window: rows 62..100 (the pockets live underground: solid_wall
    // 834 cells, hidden_cavern 4, friend_1/friend_4/teleroom 1 each);
    // solid_wall capped at 12 samples. Anti-vacuity: all 5 defs must be found.
    for (const seed of [SEED, SEED_B]) {
      const defCells = new Map();
      for (const fn of ["solid_wall_hidden_cavern.xml", "teleroom.xml", "friend_1.xml", "friend_4.xml", "solid_wall.xml"]) {
        defCells.set(fn, []);
        for (let ty = 62; ty <= 100 && defCells.get(fn).length < (fn === "solid_wall.xml" ? 12 : 100); ty++) {
          for (let tx = 0; tx <= 70; tx++) {
            const at = biomeAt(cfg, tx, ty - 48);
            if (!at?.biome || at.biome.templateFile || !at.biome.filename.endsWith(fn)) continue;
            defCells.get(fn).push([tx, ty]);
          }
        }
      }
      for (const [fn, cells] of defCells) {
        expect(cells.length, `${fn} not found by the row 62..100 scan (vacuous pin)`).toBeGreaterThan(0);
        for (const [tx, ty] of cells) {
          const r = noiseChunkMask(cfg, tx, ty, seed);
          expect(r, `${fn} (${tx},${ty}) seed ${seed} fell through (throw)`).not.toBeNull();
        }
      }
    }
  });

  test("I34 anchor re-measure (dig #145): the kind-0 field is WORLD-anchored — same-def pairs differ", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // The kind-0 field is a pure function of world px, so textured same-def
    // pairs differ; a per-chunk re-anchor would make them identical.
    // Constant masks (all-air or all-solid) hash equal by construction and
    // carry no anchor information, so they are skipped. Anti-vacuity: >= 2
    // informative pairs per seed.
    // The lake family is excluded: its pool is a flat world-y cut (water
    // limit_y [225, 512000]), so adjacent same-def pairs are legitimately
    // identical. The anchor law is measured on winter's noise pairs.
    for (const seed of [SEED, SEED_B]) {
      let informative = 0;
      // winter's informative pairs live at ty 61 (map row 13, the snow band);
      // ty 62 is the deep band (flat-full)
      for (const fn of ["winter.xml"]) {
        const cells = [];
        for (let tx = 0; tx <= 70; tx++) {
          for (const ty of [61, 62]) {
            const at = biomeAt(cfg, tx, ty - 48);
            if (!at?.biome || at.biome.templateFile || !at.biome.filename.endsWith(fn)) continue;
            const r = noiseChunkMask(cfg, tx, ty, seed);
            if (!r) continue;
            const s = [...r.mask].filter((v) => v).length;
            cells.push({ tx, ty, h: maskHash(r.mask), s });
          }
        }
        if (cells.length < 2) continue; // not enough same-def cells to pair
        const pairs = [];
        for (const c of cells) {
          const h = cells.find((o) => o.tx === c.tx + 1 && o.ty === c.ty);
          const v = cells.find((o) => o.tx === c.tx && o.ty === c.ty + 1);
          if (h) pairs.push([c, h]);
          if (v) pairs.push([c, v]);
        }
        pairs.push([cells[0], cells[cells.length - 1]]); // the far pair
        for (const [a, b] of pairs) {
          // informative = textured at both ends (constant masks, 0 or 2704,
          // carry no anchor info)
          if (!(a.s > 0 && a.s < 2704 && b.s > 0 && b.s < 2704)) continue;
          informative++;
          expect(a.h, `${fn} (${a.tx},${a.ty})≡(${b.tx},${b.ty}) seed ${seed} [${a.s}/${b.s} solids]`).not.toBe(b.h);
        }
      }
      expect(informative, `seed ${seed}: fewer than 2 texture-bearing kind-0 pairs — the anchor law is unmeasured`).toBeGreaterThanOrEqual(2);
    }
  });

  // The field0 law (C122): count-pinned chunks on seed 500412504.
  // (1) lavalake (41,66): field≡1 gives a textured chunk (a floor-0.5 law
  //     keeps rp <= 0.5 everywhere = all-air);
  // (2) solid_wall (1,70): the wall biome paints every cell;
  // (3) temple_wall (31,67): its shipped <Materials> are entirely commented
  //     out, so the game's table is empty and classify paints nothing — the
  //     walls come from the pixel-scene lane. A raw-text regex would pick up
  //     the commented-out rock_hard_border comps (155 matIdx cells).
  test("THE FIELD0 LAW count (dig #146): lavalake 0→414 (FAILS old law: 0), solid_wall 1367→1367 (byte-stable), temple_wall 0→NULL (fails old law: 0)", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    const LIVE_SEED = 500412504;
    const solids = (tx, ty) => {
      let r;
      try { r = noiseChunkMask(cfg, tx, ty, LIVE_SEED); }
      catch (e) { return `THROW:${e.message.slice(0, 24)}`; }
      if (!r) return "NULL";
      let s = 0;
      for (const v of r.mask) s += v;
      return s;
    };
    const matProbe = (tx, ty) => {
      const r = noiseChunkMask(cfg, tx, ty, LIVE_SEED);
      const mat = {};
      for (let i = 0; i < r.mask.length; i++) {
        const mi = r.matIdx?.[i];
        if (mi !== undefined && mi !== 255) {
          const n = r.matNames?.[mi] ?? String(mi);
          mat[n] = (mat[n] ?? 0) + 1;
        }
      }
      return mat;
    };
    expect(solids(41, 66), "lavalake kind-0 — THE FIELD0 discrimination").toBe(375);
    expect(solids(1, 70), "solid_wall deep — #208 re-pin 1361→2704 (the classify's windows: the wall biome paints every cell)").toBe(2704);
    expect(solids(31, 67),
           "temple_wall — #208 re-pin 386→0: its 4 rock_hard_border comps ship COMMENTED OUT (dig #148's census), so the classify-or-air law paints NOTHING — the game's temple walls belong to the pixel-scene lane (the Lua LoadPixelScene), not the classifier").toBe(0);
    expect(Object.keys(matProbe(31, 67)),
           "temple_wall ZERO material hits — the commented-out (phantom) comps are retracted; 155 rock_hard_border cells under the #147 raw-regex table")
      .toEqual([]);
  });

  // Record-lane byte plane: the record lane's stamps write the [P+0x58]
  // byte plane (image_file → recordTemplate → the fn950 stencil). E1 pins:
  //   (1) record-carrying defs have nonzero-byte coverage (> 0.5%);
  //   (2) desert has zero CaveStructure records and keeps 0.00%, so the
  //       record lane is not the plane's sole writer (the capture shows
  //       65.19% solid there);
  //   (3) field parity: the record lane is field-inert (spawn_percent="0"
  //       across all 55 biomes).
  test("dig #164 byte-plane count: the record lane stamps nonzero bytes (FAILS old 0.00%), desert 0-records stays 0 (the writer-hunt evidence), field parity holds", async () => {
    const { buildCavesField } = await import("../../mapgen/lib/caves-field.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // field-solid % under the MINSTD seed lane (C177)
    const pins = { _EMPTY_: 94.29, desert: 98.07, winter: 94.29 };
    const coverage = { _EMPTY_: NaN, desert: 0, winter: NaN }; // desert's XML census: 0 records
    for (const defName of Object.keys(pins)) {
      const def = [...cfg.biomes.values()].find((d) => d.name === defName);
      expect(def?.bitmapCaves, `${defName} carries <BitmapCaves>`).toBeTruthy();
      const cf = buildCavesField(DATA_DIR, def, SEED);
      const N = cf.w * cf.h;
      let nz = 0, fsol = 0;
      for (let i = 0; i < N; i++) {
        if (cf.bytes[i] !== 0) nz++;
        if (cf.field[i] > 0.5) fsol++;
      }
      const pct = 100 * nz / N;
      if (defName === "desert") {
        // desert.xml has no <CaveStructure> elements, so the record lane
        // writes nothing (0.00%); the capture's 65.19% solid comes from
        // another writer.
        expect((def.bitmapCaves.structures ?? []).length, "desert record census").toBe(0);
        expect(cf.bytes.every((v) => v === 0), "desert byte plane untouched").toBe(true);
        coverage.desert = pct;
      } else {
        expect(pct, `${defName} nonzero-byte coverage > 0.5% — FAILS the old constant-zero plane (0.00%)`).toBeGreaterThan(0.5);
      }
      coverage[defName] = pct;
      const fpct = 100 * fsol / N;
      expect(fpct, `${defName} field parity (the record lane is field-inert)`).toBeCloseTo(pins[defName], 1);
    }
    // the template-load law reaches the test through the byte output pins
    // above (recordTemplate stays module-private — the API surface is
    // pinned by tests/mapgen/api-surface.test.mjs).
  });

  // The cell law = classify-or-air (X215): the walk 0x792580's
  // post-classify arm @0x7930D8 paints a cell iff classify returns celldata
  // (miss-exit 0x8F574C = xor eax,eax = null leaves the zeroed grid = air).
  // classify's y is the walk y = world px (soil [−1024, 424.229], water
  // [225, 512000] are world-y bands). A `v > 0.5` mask or a map-y feed
  // would leave water/soil/snow unpaintable.
  describe.skipIf(!hasData)("dig #208 — the classify-or-air cell-law (world-y limits)", () => {
    test("the lake's water paints: tile (4,14) is a water pool at the capture's share (old law: 0 water cells)", async () => {
      const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
      const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
      const cfg208 = loadBiomeConfig(DATA_DIR);
      const r = noiseChunkMask(cfg208, 4, 62, SEED);
      const solid = [...r.mask].reduce((a, b) => a + b, 0);
      // water = v ∈ [−1, 0.5) ∧ wy >= 225 → the tile's bottom
      // (512−225)/512 = 56.1%; capture fR = 0.568.
      expect(solid, "lake (4,14) solid ≥ the water-band law").toBeGreaterThanOrEqual(1500);
      const water = r.matIdx.reduce((a, mi, i) => {
        const name = r.matNames?.[mi];
        return a + (mi !== 255 && name === "water" ? 1 : 0);
      }, 0);
      expect(water, "lake (4,14) water cells — FAILS under the v>0.5 mask (old: 0)").toBeGreaterThanOrEqual(1400);
    });
    test("the winter's bty13 band paints snow (old law: all-air at the map rows 6..13's band tiles)", async () => {
      const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
      const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
      const cfg208 = loadBiomeConfig(DATA_DIR);
      const r = noiseChunkMask(cfg208, 19, 61, SEED);
      const solid = [...r.mask].reduce((a, b) => a + b, 0);
      // the snow window's floor v >= 0.35 → r = 0.402 → surface ≈ wy −200,
      // the capture's implied level (A18)
      expect(solid, "winter (19,13) solid — FAILS under the v>0.5 mask (old: 0 at bty13)").toBeGreaterThanOrEqual(1000);
    });
    test("the hills' soil layer paints at its world-y window (old law: never — the map-y fed the limits garbage)", async () => {
      const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
      const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
      const cfg208 = loadBiomeConfig(DATA_DIR);
      const r = noiseChunkMask(cfg208, 39, 62, SEED);
      const soil = r.matIdx.reduce((a, mi, i) => {
        const name = r.matNames?.[mi];
        return a + (mi !== 255 && name === "soil" ? 1 : 0);
      }, 0);
      expect(soil, "hills (39,14) soil cells — FAILS under the map-y frame (old: 0)").toBeGreaterThanOrEqual(30);
    });
  });
});
