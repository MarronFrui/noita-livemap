// tests/mapgen/composed-content.test.mjs — dig #144 (THE COMPOSED-CONTENT
// LAW, I34/I33) count pins: (1) the caves filler's PER-CHUNK re-anchor
// (the mask/mat grid hash equality across H/V/distant pairs — 0/1/N counts
// that FAIL under a world-anchored re-frame); (2) the caves material census
// (rock_static majority — FAILS under the old "limit caps always gate"
// arithmetic that would paint idx-255 band shade everywhere); (3) the
// limit_y FLAG law (the desert's ungated rock_static/sand_static comps
// paint at ANY depth; FAILS if limit_y parsing ever regresses to
// cap-by-default); (4) I33's kind-0 restoration (dig #145): the filler
// chunks are TEXTURED (0 < solids < 2704 — FAILS under the dig-#142
// all-air arithmetic that pinned 0), the kind-1 pockets stop throwing
// (FAILS under the kind=-1 throw law), and the kind-0 field is WORLD-
// anchored (same-def pairs differ — FAILS under the all-air/pre-fix
// identity and under any per-chunk re-anchor).
// Data-dependent: skips without the game data. Lane flags are module-load
// consts — set the env BEFORE the dynamic imports (surface-compositor
// convention).
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
      // => all THREE comparisons identical. A world-anchored re-frame (the
      // naive "continuity fix") makes every neighbor DIFFER — this test
      // fails under that arithmetic. dig #208: the caves-lane = the
      // UNDERGROUND's rows only (the attach's row-gate = the ty ≥ 63), so
      // the law's chunks live at the row 63+ (the row 62 = the noise lane).
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
      // the per-biome parameterization (I34's must-not-break clause): a
      // different-def caves chunk does NOT share the desert mask.
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
    // FAILS under the old arithmetic where limit_max_y caps gate every comp
    // (all comps rejected at y>=7168 => idx255 = thousands of cells).
    // dig #208: the row 63 = the UNDERGROUND's (the caves-lane's row-gate) —
    // the row 62 = the surface-band's noise lane (the classify's windows).
    expect(d.solids).toBeGreaterThan(2000);
    expect(d.solids).toBeLessThanOrEqual(2704);
    expect(d.counts.get("rock_static") ?? 0).toBeGreaterThan(0.9 * d.solids);
    expect(d.counts.get("(idx255)") ?? 0).toBeLessThan(50);
    const w = census(noiseChunkMask(cfg, 11, 62, SEED));
    // winter: the deep band = all-solid; with the WORLD-y limits live
    // (dig #208) the snow's window [0.35, 0.9) takes the low-v pockets
    // (411 snow_static + 2293 snowrock_static at this seed) — the old
    // "snowrock = EVERY solid" pin tracked the map-y feed where the limits
    // never matched. idx255 stays 0 (no unclassified cells).
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
    // the flag split (fresh read 2026-10-15): the SURFACE sand family +
    // copper carry limit_y="1" (gate live, y-window never reaches 7168);
    // sand_static x2 + rock_static x2 carry limit_y="0" (caps inert).
    const gated = comps.map((c, i) => [c.limit_y, names[i]]).filter(([g]) => g === true).map(([, n]) => n);
    const ungated = comps.map((c, i) => [c.limit_y, names[i]]).filter(([g]) => g === false).map(([, n]) => n);
    expect(gated).toEqual(["sand_surface", "sandstone_surface", "sand_static_bright", "copper"]);
    expect(ungated.sort()).toEqual(["rock_static", "rock_static", "sand_static", "sand_static"]);
    // classify at the mines-band y (7173 = row 62 cell 0): v=1.2 -> the first
    // ungated rock_static ([0.9,3.5) window); v=0.8 -> ungated sand_static
    // ([0.72,0.95)). FAILS if limit_y parsing regresses to cap-by-default
    // (both would return null => idx-255 band shade).
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
    // empty(15,62): **THE GAME'S OWN ALL-AIR PAINTER (dig #208 re-pin)** —
    // empty.xml's <Materials> contains NO MaterialComponent (the
    // VegetationComponent only, read fresh this dig) ⇒ the classify's
    // component walk has nothing to match ⇒ the miss-exit 0x8F574C returns
    // null for EVERY cell ⇒ the walk paints nothing ⇒ the untouched zeroed
    // grid = ALL-AIR. The dig-#145-era pins (2059/1996 "textured") were the
    // old v > 0.5 mask's artifact — the mask no longer decides, the
    // component windows do, and this biome has none. The name was the law.
    for (const seed of [SEED, SEED_B]) {
      const r = noiseChunkMask(cfg, 15, 62, seed);
      expect(r).not.toBeNull();
      expect(r.def.filename).toContain("empty.xml");
      const solids = [...r.mask].filter((v) => v).length;
      expect(solids, "the empty biome = the game's own all-air (zero MaterialComponents)").toBe(0);
    }
    // lake/lake_statue (the dig-#208 re-pin): the lake(4,62) chunk is the
    // flat water pool — the water's window v ∈ [−1, 0.5) with the limit_y
    // [225, 512000] in the WORLD-y frame = the wy ≥ 225 rows painted water
    // (1560/2704 = 57.7%; the capture's fR = 0.568 — the law reproduced).
    // lake_statue(6,62) = the SAME water law (its slope-window's field ≤
    // 0.2 rides INSIDE the water's window [−1, 0.5)) = 1560 — which is the
    // CAPTURE'S OWN reading (ref (6,14): fR 0.605, the statue island in the
    // pool, IoU 0.994). The dig-#145-era "0 is the byte law" pin tracked
    // the old v > 0.5 mask; the classifier's windows decide now.
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
    // the lake FAMILY's texture census (the M3 instrument's law): across
    // every lake ground cell (tx 4..10, rows 62/63) at least one chunk is
    // textured — pre-fix ALL were 0 (the NOISE→AIR collapse).
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
    // Pre-fix every non-template cell of these defs fell through (threw
    // `noiseDispatch: core kind=-1 UNREAD` — noiseKind sourced from the
    // noise_type presence). Post-fix noiseKind = the [+0x224] ctor default
    // 5 ⇒ no throw ⇒ non-null. FAILS under the kind=-1 law.
    // Scan window: rows 62..100 (the pockets live underground — layout read
    // this session: solid_wall 834 cells, hidden_cavern 4, friend_1/friend_4/
    // teleroom 1 each); solid_wall capped at 12 samples (the probe measures
    // all 841). Anti-vacuity: EVERY one of the 5 defs must be found.
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
    // Dig #144 could not measure the kind-0 anchor law (all-air masks ⇒
    // every pair identical). Post-fix the field is a pure function of
    // world px ⇒ same-def pairs with ≥1 TEXTURED member DIFFER. Pairs where
    // BOTH masks are all-air are skipped — a constant-0 mask hashes equal by
    // construction and carries no anchor information (run 2: lake_statue's
    // 3 row-62 cells + 2 lake air rows; the 12 informative lake pairs all
    // differ). FAILS under any per-chunk re-anchor (identical textured hashes).
    // Anti-vacuity: ≥2 informative pairs must exist per seed.
    // **dig #208: the lake family (lake.xml + lake_statue.xml) = DROPPED
    // from the anchor set** — its cell-law = the classify's windows with
    // the water's limit_y = [225, 512000] (the WORLD-y frame): the pool =
    // the FLAT y-cut band (the wy ≥ 225 rows) whose v-variation never
    // reaches the mask — the adjacent same-def pairs = IDENTICAL = the
    // game's own flat-water law, NOT a re-anchor signal (the capture's
    // (4,14)/(5,14) = the same flat pool). The anchor law rides the
    // winter's noise pairs.
    for (const seed of [SEED, SEED_B]) {
      let informative = 0;
      // the winter's informative pairs live at ty 61 (the map row 13 = the
      // snow-band = the wave's texture); ty 62 = the deep band (flat-full)
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
          // informative = TEXTURED both ends: the constant masks (0 or 2704
          // = the all-air / the flat-full like the deep band and the water
          // pools) hash equal by construction and carry no anchor info
          if (!(a.s > 0 && a.s < 2704 && b.s > 0 && b.s < 2704)) continue;
          informative++;
          expect(a.h, `${fn} (${a.tx},${a.ty})≡(${b.tx},${b.ty}) seed ${seed} [${a.s}/${b.s} solids]`).not.toBe(b.h);
        }
      }
      expect(informative, `seed ${seed}: fewer than 2 texture-bearing kind-0 pairs — the anchor law is unmeasured`).toBeGreaterThanOrEqual(2);
    }
  });

  // dig #146 — THE FIELD0 LAW (C122, entry (146)): count-pinned chunks on the
  // live server's seed (500412504), gates:
  // (1) lavalake (41,66): 0/2704 (old floor-0.5 law) → 414/2704 (field≡1)
  //     — FAILS under the old law's arithmetic (the floor kept rp ≤ 0.5 in
  //     every cell ⇒ ALL-AIR); (2) solid_wall (1,70): 1367/2704 → 1367/2704
  //     (byte-stable — the deep-row ramp-saturation byte argument holds
  //     exactly); (3) temple_wall (31,67): 398/2704 field-lane solids — the
  //     mask is classify-INDEPENDENT (the #146-era "NULL" was the throw of
  //     an un-parseable phantom comp; retracted dig #148). The classify
  //     lane contributes ZERO material hits: temple_wall's shipped
  //     <Materials> are 100% commented out ⇒ the game's table is EMPTY ⇒
  //     no overrides (the wall renders from the template lanes). Under the
  //     #147 raw-text regex the commented-out rock_hard_border diamonds
  //     painted 155 matIdx cells — the ZERO-material bar below FAILS
  //     under that law (the phantom discriminator).
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
    // dig #208 RE-PIN: the classify-or-air cell-law (the windows decide)
    // re-banded the lavalake count 401 → 375. The pin FAILS under both the
    // old hash AND the old mask law.
    expect(solids(41, 66), "lavalake kind-0 — THE FIELD0 discrimination").toBe(375);
    expect(solids(1, 70), "solid_wall deep — #208 re-pin 1361→2704 (the classify's windows: the wall biome paints every cell)").toBe(2704);
    expect(solids(31, 67),
           "temple_wall — #208 re-pin 386→0: its 4 rock_hard_border comps ship COMMENTED OUT (dig #148's census), so the classify-or-air law paints NOTHING — the game's temple walls belong to the pixel-scene lane (the Lua LoadPixelScene), not the classifier").toBe(0);
    expect(Object.keys(matProbe(31, 67)),
           "temple_wall ZERO material hits — the commented-out (phantom) comps are retracted; 155 rock_hard_border cells under the #147 raw-regex table")
      .toEqual([]);
  });

  // dig #164 (entry (164), the byte-plane WRITER falsification): the record
  // lane's stamps now write the [P+0x58] byte plane (the dig-#162 chain:
  // image_file → recordTemplate → the fn950 stencil). METER E1 pins:
  //   (1) the nonzero-byte coverage MUST grow off the old constant-zero
  //       plane (0.00%) for the record-carrying defs — FAILS under the
  //       draws-only port arithmetic (the old law's exact number);
  //   (2) desert — ZERO CaveStructure records in its XML (census this dig)
  //       — keeps 0.00% ⇒ the record lane CANNOT be the plane's (sole)
  //       writer (the capture shows 65.19% solid there = the dig-#165
  //       writer-hunt's opening evidence);
  //   (3) FIELD PARITY: the record lane is field-inert — the dig-#160 pins
  //       (90.07/98.57/89.9%) hold to ±0.05 ⇒ the write lane cannot shift
  //       the field (the dig-#163 spawn-scatter claim is also out:
  //       spawn_percent="0" across all 55 biomes).
  test("dig #164 byte-plane count: the record lane stamps nonzero bytes (FAILS old 0.00%), desert 0-records stays 0 (the writer-hunt evidence), field parity holds", async () => {
    const { buildCavesField } = await import("../../mapgen/lib/caves-field.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // dig #204 re-pin (the MINSTD engine swap, C177): the NollaPrng-era values (90.07/98.57/89.9) = the old engine's; the measured = the game's seed lane
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
        // the falsification anchor: ZERO <CaveStructure> elements in
        // desert.xml (grep census this dig) ⇒ the record lane writes
        // nothing ⇒ 0.00%. The capture still shows 65.19% solid ⇒ the
        // plane's writer lane lives elsewhere (dig #165).
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

  // dig #208 — THE CELL-LAW = THE CLASSIFY-OR-AIR (X215): the walk
  // 0x792580's post-classify arm @0x7930D8 paints a cell iff classify
  // returns celldata (the miss-exit 0x8F574C = xor eax,eax = null = the
  // untouched zeroed grid = AIR); the classify's y = the WALK-Y = the WORLD
  // px (the limits' semantics: the soil [−1024, 424.229], the water
  // [225, 512000] = the world-y bands). The dig-#178 `v > 0.5` mask + the
  // C76 map-y (−24576) = the flagged stand-ins (A11) — RETIRED. Every pin
  // below FAILS under the old law (the water/soil/snow = unpaintable there:
  // the water's window tops at 0.5 = the old mask-air; the map-y feed =
  // the limits never matched).
  describe.skipIf(!hasData)("dig #208 — the classify-or-air cell-law (world-y limits)", () => {
    test("the lake's water paints: tile (4,14) is a water pool at the capture's share (old law: 0 water cells)", async () => {
      const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
      const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
      const cfg208 = loadBiomeConfig(DATA_DIR);
      const r = noiseChunkMask(cfg208, 4, 62, SEED);
      const solid = [...r.mask].reduce((a, b) => a + b, 0);
      // the game's law: the water = v ∈ [−1, 0.5) ∧ the wy ≥ 225 → the
      // tile's bottom (512−225)/512 = 56.1% = the water-top band; the
      // capture's fR = 0.568.
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
      // the snow window's floor v ≥ 0.35 → r = 0.402 → the surface ≈ wy −200
      // = the capture's implied level (the dig-#207's A18 arithmetic)
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
