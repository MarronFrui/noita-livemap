# mapcap analysis — run1b

- source: `/mnt/e/Programmes/Steam/steamapps/common/Noita/mods/noita-mapcap/bin/stitch/output.png` (11264x6144), origin 3840,2304
- world rect: -3072, -1536, 6656, 3072  seed: 78633192
- chunks: 171 (19x9)

## Capture stability (raw tile overlap consistency)
Adjacent tiles overlap by 512px; identical rendering => identical overlap pixels.
- pairs checked: 430 (h: 220, v: 210)
- mean per-channel diff: 0.3119 (0 = pixel-identical)
- identical pixels: 99.6%
- max channel diff seen: 765
- worst pairs: [{"at":[-3840,-2304],"mean":7.0893605550130205,"identPct":95.44525146484375,"max":765},{"at":[-3840,-1792],"mean":4.263064066569011,"identPct":96.95472717285156,"max":765},{"at":[-3328,-1280],"mean":2.514080047607422,"identPct":97.67570495605469,"max":598},{"at":[-2304,-2304],"mean":2.1236673990885415,"identPct":97.96905517578125,"max":621},{"at":[-256,1280],"mean":1.744855244954427,"identPct":96.22726440429688,"max":631}]

## Skeleton test (512px grid seams in stitched image)
- global interior baseline diff: 3.576
- vertical seams: median ratio 1.42, max 4.88
- horizontal seams: median ratio 1.48, max 3.60
- seams with ratio>1.5: 9
- {"atWorldX":-2048,"diff":6.697,"baseline":4.021,"ratio":1.665,"shift":-2,"shiftScores":[{"shift":-2,"diff":3.78},{"shift":0,"diff":6.7},{"shift":1,"diff":8.19},{"shift":2,"diff":9.71},{"shift":3,"diff":10.9}]}
- {"atWorldX":-1536,"diff":8.907,"baseline":5.582,"ratio":1.596,"shift":-2,"shiftScores":[{"shift":-2,"diff":6.29},{"shift":0,"diff":8.91},{"shift":1,"diff":11.75},{"shift":2,"diff":13.34},{"shift":3,"diff":12.8}]}
- {"atWorldX":2048,"diff":11.564,"baseline":2.369,"ratio":4.881,"shift":-2,"shiftScores":[{"shift":-2,"diff":1.26},{"shift":0,"diff":11.56},{"shift":1,"diff":11.86},{"shift":2,"diff":12.19},{"shift":3,"diff":12.83}]}
- {"atWorldX":2560,"diff":3.363,"baseline":2.002,"ratio":1.68,"shift":-2,"shiftScores":[{"shift":-2,"diff":2.68},{"shift":0,"diff":3.36},{"shift":1,"diff":3.49},{"shift":2,"diff":4.5},{"shift":3,"diff":5.11}]}
- {"atWorldX":3584,"diff":4.081,"baseline":2.492,"ratio":1.637,"shift":-2,"shiftScores":[{"shift":-2,"diff":1.82},{"shift":0,"diff":4.08},{"shift":1,"diff":5.28},{"shift":2,"diff":5.08},{"shift":3,"diff":4.87}]}
- {"atWorldX":4096,"diff":6.408,"baseline":2.658,"ratio":2.411,"shift":-2,"shiftScores":[{"shift":-2,"diff":3.93},{"shift":0,"diff":6.41},{"shift":1,"diff":6.54},{"shift":2,"diff":6.89},{"shift":3,"diff":7.29}]}
- {"atWorldY":1024,"diff":15.119,"baseline":4.927,"ratio":3.068,"shift":-2,"shiftScores":[{"shift":-2,"diff":6.7},{"shift":0,"diff":15.12},{"shift":1,"diff":12.8},{"shift":2,"diff":15.3},{"shift":3,"diff":13.74}]}
- {"atWorldY":1536,"diff":15.589,"baseline":4.329,"ratio":3.601,"shift":-2,"shiftScores":[{"shift":-2,"diff":12.53},{"shift":0,"diff":15.59},{"shift":1,"diff":16.36},{"shift":2,"diff":17.18},{"shift":3,"diff":16.82}]}
- {"atWorldY":2560,"diff":13.594,"baseline":4.34,"ratio":3.132,"shift":-2,"shiftScores":[{"shift":-2,"diff":5.21},{"shift":0,"diff":13.59},{"shift":1,"diff":10.61},{"shift":2,"diff":13.4},{"shift":3,"diff":11.22}]}
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
- median 0.157, p90 0.573, max 0.839
- worst chunks:
  chunk_-2_2 noiseRms=0.839 label=rock
  chunk_0_0 noiseRms=0.747 label=rock
  chunk_0_5 noiseRms=0.742 label=rock
  chunk_-1_5 noiseRms=0.738 label=rock
  chunk_-1_2 noiseRms=0.73 label=rock
  chunk_-2_5 noiseRms=0.602 label=rock
  chunk_2_4 noiseRms=0.6 label=rock
  chunk_-4_4 noiseRms=0.596 label=rock
  chunk_3_3 noiseRms=0.591 label=rock
  chunk_1_3 noiseRms=0.59 label=rock

## Region map
- counts: {"void":35,"rock":130,"ice":1,"structure":2,"lava":3}
- overview: classification.png (1 cell per chunk), noise-heatmap.png

## Per-chunk table (label / conf / meanLum / stdLum / edge / straight / noise)
chunk_-6_-3: void 1 0 0 0 0 0
chunk_-5_-3: void 1 0 0 0 0 0
chunk_-4_-3: rock 1 27.65 28.04 0.0173 0.575 0.165
chunk_-3_-3: rock 1 24.02 24.81 0.012 0.692 0.206
chunk_-2_-3: void 0.99 1.05 12.98 0.0038 0.559 0
chunk_-1_-3: void 1 0 0 0 0 0
chunk_0_-3: void 1 0 0 0 0 0
chunk_1_-3: rock 0.94 12.73 37.59 0.0276 0.614 0.011
chunk_2_-3: void 1 0 0 0 0 0
chunk_3_-3: void 1 0 0 0 0 0
chunk_4_-3: void 1 0 0 0 0 0
chunk_5_-3: void 1 0 0 0 0 0
chunk_6_-3: void 1 0 0 0 0 0
chunk_7_-3: void 1 0 0 0 0 0
chunk_8_-3: void 1 0 0 0 0 0
chunk_9_-3: void 1 0 0 0 0 0
chunk_10_-3: void 1 0 0 0 0 0
chunk_11_-3: void 1 0 0 0 0 0
chunk_12_-3: void 1 0 0 0 0 0
chunk_-6_-2: void 1 0 0 0 0 0
chunk_-5_-2: void 1 0 0 0 0 0
chunk_-4_-2: rock 1 43.16 23.2 0.0202 0.723 0.228
chunk_-3_-2: rock 1 35.15 26.11 0.0148 0.652 0.183
chunk_-2_-2: void 1 0 0 0 0 0
chunk_-1_-2: void 1 0 0 0 0 0
chunk_0_-2: void 1 0 0 0 0 0
chunk_1_-2: rock 0.74 29.93 60.78 0.0186 0.434 0.043
chunk_2_-2: void 1 0 0.21 0 1 0
chunk_3_-2: void 1 0 0 0 0 0
chunk_4_-2: void 1 0 0 0 0 0
chunk_5_-2: void 1 0 0 0 0 0
chunk_6_-2: void 1 0 0 0 0 0
chunk_7_-2: void 1 0 0 0 0 0
chunk_8_-2: void 1 0 0 0 0 0
chunk_9_-2: void 1 0 0 0 0 0
chunk_10_-2: void 1 0 0 0 0 0
chunk_11_-2: void 1 0 0 0 0 0
chunk_12_-2: void 1 0 0 0 0 0
chunk_-6_-1: ice 0.64 60.78 86.07 0.0159 0.661 0.001
chunk_-5_-1: rock 0.46 50.44 82.27 0.0119 0.655 0.003
chunk_-4_-1: rock 0.97 48.37 25.19 0.0175 0.703 0.311
chunk_-3_-1: rock 1 30.13 27.51 0.0158 0.577 0.219
chunk_-2_-1: rock 1 15.11 33.3 0.0169 0.393 0.001
chunk_-1_-1: rock 1 10.11 28.23 0.0121 0.452 0
chunk_0_-1: rock 0.95 22.32 30.94 0.0278 0.37 0.072
chunk_1_-1: rock 0.85 40.42 17.5 0.0491 0.289 0.276
chunk_2_-1: rock 0.99 24.2 24.65 0.0306 0.29 0.105
chunk_3_-1: rock 1 14.95 36.36 0.0178 0.457 0.025
chunk_4_-1: rock 1 5.93 24.78 0.008 0.549 0.007
chunk_5_-1: void 1 0.15 3.35 0.0006 0.362 0
chunk_6_-1: rock 1 15.12 35.67 0.0154 0.442 0.013
chunk_7_-1: rock 1 4.23 16.26 0.007 0.33 0
chunk_8_-1: rock 1 3.65 18.57 0.0089 0.571 0
chunk_9_-1: rock 1 16.2 38.55 0.022 0.508 0.001
chunk_10_-1: rock 0.99 14.01 49.98 0.015 0.477 0.003
chunk_11_-1: void 0.99 1.87 16.43 0.0047 0.598 0
chunk_12_-1: void 1 0.27 5.79 0.0009 0.582 0
chunk_-6_0: rock 1 25.84 6.27 0.0241 0.392 0.104
chunk_-5_0: rock 0.92 32.39 32.28 0.0259 0.524 0.018
chunk_-4_0: rock 0.99 48.16 18.98 0.0432 0.218 0.284
chunk_-3_0: rock 0.99 45.61 20.13 0.0321 0.224 0.302
chunk_-2_0: rock 0.99 56.08 19.7 0.0476 0.144 0.043
chunk_-1_0: rock 0.94 53.72 20.33 0.0509 0.161 0.17
chunk_0_0: rock 0.73 41.31 26.26 0.0687 0.319 0.747
chunk_1_0: rock 0.61 39.99 26.13 0.0656 0.325 0.44
chunk_2_0: rock 0.56 39.54 25.82 0.0639 0.299 0.365
chunk_3_0: rock 0.93 54.14 20.15 0.0521 0.178 0.223
chunk_4_0: rock 1 55 25.08 0.0489 0.211 0.032
chunk_5_0: rock 1 42.84 28.39 0.0262 0.161 0.25
chunk_6_0: rock 1 53.25 23.81 0.0511 0.191 0.032
chunk_7_0: rock 0.99 52.79 20.69 0.0476 0.132 0.032
chunk_8_0: rock 0.98 44.83 19.56 0.0489 0.131 0.044
chunk_9_0: rock 0.98 45 18.18 0.0504 0.143 0.129
chunk_10_0: structure 0.94 107.72 63.2 0.0651 0.563 0.163
chunk_11_0: rock 0.64 119.34 65.62 0.0544 0.546 0.01
chunk_12_0: rock 0.56 129.53 70.75 0.0583 0.597 0.112
chunk_-6_1: rock 0.99 39.29 26.09 0.0535 0.289 0.156
chunk_-5_1: rock 0.98 39.04 26.05 0.0503 0.288 0.149
chunk_-4_1: rock 0.98 45.94 18 0.0438 0.233 0.587
chunk_-3_1: rock 0.7 41.64 27.78 0.0704 0.309 0.318
chunk_-2_1: rock 0.7 42.91 27.57 0.0703 0.292 0.436
chunk_-1_1: rock 0.58 38.79 26.65 0.0655 0.342 0.334
chunk_0_1: rock 0.61 41.19 28.14 0.0705 0.331 0.364
chunk_1_1: rock 0.58 40.59 27.6 0.065 0.32 0.455
chunk_2_1: rock 0.67 42.28 28.07 0.0757 0.306 0.304
chunk_3_1: rock 0.61 39.75 26.98 0.0665 0.337 0.325
chunk_4_1: rock 0.92 30.59 22.31 0.0284 0.273 0.157
chunk_5_1: lava 0.78 53.91 46.93 0.013 0.416 0.078
chunk_6_1: rock 0.85 34.73 27.43 0.0299 0.279 0.093
chunk_7_1: rock 1 24.73 10.8 0.0242 0.278 0.104
chunk_8_1: structure 0.84 37.49 27.63 0.061 0.503 0.287
chunk_9_1: rock 1 27.93 9.25 0.027 0.27 0.226
chunk_10_1: rock 1 48.19 24.06 0.0444 0.263 0.557
chunk_11_1: rock 0.98 47.52 21.58 0.0488 0.204 0.483
chunk_12_1: rock 0.99 53.72 23.87 0.052 0.239 0.511
chunk_-6_2: rock 1 29.29 10.75 0.0332 0.291 0.182
chunk_-5_2: rock 1 27.1 7.39 0.0273 0.304 0.065
chunk_-4_2: rock 1 31.37 10.56 0.0336 0.175 0.204
chunk_-3_2: rock 0.91 67.73 15.44 0.0484 0.12 0.49
chunk_-2_2: rock 1 63.57 20.37 0.0497 0.293 0.839
chunk_-1_2: rock 0.91 60.61 25.86 0.0581 0.414 0.73
chunk_0_2: rock 0.91 63.8 21.33 0.0507 0.317 0.498
chunk_1_2: rock 0.94 67.92 14.91 0.0491 0.134 0.57
chunk_2_2: rock 0.91 67.69 15.45 0.0483 0.135 0.493
chunk_3_2: rock 0.91 67.73 15.42 0.0481 0.108 0.485
chunk_4_2: rock 1 26.56 6.24 0.0242 0.202 0.002
chunk_5_2: lava 1 116.15 23.77 0.0052 0.345 0.001
chunk_6_2: rock 0.75 43.65 31.69 0.0382 0.232 0.007
chunk_7_2: rock 1 22.26 9.47 0.0166 0.271 0.109
chunk_8_2: rock 1 32.12 10.09 0.0355 0.178 0.042
chunk_9_2: rock 1 31.73 9.84 0.0354 0.177 0.012
chunk_10_2: rock 1 37.78 21.41 0.0488 0.301 0.527
chunk_11_2: rock 1 28.91 11 0.0156 0.365 0.549
chunk_12_2: rock 1 38.44 22.96 0.0505 0.318 0.566
chunk_-6_3: rock 0.97 44.58 29 0.0612 0.283 0.446
chunk_-5_3: rock 0.97 40.69 28.56 0.0615 0.319 0.409
chunk_-4_3: rock 0.95 39.55 29.56 0.0464 0.407 0.574
chunk_-3_3: rock 0.97 41.22 28.76 0.0462 0.407 0.55
chunk_-2_3: rock 1 42.11 27.7 0.0487 0.402 0.568
chunk_-1_3: rock 1 34.34 25.77 0.0378 0.418 0.573
chunk_0_3: rock 1 35.95 26.64 0.0393 0.416 0.56
chunk_1_3: rock 0.95 43.86 30 0.0488 0.378 0.59
chunk_2_3: rock 0.99 46.4 29.44 0.0542 0.402 0.531
chunk_3_3: rock 1 40.79 27.13 0.045 0.4 0.591
chunk_4_3: rock 1 28.28 8.09 0.0281 0.198 0.027
chunk_5_3: lava 1 72.41 45.8 0.0282 0.296 0.012
chunk_6_3: rock 0.96 32.38 18.04 0.039 0.276 0.092
chunk_7_3: rock 1 21.62 8.9 0.0145 0.269 0.108
chunk_8_3: rock 1 31.39 9.71 0.0328 0.139 0.041
chunk_9_3: rock 1 31.09 10.53 0.0347 0.204 0.421
chunk_10_3: rock 1 35.96 20.52 0.0411 0.323 0.551
chunk_11_3: rock 1 28.04 8.83 0.0143 0.358 0.543
chunk_12_3: rock 1 34.61 19.37 0.0425 0.319 0.56
chunk_-6_4: rock 0.98 39.94 27.3 0.0603 0.288 0.34
chunk_-5_4: rock 0.98 44.22 30.3 0.0685 0.362 0.532
chunk_-4_4: rock 0.97 39.96 27.27 0.0444 0.384 0.596
chunk_-3_4: rock 0.97 45.94 28.21 0.0485 0.391 0.526
chunk_-2_4: rock 0.97 43.41 28.36 0.0495 0.395 0.583
chunk_-1_4: rock 0.97 42.91 28.74 0.0484 0.407 0.588
chunk_0_4: rock 0.99 44.29 28.07 0.0484 0.415 0.582
chunk_1_4: rock 0.97 43.44 28.04 0.0491 0.417 0.573
chunk_2_4: rock 0.97 38.97 26.69 0.0418 0.42 0.6
chunk_3_4: rock 0.95 43.8 29.75 0.0495 0.405 0.577
chunk_4_4: rock 1 29.39 9.15 0.0313 0.212 0.285
chunk_5_4: rock 1 28.01 7.76 0.0281 0.209 0.008
chunk_6_4: rock 0.96 38.79 20.39 0.0464 0.362 0.5
chunk_7_4: rock 1 21.8 9.39 0.0149 0.259 0.107
chunk_8_4: rock 1 29.18 8.63 0.0304 0.195 0.01
chunk_9_4: rock 1 29.11 8.83 0.0303 0.219 0.199
chunk_10_4: rock 1 34.2 17.99 0.032 0.304 0.538
chunk_11_4: rock 1 37.78 21.18 0.0383 0.315 0.56
chunk_12_4: rock 1 34.42 19.8 0.0375 0.303 0.558
chunk_-6_5: rock 1 29.84 9.07 0.0307 0.167 0.012
chunk_-5_5: rock 1 30.05 9.84 0.0321 0.193 0.187
chunk_-4_5: rock 0.91 67.72 15.46 0.0484 0.124 0.49
chunk_-3_5: rock 0.91 67.73 15.43 0.0482 0.109 0.487
chunk_-2_5: rock 0.91 63.21 21.11 0.0503 0.297 0.602
chunk_-1_5: rock 0.91 60.02 24.84 0.0558 0.412 0.738
chunk_0_5: rock 0.99 66.48 18.02 0.05 0.32 0.742
chunk_1_5: rock 0.91 67.73 15.42 0.0481 0.11 0.488
chunk_2_5: rock 0.91 67.71 15.46 0.0484 0.124 0.49
chunk_3_5: rock 0.91 67.74 15.44 0.0481 0.11 0.487
chunk_4_5: rock 0.96 29.78 10.05 0.0334 0.241 0.241
chunk_5_5: rock 1 30.93 9.55 0.0331 0.167 0.038
chunk_6_5: rock 1 28.21 7.94 0.0286 0.215 0.009
chunk_7_5: rock 1 21.62 8.91 0.0146 0.268 0.108
chunk_8_5: rock 1 30.48 9.36 0.0335 0.194 0.015
chunk_9_5: rock 1 30.36 9.36 0.0341 0.22 0.331
chunk_10_5: rock 1 37.73 20.57 0.0357 0.281 0.537
chunk_11_5: rock 1 36.53 20.24 0.0312 0.292 0.561
chunk_12_5: rock 1 35.59 19.96 0.0417 0.326 0.552

## Run1b findings (2026-09-04)
- First capture with `disable-background` (parallax off): background renders
  black, everything world-anchored.
- Tile overlap: 430 pairs, 99.6% identical, mean diff 0.31 — capture pipeline
  pixel-stable. Worst pairs (~95-98%) are at the west world-edge tiles.
- Real 512-grid seams (see skeleton section): same values as run1 => content.
- Noise floor median 0.157/255. Labels: 35 void (background/sky), 130 rock,
  3 lava, 2 structure, 1 ice.
- run1 (parallax on) vs run1b: 67.85% pixels identical = foreground share;
  diff-heatmap.png = foreground mask (white=background).
