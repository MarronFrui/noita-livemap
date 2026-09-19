# CONSTANTS.md — binary-derived values registry

> **Purpose:** one row per hard fact pulled out of `noita_dev.exe` (or from
> game data cross-checked against it), so no session ever re-scans the
> binary for the same byte/constant/name. If a value is needed and it is
> NOT in this table, it must be re-verified on disk **this session** with a
> byte-pin, and then registered here before use.
>
> **Standing rule (2026-09-19, user mandate):** every new binary-derived
> constant gets registered in this file *before* it is used in code, in
> another doc entry, or in a hypothesis. Code comments reference rows as
> `CONSTANTS.md::<C##>`.
>
> Conventions:
> - **VA** = true Ghidra VA. Slab VA = objdump VA (`text.bin` =
>   file[0x400c00:0xdd0000], adjust-vma 0x401000) — **true VA = slab VA +
>   0x400800** (see ABOUT_MATH 2026-09-19 (2)). Record BOTH when pinned
>   via objdump; record true VA when it comes from Ghidra dumps.
> - Status column: `pin` = byte-verified in slab this session (date);
>   `read` = semantics decoded from disassembly (date); `canon` = matches
>   an existing VERIFIED.md/ledger entry.

## Index

| ID | Constant | Meaning (short) |
| -- | -------- | ---------------- |
| C1 | `0xFF420000` | coalmine start-path mark color || C2 | `0xFF000000` | hasPath start-cell overwrite |
| C3 | hasPath blockOutColors table | 11 RGBA marker colors @0x9015c4 |
| C4 | `0x006400` / `0x000064` | coalmine-hax overlay real constants |
| C5 | `0x66666667` | signed ÷10 magic |
| C6 | `0x834e0b5f` | signed ÷100000 magic |
| C7 | `0x1f31d / 0xb14 / 0x41a7` | Random(min,max) closed form 127773/2836/16719 |
| C8 | `0x939b80` FUN chunk cache-builder | lattice (÷512, quarter-cell) indexing |
| C9 | `0x90738f` / `0x907852` | the two area-grid SetSize call sites |
| C10 | area float grid = float32 w·h | grid cell = 10 world px |
| C11 | area grid dims formula | `[chunkW << 9] ÷ 10` — no additive anchor |
| C12 | `0x1179e90 / 0x1179ef0`, `0x116ea50 / 0x1179f1c`, `0x1151084` | cache-builder assert strings + field ptr |
| C13 | VA map (slab offset +0x400800) | the objdump↔Ghidra address conversion |
| C14 | stb / fill-subsystem ÷10 interior | fill's own ×10-scale sites (lab-corrected) |
| C15 | `0x8e6d50` in-memory painter | per-record burn/paint copier (no anchor) |
| C16 | `0xffffff` black-test + `0x2710` limit | FUN_00901510 ray-walk stop conditions |
| C17 | `0x901450` finalize black blit | 16-byte record, exclusive ends, literal FF000000 |
| C18 | `0x9013f0` rect fill conventions | exclusive-end record {x0,y0,x1,y1}, strict-< fill |

## Registry

### C1 — coalmine start-path mark `0xFF420000`
- `cmp eax, 0xFF420000` @ true **0x901a4d** (byte-pinned — slab 0x50124d).
  Written as cell value in the coalmine hax overlay; NOT the same thing as
  the start-cell color `0xFF000000` (C2).
- Function: hasPath start arm, true FUN_00901780.
- Status: pin (2026-09-19). Sources: ledger F2 dig #2/#3, ABOUT_MATH
  2026-09-19 (2) VA-map proof.

### C2 — hasPath start overwrite `0xFF000000`
- `movl $0xff000000,(%eax)` — right after the mark compare (slab 0x501b09
  ⇒ true 0x901b09).
- Meaning: the found coalmine start path cell is set opaque-black before
  the path search. Status: pin (2026-09-19).

### C3 — hasPath blockOutColors: 11 RGBA LE colors @ true **0x9015c4–0x90160f**
- `#ff00ff #ff0080 #ff0aff #c35700 #00ac64 #00ac6e #70d79f #70d79e
  #70d7a0 #70d7a1 #7868ff`.
- Re-derived in-binary 2026-09-18 (noitool's 9-color list missed
  `0x00ac64` and `0x70d7a0`); port lives in `lib/has-path.mjs`
  (`blockedColors`). Also visible as inline cmp constants in the faithful
  hasPath body (slab 0x501780 family).
- Note: 0x7868ff row order differed in an earlier ledger sketch; the
  authoritative list is the one in the ledger F2-dig #5 table which we
  decoded as 11 entries. Status: canon.

### C4 — coalmine-hax overlay constants `0x006400` / `0x000064`
- The overlay *data* (vendored `coalmine_hax.cpp` container) really
  contains `0x006400` and `0x000064` — byte-verified this session in
  `tests/mapgen/has-path.test.mjs` ("overlay data actually contains
  0x006400 and 0x000064 pixels"). noitool's code compared `0x004000/0x0040`
  = silent no-op; OUR port compares the real values (active hax).
- Status: pin (2026-09-19 test run) + tests guard it.

### C5 — signed ÷10 magic `0x66666667` (+ `sar 2` sign-correcting form; `sar 3` plain form elsewhere)
- Sites byte-confirmed 2026-09-19: the 3 record-queue idioms listed below
  (true **0x90b8xx Update-frame**, **0xd3a403** (unnamed function mislabeled
  "cache-builder /10" in dig #2, corrected by the 2026-09-19 (2) entry),
  **0xcee0cf** = true VA of the fallback-fill-family read — NAMES UNKNOWN)
  and the ÷10 used for the **area-grid SetSize args** (true 0x90735b/0x907375,
  = C9's first call site block), plus 2 hits inside the stbhw fill
  interior (see C14 — semantics unread).
- **Semantics caution (2026-09-19 entry):** the 3 record-queue idioms
  (Update scan, true-0xd3a403 queue, true-0xcee0cf wrapper) at /10 uses were
  read as *pending-queue step accounting*, NOT wang-cell anchoring. They are
  ELIMINATED as anchor candidates **subject to the dig #2 name-correction** —
  the elimination conclusion is plausible but NOT canon until the true
  functions get their own reads. Do NOT treat the /10 sites as anchor
  candidates, and do NOT treat that elimination as Ghidra-name-verified.

### C6 — signed ÷100000 magic `0x834e0b5f`
- @ true 0x907222 and 0x9072a1 (slab 0x506a22/0x506aa1, byte-pinned
  2026-09-19). Combined with C7 this is **the Random(min,max) closed
  form**, living inside the mSeed/registrant chain (mSeed ×200000−100000
  per VERIFIED §3).

### C7 — Random(min,max) closed form `imul 0x1f31d / 0xb14 / 0x41a7` (127773/2836/16719)
- Same two sites as C6 (slab 0x506a35..0x506a49 and 0x506ab4..0x506ac8).
- This is the classic Lehmer-rand closed form (e.g. used by mSeed /
  XRandom?).✳ Everything modulo re-derivation of which RNG stream feeds
  these `imul`s remains open.
- Status: pin (2026-09-19) — byte-verified; NOT yet read to the *receiver*
  (i.e. what consumes (min,max) semantics).

### C8 — chunk cache builder FUN_00939b80
- true entry **0x939b80** (slab 0x539380, byte-pinned by assert strings
  C12). Semantics read 2026-09-19: args (worldX, worldY) →
  `chunk=(x>>9, y>>9)` (`sar 9`), `quarterCell=(y&0xff)<<8 | (x&0xff)`,
  then flat `tbl[cell]` lookup. **No ÷10, no +3/+13, no per-area
  origin.** This instrument ONLY does 512-frame lattice indexing — per
  F-anchor: NOT needing (3,3). Cross-listed in VERIFIED §11 as part of F1.
- Its caller (quoted in ledger F1) invokes it at per-chunk boundaries
  cx±256, cy±256 (4-quadrant probe; DAT_0x132aed8 bit-grid).

### C9 — the two area-grid SetSize call sites
- **true 0x90738f** (slab 0x506b8f) and **true 0x907852** (slab 0x507052)
  — inside `ProceduralTerrain::Init` (0x9066a0..0x9072a0-family walk,
  sep 2026-09-19 dig #3). First = float grid (`realloc w·h·4` bytes,
  verified reading true 0x8f95c0); second = u16 twin (not yet read in
  detail). Both calls take `([area+0x50]<<9)÷10`, `([area+0x54]<<9)÷10`
  per C11.
- Status: pin + read (2026-09-19).

### C10 — area float grid layout: float32, w·h (4·w·h bytes realloc)
- Verified by reading the reshaping at true 0x8f95c0 (slab 0x4f8dc0):
  stores w/h, allocates 4·w·h bytes. ⇒ **the +0x18 grid = one FLOAT32
  per 10-px atlas cell**. Status: read (2026-09-19).

### C11 — area grid dims = `[chunkExtent << 9] ÷ 10`; NO additive anchor
- area+0x50 = chunk WIDTH (verified: used as the row multiplier `imul` in
  the per-chunk lookup at slab 0x506c35), area+0x54 = chunk HEIGHT
  (outer loop bound `cmp` at slab 0x506c1a).
- **No in-binary (3,+3/13) additive constant found in any area-grid
  geometry path so far.** The measured (3,3) of our port is increasingly
  a local port artifact, not a game constant — pending the values-write
  read (queued — gates the F2/F3 handoff).

### C12 — assert / edge-constant addresses (byte-pins for re-entry)
- true **0x1179e90 / 0x1179ef0** = cache-builder assert string block
  ("chunk_top_left" / "chunk_world_index" per F1's raw text).
- true **0x116ea50 / 0x1179f1c** = quarterCell lattice bounds asserts.
- true **0x1151084** = the *"expected %d, got %d"-family push target;
  esi-field load always `add $0x76c` before it.
- true **0x1327699** = a resettable byte (checked in the same walk —
  `ClearPath warn` path's reset byte referenced by the fill family).

### C13 — VA map: slab VA + 0x400800 = true VA
- slab: `python3 f[0x400c00:0xdd0000] + objdump --adjust-vma=0x401000`
  ⇒ slab VA = file_off + 0x400; true VA = file_off + 0x400c00.
- **Proof anchor (do not re-derive):** byte `cmp eax, 0xFF420000` is at
  file 0x500e4d; Ghidra calls it 0x901a4d; slab 0x50124d (0x400800
  different).
- Mixing convention: any Ghidra-derived name → use true VA; any fresh
  objdump read → cite slab VA **and** true VA both; always verify a
  named target by first byte-pinning a prior-verified constant inside it.

### C14 — stb / fill-subsystem ÷10 interior sites (label corrected 2026-09-19 (5))
- 3 hits at SLAB 0x8ec1b8 / 0x8ec1e8 / 0x8ec999 → **true 0xcec9b8 /
  0xcec9e8 / 0xcec999** — identity UNKNOWN (the earlier "inside the stbhw
  fill subsystem" label was wrong — those slab VAs were never re-pinned).
  Verified this session: the true stbhw fill block (FUN_008ec9f0 = slab
  0x4ec1f0..0x4ec900) contains NO ÷10 magic. The ENTIRE slab has only TWO
  ×10 multipliers (`imul $0xa` byte-forms) — slab 0xdbb8a3 / 0xdbbe06,
  unnamed — and the 10.0f constant appears 32×, none inside the fill.
  **Implication: the ×10 bijection lives in stbhw's own generate
  step as address/lea arithmetic, OR the MapHandlerToBig-toBig upscale
  step is a noitool-side reconstruction that doesn't exist in-binary —
  F-anchor's open contract.**
- Status: located-slab (dig #2); identity + semantics **unread** — the
  F-anchor funnel's last structural lead (Threaded true-FUN_008eda10
  = slab 0x4eda10 tail).

### C15 — true 0x8e6d50 in-memory painter (slab 0x4e6550; read 2026-09-19 (5))- Per-record walker with 29-byte stride over a flat source blob with two
  stacked 512×512 byte-planes (offsets **+0x80001 / +0x80002 both
  R/W**: `sub%al,[ecx+0x80002]` = in-place erosion), per-record sqrt-
  luminance decay (`divss 0x11e0378` + sqrtf 0xc3322e...), composed
  0xAARRGGBB pixel writes into `[edi+0x3c]`-based image (`shl/or` at
  0x4e66a1..0x4e66c5), `[edi+0x34]=3` state mark, guard byte +0x12 flips
  after each record.
- Candidate identity (NOT canon): a per-burn aesthetics/lighting
  (darkness/erosion) painter over the 2-byte-plane source. NOT the
  wang→grid copier; NO anchor arithmetic.

## Values read but NOT yet meaningfully connected (do not re-scan)

- the 296-hit `0x66666667` scan (2026-09-19 dig #2): the terrain-relevant
  cluster pattern → 3 sites listed under C5; the remaining hits are
  unrelated ordinary ÷10 divisions elsewhere.
- `.plz` header layout (kept in ISSUES.md I9 — deliberately SHORT there
  to prevent overclaim; see I9's "no decoder claims" rule).

## Not in this table (yet) — flagged as future registrations

- The perlin core FUN_008fca60 family constants (×0.1, 1/9, 0.5,
  0.45/0.33/0.11, 0.94/0.95, 15.5) — recorded in ledger prose, need
  pinning + rows when F3 starts.
- 0x11e0504 / 0x11e04ec normalizers for the mSeed-chain float (+0x94).
- The 20-byte movdqu record-stride idiom (3 queue sites) — semantics
  recorded 2026-09-19; needs a name once assigned.

### C16 — FUN_00901510 ray-walk stop conditions (read + ported 2026-09-19)
- True **0x901510** = slab **0x500d10** (byte-pin anchor C13 verified at slab
  0x50124d this session). Args (ECX = out_map {w,h,pixels@+0x18}; stack
  startX, startY, ddx, ddy; returns EAX = black run length).
- Semantics: step while the cell's low-24-bit color == 0
  (`testl $0xffffff,(%eax)` @ slab 0x500d45); first non-black cell stops the
  ray uncounted; per-step bounds check; **max 0x2710 = 10000 steps**
  (`cmp $0x2710,%edi` @ slab 0x500d64).
- Used as: map_check = "no ShadeOfGrey in-binary — grey does NOT extend
  rooms". Port: `rayWalk()` in `lib/has-path.mjs`.
- Status: read (2026-09-19). Source: ABOUT_MATH 2026-09-19 (7).

### C17 — finalize black blit true **0x901450** (slab 0x500c50; read 2026-09-19)
- Unconditional literal `0xFF000000` writes (slab 0x500ccc) over a vector of
  **16-byte rect records (`sar 4` stride, `add $0x10`) with EXCLUSIVE ends**,
  per-cell bounds guards (incl. negatives). The blocked-room finalizer
  (our finalizeLite's blockList consumer) must use the same convention.
- Status: read (2026-09-19). Source: ABOUT_MATH 2026-09-19 (7).

### C18 — FUN_009013f0 rect-fill record convention (read 2026-09-19)
- true **0x9013f0** = slab **0x500bf0**. Fill color is an ARG (single
  blockOutRooms call site passes literal `0xFFFFFFFF` = WHITE, slab
  0x500e51); loops strict-`<` over the rect record
  {startX, startY, endX, endY} → **endX/endY are EXCLUSIVE**; degenerate
  zero-area rects are valid and recorded by the marker walker (no filter);
  per-cell bounds guards (slab 0x500c10–0x500c21).
- Port: `blitRect()` in `lib/has-path.mjs`; marker walker rewritten same
  session (ShadeOfGrey heuristic DELETED — eliminated as port-local).
- Status: read + ported (2026-09-19). Source: ABOUT_MATH 2026-09-19 (7).

### C3 re-confirmation (2026-09-19 (7))
- The 11 marker colors were re-seen this session as the walker's compare
  dwords at slab 0x500dc4–0x500e0a (exact forms with alpha byte 0xFF,
  e.g. 0xffff00ff = #ff00ff). No value changes; C3 stays canon.

### C19 — blockOutRooms trigger: template-path equality, TWO literals (read 2026-09-19, dig #2)
- The driver (true 0x904c20 family) guards the blockOutRooms walker call
  (FUN_00901580, slab 0x500d80; call at **slab 0x50505e**) with two inline
  std::string path compares: **"data/wang_tiles/coalmine.png"** (len 0x1c,
  literal @ .rdata **0x1173ec0**, compare at slab 0x504f2d..0x504f9d) and
  **"data/wang_tiles/excavationsite.png"** (len 0x22, literal @
  **0x11742a0**, compare at slab 0x504fad..0x50504b). Either match →
  walker runs (union, not XOR). This is `shouldBlockOutRooms` in-binary.
- **No standalone biome-name strings are used for this decision** ("coalmine"
  never appears as its own string in .rdata) — the selection is by template
  FILE PATH. The only wang-template path literals in the whole binary are
  these 3 (incl. `data/wang_tiles/extra_layers/coalmine.png` @ 0x1174c58).
- Hard truth: the only wang-template path literals in the whole binary are
  these 3 (incl. `data/wang_tiles/extra_layers/coalmine.png` @ 0x1174c58).
- Status: read (slab windows regenerated this session; proof anchor
  C13 slab 0x50124d re-pinned first).

### C20 — hasPath coalmine arms: same path compare inside hasPath (read 2026-09-19)
- true 0x901780 body: ECX=str, EDX=literal call **0x43ff0** (std::string ==
  const char* helper) with EDX = **0x1173ec0** ("data/wang_tiles/coalmine.png")
  at **slab 0x5011a4** → guard for the MARK walk (full-map scan `cmp
  0xFF420000` → write 0xFF000000, C1/C2 — the scan we already had).
- Second arm at **slab 0x5017ab..0x50187f** (same compare, inline form): on
  match, scan cells **x = 0x8c..0x9d (140..157), y = 0..14** and black-fill
  every cell whose dword == **0xfffefefe** (#fefefe = the overlay's white
  "stairs" color) via literal `cmpl $0xfffefefe` @ slab 0x501844. This is
  the in-binary truth behind noitool's "start_x = 142" (142 = first stair
  cell x in a 141-15 band search, not a fixed constant).
- Init arm: per-biome object walk (slab **0x507061..0x50707b**): byte
  [biome+0x1f8] → [obj+0x50]; if template == coalmine.png → load
  "data/wang_tiles/extra_layers/coalmine.png" (0x1174c58, len 0x29) into
  **[obj+0x8c]** (the hax overlay slot).
- Status: read (2026-09-19). Source: ABOUT_MATH 2026-09-19 (8).

### C21 — exhaustive wang-biome trigger census (data-side enumeration, binary rule applied; 2026-09-19)
- Biomes triggering the special hasPath families = biomes whose
  `wang_template_file` ∈ {coalmine.png, excavationsite.png}:
  - coalmine.png → **coalmine (ffd57917), tower/solid_wall_tower_1
    (ff3d3e37), _EMPTY_ (ffFF8080)**
  - excavationsite.png → **excavationsite (ff124445),
    tower/solid_wall_tower_2 (ff3d3e38)**
- Census: 174 biome XMLs mapped in `_biomes_all.xml`, **42 with a wang
  template** (32 `data/wang_tiles/*.png` + 5 static-tile fg + tower family
  sharing the 7 standard atlases + the_end.png ×3 biomes), 132 without
  (template/procedural biomes). The name-list flags this replaces were
  structurally wrong: all tower sub-biomes share the name "tower" (name
  namespace cannot distinguish them); _EMPTY_ was missing from both lists.
- Status: data-verified this session (paths parsed from the game's own
  XMLs = the binary's input); selection rule binary-verified (C19/C20).

### C22 — FUN_00900560 = the hasPath C0FFEE walker, exact semantics (read 2026-09-19 (10))
- true 0x900560 = slab **0x4ffd60**. (ECX = out_map incl. pixels@+0x18,
  EDX = &start point; stack: out visited grid, out AABB.)
- Semantics: assert start in-bounds (throws, string 0x1173c1c @ line 0x180);
  out grid = fresh **w·h 4-byte cells ZEROED**; out AABB = the flood's
  bounding box (seeded with start, grown per pop); BFS via an 8-byte
  point-pair vector (FIFO — pop front, push back); neighbor order
  **(x,y+1), (x−1,y), (x+1,y), (x,y−1)**; passable iff
  `(dword & 0xffffff) == 0` OR `dword == 0xffeeffc0` (**#c0ffee; CORRECTS
  dig #4's `0xFFEEC0FF` byte-reversed misread — pinned `cmp $0xffeeffc0`
  @ slab 0x500088 ✔**); visited cells get the FLOW-FIELD direction code
  **{2 down, 3 up, 4 right, 5 left} on the scratch OUT grid** (not the
  map!) — dig #4's "u16 deltas 0x2/0x5" saw 2 of 4 deltas on the WRONG
  grid. The real map is read-only in this walk.
- Status: read + registered (2026-09-19). Source: ABOUT_MATH 2026-09-19 (10).

### C23 — hasPath's overlay arms + driver-tail closure (read 2026-09-19 (10))
- Arm (stairs): true 0x901780, slab 0x5017ab..0x50187f: on coalmine-template
  match, scan cells **x = 0x8c..0x9d (140..157), y = 0..14**, cells whose
  dword == **0xfffefefe** (`#fefefe` white stairs) → write 0xFF000000 to
  the map cell. noitool's "start_x = 142" = this BAND SEARCH, not a
  constant.
- Arm (dark-green): slab 0x501ab4..0x501b09 (gated by the 0x1b flag byte,
  the hasPath return value): scan the OVERLAY (arg EDX) map in full;
  cells `cmp $0xff004200` = **#004200 dark-green** → write 0xFF000000 to
  the corresponding out_map cell (slab 0x501aef).
- **With the vendored overlay data (only #000000, #006400, #000064,
  #545454), both arms are DEAD (0 px)** → oracle-pinned port unchanged,
  no cache bump. Both constants registered here for future overlay data.
- **Driver tail CLOSED:** slab 0x5056a4 = the second-grid SetSize (w·h,
  4-byte elems = the float grid, C10 shape) + `call 0x4f92b0` = true
  **0x8f9ab0 = FUN_008f9ab0** (cave/marker sweep, flag = `push $1` =
  TRUE, 2nd of the two driver calls ✓) + ret @ 0x5057aa. **No u16 copy
  loop exists** — the wrap-modulo 4-byte copy-out (0x505610..0x5056a4)
  is the whole copy; u16 population lives inside FUN_008f9ab0.
- Status: read + registered (2026-09-19). Source: ABOUT_MATH 2026-09-19 (10).
