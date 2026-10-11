# Extraction manifest

Dated, digest-pinned record of every byte-extraction `mapgen/extractions/`
holds. Docs cite these rows (file + row id), never ad-hoc `/tmp` paths —
`/tmp` is volatile and has already orphaned historical cites
(`ABOUT_MATH` (102)–(123) era). Rule: METHODOLOGY.md §2(2).

| id | file (in this dir) | VA range | tool | date | md5 | cited by | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| X1 | `fulltext86.asm` | full binary disasm (Ghidra full export) | Ghidra | 2026-10-10 | `29bfa9623eb2257e82e614ea07e3b80c` | C100 | 188 MB; local file survives until manually pruned |
| X2 | `builder-8EE000-8F3700.asm` | 0x8EE000..0x8F3700 | objdump | 2026-10-10 | `5c141eb7c71c7c59ef229c50b411c811` | C101, C102 (as `/tmp/opencode/dig119/…`), row 42/43 | the builder slab — the fnA/fnB/ctor/setter window |
| X3 | `ctor-8F9470.asm` | 0x8F9470..0x8F96B2 | objdump | 2026-10-11 | `89e339c66815c80b80f863d50e28eec8` | C101(d), C102, row 42/43 | template ctor (as `/tmp/opencode/dig123/…`) |
| X4 | `fn668400.asm` | 0x668400..0x668790 | objdump | 2026-10-11 | `ea088a6df47bcfa4fa54441e6fa3cbdf` | C102 (c) | the image resolver (as `/tmp/opencode/dig123/…`) |
| X5 | `fn950-8EF950.asm` | 0x8EF950..0x8EFA40 | objdump | 2026-10-11 | `32828fe1a05bca8a83729bfe058d15e6` | C101, C102 (d) | the gated byte stencil (as `/tmp/opencode/dig123/…`) |
| X6 | `fn870-8EF870.asm` | 0x8EF870..0x8EF93E | objdump | 2026-10-11 | `f2156cf8fcb387266902761fd66b01d4` | C101, C102 (d) | the two-sided lerp engine (as `/tmp/opencode/dig123/…`) |

All rows assume the exe md5 = `8b611494212a69492dd0a4527d9c92e0` (C13);
a re-extraction from a different build must open a new row, never edit
an old one.
