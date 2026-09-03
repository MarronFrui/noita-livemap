// Coordinate mapping between wang bigMap pixels and world/chunk space.
//
// THE fitting ground: when the diff shows systematic shifts/mirrors, the
// correction knobs live here. Initial implementation is the naive mapping
// inferred from noita-tools' iterateMap() (mapWasm.ts:166-185):
//   bigMap x-offset of biome-map column tx = GetWidthFromPix(area.x1, tx) * 10
//
// Correction knobs (in bigMap pixels), to be fitted against the capture:
export const CORRECTION = {
  offsetX: 0,
  offsetY: 0,
  flipX: false,
  flipY: false,
};

export function chunkToBigMapRect(wangModule, big, area, tx, ty) {
  const dxCells = wangModule.wasm.GetWidthFromPixRaw(area.x1, tx);
  const dyCells = wangModule.wasm.GetWidthFromPixRaw(area.y1, ty);
  let bx = dxCells * 10 + CORRECTION.offsetX;
  let by = dyCells * 10 + CORRECTION.offsetY;

  if (CORRECTION.flipX) {
    bx = wang.bigWidth - bx - 512;
  }
  if (CORRECTION.flipY) {
    by = wang.bigHeight - by - 512;
  }
  return { bx, by };
}

// World chunk index for a biome-map pixel (x=0 at map center, y=0 at biome_offset_y)
export function chunkOfBiomePixel(config, tx, ty) {
  return { cx: tx - config.map.width / 2, cy: ty - config.biomeOffsetY };
}
