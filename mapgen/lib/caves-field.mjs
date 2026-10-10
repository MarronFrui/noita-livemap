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
//     - the CaveStructure record roll = max − trunc(|draw|·(max−min+1))
//       (the NEGATIVE NextU scale, dig #61).
//   READ SETTLED dig #119 (2026-10-10, entry (119) + C98 + §8 row 39) and
//     PORTED dig #120 (2026-10-10, entry (120) + C99 + §8 row 40): the
//     blob phases, L2/L3, and the blend now run the byte laws:
//       loop B = mountain_count top-band VERTICAL RUNS (K = 0.1h @0x8f0780;
//         per stamp base = ⌊K·u⌋, X = rollPos(5,w−5), R = rollF(mountain_
//         size [+0x5c]/[+0x60]), Y_end = base+⌊11u⌋+15 [the −2⁻³¹+sub
//         idiom 0x11e0578/0x11dff38]; the 20% coin → Y_end := base and
//         v := 1.5+0.25u [direct-call draw]; rows base..Yend → blend with
//         the UNCONDITIONAL R += 0.5(1+u) and the 50% decay coin
//         v *= 0.97+0.03u) — NO min(20) cap;
//       loop C = blob_caves_count stamps, y = rollPos(25,h−5) FIRST, x =
//         rollPos(5,w−5), v = rollF(blob_caves_strength [+0x6c]/[+0x70]),
//         R = rollF(blob_caves_radius [+0x74]/[+0x78]);
//       L2 = exactly 2 passes (arm A rollF(3.5,35); arm B flips [−0x104]
//         then rollF(25,75)), y₀ = 0, count = 120+⌊81u⌋, chain = 3u+1,
//         scale = 0.1u+0.1 (0x11df974), vel = sign·(1.25+2.25u); per
//         point 7 draws incl. the spawn coin;
//       L3 = the do_beginning_down (config[+0x31]) gate + the module MSVC
//         C-rand setup (lo/hi/x₀ from r₁r₂r₃, vel from r₄) then the same
//         per-point laws with chain clamp [lo,hi] and vel clamp ±1.0;
//       blend = t = (R²−d²)/R², w = t², and the R ≤ 1 single-cell
//         min-guard arm (write iff cell > v).
//     C50 OVERTURNED (§8 row 40): [+0x74]/[+0x78] = blob_caves_RADIUS
//     (C52's slot map) — the old C50 strengthA/B interp, the min(20) cap,
//     and the uniform y∈[0,h−1] stamps are gone.
//     SETTLED dig #120 (C99): the 0x8EE750 setter's branch is on VALUE >
//     1.0 and its flag gates ONLY the y<25 eave — both flags are LOWER-
//     only (single-cell target = scale when value ≤ 1; circle target =
//     1 + t·(scale−1)). L2/L3 use setterStamp (that law, flag=0); the
//     walk/record lanes keep carveCircle (their dir="max" + (43)(a) t
//     law = a separate open reconciliation pending the walk call-site
//     read — see the walkChain comment).
//   STILL FLAGGED: the y-drift span (queue #2, entry (74), deferred
//     pending the fnA window read); walkChain's per-roll draw budget (the
//     model's); the spawn-lane selector/scatter draws — the port's spawn
//     keys are unparsed (null) so the byte's `cmpl $0` gates skip them
//     (FLAGGED stream divergence, ~0.15 draws/point on coin-hits,
//     contained because L3 is the last phase).
//     The composition follows the byte-cited phase ORDER; the
//     per-roll draw counts inside walkChain are the model's.
import path from "node:path";
import { readPng } from "./images.mjs";
import { NollaPrng } from "./wang-js.mjs";

export const CAVES_FIELD_VER = "caves-field v5 composition (2026-10-10, dig #120: loop-B top-band runs, blob y ∈ [25,h−5], L2 2-pass chains, L3 do_beginning_down chains, the t² blend + setterStamp carve arm; 2026-09-21 dig #55/#61/#64/#65/#68 byte-order swap; 2026-09-22 dig #81: phase 1 = mountain_count)";

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

// ── the 0x8EE930 stamp blend (dig #58 read; the t² law re-pinned dig #120,
// entry (120)) ───────────────────────────────────────────────────────────────
// The byte arms on `comiss 1.0,R; jb circle` @0x8ee934:
//   R ≤ 1 → SINGLE CELL: bounds (out → ret), getter, `comiss v,cell; jbe
//     ret` → write iff cell > v (a MIN-guard), write v.
//   R > 1 → circle: r0 = trunc(R+0.5), box ±r0, d² > R² → skip, t =
//     (R²−d²)/R², w = t² @0x8eea33, cell += (v − cell)·w (TWO-SIDED, no
//     guard), bounds px/py per cell (no wrap).
// v_arg is the loop-B/C rollF value, so a stamp whose source value is low
// DRAGS the cell down inside its falloff span while a strength stamp
// (> 1.0) raises it — no max-bleed guard on the circle arm (byte read
// @0x8ee9a0..0x8eeab0).
export function stampBlendLerp(grid, gridW, gridH, cx, cy, radius, vArg) {
  if (radius <= 1) {
    // the R ≤ 1 single-cell min-guard arm (write iff cell > v)
    if (cx < 0 || cy < 0 || cx >= gridW || cy >= gridH) return;
    const idx = cy * gridW + cx;
    if (grid[idx] > vArg) grid[idx] = vArg;
    return;
  }
  const r0 = Math.trunc(radius + 0.5);
  const R2 = radius * radius;
  const y0 = Math.max(0, cy - r0), y1 = Math.min(gridH - 1, cy + r0);
  const x0 = Math.max(0, cx - r0), x1 = Math.min(gridW - 1, cx + r0);
  for (let py = y0; py <= y1; py++) {
    const dy = py - cy;
    const dy2 = dy * dy;
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx;
      const d2 = dy2 + dx * dx;
      if (d2 > R2) continue;
      const t = (R2 - d2) / R2;
      const idx = py * gridW + px;
      grid[idx] += (vArg - grid[idx]) * t * t;
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
 *   2. the blob phases (the dig #120 byte port, entry (120)): loop B =
 *      mountain_count top-band runs — K = 0.1h, per stamp base = ⌊K·u⌋,
 *      X = rollPos(5,w−5), R = rollF(mountain_size), Y_end = base+⌊11u⌋+15,
 *      the 20% coin → Y_end := base + v := 1.5+0.25u, then rows base..Y_end
 *      → blend with R += 0.5(1+u) per row and the 50% decay coin
 *      v *= 0.97+0.03u; loop C = blob_caves_count stamps (y =
 *      rollPos(25,h−5) FIRST, x, v = rollF(blob_caves_strength [+0x6c]/
 *      [+0x70]), R = rollF(blob_caves_radius [+0x74]/[+0x78])) — NO radius
 *      cap (C50 overturned, §8 row 40)
 *   3. the CaveStructure RECORD ARENA walk (dig #61/#81: the 60-byte
 *      records, stride 0x3c; count pair [+0x1c]/[+0x20]; the NEGATIVE
 *      NextU scale roll; the strength pair [+0x34]/[+0x38]; writes =
 *      the BYTE grid, 0x8EF950 — unchanged)
 *   4. layer-2 chains (exactly 2 passes, entry (119)/(120)): s₀ = ±1 (a
 *      50% coin) → [−0x104]; arm A x₀ = center+s·rollF(3.5,35); arm B
 *      flips [−0x104] first, then x₀ = center+s·rollF(25,75); y₀ = 0;
 *      count = 120+⌊81u⌋; chain = 3u+1, scale = 0.1u+0.1, vel = s·(1.25+
 *      2.25u). Per point (7 draws): s2 = 0.25u+0.75; value = chain·(0.35u+
 *      0.65) → setterStamp(trunc x, trunc y, value, scale·s2); y += 0.1u+
 *      0.95; scale *= 0.01u+0.99; chain = clamp(chain·(0.5+u), 0.75, 4);
 *      vel = clamp(vel+0.5u−0.25, ±2.5); x += vel; the spawn coin (the
 *      null-key gates skip the selector/scatter)
 *   5. layer-3 chain (gated on do_beginning_down = config[+0x31], je when
 *      0): the module MSVC C-rand LCG (state·0x343fd+0x269ec3 int32,
 *      (state>>16)&0x7fff ÷ 32767; the port-local state seeded 0x132a388)
 *      → r₁ → lo = 1+r₁, r₂ → hi = 2(1+r₂), r₃ → x₀ = center+s·(3.5+2r₃);
 *      Lehmer: count = 120+⌊81u⌋, chain = lerp(lo,hi,u), scale = 0.1u+0.1;
 *      r₄ → vel = s·(0.15+0.2r₄). Per point = L2's laws with the chain
 *      clamp [lo,hi] and vel step 0.3u−0.15 clamp ±1.0
 *   6. the IN-WALK child recursion lives INSIDE walkChain (C82: the 2%
 *      gate, the shared childCounter) — the old outer fnB `childs` self-call
 *      loop is a RETRACTED false structure (C81)
 * AIR/carve: the carve writers = stampBlendLerp (two-sided) + setterStamp
 * (LOWER-only, the L2/L3 chain floor); the walk/record lanes keep
 * carveCircle's dir="max" model (FLAGGED — see the walkChain comment). The
 * old standalone L2/L3 scatter calls are gone: every scatter site lives
 * inside a chain's spawn lane (C46's call-site census).
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

  // ── (2) the blob phases — the dig #120 byte port (entry (120); loop B
  // @0x8f072a..0x8f0d92 / loop C @0x8f0d92..0x8f117b, both re-read this
  // dig). The count rolls land AFTER the walk loop (@8f072a; the C81
  // pre-loop list carries only cave_count + surface_caves_count); phase 1's
  // roll → stamps, then blobCount → phase 2 (the dig #49 phase order,
  // unchanged). The count-pair→phase map is byte-shown (dig #81: loop B =
  // mountain_count @4eff36/4eff39, loop C = blob_caves_count @4f05a0/
  // 4f05a9).
  //
  // loop B = the MOUNTAIN lane, top-band VERTICAL RUNS per stamp:
  //   u₁: base = ⌊f32(K·u₁)⌋ (K = 0.1h, f32 @0x8f0780, const 0x11df974)
  //   u₂: X = 5 + ⌊(w−9)·u₂⌋  (the −2⁻³¹+sub idiom ≡ rollPos(5,w−5))
  //   u₃: R = rollF(mountain_size [+0x5c]/[+0x60]) — NO cap → [−0x124]
  //   u₄: Y_end = base + ⌊11·u₄⌋ + 15 (11.0 f64 0x11dff38 + the sub idiom)
  //   v := 1.5 (0x11dfd2c); u₅: the 20% coin ⌊101·u₅⌋ < 20 →
  //       Y_end := base AND u₆ (the direct-call draw `call 0x10098c0`
  //       @0x8f0b08) → v := 1.5+0.25·u₆
  //   guard base > Y_end → skip rows (dead: Y_end ≥ base always)
  //   rows row = base..Y_end inclusive (the row-y lives in the pos pair):
  //     blend((X,row), R, v) @0x8f0b6d → u: R += 0.5·(1+u) (unconditional)
  //     → u: the 50% coin ⌊101·u⌋ < 50 → u: v *= 0.97+0.03·u
  //
  // loop C = the blob_caves lane; per stamp exactly 4 draws:
  //   y = rollPos(25, h−5) FIRST, x = rollPos(5, w−5),
  //   v = rollF(blob_caves_strength [+0x6c]/[+0x70]),
  //   R = rollF(blob_caves_radius [+0x74]/[+0x78]) — NO cap (C50
  //   overturned: +0x74/+0x78 = RADIUS per C52, §8 row 40),
  //   blend @0x8f115f.
  //
  // (The in-byte f32 forms are computed in f64 here — the standing
  // f32-trap deviation class, documented in the header.)
  const mtMin = bc.mountainSizeMin ?? 1;
  const mtMax = bc.mountainSizeMax ?? 10;
  const blobPhase1 = (() => {
    const n = rollPos(bc.mountainCountMin ?? 0, bc.mountainCountMax ?? 0);
    if (n <= 0) return 0;
    const K = h * 0.1;
    for (let b = 0; b < n; b++) {
      const base = Math.trunc(K * prng.next());
      const X = 5 + Math.trunc((w - 9) * prng.next());
      let R = rollF(mtMin, mtMax);
      let Yend = base + Math.trunc(11 * prng.next()) + 15;
      let v = 1.5;
      if (Math.trunc(101 * prng.next()) < 20) {
        Yend = base;
        v = 1.5 + 0.25 * prng.next(); // the direct-call draw u₆
      }
      for (let row = base; row <= Yend; row++) {
        stampBlendLerp(field, w, h, X, row, R, v);
        R += 0.5 * (1 + prng.next());
        if (Math.trunc(101 * prng.next()) < 50) v *= 0.97 + 0.03 * prng.next();
      }
    }
    return n;
  })();
  const blobCount = rollPos(bc.blobCavesCountMin ?? 0, bc.blobCavesCountMax ?? 0);
  const blobPhase2 = (() => {
    if (blobCount <= 0) return 0;
    for (let b = 0; b < blobCount; b++) {
      const y = rollPos(25, h - 5); // the dig #120 y-FIRST order
      const x = rollPos(5, w - 5);
      const v = rollF(sMin, sMax); // blob_caves_strength
      const R = rollF(rMin, rMax); // blob_caves_radius — the cap RETRACTED
      stampBlendLerp(field, w, h, x, y, R, v);
    }
    return blobCount;
  })();

  // ── (3) the CaveStructure RECORD ARENA walk (dig #61 byte-cited):
  // per record: the count pair via the NEGATIVE-scale roll; the strength
  // pair = the record's own [+0x34]/[+0x38] f32s composed A + d·(B−A);
  // the writes hit the BYTE grid (0x8EF950) — the overlay lane.
  for (const rec of bc.structures ?? []) {
    caveRecordStamp({ field, bytes, w, h }, rec, prng, rollNeg);
  }

  // ── (4) layer-2 chains — the dig #120 byte port (entry (119)/(120); L2
  // @0x8f1a22..0x8f2595). Head (draw-ordered): s₀ := +1 → [−0x104], then a
  // 50% coin ⌊101·u⌋ < 50 → s₀ := −1.0 (0x11e05a8); y₀ := 0 → [−0x140].
  // Exactly 2 passes (the [−0x10c] pass counter, `cmp $2; jl` @0x8f2595).
  // Per pass:
  //   center = f32(w)·0.5 (recomputed in-byte per pass; no draw)
  //   pass 0 (arm A): roll = 3.5 + 31.5·u → x₀ = center + s·roll
  //   pass 1 (arm B): [−0x104] := −s FIRST (xorps), then roll = 25 + 50·u
  //       → x₀ = center + s·roll with the flipped sign
  //   count = 120 + ⌊81·u⌋ → [120,200] (the ≤0 guard is dead)
  //   chain = 3·u+1 → [−0x128]; scale = 0.1·u+0.1 → [−0x108] (const
  //       0x11df974 @0x8f1e6d); vel = s·(1.25 + 2.25·u) — drawn AFTER the
  //       cmpl but unconditionally (jle not taken, count ≥ 120)
  //   per point (7 draws): u_a: s2 = 0.25·u+0.75 → [−0x100];
  //     u_b: value = chain·(0.35·u+0.65) (0x11dfa20/0x11dfb14) →
  //       setterStamp(trunc x, trunc y, value, scale·s2) @0x8f20d1 (the
  //       0x8EE750 flag=0 arm, `push $0` @0x8f2079);
  //     u_c: y += 0.1·u+0.95 (0x11df970 @0x8f216b);
  //     u_d: scale *= 0.01·u+0.99;
  //     u_e: chain = clamp(chain·(0.5+u), 0.75, 4.0) (0x11dfb2c/0x11e005c);
  //     u_f: vel = clamp(vel + (0.5·u − 0.25), −2.5, 2.5) (0x11dff10/
  //       0x11e0618); count--; x += vel;
  //     u_g: the spawn coin ⌊101·u⌋ < 5 → the byte's spawn-item/
  //       small-enemy lookup ptrs gate the selector draw (`cmpl $0` →
  //       skip); the port's spawn keys are unparsed (null) ⇒ skip ⇒ NO
  //       selector/scatter draws (FLAGGED stream divergence, ~0.15
  //       draws/point on coin-hits — contained, L3 is the last phase).
  let l2Calls = 0;
  let armSign = 1; // the [−0x104] slot
  if (Math.trunc(101 * prng.next()) < 50) armSign = -1;
  const center = w * 0.5;
  const y0 = 0;
  for (let pass = 0; pass < 2; pass++) {
    let x0;
    if (pass === 0) {
      x0 = center + armSign * rollF(3.5, 35);
    } else {
      armSign = -armSign; // arm B flips [−0x104] BEFORE the roll
      x0 = center + armSign * rollF(25, 75);
    }
    const count = 120 + Math.trunc(81 * prng.next());
    let chain = 3 * prng.next() + 1;
    let scale = 0.1 * prng.next() + 0.1;
    let vel = armSign * (1.25 + 2.25 * prng.next());
    let y = y0, x = x0;
    for (let i = 0; i < count; i++) {
      const s2 = 0.25 * prng.next() + 0.75;
      const value = chain * (0.35 * prng.next() + 0.65);
      setterStamp(field, w, h, Math.trunc(x), Math.trunc(y), value, scale * s2);
      y += 0.1 * prng.next() + 0.95;
      scale *= 0.01 * prng.next() + 0.99;
      chain = Math.min(4.0, Math.max(0.75, chain * (prng.next() + 0.5)));
      vel = Math.min(2.5, Math.max(-2.5, vel + (0.5 * prng.next() - 0.25)));
      x += vel;
      prng.next(); // the spawn coin — the null-key gates skip the rest
      l2Calls++;
    }
  }

  // ── (5) layer-3 chain — the dig #120 byte port (L3 @0x8f259b..0x8f2f17).
  // Gate: config[+0x31] = do_beginning_down, `cmpb $0,0x31(%eax); je
  // 0x8f2fa5` — hills.xml declares 1 (on-disk 2026-10-10). The setup runs
  // a SEPARATE MSVC C-rand LCG with a persistent global (0x132a388):
  //   state' = state·0x343fd + 0x269ec3 (int32); r = (state' >> 16) & 0x7fff
  //   ÷ 32767.0 (0x11e04bc) — 3 draws @0x8f25ab..0x8f2626, state stored
  //   back once after r₃:
  //     r₁ → lo = 1 + r₁ → [−0x10c]; r₂ → hi = 2·(1 + r₂) → [−0x12c];
  //     r₃ → x₀ = center + s·(3.5 + 2·r₃) (s = [−0x104] = the value L2's
  //       arm B left, i.e. −s₀)
  // then the Lehmer stream: count = 120+⌊81·u⌋; chain = lo + (hi−lo)·u;
  // scale = 0.1·u+0.1 (0x11df974 @0x8f2881); r₄ (a 4th C-rand,
  // interleaved @0x8f284a) → vel = s·(0.15 + 0.2·r₄) (0x11df9b0/0x11df99c).
  // Per point = L2's laws with chain = clamp(chain·(0.5+u), lo, hi)
  // (@0x8f2c3d..0x8f2c91) and vel = clamp(vel + (0.3·u − 0.15), ±1.0)
  // (0x11df9f0/0x11df99c; ±1.0 = 0x11dfbf0/0x11e05a8); same spawn coin.
  let l3Calls = 0;
  if (bc.doBeginningDown) {
    // the port-local LCG state (the game's global seed is unknowable → a
    // fixed seed; deterministic per call ⇒ the build stays pure)
    let crand = 0x132a388;
    const msvcRand = () => {
      crand = (Math.imul(crand, 0x343fd) + 0x269ec3) | 0;
      return (crand >> 16) & 0x7fff;
    };
    const r1 = msvcRand() / 32767, r2 = msvcRand() / 32767, r3 = msvcRand() / 32767;
    const lo = 1 + r1, hi = 2 * (1 + r2);
    const x0 = center + armSign * (3.5 + 2 * r3);
    const count = 120 + Math.trunc(81 * prng.next());
    let chain = lo + (hi - lo) * prng.next();
    let scale = 0.1 * prng.next() + 0.1;
    const r4 = msvcRand() / 32767;
    let vel = armSign * (0.15 + 0.2 * r4);
    let y = y0, x = x0;
    for (let i = 0; i < count; i++) {
      const s2 = 0.25 * prng.next() + 0.75;
      const value = chain * (0.35 * prng.next() + 0.65);
      setterStamp(field, w, h, Math.trunc(x), Math.trunc(y), value, scale * s2);
      y += 0.1 * prng.next() + 0.95;
      scale *= 0.01 * prng.next() + 0.99;
      chain = Math.min(hi, Math.max(lo, chain * (prng.next() + 0.5)));
      vel = Math.min(1.0, Math.max(-1.0, vel + (0.3 * prng.next() - 0.15)));
      x += vel;
      prng.next(); // the spawn coin — the null-key gates skip the rest
      l3Calls++;
    }
  }

  return {
    w, h, field, bytes,
    p94: toucherValue(w),
    prngState: prng.seed,
    isSolid: isSolidCell,
    meta: {
      blobCount, caveCount, blobPhase1, blobPhase2, l2Calls, l3Calls,
      def: def.name, structures: (bc.structures ?? []).length,
    },
  };
}

// The 0x8EE750 setter's flag=0 arm (the dig #120 read, entry (120) — C96):
// the L2/L3 chain stamp. Branch on VALUE > 1.0 (comiss 0x11dfbf0 @0x8ee766):
//   value ≤ 1 → SINGLE CELL: bounds → getter → write iff cell > scale
//     (a MIN-guard, `comiss scale,cell; jbe ret`), write scale.
//   value > 1 → CIRCLE: r0 = trunc(value+0.5), box ±r0, d² > value² →
//     skip, t = (value²−d²)/value², target = 1 + t·(scale − 1) (the flag=0
//     arm SKIPS the y<25 eave `q⁸·(target−1)+1`), bounds px/py (no wrap),
//     write iff cell > target (LOWER-only), write target.
// So both flags are lower-only; the flag gates ONLY the top-band eave
// (y < 25). scale here = the chain's scale·s2 ∈ (0, ~0.2): the chains can
// only carve toward their floor — the single-cell arm writes cells down to
// ~0.075 (the deep-carve lane), the circle arm targets ∈ [scale, 1].
// The walk/record lanes keep carveCircle (their dir="max" model + the
// (43)(a) t law = a separate open reconciliation, see walkChain).
function setterStamp(grid, gridW, gridH, x, y, value, scale) {
  if (value <= 1) {
    if (x < 0 || y < 0 || x >= gridW || y >= gridH) return;
    const idx = y * gridW + x;
    if (grid[idx] > scale) grid[idx] = scale;
    return;
  }
  const R2 = value * value;
  const r0 = Math.trunc(value + 0.5);
  const y0 = Math.max(0, y - r0), y1 = Math.min(gridH - 1, y + r0);
  const x0 = Math.max(0, x - r0), x1 = Math.min(gridW - 1, x + r0);
  for (let py = y0; py <= y1; py++) {
    const dy = py - y;
    const dy2 = dy * dy;
    for (let px = x0; px <= x1; px++) {
      const dx = px - x;
      const d2 = dy2 + dx * dx;
      if (d2 > R2) continue;
      const t = (R2 - d2) / R2;
      const target = 1 + t * (scale - 1);
      const idx = py * gridW + px;
      if (grid[idx] > target) grid[idx] = target;
    }
  }
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
