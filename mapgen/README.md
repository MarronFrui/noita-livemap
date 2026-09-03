# mapgen/ — Map-Gen Prediction bench

Tools to reverse-engineer and validate Noita's procedural world generation
("Map Gen Prediction" — see `ABOUT_MATH.md` for the math, `SESSION_CONTEXT.md`
at the repo root for strategy and current state).

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
test/         node:test suite
out/          artifacts (gitignored)
```

**Convention**: every new experiment goes in `experiments/` as
`YYYY-MM-DD-<what-it-tests>.mjs` and must state its conclusion in
`ABOUT_MATH.md` §6 (evidence log). Only code reused by the pipeline
graduates into `lib/` or `pipeline/`.

## Files

### lib/

| File | Purpose |
| ---- | ------- |
| `paths.mjs` | Resolves extracted game data dir (`NOITA_DATA_DIR` / WSL scan / Proton), noita-tools wasm path, capture tile sources, `CAPTURE_SEED` (78633191) |
| `images.mjs` | PNG/JPEG decode+encode (pngjs, sharp): `readPng`, `writePng`, `readImageRaw`, PNG header peek, color conversions (RGBA ints, ARGB hex) |
| `biomes.mjs` | Parses `_biomes_all.xml` + biome XMLs + `biome_map.png` (70×48); connected-component **areas** per biome color; `biomeAt(tx,ty)` lookup. Game-truth equivalent of noitool's maps.json |
| `wang-wasm.mjs` | Node loader for noitool's prebuilt `noita_random.wasm`; `generateArea()` = their full pipeline (seed → MapHandlerNew → atlas → toBig) returning the cell map + bigMap |
| `wang-js.mjs` | **Our own JS port** of the corner-mode stbhw builder: exact `NollaPrng` + `SetRandomSeed` (diddle table), template parser, vertex grid, fill scan, pluggable vertex-coloring (sequential vs position-seeded) — the laboratory for coloring hypotheses |
| `coords.mjs` | bigMap ↔ world/chunk mapping with anchor hypotheses (`noitool` / `snap` / `exact`) and correction knobs (offsets, flips) — the fitting ground for placement math |

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

### test/

| File | Purpose |
| ---- | ------- |
| `bench.test.mjs` | Determinism (same seed → identical output), seed sensitivity, **two golden hashes**: wasm (noitool model) bigMap + wang-js sequential port (map hash + tileset parse counts). Both skip until `out/golden.json` exists |

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
