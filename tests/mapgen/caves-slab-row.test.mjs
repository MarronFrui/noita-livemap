// dig #192 — the BAND-ANCHORED FINITE caves cell-read (C165/X205;
// caves-field.mjs cavesCellAt = the pure unit behind noiseChunkMask's caves
// gradAt). Count tests per the charter: 0-entry (above-band air), 1-entry
// (the band's row 0), N-entries (the served rows + the deep wrap), the
// skip-path contract, AND the replacement test that FAILS under the old
// `wy < 0` air-guard arithmetic (dig #131's law — row 73's invention): for
// wy ∈ [-fh, 0) the old guard returned 0 where the new law reads the field's
// rows [0, fh) — the user's flat floor (bty13 gen fG 0.024 vs capture fR
// 0.03–0.22). Synthetic grids only (no extracted data needed).

import { describe, test, expect } from "vitest";
import { cavesCellAt, cavesShapedCellAt } from "../../mapgen/lib/caves-field.mjs";
import { simplex2d, latticeGrad2d, latticeVal2d } from "../../mapgen/lib/noise-proto.mjs";

// A synthetic 4×4 field with DISTINCT per-cell values so every mapping case
// has exactly one yield (values chosen inside (>0.5 solid) and < 0.5 air-ish
// to also exercise the mask gate direction downstream).
function makeField() {
  const w = 4, h = 4;
  const field = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) field[i] = (i + 1) / 10; // 0.1 … 1.6 (i=9..15 > 0.5)
  return { field, w, h };
}

describe("cavesCellAt — the 0-entry law: above the band top = air", () => {
  test("wy = -fh - 1 (one row above the band top) → 0", () => {
    const { field, w, h } = makeField();
    expect(cavesCellAt(field, w, h, 0, -h - 1)).toBe(0);
  });
  test("deep sky (wy = -100) → 0 — the read never fires above the band", () => {
    const { field, w, h } = makeField();
    expect(cavesCellAt(field, w, h, 700, -100)).toBe(0);
  });
  test("NO CELL of the field leaks above the band top (all wy < -fh read air)", () => {
    const { field, w, h } = makeField();
    for (let wx = 0; wx < 8; wx++) {
      expect(cavesCellAt(field, w, h, wx, -h - 1)).toBe(0);
      expect(cavesCellAt(field, w, h, wx, -2 * h)).toBe(0);
    }
  });
});

describe("cavesCellAt — the 1-entry law: the band's row 0", () => {
  test("wy = -fh → field row 0 (the band top maps to row 0, not the wrap's row 0 via -0)", () => {
    const { field, w, h } = makeField();
    // (-fh) % h == 0 → row 0 → field[col]; with wx ≡ 0 → field[0] = 0.1
    expect(cavesCellAt(field, w, h, 0, -h)).toBe(field[0]);
  });
  test("the band top AT op-NUMBER wx → the right column (not shifted)", () => {
    const { field, w, h } = makeField();
    expect(cavesCellAt(field, w, h, 2, -h)).toBe(field[2]);   // col = 2 % 4 = 2
    expect(cavesCellAt(field, w, h, 2 * w, -h)).toBe(field[0]); // col = (2w) % w = 0
  });
});

describe("cavesCellAt — the N-entry law: served rows + the deep wrap", () => {
  test("rows emitted ∈ [0, h): wy = -1 → row h-1; wy = 3 → row 3; wy = h → row 0", () => {
    const { field, w, h } = makeField();
    expect(cavesCellAt(field, w, h, 0, -1)).toBe(field[(h - 1) * w]);      // row 3
    expect(cavesCellAt(field, w, h, 0, 3)).toBe(field[3 * w]);             // row 3 (wy=3)
    expect(cavesCellAt(field, w, h, 0, h)).toBe(field[0]);                 // wrap row 0
    expect(cavesCellAt(field, w, h, 0, h + 2)).toBe(field[2 * w]);         // wrap row 2
  });
  test("column wrap holds at any wy (wx mod w)", () => {
    const { field, w, h } = makeField();
    for (let wx = -w; wx <= 2 * w; wx++) {
      const col = ((wx % w) + w) % w;
      expect(cavesCellAt(field, w, h, wx, -2)).toBe(field[2 * w + col]);
    }
  });
});

describe("cavesCellAt — the REPLACEMENT test (must FAIL under the old `wy < 0` guard)", () => {
  // dig #192's falsifier: the old air-guard returned 0 for EVERY wy < 0 —
  // killing 51/52 rows of bty13 (fields were never served there). The new law
  // serves rows [0, h) for wy ∈ [-h, 0) — this test FAILS (got 0 ≠ field[·])
  // whenever the old `wy < 0` arithmetic runs.
  test("terrain slab rows upstream of the datum (wy ∈ [-fh, 0)) read the field — the old guard returned 0", () => {
    const { field, w, h } = makeField();
    for (let wy = -h; wy < 0; wy++) {
      const col = 0;
      const row = ((wy % h) + h) % h;
      const got = cavesCellAt(field, w, h, 0, wy);
      const want = field[row * w + col];
      // the old law would have produced 0 (the air-guard); new = the cell.
      expect(got).toBe(want);
      expect(want).not.toBe(0);
      expect(want).toBeGreaterThan(0);
    }
  });
  test("the old guard's ONLY surviving zero-cell = above-band (wy < -fh) — the boundary is the law, not 0", () => {
    const { field, w, h } = makeField();
    expect(cavesCellAt(field, w, h, 0, -h)).toBe(field[0]);   // row 0 served
    expect(cavesCellAt(field, w, h, 0, -h - 1)).toBe(0);       // one above = air
  });
});

describe("cavesCellAt — the skip path", () => {
  test("the band's caller skips the read entirely for non-<BitmapCaves> defs — cavesCellAt is never constructed for them", () => {
    // Contract mirror (noise-terrain.mjs): gradAt is only assigned inside
    // `if (def?.bitmapCaves?.sizeX)` — a null gradAt = the kind-0 lane's own
    // surfaceField, so the caves unit is unreachable; assert the unit itself
    // is a pure function of (field, w, h, wx, wy) and never throws on OOB wx.
    const { field, w, h } = makeField();
    expect(() => cavesCellAt(field, w, h, -1000, 3)).not.toThrow();
    expect(cavesCellAt(field, w, h, -1000, 3)).toBe(field[3 * w]); // col wrap ≡ 0
  });
});

// ============================================================================
// dig #193 — cavesShapedCellAt: the warp-displaced sample-point + the
// smoothstep's ±1 snap (the SHAPE half). Synthetic grids; the laws:
//   1. the read's cell ∈ the 4-neighbour set of floor(out0/out1) — the snap
//      can displace the pick by AT MOST +1 cell per axis (the 0.5-comiss/inc!)
//   2. the FALSIFIER (the dig #192 flat law = cavesCellAt): the warp displaces
//      SOME cell in a 40×40 span — the shaped read ≠ the flat pick there —
//      so a cavesShapedCellAt that regresses to the raw flat read FAILS here,
//      and a gradAt wiring regression fails the compositor's re-pinned
//      count (surface-compositor.test.mjs, 2501).
//   3. DETERMINISM: the shaped read is a pure function of (field,w,h,wx,wy).
describe("cavesShapedCellAt — the warp + the smooth ±1 snap", () => {
  test("the shaped read's value ∈ the [floor, floor+1] × [floor, floor+1] window of the warped point (the snap's ±1 bound)", () => {
    const { field, w, h } = makeField();
    for (const [wx, wy] of [[0, 0], [37, 220], [-30, 50], [9999, 300]]) {
      // (the sky-cases (wy < -h) are the 0-entry law's describe, NOT this one)
      // recompute the shaped point's window independently (the dig-#194 law):
      const G1 = 0, G2 = 0;
      const xU = (wx + G2 + 0.5) * 0.1, yU = (wy + G1 + 0.5) * 0.1;
      const nx = 0.45 * simplex2d((wx + G2) * 0.13715, (wy + G1) * 0.13717) + 0.1;
      const L = latticeGrad2d((wy + G1) / 9, (wx + G2) / 9);
      const m = latticeVal2d((wx + G2) / 9, (wy + G1) / 9);
      const wgt = (1 - nx) * 0.33 + 0.111;
      const out0 = xU + nx * m, out1 = yU + wgt * L;
      const f0 = out0 - Math.floor(out0), f1 = out1 - Math.floor(out1);
      const px = Math.floor(out0) + ((3 - 2 * f0) * f0 * f0 >= 0.5 ? 1 : 0);
      const py = Math.floor(out1) + ((3 - 2 * f1) * f1 * f1 >= 0.5 ? 1 : 0);
      const cell = (cx, cy) => field[((((cy % h) + h) % h) * w) + (((cx % w) + w) % w)];
      const got = cavesShapedCellAt(field, w, h, wx, wy);
      const set = [cell(px, py), cell(px + 1, py), cell(px, py + 1), cell(px + 1, py + 1)];
      expect(set).toContain(got);
    }
  });
  test("the warp displaces SOME cells (the read ≠ the flat pick somewhere in a 40×40 span)", () => {
    const { field, w, h } = makeField();
    let different = 0;
    for (let wy = 0; wy < 40; wy++) for (let wx = 0; wx < 40; wx++) {
      if (cavesShapedCellAt(field, w, h, wx, wy) !== cavesCellAt(field, w, h, wx, wy)) different++;
    }
    expect(different).toBeGreaterThan(0);
  });
  test("DETERMINISM: the shaped read = a pure function of (field,w,h,wx,wy)", () => {
    const { field, w, h } = makeField();
    for (const [wx, wy] of [[5, 5], [400, 800]]) {
      expect(cavesShapedCellAt(field, w, h, wx, wy))
        .toBe(cavesShapedCellAt(field, w, h, wx, wy)); // determinism
    }
  });
});
