# diff — run1 vs run1b (same world (recapture): diffs measure cross-run temporal noise)

- run1: seed 78633192, run1b: seed 78633192
- world rect: -3072, -1536, 6656, 3072

## Global
- identical pixels: 67.848%
- mean per-channel diff: 43.081
- diff histogram (per-pixel RGB L1): =0: 67.848%  <=6: 67.948%  <=15: 68.251%  <=60: 69.529%  >60: 100%

## Chunks
- fully stable chunks (>=99.9% identical): 14 / 171
- heavily changed chunks (<50% identical): 49
- top-10 changed:
  chunk_6_-3: ident=0% mean=147.405 p99=183.67 max=189
  chunk_5_-3: ident=0% mean=147.389 p99=183.67 max=189
  chunk_11_-3: ident=0% mean=147.355 p99=177 max=189
  chunk_7_-3: ident=0% mean=147.329 p99=183.67 max=189
  chunk_10_-3: ident=0% mean=147.322 p99=177 max=189
  chunk_4_-3: ident=0% mean=147.321 p99=183.67 max=189
  chunk_3_-3: ident=0% mean=147.289 p99=184.67 max=189
  chunk_8_-3: ident=0% mean=147.264 p99=177 max=189
  chunk_9_-3: ident=0% mean=147.251 p99=177 max=189
  chunk_2_-3: ident=0% mean=147.239 p99=183.67 max=189.3

- chunk mean-diff map: chunkmap.png; per-pixel heatmap: diff-heatmap.png
