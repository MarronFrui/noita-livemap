// The tile worker pool's scheduling laws (mapgen/server/tile-pool.mjs), on a
// fake worker (tests/fixtures/fake-tile-worker.mjs): HIGH before LOW, the
// last idle worker kept for interactive asks, LOW → HIGH promotion, crash →
// respawn + the task rejected, dropSeed.

import { describe, test, expect, afterEach } from "vitest";
import { TilePool } from "../../mapgen/server/tile-pool.mjs";

const FAKE = new URL("../fixtures/fake-tile-worker.mjs", import.meta.url);
let pool = null;
afterEach(async () => { await pool?.close(); pool = null; });

const task = (z, x, priority, seed = 1) => ({ key: `${seed}/${z}/${x}_0`, seed, z, x, y: 0, captureOn: false, priority });

describe("TilePool — scheduling", () => {
  test("renders a tile on a worker and returns its bytes", async () => {
    pool = new TilePool({ size: 1, workerUrl: FAKE });
    const r = await pool.render(task(3, 4, "high"));
    expect(Array.from(r)).toEqual([3, 4, 0]);
    expect(pool.progress(1).ready).toBe(true);
  });

  test("HIGH tasks run before queued LOW ones", async () => {
    pool = new TilePool({ size: 1, workerUrl: FAKE });
    const order = [];
    const busy = pool.render(task(0, 99, "high")); // occupies the only worker
    const lows = [1, 2, 3].map((x) => pool.render(task(0, x, "low")).then(() => order.push(`low${x}`)));
    const high = pool.render(task(0, 7, "high")).then(() => order.push("high7"));
    await Promise.all([busy, high, ...lows]);
    expect(order[0]).toBe("high7");
  });

  test("LOW work never takes the last idle worker", async () => {
    pool = new TilePool({ size: 2, workerUrl: FAKE });
    pool.render(task(0, 99, "low")); // one LOW in flight on worker A
    pool.render(task(0, 98, "low")); // must WAIT: worker B is the last idle one
    expect(pool.workers.filter((w) => w.busy).length).toBe(1);
    const t = Date.now();
    await pool.render(task(0, 5, "high")); // gets worker B at once
    expect(Date.now() - t).toBeLessThan(150);
  });

  test("bump() promotes a queued LOW task", async () => {
    pool = new TilePool({ size: 1, workerUrl: FAKE });
    const order = [];
    const busy = pool.render(task(0, 99, "high"));
    const a = pool.render(task(0, 1, "low")).then(() => order.push("a"));
    const b = pool.render(task(0, 2, "low")).then(() => order.push("b"));
    pool.bump("1/0/2_0");
    expect(pool.stats.promoted).toBe(1);
    await Promise.all([busy, a, b]);
    expect(order).toEqual(["b", "a"]);
  });

  test("a crashed worker is replaced and its task rejected", async () => {
    pool = new TilePool({ size: 1, workerUrl: FAKE });
    await expect(pool.render(task(0, 1, "high", 666))).rejects.toThrow(/exited/);
    const r = await pool.render(task(2, 2, "high"));
    expect(Array.from(r)).toEqual([2, 2, 0]);
    expect(pool.stats.respawned).toBe(1);
  });

  test("dropSeed rejects the seed's queued prewarm and forgets its state", async () => {
    pool = new TilePool({ size: 1, workerUrl: FAKE });
    const busy = pool.render(task(0, 99, "high", 5));
    const low = pool.render(task(0, 1, "low", 5));
    pool.dropSeed(5);
    await expect(low).rejects.toThrow(/dropped/);
    await busy;
  });
});
