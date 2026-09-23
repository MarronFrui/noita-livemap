// tests/mapgen/surface-wiring.test.mjs — dig #97 (Phase 4 step 3): the
// SURFACE_V3 lane's classify wiring (CONSTANTS C76). noiseChunkMask's
// default branch is now: gate (v > 0.5 — the sampler's own comiss
// @0x90dbc3) → mBiomeMaterials-null arm (table === null → air, @0x90dd01)
// → classify (call @0x90dd7e; record null → no window-write → air,
// @0x90dd8b). Byte cites live in C76 / the noise-terrain branch header;
// this file pins BEHAVIOR:
//
//  1. round-trip — mask 1 ⇒ the gate passes ∧ classify hits, using the
//     exact lane math (x = tx·512 + cx·10 + 5 canvas px; y = ty·512 +
//     cy·10 + 5 − 24576 band frame — the C76 frame decision).
//  2. converse/equivalence — every gate-passing cell is solid (mask 0 ∧
//     v > 0.5 must not occur). Measured across ALL band+deep hills rows
//     (rows 48..56, 555k+ cells): evaluator v spans [0.7191, 1.2809] ⊂
//     sand/rock's catch-all [0.53, 3.5), so the classifier's reject
//     arms (soil limit_y, coal rare-polka, band [0, 3.5]) are never
//     reached through current data — deterministic, re-checked in the
//     dig-97 diagnostics. Reject semantics are unit-pinned in
//     surface-level.test; this pins the WIRING (table builds from
//     def.filename, no throw, no unexpected null).
//  3. frame probes — constructed soil-exclusive v = 0.505 at REAL lane
//     coords straddling soil's limit_y (shallow 405 ≤ 424.229 ⇒ soil
//     catches; deep 505 ⇒ gated), plus the two eliminated frames (raw
//     canvas +24576 ⇒ ≫ 424.229 rejects; world @OFFSET_Y=14 ⇒
//     y − 7168 = −6763 < −1024 rejects) — C76's elimination argument
//     executed against the real classifier + fixture.
//
// Data-gated: needs the extracted biome map + hills.xml (no extracted
// data → skipped, like the rest of the battery).

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { noiseChunkMask } from "../../mapgen/lib/noise-terrain.mjs";
import { loadBiomeConfig } from "../../mapgen/lib/biomes.mjs";
import { evaluator2 } from "../../mapgen/lib/noise-proto.mjs";
import {
  componentFromXml,
  buildMaterialsTable,
  classify,
} from "../../mapgen/lib/surface-level.mjs";
import { dataDir, hasNoitaData, CAPTURE_SEED } from "../helpers/data.mjs";

const SKY_PX = 48 * 512; // 24576 — SKY_ROWS · CHUNK, the y frame (C76)
const MIN_X = 159.0; // biomeCfg constants (noise-terrain.mjs:63)
const MAX_X = 223.0;

// Lazy memos — describe bodies still run under vitest's skipIf, so no
// data work may happen at collection time (mirror of the
// surface-level.test fixture pattern).
let _config = null;
let _table = null;
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

// Exact mirror of the lane's default-branch math (noise-terrain.mjs):
// same expression order ⇒ bit-identical evaluator2 input.
function cell(tx, ty, cx, cy) {
  const gx = tx * 51.2 + cx + 0.5;
  const gy = ty * 51.2 + cy + 0.5;
  const v = evaluator2(gx + MIN_X, gy + MAX_X, 1.0);
  const x = tx * 512 + cx * 10 + 5;
  const y = ty * 512 + cy * 10 + 5 - SKY_PX;
  return { v, x, y };
}

// Surface-band row (canvas ty 48 = biome row 0) → the hills chunks.
function hillsChunks(limit = 99) {
  const out = [];
  for (let tx = 0; tx < 71 && out.length < limit; tx++) {
    const r = noiseChunkMask(cfg(), tx, 48, CAPTURE_SEED);
    if (r && /hills\.xml$/.test(r.def?.filename ?? "")) out.push(tx);
  }
  return out;
}

describe.skipIf(!hasNoitaData() || process.env.SURFACE_V2 === "1")(
  "SURFACE_V3 classify wiring (dig #97, data-gated)",
  () => {
    test("mask 1 ⇒ gate ∧ classify hit (round-trip)", () => {
      const t = table();
      const txs = hillsChunks();
      expect(txs.length).toBeGreaterThan(0);
      let solids = 0;
      for (const tx of txs) {
        const { mask } = noiseChunkMask(cfg(), tx, 48, CAPTURE_SEED);
        for (let cy = 0; cy < 52; cy++) {
          for (let cx = 0; cx < 52; cx++) {
            if (!mask[52 * cy + cx]) continue;
            const { v, x, y } = cell(tx, 48, cx, cy);
            expect(v > 0.5).toBe(true);
            expect(classify(t, x, y, v)).not.toBeNull();
            solids++;
          }
        }
      }
      expect(solids).toBeGreaterThan(0);
    });

    test("converse: every gate-passing cell is solid (equivalence)", () => {
      const t = table();
      const txs = hillsChunks();
      expect(txs.length).toBeGreaterThan(0);
      let n = 0;
      let rejected = 0;
      for (const tx of txs) {
        const { mask } = noiseChunkMask(cfg(), tx, 48, CAPTURE_SEED);
        for (let cy = 0; cy < 52; cy++) {
          for (let cx = 0; cx < 52; cx++) {
            const { v, x, y } = cell(tx, 48, cx, cy);
            if (!(v > 0.5)) continue;
            n++;
            if (!mask[52 * cy + cx]) {
              // if the mask rejected a gate-passing cell, classify must
              // say why (a hit here = wiring bug: fails below)
              expect(classify(t, x, y, v)).toBeNull();
              rejected++;
            }
          }
        }
      }
      expect(n).toBeGreaterThan(0);
      expect(rejected).toBe(0); // measured equivalence (see file header)
    });

    test("frame probes: C76 eliminations against the real classifier", () => {
      const t = table();
      const txs = hillsChunks();
      expect(txs.length).toBeGreaterThan(0);
      const tx = txs[0];
      const shallow = cell(tx, 48, 10, 40); // lane y = 48·512 + 400 + 5 − 24576
      const deep = cell(tx, 48, 10, 50);
      expect(shallow.y).toBe(405); // ≤ 424.229 — soil limit passes
      expect(deep.y).toBe(505); // > 424.229 — soil limit gates
      const soilV = 0.505; // soil-exclusive: coal ≥ 0.51, sand ≥ 0.53
      // band frame (the C76 decision): soil catches shallow, rejects deep
      expect(classify(t, shallow.x, shallow.y, soilV)).not.toBeNull();
      expect(classify(t, deep.x, deep.y, soilV)).toBeNull();
      // eliminated frame A — raw canvas px: surface ≈ 24576 ≫ 424.229
      expect(classify(t, shallow.x, shallow.y + 24576, soilV)).toBeNull();
      // eliminated frame B — world px @OFFSET_Y=14: surface = −7168 < −1024
      expect(classify(t, shallow.x, shallow.y - 7168, soilV)).toBeNull();
      // sanity: a catch-all v (sand band, limit_y = 0) accepts anywhere
      expect(classify(t, shallow.x, shallow.y + 24576, 0.9)).not.toBeNull();
    });
  },
);
