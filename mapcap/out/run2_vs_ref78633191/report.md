# diff — run2 (in-game capture, parallax off) vs noitamap reference (seed 78633191)

- run2: seed 78633193; ref: seed 78633191 (adjacent seeds, +1)
- overlap chunks: cx -5..10, cy -2..3 (96 chunks)

## Global
- identical pixels: 80.356%
- mean per-channel diff (changed px): 120.508
- diff histogram (per-pixel RGB L1): =0: 80.356%  <=6: 80.471%  <=15: 80.809%  <=60: 84.830%  >60: 15.170%

## Chunks
- fully stable chunks (>=99.9% identical): 12 / 96 -> chunk_-4_-2, chunk_-1_-1, chunk_2_-2, chunk_0_-2, chunk_8_3, chunk_6_-2, chunk_3_-2, chunk_7_-2, chunk_8_-2, chunk_4_-2, chunk_5_-2, chunk_9_-2
- heavily changed chunks (<50% identical): 13
- top-10 changed:
  chunk_9_0: ident=23.8% mean=90.989 max=704
  chunk_4_0: ident=34.1% mean=88.852 max=529
  chunk_-4_3: ident=35.2% mean=112.437 max=725
  chunk_0_3: ident=37.7% mean=110.651 max=725
  chunk_-1_3: ident=38.1% mean=111.325 max=725
  chunk_-5_3: ident=39.7% mean=110.661 max=713
  chunk_3_3: ident=42.1% mean=103.724 max=725
  chunk_-5_1: ident=42.4% mean=113.800 max=726
  chunk_-2_3: ident=42.5% mean=103.180 max=725
  chunk_1_3: ident=43.5% mean=102.005 max=725

- chunk mean-diff map: chunkmap.png; per-pixel heatmap: diff-heatmap.png
