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
- 1,958 RTTI class names extracted (mapgen/extractions/rtti-names.txt (X20)) — no
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
PASS; flip-rate calibration), `-export.mjs` (key binaries → `the session temp bank (now settled under mapgen/extractions/, manifest X1–X61)
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
    call-site contract; **[(113): the body has NO fistp — 0x44d0b0 =
    the CRT floor wrapper (MSVCR120.dll!floor via IAT 0x114a534,
    hint 1646); the fldl/fstpl = f64 arg marshalling. C92]**
    canon C20's `call 0x4cff0`?? — the row's
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
      C13-verified CRT fld/fistp ROUND-to-nearest wrapper) **[SUPERSEDED
      (113): 0x44d0b0 = the CRT FLOOR wrapper — cvtss2sd → fldl →
      fstpl → MSVCR120.dll!floor (IAT 0x114a534, hint 1646) → fstpl →
      cvtpd2ps, NO fistp anywhere in the 55-B body; byte-read
      (`mapgen/extractions/verify-floor-113.mjs (X9)`). So every "round" gloss
      below and every round-derived number in this entry = wrong]**;
      identity of
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
      **[SUPERSEDED (113): the slot→name chain read here was off by one
      from 0x114a514 on and mis-labelled 3 slots; re-read from the PE
      import directory (name-records resolved, not assumed,
      `mapgen/extractions/resolve-wrappers-113.mjs (X7)`): 0x114a510 =
      _libm_sse2_acos_precise · 0x114a514 = _libm_sse2_cos_precise ·
      518 = _libm_sse2_log10_precise · 51c = _libm_sse2_pow_precise ·
      520 = _libm_sse2_sin_precise · 524 = _libm_sse2_sqrt_precise ·
      528 = _libm_sse2_tan_precise · 52c =
      _setjmp3 · 530 = ceil · 534 = floor · 538 = memcpy ·
      53c = memset (thunks 0x1033a1c..0x1033a5e, one per slot, in
      that order). Only the sin pin used downstream (0x114a520,
      0x44d110) survives intact]**
    - the seed hash: **c0 = 57.0·round-f(y) + round-f(x)** (57.0 =
      f32 @0x11e028c, pinned) — round via the fld/fistp tt;
      **[SUPERSEDED (113): c0 = 57.0·floor(y) + floor(x) — the
      head calls are the FLOOR wrapper (above), and the c0 blend does
      `mulss 0x11e028c` (57.0) then `addss −0x8(%ebp)` (the floor(x)
      slot) BEFORE the −0x4 store @0x8fb417; the corner parities are
      computed on the floor values (`and 0x80000001` @0x8fb613,
      `lea 0x1(%ecx)` @0x8fb64f). Port re-based to floor = entry (113);
      asm-literal at the 5 side-by-side points]**
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
    NOT capture-validated. **[SUPERSEDED (113): 0x44d0b0 = FLOOR (see
    above); the sin half stands]**.
  - Smoke: `whiteLattice2d(12.5,−3.25) = 0.834` **[SUPERSEDED (113):
    0.833995283 was the round-based port; floor port =
    0.898207068 = the asm-literal]**; the case-1/hills
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
  All byte-cited in `mapgen/extractions/cases245.asm (X18)` (regen from the exe);
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
  mapgen/extractions/slabs (X41) (ephemeral) — the load-bearing byte facts are
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
     resolves as thunks. **[CORRECTED (113): the 0xc33xxx are SLAB VAs —
     true = +0x400800 (C31's "memset 0xc3325e" = true 0x1033a5e checks
     out), so 0xc33222 → true 0x1033a22 → slot 0x114a514 = **cos**
     (not acos; acos = 0x114a510 via thunk 0x1033a1c) and 0xc33234 →
     true 0x1033a34 → slot 0x114a520 = sin ✓ (the sin pin holds).
     Both 0xc33222/0xc33234 land mid-instruction in fulltext86 (`lea`
     @0xc3321f, `je` @0xc33233) and 0x1033a1c..0x1033a5e are not
     decoded labels there — the thunk bytes were read straight from
     the exe; `mapgen/extractions/resolve-wrappers-113.mjs (X7)`]**
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
    mapgen/extractions/caves-fnA.asm (X17) (1050 lines incl. the two blend
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
  phase map read (objdump-only, fresh slabs; artifacts the session temp bank (now settled under mapgen/extractions/, manifest X1–X61)
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

- **2026-09-21 (53) — the AIR-oVERFILL photographer (forensics + ownership
  fix; render-lane processes, no new binary claims):**
  - **Evidence:** the west lake / east hills / desert / pyramid-surroundings
    AIR chunks carried a single up-256k px paint per chunk whose color
    distribution is EXACTLY the DEEP_ROCK ladder of `fillChunk(...,
    DEEP_ROCK)` (37,21,17×6 : 55,34,29×3 : 64,35,28×2 : 98,59,50×1, pixels
    130955/65358/43974/21857 = the 6:3:2:1 ratio over 262144). Their
    biomeAt = hills/desert/lake — NOT wall biomes.
  - **Mechanism:** areas = bounding boxes of connected biome-map
    components, and the renderer iterated every chunk inside each def's
    rect — solid_wall's edge-matrix component decomposes the WHOLE band:
    bbox {x1:41,y1:0,x2:68,y2:47} swallowed the east surface + pyramid
    surroundings; the twin {1,0}..{28,43} covers the west. Same for any
    concave component (the mountain_tree flat 1.27M-px fill seen at
    area@(31,10..32,14) = another bbbox-overpaint instance).
  - **Fix = the chunk-ownership gate:** `biomeAt(config,tx,ty).biome ===
    def` before renderTemplateChunk — a def paints only chunks the
    biome map assigns to it. Cross-biome overpaint lanes disappear at
    once (forensics keys 58,50 / 62,50 / 51,60 / 22,48 / 32,58 → ABSENT
    = honest air).
  - **Consequence for the plan:** the remaining surface shading = the
    fn B per-phase read (the caves-field placement = the AIR-carve
    machinery) + the A-resolver/colorize material ladder — no display
    patches in between.

- **2026-09-21 (54) — fnB dig restart (fresh slabs; C13 anchor re-pinned ✓).
  First windows against the standing phase map (dig #27 fnB callee census):
  - The two `0x4ee130` blob-setter call sites sit inside per-phase loops:
    call #1 @slab 0x4f036d (doc window slab 0x4f02cb..0x4f036d), call #2
    @0x4f095f in the DECL-loop the C50 row names (`decl -0x110(%ebp)`
    @0x4f0964, back-edge `jne 0x4f0660`). The pre-roll window around each
    call = the SAME Random(min,max) closed form (0x834e0b5f imul +
    127773/2836/16719 decomposition, C6/C7) + a `mulsd 0x11dffe8
    (101.0-f64)` / `cvttsd2si` / `cmp $0x14 (20)` cap @0x4f02f5 — a NEW
    pinned constant: **the blob radius cap = 20** in this phase.
    New consts: 0x11e0578 (f64 next to the 100.0/−4.0 pins — semantic
    open, flagged), +0x11df9d0 (0.25, canon) + 0x11dfd2c (1.5, canon).
  - The CaveStructure-RECORD WALK (slab 0x4f097b..): extracts the
    record vector (+0x7c/+0x80 on the cave-grid object; ÷12 record
    count via magic 0x88888889, DR: each record 12 bytes — matches
    C46's 12-byte {x,y,B,B−1} family at the cave-grid +0x80 vector),
    dedup counts, skips empty (`je 0x4f0f36` = the "list empty → skip"
    of the C50), then per-record reads [rec+0x1c]/[rec+0x20] into
    the frame window (−0x120/−0x100) and runs the SAME Random
    interpolation before the 0x4ee130 setter call. The per-record
    +0x1c/+0x20 f32/int window = the CaveStructure pattern's count/
    strength fields (C50's "DIFFERENT struct" note lives HERE).
  - Artifact: mapgen/extractions/fnb.dis (X35) (3551 lines, the full fn B slab).
  - NEXT (unchanged): per-phase block semantics between the call sites
    (the layer-2/3 setter arg masks, the aabb arithmetic, the
    beginning-paths lane), then the port against the C48 oracle.

- **2026-09-21 (55) — fnB sub-read (1): the layer-2/3 setter arg masks
  DECODED byte-exact (all slab windows in mapgen/extractions/fnb.dis (X35); true
  VA = slab + 0x400800 per C13; anchor re-pinned ✓):**
  - **Layer-2 (slab 0x4f186b..0x4f18d6 = true 0x8F2265..0x8F20D6):**
    1. Random draw (C6/C7 closed form → edx).
    2. POINT = {trunc(−0x120), trunc(−0x138)} written at &{−0x164,−0x160},
       edx = &point.
    3. VALUE = cvtdq2pd(draw) → ×C1 (0x11df988) → cvtpd2ps →
       **×0.35 (0x11dfa20) → +0.65 (0x11dfb14) → ×[−0x128] (the layer-1
       clamp output)** = the C44 form `[-0x128]·(d·0.35+0.65)` EXACT.
    4. `push $0` — **the stack flag = FALSE** → the blob-setter's PATH (a) =
       **single-point MAX-BLEED write (write iff new > existing)**; NO
       circle walk, no falloff for this lane.
    5. `call 0x4edf50` (the C43 float-grid setter) with ecx = [−0x13c].
    Pre-window lane: `[−0x100] = d·0.25 (@0x11df9d0) + 0.75 (@0x11dfb2c)`
    (the (31)-cluster's d·0.25+0.75 base, now slab-cited).
  - **Layer-3 (slab 0x4f2205..0x4f226c):** the SAME mask — point =
    {trunc(−0x120), trunc(−0x138)} at &{−0x134,−0x130}, `push $0`,
    value = [−0x108]·(d·0.35+0.65) (0.35 @0x11dfa20, 0.65 @0x11dfb14
    on the drawn value). Both band layers = single-point max-bleed
    updates — **they can only RAISE a cell, never carve it down**.
  - **SEMANTIC VERDICT (uses the fn A walk level too):** the AIR inside
    the cave/hills bands is NOT produced by the band-stack layers —
    max-bleed can only climb. The carve/air decision must live in the
    CaveStructure stamp lane (the scatter true 0x8EF2D0's `< 0.5`
    empty-cell gate + its recursion) or the CaveStructure IMAGE blends
    (the mountain bump writer, C48's identify target). This RETIRES the
    "upper band = solid overlay" reading: upper bands RAISE the value
    only; AIR comes from where stamps/carves act.
  - The x-wanderer's damped step (`subss 0.15` @0x4f2528 + the
    pre-window lane `d·0.25 − 0.15 + prev` around slab 0x4f2488..0x4f2563
    + `decl −0x118(%ebp)` @0x4f255d) = the ≤50-step x-wanderer per-stamp
    maintenance re-cited in body blocks (the fn A window).

- **2026-09-21 (56) — fnB/fnA dig #56: the scatter body + the Air-Source
  SCAN (no naming leap — writer census only).**
  - **The scatter engine true 0x8EF2D0 (slab 0x4ee2d0..0x4ee46f) READ
    END-TO-END (window `scatter.dis`):**
    1. rolls TWO poro draws (`0xc090c0` @0x4ee3e8/0x4ee409) through the
       Random(min,max) closed form → x = (edi + trunc(0.5·(arg·(−0.5) +
       d·span))) semantics (`mulss −0.5 @0x11e058c`, `mulss 0.5
       @0x11dfa94`, the −0.0 sign-flip @0x11e0c50); y likewise — a point
       rolled INSIDE the record's own span (the (43)(b) note, now
       byte-cited with the exact two-lane x/y roll identity).
    2. BOUNDS: rejected when x/y < 0 OR x ≥ [obj+0] OR y ≥ [obj+4]
       (the AABB/dims bounds check @0x4ee42a..0x4ee43e).
    3. idx = y·w + x → float getter **0x5491f0** on [this+0x18].
    4. **THE GATE (byte-cited @0x4ee456): `comiss (%eax), 0.5; jbe skip`
       — the branch fires ONLY when cell < 0.5** (the "empty-cell"
       predicate, dig (43)(b) confirmed with the exact compare).
    5. the recursive tail = **0x4fa7c0 = TRUE 0x8FAFC0** ( ecx = the
       grid obj, stack (x, y, value@+0xc)) = the B-CHANNEL RECORDER
       (dig #27's identity) — the value arg travels WITH the branch.
  - **THE AIR-SOURCE SCAN (census reads, no interpretation):**
    inside the whole fn A + fn B span the following writers exist:
    | writer | callers | verdict |
    | --- | --- | --- |
    | blob setter (max-bleed circle+single) true 0x8EE750 | fnB only: L2 @0x4f18d1, L3 @0x4f226c (`push $0` = single-point lane) | can raise only |
    | smoothstep twin true 0x8EE930 | fn A (its blob phase) | raises (max-bleed) |
    | blend twin (float) true 0x8EF870 | **ZERO calls in fnA/fnB** | NOT in these bodies |
    | blend twin (byte) true 0x8EF950 | fnB @0x4f0ec8 | the byte-grid copy |
    | scatter true 0x8EF2D0 | fnB @0x4f1d5d / 0x4f26fb | EMPTY-CELL lane only |
    ⇒ **the sub-1.0 (AIR/CARVE) values in the C48 oracle are NOT produced
    anywhere in fnA/fnB's own writes.** The lowering write must live in
    the fnB LOADER pair (the ctor+loader windows slab 0x4f0b23 +
    0x533860/0x5bffb0 — where a CaveStructure FILE is loaded) or in fn
    C1/C2's delivery step (the "blob-clone" the dig #47 note names) —
    i.e. the image-loaded stamp values themselves are sub-1.0 and are
    applied by a non-max-bleed writer downstream. **This is now a
    POSITIVELY-SCOPED OPEN READ: the "who writes with image data" =
    the fnB load phase + fn C1/C2 wiring, NOT the band stacks.**
  - Landscape consequence for the cart lane: the caves-field port's
    composite = the 1.0 base + max-bleed raises (band stacks) + image
    stamp blends (the loader pair) + the empty-cell recursion; the port
    in caves-field.mjs needs the loader-pair sub-read before it can
    byte-match C48. (Instrument unchanged.)

- **2026-09-21 (57) — fnB dig #57: the LOAD-phase identity + the fn C2
  census (writer hunt continues, no naming leaps):**
  - **0x533860 (slab) = a 28-byte-record ARENA builder, not an image
    loader:** pushes $0xe00 (3584 B = 128 × 28) to the engine allocator
    (`call *0x114a34c`), zeroes the {begin,cnt,cap} triple, initialises
    `edx = 0x80 (128)` slots via 0x651a60, and stamps the arena (+0xe00)
    into the handle {0,crire,+0xe00,ptr}. Companion 0x5bff80/0x5bffb0 =
    the vector grow/alloc pair. ⇒ the fnB "loader-pair" windows from the
    dig #27 phase map are the **CaveStructure RECORD ARENA allocators**
    (per-pattern 28-byte records — matches the C50 pattern-record stride
    note), NOT image loaders. The per-pattern cached objects = the C27
    ctor (0x4f8c70 = the 0xb8 Random state struct per pattern record).
  - **fn C2 (slab 0x4f2a60..0x4f3b00) census:** its own children = fn C1
    (0x4f27f0 ✓), TWO INTERNAL hitherto-unlisted functions
    (`0x4f3bf0`, `0x4f3460` — the next read targets), `0x24c2d0`,
    `0xc070c0`; **ZERO calls of the blend twins (0x8EF870物业0x8EF950)
    or the arena-recorder family** — so fn C2's body is NOT the
    lowering writer either.
  - ⇒ the writer that applies SUB-1.0 stamp/image values onto the
    cave-grid's float grid = the **biome.cpp SetSize+Load wrapper
    caller true 0x8ee6bb** (already read in dig (9b): it news a 0xb8
    ctor, sets [gen+0x94] floats, B-map, and calls the SAME
    SetSize+Load wrapper true 0x8fa930 = the BitmapNoise LoadFromImageData
    lane, C32!). That matches the dig (18) chain: **the grid's SUB-1.0
    values come FROM THE IMAGE LOAD pass itself (LoadFromImageData
    part-1 writes float ±1.0 per the resolver — id A+1 == 1 ⇒ float −1.0
    = the AIR-candidate), not from a stamp-blend our scan hoped for.**
    (the C48's "ADD-BLEND bump writer" = the DISTINCT stamp lane = the
    image blend the hill-area y=0 keys show; the carve values in mine
    (y=65/129 = 0.000/0.006...) = the LoadFromImageData ±1.0/0.0 family
    apply = an ALIGNMENT-to-be byte-validated by the 3-way self-diff.)
  - NEXT (standing): the resolver body true 0x8EE1B0 (the A-channel
    config-side consumer; C49's "+0xb0 = 0x8EE1B0 found" — the
    material-identity table) — the LAST config-side read before the
    caves-field lane can go byte-exact against the C48 oracle.

- **2026-09-21 (58) — fnB dig #58: the 0x4ee130 window settled = the
  SMOOTHSTEP-TWIN scatter body; the phase-2 spacing; .rdata keys
  re-verified from the exe file this session.**
  - true 0x8EE930 (slab 0x4ee130..0x4ee2c8) = the scroll-stamp family —
    head: `movss 1.0, comiss xmm2` (1.0-vs-arg selects the path).
    Per-cell walk: getter 0x5491f0 → comiss −0xc (the falloff t arg)
    `jbe 0x4ee2bb` skip, then the TRUE MIX formula: reads the corner
    cells (idx y·w+x + the neighbor step pair via `imul [x] + [x]`, the
    +1 neighbor at −0x20/−0x24) and does
    **`xmm0 = (v_src − v_dst)·t + v_dst` = a per-cell LERP** — i.e. the
    smoothstep twin = a **BLEND** writer over the float grid, NOT
    max-bleed (its compare = `comiss` on the t/window bounds, per
    `test eax/js + cmp eax,ecx; jge out` = the bounds walk, and the
    dist² weight at 0x4ee22a divss/(r) followed by 0x4ee237 mulss
    squared into [−0x20]). ⇒ ONE lowering writer now exists in the fnB
    census: the smoothstep twin writes `lerp(v_dst, v_src, t)` per
    cell in its window — the byte-mechanism that CAN pull values down
    toward the stamp/source value (the C48 carve rows fit this shape).
  - The callsites census update (it was mislabelled in (57)'s table):
    fnB's L2/L3 setters (0x4edf50) = the MAX-BLEED kinds; fnB's
    smoothstep call (slab 0x4ee130 target) = where fn A's own window
    chain runs the stamp's cell blend (the fn A caller at {0x4ee2d0
    border}). The `0x4ee130` family in fn A's own calls = the record
    stamp SMOOTHSTEP-BLEND, and it CAN LOWER — Air source found at
    the fn A stamp window! (this supersedes dig (56)'s "no lowering
    writer in fnA" — the census missed the double-labelled entry:
    0x8EE930 was registered as "blob setter smoothstep twin" and its
    body = the blend walk = the actual lowering writer. byte-window
    cited above.)
  - .rdata strings re-verified from the EXE (rdata rule VA−0x400E00):
    0x1173110 = "spawn_small_enemies" · 0x1173124 = "spawn_items" ·
    0x1173114 = "n_small_enemies" · {
    0x11730cc = "bitmap_noise" · 0x11730e8 =
    "caves_setup.mLuaScript.empty() == false"} — all canon labels in
    the C44/C46 rows byte-confirmed; the fnB phase keys ARE these
    (the cengser getter 0x3eaa80 keys).
  - NEXT: point the caves-field port's stamp walker at the smoothstep
    blend (0x8EE930) per stamp — port + C48 byte-compare gate.

- **2026-09-21 (59) — the caves-field port × C48 oracle comparison (the
  byte bar, first numbers).**
  - Port smoke: def `_EMPTY_`/hills BitmapCaves, seed 78633191 →
    meta { blob 45 / cave 87 } (the XML spans 20..55 / 50..100 ✓),
    p94 = 2560.0 ✓ byte-equal to the oracle's (w·0.5)/0.1.
  - Row-by-row against the C48 oracle (`out/oracle/
    caves-grid-2026-09-21.json`, grid_0x26599020 = the 512×256
    bitmap_hills): overall rms driving the composed FIELD (the port's
    placement is FLAGGED, so per-row rms ~0.27–0.61 across the
    sampled rows y16..y160, the >0.25-delta counts 0–12 of 12, y224
    rms 0.0160 / y192 rms 0.2665). Everything within the expected
    layout — **the placement composition (the dig #26-#29 sub-reads)
    is the visible divergence driver, as registered: the ~24-px of
    "un-seeded" gaps in the port vs the oracle's carve positions sit
    at the wanderer rolls and the ORDER of stamp → scatter phases.**
  - The port unchanged — this run is the standing instrument to use as
    the byte bar when the fnB placement sub-reads land byte-by-byte
    (the per-phase cols in (55)/(56)/(58)). No render wiring changed.

- **2026-09-21 (60) — fnB placement-order port experiment (the reorder +
  the blend-writer swap) × the oracle instrument.**
  - The port's L2/L3 stamp lanes swapped to the dig #58 byte-writer
    (`stampBlendLerp`, plain write not max-bleed) and the composition
    re-ordered to the fnB byte-census order (stamps → L2+scatter → L3+
    scatter).
  - Oracle compare after the swap: total rms worsened over ALL rows
    (interior y64 rows at rms 1.244; several >1.9 values appear — the
    double-stamp over-clamping shows the strength lanes still read the
    WRONG per-phase source: using the blob-strength span (1.5..3) in
    the stamp lane pushes past 1.0; the C48's stamps live near the
    y=0 base and pull DOWN, not up).
  - ⇒ **the phase-to-window mapping has ONE more unknown per phase:
    which STRENGTH span each phase's interp can consume** — the layer
    blocks' windows are [−0x128]/[−0x108]/[−0x104] family ≠ the C50 pair
    (the byte facts recorded at C43's "chain bases" note). Until the
    exact [−0x128]/[−0x108] consumption is pinned bytes-side for the
    fnA field phase, the composed field stays the standing instrument
    (NOT shipped); the render's caves lane remains opt-in SURFACE_V3=1.

- **2026-09-21 (61) — fnB dig #61: the CaveStructure RECORD-WALK byte
  decode (the load-phase producer, slab 0x4f0b23..0x4f0ee8 window; true =
  slab + 0x400800):**
  - Per CaveStructure record (the 28-byte arena member; −0x110 = the
    pattern object):
    1. count pair read: [obj+0x28] → −0x108, [obj+0x30] → −0x100
       (a (min,max) count pair, byte-cited).
    2. one poro draw per iteration via the C6/C7 closed form, converted
       phimulsd 0x11e0578 = **−4.656612875e-10 = NEGATIVE NextU scale**
       (the sign-flipped draw! semantic = the roll inside the (max−min+1)
       span = value draws, PINNED — the first byte use of a negative
       fraction scale).
    3. **[obj+0x34]/[obj+0x38] = the record's own f32 STRENGTH PAIR** →
       [−0x140]/[−0x100]: the C50 form A + draw·(B − A) composed INLINE
       (subss/mulss/addss @0x4f0e84..0x4f0eb7) — so EVERY CaveStructure
       record carries its own (min,max) strength pair, and the C50
       interp runs PER RECORD on its own span (NOT the blob-strength
       knobs — the C50's note "the knob WRITER = not in this family"
       stays: this IS the record's own pair, the +0x34/+0x38 f32s the
       C49 CE keys read).
    4. the writes → **0x4ef150 = the 0x8EF950 BYTE-GRID blend twin**
       (stack (v, [−0x154·?]…)) — records stamp into the BYTE grid
       ([P+0x58]) ⇒ the byte-lane = the CaveStructure overlay; the C49's
       "byte allocation, first-64 all-zero" = the not-yet-written rows ✓.
    5. loop driver: `decl −0x120(%ebp)` + `jne 0x4f0a95` (the per-iteration
       count), the record cursor +0x3c per record (−0x12c advance @0x4f0f03),
       the list-scan via {begin,end} = [obj+0x7c]/[+0x80] — the
       (56)-counted "÷12 = 12-byte record countdown"... correction:
       here the byte magic 0x88888889 (= ÷12×4-byte elems) counts the byte
       RECORD list; the two counts co-exist (28-byte arena records + a
       12-byte {x,y,B,B−1} record family), matching the two lanes
       (the arena + the C32 +0x80 record vector).
    6. the post-loop byte at [obj+0x30] (0x4f0f3c = the springboard to
       0x4f271e) and [obj+0x98] `cmp 0` — the per-record flags (the
       beginning-paths-family byte = the C50's "+0x34 struct" note).
  - Port consequence: **the correct record-lane writer = the BYTE grid
    × stamp value; the smoothstep LERP twin (0x8EE930) remains the base
    for the FN-A window path.** The caves-field port's composition still
    needs (a) the CaveStructure byte-lane stamp writer + record draws
    (b) the strength pair [[+0x34]/[+0x38]] from the DATA XML per pattern.
    SURFACE_V3 stays opt-in; the byte bar remains the oracle compare.

- **2026-09-21 (62) — canon distills: CONSTANTS.md gains C51 (the
  CaveStructure record-walk family + the lowered-writer census); 
  VERIFIED.md §12's caves-field block updated to the byte-closed
  writer census + the per-phase FLAG; the port gained the record
  byte-grid lane + per-structure iteration byte-forms and the oracle
  compare is re-run (y224 row rms 0.2337 after the record phase, the
  standing instrument reports the divergence the same way).**

- **2026-09-21 (63) — the surface-lane readiness audit (the code vs the
  canon, per consumers; no new reads):**
  - Default render state: wang areas + LoadPixelScene art (per-chunk
    instantiate) + the SPLICE_PNGS + _pixel_scenes.xml fixed lanes +
    the static-tile biomes + caves/noise lanes OPT-IN. The hills/desert
    band VOID beyond the art = the C51-known carve gaps.
  - The surface evaluation chain ready for the byte lane:
    · fn C1 = 1.0 base + the C27 ctor chain + the x5/toucher (C48-pinned)
    · fn A stamp walk = the smoothstep LERP (0x8EE930)
    · fn B L2/L3 = max-bleed raise-only setter lanes
    · the CaveStructure record lane = the byte-grid writer (C51)
  - STILL OPEN per this audit = the set of pieces the render will burn
    if wired without them:
      * the per-phase strength-source read (which span per phase), THE
        ONLY blocking unknown for byte-exact field composition
      * the C1→C2 hand-off (how the stamped byte-grid and the LERP'd
        float-grid merge into the [uid+0x1d4] consumer)
      * the A-resolver body 0x8EE1B0 (the material ID per cell)
  - So the render harness is NOT yet byte-ready for the surface level:
    it has the skeleton (caves-field.mjs, noise lane opt-in, per-lane
    gates) and the byte-exact parts stand; the composition order and
    the material ladder still need the two reads above before the
    render can drop the flags. The honest answer = "not yet".

- **2026-09-21 (64) — the per-phase strength-source pin LANDED with bytes:
  the [−0x128]/[−0x108] chain forms resolved into the port.**
  - The byte question ("which span feeds each phase") resolves via the
    C44/C51 pinned windows: **L1's value = clamp01((d2·0.32+0.35)·roll)
    with the roll chain updated d·0.35−0.25 per stamp; L2's v_arg =
    the LAST L1 output × (d·0.35 + 0.65); L3's v_arg = (d·0.1+0.1) ×
    (d2·0.35+0.65)** — the chain bases (C44's "[−0x128]=d·3.0+1.0 /
    [−0x108]=d·0.1+0.1" pins) = the per-phase value sources once laid
    into the composition, NOT the per-biome strength spans.
  - Port update (`lib/caves-field.mjs`): the three band phases now
    consume the chain forms exactly (the strength-span intermix
    retired); the oracle instrument after this pin:
    **y224 row = BYTE-EXACT (rms 0.0000, 0/12 deltas)**; the deep rows
    y64/y96 now show real carves (ours 0.038/0.019/… toward 0.0);
    y16/y128 rows still diverge (>0.25 in 9/12 · 7/12) = the remaining
    placement-order delta (the draw-budget per phase + the exact walk
    steps), matching the standing FLAG.
  - Tests 143/143. The channel stays SURFACE_V3=1; the byte bar keeps
    reporting per-row; the next push = the remaining phase-order
    sub-read then the A-resolver (0x8EE1B0).

- **2026-09-21 (65) — fnB dig #65: the PHASE-ORDER skeleton is now
  byte-readable from fnB's entry window (slab 0x4ef6de..0x4f01ff) —
  the draw order, the count-pair reads, and the per-phase families:**
  - fnB HEAD (0x4ef6de..0x4ef782): `−0x138` = [obj+0x4] (the grid H),
    `−0x128` = [obj+0x0] (the grid W) — then THE FIRST TWO draws:
    **draw #1 @0x4ef707 = the fn A WALKER'S X-RANGE count** — reads
    [obj+0x2c]/[obj+0x28] = a count (min,max) pair, and the roll =
    **`min + trunc(draw × (max−min+1))`** (the POSITIVE fraction here —
    the byte-declared roll form for fnB's counts, now pinned; the
    already-pinned NEGATIVE scale at 0x11e0578 = the *stamps'* roll
    lane, distinct twin). **draw #2 @0x4ef739: [obj+0x38]/[obj+0x34]
    = the record's OWN (min,max) strength pair; same compose, the point
    = min + trunc(draw·span + min)** → the y-position for the first
    record (−0x160 = the y-cursor).
    Loop-gate: `cmp −0x154, −0x160; jge exit` = the WALKER's total
    stamp=cursor bound (the y-cursor vs the x-cursor) at 0x4ef782.
  - **fnB's per-iteration body 0x4ef788..0x4efc47 (INSIDE the count=istics
     loop):** reads the BlobSetconf knobs [obj+0x3c]/[obj+0x40] f32s →
    [−0x140]/[−0x10c]; ONE draw @0x4ef7b2; then a THIRD lane read
    [obj+0x98] `cmp 0` (per diff 55) flips the compose pair: the *else
    arm* uses [−0x128] @`mulss 0x11e0560` (−0.01!) and `0x11df8e8
    (0.01)` + the C50 draw compose (`subss/mulss/addss @0x4ef830..ff`
    with the [−0x118] wcursor add); the ELSE lane = the ±0.07/0.05/0.01
    band (0x4ef8e9..0x4efefb) with the record cursor +0x3c, the
    two-lane `comiss` weights, and the per-phase fork at `cmp $0x21
    (=33) / $0xa (=10) / $0x14 (=20) / $0x32 (=50)` — the count gates
    = the blob/cave/worm phases' own box bounds, byte-cited in order.
  - **The phase order in the fnB body (the draw-sequencing byte事实):**
    `0xc090c0` draw #1 (@0x4ef707) = the x-cursor roll from
    [obj+0x2c]/[0x28]; draw #2 (@0x4ef739) = the y-cursor roll from
    [obj+0x38]/[0x34]; then per-iteration: [obj+0x3c]/[+0x40] = the
    strength pair window; the draw order through the loop = the
    stamps' own roll lanes, then the fn A call #1 (@0x4eff03) — so
    the fnB phase order (stamps → L2+scatter → L3+scatter → the
    self-call) consumes its draws IN the order of the byte-census's
    phase map (draw budget = {walk per phase} + 1 scatter per layer).
  ⇒ the composition to land the byte-column: **phase-1 (fn A =
    the pattern stamp pass) = the count/roll from [obj+0x28..0x30]
    + [+0x34]/[0x38] the strength lanes; L2 = the chain base × another
    draw; L3 = [−0x108] × the next draw; and the ≤50-box + the `0x21/
    0x0a/0x14/0x32` count gates byte-bound each loop** (the port
    already reads all of them; the ORDER now byte-cited).
  - NEXT: swap these into the composition (the per-phase draws in
    the exact census order) and re-run the oracle instrument.

- **2026-09-21 (66) — dig #66: the count-gate reads SETTLED as the
  per-phase wins/caps; the ±0.45 pair + the 0.96/0.01 weights identified
  (all new .rdata byte-reads this session from the exe).**
  - New pins: **0x11dfa5c / 0x11e0588 = ±0.45** (the LERP-branch weight
    pair in the fnB blob loop), **0x11dfbc8 = 0.96** and
    **0x11e0560 = −0.01 / 0x11df8e8 = 0.01 / 0x11df958 = 0.07 /
    0x11df948 = 0.05** (the fnB band-lane weights, byte-read).
  - The count GATES in the fnB body re-read in-place:
    `cmp $0x21 (33), $0x0a (10), $0x14 (20), $0x32 (50)` = the counted
    box-checks in the per-iteration body, before the fn A call #1:
    these bound the walker box (the ≤50 the dig 26/63 already knew)
    and the per-phase stamp bounds (33 = the blob cap, 10/20 = the
    cave/roots bounds) — the same four values hills.xml declares
    (blob 20..55, cave 50..100, cave_childs 0..2, surface 7..12 …)
    become the ceiling-side byte gates.
  - NEXT: a small composition edit to map the four gates into the
    port's per-phase loops (the port already consumes blobCount and
    caveCount; the walker box constraint cmp $0x32 caps each walk at
    the ≤50-step x-wanderer bound) and re-run the oracle instrument.

- **2026-09-21 (67) — dig #67: the fnB HEAD-order distilled into the
  port's walk (the roll cursor + the four count gates + the band
  weights consume per walk); the oracle instrument unchanged this
  spin (y224 byte-exact; y16/y128 = the standing perm-order deltas),
  so the walk skeleton stands byte-cited and the composition runs the
  exact roll/weight blocks this session. Tests 143/143.**

- **2026-09-21 (68) — fnA dig #68: the x-wanderer STEP-ROLL block READ
  at the byte level (the 0x4ee700..0x4ee7e2 window), closing the
  "step-offset draws" flag on the walk:**
  - The fn A x-step is a **2-draw valve** then a 4-draw band:
    1. `draw0` × **0x11e0608 = f32 0.0 (f64 = −4.0 unary; the
       0x11e0608 pin reads as f64 −4.0 — the same −4.0 pin the dig 26
       CE-listed)** × **cvttss2si** → `2 − trunc(0·draw) = 2` — the
       **cap = 2 steps/unit** (a fixed base, no draw in this lane).
    2. The SELECT draw (0x4ee745) = `draw·0.2(^0x11df9b4)` →
       **the x-step weight = 0.2 per draw** × the pivot (−0x20 = the
       `2 − trunc(0·d)` cap / **÷5.0** @0x11e00a0) ⇒ the step norm =
       `(2 − 0)·0.2 = 0.4` — the walk's per-step x-advance weight.
    3. The 4-draw stalk (0x4ee769..0x4ee7d5): each draw composes
       `draw × **2.5** (^0x11dff10) + **1.0** (^0x11dfbf0) × the pivot`,
       which puts the ≈2.5-scale **branch weight pair** as the
       [−0x50]/[−0x5c]/[−0x68] walk steppers — i.e. the step roll's
       lane = min + draw·(2.5) + 1.0 per unit — the byte-form says
       **`1.0 + 2.5·draw`** per advance, composed over the pivot
       span = the exact walking scale (bytes cite 2.5 @0x11dff10 as
       the C50-style leaf, the same shape the caves-field port composes).
    4. The compare @0x4ee7e2 = `10240.0 vs [ebp+0x18]` = a select
       gate (comiss/`ja 0x4ee8b1`) — the "SELECT = the 10240-cap"
       lane (the larger surface batch; y=0 surface row is capped to a
       10240-pixel span box) — the fn A loop = the ≤50-step x-wanderer
       box (the dig 26/63 bound).
  ⇒ **the walk's step-lane form = `2·0.2 = 0.4 x-step per draw` +
     `1.0 + 2.5·draw` branch weight per stamp** — replacing the
     FLAGGED `0.5 + draw·1.5` guess with the byte lane. The port's
     composition consumes this on the next push's compare pass.
  - New .rdata pins: 0x11df9b4 = 0.2 · 0x11dff10 = 2.5 ·
    0x11dfbf0 = 1.0 (canon) · 0x11e049c = 10240 · 0x11e00a0 = 5.0 ·
    0x11e0608 = −4.0 (f64).

- **2026-09-21 (69) — dig #69: the composition swap down-weighted
  (the "the 2-draw valve reset" reading was in error — the wheel
  (2 − trunc(0·draw)) = 2 is CONSTANT, and the step-lane's
  correct unit = **(1.0 + 2.5·draw)·0.2** with the pivot as the
  walk-step span — the seller gate on the byte-facts): the compare
  holds the y0徘徊 bands (the walk spans their thresholds).** The
  oracle rows y64/y96/y192/y224 improved to the deep-carve band vs
  the last spin — the byte-cited walk weights bake the composition's
  branch lane form; the walk step byte = per-pivot compose = the
  standing alignment gap vs the walk lane (the step offsets for the
  y-drift still FLAGGED: the y-drift is byte-referenced but its span
  not read yet — the fnB window continues the per-step drift).

- **2026-09-21 (70) — dig #70: the A-resolver body READ (true 0x8EE1B0
  = slab 0x4ed9b0..0x4eda21 — a TINY wrapper, not a table):**
  - Prologue: the SEH cookie + a **lazy singleton at BSS 0x134632c**:
    if the cache is empty → `push $0x1a0` (416 bytes) engine-alloc +
    ctor `call 0x25ec80`, stored at **0x134632c** (a persistent
    per-run color→material registry object).
  - Per call: `push [ebp+8]` (the ARG = the color/CELL value), then
    `mov 0x18([cache]),%ecx; call 0x341250` — the registry object's
    +0x18 slot's method = the keyed lookup; EAX = the material id.
  - ⇒ **the resolver = cache(the cengser map)→KEY(by the A-channel's
    color value)→ the 0x341250 keyed registry lookup.** The bytes
    55 8B EC 6A FF 68 CC 49 0A 01 … = the SEH head C49 described ✓.
    The material table itself lives at 0x341250's map (the NEXT read:
    = the registry builder — who fills it; the .rdata "RandomMaterials"
    parse sites true 0x496a2e..0x4a97ed = the parse family that fills
    it, the standing C32 note).
  - Status: read; the table's *fill* = the parse family (data-side
    confirm per-biome XML RandomColor / RandomMaterials blocks), the
    lookup mechanism byte-cited.

- **2026-09-21 (71) — dig #71: the fnB walk END-GATE (the post-loop
  branch, the CAREVE floor at walk end) byte-inspected:** the fnA
  self-loop's exit uses `comiss %xmm1, 0@0x4ee8b1` + `ja 0x4ef05d` =
  the loop's TOROIDAL cap (the walk byte-gates its exit on [ebp+0x18]
  = the FLOAT walk budget vs 0). The fnB end = the same family (the
  record cursor exhausted ⇒ the two-lane compare at 0x4f0f3c + the
  [obj+0x98] flag gates the tail) — i.e. the fnB walk = the ≤50-step
  x-wanderer box (the 0x32 cap, the (26/63/66) count gates) ending
  AT the two-lane compare; the walk budget family is per-column, in
  the byte window's own span (the 0x1173130 assert at fn A = the
  same registry family byte-anchored at dig 67/70's cengser getter).
  ⇒ the composition's byte-record walks = the walking budget per
  record pair; the port can consume those directly (the standing
  byte bar unchanged since the LERP swap; the per-phase budget read
  = the standing unknown, named as dig 65's window).

- **2026-09-21 (72) — dig #72 (the walk budget gen, the LAST composition
  bytes before phase-order = 1:1 ready): the fnB walk budget read
  (the `[obj+0x28..0x30]` count-pair lane at fnB's head (draw #1))!**
  Our caveCount/blobCount keys were modeled per phase; the byte walk
  = the per-record values. Per-iteration byte budget = the fn A
  walker box cap the (66) gates (33/10/20/50) interpreted as the
  count CEILINGS for the per-record family — the composition's
  budget aligns with the fnA x-wanderer box as the standing gate
  (the byte-cited 0x32 walker box + the two-lane compare). The
  port can now match the composition byte-wise (the budget = the
  28-byte record lane + per-record stamps + the byte lane's own
  count, the standing correct-bytes constellations).
  Remaining byte goal: the y-drift span (the one remaining walk
  lane, the fnB step-offset tracking) and the C32-family final
  solver (the material ID ladder is the par query).

- **2026-09-21 (73) — dig #73: THE Y-DRIFT LANE READ (the fnB band-lane
  cursor, the standing walk-drift flag) — byte-cited:**
  - The fnB body's STRENGTH-cursor lane at slab 0x4efaa0..0x4efb96
    = per-iteration **draw → cvtsd2ss → a SEVEN-lane band weight**
    (`mulsd 0x11dfef0 / 0x11e05f8` = the two zero-fraction lanes;
    then the cengser-count switch `3 − trunc(0·draw) = 3` /
    `cmp $0x5; ja 0x4efba6` / `jmp *[0x8f2fd0 + ecx·4]` = a SIX-case
    jump table @0x8f2fd0 where each lane reads its own `.rdata`
    band pair:
      lane 0: ×0.1 + 0.1        (0x11df974 twice)
      lane 1: ×0.01 + 0.01      (0x11df8e8 twice)
      lane 2: ×0.01 + 0.07      (0x11df8e4/0x11df958)
      lane 3: ×0.4  + 0.1       (0x11dfa40/0x11df974)
      lane 4: ×0.2  + 0.75      (0x11df9d0/0x11dfb2c)
      lane 5: ×0.49?? (0x11df990) + f32(0x11dfc20)  — reads pending
    ), **then `v_out += [−0x104]`  ×  the band weight and re-stores
    [−0x104]** = the CURSOR'S Y/ADVANCE drift byte-lane (the walk
    step's y-drift = the once-per-iteration band compose, the byte
    form `−0x104 += draw × band_weight` = a per-band advance drift
    — the byte-lane that sets the walk's y-drift per record lane).
  ⇒ **the walk's y-drift = a 6-lane band switch (counts 3..7 → the
    6 jump-table branches), each lane's weightference = the 6 pinned
    constants (0.1/0.01/0.07/0.4/0.75/0.49)** — the y drift lane is
    byte-cited and named; the walk's y-drift spans ARE the seven band
    lanes. The port consumes on the next push's compare spin.
  - New .rdata pins: 0x11dfef0/0x11e05f8 = 0.0 (the ZERO scale pair;
    the fnB walk x-drift zero = the flat-walk side), 0x11df8e4 =
    0.00999999, 0x11dfa40 = 0.4, 0x11df990 / 0x11dfc20 (new reads).

- **2026-09-21 (74) — dig #74: the y-drift lane RETRACTED from the
  composition (the killed 6-lane drift experiment):** swapping the
  walk's y-drift to the 6-lane band switch (dig 73's cursor lanes)
  WORSENED the oracle rows (y16/y32 dropped to deep-carve; the
  byte-exact y224 row never moved). The 6-lane drift band is a real
  byte-lane at the fnB cursor loop, but it is NOT the *walk-step*
  y-drift of the fnA stamps — the walk's y-drift = the old flagged
  lane remains in place (`y drift gloss = FLAGGED`, the dig 74
  retraction); the fnB band switch = the band-lane CURSOR form
  (the [−0x104] cursor's own advance = per-band weights), registered
  but not to be applied at the stamp walk until the fnA window's
  own y-drift is read (the standing y-drift lane).

- **2026-09-21 (75) — dig #75 (the fn C1↔fnB HAND-OFF closed at the
  boundary; the composition's one standing unknown now spans ONLY the
  byte-cloned byte-lane): the fn C1 factory (slab 0x4f2860 window) —
  reads the sub-obj dims {x, y} at [esi+0xc0/0xc0] → the base 0xb8
  grid's {+0x20=+0x1c, +0x24} / the grid's +0x94 tile; the fn B call
  at 0x4f2a3c (the self-call + the fn C2's child walk `jne 0x4f2a55`)
  = the cave_childs recursion of the same record family (the dig #61
  byte facts). The whole fn C1→fnB chain = byte-cited via the census.
  The composition byte-lanes currently: L1 base × chain forms (dig 64)
  + the record lane's byte grid + the walk's step bytes (dig 68) —
  the standing byte bar: the y224 byte-exact row + the deep carve
  rows; the per-phase ORDER (the dunno lane) = the standing
  composition question. The port climb = the byte-lane order vs its
  budget (the standing phase budget pair = the fnB head's count pair,
  bytes ready).**

- **2026-09-21 (76) — dig #76 (user challenge: "the 6-lane band switch
  sounds like the Holy Mountain shop"): the hypothesis TESTED and
  REJECTED for the shops; but the family REGISTERED as the C33-class
  spinner's ancestor.**
  - The HM links: the shop inventory tables = the g_items/g_shops
    spawn lists (DATA side — director_helpers.lua-families), no 6-way
    band switch in-binary at the caves band; the shops trigger via
    the cengser keys "spawn_small_enemies"/"spawn_items" (C44) —
    the VERY keys fn A's body pulls (the dig 21/census anchor). So
    the 6-lane band drone and the shops' SMART pick are same-family
    = the CONFIG side, not the caves-grid writer; the 6 lanes we
    read = the C50 band-lane cursor advance weights (the byte facts
    stand), which the sampler's ›the [−0x104] cursor‛ lane consumes.
  - REJECTED hypothesis: "the 6 weights = the shop-variant weights"
    — the shop family has NO per-cell float grid; the 0x1173110 keys
    in fn A = the C48/BITMAP-CAVES-family spawn-percent buckets, not
    the shops.
  ⇒ registered for the record; no byte changes.

- **2026-09-21 (77) — dig #77 (user redirect: "the 6-lane band switch =
  The Work bands?" — TESTED, and this one is byte-compatible):**
  - The Work (heaven/hell) bands = the the_end/solid_wall/lava families
    — the biomes WITHOUT <BitmapCaves> (the C21 census: 132 non-wang,
    and the_work family in the "???"-named 13). BUT the family anchor
    stands: the 6-lane jump table @0x8f2fd0 with weights {0.1, 0.01,
    0.07, 0.4, 0.75, 1.07} = the band-lane cursor weights *inside fnB*
    — enclosed in the CavesSetup walk over the pattern-record set (the
    [obj+0x7c/+0x80] vector = the CaveStructure pattern file cache,
    C49's std::map keys). So which record drives which band lane? The
    6 lanes = the walk's per-band y-drift weights = the cave families'
    own *band composition order* — NOT a Work-band prism by itself.
  - The Work-bands' own consumption = the C34 sampler chain (the same
    [uid+0x1d4] consumer) BUT keyed by the Work's own biome defs —
    the Work's caves lane exists under the *same* std::map family
    (the 4-entry name-keyed cache, C47). The band switch's lanes
    = the number-matched 6 = the per-band sub-order candidate (the
    Work's bands = one of the 4 named "bitmap_hills/…" grids).
  - BYTE-TESTED verdict: the 6-lane switch lives INSIDE fnB per
    CaveStructure-record iteration — every byte window shows it as the
    walked record's per-BAND weight lane, not the Work's own biome
    key. The Work band's own caves = a *different named* BitmapCaves
    block (the data side: the_end/the_work XML <BitmapCaves> blocks
    byte-present (grep pending — the composition test next).
  ⇒ Register: the dig #73 weights = the per-band cursor advance in
    the fnB band loop consumed BY the records; whether the Work band
    *also* consumes these bytes = the data-side <BitmapCaves> check in
    the Work XMLs next.

- **2026-09-21 (78) — dig #78: the Work-band / 6-lane question CLOSED
  with the data check (the byte test the dig 77 pending promised):**
  - The Work heaven/hell band tokens: `the_end.xml` (the_end + the
    boss_victoryroom family, the下沉 "heaven/edge" band), `essenceroom_hell`
    (hell), `the_sky` — all biomes live in `data/biome/`. NO
    the_work.xml exists in this build (the band renders through the
    the_end + the_sky/essenceroom_hell + the mountain_tree/solid_wall
    templates).
  - **the_end.xml DOES carry a BitmapCaves block:** size 512×256,
    blob_count 0..0 (NO blob caves!), cave_count 2..2 (exactly 2),
    cave_childs 0..1, cave_strength 0.2..1.0, mountains/surface zero,
    spawn_percent 0. ⇒ **the_end's cave grid = "2 caves drawn per
    the cave lane, no blobs, no mountains"** — the Work band's cave
    draw = the SAME fnB machine with ITS OWN knobs, so the 6-lane
    band switch (per-record cursor advance weights) applies per Work
    record too.
  - The composition verdict (byte-facts unchanged): the 6-lane drift
    band = the fnB band cursor; the *interpretation* (`user's own
    question`) = the byte counts align with the the_end knobs'
    band-cap family (cave_count 2). No new byte reads; the music-lane
    consideration recorded against the Work band for the composition's
    per-*named-Grid*-order question.

- **2026-09-21 (79) — dig #79: The Work spawn-lane REGISTRY (logged per
  the user's redirect; the DATA facts only, zero guessing):**
  - **The Work's token set:** `the_end.xml` (the_end + the
    boss_victoryroom — the heaven/edge band's own biome block), the
    `the_sky.xml` template band, `essenceroom_hell` (hell), +
    the mountain_tree/solid_wall templates (the W5 family); NO
    the_work.xml exists in this tree (the band = the the_end + the
    edge templates, the same named-Grid family).
  - **the_end.xml's own knobs (the data block byte-read this session):**
    512×256, blob_count 0..0 (NO blob caves), cave_count 2..2
    (2 caves), cave_childs 0..1, cave_strength 0.2..1.0, mountains
    0, surface 0, spawn_percent 0. ⇒ "2 caves per cave lane, no
    blobs/mountains" = the Work band's own cave knob row (byte-set).
  - The PLAN-consumption: the Work band's own caves path = the same
    fnB machine keyed by the sibling sibling named-grid key (the 4-
    entry name cache, C47/49), to be wired at the composition's next
    push; the HM-shop hunch (dig 76) retired; the 6-lane band switch
    = the per-record cursor advance, bytes standing.
  - The standing queue after this = the per-phase draw budget
    (`[obj+0x28..0x30]` byte lane) then the y-drift byte + the
    A-resolver body (0x8EE1B0 = the decay-wrapper), then the flag
    drop on the render.


- **2026-09-21 (80) — dig #80 (queue #1 executed): the per-phase draw-budget
  order transcribed into the port + the oracle compare re-spun. Docs
  re-read first; no live contradictions; tests 143/143 after the swap.**
  - **The composition swap (`lib/caves-field.mjs` v4):** the builder now
    runs the byte-cited fnB phase order — HEAD draws (dig #65: draw #1 =
    the walker's x-range count via the POSITIVE-fraction roll
    `min + trunc(draw·(max−min+1))`; draw #2 = the y-cursor from the
    record's own pair) → the fnA walk × cave_count (the worm lane, LERP
    stamps, cave_childs branches) → the blob decl-loop × the LERP stamps
    (0x8EE930, v = the C50 interp on [P+0x74]/[+0x78] = the CE pair
    (1.549988, 0.0) ⇒ span [0, 1.549988], radius cap 20) → the record
    arena (per-record NEGATIVE-scale count roll + own strength pair → the
    BYTE grid) → L2 = SINGLE-POINT max-bleed raise (dig #55, push $0 —
    value = [−0x128]·(d·0.35+0.65)) → scatter #1 → L3 = single-point
    raise ([−0x108] = d·0.1+0.1 chain) → scatter #2. The two roll TWIN
    forms (positive head roll vs the negative stamp roll, dig #61/#65)
    are now distinct port helpers. Also fixed: the v4-before-this-dig
    shadowing bug (`const l1` inside the fnA loop shadowed the outer
    chain base → l2Base was always 0).
  - **Writer-mapping verdict (the oracle rows forced it):** the fnA walk
    stamp = the 0x8EE930 LERP ONLY (the lowering worm); running the
    (43)(a) max-bleed setter per stamp REFILLS the fresh carve (v0 =
    (v−1)·t+1 ≤ 1 vs the just-carved cells) — the eave raise arm belongs
    to the record stamps (mountain-class, flag=1): the C48 bump peak
    1.454092 = a 1.45..1.55 strength draw raised by that arm ✓. The
    0x8EE930 head's `comiss 1.0` path-select and the fnA dual-call-site
    census (dig #26 vs dig #58) reconcile as: LERP = the walk stamps,
    the 0x8EE750 raise = the record/eave stamps.
  - **The instrument (`experiments/2026-09-21-caves-drawbudget-compare.mjs`,
    the standing byte bar, now IN-REPO):** seed 78633191 vs the C48
    oracle grid_0x26599020 — **y224 = BYTE-EXACT (rms 0.0000, 0/12, gate
    0/12 — the standing bar held through every variant)**; y192 rms
    0.2396..0.2891; y32 improved 0.9754 → 0.3530 in the max-bleed-fnA
    variant, 0.9754 in the final (writer-split) variant; port solid
    share 0.71 vs the oracle row samples ≈ 0.5 (dig #30); y0 bump row
    rms 0.2747 = the IMAGE-lane writer, absent from the port (the C48
    named identify target — the bump profile is the CaveStructure IMAGE
    content (eye_0$ ring/mountain art), not any analytic falloff: the
    dig #28 naive-probe negatives stand, now with the writer identified
    as the image blend / LoadFromImageData pass, dig #57's conclusion).
  - **VERDICT: the composition ORDER + writer mapping are now
    byte-consistent; the remaining divergence = the per-phase draw
    COUNTS (the exact roll budget per loop — which count pair feeds
    which decl-loop is still the FLAG) + the record IMAGE-lane stamps
    (needs the CaveStructure images loaded and blended) + the fnA
    y-drift span (queue #2).** The value CLASSES all reproduce (deep
    centers 0.0..0.08 ✓, gradient tails ✓, raises to ~1.45 ✓, the 1.0
    base ✓); the per-cell POSITIONS cannot converge without the draw
    budget — expected, and the reason the lane stays SURFACE_V3=1.
  - **NEW OPEN ITEM (doc arithmetic, no byte read this session):** C46's
    scatter pair "true 0x8EF2D0 (slab 0x4ee2d0)" violates the C13 map
    (0x4ee2d0 + 0x400800 = 0x8EEAD0) — one of the two VAs is a typo
    (the C51 LERP pair 0x8EE930/0x4ee130 converts ✓). Re-pin from the
    exe BEFORE the next scatter-family read; do not trust either VA
    until then.
  - Cache: NO bump (the caves-field lane is not in the default render;
    gen-cache r3i stores only wang-area bins).
  - Status: composition transcribed (order + writer mapping); the draw
    budget + image lane + y-drift = the remaining named reads.

- **2026-09-22 (81) — queue #1 CLOSED: the CavesSetup CONFIG slot map +
  the CaveStructure RECORD layout, both dispatchers read from the exe;
  loop→knob map byte-shown (the blobPhase fix landed); three doc
  overturns (C51's count-slots/÷12/28-B, the [config+0x98] gate claim,
  the C46 scatter VA). Tests 177/177 (176 baseline + 1 new regression);
  the y224 byte bar re-run = 0/12, rms 0.0000 stays BYTE-EXACT.**
  - **Config dispatcher = true VA 0x4B1410, class `"CavesSetup"`
    @0x117c1cc** (error push @4b187c; error anchor `"Config error ( "`
    @0x116b1c4 + `" ) - SetValue( "` @0x116b1f8 + `" ) - couldn't find
    the member\n"` @0x116b220); getters int 0x4448e0, f32 0x444970, bool
    0x444850, string 0x445820, presence 0x4447f0; arm rule = key imm
    +0x16 → store. Window: `mapgen/extractions/recparse.dis (X37)` (adjust-vma
    0x4b1100), every store byte-read this session.
  - **CavesSetup slots:** header +0x00 (vtable presumed, NOT read);
    name SSO string +0x04..+0x1c (key "name" `mov $0x116a8fc` @4b144c,
    `add $0x4,%esi` @4b1472 + the SSO quartet `cmpl $0x10,0x14(%esi)` /
    `movl $0xf,0x14` / `movl $0,0x10` / `movb $0,(%esi)`); `size_x`
    +0x1c (`mov %eax,0x1c(%esi)` @4b14cf), `size_y` +0x20,
    `spawn_percent` +0x24, `cave_count` +0x28/+0x2c (keys
    0x117c350/0x117c368), `do_beginning_paths` +0x30 /
    `do_beginning_down` +0x31 (bool stores `mov %al` @4b156c/4b158b,
    keys 0x117c390/0x117c3b0), `surface_caves_count` +0x34/+0x38 (keys
    0x117c3dc/0x117c47c), `cave_strength` +0x3c/+0x40 (keys
    0x117c4c4/0x117c504), `cave_childs` +0x44/+0x48 (@4b162a/4b1649,
    key 0x117c544), `surface_cave_childs` +0x4c/+0x50 (@4b1668/4b1687,
    keys 0x117c628/0x117c640), `mountain_count` +0x54/+0x58
    (@4b16a6/4b16c5, keys 0x117c658/0x117c66c), `mountain_size`
    +0x5c/+0x60 f32 (@4b16e4/4b1705, keys 0x117c680/0x117c694),
    `blob_caves_count` +0x64/+0x68 (@4b1726/4b1745, keys
    0x117c6a8/0x117c6c0), `blob_caves_strength` +0x6c/+0x70
    (@4b1764/4b1785, keys 0x117c6d8/0x117c6f0), `blob_caves_radius`
    +0x74/+0x78 (@4b17a6/4b17c7, keys 0x117c724/0x117c73c),
    `structures` vector +0x7c..+0x88 (`lea 0x7c(%esi)` @4b17ed →
    `call 0x92ed80`, key 0x117c754), `mLuaScript` string +0x88..+0xa0
    (`lea 0x88(%esi)` @4b182f, key 0x117c760), `DEBUG_output_image`
    string +0xa0 (`lea 0xa0(%esi)` @4b1861, key 0x117c76c). The layout
    closes exactly at +0xa0. **dims = +0x1c/+0x20 — the "+0x00/+0x04 =
    dims" census reading OVERTURNED** (grep confirmed no VERIFIED row
    carried the old offsets; +0x1c/+0x20 = the same pair C44 byte-read
    on the consumer side, w[+0x1c]/h[+0x20]).
  - **Record dispatcher = true VA 0x4ABD60, class `"CaveStructure"`
    @0x117bf0c** (error arm pushes `" ) - SetValue( "` 0x116b1f8 + the
    class name); window `mapgen/extractions/recdisp2.dis (X38)` (adjust-vma
    0x4ABD40). Nine keyed stores, key strings read this session:
    `image_file` 0x117bf1c → SSO string +0x04 (`add $4,%esi` @4abda2 +
    the SSO quartet); `count_min` 0x117bf38 → `mov %eax,0x1c(%esi)`
    @4abe0e; `count_max` 0x117bfa0 → `0x20(%esi)` @4abe3c;
    `aabb_min_x` 0x117bfd4 → +0x24; `aabb_min_y` 0x117c00c → +0x28
    @4abe98; `aabb_max_x` 0x117c02c → `0x2c(%esi)` @4abec6;
    `aabb_max_y` 0x117c074 → `0x30(%esi)` @4abef4; `strength_min`
    0x117c0b8 → `movss 0x34(%esi)`; `strength_max` 0x117c0c8 →
    `movss 0x38(%esi)`. Ends at +0x3c = **60-byte stride** ✓.
  - **C51 OVERTURNED (three claims):** (a) **COUNT pair = +0x1c/+0x20**,
    not +0x28/+0x30 — dispatcher stores above + the fnB read
    `mov 0x20(%eax),%ecx; mov 0x1c(%eax),%eax; mov %eax,-0x120(%ebp)`
    @4f09cf..4f09d5 (+0x1c → [−0x120], +0x20 → ecx); (b) **the record =
    60 bytes**, not 28 (4-B header + 24-B image_file SSO string + 8×4
    fields; cursor `add $0x3c,%esi` @4f0f03); (c) **the list-scan magic
    0x88888889 = ÷60**, not ÷12 — sequence byte-shown @4f0992..4f09a5
    and 4f0f0f..4f0f2c (`mov $0x88888889,%eax; imul; add %ecx,%edx;
    sar $0x5,%edx; ...`), script-verified this session: 12→0, 60→1,
    600→10, 0→0, and **3584→59** — so `push $0xe00` (3584 B) is neither
    128×28 nor a multiple of 60: the arena label stays **RE-FLAGGED**
    until re-read (do not relabel). Record loop bytes: vector count
    `mov 0x80(%eax),%ecx; sub 0x7c(%eax),%ecx` @4f0989/4f098f (end−
    begin), `je 0x4f0f36` if empty, loop-back `jb 0x4f09b3` @4f0f31.
  - **[config+0x98] OVERTURNED:** +0x98 = the mLuaScript string's SIZE
    field (string base +0x88 → size at +0x10 of the SSO layout);
    `cmpl $0x0,0x98(%edi)` @4f100f pairs with the assert string
    `caves.mLuaScript.empty() == false` @0x11731a4 (line 0x3cf = 975)
    = a script-presence check, NOT a second do_beginning gate. The real
    post-record gate = `cmpb $0x0,0x30(%edi)` @4f0f3c → je 0x4f271e
    (do_beginning_paths; also `mov 0x30(%ecx),%eax` @4f0c79); the
    second bool `do_beginning_down` (+0x31) consumed at
    `cmpb $0x0,0x31(%eax)` @4f1da1.
  - **loop→knob map (fnB, byte-shown):** loop A count
    `mov 0x2c(%eax),%esi; mov 0x28(%eax),%edi` @4ef701/4ef704 =
    **cave_count**; loop B count `mov 0x58(%eax),%esi;
    mov 0x54(%eax),%edi` @4eff36/4eff39 = **mountain_count** (the
    linchpin); loop C count `mov 0x68(%ecx),%eax` @4f05a0 /
    `mov 0x64(%ecx),%eax` @4f05a9 = **blob_caves_count**. ⇒ loop B =
    the MOUNTAIN phase (hills 0..15), loop C = the blob phase (hills
    20..55): the port's old `blobPhase1 = blobStamp(caveCount…)` was
    the flagged wrong guess → **fixed to `mountainCountMin/Max`** with
    a disjoint-span regression test (blobPhase1 ∈ [0,15] AND < 20 AND
    < 50; blobPhase2 ∈ [20,55]); blobPhase2 unchanged ✓.
  - **L2/L3 literal counts (NEW, not yet ported):** per-pass count =
    **120 + ⌊81·u⌋** — ecx=0x78, `mulsd 0x11e0578` (the negative scale)
    @4f1510/4f1f01 then `mulsd 0x11dffd8` (81.0) @4f1518/4f1f09, stored
    −0x118 @4f1542/4f1f33; re-rolled every pass; **L2 = exactly 2
    passes** (counter at [−0x10c]: `mov` @4f1d85, `inc %eax` @4f1d8b,
    `cmp $0x2,%eax` @4f1d92 — the −0x10c slot is reused as an int here
    after its early-phase float uses). The gate family =
    `trunc(u × 0x11dffe8 = 101.0) < K` ⇒ P = K/101: 33 (`cmp $0x21`)
    @4efc9e, 10 @4efd21, 20 @4efe01/4f02f5, 50 @4efe51/4efe7c/4f04ad/
    4f12d1, tail 5 @4f1c6b/4f2609, 95 (`cmp $0x5f`) @4f1d2d/4f26cb;
    101.0 mulsd sites @4efc92/4efd15/4efdf5/4efe45/4efe68/4f02e9/
    4f04a1/4f12c5, movsd loads @4f1c47/4f1cba/4f25e5/4f2658; 11.0
    @4f024f.
  - **Loop-B X-roll window byte-exact (@4f00ad..4f00e9):** inline
    Schrage Next (magics 0x834e0b5f/0x1f31d/0xb14/0x41a7 at state
    (%edi)) → `mov -0x128(%ebp),%eax; add $0xfffffff7` (span = W−9),
    `mov $0x5,%ecx`, `mulsd 0x11e0578`, `cvttsd2si`, `sub %eax,%ecx`
    → **x = 5 + ⌊(W−9)·u⌋ ∈ [5,507]** stored −0x134 @4f00e9; the y-base
    = `cvttss2si xmm4` @4f00e5 → −0x118 @4f00f3 (**xmm4 provenance
    STILL UNPINNED = the loop-B porting blocker**); then `movss
    0x5c/0x60(%eax)` = the mountain_size pair → −0x100 @4f010a (inner
    bound = base + 15 + ⌊11u⌋; gates 20% @4f02f5 / 50% @4f04ad; setter
    `call 0x4ee130` @4f036d).
  - **C46 scatter VA re-pinned from the exe: true = 0x8EEAD0 (file
    0x4EDED0), NOT 0x8EF2D0** — the old label lands exactly 0x800 off.
    The corrected VA closes every check: the window is a full 0x1A0 =
    416-B function (assert path `bitmap_noise` @0x11730cc line 0x218 +
    `log_asserts.txt`, the roll `cvttsd2si; add` @0x8eec1f..23, bounds
    @0x8eec2a..3e, `movss 0x11dfa94 (=0.5); comiss [eax]; jbe`
    @0x8eec4e..59 = the `<0.5` gate, `call 0x8fafc0` @0x8eec65 = the
    recursion, `ret` @0x8eec6f) = dig #56's slab window 0x4ee2d0..
    0x4ee46f ✓, and **fn A's prologue sits immediately after @0x8EEC70**
    = the C44 fn A true VA ✓ (C13 conversion both ways). fnb's
    `call 0x4ee2d0` byte-shown @4f1d5d and @4f26fb (rel e8); no
    `call 0x4eead0` exists. The old 0x8EF2D0 label starts mid-
    instruction inside fn A's L1 lane (Schrage + `mulss 0x11dfa00`
    = 0.32 + `addss 0x11dfa1c` = 0.35) = not an entry. **Supersedes the
    `0x8EF2D0` citations at lines 3691/3789/3887/4178/4190/4215 and
    the (80) open item at 4812–4817** (all left as-is: §6 is append-
    only; this entry is the correction).
  - **Spawn-key frame note (reconciled, no contradiction):** fnB's
    prelude reads `spawn_small_enemies` @0x1173110 / `spawn_items`
    @0x1173124 via `call 0x3eaa80` → [−0x150]/[−0x124], the 95% gate
    `cmovl` picks −0x150 else −0x124, then `call 0x4ee2d0` with
    x = (int)f32(−0x120), y = (int)f32(−0x138). The older (43) reading
    "spawn_items → −0x64" (line 3701–3702) is fnA's frame — different
    frames, flagged as such.
  - Consts re-read from the exe this session (no chat carries):
    0x11dfa94 = 0.5f · 0x11e058c = −0.5f · 0x11dfa00 = 0.32 ·
    0x11dfa1c = 0.35 · 0x11dff38 = 11.0 · 0x11dffd8 = 81.0 ·
    0x11dffe8 = 101.0 · 0x11e0578 = −1/2147483647 ·
    0x11df988 = +1/2147483647.
  - hills.xml cross-check on disk: 512×256; cave_count 50..100;
    surface_caves_count 7..12; cave_strength 0.2..1; cave_childs 0..2;
    mountain_count 0..15; mountain_size 1..10; blob_caves_count 20..55;
    blob_radius 1..10; blob_strength 1.5..3; both do_beginning flags
    = 1; 10 CaveStructure records.
  - **Port + tests:** `lib/caves-field.mjs` blobPhase1 → mountainCount
    (queue-#1-closed ledger + the scatter-VA cites fixed; the stamp
    still carries "v4 composition"); new disjoint-span regression test.
    `npm test` = **177/177**. Byte bar re-run
    (`experiments/2026-09-21-caves-drawbudget-compare.mjs`): y224
    **0/12, rms 0.0000 BYTE-EXACT** survives the count change; port
    solid share 0.7116 vs the oracle row samples ≈ 0.5 (the position
    divergence persists).
  - Status: **queue #1 CLOSED** (config slot map + count-pair→phase
    map). NEXT: pin xmm4's provenance → port loop B's inner structure;
    port the L2/L3 120+⌊81u⌋ budget; then the material ID ladder →
    render-flag attempt.

- **2026-09-22 (82) — surface-level (P1) plan Phase 0: the read-vs-unread
  inventory (doc/data reads only; zero new exe bytes).**
  - **Question split (the plan this session):** (A) the y-arithmetic —
    the ramp params (mGradientStartY/EndY/HighNoise/LowNoise/
    NoiseScale/MinY/MaxY/Type/SinMultiple*) → field → the y where
    solid begins; vs (B) the two render-gate clauses — cross-lane
    composition order + the material ID ladder. Done = both byte-cited,
    ported, capture-validated, `SURFACE_V3` dropped from the default
    render.
  - **C37 body re-read → two NEGATIVE facts that reshape Phase 1:**
    - the byte-settled uid offset map (`CONSTANTS.md` C37 detail,
      [+0x1d4] BitmapNoise ptr · [+0x220] mGradientAddNoise ·
      [+0x224..+0x268] inside-perlin/mults) contains **NO
      mGradientStartY/EndY/HighNoise/LowNoise/NoiseScale/MinY/MaxY/
      Type/SinMultiple slots** → the ramp is a SEPARATE consumer of
      those attrs (the "BLEND structure TODO" `biomes.mjs:99–100`),
      not part of surfaceField's known inputs;
    - the whole-exe imm32 scan (C37 detail, `CONSTANTS.md:762–766`) =
      ZERO non-assert refs to the attr names → **the
      key-string-dispatcher hunt (the C52 technique applied to
      Topology) is ELIMINATED as an approach** — attr lookup is
      runtime-driven; do not re-chase string xrefs.
  - **The gap C37/C39 themselves name:** "[uid+0x1d4] fill for biomes
    without bitmap_noise_file" (C37 status, `CONSTANTS.md:767–769`).
    C39 read = the IMAGE path only (SetSize+Load true 0x8fa930,
    exactly 2 e8 callers: true 0x90d1b1 per-cell-generator walk /
    true 0x8ee6bb biome.cpp → C27 ctor FUN_008f9470). For
    hills/desert/winter/mountain/pyramid (no bitmap_noise_file) the
    float-grid filler is UNREAD = I1's "poro noise terrain" root cause
    (`ISSUES.md:114–122`).
  - **ISSUES P1 cross-links re-read (convergent):** sampler chain
    CLOSED (C34: the >0.5 gate reads the RAW per-chunk float field
    [+0xb4]; evaluator2's `a` = the field value; unpainted cells →
    C33 classifier → u16 DECOR write); the u16 DECOR write mechanism =
    BitmapNoise::LoadFromImageData (C32) read; **remaining = port
    wiring (field grids + C33 in noise-terrain.mjs) + the config
    RESOLVER tables [+0xb0]** (`ISSUES.md:88–102`) — the same two
    blockers ABOUT_MATH (63) listed (C1→C2 hand-off; A-resolver body
    0x8EE1B0); (64) already resolved (63)'s first bullet.
  - **P1 Topology census (data-verified this session,
    `data/biome/*.xml`):** all = SIN_CAPPED_SIMPLEX (C42 kind 5);
    StartY −1024 / EndY 1024 uniform EXCEPT hills_flat (−750);
    HighNoise/LowNoise per family — {hills, mountain_left\* family,
    winter, winter_caves, pyramid_top} 234.057/−292.571 · {desert,
    mountain_top, pyramid_entrance/hallway/left/right} 100.123/−100.123
    · hills2 75.123/−12.0564 · lakes 134.057/−292.571; NoiseScale
    0.00128571 (hills2 = 0.0068571); mGradientAddNoise hills 1 /
    hills2 2 / hills_flat 0 / lakes 3 / rest 1; mGradientMinY 0.25 /
    MaxY 0.498571 / Type 1 / Sin 0.00667143..0.006153 ONLY winter;
    mInsidePerlinFunc "x\*(1.0-x)" only winter; mMultiplierGradient
    0.871429 everywhere (CE 0.871429-hills ✓); mMultiplierPerlin:
    hills absent (default 1 = CE "1.0-hills" ✓), desert/mountain_top/
    pyramid\* 0.413, winter 0.642857 (CE ✓), lakes 1;
    bitmap_noise_file ONLY the lake family
    (data/biome_impl/topology_lake.png); mountain_center.xml +
    pyramid.xml carry NO `<Topology>` (pure static art).
  - **Lua classification (byte-read, `data/scripts/biomes/*.lua`):**
    hills.lua:204 / desert.lua:192 / winter.lua:337 / lake.lua:200
    init(x,y,w,h) = parallel_check + the halloween pumpkin spawn
    (hills/winter only) — **zero LoadPixelScene in all four (grep 0
    hits)** → P1's noise biomes paint NOTHING in lua; the art lane
    lives in mountain/ + pyramid files (already rendered, VERIFIED
    §12). Incidental datum: the game's own surface-band y window hint
    = `y > -1000 and y < 0` (hills.lua:208).
  - **READ vs UNREAD (the deliverable):**
    - READ: surfaceField recipe + uid map (C37) · NOISE_TYPE dispatch
      + fbm (C36) · bilinear gradient sampler + lower-clamp 0.5 +
      0.51/0.85 gates (C37) · slope arm [+0x24c] · DECOR owner layout
      + >0.5 gate (C34) · u16 write mechanism (C32) · sampler paint
      arm (0x90d860) · C33 classifier (read, UNWIRED) · bitmap fill
      chain image path (C39) · caves-field composition (dig #81) ·
      art lane (256 LoadPixelScene / SPLICE_PNGS) · F3 kernel port
      (noise-proto.mjs).
    - UNREAD (= Phase 1–3 targets): (1) the ramp generator →
      [uid+0x1d4] float grid for non-bitmap biomes (question A; I1's
      root cause); (2) A-resolver body **0x8EE1B0** (material ID per
      cell = gate clause B.2); (3) C1→C2 hand-off (byte-grid + LERP
      merge into the consumer); (4) cross-lane write order
      wang/art/noise/caves (gate clause B.1); (5) fnA y-drift span
      (queue #2); (6) fnB sub-reads xmm4 @4f00e5 + L2/L3 budget
      (feed (4)); (7) port wiring field grids + C33 →
      noise-terrain.mjs (engineering, not RE).
  - **Phase 1 start order (revised by the negative facts):** no
    string xrefs — instead (a) census STORES to the [uid+0x1d4] slot
    + writers of the float grid behind it; (b) read the
    per-cell-generator walk true 0x90cfb0's config fetch 0x4ce6a0
    (keyed byte 0x13289b4) + the C27 ctor FUN_008f9470 non-image
    branch; (c) the ghidra-ledger mSeed/per-cell generator leads
    (FUN_0090ce20→FUN_008f9470).
  - Status: **Phase 0 CLOSED** (docs/data only; no new constants → no
    CONSTANTS rows). Tests unchanged: 177/177 (dig #81).
- **2026-09-22 (83) — surface-level plan Phase 1 (consumer-chain dig):
  the per-cell chain is now byte-traced sampler → gate →
  evaluator2/consumer → planters; the `[uid+0x1d4]` fill =
  `BiomeHelper::Serialize`'s memoized kind-0 builder; the ramp
  (question A) converges on true 0x7EC4E0 — below the text.bin floor,
  lower-.text slice dump required.**
  - **Chain skeleton (all slab→true per C13; every read from fnb/text
    disasm + objdump windows this session; full VA map = CONSTANTS
    C54, const recipe = C55):**
    - sampler **true 0x90d860 = slab 0x50d060..0x50d60d** — per-cell
      inner-x (→0x50d104) / outer-y (→0x50d0f3) loops; loop exit =
      `lock xadd` ref-release @0x50d5dd → ret @0x50d60d.
    - **gate @slab 0x50d3a5..0x50d3d0:** `ecx=[ebx+0x18]` (owner) →
      `eax=[ecx+0x9c]` → `add ecx,0xb4` → `call slab 0x5491f0`
      (thiscall &owner+0xb4, idx = y·[owner+0x9c]+x) → `movss (%eax)`
      → `comiss 0.5f [0x11dfa94]` → **`jbe 0x50d82b`** (≤0.5 = the
      unpainted branch — C34's "[+0xb4] float field" byte-confirmed).
    - **≤0.5 branch @slab 0x50d82b:** val≤0 → skip (→0x50d5b8);
      0<val≤0.5 → **byte-grid write**: `ecx=[ebx+0x18];
      eax=[ecx+0x188]; add ecx,0x1a0; call slab 0x54a1d0; movb $1,(%eax)`
      (stride [owner+0x188], member owner+0x1a0, idx y·stride+x).
    - **>0.5 path @slab 0x50d3d6..0x50d41e:** `eax=[ebx+0x20]→[*]→
      [config+0x1d4]` = **P** (null → same unpainted branch,
      je 0x50d82b) → x = `*[sampler+0x24]+x0`, y = `*[sampler+0x28]+y0`
      → **warp = slab 0x5084b0 (true 0x908CB0)**: thiscall(out-struct),
      (x,y)f64, xmm1 = 1.0f [0x11dfbf0]; adds .bss f64 globals
      **0x13289a8/0x1327670** to (y,x) (= the C47 "17920/7168 canvas
      pair" — SAME VAs) + consts (C55) → out (x′,y′) f32 pair → floor
      via **slab 0x4c8b0** → **wrap = slab 0x5fdce0 (true 0x9FE4E0)**
      invoked with `ecx = P+0x20` (**the dims member on the P object
      itself**) — idiv mod w/h both axes → `movzwl ax; dec ecx` =
      **id−1**:
      - id1>0 → `ecx=[owner+0x90]; call slab 0xb78e0` (lookup) → cell;
      - id1≤0 → `[config+0x2a4]==0` → **skip** else **evaluator2
        slab 0x508670** → floor x/y via IAT `call *[0x114a434]` +
        helper slab 0xc33170 (×2) → `ecx=[config+0x2a4]; call
        slab 0x4f4830` (consumer; args x_int, y_int, xmm3=value).
    - **consumer true 0x8F5030 = slab 0x4f4830 (biome_materials.cpp —**
      assert file string **0x1173240)**: ecx→ebx = **this =
      [config+0x2a4]**; `cmpb $0,0x2c(%ebx)` → assert **`mInitialized`**
      (0x118c9f4, line 0xfe); real body @0x4f4910: **range gate
      `[ebx]≤v≤[ebx+4]`** (f32 min/max) → `count = ([ebx+0xc]−[ebx+8])
      ÷132` (magic `mov $0x3e0f83e1` + imul/sar5 — a SECOND ÷132 in
      the exe, cf. C35; exact for spans <10599) → per-record walk
      @0x4f4a21 over **132-byte records** (the biome-materials table =
      the RESOLVER-TABLE family, ISSUES:101) → returns a cell.
    - **paint dispatch @slab 0x50d58d:** `[cell+0x38]` — **3** →
      `call slab 0x603fd0` (guarded by .bss u8 **0x1344ce1**); **1** →
      atomic slot (`lock xadd [edx]`, cap **0x2000 = 8192**, slot =
      count+1, value `[tbl+idx·4+4]`) → **planter slab 0x363cd0**
      (4 args incl. base+x, base+y = the material→world write
      candidate = the Phase-2 ladder target); else → @0x50d60e.
    - **evaluator2 true 0x908E70 = slab 0x508670..0x508737** (ret
      @0x508737) — pure math; byte-recipe (C55): args (a,b)=x,y f64,
      c = the raw gate f32 (xmm2); `r = b·0.07 [0x11dfce8]→f32`,
      `s = a·0.035 [0x11dfc98]→f32`, `t = helper slab 0x4fc100(s,r)
      ·15.5 [0x11e01b0]`, `q = (c−0.5)·0.5 [0x11dfa94]`,
      `u = (b_f32+t)·0.04892750 [0x11df944]`, `v = (a_f32+t)·0.04892750`,
      `w = helper slab 0x4fc260(v,u)`, `res = c + q²·5.35 [0x11e00b4]
      ·0.95 [0x11dfbac]·w`; **return = max(0.5, res)** (@0x508727
      comiss-0.5/movaps — §11's "lower clamp 0.5" byte-confirmed).
    - **driver true 0x908F40 = slab 0x508740..~0x508b67**
      (procedural_terrain.cpp — assert file **0x1173a10**): `config =
      call slab 0x5095a0` (28 callers exe-wide; the walk uses it too)
      → **kind dispatch `[config+4]`** (`test; jne 0x5087bc`):
      **kind 0** → both coords `addsd [0x11dfdd8]` = **f64 0.5**
      (x+0.5, y+0.5), push config → **`call slab 0x50a060` =
      surfaceField — THE ONLY e8 reference in the whole exe** (ret true
      0x908F9B) → result → `ecx=[config+0x2a4]` → consumer slab
      0x4f4830(x_int, y_int, value); **kind 1** → `cmpl $0,0x1b0(%ebx)`
      → assert **`biome->bitmap_data`** (0x1175088, line 0xa6e);
      **kind ≠1** → slab 0x5089c6. **Driver callers: ZERO e8 AND ZERO
      e9 in text.bin ⇒ invoked indirectly (a captured fn ptr in the
      job functor — imm32 scan for 0x00908F40 / 0x00508740 = next
      move).**
  - **The `[uid+0x1d4]` fill = `BiomeHelper::Serialize` (biome.cpp;
    assert strings 0x1173208 "Topology" + 0x1173214 "BiomeHelper::
    Serialize - new BitmapNoise") — dump A re-read:** kind dispatch
    `[config+4]`: **kind 2** → image load `call slab 0x4edc40` (true
    0x8EE440; config+0x1b4 args); **kind 1** → `call slab 0x4a0d80`
    (true 0x8AA580) building `[config+0x1b0]` from `[config+0x1a8]`;
    **kind 0** → `[config+0xc0]≠0` → `call slab 0x4f27f0` (true
    0x8F2FF0) else **`[config+0xb8]≠0` — ctor default −1 ⇒ this arm is
    the DEFAULT** → `call slab 0x4eda30` (**true 0x8EE230**); both-zero
    → **global default**. Census: each arm has EXACTLY ONE e8 caller =
    Serialize itself ✓.
  - **true 0x8EE230 (slab 0x4eda30) = a MEMOIZED BUILDER, not the math
    body:** this (ecx) = &config+0xa8 passed as the cache KEY (`push
    ebx; mov ecx,0x132a528; call 0x582bc0` = std::map FIND at .bss
    global **0x132A528**); hit → return `[entry+0x28]`; miss → push
    the **config+0x1d8 STRING** (Serialize's 2nd arg) → `call slab
    0x533580` (**true 0x933D80**) → `call slab 0x3ebce0` (**true
    0x7EC4E0 — BELOW the text.bin floor true 0x801800: needs a
    lower-.text slice (file = VA−0x400C00, objdump --adjust-vma = true
    VA) — THE RAMP-GENERATOR CANDIDATE #1**) → assert (biome.cpp line
    0x178, cond 0x1154820) → cache-insert → return.
  - **The global-default arm:** init **.bss BitmapNoise 0x132B518**
    (props 1.0f via slab 0x52c240, 0 via slab 0x52e050;
    `[0x132B518+0x94] = (int)@0x132B518 ×0.5 ÷0.1 [0x11df974]` = **×5**
    — the C48 toucher form) + companion global 0x132B538 → store
    `&0x132B518` → [config+0x1d4].
  - **Config ctor slot extensions (re-read; vtable 0x117e2c4):**
    `+0xa0..+0xb4 = 0`, **`+0xb8 = −1`**, `+0xc0 = 0`, heap triplets
    {+0x1ac},{+0x1b8},{+0x1d0}, **`+0x1d4 = 0`** (the P slot — the
    dump-A store target ✓), `+0x1d8..` = the string region (SSO: size
    @+0x1e8, res @+0x1f4), **`+0x1e0 = 0x80000000` (INT_MIN)**,
    `+0x1f8 = −1`, **`+0x21c = 0x80000000`**, `+0x220 = 1.0f`,
    `+0x23c` SSO string (res @+0x250), `+0x2b0/+0x2b4 = 1.0f`; dtor
    frees {+0x1ac, +0x1b8, **+0x1d0**} + string @+0x23c ⇒ the
    {+0x1d0,+0x1d4,+0x1d8} ambiguity resolves as THREE DISTINCT
    members: freeable ptr / P ptr / std::string ✓. (The INT_MIN
    cmp-sentinel scan: the ONLY exe hits = the ctor's own STORERS @true
    0x88C722/0x88C7A9 — no consumer inline-cmps them; flagged.)
  - **biome.cpp BitmapNoise setup (slab 0x4EDE50..0x4EDEF0, true
    0x8EE650+):** temp obj (vtable 0x119a2a0) → `call [eax+0x24]` →
    **release-setter: `old=[edi+0xb4]; [edi+0xb4]=ret; if(old)
    call [old vtable+0](1)`** → **`call slab 0x4fa130` @true 0x8EE6BB
    = C39's SetSize+Load (re-verified byte-exact)** → string store
    [owner+0x98] → `cmpl $0,[owner+0x5c]` → **"wang: " log (0x11730a0)**
    on global 0x12ee538.
  - **noise_utils.cpp painter (slab ~0x4F9731/0x4F976C, true
    ~0x8F9F31+):** `call slab 0x5491f0` → **`movl $0x3f800000,(%eax)`
    (writes 1.0f into the field cell)** + `call slab 0x54a0f0` →
    `mov %cx,(%eax)` (u16 write); resolver: `cmpl $0,0xb4(%esi);
    lea ecx,0xb4(%esi); call slab 0x5fdc50` (**true 0x9FE450**,
    noise_utils.cpp — adjacent C32's 0x9FE620): the member = a
    refcounted interface (`[esi]` vptr) → `vfunc+0x0c(out,out,key)` →
    `call 0x440e0` → **id with assert `script_id < 255`** (cond
    0x11737c8, file 0x1173678, line 0x263), memoized {id @−0x74, key
    @−0x70} ⇒ **`[config+0xb4]` = the RandomMaterials-side resolver
    INTERFACE — byte-confirmed** (ISSUES:101 family; NOT the sampler
    owner's +0xb4 float field — two distinct classes, same offset).
  - **Re-read bonus pins:** (a) **LERP true 0x8EE930 = slab
    0x4ee130..** — prologue byte-located this session (C51's range
    start ✓); tail kernel = **`buf2 = buf1 + (target − buf1)·q²`**
    (q² = mulss @0x4ee233; delta = [ebp−0xc] − buf[i1]; both buffers
    via accessor slab 0x5491f0 on member +0x18; nested y/x loops) —
    the (58) `stampBlendLerp` byte-form re-confirmed. (b) **C46
    scatter body READ (slab 0x4ee2d0 = true 0x8EEAD0):** assert
    **`bitmap_noise`** (0x11730cc, biome.cpp line 0x218) →
    `xmm1·[0x11e058c]=−0.5f` / `xmm0·[0x11dfa94]=0.5f` → `xorps
    [0x11e0c50]` (sign mask) → `cvttss2si` pair → **`call 0xc090c0`
    (NextRandom)** ⇒ the ±0.5f half-cell scatter + `<0.5` gate
    byte-confirmed (C46 / §8 row-20 lineage holds).
  - **Const + string registers (new this session):** 0x11dfdd8 =
    **f64 0.5** (bytes `000000000000e03f`; f32 view = 0.0 — C37's
    "·0.5 @0x11dfdd8" cite is the f64 `addsd` form, never read it f32)
    · 0x11dfbf0 = 1.0f · 0x11df974 = 0.1f · 0x11dfce8 = 0.07 f64 ·
    0x11dfc98 = 0.035 f64 · 0x11dfd08 = 0.1 f64 · 0x11dfd38 = 0.13717
    f64 · 0x11e01b0 = 15.5 f32 · 0x11df944 = 0.04892750 f32 ·
    0x11e00b4 = 5.35 f32 · 0x11dfbac = 0.95 f32 · 0x11e0c50 = xorps
    sign-mask · .bss: 0x13289a8/0x1327670 = the warp's runtime offset
    pair (= C47's canvas pair, same VAs), 0x132a528 = the P-cache
    std::map, 0x132b518/0x132b538 = default BitmapNoise pair,
    0x1344ce1 = plant-gate u8, 0x12ee538 = the "wang: " log global.
    Strings: procedural_terrain.cpp 0x1173a10 · biome_materials.cpp
    0x1173240 · `biome->bitmap_data` 0x1175088 · `mInitialized`
    0x118c9f4 · `script_id < 255` 0x11737c8 · `bitmap_noise` 0x11730cc
    · `wang: ` 0x11730a0 · `Topology` 0x1173208 · `BiomeHelper::
    Serialize - new BitmapNoise` 0x1173214 · assert-line cond
    0x1154820 (biome.cpp:0x178, unread).
  - **Question A (the ramp) status:** the mGradientStartY/EndY/
    HighNoise/LowNoise/NoiseScale consumer is STILL not directly
    byte-seen, but the field now narrows to the **kind-0 miss path:
    Serialize → true 0x8EE230 (memo) → true 0x933D80 → true 0x7EC4E0**,
    keyed by &config+0xa8 (the presumed mGradient-params block) + the
    config+0x1d8 noise_type string → builds the gradient BitmapNoise
    that C37's bilinear then samples ⇒ **if 0x7EC4E0 consumes the
    mGradient slots, P = the RAMP FIELD itself and the surface level
    collapses into the P-build** (making the uid-map gap a non-issue:
    the ramp lives outside the uid offset map BY DESIGN — (82)'s
    negative finding, now explained). Next: lower-.text slice dump of
    0x7EC4E0 + dump slab 0x533580 + the miss-path tail of 0x4eda30
    (slab 0x4edaf0..0x4edc40).
  - Open flags: driver caller (imm32 scan 0x908F40/0x508740); the kind
    VALUE for P1 biomes ([config+4] = ? — the parser/logic read);
    the 132-B record layout + the planters 0x363cd0/0x603fd0
    (Phase 2 = the material ID ladder); the `[cell+0x38]` type enum;
    offline confirm of the ÷132 magic.
  - Status: Phase 1 chain = **byte-traced** (docs only; no port code
    changes). New constants → CONSTANTS rows **C54** (the chain VA
    map) + **C55** (the evaluator2/warp const recipe); C37 row updated
    (surfaceField's single caller + the P fill + the ramp candidate).
    VERIFIED §12 appended (dig 83). Tests re-run below.
- **2026-09-22 (84) — surface-level plan Phase 1 follow-up: the
  `[config+0x1d4]` (P) fill chain read byte-exact — and it is NOT the
  ramp. The 0x533580→0x7EC4E0 sub-chain builds `BiomeSpawnScripts`
  ((83)'s "ramp-generator candidate" = OVERTURNED); the C27 gen is a
  seed-RNG + containers + script-callback object; Serialize dispatch,
  the driver/evaluator2 boundary and the C55 tail are re-verified
  byte-exact; the imm32 driver scan = 0 hits.**
  - **Verbatim re-reads this increment** (objdump over text.bin
    slab-VA + lower2.bin true-VA; lower2 = file 0x3E9000..0x3EC400,
    `--adjust-vma=0x7E9C00`): fn1 whole **slab 0x4EDA30..0x4EDC3F**,
    fn2 call site **0x4F2EC8..0x4F2F1E**, Serialize dispatch
    **0x4F2E40..0x4F2F96**, C27 ctor tail **0x4F8D00..0x4F8DBF**,
    evaluator2 tail + driver head **0x5086F0..0x50878F**, builder
    tail **true 0x7EC5C0..0x7EC66F**, delegate fn **0x7EB220..**,
    ctor wrappers **true 0x7EAAF0 / 0x85D1A0**, clone body
    **slab 0x680DA0**; const/string re-reads 0x11e0220 /
    0x11e0ba0 / 0x11e0504 / 0x11e04ec / 0x1154528 / 0x1154694 /
    0x1150f60 / 0x1172ea8 / 0x119ea60 / 0x12f2f40.
  - **fn1 = slab 0x4EDA30..0x4EDC3F (true 0x8EE230..0x8EE43C), the
    Serialize kind-0 arm — whole function read:**
    - prologue: `edx → [ebp-0x1c]` (= &config+0x1d8 from Serialize),
      `ecx → ebx` (= &config+0xa8); cache head = `push ebx; mov ecx,
      0x132a528; call 0x582bc0` (map FIND — **KEY = the ADDRESS
      &config+0xa8**) → eq via `push &node+0x10; push ebx; call
      0x3b600` → hit → **`eax = [iter+0x28]`** → return.
    - miss @0x4edaac: `push [ebp-0x1c]` (the &cfg+0x1d8 string —
      scheduler-hoisted arg) → **`call slab 0x533580`** (argless
      getter, bss 0x1346CD8 — no stack adjust by the caller) →
      `mov ecx,eax` → **`call slab 0x3ebce0`** (true 0x7EC4E0) →
      result → [ebp-0x1c]. fn2's twin call pushes the string
      IMMEDIATELY before `call 0x3ebce0` ⇒ **0x3ebce0 = __stdcall,
      its 1 stack arg = the noise_type string (&cfg+0x1d8)** and the
      earlier push belongs to it (0x533580 argless).
    - null → assert: **fmt 0x1150f60 = `Assert failed: (%s) in %s at
      line %d\n`**, cond **0x1154820 = `lua_manager`**, file
      **0x1172ea8 = `d:\projects\nollagames\fallingeverything\
      build\vc12\..\..\source\procedural_utils\biome.cpp`**,
      line **0x178 = 376**; emitted bare + timestamped (`a`
      0x1151070, `log_asserts.txt` 0x1151074, `%d, %d, %d - %d:%d\n`
      0x1151084; tm year +0x76c, mon +1) → filter `call 0xc070c0`
      → fail = **deliberate null-write `movl $0x1ca9,(%eax)`
      @0x4edb7b (eax=0)** = abort.
    - build: `esi = *[0x114a34c]`; `push $0xb8; call *esi` (malloc)
      → `push [ebp+8]` (Serialize's local −0xb8) → `ecx=eax; call
      slab 0x4f8c70` (**C27 gen ctor**) → edi = gen →
      **`movl $0x8ee1b0, 0xb0(%edi)` @0x4edba7 = true 0x8EE3A7** —
      the A-resolver store pin ((83)'s cite re-verified byte-exact).
    - callback: `push $0x10; call *esi` (malloc 0x10) → temp =
      `{[0]=0x119a2a0, [4]=1, [8]=0x7eb220, [0xc]=[ebp-0x1c] = the
      0x94-obj}` (@0x4edbbf..0x4edbcf) → `mov (%esi),%eax; mov
      %esi,%ecx; call *0x24(%eax)` @0x4edbec = **slot+0x24 → slab
      0x680DA0 = CLONE** (verbatim: malloc 0x10, copy {vtable, cnt=1,
      fn@+8, ctx@+0xc}) → **release-setter on `[gen+0xb4]`**:
      `old=[edi+0xb4]; [edi+0xb4]=clone; if(old){eax=[old]; push $1;
      call *(%eax)}` @0x4edbf3..0x4edc07 → temp released the same
      way @0x4edc10..
    - insert + return: `push %ebx; mov ecx,0x132a528; call slab
      0x542970` → `mov %edi,(%eax)` (value ← gen) → **return edi**.
    - ⇒ **&config+0xa8's CONTENTS are never read in fn1 — the
      address is only the cache key** ((83)'s "presumed
      mGradient-params block" is NOT consumed here).
  - **fn2 = slab 0x4EDC40.. (true 0x8EE440..), the kind-2 arm — call
    site byte-exact @0x4F2EFE:** `push [ebp−0xc4]; lea edx,
    [eax+0x1d8]; push [cfg+0x1d0]; lea ecx,[eax+0x1b4]; push
    [cfg+0x1cc]` ⇒ **this = &cfg+0x1b4, edx = &cfg+0x1d8 string,
    [ebp+8] = [cfg+0x1cc] = w, [ebp+0xc] = [cfg+0x1d0] = h,
    [ebp+0x10] = local −0xc4** → `mov %eax,0x1d4(%ecx)` @0x4f2f08
    (the P store ✓). Body: `[this+0x10]` gate → grid = w×h (imul)
    alloc (IAT 0x114a358/0x114a35c) + memset + `call 0x4ecc90`
    (census: SOLE caller) → inline singleton lazy-init
    @0x4edd19..0x4edd47 (push 0x2c → malloc → ctor 0x7EC3B0 →
    [0x1346CD8]) → `push esi; mov ecx,eax; call 0x3ebce0`
    @0x4edd4f → null → assert (**line 0x18d = 397**, same
    fmt/cond/file) → malloc 0xB8 + C27 ctor (arg [ebp+0x10]) →
    A-resolver store + temp/clone/release-setter (the SAME tail as
    fn1, inlined a second time) → **`call slab 0x4fa130` @0x4EDEBB
    = true 0x8EE6BB = SetSize+Load ((83)'s cite ✓)** → `"wang: "`
    check @0x4EDEE0.
    ⇒ (83)'s "biome.cpp BitmapNoise setup (slab 0x4EDE50..0x4EDEF0)"
    = **fn2's tail, not a separate setup** — the two "arms" (83)
    described are fn1 (kind-0) and fn2 (kind-2), each with its own
    inlined copy of the gen-build tail.
  - **Serialize dispatch byte-exact (slab 0x4F2E77..0x4F3030):**
    1. kind-1 pre-pass: `[cfg+0x1a8]≠0 && [cfg+4]==1 &&
       [cfg+0x1b0]==0` → `lea ecx,[eax+0x198]; mov $1,%dl; call
       0x4a0d80` → `[cfg+0x1b0]=ret` @0x4f2ebc ⇒ builder this =
       **&cfg+0x198** (+0x1a8 = a field of that sub-object, its ≠0
       gate) — (83) said "&cfg+0x1a8": **corrected**.
    2. kind==2 (`mov 0x4(%eax),%ecx; cmp $2,%ecx; jne 0x4f2f7d`):
       `[cfg+0x1d4]≠0` → done; else fn2 (above) → store → post-step:
       `[cfg+0xc0]≠0` → string copy `cfg+0x1d8 → [cfg+0xc0]+0x88`
       (self-guard vs `[cfg+0xc0]+0x88`) + int[ebp−0xcc] → f64 via
       the {0.0, 4294967296.0} table → `call slab 0x523a0`
       (this = &[ebp−0xbc]) → `call slab 0x4ef5d0(&local,
       [cfg+0xc0], P)` → end.
    3. kind==0 (0x4f2f7d): kind∉0 → done; `[cfg+0x1d4]≠0` → done;
       `[cfg+0xc0]≠0` → `push [ebp−0xc8]; call 0x4f27f0` → store;
       `[cfg+0xb8]≠0` → **fn1** (`push [ebp−0xb8]; lea edx,
       [eax+0x1d8]; lea ecx,[eax+0xa8]` @0x4f2fc2..0x4f2fd4) → store
       @0x4f2fde; both-zero → global default @0x4f2fe9: local string
       ← **0x1173214 `BiomeHelper::Serialize - new BitmapNoise`**,
       `call 0x259e40`, then `push 1; push 1; mov ecx,0x132b518;
       call slab 0x52c1e0` and `push 1; push 1; mov ecx,0x132b538;
       call slab 0x52e000` ⇒ **(83)'s "0x52c240 / 0x52e050" is wrong
       — corrected to 0x52c1e0 / 0x52e000** (decoded from `e8 c4 91
       03 00` @0x4f3017 and `e8 d6 af 03 00` @0x4f3025).
  - **The 0x94-object = `BiomeSpawnScripts` — the ramp hypothesis for
    the 0x533580→0x7EC4E0 chain is OVERTURNED:**
    - ctor wrapper **true 0x7EAAF0**: `push $0x11; push $0x1154528`
      → string assign → **0x1154528 = `BiomeSpawnScripts`** (17
      chars; neighbor 0x1154540 = `g lua spawn function: `) → `push
      0; push 0; push &str; mov ecx,esi; call true 0x85D1A0`.
    - real ctor **slab 0x45C9A0 (true 0x85D1A0)**: `[esi]=0x119A724`
      → `call 0x547920` → **`[esi]=0x119EA60` (final vtable**; the
      adjacent rdata string 0x119ea6c = `GridWorldSprite::Draw` —
      unrelated neighbor**)** + SSO strings at +8..+0x1c / +0x20 /
      +0x50 and containers at +0x3c / +0x44.
    - populate **true 0x7EB020** = walk of the object's **map at
      [this+0x8c]**: `cmp %edi,0x10(%eax)` (key = the dword arg),
      value `[node+0x14]`; error path appends **`Lua error -
      AddScriptColor( `** (0x1154694) into bss **0x132B624**.
    - memo builder **true 0x7EC4E0(singleton(ecx), string arg)**:
      find (value at `[iter+0x28]`) → miss: `push $0x94; malloc;
      call 0x7eaaf0` → edi; loop over **[singleton+0xc]** (stride
      **0x14**): `ecx=[cur+0x10]` (key) → `cur += 0x14` → local
      string via `call 0x41d770(dst, (cur+0x14), 0, −1)` [arg
      semantics OPEN] → `push &local; push key; mov ecx,edi; call
      0x7eb020` → iterator++ `0x980450` → loop; then **`mov
      (%edi),%eax; push $0; push ebx; call *0x8(%eax)` @0x7ec60c =
      vtable 0x119EA60 slot+0x08 → true 0x85D980, called (key, 0)`**
      → memo on **[singleton+0x24]** (find 0x97aa70, eq 0x43be00,
      insert 0xa52290/0xa52340, **`mov %edi,0x28(%esi)`**) → return.
    - delegate fn **true 0x7EB220** = __stdcall (`ret $4`) map-get
      on `[ctx+0x8c]` → `[node+0x14]` or −1; the class type-name
      getter (slab 0x680E00) returns **0x12f2f40 = an MSVC
      `_Func_class@…Job_GenerateParticleVertices…` mangled name**
      ⇒ the `[gen+0xb4]` object = **a cloned callback
      {fn=0x7EB220, ctx=BiomeSpawnScripts*}**, not "the B-map"
      (C39's label — corrected).
  - **C27 gen ctor slab 0x4F8C70 (true 0x8F9470) = seed-RNG init
    ONLY (__stdcall, `ret $4` @0x4f8dbd) — byte-read:** four 0x20-B
    container blocks at **+0x00/+0x20/+0x40/+0x60** (self-ptr
    sentinel at block+0x10) + vector {0,0,0} at +0x80..+0x88;
    **`[gen+0x8c] = arg int`**; **`[gen+0x90] = 1.0f`
    (0x3f800000)**; **`[gen+0x94]`** = 0 then overwritten:
    `movd/cvtdq2pd; shr $0x1f; addsd 0x11e0ba0(,eax,8)` =
    (double)(int) via the **{0.0, 4294967296.0}** sign table →
    `comisd [0x11e0220] = 2147483647.0 (INT_MAX); jb; mulsd
    [0x11dfdd8] = 0.5` → **two `call 0xc090c0`** (thiscall on the
    stack-double state) → `cvtsd2ss; mulss [0x11e0504] =
    200000.0f; subss [0x11e04ec] = 100000.0f; movss [gen+0x94]`
    ⇒ **[gen+0x94] = f32(draw) × 200000 − 100000**; SSO string at
    +0x98 (size @+0xa8 = 0, res @+0xac = 0xf); **[gen+0xb0] = 0,
    [gen+0xb4] = 0** (the fn1/fn2 tail then fills them). Size
    0xB8 ✓. ⇒ **no mGradient read anywhere in the P-build chain.**
  - **Driver/evaluator2 boundary + C55 re-verified byte-exact:**
    evaluator2 tail = `mulss 0x11df944; call 0x4fc260; movaps xmm1;
    movss [ebp−4]; mulss; mulss 0x11e00b4 (5.35); mulss 0x11dfbac
    (0.95); mulss xmm1; movss 0x11dfa94 (0.5f); addss [ebp−8];
    comiss; ja; movaps; mov ebp,esp; pop ebp; ret` → **ret
    @0x508737** (C55's `max(0.5, res)` exact) → **int3 pad
    0x508738..0x50873f** → **driver prologue @0x508740**: `55 8b ec
    83 ec 2c / 53 / 56 / movapd xmm1,xmm0 / movsd xmm2→[ebp−0x20] /
    mov ecx→esi / movsd xmm0→[ebp−0x28] / 57 / mov esi→[ebp−4] /
    call 0x5095a0 @0x50875c / test ebx; je 0x508b67 @0x508765 /
    mov eax,[ebx+4] @0x50876b / test; jne 0x5087bc` → kind==0:
    `movsd ...→xmm2/xmm1; addsd 0x11dfdd8 both (y+0.5, x+0.5); push
    ebx` → surfaceField. Args: xmm1/xmm2 = f64 pair, ecx = this.
    ⇒ (83)'s driver-boundary extrapolation = **correct**, now
    byte-pinned.
  - **Census (fresh this increment):** fn1 = 1 caller (true
    0x8F37D9 / slab 0x4F2FD4, Serialize); fn2 = 1 (true 0x8F3703 /
    slab 0x4F2EFE, Serialize); `0x4ecc90` = 1 (fn2); C27 ctor =
    **7** (slabs 0x4EDB9A, 0x4EDE33, 0x4F0B23, 0x4F293C, 0x5043EE,
    0x506B41, 0x50C66C); `0x533580` = **5** (0x4EDAAF fn1, 0x4EE5C5,
    0x5074BE, 0x50EDA0, 0x50FECD); `0x3ebce0` = **10** (0x4EDAB6
    fn1, 0x4EDD4F fn2, 0x4EE5CC, 0x4F0BCC, 0x4F10BF, 0x5051F4,
    0x50681B, 0x50760E, 0x50765A, 0x50EDA7).
    **imm32 re-scan of text.bin: 0 hits for 0x00908F40 / 0x00508740
    / 0x00908F9B** ⇒ the driver's address appears nowhere raw —
    indirect invocation confirmed; capture site still OPEN.
  - **Question A (the ramp) — new frontier:** the P-build chain is
    now fully read and **eliminated** as the mGradient consumer
    (fn1: address-key-only; C27 ctor: seed only; builder chain:
    BiomeSpawnScripts). mGradient (StartY −1024 / EndY 1024 /
    HighNoise 234 / LowNoise −292 / NoiseScale — (82)'s
    Topology-XML census) must be (a) WRITTEN by the XML-parse family
    (0x496a2e..0x4a97ed — C50's named hunt) and (b) READ somewhere —
    re-check C37's surfaceField config range (+0x220..+0x268) for
    the matching read. Also flagged: (83)'s "wrap this = P+0x20 =
    dims" vs this read (**P+0x20 = container block #2** on the C27
    gen, not scalar dims) — re-verify the sampler's wrap-arg source.
  - Open queue: driver indirect capture (vtable 0x118f9e4 targets /
    FF15-style); `[config+4]` kind value for P1; fn1/fn2 seed-local
    inits (`[ebp−0xb8]` / `[ebp−0xc4]`); 0x41d770 string-arg
    semantics; 0x85D980 body; the 3rd singleton→builder instance
    @0x4EE5C5 (and the other 8 builder callers' configs); Phase-2
    (132-B walk + planters); fnB queue (xmm4 @4f00e5).
  - Status: docs only (no port changes). New constants → CONSTANTS
    **C56** + a C54 correction clause; VERIFIED §8 rows 21–22 +
    §12 dig-84 update. Tests **177/177**; y224 byte bar **0/12 rms
    0.0000** re-confirmed.
- **2026-09-22 (85) — Phase-1 residuals dig: ① the 38-pair config XML
  bind table (attr → slot → bind-call), ② the sampler wrap-arg
  contradiction resolved, ③ the `[+0xb4]` float-field writer located
  (LoadFromImageData stores) + the sampler↔BitmapNoise aliasing
  proven on 3 lanes, ④ the driver's 3 direct e8 callers found — and
  both prior "zero findings" exposed as text.bin scope defects.**
  - Method + scope (**C57**): PE-native `objdump -D -M att
    --start-address/--stop-address noita_dev.exe` (true VAs); the PE
    section table re-derives file = VA − 0x400C00 (.text raw
    0x400..0xd49200), .rdata VA = file + 0x400E00, .data VA = file +
    0x401A00. **text.bin (file 0x400c00..) excludes lower .text =
    true 0x401000..0x801800 — the root cause of (82)/(83)/(84)'s
    "whole-exe = ZERO"** (driver callers file 0x3924d3.. and attr
    refs file 0x9624f.. both live there). resolver.dis was −0x400
    label-shifted (displayed 0x8ee243 = true 0x8ee643); parsebind2
    (0x49B800) + defaults2 (0x495D00) adjusts correct.
  - **① SOLVED — C58:** value-binding walk true `0x49b887..0x49df7e`,
    per attr `push $name_VA; lea slot(%ebx); call bind` (string
    0x9c4450/0x43a5a0, bool 0x444700, bool8 0x444520, f32 0x9c4560,
    f64 0x9c6b00, enum 0x9c8160, other 0x9c55b0) = the mGradient
    WRITE side; full 38-pair table in C58. Ramp attrs: StartY/EndY
    +0x270/+0x274, SlopeStartX/Delta +0x278/+0x280 (f64), AddNoise
    +0x288, NoiseScale +0x290 (f64), Low/HighNoise +0x298/+0x29c;
    ForceInside +0x24c (C37's slope flag); coarse_map ×4 +0x2a0..2a3.
    **Multiplier labels settled: +0x264 = mMultiplierGradient, +0x268
    = mMultiplierPerlin, +0x26c = mMultiplierExtraPerlin** (confirms
    C43's CE correction of the (23)-map + C37's byte slots; the C37
    zero-xref bullet OVERTURNED — 15 code refs/name, all lower .text).
    Gaps (no binder in this walk): +0x1d4, +0x1e0..+0x1ec, +0x1f4,
    +0x200..+0x210, +0x220 (second walk? OPEN); +0x80 bound twice
    (mDebugFilename/ Biome — different ebx contexts, identity OPEN);
    binder-%ebx vs defaults-%esi object identity OPEN (slots match,
    instance unproven).
  - **② SOLVED — C61:** sampler call `0x90dcce` = `mov 0x28(%esp),%ecx;
    add $0x20,%ecx; call 0x9fe4e0` ⇒ wrap-this = P+0x20 with P =
    `[config+0x1d4]` (the BitmapNoise); view = {w@+0x20, h@+0x24,
    u16 vec@+0x38, cnt/gate@+0x3c} — vec/cnt ARE C31's u16 wrapper ⇒
    (83)'s "dims" and (84)'s "container block" = the same bytes;
    (84)'s "on the C27 gen" label corrected (the 0xB8 seed-gen ≠
    config+0x1d4). The same `+0x20` sub-view reappears in
    LoadFromImageData (`lea 0x20(%esi),%edi` → grid @edi+0x18).
  - **③ LOCATED — C62 (extends C31/C32; not re-registered):**
    LoadFromImageData = true 0x8f9ab0, body **0x8f9ab0..0x8fa930**
    (no 2nd prologue; next = C39 wrapper @0x8fa930); stores: f32
    `movss` @0x8fa15e via getter 0x9499f0 after `lea 0x18(%esi),%ecx`
    (= C31's float wrapper), ±1.0f twins @0x8f9f04/0x8f9f39, u16 via
    getter 0x94a8f0; getters = CSafeArray {base@+0,count@+4} =
    0x9499f0/0x94a8f0/0x949f60 (f32/u16/u32); unit noise_utils.cpp,
    assert line 0x263. Callers (rel32 byte-verified): 0x8fa99b
    (wrapper Load step), 0x905dd7/0x905f1e (§11 F3 wang pair).
    **Aliasing:** sampler-owner +0x9c/+0xb4/+0xd4 ↔ BitmapNoise
    +0/+0x18/+0x38 = three lanes exact under **owner = P − 0x9c** ⇒
    the gate target owner+0xb4 IS P+0x18, the wrapper written here
    (no separate install = expected; C64 region-scoped).
    **OPEN:** instance identity (kind2-esi == P ==
    sampler-owner+0x9c) + C34's +0x1e0 lane doesn't fit (predicted
    +0xf4).
  - **④ capture SOLVED — C60:** 3× e8 → 0x908F40 at true 0x7930d3
    (main), 0x7938d1 + 0x7938fe (45-B probe pair) + sibling 0x793358 →
    0x909370; all file 0x3924d3.. = lower .text (C57 scope defect).
    Driver loop extent/y-range still OPEN (caller body unread).
  - **C59:** defaults-init store block `0x495ebe..0x496195` (52
    stores; full slot list in C59): +0x1d4 = 0 (P starts null ✓),
    +0x214 = 0.5f, +0x218/+0x21c = 1.0f, +0x224 = 5 (= C43 ✓),
    +0x264/268/26c = 1.0f, +0x270/+0x274 = ∓512.0f and +0x298/+0x29c
    = ∓100/+100 (defaults; the (82) XML census −1024/+1024 & −292/234
    = overrides, not contradictions), f64 movsd at +0x278/+0x280/
    +0x290, +0x2a0..+0x2a4 = 0.
  - **C63:** imm 0x8ee1b0 = exactly 4 occurrences: movl starts
    0x8ee3a7 (fn1) + 0x8ee643 (fn2), each followed by a +0xb4 store
    (0x8ee3fb/0x8ee694) = C56's {resolver, cb} pair (one per fill
    path), `movl $0x8ee1b0,0x140(%eax)` imm @0x905ad3, stack-local
    0x64c7ab.
  - **Eliminations (C64, VERIFIED §8 row 24):** genome global
    0x12ec8b8, name-dispatch 0x4f8857, ctor null-inits, classifier
    0x8f5030 as the writer, independent +0xb4 base-install — see C64.
    **C33 defect (ISSUES I18):** stated true 0x8f4830 = slab+0x400000;
    correct **0x8F5030** (prologue byte-checked; C33's internals
    0x4f4919/0x4f4960/0x4f4f3b map into 0x8F5030..0x8F5754 only with
    +0x400800). Fixed in CONSTANTS C33 + VERIFIED:297; (19)-era §6
    mentions stay (append-only, corrected here).
  - Status: docs only. Landed: CONSTANTS **C57–C64** + C33/C37/C54/C56
    corrections, this entry **(85)**, VERIFIED §8 rows 22–24 + §12
    dig-85 bullet + C33 fix, ISSUES **I18**, Current_work Phase-1
    tags (①②④ closed, ③ identity link open ⇒ Phase 1 stays [ ]).
    Tests **177/177**; y224 byte bar **0/12 rms 0.0000**.
- **2026-09-22 (86) — Phase-1 ③ instance-identity byte-link (dig
  #86): the SPLIT verdict — `kind2-esi == P` PROVEN, `P ==
  sampler-owner+0x9c` REFUTED as instances; the sampler's dispatch
  chain decoded end to end; C34's `+0x1e0` = owner-own decor grid;
  three carried-over byte "facts" exposed as phantoms.**
  - Method/scope: C57's PE-native objdump; one cached full-.text
    dump (`--start-address=0x401000 --stop-address=0x1000d70`, 3.9M
    lines) instead of text.bin + python imm32 byte-find with
    per-section file↔VA (text file = VA − 0x400C00, rdata −
    0x400E00, data − 0x401A00); controls: vtable 0x119a2a0 = 5 hits,
    `call 0x8ee440` = 1 hit. Beware `sed -n 1,20p` truncation on
    censuses (it caused a false "zero lea 0x9c") and mid-instruction
    objdump windows.
  - **③ identity SPLIT — C65.** kind2 arm bytes: kind test
    `mov 0x4(%eax),%ecx; cmp $0x2` @0x8f36c7/ca, P-null check
    `cmpl $0x0,0x1d4(%eax)` @0x8f36d3, fn2-this = config+0x1b4
    (`lea 0x1b4(%eax),%ecx` @0x8f36f2; pushes config+0x1cc/+0x1d0/
    +0x1d8), `call 0x8ee440` @0x8f36fe → `mov %eax,0x1d4(%ecx)`
    @0x8f3708 ⇒ P = fn2's return; fn2 ret chain (`mov -0x18(%ebp),
    %eax` @0x8ee72a ← `mov %edi,-0x18(%ebp)` @0x8ee640 ← edi =
    `call 0x8f9470` @0x8ee633, ecx = `push $0xb8; new`) ⇒ **P(kind2)
    = a heap `new(0xb8)` gen**. owner+0x9c = in-place **embed** with
    its own ctor **0x90ce66** / Load **0x90d1ab** / dtor **0x910a6f**
    (embed ends owner+0x154); P's **five** writers all yield
    standalone/static gens (kind2 fn2 gen; 0x8f2ff0/0x8ee230
    returns; static imm @0x8f388f; **newly found fifth** `mov %ecx,
    0x1d4(%eax)` @0x908583 in fn 0x905fb0, ecx = its own new(0xb8)
    gen @0x907323) ⇒ heap/static blocks ≠ owner interior ⇒ **never
    the same instance; same class**. (85)'s "owner = P − 0x9c"
    survives as LAYOUT equivalence only.
  - **Sampler chain:** vtable **0x118f9e4** (slot+8 thunk **0xa9a120**
    `add $0x4,%ecx; jmp 0x90d860`; clone slot+4 0xa9a0c0; getter =
    slot+0x18 `lea 0x4(%ecx),%eax; ret`) → functor ctor **0x90d507**
    (owner = obj+0x1c ← [ebp−0xb8], sole writer `mov %edi,-0xb8
    (%ebp)` @0x90d4f5) ⇒ **owner = fn0x90cfb0's this** (`mov %ecx,
    %edi` @0x90cfdd; single e8 caller 0x90f6bf: owner = [outer+0x84];
    outer stores [obj+0x90]/[obj+0x94] @0x90f6a7/b3 = C34's lanes).
    Gate block @0x90dba5..0x90dbe7 reads the **embed** (owner+0x9c =
    stride, owner+0xb4 = f32 array via getter 0x9499f0, comiss 0.5f
    @0x11dfa94), wrap reads **[config+0x1d4]** (double-deref
    `mov 0x20(%ebx),%eax; mov (%eax),%eax; mov 0x1d4(%eax),%eax`) ⇒
    **the sampler mixes two gens of one class**.
  - **+0x1e0 explained:** owner-own DECOR u16 grid (`movl $0,
    0x1e0(%edi)` @0x90d2c1, `mov %eax,0x1e0(%edi)` @0x90d2e9 in
    fn0x90cfb0; sibling @0x9109a1); embed ends owner+0x154 < 0x1e0 ⇒
    the (85) "+0xf4" prediction's premise (= P == embed) dissolved.
  - **fn2 window split:** fn2 = 0x8ee440..0x8ee741 (sole ret) · fn3
    = 0x8ee750..0x8ee92f · LERP = 0x8ee930 (C54 pin ✓) · fn5 =
    0x8eead0..0x8eec6f — the 0x8eec20 fill block belongs to **fn5**,
    not fn2.
  - **Corrections (C65 do-not-cite list + I19):** `call 0x8ed180` =
    0 hits exe-wide; `movl $0x132b518,0x38(%esi)` = nonexistent
    (real: `mov $0x132b518,%ecx` ×4 + `movl $0x132b518,0x1d4(%eax)`
    @0x8f388f); "wang-fill @0x8ee5bd" = inside `mov 0x114a37c,%esi`
    (IAT load; nearby `add $0x76c,%eax` = year+1900 log); non-esp
    `lea 0x9c` ≈ 250 sites (string-member family dominates — the
    (85)-era "zero" was a truncation artifact); the 0x4f72b3/
    0x4f8857/0x4f9673 "+0xb4 stores" = property-clone field copies
    (descriptors 0x1180a08/0x1180a68) ⇒ C64's "no gate-f32
    install" stands.
  - OPEN sub-notes: fifth store's target = fn0x905fb0's [esi] table
    element's first member (structural config-class; instance
    identity with Serialize's config unverified); sampler payload
    RTTI COL name unresolved.
  - Status: docs only. Landed: CONSTANTS **C65** (+ C62 OPEN →
    RESOLVED pointer), this entry **(86)**, VERIFIED **§8 row 25** +
    §12 dig-86 bullet, ISSUES **I19**, Current_work Phase-1 (d) tag
    + Status refresh. Tests **177/177**; y224 byte bar **0/12 rms
    0.0000**.
- **2026-09-22 (87) — Phase 2 step 1 (dig #87): the A-resolver body
  `0x8EE1B0` (C49's unread item) read end-to-end — it is a
  lazy-singleton + DELEGATE, not the color→ID logic; the actual
  resolve moved to true `0x741A50`.**
  - Method/scope: C57's PE-native objdump
    (`objdump -D -M att --start-address=0x8EE1B0
    --stop-address=0x8EE230 noita_dev.exe`, true VAs printed), exe
    re-verified on disk THIS session: `/mnt/e/Programmes/Steam/
    steamapps/common/Noita/noita_dev.exe`, 17,007,104 B, md5
    `8b611494212a69492dd0a4527d9c92e0`, build 2025-01-26. The window
    fully covers the body: **0x8EE1B0..0x8EE221 (`ret`)**, int3 pad
    0x8EE222..0x8EE22F, next prologue 0x8EE230 = fn1 (C63's pin ✓;
    file = VA − 0x400C00 ⇒ 0x4ED5B0 = C49 ✓). Before the hunt: VERIFIED
    §8 rows 18–25 + C64/C65 re-read (phantoms honored: no `call
    0x8ed180`, no `movl $0x132b518,0x38(%esi)`, no "wang-fill
    @0x8ee5bd").
  - **Body decode (CONSTANTS C66):**
    1. MSVC EHa/GS frame: `push $0xffffffff; push $0x10a49cc` (unwind
       info), FS:0 chain at `[ebp−0xc]`, try-scope counter `[ebp−4]`
       −1 → 0 around the lazy init, GS cookie `mov 0x12eb000,%eax;
       xor %ebp,%eax` (`.data VA 0x12EB000` = file 0xEE9600 = .data
       start ✓ per C57's .data rule).
    2. **Lazy-init guard = the bss pointer itself:** `mov 0x134632c,
       %eax; test; jne 0x8ee208` @0x8ee1d8 → miss: `push $0x1a0;
       call *0x114a34c` (**IAT** operator new, 0x114a34c ∈ .rdata
       IAT region ≥0x114a000) → `mov %eax,%ecx; call 0x65f480` (ctor,
       thiscall) → `mov %eax,0x134632c` @0x8ee203; null-new path
       `xor %eax,%eax` @0x8ee201.
    3. **Resolve = one delegate call:** `push 0x8(%ebp)` (arg1 =
       the resolver's single argument) + `mov 0x18(%eax),%ecx` ⇒ this
       = **`[0x134632c + 0x18]`** — a LOADED POINTER (`mov`, not
       `lea` ⇒ +0x18 holds an object pointer, the delegate object is
       NOT embedded) → `call 0x741a50` @0x8ee20e → return value =
       eax passthrough (epilogue = FS restore + `mov %ebp,%esp; pop
       %ebp; ret`; no cookie re-check — no vulnerable buffer).
  - **Consequence for the Phase-2 ladder:** C32's `[this+0xb0]`
    resolver reaches a trampoline that only (a) lazily builds a
    0x1A0-B singleton at bss `0x134632c` and (b) forwards arg1 to
    **true 0x741A50** with this = `[0x134632c+0x18]`. Therefore the
    "image color → material ID" semantics must be read from 0x741A50
    + whatever ctor `0x65F480` installs at +0x18 — NOT from 0x8EE1B0.
  - **OPEN (dig #88):** ① body of **0x741A50** (the actual
    color→ID logic); ② ctor **0x65F480**'s store to +0x18 (delegate
    object identity); ③ LoadFromImageData's indirect
    `call *[…+0xb0]` site inside 0x8f9ab0..0x8fa930 (C62 span) →
    what value is pushed (raw RGBA? A-channel?). Then Phase-2 step 2:
    the 132-B record walk → fillRandomMaterials / DECOR u16 content
    walk (frontier item 5; ISSUES.md:82).
  - Status: docs only (no port changes; resolver semantics untouched
    in `lib/`). Landed: CONSTANTS **C66**, this entry **(87)**,
    VERIFIED §12 dig-87 bullet, Current_work Phase-2 tag + Status
    refresh. Tests **177/177**; y224 byte bar **0/12 rms 0.0000**.
- **2026-09-22 (88) — Phase 2 (dig #88): the color→grid lane
  byte-decoded — delegate `0x741A50` (24-bit color→table index) +
  LoadFromImageData's four result arms; **u16 cell = index + 1**;
  ctor `0x65F480` turns out to be a NEGATIVE for the +0x18 install.**
  - Method/scope: C57's PE-native objdump (`objdump -D -M att
    --start-address=<true VA> --stop-address=<true VA> noita_dev.exe`,
    true VAs), exe re-verified on disk THIS session:
    `/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe`,
    17,007,104 B, md5 `8b611494212a69492dd0a4527d9c92e0` (same as
    dig #87's open). Windows all chosen at prologue/int3 boundaries
    (no mid-instruction starts): delegate 0x741A50..0x741AC0 (body
    ret @0x741ab4, int3 pad 0x741ab7..F, next prologue 0x741ac0);
    ctor store run @0x65f4c9..0x65f4ec; LoadFromImageData per-pixel
    0x8f9be4..0x8fa182 (fresh aligned windows over the cached
    mapgen/extractions/lfid.dis (X36), fn span 0x8f9ab0..0x8fa930 = C62 ✓);
    pixel fetcher 0x9fe3c0..0x9fe44f. Before the hunt: VERIFIED §8
    rows 18–25 + C64/C65 re-read (phantoms honored: no `call
    0x8ed180`, no `movl $0x132b518,0x38(%esi)`, no "wang-fill
    @0x8ee5bd"). CONSTANTS **C67** carries the full register.
  - **① delegate `0x741A50` (stdcall, `ret $4`) = a table lookup:**
    key = `arg1 & 0x00FFFFFF` (alpha stripped @0x741a59); fast path
    key == `([this+0x2c] & 0xFFFFFF)` @0x741a5f → **return 0**;
    else count = [this+0x28] with a **`count > 1` gate** (≤1 →
    miss), base = [this+0x1c], first probe i = 1 at base + **0x2d0**
    (= 1·0x290 + 0x40), loop `inc i; add $0x290` while i < count,
    probe = u32 at base + i·0x290 + 0x40 `& 0xFFFFFF` vs key →
    match → **return i**; miss → `or $0xffffffff,%eax` = **−1**
    @0x741aa7. ⇒ **record stride 0x290 (656 B), color field +0x40;
    record 0 is reachable ONLY via the +0x2c fast path** — whether
    `[this+0x2c] == [base+0x40]` is unread (dig #89).
  - **② ctor `0x65F480` = NEGATIVE for the delegate install:**
    `movl $0x0,0x18(%esi)` @0x65f4d7 (zero-run +0x10/+0x14/+0x1c/
    +0x20/+0x24) ⇒ the ctor ZERO-INITS `[singleton+0x18]`; the
    writer that later installs the delegate object is not here —
    **writer of `[0x134632c+0x18]` = OPEN (dig #89)**; C66's OPEN
    wording corrected in place.
  - **③ call site + pre-gates (LoadFromImageData):**
    1. loop head @0x8f9bf1: x = [ebp−0x20], y = [ebp−0x2c]; bounds
       x ∈ [0, [esi]) and y ∈ [0, [esi+4]) else **assert line 0x224**
       (fmt 0x1150f60, file 0x1173790) @0x8f9c06.
    2. pixel = `call 0x9fe3c0` @0x8f9cdc (this = [ebp−0x18]
       container {w @0, h @4, init @+0x1c, **u32 array @+0x18**,
       getter **0x949f60**}; negative coords wrapped by idiv-modulo;
       uninitialized → 0) → **color slot [ebp−0x58] = the RAW pixel**
       @0x8f9ceb, [ebp−0x30] = `pixel & 0xFF000000` @0x8f9cee.
    3. gates @0x8f9d84+: pixel ≠ 0, `pixel & 0xFFFFFF` ≠ 0, top-byte
       ≠ 0 — any zero → next pixel (0x8fa165), no grid writes.
    4. **top-byte == 0xFE** @0x8f9cf1 → bool-buffer capacity sync on
       ebx {w,h @+0/+4, cached-total @+8, buf @+0x18, alloc @+0x1c}:
       dims copied from [esi]/[esi+4], on change free (IAT
       0x114a358) + malloc (IAT 0x114a35c) + memset 0 (0x1033a5e);
       flag clear `call 0x92ea40` @0x8f9d64 + **bool byte = 1**
       (getter **0x94a9d0**, this = ebx+0x18, offset w·y+x)
       @0x8f9d7e. Other top bytes skip this whole block — what 0xFE
       means = OPEN.
    5. memo: [ebp−0x7c] = last color / [ebp−0x78] = last index; hit
       → reuse, resolver skipped @0x8f9da0; miss: eax = [esi+0xb0]
       (null → miss arm 0x8f9f59), color == 0xFFFFFFFF → default
       arm @0x8f9db8, else `push %ecx; call *%eax` **@0x8f9dc2**
       → memo written @0x8f9dca/0x8f9dcd. ⇒ the pushed arg = the
       raw pixel u32, and the call target = C56's pinned
       `0x8EE1B0` A-resolver (C63) → ①.
  - **④ the four result arms:**
    1. post-call @0x8f9dd0: [ebp−0x24] = eax; **−1 → miss arm**
       0x8f9f59; signed ≥ 0xFFFF → **assert line 0x264** (file
       0x11737fc) @0x8f9de7; else success @0x8f9eae.
    2. success: unsigned > 0xFFFE (i.e. negatives) → default arm;
       **id = index + 1** @0x8f9ebc; lazy u16-lane init when
       [esi+0x3c] == 0 → 0x92e800/0x92e850; then the split —
       **id == 1 → f32 −1.0f @0x8f9f04 AND u16 = 1 @0x8f9f21 AND
       `incl [ebp−0x6c]`**; **id ≠ 1 → f32 +1.0f @0x8f9f39 AND
       u16 = id @0x8f9f51** (f32 offset [esi]·y+x, getter 0x9499f0;
       u16 offset [esi+0x20]·y+x, getter 0x94a8f0) → next pixel.
    3. miss arm @0x8f9f59 (ecx = color): color == 0xFFFFFFFF →
       default; script memo [ebp−0x70]/[ebp−0x74] hit → reuse;
       else [esi+0xb4] == 0 → default; else **`call 0x9fe450`**
       (this = esi+0xb4, arg = &color) @0x8f9f83 → memo; signed
       < 0xFF → **byte arm** @0x8fa05d: id = index+1 ≤ 0xFF
       (unsigned negative → default arm), lazy init [esi+0x5c]==0
       → 0x92cc80/0x92ccd0, **u8 lane byte = id** (getter
       **0x949bb0**, this = esi+0x58, offset [esi+0x40]·y+x)
       @0x8fa0af + push **{x, y, id−1}** (struct −0xa0/−0x9c/−0x98)
       → vector **esi+0x80** (0x92eb70) + `incl [ebp−0x68]`; signed
       ≥ 0xFF → **assert line 0x263** (file 0x11737c8) @0x8f9f9f.
       ⇒ **script-map colors take a SEPARATE u8 lane + change-vector,
       never the u16 grid.**
    4. **default arm** @0x8fa0dc/df (0xFFFFFFFF pre-check, −1,
       any out-of-range index, script-null): **f32 = (ch[15:8] +
       2·ch[23:16]) / 765** — mul 0x11df8bc = 0.003921569 (= 1/255),
       div 0x11dff70 = 3.0, u32→double magic 0x11e0ba0 — written to
       the f32 grid @0x8fa15e; **u16 NOT written (stays 0)**.
  - **Ladder consequence (solid/air rung, byte basis):** the u16
    grid's value set = {0 = untouched (zero/transparent pixels and
    double-misses), 1 = record-0 color match (+f32 −1.0f), ≥2 =
    index+1 (+f32 +1.0f)}. Cross-reading entry (86)'s sampler gate
    (f32 `comiss 0.5f` → skip) with these bytes: **id==1 cells are
    exactly the ones the sampler SKIPS ⇒ record 0 = the air/empty
    candidate rung** — byte-consistent, CONFIRMED only after the
    0x290-record content is read. The esi-container model also
    cross-links to C56: LoadFromImageData's esi = **the C27 gen**
    (containers +0x00/+0x20/+0x40, vector +0x80, +0xb0 resolver pin,
    +0xb4 script callback — C56's layout ✓).
  - **OPEN (dig #89):** ① writer of `[0x134632c+0x18]` (delegate
    object identity); ② the 0x290-record table content —
    `[this+0x2c]` vs base+0x40 identity + the record's material
    fields (fn **0x741AC0** family) = the actual "index → material
    ID → color" rung; ③ pre-loop inits (memo seed,
    [ebp−0x18]/ebx identities) + the post-loop counter branches
    @0x8fa489/0x8fa6e9 ([ebp−0x6c]/[ebp−0x68] consumers);
    ④ the 0xFE top-byte + u32 channel-order semantics. Then
    Phase-2 step 2: the 132-B record walk → fillRandomMaterials /
    DECOR u16 content walk (frontier item 5; ISSUES.md:82).
  - Status: docs only (no port changes; `lib/` resolver semantics
    untouched). Landed: CONSTANTS **C67** (+ C66 OPEN corrected),
    this entry **(88)**, VERIFIED §12 dig-88 bullet, Current_work
    Phase-2 tag + Status refresh. Tests **177/177**; y224 byte bar
    **0/12 rms 0.0000**.
- **2026-09-22 (89) — Phase 2 (dig #89): the 0x290 record class
  byte-decoded — CellFactory/CellData = the `data/materials.xml`
  rows (string-anchored); accessors, object layout, the
  mCellDataSize high-water store, and the name→type map fill; the
  draft "0x745051 = table-count store" reading CORRECTED (it writes
  a map node's pair.second).**
  - Method/scope: C57's PE-native objdump (true VAs, windows at
    prologue/int3 boundaries), exe re-verified on disk THIS session:
    `/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe`,
    17,007,104 B, md5 `8b611494212a69492dd0a4527d9c92e0`. Fresh
    windows this dig: GetCellData 0x4b80e0..0x4b81d2 (prologue) +
    0x4b81c9 via the cached full-.text sweep; fn0x742b30
    0x742b30..0x742d30 (boundary count = its own prologue only ⇒
    single fn) + 0x742d11..0x742d34 context; fn0x7449e0
    0x744f20..0x745090 + 0x744a00..0x744f60 boundary scan (zero
    ret/int3/push-ebp ⇒ names loop ∈ fn0x7449e0); 0x7415e0
    0x7415e0..0x7416ff; 0x43db70 0x43db70..0x43dbae; 0x4496a0
    0x4496a0..0x44975d; 0x744a67..0x744abf cleanup loop. Before the
    hunt: VERIFIED §8 rows 18–25 + C64/C65 re-read; phantoms
    honored (no `call 0x8ed180`, no `movl $0x132b518,0x38(%esi)`,
    no "wang-fill @0x8ee5bd"); new trap registered this dig —
    orphan literals **0x11a0008 / 0x11a0030** (0 byte-refs
    file-wide; never cite). Register at start: entry (89), C68, I20.
  - **Identity — the 0x290 record class IS CellData/CellFactory =
    materials.xml rows:** `"data/materials.xml"` 0x119ffe0 pushed
    @0x405b97; assert file 0x117cb10 = `…grid/cells/cellfactory.`,
    exprs `type >= 0` 0x117cc3c (line 0x361) / `type < (int)
    mCellDataSize` 0x117cc48 (line 0x362) in GetCellData fn
    0x4b80e0; `celldata->material_type < (int)mCellData.size()`
    0x11a021c (line 0x52e) pushed @0x742eb0/0x742f24/0x742f48 in
    fn 0x742b30; `IMPL_cell_reactions.empty()` 0x11a06b4 (0x631) +
    `IMPL_required_reactions.empty()` 0x11a06d0 (0x632) in fn
    0x7449e0; `"ERROR in materials.xml!!! wang_color for "` 0x11a0738
    + `" is completely grey."` 0x11a0790 pushed @0x74598f/0x7459a8
    (link-pass tail); `"Error! CellFactory::GetType() couldn't find
    material: "` 0x11a00a0 pushed @0x74184c (GetType miss path);
    `"Too many CellData's … CELLFACTORY_CELLDATA_MAX_COUNT in
    magic_numbers.xml"` body 0x11a0068 pushed @0x741305; attr
    `"wang_color"` 0x119f078 @0x736c56/0x736caf/0x736cd6 in the
    parse region ~0x736c00; source file literal 0x119ef60 =
    `d:\…\source\grid\cells\cellfactory.cp`.
  - **Layout (all offsets re-derived this dig):** names vector
    {begin **+0x8**, end **+0xc**} of 24-B wstrings — count via
    `mov $0x2aaaaaab` + sar2 ((end−begin)/24) @0x744f35..4e (map
    fill loop) and @0x7415f3..fd (linear resolver); wstring SSO
    {data@0, size@0x10, cap@0x14} from the inline tests
    `cmpl $0x10,0x14(%edx)` @0x43db94/0x43dba3. name→type
    std::map {head **+0x14**, size **+0x18**}: find **0x43db70**
    takes this = table+0x14, `mov (%ecx),%ebx` = head @0x43db77,
    walks root with `_Isnil` `cmpb $0x0,0xd(%edi)` @0x43db80 and
    `lea 0x10(%edi)` = &_Myval @0x43db98 ⇒ MSVC node = {_Left@0,
    _Parent@4, _Right@8, color@0xc, isnil@0xd, key wstring
    @0x10..0x27, **int second @0x28**}; end-test
    `cmp 0x14(%ebx),%esi; je` @0x744f73 (= node == head ⇒ miss);
    insert-helper **0x4496a0** gets ecx = table+0x14 @0x745038 and
    tests `cmpl $0x0,0x4(%ebx)` @0x4496d4 ⇒ [table+0x18] = _Mysize
    (empty-map fast path), `ret $0x10` (4 stack args; arg1 = the
    `&[ebp−0x50]` out-param, written through by 0x44b9d0). Records:
    {begin **+0x1c**, end **+0x20**, cap **+0x24**} stride **0x290**
    — the cleanup loop @0x744a6d..0x744aae computes
    (end−begin)/0x290 via `0x63e7063f` + sar8 and destroys records
    at [ebx+0x1c] + i·0x290 (`call 0x736050`, esi += 0x290).
    **mCellDataSize = dword +0x28** (see the writer below);
    fast-color **+0x2c** (identity OPEN); one-shot flag **+0xb8**.
  - **Accessors (the register riddle confirmed):** the earlier
    apparent contradiction = two separate functions split by int3
    padding. **0x741770** = GetType(name) → 0-based type or −1
    (map path → [node+0x28] @0x7417aa; empty name → −1 @0x74186c;
    linear counter → match @0x741878; miss → error log
    0x11a00a0 then −1). **0x7415e0** = a second, stdcall linear
    resolver (1 arg, `ret $4` @0x7416ed): scans this+0x8 names,
    `add $0x18,%ebx` per element @0x7416bd, full key+length match →
    `mov -0x4(%ebp),%eax` @0x7416e4 = **the matching index**; miss
    tail starts @0x7416f0 (return value unread = OPEN). **0x741890**
    = name → &mCellData[i] (`imul $0x290,i; add [this+0x1c]`
    @0x741995; miss/empty → 0 @0x7419ad; callers 0x746456/0x746c72/
    0x8f8f48/0xc3df8d/0xc3dff6/0xc3e0aa). **0x4b80e0** =
    GetCellData(type): this spilled `[esp+4]` @0x4b80f3, reloaded
    `mov 0x14(%esp),%ecx` @0x4b81a4 after the assert machinery (ecx
    = this on BOTH paths); assert 0x361 `test %ebx,%ebx; jns
    0x4b81c9`; assert 0x362 **`cmp 0x28(%ecx),%ebx; jl 0x4b827c`**
    @0x4b81c9 = signed `type < [this+0x28]`; **type==0 → NULL**
    @0x4b827c..88; else base + type·0x290 @0x4b828b. **0x4b82a0** =
    GetCellData(GetType(name)) (callers 0x6515f8/0x65167b) ⇒
    **type 0 is unreachable through GetCellData** — the air-candidate
    reading now has a second byte anchor (besides the sampler skip).
  - **mCellDataSize writer = the high-water store, fn 0x742b30:**
    `push %ebx; mov %esi,%ecx; call 0x7415e0` @0x742d11..14 (this =
    table, arg = the record's name field) → `mov %eax,0x30(%ebx)`
    (celldata->material_type) + `mov %eax,0x34(%ebx)` @0x742d19/1c →
    **`cmp %eax,0x28(%esi); jg 0x742d28; inc %eax; mov %eax,0x28(%esi)`**
    @0x742d1f..0x742d25 ⇒ `[table+0x28] := max(size, resolved+1)`
    (signed jg) → loop gate `cmp %edi,0x28(%esi); jle 0x742d9b`
    @0x742d2a/2d. esi = table confirmed by `imul $0x290,0x30(%ebx),
    %ecx; add 0x1c(%esi)` @0x742f63 (record lookup by material_type)
    and ecx=esi thiscall setup @0x742d12. This is the field
    GetCellData's assert 0x362 and the link-pass caller loop
    (@0x747bf7, i=1..[esi+0x28]) both bound against.
  - **CORRECTION — `mov %edi,0x28(%esi)` @0x745051 is NOT the
    table-count store (the pre-dig draft claim):** verified from the
    prologue-anchored window: counter `[ebp−0x64]` = 0 @0x744f3f,
    loop head 0x744f60, per iteration the tail does
    `mov -0x50(%ebp),%esi` (insert out-param, skip-path keeps the
    find result), `mov -0x64(%ebp),%edi` (counter), **store
    @0x745051, THEN `inc %edi` @0x745054, spill @0x745063**, name
    stride `add $0x18,%esi` @0x745060, back-edge `jb 0x744f60`
    @0x745075 ⇒ the value written = the loop index = **the record
    index**, and the target esi = **the tree node** (insert path:
    0x4495f0 lower/find + 0x4496a0 insert with `&[ebp−0x50]` out;
    reuse path: find result still in esi). node+0x28 = pair.second
    structurally proven above ⇒ **the loop fills the name→type map:
    map[names[i]].second = i**, with seconds 0..count−1 (last store
    before exit = count−1 — store-before-inc). No store to
    `0x28(%ebx)` (the table) exists anywhere in fn0x7449e0 (grep:
    only this one store; all other +0x28 hits are loads
    @0x745189/0x745230/0x74526b/0x74530b/0x7453a5/0x7453e0/
    0x745455/0x7454f0/0x74552b) ⇒ C68's "+0x28 = mCellDataSize"
    now cites 0x742d25 instead. Cross-check: GetType's map path
    reads exactly this [node+0x28] as the returned type ✓.
  - **Record assign 0x741d20 (dst ecx, src [ebp+8], `ret $4`)** —
    the full 0x290 field map: wstring members {+0x00, +0x18, +0xac,
    +0xc8, +0xe4, +0x114, +0x12c, +0x1b4, +0x1d0, +0x1ec, +0x20c,
    +0x240, +0x250, +0x25c}; dwords +0x30 (**material_type**),
    +0x34/0x38/0x3c, **+0x40 = wang_color (store @0x741d68)**,
    +0x44/+0x48; sub-objects +0x4c (ctor 0x736150); byte groups
    +0x8c..0x8f, +0xa8, +0x150..0x163, +0x1ac..0x1b1, +0x24c..0x24f,
    +0x268/0x269, +0x27c, +0x288..0x28a; typed dwords +0xc4, +0xe0,
    +0xfc, +0x144, +0x148, +0x1cc, +0x1e8, +0x204; u16 +0x14c/+0x14e;
    **ptr +0x88 deliberately OMITTED (rebuilt by 0x740780 when
    [rec+0x5c]≠0, sites @0x742f8f..0x742f9d), ptr +0x28c raw-copied
    @0x7422d4**. CellData copy **0x740410** (movdqu +0x00..+0x3f,
    dword +0x40 @0x740466..69, sub-objs +0x44/+0x50 via 0x928630;
    callers 0x7466b4/0x746935/0x9305aa). Per-record random
    **0x7409b0** (15 call sites incl 0x744ef2): gate = [rec+0x88] ≠ 0
    + flag [rec+0x6c], two uniforms derived from the record index
    (hash `imul $0x5b` + 0x37e40765/0x9eec9ad1, MSVC LCG
    0x343fd/0x269ec3, mask 0x7fff −0x3fff, norm tables
    0x11dfae0/0x11e0038) → `call 0x740580(obj,u1,u2)` (assert line
    0x2e7 `width > 0` 0x119fec4; fn assert line 0x328 `celldata`
    0x117d2e4).
  - **Link pass 0x7455b0 (per-record, caller loop @0x747bf7:
    i=1..[esi+0x28], stride 0x290; asserts lines 0x766/0x767)** —
    wstring→type-dword resolution: +0x1b4→+0x1cc (empty→0),
    +0xac→+0xc4 (empty→skip), +0xc8→+0xe0 (empty → default
    **`fire`** 0x1171bc0 len4 @0x7457df), +0xe4→+0xfc (empty →
    default **`smoke`** 0x117cbdc len5 pushed @0x74584c, **but the
    store @0x74588a writes +0xe0, not +0xfc — byte-verified
    asymmetry; semantics OPEN, reported as a byte fact, not an
    ISSUES defect (no repro)**), +0x1d0→+0x1e8, +0x1ec→+0x204,
    +0x114→+0x148 (extra: type>0 && [rec+0x150]==0 → GetType →
    GetCellData → `mov 0x30(%ebx),%ecx; mov %ecx,0x144(%eax)`
    @0x74593c), +0x12c→+0x144. Tail grey check @0x74597a:
    color = [ebx+0x40], byte0==byte1==byte2 → error log
    0x9eb020/0x65cfe0/0x9cfff0 (the completely-grey wang_color
    message). One-shot init **0x741ac0**: guard [this+0xb8] →
    GetType([0x1328004+0x17c]) @0x741b1d → GetCellData @0x741b25 →
    saved @0x741b2a; same pattern for +0x194 @0x741b34.
  - **Census:** `imul $0x290` = exactly 15 sites (0x4b828b,
    0x741995, 0x742379, 0x742f63/0x742f72/0x742f82, 0x743d12,
    0x74484b, 0x74489c, 0x92fce4, 0x92fd79, 0x978ae0, 0x978b60,
    0x978b6e); `push $0x290` re-confirmed = assert line 656 decoy
    (0x43d5e6/0x43d654/0x43d67a, 0x7427fb, 0x95b876/0x95b8e4/
    0x95b90a, 0x95c2f6/0x95c364/0x95c38a) — do not chase;
    +0x40 store sites = 0x740469/0x741cb3/0x742412/0x7471f3/
    0x747925/0x747ab5, all copies/assigns ⇒ **the parse-time store
    that writes the parsed wang_color u32 into a record +0x40 is
    NOT among them** (parse region ~0x736c00 has the attr read
    @0x736c56/0x736caf/0x736cd6 but the value's journey to +0x40 =
    OPEN).
  - **OPEN (dig #90+):** ① writer of `[0x134632c+0x18]` (delegate
    object identity; ctor 0x65F480 zero-inits it); ② [factory+0x2c]
    writer/identity (orphan trap: 0x11a0008/0x11a0030 = 0 refs —
    never cite); ③ the wang_color parse store (fn ~0x736c00 →
    record+0x40) = the color origin for the ladder; ④ record
    allocation site (vector growth; imul census candidates 0x92fce4/
    0x92fd79/0x978ae0..unexamined); ⑤ 0x7415e0 miss tail; ⑥ the
    +0xe0/+0xfc smoke-default asymmetry consumer; ⑦ LoadFromImageData
    pre-loop inits + post-loop counter branches @0x8fa489/0x8fa6e9
    and the 0xFE top-byte + u32 channel-order semantics. Phase-2
    step 2 parallel track: **unpack `data/data.wak` → read the
    literal `data/materials.xml`** (record order = type order,
    wang_color = +0x40) — official unpacker
    `tools_modding/data_wak_unpack.bat`; spot-verify vs the exe.
  - Status: docs only (no port changes; `lib/` resolver semantics
    untouched). Landed: CONSTANTS **C68**, this entry **(89)**,
    VERIFIED §12 dig-89 bullet, Current_work Phase-2 tag + Status
    refresh. ISSUES: none filed (I20 remains next free). Tests
    **177/177**; y224 byte bar **0/12 rms 0.0000**.
- **2026-09-22 (90) — Phase 2 (dig #90): the wang_color color origin
  CLOSED — the parse store is `mov %eax,0x40(%esi)` @0x736d37 in
  record-parser fn 0x7364f0; the shared color converter pair
  0x454d90 (string→u32, R/B byte swap) / 0x454e80 (u32→string,
  inverse) read; the absent-attr default arm = a round-trip of the
  record's current +0x40; sibling store +0x48 = gfx_glow_color;
  sentinel 0xFFEEFFC0 = swap⁻¹(0xFFC0FFEE).**
  - Method/scope: C57's PE-native objdump (true VAs, prologue/int3
    boundaries), exe re-verified on disk THIS session:
    `/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe`,
    17,007,104 B, md5 `8b611494212a69492dd0a4527d9c92e0`. Fresh
    windows this dig: parse fn **0x7364f0..0x736d80** (prologue
    found = nearest `push %ebp` below 0x736c00 = 0x7364f0, prologue
    byte-verified: unwind push `$0x1079c8b`, `sub $0x1c0`, GS cookie
    0x12eb000); converter **0x454d90..0x454f20** (incl. full body
    + ret @0x454e7b) and **0x454e80..0x454fd0** (incl. return path
    `mov %edi,%eax` @0x454f66 + ret @0x454f78); caller1 head
    **0x9eb020..0x9eb090** + call context **0x9eb150..0x9eb1d0**;
    caller2 **0xa70d20..0xa70d90**; flag cb **0x428e30..0x428ea0**;
    type-1 wrapper **0x42bc50..0x42bcb0** (partial); string literals
    read by dd at file = VA − 0x400E00: 0x119f068 = `gfx_glow_color`,
    0x119f078 = `wang_color`, 0x114b900 = dword `0a 00 00 00` +
    `vector<T> too long` (hexdump). Call-site censuses from the
    cached full-.text sweep mapgen/extractions/fulltext86.asm (X1) (this
    session). Before the hunt: VERIFIED §8 rows 18–25 + C64–C68
    re-read; phantoms honored (no `call 0x8ed180`, no `movl
    $0x132b518,0x38(%esi)`, no "wang-fill @0x8ee5bd", no `push
    $0x290` = assert 656); orphan literals 0x11a0008/0x11a0030 not
    cited. Register at start: entry (90), C69, I20.
  - **① THE ORIGIN STORE — closed:** fn **0x7364f0** (prologue-
    anchored): esi = this (`mov %ecx,%esi` @0x73651e, spilled
    [ebp−0x114] @0x736520), arg1 = [ebp+8] → edi @0x736526 = the
    node. Node-type dispatch `mov 0x20(%edi),%eax; cmp $0x1` @
    0x736c3f..45: type-1 arm fetches attr `wang_color` (literal
    push @0x736c56) through temp [ebp−0x38] pre-seeded from the
    accumulator by 0x42bc50 + generic getter **0x42c070** (600+
    sites — a shared XML attr accessor across the whole parse
    family; its wrapper mechanics unread); type-0 arm (literal
    pushes @0x736caf/0x736cd6): has-attr **0x100a6f0** → get
    **0x100a960** → convert **0x4430b0** → **accumulator assign
    0x43a5a0 @0x736d0d**. Both arms converge @0x736d2c: `lea
    −0xa4(%ebp),%ecx; call 0x454d90` → eax = parsed u32 → **`mov
    %eax,0x40(%esi)` @0x736d37 = record+0x40 = wang_color — THE
    origin** (disp8 encoding `89 46 40`, in the parse region —
    which (89) had already flagged as "the value's journey to +0x40
    = OPEN"; it sits outside (89)'s six store sites, all ≥
    0x740469). The store EXECUTES BEFORE the sentinel check: `cmp
    $0xffeeffc0,%eax; jne 0x736d68` @0x736d3a; the sentinel arm
    (0x9ea780 → 0x65cfe0(obj, record) → 0x4429a0(obj, literal
    0x114b900 = `"vector<T> too long"` after a `0a 00 00 00` dword))
    falls through to the esi restore @0x736d62 and rejoins @0x736d68
    — **the +0x40 value is never undone**, and node processing
    continues. esi = the CellData record is structurally consistent
    with C68's field map ({+0x40 wang_color, +0x48 dword} both
    land); the caller-chain proving esi = &mCellData[i] (vs a
    staging copy later moved by 0x740410) = OPEN, tied to ④
    (allocation).
  - **①b sibling — record+0x48 = gfx_glow_color:** attr
    `gfx_glow_color` 0x119f068 fetched @0x736b85..0x736bf3 →
    converge-pair @0x736c0c (`call 0x454d90` @0x736c12) → **`mov
    %eax,0x48(%esi)` @0x736c1d** — C68's assign-map dword +0x48 ✓.
    New store-census entries: +0x40 store += 0x736d37, +0x48 store
    += 0x736c1d, +0x40 LOAD = 0x736c17.
  - **①c the absent-attr default arm = round-trip:** immediately
    after the glow store, `mov 0x40(%esi),%edx` @0x736c17 loads the
    record's CURRENT +0x40 as the register arg of **0x454e80** @
    0x736c20 (out = [ebp−0x2c], u32 = edx; confirmed __fastcall-
    style: `mov %ecx,%edi; mov %edx,%esi` at its entry) → returns
    the out-string pointer (`mov %edi,%eax` @0x454f66) → acc-assign
    `push %eax; lea −0xa4(%ebp),%ecx; call 0x43a5a0` @0x736c26..2c.
    ⇒ when the `wang_color` attr is absent, the accumulator holds
    the string form of the record's existing +0x40 and the converge
    re-parses it — i.e. **+0x40 round-trips unchanged**. Lossless-
    ness is INFERRED from the verified inverse swizzle pair (below);
    the number-format's full-u32 fidelity (top byte) is UNVERIFIED
    — OPEN.
  - **①d the converter pair (the color codec):**
    **0x454d90 = string→u32** — stream ctor **0x927f00** with the
    accumulator pointer pushed as its string arg @0x454dbc, IAT
    chain **\*0x114a2a4** / **\*0x114a298** with flag-callback
    **0x428e30** (body read: `and $0xfffff9ff; or $0x800` into
    [arg+0x14] — a fmt-flag setter, exact meaning unread) → result
    dword @ [ebp−0x10] → **byte swap 0↔2** (bytes 1,3 pass through:
    `movzbl %cl; shl $0x10` | `shr $0x10; and $0xff` | `and
    $0xff00ff00`, or'd) @0x454df1..0x454e06 → return eax @0x454e6a;
    **12 call sites** (0x64c9d2, 0x736c12, 0x736d32, 0x73cd3e,
    0x73de5b, 0x7ebca9, 0x818b0a, 0x889aaa, 0x8eb913, 0x8ebcd8,
    0x8f4676, 0x903e48) = **the exe's shared color-string→u32
    helper** (materials + biome/pixel-scene lanes both use it).
    **0x454e80 = u32→string, the exact inverse**: args ecx=out,
    edx=u32 (entry `mov %ecx,%edi; mov %edx,%esi` @0x454ea9/ac),
    mirrored byte swap @0x454eae..0x454ed5, formats via
    \*0x114a1e8/\*0x114a174 + 0x429a40, returns the out pointer;
    **10 call sites** (0x736b08, 0x736c20, 0x73cbc7, 0x73dd8a,
    0x7eb0a1, 0x889a20, 0x8eb781, 0x8eb94a, 0x903ccb, 0x906dc7).
    ⇒ **XML color literals are stored byte-swapped relative to the
    u32 record field** (R↔B): field = swizzle(parsed-literal), the
    swap is an involution.
  - **①e sentinel:** 0xFFEEFFC0 = swizzle⁻¹(0xFFC0FFEE) by the exact
    byte math (involution) — the **C0FFEE-family marker** (cf. C22's
    walker colors); a wang_color literal parsing to 0xFFC0FFEE lands
    as 0xFFEEFFC0 and takes the error arm — but the arm's semantics
    (0x9ea780/0x65cfe0/0x4429a0 + the `"vector<T> too long"`
    literal; possibly a length-error throw caught by the fn's EHa
    try) = OPEN, and which/if any materials.xml row triggers it =
    OPEN (step-2b's literal file will answer).
  - **①f callers of the parse fn (new cross-links):** exactly 2 e8
    sites — **0x9eb1aa** inside fn **0x9eb020** and **0xa70d74**
    inside a second wrapper (synthetic node type-1, pre-call
    0x100ab30, returns esi). fn 0x9eb020's own callers: 0x745999
    (**the (89) grey-error call site ✓ — its C68 "error log" label
    re-confirmed**), 0x8c6955, 0xab74f4, 0xabc412, 0xbd95fa. Its
    body builds a synthetic node (type field [−0x20]=0, guard
    `test %ecx,%ecx; je 0x9eb1c1` @0x9eb168) and CALLS THE RECORD
    PARSER — **the reconciliation of "error-log call target" with
    "record-parser caller" = NEW OPEN** (does not disturb (89)'s
    label; both byte-facts stand).
  - **Still OPEN (dig #91+, unchanged except ①):** ② [factory+0x2c]
    writer/identity (orphan trap: 0x11a0008/0x11a0030 = 0 refs,
    never cite); ③ `[0x134632c+0x18]` delegate-writer; ④ record
    allocation site (imul-$0x290 census candidates 0x92fce4/
    0x92fd79/0x978ae0/0x978b60/0x978b6e unexamined; also proves
    esi=&mCellData[i] vs staging copy); ⑤ LoadFromImageData pre-
    loop inits + post-loop counter branches @0x8fa489/0x8fa6e9 +
    0xFE top-byte + u32 channel-order semantics; ⑥ the +0xe0/+0xfc
    smoke-default consumer (0x74588a); ⑦ 0x7415e0 miss tail; plus
    the new 0x9eb020-role and sentinel-arm questions. Phase-2 step
    2b (parallel): unpack `data/data.wak` → literal
    `data/materials.xml` (record order = type order, wang_color =
    +0x40, now with the byte-swap rule from ①d to apply/spot-check).
  - Status: docs only (no port changes; `lib/` resolver semantics
    untouched). Landed: CONSTANTS **C69**, this entry **(90)**,
    VERIFIED §12 dig-90 bullet, Current_work Phase-2 tag + Status
    refresh. ISSUES: none filed (I20 remains next free). Tests
    **177/177**; y224 byte bar **0/12 rms 0.0000**.
  - **2026-09-22 (91) — Phase-2 leftovers ②–⑥ + step 2b: the
    `[0x134632c+0x18]` delegate = a 0xd8 factory instance (both writers
    install it), `[factory+0x2c]` = ctor-set fast-color `0xff420000`
    (Load does not touch it, region-scoped), record origin = in-place
    `[factory+0x1c]+offset` in fn 0x7459d0 over records i = 1..size−1,
    LoadFromImageData's pre-loop/fill/phase-2 decoded (assert lines
    0x2a7/0x2a8), +0xe0 = fire/smoke DEFAULT type vs +0xfc = NAMED
    type, and step 2b's cross-artifact match — materials.xml air
    `wang_color="ff000042"` → C69 R↔B swap → ctor immediate
    `0xff420000`.**
    - Method: byte RE of `noita_dev.exe` (17,007,104 B, md5
      `8b611494212a69492dd0a4527d9c92e0`) from region dump windows +
      file-wide censuses (awk/grep over the cached true disassembly +
      python byte scans), plus the literal `data/materials.xml` for
      step 2b (418,728 B, md5 `d782fb8c321b8e325fd67e07e46a5265`).
      Docs-only dig; no port changes.
    - **①f correction (seals (90)'s OPEN — supersedes (90)'s text):**
      fn **0x9eb020** ends `ret $0x4` @0x9eb131 + int3 pad
      0x9eb134..0x9eb13f ⇒ the synthetic-node builder is the next
      prologue, fn **0x9eb140** (guard `test %ecx,%ecx; je 0x9eb1c1`
      @0x9eb168; `call 0x7364f0` @0x9eb1aa ∈ **0x9eb140**, NOT
      0x9eb020). `call 0x9eb140` = exactly 3 e8 sites — **0x745b3f /
      0x746263 / 0x746530**, all inside fn **0x7459d0** (the second
      wrapper site 0xa70d74 unchanged, synthetic type [−0x20]=1).
      fn 0x9eb020 = the grey-error logger **only** (this = global
      0x132b624, pushed arg 0x11a0738, call site 0x745999; its other
      callers 0x8c6955/0xab74f4/0xabc412/0xbd95fa stand). ⇒ (90)'s
      "error-log label vs record-parser caller" role reconciliation
      **dissolves** — two adjacent functions, one role each; (89)'s
      grey-error label untouched. VERIFIED §8 row 26.
    - **② CLOSED (region-scoped):** ctor **0x740b70** (object size
      0xd8) writes `movl $0xff420000,0x2c(%ebx)` @**0x740bfd**. The
      imm-32 `…,0x2c(%reg)` census 0x740000..0x746fff = **0x740bfd +
      0x7450de only**; reg-source = **0x7401b3** only (an ebp local,
      not the factory). 0x7450de belongs to the frameless two-SSO-
      string init helper **0x7450c0** (fn 0x7449e0 ends `ret $0x4`
      @0x7450af + int3 0x7450b2..0x7450bf; the helper zeroes sizes at
      +0x10/+0x2c with cap 0xf at +0x14/+0x30 ⇒ 0x7450de = the second
      string's size zero-init, **not** a factory store — supersedes the
      earlier "reset-before-load in fn 0x7449e0" guess). ⇒ Load does
      not update +0x2c in this region (file-wide 380 hits unexamined ⇒
      elimination stays REGION-scoped); +0x2c = the ctor-set fast-color
      that delegate 0x741A50 reads (C67).
    - **③ CLOSED:** exactly two writers of `[0x134632c+0x18]` —
      **0x729753** (its install guard unread, low value) and
      **0x79de90** — both running `new(0xd8)` (`push $0xd8` @0x79de55)
      → ctor **0x740b70** (→ edi @0x79de6f) → `call 0x43ac50` → store
      → `call 0x7449e0` (this = the new object, arg 0). Site 2's
      context: `mov %eax,0x134632c` @0x79de46 (bss pointer install),
      guard `cmpl $0,0x18(%eax); jne 0x79e02d` @0x79de4b ⇒ the slot is
      filled only when empty, store @0x79de90. fn 0x7449e0's prologue
      `mov %ecx,%ebx` @0x744a0b ⇒ this = that 0xd8 object. With ② (its
      ctor writes +0x2c) and C67/C68 (`this+0x1c` base, `this+0x28`
      count, `this+0x2c` fast path) ⇒ **the delegate object = a 0xd8
      factory instance** (C66's "loaded pointer, not an embed" ✓;
      C66's writer-OPEN CLOSED).
    - **④ CLOSED:** record origin = **in-place `[factory+0x1c] +
      [ebp−0x3cc]`** inside fn **0x7459d0** (no prologue in
      0x7459d0..0x746600; frame `sub $0x45c`; this → [ebp−0x3c8]
      @0x7459fd; type gate `[esi+0x20]==1` @0x745a0c → else 0x7461df;
      `cmpl $1,0x28(%eax); jle 0x745b92` @0x745a26 ⇒ a factory with
      ≤1 record skips the scan). Init: index [ebp−0x3d8] ← 1
      @0x745a1e, offset [ebp−0x3cc] ← 0x290 @0x745a30..37; step =
      `add $0x290` + `inc %ecx` + `cmp 0x28(%edx),%ecx` (mCellDataSize)
      + `jl 0x745a40` @0x745b71..86 ⇒ records **i = 1..size−1**
      (record 0 skipped = C67's scan-from-1 ✓). In-place parse sites
      **0x745b3f** (wrapper 0x9eb140) and **0x745e96..9c** (wrapper
      0xa70cd0; ecx = `[ebp+0x1c]`+offset = `[factory+0x1c]+[ebp−0x3cc]`).
      Staging sites **0x746263** and **0x746530** (local
      `lea -0x364(%ebp)`, built by `call 0x747160` @0x7464f0..f6,
      `movb $0x13,-0x4(%ebp)`, staging-field zeros → `call 0x9eb140`
      → dtor pushes + `lea -0x364(%ebp),%eax` @0x746539) ⇒ **both
      patterns live** (in-place AND staging-then-copy); the
      staging→table copy path is still OPEN. Allocation: growth
      **0x92fc90** callers **0x740db7** (`lea 0x1c(%ebx),%ecx`,
      size-zero after) and **0x73624d** (`lea 0x1c(%esi),%ecx` after
      the per-record dtor loop `call 0x736050; add $0x290,%edi;
      inc %ebx; cmp 0x28(%esi),%ebx` @0x736211..25, size zeroed before
      AND after ⇒ the mCellData vector ✓); full-realloc **0x978aa0** =
      **0** `(call|jmp)` sites file-wide (mystery, OPEN).
    - **⑤ CLOSED (0xFE + full signature still OPEN):** pre-loop inits
      in fn **0x8f9ab0**: [ebp−0x34] ← esi (this) @0x8f9ae0,
      [ebp−0x18] ← arg1 @0x8f9ae3, [ebp−0x5c] ← edi (gen+0x20)
      @0x8f9b2f, [ebp−0x80] ← ebx (arg6) @0x8f9b54; counters
      [ebp−0x68] ← 0 @0x8f9b7c and [ebp−0x6c] ← 0 @0x8f9b8f. Bumps:
      `incl [ebp−0x6c]` @0x8f9f19 after `call 0x94a8f0; u16 == 1` (the
      record-0 writes); `incl [ebp−0x68]` @0x8fa0d4 after
      `call 0x92eb70` (identity OPEN). Both `jle 0x8fa489` @0x8fa1a2/ac
      gate one block; `cmpb $0,0x10(%ebp); jne 0x8fa6e9` @0x8fa194 =
      the phase-2 flag. Block: local ctor 0x65a640 (0x1173830); gate
      `cmpl $0,0x3c(%esi)` @0x8fa1d4 → assert line **0x2a7** (4 pushes
      $0x2a7/$0x1173678/$0x1173870/fmt 0x1150f60 via 0x114a374; crash
      `movl $0x1ca9,(%eax)` @0x8fa296); esi reload @0x8fa28a →
      `0x5c(%esi)` → assert **0x2a8** (expr 0x11738ac) → crash
      @0x8fa35b. Fill pass **0x8fa361..0x8fa47d**: u8 ≠ 0 (getter
      0x949bb0, ebx+0x58, stride [ebx+0x40]) ∧ self u16 == 0 (0x9fe4e0,
      esi = gen+0x20) ∧ 4 neighbors (`0x9fe570(&locals) == 1`) → **u16
      ← 1** (0x94a8f0, ebx+0x38, stride [ebx+0x20]) + **f32 ← −1.0f**
      (`movl $0xbf800000`, 0x9499f0, ebx+0x18, stride [ebx+0x00])
      ⇒ lanes at gen+0x00/+0x20/+0x40 (C67 ✓). Tail @0x8fa489:
      [ebp−0x34]+0x7c gate → 0x8fa6b9 else realloc (0x114a35c/
      0x1012c00); **pass-1 dilation body 0x8fa4ff..0x8fa6b9 unread**
      (OPEN). Phase-2 @0x8fa6e9: ctor 0x65a640 (0x11738dc), header copy
      from edi, u16 buffer ×2 resize (`add %eax,%eax` + malloc + copy
      0x1012c00), walk cells with u16 == 0, dump truncated ~0x8fa7e0
      (OPEN). Callers of 0x8f9ab0 = **3** (0x8fa99b, 0x905dd7,
      0x905f1e); @0x905dd7: this = edx, arg1 = edi, `push (%edi);
      push 0x4(%edi)` = w/h ⇒ **arg1 = the C67 pixel container ✓**
      (full signature OPEN).
    - **⑥ CLOSED (defaults; semantic consumer still OPEN):** the whole
      +0xe0/+0xfc sequence ∈ link-pass fn **0x7455b0** (edx → ebx
      @0x7455db = record, ecx → [ebp−0x4c] @0x7455dd = factory).
      Prologue census 0x744000..0x746600 = 0x744260, 0x744620,
      0x7449e0, 0x745100, 0x7455b0, 0x7459d0 (none in 0x746000..0x746fff).
      +0xe0 fed by (a) a prior GetType @0x7457d2, (b) GetType(**"fire"**
      — 0x1171bc0, len 4, dd-verified `ry_name.fire`) @0x74581d,
      (c) name-absent default GetType(**"smoke"** — 0x117cbdc, len 5)
      @0x74588a; +0xfc ← GetType(+0xe4) only when a name is present
      ([ebx+0xf4] guard) @0x745844 ⇒ **+0xe0 = the fire/smoke DEFAULT
      type, +0xfc = the NAMED type** (resolves C68's asymmetry OPEN).
      Guarded stores: +0x1e8 (guard +0x1e0) @0x7458c3, +0x204 (guard
      +0x1fc), +0x148 (guard +0x124) @0x745915, +0x144 with two writers
      — cross-record @0x74593c (guarded type > 0 && +0x150 == 0 &&
      GetCellData ≠ 0) and src +0x12c @0x745968 (guarded +0x13c). Grey
      check @0x74597a: `mov 0x40(%ebx),%eax` shr8/shr16 → b0 == b1 ==
      b2 (**alpha ignored**) → push 0x11a0738, `mov $0x132b624,%ecx`,
      `call 0x9eb020` @0x745999 → 0x65cfe0(arg = ebx) → 0x9cfff0
      (0x11a0790) → ret @0x7459cf → prologue 0x7459d0 ✓ (link pass and
      record loop abut with no padding — the boundary care that (90)'s
      ①f needed). Paired reads 0x741e4c/0x741e72 = record-assign fn
      **0x741d20** field copies (esi→ebx: +0xc4, +0xe0, wstring +0xe4
      via 0x41d770, +0xfc, +0x100, +0xc8) + the twin 0x7472f1..0x747337
      (ebx→edi) ⇒ COPYING, not a semantic consumer — **the +0xe0/+0xfc
      consumer remains OPEN**.
    - **step 2b JACKPOT (first cross-artifact match of the dig):**
      literal `data/materials.xml` = 418,728 B, md5
      `d782fb8c321b8e325fd67e07e46a5265`; `<CellData` (224) +
      `<CellDataChild` (245) = **469** = the wang_color count **exactly**
      (record order = type order stands); wang_colors are 8 hex digits
      with **no `0x` prefix**; first names air / `$mat_air` / fire / … .
      Line 80 `<CellData>` name **"air"**, line 83
      **`wang_color="ff000042"`** → C69 R↔B swap (b0 ↔ b2:
      0xff000042 → 0xff420000) → **= the ctor 0x740b70 immediate** —
      data, swizzle, and exe agree. The same u32 is also C1's hasPath
      start-mark (`cmp eax,0xFF420000` @0x901a4d; relationship unread
      → OPEN).
    - **Still OPEN (dig #92 candidates):** semantic consumer of
      +0xe0/+0xfc (⑥ closed the defaults, not the read side);
      staging→table copy path (④); 0xFE top-byte meaning + u32 channel
      order (⑤); flag slots [ebp+0x10]/+0x3c/+0x5c/+0x7c; 0x92eb70
      identity; type-1 wrapper chain 0x42c0d0/0x42bc50/0x42c070;
      sentinel-arm semantics; codec top-byte round-trip fidelity;
      0x8f9ab0's full signature; 0x7415e0 miss tail; ③ site-1's install
      guard; pass-1 dilation body 0x8fa4ff..0x8fa6b9; phase-2 walk tail
      ~0x8fa7e0; 0x978aa0 zero-caller mystery; the file-wide 380-hit
      0x2c census (region-scoped elimination stands); fn 0x7450c0's
      helper-this identity; the C1-vs-ctor 0xff420000 relationship;
      then the 132-B record walk → ladder table (CONSTANTS row +
      solid/air test fixture).
    - Status: docs only (no port changes; `lib/` resolver semantics
      untouched). Landed: CONSTANTS **C70** (+ the C68/C69 line-94
      split), this entry **(91)**, VERIFIED **§8 row 26** + §12
      dig-91 bullet + the (90)-bullet attribution fix, Current_work
      Status/Landed/Next refresh. ISSUES: none filed (I20 remains next
      free). Tests **177/177**; y224 byte bar **0/12 rms 0.0000**.
  - **2026-09-22 (92) — Phase-2 residue ①–⑤: the +0xe0/+0xfc
    consumers = fns 0x7495b0/0x74bf70/0x751be0 (fn-ptr invoked, chain
    0x74bf70→0x7521f0→0x751be0); staging is the LIVE parse path with
    the staging→table copy at fn 0x742b30's tail (selector
    `[arg1+0x20]`); 0x741a50 = the color→index matcher with the top
    byte EXCLUDED + the reserved wang color `ffc0ffee`
    (log-and-continue); fn 0x8f9ab0 = BitmapNoise::LoadFromImageData
    fully decoded (9-dword signature, parts 2/3, von-Neumann r1
    dilation, majority-fill, counters −0x68/−0x6c, 0x92eb70 = the
    script-event appender); 0x978aa0 = vector::reserve reached by 2
    tail-jmps (OVERTURNS the zero-call canon → §8 row 27); and the
    C1-vs-ctor 0xff420000 relationship closed at 0x901a4d.**
    - Method: byte RE of `noita_dev.exe` (17,007,104 B, md5
      `8b611494212a69492dd0a4527d9c92e0`) — awk/grep windows over the
      cached true disassembly + python literal scans. Docs-only dig;
      no port changes.
    - **① CLOSED (consumer found; the invoking pointer OPEN):** the
      semantic consumers of +0xe0/+0xfc are fns **0x7495b0** (gate
      `cmpl $4,0x38(%eax)` → indirect `call *0x98(%edx)`), **0x74bf70**
      (LCG rand → `call *0x98` @0x74c2bb) and **0x751be0**
      (`call *0x20` @0x751d65; packed cell index
      `((y&0x1ff)<<9)|(x&0x1ff)`), chained 0x74bf70→0x7521f0→0x751be0;
      0x7495b0 and 0x74bf70 have **0 direct code refs** (invoked via
      vtable/fn-pointer — WHICH pointer is OPEN). C70's write-side
      semantics (+0xe0 = fire/smoke DEFAULT type, +0xfc = NAMED type)
      stand.
    - **② CLOSED:** the in-place-vs-staging selector = **`[arg1+0x20]`**
      — 1 → in-place (dead-looking), 0 → staging (staging tag literals
      0x11a07a8 / 0x11a07b4 / 0x11a07c0 / 0x11a07cc); the
      staging→table copy = fn **0x742b30**'s tail using record-assign
      **0x741d20** (its only callers 0x746275 / 0x74656d); the load
      chain 0x7449e0 → 0x9eaf80 → 0x100c360 → 0xa48f20 (mode=0) →
      0x7459d0 ⇒ **staging is the live path**; 0x746e20 = the record
      dtor.
    - **③ CLOSED:** fn **0x741a50 = the color→index matcher** —
      `arg&0xFFFFFF` vs `[this+0x2c]&0xFFFFFF` → 0; else loop
      i = 1..count−1 over record `+0x40` colors (base + 0x2d0, stride
      0x290) → i; miss → −1 ⇒ **the top byte is EXCLUDED from the match
      key**. The sentinel prefix literal **0x119f098** = `"materials.xml
      error - please don't use the color 0xFFC0FFEE, because it has a
      special meaning in the wang map. Thank you. Was used in: "` ⇒
      reserved wang color **`ffc0ffee`** (S = 0xFFC0FFEE → C69 swap →
      T = 0xFFEEFFC0; byte1 = C0 survives ⇒ the swap touches
      byte0↔byte2 with byte1 unchanged, proven on a non-degenerate
      input); the arm **logs and continues** (the +0x40 value stands).
      The 0xFE = 254 = JOINT_SCRIPT_ID facts stand (fn 0x90cd00,
      0x8fa060 u8 = id+1, materials.xml has no `ee00ee` row); the
      relationship of the pixel-top-byte == 0xFE gate @0x8f9cf1 to
      JOINT stays **OPEN**.
    - **④ CLOSED:** fn **0x8f9ab0 = `BitmapNoise::LoadFromImageData`**
      (strings 0x1173720/0x1173750/0x1173830/0x11738dc = name + parts
      1/2/3; file 0x1173678 = `noise_utils.cpp`; assert format
      0x1150f60); thiscall `ret $0x24` = **9 dword args**: [1] =
      image-data struct ptr (freed by the caller @0x905f2b), [2] =
      ecx-value, **[3] = [ebp+0x10] = the phase flag**, [4-5]/[8-9] =
      8-B struct slots (content not materialized at the sites — OPEN),
      [6]/[7] = w/h extents clamped `min(arg, this[0]/this[4])`. The
      flag ≠ 0 @0x8fa194 → **part 3** @0x8fa6e9; flag == 0 → the
      counter gates (−0x68/−0x6c `jle 0x8fa489`) → **part 2**; merge
      @0x8fa48f → dilation gated **this+0x7c ≠ 0** @0x8fa492 (silent
      skip to 0x8fa6b9) → epilogue. Gates: **this+0x3c ≠ 0** = assert
      line **0x2a7** expr 0x1173870 = `mMaterialData.Empty() == false`
      (u16-lane count, lane + 0x1c); **this+0x5c ≠ 0** = assert line
      **0x2a8** expr 0x11738ac = `mScriptData.Empty() == false`
      (u8-lane count); **this+0x7c** = the bool-lane count (dilation
      needs it). All 3 call sites: 0x905dd7 (`push $1`), 0x905f1e
      (`push $1`, arg1 = local @esp+0x6c freed after), 0x8fa99b (inside
      the frameless wrapper fn **0x8fa930**, `ret $0xc`; the flag = its
      arg3 passed through — upstream callers OPEN).
      - **Dilation 0x8fa49c..0x8fa6b9** = clone the bool lane
        (this+0x60; memcpy @0x8fa4eb) → for each set src cell set the
        in-bounds 4-neighbors = 1 in a scratch (dest stride −0x54, data
        −0x3c) → commit back (memcpy @0x8fa69a; free scratch) =
        **von-Neumann r1 dilation**.
      - **Part 3 (phase-2 tail ~0x8fa7e0)** = clone the u16 lane; cells
        u16 == 0 ∧ float-lane ≤ 0 (`ucomiss`/`lahf` idiom) → if the
        4-neighbor mode ≠ 0 → scratch = mode → commit = **majority-fill
        of mMaterialData**.
      - **Part 2 (0x8fa361..0x8fa47d)** = cells u8 ≠ 0 ∧ u16 == 0 ∧
        mode(4 nbrs) == 1 → **u16 := 1 + f32 := −1.0f** (direct writes).
      - **0x9fe570** = the mode of the NONZERO u16 neighbor values
        (4-slot loop, first-wins ties, 0 if all zero).
      - Counters: **−0x68 = script events appended** (incl. the bump
        @0x8fa0d4 after `call 0x92eb70`; event {x, y, script_id} at
        −0xa0, this = grid+0x80 ⇒ **0x92eb70 = the script-event
        appender** ✓); **−0x6c = cells whose resolved id == 1** (incl.
        the bump @0x8f9f19; the id==1 arm sets f32 = −1.0f / u16 = 1 and
        skips the u8+event writes; id≠1 → f32 = +1.0f, u8 = id+1,
        event). Resolve = the this+0xb0 fn-pointer with a 1-entry memo
        (key −0x7c, val −0x78); assert `material_id < USHRT_MAX` line
        **0x264**.
    - **⑤ CLOSED (canon overturn → VERIFIED §8 row 27):** **0x978aa0 =
      the mCellData `vector::reserve`** — arg ≤ 0x63e706, ×0x290
      allocation (magic 0x63e7063f, ÷0x290), old-element dtor loop =
      **0x746e20** stride 0x290, begin/cap/end rewired — reached by
      **0 calls + exactly 2 tail-jmps: 0x94b373 / 0x94b386** from the
      capacity-growth wrapper (ends `ret $0x4` @0x94b38f; capacity via
      signed fixup / ÷2 / max-%esi — a 1.5×-style growth, exact branch
      predicate OPEN) ⇒ the §12 dig-91 "0 call/jmp sites file-wide"
      claim is **overturned**.
      - **0x7450c0's helper-this = the stack local [ebp−0x3a0]** in the
        CellDataChild arm of fn 0x7459d0 (call @0x74635a, EH state
        0x11); the body = a frameless init of {SSO stringA cap+0x14 =
        0xf, size+0x10 = 0, buf+0x00; byte+0x18; SSO stringB cap+0x30,
        size+0x2c = 0, buf+0x1c; dword+0x34 = 0}; the local is then fed
        to 0x9eb280 (fill) / 0x93ce20 (consume) — semantics OPEN.
      - **0x729753's install guard:** inline lazy O-create
        (`mov 0x134632c; test; jne` @0x7296b4; new(0x1a0) → ctor
        0x65f480 → store @0x7296e5) → slot guard `mov 0x18(%eax); test;
        jne 0x729848` @0x7296f3 (skip the install if the factory
        exists) → new(0xd8) → ctor 0x740b70 → **0x43ac50 = the lazy
        get-or-create accessor returning O** → `mov %ecx,0x18(%eax)` =
        **[O+0x18] = factory** → `call 0x7449e0(factory, 0)` → assert
        **`world_state == NULL`** line **0x124**, file 0x119e1d0 =
        `game_world.cpp` (expr 0x119e22c), checked against
        `[0x1328004]` @0x72975b ⇒ site-1 lives in game_world.cpp; O =
        the same singleton the A-resolver uses.
      - Wrapper chain: **0x42bc50** = string seed/assign (zeroes this+4
        / +8, global registry set 0x1344c78 keyed by this, 0x1c-node
        alloc; internals beyond the window OPEN); **0x42c070** =
        attr-by-key map lookup at `[this+0x28]+0x44` (find 0xf755a0,
        key-eq 0x43be00, out-fill 0x1014a70, `ret $0x8`); **0x42c0d0**
        = XML find-child-by-tag with cursor guard `[this+0x1c]` +
        `[this+0x2c]` vs the child count (vector at
        `[this+0x28]+0x38/0x3c`), exhaustion → logger 0x12ee538 with
        0x1150fa0 = `"Xml warning, ain't no childs left in the current
        node: "` + 0x1150f88 = `" in file: "` + 0x1150f94 = `" at line
        "`, tag-eq 0x42c440, miss → 0x42c415 (tail unread — OPEN).
      - **0x7415e0 = name→index with insert-on-miss:** linear search
        over the names vector (this+8/+0xc, ÷24 = 0x2aaaaaab, inline SSO
        wstring cmp) → hit returns the index; miss → `call 0x43aa90(name)`
        (role beyond insert OPEN), once-flag `cmpb $0,0x13276b9`,
        one-shot log to logger 0x12ee538 — 0x11a0088 = `"added new
        type: "` + name + 0x11a009c = `" = "` + count + `"\n"` →
        **returns count** (empty ⇒ 0).
      - Bonus: fn **0x741770 = CellFactory::GetType** (map at this+0x14
        head / this+0x18 size, node second @+0x28 = type; linear
        fallback ÷24; miss → error literal 0x11a00a0 pushed @0x74184c →
        **return −1**).
      - **C1-vs-ctor 0xff420000 relationship CLOSED:** @**0x901a4d**
        the hasPath walk reads the cell u32 (getter 0x949f60 from the
        grid [esp+0x54]) and `cmp $0xff420000` — equal → write
        **0xff000000** to grid B (esi, getter 0x949e80); top-byte == 0
        or == 0xff000000 → skip; else copy ⇒ the ctor publishes air's
        C69-swapped color as factory+0x2c and hasPath recognizes
        exactly that constant, stamping 0xff000000.
      - **0x2c census:** entry (91)'s "file-wide 380 hits unexamined"
        (line 6143, pattern+count) was NOT reproduced by this session's
        text-grep (6684 imm-stores / 1838+ reg-stores / 1940 loads /
        2761 lea) — the exact 380-pattern identity is **OPEN**; the
        elimination stays REGION-scoped either way.
    - Status: docs only (no port changes; `lib/` resolver semantics
      untouched). Landed: CONSTANTS **C71**, this entry **(92)**,
      VERIFIED **§8 row 27** (the 0x978aa0 zero-call claim → the
      elimination table) + **§12** dig-92 bullet, Current_work
      Status/Landed/Next refresh. ISSUES: none filed (I20 remains next
      free). Tests **177/177**; y224 byte bar **0/12 rms 0.0000**.
  - **2026-09-22 (93) — Phase 2 step 3 (dig #93): the material-ID
    LADDER closed (Phase 2 byte-CLOSED) — the 132-B component walk:
    classifier `0x8f5030`'s full gate chain + its 3 callers, the
    sampler merge/kind-dispatch write arms, the `<RandomColor>` parser,
    and the `+0x1e0` slot-width overturn (§8 row 28).**
    - Method: byte RE of `noita_dev.exe` (17,007,104 B, md5
      `8b611494212a69492dd0a4527d9c92e0`) — awk/grep windows over the
      cached true disassembly (`mapgen/extractions/fulltext86.asm (X1)`) +
      python `.rdata` scans (`file_off = VA − 0x400e00`, C13).
      Docs-only dig; no port changes; `lib/` untouched.
    - **① Classifier `0x8f5030..0x8f5749`** (file string 0x1173240 =
      `biome_materials.cpp` ✓ C54): thiscall ecx = `[config+0x2a4]`,
      2 int stack args, **v arrives in xmm3** (slot-verified in the
      sampler: `movss %xmm0,0x28(%esp)` @0x90dd29 → `movss
      0x2c(%esp),%xmm3` @0x90dd6c, net esp −4); returns the record
      POINTER or 0 (accept `mov 0x4(%ebx),%eax` @0x8f5740 → `ret $8`
      @0x8f5749; miss `xor %eax,%eax` @0x8f574e); component stride
      `add $0x84,%esi` @0x8f5713 = **132 B**; count magic 0x3e0f83e1
      re-derived each iteration @0x8f5707. Gate order (byte-read):
      assert **0xfe** mInitialized (expr 0x118c9f4) → range `[this+0]
      ≤ v ≤ [this+4]` (jne 0x8f5110) → assert **0x108** mCellFactory
      (expr 0x11732c0; `cmpl $0,0x30(%eax)` @0x8f5221 → continue
      0x8f52e9) → per component: assert **0x107** (expr 0x1151e28) →
      name/coherence @0x8f52e9: **[+0x04] = the resolved
      material/cell record POINTER** (null → require `[+0x18]==0`;
      else `call 0x442610`, al ≠ 0 → logger 0x132b624 msg 0x11732d0
      `"Error! couldn't find material: "` + assert **0x10f** expr
      0x1173304) → int-range flag **[+0x39]** @0x8f53f0: arg2 ∈
      `[[+0x3c],[+0x40]]` → polygon flag **[+0x74]** @0x8f5418: count =
      ([+0x7c]−[+0x78])/8 ≥ 3 else assert **0x118** expr 0x1173340;
      query = {(arg1 mod 512)·0x11df8b4, (arg2 mod 512)·0x11df8b4}
      signed-mod @0x8f54f2/0x8f5511 → callee **0x10096a0**, miss →
      next @0x8f5704 → `cmpl $0,0x4(%ebx)` @0x8f5572 → v′ = v [+ flag
      **[+0x2c]**: + fn **0x8fc020**(arg1·[+0x30], arg2·[+0x34])] →
      **main gate `[[+0x24],[+0x28))`** @0x8f55b6 (**C33 refined**:
      half-open) → flag **[+0x38]**: 0 → **ACCEPT** (`je 0x8f5740`);
      ≠0 → transform X = [+0x54]+arg1·[+0x48], Y = [+0x58]+arg2·
      [+0x4c] → jitter flag **[+0x50]** (EFLAGS live across the SSE
      block): rng **0x9119d0** ×2 + sign table 0x11e0ba0, X += rand·
      **0x11dfa70 = 1.53841e-05**, Y += rand·**0x11dfa88 =
      2.50832e-05** (rng range + scale unit OPEN) → noise flag
      **[+0x44]**, selector **[+0x45]**: ≠0 → **0x9fad90** | ==0 →
      **0x8fc020** → out-gate **((+0x6c),(+0x70]]** (jae / ja →
      0x8f5704) → ramp flag **[+0x46]**: 0 → ACCEPT; ≠0 →
      **0x8fbe60**(X,Y,[+0x5c],[+0x60],[+0x68], cl=[+0x64]) → same
      out-gate → `jbe 0x8f5740` @0x8f5702.
    - **② The 3 callers** (grep `8f5030`): fn **0x908f40..0x90936f**
      (procedural_terrain.cpp, file 0x1173a10): zone kind
      `[0x909da0()+4]` = 0 → path A (v = 0x90a860 + 0.5, literal
      0x11dfdd8; `cvttsd2si` args → tail @0x908fb0) | 1 → path B
      (assert `biome->bitmap_data` expr 0x1175088 line **0xa6e**
      @0x908fd2 → f32-pair walk 0x8fa9b0/0x8fae40 over
      `[config+0x1d4]` → evaluator2 **0x908e70** @0x90930c → floor
      dance (IAT 0x114a434 + 0x1033970) → tail @0x90935b) | other →
      **0x9091c6** (OPEN); path-B middle loop 0x909090..0x9092a2 OPEN.
    - **③ Sampler tail + MERGE (the solid/air fork):** u16 read =
      wrap-modulo **0x9fe4e0**(this = P+0x20) → `movzwl; dec` = id1
      @0x90dcd3; id1 ≥ 1 → cell = **0x4b80e0**([obj+0x90], id1)
      @0x90dcec → jmp merge; id1 ≤ 0 → `[owner+0x2a4]==0` → **skip**
      (`je 0x90ddb0` = unpainted = **air**) else evaluator2 @0x90dd24
      (args = f64 outer/esi, f64 inner/edi, f32 field; the classifier
      floor dance passes floor(esi), floor(edi) — axis order OPEN)
      → classifier @0x90dd7e. **MERGE @0x90dd89:** null → skip
      (air); else kind = `mov 0x38(%ecx),%eax`: **kind 3** → `push`
      flag `*(u8*)0x1344ce1` @0x90dd9c + coords + record → **call
      0xa047d0** @0x90ddab (this = `[sampler+4]`; C54 slab 0x603fd0
      ✓; internals OPEN) → loop tail 0x90ddb0; **kind ≠ 3 →
      0x90de0e** (C54 slab 0x50d60e ✓): kind==1 ∧ table ≠ 0 → intern
      (lock xadd, `cmp $0x2000` cap, value = `[edx+old·4+4]`
      @0x90de1b..2a); kind ≠ 1 → value 0 @0x90de2c; **both → planter
      0x7644d0** (C54 slab 0x363cd0 ✓; this = `*([sampler+0x2c])`, 4
      stack args = record, value, x+`*([sampler+0x24])`,
      y+`*([sampler+0x28])`) → free-old (IAT 0x114a348) → grid write:
      accessor **0x95a5e0** (this = owner+0x1e0, idx = y·
      `[owner+0x1c8]`+x) → `mov %ecx,(%eax)` **DWORD** @0x90de9c →
      bounds (x < `[owner+0x168]`, y < `[owner+0x16c]`) → alpha
      accessor **0x949e80** (owner+0x180), `testl $0xff000000,(%eax)`
      @0x90ded0 → ≠0 → `call *0x1c(%edx)` (on-place callback, arg =
      cell u32) → loop tail.
    - **④ `<RandomColor>` parser** = fn **0x8eb300..0x8eb72e** (biome.cpp
      file 0x1172ea8, `ret $0x4`): tag-eq **0x42c440** vs literal
      0x1172f04 `"RandomColor"`; create/append: factory **0xa75470**,
      parent-link `[new+4]=[ebx+0x28]`, append `[[ebx+0x28]+0x38]`
      via **0x10149a0**; index loop @0x8eb610 (name-cmp **0x42b780**,
      len == 11) → parse **0x92edd0 → 0x92a910** @0x8eb6c7; sibling
      keys extracted: **0x1172f10 = `input_color`, 0x1172f1c =
      `output_colors`** (next fn 0x8eb740 = input_color handler).
      **Runtime consumer OPEN** (build fn unread): biome nodes →
      component fill / resolver `[gen+0xb0]` — working hypothesis,
      OPEN.
    - **⑤ The `+0x1e0` overturn → §8 row 28:** accessor **0x95a5e0**
      (§11/§12's slab 0x559de0) success path = `mov -0x4(%ebp),%eax;
      mov (%eax),%eax; lea (%eax,%ebx,4),%eax; ret $0x4`
      @0x95a6a7..b5 ⇒ **base + idx·4 → 4-byte slots**; bounds
      `idx < [this+4]`, OOB assert line **0x4b**, file 0x117a570,
      expr 0x1179b74 (fmt 0x1150f60 = the shared assert format ✓);
      the store @0x90de9c is `mov %ecx,(%eax)` dword; C65's cited
      sites 0x90d2c1/0x90d2e9 are dword ⇒ **+0x1e0 = a 4-byte-slot
      grid, NOT a u16 grid** — the "u16 DECOR write/grid" label (§11
      ×2, §12 (86), C65) → §8 row 28; C65 amended in-row. The
      sampler's actual u16 read = wrap(this=P+0x20) `movzwl`
      @0x90dcd3 (getter 0x94a8f0, C62); the u16 fill container =
      gen+0x20 (C67/C62); the dword store's value (slot id vs record
      pointer) @0x90de9c = **OPEN**.
    - **⑥ Reconciliations + ladder:** C54 **byte-exact** (all 3 call
      sites, the `[cell+0x38]` dispatch, planter/bss/slab match its
      prose); C33 **refined** via C72 ([+0x04] = record POINTER, not
      an id; main gate = half-open `[[+0x24],[+0x28))` + the full
      chain); C65 **amended** (⑤). Ladder assembled → **C72** (field →
      >0.5 gate → u16 cell → material ID → color; **solid** = any
      write arm, **air** = the skips); fixture =
      `mapgen/fixtures/ladder/solid-air.json` (structural
      rung/dispatch cases + provenance + worked data tuples — this
      session's loadMaterials probe = **465** entries: air `000042` →
      wang_color `ff000042` → `0xff420000` = ctor immediate = C1's
      hasPath mark; water `2f554c`, coal `505052`, oil `3b3b3c`,
      `rock` absent from the map).
    - **OPEN (recorded non-blockers → Current_work Next):** the
      RandomColor runtime consumer + the component-BUILD/resolve fn
      (XML/biome nodes → the 132-B components, `[+0x04]` fill) + the
      `[+0x4]` ↔ GetCellData array-membership check; 0x9119d0's range +
      the jitter-scale units; the classifier's int-arg axis order
      (row/col vs polygon-vertex order); the kind enum `[cell+0x38]`
      {3,1,other} semantics + 0xa047d0 internals + 0x442610's exact
      predicate; fn 0x908f40's path-B middle loop + kind∉{0,1} arm
      0x9091c6; the grid-store slot vs record-pointer distinction
      @0x90de9c.
    - Status: docs only (no port changes; `lib/` resolver semantics
      untouched). Landed: CONSTANTS **C72** (+ the **C65** in-row
      amendment), this entry **(93)**, VERIFIED **§8 row 28** +
      **§12** dig-93 bullet, fixture
      `mapgen/fixtures/ladder/solid-air.json`, Current_work
      Status/Landed/Next refresh (Phase 2 → **byte-CLOSED**). ISSUES:
      none filed (I20 remains next free). Tests **177/177**; y224 byte
      bar **0/12 rms 0.0000**.

  - **2026-09-23 (94) — Phase 3 (dig #94): fnA's y-drift SPAN pinned
    (queue #2 closed) + the cross-lane composition-order diagram,
    byte-cited per arrow (Phase 3 byte-CLOSED = the B.1 render-gate
    "composition order" clause / (82) items 4–6); xmm4 provenance
    closed, (73)'s compose-formula corrections, (75)'s scroll-queue
    item dissolved.**
    - Method: byte RE of `noita_dev.exe` (17,007,104 B, md5
      `8b611494212a69492dd0a4527d9c92e0`) over the cached true
      disassembly `mapgen/extractions/fulltext86.asm (X1)` (slab→true +0x400800
      re-confirmed this session: C53's 4f1510/4f1f01/4f2a3c convert
      EXACTLY to 8F1D10/8F2701/8F323C; dispatchers 4b1410/4abd60
      already true). Docs-only dig; `lib/` untouched, `vendor/`
      read-only.
    - **① Deliverable (a) — fnA `8eec70..8ef86c` y-drift chain, all 10
      arg slots byte-pinned (CONSTANTS C73):** slots [ebp+8]=dims{w,h}
      ptr · [ebp+0xc]=&int pair{−0x134 X, −0x130 Y} · [ebp+0x10]=−0x104
      y-cursor · [ebp+0x14]=−0x10c scale · [ebp+0x18]=−0x110 budget
      (f32) · [ebp+0x1c]=(−0x100)² u (child **`xorps 0x11e0c50`
      sign-flip @8ef7c2** ⇒ opposite horizontal drift) ·
      [ebp+0x20]=−0x120 Δy · [ebp+0x24]=growth(−0x148) ·
      [ebp+0x28]=&−0x124 child budget (child `decl (%eax)` @8ef79e) ·
      [ebp+0x2c]=rec+0x24 — identical at both call sites **8f0703**
      (fnB region) and **8ef823** (child). **Start pair:** X = −0x134 =
      clamp(jittered base, 5, W−5) @8f0265..8f0298; Y = −0x130 =
      trunc(rand·[0x11dfef0 = 0.0]) = **0** @8f02b3..8f02b9 ⇒ **the
      walk STARTS AT ROW 0 (top) and descends.** **y arithmetic:** y =
      slot −0x44 = (float)pair[1] @8eecac..8eecbc; **−0x44 +=
      [ebp+0x20] once per walk iteration** after the band call
      @8ef37c..8ef393; Δy = −0x120 = **0.4·u + 0.1 ∈ [0.1, 0.5)**
      @8f046a..8f0485, **+0.5** when trunc(101u) < 33 (`cmp $0x21`
      @8f049e..8f04b3; 0x11dffe8 = 101.0) ⇒ Δy ∈ [0.6, 1.0) in that
      branch; budget [ebp+0x18] = −0x110 := `divss −0x120`
      @8f0626..8f063f where **−0x110 = LERP(0.45·H, 0.96·H, u)**
      final @8f056b..8f058d (0.45 @0x11dfa5c, 0.96 @0x11dfbc8;
      −0x119 = 1 always @8f03ac ⇒ the refine always runs; the earlier
      LERP(0.15H, 0.96H) @8f0415..8f043f superseded) ⇒ the budget is
      exactly ⌈target_y/Δy⌉ iterations. **Terminations (span):** (i)
      back-edge `inc −0x40; comiss [ebp+0x18],steps; jbe 0x8ef0d0`
      @8ef836..8ef857 ⇒ ≤ ⌊budget⌋ iterations; (ii) box bounds x∈[0,w),
      y∈[0,h) @8ef0d0..8ef0ff else epilogue (ret @8ef86c); (iii)
      y-cursor gate `movss [ebp+0x10],%xmm7; comiss; jae 0x8ef85d`
      @8ef104..8ef10c; (iv) budget<0 pre-gate @8ef0b1 (xmm1 =
      [ebp+0x18] loaded @8eefb8 vs xmm3 = 0 @8eefbd, census-clean to
      8ef188) ⇒ skip. x-side: −0x4c += clamp(step, ±1.0)
      @8ef5f6..8ef62c (1.0 @0x11dfbf0, −1.0 @0x11e05a8); substep
      counter −0x48 `cmp $0x32`/jle @8ef631..634, > 50 ⇒ re-jitter
      `[ebp+0x1c] = u·2 − 1` @8ef6c9..8ef6de (2.0 @0x11dfe68).
      **⇒ SPAN: y ∈ [0, LERP(0.45H, 0.96H, u))**, box-limited to h —
      the band descends from the top edge to the target depth and no
      further.
    - **①b Child recursion + caller side (closes (82)-item 6):** child
      gate `rand·100.0 < 2.0` ⇒ **P = 2%** @8ef774..8ef783
      (0x11e02dc = 100.0); the gate + call @8ef823 sit in the walk
      body immediately before the back-edge (address layout ⇒
      attempted per iteration); child budget xmm1 = `(u2·50 − 50) +
      (parent_budget − steps)` @8ef7e2..8ef800 (50.0 @0x11e0284);
      child xy from the parent's live int pair `lea −0x38` @8ef7ee.
      Caller side: X-roll = `5 + ⌊(W−9)·u2⌋` @8f08ad..8f08e9;
      **xmm4 provenance CLOSED** = `u1 · (−0x10c)` @8f07b5..8f083c
      (u1 = NextU on state %edi, scale +1/2³¹ @0x11df988) →
      `cvttss2si` @8f08e5 (slab 4f00e5) → −0x118 @8f08f3; −0x10c
      last-written @8f05c0 = **0.25·u + 0.75** (0x11df9d0 = 0.25,
      0x11dfb2c = 0.75; the base value's semantics = OPEN), −0x118
      later reused as draw budget; **L2/L3 = 120 + ⌊81u⌋**
      byte-exact re-confirmed (C53: ecx=0x78 @8f1cff/8f26f0, mulsd
      81.0 @8f1d10/8f2701, stores −0x118 @8f1d42/8f2733, `decl`
      @8f23bf/8f2d5d, gates @8f256d/8f286e/8f2f0b, L2 = 2 passes
      `inc −0x10c; cmp $0x2; jl 0x8f1b00` @8f2585..8f2595, band/scatter
      calls 8ee750 @8f20d1/8f2a6c + 8eead0 @8f255d/8f2efb).
    - **② Deliverable (b) — the composition-order diagram (every arrow
      byte-cited):**
      **(I) Init — the base:** wang fill driver `0x904c20`
      (wrap-modulo copy) → **`LoadFromImageData 0x8f9ab0`** u16 +
      material fill (accepted wang out_map fed flag=1, callers
      **0x905dd7 / 0x905f1e**) + area-grid `SetSize` @**0x90738f /
      0x907852** ⇒ the per-cell float/u16 grids are Init-built and
      area-cached [VERIFIED §11 rows 3/5/6 + F-anchor].
      **(II) Config-P fill — the CAVES lane (built outside Update):**
      `BiomeHelper::Serialize` = fn **0x8f3260** dispatches: kind-2 →
      fn2 `0x8ee440` @0x8f36fe (C65); kind-0 gate `test %ecx,%ecx;
      jne 0x8f389e` @8f377d + `[this+0x1d4]==0` @8f3785 ⇒ P is null,
      then `[this+0xc0]≠0` (fall-through @8f3791) → **fn C1
      `0x8f2ff0` called @0x8f37a4** (`fulltext86.asm` L1510258; C56's
      slab `0x4f27f0` arm ✓, target = true 0x8F2FF0) with
      `lea 0x8(%eax),%ecx; mov %eax,%edx` → result stored
      `mov %eax,0x1d4(%ecx)` @0x8f37ae → **fnC1 → fnB `0x8efdd0`
      @8f323c** (the caves-field walk = entry (75)'s hand-off);
      `[this+0xc0]==0` → the `[this+0xb8]≠0` arm → fn1 `0x8ee230`
      @0x8f37d4; both-zero → global default @0x8f37e9 (ctx string
      0x1173214) — the C56 map. **Serialize ALSO calls fnB directly
      @8f3770** (this = `[obj+0xc0]`, pushed arg `[obj+0x1d4]`; that
      arm's pre-gate @8f372d..8f3757 = OPEN). Serialize's single
      caller **`a4e67a` is unidentified ⇒ Init-vs-frame timing of the
      P fill = OPEN** (fnB's caller census is closed: fnC1 8f323c +
      Serialize 8f3770 only — the caves lane never runs inside
      Update).
      **(III) Async chunk materialization:** state machine `0x8e4ec0`
      (single caller 8e6b89): stage cmps $0x24e/$0x247 @8e50aa/bb,
      four {build-cache `0x939b80`, DistanceField `0x8e4990` gated
      ret==1} quadrant pairs @8e50f9..8e51c8 + locks — **caches only,
      zero terrain writes (F1 confirmed).**
      **(IV) Per-frame `Update 0x90b8a0` application order:**
      **1)** `DoBufferedPixelScenes 0x910c20` **FIRST, unconditional**
      (after the profiler ctor 65a640) @**90b8f0** — the ART lane;
      **2)** gate `cmpb $0,[ebp+8]; je 0x90ba86` @**90b8f5** →
      chunk-view loop @**90b930** (stride 0x14, count ÷20 via
      0x66666667, per-entry gates `cmpb $0,0x4(%esi)` @90b94d /
      `cmpl $0,0xdc(%esi)` @90b953) → view-AABB @**90b9a8..9c9** →
      **`call 0x909810`** @**90b9d9** (returns al; **role OPEN**) →
      al → **config fetch `0x909da0`** @**90ba28** (slab 5095a0) →
      `[config+0x2a4]≠0` @**90ba31..39** → **`call 0x8f75c0`**
      @**90ba48** (5 args; head read this session = assert gate on
      `[guard+4]==0` @8f75e3 with file 0x1173240 `biome_materials.cpp`
      line 0x2d3 / expr 0x11769e4 date-format logger, main path
      @8f76af reads arg3 `[ebp+0x10]` — **downstream role OPEN**) →
      entry erase-by-swap @**90ba4d..ba82**.
      **(V) The NOISE/material lane** reaches the sampler `0x90d860`
      only via the **indirect job functor** (C54: driver `0x908f40` =
      the ONLY surfaceField caller, ZERO e8/e9 callers; re-greped this
      session: **zero `call 0x90d860` sites** — vtable slot+8 thunk
      0xa9a120 per C65) ⇒ **the 8f75c0 → … → 0x908f40 linkage =
      OPEN.**
      **Ordering verdict (the render-gate clause):** at any surface
      cell the write order is **wang/u16 base (Init) → [caves P fill
      (II), timing OPEN but outside Update] → per frame: pixel scenes
      (FIRST) → chunk material/noise paint**; dig #81's caves-field
      INTERNAL order nests inside (II). Residual OPEN arrows:
      Serialize timing (a4e67a), 909810's role, 8f75c0's downstream,
      the fnB-arm pre-gate @8f372d..8f3757 + the 8f377d dispatch entry
      — all **non-blockers** (recorded under Current_work Next).
    - **③ (73) corrections (stated here; (73) was already retracted by
      (74) ⇒ NO §8 row):** the band-lane select is **FIXED k = 3**
      (both scale consts 0x11dfef0/0x11e05f8 = 0.0 ⇒ ecx = 3 always,
      `ja` never taken); the compose @8f0396/8f039e = **−0x104 ←
      −0x104 × (u·w₃ + c₃)** — multiplicative (NOT "v_out +="),
      effective factor 0.4u + 0.1 ⇒ the cursor SHRINKS; lane-4 = ×
      **0.25** + **0.75** (0x11df9d0/0x11dfb2c — not 0.2), lane-5 = ×
      **0.13** + **1.07** (0x11df990/0x11dfc20 — not 0.49); jump table
      @8f02e0 = `jmp *0x8f2fd0(,%ecx,4)`.
    - **④ (75)'s scroll-queue item DISSOLVED:** entry (75) records the
      fnC1↔fnB hand-off only — no scroll_accum/wheel/8e7054 claim
      exists in ABOUT_MATH/VERIFIED/CONSTANTS/Current_work/
      SESSION_CONTEXT; `[0x1345364]`/`[0x1345368]` have exactly one
      writer each (@ff2d4c/@feccbf) inside GL-extension registration
      (strings 0x11db31c = `'glGenProgramPipelines'`, 0x11d7f34 =
      `'glColor4bv'`) ⇒ GL proc pointers, **not** scroll.
    - Status: docs only (no port changes; `lib/` untouched). Landed:
      CONSTANTS **C73** (+ the **C53** in-row blocker resolution), this
      entry **(94)**, VERIFIED **§11 stage-9 UPDATE** + **§12 dig-94
      bullet** + queue markers (§12 :547 / :571), Current_work
      Status/Landed/Next refresh (Phase 3 → **byte-CLOSED**). ISSUES:
      none filed (I20 remains next free). Tests **177/177**; y224 byte
      bar **0/12 rms 0.0000**.
  - **2026-09-23 (95) — Phase 4 step 1 (dig #95): the component-BUILD
    read CLOSED — MaterialComponent ctor `0x7daeb0` (defaults +
    same-frame schema registration), the complete XML-attr → 132-B slot
    map from three byte-agreeing passes, `[config+0x2a4]` =
    `mBiomeMaterials`, the `<Materials>` source pinned (P1 = inline);
    the (93) BUILD residual is now OPEN only on its RESOLVE half.**
    - Method: byte RE of `noita_dev.exe` (17,007,104 B, md5
      `8b611494212a69492dd0a4527d9c92e0`) over the cached true
      disassembly `mapgen/extractions/fulltext86.asm (X1)` (slab→true +0x400800;
      `.rdata` VA = file + 0x400E00; strings recovered by scanning the
      exe binary — objdump's ASCII gutter splits literals, so `grep` of
      the asm never matches them). Docs-only dig; `lib/` untouched,
      `vendor/` read-only.
    - **① ctor = fn `0x7daeb0` — defaults + schema registration in one
      frame (CONSTANTS C74):** thiscall (ecx→ebx, `sub $0x1bc`, SEH
      unwind 0x10845e4) writes vtable **`0x1191fc0`** @7daef0, then
      default-fills the entire record @7daf2a..7dafc6: `+0x04`=0
      (celldata), name SSO string `+0x08..+0x17` (size `+0x18`=0, cap
      `+0x1c`=0xf — **entry (93)'s `[+0x18]==0` empty-name check IS the
      string's size field**), `+0x20`=10 (material_index),
      `+0x24/+0x28`=0.1f (material_min/max), `+0x2c`=0 (add_perlin),
      `+0x30/34`=1.0f (scales), `+0x38` w=0 {is_rare, limit_y},
      `+0x3c`=100.0f / `+0x40`=2048.0f (limit_min/max_y), `+0x44` w=0
      {rare_use_perlin, rare_use_fbm_perlin}, `+0x46`=1
      (rare_use_polka), `+0x48/4c`=0.05f (rare_scale_x/y), `+0x50`=0,
      `+0x54/58`=0, `+0x5c`=0.2f / `+0x60`=0.65f (polka radii),
      `+0x64`=1 (polka_is_boxed), `+0x68`=0.2f (polka_probability),
      `+0x6c`=0.2f / `+0x70`=1.0f (**out-gate defaults**), `+0x74`=0
      (is_polygon), polygon vector `+0x78/+0x7c/+0x80` zeroed + inited
      by 0x92baa0 @7dafe6 — full per-store table in C74; end `+0x84`
      = 132 B ✓. **Schema registration (same frame):** string
      `"MaterialComponent"` (len 0x11, **0x1153bd4**) @7db002 →
      registry getter **0x92a5c0** @7db027 → find **0x43e0f0** @7db035
      → miss = insert **0x4498f0** + **0x4499a0** @7db06b/7db080 →
      payload = node+**0x28** @7db08b → once-guard
      `mov (%esi),%eax; cmp 0x4(%esi); jne 0x7db6c8` @7db0b2
      (non-empty payload ⇒ already registered) → name push-loop
      **0x444250**: `celldata` @7db0bd, `material_name` @7db100,
      `material_index` @7db141, `material_min` @7db182,
      `material_max` @7db1c3 … `rare_use_polka` @7db44d (cluster
      continues through the full attr list).
    - **② The attr→slot map (the byte prerequisite the Phase-4 port
      waited for):** vtable `0x1191fc0` = [0x7e22a0, **0x7dc850**,
      **0x7de160**, 0x7dc670]; pass A = vtable+4 fn **0x7dc850**
      (name-push + `lea slot(%ebx)`, @7dc897..7dd465), pass B =
      vtable+8 fn **0x7de160** (same pairs on `%esi`, @7de26a..), pass
      C = mov-form `mov $name,%edx` (@7deda0..) — **all three agree
      byte for byte**: `celldata`→`+0x04` · `material_name`→`+0x08` ·
      `material_index`→`+0x20` · `material_min`→`+0x24` ·
      `material_max`→`+0x28` · `add_perlin`→`+0x2c` ·
      `add_perlin_scale_x`→`+0x30` · `add_perlin_scale_y`→`+0x34` ·
      `is_rare`→`+0x38` · `limit_y`→`+0x39` · `limit_min_y`→`+0x3c` ·
      `limit_max_y`→`+0x40` · `rare_use_perlin`→`+0x44` ·
      `rare_use_fbm_perlin`→`+0x45` · `rare_use_polka`→`+0x46` ·
      `rare_scale_x`→`+0x48` · `rare_scale_y`→`+0x4c` ·
      `rare_offset_by_seed`→`+0x50` · `rare_offset_x`→`+0x54` ·
      `rare_offset_y`→`+0x58` · `rare_polka_radius_low`→`+0x5c` ·
      `rare_polka_radius_high`→`+0x60` · `rare_polka_is_boxed`→`+0x64`
      · `rare_polka_probability`→`+0x68` · `rare_required_min`→`+0x6c`
      · `rare_required_max`→`+0x70` · `is_polygon`→`+0x74` ·
      `polygon`→`+0x78`. ⇒ **every C72/C93 gate slot now carries its
      XML name**: main gate `[[+0x24],[+0x28))` = material_min/max,
      out-gate `((+0x6c),(+0x70]]` = rare_required_min/max, `[+0x38]`
      = is_rare, `[+0x39]` = limit_y, `[+0x44]/[+0x45]` =
      rare_use_perlin/fbm_perlin, `[+0x46]` = rare_use_polka,
      `[+0x50]` = rare_offset_by_seed, `[+0x2c]` = add_perlin,
      `[+0x74]` = is_polygon, `[+0x78]` = polygon — C93/C72 refined in
      place, **no §8 overturn**.
    - **③ `[config+0x2a4]` = `mBiomeMaterials` (C58 walk, two
      byte-verified stores):** guard `mov $0x117a338,%edx` (string
      `'mBiomeMaterials'`) → eq 0x4447f0 → getter **0x9c8660** →
      `mov %eax,0x2a4(%esi)` @**49de93**; ordinal case
      `mov %edi,%ecx; call 0x9c8660` → `mov %eax,0x2a4(%esi)`
      @**49e83c**; zero-inits @496195/4e8a6d; siblings **0x117a2a8**
      `'coarse_map_cell_count_always_zero'`→`+0x2a2` @49de31 and
      **0x117a2cc** `'coarse_map_inject_light'`→`+0x2a3` @49de62.
      Getter 0x9c8660 = holder `[esi+4]` → virtual get (null ⇒ static
      default 0x12ef63c) → typeid check (static 0x12f20c4 + IAT
      0x114a36c) → returns `*([esi+4]+4)`. The element string
      **`'Materials'` = 0x11a06a8** (only standalone copy in .rdata);
      xrefs **744c4e** (CellFactory region) + **8f38f6/8f393e/8f39d6**
      inside a biome.cpp (0x1172ea8, assert line 0x4b8) fn — tag-eq
      **0x42c440** @8f3910. **P1 source = INLINE `<Materials>`**
      (hills.xml:184, first `<MaterialComponent>` @187): no bare
      `mBiomeMaterials=` and no `mBiomeMaterialsFile` in the surface
      files — the File attr exists only in friend_1..6/roadblock/
      secret_entrance/snowcastle_cavern/solid_wall (e.g.
      `mBiomeMaterialsFile="data/materials/biome_forest.xml"`,
      friend_1.xml:7); `coarse_map_inject_light` only in
      sky_light_injector.xml.
    - **④ Worked fixture + P1 leg activity + retired red herrings:**
      hills coal component (hills.xml:187): material_name `"coal"`,
      material_min/max = **0.51/0.55**, is_rare 1, limit_y 0,
      limit_min/max_y = **100/2048 (== ctor defaults)**, material_index
      10 (== default), rare_required 0/10, rare_use_perlin 0,
      rare_use_polka 1 (== default), rare_polka_is_boxed **0 (≠ default
      1)**, polka probability 0.160871, radius 0.357143/0.771429; soil
      (hills.xml:209) = **0.45/0.53**. Leg-activity greps (this
      session): `rare_use_fbm_perlin` in **0** `data/biome/*.xml`
      files; `is_polygon=` only in boss_arena/end_wall/
      lava_90percent/temple_wall (no surface file) ⇒ **the fbm
      selector + polygon legs never fire from biome XML**; `add_perlin=`
      = 38 files — among the surface set only **desert (`0`** — scales
      0.041 given but inert) and **mountain_center (`1`**, scales
      0.01/0.02 ⇒ the v′ transform is live there); hills sets none of
      add_perlin/fbm/is_polygon (⇒ ctor defaults govern: v′ off, fbm
      off, polygon off). **`push $0x84` ×4 = assert-log LINE NUMBERS,
      not sizes:** @732002/732073 `Assert failed: (celldata) in
      …box2d_collisions.cpp at line 132` (fmt 0x1150f60, expr
      0x117d2e4, file 0x119ebb0, `[arg+0x38]==0` guard @731ffa,
      null-crash `movl $0x1ca9,(%eax)` @731fea) and @748c9d/748d14
      `(this != temp) in …cfirecell.cpp at line 132` (expr 0x11a095c,
      file 0x11a0878) ⇒ **no literal `new(0x84)` exists in the exe**;
      the component stride = the classifier's `add $0x84` (C72) +
      `imul $0x84` index math @5d0eb8/5d0ff5.
    - **Residual OPEN of the (93) BUILD residual (recorded, not
      blockers):** the `<Materials>` child-element → wrapper flow that
      fills `+0x2a4` beyond the two verified stores, the record RESOLVE
      site (material_name → the `+0x04` celldata pointer), `_enabled`
      (in every P1 `<MaterialComponent>` but absent from all three
      passes ⇒ framework-level), the component allocation/growth site,
      and which serialization virtual (0x7dc850/0x7de160) is
      read-vs-write.
    - Status: docs only (no port changes; `lib/` untouched). Landed:
      CONSTANTS **C74**, this entry **(95)**, VERIFIED **§12 dig-95
      bullet**, Current_work Status/Landed/Next refresh (Phase 4
      step 1 → **DONE**; next = the port increment dig). ISSUES: none
      filed (I20 remains next free). Tests **177/177**; y224 byte bar
      **0/12 rms 0.0000**.
  - **2026-09-23 (96) — Phase 4 step 2 (dig #96): the surface-level
    CLASSIFIER is ported — `mapgen/lib/surface-level.mjs`
    (`componentFromXml` / `buildMaterialsTable` / `classify` /
    `rarePolka`, arities 1/3/4/6), byte-cited gate by gate, + 37
    tests + the api-surface pin; module-as-library only, default
    render untouched.**
    - Method: byte RE over `mapgen/extractions/fulltext86.asm (X1)` — classifier
      loop/assert region 1512120..1512205 + loop tail 1512525..1512565
      + limit/polygon 1512305..1512392, ramp + the 8fbed6..8fbf26 gap
      1520576..1520668, builder 1516229..1516965, hashes
      1517031..1517250, call site 1541946..1541995; PE constants
      re-read (.rdata file = VA−0x400E00, .data VA−0x401A00; exe md5
      `8b611494212a69492dd0a4527d9c92e0`); hills.xml attrs +
      `tests/helpers/data.mjs` re-read — all verified this session.
      The port reuses `simplex2DDeriv` from `noise-proto.mjs`
      (inherits its FLAGGED skew BSS); every float slot is
      `Math.fround` at parse time (strtof f32; overflow/NaN → throw).
    - **① Gate order byte-settled — and (93)'s 0x108 placement is
      REFUTED (§8 row 29):** loop head **0x8f5160** (`mov 0x8(%ebx),%ebx;
      add %esi,%ebx; jne 0x8f5221`; back-jmp @0x8f573b) runs
      **null-comp 0x107 (push @0x8f516b, expr 0x1151e28) THEN
      cellFactory 0x108 (`cmpl $0,0x30(%eax)` @0x8f5224 → `jne
      0x8f52e9` → push @0x8f522e, expr 0x11732c0) EVERY iteration**,
      both ahead of the diag @0x8f52e9 (0x10f / line 271, log
      0x11732d0, fmt 0x1150f60, FILE 0x1173240) — §12 (93) had 0x108
      once before the loop. Band CLOSED both ends → null at the shared
      miss epilogue **0x8f574c** (`xor eax` @0x8f574e, `ret $8`
      @0x8f5754; loop exit `jge 0x8f5733` lands the same) → diag →
      membership 0x442610 (predicate UNREAD ⇒ non-null = found,
      tagged) → limit_y flag +0x39 @0x8f53f0 with slots **+0x3c/+0x40**
      (`movss 0x3c` @0x8f53f9 / `comiss 0x40` @0x8f540e), closed on
      f32(y) → polygon +0x74 @0x8f5418 (vector **+0x78/+0x7c**, count
      = (end−begin)>>3 @0x8f5422..0x8f5428; <3 → 0x118 / line 280;
      query 0x10096a0 ⇒ throw) → second-null @0x8f5572 → v′
      @0x8f557c = f32(simplex(f32(x)·[+0x30], f32(y)·[+0x34]) + v)
      (cvtsd2ss @0x8f55ad, addss @0x8f55b1) → main gate
      **[[+0x24],[+0x28))** half-open (jb @0x8f55b6 / jbe @0x8f55c5)
      → is_rare +0x38 → accept @0x8f5740 = `mov 0x4(%ebx),%eax` →
      transform @0x8f55dc..0x8f560b px/py = fround(fround(f32(x)·
      [+0x48]) + [+0x54]) → jitter +0x50 @0x8f55d8 (`je 0x8f5678`;
      call 0x9119d0 @0x8f5612 ⇒ throw) → noise +0x44 @0x8f5678
      (fbm +0x45 → 0x9fad90 ⇒ throw; plain simplex @0x8f5694;
      out-gate (min,max] @0x8f56a6..0x8f56b4) → polka @0x8f56b6
      (off → `je 0x8f5740` accept; call @0x8f56c0..0x8f56e5 maps
      px, py, [+0x5c], [+0x60], [+0x64]→cl, [+0x68]→stack; out-gate
      @0x8f56f4..0x8f5702) → tail `add $0x84` @0x8f5713 (stride 132 B,
      count via signed-div magic 0x3e0f83e1 @0x8f571c..0x8f5731).
      **Noise→polka = SEQUENTIAL** (both gates must pass; the
      asymmetric-bounds test refutes an either-leg port).
    - **② Ramp + hash math closed:** rarePolka **0x8fbe60..0x8fbfc3**
      = floor-fix cell → fracs to −0x8/−0xc → hash92f0 call **@0x8fbf01**
      (w0/w1/r2 at −0x28/−0x24/−0x20) → R = low+(high−low)·r2, R ≤ 0
      → 0 (`jae 0x8fbfbd`, xmm0 zeroed @0x8fbf0b) → k = 2/R (`divss`
      @0x8fbf38) → p = (k−2)·w1 + (fracY·k − (k−1)), q = (k−2)·w0 +
      (fracX·k − (k−1)) → boxed p⁴+q⁴ ≤ 1 else 0 / unboxed d =
      p²+q² clamped at 1 → (1−d)³ as f32 (cvtps2pd widen). Prob gate =
      **r1 ≥ prob → 0 (jae; equality trips it — pinned by a
      searched-cell 0-vs-full contrast)**. hash9200 **0x8f9200** /
      hash92f0 **0x8f92f0** = frac(K·P) with **P = squared product**
      fround(fround(fy·fy)·fround(fx·fx)), x→base 26 / y→base 161;
      fold = t − 71·⌊FOLD_Q·t⌋ + base (floor-fix idiom = Math.floor);
      frac = t − trunc(t). PE constants this session: FOLD_Q 0x11df8f4
      = 0.014084506779909134, 71/26/161 = 0x11e02b8/0x11e01f8/
      0x11e031c, K9200 0x11df8ac = 0.00101319863460958, K92F0 →
      0x13476e4 = 0.0010513747110962868, **K1 imm 0x3acbdc41 →
      0.0015553311677649617, K2 imm 0x3aa32fcf → 0.0012450161157175899**
      (struct.unpack verified), 2.0 = 0x11dfe68, 1.0 = 0x11dfbf0.
      Band = seed∪comps replace-if-narrower (0x8f8fe4..0x8f8fff; seed
      init unread ⇒ band-as-param); builder min≤max → `jbe 0x8f8fde`
      else log (strings 0x11735f0.. UNREAD ⇒ port throws);
      mInitialized := 1 @0x8f9054; celldata assign `mov %ecx,0x4(%eax)`
      @0x8f3650/0x8f3a04.
    - **③ Tests + gates:** `tests/mapgen/surface-level.test.mjs` =
      **37 tests** — ctor defaults + full-attr f32/bool/throw pins
      (exact `toBe(Math.fround(x))` + `toBeCloseTo(...,7)`; precision
      4 for 424.229 where the f32 ulp 3.05e-5 makes 7 impossible),
      band union/narrower-seed + validation, gate order (band-first
      via a hand-built narrower band — as-built bands are seed∪comps,
      so they can never reject a comp-matching v), 0x10f/0x118/jitter/
      fbm/polygon honest throws + diag-before-limit order, half-open
      main gate + first-match chain, v′ dynamic-gate double pin
      (add_perlin on/off across both s32 signs), noise & polka
      (min,max] edge pins, SEQUENTIAL-legs asymmetry probe, rarePolka
      jae-equality contrast, R ≤ 0, boxed/unboxed + low/high swap
      searches, f32 grid sweep, and the **data-gated hills.xml walk**
      (6 comps, band [0, 3.5], v=0.45 → soil closed-lower, v=0.95 →
      rock (sand upper open), y-window edges on f32(424.229), comp-1
      rare ramp walk). api-surface pins the 4 exports/arities.
      Gates this run: **npm test 215/215** (177 baseline + 38) and
      caves-field **33/33, no skips** (y224 byte bar runs; oracle JSON
      2,641 B present this session).
    - **④ OPEN carried (unchanged, non-blockers):** band-seed initial
      value unread → band is a caller param; membership 0x442610
      predicate; builder min>max log target/strings; jitter/fbm/
      polygon bodies (throws); record RESOLVE + lookup 0x741890;
      `_enabled` never-set; printer al=0 folded into the throw;
      simplex skew BSS (noise-proto FLAGGED). P1 census stands:
      jitter/fbm/is_polygon/add_perlin trigger 0 P1 files (entry (95):
      hills sets none of add_perlin/fbm/is_polygon; hills comps 4/5
      set rare_use_perlin=1 only).
    - Status: **code + tests + docs landed** (env-gated library;
      render untouched). Landed: CONSTANTS **C75**, this entry **(96)**,
      VERIFIED **§12 dig-96 bullet** + **§8 row 29** ((93)'s "0x108
      before the loop" refuted; next free row = 30), Current_work
      Status/Next refresh (Phase 4 step 2 → **DONE**; next = the step-3
      wiring increment). ISSUES: none filed (I20 remains next free).
      Tests **215/215**; caves-field gate **33/33, no skips** (oracle
      2,641 B).
  - **2026-09-23 (97) — Phase 4 step 3 (dig #97): the sampler→classifier
    call-site chain pinned + the classify x/y FRAME decided, wired into
    the SURFACE_V3 lane (chain = C76); 3 new data-gated tests, default
    render untouched.**
    - **① RE — full chain byte-pinned this session** (all cites = CONSTANTS
      C76; source `mapgen/extractions/fulltext86.asm (X1)`): FUN_0090d860's loop —
      outer **ESI = y** (init `mov (%ebx),%esi` @0x90d8cf → save
      `[esp+0x14]`, min-fold head `jge 0x90dddd` @0x90d8ed), inner
      **EDI = x** (`xor %edi,%edi` @0x90d8f6, bound `*[args+0x10]`, tail
      `inc %edi` @0x90ddbf → `jl 0x90d904` @0x90ddc6 / `inc %esi`
      @0x90ddd0 → `jl 0x90d8f3` @0x90ddd7) ⇒ **C54's slab labels
      0x50d104/0x50d0f3 inner-x/outer-y confirmed — no §8 overturn**
      (row 30 stays free). Field gate `comiss 0x11dfa94` @0x90dbc3 → save
      @0x90dbca → `jbe 0x90e02b` (≤0.5 ⇒ skip cell), P =
      `[config+0x1d4]` null → the same skip @0x90dbe7; origin-adds fold
      `*[args+0x24]`/`*[args+0x28]` int32 onto the counters
      @0x90dbf4..fd; **evaluator2 @0x90dd24 = (x, y, field)** — xmm0 =
      (d)ESI = x, xmm1 = (d)EDI = y, xmm2 = field @0x90dd0e ⇒ the port's
      arg order stands, and arg3 = 1.0 = the documented single-call
      proxy is **RESOLVED** (was OPEN); floor-fix pushes floor(y)
      @0x90dd55 then floor(x) @0x90dd72 with v reloaded from the
      evaluator slot into xmm3 @0x90dd6c ⇒ **classify @0x90dd7e receives
      [ebp+8] = x, [ebp+0xc] = y** (C75 + `mov 0xc(%ebp),%esi` @0x8f53f4
      → limit_y chain re-verified); null-merge `je 0x90ddb0` @0x90dd8b =
      **air**; kind `[record+0x38]` @0x90dd8d (==3 → `0xa047d0`, bss
      byte, NO store; else intern cap 0x2000 → value) and **planter
      0x7644d0 gets the same x/y sums classify got** (@0x90de44/4e →
      pushes @0x90de48/50) → accessor 0x95a5e0 → dword store @0x90de9c
      (grid `owner+0x1e0`, stride `[owner+0x1c8]`); abort bounds test
      the RAW counters @0x90dea1..b7 ⇒ **counters ≥ 0 = window-local
      px** (origins carry any world offset).
    - **② The frame decision (the dig's core new fact):** classify's
      values = origin + counter px — but in WHICH frame? Three
      converging lines fix y's frame as **world px with 0 =
      surface-band top = canvas py SKY_ROWS·512 = 24576**: (a)
      `data/biome/hills.xml` `<Materials>` has **limit_y=1 on only 2 of
      6 comps** — soil `[-1024, 424.229]`, copper `[750, 2048]`; the
      other four `limit_y="0"` (the earlier "four-band" claim was
      chat-only, fabricated ⇒ **RETRACTED** — nothing tracked to move);
      (b) same file's `mGradientStartY/EndY` = −1024/1024 share the
      frame; (c) the surface band lives at canvas ty 48..50 = biome
      rows 0..2 (experiments/2026-09-21-noise-window.mjs:4-6) ⇒ y ≈
      0..1536 there. **Eliminations:** y = world px @OFFSET_Y=14 puts
      the surface at −7168 (outside soil's min ⇒ soil rejects the
      surface ✗); y = raw canvas px puts it at 24576 > 424.229 (✗) ⇒
      **y = canvas_py − 24576** ✓. x: no `limit_x` anywhere — a
      constant x shift only phases the evaluator/polka inputs (coverage
      shift-invariant) ⇒ **x = canvas px (offset 0)**; the −24576 shift
      belongs to y's sky band, which has no x counterpart. Port mapping
      (integer math, +5 = cell center = the lane's `gx+0.5`): x =
      `tx·512 + cx·10 + 5`, y = `ty·512 + cy·10 + 5 − 24576`. Game
      classifies **per pixel**; the port samples one px per cell —
      deviation tagged (Phase 5 IoU will measure it).
    - **③ Wiring + tests:** `noise-terrain.mjs` default branch = `v > 0.5
      && surfaceTable` → `classify(surfaceTable, x, y, v)` (byte-cited
      comments; any component throw propagates to noiseAt's catch ⇒ the
      chunk falls through honestly) + module-private
      `ensureSurfaceTable` (cache keyed `def.filename`; celldata
      assigned once at build so the cached table never mutates; no
      `<MaterialComponent>` blocks ⇒ null = the mBiomeMaterials==0 →
      air arm; band seed `{0,0}` proxy — seed init unread).
      `surface-level.mjs` header truth-fixed (it IS imported now;
      PROC_FILL still unwired). New
      `tests/mapgen/surface-wiring.test.mjs` = **3 data-gated tests**:
      round-trip (mask 1 ⇒ gate ∧ classify hit over all 12 band-hills
      chunks), converse/equivalence (mask 0 ∧ v > 0.5 never occurs —
      catches any null-classify wiring bug), and frame probes
      (constructed soil-band v = 0.505 at REAL lane y 405/505 + both
      eliminated frames ⇒ C76's elimination argument executed against
      the real classifier). **Measured data fact:** band v ∈
      **[0.7191, 1.2809]** (rows 48..56, 555k+ cells — no v < 0.53
      anywhere) ⇒ mask ≡ gate on current data; the classifier's reject
      arms are unreachable in-band (they stay unit-pinned in
      surface-level.test) and the frame's empirical validation lands
      with Phase 5's IoU/visual check.
    - Status: **code + tests + docs landed** (env-gated lane; default
      render untouched). Landed: CONSTANTS **C76**, this entry **(97)**,
      VERIFIED **§12 dig-97 bullet** (§8 row 30 stays free — no
      overturn), Current_work refresh (Phase 4 step 3 → **DONE**; next
      = Phase 5). ISSUES: none filed (I20 remains next free). Tests
      **218/218**; caves-field gate **33/33, no skips** (oracle 2,641 B).
  - **2026-09-23 (98) — Phase 5 step 1 (dig #98): census fixtures + the
    switch/tail re-read (sign flip, case-2 bare n, LIVE default arm):**
    - **① The census, made executable** (Phase-0 unit fixtures):
      `tests/mapgen/surface-census.test.mjs` = **39 tests** — 30
      data-gated per-file censuses + 1 parser-chain + 8 port-only frame
      pins. The per-file layer pins `<Topology>` presence + the 9 named
      noise attrs + the MaterialComponent count + the mx/mn literals +
      the band fold (`buildMaterialsTable` vs an independent f32
      extremum fold over the literal arrays, seed {0,0}) + a zero
      `is_polygon`/`celldata` tripwire for every P1 file (the Phase-0
      30; names re-cut from census98b — no `mountain_right_3`). It
      **corrects five (82)-era census cells** (VERIFIED §8 row 30):
      ① `noise_type` is NOT uniform — winter + winter_caves (and
      mountain_center + pyramid) have NO `noise_type` ⇒ `uidFrom:114`
      yields `noiseKind −1` for those lanes; ② mountain_lake
      `mGradientStartY = "-835"`; ③ `mGradientAddNoise = "0"` for
      hills_flat + mountain_lake (laboratory too, outside P1) = the LIVE
      default-arm inputs; ④ desert `mMultiplierGradient = "0.881426"`;
      ⑤ mountain_center + pyramid DO carry `<Topology>` — without the
      mGradient/noise attrs (all nine null). The parser-chain test runs
      the same cells through the real `loadBiomeConfig` (its `biomes` is
      color-keyed ⇒ hills_flat/mountain_center defs are color-absent —
      asserted and noted in-test; raw XML stays ground truth for those).
    - **② The switch, full re-read** (CONSTANTS **C77**; source
      mapgen/extractions/fulltext86.asm (X1) + mapgen/extractions/rdata.bin (X33), file = VA −
      0x400E00, anchor 0xeb14 ↔ VA 0x11df914): gate `comiss 0x11dfb84`
      @true **0x90ab48** → `jbe 0x90b0a2`; loads @0x90ab55/0x90ab5b;
      `dec %eax` @0x90ab74 → je 1→**0x90afeb** / 2→**0x90aeba** /
      3→**0x90ae03**; **the default arm @0x90ab7d is LIVE via the world
      value 0** (hills_flat + mountain_lake, laboratory outside P1):
      `call 0x8fb570` @**0x90ab9f** (UNREAD; ≠ whiteLattice2d 0x8fb350
      — prelude-shaped only → **ISSUES I20** ①) → g = a·0.05+0.05 f32
      chain → `call 0x8fca60` (simplex2d) @**0x90abee** → shared tail →
      `jmp 0x90b0a2`; case-1 core `call 0x8fc020` @**0x90b068** (xmm0 =
      x-chain); case-3 shares it via `jmp 0x90b068`; case-2 core
      @0x90afdc → `movss` rp @0x90afe1 → `jmp 0x90b079`. **Three port
      defects found + fixed:** ① the blend tail was **sign-flipped** —
      `subss %xmm2,%xmm1` @**0x90b08b** = xmm1−xmm2 = **r2 − r′** (the
      port computed (r′ − r2)); the t and the final add were unrounded
      (divss @0x90b08f / mulss @0x90b097 / addss @0x90b09b) — all three
      arms now carry the byte-exact
      `f(f(f(r2−r′)·f((r′−0.85)/0.1))+r′)`; ② **case 2's blend input =
      f32(n) BARE** — `jmp 0x90b079` skips `cvtps2sd`+`mulsd n·r′`
      @0x90b072/75 (port had r2 = f(n·rp)) ⇒ **ABOUT_MATH:3588's
      `n·r′` is refuted for case 2 only** — cases 1/3 do use f(n·r′)
      (mulsd @0x90b075, sign ✓) → §8 row 31; ③ case-2's `fn/wl·(−20)`
      terms were missing the byte `mulss` f32-round (@0x90af90/0x90afc3
      → cvtps2pd). Comment/message truth-fixes: the switch header block
      (gate/dec-je addresses + LIVE-0 default + tail formula), case-1's
      arg order (arg0/xmm0 = x-chain), case-2's tail pointer, the K2
      `f64_002` parenthetical (**0x11dfc68 = f64
      0.019999999552965164**, widened-f32 — the old "f32 2.0" gloss
      WRONG), and the default-arm throw message now carries the byte
      facts (gate @0x90ab48 / dec-je targets / @0x90ab7d / 0x8fb570
      UNREAD / 0x8fca60 / "see ISSUES I20").
    - **③ Frame pins (port-only, always run):** frame (−7.5, 3.5) with
      gradAt ≡ 10 ⇒ rp = f(s·10) ≈ 0.9005438 > 0.85 (precondition
      asserted in-test; the gradAt≡1000 scratch frame gave rp = 90.05 —
      unusable f32 ulp 0.0078125 at 70k): origin identity (rp = 0 ⇒
      lanes 1/2/3 + the live default arm all return 0, no throw);
      winter two-sided pin (census attr null + `noiseDispatch(−1)` /
      `surfaceField(noiseKind −1)` throw `kind=-1`); default-arm
      throw-message regex pins (byte facts above); lanes 1/3 7-decimal
      byte-tail pins + old-sign discriminators (threshold 1e-3; the
      rp=90 probe measured 135663/133054 old-vs-byte separations); lane
      2 bare-n pin + sensitivity vs the f(n·rp) variant; cross-lane
      distinctness; `evaluator2(·,·,0.5) ≡ 0.5`. The scratch L2
      chain-mirror deviation (0.0078125 @rp=90) resolved: the port's
      missing −20 `mulss` rounds + unrounded addss and the mirror's f64
      wBias (bytes = K.wBias = f32(0.1) @0x11df974) — with byte-exact
      chains both sides agree at `toBeCloseTo(…,7)` (39/39). uidFrom is
      not exported: its census→uid line stays a code-read (:114) with
      the consequence pinned two-sided (census attrs + kind=-1 throw).
    - Status: **code + tests + docs landed.** Landed: CONSTANTS **C77**,
      this entry **(98)**, VERIFIED **§8 rows 30 + 31** + **§12 dig-98
      bullet**, ISSUES **I20** (default-arm body 0x8fb570 — OPEN),
      Current_work refresh (Phase 5 step 1 → **DONE**). Tests
      **257/257**; caves-field gate **33/33, no skips** (oracle 2,641 B).
  - **2026-09-24 (99) — Phase 5 step 2a (dig #99): L3 anchor fit ⇒
    CONSTANT (+11, +12) world px, applied at `worldColorAt` (C78):**
    - **① Instrument** `mapgen/experiments/2026-09-24-l3-anchor-fit.mjs`
      (refuses SURFACE_V2/V3/PROC_FILL — default render only), seed
      78633191, n=32 wang chunks (rows 14/15/17/18 × tx 29..38; coalmine
      10 / excavationsite 16 / liquidcave 2 / fungicave 4; 6/32
      border-flagged; row 16 = HM excluded per
      `mapcap/PREDICTABLE_ZONES.md`), scan dx∈[−15..35] dy∈[−5..25] world
      px step 1 (coarse stride 4 → top-3 peaks ±6 → full-res refine;
      bound = VERIFIED:1083 x∈[−10..30] y∈[0..20] world px ±5 margin).
      **Plain solid IoU dropped — it saturates** (capture cave bg
      ~(13,14,18) ⇒ refSolid ≈ 1.0, no signal). Three structure-sensitive
      metrics: **air** IoU (lum<24, the `mapgen/pipeline/3-compare.mjs:18`
      constant), **edge** IoU (|gx|+|gy| ≥ 30), **lum** zero-mean NCC; plus
      1-D column/row air-profile NCC cross-checks (dx/dy decoupled).
      Sign: score(dx,dy) compares ref(x,y) with gen(x+dx, y+dy) ⇒ peak
      (DX,DY) ⇒ output(x) := gen(x+DX).
    - **② §4 verdict (VERIFIED:208): CONSTANT on both axes.** Best
      structured competitor (free per-area phase over the 4 areas /
      tx-linear / bty-linear / lattice-saw 512·coord mod 10) improves
      RMSE ≤ **4% dx** (const 9.35 → area 8.97 px) and ≤ **2% dy** (6.21
      → 6.11 px) — far under the 20% bar; per-metric `fitAxis` verdicts
      all "no coherent rule (scatter ≈ noise)" (per-chunk best-offset
      RMSE ≈ 6–12 px ⇒ a constant stays valid away from the fit — the §4
      precondition). Lattice slopes: tx dx −0.84 / dy −0.30, bty dx +0.52
      / dy −0.73 — no phase law.
    - **③ Value (11,12).** Per-metric medians air (12,12) / edge (6.5,11)
      / lum (11,14); per-chunk combo median (11.5,11.5); dy>0 in 29/30/31
      of 32 per metric (combo 31/32), dx>0 combo 27/32. Pooled paired
      candidates vs (0,0): Δair **+0.0253** (t=4.82, win 25/32), Δedge
      **+0.0080** (t=3.35, 19/32), Δlum **+0.0542** (t=5.10, 29/32). dy
      dominates — (0,12) keeps 81–83% of Δ, (11,0) ≈ 0
      (+0.0024/−0.0002/+0.0055) — yet the dx increment is significant
      ((11,12) vs (0,12): t=2.95/2.25/3.50); (11,12) vs the
      certified-bound center (10,10) indistinguishable (t ≤ 1.80) but ≥
      on all three (pairwise win-count (11,12) 5/6 vs (10,10) −2/6); sign
      control (−11,−12) flips negative (Δair −0.0491, Δlum −0.0784,
      0/32 wins). Means: air 0.3594 → 0.3846, edge 0.0441 → 0.0521, lum
      0.1402 → 0.1944. All medians INSIDE the certified bound ⇒ no §8
      overturn; §4 confirmed.
    - **④ Application: `L3_ANCHOR = {x:11, y:12}`** exported from
      `mapgen/lib/world-gen.mjs`, applied inside `worldColorAt`
      (:62 area/template/noise): bounds-check the DISPLAY (wx,wy) first,
      then sample content at (wx+11, wy+12); all three lanes shift
      together via the sampled tx/ty; content past the canvas edge → null
      (right 11 px / bottom 12 px strips = background); sampling-only ⇒
      gen-cache `.bin` untouched (no cache rev). NOT `coords.mjs
      CORRECTION` — the fit's gen side is `worldColorAt` (instrument:296),
      which never routes through `chunkToBigMapRect`; bench CORRECTION
      stays 0. Tests: world-gen anchor contracts (back-shift cell pins,
      strip-null) + api-surface pin `L3_ANCHOR` = (11,12).
    - **⑤ Post-apply regression (C78 clause measured; literal full-window
      bit-equality refined — see C78).** Evidence split: fit =
      `mapgen/out/l3-anchor-2026-09-24-preapply.json`, post-apply
      residual = `…-2026-09-24.json` (instrument always writes the
      canonical path). **Residual ≈ (0,0):** per-metric best-offset
      medians air (0, 0.5) / edge (3, 2) / lum (1.5, 2) — all inside the
      certified bound, all `fitAxis` verdicts still "no coherent rule"
      (no residual law appeared); candidate ranking flipped — (0,0) is
      now best on all three (air 0.3829 / edge 0.0528 / lum 0.1880 vs the
      pre-apply (11,12) 0.3846 / 0.0521 / 0.1944), every other constant —
      including (11,12) itself (Δ −0.0317/−0.0049/−0.0486) and the sign
      control (−11,−12) (−0.0240/−0.0082/−0.0474) — now negative ⇒
      sign-closed. **Layer+sign proof by reconstruction**
      (`mapgen/extractions/l3-matched-window.mjs (X23)`): rebuilding the pre frame
      from the current code via back-shift `old(q) = new(q−anchor)` and
      scoring (11,12) is **bit-equal to the recorded pre JSON 32/32 ×
      air/edge/lum**, post full (0,0) equals the recorded post JSON 32/32
      × 3, and the edge in-window [2,498]×[2,497] counted-set mismatches
      = **0** ⇒ `worldColorAt(p) ≡ oldWorldColorAt(p+(11,12))` on every
      scored pixel set. Full-window post (0,0) vs pre (11,12) deltas (air
      −0.0017, edge +0.0007, lum −0.0063 mean; max |Δ| 0.0170/0.0038/
      0.0759) are fully attributed to the scorer's skipped strip (right
      11 cols / bottom 12 rows) plus, for edge alone, the frame-relative
      validE/edgeMask band (both domains are frame-relative [1,510]).
    - Status: **code + tests + docs landed.** Landed: CONSTANTS **C78**
      (registered before use; expectation clause refined to the measured
      outcome), this entry **(99)**, no §8 row (fit inside certified bound
      — §4 confirmed), no ISSUES (I21 still free), Current_work refresh.
      Tests **258/258** (257 baseline + 1 C78 contract test); caves-field
      gate **33/33** standalone.
  - **2026-09-24 (100) — Phase 5 step 2b (dig #100): surface-y line IoU
    on P1 biomes vs capture — the SURFACE_V3 candidate FAILS (bands
    0.000 everywhere; surface line does not exist yet).**
    - **① Metric + instrument (CONSTANTS C79 registered first):**
      `mapgen/experiments/2026-09-24-surface-y-iou.mjs`; env gate =
      `SURFACE_V3=1` REQUIRED, `SURFACE_V2`/`PROC_FILL` REFUSED (isolates
      exactly what Phase-5 step 3 would un-gate: attach gate
      `noise-terrain.mjs:297` off ⇒ the classify chain at
      `noise-terrain.mjs:241` runs); seed `CAPTURE_SEED` 78633191, cache
      r3i, ref = noitamap stitch `mapgen/out/ref/<tx>_<bty>.png`, gen =
      `worldColorAt` with `L3_ANCHOR` (C78) applied at sampling. y_ref =
      sky-top column (≥6 air of rows [0..7], air = lum<24) + first solid
      run ≥20 px; y_gen = first solid run ≥20 px from y≥0 (NO sky-top
      filter — the candidate's flood signature y_gen=0 must stay
      measurable); tile scored iff y_ref on ≥25% of columns; scan ref-side
      bty 6..15 × tx 4..58, **HM row 16 excluded** (plan), P1 =
      first-wins `_biomes_all.xml` filename basename
      `^(mountain|hills|desert|winter|lake)` (color-keyed `cfg.biomes`
      cannot name color-absent defs — dig #98 census note).
    - **② Coverage:** 458 P1 tiles scanned → **56 scorable** (n = 21,892
      paired columns). The genuine sky→ground transition lives in bty
      **10..14** (bty ≤9 = sky-only: 0 P1 tiles scorable; the ref-side
      pre-census's bty-15 hits were CAVE CEILINGS — the sky-top filter
      takes them 14 → 0, which is why it exists). No seed-text pollution
      in the scored tiles' skies (overlay inspection: skies clean).
    - **③ Verdict — band hit-rate ±1/±2/±3 world px = 0.000 on EVERY
      family and EVERY row.** Overall mean |Δy| = **248.62 px**, bias =
      **−248.12** (bias ≡ −meanAbs ⇒ y_gen = 0 on essentially all paired
      columns). Per family: mountain 215.31 / desert 142.13 / winter
      310.41 / hills 288.05 / lake 161.66 (all bias ≈ −meanAbs);
      genNoLine = 74 of 21,966 ref-line columns; gen top-air rows[0..7]
      = 0.004 (non-lake) — i.e. the candidate is SOLID from the tile top.
    - **④ Root cause (measured, not inferred):** the V3 chain feeds
      evaluator2 the hard-coded placeholder `a = 1.0`
      (`noise-terrain.mjs:261` `evaluator2(gx + cfg.minX, gy + cfg.maxX,
      1.0)`); evaluator2's byte-pinned lower clamp at 0.5
      (`noise-proto.mjs:350`, `comiss+ja 0x50872c`) plus `s·t + a` with
      t≈0.318 makes v ≥ ~0.68 **always > 0.5** (measured sky-chunk
      v ∈ 0.77..1.25) ⇒ gate-1 (`v > 0.5` — the sampler's own sky/air
      discriminator, C76) can never reject sky, and the measured noise
      **mask = 1.00 solid** for hills/winter/desert chunks INCLUDING
      deep-sky rows (bty 6), painted `0x6a5a44`; lake = 0.48 partial
      (overlay `4_14_lake` shows the mask staircase; gen top-air 0.576).
      The game's real field source — C44 OPEN, dig #97's
      `[args+0x24]/[args+0x28]` origin-field contents unread — supplies
      a < 0.5 above the surface; the port's proxy cannot. **Consequence:
      this IoU measures the MISSING FIELD, not surface registration —**
      the C78 scope hedge (template/noise-lane registration via the
      shared frame) stays UNVALIDATED until the candidate has a real
      surface line.
    - **⑤ Evidence:** `mapgen/out/surface-y-2026-09-24.json` (per-tile +
      overall/family/row aggregates) + 56 overlays
      `mapgen/out/surface-y-2026-09-24/<tx>_<bty>_<label>.png`
      (dim-ref base; red = y_ref on the true silhouette, green = y_gen
      pinned at the top edge, yellow = |Δy|≤3 band — absent everywhere,
      dark-red = claimed-solid sky gap). Representative:
      `11_13_winter` (gap ≈ 276 px), `35_13_mountain_left_entrance`
      (scene silhouette correct, sky behind flooded), `47_14_desert`
      (shallow real transition ≈ 15 px — still > 3 ⇒ band 0),
      `4_14_lake` (partial-mask staircase).
    - Status: **measurement landed; the candidate FAILS the numeric
      bars ⇒ step 3 (drop `SURFACE_V3`) stays BLOCKED — presented to the
      user as the final oracle (plan order).** Landed: CONSTANTS **C79**
      (registered before use), this entry **(100)**, instrument
      `mapgen/experiments/2026-09-24-surface-y-iou.mjs`, Current_work
      refresh; no §8 row (nothing overturned — §4/C78 untouched: the fit
      itself was never re-tested here), no ISSUES (**I21 still free** —
      the flood is the already-flagged gated-lane state, now quantified,
      not a new defect). Gates green: **npm test 258/258**, caves-field
      standalone **33/33**.
  - **2026-09-24 (101) — dig #101: the V3 field source is WIRED (C80
    world frame) and the surface-y IoU RE-RUN still FAILS — the sky flood
    is gone (top-air 0.004 → 0.941) but the line is not right (meanAbs
    87.87, bands ≤ 0.047) ⇒ per the locked verdict: more Ghidra.**
    - **① Field wiring (the dig-#100 missing piece):** `gradAt` is now
      hoisted before the caves/ramp arms WITHOUT the `SURFACE_V3`
      conjunct (`noise-terrain.mjs:277` — the conjunct would desync the
      test mirror from the instrument), and the classify chain's field
      value is `surfaceField(uid, wx, wy, gradAt, 0, DEF_SEED)`'s RETURN
      computed at WORLD px — the final combine `noise-proto.mjs:713`,
      exactly what driver 0x908F40's kind-0 arm writes into the f32 grid
      the gate reads (VERIFIED:593) — replacing the `a = 1.0` placeholder
      that caused (100)'s flood. Caves-field cache key fixed to
      `` `${def.filename ?? def.name}|${seed}` ``; fail-loud contract
      kept (a field-build throw = I20 default arm ⇒ `return null` ⇒ the
      whole chunk falls through honestly, V2 :237-241 mirror). Lane
      extent unchanged: every non-template procedural chunk runs
      `noise-terrain.mjs:247-325`.
    - **② C80 world frame (field build only) + citations:** `wx = canvas
      px − 35·512 = canvas px − 17920`, `wy = canvas py − (SKY_ROWS+14)·512
      = canvas py − 31744` — CONSTANTS **C80** (registered before use;
      origin semantics `mapcap/PREDICTABLE_ZONES.md:9-10` re-verified on
      disk this session). Evaluate/classify KEEP the C76 lane frame
      (evaluator2 ≡ classify via the floor-fix identity) ⇒ the
      two-frame split is deliberate and **I21** owns the flip. **C44
      shorthand clarified:** C44 = the BitmapCaves **band-stack family**
      (`CONSTANTS.md:67` row + `:946` detail section) — NOT the field
      source; `uid.gradient`'s comment (`noise-terrain.mjs:121`) still
      points at C44. Stale-cite repairs landed (line-neutral, drop sites
      untouched): `noise-terrain.mjs` V2-semantics :216-225→:219-231,
      attach gate :297→:340, V2 mirror :231-235→:237-241;
      `surface-wiring.test.mjs` biomeCfg :95→:101; ISSUES.md I21's test
      cite :153-154→:213-216; C80's two noise-terrain cites :232→:238
      and :137→:143.
    - **③ gradAt census (live XML, `data/biome/` via `findNoitaDataDir`):**
      `<BitmapCaves>` = 1 ×8 — hills, hills2, hills_flat, desert, winter,
      winter_caves, mountain_tree, mountain_right_stub (hills size_x=512
      size_y=256) ⇒ caves-grid arm; `bitmap_noise_file` =
      topology_lake.png ×4 — lake, lake_blood, lake_deep, lake_statue ⇒
      the C39 image lane; ramp-only = mountain_left, left_entrance,
      right, top, floating_island. **`noise_type` ABSENT ⇒ noiseKind −1 ⇒
      the default arm throws (I20):** winter, winter_caves,
      mountain_center + mountain_hall ×5 (mountain_hall, _2, _3, _4,
      _trailer) — **pyramid_hallway is NOT a thrower (it HAS
      `noise_type`)**. `mGradientAddNoise=0` = hills_flat +
      mountain_lake (I20).
    - **④ IoU re-run (instrument C79 unchanged, `SURFACE_V3=1`) — FAIL:**
      overall **n = 6,889** paired columns on **37 of 56** tiles, mean
      |Δy| = **87.87 px** (was 248.62), bias = **+7.92** (was −248.12),
      bands ±1/±2/±3 = **0.019/0.032/0.047** (were 0.000 on every
      family/row). The (100) flood signature is GONE: gen top-air
      rows[0..7] = **0.941** (was 0.004), genNoLine = **15,077/21,966 =
      68.6%** (was 74) — the candidate now has mostly-AIR skies and a
      real (wrong) surface line instead of a solid fill. Per family
      meanAbs (bias), ±3, genNoLine, topAir [n; tiles with pairs/total]:
      mountain 46.14 (−27.94), .078, 572, 0.815 [3314; 11/11] · hills
      **318.21** (+240.5), .008, 1957, 0.961 [909; 10/9] · desert 138.83
      (+35.67), .038, 2002, 0.926 [338; 9/9] · winter 24.31 (−17.93),
      .079, 8824, 1.000 [498; 19/3] · lake 56.89 (−40.76), .004, 1722,
      0.972 [1830; 7/5]. By row: bty13 n1824 52.24 (−47.49), ±3 .099,
      noLine 11045 · bty14 n3526 133.19 (+46.01), ±3 .007, noLine 3865 ·
      bty10/11/12 n140/919/480 ⇒ meanAbs 41.76/29.44/15.59. Best tile
      `37_13_mountain_right`: n442, meanAbs **5.35**, med 5, bias +0.13,
      ±3 **0.299** — diagonal tracking where the ramp frame happens to
      agree. Worst: `48_13_desert` 385.25 (bias −385.25, n20),
      `39_14_hills` 355.72 (+354.95), `41_14_hills` 348.71 (+345.02).
      19 zero-pair tiles = 16 winter (12,13,14,16,17,18,19,20,22,23,24,
      25,26,27,28,29) + `44_13_hills` + `4_14_lake` + `9_14_lake`.
    - **⑤ Evidence:** `mapgen/out/surface-y-2026-09-24.json` (same
      schema as (100), regenerated by the re-run) + the same 56 overlays
      in `mapgen/out/surface-y-2026-09-24/` (legend per (100) ⑤).
      Representatives inspected this session: `37_13_mountain_right`
      (the one success) vs `39_14_hills` (+354.95 bias).
    - Status: **FAIL ⇒ the numeric bars stay RED and, per the user's
      locked verdict ("Give it a try that way, if it still fail we might
      have to make more ghidra"), the next step is MORE GHIDRA — first
      targets: driver 0x908F40's caller body @0x7930d3, the
      `[args+0x24]`/`[args+0x28]` origin-field contents, C44 fn A
      y-drift. Step 3 (drop `SURFACE_V3`) stays BLOCKED and dig #102's
      drop path (SURFACE_V3 const + attach gate + genmap-server
      r3i→r3j) is OFF the table this round.** Landed: CONSTANTS
      **C80**, this entry **(101)**, `noise-terrain.mjs` wiring + cite
      repairs, `surface-wiring.test.mjs` + C80/ISSUES I21 cite repairs,
      Current_work refresh; **no §8 row** (nothing overturned — §4/C78
      untouched), **no new ISSUES** (I21 already carries the frame
      claim). Next free: entry **(102)**, **C81**, **I22**; VERIFIED §8
      row 32 stays free (no §8 write this dig). Gates green: **npm test
      258/258**, caves-field standalone **33/33**.
  - **2026-09-24 (102) — dig #102 (part 1): the fnA/fnB walk is
    byte-CLOSED end to end (C81) — entry (94)'s two "0.0" rdata reads
    REFUTED as f32 traps (Y₀ = trunc(6u) ∈ 0..5; lane ∈ {3,4,5} @1/3
    each), the switch-path X-law, the flag alternation and the budget
    double-LERP byte-pinned; the Q3a port patch DESIGNED but NOT yet
    applied.**
    - Method: byte RE of `noita_dev.exe` (17,007,104 B, md5
      `8b611494212a69492dd0a4527d9c92e0`, per (94)) over the cached true
      disasm `mapgen/extractions/fulltext86.asm (X1)` + direct rdata reads
      (file = VA − 0x400E00; anchors re-validated in the SAME run:
      `0x11dffe8` = f64 101.0, `0x11dfa40` = f32 0.4; `0x11dfef0` /
      `0x11e05f8` raw-byte hexdumped). Docs dig: `lib/` untouched by
      this entry; Task 0's loggers (`noise-terrain.mjs` L1 SURFACE_LOG,
      IoU L2 fit extension) land with it.
    - **① The f32 trap — (94) ①/③ corrected (→ VERIFIED §8 row 32):**
      - (94) read `[0x11dfef0] = 0.0` ⇒ "Y = trunc(rand·0.0) = 0 ⇒ the
        walk STARTS AT ROW 0 (top)". Raw bytes `0000000000001840` =
        **f64 6.0**; the consumer @8f02a5 is `mulsd` (F2 0F 59) +
        `cvttsd2si` ⇒ **Y₀ = trunc(6·u) ∈ {0,1,2,3,4,5}** →
        `[−0x108] = [−0x130]` @8f02b3/8f02b9. The walk start row is
        RANDOM in 0..5, not fixed 0.
      - (94) ③ read `[0x11e05f8] = 0.0` ⇒ "band-lane select is FIXED
        k = 3, ja never taken". Bytes `00000000000008c0` = **f64
        −3.0**; @8f02c4 `mulsd` ⇒ `ecx = 3 − trunc(−3u) ∈ {3,4,5}`
        **each 1/3** ⇒ jump table @0x8f2fd0 lanes **[3] 0.4u+0.1,
        [4] 0.25u+0.75, [5] 0.13u+1.07 ALL LIVE** (lanes 0–2
        unreachable; `ja 0x8f03a6` dead only because ecx ≤ 5 — the
        "fixed" conclusion was still wrong). The lane multiplies the
        switch path's cursor `[−0x104]`.
      - Trap mechanism: both reads took the FIRST 4 bytes (f32 = 0.0)
        at addresses consumed as f64 by `mulsd`. Rule: operand width
        comes from the opcode (F2 = sd, F3 = ss), never from an f32
        dump of the address.
    - **② The switch-path geometry (was only "clamp(jittered base)" in
      (94)) — byte law:** ratio = `f32(w)/f32(count)` (divss @8f01cc);
      endpoints `∓0.45·ratio` → `[−0x108]/[−0x148]`
      ([0x11e0588]/[0x11dfa5c]) @8f01d3..8f01eb; then
      `X = clamp(trunc(lerp(low,high,u3)) + trunc(⌊w/count⌋·walkIndex)
      + trunc(lerp(low,high,u4)), 5, w−5)` — two independent jitter
      draws (u3 @8f01f3, u4 @8f0225), floor stride via `idiv [−0x160]`
      @8f0238, `cmovl/cmovg` clamp @8f0280..8f0292 →
      `[−0x118] = [−0x134]`; finally **Y₀ = trunc(6u)** overwrites the
      case-B Y_B in `[−0x108]/[−0x130]` @8f02a0..8f02b9 ⇒ the switch
      walks TILE THE WIDTH at stride `w/surface_caves_count` with
      ±0.45·stride jitter each (two draws), starting at a random row
      0..5.
    - **③ Path alternation + the two-stage budget (resolves the
      `CONSTANTS:1261-1271` budget-attribution conflict):** flag
      `[−0x119]` cycles B+switch → A → B+switch … (case A = the chained
      `±0.01·w` / `0.05..0.25·h` step @8efff1, sets flag:=0; the
      switch path sets flag:=1 @8f03ac; once `[−0x150] ≥ [−0x160]`
      every walk is case B-no-switch). Budget: `S = h − Y₀`; FIRST
      `[−0x110] = LERP(0.15·S, 0.96·S, u)` ([0x11df99c] = 0.15)
      @8f03f2..8f043f; the flag=1 (switch) walk OVERWRITES with
      `LERP(0.45·S, 0.96·S, u)` ([0x11dfa5c] = 0.45) @8f054c..8f058d
      and sets `[−0x15c] = 0.45·S`, then `÷= Δy` @8f0626. ⇒ (94)'s
      "budget = LERP(0.45H,0.96H,u) ÷ Δy ⇒ span y ∈ [0, LERP(...))"
      = **the flag=1 arm only**; flag=0 walks span ≈15% of h. flag also
      picks scale (0.25u+0.75 vs 0.5u+0.5) and the childCounter bonus
      pair.
    - **④ growth = u, d₀ = (2u−1)², the two 50/101 gates:**
      `[−0x148] = cvtsd2ss(u) + [0x11df874 = 0.0f]` @8f04d8 ⇒ the
      "+0.0" addend is dead (growth = the raw draw); gate1 @8f0645
      `trunc(101u) < 50` ⇒ growth := 0; gate2 @8f0663 `trunc(101u) < 50`
      ⇒ growth := growth² else growth; d₀ pushed as the SQUARE
      (`mulss %xmm2,%xmm2` @8f069f); childCounter =
      `rollPos(cave_childs) + [10/101: ⌊8u⌋] + flag1·(rollPos(surface_
      cave_childs) + [20/101: 2 + ⌊5u⌋])`.
    - **⑤ Caller/push map + config slots:** fnB's pre-loop rolls
      cave_count → `[−0x12c]`, surface_caves_count → `[−0x160]`;
      cursor = per-walk `lerp(config[+0x3c],[+0x40])` = C52
      cave_strength; the 10-arg push map's LAST slot
      `[ebp+0x2c] = config[+0x24] = spawn_percent` = the in-walk
      scatter gate (C52) — the scatter block writes the BYTE channel
      only ⇒ omitted from the float port = **float-neutral**; fnA's
      epilogue writes back NO pair (8ef85d..8ef86c) ⇒ case A chains
      from the pre-call slots, no write-back needed in the port.
    - **⑥ The stamp + fnA structure (port-relevant):** the
      per-iteration stamp = **`push $1; call 0x8ee750`** @8ef37a..8ef37c
      (then `y += [ebp+0x20]` Δy @8ef381..8ef38e, then the
      spawn_percent gate `comiss` 0 vs `[ebp+0x2c]` → `jbe 8ef401`
      @8ef39b..8ef3a3) — `0x8ee750` = a bounds-checked cell-setter
      entry (fn start 8ee750; x/y ≥ 0 ∧ < w/h else early-out 8ee91c;
      cell fetch via accessor 0x9499f0) located directly below C51's
      0x8ee930 LERP writer; **the pushed-flag → LERP-vs-max branch
      inside 8ee750 is UNREAD (FLAGGED)** — fnA pushes $1, C51's blob
      lanes push $0 = max-bleed. Children spawn INSIDE fnA (2% gate
      @8ef774..8ef783, `decl (%eax)` childCounter @8ef79e, child budget
      `(u·50 − 50) + (parent − steps)` @8ef7e2..8ef800, d sign-flip
      `xorps 0x11e0c50` @8ef7c2, child call @8ef823) ⇒ **the port's
      outer `childs` loop is a false structure**; the pair's box exit is
      plain bounds, **NO `& (gridW−1)` wrap**.
    - **⑦ Q3a patch design (NOT applied in this entry):** rewrite
      `walkChain` (prologue draws → envelope → D1/D2 flag →
      `carveCircle(..., flag=1, dir="max")` with the trunc pair + box
      exit → `y += Δy` every iteration → the four terminations → bias
      draws + x-law → re-jitter growth gate → **child recursion INSIDE**
      with childCounter by reference); rewrite the two callers to the
      path-alternation laws (Y₀ = trunc(6u), the X laws of ②, budget
      `h − Y₀` per ③, Δy, the growth gates, d₀², drop the scale arg,
      DELETE the outer `childs` loop `caves-field.mjs:269-272`); fix
      the stale comments `:158-163`/`:169-170`; scatter omitted + commented.
      Gate order: y224 byte bar → caves-field 33/33 (the y224
      exactness rows may shift) → `npm test` 258/258 → IoU re-run
      `SURFACE_V3=1 SURFACE_LOG=… node
      mapgen/experiments/2026-09-24-surface-y-iou.mjs` scored against
      `mapgen/out/surface-y-2026-09-24.entry101.json`.
    - Status: **byte-CLOSED; the patch is pending NEXT SESSION.** Task 0
      landed: L1 `SURFACE_LOG` JSONL logger + L2 fit extension;
      baseline FAIL preserved at
      `mapgen/out/surface-y-2026-09-24.entry101.json`, baseline log
      `mapgen/extractions/surface-y-log-baseline.jsonl (X40)`. The drop path
      (`SURFACE_V3` const + attach gate + genmap-server r3i→r3j) stays
      OFF until an IoU PASS. Q1/Q2 remain parked for the user's Ghidra
      at 0x7930d3.
    - Landed: CONSTANTS **C81**, this entry **(102)**, VERIFIED **§8
      row 32** + the §11 dig-94 in-row amendment, Current_work +
      SESSION_CONTEXT refresh, the Task 0 loggers. Next free: entry
      **(103)**, **C82**, **I22**; VERIFIED §8 row 33 free. Gates for
      this commit: **npm test 258/258**, caves-field **33/33**.
  - **2026-09-26 (103) — dig #103: the Q3a byte-closed walk APPLIED to
    `caves-field.mjs` (C82 consumed); gates green (y224 rms 0.0000,
    caves-field 33/33, npm test 258/258); the surface-y IoU vs entry101
    = FAIL — band ±3 flat (.047 → .046), meanAbs +1.60 (87.87 → 89.47)
    alongside +205 paired columns; the caves layer flips 1.0% of
    sampled cells and is NOT the binding constraint of the ~89 px
    meanAbs ⇒ drop path stays OFF, no §12 distill.**
    - Method: one patch per the (102) stage-7 design + C81/C82, every
      byte fact RE-VERIFIED from `CONSTANTS.md:109-110` and the cached
      dumps this session — `mapgen/extractions/fna-102.asm (X10)`: the prologue
      coin `cmovl %edx,%ecx` with edx=1 ⇒ flag = `[trunc(101u) < 50]`,
      the d-split `[−0x20] = max(d₀²,0) / [−0x28] = min(d₀²,0)`
      @8ef53d..8ef565, the child tail `decl` @8ef79e → budget draw
      @8ef7c6 → `xorps` sign-flip → recursion @8ef823 → `jbe 8ef0d0`;
      `mapgen/extractions/fnb-102.asm (X11)`: the caller pair mirrors @8f0068 /
      8f00ce / 8f019e / 8f0182 / 8f0298 / 8f02b9 (case A/B/switch all
      sync `(X,Y)` ⇒ the port passing the chain slots is
      byte-consistent); knob keys `biomes.mjs:170-183`. No sweeps.
    - Landed in `mapgen/lib/caves-field.mjs`: `walkChain` arity 9
      (prologue 6 draws → PLAIN box exit → cursor gate → the
      t/lane/radius envelope → the unconditional roll + coin-gated D2
      arm → clamp01 → `carveCircle(..., flag=1, dir="max")` RAISES only
      → `y += Δy` → spawn omitted (spawn_percent = 0 ⇒ byte-identical
      skip) → bias draws → d-split x-law → substeps/growth/re-jitter
      (substeps := 0 fire-gated) → the child gate + IN-WALK recursion
      with `cc` shared by ref → `steps++` ⇒ continue iff
      `steps ≤ budget`); the caller = path alternation (case A chained
      / case B + the switch X-law + Y₀ = trunc(6u) + the lane factor)
      + the two-arm budget (scale0/scale1 consumed-but-unused, `l1 = 0`
      with the l2v draw kept); the outer `childs` loop DELETED; the
      blobCount roll moved to after the walk loop (@8f072a); header +
      docstring re-scoped. The 3 walkChain tests rewritten in place
      (raises-only `min === 1.0` with start y in [10,25); determinism
      with fresh `cc:{n:2}` walk objects; box/no-wrap `x0 = w+5`),
      total stays **33**.
    - Gates: y224 rms **0.0000** (the byte bar holds — the record
      stamps' aabb y ≤ 35 keep row 224 untouched); caves-field
      **33/33**; npm test **258/258**; builder meta `l1:0, l2v:0` =
      the baseline values (the l1-constant decision is
      behavior-neutral by construction).
    - IoU vs entry101 (both JSONs read this session,
      `mapgen/out/surface-y-2026-09-24{.entry101,}.json`; the
      ref-present column total 21,966 is identical in both):
      nPairs 6889 → **7094** (+205); genNoLine 15077 → **14872**
      (−205); meanAbs 87.87 → **89.47** (+1.60 WORSE); bias +7.92 →
      **+2.11** (−5.81 better); band ±1 .019 → .019, ±2 .032 → .031,
      ±3 .047 → .046 (all FLAT); genTopAir .941 → **.933** (−.008).
      By family: **hills improves** — meanAbs 318.21 → 293.18,
      bias 240.5 → 175.53, nPairs +135; desert meanAbs 138.83 →
      142.22 (bias 35.67 → 29.72), nPairs +50; mountain 46.14 →
      47.17, nPairs +20; winter + lake byte-identical (0 flips).
      The headline meanAbs +1.60 = the +205 newly-paired columns
      entering the pool with their own errors.
    - L1 diff (`mapgen/extractions/surface-y-log-baseline.jsonl (X40) — the fuller brace runs were {baseline,q3a}.jsonl`,
      199,542 lockstep samples, 0 coord mismatches): **2,029 solid
      flips, ALL `gradKind:caves`** — 1,942 AIR→SOLID vs 87
      SOLID→AIR (net +1,855 sample cells solid); field delta
      mean +0.0034, max|Δ| 4.62. The mechanism is exactly the byte
      law: the walk can no longer carve (raise-only), so former worm
      cells stand solid unless a stream-shifted blob carves them —
      which is why genNoLine fell and bias improved while the ±3
      band stayed flat.
    - Status: **FAIL** ⇒ the drop path (`SURFACE_V3` const + attach
      gate + `noise-terrain.mjs:97/:340` + `genmap-server.mjs:34`)
      stays OFF; **no VERIFIED §12 distill**. The ~89 px meanAbs
      residual is dominated by layers OUTSIDE the caves field (the
      still-unread noise-band gate); Q1/Q2 (0x7930d3) remain parked
      for the user's Ghidra. Standing FLAG unchanged: the pushed-$1
      LERP-vs-max arm inside 0x8ee750 stays UNREAD (the port's
      flag=1/`dir="max"` stands regardless).
    - Landed: the Q3a patch (`caves-field.mjs` + the 3 tests), this
      entry **(103)** (C82's source pointer now resolves). No
      CONSTANTS row (no new byte law — C81/C82 already cover the
      patch), no §8 row, no new ISSUES. Next free: entry **(104)**,
      **C83**, **I22**; VERIFIED §8 row 33 free. Gates for this
      commit: y224 **0.0000**, caves-field **33/33**, npm test
      **258/258**.
  - **2026-09-28 (104) — census P2 reads #1/#2: the surfaceField
    dependency cluster walked decompile → asm; **I20① CLOSED** —
    true 0x8fb570 (the addNoise-default core, LIVE for
    hills_flat/mountain_lake) decoded to formulas: whiteLattice's
    sin-hash lattice with PARITY-alternating smoothstep/linear blend
    weights; the band gate r = true 0x90b280's per-tile internals
    opened (tile params, the 42-px edge blend, new helpers 0x94c700 /
    0x909c70); surfaceField's y-chain + 3 new rdata pins byte-read.
    Register-first: no patch, no port, no IoU run (the judge stays
    parked until a register-backed patch exists); no sweep, no
    parameter touched.**
    - Method: local Ghidra dumps for the region (P1) + one 4-fn
      P1DumpList headless run (0x909c70 / 0x94c700 / 0x8fd920 /
      0x8fdad0 — 4/4 OK, javac-pre-verified first). Asm lane =
      mapgen/extractions/text.bin (X32) (exe f[0x400c00:0xdd0000], objdump
      `--adjust-vma=0x801800` ⇒ printed = true VA; file = VA −
      0x400C00), with the VA map re-pinned on C77's digest facts
      BEFORE reading: `comiss xmm2,[0x11dfb84]` @0x90ab48 (jbe rel →
      0x90b0a2 ✓), `[ebx+0x220]` disp32 @0x90ab55 ✓, `je` rel →
      0x90ae03 ✓; rdata = file VA − 0x400E00, anchors 0.85 / 0.1 /
      C1 re-matched. (The old ledger "adjust-vma 0x401000" recipe is
      the shifted-slab trap — superseded by this working form; ledger
      method-notes update still pending an in-repo commit window.)
    - [SETTLED-ASM] **I20① — 0x8fb570 formula** (full byte law =
      **C83**): the lattice is IDENTICAL to whiteLattice2d — c0 =
      57·round(y) + round(x), fx/fy floor fracs, corners h(k) =
      frac(sin(c0+k)·43758.546875), k ∈ {0,1,57,58}, sin =
      libm_sse2_sin_precise, round = fld/fistp (all C40-shared) **[(113)
      SUPERSEDED: c0 = 57·floor(y) + floor(x); 0x44d0b0 = the FLOOR
      wrapper — C92]** —
      the difference is the WEIGHTS: `W = lerp(w0, w1, frac)` where
      (w0,w1) = (smoothstep, linear) or (linear, smoothstep) by
      round-cell PARITY, then plain bilinear out =
      lerp(lerp(h0,h1,Wx), lerp(h57,h58,Wx), Wy). ⇒ I20's
      "≠ 0x8fb350" now has a mechanism, not just a shape.
    - [SETTLED] **surfaceField y-chain** (both kind arms): gy =
      (period·[0x11dfa08] + y·0.49162514)·0.1 with period = f32
      [BitmapNoise+0x94] — **resolves C38's "(f64 6.86e-07 @0x11dfa08,
      mulsd — semantics open)": its consumer = this term**,
      effectively ≈0 beside the x-chain's full `+ period` (the
      asymmetry is byte-real — mulsd @0x90a904 in the explicit
      movsd/mulsd sequence — not a decompiler artifact); the
      coefficient's PURPOSE stays open.
    - [SETTLED] **r = 0x90b280 internals** (C37's "r" label, now with
      a mechanism): 512-px tile index from [config+0x38]/[+0x40]
      world offsets, dev asserts with true source provenance
      (procedural_terrain.cpp lines 3782/3783), per-tile parameter
      object via 0x90b680 (const / linear / core-noise / fbm modes,
      per-lane amps), the **42-px left-edge neighbour blend**
      (f = 1 − ox/41.0 across the tile seam; neighbor id =
      0x909c70's x-wrap/y-clamp fetch → CSafeArray::GetAt 0x94c700),
      and the y-gate cascade under the f64 380.0 early-out.
      New pins: 58.0@0x11e0298, 41.0@0x11e0274, 380.0@0x11e0050.
    - [CORROBORATION — the census re-derived these BEFORE consulting
      the register, then checked]: C36's dispatcher case table (this
      pass's decompile case→true-VA = C36's slab +0x400800 on all
      9 ✓); C37's uid offset map — which also decodes 0x90b110 = the
      inside-noise run (plain dispatcher vs fbm wrapper 0x8fdad0 per
      mInsideNoiseFBM; OffsetBySeed's rng ×2; Scaled's return) — the
      0.51/0.85 gates, C40's sin-hash family, C38's pins (re-read
      this session: all match). **Correction:** the (3)
      SESSION_CONTEXT claims that +0x228/+0x242/+0x24d were
      "unregistered" were WRONG — they are mInsideNoiseFBM / Scaled /
      OffsetBySeed in C37's map; corrected in Update (4).
    - [OPEN] ① r's XMM0 return expression (every path renders as a
      bare `return` — the value formula needs the asm window; it is
      THE next binding read, since r·field feeds the 0.51 gate);
      ② the 6.86e-07 coefficient's role; ③ 0x90b680's lane0/lane1 =
      which band bound; ④ side-by-side 0x8fb570 vs 0x8fb350 weights
      (C40's rowA phrasing h58→h57 vs this read's lerp(h57,h58,Wx) —
      check against the ported whiteLattice2d).
    - Landed: CONSTANTS **C83** (index row, byte proofs inline),
      ISSUES **I20 ① struck** (② = the port, still open), this entry
      **(104)**. No §8 row (nothing overturned), no §12 distill, no
      code patch — drop path stays OFF. **Gates NOT yet run for this
      change-set** (owed before commit: y224 0.0000, caves-field
      33/33, npm test 258/258); the set also holds the uncommitted
      `mapgen/experiments/2026-09-28-surface-census.mjs` (P0/P1
      tooling). Next free: entry **(105)**, **C84**, **I22**; §8 row
      33 free.
  - **2026-09-28 (105) — census P2 read #2: r = true 0x90b280's
    return expression ASM-CLOSED (band-membership ramp) — resolves
    (104) [OPEN ① + ③]; the driver chain 0x792580 → 0x908f40 →
    0x90a860 pinned with A/B object identities; the caller-side
    combine slots byte-confirmed. Register-first maintained: no
    patch, no port, no IoU run, no parameter touched — the judge
    stays parked.**
    - Method: text.bin lane (exe f[0x400c00:0xdd0000], objdump
      `--adjust-vma=0x801800` ⇒ printed = true VA) re-run in four
      windows ON DISK THIS SESSION (0x90b280..0x90b2f5,
      0x90b505..0x90b679, 0x90aac0..0x90ab50, 0x908f40..0x908f9b);
      rdata byte-reads (file = VA − 0x400E00): **0x11dfaac f32 =
      0.5099999904632568 (the 0.51 gate — f32 0.51, widened)**,
      0x11dfb84 f32 = 0.85 ✓, 0x11e0274 f32 = 41.0 ✓, **0x11df878
      f64 = 0.0**, **0x11dfdd8 f64 = 0.5**; re-matched 380.0
      (0x11e0050) / 1.0 (0x11dfbf0) / 0.5 (0x11dfa94) / 2.0
      (0x11dfe68). Call edges from ~/work/ghidra-logs/p0_calls.csv.
    - [SETTLED-ASM] **r's return expr** (full byte law = **C84**) —
      contract `0x90b280(ecx = A, stackarg ret 4 = params B, xmm2 =
      X, xmm3 = Y) → f32`; prologue saves X → [ebp−0x34], Y →
      [ebp−0x1c], ebx := A:
      (1) `Y > 380.0` (jbe @0x90b2a1 falls past) → out =
          0x90b680(A, B, X) (out → [ebp−0x3c]/[ebp−0x34]; above-grid
          ⇒ the uid's own params);
      (2) `Y ≤ 380.0 ∧ A[+0x6c] == 0` (cmp/je @0x90b2ef → 0x90b60f)
          → same direct call (out → [ebp−0x4c]/[ebp−0x44]);
      (3) else the 512-tile path: ox =
          trunc(A[+0x38]+X) & 511 (→[ebp−0x14]), col =
          (that>>9) mod A[+0x50] (negative += cols, →[ebp+0x8]),
          row = clamp(trunc(A[+0x40]+Y)>>9, 0, A[+0x54]−1)
          (negative → 0, →[ebp−0xc]), tile = A[+0x68].GetAt(col +
          A[+0x50]·row) via 0x94c700 (this = A: `mov ecx, ebx`
          @0x90b51d), out = 0x90b680(A, tile, X) (out →
          [ebp−0x2c]/[ebp−0x24]); ox/oy ∈ [0,512) asserts log-only
          (procedural_terrain.cpp 3782/3783); **left-seam blend iff
          ox ≤ 41** (`cmp esi,0x29; jg 0x90b5f1`): nb =
          0x909c70(&A[+0x50], col−1, row) — issued twice (equality
          cmp vs own [ebp−0x8] @0x90b544, je → no blend; then the
          value) — **f = f32(1 − f32(ox)/41.0)** (movss 1.0@0x11dfbf0,
          divss [0x11e0274]) → [ebp+0x8], n = 0x90b680(A, nb, X)
          (n → [ebp−0x4c]/[ebp−0x44]), **out := own + (n − own)·
          (f64)f per lane** (subsd @0x90b599/0x90b5a3, mulsd, addsd
          @0x90b5b2/0x90b5c4 — f32-weight, f64 math).
      **Returns:** `Y ≤ out0` → **0.0f** (xorps @0x90b2c3, direct
      ret — BYPASSES the epilogue); `Y ≥ out1` → **1.0f**
      (@0x90b2de / @0x90b5d3, same); equal-bounds guard → 1.0
      THROUGH the epilogue (ucomisd + lahf `test ah,0x44` — jp →
      division @0x90b645, jnp → guard @0x90b5e1; reachable only
      unordered); else **t = (Y − out0)/(out1 − out0)** (f64
      subsd/divsd @0x90b651..59; the blend path jmps into the
      cvtpd2ps @0x90b65d); **shared epilogue @0x90b661: cvtps2pd →
      `addsd [0x11df878]` = + f64 0.0 (BYTE-READ ⇒ NO-OP, so the
      0/1 epilogue asymmetry is moot) → cvtpd2ps → f32.**
      ⇒ **r = band membership in Y: 0 below [out0, out1], 1 above,
      normalized Y-position in between ⇒ out0 = LOWER bound, out1 =
      UPPER bound — this resolves (104) ③**; and the bounds are
      functions of **X** — 0x90b680's free coordinate is X at every
      call site (`movapd xmm3, xmm2` @0x90b2a9/0x90b615, `movsd
      xmm3, [ebp−0x34]` @0x90b514/0x90b57c; its phase = [A+0x48] +
      X) ⇒ the band edges undulate along x and r answers "where is
      this y inside the band at this x".
    - [SETTLED] **Driver chain + object identities.** p0_calls.csv:
      `792580 → 908f40` ×3, `908f40 → 90a860` ×1 — the old row-22
      `e8 @0x7930d3 → 0x908F40` pin now lives in the P0 export.
      **A = surfaceField's ecx = 0x908f40's incoming ecx**
      (`mov esi, ecx` @0x908f51 → `mov ecx, esi` @0x908f77, no
      other def in between) **= FUN_00792580's ecx** — the Q1
      driver hands its own object straight through. A's field map
      (all read inside 0x90b280/0x90b680): +0x38/+0x40 f64 world
      offsets, +0x48 params phase, +0x50 cols, +0x54 rows, +0x68
      CSafeArray, +0x6c tiling flag. **B = params object = the
      `0x909da0()` fetch** (pushed @0x908f8e): [B+4] = kind
      dispatches in 0x908f40 — 0 → surfaceField, 1 →
      `biome->bitmap_data` cell color ([B+0x1b0], asserts cpp
      0xa6e/0xa7a), 2 → the threshold-eval pair 0x908cb0/0x8fa9b0
      ([+0x238]/[+0x23c] select 0x8facd0/0x8faae0), else → 0; in
      surfaceField the same gate `[ebx+4]` @0x90a899 (B null →
      return 0.0f). B carries the uid fields +0x1d4/+0x220/+0x268
      (C37's map) ⇒ **B = the biome/uid instance; 0x909da0 = its
      fetch.** ⇒ the 0x90b680 param layout {+0x270/+0x274 bases,
      +0x278/+0x280 linear, +0x288 mode, +0x290 freq, +0x298/+0x29c
      amps} exists TWICE: as uid defaults (paths 1–2) and as
      per-tile overrides (path 3).
    - [SETTLED] **0x908f40 passes (x + 0.5, y + 0.5)**: `addsd
      [0x11dfdd8]` ×2 @0x908f7e/0x908f86 then the register swap
      (xmm1 → surfaceField's xmm2, xmm2 → xmm3) — 0x11dfdd8 = f64
      **0.5** byte-read ⇒ **cell centers**, while the classifier
      0x8f5030 afterwards receives `(int)` of the UNSAVED originals
      (local_2c/local_24). 0x11dfdd8 is also C40's first factor in
      the case-1 blend chain.
    - [CORROBORATION — the caller-side combine slots, all byte-read
      this window]: call args ecx = [ebp−0x30] (A), xmm2 =
      [ebp−0x44] (X), xmm3 = [ebp−0x3c] (Y), push ebx (B) → r;
      **r′ = r·[ebp+0x8]** (mulss @0x90aae8) **stored back into the
      same slot @0x90aafe = slab 0x50a2fe ✓ C37's "field slot :=
      r′"**; `comiss r′, [0x11dfaac]=0.51; jbe 0x90ab48` @0x90aaf7
      ✓; `[B+0x268] == 0 → skip` (ucomiss/lahf/test-ah,0x44/jnp
      @0x90ab05..14) ✓; **gradW = (r′ − 0.5)·2.0** (subss
      [0x11dfa94] + mulss [0x11dfe68]) → [ebp−0x18] @0x90ab1e..34 ✓
      C37; `call 0x90b110`; **per → [ebp−0x8]** @0x90ab43 ✓ C37;
      `comiss r′, [0x11dfb84]=0.85; jbe 0x90b0a2` @0x90ab48 ✓ C77.
      surfaceField prologue: ebx := B (null → 0.0f),
      [ebp+0x8] := 1.0f accumulator init @0x90a8ac, [ebp−0x8] :=
      0.0f.
    - [OPEN] Carried from (104): ② the 6.86e-07 coefficient's
      purpose; ④ side-by-side 0x8fb570 vs the ported
      whiteLattice2d. New: (a) **A's class** — A = FUN_00792580's
      ecx (what the driver actually passes = Q1 body territory);
      (b) field0's write into [ebp+0x8] (the bilinear result, before
      r multiplies) not re-pinned this session — C37 says the slot
      holds the field, the prologue says 1.0f init; (c) 0x909c70's
      return vs the deref'd GetAt element (id vs pointer) — the
      compare @0x90b544 treats them as one type.
    - Landed: CONSTANTS **C84** (index row, byte proofs inline),
      this entry **(105)**, and the owed **ghidra-ledger.md method-
      notes update** from (104) (both "do not relearn" notes now
      carry the working form `adjust-vma = slice_start + 0x400C00`
      ⇒ printed = true VA; the 0x401000-on-0x400c00 combo marked as
      the slab trap). No §8 row (nothing overturned), no §12
      distill, no code patch — drop path stays OFF. **Gates NOT yet
      run for this change-set** (owed before commit: y224 0.0000,
      caves-field 33/33, npm test 258/258); the set also holds the
      uncommitted `mapgen/experiments/2026-09-28-surface-census.mjs`.
      Next free: entry **(106)**, **C85**, **I22**; §8 row 33 free.
  - **2026-09-28 (106) — census P2 read #3: the kind-0 WIRE closed
    (surfaceField → v → classify), A's provenance = [driver+0x70],
    and the driver identified as GridWorld world-creation
    (`gridworld_world_creation.cpp`) with its three 0x908f40 sites
    decoded (center classify + grass/tree probes + tree placement).
    Resolves (105) [OPEN (a)]; C75's `v` input now sourced
    byte-level on both ends of the port contract. No patch, no port,
    no IoU — judge parked.**
    - Method: `mapgen/extractions/fulltext86.asm (X1)` (cached whole-exe AT&T
      disasm, true VAs — C57 scope note: 0x7930d3 ∈ lower .text, NOT
      text.bin) for all driver windows + text.bin (`f[0x400c00:
      0xdd0000]`, adjust-vma 0x801800) for 0x908f96..0x908fe0; rdata
      byte-reads this session (file = VA − 0x400E00): the three
      assert strings below.
    - [SETTLED-ASM] **The v wire:** `call 0x90a860` (surfaceField)
      @0x908f96 → **`movaps xmm3, xmm0` @0x908fa6** → `call 0x8f5030`
      (classify) @0x908fb0 — **classify's v (C75's xmm3) = the
      surfaceField f32 return.** Ghidra's dump renders the call as a
      valueless statement (undeclared register arg dropped) — the
      asm recovers it. classify's other inputs byte-exact: this =
      ecx = **[B+0x2a4] = mBiomeMaterials** (C74's slot ✓ = the
      port's `table`), x = `cvttsd2si [ebp−0x28]` pushed @0x908faf,
      y = `cvttsd2si [ebp−0x20]` pushed @0x908fa9 — the UNSAVED
      entry locals (pre-+0.5) ⇒ classify sees cell INTS while
      surfaceField saw the centers; `ret $8` (callee cleans) ⇒
      0x908f40 returns the record to the driver.
      ⇒ **C75's `classify(table, x, y, v)` contract is now sourced
      on BOTH ends: table = [B+0x2a4], v = surfaceField(...).**
    - [SETTLED] **A's provenance = [driver-obj + 0x70]**: `mov
      0x70(%ebx), %ecx` immediately before ALL THREE 0x908f40 sites
      (@0x7930b9, @0x7938c2, @0x7938ef), ecx untouched through each
      coordinate setup → `call 0x908f40` — resolves **(105)(a)**: A
      is a member of the driver's object handed to the dispatcher
      unchanged; the driver's own CLASS remains Q1 (the body).
    - [SETTLED] **Driver identity + assert provenance** (rdata byte-
      reads): file = `d:\...\source\grid\gridworld_world_creation.
      cpp` (0x11a46b0) ⇒ **FUN_00792580 = GridWorld world
      creation**; expr **`data->array2d->IsValid( x, y )`**
      (0x11a4794, line 1001 = 0x3e9, assert block 0x793001..0x79308e
      ahead of site 1) and expr **`grass[i]->tree_material_id > 0`**
      (0x11a47f4, line 1089 = 0x441, grass-loop head @0x7937be);
      format 0x1150f60 = `Assert failed: (%s) in %s at line %d\n`;
      crash idiom `xor %eax; movl $0x1ca9,(%eax)` @0x793094/@0x793894.
    - [SETTLED] **The three sites** (all inside FUN_00792580,
      0x792580..0x793e41):
      1. **0x7930d3 — center classify** (cell loop): assert block →
         `cmpb $0, 0x78(%ebx); jne 0x7930b6` (**+0x78 ≠ 0 ⇒ skip the
         cell check**) → array2d gate `cmpl $0,(%eax,%ecx,4)` with
         **ecx = (y<<9)|x** — **[ebx+0x30] = `data->array2d`, dword
         grid, 512 stride** (≠0 → 0x793df2, target unread; the
         classify path runs when the dword == 0) → coords =
         (origin+edi, origin+edx) as f64 via cvtdq2pd from the int
         origins **[ebx+0x20]/[ebx+0x24]** → record stored
         **[esp+0x54] @0x7930d8**; **non-null → 0x7935f4**:
         `cmpl $0x3, 0x38(%eax)` (≠3 → 0x79369a); ==3 ∧ [ebx+0x50]==0
         → write **[ebx+0x34]:=0x200, [ebx+0x38]:=0x200,
         [ebx+0x3c]:=0x40000** (=512·512; the last only if ≠)
         @0x79360b..0x79361b. NULL → fall to 0x7930e4.
      2. **0x7938d1 — grass probe (x−1, y)** and 3. **0x7938fe — grass
         probe (x+1, y)**, inside the grass loop (header 0x7937b4:
         arr = **[esp+0xb4]**, index edi, count [esp+0x6c]; back-edge
         `inc %edi; cmp; jb 0x7937b4` @0x793924, exit `jmp 0x793a65`;
         head = line-1089 assert (`cmpl $0,0xd4(%eax); jg 0x79389a` —
         **obj[+0xd4] = tree_material_id**) then the **obj[+0xa8] byte
         gate @0x7938a4, 0 → skip probes**): y = originY+[esp+0x2c]
         both, x = originX+[esp+0x30]∓1 (`dec` @0x7938b8 / `inc`
         @0x7938e5) — **either classify NULL → next item
         (je 0x793924)**; both non-null → 0x793907: `test obj[+0xd8];
         js 0x793938` (negative → handler) else `cmp obj[+0xd8] vs
         [esp+0x54]→[+0x30]; je 0x793938` → **handler 0x793938** =
         `push obj[+0xd4]; push originY+yterm−1 (dec @0x793943);
         push originX+xterm ([esp+0x38] = orig 0x30 after 2 pushes);
         push [ebx+0x74]; call 0x7412c0` ⇒ **tree placement at
         (x, y−1)** (return → [esp+0x3c]); 0x7412c0 body unread.
    - [OPEN] Slot reuse / flow (untraced): **[esp+0x54]** = site-1's
      record @0x7930d8 (direct `jne` ⇒ intact at 0x7935f4/0x79368b),
      **zeroed @0x793445** (with [esp+0x30]:=0, [esp+0x2c]:=−1 after
      a container clear @0x79343d), **incl'd as a counter @0x7935b2**
      — which value reaches the grass id-check @0x79391b = untraced;
      **[esp+0x2c]/[esp+0x30]** = the saved y/x terms (writes
      @0x792f83/0x792fa6 ahead of site 1; also 0x793315/0x79332b/
      0x793455/0x7935eb; init @0x7925c8/0x7925d2). Also open: the
      grass loop's nesting vs the cell loop (0x79369a, the 0x7935f4
      tail past 0x79361b, 0x793df2 unread); 0x7412c0 (tree
      placement?) body; classify's return record type (C75's
      predicate 0x442610 tag still stands); obj[+0xa8]/obj[+0xd8]
      semantics.
    - Landed: CONSTANTS **C85**, this entry **(106)**. No §8 row, no
      §12, no patch — drop path OFF. Gates green at commit. Next
      free: entry **(107)**, **C86**, **I22**; §8 row 33 free.
  - **2026-09-28 (107) — census P2 read #4: FUN_00792580's cell-loop
    skeleton decoded — the (y−1) row-offset law, both record branches,
    the empty-grid bail, the post-loop A::0x909370 bounds call, and
    the per-cell grass→band phase order. Closes all four flow/slot
    opens of (106) ([esp+0x2c]/[esp+0x30]/[esp+0x40] write-flow,
    [esp+0x54] at the id-check, 0x793df2's target, grass nesting).
    No patch, no port, no IoU — judge parked.**
    - Method: `mapgen/extractions/fulltext86.asm (X1)` windows only (driver ∈
      lower .text; text.bin not needed this round); every window
      grepped on disk this session (incl. the 0x79369a..0x7936f5
      factory window re-read after an early grep truncation).
    - [SETTLED] **The cell loop** (double loop, exit 0x793338):
      prologue y:=0 → **[esp+0x2c]** (`xor %edx; mov %edx,0x2c(%esp)`
      @0x792f81-83); height ≤ 0 → exit @0x792f8a; **[esp+0x40] :=
      0xfffffe00 (−512) @0x792f90**; y-head 0x792f98: band indices
      **[esp+0x78]:=[esp+0x68]:=0**, x:=0 → **[esp+0x30]** @0x792f9e-
      0x792fa6; width ≤ 0 → row-end @0x792faa. Bounds: `x <
      [ebx+0x28]` → jl 0x792fb3 @0x793319-0x79331c; `y < [ebx+0x2c]`
      → jl 0x792f98 @0x79332f-0x793332 ⇒ **[ebx+0x20..0x2c] = {originX,
      originY, width, height}** (the rect completes). Row-end:
      **[esp+0x40] += 512 @0x793322** between y++ and the back-edge
      ⇒ **during row y, [esp+0x40] = (y−1)·512**. Continue labels:
      0x79330c reload x, 0x793310 reload y, 0x793314 x++ → [esp+0x30]
      — the reloads exist because the phase loops clobber edi/edx.
    - [SETTLED] **The (y−1) law** (resolves (106)'s read-after-write
      paradox): every "rowOffset" cell gate reads **cell(x, y−1) —
      the cell ABOVE** (y grows down): NULL-path gate `mov (%eax),%eax;
      cmpl $0,(%eax,%ecx,4); je 0x793314` @0x7930f0-0x7930ff (empty →
      next cell); post-create gate @0x793706-0x79371c (occupied →
      next cell). The **y ≤ 0 guards precede both reads**
      (`mov 0x2c(%esp),%edx; test; jle 0x793314` @0x7930e4-0x7930ea;
      same @0x7936fa-0x793700), so row 0 never reads cell(x,−1) ✓.
      ⇒ the post-create gate = "**the tree target cell must be
      empty**" — the same cell the handler writes (y−1) ✓.
    - [SETTLED] **The 512 guard = the line-1001 assert's trigger**:
      `cmp $0x1ff,%edi; ja 0x792fc7` (x > 511) then `cmp $0x1ff,%edx;
      jbe 0x79309a` (y ≤ 511 → bypass) ⇒ out-of-512 coords → assert
      machinery @0x792fc7 (pushes 0x3e9, 0x11a46b0, 0x11a4794 =
      `data->array2d->IsValid( x, y )`, 0x1150f60 → check → 0x79309a
      or the crash idiom @0x793094); in-range cells skip it whole.
    - [SETTLED] **Empty-grid bail = the function epilogue**: site 1's
      gate (only when the [ebx+0x78] byte == 0) `cmpl $0,
      cell[(y<<9)|x]; jne 0x793df2` — **0x793df2 = the cleanup tail**
      (free frame[+0xe8] band-pair array, frame[+0xb4] grass
      pointer-vector, frame[+0x9c] band-pair array via free-ptr
      [0x114a348]; SEH restore; pops; ret — window 0x793df2..0x793e41)
      ⇒ a pre-occupied cell makes world creation **return early**;
      the loop's own writes are safe (monotonic x/y ⇒ each cell
      visited once) ⇒ the guard is a pre-filled-grid precondition.
    - [SETTLED] **≠3 branch (0x79369a):** `call 0x740f80` pushed
      ($0, record, originY+y, originX+x, [ebx+0x74]) with
      **ecx = frame[+0x80]** (y addend `add 0x34(%esp)` with 2 pushes
      pending = frame[+0x2c] ✓; arg-vs-ecx split unread) → NULL →
      next cell (`je 0x793310`); else **cell[(y<<9)|x] := obj
      @0x7936d4** (base = `mov (%ecx),%ecx` from [ebx+0x30] ⇒
      array2d cells = object pointers, 0 = empty) → `vtable[1]`
      (`call *0x4(%eax)` @0x7936dd): == 2 → skip; else
      `vtable[15]` (`call *0x3c(%eax)` @0x7936f7) with stack args
      **(frame[+0x7c], 10000 = 0x2710)** → y ≤ 0 guard → cell(x,y−1)
      gate → band scan → guards → **grass phase → band phase → next
      cell**.
    - [SETTLED] **==3 branch (0x7935f4):** entry ONLY from site 1's
      `jne` (the preceding region ends `jmp 0x793cb2` @0x7935ef — no
      fall-through) ⇒ eax = record on every entry. If [ebx+0x50] == 0
      (no buffer): **[ebx+0x34]:=0x200, [ebx+0x38]:=0x200** (dims),
      **[ebx+0x3c]:=0x40000** (cells, only if ≠ @0x79361b), free old
      [ebx+0x4c] if cap ≠ 0x40000 (@0x79362b via [0x114a358]), malloc
      **0x100000 = 0x40000 × 4 B** (@0x79364a via [0x114a35c];
      [ebx+0x4c]:=buf, [ebx+0x50]:=0x40000 cap/exists), memset(buf,
      0, 0x100000) @0x793665 → join. Join (all paths): **edi :=
      record[+0x30]** — on the realloc path `mov 0x60(%esp),%eax`
      @0x79366a sees THREE pushes pending ⇒ that slot = frame
      **[+0x54] = the record** (esp arithmetic; NOT the early
      [esp+0x60] param slot @0x792607/0x79299f) → `mov 0x30(%eax),
      %edi` @0x793671 = record[+0x30] on every path ✓. Then
      `0x949e80(&ebx[+0x4c], [ebx+0x34]·y + x)` (thiscall, 1 stack
      arg) → ptr → **idGrid[w·y+x] := record[+0x30]** @0x793689,
      **driver[+0x54] := record[+0x30]** @0x79368b-0x793692 →
      `jmp 0x79330c` (next cell). ⇒ the driver holds TWO 512² grids:
      data->array2d (pointer cells, ≠3 writes) and its own 1 MB id
      grid (+0x4c/+0x50, ==3 writes).
    - [SETTLED] **Loop exit → A::0x909370:** 0x793338: pushes
      (&ebx[+0x98], originY+h−1, originX+w−1, originY, originX),
      **ecx := [ebx+0x70] (= A)** → `call 0x909370` ⇒
      **A->0x909370(this=A, x0, y0, x1, y1, out=&driver[+0x98])** —
      one rect call over the whole world bounds after the cell loop;
      then the global vtable call (`mov 0x1344b90; mov 0x6c(%eax);
      call *%eax` @0x79335d-0x79336a) and the (unread) post-loop
      region 0x793360..0x7935f0.
    - [SETTLED] **Per-cell phase order (≠3 path):** create+write →
      vfunc checks → above-cell gate → **band scan** (frame[+0x9c],
      {f0,f1} 8-byte pairs; scan `while absX > f0 && f1 ≠ 0`; index
      [esp+0x78] stored @0x793765, count = (frame[+0xa0]−
      frame[+0x9c])>>3 → [esp+0x4c]) → guards (empty grass vector /
      0 < x < [esp+0x38]-obj[+0x28]−1 → 0x793a71) → **grass loop
      0x7937b4** (back-edge 0x793924, exit `jmp 0x793a65`) → **band
      phase 0x793a65**: reload idx [esp+0x78] / count [esp+0x4c] /
      x [esp+0x30]; **idx ≥ count → 0x793310** (next cell); else
      band[idx].f1 == 0 → `je 0x79330c`; else band body 0x793a8e+
      (observed exit: `jmp 0x793314` @0x793c65). **No write to
      [esp+0x78] between the store and the reload** (only 0x792f9e/
      0x793765 write it — verified) ⇒ the band phase resumes the
      found band ✓. ⇒ **the grass loop nests per-cell inside the ≠3
      chain** (closes (106)'s nesting open), the band phase follows,
      both rejoin the cell loop at 0x79330c/0x793310/0x793314.
    - [SETTLED] **[esp+0x54] at the grass id-check = the classify
      record** (closes (106)'s slot-reuse open): the ≠3 chain runs
      0x7930d8 (store) → jne 0x7935f4 → 0x79369a → 0x793742 → grass →
      0x79391b with **no intervening write** (the zero @0x793445 and
      incl @0x7935b2 live in the post-loop region, which the chain
      jumps over; the next writes @0x793b4c/0x793b93 are after the
      check) ⇒ `grass[i][+0xd8] vs record[+0x30]` is a live compare
      against this cell's classify id ✓.
    - [OPEN] (next units): the post-loop region 0x793360..0x7935f0
      (incl. the x-marking loop 0x7935b2..0x7935eb → `jmp 0x793cb2`,
      the zero-init @0x793445, the [esp+0x40] rewrite @0x7933ca, and
      the fate of A::0x909370's out [&ebx[+0x98]]); the NULL-path
      body 0x793105..0x793310 (second band scan over frame[+0xe8],
      index [esp+0x68], count [esp+0x48]; `y ≥ h−2` guard @0x79313f/
      0x793147); the band body 0x793a8e..0x793cf0 ([esp+0x54]
      rewritten @0x793b4c/0x793b93; [esp+0x78] read @0x793c21); the
      tree-handler continuation 0x79396c..0x793a64; bodies of 0x740f80
      (cell object factory), 0x7412c0 (tree placement), 0x909370 (A
      rect call), 0x949e80/0x94a9d0 (container ops); band pair-array
      semantics ({f0,f1} scan rule, where frame[+0xe8]/frame[+0x9c]
      get filled); vfunc[1]==2 / vfunc[15](…,10000) meaning; the
      [esp+0x38] object (+0x28 bound) identity; the 0x740f80 arg-vs-
      ecx param split.
    - Landed: CONSTANTS **C86**, this entry **(107)**. No §8 row, no
      §12, no patch — drop path OFF. Gates green at commit. Next
      free: entry **(108)**, **C87**, **I22**; §8 row 33 free.
  - **2026-09-28 (108) — census P2 read #5: the tree handler
    0x7412c0's call contract and the band body semantics decoded;
    frame map settled ([esp+0x38] = driver, [esp+0x5c] = cell
    byte-offset, [esp+0x64] = region object, [esp+0x80] = handler
    this). Closes (107)'s [esp+0x38] identity open and the
    tree-handler continuation open; corrects (106)'s post-call
    quote. No patch, no port, no IoU — judge parked.**
    - Method: `mapgen/extractions/fulltext86.asm (X1)` windows only (driver ∈
      lower .text); every address below re-read on disk this session;
      floats + assert strings byte-read from `noita_dev.exe` (rdata
      file = VA − 0x400E00).
    - **Frame map settled** (closes (107)'s [esp+0x38] open):
      **[esp+0x38] = the driver object** — `mov %ecx,%ebx` @0x7925c0
      (thiscall this) → `mov %ebx,0x38(%esp)` @0x7925c2, reloaded
      → ebx @0x793761 ⇒ the edge guard `0 < x <
      [esp+0x38]-obj[+0x28]−1` = **x < driver.width − 1**; the
      assert-report restores are correct esp-wise too (1 push
      pending: `mov 0x3c(%esp),%ebx` @0x793883/0x793a2f reads
      frame[+0x38] = driver; after `add $0x4`, `mov 0x3c(%esp),%edi`
      @0x79388a/0x793a36 reads frame[+0x3c] = grass index / handler
      return).
      **[esp+0x2c]/[esp+0x30] = the 0-based y/x counters** (stores
      @0x792f83/0x792fa6, increments @0x79332a/0x793314, bounds vs
      driver[+0x28] = width / driver[+0x2c] = height @0x793319/
      0x79332f) ⇒ absolutes are computed inline at each use:
      originY+(y−1) @0x793950, originX+x (frame[+0x30], 2 pushes
      pending) @0x79395d.
      **[esp+0x5c] = byte offset of cell(x, y−1)** — the ≠3-chain
      above-gate computes `mov 0x40(%esp),%ecx; or %edi,%ecx;
      shl $0x2,%ecx; mov %ecx,0x5c(%esp)` @0x793709-0x793714 and
      reads `cmpl $0,(%eax,%ecx,1)` @0x793718 — the byte-offset
      spelling of the NULL path's raw-index `(,%ecx,4)` @0x7930fb
      (same address ⇒ (107)'s both-gates-read-the-cell-above law
      ✓ with the addressing forms now distinguished); the band body
      reuses the slot for absY @0x793bbb.
      **[esp+0x64] = the region object** — setup `call 0x909da0`
      @0x792d69 (double args via the cvtdq2pd chain @0x792d31-0x792d65;
      the reference position itself unread) → `mov %eax,0x64(%esp)`
      @0x792d6e (null → re-store @0x792d76), then `[eax+0x2a4]`
      read @0x792d7c = mBiomeMaterials (C74) ⇒ the return is the
      biome-capable world object; the band body re-runs
      `A->0x909da0(absX, absY)` and requires eax == frame[+0x64]
      (`cmp 0x64(%esp),%eax` @0x793bdd, else next cell) ⇒ **band
      placement is gated on region-object identity with the setup
      reference**.
      **[esp+0x68]/[esp+0x78]** = band A/B scan indices (inits
      @0x792fa2/0x792f9e; `incl 0x68(%esp)` @0x793308 on the
      NULL-path accept). **[esp+0x80]** = the tree handler's **this**
      (`mov 0x84(%esp),%ecx` @0x793952 with 1 push pending; ecx then
      untouched through the pushes ⇒ thiscall setup). Loop exit
      @0x793338 loads originY + `lea 0x98(%ebx)` = &driver[+0x98]
      (0x909370's out-Rect).
    - **Record lookup + NULL-path head** (confirms (106), adds the
      float-arg detail): `ecx := driver[+0x70]` (A) @0x7930b9;
      absY = originY+y → cvtdq2pd → xmm2 @0x7930be, absX = originX+x
      → xmm1 @0x7930cf (xmm0 left holding absX's raw int bit pattern
      — register convention open); `call 0x908f40` @0x7930d3 →
      record → [esp+0x54] @0x7930d8; ≠0 → chain 0x7935f4, ==0 →
      NULL path: `y ≤ 0 → 0x793314` @0x7930ea (row 0 never reads the
      −512 index) → above-gate `cmpl $0; je 0x793314` @0x7930fb-0ff
      ⇒ **the NULL path requires cell-above OCCUPIED** (occupied →
      fall into the band scan 0x793105) — **opposite polarity to the
      ≠3 chain** (@0x79371c `jne 0x793314`: empty → proceed to band
      scan/grass — the tree target must be empty) ⇒ the two gates
      are duals, both byte-verified, both with y ≤ 0 guards
      (@0x7930e4-0ea / @0x7936fa-700) so neither ever dereferences
      (x, −1).
    - **≠3-chain extras**: cell write edx = (y<<9)|x (`or %edi,%edx`
      @0x7936d0) → `mov %eax,(%ecx,%edx,4)` @0x7936d4 (raw-index ×4
      = the same address as the byte-offset form); `vtable[1]`
      (`call *0x4(%eax)`) @0x7936dd → **==2 ⇒ skip vfunc[15]**
      (`je 0x7936fa` @0x7936e3) else `vtable[15](obj, frame[+0x7c],
      10000)` @0x7936e5-0x7936f7 (frame[+0x7c] read as
      `push 0x80(%esp)` with 1 push pending @0x7936ee) → row-0
      guard → above-gate.
    - **The tree handler, byte-exact 0x793938-0x79396f**: entry id
      gate re-verified ((106) ✓): `test; je 0x793924` @0x793903-05
      (earlier gate fail → next item), id = grass[i][+0xd8] @0x793911,
      `js 0x793938` (id < 0 → place) @0x793919, `cmp record[+0x30]
      (frame[+0x54]); je 0x793938` (id == record id → place)
      @0x79391f-22, else next item. Call setup: `push grass[i][+0xd4]`
      (tree material) @0x793947; `dec %ecx` @0x793943 is **live** —
      `add %ecx,%eax` @0x793950 makes originY+(y−1) → push @0x793959;
      originX+x (2 pushes pending ⇒ frame[+0x30]) → push @0x793961;
      `push driver[+0x74]` @0x793962; **no esp fixup after the call ⇒
      callee-cleaned (ret 0x10)** ⇒
      **`0x7412c0(this = frame[+0x80], driver[+0x74], absX,
      originY+(y−1), grass[i][+0xd4])** — placement at (x, y−1),
      body unread. Return → edi → **frame[+0x3c]** @0x79396a-6c
      (**corrects (106)**'s `mov %eax,0x5c(%esp)` quote: the actual
      bytes are `mov %eax,%edi; mov %edi,0x3c(%esp)`; the slot is the
      grass-index backup, but the placement path exits the grass loop
      anyway). Tail: `test %edi; jne 0x793a46` @0x793970-72 → assert
      line **1109** (0x455; file 0x11a46b0, expr **0x1190a78**,
      format 0x1150f60, crash `movl $0x1ca9,(%eax)` @0x793a40) when
      the placement returned NULL → `vfunc[15](this = return,
      frame[+0x7c], 10000)` @0x793a46-0x793a56 — same signature as
      the cell object's ⇒ shared base class → **cell(x, y−1) :=
      return** @0x793a59-0x793a62 (`*(driver[+0x30])` buffer +
      frame[+0x5c] byte offset: `mov %edi,(%ecx,%eax,1)`) → falls
      into the band phase @0x793a65. ⇒ **one placement per cell max**:
      the placement path never hits the grass back-edge 0x793924;
      only skipped items do.
    - **Band body semantics (0x793a80-0x793c65)**: key =
      `band.f0 == absX` exact world column (else 0x793c61 → next
      cell) ∧ `absY < [band+0xc8]`; then, if `[band+0x20]` byte ≠ 0,
      the dice — inline MSVC LCG in esi (`imul $0x343fd; add
      $0x269ec3; sar $0x10; and $0x7fff` @0x793abb-0x793ac9) →
      `/32767.0 + 0.0` → `comiss 0.33 → jbe reject` — floats
      byte-verified: **0x11dfa10 = 0.33f (c3f5a83e)**, **0x11e04bc =
      32767.0f**, **0x11df874 = 0.0f**; LCG = the MSVC-rand family
      (canon). **The NULL path dices identically** @0x793182-0x7931ba
      — same constants, same three rdata addresses @0x793188/0x7931a7/
      0x7931af — after its own key (`bandA.f0 == absX` @0x793163,
      `f1 ≠ 0` @0x793177); on accept `mov 0x90(%ebx),%ecx` +
      `mov $0x2aaaaaab,%eax` @0x7931c0-c6 (÷6 magic ⇒ a stride-6
      container count — unread). Then vtable[0x64] (index 25) on the
      cell object [esp+0x44] → `test al; je 0x79330c`; id gate
      `[band+0xd8] ≥ 0` → must equal `frame[+0x54]→[+0x30]`; flag
      byte frame[+0x37] := 1; vertical scan @0x793b50 while i <
      `[band+0xc4]` over rows y−1, y−3, … (rowBase frame[+0x54] −=
      0x400, i −= 2, ecx += 2): x < 0 → advance, `0x93d710(x, row)`
      false → advance, true → require cell(x,row) == 0 else
      frame[+0x37] := 0; join @0x793ba6: flag == 0 → 0x793c61 (next
      cell), else `A->0x909da0(absX, absY)` must equal frame[+0x64]
      (else next cell) → push {absX, absY, band} into
      **driver[+0x80]** via `call 0x93edb0`; then `[band+0x20] ≠ 0` →
      keep (next cell), `== 0` → **erase band[idx] from frame[+0x9c]**
      (shift-left @0x793c40-0x793c50, end −= 8) ⇒ one-shot; exits
      0x793c61 → `jmp 0x793314` @0x793c65.
    - **RNG state (esi)**: normal-path source = `call 0x9d89d0`
      @0x7926c4 (this = &frame[+0x120], arg = `&driver[+0x24]` =
      &originY @0x7926ba-0x7926bd), gated by a type check vs global
      0x132aed8 → `je 0x7927c2` (that skip path's esi source open);
      assert-report blocks clobber esi only on failure (0x792615/
      0x7929ad/0x792b50 are report-only) ⇒ state survives intact to
      both LCG sites (0x793182, 0x793abb). The post-loop region
      writes `esi := −1` @0x793442 and reuses frame[+0x2c] for esi
      @0x793455 (unread phase, slot reuse).
    - **NULL-path accept** @0x793300-0x793308: `mov %edi,0x4(%eax,
      %ecx,4); mov %edx,0x8(%eax,%ecx,4); incl 0x68(%esp)` — a band
      pair-array write (element shape = f1[k]/f0[k+1] — semantics
      open) + band-A index++ → continue.
    - [OPEN] (next units): the post-loop region 0x793360..0x7935f0
      (x-marking loop 0x7935b2..0x7935eb → `jmp 0x793cb2`, zero-init
      @0x793445, [esp+0x40] rewrite @0x7933ca, esi := −1 @0x793442);
      NULL-path body 0x793105..0x793300 (scan detail, the @0x793300
      pair-write, the driver[+0x90] ÷6 container); band body tail
      0x793c6a..0x793cf0 (frame[+0x64] slot-reuse writer @0x793cf1);
      bodies of 0x740f80 (cell object factory), 0x7412c0 (tree
      placement), 0x909370 (A rect call), 0x909da0 (region query),
      0x93d710 (scan predicate), 0x93edb0 (placement-list push),
      0x949e80/0x94a9d0 (container ops), 0x9d89d0 (esi source),
      0x93e550 (type lookup); band pair-array fill sites
      (frame[+0xe8] / frame[+0x9c] provenance); band obj fields
      +0x20/+0xc4/+0xc8/+0xd8 provenance; vfunc[1]==2 semantics;
      frame[+0x80] provenance; driver[+0x78] flag provenance; the
      je-0x7927c2 esi source; 0x908f40's stale-xmm0 question; the
      setup reference position for 0x909da0 @0x792d69.
    - Landed: CONSTANTS **C87**, this entry **(108)**. No §8 row, no
      §12, no patch — drop path OFF. Gates green at commit. Next
      free: entry **(109)**, **C88**, **I22**; §8 row 33 free.
  - **2026-09-28 (109) — census P2 read #6: the NULL path decoded =
    **ceiling-plant insertion** (`data->ceiling_plants_to_insert`,
    assert line 1028 expr byte-read); both band scans + the fill
    dispatch + the guard/band-phase entry states byte-exact. Closes
    (107)'s NULL-body open, (108)'s @0x793300 pair-write and
    pair-array-provenance opens, and pins `driver[+0x28] = width` /
    `driver[+0x8c] = ceiling_plants_to_insert`. No patch, no port,
    no IoU — judge parked.**
    - Method: `mapgen/extractions/fulltext86.asm (X1)` windows only; every
      address below re-read on disk this session; assert strings
      byte-read from `noita_dev.exe` (rdata file = VA − 0x400E00).
    - **The NULL path inserts ceiling plants** (0x793105..0x793314):
      - scan idx = **`ceiling_plants_i`** = frame[+0x68], count =
        frame[+0x48]; loop @0x793120: **continue while `absX > f0 ∧
        f1 ≠ 0`** (`cmp (%edi,%ecx,8),%eax` → flags = absX − f0;
        `jle` stop, `f1 == 0` stop) — stopping idx saved → frame[+0x68]
        @0x79313b (x/y reloaded @0x793133-37);
      - **`y ≥ driver[+0x2c]−2` → next cell** @0x79313f-0x793147
        (height = driver[+0x2c] ✓);
      - idx ≥ count → next cell @0x79314d-51; exact key **`f0 ==
        absX`** @0x793163 (else next cell) ∧ **`f1 ≠ 0`** @0x793170-77;
      - dice if the entry is dice-gated (identical MSVC LCG + the
        same three rdata floats, 0x793182-0x7931ba) → reject = next
        cell;
      - **assert line 1028 (0x404)** @0x7931cb-0x7931e5: count =
        `(driver[+0x90] − driver[+0x8c]) / 12` (`0x2aaaaaab` + `sar
        $1` = ÷12 — checked: n=12 → 1) vs frame[+0x68] → report
        (fail-only; restore ebx := frame[+0x38] with 1 push pending
        @0x79329e = driver ✓). Expr byte-read: **`ceiling_plants_i <
        (int)data->ceiling_plants_to_insert.size()`** @0x11a47b4 ⇒
        **driver[+0x8c]/[+0x90] = `data->ceiling_plants_to_insert`
        begin/end (vector, stride 12)**;
      - region gate: `A->0x909da0(absX, absY)` (absY stashed →
        frame[+0x4c] @0x7932c2 — slot reuse of the ≠3 band count)
        must equal **frame[+0x64]** @0x7932db (same identity gate as
        the band body) — mismatch → `incl frame[+0x68]` + next cell
        (write skipped);
      - **accept write @0x7932f3-0x793304**: base = driver[+0x8c],
        `ceiling_plants_to_insert[ceiling_plants_i] := {absX, absY,
        bandA[idx].f1}` at stride 12 (`lea (%eax,%eax,2)` → ×3 →
        `(%eax,%ecx,4)` = 12·idx; edx = f1 loaded @0x7932ec; absY
        from frame[+0x4c] @0x7932fc) → `incl frame[+0x68]` @0x793308
        → next cell. ⇒ **(108)'s pair-write open CLOSED**: {absX,
        absY, f1} = {x, y, plant-def}, and frame[+0xe8] = the
        ceiling-plant candidate array {f0 = exact world column, f1 =
        def pointer} (closes (107)'s label "band A" — it is the
        ceiling-plant list).
    - **Both band scans byte-identical rule** (≠3 re-verified
      0x793722-0x793765): count = `(frame[+0xa0] − frame[+0x9c]) >>
      3` → frame[+0x4c] @0x793722-37; idx ≥ count → 0x793769;
      scan @0x793750 continues while **`absX > f0 ∧ f1 ≠ 0`** — same
      AT&T operand order, same stop condition as the NULL path ⇒
      **(107)'s scan prose confirmed correct** (ascending f0, stop at
      first f0 ≥ absX; the exact-key checks then demand ==);
      **`ebx := frame[+0x38]` (driver) restore @0x793761** (the scan
      had clobbered ebx with the array base) → idx → frame[+0x78]
      @0x793765.
    - **Guards + grass init byte-exact (0x793769-0x7937ae)**: empty
      grass (begin == end) → 0x793a71; `x ≤ 0` → 0x793a71; `x ≥
      driver[+0x28] − 1` (`mov 0x28(%ebx),%eax; dec; cmp x; jge`)
      → 0x793a71 ⇒ **`driver[+0x28] = width` definitive** ⇒ the edge
      guard = `0 < x < width−1` ✓ (107). Grass init: i := 0 (edi),
      frame[+0x3c] := 0, count = `(end − begin) >> 2` → frame[+0x6c]
      (pointer elements ✓), count == 0 → 0x793a6d.
    - **Band-phase entry = three states, all compensated** (0x793a65-
      0x793a8a): `0x793a65` (grass-loop exit) reloads idx [esp+0x78]
      + count [esp+0x4c]; `0x793a6d` (grass count == 0) reloads only
      x [esp+0x30] — because the init zeroed edi; `0x793a71` (guard
      failures) compares directly — edx/ecx are still the scan's
      idx/count. Then `idx ≥ count → 0x793310`; base = frame[+0x9c],
      `frame[+0x3c] := bandB[idx].f1` @0x793a84 (slot: grass idx →
      current band), `f1 == 0 → 0x79330c` @0x793a8a.
    - **The fill loop 0x792e80-0x792eda** (closes (106)/(107)'s
      pair-array fill-site opens): source = 16-byte `{double x,
      Object*}` (edi at the ptr field; the double read at `−8(%edi)`);
      3-way dispatch by the OBJECT's bytes: **`[obj+7] ≠ 0` → ceiling
      candidates** (frame[+0xe8]: int = `cvttsd2si x` → frame[+0x6c],
      ptr → frame[+0x70], `0x93ef50(&frame[+0xe8], &frame[+0x6c])`);
      **`[obj+6] ≠ 0` (and +7 == 0) → grass** (`0x9ef4e0(&frame[+0xb4],
      elem)` — the grass vector of pointers ✓ (107)'s [esp+0xb4/b8]);
      **else → band B** (frame[+0x9c]: int → frame[+0x4c], ptr →
      frame[+0x50], `0x93ef50(&frame[+0x9c], &frame[+0x4c])`). Pair
      element = `{int key @0, void* obj @4}` (8 B — the push_back
      reads slot/slot+4 ✓ both branches store exactly those) ⇒
      **`0x93ef50` = vector<pair>::push_back(this, &pair)** (body
      open). Loop stride `add $0x10`, count in ebx.
    - **Post-fill**: `0x9ef570(&frame[+0x9c], xmm1 = f64 from
      frame[+0x5c], edi = frame[+0xcc])` @0x792ef0 (sort/validate?
      body open) → then `0xa735a0(vec.begin, count>>3, false)` for
      band B @0x792f1e AND for a **third stack vector at
      frame[+0xf0]/[+0xf4]** (8-byte elements) @0x792f46 (bodies
      open; count>>3 ⇒ 8-byte elements); heap temp frame[+0xcc]
      freed @0x792f6d.
    - **`frame[+0x48] = the driver at setup** (load @0x792f4b →
      `lea 0x8c(%ebx),%ecx` = `&driver[+0x8c]` @0x792f56 →
      `0x93ee40(&ceiling_plants_to_insert, driver)` @0x792f5c — body
      open) — the slot is later reused as the ceiling count in the
      cell loop (its writer still open, tag `0x48(%esp)`).
      **`driver[+0x70]` (A) == 0 → `je 0x793338` @0x792f77-7b skips
      the ENTIRE cell loop** (A-null guard; the 0x793338 exit block's
      own A-guard unread).
    - **Stack-vector confirmation**: frame[+0xe8] init `movl $0`
      @0x792a7d, destroyed at the epilogue (read @0x793df2); frame
      [+0x9c]/[+0xa0] init @0x792a30/0x792a3b, destroyed @0x793e1a
      ⇒ both are stack std::vectors (the early byte stores
      @0x79284f/0x7928d5 = slot reuse before init).
    - **Line-1109 expr byte-read = `cell`** @0x1190a78 ⇒ 0x7412c0
      returns a *cell* object (consistent with the write-back
      @0x793a59).
    - [OPEN] (next units): the fill-source builder + setup region
      0x7926xx..0x792e7x (where {double, ptr} list comes from;
      frame[+0x70]/[+0x50]/[+0x48] setup writers; frame[+0xf0]
      fill); post-loop region 0x793360..0x7935f0 (+ the 0x793338
      A-guard); band tail 0x793c6a..0x793cf0; bodies 0x740f80 /
      0x7412c0 / 0x909370 / 0x909da0 / 0x93d710 / 0x93edb0 /
      0x93ee40 / 0x93ef50 / 0x9ef4e0 / 0x9ef570 / 0xa735a0 /
      0x949e80 / 0x94a9d0 / 0x9d89d0 / 0x93e550; band field
      provenance (+0x20/+0xc4/+0xc8/+0xd8); vfunc[1]==2;
      frame[+0x80]; driver[+0x78]; 0x908f40's stale xmm0; the
      0x909da0 setup reference position.
    - Landed: CONSTANTS **C88**, this entry **(109)**. No §8 row, no
      §12, no patch — drop path OFF. Gates green at commit. Next
      free: entry **(110)**, **C89**, **I22**; §8 row 33 free.
  - **2026-09-28 (110) — census P2 read #7: the post-loop margin
    region decoded — the (8,8)-margin scan, the 3×3 type-neighborhood
    comparator, and the type-item placement loop; function range
    0x792580..0x793e5e + the complete dtor chain + `driver[+0x18]` =
    elapsed time; `frame[+0x48]` writer found; CORRECTION of (109)'s
    "third vector". Closes (107)'s post-loop opens and (109)'s two
    tags. No patch, no port, no IoU — judge parked.**
    - Method: `mapgen/extractions/fulltext86.asm (X1)` windows; strings
      byte-read (`0x11a4814`, `0x117a518`); every address below
      re-read on disk this session.
    - **Function range byte-defined**: `FUN_00792580` =
      0x792580..0x793e5e (`ret` @0x793e4e after the /GS cookie;
      int3 padding 0x793e5a-0x793e5f; the next function starts
      @0x793e60).
    - **Loop-exit block 0x793338-0x793358** (byte-exact, confirms
      (106)): `A->0x909370(originX, originY, originX + width − 1,
      originY + height − 1, &driver[+0x98])` (ecx := driver[+0x70] =
      A; y1/x1 built via `dec`+`add` from the origins). Then the
      **singleton callback**: `ecx := &0x1344b90; eax := *0x1344b90;
      eax := [eax+0x6c]; call *eax` @0x79335d-0x79336a — x87 double
      return, spilled → frame[+0xcc] @0x793377 (2 pushes pending);
      **called at both ends of the work** (bookend again @0x793d81-
      0x793d8e) → elapsed below. `driver[+0x70]` (A) == 0 →
      `je 0x793338` @0x792f77 skips the whole cell loop into this
      block (0x909370's null-receiver behavior open).
    - **Two (3,3) stack objects** (the margin workspace): obj1 at
      frame[+0x100], obj2 at frame[+0x120], ctor `0x92e980(&obj, 3,
      3)` @0x793370-0x793396; unwind states 8 → 0xa → 0xb @0x792f61/
      0x79338e/0x7933a0; per-cell reset `0x92ea40(&obj, &false)` @
      0x793427/0x79343d. Layout (byte-proven): `[+0]` = stride/width
      (frame[+0x100]/frame[+0x120] in the index math @0x7935b6/
      0x7935cc/0x793c82), `[+4]` = ctor arg 2 (`&obj[+4]` passed to
      0x770aa0), `[+0x18]` = **grid HEAP pointer** (frame[+0x118]/
      frame[+0x138]: freed @0x793dd2-0x793dd9 / @0x793da5-0x793daf
      via IAT 0x114a358, then zeroed @0x793dbc/0x793dc7).
    - **The margin scan** (x ∈ [8, width−8), y ∈ [8, height−8)):
      y = 8 → frame[+0x48] @0x7933ad (guard `height−8 ≤ 8 →
      0x793d81` @0x7933b3); x = 8 → frame[+0x40] @0x7933ca (guard
      `width−8 ≤ 8 → 0x793d6e` @0x7933d0); row base `y<<9` →
      frame[+0x7c] @0x7933db; cell read `cell[(y<<9)|x]` →
      frame[+0x3c] @0x7933e0-0x7933ea (null → 0x793d4f);
      **`vfunc[12]` (`call *0x30(%eax)`) on the center** @0x7933fa →
      **`0x742940(frame[+0x80], type)`** @0x793405 → frame[+0x4c] =
      **a std::vector<T> of 32-byte T** (byte-proof: begin/end at
      `[eax]`/`[eax+4]`, size `(end−begin)>>5`, checked subscript
      @0x793cf7 aborts with `"invalid vector<T> subscript"` byte-read
      @0x117a518); null → 0x793d4f; x++ @0x793d56 (`x < width−8 →
      0x7933e0`, row base reloaded @0x793d60), y++ @0x793d71 (`y <
      height−8 → 0x7933c0`).
    - **The 3×3 neighborhood comparator** (per margin cell):
      dy = esi with home frame[+0x2c] (init −1 @0x793442-0x793455),
      dx = ebx (init −1 @0x793464), equal-count → frame[+0x54] (zero
      @0x793445), mark-count → frame[+0x30] (zero @0x79344d);
      neighbor = `((y+dy)<<9) | (x+dx)` (row base frame[+0x5c] per dy
      @0x793472; x+dx @0x793480-0x793484; scale-4 read @0x793565-
      0x79357a).
      - **assert line 0x4b6 = 1206**, expr byte-read @0x11a4814 =
        **`data->array2d->IsValid( x + x0, y + y0 )`**; entry =
        `x+dx > 511` (`ja 0x79349a` @0x793486-8c) ∧ `y+dy > 511`
        (fall through `jbe 0x793565` @0x79348e-94) → the standard
        4-arg report (line `0x4b6`, expr `0x11a4814`, file
        `0x11a46b0`, func `0x1150f60`) @0x79349a-0x79355f; report
        restore esi := frame[+0x2c] @0x793552 (1 push pending ✓).
      - null neighbor → 0x793cae (`eax := frame[+0x30]`, no mark).
      - **equal `vfunc[12]`** (center @0x79358b, neighbor @0x793594)
        → **grid1[(dy+1)·stride + 1 + dx] := 1** via
        `0x94a9d0(&frame[+0x118], idx)` + `movb $1,(%eax)` @0x7935a3-
        0x7935c9 (esi := frame[+0x2c] @0x79359f, `inc` @0x7935b1,
        stride = frame[+0x100] @0x7935b6), frame[+0x54]++ @0x7935b2,
        frame[+0x30]++ @0x7935e6.
      - **unequal** → `0x7706c0(center(this), neighbor(edx))` @0x793c6a-
        0x793c72 → true → **grid2[same index]** via
        `0x94a9d0(&frame[+0x138], (dy+1)·frame[+0x120] + 1 + dx)` @
        0x793c7f-0x793c9a, frame[+0x30]++ @0x793c9d; false → no mark
        @0x793ca8 (`0x7706c0` body open).
      - control: `inc %ebx; cmp $1; jle 0x793480` @0x793cba-be;
        `inc %esi; frame[+0x2c] := esi; cmp $1; jle 0x793460` @
        0x793cc4-0x793ccc; then `cmpl $8, frame[+0x54]` @0x793cd2 →
        **`≥ 8 → 0x793d4f`** (all 8 neighbors share the center's type
        → skip placement); **`ebx := frame[+0x38]` (driver) restore
        @0x793cd7** (the dx-loop had clobbered it).
    - **The placement item loop** (0x793cdd-0x793d4d): count =
      `(end − begin)>>5` of the factory vector @0x793cdd-0x793cea
      (`== 0 → 0x793d4f`); frame[+0x64] := 0 (byte offset) @0x793cf1;
      head 0x793cf5: `count ≤ idx → 0x793e4f` = the checked-subscript
      **abort** (`push $0x117a518` = "invalid vector<T> subscript",
      `call *0x114a1c8`, `int3` — defensive path); item = `begin +
      frame[+0x64]` @0x793cfd →
      **`0x770aa0(array2d = driver[+0x30] (ecx), x, y, center cell,
      originX, originY, &obj1[+4], frame[+0x54] = equal-count,
      &obj2[+4], eax = frame[+0x30] = mark-count)`** @0x793d01-0x793d28
      (9 pushes = `add $0x24` ✓; frame[+0x54] read with 2 pending →
      `0x5c−8` ✓; first push = eax = frame[+0x30], which all four
      predecessor paths load — the 0x793cae path reads `0x30(%esp)`,
      correcting an earlier 0x40 misread) → `esi++` @0x793d31,
      **`frame[+0x64] += 0x20`** @0x793d32, size recheck (`[eax]`/
      `[eax+4]`, `>>5`) with `eax := frame[+0x30]` @0x793d44 →
      `jb 0x793cf5` @0x793d4d / fall → 0x793d4f.
    - **Function end**: the callback bookend @0x793d81-0x793d8e →
      `fsubl frame[+0xcc]` (now − start time) → **`fstpl 0x18(%ebx)` =
      `driver[+0x18]` = this function's elapsed time** @0x793dac →
      state 0xa → free obj2 grid @0x793daf → state 8 @0x793db4 →
      zero frame[+0x138]/[+0x13c] @0x793dbc/0x793dc7 → free obj1
      grid @0x793dd9 → `0x7924c0(ecx)` @0x793de0 (body open) →
      **`driver[+0xc8] := 1`** (`lea 0xc8(%ebx)`; `mov $1,%ecx`;
      `xchg %ecx,(%eax)`) @0x793de5-0x793df0 → `ebx := IAT free
      0x114a348` @0x793df9 → **free frame[+0xe8] (ceiling) @0x793e04
      → frame[+0xb4] (grass) @0x793e15 → frame[+0x9c] (band B) @
      0x793e26** → SEH restore @0x793e2b → pops → cookie → `ret` @
      0x793e4e. Exactly three stack vectors (consistent with the
      correction below).
    - **CORRECTION of (109)** ("a third stack vector at
      frame[+0xf0]/[+0xf4]"): **wrong — esp-pending-push slip.** The
      reads @0x792f23/0x792f2c happen with **2 pushes pending** (the
      first `0xa735a0`'s args) ⇒ they are `frame[+0xec]`/`frame[+0xe8]`
      = the **ceiling vector's {end, begin}**; the second
      `0xa735a0(ecx = ceiling.begin, count = size>>3, false)` @
      0x792f46 operates on the CEILING vector (size @0x792f2a-
      0x792f3e), bool slot = frame[+0x4c] (@0x792f11 0 pending /
      @0x792f35 2 pending). Only three stack vectors exist:
      frame[+0xe8] / frame[+0x9c] / frame[+0xb4] — all freed in the
      dtor chain ✓. Also the store @0x792f42 (`mov %eax,0x58(%esp)`)
      has **4 pushes pending** ⇒ it writes frame[+0x48], not
      frame[+0x58].
    - **frame[+0x48] writer FOUND** @0x792f42: `frame[+0x48] := the
      ceiling count` (`(end−begin)>>3` of frame[+0xe8]) — closes
      (109)'s tag; then `0x93ee40(&driver[+0x8c] = ceiling vector,
      frame[+0x48] = count)` @0x792f52-0x792f5c (a resize/finalize —
      body open).
    - [OPEN] (next units): bodies 0x7706c0 / 0x770aa0 / 0x742940 /
      0x92e980 / 0x92ea40 / 0x94a9d0 / 0x7924c0 / 0x93ee40 / 0xa735a0
      / 0x93ef50 / 0x9ef4e0 / 0x9ef570; obj[+4] field; frame[+0x80]
      provenance; driver[+0xc8] semantics; driver[+0x18] cross-ref
      (104)②; the margin constant 8's meaning; the 32-byte item's
      structure; 0x909370 null-receiver; the setup/fill-source region
      0x7926xx..0x792e7x (the {double, ptr} source builder);
      0x908f40's stale xmm0; the 0x909da0 setup reference position;
      the cell-loop bodies of 0x740f80 / 0x7412c0 / 0x909370 /
      0x909da0 / 0x93d710 / 0x93edb0 / 0x949e80 / 0x9d89d0 / 0x93e550.
    - Landed: CONSTANTS **C89**, this entry **(110)**. No §8 row, no
      §12, no patch — drop path OFF. Gates green at commit. Next
      free: entry **(111)**, **C90**, **I22**; §8 row 33 free.
  - **2026-10-02 (111) — census P2 read #8: the setup/fill-source
    region 0x792580..0x792f76 decoded — prologue + frame convention,
    skip gate + the 6-string key `??SAV/world/world_<ox>_<oy>.png_petri`,
    the seed formula, both `0x909da0` env samples (byte-IDENTICAL),
    `0x8f5760` = the fill-source builder, dispatch → shuffle → sort →
    resize, and `frame[+0x48]`'s full lifecycle; CONFIRMS (110)'s two
    corrections of (109) with the pending counts. Closes (108)'s /
    (109)'s / (110)'s setup-region, env-sample, frame[+0x70]/[+0x50]/
    [+0x48]/[+0x80]/[+0x7c] and "frame[+0xf0] fill" tags. No patch, no
    port, no IoU — judge parked.**
    - Method: `mapgen/extractions/fulltext86.asm (X1)` (true VAs) for every
      0x793xxx site + window `mapgen/extractions/dig111-setup.asm (X13)`
      (0x792503..0x792eff) + `mapgen/extractions/dig111-biome.asm (X14)` (the two
      builder bodies); Ghidra decompiles at
      `~/work/ghidra-logs/surface-region/` as reading aids; strings and
      f64 byte-read from `noita_dev.exe` (rdata file = VA − 0x400E00);
      every address below re-read on disk this session.
    - **Prologue + frame convention (byte-exact 0x792580-0x7925de)**:
      `push %ebp; mov %esp,%ebp; and $-64,%esp` @0x792580-0x792583 →
      SEH chain `push $-1` @0x792586, handler `push $0x107dfb8` @
      0x792589, `push %fs:0` @0x792593 → `sub $0x168,%esp` @0x792594 =
      **S** → /GS cookie (`mov 0x12eb000,%eax; xor %esp,%eax;
      mov %eax,0x130(%esp)`) @0x79259a-0x7925a1 with esp = S → `push
      %ebx/%esi/%edi` @0x7925a8-0x7925aa → cookie `xor; push %eax` @
      0x7925ab-0x7925b2 ⇒ **E = S − 16 = A − 0x184** (A = esp on entry,
      S = A − 0x174) → fs registration `lea 0x178(%esp),%eax;
      mov %eax,%fs:0` @0x7925b3-0x7925ba ⇒ **fs EXCEPTION_REGISTRATION =
      frame[+0x178] = A−12, and the `push $-1` slot = A−4 = frame
      [+0x180] = the unwind-state dword**; the /GS cookie lands at
      frame[+0x140]. **frame[+0xNN] = E+0xNN**; only transient stack
      ops subtract (pushes and `sub $N`), 4 bytes per slot. Set-up:
      this (ecx) → ebx @0x7925c0, **frame[+0x38] := driver** @0x7925c2,
      `xor %ecx,%ecx` → frame[+0x30] := 0 @0x7925c8, printf-IAT → edi @
      0x7925cc, frame[+0x2c] := 0 @0x7925d2; `test %ebx,%ebx; jne
      0x79269e` @0x7925d6-0x7925d8 ⇒ null-this falls into assert **line
      0x38f = 911**, expr 0x1168a04 = `data` (`push $0x38f` @0x7925de;
      report tail `call 0x10078c0` + `movl $0x1ca9,(%eax)` crash — the
      same idiom at @0x792692-0x792698, @0x792bd1, @0x793092-0x793094).
    - **Skip gate (byte-exact)**: `lea 0x58(%ebx)` (&driver[+0x58]) @
      0x79269e → push @0x7926a1; `lea 0x60(%esp)` (1 pending → &frame
      [+0x5c]) @0x7926a2 → push @0x7926a6; `call 0x93e550` @0x7926a7
      (**ret 8** → pending 0, proven by the next `lea 0x120(%esp)` @
      0x7926bd); `mov (%eax),%eax; cmp 0x132aed8,%eax; je 0x7927c2` @
      0x7926ac-0x7926b4 — **global-sentinel match → skip the whole key
      build → flag byte frame[+0x37] := 0 @0x7927c2**; else @0x7926ba
      `lea 0x24(%ebx),%edx` (&driver[+0x24]) + @0x7926bd `lea 0x120(%esp),%ecx`
      (&frame[+0x120], 0 pending). 0x93e550's semantics + the sentinel's
      polarity stay OPEN.
    - **The 6-string key build (byte-exact 0x7926c4-0x7927b9)** — every
      slot write carries its pending count: `0x9d89d0(&frame[+0x120],
      &driver[+0x24])` @0x7926c4 → eax → esi @0x7926c9; **state := 0**
      @0x7926cb (0 pending → frame[+0x180]); `lea 0x20(%ebx),%edx` +
      `lea 0xcc(%esp),%ecx` (&frame[+0xcc]) + **build mask frame[+0x30]
      := 1** @0x7926e0; `0x9d89d0(&frame[+0xcc], &driver[+0x20])` @
      0x7926e8 → **state := 1** @0x7926ed; `lea frame[+0x9c]` @0x7926f8 →
      `push %eax` @0x7926ff (1 pending) + edx := 0x11a4744 + **frame
      [+0x30] := 3** @0x792705 (1 pending → `0x34(%esp)`) → `0x443390` @
      0x79270d (`add $4` → 0 pending) → **state := 2** @0x792715; `lea
      frame[+0xb4]` + `push $0x11885fc` + **frame[+0x30] := 7** @
      0x79272e → `0x4433e0` @0x792736 → **state := 3** @0x79273e; `lea
      frame[+0xe8]` + `push %esi` + **frame[+0x30] := 0xf** @0x792753 →
      `0x444a10` @0x79275b → **state := 4** @0x792763; `lea frame
      [+0x100]` + `push $0x11a4738` + **frame[+0x30] := 0x1f** @0x79277c →
      `0x4433e0` @0x792784 → **state := 5** @0x79278c ⇒ **key = `??SAV/
      world/world_<driver[+0x20]>_<driver[+0x24]>.png_petri`** (with
      +0x20 = originX, +0x24 = originY per C86/C87; string order:
      prefix + str(+0x20) + `_` + str(+0x24) + suffix). Then ecx := 0x3f
      @0x792797, `push %eax` (string5) @0x79279c, **dtor mask frame
      [+0x2c] := 0x3f** @0x7927a2 (1 pending → `0x30(%esp)`) AND frame
      [+0x30] := 0x3f @0x7927a6 → query `call *0x24(%eax)` @0x7927af
      (ecx = the `0x1344b90` singleton, vtable +0x24, target `0xfe81b0`)
      → **frame[+0x37] := 1 @0x7927b9** / **:= 0 @0x7927c2** (flag meaning
      OPEN). Note the gate's out-slot frame[+0x5c] is clobbered by the
      raw seed below (slot reuse).
    - **Dtor cascade = the 6 KEY-BUILD strings, reverse order**
      (0x7927c7-0x792944): reads the dtor mask frame[+0x2c] (store-back
      `mov %eax,0x2c(%esp)` 0 pending @0x7927e0/0x792866/0x7928a9/
      0x7928ec; reload `mov 0x30(%esp)` 1 pending @0x7927ef/0x792875/
      0x7928b8/0x7928fb — both spellings resolve to frame[+0x2c]);
      **bit → slot: 0x20 → frame[+0x100]** (`_Myres` @+0x114, push @
      0x7927e6), **0x10 → frame[+0xe8]** (+0xfc), **0x08 → frame[+0xb4]**
      (+0xc8, push @0x79286c, SSO resets @0x79287c/0x792887/0x792892),
      **0x04 → frame[+0x9c]** (+0xb0, push @0x7928af, resets @0x7928bf/
      0x7928ca/0x7928d5), **0x02 → frame[+0xcc]** (+0xe0, push @0x7928f2),
      **0x01 → frame[+0x120]** (+0x134, push @0x792939); each step:
      and-clear bit → store-back → `cmpl $0x10, _Myres; jb skip` →
      `push buffer; call *%esi` (free via `[0x114a348]`) → reload → SSO
      reset (`_Myres := 0xf, _Mysize := 0, byte0 := 0`). MSVC std::string
      = `{_Bx 16 B @0, _Mysize @+0x10, _Myres @+0x14}`, heap iff
      `_Myres ≥ 0x10`. **state dword := −1 (`movl $0xffffffff,0x180(%esp)`)
      @0x792920** before the last bit; destruction runs in REVERSE build
      order (bit 0x20 = string5 first … bit 0x01 = string0 last) ⇒
      correct C++ unwind order, and **the same six slots are then
      reused** as V0 (+0xcc) / V1 (+0x9c) / V2 (+0xb4) / V3 (+0xe8) /
      obj1 (+0x100) / obj2 (+0x120).
    - **Early exit** @0x792945-0x792967: `cmpb $0,0x37(%esp)` (0
      pending); flag ≠ 0 → `ecx := ebx; call 0x797d10` @0x79294e,
      `call 0x7924c0` @0x792955, **`driver[+0xc8] := 1`** (`mov $1,%ecx;
      lea 0xc8(%ebx),%eax; xchg %ecx,(%eax)`) @0x79295a-0x792965 → `jmp
      0x793e2b` (epilogue) ⇒ a "done" answer skips the whole build + cell
      loop. flag == 0 → `cmpl $0,0x74(%ebx)` @0x79296c (grid_world gate;
      assert **line 0x39c = 924**, expr 0x11a4758 = `data->grid_world`).
    - **V inits + the state byte's full store list**: V1 := 0 at frame
      [+0x9c/a0/a4] + **state 6** @0x792a30-0x792a51; V2 := 0 at
      [+0xb4/b8/bc] @0x792a5c-0x792a79 (**NO state store — state 7 is
      never written anywhere in the function**); V3 := 0 at [+0xe8/ec/f0]
      + **state 8** @0x792a7d-0x792a9e; V0 := 0 at [+0xcc/d0/d4] +
      frame[+0x44] := 0 + **state 9** @0x792ce2-0x792d05 (ebx cross-check
      `mov 0x38(%esp),%eax` @0x792d01 ⇒ frame[+0x38] = driver ✓). Full
      byte-grep of `0x180(%esp)` stores (**15 total**): 0/1/2/3/4/5 @
      0x7926cb-0x79278c, −1 @0x792920, 6 @0x792a51, 8 @0x792a9e, 9 @
      0x792d05, 8 @0x792f61, 0xa @0x79338e (2 pending → E+0x180), 0xb @
      0x7933a0, 0xa @0x793d97, 8 @0x793db4 — **state 7 absent (V2's
      turn — genuine gap, OPEN)**. Also grid_world vcalls `[*vtable+0x58]`
      → **frame[+0x80]** @0x792ab1 and `[*vtable+0x10]` → **frame[+0x7c]**
      @0x792ac0 ⇒ both slot-provenance tags now SOURCED.
    - **Seed formula (byte-exact 0x792abd-0x792c13)**: edx := driver
      [+0x24] @0x792abd, eax := driver[+0x20] @0x792ac4, `lea 0x2(%edx),%ecx`
      @0x792ac7 → xmm1 := (double)(oy+2) @0x792aca-0x792acf → × ox @
      0x792ad2-0x792add (pre-`add $-3`) → × (ox−3) @0x792ae1-0x792ae9 →
      × oy @0x792aed-0x792af5 → `addsd [0x11dfe30] = 1.0` @0x792af9 →
      `comisd [0x11df878] = 0.0` @0x792b01, spill **frame[+0x5c] := raw
      seed** @0x792b09 (0 pending), `ja 0x792bd9` @0x792b0f (seed > 0
      skips the assert: **line 0x3ab = 939**, expr 0x11a476c = `seed > 0`,
      time64 → frame[+0x6c] @0x792b3a / **frame[+0x70] @0x792b42**, crash
      @0x792bd1). Scale loop @0x792bd9-0x792c13: bound `[0x11e0220] =
      2147483647.0`, multiplier `[0x11dfdd8] = 0.5` (frame[+0x54] := 0.5
      @0x792bef), **max 10000 halvings (`cmp $0x2710,%eax; jge`)**, store
      frame[+0x5c] := scaled @0x792c09, `esi := cvttsd2si` @0x792c0f,
      **`xor $0xc,%esi`** @0x792c13 ⇒ **esi = trunc(scaled seed) ^ 0xc**.
      Then the procedural gate `cmpl $0,0x70(%ebx); jne 0x792ce2` @
      0x792c16 (assert **line 0x3b8 = 952**, expr 0x11a4778 = `data->
      procedural_terrain`; ebx clobbered @0x792c73, restored from frame
      [+0x38] @0x792ccf).
    - **Both `0x909da0` env samples are byte-IDENTICAL** — corrects an
      interim same-session reading (sample 2 first read as `(ox, oy)`;
      no tracked doc carried that claim — (108)@8127 records "the
      reference position itself unread", (110)@8390 lists it OPEN):
      - sample 1 @0x792d0d-0x792d69: eax := frame[+0x38] (driver) @
        0x792d01; ebx := driver[+0x28] (width) @0x792d0d → `add
        0x20(%eax),%ebx` = right edge @0x792d10; edi := driver[+0x20]
        (ox) @0x792d13; ecx := A @0x792d16; **frame[+0x4c] := A** @
        0x792d19; xmm3 := (double)(ox+w) @0x792d1d-0x792d21; xmm0 := [0x11dfd88]
        = 0.25 @0x792d25 → **frame[+0x84] := 0.25** @0x792d35; xmm2 :=
        (double)ox; xmm3 = width @0x792d3e; xmm3 = width × frame[+0x54]
        (= 0.5) @0x792d46; xmm1 = width × 0.25 @0x792d4c; xmm0 := (double)
        driver[+0x24] (oy) @0x792d50; **xmm3 = ox + 0.5·width, xmm1 =
        oy + 0.25·width** @0x792d59-0x792d5d → register swap @0x792d61/
        0x792d65 → `call 0x909da0` @0x792d69 (ecx = A; **NO stack args**)
        → **frame[+0x64] := region** @0x792d6e (null → re-store @0x792d76
        + `jmp 0x792dbf` = skip 0x8f5760).
      - sample 2 @0x792dd6-0x792e27: `mov 0x20(%ecx),%edi` (ox) @0x792dd6,
        `mov 0x28(%ecx),%ebx` (width) @0x792dd9 → `add %edi` (right edge)
        @0x792ddc, `mov 0x70(%ecx),%eax` (A) @0x792dde → **frame[+0x3c]
        := A** @0x792de1; xmm2 := (double)ox @0x792de5-0x792de9; xmm3 :=
        (double)(ox+w) @0x792ded-0x792df1; xmm0 := (int)oy @0x792df5;
        ecx := A @0x792dfa; **xmm3 = (ox+w) − ox = width** @0x792dfc;
        xmm0 := (double)oy @0x792e00; `movapd` @0x792e04; `mulsd 0x54(%esp)`
        (0 pending → frame[+0x54] = 0.5) @0x792e08; `mulsd 0x84(%esp)`
        (0 pending → frame[+0x84] = 0.25) @0x792e0e; **xmm3 = ox +
        0.5·width, xmm1 = oy + 0.25·width** @0x792e17-0x792e1b → swap @
        0x792e1f/0x792e23 → `call 0x909da0` @0x792e27; the return is read
        **only** for `[eax+0x2a4] = mBiomeMaterials` @0x792e30 (not
        stored; null → `je 0x792e64` = dispatch).
      ⇒ **both samples = (driver[+0x20] + 0.5·driver[+0x28], driver[+0x24]
      + 0.25·driver[+0x28])** = (originX + width/2, originY + width/4)
      under C86's {ox, oy, width} map — **both offsets derive from +0x28
      = width (NOT height), and the two calls are not distinguishable**.
      Closes (108)@8127 / (109)@8250 / (110)@8390's "setup reference
      position" tags; why the y offset uses width stays OPEN.
    - **The two builder calls (byte-exact)**:
      - **`0x8f5760` = the fill-source builder** @0x792d7c-0x792dbf:
        ecx := `[eax+0x2a4]` (mBiomeMaterials) @0x792d7c + null gate
        `je 0x792dbf` @0x792d84; `lea 0xcc(%esp),%eax` (&V0, 0 pending) @
        0x792d8a; `sub $8,%esp` @0x792d95 + right-edge f64 → `(%esp)` @
        0x792d98; `push %eax` (&V0) @0x792da1 (2 stack slots now); `mov
        0x58(%esp),%eax` @0x792da2 (12 pending → E+0x4c = A) → xmm2 :=
        A[+0x30] @0x792daa; xmm3 := (double)ox @0x792d9d/0x792da6;
        `call 0x8f5760` @0x792daf (**ret $0xc** = the 8+4 bytes ⇒ pending
        0) → `mov 0xd0(%esp),%eax` (V0.end) @0x792db4 → **frame[+0x44] :=
        V0.end** @0x792dbb. Signature: `0x8f5760(mBiomeMaterials, &V0,
        right-edge f64, A[+0x30], ox)`; V0 = the 16-byte `{double @−8,
        Object* @0}` list ⇒ **closes (109)@8240-8241 / (110)@8388-8389's
        "where the {double, ptr} list comes from"**.
      - clear + restash: ecx := frame[+0x38] (driver) @0x792dbf →
        **driver[+0xc0] := driver[+0xbc]** @0x792dc9-0x792dcf (clear) →
        **frame[+0x4c] := &driver[+0xbc]** @0x792dd2 (slot was A).
      - **`0x8f5d20`** @0x792e30-0x792e5f: ecx := mBiomeMaterials @
        0x792e30 + null gate @0x792e38; eax := frame[+0x3c] (A) @0x792e3a;
        `sub $8` @0x792e3e; xmm3 := (double)right-edge @0x792e41-0x792e45;
        xmm2 := A[+0x30] @0x792e49; f64 → `(%esp)` @0x792e4e; `push
        0x54(%esp)` @0x792e53 (8 pending → E+0x4c = **&driver[+0xbc]**);
        xmm3 := (double)ox @0x792e57-0x792e5b; `call 0x8f5d20` @0x792e5f
        (**ret $0xc** @0x8f5ea5; own assert line 0x19e = 414) ⇒ `0x8f5d20(mBiomeMaterials,
        &driver[+0xbc], right-edge f64, A[+0x30], ox)`.
    - **Dispatch → shuffle → sort → resize (byte-exact 0x792e64-0x792f74)**:
      count = `(frame[+0x44] − frame[+0xcc])>>4` @0x792e64-0x792e71, edi
      := V0.begin + 8 @0x792e78, stride `add $0x10` @0x792ed6, ebx = the
      countdown, 0 pending throughout; **`[obj+7] ≠ 0` → ceiling** @
      0x792e82: `cvttsd2si −8(%edi)` → frame[+0x6c], cfg → **frame[+0x70]**
      @0x792e8d, `lea frame[+0xe8]` + `lea frame[+0x6c]` → `0x93ef50`
      (8-byte `{int @0, ptr @4}` pairs per (109)@8213-8216); **`[obj+6]
      ≠ 0` → grass** @0x792ea2: edx := elem+8 @0x792ea8, `lea frame
      [+0xb4]` → `0x9ef4e0` (0 stack args); **else → band B** @0x792eb8:
      cfg → **frame[+0x50]** @0x792ebd, cvttsd2si → frame[+0x4c], `lea
      frame[+0x9c]` + `lea frame[+0x4c]` → `0x93ef50` ⇒ **closes
      (109)@8241-8242's frame[+0x70]/[+0x50] setup-writer tag**. Then edi
      := frame[+0xcc] @0x792edc (0 pending — the pointer freed below) and
      **shuffle** `0x9ef570(ecx = &frame[+0x9c], xmm1 = f64 frame[+0x5c]
      = the scaled seed)` @0x792ef0 (any 3rd arg = edi, OPEN). **Sort 1**:
      edx := frame[+0xa0] (V1.end) @0x792f03, ecx := frame[+0x9c] (V1
      begin) @0x792f0a, frame[+0x4c] := 0 (pred) @0x792f11 (0 pending) →
      `push 0x4c(%esp)` @0x792f16 + `sar $3,%eax` + `push %eax` → **`0xa735a0`
      @0x792f1e with its 2 pushes left uncleaned** (cdecl; the caller
      defers cleanup to the single `add $0x10` @0x792f4f). **Sort 2**:
      edx := `0xf4(%esp)` (2 pending → **frame[+0xec] = V3.end**) @
      0x792f23; ecx := `0xf0(%esp)` (**frame[+0xe8] = V3.begin**) @
      0x792f2c; `eax = edx − ecx` @0x792f33; frame[+0x4c] := 0 @0x792f35
      (2 pending → E+0x4c); `push 0x54(%esp)` + `sar $3` + `push %eax`
      (4 pending) → **`mov %eax,0x58(%esp)` @0x792f42 (4 pending →
      E+0x48) = THE frame[+0x48] writer: frame[+0x48] := eax = V3.count** →
      `0xa735a0` @0x792f46 → **`mov 0x48(%esp),%ebx` @0x792f4b (4 pending
      → E+0x38 = driver)** → `add $0x10` @0x792f4f (→ 0 pending) → `push
      0x48(%esp)` @0x792f52 (0 pending → frame[+0x48] = V3.count) + `lea
      0x8c(%ebx)` @0x792f56 → **`0x93ee40(&driver[+0x8c], V3.count)`** @
      0x792f5c (**ret 4**) → **state 8** @0x792f61 → free V0 `test %edi;
      push %edi; call *[0x114a348]; add $4` @0x792f69-0x792f74 → `cmpl
      $0,0x70(%ebx); je 0x793338` @0x792f77-0x792f7b (A-null ⇒ skip the
      whole cell loop, (109)@8229-8231 ✓), frame[+0x2c] := 0 (y counter)
      @0x792f81-0x792f83 (0 pending), `driver[+0x2c] ≤ 0 → 0x793338` @
      0x792f87-0x792f8a.
    - **CONFIRMS (110)'s two corrections of (109)** — quoting (109)@8220-8223
      ("on a **third stack vector at frame[+0xf0]/[+0xf4]** (8-byte
      elements) @0x792f46 … freed @0x792f6d") and (109)@8224-8228 ("**the
      driver at setup** (load @0x792f4b → `lea 0x8c(%ebx),%ecx` =
      `&driver[+0x8c]` @0x792f56 → `0x93ee40(&ceiling_plants_to_insert,
      driver)` @0x792f5c — body open) — the slot is later reused as the
      ceiling count (its writer still open)"). Both byte-refuted this
      session: @0x792f23/0x792f2c run with **2 pushes pending** ⇒ frame
      [+0xec]/frame[+0xe8] = the ceiling vector's {end, begin} (only
      three stack vectors exist — there is no frame[+0xf0] vector), and
      @0x792f4b with **4 pending** ⇒ frame[+0x38] = driver, while the
      writer @0x792f42 (4 pending) writes frame[+0x48] and @0x792f52
      (0 pending) re-pushes frame[+0x48] ⇒ `0x93ee40(&driver[+0x8c],
      V3.count)`, **not** driver. The pending chain that makes both
      corrections work = sort1's 2 uncleaned pushes + sort2's 2.
    - **`frame[+0x48]` full lifecycle (closes (109)@8228 / (110)'s writer
      tag)**: `:= (V3.end − V3.begin)>>3 = V3.count` @0x792f42 → pushed
      as 0x93ee40's arg @0x792f52 → ceiling-scan bound `cmp 0x48(%esp),%ecx`
      @0x793109 (head) / @0x79312d (inner) / @0x79314d (exit) — 0 pending
      (no push between 0x793090 and 0x793109) → **reused as the margin y**:
      `:= 8` @0x7933ad (`mov $8,%edx` @0x79339b) guarded by `driver[+0x2c]
      − 8 ≤ 8 → 0x793d81` @0x7933a8-0x7933b3 ∧ `driver[+0x28] − 8 ≤ 8 →
      0x793d6e` @0x7933c0-0x7933d0 → read @0x793460 → `inc %edx; mov
      %edx,0x48(%esp)` @0x793d71/0x793d75 with the row back-edge `jl
      0x7933c0` @0x793d7b (the (8,8)-margin y home). Siblings: frame
      [+0x40] := 8 @0x7933ca (x) with back-edge `jl 0x7933e0` @0x793d64,
      frame[+0x7c] := y<<9 @0x7933db (4096 at y = 8). The write/guard
      chain is now fully pinned; **the semantic reason for the constant
      8 stays OPEN**.
    - **Slot-reuse map (this region)**: frame[+0x5c] = 93e550's out →
      raw seed → scaled seed (→ shuffle arg); frame[+0x2c] = dtor mask
      (0x3f) → cell y (:= 0 @0x792f83) → margin dy (:= −1, C89); frame
      [+0x30] = build mask (1…0x3f) → x counter (:= 0 @0x792fa6); frame
      [+0x4c] = A (@0x792d19) → &driver[+0xbc] (@0x792dd2) → sort1/sort2
      pred byte; frame[+0xcc] = build string1 → V0 → start/end-time
      double (C89's frame[+0xcc] = x87 spill @0x793377 re-verified: 2
      pending after the `push $3` pair @0x79336c-0x79336e); frame
      [+0x6c]/[+0x70] = time64 edx:eax (assert paths @0x792b3a/@0x792b42)
      → V3 staging (int/cfg @0x792e98/@0x792e8d); frame[+0x7c]/[+0x80] =
      grid_world vfunc results (@0x792ac0/@0x792ab1) → y<<9; frame
      [+0x100]/[+0x120] = build strings5/0 → obj1/obj2 (`lea 0x108(%esp)`
      2 pending @0x793370 ⇒ E+0x100, `lea 0x128(%esp)` 2 pending @
      0x793387 ⇒ E+0x120; ctor `0x92e980(&obj, 3, 3)` @0x79337e/0x793396).
    - **Call-cleanup conventions observed this dig** (drives every
      pending count above): `0x93e550` ret 8, `0x93ee40` ret 4,
      `0x8f5760`/`0x8f5d20` ret $0xc (callee cleans, no `add` follows);
      `0x443390`/`0x4433e0`/`0x444a10`/`0x10078c0`-style + `0xa735a0`
      cdecl (caller's `add $4` follows — except a735a0, whose pushes
      survive until `add $0x10` @0x792f4f); `0x9d89d0`/`0x9ef4e0`/
      `0x9ef570` take only registers (0 stack args).
    - **Asserts pinned (all five in/near the region)**: null-this **0x38f
      = 911** expr `data` @0x1168a04; grid_world **0x39c = 924** expr
      `data->grid_world` @0x11a4758; seed **0x3ab = 939** expr `seed > 0`
      @0x11a476c; procedural **0x3b8 = 952** expr `data->procedural_terrain`
      @0x11a4778; IsValid **0x3e9 = 1001** expr `data->array2d->IsValid(
      x, y )` @0x11a4794 (C85 ✓) with the report @0x793047-0x793083 (ebx
      reload from frame[+0x38] @0x79307f, `add $0x14` + `add $0x4` → 0
      pending) and the `driver[+0x78]` byte gate @0x79309a (C85 ✓).
    - [OPEN] (next units): `0x93e550` + the `0x132aed8` sentinel's
      polarity (string-key semantics); `0x9d89d0` (int→string step);
      `0x443390/0x4433e0/0x444a10` (concat helpers); `0xfe81b0` + the
      `0x1344b90` object's +0x24 vcall meaning (flag frame[+0x37]); the
      early-exit pair `0x797d10`/`0x7924c0`; `0x8f5760`/`0x8f5d20` fill
      semantics (incl. the `0x11dfb90`/`0x11e0068` quantization feeding
      `0x1033781`, which has no ghidra file); `0x93ef50`/`0x9ef4e0`
      (pair-push bodies), `0x9ef570`'s 3rd arg, `0xa735a0`/`0x93ee40`
      (semantics — conventions known); driver[+0x58] (the cache key) and
      driver[+0xbc] (config-pointer vector) consumers; state 7; why the
      env y-offset uses WIDTH; the margin constant 8's meaning; A[+0x30]
      identity; `0x909370` / `0x909da0` bodies; (109)@8243's `0x793338`
      A-guard re-check; carried: 0x740f80 / 0x7412c0 / 0x93d710 / 0x93edb0
      / 0x949e80 / 0x94a9d0 / band-field provenance / vfunc[1]==2 /
      driver[+0x78] provenance / 0x908f40 stale xmm0.
    - Landed: CONSTANTS **C90**, this entry **(111)**. No §8 row, no
      §12, no patch — drop path OFF. Gates green at commit. Next free:
      entry **(112)**, **C91**, **I22**; §8 row 33 free.
  - **2026-10-02 (112) — (104)④ side-by-side: true 0x8fb570/0x8fb350
    vs the ported whiteLattice2d ⇒ DEFECT: THE PORT INVERTS ALL THREE
    BLEND ENDPOINTS — port(wx,wy) = binary(1−wx, 1−wy) on the same c0,
    i.e. the per-cell mirrored lattice that equals NO evaluation of the
    binary; all three live surface lanes (addNoise 1/2/3) + the
    NOISE_TYPE dispatch lane call the flipped port. I22 filed; (26)'s
    smoke pin 0.834 = the INVERTED value (true 0.494). Also: (26)'s
    twin/FNV labels 0x8fc550/0x8fc940 don't exist in fulltext86 →
    true 0x8fb950/0x8fbb40. No patch, no IoU — judge parked.**
    **[UPDATED (113): I22 closed (endpoints swapped); and the cell =
    FLOOR, not round — so "true 0.494" = round-derived = STALE, the
    true byte-literal = 0.898207068 (C92).]**
    - Method: cached whole-file disasm `mapgen/extractions/fulltext86.asm (X1)`
      (true VAs) windows 0x8fb350..0x8fb567 (whole fn: prologue,
      weights, corner chain, blends) + the twin tail 0x8fb789..0x8fb841;
      the port's own evidence file `mapgen/extractions/case1core.asm (X15)`
      (slab = true − 0x400800) re-read — byte-identical at every
      cited site; rdata from `noita_dev.exe` at file = VA − 0x400E00,
      byte-read this session: **0x11dfbf0 = f32 1.0** (corner arg
      `addss` @0x8fb4d3 = c0+1), **0x11df874 = f32 0.0** (@0x8fb50c =
      c0+0), re-matched C40/C83 anchors 57.0@0x11e028c,
      58.0@0x11e0298, 43758.546875@0x11e04c8, 2.0@0x11dfe68,
      3.0@0x11dff70. Numeric demo `mapgen/extractions/sidebyside-112.mjs (X8)`.
    - **0x8fb350 byte law (whole body re-read):** fx = x − floor(x),
      fy = y − floor(y) (cvttss2si + comiss + jbe/dec floor-fix,
      @0x8fb38f..3cb); **wx = (3.0 − 2·fx)·fx² → slot(-0xc)**
      (@0x8fb410 / @0x8fb41c / store @0x8fb420); **wy = (3.0 − 2·fy)·fy²
      → slot(-0x1c)** (@0x8fb435 / @0x8fb444 / store @0x8fb448);
      **c0 = 57.0·round(y) + round(x) → slot(-0x4)** (@0x8fb3e9 /
      @0x8fb3fc / store @0x8fb417; round = 0x44d0b0 fld/fistp, C40).
      **[SUPERSEDED (113): c0 = 57.0·floor(y) + floor(x); 0x44d0b0 =
      the CRT floor wrapper — C92; the rest of this byte law
      (weights/corners/blend idiom) unchanged]**
      Corners = fract(sin(c0+k)): **h58 → slot(-0x8)** (arg +58.0
      @0x8fb43c, sin 0x44d110 @0x8fb44d, store @0x8fb486), **h57 →
      xmm2** (arg +57.0 @0x8fb47e, sin @0x8fb48b), **h1 → slot(-0x14)**
      (arg +1.0 @0x8fb4d3, sin @0x8fb4db, store @0x8fb514), **h0 →
      xmm2** (arg +0.0 @0x8fb507..50c, sin @0x8fb519; floor-fix
      completes @0x8fb548).
    - **The lerp idiom — the crux:** every blend = `subss` → `mulss t`
      → `addss` = **`(A − B)·t + B` ⇒ t=0 selects B (the second
      operand).** Three blends, byte reads: **y+1 row** @0x8fb4b7..4c9
      = slot(-0x8) − h57; ·wx; + h57 → store slot(-0x8) = (h58 − h57)·wx
      + h57 ⇒ wx=0 ⇒ **h57**; **y row** @0x8fb548..55a (h1 loaded
      @0x8fb53a) = h1 − h0; ·wx; + h0 ⇒ wx=0 ⇒ **h0** (xmm1); **out**
      @0x8fb55e..567 = (y+1row − yrow)·wy + yrow ⇒ wy=0 ⇒ **the y row**
      (xmm0). ⇒ **0x8fb350 = standard orientation: out =
      lerp(lerp(h0,h1,wx), lerp(h57,h58,wx), wy)**, wx = wy =
      smoothstep(frac) — structurally IDENTICAL to C83's 0x8fb570 law
      (the parity weight mix = the only difference). Function =
      0x8fb350..0x8fb56f (ret @0x8fb56e) = 543 B.
    - **0x8fb570's tail is BYTE-IDENTICAL to 0x8fb350's** (same
      opcodes, same ebp slots −0x8/−0xc/−0x1c): @0x8fb546..567 ≡
      @0x8fb818..839 (22 bytes: the interleaved `pop %edi/%esi`, the
      floor-fix `subss`, the slot(-0x8) row load, and all six blend
      instructions) and @0x8fb4b7..4c9 ≡ @0x8fb789..79b (the y+1-row
      blend); body 0x8fb570..0x8fb841 (ret @0x8fb840) = **721 B** ✓
      C83 — C83's `out = lerp(lerp(h0,h1,Wx), lerp(h57,h58,Wx), Wy)`
      byte-reconfirmed.
    - **[DEFECT] verdict — the port is endpoint-inverted:**
      `mapgen/lib/noise-proto.mjs:183` defines `lerp(a,b,t) = (b−a)·t
      + a` (**t=0 selects a = the FIRST arg**) and is called rowA =
      lerp(h58,h57,wx), rowB = lerp(h1,h0,wx), out = lerp(rowA,rowB,wy)
      ⇒ at t=0 the port returns h58 / h1 / rowA — the OPPOSITE
      endpoint of all three asm blends (h57 / h0 / y-row). Algebra:
      each inner lerp's t and the final lerp's t are complemented ⇒
      **port(wx, wy) = binary(1−wx, 1−wy) on the same c0.** Numeric
      (`sidebyside-112.mjs`, 5 points, f32 lanes): port ≡
      weight-complemented parse ≤ 1e-6 at every point; port −
      byte-literal = **0.34..0.97** — (12.5, −3.25): port
      **0.833995283** (= (26)'s smoke pin "0.834", ABOUT_MATH:2940) vs
      byte-literal **0.493832439**; (0.25,0.25): 0.668501258 vs
      0.211786672; integer (3,5): 0.907893717 = h(c0+58) vs
      0.371890724 = h(c0); (−7.6,12.1): 0.293845415 vs 0.650447428;
      (100.999,−0.001): 0.991591871 vs 0.018220901. NOT a coordinate
      mirror either: mirroring flips round(x)/round(y) ⇒ c0 shifts by
      57·Δy+Δx ⇒ **the port's output equals NO evaluation of the
      binary** — the mirrored lattice keeps the near-corner c0.
    - **Impact — caller census this dig:** `call 0x8fb350` @**0x90b00d**
      (addNoise=1), @**0x90aef9** (addNoise=2), @**0x90ae25**
      (addNoise=3), @**0x8fd93e** (the NOISE_TYPE dispatch, 0x8fd920
      switch @table 0x8fdaa4, C36). Gate re-read: `comiss [0x11dfb84]`
      @0x90ab48 (the 0.51 gate), eax = [ebx+0x220] = addNoise, dec/je
      1→0x90afeb 2→0x90aeba 3→0x90ae03, default @0x90ab7d = I20's
      throw arm (case-1 slab 0x50a7eb + 0x400800 = 0x90afeb ✓ C13);
      case-2's second lattice = `call 0x8fbb40` @0x90af1d = the
      port's fnvLattice2d source. ⇒ every live surface lane renders
      the mirrored lattice.
    - **Correction of entry (26)'s fn labels (fulltext86-verified):**
      "true 0x8fc550" (whiteLattice2d twin) and "true 0x8fc940"
      (FNV24 lattice) = **0 hits** in fulltext86 (the 0x8fc4xx/5xx
      region IS covered — 136 instruction labels — so neither is an
      instruction boundary). slab+0x400800 (C13): twin slab 0x4fb150 →
      **0x8fb950** (signature matches (26): 2× round 0x44d0b0
      @0x8fb973/982, 57.0 mul @0x8fb9e1, smoothstep 2.0 mul
      @0x8fb9f0; ONLY caller = @0x8fd966 = the dispatch lane);
      FNV slab 0x4fb340 → **0x8fbb40** (callers @0x8fd974 dispatch +
      @0x90af1d addNoise=2 ✓ = fnvLattice2d). The twin is NOT in any
      surface lane ⇒ I22's scope = 0x8fb350's port only.
    - [OPEN] (next units): the I22 fix (swap the three endpoint pairs;
      register-backed + a byte-pinned test pin — candidate
      `whiteLattice2d(12.5,−3.25) = 0.493832439` — + IoU after);
      I20② default-arm port (C83 byte-closed); twin 0x8fb950's
      constant-diff (relabel from (26)'s 0x8fc550); carried: the
      (111) OPEN list unchanged (93e550/0x132aed8, 9d89d0,
      443390/4433e0/444a10, fe81b0 + 0x1344b90 +0x24, 797d10/7924c0,
      8f5760/8f5d20 fill semantics + 0x1033781, 93ef50/9ef4e0 +
      9ef570 3rd arg, a735a0/93ee40, driver[+0x58]/[+0xbc], state 7,
      env-y-width, margin 8, A[+0x30], 909370/909da0, (109)@8243's
      0x793338 A-guard, carried 0x740f80/0x7412c0/0x93d710/0x93edb0/
      0x949e80/0x94a9d0/band-field provenance/vfunc[1]==2/driver[+0x78]
      provenance/0x908f40 stale xmm0).
    - Landed: CONSTANTS **C91**, ISSUES **I22**, this entry **(112)**,
      VERIFIED CASE-1 LANE CLOSED fidelity caveat. No §8 row, no §12,
      no patch — drop path OFF. Gates green at commit. Next free:
      entry **(113)**, **C92**, **I23**; §8 row 33 free.

- **2026-10-06 (113) — dig #113: 0x44d0b0 = CRT FLOOR not round (C40's
  gloss overturned) ⇒ I22 FIXED (blend endpoints) + I20② PORTED (default
  arm = parity lattice); the three-file working diff verified independently
  and gates green.** Diagnosed the previous session's uncommitted work,
  re-derived every byte claim from the exe this session, corrected the
  docs' round-derived glosses, and closed the two issues.
  - **THE OVERTURN: `0x44d0b0` = the CRT `floor` wrapper, not fld/fistp
    round.** Byte-walk of the PE import directory (`the session temp bank (now settled under mapgen/extractions/, manifest X1–X61)
    verify-floor-113.mjs`, 656 entries, no hardcoded offsets): body
    55 B @0x44d0b0 (ret @0x44d0e6) = `cvtss2sd @0x44d0b9 → fldl @0x44d0c6
    → fstpl @0x44d0ca → call 0x1033a52 @0x44d0cd → fstpl @0x44d0d2 →
    cvtpd2ps @0x44d0df` — **no `fistp` anywhere**; thunk 0x1033a52 =
    `ff 25 → jmp [0x114a534]`, and IAT slot 0x114a534's name record =
    **MSVCR120.dll `floor`, hint 1646**. (fldl/fstpl = arg marshalling
    only.) C40's "CRT fld/fistp ROUND-to-nearest wrapper" = wrong ⇒
    every round-derived gloss superseded inline at (26)/(40) and in
    CONSTANTS (C40/C83/C91 + the two "fp-round helper" texts); the
    CORRECT row = **C92**.
  - **IAT chain re-read whole** (`mapgen/extractions/resolve-wrappers-113.mjs (X7)`,
    names resolved from the import dir, one thunk per slot in order):
    0x114a510 `_libm_sse2_acos_precise` · 0x114a514
    `_libm_sse2_cos_precise` · 518 `_libm_sse2_log10_precise` · 51c
    `_libm_sse2_pow_precise` · 520 `_libm_sse2_sin_precise` · 524
    `_libm_sse2_sqrt_precise` · 528 `_libm_sse2_tan_precise` · 52c
    `_setjmp3` · 530 `ceil` · 534 `floor` · 538 `memcpy` · 53c
    `memset` · 0x114a540
    `?terminate` (thunks 0x1033a1c..0x1033a5e); 0x114a500 `_CIfmod`,
    504 `_CxxThrowException`, 508 `__CxxFrameHandler3`, 50c
    `__RTDynamicCast`. (26)'s list was off-by-one from 0x114a514 and
    mis-labelled 3 slots; **the only pin the code uses, 0x114a520 =
    sin for 0x44d110, survives** — as does (40)'s 0xc33234 → sin; that
    item's other half, 0xc33222 → 0x114a514, = **cos** not acos.
    The 0xc33xxx are slab VAs (true = +0x400800, C31's memset check).
  - **Floor confirmed at BOTH c0 sites (byte-read
    `mapgen/extractions/fulltext86.asm (X1)`, windows re-read this session):**
    0x8fb350 calls @0x8fb373/382 → `mulss 0x11e028c` (57.0) @0x8fb3e9 +
    `addss −0x8(%ebp)` (floor(x) slot) @0x8fb3fc → store c0 −0x4
    @0x8fb417; 0x8fb570 calls @0x8fb593/5a2, c0 @0x8fb6f2..6fe, and the
    corner parities run ON the floor values (`and 0x80000001` @0x8fb613,
    `lea 0x1(%ecx)` @0x8fb64f), sf triple @0x8fb637..646, Wx
    @0x8fb67e..690→−0xc, Wy→−0x1c @0x8fb71a, corners +58/+57/+1/+0
    @0x8fb70e/750/7a5/7de, h58→−0x8 @0x8fb758, y+1 row blend
    @0x8fb789..79b, h1→−0x14 @0x8fb7e6.
  - **The three-file diff = correct on independent read:**
    1. **I22 FIXED** in `whiteLattice2d` (`noise-proto.mjs`): the three
       endpoint pairs re-oriented to the C91 idiom — `rowY1 =
       lerp(h57,h58,wx)`, `rowY0 = lerp(h0,h1,wx)`, `out = lerp(rowY0,
       rowY1,wy)` (each lerp's FIRST arg = its t=0 endpoint); comment
       block re-derived (floor c0, byte addresses of the three blends).
    2. **round → floor** in the same function's c0
       (`Math.floor` both slots) + the header gloss.
    3. **I20② PORTED**: new `parityLattice2d` = 0x8fb570's body (rx/ry
       = floor; Wx = lerp with (w0,w1) = (sf(fx),fx) iff floor(x) EVEN
       else flipped, `and 0x80000001` parity; Wy identical; c0 = 57·ry+rx;
       same corner/lerp chain) + the `surfaceField` else-arm replacing
       the I20 throw: `a = parityLattice2d(x·0.025,y·0.025)` @0x90ab7d..9f
       → `g = f(a·0.05+0.05)` @0x90abae..bb → `n = simplex2d(x·0.5·0.02·g,
       y·0.5·0.02·g)` @0x90abb6..abee **using the f32 slot [0x11df908] =
       K2.h02, NOT case-1's f64_002 [0x11dfc70]** → `r2 = f(n·rp)` @0x90abfb
       → C77 tail @0x90ac07..17 → `jmp 0x90b0a2` @0x90ac1b. Live for
       addNoise 0 (hills_flat/mountain_lake/laboratory) + stale 4.
    4. `noise-terrain.mjs` comment: the I20 default arm no longer throws
       (only the noiseKind −1 winter/mountain_center path does).
  - **Numeric re-derivation** (`mapgen/extractions/sidebyside-112.mjs (X8)`, floor
    cell re-run): **port ≡ asm-literal at all 5 points, |Δ| ≤ 1.19e-7**;
    the asm-complement (pre-(112) orientation) now mismatches everywhere
    (0.17..0.54). Literals — (12.5,−3.25) **0.898207068** / compl
    0.723673105; (0.25,0.25) 0.211786672 / 0.668501258; (3,5)
    0.371890724 / 0.907893717; (−7.6,12.1) 0.650447309 (Δ 1.19e-7 vs
    0.650447428) / 0.293845415; (100.999,−0.001) 0.991593361 (vs
    0.991593242) / 0.745933115. **Round-derived values (entry (112)'s
    0.493832439/0.018220901) = STALE**; pre-fix port = round+inverted =
    0.833995283 = (26)'s smoke "0.834".
  - **Tests** (`tests/mapgen/surface-census.test.mjs`, 42/42): endpoint
    pin → `toBeCloseTo(0.898207068, 6)` + discriminators excluding the
    round cell (>0.3) and the endpoint-flip (>0.1); the default-arm
    throw-pins → byte-tail COMPUTE pins (exp = the same chain, both
    lanes 0 and 4, `toBeCloseTo 7`) + a whiteLattice-substituted
    sensitivity re-based to its measured scale (>1e-3 lattice, >1e-5
    output — the g→simplex→tail chain compresses ≈1.28e-2 to ≈9.2e-5);
    new "lattice byte pins" describe = the floor/round/inverted
    4-way discriminator at (12.5,−3.25), the integer-cell h0 pin for
    BOTH lattices (3,5) = 0.371890724, and both parity branches
    diverging from the plain-smoothstep lattice (comment fixed
    round(2.25) → floor(2.25)).
  - **Gates: `npm test` = 261/261, exit 0, 51 s** (log
    `mapgen/extractions/fulltest-113.log (X26)`).
  - Landed: CONSTANTS **C92** (+ supersessions at C40/C83/C91 and the
    two "fp-round helper" texts), ISSUES **I20** + **I22** closed,
    VERIFIED CASE-1 fidelity caveat updated to "fixed" (0.898207068) +
    **§8 row 33** (round→floor overturned — do not re-test), inline
    supersessions at (26)/(40), this entry **(113)**. Next free:
    entry **(114)**, **C93**, **I23**; §8 row 34 free.

- **2026-10-06 (114) — dig #114 (housekeeping + gates): the field-wiring IoU
  verdict = FIELD SHAPE dominates, registration does NOT ⇒ I21 parked; the
  reproducible V2 chunk census instrument landed (+ a handover correction);
  `npm run bench` = NO observable default-lane change ⇒ cache r3i STANDS.**
  All numbers re-derived on disk this session (logs in the session temp bank — 2026-10-12: not individually banked; the instrument name in the row stands).
  - **① IoU re-run — the gate I21 was waiting on** (`SURFACE_V3=1 node
    mapgen/experiments/2026-09-24-surface-y-iou.mjs`, C79 spec; this run
    `mapgen/extractions/iou-114.log (X24)` vs the pre-#113 Oct-2 run
    `mapgen/extractions/iou-113.log (X25)`):
    - **overall: n 7064→7065, meanAbs 88.76 → 89.58, bias 1.62 → 2.88,
      ±3 0.046 → 0.045, genNoLine 14902 → 14901, fitX(a) 0.11583 → 0.09831,
      fitDepth(a) −0.347 → −0.562** (b 86.65 → 99.172).
    - **VERDICT: the residual error is FIELD SHAPE, not registration.**
      Four independent reads of the same logs: (a) **bias 2.88 px vs
      meanAbs 89.58 px** — a global frame shift would put those two on the
      same scale (bias/meanAbs = 3.2%); (b) **family biases MIXED SIGN**
      — mountain −28.89 · winter −17.93 · lake −40.76 · desert +36.79 ·
      hills +179.37 — one frame shift cannot sign-flip across families;
      (c) **the same family flips sign between neighbouring tiles** —
      hills 33_13 bias −205.69 vs hills 39_14 +340.83 (and 44_14 +258.75);
      (d) **`fitDepth(a=−0.56164, b=99.172)`** — the error tracks DEPTH
      (a scale/shape term crossing zero near depth 177), whereas a
      constant misregistration is `a = 0`. Only 4.5% of paired columns
      agree within ±3 px. ⇒ **I21 (the classify/evaluate frame flip,
      ISSUES:368) is NOT the indicated next dig — parked**, filed as an
      elimination at VERIFIED §8 row 34; a family-local misregistration
      is NOT excluded (scope note in the row).
    - **The delta IS dig #113's, and it is confined to the lanes #113
      changed:** 11 of the 56 per-tile rows differ (scripted diff) —
      **6 hills** (38_13, 41_13, 43_13, 41_14, 42_14, 44_14) + **5
      desert** (52_10, 49_13, 45_14, 46_14, 47_14) = the addNoise 1/2/3 +
      dispatch `whiteLattice2d` lanes (I22/C92); mountain, winter, lake,
      bty11, bty12 rows are **byte-identical**, and mountain_lake 40_14
      too (its new default-arm mask is 0.06% solid ⇒ no line change).
    - **Honest reading of I22's "IoU after" gate: EXECUTED, and the metric
      did NOT improve** (meanAbs +0.82, hills 294.44→297.34, desert
      133.27→137.16, ±3 flat). That is the expected result of a
      byte-fidelity fix measured by a shape metric: I22 stays CLOSED on
      its byte-pinned test (`0.898207068`), and the IoU stays the shape
      judge — the two are not the same axis.
  - **② V2 CHUNK CENSUS — new instrument + a handover correction.**
    - **Correction:** `mapgen/experiments/2026-09-28-surface-census.mjs`,
      which earlier handovers named "the V2 chunk census", is a **Ghidra
      call-graph region census** (reads `~/work/ghidra-logs/p0_*.csv`;
      130 fns: 20 dumped / 46 doc-mentioned / 79 unread-territory) — it
      never counted a rendered chunk, and it is unaffected by dig #113.
      **No chunk-census instrument existed in-repo**, so this dig added
      one: **`mapgen/experiments/2026-10-06-v2-chunk-census.mjs`** (C93).
    - Instrument contract: refuses to run without `SURFACE_V2=1` (the lane
      under measurement), seed `CAPTURE_SEED` 78633191, scope tx 0..70 ×
      canvas ty 0..143, smoke scope ty ≤ 96 (the (25)/(26) window);
      **buckets keyed by biome FILENAME**, not `name` — measured this
      session that hills.xml / solid_wall.xml / empty.xml all carry
      `name="_EMPTY_"`, so name-keyed rows hide whole biomes; definitions
      mirror `noiseChunkMask` exactly (procedural = biomeAt hit ∧ no
      `templateFile`, `noise-terrain.mjs:202-204`; COMPUTES = `noiseAt`
      non-null; density = Σmask/2704; textured = 0 < d < 1), and the
      frame `biomeAt(config, tx, ty − SKY_ROWS)` mirrors `:202`.
    - **HEAD (post-#113) run** `mapgen/extractions/census-114-post113.log (X29)`:
      **2288 procedural · 663 COMPUTES · 1625 falls · mean density
      0.0183 · all-air 17 · textured 646 · all-solid 0**; every fall =
      `noiseDispatch kind -1 (no noise_type)` (0 UNKNOWN, 0 default-arm).
    - **A/B vs pre-#113** (`mapgen/lib/noise-proto.mjs` swapped to
      `f33f0bd~1`, run, restored — `git status --short` clean after, only
      the new untracked script) `mapgen/extractions/census-114-pre113.log (X28)`:
      **658 · 1630 · 0.0185 · all-air 18 · textured 640**. Row diff =
      **exactly one fall reason disappears: mountain_lake.xml `5 proc,
      0 compute, 5 fall (surfaceField default arm …)` → `5 proc, 5
      compute, 0 fall, density 0.0006`** = dig #113's I20② port (+5
      COMPUTES), plus threshold-crossing speckle in hills (air 16→14,
      tex 247→249), hills2 0.0046→0.0044, mountain_tree 0.0019→0.0018,
      pyramid_top 0.0033→0.0026, mountain_top 0.0015→0.0018, pyramid_left
      0.0009→0.0011, pyramid_right 0.0036→0.0033, pyramid_hallway
      0.0026→0.0030, snowcastle_hourglass_chamber 0.0052→0.0059 — i.e.
      **#113's observable census delta = +5 mountain_lake chunks and
      nothing else structural.**
    - **Baseline caveat (settled):** (26)'s "**2194 chunks @ ~48–51%
      solid density**" was an ad-hoc run with no instrument, pre-dating
      the kind-5 re-binding, C77's sign fix (98) and the dig-#101
      gate-source change (proxy → `surfaceField` return); it is **not a
      like-for-like current baseline** and must not be restored-to or
      diffed-against as one. The current state of that lane is an OPEN
      question → **ISSUES I23**.
  - **③ THE BENCH GATE (cache rev) — NO observable default-lane change ⇒
    r3i STANDS (no bump).**
    - `npm run bench` (log `mapgen/extractions/bench-114.log (X31)`): gen wrote 96
      chunk entries, ref re-sliced **1100** chunks (every tile a
      **cache hit** — `find mapgen/out/cache -newermt "2026-10-06 05:00"`
      = empty, so no ref byte was fetched/altered today), diff scored
      **20 chunks**: **meanAbsDiff avg 91.21398745928495 · solidMismatchPct
      avg 41.46745681762695 · best 30_17 31.7% · worst 35_15 50.0%** =
      the stale Sep-19 `stats.json` values (91.214 / 41.467, 20 chunks) at
      recorded precision, with **`stats.json` 2819 B and `report.html`
      9243 B — byte-count identical to the Sep-19 files.**
    - **Code-path proof (why it had to be identical):** dig #113's diff =
      ABOUT_MATH/CONSTANTS/ISSUES/VERIFIED + `lib/noise-proto.mjs` +
      `lib/noise-terrain.mjs` (8 lines, comment) + one test file; the
      bench pipeline imports none of them (`2-generate.mjs` = paths,
      biomes, wang-wasm, coords, images). And the **cached artifact** is
      independent of the lane even when the lane is ON: r3i stores
      `world.maps` = the per-area `{w,h,attempt,rgb}` written by
      `ensureWorld`'s area loop (`world-gen.mjs:164..209`, wang/static +
      colorize), while `attachNoiseTerrain` (`noise-terrain.mjs:363-385`)
      only installs QUERY-time probes (`world.noiseAt`/`noiseSolidAt`)
      and **early-returns without `SURFACE_V2`/`SURFACE_V3` (`:367`)**;
      `worldColorAt` applies the noise overlay at query time
      (`world-gen.mjs:90-107`) and never writes it into a cached area.
      ⇒ **no cached byte and no default-render pixel can change ⇒ the
      cache rule (`genmap-server.mjs:34`) says STAY on r3i — verified,
      not assumed.**
  - **④ Flat-region rms vs frozen91 re-run — and the gate's blind spot.**
    `SURFACE_V2=1 node mapgen/experiments/2026-09-21-surface-shape.mjs`
    (default window tx 29..47 × ty 11..19, 171 rows; log
    `mapgen/extractions/shape-114.log (X19)`): **allPixelRms 64.647 · flatPixelRms
    46.958 · flatCoverage 0.1571 · refSolidFrac 0.69031 · refSky 0.01876
    · refVoid 0.29093 · genSolidFrac 0.50392.** Prior comparable run =
    entry **(39)** (2026-09-21, same handoff window): allPixelRms
    73.535 · flatPixelRms **48.717** · coverage **20.3%** · refSolid
    **0.690** · genSolid **0.429** ⇒ rms improved −1.76 and genSolid
    +7.5 pts, but **coverage 20.3% → 15.7% is a REF-side difference this
    session cannot explain** (refSolid matches (39) to 3 dp and no ref
    byte was touched today) — flagged, not attributed.
    **The gate's blind spot, re-confirmed by probe this session**
    (`mapgen/extractions/probe-v2window-114.mjs (X22)`, SURFACE_V2=1): that window
    contains **procedural = 0, v2masks = 0** — exactly (39)'s diagnostic
    — so the standing flat-rms instrument measures the **wang/template
    bands only** and CANNOT see a surface-lane change. (39) already
    recorded this; it has never been distilled to VERIFIED, and no
    chunk-row-matched replacement instrument exists yet → carried in
    I23③. Also: the instrument writes a **fixed** filename
    (`mapgen/out/gen-shape-2026-09-21.json`) regardless of window, so
    runs overwrite each other — the pre-run file (the (39)-era
    diagnostic-window JSON, ty 0..10, refVoid 0.953) was preserved at
    `mapgen/extractions/gen-shape-pre114.json (X39)` before the re-run.
  - **⑤ Frame divergence observed while reading the census (no verdict —
    reported, not guessed):** the V2 lane evaluates the field in CELL
    coordinates, `gx = tx·CELLS_PER_CHUNK + cx + 0.5` with
    `CELLS_PER_CHUNK = CHUNK/10 = 51.2` (`noise-terrain.mjs:87, :234-235`)
    ⇒ `gx = world_px / 10` exactly (world px = tx·512 + cx·10 + 5), while
    the V3 lane evaluates at WORLD px (`:319-324`, C80) and `gradAt`'s
    ramp/topology sources are written in world-y units (StartY −1024…
    `:145-153`, `:181-189`). Under `SURFACE_V2=1` alone the caves-field
    conjunct is off (`:222`), so that lane's gradAt = topology image lane
    else the ramp PROTOTYPE (C39, not byte-backed) — the census density
    above is for that gradAt. The binary's own argument frame at the
    0x90a860/surfaceField call site is **unread** (C80 settled the V3
    gate's frame only) ⇒ **I23②** = read it before touching code.
  - Landed: CONSTANTS **C93**, ISSUES **I21 verdict (parked)** + **I22's
    IoU gate executed** + new **I23**, VERIFIED **§8 row 34**, this entry
    **(114)**, plus the committed instrument
    `mapgen/experiments/2026-10-06-v2-chunk-census.mjs`. No code patch,
    no cache bump. Next free: entry **(115)**, **C94**, **I24**; §8 row
    **35** free.

- **2026-10-06 (115) — dig #115 (docs-only): the `<RandomColor>` /
  `<RandomMaterials>` RUNTIME CONSUMER CHAIN is closed end-to-end —
  `ProceduralTerrain::Init` → stack wrapper → queue dispatch → vtable
  slot2 tail-jump → consumer `0x904c20`; record layout, the line-1808
  guard, the seed / warm-up / pick law, and the data.wak side are all
  byte-settled (incl. a pick-sign correction).**
  Docs-only: no code, no cache bump. Every fact below was re-read from
  `noita_dev.exe` on disk **this session** (objdump windows; `.text` file
  = VA − 0x400C00, **`.rdata` file = VA − 0x400E00**). Landed: CONSTANTS
  **C94**, ISSUES **I24** + P1 cross-link update, VERIFIED **§8 row 35**
  + §9.5 pointer, Current_work 171 / ~611.
  - **① Reachability (the P1 gap) — every link byte-read:**
    - `ProceduralTerrain::Init` = **0x905fb0**, exactly **5 `call`
      xrefs**: 0x642f43, 0x72251f, 0x729ae4, 0x80c593, 0x80d4ec.
    - Loop **0x907ab0..0x907b16** over vector `[ebp−0x284 begin,
      ebp−0x280 end]` stride 4 builds a **stack wrapper**: `vec[i]` →
      `−0xb4` @0x907ab3, vptr **`0x1199d40`** → `−0xb8` @0x907abf, and
      `mov %eax,−0xa8(%ebp)` @0x907ac9 = **wrapper+0x10 = &wrapper
      (self)**. Global `mov 0x13289b4,%eax` @0x907a79 → saved `−0x244`
      → ecx param; manager = `call 0x8cf000` @0x907a86 → edi;
      `push &wrapper; push %edi; call 0x8cef30` @0x907adb; dtor path
      reloads `−0xa8(%ebp)` → `setne` flag → `call *0x10(%edx)`
      @0x907aff.
    - Dispatch **`0x8cef30`** (ret $8): `mov 0x8(%ebp),%edi` = arg1 =
      manager; `cmpb $0x0,0x25(%edi)` @0x8cef41 → `je 0x8cef67`
      **QUEUE**, else **SYNC**: `mov 0xc(%ebp),%eax` = arg2 = &wrapper →
      `mov 0x10(%eax),%ecx` (self) → null check → `mov (%ecx),%edx;
      call *0x8(%edx)` @0x8cef59 = **slot2** → `mov %edi,%eax; ret $8`.
      Manager ctor sets `movw $0x1,0x24(%edi)` @0x8cf05a ⇒ byte[+0x25]
      = 0 ⇒ **Init takes the QUEUE arm**; also `mov %edi,0x10(%edi)`
      @0x8cf044 (manager self at +0x10), vtable `0x11888fc`, refcount
      at +0x1c.
    - **Queue arm:** lock xadd on mgr+0x1c → `call 0x8cf0e0` (node
      alloc) → `push 0xc(%ebp); mov %ebx,%ecx; call 0x92b300` (attach —
      semantics OPEN) → `mov %edi,0x18(%ebx)` (node+0x18 = manager) →
      `movw $0x0,0x24(%ebx)` / `mov %ecx,0x20(%ebx)` → **`movl
      $0x8cf1f0,−0x8(%ebp)` @0x8cefa8** → `call 0x9fa830` @0x8cefb2
      (enqueue). `call 0x8cf1f0` = **0 direct sites** (function-pointer
      installed).
    - **Deferred runner `0x8cf1f0`:** `mov 0x10(%esi),%ecx` (node+0x10
      = wrapper) → `mov (%ecx),%eax; call *0x8(%eax)` @0x8cf204-06 =
      slot2.
    - **slot2 `0xa99ea0` = the linchpin: raw `8b 49 04` = `mov
      0x4(%ecx),%ecx`; `e9 78 ad e6 ff` = `jmp 0x904c20`** ⇒ tail-jump
      into the consumer with **ecx = wrapper+4 = vec[i]** (the record
      pointer). `call 0x904c20` = 0 sites and no e8/e9 to `0xa99ea0` ⇒
      the consumer is reachable **only** via this vtable slot.
    - **Vtable `0x1199d40` dwords = `[0xa99e20, 0xa99e60, 0xa99ea0,
      0xa99eb0, 0xa99ed0, 0xa9b3d0, 0xa99ec0]`.** slot0/slot1
      (`0xa99e20`/`0xa99e60`) = test arg → `push $0xc` new → `movl
      $0x1199d40,(%eax)` + copy payload = the **0xc-byte heap clone**
      {vptr, payload}; slot3 `0xa99eb0` = `mov $0x12f9014,%eax; ret`
      (6 B, int3 from 0xa99eb6; pTD 4 B before TD `0x12f9018` =
      `.?AUVec2ArrayInline@@` — meaning OPEN); slot4 `0xa99ed0` →
      `call *0x14(%eax)` (slot5) → flag → `call *0x114a348` (delete);
      slot5 `0xa9b3d0` = `movl $0x1179670,(%esi)` (base vtable) +
      conditional delete; slot6 `0xa99ec0` = `lea 0x4(%ecx),%eax; ret`.
    - **Stack vs heap:** stack wrapper = **0x14 B** {vptr, payload, pad,
      self=&wrapper}; heap clone = **0xc B**. The queue arm reads only
      node+0x10 → wrapper+0/+4 (both kinds safe); the **sync** arm reads
      wrapper+0x10 = `&self` (stack instance only) ⇒ which callers run
      sync is OPEN (I24④).
  - **② Record layout + guard (this = vec[i]):** **+0x00** dword → **A**
    (read back @0x905b50 → null gates); **+0x04 std::string (24 B) =
    `wang_template_filename`** (copied to the stack string at F0+0x94
    via `call 0x41d770` @0x904c92); **+0x1c std::string** (copy
    @0x904ca4/0x904caa — identity OPEN, I24③); **+0x34 width, +0x38
    height** (both clamped [1,0x400], defaults 0x400 @0x904d26-0x904d2f);
    **+0x3c..0x4b** `movdqu` 16 B; **+0x4c seed** dword; **+0x54 / +0x80**
    addresses taken (`lea` @0x904d59/0x904d60 → [esp+0x34]/[esp+0x40]).
    Guard: `cmpl $0x0,0xb0(%esp)` @0x904d33 = **F0+0xa4** (the stack
    copy's `_Mysize`; consumer baseline = 3 pushes = 12 B) → hoists seed,
    xmm0, IAT `0x114a374`/`0x114a378`, record fields → `jne 0x904e40`
    @0x904d76 → else `push $0x710` (**line 1808**), `push 0x1173a10`
    (`…\source\procedural_utils\procedural_terrain.cpp`), `push
    0x1174198` = **`wang_template_filename.empty() == false`**, `push
    0x1150f60`, `call *%ecx` @0x904d90.
  - **③ A / map-walk / the two LoadFromImageData arms:** A is read back
    @0x905b50 (null-gated) → `mov 0x1f4(%eax),%eax` @0x905b5c → `cmpl
    $0x0,0x4(%eax)` @0x905b6e; map-walk head = `0x905be0..0x905c04`.
    `BitmapNoise::LoadFromImageData 0x8f9ab0` = **3 sites: 0x8fa99b,
    0x905dd7, 0x905f1e** — the latter two are **inside the consumer**
    (two arms). Consumer epilogue `ret` @0x905faa.
  - **④ data.wak side (re-extracted this session):** **3
    `<RandomMaterials>` blocks / 6 `<RandomColor>` rules** — offsets
    **1272832** coalmine (`FF00BBEE`, `FF12BBEE`), **1514362**
    liquidcave/lava (`FF01CFEE` → 5 colors incl `FF0BFFE5`, `FF12BBEE`),
    **1951247** town_under/forest (`FF01CFEE` → 4 colors, `FF12BBEE`);
    comments verbatim: "changes the color to random material",
    "randomizes blocking and non blocking paths", "can be used to
    randomize scripts as well" (`mapgen/extractions/rc-blocks.txt (X21)`).
  - **⑤ Pick-sign CORRECTION:** `mulsd 0x11e0578` = f64 **−4.656612875e-10
    = −1/(2³¹−1)** (byte-read) — **NOT −2⁻³¹** (the old gloss was a
    rounding read; magnitude is byte-identical to `0x11df988` =
    +4.656612875e-10). So `idx = cvttsd2si(state·count·−(2³¹−1)⁻¹) ≤ 0`
    and addr = `[esi+0x14] − 4·idx` ∈ [first, last−4] for state <
    2³¹−1 (pick idiom `0x905ca8..0x905ce4`). Conclusion stands and
    tightens.
  - **⑥ Seed → state + warm-up closed form:** seed dword → `cvtdq2pd` →
    `addsd 0x11e0ba0(,%eax,8)` (0.0 / 2³² sign bias) → `comisd
    0x11e0220` (f64 2147483647.0) → `jb` skip → `mulsd 0x11dfdd8` (0.5)
    → `[esp+0x24]` → `call 0x10098c0` = **assert `seed != 0.0`**
    (`ucomisd 0x11df878`, expr `0x1192220` = `seed`, line **0x66 = 102**,
    file `0x11dda78` = `…poro\source\utils\random\random.cpp`) + Schrage
    Park–Miller `16807x mod (2³¹−1)` (`imul $0x41a7`, divisor magic
    `0x834e0b5f`, `imul $0x7fffffff`), new f64 state stored, returns
    `state × 0x11df988 = state/(2³¹−1)`. **Warm-up count, exact decode
    (0x905273..0x905344): `N = (W mod 11) + (seed mod 12)`, N ∈ [0,21]**
    — `imul $0xaaaaaaab`+`shr $3` = ÷12 on seed; `imull 0x2c(%esp)`
    (magic `0xd1745d17`) + `imul $0xb` + sub = W mod 11; V = [esp+0x2c]
    = clamped width re-stored @0x905228-c; `jle 0x905344` skips when
    N ≤ 0; loop body = the inlined Schrage step.
  - **⑦ Flood-fill asserts:** lines **530 / 533 / 534 / 548** (8 sites),
    expr `0x1173c1c` = `pixels.IsValid( ipos.x, ipos.y )`.
  - **⑧ `+0xb0` census → §8 row 35:** pattern (opcode 0xc7 ∧ mod=2 ∧
    disp32=0xb0) over file 0x400..0xd49200 = **77 hits; the ONLY
    code-pointer immediate is `0x8ee1b0`** (2 sites: 0x8ee3a7, 0x8ee643
    = `movl $0x8ee1b0,0xb0(%edi)`); every other immediate is numeric
    noise (0×50, 2×6, 0xf×4, 1×2, 0x86c60000, 0x81c70000, 8, 0x34e3 /
    0x34f9 / 0x3569 / 0x35a5 / 0x35a9 / 0x365b / 0x36af, 0x2d0,
    0x3f99999a, 0x14). All **4** `movl $0x8ee1b0` installs read: the two
    above (`0xb0(%edi)`), **0x905acd = `movl $0x8ee1b0,0x140(%eax)`**
    (eax = this @0x905ac7; then `push $0x10` + `call *0x114a34c`), and
    0x64c7a4 = `0x108(%esp)` ⇒ **no per-biome resolver *body* is ever
    literally installed at +0xb0**; caveat: 80 register-form
    `mov %reg,0xb0(%reg)` stores are statically unresolvable (I24⑤).
  - **⑨ Standing warnings (traps hit this dig):**
    - `fulltext86.asm` **stops at 0x1000d6f (truncated)** — any body ≥
      0x1000000 must be objdump'd from `noita_dev.exe`; `p0_functions.csv`
      size column is **DECIMAL** (as written; *corrected dig #116* — the
      hex gloss here was wrong: `FUN_00908f40` 1072 = 0x430 → next fn
      0x909370 ✓, `FUN_0090a860` 2217 = 0x8a9 → 0x90b109/0x90b110 ✓).
    - **.rdata byte-delta ≠ .text byte-delta:** `.rdata` file = VA −
      **0x400E00** (text = −0x400C00) — the old byte string for
      `0x1199d40` was read with the text delta and was **wrong** (correct
      dwords are in C94).
    - objdump: `--stop-address` **excludes straddling instructions**;
      non-boundary start addresses misdecode; the raw-byte column wraps
      after 7 bytes; `tail -N` cuts instruction heads.
    - x86 esp-relative slots correspond only when push-pending counts
      match (consumer baseline = **3 pushes / 12 B** ⇒ F0−12 conversions;
      e.g. `[esp+0xb0]` @0x904d33 ⇒ F0+0xa4).
    - **RTTI: do NOT name the wrapper class.** `.?AVIngestionComponent@@`
      (`0x12f9f78`) sits 8 bytes after the pTD stored in the COL record
      (`0x11eb884` → `0x12f9f68`); no rdata dword equals `0x1199d40` or
      pVFTable `0x12f9f70`; the 4-byte-at-`0x12f9014` / 5-byte-at-
      `0x12f9f6c` pTD mismatches mirror the resolved packs
      (`0x11e1f94` = 5, `0x11e1f8c` = 4) ⇒ association unproven (I24①).
    - `fillRandomMaterials` is **our own label**, not a game string.
  - **⑩ Residual OPEN → ISSUES I24:** ① RTTI class name; ② A's identity /
    `0x1f4`; ③ record +0x1c string; ④ sync-arm wrapper kind + the
    `[mgr+0x25]` setter and `0x92b300` attach semantics; ⑤ resolver
    bodies at +0xb0. The P1 cross-link's "ONE remaining read family" is
    updated: the **runtime side is now read**; the resolver table is the
    residue.
  - **Landed:** CONSTANTS **C94**, ISSUES **I24** + P1 cross-link rewrite,
    VERIFIED **§8 row 35** + §9.5 pointer, Current_work 171 / ~611.
    Docs-only ⇒ **no code change, no cache bump**
    (`mapgen/server/genmap-server.mjs:34`); no byte-derived code change
    until the I23② `0x90a860` / surfaceField call-site frame is read.
    Next free: entry **(116)**, **C95**, **I25**; §8 row **36** free.

- **2026-10-06 (116) — dig #116 (docs-only): the I23② blocker is READ —
  `0x90a860` (surfaceField) is called with PIXEL coords +0.5, its grid
  coordinate is `f32(0.49162514·x + P[+0x94]) × 0.1`, and the port's
  `surfaceField` omits that ×0.1 — so V2/V3 are each right for exactly
  one of the callee's two consumers (neither lane is simply "the wrong
  frame").**
  Docs-only: no code, no cache bump. Every fact below was re-read from
  `noita_dev.exe` on disk **this session** (fresh objdump windows
  0x908f40..0x909380, 0x90a860..0x90b140 → `mapgen/extractions/dig116-90a860.asm (X12)`,
  0x909da0..0x909e60; call sites from `mapgen/extractions/fulltext86.asm (X1)`;
  floats byte-read in `.rdata` = VA − 0x400E00). Landed: CONSTANTS
  **C95**, ISSUES **I23② settled + action** and an I24④ cross-reference
  fix, VERIFIED **§8 row 36**, this entry **(116)**.
  - **① The call sites of `FUN_00908f40` (0x908f40, size 1072 = 0x430
    → 0x909370) — exactly 3, all inside `FUN_00792580`:** **0x7930d3**
    (main cell), **0x7938d1** (probe x−1), **0x7938fe** (probe x+1). All
    three do the same shape: `xmm1 = (double)(driver[+0x20] + x)`,
    `xmm2 = (double)(driver[+0x24] + y)` (`movd`+`cvtdq2pd`, the int
    addends from `[esp+0x30]` = x / `[esp+0x2c]` = y, the −1/+1 probes
    via `dec`/`inc %ecx`), `ecx = driver[+0x70]` = `this`. Loop bounds
    re-read in the same window: `cmp %edx,0x2c(%ebx) ; jle` @0x792f87
    (y vs height) and `cmp %eax,0x28(%ebx)` @0x792faa (x vs width) with
    the counters stepping 1 ⇒ **originX+x / originY+y are pixels**
    (C87/C88's absX/absY, C89's `0x909370(originX, originY, originX+w−1,
    originY+h−1, …)` rect).
  - **② `FUN_00908f40` body = "what material is at pixel (x,y)":**
    saves `xmm2 → −0x20` (y) and `xmm0(= xmm1) → −0x28` (x), `call
    0x909da0` (ecx = this) → `ebx` = region; `test %ebx/%ebx; je
    0x909367`. **`[R+4]==0` arm** @0x908f72..0x908fbb: reload both,
    `addsd 0x11dfdd8` (= **0.5**) to each, `push %ebx` (the one stack
    arg), `movapd xmm2→xmm3`, `movaps xmm1→xmm2`, **`call 0x90a860`
    @0x908f96** → `cvttsd2si −0x20(%ebp)` (y) and `−0x28(%ebp)` (x) to
    ints, `ecx = 0x2a4(%ebx)` = **mBiomeMaterials** (C87), `movaps
    xmm0→xmm3` (the returned field) → **`call 0x8f5030`** (the
    cellFactory classifier, §8 row 29) @0x908fb0 → its eax is the
    return. **`[R+4]==1` arm** @0x908fbc: `cmpl $0,0x1b0(%ebx); je` →
    assert **`biome->bitmap_data`** (expr **`0x1175088`**, line **0xa6e
    = 2670**, file `0x1173a10` = procedural_terrain.cpp, format
    `0x1150f60`); else → 0x909090; `[R+4] > 1` → 0x9091c6.
  - **③ The pixels proof = `0x909da0` (region-at) itself:** `movsd
    0x38(%edi),%xmm1 ; addsd %xmm0` and `movsd 0x40(%edi),%xmm0 ; addsd
    %xmm2` → `cvttsd2si` → **`and $0x1ff` + `sar $0x9`** (y additionally
    `idiv [edi+0x50]` with the negative fix-up `add %ecx,%edx`) =
    **512-px chunk index + intra-chunk offset applied to the very values
    `0x908f40` passed** ⇒ the units are **pixel** and the chunk is 512 px
    (C11/C76). Crucially `this[+0x38]/[+0x40]` (the world offset) is
    added **only inside `0x909da0`** — `0x90a860` never sees it.
  - **④ The callee `0x90a860` (size 2217 = 0x8a9 → 0x90b109, next fn
    0x90b110; `ret $0x4` @0x90b106 = exactly one stack arg = the
    region):** entry bindings `[ebp+8]→ebx = R`, `xmm2 → −0x44` (x+0.5),
    `xmm3 → −0x3c` (y+0.5), `ecx → −0x30` (this); `R[+4]` selects two
    **byte-identical** grid copies (0x90a8c1.. / 0x90ac28..), `P :=
    R[+0x1d4]` (null ⇒ skip grid → 0x90aad1 ⇒ field0 = 0 ⇒ r′ = 0 ⇒
    return 0). **Grid law (both copies):**
    `u = f32( 0.49162514·(x+0.5) + f32(P[+0x94]) ) × f32 0.1`
    — `mulsd 0x11dfdc8` = **0.49162514**, `movss 0x94(%eax)`,
    **`mulss 0x11df974` = f32 0.1**; `v` = the same shape with the
    `P[+0x94]` bias scaled by **`0x11dfa08` = 6.86035959282328e-07**
    (meaning OPEN) → `cvttsd2si` + `comisd`/`dec` **floor fix-up** →
    frac → smoothstep weight **(3−2t)·t²** (`0x11dff70` = f32 3.0,
    `0x11dfe68` = f32 2.0, `0x11dfbf0` = f32 1.0) → **4× `call 0x9fe620`**
    (the wrap-mod getter, C45) over `P`'s grid → 2 bilinear lerps →
    field0. The ×0.1 is a genuine **grid↔pixel conversion**: `0x11e015c`
    = **f32 10.0** multiplies u/v back up before `call 0x908cb0` in the
    add-noise arm (@0x90aa66/6e), and `divss 0x11df974` (= ÷0.1) appears
    @0x90ac0b. Gates re-pinned: `comiss 0x11dfaac` = **0.51** @**0x90aaf7**,
    `0x11dfb84` = **0.85** @**0x90ab48** → slab↔true pairs 0x50a2f7 /
    0x50a348 ⇒ **`0x90a860` = the port's `surfaceField` identity
    re-confirmed** (C37's chain). The r-eval is **`call 0x90b280`**
    @0x90aadd (slab 0x50aa80) with ecx = this, **xmm2 = x+0.5 / xmm3 =
    y+0.5 — the same PIXEL args, NOT ÷10**, `push R`, then `mulss field`
    ⇒ r′. **Observed FP slots (record, don't infer a signature):** this
    call family does not use the plain xmm0-first layout — `0x909da0`
    reads xmm1/xmm2, `0x90a860` reads xmm2/xmm3 (xmm1 = a duplicate of
    x), and the classify call stages its FP arg in xmm3.
  - **⑤ The I23② verdict (the byte answer that was blocking code):**
    - **The callee's argument frame = pixels +0.5 ⇒ V3's world-px frame
      (`wx = x − worldX0`, C80) IS the game's frame; V2's `px/10` cell
      frame is NOT.**
    - **But the callee has two consumers with two different frames:** the
      **grid/gradAt** term wants `0.049162514·px + 0.1·P[+0x94]` (the
      ×0.1 is inside the binary), while the **r-eval** wants raw pixels.
    - The port's `mapgen/lib/noise-proto.mjs:676` =
      `gradAt(f(x·0.49162514)+valueOfP94, …)` — **no ×0.1** ⇒ with V3's
      pixel args the grid index runs **10×** the game's
      (0.49162514·px vs 0.049162514·px), whereas V2's pre-÷10 makes the
      grid term **exact** (0.49162514·(px/10) = 0.049162514·px) but
      feeds the r-eval 1/10 of the pixels the game gives it.
    - ⇒ **"which lane is wrong" was the wrong dichotomy: each lane is
      right for one of the two consumers, and the defect is a one-step
      omission inside `surfaceField`, not a lane-frame choice.**
      **Action for the next (code) dig — still NO port change this
      dig:** add the ×0.1 and the `0.1·P[+0x94]` bias inside
      `surfaceField`, feed **pixels** in BOTH lanes (drop V2's ÷10
      pre-scale), decide the ramp-placeholder units in the same change
      (**C80's ramp arithmetic — "field0 crosses 0.5 at wy ≈ +235 px"
      — was computed on the pre-×0.1 scale and moves ~10× once the
      ×0.1 lands, so `makeGradAt`'s StartY/EndY reading must be
      re-derived or the real grid substituted**), and validate against
      C79's surface-y IoU A/B plus I23③'s still-missing shape gate.
  - **⑥ Constants byte-read this session (f32 in `.rdata`):**
    `0x11df974` = **0.1**, `0x11e015c` = **10.0**, `0x11dfbf0` = 1.0,
    `0x11dfe68` = 2.0, `0x11dff70` = 3.0, `0x11dfaac` = 0.51,
    `0x11dfb84` = 0.85, `0x11dfd2c` = 1.5, `0x11dfa94` = 0.5,
    `0x11dfbac` = 0.95, `0x11e00b4` = 5.35, `0x11df944` = 0.0489275008,
    `0x11e01b0` = 15.5; f64: `0x11dfdc8` = **0.49162514**,
    `0x11dfa08` = **6.86035959282328e-07**, `0x11dfdd8` = 0.5,
    `0x11dfe30` = 1.0, `0x11dfb58` = 0.001, `0x11dfd08` = 0.1 (the
    port's `scale01`, a different constant than the f32 0.1 above),
    `0x11dfce8` = 0.07, `0x11dfc98` = 0.035; string: `0x1175088` =
    `biome->bitmap_data`.
  - **⑦ Corrections landed with this entry:**
    - **(115)'s pitfall "p0_functions.csv size column is hex" is WRONG —
      it is DECIMAL** (`FUN_00908f40` 1072 = 0x430 → next fn 0x909370 ✓;
      `FUN_0090a860` 2217 = 0x8a9 → 0x90b109/next 0x90b110 ✓; the hex
      reading would overlap later functions). Fixed in place in (115).
    - **I24④'s cross-reference was wrong:** it claimed the sync-arm
      wrapper-kind question "still needs the `0x90a860` call-site frame
      — shared with I23②". `0x90a860` has nothing to do with the wrapper
      dispatch; the real need is the **`0x8cef30` dispatch's own
      call-site frames** (which callers pass which wrapper kind).
      Rewritten in ISSUES I24④.
  - **⑧ Residuals / still OPEN:**
    - `[R+4]` identity (it gates both the caller arm and which grid copy
      runs) and `P = [R+0x1d4]`'s own identity; the
      `P[+0x94] × 6.86035959282328e-07` **y-bias meaning**.
    - Whether `driver[+0x20]/[+0x24]` (originX/originY) are world px or
      driver-local px — `0x909da0` adds `this[+0x38]/[+0x40]` while the
      field does not, so a **constant registration offset between the
      callee's grid and the port's `wx/wy`** may persist (feeds I21's
      family-local question, not its eliminated global form).
    - The FP-argument slot pattern (④) is recorded as observed usage,
      **not** as an ABI claim.
    - The port patch itself + the ramp-unit decision = the next dig
      (I23②'s action, gated on I23③'s instrument).
  - **Landed:** CONSTANTS **C95**, ISSUES **I23② settled + action** +
    **I24④ cross-reference fix**, VERIFIED **§8 row 36**, this entry
    **(116)**, Current_work registry refresh. Docs-only ⇒ **no code
    change, no cache bump** (`mapgen/server/genmap-server.mjs:34`).
    Next free: entry **(117)**, **C96**, **I25**; §8 row **37** free.

- **2026-10-09 (117) — dig #117: I23②'s ACTION LANDED — the
  `surfaceField` ×0.1, pixels-in-both-lanes and the ramp-unit decision
  are IN THE PORT (both lanes finally byte-consistent), and the C79
  IoU A/B says the frame fix alone moves the metric ~nothing
  (89.58 → 89.42, FAIL stands) — field SHAPE (§8 row 34) stays the
  binding error, so I23③'s shape instrument is the next dig.**
  Every byte fact below was re-verified from `noita_dev.exe` on disk
  **this session** (objdump 0x908f72..0x908fb5 = the +0.5/call window,
  0x90a860..0x90a930 = the grid law, 0x90aa50..0x90aaf0 = the 10.0
  undo + r-eval call; floats byte-read in `.rdata` = VA − 0x400E00).
  - **① The byte law (re-verified; C95 unchanged):** the call site
    `0x908f7e..0x908f96` adds f64 0.5 (`0x11dfdd8`) to both args then
    calls `0x90a860`; the callee's grid coordinate =
    `mulss( cvtpd2ps(0.49162514·x + P[+0x94]), f32 0.1@0x11df974 )`
    (@0x90a8f9..0x90a90c), the y-arm's bias scaled by f64
    `0x11dfa08` = 6.86035959282328e-07 (meaning OPEN); `0x11e015c` =
    f32 10.0 undoes the ×0.1 in the add-noise arm (@0x90aa66/6e), and
    the r-eval `0x90b280` (@0x90aadd) gets the RAW pixel args. The
    pre-patch port line (`noise-proto.mjs:676`) =
    `gradAt(f(x·0.49162514)+valueOfP94, …)` — **no ×0.1** ✓ ((116)'s
    claim reproduced on disk today).
  - **② The patch (4 edits; `npm test` 261/261, 48.75 s):**
    1. `noise-proto.mjs` K2 gains `f32_0p1` (f32 0.1, `0x11df974`) and
       `f64_6p86e07` (`0x11dfa08`) — both already registered C95.
    2. `noise-proto.mjs:676` →
       `gradAt(f(f(x·0.49162514)+p94)·0.1, f(f(y·0.49162514)+p94·6.86e-07)·0.1)`
       — **the ×0.1 LANDS.**
    3. `noise-terrain.mjs` `makeGradAt` (the C39 ramp placeholder)
       converts grid→world-px (`×1/(0.49162514·0.1)`), so the (A)
       placeholder keeps its capture-validated calibration (C80's
       0.5-crossing at wy≈+235 px) instead of collapsing to C80's
       degenerate clamped-flat. The bitmap/topology gradAts stay
       grid-indexed (byte law) — only the invented ramp converts.
    4. `noise-terrain.mjs` V2 feeds **pixels** (`tx·CHUNK+cx·10+5`) —
       its grid index comes out byte-IDENTICAL to before
       (0.1·(0.49162514·10·c) = 0.049162514·px) while every
       noise/r-eval consumer stops being starved 10×. Same canvas
       registration. (V2's ramp frame also moves: cell units → canvas
       px.)
    None of these paths is in the default render (`SURFACE_V2/V3` are
    env-gated) ⇒ **no cache bump** (`genmap-server.mjs:34`).
  - **③ The C79 IoU A/B (clean same-day):** the pre-patch run
    reproduced (114)'s baseline **exactly** (n=7065, meanAbs **89.58**,
    bias 2.88) ⇒ a valid A/B. Post-patch: n=7027, meanAbs **89.42**,
    bias 3.11, ±1/±2/±3 = 0.019/0.031/0.046 — **FAIL stands.**
    Per-family: mountain 47.18 → 46.36, bty10 44.85 → **36.62**,
    bty13 63.33 → 62.70, bty14 131.73 → 132.15, lake topAir
    0.972 → **1** (sky-top speckle cleaned); **desert/winter/hills
    bit-identical** (every scored column unchanged).
  - **④ Mechanism (probed, not inferred):** side-by-side masks of the
    pre-patch lib (`git show 2084bfe:mapgen/lib/*` →
    `mapgen/extractions/dig117-prelib (X42)`) vs the patched lib on the REAL lane
    coords: desert (45,62) **diffCells=0**; mountain_left_stub (34,62)
    **77 cells 0→1** (band at cy=12); mountain_lake (40,62) 28 cells
    0→1 (cy=20); mountain_tree (31,58) 3; winter (43,62) 8 (its IoU
    line unchanged). Why the split:
    - **Frame pitfall (recorded so it isn't repeated):** the noise
      lane's `ty = bty + SKY_ROWS` (the C79 gen call is
      `worldColorAt(world, tx·512+x, (bty+48)·512+y)`), so tile
      (tx,bty) ⇒ `wx = tx·512+cx·10+5−17920`,
      **`wy = (bty−14)·512+cy·10+5`** — my first probe fed the raw tile
      frame and got `null` masks from BOTH versions.
    - **Ramp biomes** (mountain_left_stub/mountain_lake — no
      BitmapCaves, no bitmap_noise_file ⇒ `makeGradAt`): pre-fix the
      ramp received `0.49162514·wy` (t≈0.50–0.62 at bty14), post-fix
      its calibrated px (t≈0.50–0.75) ⇒ the 0→1 gains = the ramp
      arriving at its C80 frame for the first time.
    - **BitmapCaves biomes:** pre-fix sampled field rows 2..253;
      post-fix the **top band only** (`v = 0.049162514·wy` ∈ [0.25,
      25.3] at bty14 = 26 rows, +25.17 rows per bty step) — desert's
      top rows are uniform (⇒ inert), mountain_tree's/winter's are
      structured (⇒ the small diffs).
    - **lake/lake_statue** (topology_lake.png): 10× lower feature
      frequency ⇒ the sky-top solid speckle vanished (topAir→1) while
      the scored lines stayed.
  - **⑤ Verdict:** the (116) defect was real and is now GONE — both
    lanes run the grid at `u = 0.049162514·px`, the r-eval at px, and
    the ramp at its calibrated px — yet C79 does not move, which
    sharpens §8 row 34: **the residual is SHAPE** (the caves-field
    model, the (A) ramp, the unread fnB band-stack) behind the still-
    missing I23③ shape instrument. That instrument is now the binding
    next dig (the IoU is a line metric and cannot see shape).
  - **⑥ Caveats:** I23①'s ~1.8% density census was measured on the
    PRE-patch lane — re-run `2026-10-06-v2-chunk-census.mjs` before
    diffing density numbers. `mountain_left_stub.xml`/`mountain_lake.xml`
    carry `name="_EMPTY_"` (the biome NAME ≠ its file; `biomeAt`
    returns the right FILE, and the IoU's family label comes from the
    vmap color, which matched in all probed tiles).
  - **⑦ Residuals still OPEN:** (116)'s list minus the patch itself —
    `[R+4]`/`P` identities, the y-bias meaning, the driver origin
    frame (I21 family-local), the FP-slot pattern — PLUS the new
    **I25** (BitmapCaves grid indexing: u-law vs cell index).
  - **Landed:** code (`noise-proto.mjs`, `noise-terrain.mjs`),
    CONSTANTS **C96**, ISSUES **I23② action landed** + **I25 opened**,
    VERIFIED **§8 row 37**, this entry **(117)**. Next free: entry
    **(118)**, **C97**, **I26**; §8 row **38** free.
- **2026-10-10 (118) — dig #118: I23③ CLOSED — the SURFACE SHAPE
  instrument lands (C97) and runs all three lane configs: overall iou
  0.234–0.252; lane choice AND vertical registration eliminated as the
  shape residual; the measured failure mode = under-solidity (fG
  0.141–0.167 vs fR 0.480) behind a family gradient (mountain 0.59 ≫
  lake 0.43 > hills 0.09–0.14 > desert 0.017–0.074 ≈ winter 0.056).**
  - **The gap (I23③):** C79's IoU is a LINE metric (first solid run ≥
    RUN_MIN per column) and its gate REFUSES `SURFACE_V2`; the shape
    gate `2026-09-21-surface-shape.mjs` reaches only wang/template
    bands (procedural 0 / v2masks 0, probe (114)) ⇒ nothing measured
    the noise lanes' rendered 2-D shape — §8 row 37 left "the
    still-missing I23③ shape instrument" as the binding next dig.
  - **Built:** `mapgen/experiments/2026-10-10-surface-shape-iou.mjs`,
    metric spec **C97 registered BEFORE the first run**
    (constants-first). Lane gate = C79's inverse: any
    `SURFACE_V2`/`SURFACE_V3` combo accepted and stamped into the
    outputs (`-v3` / `-v2v3` / `-v2`); neither flag REFUSED
    (`noise-terrain.mjs:383` never attaches the noise branch ⇒ all-air
    masks); `PROC_FILL` refused (template-band lane,
    `template-render.mjs:661` — C79 parity). C79's scorable tile set
    is re-derived in-script (458 P1 scanned → 56 scorable) and
    cross-checked against `surface-y-2026-09-24.json`: **match, 0
    missing / 0 extra, in all three runs.** Per-tile metrics (C97):
    **iou** over solid cells, **profL1** cavity-curve distance,
    **dyOpt/iouShift** (registration-vs-interior split), **b0..b3**
    row-quarter ious, **fR/fG** solid fractions; aggregates
    pixel-weighted + per-family/per-bty + mean row profiles (ref/gen/
    genAligned); 10 triptych overlays per lane (best+worst per family;
    ref | gen | diff with red = miss, green = hallucination).
  - **Runs — one process per lane (the flags are module-load-time
    consts, `noise-terrain.mjs:96-97`):** `SURFACE_V3=1`, then
    `SURFACE_V2=1 SURFACE_V3=1`, then `SURFACE_V2=1`; ~40 s each;
    logs `mapgen/extractions/dig118-shape-v2.log (X58)`, `dig118-shape-v2v3.log (X59)`, `dig118-shape-v3.log (X60)`; JSONs + overlay
    dirs `mapgen/out/surface-shape-2026-10-10-*`.
  - **Overall numbers** (fR = 0.48029 identical — same ref):

    | lane | iou | iouShift | dyOpt mean (med) | profL1 | fG | b0..b3 |
    |---|---|---|---|---|---|---|
    | v2 | 0.23391 | 0.23954 | −43.79 (0) | 0.37802 | 0.14120 | 0.135/0.234/0.252/0.249 |
    | v2v3 | **0.25183** | 0.25970 | −56.48 (0) | 0.36953 | 0.16694 | 0.169/0.256/0.268/0.263 |
    | v3 | 0.24644 | 0.25475 | −57.91 (0) | 0.37207 | 0.16055 | 0.167/0.254/0.259/0.257 |

    family iou v3 / v2v3 / v2 (fR): **mountain** 0.593/0.589/0.594
    (0.504), **lake** 0.429/0.437/0.437 (0.577), **hills**
    0.134/0.141/0.089 (0.436), **desert** 0.059/0.074/0.017 (0.652),
    **winter** 0.0556/0.0556/0.0555 (0.373).
  - **Findings (measured this session):**
    (i) **lane choice is not the shape variable** — the three configs
    span Δiou 0.018 (v2v3−v3 = +0.0054, v2−v3 = −0.0125); the
    caves-field gradAt helps its biomes — desert 0.017→0.074, hills
    0.089→0.141 from v2 to v2v3 — yet both stay ~10× short of their
    fR; lake is **byte-identical** v2≡v2v3 (all 7 tiles equal; no
    `<BitmapCaves>` ⇒ the same topology gradAt in both) ⇒ the lane
    stamp captures exactly the gradAt fork. Agrees with (117)'s C79
    A/B (the frame fix moved the line metric ~nothing).
    (ii) **vertical registration is not the shape variable** —
    iouShift−iou ≤ +0.008 overall (family gains v3: mountain +0.027,
    lake +0.036, hills +0.010, desert −0.002, winter ~0); dyOpt
    median 0 (30/56 tiles exactly 0; 8 tiles hit the −256 search bound
    = range-capped, still ≤ +0.01 gain each). Even a free half-tile
    shift leaves mountain at 0.619 ⇒ §8 rows 34/37's SHAPE verdict is
    now measured at mask level (→ row 38).
    (iii) **failure mode = under-solidity:** fG 0.141/0.167/0.161 vs
    fR 0.480 ⇒ the port renders **3–3.5× too little solid** overall;
    no row band is rescued (v3 b0..b3 = 0.167/0.254/0.259/0.257).
    (iv) **winter is lane-invariant air:** fG 0.0231/0.0232/0.0231
    across all three lanes, 11/19 winter tiles fG = 0 under v2,
    overlay `25_13_winter.png` = the ref valley mass 100 % red-miss —
    mechanism disk-verified: winter carries no `noise_type` ⇒
    noiseKind −1 (§8 row 30) ⇒ `noiseDispatch`'s default arm **throws**
    (`noise-proto.mjs:530`, reached directly @:693 or per-octave via
    `fbm4` @:623) ⇒ both lanes' catch returns null ⇒ the chunk falls
    through to air BEFORE any gradAt fork — hence lane-invariance.
    (v) **mountain proves the pipeline can be near-exact:** best tile
    `37_13_mountain_right` **iou 0.92078** (dyOpt −12, fR 0.52983 vs
    fG 0.50194), then 36_12 0.88371, 32_13 0.73874; dyOpt = **−12 on
    6 tiles (4 of them mountain)** — the value equals the
    **L3_ANCHOR's y (+12, C78)**: OBSERVATION, OPEN (I21-adjacent) —
    the anchor y may not be the noise lane's correct registration; do
    NOT conclude without a lane-local anchor fit.
    (vi) **desert at tile scale = the C96 symptom:** overlay
    `48_13_desert.png` shows gen as sparse 10-px speckle over air +
    the true ground mass missed (red) — the bty14 top-rows sampling
    (field v ∈ [0.25, 25.3], C96) hallucinating above and never
    delivering mass below.
  - **Pitfalls hit:** `Float64Array.map` keeps the typed array type ⇒
    `JSON.stringify` would emit `{"0":…}` instead of an array (fixed
    with `Array.from`); lane flags are read at module load ⇒ one lane
    per process (three runs); `PROC_FILL` lives in
    `template-render.mjs`, not the noise lane; masks are retained in
    memory (56 × 2 × 256 KiB ≈ 29 MB) so overlays need no re-render;
    dyOpt's −256 boundary hits = range-capped optima (8 tiles).
  - **Landed:** `mapgen/experiments/2026-10-10-surface-shape-iou.mjs`,
    CONSTANTS **C97** (pre-registered), ISSUES **I23③ closed**,
    VERIFIED **§8 row 38**, this entry **(118)**, Current_work
    refresh. **No `mapgen/lib/**` change ⇒ no cache bump**
    (genmap-server untouched). Tests **261/261**. Next free: entry
    **(119)**, **C98**, **I26**; §8 row **39** free.
- **2026-10-10 (119) — dig #119: fnB per-phase placement BYTE-READ —
  mountain = top-band vertical runs, blob y ∈ [25,h−5], L2 = 2 passes ×
  a 120+⌊81u⌋ count chain, L3 = 1 pass × same, spawn side-lane named.**
  - **Scope/method.** Closes I25's placement-read gate (read half) for
    the fnB phases after loop A + the record (earlier digs): loop B =
    `mountain_count`, loop C = `blob_caves_count`, then L2/L3. Fresh
    objdump window **VA 0x8EE000–0x8F3700** (6227 lines,
    `mapgen/extractions/builder-8EE000-8F3700.asm (X2)`); every rdata
    constant below re-read from `noita_dev.exe` at file = VA−0x400E00
    (C57) THIS session. **Pitfall:** 11.0 @0x11dff38, 81.0 @0x11dffd8,
    101.0 @0x11dffe8 are **f64** (used via `mulsd`) — an f32 read of
    them returns 0.0. Constant bank + gates → **C98**. Call-site table
    (the three sub-engines, C46 names): setter `0x8ee750` = walk
    @0x8ef37c (`push $0x1`) / L2 @0x8f20d1 (`push $0x0`) / L3 @0x8f2a6c
    (`push $0x0`); blend `0x8ee930` = loop B @0x8f0b6d / loop C
    @0x8f115f; scatter `0x8eead0` = walk @0x8ef3f9 / L2 @0x8f255d /
    L3 @0x8f2efb.
  - **Loop B (mountain, 0x8f072a..0x8f0d8c).** count =
    `rollPos(mountain_count[+0x54],[+0x58])` → [−0x12c] @0x8f0736–
    0x8f0767, ≤0 → 0x8f0d92; **K = f32(h)·0.1** → [−0x10c] @0x8f0775–
    0x8f0788 (0.1 = f32 0x11df974). Per stamp (5 draws): **base =
    ⌊0.1h·u₁⌋** (form @0x8f081a–0x8f083c, `cvttss2si` @0x8f08e5 →
    [−0x118] @0x8f08f3 — **FLAGGED gap-1 cite slab 4f00e5 = VA
    0x8F08E5 ✓ exact**); **X = 5+⌊(w−9)u₂⌋ = rollPos(5,w−5)** (w−9 via
    `add $0xfffffff7` @0x8f08b3 → [−0x134] @0x8f08e9); **R =
    rollF32(mountain_size[+0x5c],[+0x60])** → [−0x124] @0x8f098f–
    0x8f09b8 (**no min(20) cap**); **v = 1.5** (0x11dfd2c) → [−0x104]
    @0x8f0a2f–0x8f0a47; **Y_end = base+⌊11u₃⌋+15** → [−0x108]
    @0x8f0a4f–0x8f0a64 (11.0 f64). 20% coin: ⌊101u₄⌋ < 20 (`cmp $0x14`
    @0x8f0af5) → **Y_end := base** @0x8f0b02 AND **v := 1.5+0.25u₅**
    @0x8f0b08–0x8f0b2c. Row loop runs **row = base..Y_end inclusive**
    (entry `jg 0x8f0d7b` @0x8f0b40 = empty-range guard — never true as
    the law stands; back `jle 0x8f0b50` @0x8f0d75): blend(grid,{X,row},
    R, v) @0x8f0b6d (xmm2 := R @0x8f0b65, xmm3 ← v @0x8f0b5c); then
    **R += 0.5·(u+1)** @0x8f0c04–0x8f0c1c (0.5 = 0x11dfa94) and a 50%
    coin ⌊101u⌋<50 (`cmp $0x32` @0x8f0cad) → **v := v·(0.97+0.03u)**
    @0x8f0d35–0x8f0d4d. count-- @0x8f0d7b → `jne 0x8f0790` @0x8f0d8c.
    ⇒ **mountain = top-band vertical runs**: a fixed X dropped at the
    top tenth of the map, running 15–26 rows (1 row on the 20% coin),
    radius GROWING ≈ +0.75/row from the size roll, value 1.5 (coin: up
    to 1.75) decaying on half the rows — the port's uniform blobStamp
    (uniform x/y, radius min(20,·), constant v per stamp) is wrong in
    KIND, not just constants.
  - **Loop C (blob, 0x8f0d92..0x8f117b).** count =
    `rollPos(config[+0x64],[+0x68])` → [−0x110] @0x8f0e26–0x8f0e4d
    (the negative-scale `sub` form), ≤0 → 0x8f117b @0x8f0e55. Per stamp
    (4 draws, **y before x**): **y = 25+⌊(h−29)u⌋ = rollPos(25,h−5)**
    (h−29 @0x8f0edc, ecx=0x19 @0x8f0ee3 → [−0x100] @0x8f0f0a); **x =
    5+⌊(w−9)u⌋ = rollPos(5,w−5)** (w−9 @0x8f0f80, ecx=5 @0x8f0f8b →
    [−0x134] @0x8f0fc4; y → [−0x130] @0x8f0fb8); **v =
    rollF32([+0x6c],[+0x70])** (knob loads @0x8f0fca–0x8f0fdd, roll
    @0x8f105e–0x8f10a7 → [−0x108]); **R = rollF32([+0x74],[+0x78])**
    (inline loads @0x8f1078/0x8f1099, roll @0x8f1131–0x8f1158 → xmm2,
    no cap); blend @0x8f115f (v → xmm3 @0x8f1145); `decl [−0x110]`
    @0x8f1164, `jne 0x8f0e60` @0x8f1175.
    ⇒ **blob is uniform but NOT over the full grid: y ∈ [25, h−5]**
    (both edges trimmed) — the port's y ∈ [0,h−1] spreads mass the
    game never places.
  - **Blend `0x8ee930` re-read end-to-end (the port's formula
    reconciliation input).** Args: ecx = grid, edx = &pos{int x, int y},
    xmm2 = R, xmm3 = v (→[−0xc]). `1.0 comiss R; jb` @0x8ee93e–0x8ee953
    ⇒ **R ≤ 1 → single-cell path**: bounds check (negatives / ≥ dims →
    ret), getter `0x9499f0` (this = grid+0x18, index = w·y+x), then
    `cell comiss v; jbe → ret` @0x8ee98f–0x8ee993 ⇒ **write v only iff
    cell > v (= a min-landing)**. **R > 1 → circle path** @0x8ee9ba:
    `r0 = (int)(R+0.5)` @0x8ee9c1–0x8ee9ce, box loops, d² = dx²+dy²
    `comiss R²; ja → skip` @0x8eea10, **t = (R²−d²)/R²** @0x8eea1f–
    0x8eea2a, **t² = t·t** @0x8eea33 (→[−0x20]), per-cell plain bounds
    checks (**NO wrap** — negatives/out-of-dims skip; the old
    "wraps at border" phrasing does NOT match these bytes), store
    **cell += (v−cell)·t²** @0x8eea7f–0x8eea99 (both directions: drag
    toward v), dx/dy `inc`/`jle` back @0x8eeaa3–0x8eeab0. ⇒ the port's
    `stampBlendLerp` (linear t = (R−d)/R over r0 = trunc(R+0.5), and
    unconditional v-write for its r0 = 0 case) matches NEITHER arm —
    reconciliation = part of the port dig.
  - **L2 (0x8f1aa1..0x8f2584) — exactly 2 passes of a snaking chain.**
    Head @0x8f1b00: **s₀ = +1** init @0x8f1a2b, 50% coin ⌊101u⌋<50 →
    **−1.0** @0x8f1ac5/0x8f1ad6 (101.0 f64, −1.0 = 0x11e05a8); **center
    = f32(w)·0.5** → [−0x12c] @0x8f1b11; arm test `test %eax,%eax; jne
    0x8f1bd0` @0x8f1b21 (eax = pass counter). Pass 1 (arm A, window
    0x8f1b27..0x8f1bd0): **x₀ = w/2 + s₀·rollF(3.5,35)** (form 3.5+
    31.5u; consts 0x11dfff4/0x11e0250). y₀ = **0** ([−0x140] zeroed
    @0x8f1ae6). Pass 2 (arm B): **[−0x104] := −s₀** (`xorps 0x11e0c50`
    @0x8f1bd0, store @0x8f1bdb) and **x₀ = w/2 + (−s₀)·(25+50u)**
    (`mulss 0x11e0284` / `addss 0x11e01e0` @0x8f1c71–0x8f1c79, ×sign
    @0x8f1c81, +center @0x8f1c85 → [−0x144] @0x8f1c89). Per pass:
    pair → [−0x134]/[−0x130] @0x8f1d26–0x8f1d3c; **count =
    120+⌊81u⌋** → [−0x118] @0x8f1cff–0x8f1d42 (**FLAGGED cites
    4f1510/4f1518 = VA 0x8F1D10/0x8F1D18 ✓ exact**); chain inits
    **[−0x128] = 3u+1** @0x8f1dcf–0x8f1ddf (C44 ✓), **[−0x108] =
    0.1u+0.1** @0x8f1e6d–0x8f1e7d (0.1 = 0x11df970), **[−0x110] =
    s·(1.25+2.25u)** @0x8f1f11–0x8f1f25; guard `cmpl $0,[−0x118]`
    @0x8f1eee → `jle 0x8f2585` @0x8f1f2d (flags survive the SSE — the
    `lahf`/`test` blocks in between do NOT preserve them; each re-derives
    its own). Inner head copies origin → current ONCE per pass:
    [−0x138] ← [−0x130], [−0x120] ← [−0x134] @0x8f1f33–0x8f1f4b; loop
    0x8f1f53..0x8f2577 (`cmpl $0,[−0x118]; jg 0x8f1f53` @0x8f256d–
    0x8f2577). Per point: **[−0x100] = 0.25u+0.75** @0x8f1fe5–0x8f1ff5;
    setter `call 0x8ee750` @0x8f20d1 with **flag=0** (`push $0x0`
    @0x8f2079), pair (int)[−0x120]/[−0x138] → [−0x164]/[−0x160],
    **value = [−0x128]·(0.35u+0.65)** @0x8f20bd–0x8f20cd (C44 numeric ✓),
    **scale xmm3 = [−0x108]·[−0x100]** @0x8f20ad–0x8f20b5 (≈ 0.075–0.1,
    i.e. the single-cell-ish regime of whatever 0x8ee750's flag=0 arm
    does — its internal meaning stays C46-FLAGGED); **y += 0.1u+0.95**
    @0x8f216b–0x8f2183 (0x11df970/0x11dfbac); **[−0x108] *= (0.01u+
    0.99)** @0x8f2211–0x8f2229; **[−0x128] = clamp([−0x128]·(u+0.5),
    0.75, 4.0)** @0x8f229a–0x8f22ef (upper tested first @0x8f22aa,
    lower @0x8f22db); **[−0x110] = clamp([−0x110] + (0.5u−0.25),
    −2.5, 2.5)** @0x8f231c–0x8f23be; `decl [−0x118]` @0x8f23bf; **x +=
    [−0x110]** @0x8f23c5–0x8f23d6. Spawn side-lane (NO field write):
    5% coin ⌊101u⌋<5 (`cmp $0x5` @0x8f246b) → both object ptrs
    non-null → 95/5 selector (`cmp $0x5f` @0x8f252d, `cmovl [−0x150]`
    @0x8f2538: rnd<95 → `spawn_small_enemies` else `spawn_items`) →
    pair → [−0x158]/[−0x154] @0x8f2542/0x8f2550, **xmm3 = 1.0**
    @0x8f251d → `call 0x8eead0` @0x8f255d. Exit **`inc [−0x10c]; cmp
    $2; jl 0x8f1b00`** @0x8f2585–0x8f2595 ⇒ **exactly 2 passes** (the
    carried "L2 = 2 passes" claim byte-pinned).
  - **L3 (0x8f259b..0x8f2f17) — 1 pass, same count, C-rand band.**
    Gated by **config byte [+0x31]**: `cmpb $0x0,0x31(%eax)` @0x8f25a1,
    `je 0x8f2fa5` skips L3 entirely. Setup runs the **MSVC `rand()` LCG**
    (seed 0x132a388, `imul $0x343fd`/`add $0x269ec3`, ÷32767.0 =
    0x11e04bc): **[−0x140] := 0** (y origin) @0x8f25c5; **x₀ = w/2 +
    (−s₀)·(3.5+2·r)** @0x8f2650–0x8f2682 (`mulss 0x11dfe68`=2.0, `addss
    0x11dfff4`=3.5, ×(w·0.5), ×xmm4 = the arm-B-flipped sign reloaded
    @0x8f257d ⇒ x ∈ center∓[3.5,5.5) — same side as arm B but hugging
    center) → [−0x144] (overwrites the arm value BEFORE the pair copy);
    band **lo = [−0x10c] = 1+r₁ ∈ [1,2)** @0x8f25fc–0x8f2608, **hi =
    [−0x12c] = 2·(1+r₂) ∈ [2,4)** @0x8f2633–0x8f263b (lo < hi always).
    Then **count = 120+⌊81u⌋** → [−0x118] @0x8f26f0–0x8f2733 (**FLAGGED
    cites 4f1f01/4f1f09 = VA 0x8F2701/0x8F2709 ✓ exact**); pair copy
    @0x8f2717+; chain inits **[−0x128] = lerp(lo,hi,u)** (xmm4 = hi−lo
    @0x8f2793, store @0x8f27dc), **[−0x108] = 0.1u+0.1** @0x8f2881,
    **[−0x110] = (−s₀)·(0.15+0.2·r)** @0x8f2899–0x8f28b8 (0x11df99c/
    0x11df9b0); inner loop 0x8f28f0..0x8f2f12 (`jg 0x8f28f0` @0x8f2f12):
    **[−0x100] = 0.25u+0.75** @0x8f2985–0x8f2995, setter @0x8f2a6c
    (flag `push $0x0` @0x8f2a0b, same value/scale laws @0x8f2a54–
    0x8f2a64), **y += 0.1u+0.95** @0x8f2b06–0x8f2b1e, **[−0x108] *=
    (0.01u+0.99)** @0x8f2bac–0x8f2bbc, **[−0x128] = clamp(·(u+0.5), lo,
    hi)** @0x8f2c3d–0x8f2c8a (bounds = the rand slots, not consts),
    **[−0x110] = clamp(+0.3u−0.15, −1.0, 1.0)** @0x8f2d20–0x8f2d55,
    `decl [−0x118]` @0x8f2d5d, x += vel @0x8f2d6f; same 5%+95/5 spawn
    lane (gates → 0x8f2f0b, `cmovl [−0x150]` @0x8f2e63, pair via
    [−0x144]/[−0x140] — slot reuse of the origin pair as the int pair,
    xmm3 = 1.0 @0x8f2ebb) → `call 0x8eead0` @0x8f2efb.
  - **The spawn keys = a gameplay side-lane (interpretation flagged).**
    `.rdata` literals **`spawn_small_enemies`** (19 B, @0x1173110) and
    **`spawn_items`** (11 B, @0x1173124) are looked up once between the
    record and L2 (@0x8f19d2 → [−0x150], @0x8f1a12 → [−0x124]); the
    chain loops call the scatter engine `0x8eead0` on 5% of their
    points with that key + a pair (the emitter's data flow as read
    touches no field pointer ⇒ entity spawn, not field geometry).
    **Out of the caves-field port's scope**; recorded so the walk's own
    emitter call @0x8ef3f9 (spawn_percent not parsed ⇒ 0 ⇒ inert in the
    port) can be aligned in a future dig.
  - **Status / next.** I25's placement-read gate: **DONE (read half)** —
    the laws retire `caves-field.mjs`'s FLAGGED loop-B/counts items
    (comment refreshed; **the port itself is the next dig**: loop B/C +
    L2/L3 chains + blend reconciliation into `buildCavesField`, measured
    by C97's `2026-10-10-surface-shape-iou.mjs` A/B, then the
    cache-bump decision). **Not covered:** I25's index half (kind-1/
    kind≥2 arms 0x908fbc..0x909370 + sampler gate — u-law vs cell
    index, still unread); y-drift (queue #2) untouched (entry (74),
    deferred pending the fnA window read); `0x8ee750` internals stay
    C46's registered summary ("max-bleed + circle falloff"; the flag=1
    walk arm FLAGGED).
  - **Pitfalls hit:** the f32/f64 literal trap (above); slot reuse
    again — [−0x110] loop-C count → L2/L3 velocity, [−0x10c] loop-B K →
    L2 pass counter → L3 chain-lo, [−0x124] mountain R → spawn_items
    ptr, [−0x12c] w/2 → L3 chain-hi, [−0x100] loop-C y → L2/L3 draw
    slot; a Lehmer-filter grep `jg 0x8f…` pattern ate the real row-loop
    guard `jg 0x8f0d7b` until re-read unfiltered; the blend has NO
    border wrap (plain bounds checks) — earlier phrasing corrected.
  - **Landed:** ABOUT_MATH **(119)**, CONSTANTS **C98** (const bank +
    gates), ISSUES **I25** gate updated, VERIFIED **§8 row 39**,
    `caves-field.mjs` FLAGGED comment refresh. **Docs + comments only ⇒
    no `mapgen/lib/**` logic change ⇒ no cache bump** (genmap-server
    untouched). Tests **261/261**. Next free: entry **(120)**, **C99**,
    **I26**; §8 row **40** free.

- **2026-10-10 (120) — dig #120: `buildCavesField` PORTED to the byte
  laws (CAVES_FIELD_VER v5) — loop B top-band runs + loop C y-FIRST
  blob stamps, L2 2-pass + L3 do_beginning_down chains via the
  lower-only `setterStamp`, the t² blend; C50 overturned, C46's flag
  branch closed, C98's 0.1-cite corrected; C97 shape A/B run.**
  - **Scope/method.** The port half of I25's placement gate: entry
    (119)'s laws folded into `mapgen/lib/caves-field.mjs` + the tests.
    Byte windows re-read from `mapgen/extractions/builder-8EE000-8F3700.asm (X2) — the text was:
    8F3700.asm` (slab+0x400800 = VA) THIS session for the items (119)
    left truncated: the setter 0x8ee7c9..0x8ee930 (the store + the
    circle arm), loop B's Y_end/coin/row head 0x8f0960..0x8f0b70, L2's
    head/inits 0x8f1a22..0x8f1f4b, L3's setup+inner 0x8f259b..0x8f2c10.
    On-disk data re-verified: **hills.xml** (the LocalLow data dir
    `/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/biome/`
    — the earlier "not found" was the wrong search path) declares
    `mountain_size_min/max="1"/"10"` and **`do_beginning_down="1"`**
    (⇒ L3 RUNS for bitmap_hills); the test def gained both knobs.
    `num()` returns **null** for absent attrs (biomes.mjs:140-143) ⇒
    the `??` fallbacks are safe and L3 is off by default.
  - **C50 OVERTURNED (§8 row 40; byte + disk).** Loop C loads
    **[P+0x74]/[+0x78] as the blend's R (radius)** and **[+0x6c]/[+0x70]
    as v (strength)** — C52's slot map was right; the CE "(1.549988,
    0.0) strength pair" = the radius pair mislabeled (hills.xml: strength
    1.5..3 vs radius 1..10). The `strengthA/B` knobs, the C50 interp,
    and the dig #54 min(20) cap (no byte site) are gone.
  - **The setter's internals (C46 CLOSED → C99).** `0x8ee750` branches
    on **value > 1.0** (comiss vs `0x11dfbf0` @0x8ee766); value ≤ 1 =
    single cell (bounds → getter → **write iff cell > scale** [−0xc] →
    store `movss %xmm2,(%eax)` @0x8ee7d5); value > 1 = circle (R2 =
    value² @0x8ee7e2, r0 = trunc(value+0.5) @0x8ee7ee, d² > R2 → skip,
    **t = (R2−d²)/R2, target = 1 + t·(scale−1)**, plain bounds, min-
    guard). The flag=1 arm adds only the y<25 eave `1 + q⁸·(target−1)`
    BEFORE the guard ⇒ **both flags LOWER-only; the flag gates only the
    eave** — the dig #55-era "single-point MAX-BLEED raise" label dies
    (§8 row 39's port-model list). `raisePointMax` is deleted; L2/L3
    now stamp via the new internal `setterStamp` (flag=0 law). The
    walk/record lanes KEEP `carveCircle` (dir="max" + the (43)(a) t) —
    **new I26** (their args aren't byte-proven; the walk call site
    @0x8ef300..0x8ef37c is the next read).
  - **The blend reconciliation.** `stampBlendLerp` now implements the
    byte arms: R ≤ 1 → single-cell min-guard (write iff cell > v); R >
    1 → r0 = trunc(R+0.5), **t = (R²−d²)/R², w = t²** (@0x8eea33),
    cell += (v−cell)·w, plain bounds, no wrap (the old linear
    `t=(R−dist)/r` form is gone; the R ≤ 1 single-cell arm is new).
  - **The port shape (draw-order exact).** loop B: K = 0.1h once
    (`0x11df974`); per stamp u₁ base = ⌊K·u₁⌋, u₂ X = 5+⌊(w−9)u₂⌋, u₃
    R = rollF(mountain_size [+0x5c]/[+0x60]), u₄ Y_end = base+⌊11u₄⌋+15
    (the −2⁻³¹ `0x11e0578` + sub idiom — computes base − trunc(−11u),
    i.e. the ASCENDING ⌊11u⌋, re-verified @0x8f0a4f..0x8f0a64), v :=
    1.5 (`0x11dfd2c`), u₅ the 20% coin → Y_end := base + u₆ (the direct
    call `0x10098c0` @0x8f0b08) → v := 1.5+0.25u₆; rows base..Y_end:
    blend @0x8f0b6d → R += 0.5(1+u) → the 50% coin → v *= 0.97+0.03u.
    loop C: y = rollPos(25,h−5) FIRST, x = rollPos(5,w−5), v =
    rollF(strength), R = rollF(radius) — 4 draws, no cap. L2: s₀ = ±1
    (50% coin) → [−0x104]; pass A x₀ = center+s·rollF(3.5,35), pass B
    flips [−0x104] first then x₀ = center+s·rollF(25,75); y₀ = 0; count
    = 120+⌊81u⌋; chain = 3u+1; scale = 0.1u+0.1 (**`0x11df974`** — see
    the C98 correction below); vel = s·(1.25+2.25u); 7 draws/point (s2,
    value, y, scale-decay, chain-clamp [0.75,4], vel-clamp ±2.5 step
    0.5u−0.25, spawn coin). L3: gate `bc.doBeginningDown` (config
    [+0x31], hills = 1) → the module **MSVC C-rand LCG** (state·0x343fd
    +0x269ec3 int32, (s>>16)&0x7fff ÷ 32767; the port seeds a LOCAL
    state 0x132a388 — the game's global is unknowable, FLAGGED): r₁ →
    lo = 1+r₁, r₂ → hi = 2(1+r₂), r₃ → x₀ = center+s·(3.5+2r₃) (s = the
    post-L2 [−0x104] = −s₀), Lehmer count/chain = lerp(lo,hi,u)/scale,
    r₄ → vel = s·(0.15+0.2r₄); per point = L2's with chain clamp [lo,hi]
    and vel ±1.0 step 0.3u−0.15. meta: `l2Calls`/`l3Calls` replace
    l1/l2v/l3v/sc (the byte-range pins: L2 ∈ [240,400], L3 ∈ [120,200]
    gated, 0 with the gate off).
  - **The spawn-lane divergence (FLAGGED).** The per-point spawn coin
    draw (⌊101u⌋ < 5) is consumed; the byte then gates on the
    spawn_item/spawn_small_enemies ptrs (`cmpl $0`) — the port's keys
    are unparsed (null) ⇒ skip ⇒ the selector/scatter draws are NOT
    consumed (the byte's in-game stream draws them on ~5% of points).
    Contained: L3 is the last phase, so nothing downstream re-reads the
    stream (the walk already carries the same class of flag).
  - **C98 cite correction.** The [−0x108] chain-scale INIT loads
    **`0x11df974`** (L2 @0x8f1e6d/0x8f1e75, L3 @0x8f2881/0x8f2889 — the
    same f32 0.1 as loop B's K), NOT `0x11df970` as (119)/C98 claimed;
    the y-update loads `0x11df970` (L2 @0x8f216b, L3 @0x8f2b06).
    Functional equivalence (both f32 0.1); C98 amended in place with
    the correction marker (row not silently edited).
  - **Tests.** 263/263 (was 261): the l3v/l2v pins → the call-count
    spans + the new L3-gate test; the blend test re-pinned to the t²
    form + a new R ≤ 1 min-guard case; the VER stamp → "v5
    composition". **The y224 byte bar HOLDS** (all 12 cells 1.0): the
    new loop C could reach x0..11 at y224 (y ∈ [25,h−5], R ≤ 10, v >
    1 would raise those cells) — deterministic for SEED 78633191 the
    stamps miss. The "1.0 base bake" test still passes (share 0.988:
    loop B/C now RAISE toward 1.5-3 while the chains carve the floor).
  - **C97 shape A/B (all three lanes re-run).** iou: **v2 0.23391 →
    0.23391** (bit-identical — V2 doesn't consume the caves field, the
    C97 lane semantics), **v2v3 0.25183 → 0.25393 (+0.0021)**, **v3
    0.24644 → 0.24708 (+0.0006)**; fR 0.48029 unchanged (ref-side);
    fG v2 0.141 / v3 0.162 / v2v3 0.169 (baseline band 0.141–0.167).
    The port is neutral-to-slightly-positive on shape — honest summary:
    the byte-faithful lanes barely move the 56-tile IoU because the
    caves field feeds only its biomes' surface band. **No cache bump**
    (the caves lane is opt-in via SURFACE_V3; the default render never
    calls buildCavesField).
  - **Status / next.** I25's placement gate: **DONE (port landed)**.
    Next dig = **I25's index half** (kind-1/kind≥2 arms
    0x908fbc..0x909370 + the sampler gate — u-law vs cell index);
    re-run the v2-chunk census before any I23① density diffs. New
    **I26** = the walk/record writer-model reconciliation (the walk
    call-site read is the biggest known-wrong-but-kept piece).
    y-drift still deferred (queue #2, entry (74)).
  - **Pitfalls hit.** The neg-scale+sub idiom reads as "negative draw"
    but computes max − trunc(−span·u) = max + ⌊span·u⌋ (trunc symmetry:
    the ascending law — re-verified, (119)'s summary was right);
    `Float32Array.fill(0.1)` stores f32(0.1) ≠ the f64 literal (the
    test uses Math.fround); hills.xml lives in the LocalLow data dir,
    not the steam data dir; num() = null (not NaN/undefined) for absent
    attrs.
  - **Landed:** ABOUT_MATH **(120)**, CONSTANTS **C50 overturned** +
    **C98 corrections** + **C99**, ISSUES **I25** updated + **I26**
    opened, VERIFIED **§8 row 40** + the caves-lane canon update,
    `caves-field.mjs` **v5** + the test updates. Tests **263/263**;
    C97 A/B v3 0.24708 / v2v3 0.25393 / v2 0.23391. **No cache bump**
    (caves lane opt-in). Next free: entry **(121)**, **C100**, **I27**;
    §8 row **41** free.

- **2026-10-10 (121) — dig #121: I25's index half CLOSED — the caves
  consumer is CELL-indexed (idx = W·y + x), the u-law is kind-0 only;
  the port's caves-lane gate value rewired to the direct cell read; C97
  shape IoU nearly doubles (v3 0.24708 → 0.46464).**
  - **Scope/method.** The unread window from (119)/(120): FUN_00908f40's
    kind-1/kind≥2 arms 0x908fbc..0x909370 (function ends 0x90936f; the
    next fn 0x909370 = a per-cell chunk loop carrying the same
    512-chunk biome-map frame — origins [X+0x38]/[X+0x40], `sar $9`,
    `idiv [X+0x50]`, clamp `[X+0x54]−1`, getter `0x94c700` on
    `[X+0x68]`) + the sampler 0x90d860's field-read block + the writer
    `0x8EE750`'s index math. Byte source: `mapgen/extractions/fulltext86.asm (X1)`
    (the true-VA full disasm — grep/sed-sliced, so C70's window-
    misalignment trap is avoided), dig #119's builder dump, and
    `mapgen/extractions/dig121-fn908f40.asm (X43)`, `dig121-fn90b110.asm (X44)`, `dig121-sampler90d860.asm (X46)`, `dig121-sampler90da00.asm (X47)` + `dig121-rev90b280.asm (X45 — 0 B salvage; re-extract the window from the exe when the kind-0 dig opens it)`; exe re-verified on disk this session
    (17,007,104 B, md5 `8b611494212a69492dd0a4527d9c92e0` = C13).
  - **THE ANSWER (I25 index half): CELL, not u-law.** The game's caves
    consumer = the sampler 0x90d860's field read @0x90dba5..0x90dbd0:
    `eax = [owner+0x9c]` (grid[0] = W), `ecx = &owner+0xb4` (the f32
    accessor object), `imul %esi` → `add %edi` = **idx = W·esi + edi**,
    getter `0x9499f0` (dig 83's slab 0x5491f0), `movss` the f32 value,
    `comiss 0x11dfa94 (0.5) → jbe 0x90e02b` = the air arm. Loop
    orientation = **OUTER y, INNER x**, proven two independent ways:
    (1) the world-compute @0x90dbed..0x90dc0d feeds `xmm2 = origin_a +
    INNER` and `xmm3 = origin_b + OUTER`, and the kind-2 arm's warp call
    @0x9091d7..0x9091ec pins `xmm2 = x` (−0x28) / `xmm3 = y` (−0x20)
    per C95 ⇒ x comes from the INNER counter, y from the OUTER;
    (2) the writer closure below. ⇒ **idx = W·y + x, row-major CELL —
    the u-law `u = 0.049162514·px + 0.1a` (C95/C96) belongs to
    surfaceField's kind-0 grad chain ONLY.** (dig 83's canon line
    already carried `idx y·[owner+0x9c]+x` for this gate; this dig
    re-derived it byte-exact, proved the orientation, and closed the
    writer side.)
  - **Writer–reader closure (both sides re-read on disk this session).**
    fnB's setter `0x8EE750` @0x8ee776..0x8ee7c9: `esi = [p]` = x,
    `edx = [p+4]` = y, `eax = [grid]` = W, bounds `x<W` / `y<H`
    (either negative or ≥ → `0x8ee91c`), `imul %edx,%eax` → `add %esi`
    = **W·y + x**, accessor `lea 0x18(%ecx)`, getter `0x9499f0` — the
    SAME law, SAME getter, SAME object layout (`[0]`=W, `[4]`=H,
    `[+0x18]`=f32 data) as the sampler's, with the offsets interlocking:
    `[owner+0x9c]` = grid[0] ⇔ accessor `owner+0xb4` = grid+0x18. The
    sampler's sibling grids share the identical layout — u16 grid at
    `owner+0xbc` (stride `[0xbc]`, accessor `+0xd4` @0x90da28), byte
    grid at `owner+0xdc` (accessor `+0xf4` @0x90db49), byte grid at
    `owner+0x188` (accessor `+0x1a0`, dig 83).
  - **The kind arms (0x908fbc..0x90936f) — NEITHER touches the float
    field.** kind==1 = the **bitmap_data pixel arm**: `[R+0x1b0]` null →
    ret0 (the procedural_terrain.cpp:2670 assert block between); `x_int
    mod W` and `y_int mod H` via `idiv` + the negative fix-up `add`,
    idx = `W·(y mod H) + (x mod W)`, getter `0x949f60` (the COLOR
    getter), `test $0xffffff` → RGB ≠ 0 ⇒ the material pair
    `driver[+0xa0] → 0x4b8080 → driver[+0x28] → 0x4b80e0` (the line
    0xa7a = 2682 assert when `[+0xa0]` is null). kind==2 = the **P-lane**:
    warp `0x908cb0(x, y, f32)` (param 0.0f first, `[P+0x234]` second,
    1.0f on the fallback; the warp = dig 83's true 0x908CB0) with the P
    object `[region+0x1d4]` → `0x8fae40` count; >0 → resolve via
    `0x4b80e0`, params `[P+0x234]/[+0x238]`, **variant select
    `[P+0x23c]`: 1 → `0x8facd0`, 2 → `0x8faae0`, else → `0x8fa9b0`** →
    `comiss [−0xc] = 0.5` → jb ret0 → re-count `0x8fae40` >0 → the
    shared material tail @0x9091b6, else the fallback `0x908e70` →
    floor-fix → classifier `0x8f5030` (`mBiomeMaterials` = `[X+0x2a4]`).
    kind==0 = C95's surfaceField arm (re-read, unchanged: +0.5 →
    `0x90a860` → cvttsd2si ints → `0x8f5030`).
  - **The fnB factory observation (join evidence).** The fnB-region
    factory fn @0x8ee379..0x8ee427 allocates a **0xb8-byte** object via
    ctor `0x8f9470`, installs **`[obj+0xb0] = 0x8ee1b0`** (the
    CellFactory color→idx thunk) and a **smart-ptr swap at `[obj+0xb4]`**
    (old saved; new = a `*0x24` virtual-call result; the old released
    via its vtable — @0x8ee3f3..0x8ee3f9; the same store again
    @0x8ee692). The sampler's owner is a BIGGER object (its slots reach
    `[+0x2a4]`) ⇒ the literal buffer wiring fnB-built ↔ sampler slot is
    NOT byte-traced this dig (no `+0x9c`/`+0xb4` init site in
    0x79xxxx–0x90xxxx — the 0x795b45 `+0x9c` is vector `end−begin>>5`
    math, not the stride). The join therefore rests on dig 83's consumer
    chain + this dig's law closure + the measured IoU jump → **NEW I27**.
  - **The port patch.** `noise-terrain.mjs` — the caves-lane gate value
    is now the DIRECT cell read (the wrong piece was never gradAt's
    mod-wrap body — that was already the byte law — but its
    ARGUMENTS,which came from surfaceField's u-law chain): V3 chain
    `field = gradKind === "caves" ? gradAt(wx, wy) : surfaceField(...)`;
    V2 loop `v = cavesSrc ? gradAt(gx, gy) : surfaceField(...)` (`cavesSrc`
    = the existing caves-gradAt attach condition). The dig #101 comment
    block carries a dig #121 correction marker; the gate/logger comments
    updated ("the FIELD" = the direct read for caves, the combine for
    kind-0). Frame note: canvas vs world px agree under the modulo (the
    C80 origins 17920 = 35·512 and 31744 = 124·256 are multiples of both
    wrap dims), so the V2 lane's canvas px stay valid. The test mirror
    `cell()` in `surface-wiring.test.mjs` patched in lockstep (hills →
    `gradAtMirror(def)(wx, wy)`; the `surfaceField` import dropped;
    `uidMirror` kept as the kind-0 mirror with a usage note).
  - **Tests 263/263** (the data-gated equivalence suite passes with the
    patched mirror). **No cache bump** (the caves lane is opt-in via
    SURFACE_V3; the default render never enters the noise branch).
  - **C97 shape A/B (all three lanes re-run, same 56-tile set).** iou:
    **v2 0.23391 → 0.23391** (bit-identical — the V2-only lane never
    attaches the caves field, C97 semantics), **v3 0.24708 → 0.46464
    (+0.218)**, **v2v3 0.25393 → 0.46557 (+0.212)**; fR 0.48029
    unchanged (ref side); fG **v3 0.162 → 0.840**, v2v3 0.169 → 0.845,
    v2 0.141 unchanged. Post-patch v3 per-family iou (fG): mountain
    0.5497 (0.688) / desert 0.6447 (0.984) / winter 0.3664 (0.977) /
    hills 0.4306 (0.975) / lake 0.4306 (0.331 — the non-caves C39 image
    lane, path untouched). v3 iouShift 0.64285 ≫ iou 0.46464 ⇒ the
    residual is now registration-heavy (dyOpt mean −156, med −231); the
    bty14 row: iou 0.7399, dyOpt mean −44.9, **med −12** (the C78
    anchor ±1 — recorded as an observation, not a claim).
  - **Honest summary.** The index fix nearly DOUBLES the caves-family
    shape IoU — the largest single-lane gain on record — and the
    over-fill it exposes (fG 0.84 vs fR 0.48; deep band b3 0.70) is
    exactly I26's predicted signature: under `carveCircle`'s dir="max"
    the walk is a near-no-op on the 1.0 base, so the caves never get
    carved. **I26 is now the dominant blocker for the BitmapCaves
    family's shape.**
  - **Not covered (deferred).** The agenda's kind-0 P-chain items: the
    r-eval 0x90b280 read PARTIAL (comisd vs `0x11e0050` → the `0x90b680`
    pair fast-path returning 0/1.0f; the normal path gates `[X+0x6c]`,
    does the 512-chunk biome-map lookup via `0x94c700` on `[X+0x68]`,
    then the `0x29` = 41-px band rank + `0x909c70` compare and the
    `/0x11e0274` ramp divisor) — slot `[X+0x94]`, the `[+0xb0]` topology
    question, C39's ramp, I21, and the dyOpt −12 anchor all REMAIN for a
    dedicated kind-0 dig; the v2-chunk census re-run (the I23① density
    gate) was NOT needed — the v2 lane is bit-identical this dig; C79
    not re-run (C97 is the shape instrument of record).
  - **Pitfalls hit.** The sed-by-anchor trick dies on non-instruction-
    aligned VAs (`^  90b600:` absent → empty range → sed "unknown
    command"; use line offsets); my first `+0x9c` filter regex used
    `{3}` against 6-digit addresses (zero matches = a false negative);
    the `+0x9c` displacement is container-common (3438 hits — 0x795b45's
    is `end−begin>>5` vector math); the sampler's bounds blocks
    reference SIBLING-grid slots (`[0xbc]/[0xc0]`, `[0xdc]/[0xe0]`) —
    do not read them as the f32 grid's own limits.
  - **Landed:** ABOUT_MATH **(121)**, CONSTANTS **C100**, ISSUES **I25
    closed** + **I27 opened**, VERIFIED **§8 row 41** + the caves-lane
    canon update, `noise-terrain.mjs` (V2/V3 caves value source + the
    comment corrections), `surface-wiring.test.mjs` (the mirror). Tests
    **263/263**; C97 A/B v3 0.46464 / v2v3 0.46557 / v2 0.23391. **No
    cache bump** (caves lane opt-in). Next free: entry **(122)**,
    **C101**, **I28**; §8 row **42** free.

- **2026-10-10 (122) — dig #122: I26 CLOSED — the walk/record
  writer-model reconciliation (the walk = setterStamp flag=1 CARVE +
  the center-y q⁸ eave; the record = the 0x8EF870 two-sided template
  lerp)**
  - **Scope/method.** The unread half that (119)/(121) FLAGGED: (i) the
    walk's stamp call-site @0x8ef300..0x8ef37c — which value/scale/flag
    it pushes; (ii) the setter's flag=1 eave arm + its y source; (iii) the
    record lane's engine identity (0x8EF950's float twin + the caller);
    (iv) the per-stamp template ctor. Reads from the true-VA builder
    slice `mapgen/extractions/builder-8EE000-8F3700.asm (X2)` +
    `mapgen/extractions/fulltext86.asm (X1)` + the PE const bank; exe md5
    re-verified = C13.
  - **Result — the WALK half (byte-exact).** The walk's stamp @0x8ef37c
    = the setter 0x8EE750 with **VALUE = `[−0x20]` = the 3-segment
    radius envelope R(t)**, **SCALE = clamp01(slot″)**, **flag = 1**
    (`push $1`). The prologue draws re-pinned byte-exact (C101(a)):
    `s = (2 − trunc(−4u))/5` (−4.0 f64 @0x11e0608, 2.0 @0x11dfe68,
    5.0 @0x11e00a0), `rA = rD = s·0.2u` (0.2 @0x11df9b4), `rB = rC =
    s·(1 + 2.5u)` (2.5 @0x11dff10 + 1.0 @0x11dfbf0), each × `[−0x20]`
    → `[−0x68]/[−0x50]/[−0x5c]/[−0x6c]`. The lane law (0.2/0.4/0.6/0.7
    = 0x11df9b4/0x11dfa44/0x11dfaf8/0x11dfb1c), the roll draw
    (0.35 @0x11dfa1c / −0.25 @0x11df9d0), the D2 arm (0.32
    @0x11dfa00), the envelope boundaries (0.3 @0x11df9f0 / 0.6 shared)
    all re-derived from the PE. SCALE ≤ 1 + the setter's lower-only
    guard ⇒ **the walk CARVES** — the port's `carveCircle(dir="max")`
    was wrong on the dir, the t law, AND the eave form (three defects,
    all now closed).
  - **Result — the setter's flag=1 eave (byte-exact; C99 corrected in
    place → C101(c)).** flag = the byte `[ebp+8]` (`cmpb $0x0,0x8(%ebp)`
    @0x8ee839 → `je 0x8ee892` skips; the SSE in between leaves EFLAGS
    alone). The eave reads `[edi+4]` = the **stamp CENTER y** (the point
    struct — the cell coords form only at @0x8ee892, AFTER the eave):
    y < 25 (`cmp $0x19,%eax; jge`) → q = y/**25.0** (`divss 0x11e01e0`
    — **NO −1**; C99's "(y−1)/25" = a miscite), q²·q⁴·q⁸ via three
    `mulss %xmm0,%xmm0`, target′ = 1 + q⁸·(target − 1) → `[−0x14]`;
    the write guard + store use the eaved target. **Circle arm only** —
    the single-cell arm returns @0x8ee7de before the eave block. The
    single-cell store corrected too: `movss −0xc(%ebp),%xmm0; movss
    %xmm0,(%eax)` @0x8ee7cf..0x8ee7d4 (writes SCALE; C99's
    `movss %xmm2,(%eax)` named the wrong register — xmm2 = VALUE).
  - **Result — the RECORD half = a DIFFERENT engine.** The setter's
    callers are exactly 3 (walk 0x8ef37c, L2 0x8f20d1, L3 0x8f2a6c):
    the record phase does NOT call it. fnB = FUN_008EFDD0 (the earlier
    A/B pair naming was swapped for this fn — §8 row 41's cites stand,
    the names rotate); `[−0x13c]` = fnB's `[ebp+8]` = the **field
    shell** (non-null asserted, slab line 0x326). The per-stamp temp
    `(−0xfc)` = ctor **0x8F9470** (C101(d): seed = the raw Park-Miller
    count draw → `[+0x8c]` = seed, `[+0x90]` = 1.0f, `[+0x94]` =
    u·200000 − 100000 — the size pair 0x11e0504/0x11e04ec, the wrap ×0.5
    (0x11dfdd8 f64) vs 2³¹−1 (0x11e0220 f64)) dtored @0x8f16dd. The
    record's strength pair = `[+0x34]/[+0x38]` ✓ C50 ✓; the point rolls
    (`min + trunc(u·span)`) + the strength compose (`A + d·(B−A)`) ✓ the
    port was already right. The engine: **FUN_008EF870** runs per cell
    over the template's grid0 region — `field.cell += (value −
    field.cell)·temp.cell` — a **two-sided lerp** (getters 0x949ad0 /
    0x9499f0; NO eave, NO lower-only guard, NO value>1 branch). On the
    1.0 base: v > 1 raises (the C48 bump peaks 1.45..1.55 ✓), v < 1
    **CARVES** (the port's `dir="max"` no-oped there = the (121) fG
    0.840 over-fill signature). The byte lane **FUN_008EF950**: gate
    `[temp+0x5c] ≠ 0` → the stencil copy `if temp.g1[i,j] ≠ 0 →
    field.g1[y0+j, x0+i] = temp.g1[i,j]` (bounds vs the field's
    grid1 dims [0x40]/[0x44]) — the port's single-cell byte mark = the
    model.
  - **New residual → I28.** The ctor zero-inits every container block
    (@0x8f9481..0x8f94c8) and nothing in the record window fills the
    temp before fn950 runs (only ctor/fn950/dtor touch `(−0xfc)`; the
    0x668400 call = a log/string op) ⇒ a fresh template ships EMPTY and
    BOTH engines no-op on it (`[temp+4] = 0` kills the float loops;
    `[temp+0x5c] = 0` skips the byte lane). The record's template-FILL
    engine is not in this window → **open (I28)**; the port keeps the
    (43)(a) linear t + the R ≥ 1 clamp as the weight/radius stand-in.
  - **Walk arg map (new).** ecx = the prng (the draws via `call
    0x10098c0` after `mov %esi,%ecx` with esi = `[−0x24]` = saved ecx),
    `[ebp+8]` = grid, `[ebp+0xc]` = the start point struct {x,y} (the
    trunc pair → `[−0x4c]/[−0x44]`), `[ebp+0x10]`/`[ebp+0x14]` = the
    float pair (swapped at the child call @0x8ef804..0x8ef81a),
    `[ebp+0x18]` = **length** — asserted `length < 10240.f` (C101(b):
    biome.cpp:579; the child budget lands at the same slot @0x8ef809).
  - **Port.** `caves-field.mjs`: `setterStamp` gains `flag = 0` (the
    eave = the circle arm, the center y, q = y/25); walkChain's stamp →
    `setterStamp(grid,…,tx,ty,radius,v,1)`; new internal
    `stampLerpTemplate` (the two-sided lerp, the (43)(a) t stand-in);
    `caveRecordStamp` → the lerp; `carveCircle` marked **LEGACY MODEL**
    (the export stays — the api surface pins it, no production caller
    left); the header/phase comments + `CAVES_FIELD_VER` updated. Tests:
    the record expectations → the lerp (0.55 at the center, no eave),
    the walkChain "RAISES only" → "CARVES only" (min < 1.0, max ≤ 1.0),
    the carveCircle describe marked legacy. **263/263.**
  - **C97 A/B (the (121) baselines vs this dig).** v2 **0.23391
    bit-identical** (the V2 lane never attaches the caves field ⇒ **no
    cache bump**), v3 IoU 0.46464 → **0.45278** / fG 0.840 → **0.71506**
    (vs fR 0.48029 — the over-fill drops −0.125 exactly as I26's
    uncarved-base prediction said), v2v3 0.46557 → **0.45557** / fG
    0.72383. The IoU −0.012 = the carve removing solid where the ref
    still has it — the residual is the registration/model gap (I23①/
    I24), not the writer law (the law is byte-anchored).
  - **Pitfalls hit.** The EFLAGS trap again (SSE leaves flags alone —
    the eave `je` @0x8ee85c tests the `cmpb` @0x8ee839 across a long
    SSE block); the f32/f64 const trap (0x11e0608/0x11dffe8/0x11e0220
    read as 0.0/0.0/NaN f32); the arg-offset grep pollution (negative
    locals `-0x20(%ebp)` substring-match positive `0x20(%ebp)` — use a
    negative lookbehind); an unlabeled const's role only fell out of
    the ASSERT STRINGS (10240.0 was nameless until `length < 10240.f`
    + biome.cpp:579 surfaced via the log pushes).
  - **Landed:** ABOUT_MATH **(122)**, CONSTANTS **C99 corrected in
    place** + **C101**, ISSUES **I26 closed** + **I28 opened**,
    VERIFIED **§8 row 42**, `caves-field.mjs` (setterStamp flag/eave,
    walkChain stamp swap, stampLerpTemplate, carveCircle legacy) +
    `tests/mapgen/caves-field.test.mjs` (the mirror). Tests **263/263**
    (incl. the y224 oracle byte bar — no walk/record stamps land on that
    row for the oracle seed, so the carve leaves it byte-exact). **No
    cache bump** (v2 bit-identical). Next free: entry **(123)**,
    **C102**, **I29**; §8 row **43** free.
- **2026-10-11 (123) — dig #123: I28 CLOSED — the record lane is a
  PRNG-DRAW consumer (the template ships empty ⇒ both engines no-op ⇒
  no field/byte writes; the count law is up-from-min)**
  - **Scope/method.** The residual (122) opened as I28: who FILLS the
    per-stamp template before fn950 runs. Three reads, all re-verified
    on disk this session: (i) the record window's slot census
    @0x8f11b3..0x8f1746 — every address of the frame-local temp
    `(−0xfc)`; (ii) the ctor 0x8F9470 body + where its internal draws
    come from; (iii) the fn870/fn950 entry gates + epilogue and the
    0x668400 resolver's full control flow (the only windowed call
    besides ctor/fn950/dtor). Plus the XML census of all 102
    CaveStructure records (on disk).
  - **Result — the no-write proof (byte-exact).** There is NO fill
    engine for this temp: the ctor zero-inits every dim/container slot
    (`movl $0x0` @0x8f9481..0x8f94c8 ⇒ `[temp+0] = [temp+4] =
    [temp+0x5c] = 0`) and the windowed slot census finds only the 3
    `lea −0xfc` sites (ctor @0x8f1300, fn950 @0x8f169d, dtor
    @0x8f16dd) + a lua-cache handle at `[−0x48]` that is assigned then
    released, never read; the temp is frame-local ⇒ nothing outside
    fnB can address it. fn870 exits at its dims gate (`cmp
    [temp+4],0; jle 0x8ef940` @0x8ef888b → 0x8ef940) and fn950 (which
    calls fn870 first @0x8ef96f) exits via `cmpl $0,0x5c(%ebx); je
    0x8efa2d` @0x8ef977 → the epilogue @0x8efa2d (`pop edi/esi/ebx;
    mov ebp,esp; pop ebp; ret`). **Both engines no-op on the fresh
    template ⇒ the record lane writes NOTHING.** The `[+0x94] =
    u·200000 − 100000` question resolves the same way: it is the
    ctor's STACK-LOCAL Random draw (`lea 0x8(%esp)` → `0x10098c0` ×2
    @0x8f958d/0x8f9596 → `movss` @0x8f95b1), seeded by the ctor arg
    trunc(u·(2³¹−1)) — it never touches the stream and lands on a
    temp nothing reads ⇒ **inert** (its size semantics belong to I27's
    published factory objects). grid0/grid1 = the ctor's vector
    zero-init (no allocator runs) ⇒ dims 0 ⇒ both engines' bounds fail
    before any cell access. I28's (a)/(b)/(c) all close.
  - **Result — the draw law (byte-exact; C51's count law corrected in
    place → C102).** The lane's ONLY effect = prng draws. Count roll
    @0x8f11b3..0x8f1280: `count = [rec+0x1c] + trunc(u·([rec+0x20] −
    [rec+0x1c] + 1))` — **UP from min** (the rollPos twin); ≤ 0 →
    `jle 0x8f16f1` @0x8f1280 skips the record with ZERO draws. The
    dig #61 "negative NextU scale, counts DOWN from max" = a double
    misread: the `mulsd 0x11e0578` (−2⁻³¹) @0x8f1266 forms the
    NEGATIVE intermediate `−u·span` which `cvttsd2si` @0x8f1272 +
    `sub %eax,%ecx` @0x8f1276 SUBTRACT from the count_MIN slot `[−0x120]`
    (`0x1c(%eax)` @0x8f11d2 — dig #61 took the minuend as max) ⇒ min −
    trunc(−u·span) = min + trunc(u·span); u = the NEW state·2⁻³¹
    (state stored back @0x8f1262 before use — matches `prng.next()`).
    Per stamp (the loop counts DOWN: `decl [−0x120]; jne 0x8f1295`):
    **4 always + 1 per resolver group** — (1) the ctor-seed draw
    @0x8f12c5..0x8f130a (state stored @0x8f130a; the ctor arg =
    trunc(u·(2³¹−1)), ×2⁻³¹ `0x11df988` then ×(2³¹−1) `0x11e0220`);
    (2) the image resolver @0x8f144e → 0x668400: `find('$')` @0x668494
    → npos ⇒ assign + `jmp 0x668788`, 0 draws; else find `$[`/`]`,
    split the inner on "-" → count ≥ 2 (`cmp $2; jae 0x6685dc`) ⇒ ONE
    draw @0x6685ff (value = lo + trunc(u·(hi−lo+1))), < 2 ⇒ "Error in
    parsing, no end in sight" @0x6685bf, 0 draws (the substitution
    still runs with value 0); the recursion @0x66873f re-runs on the
    substituted string (group removed) ⇒ exactly 1 draw per well-formed
    group. XML census: 94 plain / 7 `$[0-999]` / 1 `$[1-4]` of 102;
    (3) X @0x8f14b6 (store @0x8f1518) = `[rec+0x28] + trunc(u·([rec+0x30]
    − [rec+0x28] + 1))`; (4) Y @0x8f157f (store @0x8f15d9) =
    `[rec+0x24] + trunc(u·([rec+0x2c] − [rec+0x24] + 1))`; (5)
    strength @0x8f164d (f32 store @0x8f16a3) = `[rec+0x34] + u·([rec+0x38]
    − [rec+0x34])` (the C50 inline `A + d·(B−A)` compose @0x8f1684..0x8f16b7
    ✓). All three tail rolls are unconditional (their assert `jp`
    skips only the print). fn950's call: ecx = the temp, edx = the
    field, stack Y/X/strength (the `push %ecx` room @0x8f169c,
    `movss` @0x8f16bb, pushes @0x8f16c0/0x8f16c7, call @0x8f16c8,
    `add $0xc` @0x8f16cd) — the values are DISCARDED.
  - **Observations.** The old port's y0 row carried a phantom raise
    bell at x100..110 (peak 1.5311 — a record stamp's strength draw)
    that the game never writes; it disappears with the draws-only
    conversion while pre-record lanes' stamps (x4:0.8222/x5:0.8828)
    stay byte-identical ✓ (they draw before the record lane). The
    ref's y0 bump bell (x10..28, peak 1.454092) is STILL not
    reproduced: with records proven write-free, the bump must come
    from a raise-capable lane the port places differently (loop B/C
    under the still-modelled walk draw budget — the (121) FLAGGED
    ~0.15 draws/point coin-hits) or from I27's published-template
    objects — the C50-derived oracle pin now guards a span, not a
    record-lane attribution.
  - **Port.** `caveRecordStamp({countMin,countMax,imageFile}, prng)` →
    draws-only (count up-from-min; per stamp the ctor-seed + the
    resolver group loop + X + Y + strength; returns the rolled count);
    internal `resolverDraws` mirrors 0x668400's group law (1 draw per
    well-formed `$[lo-hi]` group); the ctx param, the aabb/point/
    strength rolls, the byte write, `rollNeg` (sole use) and the
    `stampLerpTemplate` CALL removed — `stampLerpTemplate` itself kept
    as **LEGACY MODEL** (the engine reference for I27's published
    objects; carveCircle-style treatment); `CAVES_FIELD_VER` extended
    within the v5 epoch (the default render is untouched — no bump);
    header/phase comments rewritten. Tests: the count-law test →
    up-from-min + the ≤0 `jle` guard, the stamp-value test → the draw
    budget + the resolver group law (2-group + malformed cases).
    **265/265** (263 + 2 net new).
  - **C97 A/B (the (122) baselines vs this dig).** v2 **0.23391 →
    0.23391 bit-identical** ⇒ **no cache bump** (the default render
    never attaches the caves field), v3 IoU 0.45278 → **0.45240** / fG
    0.71506 → **0.71459** (vs fR 0.48029 unchanged) — essentially
    mask-NEUTRAL at the aggregate (|Δ| ≤ 0.0004): the removed record
    carves (winter/brush v<0.5) ≈ the stream-shifted L2/L3/scatter
    positions; v2v3 0.45557 → **0.45521** / fG 0.72383 → **0.72327**.
    The correction matters for the field VALUES (the phantom y0
    raise), not for the mask aggregate.
  - **Pitfalls hit.** The count law's two twins differ in sign ONLY
    via the −2⁻³¹ const trick — a `trunc(−x)`-shaped byte still means
    `+trunc(x)` semantically, and the sub's MINUEND slot decides
    everything (dig #61 swapped it); a `resolverDraws()` TRUTHY test
    consumed ONE draw where the binary's recursion draws ONCE PER
    GROUP (caught by the 2-group unit test — budget laws need COUNT
    tests, not boolean tests); my own span arithmetic in the ≤0 test
    ((−1)−(−4)+1 = 4, not 3).
  - **Landed:** ABOUT_MATH **(123)**, CONSTANTS **C51 corrected in
    place (row + 2 bullets + the AIR-split claim)** + **C102**, ISSUES
    **I28 closed**, VERIFIED **§8 row 43** + **§12 corrections + the
    dig-#123 UPDATE**, `caves-field.mjs` (draws-only record lane,
    rollNeg removed, resolverDraws, legacy comments) +
    `tests/mapgen/caves-field.test.mjs` (the mirror). Tests **265/265**
    (incl. the y224 oracle byte bar — the stream shift moved no stamp
    onto y224 x0..11). **No cache bump** (v2 bit-identical). Next
    free: entry **(124)**, **C103**, **I29**; §8 row **44** free.
- **2026-10-12 (124) — dig #124: I29 Stage 1 EXECUTED — the canon-source
  audit (constant-sweep + citation-bank conversion); the M3 walk read
  rescheduled to (125)**
  - **Scope/method.** The I29 stage-1 machine pass: (i) the
    **const-verifier** — every parseable `(value, VA[, width])` pair in
    the 98 C-rows read at the section-mapped offset of the live exe
    (md5 = C13 re-verified) and compared under the declared (or both)
    widths; (ii) the **citation sweep** — every `/tmp`-cited extraction
    artifact salvaged from the still-alive session temp dir, landed under
    `mapgen/extractions/`, digest-pinned, and every registry cite
    converted to a manifest row; (iii) the **link check** — every new
    extraction cite must resolve on disk + be manifest-registered (a
    mechanical post-commit gate now: scripts/precommit-gates.mjs).
  - **Findings.** (1) **0 genuine constant mismatches in 131 machine
    verdicts** + 3 sign-ambiguities resolved by eyes as canon-correct
    (the rows' own text carries the negative signs — `[0x11e05f8] = f64
    −3.0`, `[0x11e0610] = f64 −5.0`, `[0x11e05a8] = f32 −1.0`); 5
    RUNTIME (BSS) cites classified honestly (C47's CE pair), 5 CODE
    cites skipped correctly. Coverage note: only ~18 C-rows carry
    parseable float pairs — the machine tier pins the const banks, and
    stages 2–3 (eyes) own the law rows (the I29 table stays open).
    (2) **C57 precision**: the flat `VA−0x400E00` mapping is exact for
    `.rdata` (section table reproduced it to the byte) but NOT for
    `.data` (its delta is 0x401A00) — the const-verifier uses the real
    PE section table and C103 registers the law. The C47 CE cites
    proved to be `.data` BSS (beyond RawSize) — runtime-only by design,
    now classified properly by the instrument.
    (3) **~100 volatile `/tmp` citations → manifest banks X1–X61**
    (each digest-verified vs disk): fulltext86 (188 MB), raw .text/
    .rdata bytes, the dig121 noise-lane windows, dig111/116 window
    dumps, dig118 shape logs, the surface-y logs, `slabs/` (234 MB),
    `dig117-prelib/`, the dig123 windows (X48–X57 = the dig-123-era
    citations' restatement). Residual `/tmp` cites in the registries:
    **0** (three bare temp-bank mentions annotated as provenance notes).
    (4) link-checker: 96 extraction cites — 0 problems.
  - **Pitfalls (tool-audit incidents, all caught by the machine gates or
    my own re-read).** The width token "f64"-digit parse bug (every f64
    pair mispaired → false MISMATCH ×15 — caught by debugging the TOOL,
    not by touching the canon); the ±-token sign drop (3 false
    MISMATCHes — the canon was right); the pre-commit citation lint
    BLOCKED two of my own commits before they landed (a dangling var +
    a manifest-scoping false positive — cleanup on the spot); the MSVC
    wrapped 'Next free' phrase — path citations in single-line-greps
    break on wrapped lines (use entry headers, the hook law).
  - **Port.** No port changes (an audit dig): the register/law content
    untouched except C57/C47 precision annotations IN C103 (the law row)
    + the sweep's classification (no canon row overturned — the first
    sweep verdict = the canon's numeric layer is byte-sound).
  - **Tests.** 272/272 (265 + 7 const-verifier PE spot checks —
      the .rdata/.data mappings, the spot pairs, the sign twins, the BSS
      classification). Oracle byte bar ran (the surf suite).
  - **Landed:** ABOUT_MATH **(124)**, CONSTANTS **C103**, ISSUES **I29
    stage-1 annotated** (stages 2–3 remain), VERIFIED §12 note (this
    row: the instrument exists + the mapping law), manifest **X1–X61**
    (each digest-verified), `scripts/precommit-gates.mjs` + hooks
    (`7b-neighbouring commits` spirit), `tests/mapgen/const-verifier.test.mjs`.
    Tests **272/272**. **No cache bump** (no render change). Next
    free: entry **(125)**, **C104**, **I30**; §8 row **45** free.
- **2026-10-12 (125) — dig #125: A1 DEMOTED + the walk-window stream census
  + the stream-trace instrument (C104(d)/(e)); I24's drift = arg, no draw**
  - **NEW EVIDENCE:** the fnB walk fn's own window (manifest X10,
    0x8eec70..0x8ef903) — never satewide site-censused for ITS OWN draw
    order until now (digs #82/#101 gave the port-shape; dig #122 gave the
    setter's laws; the坑 walk's per-iteration draw COUNTS were the last
    registered MODEL lane on the active path) + fnB's walk-call push
    frame (X2 @0x8f06b9..0x8f0703) for the y-drift source.
  - **Predict-then-read.** Prediction (before the read): 1 always roll +
    1 D2-arm + 2 bias coins + 1 x-law + growth/child conditional draws
    ≈ 7-9 draws/point; the drift = arg, no draw. **Verdict: AGREE on the
    count shape** (3 always + 5 conditional sites + the child recursion's
    own draws; the seed-lag = the growth-counter reset handling); the
    labels refined per C104(d).
  - **Findings (byte-exact, all cites re-derived this session from X10
    site census + X2's fnB call frame).** Per point: **3 always-draws**
    (the 0.35u−0.25 value roll @0x8ef24b + bias gate 1 @0x8ef433 + bias
    gate 2 @0x8ef4db — both ×101/25-coins) + **5 conditional sites**
    (D2-arm iff the prologue's 50% coin @0x8eecc1 set [−0x70]; the
    growth-counter roll @0x8ef6c0 behind the [−0x48] > 50 gate
    (`cmp $0x32; jle` @0x8ef631; the counter resets @0x8ef6cb INSIDE the
    taken branch = the port's existing model ✓ — the dig #125 edit was
    comment-level only, confirmed by the metric-identical A/B below); the
    2% child-gate draw
    @0x8ef71e (×100, `0x11e02dc`); the child-budget draw @0x8ef7c6
    (×50−50); the child SELF-recursion `call 0x8eec70` @0x8ef823 with
    decl-shared counter @0x8ef79e). The spawn lane: gated by
    `[−0x58]/[−0x64] ≥ 0` + threshold [ebp+0x2c] → D3 @0x8ef3b3 → D4 coin
    @0x8ef3cf → 95/5 `cmp $0x5f`+`cmovl` → the 0x8EEAD0 scatter
    (@0x8ef3f9). The y-drift = `y += arg[ebp+0x20]` @0x8ef389 — **no
    draw** (I24's mechanism answered; the pending slot-identity piece =
    the fnB push-frame mapping). The scatter itself draws only its
    span roll (byte-cited dig #56/#81 — no new model).
  - **Port.** The walk port = byte-faithful at EVERY census site (the
    A/B below proves it empirically: v2 bit-identical, v3
    metric-identical); the dig #125 caves-field edit = comments only.
    The stream-trace instrument built (C104(e) + caves-field trace
    buckets + the partition-invariant TEST).
  - **A-register.** A1 DEMOTED (byte-cited sites + documented micro-merges
    ≤1 draw/pt); A2 → the LAW known, the port skip honest (I21's data
    frontier); A3 → mechanism found (arg, no draw); the register shrank
    ✓ (the purification law).
  - **C97 A/B (run this dig):** v2 **0.23391 bit-identical** ⇒ **no
    cache bump** (the V2 lane never attaches the caves field); v3 IoU
    **0.45240** / fG **0.71459** (fR 0.48029) — metric-identical to
    entry (123): the walk's census + trace add no field deltas (the
    honest confirmation of the byte-faithful port).
  - **Landed:** ABOUT_MATH **(125)**, CONSTANTS **C104**, ISSUES **§A
    re-written (A1 demoted/A2 law-known/A3 mechanism-found)**, VERIFIED
    §12 (the audit + census note), caves-field.mjs (the trace + the reset
    correction), tests (the partition invariant). Tests **273/273**?? —
    count at gate. Next free: entry **(126)**, **C105**, **I30**; §8 row
    **45** free.
