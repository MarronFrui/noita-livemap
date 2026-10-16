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
      // desert caves filler at the mines band: base (45,62); H neighbor;
      // V neighbor; distant (dx=17, dy=26). The BitmapCaves 512/256 mod-wrap
      // => all THREE comparisons identical. A world-anchored re-frame (the
      // naive "continuity fix") makes every neighbor DIFFER — this test
      // fails under that arithmetic.
      const base = noiseChunkMask(cfg, 45, 62, seed);
      expect(base).not.toBeNull();
      expect(base.def.filename).toContain("desert.xml");
      const h = maskHash(base.mask);
      const neighbors = [
        [46, 62], // H adjacent
        [45, 63], // V adjacent
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
    const d = census(noiseChunkMask(cfg, 45, 62, SEED));
    // desert: 2642-2664 solids of 2704, rock_static ~97-98%, idx255 <= 9.
    // FAILS under the old arithmetic where limit_max_y caps gate every comp
    // (all comps rejected at y>=7168 => idx255 = thousands of cells).
    expect(d.solids).toBeGreaterThan(2000);
    expect(d.solids).toBeLessThanOrEqual(2704);
    expect(d.counts.get("rock_static") ?? 0).toBeGreaterThan(0.9 * d.solids);
    expect(d.counts.get("(idx255)") ?? 0).toBeLessThan(50);
    const w = census(noiseChunkMask(cfg, 11, 62, SEED));
    // winter: snowrock_static = EVERY solid (2426/2426 at seed 78633191).
    expect(w.solids).toBeGreaterThan(2000);
    expect(w.counts.get("snowrock_static")).toBe(w.solids);
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
    // empty(15,62): mode 1's noise arm jitters the band window per column
    // ⇒ r ∈ ~0.64..0.81 across the row; with the C45-range-clamped grad
    // (field0 ∈ [−1,1] ⇒ floor 0.5 ⇒ rp ≤ 0.81 < 0.85, the case-3 acos arm
    // unreachable ⇒ no NaN) the field = gradW·per + 0.871429·rp crosses the
    // 0.5 gate. Measured post-fix: 2059 (seed A) / 1996 (seed B) of 2704.
    // Pre-fix (the dig-#142 canvas frame): 0/2704 at both seeds (I33) —
    // this pin FAILS under that arithmetic.
    for (const seed of [SEED, SEED_B]) {
      const r = noiseChunkMask(cfg, 15, 62, seed);
      expect(r).not.toBeNull();
      expect(r.def.filename).toContain("empty.xml");
      const solids = [...r.mask].filter((v) => v).length;
      expect(solids).toBeGreaterThan(0);
      expect(solids).toBeLessThan(2704);
    }
    // lake/lake_statue (the run-1 amendment — see the probe header): the
    // SEAM branch (lx ≤ 41 ⇒ blend with the left neighbor) carries texture
    // at lake(4,62) cx0 (7/13 solids measured). Pin: lake(4,62) is
    // TEXTURED (0 < s < 2704 — fails the pre-fix 0), and lake_statue(6,62)
    // = 0 air is the BYTE LAW of its slope window (mode 3 at wx ≈ −14.8k:
    // s ≈ +1052 ⇒ A' = 28 ⇒ r ≤ 0.236 ⇒ field ≤ 0.2 — its crossing lands
    // at wy > 1.2k = rows 64+, which this world maps to lake_deep; pinned
    // so a future change that floods it is caught).
    {
      const rL = noiseChunkMask(cfg, 4, 62, SEED);
      expect(rL).not.toBeNull();
      expect(rL.def.filename).toContain("lake.xml");
      const sL = [...rL.mask].filter((v) => v).length;
      expect(sL).toBeGreaterThan(0);
      expect(sL).toBeLessThan(2704);
      const rS = noiseChunkMask(cfg, 6, 62, SEED);
      expect(rS).not.toBeNull();
      expect(rS.def.filename).toContain("lake_statue.xml");
      expect([...rS.mask].filter((v) => v).length).toBe(0);
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
    for (const seed of [SEED, SEED_B]) {
      let informative = 0;
      for (const fn of ["empty.xml", "lake.xml", "lake_statue.xml"]) {
        const cells = [];
        for (let tx = 0; tx <= 70; tx++) {
          for (const ty of [62, 63]) {
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
          if (a.s === 0 && b.s === 0) continue; // vacuous: all-air ⇒ equal by construction
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
    expect(solids(41, 66), "lavalake kind-0 — THE FIELD0 discrimination").toBe(414);
    expect(solids(1, 70), "solid_wall deep — byte-stable through the change").toBe(1367);
    expect(solids(31, 67),
           "temple_wall field-lane solids (classify-independent; was honest-fall NULL under #146)").toBe(398);
    expect(Object.keys(matProbe(31, 67)),
           "temple_wall ZERO material hits — the commented-out (phantom) comps are retracted; 155 rock_hard_border cells under the #147 raw-regex table")
      .toEqual([]);
  });
});
