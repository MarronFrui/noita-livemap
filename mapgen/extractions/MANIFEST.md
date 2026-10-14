# Extraction manifest

Dated, digest-pinned record of every byte-extraction `mapgen/extractions/`
holds. Docs cite these rows (file + row id), never ad-hoc `/tmp` paths —
`/tmp` is volatile and has already orphaned historical cites
(`ABOUT_MATH` (102)–(123) era). Manifest rule = AGENTS.md charter
(extraction protocol).

| id | file (in this dir) | VA range | tool | date | md5 | cited by | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| X1 | `fulltext86.asm` | full binary disasm (Ghidra full export) | Ghidra | 2026-10-10 | `29bfa9623eb2257e82e614ea07e3b80c` | C100 | 188 MB; local file survives until manually pruned |
| X2 | `builder-8EE000-8F3700.asm` | 0x8EE000..0x8F3700 | objdump | 2026-10-10 | `5c141eb7c71c7c59ef229c50b411c811` | C101, C102 (as `/tmp/opencode/dig119/…`), row 42/43 | the builder slab — the fnA/fnB/ctor/setter window |
| X3 | `ctor-8F9470.asm` | 0x8F9470..0x8F96B2 | objdump | 2026-10-11 | `89e339c66815c80b80f863d50e28eec8` | C101(d), C102, row 42/43 | template ctor (as `/tmp/opencode/dig123/…`) |
| X4 | `fn668400.asm` | 0x668400..0x668790 | objdump | 2026-10-11 | `ea088a6df47bcfa4fa54441e6fa3cbdf` | C102 (c) | the image resolver (as `/tmp/opencode/dig123/…`) |
| X5 | `fn950-8EF950.asm` | 0x8EF950..0x8EFA40 | objdump | 2026-10-11 | `32828fe1a05bca8a83729bfe058d15e6` | C101, C102 (d) | the gated byte stencil (as `/tmp/opencode/dig123/…`) |
| X6 | `fn870-8EF870.asm` | 0x8EF870..0x8EF93E | objdump | 2026-10-11 | `f2156cf8fcb387266902761fd66b01d4` | C101, C102 (d) | the two-sided lerp engine (as `/tmp/opencode/dig123/…`) |
| X7 | `resolve-wrappers-113.mjs` | (instrument source) | session tooling | 2026-10-12 salvage | `a5bbe015837254a2b6634f3db56bab63` | cited by dig #113 rows | salvaged from the (volatile) temp dir — md5-verified |
| X8 | `sidebyside-112.mjs` | (instrument source) | session tooling | 2026-10-12 salvage | `5d81e39c1d6c2ee1bc82e525c2d941b6` | cited by (112) rows | salvage |
| X9 | `verify-floor-113.mjs` | (instrument source) | session tooling | 2026-10-12 salvage | `9ab54811f8c86b6ded607ce8562fadaf` | cited by dig #113 rows | salvage |
| X10 | `fna-102.asm` | 0x8eec70..0x8ef903 (first/last disasm VA) | objdump | 2026-10-12 salvage | `5d7a2706d6a0e19cfcf64e116c3a9be6` | cited by (102)-era rows | the walk fn window — serves C101(a) |
| X11 | `fnb-102.asm` | 0x8efebb..0x8f0855 | objdump | 2026-10-12 salvage | `9d68286d7bf08c4fe1843405c0b3c2ef` | cited by (102)-era rows | the record head window |
| X12 | `dig116-90a860.asm` | 0x90a860..0x90b13d | objdump | 2026-10-12 salvage | `440e3bbc1fedc8d6be98bb0d16e0f5d1` | cited by dig #116 rows | the kind-0 consumer window (I21 target) |
| X13 | `dig111-setup.asm` | 0x792503..0x792ffa | objdump | 2026-10-12 salvage | `4d93f5ffb5e1ac30da7737dae3645d88` | cited by dig #111 rows | |
| X14 | `dig111-biome.asm` | 0x8f5001..0x8f5ffd | objdump | 2026-10-12 salvage | `7c303fafb94e18df086bf764e9bbaf87` | cited by dig #111 rows | the biome-materials consumer window |
| X15 | `case1core.asm` | 0x4fab50..0x4fad6f (PRE-111 SLAB VA — old mapping) | objdump | 2026-10-12 salvage | `dbd2f0f1fd9a6d5f883cce79d42bf0d1` | cited by early-walk rows | old-convention window; re-read before use |
| X16 | `worm.asm` | 0x4fa7c0..0x4fab4f (SLAB VA) | objdump | 2026-10-12 salvage | `6e252379ffe4e982f7ed3407ef9faef9` | cited by early-walk rows | old convention |
| X17 | `caves-fnA.asm` | 0x4ee470..0x4ef24a (SLAB VA) | objdump | 2026-10-12 salvage | `b4031dd5cb529ebdfec165202a1cb4ca` | cited by early caves-fnA rows | old convention — true = +0x400800 |
| X18 | `cases245.asm` | 0x4fb050..0x4fb556 (SLAB VA) | objdump | 2026-10-12 salvage | `619d0a465d9e6d3cab705e6e20df7baa` | cited by early-walk rows | old convention |
| X19 | `shape-114.log` | (C97 run log) | instrument log | 2026-10-12 salvage | `e8d8c9536d3f89cb98414fe77ac51da5` | cited by (114) rows | |
| X20 | `rtti-names.txt` | (RTTI/symbol census) | raw dump | 2026-10-12 salvage | `119955a380468141d471e895aef2ef11` | cited by the demo scanner rows | |
| X21 | `rc-blocks.txt` | (RandomColor block notes) | raw dump | 2026-10-12 salvage | `1ba129ce1e155d07c457454a447b5b72` | cited by C94-family rows | |
| X22 | `probe-v2window-114.mjs` | (instrument source) | session tooling | 2026-10-12 salvage | `594a959aa31dc31bda7000841d642ab7` | cited by (114) rows | |
| X23 | `l3-matched-window.mjs` | (instrument source) | session tooling | 2026-10-12 salvage | `bce9096e396302065ab106f906289082` | cited by dig #85-family rows | |
| X24 | `iou-114.log` | (C97 run log) | instrument log | 2026-10-12 salvage | `0faf146140d08d762a82d1e3745b62d2` | cited by (114) rows | |
| X25 | `iou-113.log` | (C97 run log) | instrument log | 2026-10-12 salvage | `47c2c8bdd2dc4efa91c9786518015c2b` | cited by dig #113 rows | |
| X26 | `fulltest-113.log` | (gate run log) | instrument log | 2026-10-12 salvage | `b3a52b2db4c2908d274e4c58e3112dcd` | cited by dig #113 rows | |
| X27 | `defaults_vals.txt` | (defaults census) | raw dump | 2026-10-12 salvage | `a4d33fc6f56ac9f285daa2b793d28a55` | cited by C37-family rows | |
| X28 | `census-114-pre113.log` | (doc census) | instrument log | 2026-10-12 salvage | `e04ba5f5f23a24702118a3d64ee49906` | cited by (114) rows | |
| X29 | `census-114-post113.log` | (doc census) | instrument log | 2026-10-12 salvage | `a2c5a0bd640581bf9c74f56771968b90` | cited by (114) rows | |
| X30 | `binding_table.txt` | (binding table notes) | raw dump | 2026-10-12 salvage | `ab28133d0112eb03e8b3f3354c103c0a` | cited by C94-family rows | |
| X31 | `bench-114.log` | (bench run log) | instrument log | 2026-10-12 salvage | `d6e23eecd8657bee75446ba14055cb8a` | cited by (114) rows | |

All rows assume the exe md5 = `8b611494212a69492dd0a4527d9c92e0` (C13);
a re-extraction from a different build must open a new row, never edit
an old one.
| X32 | `text.bin` | n/a — not a disasm window | .text raw bytes | 2026-10-12 salvage | `9b20fe243bbe32267e78e08a96d02990` | (salvage bank) | entry (124) |
| X33 | `rdata.bin` | n/a — not a disasm window | .rdata raw bytes | 2026-10-12 salvage | `6d1ff62bef94501371958ece200eaeaf` | (salvage bank) | entry (124) |
| X34 | `p0_functions.csv` | n/a — not a disasm window | function census (csv) | 2026-10-12 salvage | `612f3456dcab9185ebbb16690a960aa6` | (salvage bank) | entry (124) |
| X35 | `fnb.dis` | 0x4ef5d0..? | old-convention fnB disasm | 2026-10-12 salvage | `5fc7d3056eff856a0077ec319cad3a05` | (salvage bank) | entry (124) |
| X36 | `lfid.dis` | 0x8f9ab0..? | disasm window | 2026-10-12 salvage | `150f428b37e533b318dc5471c5e84adc` | (salvage bank) | entry (124) |
| X37 | `recparse.dis` | 0x4b1100..? | disasm window | 2026-10-12 salvage | `dfa03027cfb961aaf55e550d1ee753ad` | (salvage bank) | entry (124) |
| X38 | `recdisp2.dis` | 0x4abd40..? | disasm window | 2026-10-12 salvage | `cda0d0bbfe5d55cf0464fd83897853a6` | (salvage bank) | entry (124) |
| X39 | `gen-shape-pre114.json` | n/a — not a disasm window | instrument artifact | 2026-10-12 salvage | `7e4686d7b17440aa779de573434f97a6` | (salvage bank) | entry (124) |
| X40 | `surface-y-log-baseline.jsonl` | n/a — not a disasm window | instrument jsonl log | 2026-10-12 salvage | `7c0d548fb29220f6a25a5b45f184b65f` | (salvage bank) | entry (124) |
| X41 | `slabs/` | dir listing hash (32 entries) | slab dump DIRECTORY | 2026-10-12 salvage | `b62afd56ab7f9b241e5970e041bbd27c` | (salvage bank) | entry (124) |
| X42 | `dig117-prelib/` | dir listing hash (1159 entries) | pre-lib snapshot DIRECTORY | 2026-10-12 salvage | `0b0dfa07e716fe5cdb6cf17d807a46a2` | (salvage bank) | entry (124) |
| X43 | `dig121-fn908f40.asm` | 0x908f40..? | noise-lane driver window | 2026-10-12 salvage | `f9518d2405903b019acf7a4707d7835f` | (salvage bank) | entry (124) |
| X44 | `dig121-fn90b110.asm` | 0x90b110..? | noise-lane window | 2026-10-12 salvage | `713380070e085d883a785d18429abc9f` | (salvage bank) | entry (124) |
| X45 | `dig121-rev90b280.asm` | n/a — not a disasm window | kind-0 r-eval window (EMPTY 0 B salvage — flagged) | 2026-10-12 salvage | `d41d8cd98f00b204e9800998ecf8427e` | (salvage bank) | entry (124) |
| X46 | `dig121-sampler90d860.asm` | 0x90d800..? | sampler window | 2026-10-12 salvage | `63cbe775bc8cb0f41f9bc42dda8b9bf9` | (salvage bank) | entry (124) |
| X47 | `dig121-sampler90da00.asm` | 0x90da00..? | sampler window | 2026-10-12 salvage | `9a99d1bc2bae55688c2143c17ae0e727` | (salvage bank) | entry (124) |
| X48 | `dig123-c97-v2.log` | n/a — not a disasm window | C97 v2 run log | 2026-10-12 salvage | `e5bc339d9e4b8e18a99ea1d97e682f26` | (salvage bank) | entry (124) |
| X49 | `dig123-c97-v2v3.log` | n/a — not a disasm window | C97 v2v3 run log | 2026-10-12 salvage | `cd85ca1456d489dfd8494f41dee4b6d7` | (salvage bank) | entry (124) |
| X50 | `dig123-c97-v3.log` | n/a — not a disasm window | C97 v3 run log | 2026-10-12 salvage | `256141fbd1a63923265bbd8f88c00f52` | (salvage bank) | entry (124) |
| X51 | `dig123-ctor-8F9470.asm` | 0x8f9470..? | template ctor window | 2026-10-12 salvage | `89e339c66815c80b80f863d50e28eec8` | (salvage bank) | entry (124) |
| X52 | `dig123-fn668400.asm` | 0x668400..? | resolver window | 2026-10-12 salvage | `ea088a6df47bcfa4fa54441e6fa3cbdf` | (salvage bank) | entry (124) |
| X53 | `dig123-fn870-8EF870.asm` | 0x8ef870..? | lerp engine window | 2026-10-12 salvage | `f2156cf8fcb387266902761fd66b01d4` | (salvage bank) | entry (124) |
| X54 | `dig123-fn950-8EF950.asm` | 0x8ef950..? | stencil window | 2026-10-12 salvage | `32828fe1a05bca8a83729bfe058d15e6` | (salvage bank) | entry (124) |
| X55 | `dig123-rd.mjs` | n/a — not a disasm window | tooling | 2026-10-12 salvage | `8158302e17e71df3b415806a50dbb9b2` | (salvage bank) | entry (124) |
| X56 | `dig123-y0check.mjs` | n/a — not a disasm window | field probe tooling | 2026-10-12 salvage | `10ecf6bf3d39d15986f17be6974fe581` | (salvage bank) | entry (124) |
| X57 | `dig123-y0full.mjs` | n/a — not a disasm window | field probe tooling | 2026-10-12 salvage | `c0609fd02a9de5c8acdc7a47c3982726` | (salvage bank) | entry (124) |
| X58 | `dig118-shape-v2.log` | (C97 run log) | instrument log | 2026-10-12 salvage | `e5bc339d9e4b8e18a99ea1d97e682f26` | (salvage bank) | entry (124) |
| X59 | `dig118-shape-v2v3.log` | (C97 run log) | instrument log | 2026-10-12 salvage | `e4f6692370c722240958155b1da5204e` | (salvage bank) | entry (124) |
| X60 | `dig118-shape-v3.log` | (C97 run log) | instrument log | 2026-10-12 salvage | `96586b224aa4a857124469fbb1e33505` | (salvage bank) | entry (124) |
| X61 | `surface-y-log-q3a.jsonl` | (surface-y jsonl log) | instrument log | 2026-10-12 salvage | `4b678381fee83eb7d72f7300495a2b1c` | (salvage bank) | entry (124) |
| X62 | `dig126-constdump.mjs` | (instrument source) | session tooling (const-verifier export `readConst`) | 2026-10-12 dig #126 | `9d9eff005ef7862f3c19c313eab8c710` | C105 | the dig-126 const reads (the walk-frame const bank) |
| X63 | `artlane-2026-10-13.json` | the LoadPixelScene/ART-LANE census (256 callsites/134 lua files/141 unique scenes; per-call scene/visual/background/pos-expr extraction; resolution = 239 literal / 4 spliced-shipped / 2 lua-concat / 11 unresolved calls over 10 unique scene paths (the mountain hall_2-4 family + endgame2 + mountain_lake_top + temple/altar_top_boss_arena)) | data census (pure `<unpak>/data/scripts/biomes/**/*.lua`, game-completeness rule: shipped form = `biome_impl/spliced/<name>` .plz + placement-xml decides, never a bare stat) | 2026-10-13 dig #129 | `6310bcdefe2131eda29b6f78b724cf1c` | I32 (the art-first compositor) | the compositor dig's input table; the §12 layer-1 art lane |
| X64 | `dig135-builder-8EE000-8F3700.asm` | 0x8EE000..0x8F3700 (true-VA objdump: the fnA walk, fn870/fn950 twins, fnB incl. the record window 0x8F11B3..0x8F1746, fnC1/fnC2) | objdump -b binary --adjust-vma (exe slice file 0x4ED400..0x4F2B7F; true = file + 0x400C00) | 2026-10-14 dig #135 | `3f038a2578c34b638f3da118a32d3f2d` | C112, §8 row 46 | the y=0-bump writer read (the add-blend window) |
| X65 | `dig135-ctor-8F9470.asm` | 0x8F9470..~0x8F96C0 (the record-stamp wrapper ctor = the ctor-empty no-op's counterexample frame) | objdump -b binary --adjust-vma (exe slice file 0x4F8870..0x4F8ACF) | 2026-10-14 dig #135 | `df505fa813bbb5276f1af6aa8a3aec89` | C112 | supports the row-46 scope correction |
| X66 | `dig136-r-eval-90b280-90b67f.asm` | 0x90B280..0x90B67F (the r evaluator full prologue→ret: the per-tile band-ramp frame, the 0x90B680 param pair, the 0x11DF878 no-op final add) | objdump -b binary --adjust-vma (exe slice file 0x50A680..0x50AA7F) | 2026-10-14 dig #136 | `a8217b22ce540e08286012bf0282adc4` | C113, (136) | the (105) OPEN ①/③ settle; the kind-0 shape-frame law |
| X67 | `dig136-core-8FC020-8FC27F.asm` | 0x8FC020..0x8FC27F (the case-5 core full prologue→ret: the skew BSS reads, the corner-hash chains, the perm12[perm[i]+j] grad indexing, the ×70 final) | objdump -b binary --adjust-vma (exe slice file 0x4FB420..0x4FB67F) | 2026-10-14 dig #136 | `db491530125049ed88a51b39d23dd03a` | C39, (136) | the A4 corner-hash + the skew-const demote cite |
