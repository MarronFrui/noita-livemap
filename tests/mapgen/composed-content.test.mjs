// tests/mapgen/composed-content.test.mjs — dig #144 (THE COMPOSED-CONTENT
// LAW, I34/I33) count pins: (1) the caves filler's PER-CHUNK re-anchor
// (the mask/mat grid hash equality across H/V/distant pairs — 0/1/N counts
// that FAIL under a world-anchored re-frame); (2) the caves material census
// (rock_static majority — FAILS under the old "limit caps always gate"
// arithmetic that would paint idx-255 band shade everywhere); (3) the
// limit_y FLAG law (the desert's ungated rock_static/sand_static comps
// paint at ANY depth; FAILS if limit_y parsing ever regresses to
// cap-by-default); (4) I33's kind-0 NOISE→AIR field facts re-counted
// (0/2704 solids — the tripwire for I33's planned noise-texture fix).
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

  test("I33 field facts re-counted: kind-0 filler ground chunks are 0/2704 solids (the NOISE→AIR collapse)", async () => {
    const { noiseChunkMask } = await import("../../mapgen/lib/noise-terrain.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(DATA_DIR);
    // empty.xml + lake.xml kind-0 ground filler chunks (seed 78633191 and
    // 500412504 both): every read collapses to air (I33's r-site swap) —
    // 0 solid cells. Tripwire: I33's planned noise-texture restoration
    // flips this count (re-measure the (b) anchor law for kind-0 then).
    for (const [tx, ty, fn] of [[15, 62, "empty.xml"], [4, 62, "lake.xml"], [6, 62, "lake_statue.xml"]]) {
      for (const seed of [SEED, SEED_B]) {
        const r = noiseChunkMask(cfg, tx, ty, seed);
        expect(r).not.toBeNull();
        expect(r.def.filename).toContain(fn);
        const solids = [...r.mask].filter((v) => v).length;
        expect(solids).toBe(0);
      }
    }
  });
});
