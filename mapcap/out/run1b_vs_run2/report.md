# diff — run1b vs run2 (different worlds (seeds differ): identical chunks are seed-independent regions)

- run1b: seed 78633192, run2: seed 78633193
- world rect: -3072, -1536, 6656, 3072

## Global
- identical pixels: 83.034%
- mean per-channel diff: 6.843
- diff histogram (per-pixel RGB L1): =0: 83.034%  <=6: 83.151%  <=15: 83.467%  <=60: 87.003%  >60: 100%

## Chunks
- fully stable chunks (>=99.9% identical): 37 / 171
- heavily changed chunks (<50% identical): 24
- top-10 changed:
  chunk_-5_-1: ident=67.69% mean=56.161 p99=192 max=242
  chunk_10_0: ident=48.75% mean=38.246 p99=213.67 max=237.3
  chunk_-3_3: ident=32.15% mean=25.342 p99=117.33 max=241.7
  chunk_2_3: ident=33.78% mean=25.009 p99=113 max=241.7
  chunk_1_3: ident=36.58% mean=24.668 p99=114.33 max=241.7
  chunk_0_3: ident=36.46% mean=24.144 p99=115 max=241.7
  chunk_0_4: ident=37.12% mean=23.402 p99=108.67 max=241.7
  chunk_-5_3: ident=39.65% mean=22.944 p99=92.67 max=237.7
  chunk_-4_3: ident=39.58% mean=22.916 p99=109.67 max=241.7
  chunk_1_4: ident=37.21% mean=22.682 p99=106 max=241.7

- chunk mean-diff map: chunkmap.png; per-pixel heatmap: diff-heatmap.png
