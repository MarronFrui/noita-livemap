# Ghidra function ledger — noita_dev.exe investigation state

> Processing ledger for the decompilation hunt. Update every session:
> a function's verdict is FINAL unless new evidence overturns it — never
> re-dump, never re-read without a reason. Facts with evidence go to
> `ABOUT_MATH.md`; this file is the processing state only.
>
> Dumps live in `~/work/ghidra-logs/` (outside the repo). File→VA mapping:
> .text file+0x400c00 · .rdata file+0x400e00 · imageBase 0x400000.

## Verified anchors

| Function | VA | Verdict |
| --- | --- | --- |
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
       - **FUN_00904c20 (25 KB) = recursive biome-map processor in WORLD PIXELS**
         (`× 0x200 − DAT_01327670/013289a8` = world-origin globals; self-
         recursion = the area walk; FUN_00949e80 = biome-map accessor) — dumped
         (h13b), UNREAD in detail — prime next read: the per-biome generation
         entry + its seeding.
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
7. [ ] After the fill is identified: extract generator + seeding derivation +
       consumption pattern → new lab-search family → planted-verification on
       the 548-vertex key.
5. [ ] Optional: h9 dumps (22 fns, 0x806000–0x80c000) = the biome Lua-API
       bindings region — several UNREAD (0080bee0 10 KB, 0080a5f0 8 KB,
       00809930 7 KB = AddScriptColor-family binding).

## Method notes (do not relearn)

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
