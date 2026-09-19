# Noita Map-Gen Math — Working Notes

> **File note (2026-09-03)**: the `mapgen/` folder was reorganized after this
> document was partly written (`wang.mjs`→`lib/wang-wasm.mjs`, `wangjs.mjs`→
> `lib/wang-js.mjs`, `pngio.mjs`→`lib/images.mjs`, pipeline + dated
> experiments). Evidence-log entries may cite the old filenames; the current
> layout and each file's purpose live in `mapgen/README.md`.

Everything we know about the map-generation math, with sources and verification
status. This is the shared map of the rabbit hole — update it as we learn.

> **Read order note (2026-09-08):** the distilled, current-only truth —
> verified facts, eliminated-don't-retest rows, open frontier — lives in
> `mapgen/VERIFIED.md`. This file is the research journal: new results land
> here first (§6 evidence log is append-only), and settled conclusions are
> distilled into `VERIFIED.md`. Where the two disagree, re-check the cited
> sources; the newer evidence wins and both get fixed.

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

1. Vertex grid `xmax = w/s+6`, `ymax = h/s+6`; **class `p = (i+j)&3`**
   (corrected 2026-09-07 from the binary: FUN_008ec9f0 uses
   `(i+j)&3`; the earlier `(i−j+1)&3` reading was wrong — see §7octies;
   the lab's binary-class rule `(I−J)&3 ∈ {0,2}` has the same parity classes).
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

- **2026-09-18 (2) — F1 stage-9 read + SHIFTED-SLAB correction (session):**
  - **Correction first (affects all Sep-18 dig VAs):** the F1
    "0x50b000 region" dig ran through an objdump slab whose VAs print
    **file+0x400** (slab = file[0x400c00:0xdd0000], adjust 0x401000) while the
    true VA = file+0x400c00 for .text — VAs shifted by **−0x400800**. Pinned
    empirically by byte-checking absolute features: the SetRandomSeed mixer
    constant 0x93262e6f sits at file 0x8f147 → **true VA 0x48fd47** (= the
    Ghidra anchor), and the "ProceduralTerrain::Update()" profiler-string
    stores live at true **0x90b8cf** (`c7 45 9c`) / 0x90c7ac (`c7 85 90`),
    the "DoBufferedPixelScenes()" store at true **0x910c59** — all in the
    0x90xxxx procedural_terrain region, not 0x50b000. Every 0x50b000-range
    entry from the previous dig maps to true VA = old + 0x400800. The file→VA
    method rule in the ledger has been updated accordingly (numeric e8/imm32
    scans with site = off+5+0x400c00 are the reliable instrument; raw
    disassembly must be sliced at exact function starts).
  - **FUN_0090b8a0 = ProceduralTerrain::Update() entry:** thin; profiler-scope
    begin + `call 0x910c20` at 0x90b8f5 (also called from 0x90c7de = the
    enqueue tail's flush — two call sites total, both verified by e8 scan).
  - **FUN_0090c1f0 = InsertBufferedPixelScene(this, 0x90-record, bool)** —
    FULLY READ this session: compares the incoming record against every
    queue element (ints +4/+8; 0x18-wide strings at +0x24/+0x3c; bytes
    +0x58/+0x59; blob at +0x5c via FUN_00442bc0 (slab-name; true 0x00442bc0)); equal → return untouched
    (dedup). Else construct a local copy (+ optional FUN_008a2850 hook),
    push into the vector ([esi]/[esi+4], stride-0x90) — with a swap-push
    when the byte at +0x58 is set — and if the queue was empty, immediately
    profiler-scopes and runs 0x910c20(this) (the per-write flush).     Callers
    (e8-scanned, true VAs): 0x818c6e (= LoadPixelScene's binding ✓ consistent
    with the earlier dedup verdict), 0x907fc9 (Init), 0x90bd1e (buffered
    Update region), 0x64ca47, 0xd15a57 (static init).
    The insert semantics (`load_even_if_duplicate`) match the binding's
    decoded record fields exactly.
  - **FUN_00910c20 = DoBufferedPixelScenes() — FULLY READ:** drains the
    0x90-stride vector: (a) status-2 records EXECUTE: FUN_00668800 loads the
    scene object (0x28-B result), FUN_008fdc90 (noise-utils region) gets the x/y floats from the
    record's dword copies, then virtuals `*0x4c(%eax)` + `*0x20(%eax)` and
    float→obj+0x80 — the actual in-world scene load; (b) otherwise the
    camera-cull branch: ±32 px around the record's (x,y) [record +4/+8, with
    camera bounds from FUN_0043ac50 (slab-name; true)'s ctx (+0x10 → +0x544) → FUN_008e6650 (slab-name; true)],
    and the load condition = **ALL FOUR overlapping 512-px chunks loaded**,
    tested via FUN_0094b040((x±32)>>9, (y±32)>>9) probes of the chunk
    bit-grid object DAT_0x132aed8 — else DEFER (FUN_00796660 (frame-tick region); debug byte
    0x132802a → FUN_0099f640 log into 0x12ee538). This explains
    chunk-load ORDERING of scenes: terrain first, scenes only after their
    chunks materialize.
  - **The last STREAMING_CHUNK_TARGET unknown resolved:** DAT_0x12eb130 is
    read DIRECTLY (no getter indirection — hypothesis falsified) at true VAs
    **0x79e65a / 0x79e6f1 / 0x79e74f**, inside a per-frame budget regulator:
    a global counter esi is compared against thr, 2×thr, 3×thr (the
    `lea (%ecx,%ecx,1)` / `lea (%ecx,%ecx,2)` patterns); a double budget
    DAT_0x132aef0 is halved (0.5 @0x11dfdd8) or reset from DAT_0x12eb7f0;
    violations log (0x11a55d4 / 0x11a567c). → the regulator converts
    STREAMING_CHUNK_TARGET into a per-frame time budget; the actual
    chunk-request consumer = the chunk bit-grid 0x132aed8's imm-user families
    (0x405ee1, 0x642exx, 0x720exx, 0x7919xx — same 0x79xxxx frame-tick
    neighborhood) = the NEXT dig.
  - **float/u16 world-grid write chain (plan target 3):** FUN_008f95c0
    SetSize — (re)allocates the float grid (+0x18) + u16 material grid
    (+0x38) — has EXACTLY TWO e8 call sites, both Init-side: 0x90738f and
    0x907852; the second is mid area-object construction ([edi+0x34]=w,
    [edi+0x38]=h, coord movdqu at +0x3c, [edi+0x8c]=0, `lea 0x90(%edi),%ecx`
    → `call 0x8f95c0(sub, w, h)`) ⇒ **each AREA object's +0x90 sub-object
    owns its own float/u16 world grids, allocated at INIT (not at chunk
    load)**. u16 reader FUN_009fe4e0: 19 call sites — the noise_utils
    accessor family 0x8fa000–0x8fb000 (incl. FUN_008f9ab0
    LoadFromImageData's family; its callers = 0x8fa9a0 + Init's
    0x905ddc/0x905f23), plus 0x64c80c, 0x90446c (hasPath region), and
    0x90dcd3 (a new per-load sampler function in the buffer neighborhood,
    next read). **Answered the plan's cache-vs-regenerate question in
    direction: grids are Init-built + area-cached; a chunk load READS the
    cached area grids (no regeneration).** The remaining piece — the exact
    wang out_map → float/u16 grid write order inside the area fill, and the
    (3,3)/(+5,+13) anchor semantics — hangs off the copier read (see F1
    next-read leads in VERIFIED §11).
  - **Same session (2) — chunk-materialization skeleton (closing F1 further):**
    The per-chunk post-load pipeline exists as a **Staged Chunk state machine**:
    `FUN_008e4ec0` runs states [ebx+0x18] = 0(rule 0x247) → 0x24e → 0x255 →
    0x25c, each stage pushing a ±0x100 (chunk half, 256 px) quadrant pair into
    the cache builder **FUN_00939b80 (profiler "build cache")**, then calling
    **FUN_008e4990 = DistanceField_UpdateForChunk** (profiler 0x1172b60, ONE
    imm store at 0x8e49cb; stages i ±0x100/ey ∓/+0x100 around the chunk
    origin) — i.e. the Chunk carries its own distance-field caches built 4
    quadrants per stage, wrappers through functor thunks 0xa99cc8 (the same
    std::function family at 0xa99xxx whose invoke thunk 0xa99ea0 → 0x904c20
    = the wang fill driver). Also read: **FUN_0090d860 = the per-cell
    material/noise sampler** (reads the u16 material grid via FUN_009fe4e0
    at +0x20-slot lookups, floats via FUN_009499f0/FUN_0094a8f0 through
    +0xbc/+0xd8/+0xdc/+0xd8-f8/+0xf4/+0xfc sub-grid-range derefs, u8 markers
    via 0x949bb0, and evaluates a smoothed noise = FUN_00908cb0 (biome-space
    cell + (gx+5)-ish trilinear lookup) and FUN_00908e70 with the
    smoothstep constants 0x11dff70 / 0x11dfe68 / comiss 0x11dfa94 and 1.0f
    @0x11dfbf0; IAT 0x114a434 (CRT math) — GRID parameters as expected.
    This is the DECOR/noise-terrain read path that F3's perlin fills feed.
    NEW F1 leads logged; the out_map→grid copier + anchor constants remain.
  - **F1 CLOSED (this entry appended to the two above; final reads):**
    FUN_009fe4e0 (u16 TileGrid GET, read-only-verified — [ecx+0x1c] gate,
    wrap-indexed via idiv on negative coordinates, returns u16 from
    [grid+0x18] via FUN_00a242c0; NO write sites anywhere in the 910c20
    family). FUN_00939b80 = chunk-map Get-with-cache ("chunk_top_left" /
    "chunk_world_index" asserts at 0x1179ef0/0x117a080; exception logging
    at 0x1197c8c), used by FUN_008e4ec0 = the per-Chunk staged state
    machine (0→0x247→0x24e→0x255→0x25c, quadrant cache prep at chunk
    halves ±0x100=256 px) and by its 4-caller wrapper chain
    (0x8ea030/0x8ea410 biome.cpp sub-family + FUN_008e6af0 functor
    invoke-thunk 0xa99cc8). CONSUMER SEMANTIC (the F1 close): chunk loads
    never regenerate terrain — the accepted out_map rests on Init-time
    per-area materialization; at runtime the only common writes are
    FUN_0090c820 cache records (pixel-scene / distance-field caches).
    Perlin core = FUN_008fca60 family (read as a smoothed
    value-noise lattice with per-cell gradient bit table 0x114bf30; decode
    constants ×0.1 (0x11dfd08 f64 0.1), 1/9 (0x11dfd20), thresh 0.5
    (0x11dfa94), 0.45/0.33/0.11 shade select (0x11dfa5c/0x11dfa10/0x11df97c),
    0.94/0.95 (0x11dfbac), 15.5 (0x11e01b0) — the F3 backend (exact math
    still to be decoded).


- **2026-09-18 — doc review + flow-first dig (session):**
  - **Oracle re-validated:** `2026-09-08-haspath-oracle.mjs` run against the
    on-disk oracle fixtures — 4/4 pass (excav 91→0, 92→3, 93→1; coalmine 91→1).
    No code change; session-state consistency check.
  - **New binary probe 1 — DEBUG magic-number flags exist.** Strings
    `DEBUG_GENERATE_BIG_WANG_MAP` (file 0xd6f464 → VA 0x1170264) and
    `DEBUG_FULL_WANG_MAPS` (file 0xd6f7d4 → VA 0x11705d4) are referenced by
    `push imm32` at VA 0x472ef0/0x472f51/0x472f87 and 0x4742e3/0x474344/0x47437a
    respectively (numpy u32-VA scan, ledger method). Both sites are the SAME
    registration pattern: push string → lea stack buffer → `mov [ebp-4], LINE`
    (0x3ea=1002, 0x426=1062 = source __LINE__) → identical helper set
    (0x1c6b0 string ctor, 0x2b8xx assign family, 0x1c710 dtor, 0xc09ef0/
    0xc0a160 = std::map ops). Verdict: an engine debug-flag registry (likely
    std::map<string,bool>) wired from the debug-toggle subsystem; the exact
    storage slot + the READERS of these flags are NOT yet found (no other
    imm refs to the strings → readers must go through the registration's
    stored pointer/index). **If these are runtime-togglable, they may be a
    first-class in-game wang ground-truth oracle** (full wang maps /
    big-map generation debug rendering) — the thing every earlier "wang-only
    ground truth" note wanted. Also present: `REGEN_WANG_MAPS`
    (file 0xd8eb24 → VA 0x118f924) — ZERO imm refs (registered by a
    different mechanism or console-only).
  - **New binary probe 2 — the streaming path located:**
    `ProceduralTerrain::Update()` profiler string (file 0xd745ac → VA
    0x11753ac) is stored to stack as a profile-name at VA 0x50b0cf and
    0x50bfb2 (`c7 45 9c ac 53 17 01` / `c7 85 90 fe ff ff ac 53 17 01`) —
    so the knobby functions in the **0x50b000 region = ProceduralTerrain::Update**
    + its (likely static/member helpers) = the per-frame LAZY chunk-generation
    driver. Entirely absent from every prior ledger region list (0x4xxxxx/
    0x8xxxxx/0x90xxxx/0xbee-0x10a). **Unread; this is the missing runtime
    stage between the Init-time area fills and the world grid.**
  - **F1 opened (same session, later):** the 0x50b000 region resolved into 3
    functions (see ledger table): FUN_0050b0a0 = ProceduralTerrain::Update()
    thin entry (profiler-begin via FUN_0259e40) → FUN_00510420 =
    **DoBufferedPixelScenes()** — the runtime buffered pixel-scene processor
    (vector iterate, stride-0x76c records, IAT + virtual dispatches). Also
    FUN_0050b9f0 = a second Update-scoped body, 4 callers — unread. So the
    first runtime stage decoded is the pixel-scene FLUSH, exactly the
    machinery the genmap's template rendering approximates. Next: full dump
    of 0x510420/0x50b9f0 and the queue they drain.
  - **Method trap recorded:** the pre-existing `text.bin` slab was stale
    (wrong extraction offset → objdump VAs shifted by 0x400800 — plausible-
    looking garbage). Fixed by regenerating with `f[0x400c00:0xdd0000]`;
    freshness rule added to the ledger method notes.
  - **F1 continued (same session):** LoadPixelScene binding = FUN_008183c0
    (full read via an existing dump): per-scene record (materials/colors
    filenames, x/y, background, skip flags, color_to_material_table, z-index,
    load_even_if_duplicate) → dedup insert into a **0x90-stride record
    vector** via FUN_0090c1f0 (two string-compare dedup, verified in-binary —
    supersedes the older "(width,height,seed) area cache" reading at this
    site; that call site re-verification pending). The per-frame consumer is
    the previously decoded DoBufferedPixelScenes (FUN_00510420, drained
    through ProceduralTerrain::Update FUN_0050b0a0 / FUN_0050b9f0). So the
    buffered pixel-scene enqueue → flush pipeline is now traced END TO END
    at the mechanism level: Lua biome scripts → binding → dedup queue →
    per-frame draw. STREAMING_CHUNK_TARGET (=12) locates its runtime slot
    (DAT_012eb130, writer 0x46a742); readers remain to be found (no imm32 in
    .text → getter path).
  - **Doc survey:** all repo docs re-read this session (SESSION_CONTEXT,

    ROADMAP, mapgen/*.md, mapcap/README + PREDICTABLE_ZONES). Reconciled:
    no live contradiction remains on the fill chain — VERIFIED §5/§9's "C'=ws
    runtime-confirmed but ws excluded" applies ONLY to the injected lab biome
    (non-Init path, §8 row 17); regular areas are closed by 12/12 spawn
    equations + 4/4 hasPath oracle.

- **2026-09-08 (late) — HASPATH PORTED + ORACLE-VALIDATED** (`lib/has-path.mjs`,
  `lib/generate-exact.mjs`, `experiments/2026-09-08-haspath-oracle.mjs`).
  Exact port of noitool's decompilation-derived rejection rule (Search =
  greedy best-first flood, priority |y−goalRow| then FIFO, neighbors
  up/left/right/down, visited cells painted PURPLE and state PERSISTS across
  the top-row scan; traversable = black/coffee/0xcff7c8/0x8aff80;
  blockOutRooms (9 pixel-scene colors → white rects, scan sees its own
  fills); doCoalMineHax (overlay from vendored coalmine_hax.cpp, 256-wide);
  coalmine start_x=142; fillMainPath band for mainPath areas).
  **Oracle: 8/8 constraints** — first-accepted attempt = 0/3/1 for
  excavationsite 91/92/93 (92 rejects exactly 0,1,2 first). Independent
  cross-check: coalmine 91 → attempt **1**, matching the spawn-equation
  judge's family-shift winner (chest+wands at manh 3–4) — two methods, one
  answer. The CE A=99 hint stays attributable to another w≡3 mod 11 area
  (coalmine_alt or an item-less area; untestable, consistent).
  API: `generateAreaExact(ts, w, h, seed, {isCoalMine, shouldBlockOutRooms,
  worldX, worldY})` → accepted out_map (post-hasPath mutations, = finalize
  input) + blockList + attempt; ~10 ms/area.
  NOTE: the game's driver can SKIP hasPath entirely (flag `[ESP+0x20]`,
  asm 0x9058e4: JZ → AL=1) — unidentified, all oracle areas validate.

- **2026-09-08 — THE CHAIN IS CORRECT: end-to-end spawn-equation confirmation
  (`experiments/2026-09-08-chain-vs-spawn-equations.mjs` + `-chain-signal-analysis.mjs`)**.
  The asm-exact sub-seed chain (C = ws → 1 warm-up → skip = (w%11)+(ws%12) →
  attempt A: state = schrage^(16+A)(ws), param_9 = ((double)state × C1) ×
  2147483645, TLS seed = param_9, 1 warm-up) was first validated **bit-exact**
  against the CE reading (schrage^115(78633191) → param_9 = 1444051512.578899),
  then every attempt A=0..99 was filled with the corrected wang-js mechanics
  (class `(i−j+1)&3`, rep-reduce, choose-tile, +4-row discard) and scored
  against the frozen spawn equations with shift-voting over a global anchor:
  - **Direct-trigger constraints (heart/chest, spawn at the trigger pixel):
    12/12 across seeds 91/92/93** — excavationsite 91 A=0: 2/2, 92 A=3: 4/4,
    93 A=1: 5/5 (perfect, UNIQUE attempts), coalmine 91: chest+wands hit.
    All satisfied at one consistent (+1..3, +1..5) px anchor.
  - Wrong-seed controls (60 fills): ceiling 3/4, 2/5 — never perfect.
  - All remaining misses = CASCADE classes (potions via the wand_altar scene):
    item→root-trigger offsets are structural (altar art), beyond the ±2 px
    window — a judge limitation, NOT a fill error. A=99 (the CE-observed last
    fill) belongs to an area without oracle items (untestable, consistent).
  - The anchor being ~(3,3) px also resolves §9 item 3: the port's real-area
    geometry is essentially exact; the lab's (3,−1)-cell offset was lab-recovery
    bookkeeping, not a game-vs-port difference.
  **Verdict: the wang layer is prediction-solved modulo (a) the hasPath
  emulation (to predict WHICH attempt is accepted — observed A=0..3 for these
  areas) and (b) cascade-class spawn offsets (altar-scene data model).**

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

**FROZEN-PHYSICS RE-RUN (2026-09-04 evening) — primary dataset now**:

- Protocol: `noita_dev.exe` + mapcap `disable-physics` ON → probe sweep FIRST,
  then mapcap area capture in the same frozen world (corners −3072,−1536 →
  6656,3072, 19×9). On-screen probe status added (started/done/skip/failed).
- Engine finding: mapcap's `disable-physics` (DEBUG_PAUSE_BOX2D) **crashes the
  dev build under entity streaming** — `physicsbody_system.cpp:1722` /
  `physicsbody2_system.cpp:569` asserts ("body already in mDestroyedBodies")
  accumulate while the sweep unloads chunks, then abort (~stop 80/96). One
  retry completed; evidence in `mapcap/out/../oracle/crash-20260904/`
  (mapgen/out/oracle/crash-20260904/).
- Frozen dumps: gold **0** (was 23–26 → debris theory confirmed), 54/52/50
  items, 0 lookup failures, fixed spawns intact. Fixtures swapped to the
  frozen trio (`mapgen/fixtures/oracle/`); physics-on trio archived as
  `mapgen/fixtures/oracle-physics-on/`.
- Judge re-run (tolerance tightened to dx±2 / dy[−3..1] — items sit at exact
  spawn offsets): wasm **0/48**, js-seq **6/48** (~chance). Verdict unchanged
  on pristine data: both models fail the spawn equations.
- **Trigger colors are consumed at generation**: sampling the game's own
  frozen capture at item positions finds 0/32 trigger-color pixels — the
  rendered world never shows spawn colors, so geometry metrics are blind to
  spawn facts by construction. Entity dumps are the only observable.
- Frozen capture diffs (same build, same pipeline): 91↔92 **82.34%** identical
  (40/171 stable chunks), 92↔93 **83.10%** (40/171) — consistent with the
  physics-on L2 calibration (~26.5% foreground divergence). Same-seed
  cross-pipeline (frozen91 vs noitamap ref stitch, build 2024-08-12): only
  **80.4%** identical, changed-px mean diff 120 → the hosted reference is NOT
  pixel-faithful to today's build; treat cross-build diffs as qualitative.



## 7septies. WANG LAB — controlled experiments (2026-09-04 night)

**The lab** (`mods/noita-wang-lab/`): a 16-tile custom wang biome injected at
runtime (BIOME_MAP lua + `BiomeMapSetPixel` rect at biome px tx 2..6, ty
36..37; `_biomes_all.xml` runtime patch; atlas generated by our own template
encoder `mapgen/lib/wang-template-writer.mjs`, round-trip self-tested against
`buildTileset`). Every tile's content carries a unique marker color; the game
fires our spawn callback per placed pixel → tile placement log per seed
(`save00/noita-wang-lab-tiles-<seed>.csv`, via the game global store —
biome-script sandboxes have NO io and NO sight of mod globals; learned the
hard way, two iterations).

**How the lab works (functioning, for future sessions):**

1. **Injection** (`init.lua`, mod load time): patch `_biomes_all.xml` via
   `ModTextFileSetContent` (idempotent, guards on "wanglab.xml"), then
   `ModMagicNumbersFileAdd` pointing `BIOME_MAP` at
   `files/biome_map_loader.lua`, which does `BiomeMapSetSize(70,48)` +
   `BiomeMapLoadImage(0,0,"data/biome_impl/biome_map.png")` +
   `BiomeMapSetPixel` for the 5×2 lab rect (color `ff0a0b0c`, registered in
   the patched XML with `biome_filename` pointing into the mod folder).
2. **Atlas** (`files/wang_tiles/lab.png`, 30×56): corner-type,
   `numColor=(2,1,2,1)`, `short_side_len=4`, vary 1/1 → 8h+8v tiles. Written
   by `lib/wang-template-writer.mjs`, which mirrors the canonical template
   walk (the reader assigns corner constraints by SLOT POSITION, not pixel
   colors) and paints each tile's whole content with a unique marker RGB
   (interiors are free art). Self-test: parse the written PNG with
   `buildTileset` and diff constraints + markers.
   Header gotcha: the 9 header bytes land 3-per-pixel on row 0 — paint them
   per-PIXEL, not per-byte (byte write order clobbers channels), and apply
   the `& 0xff` truncation on encode AND decode.
3. **Readout** (`files/scripts/lab.lua`, generated): thin shim —
   `RegisterSpawnFunction` per marker color + per-tile callbacks that push
   rows into the game's global store (`GlobalsSetValue("wanglab_r_<n>", …)`,
   counter in `wanglab_count`). The biome-script sandbox has no `io` and no
   sight of mod globals (two failed designs before this); the mod context
   (init.lua, owns io) drains the rows every frame into the per-seed CSV and
   filters stale rows by seed (globals.lst persists across sessions).
   `0xffffeedd` per-chunk init did NOT fire for our mod biome (no anchors in
   the CSVs — harmless, rows carry positions).
4. **Session protocol**: lab mod + seed mod ONLY (rng-probe also drives the
   camera — conflict). The mod auto-visits the rect with 5 camera stops
   (frames 600..2100 after world load) so chunks generate; callbacks fire on
   placement; expect `[wang-lab] done - N rows` ≈ 35 s in. Physics state is
   irrelevant for the readout (markers fire at placement time), but frozen
   physics (mapcap `disable-physics`, dev build) makes dumps cleaner.
5. **Recovery** (`experiments/2026-09-04-lab-vertex-recovery.mjs`): rasterize
   fired pixels → 10-px cells → connected components = placements (keep only
   full 8×4 h / 4×8 v extents; partials sit at clipped edges or ungenerated
   chunks) → fit lattice phase φ ∈ [0..3]² (measured (1,1), 0 misaligned —
   the fired grid is offset from the fill's output grid by the world
   placement phase) → integer vertex indices I = (X+φx)/4+2 → each placement
   pins 6 corners → over-determined grid, **0 conflicts** → the per-seed
   answer key (`out/oracle/lab-vertex-grids.json`).
6. **Class rule (empirical, supersedes §3ter's note)**: binary classes at
   `(I−J)&3 ∈ {0,2}`; classes {1,3} are single-color (0) by construction —
   a built-in skeleton: ~half the vertices are seed-independent.
7. **Optimizer** (`experiments/2026-09-04-lab-optimizer.mjs`): automated
   hypothesis search with EXACT-MATCH prefilter scoring (abort on first
   mismatch — a true model walks all informative vertices clean; partial-walk
   scores are noise: at n≤55 the max over 188M candidates is ~90%, the v1
   lesson), selective journaling (`out/oracle/optimizer-log.jsonl` — v1 OOMed
   writing 33M lines; v2 logs new bests/survivors only, RSS ≈ 72 MB), two
   exits: 100% → auto-verify on 92/93 → save `out/oracle/lab-solution.json`,
   or timeout (minutes arg). Templates: S1 sequential via `seededPrng(ws,sx,sy)`
   exhaustive over every world pixel of the rect (~94M candidates ≈ 35 min),
   S2 `SetRandomFromWorldSeed` + skip k ≤ 200k, P positional over coordinate
   systems × offsets × draw shapes.

**Resource profile**: repo disk holds all analysis artifacts (~350 MB in
`mapgen/out` + `mapcap/out`, gitignored, 900+ GB free); the game disk (E:)
holds mapcap raw tiles/stitches (~140 MB per capture set, 200 GB free —
watch it, 90% used). Optimizer is single-threaded, RSS ≈ 72 MB, ~50k
candidates/s; `--max-old-space-size=4096` as belt-and-braces.

**Vertex grid recovery** (`experiments/2026-09-04-lab-vertex-recovery.mjs`):
338 full placements per seed → 778 vertices, **0 conflicts** (natural corner
mapping: h = a,b,c left→right top, d,e,f bottom; v = a,b,c left col top→bottom,
d,e,f right col). Class rule CORRECTED empirically: binary classes at
`(I−J)&3 ∈ {0,2}` (not the `(i−j+1)&3` of §3ter — parity shifted by one).

**Structural facts (exact):**
- The lattice is **GLOBAL and continuous across chunk boundaries** (v-tile
  phase mod 4 = 3 in every chunk/seed; tiles straddle boundaries freely,
  depths 1.7/2.3 = a 4-wide tile split by the fractional 51.2 edge). H2
  (per-chunk re-anchor) is dead — H1/H3 territory, now testable exactly.
- Cross-seed vertex agreement ≈ coin flips (51.4/55.8/49.7% pairwise, 28.5%
  all-equal vs 25% expected) → per-vertex values are seed-avalanched, with a
  small (~3.5%) all-equal excess (structure TBD: rep-reduce? init effects?).
- Trigger colors are consumed at generation (0/32 in captures) — the lab's
  callback channel is the only way to observe spawn facts directly.

**Eliminated on clean data (exact, thousands of variants, seed 91 + verified
on 92/93 where relevant)** — a correct model must score ~100%:
- noitool sequential (`seqAttempt`): 15–17% cell match
- `SetRandomFromWorldSeed` + skip k ≤ 1200 × 3 draw shapes × choice-consume
  on/off: none
- mixer variants: direct `NollaPrng(ws)`, diddled `seededPrng(ws,0,0)`,
  `(ws,ws,0)`, `(0,ws)` × skips: none
- positional 1-draw hashing: `random()`, `next()`-float, warm-up, `nextU()%cc`,
  world AND lattice-index hashing, full-period (±40 px) offsets: plateau at
  **58–60%** (never a spike — but the ~+8% over coin-flip says the true scheme
  IS position-correlated; the draw mechanics differ)
- hybrid position-seeded → sequential at canonical anchors (corner phases,
  center, chunk origins/centers, world origin): none

**VERDICT after the full deep sweep (2026-09-05, 13.3 h unattended)**:
644,555,000 candidates — S1 (every pixel of the rect × 7 draw shapes × 9
alignments × warm-ups 0–3 × budgets {0, 40}), S2 (skips ≤200k), P (4
coordinate systems × offsets × 7 shapes), biome-grid seeding, per-chunk
lattices (structurally excluded). Final accuracy **58.03% (318/548)** =
exactly the full-walk noise floor (~58.5% at n=548). **The vertex-coloring
rule does not live in any tested configuration of the verified RNG
machinery.** The lab has formally exhausted the cheap search space.

Consequences:
- The fill's randomness is deterministic per (seed, area) — order-independence
  was verified experimentally (100% identical placements across camera paths)
  — but its source is **not** the Lua-visible RNG we reconstructed. Most likely
  a separate C++-internal PRNG instance (e.g. an engine-side generator) seeded
  from a derivation we haven't modeled.
- **Ghidra escalation is now sanctioned** (the roadmap's condition: "only when
  everything cheaper is exhausted" — met with a 644M-candidate receipt).
  Target: the fill call site in noita_dev.exe — locate `stbhw_generate_image`,
  its rand() callback, and the state initialization feeding it.
- The lab remains the instant verification bench: whatever the decompilation
  reveals is implemented as a new search family and tested to 100% against the
  548-vertex answer key in minutes (integrity suite all-PASS, planted-solution
  verified).

**GHIDRA FRONT OPEN (2026-09-05)** — headless Ghidra 12.1.3 + JDK 21 installed on
the WSL side (tools/, ~2.5 GB, no Windows-side install needed). Target:
`noita_dev.exe` (17 MB, build 2025-01-26). **First anchor landed pre-analysis**:
the mixer XOR constant `0x93262e6f` appears EXACTLY ONCE in the binary (file
offset 0x8f147 → VA 0x48fd47, .text) = the game's `SetRandomSeed` mixer is
located. Lua API name strings confirmed present ("SetRandomSeed" ×4,
"ProceduralRandomi" ×2, "RegisterSpawnFunction" ×2, "wang_template_file" ×4).
Auto-analysis runs unattended; staged `HuntFill.java` decompiles the mixer, its
callers (2 levels), and RNG-string xrefs into ghidra-logs/. Working note: the
diddle table is NOT stored contiguously (0 hits as bytes or dwords) — computed
at compile time or restructured.

**Careful framing (user-pushed, 2026-09-05)**: the mixer hit at 0x48fd47 is
TIER-1 confidence (unique 32-bit immediate, false-hit expectation ~0.004) but
its LABEL is ours (could be an inlined copy), and — critically — the lab PROVED
the fill does not use this mixer: decompiling it is for **pipeline calibration**
(diff against our verified JS) and **elimination mapping** (the fill lives in
code that never touches this path). The real prize anchors: PRNG fingerprint
scans. **0x343FD (MSVC rand multiplier): 12 hits, 6 densely clustered at
0x34b27–0x36031 (.text)** — far above chance; hypothesis: the fill reads an
MSVC-rand-style LCG, re-seeded per area (fits order-independence + explains
invisibility to our Lua-visible machinery). Also 1× glibc-style LCG (0xc08728);
mt19937/64-bit LCGs: ruled out. Fill door anchors confirmed in-binary:
"wang_scripts.csv" (the spawn-color walk over placed tiles), "wang_map_width"
(Topology parser → area setup), "data/wang_tiles/" ×3 (template loader).

**GHIDRA READING STATE (2026-09-05 night) — dumps in ~/work/ghidra-logs/**:
Calibration ✅: FUN_0048fd30 (VA 0x48fd47) decompiled = the verified mixer,
step-for-step (diddle table backward-index, &3 warm-up loop, 16807/127773
Lehmer core, the assert leaks the source path
"poro/source/utils/random/random.cpp" — Nolla's engine framework). Pipeline
proven: we can read this binary.

Key functions mapped:
- FUN_00633930: LCG consumer (state global DAT_0132a388, ×214013 +2531011,
  draws (x>>16)&0x7fff → floats) — per-object random-position spawner?
- FUN_00794620 (23 KB): uses BOTH the poro mixer AND the LCG — per-object
  positions in a vector loop, seeds LCG from (objfield + base + idx*2 − 3)^0xc
  — READ FULLY (prime fill candidate)
- FUN_00436a50 (39 KB): global-LCG gameplay logic (10%-chance dice) — likely
  NOT the fill (global state = order-dependent, contradicts the lab)
- Registry: RegisterSpawnFunction binding = FUN_00807d20; the color→name map
  lives in BiomeSpawnScripts::GameLuaManager instances (global list
  DAT_01347698..0134769c, 12 list-management users dumped — consumer not yet
  among them)
- 1,958 RTTI class names extracted (/tmp/opencode/rtti-names.txt) — no
  wang/generator class (the fill is free functions)

Method notes: byte-scan fingerprints for short constants (0x343FD = fd 43 03 00)
are noisy at binary scale (697 hits, all instruction fragments) — decompile-
first works better. Ghidra script API quirks: find(String,Address) doesn't
exist; getDefinedStrings signature differs; use findBytes(null, hex) sparingly
(silently found nothing for .rdata strings — use computed VAs + getReferencesTo
instead). File→VA: .text file+0x400c00, .rdata file+0x400e00.

**GHIDRA KNOWLEDGE STATE (consolidated 2026-09-05, ✅ unless tagged)** —
processing state in **mapgen/ghidra-ledger.md**:

1. **Toolchain**: headless Ghidra 12.1.3 + JDK 21 (WSL side, tools/, no root).
   Scripting: Java scripts compiled with javac against the jars (see ledger
   method notes for the API quirks). Section→VA: .text file+0x400c00,
   .rdata file+0x400e00, .data file+0x401a00.
2. **Calibration**: FUN_0048fd30 (VA 0x48fd47) = the verified SetRandomSeed
   mixer, matches our JS step-for-step. Source path leaked via asserts:
   `poro/source/utils/random/random.cpp` — asserts in the binary embed source
   paths → the whole source tree is recoverable (330 files scanned).
3. **Generators**: poro Random (Lehmer+diddle, Lua-visible — NOT the fill,
   proven by lab); a multiply-and-add family (×214013, +2531011, global state
   DAT_0132a388) used for gameplay dice/object scatter; mt19937 ruled out.
4. **Spawn registry chain**: RegisterSpawnFunction binding (FUN_00807d20) →
   AddScriptColor (FUN_007eb020) → std::map at GameLuaManager+0x8c (color →
   Lua function name) → spawn queue → processor FUN_0085d7b0 (camera-culled
   Lua execution). Consumer (the pixel-walk) not yet dumped.
5. **RTTI**: 1,958 class names (dev build); no wang/generator class — the fill
   is free functions. GameLuaManager vtable = 3 functions (queue processor found).
6. **g_worldseed located**: global DAT_01327ffc (world_seed.cpp); new-game
   generator = FUN_00911730/009118b0 (time/entropy — irrelevant to prediction).
7. **PRIME CANDIDATE (the next read)**: FUN_00905fb0 — 54 KB in
   procedural_terrain.cpp, reads g_worldseed 13×. Expected to contain the fill
   (or its parent) with generator + seeding derivation + consumption pattern.
   Secondary: FUN_00904c20 (25 KB), FUN_00901780 (46 KB), FUN_008ff150.

Reading queue + function inventory now tracked in **mapgen/ghidra-ledger.md** (the processing ledger — verdicts, queue, method notes; never re-dump without a reason). Queue: (1) FUN_00794620 in full — does it drive the wang fill?
(2) FUN_00633930's callers. (3) The GameLuaManager consumer: find via the
class's methods (RTTI vtable walk) — it reads placed-map pixels + dispatches
registered Lua functions per color. (4) From the consumer, walk UP to the
tile-placement loop and its LCG seeding derivation.

Open (not excluded, but unbounded): multi-input seeding derivations
(hash of (seed, area coords, color, …)) — the space is combinatorial; this is
precisely why reading the code beats guessing the parameters.



## 7octies. CREATEHERRINGBONEWANG LOCATED + READ (2026-09-07, Ghidra hunts 33–35)

**Target found** — the previous xref failure had two causes: (1) the noted
string VAs were substring starts (actual C-strings: 0x1172ff8/0x1173003/
0x117427c, +6/+11/+17 earlier); (2) the bare "CreateHerringboneWang" strings
are PROFILER scope names (`FUN_010324ea("CreateHerringboneWang")` at exit),
not assert text. Successful method: numpy scan of the whole exe for `u32 ==
string VA` — the binary is 32-bit x86 and MSVC references string literals
with absolute `push imm32` (no RIP-relative refs to these strings exist).
Verified push sites: "seed <= (double)(INT_MAX-2)" at VA 0x8ed44b (biome.cpp
line 148) and "height <= 1024" at 0x9050a6 (procedural_terrain.cpp line 1812).

**The fill is now READ end-to-end** (`mapgen/ghidra-ledger.md` 2026-09-07
section has the recipe, all constants checked from .rdata):
- `stbhw_generate_image` = FUN_008ec9f0: vertex grid `w/s+6 × h/s+6`, row
  stride 0x6a=106, rep-reduce pass, herringbone scan via choose-tile
  (FUN_008ec710, 2-pass count-then-pick one draw) + place h/v blits.
  **+4-row discard confirmed in-binary** (buffer is (h+4) rows, copy loop
  starts at −4, writes gated 0≤j<h).
- RNG = poro Random::Next() (FUN_010098c0 = verified Lehmer Schrage core
  16807/127773) on a **thread-local state** (TLS+0x14 double, lazily
  allocated via FUN_008ebf00). A "draw" = Next() then `(u64)state % cc[p]`.
- Seeding (FUN_00904c20, per area, ≤100 attempts with hasPath retry):
  `state_seed = (double)(u32 seed) + diddle[seed>>31]` (diddle = {0.0,
  4294967296.0} @0x11e0ba0 — a 32→unsigned-float promotion), halve if ≥
  2147483647 (@0x11e0220 / 0x5 @0x11dfdd8), one Next() warm-up, skip =
  `(width % 11)(signed trunc) + ((u32)seed % 12)` — **identical to noitool's
  GetRNG including the unsigned mod-12**. Per attempt: sub-seed =
  `NextU()` exactly (`Seed × 2⁻³¹ × 2147483645`, the two-MUL pattern
  @0x905697/0x90569f) → NewNollaPrng-style sub-RNG in TLS.
- **Per-cell generator object** (FUN_0090ce20 → FUN_008f9470, world-grid
  init): 0x1ec bytes; +0x8c raw seed, d = diddled+halved, Next()×2,
  **+0x94 = (float)d × 200000.0 − 100000.0** (constants at 0x11e0504/0x11e04ec
  verified this session).

**Verdict on prior sweeps — the class formula was wrong**: the binary's
vertex class is `p = (i+j) & 3`; §3ter (and all lab S1/P/S2 sweeps) used
`(i−j+1)&3`. With the wrong class the `%` draws hit the wrong modulus ~half
the time → ~58% noise floor on every walk — matching the 644M-candidate
verdict (58.03%) exactly. The lab's `(I−J)&3 ∈ {0,2}` binary-classes rule is
consistent (same parity classes as (I+J)&3). **Not yet tested on clean data
— lib/wang-js.mjs + the 548-vertex answer key can verify in minutes once
the last wiring link (which object's field feeds 00904c20's seed) is read.**

**Remaining (hunt 36, same session — RESOLVED)**: the fill's caller is a
vtable thunk (`mov ecx,[ecx+4]; jmp 0x904c20`, vtable 0x1199d40 slot 2,
installed by the world-grid init FUN_0090e840). The fill's per-area seed =
`[area+0x4c]`, fed by the **mSeed constructor FUN_00904730**
(procedural_terrain.cpp:1669):
`d = (double)ws + diddle[sign]` (unsigned promote, guard ≤2147483645) →
`Next()` → `mSeed = (float)d × 9999.0f + 1.0f` → `Next()` →
`×200000f−100000f` → `Next()` → `×200000f−100000f` — the per-area version of
the ProceduralTerrain::Init 9999/200000/100000 chain. Areas cache by
(w,h,seed) across chunks (FUN_0090c1f0), explaining once-per-area
generation.

## 7novies. THE FILL RECIPE IS BINARY-EXACT — AND THE SEED STILL DOESN'T MATCH (2026-09-07, hunts 37–45)

Everything below was verified against the **assembly** this session (dumps
`h35`–`h45` in ghidra-logs). Three ledger claims from the same day were
**corrections of corrections**:

1. **Vertex class = `(i − j + 1) & 3` in generation space** (§3ter was right).
   The 2026-09-07 "(i+j)&3 correction" misread FUN_008ec9f0's row counter,
   which starts at **1 and DECREMENTS** per row (`MOV EBX,1 … DEC EBX`,
   asm 0x8eca4b/0x8ecacd): class = `(col + (1 − row)) & 3`. After the
   +4-cell row discard (1 vertex row) this equals the lab's empirical
   `(I−J)&3` rule in key space. All reconciled.
2. **The draw is `nextU() % cc`** — not raw state. `poro Next()`
   (FUN_010098c0) advances the state AND **returns `state × 4.656612875e-10`
   in XMM0** (asm 0x109932: `MULSD XMM0,[0x11df988]`; the constant is the
   hand-typed 2⁻³¹ approximation, not exactly 2⁻³¹). Every consumer multiplies
   by 2147483645 (`.rdata` 0x11e0210) and trunc-converts to u64
   (FUN_01033781 = `__dtoui64`): vertex (0x8eca9e), reroll (0x8ec950),
   choose-tile (0x8ec855, two MULSD from the inline-Schrage state). The port's
   `nextU()` = `trunc(seed × 4.656612875e-10 × 2147483645)` — identical
   multiplies, identical rounding.
3. **The GetRNG skip is `(width % 11) + (u32)seed % 12`** — no extra width
   term. The decompile's `local_c8 + …` looked like `+width`, but the
   `((iVar20>>1) − (iVar20>>31))×11` term is **negative** `−11·⌊w/11⌋`
   (magic-multiply 0xd1745d17 with sign fixup), so `local_c8 + (−11·⌊w/11⌋) =
   w % 11`. Asm 0x905273–0x9052b1.

**The area object and the fill's `this`** (hunts 37–41):
- ProceduralTerrain::Init's biome-map walk (Step 1) allocates one
  **area object, 0x154 bytes**, per connected component: ctor `FUN_00904b10`
  (asm 0x904b10): `+0x00` biome ptr (walker), strings at `+0x04`/`+0x1c`
  (image-load name / wang template name), `+0x34` width, `+0x38` height,
  `+0x3c..0x4b` = the 16-byte coordinate block (the MOVDQU the fill driver
  copies), **`+0x4c` = the ctor's arg** (asm 0x904b71), `+0x50` a biome flag
  byte (0 → the wang path), `+0x8c` extra-layers, `+0x150` template filename;
  it then runs `FUN_008f9470(arg)` on the sub-object at `+0x90`
  (asm `LEA ECX,[ESI+0x90]`).
- **The ctor's arg = `WORLDSEED::GetSeed() + DAT_01328010`** (asm 0x9062cf–d4:
  `CALL GetSeed; ADD EAX,[0x1328010]; MOV [EBP-0x270],EAX`; the ctor call at
  0x9077d1 pushes it). `DAT_01328010` = the **NEW_GAME_PLUS_COUNT magic
  number** (default 13589, runtime-writable via magic-numbers config by
  FUN_006fa0d0/FUN_00922950). So **`[area+0x4c] = worldseed + 13589`**.
  (The ledger's hunt-36 claim "[0x4c] comes from the per-area seed
  constructor" was wrong — the mSeed ctor object is the ProceduralTerrain,
  a different struct.)
- The fill is dispatched at Init time as a **thread-pool task**: the
  "vtable 0x1199d40" is a **std::function functor vtable** on the stack
  (asm 0x907abf stores it into a local), capturing the area-object pointer;
  the thunk (`mov ecx,[ecx+4]; jmp 0x904c20`) passes the captured object as
  `this`. Not a chunk-load-time vtable.
- The mSeed ctor chain (FUN_00904730 / Init-inlined): the three `Next()` calls
  advance the **local chain** (codegen pattern asm-confirmed at 0x905264:
  `LEA ECX,[ESP+0x24]` before the call). With x86 `CVTTSD2SI` **saturation**
  (mSeed ≈ 7.9e11 ≫ i32 → n = INT_MIN every time), `stateA` and `stateB` are
  **seed-CONSTANT** (Schrage(INT_MIN) = 2147466840; Schrage(+huge) = 2147483647)
  — they cannot be the fill's seed, consistent with the lab's 91-vs-93
  coin-flip divergence. Only `mSeed` varies per seed.

**THE NEGATIVE RESULT.** With the recipe fully pinned, the lab answer key
(548/362/451 informative vertices, seeds 91/92/93) was scored against
~40 candidate seed values — raw ws, ws+C for C ∈ [13580..13600], Schrage^k(ws)
k ≤ 16, nextU(ws), verified-mixer outputs at area anchors, the V1/V2 ctor
chains and the generator `+0x94` field in 5 encodings each (f32bits, double
hi/lo dword, trunc-wrap, trunc-sat) — crossed with the 4 draw conventions,
attempts 0..99, offsets (dI ∈ −6..6, dJ ∈ −6..10), widths 248..266 and skip
deltas ±3 (~27k model walks per seed; `experiments/2026-09-07-area-seed-candidates.mjs`).
**Best ≈ 60–66% everywhere = the extreme-value noise ceiling. The fill's
runtime seed is NOT any statically-decoded derivation of the worldseed.**

Since the chain seed → GetRNG → sub-seed → TLS → vertex draws is asm-exact,
the divergence must be in the value that reaches `[area+0x4c]` (or the state
of the magic-number global at runtime). Next session's discriminator, in
order of cost:
1. **In-game probe**: hook FUN_00904c20 (or FUN_008eda10) in the dev build
   (Cheat Engine / detour DLL) and log `[area+0x4c]` + the first ~16 nextU
   values per attempt for a known seed. One number answers everything.
2. Verify DAT_01328010 at runtime (is NEW_GAME_PLUS_COUNT actually 13589 in
   a vanilla run? the magic-numbers file the mapcap/lab mods load may set it).
3. Lab variant with an asymmetric tileset (e.g. numColor (3,1,2,1)) so vertex
   colors pin draw indices more tightly, disambiguating geometry vs stream.

## 7decies. THE SUB-SEED IS MEASURED — AND THE CHAIN TO THE WORLDSEED STILL DOESN'T CLOSE (2026-09-08)

**The instrument (this session's move — cheaper than all three mission probe
targets):** instead of hooking the exe, invert the problem. The accepted fill
attempt is fully driven by ONE number — the sub-RNG state `S` that
`CreateHerringboneWang_Threaded` seeds the TLS Random with. So brute-force
`S` over its whole domain `[0, 2³¹)` against the 548-vertex lab key, with
early abort (a wrong S dies after ~50 informative checks ≈ 100 draws;
rep-reduce flips only ~11% of informative vertices, so a 25% abort threshold
is sound; the sweep's walk = coloring only, no rep-reduce). C port (gcc
-O3 -march=native, 16 threads): 2.147e9 candidates ≈ 58 s wall per offset.
**Exactly one survivor per seed:**

| seed | S (TLS sub-seed = trunc of the driver's param_9) | exact match (post-reduce) | pre-reduce flips |
| --- | --- | --- | --- |
| 78633191 | **1228813614** | 498/500 (99.6%) | 52/500 |
| 78633192 | **1319606147** | 325/327 (99.4%) | 42/327 |
| 78633193 | **1966969580** | 395/403 (98.0%) | 50/403 |

All three at key→gen offset **(dI,dJ) = (−5,−6)**. **The walk mechanics are
now measured-correct**: 1206/1218 informative vertices exact across three
independent seeds (chance ≈ 2^−1000) — class `(i−j+1)&3`, one `nextU()` per
vertex row-major, the rep-reduce pass, the `(H+4)/4+6` vertex grid (70×32),
warm-up absorbed. The 644M-candidate failure (§7septies verdict) and the
§7novies negative were both purely the SEED. Files (new, on disk):
`experiments/2026-09-08-subseed-sweep.mjs` (planted-solution integrity test —
PASS; flip-rate calibration), `-export.mjs` (key binaries → `/tmp/opencode/
subsweep/key_{91,92,93}.bin`), `2026-09-08-subseed-sweep.c` (sweeper; FNV
grid-hash cross-check vs JS bit-identical on 5 values; planted key → exactly
1 survivor in 2.147e9), `2026-09-08-subseed-invert.mjs` (S → C inversion),
`2026-09-08-placement-check.mjs` (tile-placement sim vs the game log).

**The 12 residual mismatches (OPEN, parked):** all at gen-border zones —
gen j=0..1 rows (any i) and the gen i=0..3 left-edge band at j=17..21 (key
J=23..27); key(5,23)→gen(0,17) is wrong in BOTH seed 91 and 93 ⇒ systematic,
not recovery noise. A pure Lehmer stream cannot diverge at one draw and
re-converge later (draws after the mismatch positions still match), and no
reroll touches those vertices (pre==post there). Every mechanism tested
(OOB reads by fully-off-image edge tiles, read-clamping, tile-index
swaps) keeps in-bounds pins = stream colors, so the suspect is the key's
border-zone values or a local game-side edge effect. Unresolved.

**Static probes of NEW_GAME_PLUS_COUNT (mission target 1, closed):**
- Absent from the game's own `data/magic_numbers.xml` (extracted data at
  `/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/`); the lab
  mod's magic file sets only `BIOME_MAP`; no installed mod touches it.
- Binary, byte-verified this session: `.data` default at file 0xf26610
  (VA 0x1328010) = 13589 ✓; name mapping independently confirmed (string
  "NEW_GAME_PLUS_COUNT" at VA 0x1199be4 is pushed 16 bytes before
  `push 0x1328010` at VA 0x6f9f9e; the parse-write `mov [0x1328010],eax`
  is at VA 0x6fa1f8 inside FUN_00922950).
- **FUN_009233d0 (the biome-map reset — resets `is_biome_map_initialized`,
  BIOME_MAP paths to `data/biome_impl/biome_map.png` etc.) sets
  `DAT_01328010 = 0`** (h46 dump). So the fill-time value is 0 unless the
  XML parser set it (nothing does). **§7novies' "[area+0x4c] = worldseed +
  13589" is DEAD — the fill's base seed C = ws + 0 = the raw worldseed**
  (and the printed "ProceduralTerrain - worldseed: N" = ws + NGPC).
- Full xref scan (u32 0x1328010 over the whole exe): WRITERS = the magic
  parse (FUN_00922950) + the zeroer (FUN_009233d0) ONLY. Readers:
  FUN_00719820, FUN_007ecb10, FUN_00832be0, FUN_00834170, FUN_00834840,
  FUN_00834f10 (an add-NGPC-to-seed family), FUN_00beeee0 (game-mode
  dispatch ×3), FUN_00905fb0 (the known ctor add).

**The chain, re-verified at assembly level this session (hunts 46–52; asm
read via objdump on the raw .text where noted):**

```
C = [area+0x4c] = WORLDSEED::GetSeed() + DAT_01328010   (0x9062d4–e0: call
     GetSeed; add eax,[0x1328010]; mov [EBP-0x270],eax; the ctor push at
     0x9077d1 reads the SAME slot; puVar20[0x13] has no other writer in the
     walk — only [0x0d]/[0x0e] (w/h) and [0x23] (sub-object seed) are set)
d = (double)(int32)C + diddle[C>>31]                    (0x90523c–49;
     diddle = {0.0, 2^32} @0x11e0ba0 — byte-verified)
if (d >= 2147483647.0) d *= 0.5                         (0x11e0220 / 0x11dfdd8)
state = d; Next(&state) — ONE warm-up                   (0x905264–6e; the
     local Random object at [ESP+0x24], ECX = &state)
skip = (width % 11) + ((u32)C % 12)                     (0x905273–b1; magics
     0xaaaaaaab → ×12·⌊C/12⌋ and 0xd1745d17 = −0x2e8ba2e9 → −11·⌊w/11⌋;
     width = [area+0x34] clamped to [1,1024] — asm 0x904cdc)
advance skip (inline Schrage, EXACT: v = 16807·(n mod 127773) − 2836·
     ⌊n/127773⌋, v ≤ 0 → += 2^31−1 — ≡ the JS schrageBin, edge-verified)
attempt A ≤ 99: state = Schrage(state)                  (0x905643–67a)
  param_9 = (double)state × 4.656612875e-10 × 2147483645
     (0x905681–a7: movd/cvtdq2pd state; MULSD [0x11df988] = C1 — the SAME
     double the JS port uses (bits 685f1c000000003e, ONE .rdata hit at file
     0xddeb88; 1/(2^31−1) has ZERO hits); MULSD [0x11e0210] = 2147483645.0)
  FUN_008eda10(w, h, state_int, template, atlas_w, atlas_h, ..., param_9):
    cached-seed check `param_9 != 0.0` (DAT_013276c8 is write-only)
    lazy TLS ctor FUN_008ebf00 (new 8-byte poro Random + one tail Next())
    TLS Random.seed = param_9 (UNTRUNCATED double; halved if ≥ 2^31−1 —
      never: param_9 < 2147483645)
    ONE warm-up Next(); buildTileset FUN_008ed0f0; FUN_008ec9f0(w·3, w, h+4)
    copy loop j=−4.. — the +4-row discard (FUN_008eda10 tail)
```

So `S_measured = trunc32(param_9)` and the orbit distance from C is
`1 + skip + (A+1) ≤ 116` Lehmer steps. Driver prologue also confirmed:
`[ESP+0x4c] = [area+0x4c]` (0x904d3b/0x904d4f), `[ESP+0x2c] = width`,
`[ESP+0x18] = height`.

**THE CONTRADICTION (now measured, not modeled).** 16807 is a PRIMITIVE ROOT
mod 2^31−1 (ord = 2147483646 — computed this session), so orbit distances
are well-defined and every nonzero value is reachable. BSGS discrete-log:

| start → target | seed 91 | seed 92 | seed 93 |
| --- | --- | --- | --- |
| ws → S (state mode) | 852 105 533 | 34 730 815 | 468 297 758 |
| ws → f⁻¹(S) (nextU mode) | 1 617 467 129 | 532 342 600 | 968 007 978 |
| ws+13589 → S | 1 659 374 935 | 1 830 001 187 | 1 112 350 975 |
| ws+13589 → f⁻¹(S) | 1 382 122 050 | 1 649 871 861 | 1 647 773 426 |

Required: ≤ 116. **Both C = ws and C = ws+13589 are excluded by
measurement.** Corroborating: the backward inversion over (mode ∈ {state,
nextU}, attempt 0..99, skip 3..14) yields 407/411/190 valid base seeds per
seed — ws, ws±1 and ws+13589 are NOT among them; no (mode, attempt, skip)
gives a constant delta across the three seeds (0 configs); the three S are
mutually unrelated orbit points (pairwise distances ≈ 7e8–1.6e9); no tested
structured start (ws, Schrage^k(ws), the mSeed-chain outputs in the
V1-chained / V2-chained / REAL-unchained FUN_00904730 forms — mSeed =
f32(f32(ws)·9999f+1f), stateA = stateB = f32(f32(ws)·200000f−100000f) —
and their f32-bit encodings) lies within 400 orbit steps of any S
(backward-walk scan; the 43 "small-diff" triples found ≈ the ~57 expected
by chance).

**Where the missing ~10⁷–10⁹ orbit distance lives (OPEN — next
discriminators):**
1. **Hook the driver (mission target 2, now armed with exact offsets):** log
   `[area+0x4c]` at its read (0x904d3b), the attempt's `state` (0x905643,
   XMM0 after cvttsd2si), and `param_9` complete at 0x9056a7 (XMM0). ONE
   number settles it: if the logged C' ≠ ws, re-run the inversion from C'.
   Cheat Engine or x64dbg on the Windows side; the lab mod + seed mod
   loadout, seed 78633191.
2. **[area+0x4c] may not be ws at driver time**: the ctor writes it during
   the Init walk but the fill task runs async on the thread pool — anything
   that rewrites the slot or DAT_01328010 in between changes C. A
   whole-binary scan for other writers of `[reg+0x4c]` (within area-object
   contexts) is the cheap static route.
3. The driver's own chain was verified local ([ESP+0x24] object, seeded from
   [ESP+0x4c] EVERY call) — so the missing distance cannot come from global
   poro accumulation inside the driver; if the hook shows C' = ws after
   all, the gap must be between Schrage(state) and param_9 for the LAB area
   specifically (a second driver caller, or FUN_008eda10 callers beyond the
   driver).
4. The mSeed ctor FUN_00904730's three Nexts advance the GLOBAL poro (the
   decompile shows the working double unchanged across them) — its three
   float outputs are pure functions of d = ws. If C' turns out to be one of
   those floats' bit patterns, re-run the inversion from it (the real
   unchained forms are now in the ledger).

**Placement-sim corollaries (parked, recorded for the port):** the game's
464-placement log aligns 464/464 to the simulated herringbone scan at
log = sim + (3,−1) in cell coords — the scan geometry, draw guards and
stream synchronization are right. Only 30/464 tile IDs matched there
because the wang-js port's scan reads array cells `[j+2..j+3][i+2..i+4]`
while the game reads a different constant offset — the lab tileset's picks
are FORCED (full 2³ slot coverage per orientation: h-tiles constrain slots
b,d,f; v-tiles a,c,e — no gaps, no duplicates), so tile choices differ only
where the read convention differs. Port-convention issue, not model issue.
The recovery's key indices vs the scan-read vertices differ by a constant
under frame algebra — the empirical sweep offset (−5,−6) is the bridge that
matters.

**Binary-analysis decoder (added 2026-09-05 — every acronym gets defined at
first use from now on):**

| Acronym | Meaning |
| --- | --- |
| MSVC | Microsoft Visual C++ — the compiler that built Noita; its standard library is baked into the binary |
| rand() / LCG | The classic C random function; LCG = Linear Congruential Generator, the multiply-and-add family it belongs to (`next = next*A + C mod M`) |
| MSVC-rand fingerprint | The fixed multiplier 214013 (0x343FD) that such generators carry in the code — searchable like a toolmaker's stamp |
| CRT | C RunTime — the standard library code statically linked into the exe |
| PRNG | Pseudo-Random Number Generator (any of the above) |
| VA / RVA | (Relative) Virtual Address — where code/data sits in the program's memory space once loaded |
| PE | Portable Executable — the Windows program file format |
| xref | Cross-reference — "which code points at this address/string" |
| RTTI | RunTime Type Information — C++ class-name metadata sometimes left in binaries |
| Headless (Ghidra) | Running the decompiler with no GUI, driven by scripts from the shell |

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

- **2026-09-08 (night) — GENMAP MVP + in-game results + purple-trail fix +
  finalize-lite.** User played against the generated map in-game
  (`genmap-server.mjs` + live telemetry marker):
  - Reference seed 78633191: "EXTREMELY CLOSE from reality, correct shape
    everywhere" — first in-game confirmation of the prediction pipeline.
  - Seed 78633194 (+3): structures differ slightly (positions, pools) — close
    but not 1:1; candidate causes: missing finalize steps (ClearPath,
    fillC0ffee, fillRandomMaterials), missing pixel scenes, and the
    small-variant-pool content class.
  - **Ghost-purple layers on all seeds — ROOT-CAUSED & FIXED**: the JPS
    search paints visited cells 0x7f007f; noitool runs the search on a
    SEPARATE path_map copy (`usemap = path`) — our port painted the trail on
    the returned terrain. Fixed (`lib/has-path.mjs`: search/coffee-floods/
    fillMainPath-band now operate on a Buffer copy; blockOutRooms/hax still
    mutate out_map like the C++). hasPath oracle re-validated 8/8 after the
    fix. Cache bumped to `gen-cache/r2`.
  - `finalizeLite` added to the genmap output (undoCoalMineHax +
    fillBlockedRooms(black)); ClearPath/fillC0ffee/fillRandomMaterials remain
    TODO (part of the observed +3-seed deltas).
  - **Anchor fit (offline)**: constant render-shift satisfying ALL direct
    spawn constraints, intersected across excavationsite 91/92/93 = x ∈
    [−1..3], y ∈ [0..2] atlas px — a RANGE (trigger regions are multi-px);
    center (1,1) candidate. A precise anchor needs the L3 foreground-mask fit
    (per-chunk, constant-vs-sawtooth discriminator per §4) — parked.
  - **Coverage report (per-row)**: wang = 15-45 chunks/row for rows 15..47
    (mining band rows 14-15: 12-29; Pits 41-42; Vaults 16-44; Crypt 23-45).
    Rows 6..14 wang 0-3 (sky/surface = template biome colors
    d6d8e3/cc9944/36d517/fe0000 with NO wang_template in our area list).
    The Work bands 40-47: 15-21 wang chunks + template dominance — matches
    the user's "one layer displayed" report; the fix = template rendering.
  - Renderer additions: zones endpoint already tags these per chunk;
    genmap player marker wired to the bridge (live seed + marker follow).

- **2026-09-08 (late night) — NOITOOL MARKED OBSOLETE + white-tile root cause
  (coloring-layer semantics from game data).**
  - **Noitool obsolete (user decision):** `vendor/noita-tools` is no longer a
    reference or comparison target anywhere — authority = our Ghidra asm
    verification + game oracles (VERIFIED.md header now carries the authority
    statement; live-lib comments updated; historical evidence-log entries and
    dated experiments intentionally left untouched). Corroborating reason
    found this session: noitool's `doCoalMineHax`/`undoCoalMineHax` compare
    against `0x004000`/`0x0040` while its own shipped overlay data is
    `0x006400`/`0x000064` → the hax is a silent no-op in noitool's code. Do
    not port noitool code unchecked; re-derive finalize steps from the binary.
  - **White-tile root cause (user report: "tiles rendered completely white,
    always the same kind — a vertical domino centered on a cave filled with a
    material", example = `mapcap/out/frozen91/chunks/chunk_0_1.png` top-right
    tank).** Mechanism verified from game data (coalmine.xml + materials.xml
    + wiki Modding:custom-environment §Wang Tiles + capture sampling):
    - The wang out_map's **grey ramp** (`r==g==b`, incl. pure white — 27.9%
      of the placed coalmine map + hundreds of grey shades ≈ 35% total) is a
      PLACEHOLDER family: "Shades of grey get filled with the materials
      defined in the biome's `<Materials>`" (coalmine.xml MaterialComponents:
      soil/sand_static/rock_static_wet noise bands 0.45–0.53 / 0.53–0.95 /
      0.9–3.5 + rare coal/copper/gold polka veins). Our genmap renders them
      raw → the white regions. Material wang_colors are `rgb` values with
      NEAR-greys used deliberately (coal `505052`, oil `3b3b3c`, steel
      `404041` — r==g but b+1/+2) so they don't collide with the placeholder
      greys; `rock_static_wet`=`103344`, `wood_static`=`413f24`,
      `wood_static_vertical`=`413f3a`, `rock_static_radioactive`=`00f344`,
      `gunpowder_explosive`=`f7bb43`, `gold`=`ebcd01`.
    - **The reported tile itself**: a coalmine v-tile (13×26 cells) whose art
      = white/grey cavern blob + teal pool. Its teal = `2f554c` = **water**'s
      wang_color (`materials.xml` `wang_color="902F554C"` — alpha `90`, easy
      to miss with an `ff`-strip). In-game: cavern grey → material fill,
      pool → water. Ours: raw white + teal → matches the user's description
      exactly. (Captured tank = water `39,67,63` + `rock_static_wet` frame.)
    - **Random-block placeholders**: `c0ffee` (0.56% of placed map) and the
      biome XML `<RandomMaterials><RandomColor input_color="FF00BBEE|
      FF12BBEE" output_colors="FF000000,FFFFFFFF"/>` entries → flooded to
      black|white at finalize (noitool's fillC0ffee/fillRandomMaterials model
      matches the XML semantics; re-derive from binary before trusting RNG
      details). noitool maps.json carries the same per-biome lists.
    - **Trigger colors** (consumed at generation, never visible in-game —
      §7sexies) render RAW in our viewer: `00ff33/00ff00` spawn_items, big
      green altar blob, `ff0000/78ffff` hearts, `ffff00`, plus the
      coalmine.lua `RegisterSpawnFunction` palette (`969678/967878/967896`
      structure loaders, `c35700` oiltank, `c88d1a`...). Must map → air (or
      scene) at render.
    - **blockOutRooms colors** (`c35700, ff0080, ff0aff, ...` 9 colors) →
      room right/below → white → fillBlockedRooms(black) in finalize.
    - **Status tag: ELUCIDATED (render semantics); the grey→material noise
      mapping itself (exact band/vein math incl. grey-value semantics) is
      OPEN** — first capture-based attempt (shift-scan alignment of raw A1 vs
      frozen91 chunk_0_1) gave only ~43% skeleton agreement with the best
      shift at the scan edge (±32 px) — alignment instrument needs a wider
      scan before the grey-value table can be read off the capture.
  - **STALE CACHE FOUND:** `mapgen/out/gen-cache/r2/*` holds the RAW fill
    (pre-hasPath: 52.7% black / 27.9% white, no blocked-room whites, no
    finalizeLite) — written by an older `generateAreaExact` revision. The
    genmap viewer therefore serves neither the current pipeline nor the
    finalize. Cache must be bumped (r3) after the coloring work lands.

- **2026-09-09 — COLORING LAYER SHIPPED (genmap r3b).** `mapgen/lib/colorize.mjs`
  wired into `world-gen.mjs` (cached gen-cache/r3b): random-block floods
  (c0ffee + biome-XML RandomColors → per-region 50/50 air|white), trigger
  colors → air, engine moss marker `00ff33` → moss green, material
  wang_colors → capture-calibrated shades, grey ramp → air(g≤100) /
  soil(100<g<250) / world-seeded fBm fill (white: rock 33% / soil 53% /
  sand 14%, scales 14px+8px). Unknown-px rate 0.24% (coalmine). Side-by-side
  chunk (0,1) = same structures (moss pool, water tank, platforms); visual
  gap remaining = torch lighting + vegetation + pixel scenes + spawn-band
  extra layers (row 0 raw-fill alignment only 64.1% vs row 1's 78.4%; the
  hax-overlay-forced variant scored WORSE (61.7%) → not applied at render;
  overlay semantics need the binary).

- **2026-09-18 (3) — NOITOOL'S +5/+13 DRAW-MAGIC: ELIMINATED AS AN IN-BINARY
  MECHANISM (F-anchor progress).** Byte-pattern hunt for the `(gx+5)/512`,
  `(gy+13)/512` forms (instruction pairs `add reg,imm{5,13}` + `shr reg,9`)
  = **0 hits** across the whole .text slab (also none as separate dwords).
  The +5/+13 offsets were part of **noitool's own `drawImageData`
  reconstruction** (wang.cpp ~:858), never ours to confirm. The game's real
  mapping (cell↔world) must come from the fill's copy-out walk /
  FUN_008e6d50 consumer — F-anchor stays open with that as its read target;
  the current genmap's empirically-fitted (3,3) px anchor remains the only
  bracketed value (x ∈ [−1..3], y ∈ [0..2] from the spawn equations).

- **2026-09-19 (2) — F-anchor dig #2 CORRECTION + re-anchoring of the VA
  map (same session, before any further reads).** While re-reading the dig's
  artifacts I re-derived the slab mapping empirically instead of trusting the
  adjust-vma formula: the in-binary pin of the hasPath coalmine start mark
  (`cmp eax, 0xFF420000`) is at **slab VA 0x50124d**, which the ledger (from
  Ghidra) records at true **0x901a4d** ⇒ **true VA = slab VA + 0x400800**
  (slab convention: file[0x400c00:0xdd0000] placed at adjust-vma 0x401000 ⇒
  slab VA = file_off + 0x400; true VA = file_off + 0x400c00 — the Sep-18 (2)
  note's "+0x400800 correction" applies to ALL Ghidra-derived names, not just
  stage 9). Consequences for dig #2's entries above:
  - The "FUN_008e6d50 / FUN_008e6cf0 functor wrapper" read was executed at
    SLAB 0x8e6cf0 = true 0xce74f0 — i.e. the wrapper/its callers/its
    singleton 0x132a32c WRITE-UP IS MISLABELED; the structural findings
    (functor post-wrapper + 7 callers) belong to true 0xce74f0, whose
    identity is UNKNOWN (not the ledger's cached-draw consumer).
  - Likewise dig (b)/(c): I read slab 0x939b80 / slab 0x8ed860 = true
    0xd3a380 / 0xcee060 — NOT FUN_00939b80 / FUN_008ed860. The
    "record-queue ×10 idiom" elimination therefore applies to three
    UNNAMED true-VA functions (0xd0b902-family inside true-FUN_0090b8a0 ✓
    correct; 0xd3a403; 0xced8cf) whose queue semantics were read correctly
    but names were wrong. The elimination's CONCLUSION may still hold, but
    it must be re-verified on the true functions before being canon.
  - The read targets must be re-run at slab = true − 0x400800:
    FUN_00939b80→0x539380, FUN_008ed860→0x4ed060, FUN_008ec9f0→0x4ec1f0,
    FUN_00904c20→0x504c20, SetSize call sites→0x50738f/0x507852.
  - **Method note (new):** when mixing Ghidra names with objdump output,
    ALWAYS convert: objdump slab VA + 0x400800 = Ghidra VA. Verify each
    named target by byte-pinning a previously-verified constant in the
    function before trusting a read.

- **2026-09-19 (3) — F-anchor dig #3: FIRST TRUE-VA READS, anchor rule of the
  Init grid walk READ (objdump slab, true = slab + 0x400800, verified
  by byte-pinning hasPath's `cmp eax, ~0xFF420000` @slab 0x50124d = true
  0x901a4d and SetSize @slab 0x4f8dc0 = true 0x8f95c0).**
  1. **FUN_00939b80 (chunk cache-builder) = ELIMINATED as the anchor.**
     Read at slab 0x539380; its assert strings (0x1179e90 = the
     "chunk_top_left" family; 0x116ea50 / 0x1179f1c the offset asserts)
     byte-pin it. Semantics: takes world (x, y), yields
     `chunk = (x>>9, y>>9)` (sar 9 ×2), `quarterCell = (y&0xff)<<8 |
     (x&0xff)` (the ±0x100 chunk-half quadrant-prep of F1's stage-9 read),
     bounds-asserts, then a flat cache lookup `tbl[quarterCell]`. **NO
     ÷10, NO (3,3), NO per-area origin**: this instrument LATTICE-INDEXES
     the 512-frame directly. The wang-cell ↄ-world anchoring does NOT
     happen here.
  2. **hasPath-body constants verified live this session** (slab 0x501780
     = true 0x901780): the blockOutColors cmp cascade
     (`0xfffefefe`, `0xffffffff`, `0xfffffffe`…), the coalmine start mark
     `cmpl $0xff004200` @slab 0x501aef (= true 0x901aef; ledger's
     0x901a4d family), `imul`-indexed RGBA rows, the ÷8 (sar 3) room-growth
     helpers @slab 0x501b66.. — the port's read environments match.
  3. **THE INIT GRID-SIZE WALK — the (3,3)-question narrows to our own
     truncation semantics. ProceduralTerrain::Init (true 0x9073xx-family,
     read at slab 0x506600..0x5072a0):**
     - Pre-walk: unique-double normalizer (cmp `0x11e0220` bounds, mul
       `0x11dfdd8`) + the **Random(min,max) closed form IN-BINARY**:
       magic ÷100000 `0x834e0b5f` then the 127773/2836/16719
       (0x1f31d/0xb14/0x41a7) decomposition — VERIFIED twice
       (slab 0x506a22 / 0x506aa1, = true 0x907222 / 0x9072a1); this is
       the mSeed/RegistrantRandom closed form, F2-relevant, byte-pinned.
     - Area-ctor walk (esi = the biome area; [esi+0x50] = **WIDTH in
       chunks** (outer row index used as `imul width` in the per-chunk
       lookup at slab 0x506c35), [esi+0x54] = HEIGHT, chunk loop bounds
       at slab 0x506c1a/0x506c2b):
       - `new(nested 0xb8 bytes)` + ctor slab 0x4f8c70 (= true 0x8f8c70?
         UNRESOLVED name; contains a THREE-slot grid layout at +0x00,
         +0x20, +0x40/+0x60, a seed slot +0x8c and an RNG-normalized
         float +0x94 — the VERIFIED +0x94 generator chain, with the
         SAME closed form constants (0x11e0504/0x11e04ec)) → **this is
         the mSeed/×200000−100000 construction, IN-BINARY, in the same
         walk** (re-confirms stage-3/4 shapes).
       - **`SetSize(grid, w, h)` at slab 0x506b8f (= true 0x90738f** —
         the first F1 SetSize call site ✓✓) with
         **`w = ([esi+0x50] << 9) ÷ 10`** and **`h = ([esi+0x54] << 9) ÷ 10`**
         (signed ÷10 via magic 0x66666667 + sar-2 sign-correcting; the
         second ÷10 in effect). **NO offset constant anywhere in the
         sizing expression.** The float grid = `w·h·4` B realloc
         (verified by reading true 0x8f95c0 = slab 0x4f8dc0: it stores w/h,
         allocates 4·w·h bytes ⇒ **the +0x18 grid is FLOAT32, w·h
         elements, cell = 10 world px**). The second SetSize call site
         (true 0x907852 = slab 0x507052) sits right after — the u16 twin
         (not yet read in detail this session).
     - **IMPLICATION for F-anchor (pending final confirmation):** the
       game's AREA GRID is sized from the chunk-rect WIDTH/HEIGHT ONLY
       (`chunkExtent*512÷10`), with NO additive constant. Our port's
       column semantics: `widthCells = trunc(b·512/10) − trunc(a·512/10)`
       (= per-endpoint truncation). For biome areas whose chunk extents
       are already ÷5-aligned both are equal; for odd extents they can
       differ by a cell. **No in-binary (3,+3/13) additive constant has
       been found in any area-grid-geometry read so far.** The (3,3) is
       therefore INCREASINGLY LOCAL TO OUR PORT's out_map serial artifact
       (e.g. arising from `MapGen`'s +3 start-cell scanfactor), NOT a
       game-side wang→world offset. Next read closes it: the VALUES write
       into the SetSize'd grids + FUN_00939b80's neighbors (is the wang
       out_map ever re-read? or is the u16 grid filled by the noise
       generator objects, not by the fill?).

- **2026-09-19 — F-anchor dig #2 (objdump, fresh correct slab; genesis: user
  go-ahead). Objectives partially met, one ledger correction + one
  elimination. ⚠ NB: some function-name labels in THIS entry were later
  proven wrong — read entry (2) (same date, lower) FIRST; (3) is the
  on-target re-run:**
  - **LEDGER CORRECTION: FUN_008e6d50 is NOT a function entry.** Fresh
    `text.bin` (method note: `f[0x400c00:0xdd0000]` + adjust-vma 0x401000,
    asserted live this session) shows 0x8e6d50 sits INSIDE **FUN_008e6cf0**
    (new prologue at 0x8e6cf0, SEH setup, ends ret 0x4 @0x8e6da2).
    FUN_008e6cf0 = a tiny functor POST-wrapper: allocates 0x38 bytes,
    constructs a std::function from imm vt 0x1198840 via 0x1c6b0, stores it
    to global 0x132a32c, deletes the previous global consumer;
    **7 direct callers, all in the 0x8e7xxx chunk-draw cluster
    (0x8e73b6, 0x8e7665, 0x8e76d8, 0x8e77da, 0x8e794d, 0x8e7a95) +
    0x411e72 (global flush path, singleton reset 0x132a32c ← caller of
    0x4a0d80−family).** So the "map-class draw consumer" is a per-frame
    posted-task FUNNEL, not where the cell anchor arithmetic lives.
  - **ELIMINATION: the /10 (0x66666667) magic clusters are NOT the wang
    anchor.** exhaustive .text scan for the divide-by-10 magic (296 hits)
    at exactly 3 pattern-identical sites — the SAME generic record-queue
    consumption: (a)
    **ProceduralTerrain::Update's frame scan** (FUN_0090b8a0 family,
    slab 0x50b1xx: [edi+0x18]/[edi+0x1c] record-list start/end →
    pop records via movdqu (20-byte strides, ×5 lea), count/10 via
    66666667+magic-sar-3); (b) **the quadrant-cache builder FUN_00939b80** same
    shape ([edi+0x630]/[edi+0x634]); (c) **the fallback fill
    FUN_008ed860** same shape ([esi+0x154]/[esi+0x158] + record queue +
    state 3 re-arm @0x8ed945 + caller-check via vtable call). Verdict:
    pixel-scene/rect **pending-queue step accounting, NOT cell anchoring**;
    do not re-read these /10 sites for the anchor.
  - **Confirm again: no pairwise `add imm 5/13 + shr 9`** anywhere (consistent
    with 2026-09-18 (3): noitool's +5/+13 drawImageData is not in-binary).
  - **STATUS: F-anchor STAYS OPEN.** Remaining candidate read targets
    (next session): (1) stbhw-block interior 0x8ec999's context
    (MapHandlerToBig family — the one true ×10 in the fill
    subsystem — plus its consumer of row indices for the (3,3) candidate);
    (2) the 0x8e7xxx chunk-draw cluster's actual painter functions (find
    who CONSUMES 0x132a32c task per frame and what transform it applies);
    (3) the Init-side write of the accepted out_map into area +0x18/+0x38
    grids (SetSize call-site context 0x90738f/0x907852 was read for
    GRIDS-ALLOCATION only — the terrain VALUES write walk was never
    traced; the anchor may simply be `area origin` with the (3,3)
    being a property of our fill/geometry, not the game's).
