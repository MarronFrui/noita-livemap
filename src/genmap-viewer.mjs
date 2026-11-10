// genmap-viewer — the generated-map viewer's state machines (public/genmap.html),
// pulled out of the page so they are explicit and tested
// (tests/genmap-viewer.test.mjs). Served by the genmap server at
// /genmap-viewer.mjs. Framework-free ESM; every effect is injected.
//
// 1. Tile entry  (createTileCache)
//      loading ──load──▶ ok
//         │
//         └──error──▶ error ──(retryAt passed, next request)──▶ loading
//    A failed tile used to stay "loading" forever (counted as pending, never
//    re-asked) although the server retries on the next ask (tile-pool.mjs).
//    Per-tile backoff: TILE_RETRY_MS[attempt], capped.
//
// 2. Status poll  (createStatusPoller) — ONE loop per viewer:
//      idle ──follow(seed)──▶ polling(seed) ──stop()──▶ idle
//      polling: generating → every 500 ms · ready → every 5 s (epoch watch,
//               I46) · fetch failed → backoff 1 s … 10 s, reported as
//               `unreachable` (the loop never dies — a genmap restart is
//               exactly when the epoch must be re-read)
//    follow() supersedes the previous loop (token), so seed switches and
//    regens no longer stack parallel pollers, and a late response for an
//    old seed is dropped.
//
// 3. Status line  (composeStatus) — a pure function of the viewer's state,
//    replacing last-writer-wins textContent writes (draw() used to erase the
//    generation progress and every one-shot message on the next frame).
//    Priority: notice (transient, expires) > server unreachable >
//    generating > failed tiles > loading tiles > idle.

export const TILE_RETRY_MS = [2000, 4000, 8000, 16000];
export const TILE_RETRY_MAX_MS = 30000;
export const POLL_GENERATING_MS = 500;
export const POLL_READY_MS = 5000;
export const POLL_ERROR_MS = [1000, 2000, 5000];
export const POLL_ERROR_MAX_MS = 10000;
export const NOTICE_MS = 4000;

const ladder = (steps, max, i) => steps[i] ?? max;

// makeImage() -> an object with onload/onerror/src (an HTMLImageElement in the page)
// onSettle(key, entry) — after any load/error (the page redraws)
export function createTileCache({ makeImage, onSettle = () => {}, now = () => Date.now(), scheduleFn = (fn, ms) => setTimeout(fn, ms) }) {
  let entries = new Map(); // key -> { state, img, attempt, retryAt }

  function start(key, url, e) {
    const img = makeImage();
    e.state = "loading";
    e.img = img;
    img.onload = () => {
      if (entries.get(key) !== e || e.img !== img) return; // cleared or superseded
      e.state = "ok";
      onSettle(key, e);
    };
    img.onerror = () => {
      if (entries.get(key) !== e || e.img !== img) return;
      e.state = "error";
      const delay = ladder(TILE_RETRY_MS, TILE_RETRY_MAX_MS, e.attempt);
      e.attempt++;
      e.retryAt = now() + delay;
      scheduleFn(() => onSettle(key, e), delay); // wake the page to re-ask
      onSettle(key, e);
    };
    img.src = e.attempt ? `${url}${url.includes("?") ? "&" : "?"}r=${e.attempt}` : url;
  }

  return {
    // the entry for key, (re)starting its load when needed
    request(key, url) {
      let e = entries.get(key);
      if (!e) {
        e = { state: "loading", img: null, attempt: 0, retryAt: 0 };
        entries.set(key, e);
        start(key, url, e);
      } else if (e.state === "error" && now() >= e.retryAt) {
        start(key, url, e);
      }
      return e;
    },
    peek: (key) => entries.get(key),
    clear() { entries = new Map(); },
    get size() { return entries.size; },
  };
}

// fetchStatus(seed) -> Promise<status JSON>; onStatus(seed, status); onError(seed, err, retryInMs)
export function createStatusPoller({
  fetchStatus,
  onStatus = () => {},
  onError = () => {},
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
  clearTimeoutFn = (id) => clearTimeout(id),
}) {
  let token = 0, timer = null, failures = 0;

  function tick(seed, my) {
    timer = null;
    fetchStatus(seed).then(
      (s) => {
        if (my !== token) return; // superseded by a newer follow()/stop()
        failures = 0;
        onStatus(seed, s);
        if (my === token) timer = setTimeoutFn(() => tick(seed, my), s && s.ready ? POLL_READY_MS : POLL_GENERATING_MS);
      },
      (err) => {
        if (my !== token) return;
        const wait = ladder(POLL_ERROR_MS, POLL_ERROR_MAX_MS, failures++);
        onError(seed, err, wait);
        timer = setTimeoutFn(() => tick(seed, my), wait);
      },
    );
  }

  const cancel = () => { token++; if (timer != null) { clearTimeoutFn(timer); timer = null; } };
  return {
    follow(seed) { cancel(); failures = 0; tick(seed, token); },
    stop: cancel,
  };
}

// view: {
//   seed, z,
//   gen: null | { ready, done, total, errors },      latest /gen/status
//   unreachable: null | { retryAt },                  status poll failing
//   tiles: { pending, failed },                       active level in viewport
//   notice: null | { text, until },
//   marker: null | { seed, biome, wx, wy },
//   now,
// }
export function composeStatus(v) {
  if (v.seed == null) return "enter a seed and hit load";
  let text;
  const { pending = 0, failed = 0 } = v.tiles ?? {};
  if (v.notice && v.now < v.notice.until) text = v.notice.text;
  else if (v.unreachable) text = `genmap server unreachable — retrying in ${Math.max(0, Math.ceil((v.unreachable.retryAt - v.now) / 1000))}s`;
  else if (v.gen && !v.gen.ready) {
    const errs = v.gen.errors?.length ? ` — ${v.gen.errors.length} errors` : "";
    text = `generating seed ${v.seed}: ${v.gen.done}/${v.gen.total} areas${errs}…${pending ? ` (${pending} tiles queued)` : ""}`;
  } else if (failed) text = `${failed} tile${failed > 1 ? "s" : ""} failed — retrying (seed ${v.seed}, z${v.z})${pending ? ` · loading ${pending}` : ""}`;
  else if (pending) text = `loading ${pending} tiles… (seed ${v.seed}, z${v.z})`;
  else text = `seed ${v.seed}, z${v.z} — canvas px; world px = canvas − (17920, 31744)`;
  if (v.marker && v.marker.seed === v.seed) text += ` · ${v.marker.biome ?? ""} (${Math.round(v.marker.wx)}, ${Math.round(v.marker.wy)})`;
  return text;
}

export const notice = (text, now = Date.now(), ms = NOTICE_MS) => ({ text, until: now + ms });
