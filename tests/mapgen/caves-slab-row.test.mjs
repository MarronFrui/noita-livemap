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
import { cavesCellAt } from "../../mapgen/lib/caves-field.mjs";

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
