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

## 9. Open frontier (ranked)

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

- **Constant-offset principle:** a constant offset is only valid if the drift it corrects is zero or sawtooth-shaped; any linear (multiplier) component makes a constant wrong far from where it was measured. (ABOUT_MATH §4.)
- **Paint-immune judging:** spawn equations (each seeded spawn = an exact wang-cell color fact from entity dumps) are the primary judge; geometry-vs-capture metrics are confounded by non-wang layers and density. (ABOUT_MATH §7quater/§7sexies, mapcap/README ladder.)
- **Order-independence is a hard constraint:** any fill model must be a local, per-attempt state — the global poro stream is out. (ABOUT_MATH §7septies.)
- **The lab is the instant bench:** the 548/362/451-vertex answer keys (seeds 91/92/93, `out/oracle/lab-vertex-grids.json`) verify any new hypothesis in minutes; a correct model scores ~100%, partial-walk scores are noise. (ABOUT_MATH §7septies, §7decies.)
- **Sources or it didn't happen:** every domain fact carries a file+section verified on disk this session; numbers never travel via chat memory or handovers. (AGENTS.md.)

## Session close 2026-09-08 (evening, genmap wiring: in-game tested)

- **First in-game validation:** reference seed = "extremely close to reality"
  (correct shape everywhere); +3 seed close with minor deltas. Purple ghost
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
