# VERIFIED.md — Noita map-gen: the canon

> **What this file is:** the distilled, current truth about Noita's procedural
> map generation — verified facts only, each with a source pointer. It exists
> so context can be fed from one file instead of re-reading the research
> trail. Research traces, false leads, hypotheses and their stories live in
> `ABOUT_MATH.md` (evidence log §6+) and `ghidra-ledger.md` (decompilation
> processing state); this file holds only what survived.
>
> **Tl;dr state (2026-09-08, night):** **THE WANG LAYER IS PREDICTION-SOLVED,
> END TO END.** Worldseed → GetRNG (warm-up + skip = (w%11)+(ws%12)) →
> per-attempt sub-seed → TLS → vertex coloring (`(i−j+1)&3`) → rep-reduce →
> herringbone fill → **hasPath rejection → the game's accepted attempt** —
> every link asm-verified or oracle-validated. `generateAreaExact(seed, area)`
> reproduces the game's terrain skeleton exactly (~10 ms/area). Remaining for
> visuals: paint layers (post-wang finalize: random-block / material fills —
> re-derive from the binary), pixel scenes, template biomes (§9).
>
> **Maintenance rules:**
> - A fact enters here only after it is settled, and must carry a source
>   (file + section) that was re-verified on disk when the entry is written.
> - On overturn: move the old claim to §8 (eliminated) with a date and a
>   one-line reason — never delete silently, never leave two "current" truths.
> - To research a specific entry's history, follow its source pointer into
>   `ABOUT_MATH.md` / `ghidra-ledger.md`.

Legend: ✅ empirically verified (ran it / byte-compared / measured in-game) ·
🔬 asm-verified (read from `noita_dev.exe` disassembly, constants byte-checked) ·
🔗 cross-confirmed (independent sources agree, no direct probe) ·
⚠️ decoded but not closed (code path read; runtime input unmeasured).

**AUTHORITY STATEMENT (2026-09-08):** every load-bearing fact here stands on
our own Ghidra asm verification of `noita_dev.exe` (build 2025-01-26, 32-bit
x86) plus game-side oracle validation. **`vendor/noita-tools` (noitool) is
OBSOLETE as a reference — do not compare against it, do not port its code
unchecked.** Its wasm output was eliminated as game terrain (§8 row 1), and
its shipped code contains silent bugs (e.g. its coalmine-hax constants
`0x004000`/`0x0040` never match its own overlay data `0x006400`/`0x000064` —
the hax is a no-op there). Vendored files may still be READ as convenient
data containers (e.g. the overlay bytes), never as authority.

---

## 1. Coordinates & world structure

| Fact | Value | Status | Source |
| --- | --- | --- | --- |
| Chunk size | 512 world px; main world = 70 chunks, x −35..+34 | ✅ | ABOUT_MATH §1 |
| Biome map | 70×48 px, 1 px = 1 chunk (`data/biome_impl/biome_map.png`) | ✅ | ABOUT_MATH §1 |
| Biome px → chunk | `cx = tx − 35`, `cy = ty − 14` (offset 14 = game's `biome_offset_y`) | 🔗 | ABOUT_MATH §1 |
| Chunk → world px | `GetGlobalPosX(x,y) = 512*(x−35)`, `GetGlobalPosY = 512*(y−14)` — pure linear, no rounding | ✅ | w/:105; ABOUT_MATH §1 |
| Area width in cells | `GetWidthFromPix(a,b) = (b*512)/10 − (a*512)/10`, **C truncating** division (trunc ≠ floor on negatives) | ✅ | w/:77; ABOUT_MATH §1 |
| Wang cell | 10 world px; 512/10 = 51.2 cells/chunk (non-integer ratio) | ✅ | ABOUT_MATH §1 |
| Atlas px ↔ wang cell | 1:1 | ✅ | ABOUT_MATH §1 |
| Capture (DZI) | level 17 native, TileSize 512, overlap 2; `imagePx = worldPx + (17920, 31744)`; tile `i_j` = biome px `(i, j−48)` | ✅ | ABOUT_MATH §1 |
| Wang lattice | **GLOBAL and continuous across chunk boundaries** — no per-chunk re-anchoring (v-tile phase mod 4 = 3 in every chunk/seed; tiles straddle boundaries at fractional 51.2 edges) | ✅ | ABOUT_MATH §7septies (lab) |
| Chunk seams | The game does NOT blend across chunk boundaries — real hard material seams measured (x=2048 4.6×, y=1536 3.6× interior baseline) | ✅ | mapcap/README "Verified facts" |

## 2. RNG machinery

- **Core (Lehmer/Schrage, minstd):** `Next(): v = 16807*(int)Seed − 2147483647*((int)Seed/127773)`; `if (v <= 0) v += 2147483647`; `Seed = v; return Seed / 2147483647`. All integer division is C truncation. `NextU() = Seed * 2⁻³¹ * 2147483645`; `Random(a,b) = a + (int)((b+1−a)*Next())`; `SetRandomFromWorldSeed(s)`: halve if `s ≥ 2147483647`; `NewNollaPrng(x)`: seed = x, one warm-up `Next()` discarded. **Game-verified ✅: 100.00% match on 2,113,568 draws across 4 seeds** (probe mod `mods/noita-livemap-rng-probe/`, after the signed-i32 `>>> 0` fix) — ABOUT_MATH §2, §7bis.
- **`Next()` returns a double:** asm-verified that poro `Next()` (FUN_010098c0) advances the state AND returns `state × 4.656612875e-10` in XMM0; every consumer multiplies by 2147483645 (constant @0x11e0210) and trunc-converts to u64 (FUN_01033781 = `__dtoui64`). So `nextU() = trunc(state × 4.656612875e-10 × 2147483645)` — the JS port is exact. 🔬 ABOUT_MATH §7novies.
- **`SetRandomSeed` mixer** (diddle table backward-index, `&3` warm-up loop, Schrage core) = FUN_0048fd30, calibrated step-for-step against our JS; assert leaks `poro/source/utils/random/random.cpp`. **Does NOT drive the wang fill** (proven by lab + 644M sweep). 🔬 ledger "Verified anchors".
- **The fill's RNG** = poro Random on a **thread-local state** (TLS+0x14, lazily allocated by FUN_008ebf00, whose unconditional tail `Next()` is absorbed by the seed convention). 🔬 ABOUT_MATH §7octies, §7decies.
- **All fill draws are `nextU() % m`:** vertex coloring (0x8eca9e), rep-reduce reroll (0x8ec950, `(p+1+rand%(cc−1))%cc` or weighted), choose-tile (0x8ec855, 2-pass count-then-pick, one draw per placement). 🔬 ABOUT_MATH §7novies.
- 16807 is a **primitive root** mod 2³¹−1 (order 2147483646) → orbit distances are well-defined; every nonzero state is reachable. ✅ (computed) ABOUT_MATH §7decies.
- Ruled out as fill sources: the global poro stream (order-independence), the global LCG ×214013+2531011 (all consumers are gameplay), mt19937 / 64-bit LCGs (0 fingerprint hits). See §8.

## 3. Wang atlas format

- **Header** = last 9 RGB bytes of the image's FIRST row, decoded as `header[i] = byte[w*3−1−i] ^ (i*55)`, truncated to uint8 (`& 0xFF` on encode AND decode). `header[7] == 0xC0` → corner-type (`num_color[0..3]`, `vary_x = h[4]`, `vary_y = h[5]`, `short_side_len = h[6]`); else edge-type (`num_color[0..5]`, `vary = h[6]/h[7]`, `short = h[8]`). ✅ ABOUT_MATH §3bis.
- **Packing** (stbhw `__process_template`): 3 px separators, +1 px content offset; h-tile = `2s×s` px, v-tile = `s×2s`; each tile carries 6 corner constraints (a,b,c top/left; d,e,f bottom/right). The **variants loop** (`vary_x`/`vary_y`: every constraint combo appears ×N with distinct pixel art) is part of the walk — found & fixed missing from our port via the `wang_gen.exe` diff. ✅ ABOUT_MATH §3bis, §6.
- **All 31 game atlases are corner-type except winter_caves (edge-type)**; dims recompute exactly from the template formula; sparse per-vertex-class color counts (coalmine `(1,2,1,2)` s=13 → 72h+72v; excavationsite `(1,2,1,2)` s=20 → 32h+32v; liquidcave/snowcave `(1,2,1,2)` s=20/26; crypt `(2,1,3,1)` s=22; fungicave `(3,1,3,1)` s=13 …). ✅ ABOUT_MATH §3bis.
- **Key consequence:** with these sparse sets every 6-corner constraint combo has exactly ONE tile → tile choice is uniquely determined by the vertex color grid; the only randomness is the vertex coloring itself. ✅ ABOUT_MATH §3bis.
- `tools_modding/wang_gen.exe` is template-side only (artist canvas; no seed, no fill); our template walk reproduces it byte-identically (coalmine + winter_caves params). ✅ ABOUT_MATH §6 (2026-09-03).

## 4. The fill — walk mechanics (measured-correct)

The accepted fill attempt is fully determined by ONE number: the sub-RNG state
**S** that `CreateHerringboneWang_Threaded` seeds the TLS Random with. Given
the correct S, the following mechanics reproduce the game exactly:

- **Vertex grid:** `xmax = w/s+6`, `ymax = h/s+6` (binary row stride 0x6a = 106); for the lab rect the key grid is `(H+4)/4+6` = 70×32. 🔬 ABOUT_MATH §7octies, §7decies.
- **Class formula: `p = (i − j + 1) & 3` in generation space** (row counter starts at 1 and DECREMENTS — asm 0x8eca4b `MOV EBX,1` … 0x8ecacd `DEC EBX`). In key space (after the 1-vertex-row discard from the +4-row discard) this equals the lab's empirical `(I−J)&3`; binary classes at `(I−J)&3 ∈ {0,2}`, classes {1,3} are single-color 0 — a built-in skeleton (~half the vertices are seed-independent). 🔬 + ✅ ABOUT_MATH §3ter, §7novies, §7septies.
- **Vertex coloring:** one `nextU()` per vertex, row-major scan: `c_color[j][i] = nextU() % cc[p]`. **Measured ✅:** with the correct S, 1206/1218 informative vertices exact across three independent seeds (498/500, 325/327, 395/403 post-reduce; chance ≈ 2⁻¹⁰⁰⁰). ABOUT_MATH §7decies.
- **Repetition-reduction pass** (default ON, gated cc>1): re-colors vertices where the 3×2 neighborhood matches fully; flips ~11% of informative vertices (calibrated 8.8–12.9%). ✅+🔬 ABOUT_MATH §3ter, §7decies.
- **Herringbone scan:** `ypos = −s`, `j = −1`, `phase = j&3`, column start `i = phase ? phase−4 : 0`, step 4; h-tiles consume vertices `[j+2..j+3][i+2..i+4]`, v-tiles `[j+2..j+4][i+5..i+6]`. The game's 464-placement log aligns **464/464** to the simulated scan at `log = sim + (3,−1)` in cell coords. (Tile-ID choices differ 30/464 only because our port reads a different constant vertex offset than the game — port convention, not model; the lab tileset is fully forced so picks are unambiguous given the vertices.) ✅ ABOUT_MATH §7decies.
- **Output mapping:** output px (0,0) ↔ vertex (2,2); vertex (I,J) ↔ output px `((I−2)·s, (J−2)·s)`; 1 atlas px = 10 world px (scale still 🔗). ABOUT_MATH §3ter.
- **+4-row discard:** the buffer is `(h+4)` rows; the copy loop starts at j=−4 → the top 4 cell-rows are discarded. ✅ in-binary. ABOUT_MATH §3, §7octies.
- **Order-independence:** 100% identical placements across camera paths → the fill uses a LOCAL state, never the global poro stream. ✅ ABOUT_MATH §7septies.
- **The measured sub-seeds** (exactly one S per seed over [0, 2³¹); sweep `experiments/2026-09-08-subseed-sweep.c`, planted-solution-verified):

  | seed | S (TLS sub-seed) | key→gen offset |
  | --- | --- | --- |
  | 78633191 | **1228813614** | (−5, −6) |
  | 78633192 | **1319606147** | (−5, −6) |
  | 78633193 | **1966969580** | (−5, −6) |

  ✅ ABOUT_MATH §7decies.
- **Known residual (OPEN, parked):** 12 mismatches at gen-border zones — gen rows j=0..1 (any i) and the gen i=0..3 band at j=17..21; `key(5,23)` wrong in BOTH seeds 91 and 93 → systematic. A pure Lehmer stream cannot diverge at one draw and re-converge; no reroll touches those vertices. Suspect: the key's border-zone values or a game-side edge effect. ABOUT_MATH §7decies.

## 5. Pipeline structure

- **Area** = bounding box of one connected component of a biome color on the biome map; dims via `GetWidthFromPix`. ✅ ABOUT_MATH §3.
- **Once per area**, cached by (width, height, seed) across chunks (FUN_0090c1f0). 🔬 ABOUT_MATH §7octies.
- **Area driver** FUN_00904c20 (procedural_terrain.cpp): reads the area object (`this`), computes GetRNG, runs **≤100 attempts**; per attempt `state = Schrage(state)`, `param_9 = (double)state × 4.656612875e-10 × 2147483645`, `CreateHerringboneWang_Threaded(...)`; `hasPath` = FUN_00901780 (JPS) → accept or retry; coalmine/excavationsite string checks → FUN_00901580. 🔬 ABOUT_MATH §7decies.
- **GetRNG (asm-exact):** `d = (double)(int32)C + diddle[C>>31]` (diddle = {0.0, 2³²} @0x11e0ba0 — unsigned promotion); `if (d >= 2147483647.0) d *= 0.5`; ONE warm-up `Next()` on the driver-local Random; `skip = (width % 11)(signed trunc) + ((u32)C % 12)` (width = `[area+0x34]` clamped [1,1024]); advance `skip` inline Schrage. 🔬 ABOUT_MATH §7decies.
- **Dispatch:** the fill runs as an **Init-time thread-pool std::function task** capturing the 0x154-byte area object (ctor FUN_00904b10; `[area+0x4c]` = ctor arg = `WORLDSEED::GetSeed() + DAT_01328010`, written once during the Init walk). Chunk generation at runtime is lazy/streaming. 🔬 ABOUT_MATH §7novies, §7decies.
- **RUNTIME CONFIRMATION (Cheat Engine, 2026-09-08, seed 78633191):** `[area+0x4c]` = raw ws (`EAX = 0x04AFD8E7`, multiple areas, hook at 0x904d3b); the Threaded-layer cache pair (DAT_013276c8/d0) reads `(last param_9, diddled ws = 78633191.0)`; the last fill's accepted state = **ws × 16807^115** — inside the chain's ≤ ~122 (115 = 1 warm-up + skip 14 + A+1 = 100 → w ≡ 3 mod 11, e.g. w = 256 = the Mines width, accepted on attempt A = 99). **The asm-exact chain from worldseed to the fill's sub-seed is confirmed for regular (Init-filled) areas.** ✅
- ⚠️ **THE OPEN LINK:** the driver's input is runtime-confirmed (**C' = raw worldseed**, Cheat Engine hook at 0x904d3b, seed 78633191, 2026-09-08 — `EAX = 0x04AFD8E7` after `MOV EAX,[ESI+4C]`, multiple areas) — but C = ws is **excluded by measurement** as the source of the lab sub-seed (§8 rows 11–12). So the divergence is downstream of the driver's input: between the driver's chain and/or the sub-seed actually passed to `CreateHerringboneWang_Threaded` (FUN_008eda10) — see §9.

## 6. Content layers, spawns & captures

Layer model (framework, not verified): L0 biome partition → L1 pre-placement
(special structures) → L2 constrained wang fill → L3 connectivity check →
L4 pixel scenes / decor. ABOUT_MATH §5bis.

- **Wang trigger colors — only three exist in the atlases** (pixel-counted): `00ff00` spawn_items (→ RNG gate → `wand_altar` pixel scene), `78ffff` spawn_heart (70% `heart.xml`, else chest_random/mimic), `55ff8c` spawn_chest (coalmine only). `spawn_wands`/`spawn_potions` colors have ZERO atlas pixels — wands/potions cascade from green (`wand_altar.png` contains a single `50a0f0` px → `spawn_wands`). `goldnugget*` = physics debris, no static spawner (frozen dumps: gold 0 vs 23–26 physics-on). ✅ ABOUT_MATH §7sexies.
- **Trigger colors are consumed at generation:** the rendered capture shows 0/32 trigger-color pixels at item positions → entity dumps are the only observable for spawn facts. ✅ ABOUT_MATH §7sexies.
- **Holy Mountain content** (perks, shops, pedestals) is seed-dependent but NOT wang — exclude from fill constraints and don't count it as wang anomaly. ✅ (user-verified in game) ABOUT_MATH §6.
- **Spawn registry (binary):** RegisterSpawnFunction (FUN_00807d20) → AddScriptColor (FUN_007eb020) → std::map at GameLuaManager+0x8c → spawn queue → camera-culled processor FUN_0085d7b0. The **enqueue side** (the pixel-walk over placed map pixels) = FUN_00904c20's tail: per pixel → color → map lookup → ONE Schrage draw per pixel → FUN_00900c70 insert. 🔬 ledger 2026-09-07/08.
- **Fixed spawns:** 15 sightings identical across seeds 91/92/93 (HM pedestals/perks, altar orb_00+book, kantele, evil_eye, orb-room orbs). ✅ ABOUT_MATH §7sexies.
- **Capture ground truth:** in-game pipeline pixel-stable (overlap identity 99.6–99.7%, flat-region RMS 0.16/255); adjacent-seed foreground divergence **26.45%** (91↔92) = the calibration target; 92↔93 83.0% identical; 3-way decomposition 48.0% all-stable / **17.9% two-agree-one-differs** (even split → small-variant-pool content, an RE target) / 6.8% all-distinct; HM bands ~95% seed-independent; the hosted ref stitch is build 2024-08-12 and NOT pixel-faithful to the current build (80.4%) — treat cross-build diffs as qualitative. ✅ mapcap/README, PREDICTABLE_ZONES.md.
- **Density confound:** raw wang layer = 38–46% solid vs capture 61–62% — the capture includes non-wang layers (walls/scenes/edges, ≈ +24 pts). A bare wang layer can never score near 100% against the capture; **spawn equations are the paint-immune judge** (frozen-physics tolerance dx±2 / dy[−3..1]). Both candidate models fail them: wasm **0/48**, js-sequential **6/48** ≈ chance. ✅ ABOUT_MATH §6, §7quater, §7sexies.

## 7. Binary infrastructure map (noita_dev.exe)

All 🔬 (decompiled + byte-verified); details in `ghidra-ledger.md`.

| Item | Where | What |
| --- | --- | --- |
| `g_worldseed` | DAT_01327ffc (`world_seed.cpp`) | global world seed; GetSeed = FUN_009119d0 (asserts validity) |
| `NEW_GAME_PLUS_COUNT` | DAT_01328010 | .data default 13589 (@file 0xf26610); **absent from the game's `magic_numbers.xml`; reset to 0 by FUN_009233d0** (biome-map reset); only writers = magic parse FUN_00922950 + that zeroer |
| Fill subsystem | biome.cpp / stb_hbwang | CreateHerringboneWang = FUN_008ed490; _Threaded = FUN_008eda10 (TLS seed = param_9 untruncated double, one warm-up, buildTileset FUN_008ed0f0, `stbhw_generate_image(w·3, w, h+4)` = FUN_008ec9f0, +4-row discard); choose_tile FUN_008ec710; place h/v FUN_008ec5d0/670 (pure blits); reroll FUN_008ec8e0 |
| poro Random | FUN_010098c0 (`random.cpp`) | Schrage 16807/127773 core; returns state × 4.656612875e-10 |
| Area object | FUN_00904b10 | 0x154 B; +0x34 w, +0x38 h, +0x3c..0x4b coords, **+0x4c = fill seed**, +0x90 sub-object |
| Per-cell generator object | FUN_0090ce20 → FUN_008f9470 | 0x1ec B per world-grid cell: +0x8c raw seed, +0x94 = (float)d × 200000f − 100000f |
| mSeed ctor | FUN_00904730 | outputs pure functions of ws: `mSeed = f32(f32(ws)·9999f+1f)`, `stateA = stateB = f32(f32(ws)·200000f−100000f)`; its 3 Nexts advance the GLOBAL poro |
| World data model | FUN_008f95c0 / FUN_008f9ab0 | parallel **float grid (+0x18) + u16 material-ID grid (+0x38)**; BitmapNoise::LoadFromImageData; u16 reader FUN_009fe4e0 |
| Area cache | FUN_0090c1f0 | once-per-area rule across chunks |
| Byte-verified constants | .rdata/.data | diddle {0.0, 2³²} @0x11e0ba0; 2147483647.0 @0x11e0220; 0.5 @0x11dfdd8; 2147483645.0 @0x11e0210; C1 4.656612875e-10 @0x11df988 (ONE hit); 9999f @0x11e0494; 1.0f @0x11dfbf0; 200000f @0x11e0504; 100000f @0x11e04ec; DAT_011df878 = 0.0 (write-only cache) |
| Source tree | 330 assert-leaked paths | `source/procedural_utils/{world_seed,procedural_terrain,biome,biome_materials,noise_utils}.cpp`, `source/grid/`, `poro/source/` |
| Classes | 1,958 RTTI names | no wang/generator class — the fill is free functions; Biome = plain struct, no vtable |
| File→VA | .text file+0x400c00 · .rdata file+0x400e00 | imageBase 0x400000; 32-bit x86, string literals referenced by absolute `push imm32` |

## 8. Eliminated — do not re-test

Every row is a settled negative with evidence. If a new hypothesis reuses one
of these mechanisms, cite the row instead of re-running it.

| # | Eliminated | Evidence | Source |
| --- | --- | --- | --- |
| 1 | noitool wasm output ≈ game terrain | statistically unrelated to the capture (below the gen-vs-gen noise floor 60–66%) | ✅ ABOUT_MATH §6 (2026-09-03) |
| 2 | Alignment/anchor family as the primary mismatch cause | all anchor modes/phase sweeps flat at baseline | ✅ ABOUT_MATH §6; H2 (per-chunk re-anchor) additionally DEAD — lattice is global (§7septies) |
| 3 | Per-vertex position-seeded 1-draw coloring | 1,154 hypotheses, all below noise floor | ✅ ABOUT_MATH §7ter |
| 4 | Per-chunk sequential fills seeded at chunk origins | 8 variants, 49.5–52.2% | ✅ ABOUT_MATH §7quater |
| 5 | Sequential poro walks of every shape (S1 every-pixel ~94M; S2 skips ≤200k; P positional hashing; biome-grid; per-chunk lattices) | 644,455,000 candidates, best 58.03% = noise floor | ✅ ABOUT_MATH §7septies |
| 6 | "The 644M failure was the wrong class formula `(i+j)&3`" | OVERTURNED: `(i+j)&3` was itself the misread; `(i−j+1)&3` is right and the mechanics are measured-correct — the failure was purely the SEED | ✅ ABOUT_MATH §7novies, §7decies |
| 7 | Global LCG (×214013+2531011) as the fill's source | all heavy consumers are gameplay (dice, scatter, effects) | 🔬 ledger "Global-LCG scan" |
| 8 | mt19937 / 64-bit LCGs | 0 fingerprint hits | 🔬 ledger "generator landscape" |
| 9 | Derived-state Lehmer walks (7 variants F1–F7: +0x94 field, float bits, raw seed…) | all at chance | 🔬 ledger "Derived-state test results" |
| 10 | Fill seed = ws + 13589 (NEW_GAME_PLUS_COUNT default) | DEAD: the biome-map reset zeroes the global; no XML sets it | 🔬 ABOUT_MATH §7decies |
| 11 | Fill seed C = ws (the static asm reading) | EXCLUDED by orbit-distance measurement: chain requires dist(C→S) = 1+skip+(A+1) ≤ 116; measured 8.5e8 / 3.5e7 / 4.7e8 (BSGS discrete log, seeds 91/92/93) | ✅ ABOUT_MATH §7decies |
| 12 | Backward-inversion bases: ws, ws±1, ws+13589; mSeed-chain outputs (V1/V2/unchained) and their f32-bit encodings; no structured start within 400 orbit steps; no constant-delta (mode, attempt, skip) config across seeds | 407/411/190 valid bases per seed, none of the above among them | ✅ ABOUT_MATH §7decies |
| 13 | noitool wasm model on the frozen spawn equations | **0/48** constraints | ✅ ABOUT_MATH §7sexies |
| 14 | js-sequential model on the frozen spawn equations | **6/48** ≈ chance | ✅ ABOUT_MATH §7sexies |
| 15 | FUN_00fec850 as the fill | it is the OpenGL world renderer (indirect calls = GL function pointers) | 🔬 ledger "Correction 2026-09-05" |
| 16 | FUN_00794620 as the fill | world-grid scatter utility (falling-sand cell indexing + per-object LCG picks) | 🔬 ledger queue item 1 |
| 17 | Lab-keyed eliminations transferring to regular-area fills | the lab biome is runtime-injected and fills via a non-Init path (sub-seed at orbit distance 1.6e9 from ws); the Init chain is runtime-confirmed for regular areas (§5) — lab-keyed negatives (row 5) do not transfer | ✅ 2026-09-08 |
| 18 | C51's CaveStructure record shape: "28-byte member, count pair [+0x28]/[+0x30], list-scan magic 0x88888889 = ÷12 ({x, y, B, B−1} family)" | OVERTURNED dig #81: the record dispatcher (true VA 0x4ABD60, nine keyed stores) closes at +0x3c = a **60-byte** member (4-B header + 24-B image_file SSO + 8×4 fields); count pair reads at **+0x1c/+0x20** (fnB `mov 0x20/0x1c(%eax)` @4f09cf..4f09d5); the ÷60 form (imul 0x88888889, sar $5) script-verified 60→1, 600→10, 3584→59 | ✅ ABOUT_MATH §6 (81) |
| 19 | "[config+0x98] = the second do_beginning gate byte" / "per-record flags [obj+0x30]/[obj+0x98]" | OVERTURNED dig #81: those are CONFIG offsets — [config+0x30] = do_beginning_paths (the real gate, `cmpb` @4f0f3c → je 0x4f271e), [config+0x98] = the mLuaScript string SIZE (string base +0x88; `cmpl $0x0,0x98(%edi)` @4f100f pairs with assert `caves.mLuaScript.empty() == false` @0x11731a4 = script presence, not a gate) | ✅ ABOUT_MATH §6 (81) |
| 20 | C46 scatter engine true VA = 0x8EF2D0 | OVERTURNED dig #81 (re-pinned from exe): true = **0x8EEAD0** (file 0x4EDED0) — the old label is +0x800 off and lands mid-instruction in fn A's L1 lane; the corrected window is the full 416-B function (the comiss-0.5 gate @0x8eec4e..59, `call 0x8fafc0` @0x8eec65, `ret` @0x8eec6f) ending 1 byte before fn A's prologue @0x8EEC70 (C44's fn A VA ✓); fnb calls `call 0x4ee2d0` @4f1d5d/4f26fb | ✅ ABOUT_MATH §6 (81) |
| 21 | The P-build chain (Serialize → fn1 slab 0x4EDA30 → 0x533580 → 0x7EC4E0 → C27 ctor 0x4F8C70) as the mGradient/ramp consumer; true 0x7EC4E0 = "the ramp-generator" ((83) label); `[gen+0xb4]` = "the B-map" (C39 label) | OVERTURNED dig #84: whole chain byte-read — fn1 uses `&config+0xa8` as an ADDRESS cache key only (contents never read); the C27 ctor consumes a seed int only (2×NextRandom → draw×200000−100000; size 0xB8); the 0x533580→0x7EC4E0 sub-chain builds a **BiomeSpawnScripts** object (literal 0x1154528, map @+0x8c, memo @[singleton+0x24]); `[gen+0xb4]` = a cloned callback {fn 0x7EB220, ctx=BiomeSpawnScripts*} (vtable 0x119a2a0, slot+0x24 = clone @slab 0x680DA0). mGradient consumption remains unseen → hunt moved to the XML-parse family (0x496a2e..0x4a97ed) + surfaceField's config-range read | ✅ ABOUT_MATH §6 (84) |
| 22 | Recovering the driver's address (true 0x908F40 / slab 0x508740 / surfaceField-ret 0x908F9B) as raw imm32 immediates in text.bin | imm32 = 0 hits in text.bin still true, but the "invoked indirectly only / capture OPEN" inference is **OVERTURNED dig #85**: 3 direct e8 rel32 byte-verified →0x908F40 at true 0x7930d3 / 0x7938d1 / 0x7938fe (+ sibling 0x793358 → 0x909370) — all at file 0x3924d3.. = lower .text OUTSIDE text.bin (C57 scope defect); job-functor theory dropped, capture CLOSED. Driver loop extent/y-range still OPEN (caller body unread) | ✅ ABOUT_MATH §6 (84),(85); CONSTANTS C57/C60 |
| 23 | The key-string-dispatcher hunt for the Topology/ramp slot-fillers (the C52 attr-name imm32 xref technique applied to mGradientStartY/EndY/HighNoise/LowNoise/NoiseScale/MinY/MaxY/Type/SinMultiple*) | **OVERTURNED dig #85**: full-file scan = **15 imm32 code refs per name** (first @file 0x9624f.. = true 0x496e4f.. — registration cluster + parse-walk pushes), all lower .text outside text.bin (same C57 scope defect as row 22); the xref technique WORKS and delivered the 38-pair bind table (C58) = the write side. The (82)/(84) "ZERO refs" eliminations stand corrected | ✅ ABOUT_MATH §6 (82),(85); CONSTANTS C58 |
| 24 | Writing `[owner+0xb4]` (the sampler's float-wrapper gate target, C34/C54): an independent base-install site — plus the candidates below | ELIMINATED dig #85 (REGION-scoped): no install among the ③-region sites examined — ctor null-inits 0x791c8e×2 + 0x8f9565/0x8f956b and config pins 0x8ee3fb/0x8ee694 only (fresh full-.text census, file 0x400..0xd49200: mod=10 disp32 0xb4 → 475 store-patterns/91 loads/761 lea, 0xb8 → 1060/846/710 — counts not individually re-examined ⇒ REGION scope). Ruled out: g_genome_herd_relations 0x12ec8b8 (writers 0x592270/0x5932f0); name→member dispatch 0x4f8857 (invincibility_frames/falling_damages); ctor null-inits; classifier 0x8f5030 refuted twice (body 0x8f5030..0x8f5754, zero member stores). Consistent with C61/C62 aliasing: **owner = P − 0x9c ⇒ owner+0xb4 ≡ P+0x18**, the wrapper LoadFromImageData writes — instance-identity byte-link still OPEN | ✅ ABOUT_MATH §6 (85); CONSTANTS C64 |

## 9. Open frontier (ranked)

1. **RESOLVED (2026-09-08): the sub-seed derivation is runtime-confirmed AND end-to-end verified for regular areas** — see §5 and the chain-vs-spawn-equations result (ABOUT_MATH §6, 2026-09-08): **12/12 direct-trigger constraints satisfied across seeds 91/92/93** by chain-derived fills (unique early attempts A=0/3/1, consistent (+1..3,+1..5) px anchor; 60 wrong-seed controls never exceeded 3/4). The lab anomaly is explained: the injected lab biome fills via a different path (§8 row 17). **Remaining frontier (offline):**
   - **a. ~~hasPath emulation~~ ✅ DONE (2026-09-08):** ported (`lib/has-path.mjs`) and oracle-validated — 8/8 accept/reject constraints (excav 91/92/93 → attempts 0/3/1), coalmine 91 independently corroborates (attempt 1 = the spawn-judge's winner). Wired as `generateAreaExact` (`lib/generate-exact.mjs`, ~10 ms/area). The accepted out_map carries the hasPath mutations (blocked-room whites, hax) = exact finalize input.
   - **b. Cascade-class spawn offsets** — potions/wands spawn at structural offsets from the wand_altar scene art (+ RNG gate); needed to extend the judge beyond direct triggers (pure data modeling: altar art + per-biome g_items lists).
   - **c. Post-wang layers** — room blocking / coalmine_hax / pixel scenes for full geometry (needed for visual prediction, not for spawn facts).
   - **d. Optional:** identify the CE-observed A=99 last-filled area (no oracle items — untestable, consistent).
2. **12 border-zone key mismatches** (parked, §4, lab-scope): systematic across seeds; suspect the key's border values or a game-side edge effect. Do not chase until the lab scope needs it. ABOUT_MATH §7decies.
3. ~~Port read-offset convention~~ **RESOLVED (2026-09-08):** real-area fills anchor at ~(3,3) px from the area origin — the port's geometry is essentially exact; the lab's (3,−1) cell offset was lab-recovery bookkeeping. (Chain-vs-spawn-equations run, ABOUT_MATH §6.)
4. **Small-variant-pool content:** the 17.9% two-agree-one-differs capture class (even split across seeds) is a separate RE target (randomMaterials / scene variants?). mapcap/README.
5. **Post-wang layers:** the game's `finalize` family (`fillMainPath`, `fillBlockedRooms`, `fillC0ffee`, `ClearPath`, random-material fills) and pixel-scene placement — required for full visual prediction (§9.1c). **Re-derive each step from the binary; do NOT port noitool's versions** (obsolete; known-buggy hax constants). ABOUT_MATH §7.

## 10. Working principles

- **Reference-frame statement (2026-09-19):** the absolute references are
  THIS file and the probed reference seeds 78633191/92/93 (captures, CE
  anchors, entity dumps, spawn equations). **Coalmine is a stage-6
  special-case FIXTURE, not a reference biome** — it was inherited as a
  reference from noitool's work but is the most special-cased wang biome
  in-binary (C1/C2 mark walk, C20 stairs band + overlay loader, C19
  blockOutRooms union trigger exist only for the coalmine/excavationsite
  template paths), so models tuned on it inherit port-local artifacts
  (see ABOUT_MATH 2026-09-19 (9)).

- **Constant-offset principle:** a constant offset is only valid if the drift it corrects is zero or sawtooth-shaped; any linear (multiplier) component makes a constant wrong far from where it was measured. (ABOUT_MATH §4.)
- **Paint-immune judging:** spawn equations (each seeded spawn = an exact wang-cell color fact from entity dumps) are the primary judge; geometry-vs-capture metrics are confounded by non-wang layers and density. (ABOUT_MATH §7quater/§7sexies, mapcap/README ladder.)
- **Order-independence is a hard constraint:** any fill model must be a local, per-attempt state — the global poro stream is out. (ABOUT_MATH §7septies.)
- **The lab is the instant bench:** the 548/362/451-vertex answer keys (seeds 91/92/93, `out/oracle/lab-vertex-grids.json`) verify any new hypothesis in minutes; a correct model scores ~100%, partial-walk scores are noise. (ABOUT_MATH §7septies, §7decies.)
- **Sources or it didn't happen:** every domain fact carries a file+section verified on disk this session; numbers never travel via chat memory or handovers. (AGENTS.md.)

## 11. Generation lifecycle flow map (2026-09-18)

Per-stage status of the whole world-generation flow. Purpose: fix defects and
plan work against the LIFECYCLE, not issue-by-issue (user mandate 2026-09-18).
Layer/status legend: 🔬 asm-read (function dumped, byte-verified) · ✅
empirically verified end-to-end · ⚠️ data-verified only (game data/scripts,
binary side unread) · ❌ unexplored.

| # | Stage | Where (binary / data) | Status |
| --- | --- | --- | --- |
| 0 | New-game seed generation | FUN_00911730/009118b0 (entropy) | 🔬 n/a for prediction (seed is input) |
| 1 | Global reset + biome map load | ProceduralTerrain::Init FUN_00905fb0; biome-map reset FUN_009233d0 zeroes NEW_GAME_PLUS_COUNT | 🔬 |
| 2 | Color→Biome lookup, biome grid alloc | FUN_00904230 (32-byte entries) | 🔬 |
| 3 | Per-cell generator objects (float/u16 grids) | FUN_0090ce20→FUN_008f9470 (0x1ec B); stores per world-grid cell; **grid ALLOCATION = FUN_008f95c0 SetSize (read fully 2026-09-20 (18): three zero-init grids — +0x18 float 4B / +0x38 u16 DECOR (2·w·h) / +0x58 byte; C31), 2 Init-side call sites (0x90738f, 0x907852 = area-object ctor walk; ECX = area+0x90 sub-object owns them — grids are Init-built and cached, chunk loads READ them); U16 FILL = BitmapNoise::LoadFromImageData true 0x8f9ab0 (C32): the driver feeds the accepted wang out_map in 2× (true 0x905dd7/0x905f1e, flag=1) and every painted pixel becomes a MATERIAL ID via resolver [this+0xb0] / script map [this+0xb4]; zeroed cells stay 0** | 🔬 |
| 4 | Area objects (biome components) | FUN_00904b10 (0x154 B; +0x4c fill seed) | 🔬 |
| 5 | Wang fill (Init-time, thread pool) | driver FUN_00904c20 → Threaded FUN_008eda10 → stbhw FUN_008ec9f0; hasPath FUN_00901780 | 🔬 + ✅ (chain 12/12 spawn eqs; hasPath oracle 8/8, re-run 4/4 on 2026-09-18) |
| 6 | Accept/retry + out_map mutations | hasPath port (`lib/has-path.mjs`) — ✅ matched in-binary + **ported 2026-09-19**: driver tail = skip-flag gate → hasPath FUN_00901780 ("ProceduralPathFind", on wang_image, coalmine start mark 0xFF420000/C1, ClearPath warn path) → apply FUN_0090150; fillBlockedRooms = C0FFEE walker FUN_00900560 family (u16 deltas 0x2/0x5, rect-push FUN_00929850, 'checked_places'); CheckForGaps = FUN_00900a50 (start-pos flood w/ "couldn't clear start path" warning); fallback Threaded fill = FUN_008ed860 (0x13276ba flag); blockOutRooms walker FUN_00901580 = 11-color table (C3) + ray-walk room growth FUN_00901510 (C16) + record fill FUN_009013f0 (C18) — **ported binary-exact 2026-09-19, ShadeOfGrey eliminated**; finalize black blit FUN_0090450-family (C17); coalmine-hax = biome-XML `<BitmapCaves>` flags | 🔬 port-side complete; **special-case BIOME SELECTION determined 2026-09-19 (8)** — template-path equality, C19–C21 (name-list flags retired in `lib/biomes.mjs`); remaining in-binary reads: stairs-band→path-start consumption detail + ClearPath exact range + C0FFEE/fillMainPath walk details |
| 7 | Area cache (once per area) | FUN_0090c1f0 (w,h,seed) | 🔬 |
| 8 | Spawn-trigger walker + queue | FUN_00904c20 tail → 1 draw/px → FUN_00900c70 → processor FUN_0085d7b0 | 🔬 |
| 9 | Runtime streaming / chunk loads | **VA-CORRECTED 2026-09-18 (see ledger)**: ProceduralTerrain::Update() = FUN_0090b8a0 (profiler 0x11753ac @0x90b8cf) → DoBufferedPixelScenes() = FUN_00910c20 (profiler 0x11764ac @0x910c59); buffered-scene enqueue w/ dedup + flush = FUN_0090c1f0 (call sites 0x818c6e LoadPixelScene binding, 0x907fc9 Init, 0x90bd1e). Earlier "0x50b0a0/0x510420" were shifted-slab VAs (+0x400800 correction, byte-pinned) | 🔬 (pixel-scene arm fully read: scene executes only when ALL FOUR overlapping 512-chunks present — 4-corner probe of the chunk bit-grid DAT_0x132aed8; STREAMING_CHUNK_TARGET readers found at 0x79e65a/f1/74f = per-frame budget regulator); **chunk-request consumer arm ➜ next read (chunk bit-grid 0x132aed8 imm families + 0x79xxxx frame-tick)** |
| 10 | Pixel scenes (biome-script loaders) | bindings region 0x806000–0x80c000 (partially read); data: `data/biome_impl/*.xml`, `_pixel_scenes.xml`, spliced `.plz` (compressor FUN_004225f0/b50, dispatcher FUN_00422e20) | ⚠️/❓ (plz codec not reproduced; per-scene art rendered via source-PNG blit) |
| 11 | Template biomes + procedural noise terrain | data `scripts/biomes/*.lua` (⚠️); binary noise terrain = funcs reading generator +0x94 / DECOR float/u16 grids (FUN_0090e840, FUN_008f9ab0, mSeed ctor FUN_00904730) | ❌→🔬→✅ **F3 dig #1 (2026-09-19): core READ** — 2D **simplex** core true FUN_008fca60 (F2/G2, perm 0x114ced0, ×40) + 3D twin + quintic-lattice family (perm 0x114d700, 6/15 quintic); transform FUN_00908cb0 ×0.1/0.13717/1/9/0.45/0.33 etc pinned (C25–C27); sampler FUN_0090d860 flow read (float-field gate >0.5 → eval → u16/RGBA paint). **UPDATE dig #4 (2026-09-20): the former "not closed" list is CLOSED + ported** — clamp arm SETTLED (byte re-read slab 0x50872c..0x508734: LOWER clamp `val < 0.5 ? 0.5 : val`), both axes' warp byte-exact `w(axis) = ((f32)axis + q·15.5)·0.0489275`, gradient table FOUND IN-FILE (C29 correction; see the dig-4 block under §11-Frontier), generator-plant walk pinned (C27/C28) — port `lib/noise-proto.mjs` runnable, no placeholders. Source: ABOUT_MATH 2026-09-19 (13), 2026-09-20 (15)/(16) |</think>C30 clamp addendum landed. Now the last edit — fix my earlier "warp = (axis + q…)" line in C29 result claim only if needed. The C29 row is fine. Next: VERIFIED.md — distill the settled corrections into §11 row 11 / row C lines:<tool_call>edit<arg_key>newString</arg_key><arg_value>| 11 | Template biomes + procedural noise terrain | data `scripts/biomes/*.lua` (⚠️); binary noise terrain = funcs reading generator +0x94 / DECOR float/u16 grids (FUN_0090e840, FUN_008f9ab0, mSeed ctor FUN_00904730) | ✅🔬/✅ **F3 READ-CLOSED + PORTED (2026-09-20, digs #1–#4 + closure)** — 2D simplex core true FUN_008fca60 (C25); quintic **GRADIENT** lattice = true 0x8fc740 with the byte-pinned IN-FILE gradient pair table @.data VA 0x12eec08 (file 0xEED208 via the corrected **.data file rule VA−0x401A00**; the 8 pairs are listed in the dig-4 block below); quintic **VALUE** lattice = true 0x900900; transform FUN_00908cb0 full recipe (C26; ninth = f32-1/9 widened f64, CONSTANTS.md:449); evaluator true 0x908e70 closed (lower clamp 0.5, same-q dual-axis warp); sampler FUN_0090d860 paint arm read (dispatcher → u16 material write +0x1e0, RGBA alpha-gated vtable color dispatch, mark flags); generator plant walk = cell-grid job, ONE seed draw from.WorldSeed (C27/C28). **Runnable fully-binary-derived port: `mapgen/lib/noise-proto.mjs` (no placeholder remains).** Generator update next; capture validation = the I1/I3/I5/I6 pipeline step (gates the r3e→r3f bump only on an observable change) | |
| 12 | Material/coloring paint | data materials.xml + biome MaterialComponents (`lib/colorize.mjs`) | ⚠️ faithful approximation; exact grey-band noise OPEN (ISSUES I1) |
| 13 | Engine debug toggles | flags DEBUG_GENERATE_BIG_WANG_MAP / DEBUG_FULL_WANG_MAPS registered ~0x472ee0/0x4742d0; REGEN_WANG_MAPS 0x118f924 (0 imm refs) | 🔬 sites found; **storage + readers unknown** — frontier F4 (potential in-game wang ground-truth oracle) |

### Frontier (dependency-ranked, 2026-09-18)

1. **F1 — ✅ CLOSED (2026-09-18, 2 rounds).** Pixel-scene arm: Update entry
   0x90b8a0 → DoBufferedPixelScenes 0x910c20; enqueue/dedup 0x90c1f0; scenes
   deferred until all four overlapping 512-chunks exist (chunk bit-grid
   DAT_0x132aed8). Chunk-materialization arm: every 512-chunk runs **FUN_008e4ec0**
   = a staged state machine (0 → 0x247 → 0x24e → 0x255 → 0x25c) whose stages
   build quadrant caches (chunk-halves ±0x100 = 256 px) via **FUN_00939b80**
   ("build cache") then apply **FUN_008e4990 = DistanceField_UpdateForChunk**;
   dispatched as thread-pool functors (thunks 0xa99cc8/0xa99ea0, the same
   family as the wang fill driver). Per-cell sampler FUN_0090d860 only reads
   (u16 via FUN_009fe4e0 + floats via 0x9499f0; read-only verified — no
   writes in the chunk path onto +0x18/+0x38) and evaluates the smoothed
   noise (perlin core FUN_008fca60 family) → the F3 consumer. **Verdict: a
   chunk load never regenerates terrain** — the area's float/u16 grids are
   Init-built (SetSize 0x90738f/0x907852) and area-cached; runtime only
   consumes + adds pixel scenes / distance-field caches. **Remaining
   (new frontier item, retitled F-anchor):** the (3,3)/(+5,+13)
   wang-cell↔world anchor constants live in the map-class draw path
   (FUN_008e6d50 consumer / the fill's copy-out walk) — that read completes
   the anchor story (genmap's ~exact fitted (3,3) → canon).
2. **F2 — ✅ CLOSED (2026-09-19, 4 digs).** The whole accept/retry +
   out_map-mutation family is decoded binary-exact and ported/oracle-pinned:
   hasPath blockOutRooms colors (C3) + ray-walk room growth (C16–C18)
   ported `(lib/has-path.mjs)`, ShadeOfGrey eliminated; biome
   special-case selection = template-path equality (C19–C21; name lists
   retired); the C0FFEE walker FUN_00900560 = the FIFO BFS building the
   gap-clearance/flow-field consumed by CheckForGaps (C22; corrects dig
   #4's byte-reversed 0xFFEEC0FF and the "u16 deltas" wrong-grid note);
   the overlay arms decoded (#fefefe stairs band = the true start_x=142
   mechanism, #004200 dark-green arm; both dead with the current overlay
   data — no behavior change, C23); driver tail closed (no u16 copy loop
   — the wrap-modulo copy is the whole copy; FUN_008f9ab0 flag=1 call #2,
   C23); ClearPath = logging-only, no spatial mutation (nil contract,
   C23); BIOME_PATH_FIND_WORLD_POS_MIN/MAX_X = runtime config doubles
   parsed from the biome-def object (C24 — the 159/223 constants remain
   `@prov noitool`, values engine-side). Cache r3e stands (digs #3–#4
   generated no observable changes). Remaining frontier = F3 (noise
   terrain, incl. the random-material/colorize family and
   fillRandomMaterials' u16 writes).
3. **F4 — DEBUG flag plumbing** (identification first: readers of the
   registered flags; then whether magic-numbers.xml can set them). If
   togglable → first-class wang-only ground truth (in-engine full wang maps),
   eliminating the capture's non-wang-layer confound for every future check.
4. **F-anchor — ✅ CLOSED (negatively resolved, 2026-09-19 (6), byte-pinned).** The game has NO additive wang-cell↔world anchor constant: the fill driver (true 0x904c20 = slab 0x504420, single thunk caller) copies the accepted out_map's cells into the area grids by a per-cell wrap-modulo copy (`idiv`-based repetition, dst `y·W+x`, 4 bytes/cell), and the Init area-grid sizing is `[chunkExtent·512]÷10`. Our genmap's fitted (3,3) px anchor is a PORT-LOCAL artifact (about-math entries 2026-09-19 (2)–(6); investigations: driver slab 0x505610..0x5056a4). Stage-8 walker emission byte-pinned IN the driver (slab 0x5054fc → true 0x900c70): spawn triggers follow the fill in one driver.
5. **F3 — noise terrain** — status split (2026-09-20): **noise-mechanism
   family READ-CLOSED + ported** (ALL five cores byte-pinned incl. the
   in-file gradient table @0x12eec08 file 0xEED208; sampler/plant walks
   read; runnable `lib/noise-proto.mjs`, zero placeholders — see §11) —
   **the u16 DECOR material-grid fill is now READ (2026-09-20 (18),
   C31/C32): `BitmapNoise::LoadFromImageData` (true 0x8f9ab0)** — the
   driver feeds the wang out_map into it (2 calls, flag=1, true
   0x905dd7/0x905f1e); per cell: image color (wrap-mod getter true
   0x9fe3c0) → alpha 0xFE marker → **A-channel resolver [this+0xb0]
   → u16 = id+1** (float ±1.0), **B-channel map [this+0xb4] → script
   byte + record list**, part-2/3 = wrap-mod-neighborhood
   majority-classification (true 0x9fe570/0x9fe620). **The sampler
   chain is CLOSED (2026-09-20 (20), C34): per-chunk owner layout —
   [+0xb4] float field (raw >0.5 gate = the (17)-gate, read BEFORE the
   evaluator), [+0xd4] u16 grid (id−1 bias of the u16 fill!), [+0x90]
   names (0xb78e0), [+0x1e0] u16 DECOR write (0x559de0); the
   noiseTransform (C26) output (u,v) drives an iu/jv smoothstep
   floor-snap (3.0/2.0/0.5 trio re-pinned) into a 4-corner bilinear
   MATERIAL INTERP on the [+0xd4] u16 grid; the evaluator2 `a` arg =
   the FIELD VALUE (not a constant 1.0), consumed only for
   u16==0 cells under the +0x2a4 flag → C33 classifier (true
   0x8F5030 — VA fixed dig #85, ISSUES I18) → DECOR write.** The (17) smoke's all-solid = EXPECTED
   (a=1.0 hard-coded); the correct wiring is the recorded next
   integration step. **The surface-blend is now READ too (2026-09-20
   (23), C36–C38):** per-biome field = true 0x90a860 (4-corner
   bilinear over a per-biome BitmapNoise float grid, lower clamp 0.5,
   mGradientAddNoise switch, final mMultiplierGradient/Perlin/AddValue
   combine; config offsets [+0x220..0x268] byte-mapped). Exe reachable
   this session (rdata.bin + data_raw.bin slices; C25–C30 pins all
   re-verified). The [uid+0x1d4] FILL
   CHAIN read (C39). Gradient = an image-baked float grid. Still
   open: per-biome image path resolution for surface biomes + whether
   mGradient* rasterizes into that image inside biome.cpp.
   **CASE-1 LANE CLOSED (2026-09-20 (26), C40):** the whiteLattice2d
   core (sin-hash value noise, IAT-named libm sin) + the case-1 blend
   ported → the 47-biome lane computes; V2 full-map smoke = 2194
   chunks with real texture (winter/desert/pyramid ~48–51% density).
   **钩 dispatcher cores READ (2026-09-20 (27), C41):** case 1 = the
   FastBlock LCG-hash (214013/2531011-pinned, ÷16384), case 3 = the
   FNV24 + the 12-dir .data pairs @0x12eb950 (all pinned; the
   1234567.0 sentinel @0x11e0180), case 2 = whiteLattice twin
   skeleton-pinned.
   OPEN: cases 2 constant-diff, case 4 head, noise-type int map (W2).
   **W5 REFRAMED (2026-09-20 (32), C43):** [uid+0x1d4]'s float grid = a
   THREE-layer Random(min,max)-FRACTION ramp-stack written in biome.cpp
   (layer-1 = 0.32·d+0.35 ⇒ [0.35, 0.67]; layers 2/3 = 0.35·d+0.65 ⇒
   [0.65, 1.0)) via the 0x4edf50 grid-setter — the mGradient* XML
   family = most plausibly these stacks' parameters (not a PNG bake).
- **The W5 model FINAL (kernel reference, dig #19):** the `field` =
  the per-AREA float-grid (the C31 [this+0x18] family — the fresh
  **512×256 / cnt=131072 / px-shared** instance pinned by the CE
  run, values like 0.4607/0.5429/0.0964/0.2694/0.3741/0.5791/0.2240/
  0.0438/0.9666/0.2322 = the LIVE band-stack!), filled per-cell from
  (i) the per-biome 260×260 image (C39's material_image/plz — the
  1…0.7961…1 border-fades = the image's own FC) and (ii) the
  Random(min,max) band-stack layers (0.32·d+0.35 / 0.35·d+0.65),
  consumed by the true 0x90a860 evaluator + the C34 sampler. The
  3584×2457/8.8M-cnt world-grid (all-1.0 rows at y=1200/1600) = the
  combined WORLD-state lane. The mGradient* XML family = the
  band-stack's per-biome parameters (per-arg byte = the one item
  left).
   ✓ **CE-RUN of 2026-09-20: the first game-observation LANDED (the
   user's Lua-script): [uid+0x224] = 5 = the noiseType int = the
   dispatcher case (the 0x8fc020-family = the ported core!) — W2
   CLOSED EMPIRICALLY, the mG-Register: the +0x264/+0x268 pair =
   MultGradient/MultPerlin CORRECTED; the hills-class grid =
   w260/h260 cnt 67600 = the per-biome image-baked float grid
   (the row [1...0.7961...1]); the 3584×2457-8.8M-cnt grid = the
   world-state (C31-family); winter-class = a 1×1-empty placeholder.**
   now carries K2/GRAD12 (12-dir pairs byte-pinned), simplex2DDeriv
   (0x8fc020 read to formulas, ×70, skew BSS flagged), noiseDispatch
   (honest throws for cases 0..4), insidePerlin, fbm4, surfaceField —
   143/143 unchanged, not capture-validated (mGradient rasterize +
   case-1 inner cores + shape instruments = the remaining gates).** **Still OPEN in the F3 perimeter: the RESOLVER
   bodies ([+0xb0] fn ptr and [+0xb4] map — config-side; the 17
   "RandomMaterials" .rdata sites true 0x496a2e..0x4a97ed are ConfigLua
   name-REGISTRATIONS, not consumers)** + capture validation
   (I1/I3/I5/I6). Generator WIRED (`lib/noise-terrain.mjs`; r3f)
   pending the field-source wiring.
- **DIG #21 DISTILL (2026-09-21, ABOUT_MATH (38), CONSTANTS.md C44) —
  the band-stack binding is STATICALLY CLOSED (per-arg = P5):** the
  C43 hypothesis "mGradient* = the band-stack's per-biome parameters"
  is ELIMINATED — the three Random(min,max) band stacks (fn A true
  0x8EEC70 = layer 1 @setter true 0x8EF37C; fn B true 0x8F5DD0 =
  layers 2/3 @setters true 0x8F20D1 / 0x8F2A6C) read ZERO C37 config
  slots ([+0x1d4] or [+0x220..0x268]) in their whole bodies; the (A,B)
  pairs are pinned .rdata globals (0.32 @0x11dfa00 / 0.35 @0x11dfa20 /
  0.65 @0x11dfb14; chain bases [-0x128] = d·3.0+1.0, [-0x108] =
  d·0.1+0.1 — the (33) window labels corrected). The stacks write the
  mTopology→BitmapCaves GENERATED cave grid: factory fn C1 true
  0x8F2FF0 sizes the grid from the XML <BitmapCaves size_x/size_y>
  (hills.xml: 512×256 = the CE grid shape ✓) and CACHES BY NAME in the
  std::map @0x132aae8 — the CE "one grid shared by 5+ uids" = the
  name-keyed cache. Values = a fresh poro Random per build (diddled
  seed, C27) ⇒ deterministic per (seed, dims, name), matching the CE
  two-instance value-identity. The mGradient*/mInside… XML family
  feeds ONLY the C37 surface evaluator (CE (35)). Port updates same
  day (tests 143/143): noiseKind = 5 for SIN_CAPPED_SIMPLEX (CE (35);
  kind-8 proxy retired; the 36 live noise_type attrs are ALL that
  name); the C37 mult slots renamed after the CE relabel: gradWCoef =
  [+0x268] = the mMultiplierPerlin VALUE (default 1.0 = CE hills with
  the attr absent) and perlinCoef = [+0x264] = the
  mMultiplierGradient VALUE (hills 0.871429); the mGradientAddNoise
  2/3 lanes still throw honestly. Cache r3f → r3g (the solid-mask
  membership of the 574 procedural chunks changes = observable). First
  shape-instrument pass = ABOUT_MATH (39): the handoff window (biome
  ty 11..19) holds ZERO procedural-noise chunks (the noise band lives
  at biome rows 0..2); its allPixelRms 73.5 / flatRms 48.7 / refSolid
  0.690 vs our 0.429 measure the wang/template bands — the noise-band
  self-instrument remains the next gate.


   **Dig #4 plan (handover 2026-09-20 — EXECUTED + F3 read-CLOSED same
   day; full detail ABOUT_MATH 2026-09-20 (15)/(16)):
   1. ✅ Runnable JS port in `mapgen/lib/noise-proto.mjs` — simplex2d,
      latticeGrad2d, latticeVal2d, noiseTransform, evaluator2, f32-exact
      via Math.fround; perm tables = full byte-verified 512-mirrors.
   2. ✅✅ Gradient table FOUND IN-FILE: the whole-exe imm32 "no
      initializer" verdict was right AND the "runtime-only" conclusion
      was a read-convention artifact — .data maps file = VA − 0x401A00
      (NOT the .rdata −0x400E00 rule; see C13 amendment). Table
      @VA 0x12eec08 → file 0xEED208 = 8 REAL gradient pairs:
      0:(−1,0) 1:(1,0) 2:(0,−1) 3:(0,1) 4:(−1,−1) 5:(−1,1) 6:(1,−1)
      7:(1,1). NO CE read, NO placeholder — `lib/noise-proto.mjs`
      GRADIENTS = these bytes (C29 correction).
   3. ✅ Input-mapping walks read: plant = true 0x90f680 (seed =
      WORLDSEED::GetSeed(), ONE draw — C27/C28; cell coords at
      [gen+0x90/0x94]), consumer = true 0x90d1d5 (chunk-map accessor
      0x909da0 + per-biome C24 doubles). NO further RNG reads needed.
   4. ✅ Sampler paint arm read (last named read on the F3 list):
      dispatcher result → u16 material write (+0x1e0 via 0x559de0),
      RGBA-grid [+0x180] alpha check testl 0xff000000 → vtable *0x1c color
      dispatch; mark-flag buffers +0x1a0/+0x1c0 (byte set 1) = the
      "un-materialed" grids; the noise→paint chain is mechanically
      complete in-binary.
   5. ✅ Canon corrections landed: ABOUT_MATH (15)/(16) + C13 (section
      map) + C29/C30 corrections. REMAINING (pipeline, not reads):
      the capture validation (flat-region rms vs seed 78633191) feeding
      I1/I3/I5/I6 + the genmap integration (cache bump r3e→r3f ONLY on
      an observable change) — recorded as the generator-update step.

   **VA conventions for dig #4** (C13 as amended 2026-09-20):
   - true = slab + 0x400800, **universally, including e8 targets printed
     below the slab base** (the lower .text half, file < 0x400c00, is
     absent from the slab — the whole old anomaly, CLOSED via the
     byte-tested floor helper at true 0x44d0b0).
   - .rdata/.data constants: file_off = VA − 0x400e00 (verified vs the
     200000.0f pin); runtime-only .data addresses are NOT in-file.
   - The C20 string-helper VA correction (0x4447f0) is canon.



## 12. Surface band & the noise-lane integration state (2026-09-21)

> Distilled here after the purge of `WIRING_SURFACE.md` /
> `SURFACE_AUDIT.md` (both were session-slop contracts; their verified
> residue lives in this section + CONSTANTS.md C36–C50). Each entry's
> source was re-checked on disk or is a dated CONSTANTS row.

**The surface band's REAL layer model (data-verified on disk):**
1. **The visible surface shapes = the game's per-chunk `init()`
   LoadPixelScene art lane** (seed-independent fixed PNGs placed at the
   chunk's world origin + the per-call offsets). Byte-verified quotes:
   `mountain/mountain_left.lua:9–:10` (left.png at (x,y) + left.png
   background + left_bottom at (x, y+512)), `pyramid_left.lua:28–:29`
   (left_bottom at (x, y+512), left at (x,y)). Callsite count MEASURED
   on the Linux data tree: **256** `LoadPixelScene` lines across
   `data/scripts/biomes/**` (= 196 top-level + 48 mountain/ +
   12 orbrooms/; the older "238" figure was not reproducible).
2. **The spliced-absolute scenes = already rendered pixel-exact vs
   capture** (ISSUES.md I9): `lib/template-render.mjs` `SPLICE_PNGS`,
   11 pieces (boss_arena @1536,12288, tree @−2048,−1324, moon family,
   watercave, lake_statue, lavalake2, gourd, mountain_lake,
   lavalake_pit_bottom, skull).
3. **The cave-field/noise lane belongs BELOW that art lane, not
   instead of it** — the dig-#31 default-render wiring painted the
   flagged caves-field model over the band ("cloud of noise pixels")
   and was REVERTED same day: the caves-field lane is `SURFACE_V3=1`
   OPT-IN only (`lib/noise-terrain.mjs` gate; the no-guessing
   mandate forbids a flagged model in the default lane).
4. **The five static-tile biomes are a third lane** (data-verified
   from the biome XMLs + rendered 2026-09-21): `barren/darkness/
   boss_sky/potion_mimics/watchtower` carry `static_tile="1"` +
   `wang_template_file` = a fixed artwork fg PNG (`wang_map_width/
   height` = the PNG dims, e.g. barren 153×94, watchtower 52×154);
   their on-image wang header is all zeros (not corner-type, not
   valid edge-type) — the herringbone fill cannot run. Rendered by
   `buildStaticTileArea` (`lib/world-gen.mjs`, fg top-left, 1 art
   px = 1 atlas px, colorize-shared) — 57/57 areas, 0 errors,
   143/143 tests. Artifacts: `data/biome_impl/static_tile/
   biome_*.xml` + `temples-assets/*_fg.png` (=_biomes_all.xml
   :1043..1067).

**F3 wiring state (each = a dated CONSTANTS/ABOUT_MATH row):**
- OPT-IN policy enforced 2026-09-21 (about-math (52)): BOTH approximation
  lanes are env-gated out of the default render — the noise V2 lane
  (`SURFACE_V2=1`) and the procedural material-band fill (`PROC_FILL=1`);
  the caves-field composition lane stays `SURFACE_V3=1`. Default render =
  wang areas + LoadPixelScene art + static tiles + the deep-band wall/lava
  approximations; everything else = honest AIR (the fill/overpaint debts
  live in the C32 resolver read + fn B's per-phase blocks).
- Server tile semantics: z>0 tiles = block-majority downsampling over the
  distinct 10px wang cells in each scale block (fixes the zoom-level
  moiré the point-sample produced); the server epoch = Date.now() per
  start so browser-stale `?e=`-cache cannot survive a deploy.
- `noiseKind = 5` for `SIN_CAPPED_SIMPLEX` (the ONLY live name; CE
  (35) = C42 addendum); `gradWCoef` = [+0x268] / `perlinCoef` =
  [+0x264] (the CE relabel, C43); the FINAL-combine + case-2/3 lanes
  ported byte-cited with the axis retrace (digs #22/#23 = ABOUT_MATH
  (40)/(41), C45).
- **The caves-field lane (`lib/caves-field.mjs`) — status update
  2026-09-21 (CONSTANTS.md C51):** the WRITER census is now byte-closed —
  the band stacks (L1/L2/L3 = `0x8EE750`) are **max-bleed raise-only**
  (`push $0` single-point lane); the scatter (`0x8EEAD0`, VA re-pinned
  dig #81) = the `< 0.5`
  empty-cell gate only; **the only lowering-capable writer = the
  smoothstep LERP stamp `0x8EE930`** (`v_out = (v_src−v_dst)·t + v_dst`
  per cell) and the **C32 LoadFromImageData ±1.0 family**; the
  **CaveStructure record lane (the fnB load phase) stamps the BYTE
  grid** (`0x8EF950`, the [P+0x58] byte lane) with its own per-record
  count pair [+0x1c]/[+0x20] (dig #81 correction; +0x28/+0x30 = the
  AABB lane) + strength pair [+0x34]/[+0x38] = the
  XML's per-record strength_min/max (byte-verified vs hills.xml's 10
  records) and the NEGATIVE-grade NextU-scale roll (`mulsd 0x11e0578`).
  BYTE-EXACT in the port: fn C1's 1.0 base + the ×5·w toucher, the C27
  ctor chain, the C50 knob/record interps, the (43)(a) falloff incl.
  the (y/25)⁸ eave, the (58) `stampBlendLerp` byte-form, the record
  roll/writer (its own counts + strength pair + byte-grid), and the
  scatter's roll+gate+recursion. **Still FLAGGED:** the per-phase
  ORDER of the draw consumption (which strength span feeds which
  phase — the [−0x128]/[−0x108] windows are pinned but their
  per-phase *value-source read* is not) + the C1/C2 hand-off detail +
  the A-resolver body (`0x8EE1B0`). The lane stays `SURFACE_V3=1`
  opt-in; the byte bar = the oracle compare
  (`out/oracle/caves-grid-2026-09-21.json`, C48; the compare
  instrument measured per-row rms standing, best row y224 at rms
  0.0164).**
  **UPDATE (dig 64, 2026-09-21): the strength-source question is now
  byte-pinned — L1 = clamp01((d2·0.32+0.35)·roll) with the roll chain
  `d·0.35 − 0.25` per stamp; **L2's v_arg = the LAST L1 output ×
  (d·0.35+0.65)**; **L3's v_arg = (d·0.1+0.1)·(d2·0.35+0.65)** — the
  chain bases (C44) = the per-phase value sources, NOT the biome
  strength spans. The port consumes all three forms;
  the oracle instrument confirms: **the y224 row = BYTE-EXACT (rms
  0.0000, 0/12 deltas)**, and the deep rows (y64/y96) carve for real
  (0.038/0.019/… toward 0.0). The remaining per-phase divergence =
  the draw-budget per phase + the exact walk steps (the standing
  FLAG); the byte bar's best row y224 now byte-matched.**
  **UPDATE (dig 80, 2026-09-21): the composition ORDER + writer
  mapping are transcribed byte-cited (`lib/caves-field.mjs` v4) —
  fnB head draws (positive-fraction count roll + the y-cursor, dig 65)
  → fnA worm walk × cave_count (the 0x8EE930 LERP stamps — the ONLY
  lowering writer; the (43)(a) max-bleed setter per stamp REFILLS the
  carve, so it belongs to the record/eave stamps, whose flag=1 raise
  reproduces the C48 bump peak 1.454092 as a 1.45..1.55 strength
  draw) → the blob decl-loop LERP stamps (v = the C50 interp on the CE
  pair (1.549988, 0.0), radius cap 20) → the record arena (NEGATIVE-
  scale count roll → the byte grid) → L2/L3 = SINGLE-POINT max-bleed
  raises (dig #55) + the scatters. Instrument
  (`experiments/2026-09-21-caves-drawbudget-compare.mjs`, in-repo):
  y224 stays BYTE-EXACT (0/12); the value CLASSES all reproduce (deep
  centers 0.0..0.08, gradient tails, raises ≈1.45, the 1.0 base); the
  remaining divergence = the per-phase draw COUNTS + the record
  IMAGE-lane stamps (the bump/y16-plateau shapes = CaveStructure image
  content — the C48 identify target resolved to the image blend) + the
  fnA y-drift span (queue #2). The former doc-arithmetic OPEN item
  (C46's scatter pair violating the C13 map by 0x800) is RESOLVED dig
  #81: true = 0x8EEAD0 (§8 row 20).**
  **UPDATE (dig 81, 2026-09-22): queue #1 CLOSED — both BitmapCaves
  dispatchers are now byte-read from the exe.** The config dispatcher
  (true VA 0x4B1410, class "CavesSetup") yields the full slot map
  (CONSTANTS C52): dims = size_x/size_y **+0x1c/+0x20** (the old
  "+0x00/+0x04 = dims" census overturned), the two bool gates
  do_beginning_paths/down = **+0x30/+0x31** (consumed at @4f0f3c /
  @4f1da1), the eight knob pairs (cave_count +0x28/+0x2c ·
  surface_caves +0x34/+0x38 · cave_strength +0x3c/+0x40 · cave_childs
  +0x44/+0x48 · surface_cave_childs +0x4c/+0x50 · mountain_count
  +0x54/+0x58 · mountain_size +0x5c/+0x60 · blob_count +0x64/+0x68 ·
  blob_strength +0x6c/+0x70 · blob_radius +0x74/+0x78), the
  structures vector +0x7c..+0x88, mLuaScript +0x88..+0xa0 (size @+0x98
  — NOT a gate, §8 row 19), DEBUG_output_image +0xa0. The record
  dispatcher (0x4ABD60, "CaveStructure") closes the record at 60 B
  with the count pair +0x1c/+0x20 and the strength pair +0x34/+0x38
  (§8 row 18). **The loop→knob map is byte-shown (CONSTANTS C53):**
  loop A = cave_count (@4ef701/4ef704), loop B = **mountain_count**
  (@4eff36/4eff39), loop C = blob_caves_count (@4f05a0/4f05a9) — so
  the port's phase-1 = the MOUNTAIN lane (the flagged guess replaced;
  `blobPhase1` now rolls mountainCountMin/Max, pinned by a disjoint-
  span regression test). L2/L3 counts = literal 120+⌊81u⌋ × 2 L2
  passes (READ, not yet ported); loop-B's inner structure stays
  BLOCKED on the xmm4 base provenance (@4f00e5). Tests 177/177; the
  y224 byte bar re-run = 0/12, rms 0.0000 BYTE-EXACT.**
- **UPDATE (dig 83, 2026-09-22): the surface-band CONSUMER CHAIN is now
  byte-traced end-to-end** (surface-level plan Phase 1; full evidence =
  ABOUT_MATH (83), CONSTANTS C54/C55). Per-cell flow: **sampler true
  0x90d860** → gate on the RAW float field (`&owner+0xb4` via accessor
  slab 0x5491f0, idx y·[owner+0x9c]+x) vs 0.5f → (≤0.5: 0<val writes 1
  into the byte grid owner+0x1a0, stride [owner+0x188]) / (>0.5:
  requires P = `[config+0x1d4]` ≠ 0 → warp true 0x908CB0 → floor →
  wrap ON THE P OBJECT (slab 0x5fdce0, dims P+0x20) → id−1 →
  evaluator2 true 0x908E70 = **`max(0.5, c + ((c−0.5)·0.5)²·5.35·0.95·w)`**
  with its byte-pinned const set → **consumer true 0x8F5030
  (biome_materials.cpp, this = `[config+0x2a4]`): range gate [min,max]
  + a ÷132-count walk over 132-byte material records** → `[cell+0x38]`
  type dispatch {3 → slab 0x603fd0; 1 → 8192-slot intern → planter
  slab 0x363cd0} (the material→world write = the Phase-2 ladder
  target). The FIELD itself is fed by **driver true 0x908F40 — the ONLY
  surfaceField caller in the exe** — kind-dispatching on `[config+4]`
  (kind-0 = the P1 surfaceField(x+0.5, y+0.5, config) lane; kind-1 =
  in-memory `biome->bitmap_data` assert at `[config+0x1b0]`); the driver
  has ZERO e8/e9 callers in text.bin ⇒ invoked indirectly through the
  job functor (OPEN, imm32 scan next). **The ramp (question A)
  converges:** `[config+0x1d4]` is filled by `BiomeHelper::Serialize`'s
  kind-0 default arm = memoized builder true 0x8EE230 (cache .bss
  0x132A528 keyed &config+0xa8 + the config+0x1d8 noise_type string;
  miss → true 0x933D80 → **true 0x7EC4E0 = the ramp-generator
  candidate, below the text.bin floor 0x801800 — lower-.text slice
  dump = the immediate next move** [SUPERSEDED by dig #84: 0x7EC4E0
  = the BiomeSpawnScripts memo, NOT the ramp — §8 row 21]); the
  global-default arm builds bss
  0x132B518 with the C48 ×5 toucher form. Also byte-read: the biome.cpp
  `[owner+0xb4]` release-setter + SetSize+Load @true 0x8EE6BB (C39
  re-verified), the noise_utils.cpp `script_id < 255` resolver on the
  `[config+0xb4]` interface (true 0x9FE450), the LERP tail
  (`buf2 = buf1 + (target−buf1)·q²`, slab 0x4ee130..) and the **C46
  scatter body** (±0.5f + xorps-mask + NextRandom 0xc090c0, assert
  `bitmap_noise`). No code changes; tests 177/177.**
- **UPDATE — dig #84 (2026-09-22): the `[config+0x1d4]` (P) fill chain is
  byte-read end-to-end AND the ramp hypothesis is OVERTURNED** (ABOUT_MATH
  (84), CONSTANTS C56 + C54 corrections; §8 rows 21–22). Serialize dispatch
  exact: kind-1 builder this = &config+0x198 (not +0x1a8); kind-2 → fn2 slab
  0x4EDC40 (w/h at +0x1cc/+0x1d0); kind-0 `[config+0xb8]≠0` → **fn1 slab
  0x4EDA30..0x4EDC3F** (address-keyed memo → 0xB8 C27 gen → P store;
  global-default prop setters corrected to slab 0x52c1e0/0x52e000).
  **The 0x533580→0x7EC4E0 chain = the `BiomeSpawnScripts` factory (NOT the
  ramp)**; `[gen+0xb4]` = a cloned script-lookup callback {fn 0x7EB220,
  ctx=BiomeSpawnScripts*} (C39's "B-map" corrected); the C27 ctor = seed-RNG
  init only (seed @+0x8c, 1.0f @+0x90, draw×200000−100000 @+0x94,
  [+0xb0]=0x8EE1B0, [+0xb4]=callback). driver/evaluator2 boundary + C55 tail
  byte-verified (ret 0x508737, int3 pad, prologue 0x508740, `call
  0x5095a0`); imm32 driver scan = 0 hits. **Question A now hunts the
  XML-parse family (0x496a2e..0x4a97ed) for the mGradient writes +
  surfaceField's config-range read (+0x220..+0x268); the (83) "wrap this =
  P+0x20 = dims" claim is flagged (P+0x20 = a container block).** No code
  changes; tests 177/177; y224 byte bar 0/12 rms 0.0000.
- **UPDATE — dig #85 (2026-09-22): Phase-1 residuals ①②④
  byte-closed, ③ writer located** (ABOUT_MATH (85); CONSTANTS C57–C64;
  §8 rows 22–24; ISSUES I18). ① = the 38-pair attr→slot bind table
  (C58; the mGradient writes ARE the parse-walk bind calls; labels:
  +0x264 Gradient / +0x268 Perlin / +0x26c Extra) — ramp READS
  (+0x270..+0x29c) still OPEN. ② = wrap call 0x90dcce, wrap-this =
  P+0x20 = {w,h,u16vec,cnt} (C61; (83)/(84) = same bytes). ③ =
  LoadFromImageData 0x8f9ab0 stores (C62: f32 @0x8fa15e getter
  0x9499f0, ±1.0f @0x8f9f04/0x8f9f39, u16 getter 0x94a8f0; bounds
  0x8f9ab0..0x8fa930; callers 0x8fa99b + the F3 pair) + aliasing
  owner = P − 0x9c (3 lanes exact) ⇒ gate target = P+0x18 —
  **instance-identity byte-link still OPEN** (+0x1e0 lane doesn't
  fit). ④ = 3 direct e8 callers (C60) — both old zero scans were the
  C57 text.bin scope defect; loop extent OPEN. Phase 1 stays [ ]
  pending the ③ link (or an explicit user waiver). No code changes;
  tests 177/177; y224 0/12 rms 0.0000.
- Cache policy: `out/gen-cache/r3i` holds ONLY wang-area bins
  (seed+area-keyed); the cave-field/opt-in lanes live in non-cached
  in-memory buffers, so no bump was required for the revert; bump
  r3i → r3f-family ONLY when a cached build's output observably
  changes.

- **First in-game validation (2026-09-08, kept for history):** reference
  seed = "extremely close to reality" (correct shape everywhere); +3 seed close with minor deltas. Purple ghost
  layers = OUR hasPath search painting the map — fixed (search on path_map
  copy; oracle re-validated 8/8); cache rev r2.
- genmap MVP shipped: `mapgen/lib/world-gen.mjs` + `mapgen/server/genmap-server.mjs`
  (tile server :8082, `npm run gen:server`) + `public/genmap.html`
  (canvas viewer, ?seed=, live telemetry marker, zones overlay).
  Cold generation ≈ 25 s/seed (57 areas; disk-cached).
- Renderer gaps (ranked): template biomes (surface/Tree/desert/HM art —
  ~1973 chunks; port the game's own data/scripts/biomes/*.lua init
  compositions + LoadPixelScene machinery; even the obsolete noitool recon
  never implemented these (AUTO_GEN stubs) — original work, validated against the
  ~95%-seed-independent capture zones); the lake + rainforest_dark
  no-attempt areas (180 chunks — hasPath semantics question); remaining
  finalize steps for coloring.
- Marker-vs-terrain offset: bounded to x∈[−1..3], y∈[0..2] atlas px by the
  spawn-constraint intersection; precise constant-vs-sawtooth fit armed via
  the L3 foreground-mask instrument (mapcap) — next session.
