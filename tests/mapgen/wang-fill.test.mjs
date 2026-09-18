// Wang fill contracts: template parsing + fill mechanics on synthetic
// atlases (no data needed) and the real game atlas (data needed).

import path from "node:path";

import { describe, test, expect } from "vitest";
import { buildTileset, generateCorner, seqAttempt } from "../../mapgen/lib/wang-js.mjs";
import { readPng } from "../../mapgen/lib/images.mjs";
import { makeCornerAtlas, expectedTileCounts } from "../helpers/synthetic-atlas.mjs";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";
import { biomeByName } from "../helpers/golden.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";

describe("buildTileset — template walk (corner mode)", () => {
  test.each([[[1, 1, 1, 1]], [[2, 2, 2, 2]], [[1, 2, 1, 2]]])(
    "counts match the walk formula for numColor %j",
    (nc) => {
      const ts = buildTileset(makeCornerAtlas(nc));
      const want = expectedTileCounts(nc);
      expect(ts.hTiles.length).toBe(want.hTiles);
      expect(ts.vTiles.length).toBe(want.vTiles);
      expect(ts.numColor).toEqual(nc);
      expect(ts.isCorner).toBe(true);
      expect(ts.shortSideLen).toBe(4);
    }
  );

  test("tile geometry follows the packing rules (h=2s*s, v=s*2s)", () => {
    const ts = buildTileset(makeCornerAtlas([2, 2, 2, 2], 4));
    for (const t of ts.hTiles) {
      expect(t.w).toBe(8);
      expect(t.h).toBe(4);
      expect(t.pixels.length).toBe(8 * 4 * 3);
    }
    for (const t of ts.vTiles) {
      expect(t.w).toBe(4);
      expect(t.h).toBe(8);
    }
  });

  test("edge-type header (hdr[7] != 0xC0) is rejected with the standing message", () => {
    const a = makeCornerAtlas();
    const b = 3 * a.width - 1 - 7;
    const px = Math.floor(b / 3), ch = b % 3;
    a.data[px * 4 + ch] ^= 0xff; // decoded hdr[7] flips off 0xC0
    expect(() => buildTileset(a)).toThrow("only corner-type tilesets supported");
  });

  test("bad short_side_len is rejected", () => {
    const a = makeCornerAtlas([1, 1, 1, 1], 0);
    expect(() => buildTileset(a)).toThrow("bad short_side_len");
  });
});

describe("generateCorner — herringbone scan mechanics", () => {
  test("output dims are exactly (w, h) in cells", () => {
    const ts = buildTileset(makeCornerAtlas([2, 2, 2, 2]));
    const out = generateCorner(ts, 24, 16, () => 0, (_i, _j, n) => n - 1, null);
    expect(out.width).toBe(24);
    expect(out.height).toBe(16);
    expect(out.rgb).toHaveLength(24 * 16 * 3);
  });

  test("fill is a pure function of the injected sources (deterministic)", () => {
    const ts = buildTileset(makeCornerAtlas([2, 2, 2, 2]));
    const src = (i, j, p) => (i * 7 + j * 3 + p) % 2;
    const a = generateCorner(ts, 32, 24, src, (_i, _j, n) => n - 1, null);
    const b = generateCorner(ts, 32, 24, src, (_i, _j, n) => n - 1, null);
    expect(Buffer.compare(a.rgb, b.rgb)).toBe(0);
    const c = generateCorner(ts, 32, 24, (i, j, p) => src(i, j, p), (_i, _j, n) => n - 1, null);
    expect(Buffer.compare(c.rgb, a.rgb)).toBe(0);
  });

  test("class formula (i-j+1)&3 drives vertex classes row-major", () => {
    // numColor [4,1,1,1]: capture the class of every drawn vertex; row-major
    // scan at (0,0),(1,0),(2,0),(3,0) must yield p = (i-j+1)&3 = 1,2,3,0.
    const ts = buildTileset(makeCornerAtlas([4, 1, 1, 1]));
    const draws = [];
    generateCorner(ts, 24, 24, (_i, _j, p) => { draws.push(p); return 0; }, () => 0, null);
    expect(draws.slice(0, 4)).toEqual([1, 2, 3, 0]);
    expect(draws.every((p) => p >= 0 && p <= 3)).toBe(true);
  });

  test("generated output contains tile art, not zeros, on interior pixels", () => {
    const ts = buildTileset(makeCornerAtlas([2, 2, 2, 2], 4, 1, 1, 40));
    const out = generateCorner(ts, 32, 24, () => 0, (_i, _j, n) => n - 1, null);
    const n = out.rgb.length;
    expect(out.rgb.reduce((s, v) => s + v, 0)).toBeGreaterThan(0); // fully painted interior
  });
});

describe("seqAttempt — legacy sequential model (regression baseline only)", () => {
  test("output is w*h with the +4-row generation discarded", () => {
    const ts = buildTileset(makeCornerAtlas([2, 2, 2, 2]));
    const r = seqAttempt(ts, 20, 10, 78633191);
    expect(r.width).toBe(20);
    expect(r.height).toBe(10);
    expect(r.rgb).toHaveLength(20 * 10 * 3);
  });

  test("same seed twice is byte-identical; adjacent seeds differ", () => {
    const ts = buildTileset(makeCornerAtlas([2, 2, 2, 2]));
    const a = seqAttempt(ts, 20, 10, 78633191);
    const b = seqAttempt(ts, 20, 10, 78633191);
    expect(Buffer.compare(a.rgb, b.rgb)).toBe(0);
    const c = seqAttempt(ts, 20, 10, 78633192);
    expect(Buffer.compare(a.rgb, c.rgb)).not.toBe(0);
  });

  test("seed sensitivity: the ref seed and ref+1 disagree somewhere", () => {
    const ts = buildTileset(makeCornerAtlas([2, 2, 2, 2]));
    const a = seqAttempt(ts, 40, 10, 78633191);
    const c = seqAttempt(ts, 40, 10, 78633192);
    let diff = 0;
    for (let i = 0; i < 40 * 10 * 3; i++) if (a.rgb[i] !== c.rgb[i]) diff++;
    expect(diff).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasNoitaData())("real game atlases (extracted data)", () => {
  test("coalmine parses to the verified counts (s=13, 72h+72v — VERIFIED.md §3)", () => {
    const config = loadBiomeConfig(dataDir);
    const coal = biomeByName(config, "coalmine");
    const atlas = readPng(
      path.join(dataDir, coal.templateFile.replace(/^data\//, ""))
    );
    const ts = buildTileset(atlas);
    expect(ts.numColor).toEqual([1, 2, 1, 2]);
    expect(ts.shortSideLen).toBe(13);
    expect(ts.hTiles).toHaveLength(72);
    expect(ts.vTiles).toHaveLength(72);
  });
});
