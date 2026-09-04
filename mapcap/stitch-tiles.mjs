// Median-stitch noita-mapcap capture tiles (1024x1024 PNGs named "<x>,<y>.png",
// top-left world coords, 512px grid, 50% overlap) into one RGBA canvas.
// Equivalent to the mod's Go stitcher for static worlds (tiles agree ~99.6%).
//
//   node mapcap/stitch-tiles.mjs --tiles <dir> --out <png>
//   [--blend-limit 0]  limit to n newest tiles by mtime (0 = all)

import fs from "node:fs";
import path from "node:path";
import { readPng, writePng, pngDimensions } from "../mapgen/lib/images.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}
const args = parseArgs(process.argv);
const tilesDir = args.tiles ?? "/mnt/e/Programmes/Steam/steamapps/common/Noita/mods/noita-mapcap/output";
const outPath = args.out ?? path.resolve("mapcap/out/stitched.png");
const blendLimit = Number(args["blend-limit"] ?? 0);

const files = fs.readdirSync(tilesDir)
  .filter(f => /^-?\d+,-?\d+\.png$/.test(f))
  .map(f => {
    const [x, y] = f.replace(".png", "").split(",").map(Number);
    return { x, y, file: f, mtime: fs.statSync(path.join(tilesDir, f)).mtimeMs };
  });
files.sort((a, b) => a.mtime - b.mtime); // oldest first; blend-limit keeps newest
const kept = blendLimit > 0 ? files.slice(-blendLimit) : files;

const dims = pngDimensions(path.join(tilesDir, kept[0].file));
if (dims.width !== 1024 || dims.height !== 1024) throw new Error(`unexpected tile size ${dims.width}x${dims.height}`);
const STEP = 512, TILE = 1024;

const minX = Math.min(...kept.map(t => t.x));
const minY = Math.min(...kept.map(t => t.y));
const maxX = Math.max(...kept.map(t => t.x + TILE));
const maxY = Math.max(...kept.map(t => t.y + TILE));
const W = maxX - minX, H = maxY - minY;
console.log(`${kept.length} tiles, canvas ${W}x${H} (origin world ${minX},${minY})`);

// Per pixel, up to 4 tiles cover it (2 in x, 2 in y). Slot index = parity of
// grid cell ((coord-256)/512) so each covering tile writes an exclusive slot.
const slots = [0, 1, 2, 3].map(() => Buffer.alloc(W * H * 4, 0)); // RGBA, 0 = empty
const counts = new Uint8Array(W * H);
const canvas = Buffer.alloc(W * H * 4);

for (const t of kept) {
  const png = readPng(path.join(tilesDir, t.file));
  const kx = Math.round((t.x - 256) / STEP), ky = Math.round((t.y - 256) / STEP);
  const slot = ((kx & 1) << 1) | (ky & 1);
  const S = slots[slot];
  for (let r = 0; r < TILE; r++) {
    const cy = t.y + r - minY;
    if (cy < 0 || cy >= H) continue;
    for (let c = 0; c < TILE; c++) {
      const cx = t.x + c - minX;
      if (cx < 0 || cx >= W) continue;
      const di = (cy * W + cx) * 4, si = (r * TILE + c) * 4;
      S[di] = png.data[si]; S[di + 1] = png.data[si + 1]; S[di + 2] = png.data[si + 2]; S[di + 3] = 255;
      counts[cy * W + cx] |= (1 << slot);
    }
  }
}

for (let p = 0; p < W * H; p++) {
  const mask = counts[p];
  const di = p * 4;
  if (mask === 0) { canvas[di + 3] = 255; continue; } // leave black
  const vals = [];
  for (let s = 0; s < 4; s++) {
    if (mask & (1 << s)) {
      const src = slots[s];
      vals.push([src[di], src[di + 1], src[di + 2]]);
    }
  }
  let r, g, b;
  if (vals.length === 1) { [r, g, b] = vals[0]; }
  else {
    // median per channel (average of two middles for even counts)
    const ch = (k) => {
      const v = vals.map(t => t[k]).sort((a, b) => a - b);
      const m = v.length >> 1;
      return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
    };
    r = ch(0); g = ch(1); b = ch(2);
  }
  canvas[di] = r; canvas[di + 1] = g; canvas[di + 2] = b; canvas[di + 3] = 255;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
writePng(outPath, W, H, canvas);
console.log(`wrote ${outPath}; world origin of canvas = (${minX},${minY})`);
