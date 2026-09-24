// tests/mapgen/surface-wiring.test.mjs — dig #97 (Phase 4 step 3): the
// SURFACE_V3 lane's classify wiring (CONSTANTS C76); RE-DERIVED dig #101
// (entry (101), C80): the gate value is no longer the a=1.0 single-call
// proxy (the dig-#100 flood root cause) — it is surfaceField's RETURN
// computed at WORLD px (C80: wx = x − 17920, wy = canvas py − 31744), and
// evaluator2 takes the classifier's own lane coords (the evaluator2 ≡
// classify floor-fix identity). Chain pinned by C76/C80:
//   field = surfaceField(uid, wx, wy, gradAt, 0, 0)   (world frame, C80)
//   gate:  field > 0.5 (@0x90dbc3 comiss 0x11dfa94 → jbe) ∧ table ≠ null
//   v = evaluator2(x, y, field)                        (@0x90dd24)
//   solid = classify(table, x, y, v) ≠ null            (@0x90dd7e → accept
//                                                        @0x8f5740)
// This file pins BEHAVIOR:
//  1. round-trip — mask 1 ⇒ the field gate passed ∧ classify hits, using
//     the exact lane math (x = tx·512 + cx·10 + 5; y = … − 24576 — the
//     C76 evaluate/classify frame, unchanged this dig: I21 flip pending)
//     AND the exact field build (C80 world coords + the caves-field gradAt
//     the lane selects for <BitmapCaves> hills — mirror of
//     noise-terrain.mjs's selection, WITHOUT any env conjunct).
//  2. full equivalence — per-cell mask ≡ (field > 0.5 ∧ classify hit) on
//     BOTH a sky row (canvas ty 48 — the dig-#100 flood zone) and the
//     true surface row (canvas ty 60 = biome row 12, PREDICTABLE_ZONES
//     spawn-surface j=12), with non-triviality counts on each side of the
//     gate (cells rejected at field ≤ 0.5 — the flood fix; cells solid).
//  3. frame probes — constructed soil-exclusive v = 0.505 at REAL lane
//     coords straddling soil's limit_y (shallow 405 ≤ 424.229 ⇒ soil
//     catches; deep 505 ⇒ gated), plus the two eliminated frames (raw
//     canvas +24576 ⇒ ≫ 424.229 rejects; world @OFFSET_Y=14 ⇒ y − 7168
//     = −6763 < −1024 rejects) — C76's elimination argument executed
//     against the real classifier + fixture. NOTE (I21): the world-frame
//     rejection holds only because this probe cell sits at canvas ty 48
//     (sky); at the true surface rows (ty 60..62) the C80 world frame
//     lands inside soil's [−1024, 424.229] — the assertions stand, the
//     old "(world frame eliminated)" reading does not.
//
// Data-gated: needs the extracted biome map + hills.xml (no extracted
// data → skipped, like the rest of the battery).

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { noiseChunkMask } from "../../mapgen/lib/noise-terrain.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";
import { evaluator2, surfaceField } from "../../mapgen/lib/noise-proto.mjs";
import { buildCavesField } from "../../mapgen/lib/caves-field.mjs";
import {
  componentFromXml,
  buildMaterialsTable,
  classify,
} from "../../mapgen/lib/surface-level.mjs";
import { dataDir, hasNoitaData, CAPTURE_SEED } from "../helpers/data.mjs";

const SKY_PX = 48 * 512; // 24576 — SKY_ROWS · CHUNK, the C76 evaluate/classify frame
const WORLD_X0 = 35 * 512; // 17920 — C80 world x origin (biome px 35)
const WORLD_Y0 = (48 + 14) * 512; // 31744 — C80 world y origin (biome row 14)
const MIN_X = 159.0; // biomeCfg constants (noise-terrain.mjs:101)
const MAX_X = 223.0;

const SKY_ROW = 48; // canvas ty — biome row 0 (sky per PREDICTABLE_ZONES j=1..13)
const SURF_ROW = 60; // canvas ty — biome row 12 (spawn surface band top, j=12)

// Lazy memos — describe bodies still run under vitest's skipIf, so no
// data work may happen at collection time (mirror of the
// surface-level.test fixture pattern).
let _config = null;
let _table = null;
let _caves = null;
function cfg() {
  if (_config == null) _config = loadBiomeConfig(dataDir);
  return _config;
}
function table() {
  if (_table == null) {
    const xml = fs.readFileSync(path.join(dataDir, "biome", "hills.xml"), "utf-8");
    const blocks = xml.match(/<MaterialComponent\b[^>]*>/g) ?? [];
    const comps = blocks.map((b) => componentFromXml(b));
    const records = comps.map((c, i) => ({ i, name: c.material_name }));
    _table = buildMaterialsTable(comps, { min: 0, max: 0 }, records);
  }
  return _table;
}

// uid mirror — a verbatim duplicate of noise-terrain.mjs's uidFrom
// (C43/C37 attr→slot map). Duplication is deliberate: any drift between
// the lane and this mirror changes `field` bit-wise and breaks the
// round-trip/equivalence assertions below.
function uidMirror(def) {
  const n = (v, d) => { const p = parseFloat(v); return Number.isFinite(p) ? p : d; };
  return {
    noiseKind: def.noiseType === "SIN_CAPPED_SIMPLEX" ? 5 : -1,
    gradient: 0,
    sx: n(def.mInsidePerlinScaleX, 1), sy: n(def.mInsidePerlinScaleY, 1),
    ox: 0, oy: 0,
    offsetBySeed: false,
    fbm: false,
    noiseTypeInt: def.noiseType === "SIN_CAPPED_SIMPLEX" ? 5 : -1,
    squared: n(def.mInsidePerlinSquared, 0) === 1,
    clamped: n(def.mInsidePerlinClamped, 0) === 1,
    scaled: n(def.mInsidePerlinScaled, 0) === 1,
    scaleMin: n(def.mInsidePerlinScaleMin, 0.057143),
    scaleMax: n(def.mInsidePerlinScaleMax, 2),
    gradWCoef: n(def.mMultiplierPerlin, 1.0),
    perlinCoef: n(def.mMultiplierGradient, 0),
    addValue: 0,
    addNoise: n(def.mGradientAddNoise, 1),
    minX: MIN_X, maxX: MAX_X,
  };
}

// gradAt mirror — the lane's selection for hills (<BitmapCaves> ⇒ the
// caves-field grid; noise-terrain.mjs dig-#101 branch). The grid is
// (seed, name)-deterministic (C49) and memoized like the lane's cache.
function gradAtMirror(def) {
  if (!_caves) _caves = buildCavesField(dataDir, def, CAPTURE_SEED);
  const { w: fw, h: fh, field } = _caves;
  return (gx, gy) =>
    field[(((Math.floor(gy) % fh) + fh) % fh) * fw
        + (((Math.floor(gx) % fw) + fw) % fw)];
}

// Exact mirror of the lane's default-branch math (noise-terrain.mjs,
// dig #101): same expression order ⇒ bit-identical field/v inputs.
function cell(def, tx, ty, cx, cy) {
  const x = tx * 512 + cx * 10 + 5;
  const y = ty * 512 + cy * 10 + 5 - SKY_PX;
  const wx = x - WORLD_X0; // C80
  const wy = y + SKY_PX - WORLD_Y0; // C80 (canvas py = y + 24576)
  const field = surfaceField(uidMirror(def), wx, wy, gradAtMirror(def), 0, 0);
  const v = evaluator2(x, y, field);
  return { field, v, x, y };
}

// Hills chunks at a given canvas row (procedural, non-template).
function hillsChunks(ty, limit = 99) {
  const out = [];
  for (let tx = 0; tx < 71 && out.length < limit; tx++) {
    const r = noiseChunkMask(cfg(), tx, ty, CAPTURE_SEED);
    if (r && /hills\.xml$/.test(r.def?.filename ?? "")) out.push(tx);
  }
  return out;
}

describe.skipIf(!hasNoitaData() || process.env.SURFACE_V2 === "1")(
  "SURFACE_V3 field→gate→classify wiring (dig #101, data-gated)",
  () => {
    test("round-trip: mask 1 ⇒ field gate ∧ classify hit (surface row)", () => {
      const t = table();
      const txs = hillsChunks(SURF_ROW);
      expect(txs.length).toBeGreaterThan(0);
      let solids = 0;
      for (const tx of txs) {
        const { mask, def } = noiseChunkMask(cfg(), tx, SURF_ROW, CAPTURE_SEED);
        for (let cy = 0; cy < 52; cy++) {
          for (let cx = 0; cx < 52; cx++) {
            if (!mask[52 * cy + cx]) continue;
            const { field, v, x, y } = cell(def, tx, SURF_ROW, cx, cy);
            expect(field > 0.5).toBe(true);
            expect(classify(t, x, y, v)).not.toBeNull();
            solids++;
          }
        }
      }
      expect(solids).toBeGreaterThan(0);
    });

    test("equivalence: mask ≡ (field > 0.5 ∧ classify hit); gate discriminates", () => {
      const t = table();
      let solids = 0, airByGate = 0, airByClassify = 0;
      for (const ty of [SKY_ROW, SURF_ROW]) {
        const txs = hillsChunks(ty);
        expect(txs.length).toBeGreaterThan(0);
        for (const tx of txs) {
          const { mask, def } = noiseChunkMask(cfg(), tx, ty, CAPTURE_SEED);
          for (let cy = 0; cy < 52; cy++) {
            for (let cx = 0; cx < 52; cx++) {
              const { field, v, x, y } = cell(def, tx, ty, cx, cy);
              const gatePass = field > 0.5;
              let expected = 0;
              if (gatePass && classify(t, x, y, v)) expected = 1;
              expect(mask[52 * cy + cx]).toBe(expected);
              if (!gatePass) airByGate++;
              else if (!expected) airByClassify++;
              else solids++;
            }
          }
        }
      }
      expect(solids).toBeGreaterThan(0);
      // the dig-#100 flood fix: the field gate now rejects cells
      // (≤ 0.5 ⇒ skip) — with the a=1.0 proxy this count was 0 in sky
      expect(airByGate).toBeGreaterThan(0);
      // classify still rejects some gate-passing cells (band/limit arms
      // are reachable through the real field's v range)
      expect(airByClassify).toBeGreaterThan(0);
    });

    test("frame probes: C76 eliminations against the real classifier", () => {
      const t = table();
      const txs = hillsChunks(SKY_ROW);
      expect(txs.length).toBeGreaterThan(0);
      const tx = txs[0];
      const def = noiseChunkMask(cfg(), tx, SKY_ROW, CAPTURE_SEED).def;
      const shallow = cell(def, tx, SKY_ROW, 10, 40); // lane y = 48·512 + 400 + 5 − 24576
      const deep = cell(def, tx, SKY_ROW, 10, 50);
      expect(shallow.y).toBe(405); // ≤ 424.229 — soil limit passes
      expect(deep.y).toBe(505); // > 424.229 — soil limit gates
      const soilV = 0.505; // soil-exclusive: coal ≥ 0.51, sand ≥ 0.53
      // band frame (the C76 decision): soil catches shallow, rejects deep
      expect(classify(t, shallow.x, shallow.y, soilV)).not.toBeNull();
      expect(classify(t, deep.x, deep.y, soilV)).toBeNull();
      // eliminated frame A — raw canvas px: surface ≈ 24576 ≫ 424.229
      expect(classify(t, shallow.x, shallow.y + 24576, soilV)).toBeNull();
      // eliminated frame B — world px @OFFSET_Y=14: sky cell wy = −6763 < −1024
      // (I21: the ASSERTION holds; its "(world eliminated)" reading flips —
      // at the surface rows ty 60..62 the same frame lands in [−1024, 512])
      expect(classify(t, shallow.x, shallow.y - 7168, soilV)).toBeNull();
      // sanity: a catch-all v (sand band, limit_y = 0) accepts anywhere
      expect(classify(t, shallow.x, shallow.y + 24576, 0.9)).not.toBeNull();
    });
  },
);
