// mapgen/lib/caves-field.mjs — the BitmapCaves-built cave field (SURFACE_V3).
//
// Byte-derived per CONSTANTS.md C44/C46/C48/C50 (ABOUT_MATH §6 (38)–(49)).
//
// Byte-exact:
//   - base bake: fn C1 @slab 0x4f29c2, all-1.0 f32 (matches the C48 oracle).
//   - the ×5·w toucher: [P+0x94] = (w·0.5)/0.1 (C48).
//   - the 0x8EE930 stamp blend (stampBlendLerp) and the 0x8EE750 setter
//     (setterStamp); see their comments.
//   - the scatter read (true 0x8EEAD0 = slab 0x4ee2d0 + 0x400800): roll +
//     bounds + the `< 0.5` empty-cell gate + the 0x8FAFC0 recursion.
//   - fnB head draw order: cave_count → surface_caves_count (positive
//     fraction form); the count gates 0x21/0x0a/0x14/0x32 are walk-side —
//     Δy 33/101, childCounter 10/101 + 20/101, growth 50/101 ×2 (C81 ④).
//   - the fnA/fnB walk (C81 caller side + C82 body): fnB's path alternation
//     (case A chained ±0.01w / 0.05..0.25h; case B trunc(lerp(0.07h,0.33h))
//     + trunc(lerp(5,w−5)); the switch path's X-law + Y₀ = trunc(6u) + the
//     lane-select 3 − trunc(−3u) cursor factor), the two-stage budget
//     (LERP(0.15S,0.96S) vs flag=1 LERP(0.45S,0.96S), ÷Δy), and fnA's
//     prologue/loop draw order (see walkChain). The box exit is plain (no
//     `& (gridW−1)` wrap).
//   - the CaveStructure record phase (see caveRecordStamp).
//   - blob phases, L2/L3 and the blend (C98, C99): loop B = mountain_count
//     top-band vertical runs; loop C = blob_caves_count stamps (y first);
//     L2 = exactly 2 chain passes; L3 = the do_beginning_down chain with the
//     MSVC C-rand setup; blend t = (R²−d²)/R², w = t². [+0x74]/[+0x78] =
//     blob_caves_radius (C52 slot map; §8 row 40).
//   - setter: branch on value > 1.0, both arms lower-only; flag=1 adds the
//     circle-arm eave on stamp center y < 25, q = y/25 (C101). L2/L3 pass
//     flag=0; the walk passes flag=1 (value = radius envelope, scale =
//     clamp01(slot″)).
// FLAGGED:
//   - the y-drift span (queue #2, entry (74)), pending the fnA window read.
//   - walkChain's per-roll draw counts are the model's; the phase ORDER is
//     byte-cited.
//   - spawn-lane selector/scatter draws: the port's spawn keys are unparsed
//     (null) so the byte's `cmpl $0` gates skip them (stream divergence,
//     ~0.15 draws/point on coin-hits; contained because L3 is the last
//     phase).
import path from "node:path";
import { readPng } from "./images.mjs";
import { findNoitaDataDir } from "./paths.mjs";
import { NollaPrng } from "./wang-js.mjs";
import { simplex2d, latticeGrad2d, latticeVal2d } from "./noise-proto.mjs";

export const CAVES_FIELD_VER = "caves-field v6 walk-exit (2026-10-13, dig #127 I30: the walk's loop-top carve EXIT gate v_prev >= cursor @0x8ef109 (C105(b), comiss mapping byte-verified in dig #126) + the t<0.2 lane band's base = the carried v_prev (@0x8ef12b..0x8ef13d, not 0); the walk-length distribution = byte-BIMODAL (count-test census)); v5 composition (2026-10-10, dig #120: loop-B top-band runs, blob y ∈ [25,h−5], L2 2-pass chains, L3 do_beginning_down chains, the t² blend + setterStamp carve arm; dig #122 I26: the walk stamp = setterStamp flag=1 (lower-only carve + the center-y q⁸ eave), the record stamp = the 0x8EF870 two-sided template lerp, carveCircle retired to the legacy model; 2026-10-11 dig #123 I28: the record lane = a draws-ONLY consumer (count up-from-min + the ctor-seed/resolver-iff-$[lo-hi]/X/Y/strength per-stamp budget; the engines no-op on the ctor-empty template); 2026-09-21 dig #55/#61/#64/#65/#68 byte-order swap; 2026-09-22 dig #81: phase 1 = mountain_count)";

// The C48-verified ×5 toucher: [P+0x94] = (w·0.5)/0.1
export function toucherValue(w) {
  return (w * 0.5) / 0.1;
}

// ── CaveStructure record phase (fnB @0x8f11b3..0x8f1746; I26, I28) ─────────
//   count roll @0x8f120c..0x8f1280: count = [rec+0x1c] + trunc(u·([rec+0x20]
//     − [rec+0x1c] + 1)) — up from min (the rollPos form; the −2⁻³¹ const is
//     a trunc idiom, not a negative scale); ≤ 0 → `jle 0x8f16f1` skips the
//     record (zero draws).
//   per stamp (loop counts down: `decl [−0x120]; jne 0x8f1295`):
//     1. ctor-seed draw @0x8f12c5..0x8f130a (ctor arg = trunc(u·(2³¹−1))).
//        The ctor 0x8F9470 draws twice from a stack-local Random seeded by
//        that arg (`lea 0x8(%esp)` → 0x10098c0 ×2 @0x8f958d/0x8f9596,
//        feeding [+0x94] = u·200000 − 100000); the stream sees one draw.
//     2. image resolver @0x8f144e → 0x668400: 1 draw iff image_file carries
//        a well-formed `$[lo-hi]` group (`find('$')` @0x668494 → npos ⇒ 0
//        draws; else split the inner on "-", count ≥ 2 (`cmp $2; jae
//        0x6685dc`) ⇒ draw @0x6685ff, value = lo + trunc(u·(hi−lo+1)); a
//        malformed group logs "Error in parsing, no end in sight" @0x6685bf,
//        0 draws; the recursion @0x66873f re-runs on the substituted string
//        ⇒ 1 draw per well-formed group). XML census (102 CaveStructure
//        records): 94 plain, 7 `$[0-999]`, 1 `$[1-4]`.
//     3. roll @0x8f14b6 (store @0x8f1518): [rec+0x28] + trunc(u·([rec+0x30]
//        − [rec+0x28] + 1)).
//     4. roll @0x8f157f (store @0x8f15d9): [rec+0x24] + trunc(u·([rec+0x2c]
//        − [rec+0x24] + 1)).
//     5. strength roll @0x8f164d (store @0x8f16a3): f32 [rec+0x34] +
//        u·([rec+0x38] − [rec+0x34]).
//   Slot map (record XML dispatcher 0x4ABD60): +0x24 aabb_min_x, +0x28
//   aabb_min_y, +0x2c aabb_max_x, +0x30 aabb_max_y ⇒ roll 3 ([−0x108]) is the
//   Y anchor, roll 4 ([−0x154]) the X anchor. fn950 receives [−0x154] (push
//   @0x8f16c7) as xs = [ebp+8] and [−0x108] (push @0x8f16c0) as ys =
//   [ebp+0xc]: fn950(xs, ys, strength). Then the temp dtor (0x64cad0);
//   record stride 0x3c, back-edge `jb 0x8f11b3`.
// Plain (ctor-empty) templates no-op (I28): the ctor zero-inits [temp+0],
// [temp+4], [temp+0x5c] (`movl $0x0` @0x8f9481..0x8f94c8) and nothing fills
// them, so fn870 exits at its dims gate (`cmp [temp+4],0; jle 0x8ef940`
// @0x8ef888b) and fn950's stencil skips (`cmpl $0,0x5c(%ebx); je 0x8efa2d`
// @0x8ef977). Filled (image_file) templates write (C112, §8 row 46): fn950
// (sole caller fnB @0x8F16C8) and fn870 (sole caller fn950 @0x8EF96F) —
// fn870 = dst' = dst + α·(v − dst) over the template's W×H at (xs,ys) with
// dst-clip; fn950's +0x5c-gated stencil copies non-zero bytes. The y=0 bump
// in the C48 oracle is this stamp family.
export function caveRecordStamp({ countMin, countMax, imageFile, aabbMinX, aabbMaxX, aabbMinY, aabbMaxY, strengthMin, strengthMax }, prng, bytes, gridW, gridH, field = null, paintField = false, overlays = null) {
  const lo = countMin ?? 0;
  const hi = countMax ?? 0;
  const resolverCount = resolverDraws(imageFile); // pure — hoisted out of the loop
  const count = lo + Math.trunc((hi - lo + 1) * prng.next()); // up from min
  // Per stamp the resolver substitutes its rolled index into image_file,
  // the template loads, and fn950's stencil writes its nonzero bytes to the
  // byte plane [P+0x58].
  // D-STAND-INS (ISSUES §A): (d1) the position rolls — X then Y, lo +
  // trunc(N·u) over the aabb (N = max−min+1); (d2) the byte value = 1 (the
  // paint flag; the sampler's gate reads != 0).
  if (bytes && imageFile) {
    for (let s = 0; s < count; s++) {
      prng.next(); // the ctor-seed draw (the seed arg feeds a local Random)
      // resolver: each well-formed group consumes 1 draw and is replaced by
      // its rolled index (≤ 1 group per shipped image_file)
      let stampPath = imageFile;
      for (let g = 0; g < resolverCount; g++) {
        const u = prng.next();
        stampPath = stampPath.replace(/\$\[(\d+)-(\d+)\]/, (m, a, b) => {
          void m;
          return String(Number(a) + Math.trunc((Number(b) - Number(a) + 1) * u));
        });
      }
      // position rolls (d1); the record aabb Y range is 0..20, so the
      // top-band placement comes from the data, not a clamp
      const X = (aabbMinX ?? 5) + Math.trunc(((aabbMaxX ?? 507) - (aabbMinX ?? 5) + 1) * prng.next());
      const Y = (aabbMinY ?? 0) + Math.trunc(((aabbMaxY ?? 20) - (aabbMinY ?? 0) + 1) * prng.next());
      // strength roll = the fn870 blend target (see below); the paint
      // consumes no draws
      const su = prng.next(); // the strength roll
      const strength = (strengthMin ?? 0) + ((strengthMax ?? 0) - (strengthMin ?? 0)) * su;
      // fn950 stencil: the template's nonzero bytes → the plane at (X,Y)
      const stamp = recordTemplate(stampPath);
      if (stamp) {
        // overlay record (C175): the stamp's rect, valued from its own image;
        // mask readers check overlays first (raw field frame). No draws.
        if (overlays) {
          const values = new Float32Array(stamp.w * stamp.h);
          for (let i = 0; i < values.length; i++) {
            // value = the decoded alpha (coverage: opaque = solid,
            // transparent = air); lum is the material lane
            values[i] = stamp.alpha[i];
          }
          overlays.push({ x: X, y: Y, w: stamp.w, h: stamp.h, values });
        }
        for (let py = 0; py < stamp.h; py++) {
          const gy = Y + py;
          if (gy < 0 || gy >= gridH) continue;
          for (let px = 0; px < stamp.w; px++) {
            const v = stamp.px[py * stamp.w + px];
            if (v !== 0) {
              const gx = X + px;
              if (gx < 0 || gx >= gridW) continue;
              bytes[gy * gridW + gx] = v; // nonzero = the paint flag
              // fn870 blend (0x8EF870): dst' = dst + src_val·(strength − dst),
              // src_val = the stamp's decoded pixel (0x949ad0 read). Low-
              // strength stamps (pit family, ≤ 0.65) pull cells below the 0.5
              // gate = the carve. src_val = alpha is a stand-in (C32 decode
              // open, flagged A17 d2). Gated on paintField (SURFACE_STAMPS=1).
              if (paintField && field) {
                const idx = gy * gridW + gx;
                // srcVal = alpha: measured blends reach the target exactly
                // on opaque pixels
                const srcVal = stamp.alpha[py * stamp.w + px];
                if (srcVal > 0) {
                  field[idx] += srcVal * (strength - field[idx]);
                }
              }
            }
          }
        }
      }
    }
  } else {
    // no template/bytes: the draws-only consumer (I28), same stream budget
    for (let s = 0; s < count; s++) {
      prng.next();
      for (let g = 0; g < resolverCount; g++) prng.next();
      prng.next();
      prng.next();
      prng.next();
    }
  }
  return count;
}

// Record-template cache: resolved image_file → stencil template (fn950's
// source, C136: gate [temp+0x5c] ≠ 0, nonzero bytes → [P+0x58]).
// D-STAND-IN (ISSUES §A): byte value = 1 for any nonzero rgb (the paint
// flag; the sampler gate reads != 0). The true channel decode is open.
const __templates = new Map();
function recordTemplate(resolvedFile) {
  if (!resolvedFile) return null;
  if (__templates.has(resolvedFile)) return __templates.get(resolvedFile);
  let tpl = null;
  try {
    const png = readPng(path.join(findNoitaDataDir(), resolvedFile.replace(/^data\//, "")));
    const px = new Uint8Array(png.width * png.height);
    // channels (C175): alpha = a/255 (fn870's α), lum = max(r,g,b)/255. The
    // solid core = bright opaque pixels (cave_500: (255,255,255,255)×80); the
    // fringe = low-alpha near-black ≈ air under the blend.
    const alpha = new Float32Array(png.width * png.height);
    const lum = new Float32Array(png.width * png.height);
    for (let i = 0; i < px.length; i++) {
      const r = png.data[4 * i], g = png.data[4 * i + 1], b = png.data[4 * i + 2];
      px[i] = r !== 0 || g !== 0 || b !== 0 ? 1 : 0;
      alpha[i] = png.data[4 * i + 3] / 255;
      lum[i] = Math.max(r, g, b) / 255;
    }
    tpl = { w: png.width, h: png.height, px, alpha, lum };
  } catch { tpl = null; } // missing art → the draws-only arm (honest)
  __templates.set(resolvedFile, tpl);
  return tpl;
}

// The 0x668400 resolver's draw budget: 1 per well-formed `$[lo-hi]` group,
// 0 otherwise. The substitution removes the group before recursing, so each
// group costs at most one draw.
function resolverDraws(imageFile) {
  const s = imageFile ?? "";
  let draws = 0;
  for (let from = 0; ; ) {
    const open = s.indexOf("$[", from);
    if (open < 0) return draws;
    const close = s.indexOf("]", open + 2);
    if (close < 0) return draws;
    if (s.slice(open + 2, close).split("-").length >= 2) draws++;
    from = close + 1; // the substituted string has this group removed
  }
}
// LEGACY MODEL (no production caller; kept for the exported API): the
// (43)(a) circle with a per-cell ((py−1)/25)⁸ eave and a min/max combiner.
// The byte setter (setterStamp, I26) applies the eave on the stamp center y
// with q = y/25, circle arm only.
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

// LEGACY MODEL (no caller): FUN_008EF870 as a two-sided lerp `cell += (vArg −
// cell)·weight`, with a circle-falloff stand-in for the template weight.
// Kept as the engine-model reference for I27's sibling objects (the
// 0x8ee39a.. factory lane), which may carry a filled template.
function stampLerpTemplate(grid, gridW, gridH, cx, cy, radius, value) {
  const r0 = Math.trunc(radius + 0.5);
  const y0 = Math.max(0, cy - r0), y1 = Math.min(gridH - 1, cy + r0);
  const x0 = Math.max(0, cx - r0), x1 = Math.min(gridW - 1, cx + r0);
  for (let py = y0; py <= y1; py++) {
    const dy = py - cy;
    const dy2 = dy * dy;
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx;
      const d2 = dy2 + dx * dx;
      if (d2 > radius * radius) continue;
      const t = (radius - Math.sqrt(d2)) / radius;
      const idx = py * gridW + px;
      grid[idx] += (value - grid[idx]) * t;
    }
  }
}

// ── the 0x8EE930 stamp blend (entry (120)) ─────────────────────────────────
// Byte arms on `comiss 1.0,R; jb circle` @0x8ee934:
//   R ≤ 1 → single cell: bounds, getter, `comiss v,cell; jbe ret` → write
//     v iff cell > v (min-guard).
//   R > 1 → circle: r0 = trunc(R+0.5), box ±r0, skip d² > R², t =
//     (R²−d²)/R², w = t² @0x8eea33, cell += (v − cell)·w (two-sided, no
//     guard), per-cell bounds (no wrap).
// Low v drags cells down and v > 1 raises them (no guard on the circle arm,
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

// The fnA walk (C82); the caller (C81) supplies cursor/budget/d0sq/dy/
// growth/childCounter. Per iteration: trunc pair → plain box exit → cursor
// gate → loop-top carve exit (v_prev ≥ cursor @0x8ef109, C105(b)) → the
// 3-segment lane/radius envelope → the unconditional roll draw → the
// coin-gated D2 arm (one draw) → clamp01 → the `push $1` stamp =
// setterStamp(value=radius, scale=clamp01, flag=1), a lower-only carve with
// the center-y eave (I26) → y += Δy → spawn gate (spawn_percent unparsed ⇒
// 0 ⇒ byte-identical skip, no draw) → two bias draws → the d-split x-law
// draw (clamp(lerp(min,max,u) + bias, −1, 1)) → substeps > 50: growth-gate
// draw (fire ⇒ substeps := 0 + the linear 2u−1 re-jitter that clobbers the
// pushed square) → child gate (cc ≤ 0 ⇒ no draw; else the 2% gate draw,
// cc−− before the budget draw, childBudget = (u·50−50) + (budget−steps),
// in-walk recursion with the current trunc pair, same cursor, d0sq =
// −parent's, shared cc) → steps++ → continue iff steps ≤ budget.
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
  let d0 = walk.d0sq; // [ebp+0x1c]: the re-jitter clobbers this copy
  const { dy, growth } = walk;
  const cc = walk.cc; // shared with the in-walk recursion (decl per spawn)
  let vPrev = 0; // xmm3 across iterations; iteration 1 = 0 (the gate never fires there)
  for (;;) {
    const tx = Math.trunc(x), ty = Math.trunc(y);
    if (tx < 0 || ty < 0 || tx >= gridW || ty >= gridH) return; // the plain box exit
    if (cursor <= 0) return; // the cursor gate
    // carve exit gate @0x8ef109 (C105(b), I30): `movss 0x10(%ebp),%xmm7;
    // comiss %xmm7,%xmm3; jae exit` ⇒ exit iff the previous point's clamped
    // value ≥ cursor. First iteration v_prev = 0.
    if (vPrev >= cursor) return;
    const t = steps / budget;
    // 3-segment lane (t<0.2 | 0.2..0.6 | >0.6); band 1 lerps from the
    // carried v_prev (@0x8ef12b..0x8ef13d, I30)
    let lane;
    if (t < 0.2) lane = vPrev + (cursor - vPrev) * (t / 0.2);
    else if (t <= 0.6) lane = cursor + (0.7 - cursor) * ((t - 0.2) / 0.4);
    else lane = 0.7 - 0.7 * ((t - 0.6) / 0.6);
    let slot = 1 - lane; // [−0x28] = 1 − lane, reset every iteration
    // the 3-segment radius envelope (t<0.3 | 0.3..0.6 | >0.6)
    let radius;
    if (t < 0.3) radius = rA + (rB - rA) * (t / 0.3);
    else if (t <= 0.6) radius = rB + (rC - rB) * ((t - 0.3) / 0.3);
    else radius = rC + (rD - rC) * ((t - 0.6) / 0.6);
    slot += prng.next() * 0.35 - 0.25; // the unconditional roll draw
    if (flagD2 !== 0) slot = (prng.next() * 0.32 + 0.35) * slot; // the D2 arm
    const v = clamp01(slot);
    vPrev = v; // carried to the next loop top (the exit gate) + band-1 base
    setterStamp(grid, gridW, gridH, tx, ty, radius, v, 1); // `push $1` (I26)
    y += dy;
    // the spawn gate omitted (spawn_percent = 0 port-side ⇒ byte-identical skip)
    let bias = 0;
    // bias gate 1 (0x8ef433..0x8ef499): trunc(101u) < 25 → [−0x24] := −1.0
    if (Math.trunc(prng.next() * 101) < 25) bias = -1;
    // bias gate 2 (0x8ef4db..0x8ef502 area): trunc(101u) < 25 → bias += 1
    if (Math.trunc(prng.next() * 101) < 25) bias += 1;
    // the x-law (0x8ef5cc..0x8ef62c): d-split [−0x20]/[−0x28] + draw·d + bias,
    // then clamp(step, −1, 1) (0x11dfbf0/0x11e05a8)
    const hi = d0 > 0 ? d0 : 0, lo = d0 > 0 ? 0 : d0; // the d-split
    const step = lo + (hi - lo) * prng.next() + bias; // the x-law draw
    x += step < -1 ? -1 : step > 1 ? 1 : step; // clamp(·, −1, 1)
    substeps++;
    if (substeps > 50) {
      const u = prng.next(); // the growth-gate draw (0x8ef607..0x8ef631 slice)
      if (growth > u) {
        substeps = 0;
        d0 = 2 * prng.next() - 1; // the re-jitter @0x8ef6c0 (2.0/1.0 sub idiom)
      }
      // block 0x8ef65a..0x8ef6de: counter reset @0x8ef6cb, re-jitter draw
      // @0x8ef6c0 ([ebp+0x24] = the growth arg); the re-jitter fires only on
      // the growth branch
    }
    if (cc.n > 0) {
      const u = prng.next(); // the 2% child gate draw
      if (u * 100 < 2) {
        cc.n--; // decl before the budget draw
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

// The scatter engine (true 0x8EEAD0):
// 1. two poro draws through the Random(min,max) closed form → a point inside
//    the record's span (−0.5/0.5 lanes @0x11e058c/0x11dfa94).
// 2. bounds: reject x/y < 0 or x ≥ w or y ≥ h (@0x4ee42a..0x4ee43e).
// 3. gate (@0x4ee456): fires only when cell < 0.5, then the recursive tail =
//    true 0x8FAFC0 (the B-channel recorder; the value arg travels with it).
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

// The fnB draw engine (C177): Schrage MINSTD (16807/127773/2836; the
// 0x834e0b5f/2^48 signed-division magic). State = f64 seeded
// f64(uint32(seed)) + the sign-table correction (0x11E0BA0, ctor 0x8F9470
// head), persisted on P+0 across all fnB phases. next() steps the state and
// returns state × 1/2³¹ (0x11DF988); the ≤0 ⇒ +0x7FFFFFFF correction keeps
// the state positive, so u ∈ (0,1).
export function makeMinstd(seed) {
  let state = seed | 0; // the signed-32 wrap = the ctor's cvttsd2si trunc
  return {
    next() {
      const s = state | 0;
      const hi = Math.trunc(s / 127773);
      const lo = s - hi * 127773;
      let t = 16807 * lo - 2836 * hi;
      if (t <= 0) t += 0x7fffffff;
      state = t;
      return t * (1 / 2 ** 31);
    },
    get state() {
      return state;
    },
  };
}

/**
 * buildCavesField(dataDir, def, seed) — the [uid+0x1d4] BitmapCaves grid.
 * Returns the field, its byte plane and meta; null when no BitmapCaves.
 *
 * Phase order = fnB's (C81 caller side + C82 walk body):
 *   head: cave_count = rollPos(config[+0x28],[+0x2c]), then
 *     surface_caves_count = rollPos(config[+0x34],[+0x38]) (switch budget).
 *     The blob count rolls come after the walk loop.
 *   1. walk: cave_count walks (per-walk cursor from cave_strength (C52), path
 *      alternation, two-arm budget); walkChain stamps via setterStamp flag=1
 *      and runs the child recursion itself.
 *   2. blobs: loop B = mountain_count top-band runs, loop C =
 *      blob_caves_count stamps (no radius cap; §8 row 40).
 *   3. CaveStructure records (stride 0x3c; count pair [+0x1c]/[+0x20];
 *      strength pair [+0x34]/[+0x38]; engine 0x8EF950 → 0x8EF870).
 *   4. layer-2 chains (2 passes).
 *   5. layer-3 chain (gated on do_beginning_down = config[+0x31]).
 * Writers: stampBlendLerp (two-sided, t²) for the blobs; setterStamp
 * (lower-only) for the walk and L2/L3; the record lane writes the byte plane
 * (and the field when paintStamps). Every scatter site lives inside a
 * chain's spawn lane (C46 call-site census).
 */
export function buildCavesField(dataDir, def, seed, paintStamps = false) {
  const bc = def.bitmapCaves;
  if (!bc || !bc.sizeX || !bc.sizeY) return null;
  const w = bc.sizeX, h = bc.sizeY;

  // ctor chain: the MINSTD engine seeded with the world seed's signed-32
  // wrap at the P's ctor (0x8F9470 head), persisted on P+0 across all fnB
  // phases (blobs and record stamps, the 0x8F07D3 site). The ctor draws
  // nothing.
  const base = makeMinstd(seed);

  // ── stream trace (C104): counts each phase's draws so /verify can check
  // phase totals against the byte budgets ────────────────────────────────
  const trace = {
    walk: 0, loopB: 0, loopC: 0, records: 0, l2: 0, l3: 0,
    budgetCheck: "byte-law", // set to "MODEL" per-lane where a leg is D-level
  };
  let phase = "ctor";
  const prng = new Proxy(base, {
    get(t, k) {
      if (k === "next") return () => { trace[phase] += 1; return t.next(); };
      const v = t[k];
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
  const setPhase = (p) => { if (trace[p] != null) phase = p; };

  const field = new Float32Array(w * h).fill(1.0); // fn C1's bake
  const bytes = new Uint8Array(w * h); // the [P+0x58] byte plane (0x8FAFC0 scatter recorder + the record stencil)

  // the byte roll form `min + trunc(draw·(max−min+1))` (also the record count roll)
  const rollPos = (min, max) => min + Math.trunc((max - min + 1) * prng.next());
  const rollF = (min, max) => min + (max - min) * prng.next();
  const clamped = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  const caveCount = rollPos(bc.caveCountMin ?? 0, bc.caveCountMax ?? 0);
  const surfaceCount = rollPos(bc.surfaceCavesCountMin ?? 0, bc.surfaceCavesCountMax ?? 0);
  const rMin = bc.blobCavesRadiusMin ?? 1;
  const rMax = bc.blobCavesRadiusMax ?? 10;
  const sMin = bc.blobCavesStrengthMin ?? 1.5;
  const sMax = bc.blobCavesStrengthMax ?? 3;

  // ── (1) the walk (C81 caller + C82 body): per walk a cursor draw (lerp of
  // the C52 cave_strength pair) → path alternation (case A chained ±0.01w /
  // 0.05..0.25h, flag := 0; case B Y = trunc(lerp(0.07h,0.33h)), X =
  // trunc(5 + u(w−10)), and while switchCnt < surface_count the switch path:
  // jitter X-law + stride + clamp, Y₀ = trunc(6u), lane-select cursor factor,
  // switchCnt++, flag := 1) → budget section (scale0 draw unused, S = h−Y,
  // budget LERP(0.15S,0.96S) [flag=1: LERP(0.45S,0.96S)], d0, Δy + the 33/101
  // gate, growth, cc = rollPos(cave_childs) + 10/101 bonus [flag=1: +
  // rollPos(surface_cave_childs) + 20/101 bonus], ÷Δy, two 50/101 growth
  // gates) → walkChain.
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
      // case B: both draws land before the switch check
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
    setPhase("walk");
    walkChain(field, w, h, prng, X, Y, cursor, budget, {
      d0sq: d0 * d0, dy, growth, cc: { n: cc },
    });
  }

  // ── (2) blob phases (loop B @0x8f072a..0x8f0d92, loop C
  // @0x8f0d92..0x8f117b). The count rolls land after the walk loop
  // (@8f072a). Count-pair map: loop B = mountain_count @4eff36/4eff39,
  // loop C = blob_caves_count @4f05a0/4f05a9.
  //
  // loop B = the mountain lane, top-band vertical runs per stamp:
  //   u₁: base = ⌊f32(K·u₁)⌋ (K = 0.1h, f32 @0x8f0780, const 0x11df974)
  //   u₂: X = 5 + ⌊(w−9)·u₂⌋  (the −2⁻³¹+sub idiom ≡ rollPos(5,w−5))
  //   u₃: R = rollF(mountain_size [+0x5c]/[+0x60]), no cap → [−0x124]
  //   u₄: Y_end = base + ⌊11·u₄⌋ + 15 (11.0 f64 0x11dff38 + the sub idiom)
  //   v := 1.5 (0x11dfd2c); u₅: the 20% coin ⌊101·u₅⌋ < 20 →
  //       Y_end := base and u₆ (the direct-call draw `call 0x10098c0`
  //       @0x8f0b08) → v := 1.5+0.25·u₆
  //   guard base > Y_end → skip rows (dead: Y_end ≥ base always)
  //   rows row = base..Y_end inclusive (the row-y lives in the pos pair):
  //     blend((X,row), R, v) @0x8f0b6d → u: R += 0.5·(1+u) (unconditional)
  //     → u: the 50% coin ⌊101·u⌋ < 50 → u: v *= 0.97+0.03·u
  //
  // loop C = the blob_caves lane; per stamp exactly 4 draws:
  //   y = rollPos(25, h−5) first, x = rollPos(5, w−5),
  //   v = rollF(blob_caves_strength [+0x6c]/[+0x70]),
  //   R = rollF(blob_caves_radius [+0x74]/[+0x78]), no cap (C52),
  //   blend @0x8f115f.
  //
  // In-byte f32 forms are computed in f64 here (the standing f32-trap
  // deviation class).
  const mtMin = bc.mountainSizeMin ?? 1;
  const mtMax = bc.mountainSizeMax ?? 10;
  setPhase("loopB"); // the pre-loop fnB draws stay in the walk bucket
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
  setPhase("loopC");
  const blobCount = rollPos(bc.blobCavesCountMin ?? 0, bc.blobCavesCountMax ?? 0);
  const blobPhase2 = (() => {
    if (blobCount <= 0) return 0;
    for (let b = 0; b < blobCount; b++) {
      const y = rollPos(25, h - 5); // y first
      const x = rollPos(5, w - 5);
      const v = rollF(sMin, sMax); // blob_caves_strength
      const R = rollF(rMin, rMax); // blob_caves_radius, no cap
      stampBlendLerp(field, w, h, x, y, R, v);
    }
    return blobCount;
  })();

  // ── (3) CaveStructure records: count roll + per-stamp draws, the template
  // stencil into `bytes` ([P+0x58]) and, with paintStamps (SURFACE_STAMPS=1),
  // the fn870 blend into `field` (C175). Draws are identical either way.
  setPhase("records");
  const overlays = paintStamps ? [] : null;
  for (const rec of bc.structures ?? []) {
    caveRecordStamp(rec, prng, bytes, w, h, field, paintStamps, overlays);
  }

  setPhase("l2");
  // ── (4) layer-2 chains (L2 @0x8f1a22..0x8f2595). Head (draw-ordered):
  // s₀ := +1 → [−0x104], then a 50% coin ⌊101·u⌋ < 50 → s₀ := −1.0
  // (0x11e05a8); y₀ := 0 → [−0x140]. Exactly 2 passes (the [−0x10c] pass
  // counter, `cmp $2; jl` @0x8f2595). Per pass:
  //   center = f32(w)·0.5 (recomputed per pass; no draw)
  //   pass 0 (arm A): roll = 3.5 + 31.5·u → x₀ = center + s·roll
  //   pass 1 (arm B): [−0x104] := −s first (xorps), then roll = 25 + 50·u
  //       → x₀ = center + s·roll with the flipped sign
  //   count = 120 + ⌊81·u⌋ → [120,200] (the ≤0 guard is dead)
  //   chain = 3·u+1 → [−0x128]; scale = 0.1·u+0.1 → [−0x108] (const
  //       0x11df974 @0x8f1e6d); vel = s·(1.25 + 2.25·u) — drawn after the
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
  //     u_g: the spawn coin ⌊101·u⌋ < 5 → the spawn-item/small-enemy lookup
  //       ptrs gate the selector draw (`cmpl $0` → skip); the port's spawn
  //       keys are unparsed (null) ⇒ no selector/scatter draws (FLAGGED
  //       stream divergence, ~0.15 draws/point on coin-hits — contained, L3
  //       is the last phase).
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
      armSign = -armSign; // arm B flips [−0x104] before the roll
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

  setPhase("l3");
  // ── (5) layer-3 chain (L3 @0x8f259b..0x8f2f17).
  // Gate: config[+0x31] = do_beginning_down, `cmpb $0,0x31(%eax); je
  // 0x8f2fa5` — hills.xml declares 1. The setup runs a separate MSVC C-rand
  // LCG with a persistent global (0x132a388):
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
    w, h, field, bytes, overlays,
    p94: toucherValue(w),
    prngState: prng.seed,
    isSolid: isSolidCell,
    meta: {
      blobCount, caveCount, blobPhase1, blobPhase2, l2Calls, l3Calls,
      def: def.name, structures: (bc.structures ?? []).length,
      streamTrace: trace,
    },
  };
}

// The 0x8EE750 setter (C96, C101). Branch on value > 1.0 (comiss 0x11dfbf0
// @0x8ee766):
//   value ≤ 1 → single cell: bounds → getter → write scale iff cell > scale
//     (`comiss scale,cell; jbe ret`); no eave (@0x8ee776..0x8ee7d5).
//   value > 1 → circle: r0 = trunc(value+0.5), box ±r0, skip d² > value²,
//     t = (value²−d²)/value², target = 1 + t·(scale − 1); if flag ≠ 0
//     (`cmpb $0x0,0x8(%ebp)` @0x8ee839, `je` @0x8ee85c; the SSE between
//     leaves EFLAGS alone) and the stamp center y ([edi+4]; cell coords form
//     only at @0x8ee892) < 25 → target := 1 + (y/25)⁸·(target − 1) (q =
//     y/25.0, f32 0x11e01e0); then bounds (no wrap), write target iff
//     cell > target.
// Both arms are lower-only; the flag only gates the top-band eave. L2/L3
// pass flag=0 (scale = scale·s2 ∈ (0,~0.2); the single-cell arm writes down
// to ~0.075); the walk passes flag=1 (value = radius envelope, scale =
// clamp01(slot″), I26).
function setterStamp(grid, gridW, gridH, x, y, value, scale, flag = 0) {
  if (value <= 1) {
    if (x < 0 || y < 0 || x >= gridW || y >= gridH) return;
    const idx = y * gridW + x;
    if (grid[idx] > scale) grid[idx] = scale;
    return;
  }
  const R2 = value * value;
  const r0 = Math.trunc(value + 0.5);
  // the flag=1 eave factor (constant per stamp: the CENTER y, @0x8ee85e)
  const q8 = flag !== 0 && y < 25 ? (y / 25) ** 8 : 1;
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
      const target = 1 + q8 * t * (scale - 1);
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

// Band-anchored finite cell read (C165, X205), the unit behind
// noiseChunkMask's caves gradAt. Field row 0 ↦ worldY = [world-grid+4] +
// field_row (X205 W6); rows run [0, min([+0x8c], 16 batches)). The field is
// a finite mask anchored one field-height (fh) above the C80 datum; the
// getter never reads negative indices (C164, X204 W2):
//   wy < -fh       ⇒ 0 (sky above the band top)
//   wy ∈ [-fh, ·)  ⇒ field[row*fw + col], col = ((wx % fw)+fw)%fw
//   row >= fh      ⇒ wraps (deeper slabs reuse the same field)
export function cavesCellAt(field, w, h, wx, wy) {
  if (wy < -h) return 0; // above the terrain slab's top = the sky
  const col = ((wx % w) + w) % w;
  return field[(((wy % h) + h) % h) * w + col];
}

// ============================================================================
// The warp-displaced, smooth-snapped field read (C170, X208).
//
// Bytes: 0x90d905..0x90e02b (caller) + 0x908cb0..0x908e6e (warp). Per cell,
// with G1/G2 the wang offset and raw world px:
//   xU = (wx + G2 + 0.5)·0.1, yU = (wy + G1 + 0.5)·0.1   [10px-cell unit;
//        0x11dfdd8 = 0.5d, 0x11dfd08 = 0.1d]
//   nx = 0.45·simplex2d(0.13715·(wx+G2), 0.13717·(wy+G1)) + 0.1
//        [x-first; 0x11dfd38 = 0.13717d; 0x11dfa5c = 0.45f, 0x11df974 = 0.1f]
//   L  = latticeGrad2d((wy+G1)/9, (wx+G2)/9)   [0x8fc740; y-first arg swap;
//        0x11dfd20 = 1/9d]
//   m  = latticeVal2d((wx+G2)/9, (wy+G1)/9)    [0x8fc900 = quintic value
//        noise: hXY = perm[perm[ix]+jy] at 0x114d700 (&0xff wraps, =
//        PERM_LATTICE), /255.0, quintic fade, (v−0.5)·2 — X208 [4]]
//   wgt = (1 − nx)·0.33 + 0.111   [0x11dfa10 = 0.33f, 0x11df97c = 0.111f]
//   out.x = xU + flip·nx·m    ([ebx+0], written @0x908e5a)
//   out.y = yU + flip·wgt·L   ([ebx+4], written @0x908e62)
//   flip = 1.0f at the caves call site (`movss 0x11dfbf0` @0x90dc11 before
//   `call 0x908cb0` @0x90dc19); flip ≤ 0 returns undisplaced (@0x908d35).
//   Other callers (the kind-2 torque warp lane) may pass other flips.
// Pick (0x90dc7d..0x90dcc6): s(f) = (3 − 2f)·f² (smoothstep; 0x11dfbf0 =
//   1.0f, 0x11dfe68 = 2.0f, 0x11dff70 = 3.0f, 0x11dfa94 = 0.5f), px0 =
//   floor(out0) + [s(frac0) ≥ 0.5], py0 likewise (comiss/inc @0x90dcbf/
//   0x90dcc5) — a ≤±1-cell snap, not a bilinear blend.
// Downstream (not in this function): the U16 gate (0x9fe4e0, word read at
//   [+0x20]), the second warp 0x908e70 ((y·0.07, x·0.035) → 0x8fc900 →
//   ·15.5 → ±0.5) and classify 0x8f5030.
// G1/G2 = f64[0x13289a8] / f64[0x1327670], written once in
//   ProceduralTerrain::Init (this = [ebp−0x248]: [+0x38]→G2 @0x90713a,
//   [+0x40]→G1 @0x907147, logged "Wang offset: " 0x1174b1c); the warp adds
//   them at its head (@0x908CC9 adjY = inY+G1, @0x908CD6 adjX = inX+G2).
// OPEN (A15 gap 3): the [world-grid+0x90] material-lookup arm.
export function cavesShapedCellAt(field, w, h, wx, wy) {
  // The wang offset (C170, X208):
  //   G2 = 17920.0 = ProceduralTerrain[+0x38] = w·256, w = biome-map image
  //        width (70) — C119; = the C80 world-x datum (biome px 35·512), so
  //        the add re-anchors world px to the biome frame.
  //   G1 = 7168.0 = ProceduralTerrain[+0x40] = 14·512 (C119; both Init
  //        branches agree) = the world-y origin's offset from biome row 0
  //        (canvas 24576 → 31744).
  const G1 = 7168, G2 = 17920;
  // the 10px-cell frame (×0.1); the noise below runs on raw px
  const xU = (wx + G2 + 0.5) * 0.1;
  const yU = (wy + G1 + 0.5) * 0.1;
  // simplex, x-first, raw world px (0.13715 per px)
  const nx = 0.45 * simplex2d((wx + G2) * 0.13715, (wy + G1) * 0.13717) + 0.1;
  // the lattice, swapped y-first (arg0 = y), /9, raw px
  const L = latticeGrad2d((wy + G1) / 9, (wx + G2) / 9);
  // the m-noise (0x8fc900 = latticeVal2d, X208 [4])
  const m = latticeVal2d((wx + G2) / 9, (wy + G1) / 9);
  // the blend weight
  const wgt = (1 - nx) * 0.33 + 0.111;
  // displacement pair (flip = 1.0): x-slot nx·m, y-slot wgt·L
  const out0 = xU + nx * m;
  const out1 = yU + wgt * L;
  // the smoothstep's ±1 snap
  const f0 = out0 - Math.floor(out0), f1 = out1 - Math.floor(out1);
  const sx = (3 - 2 * f0) * f0 * f0, sy = (3 - 2 * f1) * f1 * f1;
  const px = Math.floor(out0) + (sx >= 0.5 ? 1 : 0);
  const py = Math.floor(out1) + (sy >= 0.5 ? 1 : 0);
  // the field read (the same in-bounds collision law as cavesCellAt)
  if (wy < -h) return 0;
  const col = (((px % w) + w) % w), row = (((py % h) + h) % h);
  return field[row * w + col];
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
