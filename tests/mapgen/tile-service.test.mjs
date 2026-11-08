// The tile service (mapgen/server/tile-service.mjs): the memory → disk →
// compute chain, the in-flight dedupe, the pyramid's 2×2 combine law and the
// revision-scoped disk cache. A fake direct renderer stands in for the world.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test, expect } from "vitest";
import { PNG } from "pngjs";
import { TileService, combineChildren, sourceRevision, TILE } from "../../mapgen/server/tile-service.mjs";

const solidTile = (rgb) => {
  const t = new Uint8Array(TILE * TILE * 4);
  for (let p = 0; p < t.length; p += 4) { t[p] = rgb[0]; t[p + 1] = rgb[1]; t[p + 2] = rgb[2]; t[p + 3] = 255; }
  return t;
};
const px = (t, i, j) => Array.from(t.subarray(4 * (j * TILE + i), 4 * (j * TILE + i) + 4));

function service(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tilesvc-"));
  const calls = [];
  const svc = new TileService({
    root, rev: "r1", gridW: 71, gridH: 144,
    renderDirect: async (seed, z, x, y) => { calls.push(`${z}/${x}/${y}`); return solidTile([10 + z, x & 255, y & 255]); },
    ...extra,
  });
  return { svc, root, calls };
}

describe("combineChildren — the pyramid's 2×2 law", () => {
  test("each quadrant comes from its child; absent children are air (black)", () => {
    const out = combineChildren([solidTile([1, 2, 3]), solidTile([4, 5, 6]), null, solidTile([7, 8, 9])]);
    expect(px(out, 0, 0)).toEqual([1, 2, 3, 255]);
    expect(px(out, 300, 0)).toEqual([4, 5, 6, 255]);
    expect(px(out, 0, 300)).toEqual([0, 0, 0, 255]);
    expect(px(out, 511, 511)).toEqual([7, 8, 9, 255]);
  });

  test("solid iff ≥ 2 of the 4 source px are solid; colour = the most frequent", () => {
    const c = new Uint8Array(TILE * TILE * 4); // all air
    const set = (i, j, rgb) => c.set([...rgb, 255], 4 * (j * TILE + i));
    set(0, 0, [9, 9, 9]); // block (0,0): 1 solid of 4 → air
    set(2, 0, [5, 5, 5]); set(3, 1, [5, 5, 5]); set(2, 1, [6, 6, 6]); // block (1,0): 3 solid, mode 5
    set(4, 0, [7, 7, 7]); set(5, 1, [8, 8, 8]); // block (2,0): 2 solid → solid (tie → first max)
    const out = combineChildren([c, null, null, null]);
    expect(px(out, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(px(out, 1, 0)).toEqual([5, 5, 5, 255]);
    expect(px(out, 2, 0)[0]).toBe(7);
  });
});

describe("TileService — caching + pyramid", () => {
  test("z ≤ directMaxZ renders direct once; memory then disk serve repeats", async () => {
    const { svc, root, calls } = service();
    const a = await svc.png(1, 0, 3, 4, true);
    const b = await svc.png(1, 0, 3, 4, true);
    expect(calls).toEqual(["0/3/4"]);
    expect(Buffer.compare(a, b)).toBe(0);
    await new Promise((r) => setTimeout(r, 50)); // the async disk write
    const f = path.join(root, "r1", "1", "0", "3_4.png");
    expect(fs.existsSync(f)).toBe(true);
    // a fresh service on the same root + rev = a server restart: disk hit, no render
    const again = new TileService({ root, rev: "r1", gridW: 71, gridH: 144, renderDirect: async () => { throw new Error("rendered"); } });
    expect(Buffer.compare(await again.png(1, 0, 3, 4, true), a)).toBe(0);
    expect(again.stats.disk).toBe(1);
  });

  test("concurrent asks for one tile share a single render", async () => {
    const { svc, calls } = service();
    await Promise.all([svc.png(2, 1, 0, 0, true), svc.png(2, 1, 0, 0, true), svc.png(2, 1, 0, 0, true)]);
    expect(calls).toEqual(["1/0/0"]);
  });

  test("z > directMaxZ is built from its 4 children (recursively), never rendered direct", async () => {
    const { svc, calls } = service({ directMaxZ: 1 });
    const png = await svc.png(3, 3, 0, 0, true); // seed 3, z3
    expect(calls.every((c) => c.startsWith("1/"))).toBe(true);
    expect(calls.length).toBe(16); // z3 → 4 z2 (pyramid) → 16 z1 (direct)
    const img = PNG.sync.read(png);
    // the top-left px of z3(0,0) descends to z1(0,0) = colour [11, 0, 0]
    expect(Array.from(img.data.subarray(0, 3))).toEqual([11, 0, 0]);
    expect(svc.stats.pyramid).toBeGreaterThanOrEqual(1);
  });

  test("the capture flag and the seed key separate tiles; clear(seed) drops one seed", async () => {
    const { svc, root, calls } = service();
    await svc.png(5, 0, 0, 0, true);
    await svc.png(5, 0, 0, 0, false);
    await svc.png(6, 0, 0, 0, true);
    expect(calls.length).toBe(3);
    await new Promise((r) => setTimeout(r, 50));
    svc.clear(5);
    expect(fs.existsSync(path.join(root, "r1", "5"))).toBe(false);
    expect(fs.existsSync(path.join(root, "r1", "6"))).toBe(true);
    await svc.png(5, 0, 0, 0, true);
    expect(calls.length).toBe(4);
  });

  test("pruneOldRevisions keeps only the current revision", () => {
    const { svc, root } = service();
    fs.mkdirSync(path.join(root, "old1"), { recursive: true });
    fs.mkdirSync(path.join(root, "r1"), { recursive: true });
    expect(svc.pruneOldRevisions()).toEqual(["old1"]);
    expect(fs.readdirSync(root)).toEqual(["r1"]);
  });

  test("sourceRevision changes with content and with the extra key", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "rev-"));
    const f = path.join(d, "a.mjs");
    fs.writeFileSync(f, "1");
    const r1 = sourceRevision([f], "x");
    fs.writeFileSync(f, "2");
    expect(sourceRevision([f], "x")).not.toBe(r1);
    expect(sourceRevision([f], "y")).not.toBe(sourceRevision([f], "x"));
  });
});
