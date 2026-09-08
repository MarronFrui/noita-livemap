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
- [x] noita-tools added as `vendor/noita-tools` submodule (now an **OBSOLETE reference** — legacy data/wasm container only)
- [x] Build helper script copies noitamap assets to `public/noitamap/`

### Map-Gen Prediction bench (`mapgen/`, 2026-09-03)

- [x] Data.wak extracted; local machine setup documented in `SESSION_CONTEXT.md`
- [x] WASM harness, biome layout parser (game-truth; noitool's maps.json used only as a now-obsolete cross-check), chunk renderer
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

Long-term goal: replace noitamap's pre-captured tiles with tiles generated on demand from any valid Noita seed. This is an original reverse-engineering project: **our own Ghidra reconstruction of `noita_dev.exe` is the authority** (see `mapgen/VERIFIED.md`). noita-tools was the starting point but is now **OBSOLETE** as a reference — never a comparison target.

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

### Phase 0.5 — Open the black box ✅ (2026-09-03 → 2026-09-08: **SOLVED**)

The wang _rules_ were solved; the unknown was **how the game picks the corner
colors — and what seeds the fill**. Resolution (evidence: `mapgen/VERIFIED.md`,
`ABOUT_MATH.md` §6+):

- [x] **`wang_gen.exe`** — template generator only; validated our atlas walk (2026-09-03).
- [x] **In-game RNG oracle** — 100.00% across 4 seeds / 2.1M draws (2026-09-03).
- [x] **Ghidra, targeted** — executed 2026-09-05→08 (mixer calibrated, fill subsystem
      read end-to-end, seeding chain decoded to asm level; ledger: `ghidra-ledger.md`).
- [x] **THE FILL SEEDING — SOLVED (2026-09-08)**: C = worldseed; GetRNG skip =
      (w%11)+(ws%12); per-attempt sub-seed = schrage^(16+A)(ws) via nextU; TLS poro
      Random; class `(i−j+1)&3`. Runtime-confirmed via Cheat Engine, then end-to-end
      verified: **12/12 direct spawn constraints across seeds 91/92/93** with unique
      early attempts; 60 wrong-seed controls never reached perfect. The 644M-candidate
      failure is explained: the injected Wang-Lab biome fills via a non-Init path.
- [ ] **Re-derive the game's `MapGen` post-processing from the binary**
      (`finalize`, `fillC0ffee`, `fillBlockedRooms`, random-material fills,
      coalmine hax…) — still open; needed for full paint layers.
      (noitool's work was very useful but is obsolete at this point of the
      project — re-derive each step from `noita_dev.exe`; its shipped hax
      code is a silent no-op due to a constant/data mismatch.)
- [~] **Wang-only ground truth** — superseded by paint-immune judging (spawn
  equations + Wang Lab answer keys).
- [~] **Tier-2 wasm knobs** — superseded: our exact JS builder (`wang-js.mjs`)
  replaces the wasm fork entirely.
- [~] **Community ask** — never needed.

**Remaining to full prediction:** hasPath emulation (which attempt is accepted —
~1–2 days), cascade spawn offsets (altar scenes; item overlays only), and the
paint layers below.

### Phase 0.6 — Capture-based ground truth ✅ (2026-09-04)

- [x] In-game capture workstream (`mapcap/`): noita-mapcap captures of seeds
      78633192/93 (parallax OFF = `disable-background`), sliced + analyzed + diffed;
      tooling: `analyze-capture.mjs`, `diff-captures.mjs`, `diff-vs-reference.mjs`
      (see `mapcap/README.md`).
- [x] Capture pipeline pixel-stable: adjacent-tile overlaps 99.6–99.7% identical
      across three independent captures.
- [x] Real wang seams found: the game does NOT blend across 512-chunk boundaries
      (x=2048 4.6×, y=1536 3.6× discontinuity) — generator must not blend either.
- [x] Predetermined zones mapped: Holy Mountain bands (j=16/19/23/26/30/34) ~95%
      seed-independent; sky/void black; `mapcap/PREDICTABLE_ZONES.md`.
- [x] Adjacent-seed divergence calibrated: **26.45% of foreground px changed**
      for 91↔92 (the L2 target); 3-way classes: 48.0% seed-independent / 17.9%
      two-agree-one-differs (small-variant pools) / 6.8% all-distinct.
- [~] Cross-run same-seed noise floor: foreground overlap 99.6%+ / flat-region
  RMS 0.16/255 measured from tile overlaps; dedicated recapture optional.

### Phase 0.7 — Wang-model iteration ladder (current focus, 2026-09-04 →)

Each level is cheaper than the next; paint-immunity increases:

1. **L0 determinism gate** — `npm test` goldens; gen twice = byte-identical.
2. **L1 spawn equations (decisive judge)** — ✅ **PASSED for direct triggers
   (2026-09-08)**: 12/12 heart/chest constraints across seeds 91/92/93 with
   chain-derived fills, unique attempts, consistent anchor; cascade classes
   (potions) await the altar-scene offset model.
3. **L2 divergence calibration** — our generator's adjacent-seed foreground
   divergence must match the game's 26.5%; HM bands must be 100% seed-independent.
4. **L3 geometry IoU in wang bands only** — air/solid after global-shift fit,
   excluding HM/sky/solid_wall zones (`mapcap/PREDICTABLE_ZONES.md`).

Accept a knob only if L1 holds and L3 improves; else revert + log to the
mismatch DB.

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

- [ ] Integrate seed-prediction features (fungal shifts, shops, perks, LC/AP recipes) — implement from the game binary / data (noitool WASM is obsolete as a source).
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

| Layer            | Tech                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| Noita mod        | Lua 5.1                                                                |
| Local bridge     | Node.js + `ws` + `chokidar`                                            |
| Map viewer       | Forked noitamap (TypeScript + OpenSeadragon) served inside Vite        |
| Map generation   | Our own Ghidra-derived JS port (`mapgen/lib/*`), Ghidra for targeted Noita binary decompilation |
| Seed predictions | Own reconstructions (noitool WASM/InfoProviders = obsolete)                              |

---

## Credits

- Map viewer powered by [noitamap](https://github.com/acidflow-noita/noitamap) by acidflow / WUOTE (GPL-3.0).

---

## License

GPL-3.0 (inherited from the noitamap fork).
