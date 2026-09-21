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

- **2026-09-19 (4) — F-anchor dig #4: FUN_008f9ab0 read (objdump slab
  0x4f9ab0, true = slab + 0x400800; target from the F1 note "the noise
  write side is the Init's float/u16 area fills, FUN_008f9ab0 family").
  Byte-pin via the shared assert idiom (0x1151084 + `add $0x76c` guard
  loads, C12's pattern). Partially read (head + main sweep + realloc
  tail classified; full decode pending):**
  - **Grid-write mechanism VERIFIED (Init-side, non-wang):** a per-cell
    sweep over an object (ebx) owning THREE grids — float grid at
    **+0x18**, u16 grid family at **+0x38** (element write `u16 = 1`
    via helper 0x54a0f0), and a marker/byte band at **+0x40/+0x58**
    (4-neighbourhood reads via helper 0x5fdce0 = (x±1, y±1), vote
    aggregator 0x5fdd70 = match-count; write fires when vote == 1):
    qualifying cells get **float −1.0 (0xBF800000 literal) into +0x18**
    and **u16 1 into +0x38**; multi-band index forms across the sweep:
    `[ebx+0x20]·y+x`, `[ebx+0x40]·y+x` (accessed 0x4f9b90..0x4f9dd3 via
    0x5493b0/0x54a1d0/0x5491f0 getters).
    - **NO RNG calls in the sweep, NO ÷10, NO anchor offset constants**
      — pure `y·W + x` object-local cell indexing.
  - Tail: realloc of `[ebx+0x1c]` records + memcpy (0xc12400, dst
    `[ebx+0x18]`) + std::string ctor family (0xc31cea) — an
    append/serialize step (pending full read).
  - **INTERPRET-CAREFUL:** identity NOT established — candidates are the
    `<BitmapCaves>`/`<structures>` seeding walk (cave-structure
    companion), NOT yet the wang out_map copier. The caller feeding
    (ebx) is the next read.
  - **What IS established:** the area sub-object +0x18/+0x38 grids
    ALSO receive non-wang, seedless per-cell marker sweeps with
    cell-unit indexing and no anchor arithmetic — consistent with C11
    ("no additive anchor"). Two grid-write families now known:
    (a) this sweep, (b) the finalize family's u16-delta writes
    (FUN_00949e80-family, ledger F2 dig #4). **The wang out_map→grid
    copier is still UNLOCATED.**
- **2026-09-19 (5) — F-anchor dig #5 addendum: FUN_008e6d50 FINALLY READ AT
  ITS TRUE VA (slab 0x4e6550; earlier dig #2 ran the mislabeled wrapper at
  slab 0x8e6cf0 and the #2-entry's identification was name garbage), plus C14
  label correction:**
  - **C14 CORRECTION (registry hygiene):** the stbhw / fill ÷10 hits
    recorded as "true 0x8ec1b8/0x8ec1e8/0x8ec999" are actually SLAB
    addresses (the scan output was slab-space): TRUE = **0xcec9b8 /
    0xcec9e8 / 0xcec999** — identity unknown. C14's "inside the
    stbhw fill subsystem" claim is UNVERIFIED; the true stbhw block
    (FUN_008ec9f0 = slab 0x4ec1f0) contains NO ÷10 magic (verified by
    grep of 0x4ec1a0..0x4ec900 today — imul rows only, scale-by-multiply
    absent; the ×10 upscale is not a div-form either: only TWO `imul
    $0xa`/`imul 10.0f` byte-forms exist in the whole slab (0xdbb8a3 /
    0xdbbe06, unnamed), and the 10.0f constant appears 32×, none inside
    the fill). **Implication: the ×10 bijection is done with multiplies
    or address arithmetic — likely inside stbhw's generate step;
    MapHandlerToBig may be a noitool-side reconstruction shape, not the
    game's.**
  - **true 0x8e6d50 semantics read (partial):** an in-memory per-record
    walker on ONE flat buffer with the layout: base + 0x80000-backed
    source planes (byte offsets **+0x80001** and **+0x80002**, both
    modified in place: `sub [ecx+0x80002], al`), record stride **29
    bytes** (imul $0x1d anchor cursor, 0x4e660f), per-record
    luminance-decay via `divss 0x11e0378` + `sqrtf` via 0xc3322e +
    re-multiply, and a WRITE of a composed 0xAARRGGBB pixel into
    `[edi+0x3c]`-based table (`shl/or` triple at 0x4e66a1..0x4e66c5);
    `[edi+0x34] = 3` state mark after a record; `cmp 0x12(%esp)`
    end-guard; audio-printf-family calls (0xc3322e/0xc33234 CRT consts
    at 0x11dfe80 double "10-ish" constant).
    Spin-lock-mediated flag processing: the `+0x12 byte` guard flips
    after each record, chunk-composite vtable call through
    [edi+0x38]/[edi+0x3c] finds the pixel write target.
    **Candidate identity (NOT canon): a per-cell-burn aesthetics/
    lighting/darkness painter over one opaque 512×512 2-byte-plane
    source (offsets +0x0/+0x80000); the byte `sub` = light erosion
    accumulates per record. NOT the wang→grid copier; NO anchor
    arithmetic anywhere in it.**
  - **F-anchor VERDICT (funnel state after 5 digs):** the
    wang-cell↔world grid anchor does NOT live in (a) the cache builder
    (F-un read), (b) the 3 ÷10 queue sites, (c) the marker sweep
    FUN_008f9ab0, or (d) true 0x8e6d50's painter — and the Init-area
    grid sizing has NO additive constant (C9–C11). The remaining
    structural leads are ALL inside the fill acceptance path: the exact
    driver tail + a per-cell RS loop that receives stbhw's accepted
    out_map and reaches the u16/float grids. Our own wasm happens to
    have this exact "Apply + fallback" semantic implemented inside
    noitool's MapHandlerGenerateMap — the fill's true copy-out may
    therefore be defined by the driver tail (Jun sweep: (3,3) must
    become a port-side measurement if the copy is a raw memcpy of an
    already-X10-scaled stbhw image, i.e. the anchor question collapses
    into a PORT-DETAIL question). Keep C11 as the leaning-canon row;
    close F-anchor after the Threaded 0x8eda10-tail read.

- **2026-09-19 (6) — F-anchor dig #6: the COPY-OUT FOUND — funnel CLOSED
  (identification) + semantics read.** Driver = true 0x904c20 = **slab
  0x504420** (clean prologue; the ONLY direct caller = thunk slab
  0x6996a3 `mov 0x4(%ecx),%ecx; jmp driver` — thread-pool functor's
  payload pointer IS the driver `this`). Head job-record prep
  (slab 0x5044a0..0x50453f): fields [esi+0x34]/[esi+0x38] = source W/H
  clamped to 1..0x400 (1024) — job dims are CAPPED, not area-anchored;
  0x3c..0x4c register copies of scaled sizes; [esi+0x4c]/[esi+0x80]
  pointers into a copy context.
  - **THE COPY-OUT SWEEP (slab 0x505610..0x5056a4):**
    `for y..H: for x..W:` cell x wrapped **modulo W** and y **mod H**
    (`idiv` at slab 0x505637 / 0x505652 — wrap, NOT offset arithmetic),
    dst idx = `y·W + x` (imul 0x505656), per-cell **4-byte copy**
    (`mov (%esi),%ecx; mov %ecx,(%eax)`) with source cursor `%esi += 4`
    (0x5056d0), dst via getter **0x549680** (double call = src read +
    dst write), then the SECOND grid realloc'd (0x5056a4.., same
    SetSize pattern as C10 — w/h stored, items = w·h). **Wrap-modulo
    flat copy of a pre-scaled source blob — ZERO anchor arithmetic, no
    (3,3), no additive constant anywhere in the copy path.**
  - Driver additionally calls: **FUN_008f9ab0 twice** (slab 0x5055d7,
    0x50571e — the flag=(1/bool?) cave-structure sweep, byte-pinned in
    context), the stage-8 spawn walker (slab 0x5054fc → **true
    0x900c70** — VERIFIED stage-8 table byte-pinned live ✓), and the
    **0x52c820 copy helper** (also used in the Init area walk at slab
    0x506bbd) — a shared Init/fill-apply primitive whose identity is a
    followup row.
  - **F-ANCHOR — CLOSED (negatively resolved, byte-pinned):** the game
    contains NO additive wang-cell↔world anchor constant in any of the
    now-read write paths (Init sizing C9–C11, copy-out with wrap, marker
    sweep, painter, cache builder). Our genmap's fitted (3,3) is a
    PORT-LOCAL artifact — the driver copies the accepted out_map
    straight into the area grids with modulo repetition; the anchor
    question has no binary side remaining. (Canon-level followup in
    VERIFIED when the port's own out_map layout is verified against this
    copy shape.)
  - Registered helpers: dst getter 0x549680 (slab; float cell getter),
    apply-pair 0x52c820 (shared primitive), driver = slab 0x504420;[
    to follow: read the second set 0x5057xx for the u16 copy loop +
    confirm the harder "stbhw atlas blob is already at cell scale"
    postulate (the driver's [esi+0x3c]-family scaling shapes are the
    ✓ anchor in that version).]
- **2026-09-19 (7) — F2 dig #1: blockOutRooms ray-walk semantics FULLY read
  and ported (objdump, fresh slab regenerated this session; VA map per
  2026-09-19 (2)).** Read targets: FUN_009013f0 = **slab 0x500bf0** (true
  0x9013f0), FUN_00901510 = **slab 0x500d10** (true 0x901510), the 11-color
  marker walker FUN_00901580 = **slab 0x500d80** (true 0x901580), plus the
  finalize black blit family function at **slab 0x500c50** (true 0x901450).
  Re-entry byte-pin (C13): `cmp eax,0xFF420000` @ **slab 0x50124d** ✓ (same
  byte seen again this session, inside the dump's hasPath block).
  - **FUN_00901510 (ray walker; ECX = 4-byte out_map object {w,h,...,pixels
    @+0x18}; stack args (startX, startY, ddx, ddy); returns EAX):**
    bounded walk — at each step, if x<0 ∨ y<0 ∨ x≥w ∨ y≥h → stop;
    fetch cell via getter 0x549680; **`testl $0xffffff,(%eax)`** → stop on ANY
    non-black 24-bit cell (alpha-agnostic); else count++ (EBX), step += (ddx,
    ddy), while step-count (EDI) < **0x2710** (10000; `cmp $0x2710,%edi` @
    slab 0x500d64 — matches ledger dig #5). Return = black run length N; the
    terminating non-black cell and ANY grey cell stop the ray and are NOT
    counted. **Slab 0x500d10–0x500d74 all read.**
  - **FUN_009013f0 (record fill; ECX = out_map, EDX = rect ptr(stack 0x8 = the
    fill COLOR)):** strict-`<` loops, x from rect[0] while < rect[8], y from
    rect[4] while < rect[0xc] → **the 16-byte record is
    {startX, startY, endX, endY} with EXCLUSIVE ends**; per-cell bounds check
    (negative + w/h guards at slab 0x500c10–0x500c21) then 4-byte color
    write via getter 0x549680.
  - **The marker walker body (slab 0x500d80 = true 0x901580), dispatch on a
    marker hit — EXACT code path (slab 0x500e15..0x500e56):**
    1. EDI = x+1, ESI = y+1 (marker pixel +1 in both axes);
    2. `FUN_00901510(map, x+1, y+1, dx=1, dy=0)` → rightLen (stored
       rect[2] = x+1+rightLen at slab 0x500e3d);
    3. `FUN_00901510(map, x+1, y+1, dx=0, dy=1)` → downLen;
    4. rect[3] = y+1+downLen (slab 0x500e4f/0x500e53);
    5. `push $0xffffffff` (slab 0x500e51) → the fill color is the LITERAL
       WHITE (not a parameter at this site), call FUN_009013f0;
    6. push the record into the EDX/ECX-owned vector (movdqu 16-byte copy at
       slab 0x500ec7/0x500f33; reserve/expand call 0x57ed10; stride +0x10
       at slab 0x500f46) — **degenerate zero-area rects ARE recorded** (no
       non-empty filter anywhere).
    NO black/white pre-skip, NO ShadeOfGrey, NO width/height clamping on the
    rect ends (the guards inside FUN_009013f0 handle edges). The "black/white
    skip + scanner-found grey run-on" of our previous port was port-local
    approximation, not binary.
  - **The finalize black blit (slab 0x500c50 = true 0x901450):** iterates a
    16-byte-record vector (stride `sar 4` + `add $0x10`), for each record the
    same strict-`<` exclusive-end cell fill with per-cell bounds guards,
    writing the literal `0xFF000000` (slab 0x500ccc) — i.e. blockList
    consumers use the SAME rect convention. **Our finalizeLite's
    inclusive-end fill must and did switch to this exclusive convention
    together with the record value change.**
  - **PORTED same session into `mapgen/lib/has-path.mjs`**
    (`rayWalk` + `blitRect` + rewritten `blockOutRooms`; ShadeOfGrey deleted).
    Validation: hasPath oracle **4/4** re-run (excav 91→0, 92→3, 93→1;
    coalmine 91→1 — first accepted unchanged); `npm test` **143/143** green
    (13 files; +1 new pin for the grey-run-off elimination). A/B on the four
    oracle fixtures: whites dropped 14727→13203 (91), 14332→12437 (92),
    14872→13152 (93), 9227→7350 (coalmine) = **~10-13% fewer whites** — the
    old heuristic extended rooms through ≤0x32 grey runs; in-binary they stop
    at the first non-black cell. **Observable output CHANGED → genmap cache
    revision bumped r3d → r3e (server/genmap-server.mjs, 2026-09-19).**
  - Constants used: C13 (VA map), C1 (proof anchor), and the C3 11-color
    table (re-confirmed as the walker's compare dwords at slab
    0x500dc4–0x500e0a, exact dword forms incl. alpha FF — no new rows needed
    beyond these; the 0x2710 limit and 0xffffff test are recorded here only,
    in-table candidate if a later session needs them).
- **2026-09-19 (8) — F2 dig #2: the biome special-case SELECTION is
  template-path equality (isCoalMine/shouldBlockOutRooms determined;
  exhaustive biome census).** Fresh slab; proof anchor C13 re-pinned
  (cmp eax,0xFF420000 @ slab 0x50124d) before every named-target read.
  - Refs of the THREE wang-template path literals in .rdata ("coalmine.png"
    @0x1173ec0, "excavationsite.png" @0x11742a0, "extra_layers/coalmine.png"
    @0x1174c58; only these three exist in the entire binary) → four code
    sites, all read this session:
    1. **Driver blockOutRooms guard (slab 0x504f2d..0x50504b):** an inline
       std::string compare with len 0x1c against "data/wang_tiles/
       coalmine.png" then a SECOND inline compare len 0x22 against
       "data/wang_tiles/excavationsite.png"; either match falls into the
       **same call site of FUN_00901580 (slab 0x50505e)** — the two matches
       UNION to trigger the room-marker walker (matches the port's
       shouldBlockOutRooms as coalmine∪excavationsite — NOT a name lookup!).
    2. **hasPath mark arm (slab 0x5011a4..0x5011b2):** 0x43ff0(str,"data/
       wang_tiles/coalmine.png") → the 0xFF420000/0xFF000000 mark walk.
    3. **hasPath stairs arm (slab 0x5017ab..0x50187f):** same compare inline;
       scans cells **x = 0x8c..0x9d (140..157), y = 0..14**, black-filling
       any cell == **0xfffefefe** (the overlay's white stairs color,
       `cmpl $0xfffefefe` @ slab 0x501844). THE in-binary meaning of
       noitool's "start_x = 142": it is a BAND SEARCH for stairs cells
       (141 wide, 15 tall), whose first hit defines the path start —
       not a constant x.
    4. **Init overlay loader (slab 0x507061..0x50707b):** per biome object
       ([biome+0x1f8] byte → [obj+0x50]; template==coalmine.png) →
       loads "data/wang_tiles/extra_layers/coalmine.png" into **[obj+0x8c]**
       — the vendered coalmine_hax.cpp overlay's in-binary home; byte
       row 0.
  - **EXHAUSTIVE CENSUS (data-side, binary rule applied):** 174 biome XMLs
    in `_biomes_all.xml`; **42 carry wang_template_file** (registering 33
    tile atlases; a tower file family reuses the 7 standard atlases;
    the_end.png serves the_end/boss_victoryroom/magic_gate; 5 special
    static-tile fg). NO OTHER biome can ever hit the coalmine/excavationsite
    regimes: the selection compares TEMPLATE PATHS, and only those 3 path
    literals exist in-binary. Affected biomes = the union across
    `_biomes_all.xml`: coalmine (ffd57917) + tower_1 (ff3d3e37) +
    _EMPTY_ (ffFF8080) → coalmine.png; excavationsite (ff124445) +
    tower_2 (ff3d3e38) → excavationsite.png.
  - **PORT-FIXED same session** (`lib/biomes.mjs`): the @prov noitool
    NAME-LIST flags replaced with the binary rule (`templateFile ===
    "data/wang_tiles/coalmine.png"` → isCoalMine; ∨ excavationsite.png →
    shouldBlockOutRooms). Same 4 biomes resolve for the rendered set, PLUS
    the name-lists' blind spots: tower sub-biomes (the name namespace says
    "tower" for ALL solid_wall_tower_* — name lists could never be
    exhaustive by construction) and _EMPTY_. Validated: `npm test` **143/143**
    green; hasPath oracle fixture regions (excav/coalmine) are exactly the
    same in both rule variants — no behavior change for the current tests;
    the flags now follow the binary so modbiome names can never desync.
  - Registrations: C19 (trigger compares), C20 (hasPath coalmine arms incl.
    the stairs band + overlay loader), C21 (the census + the two
    name-list corrections).
- **2026-09-19 (9) — REFERENCE-FRAME AUDIT (user question): is coalmine still
  a reference set? Also "no wang template ⇒ predictable spawn" tested.**
  - **Historical check (disk this session):** noitool's own validation bench
    mapped 23—24 biome fixtures (theirs `verify-vs-noitool.mjs` PARAM_MAP,
    all seeds = CAPTURE_SEED 78633191), coalmine their flagship; our early
    template walk diff used coalmine + winter_caves params; the hax overlay
    data container = the vendored coalmine_hax.cpp; the hasPath oracle
    carries a coalmine-91 corroborator (first accepted A=1). So YES —
    coalmine entered the project as THE reference biome inherited from
    noitool's work.
  - **Why it is no longer fit as a general reference:** (1) coalmine is the
    MOST special-cased wang biome in-binary — the mark walk (C1/C2), the
    stairs band (C20 arm 2), the overlay loader ([obj+0x8c]) and the
    blockOutRooms union trigger (C19) all exist ONLY for biomes whose
    template == coalmine.png/excavationsite.png (2026-09-19 (8)). A model
    tuned on coalmine inherits port-local artifacts (the ShadeOfGrey
    heuristic was exactly such a coalmine heuristic — eliminated 2026-09-19
    (7)). (2) noitool's coalmine "authority" shipped a SILENT NO-OP hax
    (0x004000/0x0040 vs the data's 0x006400/0x000064 — C4); trusting that
    reference cost the pipeline a behavior correction a full day of
    digging later. (3) The regular-biome reference we now hold is STRONGER:
    the runtime-confirmed asm chain (12/12 spawn equations, ws×16807^115 CE
    read) + the oracle-validated hasPath port + generateAreaExact ~10 ms.
  - **VERDICT:** coalmine is DEMOTED from reference set to a **stage-6
    special-case FIXTURE** — it remains the only bench exercising hax/mark/
    stairs/room-blocking behavior, keep it for exactly that. The absolute
    references stay, per the user's ruling: **`mapgen/VERIFIED.md` (canon)
    and the reference seeds 78633191/92/93** (captures + CE anchors + entity
    dumps + spawn equations). `vendor/noita-tools` stays READ-ONLY data
    containers (overlay asset), never a reference.
  - **"Any non-wang-tiled biome is a predictable spawn" — REFINE:** the
    no-template census (unique files, color ≠ 00000000) = 55 biomes;
    **47 carry mGradient/mInsidePerlin poro-noise params (seed-DEPENDENT —
    the F3/I1 frontier, NOT predictable)**, 4 bare, 0 with <PixelScene>
    entries in the XML (scenes load from the lua scripts side, I15 class).
    Correct taxonomy: no-template biomes = static-template content (the
    ~95% seed-independent capture zones, PREDICTABLE_ZONES.md — predictable)
    UNION poro-noise procedural terrain (seed-dependent, F3). The
    predictable part is exactly what `template-render.mjs` blits today; the
    noise part is I1. Enumerated source: this census + C21 (wang side).
- **2026-09-19 (10) — F2 dig #3: the hasPath search-side machinery decoded
  (C0FFEE walker exact semantics + overlay arms + driver tail closed).**
  - **FUN_00900560 (slab 0x4ffd60, true 0x900560; the hasPath C0FFEE walker)
    FULLY read:** signature (ECX = out_map {w,h,pixels@+0x18}, EDX = &start
    point, stack arg1 = OUT visited grid, arg2 = OUT AABB). Body: assert
    start in-bounds (throws ✓ string 0x1173c1c at line 0x180 = interior
    line 384 of procedural_terrain.cpp); OUT grid = **fresh w·h array of
    4-byte zero cells** (realloc + memset 0 via 0xc3325e); OUT AABB init =
    {start.x, start.y, start.x, start.y}; queue = 8-byte point vector
    seeded with (start.x, start.y); BFS: pop from the FRONT (read cursor
    edx, stride 8), union the AABB, then judge each 4-neighbor
    **(x, y+1) then (x−1, y) then (x+1, y) then (x, y−1)**: passable iff
    `(cell dword & 0xffffff) == 0` (BLACK) **or cell dword == 0xffeeffc0**
    (#c0ffee — CORRECTION: dig #4 recorded the constant as `0xFFEEC0FF`,
    a byte-reversed misread; the pinned compare is `cmp $0xffeeffc0` @
    slab 0x500088) AND the OUT grid cell == 0 (unvisited); on pass write
    the OUT cell = direction code {2 = down, 3 = up, 4 = right, 5 = left}
    (the flow-field/reconstruction artifact) and QUEUE the neighbor.
    The map itself is READ-ONLY in this walk — the earlier dig #4 phrases
    "writes u16 deltas 0x2/0x5 (top/left)" were: (a) only 2 of 4 deltas
    seen, (b) attributed to the WRONG grid — the deltas {2,3,4,5} live on
    the OUT scratch/visited grid, and the colors mage the flood short-
    circuiting of the search's traversal rules, not map pixel writes.
  - **hasPath (true 0x901780) tail read (slab 0x501881..0x501b3e):** the
    third coalmine flag arm (0x1b(%esp)) → flag != 0 = the SCAN OF THE
    OVERLAY (arg EDX/0x54 object): full map scan writing **0xFF200000-family
    → not that**: `cmpl $0xff004200` = **#004200 dark-green** overlay cell →
    write 0xFF000000 into the out_map cell (slab 0x501aef..0x501b09).
    Overlay arms vs data: the vendored overlay contains ONLY {#000000,
    #006400, #000064, #545454} (0× `#004200`, 0× `#fefefe`, 0× `#000042`)
    → **both in-binary arms (#fefefe stairs-band + #004200 overlay scan)
    are DEAD with the current data**; the port's `doCoalMineHax` handles
    all three constants anyway (future-proof, oracle-pinned) — **no port
    change, no cache bump**.
  - **hasPath tail hygiene (slab 0x50188c..0x501a76):** copy-map ctor
    0x52c390(w,h) + `call 0x500a60` (= true 0x901260, a new CheckForGaps-
    family stub, ECX = map, EDX = &0x64/%esp-region local) + std dtor/free
    chains (0x114a358/348/1a0) — bookkeeping; return value = al from the
    0x1b flag byte (0x501a8d).
  - **DRIVER TAIL CLOSED (slab 0x5056a4..0x5057ab):** there is NO separate
    u16 copy loop — 0x5056a4 = the SECOND grid SetSize (w·h, **4-byte
    elements** — the float grid, C10 shape ✓), then `call 0x4f92b0` =
    **true 0x8f9ab0 = FUN_008f9ab0** (the cave/marker sweep, called with
    flag = `push $1` = TRUE — the second of the two driver calls, ✓ dig
    (6)), then two frees + security-cookie ret at 0x5057aa. The u16 grid's
    population lives entirely INSIDE FUN_008f9ab0. The SESSION_CONTEXT
    "u16 copy loop at slab 0x5057xx" pointer was a Phantom lead — the
    wrap-modulo 4-byte copy-out (0x505610..0x5056a4) IS the whole copy.
    F-anchor's open contract resolves consistent in the negative again:
    NO anchor arithmetic anywhere in the out_map/area-grid write path.
  - Scope note (honest): the SEARCH machinery inside hasPath (segment
    walks, visited-delta consumption, the FUN_00943da0 rect-pooler) is
    now partially read (arms + call ordering + the two mark-color arms)
    but NOT fully instruction-decoded; the port stays LIFO-stack flood +
    best-first search = oracle-pinned (4/4 + 8/8) — a full re-derivation
    is queued only if the oracles or gen-vs-capture regressions demand it.
  - Registrations: C22 (FUN_00900560 semantics + the dig #4 misreads it
    corrects), C23 (the overlay arms + the driver-tail closure), and the
    two NEW pinned color constants 0xffeeffc0 / 0xFF004200 live inside
    C22/C23 notes (skip C24+ until next use).
- **2026-09-19 (11) — F2 dig #4: F2 CLOSED.** The last two queued reads:
  - **BIOME_PATH_FIND_WORLD_POS_MIN/MAX_X are RUNTIME GLOBALS, not
    compile-time constants** (the 159/223 @prov noitool values were
    approximation debt): the driver (ProceduralTerrain::Init family) stores
    two doubles from the parsed biome-def object (`movsd [eax+0x38] →
    0x1327670`, `[eax+0x40] → 0x13289a8` at slab 0x50693a/0x506947) and
    LOGS both (format string 0x1174b1c at slab 0x506972). Every consumer
    reads the same globals: hasPath's arg prep (slab 0x505061-0x50508e:
    area<<9 − int(g1) / − int(g2) = the fillXFrom/fillXTo computation) and
    the per-record area walker at slab 0x507746..0x5077f0 (per record:
    `rec[0x78]−rec[0x74]` extended-range loop with the `10·v−5−int(g)`
    edge transform: `lea 5x; add/edx → 10x; sub $5; sub int(g)` — the
    atlas-cell→world centering applied per cell against the SAME globals).
    Neither is present as static .data (VAs live beyond the mapped
    image — runtime-allocated) → the static values must be resolved from
    the parsed biome config; the port's 159/223 stays tagged
    `@prov noitool` ± the mechanism is now the pinned fact. No game-data
    XML carries 159/223 (grep, this session) → they're engine-side
    computed/registered.
  - **ClearPath = LOGGING-ONLY in-binary:** the hasPath tail's "couldn't
    clear start path" arms (slab 0x5014d7/0x5014e0, strings
    0x1173f28/0x1173f4c behind the gate `cmpb 0,0x1327699`) performs NO
    spatial mutation — the "ClearPath exact range rules" contract
    resolves to NIL (log + the reset byte toggling; the fills live in
    the marker walker + record blit + the C0FFEE/CHECKFORGAPS neighborhood
    already decoded C17/C22).
  - **The C0FFEE flood's role pinned exactly** (C22 + this read): it
    builds the **gap-clearance field consumed by CheckForGaps** (true
    0x901260-family), i.e. it is a reachability/viz field, not a paint.
    Our port's coffee→BLACK path-map flood is verdict-equivalent (the
    region is traversable under both rules — coffee passes the flood's
    `(cell & 0xffffff) == 0 ∨ == 0xffeeffc0` judge directly and black
    is the search's home color; oracles 4/4 + 8/8 hold).
  - **fillRandomMaterials is NOT an hasPath-family member:** in-binary the
    RandomColor pairs are parsed by the biome-def XML handler (true
    0x8eb3xx-family, literal "RandomColor" @ VA 0x1172f04; 4 instr refs
    all in one parser block) and stored in the biome object; their
    out-map/mected consumption = the biome materializer's u16-grid writes
    = the F3/stage-12 frontier (COLORIZE family), not this finalize
    family. F2's scope = the accept/retry + out_map-mutation machinery:
    fully read now (fillMainPath's walk-loop internals remain abstracted
    as the oracle-pinned search; per dig #3's scope note, re-derivation
    only on regression).
  - Registration: C24 (the runtime MinX/MaxX globals + the biome-def
    parse family). VERIFIED §11 frontier item 2 → F2 CLOSED.
- **2026-09-19 (12) — F3 dig #1: the poro noise core READ — 2D SIMPLEX +
  quintic lattice noise identified; the noise-transform constants pinned;
  the config-key chain behind C24 resolved statically. Slab regenerated
  this session; C13 proof anchor re-pinned first (`cmp eax,0xFF420000` @
  slab 0x50124d = true 0x901a4d ✓). VA rule for this entry: true VA =
  slab VA + 0x400800; .rdata constants read from the raw file at
  `file_off = VA − 0x400e00` (convention verified against the
  200000.0f/100000.0f/0.5/2147483647.0 pins).**

  - **The "perlin" core is 2D SIMPLEX noise (true FUN_008fca60 = slab
    0x4fc260)** — the ledger-prose "smoothed value noise" label was
    wrong. Float args (xmm0, xmm1) → xmm0 out. Op order (slab refs):
    skew `s=(x+y)·F2` → floor i,j (negative-adjust `comiss`+`dec` @
    0x4fc289..0x4fc29c) → unskew by `G2·(i+j)` (0x4fc2ac..0x4fc2d2) →
    corner choice `(i1,j1)` = (1,0)|(0,1) (0x4fc2d3..0x4fc2e6) → per-
    corner `t = 0.5 − x² − y²` (0.5 @0x11dfa94; t≤0 → contribute 0)
    → gradient `g = perm[perm[j]+i] & 7` via perm **0x114ced0** (8-dir
    gradient: ≥4 axis-swap, bit0 sign-flip `xorps −0.0`, bit2
    multiplier ±2.0 @0x11e05f0/0x11dfe68) → contribution `dot·t⁴` (two
    squarings, Gustavson-style; 0x4fc372/0x4fc3bb) → sum × **40.0**
    (0x11e0270 @0x4fc4cd). Pinned constants: F2=0.3660254@0x11dfa34,
    G2=0.2113249@0x11df9c0, 2G2=0.4226497@0x11dfa4c, kernel 0.5,
    scale 40.0 → registered C25.

  - **3D simplex twin = true 0x8fcce0 (slab 0x4fc4e0):** F3 = 1/3
    @0x11dfa18, G3 = 1/6 @0x11df9a0, same perm table (C25).

  - **A second, separate noise family = quintic lattice noise:** true
    0x8fc740 (slab 0x4fbf40) and true 0x900900 (slab 0x4fc100); OWN perm
    table **0x114d700** (`&0xff` wrap; starts 23,125,161,52,…), quintic
    smoothstep constants **6.0 @0x11e00e8 / 15.0 @0x11e01a0** (C25). Its
    gradient set / final scale unread (funnel item).

  - **The noise transform = true FUN_00908cb0 (slab 0x5084b0)** — the
    per-cell sampler's evaluator; registered C26. It READS the C24
    runtime globals 0x1327670/0x13289a8 as coordinate offsets (slab
    0x5084b6/0x5084c1 — C24's doubles feed the noise args too ⇒ C24's
    159/223 family and the noise args are CONFIG-coupled), and mixes:
    floorf cells `i = floor((X+gMin+0.5)×0.1)`, `j = …` (0.1 as an
    f64 **DOUBLE** @0x11dfd08; floorf 0x4c8b0 @0x50853e/0x50854e);
    `w = pure2dSimplex(X×0.13715, Y×0.13717)×0.45 + 0.1`
    (0.13715@0x11dfd30 / 0.13717@0x11dfd38 doubles; 0.45@0x11dfa5c,
    0.1@0x11df974); lattice-noise args × **1/9** (f64 @0x11dfd20) →
    two quintic-lattice calls (0x4fbf40 @0x5085c1, 0x4fc100 @0x50861b)
    weighted by `((1−w)×0.33 + 0.111)×a` (0.33@0x11dfa10,
    0.111@0x11df97c; a = caller float, =1.0 from the sampler), then an
    integer-lattice fractional-mixing tail (0x508612..0x50865e). Instruction
    refs recorded in C26; the line-by-line decompilation is funnel
    item (b) below.

  - **Sampler FUN_0090d860 (slab 0x50d060) read (head + noise arm):**
    profiler scope "IMPL_DoBufferedPixelScene - bitmap noise loop job"
    (string 0x1175638 @ slab 0x50d0a4); identity double-anchored by the
    C12 assert idiom (`push $0x1151084` + `add $0x76c` @ slab 0x50d1c2)
    AND the driver's copy-out getter 0x549680 (@ slab 0x50d112).
    Per-cell flow: u16 guard (@0x50d117) → marker grids (+0xd4 u16 via
    0x54a0f0, +0xf4 byte via 0x5493b0, `== 0xff` check @0x50d364) →
    **float field [+0xb4] gate: process only if v > 0.5** (comiss
    0x11dfa94 @0x50d3c3) → material select [+0x1d4] → **call
    0x5084b0 = true FUN_00908cb0** (@0x50d419) → smoothstep interp
    (3.0@0x11dff70, 2.0@0x11dfe68, 0.5@0x11dfa94) → second noise call
    0x508670 (true 0x908e70 @0x50d524) + CRT floorf pair (0x114a434
    @0x50d53f/0x50d55e) + dispatcher 0x4f4830 → **paint arm:** u16
    write [+0x1e0] via 0x559de0 (@0x50d693), RGBA grid [+0x180]
    alpha check (@0x50d6d0), vtable dispatch. Grid-contract facts for
    the port are in place; material-naming call 0xb78e0 (@0x50d392)
    unread.

  - **C28 — mystery #2 RESOLVED statically:** the biome-def parse
    doubles `[+0x38]/[+0x40]` (C24's source) belong to a per-biome map
    class whose accessor **true 0x909DA0 (slab 0x5095a0)** consumes the
    same `[+0x38]/[+0x40]` doubles as additive offsets over a
    `[+0x50]×[+0x54]` wrap-mod (`sar 9` + `idiv`) vector table at +0x68 —
    i.e. that double pair is a per-biome "Wang offset" (log string
    "Wang offset: " 0x1174b1c @ slab 0x506972). The config-key name
    strings (BIOME_USE_BIG_WANG @0x116c762,
    BIOME_PATH_FIND_HEIGHT_LIMIT @0x116c776,
    BIOME_PATH_FIND_WORLD_POS_MIN_X @0x116c7da, MAX_X @0x116c85e) have
    ZERO imm32 references across the whole exe file (scan verified
    against the control literal 0x1173ec0 which finds its 4 known
    hits) ⇒ the values live in the engine's runtime ConfigRegistry
    defaults, not in any game-data XML (grep of the extracted data dir:
    no `path_find` matches). Static resolution stops here; numbers need
    a runtime probe. The C24/`@prov noitool` tag on the port's 159/223
    REMAINS.

  - **F3 funnel status after dig #1:** core math + state chain + the
    noise-args coupling are READ. Remaining binary reads: (a) the
    quintic-lattice gradient set / final scale; (b) FUN_00908cb0's
    exact line-by-line de-compilation; (c) the sampler's paint arm
    constants; (d) the Init caller of FUN_0090ce20/0x50c9d5 (what
    plants the per-cell generator objects and sources its seed arg).
    After those: port the FUN_00908cb0 transform + grid contract to
    JS and validate vs captures (I1/I3/I5/I6).

  - Tests: baseline intact this dig (no port changes expected).
- **2026-09-19 (13) — F3 dig #2: FUN_00908cb0 FULLY DECOMPILED (slab
  0x5084b0..0x50866f, every op transcribed; constants C26) + the
  quintic-lattice noise completed + the second evaluator + the
  generator-plant walk.** Slab unchanged from dig #1 (C13 anchor
  re-verified at entry ✓).
  - **QUINTIC LATTICE NOISE (true 0x8fc740 = slab 0x4fbf40; true 0x900900
    = slab 0x4fc100 reads identically in head) = CLASSIC 2D GRADIENT
    PERLIN with quintic fade** (not value noise): floor each axis with
    the comiss/dec negative-adjust (slab 0x4fbf4c..0x4fbf6d); lattice
    indices `&0xff` (i∈{0..255}, wrap ±1 via `lea 1`+`and 0xff`,
    slab 0x4fbf7a/0x4fbfb2); hash = `perm2[perm[perm[i]+j]] & 7` chain
    (perm table 0x114d700, slab 0x4fbf99..0x4fbfd1); gradient = PAIRS
    from the runtime .data table (VA **0x12eec08 = g_x, 0x12eec0c =
    g_y, stride 8**, loaded `movss 0x12eec08(,%g,8)` slab 0x4fbfe7 —
    table contents are runtime-initialized, NOT statically readable);
    dot = gx·dx + gy·dy; quintic smoothing f(t) = t·t·(6t²−15t+10)
    (constants 6.0 @0x11e00e8, 15.0 @0x11e01a0, 10.0 @0x11e015c —
    byte-pinned this session; slab 0x4fbfba/0x4fbfdc/0x4fc00c) and the
    classic 2×2 bilinear of 4 corner dots (slab 0x4fc0d4..0x4fc0e8).
    The 0.94/0.95/15.5 ledger trio does NOT appear in either lattice
    function — still UNPINNED anywhere in this family.
  - **FUN_00908cb0 (slab 0x5084b0) — exact recipe (JS-ready):**
    ```
    adjX = inX + gMin;  adjY = inY + gMax      // C24 f64 globals
    u = f32((adjX + 0.5) * 0.1)                // 0.5 f64 @0x11dfdd8; 0.1 f64 @0x11dfd08
    v = f32((adjY + 0.5) * 0.1)
    out := {u, v}                              // preliminary stores (%ebx)=u out[0] @0x508515, out[1]=v @0x50852a
    if (a <= 0) return                          // comiss/jae @0x508532: a = caller float (xmm1)
    w = simplex2d(adjX * 0.13715, adjY * 0.13717) * 0.45 + 0.1
        // call 0x4fc260 @0x50857a; 0.13715/0.13717 = f64 @0x11dfd30/0x11dfd38;
        // *0.45 @0x11dfa5c; +0.1 @0x11df974; stored -0xc
    nX = lattice2d(adjY * (1/9), adjX * (1/9))  // call 0x4fbf40 @0x5085c1 — ARG ORDER SWAPPED (x = adjY/9)
    nY = latticeB(adjX * (1/9), adjY * (1/9))   // call 0x4fc100 @0x50861b — normal order
    out[0] = u + nX * (1 - w) * a               // mulss -0x8(a) then addss @0x50864b/0x50864f: floor+frac reconstruct = u
    out[1] = v + nY * ((1 - w) * 0.33 + 0.111) * a  // 0.33 @0x11dfa10, 0.111 @0x11df97c @0x5085e5/0x5085ed
    // iu/jv floor-CS 0x508543/0x508556 feed only the frac reconstruction:
    // out[0] = (float)iu + (u - iu) + dx == u + dx; out[1] = (float)jv + (v - jv) + dy == v + dy
    ```
    Semantics: **the function computes the ×0.1-scaled lattice coordinate
    (u,v) of the sample and returns it NOISE-DISPLACED along both axes**
    (x-displacement weight (1−w)·a; y-displacement weight
    ((1−w)·0.33+0.111)·a). The caller (FUN_0090d860) then floor-interps
    these displaced coords between grid corners (smoothstep 3.0/2.0/0.5,
    slab 0x50d456..0x50d4c5) to pick material samples — a perlin
    domain-warp of the material grid lookup, with a = the call-site
    weight (1.0 in the observed call at slab 0x50d419).
  - **Second evaluator true 0x908e70 (slab 0x508670) read** — the
    solitary second noise in the sampler: constants +0.07 (f64
    @0x11dfce8), 0.035 (f64 @0x11dfc98), **15.5 (f32 @0x11e01b0)**,
    0.0489275 (f32 @0x11df944), 5.35 (@0x11e00b4), **0.95 (@0x11dfbac)**
    (all byte-pinned; two of the ledger trio 15.5/0.95 are now pinned
    HERE, not in the core). Recipe: `q = lattice(x*0.035, y*0.07)` (call
    0x4fc100 @0x5086ac, ANISOTROPIC) → warp = `(x + q*15.5) * 0.0489275`,
    `(y + q*15.5) * 0.0489275` → `s = simplex2d(warp.x, warp.y)` (call
    0x4fc260 @0x5086fa) → return `min(0.5, a + s * ((a-0.5)*0.5)^2 * 5.35 * 0.95)` (clamp via comiss/max @0x50872c..0x508731).
    The "min" direction: comiss keeps 0.5 when 0.5 > value ⇒ result
    floor-clamps AT 0.5 (upper-clamp: value ≤ 0.5 ⇒ 0.5 kept ≥ — record
    the ASM form `if (0.5 > val) ret 0.5 else val` = **max(0.5? v) is
    WRONG; per-asm = ret val unless val < 0.5 in which case 0.5** =
    clamp to ≥ 0.5) — CAREFUL: reads as `ret = (0.5 > val) ? 0.5 : val`
    = a LOWER clamp at 0.5 (values < 0.5 → 0.5): re-verify on port.
  - **Generator plant WALK (F3 target (d)):** FUN_0090ce20 has EXACTLY
    ONE e8 caller (**slab 0x50ee80 = true 0x90f680**); prologue walk =
    `malloc(0x1ec)` (`push 0x1ec; call *0x114a34c` @0x50ee54), ctor =
    FUN_0090ce20(obj, seed) with **seed = raw WORLDSEED::GetSeed()**
    (e8 → true 0x9119d0 @0x50ee78 = the VERIFIED §7 GetSeed ✓), then
    [obj+0x90]/[obj+0x94] = the cell coords (explicit per-cell identity,
    `-0x358(ebp)`/ebx), registered via 0x39dc40/0x50c7b0 into the
    cellular-grid context; profiler string
    **"IMPL_DoBufferedPixelScene - add to cell grid"** (0x1175e04 -
    slab 0x50ef5a) ⇒ the generators are planted by the buffered
    pixel-scene cell-grid job during Init's job walk (not one generator
    per pixel). Per-cell noise DIVERSITY therefore comes from the cell
    coords + the per-biome "Wang offset" doubles (C28), NOT from a
    per-cell seed: the +0x94 float chain is uniform per worldseed, the
    spatial variation is coordinate-driven. (This collapses the F3 RNG
    question: the noise layer is ws-seeded ONCE per cell-planting and
    location-varying, like the mSeed family.)
  - **VA-CONVENTION WARNING (open item, do not trust):** the floor
    helper's objdump target prints as `0x4c8b0` (= a value BELOW the
    slab base 0x401000); the same anomaly appears in canon row C20's
    `call 0x43ff0` std::string helper. Both imply either (a) objdump
    prints e8 targets RAW (unadjusted) inside binary mode — which would
    give TRUE VA = the printed value − 0x400 + offset?? unresolved — or
    (b) they are TRUE VAs of the low-CRT region (0x44d0b0 via +0x400800
    = in-image for 0x4c8b0?? — the +0x400800 algebra gives true
    0x44d0b0 = in-image, C13-CONSISTENT; but for 0x43ff0 it gives
    0x847ff0 — unverifiable without a Ghidra name check). **No true-VA
    claim for these two helpers is canon; they are used only as
    floor/strcmp by call-site context.** First dig #3 item: settle the
    e8-target VA convention with a harness dump (byte-equate a known
    Ghidra helper through its bytes).
  - Tests: unchanged 143/143 (no port changes this dig).
  - **2026-09-20 (14) — F3 dig #3 addendum: the e8-target VA convention
    SETTLED (byte-tested)** — the slab spans only .text's second half
    (file 0x400c00.. = true 0x801800..); e8 targets printed BELOW the
    slab base = calls into .text's lower region (file 0x400..0x400c00 =
    true 0x401000..0x801800), which the extract never contained. Byte
    verification: the floor helper (slab print `0x4c8b0`) = true
    **0x44d0b0** = exe file 0x4c4b0 = a real SSE fp-round helper
    (`55 8b ec 83 e4 c0 83 ec 40 … cvtss2sd … fld/fistp`) matching the
    call-site contract; canon C20's `call 0x4cff0`?? — the row's
    `0x43ff0` = true **0x4447f0** (correction recorded in C20/C13).
    ⇒ C13's `true = slab + 0x400800` is UNIVERSAL for these targets.
    Prototype skeleton: `mapgen/lib/noise-proto.mjs` (constants +
    perm heads landed; runnable port queued dig #4 with the two open
    inputs: the runtime gradient table 0x12eec08 and the C30 clamp).

- **2026-09-20 (15) — F3 dig #4: the noise port LANDED (runnable) + three
  canon corrections.** C13 anchor re-pinned first (slab 0x50124d =
  true 0x901a4d, file bytes `3d 00 00 42 ff` ✓). Perm tables byte-verified
  from the raw exe (VA→file_off = VA−0x400e00): simplex @0x114ced0 starts
  151,160,137,91,90,15,131,13; lattice @0x114d700 starts 23,125,161,52;
  both 256-unique mirrored to 512 ✓ (note: an old C25 note said
  `f[262] = 151` — actual mirror gives 131 (=perm[6]); the MIRROR property
  is the verified fact, the 151 value was the wrap-misread).
  - **FULL EXE GRADIENT-TABLE HUNT — NEGATIVE (settled):** whole-file scan
    for imm32 `0x12eec08`/`0x12eec0c` → exactly 8 hits each, all at file
    0x4fbbec..0x4fbc98 = **true 0x8fc7ec..0x8fc898**, i.e. inside the
    quintic lattice noise itself (the `movss` loads). No in-binary
    initializer exists; byte-pin of the table's file image @0xeede08 =
    .rdata string bytes (ASCII "666440", "VarRe…" etc), NOT gradient
    floats. ⇒ the table is genuinely runtime-only; the port runs
    latticeGrad against a CLEARLY-SUBSCRIPTED placeholder (see the placeholder paragraph below) until a Cheat-Engine read supply fills 0x12eec08/0x12eec0c
    (16 floats). NO value from the placeholder may ever be cited.
  - **true 0x900900 = slab 0x4fc100 — CORRECTION vs (13): it is NOT a
    gradient-perlin "latticeB". Full byte-trace (slab 0x4fc100..0x4fc25f):
    corner values are RAW perm bytes** (`perm[perm[i±1]+j±1]`, table
    0x114d700, mirrored ✓), each divided by **255.0 f32 (@0x11e0378,
    byte-pinned `0x00007f43` this session)**, quintic bilinear (6/15/10
    fade, symmetric — the second column lerps against v(i+1)'s OWN low
    endpoint), then `(v−0.5)·2.0` (constants 0.5 @0x11dfa94, 2.0
    @0x11dfe68; slab 0x4fc240..0x4fc248) ⇒ **quintic VALUE noise,
    output range [−1, +1]**. No gradient table access anywhere in it.
    (13)'s "latticeB (0x4fc100), normal order" label survives (it follows
    the same arg convention), but every gradient attribution is deleted.
  - **true 0x8fc740 = slab 0x4fbf40 fully decoded (gradient perlin):**
    4-corner hashes perm², gradient pairs loaded `movss 0x12eec08(,h,8)`
    (gx) / `0x12eec0c(,h,8)` (gy); **second y-blend asymmetry CONFIRMED
    in bytes — the high column lerps between `dot_SE` and the ALREADY
    BLENDED `vy0` as the low endpoint: `vy1 = (dot_SE − vy0)·qy + dNE`**
    (slab 0x4fc0b4..0x4fc0c8) — ported verbatim; (13)'s symmetric-bilinear
    reading was wrong there.
  - **FUN_00908cb0 (slab 0x5084b0) — CORRECTION of (13)'s out-lines:**
    the two lattice results CROSS relative to (13)'s output pairing:
    ```
    w  = simplex2d(adjX·0.13715, adjY·0.13717)·0.45 + 0.1      (unchanged)
    Rg = latticeGrad(adjY/9, adjX/9)      // 0x4fbf40, SWAPPED (kept!)
    Rv = latticeVal(adjX/9, adjY/9)       // 0x4fc100, normal (kept)
    out[0] = u + Rv·(w·a)                 // 0x508628/0x508638/0x50864b/0x50864f
    out[1] = v + Rg·[((1−w)·0.33) + 0.111]·a    // 0x5085de..0x508662
    ```
    (the 0.33-chain binds to the SWAPPED-ARG GRADIENT call and w·a to the
    VALUE call — (13) had them assigned the other way around; asm is
    authority). Register details unchanged from (13): out = ECX f32 pair;
    inX/inY = xmm2/xmm3 f64; a = xmm1 f32; early return when 0 ≥ a;
    u,v via f64 (adj±0.5)·0.1; floor helper 0x44d0b0 ×2 (iu, jv) feed only
    the frac reconstruction (identity in real arithmetic); ninth IS NOT
    exact 1/9 — **0x11dfd20 = 0.1111111119389534 = f32(0.11111111) widened
    to f64** (byte-pinned this session, replaces C26's "1/9 (f64)" gloss).
  - **true 0x908e70 (slab 0x508670) — clamp direction settled (C30 OPEN
    arm):** `q = latticeVal(f32(x·0.035), f32(y·0.07))` (anisotropic);
    `warp = ((f32)axis + q·15.5)·0.0489275` for BOTH axes (yes, same q;
    slab 0x5086c2..0x5086f2 re-verified byte-exact); `s = simplex(wx, wy)`;
    then `t = ((a−0.5)·0.5)²·5.35·0.95` (f32; 0x11dfa94 kernel, gain
    0x11e00b4, gamma 0x11dfbac); `val = s·t + a`; tail `comiss %xmm1,%xmm0
    + ja` (slab 0x50872c..0x508731) ⇒ **`val < 0.5 ? 0.5 : val` — LOWER
    clamp at 0.5** (C30's OPEN question closed; (13)-heading surgical
    reading confirmed).
  - **Input mapping (dig #4 target (d) — WALKS READ):** the sole ctor
    caller (true 0x90f680 = slab 0x50ee80 walk) plants per-cell
    generators with `malloc(0x1ec)` (`push $0x1ec; call *0x114a34c` @
    0x50ee54), ctor = FUN_0090ce20 with seed = `WORLDSEED::GetSeed()` (e8
    → true 0x9119d0 @0x50ee78 ✓), then `[gen+0x90] = -0x358(%ebp)` /
    `[gen+0x94] = ebx` = the CELL COORDS (loop state; NOT the RNG state — the +0x94-float chain of C27 lives in the
    +0x98 sub-object → bigobj +0x12c); registered via 0x39dc40/0x50c7b0
    into the cell-grid registry (obj at [registry+0x84]), profiler string
    "IMPL_DoBufferedPixelScene - add to cell grid" (0x1175e04 @slab
    0x50ef5a) ✓. **Consumer arm slab 0x50c9d5 (true 0x90d1d5):** the walk
    calls the sampler FUN_0090d860 (0x50c90a), extracts an object via a
    virtual `+0x58` call (0x50c9c7), then for each sample: coord
    `([ebp−0x4c]/[ebp−0x58]` ints, round-half-÷2 via `cltd/sub/sar`)
    `+ origin [edi+8]/[edi+4]` → cvtdq2pd doubles → the chunk-map
    accessor **true 0x909da0 (slab 0x5095a0)** (C27) resolves the
    generator by wrap-mod over `[+0x50]/[+0x54]`, gated `+0xc4 == 0` —
    i.e. the noise input = (generator cell coords + the per-biome C24
    "Wang offset" doubles) resolved through the cell-grid registry.
    The RNG-chain link is CLOSED for the noise (per-cell seed = the ONE
    FUN_008f9470 draw, spatial diversity location-driven — C27/C28
    reconfirmed; no further RNG reads needed for the noise band).
  - **PORT:** `mapgen/lib/noise-proto.mjs` — runnable, 4 f32-exact cores
    (simplex2d / latticeGrad2d / latticeVal2d / noiseTransform /
    evaluator2), Math.fround at every SSE f32 step; f64 ops left in
    double; full 512-mirrored perm tables embedded byte-exact.
    VALIDATION vs the reference capture is **PLACEHOLDER-GATED**: the
    flat-region rms / density check (I1/I3/I5/I6) can only run once the
    runtime gradient table is extracted (CE read design queued; the
    hunt-negative is settled, not a failure of the port). Tests: 143/143
    intact; the noise is NOT chained into the genmap pipeline, so the
    cache stays at r3e (no observable change was introduced).
  - **Standalone smoke (2026-09-20, placeholder-limited — NOT capture
    validation):** 6.6M samples over [−500,500]² — all outputs finite;
    noiseTransform outputs ≈ the ×0.1 grid coordinate ± displacement
    (observed ±50.3 / ±51.6 envelope for inX/inY = ±500 — consistent with
    |disp| ≤ ~1.4·a); evaluator2 @a=1: [0.719, 1.281] ⊂ [1 ± 0.318] (the
    theoretical ((a−0.5)·0.5)²·5.35·0.95·|s_max| envelope — kernel order
    consistent); simplex2d: ±0.8843, symmetric as expected for the
    8-direction construct. Capture-level validation (flat-region rms vs
    seed 78633191) remains GATED on the runtime gradient table.

- **2026-09-20 (16) — F3 dig #4 addendum / CLOSURE: the gradient table
  FOUND IN-FILE + the sampler paint arm read + the .data file-rule
  corrected.** All four reads on F3's list are closed; the port is
  fully binary-derived with no placeholder.
  - **.DATA FILE-RULE AMENDMENT (C13):** the PE section table shows
    imageBase 0x400000 and per-section raw deltas **.text = VA−0x400C00
    · .rdata = VA−0x400E00 · .data = VA−0x401A00**. The standing
    ".rdata/.data reads: file_off = VA − 0x400e00" rule is RDATA-ONLY.
    .data raw backing spans VA 0x12EB000..0x1327400 (vsize 0x612F0 → VA
    up to 0x134C2F0; the tail = BSS/no file bytes). Re-checked
    runtime-only verdicts against the map this session: C24
    (0x1327670/0x13289a8), 0x13276ba, 0x132aed8 are all beyond 0x1327400
    → BSS → runtime-confirmed (their verdicts stand via the map, not
    merely via a garbage read).
  - **GRADIENT TABLE @0x12eec08 FOUND (file 0xEED208)** — byte-pinned
    8 f32 pairs (gx @0x12eec08 / gy @0x12eec0c, stride 8):
    `0:(−1,0) 1:(1,0) 2:(0,−1) 3:(0,1) 4:(−1,−1) 5:(−1,1) 6:(1,−1)
    7:(1,1)` — static .data, no randomness. The (13)/dig #4
    "runtime-only / CE read required" negative was a section-rule
    artifact; the imm32 hunt result stands as recorded (only the 8 load
    sites — no runtime init code exists; the table is compile-time data).
    `lib/noise-proto.mjs` GRADIENTS = these exact bytes.
  - **SAMPLER PAINT ARM (FUN_0090d860 tail, slab 0x50d5b8..0x50d84c) —
    read (last open item on F3's list):** dispatcher 0x4f4830 (@0x50d57a
    family) returns the sampled material; per sample: u16 grid write
    (+0x1e0 via 0x559de0, indexed `w·row + x`, `mov %ecx,(%eax)` @
    0x50d69a = the DISPLACED material id); then the RGBA grid [+0x180
    via 0x549680] bounds-checked (+0x168 w / +0x16c h) with
    `testl $0xff000000` alpha guard (@0x50d6d0) → vtable *0x1c color
    paint dispatch (0x50d6fa); else the 0x342040 material lookup +
    mark-flag buffers (+0x1a0 / +0x1c0, byte=1 @0x50d823/0x50d851).
    The noise → (displaced u,v) → floor-interp → material select →
    u16/RGBA paint chain is mechanically complete in-binary (material
    naming 0xb78e0/0x603fd0 is config-side — outside the noise
    mechanism window).
  - **F3 STATUS: READ-CLOSED + PORT FULLY BINARY-DERIVED.** Every byte
    of the five cores pinned; `lib/noise-proto.mjs` carries zero
    placeholders. Remaining pipeline steps (recorded here, NOT F3
    reads): capture validation (I1/I3/I5/I6) + genmap integration
    (cache r3e→r3f ONLY on an observable change). Tests: 143/143
    intact (module smoke: 6.6M finite samples; evaluator2 range =
    theoretical envelope).

- **2026-09-20 (17) — generator update wired (F3 integration, shape-first)
  + an honest boundary marked:** `mapgen/lib/noise-terrain.mjs` plugs the
  binary noise chain into `world-gen.mjs`'s fallback path (procedural
  biomes, C21 census: 132 non-template): per wang cell,
  `evaluator2(gx + cfgMinX, gy + cfgMaxX, 1.0)` (the 0x908e70 binary
  recipe; cfg = the C24 ConfigRegistry defaults 159/223, @prov noitool),
  gated by the sampler's own `> 0.5` test (slab 0x50d3c3); solid cells
  paint one baseline shade per band (shape-first mandate — colors to be
  calibrated after the data-material naming pass 0xb78e0/0x603fd0).
  - **SMOKE RESULT (seed 78633191, chunk desert@45,48):** the chain
    RUNS (mask built, tests 143/143, cache r3e → r3f bumped — the noise
    bands now render visibly), BUT the mask is ALL-SOLID (2704/2704):
    a lower-clamped-at-0.5 evaluator can never fail the >0.5 gate —
    the gate is a smoothstep/interp precondition, NOT the content mask.
    ⇒ the game's solid/air CONTENT decision lives in the **u16 DECOR
    material grid** — which is filled by the fillRandomMaterials /
    colorize family (named OPEN in VERIFIED's F2/F3 perimeter since
    2026-09-19). The integration is therefore flagged a provisional
    first cut; the honest next read = fillRandomMaterials' u16 write
    walk + the float-field [+0xb4] source (+0x94 chain consumption),
    after which the gate/field separation can produce real shape.
  - ISSUE-tracking note: the world smoke surfacing "5 area errors" is
    the preexisting no-attempt areas (lake / rainforest_dark family,
    VERIFIED §4 residual); unchanged this session.

- **2026-09-20 (18) — F3 dig #5: the u16 DECOR material-grid fill found —
  `BitmapNoise::LoadFromImageData` (true FUN_008f9ab0) READ end-to-end.**
  Anchor re-pinned first (C13: file 0x500e4d = `3d 00 00 42 ff` = true
  0x901a4d ✓). All addresses below verified in the fresh slab.
  - **SetSize = true 0x8f95c0 (slab 0x4f8dc0)** — read fully (both C9
    sites call it, target byte-confirmed `e8 69 1d ff ff`). The area
    grid class: dims `[+0x0]=w [+0x4]=h`; **three zero-initialized grids:
    [+0x18] FLOAT (4·w·h bytes, cnt [+0x1c]) · [+0x38] U16 (2·w·h bytes,
    cnt [+0x3c] = the DECOR material grid) · [+0x58] BYTE (w·h, cnt
    [+0x5c])** — each memset(0) (0xc3325e). Alloc/free via
    **0x114a358/0x114a35c** (the engine allocator pair). u16 stride
    `lea (%ebx,%ebx,1)` byte-confirms 2-byte elems.
  - **The writer = true 0x8f9ab0** (slab 0x4f92b0): identity proven by its
    own assert strings — `BitmapNoise::LoadFromImageData` @0x1173720,
    part 1 @0x1173750 (line 548), part 2 @0x11737fc (line 612), part 3
    @0x11738dc. This is VERIFIED §9 frontier item 5's "random-material
    fill" for the area class.
  - **Who/when**: called TWICE from the fill driver (slab 0x5055d7 and
    0x50571e = true **0x905dd7/0x905f1e**) with `flag byte = 1` (part 2
    3 ON), per call: `(this=<area BitmapNoise>, src-image, count,
    hole-align, w=xEnd [ebp+0x1c], h=yEnd [ebp+0x20])`; the src-image
    objects are the driver's accepted out_map (edi) and the wrap-copy
    twin. ⇒ corrects C23's "u16 population lives inside FUN_008f9ab0"
    to a precise mechanism (below), and closes the F2→F3 handoff cell.
  - **Part 1 per-cell recipe (slab 0x4f93f1..0x4f9962), byte-exact:**
    1. `color = u32 getter (true 0x9fe3c0, slab 0x5fdbc0)(src, x, y)`
       — full wrap-mod image fetch, same module as the u16 reader.
    2. `alpha = color & 0xff000000`; if `alpha == 0xfe000000` → set
       byte grid mark 1 at (x,y) (helper 0x54a1d0 on the +0x60 wrapper;
       one-time resize gated by [+0x7c]) — the 0xFE = "unpainted marker".
    3. Skip rules: `color == 0` → skip; `(color & 0xffffff) == 0` →
       skip; `alpha == 0` → skip (no u16 write; zeroed stays 0).
    4. Resolver fan: last-color memo ([-0x7c]/[-0x78]); **A-channel =
       fn ptr [this+0xb0]** (`call *eax` with (color); NULL → skip),
       result = material id (−1 = none, u32 bound 0xfffe under assert
       "material_id < USHRT_MAX" line 612). B-channel = **std::map
       [this+0xb4]** (find 0x5fdc50, slab 0x4fdc50-family → true
       0x9fe450); assert "script_id < 255" (line 611) then **byte grid
       (= script id) at (x,y) + record {x, y, id, id−1}** pushed to the
       +0x80 vector (0x52e370).
    5. u16 write (A channel, slab 0x4f96f4/0x4f9729): grid `[this+0x38]`
       (helper 0x54a0f0, idx w·y+x) gets **A+1** (`inc %eax` at 0x4f96bc,
       stored at 0x4f9751); parallel float grid `[this+0x18]` (0x5491f0)
       gets **−1.0f when A+1 == 1 (i.e. A == 0), else +1.0f**. u16
       resize gate [+0x3c] == 0 (helpers 0x52e000/0x52e050).
    6. Fallback (no A, no B, or id>0xfffe → jump 0x4f98df/0x4f98dc):
       **float-only "grey" write**: `(f32)R + 2·f32(G))/3.0f` (mulss
       pair×2 @0x11df8bc + divss 3.0 @0x11dff70), NO u16 write.
  - **Part 2 (gated by the flag byte, [ebp+0x10] != 0 → slab 0x4f9994):
    the per-marked-cell neighbor pass:** cells carry a byte-mark grid;
    per cell reads the 4 neighbor MATERIALS via the **wrap-mod u16
    getter true 0x9fe4e0 (slab 0x5fdce0)** — VERIFIED §7's "u16 reader
    FUN_009fe4e0" CONFIRMED exactly (dims obj +0x0/+0x4, ptr +0x18,
    full modulo on both coords incl. negative `+ (1 − trunc(x/w))·w`),
    a predicate helper (slab 0x5fdd70 = true 0x9fe570), and when the
    predicate says the neighborhood is homogeneous → **write u16 = 1 +
    float −1.0 at the cell** (slab 0x4f9c28..0x4f9c53) = the
    empty-classification of the interior.
  - **Predicate = TRUE 0x9fe570 (slab 0x5fdd70) read fully:** input =
    4 stacked u16 materials (L/R/U/D); builds a length-4 u16 list, then
    a **std::map<u16,int32>** (ctor 0x640fd0, operator[] 0x60e690):
    skips entries == 0 (`cmpw $0x0`), counts occurrences, keeps the
    **material with the STRICT-first-maximum count** (best = −1 init;
    `count > best` only), NOTQ frees the map; returns that material
    (or −1 if all-zero). So part 2/3 = "an unpainted/mark cell surrounded
    by ≥-one material (or fully homogeneous neighbors) adopts the
    neighbors' majority material". **part 3** (slab 0x4f9f17-family)
    re-runs the same majority pass writing **into a doubled (2×)
    re-allocated material array** ("part 3" assert line passes
    a rebuilt array ptr in ECX to 0x54a0f0); requires
    `material(x,y) == 0 && float(x,y) != 0` before the neighbor fill
    (float getter = true 0x9fe620 (slab 0x5fde20), same wrap-mod).
  - **The driver's u16-grid content = ART-COLOR resolution**, not noise:
    the DECOR material id at each wang-tile cell comes from the tile's
    own pixel color through the per-biome resolver tables [this+0xb0]
    ("RandomMaterials" family — 17 .rdata parse sites at true
    0x496a2e..0x4a97ed, config-side; NOT read yet) and [this+0xb4]
    (color→script). The noise-driven family (the sampler dispatcher
    true 0x8f4830, "biome_ma…terials.cpp" string @0x1173240) is a
    separate entity — deferred.
  - Consequence for I1/I3/I5/I6 (P1/P3/P5): our port's shape story is
    not the >0.5 gate alone — it is **image-color → resolver → u16**
    plus part-2/3 neighbor averaging; the ±1.0 field (the [+0x18]
    float grid) is the "solid lattice weight" that entry (17) profited
    from (all-solid = uninitialized +0x18/±1.0-empty port side).
- **2026-09-20 (19) — F3 dig #5 second kill: the LIQUID-selector
  (the P3/P5/P6 portal-zone/tea/lava mechanism) = TRUE 0x8f4830 aspect,
  slab 0x4f4830.** (Read through its SETUP; classification math fully
  read; body 0x4f4a21..0x4f4f54.)
  - asserts: file "…procedural_utils/biome_ma…" (@0x1173240, the
    biome_materials unit!) + per-call site strings (0x118c9f4
    "mInitialized", 0x1151e28 "component" family, 0x11732c0/0x11732d0
    "mCellFactory/couldn't find material '").
  - Per-call: (this = the biome def; xmm0 = arg0 f32; stack ints edx =
    X, ecx…). Guard: const f32 [ebx+0x0]/[+0x4] gate (comiss xmm1/xmm0
    at 0x4f4919/0x4f4922); **RECORDED-CORRECTED (dig #7): the record
    COUNT = (end − start) ÷ 132 — magic 0x3e0f83e1 (= 1041204193;
    imul + sar 5 = the signed >>37 reciprocal; M·132/2³⁷ =
    1.0000000000 exactly) — an earlier "÷-26.0 / ±26-cell" gloss here
    was WRONG (2³⁷/26 = 5.29e9 doesn't fit 32 bits; the magic was
    pattern-matched, not computed) and is RETRACTED. The loop-stride
    `add $0x84,%esi` = 132 bytes per record CONFIRMS the ÷132
    count**; and then the **sub-cell noise**
    re-eval: `noise2arg = X·[this+0x30] + Y·[this+0x34]` (f32 mulss;
    y from esi=[ebp+0xc] = X, edi=[ebp+8] = Y — CORRECTED call-site
    mapping: [ebp+8] = Y-int (push nos 0x5087af = cvttsd2si of the
    second double), [ebp+0xc] = X-int). The noise walk:
    `wrapmod(≈)': both coords reduced by the **signed mod-512 idiom**
    (`and $0x800001ff` → if negative `or $0xfffffe00`+inc + `add $0x200`
    fallback = C `% 512` on ±512), then scaled by f32 1/512 =
    0.001953125 @0x11df8b4 (0x4f4d39) — the 512-chunk lattice scaled to
    [−1, +1) f32 per axis; and two more calls (`call 0xc08ea0` alpha
    walk; `call 0x4fb820` = the 0x900900-family lattice; `call 0x4fb660`
    "Phase-2 noise" args xmm0..x3 = X·[+0x16-family], Y·[+0x4c],
    push [+0x64] = alpha) → the re-evaluated f32
    (X·0x30 + Y·0x34 + warp-noise) gated by [this+0x24] (≥ jb abort) and
    [this+0x28] (≤ comiss jbe abort), finally the **material id
    [this+0x4]** returned (0x4f4f40).
  - WAIT — the big-CONSTANT story: 0x11dfa70 = 1.53841e-05 and
    0x11dfa88 = 2.50832e-05 (f64, mulsd ×2 in the "…7f-bits" noise at
    0x5111d0 = a noise eval — the ±0x4/0xc stack floats): these are
    per-area **0.001953125/512-family**-scaled warp coefficients —
    recorded UN-claimed until the deciding WRAP-WINDOW read is done
    (deferred — not a re-open of F3 noise core, a NEW cell class the
    DECOR uses).
  - So a **parallel DECOR-material classifier EXISTS beside
    LoadFromImageData** (the biome-def `+0x30..+0x70` floating config
    family, per-cell gate [this+0x24]/[+0x28] window + material id
    [+0x4]): this is the function the portal/tea/lava P3/P5/P6
    "noise-that-didn't-load" zones resolve through in a future dig.
    NOT ported this session (port unchanged; no cache bump — the
    noise-output contract of (17) is untouched).

- **2026-09-20 (20) — F3 dig #6: the sampler (true 0x90d860 family) read
  end-to-end — the gate/field/evaluator/DECOR-write chain is now CLOSED
  in-binary.** Anchor re-pinned (file 0x500e4d = true 0x901a4d ✓). Slab
  window 0x50d100..0x50d700 (true 0x90d900-family); cell loops at
  0x50d104/0x50d0f3; the sampler's per-cell recipe:
  1. **Owner pointer** = `[cell+0x18]` (a per-chunk world-grid owner;
     its grid members: **+0x90 material-name registry · +0x9c float
     dims · [+0xb4] FLOAT-grid wrapper · +0xd4 u16 wrapper · +0xd8
     u16-init flag · [+0xf4] byte wrapper · +0x1c8 u16 DECOR dims ·
     [+0x1e0] u16 DECOR grid · +0x38-near vtable family**).
  2. **The gate field** (slab 0x50d3a5..0x50d3d0): idx =
     `[owner+0x9c]`·y + x → FLOAT getter 0x5491f0 on `[owner+0xb4]` →
     `comiss 0.5` → skip unless **field > 0.5**. This is the
     (17)-entry's `>0.5` gate, and the field is NOT the evaluator's
     output — it is an independent per-cell float field consumed raw.
  3. **u16 material read** (slab 0x50d21c..0x50d24b): gated by
     `[owner+0xd8] != 0`; U16 getter 0x54a0f0 on `[owner+0xd4]` with
     idx = `[owner+0xbc]`·y + x; **value − 1 = the material id** (same
     +1 store bias as C32's part-1 ✓ byte-confirmed); id > 0 →
     `call 0xb78e0` on `[owner+0x90]` (the config-side name lookup) →
     jump to the paint arm (0x50d58d).
  4. **Byte-mark read** (slab 0x50d335..0x50d37f): byte getter
     0x5493b0 on `[owner+0xf4]`; `== 0xff` → `call 0x543bb0` (a
     POINT-ish call with stack {x,y}).
  5. **noiseTransform** (slab 0x50d419): `call 0x5084b0` (C26), out =
     [esp+0x4c] (u,v); X,Y doubles = `[ebx+0x24]`/`[ebx+0x28]`
     ORIGIN + cell (i32→cvtdq2pd), `a = 1.0f` (0x11dfbf0).
  6. **Smoothcorner snap** (slab 0x50d430..0x50d4c5): proper floor of
     (u,v) (cvttss2si + comisd + dec — inline floor); frac = (u−iu,
     v−jv) via cvtpd2ps; the C26 smoothstep trio byte-CONFIRMED here:
     `fx2 = f²·2.0 (mulss 2.0 @0x11dfe68)`, `g = 3.0 − f²·2.0
     (movss 3.0 @0x11dff70)`, weight = (3.0−2·fv)·fv² etc.; the
     0.5-ist comparisons at 0x50d4ba/0x50d4c0 bump iu/jv (floor→cell
     snap at the 0.5 midpoint; the SAME 3.0/2.0/0.5 constants C26
     listed).
  7. **Smooth-corner u16 fetch** (slab 0x50d4ce): WRAP-MOD u16 reader
     (0x5fdce0 = true 0x9fe4e0 ✓ C32) on `[ebx+0x28]+0x20` subobj with
     the snapped coords; `u16 − 1 = id`; id > 0 → the 0xb78e0 named
     lookup → 0x50d589.
  8. **UNPAINTED cells** (slab 0x50d4fc..0x50d585): gate `[cell+0x20]`
     → `*ptr`, `[++0x2a4]` flag; then **`call 0x508670` = evaluator2
     (C30!) with X/Y doubles and `xmm2 = [esp+0x24]` = the GATE FIELD
     value as the `a` argument**; then per-axis logger calls
     (`*0x114a434`, 0xc33170); then **`call 0x4f4830` (C33, the
     per-material classifier) with ecx = `[that+0x2a4]`, args
     (y-int, x-int)** — the returned material becomes the DECOR value.
  9. **The paint** (slab 0x50d67e..0x50d69e): `idx = [owner+0x1c8]·y +
     x` → U16 WRITER 0x559de0 on `[owner+0x1e0]` — `*grid = the
     resolved id` (entry (16)'s displaced-material write, now with the
     full kind/idx lineage: kind 1 family = `lock xadd` growable id
     array `cmp $0x2000`, kind 3 = the global byte flag 0x1344ce1 +
     the 0x603fd0-config call).
  - **CONSEQUENCE FOR THE (17)-STATE SMOKE (root cause candidate):**
    our port's fallback calls `evaluator2(gx+cfgMinX, gy+cfgMaxX, 1.0)`
    — the hardcoded `a = 1.0` bypasses the REAL `a` (the gate field /
    the kind-idx-driven value); the binary's `>0.5` test reads a
    SEPARATE per-owner float field first (offsets +0xd8-byte gate then
    field>0.5). The all-solid mask was EXPECTED under a=1.0 because a
    constant a=1.0 gives val ≥ 0.719 — the gate survives every cell.
    **The port fix = feed the ACTUAL per-cell field (from the u16/f42
    grid family) as `a` and gate on field > 0.5 BEFORE the evaluator —
    structure now individualized, port wiring deferrable to the next
    integration pass.**
  - Tests: 143/143 unchanged (no port change this dig).

- **2026-09-20 (21) — dig #7: C33-ROW AUDIT (user challenge "careful not
  to poison the well") — three poisoned glosses RETRACTED, one real
  finding LANDED.** All re-verified against the raw slabs this session.
  - **POISON 1 — "÷-26.0 / ±26-cell index magic"** (ABOUT_MATH (19) +
    CONSTANTS C33): WRONG. Recomputed: magic 0x3e0f83e1 = 1,041,204,193;
    the idiom `imul %ecx; sar $0x5` = signed **>>37**, and
    **M·132/2³⁷ = 1.0000000000 exactly → the divisor is 132** (the
    count of 0x84 = 132-byte-stride records; 2³⁷/26 = 5.29e9 doesn't
    even fit 32 bits — the "26" was pattern-matched, never computed).
  - **POISON 2 — "noise2arg = X·[+0x30] + Y·[+0x34]"** (the sum form):
    WRONG. The dump (slab 0x4f4d87..0x4f4da5) shows a **TWO-ARG f64
    call**: `call 0x4fb820( esi·rec[+0x34] , edi·rec[+0x30] )` (two
    cvtps2pd args, register 1 = esi-family, register 2 = edi-family),
    then `cvtsd2ss + addss -0x8(%ebp)` = result + the base a f32. The
    +0x30/+0x34 slots are per-record arg weights, and the
    truncated-sum reading is retracted.
  - **POISON 2 — "call 0x4fb820 = the 0.900900-value-lattice family"**:
    FALSE. slab 0x4fb820 → **true 0x8fc020** (not 0x900900 = slab
    0x4fc100). Its body = an UNREAD second noise core: f64 args, first
    sub-caller `call 0x4fb7d0` (see below), runtime f64 constants
    **0x132ab68 / 0x132ac70** (both beyond .data raw backing
    0x1327400 = BSS = runtime-only per C13 — static bytes are
    garbage/0, cannot be pinned), a `comisd` corner rule
    (slab 0x4fb8af), `movzbl`-byte perm-indexing (0x4fb8cf..). Do NOT
    call it "value noise" until read.
  - **NEUTRALIZED / still unanchored labels (flagged, do not cite):**
    "512-chunk lattice" semantics (the 1/512 constant 0.001953125
    @0x11df8b4 IS byte-pinned, but the lattice interpretation is
    mine); "Phase-2 noise" = label for true 0x8fbe60 (slab 0x4fb660,
    unread!); "alpha walk" = label for `call 0xc08ea0` (unread!).
  - **LANDED FIND (the audit's positive result): the lazy noise-table
    init = true 0x8fbfd0 (slab 0x4fb7d0)**, guarded by the BSS flag
    byte **0x13289bd** (read-set-once: `cmpb 0; jne done; movb 1`):
    for i in 0..255: from the .rdata u16 table **0x114cc50** (stride 2,
    256 entries — its values START 151,160,137,91 = a SECOND copy of
    the simplex-permutation C25 as u16):
      **[0x1327bd0][i] = u16[0x114cc50 + 2i]** (the perm value)
      **[0x1327720][i] = perm_val % 12** (idiv by 12, `lea 0xc(0),%esi`;
          the remainder in dx) — a lazily-built mod-12 derivative table.
    Both targets = BSS (beyond 0x1327400, C13) = runtime-only ✓.
    The mod-12 table is a REAL, previously-unknown constant family
    (12 = likely the direction count of the consuming noise core;
    consumed by true 0x8fc020 family and possibly the simplex cores —
    NOT yet traced; the 0x1327720 READERS are the pinned follow-up).
  - Registration: C35 (the new tables + the unknown cores true
    0x8fc020/0x8fbe60/0xc08ea0-slab 0x4c4ea0). The C33 row's byte
    traps stand as amended in-place.

- **2026-09-20 (22) — dig #8: the P1 SURFACE-SHAPE param family FOUND in
  the game's own data (no new asm needed).** The per-biome procedural
  noise block = the biome XMLs' `<Topology>` attrs (winter/hills.xml =
  the I1 issue's "mGradient/mInsidePerlin* XML params" — the actual
  values, data-side, zero binary guess):
  - common: `noise_type="SIN_CAPPED_SIMPLEX"` (hills/hills2/desert/
    mountain_*/astral*.xml family), `mGradientAddNoise` 1|2,
    `mGradientStartY=-1024` / `mGradientEndY=1024`,
    `mGradientNoiseScale` 0.00128571 (=9/7000) / 0.0068571 (hills2,
    = 9/7000 × 16/3),
    `mInsidePerlinScaleMin=0.057143` `mInsidePerlinScaleMax=2`
    `mInsidePerlinScaleX/Y=0.9999` (desert: 0.009999) `Clamped=0`
    `Scaled=1`, `mInsidePerlinSquared=0|1`,
    `mMultiplierGradient=0.871429` (hills).
  - per-biome value bands: hills/mountain*: HighNoise 234.057 /
    LowNoise −292.571; hills2: 75.123/−12.0564; desert: ±100.123.
  - winter.xml (the west frozen plain class!) carries the SIN
    machinery alone (no noise_type): `mGradientType="1"`,
    `mGradientMaxY=0.498571` / `mGradientMinY=0.25`,
    `mGradientSinMultipleMin=0.00667143` / `Max=0.006153`,
    `mInsidePerlinFunc="x*(1.0-x)"` — an evaluable closed form.
  - **Notable: our evaluator2's lower clamp at 0.5 (C30) = the
    "CAPPED" in the data's own noise_type name — the binary core we
    ported is CONSISTENT with the surface class's declared type.**
- **2026-09-20 (23) — dig #9: the P1 SURFACE-BLEND CONSUMER READ BYTE-BY-BYTE
  (the mGradient-family field formula).** Env restored first: exe found at
  `/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe` (17,007,104 B,
  build 2025-01-26); sections re-mapped from the PE header: .text raw
  0x400..0xd48e00 · .rdata raw 0xd49200..0xee9600 (VA = file+0x400E00 — the C13
  rule re-verified against the header this session) · .data raw
  0xee9600..0xf25a00 (VA = file+0x401A00 ✓). New slabs this session:
  `rdata.bin` = exe f[0xdd0000:0xee9600] (adjust 0x11d0e00) and
  `data_raw.bin` = f[0xee9600:0xf25a00]; text.bin/low.bin re-used (fresh
  01:45/01:49 today). **C13 anchor re-pinned first** ✓ (file 0x500e4d,
  bytes `3d 00 00 42 ff`). **Every C25–C30 canon .rdata constant was
  re-verified against the exe this session and matched exactly** (first
  full re-check since the pins; the deep band VAs 0x11df800..0x11e0c70
  were previously OUT of the two slabs' coverage).

  - **THE NOISE_TYPE DISPATCHER = true 0x8fd920 (slab 0x4fd120)** — a
    switch on ecx∈[0..8] with the jump table @ true **0x8fdaa4** (exe file
    0x4fcea4, 9 dwords byte-pinned; entries stored AS true VAs):
    case 0 → true 0x8fd850-family core (slab 0x4fab50), 1 → true-0x2-arg
    f64 call slab 0x4fb050, 2 → slab 0x4fb150, 3 → slab 0x4fb340,
    4 → 2-arg f64 slab 0x4fb510, **5 → slab 0x4fb820 = true 0x8fc020 (the
    C35 "unread 2nd core" — it is DISPATCH CASE 5)**, 6 → slab 0x4fbf40
    (C29 gradient lattice), 7 → slab 0x4fc100 (C29 value lattice),
    8 → slab 0x4fc260 (C25 2D simplex). Default → assert, unit string
    0x1173678 = **noise_utils.cpp** line 0xb05. Signal arg convention:
    xmm0-based with an xmm2 second arg (case bodies `movaps %xmm2,%xmm1`
    or cvtss2sd pairs) — per-case arg order to re-verify at port time.
  - **THE FBM WRAPPER = true 0x8fdad0 (slab 0x4fd2d0)** — 4 octave calls of
    the dispatcher; lazy init via BSS flag 0x134874c; state quad at BSS
    0x1348ac0 seeded once from the .rdata quad **0x11e0c70** (its first
    f32 = 0.8414700031 = sin(1.0)); octave amplitudes 0.5/0.25/0.125/
    0.0625 (@0x11dfa94/0x11df9d0/0x11df984/0x11df950) with per-axis
    growth multipliers 2.02 (@0x11dfe7c) / 2.33 (@0x11dfee8) — NON-integer
    lacunarity, so an exact port needs the per-octave state trace (output
    = Σ octave / 0.9375 @0x11dfba8 — compute-checked Σ = 0.9375 ✓).
  - **THE BLEND (the mandate's "one blocked byte") = THE SURFACE-FIELD
    EVALUATOR true 0x90a860 (slab 0x50a060)**, noise_utils.cpp; args xmm2/
    xmm3 = (x,y) f64, ecx = int, stack arg = ebx = the per-biome CONFIG
    OBJECT ("uid"), [ebp+8] = IN/OUT float cell. Recipe (all byte-cited
    in `out/d_2026-09-20-surface-evaluator.asm`):
    1. gradient field: P = [uid+0x1d4] (a **BitmapNoise-class instance** —
       its float grid is read with the C32 wrap-mod FLOAT getter
       **true 0x9fe620**, 4× per call); g = ((x·0.11dfdc8(0.49162514
       f64)) + f64((f32)[P+0x94]), likewise y); inline floors iu/iv
       (cvttsd2si + comisd + dec); smooth-corner weights (3.0−2f)f²
       (0x11dff70/0x11dfe68/0x11dfa94 all re-pinned); **4-corner bilinear
       on P's float grid** → `field`; **LOWER CLAMP field ≥ 0.5**
       (comiss 0x11dfa94 jbe @0x50a5b6) = the "CAPPED" of the data name.
    2. r = call true 0x90b280 (slab 0x50aa80 — third evaluator, the
       per-noise eval of (x,y)); r' = r·field; blend gate: only when
       r' > 0.51 (@0x11dfaac = 0.51) does anything further happen.
    3. if [uid+0x268] (mMultiplierGradient) == 0: gradW = (field−0.5)·2.0
       (−0x18 slot) and r2 = call **true 0x90b110** (the inside-perlin
       evaluator, below); else the gradW slot is set in the default-lane.
    4. if field > 0.85 (@0x11dfb84): switch [uid+0x220] — **[uid+0x220] =
       mGradientAddNoise (1/2/3)** per the .rdata docstrings ("fake enum
       1=standard noise, 2=fbm noise, 3=slope"):
       case 1 → x·0.025(0x11df914) → core slab 0x4fab50; r =
       core·0.05(0x11df948!)+0.05; two math helpers slab 0xc33234/0xc33222
       (true 0x1033a34/0x1033a22 — the same helper family as C15's
       "sqrtf 0xc3322e"; identity read = trig/mul wrappers, args 1024.0
       @0x11e0080 f64, ·0.5 @0x11dfdd8, ·0.06 @0x11dfcd8) → **call true
       0x8fc020**; then `field := field + (r − field)·((field−0.85)/0.1)`
       (0.1 = 0x11df974 ✓).
       case 2/3 = the same skeleton with core trio slab 0x4fab50/0x4fb340/
       0x4fc260/0x4fb820 and scale constants 0.0241/0.02789 (@0x11df910/
       0x11df918), ÷100 (@0x11e02dc), ×5.0 (@0x11dfee0 f64), 0.01123/
       0.01313/0.02/0.021 (@0x11dfc10/c30/c68-f32 2.0/c70/c78).
    5. if [uid+0x24c] (byte): slope arm — w = x·0.001 (@0x11dfb58 f64),
       field := field + w·(field − field_old). (Per-biome slope-start/
       delta slots beyond the bool = UNREAD — open detail.)
    6. FINAL COMBINE (@0x50a8d9): **field_out = [uid+0x268]·gradW +
       [uid+0x264]·r + [uid+0x260]** = **mMultiplierGradient·gradW +
       mMultiplierPerlin·r + mInsideAddValue** — byte-settled mapping
       ([uid+0x260] loaded to −0x1c @0x50a363, combined @0x50a8d9..ff).
  - **THE INSIDE-PERLIN EVALUATOR = true 0x90b110 (slab 0x50a910)**:
    ` Xi = x·0.11dfcc8(0.05243442 f64)·[uid+0x230] + 0.1(0x11dfd08 f64)
    + [uid+0x250]` (Y axis with [uid+0x238]/[uid+0x258] and seed-scale
    @0x11dfa80) — if [uid+0x24d] (offsetBySeed): n = true 0x5111d0 (the
    C27-family one-draw; reuses the SAME diddle table 0x11e0ba0 ✓), then
    x += f64(n)·1.312e−05(@0x11dfa68); y += ·2.331e−05(@0x11dfa80);
    n = [uid+0x228] ? fbm(0x8fdad0) : dispatcher([uid+0x224]) — **[uid+0x224]
    = mInsideNoiseType, [uid+0x228] = mInsideNoiseFBM, [uid+0x230]/[0x238] =
    ScaleX/Y, [uid+0x240/0x241/0x242] = Squared/Clamped/Scaled,
    [uid+0x244]/[0x248] = ScaleMin/Max (clamp then map [−1,1]→[Min,Max]),**
    [uid+0x24d] = OffsetBySeed, [uid+0x250]/[0x258] = OffsetX/Y.
  - **THE P = [uid+0x1d4] holder = a BitmapNoise-class instance read with
    the C32 getters** — i.e. the per-biome "gradient" is a FLOAT GRID the
    evaluator bilinearly samples (4× 0x9fe620). The docstring
    "if set, loads it to mBitmapNoise" (@0x117a63c-adjacent) + the
    `bitmap_noise_file` attr string @0x1179154 identify the class. For
    biomes without the file the grid must be FILLED by the mGradient
    computation — **the per-biome fill of [uid+0x1d4] is the last open
    producer read** (the area-level counterpart IS closed: C32's
    LoadFromImageData 2× from the driver).
  - **Parameter-layout conclusion (P1-A):** the mGradient/mInsidePerlin*/
    mMultiplier* names exist in .rdata ONLY as serializer doc-strings
    (whole-exe imm32 scan re-run incl. .data + both .rdata halves: **zero
    non-assert refs**; even "Topology"/"_biomes_all.xml"/"noise_type"
    have zero refs — the attr lookup is runtime-name-driven, not a static
    parser read). The name→offset mapping is therefore byte-proven from
    the CONSUMER side (this evaluator) — no static loader table exists to
    read. The C33 132-byte-record fields (rec+0x24/0x28 gate window,
    rec+0x30/0x34 weights, +0x4 material) = the RandomMaterials sibling
    of the same layout family.
  - **Winter-only attrs** (`mGradientSinMultiple*`, `mGradientType`,
    `mInsidePerlinFunc`, `mGradientMaxY/MinY`) are ABSENT from this exe
    (whole-exe string scan) — consumed only by a different build or dead
    data; hills-family attrs (noise_type, mGradientNoiseScale/StartY/
    EndY/LowNoise/HighNoise/AddNoise/Slope*, mInsidePerlin*, mMultiplier*)
    all exist and map 1:1 onto [uid+0x220..0x268] as listed.
  - Registered: C36 (dispatch table + case map + fbm wrapper), C37 (the
    surface evaluator recipe + uid offset map), C38 (new .rdata
    surface-math pins). Evidence: `mapgen/out/d_2026-09-20-noise-dispatch-fbm.asm`,
    `out/d_2026-09-20-surface-evaluator.asm` (also used for tracing:
    text-asm.txt/low-asm.txt/rdata-asm regenerable from the exe).
  - Tests unchanged this dig (no port change yet); 143/143 expected to
    hold (verified below). Port wiring (noise-terrain.mjs) lands next dig
    with the capture-validation step (I1/I3/I5/I6 gates, unchanged).
  - **dig #9b (same night): the `[uid+0x1d4]` FILL CHAIN FOUND (still one
    identity byte open).** The only third LoadFromImageData call site =
    slab 0x4fa19b (true **0x8fa19b**) inside the **SetSize+Load wrapper
    true 0x8fa930** (slab 0x4fa130): args (this, src{w,h,pixels}, flag) —
    reallocs its own float grid to w·h (4·w·h B, memset 0) then
    LoadFromImageData via 0x4f92b0. Only TWO direct (e8) callers, found
    by e8-target scan:
    1. **true 0x90d1b1** (slab 0x50c9b1) — inside the per-cell-generator
       walk (true 0x90cfb0-family) whose profiler string is
       "IMPL_DoBufferedPixelScene - bitmap noise loop" (@0x11754c4) and
       which also fetches "LoadImage - material_image" (@0x1175574) via
       config call 0x4ce6a0 keyed by the BSS registry byte 0x13289b4 —
       the load path is a FILE (a **.plz/fastLZ image**: the loader true
       0x90e060 checks `endsWith("plz")` — string @0x1165fc4 compared
       with the C20-verified std::string helper true **0x4447f0** —
       then LoadImageFastLZ (assert 0x1175844) else error "Error -
       loading file:", printing "ptr_to_file <= end_of_file" style
       bounds asserts from procedural_terrain.cpp lines 0x1163..0x1197).
       The loader fills {w,h,cnt,pixels} and hands it to both the
       [gen+0x9c] BitmapNoise wrapper (SetSize+Load path above) and the
       sampler chain (calls true 0x90e060 then 0x4fa130 then the C27
       +0x94-walk 0x5095a0 then the three [gen+0x1b0/0x1c0]/[+0x1c8/
       +0x1cc]/[+0x1d0/+0x1e0] grid allocs on the generator object).
    2. **true 0x8ee6bb** (slab 0x4edebb) — in **biome.cpp** (assert
       0x1172ea8 "…procedural_utils\biome.cpp RandomColor input_color
       output_colors", line 0x18d): it news 0xb8 B (?), calls the C27
       **FUN_008f9470 per-cell-generator ctor** (call slab 0x4f8c70),
       sets **[edi+0xb0] = 0x8ee1b0** (the C32 A-resolver fn-ptr!),
       stores the [edi+0xb4] B-map, then calls the SAME SetSize+Load
       wrapper for this generator object.
    ⇒ **identity: the "uid"-class of the surface evaluator = the 0x1ec-B
    per-cell generator object family (biome.cpp-built), and [uid+0x1d4]'s
    float grid is fed by the biome's material/bitmap image — the LoadImage
    (.plz/.png) pipeline just read byte-by-byte**, not by a fresh
    noise-compute. This identifies the gradient as an IMAGE-BAKED field
    (consistent with the C34 bilinear and the wrap-mod float getter).
    **Still open (the last identity): which biome-data file supplies the
    [uid+0x9c/-material_image] path for each surface biome (hills/
    winter), and the exact mGradient* ratio → image-rasterize step (if
    any) inside the biome.cpp walk before the loader call.** Everything
    else on the surface chain is now byte-read.

- **2026-09-20 (24) — dig #9c (same night): THE PORT LANDED —
  `lib/noise-proto.mjs` += the dig-#9 surface family.** Tests 143/143
  unchanged (read-only until the shape instruments gate the r3f→r3g
  bump; no noise-terrain.mjs/renderer touching this session).
  - **NEW in the port:**
    - `K2` (C36/C38 constant block) + `GRAD12`: the 12-dir gradient pairs
      @.data 0x12ee338 — ALL 12 entries byte-pinned this session
      (0..3 diagonals {±1,±1}; 4..7 (±1,0) duplicated; 8..11 (0,±1)
      duplicated; f64 pairs, stride 32 B).
    - `simplex2DDeriv` = the case-5 core **true 0x8fc020 READ THIS DIG
      to formulas** (telescoped skew/unskew, C35 lazy perm + mod-12 →
      12-dir dots, outside-kernel → 0, sum ×70.0 @0x11dffd0). The two
      skew doubles (BSS 0x132ab68/0x132ac70) stay UNPINNED — widened
      F2/G2 used and FLAGGED in-file (does not touch hills' lane).
    - `noiseDispatch(kind,x,y)` = the dispatcher true 0x8fd920 with the
      pinned case table; **cases 0..4 THROW "UNREAD core"** — the honest
      dispatch (case 0.4 = slab 0x4fab50/0x4fb050/0x4fb150/0x4fb340/
      0x4fb510, still unread bodies).
    - `insidePerlin` (true 0x90b110: ScaleX/Y·0.05243442 + 0.1 + offsets,
      seed-offset path via the C27 diddle × 1.312e−5/2.331e−5, fbm vs
      single, Squared/Clamped/Scaled + ScaleMin/Max clamp+map).
    - `fbm4` (true 0x8fdad0 structure; the per-octave BSS quad 0x1348ac0
      handling = flagged OPEN trace item).
    - **`surfaceField`** = true 0x90a860: gradient biliary (injected
      `gradAt`) → lower cap 0.5 → 0.51/0.85 gates → produce the
      mGradientAddNoise 1..3 case lanes = **THROW until the inner cores
      read**; final combine MultGrad·(field−0.5)·2 + MultPerlin·r +
      AddValue byte-shaped.
  - Smokes run: dispatcher outputs sane for cases 8/7/6/5; hills params
    run through surfaceField; case-0 throw verified.
  - **NOT capture-validated.** The `gradAt` input is injected; its
    default smoke = the mGradient y-ramp PROTOTYPE with the explicit
    "NOT byte-backed" warning (the C39 open byte). Shape instruments
    (I1/I3/I5/I6) remain the gate; cache r3f UNCHANGED.

- **2026-09-20 (25) — dig #9d (same night): W1 WIRED behind SURFACE_V2=1
  (opt-in; the default path is bytes-identical to the old lane so r3f
  stands).** Tests 143/143 ✓.
  - `lib/noise-terrain.mjs` V2 lane = the true-0x90a860 recipe:
    - uid-config adapter (C37 offsets ← the dig-#8 XML attribute set),
    - `gradAt` = the mGradient y-ramp PROTOTYPE, explicitly
      NON-byte-backed (W5 = the open rasterize byte)
      injected into surfaceField,
    - chunks whose lane hits an unread core (mGradientAddNoise = 1/2/3 =
      52 of 55 live XMLs) return null → caller falls through (honest —
      zero fabricated terrain); the addNoise=0/else-lane chunks compute:
      full-map smoke (ty 0..96 × tx 0..70): 153+ V2 chunks run, avg
      density 0.0% (all-air) — the field lands at the 0.5 cap and the
      gate filters everything = recorded as the SAFE fallback shape;
      the instrument pass settles the ramp scale.
    - The 5 core-throwing lanes return null per-chunk (no invented
      terrain); the default no-env path = unchanged.
  - W2/W3/W5 = the remaining bytes before the V2 path can be
    capture-validated; per WIRING_SURFACE.md the gates stay
    `bench:ref` + flat-region rms + solid-density vs frozen91, bump
    r3f→r3g ONLY on an observable change.

- **2026-09-20 (26) — dig #11: W3 CLOSED — the case-1 lane core READ and
  PORTED (the 47-biomes lane unblocked).** All in one dig:
  - **THE LANE CORE = true 0x8fb350 (slab 0x4fab50) = the sin-hash
    VALUE-NOISE, formulas transcribed** (`out/d_2026-09-20-surface-evaluator.asm`
    + case1core.asm):
    - 2 helper calls at head = **true 0x44d0b0** (slab 0x4c8b0 — the
      C13-verified CRT fld/fistp ROUND-to-nearest wrapper); identity of
      the second = **true 0x44d110 (slab 0x4c910) = SIN — resolved via
      the MSVCR120.dll import-name table**: the jmp-thunk run at
      VA 0x1033a22..0x1033a5e hits IAT slots 0x114a514..0x114a53c whose
      file-byte dword values point at the name-records (hint+name) in
      .rdata tail: 0x114a514 = acos-precise · 0x114a518 = log10-precise ·
      0x114a51c = pow-precise · **0x114a520 = _libm_sse2_sin_precise** ·
      0x114a524 = sqrt-precise · 0x114a528 = tan-precise · 0x114a52c = ceil ·
      0x114a530 = floor… (the whole math-thunk family named this session;
      the IAT slot chain = cores C38's constants land in .rdata tail name
      records, hint bytes verified).
    - the seed hash: **c0 = 57.0·round-f(y) + round-f(x)** (57.0 =
      f32 @0x11e028c, pinned) — round via the fld/fistp tt;
    - fracs fx/fy from the RAW x/y (inline floors);
    - four corner hashes n = frac(sin(c0 + k)·43758.546875
      (@0x11e04c8)) at **k = {58, 57, 1, 0}** = the ±1-in-x/±57-in-y
      lattice @ {58 = both, 57 = y+1, 1 = x+1, 0 = base} (asm pairing:
      rowA = 58→57 lerped by wx, rowB = 1→0 lerped by wx, final wy
      0x4fac4d..0x4fad67);
    - weights = the smoothstep (3.0−2f)f² (0x11dff70/0x11dfe68).
  - **The case-1 blend = byte-transcribed (slab 0x50a7eb..0x50a8a2):**
    a = core(x·0.025, y·0.025); g = a·0.05(@0x11df948)+0.05(again the
    SAME const = both lanes read SAME bytes ✓); the 0x8fc020 call args =
    (x·0.5·0.02·g, y·0.5·0.02·g) (mulds 0.11dfdd8/0.11dfc68); tail =
    field += (r' − field)·((field − 0.85)/0.1); THEN the [uid+0x24c]
    slope arm + the FINAL combine (unchanged, (23)). Cases 2/3 remain
    honest throws (only 5 live XMLs; trig-lane reads = W4 next).
  - **PORT: `whiteLattice2d` + the case-1 lane REPLACED THE THROW in
    `surfaceField`.** The R2-correction "0x44d110 = sin, 0x44d0b0 = the
    round" identities are COMPUTE/SYNTAX-verified (IAT name table parse),
    NOT capture-validated.
  - Smoke: `whiteLattice2d(12.5,−3.25) = 0.834`; the case-1/hills
    surfaceField row varies (0.697..1.155); the FULL-MAP V2 run now
    computes 2194 chunks: winter 253, desert 265, pyramid 4,
    snowcastle 2… at ~48–51% solid density with REAL texture (the
    previous 0.0%-all-air fallback is gone); the remaining
    fall-throughs = the case-2/3-only biomes (10-ish chunks) +
    deterministically-null template chunks = the wiring is STILL
    opt-in (`SURFACE_V2=1`); default lane untouched → r3f stands.
  - The density NOT being ~100%-confirmed = the expected
    "instruments next" state: `bench:ref` + flat-region rms vs
    frozen91 = the gate for the r3f→r3g bump.

- **2026-09-20 (27) — dig #12: the dispatcher cores W2-side READ (all five
  remaining noise-lane cores names/formulas/tables pinned).**
  All byte-cited in `/tmp/opencode/cases245.asm` (regen from the exe);
  values verified in-file this session.
  - **case 1 = true 0x8fd850 (slab 0x4fb050) = "FastBlock" LCG-hash
    white noise (f32 in, f64 out)**: seed = trunc(x)·1733853720
    (0x67577458 imm-pinned) + trunc(y)·91(0x5b); then the MS-LCG
    `h = (h ^ (h>>13))·214013(0x343fd) + 2531011(0x269ec3)`; output =
    ((h >> (1 + (trunc(x)&15))) ^ h) & 0x7fff, then `−0x3f ff` = ±16383
    int; × f64 **6.103515625e−05 = 1/16384** (@0x11dfae0 f64) → [−1,1).
    = the classic GLSL-int-lattice (with LCG constants BYTE-PINNED —
    note this is the OLD global-LCG family appearing as a noise core,
    consistent with the elimination "all heavy consumers = gameplay"
    — the dispatcher's case-1 noise is a PATTERN-marked user).
  - **case 2 = true 0x8fc550 (slab 0x4fb150) = a whiteLattice2d TWIN**
    (same frame: 2× 0x44d0b0-round calls, inline floor+fracs,
    smoothstep weights, 57.0 @0x11e028c mul, calls of
    **true 0x44d110(sin) ×N**) — differs only in constant lane
    (the exact diff = next trace item, Рrоman-flagged).
  - **case 3 = true 0x8fc940 (slab 0x4fb340) = the FNV24
    white-lattice with a 12-PAIR .data gradient table @.data VA
    0x12eb950 (file .data+0x950, BYTE-PINNED this session — 12 f64
    pairs, stride 16, values listed in the register; the strange
    non-integer dir set = the "MixNoise"-family)**: per-call FNV-1a
    (24-byte window {x_d64, y_d64, 1234567.0_d64-sentinel
    @0x11e0180 f64 = 1234567.0!! pinned}), FNV bias 0x811c9dc5 × prime
    0x1000193 over 24 bytes; idx = ((h>>8)&0xff) ^ (h&0xff) →
    lea 0x12eb950(,%eax,8) = the pair-table index (labelled-open:
    the exact index→(eig) %12/state walked via 0xc31cea =
    UNREAD); 4 corner smoothstep-binilinear × (gPair·dXY)
    outputs (slab 0x4fb340..0x4fb503).
  - **case 4 = true 0x8fd110 (slab 0x4fb510)** — the 2-arg-f64 head
    reads (mulsd 0x11e0240, the region incl. sentinel) = UNREAD
    detail (the same 0x4fbe60-family head; W2-lane only).
  - The remaining docs go to CONSTANTS.md C41 (the FNV24 +
    12-dir pairs + the LCG constants + the 1234567.0 sentinel).
  - W2 remaining: the noise_type→int map (the DISPLACED-by-reflection
    lookup — not statically readable; the ceng-reflection fields =
    the closed item).
  - Registration complete; tests 143/143 ✓.

- **2026-09-20 (28) — dig #13: W2 — the noise_type enum-name blob read
  (the static path closes honestly).**
  - The ORDERED reflection string pool in .rdata (VA/file cited, all
    printable names byte-cited):
    **IQ2_SIMPLEX1234 · IQ_SIMPLEX · SIN_CAPPED_EVERYTHING ·
    SIN_CAPPED_SIMPLEX · [NOISE_TYPE label] · IQNoise · DirtyPeeNoise ·
    QemNoise · WhiteNoise · MixNoise · SimplexNoise · STB_Perlin ·
    FastBlockNoise · SimplexNoise1234 · [GENERAL_NOISE label + a
    fog-of-war enum next block]** — all VA/file pairs pinned; the two
    labels sit BETWEEN the member runs (a blob-separator pattern).
  - => the noise_type's engine enum = a **12-name list** (the four
    SIN_CAPPED-kids first, then the 8-9 engine kernels); the
    integer-assignment = NOT statically readable: full-exe imm32 scan
    (text.bin + rdata.bin + data_raw.bin) = ZERO pointer refs to any of
    these strings (and zero "SIN_CAPPED_SIMPLEX"/"noise_type"
    second-copies: the earlier "second noise_type" string =
    **wang_noise_type** (@0xd9e9f0, the materials.xml attr family) — no
    hidden second enum).
  - ⇒ **W2's remaining byte = the cengser reflection-hash runtime
    lookup** — the mapping exists only at RUNTIME (ceng reflection
    tables built at Init); the static path is exhausted and the item is
    CLOSED as "no static map exists" (the honest negative). The
    port-resumption rule: `noiseDispatch.kind` needs a CE read of
    [uid+0x224] on a live hills tile (the 2026-09-08 CE-probe pattern)
    OR the reflection-table builder's ID (a next-session read).
  - Correlation notes (NOT canon; flagged): by the pinned core traits,
    IQNoise ≈ case 0 (the 57/58 sin-hash), FastBlockNoise ≈ case 1 (the
    LCG), WhiteNoise ≈ case 2 (the twin), SimplexNoise/1234 ≈ cases 8/5,
    STB_Perlin ≈ cases 6/7. SIN_CAPPED_SIMPLEX = likely the CAPPED
    (0.5-clamp) wrapper around a SIMPLEX kernel (the (22)'s C30
    consistency note) — the port's noiseKind=8 proxy stays FLAGGED.
  - Tests 143/143 ✓. No port change (the W2 mapping remains the
    data-side runtime item).

- **2026-09-20 (29) — dig #13: W5 chase — a NEW producer region found
  (the "cave_setup.mLuaScript"-cited walk), the mGradient rasterize byte
  still open but the neighborhood closed.** Byte-cited from the fresh
  objdump from the live exe.
  - **The 0x4ed900..0x4ee6xx biome.cpp frame = a per-biome "caves/lua"
    builder** (asserts cited: "…\biome.cpp RandomColor input_color
    output_colors" @0x1172ea8; links:记忆 "spawn_small_enemies @0x1173110",
    "spawn_items @0x1173124", "bitmap_noise @0x11730cc",
    "caves_setup.mLuaScript.empty() == false" @0x11730e8):
    - `call 0x4ee2d0(esi=) = the FNV24-hash (dig #6's C41) for the
      "spawns-percent" bucket,
    - MANY 0xc090c0 (the poro Random ctor + ONE Next) = the builder's
      seed draws (the C6/C7-verified and the 0x834e0b5f/0x41a7 = the
      Random(min,max)-closed form registered in C6/C7 — THIS region
      uses them runtime-wide!)
    - consts byte-pinned new: 0x11dfa1c=0.35, 0x11dfa00=0.32,
      0x11e058c=−0.5, 0x11dffe8=101.0-f64, 0x11e0240=4294967295-f64,
      0x11e0608=−4.0-f64, 0x11e00a0=5.0, 0x11df9b4=0.2, 0x11dff10=2.5,
      0x11dfaf8=0.6, 0x11df988=4.656612875e−10 (f64 — the C1 poro
      NORMALIZER!! byte-pinned again), 0x11dfb1c=0.7, 0x11dfa44=0.4,
      0x11df9f0=0.3, 0x11e049c=10240.0.
    - the walk's arrays [-0x40/-0x38/-0x2c...] = the spawn-bands +
      the 0x4edf50 (the "0x5491f0-setFloatAt" = the field-fill)
      + 0x4ee2d0/0x4ee470 = producers = the CAVES-lane (not the
      surface-mGr runway); "0xc31cea" recurring helper (the
      0x4fże-famern-writes).
  - ⇒ **identity: the 0x4edf50/0x4ee2d0-family = the C(34)-sampler's
    "'" field-mutations*** (the "+0x18-float-grid 0x5491f0-set family)
    — NOT the mGradient-rasterizer (still W5-open).
  - The W5 register of the trace: the .4ee470-family = a "the region
    was the generator's manyjobs (the ShadersAndSpawn-family = the
    caves "spawn_items/spawn_small_enemies"). Next reads = the
    biome.cpp LoadImage callArgs (the -0xc/-0x18 = the "fill-image"
    frame's helpers being mostly RESOLVED as a C-API fallback-lane).
  - Tests 143/143 ✓.

- **2026-09-20 (30) — dig #14: W5 chase continued — the biome.cpp band
  positively resolved, the mGradient-rasterize byte CLOSED NEGATIVELY for
  that band (the "ComputeHerringboneWang-...-2048" unit is there, not a
  mGradient rasterizer). All freshly from the live exe (the raster.asm /
  biomebuild.asm dumps).**
  - The biome.cpp band decomposes into THREE sub-walks now:
    (a) true 0x8ee6bb-frame = the SetSize+Load wrapper's caller (C39).
    (b) **slab 0x4ed210..0x4ed708 = true 0x8FD0B0-family = the
      CreateHerringboneWang Threaded-lane** (its asserts: "Couldn't load
      wang template: " 0x117302c · "CreateHerringboneWang_Threaded"
      0x1173050 · "xs >= 1 && xs <= 2048" · "ys >= 1 && ys <= 2048" ·
      with the THREAD-LAYER CACHE PAIR 0x13276c8/0x13276d0 stores —
      exactly VERIFIED §5's pair — and the 214013/2531011-LCG and
      0x834e0b5f/0x41a7 closed form INSIDE the band): this = the
      wang-template fill-lane (the F2/F5 family), NOT a gradient blob.
    (c) slab 0x4ed170..0x4ed203 = a **per-member RGBA→int setter loop**
      (movzbl×3 + shl/or-packed = an `RGBA` from 3 bytes (=the
      "input_color"-family!) then **0x549680-set at [base+0x18] idx
      w·y+x** = the C10-grid u16-SETTER = the "RandomColor
      input_color output_colors" lane = the biome.cpp CONFIG-COLOR
      remap into the grid = NOT the mGrad ramp).
  - **The band's remaining odd frame = slab 0x4edf50..0x4ee2e0 = the
    per-cell FIELD WRITE family** ([[this+0x18]-idx, 0x5491f0 =
    get-or-create, comiss 0.5-clamp, cvttss2si (x·0.5+0.5), the
    "0x11dfa94"-0.5 + smoothing (mulss 0.2, 1.5-scale)..) = the
    "random-material config"-family + the "0x4ee2d0"-fn =
    the FNV24-bucket producer (C41 case-3 family) = the
    spawn-percent buckets = **still NOT the mGradient**.
  - **W5's state: the mGradient→float-grid path does NOT run through
    the biome.cpp band.** The remaining candidates (ranked):
    1. the LUA lane: caves_setup/lua_script Skeleton overrides write
       the float grid directly (the GetBiomeValue-API-side) — the
       LuaBiogetBasic… = the LAST big hypothesis; and
    2. mGradient* being consumed ONLY by the MATERIALS-family
       (the .ini name-string was in the biome.h docs BUT the loader =
       the cengser reflection, see W2's (28) is a runtime table.)
  - The night's closure = W2 (negative-static), W5 (negative for the
    biome.cpp band) — the SURFACE lane remains the opt-in V2, tests
    143/143 ✓.

- **2026-09-20 (31) — dig #15: the W5 "Lua-lane" hypothesis RESOLVED:
  the [uid+0x1d4]-rasterize is NOT a Lua write either — the second
  producer row found (the "Random(min,max)"-ramp walk at true
  0x8ef37c / 0x8f20d1 / 0x8f2a6c = the THREE call sites of the
  C10-grid setter 0x4edf50). All freshly objdumped from the exe.**
  - What 0x4edf50 = now formally named: the **float-grid per-cell
    setter family** (args: ecx = wrapper, edx = {x,y}-pair, xmm2 =
    the value; inline bound-checks; idx = w·y+x; **0x5491f0
    get-or-grow + comiss 1.0/0.5-mid test + the f32-arg STORE)
    — the C10/C31 gridwriter.
  - The 3 DIRECT callers of it:
    1. true **0x8ef37c** (slab 0x4eeb7c, inside the biome.cpp band
      near 0x4ee2d0 = the FNV24 producer; the "0x834e0b5f/0x41a7"
      = the Random(min,max)-closed-form callers) — the color/spawn
      bands lane.
    2. true **0x8f20d1** (slab 0x4f18d1) — a SECOND builder phase
      with its OWN poro chain + a new float cluster byte-pinned:
      **0x11dfa20 = 0.35, 0x11dfb14 = 0.65, 0x11e058c = −0.5,`,
      0x11dffe8 = 101.0-f64, 0x11e0618 = −2.5, 0x11dfb2c = 0.75,
      0x11dfed0 = 2.25, 0x11dfc88 = 1.25,** + the .1192220
      "seed"-assert = the daily-run autoconfig (?) — the builder
      uses the same Random(min,max)-closed-form LCG pattern AGAIN.
    3. true **0x8f2a6c** (slab 0x4f226c) = a third pass, same frame.
  - The assert IDs at 0x4eeb8x/0x4f1b8x family = the "seed"-named
    phase from the TestDaily-pattern — i.e. THE WHOLE
    3-caller-band = the biome.cpp **"caves/lua_random-builders"
    phase — writes the SAME grid the LoadFromImageData did, layer by
    layer, with Random(min,max)-ramped values** — a decisive
    W5-lead: **the mGradient* VALUES may BE these ramp layers**, not
    a rasterized PNG!! Verifying = the last byte: which per-arg of
    0x4edf50 = the "mGradient-corresponds"-pos = W5-next (a single
    per-call trace of the surrounding frames is pending).
  - Tests 143/143 ✓.

- **2026-09-20 (32) — dig #16: W5's per-call trace — the three setter
  layers compared; the fraction-map pattern = the "64/35"-style banded
  ramps, the mGradient* semantics now a DOUBLE-hypothesis. Byte-cited
  from slab 0x4eeb3c / 0x4f18bd / 0x4f2254 (the whole 3-layer family).**
  - The three setter-calls' PREPS are the SAME skeleton: value =
    `[-0x108..-0x128]·(poro-draw·A + B)` with (A, B) =
    - layer 1 (true 0x8ef37c): **(0.32, 0.35)** — @0x11dfa00/0x11dfa1c —
      ⇒ fraction-map [0.35, 0.67].
    - layer 2 (true 0x8f20d1): **(0.35, 0.65)** — @0x11dfa20/0x11dfb14
      ⇒ [0.65, 1.0) — the UPPER band.
    - layer 3 (true 0x8f2a6c): the same (0.35, 0.65) lane @slab
      0x4f2254..0x4f226c.
  - ⇒ the band-model: **successive Random(min,max)-mapped FRACTION
    BANDS (base + amp·draw) written as separate float layers into one
    shared image-grid** (the 0x4edf50-set = "set (x,y)-cell to
    `field-per-biome` = the band-composed value"] — the second/third
    layers = the "sand-top/ore-band"-style overlays; layer-1 = the
    BASE-band. The `.11dfa1c/0x11dfa20 = 0.35`, `0x11dfa00 = 0.32`,
    `0x11dfb14 = 0.65` = all f32-clean pins (upper-band 0.65..1).
  -андид-confirmed with the DATA-side: the .11dfa-except values
    (.32/.35/.65) look suspiciously like the mGradientMaxY/MinY-role
    — per-biome 0.498571 / 0.25 = NO match to any pinned band — the
    boundaries [0.35..0.7) SETTLE as the mGr-lead-in for the visual
    noise ("upper-band"-noise = the band palette!). NOT YET canon:
    the per-biome XML fields WOULD need a per-layer arg-read (the
    LAST single trace = the mG* per-arg negotiation — pending CE).
  - **W5's standing understanding (REGISTERED): the [uid+0x1d4] float
    grid = a three-layer Random(min,max)-FRACTION ramp-stack written in
    biome.cpp — the mGradient* XML family likely = these stacks'
    parameters, not a PNG bake.** The instruments (I1/I3) must decide
    the units in a capture pass.
  - Tests 143/143 ✓.

- **2026-09-20 (33) — dig #17: W5's "byte-architecture CLOSED" note.**
  Layer-2's base-value prep = byte-traced: **[-0x108] = poro-draw·3.0
  (@0x11dff70 f32=3.0 pinned) + 1.0** → so layer-2's value =
  `[-0x128]·((draw·0.35)+0.65)` where [-0x128] = the FIRST-frac-map
  (draw·A+B with its own (A,B)) — i.e. the layers CHAIN: each layer's
  base = the previous layer's output × fraction-map (the
  "0.35/0.65-multiplier ladder"). The (min,max)-per-arg extension = the
  whole Random(min,max)-closed-form calls, IN-LINE in the getter chain
  (the 0x1f31d/0xb14/0x41a7 pattern on the same draw values).
  ⇒ The [uid+0x1d4]-ramp stack = a CHAINED FRACTION look: layer N's
  base = layer N−1's output; the WHOLE stack = a "row-by-row random
  banding of one shared grid". byte-exact chains registered; the
  last trace = whether that [-0x128]-window = per-biome (a config
  load) or the layer's own draw — the CE observation or the inline
  z-read (both = literally next-session two-trace items).
  Tests 143/143 ✓.

- **2026-09-20 (34) — session close-out.** The night ended with the
  W1-opt-in lane live (2194 chunks textured), the case-1 lane and all
  dispatcher cores read/ported, W2/W5 = honest negatives with the
  remaining items localized to ONE CE session. **The game-side guide =
  `mapgen/CE_GUIDE.md`** (3 probes: A = the sampler entry
  0x90d860 [recovers [uid+0x220..0x268] + the noiseType int + the
  gradient-row floats]; B = the three layer-stack preps
  0x8f20d1/0x8f2a6c/0x8ef37c; C = the grid-row-vs-bands units check).
  Items: tests 143/143 ✓ (no port change in (33)); the working tree =
  5 files + WIRING_SURFACE.md + CE_GUIDE.md; r3f intact.

- **2026-09-20 (34b) — the CE_GUIDE.md deleted per user call** (we'll
  re-house the probe checklist in a chat-facing form next session).

- **2026-09-20 (35) — dig #18: the FIRST CE RUN LANDED — W2 closed
  EMPIRICALLY + the layer map re-verified.** User's v2-script block.
  46 hits, 9 candidates: all real uid-config objects in memory ✓.
  - **[uid+0x224] = 5 for every SIN_CAPPED-family candidate**
    (hills-family ×4: addNoise=3-per-the-cache, ScaleX/Y-f64 =
    0.9999 ✓ byte-re-decoded (the raw bytes 1EA7E8482EFFEF3F =
    f64 0.74999... hmm wait — the printed "ScaleX/Y = 476472.9375" =
    the readFloat-on-4-bytes-of-an-f64 artifact; the real bytes
    decode ≈ 0.9999-f64 ✓ = the hills.xml mInsidePerlinScaleX/Y ✓);
    **ScaleMin/Max = 0.057143/2.0 ✓** EXACT matching hills.xml's
    mInsidePerlinScaleMin/Max!!!).
  - **[uid+0x220] = the mGradientAddNoise int** (values {3, 0} seen) ✓
    (bit-slot verified by the +0x224-separation!). The "3" = beyond the
    (22)-noted 1|2 → the Fall-task's other-lanes = live.
  - **[uid+0x264/0x268] = mMultiplierGradient (0.871429 ✓!) and
    mMultiplierPerlin (1.0-hills / 0.642857-winter ✓✓ = the
    (23)-row's mapping was OFFSETSWAPPED — the correct = +0x264 =
    MultGradient, +0x268 = MultPerlin.** The winter candidates show
    ScaleX/Y = 0.0/0.0 (not 1.0 — winter.xml has ScaleX="1"?? the CE
    showed 0 = the WINTER-config = the "no-noise" state ✓). The
    1×1-cnt-pixels-pixel-1 = the not-yet-bound BitmapNoise
    placeholders ✓ (the "0x13 2B518"-size block = 32-B pointer-slots).
  - **[uid+0x1d4] = 260×260 g = 67600 px-lit-1x-float-row for the
    hills-class bid!** = THE PER-BIOME IMAGE GRID CONFIRMED LIVE:
    row = [1,1,1,1,1,1,1,1,1,0.7961,0,0,0,0,1] — the ramp-shape
    = the bitmap_noise-FILE (the .plz-load) ✓✓ (C39's "the
    material_image = a per-biome image FILE" — the hills-260
    width = the data/biome_impl-image; the w=3584×2457-cnt
    1805888 = a WORLD-STATE-grid (= the area-grid C31 COUNT: the
    D Therew = CHUNKS ~70 = 3580?; the h = 2457 = the V-slice = ...).
  - **The W2 closed as EMPIRICAL: the [uid+0x224] int = the
    dispatcher-case value = 5 (= the 0x8fc020 = C35/"the IQ-simplex
    70-core = our ported simplex2DDeriv!!)** — matches the rdata blob
    name-list's 6th member vs the "SIN_CAPPED_SIMPLEX"-alias (the
    name-index convention = "the CAPPED family starting_idx = the
    I-node = the STATUS-side.").
  - **W5's remaining: further stats**: the +0x264/268-swap-correction
    (the (23)'s mapping row = NOW the mGradient-Consumer mapping = the
    C43-layer-fields = the per-biome +0x264-args confirmed) = the FULL
    per-biome STACK = the same-side config: the 0.46-hit = the x-cache.
  - The C43-row updated (my "+0x260 mapping" = corrected).
  - Tests 143/143 ✓.

- **2026-09-20 (35b) — the second CE paste = byte-identical to the first
  (the same 9 candidates, the same values).** Diagnostic: standing still
  = the config/template objects persist ✓ normal; the world-grid
  (3584×2457) row = all-zero = **the not-yet-written cells** (the
  banding-stack writes are per-loaded-band!). The v3 script written
  (multi-row dump of BOTH the 260×260-per-biome and the 3584×2457
  world-grid, 1×1 placeholders skipped): the next run = walk DEEPER
  into the snow band (a few chunk-widths) → rows should show the
  banding-stack values = the W5-close.

- **2026-09-20 (36) — dig #19: the v3 run LANDED the area-grid family —
  the W5 semantics closed as "the field = a per-area float-grid woven
  from (a) the per-biome 260×260 noise-template image + (b) the banding
  stacks".** From the fresh run: register entry with BOTH VAs.
  - **NEW class seen: grid 512×256 (cnt=131072), px=0x01873020 —
    SHARED by 5+ uid-candidates with the SAME pixel ptr (= the
    per-chunk-shared GRID!!). Rows: non-trivial values
    {1.0, 0.4607, 0.5429, 0.0964, 0.2694, 0.3741, 0.5791, 0.2240,
    0.0438, 0.9666, 0.2322} = a banded-fraction field, NOT raw
    template values ⇒ = the 0.4edf50 band-stack's real footprint.**
  - **The 512×256 shape = EXACTLY C31's area-grid shape**
    (w = [chunkExtent·512]÷10 = the width-in-cells ✓, h = the
    y-extent ✓): = **the AREA-float-grid [this+0x18] of C31 — the
    actual `field` the evaluator/c34-sampler consume** — NOT the
    260×260 template nor the world-grid!! The "260×260"-the-hills
    = the TEMPLATE-image lane (the pixel-art base, the 0.4607-dip
    row at y=0 = the image's own border-fades); 3584×2457 =
    the COMBINED world-grid (all-1.0 rows at y=1200/1600 = a
    filled solid-band = the under-ground row-set; consistent with
    the C31-family's [b+0x18]-float store = 1.0/0.0 per cell).
  - ⇒ **W5 model FINAL (kernel reference): field(cell) = the
    world-area-grid → filled per-cell from (i) the 260-biome-image
    lane (C39's "material_image/plz"; the row [1..0.7961..1] = the
    image's own borders!) and (ii) the band-stack (Random(min,max)
    fraction lanes: base 0.32·d+0.35 for layer-1 / 0.35·d+0.65
    layers 2/3 = per-layer upper overlays); consumed by the 0x90a860
    evaluator and the C34 sampler.** The mGradient* XML family = the
    band-stack's per-biome parameters (the per-arg CE read = the
    only open single item.)
  - The unused per-biome "grid 260×260"-value rows = the
    "0x4607 = 0.4607"-dip + "0x5429 = 0.5429" band = the per-biome
    noise-image's own "the empty band" (the template's y-band!)
    — the 4-candidate rows = the "1.0, 1.0, 1.0, 1.0"-ish families ✓.
  - **The grid's THRESHOLD-classification = "row>0.5":
    the .0.4607/.0.5429/.0.0964-row = a MIXED field = the band-stack
    overlay ✓ — the [0.4607/0.5429] = '''real per-cell values!!'''
  - Tests 143/143 ✓.

- **2026-09-20 (37) — dig #20: the "dig-down" run — the grids did NOT
  move; the decisive read was the px-comparison.** The v3 dump at x=1010
  is identical to the previous run (the walk added no new values), and
  the fresh 512×256-class candidates show rows IDENTICAL TO THE FIRST
  RUN including a DIFFERENT pixel-pointer instance
  (uid @ 4B344D60: px=2E09B020 vs the earlier 01873020, same
  values) — ⇒ **the 512×256-grid VALUES are GLOBAL, not
  per-camera-position: the banding-stack writes happen ONCE per area
  build, not per walker** (the ".4607/.5429"-rows across several
  uids + 2 px-pointers = the SAME band values ⇒ the band stack is
  deterministic, position-local = NOT randomized per re-visit).
  - The 3584×2457 world-grid stayed frozen too (y=1200/1600 =
    all-1.0, the rest 0.0) ⇒ the all-1.0 rows = the "the solid
    band-fill = the area's 1.0-lane" and the zeros = the
    not-yet-processed bands (NOT sky) — the y=1200..1600 = 12000
    px = the underground tunnel-band = the "AND the terrain-fill":
    the "1.0"-row band = the SOLID baseline (the "everything is
    filled = 1.0"), NOT a per-area run. This = a "the CONFIG-Layer's
    = the world-'UNIT-0-1-scale = the '.без built-the stage = the
    ONE-per-band accumulator!!" pattern.
  - **The row `y=64 @x=1010 = 0.0964 / 0.2694-` pair + `y=128 =
    0.3741 / 0.5791 / 0.2240 / 0.0438` = the C43-band-stack's
    per-cell values — the background-Bands = "0.0964/0.2694" =
    a separate numeric-lane = "the per-cell noise-transition" =
    multi-layer field (the "noise-Mix" + "the -.2240/-.0438-drops)
    ⇒ the DISTRIBUTION = multi-banded. The bands-constants
    (.32/.35/.65·..) = the RUN-maskets; the field family = the
    [uid+0x1d4] × the sampler's-.4607-band = the noise-terrain = the
    WHOLE STACK = live in-binary!!
  - The dig-down didn't move the grid-cells = **the 512×256-grid's
    own area = "the area's ONE-TIME-FILL at the chunk-load", NOT
    dynamically-written on the walk** — so the W5-open per-arg = the
    last-hurdle (a "which-per-biome-XML arg pulls into the (A,B)"
    — per-arg value-check vs the .462-.001'd values = tomorrow's
    ONE byte-trace.)
  - Confirmation grade: W2 = EMPIRICAL-closed (the (35) note stands);
    W5 = the model-complete; the LAST byte = per-arg read.
  - Tests 143/143 ✓.

- **2026-09-21 (38) — dig #21: P5 CLOSED — the per-arg trace of the three
  Random(min,max) layer-stack preps; the C37-config binding is statically
  ELIMINATED; the family = the BitmapCaves grid builders.** Fresh slabs
  regenerated first (text.bin f[0x400c00:0xdd0000] adj 0x401000 · low.bin
  f[0x400:0x400c00] · rdata.bin f[0xdd0000:0xee9600] adj 0x11d0e00 ·
  data_raw.bin f[0xee9600:0xf25a00]); C13 anchor re-pinned first
  (`cmp eax,0xFF420000` @ file 0x500e4d = true 0x901a4d = slab
  0x50124d ✓). All address math python; windows in
  /tmp/opencode/slabs (ephemeral) — the load-bearing byte facts are
  registered below and in CONSTANTS.md C44.
  - Call graph (all e8 caller/callee targets byte-read):
    - **fn A = slab 0x4ee470 = true 0x8EEC70** — the LAYER-1 band
      writer (its setter call slab 0x4eeb7c = true 0x8EF37C ✓ the
      (31) canon). Called from: fn A itself (slab 0x4ef023 = true
      0x8EF823, recursion) and **fn B at slab 0x4eff03 = true
      0x8F0703** (7 f32 stack args from fn B's frame windows
      [ebp−0x104/−0x10c/−0x110/−0x120/−0x134], ecx = the Random obj).
      Identity anchors: assert string **"caves_setup.mLuaScript.empty()
      == false" @VA 0x11730e8 (file 0xd722e8, line 0x233)** and the
      NAME-KEYED config fetches via the cengser getter **0x3eaa80**
      with keys **"spawn_small_enemies" @0x1173110** (len 0x13, result
      → obj [ebp−0x28]), **"spawn_items" @0x1173124** (len 0xb →
      [ebp−0x64]), plus **"n_small_enemies" @0x1173114** — the C30
      spawn-percent-bucket family confirming (31)'s "color/spawn bands
      lane".
    - **fn B = slab 0x4ef5d0 = true 0x8F5DD0** — ONE function spanning
      ≥ slab 0x4ef5d0..0x4f2a5f that carries BOTH remaining setter
      calls (slab 0x4f18d1 = true 0x8F20D1 "layer-2" and slab
      0x4f226c = true 0x8F2A6C "layer-3"). Build loop boundary jle
      0x4f2718 @slab 0x4f20c8.
    - Chain bases byte-pinned (the (33) note corrected): **[ebp−0x128]
      = d·3.0 + 1.0** (`mulss 0x11dff70`+`addss 0x11dfbf0`+store @slab
      0x4f15cf..0x4f15df = true 0x8F1DCF..0x8F1DDF — (33)'s VALUE
      right, the WINDOW was [-0x128], not [-0x108]) · **[ebp−0x108]
      = d·0.1 + 0.1** (`mulss 0x11df974`+`addss 0x11df974` @slab
      0x4f2081..0x4f2091 = true 0x8F2881..0x8F2891) · [ebp−0x100] =
      d·0.25(@0x11df9d0)+0.75(@0x11dfb2c) (slab 0x4f17e5..0x4f17ed /
      true 0x8F17E5..0x8F17F5).
    - Setter-value forms (byte-exact, both VAs):
      - L1: `v = clamp01((d2·0.32 + 0.35) · roll)` — mulss
        **0.32 f32 @0x11dfa00** (file 0xddec00, pin 2026-09-21) +
        addss **0.35 f32 @0x11dfa1c**, mulss [ebp−0x28] (the roll),
        clamp01 block slab 0x4eeb4f..0x4eeb69. Roll update on d1:
        `roll = d1·0.35(@0x11dfa1c) − 0.25(@0x11df9d0) + roll`
        (slab 0x4eea9d..0x4eeab1 = true 0x8EF29D..0x8EF2B1).
      - L2: `v = [ebp−0x128]·((d·0.35 + 0.65))` — mulss **0.35 f32
        @0x11dfa20** + addss **0.65 f32 @0x11dfb14** (slab 0x4f18bd /
        true 0x8F20BD+0x8F20C5), then `mulss xmm2,[ebp−0x128]`
        (slab 0x4f18cd).
      - L3: same (0.35, 0.65) lane @slab 0x4f2254..0x4f2264.
    - **THE DECISIVE NEGATIVE (P5's answer):** whole-body scans of fn A
      (slab 0x4ee470..0x4ef240) and fn B (slab 0x4ef5d0..0x4f2a60) find
      **ZERO loads of any C37 config slot** ([+0x1d4]
      BitmapNoisePtr or [+0x220..0x268]). The band (A,B) pairs are
      PINNED .rdata GLOBALS, not XML fields. ⇒ **"mGradient* = the
      band-stack's parameters" (C43's hypothesis) ELIMINATED
      statically** — there is NO XML field → stack-layer binding on
      the noise-config object; the mGradient* XML family feeds ONLY
      the C37 surface evaluator (CE-verified (35)).
  - The actual per-biome binding (the C44 family, CONSTANTS.md):
    **fn C1 = slab 0x4f27f0 = true 0x8F2FF0** — the BitmapCaves grid
    factory: asserts **"mTopology->BitmapCaves" @0x11731f0
    (line 0x449)**; takes (ecx = name string, edx = uid); looks up +
    caches in the **std::map @0x132aae8** (find helpers 0x582bc0 /
    0x655ae0 / 0x655b90 → insert 0x542970); allocs 0xb8 B → **ctor
    0x4f8c70 = FUN_008f9470** (C27) with the seed arg [ebp+8];
    reads dims **w = [topology+0x1c], h = [topology+0x20]** (the
    `[edi+0xc0]` topology sub-object) → `[grid+0x20]=w / [+0x24]=h`,
    cnt `imul`, u16 grid [+0x38] (free 0x114a358 / alloc 0x114a35c /
    memset 0xc3325e), resize-gate 0x52e050, [grid+0x94] =
    ([grid+0]·0.5)/0.1 = ×5 (slab 0x4f2a01..0x4f2a11 = true
    0x8F2FA1..0x8F2FB1); the poro Random ctor 0x523a0 seeds with the
    diddled seed (addsd **0x11e0ba0[hi]** — the C27 diddle ✓).
    **fn C2 = slab 0x4f2a60 = true 0x8F3260** = the twin (calls fn B
    at slab 0x4f2fa4 = true 0x8F3+0x?; verified: true 0x8F37A4); and
    the top-level caller = the **std::function wrapper slab 0x64de10 =
    true 0xA4E610**, invoked from the queue-drain walk (call at slab
    0x5fe51b = true 0x9FED1B) — a thread-pool task capturing (uid,
    name-string).
    - **DATA-SIDE CONFIRMATION: hills.xml (extracted data, read this
      session) `<BitmapCaves size_x="512" size_y="256">`** = the CE
      512×256 cnt-131072 grid shape EXACTLY, and the months-long CE
      observation "one 512×256 grid SHARED by 5+ uid candidates with
      the same px pointer" = the NAME-keyed registry (multiple
      hill-family uids referencing the same `name="bitmap_hills"`
      BitmapCaves share one cached instance) — BOTH W5 anomalies
      explained by one mechanism.
  - Consequence for the W5 model: **the 512×256 field = the
    mTopology→BitmapCaves-generated cave grid** (a blob/stamp
    generator: `data/biome_impl/caves/*.png` CaveStructure image
    stamps — cave_0.png = 11×18 targets, blob_caves/cave_count
    params) — NOT a fill of the 260×260 [uid+0x1d4] image lane, and
    NOT a serialization of mGradient* values. The 3584×2457 world
    grid = unchanged (the world-state lane, (36)).
  - Port consequence registered in noise-terrain.mjs this session
    (dated, 143/143 kept): noiseKind = 5 for SIN_CAPPED_SIMPLEX (CE
    (35), not the kind-8 proxy); the +0x264/+0x268 mult binding = the
    gradW term coefficient = [+0x268] = **mMultiplierPerlin value**
    (hills CE 1.0 when the attr is absent; winter.xml 0.642857 ✓) and
    the per-term coefficient = [+0x264] = **mMultiplierGradient
    value** (hills 0.871429 ✓); the gradAt ramp stays the
    documented instrument (the BitmapCaves generator fn B is a
    100+KB blob/stamp engine — NOT ported this session; P5's field
    build model replaces the [uid+0x1d4]-image fiction).
  - Tests 143/143 ✓ (first run of the session, pre-edit).
  - **WIRING LANDED (2026-09-21, after the dig): the dig #21 port changes.**
    - noise-proto.mjs `surfaceField`: the mult slots renamed to UNAMBIGUOUS
      `gradWCoef` ([+0x268], = the mMultiplierPerlin VALUE) and
      `perlinCoef` ([+0x264], = the mMultiplierGradient VALUE) — motorized
      purely by the CE relabel (the term-offset INTS are unchanged from the
      C37 static read; the VALUE slots swap). The `[+0x268]==0` lane test
      now reads `uid.gradWCoef === 0`.
    - noise-terrain.mjs `uidFrom`: `noiseKind = 5` for SIN_CAPPED_SIMPLEX
      (CE (35) — replaces the kind-8 proxy; the honest default -1 +
      throw remains for any other name, C42 respected); `gradWCoef` ←
      XML mMultiplierPerlin (default 1.0 = CE hills with the attr ABSENT);
      `perlinCoef` ← XML mMultiplierGradient (default 0).
    - biomes.mjs dig #8 extraction: `mMultiplierPerlin` added (winter.xml
      carries it in the current set; hills.xml does NOT — its CE value
      1.0 is the ABSENT-attr state).
    - Census (extracted data, this session): ALL 36 noise_type attrs =
      "SIN_CAPPED_SIMPLEX" (the ONLY live XML name ⇒ kind 5 covers the
      full live set; cases 2/3 lanes stay honest-throwing per the wiring
      contract).
  - **VALIDATION PASS (2026-09-21 (39), shape-first mandate, WIRING
    §4):** reference ref tiles regenerated
    (`npm run bench:ref` → `mapgen/out/ref/` now covers tx 29..47 ×
    ty 0..19 = the frozen91 world px; 380 chunks; seeded network cache);
    instrument = `mapgen/experiments/2026-09-21-surface-shape.mjs`
    (shape-first: 5×5-local-std≤2.0 flat-mask luminance RMS + solid
    density; output `mapgen/out/gen-shape-2026-09-21.json`). TWO
    windows:
    - **handoff window (tx 29..47 × ty 11..19 = chunks cx −6..12,
      cy −3..5):** allPixelRms **73.535** (255 scale) · flatPixelRms
      **48.717** · flat coverage 20.3% · ref solid density **0.690** vs
      our **0.429** (26 pts low; the known 61-62% vs 38-46% density
      confound's surface-band edition, VERIFIED §6) · the worst chunks =
      tx 45..47 / ty 12..14 (flatRms ~168-213 with refSolid ~1.0) = the
      lake/rainforest_dark no-attempt band + the P1 template misfits.
    - **diagnostic window (ty 0..10 = the map's own top band):** the
      ref there is ~sky (refSolid 4.5%); flatRms 32.5 — not a surface
      judge.
    - **DIAGNOSTIC FIND: the handoff window contains
      ZERO procedural-noise chunks** (noiseChunkMask's probing over
      tx 29..47 × ty 11..19 = 0 v2 masks) — the instrument's numbers in
      this window measure the wang/template bands, NOT our surface lane.
      The surface/noise lane actually lives in the hills-family chunk
      set (biome-map rows 0..2 = the canvas ty 48..51 band, chunks
      cy −14..−12) ⇒ the shape instrument's first pass is for the
      area-BASE metrics (rms 73.5/48.7 = the PRE-wiring wang/template
      bands), not the noise band itself. NO issue box (I1/I3/I5/I6)
      closes on this run — the noise-lane's own window still needs its
      chunk-row-matched instrument (the hills-band chunks sit at biome
      rows 0..2 where the ref = the SKY band per the rows 0..10 score —
      the hills-*areas*'s chunk-px origins need the canvas/biome
      px-mapping reviewed before re-running).
  - **CACHE r3f → r3g BUMPED (2026-09-21):** `mapgen/server/genmap-server.mjs`
    cacheDir renamed (r3f→r3g); the kind-5/mult-binding change alters the
    solid-mask membership of the 574 procedural-noise chunks (the V2 lane
    renders render the kind-5 masks 305 _EMPTY_ + 265 desert + 4 pyramid
    vs the old lane's 1478+98+74+253+69… chunk census) = an observable
    output change ⇒ bump required by the standing rule.
  - VERIFIED.md §9/K2 updates and WIRING_SURFACE.md § statuses updated to
    the dig #21 state. Between-dig review of the OLD uid defaults
    (multPerlin=0 hardcode) = RETIRED by this entry. Tests after the
    wiring pass: **143/143 ✓** (second run, 2026-09-21 incl. tree fixes).

- **2026-09-21 (40) — dig #22: W4 EXECUTED — the case-2/3 lanes + case-4
  head + fbm BSS state READ; the FNV24 pair = NEW PORT; three canon
  corrections landed.** Live-XML census (extracted data): mGradientAddNoise
  2 = hills2.xml only; 3 = lake/lake_blood/lake_deep/lake_statue;
  0 = hills_flat/laboratory/mountain_lake; all five use
  noise_type="SIN_CAPPED_SIMPLEX" (kind 5). Live evidence:
  1. **Trig helpers = IAT thunks (CLOSED):** `0xc33222 → *0x114a514 =
     acos` · `0xc33234 → *0x114a520 = sin` (the C40 slot names); no
     hand-written trig existed — the "(27) 0xc33xxx cos/sin helpers" item
     resolves as thunks.
  2. **The switch has FOUR branches:** slab 0x50a355: `dec`×ε cascade —
     addNoise 1→0x50a7eb (ported dig #11), 2→**0x50a6ba**, 3→**0x50a603**,
     else→0x50a37d..0x50a41b (calls **true 0x8FB570 = UNREAD**; dead in
     live data since addNoise ∈ {0,1,2,3}).
  3. **Case-3 (lake) chain EXACT (0x50a603..0x50a6b9):**
     a = whiteLattice2d(y·0.02, x·0.021) [0.02 f64 @0x11dfc70 · 0.021
     f64 @0x11dfc78; xmm0 = the y-arg = args swapped]; g = a·0.05+0.05
     (@0x11df948 ×2); xCh = sin(x/1024)·1024·0.5·0.06·g [1/1024 f64
     @0x11dfb50 · 1024 f64 @0x11e0080 · 0.5 @0x11dfdd8 · 0.06 @0x11dfcd8];
     yCh = acos(y/1024)·1024·0.5·0.06·g; 0x4fb820(xmm0 = yCh-acos side,
     — **AXIS CROSSED: superseded 2026-09-21 by dig #23 (41)** — the
     correct = whiteLattice2d(x·0.02, y·0.021), sin(y/1024), acos(x/1024),
     IQ(cCh, sCh); the case-2's x/y = crossed likewise. See (41).
     xmm1 = xCh-sin side) → the case-1's blend tail. Both-VAs cited
     per site (slab 0x50a625..0x50a6b5).
  4. **Case-2 (hills2) chain = 0x50a6ba..0x50a7e6 (exact):**
     wl = whiteLattice2d((y/100)·0.025, (x/100)·0.025) [100.0 f32
     @0x11e02dc · 0.025 @0x11df914] · fN = fnvLattice2d((y/100)·0.0241,
     (x/100)·0.0241) [0.0241 @0x11df910] · s1 = simplex2d((y/100)·wl·
     0.02789, fN·(x/100)·0.02789) [0x11df918] · aux = s1·wl·5.0+0.5
     [5.0 @0x11dfee0] · yCh = acos((y/100)·0.01313)·aux + fN·(−20)
     [0.01313 @0x11dfc30 · −20.0 f32 @0x11e068c] · xCh = sin((x/100)·
     0.01123)·aux + wl·(−20) [0.01123 @0x11dfc10] · 0x4fb820(yCh, xCh) →
     the same tail.
  5. **FNV24 = NEW PORT (C45):**
     hash fn true 0x8FB2D0 (slab 0x4fb2d0): 24-B buffer = {x_d64 |
     y_d64 | 1234567.0 f64 @0x11e0180}, FNV-1a (0x811c9dc5/0x1000193),
     idx = ((h>>8)&0xff)^(h&0xff). **The C41 "walks via true 0xc31cea"
     = RETIRED — 0xc31cea = the CRT /GS stack-cookie check** (cmp ecx,
     0x12eb000·cookie → repz ret); no mod-12 exists. **The corner-value
     table @.data 0x12eb950 = 256 nonzero f64s** (data_raw.bin off
     0x950..0x1148, full 0x800-B read) — the "12-dir pairs" note =
     only the first 12 entries; SUPERSEDED. The lattice (true 0x8FC940,
     slab 0x4fb340): smoothstep (3−2d)·d²; corners hash(x0,y0+1)→edi ·
     hash(x0,y0)→esi · hash(x0+1,y0) · hash(x0+1,y0+1); rows lerped in
     x by wx; final = wy·(rowTop−rowBottom)+rowBottom (all slab-VA-cited:
     0x4fb340..0x4fb503). Ported: fnvHash2d/fnvLattice2d +
     noiseDispatch case 3 + `mapgen/lib/fnv-tab.mjs` (generated literal).
  6. **Dispatcher case-4 (true 0x8FD110) READ (not ported — dead lane):**
     x·(2³²−1 f64 @0x11e0240 ✓ the mandate's pin) → the fp-classify
     helper true 0x1032F81 (hand-written; exp-class tables 0x11e0da8/
     0x11e0db0) ×3 (x, y, x·y·**7123.1234 f64 @0x11e00d8**) and the
     div-lane ×**1020304.1234 f64 @0x11e0170** per the y==0 path;
     0x4fb5e0 = the int XOR/SHR mixer (full op chain byte-read); tail =
     int → (f64)diddled → ÷2³². Flagged stub (the helper's identity =
     CRT-side, open).
  7. **fbm (true 0x8FDAD0) byte-settled REWRITE: the "BSS state" =
     a CONSTANT 4-f32 quad** copied once from .rdata 0x11e0c70 =
     **{0.8414700031 (= sin(1)), 0.5403000124 (= cos(1)), 0.5403000124,
     −0.8414700031}** — never written back; the "accumulator" gloss =
     ELIMINATED. Dispatcher call #1 = the RAW (x, y); the och-2/3/4
     args = the state-vector pair-dots with lac = 2.02 @0x11dfe7c /
     2.33 @0x11dfee8 / **2.01 @0x11dfe78 (NEW PIN, 2026-09-21)**;
     amps 0.5/0.25/0.125/0.0625 ✓ · ÷0.9375 ✓. The exact (x↔y) dot-
     pair lane assignment = the one flagged residual (fbm = opt-in via
     [uid+0x228]; no live XML sets it).
  8. **CANON CORRECTION — the FINAL-combine (byte-found mid-read):** the
     surface evaluator's return = **[+0x268]·[ebp-0x18]·[ebp-0x8] +
     [+0x264]·xmm2 + [ebp-0x1c]** (slab 0x50a8d9..0x50a8fb) where
     [ebp-0x18] = gradW = **(r'−0.5)·2 with r' = r·field** (NOT the
     (23)-model's (field−0.5)·2), [ebp-0x8] = per (insidePerlin's out),
     xmm2 = the post-case value, [ebp-0x1c] = [uid+0x260]; the
     [+0x268]==0 test SELECTS the gradW/per-lane (`ucomiss xmm0,0;
     lahf; test ah,0x44; jnp` — taken iff ZF, verified per the parity
     math). ⇒ the port's 2-term FINAL is structurally wrong and gets
     remapped per these bytes (the FIRST edit of the next push; it does
     not affect the 143/143 — the tests don't exercise the field-blend;
     the lane n-components stay correct).
  - Tests 143/143 ✓ (third run, post-W4).
  - **FINAL-COMBINE REMAP LANDED (2026-09-21, the same-night follow-up; all
    five deltas per dig #22 #8, byte-VAs cited in the function header):**
    1. `field := r·field0` — the FIELD SLOT := r' is UNCONDITIONAL
       (0x50a2fe), not just a tail-internal rename; every post-bilinear
       gate (0.51 / 0.85) AND the [+0x264] FINAL term reads r'.
    2. The [+0x268] test's polarity CORRECTED: `gradWCoef !== 0` runs the
       gradW/per lane (the old code ran it on ==0 — inverted).
    3. gradW = (r'−0.5)·2 (the (23)-model's (field−0.5)·2 = retired).
    4. add := 0 unconditionally; = [uid+0x260] only inside the case-switch
       path (0x50a35b) — the old port fed addValue on the fallback too.
    5. The blend tails (cases 1/2/3) now operate on r' (the slot-reuse);
       the tail assignments = `r' += (n·r' − r')·((r'−0.85)/0.1)`.
    6. The slope arm (slab 0x50a8a2..0x50a8d4) = byte-implemented:
       per := per·(1 + (rpost − 1)·y·0.001) [0.001 f64 @0x11dfb58; the
       multiplier = the Y-arg — the "x·0.001" of the (23)-note retired];
       gated by uid.slopeFlag ([+0x24c]; its XML field source = unmapped,
       so it stays OFF until identified — adapter not fed).
    7. FINAL = gradWCoef·gradW·per + perlinCoef·rpost + add.
    - Verification: the three blend lanes now DIVERGE in the out (e.g.
      the (1.5, 14.5)-probe: 2.878 / 3.586 / 2.944 for addNoise 1/2/3
      at field = 1.2); the below-gate paths = the [+0x264]·r' term
      (0.479@0.55-field probe ✓). The identical-outputs smoke seen
      pre-divergence was gating (rRaw ≤ 0.85/field), not a bug.
    - Tests: **143/143 ✓** (fourth run, post-remap).
    - Residuals registered (next push, no backtracking): the
      0x90AA80 r-evaluator's identity vs the noiseDispatch-5 surrogate
      (the port keeps the surrogate flagged — if 0x90b280 turns out to
      be NOT a straight kind-dispatch, r and r' change shape, not the
      FINAL); the slope-flag's XML byte-source ([+0x24c]); the fbm
      dot-pair lane + the case-4 helper identity (dead-lane items).

- **2026-09-21 (41) — dig #23: the cross-corpus CONSISTENCY AUDIT + the
  case-2/3 AXIS RETRACE.** While auditing for stale claims after the
  FINAL-combine remap, a REAL cross-lane inconsistency surfaced and was
  resolved mechanically (NO prose flip-flop: the basis = register
  continuity at the call sites, anchored on the ONE unambiguous site —
  the case-1's wl-call bytes at slab 0x50a7eb — under canon C37's pin
  xmm2 = x / xmm3 = y ⇒ [ebp−0x44] = the FIRST f64 = x-side,
  [ebp−0x3c] = the SECOND = y-side):
  1. **The NOISE_CASES table in noise-proto.mjs = STALE** (case 3
     labelled "UNREAD" after the C45 port; case 4 label stale too) —
     FIXED in-place (case 3 = "true 0x8fc940 = fnvLattice2d READ+ported
     (C45)"; case 4 = "READ (dig #22 #8), registered, not ported — dead
     lane").
  2. **C42's "kind-8 proxy" rule = STALE post-CE** — addended: retired
     by the (35) empirical kind-5 mapping; the port's uidFrom maps the
     only live name to kind 5 (this row's no-static-table negative
     stands).
  3. **C37's uid offset-map labels (+0x264 mMultiplierPerlin /
     +0x268 mMultiplierGradient) = the pre-CE (23)-labels = a SECOND
     current-truth inside the row — FIXED inline** (annotated: post-CE
     the slots = swapped; the durable port names = gradWCoef =
     [+0x268] / perlinCoef = [+0x264]).
  4. **noise-terrain's uidFrom: noiseTypeInt was hard-set 5 regardless
     of the name (inconsistent with the noiseKind lane's name-test) —
     FIXED** to mirror the name-condition (SIN_CAPPED_SIMPLEX ? 5 : −1).
  5. **THE DEEP ONE — case-2/3 CHAIN-AXES = CROSSED (in the dig #22
     record AND the port):** re-derived against the case-1 anchor:
     [ebp−0x44] = x-side, [ebp−0x3c] = y-side ⇒ in the case-2 block,
     0x50a6ba's xmm3 = [ebp−0x44] = X (NOT y) and 0x50a6bf's xmm2 = Y;
     hence [ebp−0xc] = x÷100 and [ebp−0x10] = y÷100 (mislabels retired)
     ⇒ the correct chains:
     - CASE-2: wl = whiteLattice2d((x/100)·0.025, (y/100)·0.025);
       fN = fnvLattice2d((x/100)·0.0241, (y/100)·0.0241);
       s1 = simplex2d((x/100)·wl·0.02789, fN·(y/100)·0.02789);
       aux = s1·wl·5.0+0.5; the acos chain = acos((x/100)·0.01313)·aux +
       fN·(−20); the sin chain = sin((y/100)·0.01123)·aux + wl·(−20);
       0x8fc020(xmm0 = the acos-chain, xmm1 = the sin chain).
     - CASE-3: a = whiteLattice2d(x·0.02, y·0.021) [the 0.02 on the
       x-side = [ebp−0x44]!] · g = a·0.05+0.05 · the sin chain =
       sin(y/1024)·1024·0.5·0.06·g ([ebp−0x3c] = y side!) · the acos
       chain = acos(x/1024)·…·g ([ebp−0x44] = x side) · 0x8fc020(cCh =
       the acos chain, sCh = the sin chain) → the tail.
     - The IQ-arg pair-order (which chain lands in xmm0) = the OTHER
       flagged item carried per the asm register names in each lane's
       comment (the case-1's IQ-comment = "(xmm1 = x-chain, xmm0 =
       y-chain)" — that annotation referred to the IQ-call at
       0x50a861..68 whose source regs the dig #11 pinned; the port
       keeps the (xin = the xmm0-content) convention, unchanged).
     - The port's case-2/3 = REPLACED per the retrace (the y-first
       orders + the crossed constant-attachment = gone); the lanes now
       diverge under the standard (probe (1.5, 14.5) field=1.2:
       2.878/3.590/2.295 for an = 1/2/3).
     - The dig #22 §6 entry's #3/#4 texts = the mislabels documented in
       (41) (the two-layer rule: dated supersede-pairs, no silent
       deletes) — the function header + the inline comments = the
       current truth.
  - Tests: **143/143 ✓** (sixth run, post-retrace).

- **2026-09-21 (42) — dig #26: the W5 FIELD-BUILD dig BEGUN — fn A
  (true 0x8EEC70) read end-to-end structure-wise + the stamp-carve
  helper family pinned; the CaveStructure-image stamp walk is byte-
  mapped, NOT yet ported. Session context: the four-task queue (wiring
  fix / ref-window / field-build dig / CE probes). Fresh slabs were
  extracted (text.bin f[0x400c00:0xdd0000] adj 0x401000 · low.bin ·
  rdata.bin · data_raw.bin); C13 anchor implicitly respected (all
  slab→true conversions per C13; the rdata reader's convention was
  re-verified by reading 0x11df988 = 4.656612875e-10 = the C1 NextU
  scale EXACTLY — the same constant canon pins elsewhere).**
  - **EXTENTS (byte-settled):** fn A = true 0x8EEC70..0x8EF069 (ret at
    slab 0x4ef06c; the earlier "0x4ee470..0x4ef240" window was padding
    — the functions after are SEPARATE helpers, the dig #21 assumption
    we also correct here). Following helpers, all in the same family:
    - **blob setter slab 0x4edf50 = true 0x8EE750** (= C43's unnamed
      "float-grid setter"): (ecx = grid obj [+0x18 wrapper], edx =
      &point {i32 x, i32 y}, xmm2 = radius, xmm3 = value, xmm4 =
      compare-value; stack[5] = byte flag, fn A callers push $1). Two
      paths: (a) single-point max-bleed write — bounds-checked, reads
      grid[x + y·w] via getter 0x5491f0, writes ONLY if new >
      existing (max-bleed); (b) when radius ≥ threshold path: a
      per-cell circle walk over dy(dx) ∈ [−r0,r0] (r0 = trunc(value +
      0.5 comiss 0.5 @0x11dfa94)), dist² = dx²+dy², skip dist² > r²,
      then flag-1 falloff blend + rewrite (detail of the falloff
      block slab 0x4ee044..0x4ee11c = the remaining sub-read).
    - **blob fill callee slab 0x4ee2d0 = true 0x8EF2D0** (fn A calls
      it with (ecx = the Random obj, edx = &point, stack: &point,
      count) — the multi-blob scatter engine).
    - **blend helpers slab 0x4ef070 = true 0x8EF870**: per-cell
      `dst += v·(src − dst)` over a src float grid ([+0x18] wrapper
      getter 0x5492d0) into the dst float grid; slab 0x4ef150 = true
      0x8EF950: the BYTE-grid twin (copies src byte where dst byte
      grid [+0x58] embeds the mark via 0x5493b0 getter).
  - **fn A STRUCTURE (read, per wei):
    - ARGS (slab ebp-relative): [8] = &dims{w,h} (bounds target),
      [0xc] = &counts pair (spawn_small_enemies → −0x58,
      spawn_items → −0x64 via the cengser getter 0x3eaa80, keys
      0x1173110/0x1173124), [0x10] = start-limit float, [0x14]/[0x18]
      = vmin/vmax-range floats, [0x1c] = target-min, [0x24] = value
      cap, [0x28] = &stamp-counter (decl per stamp, the loop driver),
      [0x2c] = x-step. ecx = the Random-ish object; edx = the
      topology/biome entry (+0x88 passed to the name-map getter
      0x533580 → config object; 0x3ebce0 = keyed access).
    - THE WALK (slab 0x4ee8d0..0x4ef05d): the wanderer starts at
      (float)counts[0]/[4] (the [eax]-pair → −0x4c/−0x44), steps x
      += [0x2c](float·0.2+0.25·rand-family per 4ee73f..4ee7d5:
      s' = 5.0/−4.0-normalized draws), up to FIFTY steps (cmp $0x32
      @4ee697/4eee31 = the walker-step cap), per step:
      - radius roll: roll = d1·0.35(@0x11dfa1c) − 0.25(@0x11df9d0)
        + roll (slab 0x4eea9d..0x4eeab1 ✓ dig #21's pin);
      - carve value: v = clamp01((d2·0.32(@0x11dfa00) +
        0.35(@0x11dfa1c)) · roll) (d2 = NextU state/2³¹· — the
        setter call at slab 0x4eeb7c = true 0x8EF37C);
      - falloff interpolation over the current x 3-lane ramp:
        t<0.2 → lerp toward the 0.2-lane; 0.2..0.6 (0.60
        @0x11dfaf8) → −0.33(@0x11dfa10,+0.10)·(t−0.6)/0.6 branch;
        0.6..0.7 (0.70 @0x11dfb1c, 0.40/0.3 @0x11dfa44/#11df9f0)
        → the third branch — a piecewise radius/strength envelope
        (the exact per-lane endpoints = the next sub-read);
      - the blob-setter call with push $1.
    - THE RECURSION/RESET: after the 50-step walker finishes,
      count([0x28]) double-loop (slab 0x4eeee3..0x4ef02b):
      `while cmp [counter] > 0` → re-randomized start ("decl
      (%eax)" @0x4eef9e = iterate the count per stamp), every
      stamp calls TRUE 0x8EEC70 RECURSIVELY (slab 0x4ef023) with
      fresh limits ([0x10]/[0x14] args re-used, strength ×50.0
      @0x11e0284 blend-adaption at 4eefe2..4ef004: r = d·50.0 −
      50.0 + strengthBlend) and a new spawn-lane value via −4.0
      @0x11e0608 (d·5.0/step generation at 0x4ee735..0x4ee78e) —
      this IS the "cave_childs/branch" mechanic (the recursion
      depth = the min/max cave childs of the XML).
    - asserts present: "caves_setup.mLuaScript.empty() == false"
      (line 0x233), a "4096-cap" path (cmp 0x5f @0x4eebeb = 95
      blob-count cap val? ⇒ sub-read) and the standard CB COOKIE.
  - **rdata constants pinned into this family** (all byte-read
    from rdata.bin this session; .rdata rule VA − 0x400e00):
    100.0 f64 @0x11dffe8 · −4.0 f64 @0x11e0608 · 5.0 f32 @0x11e00a0 ·
    0.20 @0x11df9b4 · 0.25 @0x11df9d0 · 2.5 @0x11dff10 · 1.0
    @0x11dfbf0 (canon) · 0.60 @0x11dfaf8 · 0.70 @0x11dfb1c · 0.40
    @0x11dfa44 · 0.30 @0x11df9f0 · **C1 4.656612875e-10 @0x11df988
    (canon cross-pin)** · 10240.0 @0x11e049c · 0.32 @0x11dfa00 ·
    0.35 @0x11dfa1c · 0.33 @0x11dfa10 · −1.0 @0x11e05a8 · 50.0
    @0x11e0284 · 2.0 @0x11dfe68 (canon) · 0.5 @0x11dfa94 (canon) ·
    100.0 @0x11e02dc (canon). Registered as CONSTANTS.md C46.
  - **DATA-SIDE (the forge inputs):** hills.xml's full BitmapCaves
    attr set re-read (this session): name/size (512×256),
    blob_caves_count 20..55 / radius 1..10 / strength 1.5..3,
    cave_childs 0..2, cave_count 50..100, cave_strength 0.2..1,
    mountain_count 0..15 / size 1..10, surface_cave_childs 2..7,
    surface_caves_count 7..12, do_beginning_paths/down, and TEN
    CaveStructure stamps (cave_$[0-999], mountain_rock, skull_mountain,
    eye_0$[1-4], pit, deep_pit, brush_03/04/05/06) each with aabb
    (x 5..507, y −8..35 per stamp), count range and strength
    range. The BinCaves PNGs live in data/biome_impl/caves/.
  - **Port decision (NO port this dig):** fn A's structure is
    decoded to walk level, but a byte-exact JS port still needs
    (1) the blob setter's falloff block (slab 0x4ee044..0x4ee11c),
    (2) the 0x4ee2d0 multi-blob engine, and (3) fn B's worm/surface/
    mountain machinery — each a named read. Guessed stubs would
    poison the I1 instrument against the no-guessing mandate, so
    the dig #26 deliverable is the registered evidence + these
    three named sub-reads as the fresh-session queue. Artifacts:
    /tmp/opencode/caves-fnA.asm (1050 lines incl. the two blend
    twins at 0x4ef070/0x4ef150), caves-fnB.asm (3551 lines).

- **2026-09-21 (43) — dig #26 addendum: sub-reads (a)+(b) PARTIALLY
  closed — the blob-setter falloff + the scatter node; artifacts kept
  in-repo.** (objdump continuation on the fresh slabs; the earlier
  /tmp dumps copied to `mapgen/out/caves-fnA.asm` / `caves-fnB.asm` —
  the /tmp copies are ephemeral per the standing tooling rule.)
  - **(a) CLOSED — the blob setter's flag-1 falloff (slab
    0x4ee039..0x4ee0e0):** with r = radius (xmm2), v_arg = the value
    arg (xmm4), dist² = dx²+dy²:
    1. t = (r − dist²)/r (sub/div, slab 0x4ee03d..0x4ee04b);
    2. v0 = (v_arg − 1.0)·t + 1.0 (slab 0x4ee044..0x4ee053);
    3. if flag != 0 ∧ grid_y < 25 (`cmp $0x19` on [edx+4] but as the
       LOCAL y of the stamped point pair 0x4ee05e/64): w =
       ((y_int − 1.0)/25.0(@0x11e01e0, PIN — f32))² ^ squarings ×3 =
       w⁸ (three self-muls 0x4ee079..0x4ee085); final =
       w⁸·v0 + 1.0 (0x4ee08d) — near the top rows the stamped value
       is pushed toward 1.0 by a (y/25)⁸-weighted eave;
    4. the write = max-bleed (read grid cell via 0x5491f0; write iff
       existing < new, slab 0x4ee0c1..0x4ee0df) into the grid [+0x18].
  - **(b) PARTIAL — scatter node slab 0x4ee2d0 = true 0x8EF2D0:**
    (ecx = grid obj, edx = dims{w,h}, xmm3 = value, stack[8] =
    &range{lo,hi} ints, stack[c] = seed/value pass). Draws ONE poro
    Next (0xc090c0), range x = trunc(value·−0.5(@0x11e058c PIN)) +
    trunc(−(value·0.5)) rolls a random point inside the range; bounds
    vs the dims; then reads the CURRENT cell (getter 0x5491f0) and
    `comiss 0.5(@0x11dfa94 canon)` — recurses into the branch
    engine true **0x8FAFC0** (slab 0x4fa7c0) with (ecx = the grid,
    stack: y-int, x-int, the value) ONLY when cell < 0.5 (an
    empty-cell gate). 0x8FAFC0's body = the remaining named
    sub-read (the "cave worm branch" candidate).
  - Sub-read queue becomes: (a ✅) (b ✅ partial — 0x8FAFC0 open)
    (c) fn B machinery (worm/surface/mountain); (d) fn C1/C2 wiring.

- **2026-09-21 (44) — the CE pickup v4 (user run, spawn, moduleBase
  0x400000): the C24 doubles DECODED = 17920.0 / 7168.0** (the
  canvas↔world offset pair — see CONSTANTS.md **C47** for the raw
  bytes and the full read list incl. the slope-flag all-zero verdict,
  the 4-entry caves-map count, the V4d NIL (the caves-grid objects
  don't carry the A-resolver — target corrected to BitmapNoise
  instances) and the first byte-level anchor of the caves-field port:
  the four 512×256 carved name-keyed hills grids with y=0 rows
  EXCEEDING 1.0 exactly where the (y/25)⁸ eave (43) predicts).
  Consequences for the port queue: (1) the band-stack/stamp field
  build now has an AUTHORITATIVE VALIDATION TARGET (byte-match the
  caves-setup grid per name via the next CE run's full row dumps);
  (2) the fill-arg prep's `int(g)` reads are the canvas conversion
  — worth a has-path port review (the (3,3)-anchor story unaffected:
  F-anchor closed no-anchor on geometry grounds); (3) V4d target
  correction + V4e layout retry = re-probe TODO in the harness.

- **2026-09-21 (45) — the second CE pickup (V4f/V4g) — three canon
  verdicts + the port's validation target SAVED
  (`mapgen/out/oracle/caves-grid-2026-09-21.json`):**
  1. **V4f = the [P+0x94] mechanism signature:** 512-wide cave grids
     read **2560.0 = (w·0.5)/0.1 — the fn C1 ×5 toucher byte-cross-
     verified** (the (38) read); 1×1 placeholders read 5.0 (×5 of w=1);
     the 3584×2457 WORLD-state grid reads **−56909.828125 = the RAW
     C27 poro draw** (f32(d·200000−100000), no ×5) — the world grid
     is NOT a caves-factory product; 72624.71875 = the other real
     draws (1×1-class P objects).
  2. **The two 512×256 cached grids (0x26599020 / 0x338CB020) are
     BYTE-IDENTICAL across all sampled rows** — from fn C1's ctor chain
     (FUN_008f9470 = diddled ws + ONE Next draw, C27) the caves-field
     generation is a deterministic function of (worldseed, name,
     XML params); two names with identical dims/structure serialize
     the identical stream. This makes the WHOLE band-stack + stamp
     field byte-reproducible.
  3. **The y=0 band x0..31 = the surface BUMP (validation anchor for
     the stamp/blend port): 1.0×10 → 1.0010/1.0635/…/peak 1.454092
     @x≈19 → symmetric descent → 1.0 at x=29.** A smooth ±10-wide
     hill of +0.454 heights over the 1.0 base — NOT a (y/25)⁸-eave
     product (that arm's near-0 top weight would flatten to 1.0);
     its likely writer = the mountain/skull/eye CaveStructure image
     blend twin (0x8EF870) or an explicit image-bake at delivery —
     the pipe to identify in the port work. Interior rows (y ≥ 16
     sampled): the 1.0 base with the max-bleed carves observed
     before (0.0696/0.0000/0.0042 …toward 0; y=224 all-1.0).
  - Port queue UNCHANGED (0x8FAFC0 → fn B machinery → C1/C2 wiring →
    caves-field port) but now with a byte oracle artifact to match.

- **2026-09-21 (46) — dig #27: the worm-node mislabel CORRECTED + fn B's
  phase map read (objdump-only, fresh slabs; artifacts /tmp/opencode/
  worm.asm + in-repo dumps unchanged).**
  1. **true 0x8FAFC0 (slab 0x4fa7c0) DECODED = NOT a worm — it is the
     B-CHANNEL / SCRIPT-MARK RECORDER, the in-binary twin of C32's
     "B-channel" arm:** signature (`this` = a BitmapNoise-family owner
     {+0x40/+0x44 dims, +0x58 byte-grid wrapper gated by [+0x5c], +0x1c
     resize pair, +0x80 record vector}; stack x-int, y-int, byte-value,
     ret $0xc). Body: lazily allocate/init the byte grid (0x52c480
     wrapper fill) iff [+0x5c]==0; bounds-check (x,y) vs the dims;
     **value := ++value as a BYTE add** (a wrap-around byte counter
     pinned by the `cmp $0xff` + assert pair — asserts "noise_utils.cpp"
     line 0x434 @0x7396c and line 0x435 @0x11737c8, both
     byte-listed); writes the byte-grid cell [x + y·w] = value
     (getter/setter 0x5493b0); then walks the +0x80 record vector
     (12-byte records, ÷3 lattice count — the C32 `{x, y, B, B−1}`
     record family): records an existing (x,y) → updates its
     byte slot [+8] (= the B−1 pair)?/ appends a NEW record via
     0x52e370. **The 0x8FAFC0 naming "worm branch" is RETIRED** —
     the scatter (0x4ee2d0) drives the C32-recorder; the worm/
     cave-carving machinery lives elsewhere in fn B.
  2. **true 0x8EE930 (slab 0x4ee130) read = the blob-setter SMOOTHSTEP
     twin** (makeSSE helper family): bounds-vs-dims, MAX-BLEED write
     (getter 0x5491f0, write iff new > current), the distance² circle
     walk and a smoothstep-weighted blend (full detail for the port
     sits in worm.asm's neighbor dump; same family as the C46 blob
     setter).
  3. **fn B (true 0x8F5DD0) PHASE MAP from its callee census
     (13.4 KB, 35 poro draws, 4 asserts):**
     - slab 0x4eff03 = fn A call #1 (the FIRST stamp pass);
     - slab 0x4f036d & 0x4f095f = the 0x8EE930 blob-setter (two
       blob sub-phases);
     - slab 0x4f0b23 + 0x4f0b8a/0x4f0ba8 & 0x4f107f/0x4f109d = the
       second 0xb8-ctor(0x4f8c70) + the 0x533860/0x5bffb0 loader
       pair (the CaveStructure/file-set loading phase);
     - slab 0x4f0ec8 = the 0x8EF950 byte-blend twin;
     - slab 0x4f18d1 = the layer-2 setter (the (38) canon); slab
       0x4f1d5d = the first 0x8EF2D0 scatter;
     - slab 0x4f226c = the layer-3 setter + slab 0x4f26fb = the
       second scatter;
     - slab 0x4f293c = the SECOND 0xb8 ctor + slab 0x4f2a3c = the
       fn B RECURSIVE self-call (0x4ef5d0) = the cave_childs /
       surface-caves recursion phase;
     - XML attr names for ALL the knobs re-found in-binary
       (`blob_caves_count_{min,max}`, `blob_caves_strength`,
       `cave_childs`, `mountain_count/size`, `surface_caves_count`,
       `do_beginning_paths/down` etc. — the runtime config-side
       strings the phase bodies read).
  - REMAINING untuk the port (named sub-reads): the exact per-phase
    block semantics between the call sites (layer-2/3 setter arg
    masks @ slab 0x4f1xxx/0x4f22xx), the aabb arithmetic, and the
    beginning-paths lane (do_beginning_paths/down). After those +
    the C1/C2 wiring the caves-field port can land byte-exactly
    against the saved oracle.

- **2026-09-21 (47) — dig #28: the fnB/fnC1 wiring decoded to the phase
  level; `mapgen/lib/caves-field.mjs` SKELETON LANDED (exports
  buildCavesField / carveCircle / stampWalker / makeCaveStructureGrid):**
  - **fn C1 (slab 0x4f27f0..0x4f2a5b, true 0x8F2FF0) read END-TO-END
    (already dbt in (38)): (name, uid) → std::map find (0x582bc0/0x5fdae0)
    + insert (0x542970) @0x132aae8 (new 0xb8); reads the topology sub-
    object [topology+0xc0] → w=[+0x1c], h=[+0x20]; SetSize (0x52c1e0) +
    float-grid alloc (+0x18) + u16 [+0x38] + byte [+0x58] wrapper
    [+0x20/24], a ZERO FILL (0xc3325e) then THE 1.0-f32 base bake
    (movl 0x3f800000 @0x4f29c2 — the base = ALL-1.0 = the C48 oracle's
    base ✓ byte-settled); [+0x94] = ×5·w toucher (0x4f2a01..0x4f2a11);
    poro ctor (0x523a0) with the diddled ws (addsd 0x11e0ba0[eax],
    the C27 diddle); the fnB CALL (0x4f2a3c) with (ecx = the twin's
    topology sub-object); map-insert; ret. So fn C1 delivers a
    byte-identifiable base-1.0 tile and fn B consumes the SAME 0xb8
    grid as fn-A's build (both write over the SAME base).**
  - fn C2 (true 0x8F3260, slab 0x4f2a60..0x4f3b00) opened: the TWIN's
    (a) base lands via the 0x52c820 blob-clone + f32 [eax]/[eax+0x4] fill
    (fnA's init at 0x4ee49d = 1.0), the layout-free allocation of the
    three grids (float/u16/byte), and of the FULL-XML BandCaves chain
    (the [eax+0x2c/0x28] (range-y pair), [eax+0x38/34] (int cave-count
    pair), and the JSON-LUA hooks through 0x3eaa80. The DECODE still
    admits the stages: [the两层 the 0x1346cd8 2c-byte slot as its
    'template' pull from cache at 4f0b2f/4f101d with the same id].
  - **A cluster of ORACLE-SHAPE probes run against the C48 y=0 bump
    (h = .454092, symmetry c ≈ 19.0..19.5, ±10 falloff): none of the
    naive shapes reach the byte noise floor** (sqrt-cap ~0.168 max err,
    sphere-cap ~0.10-0.17, linear cones ~0.17, spherical caps ~0.10) —
    the bump writer is in fnB's per-phase block bodies (the layer-setter
    arg masks, the aabb arithmetic OR the (0x11dfa5c = .45) + bit的理论
    value) — SHELF: the next CE-diff picks it up at runtime with the C48
    dense dump in hand, exactly the same path as the C47/C48 closure.
  - The C46/C43-blob primitives are PORTED byte-exact into
    `lib/caves-field.mjs` `carveCircle` (the (43)(a) block: 0.5-t
    max-bleed + eave) and validated SMOKE (the ± endpoints hit the
    oracle exactly — the interior shape waits for the fnB block read).
  - Tests 143/143 green (post-skeleton). NO cache bump (the module is
    not yet wired into the render pipeline).

- **2026-09-21 (48) — the PINPOINT CE pickup v5.2 processed (both seeds
  pasted; artifacts `out/oracle/CE_PICKUP_v5_2_seed91_92.txt`; canon
  = CONSTANTS.md C49). HEADLINES:**
  1. **[P+0x8c] = the raw worldseed byte-pinned in-memory across BOTH
     seeds (0x04AFD8E7 / 0x04AFD8E8)** — the C27 ctor layout fully
     confirmed live. [P+0x94] = ×5·w (C48) unchanged; the seed-91-run's
     3584-grid [P+0x94] = -96244.1719 vs the earlier -56909.828125 ⇒
     the per-build's ctor draw ADVANCES (per-instance, not per-seed).
  2. **The hills-class 512x256 struct knobs [P+0x34] = 0.546875 /
     [P+0x74] = 1.549988 are IDENTICAL across seeds 91/92** = REAL
     per-biome template knobs (the hills.xml strength 1.55-family) —
     the first byte-level identification of the blob-stamp knob slot
     vs. the flex data layer. Seed-92's second 512×256 grid
     (0x46F7DB78-class) carries the same +0x34 = f32-as-31725.79-repr
     (the pointer-reinterpret window in the dump view; the only genuinely
     stable SMALL knobs = the hills-class's .546875/1.549988 pair).
  3. **[P+0xb0] = 0x008EE1B0** ON the two ZERO-DIM bitmap_noise uids,
     first32 = a proper fn entry (`55 8B EC` ...) — **THE V4d
     A-RESOLVER HUNT RESOLVES**: the resolver fn body exists at
     true 0x8EE1B0, the NEXT objdump read gives the C32 A-channel's
     config-side consumer (the byte lane's fn body).
  4. **[P+0x58] deref is a REAL per-grid heap allocation** (differing
     pages at 0x2C3A7FB8 / 0x4E34C010 / 0x29E64430 / 0x38053020 across
     seeds/instances), first 64 bytes = ZERO both seeds — the C32's
     byte-lane allocation confirmed; the byte-lane's writing pass is
     in-scope of fnB/fnC2's later zero-fill or an untriggered branch.
  5. **the std::map @0x132aae8 layout cracked** (both seeds): MSVC x86
     RBTree node {L(0), P(4), R(8), color/isnil(0xc), SSO-union
     @0x10..0x1f, size@0x20, cap@0x24, **value @0x28**}; the KEY =
     a CaveStructure FILE-PATTERN string (byte-visible
     "...l__EMPTY_..." / "ways_zer..." / "**e_0$[1-4**" = the
     eye_0$[1-4].png family!) — so this std::map caches PER-PATTERN
     CaveStructure generator context, and its VALUE = the CAVE-GRID
     POINTER for the pattern (0x2A1DC9A8 / 0x46F7DB78 in the two runs,
     byte-consistent with the uids' [uid+0x1d4]) — the (38)/C44 model's
     "name-keyed structure-set cache" CONFIRMED at runtime.
  6. The 1×1 placeholders ALL share **P = 0x0132B518 = a STATic never-
     initialized cell** (a single shared placeholder object), and the
     real grid allocations happen per (seed, name).

- **2026-09-21 (49) — dig #29: the [+0x34]/[+0x74] knob-pair CONSUMER
  side decoded byte-exact (objdump-only, fresh slabs):**
  - **fnB's blob phase (slab 0x4f0862..0x4f0965, true 0x8F8062..) READ
    END-TO-END:**
    ```
    eax = [ebp-0x114]           ; the CAVE-GRID object P ([uid+0x1d4])
    xmm6 = movss 0x74(%eax)     ; [P+0x74]  = the strength A knob
    xmm4 = movss 0x78(%eax)     ; [P+0x78]  = the strength B knob
    ... poro draw d (the edi-state, closed form 0x834e0b5f)
    xmm4 = (B − A)              ; subss %xmm6,%xmm4  @0x4f0931
    xmm4 = d·(B − A)            ; mulss %xmm0,%xmm4  @0x4f0954
    xmm4 = A + d·(B − A)        ; addss %xmm6,%xmm4  @0x4f0958
    xmm2 := xmm4                ; the INTERPOLATED STRENGTH
    call 0x4ee130               ; the blob-setter smoothstep twin (value = the interp!)
    decl -0x110(%ebp)           ; the per-phase BLOB-COUNT loop counter
    ```
    **⇒ [P+0x74]/[P+0x78] = the blob-strength (min,max) pair** consumed
    in a standard Random(A,B) interpolation feeding the blob-setter's
    v_arg. CE pins (both seeds): (+0x74, +0x78) = (1.549988, 0.0) on the
    hills-class grid, (0,0) on the OTHER 512×256 class — a INVERTED-lookup
    pair (A = max?/B = min?) → the interp spans [0, 1.549988] as d runs;
    the C48 bump's ≤1.45-peak lives INSIDE this strength range ✓ (the
    first byte-level MODEL of the bump's construction: the blob strengths
    are DRAWN from [0, 1.55] per placement).
  - **the list-scanner (slab 0x4f0989..0x4f09a5)**: count =
    ([P+0x80] − [P+0x7c]) with the magic 0x88888889 + sar 5 family and a
    zero-check (je 0x4f0f36 = the skip when the list is empty) — the
    SAME [+0x7c/+0x80] slot family the CE dump showed (the seed-91 CE
    guard tripped on [+0x7c] = 0: the pair sits OFFSET in the real
    layout; the list at THIS phase reads ZERO-length → skips — the
    record vectors fill only at the later per-phase stages).
  - **[+0x34]'s consumer context (slab 0x4f0d34..0x4f0dfb)**: a
    DIFFERENT object (the CaveStructure PATTERN record, loaded into
    [-0x110]) carries [+0x24]/[+0x2c]/[+0x34]/[+0x38] as a mixed
    int/f32 knob window (the "0.546875" f32 read @0x4f0dfb vs the
    int-read @fnB 0x4ef736 = TWO DIFFERENT structs — the cave-grid P
    vs the pattern record — NOT a contradiction).
  - **the knob WRITER = NOT in the fnB/fnA/ctor family** (no store to
    [+0x34]/[+0x74] anywhere in the 0x4ee000-0x4f9000 range). The
    named writer-hunt next: the fn C2 body (0x8F3260..) + the XML-parse
    consumer family (C32's "RandomMaterials" .rdata sites true
    0x496a2e..0x4a97ed) — the knobs are parse-time writes from the
    <CaveStructure strength_min/max> XML attrs.
  - Tests unchanged 143/143; no port changes.

- **2026-09-21 (50) — dig #30: the knob pair RESOLVED to the CONSUMER
  level + the caves-field SURFACE_V3 LANDED (runnable):**
  1. **the knob parser = the LOW-half ConfigLua registration family**
     (true VAs 0x4AE921..0x4B2A0F = 6 parse clusters per CaveStructure
     class; the keys built via the 0x41df90(-len)/0x41ceb0(make-int)
     cengser builders + the 0x444250 string-map slot walk (the ÷3 idiom)
     — cave_strength_min/max's imm32s (0x117c4c4/0x117c504) appear ONLY
     in the LOW half; the blob_caves_strength family 0x117c6d8/0x117c6f0
     the same). The knob VALUES live at parse-time in the
     ConfigRegistry/engine defaults — **NOT static in the exe**: the
     whole-exe f32 scan finds NO 1.549988/1.55 literals and the
     0.546875 (= 35/64, an EXACT binary float) appears only twice as
     incidental byte-coincidences — the [+0x34]/[+0x74] pair's values =
     the struct's LOADED per-biome knobs (CE-pinned (1.549988, 0.0)
     hills-class, both seeds), with the C50-consumer semantics byte-set.
  2. **`lib/caves-field.mjs` SURFACE_V3 core wired** (exports
     buildCavesField / carveCircle / walkChain / toucherValue /
     makeFieldGridFromTopology): the byte-exact core (the fn C1 all-1.0
     base + the C27 ctor chain + the C50 knob interp + the (43)(a)
     falloff incl. the (y/25)⁸ eave) + the FLAGGED placement
     composition (the fn A x-wanderer's ≤50-step chain walk + the
     cave_childs recursion + the mountain ADD-blend at y<12 — modeled,
     not byte-read). Smoke: grid 512×256, p94 = 2560 ✓, the row bands
     read the 1.0 base with the carve-valley stamps; the density
     delta (0.93 solid / mine vs ~0.5 in the oracle) = the named
     remaining sub-read (the per-cave footprint's true rolls +
     the strength's deep-end values — the oracle's carve centers sit
     at ~0.05..0.08 = deep worm lanes we don't draw at the right depth
     yet).
  3. The instrument gate (=the next push's first action): the
     noise-window run under SURFACE_V3 vs the C48 oracle's dense dump,
     which converts the solidity delta into the per-phase roll map.

- **2026-09-21 (51) — doc consolidation: `WIRING_SURFACE.md` and
  `SURFACE_AUDIT.md` PURGED (user call: session-slop).** Their verified
  residue is distilled into **VERIFIED.md §12** (surface-band layer
  model incl. the measured 256 LoadPixelScene callsites, the
  static-tile lane, the SURFACE_V3 opt-in rule, the F3 wiring state
  with the cache-r3i policy); the mid-progress contracts and process
  prose were NOT carried over (deliberately — they were the bloat).
  All live pointers (code comments, CONSTANTS.md C44's gate line,
  genmap-server's cache comment) now cite VERIFIED.md / CONSTANTS.md.
  The mentions of both files inside the historical dig entries above
  stay as history — do not chase them; the current truth for every
  claim they carried is VERIFIED §12 + the C-rows.

- **2026-09-21 (52 def registry) — the overfilling dig + the fixes (all in
  the render lane; no new binary claims):**
  - **The "entire air and sky = dense rock" root cause** = the V2 noise
    lane shipped default-on (r3g wiring) with the ramp `gradAt` placeholder;
    the loader painted the solid band shade over every procedural chunk's
    non-art px. Canonical default = walang pixels: art scenes + wang areas
    only, everything else air → SURFACE_V2 back to opt-in, attachNoiseTerrain
    no-ops without a lane flag (VERIFIED §12's mandate line enforced).
  - **Zoomкої moire (zoomed-out dense rock / mid clean / zoom-in rock)** =
    renderTile's global point-sample `(y*512+j)*2^z` — phase per zoom level.
    Fix: block-majority downsampling over the distinct 10px wang cells in
    each scale block; offline census on the island tile: 12.4/3.1/0.8/30.3/
    58.4% solid across z0..z4 (each tile a wider region, monotonic).
  - **The west winter / east desert surface + the pyramid surroundings**
    = the FILL-side of the same overfill family: `renderProceduralFill`'s
    full-range banded approximation painted every non-art pixel a band
    (the mountain-tree rectangle plain flat fill observed at 1.27-1.37M px
    / area). OPT-IN via PROC_FILL=1 (honest air default; the real shape =
    the caves-field lane, fn B still unread).
  - Pyramid census on disk this session: def-region chunk claims resolved
    (52,12..57,14): pyramid wang area `pyramid_52_12` covers the bulk
    (chunks 54..56 x 12..14, dense wang-atlas fill = the I13-family debt:
    colorize maps the atlas's white/grey placeholders to solid bands — the
    exact band noise = the C32 open read; pyramid's entrance/wall pieces =
    the scene-art lane; the deficit areas = everything around the perimeter
    the solid_wall approx fills). NOT resolved in-binary; registered debt.
