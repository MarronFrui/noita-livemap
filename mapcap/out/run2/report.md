# mapcap analysis — run2

- source: `/mnt/e/Programmes/Steam/steamapps/common/Noita/mods/noita-mapcap/bin/stitch/output2.png` (11264x6144), origin 3840,2304
- world rect: -3072, -1536, 6656, 3072  seed: 78633193
- chunks: 171 (19x9)

## Capture stability (raw tile overlap consistency)
Adjacent tiles overlap by 512px; identical rendering => identical overlap pixels.
- pairs checked: 430 (h: 220, v: 210)
- mean per-channel diff: 0.1621 (0 = pixel-identical)
- identical pixels: 99.728%
- max channel diff seen: 764
- worst pairs: [{"at":[-2304,-2304],"mean":2.192846934000651,"identPct":97.89962768554688,"max":621},{"at":[4864,-768],"mean":1.6680005391438801,"identPct":98.99749755859375,"max":712},{"at":[-2816,-2304],"mean":1.495242436726888,"identPct":97.35946655273438,"max":621},{"at":[5376,-1280],"mean":1.3807284037272136,"identPct":99.24392700195312,"max":715},{"at":[-2816,1280],"mean":1.1330235799153645,"identPct":98.4039306640625,"max":726}]

## Skeleton test (512px grid seams in stitched image)
- global interior baseline diff: 3.635
- vertical seams: median ratio 1.41, max 4.42
- horizontal seams: median ratio 1.48, max 3.35
- seams with ratio>1.5: 9
- {"atWorldX":-2048,"diff":7.081,"baseline":4.619,"ratio":1.533,"shift":-2,"shiftScores":[{"shift":-2,"diff":4.62},{"shift":0,"diff":7.08},{"shift":1,"diff":8.72},{"shift":2,"diff":10.62},{"shift":3,"diff":11.79}]}
- {"atWorldX":-1536,"diff":8.905,"baseline":5.57,"ratio":1.599,"shift":-2,"shiftScores":[{"shift":-2,"diff":7.09},{"shift":0,"diff":8.91},{"shift":1,"diff":11.98},{"shift":2,"diff":12.98},{"shift":3,"diff":12.51}]}
- {"atWorldX":2048,"diff":12.283,"baseline":2.78,"ratio":4.418,"shift":-2,"shiftScores":[{"shift":-2,"diff":2.14},{"shift":0,"diff":12.28},{"shift":1,"diff":12.69},{"shift":2,"diff":13.16},{"shift":3,"diff":13.85}]}
- {"atWorldX":2560,"diff":3.344,"baseline":1.852,"ratio":1.806,"shift":-2,"shiftScores":[{"shift":-2,"diff":2.59},{"shift":0,"diff":3.34},{"shift":1,"diff":3.48},{"shift":2,"diff":4.6},{"shift":3,"diff":5.31}]}
- {"atWorldX":3584,"diff":4.079,"baseline":2.502,"ratio":1.63,"shift":-2,"shiftScores":[{"shift":-2,"diff":1.82},{"shift":0,"diff":4.08},{"shift":1,"diff":5.13},{"shift":2,"diff":4.93},{"shift":3,"diff":4.8}]}
- {"atWorldX":4096,"diff":6.368,"baseline":2.653,"ratio":2.4,"shift":-2,"shiftScores":[{"shift":-2,"diff":4.06},{"shift":0,"diff":6.37},{"shift":1,"diff":6.79},{"shift":2,"diff":7.16},{"shift":3,"diff":7.47}]}
- {"atWorldY":1024,"diff":14.752,"baseline":4.914,"ratio":3.002,"shift":-2,"shiftScores":[{"shift":-2,"diff":6.55},{"shift":0,"diff":14.75},{"shift":1,"diff":12.34},{"shift":2,"diff":14.73},{"shift":3,"diff":13.23}]}
- {"atWorldY":1536,"diff":14.498,"baseline":4.725,"ratio":3.069,"shift":-2,"shiftScores":[{"shift":-2,"diff":11.82},{"shift":0,"diff":14.5},{"shift":1,"diff":14.59},{"shift":2,"diff":15.11},{"shift":3,"diff":14.59}]}
- {"atWorldY":2560,"diff":13.851,"baseline":4.138,"ratio":3.347,"shift":-2,"shiftScores":[{"shift":-2,"diff":5.27},{"shift":0,"diff":13.85},{"shift":1,"diff":10.93},{"shift":2,"diff":13.62},{"shift":3,"diff":11.44}]}
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
- median 0.157, p90 0.564, max 0.774
- worst chunks:
  chunk_-2_2 noiseRms=0.774 label=rock
  chunk_0_0 noiseRms=0.77 label=rock
  chunk_-1_5 noiseRms=0.738 label=rock
  chunk_-1_2 noiseRms=0.715 label=rock
  chunk_0_4 noiseRms=0.597 label=rock
  chunk_-2_5 noiseRms=0.597 label=rock
  chunk_3_3 noiseRms=0.592 label=rock
  chunk_-3_4 noiseRms=0.592 label=rock
  chunk_1_4 noiseRms=0.585 label=rock
  chunk_-1_4 noiseRms=0.584 label=rock

## Region map
- counts: {"void":36,"rock":128,"ice":1,"water":1,"structure":2,"lava":3}
- overview: classification.png (1 cell per chunk), noise-heatmap.png

## Per-chunk table (label / conf / meanLum / stdLum / edge / straight / noise)
chunk_-6_-3: void 1 0 0 0 0 0
chunk_-5_-3: void 1 0 0 0 0 0
chunk_-4_-3: rock 1 27.64 28.01 0.0174 0.576 0.167
chunk_-3_-3: rock 1 24.02 24.81 0.012 0.691 0.205
chunk_-2_-3: void 1 0 0 0 0 0
chunk_-1_-3: void 1 0 0 0 0 0
chunk_0_-3: void 1 0 0 0 0 0
chunk_1_-3: rock 0.94 12.75 37.64 0.0277 0.618 0.011
chunk_2_-3: void 1 0 0.07 0 0 0
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
chunk_-6_-2: rock 0.9 10.22 41.26 0.0062 0.6 0.001
chunk_-5_-2: void 1 0 0 0 0 0
chunk_-4_-2: rock 1 43.16 23.2 0.0202 0.723 0.228
chunk_-3_-2: rock 1 35.15 26.1 0.0148 0.648 0.183
chunk_-2_-2: void 0.99 1.05 12.99 0.0038 0.557 0
chunk_-1_-2: void 1 0 0 0 0 0.003
chunk_0_-2: void 1 0 0.34 0 0.833 0.001
chunk_1_-2: rock 0.74 29.89 60.71 0.0185 0.429 0.043
chunk_2_-2: void 1 0.01 1.19 0 0.615 0
chunk_3_-2: void 1 0 0 0 0 0
chunk_4_-2: void 1 0 0 0 0 0
chunk_5_-2: void 1 0 0 0 0 0
chunk_6_-2: void 1 0 0 0 0 0
chunk_7_-2: void 1 0 0 0 0 0
chunk_8_-2: void 1 0 0.05 0 0 0
chunk_9_-2: void 1 0 0 0 0 0
chunk_10_-2: void 0.99 1.21 15.08 0.0046 0.691 0
chunk_11_-2: void 1 0 0 0 0 0
chunk_12_-2: void 1 0 0 0 0 0
chunk_-6_-1: ice 0.7 65.76 87.95 0.0164 0.547 0.019
chunk_-5_-1: water 0.62 99.95 91.36 0.0252 0.559 0.003
chunk_-4_-1: rock 0.97 49.05 25.53 0.0188 0.678 0.318
chunk_-3_-1: rock 1 32.72 27.35 0.0198 0.507 0.233
chunk_-2_-1: rock 1 11.39 29.44 0.0164 0.47 0
chunk_-1_-1: void 1 0.01 1.18 0.0001 0.795 0
chunk_0_-1: rock 0.95 22.34 30.94 0.0276 0.364 0.071
chunk_1_-1: rock 0.85 40.3 17.36 0.0487 0.293 0.276
chunk_2_-1: rock 0.99 23.7 24.67 0.0298 0.285 0.104
chunk_3_-1: rock 1 21.78 37.83 0.0282 0.453 0.058
chunk_4_-1: rock 1 3.92 16.86 0.0083 0.509 0
chunk_5_-1: void 1 0 0 0 0 0
chunk_6_-1: rock 1 3.76 15.14 0.0052 0.311 0
chunk_7_-1: rock 1 4.77 23.43 0.0048 0.545 0.025
chunk_8_-1: rock 1 6.05 25.27 0.0092 0.554 0.002
chunk_9_-1: rock 1 5.19 22.96 0.0123 0.581 0
chunk_10_-1: void 0.99 0.78 9.93 0.0023 0.63 0
chunk_11_-1: void 0.99 0.74 9.67 0.0023 0.62 0
chunk_12_-1: void 0.99 1.5 13.7 0.0041 0.607 0
chunk_-6_0: rock 1 25.95 6.71 0.0245 0.393 0.104
chunk_-5_0: rock 0.95 30.8 26.62 0.029 0.497 0.012
chunk_-4_0: rock 0.99 48 16.78 0.0391 0.189 0.279
chunk_-3_0: rock 0.99 48.87 16.72 0.0326 0.207 0.348
chunk_-2_0: rock 0.98 49.14 24.64 0.0502 0.165 0.037
chunk_-1_0: rock 0.94 53.24 21.16 0.0526 0.175 0.159
chunk_0_0: rock 0.75 42.15 25.95 0.0691 0.335 0.77
chunk_1_0: rock 0.57 39.38 26.34 0.0648 0.314 0.354
chunk_2_0: rock 0.53 38.6 25.5 0.0592 0.287 0.378
chunk_3_0: rock 0.97 49.96 20.83 0.0535 0.171 0.158
chunk_4_0: rock 1 55.74 24.24 0.0486 0.175 0.062
chunk_5_0: rock 1 43.19 28.27 0.0271 0.166 0.257
chunk_6_0: rock 1 50.9 27.54 0.0564 0.221 0.093
chunk_7_0: rock 1 56.35 28.48 0.0551 0.249 0.063
chunk_8_0: rock 1 54.4 25.51 0.0524 0.249 0.066
chunk_9_0: rock 0.98 44.84 20.47 0.0576 0.204 0.118
chunk_10_0: structure 0.99 112.42 68.5 0.0641 0.593 0.248
chunk_11_0: rock 0.62 120.95 69.49 0.057 0.574 0.008
chunk_12_0: rock 0.55 131.95 69.56 0.0587 0.599 0
chunk_-6_1: rock 0.98 41.13 26.39 0.0551 0.269 0.14
chunk_-5_1: rock 0.99 38.23 25.4 0.054 0.297 0.136
chunk_-4_1: rock 0.98 45.45 18.21 0.0451 0.242 0.569
chunk_-3_1: rock 0.74 44.17 28.1 0.0701 0.315 0.415
chunk_-2_1: rock 0.68 42.26 26.9 0.0685 0.308 0.407
chunk_-1_1: rock 0.64 41.39 27.75 0.0699 0.351 0.413
chunk_0_1: rock 0.62 40.42 27.74 0.0665 0.366 0.32
chunk_1_1: rock 0.58 39.22 27.42 0.0651 0.342 0.32
chunk_2_1: rock 0.59 39.26 26.25 0.0596 0.365 0.335
chunk_3_1: rock 0.62 40.45 26.62 0.0667 0.321 0.34
chunk_4_1: rock 0.92 30.61 22.32 0.0283 0.273 0.157
chunk_5_1: lava 0.78 54.05 47.03 0.013 0.43 0.078
chunk_6_1: rock 0.85 34.73 27.42 0.0299 0.28 0.093
chunk_7_1: rock 1 24.76 10.82 0.0247 0.271 0.108
chunk_8_1: structure 0.84 37.6 27.77 0.0612 0.502 0.286
chunk_9_1: rock 1 27.84 9.31 0.0268 0.304 0.274
chunk_10_1: rock 1 48.71 24.68 0.0421 0.266 0.551
chunk_11_1: rock 0.98 46.68 24.21 0.048 0.216 0.525
chunk_12_1: rock 0.99 52 25.61 0.0488 0.24 0.539
chunk_-6_2: rock 1 28.7 9.28 0.0319 0.26 0.194
chunk_-5_2: rock 1 26.99 7.19 0.027 0.294 0.058
chunk_-4_2: rock 1 31.63 11.02 0.0342 0.185 0.174
chunk_-3_2: rock 0.91 67.74 15.43 0.0483 0.119 0.49
chunk_-2_2: rock 0.99 65.75 17.95 0.0491 0.296 0.774
chunk_-1_2: rock 0.91 60.4 25.49 0.0581 0.413 0.715
chunk_0_2: rock 0.91 63.77 21.35 0.0505 0.321 0.497
chunk_1_2: rock 0.91 67.71 15.45 0.0483 0.124 0.49
chunk_2_2: rock 0.91 67.71 15.44 0.0483 0.122 0.489
chunk_3_2: rock 0.91 67.73 15.4 0.048 0.107 0.486
chunk_4_2: rock 1 26.56 6.26 0.0242 0.205 0.002
chunk_5_2: lava 1 116.14 23.79 0.0052 0.35 0.001
chunk_6_2: rock 0.75 43.66 31.69 0.0382 0.229 0.007
chunk_7_2: rock 1 22.25 9.47 0.0165 0.28 0.108
chunk_8_2: rock 1 32.06 10.07 0.0355 0.179 0.047
chunk_9_2: rock 1 31.55 9.8 0.0353 0.18 0.012
chunk_10_2: rock 1 35.6 20.29 0.0408 0.328 0.532
chunk_11_2: rock 1 29.01 12.03 0.0159 0.373 0.549
chunk_12_2: rock 1 37.38 21.54 0.044 0.317 0.567
chunk_-6_3: rock 0.98 43.59 29.37 0.0649 0.335 0.375
chunk_-5_3: rock 0.98 45.79 28.35 0.0631 0.278 0.516
chunk_-4_3: rock 0.99 43.6 27.78 0.0479 0.403 0.58
chunk_-3_3: rock 0.97 46.74 28.88 0.0509 0.412 0.532
chunk_-2_3: rock 0.97 40.51 28.43 0.0465 0.395 0.559
chunk_-1_3: rock 0.98 39.92 27.81 0.0403 0.391 0.571
chunk_0_3: rock 0.96 41.02 29.21 0.0498 0.398 0.552
chunk_1_3: rock 0.99 42.95 28.74 0.0456 0.393 0.564
chunk_2_3: rock 0.99 39.08 28.2 0.0449 0.407 0.529
chunk_3_3: rock 0.98 44.24 28.17 0.0507 0.401 0.592
chunk_4_3: rock 1 28.29 8.11 0.0282 0.195 0.044
chunk_5_3: lava 1 72.41 45.8 0.0281 0.294 0.011
chunk_6_3: rock 0.96 32.35 18.02 0.0388 0.274 0.104
chunk_7_3: rock 1 21.65 8.97 0.0147 0.283 0.108
chunk_8_3: rock 1 31.39 9.71 0.0328 0.139 0.041
chunk_9_3: rock 1 30.84 9.92 0.0338 0.204 0.474
chunk_10_3: rock 1 35.96 21.41 0.0405 0.315 0.547
chunk_11_3: rock 1 29.2 11.55 0.0187 0.325 0.54
chunk_12_3: rock 1 30.68 14.59 0.0271 0.391 0.552
chunk_-6_4: rock 0.97 41.61 29.64 0.0697 0.348 0.368
chunk_-5_4: rock 0.98 44.17 29.15 0.0666 0.329 0.511
chunk_-4_4: rock 0.97 39.9 28.09 0.0456 0.407 0.571
chunk_-3_4: rock 0.97 42.28 27.91 0.0444 0.416 0.592
chunk_-2_4: rock 0.97 43.22 28.77 0.0493 0.408 0.575
chunk_-1_4: rock 0.97 43.28 27.17 0.045 0.404 0.584
chunk_0_4: rock 0.97 39.91 28 0.044 0.405 0.597
chunk_1_4: rock 0.97 46.7 29.48 0.0518 0.402 0.585
chunk_2_4: rock 0.98 42.7 28.05 0.0482 0.398 0.552
chunk_3_4: rock 0.97 46.74 29.23 0.0531 0.392 0.556
chunk_4_4: rock 1 29.35 9.1 0.031 0.204 0.283
chunk_5_4: rock 1 28.01 7.76 0.0281 0.209 0.008
chunk_6_4: rock 0.96 38.79 20.44 0.0465 0.362 0.5
chunk_7_4: rock 1 21.8 9.36 0.0149 0.262 0.108
chunk_8_4: rock 1 29.19 8.63 0.0304 0.195 0.01
chunk_9_4: rock 1 29.02 8.61 0.0299 0.215 0.212
chunk_10_4: rock 1 33.36 17.23 0.0312 0.301 0.553
chunk_11_4: rock 1 36.75 20.09 0.0336 0.303 0.552
chunk_12_4: rock 1 29.24 11.81 0.0165 0.34 0.552
chunk_-6_5: rock 1 29.84 9.07 0.0308 0.168 0.01
chunk_-5_5: rock 1 30.1 10.22 0.0325 0.2 0.193
chunk_-4_5: rock 0.91 67.72 15.44 0.0482 0.122 0.49
chunk_-3_5: rock 0.91 67.71 15.45 0.0483 0.125 0.491
chunk_-2_5: rock 0.91 63.21 21.12 0.0505 0.3 0.597
chunk_-1_5: rock 0.91 60.07 24.89 0.056 0.408 0.738
chunk_0_5: rock 0.91 63.89 21.33 0.0508 0.321 0.51
chunk_1_5: rock 0.91 67.71 15.46 0.0484 0.125 0.492
chunk_2_5: rock 0.91 67.71 15.44 0.0482 0.121 0.492
chunk_3_5: rock 0.91 67.73 15.42 0.0482 0.11 0.49
chunk_4_5: rock 0.97 30.22 12.59 0.0345 0.265 0.23
chunk_5_5: rock 1 30.93 9.55 0.0331 0.167 0.038
chunk_6_5: rock 1 28.22 7.95 0.0286 0.216 0.009
chunk_7_5: rock 1 21.61 8.89 0.0146 0.277 0.108
chunk_8_5: rock 1 30.48 9.36 0.0335 0.194 0.015
chunk_9_5: rock 1 30.35 9.35 0.0339 0.214 0.337
chunk_10_5: rock 1 36.52 19.89 0.0356 0.27 0.528
chunk_11_5: rock 1 36.39 19.18 0.026 0.261 0.568
chunk_12_5: rock 1 32.45 16.09 0.0222 0.3 0.545
