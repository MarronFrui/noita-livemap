# AGENTS.md

Guidance for coding agents working in this repository.

## Project

**Noita Livemap** — a local, live interactive map for the game Noita. Fork of
acidflow's noitamap that shows the live player position on the world map.

Data flow:

```
Noita Lua mod  →  telemetry JSON  →  Node bridge  →  frontend  →  noitamap iframe
```

1. `mods/noita-live-map/` (Lua) writes `seed`, `biome`, `x`, `y` to
   `save00/noita-live-map-telemetry.json` ~10x/second.
2. `bridge/` (Node, ESM) watches that file with chokidar and broadcasts over
   WebSocket (port 8080, override with `BRIDGE_PORT`; path override with
   `TELEMETRY_PATH`). Uses polling when the path is under `/mnt/` (WSL).
3. `src/main.ts` (Vite frontend) receives telemetry, displays it, and drives a
   player marker inside the embedded noitamap iframe.

Long-term goal (see `GOALS.md`, `ROADMAP.md`): procedurally generate
the world map for the live seed using our own Ghidra-reconstructed generation
(`mapgen/VERIFIED.md` is the canon), instead of showing pre-captured tiles.

## Commands

```bash
# One-time setup (submodules required)
git submodule update --init --recursive
npm install
cd bridge && npm install
cd ../vendor/noitamap && npm install && npm run build
cd ../..
npm run copy:noitamap

# Development (two terminals)
npm run dev:bridge   # bridge WebSocket server on :8080
npm run dev          # Vite dev server on http://localhost:5173/

# Map-gen bench (see mapgen/README.md and mapgen/ABOUT_MATH.md)
npm run bench        # generate + fetch reference + diff (report in mapgen/out/report.html)
npm run bench:gen    # seed -> wang-layer chunk PNGs in mapgen/out/gen/
npm run bench:ref    # fetch capture tiles (seed 78633191) -> mapgen/out/ref/
npm run bench:diff   # score chunks, write stats.json + report.html
npm run gen:server   # generated-map tile server on :8082 (mapgen/server/genmap-server.mjs)
npm run gen:clear    # wipe the generated-world cache (-- --seed N scopes to one seed)
node mapgen/experiments/2026-09-03-fit-transform.mjs       # cross-correlate gen vs ref masks
node mapgen/experiments/2026-09-03-verify-vs-noitool.mjs   # (OBSOLETE) historical check vs noitool fixtures

# Capture analysis (see mapcap/README.md; artifacts in mapcap/out/, gitignored)
node mapcap/analyze-capture.mjs --name <run> --seed <seed> [--stitched <png>] [--chunks true]
node mapcap/diff-captures.mjs --a <runA> --b <runB>
node mapcap/diff-vs-reference.mjs --name <run>

# Wang Lab (controlled fill experiments; see mapgen/README.md + ABOUT_MATH §7septies)
node mapgen/experiments/2026-09-04-lab-vertex-recovery.mjs          # dumps → vertex grids
node --max-old-space-size=4096 mapgen/experiments/2026-09-04-lab-optimizer.mjs 60  # hypothesis search (timeout min)

# Tests (vitest; data-dependent suites auto-skip without extracted data)
npm test             # full battery: API surface, PRNG, wang fill, hasPath
                     # oracle, world cache, map-format spec, mapcap JSON
                     # specs, telemetry contract ( see tests/ )

# Production build
npm run build
npm run preview
```

- Tests: vitest battery in `tests/` (`npm test`); data-dependent suites
  auto-skip without extracted data.
- No linter/formatter is configured at the repo root; there is no root
  tsconfig (Vite compiles `src/main.ts` directly).

## Structure

| Path | What it is |
| ---- | ---------- |
| `bridge/index.js` | File watcher + WebSocket broadcaster (Node ESM: `ws`, `chokidar`) |
| `mapgen/` | Map-gen bench: wasm loader, biome layout parser, chunk renderer, reference slicer, diff/fit rig (plain ESM `.mjs`) |
| `mapcap/` | Capture-based ground truth: noita-mapcap slicing, seed-differential analysis, predetermined zones (`mapcap/README.md`) |
| `mods/noita-live-map/` | Noita Lua telemetry mod (`init.lua`, `files/telemetry.lua`) |
| `src/main.ts`, `src/style.css` | Vite frontend; embeds noitamap iframe |
| `index.html` | Vite entry point |
| `scripts/copy-noitamap.mjs` | Copies built noitamap assets into `public/noitamap/` |
| `public/noitamap/` | **Generated** — do not edit; comes from `vendor/noitamap/public` |
| `dist/` | Build output — do not edit |
| `vendor/noitamap/` | Git submodule (fork of acidflow-noita/noitamap) |
| `vendor/noita-tools/` | Git submodule (TwoAbove/noita-tools) — **OBSOLETE reference**: legacy data/wasm container only; never a comparison target (see `mapgen/VERIFIED.md`) |
| `tools/zig/` | Zig toolchain used for native tooling |
| `ROADMAP.md` | Phased plan (Phases 0–5) |
| `GOALS.md` | The campaign goal stack + method charter (read first in mapgen sessions) |
| `docs/history/SESSION_CONTEXT-archived-2026-09-28.md` | Retired handover (stale at entry (110); kept for the early-campaign survey + machine-setup history only — do NOT read as current state) |

## Conventions

- Root and `bridge/` are ESM (`"type": "module"`); use `import`/`export`, not `require`.
- Frontend is TypeScript; bridge and scripts are plain JavaScript (`.js`, `.mjs`).
- Treat `vendor/` as read-only upstream code — changes there belong in the
  respective submodule repos, not here.
- Mapgen sessions: read `GOALS.md` first (goal stack + method charter);
  derive live state from the four registries — hand-rolled handover
  files are retired (the stale `SESSION_CONTEXT.md` cost the campaign
  two weeks of drift; its archive is history-only).
- **Campaign method (see `GOALS.md`, enforced):** (1) derive every byte
  claim THIS session from the enclosing function's full extent (prologue
  → ret), freshly extracted — a prior cite is a hint, not evidence;
  (2) stream/budget laws get COUNT tests (0/1/N), never boolean;
  (3) stream equivalence is measured before C97 shape metrics mean
  convergence; modelled lanes stay FLAGGED with a queue position;
  (4) no tuning — commit correctness even when the metric ticks down;
  (5) one dig = one commit = tree clean; `/dig`, `/status`, `/verify`
  commands enforce the protocol.
- Domain facts must carry a source (file + section) verified on disk **this
  session**. Never carry numbers from chat memory, prior-session summaries, or
  handovers into work or docs — re-check first.
- Map-gen documentation is **two-layered**:
  - `mapgen/ABOUT_MATH.md` §6 is the append-only evidence log — new research
    results (including eliminations and open hypotheses) land there first,
    with a status tag.
  - `mapgen/VERIFIED.md` is the distilled canon — verified truths,
    eliminated-don't-retest rows, and the ranked open frontier. When a result
    from the evidence log settles, distill it into `VERIFIED.md` (with its
    source pointer); when new evidence overturns a canon row, move it to the
    elimination table instead of deleting it. Feed session context from
    `VERIFIED.md`; read `ABOUT_MATH.md`/`ghidra-ledger.md` only for the
    history of a specific claim.

## Environment notes

- Noita install: `/mnt/e/Programmes/Steam/steamapps/common/Noita`
  (`noita_dev.exe` = the RE target, `tools_modding/` ships `wang_gen.exe`).
- Extracted game data (Step 0 done, `-wizard_unpak`): `/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/` — resolved via `NOITA_DATA_DIR` with that path as fallback, never copied into the repo.
- Windows user for telemetry/bridge paths: `xan98`.
- Noita runs on Windows; the bridge typically runs in WSL. `/mnt/c/...` paths
  do not emit file-change events, hence the polling watcher in `bridge/index.js`.
- Telemetry file (Windows/WSL):
  `%USERPROFILE%\AppData\LocalLow\Nolla_Games_Noita\save00\noita-live-map-telemetry.json`
- Linux/Proton fallback path is handled inside `bridge/index.js`.
