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

- [x] Data.wak extracted; local machine setup documented in `AGENTS.md`
- [x] WASM harness, biome layout parser (game-truth; noitool's maps.json used only as a now-obsolete cross-check), chunk renderer
- [x] Capture fetcher (noitamap CDN, seed 78633191, DZI→512px chunks, cached)
- [x] Diff/report pipeline (per-chunk scores, heatmap, side-by-sides, noise-floor calibration)
- [x] Biome atlas format fully decoded (corner-type herringbone; hidden binary header)
- [x] JS port of the corner-mode builder with pluggable RNG (`mapgen/lib/wang-js.mjs`)
- [x] Experiments: transform fit, anchor sweep, positional sweep — all negative; evidence in `ABOUT_MATH.md` §6
- [x] Tests: determinism, seed sensitivity, golden hash (`npm test`)

### Generated-map pipeline (2026-09-08 →, evolution of the bench)

- [x] Exact JS wang fill (`generate-exact.mjs` + `wang-js.mjs`) — replaces the
      obsolete wasm for the live pipeline; prediction-solved end-to-end
      (chain → fill → hasPath; oracle-validated; `VERIFIED.md`).
- [x] Genmap MVP: `world-gen.mjs` (all wang areas + disk cache
      `gen-cache/<rev>/<seed>/*.bin`, manual revision bump r3c→r3d) +
      `server/genmap-server.mjs` (tile server :8082, `npm run gen:server`) +
      `public/genmap.html` canvas viewer (`?seed=`, live telemetry marker,
      follow toggle, zones overlay, regen button).
- [x] Cache invalidation tooling: `npm run gen:clear [-- --seed N]`,
      `/gen/clear/:seed` + `epoch` busting in the viewer.
- [x] Coloring layer (`colorize.mjs`: random-block floods, trigger→air,
      material shades, grey-fill fBm; I8 single-material lake fix landed).
- [x] Spliced pixel-scene blits (`template-render.mjs`): tree, mountains,
      boss arenas, moon/dark-moon, HM-band art — validated pixel-shape-exact
      vs capture.
- [x] Test battery: vitest in `tests/` (13 files / 142 tests, 2026-09-18;
      data-dependent suites auto-skip).
- [x] Issue registry phase ("purification"): all known defects enumerated as
      I1–I17 in `mapgen/ISSUES.md` with per-issue status; governance rules:
      binary-derived constants must be registered in `mapgen/CONSTANTS.md`
      (2026-09-19), remaining noitool-provenance code is tagged `@prov
      noitool` inline.

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

**Remaining to full prediction (statuses from `mapgen/VERIFIED.md` §11 +
`mapgen/ISSUES.md`):**

- [x] **hasPath emulation — done** (2026-09-18 port rewrite, oracle 4/4
      after rewrite; 8/8 previously): 11-entry blocked-marker table, hax
      constants corrected and active. In-binary location: hasPath =
      FUN_00901780.
- [~] **`MapGen` post-processing** — located in-binary (F2 dig §1–§5,
      `ghidra-ledger.md`); `fillMainPath` / `fillC0ffee` /
      `fillRandomMaterials` / `ClearPath` / room-growth ray-walk
      semantics remain noitool-derived approximations (`@prov noitool`,
      oracle-pinned) until re-derived from the binary. Open queue under F2.
- [~] **Wang↔world anchor story** — genmap's fitted (3,3) anchor suspect
      to be a port artifact: the Init grid walk sizes the area grids
      `[chunkExtent·512]÷10` with no additive constant (2026-09-19 read,
      `CONSTANTS.md` C9–C11); closure needs the values-write read.
- [~] **Cascade spawn offsets** (altar scenes; item overlays) — pending
      the offset model.
- [~] **Paint layers below** — coloring layer shipped (approximation);
      exact grey-band noise = open (I1).

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

1. **L0 determinism gate** — ✅ `npm test` goldens; gen twice = byte-identical.
2. **L1 spawn equations (decisive judge)** — ✅ **PASSED for direct triggers**
   (2026-09-08): 12/12 heart/chest constraints across seeds 91/92/93 with
   chain-derived fills, unique attempts, consistent anchor; cascade classes
   (potions) await the altar-scene offset model.
3. **L2 divergence calibration** — instrument ready (mapcap adjacent-seed
   pairs, target = the measured 26.5% foreground class); **not yet passed
   by the exact-model generator** (re-run pending the F2/F-anchor items).
4. **L3 geometry IoU in wang bands only** — instrument ready (foreground
   masks from mapcap); pending F2 completion + anchor closure.

Accept a knob only if L1 holds and L3 improves; else revert + log to the
mismatch DB. Current work ordering follows the dependency-ranked frontier in
`mapgen/VERIFIED.md` §11 (F-anchor → F2 → F4 → F3; details in Phase 2
below).

### Phase 1 — Map Generation Engine

- [x] noita-tools vendored as a git submodule (`vendor/noita-tools`) —
      since demoted to an **obsolete reference** (data container only).
- [x] **Genmap tile server shipped** (`genmap-server.mjs` :8082; per-seed
      disk cache with manual revision bump + `/gen/clear` tooling). The
      wang layer renders for arbitrary seeds (cold-validated 2026-09-08:
      seed 999123, 57 areas in ~25 s).
- [~] Template/procedural layers — predictable-zone spliced scenes +
      HM-band art render (pixel-exact shapes vs capture); full surface/
      sky terrain requires the poro-noise reconstruction (I1/I3, = F3).
- [x] Coordinate mapping — implemented + capture-validated; chunk↔tile
      mapping exact; the (3,3) wang-cell anchor is pending closure via
      the Init values-write read (suspected port-local constant).
- [ ] Render a viewport of generated tiles with OpenSeadragon (current
      genmap viewer is a plain canvas; noitamap iframe still serves the
      captured DZI).
- [ ] Validate generated output live against the game (in-game playtest
      pass reported for the reference seed: shape-correct everywhere;
      systematic re-validation pending L2/L3).

### Phase 2 — Reverse-Engineering Loop

Current authority documents: `mapgen/VERIFIED.md` (canon + lifecycle §11 +
ranked frontier), `mapgen/ISSUES.md` (I1–I17 defect registry),
`mapgen/ghidra-ledger.md` (binary dig history), `mapgen/CONSTANTS.md`
(constant registry — the standing rule: register before use).

- [x] Binary digs — fill subsystem read end-to-end (ledger h33–h35, h46+);
      finalize family located (F2 dig §1–§5); runtime streaming side read
      (F1 closed: chunk materialization reads Init-built grids, never
      regenerates; pixel-scene arm fully read).
- [~] Finalize semantics — `fillBlockedRooms`/`fillC0ffee`/`ClearPath`/
      `fillRandomMaterials`/ray-walk room growth: located in-binary, still
      noitool-derived in the port (`@prov noitool`) — F2 queue: blockOutRooms
      ray-walk first, then ClearPath/C0ffee. The isCoalMine /
      shouldBlockOutRooms selection rule is UNDETERMINED in-binary
      (2026-09-19 data-audit note, `ISSUES.md`).
- [~] The fill's copy-out walk + perlin core (FUN_008fca60 constants) —
      leads recorded, unread; on-target reads must pin via
      `CONSTANTS.md` (slab = true − 0x400800; C13).
- [ ] Mismatch database — scores land in `mapgen/out/stats.json` +
      `mapgen/out/report.html` (bench) and mapcap reports; a persistent
      DB is still pending (embryonic).
- [ ] Focus areas (superseded by the frontier order in `VERIFIED.md` §11,
      2026-09-18): (1) F-anchor — read FUN_008e6d50 / values-write walk;
      (2) F2 remainder — exact finalize semantics; (3) F4 — engine debug
      flags (potential in-game wang-only ground truth); (4) F3 — poro
      perlin noise terrain (unblocks I1/I3/I5/I6). Terrain-dependent
      spawns remain deprioritized (not needed for visual terrain).

### Phase 3 — Livemap Integration

- [~] Use the live seed from mod telemetry as the map seed — **shipped in
      the genmap viewer** (live button loads the current run's seed from
      the bridge, auto-jumps to the player); the noitamap iframe still
      serves captured tiles.
- [x] Render the live player position on the generated map (genmap
      viewer: marker + follow toggle).
- [ ] Add `?seed=...` URL parameter for shareable seed views — genmap
      supports `?seed=`; integration into the noitamap iframe view open.
- [ ] Define fallback behavior for incomplete/failed generation (current
      behavior: no-attempt areas render black and are marked in the
      zones overlay; the lake/rainforest_dark no-acceptance families are
      I13/ISSUES tracked).

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
5. **Accuracy tolerance:** What level of mismatch is acceptable before falling back to captured tiles? Update 2026-09-03: the bare-wang-vs-capture comparison is confounded by non-wang layers (~24% density gap) — "acceptable mismatch" can only be defined once the full layer stack (wang + walls/scenes/edges) is modeled or a wang-only ground truth exists. Update 2026-09-18: capture-side divergence statistics (26.5% foreground class, 3-way classes) now define the calibration targets, and F4's engine debug flags are the located-but-unprobed candidate for an in-engine wang-only ground truth.

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
