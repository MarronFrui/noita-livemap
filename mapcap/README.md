# mapcap/ — Capture-based ground truth & seed-differential analysis

Tools for slicing, analyzing, and diffing `noita-mapcap` captures of real Noita
worlds. This is the capture half of the map-gen reverse engineering: `mapgen/`
generates worlds from a seed and compares them to captures; `mapcap/` makes
captures comparable to each other and establishes which parts of a captured
world are seed-dependent at all.

Established (2026-09-04): pixel-stability of the capture pipeline, real
wang-generation seams, seed-independence of template biomes (Holy Mountain
bands), and the adjacent-seed divergence target — so the wang model can be
judged without the capture's non-wang layers poisoning the metric
(see `mapgen/ABOUT_MATH.md` §6–§7quinquies).

## Seeds and captures

| Seed | Capture name | Source | Game build | Notes |
| ---- | ------------ | ------ | ---------- | ----- |
| 78633191 | ref | noitamap built-in stitch (tiles cached in `mapgen/out/ref/`) | 2024-08-12 | project reference ("the stitch is already done") |
| 78633192 | run1, run1b | in-game noita-mapcap | 2025-09-25 | run1 parallax ON (superseded); **run1b parallax OFF = reference in-game capture** |
| 78633193 | run2 | in-game noita-mapcap | 2025-09-25 | parallax OFF; = ref+2 |

Naming, resolved once and for all: **"reference seed" = 78633191** (noitamap).
run1b = ref+1, run2 = ref+2. The in-game seed is confirmed by telemetry
(`save00/noita-live-map-telemetry.json`) and by the mod's baked-in sky text.

### Capture settings (required for comparability)

- Mod: `noita-mapcap`, area/base-layout capture, grid 512.
- Mod setting **`disable-background` = ON** (renders the parallax background
  black; every captured pixel is world-anchored). Scope is RUNTIME_RESTART —
  restart Noita after toggling.
- World rect: grid cx -6..12, cy -3..5 (world -3072,-1536 → 6656,3072), 19×9
  chunks. Keep identical across captures.
- After the area scan: run the mod's stitcher (`bin/stitch/stitch.exe`) →
  `bin/stitch/output.png` (second runs can use `output2.png` etc.).
- Raw tiles land in `mods/noita-mapcap/output/` as `<x>,<y>.png` (top-left
  world coords, 1024×1024, 512 grid → 50% overlap). New captures OVERWRITE the
  tile folder — import/analyze before the next capture.

## Tooling

| Script | What it does |
| ------ | ------------ |
| `analyze-capture.mjs` | Slice stitched image into 512px chunks + full analysis: raw-tile overlap consistency (capture stability), 512-grid seam detection (skeleton test), flat-region noise floor, per-chunk classification. Outputs `chunks/`, `manifest.json`, `analysis.json`, `report.md`, `classification.png`, `noise-heatmap.png` |
| `diff-captures.mjs` | Diff two analyzed captures: per-chunk stats, diff heatmap (= free foreground mask for same-seed pairs), chunkmap, report. Same-seed pair → cross-run noise floor; different-seed pair → seed dependence |
| `diff-vs-reference.mjs` | Diff an analyzed capture against the cached noitamap reference (seed 78633191); handles the biome-px→world-chunk mapping (ref tile `i_j` = chunk `(i-35, j-14)`) |
| `stitch-tiles.mjs` | Backup median-stitcher (WSL-side); the mod's own stitcher is authoritative — untested, unused so far |
| `PREDICTABLE_ZONES.md` | The predetermined-zone record: seed-independent zones, why they are fixed, and their roles in RE |

```bash
node mapcap/analyze-capture.mjs --name run2 --seed 78633193 \
  --stitched /mnt/e/.../mods/noita-mapcap/bin/stitch/output2.png
node mapcap/diff-captures.mjs --a run1b --b run2
node mapcap/diff-vs-reference.mjs --name run2
# re-analyze an existing chunk dir when the source stitch is gone:
node mapcap/analyze-capture.mjs --name run1b --chunks true
```

All artifacts live in `mapcap/out/<name>/` and `mapcap/out/<a>_vs_<b>/`
(gitignored).

## Verified facts (2026-09-04)

### Capture pipeline stability
- Tile convention: 1024×1024 PNGs named by the top-left world coordinate of the
  captured region; capture grid 512 with the camera centered per cell (⇒ tile
  coords ≡ 256 mod 512); 50% overlap; the stitcher median-blends overlaps.
- Three independent captures: adjacent-tile overlaps **99.6–99.7% identical**
  (mean per-channel diff 0.16–0.31). The capture pipeline introduces no
  measurable drift; foreground is pixel-stable.

### Parallax background is not world content
- With background ENABLED, overlapping tiles disagree ~80% in sky regions: the
  parallax layers (mountain silhouettes, sky bands) shift with the camera, so
  the median blend turns them into a ghost layer.
- run1 vs run1b (same seed, background on/off) differ by exactly that share:
  **67.8% identical = the foreground share**; that diff-heatmap doubles as a
  free foreground mask.
- ⇒ `disable-background` ON for every capture; mapgen comparisons use
  foreground only.

### Real wang-generation seams (the game does not blend across chunks)
512-grid seams that are identical across independent captures are content, not
stitch artifacts. Measured discontinuity vs interior baseline (both in-game
captures agree to ~0.01):
- Vertical: x=2048 (**4.6×**), x=4096 (2.4×), x=-2048/x=-1536/x=2560/x=3584 (1.6–1.7×)
- Horizontal: y=1536 (**3.6×**), y=2560 (3.1×), y=1024 (3.1×), y=512 (1.4×)
- Example: chunk boundary (4,-1)/(4,0) at world x 2048–2560, y=512: hard
  slate-over-rust material seam.
- ⇒ **Implication for our generator: do NOT blend across chunk boundaries**;
  the real game leaves hard material discontinuities in places.

### Predetermined (seed-independent) zones
- **Holy Mountain bands** (biome rows j=16, 19, 23, 26, 30, 34):
  `temple_wall`/`temple_altar*` template biomes + `solid_wall` fills. No wang
  generation → measured **95.1% seed-independent** (cy=2, three-seed test).
- Sky/void above the surface (j ≤ 13): black with background disabled.
- Full band map, zone table and roles: `mapcap/PREDICTABLE_ZONES.md`.
- Roles: cross-capture registration anchors; pipeline tripwires (any diff
  there = pipeline bug, not world gen); exclusion zones for wang scoring.

### Adjacent-seed divergence (the calibration target)
| Pair | Identical (window) | Foreground changed | Fully stable chunks |
| ---- | ------------------ | ------------------ | ------------------- |
| 91 ↔ 92 | 79.8% | **26.45%** | 13/96 |
| 92 ↔ 93 | **83.0%** | — | 37/171 |
| 91 ↔ 93 | 80.4% | — | 12/96 |

3-way decomposition (overlap window, 25.2M px):
- 27.3% black background + **48.0% seed-independent foreground**
- **17.9% two-seeds-agree-one-differs**, split evenly (5.5/6.5/5.8%) across
  which seed differs ⇒ small-variant-pool choices (e.g. seeded pick among a few
  material/scene variants), NOT avalanche RNG — an RE target in itself
- **6.8% all-three-distinct** = high-entropy wang detail
- (Class "changed in exactly 1 pair" is mathematically impossible; an early
  print mislabeled the buckets — debug-verified.)

### Cross-run noise floor (same world, two captures)
- Foreground overlap identity 99.6%+ ; flat-region high-pass luminance RMS
  **0.16/255** — the minimum detectable difference for world-static content.

### Pollution sources (mask or avoid)
- **Seed-text overlay**: the mod bakes "Noita - Build … - Seed: N" into every
  tile at a fixed screen offset. Median blending removes it in overlap zones;
  single-coverage tiles keep it. Mask when diffing sky regions.
- Vegetation sways between tile captures → scattered small diffs.
- Cross-build: ref stitch is build 2024-08-12; in-game captures are build
  2025-09-25. Cross-build diffs carry that caveat — the 92↔93 pair is the
  cleanest adjacent-seed measurement.

## Testing ladder — how mapcap feeds the wang-model iteration

1. **L0 determinism gate**: `npm test` goldens; gen twice = byte-identical.
2. **L1 spawn equations (the decisive judge)**: every seeded spawn (orb, perk,
   chest, heart) is an exact wang-cell color fact; paint-immune, so the
   capture's non-wang layers cannot poison it. Sweep fill hypotheses against
   constraints extracted from seeds 91/92/93.
3. **L2 divergence calibration**: our generator's adjacent-seed foreground
   divergence must match the game's **26.5%**; HM bands must come out 100%
   seed-independent (if not, the bug is in our layering).
4. **L3 geometry IoU in wang bands only**: air/solid after global-shift fit,
   excluding HM/sky/solid_wall zones (`PREDICTABLE_ZONES.md`).

Accept a fill-hypothesis knob only if L1 holds and L3 improves; otherwise
revert and log in the mismatch DB.
