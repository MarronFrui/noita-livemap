# diff — run1b vs stitch_probe (different worlds (seeds differ): identical chunks are seed-independent regions)

- run1b: seed 78633192, stitch_probe: seed ?
- world rect: -3072, -1536, 6656, 3072

## Global
- identical pixels: 100.000%
- mean per-channel diff: 0.000
- diff histogram (per-pixel RGB L1): =0: 100%  <=6: 100%  <=15: 100%  <=60: 100%  >60: 100%

## Chunks
- fully stable chunks (>=99.9% identical): 171 / 171
- heavily changed chunks (<50% identical): 0
- top-10 changed:
  chunk_-6_-3: ident=100% mean=0 p99=0 max=0
  chunk_-5_-3: ident=100% mean=0 p99=0 max=0
  chunk_-4_-3: ident=100% mean=0 p99=0 max=0
  chunk_-3_-3: ident=100% mean=0 p99=0 max=0
  chunk_-2_-3: ident=100% mean=0 p99=0 max=0
  chunk_-1_-3: ident=100% mean=0 p99=0 max=0
  chunk_0_-3: ident=100% mean=0 p99=0 max=0
  chunk_1_-3: ident=100% mean=0 p99=0 max=0
  chunk_2_-3: ident=100% mean=0 p99=0 max=0
  chunk_3_-3: ident=100% mean=0 p99=0 max=0

- chunk mean-diff map: chunkmap.png; per-pixel heatmap: diff-heatmap.png
