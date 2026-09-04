# Predetermined (seed-independent) zones — Noita main world

Purpose: these zones do NOT depend on the world seed. They are useful for
reverse engineering because they give free registration anchors, pipeline
tripwires, and exclusion zones for wang-model scoring.

Evidence:
- Biome map: `data/biome_impl/biome_map.png` + `_biomes_all.xml`
  (1 map px = 1 chunk = 512 world px; x=0 at map center, y=0 at
  `biome_offset_y=14`; world chunk (cx,cy) = biome px (cx+35, cy+14)).
- 3-way pixel diff of adjacent seeds 78633191 (noitamap ref stitch),
  78633192 (`mapcap/out/run1b`), 78633193 (`mapcap/out/run2`), all parallax
  off. Overlap window: world chunks cx -5..10, cy -2..3 (25.2M px).
- `mapcap/out/run1b_vs_ref78633191/`, `run2_vs_ref78633191/`, `run1b_vs_run2/`.

## Measured 3-way decomposition (overlap window)

- 27.3% of all px: black background (background disabled) — seed-independent by construction.
- 48.0%: foreground identical in ALL 3 pairs — seed-independent content.
- 17.9%: two seeds agree, third differs (split evenly 5.5/6.5/5.8% across
  which-seed-differs) — small-variant-pool choices (hypothesis: seeded pick
  among a few variants, e.g. randomMaterials / scene variants). RE target.
- 6.8%: all three differ — high-entropy wang detail.
- Per-row (fg = non-black): sky row cy=-2 97.9% stable; surface cy=-1 72.9%;
  Mines cy=0 47.3%; cy=1 60.0%; Holy Mountain cy=2 95.1%; Coal Pits cy=3 55.1%.

## The zone list (main world bands, biome rows j; cy = j-14)

| Zone | Biome rows | Composition | Seed-independence | Role in RE |
| --- | --- | --- | --- | --- |
| Sky / void | j=1..13 (cy -13..-1) | hills*, mountain_tree, winter, desert (parallax silhouettes) | black with background disabled; BUT contains seed-text overlay → mask | registration zero-point; tripwire (must be black) |
| Spawn surface band | j=12..14 | mountain_left/right/top/tree/lake, hills, coalmine(small) | mostly fixed scenes; measured 47-98% stable | near-spawn anchors |
| **Holy Mountain bands** | j=16, 19, 23, 26, 30, 34 (+temple_wall_ending j=39) | temple_wall, temple_altar_left/right, solid_wall | ~95% measured (cy=2); template biomes, NO wang | **best anchors**: pixel landmarks for cross-capture alignment; exclude from wang scoring |
| solid_wall rows | interleaved with all bands | flat solid fills | seed-independent fills | tripwire; exclude from wang scoring |
| Lava bands / The Work | j=40..42 | lava_90percent, lava, solid_wall | template-dominated (verify) | bottom-of-map anchor |
| Mines | j=14..15 | coalmine(+alt), liquidcave, orbroom_07, lavalake | WANG: 47-60% stable, ~11-12% all-3-distinct | wang scoring target |
| Coal Pits | j=17..18 | excavationsite, fungicave | WANG: 55% stable, 15.7% all-3-distinct | wang scoring target |
| Snowy Caverns | j=20..22 | snowcave(+tunnel/secret) | WANG (expected) | wang scoring target |
| Hiisi Base | j=24..25 | snowcastle | WANG (expected) | wang scoring target |
| Vault (rainforest bands + vault) | j=27..29, 31..33 | rainforest(_open), vault | WANG (expected) | wang scoring target |
| Temple of the Art | j=35..39 | crypt, boss_arena, wandcave, wizardcave | WANG (expected) | wang scoring target |
| The End / hell top | j=43..47 | the_end, solid_wall, lava | mixed | bottom anchor |

Special single-chunk biomes (likely fixed rooms, verify individually):
`orbroom_07/08`, `boss_arena(_top)`, `wizardcave_entrance`, `alchemist_secret`,
`potion_mimics`, `biome_darkness`, `sky_light_injector`, `snowcave_secret_chamber`,
`friend_1/2`, `meat`, `wandcave`.

## Known pollution sources

- The noita-mapcap mod bakes a "Noita - Build ... - Seed: N" text overlay into
  every capture at a fixed screen offset (sky area). Median blending removes it
  in overlap zones; single-coverage tiles keep it. Mask when diffing.
- Parallax background (hills silhouettes, sky bands) is CAMERA-dependent, not
  seed-dependent: with background disabled it is black (clean); if enabled,
  tile overlaps disagree ~80% there. Keep `disable-background` ON for captures.
- Reference stitch (78633191) was captured on build 2024-08-12; in-game
  captures (78633192/93) on build 2025-09-25. Cross-build diffs carry that
  caveat; the 92↔93 pair is the cleanest adjacent-seed pair.

## Use in the wang-model iteration ladder

1. Determinism gate (goldens).
2. Spawn equations (paint-immune judge).
3. Divergence calibration: our generator's adjacent-seed foreground divergence
   should match the game's (26.5% for 91↔92; HM bands must come out 100% stable).
4. Geometry IoU scored ONLY in wang bands, excluding everything above.
