// tests/mapgen/splice-fill.test.mjs — dig #172 count laws for the splice
// lane's grey-placeholder fill (METER-CLASS: E1 — pixel counts and shares
// 0..1 over the art-grey mask of tile 40_14; reproduction:
// SURFACE_V3=1 node mapgen/experiments/2026-10-19-dig172-fill-mix-profile.mjs
// writes mapgen/out/dig172-fill-mix.json with the same bands/shares).
//
// The law under test: the fill = the game's per-cell driver (X148/X149 —
// walk 0x7930d3, driver 0x908F40 kind-0 arm): v = surfaceField(x+0.5,
// y+0.5), classify(the hosting biome's MaterialComponent table, x, y, v),
// NULL → the cell keeps its content. It replaced the seeded-fBm band choice
// (ISSUES A5, splice half) and the sand/rock shade routing.
//
//   L0 — the 0-path: below every window (v = 0 above the surface) the lane
//        returns null → the walk's "cell not painted" arm.
//   L1 — the N-path: rows 128-191 (the art-grey band just below the
//        terrain top) paint the soil SHADES family at ≥ 0.90 of the grey
//        cells, nearly all cells painted (≥ 0.99 coverage).
//   L2 — the stratification flip: soil share (128-191) − soil share
//        (448-511) ≥ 0.90 AND the bottom band's sand SHADES family ≥ 0.90
//        (the fill shade routing: sand_static → the dark sand family,
//        rock_static → the rock family).
//
// FAIL-UNDER-OLD (the fBm law's arithmetic, measured by this dig's E1 run
// pre-fix): the fill was a row-invariant slab — soil ≈ 1 px of 104002 in
// rows 160-400 (share ≈ 0.00001 ≪ 0.90 ⇒ L1 fails) with the SAME shares in
// the bottom band (delta ≈ 0 ≪ 0.90 ⇒ L2 flip fails) and sand_static
// routed to the LIGHT template shade (190,170,120), never SHADES.sand
// (95,87,49) ⇒ L2's sand share ≈ 0 ⇒ fails.
//
// Data-dependent: skips without the game data (the art PNG + biome XMLs).
import fs from "node:fs";
import { describe, expect, test } from "vitest";

const DATA_DIR = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const hasData = fs.existsSync(DATA_DIR + "/biome_impl/spliced/mountain_lake.png");
const SEED = 78633191;
const CHUNK = 512;
const TOP = [128, 191]; // the grey band just below the terrain top (the fill's soil band)
const BOTTOM = [448, 511]; // the deep band at the tile's foot (the capture's rock/soil band)
const ANCHOR = { tx: 40, ty: 62, wx: 2560, wy: 0 }; // the mountain_lake splice scene

describe.skipIf(!hasData)("splice fill lane (dig #172)", () => {
  let ready = null;

  const setup = () => {
    if (!ready) {
      ready = (async () => {
        const { readPng } = await import("../../mapgen/lib/images.mjs");
        const { SHADES } = await import("../../mapgen/lib/colorize.mjs");
        const { loadBiomeConfig, biomeAt } = await import("../../mapgen/lib/biomes.mjs");
        const { blitSplicedScenes } = await import("../../mapgen/lib/template-render.mjs");
        const { surfaceFillLane, surfaceFillAt } = await import("../../mapgen/lib/noise-terrain.mjs");

        // the art-grey mask (entry (170) law: alpha≥10, r===g===b, non-black)
        const artImg = readPng(DATA_DIR + "/biome_impl/spliced/mountain_lake.png");
        const grey = new Uint8Array(CHUNK * CHUNK);
        for (let j = 0; j < CHUNK; j++) {
          for (let i = 0; i < CHUNK; i++) {
            const q = 4 * (j * artImg.width + i);
            const r = artImg.data[q], g = artImg.data[q + 1], b = artImg.data[q + 2];
            if (artImg.data[q + 3] >= 10 && r === g && g === b && !(r === 0 && g === 0 && b === 0)) {
              grey[j * CHUNK + i] = 1;
            }
          }
        }

        const config = loadBiomeConfig(DATA_DIR);
        const fillBuf = new Map();
        blitSplicedScenes(fillBuf, DATA_DIR, config, SEED);
        const buf = fillBuf.get(`${ANCHOR.tx},${ANCHOR.ty}`);
        if (!buf) throw new Error(`splice-fill: no fill buffer ${ANCHOR.tx},${ANCHOR.ty}`);

        const rgbAt = (i, j) => {
          const p = 3 * (j * CHUNK + i);
          return [buf[p], buf[p + 1], buf[p + 2]];
        };
        const band = ([y0, y1], famRgbSet) => {
          let greyN = 0, hit = 0, painted = 0;
          for (let j = y0; j <= y1; j++) {
            for (let i = 0; i < CHUNK; i++) {
              if (!grey[j * CHUNK + i]) continue;
              greyN++;
              const [r, g, b] = rgbAt(i, j);
              if (!(r === 9 && g === 9 && b === 9)) painted++;
              if (famRgbSet.has(`${r},${g},${b}`)) hit++;
            }
          }
          return { greyN, hit, painted, share: greyN ? hit / greyN : 0 };
        };
        const famSet = (shade) => new Set(shade.map((s) => s.rgb.join(",")));

        // L0's lane: the anchor's hosting biome (the same resolution the fill uses:
        // game frame → biome chunk = world/512 + (35, 14), the C145 frame law)
        const def = biomeAt(config, Math.floor(ANCHOR.wx / 512) + 35, Math.floor(ANCHOR.wy / 512) + 14)?.biome;
        const lane = surfaceFillLane(config, def, SEED);

        return {
          band,
          soilSet: famSet(SHADES.soil),
          sandSet: famSet(SHADES.sand),
          lane,
          surfaceFillAt,
          top: band(TOP, famSet(SHADES.soil)),
          bottomSoil: band(BOTTOM, famSet(SHADES.soil)),
          bottomSand: band(BOTTOM, famSet(SHADES.sand)),
          topPainted: band(TOP, new Set(["0,0,0"])),
        };
      })();
    }
    return ready;
  };

  test("L0: below every MaterialComponent window the lane returns null (the no-paint arm)", async () => {
    const { lane, surfaceFillAt } = await setup();
    expect(lane, "surfaceFillLane for the anchor biome").not.toBeNull();
    // deep sky: y < limit_min_y of every comp and r = 0 below the band ramp's
    // start ⇒ v = 0 < 0.45 ⇒ every window rejects ⇒ classify null.
    expect(surfaceFillAt(lane, ANCHOR.wx + 100, -5000)).toBeNull();
  });

  // I63 (2026-11-09): the splice placeholder = the P-empty arm (field = the
  // grey's luminance; ≤ 0.5 ⇒ keep; else classify at 0x908e70's v). The old
  // L1/L2 (the driver fill's soil-top / sand-foot families) are replaced by
  // capture-agreement pins on the same anchor (exact colour on the art-grey
  // cells, tile 40_14): rows 192-447 old 0.138 → 0.161, rows 448-511 old
  // 0.038 → 0.345. Known residual: the 716-px soil top band (128-191) the
  // old law matched better (0.462 vs 0.117) — ISSUES I63.
  const capExact = async ([y0, y1]) => {
    const { readPng } = await import("../../mapgen/lib/images.mjs");
    const path = await import("node:path");
    const cap = readPng(path.join(process.cwd(), "mapgen/out/ref/40_14.png"));
    const artImg = readPng(DATA_DIR + "/biome_impl/spliced/mountain_lake.png");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const { blitSplicedScenes } = await import("../../mapgen/lib/template-render.mjs");
    const m = new Map(); blitSplicedScenes(m, DATA_DIR, loadBiomeConfig(DATA_DIR), SEED);
    const buf = m.get(`${ANCHOR.tx},${ANCHOR.ty}`);
    let n = 0, ex = 0, painted = 0;
    for (let j = y0; j <= y1; j++) for (let i = 0; i < CHUNK; i++) {
      const q = 4 * (j * artImg.width + i);
      const r = artImg.data[q], g = artImg.data[q + 1], b = artImg.data[q + 2];
      if (!(artImg.data[q + 3] >= 10 && r === g && g === b && r > 0)) continue;
      n++;
      const p = 3 * (j * CHUNK + i), k = 4 * (j * CHUNK + i);
      if (!(buf[p] === 9 && buf[p + 1] === 9 && buf[p + 2] === 9)) painted++;
      if (buf[p] === cap.data[k] && buf[p + 1] === cap.data[k + 1] && buf[p + 2] === cap.data[k + 2]) ex++;
    }
    return { n, exact: ex / n, painted: painted / n };
  };
  const hasCap = fs.existsSync("mapgen/out/ref/40_14.png");

  test.skipIf(!hasCap)("L1 (I63): the mid band's grey cells match the capture's colour (old driver fill 0.138)", async () => {
    const r = await capExact([192, 447]);
    expect(r.n).toBeGreaterThan(50000);
    expect(r.painted).toBeGreaterThanOrEqual(0.99);
    expect(r.exact).toBeGreaterThanOrEqual(0.15);
  }, 120000);

  test.skipIf(!hasCap)("L2 (I63): the foot band's grey cells match the capture's colour (old driver fill 0.038)", async () => {
    const r = await capExact(BOTTOM);
    expect(r.n).toBeGreaterThan(5000);
    expect(r.exact).toBeGreaterThanOrEqual(0.3);
  }, 120000);
});
