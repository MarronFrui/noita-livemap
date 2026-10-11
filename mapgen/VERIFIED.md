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
| 24 | Writing `[owner+0xb4]` (the sampler's float-wrapper gate target, C34/C54): an independent base-install site — plus the candidates below | ELIMINATED dig #85 (REGION-scoped): no install among the ③-region sites examined — ctor null-inits 0x791c8e×2 + 0x8f9565/0x8f956b and config pins 0x8ee3fb/0x8ee694 only (fresh full-.text census, file 0x400..0xd49200: mod=10 disp32 0xb4 → 475 store-patterns/91 loads/761 lea, 0xb8 → 1060/846/710 — counts not individually re-examined ⇒ REGION scope). Ruled out: g_genome_herd_relations 0x12ec8b8 (writers 0x592270/0x5932f0); name→member dispatch 0x4f8857 (invincibility_frames/falling_damages); ctor null-inits; classifier 0x8f5030 refuted twice (body 0x8f5030..0x8f5754, zero member stores). Consistent with C61/C62 aliasing: **owner = P − 0x9c ⇒ owner+0xb4 ≡ P+0x18**, the wrapper LoadFromImageData writes — instance-identity byte-link still OPEN (resolved: row 25) | ✅ ABOUT_MATH §6 (85); CONSTANTS C64 |
| 25 | C62's ③ OPEN: instance identity `kind2-esi == P == sampler-owner+0x9c` + C34's +0x1e0 lane fit ("predicted +0xf4"); (85)'s "owner = P − 0x9c" read as instance identity | SPLIT dig #86: `kind2-esi == P` **PROVEN** (Serialize kind2 arm `call 0x8ee440` @0x8f36fe → fn2 ret @0x8ee741 ← [ebp−0x18] ← its `new(0xb8)` gen → `mov %eax,0x1d4(%ecx)` @0x8f3708, byte chain); `P == owner+0x9c` **REFUTED as instances** — owner+0x9c = in-place embed (ctor @0x90ce66 / Load @0x90d1ab / dtor @0x910a6f, embed end owner+0x154), P = `[config+0x1d4]` ← five standalone/static-gen stores (kind2 fn2 gen; `0x8f2ff0`/`0x8ee230` returns; static imm @0x908583-fifth @0x905fb0 + `movl $0x132b518` @0x8f388f) — heap/static ≠ owner interior ⇒ distinct addresses, same class; **+0x1e0 = owner-own decor u16 grid** (@0x90d2c1/0x90d2e9) never a gen lane ⇒ "+0xf4" premise dissolved; sampler **mixes the two gens** (gate reads embed owner+0x9c/+0xb4 @0x90dba5.., wrap reads config-P). "owner = P − 0x9c" survives as LAYOUT equivalence only | ✅ ABOUT_MATH §6 (86); CONSTANTS C65 |
| 26 | (90)'s ①f read: the record-parser `call 0x7364f0` @0x9eb1aa sits **inside fn 0x9eb020**, so (89)'s grey-error target is also a record-parser caller = a "role reconciliation" OPEN | CORRECTED dig #91: fn 0x9eb020 ends `ret $0x4` @0x9eb131 + int3 pad 0x9eb134..0x9eb13f ⇒ the synthetic-node builder is the next function, **fn 0x9eb140** (guard `test %ecx,%ecx; je 0x9eb1c1` @0x9eb168; `call 0x7364f0` @0x9eb1aa ∈ 0x9eb140, NOT 0x9eb020; `call 0x9eb140` = exactly 3 e8 sites — 0x745b3f / 0x746263 / 0x746530, all in fn 0x7459d0). fn 0x9eb020 = the grey-error logger **only** (this = global 0x132b624, pushed arg 0x11a0738, call site 0x745999) ⇒ the reconciliation OPEN **dissolves** (two adjacent functions, one role each); (89)'s grey-error label and (90)'s parse-fn byte-facts (guard, second wrapper 0xa70d74) all stand | ✅ ABOUT_MATH §6 (91); CONSTANTS C70 |
| 27 | The §12 dig-91 claim "**full-realloc 0x978aa0 = 0 call/jmp sites file-wide**" (listed as a mystery / new open for dig #92) | **OVERTURNED dig #92:** 0x978aa0 = the mCellData `vector::reserve` (arg ≤ 0x63e706 × 0x290, magic 0x63e7063f, old-element dtor loop 0x746e20 stride 0x290, begin/cap/end rewired) is reached by **0 calls + exactly 2 tail-jmps — 0x94b373 / 0x94b386** from the capacity-growth wrapper (ends `ret $0x4` @0x94b38f; capacity via signed fixup / ÷2 / max-%esi = a 1.5×-style growth, exact branch predicate OPEN). The "zero sites" missed the tail-jmp form; the growth path is live | ✅ ABOUT_MATH §6 (92); CONSTANTS C71 |
| 28 | The **"+0x1e0 u16" gloss**: §11's lifecycle map "**names (0xb78e0), [+0x1e0] u16 DECOR write (0x559de0);**" (line 296) + "**dispatcher result → u16 material write (+0x1e0 via 0x559de0)**" (line 411), §12 (86)'s "**C34 +0x1e0 = owner-own decor u16 grid**" (line 653), C65's "**+0x1e0 = owner-own decor u16 grid** (0x90d2c1/0x90d2e9)", and this table's own row 25 aside "**+0x1e0 = owner-own decor u16 grid** (@0x90d2c1/0x90d2e9)" — i.e. the +0x1e0 grid write/content is u16 | **REFUTED dig #93:** the cited accessor 0x559de0 = true **0x95a5e0** — success path returns `base + idx·4` (`mov -0x4(%ebp),%eax; mov (%eax),%eax; lea (%eax,%ebx,4),%eax; ret $0x4` @0x95a6a7..b5; bounds `idx < [this+4]`, OOB assert line **0x4b**, file 0x117a570, expr 0x1179b74) and the planter-path store @**0x90de9c** = `mov %ecx,(%eax)` **dword**; C65's cited sites 0x90d2c1/0x90d2e9 are dword too ⇒ **+0x1e0 = a 4-byte-slot grid, not u16** (C34's own row says only `[+0x1e0] DECOR write` — the u16 label was added later in the §11/§12/C65/row-25 prose). The sampler's u16 read = wrap 0x9fe4e0(this=P+0x20) → `movzwl; dec` @0x90dcd3 (getter 0x94a8f0); the u16 fill container = gen+0x20 (C67/C62). What the dword store holds (slot id vs record pointer) @0x90de9c = **OPEN** | ✅ ABOUT_MATH §6 (93); CONSTANTS C65 amendment + C72 || 29 | The §12 dig-93 gate-order phrase "**assert 0xfe → range `[this+0]≤v≤[this+4]` → assert 0x108 → per component: assert 0x107 → `[+0x04]` record / 0x442610 → assert 0x10f → …**" (line 867) — i.e. the cellFactory assert **0x108 runs once BEFORE the per-component loop**, 0x107 being the per-component one | **REFUTED dig #96:** both asserts are per-iteration — loop head **0x8f5160** (`mov 0x8(%ebx),%ebx; add %esi,%ebx; jne 0x8f5221`; back-jmp `jmp 0x8f5160` @0x8f573b): null-comp **0x107** push @0x8f516b (expr 0x1151e28, skipped by the `jne`) → `mov -0x1c(%ebp),%eax` @0x8f5221 → cellFactory `cmpl $0,0x30(%eax)` @0x8f5224 → `jne 0x8f52e9` → **0x108** push @0x8f522e (expr 0x11732c0) → diag @0x8f52e9 …; loop tail `add $0x84,%esi` @0x8f5713 → count = (end−begin)/0x84 (signed-div magic, imul/sar/shr-add @0x8f571c..0x8f5731) → `jge 0x8f5733` → miss epilogue **0x8f574c** (`pop edi; pop esi; xor eax` @0x8f574e, `ret $8` @0x8f5754) ⇒ **0x107 THEN 0x108 inside every iteration**, both before the diag — the port `classify` mirrors the byte order (asserts at lines 263/264 inside the loop). The rest of the dig-93 chain (diag → limit → polygon → null → v′ → main gate → is_rare → transform → jitter → noise → ramp) agrees with dig #96 and stands | ✅ ABOUT_MATH §6 (96); CONSTANTS C75 |
| 30 | (82)-era P1 census cells: `noise_type` = SIN_CAPPED_SIMPLEX uniformly; mountain_lake `mGradientStartY` = −1024; `mGradientAddNoise` = "1" everywhere; desert `mMultiplierGradient` = 0.871429; mountain_center + pyramid without a `<Topology>` | **CORRECTED dig #98** (raw-XML + parser pins, the 30-file P1 census): ① `noise_type` ABSENT for **winter, winter_caves, mountain_center, pyramid** ⇒ uidFrom:114 noiseKind −1; ② mountain_lake StartY = **−835**; ③ AddNoise = **"0"** for **hills_flat + mountain_lake** (laboratory outside P1) = the LIVE default-arm (@0x90ab7d) inputs; ④ desert mMultiplierGradient = **0.881426**; ⑤ both DO have `<Topology>` — with none of the 9 noise/mGradient attrs | ✅ ABOUT_MATH §6 (82),(98); tests/mapgen/surface-census.test.mjs |
| 31 | `mapgen/ABOUT_MATH.md:3588` (the (40)-canon blend tail): "the tail assignments = `r' += (n·r' − r')·((r'−0.85)/0.1)`" for all three cases | **PARTLY REFUTED dig #98 (case 2 only):** cases 1/3 stand — r2 = f(n·r′) via `mulsd` @0x90b075 (case-3 shares it) and the sign r2−r′ = `subss` @0x90b08b ✓ — but **case 2's input = bare f32(n)**: `jmp 0x90b079` skips the mulsd ⇒ its tail = (n − r′)·t, not (n·r′ − r′)·t | ✅ ABOUT_MATH §6 (40),(98); CONSTANTS C77 |
| 32 | entry (94)'s two rdata reads: "**Y = trunc(rand·[0x11dfef0 = 0.0]) = 0 ⇒ the walk STARTS AT ROW 0 (top)**" (§6 line 6585-6586, §11 dig-94 bullet line 874-875) and "(94) ③'s **the band-lane select is FIXED k = 3 (both scale consts 0x11dfef0/0x11e05f8 = 0.0 ⇒ ecx = 3 always, ja never taken)**" | **OVERTURNED dig #102 — f32 trap:** both addresses hold f64 consumed by `mulsd` (F2 0F 59). Raw bytes: `0x11dfef0` = `0000000000001840` = **f64 6.0**, `0x11e05f8` = `00000000000008c0` = **f64 −3.0** (same-run anchors `0x11dffe8` = 101.0, `0x11dfa40` = 0.4 validate file = VA − 0x400E00). ⇒ **Y₀ = trunc(6u) ∈ {0..5}** @8f02a5..8f02b9 (start row random, not fixed 0) and **`ecx = 3 − trunc(−3u) ∈ {3,4,5}` @1/3 each** @8f02c4..8f02e0 (lanes [4] 0.25u+0.75 / [5] 0.13u+1.07 LIVE; `ja 0x8f03a6` dead only because ecx ≤ 5). Reading the first 4 bytes as f32 at an f64-operand address = the trap — operand width comes from the opcode | ✅ ABOUT_MATH §6 (102); CONSTANTS C81 |
| 33 | The long-carried gloss **"`0x44d0b0` (slab 0x4c8b0) = the C13-verified CRT fld/fistp ROUND-to-nearest wrapper"** (C13/C26/C40/C83/C91 era) and everything derived from it — the lattice-cell law **`c0 = 57·round(y) + round(x)`**, the round-derived literals (byte-literal 0.493832439, smoke 0.834, (112)'s "round cell" discriminator) | **REFUTED dig #113 — it is the CRT FLOOR wrapper:** body 55 B @0x44d0b0 = `cvtss2sd → fldl → fstpl → call 0x1033a52 → fstpl → cvtpd2ps`, **no `fistp`**; thunk 0x1033a52 = `jmp [0x114a534]` = MSVCR120.dll **`floor`**, hint 1646 (PE import-dir walk `/tmp/opencode/verify-floor-113.mjs`, 656 entries; thunk run named by `/tmp/opencode/resolve-wrappers-113.mjs`). So **`c0 = 57·floor(y) + floor(x)`** at both sites (0x8fb350 @0x8fb3e9/3fc; 0x8fb570 @0x8fb6f2..6fe, parities on the floor values) and the true byte-literal at (12.5,−3.25) = **0.898207068**. The fldl/fstpl pairs are f64 arg marshalling, not rounding. Do not re-test round; the IAT slot labels are in C92 | ✅ ABOUT_MATH §6 (113); CONSTANTS C92; ISSUES I20/I22 closed |
| 34 | The open hypothesis (I21, (101)-era) that **a global registration / classify-frame offset is the dominant remaining surface-band error** — i.e. the surface-y IoU gap should close once the frame/byte fix lands | **ELIMINATED (dominance) dig #114:** re-ran `2026-09-24-surface-y-iou.mjs` with the #113 byte fix (C93): `meanAbs` **did not improve** 88.76 → 89.58 (bias 1.62 → 2.88, n=7065); family biases are mixed-sign (mountain −28.89 / winter −17.93 / lake −40.76 / desert **+36.79** / hills **+179.37**) where a global offset would shift them together; within-family sign flips (hills 33_13 −205.69 vs 39_14 **+340.83**; desert 45_14 −546.15 vs 46_14 +321.57); only 11/56 tiles moved (6 hills + 5 desert — the whiteLattice2d lanes); and the band's depth tilt **strengthened** (`fitDepth` a −0.347 → −0.56164, b 99.172) — a registration change cannot add a slope. **Scope: GLOBAL registration only** — family-local misregistration is NOT excluded; **field shape** is the dominant remaining error (⇒ I21 frame flip PARKED, next dig = shape). Source: ABOUT_MATH §6 (114) |
| 35 | The P1 residual "**the `<RandomColor>` runtime consumer is OPEN**" (Current_work dig-#93 residual at line 171/~611; ISSUES P1 cross-link's "**the per-biome RESOLVER TABLE ([+0xb0] bodies, the config 'RandomMaterials' side), ONE remaining read family**") | **RESOLVED for reachability + mechanism dig #115; PARTLY for the resolver body.** Full chain (all bytes re-read): `ProceduralTerrain::Init` **0x905fb0** (exactly 5 call xrefs) → loop 0x907ab0..0x907b16 builds a **stack wrapper {vptr `0x1199d40`, `vec[i]`, self=&wrapper}`** → dispatch **`0x8cef30`**: manager[+0x25]==0 (ctor `movw $1,0x24(%edi)` @0x8cf05a) ⇒ **QUEUE arm 0x8cef67** → `0x9fa830` enqueue → deferred runner **`0x8cf1f0`** → **slot2 `0xa99ea0` = `mov 0x4(%ecx),%ecx; jmp 0x904c20`** (tail-jump; `call 0x904c20` = 0 sites, no e8/e9 to `0xa99ea0` ⇒ **reachable only via the vtable**) → consumer **`0x904c20`** (`ret` @0x905faa). **Record layout** = {+0x00 → **A** with the `[A+0x1f4]`→`[x+4]==0` gate @0x905b50-72; **+0x04 = `wang_template_filename`** std::string; +0x1c std::string; +0x34/+0x38 dims clamped [1,0x400]; +0x4c seed}; **guard = assert `wang_template_filename.empty() == false`, line 1808** @0x904d33-90; seed → `cvtdq2pd`/2³²-bias/×0.5 → `0x10098c0` (assert `seed != 0.0`, line 102, `random.cpp`) → Schrage Park–Miller → **pick `idx = cvttsd2si(state·count·(−1/(2³¹−1)))` with `mulsd 0x11e0578` — CORRECTION: −1/(2³¹−1), NOT −2⁻³¹** ⇒ addr ∈ [first, last−4]; **warm-up `N = (W mod 11) + (seed mod 12)`, N ∈ [0,21]**; two `LoadFromImageData 0x8f9ab0` calls inside (0x905dd7/0x905f1e); flood-fill asserts lines 530/533/534/548; data.wak = **3 `<RandomMaterials>` blocks / 6 `<RandomColor>` rules**. **Resolver half stays OPEN (I24 ⑤):** the `+0xb0` literal census (opcode 0xc7 ∧ mod=2 ∧ disp32=0xb0, 77 hits) shows **only `0x8ee1b0` ever installed there** ⇒ no per-biome resolver *body* is literally placed at +0xb0 (80 register-form stores unresolvable). Residuals I24 ①–④ = RTTI class name (do not name the wrapper), A's identity, record +0x1c string, sync-arm wrapper kind | ✅ ABOUT_MATH §6 (115); CONSTANTS C94; ISSUES I24 |
| 36 | The long-carried port model **"inside surfaceField, gradAt receives `coord·0.49162514 + p94`"** (`noise-proto.mjs:676`, cited as C80's "why world px" premise + I23②'s premise) and the resulting either/or that **one of V2/V3 is simply the wrong frame** | **CORRECTED / INCOMPLETE dig #116 (I23②):** the true callee `0x90a860`'s *argument* frame is **pixels +0.5** (driver `originX+x / originY+y`, counters step 1 over `driver[+0x28]/[+0x2c]`; proved decisively because the sibling `0x909da0` applies `>>9` / `&0x1ff` — 512-px chunk index + intra-chunk offset — to the same values, and `this[+0x38]/[+0x40]` is added only inside `0x909da0`) ⇒ **V3's world-px frame IS the callee's frame; V2's `px/10` cell frame is not.** But the callee's *grid* coordinate is `f32(0.49162514·(x+0.5) + P[+0x94]) × 0.1` (f32 0.1 = `0x11df974`; floored → 4× `0x9fe620` wrap-mod corners → smoothstep `(3−2t)·t²`), with `0x11e015c = 10.0` and `divss 0.1` re-scaling back in the add-noise arms ⇒ the port's `surfaceField` **omits that ×0.1**, so with V3's pixel args the grid index runs **10×** the game's, while V2's pre-÷10 makes the grid term exact but feeds the r-eval (`0x90b280`, called with the same pixel args, not ÷10) 1/10 of the pixels the game gives it. **⇒ each lane is right for exactly one of the callee's two consumers; the defect is a port-side one-step omission inside `surfaceField` (plus the still-undecided ramp-placeholder units), not a lane-frame question.** C80's conclusion (world px) survives, but its "why" is now byte-proved rather than placeholder-derived. Sources: C95, ABOUT_MATH §6 (116), ISSUES I23② |
| 37 | The port/issue model **"V2's `px/10` cell pre-scale is the correct frame for the grid (and V3's world-px frame runs it 10×)"** — the lane-frame either/or that preoccupied I23② through digs #114–#116 | **ELIMINATED dig #117 — closed on both bytes and measurement.** `surfaceField` now applies the byte-verified ×0.1 (`noise-proto.mjs:676`), both lanes feed **pixels**, and the C39 ramp converts grid→world-px: V2's grid index came out **byte-identical** (0.049162514·px) while V3's stopped running 10× — i.e. the frame defect was real (C95) and is fixed — yet the C79 IoU barely moved (**89.58 → 89.42**, n 7065→7027, FAIL stands; desert/winter/hills bit-identical, mountain 47.18→46.36, bty10 44.85→36.62, lake topAir→1). Probed mechanism (pre/post lib side-by-side): the caves band now reads the field's top ~26 rows at bty14 (+25.17/bty, C96) and the ramp biomes got their calibrated frame. **⇒ DO NOT RE-LITIGATE LANE FRAMES** — the residual is SHAPE (caves-field model + the (A) ramp + the unread fnB band-stack, I25) behind the still-missing I23③ shape instrument. Sources: C96, ABOUT_MATH §6 (117), ISSUES I23②/I25 |
| 38 | The pre-instrument shape hypothesis **"the rendered-shape gap is caused by the wrong lane config (V2 vs V3 vs the caves-field gradAt) and/or by vertical misregistration — pick the right lane/anchor and the masks should align"** (the working reading of I23③, adjacent to row 34's global-registration hypothesis) | **ELIMINATED (dominance) dig #118 — first direct shape measurement.** `2026-10-10-surface-shape-iou.mjs` (C97; C79's exact 56-tile set, cross-checked match) scored the full 512×512 solid masks under all three lane configs: overall iou **v2 0.23391 / v2v3 0.25183 / v3 0.24644** — the ENTIRE lane space spans **Δ0.018**; free vertical alignment (dyOpt = argmin row-profile L1 over dy ∈ [−256,256], reported as iouShift) buys **≤ +0.008** overall (dyOpt median 0, 30/56 tiles exactly 0; even the biggest family gains — mountain +0.027, lake +0.036 — leave them at 0.619/0.465). The measured failure mode instead is **under-solidity**: fR 0.480 (ref, identical across runs) vs fG 0.141–0.167 (gen) ⇒ the port renders 3–3.5× too little solid, with a family gradient **mountain 0.59 (best tile 0.92078) ≫ lake 0.43 > hills 0.09–0.14 > desert 0.017–0.074 ≈ winter 0.056**; the caves-field gradAt does help its biomes (desert 0.017→0.074, hills 0.089→0.141 v2→v2v3) yet stays ~10× short of fR, and winter is lane-invariant because noiseKind −1 throws before any fork (§8 row 30; `noise-proto.mjs:530` ⇒ fall-through ⇒ air). **⇒ the residual is field/classify CONTENT (the fnB band-stack, I25), not lane selection or registration**; mountain reaching 0.92078 proves the pipeline can be near-exact. Scope: lane config + VERTICAL registration only — a lane-local anchor fit is untested (OPEN: 6 tiles' dyOpt = −12 = the L3_ANCHOR y, C78; I21-adjacent, NOT concluded), horizontal offsets unmeasured. Sources: C97, ABOUT_MATH §6 (118), ISSUES I23③ |
| 39 | The caves-field port model **"fnB's per-phase placement = the `buildCavesField` composition: uniform `blobStamp` per phase over the whole grid (radius min(20,·)), L2/L3 = single-point raises (l2v = 0 ⇒ a literal no-op), counts/draws = the model's"** — the composition the I25 gate called "still a model" | **RETIRED as a description of the bytes (read half) dig #119 — full laws byte-verified, in ABOUT_MATH §6 (119).** Mountain = **top-band vertical runs**: X = rollPos(5,w−5), base = ⌊0.1h·u⌋, rows base..base+⌊11u⌋+15 (Y_end := base on a 20% coin that also sets v := 1.5+0.25u), R = rollF32(mountain_size[+0x5c],[+0x60]) + Σ0.5(u+1)/row (**no cap**), v = 1.5 decaying ×(0.97+0.03u) on 50% of rows. Blob = uniform x ∈ [5,w−5] but **y ∈ [25, h−5]** (v/R = rollF32 knob pairs, no cap). **L2 = exactly 2 passes** (`inc [−0x10c]; cmp $2; jl 0x8f1b00`) × count **120+⌊81u⌋** of a snaking setter-chain from y = 0 (pass 1 x₀ = w/2+s·rollF(3.5,35), pass 2 flips s and uses rollF(25,75)); **L3 = 1 pass × same count** (gated by **config[+0x31]**) from x₀ = w/2∓(3.5+2·C-rand) with a per-run rand band [1+r, 2(1+r)]; each point writes setter `0x8EE750` **flag=0** with v = chain·(0.35u+0.65), scale = (0.1u+0.1)(0.25u+0.75), chain = clamp(chain·(u+0.5), band), y += 0.1u+0.95, x += velocity (L2 step 0.5u−0.25 clamp ±2.5 / L3 step 0.3u−0.15 clamp ±1.0), plus a **5% spawn scatter** (`spawn_small_enemies`95 / `spawn_items` 5 → `0x8EEAD0`, no field write — gameplay side-lane). Blend `0x8EE930` = **t²-falloff lerp** (cell += (v−cell)·t², t = (R²−d²)/R²; R ≤ 1 = single-cell write iff cell > v; plain bounds checks, **no wrap**) — both the composition AND the port's linear-t `stampBlendLerp` diverge. **The port is NOT yet changed** ⇒ the model remains wrong-but-live in exactly these listed ways (next dig: port + C97 A/B + bump); I25's **index half (kind arms + sampler gate) stays OPEN**. Sources: entry (119), C98, ISSUES I25 |
| 40 | **C50**: "[P+0x74]/[+0x78] = the blob-strength (min,max) pair consumed by fnB (v = A + d·(B−A) → the blob-setter v_arg); CE (+0x74,+0x78) = (1.549988, 0.0) hills-class" — plus its derived port model (the strengthA/B knobs, the dig #54 radius min(20) cap, the uniform-stamp blob lanes) | **OVERTURNED dig #120 (byte + disk):** loop C loads **[+0x74]/[+0x78] as the blend's R (radius)** (rollF → xmm2 @0x8f10e8..0x8f115f) and **[+0x6c]/[+0x70] as v (strength)** — C52's slot map was right; the CE "strength pair (1.549988, 0.0)" = the radius pair mislabeled. hills.xml on disk (2026-10-10, the LocalLow data dir) declares blob_caves_strength 1.5..3 / blob_caves_radius 1..10; the min(20) cap has NO byte site (R = rollF, uncapped) and the strengthA/B knobs are gone from the port. The **full port lands this dig** (entry (120), C99): loop B top-band runs, loop C y-first stamps, the L2 2-pass + L3 do_beginning_down chains through the now-settled **lower-only** setter law (C46's flag branch closed: flag = eave-gate only), and the t² blend — `caves-field.mjs` v5. C97 shape A/B: v3 0.24644 → **0.24708**, v2v3 0.25183 → **0.25393**, v2 0.23391 unchanged (lane-expected), no cache bump. I25's **index half stays OPEN**; new I26 = the walk/record writer-model reconciliation. Sources: entry (120), C99, ISSUES I25/I26 |
| 41 | The consumer model **"the caves field's gate value = surfaceField's RETURN — the driver 0x908F40 kind-0 arm feeds exactly that into the f32 grid the gate reads (dig #101's comment premise), so the caves field must ride surfaceField's ONE gradAt slot and is indexed by the u-law `u = 0.049162514·px + 0.1a`"** — the routing/I25 premise the port ran on through dig #120 | **ELIMINATED dig #121 — bytes + measurement.** The caves consumer = the sampler 0x90d860's DIRECT cell read @0x90dba5..0x90dbd0: `eax = [owner+0x9c]` (grid[0] = W), `ecx = &owner+0xb4`, `idx = W·esi + edi` with **OUTER = y / INNER = x** (world-compute @0x90dbed..0x90dc0d: xmm2 = origin_x + INNER, xmm3 = origin_y + OUTER — the kind-2 warp call @0x9091d7 pins xmm2 = x, xmm3 = y), getter `0x9499f0` (= dig 83's slab 0x5491f0), gate `comiss 0x11dfa94 (0.5) → jbe 0x90e02b` — and the writer `0x8EE750` uses the SAME law @0x8ee776..0x8ee79e (`W·y + x`, same getter, same `[0]`=W/[4]`=H/[+0x18]`=data layout ⇒ reader/writer closure). The u-law belongs to **surfaceField's kind-0 grad chain only** (C95/C96 stand in that scope); the kind-1 arm = bitmap_data `W·(y mod H)+(x mod W)` RGB pixel arm (getter `0x949f60`) and kind-2 = warp → `0x8fae40` → variant `[P+0x23c]` → comiss 0.5 — neither touches the float field. Port: `noise-terrain.mjs` now reads the caves lane directly (`gradKind === "caves" ? gradAt(wx,wy) : surfaceField(...)`) ⇒ C97 shape IoU **v3 0.24708 → 0.46464, v2v3 0.25393 → 0.46557, v2 bit-identical**; fG 0.162 → 0.840 (vs fR 0.480) exposes the uncarved 1.0 base = I26's signature. Residuals → **I27** (object join + tile mapping). Sources: entry (121), C100, ISSUES I25 closed/I26/I27 |
| 42 | The caves-field port model **"the walk's `push $1` stamp = a raise-only `carveCircle(dir="max")` (the walk can only RAISE — flag=1 eave = the per-cell `((py−1)/25)⁸·v+1`) and the record's float stamps = `carveCircle(dir="max")` raises"** — the biggest known-wrong-but-kept piece left in `caves-field.mjs` (the (121) FLAGGED reconciliation) | **ELIMINATED dig #122 — bytes + measurement (I26 CLOSED).** (i) The walk's stamp @0x8ef37c = the setter 0x8EE750 with **VALUE = the 3-segment radius envelope R(t)** (prologue re-pinned: `s=(2−trunc(−4u))/5`, `rA=rD=s·0.2u`, `rB=rC=s·(1+2.5u)`, all consts re-read — C101(a)), **SCALE = clamp01(slot″)**, **flag = 1** ⇒ SCALE ≤ 1 + the setter's lower-only guard ⇒ **the walk CARVES**. (ii) The flag=1 eave, byte-exact: the flag = the byte `[ebp+8]` (`cmpb` @0x8ee839, `je` @0x8ee85c); the y = the **stamp CENTER** y (the point `[edi+4]` @0x8ee85e — the cell coords form only at @0x8ee892), q = **y/25.0** (`0x11e01e0`, **no −1** — C99's "(y−1)/25" corrected in place), q²·q⁴·q⁸ → target′ = 1 + q⁸·(target−1), **circle arm only** (C101(c)). (iii) The record phase does NOT call the setter (its callers = walk 0x8ef37c / L2 0x8f20d1 / L3 0x8f2a6c): its engine = **FUN_008EF870** — per cell over the per-stamp template's region, `field.cell += (v − field.cell)·temp.cell`, a **two-sided lerp** (no eave/guard/value-branch) — plus **FUN_008EF950**'s stencil byte copy (gate `[temp+0x5c] ≠ 0`, copy the template's nonzero bytes to (x0,y0)); the ctor 0x8F9470 ships the template EMPTY (C101(d)) ⇒ the fill engine = **I28 open**. Port: `setterStamp` flag param + the center-y eave, walkChain → `setterStamp(...,1)`, new `stampLerpTemplate`, `caveRecordStamp` → the lerp, `carveCircle` = LEGACY (export kept). C97 A/B: v2 **0.23391 bit-identical** (no cache bump), v3 fG **0.840 → 0.71506** (vs fR 0.48029 — the (121) over-fill signature drops as I26 predicted), IoU 0.46464 → 0.45278 (the carve removes solid the ref keeps — the residual is the registration/model gap I23①/I24, not the writer law). Sources: entry (122), C99 corrected, C101, ISSUES I26 closed/I28 |
| 43 | The caves-field port model **"the record lane stamps via the 0x8EF870 two-sided template lerp (the port's `stampLerpTemplate` stand-in) + the 0x8EF950 stencil byte copy, with the count roll `count_max − trunc(u·span)` counting DOWN from max"** — the record half of entry (122)'s reconciliation (C51's roll/write claims) | **ELIMINATED dig #123 — bytes (I28 CLOSED, C102).** The record window (fnB @0x8f11b3..0x8f1746) is a PRNG-DRAW CONSUMER: the ctor 0x8F9470 zero-inits the template (`movl $0x0` @0x8f9481..0x8f94c8 ⇒ `[temp+0] = [temp+4] = [temp+0x5c] = 0`) and nothing in the window fills it (the temp's only addresses = the 3 `lea −0xfc` sites ctor/fn950/dtor) ⇒ fn870 exits `[temp+4] ≤ 0` @0x8ef888b and fn950 skips the stencil `cmpl $0,0x5c(%ebx)` @0x8ef977 → the epilogue @0x8efa2d ⇒ **no field/byte writes**. The count roll = `count_min + trunc(u·(count_max − count_min + 1))` — **UP from min** (`jle 0x8f16f1` skips ≤ 0; the −2⁻³¹ `mulsd` = a negative-intermediate idiom, not a down-count — C51 corrected in place). Per stamp: the ctor-seed (its own draws are stack-local) + the 0x668400 resolver (1 draw per well-formed `$[lo-hi]` group; XML census 94 plain / 8 grouped of 102 image_file values) + X + Y + strength = 4–5 stream draws, all values discarded ⇒ the lane shifts the STREAM only. Port: `caveRecordStamp` draws-only `(rec, prng)`, `rollNeg` + the stamp call removed, `stampLerpTemplate` LEGACY. Oracle y224 byte bar holds; C97 v2 0.23391 bit-identical (**no cache bump**) / v3 IoU 0.45278 → 0.45240, fG 0.71506 → 0.71459 (near mask-neutral). Sources: entry (123), C102, ISSUES I28 closed. |

## 9. Open frontier (ranked)

1. **RESOLVED (2026-09-08): the sub-seed derivation is runtime-confirmed AND end-to-end verified for regular areas** — see §5 and the chain-vs-spawn-equations result (ABOUT_MATH §6, 2026-09-08): **12/12 direct-trigger constraints satisfied across seeds 91/92/93** by chain-derived fills (unique early attempts A=0/3/1, consistent (+1..3,+1..5) px anchor; 60 wrong-seed controls never exceeded 3/4). The lab anomaly is explained: the injected lab biome fills via a different path (§8 row 17). **Remaining frontier (offline):**
   - **a. ~~hasPath emulation~~ ✅ DONE (2026-09-08):** ported (`lib/has-path.mjs`) and oracle-validated — 8/8 accept/reject constraints (excav 91/92/93 → attempts 0/3/1), coalmine 91 independently corroborates (attempt 1 = the spawn-judge's winner). Wired as `generateAreaExact` (`lib/generate-exact.mjs`, ~10 ms/area). The accepted out_map carries the hasPath mutations (blocked-room whites, hax) = exact finalize input.
   - **b. Cascade-class spawn offsets** — potions/wands spawn at structural offsets from the wand_altar scene art (+ RNG gate); needed to extend the judge beyond direct triggers (pure data modeling: altar art + per-biome g_items lists).
   - **c. Post-wang layers** — room blocking / coalmine_hax / pixel scenes for full geometry (needed for visual prediction, not for spawn facts).
   - **d. Optional:** identify the CE-observed A=99 last-filled area (no oracle items — untestable, consistent).
2. **12 border-zone key mismatches** (parked, §4, lab-scope): systematic across seeds; suspect the key's border values or a game-side edge effect. Do not chase until the lab scope needs it. ABOUT_MATH §7decies.
3. ~~Port read-offset convention~~ **RESOLVED (2026-09-08):** real-area fills anchor at ~(3,3) px from the area origin — the port's geometry is essentially exact; the lab's (3,−1) cell offset was lab-recovery bookkeeping. (Chain-vs-spawn-equations run, ABOUT_MATH §6.)
4. **Small-variant-pool content:** the 17.9% two-agree-one-differs capture class (even split across seeds) is a separate RE target (randomMaterials / scene variants?). mapcap/README.
5. **Post-wang layers:** the game's `finalize` family (`fillMainPath`, `fillBlockedRooms`, `fillC0ffee`, `ClearPath`, random-material fills) and pixel-scene placement — required for full visual prediction (§9.1c). **Re-derive each step from the binary; do NOT port noitool's versions** (obsolete; known-buggy hax constants). ABOUT_MATH §7. *(2026-10-06, dig #115: the random-material/`<RandomColor>` fill's **runtime consumer chain** is now byte-read end-to-end — §8 row 35, (115), C94; remaining = the per-biome resolver bodies (ISSUES I24 ⑤) + the record/RTTI residuals I24 ①–④.)*

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
| 9 | Runtime streaming / chunk loads | **VA-CORRECTED 2026-09-18 (see ledger)**: ProceduralTerrain::Update() = FUN_0090b8a0 (profiler 0x11753ac @0x90b8cf) → DoBufferedPixelScenes() = FUN_00910c20 (profiler 0x11764ac @0x910c59); buffered-scene enqueue w/ dedup + flush = FUN_0090c1f0 (call sites 0x818c6e LoadPixelScene binding, 0x907fc9 Init, 0x90bd1e). Earlier "0x50b0a0/0x510420" were shifted-slab VAs (+0x400800 correction, byte-pinned) | 🔬 (pixel-scene arm fully read: scene executes only when ALL FOUR overlapping 512-chunks present — 4-corner probe of the chunk bit-grid DAT_0x132aed8; STREAMING_CHUNK_TARGET readers found at 0x79e65a/f1/74f = per-frame budget regulator); **chunk-request consumer arm ➜ next read (chunk bit-grid 0x132aed8 imm families + 0x79xxxx frame-tick)** · **UPDATE dig #94 (2026-09-23): the per-frame APPLICATION ORDER inside Update 0x90b8a0 byte-pinned — (1) `DoBufferedPixelScenes 0x910c20` FIRST, unconditional (after profiler ctor 65a640) @90b8f0 → (2) gate `cmpb $0,[ebp+8]; je 0x90ba86` @90b8f5 → chunk-view loop @90b930 (stride 0x14, count ÷20 via 0x66666667, entry gates `cmpb $0,0x4(%esi)` @90b94d / `cmpl $0,0xdc(%esi)` @90b953) → view-AABB @90b9a8..9c9 → `call 0x909810` @90b9d9 (returns al; role OPEN) → al → config fetch `0x909da0` @90ba28 (slab 5095a0) → `[config+0x2a4]≠0` @90ba31..39 → `call 0x8f75c0` @90ba48 (5 args; head = biome_materials.cpp assert line 0x2d3 @8f75e3..8f76aa, main path @8f76af — downstream role OPEN) → entry erase-by-swap @90ba4d..ba82. CAVES lane = built in the config-P fill, NOT in Update: fn C1 `0x8f2ff0` called @**0x8f37a4** (`fulltext86.asm` L1510258; gate ecx==0 ∧ `[this+0x1d4]==0` ∧ `[this+0xc0]≠0`, result → `[this+0x1d4]` @0x8f37ae) → fnB @8f323c; Serialize-fn `0x8f3260` also calls fnB direct @8f3770 (arm pre-gate @8f372d..8f3757 OPEN); Serialize's caller a4e67a unread ⇒ **fill timing OPEN**; state machine `0x8e4ec0` = caches/DistanceField only (F1 ✓) |
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
   **FIDELITY CAVEAT (2026-10-02 (112), C91, I22):** the port's three
   blend endpoints are inverted — the lane computes and the texture is
   real, but its values are the cell-mirrored lattice (port =
   binary(1−wx,1−wy) on the same c0; smoke 0.834 = the INVERTED
   value, byte-literal 0.493832439). Fix pending I22.
   **~~FIDELITY CAVEAT~~ FIXED (2026-10-06 (113), C92, I22 closed):**
   the three endpoint pairs were swapped AND the lattice cell corrected
   round→floor (0x44d0b0 = the CRT floor wrapper, C92) — the port
   now equals the asm-literal at all 5 side-by-side points (|Δ| ≤
   1.19e-7), byte-pinned in `tests/mapgen/surface-census.test.mjs`
   (`whiteLattice2d(12.5,−3.25)` → **0.898207068**; the old 0.493832439
   literal and the smoke 0.834 were round-derived = stale). The lane's
   "computes + real texture" claims stand unchanged.
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
  **CaveStructure record lane (the fnB load phase) writes NOTHING —
  OVERTURNED dig #123 (C102):** the 0x8EF950 stencil gate (`0x5c(%ebx)
  = 0` @0x8ef977) always skips on the ctor-zeroed template, and the
  count roll is **up-from-min** (the "NEGATIVE-grade NextU-scale roll
  (`mulsd 0x11e0578`)" read the sign at the const — C51 corrected in
  place). The surviving facts: its per-record count pair
  [+0x1c]/[+0x20] (dig #81 correction; +0x28/+0x30 = the AABB lane) +
  strength pair [+0x34]/[+0x38] = the XML's per-record
  strength_min/max (byte-verified vs hills.xml's 10 records) — the
  lane's ONLY effect = the draws (C102). BYTE-EXACT in the port: fn
  C1's 1.0 base + the ×5·w toucher, the C27 ctor chain, the C50
  knob/record interps, the (43)(a) falloff incl. the (y/25)⁸ eave, the
  (58) `stampBlendLerp` byte-form, the record lane's DRAW budget (its
  own counts + strength pair = values discarded), and the scatter's
  roll+gate+recursion. **Still FLAGGED:** the per-phase
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
  fnA y-drift span (queue #2 → **RESOLVED dig #94, entry (94) / C73**).
  The former doc-arithmetic OPEN item
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
  BLOCKED on the xmm4 base provenance (@4f00e5) **[RESOLVED dig #94,
  C53/C73 — xmm4 = u1·(−0x10c) @8f07b5..8f083c → cvttss2si @8f08e5 →
  −0x118 @8f08f3; the base's value semantics stay OPEN]**. Tests 177/177; the
  y224 byte bar re-run = 0/12, rms 0.0000 BYTE-EXACT.**
- **UPDATE (dig #123, 2026-10-11): the CaveStructure record lane is a
  PRNG-DRAW consumer — I28 CLOSED.** The record window (fnB
  @0x8f11b3..0x8f1746) never writes: the ctor 0x8F9470 zero-inits the
  per-stamp template (dims/containers/`0x5c` = 0) and nothing fills it
  ⇒ fn870 exits `[temp+4] ≤ 0` @0x8ef888b, fn950 skips the byte stencil
  @0x8ef977 → the epilogue @0x8efa2d — **no float/byte writes** (the
  "record stamps the BYTE grid" / "0x8EF870 two-sided lerp" models are
  ELIMINATED — §8 row 43; C51's roll/write claims corrected in place).
  The law = the draw budget (C102): count = count_min + trunc(u·span) —
  **up from min**, ≤0 skips; per stamp: the ctor-seed (the ctor's own
  draws are stack-local, not the stream) + the 0x668400 image resolver
  (1 draw per well-formed `$[lo-hi]` group; census 94 plain / 8 grouped
  of 102 image_file values) + X + Y + strength = 4–5 draws, values
  discarded ⇒ the record lane shifts the STREAM only. Port:
  `caveRecordStamp` draws-only, `rollNeg` removed, `stampLerpTemplate`
  LEGACY. The C48 bump is therefore NOT the records' (the ref's y0 bell
  x10..28 stays unexplained — a raise-capable lane's POSITIONS diverge
  under the still-modelled walk draw budget, or I27's published
  objects). C97: v2 0.23391 bit-identical (**no cache bump**), v3 IoU
  0.45278 → 0.45240 / fG 0.71506 → 0.71459 (near mask-neutral), v2v3
  0.45557 → 0.45521. Tests 265/265 (the y224 byte bar holds). Sources:
  entry (123), C102.
- **UPDATE (dig #121, 2026-10-10): the caves-lane GATE VALUE is the
  direct cell read — I25's index half CLOSED.** The chain's gate
  ("sampler true 0x90d860 → the RAW float field … idx y·[owner+0x9c]+x
  … vs 0.5f", the dig-83 line below) was already cell-law on the READER;
  dig #121 adds the **writer closure** (setter 0x8EE750 @0x8ee776 =
  `W·y + x`, same getter `0x9499f0`, same grid layout — entry (121),
  C100), proves the loop orientation (world-compute @0x90dbed: xmm3 =
  the OUTER counter = y), and reads the kind-1/kind-2 arms (neither
  touches the float field — kind-1 = bitmap_data mod-wrap RGB, kind-2 =
  warp → P → `[P+0x23c]` variant → comiss 0.5). **⇒ the port stops
  routing the caves value through surfaceField's u-law chain:**
  `noise-terrain.mjs` V3 chain `field = gradKind === "caves" ?
  gradAt(wx, wy) : surfaceField(...)` (+ the V2 loop twin; the dig #101
  comment block carries the correction marker; the test mirror `cell()`
  patched in lockstep). C97 A/B: **v3 0.24708 → 0.46464, v2v3 0.25393 →
  0.46557, v2 0.23391 bit-identical** (the V2-only lane never attaches
  the caves field); fG v3 0.162 → 0.840 vs fR 0.480 ⇒ the now-exposed
  over-fill = the uncarved 1.0 base = **I26's predicted signature (the
  dominant remaining blocker for this family)**; dyOpt med −231 =
  registration-heavy residual; bty14 med dyOpt −12 (the C78 anchor ±1,
  observation only). Tests 263/263; **no cache bump** (caves lane
  opt-in). Residuals → I27 (fnB-buffer ↔ sampler-slot wiring inferential
  + the multi-tile window/mod-wrap mapping unread). §8 row 41.
- **UPDATE (dig #120, 2026-10-10): the port RUNS the byte laws —
  `caves-field.mjs` v5 (entry (120), C99, §8 row 40).** Loop B = the
  top-band runs with the 6-draw stamp law + the row loop (R += 0.5(1+u)
  unconditional, the 50% decay coin v *= 0.97+0.03u); loop C = the
  y-FIRST stamps with **strength = [+0x6c]/[+0x70] / radius =
  [+0x74]/[+0x78] (C50 OVERTURNED**, §8 row 40; the min(20) cap
  retracted, the strengthA/B knobs gone); L2 = 2 passes / L3 = the
  do_beginning_down-gated C-rand chains run as snaking **lower-only
  `setterStamp` chains** (value ≤ 1 → single-cell min-guard; value > 1 →
  circle, target = 1 + t·(scale−1) with t = (value²−d²)/value² — the
  0x8EE750 flag=0 arm; the flag gates ONLY the y<25 eave ⇒ **both flags
  lower-only — the "max-bleed raise-only" label above is OVERTURNED**);
  the blend = **t = (R²−d²)/R², w = t²** with the R ≤ 1 min-guard arm.
  The walk/record lanes KEEP `carveCircle` (dir="max" + the (43)(a) t)
  pending the walk call-site read — new **I26**. C97 shape A/B: v3
  0.24644 → 0.24708, v2v3 0.25183 → 0.25393, v2 unchanged (the lane
  doesn't consume the caves field), fR 0.48029 unchanged; **no cache
  bump** (caves lane opt-in). Tests 263/263; the y224 byte bar HOLDS
  (the new loop C could reach x0..11 at y224 — this seed's stamps miss,
  deterministic).
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
- **UPDATE — dig #86 (2026-09-22): ③ instance identity byte-linked
  (SPLIT verdict)** — `kind2-esi == P` **PROVEN** (Serialize kind2
  arm `call 0x8ee440` @0x8f36fe → fn2 = 0x8ee440..0x8ee741 → its
  `new(0xb8)` gen → `mov %eax,0x1d4(%ecx)` @0x8f3708); `P ==
  sampler-owner+0x9c` **REFUTED as instances** (owner+0x9c =
  in-place embed — own ctor 0x90ce66 / Load 0x90d1ab / dtor
  0x910a6f, ends owner+0x154; P ← five standalone/static-gen stores,
  incl. the newly found fifth @0x908583 in fn 0x905fb0). Sampler
  decoded: vtable 0x118f9e4 → slot+8 thunk 0xa9a120 → 0x90d860;
  owner = fn0x90cfb0's this (functor ctor 0x90d507, sole edi writer
  0x90d4f5); **gate reads the embed, wrap reads [config+0x1d4] ⇒
  TWO gens, one class.** C34 +0x1e0 = owner-own decor u16 grid
  (0x90d2c1/0x90d2e9) — the "+0xf4" premise dissolved. Phantom
  carry-overs corrected (`call 0x8ed180` 0 hits; `movl $0x132b518,
  0x38(%esi)` nonexistent; "wang-fill @0x8ee5bd" wrong).
  (ABOUT_MATH (86); CONSTANTS C65 + C62 RESOLVED; §8 row 25; ISSUES
  I19.) Phase 1 **byte-CLOSED by user decision (2026-09-22)** —
  residuals recorded as known-open (ramp-slot READS + driver
  extent), picked up with the next ordered items, not blockers for
  Phase 2. No code changes; tests 177/177; y224 0/12 rms 0.0000.
- **UPDATE — dig #87 (2026-09-22): Phase-2 step 1 — the A-resolver
  body `0x8EE1B0` (C49) is read: a lazy-singleton DELEGATE, not the
  color→ID logic** (ABOUT_MATH (87), CONSTANTS C66). Body
  0x8EE1B0..0x8EE221 (ret; int3 pad to 0x8EE22F; fn1 @0x8EE230 ✓
  C63); guard = bss ptr **0x134632c** → miss: `new(0x1a0)` (IAT
  0x114a34c) → ctor **0x65F480** → store; resolve = arg `[ebp+8]`,
  this = **`[0x134632c + 0x18]`** (loaded pointer ⇒ delegate object,
  not embed) → `call **0x741A50**` @0x8ee20e, eax passthrough ⇒ the
  material-ID semantics move to 0x741A50 (+ ctor's +0x18 store +
  LoadFromImageData's `*0xb0` call-site arg) = dig #88, then the
  132-B record walk. No code changes; tests 177/177; y224 0/12 rms
  0.0000.
- **UPDATE — dig #88 (2026-09-22): Phase-2 color→grid lane
  byte-decoded — pixel → gates/memo → [gen+0xb0] `0x8EE1B0` →
  delegate `0x741A50` (24-bit color→table index, −1 miss) → **u16 =
  index+1 + f32 ±1.0f**; miss → [gen+0xb4] script map → a SEPARATE
  u8 lane + {x,y,id−1} change-vector; double-miss → f32 =
  (ch[15:8]+2·ch[23:16])/765, u16 stays 0** (ABOUT_MATH (88);
  CONSTANTS C67 + C66 OPEN corrected). Delegate: fast path +0x2c →
  0, else 0x290-stride scan from base+0x2d0 (color @+0x40), record 0
  only via the fast path; ctor `0x65F480` **zero-inits +0x18**
  @0x65f4d7 ⇒ the delegate-writer `[0x134632c+0x18]` is still OPEN.
  Call site = `push %ecx` (raw pixel) `call *%eax` @0x8f9dc2; asserts
  0x224 bounds / 0x263 script ≥0xFF / 0x264 index ≥0xFFFF. id==1 ↔
  f32 −1.0f = exactly the cells entry (86)'s sampler 0.5f gate SKIPS
  ⇒ record-0 = air-candidate rung (confirm in the record-table walk).
  LoadFromImageData's esi cross-linked to **the C27 gen** (C56
  layout ✓: containers +0x00/+0x20/+0x40, vector +0x80, +0xb0,
  +0xb4). Next: delegate-writer + 0x290-record content (fn 0x741AC0
  family) → then the 132-B walk. No code changes; tests 177/177;
  y224 0/12 rms 0.0000.
- **The 0x290 record class = CellFactory/CellData = the
  `data/materials.xml` rows (dig #89):** record stride 0x290, color
  @+0x40, `material_type` @+0x30; factory layout = names {+0x8,
  +0xc} 24-B wstrings + name→type std::map {head +0x14, size +0x18,
  node second @node+0x28} + records {begin +0x1c, end +0x20, cap
  +0x24} + **mCellDataSize +0x28** + fast-color +0x2c (OPEN) +
  one-shot +0xb8. **mCellDataSize's writer = the high-water store
  `max(size, resolved+1)` @0x742d1f..0x742d25 (fn 0x742b30)** —
  NOT `mov %edi,0x28(%esi)` @0x745051, which fills the name→type
  **map node's pair.second := index** (fn 0x7449e0 counter loop;
  draft reading corrected in (89)). Accessors: GetType **0x741770**
  (0-based type, −1 miss), name→record **0x741890** (pointer, 0
  miss), linear resolver **0x7415e0** (stdcall, returns the index),
  GetCellData **0x4b80e0** (asserts type ≥ 0 / signed type <
  [this+0x28]; **type 0 → NULL @0x4b827c** ⇒ type 0 unreachable via
  GetCellData(0)=0x4b82a0 wrapper — the record-0 = air-candidate
  rung now has a second byte anchor beside the sampler skip), else
  base+type·0x290. Record assign **0x741d20** = the field map (+
  0x40 wang_color @0x741d68; +0x88 omitted/rebuilt, +0x28c
  raw-copied). Link pass **0x7455b0** resolves wstring fields →
  type dwords with defaults `fire` (→+0xe0) / `smoke`; the
  smoke-default store @0x74588a targets **+0xe0, not +0xfc** —
  byte-verified asymmetry, semantics OPEN (reported as fact, not a
  defect); grey-color check @0x74597a. Literal materials.xml still
  unread (packed in `data/data.wak` — Phase-2 step 2: unpack →
  record order = type order, wang_color = +0x40, spot-verify vs
  exe). Traps: orphan literals **0x11a0008/0x11a0030 = 0 refs
  file-wide (never cite)**; `push $0x290` = assert line 656.
  OPEN → dig #90+: wang_color parse store → +0x40 (color origin),
  [factory+0x2c], delegate writer `[0x134632c+0x18]`, record
  allocation, LoadFromImageData pre/post-loop counters + 0xFE
  semantics (ABOUT_MATH (89); CONSTANTS C68). No code changes;
  tests 177/177; y224 0/12 rms 0.0000.
- **UPDATE — dig #90 (2026-09-22): the wang_color color origin is
  byte-CLOSED** (ABOUT_MATH (90); CONSTANTS C69). The parse store =
  **`mov %eax,0x40(%esi)` @0x736d37** in record-parser fn
  **0x7364f0** (esi = this = the record, offset profile = C68's
  field map; arg1 = the node): the `wang_color` attr (both node-
  type arms, accumulator [ebp−0xa4]) is converted by **0x454d90 =
  string→u32 with an R↔B byte swap (bytes 0↔2, an involution)** —
  the exe's shared color codec (12 call sites), inverse **0x454e80**
  = u32→string (10 sites) — then stored **before** the sentinel
  check (`cmp $0xffeeffc0` = swap⁻¹(0xFFC0FFEE), C0FFEE-family;
  error arm 0x9ea780/0x65cfe0/0x4429a0 + `"vector<T> too long"`
  @0x114b900; store never undone — arm semantics OPEN). Absent
  attr ⇒ default arm @0x736c17..0x736c2c round-trips the record's
  current +0x40 through the inverse pair (top-byte format fidelity
  UNVERIFIED). Sibling: `gfx_glow_color` (0x119f068) → **+0x48**
  @0x736c1d. Parse-fn callers: 0x9eb1aa (fn **0x9eb140**, corrected
  dig #91 — fn 0x9eb020 = (89)'s grey-error logger only, see §8
  row 26) + 0xa70d74. Remaining Phase-2 opens (dig #91+): [factory+0x2c],
  `[0x134632c+0x18]` delegate writer, record allocation (imul
  census + esi provenance), LoadFromImageData pre/post-loop + 0xFE
  semantics, +0xe0/+0xfc consumer, then step 2b (unpack
  `data/materials.xml` — now with the byte-swap rule to spot-check)
  → 132-B walk → ladder table. No code changes; tests 177/177;
  y224 0/12 rms 0.0000.
- **Dig #91 (leftovers ②–⑥ + step 2b)** closed all six gaps, sealed
  (90)'s ①f boundary error, and **jacked the dig's first cross-artifact
  constant match — `0xff420000`**: materials.xml line 80 `air` /
  line 83 `wang_color="ff000042"` → C69 R↔B swap (b0↔b2) → the ctor
  `0x740b70` immediate; the same u32 is also C1's hasPath start-mark
  (`cmp eax,0xFF420000` @0x901a4d, relationship = new OPEN).
  **①f CORRECTION (§8 row 26):** fn 0x9eb020 ends `ret $0x4` @0x9eb131
  + int3 pad ⇒ the builder is fn **0x9eb140** (guard @0x9eb168,
  `call 0x7364f0` @0x9eb1aa ∈ 0x9eb140; `call 0x9eb140` = 3 e8 sites
  0x745b3f/0x746263/0x746530, all in fn 0x7459d0); 0x9eb020 = the
  grey-error logger only (this = global 0x132b624, pushed arg
  0x11a0738, site 0x745999) ⇒ the role-reconciliation OPEN dissolves.
  **②:** ctor `movl $0xff420000,0x2c(%ebx)` @0x740bfd; imm-0x2c census
  0x740000..0x746fff = 0x740bfd + 0x7450de only, and 0x7450de = the
  second SSO string's size zero-init in frameless fn **0x7450c0**
  (fn 0x7449e0 ends @0x7450af), NOT a factory store; reg-source =
  0x7401b3 (ebp local) ⇒ Load never writes +0x2c in-region (file-wide
  380 hits unexamined = REGION-scoped). **③:** the only two
  `[0x134632c+0x18]` writers (0x729753, 0x79de90) both do `new(0xd8)`
  → ctor 0x740b70 → `call 0x43ac50` → store → `call 0x7449e0(this=obj)`
  (site 2: bss install @0x79de46, guard `cmpl $0,0x18(%eax)` @0x79de4b,
  `push $0xd8` @0x79de55, ctor @0x79de6f, store @0x79de90; fn 0x7449e0
  prologue `mov %ecx,%ebx` @0x744a0b) ⇒ **the delegate = a 0xd8 factory
  instance** (C66's writer-OPEN CLOSED). **④:** record origin =
  in-place `[factory+0x1c]+[ebp−0x3cc]` in fn **0x7459d0** (type gate
  `[esi+0x20]==1` @0x745a0c else 0x7461df; `cmpl $1,0x28(%eax); jle
  0x745b92` @0x745a26; index ←1 @0x745a1e, offset ←0x290 @0x745a30..37;
  step `add $0x290`/`inc`/`jl` @0x745b71..86 ⇒ **records i = 1..size−1**,
  record 0 skipped = C67 ✓); parse sites = in-place 0x745b3f +
  0x745e96 (wrappers 0x9eb140/0xa70cd0) and staging 0x746263/0x746530
  (local `[ebp−0x364]`, ctor 0x747160 @0x7464f0..f6,
  `movb $0x13,-0x4(%ebp)`) ⇒ both patterns live, staging→table copy
  OPEN; growth 0x92fc90 ← 0x740db7/0x73624d (latter after dtor loop
  0x736050 with size zeroed before+after ⇒ mCellData ✓); full-realloc
  0x978aa0 = 0 call/jmp sites file-wide. **⑤:** pass-1 inits/counters
  ([ebp−0x34]←this @0x8f9ae0, −0x18←arg1, −0x5c←gen+0x20, −0x80←arg6;
  −0x6c bumped @0x8f9f19 after u16==1 record-0 writes, −0x68 bumped
  @0x8fa0d4 after `call 0x92eb70`, identity OPEN), both
  `jle 0x8fa489` gates, phase-2 flag `cmpb $0,0x10(%ebp)` @0x8fa194,
  assert lines **0x2a7/0x2a8** (locals 0x1173830/0x11738dc, crash
  `movl $0x1ca9`), fill pass 0x8fa361..47d (u8≠0 ∧ self u16==0 ∧
  4 neighbors==1 → u16=1 + f32=−1.0f ⇒ lanes gen+0x00/+0x20/+0x40 =
  C67 ✓), phase-2 @0x8fa6e9 = ctor + header copy + u16 ×2 resize +
  walk u16==0 (tail ~0x8fa7e0 OPEN); **dilation body 0x8fa4ff..0x8fa6b9
  OPEN**; callers 0x8fa99b/0x905dd7/0x905f1e with @0x905dd7 arg1 = the
  C67 pixel container (`push (%edi)/0x4(%edi)` = w/h) ✓, full signature
  OPEN. **⑥:** whole sequence ∈ link-pass fn **0x7455b0**; +0xe0 ←
  GetType("fire" 0x1171bc0) @0x74581d or name-absent default
  GetType("smoke" 0x117cbdc) @0x74588a, +0xfc ← GetType(+0xe4) only
  when named (`[ebx+0xf4]` guard) @0x745844 ⇒ **+0xe0 = fire/smoke
  DEFAULT type, +0xfc = NAMED type** (C68 asymmetry resolved); guarded
  stores +0x1e8/+0x204/+0x148/+0x144 (2 writers @0x74593c/@0x745968);
  grey check @0x74597a = b0==b1==b2, **alpha ignored** → logger
  0x9eb020 @0x745999 → ret @0x7459cf → prologue 0x7459d0 (abut); the
  paired reads 0x741e4c/0x741e72 = record-assign **0x741d20** field
  copies (+ twin 0x7472f1..37) ⇒ COPYING, **consumer still OPEN**.
  **step 2b:** materials.xml 418,728 B md5 `d782fb8c…`; `<CellData` 224 +
  `<CellDataChild` 245 = **469** = wang_color count exactly (8 hex
  digits, no 0x; record order = type order ✓). New opens for dig #92:
  staging→table copy, 0x978aa0 zero callers, phase-2 walk tail,
  dilation body, the C1-vs-ctor 0xff420000 relationship, +0xe0/+0xfc
  consumer. Row **C70**, entry **(91)**. No code changes; tests
  177/177; y224 0/12 rms 0.0000.
- **Dig #92 ((91)'s residue ①–⑤)** closed the Phase-2 material-ID-ladder
  questions. **①** The +0xe0/+0xfc consumers = fns **0x7495b0** (gate
  `cmpl $4,0x38(%eax)` → `call *0x98(%edx)`), **0x74bf70** (LCG rand →
  `call *0x98` @0x74c2bb), **0x751be0** (`call *0x20` @0x751d65; packed
  idx `((y&0x1ff)<<9)|(x&0x1ff)`), chained 0x74bf70→0x7521f0→0x751be0;
  0x7495b0/0x74bf70 = 0 direct code refs (vtable/fn-ptr — which OPEN);
  C70's DEFAULT/NAMED semantics stand. **②** The staging selector =
  `[arg1+0x20]` (1 → in-place dead-looking; 0 → staging, tag literals
  0x11a07a8/b4/c0/cc); the staging→table copy = fn **0x742b30**'s tail
  (record-assign 0x741d20; only callers 0x746275/0x74656d); load chain
  0x7449e0→0x9eaf80→0x100c360→0xa48f20(mode=0)→0x7459d0 ⇒ **staging is
  the live path**; 0x746e20 = record dtor. **③** fn **0x741a50** =
  color→index matcher with the **top byte EXCLUDED** (`arg&0xFFFFFF` vs
  `[this+0x2c]&0xFFFFFF` → 0; loop i=1..count−1 over record +0x40,
  base+0x2d0, stride 0x290 → i; miss −1); sentinel prefix literal
  **0x119f098** = "please don't use the color 0xFFC0FFEE … special
  meaning in the wang map" ⇒ reserved wang color **`ffc0ffee`**
  (S=0xFFC0FFEE → T=0xFFEEFFC0, byte1 C0 survives = swap byte0↔2 with
  byte1 unchanged), arm = **log-and-continue**; 0xFE = 254 =
  JOINT_SCRIPT_ID stands, pixel-top-byte 0xFE ↔ JOINT relationship
  **OPEN**. **④** fn **0x8f9ab0 = `BitmapNoise::LoadFromImageData`**,
  `ret $0x24` = 9 dword args ([3] = the phase flag @0x8fa194, [6]/[7] =
  w/h clamped to this[0]/this[4], [4-5]/[8-9] 8-B slots content OPEN);
  asserts = **0x2a7** `mMaterialData.Empty()==false` (this+0x3c) /
  **0x2a8** `mScriptData.Empty()==false` (this+0x5c); part 2 =
  0x8fa361..47d fill, part 3 = **majority-fill** of the u16 lane
  (u16==0 ∧ f32≤0 → nonzero 4-nbr mode **0x9fe570**), **dilation
  0x8fa49c..0x8fa6b9 = von-Neumann r1** on the bool lane (gated
  this+0x7c); counters: **−0x68 = appended script events** (bump
  @0x8fa0d4 ⇒ **0x92eb70 = the script-event appender** ✓), **−0x6c =
  resolved id==1 cells** (bump @0x8f9f19); wrapper 0x8fa930 passes its
  arg3 as the flag. **⑤** **0x978aa0 = vector::reserve reached by 2
  tail-jmps 0x94b373/0x94b386** ⇒ **§8 row 27** (the zero-call mystery
  overturns); 0x7450c0's helper-this = stack local [ebp−0x3a0]
  (call @0x74635a; fed to 0x9eb280/0x93ce20 — semantics OPEN);
  0x729753's guard = lazy O-create @0x7296b4 + slot guard @0x7296f3 →
  **0x43ac50 accessor → [O+0x18] = factory** → assert
  `world_state == NULL` line 0x124 (game_world.cpp 0x119e1d0) vs
  [0x1328004]; wrappers **0x42bc50** (seed/assign, registry 0x1344c78) /
  **0x42c070** (attr-by-key `[this+0x28]+0x44`) / **0x42c0d0**
  (find-child-by-tag, exhaustion → logger 0x12ee538, miss tail
  0x42c415 unread); **0x7415e0 = name→index with insert-on-miss**
  (hit → index; miss → 0x43aa90 + one-shot log 0x11a0088/0x11a009c,
  once-flag 0x13276b9 → count); **0x741770 = CellFactory::GetType**
  (miss → 0x11a00a0, −1); **C1-vs-ctor CLOSED @0x901a4d**: hasPath
  compares the cell u32 (getter 0x949f60) to 0xff420000 → writes
  0xff000000 (getter 0x949e80), top-byte 0 or 0xff000000 → skip, else
  copy ⇒ **the ctor's +0x2c = air's swapped color is exactly what
  hasPath stamps**. Row **C71**, entry **(92)**. No code changes; tests
  177/177; y224 0/12 rms 0.0000.
- **Dig #93 (Phase 2 step 3) — the material-ID LADDER closed, Phase 2 byte-CLOSED.** classifier **0x8f5030..0x8f5749** (biome_materials.cpp, file 0x1173240) fully decoded: ecx = `[config+0x2a4]`, v in **xmm3**, returns the record POINTER or 0 (accept `mov 0x4(%ebx),%eax` @0x8f5740 → `ret $8` @0x8f5749 / miss `xor %eax,%eax` @0x8f574e); gate order = assert **0xfe** → range `[this+0]≤v≤[this+4]` → assert **0x108** → per component: assert **0x107** → `[+0x04]` record / `0x442610` → assert **0x10f** → int-range `[+0x39]` → polygon `[+0x74]` (mod-512 query → callee **0x10096a0**) → null-check @0x8f5572 → v′ via `[+0x2c]` → **main gate `[[+0x24],[+0x28))`** @0x8f55b6 → `[+0x38]` (0 → ACCEPT `je 0x8f5740`) → transform → jitter `[+0x50]` (rng **0x9119d0**, scales 0x11dfa70/0x11dfa88) → noise `[+0x44]`/selector `[+0x45]` (**0x9fad90** | **0x8fc020**) → ramp `[+0x46]` (**0x8fbe60**), out-gate **((+0x6c),(+0x70]]**; stride `add $0x84` = **132-B component**. 3 callers: **0x908fb0** + **0x90935b** (fn **0x908f40** procedural_terrain.cpp — zone kind 0 = path A, kind 1 = path B via evaluator2 **0x908e70** + floor IAT 0x114a434/0x1033970, kind other = **0x9091c6** unread) + **0x90dd7e** = the sampler tail (u16 wrap(this=P+0x20) `movzwl;dec` @0x90dcd3 → id1 ≥ 1 → **0x4b80e0** lookup | id1 ≤ 0 ∧ `[owner+0x2a4]==0` → **AIR skip @0x90ddb0** | else evaluator2 → floor → classifier). **MERGE @0x90dd89** → kind dispatch `[record+0x38]`: **3** → writer **0xa047d0** (C54 slab 0x603fd0 ✓, no grid write) | **1** → intern (lock xadd, cap 0x2000) | **other** → value 0; kind 1/other → planter **0x7644d0** → accessor 0x95a5e0(owner+0x1e0, idx = y·[owner+0x1c8]+x) → **dword store** @0x90de9c → bounds → alpha 0x949e80 `testl $0xff000000` → `call *0x1c(%edx)` on-place callback. `<RandomColor>` parser = fn **0x8eb300** (biome.cpp 0x1172ea8: factory 0xa75470 → `[[x+0x28]+0x38]` via 0x10149a0, keys `input_color`/`output_colors` = 0x1172f10/0x1172f1c, parse 0x92edd0→0x92a910; **runtime consumer OPEN**). **C65's "+0x1e0 u16 grid" REFUTED → §8 row 28** (accessor 0x95a5e0 = slab 0x559de0 returns `base+idx·4`, store dword @0x90de9c) — C65 amended in-row; C54 byte-exact; C33 refined (via C72). Row **C72**, entry **(93)**, fixture `mapgen/fixtures/ladder/solid-air.json`. No code changes; tests 177/177; y224 0/12 rms 0.0000.
- **Dig #94 (Phase 3) — fnA's y-drift SPAN + the cross-lane
  composition-order diagram, byte-cited per arrow; Phase 3
  byte-CLOSED.** (a) fnA `8eec70..8ef86c`: all 10 arg slots pinned
  (C73); start pair = X clamp(…,5,W−5) @8f0265..8f0298, **Y =
  trunc(rand·0.0) = 0 @8f02b3..8f02b9 ⇒ top row** [**REFUTED dig #102
  → §8 row 32**: [0x11dfef0] = f64 6.0 consumed by `mulsd` ⇒ Y₀ =
  trunc(6u) ∈ {0..5}, start row random]; y = −0x44 += Δy
  `[ebp+0x20]` per iteration @8ef37c..8ef393; **Δy = 0.4u+0.1
  ∈[0.1,0.5) @8f046a..8f0485 (+0.5 if trunc(101u)<33 @8f049e..8f04b3 ⇒
  [0.6,1.0))**; budget −0x110 = **LERP(0.45H,0.96H,u)** @8f056b..8f058d
  ÷ Δy @8f0626..8f063f [**flag=1 arm — dig #102 / C81**: the flag=0
  walk first takes LERP(0.15·S,0.96·S,u) @8f03f2..8f043f and is
  overwritten to 0.45·S only when flag=1; S = h − Y₀]; terminations = back-edge ≤⌊budget⌋
  @8ef836..8ef857 · box @8ef0d0..8ef0ff · y-cursor @8ef104..8ef10c ·
  budget<0 @8ef0b1 (xmm3=0 census) ⇒ **span y ∈ [0,
  LERP(0.45H,0.96H,u))**, box-limited; child P = 2% @8ef774..8ef783,
  child budget (u2·50−50)+(parent−steps) @8ef7e2..8ef800, u sign-flip
  @8ef7c2; **xmm4 provenance CLOSED** = u1·(−0x10c) @8f07b5..8f083c →
  cvttss2si @8f08e5 → −0x118 @8f08f3 (−0x10c = 0.25u+0.75 @8f05c0;
  value semantics OPEN); L2/L3 = 120+⌊81u⌋ × 2 passes re-confirmed
  (C53 blocker lifted). (b) **Order:** Init = wang 0x904c20 →
  LoadFromImageData 0x8f9ab0 (callers 0x905dd7/0x905f1e, flag=1) +
  SetSize @0x90738f/0x907852 = the base [§11 rows 3/5/6, F-anchor];
  CAVES = built in the config-P fill, **outside Update**: Serialize fn
  `0x8f3260` → **fn C1 `0x8f2ff0` @0x8f37a4** (gate ecx==0 ∧
  `[this+0x1d4]==0` ∧ `[this+0xc0]≠0`; result → `[this+0x1d4]`
  @0x8f37ae) → fnB @8f323c, plus Serialize→fnB direct @8f3770 (arm
  pre-gate OPEN; **caller a4e67a unread ⇒ timing OPEN**); chunk
  materialization = state machine `0x8e4ec0` = caches/DistanceField
  only (**no terrain writes — F1 ✓**); per-frame Update `0x90b8a0` =
  **(1) pixel scenes `0x910c20` FIRST @90b8f0 → (2) gate @90b8f5 →
  view loop @90b930 → `0x909810` @90b9d9 (role OPEN) → config
  `0x909da0` @90ba28 → `[config+0x2a4]≠0` → `0x8f75c0` @90ba48 (5
  args, role OPEN) → erase @90ba4d**; the noise lane reaches sampler
  `0x90d860` only indirectly (zero `call 0x90d860` sites re-greped this
  session; C54's driver 0x908f40 = zero callers) ⇒ 8f75c0 → 0x908f40
  linkage OPEN. ⇒ **cell write order: wang/u16 base (Init) → [caves P
  fill, timing OPEN] → per frame: pixel scenes → chunk material/noise
  paint.** (73) compose corrections — fixed k=3 (both scale consts
  0.0 ⇒ ja never taken), multiplicative **−0x104 ← −0x104×(u·w₃+c₃)**
  (effective 0.4u+0.1), lane-4 ×0.25+0.75, lane-5 ×0.13+1.07, jump
  table `jmp *0x8f2fd0(,%ecx,4)` @8f02e0 — no §8 row ((73) retracted
  by (74)); (75)'s scroll-queue item **DISSOLVED** (entry (75) = the
  fnC1↔fnB hand-off only; [0x1345364]/[0x1345368] = GL-proc pointers,
  sole writers @ff2d4c/@feccbf). Row **C73** (+ C53 in-row amended),
  entry **(94)**. No code changes; tests 177/177; y224 0/12 rms
  0.0000.
- **Dig #95 (Phase 4 step 1) — component-BUILD read: MaterialComponent
  ctor + the full XML-attr → 132-B slot map; `[config+0x2a4]` =
  `mBiomeMaterials`; P1 source = inline `<Materials>`.** ctor fn
  **0x7daeb0** (vtable **0x1191fc0** = [0x7e22a0, 0x7dc850, 0x7de160,
  0x7dc670]) = default-fill @7daf2a..7dafc6 (C74 table: +0x04=0
  celldata, name SSO +0x08 with size +0x18=0 / cap +0x1c=0xf,
  material_index +0x20=10, material_min/max +0x24/+0x28=0.1f,
  limit_min/max_y +0x3c/+0x40=100f/2048f, rare_use_polka +0x46=1,
  rare_polka_is_boxed +0x64=1, rare_required +0x6c/+0x70=0.2f/1.0f,
  is_polygon +0x74=0, polygon vector +0x78 zeroed) + schema
  registration in the same frame (`"MaterialComponent"` 0x1153bd4 →
  registry 0x92a5c0, find 0x43e0f0, insert 0x4498f0/0x4499a0, payload
  node+0x28, once-guard `jne 0x7db6c8` @7db0b2 → push-loop 0x444250:
  celldata@7db0bd, material_name@7db100 … rare_use_polka@7db44d).
  Attr→slot map byte-closed by **three agreeing passes** (vtable+4 fn
  **0x7dc850** name-push+`lea slot(%ebx)` @7dc897..7dd465, vtable+8 fn
  **0x7de160** push-form @7de26a.. + mov-form @7deda0..):
  celldata→+0x04 · material_name→+0x08 (size +0x18 = (93)'s
  empty-name check) · material_index→+0x20 ·
  **material_min→+0x24 / material_max→+0x28 = the main gate** ·
  add_perlin→+0x2c · add_perlin_scale_x/y→+0x30/34 · is_rare→+0x38 ·
  limit_y→+0x39 · limit_min/max_y→+0x3c/40 · rare_use_perlin→+0x44 ·
  rare_use_fbm_perlin→+0x45 · rare_use_polka→+0x46 ·
  rare_scale_x/y→+0x48/4c · rare_offset_by_seed→+0x50 ·
  rare_offset_x/y→+0x54/58 · rare_polka_radius_low/high→+0x5c/60 ·
  rare_polka_is_boxed→+0x64 · rare_polka_probability→+0x68 ·
  **rare_required_min/max→+0x6c/+0x70 = the out-gate** ·
  is_polygon→+0x74 · polygon→+0x78 — i.e. **every C72/C93 gate slot
  now carries its XML name** (C93/C72 refined in place, not
  overturned — no §8 row). `[config+0x2a4] = mBiomeMaterials`:
  guard **0x117a338** → eq 0x4447f0 → getter **0x9c8660** → store
  @**49de93**, ordinal case same getter @**49e83c**; siblings
  `coarse_map_cell_count_always_zero`→+0x2a2 @49de31,
  `coarse_map_inject_light`→+0x2a3 @49de62 (zero-init @496195/4e8a6d).
  `<Materials>` tag **0x11a06a8** (xrefs 744c4e, 8f38f6/8f393e/8f39d6;
  tag-eq **0x42c440** @8f3910, biome.cpp 0x1172ea8 line 0x4b8); P1 =
  **inline** `<Materials>` (hills.xml:184, components from :187) — no
  `mBiomeMaterials=`/`mBiomeMaterialsFile` in the surface files (File
  attr only in friend_*/roadblock/secret_entrance/snowcastle_cavern/
  solid_wall → `data/materials/biome_forest.xml`). Fixture: hills coal
  **[0.51,0.55)** / soil **[0.45,0.53)**; coal limits 100/2048 +
  material_index 10 **= ctor defaults** (hills.xml:187/:209). P1 leg
  activity (greps this session): `rare_use_fbm_perlin` in **0**
  `data/biome/*.xml` files and `is_polygon=` only in boss_arena/
  end_wall/lava_90percent/temple_wall ⇒ **fbm-selector + polygon legs
  never fire from biome XML**; `add_perlin=` = 38 files — among the
  surface set only **desert (0)** + **mountain_center (1**, scales
  0.01/0.02 ⇒ v′ transform live there) (hills absent). **`push $0x84`
  ×4 = assert-log line 132, NOT sizes** (732002/732073 box2d `celldata`,
  748c9d/748d14 cfirecell `this != temp`; fmt 0x1150f60) ⇒ no literal
  `new(0x84)` in the exe — component stride = the classifier's
  `add $0x84` (C72) + `imul $0x84` @5d0eb8/5d0ff5. OPEN: `<Materials>`
  child→wrapper flow, record RESOLVE (material_name → the +0x04
  celldata pointer), `_enabled` (XML attr in every P1 component but
  absent from all three passes ⇒ framework-level), allocation site,
  virtual read-vs-write. Row **C74**, entry **(95)**. No code changes;
  tests 177/177; y224 0/12 rms 0.0000.
- **Dig #96 (Phase 4 step 2) — surface-level CLASSIFIER port:
  `mapgen/lib/surface-level.mjs` (module-as-library; default render
  untouched) = `componentFromXml` / `buildMaterialsTable` / `classify`
  / `rarePolka` (arities 1/3/4/6), byte-cited gate by gate.** Flow:
  band CLOSED → miss epilogue **0x8f574c** (`xor eax` @0x8f574e,
  `ret $8` @0x8f5754) → loop head **0x8f5160** runs null-comp **0x107**
  (push @0x8f516b) then cellFactory **0x108** (`cmpl $0,0x30(%eax)`
  @0x8f5224 → push @0x8f522e) **per iteration** (**§8 row 29** —
  dig-93's "0x108 before the loop" refuted) → diag 0x10f line 271
  @0x8f52e9 (log 0x11732d0; membership **0x442610** predicate UNREAD ⇒
  non-null = found) → limit_y +0x39 @0x8f53f0, slots **+0x3c/+0x40**
  closed on f32(y) → polygon +0x74 @0x8f5418 (vector +0x78/+0x7c,
  count<3 → 0x118 line 280; query 0x10096a0 ⇒ throw) → second-null
  @0x8f5572 → v′ @0x8f557c = f32(simplex(f32(x)·[+0x30], f32(y)·
  [+0x34]) + v) → main gate **[[+0x24],[+0x28))** half-open →
  is_rare +0x38 → accept @0x8f5740 = `[comp+0x04]` → transform
  px/py = fround(fround(f32(x)·[+0x48]) + [+0x54]) → jitter
  (0x9119d0), fbm (0x9fad90), polygon → honest throws (P1-dead:
  0 trigger files) → noise **(min,max]** @0x8f56a6 → polka
  **(min,max]** @0x8f56f4 — **SEQUENTIAL, both gates must pass**
  (asymmetric-bounds test refutes an either-leg port). rarePolka
  **0x8fbe60..0x8fbfc3**: r1 ≥ prob → 0 (jae; equality pinned) →
  R = low+(high−low)·r2, R ≤ 0 → 0 (`jae 0x8fbfbd`) → k = 2/R
  (`divss` @0x8fbf38) → p = (k−2)·w1 + (fracY·k − (k−1)), q likewise
  → boxed p⁴+q⁴ ≤ 1 / unboxed d = min(p²+q², 1) → (1−d)³ f32.
  hash9200 **0x8f9200** / hash92f0 **0x8f92f0** = frac(K·P), P = **squared
  product** fround(fy²·fx²), x→base 26 / y→base 161; fold = t − 71·⌊FOLD_Q·t⌋
  + base; PE constants: FOLD_Q 0x11df8f4 = 0.014084506779909134, K9200
  0x11df8ac = 0.00101319863460958, K92F0 → 0x13476e4 = 0.0010513747110962868,
  **K1 imm 0x3acbdc41 = 0.0015553311677649617, K2 imm 0x3aa32fcf =
  0.0012450161157175899**, bases 26/161/71 = 0x11e01f8/0x11e031c/0x11e02b8.
  Band = seed∪comps replace-if-narrower (0x8f8fe4..0x8f8fff; seed init
  unread ⇒ band-as-param); builder min>max → `jbe 0x8f8fde` else unread
  log (0x11735f0..) ⇒ throw. Tests: `tests/mapgen/surface-level.test.mjs`
  **37** (incl. data-gated hills walk: 6 comps, band [0, 3.5],
  v=0.45 → soil closed-lower, v=0.95 → rock (sand upper open),
  y-window edges on f32(424.229), comp-1 ramp walk) + api-surface pin;
  **npm test 215/215**, caves-field **33/33 no skips** (oracle 2,641 B).
  Env-gated; render-path untouched. Row **C75**, entry **(96)**,
  **§8 row 29**.
- **dig #97 — SURFACE_V3 classify wiring + the x/y FRAME (Phase 4 step 3):**
  noise-terrain's default branch now runs gate (`v > 0.5` = the sampler's own
  `comiss 0x11dfa94` @0x90dbc3) → table (module-private `ensureSurfaceTable`,
  cached per `def.filename`; no components ⇒ null = the mBiomeMaterials==0
  → air arm @0x90dd01) → `classify(table, x, y, v)` (call @0x90dd7e; record
  null ⇒ no window-write ⇒ air @0x90dd8b), byte-cited; a component throw
  propagates to noiseAt's catch (chunk falls through honestly). **Frame
  decided by elimination (C76):** x = canvas px, y = canvas py − 24576
  (SKY_ROWS·512) — three converging lines (hills.xml limit_y=1 on ONLY soil
  `[-1024, 424.229]` + copper `[750, 2048]`, other four `limit_y="0"` — the
  earlier four-band claim **RETRACTED**; mGradient ±1024 shares the frame;
  surface band = canvas ty 48..50) and two eliminations (world px
  @OFFSET_Y=14 → surface −7168 rejects soil; raw canvas → 24576 > 424.229
  rejects soil); no `limit_x` ⇒ x = identity. Loop regs confirmed (outer
  ESI = y, inner EDI = x ⇒ C54 slab labels stand — **no §8 overturn**, row 30
  free); evaluator2 arg order = **(x, y, field)** (port arg3 = 1.0 proxy
  **RESOLVED**); floor-fix push order floor(y) @0x90dd55 / floor(x) @0x90dd72
  ⇒ [ebp+8] = x, [ebp+0xc] = y; planter 0x7644d0 receives the same x/y sums
  (arg parity). Measured: band v ∈ **[0.7191, 1.2809]** (rows 48..56,
  555k+ cells) ⇒ **mask ≡ gate** on current data — reject arms unreachable
  in-band (unit-pinned in surface-level.test); frame probes (constructed
  soil-band v at real lane y 405/505 + both eliminated frames) execute the
  elimination argument. New `tests/mapgen/surface-wiring.test.mjs` **3**;
  **npm test 218/218**, caves-field **33/33 no skips** (oracle 2,641 B).
  Env-gated; default render untouched. Row **C76**, entry **(97)**; §8 row
  **30** free.
- **dig #98 — census fixtures + switch/tail truth-fix (Phase 5 step 1):**
  `tests/mapgen/surface-census.test.mjs` **39** = 30 per-file Topology/
  MC/mx/mn/band census pins + loadBiomeConfig parser-chain + 8 port-only
  frame pins, correcting five (82)-era census cells (**§8 row 30**:
  winter/winter_caves/mountain_center/pyramid `noise_type` ABSENT ⇒
  uid noiseKind −1; mountain_lake StartY −835; hills_flat/mountain_lake
  AddNoise "0" = the live default-arm input; desert MultGrad 0.881426;
  center/pyramid `<Topology>` present without the mGradient block).
  Full switch re-read (**C77**): gate `comiss` @0x90ab48, dec/je
  1→0x90afeb/2→0x90aeba/3→0x90ae03, default arm @0x90ab7d **LIVE via
  the world value 0** → `call 0x8fb570` (UNREAD → **I20** ①) →
  `0x8fca60` → tail; **three port defects fixed** — the blend-tail
  **sign flip** in all three arms (`subss` @0x90b08b = r2−r′; port had
  r′−r2) + unrounded t/add → byte-exact
  `f(f(f(r2−r′)·f((r′−0.85)/0.1))+r′)`, case-2 **bare f32(n)** (`jmp
  0x90b079` skips `mulsd` @0x90b075 — **§8 row 31** refutes
  ABOUT_MATH:3588 for case 2), and case-2's `·(−20)` missing the
  `mulss` f32-round (@0x90af90/afc3); throw message + 4 comments
  truth-fixed (switch header, case-1 xmm0 = x-chain, case-2 tail
  pointer, K2 `0x11dfc68` = f64 0.019999999552965164 not "f32 2.0").
  Frame pins: origin identity, winter two-sided `kind=-1`,
  default-arm message regexes, lanes 1/3 old-sign discriminators,
  lane-2 bare-n sensitivity, cross-lane distinctness, evaluator2 ≡ 0.5
  (frame: (−7.5, 3.5), gradAt ≡ 10 ⇒ rp ≈ 0.9005438 > 0.85 asserted).
  **npm test 257/257**, caves-field **33/33 no skips** (oracle 2,641 B).
  Row **C77**, entry **(98)**, §8 rows **30 + 31**, ISSUES **I20**.
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
