// has-path.mjs contracts: oracle-validated port (VERIFIED.md §5, 8/8
// accept/reject + 2026-09-18 in-binary corrections). Synthetic maps only —
// no extracted data needed except the coalmine overlay (vendored data
// container, used purely as data: has-path.mjs header).

import fs from "node:fs";
import path from "node:path";

import { describe, test, expect } from "vitest";
import { hasPath, finalizeLite, coalmineOverlay } from "../../mapgen/lib/has-path.mjs";

// helpers -------------------------------------------------------------
const setPx = (map, w, x, y, r, g, b) => {
  const p = 3 * (w * y + x);
  map[p] = r; map[p + 1] = g; map[p + 2] = b;
};
const getPx = (map, w, x, y) => {
  const p = 3 * (w * y + x);
  return [map[p], map[p + 1], map[p + 2]];
};
const solidMap = (w, h, rgb = [255, 255, 255]) => {
  const m = Buffer.alloc(3 * w * h);
  for (let i = 0; i < w * h; i++) { m[3 * i] = rgb[0]; m[3 * i + 1] = rgb[1]; m[3 * i + 2] = rgb[2]; }
  return m;
};

describe("coalmineOverlay (vendored data container)", () => {
  test("is 256-wide RGB with at least one row", () => {
    const ov = coalmineOverlay();
    expect(ov.rows).toBeGreaterThanOrEqual(1);
    expect(ov.bytes.length % (256 * 3)).toBe(0);
  });

  test("is memoized (same object across calls)", () => {
    expect(coalmineOverlay()).toBe(coalmineOverlay());
  });

  // REGRESSION for the obsolete noitool silent no-op: the overlay data's
  // real values are 0x006400 / 0x000064 (VERIFIED.md §8 — noitool's own
  // hax compared 0x004000/0x0040 and did nothing). Both real values MUST
  // occur in the data for the mutations to be live.
  test("overlay data actually contains 0x006400 and 0x000064 pixels", () => {
    const counts = { "0x006400": 0, "0x000064": 0, "0xfefefe": 0 };
    const ov = coalmineOverlay();
    for (let p = 0; p < ov.bytes.length; p += 3) {
      const pix = (ov.bytes[p] << 16) | (ov.bytes[p + 1] << 8) | ov.bytes[p + 2];
      if (pix === 0x006400) counts["0x006400"]++;
      else if (pix === 0x000064) counts["0x000064"]++;
      else if (pix === 0xfefefe) counts["0xfefefe"]++;
    }
    expect(counts["0x006400"]).toBeGreaterThan(0);
    expect(counts["0x000064"]).toBeGreaterThan(0);
    // NOTE: the CURRENT overlay data contains only {0x006400, 0x000064, 0x000000,
    // 0x544f14}-family pixels — 0xfefefe (stairs) has ZERO occurrences, so that
    // branch in doCoalMineHax is currently dead code with this data.
    expect(counts["0xfefefe"]).toBe(0);
  });
});

describe("hasPath API shape and basic verdicts", () => {
  test("returns { ok, blockList, endNode }", () => {
    const map = solidMap(40, 20, [0, 0, 0]); // all-black, no blockOut
    const r = hasPath(map, 40, 20, { isCoalMine: false, shouldBlockOutRooms: false, worldX: 0, worldY: 0 });
    expect(Object.keys(r)).toEqual(["ok", "blockList", "endNode"]);
    expect(typeof r.ok).toBe("boolean");
    expect(Array.isArray(r.blockList)).toBe(true);
  });

  test("all-black map at worldY < 29: main-path band guarantees success", () => {
    // fillXFrom = trunc(159/10) = 15; band rows 0..6 black; search from x=15.
    const map = solidMap(40, 20, [0, 0, 0]);
    const r = hasPath(map, 40, 20, { worldX: 0, worldY: 0 });
    expect(r.ok).toBe(true);
    expect(r.endNode).not.toBeNull();
  });

  test("no black below the main-path band -> reject", () => {
    const map = solidMap(40, 20, [255, 255, 255]);
    const r = hasPath(map, 40, 20, { worldX: 0, worldY: 0 });
    expect(r.ok).toBe(false);
  });

  test("a solid vertical air corridor from top to bottom is enough (scan path)", () => {
    // worldY = 29 disables mainPath (worldY < 29 gate) -> raw column scan
    const map = solidMap(40, 20, [255, 255, 255]);
    for (let y = 0; y < 20; y++) setPx(map, 40, 9, y, 0, 0, 0);
    const r = hasPath(map, 40, 20, { worldY: 29 });
    expect(r.ok).toBe(true);
  });

  test("coffee (0xc0ffee) is consumed to black on path_map; out_map untouched", () => {
    // the coffee flood runs under usemap = path — the terrain buffer must
    // keep the trigger color (the game consumes it in finalize, not here)
    const map = solidMap(40, 20, [255, 255, 255]);
    setPx(map, 40, 10, 0, 0xc0, 0xfe, 0xee);
    const r = hasPath(map, 40, 20, { worldY: 29 });
    expect(getPx(map, 40, 10, 0)).toEqual([0xc0, 0xfe, 0xee]);
    // the flooded black cell is not a path root either (surrounded by solid)
    expect(r.ok).toBe(false);
  });

  test("visited purple trail never lands on the returned terrain map", () => {
    // the search paints purple on its path_map copy; out_map must not change
    const rgb = [37, 37, 37]; // neither black nor coffee nor blocked/white
    const map = solidMap(40, 20, rgb);
    setPx(map, 40, 8, 0, 0, 0, 0);
    setPx(map, 40, 8, 10, 0, 0, 0);
    const before = Buffer.from(map);
    hasPath(map, 40, 20, { worldY: 29 });
    expect(Buffer.compare(Buffer.from(map), before)).toBe(0);
  });
});

describe("blockOutRooms (room-marker whites)", () => {
  // 2026-09-19 binary-exact rewrite (FUN_00901510/009013f0/00901580): rays
  // count BLACK cells only (`test $0xffffff`), stop at the first non-black
  // cell, rect ends are EXCLUSIVE. ShadeOfGrey run-on is eliminated in-binary.
  test("grey run-on does NOT extend a room (ShadeOfGrey heuristic eliminated)", () => {
    const map = solidMap(40, 20, [37, 37, 37]); // 0x252525 grey, non-black
    setPx(map, 40, 5, 5, 0xff, 0x00, 0x80); // 0xff0080 — in the binary marker table
    const r = hasPath(map, 40, 20, { shouldBlockOutRooms: true, worldY: 29 });
    // both rays hit the non-black grey at (6,6) immediately -> zero-length
    // runs on both axes -> degenerate rect {6,6,6,6}, nothing filled.
    const hit = r.blockList.find((b) => b.startX === 6 && b.startY === 6);
    expect(hit).toBeTruthy();
    expect(hit.endX).toBe(6);
    expect(hit.endY).toBe(6);
    expect(getPx(map, 40, 6, 6)).toEqual([37, 37, 37]); // NOT painted white
    expect(r.blockList).toHaveLength(1);
  });

  test("a black run from the marker's corner sets the room; a far break ends it", () => {
    const map = solidMap(40, 20, [0, 0, 0]);
    setPx(map, 40, 5, 5, 0xff, 0x00, 0x80);
    setPx(map, 40, 8, 6, 37, 37, 37); // first non-black -> right ray stops
    const r = hasPath(map, 40, 20, { shouldBlockOutRooms: true, worldY: 29 });
    const hit = r.blockList[0];
    expect(hit.startX).toBe(6);
    expect(hit.startY).toBe(6);
    expect(hit.endX).toBe(8); // start 6 + 2 black cells (6,7), EXCLUSIVE end
    expect(hit.endY).toBe(20); // down ray runs to the bottom edge
    expect(getPx(map, 40, 7, 6)).toEqual([255, 255, 255]); // inside the run
    expect(getPx(map, 40, 8, 6)).toEqual([37, 37, 37]); // break cell untouched
    expect(getPx(map, 40, 9, 6)).toEqual([0, 0, 0]); // beyond untouched
  });

  test("the binary-verified 11-entry marker table covers 0x00ac64 and 0x70d7a0", () => {
    for (const [r, g, b] of [[0x00, 0xac, 0x64], [0x70, 0xd7, 0xa0]]) {
      const map = solidMap(40, 20, [0, 0, 0]);
      setPx(map, 40, 5, 5, r, g, b);
      const out = hasPath(map, 40, 20, { shouldBlockOutRooms: true, worldY: 29 });
      // the room opened to the marker's bottom-right corner (startX/startY
      // are the marker pixel + 1 in both axes)
      const hit = out.blockList.find((b) => b.startX === 6 && b.startY === 6);
      expect(hit).toBeTruthy();
      expect(getPx(map, 40, 6, 6)).toEqual([255, 255, 255]);
    }
  });

  test("finalizeLite re-blacks the blocked-room ranges on top of blockOut whites", () => {
    const map = solidMap(40, 20, [0, 0, 0]);
    setPx(map, 40, 5, 5, 0xff, 0x00, 0x80);
    const r = hasPath(map, 40, 20, { shouldBlockOutRooms: true, worldY: 29 });
    finalizeLite(map, 40, 20, { isCoalMine: false, blockList: r.blockList });
    expect(getPx(map, 40, 6, 6)).toEqual([0, 0, 0]); // blocked room -> air
    expect(getPx(map, 40, 39, 19)).toEqual([0, 0, 0]); // exclusive-end rect internals too
  });
});

describe("coalmine hax (corrected constants are ACTIVE, not a no-op)", () => {
  // Regression for the 2026-09-18 rewrite (F2 dig, has-path.mjs header):
  // overlay 0x006400 -> WHITE on the real values, not noitool's dead
  // 0x004000/0x0040 comparison.
  test("overlay main-rock pixels become WHITE during hasPath (isCoalMine)", () => {
    const ov = coalmineOverlay();
    let hx = -1, hy = -1;
    findPixel: for (let y = 0; y < Math.min(ov.rows, 20); y++)
      for (let x = 0; x < 256; x++) {
        const p = 3 * (256 * y + x);
        const pix = (ov.bytes[p] << 16) | (ov.bytes[p + 1] << 8) | ov.bytes[p + 2];
        if (pix === 0x006400) { hx = x; hy = y; break findPixel; }
      }
    expect(hx).toBeGreaterThanOrEqual(0);
    expect(hy).toBeGreaterThanOrEqual(0);

    const map = solidMap(256, Math.min(ov.rows, 20), [0, 0, 0]);
    hasPath(map, 256, Math.min(ov.rows, 20), { isCoalMine: true, worldX: 0, worldY: 0 });
    // the hax forced the overlay's main-rock copies onto out_map:
    expect(getPx(map, 256, hx, hy)).toEqual([255, 255, 255]);
  });

  test("undoCoalMineHax (via finalizeLite) blits overlay-forced pixels back to BLACK", () => {
    const ov = coalmineOverlay();
    let hx = -1, hy = -1;
    findPixel: for (let y = 0; y < Math.min(ov.rows, 10); y++)
      for (let x = 0; x < 256; x++) {
        const p = 3 * (256 * y + x);
        const pix = (ov.bytes[p] << 16) | (ov.bytes[p + 1] << 8) | ov.bytes[p + 2];
        if (pix === 0x006400) { hx = x; hy = y; break findPixel; }
      }
    const map = solidMap(256, Math.min(ov.rows, 10), [32, 32, 32]);
    finalizeLite(map, 256, Math.min(ov.rows, 10), { isCoalMine: true, blockList: [] });
    expect(getPx(map, 256, hx, hy)).toEqual([0, 0, 0]);
  });
});
