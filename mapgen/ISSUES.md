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

## Strategy (agreed)

1. Keep the verified wang core (prediction-solved, oracle-validated).
2. For each issue: identify the game's actual mechanism (Ghidra function or
   game-data script) → reconstruct → validate vs capture → check the box.
3. Approximations (A) are debt: each is tagged and gets replaced, never tuned.
4. Predictable spawns (moon, dark moon, HM bands) = free alignment/anchors.
5. Maintain this registry + SESSION_CONTEXT handover; request a new session
   when context degrades.
