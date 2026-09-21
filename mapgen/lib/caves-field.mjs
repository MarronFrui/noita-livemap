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

// The (43)(a) blob-circle falloff radius span: r0 = trunc(radius + 0.5),
// skip dist² > r², t = (r − dist)/r, v = (v_arg − 1)·t + 1.0, plus the
// (y/25)⁸ top-row eave when flagged. The WRITE direction is caller-chosen:
//   dir = "min"  → write iff existing > v   (the interior CARVE lane)
//   dir = "max"  → write iff existing < v   (the surface ADD-BLEND lane)
// The raw setter's per-branch direction is byte-exact in-binary (43);
// the lane split here = the dig #29 consumer model.
// The (43)(a) blob-circle falloff radius span: r0 = trunc(radius + 0.5),
// skip dist² > r², t = (r − dist)/r, v = (v_arg − 1)·t + 1.0, plus the
// (y/25)⁸ top-row eave when flagged. The WRITE direction is caller-chosen:
//   dir = "min"  → write iff existing > v   (the interior CARVE lane)
//   dir = "max"  → write iff existing < v   (the surface ADD-BLEND lane)
// The raw setter's per-branch direction is byte-exact in-binary (43);
// the lane split here = the dig #29 consumer model.
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
function walkChain(grid, gridW, gridH, prng, x0, y0, radius, vArg, dir) {
  let x = x0, y = y0;
  for (let step = 0; step < 50; step++) {
    carveCircle(grid, gridW, gridH, Math.trunc(x) & (gridW - 1), Math.trunc(y) & (gridH - 1), radius, vArg, 1, dir);
    const d = prng.next();
    x += 0.5 + d * 1.5; // the x-step roll (FLAGGED — the fn A [0x2c] lane)
    if (prng.next() > 0.5) y += prng.next() * 4 - 2; // the y drift (FLAGGED)
  }
}

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

  const roll = (min, max) => min + Math.trunc((max - min) * prng.next());
  const rollF = (min, max) => min + (max - min) * prng.next();
  const clamped = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // ── the MOUNT phase (the y=0 bump = the ADD-BLEND over the base):
  const mountCount = roll(bc.mountainCountMin ?? 0, bc.mountainCountMax ?? 0);
  for (let b = 0; b < mountCount; b++) {
    const r = rollF(bc.mountainSizeMin ?? 1, bc.mountainSizeMax ?? 5);
    const cx = roll(0, w - 1);
    const cy = roll(0, Math.min(11, h - 1)); // the surface lock = FLAGGED
    // the bump-read from the C48 oracle: a smooth ±10-wide +0.454 hill —
    // its writer = a max-bleed stamp at v_arg ≈ 1.45 within the 1.55
    // family (the 1.454092 peak lives under the strength span ✓):
    carveCircle(field, w, h, cx, cy, r, 1.45, 1, "max");
  }

  // ── the BLOB-caves phase (the CARVE lane):
  const blobCount = roll(bc.blobCavesCountMin ?? 0, bc.blobCavesCountMax ?? 0);
  const rMin = bc.blobCavesRadiusMin ?? 1;
  const rMax = bc.blobCavesRadiusMax ?? 10;
  const sMin = bc.blobCavesStrengthMin ?? 1.5;
  const sMax = bc.blobCavesStrengthMax ?? 3;
  for (let b = 0; b < blobCount; b++) {
    const radius = rollF(rMin, rMax);
    const d = prng.next();
    const vArg = 1.549988 + d * (0.0 - 1.549988); // the C50 interp (A + d·(B−A))
    // the fn A x-wanderer: each cave = a ≤50-step CHAIN of blob stamps
    // (the walk's ≤50-step box and the per-step roll advance = byte-read;
    // the step offsets' exact rolls = FLAGGED):
    walkChain(field, w, h, prng, roll(0, w - 1), roll(0, h - 1), radius, vArg, "min");
    // the cave_childs branches (the fn A recursion / the branch count):
    const childs = roll(bc.caveChildsMin ?? 0, bc.caveChildsMax ?? 0);
    for (let c = 0; c < childs; c++) {
      walkChain(field, w, h, prng, roll(0, w - 1), roll(0, h - 1), rollF(rMin, rMax), vArg, "min");
    }
  }

  // ── the cave/worm phase (the caveCount blobs of the caveStrength span):
  const caveCount = roll(bc.caveCountMin ?? 0, bc.caveCountMax ?? 0);
  const cMin = bc.caveStrengthMin ?? 0.2, cMax = bc.caveStrengthMax ?? 1;
  for (let b = 0; b < caveCount; b++) {
    const radius = rollF(rMin, rMax);
    const vArg = rollF(cMin, cMax); // FLAGGED composition of the strength span
    walkChain(field, w, h, prng, roll(0, w - 1), roll(0, h - 1), radius, vArg, "min");
  }

  return {
    w, h, field,
    p94: toucherValue(w),
    prngState: prng.seed,
    isSolid: isSolidCell,
    meta: { blobCount, caveCount, def: def.name },
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
