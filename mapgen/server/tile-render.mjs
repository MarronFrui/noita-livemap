// The tile law (moved verbatim from genmap-server.mjs, 2026-11-08, so the
// server, its tile workers and the probes share ONE implementation).
// colorAt(canvasX, canvasY) -> [r, g, b] | null; returns RGBA 512×512.

import { PNG } from "pngjs";

// Tile rendering. Zoom semantics dig (52) — the moiré fix:
// z=0: 1:1 per world px (the canonical paint).
// z>0: a tile's scale-block covers `scale` world px per axis. The global
// point-sample `(y*512+j)*scale` aliases badly across lanes (art px, wang
// cells and the old noise speckle) — it made the zoomed-out map "pop"
// solid/air inconsistently with zoom level (the dense-rock-at-out-zoom
// report). The honest downsample: per output pixel, enumerate the distinct
// 10-world-px wang cells inside the block (steps of 10, cell centers),
// count solid vs air, and emit the majority's color (air = transparent).
export function renderTileRGBA(colorAt, z, x, y) {
  const data = new Uint8Array(512 * 512 * 4);
  let p = 0;
  if (z === 0) {
    for (let j = 0; j < 512; j++) {
      const wy = (y * 512 + j);
      for (let i = 0; i < 512; i++) {
        const wx = (x * 512 + i);
        const c = colorAt(wx, wy);
        if (c) {
          data[p] = c[0];
          data[p + 1] = c[1];
          data[p + 2] = c[2];
        }
        data[p + 3] = 255;
        p += 4;
      }
    }
    return data;
  }
  const scale = 2 ** z;
  const step = Math.min(scale, 10);
  // one reused tally scratch (cleared per pixel — no 512² Map churn)
  const tally = new Map();
  for (let j = 0; j < 512; j++) {
    const wy0 = (y * 512 + j) * scale;
    for (let i = 0; i < 512; i++) {
      const wx0 = (x * 512 + i) * scale;
      let solid = 0, total = 0, best = null, bestN = 0;
      tally.clear();
      for (let sy = 0; sy < scale; sy += step) {
        const wy = wy0 + Math.min(sy + (step >> 1), scale - 1);
        for (let sx = 0; sx < scale; sx += step) {
          const wx = wx0 + Math.min(sx + (step >> 1), scale - 1);
          const c = colorAt(wx, wy);
          total++;
          if (!c) continue;
          solid++;
          const key = ((c[0] >> 2) << 10) | ((c[1] >> 2) << 5) | (c[2] >> 2);
          const it = (tally.get(key) ?? 0) + 1;
          tally.set(key, it);
          if (it > bestN) { bestN = it; best = c; }
        }
      }
      if (solid * 2 >= total && best) {
        data[p] = best[0]; data[p + 1] = best[1]; data[p + 2] = best[2];
      }
      data[p + 3] = 255;
      p += 4;
    }
  }
  return data;
}


export function encodeTilePng(rgba) {
  const png = new PNG({ width: 512, height: 512 });
  png.data.set(rgba);
  return PNG.sync.write(png);
}
