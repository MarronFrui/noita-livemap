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
| C33 | true 0x8F5030 biome-def DECOR classifier (VA fixed dig #85 → I18; was 0x8f4830 = slab+0x400000) | noise re-eval with mod-512 wrap (×1/512 @0x11df8b4), gate [+0x24]/[+0x28], result material [+0x4] |
| C34 | per-chunk DECOR owner layout | [+0xb4] float field (raw >0.5 gate), [+0xd4] u16 grid, [+0x1e0] DECOR write; evaluator2's `a` = the field value |
| C35 | lazy noise-table pair + 2nd core | init true 0x8fbfd0: [0x1327bd0]=perm u16, [0x1327720]=perm%12; true 0x8fc020 = unread noise core; ÷132 count fix |
| C36 | NOISE_TYPE dispatch + fbm | true 0x8fd920 switch @table true 0x8fdaa4 (cases 0..8); true 0x8fdad0 = 4-octave fbm (amps 0.5/0.25/0.125/0.0625, lac 2.02/2.33, ÷0.9375) |
| C37 | surface-field evaluator (P1 blend) | true 0x90a860 recipe + uid offset map ([+0x1d4]=BitmapNoise, [+0x220..0x268] config, final = MultGrad·gradW + MultPerlin·r + AddValue). **dig #83:** surfaceField has EXACTLY ONE e8 caller in the exe = driver true 0x908F40's kind-0 arm (procedural_terrain.cpp; both coords `addsd [0x11dfdd8]` = f64 0.5 → x+0.5/y+0.5, config pushed); the [+0x1d4] FILL = `BiomeHelper::Serialize` kind-0 default arm → memo builder true 0x8EE230 (cache .bss 0x132A528 keyed &config+0xa8; miss → true 0x933D80 → **true 0x7EC4E0, BELOW the text.bin floor 0x801800 = the ramp-generator candidate**); the sampler's >0.5 path REQUIRES [+0x1d4] ≠ 0 and wraps ON the P object (slab 0x5fdce0, dims P+0x20) |
| C38 | surface-math .rdata pins | 0.02/0.0241/0.025/0.02789, 0.05, 0.51, 0.85, 0.495, 0.49162514, 0.05243442, 2.02/2.33, 1.0e-3/9.765625e-4, seed scales |
| C39 | the [uid+0x1d4] fill chain + 0x8fc020 decoder | SetSize+Load wrapper true 0x8fa930; loader true 0x90e060 ("plz"→LoadImageFastLZ); case-5 core READ (mod-12 grads @0x12ee338, ×70); port in noise-proto.mjs |
| C40 | case-1 lane core (sin-hash lattice) + IAT math table | true 0x8fb350 = whiteLattice2d: c0=57·floor(y)+floor(x) **[SUPERSEDED (113): read "round"; 0x44d0b0 = the CRT FLOOR wrapper — cvtss2sd→fldl→fstpl→MSVCR120.dll!floor (IAT 0x114a534, hint 1646), NO fistp ⇒ C92]**, corners frac(sin(c0+k)·43758.546875) k∈{0,1,57,58}; 0x44d110=libm sin-precise (slot 0x114a520); 0x44d0b0 = fld/fistp round **[→ FLOOR, C92]** |
| C43 | gradient-grid setter stacks (W5 core) | 0x4edf50 = float-grid setter; 3 layer-callers with fraction-bands (0.32·d+0.35 / 0.35·d+0.65); mGradient* = likely these stacks' params. **CE-VERIFIED 2026-09-20 (35): [uid+0x224] = 5 = noiseType-int (the dispatcher case = the 0x8fc020 crest — W2 CLOSED empirically); [uid+0x220] = addNoise {3, 0}; [uid+0x230/0238] = f64 ScaleX/Y (0.9999-hills ✓); [uid+0x244/248] = 0.057143 / 2.0 ✓; [uid+0x264] = mMultiplierGradient (0.871429-hills ✓); [uid+0x268] = mMultiplierPerlin (1.0-hills / 0.642857-winter ✓ — CORRECTION of the (23)-map: the pair swapped); [uid+0x1d4] = the BitmapNoise ptr — the hills-class = w260✓h260 = a real 67600-float grid (row [1,1,1…0.7961…1]); the winter-class pointer = a 1×1-unbound placeholder; one candidate = a 3584×2457-cnt-8.8M = the WORLD-state-grid (C31-family!)** |
| C44 | BitmapCaves band-stack family (P5) | fn A true 0x8EEC70 (L1) · fn B true 0x8F5DD0 (L2+L3) · factory fn C1 true 0x8F2FF0 (dims = BitmapCaves size_x/y = w[+0x1c]/h[+0x20]; cache map @0x132aae8 keyed by name); band consts 0.32@0x11dfa00 / 0.35@0x11dfa20 / 0.65@0x11dfb14 (all pinned 2026-09-21); [-0x128]=d·3.0+1.0, [-0x108]=d·0.1+0.1. **NO C37 config slot read by the family ⇒ "mGradient* = band-stack params" ELIMINATED** (see the C44 registry row) |
| C45 | FNV24 hash + lattice + corner table | hash true 0x8FB2D0 (FNV-1a over 24B {x_d64\|y_d64\|1234567.0-sentinel @0x11e0180}, idx = ((h>>8)&0xff)^(h&0xff)); the 256-f64 corner table .data 0x12eb950 (data_raw off 0x950; the C41 "12-dir pairs" = only the first 12, SUPERSEDED); lattice true 0x8fc940 = smoothstep 4-corner bilinear (rows in x by wx, out = wy·(rowT−rowB)+rowB; corner order pinned). C41's "0xc31cea walk" = the /GS cookie check (retired). fbm = CONSTANT quad {sin1,cos1,cos1,−sin1} @0x11e0c70 + **lac 2.01 @0x11dfe78** (new pin); case-4 args 7123.1234 @0x11e00d8 / 1020304.1234 @0x11e0170 |
| C46 | BitmapCaves stamp-carve family (W5 field build) | fn A true 0x8EEC70 (CaveStructure stamp walker, recursion = cave_childs) · blob setter true 0x8EE750 (max-bleed + circle falloff) · scatter engine 0x8EEAD0 (dig #81 re-pin from exe; the old 0x8EF2D0 was +0x800 off) · blend twins 0x8EF870/0x8EF950 · roll/envelope consts 0.35/0.25/0.32/0.35 @0x11dfa1c/d0/a00/a1c, envelope 0.2/0.3/0.4/0.6/0.7/0.33; READ, not ported (sub-reads named) |

| C47 | C24 runtime decode (CE v4) | [0x1327670] = **17920.0**, [0x13289a8] = **7168.0** = the canvas/world offset pair (NOT a fill window; the "159/223 = engine defaults" reading dies); slopeFlag [+0x24c] = 0 all 42 uids (slope arm dead in live data); BitmapCaves std::map count = 4; A-resolver [P+0xb0] = NIL (P = the caves-grid object does NOT carry it; target corrected to BitmapNoise instances); live 512x256 bitmap_hills grid values recorded (byte-level I1 validation anchor; y=0 rows exceed 1.0 per the (y/25)^8 eave) |
| C48 | caves-grid [P+0x94] signature + byte oracle | [P+0x94] = (w·0.5)/0.1 on cave grids (512→2560.0, 1×1→5.0 = the fn C1 ×5 toucher, byte-cross-verified); the world-state grid keeps the RAW C27 draw (−56909.828125, no ×5); both 512×256 cached grids byte-identical ⇒ the caves field = deterministic (diddled ws, name, XML params); the y=0 bump (peak 1.454@x≈19) = a stamp ADD-BLEND over the 1.0 base (writer = 0x8EF870 twin / bake, named target); oracle artifact `mapgen/out/oracle/caves-grid-2026-09-21.json` |

| C49 | pinpoint pickup v5.2 results | [P+0x8c] = the RAW worldseed runtime-pinned both seeds (C27 confirmed in-memory); hills-class knobs [+0x34]=0.546875 / [+0x74]=1.549988 (seed-independent, hills.xml 1.55-family); [+0x2c/0x30/0x38] = pointer slots; [+0x58] deref = a REAL per-grid byte allocation (first64 all-zero); the 0x132aae8 RBTree layout cracked (L/P/R/color_isnil/key-SSO/size/cap, VALUE@0x28 = the cave-grid ptr; keys = the CaveStructure FILE PATTERNS incl. "eye_0$[1-4]"); the V4d A-resolver hunt RESOLVED: [P+0xb0] = 0x008EE1B0 on the 0-dim uids (a real fn entry, objdump next); [P+0x94] draw ADVANCES per build instance; the 1x1 struct P = 0132B518 STATIC |## Registry

| C50 | the +0x34/+0x74 knob pair (dig #29) | [P+0x74]/[P+0x78] = the blob-strength (min,max) pair consumed by fnB (slab 0x4f0931..0x4f0958: v = A + d·(B−A) → the 0x4ee130 blob-setter v_arg; decl-loop = the blob-count phase); CE:(+0x74,+0x78)=(1.549988,0.0) hills-class / (0,0) on the second 512x256 class — the C48 bump peak lives INSIDE the span ✓; [+0x34] = a DIFFERENT struct (the CaveStructure PATTERN record window +0x24/0x2c/0x34/0x38, the f32-read vs int-read sites differ, NOT a contradiction); the knob WRITER = not in the fnB/fnA/ctor family — the named hunt = fn C2 body + the XML-parse family (0x496a2e..0x4a97ed). **OVERTURNED dig #120 (§8 row 40):** [+0x74]/[+0x78] = blob_caves_**radius** (loop C loads them as the blend's R @0x8f10e8..0x8f115f; C52's slot map was right) — the strength pair is [+0x6c]/[+0x70] → v; the `v = A+d·(B−A)` interp and the CE (1.549988, 0.0) reading die (hills.xml on disk: strength 1.5..3 / radius 1..10), and the derived min(20) cap has no byte site |
| C51 | CaveStructure record walk (fnB load phase) | RECORD-ARENA allocator pair 0x533860/0x5bff80/0x5bffb0 (engine alloc `call *0x114a34c`; slot init edx = 0x80 via 0x651a60; vector grow at 0x5bff80/0x5bffb0; NOT image loaders — dig #27 label). **dig #81 corrections: the record = 60 B, not 28** (4-B header + 24-B image_file SSO string + 8×4 fields; the dispatcher = true VA 0x4ABD60, class "CaveStructure" 0x117bf0c, nine keyed stores closing at +0x3c); **COUNT pair = [+0x1c]/[+0x20]**, not +0x28/+0x30 (dispatcher `mov %eax,0x1c(%esi)` @4abe0e + fnB read @4f09cf..4f09d5); `push $0xe00` (3584 B) label **RE-FLAGGED** (3584 is not a multiple of 60: ÷60 → 59); **STRENGTH pair read at [+0x34]/[+0x38] (f32) = the XML's per-record strength_min/max** (byte-verified vs hills.xml's 10 records: cave_$ 0.55..2.15, mountain_rock/skull 1.45..1.55, eye 1.45..1.55, pit 0..0.65; the C49 knobs 0.546875/1.549988 = values of these slots per record, C50's "DIFFERENT struct" note resolved to this struct); **the roll — OVERTURNED dig #123 (→ C102): `count = [rec+0x1c] + trunc(u·([rec+0x20]−[rec+0x1c]+1))` = UP from min** (the minuend = the count_min slot `[−0x120]` ← `0x1c(%eax)` @0x8f11d2; `mulsd 0x11e0578` @0x8f1266 forms the NEGATIVE intermediate `−u·span`, `cvttsd2si` @0x8f1272, `sub %eax,%ecx` @0x8f1276 ⇒ min + trunc(u·span); dig #61 read the sign at the mulsd AND the wrong minuend — the first MISpinned negative-scale roll; `test %ecx; jle 0x8f16f1` @0x8f1280 skips the record at count ≤ 0); **the write — NO-OP dig #123 (→ C102): the `call 0x4ef150` = true 0x8EF950 runs, but the stencil gate `cmpl $0,0x5c(%ebx); je 0x8efa2d` @0x8ef977 skips every cell** (the ctor 0x8F9470 zero-inits the template ⇒ the C49 "+0x58 first-64 all-zero" = EVERY row ✓); the per-iteration loop `decl −0x120(%ebp)` + `jne 0x4f0a95`; the record cursor +0x3c @0x4f0f03; the list-scan via {begin,end} × magic 0x88888889 = **÷60-B records** (the ÷12 label OVERTURNED dig #81; script-verified 60→1/600→10/3584→59; the vector = the config's +0x7c/+0x80 `structures` pair). **true 0x8EE930 (slab 0x4ee130..0x4ee2c8) = the smoothstep LERP stamp — the ONLY lowering-capable writer in the fnA/fnB census** (`v_out = (v_src−v_dst)·t + v_dst` per cell @0x4ee294..0x4ee2a3); all the blob-setter lanes push $0 = max-bleed raise-only; scatter 0x8EEAD0 (VA re-pinned dig #81; the old 0x8EF2D0 was +0x800 off) = `<0.5` empty-cell gate only ⇒ **the float-grid CARVE = the 0x8EE930 LERP + the C32 LoadFromImageData ±1.0 pass; the CaveStructure record lane writes NOTHING — dig #123 (a PRNG-draw consumer, C102); the 2026-09-21 "writes the BYTE grid" claim OVERTURNED.** |
| C52 | BitmapCaves "CavesSetup" config slot map (dig #81) | dispatcher true VA 0x4B1410, class "CavesSetup" @0x117c1cc (error push @4b187c; anchors "Config error ( " 0x116b1c4 / " ) - SetValue( " 0x116b1f8 / " ) - couldn't find the member\n" 0x116b220); getters int 0x4448e0, f32 0x444970, bool 0x444850, string 0x445820, presence 0x4447f0; arm rule = key imm +0x16 → store. Slots (byte-read): +0x00 header · name SSO +0x04..+0x1c · **size_x +0x1c / size_y +0x20 (dims — the "+0x00/+0x04 = dims" reading overturned)** · spawn_percent +0x24 · cave_count +0x28/+0x2c · **do_beginning_paths +0x30 / do_beginning_down +0x31 (bools, stores @4b156c/4b158b)** · surface_caves_count +0x34/+0x38 · cave_strength +0x3c/+0x40 · cave_childs +0x44/+0x48 · surface_cave_childs +0x4c/+0x50 · mountain_count +0x54/+0x58 · mountain_size +0x5c/+0x60 (f32) · blob_caves_count +0x64/+0x68 · blob_caves_strength +0x6c/+0x70 · blob_caves_radius +0x74/+0x78 · structures vector +0x7c..+0x88 · mLuaScript string +0x88..+0xa0 (**size @+0x98**) · DEBUG_output_image +0xa0. Consumers: [config+0x30] read @4f0f3c, [config+0x31] @4f1da1, [config+0x98] = mLuaScript.size @4f100f (the "second gate" claim overturned) |
| C53 | fnB draw-budget formulas (dig #81; NOT yet fully ported) | loop→knob: loop A = cave_count (+0x28/+0x2c, read @4ef701/4ef704), loop B = **mountain_count** (+0x54/+0x58, @4eff36/4eff39), loop C = blob_caves_count (+0x64/+0x68, @4f05a0/4f05a9). L2/L3 counts = literal **120 + ⌊81u⌋** (ecx=0x78; mulsd 81.0 @0x11dffd8 via @4f1518/4f1f09 after the neg-scale @4f1510/4f1f01; stores −0x118 @4f1542/4f1f33; re-rolled per pass; L2 = 2 passes: counter −0x10c, inc @4f1d8b, cmp $0x2 @4f1d92). Gate family = trunc(u × 101.0 @0x11dffe8) < K: 33 @4efc9e, 10 @4efd21, 20 @4efe01/4f02f5, 50 @4efe51/4efe7c/4f04ad/4f12d1, tail 5 @4f1c6b/4f2609, 95 @4f1d2d/4f26cb (mulsd sites @4efc92/4efd15/4efdf5/4efe45/4efe68/4f02e9/4f04a1/4f12c5; movsd loads @4f1c47/4f1cba/4f25e5/4f2658; 11.0 @4f024f). Loop-B X-roll @4f00ad..4f00e9: x = 5 + ⌊(W−9)·u⌋ ∈ [5,507] → −0x134; base = cvttss2si xmm4 @4f00e5 → −0x118 (**xmm4 provenance UNPINNED = the loop-B porting blocker** → **RESOLVED dig #94 / C73: xmm4 = u1·(−0x10c) @8f07b5..8f083c → cvttss2si @8f08e5 → −0x118 @8f08f3; −0x10c = 0.25u+0.75 @8f05c0 — the base's value semantics remain OPEN**); mountain_size +0x5c/+0x60 → −0x100/−0x124; inner bound = base + 15 + ⌊11u⌋ (20%/50% gates @4f02f5/4f04ad); setter call 0x4ee130 @4f036d. Scatter calls @4f1d5d/4f26fb (rel e8 → 0x4ee2d0 = true 0x8EEAD0) |
| C54 | surface-band consumer-chain VA map (dig #83) | **dig #84 corrections: kind-1 builder this = &cfg+0x198 (+0x1a8 = its ≠0 gate); kind-2 fn2 args = w/h at +0x1cc/+0x1d0 + local −0xc4, this = &cfg+0x1b4; the global-default prop setters = slab 0x52c1e0/0x52e000 (not 0x52c240/0x52e050); the "biome.cpp setup @0x4EDE50" = fn2's tail; the kind-0 builder's chain = BiomeSpawnScripts, NOT the ramp — details in C56.** sampler true 0x90d860 = slab 0x50d060..0x50d60d (inner-x →0x50d104 / outer-y →0x50d0f3; exit `lock xadd` @0x50d5dd → ret @0x50d60d). Gate @slab 0x50d3a5: owner = `[sampler+0x18]`, `add ecx,0xb4` → accessor **slab 0x5491f0** (thiscall &owner+0xb4, idx = y·[owner+0x9c]+x) → `comiss 0.5f` → **`jbe 0x50d82b`**; ≤0.5-branch: val≤0 skip / 0<val → **byte-grid write** `[owner+0x1a0]=1` (stride [owner+0x188], accessor **slab 0x54a1d0**); >0.5-path: **P = `[config+0x1d4]`** (null → same skip) → warp **slab 0x5084b0 (true 0x908CB0)** → floor **slab 0x4c8b0** → wrap **slab 0x5fdce0 (true 0x9FE4E0)** with this = **P+0x20** (dims on P) → `movzwl ax; dec` = **id−1** → id1>0: cell = lookup **slab 0xb78e0** ([owner+0x90]) / id1≤0: `[config+0x2a4]==0` → skip else **evaluator2 slab 0x508670 (true 0x908E70)** → floor via IAT `*[0x114a434]` + slab 0xc33170 → **consumer slab 0x4f4830 (true 0x8F5030, biome_materials.cpp; this = [config+0x2a4])** = assert `mInitialized` ([obj+0x2c], line 0xfe) → range gate `[obj+0]≤v≤[obj+4]` → count = `([obj+0xc]−[obj+8])÷132` (magic `0x3e0f83e1`, imul/sar5 = ÷132 for spans <10599; 132-B material records) → walk @0x4f4a21 → cell → `[cell+0x38]`: **3** → **slab 0x603fd0** (bss u8 0x1344ce1) / **1** → 8192-slot intern (`lock xadd`, cap 0x2000, slot = count+1, value [tbl+idx·4+4]) → **planter slab 0x363cd0** (base+x, base+y args = the material→world write) / else → 0x50d60e. driver **true 0x908F40 = slab 0x508740..~0x508b67** (procedural_terrain.cpp): config = **slab 0x5095a0** (28 callers exe-wide) → kind `[config+4]`: **0** → addsd f64-0.5 both coords, push config, **`call slab 0x50a060` = surfaceField (THE ONLY e8 site; ret true 0x908F9B)** → consumer(config+0x2a4, x_int, y_int, value) / **1** → assert `biome->bitmap_data` `[config+0x1b0]` line 0xa6e / ≠1 → slab 0x5089c6; **driver callers = 0 e8 AND 0 e9 in text.bin → indirect (job-functor capture) — OPEN, imm32 scan next**. `BiomeHelper::Serialize` = the `[config+0x1d4]` filler: kind2 → slab 0x4edc40 (true 0x8EE440) image load / kind1 → slab 0x4a0d80 (true 0x8AA580) → [config+0x1b0] / kind0 → `[+0xc0]≠0` → slab 0x4f27f0 (true 0x8F2FF0) else **`[+0xb8]≠0` (ctor default −1 ⇒ default)** → **slab 0x4eda30 (true 0x8EE230)** memo builder (std::map bss 0x132A528 keyed &config+0xa8; hit → [entry+0x28]; miss → slab 0x533580 true 0x933D80 → slab 0x3ebce0 **true 0x7EC4E0 below the floor**; assert line 0x178) / both-zero → **global default bss 0x132B518** (props 1.0f slab 0x52c240, 0 slab 0x52e050; `[0x132B518+0x94] = (int)@0x132B518 ×0.5 ÷0.1 [0x11df974]` = ×5) + bss 0x132B538 → store &0x132B518 → [config+0x1d4]; every arm = EXACTLY ONE e8 caller = Serialize itself (census dig #83). Accessor family: **slab 0x5491f0 f32 / 0x54a0f0 u16 / 0x54a1d0 u8** (checked idx → ptr; caller movss/mov/movb). Painter (noise_utils.cpp, slab ~0x4F9731): field = `movl $0x3f800000,(%eax)` (1.0f) + u16 via 0x54a0f0; resolver `lea ecx,[cfg+0xb4]; call slab 0x5fdc50 (true 0x9FE450)` = refcounted interface → `vfunc+0x0c(out,out,key)` → slab 0x440e0 → **id, assert `script_id < 255` (line 0x263)**. LERP true 0x8EE930 = slab 0x4ee130.. (prologue byte-located dig #83): tail = **`buf2 = buf1 + (target − buf1)·q²`** (q² mulss @0x4ee233; accessors 0x5491f0 on member +0x18). Scatter true 0x8EEAD0 = slab 0x4ee2d0 body: assert `bitmap_noise` line 0x218 → `·[0x11e058c]=−0.5f` / `·[0x11dfa94]=0.5f` → xorps [0x11e0c50] → cvttss2si → **`call 0xc090c0` NextRandom** (C46 byte-confirmed). Ctor slots (vtable 0x117e2c4): +0xa0..+0xb4=0, **+0xb8=−1**, +0xc0=0, **+0x1d4=0** (P), +0x1d8-string (size +0x1e8/res +0x1f4), **+0x1e0=INT_MIN, +0x1f8=−1, +0x21c=INT_MIN**, +0x220=1.0f, +0x23c SSO (res +0x250), +0x2b0/+0x2b4=1.0f; dtor frees {+0x1ac,+0x1b8,+0x1d0} + string +0x23c. biome.cpp setup: release-setter `old=[edi+0xb4]; [edi+0xb4]=new; old→vfunc0(1)` → **SetSize+Load slab 0x4fa130 @true 0x8EE6BB (C39 re-verified)** → [owner+0x98] string → `[owner+0x5c]` → "wang: " 0x11730a0 |
| C55 | evaluator2 + warp byte-recipe consts (dig #83) | evaluator2 true 0x908E70 = slab 0x508670..0x508737 (pure math; args a,b = x,y f64, c = the raw gate f32): `r = b·0.07 [0x11dfce8 f64]→f32`; `s = a·0.035 [0x11dfc98 f64]→f32`; `t = helper slab 0x4fc100(s,r) · 15.5 [0x11e01b0 f32]`; `q = (c − 0.5 [0x11dfa94]) · 0.5`; `u = (b_f32 + t) · 0.04892750 [0x11df944 f32]`; `v = (a_f32 + t) · 0.04892750`; `w = helper slab 0x4fc260(v,u)`; `res = c + q² · 5.35 [0x11e00b4 f32] · 0.95 [0x11dfbac f32] · w`; **return = max(0.5, res)** (@0x508727 comiss-0.5 — §11's clamp byte-confirmed). warp slab 0x5084b0: y += **[0x13289a8] f64** (.bss runtime), x += **[0x1327670] f64** (= the C47 "17920/7168 canvas pair" — SAME VAs), + **0.5 = [0x11dfdd8] f64 (bytes `000000000000e03f`; f32 view = 0.0 — NEVER read this VA f32)**, · **0.1 [0x11dfd08 f64]**, · **0.13717 [0x11dfd38 f64]**; xmm1 arg = **1.0f [0x11dfbf0]**; floor helper slab 0x4c8b0; the driver's pre-surfaceField addsd uses the same [0x11dfdd8]. Post-wrap floor: IAT **`call *[0x114a434]`** (imported math) + helper **slab 0xc33170** (×2, C37's helper family) |
| C56 | the `[config+0x1d4]` (P) fill chain = Serialize → fn1/fn2 → C27 gen + BiomeSpawnScripts (dig #84; **ramp OVERTURNED**) | kind-2 → **fn2 slab 0x4EDC40 call @0x4F2EFE** (this=&cfg+0x1b4, edx=&cfg+0x1d8, w/h=[cfg+0x1cc]/[cfg+0x1d0], ctor-seed=local −0xc4, P store @0x4f2f08; body = grid w×h + `call 0x4ecc90` + inline singleton 0x1346CD8 + builder @0x4edd4f + **SetSize+Load `call 0x4fa130` @0x4EDEBB (true 0x8EE6BB)** + `"wang: "` @0x4EDEE0); kind-1 pre-pass → `lea ecx,[eax+0x198]; call 0x4a0d80` → [cfg+0x1b0] (**this = &cfg+0x198, +0x1a8 = its ≠0 gate — (83) corrected**); kind-0 `[cfg+0xc0]≠0` → `0x4f27f0` / **`[cfg+0xb8]≠0` → fn1 slab 0x4EDA30..0x4EDC3F (true 0x8EE230..43C) call @0x4F2FD4** (this=&cfg+0xa8 = **address-KEY only, contents unread**; edx=&cfg+0x1d8; seed=local −0xb8) / both-zero → 0x4f2fe9 global default (**prop setters = slab 0x52c1e0 / 0x52e000 — (83)'s 0x52c240/0x52e050 wrong**; ctx string 0x1173214). fn1/fn2 miss = `call 0x533580` (argless) → `call 0x3ebce0` (**stdcall, 1 arg = the noise_type string**) → **0x94-B object = `BiomeSpawnScripts`** (literal 0x1154528; ctor wrapper true 0x7EAAF0 → real ctor slab 0x45C9A0, vtable 0x119A724→**0x119EA60** {0x85D2B0, 0x85D7B0, **0x85D980** = (key,0) method called `*0x8(%eax)` @0x7ec60c}; populate true 0x7EB020 = map **@[obj+0x8c]** key [node+0x10]/value [node+0x14], error → `Lua error - AddScriptColor( ` 0x1154694 → bss 0x132B624; builder memo **@[singleton+0x24]** value [node+0x28]) → malloc **0xB8** + **C27 ctor slab 0x4F8C70** (seed only) → **`movl $0x8ee1b0,0xb0(%edi)` @0x4edba7 = true 0x8EE3A7 (A-resolver pin)** → temp `{0x119a2a0, fn 0x7eb220, ctx=scripts}` → **clone `call *0x24` @0x4edbec = slab 0x680DA0** → **release-setter `[gen+0xb4]` = the callback clone** (C39's "B-map" corrected; fn true 0x7EB220 = stdcall map-get → [node+0x14]/−1; class name 0x12f2f40 = MSVC `_Func_class`) → insert `0x542970` → return gen. Asserts: **fmt 0x1150f60 / cond 0x1154820 = `lua_manager` / file 0x1172ea8 = full-path biome.cpp / lines 0x178=376, 0x18d=397**; fail = `movl $0x1ca9,(%eax)` @0x4edb7b (eax=0). C27 gen layout: containers +0x00/+0x20/+0x40/+0x60 (self-ptr @block+0x10), vector +0x80={0,0,0}, **seed @+0x8c (ctor arg)**, **1.0f @+0x90**, **rand @+0x94 = f32(draw)×[0x11e0504]=200000.0f − [0x11e04ec]=100000.0f** after (double)(int) via **{0.0,4294967296.0}@0x11e0ba0** + `comisd [0x11e0220]=2147483647.0; jb; mulsd 0.5 [0x11dfdd8]` + 2×`call 0xc090c0`; SSO string +0x98 (size +0xa8, res +0xac=0xf); +0xb0/+0xb4 zeroed → filled by the tail. Census: fn1=1, fn2=1, 0x4ecc90=1, C27ctor=7 (0x4EDB9A/0x4EDE33/0x4F0B23/0x4F293C/0x5043EE/0x506B41/0x50C66C), 0x533580=5 (0x4EDAAF/0x4EE5C5/0x5074BE/0x50EDA0/0x50FECD), 0x3ebce0=10 (0x4EDAB6/0x4EDD4F/0x4EE5CC/0x4F0BCC/0x4F10BF/0x5051F4/0x50681B/0x50760E/0x50765A/0x50EDA7); **imm32 text.bin 0 hits for 0x00908F40/0x00508740/0x00908F9B → driver capture still OPEN**; boundary re-verified: evaluator2 ret **0x508737** + int3 pad **0x508738..f** + driver prologue **0x508740** (`call 0x5095a0` @0x50875c, `je 0x508b67` @0x508765, `mov eax,[ebx+4]` @0x50876b). Full detail = `### C56` |
| C57 | PE VA formula card + PE-native objdump method (dig #85) | file = VA − 0x400C00 (.text) · slab = file + 0x400 = VA − 0x400800 · true = slab + 0x400800 · .rdata VA = file + 0x400E00 · .data VA = file + 0x401A00 (re-derived from the PE section table: .text raw 0x400..0xd49200 @VA 0x401000 · .rdata 0xd49200 @0x114a000 · .data 0xee9600 @0x12eb000); method = `objdump -D -M att --start-address=<true> --stop-address=<true> noita_dev.exe` (hand slices need `--adjust-vma = file_off + 0x400C00`); **SCOPE WARNING: text.bin (file 0x400c00..) never covered lower .text = true 0x401000..0x801800 — the root cause of (82)/(83)/(84)'s "zero" scans** |
| C58 | surface-config XML attr → slot BIND table, 38 pairs (dig #85) | walk true `0x49b887..0x49df7e` (lower .text): `push $name_VA; lea slot(%ebx); call bind`; types = string 0x9c4450/0x43a5a0 · bool 0x444700 · bool8 0x444520 · f32 0x9c4560 · f64 0x9c6b00 · enum 0x9c8160 · other 0x9c55b0; **the mGradient WRITE side of question A; settles the multiplier labels: +0x264 = mMultiplierGradient, +0x268 = mMultiplierPerlin, +0x26c = mMultiplierExtraPerlin (confirms C43's CE correction + C37's byte slots)**; full table + gap list in the C58 section |
| C59 | config defaults-init store block (dig #85) | `%esi` stores `0x495ebe..0x496195` (52; full list in section): +0xa0 = 225.0f, +0x1cc/+0x1d0 = 0x100, **+0x1d4 = 0 (P starts null ✓)**, +0x214 = 0.5f, +0x218/+0x21c = 1.0f, +0x220 = 0, **+0x224 = 5 (C43 noiseType ✓)**, +0x228 = 1, +0x264/268/26c = 1.0f, **+0x270/+0x274 = −512/+512 f32**, +0x278/+0x280/+0x290 = f64 movsd, +0x288 = 1, **+0x298/+0x29c = −100/+100 f32**, +0x2a0..+0x2a4 = 0; the (82) XML census (−1024/+1024, −292/234) = XML overrides of these defaults |
| C60 | driver `0x908F40` direct callers (dig #85) | 3× e8 rel32 byte-verified → `0x908F40`: **0x7930d3** (main), **0x7938d1** + **0x7938fe** (45-B probe pair), sibling **0x793358 → 0x909370**; all file 0x3924d3..0x392cfe = lower .text (C57 scope defect = why digs #83/#84 saw zero); capture CLOSED, loop extent/y-range still OPEN (caller body unread) |
| C61 | sampler wrap call + P+0x20 view (dig #85) | call **0x90dcce** (in sampler 0x90d860) = `mov 0x28(%esp),%ecx; add $0x20,%ecx; call 0x9fe4e0` ⇒ wrap-this = **P+0x20**, P = `[config+0x1d4]` = the BitmapNoise; view = {w@+0x20, h@+0x24, u16 vec@+0x38, cnt/gate@+0x3c} — vec/cnt = C31's u16 wrapper ⇒ (83)'s "dims" and (84)'s "container block" = the SAME bytes; (84)'s "on the C27 gen" label corrected (the 0xB8 seed-gen ≠ config+0x1d4) |
| C62 | LoadFromImageData store sites + getters (dig #85; EXTENDS C31/C32 — cite, don't re-register) | fn `0x8f9ab0..0x8fa930` (no 2nd prologue in-span; next = C39 wrapper @0x8fa930): f32 `movss` **@0x8fa15e** via `lea 0x18(%esi),%ecx` + getter **0x9499f0**; ±1.0f twins **@0x8f9f04/0x8f9f39**; u16 via getter **0x94a8f0** with `lea 0x20(%esi),%edi` @0x8fa162 → edi+0x18 (=+0x38); getters = CSafeArray {base@+0,count@+4} f32/u16/u32 = 0x9499f0/0x94a8f0/0x949f60; e8 callers (rel32 verified) = **0x8fa99b** (wrapper Load step) + **0x905dd7/0x905f1e** (§11 F3 wang pair); unit noise_utils.cpp, assert line 0x263 |
| C63 | A-resolver imm `0x8ee1b0` pin census (dig #85) | exactly 4 imm32 occurrences file-wide: movl starts **0x8ee3a7** (fn1 0x8EE230 body) + **0x8ee643** (fn2 0x8EE440 body), each followed by a +0xb4 store (**0x8ee3fb/0x8ee694**) = C56's {resolver, cb} pair, one install per fill path; `movl $0x8ee1b0,0x140(%eax)` imm @0x905ad3; stack-local 0x64c7ab; resolver.dis label trap: displayed 0x8ee243 = true 0x8ee643 (−0x400 slice error) |
| C64 | ③/P1 ruled-out candidates (dig #85; do-not-re-dig) | `0x12ec8b8` = g_genome_herd_relations (writers 0x592270/0x5932f0, genomedata_component.cpp); name→member dispatch 0x4f8857 = the invincibility_frames/falling_damages member; ctor null-inits 0x791c8e pair + 0x8f9565/0x8f956b; classifier (C33 true 0x8F5030) refuted as the `[owner+0xb4]` writer (body 0x8f5030..0x8f5754, zero member stores); no independent +0xb4 wrapper-base install among the ③-region sites examined (fresh full-.text census file 0x400..0xd49200: mod=10 disp32 0xb4 → 475 store-patterns/91 loads/761 lea, 0xb8 → 1060/846/710 — counts not individually re-examined ⇒ elimination is REGION-scoped) |
| C65 | P/owner instance identity + sampler dispatch chain (dig #86) | `kind2-esi == P` **PROVEN** (Serialize kind2 arm @0x8f36c7..0x8f3708: fn2-this = config+0x1b4, `call 0x8ee440` @0x8f36fe → `mov %eax,0x1d4(%ecx)`; fn2 = **0x8ee440..0x8ee741**, ret = its `new(0xb8)` gen) · `P == owner+0x9c` **FALSE as instances** (owner+0x9c = embed: ctor **0x90ce66** / Load **0x90d1ab** / dtor **0x910a6f**, embed ends owner+0x154; P ← five standalone/static-gen stores, incl. fifth **0x908583** in fn 0x905fb0) · sampler vtable **0x118f9e4** → slot+8 thunk **0xa9a120** → 0x90d860; owner = fn **0x90cfb0**'s this; gate reads embed (owner+0x9c/+0xb4 @0x90dba5..), wrap reads `[config+0x1d4]` ⇒ sampler mixes two gens, one class · **+0x1e0 = owner-own decor grid — SLOTS ARE 4 BYTES, the "u16" label REFUTED dig #93** (accessor 0x95a5e0 = slab 0x559de0 returns `base + idx·4` — `lea (%eax,%ebx,4),%eax` @0x95a6ae, `ret $0x4`, bounds `idx < [this+4]`, OOB assert line 0x4b file 0x117a570 expr 0x1179b74; the store @0x90de9c = `mov %ecx,(%eax)` dword; cited sites 0x90d2c1/0x90d2e9 dword ⇒ VERIFIED §8 row 28; the sampler's u16 read = wrap 0x9fe4e0(this=P+0x20) `movzwl;dec` @0x90dcd3, getter 0x94a8f0 — the u16 fill container is gen+0x20, C67/C62) · phantoms do-not-cite: `call 0x8ed180` 0 hits, `movl $0x132b518,0x38(%esi)` nonexistent, "wang-fill @0x8ee5bd" wrong |
| C66 | A-resolver body true `0x8EE1B0` = lazy-singleton + delegate (dig #87) | body **0x8EE1B0..0x8EE221** (ret; int3 pad 0x8EE222..0x8EE22F; fn1 prologue 0x8EE230 = C63 ✓): MSVC EHa/GS frame — try-scope `[ebp−4]` −1→0, unwind info push `$0x10a49cc`, GS cookie `mov 0x12eb000` (.data VA = file 0xEE9600 ✓) `xor %ebp`; guard = the bss pointer **`0x134632c`** itself (`test; jne` @0x8ee1d8) → miss: `push $0x1a0; call *0x114a34c` (IAT operator new) → ctor **`0x65F480`** (`mov %eax,%ecx` thiscall) → `mov %eax,0x134632c` @0x8ee203; resolve arm: `push 0x8(%ebp)` (the single arg) + `mov 0x18(%eax),%ecx` ⇒ this = **`[0x134632c + 0x18]`** (LOADED POINTER — `mov`, not `lea` ⇒ object-pointer member, not an embed) → `call **0x741A50**` @0x8ee20e → eax passthrough ⇒ color→ID logic lives at **0x741A50**; **RESOLVED dig #88 → C67**: 0x741A50 = 24-bit color→table-index (−1 miss); ctor `0x65F480` **NEGATIVE — zero-inits +0x18** (`movl $0x0,0x18(%esi)` @0x65f4d7) ⇒ delegate-writer of `[0x134632c+0x18]` still **OPEN** (dig #89); call site = `push %ecx` (raw pixel) + `call *%eax` @0x8f9dc1/2 |
| C67 | color→grid lane: delegate `0x741A50` + LoadFromImageData's four arms (dig #88; EXTENDS C32/C62 — cite, don't re-register) | delegate **0x741A50** (body 0x741A50..0x741AB4 stdcall `ret $4`; int3 pad to 0x741ABF; next prologue 0x741AC0): key = `arg1 & 0x00FFFFFF` @0x741a59 (alpha stripped); fast path key == `([this+0x2c] & 0xFFFFFF)` @0x741a5f → **0**; else count = [this+0x28] with **`count > 1` gate** (≤1 → miss), base = [this+0x1c], probe i=1 at base + **0x2d0** (= 1·0x290 + 0x40), loop `inc i; add $0x290` while i < count, probe = u32 @ base + i·0x290 + 0x40 `&0xFFFFFF` vs key → match **i**; miss → `or $0xffffffff,%eax` = **−1** @0x741aa7 ⇒ **record stride 0x290 (656 B), color field +0x40; record 0 reachable ONLY via the +0x2c fast path** (`+0x2c == [base+0x40]?` unread → dig #89). ctor **0x65F480** = NEGATIVE for delegate install: `movl $0x0,0x18(%esi)` @0x65f4d7 (zero-run +0x10..+0x24) ⇒ `[0x134632c+0x18]` writer **OPEN**. LoadFromImageData (fn 0x8f9ab0..0x8fa930; **esi = the C27 gen** — containers +0x00 f32 / +0x20 u16 / +0x40 u8 / vector +0x80, +0xb0 resolver, +0xb4 script cb = C56 layout ✓): loop head bounds x∈[0,[esi]) y∈[0,[esi+4]) else **assert 0x224** (file 0x1173790) @0x8f9c06; pixel = `call 0x9fe3c0` @0x8f9cdc (this = [ebp−0x18] container {w@0, h@4, init@+0x1c, **u32 array @+0x18**, getter **0x949f60**}, negative coords wrap idiv-modulo, uninit→0) → **color [ebp−0x58] = raw pixel** @0x8f9ceb, [ebp−0x30] = `pixel & 0xFF000000` @0x8f9cee; gates @0x8f9d84+ (pixel≠0, `&0xFFFFFF`≠0, top-byte≠0) → any zero = next pixel 0x8fa165, no writes; **top-byte == 0xFE** @0x8f9cf1 → bool-buffer capacity sync on ebx {w,h @0/4, cached-total @+8, buf @+0x18, alloc @+0x1c}: dims from [esi]/[esi+4], on change free (IAT 0x114a358) + malloc (IAT 0x114a35c) + memset 0 (0x1033a5e), flag clear `0x92ea40` @0x8f9d64 + **bool byte=1** (getter **0x94a9d0**, this = ebx+0x18, offset w·y+x) @0x8f9d7e — other top bytes skip the whole block (0xFE meaning OPEN); memo [ebp−0x7c]/[ebp−0x78] = last color/index, hit → reuse @0x8f9da0; else eax = [esi+0xb0] (null → miss 0x8f9f59), color == 0xFFFFFFFF → default arm @0x8f9db8, else `push %ecx; call *%eax` **@0x8f9dc2** → memo @0x8f9dca/0x8f9dcd. Arms: post-call @0x8f9dd0 [ebp−0x24]=eax, **−1 → miss arm**, signed ≥0xFFFF → **assert 0x264** (file 0x11737fc) @0x8f9de7; success @0x8f9eae unsigned >0xFFFE (negatives) → default arm, **id = index+1** @0x8f9ebc, lazy u16 init [esi+0x3c]==0 → 0x92e800/0x92e850, then **id==1 → f32 −1.0f @0x8f9f04 + u16 1 @0x8f9f21 + `incl [ebp−0x6c]`**; **id≠1 → f32 +1.0f @0x8f9f39 + u16 id @0x8f9f51** (f32 offset [esi]·y+x getter 0x9499f0; u16 offset [esi+0x20]·y+x getter 0x94a8f0); miss arm @0x8f9f59 (color == 0xFFFFFFFF / script memo [ebp−0x70]/[ebp−0x74] / [esi+0xb4]==0 → default) else **`call 0x9fe450`** (this = esi+0xb4, arg = &color) @0x8f9f83 → memo → signed <0xFF → **byte arm** @0x8fa05d: id = index+1 ≤0xFF (unsigned negative → default), lazy init [esi+0x5c]==0 → 0x92cc80/0x92ccd0, **u8 lane = id** (getter **0x949bb0**, this = esi+0x58, offset [esi+0x40]·y+x) @0x8fa0af + push **{x, y, id−1}** → vector **esi+0x80** (0x92eb70) + `incl [ebp−0x68]`; signed ≥0xFF → **assert 0x263** (file 0x11737c8) @0x8f9f9f; **default arm** @0x8fa0dc/df (0xFFFFFFFF pre-check, −1, out-of-range, script-null): **f32 = (ch[15:8] + 2·ch[23:16]) / 765** (mul 0x11df8bc = 0.003921569 = 1/255, div 0x11dff70 = 3.0, u32→double magic 0x11e0ba0) → f32 grid @0x8fa15e, **u16 NOT written (stays 0)** |
| C68 | CellFactory/CellData = the 0x290 record class (materials.xml rows): layout + accessors + mCellDataSize (dig #89) | **identity strings/asserts**: `"data/materials.xml"` 0x119ffe0 (push @0x405b97); assert file 0x117cb10 = `…grid/cells/cellfactory.` + exprs `type >= 0` 0x117cc3c line **0x361** / `type < (int)mCellDataSize` 0x117cc48 line **0x362** (fn 0x4b80e0); `celldata->material_type < (int)mCellData.size()` 0x11a021c line **0x52e** (fn 0x742b30, pushes @0x742eb0/0x742f24/0x742f48); `IMPL_cell_reactions.empty()` 0x11a06b4 line 0x631 / `IMPL_required_reactions.empty()` 0x11a06d0 line 0x632 (fn 0x7449e0); `ERROR in materials.xml!!! wang_color for ` 0x11a0738 + ` is completely grey.` 0x11a0790 (pushes @0x74598f/0x7459a8); `Error! CellFactory::GetType() couldn't find material: ` 0x11a00a0 (push @0x74184c); `Too many CellData's … CELLFACTORY_CELLDATA_MAX_COUNT …` body 0x11a0068 (@0x741305); attr `wang_color` 0x119f078 (@0x736c56/0x736caf/0x736cd6 in the parse region ~0x736c00, node type [edi+0x20]); source `d:\…\source\grid\cells\cellfactory.cp` 0x119ef60; **layout**: names {begin **+0x8**, end **+0xc**} = 24-B wstrings (count = (end−begin)/24 via `mov $0x2aaaaaab` + sar2 @0x744f35..4e and @0x7415f3..fd; SSO wstring {data@0,size@0x10,cap@0x14}, inline test `cmpl $0x10,0x14(%edx)` @0x43db94), name→type std::map {head **+0x14**, size **+0x18**} (find **0x43db70**: `mov (%ecx),%ebx` head @0x43db77, root `_Isnil` `cmpb $0x0,0xd(%edi)` @0x43db80, `_Myval` `lea 0x10(%edi)` @0x43db98 ⇒ node = {_L@0,_P@4,_R@8,color@0xc,isnil@0xd,key wstring @0x10..0x27,int second @**0x28**}; end-test `cmp 0x14(%ebx),%esi` @0x744f73; size gate `cmpl $0x0,0x4(%ebx)` in insert-helper **0x4496a0** with this = table+0x14 @0x4496d4), mCellData {begin **+0x1c**, end **+0x20**, cap **+0x24**} stride **0x290** ((end−begin)/0x290 via `0x63e7063f` + sar8 @0x744a6d..81), **mCellDataSize dword +0x28**, fast-color **+0x2c** (identity OPEN — orphan trap: never cite 0x11a0008/0x11a0030, zero refs file-wide), one-shot **+0xb8**; **accessors**: **0x741770** GetType(name) → 0-based type / −1 (map path → node+0x28 @0x7417aa; empty → −1 @0x74186c; linear match → type @0x741878; miss → error log 0x11a00a0 then −1); **0x7415e0** = names-vector linear resolver (stdcall `ret $4` @0x7416ed; this+0x8 vector, per-elem `add $0x18,%ebx` @0x7416bd, match → counter @0x7416e4, miss tail @0x7416f0 unread); **0x741890** name → &record (`imul $0x290,i; add [this+0x1c]` @0x741995, miss/empty → 0 @0x7419ad; callers 0x746456/0x746c72/0x8f8f48/0xc3df8d/0xc3dff6/0xc3e0aa); **0x4b80e0** GetCellData(type): this spilled `[esp+4]` @0x4b80f3 + reloaded @0x4b81a4 (ecx = this on both fast and assert paths), assert 0x361 `test %ebx,%ebx; jns` @0x4b8105, assert 0x362 **`cmp 0x28(%ecx),%ebx; jl 0x4b827c`** @0x4b81c9 (signed `type < [this+0x28]`), **type==0 → NULL** @0x4b827c..88, else base+type·0x290 @0x4b828b; **0x4b82a0** = GetCellData(GetType(name)) (callers 0x6515f8/0x65167b) ⇒ **type 0 unreachable via GetCellData**; **mCellDataSize writer** = fn 0x742b30 (prologue-only boundary ⇒ single fn): `call 0x7415e0` @0x742d14 → `mov %eax,0x30(%ebx)` (material_type) + `mov %eax,0x34(%ebx)` @0x742d19/1c → **`cmp %eax,0x28(%esi); jg skip; inc %eax; mov %eax,0x28(%esi)` @0x742d1f..0x742d25 = mCellDataSize := max(size, resolved+1)** (esi = table per `imul $0x290,0x30(%ebx),%ecx; add 0x1c(%esi)` @0x742f63); **name→type map fill** = fn **0x7449e0** loop (no ret/int3 boundary 0x744a00..0x744f60): counter `[ebp−0x64]` = 0 @0x744f3f, head @0x744f60, per name find 0x43db70 → absent `je 0x745023` insert (0x4495f0 + 0x4496a0 out `[ebp−0x50]`) / key-present `je 0x745049` reuse esi → **`mov %edi,0x28(%esi)` @0x745051 = node.second := running index** (store-before-inc @0x745054 ⇒ seconds 0..count−1), stride `add $0x18,%esi` @0x745060, loopback `jb 0x744f60` @0x745075 — **CORRECTION: this store writes the MAP node, NOT the table count**; record assign **0x741d20** (dst ecx, src [ebp+8], `ret $4`): copies wstrings {+0x00,+0x18,+0xac,+0xc8,+0xe4,+0x114,+0x12c,+0x1b4,+0x1d0,+0x1ec,+0x20c,+0x240,+0x250,+0x25c}, dwords +0x30 **material_type**/+0x34/38/3c, **+0x40 wang_color @0x741d68**, +0x44/48, sub-obj +0x4c (ctor 0x736150), bytes +0x8c..8f/+0xa8/+0x150..0x163/+0x1ac..0x1b1/+0x24c..0x24f/+0x268/69/+0x27c/+0x288..0x28a, typed dwords +0xc4/+0xe0/+0xfc/+0x144/+0x148/+0x1cc/+0x1e8/+0x204, u16 +0x14c/+0x14e; **+0x88 omitted (rebuilt by 0x740780 when [rec+0x5c]≠0 @0x742f8f..9d), +0x28c raw-copied @0x7422d4**; **link pass 0x7455b0** (per-record caller loop @0x747bf7: i=1..[esi+0x28], stride 0x290; asserts lines 0x766/0x767): wstring→type dwords: +0x1b4→+0x1cc (empty→0), +0xac→+0xc4 (empty→skip), +0xc8→+0xe0 (empty → default **`fire`** 0x1171bc0 len4 @0x7457df), +0xe4→+0xfc (empty → default **`smoke`** 0x117cbdc len5 @0x74584c, **but the store @0x74588a targets +0xe0 — byte-verified asymmetry, semantics OPEN**), +0x1d0→+0x1e8, +0x1ec→+0x204, +0x114→+0x148 (extra: type>0 && [rec+0x150]==0 → GetType→GetCellData → `mov 0x30(%ebx),%ecx; mov %ecx,0x144(%eax)` @0x74593c), +0x12c→+0x144; grey check @0x74597a: color=[ebx+0x40], b0==b1==b2 → error log (0x9eb020/0x65cfe0/0x9cfff0); **one-shot init 0x741ac0**: guard [this+0xb8] → GetType([0x1328004+0x17c]) @0x741b1d → GetCellData @0x741b25 → saved @0x741b2a (same for +0x194 @0x741b34); copy **0x740410** (movdqu +0x00..+0x3f, dword +0x40 @0x740466..69, sub-objs +0x44/+0x50 via 0x928630; callers 0x7466b4/0x746935/0x9305aa); per-record random **0x7409b0** (15 call sites incl 0x744ef2): [rec+0x88] + flag [rec+0x6c] → two uniforms from record index (hash `imul $0x5b` + 0x37e40765/0x9eec9ad1, MSVC LCG 0x343fd/0x269ec3, mask 0x7fff −0x3fff, norm 0x11dfae0/0x11e0038) → `call 0x740580(obj,u1,u2)` (assert line 0x2e7 `width > 0` 0x119fec4; fn assert line 0x328 `celldata` 0x117d2e4); `imul $0x290` census = **15 sites** (0x4b828b, 0x741995, 0x742379, 0x742f63/f72/f82, 0x743d12, 0x74484b, 0x74489c, 0x92fce4, 0x92fd79, 0x978ae0, 0x978b60, 0x978b6e); `push $0x290` sites = assert line 656 decoy (0x43d5e6/0x43d654/0x43d67a, 0x7427fb, 0x95b876/0x95b8e4/0x95b90a, 0x95c2f6/0x95c364/0x95c38a); **OPEN**: wang_color parse store → record+0x40 (attr parse located @0x736c56; the +0x40 stores 0x740469/0x741cb3/0x742412/0x7471f3/0x747925/0x747ab5 = copies/assigns only), [factory+0x2c] identity, record-allocation site, 0x7415e0 miss tail | Source: ABOUT_MATH §6 (89).
| C69 | wang_color parse origin: fn `0x7364f0`, store @0x736d37 + the color converter pair 0x454d90/0x454e80 (dig #90) | parse fn **0x7364f0** (prologue `push %ebp` @0x7364f0, unwind 0x1079c8b, `sub $0x1c0`, GS 0x12eb000): **esi = this** (`mov %ecx,%esi` @0x73651e; spill [ebp−0x114] @0x736520) = the parse target (offset profile {+0x40, +0x48} = C68's CellData record field map; caller-chain to &mCellData[i] unread = OPEN), arg1 = [ebp+8] → edi @0x736526 = the node; node type [edi+0x20] dispatch `cmp $0x1` @0x736c3f/42, tree ptr [edi+0x28]; accumulator = string @ [ebp−0xa4]. Attr `wang_color` 0x119f078 pushed @0x736c56 (type-1 arm: temp [ebp−0x38] pre-seeded from acc by **0x42bc50**(this=temp, arg=&acc), node fetch **0x42c070** = generic attr getter, 600+ sites incl. 0x736716..0x73ffc family — wrapper mechanics unread) / @0x736caf + @0x736cd6 (type-0 arm: `mov 0x28(%edi),%ecx` → has **0x100a6f0** → get **0x100a960** → **0x4430b0** → **acc-assign 0x43a5a0 @0x736d0d**); converge @0x736d2c `lea −0xa4(%ebp),%ecx; call 0x454d90` → **THE ORIGIN STORE `mov %eax,0x40(%esi)` @0x736d37** (disp8 form `89 46 40` — outside (89)'s six census sites, all ≥ 0x740469) = **record+0x40 = wang_color**; **the store precedes the sentinel check** `cmp $0xffeeffc0,%eax; jne 0x736d68` @0x736d3a — sentinel arm @0x736d41..0x736d61: `push %ecx` (ecx = 0x454d90's exit value — unread) → **0x9ea780** → esi=obj → **0x65cfe0**(obj, record via [ebp−0x114]) → **0x4429a0**(obj, **0x114b900** = dword 0x0a + `"vector<T> too long"`) → restore esi @0x736d62 → **both paths continue @0x736d68, the +0x40 store is NOT undone**; 0xFFEEFFC0 = swap⁻¹(**0xFFC0FFEE**, C0FFEE-family — involution byte-math) ⇒ arm semantics OPEN. Sibling attr `gfx_glow_color` 0x119f068 @0x736b85/0x736bbc → same converge-pair @0x736c0c → **`mov %eax,0x48(%esi)` @0x736c1d = record+0x48 = gfx_glow_color** (C68 assign-map ✓; +0x48 stores census += 0x736c1d). **Default arm:** `mov 0x40(%esi),%edx` @0x736c17 (+0x40 LOAD) → **0x454e80(out=[ebp−0x2c] ecx, u32=edx)** → returns the out-string ptr (`mov %edi,%eax` @0x454f66) → acc-assign @0x736c2c ⇒ absent attr ⇒ acc = format(current record+0x40) → the converge re-parse round-trips +0x40 (losslessness inferred from the inverse swizzle pair; number-format top-byte fidelity UNVERIFIED). **Converter pair:** **0x454d90** = string→u32 — stream ctor **0x927f00** (pushed ecx = the acc ptr = its string arg @0x454dbc) + IAT **\*0x114a2a4**/**\*0x114a298** + flag cb **0x428e30** (`or $0x800` after `and $0xfffff9ff` into [arg+0x14]) → u32 @ [ebp−0x10] → **byte swap 0↔2** (bytes 1,3 passthrough: movzbl/shl $0x10 | shr $0x10/and $0xff | and $0xff00ff00) @0x454df1..0x454e06 → ret; **12 call sites** 0x64c9d2/0x736c12/0x736d32/0x73cd3e/0x73de5b/0x7ebca9/0x818b0a/0x889aaa/0x8eb913/0x8ebcd8/0x8f4676/0x903e48 = THE shared color-string→u32 helper; **0x454e80** = u32→string: register args ecx=out, edx=u32 (`mov %ecx,%edi; mov %edx,%esi` @0x454ea9/ac), **inverse swap** @0x454eae..0x454ed5, format via \*0x114a1e8/\*0x114a174 + **0x429a40**(ecx=[ebp−0xc0], push edi), ret @0x454f78; **10 call sites** 0x736b08/0x736c20/0x73cbc7/0x73dd8a/0x7eb0a1/0x889a20/0x8eb781/0x8eb94a/0x903ccb/0x906dc7. **Parse-fn callers:** **0x9eb1aa** in fn **0x9eb020** (= C68's grey-error call target — its own callers 0x745999 (grey-check ✓)/0x8c6955/0xab74f4/0xabc412/0xbd95fa; builds a synthetic node @ [ebp−0x40] type [−0x20]=0, guard `test %ecx,%ecx; je 0x9eb1c1` @0x9eb168, parse target ecx←edx) + **0xa70d74** (synthetic type [−0x20]=1, pre-call 0x100ab30, this=edi, fn returns esi) ⇒ **fn 0x9eb020 calling the record parser = NEW OPEN** (role reconciliation vs its grey-error label) |
| C70 | Phase-2 leftovers ②–⑥ + step 2b: delegate identity, +0x2c fast-color, record origin, Load pass-1, default/named types, air color (dig #91) | **CORRECTS C69's ①f attribution**: `call 0x7364f0` @0x9eb1aa ∈ fn **0x9eb140** (synthetic-node builder — fn 0x9eb020 ends `ret $0x4` @0x9eb131 + int3 0x9eb134..0x9eb13f; guard @0x9eb168; `call 0x9eb140` = 3 e8 sites 0x745b3f/0x746263/0x746530, all in fn 0x7459d0), NOT fn 0x9eb020 = the grey-error logger only (this = global 0x132b624, pushed arg 0x11a0738, call site 0x745999) · **`[0x134632c+0x18]` = a 0xd8 factory instance** (only writers **0x729753**/**0x79de90**, both `new(0xd8)` → ctor **0x740b70** → `call 0x43ac50` → store → `call 0x7449e0`(this = new obj, arg 0); site 2 = bss install `mov %eax,0x134632c` @0x79de46 + guard `cmpl $0,0x18(%eax); jne 0x79e02d` @0x79de4b + `push $0xd8` @0x79de55 + ctor @0x79de6f → edi + store @0x79de90; fn 0x7449e0 prologue `mov %ecx,%ebx` @0x744a0b ⇒ this = that object; C66's delegate-writer OPEN CLOSED) · **[factory+0x2c] = ctor-set fast-color `0xff420000`** (`movl $0xff420000,0x2c(%ebx)` @0x740bfd in ctor 0x740b70; imm-0x2c census 0x740000..0x746fff = 0x740bfd + **0x7450de** only — the latter = the second SSO string's SIZE zero-init `movl $0x0,0x2c(%ecx)` in frameless helper fn **0x7450c0** (fn 0x7449e0 ends `ret $0x4` @0x7450af + int3 → 0x7450bf), NOT a factory store, superseding the "reset-before-load in 0x7449e0" guess; reg-source = 0x7401b3 only (ebp local) ⇒ **Load never writes +0x2c in-region**; file-wide 380 hits unexamined = REGION-scoped) · **record origin = in-place `[factory+0x1c]+[ebp−0x3cc]`** in fn **0x7459d0** (frame `sub $0x45c`, no 2nd prologue to 0x746600; this→[ebp−0x3c8] @0x7459fd; type gate `[esi+0x20]==1` @0x745a0c else 0x7461df; `cmpl $1,0x28(%eax); jle 0x745b92` @0x745a26; index [ebp−0x3d8]←1 @0x745a1e, offset [ebp−0x3cc]←0x290 @0x745a30..37; step `add $0x290` + `inc %ecx` + `cmp 0x28(%edx),%ecx` (mCellDataSize) + `jl 0x745a40` @0x745b71..86 ⇒ **records i = 1..size−1**, record 0 skipped = C67 scan-from-1 ✓); in-place parse sites **0x745b3f** (0x9eb140) + **0x745e96..9c** (0xa70cd0, ecx = `[ebp+0x1c]`+offset), staging sites **0x746263**/**0x746530** (local `lea -0x364(%ebp)`, built by `call 0x747160` @0x7464f0..f6, `movb $0x13,-0x4(%ebp)`, staging zeros → builder → dtor + `lea -0x364(%ebp),%eax` @0x746539) ⇒ **both patterns live**, staging→table copy path OPEN; growth **0x92fc90** callers **0x740db7** (`lea 0x1c(%ebx)`, size-zero after) + **0x73624d** (after dtor loop `call 0x736050; add $0x290,%edi; inc %ebx; cmp 0x28(%esi),%ebx` @0x736211..25, size zeroed before AND after ⇒ mCellData ✓); full-realloc **0x978aa0** = **0** `(call|jmp)` sites file-wide · **LoadFromImageData fn 0x8f9ab0 pass-1**: inits [ebp−0x34]←esi @0x8f9ae0, [ebp−0x18]←arg1 @0x8f9ae3, [ebp−0x5c]←edi(gen+0x20) @0x8f9b2f, [ebp−0x80]←ebx(arg6) @0x8f9b54; counters [ebp−0x68]←0 @0x8f9b7c / [ebp−0x6c]←0 @0x8f9b8f; `incl [ebp−0x6c]` @0x8f9f19 after `call 0x94a8f0; u16==1` (record-0 writes), `incl [ebp−0x68]` @0x8fa0d4 after `call 0x92eb70` (identity OPEN); both `jle 0x8fa489` @0x8fa1a2/ac; phase-2 flag `cmpb $0,0x10(%ebp); jne 0x8fa6e9` @0x8fa194; local ctor 0x65a640 (0x1173830), gate `cmpl $0,0x3c(%esi)` @0x8fa1d4 → assert line **0x2a7** (pushes $0x2a7/$0x1173678/$0x1173870/fmt 0x1150f60 via 0x114a374; crash `movl $0x1ca9,(%eax)` @0x8fa296), esi reload @0x8fa28a → `0x5c(%esi)` → assert **0x2a8** (expr 0x11738ac) → crash @0x8fa35b; **fill pass 0x8fa361..0x8fa47d** = u8≠0 (getter 0x949bb0, ebx+0x58, stride [ebx+0x40]) ∧ self u16==0 (0x9fe4e0, esi=gen+0x20) ∧ 4 neighbors `0x9fe570(&locals)==1` → **u16←1** (0x94a8f0, ebx+0x38, stride [ebx+0x20]) + **f32←−1.0f** (`movl $0xbf800000`, 0x9499f0, ebx+0x18, stride [ebx+0x00]) ⇒ lanes gen+0x00/+0x20/+0x40 = C67 ✓; tail @0x8fa489 = [ebp−0x34]+0x7c gate → 0x8fa6b9 else realloc (0x114a35c/0x1012c00), **dilation body 0x8fa4ff..0x8fa6b9 unread** (OPEN); **phase-2 @0x8fa6e9** = ctor 0x65a640 (0x11738dc) + header copy from edi + u16 buffer ×2 resize (`add %eax,%eax` + malloc + copy 0x1012c00) + walk cells u16==0, dump truncated ~0x8fa7e0 (OPEN); callers of 0x8f9ab0 = **3** (0x8fa99b/0x905dd7/0x905f1e), @0x905dd7 this = edx + arg1 = edi + `push (%edi); push 0x4(%edi)` = w/h ⇒ **arg1 = the C67 pixel container ✓** (full signature OPEN) · **link-pass fn 0x7455b0** (edx→ebx @0x7455db = record, ecx→[ebp−0x4c] @0x7455dd = factory; prologue census 0x744000..0x746600 = 0x744260/0x744620/0x7449e0/0x745100/0x7455b0/0x7459d0): +0xe0 ← prior GetType @0x7457d2, GetType(**"fire"** 0x1171bc0 len 4) @0x74581d, or name-absent default GetType(**"smoke"** 0x117cbdc len 5) @0x74588a; +0xfc ← GetType(+0xe4) only when name present (`[ebx+0xf4]` guard) @0x745844 ⇒ **+0xe0 = fire/smoke DEFAULT type, +0xfc = NAMED type** (C68 asymmetry resolved); guarded stores +0x1e8 (guard +0x1e0) @0x7458c3, +0x204 (guard +0x1fc), +0x148 (guard +0x124) @0x745915, +0x144 (2 writers: cross-record @0x74593c guarded type>0 && +0x150==0 && GetCellData≠0; src +0x12c @0x745968 guarded +0x13c); grey check @0x74597a = `mov 0x40(%ebx),%eax` shr8/shr16 → **b0==b1==b2, alpha ignored** → `mov $0x132b624,%ecx` + push 0x11a0738 + `call 0x9eb020` @0x745999 → 0x65cfe0(ebx) → 0x9cfff0(0x11a0790) → ret @0x7459cf → prologue 0x7459d0 (abut, no pad); paired reads 0x741e4c/0x741e72 = record-assign **0x741d20** field copies (esi→ebx: +0xc4/+0xe0/wstring +0xe4 via 0x41d770/+0xfc/+0x100/+0xc8) + twin 0x7472f1..0x747337 (ebx→edi) ⇒ COPYING, **+0xe0/+0xfc consumer still OPEN** · **step 2b**: literal `data/materials.xml` 418,728 B md5 `d782fb8c321b8e325fd67e07e46a5265`; `<CellData` (224) + `<CellDataChild` (245) = **469** = wang_color count exactly (8 hex digits, no `0x` prefix; first names air/$mat_air/fire ⇒ record order = type order ✓); air = line 80 name, line 83 **`wang_color="ff000042"`** → C69 swap b0↔b2 → **`0xff420000` = ctor 0x740b70's immediate** (data, swizzle, exe agree); same u32 = C1 hasPath start-mark `cmp eax,0xFF420000` @0x901a4d (relationship OPEN) | Source: ABOUT_MATH §6 (91) |

| C71 | Phase-2 residue ①–⑤: +0xe0/+0xfc consumers, staging selector/copy, 0x741a50 key rule + reserved wang color, LoadFromImageData signature/parts/dilation/counters, 0x978aa0 reserve + wrappers + resolvers (dig #92) | **①** consumers = fns **0x7495b0** (gate `cmpl $4,0x38(%eax)` → `call *0x98(%edx)`), **0x74bf70** (LCG rand → `call *0x98` @0x74c2bb), **0x751be0** (`call *0x20` @0x751d65; packed idx `((y&0x1ff)<<9)|(x&0x1ff)`); chain 0x74bf70→0x7521f0→0x751be0; 0x7495b0+0x74bf70 = 0 direct code refs (vtable/fn-ptr — which OPEN) · **②** selector = `[arg1+0x20]` (1 → in-place dead-looking, 0 → staging; tag literals 0x11a07a8/b4/c0/cc); staging→table copy = fn **0x742b30** tail (record-assign 0x741d20; only callers 0x746275/0x74656d); load chain 0x7449e0→0x9eaf80→0x100c360→0xa48f20(mode=0)→0x7459d0 ⇒ **staging = live path**; 0x746e20 = record dtor; 0x42c0d0 = XML find-child-by-tag, 0x42c440 = tag-eq · **③** matcher fn **0x741a50**: `arg&0xFFFFFF` vs `[this+0x2c]&0xFFFFFF` → 0; loop i=1..count−1 over record +0x40 (base+0x2d0, stride 0x290) → i; miss −1 ⇒ **top byte EXCLUDED**; reserved wang color literal **0x119f098** = "…please don't use the color 0xFFC0FFEE… special meaning in the wang map…" ⇒ **ffc0ffee** (S=0xFFC0FFEE → T=0xFFEEFFC0, byte1 C0 survives = swap byte0↔2, byte1 unchanged); arm = log-and-continue; 0xFE=254=JOINT_SCRIPT_ID stands (0x90cd00, 0x8fa060 u8=id+1; gate @0x8f9cf1 ↔ JOINT = OPEN) · **④** fn **0x8f9ab0 = BitmapNoise::LoadFromImageData** (strings 0x1173720/750/830/8dc, file 0x1173678 = noise_utils.cpp), thiscall `ret $0x24` = 9 dword args: [1] image-data ptr (freed @0x905f2b), [2] ecx-value, **[3] [ebp+0x10] = phase flag**, [4-5]/[8-9] 8-B struct slots (content OPEN), [6]/[7] = w/h clamped `min(arg, this[0]/this[4])`; flag≠0 @0x8fa194 → **part 3** @0x8fa6e9, ==0 → counter gates (−0x68/−0x6c `jle 0x8fa489`) → **part 2**; merge @0x8fa48f → dilation gated **this+0x7c≠0** @0x8fa492 (skip → 0x8fa6b9); asserts: this+0x3c = line **0x2a7** expr 0x1173870 `mMaterialData.Empty()==false` (lane+0x1c), this+0x5c = line **0x2a8** expr 0x11738ac `mScriptData.Empty()==false`, this+0x7c = bool-lane count; part 2 (0x8fa361..47d) = u8≠0 ∧ u16==0 ∧ mode==1 → **u16:=1 + f32:=−1.0f**; part 3 (~0x8fa7e0) = clone u16, u16==0 ∧ f32≤0 (ucomiss/lahf) ∧ mode≠0 → scratch=mode → commit = **majority-fill**; dilation 0x8fa49c..0x8fa6b9 = clone bool (memcpy @0x8fa4eb) → set in-bounds 4-neighbors=1 in scratch (stride −0x54/data −0x3c) → commit (memcpy @0x8fa69a) = **von-Neumann r1**; **0x9fe570** = mode of NONZERO u16 nbr values (first-wins, 0 if all zero); **−0x68 = script events appended** (bump @0x8fa0d4 after `call 0x92eb70`; event {x,y,script_id} @−0xa0, this=grid+0x80 ⇒ **0x92eb70 = script-event appender**), **−0x6c = resolved id==1 cells** (bump @0x8f9f19; id==1 → f32=−1.0/u16=1 skip u8+event, id≠1 → f32=+1.0, u8=id+1, event); resolve = [this+0xb0] fn ptr, 1-entry memo (−0x7c/−0x78), assert `material_id < USHRT_MAX` line **0x264**; callers 0x905dd7/0x905f1e (`push $1`) + 0x8fa99b (wrapper **0x8fa930**, `ret $0xc`, flag = its arg3) · **⑤** **0x978aa0 = mCellData vector::reserve** (arg ≤ 0x63e706 ×0x290, magic 0x63e7063f, dtor loop 0x746e20) = 0 calls + **2 tail-jmps 0x94b373/0x94b386** from the growth wrapper (`ret $0x4` @0x94b38f, signed-fixup/÷2/max-%esi 1.5×-style — predicate OPEN) ⇒ overturns the zero-call canon (§8 row 27); **0x7450c0 helper-this = stack local [ebp−0x3a0]** (CellDataChild arm of 0x7459d0, call @0x74635a, EH state 0x11; fed to 0x9eb280/0x93ce20 — semantics OPEN); **0x729753 guard** = lazy O-create @0x7296b4 (new 0x1a0 → ctor 0x65f480 → store @0x7296e5) → slot guard `mov 0x18(%eax); test; jne 0x729848` @0x7296f3 → new(0xd8) → ctor 0x740b70 → **0x43ac50 lazy get-or-create** → `mov %ecx,0x18(%eax)` = **[O+0x18]=factory** → `call 0x7449e0(factory,0)` → assert **`world_state == NULL` line 0x124**, file 0x119e1d0 = **game_world.cpp** (expr 0x119e22c) vs `[0x1328004]` @0x72975b; wrappers **0x42bc50** (seed/assign, registry 0x1344c78) / **0x42c070** (attr map `[this+0x28]+0x44`, find 0xf755a0, key-eq 0x43be00, fill 0x1014a70, `ret $8`) / **0x42c0d0** (cursor `[this+0x1c]`/`[this+0x2c]` vs vector `[this+0x28]+0x38/0x3c`; exhaustion → logger 0x12ee538 + literals 0x1150fa0/0x1150f88/0x1150f94; miss → 0x42c415 tail unread); **0x7415e0 = name→index insert-on-miss** (hit → index; miss → 0x43aa90 + once-flag 0x13276b9 + one-shot log 0x11a0088 `"added new type: "` + 0x11a009c `" = "` → returns count); **0x741770 = CellFactory::GetType** (map +0x14/+0x18, node second +0x28, miss → 0x11a00a0 @0x74184c → −1); hasPath @**0x901a4d** = cmp cell u32 (getter 0x949f60) `$0xff420000` → `movl $0xff000000` to grid B (getter 0x949e80), top-byte 0/0xff000000 → skip, else copy ⇒ **ctor's +0x2c = air's swapped color is exactly hasPath's mark**; 0x2c census: (91)'s 380-pattern identity not reproduced (re-grep 6684 imm-stores/1838+ reg-stores/1940 loads/2761 lea — pattern OPEN) ⇒ elimination stays REGION-scoped |
| C72 | Phase-2 material-ID ladder: field → gate → u16 cell → kind dispatch → color, with a dword grid write (solid/air rung; dig #93) | **ladder** — field `[owner+0xb4]` raw f32 → **>0.5 gate** (C54; ≤0.5 skip, >0.5 → warp/floor/wrap → id−1) → **u16 cell** = gen+0x20 fill container (C67/C62; sampler wrap **0x9fe4e0**(this=P+0x20) → `movzwl; dec` = id1 @0x90dcd3): id1 ≥ 1 → cell = **0x4b80e0**([obj+0x90],id1) @0x90dcec | id1 ≤ 0 → `[owner+0x2a4]==0` → **AIR** (skip `je 0x90ddb0`, unpainted) ≠0 → evaluator2 **0x908e70**(f64 outer, f64 inner, f32 field) → floor (IAT 0x114a434 + 0x1033970) → **classifier 0x8f5030** (132-B components, stride `add $0x84` @0x8f5713; returns `[component+0x04]` record POINTER or 0; full gate chain incl. main gate `[[+0x24],[+0x28))` @0x8f55b6 = entry (93), refines **C33**) → **MERGE @0x90dd89**: 0 → **AIR** | record → kind `[record+0x38]` (C54 ✓): **3** → writer **0xa047d0**(this=`[sampler+4]`, flag `*(u8*)0x1344ce1`) → loop tail 0x90ddb0 (**no** +0x1e0 store) | **1** ∧ table ≠ 0 → intern (lock xadd, cap 0x2000, value = `[tbl+old·4+4]`) | **other** → value 0; kind 1/other → **planter 0x7644d0**(this=`*([sampler+0x2c])`, args = record, intern-value, x+`*([sampler+0x24])`, y+`*([sampler+0x28])`) → free-old (IAT 0x114a348) → **grid write**: accessor **0x95a5e0**(this=owner+0x1e0, idx = y·`[owner+0x1c8]`+x) → `mov %ecx,(%eax)` **dword / 4-B slots** (`lea (%eax,%ebx,4)` @0x95a6ae ⇒ **the "+0x1e0 u16" label is REFUTED — §8 row 28, C65 amended**) → bounds x < `[owner+0x168]`, y < `[owner+0x16c]` → alpha accessor **0x949e80**(owner+0x180) `testl $0xff000000,(%eax)` @0x90ded0 ≠0 → `call *0x1c(%edx)` on-place callback (arg = cell u32) → loop tail; **color** = record `[cell+0x40]` wang_color (C69) / `[factory+0x2c]` ctor fast-color (C70), color→index delegate **0x741a50** (C66/C67); **SOLID = any write arm ran, AIR = the skips above**; consumes C54/C67/C69/C70, refines C33, supersedes C65's "+0x1e0 u16" |
| C73 | **fnA y-drift span + all 10 arg slots + budget chain + xmm4 provenance (dig #94)** | fnA = **8eec70..8ef86c**, called @**8f0703** (fnB region) + child @**8ef823**. **Slots** (consistent at both call sites): [ebp+8]=dims{w,h} ptr · [ebp+0xc]=&int pair{−0x134 X, −0x130 Y} · [ebp+0x10]=−0x104 y-cursor · [ebp+0x14]=−0x10c scale · [ebp+0x18]=−0x110 budget (f32) · [ebp+0x1c]=(−0x100)² u (**child `xorps 0x11e0c50` sign-flip @8ef7c2** ⇒ opposite horizontal drift) · [ebp+0x20]=−0x120 Δy · [ebp+0x24]=growth(−0x148) · [ebp+0x28]=&−0x124 child budget (child `decl (%eax)` @8ef79e) · [ebp+0x2c]=rec+0x24. **Start pair:** X = −0x134 = clamp(jittered base, 5, W−5) @8f0265..8f0298; Y = −0x130 = trunc(rand·[0x11dfef0 = 0.0]) = **0** @8f02b3..8f02b9 ⇒ **walk STARTS AT ROW 0 (top)**. **y chain:** y = slot −0x44 = (float)pair[1] @8eecac..8eecbc; **−0x44 += [ebp+0x20] once per walk iteration** after the band call @8ef37c..8ef393; Δy = −0x120 = **0.4·u+0.1 ∈[0.1,0.5)** @8f046a..8f0485, **+0.5** when trunc(101u)<33 (`cmp $0x21` @8f049e..8f04b3, 0x11dffe8=101.0) ⇒ Δy∈[0.6,1.0) there; budget [ebp+0x18] = −0x110 := `divss −0x120` @8f0626..8f063f where **−0x110 = LERP(0.45·H, 0.96·H, u)** final @8f056b..8f058d (0.45 @0x11dfa5c, 0.96 @0x11dfbc8; −0x119=1 always @8f03ac ⇒ refine always runs; earlier LERP(0.15H,0.96H) @8f0415..8f043f superseded). **Terminations:** back-edge `inc −0x40; comiss [ebp+0x18],steps; jbe 0x8ef0d0` @8ef836..8ef857 ⇒ ≤⌊budget⌋ iters; box x∈[0,w) ∧ y∈[0,h) @8ef0d0..8ef0ff else epilogue (ret @8ef86c); y-cursor gate @8ef104..8ef10c; budget<0 pre-gate @8ef0b1 (xmm1=[ebp+0x18] loaded @8eefb8 vs xmm3=0 @8eefbd, census-clean to 8ef188) ⇒ skip. x: −0x4c += clamp(step, ±1.0) @8ef5f6..8ef62c (1.0 @0x11dfbf0, −1.0 @0x11e05a8); counter −0x48 `cmp $0x32`/jle @8ef631..634, >50 ⇒ re-jitter `[ebp+0x1c]=u·2−1` @8ef6c9..8ef6de (2.0 @0x11dfe68). **SPAN ⇒ y ∈ [0, LERP(0.45H,0.96H,u))**, box-limited to h. **Child:** gate `rand·100.0<2.0` ⇒ **P=2%** @8ef774..8ef783 (0x11e02dc=100.0), gate+call sit in the walk body just before the back-edge (address layout ⇒ per-iteration attempt); budget xmm1 = (u2·50−50)+(parent−steps) @8ef7e2..8ef800 (50.0 @0x11e0284); xy `lea −0x38` @8ef7ee. **fnB caller side:** X-roll = 5+⌊(W−9)·u2⌋ @8f08ad..8f08e9; **xmm4 provenance CLOSED** = u1·(−0x10c) @8f07b5..8f083c (NextU on %edi, scale +1/2³¹ @0x11df988) → `cvttss2si` @8f08e5 (slab 4f00e5) → −0x118 @8f08f3; −0x10c last-written @8f05c0 = **0.25u+0.75** (0x11df9d0=0.25, 0x11dfb2c=0.75; base value semantics OPEN), −0x118 later reused as draw budget; **L2/L3 = 120+⌊81u⌋** = C53 re-confirmed byte-exact (ecx=0x78 @8f1cff/8f26f0, mulsd 81.0 @8f1d10/8f2701, stores −0x118 @8f1d42/8f2733, `decl` @8f23bf/8f2d5d, gates @8f256d/8f286e/8f2f0b, L2 = 2 passes @8f2585..8f2595, band/scatter calls 8ee750 @8f20d1/8f2a6c + 8eead0 @8f255d/8f2efb). | `mapgen/extractions/fulltext86.asm (X1)` — all addresses read this session; f32/f64 consts read as cited |
| C74 | **MaterialComponent build: ctor `0x7daeb0` defaults + the full XML-attr → 132-B slot map + `[config+0x2a4]` = `mBiomeMaterials` (dig #95)** | **ctor = fn `0x7daeb0`** (thiscall ecx→ebx, `sub $0x1bc`, SEH 0x10845e4): vtable **`0x1191fc0`** @7daef0; default-fill @7daf2a..7dafc6 = **+0x04** 0 (celldata) · name SSO string **+0x08..+0x17** (size **+0x18**=0, cap +0x1c=0xf, `''` via 0x41df90 @7daf31) · **+0x20**=10 (material_index) · **+0x24/+0x28**=0.1f (material_min/max) · +0x2c 0 (add_perlin) · +0x30/+0x34=1.0f (add_perlin_scale_x/y) · +0x38 word 0 {is_rare, limit_y} · **+0x3c**=100.0f / **+0x40**=2048.0f (limit_min/max_y) · +0x44 word 0 {rare_use_perlin, rare_use_fbm_perlin} · **+0x46**=1 (rare_use_polka) · +0x48/+0x4c=0.05f (rare_scale_x/y) · +0x50 0 (rare_offset_by_seed) · +0x54/+0x58 0 · +0x5c=0.2f / +0x60=0.65f (rare_polka_radius_low/high) · **+0x64**=1 (rare_polka_is_boxed) · +0x68=0.2f (rare_polka_probability) · **+0x6c**=0.2f / **+0x70**=1.0f (rare_required_min/max = out-gate defaults) · +0x74 0 (is_polygon) · polygon vector **+0x78/+0x7c/+0x80**=0/0/0 + init 0x92baa0 @7dafe6; end **+0x84 = 132 B** ✓. **Same frame = schema registration:** `"MaterialComponent"` (len 0x11, **0x1153bd4**) @7db002 → registry **0x92a5c0** @7db027 → find **0x43e0f0** @7db035 → miss = insert **0x4498f0**/**0x4499a0** @7db06b/7db080 → payload node+**0x28** @7db08b → once-guard `mov (%esi),%eax; cmp 0x4(%esi); jne 0x7db6c8` @7db0b2 (payload non-empty ⇒ skip) → name push-loop **0x444250**: celldata (0x117d2e4) @7db0bd, material_name @7db100, material_index @7db141, material_min @7db182, material_max @7db1c3 … rare_use_polka @7db44d (cluster continues through the full attr list). **Attr→slot map — three byte-agreeing passes** (vtable **0x1191fc0** = [0x7e22a0, **0x7dc850**, **0x7de160**, 0x7dc670]; pass A = vtable+4 fn **0x7dc850** name-push + `lea slot(%ebx)` @7dc897..7dd465; pass B = vtable+8 fn **0x7de160** name-push + `lea slot(%esi)` @7de26a..; pass C = mov-form `mov $name,%edx` @7deda0..): **celldata→+0x04** · material_name→**+0x08** (size +0x18) · material_index→**+0x20** · **material_min→+0x24 / material_max→+0x28 = classifier main gate** · add_perlin→+0x2c · add_perlin_scale_x→+0x30 · add_perlin_scale_y→+0x34 · is_rare→+0x38 · limit_y→+0x39 · limit_min_y→+0x3c · limit_max_y→+0x40 · rare_use_perlin→+0x44 · rare_use_fbm_perlin→+0x45 · rare_use_polka→+0x46 · rare_scale_x→+0x48 · rare_scale_y→+0x4c · rare_offset_by_seed→+0x50 · rare_offset_x→+0x54 · rare_offset_y→+0x58 · rare_polka_radius_low→+0x5c · rare_polka_radius_high→+0x60 · rare_polka_is_boxed→+0x64 · rare_polka_probability→+0x68 · **rare_required_min→+0x6c / rare_required_max→+0x70 = classifier out-gate** · is_polygon→+0x74 · polygon→+0x78 — every C72/C93 gate slot carries its XML name (refined in place; no §8 overturn). **`[config+0x2a4] = mBiomeMaterials`** (C58 walk): guard `mov $0x117a338,%edx` → eq 0x4447f0 → getter **0x9c8660** → `mov %eax,0x2a4(%esi)` @**49de93**; ordinal case same getter @**49e83c**; zero-init @496195/4e8a6d; siblings 0x117a2a8 `'coarse_map_cell_count_always_zero'`→+0x2a2 @49de31, 0x117a2cc `'coarse_map_inject_light'`→+0x2a3 @49de62. Getter 0x9c8660 = holder `[esi+4]` → virtual get (null ⇒ static 0x12ef63c) → typeid check (0x12f20c4 + IAT 0x114a36c) → `*([esi+4]+4)`. **`<Materials>` tag = 0x11a06a8** (xrefs 744c4e CellFactory region, 8f38f6/8f393e/8f39d6 in a biome.cpp-0x1172ea8 fn line 0x4b8; tag-eq **0x42c440** @8f3910); P1 = **inline** `<Materials>` (hills.xml:184) — no `mBiomeMaterials=`/`mBiomeMaterialsFile` in the surface files (File attr only in friend_1..6/roadblock/secret_entrance/snowcastle_cavern/solid_wall → `data/materials/biome_forest.xml`). **Red herring:** `push $0x84` ×4 = assert-log **line 132, not sizes** — @732002/732073 `Assert failed: (celldata) in …box2d_collisions.cpp at line 132` (fmt 0x1150f60, expr 0x117d2e4, file 0x119ebb0, guard `[arg+0x38]==0` @731ffa, null-crash @731fea) and @748c9d/748d14 `(this != temp) in …cfirecell.cpp at line 132` (0x11a095c/0x11a0878) ⇒ **no literal `new(0x84)`**; component stride = the classifier's `add $0x84` (C72) + `imul $0x84` @5d0eb8/5d0ff5. OPEN: `<Materials>` child→wrapper flow, record RESOLVE (material_name→+0x04), `_enabled` (absent from all three passes), allocation site, virtual read-vs-write. | `mapgen/extractions/fulltext86.asm (X1)` — every address read this session (slab→true +0x400800; strings via exe scan, VA−0x400E00); XML facts from `data/biome/*.xml` greps + hills/desert/mountain_center reads this session |
| C75 | **surface-level CLASSIFIER port `mapgen/lib/surface-level.mjs` (4 exports) + the rarePolka ramp/hash constants + the corrected loop-assert placement (dig #96)** | **Exports:** `componentFromXml(xml)` / `buildMaterialsTable(comps, band, celldata)` / `classify(table, x, y, v)` / `rarePolka(px, py, low, high, boxed, prob)` — arities 1/3/4/6; env-gated (SURFACE_V3/PROC_FILL), default render untouched, no render-path imports. **classify = 0x8f5030** (arg regs: y = esi [ebp+0xc], x = edi [ebp+8], reloaded @0x8f53f4/0x8f550c): mInitialized → assert 0xfe line 254 → **band [bandMin, bandMax] CLOSED both ends → null** at the shared miss epilogue **0x8f574c** (`pop edi; pop esi; xor eax` @0x8f574e … `ret $8` @0x8f5754; the loop exit `jge 0x8f5733` lands the same) → **loop head 0x8f5160** (`mov 0x8(%ebx),%ebx; add %esi,%ebx; jne 0x8f5221`; back-jmp `jmp 0x8f5160` @0x8f573b): null-comp assert **0x107** push @0x8f516b (expr 0x1151e28) → `mov -0x1c(%ebp),%eax` @0x8f5221 → cellFactory `cmpl $0,0x30(%eax)` @0x8f5224 → `jne 0x8f52e9` → assert **0x108** push @0x8f522e (expr 0x11732c0) — **BOTH asserts per-iteration, 0x107 first, both ahead of the diag (§8 row 29: dig-93's "0x108 before the loop" refuted)** → diag @0x8f52e9 (null record + name≠"" → log 0x11732d0 + assert **0x10f** line 271, expr 0x1173304; null + empty name defers) → membership **0x442610** (predicate UNREAD ⇒ non-null = found, tagged) → limit_y @0x8f53f0 (`cmpb $0,0x39(%ebx)`; slots **+0x3c/+0x40**: `movss 0x3c(%ebx)` @0x8f53f9 / `comiss 0x40(%ebx)` @0x8f540e; CLOSED on f32(y); `ja 0x8f5704`) → polygon @0x8f5418 (`cmpb $0,0x74(%ebx)`; vector **+0x78/+0x7c**, count = (end−begin)>>3 @0x8f5422..0x8f5428; <3 → assert **0x118** line 280 expr 0x1173340; query **0x10096a0** ⇒ port throws) → second-null @0x8f5572 → **v′** @0x8f557c = f32(simplex(f32(x)·[+0x30], f32(y)·[+0x34]) + v) (cvtsd2ss @0x8f55ad, addss @0x8f55b1) → **main gate [[+0x24],[+0x28))** half-open (jb @0x8f55b6 / jbe @0x8f55c5) → is_rare `[+0x38]` → accept @0x8f5740 (`mov 0x4(%ebx),%eax`) → transform @0x8f55dc..0x8f560b px/py = fround(fround(f32(x)·[+0x48]) + [+0x54]) → jitter `[+0x50]` @0x8f55d8 (`je 0x8f5678`; call **0x9119d0** @0x8f5612 ⇒ throw) → noise `[+0x44]` @0x8f5678 (fbm `[+0x45]` → **0x9fad90** ⇒ throw; plain simplex @0x8f5694; out-gate **(min,max]** @0x8f56a6..0x8f56b4) → polka @0x8f56b6 (disabled → `je 0x8f5740` accept; call @0x8f56c0..0x8f56e5 maps px, py, `[+0x5c]` low, `[+0x60]` high, `[+0x64]`→cl, `[+0x68]` prob→stack; out-gate **(min,max]** @0x8f56f4..0x8f5702) — **noise→polka SEQUENTIAL (both must pass)** → loop tail `add $0x84,%esi` @0x8f5713 (stride 132 B), count = (end−begin)/0x84 via signed-div magic 0x3e0f83e1 (imul/sar $0x5/shr-add @0x8f571c..0x8f5731). **rarePolka = 0x8fbe60..0x8fbfc3** (all f32, f64-widened return): floor-fix cell (esi/edi) → fracs stored to −0x8/−0xc → **hash92f0 call @0x8fbf01** (out at −0x28: w0/w1/r2 = −0x28/−0x24/−0x20) → R = fround(fround(fround(high−low)·r2)+low), `comiss/jae 0x8fbfbd` → **0 when R ≤ 0** (xmm0 zeroed @0x8fbf0b) → k = 2/R (`divss` @0x8fbf38, const 2.0 = 0x11dfe68) → p = fround(fround((k−2)·w1) + fround(fround(fracY·k) − (k−1))), q likewise with w0/fracX → **boxed:** d = p⁴+q⁴, >1 → return 0; **unboxed:** d = p²+q², d ≥ 1 → d = 1 (1.0 = 0x11dfbf0) → (1−d)³ as f32 (cvtps2pd widen). Prob gate = **r1 ≥ prob → 0 (jae; equality trips it)**. **hash9200 = 0x8f9200** / **hash92f0 = 0x8f92f0**: P = fround(fround(fy·fy)·fround(fx·fx)) — **squared product**, x→base 26 / y→base 161; r1 = frac(K9200·P) (`mulss` @0x8f92be); outs = [frac(K92F0·P), frac(K1·P), frac(K2·P)] @0x8f93e8/0x8f940c/0x8f9439. **fold** = t − 71·⌊FOLD_Q·t⌋ + base (mulss→cvttss2si (+comiss/dec floor-fix = Math.floor)→cvtdq2ps→mulss→subss→addss, @0x8f9376..0x8f93d8); **frac** = t − trunc(t) (cvttss2si→cvtdq2ps→subss; inputs ≥ 0). **Constants (PE read this session):** FOLD_Q 0x11df8f4 = **0.014084506779909134** · 71 = 0x11e02b8 · baseX 26 = 0x11e01f8 · baseY 161 = 0x11e031c · K9200 0x11df8ac = **0.00101319863460958** · K92F0 0x11df8b0 → 0x13476e4 = **0.0010513747110962868** · **K1 imm 0x3acbdc41 → 0x13476e8 = 0.0015553311677649617** · **K2 imm 0x3aa32fcf → 0x13476ec = 0.0012450161157175899** (struct.unpack verified) · 2.0 = 0x11dfe68 · 1.0 = 0x11dfbf0. **build = 0x8f8fe4..0x8f8fff** band union, replace-if-narrower (seed init unread ⇒ band = caller param); min≤max → `jbe 0x8f8fde` else log path (strings **0x11735f0.. UNREAD** ⇒ port throws); mInitialized := 1 @0x8f9054; celldata assign `mov %ecx,0x4(%eax)` @0x8f3650/0x8f3a04. **Assert machinery:** fmt 0x1150f60, FILE 0x1173240 (`procedural_utils/biome_materials.cpp`), lines 254/263/264/271/280 = codes 0xfe/0x107/0x108/0x10f/0x118, null-crash `movl $0x1ca9,(%eax)`. Port throws (honest, P1-dead/UNREAD): jitter 0x9119d0, fbm 0x9fad90, polygon 0x10096a0, band-seed init, membership 0x442610 predicate, builder min>max target, record RESOLVE / lookup 0x741890; simplex skew reuses `noise-proto.mjs` (FLAGGED BSS). | `mapgen/extractions/fulltext86.asm (X1)` — classifier 1512120..1512205 + tail 1512525..1512565 + limit/polygon 1512305..1512392, ramp + gap 1520576..1520668, builder 1516229..1516965, hashes 1517031..1517250, call site 1541946..1541995 (all read this session); PE constants (.rdata file = VA−0x400E00, .data VA−0x401A00; exe md5 8b611494212a69492dd0a4527d9c92e0); `mapgen/lib/surface-level.mjs`; `tests/mapgen/surface-level.test.mjs`; `tests/mapgen/api-surface.test.mjs` |

| C76 | **sampler→classifier TRUE-VA call-site chain (FUN_0090d860) + the classify x/y FRAME decision (dig #97): loop regs/bounds/tail, field gate, origin-adds, evaluator2 arg order, floor-fix push order, null-MERGE, kind/planter parity** | Bytes read this session (mapgen/extractions/fulltext86.asm (X1)). **Loop**: outer **ESI = y** init `mov (%ebx),%esi` @0x90d8cf → `[esp+0x14]` @0x90d8d5; min-fold end `mov (%eax),%edx; add %esi,%edx; …; cmovb %eax,%edx` @0x90d8d9..0x90d8e7 → `[esp+0x30]`, head `cmp %edx,%esi; jge 0x90dddd` @0x90d8eb/ed; inner **EDI = x** `xor %edi,%edi` @0x90d8f6 → `[esp+0x1c]` @0x90d8f8, bound `*[args+0x10]` head `cmp %edi,(%eax); jle 0x90ddd0` @0x90d8fc/fe; tail reloads `mov 0x14(%esp),%esi; mov 0x1c(%esp),%edi` @0x90ddb0/b4 → **`inc %edi` @0x90ddbf → save @0x90ddc0 → `cmp (%eax),%edi; jl 0x90d904` @0x90ddc4/c6**; `mov 0x30(%esp),%edx` @0x90ddcc → **`inc %esi` @0x90ddd0 → save @0x90ddd1 → `cmp %edx,%esi; jl 0x90d8f3` @0x90ddd5/d7** ⇒ C54's slab labels 0x50d104 (inner-x) / 0x50d0f3 (outer-y) **confirmed — no §8 overturn**. **Field gate** (f32 grid `owner+0xb4`, stride `[owner+0x9c]`): idx `imul %esi,%eax; add %edi,%eax` @0x90dbb4/b7 → `call 0x9499f0` @0x90dbba → `movss (%eax),%xmm0` @0x90dbbf → **`comiss 0x11dfa94,%xmm0` @0x90dbc3 → `movss %xmm0,0x24(%esp)` @0x90dbca → `jbe 0x90e02b` @0x90dbd0** (field ≤ 0.5 ⇒ skip cell); **P = `[config+0x1d4]`** @0x90dbdb → `[esp+0x28]` @0x90dbe1 → `test; je 0x90e02b` @0x90dbe5/e7 (P null ⇒ same skip). Pre-gate existing-id short-circuit: u8 `call 0x949bb0` @0x90db5b → `movzbl; dec; cmp $0xfe; jne 0x90db80` @0x90db60..69 (fresh val 0 ⇒ falls through ✓), `[esp+0x28] > 0` → cell `call 0x4b80e0` @0x90db92 → non-null → **`jmp 0x90dd8d`** @0x90db9f (existing material → kind dispatch, skips classify — no-op on fresh all-zero masks; id setter lives in the unread loop-body gap 0x90d904..0x90db57, tagged). **Origin-adds (int32, clobber)**: `mov (%eax),%esi; add %edi,%esi` @0x90dbf4/f9 ⇒ ESI = `*[args+0x24] + x-counter`; `mov (%eax),%edi; add 0x14(%esp),%edi` @0x90dbfb/fd ⇒ EDI = `*[args+0x28] + y-counter`. **evaluator2 `call 0x908e70` @0x90dd24**: xmm0 = (d)ESI (`movd; cvtdq2pd` @0x90dd1c/20), xmm1 = (d)EDI (`movd %edi; cvtdq2pd` @0x90dd14/18), **xmm2 = field** (`movss 0x24(%esp),%xmm2` @0x90dd0e) ⇒ **evaluator2(x, y, field)** = port arg order ✓ (port arg3 = 1.0 = the documented single-call proxy — resolved); result `movss %xmm0,0x28(%esp)` @0x90dd29. Reached via u16 wrap `call 0x9fe4e0` @0x90dcc6 → `movzwl; dec` @0x90dcd3 → id1 ≤ 0 → **`cmpl $0x0,0x2a4(%eax)` @0x90dd01 → `je 0x90ddb0` @0x90dd08 = mBiomeMaterials NULL ⇒ no write (air)**. **Floor-fix → classify `call 0x8f5030` @0x90dd7e**: seq1 `sub $8` @0x90dd2f → `movd %edi,%xmm0; cvtdq2pd; movsd (%esp)` @0x90dd32/36/3a (y) → IAT `call *[0x114a434]` @0x90dd3f (CRT floor) → `call 0x1033970` @0x90dd48 (f64→int) → **`push %eax` @0x90dd55 = floor(y)** (first); seq2 `movd %esi; cvtdq2pd` @0x90dd4d/51 (x) → same floor → **`push %eax` @0x90dd72 = floor(x)** (last); `movss 0x2c(%esp),%xmm3` @0x90dd6c (esp = B−4 ⇒ [B+0x28] = evaluator slot ⇒ **v**); ecx = `[[ebx+0x20]+0x2a4]` @0x90dd73..78 ⇒ at call **[ebp+8] = floor(P24+x-counter) = x, [ebp+0xc] = floor(P28+y-counter) = y** — cross-anchored by C75 (x = [ebp+8], y = [ebp+0xc]) + `mov 0xc(%ebp),%esi` @0x8f53f4 feeding limit_y `movss 0x3c(%ebx)` @0x8f53f9 / `comiss 0x40(%ebx)` @0x8f540e (both re-read this session). **Null-MERGE**: `mov %eax,%ecx; mov %eax,0x28(%esp)` @0x90dd83/85 → `test %ecx; je 0x90ddb0` @0x90dd89/8b = record NULL ⇒ no window-store (air). **Kind** `[record+0x38]` @0x90dd8d → `cmp $3; jne 0x90de0e` @0x90dd90/93: ==3 → `movzbl 0x1344ce1` @0x90dd95 → `call 0xa047d0` @0x90ddab (bss u8 arg, **no grid store**, → tail); ≠3 → intern ptr `[esp+0x2c]` null → `je 0x90de2c` @0x90de14 / kind `cmp $1; jne 0x90de2c` @0x90de16/19 / `lock xadd` @0x90de1b → `cmp $0x2000; jae 0x90de2c` @0x90de1f/24 (cap) / value `mov 0x4(%edx,%eax,4)` @0x90de26 else `xor %eax,%eax` @0x90de2c = 0. **Planter (arg parity with classify)**: reload raw counters `mov 0x14(%esp),%esi` @0x90de2e (y) / `mov 0x1c(%esp),%edi` @0x90de32 (x) → pushes value `push %eax` @0x90de36 (+`[esp+0x24]` save @0x90de37), record `push %ecx` @0x90de3e, **y-sum `*[args+0x28]+esi`** (`mov (%eax),%eax; add %esi,%eax; push %eax` @0x90de42/44/48), **x-sum `*[args+0x24]+edi`** (`mov (%eax),%eax; add %edi,%eax; push %eax` @0x90de4c/4e/50) → **`call 0x7644d0` @0x90de51** (this = `*[[args+0x2c]]` via @0x90de3f..46) = **the exact (x, y) classify got** ⇒ C54's "planter args = material→world write" identity confirmed; null → `je 0x90ddb8` @0x90de62 / else grid base `owner+0x1e0` (`add $0x1e0,%ecx` @0x90de87), stride `[owner+0x1c8]` @0x90de81 → idx `stride·esi+edi` @0x90de8d/90 → accessor `call 0x95a5e0` @0x90de93 → value reload `[esp+0x24]` @0x90de98 → **DWORD store `mov %ecx,(%eax)` @0x90de9c**; window abort post-store (ecx = owner @0x90de9e): `test %edi; js 0x90df02` @0x90dea1 (x < 0) / `test %esi; js 0x90df02` @0x90dea5 (y < 0) / `cmp 0x168(%ecx),%edi; jge 0x90df02` @0x90dea9/af / `cmp 0x16c(%ecx),%esi; jge 0x90df02` @0x90deb1/b7 ⇒ **counters ≥ 0 = window-local px** (origins carry any negative/world offset; abort target 0x90df02 unread, tagged). **FRAME decision (classify x/y units)**: values = origin (P24/P28) + window counters (int px). Three converging lines pin y's frame as **world px with 0 = surface-band top = canvas py SKY_ROWS·512 = 24576**: (a) `/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/biome/hills.xml` `<Materials name="forest">` read this session — **limit_y=1 on only 2 of 6 comps**: soil `[-1024, 424.229]`, copper `[750, 2048]`; the other four `limit_y="0"` (gate skipped — `cmpb $0,0x39(%ebx)` @0x8f53f0; the prior "four-band" claim is **retracted**); (b) same file `mGradientStartY="-1024"` :19 / `mGradientEndY="1024"` :15 share the frame; (c) the surface band lives at canvas ty 48..50 = biome rows 0..2 (experiments/2026-09-21-noise-window.mjs:4-6) ⇒ y ≈ 0..1536 there. **Eliminations**: y = world px @OFFSET_Y=14 origin → surface = −7168 ∉ [−1024, 424.229] ⇒ soil rejects the surface ✗; y = raw canvas px → surface = 24576 > 424.229 ⇒ soil rejects ✗ ⇒ **y = canvas_py − 24576** ✓. **x**: no `limit_x` anywhere (x only phases the field ⇒ frame shift-invariant) ⇒ **x = canvas px (offset 0)** ✓ — the −24576 shift belongs to y's sky band, which has no x counterpart (C10/C11 grid starts 0,314). **Port wiring (dig #97)**: x = `tx·512 + cx·10 + 5`, y = `ty·512 + cy·10 + 5 − 24576`, integer math (+5 = cell center = the lane's `gx+0.5` convention; floor implicit — sums are int). Game classifies **per pixel** (counters step 1 px); port samples one px per cell (cell center) — deviation tagged. OPEN (tagged): `[args+0x24]/[+0x28]` origin-field contents (frame pinned; x/y pairing pinned by the classify+planter arg identity — shift magnitudes unread) · kind enum (==3/==1 arms observed only) · band seed init (`{0,0}` proxy) · celldata RESOLVE/lookup `0x741890` + membership `0x442610` · planter body `0x7644d0` (px→cell snap unread) · loop-body id-setter gap `0x90d904..0x90db57` · abort target `0x90df02` · u16 cell-lookup `0x4b80e0` DEFERRED |
| **C77** | surfaceField's rp > 0.85 addNoise switch + shared blend tail (full re-read dig #98, entry (98)): gate `comiss 0x11dfb84` @true **0x90ab48** → `jbe 0x90b0a2`; loads: movzbl [uid+0x220] @**0x90ab55**, addValue [uid+0x260] @**0x90ab5b**; `dec %eax` @**0x90ab74** → je 1→**0x90afeb** / 2→**0x90aeba** / 3→**0x90ae03**; default arm (addNoise ∉ {1,2,3}) @**0x90ab7d** is **LIVE via the world value 0** (hills_flat/mountain_lake; laboratory outside P1): `call 0x8fb570` @**0x90ab9f** (UNREAD, prelude-shaped only — ≠ whiteLattice2d 0x8fb350 → ISSUES **I20** ①) → g = a·0.05+0.05 f32 chain → `call 0x8fca60` (simplex2d) @**0x90abee** → shared tail → `jmp 0x90b0a2`; case-1 `call 0x8fb350` @0x90b00d → core `call 0x8fc020` @**0x90b068** (xmm0 = x-chain, xmm1 = y-chain); case-3 (lake ×4) enters @0x90ae03 and shares the n·r' core via `jmp 0x90b068`; case-2 lattice @0x90aef9 → fnv `call 0x8fbb40` @0x90af1d → inner `call 0x8fca60` @0x90af49 → core @0x90afdc → `movss` rp @0x90afe1 → **`jmp 0x90b079` SKIPS `cvtps2sd`+`mulsd n·r'` @0x90b072/75 ⇒ case-2 r2 = f32(n) BARE**; shared tail @**0x90b072..0x90b09f** = rpost `f(f(f(r2−rp) · f((rp−0.85)/0.1)) + rp)` — `subss %xmm2,%xmm1` @**0x90b08b** = xmm1−xmm2 = **r2 − rp** (the pre-dig-98 port computed (rp−r2), SIGN-FLIPPED) → `divss` @0x90b08f → `mulss` @**0x90b097** → `addss` @**0x90b09b** → rpost → xmm2 @0x90b09f; merge @**0x90b0a2** `cmpb $0x0,0x24c(%ebx)`; FINAL @**0x90b0d9..0x90b0fb** = f(G·gradW·per) + f(P·rpost) + add. PE consts (.rdata; file = VA − 0x400E00, rdata.bin anchor 0xeb14 ↔ VA 0x11df914): 0x11dfb84 f32 0.85 · 0x11df974 f32 0.10000000149011612 (K.wBias) · 0x11dfc70 f64 0.02 · **0x11dfc68 f64 0.019999999552965164** (case-1 chain scale — widened-f32; the old "f32 2.0" gloss WRONG) · 0x11dfcd8 f64 0.06 · 0x11dfdd8 f64 0.5 |
| C78 | **L3 anchor fit verdict: gen↔capture registration = CONSTANT (+11, +12) world px, applied at `worldColorAt` sampling (dig #99, entry (99))** | Fit instrument `mapgen/experiments/2026-09-24-l3-anchor-fit.mjs` (refuses SURFACE_V2/V3/PROC_FILL env — default render only), seed 78633191, n=32 wang chunks (bty 14/15/17/18 × tx 29..38; coalmine 10 / excavationsite 16 / liquidcave 2 / fungicave 4; 6/32 border-flagged), scan dx∈[−15..35] dy∈[−5..25] world px (certified bound VERIFIED:1083 x∈[−10..30] y∈[0..20] world px, ±5 margin), evidence `mapgen/out/l3-anchor-2026-09-24-preapply.json` (fit) + `…-2026-09-24.json` (post-apply residual re-run). Metrics — plain solid IoU SATURATES (capture cave bg dark ~(13,14,18) ⇒ refSolid ≈ 1.0, no signal), so three structure-sensitive ones: **air** IoU (lum<24, the `mapgen/pipeline/3-compare.mjs:18` constant), **edge** IoU (|gx|+|gy| ≥ 30), **lum** zero-mean NCC; plus 1-D column/row air-profile NCC cross-checks. **§4 rule (VERIFIED:208) ⇒ CONSTANT on both axes:** best structured competitor (free per-area phase over the 4 areas / tx-linear / bty-linear / lattice-saw (512·coord mod 10)) improves RMSE ≤ **4% dx** (const 9.35 → area 8.97 px) and ≤ **2% dy** (6.21 → 6.11 px) — far under the 20% bar; per-metric `fitAxis` verdicts all "no coherent rule (scatter ≈ noise)" (per-chunk best-offset RMSE ≈ 6–12 px ⇒ a constant is valid far from fit, the §4 precondition). **Value (11,12):** per-metric medians air (12,12) / edge (6.5,11) / lum (11,14), per-chunk combo median (11.5,11.5), dy>0 in 29/30/31 of 32 per metric (combo 31/32); pooled paired candidates vs (0,0): Δair **+0.0253** (t=4.82, 25/32), Δedge **+0.0080** (t=3.35, 19/32), Δlum **+0.0542** (t=5.10, 29/32); dy dominates ((0,12) keeps 81–83% of Δ, (11,0) ≈ 0: +0.0024/−0.0002/+0.0055) yet the dx increment is significant ((11,12) vs (0,12): t=2.95/2.25/3.50); (11,12) vs (10,10) indistinguishable (t ≤ 1.80) but ≥ on all three (pairwise win-count (11,12) 5/6 vs (10,10) −2/6); sign-control (−11,−12) NEGATIVE (Δair −0.0491, Δlum −0.0784, 0/32) ⇒ direction pinned; all medians INSIDE the certified bound. **Application (registered before use):** `L3_ANCHOR = {x:11, y:12}` in `mapgen/lib/world-gen.mjs` — `worldColorAt` display (x,y) samples content (x+11, y+12) (instrument sign: peak (DX,DY) ⇒ output(x) := gen(x+DX)); input-canvas bounds check first, then content-past-edge → null (right 11 px / bottom 12 px strips = background — no content exists there); all three lanes (area/template/noise) shift together (they share one world frame); gen-cache `.bin` untouched (sampling-only — no cache rev). **Layer:** the fit's gen side IS `worldColorAt` (instrument line 296) which does NOT route through `coords.mjs`/`chunkToBigMapRect` ⇒ the bench `CORRECTION` knobs stay 0 (different consumer, own fit-transform rig). Post-apply regression (measured; the originally phrased literal full-window bit-equality is refined here): layer+sign verified by **reconstruction** — the back-shifted frame `old(q) = new(q−anchor)` scored at (11,12) is **BIT-EQUAL to the recorded pre-apply JSON 32/32 × all three metrics**, post full (0,0) equals the recorded post JSON **32/32 × 3**, and the edge in-window [2,498]×[2,497] counted-set mismatches are **0**; full-window cand (0,0) vs pre (11,12) differs only by the scorer's skipped strip (right 11 cols / bottom 12 rows — max per-chunk |Δ| air 0.0170 / edge 0.0038 / lum 0.0759; mean Δ −0.0017 / +0.0007 / −0.0063) plus, for edge alone, the frame-relative validE/edgeMask band (both domains are frame-relative [1,510], mapping to different absolute pixels pre/post). Scope hedge (checked by dig #100): fit measured the wang lane on 4 areas; template/noise-lane registration rides the shared-frame interpretation and is tested by the surface-y IoU + overlays. |
| C79 | **surface-y line IoU metric spec — Phase 5 step 2b (dig #100, entry (100))** | Instrument `mapgen/experiments/2026-09-24-surface-y-iou.mjs` (env gate: `SURFACE_V3=1` REQUIRED, `SURFACE_V2`/`PROC_FILL` REFUSED = candidate-lane isolation; attach gate `noise-terrain.mjs:297`, V3 chain `noise-terrain.mjs:241`), seed `CAPTURE_SEED` 78633191, cache r3i, ref = `mapgen/out/ref/<tx>_<bty>.png` (noitamap stitch; tx 4..58, bty 0..19 on disk), gen = `worldColorAt` (L3_ANCHOR C78 applies at sampling); 1 tile px = 1 world px. Scan ref-side P1 tiles bty ∈ [6..15] × tx ∈ [4..58]; **bty 16 (HM row) excluded** (plan; PREDICTABLE_ZONES row j=16). P1 label = first-wins `_biomes_all.xml` color→filename basename matching `^(mountain|hills|desert|winter|lake)` (color-keyed `cfg.biomes` cannot name color-absent defs — dig #98 census note). **y_ref** (ref): column needs sky top = ≥ **6** air of rows [0..7] (air = lum < **24**, AIR_THRESHOLD `pipeline/3-compare.mjs:18` per C78) else null — kills cave ceilings and all-ground tiles — then first solid run ≥ **RUN_MIN 20 px** → run start; **y_gen**: first solid run ≥ 20 px, start ≥ 0 (NO sky-top filter: the candidate's flood signature y_gen = 0 must stay measurable). Tile scored iff y_ref non-null on ≥ **MIN_VALID_FRAC 0.25** of columns; pairs = columns with both lines. Per-tile: mean + median |Δy|, bias mean(y_gen − y_ref), **band hit-rate at ±1/±2/±3 world px** (fraction of paired columns with |Δy| ≤ band — the plan's "band IoU"), genNoLine count, gen top-air frac rows [0..7] (flood detector). Aggregates: overall + per family + per bty. Outputs: `mapgen/out/surface-y-2026-09-24.json` + overlays `mapgen/out/surface-y-2026-09-24/<tx>_<bty>_<label>.png` (dim-ref base, red y_ref / green y_gen / yellow fill where |Δy| ≤ 3 / dark-red gap fill). Ref pre-census (throwaway probe this session): sky→ground transition lives in bty 10..15 (rows ≤9: 0 P1 tiles scorable), 99 P1 tiles ≥0.25 frac before the sky-top filter. Source: ABOUT_MATH §6 (100). |
| C80 | **V3 field-build WORLD frame: the −17920 / −31744 shifts + evaluator2≡classify coords (dig #101, entry (101))** | The classify chain's field source = `surfaceField(uid, wx, wy, gradAt, 0, DEF_SEED)` fed at WORLD px: `wx = canvas_px − 35·512` (= **17920**), `wy = canvas_py − (SKY_ROWS+14)·512` (= **31744**), canvas px = the C76 lane sums pre-shift (x = tx·512+cx·10+5, canvas py = y+24576). Origin semantics: world x=0 = map center = biome px 35, world y=0 = `biome_offset_y` 14 = biome row 14 — source `mapcap/PREDICTABLE_ZONES.md:9-10` (re-verified on disk this session: "1 map px = 1 chunk = 512 world px; x=0 at map center, y=0 at biome_offset_y=14; world chunk (cx,cy) = biome px (cx+35, cy+14)"). **Why world:** inside surfaceField, gradAt receives `f(coord·0.49162514)+p94` (`mapgen/lib/noise-proto.mjs:628`, p94 = 0 = V2's pass at `noise-terrain.mjs:238`) and makeGradAt's ramp is documented on world-y (`noise-terrain.mjs:143`); with hills.xml's real attrs (mGradientStartY −1024 / EndY 1024 / LowNoise −292.571 / HighNoise 234.057, hills.xml:15-19, greped this session) the ramp lane crosses field0 = 0.5 at wy ≈ **+235 px** (field0 = −29.257 + 0.12641·wy) — inside the capture's surface band (PREDICTABLE_ZONES:31-32, j=12..14 ⇒ wy −1024..512) — while the cell-coord frame (gy ≈ 0.4916·3000 ⇒ ramp t clamped ⇒ field0 ≡ 234.057) and the C76 lane frame (y ≈ 6144 ⇒ t clamped ⇒ same) both clamp the ramp degenerate. **Evaluator/classify coords stay the C76 lane frame this dig** (x = canvas px, y = canvas py − 24576; `evaluator2(x, y, field)` @0x90dd24 ≡ classify coords via the floor-fix identity — evaluator2 xmm0/xmm1 = the same origin-added counters classify receives after floor, C76; hence `v = evaluator2(x, y, field)` uses the SAME x,y as `classify`). The two-frame split is deliberate: the field build takes world px while the evaluate/classify lane keeps C76's frame; the C76 frame itself is suspect on claim (c) ⇒ **I21** (flip = a separate later dig). The driver's own arg units (0x908F40 caller body @0x7930d3, loop extent) remain the deeper-ghidra fallback if this wiring still fails. Gate value = surfaceField's RETURN (the final combine `f(gradWCoef·gradW·per) + f(perlinCoef·rpost) + add`, `noise-proto.mjs:713`) — the driver feeds that into the f32 grid the gate reads (VERIFIED:593), not r' (r' is only the internal field-slot alias, `noise-proto.mjs:632-633`). Source: ABOUT_MATH §6 (101). |
| C81 | **fnB walk-caller + switch-path geometry — the caller side of C73 + the (94) f32-trap corrections (dig #102, entry (102))** | All cites = true VAs in the cached `mapgen/extractions/fulltext86.asm (X1)`; rdata read from `noita_dev.exe`, file = VA − 0x400E00 (anchors validated same run: `0x11dffe8` = f64 101.0, `0x11dfa40` = f32 0.4). **Pre-loop:** `[−0x12c] = rollPos(config[+0x28],[+0x2c])` = cave_count = the walk limit (cmp @8f071e); `[−0x160] = rollPos(config[+0x34],[+0x38])` = surface_caves_count = the switch budget (cmp @8f01aa); inits `[−0x119] = [−0x150] = [−0x118] = [−0x154] = 0` @8eff47..8eff76; dims object `[−0x13c]`: `[+0] = w → [−0x128]` (read @8efeed), `[+4] = h → [−0x138]` (read @8efee4). **Loop:** head 8eff90, back-edge `jl`, walkIndex `[−0x154]` inc @8f0717; switch counter `[−0x150]` vs `[−0x160]`. **Cursor (fresh per walk):** `[−0x104] = lerp(config[+0x3c],[+0x40], draw)` @8effb2..8effe3 = C52 `cave_strength`; the switch path multiplies it by the lane factor below. **Path alternation, flag `[−0x119]`:** =0 → case B @8f00d9; ≠0 → case A @8efff1 (sets flag:=0 @8efff7); the switch path sets flag:=1 @8f03ac ⇒ cycle B+switch, A, B+switch, A … until `[−0x150] ≥ [−0x160]`, then all B-no-switch. **Case A (chained):** `X = [−0x118] + trunc(lerp(−0.01·w, +0.01·w, u))` ([0x11e0560] = −0.01, [0x11df8e8] = 0.01) @8efff1..8f0068; `Y = [−0x108] + trunc(lerp(0.05·h, 0.25·h, u))` ([0x11df948] = 0.05, [0x11df9d0] = 0.25) @8f006e..8f00ce; **fnA's epilogue has NO pair write-back** (8ef85d..8ef86c) ⇒ case A chains from the pre-call slots. **Case B:** `Y_B = trunc(lerp(0.07·h, 0.33·h, u))` ([0x11df958] = 0.07, [0x11dfa10] = 0.33) → `[−0x108]/[−0x130]` @8f0170..8f0182; `X_B = trunc(5 + u·(w−10))` ([0x11e00a0] = 5.0) → `[−0x118]/[−0x134]` @8f0178..8f019e; `jge 0x8f03b3` @8f01b0 keeps these when the switch budget is spent. **Switch path (case B ∧ budget left) @8f01b6..8f02e0:** ratio = `f32(w)/f32(count)` (divss @8f01cc); endpoints `[−0x148] = +0.45·ratio` ([0x11dfa5c]) and `[−0x108] = −0.45·ratio` ([0x11e0588]) @8f01d3..8f01eb (**`[−0x108]` transiently overwrites Y_B here**); `X = clamp( trunc(lerp(low,high,u3)) + trunc(⌊w/count⌋·walkIndex) + trunc(lerp(low,high,u4)), 5, w−5 )` — two independent jitter draws (u3 @8f01f3 → `[−0x10c]` @8f021d; u4 @8f0225), floor stride via `idiv [−0x160]` @8f0238, clamp `cmovl/cmovg` @8f0280..8f0292 → `[−0x118] = [−0x134]`; **Y₀ = trunc(u·[0x11dfef0]) → `[−0x108] = [−0x130]` @8f02a0..8f02b9 with [0x11dfef0] = f64 6.0 ⇒ Y₀ ∈ {0..5}** (bytes `0000000000001840`; `mulsd` F2 0F 59 ⇒ entry (94)'s "= 0" was the **f32 trap**); lane select @8f02bf..8f02e0: own draw, `ecx = 3 − trunc(u·[0x11e05f8])` with **[0x11e05f8] = f64 −3.0 ⇒ ecx ∈ {3,4,5} each 1/3** (bytes `00000000000008c0`; (94) ③'s "fixed k = 3" REFUTED; `ja 0x8f03a6` dead only because ecx ≤ 5), jump table @0x8f2fd0 (file 0x4f23d0): `[3] = 8f0341` → cursor ×(0.4u+0.1) ([0x11dfa40]/[0x11df974]), `[4] = 8f035e` → ×(0.25u+0.75) ([0x11df9d0]/[0x11dfb2c]), `[5] = 8f037b` → ×(0.13u+1.07) ([0x11df990]/[0x11dfc20]); lanes [0..2] unreachable. **Budget @8f03b3..8f063f:** `S = [−0x138] − edi = h − Y₀`; first `[−0x110] = LERP(0.15·S, 0.96·S, u)` ([0x11df99c] = 0.15, [0x11dfbc8] = 0.96) @8f03f2..8f043f; the flag=1 walk OVERWRITES `[−0x110] = LERP(0.45·S, 0.96·S, u)` and sets `[−0x15c] = 0.45·S` @8f054c..8f058d ⇒ (94)'s "LERP(0.45H,0.96H,u)" = the flag=1 arm only, flag=0 ⇒ the 0.15 arm (resolves the CONSTANTS `:1261-1271` budget-attribution conflict); then `[−0x110] ÷= Δy` @8f0626..8f063f. **Δy → `[−0x120]`:** own draw `dy = 0.4u + 0.1`, `+0.5 iff trunc(101u) < 33` ([0x11dffe8] = f64 101.0) @8f046a..8f04b3 — (94) stands. **d₀:** `[−0x100] = 2u − 1` @8f0447..8f0462 ([0x11dfe68] = 2.0, [0x11dfbf0] = 1.0); pushed as **(2u−1)²** (`mulss %xmm2,%xmm2` @8f069f). **growth → `[−0x148]`:** `cvtsd2ss(u) + [0x11df874 = 0.0f]` ⇒ growth = u @8f04d8 (the addend is dead); gate1 @8f0645 `trunc(101u) < 50` ⇒ growth := 0; gate2 @8f0663 `trunc(101u) < 50` ⇒ growth := growth² else growth. **childCounter `[−0x124]`:** `= rollPos(config[+0x44],[+0x48])` @8f04e8..8f050a; `+= ⌊8u⌋` iff `trunc(101u) < 10` ([0x11dff18] = f64 8.0); flag=1: `+= rollPos(config[+0x4c],[+0x50])` @8f05c8..8f05ea and `+= 2 + ⌊5u⌋` iff `trunc(101u) < 20` ([0x11e0610] = f64 −5.0 ⇒ `2 − trunc(−5u)`). **scale → `[−0x10c]`:** 0.25u+0.75 (flag=1 @8f05c0) / 0.5u+0.5 (flag=0 @8f03e7) — fnA never consumes `[ebp+0x14]` except child pass-through ⇒ droppable from the port's walk signature. (Slots `[−0x10c]`/`[−0x148]` are transiently reused by the switch X-law before the scale/growth writes.) **Push map @8f0698..8f0703 (`add $0x28`):** ecx = state (RNG thiscall), edx = config; stack `[0] dims, [4] &pair(−0x134), [8] cursor, [0xc] scale, [0x10] budget, [0x14] d₀², [0x18] Δy, [0x1c] growth, [0x20] &childCounter(−0x124), [0x24] config[+0x24] = spawn_percent` (movss @8f06a3) = **the scatter gate** (C52). **fnA body (8eec70..8ef86c) additions:** prologue draws (D2 flag coin, `s = (2 − trunc(−4u))/5`, anchors A–D); the envelope + D1/D2 stamp pair; per-iteration stamp = **`push $1; call 0x8ee750` @8ef37a..8ef37c** → `y += [ebp+0x20]` (Δy) @8ef381..8ef38e → the spawn_percent gate (`comiss` 0 vs `[ebp+0x2c]`; `jbe 8ef401` @8ef39b..8ef3a3); **`0x8ee750` = the bounds-checked cell-setter entry** (fn start 8ee750; x ≥ 0 ∧ y ≥ 0 ∧ x < w ∧ y < h else `8ee91c`; cell fetch via accessor `0x9499f0`; the pushed-flag → LERP-vs-max branch UNREAD — **FLAGGED**; C51's blob lanes push $0 = max-bleed, fnA pushes $1); pair box exit = plain bounds, **NO `& (gridW−1)` wrap**; **children spawn INSIDE fnA** (2% @8ef774..8ef783, `decl (%eax)` of childCounter @8ef79e, child budget = `(u·50 − 50) + (parent − steps)` @8ef7e2..8ef800, d sign-flip `xorps 0x11e0c50` @8ef7c2, child call @8ef823) ⇒ **the port's outer `childs` loop (`caves-field.mjs:269-272`) is a false structure**; the in-walk scatter block is gated by `[ebp+0x2c] = spawn_percent` (byte-channel only ⇒ float-neutral when omitted from the float port). Source: ABOUT_MATH §6 (102). |
| C82 | **fnA walk body — the prologue/loop draw order + the walk-side gates the Q3a port consumes (dig #103, entry (103))** | Cites = true VAs in `mapgen/extractions/fna-102.asm (X10)` (fnA = 0x8eec70..0x8ef86c); rdata from `noita_dev.exe`, file = VA − 0x400E00. **Prologue = 6 draws:** ① the flag coin `trunc(101u) < 50 → [−0x70]` (mulsd [0x11dffe8] = f64 101.0 → `cmp $0x32` @8eece1 → cmovl) @8eecc1..8eecf4 — the coin gates ONLY the D2/L1 arm (the `je` @8ef2b6 reads it after the SSE roll block, which leaves EFLAGS); ② s = `(2 − trunc(−4u))/5` ([0x11e0608] = −4.0 f64, [0x11e00a0] = 5.0) → [−0x20] @8eef17..8eef40; ③–⑥ the radius-envelope anchors `A = [−0x68] = 0.2·u·s` ([0x11df9b4] = 0.2) @8eef45, `B = [−0x50] = (1+2.5u)·s` ([0x11dff10] = 2.5, [0x11dfbf0] = 1.0) @8eef69, `C = [−0x5c] = (1+2.5u)·s` @8eef8e, `D = [−0x6c] = 0.2·u·s` @8eefb3. The assert blocks (push $0x233/0x235/0x243 → `movl $0x1ca9,(%eax)`) carry NO draws; the assert pre-gate `10240.0 ([0x11e049c], NEW) > budget → skip` @8eefda..8eefe5 never fires port-side (budget ≪ 10240). Budget pre-gate `0 > budget → epilogue` @8ef0b1 runs ONCE before the loop. **Per iteration, in order:** trunc pair (cvttss2si [−0x4c]/[−0x44] → [−0x38]/[−0x34]) → the PLAIN box exit `x<0 ∨ y<0 ∨ x≥w ∨ y≥h → epilogue` @8ef0d0..8ef0fe (NO `& (gridW−1)` wrap) → cursor gate `0 ≥ [ebp+0x10] → epilogue` @8ef104..8ef10c → envelope `t = f32(steps)/budget`: lane = t<0.2 `lerp(0,cursor,t/0.2)` \| 0.2..0.6 `lerp(cursor,0.7,(t−0.2)/0.4)` ([0x11dfa44] = 0.4) \| >0.6 `0.7 − 0.7(t−0.6)/0.6` ([0x11dfaf8] = 0.6, [0x11dfb1c] = 0.7) @8ef112..8ef184 → **`[−0x28] = 1 − lane`** @8ef188..8ef19f; radius = t<0.3 `lerp(A,B,t/0.3)` ([0x11df9f0] = 0.3) \| 0.3..0.6 `lerp(B,C,(t−0.3)/0.3)` \| >0.6 `lerp(C,D,(t−0.6)/0.6)` → [−0x20] @8ef1a6..8ef204 → **the roll draw (unconditional, inline LCG @8ef24b)**: `[−0x28] = (1−lane) + (u·0.35 − 0.25)` ([0x11dfa1c] = 0.35, [0x11df9d0] = 0.25) — **NO cross-iteration accumulation** (the 1−lane rewrite @8ef19f resets [−0x28] every iteration; C46's "+=" is within-iteration only) → flag arm: `[−0x70] = 0` → v = `[−0x28]`; ≠0 → **the D2 draw** `v = (u·0.32 + 0.35)·[−0x28]` ([0x11dfa00] = 0.32) @8ef2bc..8ef34c → clamp01 @8ef34f..8ef369 → **the stamp `push $1; call 0x8ee750`** (ecx = dims, edx = &trunc pair, xmm0 = 1.0, xmm1 = xmm3 = v, xmm2 = radius) @8ef36c..8ef37c — max-bleed + the y<25 eave per C46; the pushed-$1 LERP-vs-max arm inside 8ee750 stays UNREAD (FLAGGED, entry (103)) → `y += [ebp+0x20]` @8ef381..8ef393 → **spawn gate** `[ebp+0x2c] ≤ 0 → skip (no draw)` else gate draw → `u < spawn` → value draw `trunc(101u) < 95 (cmp $0x5f)` → `call 0x8eead0` @8ef38e..8ef3f9 — **OMITTED in the port** (config spawn_percent is not parsed ⇒ 0 ⇒ byte-identical skip; DRAW-CONSUMPTION CAVEAT if a def ever sets it > 0) → `bias [−0x24] := 0` @8ef398 → **bias gate 1** draw `trunc(101u) < 25 (cmp $0x19) → [−0x24] := −1.0 ([0x11e05a8])` @8ef433..8ef49b → **bias gate 2** draw `trunc(101u) < 25 → [−0x24] += 1.0` @8ef4db..8ef538 (both gates NEW this dig) → the d-split `[−0x20] = max(d₀²,0), [−0x28] = min(d₀²,0)` (d₀² = [ebp+0x1c]) @8ef53d..8ef565 → **the x-law draw** `x += clamp(lerp(min,max,u) + bias, −1.0, 1.0)` @8ef56a..8ef62c → substeps [−0x48]++ → **the re-jitter** `substeps > 50 (cmp $0x32)` @8ef631 → growth-gate draw `growth ([ebp+0x24]) > u` else skip @8ef66a..8ef6bc → fire: substeps := 0 + **the re-jitter draw** `[ebp+0x1c] := 2u−1` (mulss [0x11dfe68] = 2.0, subss [0x11dfbf0] = 1.0 — **LINEAR: the re-jitter CLOBBERS the caller's pushed SQUARE**, NEW nuance) @8ef6c0..8ef6de → **the child gate** `[cc] ≤ 0 → skip (NO draw)` @8ef6e3..8ef6e9 else gate draw `u·100.0 ([0x11e02dc]) < 2.0 ([0x11dfe68])` @8ef6ef..8ef783 → `decl (%eax)` BEFORE the budget draw @8ef79e → **the budget draw** `(u·50 − 50) + (budget − steps)` ([0x11e0284] = 50.0) @8ef7c6..8ef800 → recurse @8ef823 with the 10-slot map: dims, **&the parent's CURRENT trunc pair [−0x38]**, the SAME cursor, the (dropped) scale, child budget, **child d₀² = −parent's (xorps [0x11e0c50] @8ef7ba)**, Δy, growth, the shared &childCounter, the (dropped) spawn → steps++ → `f32(steps) ≤ budget → loop` @8ef836..8ef857 → **epilogue 8ef85d..8ef86c writes NO pair** (the caller's X/Y chain from the pre-call slots). **Re-pins this dig (register-before-use):** [0x11e05a8] = f32 −1.0 (the x-law clamp low + the bias offset; also cited in C73), [0x11e02dc] = f32 100.0 (the 2% child gate; also C73), [0x11e049c] = f32 10240.0 (the skippable assert pre-gate), [0x11dfa94] = f32 0.5 (also C76's field gate; the caller-side consumers = the Δy gate `trunc(101u) < 33 (cmp $0x21)` @8f048d..8f04b3 → `Δy += 0.5` and `scale0 = 0.5u+0.5` @8f03b5..8f03e7), and the fnA bias-gate immediates 25/101 ×2 (`cmp $0x19` @8ef48e/@8ef526). |
| C83 | **census P2 pass: the addNoise-default core true 0x8fb570 (I20① asm-closed), the surfaceField y-chain, and the per-tile band gate true 0x90b280 internals (entry (104))** | Method: text slice mapgen/extractions/text.bin (X32) = exe f[0x400c00:0xdd0000], objdump --adjust-vma=0x801800 (file = VA − 0x400C00; VA map re-pinned same run on C77's digest facts: `comiss xmm2,[0x11dfb84]` bytes @0x90ab48 + jbe rel → 0x90b0a2, `[ebx+0x220]` disp32 @0x90ab55, je rel → 0x90ae03); rdata file = VA − 0x400E00 (anchors 0.85/0.1/C1 re-matched). **true 0x8fb570 (721 B) formula, byte-closed:** f32(x@xmm0, y@xmm1); rx=round(x)/ry=round(y) (0x44d0b0 fld/fistp, C40/C13) **[SUPERSEDED (113): rx=floor(x)/ry=floor(y) — 0x44d0b0 = the FLOOR wrapper, C92]**; fx=x−floor(x), fy=y−floor(y) (cvttss2si+comiss+dec); sf(t)=(3−2f)·f² (f32 2.0@0x11dfe68, 3.0@0x11dff70); **PARITY weights — the differentiator vs whiteLattice2d C40, whose lattice itself is IDENTICAL (c0/fracs/corners/sin/round all shared): Wx = lerp(w0,w1,fx) with (w0,w1)=(sf(fx),fx) iff round(x) even else (fx,sf(fx))** **[(113): "round(x) even" → floor(x) even — C92]** (signed %2 idiom `and 0x80000001` @0x8fb613; Wy same on fy); c0 = 57·ry+rx (57.0@0x11e028c ✓C40); h(k)=frac(sin(c0+k)·43758.546875) (sin = 0x44d110 = jmp*[0x114a520] libm_sse2_sin_precise ✓C40; 43758.546875@0x11e04c8 ✓); k ∈ {0,1,57,58} with **58.0 = f32 @0x11e0298 NEW pin**, 1.0@0x11dfbf0 ✓, +0.0@0x11df874 ✓; out = lerp(lerp(h0,h1,Wx), lerp(h57,h58,Wx), Wy) (byte order @0x8fb789..0x8fb839). **surfaceField y-chain (both kind arms; asm @0x90a8c1..0x90a924 / @0x90ac49..):** gy = (f64(period)·[0x11dfa08] + y·[0x11dfdc8]) →f32 → ·0.1, period = f32 [BitmapNoise+0x94] (`movss [eax+0x94]` @0x90a8d2; ptr = `[ebx+0x1d4]` @0x90a8c1); **[0x11dfa08] = f64 6.86035959282328e-07 (raw dd c5 52 07 01 05 a7 3e) — resolves C38's semantics-open: the consumer = THIS y-chain period term (≈0 vs the x-chain's full +period; the asymmetry is byte-real, mulsd @0x90a904, not a decompiler artifact); the coefficient's PURPOSE stays open**; x-chain = (x·[0x11dfdc8] + period) →f32 → ·0.1 ✓ corroborates C37. **r = true 0x90b280 internals (NEW):** world offs [config+0x38]/[+0x40] f64 → ox/oy = (off+coord)&0x1ff; tile col = (x>>9) signed-mod [+0x50], row clamp [+0x54]; dev asserts embed procedural_terrain.cpp lines 0xec6/0xec7 (3782/3783), ox/oy ∈ [0,512); tile id = **0x94c700 = CSafeArray::GetAt** (assert !(i<0||i>=_size) csafearray.h:81; returns base + i·4) — **helpers NEW, never registered**; left-edge blend: ox < 0x2a (42) ∧ neighbor ≠ own → neighbor id via **0x909c70** (args dims,x,y; **x wraps mod W, y clamps [0,H−1]** → 0x94c700) → params via **0x90b680** → f = 1 − ox/[0x11e0274], **[0x11e0274] = f32 41.0 NEW pin**; per-tile params 0x90b680(this=config, out = 2×f64, tile): zero-fill then base f32 [tile+0x270]/[+0x274], mode [tile+0x288]: **0** = const, **3** = linear (y−[tile+0x278])·[tile+0x280] both lanes, **1** = core 0x8fc020 (C39) both lanes, **2** = lane0 0x9fad90 (the VERIFIED-labeled fbm; port throws) / lane1 core; common tail = freq [tile+0x290]·(off+y) → core → ·amps [tile+0x298]/[+0x29c]; caller [config+0x6c]==0 → direct-tile-arg path, ≠0 → the 512-index path, outer branch y ≤ [0x11e0050] **f64 380.0 NEW pin**, then the y-vs-blended-bounds cascade (every path a bare `return` in the decompile ⇒ **the XMM0 return expr = r's formula = OPEN, asm pending**; C37's r-label ✓). **0x90b110 = the inside-noise run, all fields per C37's uid map:** [mInsideNoiseFBM +0x228]==0 → plain dispatcher 0x8fd920 (arg [mInsideNoiseType +0x224]) else fbm wrapper 0x8fdad0 (C36: dispatcher×4 octaves, ÷0.9375); [OffsetBySeed +0x24d] → rng 0x9119d0 ×2; [Scaled +0x242] early-return. **Corroboration (census re-derived BEFORE consulting the register, then checked):** C36's dispatcher case table = this pass's decompile case→true-VA (0x8fb350/0x8fb850/0x8fb950/0x8fbb40/0x8fbd10/0x8fc020/0x8fc740/0x8fc900/0x8fca60 = C36's slabs +0x400800 ✓ all 9), C37's x-chain + 0.51/0.85 gates + r-label, C40's sin-hash family, C38's pins re-read this session (57.0/43758.546875/2.0/3.0/1.0/0.51/0.495/0.02/0.49162514/0.1/0.85/6.86e-07 all match). OPEN: r's XMM0 return expr; the 6.86e-07 role; 0x90b680 lane0/lane1 = which band bound; side-by-side vs 0x8fb350 (C40's rowA phrasing h58→h57 vs this read's lerp(h57,h58,Wx)). Status: read + registered (2026-09-28 (104)); port = I20②. Source: ABOUT_MATH §6 (104). |
| C84 | **r = true 0x90b280's return expr ASM-CLOSED (band-membership ramp: 0/1/t over X-parameterized bounds) + the driver chain 0x792580→0x908f40→0x90a860 with A/B identities + the caller-side combine slots (entry (105))** | text.bin lane (exe f[0x400c00:0xdd0000], adjust-vma 0x801800 ⇒ printed = true VA; windows re-read on disk this session: 0x90b280..0x90b2f5, 0x90b505..0x90b679, 0x90aac0..0x90ab50, 0x908f40..0x908f9b); rdata file = VA − 0x400E00, byte-reads this session: **0x11dfaac f32 = 0.5099999904632568 = the 0.51 gate** (f32 0.51 widened), 0x11dfb84 f32 = 0.85 ✓, 0x11e0274 f32 = 41.0 ✓, **0x11df878 f64 = 0.0**, **0x11dfdd8 f64 = 0.5**; re-matched 0x11e0050 f64 380.0 / 0x11dfbf0 f32 1.0 / 0x11dfa94 f32 0.5 / 0x11dfe68 f32 2.0; call edges from ~/work/ghidra-logs/p0_calls.csv. **Contract** `0x90b280(ecx = A, stackarg ret 4 = params B, xmm2 = X, xmm3 = Y) → f32`; prologue X → [ebp−0x34], Y → [ebp−0x1c], ebx := A. **Formula:** (1) `Y > 380.0` (jbe @0x90b2a1) → out = 0x90b680(A, B, X) (lea [ebp−0x3c]; above-grid = uid params); (2) `Y ≤ 380.0 ∧ A[+0x6c]==0` (cmp/je @0x90b2ef → 0x90b60f) → out = 0x90b680(A, B, X) (lea [ebp−0x4c]); (3) else the 512-tile path: `ox = trunc(A[+0x38]+X) & 511` (→[ebp−0x14]), `col = (that>>9) mod A[+0x50]` neg += cols (→[ebp+0x8]), `row = clamp(trunc(A[+0x40]+Y)>>9, 0, A[+0x54]−1)` neg → 0 (→[ebp−0xc]), `tile = A[+0x68].GetAt(col + A[+0x50]·row)` via 0x94c700 (this = A, `mov ecx,ebx` @0x90b51d), out = 0x90b680(A, tile, X) (lea [ebp−0x2c]); ox/oy ∈ [0,512) asserts log-only (procedural_terrain.cpp 3782/3783); **left-seam blend iff ox ≤ 41** (`cmp esi,0x29; jg 0x90b5f1`): `nb = 0x909c70(&A[+0x50], col−1, row)` issued twice (equality cmp vs own [ebp−0x8] @0x90b544, je → no blend; then value), **f = f32(1 − f32(ox)/41.0)** (movss 1.0 @0x11dfbf0, divss [0x11e0274]) → [ebp+0x8], n = 0x90b680(A, nb, X) (lea [ebp−0x4c]), **out := own + (n − own)·(f64)f per lane** (subsd @0x90b599/0x90b5a3, mulsd, addsd @0x90b5b2/0x90b5c4 — f32 weight, f64 math). **Returns:** `Y ≤ out0` → **0.0f** (xorps @0x90b2c3, direct ret, NO epilogue); `Y ≥ out1` → **1.0f** (@0x90b2de / @0x90b5d3, same); `out0 == out1` → guard t := 1.0 THROUGH the epilogue (ucomisd + lahf `test ah,0x44`: jp → division @0x90b645, jnp → guard @0x90b5e1; reachable only unordered); else **t = (Y − out0)/(out1 − out0)** (f64 subsd/divsd @0x90b651..59; blend path jmps to cvtpd2ps @0x90b65d); **shared epilogue @0x90b661: cvtps2pd → `addsd [0x11df878]` = + f64 0.0 (BYTE-READ ⇒ NO-OP) → cvtpd2ps → f32**. ⇒ **r = band membership in Y: 0 below [out0,out1], 1 above, normalized Y-position between ⇒ out0 = LOWER bound, out1 = UPPER bound** (fixes entry (104) ③); **bounds are functions of X** — 0x90b680's free XMM3 = X at every call site (`movapd xmm3,xmm2` @0x90b2a9/0x90b615, `movsd xmm3,[ebp−0x34]` @0x90b514/0x90b57c) with its phase = [A+0x48] + X. **Driver chain/identities:** p0_calls.csv `792580→908f40` ×3, `908f40→90a860` ×1 (the old row-22 `e8@0x7930d3→0x908F40` pin now in the P0 export); **A = surfaceField's ecx = 0x908f40's incoming ecx** (`mov esi,ecx` @0x908f51 → `mov ecx,esi` @0x908f77) **= FUN_00792580's ecx** — A's fields: +0x38/+0x40 f64 world offs, +0x48 params phase, +0x50 cols, +0x54 rows, +0x68 CSafeArray, +0x6c tiling flag; **B = params = the `0x909da0()` fetch** (push @0x908f8e; [B+4] kind: 0 → surfaceField, 1 → `biome->bitmap_data` cell color [B+0x1b0] asserts cpp 0xa6e/0xa7a, 2 → threshold-eval 0x908cb0/0x8fa9b0 ([+0x238]/[+0x23c] → 0x8facd0/0x8faae0), else → 0; surfaceField's own [ebx+4] gate @0x90a899, B null → return 0.0f) — B carries uid fields +0x1d4/+0x220/+0x268 (C37) ⇒ **B = the biome/uid instance; 0x909da0 = its fetch**; the 0x90b680 param layout {+0x270/+0x274 bases, +0x278/+0x280 linear, +0x288 mode, +0x290 freq, +0x298/+0x29c amps} lives on BOTH uid (defaults, paths 1–2) and tile objects (overrides, path 3). **0x908f40 passes (x + 0.5, y + 0.5)** — `addsd [0x11dfdd8]` ×2 @0x908f7e/0x908f86 then the xmm1→xmm2 / xmm2→xmm3 swap — 0x11dfdd8 = f64 0.5 byte-read = **cell centers** (the classifier 0x8f5030 afterwards gets `(int)` of the UNSAVED local_2c/local_24); also C40's case-1 first factor ✓. **Caller-side combine slots (byte-read @0x90aac7..0x90ab43):** args ecx = [ebp−0x30] (A), xmm2 = [ebp−0x44] (X), xmm3 = [ebp−0x3c] (Y), push ebx (B) → r; **r′ = r·[ebp+0x8]** mulss @0x90aae8 → **store-back @0x90aafe = slab 0x50a2fe ✓C37** ("field slot := r′"); `comiss r′,[0x11dfaac]=0.51; jbe 0x90ab48` @0x90aaf7; `[B+0x268]==0 → skip` ucomiss/lahf/test/jnp @0x90ab05..14; **gradW = (r′ − 0.5)·2.0** subss [0x11dfa94] + mulss [0x11dfe68] → [ebp−0x18] @0x90ab1e..34 ✓C37; `call 0x90b110`; **per → [ebp−0x8]** @0x90ab43 ✓C37; `comiss r′,[0x11dfb84]=0.85; jbe 0x90b0a2` @0x90ab48 ✓C77. surfaceField prologue: ebx := B (null → 0.0f), [ebp+0x8] := 1.0f accumulator init @0x90a8ac, [ebp−0x8] := 0.0f. Source: ABOUT_MATH §6 (105).

| C85 | **The kind-0 chain closed: surfaceField's return = classify's `v`; A = [driver+0x70]; FUN_00792580 = GridWorld world-creation (`gridworld_world_creation.cpp`) + its three 0x908f40 sites (center classify / grass probes / tree placement) (entry (106))** | Lanes: `mapgen/extractions/fulltext86.asm (X1)` (cached whole-exe AT&T disasm, true VAs — C57 scope: 0x7930d3 ∈ lower .text, NOT in text.bin) + text.bin (`f[0x400c00:0xdd0000]`, adjust-vma 0x801800) for 0x908f96..0x908fe0; rdata file = VA − 0x400E00, byte-reads this session: **0x11a46b0 = `d:\...\source\grid\gridworld_world_creation.cpp`**, **0x11a4794 = `data->array2d->IsValid( x, y )`** (line 1001), **0x11a47f4 = `grass[i]->tree_material_id > 0`** (line 1089), 0x1150f60 = `Assert failed: (%s) in %s at line %d\n`. **v wire:** `call 0x90a860` @0x908f96 → **`movaps xmm3, xmm0` @0x908fa6 = surfaceField's f32 return → classify 0x8f5030's v** (C75's xmm3 arg — now SOURCED; Ghidra's dump drops it ⇒ statement-only appearance) → classify inputs: this = ecx = **[B+0x2a4] = mBiomeMaterials** (C74 ✓ = the port's `table`), x = `cvttsd2si [ebp−0x28]` pushed @0x908faf, y = `cvttsd2si [ebp−0x20]` pushed @0x908fa9 — the UNSAVED entry locals (pre-+0.5) ⇒ classify sees cell INTS, surfaceField saw the centers; `ret $8` ⇒ 0x908f40 returns the record. **A provenance:** `mov 0x70(%ebx), %ecx` before ALL 3 sites (**0x7930b9 / 0x7938c2 / 0x7938ef**), ecx untouched → each `call 0x908f40` ⇒ **A = [driver-obj+0x70]** (fixes (105)(a)). **Driver-obj (ebx) map read:** +0x20/+0x24 int origins · **+0x30 = `data->array2d`** (dword grid, index `(y<<9)|x` via `shl $9; or` @0x7930a3..a8, 512 stride; `cmpl $0` cell; ≠0 → 0x793df2 target unread — classify runs when dword == 0; the whole check skipped when **+0x78 byte ≠ 0** @0x79309a) · +0x50 flag · **+0x34 := 0x200, +0x38 := 0x200, +0x3c := 0x40000** (=512·512; last written only if ≠) @0x79360b..0x79361b when `record[+0x38]==3 ∧ [+0x50]==0` · **+0x70 = A** · +0x74 = 0x7412c0 arg1. **Site 1 @0x7930d3 (center classify):** line-1001 assert block 0x793001..0x79308e (crash idiom `movl $0x1ca9,(%eax)` @0x793094) → +0x78 gate → array2d gate → coords f64 = (origin+edi, origin+edx) cvtdq2pd → record → **[esp+0x54] @0x7930d8; non-null → 0x7935f4** (`cmpl $0x3,0x38(%eax)`; ≠3 → 0x79369a). **Grass loop** (header 0x7937b4: arr **[esp+0xb4]**, index edi, count [esp+0x6c]; back-edge `inc; cmp; jb 0x7937b4` @0x793924, exit `jmp 0x793a65`; head `cmpl $0,0xd4(%eax); jg 0x79389a` else line-1089 assert ⇒ **obj[+0xd4] = tree_material_id**): **obj[+0xa8] byte gate @0x7938a4** (0 → skip probes to 0x793907) → **probe classify (x−1, y) @0x7938d1** (`dec` @0x7938b8) → **(x+1, y) @0x7938fe** (`inc` @0x7938e5), y = originY+[esp+0x2c] both — **either NULL → next item (je 0x793924)** → 0x793907: `test obj[+0xd8]; js 0x793938` else `cmp obj[+0xd8] vs [esp+0x54]→[+0x30]; je 0x793938` → **handler 0x793938** = `push obj[+0xd4]; push originY+yterm−1 (dec @0x793943); push originX+xterm ([esp+0x38] = orig 0x30 after 2 pushes); push [ebx+0x74]; call 0x7412c0` ⇒ **tree placement at (x, y−1)**, return → [esp+0x3c]; 0x7412c0 body unread. **Slot reuse (flow-dependent, untraced):** [esp+0x54] = record @0x7930d8 / **zeroed @0x793445** ([esp+0x30]:=0, [esp+0x2c]:=−1 after container clear @0x79343d) / **incl as counter @0x7935b2** — which value reaches the id-check @0x79391b = open; [esp+0x2c]/[esp+0x30] = saved y/x terms (writes 0x792f83/0x792fa6 ahead of site 1; also 0x793315/0x79332b/0x793455/0x7935eb; init 0x7925c8/0x7925d2). Source: ABOUT_MATH §6 (106).

| C86 | **FUN_00792580 cell-loop skeleton: the (y−1) row-offset law, both record branches, empty-grid bail = epilogue, post-loop `A->0x909370(rect, out)`, per-cell grass→band order (entry (107))** | Lane: `mapgen/extractions/fulltext86.asm (X1)` (true VAs; driver ∈ lower .text, all windows on disk this session). **Loop:** y:=0 → [esp+0x2c] @0x792f81-83; h≤0 → exit 0x793338 @0x792f8a; **[esp+0x40] := −512 (0xfffffe00) @0x792f90**; y-head 0x792f98 zeroes band indices **[esp+0x78]/[esp+0x68]** and x → **[esp+0x30]** @0x792f9e-0x792fa6; bounds `x < [ebx+0x28]` (jl 0x792fb3 @0x79331c), `y < [ebx+0x2c]` (jl 0x792f98 @0x793332) ⇒ **[ebx+0x20..0x2c] = {originX, originY, width, height}**; row-end **[esp+0x40] += 512 @0x793322** ⇒ **[esp+0x40] = (y−1)·512 in row y** ⇒ both rowOffset gates read **cell(x, y−1) = the cell ABOVE**: NULL-path `cmpl $0; je 0x793314` @0x7930f0-0x7930ff (empty→next), post-create `cmpl $0; jne 0x793314` @0x793706-0x79371c (occupied→next), each preceded by the y≤0 guard (`mov 0x2c(%esp),%edx; test; jle 0x793314` @0x7930e4-0x7930ea / same @0x7936fa-0x793700) ⇒ row 0 never reads (x,−1); the post-create gate = "tree target cell empty" (the cell the handler writes y−1). Continue labels 0x79330c (reload x) / 0x793310 (reload y) / 0x793314 (x++ → [esp+0x30] @0x793315) — reloads because phase loops clobber edi/edx. **512 guard:** `cmp $0x1ff,%edi; ja 0x792fc7` (x>511) then `cmp $0x1ff,%edx; jbe 0x79309a` (y≤511 → bypass) ⇒ out-of-512 → assert machinery @0x792fc7 (0x3e9 / 0x11a46b0 / 0x11a4794 `data->array2d->IsValid( x, y )` / 0x1150f60 → check → 0x79309a or crash @0x793094). **Bail:** [ebx+0x78] byte == 0 → `cmpl $0, cell[(y<<9)|x]; jne 0x793df2` — **0x793df2 = function epilogue** (free frame[+0xe8], frame[+0xb4] grass vector, frame[+0x9c] via [0x114a348]; SEH; pops; ret) ⇒ pre-occupied cell ⇒ early return (loop visits each cell once ⇒ precondition guard). **≠3 branch (0x79369a):** `call 0x740f80` pushes ($0, record, originY+y, originX+x, [ebx+0x74]) with **ecx = frame[+0x80]** (y addend `add 0x34(%esp)` w/ 2 pushes = frame[+0x2c]; arg split unread) → NULL → `je 0x793310`; else **cell[(y<<9)|x] := obj @0x7936d4** (base = `*(…)` from [ebx+0x30] ⇒ cells = pointers) → `vtable[1]` (`call *0x4(%eax)` @0x7936dd): ==2 → skip; else `vtable[15]` (`call *0x3c(%eax)` @0x7936f7) args **(frame[+0x7c], 10000)** → y≤0 guard → above-cell gate → band scan → guards → **grass → band → next cell**. **==3 branch (0x7935f4):** sole entry = site-1 `jne` (preceding region ends `jmp 0x793cb2` @0x7935ef ⇒ no fall-through; eax = record); [ebx+0x50]==0 → dims **[ebx+0x34/0x38]:=0x200**, cells **[ebx+0x3c]:=0x40000** (@0x79361b if ≠), free [ebx+0x4c] if cap≠0x40000 (@0x79362b), **malloc 0x100000 = 0x40000×4 B** + [ebx+0x50]:=0x40000, memset0 @0x793665; join `mov 0x60(%esp),%eax` @0x79366a has 3 pushes pending ⇒ = frame[+0x54] = record (NOT the early [esp+0x60] @0x792607/0x79299f) ⇒ **edi := record[+0x30] on all paths** → `0x949e80(&ebx[+0x4c], [ebx+0x34]·y+x)` → **idGrid := record[+0x30]** @0x793689, **driver[+0x54] := record[+0x30]** @0x79368b-92 → jmp 0x79330c. ⇒ TWO 512² grids (pointer grid + own 1 MB id grid). **Exit 0x793338:** pushes (&ebx[+0x98], originY+h−1, originX+w−1, originY, originX), ecx := [ebx+0x70] = A → `call 0x909370` ⇒ **A->0x909370(A, x0, y0, x1, y1, &driver[+0x98])**; then global vtable `[*0x1344b90]+0x6c` @0x79335d-0x79336a; post-loop 0x793360..0x7935f0 unread. **Phase order:** band scan frame[+0x9c] ({f0,f1} 8-byte; `while absX>f0 && f1≠0`; idx [esp+0x78] @0x793765, count = (frame[+0xa0]−frame[+0x9c])>>3 → [esp+0x4c]) → guards (grass vector empty / 0<x<[esp+0x38]obj[+0x28]−1 → 0x793a71) → **grass loop 0x7937b4** (back-edge 0x793924, exit jmp 0x793a65) → **band phase 0x793a65**: idx≥count → 0x793310; band[idx].f1==0 → `je 0x79330c`; else body 0x793a8e+ (exit `jmp 0x793314` @0x793c65); no [esp+0x78] write between store/reload (only 0x792f9e/0x793765) ⇒ band resumes the found index. **[esp+0x54] at grass id-check 0x79391b = the record** (≠3 chain 0x7930d8→0x7935f4→0x79369a→grass has no write; zero @0x793445 / incl @0x7935b2 are post-loop; next writes @0x793b4c/0x793b93 after) ⇒ `grass[+0xd8] vs record[+0x30]` = live id compare. Source: ABOUT_MATH §6 (107).

| C87 | **Tree handler + band body semantics: the 0x7412c0 call contract, cell(x,y−1) write-back, exact-column key + byte-verified 33% MSVC-rand dice shared with the NULL path, region-object identity gate, driver[+0x80] placement list, deterministic-vs-dice erase; frame map settled [esp+0x38] = driver / [esp+0x5c] = cell byte-offset / [esp+0x64] = region object / [esp+0x80] = handler this (entry (108))** | Lane: `mapgen/extractions/fulltext86.asm (X1)` (true VAs; driver ∈ lower .text; every window re-read on disk this session); rdata file = VA − 0x400E00, byte-reads this session: **0x11dfa10 = f32 0.33 (c3f5a83e)**, **0x11e04bc = f32 32767.0**, **0x11df874 = f32 0.0** (dice constants, both LCG sites), **0x1190a78 = the line-1109 assert expr** (0x455; file 0x11a46b0, format 0x1150f60). **Frame map:** [esp+0x38] = **driver** (`mov %ecx,%ebx` @0x7925c0 → store @0x7925c2; reload → ebx @0x793761) ⇒ the edge guard = `x < driver.width−1`; report restores ebx := frame[+0x38] (1 push pending) / edi := frame[+0x3c] @0x793883-8a and @0x793a2f-36 ✓; [esp+0x2c]/[esp+0x30] = 0-based y/x counters (stores @0x792f83/0x792fa6, inc @0x79332a/0x793314, bounds driver[+0x28]/[+0x2c] @0x793319/0x79332f ⇒ absolutes inline: originY+(y−1) @0x793950, originX+x @0x79395d); **[esp+0x5c] = cell(x,y−1) byte offset** (`or; shl $0x2; mov %ecx,0x5c(%esp)` @0x793709-14, gate `cmpl $0,(%eax,%ecx,1)` @0x793718 = the byte-offset spelling of the raw-index ×4 read @0x7930fb ⇒ (107)'s both-gates law ✓; absY reuse @0x793bbb); **[esp+0x64] = region object** (setup `call 0x909da0` @0x792d69 → store @0x792d6e, `[eax+0x2a4]` = mBiomeMaterials @0x792d7c; band gate `cmp 0x64(%esp),%eax` @0x793bdd); [esp+0x68]/[esp+0x78] = band A/B idx (inits @0x792fa2/0x792f9e, `incl 0x68(%esp)` @0x793308); **[esp+0x80] = handler this** (`mov 0x84(%esp),%ecx` @0x793952, 1 push pending); loop exit @0x793338 = originY + `&driver[+0x98]`. **Record site:** ecx := driver[+0x70] @0x7930b9, absY → xmm2 / absX → xmm1 (cvtdq2pd @0x7930be-0cf; xmm0 = stale absX int bits — convention open), `call 0x908f40` @0x7930d3 → record → [esp+0x54] @0x7930d8. **Gate polarities are duals:** NULL path needs cell-above OCCUPIED (`je 0x793314` @0x7930ff, y≤0 guard @0x7930e4-0ea) → band scan 0x793105; ≠3 chain needs it EMPTY (`jne 0x793314` @0x79371c, y≤0 guard @0x7936fa-700) → band scan/grass = the tree target; row 0 never dereferences (x,−1). **≠3 extras:** cell write `mov %eax,(%ecx,%edx,4)` with edx = (y<<9)|x @0x7936d0-6d4; vtable[1] @0x7936dd → **==2 ⇒ skip vfunc[15]** (`je 0x7936fa`) else vfunc[15](obj, frame[+0x7c], 10000) @0x7936e5-6f7. **Handler 0x793938-0x79396f (byte-exact):** id gate — `je 0x793924` @0x793905 (gate fail → next item), id = grass[i][+0xd8] @0x793911, `js 0x793938` (id<0 → place), `cmp record[+0x30]; je 0x793938` (id == record id → place); pushes: grass[i][+0xd4] @0x793947, originY+(y−1) (`dec` @0x793943 live via `add %ecx,%eax` @0x793950) @0x793959, originX+x (2 pushes ⇒ frame[+0x30]) @0x793961, driver[+0x74] @0x793962, ecx = frame[+0x80]; **no esp fixup ⇒ callee-cleaned (ret 0x10)** ⇒ `0x7412c0(this, driver[+0x74], absX, originY+(y−1), material)`; return → edi → frame[+0x3c] @0x79396a-6c (**corrects (106)**'s `mov %eax,0x5c(%esp)` quote); NULL return → assert 1109 (expr 0x1190a78, crash @0x793a40) → vfunc[15](return, frame[+0x7c], 10000) @0x793a46-56 → **cell(x,y−1) := return** @0x793a59-62 (`*(driver[+0x30])` buffer + frame[+0x5c] byte offset, `mov %edi,(%ecx,%eax,1)`) → band phase @0x793a65 ⇒ one placement per cell (the placement path skips the grass back-edge 0x793924). **Band body 0x793a80-0x793c65:** `band.f0 == absX` exact column (else 0x793c61) ∧ `absY < [band+0xc8]` ∧ dice if `[band+0x20]` ≠ 0 — LCG in esi (`imul $0x343fd; add $0x269ec3; sar $0x10; and $0x7fff` @0x793abb-0c9) → /32767.0 + 0.0 → `comiss 0.33 → jbe reject`; **the NULL path dices identically @0x793182-0x7931ba** (same three rdata loads @0x793188/0x7931a7/0x7931af) after its key `bandA.f0 == absX` @0x793163 ∧ `f1 ≠ 0` @0x793177; accept → `mov 0x90(%ebx),%ecx` + `0x2aaaaaab` ÷6 magic @0x7931c0-c6 (stride-6 container, unread); band path: vtable[0x64] (idx 25) on cell obj [esp+0x44] → `je 0x79330c`; id gate `[band+0xd8] ≥ 0` must equal `frame[+0x54]→[+0x30]`; flag byte [esp+0x37] := 1; scan @0x793b50 while i < `[band+0xc4]`, rows y−1, y−3… (rowBase [esp+0x54] −= 0x400, i −= 2): x<0 → advance, `0x93d710(x,row)` false → advance, true → cell == 0 else flag := 0; join @0x793ba6: flag==0 → 0x793c61; `A->0x909da0(absX,absY)` == frame[+0x64] else next cell; **{absX, absY, band} → driver[+0x80]** via `call 0x93edb0`; `[band+0x20] ≠ 0` → keep, `== 0` → **erase band[idx] from frame[+0x9c]** (shift-left @0x793c40-50, end −= 8) = one-shot; exit `jmp 0x793314` @0x793c65. **esi = RNG state:** `call 0x9d89d0` @0x7926c4 (this = &frame[+0x120], arg = &driver[+0x24] = &originY) gated by `je 0x7927c2` (skip-path source open); reports clobber esi fail-only ⇒ state intact to both LCG sites; post-loop `esi := −1` @0x793442 + frame[+0x2c] reuse @0x793455 (unread phase). **NULL accept** @0x793300-308: f1[k]/f0[k+1]-shaped pair write + `incl 0x68(%esp)` (element semantics open). Source: ABOUT_MATH §6 (108).

| C88 | **NULL path = ceiling-plant insertion; pair-array fill dispatch; guard/band-phase entry states (entry (109))** | Lane: `mapgen/extractions/fulltext86.asm (X1)` (true VAs; every window re-read on disk this session); rdata file = VA − 0x400E00, byte-read this session: **0x11a47b4 = `ceiling_plants_i < (int)data->ceiling_plants_to_insert.size()`** (line 1028 / 0x404), **0x1190a78 = `cell`** (line 1109 expr ⇒ 0x7412c0 returns a cell object). **NULL path 0x793105..0x793314:** idx = **`ceiling_plants_i`** = frame[+0x68], count = frame[+0x48]; scan @0x793120 continues while **`absX > f0 ∧ f1 ≠ 0`** (`cmp (%edi,%ecx,8),%eax` = absX−f0; `jle` stop) → idx saved @0x79313b; **`y ≥ driver[+0x2c]−2` → next cell** @0x79313f-47 (height ✓); idx ≥ count → next cell @0x79314d; exact key `f0 == absX` @0x793163 ∧ `f1 ≠ 0` @0x793170; dice (identical LCG + same three rdata floats) @0x793182-0x7931ba; assert 1028 count = `(driver[+0x90] − driver[+0x8c]) / 12` (`0x2aaaaaab`+`sar $1` = ÷12, n=12→1) vs frame[+0x68] @0x7931cb-e0, fail-only report (ebx restore = frame[+0x38] driver @0x79329e); region gate `A->0x909da0(absX,absY)` (absY stashed → frame[+0x4c] @0x7932c2) == **frame[+0x64]** @0x7932db else `incl frame[+0x68]` + next cell; **accept write @0x7932f3-793304**: `data->ceiling_plants_to_insert[i] := {absX, absY, bandA[i].f1}` stride 12 (base driver[+0x8c], edx = f1 @0x7932ec, absY @0x7932fc) → `incl frame[+0x68]` ⇒ **frame[+0xe8] = the ceiling-plant candidate array {f0 = exact world col, f1 = def}** (replaces (107)'s "band A" label); **driver[+0x8c]/[+0x90] = ceiling_plants_to_insert begin/end** (vector<{int,int,int}>). **≠3 scan re-verified 0x793722-765:** count = `(frame[+0xa0]−frame[+0x9c])>>3` → frame[+0x4c]; scan rule identical (`absX > f0 ∧ f1 ≠ 0` ⇒ (107)'s prose ✓); **`ebx := frame[+0x38]` restore @0x793761**; idx → frame[+0x78] @0x793765. **Guards @0x793769-0x7937ae:** empty grass → 0x793a71; `x ≤ 0` → 0x793a71; **`x ≥ driver[+0x28] − 1` → 0x793a71** ⇒ `driver[+0x28] = width` definitive ⇒ `0 < x < width−1` ✓; grass init i=0 (edi), frame[+0x3c] := 0, count = `(end−begin)>>2` → frame[+0x6c], ==0 → 0x793a6d. **Band-phase entry 0x793a65-0x793a8a = three compensated states:** 0x793a65 (grass exit) reloads idx+count; 0x793a6d (grass empty) reloads x only (edi was zeroed); 0x793a71 (guard fails) compares live edx/ecx; then `idx ≥ count → 0x793310`, `frame[+0x3c] := bandB[idx].f1` @0x793a84, `f1==0 → 0x79330c`. **Fill loop 0x792e80-0x792eda:** source = 16-byte `{double x, Object*}` (double at −8(%edi)); 3-way dispatch by object bytes: **[obj+7]≠0 → frame[+0xe8]** (ceiling; int → frame[+0x6c], ptr → frame[+0x70]), **[obj+6]≠0 → grass** `0x9ef4e0(&frame[+0xb4], elem)`, **else → frame[+0x9c]** (int → frame[+0x4c], ptr → frame[+0x50]); pair = `{int key, void* obj}` 8 B via `0x93ef50(this = &vector, &pair)` = push_back-like (bodies open). **Post-fill:** `0x9ef570(&frame[+0x9c], f64 frame[+0x5c], frame[+0xcc])` @0x792ef0; `0xa735a0(begin, count>>3, false)` on band B @0x792f1e AND on a **third stack vector frame[+0xf0]/[+0xf4]** @0x792f46 (8-byte elements); temp frame[+0xcc] freed @0x792f6d. **frame[+0x48] = the driver at setup** (`lea 0x8c(%ebx)` @0x792f56 → `0x93ee40(&ceiling_plants_to_insert, driver)` @0x792f5c) — slot later reused as the ceiling count (writer open). **`driver[+0x70]` (A) == 0 → `je 0x793338` @0x792f77 skips the whole cell loop.** Stack vectors confirmed: frame[+0xe8] init @0x792a7d / dtor-read @0x793df2; frame[+0x9c] init @0x792a30-3b / dtor-read @0x793e1a. Source: ABOUT_MATH §6 (109).

| C89 | **Post-loop margin region 0x793338..0x793e4e: (8,8)-margin scan + 3×3 type-neighborhood comparator + type-item placement; function range; dtor chain; `driver[+0x18]` = elapsed (entry (110); corrects (109)'s "third vector")** | Lane: `mapgen/extractions/fulltext86.asm (X1)` (true VAs, re-read on disk this session); strings byte-read: `0x11a4814` = **`data->array2d->IsValid( x + x0, y + y0 )`** (assert line 0x4b6 = 1206), `0x117a518` = **`invalid vector<T> subscript`** (the 0x793e4f abort). **Range**: FUN_00792580 = 0x792580..0x793e5e (`ret` @0x793e4e; next fn @0x793e60). **Loop exit** ((106) byte-exact): `A->0x909370(originX, originY, originX+w−1, originY+h−1, &driver[+0x98])` @0x793338-0x793358; singleton callback `ecx=&0x1344b90; call *[(*0x1344b90)+0x6c]` @0x79335d-6a and @0x793d81-8e (x87 double: start spilled → frame[+0xcc] @0x793377 (2 pending); now − start → **`fstpl 0x18(%ebx)` = `driver[+0x18]` = elapsed** @0x793dac); `driver[+0x70]==0 → je 0x793338` skips the cell loop. **Margin scan** x∈[8,w−8), y∈[8,h−8): y=8→frame[+0x48] @0x7933ad (guard `h−8≤8→0x793d81`), x=8→frame[+0x40] @0x7933ca (guard `w−8≤8→0x793d6e`), row `y<<9`→frame[+0x7c] @0x7933db, cell→frame[+0x3c] (null→0x793d4f), **vfunc[12]** @0x7933fa → **`0x742940(frame[+0x80], type)` → frame[+0x4c] = std::vector<T> of 32 B** (begin/end `[0]`/`[4]`, size `>>5`, checked-subscript abort ✓; null→0x793d4f); x++ @0x793d56 (`< w−8 → 0x7933e0`), y++ @0x793d71 (`< h−8 → 0x7933c0`). **3×3 grids**: obj1 = frame[+0x100], obj2 = frame[+0x120], ctor `0x92e980(&obj,3,3)` @0x793370-96, reset `0x92ea40(&obj,&false)` @0x793427/0x79343d per cell; layout `[+0]`=stride (index math @0x7935b6/0x7935cc/0x793c82), `[+4]`=ctor arg2 (`&obj[+4]` → 0x770aa0), `[+0x18]`=**grid heap ptr** (frame[+0x118]/[+0x138]; freed @0x793dd9/@0x793daf via IAT 0x114a358, zeroed @0x793dbc/dc7). **Comparator**: dy = esi home frame[+0x2c] (init −1 @0x793442-55), dx = ebx (init −1 @0x793464), equal→frame[+0x54] (0 @0x793445), marks→frame[+0x30] (0 @0x79344d); neighbor = `((y+dy)<<9)|(x+dx)` (row frame[+0x5c] @0x793472, x+dx @0x793480-84, read @0x793565-7a); **assert 1206 entry** = `x+dx>511 (ja 0x79349a @0x79348c) ∧ y+dy>511 (jbe 0x793565 @0x793494)` → report @0x79349a-0x79355f (line 0x4b6, expr 0x11a4814, file 0x11a46b0, func 0x1150f60; esi restore @0x793552 = frame[+0x2c], 1 pending ✓); null neighbor → 0x793cae (`eax := frame[+0x30]` — NOT 0x40, correcting an interim misread); **vfunc[12] equal** (center @0x79358b / neighbor @0x793594) → **grid1[(dy+1)·stride + 1 + dx] := 1** (`0x94a9d0(&frame[+0x118],…)` + `movb $1,(%eax)` @0x7935a3-c9) + frame[+0x54]++ @0x7935b2 + frame[+0x30]++ @0x7935e6; **unequal** → `0x7706c0(center, neighbor)` (body open) → true → **grid2[same idx]** @0x793c7f-9a (stride frame[+0x120]) + frame[+0x30]++ @0x793c9d; control: dx++≤1→0x793480 @0x793cba-be, dy++ (frame[+0x2c])≤1→0x793460 @0x793cc4-ccc, **`frame[+0x54] ≥ 8 → 0x793d4f`** (all same type → skip) @0x793cd2, **`ebx := frame[+0x38]` (driver) restore @0x793cd7**. **Placement loop**: count `(end−begin)>>5` @0x793cdd-ea (==0→0x793d4f), frame[+0x64]:=0 @0x793cf1, head `count ≤ idx → 0x793e4f` = abort, item = `begin + frame[+0x64]` @0x793cfd → **`0x770aa0(array2d (ecx), x, y, center, originX, originY, &obj1[+4], frame[+0x54], &obj2[+4], frame[+0x30])`** @0x793d01-28 (9 pushes = `add $0x24` ✓; frame[+0x54] via 2 pending = `0x5c−8` ✓; first push = eax = frame[+0x30], loaded on all four paths) → `esi++` @0x793d31, **`frame[+0x64] += 0x20`** @0x793d32, size recheck + `eax := frame[+0x30]` @0x793d44, `jb 0x793cf5` @0x793d4d / fall 0x793d4f. **Dtor chain** (states 0xb→0xa→8): free obj2 grid @0x793daf → zero frame[+0x138]/[+0x13c] → free obj1 grid @0x793dd9 → `0x7924c0(ecx)` @0x793de0 (open) → **`driver[+0xc8] := 1`** (`lea 0xc8(%ebx); mov $1,%ecx; xchg %ecx,(%eax)`) @0x793de5-f0 → `ebx := IAT free 0x114a348` @0x793df9 → **free frame[+0xe8] @0x793e04, frame[+0xb4] (grass) @0x793e15, frame[+0x9c] (band B) @0x793e26** → SEH/cookie/`ret` @0x793e4e (exactly three stack vectors). **CORRECTION of (109)**: the alleged "third vector frame[+0xf0]/[+0xf4]" — esp slip: @0x792f23/0x792f2c have 2 pushes pending ⇒ `frame[+0xec]`/`frame[+0xe8]` = the **ceiling vector's {end, begin}**; the 2nd `0xa735a0` runs on the ceiling vector; the bool slot = frame[+0x4c] (@0x792f11 0 pending / @0x792f35 2 pending). **frame[+0x48] writer FOUND** @0x792f42 (`mov %eax,0x58(%esp)` with **4 pending** ⇒ frame[+0x48] := ceiling count `(end−begin)>>3`); `0x93ee40(&driver[+0x8c], count)` @0x792f52-5c (body open). Source: ABOUT_MATH §6 (110).

| C90 | **Setup/fill-source region 0x792580..0x792f76 byte-exact: frame convention, skip gate + the 6-string key, seed formula, the two IDENTICAL 0x909da0 env samples, 0x8f5760 = the fill-source builder, dispatch → shuffle → sort → resize, `frame[+0x48]` = V3.count (entry (111); confirms (110)'s two corrections of (109))** | Lane: `mapgen/extractions/fulltext86.asm (X1)` (true VAs) + window `mapgen/extractions/dig111-setup.asm (X13)` (0x792503..0x792eff) + `mapgen/extractions/dig111-biome.asm (X14)` (0x8f5760/0x8f5d20 bodies); rdata file = VA − 0x400E00, byte-read this session: **0x11a4738 = `.png_petri`**, **0x11a4744 = `??SAV/world/world_`** (raw `3f 3f 53 41 56…`, begins 12 B after 0x11a4738's terminator), **0x11885fc = `_`**, **0x1168a04 = `data`** (assert line 0x38f = 911), **0x11a4758 = `data->grid_world`** (0x39c = 924), **0x11a476c = `seed > 0`** (0x3ab = 939), **0x11a4778 = `data->procedural_terrain`** (0x3b8 = 952), **0x11dfe30 = f64 1.0**, **0x11dfd88 = f64 0.25**, **0x11dfb90 = f64 0.002401** (`mulsd` @0x8f5865 in 0x8f5760), **0x11e0068 = f64 1000.0** (`mulsd` @0x8f58cd/0x8f58df in 0x8f5760, @0x8f5e73/0x8f5e85 in 0x8f5d20 ⇒ quantization `((v·0.002401)·1000 + a + b)·1000` feeding `call 0x1033781`); re-verified **0x11a46b0 full = `d:\projects\nollagames\fallingeverything\build\vc12\..\..\source\grid\gridworld_world_creation.cpp`** (98 B — expands C85's abbreviation), 0x11a4794 (C85 ✓), 0x1150f60, 0x1151070 = `a`, 0x1151074 = `log_asserts.txt`, 0x1151084 = `%d, %d, %d - %d:%d\n`, 0x11dfdd8 = f64 0.5, 0x11df878 = f64 0.0, 0x11e0220 = f64 2147483647.0. **Frame convention (prologue 0x792580-0x7925ba):** `push %ebp; mov %esp,%ebp; and $-64,%esp` → SEH `push $-1` @0x792586 → handler `push $0x107dfb8` → `%fs:0` → `sub $0x168` = S @0x792594 → /GS cookie `mov %eax,0x130(%esp)` @0x7925a1 (esp = S) → ebx/esi/edi → cookie `push %eax` @0x7925b2 ⇒ **E = S − 16 = A − 0x184; frame[+0xNN] = E+0xNN** (only transient call-arg pushes subtract, 4 each); fs registration `lea 0x178(%esp)` @0x7925b3 ⇒ frame[+0x178] = A−12; **state dword = frame[+0x180] = A−4 = the `push $-1` slot**; /GS cookie = frame[+0x140]. **Key** = `??SAV/world/world_<driver[+0x20]>_<driver[+0x24]>.png_petri` (build @0x7926ba-0x7927af: `0x9d89d0(&frame[+0x120], &driver[+0x24])` → esi, `0x9d89d0(&frame[+0xcc], &driver[+0x20])` → push @0x7926ff; concat `0x443390/0x4433e0/0x444a10/0x4433e0` @0x79270d/0x792736/0x79275b/0x792784; **build mask frame[+0x30] := 1/3/7/0xf/0x1f** @0x7926e0/0x792705/0x79272e/0x792753/0x79277c (pending-adjusted) + **dtor mask frame[+0x2c] := 0x3f** @0x7927a2 AND frame[+0x30] := 0x3f @0x7927a6; state := 0..5 @0x7926cb-0x79278c; query `call *0x24(%eax)` @0x7927af (ecx = the `0x1344b90` singleton, target `0xfe81b0`) → flag byte **frame[+0x37] := 1 @0x7927b9 / := 0 @0x7927c2**); skip gate `0x93e550(&frame[+0x5c], &driver[+0x58])` @0x7926a7 (ret 8) → `mov (%eax),%eax; cmp 0x132aed8,%eax; je 0x7927c2` @0x7926ac-b4 = **global-sentinel match → skip the build**. Dtor cascade @0x7927c7-0x792944 destroys the 6 build strings in REVERSE order, bit → slot: 0x20 → frame[+0x100] (`_Myres` @+0x114), 0x10 → [+0xe8] (+0xfc), 0x08 → [+0xb4] (+0xc8), 0x04 → [+0x9c] (+0xb0), 0x02 → [+0xcc] (+0xe0), 0x01 → [+0x120] (+0x134); MSVC std::string = `{_Bx 16 B, _Mysize +0x10, _Myres +0x14}`, heap iff `_Myres ≥ 0x10`, SSO reset `_Myres := 0xf, _Mysize := 0, byte0 := 0`; **state := −1 (`movl $0xffffffff,0x180(%esp)`) @0x792920**; flag frame[+0x37] ≠ 0 → early exit `call 0x797d10; call 0x7924c0; driver[+0xc8] := 1; jmp 0x793e2b` @0x792945-0x792967. **Seed** = `((oy+2)·ox·(ox−3)·oy) + 1.0` @0x792abd-0x792af9 → `ja 0x792bd9` iff > 0 (assert 0x3ab = 939 `seed > 0`, time64 → frame[+0x6c] @0x792b3a / frame[+0x70] @0x792b42) → scale loop ÷2 while ≥ 2147483647.0, **max 10000 iterations (`cmp $0x2710`)** @0x792bd9-0x792c13 (frame[+0x54] := 0.5 @0x792bef, frame[+0x5c] := scaled @0x792c09) → **`esi = cvttsd2si ^ 0xc`** @0x792c0f-0x792c13; procedural gate `cmpl $0,0x70(%ebx); jne 0x792ce2` @0x792c16 (assert 0x3b8 = 952). V inits: V1 frame[+0x9c/a0/a4] := 0 + **state 6** @0x792a30-0x792a51; V2 [+0xb4/b8/bc] := 0 @0x792a5c-0x792a79 (**no state store — state 7 never written**); V3 [+0xe8/ec/f0] := 0 + **state 8** @0x792a7d-0x792a9e; V0 [+0xcc/d0/d4] + frame[+0x44] := 0 + **state 9** @0x792ce2-0x792d05 (ebx cross-check `mov 0x38(%esp),%eax` @0x792d01); grid_world vcalls → **frame[+0x80]** (vfunc+0x58) @0x792ab1 / **frame[+0x7c]** (vfunc+0x10) @0x792ac0. **Both 0x909da0 env samples byte-IDENTICAL** (sample 1 @0x792d0d-0x792d69, sample 2 @0x792dd6-0x792e27): ecx = A = driver[+0x70], **xmm1 = driver[+0x20] + 0.5·driver[+0x28], xmm2 = driver[+0x24] + 0.25·driver[+0x28]** — both offsets from **+0x28 = width, NOT height** (slots frame[+0x54] = 0.5 / frame[+0x84] = 0.25); sample 1 → frame[+0x64] := region @0x792d6e (null → skip 0x8f5760, `jmp 0x792dbf`); sample 2 → read only for `[eax+0x2a4] = mBiomeMaterials` @0x792e30 (null → `je 0x792e64`). **Builders:** `0x8f5760(mBiomeMaterials, &frame[+0xcc] = V0, right-edge f64, xmm2 = A[+0x30], xmm3 = ox)` @0x792daf (ret $0xc) = **the fill-source builder** (V0.end → frame[+0x44] @0x792dbb; V0 = 16-byte `{double @−8, Object* @0}`); `0x8f5d20(mBiomeMaterials, &driver[+0xbc], right-edge f64, A[+0x30], ox)` @0x792e5f (ret $0xc @0x8f5ea5); clear driver[+0xc0] := driver[+0xbc] @0x792dcf, frame[+0x4c] := &driver[+0xbc] @0x792dd2, frame[+0x3c] := A @0x792de1. **Dispatch** @0x792e64-0x792edc (0 pending throughout): count = `(frame[+0x44] − frame[+0xcc])>>4`, edi := V0.begin + 8, stride `add $0x10`; `[obj+7] ≠ 0` → ceiling: `cvttsd2si → frame[+0x6c]`, cfg → **frame[+0x70]**, `lea frame[+0xe8]` → `0x93ef50(&[+0xe8], &[+0x6c])` (8-byte `{int, ptr}` pairs); `[obj+6] ≠ 0` → grass: edx := elem+8, `lea frame[+0xb4]` → `0x9ef4e0(&[+0xb4], edx)` (0 stack args); else → band B: cfg → **frame[+0x50]**, cvttsd2si → frame[+0x4c], `lea frame[+0x9c]` → `0x93ef50`; **shuffle** `0x9ef570(ecx = &frame[+0x9c], xmm1 = f64 frame[+0x5c] = scaled seed)` @0x792ef0 with edi := frame[+0xcc] @0x792edc (0 pending — the pointer later freed); **sort 1** edx := frame[+0xa0] (V1.end) @0x792f03, ecx := frame[+0x9c] (V1.begin) @0x792f0a, frame[+0x4c] := 0 (pred) @0x792f11 (0 pending), push pred + `sar $3` push → `0xa735a0` @0x792f1e (**no stack cleanup ⇒ 2 pushes stay pending**); **sort 2**: edx := `0xf4(%esp)` (2 pend → **frame[+0xec] = V3.end**) @0x792f23, ecx := `0xf0(%esp)` (**frame[+0xe8] = V3.begin**) @0x792f2c, `eax = edx − ecx` @0x792f33, frame[+0x4c] := 0 @0x792f35 (2 pend → E+0x4c), push + `sar $3` push (4 pend) → **frame[+0x48] := eax = V3.count** `mov %eax,0x58(%esp)` @0x792f42 (4 pend → E+0x48) → `0xa735a0` @0x792f46 → `mov 0x48(%esp),%ebx` @0x792f4b (4 pend → **E+0x38 = driver**) → `add $0x10` (0 pend) → `push 0x48(%esp)` (0 pend → frame[+0x48] = V3.count) → **`0x93ee40(&driver[+0x8c], V3.count)`** @0x792f5c (ret 4) → **state 8** @0x792f61 → free V0 `push %edi; call *[0x114a348]; add $4` @0x792f69-0x792f74 → `cmpl $0,0x70(%ebx); je 0x793338` @0x792f77 (A-null skips the cell loop), frame[+0x2c] := 0 (y) @0x792f81-0x792f83, `driver[+0x2c] ≤ 0 → 0x793338` @0x792f87-0x792f8a. **frame[+0x48] lifecycle:** V3.count @0x792f42 → 0x93ee40 arg @0x792f52 → ceiling-scan bound `cmp 0x48(%esp),%ecx` @0x793109/0x79312d/0x79314d (0 pending) → **margin y := 8** @0x7933ad (`mov $8,%edx` @0x79339b; guards `driver[+0x2c]−8 ≤ 8 → 0x793d81` @0x7933ab-0x7933b3 ∧ `driver[+0x28]−8 ≤ 8 → 0x793d6e` @0x7933c8-0x7933d0) → read @0x793460 → `inc; mov %edx,0x48(%esp)` @0x793d71/0x793d75, back-edge `jl 0x7933c0` @0x793d7b; siblings frame[+0x40] := 8 @0x7933ca (x) + back-edge `jl 0x7933e0` @0x793d64, frame[+0x7c] := y<<9 @0x7933db. **State-byte store list (15, whole-function grep):** 0/1/2/3/4/5 @0x7926cb-0x79278c, −1 @0x792920, 6 @0x792a51, 8 @0x792a9e, 9 @0x792d05, 8 @0x792f61, 0xa @0x79338e (2 pend → E+0x180), 0xb @0x7933a0, 0xa @0x793d97, 8 @0x793db4 — **state 7 absent**. Source: ABOUT_MATH §6 (111). |

| C91 | **`0x8fb350` whiteLattice2d full byte law — the lerp idiom `(A−B)·t+B` ⇒ t=0→B, standard orientation = C83's structure; the PORT inverts all three endpoints (I22); (26)'s twin/FNV labels corrected (entry (112))** | **[UPDATED (113): the I22 defect is FIXED — the port now matches this row's standard orientation; and c0 below = FLOOR not round (C92); the 0.493832439 literal = round-derived ⇒ stale, true floor literal 0.898207068]** Lane: `mapgen/extractions/fulltext86.asm (X1)` (true VAs) windows 0x8fb350..0x8fb567 / 0x8fb789..0x8fb841 + the port's evidence file `mapgen/extractions/case1core.asm (X15)` (slab = true − 0x400800) re-read byte-identical; rdata file = VA − 0x400E00, byte-read this session: **0x11dfbf0 = f32 1.0** (corner arg c0+1, `addss` @0x8fb4d3), **0x11df874 = f32 0.0** (c0+0 @0x8fb50c); re-matched 57.0@0x11e028c, 58.0@0x11e0298, 43758.546875@0x11e04c8, 2.0@0x11dfe68, 3.0@0x11dff70 (C40/C83 ✓). **Weights:** fx = x−floor(x), fy = y−floor(y) via cvttss2si+comiss+jbe/dec @0x8fb38f..3cb; **wx = (3.0−2·fx)·fx² → slot(-0xc)** @0x8fb410/41c/420; **wy = (3.0−2·fy)·fy² → slot(-0x1c)** @0x8fb435/444/448. **c0 = 57.0·round(y)+round(x) → slot(-0x4)** @0x8fb3e9/3fc/417 (round = 0x44d0b0 fld/fistp) **[(113): c0 = 57.0·floor(y)+floor(x); 0x44d0b0 = FLOOR wrapper — C92]**. **Corners = fract(sin(c0+k)):** h58 → slot(-0x8) (arg +58.0 @0x8fb43c, sin 0x44d110 @0x8fb44d, store @0x8fb486); h57 → xmm2 (@0x8fb47e/@0x8fb48b); h1 → slot(-0x14) (arg +1.0 @0x8fb4d3, sin @0x8fb4db, store @0x8fb514); h0 → xmm2 (@0x8fb507..50c/@0x8fb519, floor-fix completes @0x8fb548). **Blend idiom = `(A−B)·t + B` ⇒ t=0 selects B:** y+1 row `(h58−h57)·wx + h57` @0x8fb4b7..4c9 → slot(-0x8); y row `(h1−h0)·wx + h0` @0x8fb548..55a (h1 load @0x8fb53a) → xmm1; out `(rowY1−rowY0)·wy + rowY0` @0x8fb55e..567 ⇒ **out = lerp(lerp(h0,h1,wx), lerp(h57,h58,wx), wy)** = standard orientation, structurally identical to C83's 0x8fb570 (parity weight mix = only difference). Function = 0x8fb350..0x8fb56f (ret @0x8fb56e) = 543 B. **0x8fb570 tail byte-identical:** 0x8fb546..567 ≡ 0x8fb818..839 (pops + floor-fix + row load + the six blend insns, same slots) and 0x8fb4b7..4c9 ≡ 0x8fb789..79b; body 0x8fb570..0x8fb841 = 721 B ✓. **Callers (dig #112): 0x90b00d/0x90aef9/0x90ae25 = the addNoise 1/2/3 lanes, 0x8fd93e = the NOISE_TYPE dispatch** ⇒ all live lanes hit the port. **PORT DEFECT (I22):** `noise-proto.mjs:183` `lerp(a,b,t)=(b−a)·t+a` puts t=0 at the FIRST arg, called (h58,h57)/(h1,h0)/(rowY1,rowY0) ⇒ port(wx,wy) = binary(1−wx,1−wy) on the same c0 — demo `mapgen/extractions/sidebyside-112.mjs (X8)`: port(12.5,−3.25) = 0.833995283 = (26)'s smoke pin vs byte-literal 0.493832439 **[(113): both literals were ROUND-derived; with the FLOOR cell the byte-literal = 0.898207068 and the pre-fix port = 0.833995283 (round+inverted); floor+inverted = 0.723673105 — re-run same script]**; integer (3,5): h58 0.9079 vs h0 0.3719. **Label corrections:** (26)'s "true 0x8fc550" (twin) / "0x8fc940" (FNV24) = 0 hits in fulltext86 (region covered — 136 labels at 8fc4xx/5xx) → slab+0x400800 (C13): **0x8fb950** (slab 0x4fb150; 2× round @0x8fb973/982, 57.0 @0x8fb9e1, 2.0 @0x8fb9f0; only caller 0x8fd966 = dispatch) / **0x8fbb40** (slab 0x4fb340; callers 0x8fd974 + 0x90af1d = the addNoise=2 lane's fnvLattice2d). |
| C92 | **`0x44d0b0` = the CRT FLOOR wrapper (NOT fld/fistp round) — the whole MSVCR120.dll math IAT chain re-read; round→floor overturns C40/C83/C91's c0 gloss (entry (113))** | Lane: PE import-directory walk `mapgen/extractions/verify-floor-113.mjs (X9)` (656 entries, name-records resolved from file bytes, no hardcoded offsets) + thunk/IAT resolver `mapgen/extractions/resolve-wrappers-113.mjs (X7)`, both run against `noita_dev.exe` this session. **Body (55 B, ret @0x44d0e6):** `cvtss2sd @0x44d0b9 → fldl @0x44d0c6 → fstpl @0x44d0ca → call 0x1033a52 @0x44d0cd → fstpl @0x44d0d2 → cvtpd2ps @0x44d0df` — **NO `fistp` anywhere** ⇒ not a round-to-nearest wrapper; the x87 loads/stores are arg marshalling for a f64 ABI call. **Thunk 0x1033a52** = `ff 25 → jmp [0x114a534]`; **IAT slot 0x114a534 name record = MSVCR120.dll `floor`, hint 1646.** **Full thunk run (one thunk per slot, in order, names from the import dir):** 0x1033a1c→0x114a510 `_libm_sse2_acos_precise` · 0x1033a22→514 **`_libm_sse2_cos_precise`** · 518 `_libm_sse2_log10_precise` · 51c `_libm_sse2_pow_precise` · **520 `_libm_sse2_sin_precise`** · 524 `_libm_sse2_sqrt_precise` · 528 `_libm_sse2_tan_precise` · 52c `_setjmp3` · 530 **`ceil`** · **534 `floor`** · 538 `memcpy` · 53c `memset` · 0x114a540 `?terminate`; adjacent slots 0x114a500 `_CIfmod`, 504 `_CxxThrowException`, 508 `__CxxFrameHandler3`, 50c `__RTDynamicCast`. **Survives:** 0x44d110 → `_libm_sse2_sin_precise` @0x114a520 (C40's sin pin ✓); 0x44d0f0 → `_libm_sse2_pow_precise` @0x114a51c. **Corrects:** C40 row + section (c0 gloss), C83 (`rx/ry`, parity), C91 (`c0`), (26)'s IAT list (off-by-one from 0x114a514, 3 slots mis-labelled), (40)'s `0xc33222 → 0x114a514 = acos` (**cos**; the 0xc33xxx are slab VAs, true = +0x400800), and the two "fp-round helper" glosses above. **Consumer impact:** `whiteLattice2d`/`parityLattice2d` c0 = `57·floor(y)+floor(x)` — port re-based dig #113, asm-literal at 5 points (|Δ| ≤ 1.19e-7, `mapgen/extractions/sidebyside-112.mjs (X8)`), floor literal at (12.5,−3.25) = **0.898207068**. Source: ABOUT_MATH §6 (113). |
| C93 | **V2 chunk-census instrument spec — `mapgen/experiments/2026-10-06-v2-chunk-census.mjs` (entry (114))** | **Lane/env:** run `SURFACE_V2=1 node mapgen/experiments/2026-10-06-v2-chunk-census.mjs`; it REFUSES to run without `SURFACE_V2=1` (`:42-45`) because without it every procedural chunk is honest air and the census is vacuous. Seed = `CAPTURE_SEED` 78633191; scope tx 0..70 × canvas ty 0..143 (71×144), smoke scope ty ≤ 96 = the entry (25)/(26) window. **Definitions = verbatim mirror of `noiseChunkMask` (`noise-terrain.mjs:200-246`):** procedural = `biomeAt(world.config, tx, ty − SKY_ROWS)` hit **∧ no `templateFile`** (frame + skip = `:202-204`, so wang/static-template chunks are excluded exactly as the lane excludes them); COMPUTES = `world.noiseAt(tx,ty)` non-null; falls-through = null (the V2 lane SWALLOWS the throw and the caller falls through honestly, `:237-241`); **density = Σmask / 2704** (52×52 cells) = the (26) "solid density" quantity; **textured = 0 < density < 1** (real texture vs all-air/all-solid). **Bucket key = the biome FILENAME, never `name`** — measured this session that hills.xml / solid_wall.xml / empty.xml all carry `name="_EMPTY_"`, so name-keyed rows hide whole biomes. **Fall reasons are DERIVED from the def** (the lane's catch erases the throw): `noise_type ≠ SIN_CAPPED_SIMPLEX` → `noiseDispatch kind -1` (VERIFIED §8 row 30); kind 5 ∧ `mGradientAddNoise ∉ {1,2,3}` → the surfaceField default arm — **LIVE ONLY pre-#113** (I20② ported); else `UNKNOWN` = flagged, 0 observed post-#113. **BASELINE OF RECORD (seed 78633191, HEAD f33f0bd, 2026-10-06):** 2288 procedural · **663 COMPUTES** · 1625 falls (all kind −1) · mean density **0.0183** · all-air 17 · textured 646 · all-solid 0; the pre-#113 A/B (noise-proto ← `f33f0bd~1`) = 658 · 1630 · 0.0185 ⇒ **dig #113's delta = +5 mountain_lake COMPUTES** and threshold speckle only. **NOT comparable to (26)'s "2194 chunks @ ~48–51%"** (ad-hoc, pre-kind-5-rebinding/C77-fix/dig-#101 gate-source change) — do not diff against it. Under `SURFACE_V2=1` ALONE the caves-field conjunct is off (`noise-terrain.mjs:222`) ⇒ gradAt = topology image lane else the ramp PROTOTYPE (C39, not byte-backed). **Scope note:** `mapgen/experiments/2026-09-28-surface-census.mjs` = a Ghidra call-graph region census (130 fns, `~/work/ghidra-logs/p0_*.csv`) — an earlier handover mis-named it "the V2 chunk census"; it is NOT this instrument. Source: ABOUT_MATH §6 (114). |

| C94 | **The `<RandomColor>`/`<RandomMaterials>` runtime consumer chain — reachability, record layout, seed/warm-up/pick law (entry (115))** | Lane: fresh byte reads of `noita_dev.exe` this session (objdump windows; `.text` file = VA − 0x400C00, **`.rdata` file = VA − 0x400E00**). **Chain:** `ProceduralTerrain::Init` = **0x905fb0**, exactly 5 `call` xrefs (0x642f43, 0x72251f, 0x729ae4, 0x80c593, 0x80d4ec) → loop **0x907ab0..0x907b16** over vector `[ebp−0x284 begin, −0x280 end]` stride 4 builds a **stack wrapper {vptr `0x1199d40`, `vec[i]` @−0xb4, pad, `self = &wrapper` (`mov %eax,−0xa8(%ebp)` @0x907ac9)}`** → manager = global `0x13289b4` → `call 0x8cf000` (ctor: `mov %edi,0x10(%edi)` self @0x8cf044, `movw $0x1,0x24(%edi)` @0x8cf05a ⇒ byte[+0x25]=0, vtable `0x11888fc`, refcount +0x1c) → `push &wrapper; push %edi; call 0x8cef30` (ret $8): `cmpb $0,0x25(%edi)` @0x8cef41 → je **QUEUE 0x8cef67** else SYNC (`mov 0xc(%ebp),%eax` = &wrapper → `mov 0x10(%eax),%ecx` self → null check → `mov (%ecx),%edx; call *0x8(%edx)` @0x8cef59 = slot2) ⇒ **Init takes the QUEUE arm** (manager[+0x25]==0). Queue arm: lock xadd mgr+0x1c → `call 0x8cf0e0` node alloc → `call 0x92b300` attach (semantics OPEN) → `mov %edi,0x18(%ebx)` → `movw $0,0x24(%ebx)` → **`movl $0x8cf1f0,−0x8(%ebp)` @0x8cefa8** → `call 0x9fa830` enqueue; `call 0x8cf1f0` = 0 direct sites (installed fn-ptr). Runner **0x8cf1f0**: `mov 0x10(%esi),%ecx` (node+0x10 = wrapper) → `call *0x8(%vptr)` @0x8cf204-06. **slot2 `0xa99ea0` = raw `8b 49 04` + `e9 78 ad e6 ff` = `mov 0x4(%ecx),%ecx; jmp 0x904c20` — tail-jump with ecx = wrapper+4 = **vec[i]**; `call 0x904c20` = 0 sites and no e8/e9 to `0xa99ea0` ⇒ **the consumer is reachable ONLY via this vtable slot**. **Record layout (this = vec[i]):** +0x00 dword → **A** (proven @0x905b50: read back → `mov 0x1f4(%eax),%eax` @0x905b5c → `cmpl $0,0x4(%eax)` @0x905b6e); **+0x04 std::string (24 B) = `wang_template_filename`** (stack copy `call 0x41d770` @0x904c92 → F0+0x94); +0x1c std::string (copy @0x904ca4/4aa, identity OPEN); +0x34 width, +0x38 height (clamp [1,0x400], default 0x400 @0x904d26-2f); +0x3c..0x4b `movdqu` 16 B; +0x4c seed dword; +0x54/+0x80 `lea` @0x904d59/0x904d60. **Guard:** `cmpl $0,0xb0(%esp)` @0x904d33 (F0+0xa4 = the stack copy's `_Mysize`; consumer baseline = 3 pushes / 12 B) → hoist seed/xmm0/IAT 0x114a374/78/record fields → `jne 0x904e40` @0x904d76 else **assert `wang_template_filename.empty() == false`** (expr `0x1174198`, **line 0x710 = 1808**, file `0x1173a10` = `…\source\procedural_utils\procedural_terrain.cpp`, format `0x1150f60`) @0x904d90. **Seed → state:** seed dword → `cvtdq2pd` → `addsd 0x11e0ba0(,%eax,8)` (0.0 / 2³² sign bias) → `comisd 0x11e0220` (f64 2147483647.0) → jb skip → `mulsd 0x11dfdd8` (0.5) → `call 0x10098c0` = **assert `seed != 0.0`** (`ucomisd 0x11df878`, expr `0x1192220`, line **0x66 = 102**, file `0x11dda78` = `…poro\source\utils\random\random.cpp`) + Schrage Park–Miller `16807x mod (2³¹−1)` (`imul $0x41a7`, divisor magic `0x834e0b5f`), returns `state × 0x11df988 = state/(2³¹−1)`. **Pick @0x905ca8..0x905ce4:** `idx = cvttsd2si(state·count·k)` with **`mulsd 0x11e0578` = f64 −4.656612875e-10 = −1/(2³¹−1)** — **CORRECTION: NOT −2⁻³¹** (byte-read; magnitude byte-identical to `0x11df988`) ⇒ idx ≤ 0 → addr = `[esi+0x14] − 4·idx` ∈ [first, last−4] for state < 2³¹−1. **Warm-up @0x905273..0x905344: `N = (W mod 11) + (seed mod 12)`, N ∈ [0,21]** — `imul $0xaaaaaaab`+`shr $3` = ÷12 on seed; `imull 0x2c(%esp)` magic `0xd1745d17` + `imul $0xb` + sub = W mod 11 (V = clamped width, re-stored @0x905228-c); `jle 0x905344` skips when N ≤ 0; inlined Schrage loop. **Consumer epilogue `ret` @0x905faa; flood-fill asserts line 530/533/534/548 (8 sites, expr `0x1173c1c` = `pixels.IsValid( ipos.x, ipos.y )`); `BitmapNoise::LoadFromImageData 0x8f9ab0` = 3 sites — 0x8fa99b, **0x905dd7 + 0x905f1e (both INSIDE the consumer ⇒ two arms)**. **`+0xb0` census** (opcode 0xc7 ∧ mod=2 ∧ disp32=0xb0, file 0x400..0xd49200): **77 hits, the ONLY code-pointer immediate = `0x8ee1b0`** (2 sites 0x8ee3a7/0x8ee643) — all 4 `movl $0x8ee1b0` installs read: those two at `0xb0(%edi)`, **0x905acd = `movl $0x8ee1b0,0x140(%eax)`** (eax = this, @0x905ac7) + `push $0x10`/`call *0x114a34c`, and 0x64c7a4 = `0x108(%esp)` ⇒ **no per-biome resolver body is ever literally installed at +0xb0** (80 register-form `mov %reg,0xb0(%reg)` stores statically unresolvable = §8 row 35 caveat). **data.wak:** 3 `<RandomMaterials>` blocks / 6 `<RandomColor>` rules — offsets **1272832** coalmine (`FF00BBEE`, `FF12BBEE`), **1514362** liquidcave/lava (`FF01CFEE` → 5 colors incl `FF0BFFE5`, `FF12BBEE`), **1951247** town_under/forest (`FF01CFEE` → 4 colors, `FF12BBEE`); comments verbatim "changes the color to random material" / "randomizes blocking and non blocking paths" / "can be used to randomize scripts as well". **Vtable `0x1199d40` dwords = `[0xa99e20, 0xa99e60, 0xa99ea0, 0xa99eb0, 0xa99ed0, 0xa9b3d0, 0xa99ec0]`** (slot0/1 = allocate-and-copy 0xc B heap clone {vptr, payload}; slot3 = `mov $0x12f9014,%eax; ret` (6 B, int3 pad); slot4 → slot5 dtor; slot5 = base vtable `0x1179670` + conditional delete; slot6 = `lea 0x4(%ecx),%eax; ret`). **Pitfalls hit this dig:** `fulltext86.asm` **truncates at 0x1000d6f** (bodies ≥ 0x1000000 must come from `noita_dev.exe`); objdump `--stop-address` **excludes straddling instructions**, non-boundary start addresses misdecode, the raw-byte column wraps after 7 bytes, `tail -N` cuts instruction heads; **.rdata byte-delta ≠ .text byte-delta** — the old byte string for `0x1199d40` was read with the .text delta and was WRONG; x86 esp slots map only under matching push-pending (consumer baseline 3 pushes/12 B). **Residual OPEN = I24.** |
| C95 | **I23② settled — the `0x90a860` (surfaceField) call-site frame = PIXELS +0.5, and the callee's grid coordinate = f32(0.49162514·x + P[+0x94]) × 0.1 — the port's `surfaceField` omits that ×0.1 (entry (116))** | Lane: fresh objdump of `noita_dev.exe` this session (windows 0x908f40..0x909380, 0x90a860..0x90b140 → `mapgen/extractions/dig116-90a860.asm (X12)`, 0x909da0..0x909e60) + `mapgen/extractions/fulltext86.asm (X1)` for the call sites; sizes cross-checked against `mapgen/extractions/p0_functions.csv (X34)` (**size column is DECIMAL**: `FUN_00908f40` 1072 = 0x430 → 0x909370 ✓, `FUN_0090a860` 2217 = 0x8a9 → 0x90b109/next fn 0x90b110 ✓). **(a) Call sites of `FUN_00908f40` = 3**, all in `FUN_00792580`: **0x7930d3** (main cell), **0x7938d1** (probe x−1), **0x7938fe** (probe x+1). Each sets `xmm1 = (double)(driver[+0x20] + x)`, `xmm2 = (double)(driver[+0x24] + y)` (`movd`+`cvtdq2pd`; x from `[esp+0x30]`, y from `[esp+0x2c]`) with `ecx = driver[+0x70]` = `this`; the counters step 1 and are bounded by driver[+0x28] w / [+0x2c] h (`cmp` @0x792faa / 0x792f87) ⇒ **originX+x / originY+y are pixels**. **(b) `FUN_00908f40` body:** `movsd xmm2→−0x20` (y), `movsd xmm0→−0x28` (x, = incoming xmm1), `call 0x909da0` (ecx = this) → ebx = region; **`[R+4]==0`** arm: `addsd 0x11dfdd8` (=0.5) to BOTH → `push ebx` (the one stack arg) → `movapd xmm2→xmm3`, `movaps xmm1→xmm2` → **`call 0x90a860` @0x908f96** → `cvttsd2si −0x20/−0x28` → int (y,x), `ecx = [ebx+0x2a4]` (mBiomeMaterials), `xmm3 := xmm0` (the returned field) → **`call 0x8f5030`** (classifier) @0x908fb0, return = its eax; **`[R+4]==1`** arm asserts **`biome->bitmap_data`** (expr **`0x1175088`**, line **0xa6e = 2670**, file `0x1173a10` = procedural_terrain.cpp). **(c) PIXELS proof = `0x909da0` (region-at) body:** `movsd 0x38(%edi),%xmm1; addsd %xmm0` and `movsd 0x40(%edi),%xmm0; addsd %xmm2` → `cvttsd2si` → **`and $0x1ff` + `sar $0x9`** (y additionally `idiv [edi+0x50]` with the negative fix-up) = **512-px chunk index + intra-chunk offset applied to the SAME values** ⇒ units = pixel, chunk = 512 px; the world offset is `this[+0x38]/[+0x40]` and is added **only inside 0x909da0**, i.e. `0x90a860` receives the driver-rect pixel coord without it. **(d) Callee `0x90a860`** (`ret $0x4` @0x90b106 = exactly one stack arg = the region): `[ebp+8]`→ebx = R, xmm2→−0x44 (x+0.5), xmm3→−0x3c (y+0.5), ecx→−0x30 (this); `R[+4]` selects two **byte-identical** grid copies (0x90a8c1.. / 0x90ac28..), `P := R[+0x1d4]` (`null` ⇒ skip grid → 0x90aad1 ⇒ field0 = 0 ⇒ r′ = 0 ⇒ return 0). **Grid law (both copies):** `u = f32( 0.49162514·(x+0.5) + f32(P[+0x94]) ) × f32 0.1` — `mulsd 0x11dfdc8` = 0.49162514, `movss 0x94(%eax)`, **`mulss 0x11df974` = f32 0.1**; `v` = same shape with the `P[+0x94]` bias scaled by **`0x11dfa08` = 6.86035959282328e-07** (meaning OPEN) — then `cvttsd2si` + `comisd`/`dec` floor fix-up, frac, smoothstep weight **(3−2t)·t²** (`0x11dff70` = f32 3.0, `0x11dfe68` = f32 2.0, `0x11dfbf0` = f32 1.0), **4× `call 0x9fe620`** (wrap-mod getter, C45) over `P`'s grid, 2 bilinear lerps → field0. The ×0.1 is a real **grid↔pixel conversion**: `0x11e015c` = **f32 10.0** multiplies u/v back up before `call 0x908cb0` in the add-noise arm (@0x90aa66/6e) and `divss 0x11df974` (= ÷0.1) appears @0x90ac0b. Gates re-pinned: `comiss 0x11dfaac` = 0.51 @**0x90aaf7**, `0x11dfb84` = 0.85 @**0x90ab48** → slab↔true pairs 0x50a2f7/0x50a348 ⇒ **`0x90a860` = the port's `surfaceField` identity re-confirmed**; the r-eval is **`call 0x90b280`** @0x90aadd (slab 0x50aa80) with ecx = this, **xmm2 = x+0.5 / xmm3 = y+0.5 — the same PIXEL args, NOT ÷10**, push R, then `mulss field` ⇒ r′. **(e) Port gap:** `mapgen/lib/noise-proto.mjs:676` = `gradAt(f(x·0.49162514) + valueOfP94, …)` — **no ×0.1** ⇒ with pixel args (V3 / C80's frame) the grid index runs **10×** the game's (0.49162514·px vs 0.049162514·px), whereas V2's cell pre-scale `x = px/10` makes the grid term exact (0.49162514·(px/10) = 0.049162514·px) but feeds the r-eval 1/10 of the pixels it receives in the binary ⇒ **each lane is right for one of the callee's two consumers; the fix belongs inside `surfaceField` (+ a gradAt-units decision for the ramp placeholder), not in either lane's frame.** Pitfalls re-confirmed this session: `fulltext86.asm`'s truncation (0x1000d6f) does not affect this window; `--stop-address` excludes straddling instructions; the raw-byte column wraps after 7 bytes. Sources: entry (116), ISSUES I23②. |
| C96 | **The grid-texel scale + the tile→lane frame law + the BitmapCaves dims census — dig #117's measurement substrate** | (a) `u = 0.049162514·px` (= f64 `0x11dfdc8` × f32 `0x11df974`, both C95) ⇒ **1 grid texel = 20.340701047143355 px**; a 512-texel grid wraps every **10414.438936137398 px = 20.340701047143355 chunks**; a 512-px chunk spans **25.171207168000002 texels** ⇒ each bty band step shifts the sampled field rows by **+25.171207168000002**. (b) Tile→lane frame: the noise lane's `ty = bty + SKY_ROWS` (SKY_ROWS = 48 — the C79 gen call is `worldColorAt(world, tx·512+x, (bty+48)·512+y)`), so tile (tx,bty) ⇒ `wx = tx·512+cx·10+5−17920`, **`wy = (bty−14)·512+cy·10+5`** (C80 origins + the `bandTopPx` cancellation) — feeding the raw tile frame returns **null masks from BOTH lane versions** (probe pitfall found dig #117). (c) BitmapCaves grid dims, data-verified from the extracted XMLs 2026-10-09: main-band **512×256** (coalmine, coalmine_alt, desert, excavationsite, forest, hills, hills2, hills_flat, liquidcave, mountain_right_stub, mountain_tree, pyramid_entrance/hallway/left/right/top, robobase, scale, shop_room, the_end, the_sky, town_under, vault, vault_frozen, winter, winter_caves, wizardcave), room biomes **256×256** (alchemist_secret, ending_placeholder, essenceroom*, funroom, ghost_secret, gourd_room, greed_room, gun_room, meatroom, mestari_secret, moon_room, mystery_teleport, null_room, ocarina, rock_room, roboroom, secret_altar, secret_lab, song_room, …), and the odd **516×256 = crypt, magic_gate, pyramid, wandcave**; **rainforest\* carry NO size attrs** (⇒ their caves lane is inert by construction); `topology_lake.png` = **512×256** = the set's ONLY `bitmap_noise_file`. Sources: entry (117), `the dig117 probe script (ORPHANED 2026-10-12 — flagged, do not cite){,2,3}.mjs`, `/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/biome/*.xml` |
| C97 | **The SURFACE SHAPE instrument spec — `mapgen/experiments/2026-10-10-surface-shape-iou.mjs` (dig #118; closes I23③'s gap)** | Why: C79's IoU is a **line** metric (first solid run ≥20 px per column) and its gate REFUSES `SURFACE_V2`, while the shape gate `2026-09-21-surface-shape.mjs` reaches only wang/template bands ⇒ no instrument judges the noise lanes' rendered 2-D SHAPE (I23③). **Lane gate (C79-inverted):** require at least one of `SURFACE_V2=1` / `SURFACE_V3=1` (neither ⇒ `attachNoiseTerrain` returns unattached, `noise-terrain.mjs:383` ⇒ every gen cell air ⇒ meaningless), `PROC_FILL` refused (template-band lane, `template-render.mjs:661` — C79 parity so template content stays at its default); the effective combo is recorded in the JSON and stamped into output names as `-v3` / `-v2v3` / `-v2`. Lane semantics to know when reading a run (disk-read `noise-terrain.mjs:219-264` this session): the flags are **module-load-time** consts (`:96-97`) ⇒ one lane per process; the V2 block **early-returns** before the V3 classify chain (`if (SURFACE_V2) { … return {mask,def,v2:true} }` @`:219`) and its caves-field `gradAt` needs the `SURFACE_V3` conjunct (`:231`) ⇒ **`SURFACE_V2=1` alone = cell loop + ramp/topology gradAt; `SURFACE_V2=1 SURFACE_V3=1` = cell loop ON the caves field; `SURFACE_V3=1` alone = the classify chain (C79's lane)**. **Tile set = C79's scorable census re-derived byte-for-byte in-script** (same constants/`refLine` code: seed 78633191, `mapgen/out/ref`, bty 6..15, tx 4..58, P1 `^(mountain|hills|desert|winter|lake)`, sky-top ≥6/8 air + first solid run ≥ RUN_MIN 20 ⇒ ≥25 % of columns, i.e. 56 tiles of 458 P1 scanned — cross-checked against `mapgen/out/surface-y-2026-09-24.json` `scorableTiles`, warn on mismatch). Solidity both sides = `lum ≥ AIR_THRESHOLD 24` (`0.299r+0.587g+0.114b`; pipeline/3-compare.mjs:18 via C78/C79); gen = `worldColorAt` (L3_ANCHOR +11/+12 applies inside, C78; `null` ⇒ air, same as C79). **Per tile over ALL 512×512 cells** (masks `R` ref / `G` gen, `Uint8Array(262144)`, retained in memory — 56×2×256 KiB ≈ 29 MB — so overlays need no second pass): (a) **iou** = |G∩R| / |G∪R| over SOLID cells only (air is in neither set ⇒ a sky-heavy tile does not inflate it; `uni=0` ⇒ null); (b) **profL1** = `Σ_y |rcR(y)−rcG(y)| / 262144`, `rc(y)` = solid cells in row y ∈ [0,512] ⇒ the alignment-tolerant **cavity-curve distance** (row-mass distribution, ∈[0,1]); (c) **dyOpt** = `argmin_dy Σ_y |rcG(y+dy)−rcR(y)|` over dy ∈ [−256..256], out-of-range `rcG` ⇒ 0, ties prefer smaller |dy| (scan order 0,±1,±2,…) and **iouShift** = iou of G shifted by dyOpt — the §8 row-34 registration-vs-interior partition at mask level: `iouShift ≫ iou` ⇒ residual = vertical registration, both low ⇒ interior SHAPE; (d) **b0..b3** = iou per tile-row quarter 0-127 / 128-255 / 256-383 / 384-511 on the RAW masks (dy=0) — localizes surface band vs deep band; (e) **fR/fG** = whole-tile solid fractions. Aggregates: pixel-weighted `Σ∩/Σ∪` for iou/iouShift/b0..b3, unweighted tile means for profL1/fR/fG and dyOpt (mean+median), grouped overall / byFamily (P1 prefix) / byRow (bty); mean row profiles at 3 dp: overall = ref / gen / genAligned (each tile's `rcG` shifted by its own dyOpt), byFamily = ref / gen. Outputs: `mapgen/out/surface-shape-2026-10-10-<lane>.json` + triptych overlays `mapgen/out/surface-shape-2026-10-10-<lane>/<tx>_<bty>_<label>.png` = panel1 ref | panel2 gen (solid 96, air 16 gray) | panel3 diff (yellow = both solid, red = ref-only = miss, green = gen-only = hallucination, dark = neither) for the **best + worst tile per family by iou**. **Out of scope:** line metrics (C79 owns them), the per-cell value log (`SURFACE_LOG`, `noise-terrain.mjs:317`). **Measurement caveat (port truth, both lanes):** `noiseSolidAt` maps px→mask cell via `floor((wx−tx·512)/10)` with `lx ≥ 51 ⇒ 0` (`noise-terrain.mjs:405-407`) ⇒ the gen shape is **10-px-block quantized (51×51 usable)** while the game classifies per pixel (C76's tagged deviation) — the instrument measures the port as it renders, blockiness included. Sources: entry (118), ISSUES I23③. |

| C98 | **fnB placement constant bank + gates (dig #119)** | All rdata VAs at file = VA−0x400E00 (C57), **every value re-read on disk this session** (f32 unless noted). **The f64 trio — used via `mulsd`: 11.0 `0x11dff38`, 81.0 `0x11dffd8`, 101.0 `0x11dffe8` — reads back as 0.0 when decoded as f32** (pitfall that nearly poisoned dig #119's numbers). **Loop B (mountain):** K scale 0.1 = `0x11df974` (f32(h)·0.1; ALSO surfaceField's ×0.1 — C95) · v init 1.5 = `0x11dfd2c` · row R increment 0.5 = `0x11dfa94` (R += 0.5·(u+1)) · coin bonus 0.25 = `0x11df9d0` · decay 0.97 = `0x11dfbcc` / 0.03 = `0x11df91c` (v·(0.97+0.03u)) · 11.0 f64 above (Y_end) · coin immediates: 20 = `cmp $0x14` @0x8f0af5, 50 = `cmp $0x32` @0x8f0cad · knobs mountain_count +0x54/+0x58, mountain_size +0x5c/+0x60 (C52). **Loop C (blob):** y min 25.0 = `0x11e01e0` (emitted as imm `mov $0x19` @0x8f0ee3) · knobs +0x64/+0x68 count, +0x6c/+0x70 v, +0x74/+0x78 R (C52). **L2/L3 chains:** count law = 120 imm (`mov $0x78`) + 81.0 f64 + −2⁻³¹ scale (C51 `0x11e0578`) via the negative-scale `sub` idiom · chain base 3.0 = `0x11dff70` / 1.0 = `0x11dfbf0` (3u+1; 1.0 also = emitter span xmm3 + L3 clamp hi) · chain scale coef 0.1 = **`0x11df970`** / offset 0.95 = `0x11dfbac` (0.1u+0.1 for [−0x108]; 0.1u+0.95 for y; **distinct address from 0x11df974's 0.1**) · decay 0.01 = `0x11df8e0` / 0.99 = `0x11dfbdc` ([−0x108] *= 0.01u+0.99) · per-iter draw 0.25 = `0x11df9d0` / 0.75 = `0x11dfb2c` ([−0x100] = 0.25u+0.75; 0.75 also = L2 clamp lo) · value law 0.35 = `0x11dfa20` / 0.65 = `0x11dfb14` (v = chain·(0.35u+0.65), C44 numeric) · L2 clamp hi 4.0 = `0x11e005c` · L2 velocity step 0.5 = `0x11dfa94` − 0.25 (`0x11df9d0`), clamp ±2.5 = `0x11dff10` / `0x11e0618` · L3 velocity step 0.3 = `0x11df9f0` − 0.15 = `0x11df99c`, clamp ±1.0 = `0x11dfbf0` / `0x11e05a8` (−1.0 also = the L2 sign coin) · L2 arm A = 3.5 `0x11dfff4` + 31.5 `0x11e0250` · L2 arm B = 25.0 `0x11e01e0` + 50.0 `0x11e0284` · L3 x spread 2.0 = `0x11dfe68` (x₀ = w/2 ∓ (3.5+2·r), hi band = 2·(1+r)) · L2 velocity init coef 2.25 = `0x11dfed0` + 1.25 = `0x11dfc88` (s·(1.25+2.25u)) · L3 velocity init coef 0.2 = `0x11df9b0` (with 0.15 above) · C-rand divisor 32767.0 = `0x11e04bc` (MSVC `rand()` LCG seed 0x132a388, `imul $0x343fd`/`+$0x269ec3`) · 16-B sign-flip mask = `0x11e0c50` (arm B: [−0x104] := −s₀) · f64 2⁻³¹ = `0x11df988` (C51 pair). **Gates + keys:** **config byte [+0x31] = the L3 enable flag** (`cmpb $0x0,0x31(%eax)` @0x8f25a1 → `je 0x8f2fa5` skips L3; slot NOT in C52/C58) · **L2 = exactly 2 passes** (`inc [−0x10c]; cmp $2; jl 0x8f1b00` @0x8f2585–0x8f2595) · spawn lane: 5% coin = 101.0 f64 + `cmp $0x5` (@0x8f246b L2, @0x8f2e09 L3) + both ptrs non-null + 95/5 = `cmp $0x5f` + `cmovl` (@0x8f252d/0x8f2538 L2, @0x8f2ecb/0x8f2ed6 L3) over strings **`spawn_small_enemies`** (19 B, `0x1173110` → [−0x150] @0x8f19d2) / **`spawn_items`** (11 B, `0x1173124` → [−0x124] @0x8f1a12) · emitter span xmm3 = 1.0 at both calls (L2 @0x8f251d, L3 @0x8f2ebb) · setter flag: **walk pushes 1** (`push $0x1` @0x8ef37a), **L2/L3 push 0** (@0x8f2079, @0x8f2a0b) — the flag's internal branch = C46-FLAGGED. Engines (C46): blend `0x8ee930`, setter `0x8ee750`, scatter `0x8eead0`, getter `0x9499f0`, nextDouble `0x10098c0`. **dig #120 corrections:** ① the [−0x108] chain-scale INIT loads **`0x11df974`** (L2 @0x8f1e6d/0x8f1e75, L3 @0x8f2881/0x8f2889 — the same f32 0.1 literal as loop B's K), NOT `0x11df970`; only the y-update loads `0x11df970` (L2 @0x8f216b, L3 @0x8f2b06) — functional equivalence (both f32 0.1), the "distinct address" gloss overturned, cite fixed. ② the setter-flag branch = **SETTLED** (C99: value > 1.0 arms the circle, the flag gates only the y<25 eave, both flags lower-only). ③ the blob radius "cap 20" + the C50 strength reading = overturned (§8 row 40). Sources: entry (119), (120), C52, C57, C99. |
| C99 | **The dig #120 port record — the setter/blend laws, the MSVC C-rand, and the loop-B draw order (2026-10-10)** | (a) **setter `0x8ee750` internals (C46 CLOSED):** branch on **value > 1.0** (`comiss` vs `0x11dfbf0` @0x8ee766; xmm2 = value, [−0xc] = scale); value ≤ 1 → **single cell**: bounds → getter `0x9499f0` → `comiss [−0xc],cell; jbe ret` = write iff cell > scale → `movss %xmm2,(%eax)` @0x8ee7d5, write scale; **[dig #122 correction — C101(c):** the store = `movss −0xc(%ebp),%xmm0; movss %xmm0,(%eax)` @0x8ee7cf..0x8ee7d4 — it writes **SCALE**; the `movss %xmm2,(%eax)` cite named the wrong register (xmm2 = VALUE)**]**; value > 1 → **circle**: R2 = value² (mulss @0x8ee7e2), r0 = trunc(value+0.5) (addss `0x11dfa94`=0.5 → cvttss2si @0x8ee7ee), box ±r0, d² > R2 → skip, t = (R2−d²)/R2, **target = 1 + t·(scale−1)**, plain bounds, write iff cell > target ⇒ **both flags LOWER-only; the flag=1 arm = the same with the y<25 eave `1 + q⁸·(target−1)` applied before the guard — the flag gates ONLY the eave**. **[dig #122 corrections — C101(c):** (i) q = y/**25.0** (`0x11e01e0`, **NO −1** — the "(y−1)/25" was a miscite); (ii) y = the stamp **CENTER** y = the point y `[edi+4]` read @0x8ee85e (the cell coords form only at @0x8ee892) — **not** the per-cell py; (iii) the eave exists only in the **CIRCLE** arm — the single-cell arm returns @0x8ee7de before the eave block**]**. (b) **blend `0x8ee930`:** `comiss 1.0,R; jb circle` → R ≤ 1 = single-cell min-guard (write iff cell > v); circle: r0 = trunc(R+0.5), d² > R² → skip, t = (R²−d²)/R², **w = t²** (mulss @0x8eea33), cell += (v−cell)·w, plain bounds, no wrap. (c) **MSVC C-rand LCG (L3's setup):** persistent global `0x132a388`; `state' = state·0x343fd + 0x269ec3` (int32), `r = (state' >> 16) & 0x7fff` ÷ `32767.0` (`0x11e04bc`); **r₁ → lo = 1+r₁ → [−0x10c], r₂ → hi = 2(1+r₂) → [−0x12c], r₃ → x₀ = center + s·(3.5+2r₃)** (3 draws @0x8f25ab..0x8f2626, state stored back once after r₃ @0x8f2626), **r₄** interleaved @0x8f284a → vel = s·(0.15+0.2r₄); the Lehmer draws between: count = 120+⌊81u⌋, chain = lerp(lo,hi,u), scale = 0.1u+0.1. The port seeds a LOCAL state (0x132a388) per build — the game's global seed is unknowable (FLAGGED). (d) **loop B per-stamp draw order re-pinned (u-numbers = draw order):** u₁ base = ⌊f32(K·u₁)⌋ (K = f32(h)·0.1 @0x8f0780), u₂ X = 5+⌊(w−9)u₂⌋ (the −2⁻³¹+sub idiom), u₃ R = rollF32(mountain_size), u₄ Y_end = base+⌊11u₄⌋+15 (the same sub idiom, 11.0 f64 @0x8f0a4f), v := 1.5 (`0x11dfd2c`), u₅ the 20% coin (`cmp $0x14` @0x8f0af5) → Y_end := base AND u₆ = the direct call `0x10098c0` @0x8f0b08 → v := 1.5+0.25u₆; guard base > Y_end → skip rows (dead); rows: blend @0x8f0b6d → R += 0.5(1+u) → the 50% coin (`cmp $0x32` @0x8f0cad) → v *= 0.97+0.03u. (e) **knob reassignment:** loop-B R = +0x5c/+0x60, loop-C v = **+0x6c/+0x70** (blob_caves_strength), loop-C R = **+0x74/+0x78** (blob_caves_radius) — **C50 overturned** (§8 row 40); L3's gate byte [+0x31] = the XML `do_beginning_down` (C52 slot; hills.xml = 1, on-disk 2026-10-10). Port = `caves-field.mjs` v5 (`setterStamp` internal, `raisePointMax` gone, meta l2Calls/l3Calls). The walk/record lanes were re-modeled onto these laws dig #122 (walk → `setterStamp` flag=1, record → `stampLerpTemplate`; `carveCircle` = LEGACY — C101). Sources: entry (120), C52, C57, C98, dig #122 (C101). |
| C100 | **The dig #121 caves-consumer index law + the `0x908f40` kind-arm bank (I25 index half CLOSED)** | All cites re-read from `mapgen/extractions/fulltext86.asm (X1)` + `mapgen/extractions/builder-8EE000-8F3700.asm (X2)` this session (exe md5 re-verified = C13). **(a) The consumer gate (sampler true 0x90d860):** `eax = [owner+0x9c]` (the f32 grid's W = grid[0]) → `ecx = &owner+0xb4` (the accessor object = grid+0x18 — the offsets interlock: 0x9c+0x18 = 0xb4) → `imul %esi (OUTER) ; add %edi (INNER)` → push → **getter `0x9499f0`** (= dig 83's slab 0x5491f0) → `movss (%eax)` → `comiss 0x11dfa94 (0.5) ; jbe 0x90e02b` = air — all @0x90dba5..0x90dbd0. **Loop orientation OUTER = y, INNER = x**, two proofs: the world-compute @0x90dbed..0x90dc0d (`esi := *([ebx+0x24]) + INNER` → xmm2 = the kind-2 x slot; `edi := *([ebx+0x28]) + OUTER` → xmm3 = y — the kind-2 warp call @0x9091d7..0x9091ec pins xmm2 = x = −0x28, xmm3 = y = −0x20, C95) and the writer closure. ⇒ **idx = W·y + x (row-major CELL); the u-law (C95/C96) is surfaceField's kind-0 grad chain ONLY.** (b) **Writer closure:** setter `0x8EE750` @0x8ee776..0x8ee7c9 — `esi=[p]=x, edx=[p+4]=y, eax=[grid]=W`, bounds x<W/y<H → `imul %edx,%eax; add %esi` = **W·y + x**, accessor `lea 0x18(%ecx)`, getter `0x9499f0` — same law/getter/layout (`[0]`=W, `[4]`=H, `[+0x18]`=f32 data). Sibling grids in the sampler share it: u16 `owner+0xbc` (stride `[0xbc]`, accessor `+0xd4` @0x90da28), byte `owner+0xdc` (accessor `+0xf4` @0x90db49), byte `owner+0x188` (accessor `+0x1a0`, dig 83). **(c) Kind arms of `FUN_00908f40` (0x908f40..0x90936f) — no float-field access:** kind==1 = bitmap_data arm — `[R+0x1b0]` null → ret0 (assert procedural_terrain.cpp:2670), `x mod W`/`y mod H` with negative fix-up, idx = `W·(y mod H)+(x mod W)`, getter **`0x949f60`** (color), `test $0xffffff` (RGB≠0) → `driver[+0xa0] → 0x4b8080 → driver[+0x28] → 0x4b80e0` (assert line 0xa7a = 2682 on null); kind==2 = P-lane — warp `0x908cb0(x, y, f32)` (param 0.0f → `[P+0x234]` → 1.0f fallback) with `[region+0x1d4]` → `0x8fae40` count >0 → `0x4b80e0` resolve → params `[P+0x234]/[+0x238]` → **variant `[P+0x23c]`: 1 → `0x8facd0`, 2 → `0x8faae0`, else `0x8fa9b0`** → `comiss [−0xc]=0.5` (from `0x11dfa94`) jb ret0 → re-count >0 → the shared tail @0x9091b6, else fallback `0x908e70` → classifier `0x8f5030` (`[X+0x2a4]`); kind==0 = C95's arm. **(d) fnB factory (join evidence, FLAGGED → I27):** @0x8ee379..0x8ee427 — 0xb8-byte alloc via ctor `0x8f9470`, `[obj+0xb0] = 0x8ee1b0` (the color→idx thunk), smart-ptr swap at `[obj+0xb4]` (`*0x24` virtual result; old released via vtable) @0x8ee3f3..0x8ee3f9, again @0x8ee692; the sampler's owner is bigger (slots to `[+0x2a4]`) ⇒ the fnB-buffer ↔ sampler-slot wiring is NOT byte-traced (no `+0x9c`/`+0xb4` init in 0x79xxxx–0x90xxxx; 0x795b45's `+0x9c` = vector `end−begin>>5`). Consts used: `0x11dfa94` = 0.5, `0x11dfbf0` = 1.0f (both C98-registered, re-seen). Port: `noise-terrain.mjs` caves-lane value = the direct cell read (V3 `gradKind === "caves" ? gradAt(wx,wy) : surfaceField(...)`, V2 `cavesSrc ? gradAt(gx,gy) : ...`); C97 A/B v3 0.24708 → 0.46464, v2v3 0.25393 → 0.46557, v2 bit-identical; fG v3 0.162 → 0.840 (= I26's uncarved-base signature). Sources: entry (121), C13, C57, C95, C98, dig 83, ISSUES I25/I27. |
| C101 | **The dig #122 walk/eave/record const bank + the corrected setter laws (I26 CLOSED)** | All values re-read from the PE this session (file = VA−0x400E00, C57; **the f32/f64 trap again: every f64 below reads back as garbage/denormals as f32** — e.g. 0x11e0608 f32 = 0.0, 0x11dffe8 f32 = 0.0, 0x11e0220 f32 = NaN). **(a) the walk's const bank (FUN_008eec70, every load re-derived):** the draw scale 2⁻³¹ = **`0x11df988`** (f64, 44 `movsd` in the walk); the `s` span: 2.0 = **`0x11dfe68`**, −4.0 = **`0x11e0608`** (f64), 5.0 = **`0x11e00a0`** ⇒ `s = (2 − trunc(−4u))/5` (byte order @0x8eef1c..0x8eef40 → `[−0x20]`); rA/rD coef **0.2** = **`0x11df9b4`** (also the lane's first boundary — the game shares the literal), rB/rC: **2.5** = **`0x11dff10`** + **1.0** = **`0x11dfbf0`** ⇒ `s·(1 + 2.5u)` (re-pinned @0x8eef53..0x8eefd5 — each result × `[−0x20]` = s: `[−0x68]` = rA, `[−0x50]` = rB, `[−0x5c]` = rC, `[−0x6c]` = rD); the lane law: 0.2 (`0x11df9b4`) / **0.4** = **`0x11dfa44`** / **0.6** = **`0x11dfaf8`** / **0.7** = **`0x11dfb1c`**; the unconditional roll draw: **0.35** = **`0x11dfa1c`** / **−0.25** = **`0x11df9d0`**; the D2 arm: **0.32** = **`0x11dfa00`**; the envelope boundaries **0.3** = **`0x11df9f0`** / 0.6 (shared); the gates: 101.0 = **`0x11dffe8`** (f64), **50.0** = **`0x11e0284`** (the substeps gate + the child budget), **100.0** = **`0x11e02dc`** (the 2% child gate), **−1.0** = **`0x11e05a8`**. **(b) the walk's `length` assert:** **10240.0** = **`0x11e049c`** — the threshold of the walk prologue's assert (`movss` @0x8eefda → `comiss %xmm1,%xmm0; ja 0x8ef0b1` @0x8eefe2..0x8eefe5 with xmm1 = `[ebp+0x18]`): the failing path pushes line `$0x243` (579) + the condition `length < 10240.f` @`0x1173130` + the file `…\source\procedural_utils\biome.cpp` @`0x1172ea8` + the fmt `Assert failed: (%s) in %s at line %d\n` @`0x1150f60` → `call *0x114a374` ⇒ **`[ebp+0x18]` = the walk's length/budget** (the child recursion stores childBudget to the same slot @0x8ef809) — 10240.0 = the walk's runaway-budget guard. **(c) the setter's eave — the C99(a) corrections (overturned in place):** the flag = the byte `[ebp+8]` (`cmpb $0x0,0x8(%ebp)` @0x8ee839 → `je 0x8ee892` — SSE leaves EFLAGS alone); the eave's y = the POINT y `[edi+4]` (the stamp **CENTER** — the cell coords form only at @0x8ee892 `mov (%edi),%ebx; mov 0x4(%edi),%edi` + the row/col adds), the bound `cmp $0x19,%eax; jge` (skip at y ≥ 25), q = y/**25.0** = **`0x11e01e0`** with **NO −1** (C99(a)'s "(q = (y−1)/25)" = a **miscite**; the divisor is shared with loop C's y-min), q²·q⁴·q⁸ = three `mulss %xmm0,%xmm0` @0x8ee879..0x8ee881, target′ = 1 + q⁸·(target − 1) → `[−0x14]` (the guard + the write use the eaved target); **circle arm only**; the single-cell store = **`movss −0xc(%ebp),%xmm0; movss %xmm0,(%eax)`** @0x8ee7cf..0x8ee7d4 (writes **SCALE** — C99(a)'s `movss %xmm2,(%eax)` = a miscite, xmm2 = VALUE). **(d) the record ctor `0x8F9470` (the per-stamp template):** seed = the raw Park-Miller count draw → `[+0x8c]` = seed (int, `mov %eax,0x8c(%esi)` @0x8f9529 + `cvtdq2pd`), `[+0x90]` = **1.0f** (`movl $0x3f800000` @0x8f9536), `[+0x94]` = u·200000 − 100000 (`mulss 0x11e0504; subss 0x11e04ec` @0x8f95a1..0x8f95b1) — the size pair **200000.0** = **`0x11e0504`** / **100000.0** = **`0x11e04ec`** (f32); the wrap `seed ≥ 2³¹−1 → ×0.5`: 2³¹−1 = **`0x11e0220`** (f64), 0.5 = **`0x11dfdd8`** (f64); the signed→f64 pair {0.0, 2³²} = **`0x11e0ba0`/`0x11e0ba8`** (f64). The ctor zero-inits the container blocks (`movl $0x0` @0x8f9481..0x8f94c8) ⇒ a FRESH template carries no shape (both engines no-op — I28). Sources: entry (122), C99, C13. |
| C102 | **The dig #123 record-lane draw law + the no-write proof (2026-10-11, I28 CLOSED — C51's roll/write claims corrected)** | All cites re-read from the builder asm this session (file = VA−0x400E00, C57). (a) **Count roll byte-exact @0x8f11b3..0x8f1280:** `count = [rec+0x1c] + trunc(u·([rec+0x20] − [rec+0x1c] + 1))` — **UP from min**; u = the NEW state·2⁻³¹ (state stored back @0x8f1262 before use, matching `prng.next()`); mechanism: minuend = the count_min slot `[−0x120]` (from `0x1c(%eax)` @0x8f11d2), span = `[−0x100] − [−0x120] + 1` @0x8f1253..8f1255, `mulsd 0x11e0578` (−2⁻³¹) @0x8f1266 forms `−u·span`, `cvttsd2si` @0x8f1272 → `sub %eax,%ecx` @0x8f1276 ⇒ min − trunc(−u·span) = min + trunc(u·span); `test %ecx; jle 0x8f16f1` @0x8f1280 skips the record (0 draws) at ≤ 0. C51's "max − trunc … counts DOWN" read the sign at the mulsd AND the wrong minuend — OVERTURNED. (b) **Per-stamp draw budget** (the loop counts DOWN: `decl [−0x120]; jne 0x8f1295`) = **4 always + 1 per `$[lo-hi]` group**: (i) ctor-seed @0x8f12c5..0x8f130a (Schrage advance, state stored @0x8f130a; the ctor arg = trunc(u·(2³¹−1)), ×2⁻³¹ `0x11df988` then ×(2³¹−1) `0x11e0220`); the ctor's 2 internal draws use a STACK-LOCAL Random (`lea 0x8(%esp)` → `0x10098c0` ×2 @0x8f958d/0x8f9596 → `[+0x94] = u·200000 − 100000` @0x8f95b1) — the stream is untouched; (ii) the image resolver @0x8f144e → 0x668400 (draw law below); (iii) X @0x8f14b6, store @0x8f1518 = `[rec+0x28] + trunc(u·([rec+0x30] − [rec+0x28] + 1))`; (iv) Y @0x8f157f, store @0x8f15d9 = `[rec+0x24] + trunc(u·([rec+0x2c] − [rec+0x24] + 1))`; (v) strength @0x8f164d, f32 store @0x8f16a3 = `[rec+0x34] + u·([rec+0x38] − [rec+0x34])` (the C50 inline `A + d·(B−A)` compose @0x8f1684..0x8f16b7 ✓) — all 3 tail rolls unconditional (the assert `jp` skips only the print). fn950's call: ecx = the temp (`lea −0xfc` @0x8f169d), edx = the field, stack Y/X/strength (the `push %ecx` room @0x8f169c, `movss` @0x8f16bb, pushes @0x8f16c0/0x8f16c7, call @0x8f16c8, `add $0xc` @0x8f16cd); dtor @0x8f16dd (0x64cad0); record stride 0x3c, `jb 0x8f11b3` @0x8f1730. (c) **Resolver draw law (0x668400, full CF):** `find('$')` @0x668494 → npos ⇒ out = input + `jmp 0x668788`, 0 draws (empty input takes the same path); else `find("$[")`/`find("]")` → the inner split on "-" (`0x100c460`) → count = bytes/24; ≥ 2 (`cmp $2; jae 0x6685dc`) ⇒ **1 draw @0x6685ff**, value = lo + trunc(u·(hi−lo+1)); < 2 ⇒ "Error in parsing, no end in sight" @0x6685bf, 0 draws (the substitution still runs with value 0); the substitution = prefix+value+suffix (group removed) + the recursion @0x66873f on the substituted string ⇒ **exactly 1 draw per well-formed group**. XML census (all 102 CaveStructure records, on disk 2026-10-11): 94 plain, 7 `$[0-999]`, 1 `$[1-4]`. (d) **The no-write proof:** the ctor 0x8F9470 zero-inits every dim/container slot (`movl $0x0` @0x8f9481..0x8f94c8 ⇒ `[temp+0] = [temp+4] = [temp+0x5c] = 0`); the windowed slot census @0x8f11b3..0x8f1746 finds only the 3 `lea −0xfc` sites (ctor @0x8f1300, fn950 @0x8f169d, dtor @0x8f16dd) + the dead `+0xb4` handle — the temp is frame-local ⇒ nothing outside fnB can address it; fn870 exits `[temp+4] ≤ 0` @0x8ef888b → 0x8ef940; fn950 (which calls fn870 first @0x8ef96f) exits `cmpl $0,0x5c(%ebx); je` @0x8ef977 → the epilogue @0x8efa2d (`pop edi/esi/ebx; mov ebp,esp; pop ebp; ret`) ⇒ **the record lane writes NOTHING; its only effect = the draws** (⇒ C51's "write = the BYTE-GRID blend twin" and §12's "record lane stamps the BYTE grid" OVERTURNED). Port: `caveRecordStamp({countMin,countMax,imageFile}, prng)` draws-only + the `resolverDraws` group counter; `rollNeg` + the stampLerpTemplate call removed (the fn kept as LEGACY). Sources: entry (123), ISSUES I28 closed, manifest rows X2–X6 (`mapgen/extractions/MANIFEST.md`; the dig-123-era `mapgen/extraction bank (X48–X57)*.asm` + `mapgen/extractions/ (X2 bank) — …` copies mirrored there). |
| C105 | **The fnB walk-call FRAME-SLOT law — the walk's 10 stack args mapped to fnB locals + the walk's per-point exit-gate law (dig #126, I29 Stage 2 + A1/A3 collapse)** | Reads: `builder-8EE000-8F3700.asm (X2)` fnB walk-call region 0x8eff90..0x8f0703 + `fna-102.asm (X10)` walk fn 0x8eec70..0x8ef86c, both this session; consts via `mapgen/extractions/dig126-constdump.mjs (X62)` (the const-verifier's `readConst`, exe md5 = C13). **(a) The push frame @0x8f06b9..0x8f0703** (10 stack words, `add $0x28,%esp` after the call): arg1 `[walk+8]` = `[−0x13c]` the field shell (dims via `[+0]/[+4]` @0x8ef0f0) · arg2 `[walk+0xc]` = `&−0x134` the start point `{x,y}` · arg3 `[walk+0x10]` = **`[−0x104]` = the CURSOR** = per-iter `lerp([−0x140], [−0x10c], u)` @0x8effc1..0x8effe3 where per-iter **`[−0x140] = cfg[+0x3c]`, `[−0x10c] = cfg[+0x40]`** @0x8eff98..0x8effaa (C52: the **cave_strength min/max pair**) then the case-B lane jump-table factor (@0x8f02e0's 6 arms: lane 3 = 0.4u+0.1, lane 4 = 0.25u+0.75 consts `0x11dfa40`/`0x11dfbf0`→`0x11df9d0`/`0x11dfb2c`, lane 5 = 0.13u+1.07 consts `0x11df990`/`0x11dfc20`; lanes via `mulsd 0x11e05f8` = f64 −3.0 → `3 − trunc(−3u)` ∈ {3,4,5}, `ja` arm = dead) applied `mulss −0x104` @0x8f0396 ⇒ **the port's `cursor`-arg wiring is CONFIRMED** (case-A re-lerps `[−0x140]/[−0x10c] = [−0x128]·∓0.01` first @0x8f0008/0x8f0023 — [−0x128] = w, consts 0x11e0560 = f32 −0.01 / 0x11df8e8 = f32 +0.01 · arg4 `[walk+0x14]` = `[−0x10c]` post-budget-section = **scale0 = 0.5u+0.5** @0x8f03cc..0x8f03e7 — **DEAD arg**: the walk never reads `[ebp+0x14]` (only the child re-pass @0x8ef804) ⇒ the port's dropped scale draw = byte-equal · arg5 `[walk+0x18]` = **`[−0x110]` = the BUDGET** = `lerp(0.15S, 0.96S, u)` (@0x8f03b3..0x8f043f: `[−0x148] = S·0.15f (0x11df99c)`, `[−0x140] = S·0.96f (0x11dfbc8)`, then the draw lerp; `[−0x15c] = S = (float)([−0x138] − edi)` @0x8f03df) with the flag=1 override `lerp([−0x15c]·0.45 (0x11dfa5c), [−0x140], u)` @0x8f053f..0x8f058d — the port's 0.15/0.96 + the flag=1 0.45 override CONFIRMED · arg6 `[walk+0x1c]` = `[−0x100]²` (the d0² jitter; `[−0x100] = 2u − 1` @0x8f0452..0x8f0462; clobbered per-point by the re-jitter @0x8ef6de, sign-flipped to the child @0x8ef7ba xorps `0x11e0c50`) · arg7 `[walk+0x20]` = **`[−0x120]` = the Y-DRIFT** = `0.4u + 0.1` (consts `0x11dfa40` = f32 0.4, `0x11df974` = 0.1) `+ 0.5` on the ⌊101u⌋ < 33 coin @0x8f048d..0x8f04b3 — **completes A3: the drift slot = [−0x120], NOT the (102)-era predicted −0x10c candidate** · arg8 `[walk+0x24]` = `[−0x148]` = the GROWTH = `u + f32[0x11df874]` ( = **0.0**, the dead addend @0x8f04d8..0x8f04e0 — the port's "+0.0 dropped" ✓) with the two u·101 < 50 coins (zero @0x8f0656, square @0x8f0684) · arg9 `[walk+0x28]` = `&−0x124` = the SHARED child-counter pointer (the whole walk loop's shared cell; the child-gate reads `*cell > 0` @0x8ef6e9, the child spawn restores `decl` @0x8ef79e) · arg10 `[walk+0x2c]` = `cfg[+0x24]` = **spawn_percent** (the spawn-lane's comiss vs 0 + `[−0x58]/[−0x64] ≥ 0` gates @0x8ef38e..0x8ef3af; [−0x58] = the 19-char "spawn_small_enemies" attr value @0x1173110/0x13, [−0x64] = the 11-char "cave_childs" @0x1173124/0xb). **(b) The walk's per-point EXIT-GATE @0x8ef109** (`movss 0x10(%ebp),%xmm7; comiss %xmm7,%xmm3; jae 0x8ef85d`): per the internal `comiss` mapping VERIFIED twice this session (the setter's `write iff cell > value` @0x8ee7b2+jbe, and the clamp01 top @0x8ef357+jbe — AT&T `comiss src,dst` ⇒ Intel dst,src, flags = dst vs src, jae = CF=0 = dst ≥ src) ⇒ **exit iff `xmm3` (the previous point's clamped value v) ≥ `arg3` (the cursor)** = **carve-while-v < cursor, stop when the value reaches the cave_strength** — the walk's value dynamics (slot = 1 − lane, roll = 0.35u − 0.25 → v decays 1 → 0.23 over t = steps/budget, with the 0.2-band's lane rising from v_prev toward the cursor) make the LONG/budget-length walks real only when the cursor ≥ ~1 (cave_strength upper range); **the port's walkChain has NO such exit ⇒ the port's walks are uniformly budget-length = a real port divergence (the d-sim: mode M1 med=1 stamp at C = 0.3/0.55 vs the port's budget-length)** — the count-test fix = dig #127. **(c) [dig #122 refuted (cosmetic)]:** the child call passes the parent's `[0x10]/[0x14]`-pair args UNCHANGED in the same slots (@0x8ef804..0x8ef81a — write order 14-then-10 to per-slots, NO argument swap). **(d) The t = steps/budget te` the loop: budget-slot xmm1 = `[ebp+0x18]`; the walk's own exit = steps > budget @0x8ef857-59 (comiss xmm1, jbe → back-edge 0x8ef0d0) ✓ the port's. **(e) PORTED dig #127 (I30 closed)**: both laws landed in `caves-field.mjs` walkChain (the vPrev carry = the exit-gate comparator AND the t<0.2 band's lerp base; first-iteration v_prev = 0 ⇒ the gate can never fire there) — count-tests: the census low-cursor median 1 vs the no-exit control 32 / murmur(carve ≤ 10 cells) 120/150, the band-1 2nd-stamp center pin (0; old law 0.8775), the PREVIOUS-value gate pin; all 3 FAIL under the old law (git-stash runs). No new constant ⇒ **C106 NOT minted** (the laws unchanged; only the port caught up). Sources: entry **(127)** + (126), manifest X2/X10/X62. |
| C106 | **The ART-LANE / shipped-form law (dig #129, game-data census X63)** | the surface band's visible crust = the per-chunk `LoadPixelScene` lane: **256 callsites / 141 unique scenes** over `<unpak>/data/scripts/biomes/**/*.lua` (positional call `(scene_png, visual_png, x_expr, y_expr, background, clip?…)`); **the SHIPPED form = `biome_impl/spliced/<name>` — folded `.plz` material buffers + a placement XML with explicit `pos_x`/`pos_y`** (e.g. `spliced/mountain_lake.xml` `pos_x="2560" pos_y="0"`, `material_filename="data/biome_impl/spliced/mountain_lake/0.plz"`) ⇒ the compositor reads the xml/plz placement directly (no Lua x/y-expression resolution for the spliced family); scene resolution classes: 239 literal / 4 spliced-shipped / 2 Lua-concat (statically unresolvable, never "missing") / 11 unresolved over 10 unique paths (mountain hall_2–4 family + endgame2 + mountain_lake_top + temple/altar_top_boss_arena) recorded w/ per-file lines. Completeness rule: a complete game ships complete assets — the shipped form + per-line receipts decide, never a bare stat. Source: census X63 (`artlane-2026-10-13.json`, md5 = the manifest row; instrument `mapgen/experiments/2026-10-13-artlane-census.mjs`), the dig's own game-data read. |
| C107 | **The surface-lane compositor wire (dig #130, I32 p1)** | the noise band's ground = per-cell `<Materials>` classify: field ≤ 0.5 ⇒ air (null/transparent); field > 0.5 ⇒ `classify(table, x, y, v)` (0x8f5030, surface-level.mjs:270) at the **C76 frame** (x = canvas px, y = canvas py − 24576) → the **materials.xml `wang_color`** of the matched component (colorize.mjs `materialColorByName`, name→RGB from the game's own materials palette); unclassified solids keep the band shade (0x1b1b1b/0x6a5a44) as the honest fallback. Output contract: `noiseChunkMask` returns `{mask, def, matIdx(255=air), matNames}`; probes `world.noiseMatAt`; paint `noiseColor(..., rgb-first)`. Verified on the hills band (seed 78633191, ty 60..64 × tx 30..45): 857 distinct wang_colors; crust column = air → classified bands. Not claimed: the carve architecture (I31/I29-2/I21). Source: entry (130), the count-test (`tests/mapgen/surface-compositor.test.mjs`). |
| C108 | **The read-window law (dig #131, I32 p2a)** | the caves field reads in the **WORLD frame** (C80: wx = canvas − 17920, wy = canvas − 31744 = the band origin at biome row 14): the getter 0x9499f0 (dig #121) **bounds-checks — zero width above the band origin (negative world rows)** ⇒ the sky band bty 1..13 reads NOTHING and paints air (the field repeats mod fh/fw at/below the origin; at/above origin-ty the lookup is value-identical to the pre-#131 wrapper — the ty62 pin = 2409 classified cells unchanged). The old wrapper's `gy % 256` read CONSTANT rows (5/125/255) in EVERY chunk — the terrain-fills-the-sky defect. Source: entry (131), the read-window count-pin (`tests/mapgen/surface-compositor.test.mjs`), the chunk-window audit this session. |
| C109 | **The per-area background law (dig #132, I32 p2b)** | a procedural biome's AIR = its Topology `background_image` art, tiled in the chunk frame behind the terrain (hills = `weather_gfx/background_cave_04_alt.png` 512×256; coalmine = `background_coalmine.png`; the_sky = `""` ⇒ transparent air — its pale-blue = the row-0 template lane). Wire: `backgroundImage` parsed per def; `ensureBiomeBackdrop` loads {w,h,pixels} once per def; `world.bgImageAt` tiles chunk-frame; `worldColorAt`'s air path composites. The game's true parallax/multi-layer + the in-game sky-blue source = OPEN. Source: entry (132), the data reads (hills/coalmine/the_sky.xml this session). |
| C110 | **The SKY/Hell layer law (dig #133, I32 p2c)** | the world's vertical composition: **the sky = ONE backdrop (the parallax gradient `weather_gfx/parallax_background.png` 256×256: the blue top (102,169,199) → the warm horizon (254,206,109); + `star_007.png` = the star sprite, hash-placed) for EVERY world row above the datum (canvas py < 31744 = the chunk ty < 62), up to the Heaven end (the Work = beyond the canvas top)**; the template lane's art (the mountain/hills LoadPixelScene pieces, the moon, the spliced scenes) paints OVER the sky; the area-bin lane never paints the sky band (the_sky's bin = the void black; the extension's airDark = superseded); **the per-biome background_image = the UNDERGROUND bands only (bty ≥ 14)**; **hell = the_end.xml's `background_the_end.png`** (the hell band's air bg via the template lane = tagged OPEN). Source: entry (133), the data reads (parallax_background/star_007/the_end.xml this session), the sky-pin test (`tests/mapgen/surface-compositor.test.mjs`). |
| C104 | **The canon-audit instruments + the walk-window STREAM census (2026-10-12, digs #124/#125, I29)** | (a) **const-verifier** = `mapgen/experiments/2026-10-12-const-verifier.mjs`: for every `(value, VA[, width])` pair parseable from a C-row, reads the bytes **at the PE section-mapped file offset** of the live `noita_dev.exe` (md5 must equal C13) and compares under the declared width (or both f32/f64 when ambiguous). **Mapping law: `.rdata` file = VA − 0x400E00 (C57 exactly), `.data` file = VA − 0x401A00 — the flat C57 rule does NOT extend to .data**; `.data` VAs beyond RawSize = BSS = **runtime-poked by design → not statically verifiable** (C47's CE canvas pair sat there — the verifier classifies such cites RUNTIME instead of silently reading past-raw zeros). **First-sweep verdict (98 rows, 2026-10-12): 131 MATCH / 0 genuine MISMATCH / 5 RUNTIME / 5 CODE / 3 sign-ambiguities verified CORRECT by eyes** ([0x11e05f8] = f64 −3.0, [0x11e0610] = f64 −5.0, [0x11e05a8] = f32 −1.0 — the first parser pass dropped signs near "±"-phrasing — tool bug, not canon error). Coverage: ~18 rows carry parseable float pairs; the rest = structure/law rows — stage-2 eyes-sweep continues. JSON: `mapgen/out/canon-audit-2026-10-12.json` (gitignored). (b) **the citation sweep**: ~100 `/tmp` citations converted to manifest bank rows X1–X61, every row digest-verified vs disk (2026-10-12); registries carry ZERO /tmp citations. (c) **link-check: 96 extraction cites — all resolve + registered.** (d) **the walk window STREAM census (dig #125 — X10 0x8eec70..0x8ef903, the walk fn 0x8EEC70):** the per-point scheme = **3 always** (the value roll @0x8ef24b; bias gate 1 @0x8ef433; bias gate 2 @0x8ef4db — both ×101/25 coins) + conditional {**D2-arm** @0x8ef2f9 — gated by the prologue 50% coin @0x8eecc1 ([−0x70] = its outcome slot), **the growth-counter roll** @0x8ef6c0 — the counter [−0x48] increments per point @0x8ef628; its >50 gate = `cmp $0x32; jle 0x8ef6e3` @0x8ef631 — the taken branch draws the growth u @0x8ef66a (2⁻³¹ cvt) then comiss vs the growth arg [ebp+0x24] @0x8ef6b9 → taken ⇒ ANOTHER draw @0x8ef6c0 (2.0u−1.0 compose → 0x1c(%ebp) @0x8ef6ce-0x8ef6de = the ±1 re-jitter) and the counter resets @0x8ef6cb — ALL inside the taken path (the port's model = already byte-faithful; confirmed metric-identical), **the 2%-child-gate draw** @0x8ef71e (×100 vs 2.0 @0x8ef774-0x8ef780), **the child-budget draw** @0x8ef7c6 (×50−50), **the child SELF-RECURSION call** @0x8ef823 (the fetch: `call 0x8eec70` — the walk recursively calls itself with decl'd shared counter @0x8ef79e; the child's OWN iterations then draw recursively)}; and the **spawn-lane** (D3 gated draw @0x8ef3b3 + D4 ×101 coin @0x8ef3cf → cmp $0x5f/cmovl → **the 0x8EEAD0 scatter call** @0x8ef3f9 — no stream draws inside the scatter beyond its already-cited span roll) gated by the `[−0x58]/[−0x64] ≥ 0` spawn-key pair. **NOT consumes:** the 3-segment lane/radius envelopes, the y-drift **`y += arg[ebp+0x20]`** @0x8ef389 (NO draw — the drift is a frame VALUE from fnB's walk-call push frame @0x8f06b9..0x8f0703 = fnB slots {−0x104, −0x10c, −0x110, −0x100², −0x120, −0x148-coef} — I24's remaining question = the slot identity), the x-clamp, the ±1/±2.5 laws, the 0.3/0.6/0.32 bank reads. **(e) the STREAM-TRACE instrument**: `buildCavesField`'s `meta.streamTrace = {walk, loopB, loopC, records, l2, l3, budgetCheck}` — the phase-partition invariant (Σbuckets == the raw next() count) is a TEST (caves-field.test.mjs, dig #125); /verify asserts it; IoU interpretation requires budgetCheck="byte-law" per lane (A1's micro-merges now marked). Sources: entries (124)/(125), I29, C57, C101(a); manifest X10/X2. |

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
  (xmm0 f32 in → float out → cvttss2si). **[SUPERSEDED (113): the body
  has NO fistp — 0x44d0b0 = the CRT floor wrapper (cvtss2sd → fldl
  → fstpl → MSVCR120.dll!floor → fstpl → cvtpd2ps), IAT slot 0x114a534
  hint 1646; fldl/fstpl = arg marshalling only. The VA-convention
  point (slab print 0x4c8b0 → true 0x44d0b0) is unaffected. See C92]** Also corrects canon C20: its
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
  **[SUPERSEDED (113): the helper = the CRT floor wrapper, not a
  fistp round — C92 (the VA-convention resolution stands)]**

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

### C33 — the biome-def DECOR classifier **true 0x8F5030** (slab 0x4f4830; VA fixed dig #85/ISSUES I18 — the old 0x8f4830 = slab+0x400000, byte-checked: prologue at 0x8F5030, 0x8f4830 decodes mid-instruction, and this fn's internals 0x4f4919/0x4f4960/0x4f4f3b map into 0x8F5030..0x8F5754 only with +0x400800)
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
- **(85) OVERTURNED:** the "ZERO non-assert refs" claim was a
  scan-scope artifact (text.bin excludes lower .text — C57). A
  full-file imm32 scan = **15 code refs per attr name** (push sites,
  first @file 0x9624f.. = true 0x496e4f..) and the parse walk binds
  every name to a slot — full 38-pair map = **C58**; it also confirms
  the swap note above: mMultiplierGradient → **+0x264**,
  mMultiplierPerlin → **+0x268**, ExtraPerlin → +0x26c. (Original
  claim kept: attribute names in .rdata = doc-strings only;
  whole-exe imm32 scan = ZERO non-assert refs — WRONG, see above.)
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
    **[SUPERSEDED (113): `c0 = 57.0·floor(y) + floor(x)` — 0x44d0b0 =
    the CRT floor wrapper (MSVCR120.dll!floor, IAT 0x114a534 hint
    1646, NO fistp); 57.0 pin unaffected. Formula re-derived byte-exact
    in the port dig #113 — see C92]**
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
  instruments' gate (the shape/validation contract, distilled in
  VERIFIED.md §12).

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
  - multi-blob scatter engine true **0x8EEAD0** (slab 0x4ee2d0; VA
    re-pinned dig #81 — fn A's prologue abuts it at 0x8EEC70).
  - blend twins: float-grid `dst += v·(src−dst)` true **0x8EF870**
    (slab 0x4ef070); byte-grid copy true **0x8EF950** (slab 0x4ef150).
- rdata pins (byte-read from rdata.bin, .rdata rule; trust anchored by
  re-reading 0x11df988 = 4.656612875e-10 = the C1 canon constant):
  **[dig #126 amendment: the "100.0 f64 @0x11dffe8" label slip below
  — the byte = 101.0 f64 (const-verifier + C53's own 101.0 note; the
  editorial value unchanged)]** ·
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
  - (b) partial: scatter true 0x8EEAD0 draws 1 poro Next, rolls a
    point inside the range (x = trunc(v·−0.5 @0x11e058c) + trunc(−v·0.5)
    lanes), bounds-checks, gates on cell < 0.5 (canon 0.5 @0x11dfa94)
    and recurses into true **0x8FAFC0** (slab 0x4fa7c0) with
    (y-int, x-int, value) — 0x8FAFC0 = the OPEN worm-branch body.
- Status: READ (structure) — NOT ported (no-guessing mandate; the
  named sub-reads = falloff block + 0x8EEAD0 + fn B worm/surface
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
  `mapgen/extractions/worm.asm (X16)` = the scatter/recorder family dump
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

### C49 — the pinpoint pickup v5.2 results (seed 91 + 92, about-math (48))
- **[P+0x8c] = THE RAW WORLDSEED — runtime-pinned byte-solid on BOTH
  seeds**: the 16-byte window at P+0x80 reads as {begin, ??, cap??
  (heap ptrs 0x34D21E30/0x34D220AC/0x34D33BF0 on 91)}, with the FOURTH
  dword [P+0x8c] = **0x04AFD8E7 (seed 91) / 0x04AFD8E8 (seed 92) = the
  raw worldseed exactly** — C27's `[obj+0x8c] = raw seed` confirmed
  in-memory per-instance. ([P+0x94] = the ×5·w toucher, C48 ✓, unchanged.)
- **[P+0x34]/[P+0x74] live knobs (both SEED-IDENTICAL across 91/92)**:
  the hills-class 512×256 struct carries **[+0x34] = 0.546875** and
  **[+0x74] = 1.549988** (f32 both; the second ≈ hills.xml's
  strength_max 1.55 family = `mountain_rock`/`skull_mountain`'s
  strength 1.45..1.55 — a REAL per-biome template-knob pair, NOT
  pointer-reinterprets: seed-independent across two seeds at the same
  deltas).
- **[P+0x2c/0x30/0x38] = pointer slots** (heap ptrs 0x2A1D2C88,
  0x2A6F9C78 etc; the seed-92 family shifts to 0x611000*/0x2A-series)
  — the C31 SetSize-family vectors, NOT knobs.
- **[P+0x58] deref = the art-byte allocation is REAL and per-grid**
  (differing heap pages per seed: 0x2C3A7FB8 / 0x4E34C010 /
  0x29E64430 / 0x38053020), first 64 bytes ALL-ZERO on both seeds (the
  byte-lane's top rows = "unmarked/air" in the decode, not an identity
  artifact).
- **the std::map @0x132aae8 LAYOUT cracked**: MSVC x86 RBTree node =
  {_Left(0), _Parent(4), _Right(8), color/isnil(0xc), 
  key(std::string, SSO-union @0x10..0x1f), size@0x20, cap@0x24,
  **value (the cage-grid ptr) @0x28**}. The keys = the CaveStructure
  IMAGE FILE-PATTERN strings **byte-visible in the dumps:
  "l__EMPTY_"/"l/_EMPTY_" + "ways_zer"/..." and
  "e_0$[1-4" (= the eye_0$[1-4].png-class pattern!) — so the cache's
  key = per-CaveStructure name, the map = the STRUCTURE FILE's
  generator cache; the value dword = the cave GRID POINTER for that
  pattern (0x2A1DC9A8 / 0x46F7DB78 ✓ at both seeds - byte-consistent
  with the SAME uid's [uid+0x1d4] reads).
- **the A-resolver fn ptr FOUND (the V4d hunt resolves)**: on the
  zero-dim (0x0-run) bitmap_noise uids the **[P+0xb0] = 0x008EE1B0**
  (a real code fn; first32 `55 8B EC 6A FF 68 CC 49 0A 01 ... 33 C5 ...
  64 A3 00` = a proper fn entry: push ebp/mov esp,ebp + a32-bit
  cengser-class hook) — the resolver body = the NEXT objdump read (the
  C32 A-channel's config-side consumer's fn body @true 0x8EE1B0).
- the world grid's [P+0x94] = a LATER poro draw per-run (-96244.1719
  seed-91-run2 vs the C48's -56909.828125): the +0x94 draw state
  ADVANCES per build call — the C27 'ONE draw' chain is per-cctor, and
  repeated ctor invocations stream forward (per-INSTANCE, not
  per-(seed,name)-reset).
- the 1×1 placeholder P = **0132B518 STATIC** across uids AND runs (a
  never-initialized static head; all the 1×1 noise-uid lookups point at
  the SAME struct), while the real grids alloc per (seed, name).
- Pinpoint artifacts: `out/oracle/CE_PICKUP_v5_2_seed91_92.txt`
  (both pastes verbatim).

### C51 — the CaveStructure RECORD walk (fnB load phase; 2026-09-21 digs 55–61)
- **fnB's "loader pair" 0x533860 / 0x5bff80 / 0x5bffb0 = the RECORD-ARENA
  allocator** (engine alloc `call *0x114a34c`; slot init `edx = 0x80` via
  0x651a60; the vector grow/copy pair = 0x5bff80/0x5bffb0). NOT image
  loaders — the dig #27 phase-map label corrected. **`push $0xe00` (3584 B)
  RE-FLAGGED (dig #81): it is neither 128×28 nor a multiple of 60 (÷60 → 59
  remainder 44) — do not relabel until re-read.**
- Per CaveStructure record (**the 60-byte member — dig #81 correction**;
  4-B header + 24-B image_file SSO string at +0x04 + 8×4 fields, ending
  exactly at +0x3c; the record dispatcher = true VA 0x4ABD60, class
  `"CaveStructure"` @0x117bf0c, arm rule = key imm +0x16 → store):
  - **COUNT pair** read at **[obj+0x1c] → [−0x120] / [obj+0x20] → ecx**
    (@4f09cf..4f09d5: `mov 0x20(%eax),%ecx; mov 0x1c(%eax),%eax; mov
    %eax,−0x120(%ebp)`; dispatcher stores `mov %eax,0x1c(%esi)` @4abe0e
    / `0x20(%esi)` @4abe3c; keys count_min 0x117bf38 / count_max
    0x117bfa0). The old **+0x28/+0x30 slots OVERTURNED (dig #81)** —
    +0x28/+0x30 = aabb_min_y/aabb_max_y (this record's AABB lane).
  - **STRENGTH pair** read at **[obj+0x34] / [obj+0x38]** (f32) = the XML's
    **per-record strength_min/max** — byte-verified against hills.xml's 10
    CaveStructure records (cave_$ 0.55..2.15 · mountain_rock/skull 1.45..1.55
    · eye 1.45..1.55 · pit 0..0.65 · brush spans). The C49 CE knobs
    (0.546875 / 1.549988) = values of these slots per record; C50's
    "DIFFERENT struct" note resolves to exactly this struct.
  - **The roll — OVERTURNED dig #123 (→ C102):** `count = [rec+0x1c] +
    trunc(u·([rec+0x20] − [rec+0x1c] + 1))` — **UP from min** (the
    minuend = the count_min slot `[−0x120]` ← `0x1c(%eax)` @0x8f11d2;
    `mulsd 0x11e0578` @0x8f1266 forms the negative intermediate
    `−u·span`, which `cvttsd2si` @0x8f1272 + `sub %eax,%ecx` @0x8f1276
    SUBTRACT from count_min ⇒ min + trunc(u·span); u = the NEW state·2⁻³¹
    (stored back @0x8f1262 before use). Dig #61 read the sign at the
    mulsd AND the wrong minuend — "counts DOWN from max" dies;
    `test %ecx; jle 0x8f16f1` @0x8f1280 skips the record at count ≤ 0
    (zero draws).
  - **The write — NO-OP dig #123 (→ C102):** the `call 0x4ef150` =
    true **0x8EF950** happens, but the stencil gate `cmpl
    $0,0x5c(%ebx); je 0x8efa2d` @0x8ef977 is ALWAYS 0 on the
    ctor-zeroed template (fn870's dims gate `[temp+4] ≤ 0` @0x8ef888b
    fails first) ⇒ **no cell is ever written** — C49's "+0x58 first-64
    all-zero" = EVERY row ✓ (the [P+0x58] lane stays zero because
    records never fill it; the port's `bytes` plane is written only by
    the scatter 0x8FAFC0 B-recorder). Value compose = C50 inline
    (`subss/mulss/addss` @0x4f0e84..0x4f0eb7 = A + d·(B−A)) — runs,
    then the value is discarded.
  - Loop: `decl −0x120(%ebp)` + `jne 0x4f0a95`; record cursor `+0x3c`
    (@4f0f03 = the 60-B stride); record COUNT = the {begin,end} vector
    walk (`mov 0x80(%eax),%ecx; sub 0x7c(%eax),%ecx` @4f0989/4f098f,
    `je 0x4f0f36` if empty, `jb 0x4f09b3` @4f0f31) with magic
    **0x88888889 = the ÷60 form** (@4f0992..4f09a5 + 4f0f0f..4f0f2c;
    script-verified 60→1, 600→10, 3584→59 — the old ÷12 reading
    OVERTURNED dig #81); the vector = the config's `structures`
    member +0x7c..+0x88 (`lea 0x7c(%esi)` @4b17ed). The old
    "[obj+0x30] / [obj+0x98] per-record flags" reading OVERTURNED
    (dig #81): those are CONFIG offsets — **[config+0x30] =
    do_beginning_paths** (bool, `cmpb $0x0,0x30(%edi)` @4f0f3c →
    je 0x4f271e; store `mov %al,0x30(%esi)` @4b156c) and
    **[config+0x98] = the mLuaScript string SIZE** (string base +0x88;
    `cmpl $0x0,0x98(%edi)` @4f100f pairs with the assert
    `caves.mLuaScript.empty() == false` @0x11731a4 line 975 = a
    script-presence check, NOT a gate); the second bool
    `do_beginning_down` ([config+0x31]) is consumed at
    `cmpb $0x0,0x31(%eax)` @4f1da1.
- **true 0x8EE930 (slab 0x4ee130..0x4ee2c8) = the smoothstep LERP stamp
  writer** — the ONLY lowering-capable writer in the fnA/fnB census:
  per cell `v_out = (v_src − v_dst)·t + v_dst` (@0x4ee294..0x4ee2a3),
  the falloff t via `divss`-by-radius + the squared weight @0x4ee22a..ff.
  All blob-setter lanes push $0 = max-bleed raise-only; the scatter
  0x8EEAD0 (dig #81 re-pin) = the `< 0.5` empty-cell gate only.
- ⇒ **The caves-field carve (AIR) split, byte-resolved:** the float grids
  are lowered by (a) the **0x8EE930 LERP stamps** (fn A's stamp walk) and
  (b) the **C32 LoadFromImageData ±1.0 pass** (float −1.0 = the air
  candidate); the CaveStructure RECORD lane stamps NOTHING (dig #123 —
  the 0x8EF950 stencil is gate-skipped on the ctor-empty template,
  C102; the 2026-09-21 "stamps the BYTE grid" claim OVERTURNED).
  Corrects the C46 "blob-setter smoothstep twin" gloss.
- Status: read + pinned (2026-09-21); **corrections dig #81 (2026-09-22):
  60-B stride, count pair +0x1c/+0x20, ÷60 walk, config +0x30/+0x98
  semantics, scatter VA 0x8EEAD0.** Sources: ABOUT_MATH 2026-09-21
  (55)–(61) + 2026-09-22 (81); window `fnb.dis` (3551 lines) +
  `recparse.dis`/`recdisp2.dis` (dispatcher windows, adjust-vma
  0x4b1100 / 0x4ABD40); hills.xml data cross-check.

### C52 — the BitmapCaves "CavesSetup" CONFIG slot map (2026-09-22, dig #81)
- **Dispatcher = true VA 0x4B1410**, class `"CavesSetup"` @0x117c1cc
  (error push @4b187c; anchors: `"Config error ( "` @0x116b1c4,
  `" ) - SetValue( "` @0x116b1f8, `" ) - couldn't find the member\n"`
  @0x116b220). Getters: int 0x4448e0 · f32 0x444970 · bool 0x444850 ·
  string 0x445820 · presence 0x4447f0. Arm rule = key imm +0x16 →
  store. Window: `recparse.dis` (adjust-vma 0x4b1100).
- **Slot map (every store byte-read):**

  | slot | field | key imm (rdata) |
  | ---- | ----- | --------------- |
  | +0x00 | 4-B header (vtable presumed — not read) | — |
  | +0x04..+0x1c | name (SSO string; `add $0x4,%esi` @4b1472) | 0x116a8fc "name" |
  | +0x1c | **size_x** (dims w) | (getter @4b14c8 → `mov %eax,0x1c(%esi)`) |
  | +0x20 | **size_y** (dims h) | — |
  | +0x24 | spawn_percent | — |
  | +0x28/+0x2c | cave_count (min,max) | 0x117c350 / 0x117c368 |
  | +0x30/+0x31 | do_beginning_paths / do_beginning_down (bool `mov %al`, @4b156c/@4b158b) | 0x117c390 / 0x117c3b0 |
  | +0x34/+0x38 | surface_caves_count | 0x117c3dc / 0x117c47c |
  | +0x3c/+0x40 | cave_strength (f32) | 0x117c4c4 / 0x117c504 |
  | +0x44/+0x48 | cave_childs (@4b162a/@4b1649) | 0x117c544 |
  | +0x4c/+0x50 | surface_cave_childs (@4b1668/@4b1687) | 0x117c628 / 0x117c640 |
  | +0x54/+0x58 | mountain_count (@4b16a6/@4b16c5) | 0x117c658 / 0x117c66c |
  | +0x5c/+0x60 | mountain_size (f32, @4b16e4/@4b1705) | 0x117c680 / 0x117c694 |
  | +0x64/+0x68 | blob_caves_count (@4b1726/@4b1745) | 0x117c6a8 / 0x117c6c0 |
  | +0x6c/+0x70 | blob_caves_strength (@4b1764/@4b1785) | 0x117c6d8 / 0x117c6f0 |
  | +0x74/+0x78 | blob_caves_radius (@4b17a6/@4b17c7) | 0x117c724 / 0x117c73c |
  | +0x7c..+0x88 | structures vector (`lea 0x7c(%esi)` @4b17ed → `call 0x92ed80`) | 0x117c754 |
  | +0x88..+0xa0 | mLuaScript string (`lea 0x88(%esi)` @4b182f); **size @+0x98** | 0x117c760 |
  | +0xa0 | DEBUG_output_image string (`lea 0xa0(%esi)` @4b1861) | 0x117c76c |

  Layout closes exactly at +0xa0 (8×4 knob slots + the vector + the two
  strings). **dims = +0x1c/+0x20** — the same pair C44 byte-read on the
  consumer side (w[+0x1c]/h[+0x20]); the "+0x00/+0x04 = dims" census
  reading is OVERTURNED (grep: no VERIFIED row carried it).
- **Gate consumers (fnB):** `[config+0x30]` = do_beginning_paths read
  `cmpb $0x0,0x30(%edi)` @4f0f3c → je 0x4f271e (the post-record gate);
  `[config+0x31]` = do_beginning_down `cmpb $0x0,0x31(%eax)` @4f1da1;
  `[config+0x98]` = **mLuaScript.size** (`cmpl $0x0,0x98(%edi)` @4f100f
  pairs with assert `caves.mLuaScript.empty() == false` @0x11731a4,
  line 975) — NOT a second do_beginning gate (the old claim overturned).
- Status: CLOSED (2026-09-22). Source: ABOUT_MATH 2026-09-22 (81).

### C53 — fnB draw-budget formulas + loop→knob map (2026-09-22, dig #81)
- **loop→knob (byte-shown):** loop A count = `mov 0x2c(%eax),%esi; mov
  0x28(%eax),%edi` @4ef701/4ef704 = **cave_count**; loop B count =
  `mov 0x58(%eax),%esi; mov 0x54(%eax),%edi` @4eff36/4eff39 =
  **mountain_count** (the linchpin: phase 1 = the MOUNTAIN lane); loop
  C count = `mov 0x68(%ecx),%eax` @4f05a0 / `mov 0x64(%ecx),%eax`
  @4f05a9 = **blob_caves_count** (phase 2 ✓). Port: `blobPhase1` now
  rolls `mountainCountMin/Max` (dig #81 regression test pins it).
- **L2/L3 literal counts (NOT yet ported):** per pass = **120 + ⌊81·u⌋**
  (ecx = 0x78; `mulsd 0x11dffd8` = 81.0 @4f1518 (L2) / @4f1f09 (L3)
  after the negative-scale `mulsd 0x11e0578` @4f1510 / @4f1f01; count
  stores −0x118 @4f1542 / @4f1f33; re-rolled every pass). **L2 = exactly
  2 passes**: counter at −0x10c, `inc %eax` @4f1d8b, `cmp $0x2,%eax`
  @4f1d92.
- **Gate family** = `trunc(u × 101.0) < K` ⇒ P = K/101 (101.0 @0x11dffe8):
  33 (`cmp $0x21`) @4efc9e · 10 @4efd21 · 20 @4efe01 + 4f02f5 ·
  50 @4efe51/4efe7c/4f04ad/4f12d1 · tail 5 @4f1c6b/4f2609 · 95
  (`cmp $0x5f`) @4f1d2d/4f26cb. mulsd sites: @4efc92/4efd15/4efdf5/
  4efe45/4efe68/4f02e9/4f04a1/4f12c5; movsd loads @4f1c47/4f1cba/
  4f25e5/4f2658; 11.0 @4f024f.
- **Loop-B X-roll window (@4f00ad..4f00e9):** inline Schrage Next
  (magics 0x834e0b5f/0x1f31d/0xb14/0x41a7 at (%edi)) → span =
  [−0x128]−9 = W−9, base ecx = 5, `mulsd 0x11e0578`, `cvttsd2si`,
  `sub` → **x = 5 + ⌊(W−9)·u⌋ ∈ [5,507]** → −0x134 @4f00e9; y-base =
  `cvttss2si xmm4` @4f00e5 → −0x118 @4f00f3 (**xmm4 provenance
  UNPINNED — blocks the loop-B inner-loop port**); mountain_size pair
  `movss 0x5c/0x60` @4f00ff/4f0104 → −0x100/−0x124; inner bound =
  base + 15 + ⌊11u⌋ (gates 20% @4f02f5 / 50% @4f04ad); setter
  `call 0x4ee130` @4f036d.
- Consts re-read from the exe (no chat carries): 0x11dfa94 = 0.5f ·
  0x11e058c = −0.5f · 0x11dfa00 = 0.32 · 0x11dfa1c = 0.35 ·
  0x11dff38 = 11.0 · 0x11dffd8 = 81.0 · 0x11dffe8 = 101.0 ·
  0x11e0578 = −1/2147483647 · 0x11df988 = +1/2147483647.
- Status: loop→knob CLOSED; L2/L3 budgets READ but NOT ported; loop-B
  inner structure BLOCKED on xmm4. Source: ABOUT_MATH 2026-09-22 (81).

### C54 — the surface-band consumer-chain VA map (dig #83, 2026-09-22)

The per-cell chain, byte-read from fnb/text disasm + objdump windows
this session (slab→true per C13; no port code touched):

- **sampler true 0x90d860 = slab 0x50d060..0x50d60d** — per-cell
  inner-x (→0x50d104) / outer-y (→0x50d0f3) loops; exit = `lock xadd`
  ref-release @0x50d5dd → ret @0x50d60d.
- **Gate @slab 0x50d3a5..0x50d3d0:** `ecx=[ebx+0x18]` (the owner) →
  `eax=[ecx+0x9c]` (row width) → `add ecx,0xb4` → `call slab 0x5491f0`
  (thiscall on &owner+0xb4, idx = y·[owner+0x9c]+x) → `movss (%eax)` →
  `comiss 0.5f [0x11dfa94]` → **`jbe 0x50d82b`** (≤0.5 = unpainted;
  C34's "[+0xb4] raw float field" byte-confirmed).
- **≤0.5 branch @0x50d82b:** val≤0 → skip (→0x50d5b8); 0<val≤0.5 →
  byte-grid write `ecx=[ebx+0x18]; eax=[ecx+0x188]; add ecx,0x1a0;
  call slab 0x54a1d0; movb $1,(%eax)` (stride [owner+0x188], member
  owner+0x1a0, idx y·stride+x).
- **>0.5 path @0x50d3d6..0x50d41e:** `eax=[ebx+0x20]→[*]→
  [config+0x1d4]` = **P** (null → je 0x50d82b); coords =
  `*[sampler+0x24/0x28] + local`; **warp slab 0x5084b0 (true 0x908CB0)**
  (C26 family) → floor **slab 0x4c8b0** → **wrap slab 0x5fdce0 (true
  0x9FE4E0) with ecx = P+0x20 — the dims live ON the P object** →
  idiv mod w/h both axes → `movzwl ax; dec ecx` = **id−1**:
  - id1>0 → `ecx=[owner+0x90]; call slab 0xb78e0` → cell (cached at
    [esp+0x28]);
  - id1≤0 → `[config+0x2a4]==0` → skip else **evaluator2 slab
    0x508670** → floor x/y (IAT `call *[0x114a434]` + slab 0xc33170)
    → `ecx=[config+0x2a4]; call slab 0x4f4830` (consumer; x_int,
    y_int, xmm3 = value).
- **consumer true 0x8F5030 = slab 0x4f4830 — biome_materials.cpp**
  (assert file 0x1173240): this = `[config+0x2a4]`; assert
  **`mInitialized`** ([obj+0x2c]≠0, line 0xfe); body @0x4f4910 =
  **range gate `[obj+0]≤v≤[obj+4]`** (f32 min/max) → `count =
  ([obj+0xc]−[obj+8]) ÷ 132` (magic `0x3e0f83e1`, imul + sar5 — exact
  for spans <10599; a SECOND ÷132 in the exe, cf. C35) → per-record
  walk @0x4f4a21 over **132-byte material records** (the RESOLVER
  TABLE family, ISSUES:101) → returns a cell.
- **paint dispatch @0x50d58d:** `[cell+0x38]` — **3** → slab 0x603fd0
  (bss u8 0x1344ce1); **1** → atomic 8192-slot intern (`lock xadd`,
  cap 0x2000, slot = count+1, value [tbl+idx·4+4]) → **planter slab
  0x363cd0** (base+x / base+y args = the material→world write,
  Phase-2 target); else → 0x50d60e.
- **driver true 0x908F40 = slab 0x508740..~0x508b67 —
  procedural_terrain.cpp** (assert file 0x1173a10): `config = call
  slab 0x5095a0` (28 callers exe-wide; the walk shares it) → kind
  dispatch `[config+4]`: **0** → both coords `addsd [0x11dfdd8]` =
  f64 0.5 → x+0.5/y+0.5, push config, **`call slab 0x50a060` =
  surfaceField — THE ONLY e8 reference in the exe** (ret true
  0x908F9B) → consumer(this = [config+0x2a4], x, y, value); **1** →
  assert **`biome->bitmap_data`** (`[config+0x1b0]≠0`, line 0xa6e);
  **≠1** → slab 0x5089c6. **Driver callers: (85) CORRECTED — the ZERO
  e8/e9 result was text.bin-scope only (C57); a full-file scan finds
  3 direct e8 → 0x908F40 (true 0x7930d3/0x7938d1/0x7938fe) + sibling
  0x793358 → 0x909370 = C60; capture CLOSED, the job-functor theory
  dropped; loop extent/y-range still OPEN (caller body unread).**
- **`BiomeHelper::Serialize` (biome.cpp) = the `[config+0x1d4]`
  filler** (dump A; strings 0x1173208 "Topology", 0x1173214):
  kind 2 → slab 0x4edc40 (true 0x8EE440) image load · kind 1 → slab
  0x4a0d80 (true 0x8AA580) → `[config+0x1b0]` · kind 0 → `[+0xc0]≠0`
  → slab 0x4f27f0 (true 0x8F2FF0) else **`[+0xb8]≠0` — the ctor
  default −1 takes this arm** → slab 0x4eda30 (**true 0x8EE230**) ·
  both-zero → the global default. Every arm has EXACTLY ONE e8 caller
  = Serialize itself (census this session).
- **true 0x8EE230 = a memoized BUILDER, not the math body:** this =
  &config+0xa8 as the cache KEY (`mov ecx,0x132a528; call 0x582bc0` =
  std::map FIND at .bss **0x132A528**) → hit: return `[entry+0x28]`;
  miss: push the **config+0x1d8 string** → slab 0x533580 (true
  0x933D80) → slab 0x3ebce0 (**true 0x7EC4E0 — BELOW the text.bin
  floor 0x801800: requires a lower-.text slice (file = VA−0x400C00);
  THE RAMP-GENERATOR CANDIDATE #1**) → assert (biome.cpp line 0x178,
  cond 0x1154820) → cache-insert. Global-default arm: init .bss
  **0x132B518** (1.0f props slab 0x52c240, 0 slab 0x52e050;
  `[0x132B518+0x94] = (int)@0x132B518 ×0.5 ÷0.1 [0x11df974]` = ×5, the
  C48 toucher form) + **0x132B538** → store &0x132B518.
- **Accessors (the checked idx→ptr family):** slab **0x5491f0 = f32** ·
  **0x54a0f0 = u16** · **0x54a1d0 = u8** (caller does the movss/mov/movb).
- **Painter (noise_utils.cpp, slab ~0x4F9731):** writes 1.0f to the
  field cell + a u16 id; the id comes from `lea ecx,[cfg+0xb4];
  call slab 0x5fdc50` (**true 0x9FE450**, next to C32's 0x9FE620) =
  refcounted-interface member → `vfunc+0x0c(out,out,key)` → slab
  0x440e0 → assert **`script_id < 255`** (0x11737c8, line 0x263),
  memoized. ⇒ `[config+0xb4]` = the RandomMaterials-side resolver
  INTERFACE (ISSUES:101) — a DIFFERENT class's +0xb4 than the sampler
  owner's float field.
- **Re-read bonus:** LERP true 0x8EE930 = slab 0x4ee130.. (prologue
  byte-located; tail `buf2 = buf1 + (target−buf1)·q²`, q² mulss
  @0x4ee233, accessors on member +0x18) · **C46 scatter body** (slab
  0x4ee2d0): assert `bitmap_noise` line 0x218 → ±0.5f [0x11e058c/
  0x11dfa94] → xorps [0x11e0c50] → cvttss2si → `call 0xc090c0`
  NextRandom ✓.
- Ctor slots (vtable 0x117e2c4) this session: +0xa0..+0xb4=0 ·
  **+0xb8=−1** · +0xc0=0 · **+0x1d4=0 (P)** · +0x1d8 string (size
  +0x1e8, res +0x1f4) · **+0x1e0=INT_MIN** · +0x1f8=−1 ·
  **+0x21c=INT_MIN** · +0x220=1.0f · +0x23c SSO (res +0x250) ·
  +0x2b0/+0x2b4=1.0f; dtor frees {+0x1ac, +0x1b8, +0x1d0} + the
  string ⇒ {+0x1d0 freeable-ptr, +0x1d4 P-ptr, +0x1d8 string} — the
  triplet ambiguity RESOLVED.
- Strings/bss new this session: procedural_terrain.cpp 0x1173a10 ·
  biome_materials.cpp 0x1173240 · `biome->bitmap_data` 0x1175088 ·
  `mInitialized` 0x118c9f4 · `script_id < 255` 0x11737c8 ·
  `bitmap_noise` 0x11730cc · `wang: ` 0x11730a0 · `Topology`
  0x1173208 · `BiomeHelper::Serialize - new BitmapNoise` 0x1173214 ·
  .bss 0x132a528 (P-cache map) · 0x1344ce1 (plant-gate u8) ·
  0x12ee538 (wang-log global).

Source: ABOUT_MATH 2026-09-22 (83).

### C55 — the evaluator2 + warp byte-recipe consts (dig #83)

- **evaluator2 true 0x908E70 = slab 0x508670..0x508737** (pure math;
  args a,b = x,y f64, c = the raw gate f32 in xmm2), all byte-read:
  `r = b·0.07 [0x11dfce8 f64] → f32`; `s = a·0.035 [0x11dfc98 f64] →
  f32`; `t = helper slab 0x4fc100(s,r) · 15.5 [0x11e01b0 f32]`;
  `q = (c − 0.5 [0x11dfa94]) · 0.5`; `u = (b_f32 + t) · 0.04892750
  [0x11df944 f32]`; `v = (a_f32 + t) · 0.04892750`; `w = helper slab
  0x4fc260(v,u)`; `res = c + q² · 5.35 [0x11e00b4 f32] · 0.95
  [0x11dfbac f32] · w`; **return = max(0.5, res)** (comiss-0.5/movaps
  @0x508727..0x508731 — §11's lower-clamp byte-confirmed).
- **warp slab 0x5084b0 (true 0x908CB0):** y += **[0x13289a8] f64**,
  x += **[0x1327670] f64** (.bss runtime pair = the C47
  "17920/7168 canvas/world offset" — SAME VAs); + **0.5 =
  [0x11dfdd8] f64** (bytes `000000000000e03f`; **f32 view = 0.0 —
  never read this VA f32**; the driver's pre-surfaceField addsd uses
  the same const); · **0.1 [0x11dfd08 f64]**; · **0.13717
  [0x11dfd38 f64]**; xmm1 argument = **1.0f [0x11dfbf0]**; floor via
  slab 0x4c8b0; out = (x′,y′) f32 pair.
- **Post-wrap floor (sampler):** IAT **`call *[0x114a434]`** (imported
  math) + helper **slab 0xc33170** (×2) — the C37 helper family
  (0xc33234/0xc33222 neighbors).

Source: ABOUT_MATH 2026-09-22 (83).

### C56 — the P fill chain, the C27-gen layout & the BiomeSpawnScripts overturn (dig #84)

Windows read verbatim this increment (text.bin slab-VA; lower2.bin =
file 0x3E9000..0x3EC400 `--adjust-vma=0x7E9C00` true-VA): fn1 whole
0x4EDA30..0x4EDC3F; fn2 call site 0x4F2EC8..0x4F2F1E; Serialize
dispatch 0x4F2E40..0x4F2F96; C27 ctor tail 0x4F8D00..0x4F8DBF;
evaluator2 tail + driver head 0x5086F0..0x50878F; builder tail true
0x7EC5C0..0x7EC66F; delegate fn true 0x7EB220..; ctor wrappers true
0x7EAAF0 / 0x85D1A0; clone body slab 0x680DA0.

**Serialize dispatch (slab 0x4F2E77..0x4F3030):**

- kind-1 pre-pass: `[cfg+0x1a8]≠0 && [cfg+4]==1 && [cfg+0x1b0]==0`
  → `lea ecx,[eax+0x198]; mov $1,%dl; call 0x4a0d80` →
  `[cfg+0x1b0]=ret` @0x4f2ebc ⇒ builder this = **&cfg+0x198**
  (corrects (83)'s "&cfg+0x1a8"; +0x1a8 = its ≠0 gate field).
- kind==2 (`mov 0x4(%eax),%ecx; cmp $2; jne 0x4f2f7d`): P set →
  done; else **fn2** (below) → store @0x4f2f08 → post-step:
  `[cfg+0xc0]≠0` → string copy `cfg+0x1d8 → [cfg+0xc0]+0x88`
  (self-guard) + int[ebp−0xcc] → f64 via {0.0, 4294967296.0}
  table → `call slab 0x523a0(&[ebp−0xbc])` → `call slab 0x4ef5d0
  (&local, [cfg+0xc0], P)` → end.
- kind==0 (0x4f2f7d): kind∉0 → done; P set → done;
  `[cfg+0xc0]≠0` → `push [ebp−0xc8]; call 0x4f27f0` → store;
  `[cfg+0xb8]≠0` → **fn1** (`push [ebp−0xb8]; lea edx,[eax+0x1d8];
  lea ecx,[eax+0xa8]` @0x4f2fc2..0x4f2fd4) → store @0x4f2fde;
  both-zero → 0x4f2fe9: ctx string **0x1173214 = `BiomeHelper::
  Serialize - new BitmapNoise`**, `call 0x259e40`, then `push 1;
  push 1; mov ecx,0x132b518; call slab 0x52c1e0` + `push 1; push 1;
  mov ecx,0x132b538; call slab 0x52e000` (**(83)'s 0x52c240 /
  0x52e050 corrected** — decoded from `e8 c4 91 03 00` @0x4f3017,
  `e8 d6 af 03 00` @0x4f3025).

**fn1 = slab 0x4EDA30..0x4EDC3F (true 0x8EE230..0x8EE43C), kind-0
arm (1 caller: Serialize @0x4F2FD4):**

- head: `edx → [ebp−0x1c]` = &cfg+0x1d8, `ecx → ebx` = &cfg+0xa8;
  cache = `push ebx; mov ecx,0x132a528; call 0x582bc0` (find, **KEY
  = the ADDRESS &cfg+0xa8**) → eq `0x3b600` → hit **`[iter+0x28]`**
  → return.
- miss @0x4edaac: `push [ebp−0x1c]` (hoisted string arg) → `call
  slab 0x533580` (argless, bss 0x1346CD8) → `mov ecx,eax; call slab
  0x3ebce0` → result → [ebp−0x1c]; **0x3ebce0 = __stdcall, 1 stack
  arg = the noise_type string** (fn2's twin pushes it immediately
  before the call; the earlier hoisted push belongs to the builder).
- null → assert: **fmt 0x1150f60 = `Assert failed: (%s) in %s at
  line %d\n`, cond 0x1154820 = `lua_manager`, file 0x1172ea8 = full
  path `d:\projects\nollagames\fallingeverything\build\vc12\..\..\
  source\procedural_utils\biome.cpp`, line 0x178 = 376**; bare +
  timestamped emissions (`a` 0x1151070, `log_asserts.txt`
  0x1151074, `%d, %d, %d - %d:%d\n` 0x1151084, tm year +0x76c, mon
  +1) → filter `call 0xc070c0` → fail = `movl $0x1ca9,(%eax)`
  @0x4edb7b (eax=0) = abort.
- build: malloc **0xB8** → `push [ebp+8]` (Serialize local −0xb8) →
  `call slab 0x4f8c70` (C27 ctor) → **`movl $0x8ee1b0,0xb0(%edi)`
  @0x4edba7 = true 0x8EE3A7** (A-resolver pin re-verified) → malloc
  0x10 temp `{[0]=0x119a2a0, [4]=1, [8]=0x7eb220, [0xc]=0x94obj}` →
  `call *0x24(%eax)` @0x4edbec = **clone (slab 0x680DA0: malloc
  0x10, copy {vtable, cnt=1, fn, ctx})** → **release-setter
  `[gen+0xb4]`** (`old=[edi+0xb4]; [edi+0xb4]=clone; if(old) push
  $1; call *(%eax)`) → temp released same → `push %ebx; call slab
  0x542970` insert → `mov %edi,(%eax)` → return gen.
- ⇒ **&cfg+0xa8 contents never read in fn1 — address = key only**
  (no mGradient consumption here).

**fn2 = slab 0x4EDC40.. (true 0x8EE440..), kind-2 arm (1 caller:
Serialize @0x4F2EFE):** args byte-exact `push [ebp−0xc4]; lea edx,
[eax+0x1d8]; push [cfg+0x1d0]; lea ecx,[eax+0x1b4]; push
[cfg+0x1cc]` ⇒ this = &cfg+0x1b4, w = [cfg+0x1cc], h = [cfg+0x1d0],
ctor-seed = local −0xc4. Body: `[this+0x10]` gate → grid = w×h
(IAT 0x114a358/0x114a35c + memset) + `call 0x4ecc90` (sole caller)
→ inline singleton @0x4edd19..47 (push 0x2c → malloc → ctor
0x7EC3B0 → [0x1346CD8]) → builder @0x4edd4f → assert **line
0x18d = 397** → same gen tail inlined → **SetSize+Load `call
0x4fa130` @0x4EDEBB (true 0x8EE6BB)** → `"wang: "` @0x4EDEE0.
⇒ (83)'s separate "biome.cpp setup (0x4EDE50..)" = **fn2's tail**.

**The 0x94-object = `BiomeSpawnScripts` (ramp OVERTURNED):**

- ctor wrapper true 0x7EAAF0 assigns **0x1154528 = `BiomeSpawnScripts`**
  (17 chars; neighbor 0x1154540 = `g lua spawn function: `) → real
  ctor slab 0x45C9A0 (true 0x85D1A0): vtable 0x119A724 → final
  **0x119EA60** (adjacent rdata 0x119ea6c = `GridWorldSprite::
  Draw`, unrelated neighbor), SSO strings +8..+0x1c/+0x20/+0x50,
  containers +0x3c/+0x44.
- populate true 0x7EB020 = walk of **map @[obj+0x8c]** (key dword
  [node+0x10], value [node+0x14]); error → `Lua error -
  AddScriptColor( ` (0x1154694) → bss **0x132B624**.
- memo builder true 0x7EC4E0(singleton, string): find value
  `[iter+0x28]` / miss `push $0x94; malloc; call 0x7eaaf0` → loop
  **[singleton+0xc]** stride **0x14**: `ecx=[cur+0x10]`, `cur+=0x14`,
  local string via `call 0x41d770(dst, (cur+0x14), 0, −1)` [arg
  semantics OPEN] → `push &local; push key; call 0x7eb020` →
  iterator++ 0x980450 → `call *0x8(%eax)` @0x7ec60c = **vtable
  0x119EA60 slot+8 → true 0x85D980 (key, 0)** → memo
  **[singleton+0x24]** (find 0x97aa70, eq 0x43be00, insert
  0xa52290/0xa52340, `mov %edi,0x28(%esi)`) → return obj.
- delegate fn true 0x7EB220 = stdcall `ret $4` map-get on
  [ctx+0x8c] → [node+0x14]/−1; class type-name getter slab 0x680E00
  → **0x12f2f40** = MSVC `_Func_class@…Job_GenerateParticleVertices…`
  ⇒ **`[gen+0xb4]` = cloned callback {fn 0x7EB220, ctx =
  BiomeSpawnScripts*} — C39's "B-map" corrected**.

**C27 gen ctor slab 0x4F8C70 (true 0x8F9470) = seed-RNG init only**
(`ret $4` @0x4f8dbd): four 0x20-B container blocks +0x00/+0x20/
+0x40/+0x60 (self-ptr @block+0x10), vector {0,0,0} @+0x80..+0x88,
**[gen+0x8c] = arg int**, **[gen+0x90] = 1.0f**, **[gen+0x94] =
f32(draw)×200000.0f − 100000.0f** after (double)(int) via
{0.0, 4294967296.0}@0x11e0ba0 + `comisd 2147483647.0 [0x11e0220];
jb; mulsd 0.5 [0x11dfdd8]` + 2×`call 0xc090c0`; SSO string +0x98
(size +0xa8, res +0xac=0xf); +0xb0/+0xb4 zeroed → fn1/fn2 tail
fills them. Size 0xB8. ⇒ no mGradient read anywhere in the chain.

**Boundary + census:** evaluator2 ret **0x508737** (C55 tail
byte-exact) → **int3 pad 0x508738..f** → driver prologue
**0x508740** (`call 0x5095a0` @0x50875c, `je 0x508b67` @0x508765,
`mov eax,[ebx+4]` @0x50876b; kind0 = addsd 0x11dfdd8 both + push
config; xmm1/xmm2 f64 pair + ecx = this). Callers: fn1 = 1
(0x4F2FD4), fn2 = 1 (0x4F2EFE), 0x4ecc90 = 1, C27ctor = 7
(0x4EDB9A/0x4EDE33/0x4F0B23/0x4F293C/0x5043EE/0x506B41/0x50C66C),
0x533580 = 5 (0x4EDAAF/0x4EE5C5/0x5074BE/0x50EDA0/0x50FECD),
0x3ebce0 = 10 (0x4EDAB6/0x4EDD4F/0x4EE5CC/0x4F0BCC/0x4F10BF/
0x5051F4/0x50681B/0x50760E/0x50765A/0x50EDA7). **imm32 text.bin:
0 hits for 0x00908F40 / 0x00508740 / 0x00908F9B — (85): imm32 stays
dead, but the "indirect-only" inference is OVERTURNED — 3 direct e8
callers byte-found (C60; the zeros were a text.bin scope defect,
C57); driver capture CLOSED, loop extent still OPEN.**

Question A frontier: **(85) SOLVED the write side** — the mGradient
writes = the parse-walk bind calls (C58, 38 pairs) and the wrap flag
closed (C61: wrap-this = P+0x20 = {w,h,u16vec,cnt}, the same bytes
both readings pointed at); the READ side (consumers of the ramp
slots +0x270..+0x29c) remains OPEN — surfaceField reads only
+0x220..+0x268.

Source: ABOUT_MATH 2026-09-22 (84).

### C57 — PE VA formula card + PE-native objdump method (dig #85)

- file = VA − 0x400C00 (.text) · slab = file + 0x400 = VA − 0x400800
  · true = slab + 0x400800 · .rdata VA = file + 0x400E00 · .data VA =
  file + 0x401A00 — C13's rules, re-derived this session from the PE
  section table (.text raw 0x400..0xd49200 @VA 0x401000 · .rdata raw
  0xd49200 @0x114a000 · .data raw 0xee9600 @0x12eb000).
- Standing method: `objdump -D -M att --start-address=<true VA>
  --stop-address=<true VA> noita_dev.exe` (PE-native, prints true
  VAs); hand slices need `--adjust-vma = file_off + 0x400C00`
  (parsebind2 0x49B800 ✓, defaults2 0x495D00 ✓; resolver.dis was
  −0x400: displayed 0x8ee243 = true 0x8ee643).
- **Scope warning: text.bin = file 0x400c00.. never covered .text's
  lower region file 0x400..0x400c00 = true 0x401000..0x801800.**
  Every "whole-exe = ZERO" in (82)/(83)/(84) was a text.bin scan;
  both halves re-scanned this session — the driver callers (file
  0x3924d3..) and every attr-name ref (file 0x9624f..) live BELOW the
  floor. Never conclude from text.bin alone.
- Source: ABOUT_MATH §6 (85).

### C58 — the surface-config XML attr → slot bind table (38 pairs, dig #85)

- Two-phase: names registered in cluster `0x496xxx` (mGradientStartY
  string VA first pushed @true 0x496e4f), then the **value-binding
  walk `0x49b887..0x49df7e`**: per attr `push $name_VA; … lea
  SLOT(%ebx),reg; call BIND`. **These stores = the mGradient/ramp
  WRITE side of question A.**
- Bind calls: string 0x9c4450 / 0x43a5a0 · bool 0x444700 · bool8
  0x444520 · f32 0x9c4560 · f64 0x9c6b00 · enum 0x9c8160 · other
  0x9c55b0.

| push (true) | attribute | slot | bind (type) |
| --- | --- | --- | --- |
| 0x49b887 | lua_script | +0x1d8 | 0x9c4450 string |
| 0x49b93b | pixel_scene | +0x1f0 | 0x444700 bool |
| 0x49ba92 | static_tile | +0x1f8 | 0x444700 bool |
| 0x49bb39 | static_tile_bg_mask | +0x1fc | 0x9c4450 string |
| 0x49bbd6 | static_tile_bg_mask_threshold | +0x214 | 0x9c4560 f32 |
| 0x49bc73 | game_enemy_hp_scale | +0x218 | 0x9c4560 f32 |
| 0x49bd20 | game_enemy_attack_speed | +0x21c | 0x9c4560 f32 |
| 0x49be78 | mInsideNoiseType | +0x224 | 0x9c8160 enum |
| 0x49bef9 | mInsideNoiseFBM | +0x228 | 0x444700 bool |
| 0x49bf76 | mInsidePerlinScaleX | +0x230 | 0x9c6b00 f64 |
| 0x49c00e | mInsidePerlinScaleY | +0x238 | 0x9c6b00 f64 |
| 0x49c087 | mInsidePerlinSquared | +0x240 | 0x444520 bool8 |
| 0x49c0d6 | mInsidePerlinClamped | +0x241 | 0x444520 bool8 |
| 0x49c121 | mInsidePerlinScaled | +0x242 | 0x444520 bool8 |
| 0x49c184 | mInsidePerlinScaleMin | +0x244 | 0x9c4560 f32 |
| 0x49c1fc | mInsidePerlinScaleMax | +0x248 | 0x9c4560 f32 |
| 0x49c269 | mInsidePerlinForceInside | +0x24c | 0x444700 bool |
| 0x49c2cb | mInsidePerlinOffsetBySeed | +0x24d | 0x444700 bool |
| 0x49c32d | mInsidePerlinOffsetX | +0x250 | 0x9c6b00 f64 |
| 0x49c38f | mInsidePerlinOffsetY | +0x258 | 0x9c6b00 f64 |
| 0x49c40c | mInsideAddValue | +0x260 | 0x9c4560 f32 |
| 0x49c4a4 | mMultiplierGradient | +0x264 | 0x9c4560 f32 |
| 0x49c53c | mMultiplierPerlin | +0x268 | 0x9c4560 f32 |
| 0x49c5bf | mMultiplierExtraPerlin | +0x26c | 0x9c4560 f32 |
| 0x49c632 | mGradientStartY | +0x270 | 0x9c4560 f32 |
| 0x49c6aa | mGradientEndY | +0x274 | 0x9c4560 f32 |
| 0x49c737 | mGradientSlopeStartX | +0x278 | 0x9c6b00 f64 |
| 0x49c7d9 | mGradientSlopeDelta | +0x280 | 0x9c6b00 f64 |
| 0x49c85b | mGradientAddNoise | +0x288 | 0x9c55b0 other |
| 0x49c8c3 | mGradientNoiseScale | +0x290 | 0x9c6b00 f64 |
| 0x49c936 | mGradientLowNoise | +0x298 | 0x9c4560 f32 |
| 0x49c9ae | mGradientHighNoise | +0x29c | 0x9c4560 f32 |
| 0x49ca1b | coarse_map_force_terrain | +0x2a0 | 0x444700 bool |
| 0x49ca7d | coarse_map_not_terrain | +0x2a1 | 0x444700 bool |
| 0x49cadf | coarse_map_cell_count_always_zero | +0x2a2 | 0x444700 bool |
| 0x49cb41 | coarse_map_inject_light | +0x2a3 | 0x444700 bool |
| 0x49cc79 | mDebugFilename | +0x80 | 0x43a5a0 string |
| 0x49df7e | Biome | +0x80 | 0x43a5a0 string |

- **Multipliers settled (C37 swap note / C43 CE correction): +0x264 =
  mMultiplierGradient, +0x268 = mMultiplierPerlin, +0x26c =
  mMultiplierExtraPerlin** — byte formula (gradCoef = [+0x264]) and
  names now agree; port: gradWCoef=[+0x264], perlinCoef=[+0x268].
- Ramp attrs: StartY/EndY +0x270/+0x274 · SlopeStartX/Delta
  +0x278/+0x280 (f64) · AddNoise +0x288 · NoiseScale +0x290 (f64) ·
  Low/HighNoise +0x298/+0x29c; ForceInside +0x24c = C37's slope
  flag; OffsetBySeed +0x24d; coarse_map ×4 = +0x2a0..+0x2a3.
- Gaps (bound nowhere in this walk): +0x1d4, +0x1e0..+0x1ec, +0x1f4,
  +0x200..+0x210, +0x220 (+0x220 HAS a C59 default but no binder —
  second walk? OPEN). +0x80 bound TWICE (mDebugFilename @0x49cc79,
  Biome @0x49df7e) under different `%ebx` contexts — identity OPEN.
  Binder `%ebx` vs defaults `%esi` object: slot-identical, instance
  identity not yet byte-linked (OPEN).
- Source: ABOUT_MATH §6 (85); dump `mapgen/extractions/binding_table.txt (X30)`.

### C59 — config defaults-init store block (dig #85)

- 52 `%esi` stores at true **0x495ebe..0x496195** (pre-parse defaults
  for the C58 object; fn continues past the block — `call 0x41df90`
  @0x49619f, string-init `lea 0x2c0(%esi)` @0x4961ab; fn start not
  pinned): +0x98/+0xc0/+0x100/+0x108/+0x10c = 0 · +0x9c/+0xfc/+0x104
  = 0 (b) · +0xa0 = 0x43610000 = 225.0f · +0xa4 = 1 (b) · +0xc4 =
  0x101 · +0xf8/+0x158/+0x15c/+0x160/+0x194 = 1.0f · +0x164/+0x16c/
  +0x188/+0x18c/+0x190/+0x1b0 = 0 · +0x168 = 1 (b) · +0x1cc/+0x1d0 =
  0x100 · **+0x1d4 = 0 (P starts null ✓ C54's null-P skip)** ·
  +0x1f0/+0x1f4/+0x1f8 = 0 · +0x214 = 0x3f000000 = 0.5f · +0x278 =
  f64 movsd · +0x218/+0x21c = 1.0f · +0x220 = 0 · **+0x224 = 5 (C43
  noiseType ✓)** · +0x228 = 1 (b) · +0x242 = 0 (b) · +0x244/+0x248 =
  0 · +0x260 = 0 · +0x264/+0x268/+0x26c = 1.0f · **+0x270 =
  0xc4000000 = −512.0f / +0x274 = 0x44000000 = +512.0f** · +0x280 =
  f64 movsd · +0x288 = 1 · +0x290 = f64 movsd · **+0x298 =
  0xc2c80000 = −100.0f / +0x29c = 0x42c80000 = +100.0f** · +0x2a0 =
  0 · +0x2a4 = 0.
- Default ≠ XML: the (82) Topology census (StartY −1024/EndY +1024,
  LowNoise −292/HighNoise 234) = XML overrides of these defaults
  (−512/+512, −100/+100) — both stand at their own layer.
- Bound-but-unstored slots (+0x1d8/+0x1fc strings, +0x230/+0x238 f64,
  +0x240/+0x241, +0x24c/+0x24d, +0x250/+0x258, +0x80): ctor-zero or
  set elsewhere — not claimed.
- Source: ABOUT_MATH §6 (85); dump `mapgen/extractions/defaults_vals.txt (X27)`.

### C60 — driver `0x908F40` direct callers (dig #85)

- 3 direct `e8 rel32` → 0x908F40, byte-verified (file byte 0xe8,
  rel32 resolves exactly): **true 0x7930d3** (main call), **true
  0x7938d1 + 0x7938fe** (45 B apart = the x∓1 probe pair); plus
  **true 0x793358 → sibling 0x909370** (second driver-family fn,
  body unread).
- File 0x3924d3 / 0x392cd1 / 0x392cfe / 0x392758 — all in .text's
  LOWER region (true < 0x801800), which text.bin never covered (C57)
  ⇒ why digs #83/#84 scanned zero.
- Capture CLOSED (job-functor theory dropped); **loop extent/y-range
  still OPEN** — next read = the caller body around 0x7930d3.
- Source: ABOUT_MATH §6 (85).

### C61 — sampler wrap call + the P+0x20 view (dig #85)

- Call site true **0x90dcce** (inside sampler 0x90d860): `mov
  0x28(%esp),%ecx; add $0x20,%ecx; call 0x9fe4e0` ⇒ wrap-this =
  **P + 0x20**, P = `[config+0x1d4]` = the BitmapNoise (C39 fill
  chain, C43 w260×h260).
- View: **w @P+0x20, h @P+0x24, u16 vec @P+0x38, cnt/gate @P+0x3c** —
  vec/cnt = C31's u16 wrapper ⇒ (83)'s "dims on P+0x20" and (84)'s
  "container block" = the SAME bytes; (84)'s "on the C27 gen" label
  corrected (the 0xB8 seed-gen with blocks +0/+0x20/+0x40/+0x60 is a
  different object). Corroboration: LoadFromImageData builds the same
  `+0x20` sub-view (`lea 0x20(%esi),%edi` → grid @edi+0x18, C62).
- Source: ABOUT_MATH §6 (85).

### C62 — LoadFromImageData value-store sites + getters (dig #85; EXTENDS C31/C32)

- **Do not re-register:** this IS C32's true 0x8f9ab0
  (BitmapNoise::LoadFromImageData). Body = **0x8f9ab0..0x8fa930**
  (prologue @0x8f9ab0; NO second `55 8b ec` in-span; next prologue
  @0x8fa930 = C39's wrapper) — the store block belongs to it.
- Stores: computed **f32 `movss %xmm0,(%eax)` @0x8fa15e** after `lea
  0x18(%esi),%ecx` @0x8fa106 → getter 0x9499f0 → grey formula
  (`addsd [0x11e0ba0(,%eax,8)]` → cvtpd2ps → mulss 0x11df8bc →
  addss×2 → divss 0x11dff70 = C32's grey ✓); **±1.0f twins
  `movl $0xbf800000`/$0x3f800000 @0x8f9f04/0x8f9f39**; **u16** via
  getter 0x94a8f0 (`mov %cx,(%eax)`) after `lea 0x20(%esi),%edi`
  @0x8fa162 → grid @edi+0x18.
- Getters = CSafeArray accessors {base@+0, count@+4} (csafearray.h
  0x117a570): **f32 0x9499f0 · u16 0x94a8f0 · u32 0x949f60**; assert
  `!( i < 0 || i >= _size )` @0x1179b74. Unit noise_utils.cpp
  @0x1173678, assert line 0x263 = 611, `script_id < 255` @0x11737c8.
- Callers (e8 rel32 byte-verified): **0x8fa99b** (inside wrapper
  0x8fa930 = its Load step), **0x905dd7/0x905f1e** (§11 F3's
  wang-out_map pair; enclosing fn unread).
- **③ aliasing:** sampler-owner lanes +0x9c/+0xb4/+0xd4 ↔ BitmapNoise
  +0/+0x18/+0x38 = three lanes exact under **owner = P − 0x9c** ⇒
  the gate target `owner+0xb4` IS P+0x18 — the wrapper written @
  0x8fa15e (explains zero install sites). **RESOLVED dig #86 (C65):
  layout equivalence only —** the gate reads the owner's EMBED
  (owner+0x9c = in-place gen), the wrap reads `[config+0x1d4]` = P
  (standalone); `kind2-esi == P` PROVEN, `P == owner+0x9c` FALSE as
  instances, and C34's +0x1e0 = owner-own decor grid (the "+0xf4"
  prediction's premise dissolved).
- Source: ABOUT_MATH §6 (85), resolution (86).

### C63 — A-resolver imm `0x8ee1b0` pin census (dig #85)

- Exactly 4 imm32 occurrences file-wide: **movl starts 0x8ee3a7**
  (inside fn1 0x8EE230) and **0x8ee643** (inside fn2 0x8EE440), each
  followed by a `+0xb4` store (**0x8ee3fb / 0x8ee694**) = C56's
  `{resolver@+0xb0, cb@+0xb4}` pair, one install per fill path;
  **`movl $0x8ee1b0,0x140(%eax)` imm @0x905ad3**; stack-local
  **0x64c7ab**.
- Label trap: resolver.dis displayed 0x8ee243 for the second pin =
  true 0x8ee643 (hand-slice adjust −0x400; use C57's PE-native
  method).
- Source: ABOUT_MATH §6 (85).

### C64 — ③/P1 ruled-out candidates (dig #85; do-not-re-dig)

- `0x12ec8b8` = **g_genome_herd_relations** (writers 0x592270 /
  0x5932f0, genomedata_component.cpp) — a genome table, not ours.
- Name→member dispatch **0x4f8857** = the invincibility_frames/
  falling_damages member class (ptr@+0xb4/bool@+0xb8/f32@+0xbc).
- Ctor null-inits (0x791c8e pair, 0x8f9565/0x8f956b) = zeroing, not
  installs.
- Classifier (C33, true 0x8F5030) refuted as the `[owner+0xb4]`
  writer — body bounded 0x8f5030..0x8f5754, zero member stores
  (refuted twice).
- No independent `owner+0xb4` wrapper-base install among the
  ③-region sites examined (ctor zeros + C63 config pins only). Fresh
  full-.text census (file 0x400..0xd49200, mod=10 disp32): 0xb4 →
  475 store-patterns / 91 loads / 761 lea; 0xb8 → 1060 / 846 / 710 —
  counts NOT individually re-examined ⇒ elimination is REGION-scoped,
  consistent with C62's aliasing (owner+0xb4 ≡ P+0x18 needs no
  separate install).
- Source: ABOUT_MATH §6 (85).

### C65 — P/owner instance identity + sampler dispatch chain (dig #86)

All VAs true (PE-native, C57); method = one cached full-.text dump
(`objdump -D -M att --start-address=0x401000 --stop-address=0x1000d70`,
3.9M lines) + python imm32 byte-find with per-section file↔VA.

- **kind2-`esi` == P: PROVEN (byte chain).** Serialize kind2 arm —
  `mov 0x4(%eax),%ecx; cmp $0x2,%ecx` @0x8f36c7/ca, null check
  `cmpl $0x0,0x1d4(%eax)` @0x8f36d3, ecx = `lea 0x1b4(%eax)` = fn2-
  this = config+0x1b4, pushes config+0x1cc/+0x1d0/+0x1d8 + stack
  −0xc4 → **`call 0x8ee440` @0x8f36fe** → `mov %eax,0x1d4(%ecx)`
  @0x8f3708 (ecx = `mov (%edi),%ecx` = config) ⇒ P = fn2's return.
  fn2 window split: **fn2 = 0x8ee440..0x8ee741** (sole ret), fn3 =
  0x8ee750..0x8ee92f, LERP = 0x8ee930 (C54 pin ✓), fn5 = 0x8eead0..
  0x8eec6f (the 0x8eec20 fill block belongs to fn5, NOT fn2). fn2 ret
  @0x8ee741 returns [ebp−0x18] (`mov -0x18(%ebp),%eax` @0x8ee72a)
  ← last write `mov %edi,-0x18(%ebp)` @0x8ee640 ← edi = `call
  0x8f9470` gen-ctor (ecx from `push $0xb8; call new`) @0x8ee633 ⇒
  **P(kind2) = fn2's heap `new(0xb8)` gen**; its Load = wrapper
  0x8fa930 → `call 0x8f9ab0` @0x8fa99b (this = gen, C62 ✓).
- **P == sampler-owner+0x9c: FALSE (as instances; same class).**
  owner+0x9c = in-place **embedded** gen — ctor `lea 0x9c(%esi),
  %ecx; call 0x8f9470` @0x90ce66 (atomic +0x98 zero @0x90ce5d;
  `movl $0,0x154(%esi)` @0x90ce71 = 0x9c+0xb8 = embed end ✓); Load
  `lea 0x9c(%edi),%ecx; call 0x8fa930` @0x90d1ab (in fn 0x90cfb0);
  dtor `lea 0x9c(%edi),%ecx; call 0x64cad0` @0x910a6f (+ zeros
  +0x154/+0x158/+0x15c, then `call 0x63eef0` @0x910a80). P =
  `[config+0x1d4]` has **five writers, all storing standalone/static
  gens**: kind2 fn2 heap gen (above); kind0+c0 `call 0x8f2ff0`
  @0x8f37a4 → store @0x8f37ae; kind0+b8 `call 0x8ee230` @0x8f37d4
  → store @0x8f37de; static imm `movl $0x132b518,0x1d4(%eax)`
  @0x8f388f; **fifth** `mov %ecx,0x1d4(%eax)` @0x908583 (fn
  **0x905fb0**, frame 0x408; ecx = [ebp−0x294] = the fn's own
  `push $0xb8; new; call 0x8f9470` @0x907323-341). Heap/static blocks
  ≠ interior of the owner's allocation ⇒ never the same address ⇒
  **instances distinct, class identical** (BitmapNoise lane map,
  C61/C62).
- **Sampler dispatch chain:** sampler = payload obj+4 (vtable
  **0x118f9e4**; getter `lea 0x4(%ecx),%eax; ret` = slot+0x18);
  slot+8 thunk **0xa9a120** (`add $0x4,%ecx; jmp 0x90d860`; e9 @
  0xa9a123; imm32 single hit file 0xd8ebec); clone = slot+4 0xa9a0c0
  (`new(0x40)`, `movl $0x118f9e4,(%eax)` @0xa9a0e2, xmm payload
  copy +4..+0x3f); +0 = 0xa9a060, +0xc = 0xa9a130 (`mov $0x12f83d4,
  %eax; ret`), +0x10 = 0xa9a150, +0x14 = 0xa9b430. Functor ctor
  @0x90d507: `new(0x40)`, vtable @0x90d529, payload = movdqu
  [ebp−0xd0..−0xa0] → obj+4..+0x3b, owner = obj+0x1c ← [ebp−0xb8];
  sole writer `mov %edi,-0xb8(%ebp)` @0x90d4f5 in fn **0x90cfb0**
  (edi set once `mov %ecx,%edi` @0x90cfdd; frame 0x118, SEH
  0x10a5dd1) ⇒ **sampler-owner = fn0x90cfb0's this**; its single e8
  caller 0x90f6bf: owner = [outer+0x84]; outer stores `[obj+0x90]`
  @0x90f6a7 / `[obj+0x94]` @0x90f6b3 = C34's lookup lanes ✓. Driver
  0x908F40 imm32 = 0 hits (C60 scope stands). RTTI COL name read =
  unresolved (layout misread).
- **Sampler mixes the two gens** (gate block @0x90dba5..0x90dbe7):
  ecx = [sampler+0x18] owner; `mov 0x9c(%ecx),%eax` = embed gen+0
  (stride); `add $0xb4,%ecx` → embed gen+0x18 = f32 CSafeArray;
  idx = y·stride+x → getter 0x9499f0 → comiss 0x11dfa94 (0.5f) →
  jbe 0x90e02b; then P via double-deref `mov 0x20(%ebx),%eax; mov
  (%eax),%eax; mov 0x1d4(%eax),%eax` = **[config+0x1d4]** + null
  skip.
- **C34 +0x1e0 = owner-own DECOR u16 grid:** `movl $0,0x1e0(%edi)`
  @0x90d2c1, `mov %eax,0x1e0(%edi)` @0x90d2e9 (both in fn0x90cfb0;
  sibling @0x9109a1): embed ends owner+0x154 < 0x1e0 (and 0x1e0−0x9c
  = 0x144 > 0xb8) ⇒ never a gen lane; (85)'s "predicted +0xf4"
  premise (= P == embed) dissolved.
- **Carry-over phantoms (do-not-cite, I19):** `call 0x8ed180` =
  **0 hits exe-wide**; `movl $0x132b518,0x38(%esi)` = **nonexistent**
  (real: `mov $0x132b518,%ecx` ×4 + the 0x1d4 imm store @0x8f388f);
  "wang-fill @0x8ee5bd" = inside `mov 0x114a37c,%esi` (IAT load;
  nearby `add $0x76c,%eax` = year+1900 log) — not a fill.
- **Census corrections:** non-esp `lea 0x9c` ≈ 250 sites (owner
  family 0x90ce66/0x90d1ab/0x910a6f; string-member family 0x46fxxx+
  via `call 0x442f50` — an (85)-era "zero" was a `sed -n 1,20p`
  truncation artifact); `lea -0x9c` all %ebp; no `add/sub $0x9c`
  object arithmetic. The 0x4f72b3/0x4f8857/0x4f9673 "+0xb4 stores"
  = property-clone field copies (`mov 0xb4(%ebx),%eax; mov %eax,
  0xb4(%edi)`, descriptors 0x1180a08/0x1180a68) ⇒ C64's "no
  gate-f32 install" stands.
- **OPEN sub-notes:** (i) fifth store's target = [esi] of fn0x905fb0's
  element table (`mov (%ecx,%edx,4),%esi` @0x908067 → `mov (%esi),
  %eax` @0x9080f7; loop-carried via [ebp−0x2d4], store after loop
  exit @0x908572) — structural config-class (+0x1d4 gen slot; fn runs
  a serializer field walk, cf. string 0x115144c "couldn't find
  field"); instance identity with Serialize's config unverified;
  (ii) sampler payload RTTI COL name unresolved.
- Source: ABOUT_MATH §6 (86).
