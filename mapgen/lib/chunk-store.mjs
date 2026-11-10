// Lazy chunk store — the template/scene planes materialized per chunk on
// first read (the game's own law: a chunk exists only once something looks
// at it). Drop-in for an eager `Map("cx,cy" -> Uint8Array 512*512*3)` filled
// for the whole world up front (~4600 chunks ≈ 3.5 GB RSS).
//
// Law: the paint primitives (template-render.mjs) are pure — every pixel is a
// function of (op args, x, y); none reads a buffer back. So a world plane =
// the ordered op list, and chunk K = the ops whose footprint touches K,
// replayed IN RECORDED ORDER with writes clipped to K. Same ops, same order,
// same bytes as the eager render (pinned exhaustively by
// tests/mapgen/chunk-store.test.mjs). A chunk no op ever writes stays absent
// (`get` → undefined), exactly like the eager Map.
//
// Planes: the fg plane is the store itself; the bg plane (blitBackdrop's
// I49 plane) is `store.get("bg")`, a store of the same kind.

export const CHUNK_PX = 512;
const CANVAS_W = 71, CANVAS_H = 144; // setWorldPx's canvas bounds (0..70, 0..143)
const RESIDENT_DEFAULT = Number(process.env.MAPGEN_CHUNK_CACHE ?? 384); // ≈ 300 MB of fg chunks

// world px rect [x0, x1) × [y0, y1) -> the canvas chunk keys it touches
function chunkKeysOf(x0, y0, x1, y1) {
  const out = [];
  const cx0 = Math.max(0, Math.floor(x0 / CHUNK_PX) + 35), cx1 = Math.min(CANVAS_W - 1, Math.floor((x1 - 1) / CHUNK_PX) + 35);
  const cy0 = Math.max(0, Math.floor(y0 / CHUNK_PX) + 62), cy1 = Math.min(CANVAS_H - 1, Math.floor((y1 - 1) / CHUNK_PX) + 62);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) out.push(`${cx},${cy}`);
  return out;
}

// Writes aimed at any chunk other than the replay target land here and are
// dropped (the primitives clip their loops, so this only catches edges).
const DISCARD = new Uint8Array(CHUNK_PX * CHUNK_PX * 3);
const DISCARD_PLANE = { clip: null, get: () => DISCARD, set: () => {}, has: () => true };

// The single-chunk `buffers` the primitives see during a replay.
class ReplayTarget {
  constructor(key, bgTarget) {
    const [cx, cy] = key.split(",").map(Number);
    this.key = key;
    this.buf = undefined;
    this.bg = bgTarget; // the bg plane while replaying (DISCARD_PLANE on fg replays)
    // world-px clip of the target chunk — the primitives restrict their loops to it
    const x0 = (cx - 35) * CHUNK_PX, y0 = (cy - 62) * CHUNK_PX;
    this.clip = { x0, y0, x1: x0 + CHUNK_PX, y1: y0 + CHUNK_PX };
  }
  get(k) {
    if (k === this.key) return this.buf;
    if (k === "bg") return this.bg;
    return DISCARD;
  }
  set(k, v) { if (k === this.key) this.buf = v; }
  has(k) { return k === this.key ? this.buf !== undefined : true; }
}

export class LazyChunkStore {
  constructor({ resident = RESIDENT_DEFAULT, isBg = false } = {}) {
    this.recording = true;
    this.ops = []; // { run(buffers), plane }
    this.index = new Map(); // chunk key -> [op idx]
    this.resident = new Map(); // chunk key -> Uint8Array | null (null = no write landed)
    this.pinned = new Map(); // chunk key -> Uint8Array set() directly (never evicted)
    this.cap = Math.max(16, resident);
    this.isBg = isBg;
    this.bgStore = isBg ? null : new LazyChunkStore({ resident: Math.max(16, resident >> 2), isBg: true });
    this.stats = { materialized: 0, evicted: 0 };
  }
  // record one primitive call over the world-px rect [x0,x1)×[y0,y1)
  record(x0, y0, x1, y1, run) {
    const idx = this.ops.length;
    this.ops.push(run);
    for (const k of chunkKeysOf(x0, y0, x1, y1)) {
      let l = this.index.get(k);
      if (!l) this.index.set(k, (l = []));
      l.push(idx);
      this.resident.delete(k); // a late op invalidates the chunk's cached copy
    }
  }
  // the bg plane lives under "bg" (the I49 plane, same contract as the eager Map)
  get(key) {
    if (key === "bg") return this.bgStore ?? undefined;
    const pin = this.pinned.get(key);
    if (pin !== undefined) return pin;
    const hit = this.resident.get(key);
    if (hit !== undefined) return hit ?? undefined;
    const ids = this.index.get(key);
    if (!ids) return undefined;
    const buf = this.materialize(key, ids);
    this.resident.set(key, buf);
    if (this.resident.size > this.cap) {
      // FIFO eviction (reads are per pixel — no per-hit LRU bookkeeping);
      // an evicted chunk re-materializes byte-identically on its next read
      const oldest = this.resident.keys().next().value;
      this.resident.delete(oldest);
      this.stats.evicted++;
    }
    return buf ?? undefined;
  }
  materialize(key, ids) {
    const target = new ReplayTarget(key, DISCARD_PLANE);
    // a bg store's ops are blitBackdrop calls: they reach their plane via
    // buffers.get("bg"), so the bg replay target IS the "bg" of a wrapper
    const buffers = this.isBg
      ? { clip: target.clip, get: (k) => (k === "bg" ? target : DISCARD), set: () => {}, has: () => true }
      : target;
    for (const i of ids) this.ops[i](buffers);
    this.stats.materialized++;
    return target.buf ?? null;
  }
  has(key) { return key === "bg" ? !!this.bgStore : this.index.has(key) || this.pinned.has(key); }
  keys() { return new Set([...this.index.keys(), ...this.pinned.keys()]).values(); }
  get size() { let n = this.index.size; for (const k of this.pinned.keys()) if (!this.index.has(k)) n++; return n; }
  // the eager contract's mutators (tests inject buffers into plain Maps; a
  // direct set on the lazy store pins that chunk resident and unrecorded)
  set(key, buf) {
    if (key === "bg") throw new Error("LazyChunkStore: the bg plane is owned");
    this.pinned.set(key, buf);
    return this;
  }
  // drop every resident buffer (the op list stays — reads re-materialize)
  clear() {
    this.resident.clear();
    this.pinned.clear();
    this.bgStore?.clear();
  }
}

export const isLazyStore = (b) => b instanceof LazyChunkStore;
