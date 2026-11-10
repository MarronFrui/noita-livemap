// live-link — THE telemetry-bridge connection state machine, shared by both
// viewers (src/main.ts = the noitamap overlay, public/genmap.html = the
// generated-map viewer; the genmap server serves this file at /live-link.mjs).
// Framework-free ESM, no DOM: tests/live-link.test.mjs drives it in node.
//
// States (model.state):
//
//   off ──start──▶ connecting ──open──▶ waiting ──telemetry──▶ live
//    ▲                ▲   │                │                    │ ▲
//    │              retry close            close   no telemetry │ │ telemetry
//    │                │   ▼                ▼       for staleMs  ▼ │
//    └──stop── (any)  retrying ◀──close── (waiting|live|stale) ◀─ stale
//
//   off         user turned live mode off; no socket, no timers
//   connecting  a socket is opening (attempt = consecutive failures so far)
//   waiting     bridge connected, no telemetry yet (Noita closed / mod off)
//   live        telemetry arrived within staleMs
//   stale       bridge connected, telemetry stopped (game paused/closed,
//               player dead — the mod only writes while a player exists)
//   retrying    socket closed; reconnect at retryAt (capped backoff)
//
// `transition(model, event)` is pure — every rule lives there. The driver
// (`createLiveLink`) only performs the effects a state implies: one socket
// while connecting/waiting/live/stale, one retry timer while retrying, one
// 1 s clock tick while not off. Events from a superseded socket are dropped.
// `describe(model)` is the ONE place link state becomes user-facing text.

export const STALE_MS = 5000;
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
export const RETRY_MAX_MS = 10000;

export const retryDelay = (attempt) => RETRY_DELAYS_MS[attempt] ?? RETRY_MAX_MS;

export const initialModel = (now = 0) => ({
  state: "off",
  attempt: 0, // consecutive failed connects (reset by a successful open)
  telemetry: null, // last valid payload (kept across reconnects: the marker stays put)
  lastAt: 0, // receipt time of `telemetry`
  retryAt: 0,
  now,
});

const SOCKET_STATES = new Set(["connecting", "waiting", "live", "stale"]);
export const hasSocket = (state) => SOCKET_STATES.has(state);

// event: { type: start|stop|open|close|retry|telemetry|tick, at, telemetry? }
export function transition(m, ev) {
  const now = ev.at ?? m.now;
  const s = m.state;
  const to = (state, extra = {}) => ({ ...m, now, state, ...extra });
  switch (ev.type) {
    case "start":
      return s === "off" ? to("connecting", { attempt: 0 }) : { ...m, now };
    case "stop":
      return to("off", { attempt: 0, retryAt: 0 });
    case "open":
      return s === "connecting" ? to("waiting", { attempt: 0 }) : { ...m, now };
    case "close": {
      if (!hasSocket(s)) return { ...m, now };
      // a socket that never opened is a failed attempt; a dropped open one restarts the ladder
      const attempt = s === "connecting" ? m.attempt + 1 : 0;
      return to("retrying", { attempt, retryAt: now + retryDelay(s === "connecting" ? m.attempt : 0) });
    }
    case "retry":
      return s === "retrying" ? to("connecting") : { ...m, now };
    case "telemetry":
      if (s !== "waiting" && s !== "live" && s !== "stale") return { ...m, now };
      return to("live", { telemetry: ev.telemetry, lastAt: now });
    case "tick":
      if (s === "live" && now - m.lastAt >= STALE_MS) return to("stale");
      return { ...m, now };
    default:
      return m;
  }
}

// Validate + normalise one bridge message (the Lua writer's contract:
// tests/bridge/telemetry-format.test.mjs). Returns null for anything else,
// so a malformed write never moves the marker or the state.
export function parseTelemetry(raw) {
  let d = raw;
  if (typeof raw === "string") {
    try { d = JSON.parse(raw); } catch { return null; }
  }
  if (!d || typeof d !== "object") return null;
  const x = Number(d.x), y = Number(d.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const n = Number(d.seed);
  return {
    seed: d.seed != null && Number.isFinite(n) ? n >>> 0 : null,
    seedText: d.seed == null ? "?" : String(d.seed),
    x,
    y,
    biome: typeof d.biome === "string" ? d.biome : "?",
    ts: Number.isFinite(Number(d.ts)) ? Number(d.ts) : null,
  };
}

// The user-facing line for a link state. tone: ok | warn | error | muted.
export function describe(m) {
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
  switch (m.state) {
    case "off":
      return { tone: "muted", text: "Live: off" };
    case "connecting":
      return { tone: "warn", text: m.attempt ? `Reconnecting to bridge (try ${m.attempt + 1})…` : "Connecting to bridge…" };
    case "waiting":
      return { tone: "warn", text: "Bridge connected — waiting for Noita (game running, mod enabled?)" };
    case "live":
      return { tone: "ok", text: "Live" };
    case "stale":
      return { tone: "warn", text: `No telemetry for ${secs(m.now - m.lastAt)}s — game paused or closed?` };
    case "retrying":
      return { tone: "error", text: `Bridge unreachable (npm run dev:bridge?) — retrying in ${secs(m.retryAt - m.now)}s` };
    default:
      return { tone: "error", text: `unknown link state ${m.state}` };
  }
}

// The effect driver. deps are injectable for tests.
//   onChange(model, prev) — after every state/telemetry/clock change
export function createLiveLink({
  url,
  onChange = () => {},
  WebSocketImpl = globalThis.WebSocket,
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis),
  now = () => Date.now(),
  log = () => {},
}) {
  let model = initialModel(now());
  let sock = null, retryTimer = null, clock = null;

  function dispatch(ev) {
    const prev = model;
    model = transition(prev, { at: now(), ...ev });
    if (model.state !== prev.state) log(`[live-link] ${prev.state} → ${model.state}`);
    reconcile(prev);
    if (model !== prev) onChange(model, prev);
  }

  // make the effects match the state
  function reconcile(prev) {
    const s = model.state;
    if (s === "connecting" && prev.state !== "connecting") openSocket();
    if (!hasSocket(s) && sock) closeSocket();
    if (s === "retrying" && prev.state !== "retrying") {
      retryTimer = setTimeoutFn(() => { retryTimer = null; dispatch({ type: "retry" }); }, Math.max(0, model.retryAt - model.now));
    }
    if (s !== "retrying" && retryTimer) { clearTimeoutFn(retryTimer); retryTimer = null; }
    if (s !== "off" && !clock) clock = setIntervalFn(() => dispatch({ type: "tick" }), 1000);
    if (s === "off" && clock) { clearIntervalFn(clock); clock = null; }
  }

  function openSocket() {
    let ws;
    try {
      ws = new WebSocketImpl(url);
    } catch (e) {
      log(`[live-link] cannot open ${url}: ${e?.message ?? e}`);
      setTimeoutFn(() => dispatch({ type: "close" }), 0); // treat as a failed attempt
      return;
    }
    sock = ws;
    const mine = (fn) => (e) => { if (sock === ws) fn(e); }; // drop a superseded socket's events
    ws.onopen = mine(() => dispatch({ type: "open" }));
    ws.onclose = mine(() => { sock = null; dispatch({ type: "close" }); });
    ws.onerror = mine(() => { try { ws.close(); } catch { /* close follows */ } });
    ws.onmessage = mine((e) => {
      const t = parseTelemetry(e.data);
      if (t) dispatch({ type: "telemetry", telemetry: t });
      else log("[live-link] ignored malformed telemetry");
    });
  }

  function closeSocket() {
    const ws = sock;
    sock = null; // detach first: its close event is now ignored
    try { ws.close(); } catch { /* already closed */ }
  }

  return {
    start: () => dispatch({ type: "start" }),
    stop: () => dispatch({ type: "stop" }),
    get model() { return model; },
  };
}
