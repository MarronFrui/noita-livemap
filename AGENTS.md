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

Long-term goal (see `ROADMAP.md`; the campaign frontier = `mapgen/VERIFIED.md`
§9 + `SESSION_CONTEXT.md`): procedurally generate
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
| `mapgen/extractions/` | Byte-extraction dumps (gitignored, path-stable) + tracked `MANIFEST.md` — the manifest rows that docs and code cite (METHODOLOGY §2) |
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
| `SESSION_CONTEXT.md` | **The session context loader** (gitignored by design) — read at session start; also `Current_work.md` (gitignored live P1 task tracker) |

## Campaign method charter

Enforced by the `/dig` command. No separate method file — these are the
rules, with the incident that motivates each in one line:

- **Claim levels — B/M/D.** Every claim is B (BYTE: this-session
  full-function extraction, cited to a `mapgen/extractions/MANIFEST.md`
  row), M (MEASURED: instrument artifact), or D (DEBT: a stand-in — must
  be registered in `ISSUES.md` §A, FLAGGED in code, and queued). D
  claims are never load-bearing. **Purification law:** an active-path
  dig ends with fewer D-rows than it started with, or re-opens its
  scope. *(C51's mispin lived ~10 digs by hiding among untagged claims.)*
- **Full-window extraction + fresh reads.** Read claims from the
  enclosing function's prologue→ret, loop heads and epilogues included,
  extracted THIS session; a prior cite is a hint, not evidence.
  Predict the law before opening the disasm; if the port surprises
  you, re-read the bytes — never accommodate the surprise in code.
  *(Dig #122's re-read started past the count roll; dig #123's
  `trunc(−x)` idiom was explained instead of re-read.)*
- **Anti-loop guard.** A dig names its NEW evidence (unread window /
  new data / new instrument / named overturning evidence) and the
  registry claim it touches BEFORE reading anything; if it cannot, it
  is a repeat dig — take the next queue item instead.
- **Count tests.** Stream/budget laws get 0/1/N count tests plus the
  skip path; a replacement test must FAIL under the old law's
  arithmetic; data-dependent suites must RUN (not skip) in gates.
  *(Dig #123's 2-group resolver bug.)*
- **Stream-first.** While a D-level lane sits upstream in the RNG
  stream, shape metrics (C97 IoU) are noise — interpret them only after
  the stream trace is clean through the touched lane and everything
  upstream. Build the stream-trace instrument with dig #124 (fnA walk).
- **No tuning; one dig = one commit.** Commit correctness even when the
  metric ticks down (precedents: digs #122/#123); port + tests + gates +
  the four registries land in one commit, tree ends clean.

## Conventions

- Root and `bridge/` are ESM (`"type": "module"`); use `import`/`export`, not `require`.
- Frontend is TypeScript; bridge and scripts are plain JavaScript (`.js`, `.mjs`).
- Treat `vendor/` as read-only upstream code — changes there belong in the
  respective submodule repos, not here.
- Mapgen sessions: start at `SESSION_CONTEXT.md` (gitignored context
  loader, kept current per dig) → derive live state from the four
  registries — no other handover files exist.
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
