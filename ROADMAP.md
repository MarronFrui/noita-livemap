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
{"seed": 1296487564, "x": -1356, "y": 5630, "biome": "Coal Pits", "ts": 1712345678}
```

Default write path:
```
%LocalLow%/Nolla_Games_Noita/save00/mod_data/noita-live-map/noita-live-map-telemetry.json
```

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

---

## 🚧 After MVP

### Live marker on the map
- [ ] Convert telemetry coordinates to noitamap viewport coordinates
- [ ] Render a player marker inside the noitamap iframe or overlay
- [ ] Optionally pan the map to follow the player

### Fungal shift integration
- [ ] Link to or embed the existing fungus solver
- [ ] Later: port noita-tools WASM fungal-shift logic for offline/local use

### Quality-of-life
- [ ] Configurable telemetry write rate
- [ ] Configurable bridge port / file path (env vars or config file)
- [ ] WebSocket reconnect logic
- [ ] Better error reporting in the UI when Noita/bridge is not running
- [ ] Remove/copy less of noitamap (currently copies entire `public/` build output)

### Distribution
- [ ] Package the Node bridge as a single executable or simple `npm start` flow
- [ ] Publish the mod to Steam Workshop
- [ ] Decide whether to bundle the map viewer or keep it as a separate local web app

---

## ❓ Open questions

1. **Workshop mod ID:** When published, the mod-data folder name will be the Workshop ID rather than `noita-live-map`. Should the bridge auto-detect the folder, or should we accept a config value?
2. **Map viewer hosting:** Do we want the map viewer to open automatically in a browser window, or run as a standalone Electron/Tauri app later?
3. **Fungal shift solver scope:** Start with a simple linkout, or do we want the solver UI embedded from the beginning?
4. **Save slot support:** Noita has multiple save slots (`save00`, `save01`, ...). Should the bridge support switching slots, or hardcode `save00` for the MVP?

---

## Tech stack recap

| Layer | Tech |
|---|---|
| Noita mod | Lua 5.1 |
| Local bridge | Node.js + `ws` + `chokidar` |
| Map viewer | Forked noitamap (TypeScript + OpenSeadragon) served inside Vite |
| Seed predictions | noita-tools WASM / fungus solver (future) |

---

## Credits

- Map viewer powered by [noitamap](https://github.com/acidflow-noita/noitamap) by acidflow / WUOTE (GPL-3.0).

---

## License

GPL-3.0 (inherited from the noitamap fork).
