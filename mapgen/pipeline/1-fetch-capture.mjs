// Download the ground-truth capture tiles (noitamap, seed 78633191) for a
// biome-map pixel window and slice them into 512x512 chunk PNGs in out/ref/.
//
// DZI grid == biome-map pixel grid:
//   middle segment TopLeft = (-17920, -31744) = (-35*512, -62*512) world px
//   biome-map px (tx,ty) is world chunk (tx-35, ty-14) = DZI tile (tx, ty+48)

import fs from "node:fs";
import path from "node:path";
import { repoRoot, captureTilesources } from "../lib/paths.mjs";
import { writePng } from "../lib/images.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const MAP = arg("map", "regular-main-branch");
const LEVEL = 17; // native resolution
const x0 = Number(arg("x0", 30));
const x1 = Number(arg("x1", 45));
const y0 = Number(arg("y0", 12));
const y1 = Number(arg("y1", 17));
const outDir = arg("out", "mapgen/out/ref");

const segments = captureTilesources[MAP].map((entry) => {
  const dzi = JSON.parse(entry.dziContent).Image;
  const base = entry.url.replace(/\.dzi$/, "");
  return {
    base,
    format: dzi.Format,
    size: dzi.Size,
    topLeft: dzi.TopLeft,
  };
});

// biome-map px -> segment: middle covers tx 0..70 (world x -35..+35)
function segmentFor(tx) {
  if (tx >= 0 && tx <= 70) return segments[0];
  return tx < 0 ? segments[1] : segments[2];
}

const cacheDir = path.join(repoRoot, "mapgen/out/cache/tiles");
fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const fetchTile = async (seg, i, j) => {
  const cachePath = path.join(cacheDir, `${path.basename(seg.base)}-${LEVEL}-${i}_${j}.${seg.format}`);
  if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath);
  const url = `${seg.base}_files/${LEVEL}/${i}_${j}.${seg.format}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(cachePath, buf);
  return buf;
};

const sharp = (await import("sharp")).default;
const manifest = { map: MAP, level: LEVEL, window: { x0, x1, y0, y1 }, chunks: {} };

for (let ty = y0; ty <= y1; ty++) {
  for (let tx = x0; tx <= x1; tx++) {
    const seg = segmentFor(tx);
    const i = tx;
    const j = ty + 48;
    const buf = await fetchTile(seg, i, j);

    // Tile (i,j) covers image px [i*512-overlap, i*512+512+overlap); the chunk
    // is the exact 512x512 core. Edge tiles are clipped -> smaller margins.
    const image = sharp(buf);
    const meta = await image.metadata();
    const left = i * 512 > 0 ? 2 : 0;
    const top = j * 512 > 0 ? 2 : 0;
    if (meta.width < left + 512 || meta.height < top + 512) {
      throw new Error(`tile ${i}_${j} too small: ${meta.width}x${meta.height}`);
    }
    const chunk = await image
      .extract({ left, top, width: 512, height: 512 })
      .ensureAlpha()
      .raw()
      .toBuffer();

    const file = `${tx}_${ty}.png`;
    writePng(path.join(outDir, file), 512, 512, chunk);
    manifest.chunks[`${tx}_${ty}`] = { segment: path.basename(seg.base), tile: `${i}_${j}` };
    process.stdout.write(".");
  }
}

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nwrote ${Object.keys(manifest.chunks).length} reference chunks to ${outDir}`);
