# mapgen/ — Map-Gen Prediction bench

Tools to reverse-engineer and validate Noita's procedural world generation
("Map Gen Prediction").

**Docs:** `VERIFIED.md` is the distilled canon — verified truths, eliminated
hypotheses (do not re-test), and the ranked open frontier; feed session
context from it. `ABOUT_MATH.md` is the full research journal (evidence log
§6+); `ghidra-ledger.md` tracks the decompilation processing state.
`SESSION_CONTEXT.md` (repo root, gitignored) = the session context loader;
the method charter lives in `AGENTS.md`.

**Authority (2026-09-08):** all facts stand on our own Ghidra asm work +
game oracles. **`vendor/noita-tools` (noitool) is OBSOLETE** — historical
reference only, never a comparison target or authority (its wasm output was
eliminated as game terrain, and its shipped hax code is a silent no-op due
to constant/data mismatch). Legacy wasm paths below are regression baselines
only. See `VERIFIED.md` header.

**Goal**: given a seed, produce the same world the game produces, verified
against the noitamap capture of seed `78633191`.

## Quick start

Prerequisites: extracted game data (machine paths in `AGENTS.md` →
"Environment notes"; auto-detected, or set `NOITA_DATA_DIR`), then:

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
re/           REA inputs: Ghidra seed file + the pinned exe copy (target/, gitignored) — see AGENTS.md
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

### server/ (generated-map tile server + cache tooling)

| File | Purpose |
| ---- | ------- |
| `genmap-server.mjs` | The genmap MVP tile server (`npm run gen:server`, port `GENMAP_PORT` 8082): `/gen/tile/:seed/:z/:x/:y.png` (± `?c=1`/`?c=0` to override the capture-composite layer, default off), `/gen/status/:seed`, `/gen/zones/:seed`, viewer at `/` (`public/genmap.html`) |
| `gen-cache.mjs` | Cache-clearing helper shared by the server endpoints and the CLI |
| `gen-cache-clear.mjs` | CLI: `npm run gen:clear [-- --seed N]` — wipes the generated-world disk cache |

Generated-world caching is three-layered: disk
(`out/gen-cache/<revision>/<seed>/<areaKey>.bin`; the `<revision>` (r3b, r3c,
r3d, …) is bumped **manually** when the render pipeline changes), the server's
in-memory per-seed worlds, and the browser's `immutable` tile cache. To force
a brand-new generation: `GET|POST /gen/clear/:seed` (or `/gen/clear` for all
seeds) while the server runs — it drops disk + memory caches and bumps the
`epoch` returned by `/gen/status`, which the viewer appends to tile URLs so
the browser's cache is busted (the viewer's **regen** button does this in one
click) — or `npm run gen:clear` when the server is off.

**Capture-composite display layer** (ISSUES A10; frame law C151): at the
captured seed (78633191) the server serves world px from the capture tiles
(`out/ref/`, the game's own output) wherever coverage exists, so the viewer
shows the game's true pixels over the still-partial runtime-computed lanes.
Default **OFF** since 2026-10-21 (user call: the capture is a fixed world
that is never the live run's) — re-enable globally with `CAPTURE_LAYER=1`
when starting the server, or toggle per view with the viewer's **capture**
button (`?c=1` / `?c=0` on tile URLs; the layer only fires at the captured
seed either way). It is a display layer, not a generator: the lib lanes
and the bench instruments always read the raw generator.

### experiments/ (dated one-offs)

`YYYY-MM-DD-<what-it-tests>.mjs` (plus `digNNN-*` instruments). Each one's
question and conclusion live in its `ABOUT_MATH.md` §6 entry — this README
does not duplicate them. The current surface-band instruments are named in
the newest §6 entry and in `VERIFIED.md` §12.

### tools

| File | Purpose |
| ---- | ------- |
| `update-golden.mjs` | Re-blesses `out/golden.json` (regression baselines for the wasm output AND the wang-js port). Refuses to overwrite without `--force` — re-goldening is always a deliberate act; log the reason in `ABOUT_MATH.md` §6 |

### Wang Lab (`mods/noita-wang-lab/` + `lib/wang-template-writer.mjs`)

A controlled experiment: injects a 16-tile custom wang biome as a 5×2-chunk
rectangle (biome px tx 2..6, ty 36..37) whose tiles self-report their
placement via spawn-color callbacks. The recovered tile→cell map determines
the vertex-color grid **exactly** — the answer key for fill-hypothesis
testing (see `ABOUT_MATH.md` §7.6).

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

`npm test` runs the whole battery in `tests/` (`tests/mapgen/`,
`tests/mapcap/`, `tests/bridge/`, plus the gate-lib and dig-specific suites at
`tests/*.test.mjs`). The expected totals are pinned in
`scripts/precommit-baseline.json` (the pre-commit gate refuses a run that
does not match them). Data-dependent suites skip automatically when the
extracted game data (or the corresponding artifacts) are absent.
`node mapgen/update-golden.mjs --force` re-blesses the golden snapshots.

### out/ (gitignored)

| Path | Content |
| ---- | ------- |
| `gen/`, `ref/` | generated / captured 512×512 chunk PNGs + manifests |
| `cache/tiles/` | downloaded capture tiles (offline after first run) |
| `report.html`, `stats.json` | comparison report |
| `golden.json` | golden hash snapshot for the regression test |
