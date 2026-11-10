// The generated-map viewer's state machines (src/genmap-viewer.mjs): tile
// entries with retry, the single status-poll loop, and the composed status
// line. No DOM — images, fetch and timers are fakes.

import { describe, test, expect } from "vitest";
import {
  createTileCache,
  createStatusPoller,
  composeStatus,
  notice,
  TILE_RETRY_MS,
  POLL_GENERATING_MS,
  POLL_READY_MS,
  POLL_ERROR_MS,
} from "../src/genmap-viewer.mjs";

function tileHarness() {
  let t = 0;
  const images = [], wakes = [], settles = [];
  const cache = createTileCache({
    makeImage: () => { const img = {}; images.push(img); return img; },
    onSettle: (k, e) => settles.push([k, e.state]),
    now: () => t,
    scheduleFn: (fn, ms) => wakes.push({ fn, ms }),
  });
  return { cache, images, wakes, settles, setNow: (v) => { t = v; } };
}

describe("tile entry: loading → ok | error → retry", () => {
  test("a load settles ok; repeated requests reuse the entry", () => {
    const h = tileHarness();
    const e = h.cache.request("k", "/t.png?e=1");
    expect(e.state).toBe("loading");
    expect(h.images[0].src).toBe("/t.png?e=1");
    h.images[0].onload();
    expect(h.cache.request("k", "/t.png?e=1").state).toBe("ok");
    expect(h.images).toHaveLength(1);
  });

  test("an error is reported, waits its backoff, then re-asks with a cache-busting attempt", () => {
    const h = tileHarness();
    h.cache.request("k", "/t.png?e=1");
    h.images[0].onerror();
    expect(h.cache.peek("k").state).toBe("error");
    expect(h.wakes[0].ms).toBe(TILE_RETRY_MS[0]); // the page is woken to re-ask
    h.setNow(TILE_RETRY_MS[0] - 1);
    h.cache.request("k", "/t.png?e=1");
    expect(h.images).toHaveLength(1); // too early
    h.setNow(TILE_RETRY_MS[0]);
    expect(h.cache.request("k", "/t.png?e=1").state).toBe("loading");
    expect(h.images[1].src).toBe("/t.png?e=1&r=1");
    h.images[1].onerror();
    expect(h.wakes[1].ms).toBe(TILE_RETRY_MS[1]);
  });

  test("clear() orphans in-flight loads: their late callbacks change nothing", () => {
    const h = tileHarness();
    h.cache.request("k", "/a.png");
    const stale = h.images[0];
    h.cache.clear();
    stale.onload();
    expect(h.cache.peek("k")).toBe(undefined);
    expect(h.settles).toHaveLength(0);
  });
});

function pollHarness() {
  const timers = [];
  const calls = [], statuses = [], errors = [];
  let responder = () => Promise.resolve({ ready: false, done: 0, total: 10 });
  const poller = createStatusPoller({
    fetchStatus: (seed) => { calls.push(seed); return responder(seed); },
    onStatus: (seed, s) => statuses.push([seed, s]),
    onError: (seed, err, wait) => errors.push([seed, wait]),
    setTimeoutFn: (fn, ms) => { const t = { fn, ms, cancelled: false }; timers.push(t); return t; },
    clearTimeoutFn: (t) => { t.cancelled = true; },
  });
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const fireNext = async () => {
    const t = timers.find((x) => !x.cancelled && !x.fired);
    t.fired = true;
    t.fn();
    await flush();
    return t;
  };
  return { poller, timers, calls, statuses, errors, flush, fireNext, respond: (fn) => { responder = fn; } };
}

describe("status poll: one loop, survives errors", () => {
  test("polls fast while generating, slow once ready", async () => {
    const h = pollHarness();
    h.poller.follow(1);
    await h.flush();
    expect(h.timers.at(-1).ms).toBe(POLL_GENERATING_MS);
    h.respond(() => Promise.resolve({ ready: true }));
    await h.fireNext();
    expect(h.timers.at(-1).ms).toBe(POLL_READY_MS);
  });

  test("a failing fetch backs off and keeps polling (it used to stop forever)", async () => {
    const h = pollHarness();
    h.respond(() => Promise.reject(new Error("ECONNREFUSED")));
    h.poller.follow(1);
    await h.flush();
    await h.fireNext();
    await h.fireNext();
    expect(h.errors.map((e) => e[1])).toEqual(POLL_ERROR_MS.slice(0, 3));
    h.respond(() => Promise.resolve({ ready: true, epoch: "x" }));
    await h.fireNext();
    expect(h.statuses.at(-1)[1].epoch).toBe("x");
    expect(h.timers.at(-1).ms).toBe(POLL_READY_MS);
  });

  test("follow() supersedes: N seed switches leave exactly one live loop, late answers dropped", async () => {
    const h = pollHarness();
    let release;
    h.respond(() => new Promise((r) => { release = r; }));
    h.poller.follow(1);
    const slow = release;
    h.respond(() => Promise.resolve({ ready: true }));
    for (let s = 2; s <= 5; s++) h.poller.follow(s);
    await h.flush();
    slow({ ready: false }); // seed 1's late answer
    await h.flush();
    expect(h.statuses.map((x) => x[0])).toEqual([5]); // only the current seed's answer lands
    const live = h.timers.filter((t) => !t.cancelled && !t.fired);
    expect(live).toHaveLength(1);
  });

  test("stop() ends the loop", async () => {
    const h = pollHarness();
    h.poller.follow(1);
    await h.flush();
    h.poller.stop();
    expect(h.timers.every((t) => t.cancelled || t.fired)).toBe(true);
  });
});

describe("composeStatus priority", () => {
  const base = { seed: 7, z: 1, gen: { ready: true }, unreachable: null, tiles: { pending: 0, failed: 0 }, notice: null, marker: null, now: 1000 };
  test("idle / loading / failed / generating / unreachable / notice, in priority order", () => {
    expect(composeStatus({ ...base, seed: null })).toMatch(/enter a seed/);
    expect(composeStatus(base)).toMatch(/^seed 7, z1/);
    expect(composeStatus({ ...base, tiles: { pending: 3, failed: 0 } })).toMatch(/^loading 3 tiles/);
    expect(composeStatus({ ...base, tiles: { pending: 3, failed: 2 } })).toMatch(/^2 tiles failed — retrying.*loading 3/);
    const g = { ...base, gen: { ready: false, done: 4, total: 10, errors: [] }, tiles: { pending: 3, failed: 2 } };
    expect(composeStatus(g)).toMatch(/^generating seed 7: 4\/10 areas…/); // no longer erased by draw()
    const u = { ...g, unreachable: { retryAt: 3500 } };
    expect(composeStatus(u)).toMatch(/^genmap server unreachable — retrying in 3s/);
    expect(composeStatus({ ...u, notice: notice("cache cleared", 1000) })).toBe("cache cleared");
    expect(composeStatus({ ...u, notice: notice("cache cleared", 0, 500) })).toMatch(/unreachable/); // expired
  });
  test("the marker suffix shows only on its own seed", () => {
    const marker = { seed: 7, biome: "coalmine", wx: 1.4, wy: -2.6 };
    expect(composeStatus({ ...base, marker })).toMatch(/· coalmine \(1, -3\)$/);
    expect(composeStatus({ ...base, marker: { ...marker, seed: 8 } })).not.toMatch(/coalmine/);
  });
});
