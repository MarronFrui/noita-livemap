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

### 0. User priority ranking (2026-09-20 — SHAPE over colors, strict order)
> Current state (user-verified): generation is "really fucking close from
> reality". The following missing pieces are the user's ranked priorities.
> Note: some bands render partially because the capture extension covers
> both Work bands (heaven/hell).

1. **[P1] Surface level** (refines I1 hierarchy): the mountain
   (mountain*), the watchtower, the pyramid (I2 overlap), and the WEST
   frozen plain. These are the template/procedural biome biomes
   (hills.lua/desert/winter/lake family) — noise terrain + static art.
   The F3 noise mechanism is read-closed; this is the shape-consumer side
   (I6).
2. **[P2] The Work — hell & heaven bands proper generation** (refines
   I3/I5/I6) + the **moon / dark moon as POI anchors** (I4/I7 — the moon
   art already lands via SPLICE_PNGS blur; POI role = registration
   anchors + rotation/alignment targets for the band).
3. **[P3] Portal-zone grey noise vs missing liquid** (NEW, observed):
   the per-layer portal zones connecting to the next holy-mountain shop
   render grey noise in our gen where the game loads NO liquid — user
   hypothesis: the band renders a POSSIBLE-liquid fill (liquid-carrier
   biome region) and IS correct when the liquid exists (lava/blood pools
   render right). Tie-in: same mechanism class as the tea pools item
   below — the u16 DECOR material grid's liquid-fill branch
   (fillRandomMaterials family — the named open read in VERIFIED frontier
   item 5, ABOUT_MATH (17)).
4. **[P4] Solid rocks / corrupted rocks at chunk-area EDGES** (NEW,
   observed): seed-INDEPENDENT edge structures — user inference: they do
   not respond to wang tiles (not a template path). Mechanism candidate:
   the area-EDGE post-fill layer (finalize black blit C17 family /
   biome_implement edges or a static edge-painter), NOT noise, not wang.
   Needs: identify the writer of the u16 edge/rock bands in-binary —
   possibly the FUN_008f9ab0 marker-family (C14/C15 read already sketches
   "erosion/edge painter" behavior at true 0x8e6d50).
5. **[P5] Tea pools / rectangle liquid structures in layer 1** (NEW):
   same liquid-mechanism family as P3 (rect + random liquid) — likely
   fills via the same u16 material-grid branch (liquid variant).
6. **[P5] Lava bands above the Work (HELL) still wrong** (I5 refinement:
   must be PURE lava; needs the liquid-fill predicate from the DECOR
   grid, same mechanism as P3/P5).

**Read-entry cross-links for the next dig session**
(what is already landable vs still needs reads):
- P1: needs the u16 DECOR material-grid content read (fillRandomMaterials
  walk) + per-biome layout params from `scripts/biomes/*.lua`
  (⚠️ stage-11 data side).
- P2: needs the P1 grid read + the moon/dark-moon anchors are ALREADY
  splited (I4 note); hell/heaven noise bands will follow the same
  fillRandomMaterials read as P1.
- P1/P3/P5: **SAMPLER CHAIN CLOSED (ABOUT_MATH (20), C34): the
  >0.5 gate reads a RAW per-chunk float field ([+0xb4]) — NOT the
  evaluator's output; the u16 grid (id−1 bias) feeds a 4-corner
  smoothstep-material interpolation; evaluator2's `a` = the FIELD
  value (NOT constant 1.0 — the (17) all-solid root cause), and
  unpainted cells go field → C33 classifier → u16 DECOR write.
  Remaining = port wiring (field grids + C33 in noise-terrain.mjs)
  and the config RESOLVER tables.**
- P1/P3/P5 (older note): MECHANISM READ DONE (ABOUT_MATH (18), C32): the u16 DECOR
  grid = `BitmapNoise::LoadFromImageData` (the driver's out_map →
  per-color resolver→uid), so a portal zone's area grid carries liquid
  whitening iff the WANG TILE ART's color-resolver assigns liquid —
  user's "possible liquid but wasn't loaded" hypothesis = the
  unresolved piece is the per-biome RESOLVER TABLE ([+0xb0] bodies, the
  config "RandomMaterials" side), ONE remaining read family.**
  **[UPDATE dig #115]** that family's RUNTIME side is now read end-to-end
  (ABOUT_MATH (115), C94, VERIFIED §8 row 35): `ProceduralTerrain::Init`
  → stack wrapper → dispatch `0x8cef30` (queue arm) → slot2 `0xa99ea0` →
  the `<RandomColor>` consumer `0x904c20` (record layout, the
  `wang_template_filename.empty()` guard line 1808, the A/`[A+0x1f4]` gate,
  the seed → warm-up `N = (W mod 11) + (seed mod 12)` + Park–Miller pick
  law, the flood-fill asserts) and data.wak carries **3
  `<RandomMaterials>` blocks / 6 `<RandomColor>` rules**. Still open =
  *which* per-biome resolver bodies exist: a `+0xb0` census (77 literal
  sites) shows only `0x8ee1b0` ever installed there ⇒ **I24 ⑤ is the
  remaining read**, plus the record/string/RTTI residuals I24 ①–④.
- P4: the level-inpainting rock edges = seed-independent — likely the
  "always same every seed" ⇒ a NON-RNG deterministic painter (bounded
  ray-walks like the finalize family or the 0xe6d50 erosion painter).
  Candidate next read: the TRUE 0xd3a403/0xcee0cf wrapper family names
  (C5's "eliminated as anchor but names unknown" row) — those sit in the
  Update-frame record area where edge painters would live.

Legend: [ ] open · [x] fixed · (A) = approximation to replace by
reconstruction · priority HIGH/MED/LOW, user-weighted.

### 1. Surface band (top, sky → hills) — "not figured out yet"
- [ ] **I1. Surface generation missing entirely** (HIGH): holy mountain
  (surface), giant tree, watchtower, desert sand shapes, pyramid (partial),
  ice lands (west) all missing or noise. Root cause: template/procedural
  biomes (hills.lua, winter, desert, lake, mountain*) use the game's
  **poro noise terrain** (mGradient/mInsidePerlin* XML params) which we have
  NOT reconstructed — current banded fBm fills are (A). Need the Ghidra
  reconstruction of the procedural-terrain noise (which poro function, which
  params, seeded how) — see ghidra-ledger `mSeed`/per-cell generator objects
  (FUN_0090ce20 → FUN_008f9470, float grid + u16 material grid).
- [ ] **I2. Pyramid partial** (MED): part of I1 (its static template pieces
  render, the noise terrain around/behind it doesn't).

### 2. The Work — heaven (top extension band)
- [ ] **I3. Top extension entirely incorrect** (HIGH): we render void + wall
  columns (A). The real band has its own generation (the_sky wang area +
  procedural walls + moon spawn). Same reconstruction need as I1 + the_sky
  atlas art (which we have) with correct finalize.
- [ ] **I4. Moon + no-spawn zones** (MED, anchor): register the moon as a
  predictible-static-anchor. NOTE 2026-09-17: the moon's ART now lands via
  the `SPLICE_PNGS` blit (moon.png @ world (0,−26112); dark moon @
  (0,37512)) — review whether any I4/I7 work remains beyond what the
  spliced-scene render already provides. It remains a seed-independent
  anchor; use it to align/validate the heaven band.

### 3. The Work — hell (bottom extension band)
- [ ] **I5. Lava band must be PURE lava** (HIGH): our render shows
  lava/rock mixtures in the sea band; the ref shows solid orange. Fix the
  lava-sea predicate (currently `y+512 <= 14600`, (A)).
- [ ] **I6. Walls must be sinusoidal, not straight** (HIGH): the game's
  solid walls/hell-rock matrix follow noise (perlin displacement); our
  fills are flat per-chunk rectangles (A). Also user note: solid-rock walls
  should appear **everywhere** on the map (they currently only spawn below
  the lava layer — an artifact of the last prompt's painter scope).
- [ ] **I7. Dark moon + no-spawn zones** (MED, anchor): same as I4 for hell.

### 4. Main band defects
- [x] **I8. West lake renders as dirt, should be water** (HIGH): lake biome
  (template, water.png atlas area + lake.lua) — currently the hasPath
  fallback (last candidate) or the fill paint it as land. Investigate
  lake.lua composition + water material fill.
  **FIXED 2026-09-17** (`lib/colorize.mjs`): root cause was not the fill
  fallback — `lake_deep` is a **single-material biome**
  (lake_deep.xml: `water`, min -1.0 / max 10.5), so the game fills the
  atlas's white/grey placeholder art with the biome's material instead of
  the generic soil/sand/rock mix. colorize now detects
  `materials.length === 1 && !rare` and shades the grey ramp with that
  material's shade (water). Regression test `bench.test.mjs` "I8" asserts
  majority-water shades; cache bumped r3b → r3c.
- [ ] **I9. Yomi (adventure boss area) not loaded — noise** (HIGH): biome
  not in our generated set or unsupported atlas; identify its biome entry,
  atlas type, and generation path.
  **DIAGNOSED 2026-09-17 (corrected):** "Yomi" = the **boss_arena** region
  (`boss_arena.xml`, biome-map px 38–42 × 38–40 = world cx 3..7, cy 24..26;
  capture-confirmed: golden brick + shop + dark arena + bridge —
  `mapgen/out/ref-bossarena/` ref_40_38/40_39). Content class:
  **PREDICTABLE ZONE** (already in `mapcap/PREDICTABLE_ZONES.md`:
  `boss_arena(_top)`) — the 24 `PixelScene` entries of
  `data/biome_impl/spliced/boss_arena.xml` are placed at FIXED absolute
  world positions (pos_x 1536..4096, pos_y 12288..13824, constants in the
  XML), like the giant tree, mountains and the moon. Seed-independent
  static content ⇒ our renderer can blit it directly from the game's own
  scene data; no seed-mechanism involved. (Same family: tree, mountains,
  HM bands, moon — cf. template biomes already handled.)
  Implementation gap: `template-render.mjs` renders this biome as generic
  procedural noise because the spliced-scene loader is deferred.
  **STRUCTURALLY FIXED 2026-09-17** (`lib/template-render.mjs`
  `SPLICE_PNGS` / `blitSplicedScenes`): the splice tool
  (`biome_impl/spliced/_*.bat`: `wizard_physics.exe -splice_pixel_scene
  <name>.png -x <wx> -y <wy>`) proves every scene's source art is ONE
  pre-colored PNG (the splice output N.plz/N_visual.plz pieces are merely
  512-splits of it, placed at the SAME fixed origin). So the renderer
  blits each source PNG at its origin and maps palette colors through
  materials.xml like the rest of the pipeline (air/alpha → below shows;
  unmatched palette colors drawn raw). Zones covered in one go:
  boss_arena (1536,12288), giant tree (−2048,−1324), moon (0,−26112),
  dark moon (0,37512), skull (14645,18395), watercave (−2048,0),
  lake_statue (−14848,0), lavalake2 (2048,0), gourd_room (−16896,−7168),
  mountain_lake (2560,0), lavalake_pit_bottom (2560,3072).
  Validated vs capture (ref-bossarena, seed 78633191): arena shapes land
  pixel-exact (bridge/stalactites/lava lake); 40.8% of ref fg within
  ±20 per channel — residual = material TEXTURE detail (rock_hard
  speckle/tint), the same shade-approximation class as the rest of the
  colorize layer, tracked under the generic texture refinement, not I9's
  structure. Cache r3c → r3d.
  Per-scene art lives in: material `N.plz`, visual `N_visual.plz`,
  background `N_background.png` (plain PNG for the background).
  `.plz` facts (verified this session, keep minimal — no decoder claims):
  - header: `u32 1 | i32 w (signed; negative = mirrored) | u32 h | u32 4 |
    u32 compLen | u32 rawSize = |w|·h·4` + 4-byte trailer (holds on all
    97 plz files).
  - payload = Nollagames' own LZ from `pixel_scene_splicer.cpp`
    (`noita_dev.exe`); compressor read end-to-end (`FUN_004225f0` /
    `FUN_00422b50`), decoder `FUN_00421e80`/`FUN_004223a0` via dispatcher
    `FUN_00422e20` — decode semantics not yet reproduced by us. Page kept
    SHORT deliberately: earlier session notes overclaimed decode
    semantics from partial compressor reads; treat everything below as
    evidence, not fact.
  - Dumps: `~/work/ghidra-logs/plz_{root,lvl,sub,vb,final,dec,compressor}*.c`.
  - NEXT: restate I9 as a predetermined-zone render job (scene positions
    from `boss_arena.xml`, art from scenes/vis/background); decode the
    plz only for the VISUAL layer if needed.
- [ ] **I10. Holy Mountain right side of shop = noise** (MED): template
  scene blit covers left part; right side likely another scene/piece
  (shop_second_row / altar_right pieces) not ported.
- [ ] **I11. Portal to Holy Mountains = noise** (MED): missing element/
  scene (portal template pieces).
- [ ] **I12. Teleportatium ball below HM = noise** (MED): missing element —
  supports the "we don't render every element" theory; likely a pixel scene
  or material blob placed by lua.
- [ ] **I13. Black boxes in level 1** (MED): tiles not processed — the known
  vertical-domino teal-pool tank issue (water-pool v-tiles render empty) +
  possibly unsupported atlas areas; enumerate exact chunks.
- [ ] **I14. HM has good resolution, rest is coarse** (LOW for now, user:
  fix shapes first): expected — HM is a pixel scene (art), the rest is
  noise-filled wang; will converge as I1 lands.
- [x] **I15. Missing elements inventory** (HIGH, enabler): build a
  systematic inventory of game elements/materials/scenes per biome from
  data/scripts/biomes/*.lua + _pixel_scenes.xml + wang_scripts.csv, and
  tick off which ones we render. Answer "which element produced this
  anomaly" questions by lookup, not guesswork.
  **DONE 2026-09-17** (`mapgen/experiments/2026-09-17-element-inventory.mjs`
  → `mapgen/out/inventory.md`): parses every `data/biome/*.xml` (146) +
  its lua script, extracts RegisterSpawnFunction colors, pixel-scene
  tables (g_* material_file entries), entity refs and wang trigger colors,
  and classifies each element class vs our pipeline:
  RENDERED=27 (pixel-scene loaders), AIR-HOLE=6 (structure loaders +
  spawn_lamp — trigger consumed, nothing drawn), PARTIAL=752 (entity
  spawners, custom fns — not ported). Verdict rule: entity spawners are
  invisible by design (no static art), so the map-affecting gap list =
  custom lua fns (vines/fungi/improved parallax) + unported pixel-scene
  loaders (load_pixel_scene3/4/5 handled, others vary per biome).

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

- **isCoalMine / shouldBlockOutRooms selection is UNDETERMINED in-binary**
  (audit of `lib/biomes.mjs` name-list flags, tagged `@prov noitool`):
  - Fact-check result: `<BitmapCaves>` appears in 59 biome XMLs; the
    `do_beginning_paths`/`do_beginning_down` attributes exist ONLY in
    desert.xml:48, forest.xml:37, hills.xml:41-42, hills2.xml:36,
    hills_flat.xml:40-41, mountain_right_stub.xml:44-45,
    mountain_tree.xml:47 (grep, extracted data) — **coalmine.xml carries
    NO do_beginning attributes** (its `<BitmapCaves>` = plain
    structures). Corrects the SESSION_CONTEXT F2-dig #4 phrasing that
    implied the coalmine hax is selected by those flags.
  - Consequence: how the binary decides "this biome gets the coalmine
    fallback/hax path" is an OPEN read target (queue under F2, before
    trusting isCoalMine beyond coalmine/excavationsite fixtures).
  - Constant placeholders elsewhere verified clean: has-path C3/C4
    constants (binary-derived), coords.mjs legacy mode = label only,
    wang-js seqAttempt = regression twin only. The only LIVE noitool
    artifacts: lib/wang-wasm.mjs's wasm (bench + legacy tests) and the
    start_x=0x8e constant (both tagged, listed as debt).

### 6. Bench pipeline coverage
- [ ] **I17. Bench wang-layer script skips all template biomes** (LOW,
  registered 2026-09-19 after user sanity check): `2-generate.mjs`
  (`npm run bench:gen`) used to CRASH on the first template biome in the
  window (`templateFile` undefined); now it records them in the manifest as
  `{ biome, template: true }` and emits no PNG — so `3-compare.mjs`
  scores wang chunks only. Affected default-window biomes: winter,
  _EMPTY_/mountain_tree, desert, orbroom, holymountain. This is CORRECT
  scope for the bench (it measures the wang layer), but it means:
  (a) bench reports cannot validate template-biome rendering — that
  validation lives in the genmap pipeline (`template-render.mjs`;
  captured tiles). (b) The underlying knowledge gaps are the existing
  open issues: poro-noise procedural terrain = **I1** (Ghidra RE, not yet
  done), static spliced scenes = I9-family (partially rendered),
  HM band template pieces = I10/I11. No new RE target; close this issue
  when I1-family lands and 2-generate can be pointed at the full
  pipeline if wanted (e.g. a `--template` flag delegating to
  template-render.mjs).

### 7. Registry/doc defects

- [x] **I18. CONSTANTS C33's stated true VA `0x8f4830` was +0x800
  short** (opened + closed 2026-09-22, dig #85): C13's formula gives
  slab 0x4f4830 + 0x400800 = **`0x8F5030`** — the fn C54/VERIFIED
  already cite as the consumer. Byte-checked: real prologue at
  0x8F5030, `0x8f4830` decodes mid-instruction, and C33's own
  internals (0x4f4919/0x4f4960/0x4f4f3b) map into 0x8F5030..0x8F5754
  only with +0x400800; `0x8f4830` = slab + 0x400000. Fixed in
  CONSTANTS C33 (index row + section heading) and VERIFIED:297; the
  (19)-era ABOUT_MATH mentions keep their historical text
  (append-only — corrected by entry (85)). Source: ABOUT_MATH §6 (85).

- [x] **I19. Dig-#85/86 doc defects: ③ identity misread + phantom
  carry-over byte facts** (opened + closed 2026-09-22, dig #86):
  (85)'s §6/C62 read the lane arithmetic "owner = P − 0x9c" as
  **instance** identity (⇒ the failed "predicted +0xf4" for C34's
  +0x1e0), and the handover carried three nonexistent/ wrong byte
  facts — `call 0x8ed180` (0 hits exe-wide), `movl $0x132b518,
  0x38(%esi)` (real: `mov $0x132b518,%ecx` ×4 + `movl $0x132b518,
  0x1d4(%eax)` @0x8f388f), "wang-fill @0x8ee5bd" (inside
  `mov 0x114a37c,%esi` IAT load; nearby `add $0x76c,%eax` =
  year+1900 log). Fixed in C65 (phantom do-not-cite list), C62
  (OPEN → RESOLVED pointer), VERIFIED §8 row 25; (85)-era text keeps
  its historical form (append-only — corrected by entry (86)).
  Source: ABOUT_MATH §6 (86).

- [x] **I20. The default arm's body (true 0x8fb570) — READ (104); the
  port still throws for the LIVE world value `mGradientAddNoise="0"`**
  (opened 2026-09-23, dig #98; **CLOSED 2026-10-06, dig #113**): after the switch's `dec/je` 1/2/3 miss,
  the default arm @**0x90ab7d** is reached by live XMLs — hills_flat +
  mountain_lake (P1) and laboratory carry `mGradientAddNoise="0"` — and
  the binary runs `call 0x8fb570` @**0x90ab9f** → g = a·0.05+0.05 f32
  chain → `call 0x8fca60` (simplex2d) @**0x90abee** → the shared tail →
  `jmp 0x90b0a2`. ① ~~the read item: 0x8fb570's body~~ ✅ **READ +
  byte-closed 2026-09-28 (104) — CONSTANTS C83:** the lattice IS
  whiteLattice2d's (c0 = 57·round(y)+round(x), floor fracs, corners
  h(k)=frac(sin(c0+k)·43758.546875) k∈{0,1,57,58}, the same
  sin/round helpers) **[(113): c0 = 57·floor(y)+floor(x) — 0x44d0b0 =
  the FLOOR wrapper, C92; the helpers = floor + libm sin]**; the
  differentiator = **PARITY-alternating blend
  weights** W = lerp(w0,w1,frac) with (w0,w1) = (smoothstep,linear)
  vs (linear,smoothstep) by round-cell parity **[(113): floor-cell
  parity]**, then plain bilinear
  out = lerp(lerp(h0,h1,Wx), lerp(h57,h58,Wx), Wy). Until ② lands,
  OUR surfaceField port THROWS for
  addNoise ∉ {1,2,3} (the message byte-pins the switch facts) instead of
  producing the blend; the default (classify) render is unaffected, and
  the SURFACE_V2 surfaceField lane cannot render those chunks. ② next:
  **port the arm** (the read is done), re-pin the tail for that lane.
  **② ✅ PORTED 2026-10-06 (113):** `parityLattice2d` = 0x8fb570's
  body (rx/ry = floor, the `and 0x80000001` parity on the floor
  values, Wx/Wy + the shared corner/lerp chain) + the `surfaceField`
  else-arm replacing the throw: `a = parityLattice2d(x·0.025,y·0.025)`
  @0x90ab7d..9f → `g = f(a·0.05+0.05)` @0x90abae..bb → `n =
  simplex2d(x·0.5·0.02·g, y·0.5·0.02·g)` @0x90abb6..abee **using the
  f32 slot [0x11df908] = K2.h02, NOT case-1's f64_002 [0x11dfc70]** →
  `r2 = f(n·rp)` @0x90abfb → C77 tail @0x90ac07..17 → `jmp 0x90b0a2`
  @0x90ac1b; live addNoise 0 + stale 4 both compute (test pin
  `toBeCloseTo 7` + a whiteLattice-substituted sensitivity
  >1e-3 lattice / >1e-5 output). Source: ABOUT_MATH §6 (98); CONSTANTS
  C77; §6 (104), C83; §6 (113), C92.

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

- [x] **I22. The ported `whiteLattice2d` (true 0x8fb350) inverts all
  three blend endpoints — every live surface lane renders the
  cell-mirrored lattice** (opened 2026-10-02, dig #112; **CLOSED
  2026-10-06, dig #113 — the three endpoint pairs swapped, byte-pinned
  test added; also fixed the round→floor cell, C92**): the (104)④
  side-by-side byte-read the function's whole body
  (`/tmp/opencode/fulltext86.asm` + the port's own evidence file
  `/tmp/opencode/case1core.asm`, byte-identical) — every blend in the
  binary is the idiom **`(A−B)·t + B` ⇒ t=0 selects B**: y+1 row
  `(h58−h57)·wx + h57` @0x8fb4b7..4c9, y row `(h1−h0)·wx + h0`
  @0x8fb548..55a, out `(rowY1−rowY0)·wy + rowY0` @0x8fb55e..567
  ⇒ the binary = standard orientation
  `lerp(lerp(h0,h1,wx), lerp(h57,h58,wx), wy)` — structurally
  identical to 0x8fb570's C83 law (the parity weight mix is the only
  difference; the tails are byte-identical: 0x8fb546..567 ≡
  0x8fb818..839). `mapgen/lib/noise-proto.mjs:183-186` instead defines
  `lerp(a,b,t) = (b−a)·t + a` (t=0 ⇒ the FIRST arg) and calls it
  (h58,h57) / (h1,h0) / (rowY1,rowY0) ⇒ **port(wx,wy) =
  binary(1−wx, 1−wy) on the same c0** — the per-cell mirrored lattice
  keeping the near-corner c0, which is NOT any evaluation of the
  binary (a true mirror would flip round(x)/round(y) ⇒ c0 shifts by
  57·Δy+Δx; **(113): floor(x)/floor(y) — same argument**). Numeric (`/tmp/opencode/sidebyside-112.mjs`, 5 points):
  port ≡ weight-complemented parse ≤1e-6 everywhere; port − byte-
  literal = 0.34..0.97 — (12.5,−3.25): port **0.833995283** (= (26)'s
  smoke pin 0.834, ABOUT_MATH:2940) vs byte-literal **0.493832439**;
  integer (3,5): port 0.907893717 = h58 vs binary 0.371890724 = h0.
  **[(113): the byte-literal 0.493832439 = the ROUND cell — stale;
  with 0x44d0b0 = floor (C92) the true byte-literal = 0.898207068;
  floor+endpoint-inverted = 0.723673105; the pre-fix port 0.833995283
  = round+inverted ✓]**
  Impact — `call 0x8fb350` @0x90b00d (addNoise=1), @0x90aef9
  (addNoise=2), @0x90ae25 (addNoise=3), @0x8fd93e (NOISE_TYPE
  dispatch): ALL THREE live surface lanes + the dispatch lane hit the
  flipped port; VERIFIED's CASE-1 LANE CLOSED row keeps its literal
  claims (computes + real texture) — the in-row fidelity caveat is
  the pointer. Fix = swap the three endpoint pairs, register-backed
  with a byte-pinned test pin (candidate: `whiteLattice2d(12.5,−3.25)`
  → 0.493832439), IoU after — NOT yet applied. **[(113) FIX APPLIED:
  the pairs swapped in `whiteLattice2d` (`rowY1 = lerp(h57,h58,wx)`,
  `rowY0 = lerp(h0,h1,wx)`, `out = lerp(rowY0,rowY1,wy)`), the cell
  corrected to floor at the same time (C92), and the pin landed
  re-based to the floor literal → `toBeCloseTo(0.898207068, 6)` with
  discriminators excluding the round cell (>0.3) and the endpoint flip
  (>0.1), plus the integer-cell h0 pin 0.371890724 for BOTH lattices —
  `tests/mapgen/surface-census.test.mjs`, the new "lattice byte pins"
  describe; port ≡ asm-literal ≤1.19e-7 at all 5 side-by-side points
  (`/tmp/opencode/sidebyside-112.mjs` re-run). IoU EXECUTED
  2026-10-06 (dig #114): meanAbs 88.76 → 89.58 — the frame/pairing fix
  did NOT move the gate metric (byte fidelity ≠ shape fidelity); the
  verdict lands in I21's Verdict block + §8 row 34, not here.]** Dispatch twin (0x8fb950
  = (26)'s mislabeled 0x8fc550) is NOT in any surface lane → out of
  scope. Source: ABOUT_MATH §6 (112); CONSTANTS C91; §6 (26)/(104),
  C40/C83.

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
  field/classify CONTENT = the fnB band-stack read (**I25**) — plus
  the OPEN dyOpt −12 = L3-anchor-y observation (I21-adjacent).
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

- [ ] **I25. BitmapCaves grid indexing — u-law vs cell index (opened
  2026-10-09, dig #117).** The port feeds the caves field through
  `surfaceField`'s ONE `gradAt` slot, so after dig #117's ×0.1 it is
  indexed by the byte-law `u = 0.049162514·px + 0.1a` (C95/C96) —
  i.e. the P1 surface band reads only the field's **top ~26 rows** at
  bty14 (+25.17 rows per bty step), while the pre-patch window
  sprawled rows 2..253. Whether the GAME's caves consumer indexes the
  512×256 grid the same way is **still unread**: the cell-loop's own
  frame would index it by CELL (0..511 px/chunk), not by u. The two
  readings put the surface band on completely different field rows ⇒
  the surface shape for the whole BitmapCaves family (hills/desert/
  pyramid/winter/mountain_tree…) hangs on this.
  - **Placement half: DONE (read) dig #119** — entry (119) byte-verifies
    the fnB phases that the "still a model" sentence referred to: the
    port's `buildCavesField` composition (uniform blobStamp, single-
    point L2/L3 raises) is retired as a description of the bytes —
    mountain = top-band vertical runs (X = rollPos(5,w−5), base =
    ⌊0.1h·u⌋, Y_end = base+⌊11u⌋+15 → base on a 20% coin, R grows
    +0.5(u+1)/row with no cap, v = 1.5 decaying ×(0.97+0.03u) on 50%
    of rows), blob = uniform x ∈ [5,w−5] × **y ∈ [25,h−5]** (no cap),
    L2 = exactly 2 passes × count 120+⌊81u⌋ snaking setter-chains from
    y = 0, L3 = 1 pass × same count (gated by config[+0x31]) from a
    C-rand band — all via setter 0x8EE750 flag=0; the 5%-gated
    spawn_small_enemies/spawn_items scatter (0x8EEAD0, xmm3 = 1.0) is
    a gameplay side-lane with no field write (interpretation flagged).
  - **Remaining:** (i) the port itself — fold those laws into
    `buildCavesField` (+ the `stampBlendLerp` t² reconciliation: bytes
    use t = (R²−d²)/R² squared, plain bounds checks, min-guard for
    R ≤ 1), measure with C97's `2026-10-10-surface-shape-iou.mjs` A/B,
    then the cache-bump decision (next dig); (ii) this issue's OWN
    subject — the index half: the kind-1/kind≥2 arms 0x908fbc..0x909370
    plus the sampler gate (u-law vs cell index) — still unread;
    (iii) y-drift (I24/queue #2) deferred pending the fnA window read.
  - **Data-side shortcut: dead as observed** — `Noita/temptemp/`
    contains only `biome_map_lua.png` + `worldtree_saved.png` (no
    DEBUG output image; re-checked dig #119), so a true-layout view
    would need `DEBUG_output_image` enabled in data.wak's biome XMLs —
    open, LOW priority.
  **Gate (updated):** index half read + the port landed (placement
  read complete). Sources: entries (117), (119), C96, C98,
  `/tmp/opencode/dig117-probe3.mjs`.

## Strategy (agreed)

1. Keep the verified wang core (prediction-solved, oracle-validated).
2. For each issue: identify the game's actual mechanism (Ghidra function or
   game-data script) → reconstruct → validate vs capture → check the box.
3. Approximations (A) are debt: each is tagged and gets replaced, never tuned.
4. Predictable spawns (moon, dark moon, HM bands) = free alignment/anchors.
5. Maintain this registry + SESSION_CONTEXT handover; request a new session
   when context degrades.
