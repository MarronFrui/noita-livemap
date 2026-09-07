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
