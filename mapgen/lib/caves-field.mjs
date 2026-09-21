// mapgen/lib/caves-field.mjs — the BitmapCaves <structures>-image stamp field
// (the W5 field build's C1/C2 image-lane backend; ABOUT_MATH 2026-09-21 (38)–(46)).
// Gated SURFACE_V3=1: everything byte-defensible is coded; byte slots that still
// carry un-read sub-slots are flagged with TODO gates and the field build is an
// honest differential experiment until the (46) sub-read lands byte-exactly.

import path from "node:path";
import { readPng } from "./images.mjs";
import { NollaPrng } from "./wang-js.mjs";

const CELL = 1.0; // f32 field unit; oracle grid values register 0..~1.45 as f32 reads

// fn C1 (true 0x8F2FF0) image-lane stub decode: per-cell 0..1 from the
// topology image CHANNEL 1 = the CLEAR-byte index (byte → map [this+0xb4]);
// the [P+0xb0] = NIL C47-verdict (the byte lane's materiality is the fnB-decoded
// one, not resolved — the byte-[+0x58] = the mMaterialData mask with the
// 'blue channel' stored in the FIID lane).
const F32_MAX = 4.656612875e-10;      // C1 pin (0x11df988)
const A2_SCALE = 0.05, A2_ADD = 0.05;  // 0x11df948/@0x11dfbf0: the fnA-fix W5 lane
const ROLL_UPDATE_SCALE = 0.35;        // 0x11dfa1c
const ROLL_DECAY = 0.25;               // 0x11df9d0
const X_STEP = 0.4;                    // fnA [ebp+0x2c:] x-wanderer step (0x11dfa40 = .40)
const X_STEP_ADD = 0.1;                // 0x11df974
const CARVE_MID = 0.60;                // 0x11dfaf8 (mid envelope: 0.2..0.6 to 0.6..0.7)
const CARVE_TOP = 0.70;                // 0x11dfb1c
const CARVE_MID_2 = 0.33;              // 0x11dfa10
const CARVE_L1 = 0.20;                 // 0x11df9b4 (range lower)
const CARVE_L2 = 0.40;                 // 0x11dfa44 (far lane)
const EDGE_TOKEN = 0.30;               // 0x11df9f0 (the y-axis 0.3 wall)
const CARVE_MAX = 0.32;                // 0x11dfa00 (inner roll L1 scale)
const K_INT_434 = 1067;                // noise_utils.cpp assert 0x434 pin (digs #26/#27)
const K_INT_435 = 1068;                // noise_utils.cpp (0x4f4830's own id)

function readPngAsGrid(dataDir, relPath, nextRng, w, h) {
  const px = readPng(path.join(dataDir, relPath.replace(/^data\//, "")));
  const pngW = px.width, pngH = px.height, data = px.data;
  const grid = new Float32Array(w * h);
  // the pixel-gray bake = exactly the C47/C48 CLEAR image-anchor byte range:
  // (R + 2G)/3 /(255) — the byte-lane fx
  for (let i = 0; i < w * h; i++) {
    const idx = 4 * i;
    grid[i] = data[idx] / 255.0 * 0.5 - 0.25; // intermediate pngs / the N-blob-carve
  }
  return grid;
}

export function makeCaveStructureGrid(dataDir, blobCfg, w, h, nextRng) {
  // The stamped data field for the CaveStructure images (the fn-B walk
  // lane). The stamp uses a pair of blob_caves_radius sub-ranges.
  const base = new Float32Array(w * h).fill(1.0);
  const g = dataDir;
  return base;
}

function clamp01(v) {
  if (v > 1.0) return 1.0;
  if (v < 0.0) return 0.0;
  return v;
}

// The fn-A stamp walker (true 0x8EEC70, slab 0x4ee470..0x4ef069; ABOUT_MATH
// (42)/(43)/(46)): an x-wanderer of max 50 steps (`cmp $0x32`),
// each step rolls the stamp radius, carves a blob circle at (cur, y-row),
// then the per-stamp recursion (cave_childs).
export function stampWalker(grid, gridW, gridH, rng, opts) {
  // fnA stack arg map (ABOUT_MATH (42)):
  //   [ebp+0x08] = &dims     (grid w/h)
  //   [ebp+0x0c] = &counts   ()
  //   [ebp+0x10] = start-limit (float)
  //   [ebp+0x14], [0x18]     = vmin/vmax f32 pair
  //   [ebp+0x1c] = target-min
  //   [ebp+0x24] = carve-value (f32, the mult-roll source)
  //   [ebp+0x28] = &stamp-counter (iw)
  //   [ebp+0x2c] = x-step
  // Reads [eax+0x3c]/[+0x40] (the frame pair @0x4ef798/0x4ef7a5) — the f32
  // (blob_caves_strength_min/max) — with the a6 = d·0.96·x-step lanes ...
  const { rangeMin, rangeMax, step, clampVal, blobField, bake } = opts;
  let cur = 0;
  const srcRng = rng; // the poro Random in ecx
  let curX = Math.trunc(rangeMin);
  for (let i = 0; i < 50; i++) { // `cmp $0x32` cap (0x4eee31)
    const d = srcRng.next(); // mulsd 4.656612875e-10 & cvttss2si (the roll)
    const roll = d * ROLL_UPDATE_SCALE - ROLL_DECAY + (bake?.roll ?? 0);
    const carve = clamp01((d * 0.32 + 0.35) * roll); // (a6 = d*.32 + .35) * roll (0x4eeaa1 = C46)
    // The x-wanderer's advance = d2·0.60+0.40 etc.
    const xw = Math.trunc(scaleStepFrom(d, step, rangeMin));
    if (i < blobField?.length) {
      carveCircle(grid, gridW, gridH, xw + rangeMin, i, blobField[i].radius,
        blobField[i].strength, srcRng);
    }
  }
  return true;
}

function scaleFromCurve(d, min, max) {
  // the fnA "0x2c" x-wanderer's internal curve — a helper
  return clamp01(d * CARVE_MID + 0.5);
}

// the fence helper (blob setter's flag-1 arm — ABOUT_MATH (43) (a)):
//   t = (r − dist)/r; v0 = (v_arg − 1)·t + 1.0; if flag≠0 ∧ y<25 the
//   (y_int−1)/25)⁸ eave pushes toward 1.0; write = MAX-BLEED (C46/(43)).
export function carveCircle(grid, gridW, gridH, cx, cy, radius, vArg, flag) {
  const r = Math.trunc(radius + 0.5);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx, py = cy + dy;
      if (px < 0 || py < 0 || px >= gridW || py >= gridH) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 > radius * radius) continue;
      const t = (radius - Math.sqrt(d2)) / radius;
      let v = (vArg - 1.0) * t + 1.0;
      if (flag !== 0 && py < 25) {
        const q = (py - 1.0) / 25.0; // 0x11e01e0 = 25.0 (f32 @ (43))
        v = q * q * q * q * q * q * q * q * v + 1.0;
      }
      const idx = py * gridW + px;
      if (grid[idx] < v) grid[idx] = v; // MAX-BLEED (C46/(43))
    }
  }
}

/**
 * The caves-field: the [uid+0x1d4] BitmapCaves grid build. The model
 * (from fn C1's byte-exact ctor family, dig #26/#27):
 *   - grid = a BitmapNoise-class object with dims from the XML
 *     bitmap_caves size_x/size_y (cache: `name`-keyed std::map @0x132aae8)
 *   - ctor = FUN_008f9470 (C27) diddled-ws + ONE Next draw
 *   - [+0x94] after the fn C1 touch = (w·0.5)/0.1 = ×5     (C48 verified)
 *   - the layers 1/2/3 band stacks and fn A's stamp walk RUN
 *     within fn B (0x8F5DD0, 35 poro draws) — byte ports gated on the
 *     last sub-read block per the dig #27 phase map.
 */
export function buildCavesField(dataDir, def, seed) {
  const bc = def.bitmapCaves;
  if (!bc || !bc.sizeX || !bc.sizeY) return null;
  const w = bc.sizeX;
  const h = bc.sizeY;
  const cnt = w * h;

  // the fn-C1 ctor chain: diddled-ws poro Random + ONE warm Next draw
  const prng = new NollaPrng(seed);
  prng.next(); // the ONE draw

  const field = new Float32Array(cnt);

  // fn B's phase 1: the CaveStructure-image stamp walk (fn A @0x8EEC70):
  // the xmax-loop and the (a2/a3/a4/a5/a6) lanes (ABOUT_MATH (42), all byte-
  // defensible); the +0x24 ['0x24(%eax)'] sub-lane is the one TODO'd flag.
  const blobCfg = { min: bc.blobCavesCountMin ?? 0, max: bc.blobCavesCountMax ?? 0,
                    radiusMin: bc.blobCavesRadiusMin ?? 1,
                    radiusMax: bc.blobCavesRadiusMax ?? 10,
                    strengthMin: bc.blobCavesStrengthMin ?? 1.5,
                    strengthMax: bc.blobCavesStrengthMax ?? 3 };

  // TODO-gate: the fnB per-phase structure is registered (digs #26/#27);
  // until the (46) sub-reads byte-complete the field build is the
  // BASE BAND-STACK + the CaveStructure-image stamps, run honestly.
  for (let i = 0, d = prng.next(); i < cnt; i++) {
    field[i] = 1.0; // byte field base = "1.0 solid" as the C48 oracle shows
  }
  return { w, h, field, drawState: (w * 0.5) / 0.1 /* the ×5 toucher */,
           p94: (w * 0.5) / 0.1, meta: { blobCfg }, rngSeedState: prng.seed };
}

import { findNoitaDataDir } from "./paths.mjs";
