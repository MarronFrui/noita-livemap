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
| C19 | `0x1173ec0` / `0x11742a0` | blockOutRooms trigger: template-path equality literals |
| C20 | hasPath coalmine arms | mark walk gate + `0xfffefefe` stairs band + overlay loader |
| C21 | wang-biome census | 42 wang-template biomes; the trigger-biome exhaustive list |
| C22 | FUN_00900560 C0FFEE walker | FIFO BFS, flow-field deltas {2,3,4,5}, `0xffeeffc0` judge |
| C23 | overlay arms + driver tail | dark-green `0xFF004200` arm; ClearPath = logging-only; no u16 copy loop |
| C24 | `0x1327670` / `0x13289a8` | runtime MinX/MaxX config doubles (source of the 159/223 family) |
| C25 | simplex cores + perm tables | 2D simplex true 0x8fca60 (F2/G2/ktn/×40), 3D twin, quintic lattice noise |
| C26 | FUN_00908cb0 noise consts | ×0.1, 0.13717/0.13715, 1/9, 0.45/0.33/0.11 (+0.1/+0.111) |
| C27 | generator state chain | +0x94 = f32(draw·200000−100000); FUN_0090ce20 ctor; +0x94 read site |
| C28 | "Wang offset" config keys | BIOME_PATH_FIND_WORLD_POS_* = ConfigRegistry runtime keys |
| C29 | quintic lattice consts | 6.0/15.0/10.0 pentiad; perm 0x114d700; runtime gradient tables 0x12eec08 |
| C30 | true 0x908e70 consts | 0.07/0.035, 15.5, 0.0489275, 5.35, 0.95 (the ledger trio lives HERE) |
| C31 | area BitmapNoise grids | SetSize true 0x8f95c0: float +0x18 / u16 DECOR +0x38 / byte +0x58, all zero-init |
| C32 | true 0x8f9ab0 = BitmapNoise::LoadFromImageData | the u16 DECOR writer: image color → resolver [+0xb0] / map [+0xb4] → u16 / byte / float |
| C33 | true 0x8f4830 biome-def DECOR classifier | noise re-eval with mod-512 wrap (×1/512 @0x11df8b4), gate [+0x24]/[+0x28], result material [+0x4] |
| C34 | per-chunk DECOR owner layout | [+0xb4] float field (raw >0.5 gate), [+0xd4] u16 grid, [+0x1e0] DECOR write; evaluator2's `a` = the field value |
| C35 | lazy noise-table pair + 2nd core | init true 0x8fbfd0: [0x1327bd0]=perm u16, [0x1327720]=perm%12; true 0x8fc020 = unread noise core; ÷132 count fix |

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
- **E8-TARGET CONVENTION SETTLED (2026-09-20 dig #3, byte-tested):**
  the slab spans only .text's SECOND half (file 0x400c00.. = true
  0x801800..) — .text's LOWER region (file 0x400..0x400c00 = true
  0x401000..0x801800) is NOT in the slab. objdump therefore prints e8
  targets into that lower region as BELOW-BASE values, and the C13 rule
  still applies to them unchanged. Byte-verified: the floor helper
  called from FUN_00908cb0 prints `0x4c8b0` → true **0x44d0b0** = exe
  file 0x4c4b0 = a real SSE fp-round helper (`55 8b ec 83 e4 c0 83 ec
  40 … cvtss2sd … fld/fistp`), matches the call-site contract
  (xmm0 f32 in → float out → cvttss2si). Also corrects canon C20: its
  `call 0x43ff0` (slab print) = true **0x4447f0**, NOT "FUN_0043ff0".
- Mixing convention: any Ghidra-derived name → use true VA; any fresh
  objdump read → cite slab VA and true VA both, even for below-base
  e8 targets; always verify a named target by first byte-pinning a
  prior-verified constant inside it.
- **SECTION-BY-SECTION FILE MAP (PE header, 2026-09-20 dig #4 — AMENDS
  the "VA − 0x400e00" rule above):** imageBase 0x400000; true_VA =
  0x400000 + RVA. Raw-offset deltas per section: **.text file = VA −
  0x400C00 · .rdata file = VA − 0x400E00 · .data file = VA − 0x401A00**
  (the −0x400E00 rule is .rdata-ONLY; applying it to .data VAs reads the
  wrong bytes). .data raw backing covers only RVA 0xEEB000..0xF27400 =
  VA 0x12EB000..0x1327400; the .data tail (vsize 0x612F0 → up to VA
  0x134C2F0) has NO file bytes = BSS/runtime-only. That is where C24's
  0x1327670/0x13289a8 and F1's bit-grid 0x132aed8 live — their
  "runtime-only" status is now CONFIRMED by the section map itself (not
  just by a garbage read). Proof of the amendment: the C29 gradient
  table (VA 0x12eec08) IS inside raw-backed .data — read at file
  0xEED208 (see C29). Any prior "runtime-only" verdict that used the
  −0x400E00 rule on a .data VA < 0x1327400 must be re-checked per this
  map (checked this session: C24 + 0x13276ba + 0x132aed8 are all beyond
  0x1327400 → BSS → runtime — their verdicts stand).

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

- ~~The perlin core FUN_008fca60 family constants — need pinning + rows
  when F3 starts~~ → DONE 2026-09-19: registered as C25/C26/C27/C28
  (the 0.94/0.95/15.5 prose trio remains UNPINNED — do not use until
  byte-checked).
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

### C20 — hasPath coalmine arms: same path compare inside hasPath (read 2026-09-19; VA CORRECTED 2026-09-20)
- true 0x901780 body: ECX=str, EDX=literal call with EDX = **0x4447f0**
  (std::string == const char* helper; fastpath-arg prep loads EDX with
  the path literal **0x1173ec0** "data/wang_tiles/coalmine.png" — for the
  remaining path compares — then `call`S the helper) at **slab
  0x5011a4** → guard for the MARK walk (full-map scan `cmp 0xFF420000` →
  write 0xFF000000, C1/C2 — the scan we already had).
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

### C24 — BIOME_PATH_FIND_WORLD_POS_MIN/MAX_X = runtime config globals (read 2026-09-19 (11))
- Not compile-time constants: stored at driver/init (slab **0x50693a /
  0x506947**) as `movsd [biome+0x38] → 0x1327670`, `[biome+0x40] →
  0x13289a8`, then logged (format 0x1174b1c @ slab 0x506972). The VAs are
  beyond the mapped file sections (runtime-allocated).
- Consumers (all read the same globals): hasPath arg prep slab
  0x505061–0x50508e = `area<<9 − int(g1)/− int(g2)` (the fillXFrom/fillXTo
  source); the per-record area walker slab 0x507746..0x5077f0 =
  `10·v−5−int(g)` per-cell edge transform (the same long-division magic
  `0x38e38e39` + sar 5 controls the record-range loop).
- The port's 159/223 (`lib/has-path.mjs`
  `BIOME_PATH_FIND_WORLD_POS_*`) stays tagged `@prov noitool` — mechanism
  now pinned, static values remain unvalidated. No game-data XML carries
  them (grep this session); engine-side computed/registered.
- Status: read (2026-09-19). Source: ABOUT_MATH 2026-09-19 (11).

### C25 — poro noise cores: 2D SIMPLEX, 3D simplex, quintic lattice noise (F3 dig #1, read 2026-09-19)
- **ADDENDUM (2026-09-20 dig #4):** the perm-table mirror note's
  `f[262] = 151` was a wrap-misread — actual verification (session):
  both tables are 256 unique entries mirrored to 512, so table[262] =
  table[6] = 131 (lattice) — the MIRROR property is the fact. Simplex
  corner orientation byte-settled this session: hash inner index =
  `perm[j0] + i0` where i = floor(arg0-x), j = floor(arg1-y); corner1 =
  `perm[perm[j0+j1] + i0+i1]`; corner2 = `perm[perm[j0+1] + 1 + i0]`
  (loaded via table base 0x114ced1). Gradient construct from hash bits:
  mask4 = swap comps, mask1 = negate comp1, mask2 = comp2 ×−2.0.

- **2D simplex core = true FUN_008fca60 (slab 0x4fc260).** NOT value noise
  (ledger prose guess corrected). SSE-XMM0/XMM1 float args, returns f32.
  Identity anchors in-binary: the C12 assert idiom is absent here (pure SSE
  fn) — identity proven by its multiple previously-pinned constants
  (0.3660254/0.2113249/0.5 @0x11dfa34/0x11df9c0/0x11dfa94, all below).
- Constants (byte-pinned in .rdata this session, file_off = VA − 0x400e00):
  - `0x11dfa34` = 0.36602540 (= (√3−1)/2, F2 skew); `0x11df9c0` = 0.21132487
    (= (3−√3)/6, G2 unskew); `0x11dfa4c` = 0.42264974 (= 2·G2).
  - kernel `0.5 @0x11dfa94`; contribution = dot·t⁴ (t = 0.5−d², two
    `mulss %xmm6,%xmm6` squarings, Gustavson-style; slab 0x4fc372/0x4fc3bb).
  - gradient set: hash `perm[perm[j]+i] & 7`, `&7` → ≥4 axis-swap, bit0
    sign-flip `xorps 0x11e0c50` (−0.0), bit2 multiplier `−2.0 @0x11e05f0` /
    `+2.0 @0x11dfe68`.
  - final scale `×40.0 @0x11e0270` (slab 0x4fc4cd).
  - perm table @ **0x114ced0**: 256 bytes, mirrored to 512 (f[262]=151
    verified = wraps), starts 151,160,137,91,90,15,131,13,…
- **3D simplex twin = true 0x8fcce0 (slab 0x4fc4e0)** — F3 = 0.33333334
  (@0x11dfa18), G3 = 0.16666667 (@0x11df9a0), same perm 0x114ced0 family.
- **Quintic lattice noise (separate family) = true 0x8fc740 (slab 0x4fbf40)
  + true 0x900900 (slab 0x4fc100)** — perm table @ **0x114d700**
  (starts 23,125,161,52,103,117,70,37,…), `&0xff` wrap indices, quintic
  smoothstep constants `6.0 @0x11e00e8` / `15.0 @0x11e01a0` (t³(t(6t−15)+10)
  family; 0.94/0.95/15.5 recorded in ledger prose belong here/elsewhere,
  NOT yet pinned — do not cite as read).
- Status: read + pinned (2026-09-19). Source: ABOUT_MATH 2026-09-19 (12).
- **ADDENDUM (2026-09-20 dig #4):** `0x11dfd20` ("1/9 f64") is NOT exactly
  1/9 — byte-pin this session: **0.1111111119389534 = f32(0.11111111)
  widened to f64**. Use that exact value (K.ninth in `lib/noise-proto.mjs`).

### C26 — FUN_00908cb0 noise-transform constants (slab 0x5084b0; F3 dig #1)
- The per-cell sampler FUN_0090d860's noise evaluator. Reads the C24
  runtime config globals `0x1327670`/`0x13289a8` as coordinate offsets
  (slab 0x5084b6/0x5084c1 — they ALSO feed the noise args, not just
  hasPath), plus the previously-pinned diddle/÷ constants, and calls the
  pinned cores (byte-pin rule satisfied in-binary): `call 0x4c8b0`
  (floorf-family) twice @0x50853e/0x50854e, **`call 0x4fc260` (2D simplex)
  @0x50857a**, **`call 0x4fbf40` @0x5085c1**, **`call 0x4fc100` @0x50861b**
  (both quintic-lattice).
- Constants (byte-pinned in .rdata, `mulsd`→read as f64, `mulss`→f32):
  - `0x11dfd08` = **0.1 (DOUBLE)** — the ×0.1 record (ledger prose ✓).
  - `0x11dfd38` = 0.13717; `0x11dfd30` = 0.13715 (f64 pair feeding the
    simplex call at 0x50857a).
  - `0x11dfd20` = **0.11111111 = 1/9 (f64)** — feeds the 0x4fbf40/0x4fc100
    lattice-noise args (ledger prose ✓).
  - After the first simplex: `×0.45 @0x11dfa5c` then `+0.1 @0x11df974`
    (slab 0x50857f/0x508594).
  - Weight block: `(1.0 − w)·0.33 [+0.111]`: `0.33 @0x11dfa10`,
    `0.111 @0x11df97c`, `1.0 @0x11dfbf0` (slab 0x5085d1..0x50860e).
  - smoothstep-x block in the caller (FUN_0090d860): `3.0 @0x11dff70`,
    `2.0 @0x11dfe68`, `0.5 @0x11dfa94` (slab 0x50d456/0x50d484/0x50d4ae).
- Status: read + pinned (2026-09-19). Source: ABOUT_MATH 2026-09-19 (12).

### C27 — generator-object state chain (F3 dig #1, read 2026-09-19)
- **Per-cell generator ctor FUN_008f9470 = slab 0x4f8c70** (identity
  confirmed: diddle `0x11e0ba0` ref @slab 0x4f8d5d inside it). Body: zero
  ~0xb8; `[obj+0x8c]` = raw seed arg; diddled ws = (double)ws + diddle[hi]
  (`addps 0x11e0ba0(,%eax,8)`), `comisd 0x11e0220` → halve if ≥ 2³¹
  (`mulsd 0x11dfdd8`); TWO `call 0xc090c0` on a stack-local Random at
  [esp+8] (Random ctor/setRandomSeed + ONE Next draw); finally
  `[obj+0x94] = f32(draw × 200000.0f[@0x11e0504] − 100000.0f[@0x11e04ec])`
  (slab 0x4f8da1..0x4f8db1). canon with VERIFIED §7 mSeed family.
- **FUN_0090ce20 = slab 0x50c620** — the 0x1ec-byte world-grid generator
  object ctor; `+0x98` sub-object ctor `call 0x4f8c70` with the pushed
  seed ([ebp+0x8]); init walk zeroes to +0x1e8. (= VERIFIED §11 stage 3.)
- **A +0x94 READ site = slab 0x50c9d5 (true 0x90d1d5)**, inside a walk that
  also reads `[edi+0x58]` (virtual call) and adds `[edi+8]/[edi+4]`
  origins, converts int→double and calls **0x5095a0; true 0x909DA0**
  (chunk-map accessor: adds the object's OWN `[this+0x38]`/`[this+0x40]`
  doubles to the coords (slab 0x5095b6/0x5095bf), wraps mod `[0x50]`=W /
  `[0x54]`=h via `sar 9`+`idiv`, indexes vector `0x68` via 0x54bf00,
  requires slot->`+0xc4` byte == 0 to return the entry). ⇒ the
  `mInsidePerlin`-family noise args = per-cell generator +0x94 state
  (+0x1000-scaled? — the ±0x1000 mark move not read) + object origin,
  offset by a per-biome double pair.
- Status: read (2026-09-19). Source: ABOUT_MATH 2026-09-19 (12).

### C28 — "Wang offset" = the config-keyed source of C24's doubles (resolved statically)
- The biome-def `[biome+0x38]`/`[+0x40]` doubles live in objects that ALSO
  carry `[+0x50]/[+0x54]` (w/h ints) and a `+0x68` vector (see C27's
  true-0x909DA0 accessor) — i.e. the +0x38/+0x40 convention belongs to the
  same per-biome map class, not just one struct.
- Config KEY names in .rdata (byte-pinned this session):
  `BIOME_USE_BIG_WANG` @0x116c762, `BIOME_PATH_FIND_HEIGHT_LIMIT`
  @0x116c776, `BIOME_PATH_FIND_WORLD_POS_MIN_X` @0x116c7da,
  `BIOME_PATH_FIND_WORLD_POS_MAX_X` @0x116c85e. **Name strings are NOT
  referenced by any imm32 anywhere in the binary exe (whole-file scan,
  verified vs the C19 literal control which finds 4/4 hits) — they are
  ConfigRegistry entries resolved at runtime by name (engine config
  defaults), NOT parsed from any game-data XML** (grep of extracted
  data dir this session: zero `path_find` matches).
- Consequence: the C24 159/223 port values = engine runtime config;
  static re-derivation stops here without a runtime config dump or
  cheat-engine read. Port `@prov noitool` tag remains + now has a defined
  mechanism statement: registry-default doubles, per-biome "Wang offset".
- Status: read (2026-09-19). Source: ABOUT_MATH 2026-09-19 (12).

### C29 — quintic lattice constants + runtime gradient tables (F3 dig #2, 2026-09-19)
- Quintic-lattice perlin = true 0x8fc740 (slab 0x4fbf40) + true 0x900900
  (slab 0x4fc100): 2D gradient perlin, quintic fade
  `6.0 @0x11e00e8 / 15.0 @0x11e01a0 / 10.0 @0x11e015c` (byte-pinned
  2026-09-19), perm 0x114d700 with `&0xff` wrap, 4-corner bilinear.
- Gradient VALUE table = RUNTIME .data: `0x12eec08` (gx per grad, stride
  8) vs `0x12eec0c` (gy) — contents not statically readable
  (runtime-initialized); gradient index = `perm2[perm[perm[i]+j]] & 7`.
- The 0.94 ledger-prose remnant: NOT found in either lattice function —
  still UNPINNED anywhere in the noise family.
- Status: read + pinned (2026-09-19). Source: ABOUT_MATH 2026-09-19 (13).
- **MAJOR CORRECTION (2026-09-20 dig #4, full byte-trace of both lattice
  functions):**
  - **true 0x900900 (slab 0x4fc100) is quintic VALUE noise, NOT a
    gradient-perlin twin**: corner values = raw perm bytes
    `perm[perm[i±1]+j±1]`, divided by **255.0 f32 @0x11e0378** (byte-pinned
    `0x00007f43` this session), symmetric quintic bilinear (fade 6.0/15.0/
    10.0 @0x11e00e8/0x11e01a0/0x11e015c), then `(v − 0.5)·2.0`
    (0.5 @0x11dfa94, 2.0 @0x11dfe68; slab 0x4fc240..0x4fc248) — output
    range [−1,+1]. It does NOT touch the gradient table.
  - The gradient pair table (`perm[perm[i±1]+j±1] & 7` index) belongs
    **ONLY to true 0x8fc740 (slab 0x4fbf40)**.
  - **0x8fc740's second y-blend is ASYMMETRIC** (byte-settled): the high
    column lerps between `dot_SE` and the ALREADY-BLENDED column-i value
    (`vy1 = (dSE − vy0)·qy + dNE`, slab 0x4fc0b4..0x4fc0c8) — ported
    verbatim in `lib/noise-proto.mjs`.
  - **GRADIENT TABLE FOUND IN-FILE (2026-09-20, closes the dig #4 hunt):**
    the earlier "runtime-only / CE read required" verdict was an artifact
    of reading with the .rdata file-rule (VA−0x400E00) on a .data VA.
    Per the C13 section map: .data file = VA − 0x401A00 → the table
    @VA 0x12eec08 sits at **file 0xEED208** and contains 8 REAL gradient
    pairs (byte-pinned this session, f32 pairs, stride 8):
    `0:(−1,0) 1:(1,0) 2:(0,−1) 3:(0,1) 4:(−1,−1) 5:(−1,1) 6:(1,−1) 7:(1,1)`
    — gy @0x12eec0c = the second dword of each pair ✓. NO placeholder,
    NO randomness, NO CE read needed. `lib/noise-proto.mjs` GRADIENTS =
    these exact bytes. (Also note: 0x12EEC08 has no `.data` zero-fill —
    raw-backed content is authoritative.)

### C30 — true 0x908e70 second-noise evaluator constants (slab 0x508670; dig #2)
- Constants (byte-pinned 2026-09-19): `0.07 f64 @0x11dfce8`, `0.035 f64
  @0x11dfc98`, **`15.5 f32 @0x11e01b0`**, `0.0489275 f32 @0x11df944`,
  `5.35 f32 @0x11e00b4`, `0.95 f32 @0x11dfbac` — the ledger trio
  15.5/0.95 is pinned HERE (in the sampler's second evaluator), not in
  the cores.
- Recipe (slab refs): `q = lattice2d(x·0.035, y·0.07)` (0x4fc100 call
  @0x5086ac, anisotropic); warp `(x,y) := (x + q·15.5)·0.0489275` each;
  `s = simplex2d(warp)` (0x4fc260 call @0x5086fa); return the comiss
  tail @0x50872c: `if (0.5 > val) ret 0.5 else val` — per-asm = a LOWER
  clamp at 0.5 of `a + s·((a−0.5)·0.5)²·5.35·0.95` (a = the incoming
  f32; x,y = f64 args). Re-verify the clamp direction when porting.
- Status: read + pinned (2026-09-19). Source: ABOUT_MATH 2026-09-19 (13).

### OPEN — e8-target VA-convention question (**RESOLVED 2026-09-20, see C13**)
- Byte-tested: the floor helper's below-base print `0x4c8b0` = true
  **0x44d0b0** = exe file 0x4c4b0 = a real SSE fp-round helper. The slab
  never contained .text's lower half (true < 0x801800) — that is the
  whole anomaly. C20's helper corrected to true 0x4447f0. CLOSED.

### C31 — area BitmapNoise grids: SetSize true **0x8f95c0** (slab 0x4f8dc0)
- (ECX=this, w=[ebp+8], h=[ebp+0xc]): `[+0x0]=w [+0x4]=h`, then THREE
  zero-init grids (alloc 0x114a35c, free 0x114a358, memset 0xc3325e):
  **[+0x18] float (4·w·h B, cnt [+0x1c]) · [+0x38] u16 (2·w·h B, cnt
  [+0x3c]) = the DECOR material grid · [+0x58] byte (w·h, cnt [+0x5c])**.
- Call sites = the two area-walk sites true 0x90738f/0x907852 (C9;
  targets byte-confirmed: `e8 2c 22 ff ff` → 0x4f8dc0 and
  `e8 69 1d ff ff` → 0x4f8dc0).
- Status: read (2026-09-20 (18)). Pairs with C32 (the grid's writer).

### C32 — true **0x8f9ab0** = `BitmapNoise::LoadFromImageData` (slab 0x4f92b0)
- Assert strings: base 0x1173720; part 1 @0x1173750 (line 548,
  "mDataFloat.IsValid"); part 2 @0x11737fc (line 612,
  "material_id < USHRT_MAX"); part 3 @0x11738dc. VERIFIED §9 item 5's
  "random-material fill" for the area class = THIS.
- Per-cell recipe (slab 0x4f93f1..0x4f9962): color via the wrap-mod
  u32 getter **true 0x9fe3c0** (slab 0x5fdbc0); alpha
  `& 0xff000000 == 0xfe000000` → byte-mark 1 (+0x60 wrapper, 0x54a1d0,
  resize gate [+0x7c]); skip iff color==0 ∨ RGB==0 ∨ alpha==0;
  **A-channel = fn-ptr [this+0xb0]** (color→material id ≤ 0xfffe) →
  **u16 grid [+0x38] (0x54a0f0) = A+1** (`inc %eax` @0x4f96bc, write
  @0x4f9751), float grid [+0x18] = ±1.0 (−1.0 iff A+1==1,
  consts 0xbf800000/0x3f800000); **B-channel = map [this+0xb4]**
  (find 0x5fdc50; "script_id < 255" line 611) → byte grid [+0x58] =
  B (0x5493b0, low byte @0x4f98af) + record {x,y,B,B−1} pushed to
  the +0x80 vector (0x52e370); fallback = float-only grey
  `(R+2G)/3.0` (mulss 0x11df8bc ×2, div 3.0 @0x11dff70), + u16 resize
  gate [+0x3c] (helpers 0x52e000/0x52e050).
- Part 2 (flag [ebp+0x10]≠0, slab 0x4f9994): per-marked-cell neighbor
  pass over the wrap-mod u16/wrapped getter; homogeneous-adjacency
  predicate = **true 0x9fe570 (majority-of-nonzero)**; on hit write
  **u16=1 + float=−1.0** (slab 0x4f9c28..0x4f9c53). Part 3
  (slab 0x4f9f17): reload into a DOUBLED alloc array (2× cnt
  `add %eax,%eax`, ptr [edi+0x18]) gated by
  `material(x,y)==0 && float(x,y)!=0` (float getter **true 0x9fe620**,
  slab 0x5fde20 — same wrap-mod).
- Driver calls (2×, flag=1): slab 0x5055d7 / 0x50571e = true
  **0x905dd7/0x905f1e** — sources: the accepted out_map (edi) and the
  wrap-copy twin; dims (w,h) at [edi+0]/[edi+4].
- Status: read + registered (2026-09-20 (18)/(19)). Resolver bodies
  ([+0xb0]/[+0xb4] config side) remain OPEN (17 .rdata "RandomMaterials"
  parse sites true 0x496a2e..0x4a97ed — data-side, config).

### C33 — the biome-def DECOR classifier **true 0x8f4830** (slab 0x4f4830)
- Unit string "…procedural_utils/biome_ma…" @0x1173240 (the
  biome_materials.cpp module); helper strings 0x118c9f4
  ("mInitialized"), 0x11732c0 ("mCellFactory").
- Read: gate consts [this+0x0]/[+0x4] (comiss vs xmm0=arg f32,
  0x4f4919/0x4f4922); the per-cell job runs over an array of
  **132-byte-stride records** (`magic 0x3e0f83e1` = 1041204193 imul,
  sar 5 = the signed >>37 reciprocal — **the count = (end−start) ÷
  132, NOT "÷26"; byte-computed 2026-09-20 dig #7, the earlier
  "÷-26.0" row-gloss retracted** — M·132/2³⁷ = 1.0000000000; the
  per-iteration stride `add $0x84,%esi` = 132 B/record ✓); loop
  0x4f4960/0x4f4f3b, members per record (0x84-stride):
  noise weights [this+0x30]/[+0x34] (X/Y f32 mulss — y = [ebp+0xc] = X
  ✓ CORRECTED call-site map: [ebp+8]=Y-int, [ebp+0xc]=X-int), the wrap
  window (C `% 512` signed idiom + `mulss 1/512 = 0.001953125
  @0x11df8b4`), alpha/misc config bytes [+0x38..+0x46], gate window
  [+0x24]/[+0x28], and the RESULT **material id = [this+0x4]**.
- Status: read (2026-09-20 (19)) — NOT ported; body semantics (the
  liq-selector family) = the P3/P5/P6 open read. Call sites (slab
  0x5087b0 → true 0x908fb0 (the per-cell cell-object walk);
  0x508b5b → true 0x90935b; 0x50d57e → true 0x90dd7e = the (16)
  sampler paint arm ✓).

### C34 — the per-chunk DECOR owner layout (sampler true 0x90d860 family)
- Owner = `[cell+0x18]` (per-chunk aggregate; layout byte-pinned at slab
  0x50d21c..0x50d698): name registry [+0x90] (reader 0xb78e0) · float
  dims [+0x9c] · **[+0xb4] FLOAT-field grid wrapper (getter 0x5491f0)** ·
  u16 dims +0xbc · **[+0xd4] u16 grid wrapper (getter 0x54a0f0;
  [owner+0xbc] = w) · [+0xd8] = the u16-init flag (cmp 0)** · byte dims
  +0xf0/+0xf8-flag · **[+0xf4] byte-grid wrapper (getter 0x5493b0, the
  0xFF-mark gate at slab 0x50d360..0x50d369)** · +0x1c8 u16 DECOR dims ·
  **[+0x1e0] u16 DECOR grid (writer 0x559de0)** — idx =
  `[owner+0x1c8]`·y + x.
- **The sampler's > 0.5 gate = the [+0xb4] field read raw** (comiss 0.5
  @0x11dfa94, slab 0x50d3c3) — NOT the evaluator's output. The
  evaluator2 call (slab 0x50d50e, true 0x508670 = C30) consumes this
  SAME loaded value as its `a` argument (`xmm2 = [esp+0x24]`), for
  unpainted (u16==0) cells only, and goes through the +0x2a4-flag check
  (`cmpl $0x0,0x2a4(%eax)` slab 0x50d501) first — then the C33
  classifier `call 0x4f4830` (slab 0x50d57e, ecx = `[obj+0x2a4]`,
  stack y-int/x-int).
- C26's smoothstep 3.0/2.0/0.5 constants re-byte-confirmed INSIDE this
  walk (slab 0x50d456/0x50d484/0x50d4ae: 3.0 @0x11dff70, 2.0
  @0x11dfe68, 0.5 @0x11dfa94) — but they build an iu/jv FLOOR-SNAP
  (smooth-corner un-interp: mulss 2.0 on the f², movss 3.0 →
  (3.0−2·f)·f² weight, comiss 0.5 → iu/jv bump), i.e. the (u,v)-pair
  from noiseTransform drives a **4-corner bilinear material
  interpolation on the [+0xd4] u16 grid**, whose per-corner reading is
  the C32 WRAP-MOD u16 reader (slab 0x50d4ce, ECX = `[ebx+0x28]+0x20`).
- The sampler's named-material lineage: kind from `[rés+0x38]` (returned
  by the paint arm's vtable get) == 1 → growable
  (`lock xadd`, cmp $0x2000) index array `mov 0x4(%edx,%eax,4)` name
  pick (slab 0x50d61b..0x50d62a); == 3 → global byte flag 0x1344ce1 +
  `call 0x603fd0` (slab 0x50d595..0x50d5ab); then CellFactory
  validate `call 0x363cd0` (slab 0x50d651; C33's "mCellFactory" unit)
  and the old-value release (`*0x114a348` slab 0x50d669).
- Status: read + registered (2026-09-20 (20)).

### C35 — the lazy noise-table pair + the second noise core (dig #7 audit)
- **true 0x8fbfd0** (slab 0x4fb7d0) = one-time lazy init (BSS flag
  **0x13289bd**, cmpb/movb-1 guard): for i<256, from .rdata
  **u16[0x114cc50] (stride 2 — starts 151,160,137,91 = the C25 simplex
  perm copy as u16)**:
  - **[BSS 0x1327bd0][i] = perm_val** (u16 ×512)
  - **[BSS 0x1327720][i] = perm_val % 12** (idiv esi=12, dx rem) — the
    mod-12 derivative table (12 = direction-count hypothesis,
    UNVERIFIED; readers of 0x1327720 = the pinned next read).
  Both targets beyond .data raw backing (0x1327400) = BSS/runtime ✓ C13.
- **true 0x8fc020** (slab 0x4fb820) = UNREAD 2nd noise core used by the
  C33 classifier's re-eval: f64 args (`esi·rec[+0x34]` arg1, `edi·
  rec[+0x30]` arg2), calls the init above, runtime f64 consts
  **0x132ab68 / 0x132ac70** (BSS — unpinnable statically), comisd
  corner rule, movzbl perm-indexing. NOT the 0x900900 value-lattice
  (retracted gloss).
- **true 0x8fbe60** (slab 0x4fb660) = UNREAD ("Phase-2 noise" label is
  ours — flag only). **call 0xc08ea0** (slab 0x4fb660-adjacent region;
  lower-half fn) = UNREAD ("alpha walk" label — flag only).
- Status: audit-registered (2026-09-20 (21)). POISONED retracted in
  C33: "÷-26.0" (real: **÷132** — M·132/2³⁷ = 1.0 exactly) and the
  "0x900900 family" attribution for 0x4fb820.
