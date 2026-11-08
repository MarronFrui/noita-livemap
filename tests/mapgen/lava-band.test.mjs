// tests/mapgen/lava-band.test.mjs — the lava-band law (METER-CLASS E1):
// a lava.xml chunk is pure `lava` at EVERY biome row, coloured by the C185
// cell colour law (no <Graphics> ⇒ wang_color ffff6000 = (255,96,0) flat).
//
// COUNT-TEST NOTE (charter: a replacement test must FAIL under the old
// law's arithmetic): the old renderLavaFill painted chunks below world
// y 14600 (biome row ≥ 42) as a dark hell-rock matrix (lava share ≈ 0.006
// at rows 42–46) and the rows above as a 6:3:2 shade mix ((255,96,0) share
// ≈ 0.545). The capture (seed 78633191, rows 42–46: 54 lava.xml chunks)
// reads 1.0000 (255,96,0) on every chunk without art overlap — the pins
// below (= 262144/262144 at rows 41, 44, 45) fail both old arms.
//
// Auto-skips without extracted game data; RUNS in this repo's gates.

import { describe, test, expect } from "vitest";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";

describe.skipIf(!hasNoitaData())("lava band — lava.xml = pure lava at every row (E1)", () => {
  // biome (tx, ty): (30,41) = the old "sea" arm, (10,44) / (45,45) = the old dark-matrix arm
  test.each([[30, 41], [10, 44], [45, 45]])("chunk (%i,%i) is 262144/262144 lava (255,96,0)", async (tx, ty) => {
    const { renderTemplateChunk } = await import("../../mapgen/lib/template-render.mjs");
    const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
    const config = loadBiomeConfig(dataDir);
    const at = biomeAt(config, tx, ty);
    expect(at.biome.filename).toBe("data/biome/lava.xml");
    const buffers = new Map();
    renderTemplateChunk(buffers, dataDir, "lava.xml", at.biome, (tx - 35) * 512, (ty - 14) * 512, 78633191);
    expect(buffers.size).toBe(1);
    const buf = [...buffers.values()][0];
    let lava = 0;
    for (let o = 0; o < buf.length; o += 3) {
      if (buf[o] === 255 && buf[o + 1] === 96 && buf[o + 2] === 0) lava++;
    }
    expect(lava).toBe(512 * 512);
  });
});
