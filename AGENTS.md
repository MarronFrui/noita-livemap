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

Long-term goal (see `ROADMAP.md`, `SESSION_CONTEXT.md`): procedurally generate
the world map for the live seed using the reverse-engineered generation in
`vendor/noita-tools`, instead of showing pre-captured tiles.

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
node mapgen/experiments/2026-09-03-fit-transform.mjs       # cross-correlate gen vs ref masks
node mapgen/experiments/2026-09-03-verify-vs-noitool.mjs   # wasm wrapper vs noitool fixtures

# Capture analysis (see mapcap/README.md; artifacts in mapcap/out/, gitignored)
node mapcap/analyze-capture.mjs --name <run> --seed <seed> [--stitched <png>] [--chunks true]
node mapcap/diff-captures.mjs --a <runA> --b <runB>
node mapcap/diff-vs-reference.mjs --name <run>

# Tests
npm test             # node:test; determinism + golden hash (needs extracted data)

# Production build
npm run build
npm run preview
```

- Tests: none yet (`npm test` is a placeholder).
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
| `vendor/noita-tools/` | Git submodule (TwoAbove/noita-tools; PRNG + map-gen recon) |
| `tools/zig/` | Zig toolchain used for native tooling |
| `ROADMAP.md` | Phased plan (Phases 0–5) |
| `SESSION_CONTEXT.md` | Current state, decisions, key technical facts, next steps |

## Conventions

- Root and `bridge/` are ESM (`"type": "module"`); use `import`/`export`, not `require`.
- Frontend is TypeScript; bridge and scripts are plain JavaScript (`.js`, `.mjs`).
- Treat `vendor/` as read-only upstream code — changes there belong in the
  respective submodule repos, not here.
- Read `SESSION_CONTEXT.md` before planning work; it records decisions and the
  intended next steps so sessions don't rediscover context.

## Environment notes

- Noita runs on Windows; the bridge typically runs in WSL. `/mnt/c/...` paths
  do not emit file-change events, hence the polling watcher in `bridge/index.js`.
- Telemetry file (Windows/WSL):
  `%USERPROFILE%\AppData\LocalLow\Nolla_Games_Noita\save00\noita-live-map-telemetry.json`
- Linux/Proton fallback path is handled inside `bridge/index.js`.
