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
//     - the scatter read (true 0x8EEAD0 = slab 0x4ee2d0 + 0x400800, dig
//       #81 re-pin): roll + bounds + the `< 0.5`
//       empty-cell gate + the 0x8FAFC0 recursion (dig #56).
//     - the fnB HEAD draw order (dig #65, re-scoped by C81): the pre-loop is
//       warm draw → cave_count → surface_caves_count (both the POSITIVE
//       fraction form); the count gates 0x21/0x0a/0x14/0x32 (dig #66) are
//       the WALK-side gates — Δy 33/101, childCounter 10/101 + 20/101,
//       growth 50/101 ×2 (C81 ④).
//     - the byte-closed fnA/fnB walk (C81 caller side + C82 walk body):
//       fnB's path alternation (case A chained ±0.01w / 0.05..0.25h, case B
//       trunc(lerp(0.07h,0.33h)) + trunc(lerp(5,w−5)), the switch path's
//       X-law + Y₀ = trunc(6u) + the lane-select 3 − trunc(−3u) cursor
//       factor), the two-stage budget (LERP(0.15S,0.96S) vs the flag=1
//       LERP(0.45S,0.96S), ÷Δy), and fnA's prologue/loop draw order (6
//       prologue draws → envelope → the UNCONDITIONAL roll draw → the D2
//       arm → the `push $1` stamp → Δy → the two bias draws → the x-law →
//       the >50 re-jitter → the child gate + the IN-WALK recursion). The
//       old ≤50-step x-wanderer lane (1.0 + 2.5·d)·0.2 (dig #68/#69) and
//       the rollAcc/L1 chain are RETRACTED: neither is in fnA/fnB (entry
//       (102) ⑥⑦), and the box exit is PLAIN (no `& (gridW−1)` wrap).
//       PORT STATUS (2026-09-24, dig #103 part 1): the Q3a patch per
//       entry (102) ⑦ is NOT yet applied — the code below still runs the
//       pre-(102) model (old x-wanderer lane, rollAcc/L1 chain, the
//       `& (gridW−1)` wrap, the outer `childs` loop); re-read the
//       function bodies at edit time, not this bullet.
//     - the dig #64 per-phase strength sources: L1 = clamp01((d2·0.32+0.35)
//       ·roll); L2's v_arg = the LAST L1 output × (d·0.35+0.65); L3's
//       v_arg = (d·0.1+0.1)·(d2·0.35+0.65).
//     - L2/L3 = SINGLE-POINT MAX-BLEED raises (dig #55: push $0 = the
//       path-(a) lane — they can only RAISE, never carve).
//     - the CaveStructure record roll = max − trunc(|draw|·(max−min+1))
//       (the NEGATIVE NextU scale, dig #61).
//   FLAGGED (composed model):
//     dig #81 (2026-09-22) CLOSED queue #1's count-pair→phase map (loop A
//     = cave_count @4ef701/4ef704, loop B = mountain_count @4eff36/4eff39,
//     loop C = blob_caves_count @4f05a0/4f05a9 — all byte-shown) and
//     fixed phase 1 to the mountain lane. STILL FLAGGED: loop B's inner
//     structure (per-stamp base = (int)f32(xmm4) @4f00e5, provenance
//     unpinned), the L2/L3 literal counts (120+⌊81u⌋, L2 = 2 passes; read
//     @4f1510/4f1518/4f1f01/4f1f09, not yet ported), and the y-drift span
//     (queue #2). The composition follows the byte-cited phase ORDER; the
//     per-roll draw counts inside walkChain are the model's.
import path from "node:path";
import { readPng } from "./images.mjs";
import { NollaPrng } from "./wang-js.mjs";

export const CAVES_FIELD_VER = "caves-field v4 composition (2026-09-21, the dig #55/#61/#64/#65/#68 byte-order swap; 2026-09-22 dig #81: phase 1 = mountain_count)";

// The C48-verified ×5 toucher: [P+0x94] = (w·0.5)/0.1
export function toucherValue(w) {
  return (w * 0.5) / 0.1;
}

// ── the CaveStructure RECORD phase (dig #61 byte-cited) ─────────────────────
// Per fnB's record walk (slab 0x4f0b23..0x4f0ee8):
//   count pair = [obj+0x1c]/[obj+0x20] (dig #81 correction); the roll = `value = max − trunc(
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
  { field, bytes, w, h }, { aabbMinX, aabbMaxX, aabbMinY, aabbMaxY, countMin, countMax, strengthMin, strengthMax }, prng,
  rollNeg = (min, max) => max - Math.trunc((max - min + 1) * prng.next())
) {
  const countNext = rollNeg(countMin ?? 0, countMax ?? 0);
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
    // the FLOAT stamp = the 0x8EE750 MAX-BLEED raise (flag=1, the (43)(a)
    // falloff + the ((y−1)/25)⁸ top-row eave) — the raise/eave lane for the
    // mountain-class records (the C48 bump peak 1.454092 = a 1.45..1.55
    // strength draw raised by this arm); the record's byte mark = the
    // 0x8EF950 lane below.
    carveCircle(field, w, h, x, y, Math.max(1, Math.trunc((vArg || 0.5) * 4)), vArg, 1, "max");
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

// The fn A x-wanderer's chain walk (the ≤50-step x-wanderer; the per-step
// LERP stamp + the byte-read roll chain). Byte-status:
//   - the ≤50-step box (`cmp $0x32`, dig #66) = BYTE-CITED
//   - the roll update `roll += d·0.35 − 0.25` (C46) = BYTE-CITED
//   - the L1 stamp value `clamp01((d2·0.32+0.35)·roll)` (C44/C46) = BYTE-CITED
//   - the x-step lane (dig #68/#69): `(1.0 + 2.5·draw)·0.2` composed over the
//     pivot span — the dig #68 "2-draw valve reset" reading was RETRACTED in
//     dig #69 (the (2 − trunc(0·d)) = 2 is CONSTANT, no draw in that lane).
//   - the y-drift = FLAGGED (dig #74: the 6-lane band switch = the fnB
//     band-lane cursor [−0x104], NOT the fnA stamp-walk drift; the fnA
//     window's own y-drift lane is still unread).
export function walkChain(grid, gridW, gridH, prng, x0, y0, radius, vArg, dir) {
  let x = x0, y = y0;
  let rollAcc = 0;
  for (let step = 0; step < 50; step++) {
    const d1 = prng.next(), d2 = prng.next();
    // the fn A roll chain (C46): roll += d·0.35 − 0.25 per stamp
    rollAcc = d1 * 0.35 - 0.25 + rollAcc;
    // the L1 stamp value (C44/C46): clamp01((d2·0.32+0.35)·roll)
    const v = clamp01((d2 * 0.32 + 0.35) * rollAcc);
    // the fnA walk stamp = the 0x8EE930 smoothstep LERP toward the L1
    // roll-chain value (dig #58: "air source found at the fn A stamp
    // window") — the lowering worm (deep carve centers + gradient tails).
    // The 0x8EE750 max-bleed eave setter is NOT run here: with v0 =
    // (v−1)·t+1 ≤ 1 it would REFILL the just-carved worm (max-bleed vs the
    // fresh carve) — the eave raise arm belongs to the record stamps.
    stampBlendLerp(grid, gridW, gridH, Math.trunc(x) & (gridW - 1), Math.trunc(y) & (gridH - 1), radius, v);
    // the x-step lane (dig #68 byte-read, dig #69 corrected form):
    // (1.0 + 2.5·draw)·0.2 per advance, composed over the pivot span.
    const d3 = prng.next();
    x += (1.0 + 2.5 * d3) * 0.2;
    // the y drift: FLAGGED (dig #74 retraction; the fnA window's own
    // y-drift lane is the standing unread read — queue item #2).
    if (prng.next() > 0.5) y += prng.next() * 4 - 2;
  }
}
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

// The scatter engine (true 0x8EEAD0, dig #56 byte-read end-to-end; the VA
// re-pinned from the exe in dig #81 — the old 0x8EF2D0 was a +0x800 typo):
// 1. TWO poro draws through the Random(min,max) closed form → a point rolled
//    INSIDE the record's own span (the −0.5/0.5 lanes @0x11e058c/0x11dfa94).
// 2. BOUNDS: rejected when x/y < 0 OR x ≥ w OR y ≥ h (@0x4ee42a..0x4ee43e).
// 3. THE GATE (@0x4ee456): fires ONLY when cell < 0.5 (the empty-cell
//    predicate) — then the recursive tail = true 0x8FAFC0 (the B-CHANNEL
//    recorder, dig #27; the value arg travels WITH the branch).
export function scatterEmptyGate({ field, bytes, w, h }, span, prng) {
  const dx = prng.next(), dy = prng.next();
  const x = Math.trunc(dx * span.w), y = Math.trunc(dy * span.h);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  if (field[y * w + x] >= 0.5) return null; // the < 0.5 empty-cell gate
  if (bytes) bytes[y * w + x] = 1; // the 0x8FAFC0 B-recorder lane
  return { x, y };
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
 * Stage composition — the fnB byte-cited PHASE ORDER (the dig #65 head +
 * the dig #55/#56/#57/#61 block reads; draw budget = the standing FLAG):
 *   HEAD (dig #65): draw #1 = the walker's x-range count from the
 *     [obj+0x28]/[obj+0x2c] (min,max) pair via the POSITIVE fraction form
 *     `min + trunc(draw·(max−min+1))`; draw #2 = the first record's y-cursor
 *     from the record's OWN [obj+0x34]/[obj+0x38] strength pair.
 *   1. fn A stamp walk (call #1 @0x4eff03) — the LERP-stamp pass
 *   2. the blob phase (the C50 interp on [P+0x74]/[P+0x78] → the setter;
 *      count loop `decl −0x110`; the blob radius cap = 20, dig #54)
 *   3. the CaveStructure RECORD ARENA walk (dig #61/#81: the 60-byte
 *      records, stride 0x3c; count pair [+0x1c]/[+0x20]; the NEGATIVE
 *      NextU scale roll; the strength pair [+0x34]/[+0x38]; writes =
 *      the BYTE grid, 0x8EF950)
 *   4. layer-2 setter @0x4f18d1 = SINGLE-POINT MAX-BLEED raise (dig #55:
 *      push $0 = the path-(a) lane; point = {trunc(−0x120), trunc(−0x138)};
 *      value = [−0x128]·(d·0.35+0.65) — can only RAISE)
 *      + scatter #1 (the < 0.5 empty-cell gate)
 *   5. layer-3 setter @0x4f226c = the same mask (value = [−0x108]·(d·0.35+
 *      0.65), [−0x108] = d·0.1+0.1, C44) + scatter #2
 *   6. the RECURSIVE fn B self-call (the cave_childs/surface recursion)
 * The AIR/carve = the fn A LERP stamps + the deep-roll chain (NOT L2/L3 —
 * max-bleed can only raise, the dig #55 semantic verdict).
 */
export function buildCavesField(dataDir, def, seed) {
  const bc = def.bitmapCaves;
  if (!bc || !bc.sizeX || !bc.sizeY) return null;
  const w = bc.sizeX, h = bc.sizeY;

  // fn C1's ctor chain (C27): diddled-ws poro Random + ONE warm draw.
  const prng = new NollaPrng(seed);
  prng.next();

  const field = new Float32Array(w * h).fill(1.0); // fn C1's bake
  const bytes = new Uint8Array(w * h); // the 0x8EF950 record lane ([P+0x58])

  // The byte-declared roll forms (dig #65): the count/pos pair roll =
  // `min + trunc(draw·(max−min+1))` (POSITIVE fraction); the stamp-lane
  // roll (dig #61) = `max − trunc(|draw|·(max−min+1))` (the NEGATIVE
  // NextU scale) — two distinct twins, both byte-cited.
  const rollPos = (min, max) => min + Math.trunc((max - min + 1) * prng.next());
  const rollNeg = (min, max) => max - Math.trunc((max - min + 1) * prng.next());
  const rollF = (min, max) => min + (max - min) * prng.next();
  const clamped = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  const blobCount = rollPos(bc.blobCavesCountMin ?? 0, bc.blobCavesCountMax ?? 0);
  const caveCount = rollPos(bc.caveCountMin ?? 0, bc.caveCountMax ?? 0);
  const rMin = bc.blobCavesRadiusMin ?? 1;
  const rMax = bc.blobCavesRadiusMax ?? 10;
  const sMin = bc.blobCavesStrengthMin ?? 1.5;
  const sMax = bc.blobCavesStrengthMax ?? 3;

  // ── (1) fn A stamp walk — the eave/raise lane: cave_count walks, each = a
  // ≤50-step x-wanderer of MAX-BLEED stamps (the (43)(a) falloff + eave,
  // flag=1), cave_childs branches per walk (the dig #26 recursion).
  // The stamp VALUE = the L1 roll-chain lane (clamp01((d2·0.32+0.35)·roll),
  // C44/dig #64) — the setter lifts it to ((y−1)/25)⁸·v0 + 1 near the top.
  let rollAcc = 0;
  let l1 = 0; // the [−0x128] chain base = the LAST L1 output (C44/dig 64)
  for (let c = 0; c < caveCount; c++) {
    const radius = rollF(rMin, rMax);
    const d1 = prng.next(), d2 = prng.next();
    const stampV = clamp01((d2 * 0.32 + 0.35) * rollAcc); // the L1 value lane
    rollAcc = d1 * 0.35 - 0.25 + rollAcc;                 // the roll update
    l1 = stampV; // the [−0x128] chain base = the LAST L1 output (dig 64)
    walkChain(field, w, h, prng, rollPos(0, w - 1), rollPos(0, h - 1), radius, stampV, "lerp");
    const childs = rollPos(bc.caveChildsMin ?? 0, bc.caveChildsMax ?? 0);
    for (let k = 0; k < childs; k++) {
      walkChain(field, w, h, prng, rollPos(0, w - 1), rollPos(0, h - 1), rollF(rMin, rMax), stampV, "lerp");
    }
  }

  // ── (2) the blob phases (dig #49 byte-read END-TO-END): per iteration ONE
  // 0x4ee130 setter call (a decl-loop, NOT a walk); v = the C50 interp
  // A + d·(B−A) on the cave-grid's [P+0x74]/[P+0x78] pair (@0x4f0931..
  // 0x4f0958); the blob radius cap = 20 (dig #54, `cmp $0x14`).
  // CE hills: (+0x74, +0x78) = (1.549988, 0.0) ⇒ the span [0, 1.549988] —
  // the 0x8EE930 LERP toward v < 0.5 CARVES (the deep centers + gradient
  // tails), toward v > 1 RAISES (the bump class).
  //   phase 1 = the MOUNTAIN lane (loop B count = mountain_count, read
  //   @4eff36/4eff39; dig #81), phase 2 = the blob_caves lane (loop C
  //   count = blob_caves_count, read @4f05a0/4f05a9) — the count-pair→
  //   phase mapping is CLOSED (byte-shown, dig #81). Each phase's
  //   per-stamp inner structure (loop B's base = (int)f32(xmm4) @4f00e5)
  //   stays FLAGGED until xmm4's provenance is pinned.
  const strengthA = bc.blobStrengthA ?? 1.549988; // the C50 CE knob [+0x74]
  const strengthB = bc.blobStrengthB ?? 0.0;      // the C50 CE knob [+0x78]
  const blobStamp = (countMin, countMax) => {
    const n = rollPos(countMin, countMax);
    for (let b = 0; b < n; b++) {
      const radius = Math.min(20, rollF(rMin, rMax)); // the dig #54 cap
      const d = prng.next();
      const vArg = strengthA + d * (strengthB - strengthA); // the C50 interp
      stampBlendLerp(field, w, h, rollPos(0, w - 1), rollPos(0, h - 1), radius, vArg);
    }
    return n;
  };
  const blobPhase1 = blobStamp(bc.mountainCountMin ?? 0, bc.mountainCountMax ?? 0); // dig #81: loop B = mountain_count
  const blobPhase2 = blobStamp(bc.blobCavesCountMin ?? 0, bc.blobCavesCountMax ?? 0);

  // ── (3) the CaveStructure RECORD ARENA walk (dig #61 byte-cited):
  // per record: the count pair via the NEGATIVE-scale roll; the strength
  // pair = the record's own [+0x34]/[+0x38] f32s composed A + d·(B−A);
  // the writes hit the BYTE grid (0x8EF950) — the overlay lane.
  for (const rec of bc.structures ?? []) {
    caveRecordStamp({ field, bytes, w, h }, rec, prng, rollNeg);
  }

  // ── (4) layer-2 setter (dig #55): SINGLE-POINT MAX-BLEED raise — value =
  // [−0x128]·(d·0.35+0.65); the point = {trunc(−0x120), trunc(−0x138)}
  // (the walk cursors' tail). Raises only; NEVER carves.
  const l2v = l1 * (prng.next() * 0.35 + 0.65);
  raisePointMax(field, w, h, rollPos(0, w - 1), rollPos(0, h - 1), l2v);
  let sc = scatterEmptyGate({ field, bytes, w, h }, { w, h }, prng);

  // ── (5) layer-3 setter (dig #55): same mask, value = [−0x108]·(d·0.35+
  // 0.65) where [−0x108] = d·0.1+0.1 (C44). Raises only.
  const l3v = (prng.next() * 0.1 + 0.1) * (prng.next() * 0.35 + 0.65);
  raisePointMax(field, w, h, rollPos(0, w - 1), rollPos(0, h - 1), l3v);
  sc = scatterEmptyGate({ field, bytes, w, h }, { w, h }, prng);

  return {
    w, h, field, bytes,
    p94: toucherValue(w),
    prngState: prng.seed,
    isSolid: isSolidCell,
    meta: {
      blobCount, caveCount, blobPhase1, blobPhase2, l1, l2v, l3v, sc,
      def: def.name, structures: (bc.structures ?? []).length,
    },
  };
}

// The layer-2/3 setter lane (dig #55): the single-point MAX-BLEED write
// (write iff new > existing, the getter/setter 0x5491f0 family).
function raisePointMax(grid, gridW, gridH, x, y, v) {
  if (x < 0 || y < 0 || x >= gridW || y >= gridH) return;
  const idx = y * gridW + x;
  if (grid[idx] < v) grid[idx] = v;
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
