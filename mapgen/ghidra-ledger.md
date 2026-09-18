# Ghidra function ledger — noita_dev.exe investigation state

> Processing ledger for the decompilation hunt. Update every session:
> a function's verdict is FINAL unless new evidence overturns it — never
> re-dump, never re-read without a reason. Settled facts get distilled into
> `mapgen/VERIFIED.md` (the canon); research detail goes to `ABOUT_MATH.md`;
> this file is the processing state only.
>
> Dumps live in `~/work/ghidra-logs/` (outside the repo). File→VA mapping:
> .text file+0x400c00 · .rdata file+0x400e00 · imageBase 0x400000.

## Verified anchors

| Function | VA | Verdict |
| --- | --- | --- |
| **FUN_0090b8a0** | 0x50b0a0→**0x90b8a0** | **ProceduralTerrain::Update() thin entry** — profiler begin (0x11753ac "ProceduralTerrain::Update()"; string store site = 0x90b8cf `c7 45 9c`) via the profiler-begin helper, then `call 0x910c20(this)` at 0x90b8f5. Sole direct e8 caller of 0x90b8a0 = 0x796093 (the world-tick caller). **VA CORRECTION (2026-09-18):** the Sep-18 "0x50b000" dig ran through the shifted slab (objdump VA = true VA − 0x400800); all three ledger entries of that session carry corrected VAs (found by byte-pinning the profiler-string stores: imm sites at file+0x400c00 = 0x90b8cc/0x90c7ac and one 0x11764ac store at 0x910c59). |

| **FUN_00910c20** | 0x510420→**0x910c20** | **DoBufferedPixelScenes()** (profiler scope 0x11764ac, store at 0x910c59; full body read this session). Deletes from a 0x90-stride work-record vector ([ebx]/[ebx+4]): per record (call FUN_0090e840-probe (the known world-grid init) → status): (a) status==2 → execute: FUN_00668800(record+0x3c-struct, 0) loads the scene object (0x28-byte result), FUN_008fdc90 (noise-utils region)(local, xf, yf floats from record dwords copies), then virtuals `*0x4c(%eax)` and `*0x20(%eax)` (of the loaded object's classes) + float from record+0x54 stored at obj+0x80 = LOADS THE SCENE INTO THE WORLD. (b) otherwise → camera-cull branch: rect camera bounds ±32, FUN_00929800 builds rect list; per record reads +0x4/+8 (x,y), +0x88/+0x8c +0x1c flag; 4-corner chunk-presence test: FUN_0094b040((x±32)>>9, (y±32)>>9) probes the PIPE 512-grid object at DAT_0x132aed8 = the loaded-chunk bit-grid — a scene only executes when ALL FOUR overlapping 512-chunks are loaded; else it is DEFERRED (FUN_00796660 (frame-tick region)(local, 0)) under the debug byte 0x132802a (via FUN_0099f640 log into 0x12ee538). All processed records stream to [ebx+0xc] call 0x268000?? (vector push at [ebx+0xc]), erases the front (−0x90). 

|

| **FUN_0090c1f0** | 0x50b9f0→**0x90c1f0** | **InsertBufferedPixelScene(this, record, bool)** — full body read this session (e8-callers: 0x818c6e = LoadPixelScene binding ✓, 0x907fc9 = Init, 0x90bd1e = Update-world buffer, 0x64ca47): queries the 0x90-stride vector for a record EQUAL to the incoming arg (memcmp-style compare at seq fields +4/+8, strings +0x24 and +0x3c (0x18-wide), bytes +0x58/+0x59, blob +0x5c — FUN_00442bc0 helper); on match → return without side effects (= load_even_if_duplicate=false). Else: build local copy (FUN_0090c820 = the known 0x90-byte record copy-ctor ✓), optional FUN_008a2850 hook on record[ebp-0x84] field, FUN_00930fe0 push into the vector at [ebx]/[ebx+4] (via [esi+0x58] branch → swap-push when byte +0x58=2, plain push otherwise), and if the queue was empty (record[0]==0 flag first dword) immediately profiler-scopes and calls 0x910c20(this) — the per-insert FLUSH. THIS REFUTES the "4 callers → UNREAD" from Sep-18 (they were 0x818c69/0x907fc9/0x90bd19/0x915a52 pre-shift-fix...). |
| **FUN_008183c0** | 0x8183c0 | **LoadPixelScene Lua binding — READ** (dump existed: `h3_dispatch_caller_1_008183c0.c`): validates ≥4 args; per-scene record = materials_filename, colors_filename, x, y, background_file, skip_biome_checks, skip_edge_textures, **color_to_material_table** (per entry: FUN_00454d90 ARGB parse → FUN_00741770 lookup, name→material via FUN_009315c0), background_z_index, load_even_if_duplicate → dedup insert into a **0x90-stride record vector via FUN_0090c1f0** (thiscall; first-diff at +4/+8, length compare at +0x1c/+0x34). So FUN_0090c1f0's true role = the **pixel-scene record dedup/add**, and the 0x90-stride vector it handles = the buffered scene queue that FUN_00510420 drains per frame. Added 2026-09-18 (extends the earlier "area cache" guess).

  **CORRECTION (same session, hedged):** FUN_0090c1f0's in-binary body (dump
  `h20_gen_0090c1f0_gen_d1_d2_d3.c`) iterates a 0x90-stride vector doing two
  string-min-length compares (buffer fields ~+4/+8, lengths ~+0x1c/+0x34 via
  `FUN_0042b780`) — consistent with the **pixel-scene record dedup**
  (`load_even_if_duplicate` semantics; 2 string fields = materials_filename +
  colors_filename). The older "(width,height,seed) area cache" verdict from
  the 2026-09-07 hunts conflicts with this; at THIS call site the role is the
  scene-record dedup/add. Both readings recorded; re-verify the area-cache
  call site separately before trusting either for gen amounts. |

| **DAT_012eb130 READERS** | 0x79e65a / 0x79e6f1 / 0x79e74f | **FOUND 2026-09-18 (plan target)**: three direct loads (`a1`/`8b 0d`) of STREAMING_CHUNK_TARGET inside a frame-time/streaming-budget regulator at true VA ~0x79e400..0x79e9f0 (prologue-decoded via whole-file disasm, adjust file+0x400c00). Logic: reads a counter `esi` (via FUN_0043ac50 → ctx+0x10 → +0x544 → FUN_008e6650 (slab-true names)), compares it against thr, 2×thr, 3×thr (0x12eb130 doubled/tripled inline); scales double DAT_0x132aef0 (halve via 0x11dfdd8=0.5, or reset from DAT_0x12eb7f0 via 0x11df878 cmp) and warns/logs (0x5c7ee0 into 0x12ee538, string 0x11a55d4; assert fail line 0xdd7 at 0x11a5690 if esi < thr+1... esi−3·thr < 1 → error path). Same critic region also references 0x134632c + 0x1329f89. This is the **per-frame streaming budget regulator** — NOT a chunk-request consumer itself; the actual chunk-load machinery is the 0x79xxxx frame-tick family around it (callers/sites at 0x79e5xx/0x79e7xx) + the chunk bit-grid DAT_0x132aed8 (imm users cluster at 0x405ee1, 0x642e00-family, 0x720e00-family, 0x791900-family = the chunk-request/registration subsystem — NEXT dig for "what a chunk load reads"). "Getter family" hypothesis FALSIFIED: no indirection, three raw imm loads exist. |
| **0x50b0cf / 0x50bfb2 region** | ~0x50b000 | located via profiler string 0x11753ac (2026-09-18), now decoded into the three functions above. **OBSOLETE as a VA range:** true VAs are the +0x400800-corrections (0x90b8cf, 0x90c7ac, 0x910c59 string-store sites); the 0x50b000 literals were the shifted slab's rendering. |
| **Shifted-slab verdicts fix-up (2026-09-18, same session)** | — | The Sep-18 dig's "second Update-scoped body" claims resolved: the "4 callers of FUN_0050b9f0" (0x418469, 0x5077c4, 0x50b519, 0x915252) were shifted → true 0x818C69 (LoadPixelScene binding ✓), 0x907FC4 (Init ✓), 0x90BD19 (Update buffer), 0x915A52. Corrections confirmed via numeric e8/imm32 scans (file+0x400c00 convention — validated by pinning the SetRandomSeed mixer constant 0x93262e6f, VA(file+0x400c00) = 0x48fd47 = the Ghidra anchor). |
| **0x472ee0 / 0x4742d0 regions** | — | Debug-flag registration (DEBUG_GENERATE_BIG_WANG_MAP / DEBUG_FULL_WANG_MAPS) — same std::map helper set, assert lines 1002/1062; storage + readers unknown. Added 2026-09-18. |
| `FUN_0048fd30` | 0x48fd30 | **CALIBRATED** = the game's `SetRandomSeed` mixer (poro Random). Matches our verified JS step-for-step (diddle backward-index, &3 warm-up, 16807/127773/2³¹−1). Assert path leaks `poro/source/utils/random/random.cpp`. Does NOT drive the fill (proven by lab + 644M sweep). |

## The generator landscape

| Generator | Constants | State | Seen in |
| --- | --- | --- | --- |
| poro Random (Lua-visible) | Lehmer 16807 / 127773 / 2³¹−1 + diddle mixer | per-object (double) | `FUN_0048fd30` — NOT the fill |
| Multiply-and-add family | ×214013 (0x343fd) +2531011 (0x269ec3) | global `DAT_0132a388` | `FUN_00633930` (per-object scatter), `FUN_00436a50` (gameplay dice, 10%-gate), `FUN_00794620` (per-object positions, seeds LCG from `(objfield+base+idx*2−3)^0xc`) |
| mt19937 / 64-bit LCGs | — | — | ruled out (0 fingerprint hits) |

## Function verdicts

| Function | VA | Size | Verdict |
| --- | --- | --- | --- |
| `FUN_0048fd30` | 0x48fd30 | 3 KB | SetRandomSeed mixer — CALIBRATED |
| `FUN_00633930` | 0x633930 | 7 KB | LCG consumer: 2 draws → 2 floats → per-object loop w/ string compare — per-object scatter, callers UNREAD |
| `FUN_00794620` | 0x794620 | 23 KB | Dual-RNG (mixer callers chain + LCG): vector iteration, per-object LCG-seeded positions → **READ FULLY — prime fill candidate** |
| `FUN_00436a50` | 0x436a50 | 39 KB | Global-LCG gameplay logic (10%-gate dice, FUN_004368e0/0042b7e0/0043a5a0 calls) — likely NOT the fill (global state ⇒ order-dependent, contradicts lab) |
| `FUN_00454d90` | 0x454d90 | — | wang_scripts.csv COLOR-column parser (ARGB↔RGBA byte-swap) — the 0xff00ff00 mask caused a false-positive color scan |
| `FUN_00454e80` | 0x454e80 | — | companion parser — same false-positive family |
| `FUN_00807d20` | 0x807d20 | 6 KB | `RegisterSpawnFunction` Lua binding → writes the color→name registry in `BiomeSpawnScripts::GameLuaManager` (global list `DAT_01347698..0134769c`) |
| `FUN_008581b0` | 0x8581b0 | 11 KB | second RegisterSpawnFunction binding — UNREAD |
| listusers (12 fns) | various | <6 KB | CAutoList add/remove plumbing for the LuaManager list — consumer NOT among them |
| `FUN_0085d7b0` | 0x85d7b0 | 2.7 KB | GameLuaManager vtable method: **spawn-queue processor** — drains queued (name, position) requests, camera-culled, executes via Lua |
| `FUN_007eb020` | 0x7eb020 | 1.9 KB | **AddScriptColor**: inserts (color, name) into the registry std::map at manager+0x8c |
| h9 region (22 fns) | 0x806000–0x80c000 | ≤11 KB each | the biome Lua-API bindings region (LoadPixelScene family etc.) — partially unread |
| `FUN_00701d50` | 0x701d50 | — | false-positive hit (hand-typed 0x343FD bytes were wrong: 0x000034FD=13501) — ignore |
| h2 strref wang_template_file (11 fns) | 0x49xxxx–0x4axxxx | ≤65 KB | biome-XML/template-parsing subsystem — UNREAD (fill setup path lives here) |

## The crucial unknowns (dependency order)

1. **Which generator the fill uses** — candidate: the multiply-and-add LCG. Unproven.
2. **The seeding derivation** — fill's starting value as f(world seed, area). THE crown jewel.
3. **The consumption pattern** — draw order, draws/vertex, value→palette mapping.

Efficiency rule: find the FILL FUNCTION first — all three answers sit in its
body. Lab-testing LCG hypotheses without #2 repeats the 644M trap.

## Queue (in order)

0. **(2026-09-18 flow-first reframing — current targets):**
   - [x] **F1 (stage 9) — CLOSED 2026-09-18 (2-late, same session reads; remaining sub-arm retitled F-anchor in frontier):** Update entry = 0x90b8a0 → DoBufferedPixelScenes = 0x910c20, the buffered-scene enqueue with dedup + flush = 0x90c1f0. **Chunk-materialization arm (2026-09-18 (2), same session):** the per-chunk post-load pipeline found via the profiler scope "DistanceField_UpdateForChunk( Chunk )" (string 0x1172b60, one imm store at 0x8e49cb): **FUN_008e4ec0 = per-Chunk staged state machine** (state [ebx+0x18]: 0 → 0x247 → 0x24e → 0x255 → 0x25c → flag +0x14; per stage a ±0x100 (=256 px, the chunk half) quadrant pair builds a cache via **FUN_00939b80(this, cx±256, cy±256, &local)** = the "build cache" step, then **FUN_008e4990 = DistanceField_UpdateForChunk** ("calculate distance field") consumes it, funneling into FUN_008e4ec0's wrapper FUN_008e6af0 which is invoked through a functor jmp-thunk at 0xa99cc8 (thread-pool task family at 0xa99xxx, same pattern as the fill driver's 0xa99ea0→0x904c20). Also read: **FUN_0090d860 = the per-cell material/noise sampler** (reads the u16 material grid via FUN_009fe4e0 (+0x20-slot lookups), the float field via FUN_009499f0 + FUN_0094a8f0 (+0xb4/+0xd4 sub-grid derefs), u8 markers via FUN_0094bb0/0x949bb0; then a **trilinear/smoothed noise evaluation** FUN_00908cb0 + FUN_00908e70 with IAT calls 0x114a434 (CRT math) and the smoothstep constants 0x11dff70/0x11dfe68/0x11dfa94/1.0f@0x11dfbf0) — the DECOR/noise-terrain read path (F3's perlin consumer). **FINAL SEMANTIC (closes the cache-vs-regenerate question):** a chunk load NEVER re-runs the wang fill or the area seed chain — the accepted out_map was materialized once per area during Init (thread pool) into the area's float(+0x18)/u16(+0x38) grids (SetSize call sites 0x90738f/0x907852, Init); the runtime side only READS (FUN_009fe4e0 verified read-only — multiply/wrap the indices and load from [grid+0x18] via FUN_00a242c0; zero writes to +0x18/+0x38 anywhere in the chunk path), and the only per-frame WRITES are FUN_0090c820's record copies (pixel-scene/distance-field caches). Perlin core = FUN_008fca60 family (smoothed value noise, lattice bits, gradient tables 0x114bf30) = F3's kernel (const map: ×0x...0.1@0x11dfd08, 1/9@…0x11dfd20?, thresh 0.5@0x11dfa94, smoothups 0.45/0.33/0.11/0.94/0.95 family — F3 read scope, not needed for F1). **REMAINING (re-titled F-anchor, frontier):** the (3,3)/(+5,+13) wang-cell anchoring constants — read CLASS-DRAW path ~0x8e6d50 (chunk-map consumer) / the fill's copy-out walk.
   - [x] **float/u16 world-grid write chain (2026-09-18, plan target 3):** FUN_008f95c0 SetSize (allocates the float grid +0x18 + u16 material grid +0x38) has EXACTLY TWO e8 call sites, both Init-side: 0x90738f (after GetWidthFromPix-style dim computation; pushed w,h) and 0x907852 = inside the **area-object construction** (`[edi+0x34]=w`, `[edi+0x38]=h`, coord movdqu at +0x3c, `[edi+0x8c]=0`, then `lea 0x90(%edi),%ecx` = the SUB-OBJECT + FUN_008f95c0(sub, w, h)) — i.e. **every AREA object's +0x90 sub-object owns the per-area world grids**; grids are allocated at INIT, not at chunk load. u16 reader FUN_009fe4e0 = 19 e8 call sites: the accessor family in 0x8fa000–0x8fb000 (noise_utils incl. the LoadFromImageData fill path — callers of FUN_008f9ab0 = 0x8fa9a0 (same family) + Init sites 0x905ddc/0x905f23), plus isolated 0x64c80c (pixel-scene), 0x90446c (hasPath region), 0x90dcd3 (immediately next-door to the buffer region — the per-load material sampler, UNREAD). Verdict for the plan question: **chunk loads do NOT regenerate the float/u16 grids — the area object's grids are Init-built and cached; a chunk load reads them.** The exact copier (wang out_map → float/u16 area grids) is the next read: candidates in the 0x90dxxx-0x910xxx neighborhood (0x90dcd3's function) and the 0x8fa9a0 fill family.
   - [ ] **F4: DEBUG flag plumbing.** Sites 0x472ee0-region and 0x4742d0-region
     register DEBUG_GENERATE_BIG_WANG_MAP / DEBUG_FULL_WANG_MAPS into a
     std::map-style registry (helpers 0x1c6b0/0x2b8xx/0x1c710/0xc09ef0/
     0xc0a160; assert lines 1002/1062). Find the storage global + readers;
     check whether magic-numbers.xml can set the flags (same parse path as
     NEW_GAME_PLUS_COUNT? different registry?). Potential in-game wang-only
     ground-truth oracle.
   - [ ] F2: finalize family from binary (see VERIFIED §11).
   - [ ] F3: procedural noise terrain reads (VERTEX: generator +0x94 →
     mInsidePerlin/mGradient; functions around FUN_0090e840/FUN_008f9ab0;
     mSeed ctor FUN_00904730 already decoded) — helps ISSUES I1/I3/I5/I6.
1. [x] Read `FUN_00794620` in full — VERDICT: NOT the fill. World-grid scatter
       utility (`(x&0x1ff)<<9|y&0x1ff` = 512² falling-sand cell indexing; LCG =
       per-object property picks). h7_lcguser dump.
2. [x] Registry chain fully decoded: RegisterSpawnFunction binding (FUN_00807d20)
       → AddScriptColor (FUN_007eb020) → std::map at GameLuaManager+0x8c
       (color → Lua function name; tree insert + "already registered" error).
       Registry CONSUMER = spawns are QUEUED: FUN_0085d7b0 (GameLuaManager
       vtable method) drains a queue (+0x44/+0x48 vector of name+position
       requests, camera-culled) and executes them.
3. [ ] **NEXT: find the ENQUEUE side** — the pixel-walk that iterates placed-map
       pixels and pushes (name, x, y) into the queue. Routes: (a) dump functions
       around FUN_0085d7b0 (0x85dxxx–0x85exxx — its siblings incl. the enqueue
       method); (b) callers of FUN_0085d7b0 → the world-update → the walker.
       The walker sits IMMEDIATELY upstream of the tile-placement loop.
4. [x] Walker route superseded — assert-string scan mapped the source tree
       (330 paths): `procedural_utils/world_seed.cpp` (g_worldseed global =
       DAT_01327ffc; new-game generator FUN_00911730/009118b0) and
       `procedural_terrain.cpp` (100+ functions dumped via assert-string xrefs,
       hunt 12).
5. [x] **FUN_00905fb0 = ProceduralTerrain::Init — READ. THE SEEDING DERIVATION
       DECODED** (constants read from .rdata): seed = WORLDSEED::GetSeed()
       (g_worldseed = DAT_01327ffc; FUN_009119d0 asserts g_worldseed_is_valid);
       d = (double)seed + diddle[(seed>>31)] (SAME compensation as the mixer,
       table at 0x11e0ba0, [0]=0.0); if (2147483647 <= d) d *= 0.5 (same
       halving, constants verified at 0x11e0220/0x11dfdd8);
       **mSeed = (float)d * 9999f + 1.0** (→this+0x30, asserted "mSeed");
       **state2 = mSeed * 200000f − 100000f** (→this+0x48);
       **state3 = state2 * 200000f − 100000f** (→this+0x38).
       FUN_00452ba0 = the halve-helper. Init then: prints "ProceduralTerrain -
       worldseed: N" where N = seed + DAT_01328010 (constant, read from
       binary), allocates the biome grid (w×h), FUN_00904230 = find-biome-for-
       color ("Biome load error - couldn't find biome for color").
       VERDICT: Init = the world-setup orchestrator — NOT the tile fill itself.
       The decoded mSeed chain feeds the terrain-level state; the WANG fill is
       downstream in the per-Biome generation.
6. [ ] **NEXT: the per-Biome generation chain**:
       - FUN_00904230 = color→Biome lookup (vector of 32-byte entries: color at
         +0, Biome object at +0x1c; memoized at +0x28/+0x2c) — dumped (h13b)
       - **FUN_00904c20 (25 KB) = pixel-scene/image placement walker** (NOT the
         fill, NOT recursive — earlier counts were self-match/debug-flag
         artifacts). Its worker FUN_008f9ab0 = **BitmapNoise::LoadFromImageData**
         (noise_utils.cpp): RGBA image → material conversion → fills TWO world
         buffers (float grid + u16 material-id grid; assert material_id <
         USHRT_MAX). Color→material formula visible: (chan + diddle) * scale /
         DAT_011dff70. **WORLD DATA MODEL discovered: parallel float + u16
         material buffers.** FUN_009fe4e0 = u16 reader (neighborhood ops).
       - **Global-LCG scan (193 functions) → ELIMINATED as the fill's source**:
         the heaviest consumers are gameplay (FUN_00685350 = 21 KB with 78 LCG
         refs + sine math = 360-entry angle tables; effects systems). The fill
         does NOT use the global LCG.
       - **THE LEAD: the terrain object's own derived state** — ProceduralTerrain
         fields +0x30 (mSeed) / +0x38 / +0x48 (the 9999/200000/100000 chain,
         decoded). The fill = the procedural_terrain.cpp functions that READ
         those fields: candidates FUN_0090e840 (37 KB), FUN_00901780 (46 KB),
         FUN_00904c20 — all dumped, all receive the ProceduralTerrain pointer.
         Next read: FUN_0090e840 + FUN_00901780 with the state-offset knowledge.
       - Biome class: NO vtable (plain struct) — the generation is free functions.
7. [ ] Secondary: FUN_00901780 (46 KB), FUN_008ff150, FUN_00909370 — unread.

## Drop tables / spawn data (answered 2026-09-05)

"Which biome gets what" = TWO layers:
1. DATA (already mapped): biome→atlas (wang_template_file), palettes (atlas
   headers), materials (biome XML), spawn tables (biome Lua scripts +
   item_spawnlists.lua + entity XMLs — all in the extracted data.wak;
   biomes.mjs parses the tileset half today).
2. BINARY (the missing piece): the per-biome generation SEEDING — what derives
   each biome's fill RNG from (g_worldseed, biome identity). Route: FUN_00904c20
   detail read + the Biome object layout (32-byte entries from FUN_00904230).
The spawn DISPATCH machinery = decoded (registry chain: binding → AddScriptColor
→ map@+0x8c → queue → processor). The per-spawn RNG = the LCG scatter pair
(FUN_00633930/FUN_00794620) — their seeding derivation is part of the same read.
7. [x] **THE GENERATOR OBJECT FOUND (2026-09-05)** — the full chain:
       FUN_0090e840 (ProceduralTerrain world-grid init) → FUN_009119d0
       (GetSeed) → FUN_0090ce20 (allocates the 0x1ec-byte generator object,
       THIS is the MapHandlerNew equivalent) → FUN_008f9470 (the random-state
       constructor, THE SEEDING DECODER):
         +0x23 = the raw world seed (stored!)
         d = (double)seed + diddle[(seed>>31)]  (same compensation as the mixer)
         if (2147483647 <= d) d *= 0.5          (same halving)
         FUN_010098c0() ×2                      (two Next() advances!)
         +0x25 = (float)d * 200000f − 100000f   (the C3/C4 constants again!)
       The object is stored per-biome in the world grid entries (piVar26[0x21]).
       The world grid init (FUN_0090e840's tail) walks width×height cells
       wiring Biome objects (vtable type-getters +0x4/+0x30/+0x6c/+100) into
       cells with FUN_007646a0/FUN_00764d10.
8. [ ] **LAST READ: the consume method** — what reads the generator object's
       state to produce tiles. STATUS: the seeding chain is FULLY DECODED:
       g_worldseed → diddle-compensated double → halve → ×200000−100000 →
       stored in the generator object (+0x8c = raw seed, +0x94 = derived state).
       The generator object (0x1ec bytes) is per-biome created by
       FUN_0090ce20/FUN_008f9470 and stored per world-grid cell.
       The consume method = in the CHUNK-GENERATION path (lazy/streaming —
       not in Init; FUN_0079e440 = just a copy op; FUN_0090cfb0 = pixel scene).
       NEXT ROUTE: find what reads the generator object's +0x8c/+0x94 state
       when a chunk loads → that is the tile-generation code → from it, the
       vertex-coloring loop and the consumption pattern. The most efficient
       approach: a lab experiment — construct the object with a known seed
       (from our decoded chain), feed it through the game's chunk generation,
       and diff against the 548-vertex answer key.
9. [x] The 9999/200000/100000 constant chain is the SAME construction pattern
       as the fill's derived state. FUN_008f9470 = the definitive seeding
       function for the generator object (verified: diddle table at 0x11e0ba0,
       halve constant at 0x11e0220 = 2147483647, scale at 0x11dfdd8 = 0.5,
       C3 = 200000.0f at 0x11e0504, C4 = 100000.0f at 0x11e04ec).
5. [ ] Optional: h9 dumps (22 fns, 0x806000–0x80c000) = the biome Lua-API
       bindings region — several UNREAD (0080bee0 10 KB, 0080a5f0 8 KB,
       00809930 7 KB = AddScriptColor-family binding).

### F2 dig (2026-09-18, late) — first verified in-binary finalize finds

- **FUN_00900560 (procedural_terrain.cpp line 0x180** assert
  "pixels.IsValid( ipos.x, ipos.y )" — Ghidra dump `h12_procterrain_111_00900560.c`
  + objdump)** = the accepted-fill walker: 4-neighbor scan of the placed
  map for #C0FFEE (asm `cmp eax, 0xFFEEC0FF` at 0x900888/0x9008f6/0x90095f,
  the ONLY `c0ffee` byte sequences in .text — c0ffee exists in-binary at
  LE 0xffeec0ff; no 0x00c0ffee!) or empty (`test 0xffffff`), then per
  neighbor: u8-slot write 0x2 (top-neighbour) / 0x5 (left) via
  FUN_00949e80, a point+range push via **FUN_00929850** (queue push,
  40+ callers incl. 0x76xxxx UI family), plus asserts 0x1173c50
  ("checked_places.GetHeight() == pixels.GetHeight()") / 0x1173e20 /
  0x1175088 ("biome->bitmap_data"). This is the in-binary
  **fillC0ffee/walk (MapGen finalize family)** — heavier than noitool's
  simple fill (queue-driven with checked_places bitmap + per-pixel
  Schrage draw + rect pushes).
- **The "coalmine hax" is NOT a C++ hack — it is NOITAG-style biome-XML
  data.** Semantic strings in .rdata: **`do_beginning_paths`** = "if set,
  will do the paths that go down near the center of the image, used for
  setting up the caves to coal mines near where player starts" (VA 0x117c870)
  and **`do_beginning_down`** = "if true, will do a hole straight down"
  (0x117c8fc), both parsed for `<BitmapCaves>` (`size_x/size_y`,
  `blob_caves_*`, `cave_count_min/max`, `cave_strength_*`,
  `surface_caves_count_min/max`, `spawn_percent`, `DEBUG_output_image`,
  `structures`/`CaveStructure` — registration sites at 0x4af032/0x4b060d/
  0x4b21a8/0x4b56d1 + .rdata tuple table). Fields verified present in the
  extracted game data (hills.xml:41-42, desert.xml:48, forest.xml:37,
  mountain_tree.xml:47 …). **Overturns noitool's doCoalMineHax/undoHax as
  an in-binary mechanism** — its overlay-images hack has no 0x64/0x6400
  instance where those constants are used as was claimed (the found arr
  entries are registry noise). "hax"`) = a BitmapCaves engine feature that the game PARSES FROM biome-XML, not an asm pass; the remaining  "hax" = a BitmapCaves
  engine feature that the game parses from
  biome-XML, not an asm pass (the 0x64/0x6400 imm hits were registry noise).


### F2 dig #2 (same session) — hasPath main-fn found IN-BINARY (procedural_terrain.cpp family)

- **FUN_00901780 = the in-binary `MapGen::hasPath`/process-path check** (39 KB,
  0x901780..—; profiler scope "ProceduralPathFind" @0x1173e98):
  - asserts `wang_image.IsValid( x, y )` (0x1173ef4) — the check runs ON THE
    OUT_MAP (wang_image), not on a painted u16 grid; warns
    "couldn't clear start path finding area for the biome" (0x1173f4c)
    when the start-path region can't be cleared (the ClearPath step!),
    gated by debug byte 0x1327699 (logger 0x12ee538).
  - **the "coalmine start path" is a LITERAL in-binary constant:**
    `cmp eax, 0xFF420000` at 0x901a4d → writes 0xFF000000 at the cell
    (FUN_00949e80). So the "start_x=142"-shaped clearing is expressed via a
    special MARKER COLOR 0xFF42?? (LE bytes B4 00 42 FF = RGBA? value
    0xFF420000 high-byte-function) in the coalmine hax overlay — **not** the
    stale noitool 'start_x=142' int.
  - per-pixel write-delta cases: `imul 0x44d0b0` comparison
    (`cmp eax, 0xff420000`), plus general black `test 0xff000000` /
    `cmp eax, 0xff000000` walk-with-decode cases — same family as the
    C0FFEE walker at 0x900560 (writes 0xFF000000 to the cell where the
    u8 marker/gray test fails). Also a **`div 0x66666667` ÷10** block at
    0x901ac4-0x901af4 (cell-ten-arp math: 0x12ec170 minus 0x12eb708 …
    ∧ `imul`-based `%10` → `imm` / width-hax).
  - calls FUN_00a4e2f0/0xa4e430 (JPS jump routines?) using /3 divisions,
    mode 0xc, char 0x8e, then also -processing helpers (0x943da0 =
    "call on sample-color rect") — matches noitool's JPS describe
    (priority queued, 6-node neighborhoods).
  - The DebugSettings global with mDrawPathFinding* asserts
    (0x1173e98-family + "DEBUG_RAGDOLL_EXTRA_FORCE" nearby) → the game
    exposes **debug draw toggles for the pathfinding grid** — potential
    extra F4 names to test in-engine (mDrawPathFindingGrid/Paths).


### F2 dig #3 (same session) — the driver→hasPath→fill→walker pipeline EXACTLY traced

- The area driver FUN_00904c20 (once retried ≤100) tail (0x905890-0x9059xx):
  a) `cmpb 0x20(%esp),0` gate = the hasPath-skip flag (the ledger's
     "[ESP+0x20] AL=1" note — now an exact flag), then `call 0x901780`
     (hasPath, passing the wang_image rect), else AL=1 (skip).
  - Then: `call 0x901450` (= the map-apply post-process helper;
    0x1346cd8 = worker cache + 0x7eb3b0 worker ctor — the fill task pool),
    and the block "*.No.10 e30" per-attempt code prints "WANG AT: ..." +
    logs `Path generation for: <biome> took <n> times` (0x1174300 " - no path
    found!\n" — the RETRY push).
  - So the complete acceptance tail is: hasPath (0x901780 w/ skip flag)
    → FUN_00901780 → 0x905908 call (0x901450 = out_map→map rect) =
    the 0x901450 wrapper the C0FFEE worker (0x900560) was called from (2× at
    0x901e70/0x9028d8, each per-room rect in the fill) → the mapping loop
    drives u16 writes through FUN_00949e80 + 0x949f60 tiles.
- **fillBlockedRooms (0x13276ba-triggered 0x8ed860)**: right after the fill
  attempt accept (0x8eda10 Threaded call at 0x9056c8), the driver branch at
  `cmpb 0x13276ba,0` calls ** FUN_008ed860** with the SAME args
  (atlas data from area off +0x148/+0x14c/+0x150 = biomecfg.w/h/atlas) —
  this is the **"no-path-fill" secondary variant generator** (retry
  strategy fallback: after regular attempt, another Threaded call with
  same seed管线, likely the "fallback blockcolors fill" when hasPath
  fails open). NOT yet fully read (it's ~744 lines), but VERIFIED it's the
  second LifeCycle stage-6 generate before ClearPath.
- The `.data` block at 0x132aac8-… = 8-byte pairs (u32 index, u32 VA =
  0x00421e80 plz decoder) — this is the PLZ pixel-scene decoder side-table
  (for bit-apps) — NOT F2; parked.

## Method notes (do not relearn)

- **text.bin freshness (2026-09-18 trap):** a stale `~/tools`-era `text.bin`
  (extracted as `f[0x400:]` — the alternative convention) produced shifted
  objdump VAs (off by 0x400800) and nonsense decodes that LOOK plausible.
  Always regenerate: `f[0x400c00:0xdd0000]` + `--adjust-vma=0x401000`
  (then objdump VA = file+0x400 ✓), and assert `objdump section label
  = .data+0x...` understanding: the printed VAs are authoritative only if the
  slab starts exactly at file 0x400c00.


- Byte-scan fingerprints for 4-byte constants are noisy at binary scale
  (fd 43 03 00 = 697 hits — instruction fragments). Decompile-first works better.
- Hand-typing byte patterns failed twice (0x343FD typed as fd 34 00 00;
  0x269EC3 typed as c3 69 26 00) — COMPUTE bytes with writeUInt32LE always.
- Ghidra script API quirks (v12.1.3): `find(String,Address)` doesn't exist;
  `getDefinedStrings(...)` signature differs; `findBytes(null, hex)` silently
  finds nothing in .rdata — use computed VAs + `getReferencesTo`.
- Ghidra script compile errors surface only via direct javac against the jars:
  `javac -proc:none -cp "$(find ~/tools/ghidra -name '*.jar' | tr '\n' ':')" -d /tmp/classes Script.java`
- Ghidra zip extraction via python zipfile loses exec bits — chmod the native
  binaries (decompile/sleigh) or every decompile call fails with an empty error.
- LuaManager list: `DAT_01347698` (head) `.9c` (end) `.a0` (capacity) — global
  CAutoList of BiomeSpawnScripts::GameLuaManager.

## Session close (2026-09-05 late) — the state after exhaustive tracing

### What we've decoded from the binary (ALL VERIFIED)

The seeding chain from g_worldseed to the generator object:
```
g_worldseed (DAT_01327ffc)
  → FUN_009119d0 (GetSeed, asserts g_worldseed_is_valid)
  → FUN_0090ce20 (allocates 0x1ec bytes, calls FUN_008f9470)
    → FUN_008f9470 (the random-state constructor):
      +0x8c = raw seed (stored)
      d = (double)seed + diddle_compensation
      if (d >= 2147483647) d ×= 0.5
      FUN_010098c0() ×2 (two Next() advances of the global poro PRNG)
      +0x94 = (float)d × 200000.0f − 100000.0f
    → the object is stored per-biome in the world grid
```
Every constant verified from .rdata: diddle table at 0x11e0ba0,
threshold 2147483647 at 0x11e0220, scale 0.5 at 0x11dfdd8,
C3 = 200000.0f at 0x11e0504, C4 = 100000.0f at 0x11e04ec.

The source tree (330 files) recovered from assert strings:
- `source/procedural_utils/` — world_seed.cpp, procedural_terrain.cpp,
  biome.cpp, biome_materials.cpp, noise_utils.cpp
- `source/grid/` — gridworld.cpp etc. (the falling-sand simulation)
- `poro/source/` — the engine framework (random.cpp etc.)

The world data model: parallel float grid + u16 material-ID grid.
The spawn registry: GameLuaManager (+0x8c map of color→Lua function name),
spawn queue, camera-culled processor.

### What we've tested and eliminated (with the 548-vertex key)

- Sequential poro mixer walks (every pixel as seed point, 94M+ candidates): NOISE
- World-seed skips ≤200k: NOISE
- Positional hashing (4 coordinate systems × offsets × 7 shapes): NOISE
- Global LCG (×214013+2531011) consumers: all gameplay, NOT the fill
- Derived-state families (×200000−100000, 7 variants): 48–53% = chance
- Biome-grid seeding: NOISE
- Per-chunk lattices: structurally excluded

### What we've decoded but NOT yet connected to vertex colors

The generator object (0x1ec bytes) holds the seed and derived state.
The consume method — what reads these to produce vertex colors — is NOT:
- In the generator class neighborhood (0x8f8000–0x8fc000 = noise utils)
- In the Init chain (FUN_0090e840 → FUN_00910c20 → FUN_0090c1f0)
- FUN_0079e440 (just a copy op), FUN_0090cfb0 (pixel scene), FUN_0092cb50 (init)

### The consume method lives in the CHUNK-GENERATION path

The game generates tiles LAZILY — when a chunk comes into the camera viewport.
The consume method is called from the chunk-loading code, not from the world
init. This is the streaming/streaming-chunk-target system (STREAMING_CHUNK_TARGET
magic number from the mapcap magic-numbers file).

### Next-session approach

The most direct: find the function that reads the generator object's +0x8c
(the stored world seed) or +0x94 (the derived state). Search strategies:
1. Ghidra xrefs to the KNOWN storage offsets within the 0x1ec-byte object
2. The stbhw generate call: the color_source function pointer passed to the
   herringbone generator IS the consume method
3. Lab experiment: verify the seeding chain empirically (set g_worldseed to a
   known value via the seed mod, read the generator object's state via a probe
   mod, compare with our decoded derivation — confirms the chain before
   hunting the consume)

## Correction (2026-09-05 very late): FUN_00fec850 is the RENDERER, not the fill

The 1690 indirect calls in FUN_00fec850 (30 KB) are OpenGL vertex calls through
function pointers loaded by FUN_00fec6b0 (the OpenGL/Win32 init — "FGL" = the
graphics layer). This is the world RENDER function, NOT the wang generation.
The indirect-call-count approach found the renderer because OpenGL calls also
go through function pointers.

## The path forward

The consume method (vertex coloring) is in the CHUNK-GENERATION path. The
static-analysis approach (tracing decompiled C through the binary) has mapped
the infrastructure but not reached the consume method due to:
- Many layers of engine abstraction (procedural_terrain → biome → generator
  object → consume → stbhw generate → tile placement)
- Lazy/streaming generation (not in the init path)
- The decompiler's difficulty with heavily optimized C++ code

**RECOMMENDED NEXT APPROACH: the empirical method.**
Instead of tracing static code, use the GAME as an oracle:
1. Run the lab with different world seeds (S, S+1, S×2, etc.)
2. Record the vertex colors for each seed (the lab dumps)
3. Compare: which vertices change? How do they depend on the seed?
4. From the observed input→output relationship, deduce the consume rule

This is the same approach that successfully reverse-engineered the poro PRNG
(2.1M draws, 100% match) — but applied to the vertex-coloring system instead
of the RNG itself. The lab infrastructure (probes, answer keys, the
verification pipeline) is already built and tested.


## Derived-state test results (2026-09-05, commit 5d181d3)

The generator object's +0x94 field (derived state from g_worldseed) was tested
as a Lehmer PRNG seed in 7 variants:
- F1: derived_int → NollaPrng sequential walk: 49.82%
- F2: float_bits → u32 → NollaPrng walk: 51.64%
- F3: seededPrng(ws, area) walk: 52.92%
- F4: worldseed → 2×Next → walk: 52.01%
- F5: raw_seed → NollaPrng walk: 48.36%
- F6: derived_int warm+random walk: 48.54%
- F7: FUN_008efdd0 derivation → walk: 48.36%

ALL at chance level (noise floor ~58.5% at n=548). The consume method does
NOT simply seed a Lehmer PRNG with the derived state and walk vertices.

## Key insight: the consume method reads the LOCAL state, not the global PRNG

The fill is order-INDEPENDENT (verified: 100% identical placements across
camera paths). If the vertex coloring used the global poro PRNG (which is
advanced by every generator object creation), the fill would be order-DEPENDENT.
Therefore: the vertex coloring MUST use a LOCAL state (the +0x94 derived state,
or the +0x8c raw seed) with its own PRNG advance.

The consume method reads the LOCAL state and applies a transformation we
haven't identified. The transformation is NOT:
- Lehmer PRNG seeded with the derived state
- Lehmer PRNG seeded with the float bits of the derived state
- Lehmer PRNG seeded with the raw seed
- poro mixer seeded with the area coordinates

The consume method might:
1. Use a completely different PRNG (not Lehmer, not LCG)
2. Use the state as an index into a pre-computed table
3. Combine the state with other inputs (biome color, position, etc.)
4. Use a completely different algorithm

## The most direct next approach

Find the function that reads the generator object's +0x8c or +0x94 field.
The generator object is 0x1ec bytes. The +0x8c (seed) and +0x94 (derived)
fields are read by the consume method. Ghidra can find all functions that
access these specific offsets within the context of the 0x1ec-byte object.

Alternative: find the CREATEHERRINGBONEWANG function. The binary contains
the function name as an assert string (VA 0x1172ffe, 0x1173009, 0x117428d).
The function is somewhere in the binary. It would:
1. Take the atlas/biome data as input
2. Set up the vertex coloring
3. Call the stbhw generate (or equivalent) to produce the tile map
4. Return the generated chunk data

The Ghidra xref search for these string VAs returned 0 results, likely
because the strings are referenced through a different mechanism (e.g., a
vtable or function table rather than direct code references).

## Session 2026-09-07 — CREATEHERRINGBONEWANG FOUND — the fill is READ (hunts 33–35)

**Why the old xref search failed — two independent bugs:**
1. The ledger's string VAs (0x1172ffe/0x1173009/0x117428d) are 6/11/17 bytes
   INTO the strings (substring starts: "Herringbone"/"Wang"), not C-string
   starts. Correct starts: **0x1172ff8** ("CreateHerringboneWang"),
   **0x1173003** ("..._Threaded"), **0x117427c** ("CreateHerringboneWang(").
   getReferencesTo(mid-string address) can never match.
2. The entries were golden either way — the strings have NO direct refs at
   all: `CreateHerringboneWang`/`_Threaded` are **profiler scope names**
   (`FUN_010324ea("CreateHerringboneWang")` at function exit), so they get no
   code xref; getReferencesTo(FUN's name string) nevertheless hits
   FUN_008ed490 because Ghidra indexes the `FUN_010324ea` reference.

Method that worked: numpy scan of the whole file for **u32 == full string
VA** (this is a 32-bit x86 binary — .text begins file 0x400 ↔ VA 0x401000;
string literals are `push imm32` absolute addresses, no RIP-relative). Scan
+ verification scripts: /tmp/opencode/wangscan*.py (session temp, JS-side
re-derivation trivial). Confirmed real sites: `push 0x1172fdc` at VA
0x8ed44b ("seed <= ..." with __LINE__ 0x94=148) and
`push 0x1174254` at 0x9050a6 ("height <= 1024", line 0x714=1812).

### The fill subsystem (all functions dumped h33/h34, evidence in ghidra-logs)

| Function | VA | Role | Assert-leaked source |
| --- | --- | --- | --- |
| FUN_008ed490 | 0x8ed490 | **Biome::CreateHerringboneWang** | biome.cpp (line 0xcd=205 asserts inside) |
| FUN_008eda10 | 0x8eda10 | **CreateHerringboneWang_Threaded** (asserts xs/ys ∈ [1,2048], line 0x119/0x11a) | biome.cpp |
| FUN_008ec9f0 | 0x8ec9f0 | **stbhw_generate_image** (the consume method) | stb_hbwang |
| FUN_008ec710 | 0x8ec710 | stbhw choose_tile (2-pass count-then-pick, one draw) | — |
| FUN_008ec5d0/670 | 0x8ec5d0/0x8ec670 | place h/v tile (pure blit, no RNG) | — |
| FUN_008ec8e0 | 0x8ec8e0 | rep-reduce re-roll (`(p+1+rand%(cc−1))%cc` / weighted) | — |
| FUN_008ed0f0 | 0x8ed0f0 | build tileset from PNG (header decode i*55, C0 flag, cc<33, vary<65 — matches our JS) | — |
| FUN_010098c0 | 0x10098c0 | poro Random::Next() — Schrage 16807/127773, TLS state. random.cpp:0x66 asserts Seed!=0 | poro random.cpp |
| FUN_01033781 | 0x1033781 | CRT double→u64 (15 bytes) — a "draw" = Next() then (u64)state | — |
| FUN_00904c20 | 0x904c20 | **area driver** (procedural_terrain.cpp:1808-1850 asserts) — seeding + skip + ≤100 attempts | procedural_terrain.cpp |
| FUN_00904b10 | 0x904b10 | **area-object ctor (0x154 B)** — `[+0x4c] = arg` = the fill's seed; runs FUN_008f9470 on the sub-object at +0x90 | procedural_terrain.cpp (Init walker) |
| FUN_008f95c0 | 0x8f95c0 | SetSize(w,h): (re)allocates the float grid (+0x18) + u16 material grid (+0x38) of its `this` | — |
| FUN_0090c820 | 0x90c820 | 0x90-byte record copy-ctor (strings at +0x0c/+0x24/+0x3c) — the area-cache record clone | — |
| 0x1199d40 | — | NOT a class vtable — a **std::function functor vtable**; Init submits one fill task per area (thunk = the lambda's invoke, passing the captured area object) | — |
| FUN_010098c0 | 0x10098c0 | poro Random::Next(double\* state) — Schrage core **AND returns `state × 4.656612875e-10` in XMM0** (asm 0x109932); callers ×2147483645 → (u64)-trunc = nextU() | poro random.cpp |
| FUN_0090ce20 / FUN_008f9470 | 0x90ce20 / 0x8f9470 | per-cell generator object ctor (0x1ec B): +0x23(raw=[0x8c]) seed stored; d=(double)seed+diddle[sign]; halve; Next()×2; **+0x25(=+0x94)=(float)d×200000−100000** (constants 0x11e0504/0x11e04ec verified) | — |

### The decoded recipe (state machine, biome.cpp + stb_hbwang.h)

```
seed_state = (double)(u32 promoted seed)        // diddle = {0.0, 4294967296.0} @0x11e0ba0, index = seed>>31
if (seed >= 2147483647.0) seed *= 0.5           // @0x11e0220 / @0x11dfdd8
seed = Next()                                    // ONE warm-up (0x10098c0)
skip = (width % 11) + ((u32)seed_int % 12)       // width SIGNED trunc-mod; seed UNSIGNED mod (@0x905273 magic consts)
advance skip times (inline Schrage)
attempt ≤ 100:
    clear blocked-rooms vector (0x90-stride elements)
    seed = Next() -> stored as new sub-RNG seed
    sub_seed = sub_seed * 2^-31 * 2147483645     // = rng.NextU() EXACTLY @0x905697/0x90569f
    CreateHerringboneWang_Threaded(w, h, ..., seedint, sub_seed(double))
      → TLS Random (TLS+0x14, lazy ctor via 0x8ebf00) seed = sub_seed, then ONE Next() (warm-up)
      → buildTileset(atlas PNG) once (cached? per-call @0x8ed0f0)
      → stbhw_generate_image(buf, w*3, w, h+4):
          vertex grid: xmin/ymax = w/s+6 × h/s+6, row stride 0x6a=106 (= STB_HBWANG_MAX_X+1? 0x6a—106)
          per vertex scan order: state = Schrage(state); c_color[j][i] = (u64)state % cc[(i+j)&3]   ← CLASS FORMULA (i+j)&3
          rep-reduce pass (3×2 neighbor match → reroll via cc−1 mod trick), gated by cc>1
          herringbone scan: ypos=−s, j=−1, phase=j&3 pattern... choose_tile = 2-pass count + rand%count draw
          stb +4 window: buf is (h+4) rows; copy loop starts j=−4, grid row k ← buf row k+4 (top 4 discarded) ✓ noitool-consistent
    hasPath check (FUN_00901780) → accept or retry
```

### THE SMOKING GUN for the 644M-candidate failure

The binary's vertex class is `p = (i+j) & 3` (@0x8ec9f0 vertex coloring,
`param_1[(iVar13 + local_18 & 3) + 1]`). Our port/lab used §3ter's
`(i−j+1)&3`. Wrong class ⇒ drawing `%` the WRONG count for ~half the
vertices ⇒ 50% noise floor on ANY walk — the exact result the lab optimizer
produced (58.03%). The `(I−J)&3 ∈ {0,2}` parity correction from lab recovery
is consistent with (I+J)&3 (same parity classes). **A re-test of
S1/S2-style walks with the corrected class formula + full pipeline
(rec-reduce + choose_tile + 4-row discard + rejection) is the immediate next
step — lib/wang-js.mjs fill + 548-vertex answer key can do it O(minutes).**

### Remaining wiring (next session, ONE read)
- ~~Who calls FUN_00904c20~~ **RESOLVED 2026-09-07 (hunt 36):** the single xref
  FUN_00a99ea0 = a vtable thunk `mov ecx,[ecx+4]; jmp 0x904c20` at vtable
  0x1199d40 (slot 2; vtable installed by FUN_0090e840 @0x907abf). The area
  object read in 00904c20: seed = `[this+0x4c]` (loaded at 0x904d3b→0x904d4f
  together with the [0x3c..0x4b] MOVDQU param copy). **The seed is NOT the
  raw worldseed** — it comes from the per-area seed constructor:
- **FUN_00904730 = the mSeed constructor** (procedural_terrain.cpp:1669-1691,
  "mSeed" assert at line 1680 vs _DAT_011df878 — the same cached-seed global
  CreateHerringboneWang compares):
  ```
  ws = WORLDSEED::GetSeed()                        (asserted != 0, line 1669)
  d  = (double)ws + diddle[ws>>31]                 // {0.0, +2^32} unsigned promote
  FUN_008ed3a0(d)                                  // biome.cpp:148 guard d <= 2147483645; stores DAT_013276c8/d0
  Next()                                           // ONE advance (state now runs on the TLS poro)
  mSeed = (double)((float)d * 9999.0f + 1.0f)      // 0x11e0494 = 9999f, 0x11dfbf0 = 1.0f — verified
  Next()
  state_a = (float)d * 200000.0f - 100000.0f       // 0x11e0504/0x11e04ec — verified
  Next()
  state_b = (float)d * 200000.0f - 100000.0f       // same constants again
  ```
  (This is the SAME 9999/200000/100000 pattern the ledger §5 found in
  ProceduralTerrain::Init — it is the per-area version of that chain, and it
  feeds the ancestor of the fill's per-area seed.)
- FUN_0090c1f0 (procedural_terrain.cpp): caches/dedups areas by
  (width, height, seed) tuple from the generator object's fields
  [0x7]/[0xd]/[0x13] — the ONCE-PER-AREA rule across chunks confirmed
  in-binary; stride-0x90 registration records match the per-attempt
  destructed-room vector in 00904c20.
- Cell wiring: world-grid init (FUN_0090e840) allocs the 0x1ec object per
  biome, ctor FUN_0090ce20→FUN_008f9470 seeded with WORLDSEED::GetSeed()
  (raw worldseed → +0x8c raw; +0x94 = derived float ×200000−100000), then
  overwrites +0x90/+0x94 from the walker's params.

### VERIFICATION (the remaining step — numeric, not decompilation)

~~Byte-level object layouts differ between the seed ctor writes (+0xc/+0xe/
+0x10/+0x12 doubles) and the fill's reads ([0x4c]); the missing ~10% is
mapping which derived field (mSeed / ×200000−100000 state) lands at the
fill's seed input.~~ **RESOLVED + OVERTURNED (2026-09-07 late, hunts 37–45,
see ABOUT_MATH §7novies for the full asm-verified recipe):**

- The fill's `this` = the **0x154-byte AREA OBJECT** built by Init's biome-map
  walk (NOT the mSeed-ctor object, NOT the 0x1ec generator object). Ctor
  **FUN_00904b10**: `[area+0x4c] = ctor arg` (asm 0x904b71); arg =
  **`WORLDSEED::GetSeed() + DAT_01328010`** (asm 0x9062d4) —
  DAT_01328010 = **NEW_GAME_PLUS_COUNT magic number, default 13589**.
  The hunt-36 "seed comes from the per-area seed constructor" was WRONG
  (that ctor object = the ProceduralTerrain, different struct).
- "vtable 0x1199d40" = a **std::function functor vtable** (Init's task
  submission; asm 0x907abf writes it to a stack local) — the fill runs as an
  Init-time thread-pool task with the area object captured.
- Class formula = **`(i − j + 1) & 3`** in gen space — the same-day
  "(i+j)&3 correction" misread the decrementing row counter (asm 0x8eca4b
  `MOV EBX,1` … 0x8ecacd `DEC EBX`). §3ter was right; in key space it
  equals the lab's `(I−J)&3` after the 1-vertex-row discard.
- ALL draws (vertex 0x8eca9e, reroll 0x8ec950, choose-tile 0x8ec855) =
  **`nextU() % m`** — poro `Next()` RETURNS `state × 4.656612875e-10` in XMM0
  (asm 0x109932) and callers `MULSD ×2147483645` + `(u64)`-trunc
  (FUN_01033781 = `__dtoui64`). The port's `nextU()` is exact.
- GetRNG skip = `(width % 11) + (u32)seed % 12` — the decompile's `+local_c8`
  is part of the %11 algebra (the magic-mul term is NEGATIVE
  −11·⌊w/11⌋). No extra width. Asm 0x905273–0x9052b1.
- mSeed ctor chain: the Nexts advance the LOCAL chain (asm pattern at
  0x905264 `LEA ECX,[ESP+0x24]`); with x86 CVTTSD2SI saturation,
  `stateA`/`stateB` are SEED-CONSTANT → eliminated a priori; only `mSeed`
  varies.

**THE NUMERIC VERDICT (negative):** the asm-exact model driven by
seed = ws+13589 (and ~40 other candidate derivations × 4 draw conventions ×
attempts 0..99 × offsets × widths × skip deltas ≈ 27k walks/seed) does NOT
reproduce the 548-vertex lab key — best ≈ 60–66% = noise ceiling
(`experiments/2026-09-07-area-seed-candidates.mjs`, + `-ext.mjs`).
The divergence must be in the runtime value reaching `[area+0x4c]` (or
DAT_01328010's runtime value — it is magic-number-writable). **Next: hook
FUN_00904c20/008eda10 in the dev build and log [area+0x4c] + the first
nextU values for a known seed — one number settles it.**

## Session 2026-09-08 — the sub-seed is MEASURED (hunts 46–52 + the S-sweep)

**Method note first:** instead of hooking (probe target 2), we inverted the
problem: brute-forced the TLS sub-RNG state S over [0, 2^31) against the
548-vertex lab key (the walk mechanics were asm-verified; S is the only
per-attempt unknown). Instrument: `experiments/2026-09-08-subseed-sweep.c`
(16 threads, 2.147e9 candidates ≈ 58 s wall; early abort at 25% mismatch —
rep-reduce flips only ~11% of informative vertices, calibrated 8.8–12.9%).
Planted-solution test (S0=123456789) → exactly 1 survivor in the full range;
C↔JS FNV grid hashes bit-identical. **RESULT: exactly one S per seed —
S₉₁=1228813614, S₉₂=1319606147, S₉₃=1966969580** (all at key→gen offset
(−5,−6)); post-reduce match 498/500, 325/327, 395/403. 1206/1218 informative
vertices exact across three seeds ⇒ **the walk mechanics are measured-correct;
the 644M failure and the 2026-09-07 negative were purely the SEED.**
Full story + evidence tables: ABOUT_MATH §7decies. 12 residual mismatches,
all gen-border zones, systematic across seeds (key(5,23) fails in 91 AND 93)
— OPEN, parked.

### New verified anchors / verdicts (this session)

| Function | VA | Verdict |
| --- | --- | --- |
| `FUN_00922950` | 0x922950 | magic-number bind/parse (2684 B): binds NEW_GAME_PLUS_COUNT→DAT_01328010 (register via FUN_00442f50(&DAT_01328010) = the current default as fallback; parse `DAT_01328010 = FUN_004448e0()` @0x6fa1f8 is in FUN_006fa0d0). Name mapping independently confirmed in-binary: string "NEW_GAME_PLUS_COUNT" VA 0x1199be4 pushed 16 B before `push 0x1328010` @0x6f9f9e. |
| `FUN_009233d0` | 0x9233d0 | **biome-map RESET (89 B): sets DAT_01328010 = 0** + `is_biome_map_initialized`=0 + BIOME_MAP paths to defaults + DESIGN_SCALE_ENEMIES=0 + NG+ scales 1.0f. ⇒ fill-time NEW_GAME_PLUS_COUNT = 0 (no XML defines it); §7novies' "C = ws+13589" is DEAD (C = ws). Timing of the reset vs Init unverified — moot, both 0 and 13589 are excluded by measurement (below). |
| `FUN_00904c20` | 0x904c20 | **area driver — chain asm-verified end-to-end** (h47 full decompile, 4997 B + objdump): [ESP+0x4c]=[area+0x4c] (0x904d3b/0x904d4f); diddle/halve (0x90523c–59); ONE warm-up on the LOCAL Random object at [ESP+0x24] (0x905264–6e); skip = (w%11)+((u32)C%12) (0x905273–b1, magics 0xaaaaaaab & 0xd1745d17=−0x2e8ba2e9); ≤100 attempts, 1 Schrage each (0x905643–67a; Schrage exact: 16807·(n mod 127773) − 2836·⌊n/127773⌋, +M if ≤0); **param_9 = (double)state × 4.656612875e-10 × 2147483645** (0x905681–a7; MULSD [0x11df988]=C1 — the JS literal, bits 685f1c000000003e, ONE .rdata hit @file 0xddeb88; [0x11e0210]=2147483645.0 @file 0xddf410); coalmine/excavationsite string checks → FUN_00901580; hasPath = FUN_00901780. |
| `FUN_00904c20` tail | 0x905a93+ | **the spawn-color walker FOUND (the enqueue side)**: per placed pixel → color → BiomeSpawnScripts std::map lookup → ONE Schrage draw per pixel → FUN_00900c70 (queue insert). Closes the ledger's old "find the ENQUEUE side" item. |
| `FUN_008eda10` | 0x8eda10 | Threaded (1309 B): asserts xs/ys ∈ [1,2048]; cached-seed check `param_9 != _DAT_011df878 (0.0)` (DAT_013276c8 = write-only cache); FUN_008ebf00 lazy TLS ctor; **TLS Random.seed = param_9 (the UNTRUNCATED double**, halved if ≥ 2^31−1 — never: param_9 < 2147483645); ONE warm-up Next; FUN_008ed0f0 buildTileset; FUN_008ec9f0(w·3, w, h+4); copy loop j=−4.. = the +4-row discard; FUN_008ed320. |
| `FUN_008ebf00` | 0x8ebf00 | lazy TLS Random ctor (74 B): if TLS+0x14 == 0 → operator_new(8) + FUN_00452ba0; then an UNCONDITIONAL tail Next() + double→u64 (an extra advance of the TLS object — absorbed by the sweep's S convention). |
| `FUN_00904b10` | 0x904b10 | area ctor (264 B): `[area+0x4c] = arg` (raw store, param_1[0x13]); FUN_008f9470(arg) on the sub-object. Ctor call site 0x9077d9: `PUSH [EBP-0x270]; MOV ECX,EAX; CALL` — the arg slot [EBP−0x270] is written once at 0x9062e0 (= GetSeed()+DAT_01328010, h50b slot scan); puVar20[0x13] has NO other writer in the walk (only [0x0d]/[0x0e] w/h and [0x23] sub-seed). |
| `FUN_008f9470` | 0x8f9470 | generator ctor (336 B): sub[+0x8c] = raw seed; d = (double)seed + diddle[sign]; halve if ≥ 2147483647; **2 GLOBAL poro Nexts**; sub[+0x94] = (float)d×200000f − 100000f. |
| `FUN_00904730` | 0x904730 | mSeed ctor (926 B): **all three float outputs derive from d = ws UNCHAINED** — mSeed = f32(f32(ws)·9999f+1f) → +0x30; stateA = stateB = f32(f32(ws)·200000f−100000f); its 3 Nexts advance the GLOBAL poro (decompile shows the working double unchanged). Supersedes the h37–45 "local chain" reading and §7novies' CVTTSD2SI-saturation "stateA/stateB seed-constant" reasoning (based on a misread; moot anyway). |
| `FUN_00beeee0` | 0xbeeee0 | game-mode dispatch, reads DAT_01328010 ×3 (cmp 0x21/0x0b — NG+ mode checks) — reader only. |

### THE OPEN CONTRADICTION (measured, not modeled)

16807 is a PRIMITIVE ROOT mod 2^31−1 (ord = 2147483646, computed) ⇒ orbit
distances well-defined. The chain requires dist(C → S) = 1 + skip + (A+1) ≤ 116.
Measured (BSGS, `experiments/2026-09-08-subseed-invert.mjs` + BSGS runs):

| start → target | 91 | 92 | 93 |
| --- | --- | --- | --- |
| ws → S | 852105533 | 34730815 | 468297758 |
| ws → f⁻¹(S) | 1617467129 | 532342600 | 968007978 |
| ws+13589 → S | 1659374935 | 1830001187 | 1112350975 |
| ws+13589 → f⁻¹(S) | 1382122050 | 1649871861 | 1647773426 |

Also: backward inversion over (mode ∈ {state,nextU}, attempt 0..99,
skip 3..14) = 407/411/190 valid base seeds per seed — ws, ws±1, ws+13589
NOT among them; no (mode, attempt, skip) with a constant delta across seeds
(0 configs); the three S are mutually unrelated orbit points (~1e9 pairwise);
no tested structured start (ws, Schrage^k, mSeed chain V1/V2/REAL-unchained,
f32-bit encodings) within 400 orbit steps of any S.

### Next-session routes (in order)

1. **Hook the driver** (probe target 2, now armed): log `[area+0x4c]` at its
   read (0x904d3b), the attempt `state` (0x905643), `param_9` complete at
   0x9056a7 (XMM0). If logged C' ≠ ws → re-run the inversion from C'.
   Cheat Engine / x64dbg, lab mod + seed mod, seed 78633191.
2. **Whole-binary scan for other writers of [area+0x4c]** (the fill task
   runs async after the ctor; the slot may be rewritten between walk and
   task — the ctor-site evidence rules out rewrites during the walk, not
   after it).
3. If C' = ws after all: the gap is between the local Schrage state and
   param_9 for the LAB area specifically (a second FUN_008eda10 caller, or
   FUN_00904c20 reached through another path).
4. The 12 border-zone key mismatches: keep parked unless the seed closes.

### Method notes (do not relearn)

- Ghidra OSGi bundle cache CORRUPTED after a failed compile (50b worked,
  everything after failed with "Failed to get OSGi bundle"; clearing
  `~/.config/ghidra/ghidra_12.1.3_PUBLIC/osgi` did NOT fix it). Workaround:
  raw disassembly via objdump — extract .text to a file
  (`python: data[0x400:0xdd0000]` → /tmp/opencode/text.bin), then
  `objdump -D -b binary -m i386 --adjust-vma=0x401000 --start-address=VA
  --stop-address=VA /tmp/opencode/text.bin`.
- JDK must be in PATH for headless runs: `export JAVA_HOME=~/tools/jdk
  PATH=~/tools/jdk/bin:$PATH`.
- Ghidra script API: iterate instructions via
  `currentProgram.getListing().getInstructions(f.getBody(), true)`
  (InstructionIterator cannot be constructed directly); `new AddressSet(...)`
  ranges failed to compile under OSGi — filter by address client-side.
- Binary scan for u32 constants (struct.unpack loop over the whole 17 MB
  exe) found the magic-number registry pairs and ALL xrefs of DAT_01328010
  in seconds — cheaper and more complete than Ghidra xrefs for absolute
  32-bit references.
- Constants byte-verified this session: diddle {0.0, 2^32} @0x11e0ba0
  (file 0xddfda0); 2147483647.0 @0x11e0220; 0.5 @0x11dfdd8; 2147483645.0
  @0x11e0210 (file 0xddf410); C1 4.656612875e-10 @0x11df988 (file 0xddeb88,
  ONE hit; 1/(2^31−1): zero hits); DAT_011df878 = 0.0; .data default
  NEW_GAME_PLUS_COUNT = 13589 @file 0xf26610.
- Sweeper artifacts are session-temp (`/tmp/opencode/subsweep/`); regenerate
  key files with `node mapgen/experiments/2026-09-08-subseed-sweep-export.mjs`,
  rebuild with `gcc -O3 -march=native -funroll-loops -o subsweep
  mapgen/experiments/2026-09-08-subseed-sweep.c -lpthread`.

## The old ledger text (pre-2026-09-07) is retained above (sessions h1–h32)

