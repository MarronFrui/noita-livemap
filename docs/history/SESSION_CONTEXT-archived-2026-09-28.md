# Session Context — Noita Live Interactive Map

> This document captures the current state, decisions, and next steps so the next session can pick up without re-discovering everything.

---

## Project Goal (Updated)

**Map Gen Prediction: procedurally generate a Noita world map for any arbitrary seed, displayed inside the livemap viewer.**

This replaces the current approach of showing pre-captured tiles from a fixed seed. The interactive map should reflect the seed the player is actually running.

If full pixel-perfect generation proves infeasible, the project will still produce a useful generated map + prediction overlay, and the generated map will serve as a visual diff tool for further reverse-engineering.

---

## Current State

The project already has:

- A Noita mod (`mods/noita-live-map/`) that writes `seed`, `x`, `y`, `biome` to `noita-live-map-telemetry.json` ~10 times per second.
- A Node bridge (`bridge/`) that watches the telemetry file and broadcasts it over WebSocket.
- A Vite frontend (`index.html`, `src/main.ts`) that embeds noitamap in an iframe and shows live seed/biome/position.
- noitamap vendored as `vendor/noitamap` (submodule) and copied to `public/noitamap/` at build time.
- noita-tools vendored as `vendor/noita-tools` (submodule; **obsolete reference** — see the banner in "noita-tools files to know" below).
- A working map-gen bench in `mapgen/` (built Sep 2026, see "Bench findings" below).

The livemap currently warns when the live seed differs from the hard-coded capture seed.

### Map-gen bench findings (Sep 2026)

Infrastructure (all plain ESM, deps: pngjs + sharp devDeps):

- `mapgen/wang.mjs` — Node loader for noitool's prebuilt `noita_random.wasm` (no imports needed). `generateArea()` = SetWorldSeed → MapHandlerNew(w,h,color,flags,rm,area.x1,area.y1) → MapHandlerGenerateMap(atlas PNG bytes) → MapHandlerToBig → bigMap (w*10 × h*10 RGBA).
- `mapgen/biomes.mjs` — parses `_biomes_all.xml` + biome XMLs + biome_map.png (70×48, RGB); connected-component areas per color. **Areas match noitool's maps.json exactly.**
- `mapgen/render.mjs` / `reference.mjs` / `diff.mjs` / `fit.mjs` / `verify.mjs` — bench pipeline; `npm run bench` runs gen+ref+diff.
- Fixtures: noitool's Map fixtures (seeds × biomes, expected raw map buffers).
- Golden hash + determinism tests: `npm test`.

Validated facts:

1. **Our wasm wrapper reproduces noitool's wang output byte-exactly (RGB)** — 28/28 comparable fixtures pass (`node mapgen/verify.mjs`). Alpha-only diffs are their fixture encoding artifact.
2. The 12 verify "fails" are all at biome-map px (53,30-31): noitool's embedded world map expects coalmine/excavationsite there, but the current game's biome_map.png has **Tower** — their data version is older. Not our bug.
3. Ground truth: capture DZI tile grid == biome-map pixel grid; tile `i_j` at level 17 = biome px (i, j-48) (middle segment TopLeft -35,-62 chunks). Chunk→tile mapping is clean.
4. Atlas PNGs in noitool's maps.json are pixel-identical to the extracted game files.
5. noitool's C++ `hexRGBAtoIntRGB` = **24-bit RGB int** (`parseInt(hex.slice(0,6),16)`); randomMaterials must be encoded that way (fixed in biomes.mjs).
6. Generation is **rejection sampling**: `GetRNG(width)` seeds from world_seed with a width/seed-dependent skip; per attempt `NewNollaPrng(rng.NextU())` → stbhw_generate_image → `MapGen::hasPath()` (JPS path check) → retry ≤100×. `toBig()` = plain ×10 upscale.

Open problem — gen vs capture agreement is only ~60-65% (air/solid mask, zero-shift; `node mapgen/fit.mjs`):

- Per-chunk best shifts are inconsistent (not a global transform issue) → content divergence.
- Candidate causes (research frontier, in rough priority):
  a. Capture includes layers we don't generate: pixel scenes, backgrounds, walls.
  b. `MapGen::hasPath()` differences → different retry counts → different tiles.
  c. Game-space alignment of the wang layer: C++ drawImageData uses magic offsets `+5/+13` (`(gx+5)/512`, `(gy+13)/512`) — hints the wang layer sits a few px off the 512 grid.
  d. noitool data-version drift (Tower case) — affects other biomes potentially.
- Liquidcave (Ancient Laboratory) IS a wang biome, so its poor visual match is not a biome-type issue; likely (a)/(b)/(c).

---

## Key Technical Facts

### How noitamap.com currently works

- noitamap is a static image viewer (OpenSeadragon) over pre-captured Deep Zoom Image (DZI) tiles.
- Tiles were captured with Dadido3's `noita-mapcap` mod, which screenshots the game world and stitches the images.
- Tile URLs are hard-coded in `vendor/noitamap/src/data/tilesources.json` and include the capture seed in the filename (e.g., `78633191` for `regular-main-branch`).
- The viewer URL only supports `x`, `y`, `zoom`, `map`. There is no seed parameter.

### Map generation feasibility

- Noita's world is deterministic from `world_seed`.
- Community tool **noita-tools** has reverse-engineered Noita's RNG and much of its map generation.
- noita-tools' author states:
  - Wang tile generation is ~100% understood.
  - The **Wang → tile conversion and game-space coordinates** are not 100% accurate.
  - Terrain-dependent enemy/item spawning (`RaytracePlatforms`) is unsolved.
- Therefore: generating a *useful* map is feasible; generating a *pixel-perfect* map is an open research problem.

### Relevant repositories

| Resource | URL | Role |
| -------- | --- | ---- |
| noitamap | https://github.com/acidflow-noita/noitamap | Current static map viewer (vendored) |
| noita-tools | https://github.com/TwoAbove/noita-tools | Seed predictions + reconstructed map generation |
| noita-mapcap | https://github.com/Dadido3/noita-mapcap | Captures the game world for ground-truth images |
| NoitaWangTiler | https://github.com/TheHorscht/NoitaWangTiler | Standalone Wang tile visualizer (GPL-3.0) |
| noita-world-maker | https://gitlab.com/alter_ukko/noita-world-maker | Custom-world editor; documents biome/material formats |

### noita-tools files to know

> **OBSOLETE (2026-09-08, user decision):** noitool is no longer a reference
> or comparison target — our own Ghidra reconstruction + game oracles are the
> authority (`mapgen/VERIFIED.md`). The vendored files below remain readable
> as data containers / history only; re-derive anything load-bearing from
> `noita_dev.exe` before trusting it (example: noitool's shipped coalmine-hax
> code is a silent no-op — constant/data mismatch).

- `src/services/SeedInfo/noita_random/src/noita_random.cpp` — reconstructed Noita PRNG (LCG).
- `src/services/SeedInfo/noita_random/src/wang/wang.cpp` — reconstructed map generation (Wang → tiles, path validation, pixel-scene overlay).
- `src/services/SeedInfo/noita_random/src/wasm_in.cpp` — WASM bindings.
- `src/services/SeedInfo/noita_random/noita_random.wasm` — prebuilt WASM module.
- `src/services/SeedInfo/infoHandler/InfoProviders/Map/` — TypeScript biome implementations.
- `src/services/SeedInfo/infoHandler/InfoProviders/` — prediction providers for perks, shops, fungal shifts, etc.

### Coordinate system notes

- Noita world is divided into 512×512 chunks.
- Biome map pixels correspond to chunks.
- noita-tools uses hard-coded offsets: `WORLD_OFFSET_X = 35`, `WORLD_OFFSET_Y = 14`.
- The livemap mod reports raw world coordinates (`x`, `y`) from `StatsGetValue`/`GameGetCameraPos`.

### Public knowledge survey (online research, Sep 2026)

**Engine & codebase (verified via Wikipedia + noita.wiki.gg):**

- Custom engine, "**Falling Everything**": falling-sand cellular automata simulating every pixel, plus Box2D for rigid bodies. Core is C++ with OpenGL shaders; gameplay logic is Lua + XML on an ECS. Windows-only.
- Nolla Games (Helsinki): Petri Purho, Olli Harjola, Arvi Teikari, Antti Tiihonen. 1.0 in Oct 2020; last content update "Epilogue 2" Apr 2024 — effectively unmaintained, so reconstructions won't be invalidated upstream.
- Petri Purho has public talks on Noita's tech (e.g. "Exploring the Tech and Design of Noita") — worth watching for engine internals.

**World generation pipeline (verified via wiki "World generation" + "Modding: Making a custom environment"):**

1. `data/biome_impl/biome_map.png` (~70×35 px) is the biome map. **1 map pixel = 1 chunk = 512×512 world px.** Origin: x=0 at map center, y=0 is `biome_offset_y` (=14) px from top — matches noita-tools' `WORLD_OFFSET_X=35, WORLD_OFFSET_Y=14`.
2. `data/biome/_biomes_all.xml` maps ARGB pixel colors → `biome_filename`; each biome XML defines `wang_template_file` (Wang tile PNG) + `lua_script` + materials.
3. **Generation is viewport-driven**: the game generates tiles around the camera as chunks come into view — NOT biome-by-biome upfront. (Noitool author: his biome-wise root assumption was wrong; full refactor needed.)
4. Wang tiles use **herringbone Wang tiling** (same scheme as nothings' `stb_herringbone_wang_tile`). Tile colors → materials via `wang_colors` in `data/materials.xml`; greys filled from the biome's `<Materials>`. Community: Wang generation itself is ~100% understood.
5. Pixel scenes: ≤512×512 images drawn from probability pools (`g_pixel_scene_01` vertical / `_02` horizontal) or globally from `data/biome/_pixel_scenes.xml`; large scenes spliced via `noita.exe -splice_pixel_scene`. `LoadPixelScene` can draw outside its tile (Holy Mountain altars).
6. Entity/item spawning is color-triggered Lua: placing a Wang tile calls functions mapped from pixel colors (`data/scripts/wang_scripts.csv`, `RegisterSpawnFunction(0xFF..., fn)`; special `0xffffeedd` runs per chunk load). Terrain-dependent spawns need `RaytracePlatforms` — the unsolved part.
7. All assets live in `data.wak`; extract with official `tools_modding/data_wak_unpack.bat` (Windows) or `-wizard_unpak` launch option (Linux/Proton). Key dirs: `data/biome/`, `data/wang_tiles/`, `data/scripts/biomes/`, `data/materials.xml`, `data/biome_impl/`.

**Data conventions / gotchas:**

- Colors are **ARGB** in game files but RGBA in browser land — noitool homogenizes to RGBA in its data JSONs.
- HP in data files is 1/25 of displayed HP; time values are frames at 60 fps.
- Biome code names differ from display names (e.g. `coalmine`=Mines, `excavationsite`=Coal Pits, `snowcastle`=Hiisi Base) — full table on the wiki `Modding: Data.wak` page.
- Some secrets (Eye Messages, Cauldron Room) are generated by the engine, not present in data files — caveat for data-only reconstruction.

**Noitool author's own accuracy statement** (`noita-tools/ARCHITECTURE.md`, first-party):

- PRNG + map gen extracted from the decompiled binary (Ghidra + C++ plugin recommended).
- 100% sure about Wang generation; **not 100%** on wang→tile conversion and game-space coords. Solving that gives full map info per seed.
- `RaytracePlatforms` (needed for terrain-dependent enemy spawns) unsolved — appears to require the actual generated terrain.
- TwoRNG determinism caveat: anything seeded via `SetRandomSeed()` with non-coordinate game-state values (e.g. boss death coords) is not seed-predictable.

**Public resources:**

| Resource | URL | Notes |
| -------- | --- | ----- |
| noitool (noita-tools) | https://github.com/TwoAbove/noita-tools | Submodule; `ARCHITECTURE.md` is the best map-gen write-up |
| Noita Wiki: World generation | https://noita.wiki.gg/wiki/World_generation | Wang tiles + pixel scenes overview, material colors |
| Noita Wiki: custom environment | https://noita.wiki.gg/wiki/Modding:_Making_a_custom_environment | The single most detailed public doc on biome loading/generation |
| Noita Wiki: Modding / Data.wak | https://noita.wiki.gg/wiki/Modding, /wiki/Modding:_Data.wak | Extraction steps, folder map, biome code names |
| Herringbone Wang Tiles | https://nothings.org/gamedev/herringbone/ | Theory behind Noita's tiling; `stb_herringbone_wang_tile.h` |
| noita-mapcap | https://github.com/Dadido3/noita-mapcap | Ground-truth captures; works with dev build (freeze physics) |
| NoitaWangTiler | https://github.com/TheHorscht/NoitaWangTiler | Web visualizer for Wang tile sets |
| noita-utils colors.png | https://raw.githubusercontent.com/ryyst/noita-utils/master/colors.png | Material color reference for tile/scene editing |
| noita-world-maker | https://gitlab.com/alter_ukko/noita-world-maker | Sparse (17 commits) despite wiki references; don't expect much |
| Noita Discord | https://discord.gg/SZtrP2r | `#mod-development` — active community |

### Local machine setup (this dev machine)

- Noita install: `/mnt/e/Programmes/Steam/steamapps/common/Noita` (has `noita_dev.exe` and official `tools_modding/wang_gen.exe`).
- Extracted game data (Step 0 done, via `noita.exe -wizard_unpak`, 51 MB):
  `/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/`
  — contains `wang_tiles/` (32 atlases), `biome/` (+`_biomes_all.xml`), `biome_impl/biome_map.png`, `materials.xml`, `scripts/biomes/`, `scripts/wang_scripts.csv`, `entities/`, `shaders/`.
- Mapgen bench will resolve this via `NOITA_DATA_DIR` env var with that path as fallback; nothing gets copied into the repo.
- Windows user for telemetry/bridge paths: `xan98`.
- Note: install also runs Entangled Worlds multiplayer (`E:\Games\Noita multi`); irrelevant to map gen but explains extra save slots.

---

## Decisions Made

1. **Goal:** Target Map Gen Prediction (full procedural generation) as the long-term ambition.
2. **Approach:** Use noita-tools as the starting reconstruction, not as a black-box dependency.
3. **Validation strategy:** Generate maps for arbitrary seeds and compare them live against the game, using the interactive map as a visual diff tool.
4. **Legal stance:** Comfortable with targeted decompilation using Ghidra, since noita-tools has already done similar work and the game is no longer maintained.
5. **Hosting for generated tiles:** Start server-side (Node/Python) for easier debugging; decide later whether to move client-side.
6. **Initial biome:** Mines (we will spend a lot of time there anyway).
7. **Environment:** Noita runs on Windows; use the dev build for teleporting, freezing physics, and setting seeds.
8. **Scope:** Only visual terrain (Wang tiles + pixel scenes). Entity/item spawns (GAP 2, `RaytracePlatforms`) are explicitly out of scope — spawns place entities, not pixels, and prediction overlays are a later phase.
9. **Primary ground truth:** noitamap's built-in capture of seed `786433191` (the tiles we already serve). Diff generated chunks against it; in-game capture via noita-mapcap is secondary.
10. **Ghidra is a fallback, not step 1:** only open the binary if the coordinate transform can't be fit by diffing, or a biome uses a generation path noitool never reconstructed.
11. **Patch strategy:** prefer wrapping the noita-tools WASM/coordinate mapping from our own repo; if `wang.cpp` itself must change, fork noita-tools (like `vendor/noitamap`) instead of editing the submodule.

---

## Roadmap

See `ROADMAP.md` for the full phased plan:

- **Phase 0:** Foundation — set up dev build, Ghidra, study noita-tools, generate first Mines tile, compare to capture.
- **Phase 1:** Map Generation Engine — submodule noita-tools, build tile server, coordinate mapping, render with OpenSeadragon.
- **Phase 2:** Reverse-Engineering Loop — maintain mismatch DB, decompile specific functions, iterate.
- **Phase 3:** Livemap Integration — live seed as map seed, player marker, `?seed=...` URL param.
- **Phase 4:** Prediction Overlays — fungal shifts, shops, perks, LC/AP recipes.
- **Phase 5:** Scale & Polish — caching, more biomes, documentation.

---

## What to Do in the Next Session

**Read `mapgen/VERIFIED.md` first** — the distilled canon (verified truths,
eliminations, open frontier). It supersedes this section's state summary;
current frontier in one line: the fill's walk mechanics are measured-correct
(exact given the right sub-seed S), and the open problem is the derivation
world-seed → S (asm chain excluded by measurement) → next step: hook
FUN_00904c20 and log `[area+0x4c]` (VERIFIED.md §9). Research history lives
in `mapgen/ABOUT_MATH.md`; decompilation state in `mapgen/ghidra-ledger.md`.

Next steps in order:
1. **Sweep vertex-coloring hypothesis families against the spawn-equation
   judge** (`mapgen/experiments/2026-09-04-spawn-judge.mjs`): positional
   encodings × anchors (H1/H2/H3, §4), multi-draw variants, per-area vs
   per-chunk streams — a hypothesis lives only at ~100% constraint
   satisfaction. Tolerance is now tight (frozen physics = exact spawn
   positions).
2. Re-derive the game's `MapGen` post-processing from the binary
   (`finalize`, `fillBlockedRooms`, random-block/material fills…) — defines
   what the accepted out_map contains. (noitool's version is obsolete;
   re-derive from `noita_dev.exe`.)
3. Wang-only ground truth (non-wang share per biome from XMLs / dev-build
   probing) — note: trigger colors are consumed at generation, captures never
   show them (§7sexies).
4. Tier-2 wasm knobs via fork + `tools/zig` if the fill turns out stbhw-shaped
   with different constants.

Tools: `mapgen/lib/wang-js.mjs` (pluggable fill), wasm loader, spawn judge,
`mapcap/` capture analysis, `npm test` goldens.

---

## Open Questions

- What level of visual mismatch is acceptable before falling back to captured tiles?
- Client-side WASM vs. server-side tile generation for the final architecture?
- Which pixel scenes / structures are most important to get right first?

---

## Important Caveats

- Our own reconstruction (like any reconstruction) may still have gaps —
  validate against the game, not against noitool (obsolete).
- Decompiling a commercial game's binary has legal gray areas. Keep reconstructions private until you are comfortable, and credit sources.
- Noita is no longer maintained, so upstream game updates are unlikely to break reconstructions.

---

## File Reference

| File | Purpose |
| ---- | ------- |
| `mods/noita-live-map/files/telemetry.lua` | Mod logic; reads seed/position/biome |
| `bridge/index.js` | WebSocket bridge from telemetry file to frontend |
| `src/main.ts` | Frontend; displays telemetry, embeds noitamap |
| `vendor/noitamap/src/data/tilesources.json` | Hard-coded tile URLs per map mode |
| `vendor/noitamap/src/data/map_definitions.json` | Map metadata, including capture seeds |
| `ROADMAP.md` | Full project roadmap |
| `SESSION_CONTEXT.md` | This file |

---

## Update 2026-09-04 (seed-differential + predetermined zones)

- Captures now: 91 (noitamap ref stitch, build 2024-08-12), 92 (`run1b`),
  93 (`run2`) — both in-game, parallax off, same grid. Overlap stability of
  in-game pipeline: 99.7% identical (mean 0.16). Analyzer crash (shadowed
  `overlapStats`) fixed.
- `run1b` (92) vs `run2` (93): 83.0% identical, 37/171 chunks fully stable —
  the cleanest adjacent-seed pair (same pipeline, same build).
- `mapcap/diff-vs-reference.mjs` diffs any capture vs the cached ref (91);
  93 vs 91: 80.4% identical, 12/96 stable.
- 3-way decomposition of the overlap window: 48.0% of px identical in all
  three pairs; 17.9% two-agree-one-differs (even split across which seed
  differs → small-variant-pool hypothesis); 6.8% all-distinct (wang);
  27.3% black bg. NOTE: an earlier print mislabeled "changed in exactly
  1 pair" — that class is mathematically impossible; correct classes are
  0/2/3 changed pairs.
- Holy Mountain bands are the predetermined zones: biome rows j=16, 19, 23,
  26, 30, 34 = temple_wall/temple_altar (+solid_wall), no wang, ~95%
  seed-independent (cy=2 measured). Full table + roles:
  `mapcap/PREDICTABLE_ZONES.md`.
- Testing ladder for wang-model iteration recorded in PREDICTABLE_ZONES.md
  and SESSION_CONTEXT next-steps: goldens → spawn equations → divergence
  calibration (target 26.5% fg changed for adjacent seeds) → IoU in wang
  bands only.

---

## Update 2026-09-08 (evening) — genmap MVP live

The wang layer is prediction-solved end-to-end (see `mapgen/VERIFIED.md`):
chain → fill → hasPath, all oracle-validated. Wired a first generated-map
MVP:

- `mapgen/lib/world-gen.mjs` — all 57 wang areas/seed, disk cache
  (`mapgen/out/gen-cache/`); `mapgen/server/genmap-server.mjs` — tile server
  on :8082 (`npm run gen:server`): `/gen/tile/:seed/:z/:x/:y.png`,
  `/gen/status/:seed`, `/gen/zones/:seed`, and the viewer at `/`.
- `public/genmap.html` — canvas viewer: `?seed=`, pan/zoom, **live button**
  (connects to the telemetry bridge on :8080, auto-loads the current run's
  seed + draws the player marker), **zones toggle** (per-chunk tags:
  wang / HM band / non-wang / unsupported atlas / no-attempt).
- Coordinates: canvas px = biome-map px × 512; world = canvas − (17920, 7168).
- Validated: seed 999123 cold-generated on demand (57 areas ~25 s) — the
  generator works for arbitrary seeds.
- Known gaps: 5 edge-type-atlas areas (winter_caves family) and the
  lake/rainforest_dark areas (hasPath accepts nothing there — open question)
  render black; template biomes (mountain/tree/desert/HM art) still missing —
  next step: port the game's `LoadPixelScene` compositions for the surface
  band (noitool never reconstructed template terrain; our source =
  game's own `data/scripts/biomes/*.lua` init()s, validated vs the capture's
  ~95%-seed-independent zones).

## Update 2026-09-08 (night) — first in-game playtest + purple fix + next session

**What happened this session (after the morning breakthrough):**
- Wired the genmap MVP (tile server + canvas viewer + live marker + zones
  overlay — see previous update).
- USER IN-GAME TEST: reference seed 78633191 = **"extremely close to reality,
  correct shape everywhere"**; seed 78633194 (+3) close, minor structure
  deltas (positions/pools); a thin wall-hugging offset of the marker vs
  terrain; ghost-purple material layers on all seeds.

**Fixed this session:** purple trail = hasPath search painted visited cells
onto the terrain; the game searches on a path_map COPY. Port corrected,
oracle re-validated 8/8, Dynamo cache bumped to r2. Added finalizeLite
(undo hax + blocked rooms → air) to the genmap output.

**NEXT SESSION — ordered:**
1. Surface/template rendering (≈1 day): port `LoadPixelScene` (scene PNG →
   colors-file → materials.xml material mapping + visual overlay) and the
   surface band's per-biome init() compositions from the game's own
   `data/scripts/biomes/**` (mountain_left/right/top/tree/center(+entrance),
   desert + pyramid pieces, hills, lake). Even noitool has these as
   unimplemented stubs — original reconstruction. Validation is free:
   template zones are ~95% seed-independent → compare rendered vs captured
   pixels directly (zero-noise debugging).
2. L3 anchor fit: mapcap foreground masks → per-chunk best-offset scan over
   a few wang chunks → constant-vs-sawtooth decision (§4 principle) →
   apply the winning rule to world-gen's sampling (fixes the wall-hug
   marker offset).
3. Investigate: lake + rainforest_dark accept nothing through our hasPath
   (180 chunks black); the +3-seed structure deltas (candidates: ClearPath,
   fillC0ffee, fillRandomMaterials — the remaining finalize steps — plus
   pixel scenes and the small-variant pools).
4. Then coloring: wang tile art colors → materials via materials.xml
   (the user's planned "coloring" step) — turns the placeholders
   (white/grey rock, black air) into the real biomes' materials.

User hypothesis on record (to test paint-immune later): "spawns affect
terrain" — current analysis says spawn TRIGGERS are consumed at generation
but don't alter terrain; the observed deltas are more likely the missing
finalize layers + pixel-scenes ("pools, coal positions" smell like scene
compositing). Keep as a question, not a fact.

## Update 2026-09-09 — purification phase + issue registry

**User decision:** purification before new features. All known defects are
registered in **`mapgen/ISSUES.md`** (I1–I16) with strategy: no more guessing,
replace approximations by Ghidra-reconstructed mechanisms one issue at a time,
parallel worlds parked (I16). Stable baseline = commit `1b2d462`; commit
`fd4e11a` (71×144 extent) is kept for its verified mechanics (clamped virtual
map, canvas keys, last-candidate hasPath fallback) but its approximated
painters (fBm walls, straight lava bands) are debt to replace.

Key user intel registered: The Work's two predictable spawns = **moon**
(heaven) + **dark moon** (hell) — seed-independent anchors; no-spawn zones
around them; walls are sinusoidal (noise-displaced) not straight; the hell
lava band is PURE lava; west lake should be water (currently dirt).

## Update 2026-09-08 (late night) — noitool obsolete + white-tile root cause

**Decisions:**
- **noitool (`vendor/noita-tools`) is OBSOLETE** — dropped as reference and
  comparison target everywhere; authority = our Ghidra asm verification +
  game oracles (`mapgen/VERIFIED.md` header, README, ROADMAP, AGENTS.md all
  updated; live-lib comments updated; historical log entries/experiments
  left untouched as history). Corroborating bug found: noitool's
  `doCoalMineHax`/`undoCoalMineHax` compare `0x004000`/`0x0040` against
  overlay data that is `0x006400`/`0x000064` → silent no-op. Never port
  noitool code unchecked; re-derive finalize from the binary.

**White-tile root cause (user report, example = frozen91 chunk_0_1 top-right
tank):** the genmap renders the wang out_map's RAW art colors, but the atlas
art contains placeholder families the game replaces before display
(full mechanism in ABOUT_MATH §6, 2026-09-08 late-night entry):
- **Grey ramp** (`r==g==b` incl. white, ≈35% of coalmine) → filled from the
  biome's `<Materials>` noise bands (coalmine.xml: soil 0.45–0.53,
  sand_static 0.53–0.95, rock_static_wet 0.9–3.5 + coal/copper/gold veins).
  This is the "white" the user sees. Material colors are deliberate
  near-greys (coal `505052`, oil `3b3b3c`, steel `404041`) that dodge the
  grey test; `2f554c` = **water** (materials.xml alpha `90`, not `ff`).
- The reported "vertical domino centered on a cave filled with material" =
  a coalmine v-tile whose art = grey cavern blob + `2f554c` water pool.
- Random-block placeholders: `c0ffee` + `<RandomColor input_color="FF00BBEE|
  FF12BBEE" output_colors="black,white"/>` → flooded black|white at finalize.
- Spawn-trigger colors (green altar blob, red/yellow dots, `9678xx`
  structure loaders per coalmine.lua) are consumed in-game; render → air.
- **STALE CACHE:** `gen-cache/r2/*` = raw pre-hasPath fill (no hax whites,
  no finalizeLite) from an older code revision → viewer shows neither the
  current pipeline nor finalize. Bump to r3 after the coloring layer lands.

**Next steps (revised):**
1. ~~Coloring layer in the genmap renderer~~ **SHIPPED 2026-09-09** (`lib/colorize.mjs`, cache r3b): random-block floods, triggers → air, material shades, grey-fill fBm; 0.24% unknown. Remaining visual gap = torch lighting, vegetation, pixel scenes, spawn-band extra layers; grey-fill exact noise semantics still open.
2. L3 anchor fit (unchanged) — needed before reading grey-value tables off
   the capture.
3. Template/pixel-scene rendering (unchanged).

## Update 2026-09-17 — I8 fixed (single-material biome fill)

- **I8 closed** (`mapgen/ISSUES.md`): west deep lake now renders water.
  Root cause: `lake_deep` declares exactly one material (water, min -1.0 /
  max 10.5) → the game fills the atlas's grey/white placeholder ramp with
  that material rather than the generic soil/sand/rock noise mix. Fix in
  `lib/colorize.mjs` (`singleMaterial` branch in `shadeFor`), cache r3b →
  r3c, new regression test in `mapgen/test/bench.test.mjs` ("I8"). All 5
  tests pass. Note: this is the *display-shade* fix (like the rest of the
  colorize layer, a faithful approximation of the game's placeholder-fill
  behavior, not yet the reconstructed noise itself).
- **Next issue queue (user-weighted):** I9 (Yomi not loaded, HIGH), I1
  (surface band / poro noise, HIGH), I5 (pure lava band, HIGH), I6
  (sinusoidal walls, HIGH), I15 (missing-elements inventory, HIGH enabler).

## Update 2026-09-17 (2) — I15 done: missing-elements inventory

- **I15 closed** (`mapgen/ISSUES.md`): element inventory tool landed at
  `mapgen/experiments/2026-09-17-element-inventory.mjs`, report at
  `mapgen/out/inventory.md` (regenerate with `node
  mapgen/experiments/2026-09-17-element-inventory.mjs`). It parses all 146
  `data/biome/*.xml` + lua scripts and classifies every spawn function
  per biome against our renderer. Headline: 785 classified — 27 RENDERED
  (pixel-scene loaders, coalmine/holy mountains/oiltank), 6 AIR-HOLE
  (structure loaders, spawn_lamp), 752 PARTIAL (entity spawners —
  invisible by design + custom fns like vines/fungi we don't port).
- Anomaly-triage workflow now: find biome in `inventory.md`, see which
  element class we don't render → direct port target.
- **Next issue queue:** I9 (Yomi not loaded, HIGH) or I5/I6/I1 (lava band,
  walls, surface/poro noise — Ghidra family).

## Update 2026-09-17 (3) — I9 preliminary diagnostic (spliced pixel scenes / .plz)

> **CORRECTED (same session, user directive):** the note below was the
> pre-correction state; the current canon lives in `mapgen/ISSUES.md`
> (I9 DIAGNOSED block). Key correction: boss_arena content is a
> **predictable zone** (seed-independent static pixel scenes at fixed
> world positions) — same class as the HM bands / giant tree /
> mountains / moon, exactly as `mapcap/PREDICTABLE_ZONES.md` already
> lists `boss_arena(_top)`. It does NOT need seed-mechanism RE; the
> render fix is a predetermined-zone blit from the game's own scene
> data. Verified hard facts only: the .plz header layout
  (`1 | w: i32 (neg=mirrored) | h | 4 | compLen | rawSize=|w|·h·4` +
  4-byte trailer) and that the payload is the game's custom LZ
  (compressor `FUN_004225f0`/`FUN_00422b50`, decoder `FUN_00421e80`/
  `FUN_004223a0`), which we have not yet inverted. Earlier iteration
  guesses about token/offset semantics are NOT canon.

- I9 block placed, not closed. Findings recordered in `mapgen/ISSUES.md`
  I9 DIAGNOSED block: "Yomi" = the boss_arena region; selected on the
  hosted capture (ref_40_38/40_39 in `mapgen/out/ref-bossarena/`); root
  cause = the un-ported *spliced pixel scene* pipeline
  (`data/biome_impl/spliced/boss_arena.xml`, absolute world positions with
  `N.plz` + `N_visual.plz` + `N_background.png`).
- The `.plz` compressed-format RE is the direct blocker: header layout
  verified (`1 | w: i32 (neg=mirrored) | h | 4 | compLen |
  rawSize=|w|·h·4` + 4-byte trailer, all 97 files); the LZ stream is
  nollagames' own `pixel_scene_splicer.cpp` custom LZ (compressor
  `FUN_004225f0` (small)/`FUN_00422bf0-b50` (large) read; decoder
  dispatcher `FUN_00422e20` case 1 = 0x422510-family, case 2 = 0x422c10;
  the "FUN_00421e80 / 0x4223a0" pair is the /as-implemented/ decoder)
  which we could NOT yet invert empirically (all candidate decoders
  end at a 0x00001000/0xffff match-offset wall). The exact reverse of
  the game compressor — emitting my own "plz" from known pixels of a
  ref chunk — is the next decompilation target and is expected to close
  the semantics.
- Artifacts: `mapgen/experiments/2026-09-17-element-inventory.mjs` +
  `out/inventory.md` (I15); I9 diff scripts in `/tmp/opencode/`; ghidra
  dumps in `~/work/ghidra-logs/plz_*.c`, `plzx_*.c`, `plz2_*.c`,
  `plz_final_*.c`, `plz_dec_*.c`, `plz_compressor_*.c`,
  `plzz_8ba6f0.c`;
  `noita_dev.exe` path = `/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe`.

## Update 2026-09-18 — flow-first refraction (doc review + new dig)

**User mandate:** stop patching defects one by one; understand the whole
generation FLOW first. All docs re-read, no live contradictions (the fill
chain is closed for regular areas; the lab anomaly is scoped to the injected
biome). The full 13-stage lifecycle flow map with per-stage status is now
**VERIFIED.md §11**; hasPath oracle re-validated 4/4 same session.

**New binary digs (evidence in ABOUT_MATH §6 2026-09-18):**
- **Streaming path located:** `ProceduralTerrain::Update()` profiler string
  pins the UNREAD ~0x50b000 region = the per-frame lazy chunk-generation
  driver (frontier F1).
- **Engine debug flags exist:** DEBUG_GENERATE_BIG_WANG_MAP /
  DEBUG_FULL_WANG_MAPS are registered magic/debug flags (sites 0x472ee0 /
  0x4742d0; storage + readers unknown — frontier F4). If runtime-togglable,
  these may give an in-engine wang-only ground truth, removing the capture's
  non-wang-layer confound from all future validation.

**Next-session order (see VERIFIED §11 frontier):**
1. F1: read ProceduralTerrain::Update (~0x50b000) — dumps re-extractable
   without new Ghidra analysis (objdump method in ledger).
2. F4: find the DEBUG flags' storage + readers; probe whether
   magic_numbers.xml accepts them (test in dev build).
3. F2: finalize family from the binary (fillMainPath/fillC0ffee/
   fillRandomMaterials/ClearPath semantics).
4. F3: procedural noise terrain (poro perlin from generator +0x94) —
   unblocks ISSUES I1/I3/I5/I6.

## Update 2026-09-17 (4) — I9 fixed structure via predictable-zone spliced scenes

- **I9 structurally closed** (box not yet ticked — visual/tree family may
  want individual checks first): ALL spliced pixel scenes render now.
  Key insight (user): tree/mountains/boss arenas ARE predictable zones —
  their content is seed-independent static art. Proof from the tooling
  artifacts the game ships: `biome_impl/spliced/_*.bat` files run
  `wizard_physics.exe -splice_pixel_scene <name>.png -x <wx> -y <wy>` —
  i.e. every `N.plz`/`N_visual.plz` piece is a 512-slice of ONE source
  PNG placed at a fixed world origin. So `template-render.mjs` now has
  `SPLICE_PNGS` + `blitSplicedScenes`: blit each source PNG at its
  origin, palette colors mapped through materials.xml (air/alpha →
  below shows; unmatched palette → raw draw). Covered zones:
  boss_arena, tree, moon, moon_dark, skull, watercave, lake_statue,
  lavalake2, gourd_room, mountain_lake, lavalake_pit_bottom.
  Validated vs capture: arena/lava-lake shapes pixel-exact; ~41% of ref
  fg within ±20 (residual = material texture detail, generic shade
  class, not I9 structure). plz decode now UNNECESSARY for these
  renders; the .plz RE is only needed if per-material gameplay-accurate
  decode is ever wanted (keep `ISSUES.md` I9 plz facts as-is for that).
- I4/I7 note added: moon/dark-moon art now present via the same blit.
- Tests 5/5 pass. Cache r3c → r3d.

## Update 2026-09-18 (2) — stage-9 dig delivered (objdump-only)

Docs re-read; then the plan executed. **Headline: a shifted-slab trap was
found and corrected** — the Sep-18 "0x50b000 region" dig printed VAs off by
−0x400800 (objdump VA = true VA − 0x400800; pinned by byte-checking the
mixer constant at true 0x48fd47 and the two profiler-string stores). All
stage-9 VAs now corrected in ledger + VERIFIED §11:

- **PIXEL-SCENE ARM CLOSED (🔬):** ProceduralTerrain::Update() = FUN_0090b8a0
  → DoBufferedPixelScenes() = FUN_00910c20 (FULLY read: status-2 records load
  via FUN_00668800 + virtuals; others deferred until ALL FOUR overlapping
  512-chunks are loaded, probed in the chunk bit-grid DAT_0x132aed8);
  buffered-scene enqueue w/ dedup + flush = FUN_0090c1f0 (callers: LoadPixelScene
  binding 0x818c6e, Init 0x907fc9, buffer 0x90bd1e).
- **DAT_012eb130 (STREAMING_CHUNK_TARGET) readers FOUND** at 0x79e65a/f1/74f —
  three direct loads (the "getter family" hypothesis is dead): a per-frame
  budget regulator comparing thr / 2·thr / 3·thr, scaling double 0x132aef0.
- **Grid-write chain (cache-vs-regenerate answered in direction):**
  FUN_008f95c0 SetSize (float +0x18 / u16 +0x38 grids) has exactly 2 Init-side
  call sites (0x90738f, 0x907852) — the second is inside area-object
  construction with ECX = area+0x90 sub ⇒ **each AREA object's sub-object owns
  its float/u16 world grids, Init-built + area-cached; chunk loads READ them
  (no regeneration)**. u16 reader FUN_009fe4e0 = 19 call sites (noise_utils
  family 0x8fa000–0x8fb000 + isolated 0x64c80c, 0x90446c, 0x90dcd3-next-door).
- **Same session, later: chunk-materialization skeleton found.**
  DistanceField_UpdateForChunk = FUN_008e4990 (profiler string 0x1172b60),
  driven by per-Chunk staged state machine FUN_008e4ec0 (quadrant caches at
  ±0x100 chunk-halves via FUN_00939b80, states 0→0x247→0x24e→0x255→0x25c),
  dispatched as thread-pool functor (thunk 0xa99cc8, same family as the fill
  driver 0xa99ea0→0x904c20). Per-cell noise/material sampler FUN_0090d860
  = the F3 consumer (u16/float grid reads + smoothed noise FUN_00908cb0/
  FUN_00908e70, CRT-math IATs 0x114a434). **Remaining for F1:** the
  out_map→u16/float copier + the (3,3)/(+5,+13) anchor constants — leads:
  cache builder FUN_00939b80, Chunk member table 0x1179d00–0x117a190
  (chunk_top_left / chunk_world_index), chunk-grid ctor 0x791b80 (static-init
  at 0x405ee0). F2 decision point in VERIFIED §11 frontier item 2.

## Update 2026-09-18 (3) — F1 CLOSED

Read FUN_00939b80 (chunk-map cache builder: chunk_map.h asserts 0x1179e90/
0x1179ef0 "chunk_top_left" / 0x117a080 "chunk_world_index"; assert-guarded
getter-style with exception logging) and confirmed: it is the Chunk-map
Get-with-cache/Quadrant-prep used by FUN_008e4ec0's stages (4 quadrant
probes passing (cx±256, cy±256)), and its 0x8ea2dc/0x8ea4a3 call sites are
in the biome.cpp distance-fill sub-family 0x8ea030/0x8ea410 (mod-4 lattices,
7x0x200 stride sweeps = the 0x76c-record field updates). FUN_00fe4e0 = the
u16 TileGrid GET (wrap indices, load from [grid+0x18], helper FUN_00a242c0)
— verified READ-ONLY; no u16/float grid writes in any read chunk path.
The perlin core FUN_008fca60 family + consumer sampler FUN_0090d860 = F3's
kernel (constants ×0.1, 1/9, 0.5, 0.45/0.33/0.11, 0.94/0.95, 15.5).
**VERDICT: chunk loads never regenerate terrain** — Init-built area grids
+ runtime reads only (+ pixel scenes / distance-field caches).
The (3,3)/(+5,+13) anchor constants remain as frontier item **F-anchor**
(next read: FUN_008e6d50 chunk-map draw consumer + the fill copy-out walk).

## Update 2026-09-18 (4) — F2 finalize family decoded + has-path.mjs rewrite

**F2 status (this session): the whole accept/retry finalize family is now
located in-binary.** All leads live in `ghidra-ledger.md` F2 dig §1-§5 and
VERIFIED §11 stage 6:

| Step | In-binary | Notes |
| --- | --- | --- |
| hasPath | FUN_00901780 "ProceduralPathFind" (0x901780, 1 caller 0x905908) | runs on wang_image; JPS helpers 0xa4e2f0/a4e430; coalmine start mark = `cmp eax, 0xFF420000` → 0xFF000000 @0x901a4d; skip flag at stack+0x20 (0x9058e4); start_x=142 noitool claim obsolete |
| ClearPath side | warn path "couldn't clear start path finding area for the biome" (0x1173f28/0x1173f4c) inside hasPath; reset byte 0x1327699 | FUN_00900a50 = "CheckForGaps" (start frühe floods) |
| fillC0ffee | FUN_00900560 (procedural_terrain.cpp:0x180) | 4-neighbor C0FFEE/empty scan, `cmp eax, 0xFFEEC0FF` @0x900888-family; writes u16 deltas 0x2 (top) / 0x5 (left) via FUN_00949e80; rect pushes via FUN_00929850; checked_places queue |
| fillBlockedRooms | FUN_00901580 | **11-entry literal marker table @0x9015c4**: #ff00ff #ff0080 #ff0aff #c35700 #00ac64 #00ac6e #7868ff #70d79f #70d79e #70d7a0 #70d7a1 (noitool's 9-color list incomplete — missed 0x00ac64 + 0x70d7a0); per marker pixel: 2 ray-walks FUN_00901510 (max 0x2710 steps, white/empty end via `test 0xffffff`) + FUN_009013f0 rect bookkeeping; rects stored xmm-blocks + FUN_00929850 queue pushes |
| fallback fill | FUN_008ed860 (0x9056d0 triggers on byte 0x13276ba) | second Threaded call after the accepted attempt (same args 0x148/0x14c/0x150) — doCoalMineHax semantics live here |
| driver tail | funnel at 0x905890-0x9059xx | skip-flag gate (0x20 of stack) → hasPath → fill apply (0x90599e → FUN_0090150), coalmine start-path 'WANG AT:' logging |
| screening | FUN_00900a50 "CheckForGaps" | start_pos flood + black rect-blit 0x901450 (0x90599e = accepted-attempt tail per room) |
| fillMainPath | partially read | walk-loop details remain |
| Game data | `<BitmapCaves>` flags `do_beginning_paths` / `do_beginning_down` → the "coalmine hax" is XML-configured caving, NOT C++ (noitool DATA cmd) | confirmed at 0x4af032 sites + coalmine.xml :34-42, hills.xml:41-42 … |

**Does NOT exist in-binary:** noitool's `+5/+13` drawImageData magic
(0 hits for the byte-pattern; not the game's), and noitool's exact
`start_x = 142` claim. The coalmine start-path mark is the literal
`0xFF420000` compare at 0x901a4d.

**Rewritten file: `mapgen/lib/has-path.mjs`** (with all validations re-run):
1. `blockedColors` 9 → **11** entries (the binary table; adds 0x00ac64 and
   0x70d7a0).
2. `doCoalMineHax` / `undoCoalMineHax` constants → the overlay data's real
   values 0x006400 / 0x000064 (noitool-and-port constants were a silent
   no-op hitherto). **The hax is now ACTIVE in our pipeline** — coalmine
   out_map mutations (rock→white, blue→black, stairs→white) apply.
3. NOT ported (kept oracle-pinned, documented in the header): the exact
   ray-walk room growth semantics (FUN_00901510/0x9013f0) — next-session
   port target.
Validation: hasPath oracle **4/4** (excav 91→0, 92→3, 93→1; coalmine 91→1)
+ `npm test` 5/5 + chain-vs-spawn shifts unchanged (91 (3,3), 92 (3,2) 4/4,
93 (3,4) 5/5; excav-91's 2/3 pre-dates the rewrite — A/B verified).

**Next session order:**
1. Port the exact ray-walk room-growth semantics
   (FUN_00901510/FUN_009013f0) into `blockOutRooms` (replacing the
   ShadeOfGrey heuristic), oracle-validated again 4/4 + L3 IoU check.
2. WHOLE fill walk ordering of FUN_0090450 (fillMainPath detail read).
3. On have both: bump colorize cache (r3d → r3e? — the coalmine hax
   behaviors are now active, coalmine whites forced).
4. Then F3-read (perlin core FUN_008fca60 exact math) unblocks
   I1/I5/I6 (surface noise, lava band, sinusoidal walls).

## Update 2026-09-18 (5) — gen-cache clearing tools (dev QoL)

- User question answered (cache layers verified in code this session): a seed
  run through `gen:server` is generated once, then cached at THREE layers —
  (1) disk: `lib/world-gen.mjs` `ensureWorld` writes each generated+colorized
  area to `mapgen/out/gen-cache/<rev>/<seed>/<areaKey>.bin` (rev currently
  `r3d`, hard-coded in `server/genmap-server.mjs`); (2) memory: the server
  keeps a per-seed world map per process; (3) browser: tile responses are
  sent `Cache-Control: immutable`. The I8 west-lake fix never re-occurred on
  new generations because it landed WITH a manual revision bump (r3b → r3c,
  see ISSUES.md I8) — invalidation is MANUAL: a pipeline change without a
  revision bump keeps serving stale tiles.
- New tooling (all smoke-tested this session, tests 142/142 green):
  `npm run gen:clear [-- --seed N]` (CLI; use when the server is off) and
  `GET|POST /gen/clear/:seed` + `/gen/clear` on the genmap server (drops disk
  cache + in-memory worlds, bumps `cacheEpoch` exposed as `epoch` in
  `/gen/status`). The viewer appends `?e=<epoch>` to tile URLs to bust the
  browser's immutable tile cache, self-heals on status polls, and has a
  **regen** button = one-click fresh generation of the current seed.
  Helper: `mapgen/server/gen-cache.mjs`; test: `tests/mapgen/gen-cache.test.mjs`.
  Note: a running server must be RESTARTED to pick these endpoints up.
- genmap viewer got the telemetry box the main livemap always had
  (`public/genmap.html`): live seed/biome/position panel + **Center on player**
  button + **follow** toggle (re-centers on every telemetry update; drag or a
  manual seed load disables it, same rule as before). Live seed switches now
  also jump to the player once so the view starts at the run.

---

**Test battery (2026-09-18):** `npm test` is now a vitest battery in
`tests/` (the old node:test `mapgen/test/bench.test.mjs` was migrated into
`tests/mapgen/golden.test.mjs` and deleted). Layout:
`tests/mapgen/` (api-surface, prng, coords, biomes, wang-fill, golden,
has-path, colorize, world-gen, map-format), `tests/mapcap/`
(manifest/analysis JSON specs), `tests/bridge/` (telemetry JSON contract).
Data-dependent suites auto-skip without extracted data. New module:
`mapgen/lib/map-format.mjs` (+ `map-format-spec.mjs`) — JSON-serializable
palette-spec ("noita-livemap/map" v1) with serialize/serializeMapTiles
validate/diagnose codes E_FORMAT/E_VERSION/E_LEN/E_INDEX/...; use it to
spec-test any map/chunk output JSON. All 138 tests green.

## Update 2026-09-19 (final) — F-anchor CLOSED + F2 handover

> **READ `mapgen/VERIFIED.md` §9 (frontier) + `mapgen/CONSTANTS.md` FIRST;
> then this block. This session: F-anchor dug + CLOSED, registry built,
> noitool provenance tagged. Next session = F2.**

- **F-anchor CLOSED (negatively resolved, byte-pinned)**: the game has NO
  additive wang-cell↔world anchor constant. The fill driver (TRUE
  VA 0x904c20 = slab 0x504420, single thunk caller slab 0x6996a3 =
  true 0xa99e7x family, `mov 0x4(%ecx),%ecx; jmp`) copies the accepted
  out_map into the area grids by a **per-cell wrap-modulo copy**
  (x %= W, y %= H via `idiv`; dst `y·W+x`; 4-byte float per cell;
  slab 0x505610–0x5056a4) — no offset, no ÷10 anchoring, no additive
  constant. Init area-grid sizing = `[chunkExtent·512]÷10` (both
  F2-dig SetSize call sites true 0x90738f/0x907852 ✓). **The genmap's
  fitted (3,3) anchor = PORT-LOCAL artifact.**
- **Bonus pins riding on the driver:** FUN_008f9ab0 (the non-wang,
  seedless marker/cave sweep writing float −1.0 / u16 1 via a
  4-neighbour vote) is called TWICE from the driver (slab 0x5055d7,
  0x50571e) — cave-structure seeding is part of fill-apply, not
  independent; stage-8 spawn walker emission pinned in the same driver
  (slab 0x5054fc → true 0x900c70 ✓); the copy helper slab 0x52c820
  (identity open) is shared with the Init walk (slab 0x506bbd).
- **VA-mapping rule (C13 — TWO incidents this session, must not
  repeat):** `text.bin` = file[0x400c00:0xdd0000] + adjust-vma 0x401000
  ⇒ **slab VA = file_off + 0x400; TRUE (Ghidra) VA = slab + 0x400800**.
  Proof anchor: hasPath's `cmp eax,0xFF420000` at slab 0x50124d = true
  0x901a4d. Mixing Ghidra names with objdump output requires ALWAYS
  converting and pinning a known constant inside the target BEFORE
  trusting its read. Label both VAs in every entry.
- **Registry (new)**: `mapgen/CONSTANTS.md` C1–C15 — hasPath constants
  (C1–C4), ÷10/÷100000 magic + Random(min,max) closed form (C5–C7),
  cache-builder read (C8), SetSize sites + float-grid layout (C9–C11),
  assert pins (C12), VA map (C13), stb/fill ÷10 corrections (C14),
  true-0x8e6d50 painter read (C15). Standing rule in ISSUES.md §facts:
  register before use. `@prov noitool` tags = the remaining noitool-debt
  map (12 annotations in 6 files; biggest: wasm fill in bench + tests,
  start_x=0x8e, name-list flags with UNDETERMINED in-binary selection —
  the data-audit note in ISSUES.md records the correction that
  coalmine.xml carries NO do_beginning_* attrs).
- **Test battery green all session: 142/142 (13 files).**

### NEXT SESSION — ordered (F2, fresh session):

1. **Port the ray-walk room-growth semantics** (FUN_00901510 /
   FUN_009013f0; ledger F2 dig #5 has the marker table + queue
   machinery) into `blockOutRooms` (`lib/has-path.mjs`), replacing the
   ShadeOfGrey heuristic; oracle re-validate 4/4 + `npm test`.
2. Then, in the **now-pinned driver (slab 0x504420)**: read the u16 copy
   loop at slab 0x5057xx (confirm "atlas blob already cell-scaled" +
   wrap semantics → port's out_map layout aligns), then ClearPath /
   fillC0ffee / fillRandomMaterials exact semantics (F2 queue order in
   VERIFIED §11 frontier item 2).
3. Optional small reads before/alongside: FUN_008f9ab0's caller context
   (the `<BitmapCaves>`/cave-structure trace) and 0x52c820 identity.
4. Cache rev bump r3d → r3e when the port changes observable output
   (manual bump, hard-coded in `server/genmap-server.mjs` ~line 34).
Tooling: slab extract
`python3 -c "f=open('/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe','rb').read(); open('/tmp/opencode/text.bin','wb').write(f[0x400c00:0xdd0000])"`
then `objdump -D -b binary -m i386 --adjust-vma=0x401000
--start-address=SLAB --stop-address=END /tmp/opencode/text.bin`
(/tmp/opencode/text.bin is ephemeral — regenerate per session).

## Update 2026-09-19 (2) — F2 blockOutRooms ported + biome selection determined + reference-frame audit

- **blockOutRooms now binary-exact** (ABOUT_MATH 2026-09-19 (7);
  CONSTANTS.md C16–C18): FUN_00901510 ray walkers (BLACK-only runs,
  `testl $0xffffff`, max 0x2710) + FUN_009013f0 record fills (16-byte rect,
  **EXCLUSIVE ends**) + FUN_00901580 dispatch (two rays, white literal fill,
  degenerate records kept). ShadeOfGrey run-on ELIMINATED (was port-local;
  whites dropped ~10-13% on the 4 real fixtures). Oracle 4/4; tests 143/143;
  cache r3d → r3e.
- **isCoalMine/shouldBlockOutRooms selection DETERMINED** (dig #2 (8);
  C19–C21): in-binary gates = template-path equality against
  `data/wang_tiles/{coalmine,excavationsite}.png` literals — never biome
  name. `lib/biomes.mjs` flags now derive from templateFile (name-list
  @prov debt retired); affected biomes exhaustively = {coalmine,
  tower_1, _EMPTY_} ∪ {excavationsite, tower_2}. start_x=142 mystery =
  the stairs-band search (x 140..157, y 0..14, `0xfffefefe` cells).
  Census: 42 wang-template biomes of 174 mapped; only 3 template-path
  literals exist in the whole binary.
- **Reference-frame verdict (9):** coalmine DEMOTED to stage-6 special-case
  fixture (inherited reference from noitool; most special-cased biome →
  bad general oracle; noitool's shipped hax was a silent no-op there).
  Absolute references = `mapgen/VERIFIED.md` + reference seeds
  78633191/92/93 (canon statement now in VERIFIED §10).
- Non-wang-template taxonomy (audit): no-template biomes = static template
  content (predictable, template-render) UNION 47/55 carrying poro-noise
  params (seed-DEPENDENT — F3/I1). "Not wang ⇒ predictable" is only true
  for the static half.

### NEXT SESSION order:
1. F2: ClearPath / fillC0ffee / fillRandomMaterials exact semantics
   (in-binary reads; bytes at driver tail slab 0x504420+); stairs-band →
   path-start consumption detail (C20 arm 2); driver u16 copy loop at slab
   0x5057xx. On observable change: cache r3e → r3f.
2. F3: poro perlin (FUN_008fca60 family) → unblocks I1/I3/I5/I6 (surface
   band + noise template biomes; see the audit's taxonomy).
3. Rebuild gen-cache r3e for changed seeds if visual check needed
   (`npm run gen:clear` / regen button).
Tooling: slab extract per SESSION_CONTEXT 2026-09-19 (final) command;
rooms dump at /tmp/opencode/rooms.asm (ephemeral).

## Update 2026-09-19 (3) — F2 dig #3: search-side machinery + driver tail CLOSED

- **FUN_00900560 decoded** (C22): the hasPath C0FFEE walker = FIFO BFS over
  4-byte out_map cells with a SCRATCH visited grid carrying flow-field
  direction codes {2 down, 3 up, 4 right, 5 left}; judge =
  black ∨ `#c0ffee` (0xffeeffc0 — corrects dig #4's byte-reversed
  `0xFFEEC0FF`). Map read-only in this walk; dig #4's "u16 deltas 0x2/0x5"
  = partial + wrong-grid attribution (now canon-corrected in C22).
- **hasPath overlay arms** (C23): #fefefe stairs band (x 140..157, y 0..14;
  the true mechanism behind noitool's "start_x = 142") + #004200
  (0xFF004200) overlay→black scan. Both DEAD with the current overlay
  data (0 px) → port unchanged, **no cache bump** (r3e stands).
- **Driver tail CLOSED** (C23): no u16 copy loop exists; slab 0x5056a4 =
  second-grid SetSize (float, 4-byte) → FUN_008f9ab0 (flag=1, call #2) →
  ret. u16 population lives entirely inside FUN_008f9ab0. F-anchor's
  no-anchor verdict re-confirmed over the full out_map write path.
- **Scope state of hasPath:** arms + call ordering + mark colors decoded;
  the segment-walk/search internals remain only partially read — the
  oracle-pinned port (4/4 + 8/8) stays; full re-derivation only if a
  regression demands it.
- Tests: 143/143 green (13 files). Tests: baseline = 143 (one new pin above
  the old 142).

## Update 2026-09-19 (4) — F2 CLOSED (dig #4)

The register is done. F2's full scope (accept/retry + out_map mutations +
biome selection + search-side machinery) is decoded binary-exact with the
following deliberate scope-outs (documented, oracle-pinned):
- hasPath's segment-walk/SEARCH internals = partially read; port stays
  oracle-pinned (4/4 + 8/8); re-derive only on regression (dig #3 note).
- fillRandomMaterials + the RandomColor consumption = the biome-def
  parse family (true 0x8eb3xx) + the stage-12/F3 materializer family —
  NOT hasPath's; follows F3.
- BIOME_PATH_FIND_WORLD_POS_MIN/MAX_X (159/223) = RUNTIME config doubles
  from the parsed biome-def object (writer slab 0x50693a/47 → globals
  0x1327670/0x13289a8 → reads at 0x505061/0x5077xx + the log 0x506972).
  Values remain engine-side; port stays tagged.
- ClearPath = logging-only (no spatial mutation); contract = NIL.
- Driver tail: no u16 copy loop (closure C23) — F-anchor no-anchor holds
  across the whole out_map write path.

Canon state: VERIFIED §11 frontier item 2 = F2 CLOSED; C23/C24 rows +
Index updated; ABOUT_MATH entries (10)/(11) landed. Tests 143/143 green.
Cache r3e stands (no observable changes from digs #3/#4).

## Update 2026-09-19 (5) — F3 dig #1: the noise core is SIMPLEX (not value noise)

- **F3 started. C13 anchor re-pinned first** (slab 0x50124d `cmp
  eax,0xFF420000` ✓). All slab/true VAs below follow the C13 map;
  .rdata constants read from the raw file (`file_off = VA − 0x400e00`,
  convention verified vs 200000.0f/100000.0f/0.5/2147483647.0 pins).
  Full detail = ABOUT_MATH 2026-09-19 (12); constants = CONSTANTS.md
  **C25–C28** (per standing rule, registered before any porting use).
- **Core = 2D SIMPLEX noise**, true FUN_008fca60 (slab 0x4fc260):
  F2=0.3660254 @0x11dfa34, G2=0.2113249 @0x11df9c0, 2G2=0.4226497
  @0x11dfa4c; gradient = `perm[perm[j]+i] & 7` over perm **0x114ced0**
  (≥4 axis-swap, bit0 sign-flip, bit2 ±2.0), contribution dot·t⁴
  (t = 0.5−d²), **final ×40.0** @0x11e0270; 3D twin true 0x8fcce0
  (F3=1/3, G3=1/6). Second family = **quintic lattice noise**
  (true 0x8fc740 slab 0x4fbf40 + true 0x900900 slab 0x4fc100, perm
  **0x114d700**, quintic 6.0@0x11e00e8 / 15.0@0x11e01a0).
- **The noise transform true FUN_00908cb0 (slab 0x5084b0)** pins the
  whole recorded-constant ledger in one function: ×0.1 (as f64 @
  0x11dfd08), 0.13717/0.13715 (f64), **1/9** (f64 @0x11dfd20),
  0.45+0.1, (1−w)·0.33+0.111 — AND it reads the C24 runtime globals
  0x1327670/0x13289a8 as coordinate offsets ⇒ the 159/223 family and
  the noise args are CONFIG-coupled.
- **Sampler FUN_0090d860 (slab 0x50d060) flow read** (identity double-
  anchored by the C12 idiom + the driver's 0x549680 getter): per-cell
  gate = float field grid +0xb4 **> 0.5** → FUN_00908cb0 eval →
  smoothstep (3.0/2.0/0.5) → second lattice noise true 0x908e70 →
  paint arm (u16 write via 0x559de0, RGBA grid +0x180, vtable).
- **Mystery #2 RESOLVED statically (C28):** the biome-def
  `[+0x38]/[+0x40]` "Wang offset" doubles belong to a per-biome map
  class (accessor true 0x909DA0 slab 0x5095a0: additive offsets over
  `[+0x50]×[+0x54]` wrap-mod into vector +0x68); the config keys
  (BIOME_USE_BIG_WANG @0x116c762, BIOME_PATH_FIND_HEIGHT_LIMIT
  @0x116c776, BIOME_PATH_FIND_WORLD_POS_MIN_X @0x116c7da, MAX_X
  @0x116c85e) have ZERO imm32 refs in the whole exe (control-verified
  vs the coalmine literal's 4 known hits) ⇒ values = engine
  ConfigRegistry defaults, NOT XML. **Port's 159/223 stays
  `@prov noitool`**; static side closed pending a runtime probe.
- Generator state chain (C27): FUN_008f9470 ctor (slab 0x4f8c70,
  diddle-anchored @0x4f8d5d) = diddled ws → Random ctor + ONE Next
  draw (two 0xc090c0 calls) → `[+0x94] = f32(draw×200000−100000)`;
  FUN_0090ce20 (slab 0x50c620) = the 0x1ec-byte world-grid object ctor
  (sub-object +0x98, seed arg pushed from [ebp+0x8]). A +0x94 READ
  site found at slab 0x50c9d5 (true 0x90d1d5) → offsets noise args →
  call true 0x909DA0.
- Ledger-prose corrections: the core is NOT "smoothed value noise";
  the 0.94/0.95/15.5 trio was never in the core (0.94/0.95 remain
  UNPINNED — do not cite as read).
- Tests 143/143 green (13 files); cache r3e stands (no observable
  change this dig — no port code touched).

## Update 2026-09-19 (6) — F3 dig #2: FUN_00908cb0 decompiled + lattice completed

- **FUN_00908cb0 (slab 0x5084b0..0x50866f) fully decompiled** (every op
  transcribed, JS-ready recipe in ABOUT_MATH 2026-09-19 (13) ↔ C26):
  computes the ×0.1 lattice coords `u,v = f32((adjX/Y+0.5)·0.1)` from
  the C24 config-offset inputs (adjX = inX+gMin), then returns them
  NOISE-DISPLACED: `wk = simplex2d(adjX·13715e-5, adjY·13717e-5)·0.45+0.1`;
  `out.x = u + lattice2d(adjY/9, adjX/9)·(1−wk)·a` (ARG ORDER SWAPPED on
  the first lattice call); `out.y = v + lattice2d(adjX/9, adjY/9)·
  ((1−wk)·0.33+0.111)·a`. Early-return path keeps the raw (u,v) when
  a ≤ 0. The caller then smoothstep-interps (3.0/2.0/0.5) between grid
  corners of the DISPLACED coords — a perlin domain-warp of the
  material-grid lookup.
- **Quintic-lattice noise completed** (C29): 2D gradient perlin,
  quintic fade `6.0/15.0/10.0` (0x11e00e8/0x11e01a0/0x11e015c pinned),
  perm 0x114d700 `&0xff` wrap, hash `perm2[perm[perm[i]+j]] & 7`,
  4-corner bilinear; gradient VALUES from a runtime .data table
  (0x12eec08/0x12eec0c, stride 8 — not statically readable).
- **Second evaluator true 0x908e70 read** (C30): anisotropic lattice
  (x·0.035, y·0.07) → warp (+q·15.5)·0.0489275 → simplex2d → lower
  clamp at 0.5 of `a + s·((a−0.5)·0.5)²·5.35·0.95`. **The ledger trio
  15.5/0.95 lives here** (0x11e01b0/0x11dfbac pinned); 0.94 remains
  UNPINNED anywhere.
- **Generator-plant walk resolved (F3 (d)):** FUN_0090ce20's sole caller
  = true 0x90f680 (slab 0x50ee80) — `malloc(0x1ec)` + ctor with seed =
  raw `WORLDSEED::GetSeed()` (e8 → true 0x9119d0 ✓), cell coords stored
  at [+0x90]/[+0x94], in the "IMPL_DoBufferedPixelScene - add to cell
  grid" Init job. ⇒ noise diversity is location-driven (cell coords +
  per-biome Wang-offset doubles C28); the +0x94 chain is uniform per
  worldseed — the F3 RNG question collapses to mSeed-family semantics.
- **VA-CONVENTION WARNING (new open item):** e8 targets print BELOW the
  slab base in two verified-shape sites (`0x4c8b0` floor helper; canon
  C20's `0x43ff0` string helper). The +0x400800 algebra yields
  in-image CRT true VAs (0x44d0b0/0x847ff0) but both are Ghidra-
  unverifiable this session — registered as an OPEN row in
  CONSTANTS.md; no true-VA claim for either; consumed by context only.
  Dig #3 first item: settle the e8-target convention byte-exactly.
- Tests 143/143 green; cache r3e stands (no port code touched).

### NEXT SESSION — F3 dig #3 (ordered):
1. **Settle the e8-target VA convention** (byte-equality harness: pin a
   known helper through its bytes in the exe at the C13-consistent
   candidate true VAs 0x44d0b0/0x847ff0 vs the raw printed values).
2. **Port FUN_00908cb0 + the two lattice noises + 0x908e70 to JS**
   (`mapgen/lib/noise-proto.mjs` prototype), driven by the sampler
   grid contract (float gate >0.5, u16/RGBA paint).
3. Find the per-cell CELL-COORD source in the plant walk (what feeds
   [gen+0x90]/[+0x94]) and the walk caller of the 0x50c9d5 consumer —
   confirms the noise input mapping vs captures (I1 surface band).
4. Validate noise output against the capture's flat-region stats;
   bump cache r3e → r3f ONLY on an observable port change.
5. F4 remains optional (DEBUG flag storage + readers).
6. Standing: register constants BEFORE use; label both VAs; re-pin C13
   (slab 0x50124d) first on a fresh slab; the handover rule applies.

## Update 2026-09-20 (1) — F3 dig #3: e8-target convention SETTLED

- **The convention is resolved byte-exactly** (C13 addendum + OPEN row
  closed): the slab extract covers only .text's second half (file
  0x400c00.. = true 0x801800..). Below-base e8 prints = calls into
  .text's LOWER half (true 0x401000..0x801800, file 0x400..0x400c00),
  outside the extraction. C13 conversion is universal: printed-slab
  target + 0x400800 = true VA. Byte-verified: the FUN_00908cb0 floor
  helper = true **0x44d0b0** (exe file 0x4c4b0: prologue + cvtss2sd +
  fld/fistp round family = floorf ✓), and canon **C20's `0x43ff0` is
  corrected to true 0x4447f0** (the old "FUN_0043ff0" mental name was
  never a Ghidra-verified address).
- First noise-port step landed: `mapgen/lib/noise-proto.mjs` = a
  SKELETON carrying the byte-extracted perm tables + all pinned
  constants (C25–C30), with explicit TODO gates: (a) the lattice
  gradient VALUE table is runtime-only .data @0x12eec08 (unextractable
  statically — needs a runtime dump or a smarter init-trace read);
  (b) the C30 clamp direction re-verification. The runnable formulas
  remain dig #4 work (the decompile prose stands in ABOUT_MATH (13)).
- Tests 143/143 green; cache r3e stands (no observable change).

### NEXT SESSION — F3 dig #4 (ordered):
1. **Write the runnable port** into noise-proto.mjs from the ABOUT_MATH
   (13) recipes (simplex2d, quintic lattice, FUN_00908cb0 transform,
   0x908e70) respecting `f32` (Math.fround) boundaries.
2. Resolve the gradient VALUE table: try the runtime init trace (who
   writes 0x12eec08 — scan imm32 in the whole exe file, not just the
   slab; the init may run before the .data section cools).
3. Per-cell INPUT mapping: the walk around slab 0x50c9d5 (true
   0x90d1d5) + the plant context — determines world-cell → noise-arg
   mapping vs biome XML params (mInsidePerlin family).
4. Nominal GOAL: reproduce the surface-band noise vs the reference
   tiles (seed 78633191, flat-region rms) → I1; bump r3e → r3f only
   on an observable pipeline change.
5. F4 optional (DEBUG flag storage + readers).

### NEXT SESSION order:
1. F3 (the only remaining big frontier): perlin noise terrain —
   FUN_008fca60 core math + the +0x94/mSeed chain + the fillRandom
   (u16-material) family reads (I1/I3/I5/I6 surface band incl. 47
   no-template noise biomes per the reference-frame audit taxonomy).
2. F4 (optional parallel): the DEBUG wang-map flags' storage + readers —
   if togglable = in-engine ground truth for everything below.
3. F2 closed-out obligations: none besides regressions (r3e valid).

## HANDOVER ADDENDUM — 2026-09-21 (dig #21, surface close-out session)

(The sections above are pre-dig #4 and partially stale; VERIFIED.md is
the current canon — this block is the delta since the 2026-09-20 night.)

- **P5 CLOSED (ABOUT_MATH 2026-09-21 (38), CONSTANTS.md C44):** the
  three Random(min,max) band stacks = fn A true 0x8EEC70 (layer 1) +
  fn B true 0x8F5DD0 (layers 2/3), built per BitmapCaves instance by
  fn C1 true 0x8F2FF0 (dims = `<BitmapCaves size_x/size_y>`, hills
  512×256 ✓; name-keyed cache std::map @0x132aae8 = the CE px-share
  explained). NO C37 config slot read anywhere in the family —
  "mGradient* = band-stack params" ELIMINATED; the values are pinned
  .rdata (A,B) constants over a fresh per-build poro Random.
- **W2 closed empirically** (the user's CE paste, (35)): noiseType int
  = dispatcher case 5 for SIN_CAPPED_SIMPLEX (the 0x8fc020 core = our
  simplex2DDeriv). All 36 live noise_type attrs = that name.
- **Port wired (SURFACE_V2 lane, noise-terrain.mjs + noise-proto.mjs):**
  noiseKind 5; mult slots renamed gradWCoef (+0x268 = the
  mMultiplierPerlin VALUE, default 1.0) / perlinCoef (+0x264 = the
  mMultiplierGradient VALUE); cases 2/3 still throw; the gradAt ramp
  stays the injected instrument (the cave-builder fn B ≈113 KB —
  NOT ported). Tests 143/143 ×3 runs. **Cache r3f → r3g** (observable).
- **Validation instrument** `mapgen/experiments/2026-09-21-surface-shape.mjs`
  vs regenerated ref (`mapgen/out/ref`, tx 29..47 × ty 0..19, 380
  chunks): handoff window (ty 11..19) allPixelRms 73.5 / flatRms 48.7 /
  refSolid 0.690 vs ours 0.429 — I1/I3/I5/I6 NOT closed; FIND: that
  window holds ZERO procedural-noise chunks (the noise band lives at
  biome rows 0..2), so the noise-band self-instrument is the next gate.
- **Next dig:** (1) the noise-band self-instrument (the hills-band
  chunk rows) + the fn B blob/stamp cave builder port to replace the
  injected gradAt; (2) W4 cases 2/3 trig lanes + case-4 head + fbm
  BSS-state octaves (optional); CE harness = mapgen/CE_LUA_PICKUP.lua
  (reusable).

### dig #24 (2026-09-21): the noise-band self-instrument — RUNNABLE, first verdict landed
**Root cause of the long-standing "zero procedural chunks" diagnostic
(3 sessions): a coordinate slip.** noiseChunkMask(tx, ty) takes CANVAS
ty (it subtracts SKY_ROWS itself); the noise-family areas live at CANVAS
cy 48..82 (= biome rows 0..34; tx: lake 4-10, hills(_EMPTY_) 6-42,
desert 45-58, pyramid 53-57). The prior windows mis-probed:
- the handoff window (ty 11..19) = the WANG band in canvas space — no
  procedural defs there (correct negative, wrong frame);
- the "ty 0..10" pass DID score the noise band through worldColorAt
  (canvas 48..58: refSolid 4.5% vs ours 6.1%, flatRms 32.5) but was
  misread as "the ref = the SKY band" and dismissed;
- the instrument's ref-filename used the CANVAS cy (29_48.png) while
  bench:ref writes BIOME-ty files (29_0.png) → exists() failed → 0 rows.
**Fixed (mapgen/experiments/2026-09-21-noise-window.mjs →
mapgen/out/noise-window-2026-09-21.json), SURFACE_V2=1, 240 V2 chunks
measured in tx 29..47:**
- the biome-ty 12..14 band (canvas cy 60..62 = the snowcave/desert-top
  band) shows genSolid 0.009..0.096 vs refSolid 0.9..1.0 — our noise
  lane renders ~NOTHING solid where the ref has the solid underground
  band; chunk flatRms there ~168-213.
- v2 chunks with a flat mask: 30, median flatRms 61.5, none < 20.
- below-gate paths score the [+0x264]·r' unit (0.47927 @ a 0.55-field
  probe ✓ the shape math holds).
- **VERDICT (the first closure-grade instrument finding): the noise-lane
  zeros are NOT the density confound — the makeGradAt RAMP-INSTRUMENT
  produces sub-0.5 fields in the desert/hills band (desert.xml's
  mGradient High/LowNoise = 234.057/−292.571 with NoiseScale 0.00128571 =
  a sin-multiple-family unit that the ramp prototype does not implement).
  I1's root = the band-stack field build (fn B) is the missing source.**
- the frame-slip (biome-vs-canvas ty) must be cited by any future window.
- No issue box closes on this run alone (desert/hills band only; the
  lake (tx 4-10) and pyramid (53-57) sets need their own ref fetches —
  a 2-line bench:ref window extension).
- Tests 143/143 ✓ (the dig #24 run).

### dig #25 (2026-09-21): the C39 IMAGE-LANE gradAt — ported, verdict quantified
Port: biomes.mjs now parses `bitmap_noise_file` (the C39 image-lane attr);
noise-terrain.mjs bakes the topology PNG to a per-cell float grid
(loadFieldGrid) with the C32 fallback-grey lane ((R+2G)/3.0f/255, flagged —
the per-biome A-channel resolver = config-side, unresolved) and the
wrap-mod getter (C32 rule). noiseChunkMask consumes it first, the ramp
instrument second.

**The lake-window verdict (tx 4-10 × biome ty 0-15, 77 chunks, ref
fetched): still genSolid avg 0.041 vs refSolid avg 0.149; the cy-62 band
flatRms ~91-94, refSolid ~0.6; the cy-63 band = genSolid 0.1 vs
refSolid ~1.0.** Careful read: the ±1.0-marker cells = the A-resolver's
material ids in-binary (unidentified per-biome), so the fallback-grey
bake scores ~0.004 — SUB-0.5 ⇒ the zeros persist even with the image
lane present. The remaining gap = the per-biome A-RESOLVER ([+0xb0]
bodies = C32's open read) + the mGradient-rasterize semantics — the
NEXT dig's first read, not this lane's wiring (which lands byte-true).
Tests 143/143 ✓ (the dig #25 run).

## Update 2026-09-21 (2) — surface wiring audit + 4-task close-out (dig #26)

User prompt: "generate the proper surface levels, last session got confused —
check up where we're at and audit the results." Docs fully re-read, then a
disk audit (noise-window JSONs re-parsed, tests re-run) confirmed dig #24/#25
verdicts; tests 143/143. The "confusion" was the dig #24 frame slip
(canvas-ty vs biome-ty chunk rows) — instruments on disk now cite the frame.

**Task 1 — SURFACE_V2 wiring FIXED (audit finding, was NOT in any doc):**
`noise-terrain.mjs` gated the V2 lane behind SURFACE_V2=1 but nothing set it
while `genmap-server.mjs` had already bumped the cache to r3g "as the V2
state" ⇒ any server-generated bing carried the OLD kind-8-proxy lane and
was cached as r3g = mixed provenance. Fixed: the V2 lane is now DEFAULT
(`SURFACE_V2=0` = explicit opt-out for A/B), cache r3g → r3h (comment + dir),
the mixed r3g dir DELETED, world-gen tests green.

**Task 3 — bench:ref window EXTENDED:** `pipeline/1-fetch-capture.mjs`
defaults now x 4..58 × y 0..19 (the lake tx 4..10 / hills 6..42 / desert
45..58 / pyramid 53..57 noise-band floor, dig #24 census); ref grid
re-fetched = 1100 chunks, tx 4..58 × ty 0..19, ZERO gaps.

**Task 2 — the W5 field-build dig ( begun, NOT closed ):** fn A
(true 0x8EEC70) READ to walk level per-stamp recursion = the cave_childs
mechanic); helper family pinned: blob setter true 0x8EE750
((x,y,r,value,flag); flag-1 falloff CLOSED (43): (r−d²)/r interp →
(v_arg−1)·t+1 → ((y_int−1)/25@0x11e01e0)⁸·v0+1 near top rows; write =
MAX-BLEED), scatter node true 0x8EF2D0 (1 Next draw, point roll
−0.5@0x11e058c lanes, cell<0.5 gate, recurse into true 0x8FAFC0 — the
OPEN worm-branch body). Data side re-verified = hills.xml's full
BitmapCaves attr set + 10 CaveStructure stamps. NO port landed; sub-read
queue = (0x8FAFC0, fn B worm/surface/mountain machinery, fn C1/C2 wiring).
All bits in CONSTANTS.md **C46** + ABOUT_MATH (42)/(43); asm dumps kept
in-repo: `mapgen/out/caves-fnA.asm` / `caves-fnB.asm`.

**Task 4 — CE probe harness v4 added** (`mapgen/experiments/CE_LUA_PICKUP.lua`
appended block): V4a = uid byte-block +0x240..0x24f (pins the slope flag's
XML/align ([+0x24c] byte source); V4b = the C24 runtime config doubles;
V4c = the BitmapCaves std::map header; V4d = the A-resolver fn ptrs
([P+0xb0]) — dig #25's unresolved link; V4e = a first 0x132aae8 node
walk (offsets = flagged ASSUMPTIONS std::map<int,0xb8*-family> — verify
against the hexdumps before believing valObj). Run in-game; paste back.

**NEXT SESSION — ordered (fresh session):**
1. 0x8FAFC0 worm-branch read → fn B worm/surface/mountain machinery →
   fn C1/C2 wiring; then the caves-field port into
   `lib/caves-field.mjs` (band stacks dig #21 + stamp walk dig #26) —
   gate via SURFACE_V3=1 until the I1 instrument shows shape gain.
2. Paste back the CE v4 output → the slope-flag XML source, the C24
   doubles, and above all the A-resolver ([+0xb0]) identities.
3. I8-style ol' queue unchanged (P1/P3/P5 liquid families next).

## Update 2026-09-21 (3) — dig #26/#27 (no-CE session): the W5 noise-family decode + fn B phase map + the byte oracle saved

**Second CE column processed (user):** V4f = the [P+0x94] signature
(cave grids 512→2560.0 = the fn C1 ×5 toucher byte-cross-verified; 1×1 →
5.0; the 3584×2457 WORLD grid = the RAW C27 draw −56909.828125, no ×5 —
not a caves-factory product); V4g = the dense grid dump SAVED as the
port's byte oracle (`mapgen/out/oracle/caves-grid-2026-09-21.json`) —
both 512×256 cached grids (0x26599020 / 0x338CB020) BYTE-IDENTICAL, the
caves field = deterministic (diddled ws, name, XML params). The y=0
bump (peak 1.454092 @x≈19, ±10 falloff) = a stamp ADD-BLEND over the
1.0 base (NOT the (y/25)⁸ eave, ≈0 there), writer = the 0x8EF870 image
blend twin / a bake = the named identify target. All canon in
CONSTANTS.md **C47/C48** + ABOUT_MATH (44)/(45).

**Static digs landed AFTER the CE pairs (about the port's blockers):**
- fn A (true 0x8EEC70) READ to walk level (dig #26 (42)): the
  CaveStructure stamp walker (≤50-step x-wanderer; roll += d·0.35−0.25;
  carve v = clamp01((d2·0.32+0.35)·roll); 0.2/0.6/0.7 envelope;
  setter call 0x8EF750; per-stamp recursion = cave_childs) + helper
  family pinned (blob setter true 0x8EE750 = max-bleed +
  circle falloff CLOSED incl. the ((y_int−1)/25)⁸ top-row eave;
  scatter engine true 0x8EF2D0; blends 0x8EF870/0x8EF950).
- true 0x8FAFC0 (dig #27, (46)) = NOT a worm — the B-CHANNEL/script-mark
  recorder (C32's in-binary twin: byte counter, +0x58 byte grid,
  {x,y,B,B−1} +0x80 records via 0x52e370); "worm-branch" label RETIRED;
  true 0x8EE930 = the blob-setter smoothstep twin; fn B (0x8F5DD0)
  PHASE MAP read via its callee census (fn A #1 @slab 0x4eff03 → two
  blob phases 0x4f036d/0x4f095f → ctor 0x4f293c-adjacent-loader pair
  0x533860/0x5bffb0 → byte blend → layer-2 setter 0x4f18d1 +
  scatter 0x4f1d5d → layer-3 setter 0x4f226c + scatter 0x4f26fb →
  RECURSIVE self-call 0x4f2a3c = the cave_childs/surface recursion).
- Remaining port sub-reads (named, ordered): fn B per-phase block
  semantics (layer setter arg masks @0x4f1xxx/0x4f22xx, aabb
  arithmetic, the beginning-paths lane = do_beginning_paths/down),
  then fn C1/C2 wiring, then caves-field port (`lib/caves-field.mjs`,
  byte-validated vs the saved oracle) gated SURFACE_V3.
- No further CE runs needed BEFORE the port; CE returns for (a) the
  retargeted V4d A-resolver hunt (material-name phase, optional
  pre-pay) and (b) the post-port different-seed V4g validation.

## Update 2026-09-21 (4) — dig #28: fn C1 byte-exact + the caves-field skeleton lands

- **fn C1 end-to-end (ABOUT_MATH (47))**: (name, uid) → std::map
  find/insert @0x132aae8 → **the full 0xb8 init: grids SetSize/alloc +
  ZERO-FILL + a 1.0-F32 BASE BAKE (`0x3f800000` @slab 0x4f29c2 = the C48
  oracle's base byte-settled) → the ×5·w = 2560 toucher ([+0x94],
  byte-cross-verified C48) → the poro ctor (C27 diddled ws + ONE draw,
  0x523a0) → fn B call (0x4f2a3c) → map-insert → ret.**
  fn C2 (true 0x8F3260) opEND: blob-clone base + three-grid alloc + the
  full XML knighting chain ([eax+0x2c/28], [eax+0x38/34] int pairs +
  the JSON-LUA 0x3eaa80 hooks; 'caves country' template pull via the
  0x1346cd8 =0x2c-byte slot cache head). The layer PULL pattern stands
  as the same id.
- **`mapgen/lib/caves-field.mjs` skeleton LIVE** (exports buildCavesField,
  carveCircle, stampWalker, makeCaveStructureGrid): the carveCircle primitive
  byte-exact (the (43)(a) block: the (r − dist)/r t-blend, the (y_int−1)/25⁸
  top-row eave with the 0x11e01e0=25 f32 pin, the MAX-BLEED write); smoke
  on the C48 oracle: the ± endpoints match byte-exact — the interior
  SHAPE (the y=0 bump's exact envelope, peak 1.454092 @x≈19) does NOT
  match any of the naive shape probes (sqrt-cap, sphere-cap, linear
  cone, quintic-arc — max|err| ≈ 0.10..0.17) → the bump's writer stays
  under the NEXT CE runtime-pick (fnB's per-phase block bodies with the
  0x11dfa5c=.45 value path — same path as the C47/C48 closure).
- fnB/fn-C1 texture-phase map (dzekc (46)-(47)): full — the C1 → fn B →
  the (fnA-stamp + two 0x8EE930 blob phases + the 0x533860/0x5bffb0
  loader + layer-2 setter 0x8EFB50 + scatter 0x8EF2D0 #1 + layer-3
  setter + scatter #2 + the second ctor + RECURSIVE self-call) is
  REGISTERED; the per-phase block bodies are the last named sub-read
  before the caves-field goes byte-final.
- Tests 143/143 green. No cache bump (caves-field.mjs is not wired
  into the render pipeline yet).

## Update 2026-09-21 (5) — the pinpoint CE pickup processed (C49); the A-resolver found

User pasted the TWO pinpoint runs (seeds 78633191 + 78633192, spawn,
identical script). All canon landed in CONSTANTS.md **C49** +
ABOUT_MATH (48); artifacts = `out/oracle/CE_PICKUP_v5_2_seed91_92.txt`
(verbatim).

SOLID FACTS that closed open questions:
- [P+0x8c] = the raw worldseed (0x04AFD8E7/0x04AFD8E8) — C27's ctor
  in-memory across TWO seeds: the diddled-ws poro chain's input is the
  RAW seed, no addend; the C48 ×5 toucher unaffected.
- [P+0x34] = 0.546875 / [P+0x74] = 1.549988 on hills-class BOTH seeds =
  real per-biome knobs (hills.xml's strength 1.55-family), i.e. the
  .55 blob-stamp constant + 1.55 max-strength family live in the
  bitmap_noise struct (not pointer noise).
- The A-RESOLVER fn = **0x008EE1B0** (found on the 0-dim
  bitmap_noise uids; a real fn entry confirmed; the next objdump read
  closes the C32 A-channel config consumer = the byte-lane fn body).
- [P+0x58] = the byte-lane allocation is REAL (differing per-seed
  heap pages), first 64 B zero both runs = the C48 byte-lane from the
  art-data's semantics (not the "identity 0" falsehood).
- The 0x132aae8 map: MSVC x86 RBTree {L(0), P(4), R(8), color/isnil(0xc),
  key-SSO(0x10..0x1f), size(0x20), cap(0x24), **VALUE = the cave grid
  ptr @0x28**}, keys = the CaveStructure image file-pattern strings
  (eye_0$[1-4]-family byte-visible) — the name-keyed per-pattern
  generator cache confirmed at runtime.
- [P+0x2c/0x30/0x38] = pointer-slot family (fnB's C31 vectors, not
  knobs). [P+0x94] draw ADVANCES per build instance (not per-seed
  stable on the world lattice).
- 1×1 placeholders → a STATIC shared head P = 0x0132B518 (never-
  initialized per uid), while real caves/grids alloc per (seed, name).

Remaining reads (unchanged): 0x8EE1B0's body, fnB per-phase block
bodies, C1/C2 wiring. The caves-field port's byteARGIN gate needs one
objective: caves-field module validated vs the C48 dense dump; the
[+0x34]/[+0x74] knobs = the identified per-biome knob pair (the C48
'bump' byte-layer) — the [0x8EE1B0] objdump + the fnB per-phase block
read closes it. No further CE runs needed for the caves-field SHAPE;
future CE = (a) the retargeted [P+0xb0]=0x8EE1B1 body-dump on a 0-dim-
uid instance at ANY seed, + (b) the post-port different-seed V4g
validation.

- The lane stays `SURFACE_V3=1` opt-in; no render/default changes.
## Update 2026-09-21 (7) — dig #30: the caves-field SURFACE_V3 lane is live

`mapgen/lib/caves-field.mjs` rebuilt cleanly as the byte-canonical core +
flagged composition (buildCavesField / carveCircle / walkChain /
toucherValue / makeFieldGridFromTopology). The byte-exact core: the fn C1
1.0-base + C27 ctor chain (the diddled-ws ONE draw) + the ×5·w toucher +
the C50 knob interp (v = A + d·(B−A) with the struct's [+0x74]/[+0x78]
strength pair per the fnB blob phase) + the (43)(a) blob-circle falloff
with the (y/25)⁸ top-row eave. The lane split: the interior caves = the
min-bleed CARVE (down from 1.0 — the C34's >0.5 = solid), the y=0
mountain bump = the max-bleed ADD-BLEND at v ≈ 1.45 (both directions
read off the C48 oracle's own two behaviors).

The knob WRITER hunt closed to: the knob values live in the LOW-half
ConfigLua registration family (the true 0x4AE921..0x4B2A0F parse
clusters, cave_strength_*.imm32s incl. the 0x117c4c4/0x117c504 pair)
and the VALUES are NOT static exe constants (the whole-exe f32 scan:
zero hits for 1.549988/1.55; 0.546875 = 35/64's two incidental
byte-coincidences only) — the knobs = the struct's loaded per-biome
values.

Smoke runs: 512×256, p94 = 2560 ✓, meta = the real span draws
(blobCount 45, caveCount 71), the oracle's carved-density delta
(0.93 solid mine vs ~0.5 in the oracle row samples) = the remaining
sub-read: the per-cave footprint's true rolls + the deep-strength
worm-lane values (the oracle's carve centers sit ~0.05..0.08).

Next queue: (1) instrument SURFACE_V3 vs the C48 dense dump (the
per-phase roll map conversion); (2) fnB's per-phase block bodies (the
worm/surface caves/mountains/beginning-paths sub-phases) to un-flag the
placement composition; (3) the 0x8EE1B0 A-resolver body read; (4) then
the caves-field byte-final compare + the render bump.

## Update 2026-09-21 (8) — dig #80: queue #1 executed (the composition order transcribed; the oracle re-spun)

Docs re-read, then the handoff queue #1 executed. All state below verified
on disk this session; tests 143/143; cache r3i stands (no bump — the
caves-field lane is not in the default render).

- **`lib/caves-field.mjs` v4 — the byte-cited composition ORDER is now
  transcribed:** fnB head draws (dig #65: the POSITIVE-fraction count
  roll for the walker budget + the y-cursor from the record's own pair)
  → the fnA worm walk × cave_count (cave_childs branches) → the blob
  decl-loop LERP stamps (the C50 interp on the CE strength pair
  (1.549988, 0.0), radius cap 20, dig #49/#54) → the record arena
  (per-record NEGATIVE-scale count roll + own strength pair → the BYTE
  grid, dig #61) → L2/L3 = SINGLE-POINT max-bleed raises (dig #55) +
  the scatters (the `< 0.5` empty-cell gate → the B-recorder). The two
  roll twins (positive head roll vs the negative stamp roll) are now
  distinct helpers. Fixed the `l1` shadowing bug (l2Base was always 0).
- **Writer-mapping verdict (the oracle rows forced it):** the fnA walk
  stamp = the 0x8EE930 LERP only; the (43)(a) max-bleed setter per walk
  stamp REFILLS the fresh carve — the eave raise belongs to the record
  stamps, whose flag=1 raise reproduces the C48 bump peak 1.454092 as a
  1.45..1.55 strength draw.
- **Instrument in-repo:** `mapgen/experiments/2026-09-21-caves-drawbudget-compare.mjs`
  (the standing byte bar). Verdict: y224 BYTE-EXACT through every
  variant (0/12); the value classes all reproduce (deep centers
  0.0..0.08, gradient tails, raises ≈1.45, 1.0 base); port solid 0.71
  vs oracle ≈0.5; positions still diverge.
- **Remaining named reads (the narrowed queue):** (1) the per-phase
  draw COUNTS (which count pair feeds which decl-loop — the budget
  residual of queue #1); (2) the record IMAGE-lane stamps (the bump +
  the y16 plateau = CaveStructure image content — load + blend the
  images; the dig #28 analytic-probe negatives stand with the writer
  now identified as the image blend / LoadFromImageData pass, dig #57);
  (3) the fnA y-drift span (queue #2). Doc-arithmetic OPEN item: C46's
  scatter VA pair (0x8EF2D0/0x4ee2d0) violates the C13 map by 0x800 —
  re-pin from the exe before the next scatter read.
- The lane stays `SURFACE_V3=1` opt-in; no render/default changes.

- **Test battery pinned the dig #80 state (2026-09-22): new suite
  `tests/mapgen/caves-field.test.mjs` (32 tests) — the byte-form pins
  for every caves-field primitive (the C48 toucher 512→2560/1→5; the
  0x8EE930 LERP form incl. no-max-bleed lowering; the (43)(a)
  max-bleed + the ((y−1)/25)⁸ eave at digits 7 = f32 storage; the
  negative-scale count roll; the scatter's `< 0.5` gate + bounds; the
  walkChain writer-split regression (the walk never raises off the
  1.0 base); the buildCavesField span/determinism/seed-sensitivity
  contracts; the L2/L3 raise-class byte forms (l3v ∈ [0.065, 0.2])
  and a data-dependent C48-oracle block (y224 byte bar + the bump
  peak ∈ the C50 span, auto-skipping without the artifacts). Plus a
  caves-field export block in `api-surface.test.mjs`. Battery
  baseline moved 143 → 176, all green.**

## Update 2026-09-22 (1) — digs #81..84: queue #1 closed, the P1 plan Phases 0–1 done, and the P fill chain read byte-exact (the ramp OVERTURNED)

- **Commits:** `2b0220b` (dig 81: CavesSetup slot map C52 + CaveStructure
  60-B record/C51 + fnB draw-budget C53; blobPhase1 = mountain_count lane)
  → `216e032` (dig 82: P1 Phase 0 read-vs-unread inventory — uid map has
  NO mGradient slots ⇒ ramp = separate consumer; attr-name imm32 scan = 0 ⇒
  key-string dispatcher hunt ELIMINATED; Topology census: all
  SIN_CAPPED_SIMPLEX, StartY/EndY −1024/1024 except hills_flat) →
  `0444f82` (dig 83: per-cell chain byte-traced sampler → gate →
  evaluator2 → consumer → planters; driver true 0x908F40 = the only
  surfaceField caller; Serialize kind-0 fill = fn 0x8EE230; CONSTANTS
  C54/C55) → **`db6be07` (dig 84: the `[config+0x1d4]` (P) fill chain
  byte-exact AND the ramp question overturned)**.
- **Dig #84 headline facts (ABOUT_MATH §6 (84), CONSTANTS C56, VERIFIED
  §8 rows 21–22 + §12):**
  - fn1 slab 0x4EDA30..0x4EDC3F (kind-0 arm) = an address-keyed memo:
    `&config+0xa8` is the cache KEY only (contents NEVER read), miss →
    builder → malloc 0xB8 → C27 ctor → A-resolver pin
    `movl $0x8ee1b0,0xb0(%edi)` @true 0x8EE3A7 → delegate clone →
    **`[gen+0xb4]` = a cloned callback {fn 0x7EB220, ctx=
    BiomeSpawnScripts*}** (C39's "B-map" label corrected) → insert
    0x542970 → return gen → P store.
  - **The 0x533580→0x7EC4E0 chain = the `BiomeSpawnScripts` factory,
    NOT the ramp** (literal 0x1154528; ctor 0x7EAAF0→0x85D1A0, vtable
    0x119EA60, populate = map @[obj+0x8c] → error log bss 0x132B624,
    memo @[singleton+0x24] value [node+0x28]).
  - C27 ctor slab 0x4F8C70 = **seed-RNG init only**: seed @+0x8c,
    1.0f @+0x90, @+0x94 = f32(draw)×200000−100000 (consts 0x11e0ba0 /
    0x11e0220 / 0x11dfdd8 / 0x11e0504 / 0x11e04ec, 2×0xc090c0).
  - Serialize dispatch corrections: kind-1 this = &cfg+0x198; kind-2
    = fn2 slab 0x4EDC40 (w/h +0x1cc/+0x1d0, this &+0x1b4, seed local
    −0xc4); both-zero global-default props = slab **0x52c1e0 /
    0x52e000**; asserts: biome.cpp full path, lines 0x178=376 /
    0x18d=397, cond `lua_manager`.
  - Boundary byte-verified: evaluator2 ret 0x508737 (C55 tail exact),
    int3 pad, driver prologue 0x508740 (`call 0x5095a0` @0x50875c,
    `je 0x508b67`, `mov eax,[ebx+4]` @0x50876b). Census: fn1/fn2 = 1
    caller each, C27ctor = 7, 0x533580 = 5, 0x3ebce0 = 10 (stdcall,
    arg = the noise_type string). **imm32 text.bin = 0 hits for
    0x908F40/0x508740/0x908F9B → driver invoked indirectly, capture
    site still OPEN.**
- **Render gate:** `SURFACE_V3` stays 1 (composition order byte-read,
  but the material ID ladder — the 132-B record walk + planters — is
  not yet cited). Lane unchanged; cache dir r3i.
- **Tests 177/177 green at dig #84; y224 byte bar 0/12 rms 0.0000.**

### NEXT SESSION — ordered:

1. **Question A (the ramp) = the mGradient hunt:** find where StartY /
   EndY / HighNoise / LowNoise / NoiseScale are WRITTEN — the XML-parse
   family **0x496a2e..0x4a97ed** (C50's named hunt) — then re-check
   C37's surfaceField config range **+0x220..+0x268** for the matching
   READ. (The P-build chain is fully read and eliminated — do not
   re-dig it; see VERIFIED §8 row 21.)
2. **Re-verify the sampler wrap's this-arg source:** entry (83) said
   "dims on P at +0x20" but P+0x20 = container block #2 of the C27
   gen — resolve the contradiction (sampler slab 0x50d41e region).
3. **Driver indirect capture:** 0 e8/e9 + 0 imm32 — hunt
   FF15/FF55-style / vtable 0x118f9e4 targets; also `[config+4]`
   kind value for P1 and fn1/fn2 seed-local inits ([ebp−0xb8] /
   [ebp−0xc4] source).
4. **Phase-2 material ladder:** dump the 132-byte record walk body
   (slab 0x4f4a21+) + planters 0x63cd0/0x603fd0 → the material ID
   ladder gate for dropping SURFACE_V3.
5. **fnB queue:** xmm4 provenance @4f00e5 → loop-B port → L2/L3
   literal-count budget port → fnA y-drift.
6. Micro-open: 0x41d770 string-arg semantics, 0x85D980 body, the 3rd
   singleton→builder instance @0x4EE5C5 (other 8 builder callers).

## Addendum 2026-09-22 — the P1 plan is now ON DISK

- The full user-approved **surface-level (P1) execution plan (phases
  0–5)** lives in the TEMPORARY repo-root **`Current_work.md`** (with
  the methodology header + live `[x]`/`[ ]` status + working order).
  It was briefly in ISSUES.md (revert `998f74c`) — ISSUES.md stays
  defects-only per user mandate. Always defer to Current_work.md for
  phase scope/order; DELETE that file when Phase 5 closes.
- Status at this addendum: **Phase 0 [x] (dig #82); Phase 1 [ ] —
  spine landed (digs #83/#84: census done, C54/C56 rows), residuals =
  question A/ramp arithmetic, the [+0xb4] float-field writer, the
  XML-parse slot-fillers re-aim, driver capture site + loop extent;
  Phases 2–5 [ ]** (material ladder → cross-lane order → gated port →
  validation ladder + SURFACE_V3 drop with cache r3i → r3j).
- Next-session order = finish Phase 1 residuals first (mGradient hunt
  in 0x496a2e..0x4a97ed + the +0x220..0x268 read check + the wrap-arg
  contradiction), then Phase 2 (A-resolver 0x8EE1B0 → 132-B walk →
  planters), then Phase 3 (fnA y-drift + inter-lane order).
- **Addendum 2026-09-22 (dig #85):** Phase-1 residuals registered in
  the docs — ① 38-pair attr→slot bind table (C58; multiplier labels
  settled +0x264 Gradient / +0x268 Perlin / +0x26c Extra), ② wrap
  call 0x90dcce, wrap-this = P+0x20 {w,h,u16vec,cnt} (C61), ③ writer
  = LoadFromImageData 0x8f9ab0 stores (C62; bounds 0x8f9ab0..0x8fa930,
  getters 0x9499f0/0x94a8f0/0x949f60) with layout aliasing
  owner = P − 0x9c on 3 lanes — **instance-identity link STILL OPEN**
  (+0x1e0 lane mismatch), ④ driver's 3 direct e8 callers (C60).
  **Root cause of the old "zero" results: text.bin excludes lower
  .text (C57) — never conclude from text.bin alone.** C33 VA fixed
  0x8f4830 → 0x8F5030 (I18). Docs landed: CONSTANTS C57–C64 +
  C33/C37/C54/C56 corrections, ABOUT_MATH entry (85), VERIFIED §8
  rows 22–24 + §12 bullet, ISSUES I18, Current_work tags. Phase 1
  stays [ ] pending the ③ link (pending user decision: byte-close vs
  waive with the open note). Next: ③ link read → ramp-slot reads
  (+0x270..0x29c) → driver loop extent → Phase 2 (A-resolver
  0x8EE1B0 body → 132-B walk → planters).
- **Addendum 2026-09-22 (dig #86):** ③ instance identity byte-linked
  with the **SPLIT verdict** — `kind2-esi == P` PROVEN (Serialize
  kind2 arm 0x8f36fe → fn2 = 0x8ee440..0x8ee741 → its `new(0xb8)`
  gen → `[config+0x1d4]`); `P == sampler-owner+0x9c` REFUTED as
  instances (owner+0x9c = in-place embed with own ctor 0x90ce66 /
  Load 0x90d1ab / dtor 0x910a6f; P ← five standalone/static-gen
  stores incl. the newly found fifth @0x908583 in fn 0x905fb0);
  sampler decoded (vtable 0x118f9e4 → slot+8 thunk 0xa9a120 →
  0x90d860; owner = fn0x90cfb0's this; gate reads the embed, wrap
  reads config-P ⇒ **TWO gens, one class**); C34 +0x1e0 = owner-own
  decor u16 grid (the "+0xf4" premise dissolved); fn2 window split
  (fn2 ends 0x8ee741, fn5 owns the 0x8eec20 fill); phantom
  carry-overs corrected — `call 0x8ed180` 0 hits, `movl $0x132b518,
  0x38(%esi)` nonexistent, "wang-fill @0x8ee5bd" wrong (I19). Docs:
  CONSTANTS C65 + C62 RESOLVED, entry (86), VERIFIED §8 row 25 +
  §12, ISSUES I19, commit `9df4319`. **Phase 1 byte-CLOSED by user
  decision (2026-09-22)** — residuals (ramp-slot READS, driver
  extent) = known-open, picked up as the next items.
- **HANDOVER — 2026-09-22, end of session (read this first).**
  - **Unchanged goal:** generate the **surface of the map** ourselves
    (byte-RE reconstruction → port → validate → drop `SURFACE_V3`).
    The 6-phase P1 plan lives in repo-root `Current_work.md` —
    **living plan: adjust scope/order when new discoveries warrant;
    the goal does not change.**
  - **New standing rhythm (user):** aim for **SMALL discoveries**;
    after each small verified result, write it into the tracked docs
    IMMEDIATELY (values → CONSTANTS, evidence → ABOUT_MATH §6, canon
    → VERIFIED, defects → ISSUES; status → Current_work, handover →
    this file) then `npm test` + **commit** — never let results sit
    only in chat/context ("so we don't lose any data").
    Verification discipline: facts recorded this session are citable
    — do NOT re-run verification loops over them (the no-guess rule
    targets chat memory/prior sessions, not this session's record);
    ONE cheap grep/objdump for a genuinely uncertain byte; order =
    verify → write → gate → commit, ONCE (post-dig-#85 lesson).
  - **State:** dig #85 docs = `ae205e4` (C57–C64 + fixes, entry
    (85), §8 rows 22–24, I18) → dig #86 docs = `9df4319` (C65 +
    C62 RESOLVED, entry (86), §8 row 25 + §12, I19) + this closure
    commit on top. Phase 0 [x] · **Phase 1 [x] — byte-CLOSED
    2026-09-22 (user decision; ③ link = C65 split verdict; residuals
    ramp-slot READS + driver extent = known-open, not blockers)** ·
    Phases 2–5 [ ]. Tests 177/177, y224 byte bar 0/12 rms 0.0000.
  - **Next small discoveries (in order; ③ byte-link DONE dig #86):**
    1. question A READ side — consumers of the ramp slots
       `+0x270..0x29c` (surfaceField reads only `+0x220..0x268`).
    2. driver loop extent/y-range — the caller body around true
       `0x7930d3`.
    3. Phase 2 — A-resolver body `0x8EE1B0` (file 0x4ED5B0, unread) →
       132-B record walk → planters → ladder table + fixture.
    4. Phase 3 — fnA y-drift + inter-lane write order → composition
       diagram → Phase 4 (env-gated port) → Phase 5 (L3 anchor fit →
       predictable zones → user visual oracle → drop `SURFACE_V3`,
       r3i→r3j, distill §12, delete Current_work.md).
  - **Bookkeeping:** next §6 entry **(87)** · next CONSTANTS row
    **C66** · next ISSUES **I20**. Never conclude from text.bin alone
    (**C57**: lower .text file 0x400..0x400c00 = true
    0x401000..0x801800 caused three false "zero" results). Read
    VERIFIED §8 rows 18–25 + C64/C65 (do-not-re-dig) before any new hunt
    in those areas.

## Update 2026-09-22 (2) — Phase 2 steps 1 → 2b: digs #87..#91 (C66–C70); the factory/record/color ladder is now byte-known

- **Commits:** `39d7e10` (dig 87: Phase-2 step 1 — A-resolver body
  `0x8EE1B0` = lazy-singleton + delegate, logic → `0x741A50`, C66) →
  `1e2055c` (dig 88: step 1b — delegate `0x741A50` 24-bit color→index
  −1 miss + LoadFromImageData's four arms ⇒ u16-lane semantics byte-known,
  C67) → `b2a1fbc` (dig 89: step 2 — the **0x290 record class =
  CellFactory/CellData = materials.xml rows**: layout, accessors,
  mCellDataSize, name→type map, C68) → `ff7927a` (dig 90: the color
  origin — wang_color parse store `mov %eax,0x40(%esi)` @0x736d37 in
  record parser fn 0x7364f0; codec pair 0x454d90/0x454e80 R↔B swap;
  gfx_glow_color → +0x48; C69) → **`03c4fe7` (dig 91: leftovers ②–⑥ +
  step 2b — C70 + entry (91) + VERIFIED §8 row 26)**.
- **Dig #91 headline facts (entry (91), CONSTANTS C70, VERIFIED §8 row 26
  + §12 — cite, don't re-dig):**
  - **①f correction:** fn `0x9eb020` ends `ret $0x4` @0x9eb131 + int3
    pad ⇒ the synthetic-node **builder = fn 0x9eb140** (guard @0x9eb168,
    `call 0x7364f0` @0x9eb1aa ∈ 0x9eb140; its 3 call sites = 0x745b3f /
    0x746263 / 0x746530, all in fn **0x7459d0**); 0x9eb020 = the
    grey-error logger only (this = bss 0x132b624, site 0x745999) ⇒ dig
    #90's "role reconciliation" OPEN **dissolved**.
  - **② `[factory+0x2c]` = ctor-set fast-color `0xff420000`**
    (`movl` @0x740bfd in ctor **0x740b70**, object size 0xd8); imm-0x2c
    census 0x740000..0x746fff = 0x740bfd + 0x7450de only, and 0x7450de =
    the second SSO string's size zero-init in frameless fn **0x7450c0**
    (NOT a factory store); reg-source = 0x7401b3 only ⇒ **Load never
    writes +0x2c in-region** (file-wide 380 hits unexamined =
    REGION-scoped elimination).
  - **③ `[0x134632c+0x18]` = a 0xd8 factory instance** — the only two
    writers (0x729753, 0x79de90) both do `new(0xd8)` → ctor 0x740b70 →
    `call 0x43ac50` → store → `call 0x7449e0(this=obj)` (site 2: bss
    install @0x79de46, guard @0x79de4b, store @0x79de90) ⇒ C66's
    delegate-writer OPEN **CLOSED**.
  - **④ record origin = in-place `[factory+0x1c]+[ebp−0x3cc]` in fn
    0x7459d0** over records **i = 1..size−1** (record 0 skipped = C67's
    scan-from-1 ✓; gate @0x745a26, step @0x745b71..86); parse sites =
    in-place 0x745b3f/0x745e96 AND staging 0x746263/0x746530 (local
    `[ebp−0x364]`, ctor 0x747160) ⇒ **both patterns live**; growth
    0x92fc90 ← 0x740db7/0x73624d (mCellData ✓); full-realloc **0x978aa0
    = 0 call/jmp sites file-wide** (mystery).
  - **⑤ LoadFromImageData pass-1** (fn 0x8f9ab0): inits/counters
    (−0x6c bumped @0x8f9f19 after record-0 u16==1 writes; −0x68 bumped
    @0x8fa0d4 after `call 0x92eb70`, identity OPEN), phase-2 flag
    @0x8fa194, **assert lines 0x2a7/0x2a8** (crash `movl $0x1ca9`),
    fill pass 0x8fa361..47d (u8≠0 ∧ self u16==0 ∧ 4 nbrs==1 → u16=1 +
    f32=−1.0f ⇒ lanes gen+0x00/+0x20/+0x40 = C67 ✓), phase-2 @0x8fa6e9
    = ctor + header copy + u16 ×2 resize + walk u16==0; callers = 3,
    @0x905dd7 **arg1 = the C67 pixel container** (push w/h) ✓.
  - **⑥ `+0xe0` = fire/smoke DEFAULT type, `+0xfc` = NAMED type** (link
    pass **0x7455b0**: GetType("fire") @0x74581d / name-absent default
    GetType("smoke") @0x74588a / named @0x745844) — C68's asymmetry
    resolved; guarded stores +0x1e8/+0x204/+0x148/+0x144 (2 writers);
    grey check @0x74597a = b0==b1==b2 **alpha ignored**; the paired
    reads 0x741e4c/0x741e72 = record-assign **0x741d20** COPIES ⇒
    **semantic consumer still OPEN**.
  - **step 2b JACKPOT (first cross-artifact match):** materials.xml
    (418,728 B, md5 `d782fb8c321b8e325fd67e07e46a5265`): `<CellData` 224
    + `<CellDataChild` 245 = **469 = the wang_color count exactly**
    (8 hex digits, no `0x`; record order = type order ✓); air line 80/83
    **`wang_color="ff000042"` → C69 b0↔b2 swap → `0xff420000` = the
    ctor immediate** (data, swizzle, exe agree); the same u32 = C1's
    hasPath start-mark @0x901a4d (relationship OPEN).
- **State (supersedes the dig-#86 handover above):** Phase 0 [x] ·
  Phase 1 [x] byte-CLOSED (residuals parked) · **Phase 2 [ ] in
  progress — steps 1/1b/2/color/leftovers done (digs #87–#91), step 3
  remains** · Phases 3–5 [ ]. `SURFACE_V3` stays 1 (material ladder not
  yet cited); cache r3i. Tests **177/177**, y224 byte bar **0/12 rms
  0.0000** green at dig #91. Tree clean at `03c4fe7`.
- **HANDOVER — 2026-09-22, after dig #91 (read this first):**
  - Read order: `AGENTS.md` → `Current_work.md` (PLAN/STATUS authority;
    methodology :17, status :149) → `mapgen/VERIFIED.md` (canon: §8
    eliminations, §9 frontier, §11 lifecycle, §12 dig history) →
    `CONSTANTS.md` (latest **C70**) → ABOUT_MATH §6 pattern entries
    (82)–(91). ISSUES.md only when filing.
  - **Next: dig #92 = the (91) residue, then the ladder run**
    (Current_work.md:227): (1) the semantic **consumer of +0xe0/+0xfc**
    (writes in 0x7455b0, read side unseen); (2) the **staging→table copy
    path** (locals `[ebp−0x364]` at 0x746263/0x746530 → mCellData) + what
    selects in-place vs staging; (3) **0xFE top-byte** meaning + u32
    channel order, codec top-byte round-trip, sentinel-arm semantics;
    (4) flag slots [ebp+0x10]/+0x3c/+0x5c/+0x7c in 0x8f9ab0, the
    0x92eb70 identity, pass-1 dilation body 0x8fa4ff..0x8fa6b9, phase-2
    walk tail ~0x8fa7e0, 0x8f9ab0's full signature; (5) 0x978aa0
    zero-caller mystery, fn 0x7450c0's helper-this, ③ site-1's (0x729753)
    install guard, type-1 wrapper chain 0x42c0d0/0x42bc50/0x42c070,
    0x7415e0 miss tail, the file-wide 380-hit 0x2c census (region-scoped
    elimination stands), C1-vs-ctor `0xff420000` (@0x901a4d vs @0x740bfd).
    Then **Phase-2 step 3**: the 132-B record walk → fillRandomMaterials /
    DECOR u16 content walk → **ladder table (CONSTANTS row + solid/air
    test fixture)** → Phase 3 (fnA y-drift + inter-lane order) → Phase 4
    (env-gated port) → Phase 5 (anchor-fit IoU → user visual → drop
    `SURFACE_V3`, r3i→r3j, distill §12, **delete Current_work.md**).
  - **Byte sources (re-check paths/hashes on disk before citing):**
    `/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe`
    (17,007,104 B, md5 `8b611494212a69492dd0a4527d9c92e0`;
    slab = true − 0x400800, C13) and the literal
    `/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/materials.xml`.
    A full objdump may be cached at `/tmp/opencode/fulltext*.asm` — if
    gone, regenerate; prefer grepping the FULL disassembly (windowed
    `--start-address` dumps decode misaligned at the window start — the
    exact error behind dig #90's ①f, corrected in C70/§8 row 26).
  - **Traps:** never cite orphan literals 0x11a0008/0x11a0030 (0 refs);
    label censuses REGION-scoped unless file-wide; never conclude from
    text.bin alone (C57); §6 is append-only (corrections = new entry);
    read VERIFIED §8 rows 18–26 + C64/C65/C70 before any re-hunt.
  - **Bookkeeping:** next §6 entry **(92)** · next CONSTANTS row
    **C71** · next VERIFIED §8 row **27** · next ISSUES **I20**.

## Update 2026-09-24 (1) — dig #102 agenda: the value-logging Ghidra run (post-#101 FAIL)

**Context:** dig #101 wired the field source (C80 world frame) and the
surface-y IoU re-run still FAILS (entry (101): flood GONE — topAir
0.004→0.941 — but meanAbs 87.87, bands ≤0.047, and the sign of bias
flips per family: hills +240.5 vs mountain −27.9 vs lake −40.8). User
verdict locked: FAIL ⇒ "more ghidra", **with value logging as the
method**. Dig #102's former drop path (`SURFACE_V3` const
`noise-terrain.mjs:97` + attach gate `:340` + `genmap-server.mjs:34`
r3i→r3j) stays OFF the table until PASS. Counters: next entry
**(102)** · **C81** · **I22**; VERIFIED §8 row 32 free.

**Method (user, 2026-09-24):** read → hypothesis → single-value patch →
re-run `SURFACE_V3=1 node mapgen/experiments/2026-09-24-surface-y-iou.mjs`
→ the metric vector scores it. Never open-ended study: static Ghidra for
formulas, runtime logging wherever static is ambiguous, capture =
output-level ground truth. Findings land in §6 first, constants
registered C81+ BEFORE use.

### Task 0 — the two loggers (in-repo; build BEFORE any Ghidra)
- **L1 value log** — env-gated (`SURFACE_LOG=<path>`) JSONL per
  evaluated cell at `mapgen/lib/noise-terrain.mjs:299-319`:
  {tx,ty,cx,cy, x,y [C76 lane], wx,wy [C80], uid, gradKind ∈
  caves|topology|ramp, field, gate, v, solid}. Every later patch is
  confirmed by what actually flowed, and Q2's slot guesses become
  distribution checks (e.g. "slot 0x24 = x in cell units" ⇒ the
  wx/512 histogram must line up).
- **L2 displacement fit** — extend the IoU instrument to emit, per
  scored tile, the fit Δy = a·x + b (and Δy vs y_ref) + per-family
  aggregates (per-tile bias already exists: experiments/:171-173;
  aggregates :219-220). **Signature grammar:** b ≈ same across families
  ⇒ shared-frame offset (Q1); a ≠ 0 ⇒ unit/scale error (Q2); per-family
  b with lake/ramp flat ⇒ family-local shape (Q3); error growing with
  depth ⇒ ramp-window/limit_y.

### Q1 (rank 1) — the driver's coordinate contract: caller body @0x7930d3
- Binary: fn `0x908F40` (procedural_terrain.cpp; kind-0 feeds
  surfaceField's RETURN into the f32 grid, VERIFIED:593) · 3 direct
  callers true **0x7930d3 (main)** / `0x7938d1` + `0x7938fe` (45-B
  probe pair), sibling `0x793358 → 0x909370` — all at file
  **0x3924d3..0x392cfe** = lower .text (C60; **C57 scope defect:
  text.bin starts at file 0x400c00 ⇒ this region is NOT in text.bin**).
- Extract recipe (C13): slice `f[0x392000:0x393000]` →
  `objdump -D -b binary -m i386 --adjust-vma=0x792c00` (true VA =
  file+0x400c00 = slab+0x400800); prefer grepping the FULL disasm if
  `/tmp/opencode/fulltext*.asm` still exists (windowed dumps decode
  misaligned — dig #90's ①f error, C70); Ghidra go-to 0x7930d3
  directly; dumps dir `~/work/ghidra-logs/`.
- Questions: **loop extent + y-range** (vs our fixed 52×52 sweep,
  noise-terrain.mjs:291-292); the **units** pushed to 0x908F40
  (cell/world/lane? offset constants?); what initializes the origin
  slots (feeds Q2).
- Port patch sites: `noise-terrain.mjs:299-303` (x,y → wx,wy) and
  `:318-319` (what evaluator2/classify receive — the I21 flip is one
  line each; ISSUES I21: claim (c)'s cited band is sky, the world frame
  fits the surface band).
- Score: **Q1 moves ALL families together** (shared evaluate frame) —
  family biases converge same-sign → 0, ±3 ↑, pairs ↑ (genNoLine ↓
  from 68.6%), topAir stays ≈0.94.

### Q2 (rank 2) — origin-field slots [args+0x24]/[args+0x28]: axis split + units
- State: frame pinned (world px) dig #97; **axis split unread** — which
  slot is x vs y, units, sign — and the slots' upstream writers never
  traced.
- Read: back-trace who stores into both slots (starts: Q1's 0x7930d3
  body + dig #97's record).
- Patch sites: `noise-terrain.mjs:302-303` (wx/wy build —
  swap/offset), `noise-proto.mjs:628` (cell-unit factor
  0.49162514·coord + p94) if units are wrong.
- Score: axis swap = structural change (bands re-pattern; L2's a flips
  axis); unit error = nonzero slope a; pure offset = Q1 territory.
  L2's a/b partition decides BEFORE patching.

### Q3 (rank 3, in-repo — reclassified from "Ghidra" to "port audit"): C44 fnA y-drift
- **Binary side is CLOSED:** dig #94 / entry (94) / **C73**
  (`CONSTANTS.md:100`; VERIFIED:549 + :870-879). fnA 8eec70..8ef86c:
  start **Y = 0 (top row)**, X = clamp(jittered base, 5, W−5);
  **y += Δy once per iteration, Δy = 0.4u+0.1 ∈[0.1,0.5), +0.5 when
  trunc(101u)<33 ⇒ [0.6,1.0)**; budget = LERP(0.45H, 0.96H, u) ÷ Δy ⇒
  **span y ∈ [0, LERP(0.45H,0.96H,u))**; terminations = ≤⌊budget⌋ iters
  · box x∈[0,w)∧y∈[0,h) · y-cursor gate · budget<0 pre-gate; x lane:
  −0x4c += clamp(step, ±1.0), counter >50 ⇒ **re-jitter** u·2−1 (not
  terminate).
- **Port side is NOT:** `mapgen/lib/caves-field.mjs:149-183`
  `walkChain` = modelled placeholder — callers pass random
  y0 = rollPos(0,h−1) (:268/:271) vs C73's Y=0; the y-drift is
  `if (prng.next() > 0.5) y += prng.next() * 4 - 2` (random sidestep vs
  the monotone top→down sweep covering 45–96% of grid height); hard
  stop `step < 50` vs budget+re-jitter; x-step `(1.0+2.5·d3)·0.2` vs
  clamp(±1.0). Header comments still flag "y-drift = queue #2 / standing
  unread" (:38, :146-148, :169-170) = **stale post-dig-#94 text**. Also
  **L2/L3 literal counts read but NOT ported** (120+⌊81u⌋, L2 = 2
  passes, @4f1510/4f1518/4f1f01/4f1f09; :37-38).
- Why it matches the FAIL: walkChain carves the caves grid = gradAt
  for the BitmapCaves ×8 = exactly the failing families (hills worst,
  desert high, mountain mild) while lake (topology image lane
  `makeGradAtFromTopology`) and ramp-only biomes never touch it. A
  sideways-random worm vs a top-down sweep = vertical field-shape error
  ⇒ displaced contour.
- Work: port C73 (start pair, Δy law, budget, all four terminations,
  x-step, re-jitter) + the L2/L3 counts into walkChain/buildCavesField;
  fix the stale comments; register constants C## before use; keep the
  y224 byte-oracle green (`experiments/2026-09-21-caves-drawbudget-compare.mjs`)
  + caves-field 33/33 + `npm test` 258/258.
- Score: **Q3 moves BitmapCaves-only metrics** (hills/desert/mountain
  ↑, zero-pair `44_13_hills` gains pairs) with lake/ramp flat ⇒
  shape-vs-frame isolation.

### Execution order
Task 0 (loggers) → **Q3 port rebuild** (no binary needed; largest
family-specific suspect) → IoU re-run → **Q1 read + flip patch** →
IoU re-run → Q2 only if L2 shows the slope/swap signature or Q1 stays
ambiguous. **Exit:** PASS ⇒ un-park the drop path (:97/:340/
genmap-server.mjs:34) → VERIFIED §12 distill + entry (102); FAIL ⇒
the metric deltas name the next read.

### Rules & traps
Register C81+ before use · §6 append-only, entry (102) next · never
conclude from text.bin alone (C57 — Q1's region is outside it) · VA =
file+0x400c00 = slab+0x400800 (C13) · full-file disasm over windowed
(C70) · drop path OFF until PASS · gates before every commit:
`npm test` 258/258 + `npx vitest run tests/mapgen/caves-field.test.mjs`
33/33 · `Current_work.md` refreshed per dig but never `git add`.

## Update 2026-09-24 (2) — dig #102 (part 1): fnA/fnB byte-CLOSED (C81, entry 102); THE Q3a PATCH IS NEXT

**Landed this session (docs + instrument; `lib/` untouched):**
- **C81** (CONSTANTS — the fnB walk-caller + switch-path geometry, the
  caller side of C73), **entry (102)** (ABOUT_MATH §6), **VERIFIED §8
  row 32** + the §11 dig-94 in-row amendment. Counters: next entry
  **(103)** · **C82** · **I22**; VERIFIED §8 row 33 free.
- Task 0 instrument: L1 `SURFACE_LOG` JSONL logger (env-gated,
  `noise-terrain.mjs`) + L2 fit extension
  (`experiments/2026-09-24-surface-y-iou.mjs`) — committed with this
  dig. Baseline FAIL preserved `mapgen/out/surface-y-2026-09-24.entry101.json`
  (n 6889, meanAbs 87.87, bias +7.92, ±3 .047, genNoLine 68.6%,
  topAir .941 + per-family rows in entry (101)); L1 baseline log
  `/tmp/opencode/surface-y-log-baseline.jsonl`.

**The two entry (94) corrections (f32 traps → §8 row 32):**
Y₀ = **trunc(6·u) ∈ {0..5}** (not 0: `[0x11dfef0]` = f64 6.0 bytes
`0000000000001840`, `mulsd` @8f02a5); lane = **3 − trunc(−3u) ∈ {3,4,5}
@1/3 each** (not fixed k=3: `[0x11e05f8]` = f64 −3.0, `mulsd` @8f02c4;
lanes 0.4u+0.1 / 0.25u+0.75 / 0.13u+1.07 all live). Δy, child 2%, d₀,
the10 arg slots re-confirmed. New this session beyond (94): the
switch X-law (two ±0.45·(w/count) jitter draws + floor-stride·walkIndex
+ clamp 5..w−5), the flag alternation (B+switch/A cycle), the budget
double-LERP (0.15S first, 0.45S on flag=1), growth = u + the two
50/101 gates, the push map (slot `[0x24]` = spawn_percent = the scatter
gate), children INSIDE fnA, stamp = `push $1; call 0x8ee750` (its
flag branch UNREAD — FLAGGED).

### NEXT SESSION — write the Q3a patch (design frozen in entry (102) ⑦ + C81)
1. Read fresh at edit time (file unchanged this session):
   `mapgen/lib/caves-field.mjs` — carveCircle :91, walkChain :149-173,
   stale comments :158-163/:169-170, phase doc :255-261, callers
   :262-273 (outer `childs` loop :269-272 to DELETE), buildCavesField
   :227+; field names in `mapgen/lib/biomes.mjs:162-185` (caveStrength/
   caveChilds/surfaceCaveChilds/surfaceCavesCount all exist; **no
   spawnPercent field** — `num(head,"spawn_percent")` must be ADDED if
   the gate is ported; scatter is omitted anyway = float-neutral).
2. Constants: C81 covers everything needed; register **C82** BEFORE any
   new constant. §6 append-only; entry **(103)** next.
3. Patch: walkChain rewrite (prologue draws → envelope → D1/D2 flag →
   `carveCircle(..., flag=1, dir="max")` trunc pair + plain box exit
   (NO `& (gridW−1)` wrap) → `y += Δy` each iteration → four
   terminations → bias draws + x-law → re-jitter growth gate → child
   recursion INSIDE with childCounter by ref) + callers rewrite to the
   path-alternation laws (Y₀ = trunc(6u); case-A chained ±0.01w /
   0.05..0.25h; case-B 0.07..0.33h Y + 5+u(w−10) X; switch X-law;
   budget h−Y₀ with the 0.15/0.45 arms; Δy; d₀²; growth gates; drop the
   scale arg) + stale comment fixes.
4. Gates (in order): `node mapgen/experiments/2026-09-21-caves-drawbudget-compare.mjs`
   (y224 byte bar) → `npx vitest run tests/mapgen/caves-field.test.mjs`
   (33/33; the y224 exactness rows :338-344 may shift — re-derive the
   expected bytes from the NEW byte law, do not force old numbers) →
   `npm test` (258/258).
5. IoU re-run + score:
   `SURFACE_V3=1 SURFACE_LOG=/tmp/opencode/surface-y-log-q3a.jsonl node mapgen/experiments/2026-09-24-surface-y-iou.mjs`
   → diff vs the entry101 baseline (the metric vector: n, meanAbs,
   bias, ±1/±2/±3, genNoLine, topAir, per family + per row, and the L2
   a/b fit deltas — baseline fits: overall fitX (0.10312,−19.213),
   fitDepth (−0.30044,46.874); families in the L1 JSONL) + L1
   baseline-vs-q3a JSONL diff.
6. Exit rule: **PASS ⇒** un-park the drop path (`noise-terrain.mjs:97`
   const + `:340` attach gate + `genmap-server.mjs:34` r3i→r3j) →
   VERIFIED §12 distill + entry (103); **FAIL ⇒** the metric deltas +
   the L1 diff name the next read. `Current_work.md` refresh, commit
   (never stage `Current_work.md`).

**Still parked (user's Ghidra, non-blocking):** Q1 = driver 0x908F40's
caller body @0x7930d3 (loop extent/units/origin init; region outside
text.bin — C57), Q2 = `[args+0x24]/[args+0x28]` axis split. When the
user returns with those findings → patch → IoU per the metric vector.


---

## Update 2026-09-25 (3) — dig #103 (part 1): C82 registered + header re-scoped (commit b24762f); THE Q3a PATCH IS STILL THE NEXT ACTION

**Landed this session (docs only; `lib/` logic untouched → gates green):**
- **C82** (CONSTANTS — the fnA walk-body byte law: the prologue 6 draws
  incl. the A/B/C/D slot map A=[-0x68] / B=[-0x50] / C=[-0x5c] /
  D=[-0x6c]; the per-iteration draw order; the four terminations; the
  bias/x-law/re-jitter/in-walk-child gates) — registered AND re-verified
  this session against `/tmp/opencode/fna-102.asm` (prologue stores +
  lane/radius segments + the tail re-read in full).
- `mapgen/lib/caves-field.mjs` BYTE-STATUS header: the fnB-HEAD bullet
  re-scoped per C81; the new byte-closed fnA/fnB-walk bullet (the old
  x-wanderer lane + rollAcc/L1 chain RETRACTED, plain box exit); and a
  **PORT-STATUS marker — the patch is NOT applied** (the code below
  still runs the pre-(102) model; re-read the bodies at edit time, do
  not trust the bullet as a description of walkChain/the callers yet).
- CONSTANTS stray placeholder row removed; C81/C82 rows intact.
- NO §6 entry (no research result beyond C82's registration — entry
  **(103)** covers the patch + gates + the IoU verdict in one).
- Gates on this docs-only state (2026-09-25): drawbudget y224
  **0.0000** (0/12), caves-field **33/33**, npm test **258/258**.
- `Current_work.md` refreshed (status bullet + counters): next entry
  **(103)** · next CONSTANTS row **C83** · **I22** · VERIFIED §8 row 33.

**"Update 2026-09-24 (2)" (the patch plan) STANDS VERBATIM — deltas for
the patch session:**
- Its step 2 (register C82 BEFORE any new constant) = DONE.
- Fresh anchors in `mapgen/lib/caves-field.mjs` (re-read at edit time
  anyway; +5 lines from the PORT-STATUS marker): stale walkChain
  comment block :156-166, walkChain :167-191, buildCavesField
  docstring :219-244 (the two falsified docstring lines = the "fn A
  stamp walk ... the LERP-stamp pass" :228 and "AIR/carve = the fn A
  LERP stamps + the deep-roll chain" :242-243), pre-loop rolls
  :266-267 (**blobCount :266 MOVES** out of the pre-loop to between
  the walk loop and its stamps — the dump rolls it at @8f072a), the
  phase-1 callers :273-291 (the outer `childs` loop :287-290 to
  DELETE), blobStamp :308-317 (-> `blobStamp(n)` taking a pre-rolled
  count).
- Frozen design decisions already carried in the checkpoint (all
  inside entry (102) ⑦/C82 — do NOT re-derive): `l1 = 0` as a
  constant (the caller's rollF/d1/d2/rollAcc/stampV draws are NOT in
  fnB's walk loop; baseline meta l1:0/l2v:0 => no behavior change;
  the l2v draw STAYS); `carveCircle(..., flag=1, dir="max")` => the
  walk can only RAISE (post-patch carving = the blob phases only);
  spawn_percent omitted (not parsed => 0 => byte-identical skip;
  draw-consumption caveat on the record); scale0/scale1 draws consumed
  but unused (the scale arg drops); signature stays **arity 9**
  `walkChain(grid, gridW, gridH, prng, x0, y0, cursor, budget, walk)`
  with `walk = { d0sq, dy, growth, cc: { n } }` (api-surface.test.mjs
  :104 pins length 9) and `CAVES_FIELD_VER` unchanged.
- The 3 walkChain tests to rewrite (the suite total stays 33):
  raises-only (min === 1.0; start y in [10,25) so the eave band proves
  the stamp ran), determinism with FRESH walk objects per call
  (`cc: {n:2}` exercises the recursion), box/no-wrap with `x0 = w + 5`
  (all cells stay 1.0 — the old `& (gridW-1)` wrap would carve).
- Still FLAGGED (record in entry (103), non-blocking): the pushed-flag
  LERP-vs-max branch INSIDE `0x8ee750` — the frozen design mandates
  flag=1 / dir="max" regardless. Q1/Q2 stay parked for the user's
  Ghidra (driver 0x908F40's caller body @0x7930d3; the axis split).

## Update 2026-09-26 (4) — dig #103 (part 2): Q3a APPLIED, gates green, IoU vs entry101 = FAIL (drop path stays OFF)

**Landed (commit = this update's state):**
- **The Q3a patch in `mapgen/lib/caves-field.mjs`** per entry (102)
  stage-7 design + C81/C82 — `walkChain` arity 9 (prologue 6 draws,
  plain box exit, raise-only `carveCircle(flag=1,"max")`, in-walk child
  recursion with `cc` shared by ref, `steps ≤ budget` continue), the
  caller path alternation + two-arm budget (scale0/scale1
  consumed-but-unused, `l1 = 0`), outer `childs` loop DELETED, blobCount
  roll moved after the walk loop (@8f072a). All byte facts re-verified
  THIS session from `CONSTANTS.md:109-110` + the cached dumps (prologue
  `cmovl` coin direction, the d-split @8ef53d..8ef565, the child tail
  @8ef79e..8ef836, the caller pair mirrors @8f0068/8f00ce/8f019e/8f0182/
  8f0298/8f02b9, knob keys `biomes.mjs:170-183`).
- The 3 walkChain tests rewritten in place (raises-only `min === 1.0`
  start y∈[10,25); determinism with fresh `cc:{n:2}`; box/no-wrap
  `x0 = w+5`) — total stays **33**.
- **Gates (all green):** drawbudget y224 **0.0000**, caves-field
  **33/33**, npm test **258/258**; builder meta `l1:0, l2v:0` =
  baseline.
- **§6 entry (103)** appended (C82's source pointer now resolves).

**IoU verdict vs entry101 — FAIL** (both JSONs read this session,
`mapgen/out/surface-y-2026-09-24{.entry101,}.json`):
- nPairs 6889 → 7094 (+205); genNoLine 15077 → 14872; meanAbs 87.87 →
  89.47 (+1.60 worse); bias +7.92 → +2.11 (better); band ±1/±2/±3
  .019/.032/.047 → .019/.031/.046 (FLAT); genTopAir .941 → .933.
- By family: hills IMPROVES (meanAbs 318.21 → 293.18, bias 240.5 →
  175.53, +135 pairs); desert +50 pairs / meanAbs +3.39; mountain
  +20 pairs / +1.03; winter+lake byte-identical.
- L1 diff (199,542 lockstep samples, `/tmp/opencode/surface-y-log-
  {baseline,q3a}.jsonl`, 0 coord mismatches): **2,029 solid flips, ALL
  `gradKind:caves`** — 1,942 AIR→SOLID vs 87 SOLID→AIR; field delta
  mean +0.0034, max|Δ| 4.62. ⇒ exactly the byte law (raise-only walk ⇒
  worm cells stand solid unless a shifted blob carves them).
- ⇒ **Caves layer ELIMINATED as the binding constraint** of the ~89 px
  meanAbs (it flips 1% of samples); the residual lives in the layers
  OUTSIDE the caves field — the still-unread noise-band/gate layer
  that derives the surface line (hills/desert bias structure).

**Stays OFF / parked:** the drop path (`SURFACE_V3` const + attach
gate + `noise-terrain.mjs:97/:340` + `genmap-server.mjs:34`) — entry
(102): OFF until an IoU PASS; no VERIFIED §12 distill. Q1/Q2 @0x7930d3
parked for the user's Ghidra. Standing FLAG: 0x8ee750's pushed-$1
LERP-vs-max arm UNREAD (port uses flag=1/"max" regardless).

**NEXT DIG (in order):** (1) the metric names the read — attack the
noise-band/gate layer that dominates the ±3 miss (the surface-line
derivation: hills bias +175 residual; the noise-band self-instrument
queue item from earlier updates, or whatever non-blocked read exists
there); (2) Q1/Q2 Ghidra @0x7930d3 the moment the user delivers it
(non-blocking); (3) re-run the IoU only after a patch to a layer
OUTSIDE the caves field. §6 append-only; entry **(104)** next ·
CONSTANTS **C83** next · **I22** · VERIFIED §8 row 33 · never stage
`Current_work.md`.

**External intel (Telescope — absorbed, NOT folded in; nothing enters
VERIFIED/ABOUT_MATH without own verification):** community claims from
github.com/Lymm37/noita-telescope (MIT, JS; web UI lymm37.github.io/
noita-telescope/; credits TwoAbove/noitool, pudy248, WUOTE/
noitamap.com): `edge_noise.js` biome-edge wobble = permutation table +
sin/cos·30 + magic·11, ×70 openly empirical — a LAYOUT-layer render,
not our material band; `biome_generator.js` NG0 biome map = static base
PNG (no RNG), NG+ palette/cave-walks via `SetRandomSeed(seed+ng, 4573,
4621)`, orb rooms mostly fixed coords; `biome_hacks.js` coalmine overlay
PNG + `0xc0ffee` randomizers + a NollaPrng ctor+warm draw that matches
our C27; `data/` has material_data.json (137 KB material→color table)
plus biome_maps/wang_tiles zips usable as a layout-parser cross-check.
Known gaps (their own): surface spawns unimplemented, biome-edge
predictions unreliable, NG+ edge-noise TODO. Use for the final doc
refresh only.

## Update 2026-09-27 — PLANNING PHASE: census-first redirect (digs suspended)

**User directive (2026-09-27):** goal unchanged — a perfect RE of
Noita map generation, **no concession**; we have everything we need.
Only open question is ORDER. Suspend the active dig tasks; plan first;
resume the frozen to-do when the plan is "in the clear". Region order
for the next breakthroughs (user-locked): **surface → The Work (hell)
→ The Work (heaven)**. Driving concerns: (1) digs #100..103 felt like
"looking for a coin in the sea" — adjust a parameter, try again, start
again where the last shovel hit; (2) the user has **no eyes on the
scale of the decompiled code** (the territory nobody has surveyed).

### Toolchain VERIFIED this session (corrects a stale ledger note)

- **Headless Ghidra is operational — nothing to repair.** Evidence on
  disk (checked 2026-09-27): install `~/tools/ghidra` (12.1.3);
  project `~/work/ghidra-projects/noita.gpr` (382 MB, mtime
  2026-09-17 20:05); **551 decompiled `.c` dumps** in
  `~/work/ghidra-logs/` spanning 2026-09-05 → 2026-09-17
  (`h12_procterrain_*` series; `~/work/ghidra-scripts/HuntFill*.java`;
  Sep-17 `plz_*` dumps per Update 2026-09-17 (3)); headless watcher
  `mapgen/ghidra-watch.mjs`.
- `ghidra-ledger.md:778` "OSGi bundle cache CORRUPTED" = a TRANSIENT
  note from the ~Sep-5 session close, **disproved by the Sep-7/8 and
  Sep-17 dumps**. Do not treat it as current state (a 2026-09-27 misread
  of it produced a false "decompiler broken" claim — corrected here so
  it never recurs).
- Standing two-lane method: **decompile-first for semantics** (ledger:
  "Decompile-first works better"), **objdump + computed-byte scans for
  canon** — every CONSTANTS row still needs byte proof (computed bytes
  via writeUInt32LE, never hand-typed).
- Q1/Q2 "parked for the user's Ghidra" = a SCHEDULING note, not a
  toolchain verdict — they likely run in-house once P0 smoke-tests the
  pipeline.

### The plan (P0–P3; region order user-locked)

- **P0 — toolchain re-validation + the eyes-on raw material.**
  (a) reconstruct the exact headless invocation (JDK PATH + exec-bit
  notes are in the ledger) and smoke-test by re-decompiling a function
  we already hold a dump for → byte-diff must match; (b) **export the
  Ghidra function table** (VA, size, name) for `noita_dev.exe` to CSV.
- **P1 — census: register every parameter BEFORE reading any meaning**
  (regions in order surface → hell → heaven):
  - Define each region's function set as the **call-graph closure from
    its entry points** — surface: driver 0x908F40 + callers
    0x7930d3/0x7938d1/0x7938fe, surfaceField config range
    +0x220..+0x268 + kind dispatch, Update 0x90b8a0→0x910c20, cell
    generator FUN_0090ce20→FUN_008f9470, XML/mGradient family
    0x496a2e..0x4a97ed; hell/heaven get a **locating pass first**
    (string/rdata/magic-number scans — the ledger proves binary u32
    scans cheaper and more complete than Ghidra xrefs).
  - **Coverage map = join(closure, dumps dir, ledger verdicts, read
    status)** → per region: totals (function count, bytes) vs
    decompiled vs read vs unread. The whole scale is visible BEFORE
    anything is read — the direct answer to "no eyes on the code".
  - Register row format: parameter (config slot / immediate / XML attr
    / Lua field) ← consumer VA ← data source ← status {located,
    unread, semantics-read} ← byte pointer. Byte-verified rows →
    `CONSTANTS.md` C83+; research detail → ABOUT_MATH §6 first
    (append-only, two-layer doc rules).
- **P2 — semantics walk** over the register in dependency order. The
  noise-band/gate layer (entry103's named binding constraint) and
  Q1/Q2 read first; every result → §6 status tag.
- **P3 — exhaustive tests.** Every register row becomes a test pin
  (extend `surface-census.test.mjs`'s 39-fact pattern to the consumer
  side); ports proceed mechanism-by-mechanism; gates unchanged (y224 →
  33/33 → 258/258); IoU re-scored only AFTER a register-backed patch.
  **The metric is a judge, never the navigator** — anti-coin-in-sea by
  construction: no parameter may be tuned that is not first in the
  register, and no register row may be skipped because a score moved.

### Suspension bookkeeping (the resume point)

- Frozen as-is, nothing deleted: `Current_work.md` next-action (dig
  #104), ISSUES P0–P5, Q1/Q2/Q3, counters (entry (104), C83, I22,
  §8 row 33). `Current_work.md` carries a suspension banner pointing
  to this update.
- **Resume = P0 (half a day) → P1 surface region → P2 → P3.**
- Unchanged rules while suspended: drop path (`noise-terrain.mjs:97`,
  `:340`, `genmap-server.mjs:34`) and VERIFIED §12 distill stay OFF
  until an IoU PASS (entry-102 rule); no commits of Current_work.md.
- No dig/gate/IoU runs were made in this planning session; only
  gitignored context docs were touched.

## Update 2026-09-28 — P0 DONE: toolchain validated + whole-territory export (the eyes-on numbers)

**P0a PASS — headless decompile pipeline rebuilt and smoke-tested.**
`P0Smoke.java` decompiles 0x8bbb60 **byte-identical** to the Sep-17
stored dump (`plz_final_8bbb60.c`, strict diff = 0 past the header).
Method notes (do not relearn; these SUPERSEDE ghidra-ledger.md:777-780):
1. Headless **masks .java compile errors as "class not found"** — always
   pre-verify with direct javac first (ledger method confirmed essential):
   `javac -proc:none -nowarn -cp "$(find ~/tools/ghidra -name '*.jar' |
   tr '\n' ':')" -d /tmp/p0classes Script.java` (javac NOT on default PATH —
   use /home/marron/tools/jdk/bin/javac).
2. The real "OSGi" history: `~/work/ghidra-scripts/` bundle poisoned since
   Sep 8 (HuntFill51d/52) — use a **fresh script dir** (current:
   `/tmp/dec-scripts/`); `/tmp/opencode/` worked Sep 17 (stale-bundle risk
   for new files). The global "OSGi CORRUPTED, workaround=objdump" claim was
   wrong — decompile-first is back.
3. Correct API: `DecompileResults.getDecompiledFunction().getC()`
   (there is NO getDecompiledC()).
4. Invocation: `JAVA_HOME=~/tools/jdk PATH=~/tools/jdk/bin:$PATH
   ~/tools/ghidra/support/analyzeHeadless ~/work/ghidra-projects noita
   -process noita_dev.exe -noanalysis -scriptPath /tmp/dec-scripts
   -postScript <S>.java`.

**P0b — whole-program export (P0Export.java):**
- **92,915 functions · 313,874 direct call edges · 12,821,865 body bytes
  (12.2 MB)** of surveyed territory. Direct CALL refs only — virtual
  dispatch edges absent ⇒ connectivity is an UNDER-estimate.
- CSVs: `~/work/ghidra-logs/p0_functions.csv` (entry,name,size) +
  `p0_calls.csv` (from,to) — durable copies; /tmp/opencode/ originals.
- Landmarks: largest function FUN_0085f060 = 101,315 B; top-10 all
  ≥22 KB. Existing dumps: 551 files (445 VA-parseable) ≈ 0.6% of the
  function table.

**Q1 bonus — caller identity resolved in seconds:** all three driver call
sites 0x7930d3 / 0x7938d1 / 0x7938fe live in ONE function
**FUN_00792580 (entry 0x792580, 6,345 B)** — the parked "user's Ghidra"
body is now a single in-house decompile away (Q1/Q2 un-parked).

**P1 surface-region seed set (driver 0x908f40 direct callees, dedup):**
0x909da0, 0x90a860, 0x8f5030, 0x8faae0/0x8fa9b0/0x8facd0/0x8fae40
cluster, 0x908cb0 (×3, already decompiled), 0x908e70, 0x4b8080/0x4b80e0,
0x949f60, 0x10078c0, 0x1033970, 0x10078c0.
Next: **P1 surface census** — depth-bounded closure from these seeds
(raw closure explodes through utility calls; prune with the reverse set),
join with dumps + ledger verdicts + read status ⇒ coverage map, then
register rows (parameter ← consumer VA ← source ← status).

## Update 2026-09-28 (2) — P1 surface census pass 1: region defined, dumped, register skeleton

- **Region** (script `mapgen/experiments/2026-09-28-surface-census.mjs`):
  depth<=6 closure from seeds {FUN_00792580 (caller body), FUN_00908f40
  (driver)}, pruning nodes with in-degree>10 ⇒ **130 functions /
  54,294 body bytes**. Threshold-stable (119/130/150 @ inDeg 5/10/20).
  Per-depth: d0=2 d1=28 d2=45 d3=29 d4=15 d5=6 d6=5; 59 utility nodes
  pruned (top hubs excluded: 0x41df90 ind=9937, 0x10078c0 ind=9147 —
  the profiler-class pair the driver itself calls).
- **Coverage join:** dumped=20/130 (15.4%), doc-mentioned=30/130
  (23.1%), both=15, **NEITHER=95 ⇒ the true unread territory of the
  surface region**. Region CSV:
  `~/work/ghidra-logs/surface-region-2026-09-28.csv`.
- **All 130 decompiled locally** (`P1DumpRegion.java`, 130/130 OK,
  636K) → `~/work/ghidra-logs/surface-region/*.c`; register extraction
  no longer needs Ghidra runs.
- **Offset scan (register skeleton — semantics UNREAD, candidates
  only):** 130 files → 84 distinct struct-ish offsets; TSV =
  `~/work/ghidra-logs/surface-region-offsets.tsv`. Window findings
  (0x220..0x268 = dig-#83 surfaceField config range):
  - **FUN_0090a860 reads BOTH +0x220 and +0x268** AND is a driver
    callee (the call whose return = surfaceField-ret 0x908f9b) ⇒
    **surfaceField identity candidate: FUN_0090a860** (2,217 B, d1,
    doc-mentioned). Its dump also shows an `iVar2+0x1d4 → +0x94`
    pointer chain (the generator+0x94 perlin family) + heavy XMM float
    math on DAT_011df* constants — consistent with the noise consumer.
    VERIFY identity on the P2 read; do not register as fact yet.
  - driver reads +0x238/+0x23c; FUN_0090b110 reads +0x228/+0x242;
    FUN_008e95e0 reads byte offsets +0x24c..+0x24f.
  - densest parameter consumers: FUN_00792580 (29 offsets),
    FUN_008f5030 (25), FUN_00792340 (21), FUN_00798410 (21).
- **Next:** (1) register rows for the window offsets (byte-verify each
  consumer → CONSTANTS C83+); (2) P2 semantics reads, ordered:
  FUN_0090a860 (surfaceField / noise-band consumer — entry (103)'s
  named binding constraint) then FUN_00792580 (Q1 body, 6,345 B).

## Update 2026-09-28 (3) — P2 read #1: surfaceField + deps; NEW tile-band-gate mechanism; constants byte-pinned

- **surfaceField 0x90a860 full body read** (141 L, local dump).
  Corroborates C37/C77: 0.85 gate (`DAT_011dfb84`), `[config+0x220]`
  addNoise switch, kind `[config+4]` branch, BitmapNoise `[+0x1d4]` →
  `+0x94` scale → coord transform → floor/frac → **4-corner value-lattice
  interp (0x9fe620) with smoothstep t²(3−2t)** → `<1.0` fallbacks
  (0x8fc020 core / 0x908cb0+0x8fa9b0). NEW (decompile-grade): the
  **pre-gate at line 109 = value > 0.51 && `[config+0x268]` ≠ 0 → calls
  0x90b110** (threshold f32 0x11dfaac, byte-read from exe).
- **Constants BYTE-VERIFIED from /mnt/e/.../noita_dev.exe** (file =
  VA − 0x400E00 per C77; anchors matched: 0x11dfb84=0.85f,
  0x11df974=0.1f, 0x11df988=C1 4.656612875e-10): 0x11e028c=**57.0**,
  0x11e04c8=**43758.546875** (both = C40 pins ✓), 0x11dfe68=**2.0**,
  0x11dff70=**3.0** (smoothstep coeffs ✓), 0x11dfbf0=**1.0**,
  0x11dfaac=**0.51**, 0x11dfa90=**0.495**, 0x11dfc70=**0.02** f64
  (C77 ✓), 0x11dfdc8=**0.49162514** f64, 0x11df874=**0.0**.
  FLAG: 0x11dfa08 implausible as both f32 (1.59e-34) and f64
  (6.86e-07) → asm-verify its use in the surfaceField y-chain.
- **0x8fb570 (I20① target) decompiled** (26 L): helpers identified via
  C40 — 0x44d0b0 = fp-round helper, 0x44d110 = libm sin-precise (IAT
  slot 0x114a520); shape = round(y)/round(x)/57.0 skew + sin family +
  `floor(·43758.546875)` → int. **Decompiler LOST the XMM flow** (calls
  render as void, results unpicked) ⇒ formula NOT closed; **I20② (asm
  read of 0x8fb570) remains the binding read.**
- **NEW MECHANISM (never registered): 0x90b280 = the per-tile band gate
  of `procedural_terrain.cpp`** — dev asserts embed the true source
  (`.../source/procedural_utils/procedural_terrain.cpp` lines
  0xec6=3782 / 0xec7=3783, `ox >= 0 && ox < 512`): world offsets
  `[config+0x38]/[config+0x40]` f64, `ox/oy = (off+coord) & 0x1ff`,
  tile-x = `(x>>9) % [config+0x50]`, y-clamp `[config+0x54]`, tile id
  via **0x94c700** → per-tile params via **0x90b680** (doubles),
  neighbor compare **0x909c70**, and a **42-px x-edge blend**
  (`ox < 0x2a`, lerp `1 − ox/const 0x11e0274`). Candidate for the
  row-21 mGradient/tile-band consumer family — status: decompile-grade,
  semantics of 0x90b680's params + the caller's XMM0 contract pending.
- **0x90b110** (364 B): flag-gated A/B — `[+0x24d]` → 0x9119d0 ×2;
  `[+0x228]==0` → **0x8fd920** else **0x8fdad0**; `[+0x242]` early
  return (both paths converge ⇒ asm check). A/B pair unread.
- **Next:** (1) read 0x90b680 + 0x8fa9b0 (local dumps); (2) one headless
  dump run for missing deps {0x909c70, 0x94c700, 0x8fc020, 0x9fe620,
  0x8fd920, 0x8fdad0, 0x9119d0}; (3) asm lane: regen text.bin, PIN the
  VA map against row-22's e8@0x7930d3 → 0x908F40, then read 0x8fb570
  (I20②) + the 0x11dfa08 flag; (4) write the §6 entry for this cluster
  when it closes (NOT yet written).

## Update 2026-09-28 (4) — P2 asm lane: I20① CLOSED, C83 + entry (104) landed; corrections to (3)

- **I20① CLOSED (asm-grade): true 0x8fb570 formula.** Lattice
  identical to whiteLattice2d (c0 = 57·round(y)+round(x), floor
  fracs, corners frac(sin(c0+k)·43758.546875) k∈{0,1,57,58}, shared
  sin/round helpers); differentiator = **PARITY-alternating blend
  weights**: W = lerp(w0,w1,frac) with (w0,w1) = (smoothstep,linear)
  vs (linear,smoothstep) by round-cell parity, then plain bilinear.
  All constants byte-pinned (57.0@0x11e028c, **58.0@0x11e0298 NEW**,
  43758.546875@0x11e04c8, 2.0/3.0, 1.0, 0.0).
- **Method (solidified — working form, supersedes the 0x401000 shifted-slab
  recipe):** text.bin = exe f[0x400c00:0xdd0000],
  `objdump --adjust-vma=0x801800` ⇒ printed = true VA (file =
  VA − 0x400C00); VA map re-pinned on C77's digest facts BEFORE
  reading (comiss→0x11dfb84 @0x90ab48 + jbe→0x90b0a2; [ebx+0x220]
  @0x90ab55; je→0x90ae03); rdata = file VA−0x400E00 (anchors
  0.85/0.1/C1 re-matched). Ledger :777-780 method notes STILL pending
  an in-repo commit window.
- **surfaceField y-chain (NEW):** gy = (period·[0x11dfa08] +
  y·0.49162514)·0.1, period = f32 [BitmapNoise+0x94] — RESOLVES
  C38's "6.86e-07 semantics open" (consumer = this ≈0 term; purpose
  still open). x-chain ✓ C37.
- **r = 0x90b280 internals (NEW):** tile math (512, world offsets
  [+0x38/+0x40], asserts procedural_terrain.cpp:3782/3783), per-tile
  params via 0x90b680 (modes const/linear/core/fbm, fields
  +0x270..+0x29c), 42-px left-edge neighbor blend (f = 1−ox/41.0;
  0x909c70 x-wrap/y-clamp → 0x94c700 CSafeArray::GetAt — BOTH
  helpers newly registered), y-gate cascade under f64 380.0.
  New pins: 58.0, 41.0, 380.0.
- **CORRECTIONS to Update (3):** (a) +0x228/+0x242/+0x24d are NOT
  unregistered — C37's uid map has mInsideNoiseFBM / Scaled /
  OffsetBySeed ⇒ 0x90b110 = the inside-noise run (plain dispatcher
  vs fbm wrapper 0x8fdad0 per mInsideNoiseFBM); (b) the dispatcher
  0x8fd920 was already C36 (my table = independent corroboration,
  slab+0x400800 matches all 9); (c) r = 0x90b280's label + the 0.51
  gate + x-chain were already C37 — what was NEW = the internals;
  (d) the 6.86e-07 pin already existed in C38 (consumer was the open
  part). Process note: the census pass re-derived these WITHOUT
  consulting the register first, then checked — the register held on
  every point.
- **Docs landed (uncommitted):** CONSTANTS **C83** (index row),
  ABOUT_MATH §6 **entry (104)**, ISSUES **I20 ① struck** (② port
  remains), Current_work counter header → (105)/C84.
- **Next:** (1) asm read of 0x90b280's return paths = **r's formula**
  (THE binding read — r·field feeds the 0.51 gate); then (2) continue
  P2 order: FUN_00792580 (Q1 body, 6,345 B) + the driver call
  context; (3) side-by-side 0x8fb570 vs the ported whiteLattice2d
  [OPEN ④]; (4) run gates (y224 / caves-field 33/33 / npm test
  258/258) then commit this change-set (census script + C83 + (104) +
  I20 edit); (5) the default-arm port (I20②) only as a
  register-backed patch, with IoU after.

## Update 2026-09-28 (5) — P2 read #2: r CLOSED (C84 + entry 105); the driver chain pinned

- **r = true 0x90b280's return expr ASM-CLOSED** — resolves entry
  (104)'s [OPEN ①] (the return formula) and ③ (which lane = which
  bound). Full byte law = **C84**, entry **(105)**. In one line:
  **r = band membership in Y** — `Y ≤ out0 → 0.0f`, `Y ≥ out1 →
  1.0f`, else `t = (Y − out0)/(out1 − out0)` (epilogue `+0.0 @
  0x11df878` byte-read = no-op); out0 = LOWER, out1 = UPPER; the
  bounds come from `0x90b680(A, params, X)` (evaluated at **X** with
  phase [A+0x48]) ⇒ bounds undulate along x; the 512-tile path with
  the ox ≤ 41 left-seam blend (f = 1 − ox/41.0, nb via
  0x909c70(col−1,row), per-lane lerp own + (n−own)·f), the
  A[+0x6c]==0 direct path, and the `Y > 380.0` uid-params path are
  all byte-read (windows re-run on disk this session).
- **Driver chain pinned:** `FUN_00792580 → 0x908f40 ×3 → 0x90a860`
  (p0_calls.csv; the old row-22 `e8@0x7930d3→0x908F40` pin now in
  the export). **A = surfaceField's ecx = 0x908f40's incoming ecx =
  FUN_00792580's ecx** (`mov esi,ecx` @0x908f51 → `mov ecx,esi`
  @0x908f77) — A's class = the Q1 body's open question. A's fields:
  +0x38/+0x40 world offs, +0x48 params phase, +0x50/+0x54 grid dims,
  +0x68 CSafeArray, +0x6c tiling flag. **B = params = the
  0x909da0() fetch** ([B+4] kind dispatch: 0 surfaceField /
  1 `biome->bitmap_data` / 2 threshold-eval), carries uid fields
  ⇒ **B = the biome/uid instance**.
- **0x908f40 passes (x + 0.5, y + 0.5)** (addsd [0x11dfdd8] = f64
  0.5 byte-read = cell centers); the classifier gets `(int)` of the
  unshifted originals.
- **Caller-side combine slots byte-confirmed** (all C37/C77
  corroboration): r′ = r·field slot @0x90aae8/90aafe (= slab
  0x50a2fe ✓), 0.51 gate @0x90aaf7 (**0x11dfaac f32 =
  0.5099999904632568** byte-read), [B+0x268]==0 skip,
  gradW = (r′ − 0.5)·2.0 @0x90ab1e..34, per → [ebp−0x8] @0x90ab43,
  0.85 gate @0x90ab48.
- **Register-first intact:** no patch, no port, no IoU run, no
  parameter touched; judge parked. Docs landed (UNCOMMITTED):
  ABOUT_MATH entry **(105)**, CONSTANTS **C84**, (104) untouched
  (append-only; (105) supersedes its OPEN tags). No §8 row, no §12,
  drop path stays OFF.
- **Gates green at commit `e1538b1`** (change-set = census script + C83/C84 +
  entries (104)/(105) + I20 edit + the ghidra-ledger method notes —
  the (104)-owed update, DONE at this window): y224 0.0000 →
  caves-field 33/33 → npm test 258/258. Chain: e1538b1 ← b8ca8db ←
  b24762f ← 955acf7 ← 1fa9139.
- **Next (P2 order):** FUN_00792580 (Q1 body — what ecx = A IS) +
  the driver call context; then side-by-side (104)④; then P3
  (register rows → test pins, ports mechanism-by-mechanism; default
  arm I20② only as a register-backed patch with IoU after). Hell +
  heaven census regions follow surface.
- Open tags now: (105)(a) A's class, (b) field0's write into
  [ebp+0x8], (c) 0x909c70 return type; carried (104)② 6.86e-07
  purpose, (104)④ 0x8fb570-vs-0x8fb350 side-by-side.
- Counters: next entry **(106)**, constant **C85**, issue **I22**,
  VERIFIED §8 row 33.

## Update 2026-09-28 (6) — P2 read #3: the kind-0 wire + driver identity (C85 + entry 106)

- **The v wire CLOSED:** `call 0x90a860` @0x908f96 → **`movaps xmm3,
  xmm0` @0x908fa6** → `call 0x8f5030` ⇒ **classify's `v` (C75's xmm3)
  = surfaceField's f32 return.** Ghidra's statement-only call was the
  dropped-register-arg artifact. classify inputs now byte-sourced on
  both ends of C75's port contract: **table = ecx = [B+0x2a4] =
  mBiomeMaterials (C74)**, x/y = `cvttsd2si` of the UNSAVED entry
  locals (cell ints; surfaceField got +0.5 centers), `ret $8`.
- **A's provenance = [driver-obj + 0x70]** (`mov 0x70(%ebx), %ecx`
  before all three 0x908f40 sites: 0x7930b9/0x7938c2/0x7938ef) —
  resolves entry (105)(a); the driver's own class = Q1 body remains.
- **FUN_00792580 identified: GridWorld world creation** — rdata
  assert file `grid\gridworld_world_creation.cpp` (0x11a46b0) +
  exprs `data->array2d->IsValid( x, y )` (0x11a4794, line 1001) and
  `grass[i]->tree_material_id > 0` (0x11a47f4, line 1089), both
  byte-read this session.
- **The three sites:** (1) 0x7930d3 center classify — array2d gate
  (`[ebx+0x30]`, dword grid, index (y<<9)|x, skipped if `[ebx+0x78]`
  ≠0), record → [esp+0x54], non-null → 0x7935f4 (record[+0x38]==3 →
  write dims **[ebx+0x34/0x38]=0x200, [ebx+0x3c]=0x40000 = 512·512**);
  (2)(3) 0x7938d1/0x7938fe grass probes at (x∓1, y) in the grass loop
  (arr [esp+0xb4], obj[+0xd4] = tree_material_id, obj[+0xa8] byte
  gate) — either NULL → next; both → id check (obj[+0xd8] <0 or ==
  [esp+0x54]→[+0x30]) → handler 0x793938 = **`0x7412c0([ebx+0x74], x,
  y−1, tree_material_id)` = tree placement at (x, y−1)**.
- Opens tagged in (106): [esp+0x54] slot reuse / flow to 0x79391b
  untraced; [esp+0x2c]/[esp+0x30] write-flow; grass-loop nesting
  (0x79369a, 0x79361b-tail, 0x793df2 unread); 0x7412c0 body;
  classify record type; obj[+0xa8]/[+0xd8] semantics.
- Landed (COMMITTED **c8092ad**, gates green: y224 0.0000 / caves-field
  33/33 / npm test 258/258): ABOUT_MATH entry **(106)**, CONSTANTS
  **C85**. No §8/§12, no patch — judge parked, drop path OFF.
- Next: finish the driver call-context traces (Q1 body: 0x7935f4
  tail / 0x79369a / nesting), then **(104)④ side-by-side 0x8fb570 vs
  the ported whiteLattice2d**, then P3 (register rows → test pins;
  I20② default-arm port only as a register-backed patch with IoU
  after); hell + heaven census regions follow surface.
- Counters: next entry **(107)**, constant **C86**, issue **I22**,
  VERIFIED §8 row 33.

## Update 2026-09-28 (7) — P2 read #4: the driver's cell-loop skeleton (C86 + entry 107)

- **(y−1) row-offset law**: [esp+0x40] := −512 @0x792f90, +=512/row
  @0x793322 ⇒ both rowOffset cell gates read **cell(x, y−1) = the
  cell ABOVE** (y grows down); y≤0 guards precede both reads
  (@0x7930e4-0x7930ea / @0x7936fa-0x793700). The post-create gate =
  "tree target cell empty" (same cell the handler writes). — This
  resolved (106)'s read-after-write paradox.
- **Loop + rect**: {originX, originY, width, height} = [ebx+0x20..0x2c]
  (bounds jl @0x79331c/0x793332); continue labels 0x79330c/0x793310/
  0x793314 (reloads because phase loops clobber edi/edx); 512 guard:
  x>511 ∨ y>511 → the line-1001 IsValid assert machinery @0x792fc7,
  in-range bypasses to 0x79309a.
- **Bail = epilogue**: site-1's cell≠0 → 0x793df2 = cleanup tail
  (frees frame[+0xe8], frame[+0xb4] grass vector, frame[+0x9c]) ⇒
  pre-filled grid ⇒ world creation returns early.
- **≠3 branch**: obj = 0x740f80([ebx+0x74], x, y, record, 0 with
  ecx=frame[+0x80] — arg split open) → NULL → next cell; else
  **cell[(y<<9)|x] := obj** @0x7936d4 (array2d cells = pointers) →
  vtable[1] ==2 skip / else vtable[15](obj, frame[+0x7c], 10000) →
  above-cell gate → band scan → grass → band → next cell.
- **==3 branch** (sole entry = site-1 jne; jmp 0x793cb2 @0x7935ef ⇒
  no fall-through): lazy init of the driver's OWN id grid — dims
  512/512, cells 0x40000, malloc+memset 0x100000 B at [ebx+0x4c]
  (cap [ebx+0x50]) → join: **edi = record[+0x30] on all paths** (the
  realloc path reads `0x60(%esp)` with 3 pushes pending = frame[+0x54]
  = record) → **idGrid[w·y+x] := record[+0x30]**, **driver[+0x54] :=
  same**. ⇒ TWO 512² grids: data->array2d (pointers) + id grid.
- **Loop exit**: `A->0x909370(A, originX, originY, originX+w−1,
  originY+h−1, &driver[+0x98])` once after the whole cell loop, then
  `[*0x1344b90]+0x6c`; post-loop 0x793360..0x7935f0 unread.
- **Phase order (per cell, ≠3)**: create+write → vfunc → above-cell
  gate → band scan (frame[+0x9c] {f0,f1}, count >>3) → guards →
  **grass loop** (0x7937b4) → **band phase** (0x793a65; idx≥count →
  next cell; f1==0 → next; else body → jmp 0x793314 @0x793c65).
- **(106) opens closed**: [esp+0x54] @id-check = the record (no
  clobber on the ≠3 chain); [esp+0x2c]/[esp+0x30] = y/x loop terms;
  grass nesting = per-cell inside ≠3 chain; 0x793df2 = epilogue.
  New opens tagged: post-loop region, NULL-path body, band body,
  tree-handler continuation 0x79396c..0x793a64, 0x740f80/0x7412c0/
  0x909370/0x949e80 bodies, band pair-array fill sites.
- Landed: ABOUT_MATH entry **(107)**, CONSTANTS **C86** committed as
  **`2691554`** (gates green at commit: y224 0.0000 / caves-field
  33/33 / npm test 258/258). No §8/§12, no patch — judge parked, drop
  path OFF.
- Next: post-loop region + NULL path + band body; then **(104)④
  side-by-side 0x8fb570 vs the ported whiteLattice2d**; then P3
  (register rows → test pins; I20② port only as register-backed
  patch with IoU after); hell + heaven census regions follow surface.
- Counters: next entry **(108)**, constant **C87**, issue **I22**,
  VERIFIED §8 row 33.

## Update 2026-09-28 (8) — P2 read #5: the tree handler + band body (C87 + entry 108)

- **Method**: `/tmp/opencode/fulltext86.asm` windows only; every
  address below re-read on disk this session; floats + assert strings
  byte-read from `noita_dev.exe` (rdata file = VA − 0x400E00).
- **Frame map settled** — closes (107)'s [esp+0x38] identity open:
  - **[esp+0x38] = the DRIVER** (`mov %ecx,%ebx` @0x7925c0 — thiscall
    this — → store @0x7925c2; reload → ebx @0x793761) ⇒ the edge
    guard = `x < driver.width − 1`; the assert-report restores are
    correct esp-wise (1 push pending ⇒ `mov 0x3c(%esp),%ebx` reads
    frame[+0x38] = driver; after `add $0x4`, edi := frame[+0x3c]).
  - **[esp+0x5c] = byte offset of cell(x, y−1)** (`or; shl $0x2` @
    0x793709-14, gate `cmpl $0,(%eax,%ecx,1)` @0x793718 = the
    byte-offset spelling of the raw-index ×4 read @0x7930fb ⇒ (107)'s
    law ✓; band body reuses the slot for absY @0x793bbb).
  - **[esp+0x64] = the region object** (setup `call 0x909da0` @0x792d69
    → store @0x792d6e; `[eax+0x2a4]` = mBiomeMaterials @0x792d7c;
    band gate `cmp 0x64(%esp),%eax` @0x793bdd ⇒ **band placement
    requires region-object identity with the setup reference**).
  - **[esp+0x80] = the handler's this** (`mov 0x84(%esp),%ecx` @0x793952);
    [esp+0x2c]/[esp+0x30] = 0-based y/x counters with bounds =
    driver[+0x28] (width) / driver[+0x2c] (height) @0x793319/0x79332f;
    [esp+0x68]/[esp+0x78] = band A/B idx (incl @0x793308).
- **Tree handler contract**: `0x7412c0(this = frame[+0x80],
  driver[+0x74], absX, originY+(y−1), grass[i][+0xd4] material)` —
  pushes byte-exact 0x793947..0x793962 (`dec %ecx` @0x793943 is live
  via `add %ecx,%eax` @0x793950), callee-cleaned (ret 0x10), body
  unread; return → edi → **frame[+0x3c]** (**corrects (106)**'s
  quote); NULL return → assert line **1109** (expr 0x1190a78, crash
  @0x793a40) → vfunc[15](return, frame[+0x7c], 10000) →
  **cell(x, y−1) := the tree object** @0x793a59-62 → band phase;
  ⇒ one placement per cell (placement path skips the back-edge
  0x793924; id gate re-verified: id <0 or == record[+0x30] → place).
- **Band body semantics** (0x793a80-0x793c65): exact-column key
  (`band.f0 == absX`) ∧ `absY < [band+0xc8]` ∧ **byte-verified 33%
  MSVC-rand dice** (0.33f @0x11dfa10, 32767.0f @0x11e04bc, 0.0f
  @0x11df874; LCG @0x793abb; **the NULL path dices identically
  @0x793182-0x7931ba**) → vtable[0x64] (idx 25) → id gate
  ([band+0xd8] vs record[+0x30]) → vertical scan (rows y−1, y−3…;
  `0x93d710` ∧ cell == 0, else flag [esp+0x37] := 0) → region-object
  identity (0x909da0 == frame[+0x64]) → **{absX, absY, band} push →
  driver[+0x80]** via 0x93edb0 → `[band+0x20] == 0` ⇒ erase band[idx]
  from frame[+0x9c] (shift-left, end −= 8) = one-shot; ≠0 ⇒ keep.
- **Gate polarities are duals**: NULL path needs cell-above
  OCCUPIED (@0x7930ff) → band scan; ≠3 chain needs it EMPTY
  (@0x79371c) = the tree target; both guarded by y ≤ 0 (@0x7930ea /
  @0x793700) ⇒ (y−1)·512 = −512 is never dereferenced.
- **RNG**: esi = the state; normal-path source = `call 0x9d89d0`
  @0x7926c4 (this = &frame[+0x120], arg = &originY); the
  je-0x7927c2 skip-path source open.
- **Opens tagged** (next units): post-loop 0x793360..0x7935f0;
  NULL body 0x793105..0x793300 (+ driver[+0x90] ÷6 container, the
  @0x793300 pair-write); band tail 0x793c6a..0x793cf0; bodies
  0x740f80/0x7412c0/0x909370/0x909da0/0x93d710/0x93edb0/0x949e80/
  0x94a9d0/0x9d89d0/0x93e550; pair-array fill sites (frame[+0xe8] /
  frame[+0x9c]); band field provenance (+0x20/+0xc4/+0xc8/+0xd8);
  vfunc[1]==2; frame[+0x80]; driver[+0x78]; 0x908f40's stale xmm0;
  the setup reference position @0x792d69.
- Landed: ABOUT_MATH entry **(108)**, CONSTANTS **C87** committed as
  **`27f02c7`** (gates green at commit: y224 0.0000 / caves-field 33/33 /
  npm test 258/258). No §8/§12, no patch — judge parked, drop path OFF.
- Next: post-loop region + NULL body + band tail; then **(104)④
  side-by-side 0x8fb570 vs the ported whiteLattice2d**; then P3
  (register rows → test pins; I20② port only as register-backed
  patch with IoU after); hell + heaven census regions follow surface.
- Counters: next entry **(109)**, constant **C88**, issue **I22**,
  VERIFIED §8 row 33.

## Update 2026-09-28 (9) — P2 read #6: NULL path = ceiling plants (C88 + entry 109)

- **Method**: `/tmp/opencode/fulltext86.asm` windows only; every
  address below re-read on disk this session; assert strings
  byte-read from `noita_dev.exe` (rdata file = VA − 0x400E00).
- **The NULL path decoded = ceiling-plant insertion** — the
  above-gate's "cell-above OCCUPIED" gate now has its game meaning
  (hanging plants under a ceiling):
  - **assert line 1028 expr byte-read = `ceiling_plants_i <
    (int)data->ceiling_plants_to_insert.size()`** @0x11a47b4 ⇒
    frame[+0x68] = `ceiling_plants_i`, **driver[+0x8c]/[+0x90] =
    `data->ceiling_plants_to_insert` begin/end** (vector, stride 12;
    the `0x2aaaaaab`+`sar $1` idiom = ÷12 — checked n=12→1).
  - scan @0x793120 (continue `absX > f0 ∧ f1 ≠ 0`) → `y ≥
    driver[+0x2c]−2` → next cell → exact key `f0 == absX` ∧ `f1 ≠ 0`
    → dice (byte-identical LCG) → region gate `0x909da0 == frame[+0x64]`
    → **accept: `ceiling_plants_to_insert[i] := {absX, absY, f1}`
    stride 12** @0x7932f3-04 → `incl frame[+0x68]`. Region mismatch
    still advances the index (write skipped). **(108)'s @0x793300
    pair-write open CLOSED**; frame[+0xe8] relabeled: **the
    ceiling-plant candidate array** {f0 = exact world col, f1 = def}.
- **≠3 band scan re-verified identical** (0x793722-0x793765): count =
  `(frame[+0xa0]−frame[+0x9c])>>3 → frame[+0x4c]`; same rule
  `absX > f0 ∧ f1 ≠ 0` ⇒ **(107)'s prose confirmed correct** (my
  interim flip-flop resolved: AT&T `cmp mem,%eax` → flags = absX −
  f0); **`ebx := frame[+0x38]` restore @0x793761** (scan had clobbered
  ebx with the array base); idx → frame[+0x78].
- **Guards byte-exact** (0x793769-0x7937ae): empty grass / `x ≤ 0` /
  **`x ≥ driver[+0x28] − 1`** → 0x793a71 ⇒ **driver[+0x28] = width
  definitive** ⇒ `0 < x < width−1` ✓; grass init: i = 0, count =
  `(end−begin)>>2 → frame[+0x6c]`, ==0 → 0x793a6d.
- **Band-phase entry = three compensated states** (0x793a65 full
  reload / 0x793a6d x-only — grass init zeroed edi / 0x793a71 compare
  with live edx/ecx); `frame[+0x3c] := bandB[idx].f1` @0x793a84;
  `f1 == 0 → 0x79330c`.
- **Fill loop 0x792e80-0x792eda** (closes the pair-array fill-site
  opens): source = 16-byte `{double x, Object*}`; dispatch by object
  bytes — `[+7] ≠ 0` → ceiling candidates (frame[+0xe8]), `[+6] ≠ 0`
  → grass (`0x9ef4e0(&frame[+0xb4], elem)`), else → band B
  (frame[+0x9c]); pair = `{int = trunc(x), void* obj}` via
  `0x93ef50` push_back-like (ecx = &vector, stack = &pair — both
  branches store exactly slot/slot+4). Post-fill: `0x9ef570(&bandB,
  f64, temp)` @0x792ef0; `0xa735a0(begin, count>>3, false)` on band B
  AND on a **third stack vector frame[+0xf0]/[+0xf4]** @0x792f46.
- **frame[+0x48] = the driver at setup** (`lea 0x8c(%ebx)` @0x792f56;
  slot later reused as the ceiling count — writer open); **A ==
  driver[+0x70] == 0 → `je 0x793338` skips the whole cell loop**
  @0x792f77.
- **Line-1109 expr byte-read = `cell`** @0x1190a78 ⇒ 0x7412c0 returns
  a cell object.
- **Opens tagged**: fill-source builder + setup 0x7926xx..0x792e7x
  (list provenance; frame[+0x70]/[+0x50]/[+0x48] setup writers;
  frame[+0xf0] fill); post-loop 0x793360..0x7935f0 (+ 0x793338
  A-guard); band tail 0x793c6a..0x793cf0; bodies 0x740f80 / 0x7412c0
  / 0x909370 / 0x909da0 / 0x93d710 / 0x93edb0 / 0x93ee40 / 0x93ef50 /
  0x9ef4e0 / 0x9ef570 / 0xa735a0 / 0x949e80 / 0x94a9d0 / 0x9d89d0 /
  0x93e550; band field provenance; vfunc[1]==2; frame[+0x80];
  driver[+0x78]; 0x908f40 stale xmm0; 0x909da0 setup reference.
- Landed: ABOUT_MATH entry **(109)**, CONSTANTS **C88** committed as
  **`b1aeb06`** (gates green at commit: y224 0.0000 / caves-field 33/33 /
  npm test 258/258). No §8/§12, no patch — judge parked, drop path OFF.
- Next: setup/fill-source region + post-loop region; then **(104)④
  side-by-side 0x8fb570 vs the ported whiteLattice2d**; then P3
  (register rows → test pins; I20② port only as register-backed
  patch with IoU after); hell + heaven census regions follow surface.
- Counters: next entry **(110)**, constant **C89**, issue **I22**,
  VERIFIED §8 row 33.

## Update 2026-09-28 (10) — P2 read #7: post-loop margin region (C89 + entry 110)

- **Method**: `/tmp/opencode/fulltext86.asm` windows; strings
  byte-read (`0x11a4814`, `0x117a518`); every address below re-read
  on disk this session.
- **Function range byte-defined**: `FUN_00792580` =
  0x792580..0x793e5e (`ret` @0x793e4e; next fn @0x793e60).
- **The post-loop region = an (8,8)-margin scan + a 3×3
  type-neighborhood comparator + a type-item placement loop** —
  the biggest semantic block since the cell loop:
  - margin: x ∈ [8, w−8), y ∈ [8, h−8); center cell → **vfunc[12]**
    → **`0x742940(frame[+0x80], type)` returns a std::vector<T> of
    32-byte T** (begin/end `[0]`/`[4]`, size `>>5`; byte-proof: the
    checked-subscript abort message `invalid vector<T> subscript`
    @0x117a518); null → next x.
  - two (3,3) grid objects (frame[+0x100] / frame[+0x120], ctor
    `(3,3)`, `[+0x18]` = heap grid, freed in the dtor chain);
    per-cell reset via `0x92ea40`.
  - neighbors `(x+dx, y+dy)` for dx, dy ∈ {−1,0,1}: null → skip;
    **assert 1206 `data->array2d->IsValid( x + x0, y + y0 )`** (entry
    `x+dx ≤ 511 ∧ y+dy ≤ 511`); **vfunc[12] equal → grid1[(dy+1)·stride
    +1+dx] := 1 + equal-count++**; unequal → `0x7706c0(center,
    neighbor)` (body open) → true → **grid2[same] := 1**;
    frame[+0x30] counts all marks.
  - `equal-count ≥ 8 → skip placement`; else the item loop:
    **`0x770aa0(array2d, x, y, center, originX, originY, &obj1[+4],
    equal-count, &obj2[+4], mark-count)`** per 32-byte item, byte
    offset `frame[+0x64] += 0x20`.
  - x++/y++ with the `dim−8` guards; **`ebx := frame[+0x38]` (driver)
    restore @0x793cd7** after the dx-loop.
- **Loop-exit block byte-exact** (confirms (106)):
  `A->0x909370(originX, originY, originX+w−1, originY+h−1,
  &driver[+0x98])`; the singleton callback
  (`ecx = &0x1344b90; call *[(*0x1344b90)+0x6c]`) fires at **both
  ends** (0x79335d / 0x793d81) and its x87 double return is differenced
  against the start time (spilled → frame[+0xcc] @0x793377) →
  **`fstpl 0x18(%ebx)` = `driver[+0x18]` = this function's elapsed
  time** @0x793dac. `driver[+0x70]` (A) == 0 → the whole cell loop is
  skipped into the exit block (0x909370 null-receiver = open).
- **Complete dtor chain**: obj2 grid → obj1 grid → `0x7924c0(ecx)`
  (open) → **`driver[+0xc8] := 1`** (`xchg` with ecx=1) → free
  ceiling `frame[+0xe8]` → free grass `frame[+0xb4]` → free band B
  `frame[+0x9c]` → SEH/cookie/ret. Exactly three stack vectors.
- **CORRECTION of (109)** ("third stack vector frame[+0xf0]/[+0xf4]"):
  wrong — esp-pending-push slip. Reads @0x792f23/0x792f2c have **2
  pushes pending** ⇒ `frame[+0xec]`/`frame[+0xe8]` = the **ceiling
  vector's {end, begin}**; the second `0xa735a0` runs on the ceiling
  vector; bool slot = frame[+0x4c]. §6 append-only ⇒ the correction
  lives in (110).
- **frame[+0x48] writer FOUND** @0x792f42 (`mov %eax,0x58(%esp)` with
  **4 pushes pending** ⇒ frame[+0x48] := the ceiling count) — closes
  (109)'s tag; `0x93ee40(&driver[+0x8c], count)` follows (body open).
- **Opens tagged**: bodies 0x7706c0 / 0x770aa0 / 0x742940 / 0x92e980
  / 0x92ea40 / 0x94a9d0 / 0x7924c0 / 0x93ee40 / 0xa735a0 / 0x93ef50 /
  0x9ef4e0 / 0x9ef570; obj[+4]; frame[+0x80]; driver[+0xc8];
  driver[+0x18] cross-ref (104)②; margin constant 8; the 32-byte
  item; 0x909370 null-receiver; the setup/fill-source region
  0x7926xx..0x792e7x; 0x908f40's stale xmm0; the 0x909da0 setup
  reference; the cell-loop callee bodies (unchanged list).
- Landed: ABOUT_MATH entry **(110)**, CONSTANTS **C89** committed as
  **`98c5f75`** (gates green at commit: y224 0.0000 / caves-field 33/33 /
  npm test 258/258). No §8/§12, no patch — judge parked, drop path OFF.
- Next: setup/fill-source region 0x7926xx..0x792e7x (the {double,
  ptr} source builder) + callee bodies; then **(104)④ side-by-side
  0x8fb570 vs the ported whiteLattice2d**; then P3 (register rows →
  test pins; I20② port only as register-backed patch with IoU after);
  hell + heaven census regions follow surface.
- Counters: next entry **(111)**, constant **C90**, issue **I22**,
  VERIFIED §8 row 33.
