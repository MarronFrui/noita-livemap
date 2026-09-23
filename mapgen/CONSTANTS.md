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
| C40 | case-1 lane core (sin-hash lattice) + IAT math table | true 0x8fb350 = whiteLattice2d: c0=57·round(y)+round(x), corners frac(sin(c0+k)·43758.546875) k∈{0,1,57,58}; 0x44d110=libm sin-precise (slot 0x114a520); 0x44d0b0 = fld/fistp round |
| C43 | gradient-grid setter stacks (W5 core) | 0x4edf50 = float-grid setter; 3 layer-callers with fraction-bands (0.32·d+0.35 / 0.35·d+0.65); mGradient* = likely these stacks' params. **CE-VERIFIED 2026-09-20 (35): [uid+0x224] = 5 = noiseType-int (the dispatcher case = the 0x8fc020 crest — W2 CLOSED empirically); [uid+0x220] = addNoise {3, 0}; [uid+0x230/0238] = f64 ScaleX/Y (0.9999-hills ✓); [uid+0x244/248] = 0.057143 / 2.0 ✓; [uid+0x264] = mMultiplierGradient (0.871429-hills ✓); [uid+0x268] = mMultiplierPerlin (1.0-hills / 0.642857-winter ✓ — CORRECTION of the (23)-map: the pair swapped); [uid+0x1d4] = the BitmapNoise ptr — the hills-class = w260✓h260 = a real 67600-float grid (row [1,1,1…0.7961…1]); the winter-class pointer = a 1×1-unbound placeholder; one candidate = a 3584×2457-cnt-8.8M = the WORLD-state-grid (C31-family!)** |
| C44 | BitmapCaves band-stack family (P5) | fn A true 0x8EEC70 (L1) · fn B true 0x8F5DD0 (L2+L3) · factory fn C1 true 0x8F2FF0 (dims = BitmapCaves size_x/y = w[+0x1c]/h[+0x20]; cache map @0x132aae8 keyed by name); band consts 0.32@0x11dfa00 / 0.35@0x11dfa20 / 0.65@0x11dfb14 (all pinned 2026-09-21); [-0x128]=d·3.0+1.0, [-0x108]=d·0.1+0.1. **NO C37 config slot read by the family ⇒ "mGradient* = band-stack params" ELIMINATED** (see the C44 registry row) |
| C45 | FNV24 hash + lattice + corner table | hash true 0x8FB2D0 (FNV-1a over 24B {x_d64\|y_d64\|1234567.0-sentinel @0x11e0180}, idx = ((h>>8)&0xff)^(h&0xff)); the 256-f64 corner table .data 0x12eb950 (data_raw off 0x950; the C41 "12-dir pairs" = only the first 12, SUPERSEDED); lattice true 0x8fc940 = smoothstep 4-corner bilinear (rows in x by wx, out = wy·(rowT−rowB)+rowB; corner order pinned). C41's "0xc31cea walk" = the /GS cookie check (retired). fbm = CONSTANT quad {sin1,cos1,cos1,−sin1} @0x11e0c70 + **lac 2.01 @0x11dfe78** (new pin); case-4 args 7123.1234 @0x11e00d8 / 1020304.1234 @0x11e0170 |
| C46 | BitmapCaves stamp-carve family (W5 field build) | fn A true 0x8EEC70 (CaveStructure stamp walker, recursion = cave_childs) · blob setter true 0x8EE750 (max-bleed + circle falloff) · scatter engine 0x8EEAD0 (dig #81 re-pin from exe; the old 0x8EF2D0 was +0x800 off) · blend twins 0x8EF870/0x8EF950 · roll/envelope consts 0.35/0.25/0.32/0.35 @0x11dfa1c/d0/a00/a1c, envelope 0.2/0.3/0.4/0.6/0.7/0.33; READ, not ported (sub-reads named) |

| C47 | C24 runtime decode (CE v4) | [0x1327670] = **17920.0**, [0x13289a8] = **7168.0** = the canvas/world offset pair (NOT a fill window; the "159/223 = engine defaults" reading dies); slopeFlag [+0x24c] = 0 all 42 uids (slope arm dead in live data); BitmapCaves std::map count = 4; A-resolver [P+0xb0] = NIL (P = the caves-grid object does NOT carry it; target corrected to BitmapNoise instances); live 512x256 bitmap_hills grid values recorded (byte-level I1 validation anchor; y=0 rows exceed 1.0 per the (y/25)^8 eave) |
| C48 | caves-grid [P+0x94] signature + byte oracle | [P+0x94] = (w·0.5)/0.1 on cave grids (512→2560.0, 1×1→5.0 = the fn C1 ×5 toucher, byte-cross-verified); the world-state grid keeps the RAW C27 draw (−56909.828125, no ×5); both 512×256 cached grids byte-identical ⇒ the caves field = deterministic (diddled ws, name, XML params); the y=0 bump (peak 1.454@x≈19) = a stamp ADD-BLEND over the 1.0 base (writer = 0x8EF870 twin / bake, named target); oracle artifact `mapgen/out/oracle/caves-grid-2026-09-21.json` |

| C49 | pinpoint pickup v5.2 results | [P+0x8c] = the RAW worldseed runtime-pinned both seeds (C27 confirmed in-memory); hills-class knobs [+0x34]=0.546875 / [+0x74]=1.549988 (seed-independent, hills.xml 1.55-family); [+0x2c/0x30/0x38] = pointer slots; [+0x58] deref = a REAL per-grid byte allocation (first64 all-zero); the 0x132aae8 RBTree layout cracked (L/P/R/color_isnil/key-SSO/size/cap, VALUE@0x28 = the cave-grid ptr; keys = the CaveStructure FILE PATTERNS incl. "eye_0$[1-4]"); the V4d A-resolver hunt RESOLVED: [P+0xb0] = 0x008EE1B0 on the 0-dim uids (a real fn entry, objdump next); [P+0x94] draw ADVANCES per build instance; the 1x1 struct P = 0132B518 STATIC |## Registry

| C50 | the +0x34/+0x74 knob pair (dig #29) | [P+0x74]/[P+0x78] = the blob-strength (min,max) pair consumed by fnB (slab 0x4f0931..0x4f0958: v = A + d·(B−A) → the 0x4ee130 blob-setter v_arg; decl-loop = the blob-count phase); CE:(+0x74,+0x78)=(1.549988,0.0) hills-class / (0,0) on the second 512x256 class — the C48 bump peak lives INSIDE the span ✓; [+0x34] = a DIFFERENT struct (the CaveStructure PATTERN record window +0x24/0x2c/0x34/0x38, the f32-read vs int-read sites differ, NOT a contradiction); the knob WRITER = not in the fnB/fnA/ctor family — the named hunt = fn C2 body + the XML-parse family (0x496a2e..0x4a97ed) |
| C51 | CaveStructure record walk (fnB load phase) | RECORD-ARENA allocator pair 0x533860/0x5bff80/0x5bffb0 (engine alloc `call *0x114a34c`; slot init edx = 0x80 via 0x651a60; vector grow at 0x5bff80/0x5bffb0; NOT image loaders — dig #27 label). **dig #81 corrections: the record = 60 B, not 28** (4-B header + 24-B image_file SSO string + 8×4 fields; the dispatcher = true VA 0x4ABD60, class "CaveStructure" 0x117bf0c, nine keyed stores closing at +0x3c); **COUNT pair = [+0x1c]/[+0x20]**, not +0x28/+0x30 (dispatcher `mov %eax,0x1c(%esi)` @4abe0e + fnB read @4f09cf..4f09d5); `push $0xe00` (3584 B) label **RE-FLAGGED** (3584 is not a multiple of 60: ÷60 → 59); **STRENGTH pair read at [+0x34]/[+0x38] (f32) = the XML's per-record strength_min/max** (byte-verified vs hills.xml's 10 records: cave_$ 0.55..2.15, mountain_rock/skull 1.45..1.55, eye 1.45..1.55, pit 0..0.65; the C49 knobs 0.546875/1.549988 = values of these slots per record, C50's "DIFFERENT struct" note resolved to this struct); **the roll = `value = max − trunc(|draw|·(max−min+1))` via `mulsd 0x11e0578` = the NEGATIVE NextU scale (−4.656612875e-10)** — the first pinned NEGATIVE-scale roll; **the write = `call 0x4ef150` = true 0x8EF950 = the BYTE-GRID blend twin** ([P+0x58] byte lane; the C49 "+0x58 first-64 all-zero" = unwritten rows ✓); the per-iteration loop `decl −0x120(%ebp)` + `jne 0x4f0a95`; the record cursor +0x3c @0x4f0f03; the list-scan via {begin,end} × magic 0x88888889 = **÷60-B records** (the ÷12 label OVERTURNED dig #81; script-verified 60→1/600→10/3584→59; the vector = the config's +0x7c/+0x80 `structures` pair). **true 0x8EE930 (slab 0x4ee130..0x4ee2c8) = the smoothstep LERP stamp — the ONLY lowering-capable writer in the fnA/fnB census** (`v_out = (v_src−v_dst)·t + v_dst` per cell @0x4ee294..0x4ee2a3); all the blob-setter lanes push $0 = max-bleed raise-only; scatter 0x8EEAD0 (VA re-pinned dig #81; the old 0x8EF2D0 was +0x800 off) = `<0.5` empty-cell gate only ⇒ **the float-grid CARVE = the 0x8EE930 LERP + the C32 LoadFromImageData ±1.0 pass; the CaveStructure record lane writes the BYTE grid.** |
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
| C73 | **fnA y-drift span + all 10 arg slots + budget chain + xmm4 provenance (dig #94)** | fnA = **8eec70..8ef86c**, called @**8f0703** (fnB region) + child @**8ef823**. **Slots** (consistent at both call sites): [ebp+8]=dims{w,h} ptr · [ebp+0xc]=&int pair{−0x134 X, −0x130 Y} · [ebp+0x10]=−0x104 y-cursor · [ebp+0x14]=−0x10c scale · [ebp+0x18]=−0x110 budget (f32) · [ebp+0x1c]=(−0x100)² u (**child `xorps 0x11e0c50` sign-flip @8ef7c2** ⇒ opposite horizontal drift) · [ebp+0x20]=−0x120 Δy · [ebp+0x24]=growth(−0x148) · [ebp+0x28]=&−0x124 child budget (child `decl (%eax)` @8ef79e) · [ebp+0x2c]=rec+0x24. **Start pair:** X = −0x134 = clamp(jittered base, 5, W−5) @8f0265..8f0298; Y = −0x130 = trunc(rand·[0x11dfef0 = 0.0]) = **0** @8f02b3..8f02b9 ⇒ **walk STARTS AT ROW 0 (top)**. **y chain:** y = slot −0x44 = (float)pair[1] @8eecac..8eecbc; **−0x44 += [ebp+0x20] once per walk iteration** after the band call @8ef37c..8ef393; Δy = −0x120 = **0.4·u+0.1 ∈[0.1,0.5)** @8f046a..8f0485, **+0.5** when trunc(101u)<33 (`cmp $0x21` @8f049e..8f04b3, 0x11dffe8=101.0) ⇒ Δy∈[0.6,1.0) there; budget [ebp+0x18] = −0x110 := `divss −0x120` @8f0626..8f063f where **−0x110 = LERP(0.45·H, 0.96·H, u)** final @8f056b..8f058d (0.45 @0x11dfa5c, 0.96 @0x11dfbc8; −0x119=1 always @8f03ac ⇒ refine always runs; earlier LERP(0.15H,0.96H) @8f0415..8f043f superseded). **Terminations:** back-edge `inc −0x40; comiss [ebp+0x18],steps; jbe 0x8ef0d0` @8ef836..8ef857 ⇒ ≤⌊budget⌋ iters; box x∈[0,w) ∧ y∈[0,h) @8ef0d0..8ef0ff else epilogue (ret @8ef86c); y-cursor gate @8ef104..8ef10c; budget<0 pre-gate @8ef0b1 (xmm1=[ebp+0x18] loaded @8eefb8 vs xmm3=0 @8eefbd, census-clean to 8ef188) ⇒ skip. x: −0x4c += clamp(step, ±1.0) @8ef5f6..8ef62c (1.0 @0x11dfbf0, −1.0 @0x11e05a8); counter −0x48 `cmp $0x32`/jle @8ef631..634, >50 ⇒ re-jitter `[ebp+0x1c]=u·2−1` @8ef6c9..8ef6de (2.0 @0x11dfe68). **SPAN ⇒ y ∈ [0, LERP(0.45H,0.96H,u))**, box-limited to h. **Child:** gate `rand·100.0<2.0` ⇒ **P=2%** @8ef774..8ef783 (0x11e02dc=100.0), gate+call sit in the walk body just before the back-edge (address layout ⇒ per-iteration attempt); budget xmm1 = (u2·50−50)+(parent−steps) @8ef7e2..8ef800 (50.0 @0x11e0284); xy `lea −0x38` @8ef7ee. **fnB caller side:** X-roll = 5+⌊(W−9)·u2⌋ @8f08ad..8f08e9; **xmm4 provenance CLOSED** = u1·(−0x10c) @8f07b5..8f083c (NextU on %edi, scale +1/2³¹ @0x11df988) → `cvttss2si` @8f08e5 (slab 4f00e5) → −0x118 @8f08f3; −0x10c last-written @8f05c0 = **0.25u+0.75** (0x11df9d0=0.25, 0x11dfb2c=0.75; base value semantics OPEN), −0x118 later reused as draw budget; **L2/L3 = 120+⌊81u⌋** = C53 re-confirmed byte-exact (ecx=0x78 @8f1cff/8f26f0, mulsd 81.0 @8f1d10/8f2701, stores −0x118 @8f1d42/8f2733, `decl` @8f23bf/8f2d5d, gates @8f256d/8f286e/8f2f0b, L2 = 2 passes @8f2585..8f2595, band/scatter calls 8ee750 @8f20d1/8f2a6c + 8eead0 @8f255d/8f2efb). | `/tmp/opencode/fulltext86.asm` — all addresses read this session; f32/f64 consts read as cited |
| C74 | **MaterialComponent build: ctor `0x7daeb0` defaults + the full XML-attr → 132-B slot map + `[config+0x2a4]` = `mBiomeMaterials` (dig #95)** | **ctor = fn `0x7daeb0`** (thiscall ecx→ebx, `sub $0x1bc`, SEH 0x10845e4): vtable **`0x1191fc0`** @7daef0; default-fill @7daf2a..7dafc6 = **+0x04** 0 (celldata) · name SSO string **+0x08..+0x17** (size **+0x18**=0, cap +0x1c=0xf, `''` via 0x41df90 @7daf31) · **+0x20**=10 (material_index) · **+0x24/+0x28**=0.1f (material_min/max) · +0x2c 0 (add_perlin) · +0x30/+0x34=1.0f (add_perlin_scale_x/y) · +0x38 word 0 {is_rare, limit_y} · **+0x3c**=100.0f / **+0x40**=2048.0f (limit_min/max_y) · +0x44 word 0 {rare_use_perlin, rare_use_fbm_perlin} · **+0x46**=1 (rare_use_polka) · +0x48/+0x4c=0.05f (rare_scale_x/y) · +0x50 0 (rare_offset_by_seed) · +0x54/+0x58 0 · +0x5c=0.2f / +0x60=0.65f (rare_polka_radius_low/high) · **+0x64**=1 (rare_polka_is_boxed) · +0x68=0.2f (rare_polka_probability) · **+0x6c**=0.2f / **+0x70**=1.0f (rare_required_min/max = out-gate defaults) · +0x74 0 (is_polygon) · polygon vector **+0x78/+0x7c/+0x80**=0/0/0 + init 0x92baa0 @7dafe6; end **+0x84 = 132 B** ✓. **Same frame = schema registration:** `"MaterialComponent"` (len 0x11, **0x1153bd4**) @7db002 → registry **0x92a5c0** @7db027 → find **0x43e0f0** @7db035 → miss = insert **0x4498f0**/**0x4499a0** @7db06b/7db080 → payload node+**0x28** @7db08b → once-guard `mov (%esi),%eax; cmp 0x4(%esi); jne 0x7db6c8` @7db0b2 (payload non-empty ⇒ skip) → name push-loop **0x444250**: celldata (0x117d2e4) @7db0bd, material_name @7db100, material_index @7db141, material_min @7db182, material_max @7db1c3 … rare_use_polka @7db44d (cluster continues through the full attr list). **Attr→slot map — three byte-agreeing passes** (vtable **0x1191fc0** = [0x7e22a0, **0x7dc850**, **0x7de160**, 0x7dc670]; pass A = vtable+4 fn **0x7dc850** name-push + `lea slot(%ebx)` @7dc897..7dd465; pass B = vtable+8 fn **0x7de160** name-push + `lea slot(%esi)` @7de26a..; pass C = mov-form `mov $name,%edx` @7deda0..): **celldata→+0x04** · material_name→**+0x08** (size +0x18) · material_index→**+0x20** · **material_min→+0x24 / material_max→+0x28 = classifier main gate** · add_perlin→+0x2c · add_perlin_scale_x→+0x30 · add_perlin_scale_y→+0x34 · is_rare→+0x38 · limit_y→+0x39 · limit_min_y→+0x3c · limit_max_y→+0x40 · rare_use_perlin→+0x44 · rare_use_fbm_perlin→+0x45 · rare_use_polka→+0x46 · rare_scale_x→+0x48 · rare_scale_y→+0x4c · rare_offset_by_seed→+0x50 · rare_offset_x→+0x54 · rare_offset_y→+0x58 · rare_polka_radius_low→+0x5c · rare_polka_radius_high→+0x60 · rare_polka_is_boxed→+0x64 · rare_polka_probability→+0x68 · **rare_required_min→+0x6c / rare_required_max→+0x70 = classifier out-gate** · is_polygon→+0x74 · polygon→+0x78 — every C72/C93 gate slot carries its XML name (refined in place; no §8 overturn). **`[config+0x2a4] = mBiomeMaterials`** (C58 walk): guard `mov $0x117a338,%edx` → eq 0x4447f0 → getter **0x9c8660** → `mov %eax,0x2a4(%esi)` @**49de93**; ordinal case same getter @**49e83c**; zero-init @496195/4e8a6d; siblings 0x117a2a8 `'coarse_map_cell_count_always_zero'`→+0x2a2 @49de31, 0x117a2cc `'coarse_map_inject_light'`→+0x2a3 @49de62. Getter 0x9c8660 = holder `[esi+4]` → virtual get (null ⇒ static 0x12ef63c) → typeid check (0x12f20c4 + IAT 0x114a36c) → `*([esi+4]+4)`. **`<Materials>` tag = 0x11a06a8** (xrefs 744c4e CellFactory region, 8f38f6/8f393e/8f39d6 in a biome.cpp-0x1172ea8 fn line 0x4b8; tag-eq **0x42c440** @8f3910); P1 = **inline** `<Materials>` (hills.xml:184) — no `mBiomeMaterials=`/`mBiomeMaterialsFile` in the surface files (File attr only in friend_1..6/roadblock/secret_entrance/snowcastle_cavern/solid_wall → `data/materials/biome_forest.xml`). **Red herring:** `push $0x84` ×4 = assert-log **line 132, not sizes** — @732002/732073 `Assert failed: (celldata) in …box2d_collisions.cpp at line 132` (fmt 0x1150f60, expr 0x117d2e4, file 0x119ebb0, guard `[arg+0x38]==0` @731ffa, null-crash @731fea) and @748c9d/748d14 `(this != temp) in …cfirecell.cpp at line 132` (0x11a095c/0x11a0878) ⇒ **no literal `new(0x84)`**; component stride = the classifier's `add $0x84` (C72) + `imul $0x84` @5d0eb8/5d0ff5. OPEN: `<Materials>` child→wrapper flow, record RESOLVE (material_name→+0x04), `_enabled` (absent from all three passes), allocation site, virtual read-vs-write. | `/tmp/opencode/fulltext86.asm` — every address read this session (slab→true +0x400800; strings via exe scan, VA−0x400E00); XML facts from `data/biome/*.xml` greps + hills/desert/mountain_center reads this session |

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
  - **The roll** = `value = max − trunc(|draw|·(max−min+1))` via
    `mulsd 0x11e0578` = the **NEGATIVE NextU scale (−4.656612875e−10,
    pinned)** — counts DOWN from max; the first byte-pinned negative-scale
    roll in the binary read so far.
  - **The write** = `call 0x4ef150` = true **0x8EF950** = the BYTE-GRID
    blend twin (the [P+0x58] byte lane; C49's "+0x58 first-64 all-zero" =
    these records' un-written rows ✓). Value compose = C50 inline
    (`subss/mulss/addss` @0x4f0e84..0x4f0eb7 = A + d·(B−A)).
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
  candidate); the CaveStructure RECORD lane stamps the **BYTE grid**
  (0x8EF950). Corrects the C46 "blob-setter smoothstep twin" gloss.
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
- Source: ABOUT_MATH §6 (85); dump `/tmp/opencode/binding_table.txt`.

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
- Source: ABOUT_MATH §6 (85); dump `/tmp/opencode/defaults_vals.txt`.

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
