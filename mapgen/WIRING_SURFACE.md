# WIRING_SURFACE.md — the surface-noise wiring contract (2026-09-20 night)
#
# Purpose: everything needed to wire the surface layer into
# `lib/noise-terrain.mjs`, with each claim's current byte status.
# Sources: ABOUT_MATH 2026-09-20 (22)/(23)/(24) (digs #8/#9/#9b/#9c),
# CONSTANTS.md C24–C39, VERIFIED §11/F3. Evidence dumps:
# mapgen/out/d_2026-09-20-*.asm. Read-only contract — do not change
# behavior until the shape instruments (I1/I3) pass.

## 1. The binary pipeline (byte-read, canon)

    biome XML (mGradient*/mInsidePerlin*/mMultiplier*/noise_type)
        → per-biome config object ("uid", offsets byte-mapped in C37:
          +0x220 addNoise(1/2/3) · +0x224 noiseType · +0x228 fbm ·
          +0x230/+0x238 ScaleX/Y · +0x240..242 Squared/Clamped/Scaled ·
          +0x244/248 ScaleMin/Max · +0x24c slope flag · +0x24d
          OffsetBySeed · +0x250/+0x258 OffsetX/Y · +0x260 AddValue ·
          +0x264 MultPerlin · +0x268 MultGradient)
        → SURFACE evaluator true 0x90a860 (noise_utils.cpp):
            field = 4-corner bilinear(gradGrid)          (wrap getter
                                                          0x9fe620 ×4,
            grad = (x·0.49162514 + (f64)(f32)[P+0x94])    C32-class)
            field = max(field, 0.5)                       (the "CAPPED")
            r·field > 0.51 (0x11dfaac) → AND field > 0.85 (0x11dfb84)
              → switch addNoise:
                 1/2/3: inner core chains ending in a call of
                        true 0x8fc020 (the case-5 IQ-simplex, NOW READ:
                        mod-12 grads @0x12ee338, ×70; ported as
                        simplex2DDeriv) + per-lane core slabs:
                        0x4fab50 (case 1 · hash-lattice, consts
                        57.0/58.0/43758.546875 pinned, sin-hash helper
                        = CRT jmp-thunk family 0xc32e30-slab)
                        0x4fb340 (case 2) · 0x4fb050/0x4fb150/0x4fb510
                        (cases 1-4 of the DISPATCH at true 0x8fd920)
            blend tail (case lanes): field += (r−field)·((field−0.85)/0.1)
            slope arm (byte uid+0x24c): field += (x·0.001)·(field−old)
            FINAL: out = MultGradient·(gradW) + MultPerlin·r + AddValue
        → the C34 sampler (>0.5 gate on the FIELD value; u16 interp on
          [+0xd4]; DECOR write [+0x1e0]) — already ported/read (C34).

## 2. What exists in the port tonight (noise-proto.mjs, dig #9c)
- K2 (all C36/C38 pins), GRAD12 (12-dir pairs, byte-pinned), MOD12 (=C35).
- simplex2DDeriv   = case-5 core 0x8fc020, formulas transcribed; skew
                    = BSS runtime UNPINNED → widened F2/G2 flagged.
- noiseDispatch    = true 0x8fd920 (honest THROWS for cases 0..4).
- insidePerlin     = true 0x90b110.
- fbm4             = true 0x8fdad0 structure (BSS state open, flagged).
- surfaceField     = true 0x90a860 (gradAt INJECTED; AddNoise 1/2/3 lanes
                    THROW).
- Tests unchanged: 143/143; no cache bump (r3f stands).

## 3. The wiring plan (per step, with the blocked byte named)
W1. noise-terrain.mjs: replace `evaluator2(a=1.0)` with surfaceField.
    Needs: (a) noise_type→case map [W2], (b) the hills case-1 lane [W3],
    (c) gradAt [W4].
W2. noise_type map: data uses ONLY `SIN_CAPPED_SIMPLEX` (36 XMLs; winter
    has no attr). The int ([uid+0x224]) the binary feeds the dispatcher is
    a runtime-reflection lookup — NOT statically readable (imm32 scan of
    the whole exe = zero refs). Next byte home: the biome.cpp walk before
    the LoadImage call (true 0x8ee6bb's frame) and/or a ceng-reflection
    hash of the name. Gating: the dispatcher cases that DONT reference
    unread cores (6/7/8, plus 5) are port-wireable today.
W3. case-1 lane (47 live biome XMLs!): inner chain = slab 0x4fab50
    (hash-lattice: floors, (3−2f)f² weights, sin-hash helper, consts
    57.0/58.0/43758.546875/0.5/0.1/0.2 all pinned) + helper calls true
    0x44d110 (a CRT math jmp-thunk family — sin/cos identity = the next
    read) → then true 0x8fc020 (ported). The case-1 asm block =
    slab 0x50a7eb..0x50a8a2 (evidence in
    out/d_2026-09-20-surface-evaluator.asm).
W4. case-2 (1 live XML) and case-3 (4 live) lanes = same skeleton with
    the trig wrappers (slab 0xc33222/0xc33234 = true 0x1033a22/0x1033a34)
    + cores slab 0x4fb340/0x4fb050-family — smaller priority.
W5. gradAt: the per-biome grid input. In-binary = image-baked BitmapNoise
    ([uid+0x1d4], C39: the .plz/PNG LoadImage chain uppercase→
    LoadImageFastLZ true 0x90e060). The mGradient* XML → image rasterize
    (if any) inside the biome.cpp frame TRUE 0x8ee6bb = THE one open
    byte for hills/winter; WIRING = keep gradAt injectable so the shape
    instruments can run against the current best model (ramp prototype)
    while that read lands.
W6. The engine runtime config (BIOME_PATH_FIND_WORLD_POS_* = C24/C28
    159/223) remains @prov noitool — validating CE reads would close it.

## 4. Shape-first validation contract (the gates)
- Only after W1..W5 land: `npm run bench:ref` (ref tiles missing on
  disk), then flat-region rms + solid-density vs the frozen91 capture
  (seed 78633191). Diff entries with BOTH VAs + shape metrics in
  ABOUT_MATH §6 (dated). Cache bump r3f→r3g ONLY on an observable change.

## 5. регистра register-conflicts to NOT re-derive
- All byte pins: CONSTANTS.md C36..C39 (frozen 2026-09-20).
- Port functions: noiseDispatch/simplex2DDeriv/insidePerlin/fbm4/surfaceField.
- The 9-case dispatcher + case table @0x8fdaa4 (dwords = true VAs).
- The wang-lattice/σ/perm tables (C25/C29/C35) — closed rows.
