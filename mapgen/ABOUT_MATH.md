# Noita Map-Gen Math — Working Notes

> **File note (2026-09-03)**: the `mapgen/` folder was reorganized after this
> document was partly written (`wang.mjs`→`lib/wang-wasm.mjs`, `wangjs.mjs`→
> `lib/wang-js.mjs`, `pngio.mjs`→`lib/images.mjs`, pipeline + dated
> experiments). Evidence-log entries may cite the old filenames; the current
> layout and each file's purpose live in `mapgen/README.md`.

Everything we know about the map-generation math, with sources and verification
status. This is the shared map of the rabbit hole — update it as we learn.

Legend: ✅ verified (we ran it / byte-compared) · 🔎 plausible (code read, not
empirically tested) · 🔗 cross-confirmed (multiple independent sources agree,
but no direct in-game probe yet) · ❓ hypothesis · upstream refs are
`vendor/noita-tools/src/services/SeedInfo/noita_random/src/` (`nr/` = noita_random.cpp,
`w/` = wang/wang.cpp, `wi/` = wasm_in.cpp).

---

## 1. Coordinate systems

| System | Unit | Range / size | Conversion |
| --- | --- | --- | --- |
| **World px** | game pixel | capture spans x −53760..+53759 (3 DZI segments, incl. parallel worlds); **main world = 70 chunks, x −35..+34** (−17920..+17919); origin = left edge of biome-map px 35 | — |
| **Chunk** | 512 world px | world is 71×144 chunks in the capture (−35..+35, −62..+81) | `cx = floorDiv512(worldX)` |
| **Biome-map px** | 1 px = 1 chunk | 70×48 (`data/biome_impl/biome_map.png`; re-verified on disk 2026-09-04 — also disproves the "64×64 / 96×55 chunks / 35714 px" figures that circulated in a session handover) | `cx = tx − 35`, `cy = ty − 14` 🔗 (offset 14 = game's own `biome_offset_y` ✅; conversion = noitool's decompilation + capture alignment; **not yet probed in-game**) |
| **Wang cell** | 10 world px | lattice of the wang layer | `cell ≈ worldPx / 10` — **non-integer ratio 512/10 = 51.2, see §4** |
| **Atlas px** | 1 px in `data/wang_tiles/<biome>.png` | coalmine 348×448, excavationsite 344×440 … | 1 atlas px = 1 wang cell ✅ (iterateMap `cb(gx + px*10, …)`, mapWasm.ts:182) |
| **bigMap px** | per-area cell grid ×10 | `w*10 × h*10` where `w,h` = area dims in cells | anchored at **area origin**, not world origin (noitool choice) |
| **Capture image px (DZI)** | 1 px = 1 world px at level 17 | 36352×73728, TileSize 512, Overlap 2 | `imagePx = worldPx + (17920, 31744)`; **DZI tile `i_j` = biome-map px `(i, j−48)`** ✅ (bench:ref works, tiles line up) |

Key exact functions (from `w/`):

```cpp
GetGlobalPosX(x,y) = 512 * (x − 35);        // pure linear, NO rounding  ✅ (w/:105)
GetGlobalPosY(y)   = 512 * (y − 14);        //                            ✅
GetWidthFromPix(a,b) = (b*512)/10 − (a*512)/10;   // C TRUNCATING division ✅ (w/:77)
```

Empirical check ✅: `GetGlobalPosX(34,14) = −512` = exact chunk border of the
spawn Mines area (bench manifest, 2026-09-03).

## 2. The PRNG (exact, ✅ from nr/:15-70)

Lehmer (minstd) PRNG in double arithmetic — the reconstructed Noita RNG:

```
Next():  v = 16807 * (int)Seed − 2147483647 * ((int)Seed / 127773)   // Schrage, a=16807, m=2³¹−1
         if (v <= 0) v += 2147483647
         Seed = v;  return Seed / 2147483647
NextU(): Next(); return Seed * 2⁻³¹ * 2147483645        // ≈ Seed as uint
Random(a,b): a + (int)((b+1−a) * Next())
SetRandomFromWorldSeed(s): Seed = s; if (s ≥ 2147483647) Seed = s * 0.5
NewNollaPrng(x): Seed = x; Next() once (warm-up discarded)
```

All integer division here is **C truncation toward zero** — behavior differs
between positive and negative operands (matters in §4).

## 3. Generation pipeline (✅ we run exactly this)

Per biome **area** (bounding box of one connected component of a biome color):

1. `SetWorldSeed(seed)` — global (nr/:64).
2. `w = GetWidthFromPix(area.x1, area.x2+1)`, `h` likewise — area dims in cells.
3. `MapHandlerNew(w, h, color, isCoalMine, shouldBlockOutRooms, randomMaterials, area.x1, area.y1)`
   — the handler stores `worldX = x1 − 35`, `worldY = y1 − 14` (area-relative, w/:836).
4. `generate_map(atlas PNG bytes)` → decode, drop alpha, build stb herringbone
   tileset (cached per color, w/:673).
5. **RNG chain** (`w/:730`):
   `rng = GetRNG(width)`: `SetRandomFromWorldSeed(worldSeed)`, one `Next()`,
   then advance `iters = (width mod 11) + (worldSeed mod 12)` more
   (the `11*(width/−11) − 12*(worldSeed/12)` dance = mod via truncation).
6. **Rejection loop** (≤100 tries):
   - `rng2 = NewNollaPrng(rng.NextU())` — per-attempt sub-RNG
   - `stbhw_generate_image(...)` fills `width × (height+4)` cells, consuming `rng2`
   - **the top 4 cell-rows are discarded** (`memcpy` from row 4, `w/:752-756`) — why? ❓
   - `MapGen(...)` wraps the cell grid; `hasPath()` = JPS pathfinding validation
     (jps.hh); on success `finalize()`; else consume `rng.NextU()` and retry
7. `rgbToRgba` → map buffer (1 RGBA per cell); `toBig()` = nearest ×10 upscale ✅

Not exercised by us (yet): `drawImageData` (pixel scenes) and `MapGen::finalize()`
internals (room blocking, randomMaterials application).

## 3bis. Atlas format — fully decoded (2026-09-03, ✅ verified)

Each `data/wang_tiles/<biome>.png` is a self-describing stbhw template:

**Binary header** = last 9 RGB bytes of the image's FIRST row, decoded as
`header[i] = byte[w*3-1-i] ^ (i*55)` — **truncated to uint8** (C semantics;
a JS port must `& 0xFF` — this exact bug produced garbage once).

- `header[7] == 0xC0` → **corner-type**: `num_color[0..3] = header[0..3]`,
  `vary_x = header[4]`, `vary_y = header[5]`, `short_side_len = header[6]`
- else → edge-type: `num_color[0..5]`, `vary_x = header[6]`, `vary_y = header[7]`, `short = header[8]`

Tiles are packed per `stbhw__process_template` (3 px separators, +1 px content
offset); h-tile = `2s×s` px, v-tile = `s×2s` px; each carries 6 corner
constraints (a,b,c top/left, d,e,f bottom/right).

Verified decode of all 31 atlases (dims recompute exactly via the template
size formula): **all corner-type except winter_caves (edge-type)**. Sparse
per-vertex-class color counts exactly as article 2 predicts: coalmine
`(1,2,1,2)` vary 3/3 short 13 → 72h+72v tiles; excavationsite `(1,2,1,2)`
short 20 → 32h+32v; liquidcave `(1,2,1,2)` short 20; snowcave `(1,2,1,2)`
short 26; crypt `(2,1,3,1)` short 22; fungicave `(3,1,3,1)` short 13 …

**Key consequence**: with these sparse sets, every 6-corner constraint combo
has exactly ONE tile → tile choice is uniquely determined by the vertex color
grid; the only randomness is the vertex coloring itself.

## 3ter. The fill algorithm (corner mode, read in full)

1. Vertex grid `xmax = w/s+6`, `ymax = h/s+6`; corner class `p = (i−j+1)&3`;
   `c_color[j][i] = rand() % cc[p]` — **one RNG draw per vertex, scan order**.
2. Repetition-reduction pass (default ON): re-colors vertices where a 3×2
   neighborhood matches fully (extra RNG draws, order-dependent).
3. Herringbone scan: `ypos = −s`, `j = −1`, `phase = j&3`, column start
   `i = phase? phase−4 : 0`, step 4; h-tiles consume vertices
   `[j+2..j+3][i+2..i+4]`, v-tiles `[j+2..j+4][i+5..i+6]`; `choose_tile` =
   2-pass count-then-pick, **one RNG draw per tile placement**.
4. Output pixel (0,0) ↔ vertex (2,2); vertex (I,J) ↔ output px
   `((I−2)·s, (J−2)·s)`; 1 output px = 1 atlas px = 10 world px (scale still 🔗).

## 4. The alignment problem — the actual frontier

**The two grids disagree.** Wang cells are 10 px; chunks are 512 px;
`512/10 = 51.2` cells per chunk. Two grids with an irrational-ish (non-integer)
ratio cannot stay aligned without re-anchoring. This is where "wang → game
space" (noitool's declared unsolved part) lives, and where the user's principle
applies:

> **A constant offset is only valid if the drift it corrects is zero or
> sawtooth-shaped. Any linear (multiplier) component makes a constant wrong
> far from where it was measured.**

Known facts:

- `GetGlobalPos` has **no phase at all** (pure `512*(x−35)`) — chunk corners are
  assumed exactly on cell boundaries ×512... which 512 does NOT satisfy (512 ≢ 0 mod 10).
- `GetWidthFromPix` = `worldPx/10` with **truncating** division → on negative
  world px, trunc ≠ floor: cell boundaries are asymmetric around x=0. Example:
  `(−512)/10` truncates to **−51**, floor would give **−52**.
- Under noitool's anchoring, per-chunk cell counts sawtooth between 51 and 52
  (period 5 chunks, since 512k mod 10 cycles 2,4,6,8,0), and bigMap px drift
  up to ±10 px from world px at internal chunk boundaries. Measured ✅: chunk
  35 of the spawn area crops at bigMap x=520 while its true world offset is 512 (+8).
- The `+5/+13` magic in `drawImageData` (`w/:858-867`): chunk assignment for
  pixel scenes uses `(gx+5)/512`, `(gy+13)/512`.
  - `+5` = half a cell (10 px): assign by cell *center* → fixes cell-straddles.
    Defensible, not a drift fix.
  - `+13` = `+5 + 8`: an 8 px vertical phase with no derivation. Empirical patch ❓.
  - User's critique stands: if real drift is linear, these constants only work
    near where the author measured them.

**Hypotheses for the true anchoring:**

| # | Model | Prediction |
| --- | --- | --- |
| H1 | Global anchor at world 0: `cell = floor(x/10)` (floor, not trunc) | no drift at all; noitool's trunc version errs by 1 cell near/below x=0 |
| H2 | Game re-anchors the lattice at each chunk boundary | sawtooth error vs any global model, amplitude ≤10 px, period 1 chunk |
| H3 | noitool: per-area anchor at `(area.x1*512)/10` trunc | deviates from H1 by the trunc-phase of the area origin; consistent per area, varies between areas |

**Discriminating experiment:** fit per-chunk best shift as a function of
distance from the area origin (and from world 0). Sawtooth (H2) → alternating
signs; linear → monotonic growth; H1 vs H3 → single-cell steps at negative coords.

**Related oddities (unexplained, record-only):**

- `GetBiomeOffsetX()` (`w/:113`): derives a seed-dependent offset
  (`NewNollaPrng(worldSeed)`, 3rd `Next()`, scaled to ±100 000) — **dead code**,
  never called in the wasm path. Either an unused game mechanic (biome-map
  shift per seed?) or an abandoned experiment. Worth checking against the game.
- `BIOME_PATH_FIND_WORLD_POS_MIN_X/MAX_X = 159/223` (`w/:105-106`) — beyond the
  70-wide map; parallel-world east coordinates?

## 4bis. Herringbone theory — the nothings.org articles (read 2026-09-03)

Sources (now fully read, linked from https://nothings.org/gamedev/herringbone/):
`herringbone_tiles.html` (2011) and `more_herringbone_tiles.html` (2014).

**Critical fact: `wang.cpp` includes `stb_hbwang.h` — Barrett's own library
companion to these articles.** This is not analogous theory; it documents the
exact algorithm family inside Noita.

Layering of the two mechanisms (no contradiction):

```
outer loop (rejection sampling):   do { candidate = wang_fill(rng2); accept if hasPath() } ≤ 100×
inner generator (herringbone wang): fill the WHOLE lattice in one pass, edge-constrained, from rng2
```

Wang tiling = which tile colors go at which lattice cell (cell space).
Rejection sampling = keep/discard whole candidates (also cell space).
Neither moves the lattice relative to world px — the alignment problem (§4)
lives entirely in the cell↔world mapping functions. A candidate re-roll
changes *content*, never *grid position*. Sub-cell measured shifts (−2,−4 px)
point at rounding modes, not fill behavior; whole-cell (10k px) shifts would
point at generation windowing (see below).

Key theory takeaways relevant to Noita:

1. **Complete stochastic set**: if the tileset has every edge-combination
   variant, filling is trivially left-to-right/top-to-bottom with no
   backtracking — and, crucially, the generator can respect *pre-placed*
   constraints without a solver.
2. **Large/multi-tile structures** ("special content wider than one tile"):
   place them FIRST (pre-placement), express them with unique boundary colors
   forcing co-placement, then fill around them. This is almost certainly how
   Noita does multi-chunk structures (Holy Mountains, wide rooms, Tower) —
   and noitool's `shouldBlockOutRooms` / `blockedColors`
   (coalmine, excavationsite, solid_wall_tower_1/2) is his reconstruction of
   exactly that pre-placement step.
3. **Herringbone structure** (article 2): 6 edge classes, **4 vertex classes**
   with independently choosable color counts (e.g. `(2,2,2,1)` reduces tile
   count 2-4×). When we parse `stbhw_build_tileset_from_image` / the atlases,
   expect this per-class color structure. The 4 vertex classes also explain
   why horizontal and vertical phase behavior can differ (relevant to +5 vs +13).
4. **Suspect carried forward** (user's instinct, sharpened): the generation
   WINDOW — stbhw generates `height+4` rows and noitool discards the top 4
   (§3 step 6). If the game's window/start-corner parity differs, content
   shifts by whole cells → looks like misalignment. Test after the
   trunc-vs-floor experiment.

## 5. Knobs we control (bench)

- `mapgen/coords.mjs` `CORRECTION`: offsetX/Y, flipX/flipY (bigMap-px, post-hoc).
- Area anchoring: `wang.generateArea` passes `area.x1/y1` — an H1 variant would
  anchor cells to world 0 instead.
- Flags: `isCoalMine` (coalmine, solid_wall_tower_1), `shouldBlockOutRooms`
  (coalmine, excavationsite, solid_wall_tower_1/2) — mirror noitool's maps.json.
- `randomMaterials`: parsed from biome XML `<RandomColor>`, encoded as
  **24-bit RGB ints** `[n, [from, k, to…]]` (noitool `hexRGBAtoIntRGB` =
  `parseInt(hex.slice(0,6),16)` — alpha dropped ✅).

## 5bis. Special areas & connectivity — constraint ruleset

How unique (pre-placed) areas relate to the randomized wang fill. Layer model,
each layer with what we know and what we don't:

```
L0  biome partition      static biome_map.png → chunk → biome (per seed? see GetBiomeOffsetX, §4)
L1  pre-placement        WHICH special structures exist and WHERE — unknown selection rule
L2  constrained wang     fill respects pre-placed boundaries (stbhw complete-stochastic-set model)
L3  connectivity check   the whole candidate is validated (JPS hasPath) → rejection loop
L4  pixel scenes/decor   overlays (LoadPixelScene pools), spawn functions
```

**The exit↔corridor constraint** (the reason L3 exists at all): a pre-placed
structure has fixed doors/exits at fixed lattice positions; the fill must
produce walkable continuity between those doors and the randomized tiles
around them, otherwise the candidate is rejected and re-rolled. Per the
herringbone articles (§4bis), the game can enforce this two ways:

- **in-lattice**: the structure is authored *as wang tiles* with unique
  boundary colors that force co-placement and guarantee corridor matches
  (article 1's "large tiles" mechanism) — then L2 handles it for free;
- **post-hoc**: regions are carved/blocked out of the candidate *after*
  filling, and the path check (L3) is what guarantees the exits still connect.

Known code artifacts mapped to layers (upstream, mostly 🔎 unread):

| Artifact | Layer | Status |
| --- | --- | --- |
| `shouldBlockOutRooms` flag (coalmine, excavationsite, solid_wall_tower_1/2) | L2/L3 | passed through, semantics unread |
| `blockedColors[]` + `IsBlockedColor()` (w/:59) | L2 | **unread** |
| `coalmine_hax.cpp` (special-casing) | L2/L3 | **unread** |
| `MapGen::hasPath()` + `jps.hh` (per-area path check) | L3 | partially read — start/end points, walkability rules **unread** |
| `GeneratePathMapRaw` export (path map per area) | L3 | unused by us so far |
| atlas unique boundary colors (co-placement forcing) | L1/L2 | expected per articles; not yet inspected in atlases |
| discarded `+4` rows in stbhw output | L2 windowing | unexplained |

Open questions specific to this ruleset:

1. Is pre-placement **in-lattice** (atlas colors) or **post-hoc** (carving)?
   `coalmine_hax.cpp` + `blockedColors` likely hold the answer.
2. Where does the *selection* of special structures consume RNG — the same
   `GetRNG` stream before wang filling, or a separate one? (Order matters.)
3. Does the game enforce **cross-biome continuity** (a biome's exit must meet
   the next biome's entrance), or does each area's own `hasPath` suffice?
   Holy Mountains are the hand-placed inter-biome connectors — likely fixed
   geometry, but unverified.
4. Do rejected candidates re-use the same pre-placements (L1 fixed per seed,
   only L2/L3 re-rolled) or re-place structures too?

## 6. Evidence log

- **2026-09-03 — wrapper fidelity**: `node mapgen/verify.mjs` — 28/28 comparable
  noitool fixtures byte-identical (RGB). The 12 fails are all biome-map px
  (53,30-31) where noitool's embedded world map says coalmine/excavationsite but
  the current game says Tower → their data version is older. Not our bug.
- **2026-09-03 — layout extraction**: our connected-component areas for all
  biomes equal noitool's `maps.json` areas (e.g. Mines [34..38, 14..15]). Atlas
  PNGs in maps.json are pixel-identical to the extracted game files (0 diff bytes).
- **2026-09-03 — first fit** (`node mapgen/fit.mjs`, 20 chunks, spawn window):
  zero-shift air/solid agreement 59.7% avg; best-over-shift 65.0%; per-chunk
  best shifts inconsistent (dx −34..+62); **zero flip votes** → content
  divergence, not a global transform.
- **2026-09-03 — capture mapping**: DZI tile grid == biome-map px grid verified
  by successful tile fetches and visually plausible content; overlap = 2 px,
  level 17 = native.
- **2026-09-03 — seed fix**: `src/main.ts` had capture seed 786433191 (wrong);
  correct is 78633191 (tilesources.json / map_definitions.json).
- **2026-09-03 — fixture scope clarified**: noitool's Map fixtures compare his
  implementation against snapshots of itself (regression tests). They do NOT
  validate against the game. "Wang generation ~100% understood" had never been
  pixel-tested against a capture before our bench.
- **2026-09-03 — anchor sweep** (`node mapgen/sweep.mjs`, 20 chunks, spawn window):
  all anchor modes and sub-cell phases score 58.3–59.7% (noitool baseline 59.7%,
  best-vs-baseline +0.0 pts). **Alignment hypothesis family eliminated as the
  primary cause** — the sawtooth crop correction (§4) is real arithmetic but
  immaterial: content mismatch dominates at any sub-cell alignment.
- **2026-09-03 — metric calibration** (chunk 35_15, coalmine): same-seed gen vs
  ref = 56.2%; unrelated seeds (seed+1, seed 42) = 60.0% / 57.7%. **Same-seed
  content is statistically unrelated to the capture at the air/solid metric.**
  The ~60% agreement level is the density baseline of two similar-density maps,
  not partial signal.
- **2026-09-03 (late) — builder port + positional test** (`mapgen/wangjs.mjs`,
  `mapgen/wangtest.mjs`, `mapgen/possweep.mjs`):
  - JS port of the corner-mode fill (vertex coloring + rep-reduce + scan +
    choose-tile + SetRandomSeed with diddle table). Port vs wasm agreement
    ~39% of cells — expected if noitool's hasPath rejection accepted a later
    attempt (each attempt is fully re-colored); exact validation would need
    porting all of MapGen (blocked rooms, coalmine overlay, JPS isValid).
  - Positional model (vertex color = SetRandomSeed(worldSeed, worldX, worldY),
    unique tile choice, no rep-reduce): swept 3 call shapes × 5×5 anchor
    offsets → 49.1–52.3%, flat, no spike. Naive positional hypothesis
    **not confirmed** (but parameter space not exhausted).
- **2026-09-03 (late) — noise-floor calibration (decisive)**: gen(seed A) vs
  gen(seed B) for the same biome = 60.2–65.8% (the true "unrelated wang
  layers" baseline). gen-vs-capture: excavationsite 61.0% / 59.9% (at or
  below floor), spawn coalmine 47.2% (well below). **noitool's wang output is
  statistically unrelated to the game's terrain.** The earlier ~60% figures
  were density baselines, not signal.
- **2026-09-03 (late) — density gap**: raw wang layer = 38–46% solid; capture
  = 61–62% solid. The game's visible terrain is far denser than a bare wang
  layer — it includes background walls / edge fills / scenes / overlays
  (cf. noitool finalize(): `fillMainPath`, `fillBlockedRooms`, `fillC0ffee`,
  `fillRandomMaterials`). **The wang-vs-capture metric is confounded by these
  layers; a bare wang layer can never score near 100% against the capture.**

- **2026-09-03 (late) — wang_gen.exe template diff** (`experiments/2026-09-03-wang-gen-template-diff.mjs`):
  Nolla's official tool (`tools_modding/wang_gen.exe`) generates blank wang
  templates from CLI params (`{out} c {sidelen} {c0..c3} [{vx} {vy}]`).
  Generated the coalmine template (`c 13 1 2 1 2 3 3`) and diffed vs the real
  atlas: **dims identical (348×448), header bytes byte-identical, and our
  walk parses both into the identical 72h+72v constraint enumeration**; edge
  mode round-trips too (winter_caves params → 1206×278).
  1. Template-layout walk proven against the canonical tool ✅
  2. Confirms atlas lineage = the same stb_hbwang library we documented.
  3. `wang_gen.exe` is **template-side only** (artist canvas, no seed, no fill)
     → the builder remains in `noita.exe` → Lua RNG oracle is next.
  4. Bug found & fixed in our port: the stbhw **variants loop**
     (`vary_x`/`vary_y` — every constraint combo appears ×N with distinct
     pixel art) was missing from `wang-js.mjs` template walk (parsed 24h+24v
     instead of 72h+72v). The earlier positional experiments ran with a ⅓
     tile pool — conclusions (no signal) unaffected in direction, but the
     port is now complete.

Established: atlas format ✅, fill algorithm semantics ✅, PRNG ✅,
alignment family eliminated ✅, noitool wang ≠ game terrain (statistically) ✅.
Unknown: (1) what the game's actual vertex-coloring source is, (2) how much
of the capture is non-wang content, (3) what finalize's fills contribute.
The capture cannot validate a bare wang layer — we need either a wang-only
ground truth (dev-build probe) or to model the full layer stack.
- Capture = noita-mapcap base-layout (physics frozen) of seed 78633191, hosted
  by noitamap (acidflow.stream). Same tiles our viewer displays.
- **2026-09-04 — non-tiling RNG is already solved by noitool (🔗)**: HM perk/shop
  offers, fungal shift, chest/potion/wand contents etc. are fully reconstructed
  in noitool's InfoProviders (`Perk/`, `Shop/`, `FungalShift/`, `ChestRandom/`,
  `Potion*`, `Wand/`, with spec tests); the author's accuracy statement leaves
  only wang→tile coords + `RaytracePlatforms` unsolved (`ARCHITECTURE.md`).
  User-verified in practice (tool predictions match the game). Consequences:
  (1) Holy Mountain *content* (the ~5% of HM-band pixels that do vary across
  seeds) is seed-dependent but **not wang** — exclude from fill constraints and
  don't count it as wang anomaly in the 3-seed diffs; (2) spawn-equation
  constraints must come only from wang-triggered spawns (`wang_scripts.csv`
  colors → item entities), not HM pedestal content.

## 7. Open questions → ordered experiments

> **Status after 2026-09-03 (full day):** alignment eliminated; noitool's wang
> output statistically unrelated to the capture (below the gen-vs-gen noise
> floor); capture is ~24 pts denser than any raw wang layer → the metric is
> confounded by non-wang layers (walls/scenes/edges). Priorities re-ordered
> accordingly.

1. **Read noitool's `MapGen` post-processing in full** (`finalize`,
   `isMainPath`, `fillMainPath`, `fillBlockedRooms`, `fillC0ffee`,
   `ClearPath`, `blockOutRooms`, `doCoalMineHax` + the overlay image):
   these define what the wasm output actually contains and mirror what the
   game adds on top of the wang layer. Without this, "wang vs capture" is
   comparing different layer stacks.
2. **Isolate a wang-only ground truth**: use `noita_dev.exe` + noita-mapcap
   style probing to capture the game's terrain for a seed, then subtract the
   known non-wang layers (or capture with wang-only magic numbers if
   possible). Alternatively quantify non-wang share per biome from the
   biome XMLs (`PixelScene` probabilities, `BitmapCaves`, edge noise).
3. **In-game probe of the fill RNG**: with the dev build, force a known
   seed, dump the map around spawn (mapcap area capture), and test specific
   vertex-coloring hypotheses (sequential vs positional vs hybrid) against
   the actual tile boundaries visible in-engine.
4. **wasm rebuild knobs** (fork + `tools/zig`): discarded-rows `k`, RNG skip
   constant, rep-reduction on/off.
5. **GetBiomeOffsetX dead code** — check if the real game shifts biome-map
   sampling per seed (would change biomeAt, not just tiles).
6. **In-game probe of the biome-map mapping** (upgrade 🔗 → ✅): telemetry
   mod session vs `biomeAt` predictions.
7. Only then: targeted Ghidra on `noita.exe` for whatever remains unexplained.

## 7bis. RNG ORACLE RESULT (2026-09-03 night) — reconstruction CONFIRMED 🎉

`mods/noita-livemap-rng-probe/` (in-game dump) + `experiments/2026-09-03-lua-oracle-crosscheck.mjs`:

- Probe: 4 world seeds × 66,049 positions × (1× `ProceduralRandomi(x,y,0,255)` + 8×
  successive `SetRandomSeed(x,y)`/`Random(0,255)` draws) = 528,392 oracle values per seed.
- First crosscheck: 50.38% of positions matched all 8 draws, the rest matched none —
  bimodal per-position (no positional correlation, no stream offset) → a branch on an
  intermediate value.
- Forensics: brute-force state recovery proved the game's stream IS our LCG + draw
  function (exactly one 4-draw-consistent state per position); the true seed of a
  mismatched position (349,458,217) ruled out 24+ formula variants offline.
- Root cause: our JS `helper2` returned a **signed i32** (JS `^` semantics, missing
  `>>> 0`) — when the mixer output's high bit was set (~50% of positions), `g` went
  negative and every comparison/division in the final adjustment misbranched.
- After the one-line fix: **100.00% match on all 4 seeds (2,113,568 verified draws).**

**Status: the game's RNG (`SetWorldSeed`/`SetRandomSeed`/`Random`/`ProceduralRandomi`)
is game-verified in JS** (`wang-js.mjs` `seededPrng`). The wang mystery is now purely
HOW the fill consumes these numbers — which positions get seeded, how many draws per
vertex, in what order. Test B (oracle-driven fill sweep) is armed: dump larger truth
tables once, then sweep fill hypotheses offline forever.

## 7ter. Fill sweep v1 — per-vertex seeding ELIMINATED (2026-09-03 late night)

Same-seed oracle (user forced seed 78633191 via a seed mod — dump seed == capture seed)
+ `experiments/2026-09-03-fill-sweep.mjs`:

- Hypotheses: vertex color = `ProceduralRandomi(x, y, 0, cc[p]−1)` at {worldPx, cell}
  encodings, {normal, swapped} axes, anchor delta swept over the full lattice period
  in the dump's residue class — 1,154 valid hypotheses, 17 scored chunks
  (coalmine, excavationsite, liquidcave areas).
- Result: best 56.7%, landscape 53–57% — **below the gen-vs-gen noise floor (60–66%)**,
  no spike anywhere. **One-draw-per-vertex position-seeded coloring is NOT the game's
  scheme.**
- Methodological finds: oracle grid residue vs lattice residue must match exactly
  (RNG values at ±1 px are unrelated); area anchors at chunk corners have different
  mod-10 residues → delta must be swept per area.
- Next hypothesis family: **per-chunk sequential fills** (seed once per chunk at its
  origin, fill that chunk's lattice sequentially — explains lazy generation + seed
  determinism; echoes noitool's `+4` rows and `+5/+13` magic). Requires long
  sequences per chunk origin → probe v4 (8× Random(0,255) anchor + 4088× Randomf()
  per chunk origin, 24×9 chunk window) deployed, awaiting game run.

## 7quater. Fill sweep v2 — per-chunk sequential fills ELIMINATED (2026-09-04)

Probe v4 (216 chunk-origin streams: 8× Random(0,255) anchors + 4088× Randomf, seed
78633191 = capture seed) + `experiments/2026-09-04-chunk-fill-sweep.mjs`:

- Anchor validation: **100.00%** (1728 draws) — the game's `SetRandomSeed(chunkOrigin)`
  streams are exactly our verified RNG; dump integrity confirmed.
- Hypotheses: per-chunk sequential fills seeded at the chunk origin, 8 variants
  (tile-choice draws × draw-for-cc1-vertices × the +4-row discard), stbhw scan order,
  20 same-seed scored chunks.
- Result: 49.5–52.2%, all below noise floor. **Per-chunk origin-seeded sequential
  fills eliminated** (within this variant family).
- Draw-precision note: the 8-bit anchors determine small-range draws exactly for
  cc=2; cc=3 is ambiguous on 2/256 anchor values (treated as wildcards).

**⚠ Methodological caveat now critical**: eliminations assume a CORRECT fill would
score ABOVE the 60–66% gen-vs-gen noise floor against the capture. But the capture
carries ~24 pts of non-wang density (walls/scenes/edges) — the TRUE wang layer vs
capture might legitimately score below the wang-vs-wang floor. The negatives above
are therefore "no tested hypothesis beats the noitool baseline", not proof of absence.
**The decisive scoreboard must be paint-immune: spawn-function equations** (each orb/
perk/chest position = an exact wang-cell color fact). Priority: fix probe v3 (the
entity filter came back empty) and make spawn equations the primary judge; geometry
becomes secondary confirmation.

## 7quinquies. Seed differential analysis (2026-09-04)

User hypothesis: comparing seed N vs N+1 could reveal the generation math.

- **RNG level (tested, ✅)**: the game's mixing avalanches — across 5 world seeds
  (4 random + the capture seed), pairwise identical `ProceduralRandomi(x,y,0,255)`
  values = 0.38–0.41% ≡ the 1/256 chance baseline. **No locality at the value
  level; seed+1 arithmetic carries no information.**
- **Structure level (proposed, the real content of the idea)**: comparing two
  adjacent-seed *worlds* discriminates what our pixel metric cannot:
  1. **Skeleton test** — lattice vertices with 1-color classes are seed-independent
     by construction; if adjacent captures share the domino-boundary skeleton and
     differ only within constraint classes → per-position-independent coloring;
     if they differ nearly totally → sequential streams.
  2. **Game-side noise floor** — capture(N) vs capture(N+1) = the true baseline
     "unrelated real worlds", which our fill eliminations lacked.
  3. **Fixed-region map** — structures surviving the diff (spawn room, Holy
     Mountains) are seed-independent and subtractable from comparisons.
- Needs: a mapcap-style capture of seed 78633192 (user's seed mod + noita-mapcap
  Area/base-layout mode). The RNG-avalanche result is why the *capture* diff —
  not a value diff — is the informative artifact.

**RESULTS (2026-09-04, captures done — full detail in `mapcap/README.md`)**:

- Captures: 78633191 = noitamap ref stitch (cached), 78633192 = `run1b`,
  78633193 = `run2` (both in-game, parallax off, same 19×9 grid). In-game
  capture pipeline pixel-stable (tile overlaps 99.6–99.7% identical).
- **Skeleton test**: real 512-grid seams exist — wang generation does NOT blend
  across chunk boundaries in places (x=2048 4.6×, y=1536 3.6× discontinuity vs
  interior baseline; identical across independent captures ⇒ content).
- **Game-side noise floor**: foreground overlap 99.6%+ identical across
  independent captures; flat-region high-pass RMS 0.16/255.
- **Fixed regions**: Holy Mountain bands (biome rows j=16, 19, 23, 26, 30, 34 =
  temple_wall/temple_altar + solid_wall) are ~95% seed-independent (template
  biomes, no wang). Sky/void above surface is black (background disabled).
  Full zone table: `mapcap/PREDICTABLE_ZONES.md`.
- **Adjacent-seed divergence**: 26.45% of foreground px changed (91↔92);
  92↔93: 83.0% window-identical, 37/171 chunks fully stable. This is the
  calibration target for any fill hypothesis (L2).
- **Seed-independence classes** (3-way, 91/92/93): 48.0% of px identical in all
  pairs; **17.9% two-agree-one-differs with an EVEN split across which seed
  differs** (5.5/6.5/5.8%) ⇒ small-variant-pool choices, not avalanche RNG —
  a new RE target (randomMaterials/scene variants?); 6.8% all-distinct (wang
  detail). A fill model that only produces all-distinct pixels for changed
  content misses the two-agree class entirely.

## 7sexies. Spawn-equation judge v1 — L1 armed, first paint-immune verdict (2026-09-04)

**Oracle data** (`mods/noita-livemap-rng-probe/` v3 sweep, committed fixtures
`mapgen/fixtures/oracle/`): entity dumps for 78633191/92/93 (74/54/50 items;
filter `data/entities/items/`, first-sighting positions). Probe bug fixed:
`EntityGetFileName` → `EntityGetFilename` (annotations.lua:161 — old code
failed 100% of lookups). 15 sightings identical across ALL 3 seeds = fixed
spawns, exactly as PREDICTABLE_ZONES predicts (HM pedestals/perks, altar
orb_00+book, kantele, evil_eye, orb-room orbs) — the 3-way diff itself
validates the observation protocol.

**Trigger audit (pixel-counted in the atlases, this session)** — tiles carry
ONLY three wang spawn colors:

| Atlas color | wang_scripts fn | Effect (biome Lua, verified) |
| --- | --- | --- |
| `00ff00` | spawn_items | biome-local fn → RNG gate → `wand_altar` pixel scene (coalmine 47% air/29% altar; fungicave 94% altar) |
| `78ffff` | spawn_heart | 70% `heart.xml`, else chest_random/mimic |
| `55ff8c` | spawn_chest | chest_random — registered in coalmine only |

`spawn_wands`/`spawn_potions` colors have ZERO atlas pixels: wands, potions,
thunderstone, brimstone, broken_wand all CASCADE from green — `wand_altar.png`
itself contains a single `50a0f0` px → `spawn_wands` → per-biome `g_items`
(coalmine = wand_001..017 + potion; excavationsite = level_02 wands; fungicave
= unshuffle wands). **Constraint set = root triggers only.**
`goldnugget*` = physics debris (props/orbs break during the camera sweep,
terrain kills enemies; no static spawner exists) — excluded (user insight,
2026-09-04).

**Judge** (`experiments/2026-09-04-spawn-judge.mjs`): for each seed-dependent
item, the root trigger color must appear within dx±4 / dy[−6..1] atlas px of
`floor((world − areaOrigin)/10)` in the model's fill, using FULL
connected-component area dims (v1 had a shrunken-bbox bug — GetRNG's skip
depends on area width — fixed).

**RESULT (48 constraints: 22 potion, 12 heart, 9 chest, 4 wand, 1 egg):**

| Model | Satisfied |
| --- | --- |
| noitool wasm (full pipeline incl. rejection) | **0/48** |
| wang-js sequential, single attempt | **5/48** (heart 3/12, potion 1/22, chest 1/9) |
| chance expectation (color share 0.01–0.17% × 45-px window) | ≈ 0.2 |

Both candidate models fail the spawn equations — the first **paint-immune**
eliminations, independent of the capture's non-wang layers that confounded
§7ter/§7quater. The js sequential model is indistinguishable-from-chance to
slightly-above; noitool's model is flat zero.

**Caveats / next knobs**: physics drift can move items below the tolerance
window (a correct fill needs ≫10%, not exactly 100%); anchor hypotheses
(H1/H2/H3, §4) not yet swept; js model lacks the hasPath rejection loop;
per-class detail in `mapgen/out/oracle/judge-v1.json`.



## 8. Glossary

- **Wang tile / herringbone**: domino-shaped tiles (2:1) whose edge colors must
  match neighbors; herringbone = alternating orientations, staggered lattice
  (nothings.org/gamedev/herringbone). Noita uses stb's implementation
  (`stb_hbwang.h` vendored in wang/).
- **Pixel scene**: ≤512² image of materials overlaid on the wang layer
  (structures, altars), placed by probability pools or biome scripts.
- **JPS**: Jump Point Search — grid pathfinding; noitool uses it to validate
  that a generated map has a walkable path (rejection sampling).
- **DZI**: Deep Zoom Image — the tile pyramid format noitamap serves; level 17
  is native resolution.
- **Area**: bounding box of one connected component of a biome color on the
  biome map; generation unit (one wang lattice per area).
