# diff — run1b (in-game capture, parallax off) vs noitamap reference (seed 78633191)

- run1b: seed 78633192; ref: seed 78633191 (adjacent seeds, +1)
- overlap chunks: cx -5..10, cy -2..3 (96 chunks)

## Global
- identical pixels: 79.813%
- mean per-channel diff (changed px): 116.095
- diff histogram (per-pixel RGB L1): =0: 79.813%  <=6: 79.919%  <=15: 80.227%  <=60: 84.166%  >60: 15.834%

## Chunks
- fully stable chunks (>=99.9% identical): 13 / 96 -> chunk_-4_-2, chunk_2_-2, chunk_0_-2, chunk_6_-2, chunk_8_3, chunk_3_-2, chunk_-2_-2, chunk_7_-2, chunk_4_-2, chunk_5_-2, chunk_8_-2, chunk_9_-2, chunk_10_-2
- heavily changed chunks (<50% identical): 20
- top-10 changed:
  chunk_9_0: ident=23.6% mean=86.418 max=704
  chunk_4_0: ident=36.7% mean=85.656 max=704
  chunk_3_3: ident=36.9% mean=108.911 max=725
  chunk_1_3: ident=37.1% mean=118.630 max=725
  chunk_-3_3: ident=37.5% mean=117.124 max=725
  chunk_2_3: ident=39.9% mean=106.737 max=725
  chunk_0_3: ident=41.6% mean=107.178 max=725
  chunk_-4_3: ident=43.3% mean=119.534 max=725
  chunk_-2_3: ident=43.7% mean=91.863 max=725
  chunk_8_0: ident=44.8% mean=78.185 max=483

- chunk mean-diff map: chunkmap.png; per-pixel heatmap: diff-heatmap.png
