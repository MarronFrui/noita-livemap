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
//       PORT STATUS (2026-09-26, dig #103): APPLIED — the Q3a patch per
//       entry (102) ⑦ is in; the bodies below run the byte-closed walk
//       (the old x-wanderer lane, rollAcc/L1 chain, the `& (gridW−1)`
//       wrap, and the outer `childs` loop are gone).
//     - the per-phase strength sources: L1 = 0 — the walk writes NO
//       [−0x128] chain base (entry (102) ⑥: the caller rollF/d1/d2/
//       rollAcc/stampV draws are not in fnB walk loop); L2 v_arg =
//       0·(d·0.35+0.65) = 0 with the draw KEPT (baseline meta l1:0,
//       l2v:0 ⇒ no behavior change); L3 v_arg = (d·0.1+0.1)·(d2·0.35+
//       0.65) unchanged.
//     - L2/L3 = SINGLE-POINT MAX-BLEED raises (dig #55: push $0 = the
//       path-(a) lane — they can only RAISE, never carve).
//     - the CaveStructure record roll = max − trunc(|draw|·(max−min+1))
//       (the NEGATIVE NextU scale, dig #61).
//   FLAGGED (composed model):
//     dig #81 (2026-09-22) CLOSED queue #1's count-pair→phase map (loop A
//     = cave_count @4ef701/4ef704, loop B = mountain_count @4eff36/4eff39,
//     loop C = blob_caves_count @4f05a0/4f05a9 — all byte-shown) and
//     fixed phase 1 to the mountain lane. READ SETTLED dig #119 (2026-10-
//     10, entry (119) + C98 + §8 row 39): loop B's inner structure is
//     now byte-pinned — per-stamp base = ⌊0.1h·u⌋ (slab 4f00e5 = VA
//     0x8F08E5 ✓), X = rollPos(5,w−5), R = rollF32(mountain_size) +
//     Σ0.5(u+1)/row (NO min(20) cap), Y_end = base+⌊11u⌋+15 (→ base on
//     the 20% coin, which also sets v := 1.5+0.25u), v = 1.5 decaying
//     ×(0.97+0.03u) on 50% of rows — i.e. top-band VERTICAL RUNS, not a
//     uniform stamp; blob stamps use y ∈ [25,h−5]; and the L2/L3 literal
//     counts are confirmed (120+⌊81u⌋ both; L2 = exactly 2 passes @
//     0x8f2585–0x8f2595; cites 4f1510/4f1518/4f1f01/4f1f09 ✓ exact).
//     Full laws + the t² blend reconciliation live in entry (119);
//     NOT YET PORTED — porting + the C97 IoU A/B is the next dig (this
//     composition is expected to change). STILL FLAGGED: the y-drift
//     span (queue #2, entry (74), deferred pending the fnA window read).
//     The composition follows the byte-cited phase ORDER; the
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

// The byte-closed fnA walk (C82: the 6 prologue draws + the per-iteration
// draw order; C81's caller supplies cursor/budget/d0sq/dy/growth/childCounter
// — the entry (102) frozen design). Per iteration: the trunc pair → the
// PLAIN box exit (no `& (gridW−1)` wrap) → the cursor gate → the 3-segment
// lane/radius envelope → the UNCONDITIONAL roll draw → the coin-gated D2
// arm (one draw) → clamp01 → the `push $1` stamp (flag=1, dir="max" — the
// walk can only RAISE; the pushed-$1 LERP-vs-max arm inside 0x8ee750 stays
// FLAGGED) → y += Δy → the spawn gate (spawn_percent is not parsed ⇒ 0 ⇒
// the byte-identical skip, no draw) → the two bias draws → the d-split
// x-law draw (clamp(lerp(min,max,u) + bias, −1, 1)) → substeps > 50's
// growth-gate draw (fire ⇒ substeps := 0 + the LINEAR 2u−1 re-jitter that
// CLOBBERS the pushed square) → the child gate (cc ≤ 0 ⇒ NO draw; else the
// 2% gate draw, cc−− BEFORE the budget draw, the childBudget draw
// (u·50−50) + (budget−steps), the IN-WALK recursion with the CURRENT
// trunc pair, the same cursor, d0sq = −parent's, and the SHARED cc) →
// steps++ → continue iff steps ≤ budget.
export function walkChain(grid, gridW, gridH, prng, x0, y0, cursor, budget, walk) {
  // C82's 6 prologue draws (the gates between them draw nothing):
  const flagD2 = Math.trunc(prng.next() * 101) < 50 ? 1 : 0; // the D2 coin
  const s = (2 - Math.trunc(-4 * prng.next())) / 5; // the s span ∈ {0.4..1.0}
  const rA = 0.2 * prng.next() * s; // the envelope anchors A..D
  const rB = (1 + 2.5 * prng.next()) * s;
  const rC = (1 + 2.5 * prng.next()) * s;
  const rD = 0.2 * prng.next() * s;
  if (budget < 0) return; // the pre-loop budget gate (0 > budget ⇒ epilogue)
  let x = x0, y = y0;
  let steps = 0, substeps = 0;
  let d0 = walk.d0sq; // [ebp+0x1c]: the re-jitter CLOBBERS this copy
  const { dy, growth } = walk;
  const cc = walk.cc; // SHARED with the in-walk recursion (decl per spawn)
  for (;;) {
    const tx = Math.trunc(x), ty = Math.trunc(y);
    if (tx < 0 || ty < 0 || tx >= gridW || ty >= gridH) return; // the plain box exit
    if (cursor <= 0) return; // the cursor gate
    const t = steps / budget;
    // the 3-segment lane (t<0.2 | 0.2..0.6 | >0.6)
    let lane;
    if (t < 0.2) lane = cursor * (t / 0.2);
    else if (t <= 0.6) lane = cursor + (0.7 - cursor) * ((t - 0.2) / 0.4);
    else lane = 0.7 - 0.7 * ((t - 0.6) / 0.6);
    let slot = 1 - lane; // [−0x28] = 1 − lane, reset every iteration
    // the 3-segment radius envelope (t<0.3 | 0.3..0.6 | >0.6)
    let radius;
    if (t < 0.3) radius = rA + (rB - rA) * (t / 0.3);
    else if (t <= 0.6) radius = rB + (rC - rB) * ((t - 0.3) / 0.3);
    else radius = rC + (rD - rC) * ((t - 0.6) / 0.6);
    slot += prng.next() * 0.35 - 0.25; // the UNCONDITIONAL roll draw
    if (flagD2 !== 0) slot = (prng.next() * 0.32 + 0.35) * slot; // the D2 arm
    const v = clamp01(slot);
    carveCircle(grid, gridW, gridH, tx, ty, radius, v, 1, "max"); // `push $1`
    y += dy;
    // the spawn gate omitted (spawn_percent = 0 port-side ⇒ byte-identical skip)
    let bias = 0;
    if (Math.trunc(prng.next() * 101) < 25) bias = -1;
    if (Math.trunc(prng.next() * 101) < 25) bias += 1;
    const hi = d0 > 0 ? d0 : 0, lo = d0 > 0 ? 0 : d0; // the d-split
    const step = lo + (hi - lo) * prng.next() + bias; // the x-law draw
    x += step < -1 ? -1 : step > 1 ? 1 : step; // clamp(·, −1, 1)
    substeps++;
    if (substeps > 50) {
      const u = prng.next(); // the growth-gate draw
      if (growth > u) {
        substeps = 0;
        d0 = 2 * prng.next() - 1; // the LINEAR re-jitter (clobbers the square)
      }
    }
    if (cc.n > 0) {
      const u = prng.next(); // the 2% child gate draw
      if (u * 100 < 2) {
        cc.n--; // decl BEFORE the budget draw
        const childBudget = (prng.next() * 50 - 50) + (budget - steps);
        walkChain(grid, gridW, gridH, prng, tx, ty, cursor, childBudget,
          { d0sq: -d0, dy, growth, cc });
      }
    }
    steps++;
    if (steps > budget) return; // continue iff f32(steps) ≤ budget
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
 * Stage composition — the fnB byte-cited PHASE ORDER (C81 caller side +
 * C82 walk body; the dig #55/#56/#57/#61 block reads; draw budget = the
 * standing FLAG for the composed phases):
 *   HEAD (C81): draw #1 = cave_count = rollPos(config[+0x28],[+0x2c]) via
 *     the POSITIVE fraction form `min + trunc(draw·(max−min+1))`; draw #2
 *     = surface_caves_count = rollPos(config[+0x34],[+0x38]) (the switch
 *     budget). The blob phase-1 count rolls AFTER the walk loop.
 *   1. the byte-closed walk (C81 caller + C82 body): cave_count walks —
 *      the per-walk cursor (the C52 cave_strength lerp), the path
 *      alternation (case A chained / case B + the surface switch), the
 *      two-arm budget, and walkChain's raise-only `push $1` stamps
 *      (flag=1, dir="max"); the IN-WALK recursion replaces the old outer
 *      `childs` loop
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
 *   6. the IN-WALK child recursion lives INSIDE walkChain (C82: the 2%
 *      gate, the shared childCounter) — the old outer fnB `childs` self-call
 *      loop is a RETRACTED false structure (C81)
 * The AIR/carve = the two blob-phase LERP stamps (stampBlendLerp is the
 * ONLY lowering writer): the fnA walk, L2/L3, and the record float stamps
 * are raise-only (`push $1` max-bleed; dig #55 semantic verdict).
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

  const caveCount = rollPos(bc.caveCountMin ?? 0, bc.caveCountMax ?? 0);
  const surfaceCount = rollPos(bc.surfaceCavesCountMin ?? 0, bc.surfaceCavesCountMax ?? 0);
  const rMin = bc.blobCavesRadiusMin ?? 1;
  const rMax = bc.blobCavesRadiusMax ?? 10;
  const sMin = bc.blobCavesStrengthMin ?? 1.5;
  const sMax = bc.blobCavesStrengthMax ?? 3;

  // ── (1) the byte-closed walk (C81 caller side + C82 walk body; entry
  // (102) stage 7): cave_count walks, each = the per-walk cursor draw (lerp
  // of the C52 cave_strength pair) → path alternation (case A chained
  // ±0.01w / 0.05..0.25h with flag:=0; case B Y = trunc(lerp(0.07h,0.33h)),
  // X = trunc(5 + u(w−10)), and while switchCnt < surface_count the switch
  // path's jitter X-law + stride + clamp, Y₀ = trunc(6u), the lane-select
  // cursor factor, switchCnt++, flag:=1) → the budget section (scale0 draw
  // [consumed, unused], S = h−Y, the LERP(0.15S,0.96S) budget [flag=1
  // overwrites LERP(0.45S,0.96S)], d0, Δy, the 33/101 Δy gate, growth,
  // cc = rollPos(cave_childs) + the 10/101 bonus [+ flag=1:
  // rollPos(surface_cave_childs) + the 20/101 bonus], ÷Δy, the two 50/101
  // growth gates) → walkChain (RAISES only: the `push $1` stamp).
  const lerp = (a, b, u) => a + (b - a) * u;
  const l1 = 0; // the [−0x128] chain base = 0 (entry (102) stage 6: no caller
  //   roll chain in fnB's walk; baseline meta l1:0/l2v:0 ⇒ no change)
  let X = 0, Y = 0; // Y is overwritten by case B before its first use
  let flag = 0, switchCnt = 0;
  for (let walkIndex = 0; walkIndex < caveCount; walkIndex++) {
    // the fresh per-walk cursor: lerp(cave_strength min,max, draw)
    let cursor = lerp(bc.caveStrengthMin ?? 0.2, bc.caveStrengthMax ?? 1, prng.next());
    if (flag !== 0) {
      // case A (chained from the pre-call slots; sets flag := 0 first)
      flag = 0;
      X += Math.trunc(lerp(-0.01 * w, 0.01 * w, prng.next()));
      Y += Math.trunc(lerp(0.05 * h, 0.25 * h, prng.next()));
    } else {
      // case B: both draws land BEFORE the switch check
      Y = Math.trunc(lerp(0.07 * h, 0.33 * h, prng.next()));
      X = Math.trunc(5 + prng.next() * (w - 10));
      if (switchCnt < surfaceCount) {
        // the switch path: u3, u4 (the two jitter draws), the floor stride,
        // the sum + clamp → [X] = [pair.x]; the ratio endpoints draw no bytes
        const ratio = w / surfaceCount;
        const loE = -0.45 * ratio, hiE = 0.45 * ratio;
        const stride = Math.floor(w / surfaceCount); // the idiv form
        X = clamped(
          Math.trunc(lerp(loE, hiE, prng.next())) +
            Math.trunc(stride * walkIndex) +
            Math.trunc(lerp(loE, hiE, prng.next())),
          5, w - 5,
        );
        Y = Math.trunc(6 * prng.next()); // Y₀ ∈ {0..5}, overwrites Y_B
        // the lane select (own draw) → the jump-table cursor factor
        const lane = 3 - Math.trunc(-3 * prng.next()); // ∈ {3,4,5}
        const factor = lane === 3 ? 0.4 * prng.next() + 0.1
          : lane === 4 ? 0.25 * prng.next() + 0.75
          : 0.13 * prng.next() + 1.07;
        cursor *= factor;
        switchCnt++;
        flag = 1;
      }
    }
    // the budget section (byte order @8f03b3..8f0703)
    prng.next(); // scale0 = 0.5u+0.5 — consumed, unused (dropped scale arg)
    const S = h - Y;
    let budget = lerp(0.15 * S, 0.96 * S, prng.next());
    const d0 = 2 * prng.next() - 1; // pushed as (2u−1)²
    let dy = 0.4 * prng.next() + 0.1;
    if (Math.trunc(101 * prng.next()) < 33) dy += 0.5;
    let growth = prng.next(); // the dead +0.0 addend dropped
    let cc = rollPos(bc.caveChildsMin ?? 0, bc.caveChildsMax ?? 0);
    if (Math.trunc(101 * prng.next()) < 10) cc += Math.trunc(8 * prng.next());
    if (flag !== 0) {
      budget = lerp(0.45 * S, 0.96 * S, prng.next()); // the flag=1 overwrite
      prng.next(); // scale1 = 0.25u+0.75 — consumed, unused
      cc += rollPos(bc.surfaceCaveChildsMin ?? 0, bc.surfaceCaveChildsMax ?? 0);
      if (Math.trunc(101 * prng.next()) < 20) cc += 2 - Math.trunc(-5 * prng.next());
    }
    budget /= dy; // the ÷Δy (no draw)
    if (Math.trunc(101 * prng.next()) < 50) growth = 0;
    if (Math.trunc(101 * prng.next()) < 50) growth *= growth;
    walkChain(field, w, h, prng, X, Y, cursor, budget, {
      d0sq: d0 * d0, dy, growth, cc: { n: cc },
    });
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
  const blobStamp = (n) => {
    for (let b = 0; b < n; b++) {
      const radius = Math.min(20, rollF(rMin, rMax)); // the dig #54 cap
      const d = prng.next();
      const vArg = strengthA + d * (strengthB - strengthA); // the C50 interp
      stampBlendLerp(field, w, h, rollPos(0, w - 1), rollPos(0, h - 1), radius, vArg);
    }
    return n;
  };
  // The count rolls land AFTER the walk loop (@8f072a: the C81 pre-loop list
  // carries only cave_count + surface_caves_count); phase 1's roll → stamps,
  // then blobCount → phase 2 (the dig #49 phase order, unchanged).
  const blobPhase1 = blobStamp(rollPos(bc.mountainCountMin ?? 0, bc.mountainCountMax ?? 0)); // dig #81: loop B = mountain_count
  const blobCount = rollPos(bc.blobCavesCountMin ?? 0, bc.blobCavesCountMax ?? 0);
  const blobPhase2 = blobStamp(blobCount);

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
