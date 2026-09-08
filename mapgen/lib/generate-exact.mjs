// generateAreaExact — the full game-faithful area generator (Node-only):
// driver chain (VERIFIED.md §5) + fill + hasPath rejection loop.
// Returns the ACCEPTED attempt exactly as the game's out_map stands after
// hasPath (blockOutRooms whites + coalmine hax applied — finalize input).
// Browser code must not import this (fs access for the overlay).

import { buildTileset, NollaPrng, generateCorner } from "./wang-js.mjs";
import { hasPath, finalizeLite } from "./has-path.mjs";

const C1 = 4.656612875e-10;

export function chainParam9(seedN, w, A) {
  const driver = new NollaPrng(0);
  driver.seed = seedN >>> 0;
  driver.next(); // warm-up
  const skip = (w % 11) + ((seedN >>> 0) % 12);
  for (let t = 0; t < skip; t++) driver.next();
  for (let a = 0; a <= A; a++) driver.next();
  return driver.seed * C1 * 2147483645.0;
}

function fillAttempt(ts, w, h, param9) {
  const tls = new NollaPrng(param9);
  const res = generateCorner(
    ts, w, h + 4,
    (i, j, p) => tls.nextU() % ts.numColor[p],
    (i, j, n) => tls.nextU() % n,
    (i, j, p, old) => {
      const off = 1 + (tls.nextU() % (ts.numColor[p] - 1));
      return (old + off) % ts.numColor[p];
    }
  );
  return res.rgb.subarray(3 * w * 4); // +4-row discard
}

// ts: buildTileset(png); w/h: area dims in cells (per-term GetWidthFromPix);
// opts: { isCoalMine, shouldBlockOutRooms, worldX = x1-35, worldY = y1-14 }
export function generateAreaExact(ts, w, h, seed, opts = {}) {
  const {
    isCoalMine = false, shouldBlockOutRooms = false,
    worldX = 0, worldY = 0, maxAttempts = 100,
    finalize = true, // genmap rendering: undoCoalMineHax + blocked rooms -> air
  } = opts;
  let last = null;
  for (let A = 0; A < maxAttempts; A++) {
    const param9 = chainParam9(seed, w, A);
    const rgb = fillAttempt(ts, w, h, param9);
    const r = hasPath(rgb, w, h, { isCoalMine, shouldBlockOutRooms, worldX, worldY });
    if (r.ok) {
      if (finalize) finalizeLite(rgb, w, h, { isCoalMine, blockList: r.blockList });
      return { rgb, attempt: A, blockList: r.blockList, endNode: r.endNode };
    }
    last = { rgb, attempt: A, blockList: r.blockList ?? [] };
  }
  // >100 attempts: the game's driver loop ends with the last candidate still
  // in the buffer (no acceptance) — keep it instead of rendering black.
  // (Inferred from the loop structure; asm check of the tail is open.)
  if (last) {
    if (finalize) finalizeLite(last.rgb, w, h, { isCoalMine, blockList: last.blockList });
    return { ...last, endNode: null };
  }
  return null;
}

export { buildTileset };
