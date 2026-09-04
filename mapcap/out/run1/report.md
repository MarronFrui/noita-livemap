# mapcap analysis — run1

- source: `(existing chunk files)` (9728x4608), origin 3072,1536
- world rect: -3072, -1536, 6656, 3072  seed: 78633192
- chunks: 171 (19x9)

## Capture stability (raw tile overlap consistency)
Adjacent tiles overlap by 512px; identical rendering => identical overlap pixels.
- (skipped in re-analysis mode — see original run report)

## Skeleton test (512px grid seams in stitched image)
- global interior baseline diff: 3.64
- vertical seams: median ratio 1.44, max 4.56
- horizontal seams: median ratio 1.44, max 3.60
- seams with ratio>1.5: 9
- {"atWorldX":-2048,"diff":6.703,"baseline":4.096,"ratio":1.636,"shift":-2,"shiftScores":[{"shift":-2,"diff":3.43},{"shift":0,"diff":6.7},{"shift":1,"diff":8.21},{"shift":2,"diff":10.05},{"shift":3,"diff":11.23}]}
- {"atWorldX":-1536,"diff":8.965,"baseline":5.611,"ratio":1.598,"shift":-2,"shiftScores":[{"shift":-2,"diff":6.48},{"shift":0,"diff":8.97},{"shift":1,"diff":14.07},{"shift":2,"diff":16.94},{"shift":3,"diff":16.53}]}
- {"atWorldX":2048,"diff":11.603,"baseline":2.546,"ratio":4.558,"shift":-2,"shiftScores":[{"shift":-2,"diff":1.23},{"shift":0,"diff":11.6},{"shift":1,"diff":11.85},{"shift":2,"diff":12.35},{"shift":3,"diff":12.91}]}
- {"atWorldX":2560,"diff":3.35,"baseline":1.989,"ratio":1.684,"shift":-2,"shiftScores":[{"shift":-2,"diff":2.56},{"shift":0,"diff":3.35},{"shift":1,"diff":3.56},{"shift":2,"diff":4.88},{"shift":3,"diff":5.6}]}
- {"atWorldX":3584,"diff":4.04,"baseline":2.508,"ratio":1.611,"shift":-2,"shiftScores":[{"shift":-2,"diff":1.93},{"shift":0,"diff":4.04},{"shift":1,"diff":5.25},{"shift":2,"diff":5.08},{"shift":3,"diff":4.78}]}
- {"atWorldX":4096,"diff":6.489,"baseline":2.644,"ratio":2.454,"shift":-2,"shiftScores":[{"shift":-2,"diff":4.18},{"shift":0,"diff":6.49},{"shift":1,"diff":6.74},{"shift":2,"diff":7.01},{"shift":3,"diff":7.41}]}
- {"atWorldY":1024,"diff":15.19,"baseline":4.98,"ratio":3.05,"shift":-2,"shiftScores":[{"shift":-2,"diff":6.79},{"shift":0,"diff":15.19},{"shift":1,"diff":12.84},{"shift":2,"diff":15.18},{"shift":3,"diff":13.82}]}
- {"atWorldY":1536,"diff":15.601,"baseline":4.329,"ratio":3.604,"shift":-2,"shiftScores":[{"shift":-2,"diff":12.53},{"shift":0,"diff":15.6},{"shift":1,"diff":16.51},{"shift":2,"diff":17.32},{"shift":3,"diff":16.91}]}
- {"atWorldY":2560,"diff":13.599,"baseline":4.38,"ratio":3.105,"shift":-2,"shiftScores":[{"shift":-2,"diff":5.23},{"shift":0,"diff":13.6},{"shift":1,"diff":10.67},{"shift":2,"diff":13.28},{"shift":3,"diff":11.21}]}
- NOTE: if tile overlaps are identical, grid seams are real world-generation
  content (material/structure seams at wang-chunk boundaries), not stitch artifacts.

## Known capture caveats
- Parallax background (sky bands, mountain silhouettes) is camera-dependent:
  overlapping tiles DISAGREE there, and the stitcher median-blends it into a
  ghost layer. Only world-anchored foreground is pixel-stable — exclude
  background from any cross-run/mapgen comparison.
- The mod bakes a seed/build debug text overlay into every tile at a fixed
  screen offset. Median blending removes it in overlap zones, but single-
  coverage tiles (capture edges) keep it.
- Vegetation (trees) sways between tile captures -> small scattered diffs.

## Noise floor (flat-region high-pass RMS, 0-255 scale)
- median 0.208, p90 0.573, max 0.838
- worst chunks:
  chunk_-2_2 noiseRms=0.838 label=rock
  chunk_0_5 noiseRms=0.744 label=rock
  chunk_0_0 noiseRms=0.743 label=rock
  chunk_-1_5 noiseRms=0.739 label=rock
  chunk_-1_2 noiseRms=0.73 label=rock
  chunk_2_4 noiseRms=0.628 label=rock
  chunk_-2_5 noiseRms=0.602 label=rock
  chunk_-4_4 noiseRms=0.595 label=rock
  chunk_3_3 noiseRms=0.591 label=rock
  chunk_-1_4 noiseRms=0.591 label=rock

## Region map
- counts: {"sky":47,"mixed":4,"rock":114,"ice":1,"structure":2,"lava":3}
- overview: classification.png (1 cell per chunk), noise-heatmap.png

## Per-chunk table (label / conf / meanLum / stdLum / edge / straight / noise)
chunk_-6_-3: sky 1 153.76 15.54 0.0053 0.666 0.208
chunk_-5_-3: sky 1 153.71 15.5 0.0053 0.671 0.211
chunk_-4_-3: mixed 0.29 91.11 50.53 0.0237 0.636 0.249
chunk_-3_-3: mixed 0.23 96.62 52.76 0.0217 0.72 0.27
chunk_-2_-3: sky 1 153.7 15.49 0.0053 0.669 0.218
chunk_-1_-3: sky 1 153.72 15.51 0.0053 0.664 0.211
chunk_0_-3: sky 1 153.77 15.56 0.0053 0.666 0.209
chunk_1_-3: sky 0.91 145.85 25.56 0.0273 0.604 0.202
chunk_2_-3: sky 1 153.96 15.77 0.0052 0.672 0.205
chunk_3_-3: sky 1 154.02 15.83 0.0052 0.674 0.203
chunk_4_-3: sky 1 154.05 15.84 0.0051 0.524 0.203
chunk_5_-3: sky 1 154.12 15.89 0.005 0.449 0.201
chunk_6_-3: sky 1 154.14 15.89 0.0049 0.441 0.201
chunk_7_-3: sky 1 154.06 15.79 0.0048 0.448 0.198
chunk_8_-3: sky 1 153.99 15.7 0.0046 0.305 0.2
chunk_9_-3: sky 1 153.97 15.65 0.0045 0.316 0.191
chunk_10_-3: sky 1 154.05 15.69 0.0043 0.449 0.186
chunk_11_-3: sky 1 154.08 15.71 0.0042 0.443 0.182
chunk_12_-3: sky 1 153.92 15.67 0.0041 0.48 0.18
chunk_-6_-2: sky 1 153.26 15.23 0.0035 0.485 0.2
chunk_-5_-2: sky 1 153.19 15.18 0.0033 0.513 0.201
chunk_-4_-2: rock 0.78 64.74 38.34 0.0224 0.717 0.3
chunk_-3_-2: rock 0.53 84.23 49.38 0.0172 0.644 0.388
chunk_-2_-2: sky 1 153.12 15.14 0.0029 0.5 0.251
chunk_-1_-2: sky 1 153.12 15.16 0.0027 0.476 0.204
chunk_0_-2: sky 1 153.11 15.15 0.0027 0.473 0.205
chunk_1_-2: sky 0.79 138.7 41.97 0.0162 0.428 0.183
chunk_2_-2: sky 1 153.23 15.31 0.0026 0.494 0.208
chunk_3_-2: sky 1 153.29 15.39 0.0026 0.51 0.206
chunk_4_-2: sky 1 153.33 15.42 0.0026 0.538 0.204
chunk_5_-2: sky 1 153.42 15.48 0.0027 0.542 0.202
chunk_6_-2: sky 1 153.45 15.49 0.0026 0.52 0.202
chunk_7_-2: sky 1 153.38 15.41 0.0027 0.532 0.2
chunk_8_-2: sky 1 153.28 15.3 0.0026 0.537 0.191
chunk_9_-2: sky 1 153.22 15.16 0.0026 0.543 0.183
chunk_10_-2: sky 1 153.29 15.19 0.0026 0.556 0.176
chunk_11_-2: sky 1 153.34 15.22 0.0025 0.501 0.173
chunk_12_-2: sky 1 153.28 15.17 0.0026 0.543 0.17
chunk_-6_-1: ice 0.63 153.88 33.64 0.0133 0.626 0.118
chunk_-5_-1: sky 0.76 158.22 22.09 0.0105 0.636 0.122
chunk_-4_-1: rock 0.82 66.76 35.88 0.0176 0.706 0.364
chunk_-3_-1: rock 0.53 80.26 54.69 0.0187 0.583 0.268
chunk_-2_-1: sky 0.84 135.61 36.57 0.0159 0.37 0.169
chunk_-1_-1: sky 0.96 141.29 31.62 0.0119 0.445 0.184
chunk_0_-1: mixed 0.23 106.94 55.19 0.0286 0.362 0.166
chunk_1_-1: rock 0.85 40.36 17.42 0.0487 0.289 0.279
chunk_2_-1: mixed 0.26 90.97 52.53 0.0314 0.283 0.18
chunk_3_-1: sky 0.88 139.77 33.03 0.015 0.445 0.151
chunk_4_-1: sky 1 149.91 19.63 0.0076 0.511 0.181
chunk_5_-1: sky 1 152.8 15.99 0.0033 0.506 0.186
chunk_6_-1: sky 0.92 138.59 32.19 0.0146 0.457 0.179
chunk_7_-1: sky 0.97 144.82 30.94 0.008 0.374 0.181
chunk_8_-1: sky 1 150.06 20.48 0.0087 0.537 0.182
chunk_9_-1: sky 0.84 141.41 28.17 0.0173 0.487 0.157
chunk_10_-1: sky 0.96 155.29 23.57 0.0116 0.42 0.163
chunk_11_-1: sky 1 152.71 15.77 0.0044 0.493 0.178
chunk_12_-1: sky 1 152.79 15.11 0.0028 0.53 0.178
chunk_-6_0: rock 1 25.86 6.39 0.0242 0.4 0.103
chunk_-5_0: rock 0.92 32.39 32.28 0.0259 0.518 0.002
chunk_-4_0: rock 0.99 48.48 19.32 0.0428 0.213 0.286
chunk_-3_0: rock 0.85 56.79 28.21 0.0328 0.234 0.31
chunk_-2_0: rock 0.93 61.52 22.21 0.0453 0.136 0.095
chunk_-1_0: rock 0.92 59.82 23.55 0.0502 0.159 0.204
chunk_0_0: rock 0.74 41.34 26.23 0.0689 0.321 0.743
chunk_1_0: rock 0.61 39.99 26.15 0.0656 0.325 0.443
chunk_2_0: rock 0.55 39.14 25.41 0.0635 0.297 0.37
chunk_3_0: rock 0.93 57.65 22.22 0.0512 0.174 0.239
chunk_4_0: rock 0.83 68.11 28.48 0.0445 0.188 0.129
chunk_5_0: rock 0.48 86.09 37.02 0.0266 0.181 0.273
chunk_6_0: rock 0.85 64.8 28.23 0.0485 0.18 0.123
chunk_7_0: rock 0.89 60.64 24.7 0.0466 0.127 0.121
chunk_8_0: rock 0.85 55.77 28.11 0.0481 0.126 0.126
chunk_9_0: rock 0.91 51.92 25.09 0.0503 0.142 0.178
chunk_10_0: structure 0.93 112.58 61.3 0.062 0.557 0.182
chunk_11_0: rock 0.61 121.6 63.8 0.0516 0.539 0.12
chunk_12_0: rock 0.45 137.68 62.79 0.0544 0.59 0.187
chunk_-6_1: rock 0.99 39.32 26.1 0.0533 0.288 0.168
chunk_-5_1: rock 0.98 38.99 26.01 0.0503 0.287 0.145
chunk_-4_1: rock 0.98 45.95 18.04 0.044 0.236 0.587
chunk_-3_1: rock 0.7 41.69 27.83 0.0709 0.31 0.318
chunk_-2_1: rock 0.7 42.97 27.63 0.0706 0.293 0.431
chunk_-1_1: rock 0.58 38.77 26.63 0.0656 0.342 0.334
chunk_0_1: rock 0.61 41.25 28.29 0.0708 0.335 0.362
chunk_1_1: rock 0.58 40.51 27.63 0.0647 0.317 0.451
chunk_2_1: rock 0.67 42.28 28.06 0.0758 0.307 0.31
chunk_3_1: rock 0.61 39.75 27 0.0667 0.334 0.325
chunk_4_1: rock 0.92 30.57 22.28 0.0282 0.274 0.157
chunk_5_1: lava 0.78 53.92 46.95 0.0131 0.443 0.08
chunk_6_1: rock 0.85 34.74 27.42 0.0299 0.282 0.093
chunk_7_1: rock 1 24.7 10.84 0.024 0.29 0.104
chunk_8_1: structure 0.84 37.54 27.75 0.061 0.504 0.286
chunk_9_1: rock 1 27.94 9.26 0.0271 0.277 0.229
chunk_10_1: rock 1 48.19 24.06 0.0444 0.267 0.557
chunk_11_1: rock 0.98 47.53 21.6 0.0489 0.204 0.483
chunk_12_1: rock 0.99 53.69 23.82 0.0518 0.237 0.511
chunk_-6_2: rock 1 29.3 10.78 0.0332 0.291 0.182
chunk_-5_2: rock 1 27.1 7.41 0.0273 0.3 0.065
chunk_-4_2: rock 1 31.38 10.59 0.0336 0.172 0.204
chunk_-3_2: rock 0.91 67.72 15.45 0.0484 0.121 0.497
chunk_-2_2: rock 1 63.55 20.38 0.0497 0.295 0.838
chunk_-1_2: rock 0.91 60.61 25.86 0.0581 0.414 0.73
chunk_0_2: rock 0.91 63.81 21.35 0.0508 0.317 0.502
chunk_1_2: rock 0.94 68.01 14.69 0.0488 0.127 0.556
chunk_2_2: rock 0.91 67.71 15.42 0.0481 0.121 0.493
chunk_3_2: rock 0.91 67.73 15.42 0.0481 0.109 0.485
chunk_4_2: rock 1 26.56 6.24 0.0242 0.2 0.002
chunk_5_2: lava 1 116.14 23.82 0.0051 0.342 0.001
chunk_6_2: rock 0.75 43.65 31.69 0.0382 0.232 0.007
chunk_7_2: rock 1 22.27 9.53 0.0167 0.268 0.108
chunk_8_2: rock 1 32.13 10.12 0.0356 0.177 0.041
chunk_9_2: rock 1 31.74 9.85 0.0354 0.177 0.012
chunk_10_2: rock 1 37.73 21.3 0.0484 0.3 0.527
chunk_11_2: rock 1 28.92 11.07 0.0156 0.363 0.549
chunk_12_2: rock 1 38.43 22.94 0.0505 0.318 0.566
chunk_-6_3: rock 0.97 44.51 28.91 0.0607 0.282 0.445
chunk_-5_3: rock 0.97 40.73 28.59 0.0617 0.318 0.407
chunk_-4_3: rock 0.94 39.58 29.58 0.0465 0.404 0.574
chunk_-3_3: rock 0.97 41.26 28.84 0.0466 0.404 0.547
chunk_-2_3: rock 1 42.14 27.61 0.0488 0.403 0.566
chunk_-1_3: rock 1 34.26 25.64 0.0374 0.42 0.573
chunk_0_3: rock 1 35.95 26.7 0.0394 0.415 0.56
chunk_1_3: rock 0.95 43.88 30 0.0489 0.375 0.59
chunk_2_3: rock 0.99 46.44 29.53 0.0546 0.403 0.532
chunk_3_3: rock 1 40.85 27.19 0.0453 0.402 0.591
chunk_4_3: rock 1 28.3 8.12 0.0282 0.195 0.029
chunk_5_3: lava 1 72.4 45.81 0.0281 0.294 0.011
chunk_6_3: rock 0.96 32.34 18.03 0.0388 0.272 0.092
chunk_7_3: rock 1 21.63 8.92 0.0146 0.281 0.108
chunk_8_3: rock 1 31.39 9.71 0.0328 0.139 0.041
chunk_9_3: rock 1 31.11 10.54 0.0349 0.21 0.423
chunk_10_3: rock 1 36 20.56 0.0412 0.32 0.551
chunk_11_3: rock 1 28.03 8.75 0.0142 0.355 0.543
chunk_12_3: rock 1 34.6 19.34 0.0425 0.32 0.56
chunk_-6_4: rock 0.98 39.82 27.13 0.0595 0.29 0.343
chunk_-5_4: rock 0.98 44.18 30.26 0.0684 0.363 0.535
chunk_-4_4: rock 0.97 39.98 27.26 0.0444 0.385 0.595
chunk_-3_4: rock 0.97 46.01 28.3 0.0489 0.389 0.527
chunk_-2_4: rock 0.97 43.37 28.28 0.0492 0.396 0.587
chunk_-1_4: rock 0.97 42.9 28.73 0.0483 0.411 0.591
chunk_0_4: rock 0.99 44.31 28.06 0.0483 0.41 0.583
chunk_1_4: rock 0.97 43.38 27.99 0.0489 0.418 0.585
chunk_2_4: rock 0.97 38.89 26.73 0.0415 0.42 0.628
chunk_3_4: rock 0.95 44.02 29.93 0.0497 0.4 0.583
chunk_4_4: rock 1 29.37 9.13 0.0312 0.211 0.287
chunk_5_4: rock 1 28.01 7.76 0.0281 0.209 0.008
chunk_6_4: rock 0.96 38.78 20.4 0.0464 0.362 0.5
chunk_7_4: rock 1 21.8 9.38 0.015 0.262 0.108
chunk_8_4: rock 1 29.18 8.63 0.0304 0.195 0.01
chunk_9_4: rock 1 29.12 8.86 0.0304 0.225 0.197
chunk_10_4: rock 1 34.22 18.04 0.0323 0.307 0.537
chunk_11_4: rock 1 37.78 21.17 0.0383 0.312 0.56
chunk_12_4: rock 1 34.45 19.92 0.0378 0.301 0.557
chunk_-6_5: rock 1 29.85 9.08 0.0308 0.166 0.012
chunk_-5_5: rock 1 30.07 9.88 0.0322 0.196 0.186
chunk_-4_5: rock 0.91 67.72 15.46 0.0484 0.125 0.491
chunk_-3_5: rock 0.91 67.73 15.42 0.0482 0.11 0.487
chunk_-2_5: rock 0.91 63.19 21.12 0.0503 0.297 0.602
chunk_-1_5: rock 0.91 60.02 24.83 0.0557 0.411 0.739
chunk_0_5: rock 0.99 66.47 18.01 0.05 0.317 0.744
chunk_1_5: rock 0.91 67.71 15.45 0.0483 0.125 0.492
chunk_2_5: rock 0.91 67.71 15.46 0.0484 0.124 0.49
chunk_3_5: rock 0.91 67.74 15.44 0.0482 0.111 0.487
chunk_4_5: rock 0.96 29.78 10.04 0.0334 0.241 0.241
chunk_5_5: rock 1 30.93 9.55 0.0331 0.167 0.038
chunk_6_5: rock 1 28.22 7.94 0.0286 0.215 0.009
chunk_7_5: rock 1 21.61 8.9 0.0146 0.276 0.108
chunk_8_5: rock 1 30.48 9.37 0.0335 0.194 0.015
chunk_9_5: rock 1 30.36 9.36 0.034 0.216 0.329
chunk_10_5: rock 1 37.72 20.58 0.0356 0.283 0.536
chunk_11_5: rock 1 36.51 20.19 0.0311 0.293 0.561
chunk_12_5: rock 1 35.58 19.94 0.0416 0.323 0.552

## Run1 corrected findings (2026-09-04, re-analysis after winL fix)
- NOTE: chunks here were sliced from the parallax-ON stitch (source image since
  overwritten); tile-overlap section above is from the run1b tiles and does not
  belong to this run.
- Corrected seam values (world coords): h-seams y=1024 (3.05x), y=1536 (3.60x),
  y=2560 (3.11x), y=512 (1.44x); v-seams x=2048 (4.56x), x=4096 (2.45x),
  x=-2048 (1.64x), x=-1536 (1.60x), x=2560 (1.68x), x=3584 (1.61x).
- These match run1b (parallax off) to ~0.01 diff => real world-generation seams
  at 512-chunk boundaries (wang generation does not blend across boundaries).
- The first analysis run reported "y=-512/0/+512 at 16-40x" — that was a winL
  row-offset bug (measured rows 768px high = tile boundaries with parallax
  ghosting), not world seams. Fixed + covered by winL sanity check now.
