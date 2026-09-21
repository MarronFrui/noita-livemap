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
W1. noise-terrain.mjs: replace `evaluator2(a=1.0)` with surfaceField. ✅
    (2026-09-21) The V2 lane runs with the CE-verified slot binding and
    kind 5 (see the dig #21 wiring in ABOUT_MATH 2026-09-21 (38)); cases
    2/3 still THROW, those biomes fall through honestly.
    Port-side pipeline shape (post-remap): field0 (gradAt, ≥0.5-cap) →
    r (0x90AA80 surrogate: noiseDispatch-noiseKind, flagged) → r' =
    r·field0 → the 0.51-gate → [+0x268]≠0 = gradW=(r'−0.5)·2 + per →
    the 0.85-gate → the case tails on r' → rpost → the slope arm →
    FINAL = 3-term.
W1. noise-terrain.mjs: replace `evaluator2(a=1.0)` with surfaceField. ✅
    (2026-09-21) The V2 lane runs with the CE-verified slot binding and
    kind 5 (see the dig #21 wiring in ABOUT_MATH 2026-09-21 (38)); cases
    2/3 still THROW, those biomes fall through honestly.
    ✅ **FINAL-COMBINE REMAP landed 2026-09-21 (dig #22 #8 + the remap
    addendum in (40)):** r' = r·field0 with the field-slot reuse
    (0x50a2fe); gradW = (r'−0.5)·2; the [+0x268]≠0 test runs the lane;
    add := [uid+0x260] only on the switch path; FINAL =
    gradWCoef·gradW·per + perlinCoef·rpost + add; the slope arm =
    per·(1+(rpost−1)·y·0.001) gated by uid.slopeFlag (OFF until its
    XML field is identified). All blend lanes diverge; 143/143.
W2. noise_type map: data uses ONLY `SIN_CAPPED_SIMPLEX` (36 XMLs; winter
    has no attr). ✅ **CLOSED EMPIRICALLY (2026-09-20 (35) + CE run):**
    [uid+0x224] = 5 = the dispatcher case int (= the 0x8fc020 core,
    simplex2DDeriv). Wired 2026-09-21. The name-blob has NO static
    table (C42 stands as the mechanism record only).
W3. case-1 lane (47 live biome XMLs!) ✅ (2026-09-20 (26), ported).
W4. case-2 (hills2) and case-3 (lake ×4) lanes = ✅ **READ + PORTED
    (2026-09-21 dig #22, ABOUT_MATH (40)):** the mGradientAddNoise
    switch has FOUR branches (cases 1/2/3 + a ≥4-else lane calling
    true 0x8FB570 = unread, dead in live data); the exact chains are
    byte-cited per lane (case-2: wl + fnvLattice + simplex2d + aux +
    acos/sin·(−20) chains; case-3: whiteLattice + sin/acos·1024·0.03·g
    + the IQ); the trig "helpers" = plain IAT thunks
    (0xc33222→acos @0x114a514, 0xc33234→sin @0x114a520). The FNV24
    hash true 0x8FB2D0 + lattice true 0x8FC940 + the 256-f64 corner
    table @0x12eb950 = ported (C45; `lib/fnv-tab.mjs`); noiseDispatch
    case 3 wired (was thrown). Dispatcher case-4 = read-only (dead
    lane, no XML). Two follow-ups registered: (a) the canonical
    FINAL-combine remap — **[+0x268]·gradW·per + [+0x264]·field +
    add with gradW = (r'−0.5)·2, r' = r·field** (the port's 2-term
    FINAL = structurally wrong, the next push's first edit); (b) fbm's
    exact dot-pair lane assignment (opt-in only; lac 2.01 @0x11dfe78
    = the new pin).
W5. gradAt / the field build: **RESOLVED SHAPE (2026-09-21 dig #21,
    CONSTANTS.md C44): the field (a C31-family grid) = the
    mTopology→BitmapCaves-generated cave/band-stack builder** (fn A true
    0x8EEC70 + fn B true 0x8F5DD0 with the three Fixed (A,B)-band stacks
    over a fresh per-build poro Random; the factory fn C1 true 0x8F2FF0
    caches by NAME in the 0x132aae8 map — hills.xml size_x=512/
    size_y=256 = the CE grid ✓, the 5+uid px-share = the name-keyed cache).
    **"mGradient* = band-stack parameters" ELIMINATED (0 config-slot
    reads in fn A/B bodies).** The mGradient* XML family feeds ONLY the
    C37 surface evaluator (CE (35)). Port status: the gradAt input is
    STILL the injected ramp instrument (the cave-builder fn B = a
    ~113 KB blob/stamp engine — NOT ported this session); the
    surfaceField's other inputs (noiseKind 5 + the C37 CE-mult slots)
    ARE byte-sourced now.
    ✅ **dig #26 (2026-09-21, CONSTANTS.md C46): fn A is READ to walk
    level** — the CaveStructure stamp walker (≤50-step x-wanderer, roll
    update 0.35/0.25, carve v = clamp01((d2·0.32+0.35)·roll), the
    0.2/0.6/0.7 envelope, per-stamp recursion = the cave_childs
    mechanic) + the helper family pinned (blob setter 0x8EE750 =
    max-bleed + circle falloff, scatter 0x8EF2D0, blends 0x8EF870/
    0x8EF950). REMAINING named sub-reads before the port can land:
    (a) the setter's falloff block (slab 0x4ee044..0x4ee11c);
    (b) the multi-blob scatter engine 0x8EF2D0; (c) fn B's worm/surface/
    mountain machinery (the 0x8F5DD0 body); (d) fn C1/C2 wiring (how
    the stamped grid feeds the [uid+0x1d4] BitmapNoise instance).
    The gradAt ramp/`bitmap_noise_file` fallback instruments STAY until
    (a)–(d) land — replacing them now would be a guess (no-guessing
    mandate), and would poison the I1 instrument.
W6. The engine runtime config (BIOME_PATH_FIND_WORLD_POS_* = C24/C28
    159/223) remains @prov noitool — validating CE reads would close it.

## 4. Shape-first validation contract (the gates)
- Only after W1..W5 land: `npm run bench:ref` (ref tiles missing on
  disk), then flat-region rms + solid-density vs the frozen91 capture
  (seed 78633191). Diff entries with BOTH VAs + shape metrics in
  ABOUT_MATH §6 (dated). Cache bump r3f→r3g ONLY on an observable change.

## 4b. First validation pass (2026-09-21, dig #21 wiring)
- ref regenerated: `mapgen/out/ref/` = tx 29..47 × ty 0..19 (380 chunks).
- Instrument: `mapgen/experiments/2026-09-21-surface-shape.mjs` →
  `mapgen/out/gen-shape-2026-09-21.json`.
- Handoff window (ty 11..19): allPixelRms 73.535 · flatPixelRms 48.717
  (flat 20.3%) · refSolid 0.690 vs ours 0.429. Worst = tx 45..47, ty
  12..14 (the lake/rainforest_dark band + the P1 templates).
- FIND: ZERO procedural-noise chunks in this window — the noise lane's
  chunks live at biome rows 0..2 (canvas ty 48..51); the next instrument
  pass needs the canvas/biome px mapping for the hills-family areas
  re-checked, THEN the rms re-run against the noise-band chunks.
- I1/I3/I5/I6: NOT checked (the run did not validate the surface band;
  density gap 26 pts = evidence, not a close).
- Cache: r3f → r3g BUMPED (kind-8→5 + mult-slot binding = observable
  mask change in the 574 procedural chunks).
- Tests: 143/143 ✓ (post-wiring).

## 5. регистра register-conflicts to NOT re-derive
- All byte pins: CONSTANTS.md C36..C39 (frozen 2026-09-20).
- Port functions: noiseDispatch/simplex2DDeriv/insidePerlin/fbm4/surfaceField.
- The 9-case dispatcher + case table @0x8fdaa4 (dwords = true VAs).
- The wang-lattice/σ/perm tables (C25/C29/C35) — closed rows.
