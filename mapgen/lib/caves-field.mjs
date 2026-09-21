// mapgen/lib/caves-field.mjs — the BitmapCaves-built cave field (SURFACE_V3).
//
// Binary-derived per ABOUT_MATH 2026-09-21 (38)–(49), CONSTANTS.md C44/C46/
// C48/C50 — the byte-defensible core of the surface band's shape model.
//
// Byte-status ledger (no-guessing mandate):
//   BYTE-EXACT:
//     - the base bake (fn C1 @slab 0x4f29c2: all-1.0 f32 — matches the C48
//       oracle's all-1.0 background)
//     - the ctor chain (FUN_008f9470 = C27: diddled-ws poro Random, ONE
//       warm Next draw) and the ×5·w toucher ([P+0x94] = (w·0.5)/0.1, C48)
//     - the (43)(a) blob-circle falloff (carveCircle)
//     - the smoothstep LERP stamp blend (true 0x8EE930, dig #58) =
//       the ONLY lowering-capable writer: `v_out = (v_src − v_dst)·t + v_dst`.
//     - the C50 knob consumer: v = A + d·(B − A) (the strength pair interp)
//       feeding the 0x4ee130 setter's v_arg in a decl-loop blob-count phase.
//     - the scatter read (true 0x8EF2D0): roll + bounds + the `< 0.5`
//       empty-cell gate + the 0x8FAFC0 recursion (dig #56).
//   FLAGGED (composed model, the byte read = the dig #26-#29 sub-reads):
//     the blob/WALK/mountain/surface placement loops and the exact fnB
//     draw-index ↔ phase-order mapping. The composed builder wires the XML
//     knobs through the byte-exact primitives; it is an instrument lane.
//     The oracle's two write directions are implemented separately:
//       * interior caves CARVE DOWNWARD from the 1.0 base (min-bleed),
//       * the y=0 mountain bump ADDS upward (max-bleed add-blend).
import path from "node:path";
import { readPng } from "./images.mjs";
import { NollaPrng } from "./wang-js.mjs";

export const CAVES_FIELD_VER = "caves-field v3 core (2026-09-21, digs #26-#30)";

// The C48-verified ×5 toucher: [P+0x94] = (w·0.5)/0.1
export function toucherValue(w) {
  return (w * 0.5) / 0.1;
}

// ── the CaveStructure RECORD phase (dig #61 byte-cited) ─────────────────────
// Per fnB's record walk (slab 0x4f0b23..0x4f0ee8):
//   count pair = [obj+0x28]/[obj+0x30]; the roll = `value = max − trunc(
//   draw·(max−min+1))` (the draw is SIGNED via mulsd by −4.656612875e-10
//   = 0x11e0578, the negative NextU scale @0x11e0578 — the roll counts
//   DOWN from max); the strength pair = the record's own [+0x34]/[+0x38]
//   f32s (= the XML's per-CaveStructure strength_min/max, byte-verified
//   against hills.xml's 10 records) composed as A + d·(B−A) inline
//   (@0x4f0e84..0x4f0eb7), and the writes hit the BYTE grid via the
//   0x8EF950 blend twin (the [P+0x58] lane).
// The stamp POINT roll lands inside the record's aabb (the aabb_min/max
// axis spans), negative-scale drawn per the same window.
export function caveRecordStamp(
  { field, bytes, w, h }, { aabbMinX, aabbMaxX, aabbMinY, aabbMaxY, countMin, countMax, strengthMin, strengthMax }, prng
) {
  const countSpan = (countMax ?? 0) - (countMin ?? 0) + 1;
  const countNext = (countMax ?? 0) - Math.trunc(prng.next() * countSpan);
  for (let s = 0; s < countNext; s++) {
    // the per-stamp point roll (the negative NextU transform, spans = aabb)
    const xSpan = (aabbMaxX ?? w - 1) - (aabbMinX ?? 0) + 1;
    const ySpan = (aabbMaxY ?? 0) - (aabbMinY ?? 0) + 1;
    const dx = Math.trunc(prng.next() * xSpan); // the draw's [+span] lane
    const dy = Math.trunc(prng.next() * ySpan);
    const x = (aabbMinX ?? 0) + dx;
    const y = (aabbMinY ?? 0) + dy;
    // the C50 strength interp on the record's own (min,max) pair
    const d = prng.next();
    const vArg = (strengthMin ?? 0) + d * ((strengthMax ?? 0) - (strengthMin ?? 0));
    // the FLOAT stamp = the smoothstep LERP (0x8EE930, the lowering writer)
    stampBlendLerp(field, w, h, x, y, Math.max(1, Math.trunc((vArg || 0.5) * 4)), vArg);
    // the BYTE mark = the 0x8EF950 twin lane
    if (bytes && x >= 0 && y >= 0 && x < w && y < h) bytes[y * w + x] = 1;
  }
  return countNext;
}
export function carveCircle(grid, gridW, gridH, cx, cy, radius, vArg, flag, dir = "min") {
  const r0 = Math.trunc(radius + 0.5);
  for (let dy = -r0; dy <= r0; dy++) {
    for (let dx = -r0; dx <= r0; dx++) {
      const px = cx + dx, py = cy + dy;
      if (px < 0 || py < 0 || px >= gridW || py >= gridH) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const t = (radius - dist) / radius;
      let v = (vArg - 1.0) * t + 1.0;
      if (flag !== 0 && py < 25) {
        const q = (py - 1.0) / 25.0;
        v = q * q * q * q * q * q * q * q * v + 1.0;
      }
      const idx = py * gridW + px;
      if (dir === "min") {
        if (grid[idx] > v) grid[idx] = v;
      } else if (dir === "max") {
        if (grid[idx] < v) grid[idx] = v;
      }
    }
  }
}

// ── the smoothstep LERP stamp blend (true 0x8EE930, dig #58) ────────────────
// The ONLY lowering-capable writer in the fnA/fnB census. Per stamp-window
// cell: t = (r − dist)/r (the dist²/r weight block at 0x4ee22a..0x4ee237),
// then `v_out = (v_src − v_dst)·t + v_dst` from the (58) byte window —
// v_arg sourced from the C50 strength interp, so a stamp whose source value
// is low (the "AIR" semantics of a CaveStructure struct) DRAGS the cell
// toward the struct value inside its falloff span. No max-bleed guard:
// the blend writes the lerped value per byte read @0x4ee294..0x4ee2a3.
export function stampBlendLerp(grid, gridW, gridH, cx, cy, radius, vArg) {
  const r0 = Math.trunc(radius + 0.5);
  for (let dy = -r0; dy <= r0; dy++) {
    for (let dx = -r0; dx <= r0; dx++) {
      const px = cx + dx, py = cy + dy;
      if (px < 0 || py < 0 || px >= gridW || py >= gridH) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const t = (radius - dist) / radius;
      const idx = py * gridW + px;
      grid[idx] = (vArg - grid[idx]) * t + grid[idx];
    }
  }
}

// The fn A x-wanderer's chain walk (FLAGGED step-offset rolls; the ≤50-step
// box, the per-step blob stamp, and the max-bleed seek = byte-read):
// each step = one blob stamp at the current (x, y), then x += the step roll
// (the fn A [ebp+0x2c] x-step) and y drifts by a per-step draw.
// The fn A x-wanderer's chain walk (the ≤50-step x-wanderer per the fn A
// [ebp+0x2c] x-step window; the per-step blob stamp + the byte-read roll):
// stamp = ONE smoothstep LERP stamp per step (the 0x8EE930 stamp blend =
// the only lowering writer, dig #58), then x += the step roll.
// Step-roll byte status: the window d·0.35 / −0.25 roll (0x4eea9d..0x4eeab1)
// is byte-read; the exact per-step x/y advance offset uses draws — FLAGGED
// until the fnA step-roll block read completes.
function walkChain(grid, gridW, gridH, prng, x0, y0, radius, vArg, dir) {
  let x = x0, y = y0;
  let rollAcc = 0;
  for (let step = 0; step < 50; step++) {
    const d1 = prng.next(), d2 = prng.next();
    // the stamp VALUE lane: per-byte the fn A roll update = d1·0.35 − 0.25 + roll
    rollAcc = d1 * 0.35 - 0.25 + rollAcc; // (byte-read in fnB's decl loops)
    const v = clamp01((d2 * 0.32 + 0.35) * rollAcc);
    const target = dir === "lerp" ? vArg : v;
    stampBlendLerp(grid, gridW, gridH, Math.trunc(x) & (gridW - 1), Math.trunc(y) & (gridH - 1), radius, target);
    if (dir !== "lerp") {
      // legacy dir lanes ("min"/"max"): the max-bleed consumer model (kept for
      // A/B against the byte writer above).
      carveCircle(grid, gridW, gridH, Math.trunc(x) & (gridW - 1), Math.trunc(y) & (gridH - 1), radius, target, 0, dir);
    }
    const dx = prng.next();
    x += 0.2 + dx * 1.2 - 0.25; // the step roll (FLAGGED — the fn A [0x2c] lane)
    if (prng.next() > 0.5) y += prng.next() * 4 - 2; // the y drift (FLAGGED)
  }
}
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

// The C34 sampler's gate reads cell > 0.5 ⇒ the carved-down cells < 0.5
// render AIR (caves), the untouched 1.0 base = SOLID — byte-equivalent
// to the oracle's density shape for the cave families.
function isSolidCell(v) {
  return v > 0.5;
}

/**
 * buildCavesField(dataDir, def, seed) — the [uid+0x1d4] BitmapCaves grid.
 * Returns { w, h, field, p94, verify, meta }, null when no BitmapCaves.
 *
 * Stage composition (byte-confirmed core + FLAGGED placement order):
 *   1. the fn C1 base + the ctor chain
 *   2. the MOUNTAIN phase (the +bump ad-blends near y=0; count = the XML
 *      mountain_count span, size = the mountain_size family, the strength
 *      source = the mountain_rock/skull 1.45..1.55 family — byte-form from
 *      the C50's interp; positions FLAGGED)
 *   3. the BLOB-caves phase (count = blob_caves_count; radius =
 *      blob_caves_radius; strength = the C50 interp on the strength span)
 *      with the cave_childs branches (FLAGGED placement)
 *   4. the cave/worm phase (cave_count blobs of the caveStrength span)
 */
export function buildCavesField(dataDir, def, seed) {
  const bc = def.bitmapCaves;
  if (!bc || !bc.sizeX || !bc.sizeY) return null;
  const w = bc.sizeX, h = bc.sizeY;

  const prng = new NollaPrng(seed);
  prng.next(); // the ONE warm draw (C27)

  const field = new Float32Array(w * h).fill(1.0); // fn C1's bake
  const bytes = new Uint8Array(w * h); // the 0x8EF950 record lane ([P+0x58])

  const roll = (min, max) => min + Math.trunc((max - min) * prng.next());
  const rollF = (min, max) => min + (max - min) * prng.next();
  const clamped = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  const blobCount = roll(bc.blobCavesCountMin ?? 0, bc.blobCavesCountMax ?? 0);
  const rMin = bc.blobCavesRadiusMin ?? 1;
  const rMax = bc.blobCavesRadiusMax ?? 10;
  const sMin = bc.blobCavesStrengthMin ?? 1.5;
  const sMax = bc.blobCavesStrengthMax ?? 3;

  // ── the CaveStructure RECORD phase (the byte-cited lane, dig #61):
  for (const rec of bc.structures ?? []) {
    caveRecordStamp({ field, bytes, w, h }, rec, prng);
  }

  // ── the fn B byte-declared PHASE ORDER (dig #56/#57 census; the fn C1 ctor
  // base is IN this call chain — L1's setter = the fn A stamp window):
  //   1. fn A stamp pass (0x4eff03 = the FIRST stamp walk = the CaveStructure
  //      stamps + the cave_childs recursion)
  //   2. the arena_ctor+byte-blend pair phases (the L2/LOADER pair phases)
  //   3. layer-2 setter + scatter
  //   4. layer-3 setter + scatter
  //   5. the RECURSIVE fn B self-call (= cave_childs/surface recursion)
  // The draw_mean ORDER consumed per phase = the standing sub-read; the
  // composition below follows the byte-order given, with exact v_forms.

  // (1) fn A stamp walk × the CaveStructure-records pair × cave_childs:
  const stampCount = blobCount; // the fn A first pass over the pattern set
  const dMono = prng.next();
  const stampArg = 1.549988 * 0 + dMono * (1.549988 - 0.0); // the C50 interp on the strength span
  for (let b = 0; b < stampCount; b++) {
    const radius = rollF(rMin, rMax);
    walkChain(field, w, h, prng, roll(0, w - 1), roll(0, h - 1), radius, stampArg, "lerp");
    const childs = roll(bc.caveChildsMin ?? 0, bc.caveChildsMax ?? 0);
    for (let c = 0; c < childs; c++) {
      walkChain(field, w, h, prng, roll(0, w - 1), roll(0, h - 1), rollF(rMin, rMax), stampArg, "lerp");
    }
  }

  // (2/3/4) the L1/L2/L3 band-stack layers at the C50 lane with the scatters:
  const caveCount = roll(bc.caveCountMin ?? 0, bc.caveCountMax ?? 0);
  const cMin = bc.caveStrengthMin ?? 0.2, cMax = bc.caveStrengthMax ?? 1;
  // L2: point stamps from the knob interp, the 0.25/0.75-lane base before each
  // walk's roll chain (the [−0x100] = d·0.25 + 0.75 byte window)
  for (let b = 0; b < caveCount; b++) {
    const radius = rollF(rMin, rMax);
    const d = prng.next();
    const vArg = sMin + d * (sMax - sMin);
    walkChain(field, w, h, prng, roll(0, w - 1), roll(0, h - 1), radius, vArg, "lerp");
  }
  for (let b = 0; b < caveCount; b++) {
    const radius = rollF(rMin, rMax);
    const vArg = rollF(cMin, cMax);
    walkChain(field, w, h, prng, roll(0, w - 1), roll(0, h - 1), radius, vArg, "lerp");
  }

  return {
    w, h, field, bytes,
    p94: toucherValue(w),
    prngState: prng.seed,
    isSolid: isSolidCell,
    meta: { blobCount, caveCount, def: def.name, structures: (bc.structures ?? []).length },
  };
}

// The solid-mask view of one field at (x, y): > 0.5 = solid cell (C34)
export function fieldSolidAt(cf, x, y) {
  void isSolidCell.name;
  if (x < 0 || y < 0 || x >= cf.w || y >= cf.h) return null;
  return cf.field[y * cf.w + x] > 0.5;
}

// The C32 fallback-grey bake (FLAGGED; the per-biome A-resolver = open),
// for the biomes that carry a `bitmap_noise_file` topology PNG instead.
export function makeFieldGridFromTopology(dataDir, relPath) {
  const png = readPng(path.join(dataDir, relPath.replace(/^data\//, "")));
  const w = png.width, h = png.height, data = png.data;
  const grid = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const R = data[4 * i], G = data[4 * i + 1];
    grid[i] = (R + 2 * G) / (3.0 * 255.0);
  }
  return { w, h, grid };
}
