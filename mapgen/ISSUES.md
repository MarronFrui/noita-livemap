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
  ~~unmatched palette colors drawn raw~~ — **PROVEN WRONG dig #168: a
  non-materials.xml color = a MISS = the cell is SKIPPED, the terrain
  below shows — 404/404 samples, C143 / §8 row 54**). Zones covered in one go:
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
  `.plz` facts (**REPRODUCED dig #168 — full-window byte law, C143,
  MANIFEST X137/X138/X139, `mapgen/lib/plz.mjs`; the earlier
  "no decoder claims" caution below is RETIRED — the codec now decodes
  97/97 shipped files length-exact with two content pins**):
  - header: `u32 1 | u32 w | u32 h | u32 bpp | u32 compLen | u32 rawLen`
    (24 B; fields loaded raw — the loader's dims check is UNSIGNED
    ≤ 0x10000 ⇒ the 5 negative-dim files [gourd_room/6-8, lavalake2/23-24,
    w = h = −511 / −511,−343, XML-referenced] are REFUSED in-game; our
    decoder ignores w/h). `rawLen == |w|·|h|·4` 97/97; file = 24+compLen
    EXACTLY 97/97 — **the old "+4-byte trailer" and "i32 w = mirrored on
    load" claims = wrong (§8 row 54's family; the loader does no abs/mirror)**.
  - payload = Nollagames' own LZ: loader raw gate @0x90E644 (rawLen < 128
    ⇒ verbatim copy, no decode — the shipped lavalake2/4.plz), else the
    dispatcher 0x423220 (level = payload[0]>>5 + 1 → L1 0x422980 /
    L2 0x423010); both level decoders byte-closed (X139) and ported.
  - Dumps: `mapgen/extractions/dig168-plz-loader-90e220-90e676.asm`, `mapgen/extractions/dig168-plz-dispatch-423220-423260.asm`, `mapgen/extractions/dig168-plz-l1-422980-422b4c.asm`, `mapgen/extractions/dig168-plz-l2-423010-42321b.asm`.
  - NEXT (moved to I39/I40): the visual layers (`*_visual.plz`) are not
    applied; the floor the art wraps into = the I39 fill-spawn read.
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

- [x] **I25. BitmapCaves grid indexing — u-law vs cell index (opened
  2026-10-09, dig #117; RESOLVED dig #121).** The port feeds the caves field through
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
  - **Port: DONE dig #120** — entry (120) folds all of the above into
    `buildCavesField` (`CAVES_FIELD_VER` v5): loop B top-band runs, the
    blob y-FIRST stamps with **strength = [+0x6c]/[+0x70] / radius =
    [+0x74]/[+0x78] (C50 OVERTURNED**, §8 row 40; the min(20) cap +
    strengthA/B knobs gone), the L2 2-pass + L3 do_beginning_down
    chains through the settled **lower-only** setter law (`setterStamp`:
    value ≤ 1 → single-cell min-guard; value > 1 → circle, target =
    1+t·(scale−1), t = (value²−d²)/value²; the flag gates only the y<25
    eave — C46 closed, C99), and the t² blend (t = (R²−d²)/R², w = t²,
    the R ≤ 1 min-guard arm). C97 A/B after the port: iou v2 0.23391
    (lane-identical — expected, it doesn't consume the caves field) /
    v2v3 0.25183 → **0.25393** / v3 0.24644 → **0.24708**; **no cache
    bump** (caves lane opt-in via SURFACE_V3; the default render
    untouched). Tests 263/263 — the y224 byte bar HOLDS (the new loop C
    could have threatened x0..11 at y224; this seed's stamps miss,
    deterministic).
  - **Index half: DONE dig #121 — CELL, not u-law.** The game's caves
    consumer = the sampler 0x90d860's field read @0x90dba5..0x90dbd0:
    idx = `[owner+0x9c]·y + x` (row-major CELL; OUTER = y proven by the
    world-compute @0x90dbed feeding xmm3/y from the OUTER counter),
    getter `0x9499f0` on `&owner+0xb4`, gate `comiss 0x11dfa94 (0.5) →
    jbe 0x90e02b` — and the writer 0x8EE750 uses the SAME law
    (@0x8ee79e `W·y + x`, same getter/layout — reader/writer closure).
    The u-law belongs to surfaceField's kind-0 grad chain only; the
    kind-1 (bitmap_data mod-wrap RGB arm) / kind-2 (warp → P → variant
    `[P+0x23c]` ∈ {1,2,else} → 0x8facd0/0x8faae0/0x8fa9b0 → comiss 0.5)
    arms never touch the float field (entry (121), C100). **Port fixed:**
    the caves-lane gate value = the DIRECT cell read (`gradAt(wx, wy)`,
    not `surfaceField(...)` — V3 chain + V2 loop; the test mirror
    patched in lockstep) ⇒ C97 shape IoU **v3 0.24708 → 0.46464, v2v3
    0.25393 → 0.46557**, v2 bit-identical; fG 0.162 → 0.840 exposes the
    uncarved 1.0 base = I26's signature. Tests 263/263; no cache bump
    (caves lane opt-in).
  - **Remaining:** (i) the join/mapping residuals moved to the new
    **I27** (fnB's buffer ↔ the sampler's `owner+0xb4` slot wiring is
    inferential; the port's mod-wrap tile repeat vs the game's caller-
    managed window origins unread); (ii) y-drift (I24/queue #2) deferred
    pending the fnA window read; (iii) **I26** — the walk/record
    writer-model reconciliation (carveCircle's dir="max" + the (43)(a) t
    vs the now-settled setter/blend laws) — now the DOMINANT blocker
    for the BitmapCaves shape (the fG 0.84 over-fill).
  - **Data-side shortcut: dead as observed** — `Noita/temptemp/`
    contains only `biome_map_lua.png` + `worldtree_saved.png` (no
    DEBUG output image; re-checked dig #119), so a true-layout view
    would need `DEBUG_output_image` enabled in data.wak's biome XMLs —
    open, LOW priority.
  **Gate: CLOSED (both halves — placement dig #119/#120, index dig
  #121).** Sources: entries (117), (119), (120), (121), C96, C98, C99,
  C100, `/tmp/opencode/dig117-probe3.mjs`.

- [x] **I26. The walk/record writer-model reconciliation (opened
  2026-10-10, dig #120; CLOSED dig #122).** Dig #120 settled the 0x8EE750 setter's
  internals (both flags LOWER-only; the flag gates only the y<25 eave —
  C99) and the blend's t² law, and ported L2/L3 onto a faithful
  `setterStamp`. The fnA WALK (@0x8ef37c pushes flag=1) and the
  CaveStructure record float stamps still go through `carveCircle`,
  whose model predates those reads: dir="max" (a raise-only write the
  byte setter never does) and the t law `t=(R−d)/R` + the flag-1 eave
  `q⁸·v+1` (byte shape: `1 + q⁸·(target−1)` — same branch shape, so
  that part is cosmetic). Resolving needs: (i) the walk's CALL-SITE
  read @0x8ef300..0x8ef37c — which value/scale xmm2/xmm3 the walk
  pushes (its carveCircle args are currently shape-mapped, not
  byte-proven); (ii) the record float-stamp engine identity (0x8EF950's
  float twin for the record lane — the byte-grid writer is settled, the
  float lane is not). Expected impact: under dir="max" the walk is
  near-no-op on the 1.0 base (v ≤ 1 never beats an existing 1.0);
  switching it to the min-guard/circle law would make the walk the
  dominant CARVE lane — the biggest known-wrong-but-kept piece left in
  `caves-field.mjs` (FLAGGED in the walkChain comment). Sources:
  entry (120), C99, caves-field.mjs.
  **CLOSED dig #122 (entry (122), C101, §8 row 42):** both needs
  resolved byte-exact. (i) The walk's call-site @0x8ef37c = the setter
  0x8EE750 with VALUE = `[−0x20]` = the 3-segment radius envelope
  (prologue re-pinned: `s = (2−trunc(−4u))/5`, `rA = rD = s·0.2u`,
  `rB = rC = s·(1+2.5u)`), SCALE = clamp01(slot″), flag = 1 ⇒ the walk
  **CARVES** (SCALE ≤ 1 + the lower-only guard); the flag=1 eave =
  circle arm only, on the stamp CENTER y (the point `[edi+4]`), q =
  y/25 (NO −1 — C99 corrected in place). (ii) The record's float
  engine = FUN_008EF870, a two-sided template lerp `cell += (v −
  cell)·temp.cell` (the port's old dir="max" no-oped the v<1 carve =
  the (121) fG 0.840 over-fill); the byte lane = FUN_008EF950's gated
  stencil copy. Port: `setterStamp` flag/eave, walkChain →
  `setterStamp(...,1)`, `stampLerpTemplate`, `caveRecordStamp` → the
  lerp; `carveCircle` = LEGACY (export kept). C97: v2 bit-identical
  (no cache bump), v3 fG 0.840 → 0.71506 (vs fR 0.48029), IoU
  0.46464 → 0.45278 (the residual = the registration/model gap, not
  the writer law). Residual spawned: **I28** (the template fill
  engine). Sources: entry (122), C101.

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

- [x] **I28.** … **[THE DIG-#162 OVERTURN — the "draws-only, the engines no-op on the ctor-empty template" verdict = TRUE ONLY PRE-IMAGE-DECODE: the record lane's template = filled by the records' `image_file` decode (the CaveStructure images), the stencil (the fn950) then copies the template's nonzero bytes into the BYTE PLANE ([P+0x58]) = the sampler's FIRST gate (0 = air) = **the caves' shape = the image files** (C136, X126/X127). The port's record lane never decodes the images ⇒ the byte plane = all-zero ⇒ the sampler skips every cell ⇒ the 1.0-base field shows = the ~90–100% solid caves band = the measured defect. THE FIX = the image decode port (the #163): the image_file PNGs → the template → the stencil → the byte plane.]** The record-stamp template fill engine (opened 2026-10-10,
  dig #122).** I26's closure settled the record phase's two ENGINES
  (FUN_008EF870's two-sided float lerp `cell += (v − cell)·temp.cell`
  + FUN_008EF950's gated stencil byte copy — entry (122), C101) but
  also exposed what feeds them: the per-stamp template (ctor 0x8F9470,
  seeded from the count draw, `[+0x94]` = u·200000 − 100000) is
  ctor'd EMPTY — the ctor zero-inits every container block
  (@0x8f9481..0x8f94c8) and NOTHING in the record window fills it
  before fn950 runs (only ctor/fn950/dtor touch `(−0xfc)`; the
  0x668400 call = a log/string op) ⇒ on a fresh template `[temp+4] =
  0` makes the float loops no-op and `[temp+0x5c] = 0` skips the byte
  lane. So the record phase's stamp SHAPE (the template's grid0
  weights + grid1 stencil pattern — what makes the two engines
  non-trivial) is built ELSEWHERE or by a mechanism outside the walked
  window. Resolve needs: (a) the template fill code (search the wider
  builder for stores into the temp's container slots + the `[+0x94]`
  size's consumer), (b) the `[+0x94] = u·200000 − 100000` semantics
  (a size? an offset? its 1e5-scale range is unexplained), (c) the
  template's grid0/grid1 init (who allocates the two f32/byte planes).
  Port stand-in meanwhile: the (43)(a) linear t as the weight + the
  R = max(1, trunc(v·4)) circle as the radius + the single-cell byte
  mark (the stampLerpTemplate comment). Expected impact: MEDIUM — the
  record lane is the C48 bump carrier (the 1.45..1.55 strengths);
  with the lerp now carving for v<1 the template's shape decides
  where the carve/raise lands, so the fG/IoU residual (0.715 vs fR
  0.480) partly routes here. Sources: entry (122), C101(d),
  VERIFIED §8 row 42.
  **CLOSED dig #123 (entry (123), C102, §8 row 43):** there is NO fill
  engine for the frame-local template — it stays empty and BOTH
  engines no-op ⇒ the record lane writes NOTHING (its only effect =
  the prng draws). (a) The windowed slot census @0x8f11b3..0x8f1746:
  the temp's only addresses = the 3 `lea −0xfc` sites (ctor/fn950/
  dtor) + the lua-cache handle at `[−0x48]` (assigned then released,
  never read); the temp is frame-local ⇒ nothing outside fnB can
  address it. fn870's dims gate (`cmp [temp+4],0; jle 0x8ef940`
  @0x8ef888b) and fn950's stencil skip (`cmpl $0,0x5c(%ebx); je
  0x8efa2d` @0x8ef977 → the epilogue) then make both engines no-ops on
  the fresh template. (b) `[+0x94] = u·200000 − 100000` = the ctor's
  STACK-LOCAL Random draw (`lea 0x8(%esp)` → `0x10098c0` ×2 @0x8f958d/
  0x8f9596), seeded by the ctor arg trunc(u·(2³¹−1)) — it never
  touches the stream and lands on a temp nothing reads ⇒ **inert**;
  the size/offset semantics belong to the sibling FACTORY objects'
  lane (I27 — stays open). (c) grid0/grid1 = the ctor's vector
  zero-init (no allocator runs) ⇒ dims 0 ⇒ both engines' bounds fail
  before any cell access. The draw law landed as C102: count =
  count_min + trunc(u·span) — **up from min** (C51's down-from-max
  corrected in place; ≤0 skips the record), per stamp = ctor-seed +
  the 0x668400 resolver (1 draw per well-formed `$[lo-hi]` group; XML
  census 94 plain / 8 grouped of 102) + X + Y + strength = 4–5 stream
  draws, values discarded. Port: `caveRecordStamp` = the draws-only
  `(rec, prng)`; `rollNeg` + the stamp call removed;
  `stampLerpTemplate` = LEGACY (the engine reference for I27). Impact
  revision: the MEDIUM assumed the records carried the C48 bump — the
  byte law says the bump comes from another raise-capable lane (loop
  B/C positions under the still-modelled walk draw budget, or I27's
  published objects; the ref's y0 bell x10..28 stays unexplained).
  C97 A/B: v2 0.23391 bit-identical (**no cache bump**), v3 IoU
  0.45278 → 0.45240 / fG 0.71506 → 0.71459 (vs fR 0.48029 — near
  mask-neutral: the removed winter/brush v<0.5 carves ≈ the
  stream-shifted L2/L3/scatter positions), v2v3 0.45557 → 0.45521 /
  fG 0.72327. Sources: entry (123), C102.

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

- [x] **I33. The kind-0 filler's r-site swap made NOISE/DEAD read AIR (opened audit #143, 2026-10-15; the regression commit = bbeeece / dig #142, flags-ON lane).** Origin (audit #143, E1 lane×commit matrix — artifacts `mapgen/out/noodle-{audit,maskcount}-*.json`): dig #142's deliberate r-site swap (noise-proto.mjs:848-849, `noiseDispatch(uid.noiseKind,x,y)` → `bandRampEval(uid.driver,uid,x,y)`; the old line left commented SUPERSEDED) evaluates the band ramp at the DRIVER's origin for every kind-0 noise read, so the kind-0 filler's noise texture collapses: lake 0.040–0.051 → 0.000, empty/solid_wall stubs 0.002–0.003 → 0.000 (NOISE→AIR), and the DEAD reads go null → 0 (lava/temple/boss_arena family → AIR). kind=-1 defs (solid_wall/lava/temple_wall — no `noise_type` attr) now throw `noiseDispatch: core kind=-1 UNREAD` at `insidePerlin` (noise-proto.mjs:552/:542 via surfaceField :856; at 98183fc they threw at the OLD r-site instead) — caught at noise-terrain.mjs:437/:567 → chunk null → DEAD at BOTH commits (template art covers them), so the kind=-1 arm is a cleanliness defect, not a pixel delta. The BitmapCaves caves-lane cells (desert/winter/hills) are identical at both commits (meanSolid 0.897–0.985) — out of scope. NOT to be confused with the flags-OFF BLACK, which is the §12 opt-in gate (noise-terrain.mjs:707, f55dfab) rendering `return null` → opaque black through world-gen.mjs:200-222 — by design, commit-invariant, and the actual cause of the user's "empty/black" report (their :8082 server ran without SURFACE_* env; `package.json` never carried the flags). **Fix plan (later session, green-lit):** (a) give `insidePerlin`/the r-site a kind=-1 default arm (byte-faithful: the core reads a default kind for defs without `noise_type`) so solid_wall/lava/temple_wall stop throwing; (b) restore the kind-0 noise texture law at the r-site (the driver-anchored flip is parked in I21 — the V2 canvas-px mixing note from dig #142 — so the fix must respect the frame law, not revert it blindly); (c) surface the §12 flags-OFF state to the operator (log line / genmap banner) so env loss is visible instead of manifesting as black chunks. Sources: ABOUT_MATH §6 (143); VERIFIED §12. **2026-10-15 addendum (the user's zoom report — CORRECTS the fix scope; METER-CLASS E1):** the kind=-1→5 default (item a) is **INSUFFICIENT alone**. (i) The reported black lives in the flags-ON lane too, in scattered noodle-band pockets = the kind=-1 structure biomes (`solid_wall_hidden_cavern`, `teleroom`, `friend_1/3/4`, temple/lava) with **NO `noise_type`** (XML-confirmed) → throw → DEAD → black, no template/bg behind. (ii) Forcing `noiseKind=5` routes them through the dig #142 r-site (`bandRampEval`, noise-proto.mjs:848-849) which **bypasses `noiseKind` and returns ~0** ⇒ all-AIR; real `noiseChunkMask` (seed 78633191): `empty.xml` = **0/2704 solids (0.0%)**, `mountain_lake.xml` = **0.0%** (C93's pre-#142 baseline was mean density 0.0183 = the sparse "noodles") ⇒ **the raw kind-0 FIELD mask at those cells is all-air post-#142** — **RETRACTED 2026-10-15, same day, on the user's live inspection (see I34): the inference that followed ("the noise when zoomed in = the background image through the empty lane") is WRONG — the surface/noodle chunks DO render generated pixels** (a per-biome-consistent pattern, confined to its chunk; the 0% number describes the RAW FIELD layer only and does not describe the composed output — a slice-for-whole over-claim, the third in audit #143's family; the composing lane is open, I34). Where no bg (the kind=-1 pockets) = black stands (measured). **The dominant regression is the r-site swap (item b), not the kind=-1 arm (item a).** (iii) The zoom-distance black = the same sparse content + the `renderTile` z>0 **strict-majority downsample** (`genmap-server.mjs:120`, `solid*2>=total`) collapsing any >50%-air tile to full black at distance (surface stays solid ⇒ survives), compounded by the viewer's black-fill + no-onerror tile path (`genmap.html:195-204`). **Revised priority: (b) restore the kind-0 r-site noise law (I21's parked V2 canvas-px frame flip) = the substantive dig; (a) the kind=-1 default rides along; the zoom downsample + viewer robustness = separate rendering-fidelity items.** **Field-fact addendum (dig #144, 2026-10-15, E1 re-counted fresh at the composed-lane level):** the kind-0 ground filler measures 0/2704 solids for empty (15,62), lake (4,62) AND lake_statue (6,62) at BOTH seeds 78633191/500412504 — the NOISE→AIR collapse re-confirmed independently of the audit instruments; the BitmapCaves caves lane is untouched by the r-site swap (83.2-86.7% noise-solid-mat; solids 2426-2664/2704, consistent with the audit's meanSolid 0.897-0.985); the kind=-1 pockets (solid_wall_hidden_cavern/teleroom/friend_1/friend_4) = noiseChunkNull chunks + template art. Tripwire landed in `tests/mapgen/composed-content.test.mjs` (the 0/2704 count flips when the noise restoration lands — re-measure the kind-0 anchor law then, per I34's closing). **RESOLUTION (dig #145, 2026-10-16; entry (145), instrument `mapgen/experiments/2026-10-16-dig145-fix-probe.mjs` + the dig-#144 trace re-run + the census; artifacts `mapgen/out/dig145-fix-probe.json`, `dig144-trace-dig145-*.json`):** (b) CLOSED — the r-site now reads the band ramp at WORLD px (V2's parked I21 frame flip: `wx = gx − 17920, wy = gy − 31744`, the V3-template frame); a frame flip, not a #142 revert. Texture restored: `empty(15,62)` 0/2704 → 2059/1996 solids (both seeds); kind0|ground solid 0 → 0.2035/0.2017; the kind-0 anchor law RE-MEASURED world-continuous (every texture-bearing same-def pair differs; all-air pairs skipped vacuously, ≥2 informative pairs/seed; BitmapCaves shape re-anchor untouched — caves pairs identical 2642/2642). `lake(4,62)` 7/13 textured via the seam branch; `lake_statue(6,62)` all-air = a BYTE LAW (mode 3, the slope offset drives the field ≤ 0.2; the crossing lands at rows 64+ = lake_deep) — pinned as documentation. (a) CLOSED structurally — the byte kind map (noiseKind name→enum; absent → the ctor default 5) means `noiseKind` is never −1, so the `core kind=-1 UNREAD` throw arm is unreachable for absent attrs (the arm stays byte-faithful, untouched); `makeGradAt`'s ramp lane clamped to [−1,1] (C45's domain — the P-1a falsifier → a byte read: the raw (A)-debt ramp is unbounded, rp ≫ 0.85 ⇒ case-3 `acos(x/1024)` NaN ⇒ air, byte-faithful; post-clamp rp ≤ 0.81 ⇒ case-3 unreachable on the ramp lane). (c) CLOSED — the §12 flags-OFF path now `console.warn`s once (surfacing; previously silent black). The census: **2288 procedural | COMPUTES 2288 | falls 0** (pre-fix 663 + 1625) — exact. kind-1|ground noise-chunk-null 13.49% → 0. The 0/2704 tripwire pins now assert the TEXTURED counts (2059/1996) with per-def anti-vacuity (`defCells > 0`); the caves lane is byte-identical HEAD↔fix (maskHash/matHash bisect) — the one changed trace pair row = the L3-ANCHOR (11,12 px) sliver painting the fixed kind-0 neighbour (34,62) `mountain_left_stub` 0 → 1916/2704 through the tile's right edge (an instrument note, not a defect).**
- [x] **I34. The composed-terrain CONTENT defects — the user's live inspection, 2026-10-15 (opened on the audit #143 follow-up; user's live seed 500412504, fixtures 78633191, flags-ON; CLOSED dig #144 — all three decisive tests ①②③ measured, E1).** **Do NOT regress to the "void / background-through-empty" reading — that inference is RETRACTED (I33 addendum).** The user inspected the viewer directly: (1) **CONTENT EXISTS:** the surface-layer chunks and the noodly chunks render **REAL generated pixels** — a noise pattern that **never leaks out of its respective chunk**, colored with pixels that **make sense in their region** (frozen plain and regular plains each render their own appropriate palette); the pattern **changes between biomes but is consistent within a single biome** ⇒ the per-biome parameterization WORKS and the fix must not break it (it is pattern, not hazard). (2) **DEFECT A — repetition instead of continuity:** the generator appears to produce **the same noise in every chunk** of such a biome, an oddity — the generator should display **continuity, not repetition** (the game's field is a pure function of world position ⇒ cross-seam continuous; ours behaves as per-chunk re-anchored) ⇒ a **coordinate-frame/anchor law** defect — same family as I21's parked V2 canvas-px frame flip, but the anchor must be PINNED by measurement, not assumed. (3) **DEFECT B — wrong palette for the desert:** the **desert** area displays the **regular plain's dirt/mud colors** instead of desert-appropriate ones (frozen/plain palettes are correct) ⇒ a classify/colorize **material-resolution fallback** for the desert — same defect family as I8's west-deep-lake-must-render-water regression. (4) **OPEN — lane attribution:** audit #143's `noiseChunkMask` 0% number describes the **raw field layer at specific cells only**; which lane composes the visible pixels (V2 surface-band classify compositor `noise-terrain.mjs:374` vs `bgImageAt` vs the field) is **unmeasured**. **Decisive tests (E1, next session):** ① repetition — byte-hash two ADJACENT same-biome chunks at z0 plus their shared seam rows (identical hashes ⇒ per-chunk re-anchor proven; a seam discontinuity ⇒ continuity defect); ② lane trace — for sample pixels, determine which branch painted them; ③ desert — read the desert area's material resolution in classify/colorize vs plains/frozen. **Scope: with I33's field facts this row IS the content of dig #144 as reframed 2026-10-15 (the SESSION_CONTEXT frontier carries the framing).** Sources: the user's report this session; ABOUT_MATH §6 (143) correction; I33 addendum. **RESOLUTION (dig #144, 2026-10-15; entry (144), instrument `mapgen/experiments/2026-10-15-dig144-composed-trace.mjs`, artifacts `mapgen/out/dig144-trace-dig144-*.json`, mirrorMismatch=0 both seeds):** ④ lane attribution MEASURED — wang areas = the bin lane (surface 61.2% binpx + 26.4% wang-bin; ground ~50/50 bin/airbg), caves filler = noise-solid-mat 83.2-86.7% (ground), kind-0 filler = noise-air-bg 78.2% + template 20.4%, kind-1 pockets = template 73.8% + noise-chunk-null 13.5% + noise-air-bg 12.2%; the surface band rows 48-61 = sky/template lanes only (noise branch unreachable; the 0.17-0.19% noise px = the L3 anchor's 12-row bleed at the ty61/62 boundary). ① Defect A RESOLVED — the caves filler's 52×52 shape+material grids re-anchor PER CHUNK (mask sha256 identical across adjacent H/V AND distant pairs, 17/17 + far, both seeds = the 512/256 mod-wrap, dig #121's direct cell read) while the rgb tiles DIFFER (air cells = the world-tiled continuous backdrop) and the seams are pixel-exact (eq 512/512) — the repetition is SHAPE-level, not color; the kind-0 anchor law is unmeasurable until I33's noise restoration (masks all-air now) and must be re-measured world-continuous then. ③ Defect B mechanism DECODED — desert.xml's sand_surface/sandstone_surface/sand_static_bright/copper carry limit_y="1" (gate live; y-window ≤700 never reaches the mines band y≥7168) while sand_static×2 + rock_static×2 carry limit_y="0" (caps INERT; the [0.9,3.5) window paints rock_static [53,57,35] = 96.8-98.0% of solids, the same color the hills/plains resolve) — the desert wears the plains' palette by the DATA's flag split, not a colorize fallback; idx-255 band shade = 0.3%. **Residuals (named, not floating): the game-side BitmapCaves periodicity + the desert surface-vs-capture comparison = one mapcap follow-up; the kind-0 anchor re-measure rides I33's fix (DONE dig #145 — world-continuous: every texture-bearing same-def pair differs, all-air pairs skipped vacuously; entry (145) M3).**
- [x] **I30. The walk's per-value carve EXIT-law is missing from the port (opened dig #126; CLOSED dig #127 — the port + the count-test landed).** Origin (dig #126, C105(b)): the port's `walkChain` ran every walk to budget length; the byte exits EARLY at the loop top when the previous point's clamped value v ≥ the cursor arg (`movss 0x10(%ebp),%xmm7; comiss %xmm7,%xmm3; jae exit` @0x8ef109) ⇒ the byte's walk-length distribution = BIMODAL while the port's was uniformly budget-length; also the lane-BAND-1's base = the previous v (`lerp(v_prev, cursor, t/0.2)` @0x8ef12b..0x8ef13d), not the port's hard-coded 0. **Resolution (dig #127):** both laws ported into `caves-field.mjs` walkChain (v6). Count-tests (all 3 FAIL under the old law — verified by git-stash revert run): (1) the walk-length census — `median(low-cursor) = 1` vs the no-exit control 32, murmur(carve ≤ 10 cells) = 120/150 (pre-patch: 8/150, ratio 1.0); (2) the band-1 carry pins the 2nd-stamp center value = 0 (old law: 0.8775); (3) the exit gate reads the PREVIOUS point's value. The field md5 moves dd8975f6.. → eb5bc9fc..; the C48 oracle rows shift (registry note in I31); the C97 A/B: v2 0.23391 bit-identical, v3 0.45240 → 0.46508, v2v3 0.45521 → 0.46648, fG 0.71459 → 0.78289 (vs fR 0.48029) ⇒ cache-bump review = VERDICT NO BUMP (the r3i .bin cache stores only the wang-area display bins; the noise/caves branch = live `noiseAt` probes, never serialized). Sources: ABOUT_MATH §6 (126)/(127), C105, §A A7.
- [ ] **I32. The ART-FIRST surface-band compositor (opened dig #129; p1 LANDED dig #130)**: the surface render's shape was the caves field painted over the whole band with a 2-shade flat slab — no art, no material bands. **p1 (dig #130) LANDED:** the per-cell `<Materials>` classify (0x8f5030, C76 frame) → materials.xml wang_color paint wired through noiseChunkMask/noiseMatAt/noiseColor (the hills band: 857 distinct material colors vs the 2-shade slab; count-test pin in tests/mapgen/surface-compositor.test.mjs). **p2a LANDED dig #131 (C108):** the READ-WINDOW law — the caves field reads the WORLD frame with the getter's bounds check; the sky band bty1..13 reads OOB rows ⇒ AIR (the "terrain fills the sky" defect = the old wrapper's constant-row reads, gy%256). The ty62 mines-band chunk value-unchanged (2409 = the pin). **p2d LANDED dig #134 (C111):** the filler-vs-biome distinction decoded — the filler ("meaningless chunks") = the kind-0 noise chain (empty.xml = NO BitmapCaves) = the I21/A4 dig = the SHAPE ROOT (the next dig priority); the bin-air backdrop (the pyramid bg, the mines' air, the HM walls = per-biome); the wang-biome art-crust blit (the pyramid pieces over the corridors). **p2c LANDED dig #133 (C110):** the SKY/Hell layer law — ONE sky backdrop (the parallax gradient + stars) for every world row above the datum to the Heaven end (the bins never paint the sky band; the art pieces ride the template lane over it); the per-biome bgs = the underground only; hell = the_end's own art (the hell band's template-lane air = tagged OPEN). **p2b LANDED dig #132 (C109):** the per-area background law — the air backdrop = the chunk biome's Topology background_image tiled per chunk (hills = cave_04_alt; coalmine = its own; the_sky = transparent). The game's true parallax/multi-layer = OPEN (tagged). **DEFAULT-LANE ATTACH DEFECT (user report 2026-10-15 "no more sky background"; FIXED same session):** `skyAt`/`bgImageAt` were attached BELOW the `SURFACE_V2||SURFACE_V3` gate in `attachNoiseTerrain`, so the default `npm run gen:server` (no flags) returned `null` for every sky/void/bin-less px → the tile renderer's opaque black — measured on seed 78633191, 512×512 px tiles: z0(34,14) and z1(17,28)/(17,29) = 100% black, z1(17,30) = 82.0% black (the user's own server PID 290328, :8082, no `SURFACE_*` in its env); the battery stayed green because the render suites set the flags at load (`surface-compositor.test.mjs:13`). Attach now unconditional (C110 is written unconditionally; the data-image backdrop reads the game's own parallax PNG = zero D); the NOISE band stays gated per §12 — the filler/surface band still requires `SURFACE_V2=1 SURFACE_V3=1` (flags-on HEAD renders all three tiles at 0.0% black, dig #142 intact). Repro/test: the default-lane attach contract in `tests/mapgen/world-gen.test.mjs`. **What remains follows.** **REMAINING p2/p3:** (a) the LoadPixelScene ART-CRUST placement (X63's spliced/xml table — the actual art pieces over the crust), (b) the shape's byte-side carve-architecture (I31/I29-stage-2/I21) — the compositor colors the shape the field had; the under-carve is a separate verified-open lane, not this dig's scope. **dig #135 add: the record-lane IMAGE-STAMP law landed (C112, §8 row 46) — the C48 y=0 bump's writer family (the record-lane image stamps via the fn950→fn870 blend, the whole-binary census); the grouped-class stamp port + the X/Y anchors = dig #136 (the caves-lane byte read inside I31's carves front).** Sources: ABOUT_MATH §6 (130), X63, C106, I31.
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

- [x] **I36. The full-battery gate truncates silently under the surface-compositor IPC watchdog, and the gate reads only the exit code — the context of TWO consecutive registered `--no-verify` bypasses (opened dig #148; CLOSED dig #156 — forms (a)+(b) landed, count-tested).** Reproduction (2026-10-16, this box, 16 GB, swap saturated): two of three full `npm test` runs aborted mid-run at the surface-compositor worker RPC stall (`Timeout calling "onTaskUpdate"`) reporting only **9/22 test files / 205 tests**; the third completed (22 files / 336 tests / **exit 1**) with one genuinely failed test — api-surface, the #147 contract miss. OBSERVED LIMITATION of the measurement: both truncated runs were captured through a shell pipe and their exit codes were NOT recorded — the exit-code behavior of a stalled/truncated run is UNMEASURED (flagged here; the fix dig must pin it). The direct process facts: dig #146 and dig #147 both landed via registered `--no-verify` (the gate never passed OR failed at those commits), and #147's skip hid a real red test. **Fix candidates (a separate scripts dig, not this one):** (a) precommit-gates parses the vitest summary (`Tests N passed | M skipped (T)`) and refuses a run whose T ≠ the loader's expected total — this catches truncation REGARDLESS of the exit code; (b) retry-once-on the watchdog error class (the #146 journal's own prescribed mitigation, never exercised); (c) split the two heavy files (surface-compositor, world-gen) into a second `vitest run` invocation. Any fix MUST keep "counts RUN, not skip" — the bar against masking skips as green. Sources: the .gate-journal.log lines 1792168412 / 1792170607; the three 2026-10-16 battery runs recorded in entry (148). **RESOLUTION (dig #156, 2026-10-17, entry (156)):** (a) LANDED — the gate captures the battery output (maxBuffer 256 MiB, no stdio:inherit — the piped-away state can't recur), parses the vitest summary (`scripts/precommit-gates-lib.mjs` `parseVitestSummary`/`parseVitestFiles`/`decideBattery`, a pure module), and refuses ANY run whose `T ≠ testsTotal` or **`M ≠ testsSkipped`** (the counts-RUN bar, machine-checked) or a non-zero exit or a no-summary pre-abort, against the NEW tracked count-of-record **`scripts/precommit-baseline.json`** ({filesTotal 24, testsTotal 350, testsSkipped 3} — per-dig updated: the dig-#156 battery = 23 pre-dig files/341 tests + the gate's own 9 = the new pins); (b) LANDED — ONE retry, trigger = the observed `Timeout calling "onTaskUpdate"` class; the retry must hit the baseline or the gate refuses (the never-masked bar); (c) NOT taken = the parser removes the truncation risk without doubling battery latency (registered in entry (156)); every attempt is journaled structured (`battery exit=… files=… tests=… retry=…`) — the exit-code-piped-away gap is structurally closed. **Count tests:** `tests/precommit-gates.test.mjs` (9, data-independent): the truncated 205-test tail = REFUSE with the reason 'Tests total 205 ≠ the baseline 341' (the old-law FAIL — the pre-fix gate accepted it on exit 0); the pre-summary abort = REFUSE; the skip-drift 44 = REFUSE (the old gate never tested M); the failed shape = REFUSE (exit≠0); the stall = RETRY→REFUSE past the retry; the healthy tail = OK; the baseline pin-shape = asserted. The gate's own first application = this dig's commit gate itself (the law ran ON the live battery: 24 files / 350 tests / 3 skipped / exit 0).**

- [~] **I36's CORRECTION (dig #168, 2026-10-18): the class RECURRED — the ONE-retry (form b) was never the cure; the ROOT CAUSES are now NAMED and structurally fixed.** Reproduction (this session): three consecutive full `npm test` runs aborted at the SAME point — `Test Files 8 passed | 1 skipped (10)` / `Tests 215 passed | 3 skipped (221)` / `Errors 2` = 2 × `Timeout calling "onTaskUpdate"` / exit 1 — and surface-compositor SOLO died 2/2 (3 passed | 6); `git stash`-ing the dig's changes reproduced it identically ⇒ the class, not dig-#168 code; MemAvailable 13 Gi + swap 0 B used + 919 G disk free at diagnosis ⇒ NOT the #148 swap-pressure form either. THE MECHANISM (M): vitest 2.1.9 birpc `DEFAULT_TIMEOUT = 6e4` (`node_modules/vitest/dist/chunks/index.68735LiX.js`) — a worker with an unprocessed task-update reply dies when ONE contiguous sync span crosses 60 s (the due timer fires before the queued reply is drained). THE SPANS (M): `renderTemplateWorld` = 48783 ms cold (`mapgen/experiments/2026-10-18-splice-chunk-equiv.mjs`) and `ensureWorld()`'s CALL = that render PLUS the eager `readFileSync` gen-cache load per area (`world-gen.mjs:277` + the `readCache` inside the `world.ready` map) — plz-codec's count law rendered the WHOLE world for one chunk, and surface-compositor rendered it per test (art-crust a second time immediately after its own `ensureWorld`). FIXES LANDED (assertions byte-preserved, in dig #168's commit): the count law → `blitSplicedScenes` scoped (full-vs-splice `byteEqual = true`, 48783 ms → 1825 ms); art-crust → reads `world.templates` (byte-identical by construction: same fn/args as `world-gen.mjs:277`) + one shared `getWorld()` for the three world tests (solo 174 s → 71 s, 6/6, zero rpc errors). POST-FIX LIVE BATTERY: 27 files / 371 tests / 3 skipped / exit 0 / zero rpc errors; `scripts/precommit-baseline.json` → {filesTotal 27, testsTotal 371, testsSkipped 3}. Sources: entry (168); `tests/mapgen/plz-codec.test.mjs`; `tests/mapgen/surface-compositor.test.mjs`; `mapgen/experiments/2026-10-18-splice-chunk-equiv.mjs` | **

- [ ] **I38. THE BYTE-PLANE ROLE TENSION: the sampler's byte gate (C136: byte == 0 ⇒ air) vs the sole writer's sparse write law — the scatter writes ONE cell per fire (0x8EEAD0 → 0x8FAFC0, the dig-#56 body law) with the fire rate ≈ E[value] ≈ 1/2 per walk point (the dig-#167 selector decode), i.e. ~10^3 byte cells per 512×256 def-grid ≈ ~1% coverage — three orders short of the dense mask C136's gate would require to yield the 37–65% capture solid shares.** The call-0x8FAFC0 census = ONE site in the whole text region (dig #165) ⇒ no unread dense writer exists behind the same recorder ⇒ the tension resolves toward "the byte plane's sampler role ≠ the terrain-solid mask" (the C136 gate re-read owed) rather than "a missing writer". Wire-up decision DEFERRED until the #168 lane port's byte-coverage census produces the live-biome density number (the E1 count test). Sources: entry (167); C136; C142; I31 |
- [ ] **I37. THE DEEP-BAND OVER-SOLIDITY: the port paints fG ≈ 1.0 exactly in the deep noise bands (bty10–13: 36/56 tiles at fG 0.91–1.0-exact vs fR 0.32–0.44) — [dig-#151 CORRECTION: the mover is the CAVES-KIND land, NOT insidePerlin] (opened dig #150).** The fresh v3 triage (SURFACE_V3=1, the dig-#118 instrument at HEAD post-#148, `mapgen/out/surface-shape-2026-10-10-v3.json` md5 `6025b179e88a1bc884891faac0d4ad48`): overall raw IoU 0.46243 (iouShift 0.64752); **fG = 1.0 EXACTLY on 6 tiles**. **[The (150)-era diagnosis NULLIFIED by (151)'s reads (X114):** the seed-draw slot [+0x24d] = **DORMANT on shipped data** (ctor clears bytes 0x24c+24d @0x496118; **0 XMLs bind the attr** — swept; `0x9119d0` = a pure worldseed GETTER, zero RNG draw) — the port's C27 stand-in never runs — the "draw-values D = the mover" retraction; ALSO the deep-band tiles are largely the **CAVES-KIND land** (the direct gradAt cell read, C100's law), not the mGradient noise chain — the combine's `·per` erratum and the ctor-base 0.0 fix = C125's in-row erratum.] **The re-aimed read = I31's caves under-carve** (the presence divergence, (127): the port carves 14.4% of the caves grid vs the byte side ~58%) — the deep-band all-solid = the caves-lane chunk masks near-solid ⇒ I31 = the byte home of the biggest shape loss. **Fix = the I31 walk-chain read (the byte walk's draw-trace + presence law), NOT an insidePerlin port.** After I31's lane closes, re-run this triage — PREDICTION (registered): fG drops toward ~0.85 first (the bty10–13 family), iou +≥ +0.10; FALSIFIER: fG unchanged ⇒ the residual is the noise-kind band-window data (the empty.xml-style defs), the next read. Meter classes: the triage = E2 (sentinels); the fG=1.0-exact floor + the per-band fR/fG counts = E1 (count laws). Sources: entries (150)+(151); X112; X114; C125/C126; C100; the dig-#118 instrument.

- [ ] **I39. THE REVEALED SPLICE-FILL GAP — the floor under the splice scenes: our underlying fill (A5's seeded-fBm approximation) is too low/blocky where the art correctly defers to it, and the game's own floor-spawn under these sites = UNREAD (dig #168's reveal; the "how the floor spawns" entry the lake anchor opened).** With the paint-classification law ported (the air/miss skips, C143), the splice tiles now show OUR terrain where the game shows ITS terrain — and the deltas name the gap: the lavalake2 flank tiles 39/41/42_14 IoU −0.0285/−0.0273/−0.0236, 40_14 fG −0.27394 (the E2 sentinel deltas of the dig-#168 A/B; the shape truth = the anchor triptych `mapgen/out/lake-anchor-40_14.png`, M-graded). Sub-items: (a) **the fill/floor spawn read = #169** — what the game's floor IS under mountain_lake/lavalake2/watercave (the value the art wraps INTO — the generator law unread); (b) our rock_hard template shades are wrong for these sites (ours (54,55,60)/(48,49,54)/(60,61,66) grey-blue vs the ref's reddish (55,34,29)/(98,59,50) — a per-site shade map or the real material law); (c) the waterline band + the scene-edge flanks (where the stencil ends the fill must transition seamlessly; the flank tiles = the visible seams). Sources: entry (168); C143; A5; I40 |
- [ ] **I40. SPLICE-SCENE STAND-INS FLAGGED (the dig-#168 honest-D set — none load-bearing for shape): (a) `blitFixedArt` paints raw colors with no classification (unmeasured vs capture — the blitFixedArt family may carry the same air/miss law as the splices; behavior kept, FLAGGED here); (b) the splice visual layers (`N_visual.png` / `N_visual.plz`) are NOT applied by blitSplicedScenes — only the material layer paints; (c) per-fragment content pins exist for mountain_lake/0.plz (262144/262144 vs the PNG) and lavalake2/4.plz (8/8) only — the other 95 files are length-exact (97/97 decode) without a content pin.** (a) and (b) = render-fidelity D; (c) = evidence-completeness D. Sources: entry (168); C143; I39 |

## Strategy (agreed)

1. Keep the verified wang core (prediction-solved, oracle-validated).
2. For each issue: identify the game's actual mechanism (Ghidra function or
   game-data script) → reconstruct → validate vs capture → check the box.
3. Approximations (A) are debt: each is tagged and gets replaced, never tuned.
4. Predictable spawns (moon, dark moon, HM bands) = free alignment/anchors.
5. Maintain this registry + SESSION_CONTEXT handover; request a new session
   when context degrades.

## §A register — approximations (D-level claims; the purification scoreboard)

Port stand-ins marked D **are debt, not products**. Levels: B (byte:
this-session full-function extraction, manifest-cited) / M (measured:
instrument artifact) / D (debt: a stand-in — this table + FLAGGED in
code + an owning issue + a queue slot). Purification law: **an
active-path dig must end with fewer D-rows than it started with, or
state exactly which remain and why.** Rows are demoted (D→B/M) ONLY by
the dig that reads their bytes; they are never silently deleted (the
correction moves to VERIFIED §8 per the two-layer doc rule).

| id | stand-in | location | owning issue | the read that removes it |
| --- | --- | --- | --- | --- |
| A1 | `walkChain` per-roll draw counts — **micro-merge flag RESOLVED dig #126**: the frame-slot law landed (C105(a)) — the walk's 10-arg push frame maps every fnB slot; the port's arg wiring is byte-equal (the cursor = the cave_strength·laneFactor law ✓, the scale0 dead-arg drop ✓, the d0² ✓, the dy-slot = [−0x120] ✓, growth = u + 0.0 ✓, the shared counter ✓); the port's own per-point budget-exit + box-exit match | demoted dig #125, wiring closed dig #126 — C105 | — |
| A2 | the walk's spawn-lane selector — the LAW is byte-exact now (D3 gate-draw @0x8ef3b3 + D4 ×101 coin @0x8ef3cf + `cmp $0x5f`/`cmovl` → the 0x8EEAD0 scatter call), the port SKIPS it (the spawn keys unparsed ⇒ the gate pair can't be evaluated); **dig #126 add: the walk's own spawn-gate = comiss vs `cfg[+0x24]` (spawn_percent) @0x8ef38e + the attr-value pair [−0x58]/[−0x64] ≥ 0** — **dig #163 ACTIVATION: the skipped lane = THE BYTE-PLANE WRITER = the caves' carve (C137, X128: the scatter 0x8FAFC0 = the byte-plane write, gated by the field > 0.5; the strength scale = −0.5 @0x11E058C; the jitter = the strength/4 = the sub-pixel ⇒ the placements = the walk's path points ±1). THE PORT = the spawn lane (the keys' parse + the gate + the scatter + the byte-plane writes) + the sampler's byte-plane gate FIRST = the caves band's fix (#164)** — **dig #164 RETRACTION: the spawn sweep says spawn_percent="0" ×55 shipped biomes ⇒ the scatter never fires on shipped data; the demotion-by-port path is DEAD; the lane returns to PARKED (the item-spawn side-lane per the C98 original); re-open only if a scan builds per-biome spawn_percent at runtime**  — **dig #165 RE-OPENED: the C104 gate law = byte-verified (value > 0.0 + the ≥0 pairs + the imul-101 95/5; the XML spawn_percent attr = NOT the gate's source — the dig-#164 sweep = tested the wrong structure); the scatter 0x8EEAD0 = the byte-plane's SOLE-writer fn static (`call 0x8fafc0` = one site in the whole text region) ⇒ THIS A2 lane = THE BYTE-WRITER LANE = the port's fix target after all — dig #166: the pair-key law = SOLVED (the slots = the `spawn_small_enemies`+`spawn_items` config-cache lookups, X132/X133); the density falsifier = the single-cell write model DEAD (0.05% vs the 37-65% capture shares ⇒ the scatter's payload = a SPAN-SHAPED brush if the lane is the writer at all — the [−0x38]-span-struct's dims law = the dig-#167 read; the port stays OFF until the span geometry lands)** — dig #167: the gate chain = `value>0 ∧ [-0x58]≥0 ∧ [-0x64]≥0 ∧ u₃<value` then the scatter fires UNCONDITIONALLY (the 95/5 = a cmovl TABLE SELECTOR, not a fire gate — the (166) 2.5% density model eliminated); `0x7EB280` miss = −1 ⇒ absent keys FAIL the gates (the all-pass inference eliminated, §8 row 53); fnB = 10 draw sites (the port omits exactly D3/D4 = a stream defect for key-carrying biomes); the data census = the keys = biome-script functions (desert/winter carry both, _empty none) ⇒ the lane live-inferred desert/winter ⇒ **#168 = THE LANE PORT behind the per-biome key-presence flag (A11 stand-in) + the desert/winter stream-draw count test** — **dig #168 note: the slot went to the user-directed plz/paint dig (entry (168)); the lane port = RE-QUEUED behind #169's fill-spawn read** | unchanged unported — data-parse debt = I21's frontier | port-side skip documented byte-honest |
| A3 | y-drift span — **DEMOTED dig #126 (the slot identity landed: the drift = the walk's arg `[ebp+0x20]` ← fnB's `[−0x120]` = 0.4u+0.1 (+0.5 on ⌊101u⌋<33), NO draw in the walk — C105(a); the (102)-era "0x04(%esp) = −0x10c candidate" prediction was wrong (predict-then-read outcome, record)** | demoted dig #126 — C105(a) | — |
| A4 | F2/G2 widened consts + MOD12 corner-hash reading + `noiseKind` dispatch — **dig #136: ① the consts B-DEMOTED (the static writers 0x407103/0x407137 = f64 (√3−1)·0.5 and (3−√3)/6 = the port's exact values, C39); ② the corner chain CONFIRMED the port's shape (X67 rows; perm12[perm[i&0xff]+j&0xff]). dig #137: ③ the dispatch DEMOTED (the C36 9-case table + the engine-consistency confirm = the 0x9FAD90/0x8FC020 pair, C114); REMAINING: the PORT itself (the 0x90B280 band-ramp frame C113 + the 0x90B680 law C114 + the kind-0 arm C115 — needs the DRIVER frame + the band-matrix VALUE producer = the C37-flagged 0x7EC4E0 chain, read #138) | `noise-proto.mjs` 467/475/501/647 | I21 family | the 0x7EC4E0 chain read + the PORT (dig #138) — **dig #138: the value-source map settled: the uid-ctor defaults = the ±512/±100 band pair + the mode-1 + the +0x224 = 5 (C116); the [uid+0x1d4] chain CONFIRMED 0x7EC4E0 = the P-builder (C117); digs #138/#139: the value-source map + the parse family settled (C116/C117/C118; the (140) key-correction = the real mGradient attr map, the wrong-rule keys deleted); **dig #141: the DRIVER-frame PRODUCER READ (C119 — Init 0x905FB0: dims + the two tables + the f64 bases w·256/7168.0 + the seeded ±100000 affine pairs incl. +0x48 = the C114 baseline; the producer gap CLOSED); REMAINING = the kind-0 PORT (the C119 OPEN value-reads first: the live +0x38/+0x48, 0x9fee40's region semantics, the Table-B consumer) + its count tests** — **dig #142: ④ THE PORT LANDED** (`bandRampEval` + `bandParams` + the driver frame `makeBandDriver`/`phaseSXBase` + the r-site swap in `surfaceField`, count-tested: the 35-test `tests/mapgen/band-ramp.test.mjs` battery incl. the old-law-failure discriminators; the C119 live-value reads +0x38/+0x40/+0x48/[0x11E0494]/[0x11DFBF0] CLOSED in the same commit). **RESIDUAL — the D that remains and why:** the band-matrix VALUE-producer equivalence — 0x9FEE40's region semantics + the Table-B consumer were NOT read in #142 (a separate Init-phase producer investigation, outside the r-eval port's scope); the value path currently resolves through `biomeAt`'s map image (the same image C119 pins: TopLeft world x −17920 / row0 y −7168), **FLAGGED in `noise-terrain.mjs` buildBandDriver**. Purification: the register's D-coverage shrinks (the PORT + frame row demoted D→B; A2/A5/A6 untouched and byte-honest out-of-scope; A7 already demoted #127) — the two remaining in-scope-of-origin Ds are named here rather than re-opened. Sources: entry (142), C120 |
| A5 | `colorize` band/vein approx; `template-render` seeded-fBm fill; `biomes.mjs` noitool-derived name-list flags; `has-path` noitool-derived start_x | respective lib files | product-render debt, blocked on the noise/lane work (I23) | the I23 V2-lane read family |
| A6 | C32 fallback-grey bake per-biome "A-resolver = open" | `caves-field.mjs` ~798 | possible STALE DEBT — digs #87/#88 read `0x8EE1B0`'s arms | staleness re-check at the next caves-lane dig |
| A7 (**DEMOTED dig #127**) | ~~the walk's per-value carve exit: the port runs walks to budget length; the byte exits when the previous value ≥ the cursor~~ the port + the count-tests LANDED (the census median 1 vs the control 32, murmur 120/150; the band-1 carry; the gate pinned to the PREVIOUS point's value — C105(b)) | ~~`caves-field.mjs` walkChain~~ PORTED dig #127 — C105(b)/I30 closed | — |
| A8 | the polygon-lane GAME ORACLE + the loader SEMANTICS — **the loader-semantics half CLOSED dig #157 (C132, X119/X120):** the dig-#149 byte route (poro tree, X108..X111) extended SIDE — the cxml reader's **comment-sink law = byte-closed** (comments do NOT persist as children: the tokenizer 0x100B880 consumes `<!--…-->` / `<!…>` / `<?…?>` with NO token emitted, NO node appended — the dig-#148 "the game's XML loader sees an EMPTY Materials list" verdict = byte-RATIFIED; the port's ensureSurfaceTable comment-strip + fail-loud law = byte-correct, UNCHANGED), and the **family-name locate = the literal pass** (fnA 0x7DAEB0's caller set = {fnEnum 0x9434DE only, a whole-.text sweep}; fnEnum's = {the X110 builder 0x8f89A7 only}; the builder passes the family name as a stack-built NUL-literal — `MaterialComponent` (17 ch) then `VegetationComponent` (19 ch) — no separate locate fn; the locate = fnEnum's own name-equality gate (X109)). **REMAINING (the only read that still removes A8):** (c) the game-side E0 oracle for the one ACTIVE polygon comp (lava_90percent's band) — capture it (mapcap, user-side) and pin the #148 count bars to it; the vertex-tie corners stay at the even-odd level (C123's declared gaps) unless the capture shows a tie discrepancy | `surface-level.mjs` pointInPolygon consumers + `noise-terrain.mjs` ensureSurfaceTable; the byte home for the loader = the cxml tokenizer (X119) | I35 | the lava_90percent mapcap capture (user-side) |
| A9 | **D-stand-ins in the dig-#164 record-stamp port (caveRecordStamp, caves-field.mjs — flagged in-code this dig):** (d1) the position rolls: X then Y as the integer roll-in-range form `min + trunc(N·u)` over the record aabb (the exact fn950 roll shapes unread — X129's window shows only the scatter-family's centered forms); (d2) the byte VALUE = 1 (the paint flag; the record's strength draw runs for stream parity, its magnitude unmapped); (d3) the template decode = nonzero-rgb → 1 (the channel semantics unread). All three = byte-shadowed stand-ins, non-load-bearing until #165 resolves the writer lane + the template fill; the count test pins the coverage, not the exact bytes. Demote when the fn950 chain is read. | OPEN | 2026-10-17 dig #164 | #165 (the writer hunt) |

Locations are relative to `mapgen/lib/`. This table is maintained BY
the digs (§ dig protocol); a stale row here is a process bug.

Dig #127 purification: started 5 active D-rows (A2, A4, A5, A6, A7),
ended 4 (A7 demoted) — the law holds; next active D-lane = A4 (I21's
kind-0 r-eval/P-chain).

Dig #148 purification: started active {A2, A4(residual), A5, A6}; ended
the SAME set + **A8 added** (the (147)-promised-but-never-registered
oracle debt — registering it IS the purification of the registry; the
(147)-era "negative-mod mirrored" D claim retired to **B** in the same
dig via X107). Net active D-rows 4→5, stated per the law: A2 = the
unparsed spawn keys (I21 data-parse debt); A4 = the band-matrix
VALUE-producer equivalence (0x9FEE40/Table-B, flagged at buildBandDriver);
A5 = the product-render noitool-derived flags; A6 = the C32 staleness
re-check; A8 = the new oracle row above — none removed by THIS dig
because the dig's own reads (X107 + the census) close claims, not the
D-rows' named bytes. The next user's-call candidates already name the
A8 reducer (the mapcap lava_90percent capture) and the I36 gate fix.
