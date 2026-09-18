// Synthetic corner-mode wang template, built in-canvas (no PNG files needed).
// The header encoding mirrors buildTileset's decoder: header[i] is stored as
// `decoded ^ (i*55)` in the last 9 bytes of the image's first RGB row.

export function makeCornerAtlas(numColor = [1, 1, 1, 1], s = 4, varyX = 1, varyY = 1, shade = 40) {
  const W = 96, H = 128;
  const data = new Uint8Array(W * H * 4).fill(255);
  for (let i = 0; i < W * H; i++) {
    data[4 * i] = shade; data[4 * i + 1] = shade; data[4 * i + 2] = shade; data[4 * i + 3] = 255;
  }
  const hdr = [numColor[0], numColor[1], numColor[2], numColor[3], varyX, varyY, s, 0xc0, 0];
  for (let i = 0; i < 9; i++) {
    const b = W * 3 - 1 - i;
    const px = Math.floor(b / 3);
    const ch = b % 3;
    data[px * 4 + ch] = hdr[i] ^ (i * 55);
  }
  return { width: W, height: H, data };
}

// Expected tile counts from the template-walk loops in wang-js.mjs
// (process_h_row: outer nc2*nc1*nc0*varyY rows x inner varyX*nc3*nc2*nc1 tiles).
export function expectedTileCounts(numColor, varyX = 1, varyY = 1) {
  const hRows = numColor[2] * numColor[1] * numColor[0] * varyY;
  const vRows = numColor[3] * numColor[0] * numColor[1] * varyX;
  return {
    hTiles: hRows * (varyX * numColor[3] * numColor[2] * numColor[1]),
    vTiles: vRows * (varyY * numColor[2] * numColor[3] * numColor[0]),
  };
}
