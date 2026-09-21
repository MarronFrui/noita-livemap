# SURFACE_AUDIT.md — the honest state of the surface band (2026-09-21)

> Written after the user's verdict: the genmap render = "a cloud of noise
> pixels, almost homogeneous; the surface is obviously dense on the floor
> and only air in the air; no pyramid walls, no watchtower, no mountain at
> spawn". The coloring indicates the right pixels (sand in the desert,
> ice in the frozen depths) — the colorize layer is fine; the SHAPE lane
> is not. This file records the audit verdict, the two real defects, the
> revert, and the cleanup-session contract.

## 1. The audit verdict

**The user's central claim is byte-confirmed: the surface's visible
content is a different lane we never wired.** The hills/desert band's
player-visible terrain (the mountain at spawn, the pyramid walls, the
watchtower, the HM band) is NOT the F3 noise field, and it is NOT the
caves field either — it is the game's own **per-chunk `init()`
pixel-scene art**:

- `mountain/mountain_left.lua:10`:
  `LoadPixelScene("data/biome_impl/mountain/left.png", ..., x, y, ..., true)`
- `pyramid_left.lua:28-29`: `left_bottom.png` at `(x, y + 512)`,
  `left.png` at `(x, y)`
- `pyramid_right.lua`: `right.png` at `(x, y)`, `right_bottom.png` at
  `(x + 512 − 61, y + 512)`
- `pyramid_top/entrance/hallway`: the same form.
- The count across `data/scripts/biomes/*.lua`: **238 LoadPixelScene
  calls**, each keyed on the chunk's own world origin (`x, y` from the
  per-chunk `init` at 0xffffeedd), every piece a seed-independent fixed
  art file.

So the fix for the whole "no mountains/pyramid/watchtower" family = a
**pixel-scene port lane**: sweep the 238 callsites, parse each `init()`
block's `{png, visual, background, x-offset, y-offset}`, and blit per
chunk — the exact mechanic the Spliced-Scenes lane already uses for
boss_arena/tree/moon (which DID render pixel-exact vs capture, per
I9-STRUCTURAL-FIXED). This is a data-side port (no reverse
engineering), gated only on reading the Lua init() call-shapes.

## 2. The two defects this week's wiring produced

**Defect A (dig #31): the caves-field lane went into the DEFAULT
render.** The byte status of the caves-field core is "byte-exact
primitives, FLAGGED placement composition" — and the standing mandate
(ISSUES.md's no-guessing rule) says a flagged model never ships in the
default lane. Wiring it in made the hills band render the model's
speckle (the "cloud of noise pixels") where the band's real art lane
belongs. REVERTED same day: the lane is back to `SURFACE_V3=1` opt-in;
the cache bumped r3i → r3j; the honest state (the template painter
only) restored until the pixel-scene lane lands.

**Defect B (pre-existing, found by the audit): the noise branch of the
renderer never ran at all.** `worldColorAt` calls
`world.noiseSolidAt?.(wx, wy)` but `attachNoiseTerrain` only attached
`world.noiseAt`; `noiseSolidAt` was an exported free function and
nothing attached it onto the world. Fix (kept):
`attachNoiseTerrain` now also attaches
`world.noiseSolidAt = (wx, wy) => noiseSolidAt(world, wx, wy)`.

## 3. What stands vs what is debt

### Verified byte-solid and KEPT
- The noise cores (C25/C30 simplex/lattices) + the surface-evaluator
  FINAL-combine (dig #22, byte-cited) — they feed the C34 sampler
  chain, not the render decision.
- The caves-field primitives: fn C1's all-1.0 base bake; the C27 ctor
  chain; the ×5·w toucher (C48); the (43)(a) falloff incl. the
  (y/25)⁸ eave; the C50 strength-knob interp. All valid byte-decodes.
- The C49 in-run confirmations ([P+0x8c] = the raw worldseed; the
  strength pair (1.549988, 0.0) identical across both seeds; the
  0x132aae8 cache's RBTree layout with the CaveStructure
  file-pattern keys; the A-resolver fn = 0x008EE1B0).
- The BitmapCaves XML extraction (the knobs + structures family;
  `biomes.mjs` parses it and the values match hills.xml).

### Debt / status-corrected
- The caves-field lane's PLACEMENT order = a model (the chain walk,
  blob/y locks, mountain placements: flagged, not byte-read); density
  measured 7% vs the oracle's ~50%; the deep-end strength values and
  the walk's step roll = the named sub-reads (ABOUT_MATH (49)/(50)).
  NOT game-ready; opt-in only until the fnB per-phase block read
  completes.
- The dig-#24 "surface noise band lives at biome rows 0..2" emphasis
  was correct in the sampler frame but MISLEADING as a plan: the
  visible band's content = the pixel-scene shapes, not noise cells.
- The per-cell two-tone `noiseColor` palette did not route the cell
  values through the per-cell material picker (the colorize layer's
  materials.xml path stays the known separate pass).

## 4. The surface band's REAL layer model (byte-confirmed from the game's own Lua/data)

1. **The static pixel-scene lane (the majority of the player-visible
   surface)**: per-chunk `init` → `LoadPixelScene(png, visual, x, y,
   background, true)`; the origin = the chunk's own world px + the
   per-call offset. Families verified on disk:
   - mountain: left/right/top/center(+entrance), hall family, the
     floating island = THE SPAWN MOUNTAIN
   - pyramid: left/right/top/hallway/entrance/reward/boss_limbs = the
     pyramid walls
   - desert: its own init = `parallel_check` only ⇒ the desert's shape
     = the noise terrain + the buried pyramid pieces
     (`skull_in_desert.xml` = a spliced piece)
   - the watchtower, lake_statue, watercave, mountain_lake, tree,
     moon(+dark), boss arenas, gourd, lavalake(pit) — the SPLICE_PNGS
     list covers 11 of these already.
2. **The cave-field lane** (the F3 noise band, the thing we wired):
   the hills/desert family's underground carves — the C34's chain per
   cell; the field value stream byte-anchored at the C44/C48
   BitmapCaves generator stack; the placement composition = the digs
   #26–#29 sub-reads (NOT byte-final).
3. **The wang fills** = the main-band chunk list (landed long ago).

The week's lesson: the surface band's visible terrain is FIRST the
pixel-scene art lane; the cave-field/noise fill belongs BELOW that art
layer, not instead of it. The pixel-scene port is the cleanup
session's first work item.

## 5. The cleanup-session contract (ordered)

1. **The pixel-scene port** (the I1/I2 mountains/pyramid/watchtower —
   a data-side read, no RE): parse the biome `init()` LoadPixelScene
   call tables from `data/scripts/biomes/**` (238 sites; the
   mountain + pyramid families ~56 of them), each with its
   `{png, visual, background, x-offset, y-offset}` args, into
   `template-render.mjs` (or a new `pixel-scene-render.mjs`) keyed by
   the (biome, chunk) origin = the CHUNK's own world corner plus the
   lua offsets. The banker = the Spliced-Scenes blit (I9's pixel-exact
   vs capture). Validation = directly vs the capture (the surface
   band's pixels = ~95%+ seed-independent per PREDICTABLE_ZONES.md).
2. Then the caves-field lane's byte-final read (fnB per-phase block
   bodies: the placement/order + the deep-strength worm lanes) and the
   instrument compare under SURFACE_V3=1 (opt-in) until byte-verified.
3. The A-resolver body read (`0x8EE1B0`) + the material-identity
   table (the C32 config side) = the per-cell material lane.
4. The noise fill = after 1: the pixel-scene stamps become the
   primary source; the leftover un-art'd cells = the caves field's
   byte-exact core + the C50 consumer model rides on it.

## 6. Artifacts confirmed on disk during this audit
- `data/scripts/biomes/**` — 238 LoadPixelScene callsites.
- `data/biome_impl/mountain/` (left/right/top/hall/inside_* pngs),
  `data/biome_impl/pyramid/` (left/right/top/hallway/entrance/
  reward/boss_limbs pngs).
- `lib/template-render.mjs` — the blit mechanic live (SPLICE_PNGS:
  boss_arena @1536,12288, tree @−2048,−1324, the moon family, 11
  pieces, all pixel-exact vs capture per the I9 fix).
