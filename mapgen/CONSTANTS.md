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
| C36 | NOISE_TYPE dispatch + fbm | true 0x8fd920 switch @table true 0x8fdaa4 (cases 0..8); true 0x8fdad0 = 4-octave fbm (amps 0.5/0.25/0.125/0.0625, lac 2.02/2.33, ÷0.9375) |
| C37 | surface-field evaluator (P1 blend) | true 0x90a860 recipe + uid offset map ([+0x1d4]=BitmapNoise, [+0x220..0x268] config, final = MultGrad·gradW + MultPerlin·r + AddValue) |
| C38 | surface-math .rdata pins | 0.02/0.0241/0.025/0.02789, 0.05, 0.51, 0.85, 0.495, 0.49162514, 0.05243442, 2.02/2.33, 1.0e-3/9.765625e-4, seed scales |
| C39 | the [uid+0x1d4] fill chain + 0x8fc020 decoder | SetSize+Load wrapper true 0x8fa930; loader true 0x90e060 ("plz"→LoadImageFastLZ); case-5 core READ (mod-12 grads @0x12ee338, ×70); port in noise-proto.mjs |
| C40 | case-1 lane core (sin-hash lattice) + IAT math table | true 0x8fb350 = whiteLattice2d: c0=57·round(y)+round(x), corners frac(sin(c0+k)·43758.546875) k∈{0,1,57,58}; 0x44d110=libm sin-precise (slot 0x114a520); 0x44d0b0 = fld/fistp round |
| C43 | gradient-grid setter stacks (W5 core) | 0x4edf50 = float-grid setter; 3 layer-callers with fraction-bands (0.32·d+0.35 / 0.35·d+0.65); mGradient* = likely these stacks' params. **CE-VERIFIED 2026-09-20 (35): [uid+0x224] = 5 = noiseType-int (the dispatcher case = the 0x8fc020 crest — W2 CLOSED empirically); [uid+0x220] = addNoise {3, 0}; [uid+0x230/0238] = f64 ScaleX/Y (0.9999-hills ✓); [uid+0x244/248] = 0.057143 / 2.0 ✓; [uid+0x264] = mMultiplierGradient (0.871429-hills ✓); [uid+0x268] = mMultiplierPerlin (1.0-hills / 0.642857-winter ✓ — CORRECTION of the (23)-map: the pair swapped); [uid+0x1d4] = the BitmapNoise ptr — the hills-class = w260✓h260 = a real 67600-float grid (row [1,1,1…0.7961…1]); the winter-class pointer = a 1×1-unbound placeholder; one candidate = a 3584×2457-cnt-8.8M = the WORLD-state-grid (C31-family!)** |
| C44 | BitmapCaves band-stack family (P5) | fn A true 0x8EEC70 (L1) · fn B true 0x8F5DD0 (L2+L3) · factory fn C1 true 0x8F2FF0 (dims = BitmapCaves size_x/y = w[+0x1c]/h[+0x20]; cache map @0x132aae8 keyed by name); band consts 0.32@0x11dfa00 / 0.35@0x11dfa20 / 0.65@0x11dfb14 (all pinned 2026-09-21); [-0x128]=d·3.0+1.0, [-0x108]=d·0.1+0.1. **NO C37 config slot read by the family ⇒ "mGradient* = band-stack params" ELIMINATED** (see the C44 registry row) |
| C45 | FNV24 hash + lattice + corner table | hash true 0x8FB2D0 (FNV-1a over 24B {x_d64\|y_d64\|1234567.0-sentinel @0x11e0180}, idx = ((h>>8)&0xff)^(h&0xff)); the 256-f64 corner table .data 0x12eb950 (data_raw off 0x950; the C41 "12-dir pairs" = only the first 12, SUPERSEDED); lattice true 0x8fc940 = smoothstep 4-corner bilinear (rows in x by wx, out = wy·(rowT−rowB)+rowB; corner order pinned). C41's "0xc31cea walk" = the /GS cookie check (retired). fbm = CONSTANT quad {sin1,cos1,cos1,−sin1} @0x11e0c70 + **lac 2.01 @0x11dfe78** (new pin); case-4 args 7123.1234 @0x11e00d8 / 1020304.1234 @0x11e0170 |
| C46 | BitmapCaves stamp-carve family (W5 field build) | fn A true 0x8EEC70 (CaveStructure stamp walker, recursion = cave_childs) · blob setter true 0x8EE750 (max-bleed + circle falloff) · scatter engine 0x8EF2D0 · blend twins 0x8EF870/0x8EF950 · roll/envelope consts 0.35/0.25/0.32/0.35 @0x11dfa1c/d0/a00/a1c, envelope 0.2/0.3/0.4/0.6/0.7/0.33; READ, not ported (sub-reads named) |

| C47 | C24 runtime decode (CE v4) | [0x1327670] = **17920.0**, [0x13289a8] = **7168.0** = the canvas/world offset pair (NOT a fill window; the "159/223 = engine defaults" reading dies); slopeFlag [+0x24c] = 0 all 42 uids (slope arm dead in live data); BitmapCaves std::map count = 4; A-resolver [P+0xb0] = NIL (P = the caves-grid object does NOT carry it; target corrected to BitmapNoise instances); live 512x256 bitmap_hills grid values recorded (byte-level I1 validation anchor; y=0 rows exceed 1.0 per the (y/25)^8 eave) |
| C48 | caves-grid [P+0x94] signature + byte oracle | [P+0x94] = (w·0.5)/0.1 on cave grids (512→2560.0, 1×1→5.0 = the fn C1 ×5 toucher, byte-cross-verified); the world-state grid keeps the RAW C27 draw (−56909.828125, no ×5); both 512×256 cached grids byte-identical ⇒ the caves field = deterministic (diddled ws, name, XML params); the y=0 bump (peak 1.454@x≈19) = a stamp ADD-BLEND over the 1.0 base (writer = 0x8EF870 twin / bake, named target); oracle artifact `mapgen/out/oracle/caves-grid-2026-09-21.json` |
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
  C33: "÷-26.0" (real: **÷132** — M·132/2³⁷ = 1.0 exactly)
  and the "0x900900 family" attribution for 0x4fb820.

### C36 — NOISE_TYPE dispatcher true **0x8fd920** (slab 0x4fd120) + fbm true **0x8fdad0** (slab 0x4fd2d0)
- Dispatcher: switch on ecx ∈ [0..8], jump table @ true **0x8fdaa4**
  (exe file 0x4fcea4; entries stored AS true VAs; byte-pinned
  2026-09-20 (23)): case 0 → core slab 0x4fab50, 1 → 2-arg-f64 slab
  0x4fb050, 2 → slab 0x4fb150, 3 → slab 0x4fb340, 4 → 2-arg-f64 slab
  0x4fb510, 5 → slab 0x4fb820 (**= true 0x8fc020: C35's 2nd core is
  dispatch case 5**), 6 → slab 0x4fbf40 (C29 gradient lattice),
  7 → slab 0x4fc100 (C29 value lattice), 8 → slab 0x4fc260 (C25 2D
  simplex). Default → assert (unit 0x1173678 = noise_utils.cpp).
- Fbm wrapper (true 0x8fdad0): lazy BSS flag **0x134874c**; state quad
  BSS **0x1348ac0** seeded from .rdata quad **0x11e0c70** (first f32 =
  0.8414700031 = sin(1.0)); 4 dispatcher calls; amplitudes 0.5/0.25/
  0.125/0.0625 (@0x11dfa94/0x11df9d0/0x11df984/0x11df950); per-axis
  growth 2.02(@0x11dfe7c)/2.33(@0x11dfee8); output = Σ ÷ 0.9375
  (@0x11dfba8; Σ amps = 0.9375 compute-checked ✓). Per-octave state
  trace = port-time TODO.
- Status: read + registered (2026-09-20 (23)).

### C37 — surface-field evaluator true **0x90a860** (slab 0x50a060) — the P1 blend
> **2026-09-21 UPDATE (dig #22 #8 + the remap): the FINAL-combine = byte-corrected
> (supersedes this row's `[+0x268]·gradW + [+0x264]·r + [+0x260]` line and the
> insn (a)-lane polarity): out = [+0x268]·gradW·per + [+0x264]·rpost + [uid+0x260]
> with gradW = (r'−0.5)·2, r' = r·field0 (the field slot := r' at 0x50a2fe — ALL
> post-bilinear gates/lanes read r'), per = insidePerlin's out = [ebp-0x8],
> rpost = the post-case-lane value; add := 0 unless the case-switch path ran.
> [+0x268]≠0 RUNS the gradW/per lane (determines via ucomiss-0 + test ah,0x44-parity).
> The slope arm = per·(1+(rpost−1)·y·0.001) @0x11dfb58, gated [+0x24c].
> Source: ABOUT_MATH 2026-09-21 (40) + the remap addendum.**
- Evidence: `mapgen/out/d_2026-09-20-surface-evaluator.asm`. ebx = the
  per-biome config object ("uid"); xmm2/xmm3 = (x,y) f64; [ebp+8] = the
  IN/OUT field cell (scratch float).
- Gradient source: P = [uid+0x1d4] = a **BitmapNoise-class instance** —
  4× wrap-mod float getter **true 0x9fe620 (C32)** over P's float grid;
  g = (x·0.11dfdc8 (0.49162514 f64)) + (f64)(f32)[P+0x94]; inline floors
  (+1 neighbors); smooth-corner weights (3.0−2f)·f²; 4-corner bilinear
  → field; **lower clamp field ≥ 0.5** (the "CAPPED").
- r = true 0x90b280 (slab 0x50aa80); r' = r·field; the inner switch runs
  only when r' > 0.51 (@0x11dfaac) AND field > 0.85 (@0x11dfb84).
- Switch [uid+0x220] = **mGradientAddNoise** (1/2/3 per .rdata docs):
  case 1: x·0.025 → core slab 0x4fab50; r = core·0.05(@0x11df948)+0.05;
  math helpers slab 0xc33234/0xc33222 (true 0x1033a34/0x1033a22; ids
  1024.0 @0x11e0080, ·0.5 @0x11dfdd8, ·0.06 @0x11dfcd8) → **true
  0x8fc020**; tail `field += (r − field)·((field−0.85)/0.1)`. Cases
  2/3: same skeleton with cores slab 0x4fab50/0x4fb340/0x4fc260/0x4fb820
  and consts 0.0241/0.02789 (@0x11df910/@0x11df918), ÷100 (@0x11e02dc),
  ×5.0 (@0x11dfee0), f64 0.01123/0.01313/0.02/0.021 (@0x11dfc10/c30/
  c70/c78).
- Slope arm (byte [uid+0x24c]): field += (x·0.001 @0x11dfb58 f64)·
  (field − field_old); slope-start/delta slots beyond the bool UNREAD.
- FINAL: **field_out = [uid+0x268]·gradW + [uid+0x264]·r + [uid+0x260]**
  (gradW = (field−0.5)·2 in the [uid+0x268]==0 lane; that lane's r =
  true 0x90b110's output).
- **uid offset map (byte-settled):** [+0x1d4] BitmapNoise ptr ·
  [+0x220] mGradientAddNoise · [+0x224] mInsideNoiseType (dispatcher
  arg) · [+0x228] mInsideNoiseFBM · [+0x230]/[+0x238] ScaleX/Y ·
  [+0x240]/[+0x241]/[+0x242] Squared/Clamped/Scaled · [+0x244]/[+0x248]
  ScaleMin/Max (clamp + map [−1,1]→[Min,Max]) · [+0x24c] slope flag ·
  [+0x24d] OffsetBySeed (diddle 0x11e0ba0 ✓; f64 scales 1.312e−05
  @0x11dfa68 / 2.331e−05 @0x11dfa80) · [+0x250]/[+0x258] OffsetX/Y ·
  [+0x260] mInsideAddValue · [+0x264] mMultiplierPerlin¹ · [+0x268]
  mMultiplierGradient¹ — ¹ the LABELS = pre-CE ((23)); POSt-CE the VALUE
  slots = SWAPPED (+0x264 = the mMultiplierGradient value = the CE read
  0.871429-hills; +0x268 = mMultiplierPerlin = 1.0-hills/0.642857-
  winter) — see the C37 header & C43; the PORT's names = gradWCoef
  (=[+0x268]) / perlinCoef (=[+0x264]).
- Attribute names in .rdata = doc-strings only: whole-exe imm32 scan
  (incl. .data + full .rdata halves) = ZERO non-assert refs
  (mInsidePerlinScaleY/OffsetY/mGradientEndY only inside vector
  asserts; "Topology"/"_biomes_all.xml" zero) — attr lookup is
  runtime-driven; the layout is proven from the consumer side.
- Status: read + registered (2026-09-20 (23)). NEXT OPEN: the per-biome
  fill of [uid+0x1d4] (mBitmapNoise) for biomes without
  bitmap_noise_file.

### C38 — surface-math .rdata pins (2026-09-20 (23), byte-read; f32 unless noted)
- ladder 0.02(@0x11df908) / 0.0241(@0x11df910) / 0.025(@0x11df914) /
  0.02789(@0x11df918); **0.05 @0x11df948**; fbm amps 0.0625/0.125/0.25
  (@0x11df950/0x11df984/0x11df9d0).
- 0.495(@0x11dfa90); **0.51(@0x11dfaac)**; f64 1/1024(@0x11dfb50);
  0.001(@0x11dfb58); **0.85(@0x11dfb84)**; fbm ÷0.9375(@0x11dfba8).
- f64 0.01123(@0x11dfc10) / 0.01313(@0x11dfc30) / 0.02(@0x11dfc70) /
  0.021(@0x11dfc78); 2.0(@0x11dfc68 f32); f64 0.05243442(@0x11dfcc8);
  f64 0.06(@0x11dfcd8); f64 0.49162514(@0x11dfdc8); 1.5(@0x11dfd2c).
- f64 5.0(@0x11dfee0); 2.02(@0x11dfe7c); 2.33(@0x11dfee8); f64
  1024.0(@0x11e0080); 100.0(@0x11e02dc); −20.0(@0x11e068c);
  f64 1.312e−05(@0x11dfa68) / 2.331e−05(@0x11dfa80); f64 6.86e−07
  (@0x11dfa08, mulsd — semantics open).
- 0x11e0c70 quad head = 0.8414700031 (= sin(1.0)) — fbm state seed.
- **CANON RE-VERIFICATION:** every C25–C30 noise-constant pin re-read
  from the exe this session and matched (0.5/2.0/3.0/1.0/0.1/10.0/
  0.1-f64/0.5-f64/0.45/0.33/0.111/0.36602540/0.21132487/0.42264974/
  0.035/0.07/15.5/0.0489275/5.35/0.95). Coverage: the 0x11df800..
  0x11e0c70 band = exe f[0xdd0000:0xee9600] = NEW `rdata.bin` slice
  (adjust-vma 0x11d0e00); .data raw = f[0xee9600:0xf25a00]
  (`data_raw.bin`); PE header rules re-confirmed (C13).

### C39 — the [uid+0x1d4] fill chain (2026-09-20 dig #9b, same night)
- **true 0x8fa930** (slab 0x4fa130) = SetSize+Load wrapper: (this,
  src{w,h,pixels}, flag) → realloc own float grid w·h ×4 B + memset,
  then LoadFromImageData true 0x8f9ab0 (third+1 call site: slab 0x4fa19b).
  Direct e8 callers (only two): **true 0x90d1b1** (the per-cell-generator
  walk true 0x90cfb0, profiler "IMPL_DoBufferedPixelScene - bitmap noise
  loop" @0x11754c4, "LoadImage - material_image" @0x1175574, config
  fetch 0x4ce6a0 keyed by byte **0x13289b4**) and **true 0x8ee6bb**
  (biome.cpp; cite 0x1172ea8 "…RandomColor input_color output_colors"
  line 0x18d; news 0xb8 B; calls the C27 ctor **FUN_008f9470** →
  sets **[gen+0xb0] = 0x8ee1b0** (C32's A-resolver slot) + [gen+0xb4]
  B-map, then the same SetSize+Load).
- **true 0x90e060** (slab 0x50d860) = the file loader: `endsWith("plz")`
  ("plz" @0x1165fc4 vs C20's helper true 0x4447f0) → LoadImageFastLZ
  (assert 0x1175844 "LoadImageFastLZ() - Failed to load image:");
  else error "Error - loading file:" (0x11758e4) / 0x14000-limit assert
  ("ptr_to_file <= end_of_file" @0x1175974, lines 0x1163/0x1165/0x1167/
  0x116e/0x1186/0x1197 all f[0x1173a10] = procedural_terrain.cpp);
  outputs the {w,h,cnt,pixels} record into the caller's struct.
- Identity state: the surface evaluator's uid = the 0x1ec-B generator
  family (biome.cpp-built); [uid+0x1d4] float grid = image-baked
  (the Load/.plz pipeline above), sampled 4-corner by 0x9fe620.
- **ADDENDUM (dig #9c): the case-5 core true 0x8fc020 DECODED to
  formulas** (slab 0x4fb820..0x4fba7c): f64 args; telescoped skew t =
  ((x+y)·[0x132ab68]); i/j = floor(t+x)/floor(t+y); unskew [0x132ac70]
  → dx0/dy0 corner rule comisd (dx0>dy0 → (1,0) else (0,1)); G2/2·G2
  stride adds (single `2.0` mulsd @0x4fb92d then re-add); per-corner
  kernel t² · t² · dot(GRAD12[mod12-hash],d) with outside → 0; final
  ×70.0 (@0x11dffd0 f64). Gradient source = the C35 lazy tables
  ([0x1327bd0] perm-u16 from .rdata 0x114cc50, [0x1327720] = perm%12)
  → `shl 5 + 0x12ee338` = the 12-dir f64 pairs (stride 32 B, all 12
  byte-pinned this session: diagonals 0..3, axis-dirs 4..11 with
  duplicates). The two skew doubles = BSS runtime (UNPINNED — widened
  F2/G2 approximation flagged in the port's comment). Ported as
  `simplex2DDeriv` in `lib/noise-proto.mjs`.
- OPEN: per-biome material_image path resolution for hills/winter and
  the mGradient rasterize step (if any) inside biome.cpp before load.
- Status: read + registered (2026-09-20 (23)/9b/9c/26 (with the 0x8fc020
  decoder addendum)).

### C40 — the case-1 lane core true **0x8fb350** (slab 0x4fab50) — sin-hash value noise
- Read and ported 2026-09-20 (26). Formula:
  - `c0 = 57.0·round(y) + round(x)` — round = the C13-verified CRT
    fld/fistp wrapper true 0x44d0b0; 57.0 = f32 0x11e028c (pinned).
  - `fx = x − floor(x)`, `fy = y − floor(y)` (inline cvttss2si + comisd).
  - corner hashes `n = frac(sin(c0 + k)·43758.546875)`,
    k ∈ {0, 1, 57, 58} — the four-corner ±1/±57 lattice; sin via
    **true 0x44d110 (slab 0x4c910) = jmp*[0x114a520] =
    _libm_sse2_sin_precise** — identity RESOLVED via the MSVCR120.dll
    import-name records in .rdata tail: slots 0x114a514..0x114a530 =
    acos/log10/pow/sin/sqrt/tan/ceil/floor (the whole math-thunk family
    named this session; .rdata VAs = file+0x400e00 ✓ C13).
  - weights (3−2f)·f² per axis; the row lerp = rowA(wx: h58→h57), rowB =
    wx-lerp(h1→h0), FINAL = wy-lerp(rowA→rowB).
- The case-1 blend (slab 0x50a7eb..0x50a8a2): a = core(x·0.025, y·0.025);
  g = a·0.05 + 0.05 (both = 0x11df948); 0x8fc020 args = (x·0.5·0.02·g,
  y·0.5·0.02·g) (mulsd 0x11dfdd8 then 0x11dfc68); tail
  `field += (r' − field)·((field − 0.85)/0.1)`; then the [uid+0x24c]
  slope arm + the FINAL combine (all per (23)).
- Port: `whiteLattice2d` in `lib/noise-proto.mjs`; wired into
  surfaceField's case-1 lane (47 live XMLs); the V2 full-map smoke now
  computes 2194 chunks (winter/desert/pyramid/snowcastle = real texture,
  ~48–51% densities; honest throws remain only for cases 2/3 = 5 XMLs).
- Status: read + ported (2026-09-20 (26)); capture-check = the
  instruments' gate (WIRING_SURFACE.md §4).

### C41 — dispatcher-lane cores (cases 1–4) + the FNV/gradient tables (dig #12, 2026-09-20)
- **case 1 (true 0x8fd850, slab 0x4fb050) = "FastBlock" hash white noise**:
  seed = trunc(x)·**0x67577458** + trunc(y)·**0x5b**(91); then
  `h = (h^(h>>13))·0x343fd(214013) + 0x269ec3(2531011)`;
  out = (((h >> (1 + (trunc(x)&15))) ^ h) & 0x7fff) − 0x3fff (±16383 int)
  × **6.103515625e−05 = 2⁻¹⁴ = 1/16384** (@0x11dfae0 f64). = the
  fq-in/f64-out core; LCG constants byte-pinned.
- **case 2 (true 0x8fc550, slab 0x4fb150) = whiteLattice2d twin** —
  same skeleton as 0x4fab50; 57.0-mul; constant-lane diff open (flagged).
- **case 3 (true 0x8fc940, slab 0x4fb340) = FNV24-lattice w/ 12-dir
  .data pairs @ **VA 0x12eb950** (file .data+0x950; byte-pinned —
  12 f64 pairs, stride 16 B:
  [(−0.714286,0.301587),(0.333333,−1.0),(0.396825,−0.0793651),
  (−0.968254,−0.047619),(0.301587,−0.111111),(0.015873,0.968254),
  (−0.428571,0.428571),(0.047619,0.84127),(−0.015873,−0.746032),
  (−0.809524,−0.619048),(−0.301587,−0.68254),(0.777778,0.365079)]):
  hash = FNV-1a over 24 B {x_d64, y_d64, **1234567.0 f64 sentinel
  @0x11e0180**}; fnv bias 0x811c9dc5, prime 0x1000193, 24 B loop;
  idx = ((h>>8)&0xff) ^ (h&0xff); pair = lea 0x12eb950(,%eax,8) —
  the exact index map (mod 12?) walks via true 0xc31cea = UNREAD.
  Four-corner smoothstep bilinear of (gPair · dXY) dots.
- case 4 (true 0x8fd110, slab 0x4fb510): head mulsd 0x11e0240 unnamed —
  detail UNREAD (2-arg-f64 family, W2-lane only).
- Status: read + registered (2026-09-20 (27)). Compute-first verified:
  case-1's shift window [1..16] & ±16383/16384 == [−1,1) ✓; the
  FN24 sentinel f64 = 1234567.0 exact-byte read ✓.

### C42 — the noise_type enum reflection blob (dig #13, 2026-09-20)
- .rdata string pool, in ORDER (allVA/file = −0x400e00 from the exe):
  IQ2_SIMPLEX1234 (0xd77a0c) · IQ_SIMPLEX (0xd77a34) ·
  SIN_CAPPED_EVERYTHING (0xd77a50) · SIN_CAPPED_SIMPLEX (0xd77a78) ·
  [label NOISE_TYPE @0xd77aa8] · IQNoise (0xd77ad0) ·
  DirtyPeeNoise (0xd77af0) · QemNoise (0xd77b10) · WhiteNoise (0xd77b34) ·
  MixNoise (0xd77b50) · SimplexNoise (0xd77b78) · STB_Perlin (0xd77ba0) ·
  FastBlockNoise (0xd77bc4) · SimplexNoise1234 (0xd77bf0) ·
  [label GENERAL_NOISE @0xd77c1c] — then the FOG_OF_WAR family block.
- Whole-exe imm32 scans (text.bin + rdata.bin + data_raw.bin): ZERO
  pointer refs to ANY of these names ⇒ **no static name→int table
  exists**; the mapping = a cengser reflection-hashed Runtime op.
  (The earlier "second noise_type" needle = the materials.xml attr
  **wang_noise_type** @0xd9e9f0 — unrelated.)
- Status: registered (2026-09-20 (28)). W2's port-side rule: the
  noisetype→kind-map stays a CE/cengser read; the port mapping
  (NoiseType name → dispatcher kind) uses kind=8 (SIMPLEX-kernel proxy)
  flagged non-canon until then.
- **ADDENDUM (2026-09-21, dig #22): the kind-8-proxy rule = RETIRED** —
  the CE run ((35)) closed the runtime mapping EMPIRICALLY: for
  SIN_CAPPED_SIMPLEX, [uid+0x224] = 5 = the 0x8fc020 core
  (simplex2DDeriv). The port maps the ONLY live name to kind 5
  (noise-terrain.mjs uidFrom) and leaves the default -1 + throw for any
  other name (this row's mechanism record stands; no static table =
  C42's durable negative).

### C44 — the BitmapCaves band-stack family (P5 close-out, dig #21, 2026-09-21)
- **fn A = true 0x8EEC70** (slab 0x4ee470) = the layer-1 band writer
  (setter call true 0x8EF37C ✓). Identity: assert
  "caves_setup.mLuaScript.empty() == false" @VA 0x11730e8 (file
  0xd722e8); name-keyed cengser fetches via getter 0x3eaa80 with keys
  "spawn_small_enemies" @0x1173110 / "n_small_enemies" @0x1173114 /
  "spawn_items" @0x1173124 (the C30 spawn-percent bucket family).
- **fn B = true 0x8F5DD0** (slab 0x4ef5d0) = the layers-2/3 writer —
  BOTH remaining setter calls (true 0x8F20D1, slab 0x4f18d1; true
  0x8F2A6C, slab 0x4f226c) live inside this ONE function (≥0x4f2a5f).
- Chain bases (pin 2026-09-21): **[-0x128] = d·3.0 + 1.0** @slab
  0x4f15cf..0x4f15df (true 0x8F1DCF..0x8F1DDF; consts 3.0 @0x11dff70,
  1.0 @0x11dfbf0) — dig (33)'s VALUE confirmed, its window label
  corrected (it is [-0x128], not [-0x108]); **[-0x108] =
  d·0.1 + 0.1** @slab 0x4f2081..0x4f2091 (true 0x8F2881..0x8F2891,
  const 0.1 f32 @0x11df974 twice).
- Band constants (f32 pins, file = VA−0x400E00, 2026-09-21):
  **0.32 @0x11dfa00** (file 0xddec00, bits 0bd7a33e) · 0.35
  @0x11dfa1c / @0x11dfa20 · 0.65 @0x11dfb14 · 0.25 @0x11df9d0 ·
  0.75 @0x11dfb2c · 2.25 @0x11dfed0 · 1.25 @0x11dfc88 ·
  2.5 @0x11dff10 · 0.2 @0x11df9b4 / @0x11df9b0 · 0.15 @0x11df99c ·
  10240.0 f32 @0x11e049c · 32767.0 f32 @0x11e04bc · 101.0 f64
  @0x11dffe8 · −4.0 f64 @0x11e0608 · 0x11df988 = f64
  4.656612875e-10 (the NextU scale, f64 not f32) · 0x11e00a0 =
  f32 5.0 (0xa040 low dword).
- Setter-value forms: L1 `clamp01((d2·0.32+0.35)·roll)`, roll update
  `d1·0.35 − 0.25 + roll` (true 0x8EF29D..0x8EF2B1); L2/L3
  `[−0x128]·(d·0.35+0.65)` (0x35 @0x11dfa20, 0.65 @0x11dfb14).
- **fn C1 = true 0x8F2FF0** (slab 0x4f27f0) = the BitmapCaves grid
  factory: assert "mTopology->BitmapCaves" @0x11731f0 (line 0x449);
  (ecx = name string, edx = uid); cache/lookup in the std::map
  @0x132aae8 (0x582bc0 / 0x655ae0 / 0x655b90; insert 0x542970);
  alloc 0xb8 → ctor 0x4f8c70 = FUN_008f9470 (C27) with the diddled
  seed (addsd 0x11e0ba0 ✓ C27); dims **w = [topology+0x1c],
  h = [topology+0x20]** (the [edi+0xc0] topology sub-object) →
  [grid+0x20]/[+0x24], u16 grid [+0x38]; [grid+0x94] =
  ([grid+0]·0.5)/0.1 (slab 0x4f2a01..0x4f2a11). **fn C2 = true
  0x8F3260** (slab 0x4f2a60) = the twin; top caller = std::function
  wrapper true 0xA4E610 (slab 0x64de10), invoked from the queue-drain
  walk (call true 0x9FED1B, slab 0x5fe51b).
- **DATA CONFIRMATION:** hills.xml `<BitmapCaves size_x="512"
  size_y="256">` = the CE 512×256 cnt-131072 grid ✓, and the
  CE "one grid shared by 5+ uids" = the NAME-keyed cache (the same
  `name="bitmap_hills"` BitmapCaves shared by multiple uids).
- **P5 VERDICT: NO C37 config slot ([+0x1d4], [+0x220..0x268]) is read
  by fn A or fn B (0 refs, whole-body scans) ⇒ "mGradient* = the
  band-stack parameters" ELIMINATED statically** — the C43 row's
  hypothesis is retired; the band stacks are binary-constant Random
  stacks over the BitmapCaves-generated grid. mGradient* feeds ONLY
  the C37 surface evaluator (CE (35)).
- Status: read + registered (2026-09-21 (38)). Source: fresh slabs
  this session; anchor C13 re-pinned first. Superseded in part by C45.

### C45 — the FNV24 hash + lattice + the 256-f64 corner table (dig #22, 2026-09-21)
- hash fn true **0x8FB2D0** (slab 0x4fb2d0): 24-B buffer {x_d64 arg
  (xmm1) | y_d64 arg (xmm2) | 1234567.0 f64 @0x11e0180}; FNV-1a
  bias 0x811c9dc5, prime 0x1000193, 24-B loop; idx = ((h>>8)&0xff) ^
  (h&0xff); EAX = idx (the /GS cookie-check `call 0xc31cea` tail =
  identity — **RETIRES the C41 "12-dir walk via 0xc31cea" misread**).
- corner-value table = .data **0x12eb950, 256 f64s** (data_raw.bin off
  0x950..0x1148; the "12-dir pairs" C41 note = the first 12 entries
  only — SUPERSEDED). Value = FNV_TAB[idx] per corner.
- lattice true **0x8FC940** (slab 0x4fb340): sc = smoothstep (3−2d)·d²;
  corners hash(x0,y0+1) / hash(x0,y0) / hash(x0+1,y0) / hash(x0+1,
  y0+1); the two rows lerped in x by wx; out = wy·(rowTop−rowBottom)
  + rowBottom.
- Pins (2026-09-21): 1234567.0 f64 @0x11e0180 ✓ (C41); **2.01 f32
  @0x11dfe78** (fbm-oct-3 lac) NEW; **7123.1234 f64 @0x11e00d8** and
  **1020304.1234 f64 @0x11e0170** (dispatcher case-4's arg scales);
  the fp-classify helper true 0x1032F81 (hand-written exp-class, tables
  0x11e0da8/0x11e0db0) = case-4's int source — identity open, flagged.
- fdm state quad = CONSTANT {sin(1) 0.8414700031, cos(1) 0.5403000124,
  0.5403000124, −0.8414700031} @.rdata 0x11e0c70 (never written back —
  the C36 "accumulator" gloss ELIMINATED).
- Status: read + registered (2026-09-21 (40)). Port: `lib/fnv-tab.mjs`
  + fnvHash2d/fnvLattice2d in `lib/noise-proto.mjs`; noiseDispatch
  case 3 = wired (formerly threw).

### C46 — the BitmapCaves stamp-carve family (W5 field build, dig #26 2026-09-21)
- **fn A = true 0x8EEC70** (slab 0x4ee470, extent ≤ true 0x8EF069) —
  the CaveStructure/blob-cave STAMP WALKER: a ≤50-step x-wanderer
  (step cap `cmp $0x32`) with per-step roll update
  (`roll += d·0.35(@0x11dfa1c) − 0.25(@0x11df9d0)`), carve value
  `v = clamp01((d2·0.32(@0x11dfa00)+0.35(@0x11dfa1c))·roll)` via the
  grid-setter call at slab 0x4eeb7c (= true 0x8EF37C, the C43 setter),
  a piecewise 0.2/0.6/0.7 envelope (0.20@0x11df9b4 / 0.60@0x11dfaf8 /
  0.70@0x11dfb1c / 0.40@0x11dfa44 / 0.30@0x11df9f0 / 0.33@0x11dfa10),
  then a per-stamp recursion loop (counter arg [ebp+0x28] dec loop,
  recursive call at slab 0x4ef023 = true 0x8EEC70 — the
  cave_childs/branch mechanic). Family helpers:
  - blob setter true **0x8EE750** (slab 0x4edf50): (ecx = grid,
    edx = &point{x,y}, xmm2 = radius, xmm3 = value, stack[5] = flag;
    fn A pushes $1). Path (a) single-point MAX-BLEED write (write iff
    new > existing; getter/setter 0x5491f0); path (b) the circle
    walk (r0 = trunc(value+0.5), skip dist² > r², flag-gated falloff
    blend — the exact falloff block slab 0x4ee044..0x4ee11c = OPEN).
  - multi-blob scatter engine true **0x8EF2D0** (slab 0x4ee2d0).
  - blend twins: float-grid `dst += v·(src−dst)` true **0x8EF870**
    (slab 0x4ef070); byte-grid copy true **0x8EF950** (slab 0x4ef150).
- rdata pins (byte-read from rdata.bin, .rdata rule; trust anchored by
  re-reading 0x11df988 = 4.656612875e-10 = the C1 canon constant):
  100.0 f64 @0x11dffe8 · −4.0 f64 @0x11e0608 · 5.0 f32 @0x11e00a0 ·
  2.5 @0x11dff10 · 10240.0 @0x11e049c · −1.0 @0x11e05a8 · 50.0
  @0x11e0284 · 0.60 @0x11dfaf8 · 0.70 @0x11dfb1c · 0.40 @0x11dfa44 ·
  0.30 @0x11df9f0 · 0.33 @0x11dfa10 · 0.20 @0x11df9b4 · 0.25
  @0x11df9d0 · 0.32 @0x11dfa00 · 0.35 @0x11dfa1c (the last three
  canon-pinned dig #21).
- Asserts: "caves_setup.mLuaScript.empty() == false" @0x11730e8
  (line 0x233); blob-count compare `cmp $0x5f` @0x4eebeb (sub-read).
- Data side: hills.xml `<BitmapCaves name="bitmap_hills" size 512×256,
  blob_caves 20..55 r1..10 s1.5..3, cave_childs 0..2, cave_count
  50..100 s0.2..1, mountains 0..15 s1..10, surface caves 7..12 /
  childs 2..7, do_beginning_paths/down` + 10 CaveStructure stamps
  (cave_$[0-999].png, mountain_rock, skull_mountain, eye_0$[1-4],
  pit, deep_pit, brush_03/04/05/06; aabb x 5..507, y −8..35).
- **Sub-read results (ABOUT_MATH 2026-09-21 (43)):**
  - (a) ✅ setter falloff: t = (r−dist²)/r; v0 = (v_arg−1)·t+1.0;
    if flag≠0 ∧ y<25: final = ((y_int−1)/25(f32 @0x11e01e0))⁸·v0 +
    1.0 (a top-row solid eave); write = MAX-BLEED into [+0x18]
    (write iff existing < new).
  - (b) partial: scatter true 0x8EF2D0 draws 1 poro Next, rolls a
    point inside the range (x = trunc(v·−0.5 @0x11e058c) + trunc(−v·0.5)
    lanes), bounds-checks, gates on cell < 0.5 (canon 0.5 @0x11dfa94)
    and recurses into true **0x8FAFC0** (slab 0x4fa7c0) with
    (y-int, x-int, value) — 0x8FAFC0 = the OPEN worm-branch body.
- Status: READ (structure) — NOT ported (no-guessing mandate; the
  named sub-reads = falloff block + 0x8EF2D0 + fn B worm/surface
  machinery). Source: ABOUT_MATH 2026-09-21 (42)/(43). **dig #27
  corrections (46): the "worm-branch" label @0x8FAFC0 RETIRED — it is
  the B-CHANNEL/script-mark recorder (C32's in-binary twin; byte
  counter + {x,y,B,B−1} record vector, noise_utils.cpp asserts
  0x434/0x435); true 0x8EE930 = the blob-setter smoothstep twin; fn B
  phase map read from its callee census (fn A #1 @0x4eff03 → two
  blob phases → ctor+loader pair → byte blend → layer-2 setter
  0x4f18d1 + scatter 0x4f1d5d → layer-3 0x4f226c + scatter 0x4f26fb →
  second ctor 0x4f293c → RECURSIVE self-call 0x4f2a3c = the
  cave_childs/surface recursion; XML attr names re-found in-binary).
  Remaining port sub-reads: per-phase block semantics, layer setter
  arg masks, aabb arithmetic, beginning-paths lane, C1/C2 wiring.**
- Artifacts: `mapgen/out/caves-fnA.asm` (fn A + the blend twins,
  incl. the setter block) · `mapgen/out/caves-fnB.asm` (fn B body,
  connection skeleton registered; block-level sub-reads remain) ·
  `/tmp/opencode/worm.asm` = the scatter/recorder family dump
  (0x4fa7c0 + the 0x4faa60 smoothstep helper). Dumps are 1050/3551
  lines; regenerate per the standing slab-extract command if re-read
  (C13 map applies).

### C47 — C24/cengser RUNTIME parse (CE pickup v4, 2026-09-21, user run at spawn, moduleBase 0x400000 = no rebase)
- **The two runtime config doubles, finally READ (V4b, raw bytes):
  [0x1327670] = 17920.0 (bytes 00 00 00 00 00 80 D1 40 LE) · [0x13289a8]
  = 7168.0 (00 00 00 00 00 00 BC 40).** These are the same two
  constants as the canvas/world offset pair (canvas = biome px × 512;
  world = canvas − (17920, 7168)) — the C24 "Min/Max_X" family are
  the WORLD→CANVAS offsets, not a fill window. The fill-arg prep
  reading (`area<<9 − int(g)` C24) therefore CONVERTS world-px into
  canvas-px. **The port's 159/223 stays @prov noitool AND is now
  known-independent of these globals** (them being 17920/7168 kills
  the "the 159/223 = engine defaults of this family" reading).
- **V4a (42 candidates): byte[+0x24c] (slopeFlag) = 0x00 for ALL
  42 uids** — the C37 slope arm is dead in live data (matches the
  port keeping it OFF); [uid+0x242] = 0x01 constant across uids;
  the +0x243..+0x24f trailing bytes vary per uid (not yet mapped —
  register as uninterpreted).
- **V4c: the BitmapCaves grid std::map @0x132aae8 header: count =
  4** (name-keyed cave-grid instances, first node @heap 0x16711D8).
- **V4d: [P+0xb0] = 0 (resolver NIL) for the 12 probed uids** —
  P = [uid+0x1d4] is the C44 cave-GRID object (0xb8 builder), not a
  BitmapNoise instance; the C32 A-resolver lives on the BitmapNoise
  class instance, so the resolver hunt target corrects to: the
  BitmapNoise objects that carry the [+0x18] float grids opened by
  LoadFromImageData (whose [+0xb0] we read in-binary) — those are
  reachable through the C37 evaluator's [uid+0x1d4] path for
  biomes WITHOUT BitmapCaves, or via the cave-grid's parent. OPEN.
- **V4e: the map's node-key layout assumption RETIRED** (node dump =
  heap ptrs + an embedded string tail "…72 6F" = "ro…" — keys are
  std::string names ✓ but the +0xc/valObj offsets were wrong; re-dump
  with before-believing valObj).
- Live grid values (V3 section, 512×256 bitmap_hills, px=0x26599020;
  note the v3 sampler's "+512+k" index = row y+1, x 0..11): y=1:
  1.0 ×9 → 1.0003/1.0502/1.1886 (can EXCEED 1.0 near the top — the
  carve eave pushes past 1.0 exactly as C46's (y/25)⁸ arm predicts);
  y=65/129 = mostly 1.0 with blob carves toward 0.0 (0.000/0.006/
  0.0922/0.17…), y=201 = mostly 1.0. THE FIRST BYTE-LEVEL ANCHOR
  OF THE caves-field PORT (the I1 validation target = byte-match
  these four cached grids per name; the harness's V4g = the dense
  dump for that comparison).

### C48 — the caves-grid [P+0x94] signature + the byte oracle (CE v4 pickup #2, 2026-09-21)
- **[P+0x94] = (w·0.5)/0.1 for cave-grid objects** (512-wide → 2560.0;
  1×1 → 5.0) — the fn C1 ×5 toucher (slab 0x4f2a01..0x4f2a11) byte-
  cross-verified via CE. **[P+0x94] on the 3584×2457 world-state grid =
  −56909.828125 = the RAW C27 poro draw** (no ×5 → the world grid is
  not a caves-factory product). Both 512×256 cached grids (0x26599020,
  0x338CB020) byte-identical over all sampled rows ⇒ **the caves field
  is a deterministic function of (diddled worldseed, name/dims, XML
  stamp params)** — C27's ctor chain extends to the band-stack/stamp
  builder.
- The y=0 bump (peak 1.454092 @x≈19, ±10 falloff to 1.0) = a surface
  mountain/eye/skull-stamp ADD-BLEND over the 1.0 base (NOT the
  (y/25)⁸ eave, which ≈0 at y=0..1) — writer = the 0x8EF870 image
  blend twin / an explicit bake; the port's named identify target.
- Oracle artifact: `mapgen/out/oracle/caves-grid-2026-09-21.json`
  (the full dense dump; the caves-field port's byte-compare target).
- **Status: pin (CE + binary cross-reference).** Source: ABOUT_MATH
  2026-09-21 (45)/(47). **Port skeleton live:
  `mapgen/lib/caves-field.mjs` (buildCavesField / carveCircle /
  stampWalker / makeCaveStructureGrid) — the C46/C43-blob primitives
  byte-exact (smoke: compares to the C48 oracle at ±1U on the edges);
  the cave interior SHAPE is NOT byte-validated yet: the naive-shape
  probes against the C48 y=0 bump show no match under the byte noise
  floor — the bump's per-phase writer (fnB block bodies / the
  0x11dfa5c-based value path) = the NEXT CE runtime-pick exactly the
  C47/C48 path; the fnB phase map + fn C1's byte-exact ctor (the 1.0
  base + ×5 toucher) are canon in (47).
