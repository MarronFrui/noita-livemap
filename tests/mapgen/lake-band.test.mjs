// tests/mapgen/lake-band.test.mjs — count law (METER-CLASS E1): the lake
// band at tile 40_14 rows 160-287 (display rows 31904-32031) is filled under
// C145 — the template lane reads at the DISPLAY frame (the L3 anchor belongs
// to the generator lanes) and the splice lane's pure-grey placeholder fills
// with the hosting biome's MaterialComponent band shades.
// A generator-local template read + grey = keep-content measures fG 0.6608
// and water overlap 38292 here, so the pins (≥ 0.95 / ≥ 42000) reject it
// (reproduce: mapgen/experiments/2026-10-19-dig170-lake-band-counts.mjs).
// The capture is solid at fR = 0.9998; the residual ~4.5% gen-air = the
// art's black "below shows" cells whose base lane is open (ISSUES I39).
//
// Auto-skips without extracted game data + the capture tile; RUNS in this
// repo's gates (data present there).

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "vitest";
import { worldColorAt } from "../../mapgen/lib/world-gen.mjs";
import { dataDir, hasNoitaData, repoRoot, CAPTURE_SEED } from "../helpers/data.mjs";

const CAPTURE = path.join(repoRoot, "mapgen/out/ref/40_14.png");
const hasCapture = fs.existsSync(CAPTURE);

describe.skipIf(!hasNoitaData() || !hasCapture)("lake band (tile 40_14, rows 160-287) — dig #170 count law (E1)", () => {
  let measured = null;

  async function measure() {
    if (measured) return measured;
    const { blitSplicedScenes } = await import("../../mapgen/lib/template-render.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const { readPng } = await import("../../mapgen/lib/images.mjs");
    const config = loadBiomeConfig(dataDir);
    const templates = new Map();
    blitSplicedScenes(templates, dataDir, config, CAPTURE_SEED);
    const world = {
      grid: new Int16Array(71 * 144).fill(-1),
      errors: new Map(),
      templates,
      maps: new Map(),
      areas: [],
      ready: Promise.resolve(),
    };
    const cap = readPng(CAPTURE);
    const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    const isWater = (p) =>
      p && Math.abs(p[0] - 35) <= 12 && Math.abs(p[1] - 61) <= 12 && Math.abs(p[2] - 56) <= 12;
    const OX = 40 * 512, OY = 62 * 512; // capture tile 40_14 = display chunks (40,62)
    const N = 128 * 512;
    let fR = 0, fG = 0, capW = 0, genW = 0, wInt = 0;
    for (let j = 160; j <= 287; j++) {
      for (let i = 0; i < 512; i++) {
        const q = 4 * (j * 512 + i);
        const cSolid = lum(cap.data[q], cap.data[q + 1], cap.data[q + 2]) >= 24;
        const cWater = isWater([cap.data[q], cap.data[q + 1], cap.data[q + 2]]);
        if (cSolid) fR++;
        if (cWater) capW++;
        const p = worldColorAt(world, OX + i, OY + j);
        if (p) fG++;
        if (isWater(p)) { genW++; if (cWater) wInt++; }
      }
    }
    measured = { fR: fR / N, fG: fG / N, capW, genW, wInt };
    return measured;
  }

  test("band solidity: the template lane's water + the grey fill land at the capture's rows (fG ≥ 0.95; old law 0.6608)", async () => {
    const m = await measure();
    expect(m.fR).toBeGreaterThanOrEqual(0.999); // capture solidity sanity (measured 0.9998)
    expect(m.fG).toBeGreaterThanOrEqual(0.95); // measured 0.9550
  });

  test("identity alignment: gen-water ∩ capture-water ≥ 42000 in the band (old law 38292)", async () => {
    const m = await measure();
    expect(m.wInt).toBeGreaterThanOrEqual(42000); // measured 42467
  });
});
