# mapgen/ — Map-Gen Prediction bench

Tools to reverse-engineer and validate Noita's procedural world generation
("Map Gen Prediction").

**Docs:** `VERIFIED.md` is the distilled canon — verified truths, eliminated
hypotheses (do not re-test), and the ranked open frontier; feed session
context from it. `ABOUT_MATH.md` is the full research journal (evidence log
§6+); `ghidra-ledger.md` tracks the decompilation processing state.
`SESSION_CONTEXT.md` (repo root) holds strategy and current state.

**Authority (2026-09-08):** all facts stand on our own Ghidra asm work +
game oracles. **`vendor/noita-tools` (noitool) is OBSOLETE** — historical
reference only, never a comparison target or authority (its wasm output was
eliminated as game terrain, and its shipped hax code is a silent no-op due
to constant/data mismatch). Legacy wasm paths below are regression baselines
only. See `VERIFIED.md` header.

**Goal**: given a seed, produce the same world the game produces, verified
against the noitamap capture of seed `78633191`.

## Quick start

Prerequisites: extracted game data (see `SESSION_CONTEXT.md` → "Local machine
setup"; auto-detected, or set `NOITA_DATA_DIR`), then:

```bash
npm run bench        # 2-generate → 1-fetch-capture → 3-compare
```

Open `mapgen/out/report.html` for the chunk heatmap + side-by-side images.
`npm test` runs determinism/golden tests. Individual steps:

```bash
npm run bench:gen    # wang layer for CAPTURE_SEED → mapgen/out/gen/*.png
npm run bench:ref    # download capture tiles (cached) → mapgen/out/ref/*.png
npm run bench:diff   # score + report
```

## Layout

```
lib/          reusable code
pipeline/     the bench, in run order (1 → 2 → 3)
experiments/  dated one-off investigations (do NOT import from these)
out/          artifacts (gitignored)
tests/        vitest suite (repo root `tests/`: mapgen/, mapcap/, bridge/)
```

**Convention**: every new experiment goes in `experiments/` as
`YYYY-MM-DD-<what-it-tests>.mjs` and must state its conclusion in
`ABOUT_MATH.md` §6 (evidence log). Only code reused by the pipeline
graduates into `lib/` or `pipeline/`.

## Files

### lib/

| File | Purpose |
| ---- | ------- |
| `paths.mjs` | Resolves extracted game data dir (`NOITA_DATA_DIR` / WSL scan / Proton), legacy noita-tools wasm path (obsolete vendor), capture tile sources, `CAPTURE_SEED` (78633191) |
| `images.mjs` | PNG/JPEG decode+encode (pngjs, sharp): `readPng`, `writePng`, `readImageRaw`, PNG header peek, color conversions (RGBA ints, ARGB hex) |
| `biomes.mjs` | Parses `_biomes_all.xml` + biome XMLs + `biome_map.png` (70×48); connected-component **areas** per biome color; `biomeAt(tx,ty)` lookup. Game-truth parser (noitool's maps.json = obsolete) |
| `wang-wasm.mjs` | **LEGACY** loader for the obsolete noitool prebuilt `noita_random.wasm`; `generateArea()` = the old noitool pipeline — regression baseline only, NOT a game reference (superseded by `generate-exact.mjs`) |
| `wang-js.mjs` | **Our own JS port** of the corner-mode stbhw builder: exact `NollaPrng` + `SetRandomSeed` (diddle table), template parser, vertex grid, fill scan, pluggable vertex-coloring (sequential vs position-seeded) — the laboratory for coloring hypotheses |
| `coords.mjs` | bigMap ↔ world/chunk mapping with anchor hypotheses (mode names `noitool`/`snap`/`exact` are historical labels) and correction knobs (offsets, flips) — the fitting ground for placement math |

### pipeline/

| File | Purpose |
| ---- | ------- |
| `1-fetch-capture.mjs` | Downloads noitamap ground-truth tiles (DZI, seed 78633191, CDN) for a biome-map window; slices to 512×512 chunk PNGs; caches webp tiles in `out/cache/` |
| `2-generate.mjs` | Runs the wang layer (via `wang-wasm`) for a seed/window; writes chunk PNGs + `manifest.json` (area, crop, world anchor per chunk) |
| `3-compare.mjs` | Scores generated vs captured chunks (mean abs diff, air/solid mismatch %); writes `out/stats.json` + `out/report.html` (heatmap + side-by-sides) |

### experiments/ (dated one-offs, with conclusions)

| File | Question | Result |
| ---- | -------- | ------ |
| `2026-09-03-fit-transform.mjs` | Does a global shift/flip align gen vs capture? | No — inconsistent per-chunk shifts, zero flip votes |
| `2026-09-03-anchor-sweep.mjs` | Does any crop anchor/phase fix it? | No — 58.3–59.7%, baseline everywhere |
| `2026-09-03-verify-vs-noitool.mjs` | Does our wasm usage reproduce noitool exactly? | **Yes** (28/28 comparable fixtures, RGB-identical) — consistency check vs noitool, not vs the game |
| `2026-09-03-port-validation.mjs` | Does our JS builder port match the wasm? Does position-seeded coloring help? | ~39% (hasPath re-rolls expected); positional naive test: no signal |
| `2026-09-03-positional-sweep.mjs` | Sweep positional vertex-coloring call shapes/anchors vs capture | Flat 49–52% — hypothesis not confirmed |
| `2026-09-03-wang-gen-template-diff.mjs` | Does our atlas walk match Nolla's official template generator? | **Yes** — dims, header bytes, 72h+72v enumeration identical; `wang_gen.exe` is template-side only (no fill); found+fixed missing variants loop in our port |
| `2026-09-03-lua-oracle-crosscheck.mjs` | Does our JS RNG reconstruction match the running game? | **Yes — 100.00% across 4 seeds / 2.1M draws** after fixing a signedness bug (`helper2` missing `>>> 0`); probe mod: `mods/noita-livemap-rng-probe/` |
| `2026-09-03-fill-sweep.mjs` | Is the wang fill per-vertex position-seeded? (same-seed oracle + capture) | **No** — 1,154 hypotheses (encodings × anchors), all below the noise floor; per-vertex seeding eliminated; next: per-chunk sequential fills (probe v4) |
| `2026-09-04-chunk-fill-sweep.mjs` | Is the fill sequential per chunk, seeded at its origin? (v4 streams) | **No** — 8 variants, 49.5–52.2%, below noise floor; anchors validated 100%. Caveat: capture paint-layers may mask even a correct fill → spawn-equations (paint-immune) become the primary judge |

### tools

| File | Purpose |
| ---- | ------- |
| `update-golden.mjs` | Re-blesses `out/golden.json` (regression baselines for the wasm output AND the wang-js port). Refuses to overwrite without `--force` — re-goldening is always a deliberate act; log the reason in `ABOUT_MATH.md` §6 |

### Wang Lab (`mods/noita-wang-lab/` + `lib/wang-template-writer.mjs`)

A controlled experiment: injects a 16-tile custom wang biome as a 5×2-chunk
rectangle (biome px tx 2..6, ty 36..37) whose tiles self-report their
placement via spawn-color callbacks. The recovered tile→cell map determines
the vertex-color grid **exactly** — the answer key for fill-hypothesis
testing (see `ABOUT_MATH.md` §7septies).

```bash
# regenerate atlas + lab.lua from the template encoder (self-validating)
node -e 'import("./mapgen/lib/wang-template-writer.mjs").then(async W => { const fs=await import("node:fs"); const t=W.makeLabTemplate(); const {writePng}=await import("./mapgen/lib/images.mjs"); writePng("mods/noita-wang-lab/files/wang_tiles/lab.png",t.width,t.height,t.rgba); fs.writeFileSync("mods/noita-wang-lab/files/scripts/lab.lua",W.labLua(t.tiles)); })'

# in-game (lab mod + seed mod ONLY — no rng-probe, both drive the camera):
#   force seed → new game → auto-visit (~35 s) → quit
#   output: save00/noita-wang-lab-tiles-<seed>.csv

# recover vertex grids from the dumps
node mapgen/experiments/2026-09-04-lab-vertex-recovery.mjs

# automated hypothesis search (two exits: 100% match → auto-verify 92/93,
# or timeout in minutes; journal: out/oracle/optimizer-log.jsonl)
node --max-old-space-size=4096 mapgen/experiments/2026-09-04-lab-optimizer.mjs 60

# interactive supervision (browser dashboard over the same engine):
#   npm run dev  →  open http://localhost:5173/lab/   (docs: /lab/how.html)
#   live counters, depth trend vs noise floor, event feed, start/pause/stop.
#   The dashboard runs the search in a Web Worker via lib/lab-search.mjs
#   (pure ESM, browser-safe — the CLI optimizer is the unattended alternative).
```

Resource notes: optimizer RSS ≈ 72 MB (no OOM risk in v2 — v1 OOMed by
journaling every candidate; v2 journals new bests/survivors only). Full S1
exhaustive sweep ≈ 94M candidates ≈ 35 min single-threaded. Artifacts live
on the repo disk (gitignored); the game disk only holds the small CSVs.

### tests/ (repo root, vitest)

| File | Purpose |
| ---- | ------- |
| `tests/mapgen/prng.test.mjs` | NollaPrng contract + pinned vectors (game-verified port), seededPrng signedness-fix regression |
| `tests/mapgen/wang-fill.test.mjs` | Template walk + herringbone fill on synthetic atlases; coalmine counts (s=13, 72h+72v) |
| `tests/mapgen/golden.test.mjs` | L0 determinism + wasm/wang-js golden snapshots (migrated `mapgen/test/bench.test.mjs`) |
| `tests/mapgen/has-path.test.mjs` | hasPath oracle-port contracts; coalmine-hax constants are live (0x006400/0x000064); marker table |
| `tests/mapgen/world-gen.test.mjs` | 71x144 canvas, area/chunk grid mapping, per-area .bin cache format, ensureWorld from gen-cache |
| `tests/mapgen/colorize.test.mjs` | Display pass contracts + **I8** lake_deep water regression |
| `tests/mapgen/biomes.test.mjs` | Biome config invariants (70x48 map, clamping, flags, def shape) |
| `tests/mapgen/coords.test.mjs` | Coordinate constants + biome-px↔chunk math |
| `tests/mapgen/api-surface.test.mjs` | Every public export of every lib module pinned by type/arity/constant |
| `tests/mapgen/map-format.test.mjs` | `lib/map-format.mjs` JSON spec — serialize/validate round-trip + diagnostics |
| `tests/mapcap/artifacts.test.mjs` | manifest.json / analysis.json / chunks/ output spec of analyzed captures |
| `tests/bridge/telemetry-format.test.mjs` | Telemetry JSON contract (Lua mod ↔ bridge ↔ frontend) |

Data-dependent suites skip automatically when the extracted game data (or the
corresponding artifacts) are absent. `node mapgen/update-golden.mjs --force`
re-blesses the golden snapshots.

### out/ (gitignored)

| Path | Content |
| ---- | ------- |
| `gen/`, `ref/` | generated / captured 512×512 chunk PNGs + manifests |
| `cache/tiles/` | downloaded capture tiles (offline after first run) |
| `report.html`, `stats.json` | comparison report |
| `golden.json` | golden hash snapshot for the regression test |

## Status (2026-09-03)

Atlas format decoded, fill algorithm understood, PRNG exact — but **no tested
coloring method reproduces the game yet**, and the capture-vs-wang comparison
is confounded by non-wang layers (walls/scenes/edges ≈ +24% density).
Current priorities live in `ABOUT_MATH.md` §7.
