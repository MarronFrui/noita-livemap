// tests/mapgen/biome-edge.test.mjs — the biome-edge law (dig #216, C187).
//
// Bytes: GetBiomeAt 0x909da0 — X/Y = biome-map px; B = chunk(pmod(X>>9, W),
// clamp(Y>>9)); a noise-edged, non-fat B within 41 px of a chunk edge probes
// its neighbours (W, N, E, S, NW, SW, NE, SE); the first differing noise-edged
// N displaces the lookup: both big ⇒ (X + 30·sin(0.005·Y) + 11·s, Y +
// 30·cos(0.005·X) + 11·s), else (X + 2.5·s, Y + 2.5·s), s = simplex2DDeriv(
// 0.05·X, 0.05·Y); the displaced chunk wins if noise-edged.
//
// COUNT-TEST NOTE (charter: must FAIL under the old law): the old law was the
// plain chunk lookup (biomeAt / the vmap clamp) — every pin below that expects
// the NEIGHBOUR biome on this side of a chunk line returns 0 under it.

import { describe, test, expect } from "vitest";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";
import { biomeAtPixel, biomeChunkDef } from "../../mapgen/lib/biomes.mjs";
import { simplex2DDeriv } from "../../mapgen/lib/noise-proto.mjs";

// a 2×2 injected biome map: col 0 = A, col 1 = Bv (both rows)
function cfg(a = {}, b = {}) {
  const A = { filename: "A", noiseBiomeEdges: true, bigNoiseBiomeEdges: true, fatBiomeEdges: false, ...a };
  const Bv = { filename: "B", noiseBiomeEdges: true, bigNoiseBiomeEdges: true, fatBiomeEdges: false, ...b };
  const data = new Uint8Array([1, 0, 0, 255, 2, 0, 0, 255, 1, 0, 0, 255, 2, 0, 0, 255]);
  const key = (r) => ((r << 24) | 0xff) >>> 0; // rgbToRgbaInt(r, 0, 0)
  const biomes = new Map([[key(1), A], [key(2), Bv]]);
  return { map: { width: 2, height: 2, data }, biomes, A, Bv };
}
const flips = (c, X, from, to, step = 7) => {
  let n = 0;
  for (let Y = 0; Y < 1024; Y += step) if (biomeAtPixel(c, X, Y) === to) n++;
  return n;
};

describe("the biome-edge law — pure (C187)", () => {
  test("chunk fetch: x wraps by W, y clamps to [0, H−1]", () => {
    const c = cfg();
    expect(biomeChunkDef(c, -1, 0)).toBe(c.Bv);
    expect(biomeChunkDef(c, 2, 5)).toBe(c.A);
    expect(biomeChunkDef(c, 1, -9)).toBe(c.Bv);
  });
  test("interior (41 < l < 471) = the chunk biome, no displacement", () => {
    const c = cfg();
    expect(flips(c, 512 + 42, c.Bv, c.A)).toBe(0);
    expect(flips(c, 512 + 42, c.Bv, c.Bv)).toBeGreaterThan(140);
  });
  test("both big: the 30·sin + 11·simplex tongue crosses the line (old law: 0)", () => {
    const c = cfg();
    let want = 0;
    const X = 512 + 10;
    for (let Y = 0; Y < 1024; Y += 7) {
      const n = simplex2DDeriv(X * 0.05, Y * 0.05) * 11;
      if (Math.trunc(Math.sin(Y * 0.005) * 30 + n + X) >> 9 === 0) want++;
    }
    expect(want).toBeGreaterThan(0);
    expect(flips(c, X, c.Bv, c.A)).toBe(want);
  });
  test("one side not big ⇒ the 2.5·simplex jitter only (no flip 20 px in)", () => {
    const c = cfg({ bigNoiseBiomeEdges: false });
    expect(flips(c, 512 + 20, c.Bv, c.A, 1)).toBe(0);
    expect(flips(c, 512 + 1, c.Bv, c.A, 1)).toBeGreaterThan(0);
  });
  test("skip arms: B fat, B not noise-edged, N not noise-edged ⇒ B", () => {
    for (const c of [cfg({}, { fatBiomeEdges: true }), cfg({}, { noiseBiomeEdges: false }), cfg({ noiseBiomeEdges: false })]) {
      expect(flips(c, 512 + 5, c.Bv, c.A, 1)).toBe(0);
    }
  });
});

describe.skipIf(!hasNoitaData())("the biome-edge law — data (E1, seed 78633191 capture frame)", () => {
  test("flags: byte defaults 1/1/0 (ctor dword 0x101 @+0xc4); lava.xml noise_biome_edges=0", async () => {
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const c = loadBiomeConfig(dataDir);
    const by = (f) => [...c.biomes.values()].find((d) => d.filename === `data/biome/${f}.xml`);
    for (const f of ["the_end", "the_sky", "solid_wall"]) {
      expect([by(f).noiseBiomeEdges, by(f).bigNoiseBiomeEdges, by(f).fatBiomeEdges]).toEqual([true, true, false]);
    }
    expect(by("lava").noiseBiomeEdges).toBe(false);
  });
  test("the Hell west wall at three capture rows (edge −36 / −35 / +34 px off the line)", async () => {
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const c = loadBiomeConfig(dataDir);
    const at = (wy, dx) => biomeAtPixel(c, 27 * 512 + dx, wy - 48 * 512)?.filename;
    // capture (display px): wy 70160 edge at −36, wy 71440 at −35, wy 72080 at +34
    expect(at(70160, -40)).toBe("data/biome/solid_wall.xml");
    expect(at(70160, -30)).toBe("data/biome/the_end.xml"); // old law: solid_wall (col 26)
    expect(at(71440, -28)).toBe("data/biome/the_end.xml"); // old law: solid_wall
    expect(at(72080, 30)).toBe("data/biome/solid_wall.xml"); // old law: the_end (col 27)
    expect(at(72080, 40)).toBe("data/biome/the_end.xml");
  });
});

// dig #218 (I53): the noise lane evaluated for the PIXEL's biome — the field
// driver 0x908f40's kind-0 arm takes GetBiomeAt's config (X223). The per-pixel
// evaluator must reproduce the chunk mask exactly where the pixel biome = the
// chunk biome (an undisplaced pixel keeps its verdict), and decline wang defs.
describe.skipIf(!hasNoitaData())("dig #218 — noisePixelFor mirrors the chunk mask", async () => {
  const { noiseChunkMask, noisePixelFor } = await import("../../mapgen/lib/noise-terrain.mjs");
  const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
  test("0 mismatches over the hills / desert surface chunks; wang defs → null", () => {
    const c = loadBiomeConfig(dataDir);
    let n = 0, bad = 0, solid = 0;
    for (const [tx, ty] of [[41, 62], [43, 61], [45, 62]]) {
      const m = noiseChunkMask(c, tx, ty, 78633191);
      expect(m).not.toBeNull();
      const def = biomeChunkDef(c, tx, ty - 48);
      for (let cy = 0; cy < 51; cy += 2) for (let cx = 0; cx < 51; cx += 2) {
        const r = noisePixelFor(c, def, 78633191, tx * 512 + cx * 10 + 3, ty * 512 + cy * 10 + 7, dataDir);
        n++; solid += r.solid;
        if (r.solid !== m.mask[52 * cy + cx]) bad++;
      }
    }
    expect(n).toBe(3 * 26 * 26);
    expect(solid).toBeGreaterThan(200);
    expect(bad).toBe(0);
    const lake = biomeChunkDef(c, 5, 18); // lake_deep = a wang biome
    expect(lake.templateFile).toBeTruthy();
    expect(noisePixelFor(c, lake, 78633191, 5 * 512 + 100, (18 + 48) * 512 + 100, dataDir)).toBeNull();
  });
});
