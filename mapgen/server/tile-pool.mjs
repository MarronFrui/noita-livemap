// The tile worker pool (perf D, 2026-11-08) — direct-law tile renders spread
// over N worker threads (tile-worker.mjs), so the server stays responsive and
// a viewport's tiles render in parallel.
//
// Scheduling:
//   - two priorities: HIGH (a viewer request) before LOW (prewarm); a queued
//     LOW task that a viewer then asks for is promoted (bump(key))
//   - LOW tasks never take the last idle worker — an interactive request
//     always finds a free worker within one tile render
//   - every worker builds a seed's world on its first task for it, in
//     parallel (the gen-cache .bin writes are atomic — world-gen.mjs
//     writeFileAtomic — so concurrent cold builds are safe; a one-warmer
//     rule was measured to add a full serial build, ~5.5 s, to the first
//     viewport)
//   - a worker that dies is replaced; its in-flight task fails (the tile
//     service then answers 500 and the next ask retries)
// Memory: each worker holds its own world (~0.6 GB at ready + its chunk
// cache), so GENMAP_WORKERS × that is the server's budget.

import { Worker } from "node:worker_threads";

const WORKER_URL = new URL("./tile-worker.mjs", import.meta.url);

export class TilePool {
  // workerUrl: the worker script (tests inject a fake one)
  constructor({ size = 4, dataDir, cacheDir, chunkCache = 192, workerUrl = WORKER_URL, log = () => {} }) {
    this.size = Math.max(1, size);
    this.opts = { dataDir, cacheDir, chunkCache, workerUrl };
    this.log = log;
    this.workers = [];
    this.high = []; // tasks
    this.low = [];
    this.byKey = new Map(); // key -> queued task (for promotion)
    this.seedState = new Map(); // seed -> { ready: bool (≥ 1 worker built it), done, total }
    this.nextId = 1;
    this.stats = { rendered: 0, promoted: 0, respawned: 0 };
    for (let i = 0; i < this.size; i++) this.spawn();
  }
  spawn() {
    const w = new Worker(this.opts.workerUrl, {
      workerData: { dataDir: this.opts.dataDir, cacheDir: this.opts.cacheDir },
      env: { ...process.env, MAPGEN_CHUNK_CACHE: String(this.opts.chunkCache) },
    });
    w.busy = null; // the running task
    w.seeds = new Set(); // seeds this worker has a world for
    w.on("message", (m) => this.onMessage(w, m));
    w.on("error", (e) => this.log(`[pool] worker error: ${e?.message ?? e}`));
    w.on("exit", (code) => {
      this.workers = this.workers.filter((x) => x !== w);
      if (w.busy && !this.closing) w.busy.reject(new Error(`tile worker exited (${code})`)); // a deliberate close() leaves its tasks unsettled
      if (!this.closing) { this.stats.respawned++; this.spawn(); this.pump(); }
    });
    this.workers.push(w);
    return w;
  }
  onMessage(w, m) {
    if (m.type === "progress" || m.type === "ready") {
      const st = this.seedState.get(m.seed) ?? { ready: false, done: 0, total: 0 };
      if (m.type === "progress") { st.done = Math.max(st.done, m.done); st.total = m.total || st.total; }
      else { st.ready = true; st.done = st.total = m.total; w.seeds.add(m.seed); }
      this.seedState.set(m.seed, st);
      if (m.type === "ready") this.pump();
      return;
    }
    const t = w.busy;
    if (!t || t.id !== m.id) return;
    w.busy = null;
    if (m.type === "tile") { this.stats.rendered++; t.resolve(new Uint8Array(m.rgba)); }
    else t.reject(new Error(m.message));
    this.pump();
  }
  // render one direct-law tile; priority "high" | "low"
  render({ key, seed, z, x, y, captureOn, priority = "high" }) {
    return new Promise((resolve, reject) => {
      const t = { id: this.nextId++, key, seed, z, x, y, captureOn, priority, resolve, reject };
      (priority === "high" ? this.high : this.low).push(t);
      if (key) this.byKey.set(key, t);
      this.pump();
    });
  }
  // a viewer asked for a tile that is only queued as prewarm: move it up
  bump(key) {
    const t = this.byKey.get(key);
    if (!t || t.priority === "high") return;
    const i = this.low.indexOf(t);
    if (i < 0) return;
    this.low.splice(i, 1);
    t.priority = "high";
    this.high.push(t);
    this.stats.promoted++;
    this.pump();
  }
  take(queue) {
    return queue.length ? queue.shift() : null;
  }
  pump() {
    for (const w of this.workers) {
      if (w.busy) continue;
      let t = this.take(this.high);
      if (!t) {
        const idle = this.workers.filter((x) => !x.busy).length;
        if (idle > 1 || this.size === 1) t = this.take(this.low);
      }
      if (!t) continue;
      if (t.key && this.byKey.get(t.key) === t) this.byKey.delete(t.key);
      if (!this.seedState.has(t.seed)) this.seedState.set(t.seed, { ready: false, done: 0, total: 0 });
      w.busy = t;
      w.postMessage({ type: "render", id: t.id, seed: t.seed, z: t.z, x: t.x, y: t.y, captureOn: t.captureOn });
    }
  }
  progress(seed) {
    const st = this.seedState.get(seed);
    return st ? { ready: st.ready, done: st.done, total: st.total } : { ready: false, done: 0, total: 0 };
  }
  // drop a seed's queued prewarm (on /gen/clear) — running renders finish
  dropSeed(seed) {
    for (const q of [this.low]) {
      for (let i = q.length - 1; i >= 0; i--) {
        if (seed === null || q[i].seed === seed) { const [t] = q.splice(i, 1); t.reject(new Error("dropped")); this.byKey.delete(t.key); }
      }
    }
    if (seed === null) this.seedState.clear(); else this.seedState.delete(seed);
    for (const w of this.workers) { w.postMessage({ type: "drop", seed }); if (seed === null) w.seeds.clear(); else w.seeds.delete(seed); }
  }
  async close() {
    this.closing = true;
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
