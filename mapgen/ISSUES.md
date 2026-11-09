# ISSUES.md — generated-map defect registry (purification phase)

> **Rules (user mandate, 2026-09-09):**
> - One issue at a time; register everything here; check boxes as they close.
> - **No guessing.** Intertwined parameters cannot be fitted empirically — the
>   path forward is systematic deconstruction of `noita_dev.exe` (Ghidra) +
>   the game's own data/scripts, validated against captures. Previous
>   approximations (fBm fills, calibrated palettes) are placeholders, flagged
>   as such below; they get REPLACED by reconstructed mechanisms, not tuned.
> - **Parallel worlds (east/west) are NOT a priority** — main world first.
> - Stable baseline = commit `1b2d462` (before the 71×144 extension commit
>   `fd4e11a`, which fixed the bottom extent + canvas wiring but added noise:
>   approximated fills, straight walls, wrong lava/lake bands). We keep the
>   extension's *correct* parts (extent, clamped virtual map, canvas keys,
>   last-candidate fallback) and systematically replace the approximations.
> - When this file or the session bloats, the model writes the handover into
>   `SESSION_CONTEXT.md` and asks the user to start a fresh session.

## Fixed known facts to anchor the work

> **Standing rule (2026-09-19, user mandate — no-guessing phase):** every
> binary-derived constant/byte-pin must be registered in **`CONSTANTS.md`**
> (with its VA(s), meaning, and verification date) BEFORE it is used in
> code, in another doc entry, or in a hypothesis. Code comments reference
> entries as `CONSTANTS.md::<C##>`. If a value is needed and is not
> already in that table, it must be re-verified on disk this session and
> then registered — no re-scans.

- **Predictable spawns in The Work:** the **moon** (top/heaven band) and the
  **dark moon** (bottom/hell band). Seed-independent → registration anchors +
  validation targets (same role as the HM bands, mapcap/PREDICTABLE_ZONES.md).
  Zones where elements cannot spawn around them are also predictable.
- Extension mechanics that are verified and stay: clamped biome-map sampling
  (48 sky rows, 48 deep rows, 1 east col), per-cell clamping (L-shaped areas),
  the_end extends down, the_sky up, world = 71×144 chunks, canvas = world +
  (17920, 31744).

## Issue registry

### 0. Priorities
> The single ranked work list lives in `VERIFIED.md` §9 — this section does
> not duplicate it. Standing order (user mandate): the surface band first;
> everything below it (I45, I39/I43, The Work I3/I5/I6) queues behind it;
> parallel worlds parked (I16).

Legend: [ ] open · [x] fixed · (A) = approximation to replace by
reconstruction · priority HIGH/MED/LOW, user-weighted.

### 1. Surface band (top, sky → hills) — "not figured out yet"
- [x] **I1. Surface generation missing entirely — CLOSED 2026-11-09 (synthesis: superseded).** The surface band now renders through the Topology lane (C178, digs #205–#218); the open surface defects are owned by I47 (shape), I48 (winter), I50 (the topology fix list), I57 (the surface line).
- [ ] **I2. Pyramid partial → re-owned by I61** (2026-11-09: the pyramid's own wang chunks render; the defect is the wedge / top / hallway chunks around them).

### 2. The Work — heaven (top extension band)
- [~] **I3. Top extension entirely incorrect** (HIGH) — AMENDED dig #215: the premise ("the real band has its own generation — the_sky wang area") was wrong (VERIFIED §8 row 79). The Work rows (Heaven AND Hell) re-read the MAIN band's wang image P through its wrap (period 24570 px) and the edge biome (the_sky / the_end) re-classifies P's placeholder cells (C186; `lib/the-work.mjs`). LANDED: the interior layout (E2 sentinel: Heaven 0.496 / Hell 0.415 vs the main band's own 0.387). OPEN: the side walls (I6), the Heaven palette vs the capture, the moon (I4).
- [ ] **I4. Moon + no-spawn zones** (MED, anchor): register the moon as a
  predictible-static-anchor. NOTE 2026-09-17: the moon's ART now lands via
  the `SPLICE_PNGS` blit (moon.png @ world (0,−26112); dark moon @
  (0,37512)) — review whether any I4/I7 work remains beyond what the
  spliced-scene render already provides. It remains a seed-independent
  anchor; use it to align/validate the heaven band.

### 3. The Work — hell (bottom extension band)
- [x] **I5. Lava band must be PURE lava** — CLOSED 2026-11-08: lava.xml = one `lava` MaterialComponent [−100,100], limit_y 0 ⇒ pure lava at every row, coloured by C185 ((255,96,0) flat); the invented `y+512 <= 14600` dark-matrix cutoff + 3-shade mix removed (`renderLavaFill`). E1, seed 78633191, rows 40–46 (95 lava chunks): mean |gen−capture| lava share 0.0043, max < 0.03 (was ≈0.99 at rows 42–46). Pin: `tests/mapgen/lava-band.test.mjs`. Residual: lava_90percent's rock_hard_border band (~2.3%) = A8.
- [~] **I6 — AMENDED dig #216:** the sinusoid = THE BIOME-EDGE LAW (C187, §8 row 80): GetBiomeAt `0x909da0` displaces the solid_wall | the_end boundary by `30·sin/cos(0.005·) + 11·simplex` inside a 41-px strip — LANDED in the Work lane (E1: the Hell wall edges' median |capture − port| 1 / 0 px vs 20 / 21 px straight). OPEN: the wall INTERIOR = `DEEP_ROCK` random speckle (A) — **tested 2026-11-09: its four colours are exactly the union of the two textures (rock_hard = (98,59,50)/(55,34,29), rock_hard_border = (64,35,28)/(37,21,17)); the C146 driver-fill port (classify(surfaceField) of solid_wall + C185) does NOT beat the speckle on the capture (exact colour 30_16 0.425 → 0.452, 31_16 0.461 → 0.313, 39_16 0.308 → 0.272, 39_17 0.300 → 0.214; the port's rock_hard share 61–96 % per tile) ⇒ the classify's material SPLIT there is wrong, not the colours — not ported** — the game's = solid_wall's classify (`rock_hard` [−100, 0.95] / `rock_hard_border` [−0.25, 3.5]) painted with their C185 textures (the capture's wall families = exactly those texture pairs); the "walls everywhere" note below = the main-band half of the edge law (I53).
- [ ] **I7. Dark moon + no-spawn zones** (MED, anchor): same as I4 for hell.

### 4. Main band defects
- [x] **I8. West lake renders as dirt, should be water** — CLOSED 2026-09-17: root cause = `lake_deep` is a single-material biome; `lib/colorize.mjs` now detects `materials.length===1 && !rare` and shades the grey placeholder ramp with that material (test `bench.test.mjs "I8"`; cache r3b→r3c).
- [x] **I9. Yomi / boss_arena not loaded — CLOSED (synthesis 2026-11-09):** structurally fixed 2026-09-17 by the spliced-scene lane (`SPLICE_PNGS` / `blitSplicedScenes`, fixed art at fixed world positions); the `.plz` codec = C143 (dig #168); the residuals = I39 (the floor under splice scenes) and I40 (the splice stand-ins).
- [x] **I10. Holy Mountain right side of shop = noise — CLOSED 2026-11-09 (visual check, seed 78633191, tiles 32..36_16 ours vs capture):** the shop row, the right-side corridor and the cage room land on the capture's shapes; the temple arms' art renders (the air-keyed cells fixed dig #225).
- [ ] **I11. Portal to Holy Mountains (re-scoped 2026-11-09, LOW):** the HM top pool rooms' TERRAIN now matches (dig #225: their air cells were painted dark blue); the purple ring in the capture is the portal ENTITY's sprite (`EntityLoad`), which the generator does not draw (entities are not map cells). Open: whether the live map should overlay entity sprites at their seeded positions. Also open: the pool VARIANT pick (spawn_altar_top: SetRandomSeed(x, y) + Random(1, 50), both bindings byte-read dig #225 = the port) gives lava at 32_16 where the capture shows the plain top, and the capture's blood (33_16) / oil (36_16) are not reproduced by any call offset within ±60 px (6 hits of 14,641 = chance) — the capture may be player-altered, or init's (x, y) for the temple chunks differs.
- [ ] **I12. Teleportatium ball below HM (re-scoped 2026-11-09, LOW):** the small chamber renders in place; the ball inside is an entity sprite, same class as I11.
- [x] **I13. Black boxes in level 1 — CLOSED 2026-11-09 (measured):** over the level-1 tiles 32..38 × 14..15 (seed 78633191), 10-px cells fully black in our render where the capture is < 50 % black = 0 in every coalmine tile; the only residuals (33_14: 389, 34_14: 58) are hills / mountain_left_stub sky rows where the capture's surface sits higher = I57.
- [ ] **I14. HM has good resolution, rest is coarse** (LOW for now, user:
  fix shapes first): expected — HM is a pixel scene (art), the rest is
  noise-filled wang; will converge as I1 lands.
- [x] **I15. Missing elements inventory** — DONE 2026-09-17: `experiments/2026-09-17-element-inventory.mjs` → `out/inventory.md` classifies 146 biomes (RENDERED=27 / AIR-HOLE=6 / PARTIAL=752); map-affecting gap list = custom lua fns + unported pixel-scene loaders.
### 5. Parallel worlds (east/west)
- [ ] **I16. Parallel worlds displayed but not a priority** (LOW/PARKED):
  viewer shows east/west segments from the hosted ref; our generator only
  builds the main (middle) world. Main world first; PW = clone with
  minor spawn variations later.

## Data-audit note (2026-09-19, noitool sweep — user mandate)

> **UPDATE 2026-09-19 (8): isCoalMine/shouldBlockOutRooms selection is now
> DETERMINED in-binary** (ABOUT_MATH 2026-09-19 (8); CONSTANTS.md
> C19–C21): the driver + hasPath gate both regimes by **template-file path
> equality** against the literals `data/wang_tiles/coalmine.png` /
> `data/wang_tiles/excavationsite.png` — never by biome name. The name-list
> flags in `lib/biomes.mjs` are REPLACED by the path rule; affected biomes
> (exhaustive): {coalmine, solid_wall_tower_1, _EMPTY_} (coalmine.png) ∪
> {excavationsite, solid_wall_tower_2} (excavationsite.png). The name lists
> were provably non-exhaustive (all tower_* share one name; _EMPTY_ missed).
> The name-list @prov debt for these flags is RETIRED; remaining noitool
> debt unchanged (wasm fill in bench/legacy tests, start_x=0x8e constant —
> now understood as the stairs-band search, C20).

> The `lib/biomes.mjs` name-list flags tagged `@prov noitool` are gone
> (replaced by the path rule above). Supporting census (still useful):
> `<BitmapCaves>` appears in 59 biome XMLs, but the
> `do_beginning_paths`/`do_beginning_down` attrs exist ONLY in desert/
> forest/hills*/mountain_right_stub/mountain_tree — **coalmine.xml
> carries none** (its `<BitmapCaves>` = plain structures), so the hax is
> NOT flag-selected. Live noitool artifacts remaining (both tagged,
> = debt): `lib/wang-wasm.mjs`'s wasm (bench + legacy tests) and the
> `start_x=0x8e` constant (understood as the stairs-band search, C20).

### 6. Bench pipeline coverage
- [x] **I17. Bench wang-layer script skips template biomes — CLOSED 2026-11-09 (scope note, not a defect):** `bench:gen` is the LEGACY lane (AGENTS.md: noitool's obsolete wasm, a regression baseline only); template rendering is validated by the genmap pipeline + the capture instruments (C97, C151).

### 7. Registry/doc defects

- [x] **I18. CONSTANTS C33 true VA misstated** — CLOSED 2026-09-22, dig #85: true VA `0x8f4830` was +0x800 off; corrected. §6 entry (85).
- [x] **I19. Dig-#85/86 doc defects (identity misread + phantom)** — CLOSED 2026-09-22, dig #86. §6 entry (86).
- [x] **I20. Default arm body (true 0x8fb570)** — CLOSED 2026-10-06, dig #113: read. §6 entry (113).
- [ ] **I21. The C76 classify/evaluate FRAME rests on claim (c); the world
  frame fits the surface band — frame flip = pending dig** (opened
  2026-09-24, dig #101; **PARKED 2026-10-06, dig #114 — the IoU verdict
  below shows field shape, not registration, dominates; see the Verdict
  block at the end of this entry**): dig #97's frame decision (x = canvas px,
  y = canvas py − 24576) eliminated the world-frame candidate via claim
  (c) — "the hills-family noise band lives at CANVAS ty 48..50 = biome
  rows 0..2" (`mapgen/experiments/2026-09-21-noise-window.mjs:4-6`) —
  but the capture puts ground at bty 12..14 (`mapcap/PREDICTABLE_ZONES.md:31-32`
  spawn surface j=12..14; dig #100 census: transitions bty 10..14, none
  ≤9) ⇒ the noise band cited at canvas ty 48..50 is SKY, so the
  elimination's premise does not pin the surface. Re-running it with
  the true surface position (bty 12..14 ⇒ world y = canvas_py − 31744,
  C80) puts the surface at wy ∈ [−1024, 512], which fits the hills.xml
  soil `limit_y` window [−1024, 424.229] (hills.xml, re-read this
  session) AND the mGradient ±1024 ramp — while the adopted −24576
  puts the surface at y ∈ [6144, 7680], outside every limit_y window
  (soil/copper gates never see the real surface; only the catch-all
  [0.53, 3.5) with limit_y=0 fires). The test's line assertion stays
  TRUE (world @OFFSET_Y=14 ⇒ y − 7168 < −1024 rejects soil —
  `tests/mapgen/surface-wiring.test.mjs:213-216`); only the
  interpretation flips: that probe cell sits at canvas ty 48 (sky),
  not at the surface rows. Dig #101 keeps the two-frame split
  deliberate (field build = world C80; evaluate/classify = C76 −24576,
  the evaluator2≡classify identity preserved) — flipping classify to
  the world frame = a separate later dig, after the field-wiring IoU
  (entry (101)) isolates whether registration or field shape is the
  remaining error. The noise-window result JSON was read this session
  (`mapgen/out/noise-window-2026-09-21.json`: window tx 29..47 ×
  canvasCy 48..82, 240 v2 chunks, allPixelRms 15.39, refSkyFrac 0.009,
  refVoidFrac 0.857) — the window OVERLAPS the surface rows 60..62 but
  claim (c)'s stated band (48..50) does not. Source: ABOUT_MATH §6 (101).

  **Dig #142 note (the V2 lane stays on canvas coords — registered
  here, not fixed here):** the kind-0 r-eval port landed in the WORLD
  frame (`bandRampEval` consumes the driver's baseX/baseY =
  17920/7168), but the V2 lane attaches its driver and feeds its x/y
  as CANVAS px (`noise-terrain.mjs:379`, the "rides the canvas coords"
  comment) while the V3 lane feeds world px (`:508`). The driver rides
  along (the frame values are per-call params, so nothing throws and
  no cross-frame mixing was introduced on the V3/world side), and the
  canvas→world flip of the V2 lane = THIS row's parked frame work —
  the mixing observation is recorded here so the next frame dig owns
  it. Source: entry (142).

  **Verdict (ABOUT_MATH §6 (114), runs 2026-10-06).** Re-ran the instrument
  with the #113 byte fix (C93): `mapgen/out/surface-y-iou-2026-10-06.md`
  (n=7065). **FIELD SHAPE dominates; registration does NOT** ⇒ this box is
  PARKED (not the next dig) and §8 row 34 records the elimination of a
  global registration/frame offset as the dominant remaining error. Proof
  from the run: (i) overall `meanAbs` did NOT improve — 88.76 → **89.58**
  (bias 1.62 → 2.88); (ii) family biases are mixed-sign post-run —
  mountain −28.89 / winter −17.93 / lake −40.76 / desert **+36.79** /
  hills **+179.37** — while a global offset would shift them together;
  (iii) within-family flips — hills 33_13 −205.69 vs 39_14 **+340.83**
  (desert 45_14 −546.15 vs 46_14 +321.57); (iv) the band's depth tilt
  *strengthened*: `fitDepth` a −0.347 → **−0.56164**, b 99.172 — a
  registration change cannot add a slope. Only 11/56 tiles moved, all on
  the whiteLattice2d lanes (6 hills + 5 desert), so the frame fix reached
  only the lanes that consume bytes. Note the gate metric did not improve
  (meanAbs 88.76 → 89.58): byte fidelity ≠ shape fidelity.
  Source: ABOUT_MATH §6 (114).

- [x] **I22. Ported `whiteLattice2d` (0x8fb350) inverts its output** — CLOSED: polarity corrected in the port. §6 (26)(112).
- [ ] **I23. The V2 chunk lane (the game's real cell loop) runs at ~1.8%
  compute density on a DIFFERENT coordinate frame than V3, and no
  instrument judges its shape** (opened 2026-10-06, dig #114):
  **① density.** New census `mapgen/experiments/2026-10-06-v2-chunk-census.mjs`
  (post-#113): 2288 procedural · 663 COMPUTES · 1625 falls · density
  **0.0183** · all-air 17 · textured 646 · all-solid 0; pre-#113 A/B:
  658 · 1630 · 0.0185 — i.e. **#113 changed only 5 cells
  (mountain_lake.xml `5 fall (surfaceField default arm …)` → `5 compute`)
  plus speckle; the ~1.8% vs entry-(26)'s recorded `2194 @ ~48-51%`
  gap is NOT #113's doing** (that baseline is also ad-hoc:
  pre-kind-5-rebinding/C77-fix/#101-gate-change — do not diff raw
  numbers, but the A/B pins the delta). All falls post = `noiseDispatch
  kind -1`, 0 UNKNOWN. **② frame divergence.** The V2 lane builds its
  field in CELL space: `gx = tx·CELLS_PER_CHUNK + cx + 0.5`,
  `gy = ty·CELLS_PER_CHUNK + cy + 0.5` with `CELLS_PER_CHUNK = CHUNK/10 =
  51.2` (`noise-terrain.mjs:87,234-235`) — a world-px coordinate ÷ 10 —
  while the V3 lane feeds `surfaceField` WORLD px
  (`wx = x − worldX0`, `wy = y + bandTopPx − worldY0`,
  `noise-terrain.mjs:319-324`, frame C80), yet `gradAt` is documented
  and built on **world-y** units (makeGradAt ramp StartY→EndY,
  `noise-terrain.mjs:143`; bitmapCaves field lookup indexes raw gx/gy
  `:225-227`). One of the two lanes is sampling the ramp/field with a
  10× coordinate mismatch. **[② SETTLED dig #116 — the frame read is
  done; action = the port fix below.]** Call-site frame (entry (116),
  C95): `0x90a860` is called from `FUN_00908f40` (3 sites in
  `FUN_00792580` — 0x7930d3 main, 0x7938d1 x−1, 0x7938fe x+1) with
  **pixel** coords `xmm1 = driver[+0x20]+x`, `xmm2 = driver[+0x24]+y`
  (counters step 1, bounded by `driver[+0x28]/[+0x2c]`) **+0.5 each**,
  `ecx = driver[+0x70]`, stack = the `0x909da0` region — and the
  sibling `0x909da0` applies `>>9` / `&0x1ff` (= **512-px chunk index +
  intra-chunk offset**) to the same values, adding `this[+0x38]/[+0x40]`
  only inside itself. ⇒ **V3's world-px frame IS the callee's argument
  frame; V2's ÷10 cell frame is not.** BUT the callee's *grid*
  coordinate is `f32(0.49162514·(x+0.5) + P[+0x94]) × 0.1`
  (`mulss 0x11df974` = f32 0.1, floors to 4× `0x9fe620` wrap-mod corner
  reads → smoothstep `(3−2t)·t²`; `0x11e015c = 10.0` / `divss 0.1`
  undo it in the add-noise arms), while its r-eval `0x90b280` gets the
  **un-divided** pixels — and `noise-proto.mjs:676` implements
  `gradAt(f(x·0.49162514)+valueOfP94, …)` with **no ×0.1**. So neither
  lane is wrong on its own: **V2's pre-÷10 makes the grid term exact
  but starves the r-eval 10×; V3 matches the argument frame but runs
  the grid 10×.** ⇒ **the defect is a one-step port omission inside
  `surfaceField`, not a lane-frame question.** **[② ACTION LANDED dig
  #117 (entry (117), C96):** the ×0.1 + the `0.1·P[+0x94]` y-arm bias
  are IN `surfaceField` (`noise-proto.mjs:676`), both lanes feed
  **pixels** (V2's ÷10 dropped; its grid index byte-identical
  0.049162514·px), the C39 ramp placeholder converts grid→world-px
  (keeps C80's calibration instead of C80's degenerate clamped-flat);
  tests **261/261**. C79 A/B, clean same-day (pre-patch run
  bit-identical to (114)'s baseline): meanAbs **89.58 → 89.42**
  (n 7065 → 7027, bias 2.88 → 3.11) — **FAIL stands; the frame fix
  moves the metric ~nothing.** desert/winter/hills **bit-identical**,
  mountain 47.18 → 46.36, bty10 44.85 → 36.62, lake topAir → 1.
  Mechanism probed (side-by-side pre/post lib masks): the caves-field
  band now samples the field's TOP rows (v ∈ [0.25,25.3] at bty14 =
  26 rows, +25.17/bty — C96), the ramp biomes got their calibrated
  frame. ⇒ the residual is SHAPE (§8 row 34 sharpened) and ③'s
  instrument is now the binding next dig.**]** **③ instrument gap.**
  The shape gate (`2026-09-21-surface-shape.mjs`) probes only wang/
  template bands (this session: `/tmp/opencode/probe-v2window-114.mjs`
  = **procedural 0, v2masks 0** in tx29..47 × ty11..19) and the V2 lane
  is OPT-IN (`SURFACE_V2`), refused by the IoU gate (C79) ⇒ nothing
  currently measures this lane's rendered shape. **[③ CLOSED dig #118
  (entry (118), C97):** `2026-10-10-surface-shape-iou.mjs` measures the
  full 512×512 solid mask under ANY lane combo (C79-inverted gate;
  neither-flag and PROC_FILL refused) on C79's exact 56-tile set
  (cross-checked match, 0 missing / 0 extra). Three-lane baseline —
  overall iou **v2 0.23391 / v2v3 0.25183 / v3 0.24644**, iouShift
  gains ≤ +0.008 (dyOpt median 0) ⇒ **lane choice and vertical
  registration are NOT the shape residual** (§8 row 38); fG
  0.141–0.167 vs **fR 0.480** ⇒ under-solidity; family gradient
  mountain 0.59 (best tile **0.92078**) ≫ lake 0.43 > hills 0.09–0.14
  > desert 0.017–0.074 ≈ winter 0.056 — winter lane-invariant because
  noiseKind −1 → `noiseDispatch` default-arm throw → chunk falls
  through (§8 row 30, `noise-proto.mjs:530`). Residual named:
  field/classify CONTENT = the fnB band-stack read (**I25**).
  *(Meter-regime note (128): the fG-vs-fR gap readings here were
  pre-regime E2/E3 sentinel readings, and the "OPEN dyOpt −12 =
  L3-anchor-y observation (I21-adjacent)" chase is SUPERSEDED —
  (127)'s differential moved dyOpt med to −204/−216 and attributed
  the surface divergence presence-type (I31); the register's
  byte-cited fnB band-stack rows stand on the C-rows alone.)*
  ① (density re-census) and ②'s residuals stay as recorded above.
  Source: ABOUT_MATH §6 (118).]**

- [ ] **I24. RandomColor consumer — residual OPEN after the reachability
  chain closed** (opened 2026-10-06, dig #115). Landed by (115): the full
  chain `ProceduralTerrain::Init` `0x905fb0` → stack wrapper → dispatch
  `0x8cef30` (queue arm) → deferred `0x8cf1f0` → slot2 `0xa99ea0`
  (`mov 0x4(%ecx),%ecx; jmp 0x904c20`) → consumer `0x904c20`, plus the record
  layout, the `wang_template_filename.empty()` guard (line 1808), the
  A/`[A+0x1f4]` gate, the pick-sign correction, the seed + warm-up closed
  form, the flood-fill asserts, and the `+0xb0` census (§8 row 35; C94).
  Residual — none block the P1 read:
  ① **RTTI class name UNPROVEN** — `.?AVIngestionComponent@@` (`0x12f9f78`)
  sits 8 bytes after the pTD stored in the COL record (`0x11eb884` →
  `0x12f9f68`), no rdata dword equals `0x1199d40` or pVFTable `0x12f9f70`,
  same pTD-shape mismatch as the resolved packs (`0x11e1f94`/`0x11e1f8c`)
  ⇒ **do not name the wrapper class**.
  ② **What is A?** `this+0` → A, then `[A+0x1f4]` → `[x+4]==0` gate
  (`0x905b50..0x905b72`); `0x1f4` unverified and A is read, not stored ⇒ an
  out-parameter (probably `world_state`-class) — identify before citing the
  map walk as biome evidence.
  ③ **Second record string** `this+0x1c` (24 B) identity — nothing proves it
  is not the biomenames file.
  ④ **Sync-arm wrapper kind.** Queue arm reads only
  node+0x10 → wrapper+0/+4 (both kinds safe); **sync** arm reads
  `wrapper+0x10` = `&self`, present only on the stack wrapper (heap clone =
  0xc B). Ctor sets `mgr+0x24/25` ⇒ `0x25==0` ⇒ Init takes the queue arm, but
  the `[mgr+0x25]` setter and `0x92b300` attach semantics are unidentified
  ⇒ which callers run sync is OPEN (needs the **`0x8cef30` dispatch's own
  call-site frames** — which callers pass which wrapper kind; NOT the
  `0x90a860` frame, which dig #116 settled for I23② and is unrelated).
  ⑤ What `0x8ee1b0` (CellFactory color→idx thunk) does at `this+0x140`
  (`0x905acd`), and what the 80 register-form `mov %reg,0xb0(%reg)` stores
  install (statically unresolvable).
  Source: ABOUT_MATH §6 (115).

- [x] **I25. BitmapCaves grid indexing — u-law vs cell index** — CLOSED: placement dig #119, RESOLVED dig #121 (512/256 mod-wrap read). §6 entries (119)(120)(121).
- [x] **I26. Walk/record writer-model reconciliation** — CLOSED dig #122 (record lane = no-op on the ctor-empty template). §6 entries (120)(121)(122).
- [ ] **I27. The caves-grid object join + the tile→field mapping
  (opened 2026-10-10, dig #121).** Dig #121 closed I25's index question
  (the sampler reads idx = W·y + x, the writer 0x8EE750 the same —
  entry (121), C100) and fixed the port (the direct cell read ⇒ C97 v3
  0.24708 → 0.46464), but two joins in the chain remain INFERENTIAL:
  (i) **object identity** — the literal buffer wiring fnB-built ↔ the
  sampler's `owner+0xb4` slot was not byte-traced: the fnB-region
  factory installs `[obj+0xb0] = 0x8ee1b0` + a smart-ptr at
  `[obj+0xb4]` (`*0x24` virtual result) on a **0xb8-byte** alloc (ctor
  `0x8f9470`) @0x8ee379..0x8ee427, yet the sampler's owner carries
  slots out to `[+0x2a4]` ⇒ a different, bigger object; no `+0x9c`
  (stride) or `+0xb4` (accessor) INIT site exists in 0x79xxxx–0x90xxxx
  (0x795b45's `+0x9c` is vector `end−begin>>5` math). Standing today on
  dig 83's consumer chain + dig #121's reader/writer law closure + the
  measured IoU jump (reading the v5 field cell-wise is what doubled the
  shape IoU — strong empirical support, not a byte proof).
  (ii) **tile→field mapping** — the port mod-wraps world px (mod
  512/256 = the tile-repeat assumption); the game's sampler gets its
  window from its caller (`[sampler+0xc]/[+0x8]/[+0x10]` bounds, the
  origin ptrs `[+0x24]/[+0x28]` added ONLY for the P-eval @0x90dbed)
  ⇒ which field row a chunk at an arbitrary biome y reads in a
  multi-tile region is unread (single-tile chunks: identical). Resolve
  needs: (a) the config/biome grid-slot init (who stores the built
  buffer into `+0x9c`/`+0xb4`), (b) the sampler's caller frame (the
  window passed per biome row). Expected impact: LOW for the current
  render (the wrap only diverges for multi-tile rows; the IoU jump
  already validates the read) — but it is the last inferential join in
  the caves chain. Sources: entry (121), C100, VERIFIED §8 row 41.

- [x] **I28. Record-stamp template fill engine** — CLOSED dig #123: the record lane writes nothing. §6 entries (122)(123). (The dig-#162 image-decode overturn is carried by the byte-plane lineage I38/I39/I42.)
- [ ] **I29. Canon-source audit — the false-statement sweep (opened
  2026-10-12, scoped 2026-10-12; STAGE 1 EXECUTED dig #124 2026-10-12 —
  see the dig entry; stages 2–3 remain).** User mandate: mistakes or false
  statements may lie in the verified self-documentation and propagate
  into the port. **Scope: EVERYTHING EXCEPT VERIFIED §8** (the
  elimination table is settled by definition — do-not-re-test; its only
  standing obligation = eliminated port models stay marked LEGACY in
  code, which they are). Concretely: the 98 C-rows (with their ~532
  pinned const/VA tokens across the whole canon), VERIFIED
  §1–§7 + §9–§12 (~1133 lines), and the registry cross-links. The audit
  risk is concrete: **19/98 C-rows cite orphaned /tmp dumps** (evidence
  that no longer exists) and only 1 manifest-resolvable citation row
  exists so far. Staged plan:
  - **Stage 1 — machine auditability sweep (rides dig #124, cheap):**
    classify every C-row's const/VA cite + every /tmp cite as
    MANIFEST-RESOLVABLE / /tmp-ORPHANED / ABSENT; also link-check the
    canon prose (§9–§11 refs + Current_work routing). Output = the
    audit table into the digs entry + A-register rows for unreachable
    sources. Plus: build the CONST-VERIFIER — parse each registered
    const from the manifest dumps, decode (f32/f64 per its registered
    width), compare with the pinned value; per-C-row verdict.
  - **Stage 2 — load-bearing re-derivation (interleaved digs):** re-
    derive from FRESH manifest extractions the claims that FEED the
    gates/port first — C13 (rng semantics), C46/C51/C102 (the lanes'
    laws — C51/C102 are already fresh), C57 (VA shift), the C48-oracle
    chain (the y224 bar's source); any overturn lands as the standard
    in-place correction pair.
  - **Stage 3 — full canon sweep:** remaining C-rows + canon sections
    ~10 rows per dig until every audited claim is re-derived, or
    explicitly tagged CE/capture-anchored (those cannot be re-verified
    from the binary alone — they need a game-lab re-run, ~1–2 sessions).
  Expected impact: HIGH — resolvability is the foundation of the claim
  contract; a canon row whose evidence no longer exists is ITSELF a
  defect. Sources: method commits 7b854a2..810cf1 (2026-10-12); the
  catch of the vacated row 29; the charter (AGENTS.md).

- [x] **I33. Kind-0 filler r-site swap made NOISE/DEAD read AIR** — CLOSED dig #145: band ramp now read at world px (the #142 regression fixed, not reverted); kind=-1 arm unreachable (byte kind map). §6 entry (145).
- [x] **I34. Composed-terrain content defects (repetition + desert palette)** — CLOSED dig #144: lane attribution measured; defect A (per-chunk shape re-anchor) resolved; defect B (desert wears plains palette) decoded to the XML limit_y flag split. §6 (144)(145).
- [x] **I30. Walk per-value carve EXIT-law missing** — CLOSED dig #127: exit-at-loop-top + band-1 base-v ported into `caves-field.mjs`, count-tested. §6 (126)(127).
- [ ] **I32. The ART-FIRST surface-band compositor (opened dig #129; p1 LANDED dig #130)**: the surface render's shape was the caves field painted over the whole band with a 2-shade flat slab — no art, no material bands. **p1 (dig #130) LANDED:** the per-cell `<Materials>` classify (0x8f5030, C76 frame) → materials.xml wang_color paint wired through noiseChunkMask/noiseMatAt/noiseColor (the hills band: 857 distinct material colors vs the 2-shade slab; count-test pin in tests/mapgen/surface-compositor.test.mjs). **p2a LANDED dig #131 (C108):** the READ-WINDOW law — the caves field reads the WORLD frame with the getter's bounds check; the sky band bty1..13 reads OOB rows ⇒ AIR (the "terrain fills the sky" defect = the old wrapper's constant-row reads, gy%256). The ty62 mines-band chunk value-unchanged (2409 = the pin). **p2d LANDED dig #134 (C111):** the filler-vs-biome distinction decoded — the filler ("meaningless chunks") = the kind-0 noise chain (empty.xml = NO BitmapCaves) = the I21/A4 dig = the SHAPE ROOT (the next dig priority); the bin-air backdrop (the pyramid bg, the mines' air, the HM walls = per-biome); the wang-biome art-crust blit (the pyramid pieces over the corridors). **p2c LANDED dig #133 (C110):** the SKY/Hell layer law — ONE sky backdrop (the parallax gradient + stars) for every world row above the datum to the Heaven end (the bins never paint the sky band; the art pieces ride the template lane over it); the per-biome bgs = the underground only; hell = the_end's own art (the hell band's template-lane air = tagged OPEN). **p2b LANDED dig #132 (C109):** the per-area background law — the air backdrop = the chunk biome's Topology background_image tiled per chunk (hills = cave_04_alt; coalmine = its own; the_sky = transparent). The game's true parallax/multi-layer = OPEN (tagged). **DEFAULT-LANE ATTACH DEFECT (user report 2026-10-15 "no more sky background"; FIXED same session):** `skyAt`/`bgImageAt` were attached BELOW the `SURFACE_V2||SURFACE_V3` gate in `attachNoiseTerrain`, so the default `npm run gen:server` (no flags) returned `null` for every sky/void/bin-less px → the tile renderer's opaque black — measured on seed 78633191, 512×512 px tiles: z0(34,14) and z1(17,28)/(17,29) = 100% black, z1(17,30) = 82.0% black (the user's own server PID 290328, :8082, no `SURFACE_*` in its env); the battery stayed green because the render suites set the flags at load (`surface-compositor.test.mjs:13`). Attach now unconditional (C110 is written unconditionally; the data-image backdrop reads the game's own art PNG — since 2026-10-19 the star sprite only, the NIGHT law = zero D); the NOISE band stays gated per §12 — the filler/surface band still requires `SURFACE_V2=1 SURFACE_V3=1` (flags-on HEAD renders all three tiles at 0.0% black, dig #142 intact). Repro/test: the default-lane attach contract in `tests/mapgen/world-gen.test.mjs`. **GOLD-HORIZON DEFECT (user report 2026-10-19 "flat gold … one brown chunk"; FIXED same session — the NIGHT law):** the p2c law's parallax-row sample (`skyAt`: t = gy/31744 → `parallax_background.png`'s bottom row = the warm horizon (254,206,108)) painted the whole bin-less sky band GOLD — measured (M-grade, the E1 color census `mapgen/out/surface-color-census-2026-10-19-*.json`, the C97 56-tile set, repro in the instrument header): sky band (bty ≤ 13) gen warm share **0.892** vs ref **0.001**, gen air **0.004** vs ref **0.692**; winter tiles = gen 3 distinct colors vs ref 38–328 (the flat-color class the C97 mask cannot see — gold masks as "solid", so it even INFLATED sky-tile IoU against ref's terrain mass). The capture's sky = opaque black + stars at EVERY altitude (ref/35_10, 35_13, 30_13 = 100% alpha-255, alpha-0 = 0.0%; the old `t < 0.75` star gate excluded the whole scorable band, t ≥ 0.87 ⇒ zero stars at the horizon). Fix: `skyAt` = null (air) + hash-placed star sprite px at every altitude; the parallax png = the game's DAYTIME layer, dropped from the render (WHY the capture = night — time-of-day vs the layer-excluded world render — = OPEN, untagged; either way the capture = the product target). The gradient law itself came from dig #133 (C110, amended); fb6d28b's 2026-10-15 attach fix only made it reachable in the default lane. Fail-under-old-law pins: the horizon/high `toBeNull` + the horizon star count in `tests/mapgen/world-gen.test.mjs` ("default lane sky color"; old law returned gold/blue there and 0 stars below t=0.75), and the null + warm-share < 0.05 pins in `tests/mapgen/surface-compositor.test.mjs` ("the NIGHT sky law"; old law = gold ≈ 0.98 on those rows). **What remains follows.** **REMAINING p2/p3:** (a) the LoadPixelScene ART-CRUST placement (X63's spliced/xml table — the actual art pieces over the crust), (b) the shape's byte-side carve-architecture (I31/I29-stage-2/I21) — the compositor colors the shape the field had; the under-carve is a separate verified-open lane, not this dig's scope. **dig #135 add: the record-lane IMAGE-STAMP law landed (C112, §8 row 46) — the C48 y=0 bump's writer family (the record-lane image stamps via the fn950→fn870 blend, the whole-binary census); the grouped-class stamp port + the X/Y anchors = dig #136 (the caves-lane byte read inside I31's carves front).** Sources: ABOUT_MATH §6 (130), X63, C106, I31.
- [ ] **I31. The caves-field PRESENCE divergence — the port under-carves byte-side and the 12-sample oracle-row meter can't arbitrate alone (opened dig #127; sharpened the same session by the meter-reliability differential).** **THE RUN SHEET (registered dig #158, C133 — CORRECTED dig #159 to the v2 recipe; the v1 pattern = the wrong-struct conflation, struck):** seed 78633191 post-generation; CE wildcard byte-pattern search **`00 00 20 45 ?? ?? ?? ?? 00 02 00 00`** (f32 2560.0 @P+0x94 — the C48 grid-owner marker, bit-exact per the C48 oracle json; + 4 free bytes ([P+0x98]); + the stride int W = 512 @P+0x9c, LE `00 02 00 00`); ONE dump per hit, starting **AT the hit** (= P+0x94), size **0x80020** (the 8-B validation window + the 512×256 f32 grid INLINE at owner+0xb4, idx = `[0x9c]`=W·y+x, the sampler gate > 0.51); every retained hit (the per-def family; the 1×1 grids self-exclude via their 5.0 marker); ingest via `mapgen/experiments/2026-10-17-dig158-ce-caves-ingest.mjs` (self-validating; `tests/dig158-ingest.test.mjs` 5/5) → `mapgen/out/dig158-ce-ingest.json` → **the #160 compare dig = the per-def match vs the port's own `ensureCavesField` grids, with the pre-registered PREDICTION + FALSIFIERS in C133**. Origin (entry (127)): the C48 caves-grid oracle rows moved the "wrong" way across the I30 exit-law port (rms worsened on y48/y64/y96/y128) while the C97 IoU rose. The differential instrument (`mapgen/experiments/2026-10-13-i31-oracle-meter-reliability.mjs`; pre-patch field = `git show HEAD~1:mapgen/lib/caves-field.mjs` imported as a sibling module; seed 78633191 hills) separated three meter classes: (1) **presence** — carved-cell COUNT per sampled row: ref 49 / pre-law 26 / **post-law 0** (Σ over the 12-sample rows y16..y192); (2) **displacement** — best-shifted rms in the (dx ±6, dy ±8) window does NOT recover post-patch (best-rms ≈ the plain rms on most rows; e.g. y96 0.2721 pre vs 0.6489 post, y128 0.2432 pre vs 0.5723 post) ⇒ the divergence is NOT registration; (3) the plain rms (the entry (127) numbers). **Verdicts: (a) the entry (127) reading "the pre-patch port was closer on the sampled slice" is SUPERSEDED — the pre-law over-carving was accidentally compensating; the presence gap was neither created nor hidden by the exit law, it was only exposed by it.** (b) The gap is PRESENCE-TYPE and global: post-law the port touches 18877/131072 = **14.40%** of the 512×256 grid (solid share >0.5 = 0.9007), while the byte truth carves **58%** (49/84) of its sampled edge cells (x0..11, rows y16..y192) and the whole x<12 edge band holds **9 carved cells over all 256 rows** — the downstream carve composition under-carves massively byte-side. (c) Meter classification: both the C48 rows and the C97 fG (0.78289 vs fR 0.48029, this dig) are consistent sentinels of that ONE structural gap; as differential VERDICTS they are unreliable (12-cell slice; no registration semantics; and partial-model steps can move them either way — the user's point, upheld). The exit-law commit's correctness rests on the BYTE anchors (the triple-verified comiss mapping, the count laws, the census matching the law's own predicted bimodality med 1 vs 32 / murmur 120/150), not on any meter. **Arbitration = a byte-side FULL-GRID caves dump** (the C48 artifact was a one-shot CE memory read; a full 512×256 capture = a game-lab re-run) — until then the y224 byte bar + this row is the state; a full dump would split the under-carve across the walk vs blob/L2/L3 lanes. Resolution path: land I29 stage 2's remaining volatile rows → I21 (drains A4) with the counters instrumented, and/or build the full-grid dump instrument; then close this row. Sources: ABOUT_MATH §6 (127) + its (127) AMEND, the differential instrument, C48, C97. **[THE DIG-#160 ARBITRATION (2026-10-17): RESOLVED — the field layer is CORRECT. The carve audit (`mapgen/out/dig160-carve-audit.json`: the capture 46.86/65.19/37.32% solid per _EMPTY_/desert/winter vs the port's fields 90.07/98.57/89.9%) + the C48's own recorded rows (y16–y48 mostly 1.0–1.4 solid/raised) prove **the byte's field ≈ 90% solid ≈ the port's** — the "byte carves 58%" figure = the EDGE-BAND sample only (x0..11), never the full grid. THE DIVERGENCE = the RENDER's air = the POST-FIELD MATERIAL-ASSIGNMENT LAYER (the record fetch 0x4B80E0 → the kind dispatch 0x90DD8D → the LIFO pop 0x8FF050 on the global stack 0x13276C4 (the empty → air) / the map lookup 0xA047D0 (the miss → air) / other → air → the planter 0x7644D0) — the (134) residuals, now read (C134, X124); the port paints 100% (no layer). **[the dig-#161 structure: the store 0x13276C4 = the atomic slot counter + the vector of the 8192-slot record arrays (each slot = a zeroed 64-B record; the ctor 0x8FEFF0; the push body 0x8FF2CE; the two-vector cap 96 arrays); the kind-1 arm consumes the slots SEQUENTIALLY; the AIR = the UNFILLED (zeroed) record slots; the kind-3 = the map lookup instead (the planter's assert rejects kind==3) — the port's last input = the record-FILL pass (who writes the 64-B records), C135/X125]** THE FIX = #161's port of the assignment layer, the count test = the capture's solid shares (37/65/47%). The "GAME-LAB-GATED" status = RETIRED — the capture-side arbitration sufficed; the CE full-grid dump = the optional bit-level verification (the scripts archived: dig158-ce-caves-dump.lua v2 + the ingest v2); the CE arc = CLOSED (the value-scan approach = dead: the 2560.0-floats = 3091 hits = the consts/pool junk/the coincidental data — the locator for any future dump = the static chain 0x1344B90 → the virtual +0xAC → 0x9C6800's buffer).]**

- [~] **I35's partial update (#147):** the polygon arm is ported (0x10096a0 bytes now read, even-odd scan + standard ray-cast indent) and runs through `pointInPolygon`. temple_wall (31,67): 0 → 398/2704 (solids) on seed 500412504. The remaining verification: the game's oracle output for one boss_arena mapcap chunk hasn't been captured (no E0 reference yet, so we can't yet lock the inside verdict). The exact vertex-on-ray edge-gate walks remain empirically un-exercised (corner cases untested — FUTURE). **I35 still [~].**
- [~] **I37's IL re-pin (dig #152):** the kind split (`mapgen/out/dig152-kind-split.json`,
  committed): **43/56 tiles = the caves-kind land (mean raw IoU 0.4548, 18 all-solid)**
  vs 13 noise-kind (mean 0.4941, 2 all-solid) — the shape residual's weight = the
  caves-kind land ⇒ I31 (the under-carve) = the byte home, re-affirmed at the
  tile level; the noise-kind's own 2 all-solid tiles = the deep-band eased-r′ ≥
  gradW·per ≥ 0 + eased 1 ⇒ v ≥ 1.057 × the wide [−100,100) window ⇒ solid
  always (the same shape the (150) band measured) — registered as the NOISE-kind
  residual sub-item, queued behind I31. **I37 still [~].**
- [~] **I37's noise-sub-item re-scope (dig #154):** the noise-kind's own residual
  shape = (i) the deep-band v ≥ 1.057 ⇒ the wide window = solid always; (ii) the
  LAKE's data map byte-read (C129: the mode-3 SLOPE arm StartX −12000/Δ −0.37,
  the mInsideAddValue 5.0 addend, the 0.009999 lattice scale, mMultiplierPerlin
  1) ⇒ the byte's lake deep-band v ∈ ~[4.9, 8] = all-solid TOO ⇒ the (150)
  lake-family's 4 under-solid tiles (the port's fG 0.03..19 vs fR 0.55–0.58) =
  **the port's `uidFrom` population missing the lake's own data map** (the
  mode-3 arm + the addend + the scale) — **dig #155 = the read target** (the
  port's uid field map vs the byte's slot law). The (149)-era 0x1150f04-as-type
  mislabel = retracted on disk (the .rdata = the `%d`/`%u` fmt strings; the
  C119 `type` arm = the region class' own law, standing). **I37 still [~].**
- [~] **I37's noise-side VERDICT (dig #155 — the (154) read target executed and
  CLOSED VACUOUS as a mover):** the uid-pipe read landed BOTH ways: (a) the
  port's census defect was REAL and is FIXED — `biomes.mjs` dropped the whole
  non-Perlin mInside* family; the parse now carries `mInsideAddValue` (live: 4
  files = exactly the lake family, all "5.0"), `mInsideNoiseFBM`+`mInsideNoiseType`
  (live: 6 files = the mountain/pyramid family, "1"/"SimplexNoise1234" ⇒ kind 8),
  `mInsideOffsetBySeed` (0 files) — count-tested 2/2 FAIL pre-fix → 2/2 PASS
  (`tests/mapgen/lake-pipe.test.mjs`); (b) the fix is RENDER-INERT on the lake
  band — the A/B (`mapgen/out/dig155-lake-pipe-ab.json`, seed 78633191):
  uid.addValue 0→5 on all four lake tiles with FIELD distributions BIT-IDENTICAL
  (solids 7/0/428/1239, fG 0.00259/0/0.15828/0.45821) because the byte's
  `[uid+0x260]` read sits INSIDE the r′>0.85 arm (X116/X117 fresh) and the lake's
  mode-3 slope caps its own r′ ∈ [0.36, 0.61] ⇒ the addend never engages on any
  shipped lake cell ⇒ **C129's "lake deep band v ∈ [4.9, 8] = all-solid"
  = RETRACTED (§8 row 52)** — the byte's lake v = gradW·per + 0.871·r^post ∈
  ~[0, 1.4] == the port's family. (c) the noise-kind closures are therefore
  COMPLETE on the byte side: the 2 all-solid NOISE tiles = the mode-1
  empty-def band (r′ = 1, the byte-matching law ✓ per (152)) and the lake
  family's (150) under-solidity = the capture-vs-compose gap (I34's
  already-registered air-bg/template lanes), NOT a noise-lane defect — NO
  further noise-lane dig exists for the lake family; I37's remaining content =
  the deep-band over-solidity sentence stands AS RE-AIMED at I31 by (151) /
  re-affirmed by (152) — **I37 still [~] (its caves-kind half = I31's gate).**
- [~] **I31's state receipt (dig #153):** the walk-chain byte model = CLOSED
  (C128's fresh start-span laws + the C105/C99/C101 stack — the port is
  byte-equal, no change); the I31 presence divergence is **GAME-LAB-GATED** —
  its arbiter = the full-grid caves dump (the 512×256 CE capture, user-side,
  the (127) row's own note); the dig-152 kind split's caves-kind loss (18
  all-solid deep tiles) lives behind that gate. **I31 still [ ].**

- [~] **I35's correction (#148):** the #147 framing above was built on PHANTOM data. The component census (`mapgen/experiments/2026-10-16-dig148-xml-comp-census.mjs`: 128 files, **647 raw → 640 active**: boss_arena 2→0, end_wall 2→0, temple_wall 2→0, wandcave 4→3) shows the four "polygon chunks" ship **all but one of their polygon comps commented out** — the game's XML loader (a real parser) sees an EMPTY Materials list for temple_wall/boss_arena/end_wall, so the #147 raw-text regex built phantom tables whose rock_hard_border diamonds painted **155 matIdx cells on temple_wall (31,67, seed 500412504)** that the game never paints (A/B probe: committed #147 vs #148 — solids 398 → 398, i.e. the mask was classify-INDEPENDENT field content all along; matHits rock_hard_border 155 → **0**). The "0 → 398" delta of the (147) entry was the THROW removal (an un-parseable phantom comp asserting), not polygon painting. ensureSurfaceTable now comment-strips (self-closing `<MaterialComponent/>` fail-loud: zero shipped, swept). The ONLY active polygon comp = lava_90percent's band (exercised: lavalake (41,66) rock_hard_border ×50, solid_wall (1,70) ×686 — unchanged through the fix). The remaining verification = the same oracle as before, now scoped to lava_90percent and REGISTERED as A8 (the (147) "Flagged OPEN: A8" never landed a §A row). **I35 still [~].**

- [~] **I35. The kind-0 polygon chunks (boss_arena / end_wall /
  lava_90percent / temple_wall) become noiseChunkMask-unreachable via
  the un-ported `is_polygon=1` arm (surface-level.mjs:317-322) once the
  field≡1 fix unmasks entries that were ALL-AIR pre-fix.** HEAVY on seed
  500412504: temple_wall 34 chunks (31,67) go 0/2704 → NULL (dig #146).
  The arm correctly throws (fail-loud, forbidden-D law respected); the
  *lane* previously let it propagate up through noiseChunkMask and crashed
  (or returned null inconsistently) — dig #146 extends the per-cell
  try/catch in both the V2 and V3 lanes so the whole chunk falls through
  honestly (`return null`) on the polygon arm, mirroring the field-build
  unread-arm. The INSTRUMENT `noodle-throw.mjs` needs the kind-0 arm to
  reach it (it now does) — the instrument survives (signature change
  compatible via DEF_SEED). The polygon arm ITSELF stays aspirational =
  a 0x10096a0 point-in-polygon read is still debt (A8-candidate):
  `noodle-throw.mjs` is I35's instrument; filling it = a separate rig-up
  lands the proper vertex-recovery read. Sources: entry (146), C122, §8
  row 50; `mapgen/experiments/2026-10-15-noodle-throw.mjs`; surface-level.mjs.

- [x] **I36. Full-battery gate truncates silently under the IPC watchdog** — CLOSED dig #156: gate parses the vitest summary + pins `scripts/precommit-baseline.json` (refuses T≠baseline / M≠skipped), retry-once on the stall class. §6 entry (148)(156). (Recurrence → I37/I38 correction at #168.) **Root-cause removed dig #210 (2026-10-26): the trigger = `tests/mapgen/surface-compositor.test.mjs`'s NIGHT-sky stars loop — 3.28M sync `worldColorAt` calls ≈ 62–70 s unbroken (measured 62.4/63.6/69.7 s across this session's runs), long enough that a pending `onTaskUpdate` reply cannot drain and the 60 s birpc watchdog fires (the `Timeout calling "onTaskUpdate"` class — 3 consecutive full-battery crashes at 9/32 files on the I49 fix's runs); the loop now yields a macrotask every 100k calls (sampling, counts and every assertion unchanged).**
- [~] **I36's CORRECTION (dig #168, 2026-10-18): the class RECURRED — the ONE-retry (form b) was never the cure; the ROOT CAUSES are now NAMED and structurally fixed.** Reproduction (this session): three consecutive full `npm test` runs aborted at the SAME point — `Test Files 8 passed | 1 skipped (10)` / `Tests 215 passed | 3 skipped (221)` / `Errors 2` = 2 × `Timeout calling "onTaskUpdate"` / exit 1 — and surface-compositor SOLO died 2/2 (3 passed | 6); `git stash`-ing the dig's changes reproduced it identically ⇒ the class, not dig-#168 code; MemAvailable 13 Gi + swap 0 B used + 919 G disk free at diagnosis ⇒ NOT the #148 swap-pressure form either. THE MECHANISM (M): vitest 2.1.9 birpc `DEFAULT_TIMEOUT = 6e4` (`node_modules/vitest/dist/chunks/index.68735LiX.js`) — a worker with an unprocessed task-update reply dies when ONE contiguous sync span crosses 60 s (the due timer fires before the queued reply is drained). THE SPANS (M): `renderTemplateWorld` = 48783 ms cold (`mapgen/experiments/2026-10-18-splice-chunk-equiv.mjs`) and `ensureWorld()`'s CALL = that render PLUS the eager `readFileSync` gen-cache load per area (`world-gen.mjs:277` + the `readCache` inside the `world.ready` map) — plz-codec's count law rendered the WHOLE world for one chunk, and surface-compositor rendered it per test (art-crust a second time immediately after its own `ensureWorld`). FIXES LANDED (assertions byte-preserved, in dig #168's commit): the count law → `blitSplicedScenes` scoped (full-vs-splice `byteEqual = true`, 48783 ms → 1825 ms); art-crust → reads `world.templates` (byte-identical by construction: same fn/args as `world-gen.mjs:277`) + one shared `getWorld()` for the three world tests (solo 174 s → 71 s, 6/6, zero rpc errors). POST-FIX LIVE BATTERY: 27 files / 371 tests / 3 skipped / exit 0 / zero rpc errors; `scripts/precommit-baseline.json` → {filesTotal 27, testsTotal 371, testsSkipped 3}. Sources: entry (168); `tests/mapgen/plz-codec.test.mjs`; `tests/mapgen/surface-compositor.test.mjs`; `mapgen/experiments/2026-10-18-splice-chunk-equiv.mjs` | **

- [ ] **I38. THE BYTE-PLANE ROLE TENSION: the sampler's byte gate (C136: byte == 0 ⇒ air) vs the sole writer's sparse write law — the scatter writes ONE cell per fire (0x8EEAD0 → 0x8FAFC0, the dig-#56 body law) with the fire rate ≈ E[value] ≈ 1/2 per walk point (the dig-#167 selector decode), i.e. ~10^3 byte cells per 512×256 def-grid ≈ ~1% coverage — three orders short of the dense mask C136's gate would require to yield the 37–65% capture solid shares.** The call-0x8FAFC0 census = ONE site in the whole text region (dig #165) ⇒ no unread dense writer exists behind the same recorder ⇒ the tension resolves toward "the byte plane's sampler role ≠ the terrain-solid mask" (the C136 gate re-read owed) rather than "a missing writer". Wire-up decision DEFERRED until the #168 lane port's byte-coverage census produces the live-biome density number (the E1 count test). **Amended dig #178 — that E1 census is now RUN and the queued item is CONSUMED:** the #168 lane's live-biome density is **MEASURED = 3,076 / 131,072 = 2.35% nonzero** on the hills def (M-grade, artifact `mapgen/out/field-vs-origin.json`, repro `node mapgen/experiments/2026-10-21-field-vs-origin.mjs`) — consistent with the "~1%" estimate and still three orders short of a dense mask. Second fact (verified this session by grep, not inferred): the port's byte reader `byteAt` (`mapgen/lib/noise-terrain.mjs:496`) is **declared and assigned but has no call site anywhere** (`grep -rn "byteAt(" mapgen/ tests/` = 0 hits), and the live V3 mask path begins at the field gate — the gate is unwired at BOTH ends in our port. Consequence for the lever ranking (entry (178), §9): wiring it today would mark **97.65% of the band AIR**. The GAME-side density stays OPEN — 2.35% measures our A9 stand-in's stamps, not the game's image-decoded plane — so the wire-up deferral STANDS. Sources: entry (167); entry (178); C136; C142; I31; A9 |
- [ ] **I37. THE DEEP-BAND OVER-SOLIDITY: the port paints fG ≈ 1.0 exactly in the deep noise bands (bty10–13: 36/56 tiles at fG 0.91–1.0-exact vs fR 0.32–0.44) — [dig-#151 CORRECTION: the mover is the CAVES-KIND land, NOT insidePerlin] (opened dig #150).** The fresh v3 triage (SURFACE_V3=1, the dig-#118 instrument at HEAD post-#148, `mapgen/out/surface-shape-2026-10-10-v3.json` md5 `6025b179e88a1bc884891faac0d4ad48`): overall raw IoU 0.46243 (iouShift 0.64752); **fG = 1.0 EXACTLY on 6 tiles**. **[The (150)-era diagnosis NULLIFIED by (151)'s reads (X114):** the seed-draw slot [+0x24d] = **DORMANT on shipped data** (ctor clears bytes 0x24c+24d @0x496118; **0 XMLs bind the attr** — swept; `0x9119d0` = a pure worldseed GETTER, zero RNG draw) — the port's C27 stand-in never runs — the "draw-values D = the mover" retraction; ALSO the deep-band tiles are largely the **CAVES-KIND land** (the direct gradAt cell read, C100's law), not the mGradient noise chain — the combine's `·per` erratum and the ctor-base 0.0 fix = C125's in-row erratum.] **The re-aimed read = I31's caves under-carve** (the presence divergence, (127): the port carves 14.4% of the caves grid vs the byte side ~58%) — the deep-band all-solid = the caves-lane chunk masks near-solid ⇒ I31 = the byte home of the biggest shape loss. **Fix = the I31 walk-chain read (the byte walk's draw-trace + presence law), NOT an insidePerlin port.** After I31's lane closes, re-run this triage — PREDICTION (registered): fG drops toward ~0.85 first (the bty10–13 family), iou +≥ +0.10; FALSIFIER: fG unchanged ⇒ the residual is the noise-kind band-window data (the empty.xml-style defs), the next read. Meter classes: the triage = E2 (sentinels); the fG=1.0-exact floor + the per-band fR/fG counts = E1 (count laws). Sources: entries (150)+(151); X112; X114; C125/C126; C100; the dig-#118 instrument.

- [ ] **I39. THE REVEALED SPLICE-FILL GAP — the floor under the splice scenes: our underlying fill (A5's seeded-fBm approximation) is too low/blocky where the art correctly defers to it, and the game's own floor-spawn under these sites = UNREAD (dig #168's reveal; the "how the floor spawns" entry the lake anchor opened).** With the paint-classification law ported (the air/miss skips, C143), the splice tiles now show OUR terrain where the game shows ITS terrain — and the deltas name the gap: the lavalake2 flank tiles 39/41/42_14 IoU −0.0285/−0.0273/−0.0236, 40_14 fG −0.27394 (the E2 sentinel deltas of the dig-#168 A/B; the shape truth = the anchor triptych `mapgen/out/lake-anchor-40_14.png`, M-graded). Sub-items: (a) **PARTIALLY RESOLVED dig #169 (the sampler read, C144): the game's floor under these sites = the RECORD LANE's stamps for the non-P biomes** (mountain_lake / lavalake2's hills / watercave's mountain_tree carry no `bitmap_noise_file` ⇒ the sampler's field+classify path is P-gated off at 0x90DBE5 and the records alone paint — the "always there, depends on the seed" floor), and the lake family DOES carry the image attr (`bitmap_noise_file` → `topology_lake.png`, 4 defs — the C122 "never a P build / DEAD for shipped data" universal corrected, §8 row 55). REMAINING: (a1) the record-lane WRITER — who stamps the records/byte plane at these sites (the producer the sampler's record path consumes) — **dig #173 advanced this: the consumer side is read (the stamp phase @0x793a71 in X149: the scene's `[0x9c]` records with material id at `[+0xd8]` = C144's sampler slot, the LCG probability gate, the y-limit `[+0xc8]`; the id-plane construction @0x7935f4) and the data-side fact proves the overwrite (one uniform art color → three capture families, C147(3)); the PRODUCER (who builds the `[0x9c]` list from the art) remains — = I42's open read (i)**; (a2) THE P-WIRE — whether/where the [+0xa8] path materializes into [uid+0x1d4] (0x9c8460 = a registry resolve; no image-loader call in the parse region) = #170, lake_statue (6,62) = the live site — **and now load-bearing for I42: the record palette's producer lives in the same parse region (the .plz is the verbatim art, C147(2) — the grey→record decode happens at parse time)**; (a3) ~~our floor gap at the anchor = the classify-window frame defect (the capture solid from y≈128 vs ours y≈288; the soil `limit_y` band [−1024, 424.229] excludes the canvas−24576 frame band ⇒ v ∈ [0.5, 0.53) = null record = air — fixed by the writer/frame read, NOT tuning)~~ **dig #170 CORRECTION: the anchor-gap attribution = REFUTED (§8 row 56) — closing the template-lane (−11,−12) read shift + the grey-fill skip takes fG 0.6608→0.9550 with NO classify change (the gap composition at origin = grey 14572 + water 4737 + black 2922, NO classify-window class; the residual ≈2951 air = the art-BLACK "below shows" cells = the record lane (a1)). The `limit_y` frame question itself (the classify call passes gy−24576 = the canvas frame) stays OPEN as a port/byte frame question, but it is NOT this gap's cause** — **RESOLVED dig #172 for the SPLICE lane (C146): the grey-fill driver's classify frame = the raw chunk frame (world px, δ=0 — the walk origin = `chunkX<<9`/`chunkY<<9`, X149: the gate-frame offset must be a multiple of 512, and the port's verbatim band matrix + the C97 surface-line identity pin δ=0) ⇒ closed for this lane; the SAMPLER lane's classify frame stays open (not the splice fill's writer)**; (b) our rock_hard template shades are wrong for these sites (ours (54,55,60)/(48,49,54)/(60,61,66) grey-blue vs the ref's reddish (55,34,29)/(98,59,50) — a per-site shade map or the real material law); (c) the waterline band + the scene-edge flanks (where the stencil ends the fill must transition seamlessly; the flank tiles = the visible seams); (d) ~~**the splice lane's grey-fill MATERIAL MIX (added dig #170, the A5 D-magnitude): the grey band-fill (fix B) paints the hosting biome's non-rare MaterialComponent bands via seeded-fBm — measured E1, mountain_lake chunk "40,62" seed 78633191, fill 104653 px: rock-family 103746 / sand 906 / soil 1 (the fbm2 mid-concentration [0,1) mapped onto the lake's non-rare window [0.45, 3.5] lands ~99% in rock_static's huge window) — while the CAPTURE at those cells is SOIL-DOMINANT (rows 160–400 ≈60–85% soil, copper rising 416–496). The SHAPE lands (fG 0.6608→0.9550; art-grey cells = capture-solid 104002/104002 = 100.000%), the MIX stays D. The field-driven band choice (needs the classify field at game-frame y = the (a3) frame question + C32/A5) is the queued read; NO tuning.**~~ **RESOLVED dig #172 (C146): the field-driven band choice was READ and PORTED — the game's per-MISS-cell driver (walk @0x7930d3 → the kind-0 driver: v = surfaceField(x+0.5, y+0.5) → classify(table, x, y, v), δ=0 frame) now drives the splice fill; the E1 A/B: the art-grey band rows 128–191 soil share 0.00001 → 1.0000 (capture 0.7039), the row-invariance gone (the top−bottom flip = 1.0), fill shades = the capture's exact families (dark sand (95,87,49) / soil (70,65,40) / rock (39,40,45)). RESIDUALS moved out: the deep-band soil at rows>424 = I42 (the post-walk stamp loop's writer); blitScene's 10 call sites keep the fBm = I43. The "copper rising 416–496" clause REFUTED on the art-grey cells (E1: no copper in any measured band share; copper = is_rare + y-gate [750,2048], cannot fire at the anchor — §8 row 58).** Sources: entry (168); entry (170); C143; C145; A5; I40 |
- [ ] **I40. SPLICE-SCENE STAND-INS FLAGGED (the dig-#168 honest-D set — none load-bearing for shape): (a) `blitFixedArt` paints raw colors with no classification (unmeasured vs capture — the blitFixedArt family may carry the same air/miss law as the splices; behavior kept, FLAGGED here); (b) the splice visual layers (`N_visual.png` / `N_visual.plz`) are NOT applied by blitSplicedScenes — only the material layer paints; (c) per-fragment content pins exist for mountain_lake/0.plz (262144/262144 vs the PNG) and lavalake2/4.plz (8/8) only — the other 95 files are length-exact (97/97 decode) without a content pin.** (a) and (b) = render-fidelity D; (c) = evidence-completeness D. Sources: entry (168); C143; I39 |
- [x] **I41. Template-lane 282-cell shortfall at the mountain_lake chunk edge** — RESOLVED dig #170 (C145): L3_ANCHOR template reads moved from the generator frame to the display frame (the seam is now structurally impossible). §6 entry (170).
- [ ] **I42. THE DEEP-BAND WRITER — the capture's soil/rock OVERWRITING the driver lane's sand (the mountain_lake anchor's rows 320–511): it can NOT come from the grey-fill driver-classify lane (C146's window law — sand_static's window `[0.53,0.95)` has NO y-gate, so the driver returns SAND there, v = 0.54165–0.63119 measured dig #173); **the named writer - the game's post-walk RECORD-STAMP phase (0x793a71 in X149) - = FALSIFIED dig #176 at byte level (C150): the stamp→drain→dispatch→arms chain byte-closes as the `<VegetationComponent>` lane at every site (the record class from its own attr applier, the stamp window's four read slots, the dispatch + all three arms; the chain's only material input = `[rec+0xd4]` tree_material_id ∈ {moss, grass} at the anchor from mountain_lake's 2 `is_visual` VegetationComponents) → the chain writes vegetation, NOT the deep band's soil/rock → the writer is UNIDENTIFIED → re-registered as I45.** (Digs #173/#174 stand for the mechanism decode + the data-side overwrite proof: the phase exists, queues into `[driver+0x80]`, drains into the dispatch - C147, C148, X149, X150–X157; what the chain feeds = vegetation, C150.)** The capture's deep-band mix at the anchor = soil 0.805 at rows 320–383 → rock 0.52 / soil 0.38 at 448–511; our driver lane paints sand 1.0 there — the deep band is the remaining structural gap at the anchor (E1: `mapgen/out/dig173-fill-census.json`, the #172 artifact before it). **Dig #173's read (X149 re-extracted fresh, md5-verified):** the material-record stamp phase @0x793a71 walks the scene's `[0x9c]` record list — per record an x-column match, a **y-limit at `[+0xc8]`**, a probability flag at `[+0x20]` gating the walk's own LCG (`esi·0x343fd+0x269ec3`, `(sar16 & 0x7fff)/32767` vs `[0x11dfa10]`), a neighbor-scan count at `[+0xc4]`, a **material id at `[+0xd8]` = the exact slot C144's sampler record-fetch reads**; qualifying cells pass the driver-relative `0x909da0` check and insert the 12-B `{x,y,record*}` triple into the driver's vector at `[driver+0x80]`; the id-plane construction @0x7935f4 grows the **0x40000 (512×512 ptrs)** buffer (kind-3 arm) / stores the `0x740f80`-resolved object (else arm). **The overwrite is proven data-side (C147):** at rows 448–511 the art is a single uniform `#ffffff` (all 12799 mask cells) while the capture's families = rock 0.5216/soil 0.3815/sand 0.097 — ONE art color → THREE families ⇒ a per-cell writer with the LCG gate, not any per-color table. **Open (the two reads) — CLOSED dig #174 (entry (174), C148, X150–X157):** (i) the producer = the V0 fill-source planner fn 0x8f5760 (the SHUFFLED 0xe0-comp claim order + the per-column v-lerp/`[comp+0x1c]`-probability gates — the mechanism turning one art color into the capture's per-cell mix; the parse that FEEDS its `[comp+0x0c..+0x1c]` slots = I44(a)); (ii) the consumer = the `[driver+0x80]` drain chain (0x909bd0 guard/defer → 0x8f75c0 flag dispatch → the leaf writers 0x8f6520/0x8f6d30, whose internals = I44(b)) — **and the container is a std::vector of 12-byte `{x,y,record*}` triples, NOT the "set" this row said (the (173) wording corrected by the drain's stride/limit bytes).** The remaining gap for the port = **I44** (narrowed dig #176: the class closed at parse level, C150; the string-resolve, leafB's write, 0x58e530 + the method8/9 bodies remain). The deep-band attribution + its acceptance bar (the census's deep-band capture shares: rows 320–383 soil 0.8052/rock 0.1025, 384–447 soil 0.4848/rock 0.4179, 448–511 rock 0.5216/soil 0.3815 - METER-CLASS: E1, `mapgen/out/dig173-fill-census.json`, repro `SURFACE_V3=1 node mapgen/experiments/2026-10-19-dig173-fill-census.mjs`, seed 78633191, tile 40_14, shares = fraction of band-mask px, 0..1) = **I45**. Sources: entry (173); entry (172); entry (176); X149; X163–X170; C144; C146; C147; C150; I39(a1)/(a2)/(d); I44; I45 |
- [ ] **I43. blitScene's grey placeholder fill still runs the seeded-fBm approximation (A5 residual) — the prescribed fix (route it through the C146 driver law, as the splice lane) was TRIED and FALSIFIED 2026-11-09:** with `config` threaded in (kind-0 defs only; a null lane kept the fallback), the driver's classify returns NO match on most grey cells of the blitScene-hosted scene-room biomes (mountain_hall, mountain_right, mountain_left_entrance, lavalake_racing, snowcastle_hourglass_chamber, snowcave_secret_chamber, orbroom_02/07, roboroom: 31 chunks, 1.47 M of 1.61 M changed px become unset), and the capture shows SOLID there — solid-mask agreement (lum ≥ 24, E2 sentinel, seed 78633191) 36_13 0.934 → 0.310, 41_18 0.791 → 0.311, 37_13 0.977 → 0.587, 35_13 0.923 → 0.740, 43_15 0.701 → 0.623, 15_19 0.689 → 0.671. Reverted. So for these biomes the game's grey fill is NOT `classify(surfaceField)` as ported (the law held only at the mountain_lake splice anchor, C146). Next read: what fills a scene-room biome's grey art — their `<Materials>` windows vs the field's range there, the walk's record-lane stamps (I42), or a kind/arm other than kind 0 (X223's driver arms). Probe: the with/without-config template diff + the capture agreement on the six tiles (scratch scripts of this session; re-creatable from this text). Sources: entry (172); C146; A5 **Note dig #233:** the BIN lane's placeholder cells now run the game's P-empty arm (C199: field gate + own-biome classify at 0x908e70's v, the Work lane's law) — the bins' choice is no longer a stand-in; this issue's scope = blitScene's grey fill (the scene-room biomes) only. Where no hand family's dominant colour lies in a biome material's texture, C199 cannot pair them and the hashed family stays — measured 2026-11-09 at excavationsite (tiles 31..36_17): the capture's placeholder solids = coal_static (53–56 grey) + rock_static_grey (67–76 grey) texels, ours = the soil family; pairing families to materials there would be a guess ⇒ waits on the classify choice itself.
- [ ] **I44. THE CLASS-Y RECORD PALETTE'S BUILDER + THE LEAF WRITERS - (a) CLOSED AT PARSE LEVEL dig #176, (b) NARROWED - THE RESIDUALS NOW OPEN:** (a) **the class question RESOLVED (dig #176, C150(1)(2)): the 224-stride record = `<VegetationComponent>`'s record.** The fill-source's head f32s (`[+0x0c] rand_seed` / `[+0x10] tree_width` / `[+0x14]/[+0x18]` radius-low/high / `[+0x1c] tree_probability`, C148(1)) are the record's OWN attr slots - byte-pinned from its attr applier 0x785f80's full window (X163: the 28 slot stores incl. the previously-uncaptured 3rd bool `is_grass` +0x06, the four string leas +0x28/+0x40/+0x58/+0x70, `material_on_top_of` +0xac → the string size at +0x80; the family = 7 chain copies, invoked indirectly through the 17-entry vtable 0x118b14c, X170). The two-vector law stands (the 224-stride vector at `[this+0x14]`, X150) and the (174)/(175) comp-attr-pass-through elimination stands - but the class gap is CLOSED: WHO builds the records = the VegetationComponent chain family, and the five head slots are plant params, not geometry/material inputs. **Residual (a):** the walker/parse loop that indexes the vtable + the record's insertion into `[mBiomeMaterials+0x14]` (zero direct `call 0x957b00`, X170); and the `tree_material` string → `[+0xd4]` id resolve (mountain_lake's 2 records carry NO `tree_material_id` attr). (b) **the leaf writers - the DISPATCH + visual + leafA READ fresh dig #176 (C150(3)(4)):** the dispatch 0x8f75c0 full window (X164) - the `[rec+0xd4]<0` guard logging the +0x58 `tree_material` string, the `[rec+0x80]` size test → the offset-subtract redirect to 0x58e530, the [+0x4]/[+0x5] arm select → 0x8f5eb0 / 0x8f6520 / 0x8f6d30 - and both read arms take ONLY `[rec+0xd4]` as the material id (method8 `*0x20` @0x8f60f1, method9 `*0x24` @0x8f6b3e; X165/X166). **Residual (b):** leafB 0x8f6d30's write mechanism (0 `0xd4` displacements, one `call 0xd15bd0`, X167), 0x58e530's semantics, and the method8/9 bodies - all unread. Reads (a)+(b) = the port dig's next extractions; **the port's acceptance bar re-aimed dig #176: this lane is judged by its vegetation write in the SURFACE band - the deep-band census shares are now I45's bar (P3 falsified, §8 row 60).** Sources: entry (174); entry (175); entry (176); C148; C149; C150; X150–X170; I42; I45; I39(a2) |
- [ ] **I45. THE DEEP-BAND SOIL/ROCK WRITER - UNIDENTIFIED (the dig-#176 P3 falsification's re-aim; the 74,529-px lever):** capture's rows 320–511 at the mountain_lake anchor show soil→rock mixed over our uniform sand, and both formerly-named writers are eliminated - (i) the grey-fill driver classify (C146's window law: sand_static's `[0.53,0.95)` has NO y-gate → the driver returns SAND at rows 320–511, §8 row 59(a)) and (ii) the record-stamp/vegetation chain (dig #176 byte close: the chain's only material input = `[rec+0xd4]` tree_material_id ∈ {moss, grass} at the anchor, C150 - the census instrument's pre-registered line `P3 capture 320+ soil/rock vs our sand = the I44 residual` = FALSIFIED, §8 row 60). **The data-side second-writer proof STANDS (§8 row 59(c)): one uniform art grey → three capture families → a per-cell, LCG-gated writer - but whose material resolution is unread.** METER-CLASS: E1 (artifact `mapgen/out/dig173-fill-census.json`; repro `SURFACE_V3=1 node mapgen/experiments/2026-10-19-dig173-fill-census.mjs`; seed 78633191, tile 40_14, grey mask 104002 px; shares = fraction of the band's mask px, 0..1): 320–383 = 31621 px cap soil 0.8052/rock 0.1025/sand 0.0924 vs newFill sand 1.000; 384–447 = 30109 px soil 0.4848/rock 0.4179/sand 0.0958 (+ coal 0.0008, fallbackSolid 0.0007) vs 1.000; 448–511 = 12799 px rock 0.5216/soil 0.3815/sand 0.0969 vs 1.000 (the three bands sum 74529 px). **Open candidates (three):** (i) the VALUE FIELD - v's deep-row distribution (measured v = 0.54165 at row 320 → 0.63119 at row 511, dig #173) against the classify windows; (ii) the CLASSIFY-COMP windows/y-gates at fill time (mountain_lake's soil comp `limit_y=1`, y∈[−1024,424.229], straddles band 384–447); (iii) the per-cell ART-PLANE second writer (the LCG-gated stamp of §8 row 59(c), distinct from the VegetationComponent lane). **Reads = the field/classify-comp/art-plane attribution dig; acceptance = the three bands' cap shares above (E1) landing on newFill. Queued for the next dig's E1 compass decision: this attribution read vs the I44 vegetation port (the surface-band mandate ranks the port higher; the port needs I44 residuals pinned first).** Sources: entry (176); entry (173); C146; C147; C150; §8 rows 59/60; I42; I44 |
- [x] **I46. The viewer's epoch poll stopped at `ready`** — FIXED 2026-10-20 (`public/genmap.html` pollStatus keeps a 5 s poll once ready; commit `8725cab`).

- [ ] **I47. THE SURFACE-BAND SHAPE — RE-FRAMED dig #205 (C178): the band's lane = the TOPOLOGY evaluator (the surfaceField — the mGradient heightmap / the topology images), NOT the caves field (§8 row 75). The hills = WORKING under the lane (0.724 raw, dyOpt 0, the honest solidity); the fix list = I50 (the winter's surfaceField, the lake's image decode); the product flip (the V2 = the surface band's lane) = after the fixes. The caves system = the underground (the user's working caves); the stamps = the cave entrances (the caves' decorations); the pixel-scene machinery = the structure drawer (105 Lua LoadPixelScene callers)** | the I50 fixes; then the product flip + the SURFACE_V2 default | the surface band | digs #201–#205 |
- [ ] **I48. THE WINTER-FAMILY C97 DECLINE — RE-FRAMED dig #205: the winter's collapse (0.104) = the TOPOLOGY lane's broken sub-lane (the winter's surfaceField = near-all-air — the winter's band-ramp/driver params = the read, I50a); the caves-lane winter numbers (0.71–0.72) = the UNDERGROUND's business now. The G-frame/engine history = the caves-lane era's record** | the winter's Topology params read (I50a) | the surface band | digs #196–#205 |
- [x] **I49. THE PIXEL-SCENE BACKGROUND = PAINTED AS FOREGROUND 1:1 (the obs-1 "water west of the tree" mechanism)** — FIXED dig #210 (the fix commit): `blitBackdrop` (`mapgen/lib/template-render.mjs:138-161`, exported at `:146`) now writes `background_file` px onto a SEPARATE `bg` plane (`buffers.get("bg")`; the 10 call sites `:331/:333/:484/:696/:709/:711/:723/:725/:736/:738` all route through it), and `world-gen.mjs:269-285` turns the bg-image early return into a fallthrough to an air-only bg-plane fallback (rows ≥63 only — the row-62 sky law returns above it; every bin/fg-template/noise/bgImage lane keeps precedence). Measured (E1, the obs-1 probe before/after, 3 seeds, repro `mapgen/experiments/2026-10-26-dig210-obs1-treewest-water.mjs`): the tree-west cell (38,62)'s `template` branch **11,127 → 0 px** (all 3 seeds); the cell's airDark **12,456/12,531/12,515 → 1,329/1,404/1,388 px = 19.0/19.1/19.1% → 2.0/2.1/2.1% = the bin-air arm ONLY** (the anchor edge-strip's neighbor bin-air, vs the capture's 1.6% at 38_14); the `noiseChunkMask(38,62)` line byte-identical pre/post-fix (the noise lane untouched). The residual family-mix mismatch = **I51**. Sources: entry (210); C182; X217; `mountain_right_stub.lua:9` |
- [ ] **I50. THE TOPOLOGY LANE'S FIX LIST (opened dig #205, C178) — current state:** (a) the LAKE = FIXED dig #208 (classify-or-air + the world-y limits, C180); (b) the WINTER pattern + level LANDED digs #207/#208 (C179/C180) — OPEN = **I50a**, the winter placement class: the ±100–260 px first-solid medians (tiles 17/27/18/14/12/21; dig #211 meter, ABOUT (211); dig #212 part-1 profile, commit `32b0282`) — the former tile-15 "hole" (+256 px) is CLOSED dig #212: it was the backdrop clip (C184; the chunk is all air and the capture shows the cave backdrop below wy ≈ 194), now −32 px; the static arms are port-correct, the open half = the runtime band-matrix resolution, arbiter = the CE band-matrix capture (VERIFIED §9.1a); **I50b** = the winter over-solid at (17,61) (ABOUT (211)); (c) the hills/desert bty13 wave-phase = the same placement residue (ABOUT (208)). Narrative = §6 entries (205)–(212) + commit `32b0282`.
- [ ] **I51. THE MAP PALETTE — (a) the colour SOURCE = CLOSED dig #213 (C185): a cell's colour is its material's `<Graphics texture_file>` at the world pixel (positive-modulo wrap, phase (0,0); no texture ⇒ the `<Graphics color>` / wang back-fill; alpha composited); the noise band now paints it (tile (38,62): raw wang 85.1% → 0; the capture's 38_14 families = earth.png + rock.png exactly). OPEN: (b) the family MIX — the capture at 38_14 = earth (70,65,40)+(95,87,49) 61.6% / rock (39,40,45)+(62,69,85) 30.0% vs ours ~43% / ~44% ⇒ the classify windows/placement there, not the colour law; (c) CLOSED for SOLID materials dig #224 (C195) in the bin lane (per pixel since dig #231) and dig #229 in the scene-art lane (`materialPx`); the driver fill (`fillPx`) keeps the anchor-calibrated families (its material assignment is the open part, C146/I42); gases and flowing liquids with a calibrated family keep it — their render laws differ from C185 (A23); (d) the user-reported dark-blue at the tree-west / lavalake predictable spawns — re-check after (c).** Sources: entries (210), (211), (213); C183; C185; I32 |
- [x] **I52. West lake diagonal dirt band** — CLOSED 2026-11-08: the lake.xml chunks (tx 4..10, rows 14–15) showed a diagonal mud/sand_static/air band (the mode-3 slope ramp, Δ −0.37 from x = −12000, drove v past the water window's 0.5); the capture = pure water from wy 225 down. Fix: the lake family (the 4 `bitmap_noise_file` defs) takes surfaceField's early-zero arm (field0 ≤ 0 ⇒ v = 0 ⇒ water ∩ limit_y [225, 512000]) — FLAGGED stand-in **A19**. Pin: `tests/mapgen/lake-pool.test.mjs` (3/4 fail pre-fix).
- [ ] **I53. The biome-edge law (C187) in the MAIN band — half landed dig #218.** The capture follows the law at the main band's `solid_wall | wang` lines (E1, 208 segments, 4,287 rows: median |capture − law| 1 px vs 21 px for the straight line). **Landed (dig #218, C189):** a pixel whose displaced biome is a NOISE biome renders that biome's kind-0 lane (`noisePixelFor` → `edgePixelAt`, `lib/world-gen.mjs`) — the wall bulging into a cave, and both sides of every noise–noise line (solid_wall | solid_wall_tower / desert / winter); render vs law median 18 → 8 px (≤ 4 px: 10.7 → 43.1 %). **Open:** (a) a pixel displaced INTO a wang biome (the cave bulging into the wall) — the game reads the global wang image P there (driver kind 2), but our area maps end at their chunk rects (±8 px) and what P holds outside a wang area is unread (Init's P fill); (b) the sky band (ty < 62) and the Work keep their own lanes (the Work = dig #216); (c) the 11/12-px L3 anchor: the law reads the display frame, the lanes the generator frame — the edge lane compares against the generator chunk so the strip takes the pixel biome's verdict. Sources: entries (216), (218); C187; C189.
- [x] **I54. The wang layers' missing art tiles (the user's obs 4, ABOUT (210)) — CLOSED 2026-11-08 (non-dig fix commit).** The holes = the out_map cells whose colour is a SPAWN colour: the game calls the biome Lua function there and many of them `LoadPixelScene()` pre-drawn art (the blocked-out rooms of layers 1–2 — oil tanks, coal pits, shrines, gunpowder pools, the puzzle room — plus the structure pieces of every layer: the snowcastle panels/chamfers/pillars/pods, the vault pipes/catwalks/brain room/shops, the crypt stairs/beams/cave-ins, the rainforest plantlife/pits, the snowcave icicles/observatories). Our render left the template's bare black room (finalizeLite) and painted the trigger px airDark or raw. Fix = the wang spawn-scene lane (`lib/wang-scenes.mjs` + `world-gen.mjs` buildWangScenes/wangSceneAt): colour→function = `data/scripts/wang_scripts.csv` (engine table: ff0aff `load_pixel_scene`, ff0080 `load_pixel_scene2`, …) + the script's RegisterSpawnFunction; the REAL biome Lua runs in a fengari VM with SetRandomSeed/Random/ProceduralRandom on the `seededPrng` port (arities from the exe's own API doc strings); call at (area.x1−35)·512+10i, (area.y1−14)·512+10j; scenes blitted in the generator frame (they land in their rooms), gated to the loading biome (`skip_biome_checks=false`, biomeAtPixel), precedence over the bin lane, their background_file over bin air. `colorize` now paints every biome spawn colour as air (cache rev r3i → r3j). Seed 78633191: 52 areas, 46,741 calls, 3,947 scenes, 0 Lua errors on the scene path (E1 census, layers 1–7: coalmine 20 / excavationsite 11 / snowcave 44 / snowcastle 369 / rainforest ×4 119 / vault 1,540 / crypt 272). Residuals: the scene px colours ride blitScene's palette (I43/I51(c)); the call order = A20. Tests: `tests/mapgen/wang-scenes.test.mjs`.
- [x] **I55. The sky band (biome rows 0..13, between the Work's heaven end and the surface) — CLOSED 2026-11-08 (non-dig fix commit).** Measured on the capture seed vs `mapgen/out/ref` (rows 0..13 × cols 3..58, 4-px sampling): sky/non-sky agreement 89.50 → 95.75 %, exact colour 83.26 → 92.02 %; every captured chunk (1,310): 93.04 → 97.30 % / 58.45 → 63.99 %, no biome lost. Laws: (1) **C184 in the sky-band bin-air arm** — a limit-on biome's backdrop never draws above world y 225, so the clouds' air = the sky (the old arm painted background_cave_02: navy 80 %); (2) **the y-gated placeholder material** — the grey placeholder takes the biome's ONE distinct non-rare material whose `limit_y` gate admits the cell (cloud_lighter is gated to [−1024, 424.229] ⇒ the cloud rows are cloud-only), coloured by the capture-calibrated gas families `cloud` (48,48,52) / `cloud_lighter` (48,48,63) (= wang_color·70/255, NOT the C185 alpha composite — the gas map-colour law is unread); several active materials sharing one C185 colour ⇒ that colour (the static tiles' templeslab_static + templeslab_crumbling_static = templeslab.png); (3) **C185 for every material with no calibrated family** (bins: per 10-px cell; art lanes: per px) — wood_tree (the mountain tree) was the flat fallback grey; (4) **the static tiles' XML path** (`data/biome_impl/static_tile/…`, their materials were never read) + **the bg mask** (`static_tile_bg_mask`, E1: fg-air × black mask px = the sky 98.7–99.4 %, × white = the backdrop, on barren / darkness / potion_mimics; consumer unread); (5) **A21** (below). (6) **spawn triggers inside placed scene images** (`wang-scenes.mjs` sceneImageSpawnCalls → `world.imageSpawns`, read last before the sky): the spliced tree.png's 0xc2d0b4 px runs mountain_tree.lua `spawn_pillars` = the six teal pillars above the tree (36 LoadPixelScene calls); `HasFlagPersistent` = false ⇒ the flag-free pillar height — the capture's taller, uneven pillars encode ITS player's persistent unlocks (player state, not world generation). Pins: `tests/mapgen/world-gen.test.mjs` "sky band" (4), `colorize.test.mjs` (3), `biomes.test.mjs` (1). Gen-cache r3j → **r3m** (r3k/r3l = abandoned mid-fix revs, clearable).
- [ ] **I56. The sky-band wang SHAPES (clouds_4_1, clouds_53_3, the row-0 boss_victoryroom area) do not reproduce** — the colours now match (I55) but the solid/air blobs are uncorrelated with the capture: IoU 0.25 at offset 0 (independent masks ≈ 0.14), no frame offset in ±480 px peaks (best 0.28), NO attempt among the first 100 matches (best 0.29 / 0.31), the bounding-box-area hypothesis fails (0.24). Every wang area the port verified sits underground; these are the only wang areas at world y < 0 — the generator input that differs there is unread (needs a REA dig on the area driver). Un-voiding the_sky's bins with the right colours LOWERED its chunks 83.7 → 71.5 % (wrong blobs score worse than sky), so the_sky stays void until this lands. **Narrowed 2026-11-09:** (a) the mismatch is PATCHY, not global — per-chunk IoU 0.09–0.60 (e.g. (7,1) 0.60, (4,4) 0.56 vs most 0.15–0.30), whole blobs coincide exactly in places; (b) no per-chunk drift (best local offsets scatter to the ±200 px search edge) and no width/seed variant helps (W±12, 8 seeds × 4 attempts: best 0.281); (c) **the capture's cloud edges are NOT on the 10-px cell grid** — edge phase mod 10 over all 55 cloud chunks: x 7.0–13.1 %, y 5.7–11.8 % per phase (uniform = 10 %) ⇒ the game's world px come from a PER-PIXEL law over the wang cells (the cell → px materialization — the same law the user scoped OUT of the perf work as item 5, 2026-11-08), which reshapes every outline. The sky band is the FIRST clean geometric test of the wang lane (black air); underground the backdrop confounds solid/air, and the fill itself was validated by spawn equations, never geometry (VERIFIED §5 / line 124). **Eliminated 2026-11-09 (the cell→px dig, first pass):** the C167/C168 warp-displaced ±1-snapped P read (`caves-field.mjs` cavesShapedCellAt's math, flip 1.0, G = (17920, 7168), area cell i = P col trunc(x1·512/10)+i) over our accepted out_map scores IoU **0.268 vs 0.262 unwarped** — the warp explains the off-grid edges but NOT the blob mismatch ⇒ the game's CELLS differ from our out_map for this area (the fill input, not the materialization). Warp call-site census follow-up: `0x64a0f6` = a debug-draw site (amplitude xorps 0) and the `0x909451` function = an assert-validation path (amplitude 0, assert line 0xad7) — neither is a chunk writer. **THE CROSS-BUILD CONFOUND (2026-11-09, untested — blocks the judgement):** the only capture of the sky band is the noitamap stitch = **game build 2024-08-12** (mapcap/README), while the generator reads the INSTALLED data (files dated 2026-09-03; the in-game captures are build 2025-09-25). The 2025 captures (frozen91–93, run1b) cover only game chunks x −6..12 × y −3..5 — the clouds (x −31..−21, y −13..−9) were never captured on a current build. The wang fill was validated by spawn equations on the current build, so a build-to-build change in the sky band (template, biome map, or area driver) would produce exactly this picture. **Unblock = one noita-mapcap capture of the clouds region (game chunks x −32..−20, y −14..−8) on the current build, any seed** — then the generator is judged against same-build ground truth. Also eliminated 2026-11-09: the `wang_map_width/height` fill WRAPPED over the area (256×256, attempts 0..19): IoU 0.207 (clouds_4_1) / 0.261 (clouds_53_3) — no better than chance. Next: the generator input for the sky-band areas — the spawn-equation judge (VERIFIED §5) has no cloud-area facts yet; an entity dump of clouds_4_1's spawns (wraith/thundermage trigger cells) would pin whether our out_map or our area rect is wrong.
- [ ] **I57. The surface line — the positional residual at game chunks x 8–9 (re-scoped dig #217).** The hills' surface = the band ramp's r = 0.51 contour (C188) and its seed phase (xBase) is confirmed (§8 row 81: rank 0.7 % / 23.2 % / 3.0 % of 401 phases on the three same-build captures). The old "67.5 px vs run1b" figure measured the first coloured pixel, and 69 % of those in the hills are vegetation (I44) — that number is retired. **Current state (METER-CLASS: E2, terrain-only line — skip green/pink px, require a ≥ 16-px-wide × 20-px-deep solid mass; per-chunk median |dy| ours vs frozen91/92/93):** cx 3 13/61/14, cx 4 8/30/12, cx 6 106/26/16, cx 7 29/21/39, **cx 8 106/86/65**, cx 9 36/161/57, cx 10 6/4/37, cx 11 12/7/7 px (cx 5 = mountain_lake 107, the A19/I52 lane). **Open:** (a) cx 8 is off on every seed — seed-independent, so a positional cause (candidates: what the game stamps or draws at biome col 43; the BitmapCaves band from y = 0 — its top edge coincides with seed …192's flat plateau at y ≈ 0, but our caves port is also solid in the matched valleys, so a plain union is not the law); (b) seed …192's cx 8–9 cliff + plateau, which a smooth contour cannot draw; (c) the vegetation layer itself (I44) — needed before any first-pixel meter is meaningful. **Observation 2026-11-09 (post-dig, METER-CLASS: E2, UNATTRIBUTED — evidence for nothing until a byte read explains it):** shifting our contour y = A(x+dx) + 0.51·(B − A) by one dx shared by all three seeds, the joint median |dy| optimum is dx ≈ 0 at the control chunks (cx 4: +16 → 21/36/13; cx 7: +16 → 34/12/41) but **dx ≈ −3860 at cx 8 (104/86/64 → 22/31/37) and ≈ −3736 at cx 9 (35/159/53 → 30/20/44)**, with seeds …191/…192 picking the same dx to within 4 px on their own at cx 9 (−3736 / −3732); not one rigid offset (cx 8 vs 9 differ by 124 px; cx 6 splits by seed: …191 −3660, …193 0). Read as: the game draws a DIFFERENT noise slice over cx 8–9 that a shifted window imitates — not yet a frame law. Position notes: biome map row 15 col 43 (under cx 8) = `orbroom_07` (ffffd107), col 44 = solid_wall; rows 12–14 cols 41–44 = plain hills; no biome modifier touches topology (biome_modifiers.lua writes vegetation/materials/physics only). **That read (2026-11-09, X1 + REA, non-dig): NO positional mechanism in the code.** (i) the field driver `0x908f40`: GetBiomeAt → kind 0 ⇒ `surfaceField(x+0.5, y+0.5)` → classify — identical at cx 7 and cx 8; its other two call sites `0x7938d1`/`0x7938fe` = the vegetation stamp's x−1/x+1 probes (record `+0xa8`/`+0xd4`), not terrain; (ii) the walk origin `0x794187..0x79419b` = `chunk.x << 9`, `chunk.y << 9` for every chunk (A18's closure re-confirmed); (iii) the band matrix's source image (Init `0x906b17..0x906e49`) = the map loaded through `magic_numbers.xml` BIOME_MAP = `data/scripts/biome_map.lua`, which only does `BiomeMapSetSize(70, 48)` + `BiomeMapLoadImage(0, 0, biome_map.png)` (the Init branch gated by `[ebp−0x249]` = this Lua path: strings `0x1174728` = "BiomeMapLuaManager", `0x1174804` = "temptemp/biome_map_lua.png" — the script's output image feeds the matrix) (`scripts/biomes/biome_map_gen.lua` has no users); (iv) no `_pixel_scenes.xml` entry over x 3000..5800, no biome modifier writes topology. **The capture side (E2):** the SAME seed 78633191 captured by noitamap (the 2024 stitch) and in-game (frozen91, 2026-09-04 on the installed exe dated 2025-01-26) disagrees across the hills — terrain-only median |Δy| cx 3 73, cx 4 134, cx 6 167, cx 7 189, cx 8 122, cx 9 30 px — while the fixed lake (cx 5) agrees to 0 px; frozen92 is byte-identical to run1b and run1 has the parallax on ⇒ the project holds NO independent same-seed same-build capture pair, so whether the hills surface is a pure function of the seed is UNTESTED. **Next = runtime truth:** a fresh noita-mapcap capture of seed 78633191 or 78633192 (game chunks x 3..11, y −2..1, parallax OFF) — it tests determinism against frozen91/run1b AND re-judges cx 8–9; or a CE dump of the band matrix (`experiments/ce-dump-bandmatrix.lua`, offsets to re-check first). Repro: `SURFACE_V2=1 SEED=… REF=frozen9… MODE=chunks TERRAIN=1 CX=3,11 node mapgen/experiments/2026-11-09-dig217-surface-phase.mjs`. Sources: entry (217); C188.
- [x] **I58. init() engine queries against generated terrain were stubs — CLOSED dig #223:** `RaytracePlatforms` = the byte-exact tracer (C194); the rainforest init runs clean (5 Lua errors → 0; 4 hint statues + the portal hole). The cell predicate has no terrain to read in the init lane ⇒ A22.
- [ ] **I61. The pyramid's residuals (dig #226–#229; seed 78633191):** solid agreement / exact colour vs capture 53_12 0.995 / 0.937, 55_12 0.996 / 0.949, 54_11 0.997 / 0.973, 52_13 0.992 / 0.932, 53_13 0.978 / 0.665, 54_12 0.859 / 0.373. (dig #230: the backdrop phase fixed — its shade mismatches were a sampling offset) OPEN: 54_12 (the boss room: solid agreement 0.86 — the maze shape) and 53_13's remaining 1/3 of colours.
- [x] **I59. The wang spawn-scene VARIANTS were the wrong ones (user, 2026-11-09: placement right, choice wrong) — CLOSED dig #220:** the host called the spawn functions at the old cell corner instead of the engine's spawn-record position `10·t − 5 − G` (C191, §8 row 84), so every `ProceduralRandom(x, y)` pick was re-seeded. Pin: `tests/mapgen/wang-scenes.test.mjs`.
- [x] **I60. The bin lane read the generator at the constant C78 anchor instead of the per-area law — CLOSED dig #222:** the bin + wang-scene reads use `binAnchor` = `+5 + 10·frac(c·51.2)` per area (C192/C193); clean A/B on the C78 instrument: the constant's per-chunk residual = the law's prediction, the port's ≈ (0, 0), zero-shift scores up on all three metrics (ABOUT (222)).

### 8. User observations 2026-11-09 (registered for the next session)

- [x] **I62. REGRESSION: predictable-spawn rooms filled with dense rock — FIXED 2026-11-09 (non-dig fix commit).** Three causes, each measured against the capture (seed 78633191, solid/air agreement lum ≥ 24, 512² px per chunk):
  1. **Air written as "unset" (the actual regression, dig #225/#228, C196).** An air-keyed scene px (wang `000042`) cleared the template cell to "unset", so the lane below painted, which was the noise rock in a noise-biome chunk. friendroom.png and teleroom.png are mostly air-keyed. Fix: AIR is now a written state (`TPL_AIR` = (9,9,10), `template-render.mjs`) that blocks the terrain lanes and shows the backdrop. friend_1..6 0.77 → 0.99, teleroom 0.63 → 0.94, robot_egg 0.82 → 0.98.
  2. **Image-spawned scenes were read only in the sky band.** The watercave's layout comes from the `random_layout` trigger (0xffb539) inside spliced watercave.png (`buildImageSpawns`). It was built but never read below canvas row 62. Now read in the main arm, painting over its host image. Watercave (31_15, the L1 → Ancient Laboratory connector, a random 1-of-6 layout) 0.83 → 0.94.
  3. **Template-less BIOME_WANG_TILE room chunks got the noise lane's rock under their scene's black** (C143: black = a miss = keep the content). Now no terrain of their own: **A24**. dragoncave 0.75 → 0.99, secret_lab 0.69 → 0.94, mestari / mystery_teleport / orb rooms ≈ 0.75 → 0.95–0.99.
  Also: a loaded scene's background_file is drawn over the biome backdrop in air cells (orbroom_background.png, the racing track). 36 tiles changed and all improved; HM temple rows +0.03.
  Whole capture set (1,373 tiles, stride 4): solid agreement 0.9435 → 0.9495, exact colour 0.6812 → 0.6923. The only losses are the lavalake chunks (−0.01..−0.03), owned by I63. Hourglass room 27_24: 0.81 → 0.88; its remaining gap is the fill texture (I43). Pins: `tests/mapgen/world-gen.test.mjs` "I62 — the per-biome rooms are not filled with rock" (4 tests).
- [x] **I63. The chunks around the lava lake are still wrong — FIXED 2026-11-09 (non-dig fix commit).** The lava lake's rock comes from the spliced `lavalake2.png` (placed at world (2048, 0)): 1.47 M white placeholder px, e.g. 87 % of 41_16. The splice lane filled placeholders with the dig #172 driver law (kind-0 `surfaceField` + classify), which matched no lavalake window there and left the cells unpainted, so the backdrop showed where the capture is solid rock_hard. Fix: splice placeholders now run the **P-empty arm** (the Work lane's and the bins' law, C186/C199: field = the grey's luminance, ≤ 0.5 ⇒ keep, else the hosting biome's classify at v = 0x908e70(x, y, field)). Solid agreement: 41_16 0.24 → 0.98, 41_17 0.31 → 0.96, 41_15 0.56 → 0.999, 40_17 0.57 → 0.98, 39_15 0.65 → 0.97, 42_15 0.69 → 0.98. Whole capture set (1,373 tiles): 0.9495 → 0.9519, exact colour 0.6923 → 0.6943, and all 18 changed tiles improve. **Residual (open):** at the mountain_lake anchor (40_14) the old driver fill matched the 716-px soil top band better (exact 0.462 vs 0.117), while the new law wins the mid band (90k px, 0.138 → 0.161) and the foot band (12.8k px, 0.038 → 0.345). Which lane writes that soil top is unread (it relates to I42). Pins: `tests/mapgen/splice-fill.test.mjs` L1/L2 (re-pinned on capture agreement); `tests/mapgen/world-gen.test.mjs` "I63".
- [x] **I64. No sinusoid shape on the cursed rock — FIXED 2026-11-09 (non-dig fix commit).** The cursed rock is `rock_static_cursed`, the only material of `solid_wall_tower` (the world-edge columns 0 and 69, window [−100, 3.95]). The old paint was a hand pink speckle (`STRIP`) over the tower chunk plus a straight 32-px strip inside the solid_wall chunk. Now the tower/wall chunks are painted per pixel: wherever the pixel's biome (biomeAtPixel = the C187 edge law) is the tower, rock_static_cursed's C185 texture (rock_cursed.png at the world px); wherever it is solid_wall, the wall's fill (unchanged); any other biome is left to its own lanes. The in-band and Work-extension rows both use this. E1 (captures 0/1/68/69 × 20/30, the edge walked from the tower side): median |ours − capture| 0 px vs 20 px for the straight line, 80.3 % of rows within 4 px; tower chunks' exact colour 0.50 → 0.98–0.998. Pin: `tests/mapgen/world-gen.test.mjs` "I64". (The solid_wall interior is still the DEEP_ROCK speckle, owned by I6.)
- [ ] **I65. The Cauldron room is missing — LOCATED, source unknown (2026-11-09).** Location (user): two chunks below snowcave_secret_chamber (42_22), so **chunk 42_24** (world x 3584..4095, y 5120..5631). The capture (`mapgen/out/ref/42_24.png`) shows a cave room: a cauldron on a stone altar between two carved pillars, rimmed with rock, over the backdrop `weather_gfx/background_cave_04_alt5.png` (100 % of the capture's backdrop colours). We render plain solid_wall there. **What was ruled out:**
  - The biome map gives solid_wall at 42_24, and `scripts/biome_map.lua` = just `BiomeMapLoadImage(biome_map.png)`.
  - No `_pixel_scenes.xml` or spliced entry lies in that world window.
  - No script, entity or exe string references alt5: in the extracted data only `_alt` (75) and `_alt3` (15) are referenced, while `_alt2`, `_alt4`.. `_alt10` exist unreferenced.
  - No coordinate literals near (3584–4096, 5120–5632) in scripts/entities/biome.
  - No biome_impl image matches the art (best colour match 26 %).
  **Hypothesis:** the room is defined outside the extracted `data/` (newer `data.wak` content, or loaded at runtime by an entity/script we don't have). **Next:** get the game's current `data.wak` (or its extraction) and search it for alt5 / the room art; the unreferenced `_alt4.._alt10` backdrops suggest a whole family of such rooms.

## Strategy (agreed)

The working method lives in `AGENTS.md` (the campaign charter) — one home
per fact. In short: keep the verified wang core; per issue, find the game's
actual mechanism (Ghidra fn or game-data script) → reconstruct → validate vs
capture → check the box; approximations (§A) are debt, replaced never tuned;
predictable spawns (moon/dark-moon/HM bands) = free alignment anchors.

## §A register — approximations (D-level claims; the purification scoreboard)

Port stand-ins marked D **are debt, not products**. Levels: B (byte:
this-session extraction, manifest-cited) / M (measured) / D (debt: a
stand-in — this table + FLAGGED in code + an owning issue + a queue
slot). Purification law: **an active-path dig must end with fewer
D-rows than it started with, or state exactly which remain and why.**
A row is demoted (D→B/M) ONLY by the dig that reads its bytes; a
resolved row collapses to one line here — the narrative lives in its
§6 entry + git history (AGENTS.md Synthesis law).

| id | stand-in | location | owning issue | the read that removes it |
| --- | --- | --- | --- | --- |
| A1 | walkChain per-roll draw counts | — | — | **RESOLVED dig #126** (C105(a)) → B; narrative = §6 entry (126) |
| A2 | the walk’s spawn-lane selector = **the byte-plane writer** (the caves’ carve; the scatter 0x8EEAD0 = the sole `call 0x8fafc0` site) | `caves-field.mjs` walkChain + the sampler’s byte-plane gate | I38/I42 | the [−0x38]-span-struct dims read (the scatter’s span-shaped brush geometry; port OFF until then — dig #167) |
| A3 | y-drift span | — | — | **RESOLVED dig #126** (C105(a)) → B; narrative = §6 entry (126) |
| A4 | band-matrix producer | — | I21, I50 | **CLOSED dig #207** (C179): the port's biomeAt-based bandAt = the game's own resolution; narrative = §6 entry (207). The runtime-resolution residual lives under I50a, not here |
| A5 | `template-render` seeded-fBm fill — the splice grey→band half RETIRED dig #172 | `lib/colorize.mjs`, `lib/template-render.mjs` | I43 | blitScene’s 10 call sites keep the fBm — the config-threading fix (I43) |
| A6 | C32 fallback-grey bake | `caves-field.mjs` ~798 | — | staleness re-check (digs #87/#88 may already have retired it) |
| A7 | walk per-value carve EXIT-law | — | — | **RESOLVED dig #127** (C105(b), I30 closed) → B; narrative = §6 entry (127) |
| A8 | the polygon-lane GAME ORACLE (the loader semantics CLOSED dig #157, C132) | `surface-level.mjs` pointInPolygon; the cxml tokenizer | I35 | the lava_90percent mapcap capture (the game-side E0 oracle, user-side) |
| A9 | dig-#164 record-stamp stand-ins: position rolls `min+trunc(N·u)`, byte value=1, template nonzero-rgb→1 | `caves-field.mjs` caveRecordStamp | I39/I42 | the fn950 roll-chain read (the X129 window) |
| A10 | the capture-composite display layer (world px from `out/ref` at the captured seed only, display-only; default OFF 2026-10-21) | `mapgen/server/genmap-server.mjs` worldColorComposedAt | I39/I42/I43/I45 | the scene-fill laws composing at the demo seed (the noise arm DONE dig #177) |
| A11 | surface-band `v > 0.5` mask | — | I47, I50 | **CLOSED dig #208** (C180): the cell law = classify-or-air, the classify's y = world-y; narrative = §6 entry (208) |
| A14 | hills anchor (−162 registration) | — | I47 | **CLOSED dig #205** (C178): the wrong frame — the surface band = the Topology lane; narrative = §6 entries (198)–(205) |
| A15 | shaped-read gaps | — | I47, I48 | **CLOSED dig #197** (C170, C171); narrative = §6 entries (193)/(196)/(197) |
| A16 | **THE MATERIAL-ASSIGNMENT PRODUCER LAW — AMENDED dig #201 (C175): the producers = THE CAVE-STRUCTURE STAMP SCATTER — the `<CaveStructure>` stamps (the biome XMLs, the stamp PNGs on disk) = the record templates whose images carry the wang colors → the wg's u16/u8 planes = the pre-assigned materials; the shape AND the assignment = ONE mechanism.** The planes: the wg's u16 id-plane (holder wg+0xd4, stride wg+0xbc, gated non-zero [wg+0xd8], at-idx = stride·y + x via the at() family) + the wg's u8 flag plane (holder wg+0xf4, stride wg+0xdc; its 0xff byte = an INLINE atomic-ticket claim 0x9443b0) + the P-u16 TileGrid read at the warp's displaced pick. Encoding: the u16 planes store id+1; the u8 setter 0x8FAFC0 stores the raw arg byte and journals {x, y, arg−1} (0x92eb70) | the compose/color lane (`mapgen/lib/` — the port paints classify-only; the stamps' effect = the MATERIAL) | I48 | the remaining read = the scatter's execution site (the seeded PRNG + the stamp→plane writes) — merges with the I47 scatter port|
| A17 | **THE SCATTER EXACTNESS — d1 RESIDUAL = THE DRAW MERGE + THE PHASE PARITY (the seed lane + the engine CLOSED dig #204, C177):** the seed lane = PINNED (the world seed → fnC1 arg3 → 0x8F9470(P, seed) → P+0 = f64(uint32(seed)) + the sign table; the state persists across all the fnB phases) and the port's ENGINE = SWAPPED (makeMinstd — the measured: overall +0.0033 / winter +0.0123 / desert +0.0032); **the remaining:** (d1a) the draw merge — the game = 5 draws per stamp-cycle (the count/variant/X/Y/strength — the variant = the state → 0x8F9470 = the embed ctor seeded; the \$[lo-hi] inside it), the port = 6 (the extra resolver draw); (d1b) **the phase draw-order parity** — the C48 oracle's rows = the partial match under the swap (y192 11/12 = the deep-lane match; the blob zone 0-4/12 = the port's phase models' draw counts ≠ the game's fnB walk); (d2 residual) the C32 decode's formal read (the srcVal = the alpha — the measured; the ±1.0f chain = unread); (d3) the frame offset | `mapgen/lib/caves-field.mjs` makeMinstd + caveRecordStamp + `mapgen/lib/noise-terrain.mjs` the stampAt lane | I47, I48 | the next reads = the fnB phase walk (the draw-order parity) + 0x8F9470's variant law + the C32 decode; then the exactness A/B + the gate-open decision |
| A18 | walk area-rect frame | — | I50 | **CLOSED dig #209** (C181): the walk's y = world px; narrative = §6 entry (209) |
| A19 | lake-family field0 = 0 (the topology body ⇒ the early-zero arm) | `mapgen/lib/noise-terrain.mjs` uidFrom `field0`; `mapgen/lib/noise-proto.mjs` surfaceField | I52 | the P-grid bake of topology_lake.png (the #170 P-wire read): the per-cell field0 + the 2-row strip's frame |
| A20 | the spawn-call ORDER (row-major per area, areas in world.areas order) for the game's chunk-streaming order — matters only for `is_unique` scene tables (a unique scene is spent on its first load) | `wang-scenes.mjs` areaSceneCalls; `world-gen.mjs` buildWangScenes | I54 | the game's chunk-load order for the spawn pass (streaming-order read) |
| A21 | a template-less BIOME_WANG_TILE room ABOVE the surface (canvas ty < 62) gets NO noise terrain | `mapgen/lib/noise-terrain.mjs` noiseChunkMask | I55 | the engine's terrain law for these rooms at altitude (candidate: the topology gradient mGradientStartY −1024, dropped by the kind-0 lane, dig #146); E1: roadblock 5→100 %, ocarina 89→99, song_room 86→92, essenceroom_air 90→96 % solid/air; the underground rooms keep the lane (skipping them: lavalake 100→29 %) |
| A22 | `RaytracePlatforms`' cell predicate ("a cell a character can stand on") = never blocks: the init lane runs before the generated terrain exists, so every trace returns the engine's MISS output (false, x2, y2) — the rainforest hint statues sit at the ray end + the script's offset instead of against the ground | `wang-scenes.mjs` WangLuaHost `blocksAt` (null) | I58 | a terrain probe over the generated cells (the bin + noise lanes, C192/C193 frames) attached as `host.blocksAt`, and the predicate's own material test (the functor passed by `0x8227d0`, unread) |
| A23 | the GAS and FLOWING-LIQUID map colours: cloud / cloud_lighter / water / oil cells keep the capture-calibrated `SHADES` families (water (39,67,63)/(42,70,67)/(45,73,71)…, cloud (48,48,52)) — C185 gives water a flat (35,61,56) that only the pixel-scene art water shows in the capture (40_14: 29,712 px) while the coalmine wang water shows the family (36_15: 2,573 px, 0 flat); the hash-weighted pick stands in for the game's per-cell liquid/gas render | `colorize.mjs` SHADES water/oil/cloud/cloudLighter, `c185Applies` | I51 | the liquid / gas render path (cell colour variation for dynamic cells; why scene water renders flat) |
| A24 | a template-less BIOME_WANG_TILE chunk BELOW the surface (the per-biome rooms) gets NO terrain of its own: the noise lane is AIR there, so the room scene's black (a C143 miss) shows air | `mapgen/lib/world-gen.mjs` roomChunkAir | I62, I63 | the engine law for an empty-template wang biome is unread (it extends A21 underground). E1 over all 75 such chunks: sum of agreement +1.23, dragoncave 0.75 → 0.99. Losses only at lavalake (39..42_15..17, −0.01..−0.03). Resolved by I63: the lake's rock is the splice placeholder fill, not the noise lane, so A21's "lavalake needs the solid lane" was a confound |

Locations are relative to `mapgen/lib/`. Maintained BY the digs; a stale
row is a process bug.

**Active D-rows: A2, A5, A6, A8, A9, A10, A16, A17 (8).** Per-dig
started/ended tallies are not kept here — they live in each dig's §6
entry and in git history (AGENTS.md Synthesis law).

## Notes (2026-11-03)

**Noise vs topology (recorded so it is not re-litigated):** the surfaceField
combine `v = gradWCoef·gradW·per + perlinCoef·rpost + add` splits into
TOPOLOGY (`rpost` = bandRampEval, the mGradient heightmap ramp — the
surface shape) and NOISE (`per` = insidePerlin, the case-arm overlay — the
texture). The capture's first-solid row is a TOPOLOGY measurement (where
rpost crosses 0.5/perlinCoef); the insidePerlin case arms (default/1/2/3)
are NOISE and cannot move the surface line. Past I50a work repeatedly
chased the case arms (acos-NaN, addNoise enum, gradWCoef default) as
"topology" fixes — they are noise-only. The tx 15 _EMPTY_ chunk is
all air in the game too (zero MaterialComponents ⇒ classify-or-air = air,
C180); its capture "plateau" is the biome backdrop below the clip height
(C184, dig #212), not terrain. Plains
and desert topology are already byte-correct and aligned (dig #211 meter:
mountain family ±1 px, HM 0). Only the winter band remains open, pending
the runtime capture of the region grower's output.
