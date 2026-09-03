// JS port of the stbhw corner-mode wang generator + noitool's seeding,
// with a PLUGGABLE vertex-coloring source:
//   - 'seq': sequential stream exactly like noita_random.wasm (GetRNG + attempts)
//   - 'pos': per-vertex position-seeded game RNG (SetRandomSeed(worldSeed, x, y))
//
// Purpose: test whether the game colors wang vertices by world position
// (required for camera-order chunk generation) instead of one sequential
// stream. See ABOUT_MATH.md §7 experiment 1/2.

const U32 = 0x100000000;

function u32(x) {
  return x >>> 0;
}
function uadd(a, b) {
  return (a + b) >>> 0;
}
function usub(a, b) {
  return (a - b + U32) >>> 0;
}
function imul32(a, b) {
  return Math.imul(a | 0, b | 0) >>> 0;
}
function truncDiv(a, b) {
  // C-style truncation toward zero
  return Math.trunc(a / b);
}
function toI32(x) {
  return x | 0;
}

// --- NollaPrng (exact port of noita_random.cpp / nolla_prng.zig) ---
export class NollaPrng {
  constructor(seed) {
    this.seed = seed; // double
    this.next(); // warm-up
  }
  next() {
    const seedInt = toI32(this.seed);
    let v = usub(imul32(0x41a7, seedInt), imul32(0x7fffffff, truncDiv(seedInt, 0x1f31d)));
    v = toI32(v);
    if (v <= 0) v = toI32(uadd(v, 0x7fffffff));
    this.seed = v;
    return v / 0x7fffffff;
  }
  nextU() {
    this.next();
    return Math.trunc(this.seed * 4.656612875e-10 * 2147483645.0) >>> 0;
  }
  random(min, max) {
    const range = max + 1 - min;
    return min + Math.trunc(range * this.next());
  }
  setRandomFromWorldSeed(seed) {
    this.seed = seed;
    if (this.seed >= 2147483647.0) this.seed = seed * 0.5;
  }
}

// --- SetRandomSeed (exact port of nolla_prng.zig) ---
function setRandomSeedHelper(value) {
  // trunc double -> i64, keep low 32 bits as u32; 0 for non-finite/out-of-range
  if (!Number.isFinite(value) || value < -9.223372036854776e18 || value >= 9.223372036854776e18) {
    return 0;
  }
  const big = BigInt(Math.trunc(value));
  return Number(BigInt.asUintN(32, big));
}

function setRandomSeedHelper2(a, b, ws) {
  let v2 = usub(usub(a, b), ws) ^ (ws >>> 0x0d);
  let v1 = usub(usub(b, v2), ws) ^ u32(v2 << 8);
  let v3 = usub(usub(ws, v2), v1) ^ (v1 >>> 0x0d);
  v2 = usub(usub(v2, v1), v3) ^ (v3 >>> 0x0c);
  v1 = usub(usub(v1, v2), v3) ^ u32(v2 << 0x10);
  v3 = usub(usub(v3, v2), v1) ^ (v1 >>> 5);
  v2 = usub(usub(v2, v1), v3) ^ (v3 >>> 3);
  v1 = usub(usub(v1, v2), v3) ^ u32(v2 << 10);
  return usub(usub(v3, v2), v1) ^ (v1 >>> 0x0f);
}

const DIDDLERS = [0, 4, 6, 25, 12, 39, 52, 9, 21, 64, 78, 92, 104, 118, 18, 32, 44];
const MAGIC = 252645135;
const U32_MAX_HALF = 0x80000000;
const asU32 = (b) => (b ? 1 : 0);

export function seededPrng(worldSeed, x, y) {
  const ws = worldSeed >>> 0;
  const a = ws ^ 0x93262e6f;
  const b = a & 0xfff;
  const c = (a >>> 0x0c) & 0xfff;

  const xAdj = x + b;
  let yAdj = y + c;

  let material = xAdj * 134217727.0;
  const e = setRandomSeedHelper(material);

  if (Math.abs(yAdj) >= 102400.0 || Math.abs(xAdj) <= 1.0) {
    material = yAdj * 134217727.0;
  } else {
    let yWork = yAdj * 3483.328;
    yWork += e;
    yAdj *= yWork;
    material = yAdj;
  }

  const f = setRandomSeedHelper(material);
  const g = setRandomSeedHelper2(e, f, ws);

  let t = g;
  t = uadd(t, uadd(asU32(g < U32_MAX_HALF), asU32(g === 0)));
  t = usub(t, Math.floor(g / MAGIC));
  t = uadd(t, asU32(g % MAGIC < DIDDLERS[Math.floor(g / MAGIC)] && (g < 0xc3c3c3c3 + 4 || g >= 0xc3c3c3c3 + 62)));
  t = ((uadd(t, asU32(g > U32_MAX_HALF))) >>> 1) >>> 0;
  t = uadd(t, asU32(g === 0xffffffff));

  const rng = new NollaPrng(0);
  rng.seed = t;
  rng.next();
  for (let h = ws & 3; h !== 0; h--) rng.next();
  return rng;
}

// Positional color source: SetRandomSeed at a world position, one draw.
// Usage: color = posRng(worldX, worldY, 0, cc-1)
export function makePositionalSource(worldSeed) {
  return (x, y, min, max) => seededPrng(worldSeed, x, y).random(min, max);
}

// --- tileset build (port of stbhw_build_tileset_from_image, corner mode) ---
export function buildTileset(png) {
  const { width: w, height: h, data } = png;
  const rgb = (x, y) => {
    const i = 4 * (y * w + x);
    return [data[i], data[i + 1], data[i + 2]];
  };

  const hdr = [];
  for (let i = 0; i < 9; i++) {
    const b = w * 3 - 1 - i;
    const px = Math.floor(b / 3);
    const ch = b % 3;
    hdr.push((data[px * 4 + ch] ^ (i * 55)) & 0xff);
  }
  if (hdr[7] !== 0xc0) throw new Error("only corner-type tilesets supported");
  const numColor = hdr.slice(0, 4);
  const varyX = hdr[4];
  const varyY = hdr[5];
  const s = hdr[6];
  if (!s) throw new Error("bad short_side_len");

  const hTiles = [];
  const vTiles = [];

  const parseH = (xpos, ypos, a, b, c, d, e, f) => {
    const pixels = [];
    for (let j = 0; j < s; j++)
      for (let i = 0; i < 2 * s; i++) pixels.push(...rgb(xpos + 1 + i, ypos + 1 + j));
    hTiles.push({ a, b, c, d, e, f, w: 2 * s, h: s, pixels });
  };
  const parseV = (xpos, ypos, a, b, c, d, e, f) => {
    const pixels = [];
    for (let j = 0; j < 2 * s; j++)
      for (let i = 0; i < s; i++) pixels.push(...rgb(xpos + 1 + i, ypos + 1 + j));
    vTiles.push({ a, b, c, d, e, f, w: s, h: 2 * s, pixels });
  };

  // template walk (corner branch of stbhw__process_template)
  let ypos = 2;
  for (let k = 0; k < numColor[2]; k++)
    for (let j = 0; j < numColor[1]; j++)
      for (let i = 0; i < numColor[0]; i++)
        for (let q = 0; q < varyY; q++) {
          // process_h_row with a in [0,nc1), b in [0,nc2), c in [0,nc3), d=i, e=j, f=k
          let xpos = 0;
          for (let f = 0; f < 1; f++)
            for (let cc = 0; cc < numColor[3]; cc++)
              for (let bb = 0; bb < numColor[2]; bb++)
                for (let aa = 0; aa < numColor[1]; aa++) {
                  parseH(xpos, ypos, aa, bb, cc, i, j, k);
                  xpos += 2 * s + 3;
                }
          ypos += s + 3;
        }
  ypos += 2;
  for (let k = 0; k < numColor[3]; k++)
    for (let j = 0; j < numColor[0]; j++)
      for (let i = 0; i < numColor[1]; i++)
        for (let q = 0; q < varyX; q++) {
          // process_v_row with a in [0,nc0), b in [0,nc3), c in [0,nc2), d=i, e=j, f=k
          let xpos = 0;
          for (let f = 0; f < 1; f++)
            for (let cc = 0; cc < numColor[2]; cc++)
              for (let bb = 0; bb < numColor[3]; bb++)
                for (let aa = 0; aa < numColor[0]; aa++) {
                  parseV(xpos, ypos, aa, bb, cc, i, j, k);
                  xpos += s + 3;
                }
          ypos += 2 * s + 3;
        }

  return { isCorner: true, numColor, shortSideLen: s, hTiles, vTiles, width: w, height: h };
}

// --- corner-mode fill (port of stbhw_generate_image corner branch) ---
// colorSource(i, j, cornerType) -> color int in [0, numColor[cornerType])
// choiceSource(i, j, n) -> int in [0, n)   (tile pick)
// repReduce: run the repetition-reduction pass (needs colorSource-compatible
//   recolor; for 'pos' mode pass null to skip, mirroring NO_REPITITION_REDUCTION)
export function generateCorner(ts, w, h, colorSource, choiceSource, repReduce) {
  const s = ts.shortSideLen;
  const cc = ts.numColor;
  const xmax = Math.floor(w / s) + 6;
  const ymax = Math.floor(h / s) + 6;

  const cColor = [];
  for (let j = 0; j < ymax; j++) {
    cColor[j] = [];
    for (let i = 0; i < xmax; i++) {
      const p = ((i - j + 1) & 3) & 3;
      cColor[j][i] = colorSource(i, j, p);
    }
  }

  const match = (x, y) => cColor[y][x] === cColor[y + 1][x + 1];

  if (repReduce) {
    for (let j = 0; j < ymax - 3; j++)
      for (let i = 0; i < xmax - 3; i++) {
        if (match(i, j) && match(i, j + 1) && match(i, j + 2) && match(i + 1, j) && match(i + 1, j + 1) && match(i + 1, j + 2)) {
          const p = ((i + 1) - (j + 1) + 1) & 3;
          if (cc[p] > 1) cColor[j + 1][i + 1] = repReduce(i + 1, j + 1, p, cColor[j + 1][i + 1]);
        }
        if (match(i, j) && match(i + 1, j) && match(i + 2, j) && match(i, j + 1) && match(i + 1, j + 1) && match(i + 2, j + 1)) {
          const p = ((i + 2) - (j + 1) + 1) & 3;
          if (cc[p] > 1) cColor[j + 1][i + 2] = repReduce(i + 2, j + 1, p, cColor[j + 1][i + 2]);
        }
      }
  }

  const out = Buffer.alloc(3 * w * h, 0); // RGB, black = air
  const drawTile = (tile, xpos, ypos) => {
    for (let y = 0; y < tile.h; y++) {
      const oy = ypos + y;
      if (oy < 0 || oy >= h) continue;
      for (let x = 0; x < tile.w; x++) {
        const ox = xpos + x;
        if (ox < 0 || ox >= w) continue;
        const si = 3 * (y * tile.w + x);
        const di = 3 * (oy * w + ox);
        out[di] = tile.pixels[si];
        out[di + 1] = tile.pixels[si + 1];
        out[di + 2] = tile.pixels[si + 2];
      }
    }
  };

  const chooseTile = (list, cells) => {
    const [A, B, C, D, E, F] = cells;
    let m = 1 << 30;
    for (let pass = 0; pass < 2; pass++) {
      let n = 0;
      for (const t of list) {
        if ((A.v >= 0 && A.v !== t.a) || (B.v >= 0 && B.v !== t.b) || (C.v >= 0 && C.v !== t.c) ||
            (D.v >= 0 && D.v !== t.d) || (E.v >= 0 && E.v !== t.e) || (F.v >= 0 && F.v !== t.f)) {
          continue;
        }
        n += 1;
        if (n > m) {
          A.v = t.a; B.v = t.b; C.v = t.c; D.v = t.d; E.v = t.e; F.v = t.f;
          return t;
        }
      }
      if (n === 0) throw new Error("no tile matches constraints");
      m = choiceSource(A.i, A.j, n);
    }
    throw new Error("unreachable");
  };
  const cell = (i, j) => ({ v: cColor[j][i], i, j });
  const setCell = (cellRef) => {
    cColor[cellRef.j][cellRef.i] = cellRef.v;
  };

  let ypos = -s;
  for (let j = -1; ypos < h; j++) {
    const phase = j & 3;
    let i = phase === 0 ? 0 : phase - 4;
    for (;; i += 4) {
      let xpos = i * s;
      if (xpos >= w) break;
      if (xpos + 2 * s >= 0 && ypos >= 0) {
        const cells = [
          cell(i + 2, j + 2), cell(i + 3, j + 2), cell(i + 4, j + 2),
          cell(i + 2, j + 3), cell(i + 3, j + 3), cell(i + 4, j + 3),
        ];
        const t = chooseTile(ts.hTiles, cells);
        cells.forEach(setCell);
        drawTile(t, xpos, ypos);
      }
      xpos += 2 * s;
      xpos += s;
      if (xpos < w) {
        const cells = [
          cell(i + 5, j + 2), cell(i + 5, j + 3), cell(i + 5, j + 4),
          cell(i + 6, j + 2), cell(i + 6, j + 3), cell(i + 6, j + 4),
        ];
        const t = chooseTile(ts.vTiles, cells);
        cells.forEach(setCell);
        drawTile(t, xpos, ypos);
      }
    }
    ypos += s;
  }

  return { width: w, height: h, rgb: out };
}
