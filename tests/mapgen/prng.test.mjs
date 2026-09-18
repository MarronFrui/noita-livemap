// NollaPrng — exact-port contract tests (no game data needed).
//
// The port is game-verified: 100.00% on 2,113,568 oracle draws across 4 seeds
// (mapgen/VERIFIED.md §2, probe mod mods/noita-livemap-rng-probe/). These
// tests pin that verified behavior as API + regression baselines.

import { describe, test, expect } from "vitest";
import { NollaPrng, seededPrng, makePositionalSource } from "../../mapgen/lib/wang-js.mjs";

const g_coreVector = ["0.833994627387","0.947702497685","0.035878594981","0.011545853229","0.051155220275","0.765787167831","0.584929739397","0.914130052977"].map(Number);

describe("NollaPrng API compatibility", () => {
  test("is a class with the documented public surface", () => {
    expect(typeof NollaPrng).toBe("function");
    expect(typeof NollaPrng.prototype.next).toBe("function");
    expect(typeof NollaPrng.prototype.nextU).toBe("function");
    expect(typeof NollaPrng.prototype.random).toBe("function");
    expect(typeof NollaPrng.prototype.setRandomFromWorldSeed).toBe("function");
    expect(Object.keys(new NollaPrng(1))).toEqual(["seed"]);
  });
});

describe("NollaPrng determinism (VERIFIED.md §2)", () => {
  test("core Lehmer stream is a pinned vector (seed 12345)", () => {
    const r = new NollaPrng(12345);
    for (const v of g_coreVector) expect(r.next()).toBeCloseTo(Number(v), 10);
  });

  test("constructor performs exactly one warm-up draw", () => {
    const ctor = new NollaPrng(999);
    const manual = new NollaPrng(0);
    manual.seed = 999;
    manual.next();
    expect(ctor.seed).toBe(manual.seed);
  });

  test("same seed => identical 1000-draw streams", () => {
    const a = new NollaPrng(78633191), b = new NollaPrng(78633191);
    for (let i = 0; i < 1000; i++) expect(a.nextU()).toBe(b.nextU());
  });

  test("nextU is uint32-deterministic after many steps", () => {
    const s = new NollaPrng(12345);
    for (let k = 0; k < 92; k++) s.next();
    expect([s.nextU(), s.nextU(), s.nextU()]).toEqual([781370897, 638181280, 1379456647]);
  });
});

describe("NollaPrng semantics", () => {
  test("next() returns a uniform-looking double in [0,1)", () => {
    const r = new NollaPrng(1);
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(Math.abs(sum / 2000 - 0.5)).toBeLessThan(0.02);
  });

  test("nextU() is a uint32", () => {
    const r = new NollaPrng(2);
    for (let i = 0; i < 100; i++) {
      expect(Number.isInteger(r.nextU())).toBe(true);
    }
    const s = new NollaPrng(3);
    expect(s.nextU()).toBeLessThanOrEqual(0xffffffff);
    expect(s.nextU()).toBeGreaterThanOrEqual(0);
  });

  // C-truncation semantics: the port must truncate toward zero, not floor —
  // trunc !== floor on negatives (mapgen/ABOUT_MATH.md §1, widthCells).
  test("negative seeds still produce a valid stream (Schrage form)", () => {
    for (const s of [-1, -3, -999, -2147483646]) {
      const r = new NollaPrng(s);
      expect(Number.isFinite(r.seed)).toBe(true);
      expect(r.seed).toBeGreaterThan(0);
    }
  });

  test("random(min,max) is inclusive of both ends", () => {
    const r = new NollaPrng(42);
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(r.random(0, 2));
    expect(seen).toEqual(new Set([0, 1, 2])); // 3-valued range fully covered
  });

  test("setRandomFromWorldSeed stores the seed as-is under 2^31-1", () => {
    const r = new NollaPrng(0);
    r.setRandomFromWorldSeed(78633191);
    expect(r.seed).toBe(78633191);
  });

  test("setRandomFromWorldSeed halves huge seeds (>= 2^31-1)", () => {
    const r = new NollaPrng(0);
    r.setRandomFromWorldSeed(4294967295);
    expect(r.seed).toBe(4294967295 * 0.5);
  });
});

describe("seededPrng — SetRandomSeed mixer", () => {
  // Regression pin for the signedness fix in setRandomSeedHelper2
  // (`>>> 0` on the final mix; found via the Lua RNG oracle crosscheck,
  // mapgen/ABOUT_MATH.md §6, 2026-09-03).
  test("pinned output state for (ws, x, y)", () => {
    expect(seededPrng(78633191, 3, 7).seed).toBe(788165273);
  });

  test("result state is always a positive uint32", () => {
    for (const [x, y] of [[0, 0], [1, -1], [512, 512], [1023, 102400], [8192, 16384]]) {
      const p = seededPrng(4294967295, x, y);
      expect(p.seed).toBeGreaterThan(0);
      expect(p.seed).toBeLessThanOrEqual(0x7fffffff);
    }
  });

  test("makePositionalSource wraps seededPrng.random", () => {
    const src = makePositionalSource(78633191);
    const p = seededPrng(78633191, 10, 10);
    expect(src(10, 10, 0, 7)).toBe(p.random(0, 7));
    for (let i = 0; i < 50; i++) {
      const v = makePositionalSource(1234)(i, -i, 0, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
});
