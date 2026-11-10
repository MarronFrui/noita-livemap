// The telemetry-bridge link state machine (src/live-link.mjs) — the pure
// transition table, the payload contract, and the effect driver against a
// fake WebSocket + fake clock (no network, no DOM).

import { describe as suite, test, expect } from "vitest";
import {
  transition,
  initialModel,
  parseTelemetry,
  describe,
  retryDelay,
  createLiveLink,
  STALE_MS,
  RETRY_MAX_MS,
} from "../src/live-link.mjs";

const T = { seed: 78633191, seedText: "78633191", x: 1, y: 2, biome: "coalmine", ts: 5 };
const run = (events, m = initialModel()) => events.reduce(transition, m);

suite("transition table", () => {
  test("happy path: off → connecting → waiting → live", () => {
    const m = run([{ type: "start", at: 0 }, { type: "open", at: 10 }, { type: "telemetry", telemetry: T, at: 20 }]);
    expect(m.state).toBe("live");
    expect(m.telemetry).toBe(T);
    expect(m.lastAt).toBe(20);
  });

  test("live goes stale after STALE_MS without telemetry, and back to live on the next one", () => {
    const live = run([{ type: "start", at: 0 }, { type: "open", at: 0 }, { type: "telemetry", telemetry: T, at: 100 }]);
    expect(transition(live, { type: "tick", at: 100 + STALE_MS - 1 }).state).toBe("live");
    const stale = transition(live, { type: "tick", at: 100 + STALE_MS });
    expect(stale.state).toBe("stale");
    expect(describe(stale).text).toMatch(/No telemetry for 5s/);
    expect(transition(stale, { type: "telemetry", telemetry: T, at: 9999 }).state).toBe("live");
  });

  test("failed connects back off with a capped ladder; a successful open resets it", () => {
    let m = run([{ type: "start", at: 0 }]);
    const delays = [];
    for (let i = 0; i < 7; i++) {
      m = transition(m, { type: "close", at: 0 });
      expect(m.state).toBe("retrying");
      delays.push(m.retryAt);
      m = transition(m, { type: "retry", at: 0 });
      expect(m.state).toBe("connecting");
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, RETRY_MAX_MS, RETRY_MAX_MS, RETRY_MAX_MS]);
    m = transition(m, { type: "open", at: 0 });
    expect(m.attempt).toBe(0);
    expect(transition(m, { type: "close", at: 0 }).retryAt).toBe(retryDelay(0));
  });

  test("stop wins from every state and later socket events are inert", () => {
    for (const evs of [[], [{ type: "open" }], [{ type: "open" }, { type: "telemetry", telemetry: T }], [{ type: "close" }]]) {
      const m = transition(run([{ type: "start", at: 0 }, ...evs]), { type: "stop", at: 0 });
      expect(m.state).toBe("off");
      for (const type of ["open", "close", "retry", "tick"]) expect(transition(m, { type, at: 1 }).state).toBe("off");
      expect(transition(m, { type: "telemetry", telemetry: T, at: 1 }).state).toBe("off");
    }
  });

  test("telemetry is ignored before the socket opens; the last payload survives a reconnect", () => {
    const c = run([{ type: "start", at: 0 }]);
    expect(transition(c, { type: "telemetry", telemetry: T }).telemetry).toBe(null);
    const dropped = run([{ type: "open" }, { type: "telemetry", telemetry: T }, { type: "close" }], c);
    expect(dropped.state).toBe("retrying");
    expect(dropped.telemetry).toBe(T);
  });

  test("describe covers every state", () => {
    for (const state of ["off", "connecting", "waiting", "live", "stale", "retrying"]) {
      expect(describe({ ...initialModel(), state }).text).not.toMatch(/unknown/);
    }
  });
});

suite("parseTelemetry (the Lua writer contract)", () => {
  test("accepts the writer's line and normalises the seed to uint32", () => {
    expect(parseTelemetry('{"seed":78633191,"x":512,"y":-1024,"biome":"coalmine","ts":42}')).toEqual({
      seed: 78633191, seedText: "78633191", x: 512, y: -1024, biome: "coalmine", ts: 42,
    });
    expect(parseTelemetry({ seed: "123", x: 0, y: 0 }).seed).toBe(123);
  });
  test("a non-numeric seed keeps its text but has no map seed", () => {
    const t = parseTelemetry({ seed: "abc", x: 0, y: 0, biome: "b", ts: 1 });
    expect(t.seed).toBe(null);
    expect(t.seedText).toBe("abc");
  });
  test("rejects garbage", () => {
    for (const bad of ["", "{", "null", "[]", '{"seed":1}', '{"x":"a","y":1}', 42]) expect(parseTelemetry(bad)).toBe(null);
  });
});

// ── driver ──
function harness() {
  let t = 0;
  const timers = new Map();
  let nextId = 1;
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.closed = false; sockets.push(this); }
    close() { if (this.closed) return; this.closed = true; this.onclose?.({}); }
  }
  const add = (fn, ms, every) => { const id = nextId++; timers.set(id, { fn, at: t + ms, every }); return id; };
  const advance = (ms) => {
    const end = t + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, x] = due;
      t = x.at;
      if (x.every) x.at += x.every; else timers.delete(id);
      x.fn();
    }
    t = end;
  };
  const changes = [];
  const link = createLiveLink({
    url: "ws://test",
    WebSocketImpl: FakeWS,
    setTimeoutFn: (fn, ms) => add(fn, ms, 0),
    clearTimeoutFn: (id) => timers.delete(id),
    setIntervalFn: (fn, ms) => add(fn, ms, ms),
    clearIntervalFn: (id) => timers.delete(id),
    now: () => t,
    onChange: (m) => changes.push(m.state),
  });
  return { link, sockets, timers, advance, changes, open: () => sockets.at(-1) };
}

suite("createLiveLink driver", () => {
  test("one socket per connect, telemetry flows, stale after silence", () => {
    const h = harness();
    h.link.start();
    expect(h.sockets).toHaveLength(1);
    h.open().onopen();
    h.open().onmessage({ data: '{"seed":5,"x":1,"y":2,"biome":"b","ts":1}' });
    expect(h.link.model.state).toBe("live");
    expect(h.link.model.telemetry.seed).toBe(5);
    h.open().onmessage({ data: "garbage" });
    expect(h.link.model.telemetry.seed).toBe(5);
    h.advance(STALE_MS);
    expect(h.link.model.state).toBe("stale");
  });

  test("a dropped socket reconnects after the backoff with exactly one new socket", () => {
    const h = harness();
    h.link.start();
    h.open().onopen();
    h.open().close();
    expect(h.link.model.state).toBe("retrying");
    h.advance(retryDelay(0) - 1);
    expect(h.sockets).toHaveLength(1);
    h.advance(1);
    expect(h.sockets).toHaveLength(2);
    expect(h.link.model.state).toBe("connecting");
  });

  test("stop closes the socket, clears every timer, and start/stop toggling never duplicates sockets", () => {
    const h = harness();
    for (let i = 0; i < 5; i++) { h.link.start(); h.link.start(); h.link.stop(); }
    expect(h.sockets).toHaveLength(5);
    expect(h.sockets.every((s) => s.closed)).toBe(true);
    expect(h.timers.size).toBe(0);
    expect(h.link.model.state).toBe("off");
    h.link.start();
    h.open().onopen();
    h.link.stop();
    h.advance(60_000);
    expect(h.sockets).toHaveLength(6); // no reconnect after a deliberate stop
  });

  test("events from a superseded socket are ignored", () => {
    const h = harness();
    h.link.start();
    const old = h.open();
    h.link.stop();
    h.link.start();
    old.onopen?.();
    old.onmessage?.({ data: '{"seed":9,"x":0,"y":0}' });
    expect(h.link.model.state).toBe("connecting");
    expect(h.link.model.telemetry).toBe(null);
  });

  test("a throwing WebSocket constructor counts as a failed attempt", () => {
    let fired = 0;
    const link = createLiveLink({
      url: "ws://x",
      WebSocketImpl: class { constructor() { throw new Error("blocked"); } },
      setTimeoutFn: (fn) => { if (fired++ === 0) fn(); return 1; }, // run only the deferred close
      clearTimeoutFn: () => {},
      setIntervalFn: () => 2,
      clearIntervalFn: () => {},
      now: () => 0,
    });
    link.start();
    expect(link.model.state).toBe("retrying");
    expect(link.model.attempt).toBe(1);
  });
});
