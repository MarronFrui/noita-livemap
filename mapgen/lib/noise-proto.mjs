// mapgen/lib/noise-proto.mjs — F3 noise prototype RUNNABLE PORT (dig #4, 2026-09-20)
//
// Binary-derived per ABOUT_MATH 2026-09-19 (12)/(13) + dig #4 objdump
// re-traces (all four functions fully transcribed from the slab this
// session; constants re-pinned). Modules per CONSTANTS.md: C25 (simplex
// cores + perm tables), C26 (FUN_00908cb0 constants), C29 (quintic lattice),
// C30 (0x908e70 evaluator). Math.fround marks every f32 boundary; the
// addsd/mulsd steps stay in double exactly as the f64 executes.
//
// Functions:
//   simplex2d     — true FUN_008fca60  (slab 0x4fc260)  [fully closed]
//   latticeGrad2d — true 0x8fc740     (slab 0x4fbf40)  [gradient table OPEN]
//   latticeVal2d  — true 0x900900     (slab 0x4fc100)  [fully closed]
//   noiseTransform— true FUN_00908cb0 (slab 0x5084b0)  [fully closed modulo
//                   the C24 config doubles 0x1327670/0x13289a8, supplied via cfg]
//   evaluator2    — true 0x908e70     (slab 0x508670)  [fully closed]
//
// Corrections vs ABOUT_MATH (13), recorded 2026-09-20 (ABOUT_MATH (15)):
//  1. true 0x900900 is quintic VALUE noise (perm bytes / 255.0, ×2−1
//     output), NOT a second gradient-perlin "latticeB" — it has NO gradient
//     table; only true 0x8fc740 reads 0x12eec08/0x12eec0c.
//  2. FUN_00908cb0: the two lattice results CROSS relative to (13)'s
//     out-lines: the 0.33-chain applies to the SWAPPED-arg 0x8fc740 call
//     and w·a to the normal-arg 0x900900 call (asm is authority).
//  3. true 0x8fc740 has an asymmetric second y-blend: endpoints are
//     (dot_SE − vy0)·qy + dNE (slab 0x4fc0b4..0x4fc0c8) — ported verbatim.
//  4. C30 clamp direction settled: lower clamp at 0.5 (val < 0.5 → 0.5).
//
// Perm tables byte-extracted this session (VA − 0x400e00; 256 unique
// entries, mirrored to 512 in-binary — verified byte-identical). Hash
// indices perm[perm[i]+j] reach 510 — that is exactly why the in-binary
// table is mirrored.
export const PERM_SIMPLEX = new Uint8Array([
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
  140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
  247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
  57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
  74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
  60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
  65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
  200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
  52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,
  207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
  119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
  129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
  218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,
  81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
  184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,
  222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
  140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
  247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
  57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
  74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
  60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
  65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
  200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
  52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,
  207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
  119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
  129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
  218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,
  81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
  184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,
  222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
]);
export const PERM_LATTICE = new Uint8Array([
  23,125,161,52,103,117,70,37,247,101,203,169,124,126,44,123,
  152,238,145,45,171,114,253,10,192,136,4,157,249,30,35,72,
  175,63,77,90,181,16,96,111,133,104,75,162,93,56,66,240,
  8,50,84,229,49,210,173,239,141,1,87,18,2,198,143,57,
  225,160,58,217,168,206,245,204,199,6,73,60,20,230,211,233,
  94,200,88,9,74,155,33,15,219,130,226,202,83,236,42,172,
  165,218,55,222,46,107,98,154,109,67,196,178,127,158,13,243,
  65,79,166,248,25,224,115,80,68,51,184,128,232,208,151,122,
  26,212,105,43,179,213,235,148,146,89,14,195,28,78,112,76,
  250,47,24,251,140,108,186,190,228,170,183,139,39,188,244,246,
  132,48,119,144,180,138,134,193,82,182,120,121,86,220,209,3,
  91,241,149,85,205,150,113,216,31,100,41,164,177,214,153,231,
  38,71,185,174,97,201,29,95,7,92,54,254,191,118,34,221,
  131,11,163,99,234,81,227,147,156,176,17,142,69,12,110,62,
  27,255,0,194,59,116,242,252,19,21,187,53,207,129,64,135,
  61,40,167,237,102,223,106,159,197,189,215,137,36,32,22,5,
  23,125,161,52,103,117,70,37,247,101,203,169,124,126,44,123,
  152,238,145,45,171,114,253,10,192,136,4,157,249,30,35,72,
  175,63,77,90,181,16,96,111,133,104,75,162,93,56,66,240,
  8,50,84,229,49,210,173,239,141,1,87,18,2,198,143,57,
  225,160,58,217,168,206,245,204,199,6,73,60,20,230,211,233,
  94,200,88,9,74,155,33,15,219,130,226,202,83,236,42,172,
  165,218,55,222,46,107,98,154,109,67,196,178,127,158,13,243,
  65,79,166,248,25,224,115,80,68,51,184,128,232,208,151,122,
  26,212,105,43,179,213,235,148,146,89,14,195,28,78,112,76,
  250,47,24,251,140,108,186,190,228,170,183,139,39,188,244,246,
  132,48,119,144,180,138,134,193,82,182,120,121,86,220,209,3,
  91,241,149,85,205,150,113,216,31,100,41,164,177,214,153,231,
  38,71,185,174,97,201,29,95,7,92,54,254,191,118,34,221,
  131,11,163,99,234,81,227,147,156,176,17,142,69,12,110,62,
  27,255,0,194,59,116,242,252,19,21,187,53,207,129,64,135,
  61,40,167,237,102,223,106,159,197,189,215,137,36,32,22,5,
]);

// ---------------------------------------------------------------------------
// Byte-pinned .rdata constants (file_off = VA − 0x400e00, re-read 2026-09-20).
// Key detail: 0x11dfd20 = f32(0.11111111) widened to double — NOT exact 1/9!
export const K = {
  scale01: 0.1,                      // f64 0x11dfd08
  gradXc: 0.13715,                   // f64 0x11dfd30
  gradYc: 0.13717,                   // f64 0x11dfd38
  ninth: 0.1111111119389534,         // f64 0x11dfd20
  anisoX: 0.035,                     // f64 0x11dfc98
  anisoY: 0.07,                      // f64 0x11dfce8
  half: 0.5,                         // f64 0x11dfdd8
  F2: 0.3660253882408142,            // f32 0x11dfa34
  G2: 0.21132487058639526,           // f32 0x11df9c0
  G2X2: 0.4226497411727905,          // f32 0x11dfa4c
  KERNEL: 0.5,                       // f32 0x11dfa94
  outScale: 40.0,                    // f32 0x11e0270
  neg2: -2.0,                        // f32 0x11e05f0
  plus2: 2.0,                        // f32 0x11dfe68
  wMult: 0.44999998807907104,        // f32 0x11dfa5c
  wBias: 0.10000000149011612,        // f32 0x11df974
  yMult: 0.33000001311302185,        // f32 0x11dfa10
  yBias: 0.11100000143051147,        // f32 0x11df97c
  one: 1.0,                          // f32 0x11dfbf0
  warpScale: 0.04892750084400177,    // f32 0x11df944
  warp15: 15.5,                      // f32 0x11e01b0
  gain: 5.349999904632568,           // f32 0x11e00b4
  gamma: 0.949999988079071,          // f32 0x11dfbac
  n255: 255.0,                       // f32 0x11e0378 (0x900900 divisor)
  q6: 6.0,                           // f32 0x11e00e8 (quintic)
  q15: 15.0,                         // f32 0x11e01a0
  q10: 10.0,                         // f32 0x11e015c
};

// --- Gradient pair table — byte-pinned 2026-09-20 (dig #4) ------------------
// VA 0x12eec08 (gx) / 0x12eec0c (gy), stride 8. CORRECTION of the dig-#4
// hunt-negative: the table IS in-file — .data maps file = VA − 0x401A00
// (the VA−0x400E00 rule is .rdata-only; see CONSTANTS.md C13/C29). Pairs:
//   0:(−1,0) 1:(1,0) 2:(0,−1) 3:(0,1) 4:(−1,−1) 5:(−1,1) 6:(1,−1) 7:(1,1)
export const GRADIENTS = new Float32Array([
  -1.0, 0.0,   1.0, 0.0,   0.0, -1.0,   0.0, 1.0,
  -1.0, -1.0,  -1.0, 1.0,  1.0, -1.0,   1.0, 1.0,
]);

const f = Math.fround;

// ============================================================================
// case-1 lane core — true 0x8fb350 = slab 0x4fab50 (READ 2026-09-20 (26)) ===
// Value-noise on the (floored) lattice with the GLSL-sin hash:
//   c0    = 57·floor(y) + floor(x)   (helper calls @0x8fb373/382 → 0x44d0b0
//          = f32 floor wrapper: cvtss2sd → call 0x1033a52 → ff 25 [0x114a534]
//          = import "floor" hint 1646, IAT byte-read dig #113. CORRECTS the
//          C40 "round" label: the body has fldl/fstpl arg-passing only — no
//          fistp — and c0's cell must agree with the floor-based fracs below)
//   fx    = x − floor(x); fy = y − floor(y)   (inline cvttss2si+comiss+dec)
//   n(ix,iy)   = frac(sin(c0    )·43758.546875)   (0x4fac4d→jmp*[0x114a520]
//                                                = _libm_sse2_sin_precise,
//                                                identity resolved 2026-09-20
//                                                via the IAT name table)
//   n(ix+1,iy)   = frac(sin(c0 + 1 )·43758.546875)
//   n(ix,iy+1)   = frac(sin(c0 + 57)·43758.546875)
//   n(ix+1,iy+1) = frac(sin(c0 + 58)·43758.546875)
//   weights wx = (3−2fx)·fx²; wy = (3−2fy)·fy²   (0x11dff70/0x11dfe68/0x11dfa94)
//   blend idiom (A−B)·t + B ⇒ t=0 selects B; standard orientation (C91):
//         out = lerp(lerp(h0,h1,wx), lerp(h57,h58,wx), wy)
//         = true 0x8fb4b7..0x8fb567 (y+1 row @0x8fb4b7..4c9, y row
//         @0x8fb548..55a, out @0x8fb55e..567; evidence case1core.asm).
//   Pre-(112) parse inverted all three endpoint pairs (I22) — fixed
//   dig #113; byte pins in surface-census.test.mjs (floor-based, see
//   the lattice byte-pin describe there).
// FRACT = cvttss2si + comiss + dec (truncation-style floor) then subss.
const K57 = 57.0;      // f32 0x11e028c
const K58 = 58.0;      // f32 0x11e0298
const K_HASH = 43758.546875;   // f32 0x11e04c8

function _fract(v) { return v - Math.floor(v); }

// The binary lerp idiom `(A−B)·t + B` (f32 at each op): t=0 → the FIRST
// argument. Shared by whiteLattice2d / parityLattice2d (C83/C91).
const lerp = (a, b, t) => f(f((b - a) * t) + a);

export function whiteLattice2d(xin, yin) {
  const x = f(xin), y = f(yin);
  const c0 = f(K57 * f(Math.floor(y)) + Math.floor(x));
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const wx = f((3.0 - 2 * fx) * fx * fx);
  const wy = f((3 - 2 * fy) * fy * fy);
  // sinf via _libm_sse2_sin_precise (IAT slot 0x114a520 — resolved above):
  const s = (k) => _fract(Math.sin(k) * K_HASH);
  // byte order (C91, dig #112): y+1 row (h57→h58) @0x8fb4b7..4c9, y row
  // (h0→h1) @0x8fb548..55a, out (rowY0→rowY1) @0x8fb55e..567 — each
  // lerp's FIRST argument is its t=0 endpoint (I22 fix, dig #113).
  const h58 = s(c0 + 58), h57 = s(c0 + 57), h1 = s(c0 + 1), h0 = s(c0);
  const rowY1 = lerp(h57, h58, wx);
  const rowY0 = lerp(h0, h1, wx);
  return lerp(rowY0, rowY1, wy);
}

// ============================================================================
// addNoise-default core — true 0x8fb570 (721 B): whiteLattice2d's lattice
// with PARITY-ALTERNATING blend weights (I20 ① byte-closed = CONSTANTS C83;
// whole body + caller chain re-read byte-exact 2026-10-02, entry (113)).
// LIVE for hills_flat / mountain_lake / laboratory (`mGradientAddNoise=
// "0"`) — the switch's fall-through arm @0x90ab7d (addNoise ∉ {1,2,3}).
//   rx = floor(x), ry = floor(y)  (0x44d0b0 = f32 floor wrapper, IAT "floor"
//        @0x8fb593/5a2 — the C40 "round" label corrected dig #113)
//   Wx = lerp(w0,w1,fx) with (w0,w1) = (sf(fx), fx) iff floor(x) EVEN
//        else (fx, sf(fx)) — true signed-parity idiom `and 0x80000001`
//        @0x8fb613 (w0's check, cvttss2si of the helper result @0x8fb5fe;
//        w1's flips it via `lea 0x1(%ecx)` @0x8fb64f), Wx = (w1−w0)·fx + w0
//        @0x8fb67e..690 → slot(−0xc); Wy identical on fy / floor(y)
//        @0x8fb695/6c6 → slot(−0x1c) @0x8fb71a.
//   c0 = 57.0·ry + rx @0x8fb6f2..6fe; corners h(k)=frac(sin(c0+k)·K_HASH)
//        k ∈ {58,57,1,0} @0x8fb70e..815 (hash chain = whiteLattice2d's).
//   out = lerp(lerp(h0,h1,Wx), lerp(h57,h58,Wx), Wy) — row tails byte-
//        identical to 0x8fb350's (0x8fb789..79b ≡ 0x8fb4b7..4c9, C91).
export function parityLattice2d(xin, yin) {
  const x = f(xin), y = f(yin);
  const rx = Math.floor(x), ry = Math.floor(y);
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const c0 = f(K57 * ry + rx);
  const s = (k) => _fract(Math.sin(k) * K_HASH);
  // sf(t) = (3−2f)·f² — mulss triple @0x8fb637..646 (2.0@0x11dfe68,
  // 3.0@0x11dff70); single-f form per the whiteLattice2d convention (C40).
  const sf = (t) => f((3.0 - 2 * t) * t * t);
  const even = (c) => ((c % 2) + 2) % 2 === 0;   // `and 0x80000001`+fix-up
  const wx = even(rx) ? lerp(sf(fx), fx, fx) : lerp(fx, sf(fx), fx);
  const wy = even(ry) ? lerp(sf(fy), fy, fy) : lerp(fy, sf(fy), fy);
  const h58 = s(c0 + 58), h57 = s(c0 + 57), h1 = s(c0 + 1), h0 = s(c0);
  const rowY1 = lerp(h57, h58, wx);
  const rowY0 = lerp(h0, h1, wx);
  return lerp(rowY0, rowY1, wy);
}

// floorf (slab 0x4fbf4c..: cvttss2si + dec when (float)i > value):
function flr(x) { return Math.floor(x); }

// quintic fade, binary op order (slab 0x4fbfba/0x4fbfdc/0x4fc00c trio):
// u = t·6.0; u−=15.0; u·=t; u+=10.0; u·=t; u·=t; u·=t
function quintic(t) {
  let u = t * K.q6;
  u = u - K.q15;
  u = u * t;
  u = u + K.q10;
  u = u * t;
  u = u * t;
  u = u * t;
  return f(u);
}

// ============ 2D SIMPLEX core — true FUN_008fca60 = slab 0x4fc260 ============
// f32 in/out. Op order byte-transcribed (ABOUT_MATH (12), re-verified dig #4).
export function simplex2d(xin, yin) {
  const x = f(xin), y = f(yin);
  const s = f((f(x + y)) * K.F2);            // (x+y)·F2 (mulss f32)
  const i = flr(f(s + x));                   // floor(s + x) — comiss/dec adjust
  const j = flr(f(s + y));
  const gx2 = f((i + j) * K.G2);
  const dx0 = f(x - f(i - gx2));             // x − (i − (i+j)G2)
  const dy0 = f(y - f(j - gx2));
  // corner rule (slab 0x4fc2d3..0x4fc2e6): dx0 > dy0 → (i1,j1)=(1,0) else (0,1)
  const gt = dx0 > dy0;
  const i1 = gt ? 1 : 0, j1 = gt ? 0 : 1;
  const dx1 = f(f(dx0 - i1) + K.G2);         // slab 0x4fc2ea..0x4fc30c
  const dy1 = f(f(dy0 - j1) + K.G2);
  const dx2 = f(f(dx0 - K.one) + K.G2X2);    // slab 0x4fc320..0x4fc33f
  const dy2 = f(f(dy0 - K.one) + K.G2X2);
  const perm = PERM_SIMPLEX;
  // per-corner kernel + gradient (slab 0x4fc361..0x4fc3bf):
  function corner(dx, dy, h) {
    const t = f(K.KERNEL - f(dx * dx) - f(dy * dy));   // 0.5 − x² − y²
    if (t < 0) return 0;                                // t<0 → contribute 0
    const g = h & 7;
    let c1 = g < 4 ? dx : dy;                           // g≥4 → swap comps
    let c2 = g < 4 ? dy : dx;
    if (g & 1) c1 = f(-c1);                             // bit0: negate comp1
    if (g & 2) c2 = f(c2 * K.neg2); else c2 = f(c2 * K.plus2);  // bit2 ±2.0
    const dot = f(c1 + c2);
    const tt = f(t * t);
    return f(dot * (tt * tt));                          // dot · t⁴ (2 squarings)
  }
  const i0 = i & 0xff, j0 = j & 0xff;
  // hashes (slab 0x4fc36b / 0x4fc3e6 / 0x4fc468): perm[perm[j0]+i0];
  // perm[perm[j0+j1]+i0+i1]; perm[perm[j0+1]+i0+1] — the last loads via the
  // base 0x114ced1 = perm+1, exactly this index math; 512-mirror covers all.
  const h0 = perm[perm[j0] + i0];
  const h1 = perm[perm[j0 + j1] + i0 + i1];
  const h2 = perm[perm[j0 + 1] + 1 + i0];
  const c0 = corner(dx0, dy0, h0);
  const c1c = corner(dx1, dy1, h1);
  const c2c = corner(dx2, dy2, h2);
  const sum = f(f(c0 + c1c) + c2c);          // 0x4fc4c5 / 0x4fc4c9
  return f(sum * K.outScale);                // ×40.0 @0x4fc4cd
}

// ==== Quintic GRADIENT lattice — true 0x8fc740 = slab 0x4fbf40 ====
// f32 in/out. Gradient pair table = RUNTIME .data 0x12eec08/0x12eec0c —
// PLACEHOLDER while that input is open (values NOT binary-derived).
// Quirk (ported verbatim): second y-blend endpoints are (dot_SE − vy0)·qy+dot_NE
// (slab 0x4fc0b4..0x4fc0c8) — an in-binary asymmetry, see header note 3.
export function latticeGrad2d(xin, yin) {
  const x = f(xin), y = f(yin);
  const i = flr(x), j = flr(y);
  const dx = f(x - f(i)), dy = f(y - f(j));
  const perm = PERM_LATTICE;
  const i0 = i & 0xff, j0 = j & 0xff;
  const i1 = (i + 1) & 0xff, j1 = (j + 1) & 0xff;    // lea 1 + and 0xff
  const g00 = perm[perm[i0] + j0] & 7;               // 0x4fbfc9
  const g10 = perm[perm[i1] + j0] & 7;               // 0x4fbff9
  const g01 = perm[perm[i0] + j1] & 7;               // 0x4fbfd1
  const g11 = perm[perm[i1] + j1] & 7;               // 0x4fc031
  const G = GRADIENTS;                               // slav index = hash &7
  // corner dots (slab order NW/NE/SW/SE; y-part × dy or (dy−1), x-part
  // × dx or (dx−1)):
  const dNW = f(f(dx * G[g00 * 2]) + f(dy * G[g00 * 2 + 1]));           // 0x4fbfe7..0x4fc01d
  const dNE = f(f((dx - K.one) * G[g10 * 2]) + f(dy * G[g10 * 2 + 1])); // 0x4fc021..0x4fc041
  const dSW = f(f(dx * G[g01 * 2]) + f((dy - K.one) * G[g01 * 2 + 1])); // 0x4fc045..0x4fc076
  const dSE = f(f((dx - K.one) * G[g11 * 2]) + f((dy - K.one) * G[g11 * 2 + 1]));  // 0x4fc07a..0x4fc0a1
  const qy = quintic(dy), qx = quintic(dx);
  const vy0 = f(f(dSW - dNW) * qy + dNW);            // 0x4fc08b..0x4fc08f
  const vy1 = f(f(dSE - vy0) * qy + dNE);            // 0x4fc0b4..0x4fc0c8 (AS IS)
  const v = f(f(vy1 - vy0) * qx + vy0);              // x-blend 0x4fc0d4..0x4fc0e8
  return f(v);
}

// ==== Quintic VALUE lattice — true 0x900900 = slab 0x4fc100 ====
// Corner values = perm bytes / 255.0 (f32 0x11e0378), symmetric quintic
// bilinear, then (v − 0.5)·2.0 (slab 0x4fc240..0x4fc248). f32 in/out.
export function latticeVal2d(xin, yin) {
  const x = f(xin), y = f(yin);
  const i = flr(x), j = flr(y);
  const dx = f(x - f(i)), dy = f(y - f(j));
  const perm = PERM_LATTICE;
  const i0 = i & 0xff, j0 = j & 0xff;
  const i1 = (i + 1) & 0xff, j1 = (j + 1) & 0xff;
  const h00 = perm[perm[i0] + j0];                   // 0x4fc176
  const h10 = perm[perm[i1] + j0];                   // 0x4fc1a0
  const h01 = perm[perm[i0] + j1];                   // 0x4fc18a
  const h11 = perm[perm[i1] + j1];                   // 0x4fc1dc
  const qy = quintic(dy), qx = quintic(dx);
  const v00 = f(h00 / K.n255), v10 = f(h10 / K.n255);
  const v01 = f(h01 / K.n255), v11 = f(h11 / K.n255);
  const vy0 = f(f(v01 - v00) * qy + v00);            // 0x4fc1cc..0x4fc1d4
  const vy1 = f(f(v11 - v10) * qy + v10);            // 0x4fc1f8..0x4fc200
  const v = f(f(vy1 - vy0) * qx + vy0);              // 0x4fc214..0x4fc23c
  return f(f(v - K.half) * K.plus2);                 // (v−0.5)·2.0
}

// ============ FUN_00908cb0 (slab 0x5084b0) — full transform, byte-exact =====
// Bytes: out = ECX float pair; inX/inY = xmm2/xmm3 DOUBLES; a = xmm1 F32.
// cfg = { minX, maxX } — the C24 runtime config doubles 0x1327670 / 0x13289a8.
export function noiseTransform(out, inX, inY, a, cfg) {
  const adjX = inX + cfg.minX;                     // addsd f64 (0x5084d6)
  const adjY = inY + cfg.maxX;                     // addsd f64 (0x5084c9)
  const u = f((adjX + K.half) * K.scale01);        // mulsd 0.1, cvtsd2ss
  const v = f((adjY + K.half) * K.scale01);        // (0x5084eb..0x50852a)
  out[0] = u;                                      // preliminary store 0x508515
  out[1] = v;                                      // 0x50852a
  if (0 >= a) return out;                          // comiss 0,a → jae 0x508667
  const xf = f(adjX * K.gradXc);                   // mulsd f64 → cvtpd2ps 0x50856e
  const yf = f(adjY * K.gradYc);                   // mulsd f64 → cvtpd2ps 0x508567
  const w = f(f(simplex2d(xf, yf) * K.wMult) + K.wBias);  // mulss+addss, −0xc
  const latXn = f(adjX * K.ninth);                 // mulsd 1/9-f64 → f32
  const latYn = f(adjY * K.ninth);
  const iu = flr(u), jv = flr(v);                  // fp-round helper 0x44d0b0 ×2
  // first lattice call (slab 0x5085c1) = GRADIENT — SWAPPED args (x = adjY/9):
  const rGrad = latticeGrad2d(latYn, latXn);
  // second call (slab 0x50861b) = VALUE lattice, normal order:
  const rVal = latticeVal2d(latXn, latYn);
  // out[0] chain (0x508628/0x508638/0x50864b/0x50864f): w·a → R2·(w·a)
  //   → + (u − iu) → + iu  (floor+frac reconstruct leaves u + displacement).
  const wa = f(w * a);
  const t0 = f(f(rVal * wa) + (f(u - iu)) + iu);
  // out[1] chain (0x5085de..0x508662): (1−w)·0.33 + 0.111, × a → R1·yw
  //   → + (v − jv) → + jv.
  const yw = f((f(K.one - w) * K.yMult + K.yBias) * a);
  const t1 = f(f(rGrad * yw) + f(v - jv) + jv);
  out[0] = t0;                                     // 0x50865a (out[0])
  out[1] = t1;                                     // 0x508662 (out[1])
  return out;
}

// ============ Second evaluator — true 0x908e70 = slab 0x508670 ============
// Bytes: x,y = doubles (xmm0/xmm1); a = f32 (xmm2). Single anisotropic q warps
// BOTH axes (re-verified slab 0x5086c2..0x5086f2); tail = lower clamp at 0.5
// (comiss+ja 0x50872c..0x508731: value < 0.5 → 0.5).
export function evaluator2(x, y, a) {
  const q = latticeVal2d(f(x * K.anisoX), f(y * K.anisoY));  // 0x5086ac
  const qk = f(q * K.warp15);                                // mulss 15.5
  const wx = f(f(f(f(x)) + qk) * K.warpScale);               // cvtsd2ss then
  const wy = f(f(f(f(y)) + qk) * K.warpScale);               // addss, then mulss
  const s = simplex2d(wx, wy);                               // 0x4fc260 @0x5086fa
  const kern = f(f(a - K.KERNEL) * K.KERNEL);                // (a−0.5)·0.5 → −0x4
  const t = f(f(kern * kern) * K.gain * K.gamma);            // ² · 5.35 · 0.95
  const val = f(f(s * t) + a);                               // mulss+addss
  return val < K.KERNEL ? K.KERNEL : val;                    // comiss+ja (lower
}                                                            //  clamp at 0.5)

// Gradient table getter (for tests/inspection):
export function getGradientTable() { return GRADIENTS.slice(); }

// ═════════ diegos dig #9 (2026-09-20 (23), C36–C39) ══════════════════════════
// The surface-noise family: dispatcher true 0x8fd920; the case-5 core true
// 0x8fc020 (IQ-simplex, mod-12 gradients @0x12ee338, final ×70 — formulas
// transcribed from bytes THIS session); the inside-perlin evaluator true
// 0x90b110; the SURFACE evaluator true 0x90a860; the fbm wrapper true 0x8fdad0.
// Cases 0,1,2,3,4 reference UNREAD cores (slab 0x4fab50/0x4fb050/0x4fb150/
// 0x4fb340/0x4fb510 + trig helpers 0xc33222/0xc33234) — dispatch THROWS for
// those, honestly, until their byte reads land. No silent fabrication.

// --- C36/C38 constants newly pinned (2026-09-20, rdata.bin slice) -----------
export const K2 = {
  // IQ-simplex (case-5 core true 0x8fc020):
  sc70: 70.0,                // f64 0x11dffd0 (final ×70)
  // fbm (true 0x8fdad0):
  fbmAmps: [0.5, 0.25, 0.125, 0.0625],       // 0x11dfa94/0x11df9d0/0x11df984/0x11df950
  fbmLacX: 2.02,             // f32 0x11dfe7c
  fbmLacY: 2.33,             // f32 0x11dfee8
  fbmNorm: 0.9375,           // f32 0x11dfba8 (Σ amps, compute-checked)
  // ladder (C38):
  h02: 0.02,                 // f32 0x11df908
  h0241: 0.0241,             // f32 0x11df910
  h025: 0.025,               // f32 0x11df914
  h02789: 0.02789,           // f32 0x11df918
  h05: 0.05,                 // f32 0x11df948
  h495: 0.495,               // f32 0x11dfa90
  h051: 0.51,                // f32 0x11dfaac
  h085: 0.85,                // f32 0x11dfb84
  one1024: 0.0009765625,     // f64 0x11dfb50
  h001: 0.001,               // f64 0x11dfb58
  f64_001123: 0.01123,       // f64 0x11dfc10
  f64_001313: 0.01313,       // f64 0x11dfc30
  f64_002: 0.02,             // f64 0x11dfc70; 0x11dfc68 = f64 0.019999999552965164 (widened-f32 — NOT "f32 2.0"; C77)
  f64_0021: 0.021,           // f64 0x11dfc78
  f64_05243442: 0.05243442,  // f64 0x11dfcc8 (inside-perlin arg scale)
  f64_006: 0.06,             // f64 0x11dfcd8
  f64_049162514: 0.49162514, // f64 0x11dfdc8 (gradient-arg scale)
  f32_0p1: 0.1,              // f32 0x11df974 (grid-law ×0.1 — C95, dig #117)
  f64_6p86e07: 6.86035959282328e-07, // f64 0x11dfa08 (y-arm a·bias — C95, dig #117; meaning OPEN)
  h15: 1.5,                  // f32 0x11dfd2c
  f64_5: 5.0,                // f64 0x11dfee0
  f64_1024: 1024.0,          // f64 0x11e0080
  h100: 100.0,               // f32 0x11e02dc
  hneg20: -20.0,             // f32 0x11e068c
  seedScaleX: 0.00001312,    // f64 0x11dfa68 (readback 1.312e−05)
  seedScaleY: 0.00002331,    // f64 0x11dfa80 (readback 2.331e−05)
};

// ---- 12-dir gradient pairs @ .data 0x12ee338 (byte-pinned this session) -----
// stride 32 B per entry, f64 pairs:
//  0..3 diagonals {±1,±1}; 4..7 (±1,0) duplicated; 8..11 (0,±1) duplicated.
export const GRAD12 = new Float64Array([
  1, 1, -1, 1, 1, -1, -1, -1,
  1, 0, -1, 0, 1, 0, -1, 0,
  0, 1, 0, -1, 0, 1, 0, -1,
]);

// ---- C35 lazy tables: [0x1327bd0]=perm u16; [0x1327720]=perm % 12 -----------
// source .rdata u16 table 0x114cc50 = a copy of PERM_SIMPLEX (starts 151,160,...)
const MOD12 = new Int16Array(256);
for (let i = 0; i < 256; i++) MOD12[i] = PERM_SIMPLEX[i] % 12;

// ============ case-5 core — true 0x8fc020 = slab 0x4fb820 ==============
// f64 args (xmm0/xmm1), f64 return. Skew/unskew = runtime BSS doubles
// 0x132ab68 / 0x132ac70 (UNPINNED — standard F2/G2 widened used, FLAGGED).
// Kernel: per-corner t² (two squarings) · dot(grad12[hash], d), outside → 0;
// three-corner sum; final × 70.0 (0x11dffd0). Gustavson/IQ hybrid op-order
// as read (slab 0x4fb820..0x4fba7c); exact corner op order = the next
// byte-trace item, this port keeps the pinned values + shapes.
export function simplex2DDeriv(xin, yin) {
  const x = +xin, y = +yin;
  // LAP: runtime skew pair (unpinned BSS 0x132ab68/0x132ac70, widened-F2/G2
  // approximation — flagged in C39; byte-trace of the two doubles pending).
  const S = 0.3660254037844386;
  const G = 0.21132486540518713;
  const t = (x + y) * S;
  const i = Math.floor(t + x);              // cvttsd2si + comisd dec (d64)
  const j = Math.floor(t + y);
  const gi = i + j;
  const dx0 = x - (i - gi * G);             // slab 0x4fb88b..0x4fb89f
  const dy0 = y - (j - gi * G);             // slab 0x4fb89f..0x4fb8af
  const gt = dx0 > dy0;                     // comisd xmm4,xmm5 (slab 0x4fb8af)
  const s1x = gt ? 1 : 0, s1y = gt ? 0 : 1; // slab 0x4fb8b3..0x4fb8c0
  const dx1 = dx0 - s1x + G;                // +unsk (addsd 0x132ac70 shape)
  const dy1 = dy0 - s1y + G;
  const dx2 = dx0 - 1 + 2 * G;              // mulsd 2.0 @0x4fb92d then addsd
  const dy2 = dy0 - 1 + 2 * G;
  // Corner kernels: t² · t²  · dot(GRAD12[mod12-hash], d); outside → 0
  // (slab 0x4fb963..0x4fba63; per-corner hash chains on (j&0xff),(i&0xff)).
  function kern(dx, dy, m) {
    let tt = 0.5 - dx * dx - dy * dy;
    if (tt < 0) return 0;
    const gx = GRAD12[m * 2], gy = GRAD12[m * 2 + 1];
    const dot = gx * dx + gy * dy;
    const tt2 = tt * tt;
    return dot * tt2 * tt2;
  }
  const ii = i & 0xff, jj = j & 0xff;
  // hash shape (FLAGGED — corner chains read as perm[perm[?]+?] → MOD12;
  // exact index orientation = follow-up byte item 0x4fb90f/0x4fb917/0x4fb935):
  const m0 = MOD12[(PERM_SIMPLEX[ii] + jj) & 0xff];
  const m1 = MOD12[(PERM_SIMPLEX[(ii + s1x) & 0xff] + (jj + s1y)) & 0xff];
  const m2 = MOD12[(PERM_SIMPLEX[(ii + 1) & 0xff] + (jj + 1)) & 0xff];
  return (kern(dx0, dy0, m0) + kern(dx1, dy1, m1) + kern(dx2, dy2, m2)) * K2.sc70;
}

// ============ NOISE_TYPE dispatcher — true 0x8fd920 = slab 0x4fd120 až =========
// ecx∈[0..8]; jump table @ true 0x8fdaa4 (file 0x4fcea4, 9 dwords).
export const NOISE_CASES = {
  0: 'slab 0x4fab50 — UNREAD core (iq-white family, consts 57/58/43758.546875 pinned C38)',
  1: 'slab 0x4fb050 — UNREAD core (2-arg f64)',
  2: 'slab 0x4fb150 — UNREAD core',
  3: 'true 0x8fc940 = fnvLattice2d — READ + ported 2026-09-21 (C45)',
  4: 'slab 0x4fb510 = true 0x8fd110 — READ (dig #22 #8, registered, not ported — dead lane)',
  5: 'true 0x8fc020 — READ (simplex2DDeriv, above)',
  6: 'true 0x8fc740 = latticeGrad2d (C29)',
  7: 'true 0x900900 = latticeVal2d (C29)',
  8: 'true 0x8fca60 = simplex2d (C25)',
};

export function noiseDispatch(kind, x, y) {
  switch (kind) {
    case 8: return simplex2d(x, y);
    case 7: return latticeVal2d(x, y);
    case 6: return latticeGrad2d(x, y);
    case 5: return simplex2DDeriv(x, y);
    case 3: return fnvLattice2d(x, y);   // true 0x8fc940 — READ+ported 2026-09-21 (W4)
    default: throw new Error(`noiseDispatch: core kind=${kind} UNREAD (${NOISE_CASES[kind]})`);
  }
}

// ============ Inside-perlin evaluator — true 0x90b110 = slab 0x50a910 =======
// f64 args x,y; uid = the config object (see surfaceField below). Flags read:
// [+0x24d] OffsetBySeed (diddle via the C27 table 0x11e0ba0[,%eax,8], draws
// from 0x5111d0-family; seedScale 1.312e−5 / 2.331e−5), [+0x228] fbm,
// [+0x224] noiseType (dispatcher arg), [+0x240..242]/[+0x244/248] the
// Squared/Clamped/Scaled + ScaleMin/Max block. Returns f32.
// seedInt: the C27 one-draw (per-cell generator's +0x94-producer draw);
// we take it as an argument so callers keep a single draw per cell.
export function insidePerlin(uid, x, y, seedInt) {
  const XI = f(x * K2.f64_05243442) * uid.sx + 0.1 + uid.ox;   // mulsd chain
  const YI = f(y * K2.f64_05243442) * uid.sy + 0.1 + uid.oy;
  let xi = +XI, yi = +YI;
  if (uid.offsetBySeed) {                                     // [+0x24d]
    // draws: one DIDDLed int per axis (0x5111d0; diddle 0x11e0ba0[hi], then
    // ·scale 1.312e−5 x / 2.331e−5 y — slab 0x50a97a..0x50a9c9)
    xi += (Math.abs(seedInt) & 1 ? -1 : 1) * seedInt * K2.seedScaleX;  // diddle shape C27
    yi += seedInt * K2.seedScaleY;
  }
  let r = uid.fbm ? fbm4(xi, yi, uid.noiseKind) : noiseDispatch(uid.noiseKind, xi, yi);
  if (uid.squared) r = r * r;                                 // [+0x240]
  if (uid.clamped) r = Math.min(uid.scaleMax, Math.max(uid.scaleMin, r)); // 0x50aa1b..2e
  if (uid.scaled) r = (r * K.KERNEL + K.KERNEL) * (uid.scaleMax - uid.scaleMin) + uid.scaleMin; // 0x50aa3c..0x50aa68
  return r;
}

// The C41-OPEN "index map walks via true 0xc31cea" = RESOLVED (2026-09-21):
// 0xc31cea is the CRT /GS stack-cookie check (cmp ecx,0x12eb000·cookie —
// `repz ret` on match) — NOT a mod-12 map. The C41 "12-dir pair-table"
// note is SUPERSEDED: the table @.data 0x12eb950 = 256 nonzero f64s
// (data_raw.bin off 0x950..0x1148; this session's full read), i.e. the
// 12 "pairs" in the old note were just the first 12 entries of ONE
// 256-entry per-corner VALUE table (each pair of adjacent f64s looks like
// a gradient pair, but the lattice consumes ONE f64 per corner).
// ---- FNV24 hash fn — true 0x8FB2D0 (slab 0x4fb2d0), fully decoded ----
// Buffer = 24 B = {arg_xmm1 f64 | arg_xmm2 f64 | 1234567.0 f64 @0x11e0180},
// FNV-1a (bias 0x811c9dc5, prime 0x1000193), idx = ((h>>8)&0xff)^(h&0xff).
// args arrive as f64 doubles (xmm1 = first, xmm2 = second) — the callers
// widen their f32 corner coords with cvtps2pd. Corner VALUES = the 256-f64
// table @.data 0x12eb950, generated into lib/fnv-tab.mjs (C45).

import { FNV_TAB } from "./fnv-tab.mjs";

const FNV_BIAS = 0x811c9dc5, FNV_PRIME = 0x1000193;
const f64bits = new DataView(new ArrayBuffer(8));
export function fnvHash2d(x, y) {
  // 24 B = LE f64(x) | f64(y) | f64(1234567.0); h ^= byte; h = h·prime
  f64bits.setFloat64(0, x, true);
  const bx = new Uint8Array(f64bits.buffer);
  let h = FNV_BIAS >>> 0;
  for (let i = 0; i < 8; i++) h = Math.imul((h ^ bx[i]) >>> 0, FNV_PRIME) >>> 0;
  f64bits.setFloat64(0, y, true);
  for (let i = 0; i < 8; i++) h = Math.imul((h ^ bx[i]) >>> 0, FNV_PRIME) >>> 0;
  f64bits.setFloat64(0, 1234567.0, true);
  for (let i = 0; i < 8; i++) h = Math.imul((h ^ bx[i]) >>> 0, FNV_PRIME) >>> 0;
  return (((h >>> 8) & 0xff) ^ (h & 0xff)) | 0;   // ((h>>8)&0xff)^(h&0xff)
}

export function fnvLattice2d(xin, yin) {
  const x = f(xin), y = f(yin);
  const i = flr(x), j = flr(y);
  const dx = f(x - f(i)), dy = f(y - f(j));
  const wx = f((3.0 - 2.0 * dx) * dx * dx);
  const wy = f((3.0 - 2.0 * dy) * dy * dy);
  const V = (xc, yc) => FNV_TAB[fnvHash2d(xc, yc)];
  const rowB = wx * (V(i + 1, j) - V(i, j)) + V(i, j);          // y0 row
  const rowT = wx * (V(i + 1, j + 1) - V(i, j + 1)) + V(i, j + 1); // y0+1 row
  return f((rowT - rowB) * wy + rowB);
}

// fbm — true 0x8fdad0 REWRITE (2026-09-21): the "BSS state" = a CONSTANT
// 4-f32 quad copied once from .rdata 0x11e0c70 =
//   { sin(1)=0.8414700031, cos(1)=0.5403000124, 0.5403000124, −0.8414700031 }
// (never written back — an accumulator misread; it is the basis-vector
// set). Octaves: the dispatcher is called 4× with
//   oct1 args = the RAW (x, y)
//   oct2/3/4 args = rotate the state-vector pairs (v0·y + v2·x)·lac /
//                   (v1·y + v3·x)·lac with lac = 2.02 / 2.33 / 2.01
//                   (@0x11dfe7c / 0x11dfee8 / 0x11dfe78 — 2.01 pinned
//                   2026-09-21, NEW pin), amplitudes 0.5/0.25/0.125/0.0625
//                   (@0x11dfa94/0x11df9d0/0x11df984/0x11df950), ÷0.9375.
// The exact (x↔y) lane assignment inside the dot-pairs = the one residual
// byte item (flagged; does not affect kind-5 biomes — fbm = opt-in via
// [uid+0x228] which no live XML sets).
// fbm wrapper — structure per the 2026-09-21 byte-settled state quad; the
// per-octave arg rotation = the flagged residual (see the comment above).
export function fbm4(x, y, kind) {
  let acc = 0, px = x, py = y;
  const amps = K2.fbmAmps;
  for (let o = 0; o < 4; o++) {
    acc += amps[o] * noiseDispatch(kind, px, py);
    px = f(px * K2.fbmLacX);
    py = f(py * K2.fbmLacY);
  }
  return f(acc / K2.fbmNorm);                    // divss 0.9375 @0x4fd474
}

// ============ SURFACE evaluator — true 0x90a860 = slab 0x50a060 (P1) =======
// (x,y) = f64; gradAt = the per-biome gradient-grid sampler (four 0x9fe620
// reads + smooth-corner bilinear INSIDE the binary — the caller passes a
// function; in-binary the grid is the image-baked BitmapNoise [uid+0x1d4],
// C39); uid = config (see C37 offsets). Returns the FIELD.
// gradBiasScale = the +0.49162514 gradient-arg scale, P[+0x94] = the
// per-biome [P+0x94] float (bitmap origin).
// NOT byte-settled inside the grad* ramp: the per-area field build (the
// BitmapCaves band-stack family, C44) — til then gradAt is injected.
// SLOT BINDING (CE-verified 2026-09-20 (35)/(21 dig), CONSTANTS.md C43/C44):
// the FINAL combine's TERM offsets are byte-fixed ints ([+0x268] for the
// gradW term, [+0x264] for the per term) — the CE run only re-LABELED the
// VALUES: +0x268 holds the mMultiplierPerlin value (hills 1.0; winter
// 0.642857), +0x264 holds the mMultiplierGradient value (hills 0.871429).
// Hence gradWCoef = [+0x268] = XML mMultiplierPerlin, perlinCoef = [+0x264]
// = XML mMultiplierGradient (C43's earlier (23)-map had the pair swapped).
export function surfaceField(uid, x, y, gradAt, valueOfP94, seedInt) {
  // BYTE-MODEL (dig #22, 2026-09-21 (40); supersedes the (23)/(26) shape):
  //   field0 = gradAt bilinear, lower-capped at 0.5        (0x50a0d2..0x50a257)
  //   r  = the r-evaluator true 0x90AA80 (slab 0x50aa80)   [surrogate:
  //        noiseDispatch(uid.noiseKind) — FLAGGED, see below]
  //   r' = r·field0, and the FIELD SLOT := r' (0x50a2fe) — every gate and
  //        lane from here on reads r', NOT field0.
  //   add := 0 ALWAYS at 0x50a2ed; = [uid+0x260] only when the case-switch
  //          path is entered (0x50a35b).
  //   if r' > 0.51 (0x11dfaac):
  //       if [+0x268] != 0 (ucomiss-0 test; jnp skips IFF ==0):
  //           gradW = (r'−0.5)·2          (0x50a31e..0x50a334)
  //           per  = insidePerlin(...)    (true 0x90b110 → [ebp-0x8])
  //   if r' > 0.85 (0x11dfb84):
  //       switch [uid+0x220]: cases 1/2/3 blend tails operate on r' —
  //       post-tail xmm2 = rpost. Gate = `comiss 0x11dfb84` @0x90ab48 →
  //       `jbe 0x90b0a2`; dec/je 1→0x90afeb 2→0x90aeba 3→0x90ae03
  //       (@0x90ab74). Default arm (addNoise ∉ {1,2,3}) @0x90ab7d is
  //       LIVE via the world value 0 (hills_flat/mountain_lake): call
  //       0x8fb570 @0x90ab9f (parity lattice = C83 — I20 ① READ) →
  //       g = a·0.05+0.05 → simplex2d 0x8fca60 @0x90abee → C77 tail →
  //       jmp 0x90b0a2 — ported as the else-arm (I20②, dig #113). Tails: r2 = f(n·r') cases 1/3
  //       (mulsd @0x90b075), case 2 = f(n) BARE (jmp 0x90b079);
  //       rpost = f(f(f(r2−r')·f((r'−0.85)/0.1))+r') — subss @0x90b08b
  //       = r2−r' (C77, entry (98)).
  //   slope arm [uid+0x24c] (0x50a8a2..0x50a8d4):
  //       per := per·(1 + (rpost − 1)·y·0.001)      [0.001 f64 @0x11dfb58;
  //       the multiplier = the Y-arg (the [ebp-0x3c] f64)]
  //   FINAL (slab 0x50a8d9..0x50a8fb, canon per dig #22 #8):
  //       out = [+0x268]·gradW·per + [+0x264]·rpost + add
  //  (naming: gradWCoef = [+0x268] = the CE mMultiplierPerlin VALUE;
  //           perlinCoef = [+0x264] = the CE mMultiplierGradient VALUE.)
  // dig #117 (I23② action, entry (117)): THE ×0.1 LANDS — byte law
  // re-verified 2026-10-09 in true 0x90a860 (the call-site frame is
  // PIXELS+0.5, C95):
  //   u = mulss( cvtpd2ps(0.49162514·x + a), f32 0.1@0x11df974 )  @0x90a8f9..0x90a90c
  //   v = mulss( cvtpd2ps(0.49162514·y + a·6.86e-07@0x11dfa08), the same 0.1 )
  //                                                          @0x90a904..0x90a924
  // (a = P[+0x94] = the per-biome bitmap origin; = 0 here = I24 residual.
  //  The y-arm's a·6.86e-07 bias meaning is OPEN (C95).) gradAt therefore
  // indexes a GRID at texel = ~20.34 world px (1/0.049162514); the r-eval
  // below keeps RAW PIXELS (call 0x90b280 @0x90aadd).
  let field = gradAt(
    f(f(x * K2.f64_049162514) + valueOfP94) * K2.f32_0p1,
    f(f(y * K2.f64_049162514) + valueOfP94 * K2.f64_6p86e07) * K2.f32_0p1);
  if (field < K.KERNEL) field = K.KERNEL;                        // 0x50a5b6
  // 2) r-eval + r' (the field slot := r·field, 0x50a2e2..0x50a2fe):
  const rRaw = noiseDispatch(uid.noiseKind, x, y);               // 0x90AA80 surrogate (flagged)
  field = f(rRaw * field);                                       // FIELD SLOT := r' @0x50a2fe
  const rp = field;                                              // r'
  let gradW = 0, per = 0, add = 0;                               // zeroed @0x50a2ed/0x50a2f2
  if (rp > K2.h051) {                                             // comiss 0.51 @0x50a2f7
    if (uid.gradWCoef !== 0) {                                    // +0x268 ≠ 0 runs the lane
      gradW = f((rp - K.KERNEL) * K.plus2);                       // gradW = (r'−0.5)·2
      per = insidePerlin(uid, x, y, seedInt);                     // 0x90b110 → [ebp-0x8]
    }
    if (rp > K2.h085) {                                           // comiss 0.85 @0x50a348
      add = uid.addValue;                                         // [uid+0x260] @0x50a35b/63
      if (uid.addNoise === 1) {
        // CASE-1 lane — slab 0x50a7eb..0x50a89f (dig #11 / (26)), unchanged:
        //   a = whiteLattice2d(x·0.025, y·0.025); g = a·0.05+0.05;
        //   0x8fc020 args (arg0/xmm0 = x-chain, arg1/xmm1 = y-chain);
        //   tail = r' += (n·r' − r')·((r'−0.85)/0.1)   — the base = r'.
        const xd = +x, yd = +y;
        const a = whiteLattice2d(f(xd * K2.h025), f(yd * K2.h025));
        const g = f(a * K2.h05 + K2.h05);
        const xArg = f(xd * K.KERNEL) * K2.f64_002 * g;         // x·0.5·0.02·g
        const yArg = f(yd * K.KERNEL) * K2.f64_002 * g;
        const n = simplex2DDeriv(xArg, yArg);                    // = 0x8fc020
        const r2 = f(n * rp);                                    // r·n·field
        field = f(f(f(r2 - rp) * f((rp - K2.h085) / K.wBias)) + rp);  // rpost — byte tail @0x90b072..0x90b09f (C77, dig #98)
      } else if (uid.addNoise === 3) {
        // CASE-3 (lake ×4) — slab 0x50a603..0x50a6b9. AXIS RETRACE
        // (2026-09-21; supersedes the dig #22 #3 note): judged by the
        // case-1 anchor (0x50a7eb) under the C37 pin xmm2=x/xmm3=y ⇒
        // [ebp-0x44] = x, [ebp-0x3c] = y; arg0 = the x-side in the fn:
        //   a   = whiteLattice2d(x·0.02, y·0.021)
        //         [0.02 f64 @0x11dfc70 on x; 0.021 @0x11dfc78 on y]
        //   g   = a·0.05 + 0.05                    (0x11df948 ×2)
        //   sCh = sin(y/1024)·1024·0.5·0.06·g      (sin = 0xc33234 → IAT
        //         0x114a520; the 1/1024 chain = [ebp-0x3c] = y!)
        //   cCh = acos(x/1024)·1024·0.5·0.06·g     (acos = 0xc33222 →
        //         0x114a514 — IAT thunks, NOT hand trig)
        //   0x8fc020(cCh, sCh) — asm (xmm0 = cCh, xmm1 = sCh); tail on r'.
        const xd = +x, yd = +y;
        const a = whiteLattice2d(f(xd * K2.f64_002), f(yd * K2.f64_0021));
        const g = f(a * K2.h05 + K2.h05);
        const sCh = Math.sin(yd * K2.one1024) * (1024.0 * 0.5 * 0.06) * g;
        const cCh = Math.acos(xd * K2.one1024) * (1024.0 * 0.5 * 0.06) * g;
        const n = simplex2DDeriv(cCh, sCh);
        const r2 = f(n * rp);
        field = f(f(f(r2 - rp) * f((rp - K2.h085) / K.wBias)) + rp);  // rpost — byte tail @0x90b072..0x90b09f (C77, dig #98)
      } else if (uid.addNoise === 2) {
        // CASE-2 (hills2) — slab 0x50a6ba..0x50a7e6. AXIS RETRACE
        // (2026-09-21; supersedes the dig #22 #4 note): arg0 = x-side
        // everywhere; the trig axes = acos on x·0.01313 / sin on y·0.01123:
        //   wl  = whiteLattice2d(x/100·0.025, y/100·0.025)
        //   fN  = fnvLattice2d(x/100·0.0241, y/100·0.0241)
        //   s1  = simplex2d(x/100·wl·0.02789, fN·y/100·0.02789)
        //   aux = s1·wl·5.0 + 0.5                 (5.0 @0x11dfee0)
        //   cCh = acos(x/100·0.01313)·aux + fN·(−20)   [0.01313 @0x11dfc30;
        //         0.01123 @0x11dfc10; −20.0 f32 @0x11e068c]
        //   sCh =  sin(y/100·0.01123)·aux + wl·(−20)
        //   0x8fc020(yCh, xCh) → shared tail, BUT jmp 0x90b079 skips the n·r'
        //   mulsd: case-2 r2 = f(n) BARE (dig #98, C77).
        const xd = +x, yd = +y;
        const wl = whiteLattice2d(f(xd / 100.0 * K2.h025), f(yd / 100.0 * K2.h025));
        const fn = fnvLattice2d(f(xd / 100.0 * K2.h0241), f(yd / 100.0 * K2.h0241));
        const s1 = simplex2d(
          f(xd / 100.0 * wl * K2.h02789),
          f(fn * (yd / 100.0) * K2.h02789));
        const aux = f(s1 * wl * K2.f64_5 + K.KERNEL);
        const yCh = Math.acos(xd / 100.0 * K2.f64_001313) * aux + f(fn * K2.hneg20);   // mulss @0x90af90/afc3
        const xCh = Math.sin(yd / 100.0 * K2.f64_001123) * aux + f(wl * K2.hneg20);
        const n = simplex2DDeriv(yCh, xCh);
        const r2 = f(n);          // jmp 0x90b079 SKIPS mulsd @0x90b075 — bare f32(n) (C77)
        field = f(f(f(r2 - rp) * f((rp - K2.h085) / K.wBias)) + rp);
      } else {
        // DEFAULT ARM (I20②, dig #113) — addNoise ∉ {1,2,3}: the LIVE
        // world value 0 (hills_flat/mountain_lake/laboratory); stale 4
        // falls through the dec/je chain too (@0x90ab68..77). Bytes
        // re-read this session:
        //   a = 0x8fb570(x·0.025, y·0.025)  @0x90ab7d..9f (cvtpd2ps +
        //       mulss [0x11df914]=K2.h025; parity lattice = C83);
        //   g = f(a·0.05 + 0.05)            @0x90abae..bb (mulss/addss
        //       [0x11df948]=K2.h05 — same chain as the cases);
        //   n = 0x8fca60 simplex2d(x·0.5·0.02·g, y·0.5·0.02·g)
        //       @0x90abb6..abee — the 0.02 is the f32 slot [0x11df908]
        //       = K2.h02, NOT case-1's f64_002 [0x11dfc70];
        //   r2 = f(n·r')                    @0x90abfb (mulss);
        //   tail (C77 shape) @0x90ac07..17 → jmp 0x90b0a2 @0x90ac1b.
        const xd = +x, yd = +y;
        const a = parityLattice2d(f(xd * K2.h025), f(yd * K2.h025));
        const g = f(a * K2.h05 + K2.h05);
        const xArg = f(xd * K.KERNEL) * K2.h02 * g;   // x·0.5·0.02·g (f32 slot)
        const yArg = f(yd * K.KERNEL) * K2.h02 * g;
        const n = simplex2d(xArg, yArg);              // = 0x8fca60 (C25)
        const r2 = f(n * rp);
        field = f(f(f(r2 - rp) * f((rp - K2.h085) / K.wBias)) + rp);
      }
    }
  }
  // slope arm (slab 0x50a8a2..0x50a8d4): per := per·(1 + (rpost − 1)·y·0.001)
  const rpost = field;
  if (uid.slopeFlag === 1) {
    const yd = +y;
    per = f(per * (1.0 + (rpost - 1.0) * yd * K2.h001));
  }
  // FINAL (slab 0x50a8d9..0x50a8fb):
  return f(uid.gradWCoef * gradW * per) + f(uid.perlinCoef * rpost) + add;
}
// ---- smoke self-check (run directly) -------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = [0, 0];
  noiseTransform(out, 10.0, 20.0, 1.0, { minX: 0.0, maxX: 0.0 });
  console.log('sample noiseTransform @ (10,20,a=1):', out.map(v => v.toFixed(6)));
  console.log('sample evaluator2 @ (10,20,a=1):',
    evaluator2(10.0, 20.0, 1.0).toFixed(6));
  console.log('sample simplex2d @ (10,20):', simplex2d(10, 20).toFixed(6));
}
