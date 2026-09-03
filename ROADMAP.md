# Noita Live Interactive Map — Roadmap

This document tracks the planned milestones and open questions for the project.

---

## ✅ Done

### Telemetry mod (`mods/noita-live-map/`)

- [x] `mod.xml`, `init.lua`, `files/telemetry.lua`
- [x] Reads player position, biome, and world seed on every frame
- [x] Throttled to ~10 Hz writes
- [x] Writes JSON to Noita's sandboxed mod-data folder
- [x] No unrestricted API access required

Current output:

```json
{ "seed": 1296487564, "x": -1356, "y": 5630, "biome": "Coal Pits", "ts": 1712345678 }
```

Default write path:

```
%LocalLow%/Nolla_Games_Noita/save00/noita-live-map-telemetry.json
```

(We initially tried `ModDataFileSetText` for the sandboxed `mod_data/` folder, but that function is not available in all Noita versions. The mod now writes directly to the save folder, which requires `request_no_api_restrictions="1"`.)

### Node bridge (`bridge/`)

- [x] Watches the telemetry JSON file (`chokidar`)
- [x] Broadcasts updates over a local WebSocket server (`ws`)
- [x] Handles missing file gracefully
- [x] Cross-platform path resolution (Windows + Linux/Proton fallback)

### Frontend (`index.html`, `src/`)

- [x] Vite dev/build setup
- [x] Embeds the forked noitamap via iframe
- [x] Displays live seed, biome, and position
- [x] Warns when current run seed differs from map capture seed

### Repository

- [x] License updated to GPL-3.0
- [x] Forked noitamap added as `vendor/noitamap` submodule
- [x] noita-tools added as `vendor/noita-tools` submodule
- [x] Build helper script copies noitamap assets to `public/noitamap/`

### Map-Gen Prediction bench (`mapgen/`, 2026-09-03)

- [x] Data.wak extracted; local machine setup documented in `SESSION_CONTEXT.md`
- [x] WASM harness, biome layout parser (areas match noitool's maps.json), chunk renderer
- [x] Capture fetcher (noitamap CDN, seed 78633191, DZI→512px chunks, cached)
- [x] Diff/report pipeline (per-chunk scores, heatmap, side-by-sides, noise-floor calibration)
- [x] Biome atlas format fully decoded (corner-type herringbone; hidden binary header)
- [x] JS port of the corner-mode builder with pluggable RNG (`mapgen/lib/wang-js.mjs`)
- [x] Experiments: transform fit, anchor sweep, positional sweep — all negative; evidence in `ABOUT_MATH.md` §6
- [x] Tests: determinism, seed sensitivity, golden hash (`npm test`)

---

## How to run

### Prerequisites

- Node.js installed
- Noita with the `noita-live-map` mod enabled
- Unsafe mods allowed in Noita (the mod writes directly to the save folder)

### Install

```bash
npm install
cd bridge && npm install
cd ../vendor/noitamap && npm install && npm run build
cd ../..
```

### Start everything

```bash
# Terminal 1: bridge
npm run dev:bridge

# Terminal 2: frontend
npm run dev
```

Then open the Vite URL (usually `http://localhost:5173/`) in your browser.

The bridge auto-detects the telemetry file location:

- **Windows:** `%LocalLow%/Nolla_Games_Noita/save00/noita-live-map-telemetry.json`
- **Linux / Proton:** scans `~/.local/share/Steam/steamapps/compatdata/881100/pfx/drive_c/users/` for the active Windows user folder.

If auto-detection fails, override it with:

```bash
TELEMETRY_PATH=/your/actual/path/noita-live-map-telemetry.json npm run dev:bridge
```

## 🚧 After MVP

### Live marker on the map

- [x] Convert telemetry coordinates to noitamap viewport coordinates
- [x] Render a player marker inside the noitamap iframe via `postMessage`
- [x] Optionally pan the map to follow the player

### Quality-of-life

- [ ] Configurable telemetry write rate
- [x] Configurable bridge port / file path (env vars: `BRIDGE_PORT`, `TELEMETRY_PATH`)
- [x] WebSocket reconnect logic
- [ ] Better error reporting in the UI when Noita/bridge is not running
- [ ] Remove/copy less of noitamap (currently copies entire `public/` build output)

### Distribution

- [ ] Package the Node bridge as a single executable or simple `npm start` flow
- [ ] Publish the mod to Steam Workshop
- [ ] Decide whether to bundle the map viewer or keep it as a separate local web app

---

## 🧬 Map Gen Prediction: Procedural Map Generation

Long-term goal: replace noitamap's pre-captured tiles with tiles generated on demand from any valid Noita seed. This is a reverse-engineering project built on top of [noita-tools](https://github.com/TwoAbove/noita-tools), which has already reconstructed much of Noita's RNG and world-generation logic.

> **The math record is `mapgen/ABOUT_MATH.md`** — coordinate systems, PRNG,
> atlas format, fill algorithm, hypotheses, evidence log, experiment backlog.
> This section tracks phases; ABOUT_MATH tracks knowledge.

### Phase 0 — Foundation ✅ (2026-09-03)

- [x] Extract `data.wak` via the official unpacker (`noita.exe -wizard_unpak`); dev build present in the install.
- [x] Study noita-tools' reconstructed code (`noita_random.cpp`, `wang/wang.cpp`, `stb_hbwang.h`, Map InfoProviders) — fully documented in `ABOUT_MATH.md`.
- [x] Run noitool's reconstruction headless (prebuilt `noita_random.wasm`; local rebuild via `tools/zig` deferred until patching is needed).
- [x] Build the diff bench: `mapgen/` (lib + pipeline + dated experiments) — generates wang layers, fetches the capture, scores chunk-by-chunk, HTML report.
- [x] Validate our wasm usage against noitool's own fixtures (28/28 byte-identical) — a consistency check vs noitool, **not** vs the game.
- [x] Generate + compare many chunks (not just one Mines tile) — **key finding**: noitool's wang output is statistically unrelated to the game's terrain (below the gen-vs-gen noise floor), and the capture is ~24 pts denser than any raw wang layer (non-wang layers: walls/scenes/edges).
- [~] Ghidra — deliberately deferred; cheaper oracles first (wang_gen.exe, in-game Lua RNG oracle). Fallback only.
- [~] Decode the biome atlases — **done** (corner-type herringbone, header in the last 9 RGB bytes of row 0, all 31 configs verified); not an original roadmap item but a major unlock.

### Phase 0.5 — Open the black box (current focus, 2026-09-03 →)

The wang *rules* are solved; the unknown is **how the game picks the corner colors**. Ordered by cost:

- [x] **`wang_gen.exe`** — inspected + template diff (2026-09-03): it's the *template generator* (artist canvas, no seed, no fill). Confirmed library lineage and validated our atlas walk against it (dims/header/72h+72v enumeration identical); found+fixed a missing variants loop in our port. Builder confirmed to live in `noita.exe` → next oracle below.
- [x] **In-game RNG oracle** — BUILT + RUN (2026-09-03 night): probe mod dumps truth tables; crosscheck found a signedness bug in our JS port (fixed) and now matches the game **100.00% across 4 seeds / 2.1M draws**. The RNG component is game-verified; remaining unknown = how the fill consumes the numbers (next: oracle-driven fill sweep).
- [ ] **Read noitool's `MapGen` post-processing** (`finalize`, `fillC0ffee`, `fillBlockedRooms`, `doCoalMineHax`…) — defines what the wasm output actually contains.
- [ ] **Wang-only ground truth** — quantify the non-wang share of the capture per biome (biome XMLs: PixelScene probabilities, BitmapCaves, edge noise) or probe with the dev build, so the metric stops being confounded.
- [ ] **Community ask** — pudy248 / kaliuresis / `#mod-development` may already know the fill seeding.
- [ ] **Tier-2 wasm knobs** (fork noita-tools + `tools/zig`): discarded-rows `k`, RNG skip constant, rep-reduction on/off.
- [ ] **Ghidra, targeted** — only for the specific function that remains unexplained.

### Phase 1 — Map Generation Engine

- [x] Add noita-tools as a git submodule (`vendor/noita-tools`).
- [~] Tile generation — bench-level done (`mapgen/pipeline/2-generate.mjs`, chunk-on-demand by `(seed, biome-map px)`); server endpoint pending until the builder is faithful.
- [~] Coordinate mapping — implemented + fitted (`mapgen/lib/coords.mjs`); alignment proven **not** to be the blocker; world-px crop semantics correct.
- [ ] Render a viewport of generated tiles with OpenSeadragon.
- [ ] Validate generated output live against the game.

### Phase 2 — Reverse-Engineering Loop

- [~] Mismatch database — embryonic: `mapgen/out/stats.json` + per-chunk scoring + noise-floor calibration; no persistent DB yet.
- [ ] Use Ghidra + AI to decompile the specific Noita functions causing mismatches (fallback — see Phase 0.5).
- [ ] Reconstruct missing logic and validate against the game.
- [ ] Focus areas (updated 2026-09-03): vertex-coloring scheme, non-wang layers (walls/scenes/edges), pre-placement ruleset (`blockedColors`, `coalmine_hax`), terrain-dependent spawns (deprioritized — not needed for visual terrain).

### Phase 3 — Livemap Integration

- [ ] Use the live seed from mod telemetry as the map seed.
- [ ] Render the live player position on the generated map.
- [ ] Add `?seed=...` URL parameter for shareable seed views.
- [ ] Define fallback behavior for incomplete/failed generation.

### Phase 4 — Seed Prediction Overlays

- [ ] Integrate noita-tools WASM for fungal shifts, shops, perks, LC/AP recipes.
- [ ] Render prediction markers on the generated map.

### Phase 5 — Scale & Polish

- [ ] Tile caching and incremental generation.
- [ ] Support additional biomes and game modes if feasible.
- [ ] Document accuracy limitations and credit sources.

---

## ❓ Open questions

1. **Workshop mod ID:** When published, the mod-data folder name will be the Workshop ID rather than `noita-live-map`. Should the bridge auto-detect the folder, or should we accept a config value?
2. **Map viewer hosting:** Do we want the map viewer to open automatically in a browser window, or run as a standalone Electron/Tauri app later?
3. **Save slot support:** Noita has multiple save slots (`save00`, `save01`, ...). Should the bridge support switching slots, or hardcode `save00` for the MVP?
4. **Tile generation hosting:** Should generated tiles run client-side (WASM) or server-side (Node/Python)? Starting server-side for debugging.
5. **Accuracy tolerance:** What level of mismatch is acceptable before falling back to captured tiles? Update 2026-09-03: the bare-wang-vs-capture comparison is confounded by non-wang layers (~24% density gap) — "acceptable mismatch" can only be defined once the full layer stack (wang + walls/scenes/edges) is modeled or a wang-only ground truth exists.

---

## Tech stack recap

| Layer              | Tech                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| Noita mod          | Lua 5.1                                                                |
| Local bridge       | Node.js + `ws` + `chokidar`                                            |
| Map viewer         | Forked noitamap (TypeScript + OpenSeadragon) served inside Vite        |
| Map generation     | noita-tools C++ / WASM, Ghidra for targeted Noita binary decompilation |
| Seed predictions   | noita-tools WASM / InfoProviders                                       |

---

## Credits

- Map viewer powered by [noitamap](https://github.com/acidflow-noita/noitamap) by acidflow / WUOTE (GPL-3.0).

---

## License

GPL-3.0 (inherited from the noitamap fork).
