// Lake-anchor dump (dig #168 recon, user mandate): render our gen's COLORS
// + the ref + a mask diff for ONE tile — tile (40,14) = world x 2560..3072,
// y 0..512 = the mountain_lake splice scene (the always-present pool east of
// the mountain, above the lava pit, per the user). Lane = C79's (SURFACE_V3).
// Output: mapgen/out/lake-anchor-40_14.png (panel1 ref | panel2 gen colors |
// panel3 diff: yellow=both, red=ref-only, green=gen-only, dark=both-air).

import fs from "node:fs";
import path from "node:path";

const LANE_V3 = process.env.SURFACE_V3 === "1";
if (!LANE_V3) { console.error("refusing: SURFACE_V3=1 required (C79 lane)"); process.exit(2); }

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { ensureWorld, worldColorAt, SKY_ROWS, CHUNK } = await import("../lib/world-gen.mjs");
const { readPng, writePng } = await import("../lib/images.mjs");

const AIR_THRESHOLD = 24;
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const TX = Number(process.argv[2] ?? 40), BTY = Number(process.argv[3] ?? 14);

const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i");
const world = ensureWorld(CAPTURE_SEED, findNoitaDataDir(), { cacheDir });
await world.ready;

const ref = readPng(path.join(repoRoot, `mapgen/out/ref/${TX}_${BTY}.png`));
const N = 512 * 512;
const rgba = Buffer.alloc(4 * 3 * N);
const R = new Uint8Array(N), G = new Uint8Array(N);
for (let y = 0; y < 512; y++) {
  for (let x = 0; x < 512; x++) {
    const i = y * 512 + x, rq = 4 * i;
    const at = (p) => 4 * (y * 1536 + p * 512 + x);
    // panel 1: ref
    const q1 = at(0);
    rgba[q1] = ref.data[rq]; rgba[q1 + 1] = ref.data[rq + 1]; rgba[q1 + 2] = ref.data[rq + 2]; rgba[q1 + 3] = 255;
    // panel 2: gen colors
    const col = worldColorAt(world, TX * CHUNK + x, (BTY + SKY_ROWS) * CHUNK + y);
    const o = at(1);
    if (col) { rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; }
    else { rgba[o] = 8; rgba[o + 1] = 8; rgba[o + 2] = 8; }
    rgba[o + 3] = 255;
    R[i] = (0.299 * ref.data[rq] + 0.587 * ref.data[rq + 1] + 0.114 * ref.data[rq + 2]) >= AIR_THRESHOLD ? 1 : 0;
    G[i] = col ? (lum(col[0], col[1], col[2]) >= AIR_THRESHOLD ? 1 : 0) : 0;
    // panel 3: diff
    const d = at(2);
    if (R[i] && G[i]) { rgba[d] = 200; rgba[d + 1] = 200; rgba[d + 2] = 0; }
    else if (R[i]) { rgba[d] = 220; rgba[d + 1] = 40; rgba[d + 2] = 40; }
    else if (G[i]) { rgba[d] = 40; rgba[d + 1] = 200; rgba[d + 2] = 40; }
    else { rgba[d] = 24; rgba[d + 1] = 24; rgba[d + 2] = 24; }
    rgba[d + 3] = 255;
  }
}
let inter = 0, uni = 0, sumR = 0, sumG = 0;
for (let i = 0; i < N; i++) { sumR += R[i]; sumG += G[i]; if (R[i] && G[i]) inter++; if (R[i] || G[i]) uni++; }
console.log(`tile ${TX}_${BTY}  fR=${(sumR / N * 100).toFixed(2)}%  fG=${(sumG / N * 100).toFixed(2)}%  iou=${(inter / uni).toFixed(4)}`);
const out = path.join(repoRoot, `mapgen/out/lake-anchor-${TX}_${BTY}.png`);
writePng(out, 1536, 512, rgba);
console.log("wrote", out);
