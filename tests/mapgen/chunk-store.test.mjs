// The lazy chunk store (mapgen/lib/chunk-store.mjs) — the per-chunk
// materialization must be BYTE-IDENTICAL to the eager whole-world render it
// replaced (renderTemplateWorld's eager Map, 4642 fg + 186 bg chunks for the
// capture seed; the wang spawn-scene planes). Unit laws first, then the
// exhaustive data-gated equivalence.

import { describe, test, expect, afterAll } from "vitest";
import { LazyChunkStore } from "../../mapgen/lib/chunk-store.mjs";
import { renderTemplateWorld, blitBackdrop } from "../../mapgen/lib/template-render.mjs";
import { loadWangWorld, ensureWorld, buildWangScenes } from "../../mapgen/lib/world-gen.mjs";
import path from "node:path";
import { dataDir, hasNoitaData, CAPTURE_SEED, repoRoot } from "../helpers/data.mjs";
import { releaseWorld } from "../helpers/world.mjs";

const fill = (v) => (b) => {
  // a whole-chunk op on canvas chunk (35,62) = world origin (0,0)
  let buf = b.get("35,62");
  if (!buf) { buf = new Uint8Array(512 * 512 * 3).fill(9); b.set("35,62", buf); }
  buf.fill(v);
};

describe("LazyChunkStore — unit laws", () => {
  test("a chunk no op touches is absent (undefined), like the eager Map", () => {
    const s = new LazyChunkStore();
    s.record(0, 0, 512, 512, fill(5));
    expect(s.get("0,0")).toBeUndefined();
    expect(s.get("35,62")[0]).toBe(5);
  });

  test("ops replay in recorded order (the later op wins)", () => {
    const s = new LazyChunkStore();
    s.record(0, 0, 512, 512, fill(5));
    s.record(0, 0, 512, 512, fill(7));
    expect(s.get("35,62")[100]).toBe(7);
  });

  test("an evicted chunk re-materializes byte-identically", () => {
    const s = new LazyChunkStore({ resident: 16 });
    for (let i = 0; i < 40; i++) s.record(i * 512, 0, i * 512 + 512, 512, (b) => {
      const k = `${35 + i},62`;
      let buf = b.get(k);
      if (!buf) { buf = new Uint8Array(512 * 512 * 3); b.set(k, buf); }
      buf.fill(i);
    });
    const first = Uint8Array.from(s.get("35,62"));
    for (let i = 1; i < 40; i++) s.get(`${35 + i},62`);
    expect(s.stats.evicted).toBeGreaterThan(0);
    expect(Buffer.compare(Buffer.from(s.get("35,62")), Buffer.from(first))).toBe(0);
  });

  test("a late op invalidates the cached chunk; a set() chunk is pinned", () => {
    const s = new LazyChunkStore();
    s.record(0, 0, 512, 512, fill(5));
    expect(s.get("35,62")[0]).toBe(5);
    s.record(0, 0, 512, 512, fill(6));
    expect(s.get("35,62")[0]).toBe(6);
    const pinned = new Uint8Array(512 * 512 * 3).fill(3);
    s.set("1,1", pinned);
    expect(s.get("1,1")).toBe(pinned);
  });

  test("blitBackdrop on a lazy store records onto the bg plane; a plain Map stays eager", () => {
    // no art on disk is needed for the contract: a missing image returns 0 in both modes
    const s = new LazyChunkStore();
    expect(blitBackdrop(s, "/nonexistent", "x.png", 0, 0)).toBe(0);
    expect(s.get("bg")).toBeInstanceOf(LazyChunkStore);
    const m = new Map();
    expect(blitBackdrop(m, "/nonexistent", "x.png", 0, 0)).toBe(0);
  });
});

const sameBytes = (a, b) => Buffer.compare(
  Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;

// every canvas key in both planes: present in both + byte-equal, or absent in both.
// Yields a macrotask every 100 keys (the I36 law: the 4642 materializations
// are ~34 s of work, one sync span would trip the 60 s birpc watchdog).
async function comparePlanes(eager, lazy) {
  let ok = 0, bad = 0, missing = 0, extra = 0, n = 0;
  for (let cy = 0; cy < 144; cy++) {
    for (let cx = 0; cx < 71; cx++) {
      if (++n % 100 === 0) await new Promise((r) => setImmediate(r));
      const k = `${cx},${cy}`;
      const e = eager?.get(k), l = lazy?.get(k);
      if (!e && !l) continue;
      if (e && !l) missing++;
      else if (!e && l) extra++;
      else if (sameBytes(e, l)) ok++;
      else bad++;
    }
  }
  return { ok, bad, missing, extra };
}

describe.skipIf(!hasNoitaData())("lazy == eager, exhaustively (capture seed) — data-gated", () => {
  test("renderTemplateWorld: every fg + bg chunk byte-identical (4642 + 186)", async () => {
    const { config } = loadWangWorld(dataDir);
    const lazy = renderTemplateWorld(dataDir, config, CAPTURE_SEED, { eager: false });
    await new Promise((r) => setImmediate(r));
    let eager = renderTemplateWorld(dataDir, config, CAPTURE_SEED, { eager: true }); // the ~37 s reference span
    await new Promise((r) => setImmediate(r));
    const fg = await comparePlanes(eager, lazy);
    const bg = await comparePlanes(eager.get("bg"), lazy.get("bg"));
    eager.get("bg")?.clear(); eager.clear(); eager = null; lazy.clear(); // ~3.5 GB back
    expect(fg).toEqual({ ok: 4642, bad: 0, missing: 0, extra: 0 });
    expect(bg).toEqual({ ok: 186, bad: 0, missing: 0, extra: 0 }); // dig #219: 192 → 186 — init() runs as Lua, the unchosen branches' background art (the second side cavern, …) no longer loads
  }, 240000);

  let world = null;
  afterAll(() => { releaseWorld(world); world = null; });
  test("the wang spawn-scene planes: lazy == eager (fractional Lua origins included)", async () => {
    world = ensureWorld(CAPTURE_SEED, dataDir, { cacheDir: path.join(repoRoot, "mapgen/out/gen-cache/r3m"), onProgress: () => {} });
    await world.ready;
    const lazy = world.wangScenes;
    expect(lazy).toBeInstanceOf(LazyChunkStore);
    process.env.MAPGEN_EAGER_TEMPLATES = "1";
    let eager;
    try { eager = await buildWangScenes(world); } finally { delete process.env.MAPGEN_EAGER_TEMPLATES; }
    expect(eager).toBeInstanceOf(Map);
    const fg = await comparePlanes(eager, lazy);
    const bg = await comparePlanes(eager.get("bg"), lazy.get("bg"));
    expect(fg.bad + fg.missing + fg.extra).toBe(0);
    expect(bg.bad + bg.missing + bg.extra).toBe(0);
    expect(fg.ok + bg.ok).toBe(521); // the measured scene-chunk count (2026-11-08)
  }, 240000);
});
