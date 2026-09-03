// Coordinate mapping between wang bigMap pixels and world/chunk space.
//
// The bigMap is the per-area cell grid (10 world px per cell). To crop a
// chunk we need the world-px origin of the bigMap, which depends on where
// the cell lattice is anchored:
//
//   mode 'noitool' — chunk p content starts at cell floor(51.2*p) (raw
//     biome-px anchored). Has a sawtooth error of (512*p mod 10) px vs any
//     world-anchored model — the thing this module exists to test.
//   mode 'snap' (H1) — lattice anchored at world 0: cell boundaries at
//     multiples of 10 (+ sub-cell phase). Area origin snaps to the cell
//     containing world px of biome px area.x1.
//   mode 'exact' (H2) — lattice re-anchored at the area's first chunk start.
//
// CORRECTION is an extra post-hoc knob pair for fitting.

export const ANCHOR = { mode: "snap", phaseX: 0, phaseY: 0 };
export const CORRECTION = { offsetX: 0, offsetY: 0, flipX: false, flipY: false };

export const CHUNK = 512;
export const CELL = 10;
export const OFFSET_X = 35;
export const OFFSET_Y = 14;

const floorDiv = (a, b) => Math.floor(a / b);

// World px of the top-left corner of the chunk at biome-map px p
export const worldOfBiomePx = (p, offset) => CHUNK * (p - offset);

export function chunkToBigMapRect(wangModule, big, area, tx, ty) {
  const wx = worldOfBiomePx(tx, OFFSET_X);
  const wy = worldOfBiomePx(ty, OFFSET_Y);
  const wx0 = worldOfBiomePx(area.x1, OFFSET_X);
  const wy0 = worldOfBiomePx(area.y1, OFFSET_Y);

  let originX, originY;
  if (ANCHOR.mode === "noitool") {
    // status quo: cells measured on raw biome-map px via the wasm function
    const dx = wangModule.wasm.GetWidthFromPixRaw(area.x1, tx);
    const dy = wangModule.wasm.GetWidthFromPixRaw(area.y1, ty);
    originX = wx - dx * CELL;
    originY = wy - dy * CELL;
  } else if (ANCHOR.mode === "snap") {
    originX = CELL * floorDiv(wx0, CELL) + ANCHOR.phaseX;
    originY = CELL * floorDiv(wy0, CELL) + ANCHOR.phaseY;
  } else {
    // 'exact' (H2)
    originX = wx0;
    originY = wy0;
  }

  let bx = wx - originX + CORRECTION.offsetX;
  let by = wy - originY + CORRECTION.offsetY;

  if (CORRECTION.flipX) {
    bx = big.bigWidth - bx - CHUNK;
  }
  if (CORRECTION.flipY) {
    by = big.bigHeight - by - CHUNK;
  }
  return { bx, by };
}

// World chunk index for a biome-map pixel (x=0 at map center, y=0 at biome_offset_y)
export function chunkOfBiomePixel(config, tx, ty) {
  return { cx: tx - config.map.width / 2, cy: ty - config.biomeOffsetY };
}
