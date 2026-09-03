# Noita Livemap

A local, live interactive map for [Noita](https://store.steampowered.com/app/881100/Noita/). It is a fork of [acidflow's noitamap](https://github.com/acidflow-noita/noitamap) that shows your live player position on the world map at all times.

![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)

## How it works

```
Noita Lua mod  →  telemetry JSON  →  Node bridge  →  frontend  →  noitamap iframe
```

1. **Noita mod** (`mods/noita-live-map/`) writes your seed, biome, and `(x, y)` position to a JSON file in your Noita save folder about 10 times per second.
2. **Node bridge** (`bridge/`) watches that file and broadcasts updates over WebSocket.
3. **Frontend** receives the telemetry, displays it, and drives a red player marker inside the embedded noitamap iframe. The Vite dev server is used during development; the final deliverable will be a standalone app.

## Quick start

### Requirements

- Noita with unsafe mods allowed (the mod writes directly to the save folder).
- Node.js installed.

### Install

```bash
npm install
cd bridge && npm install
cd ../vendor/noitamap && npm install && npm run build
cd ../..
npm run copy:noitamap
```

### Run

In WSL, the bridge needs polling because `/mnt/c/...` does not forward file-change events:

```bash
# Terminal 1
npm run dev:bridge

# Terminal 2
npm run dev
```

Then open `http://localhost:5173/` in your browser.

## Controls

- **Live Telemetry panel** — shows current seed, biome, and position; click `−` to collapse.
- **Center on player** — pans the map to your position.
- **Follow player** — re-centers the map every 2 seconds while enabled.

## Project structure

```
.
├── bridge/              # Node bridge: file watcher + WebSocket broadcaster
├── mods/noita-live-map/ # Noita Lua telemetry mod
├── public/noitamap/     # Built noitamap assets (copied from vendor/noitamap/public)
├── scripts/             # Build helpers
├── src/                 # Vite frontend
├── vendor/noitamap/     # Forked noitamap submodule
└── ROADMAP.md           # Planned features and open questions
```

## Planned features

- **Fungal shift solver** — integrate [liquidcake's fungus solver](https://pub.colonq.computer/~liquidcake/fungus/) for seed-specific fungal shift predictions.

See `ROADMAP.md` for more details and open questions.

## License

GPL-3.0, inherited from the noitamap fork.
