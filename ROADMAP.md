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
- [x] Build helper script copies noitamap assets to `public/noitamap/`

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

### Phase 0 — Foundation

- [ ] Set up Noita dev build and extract `data.wak` via the official modding tools.
- [ ] Install Ghidra and load `noita.exe` for targeted decompilation.
- [ ] Study noita-tools' reconstructed code (`noita_random.cpp`, `wang/wang.cpp`, Map InfoProviders).
- [ ] Build the `noita_random.wasm` module locally.
- [ ] Generate one Mines biome tile for a known seed and compare it to an in-game capture.

### Phase 1 — Map Generation Engine

- [x] Add noita-tools as a git submodule (`vendor/noita-tools`).
- [ ] Build a local tile-generation endpoint (start server-side for easier debugging).
- [ ] Implement coordinate mapping between Noita world space and tile space.
- [ ] Render a viewport of generated tiles with OpenSeadragon.
- [ ] Validate generated output live against the game.

### Phase 2 — Reverse-Engineering Loop

- [ ] Maintain a mismatch database (seed, biome, coords, expected vs actual).
- [ ] Use Ghidra + AI to decompile the specific Noita functions causing mismatches.
- [ ] Reconstruct missing logic and validate against the game.
- [ ] Focus areas: Wang → game-space mapping, pixel-scene placement, biome transitions, terrain-dependent spawns.

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
5. **Accuracy tolerance:** What level of mismatch is acceptable before falling back to captured tiles? To be determined after Phase 0.

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
