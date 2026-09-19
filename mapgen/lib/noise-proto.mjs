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

// ---- smoke self-check (run directly) -------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = [0, 0];
  noiseTransform(out, 10.0, 20.0, 1.0, { minX: 0.0, maxX: 0.0 });
  console.log('sample noiseTransform @ (10,20,a=1):', out.map(v => v.toFixed(6)));
  console.log('sample evaluator2 @ (10,20,a=1):',
    evaluator2(10.0, 20.0, 1.0).toFixed(6));
  console.log('sample simplex2d @ (10,20):', simplex2d(10, 20).toFixed(6));
}
