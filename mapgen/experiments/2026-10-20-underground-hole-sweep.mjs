// 2026-10-20 — the underground-hole sweep (I46's world-side half): fetch a
// window of tiles from a running gen server and count VOID px (transparent or
// pure black) per tile — the "floating lava / air pockets" report's test.
//
// Result (this session, seed 78633191, z0 window tx 35–45 × ty 62–74 = 143
// tiles, vs the SURFACE_V3=1 server): ZERO underground air holes (every tile
// fully painted; the largest void count sits far below the 8000-px air
// threshold), while the NO-FLAG default config (no SURFACE_V3) renders tile
// 40/63 at 179,350/262,144 void px and 39/62 at 238,768 px (91% = the
// detached fill band = the "floating" image). METER-CLASS: E1 (presence
// counts: tiles whose void > threshold).
//
// Usage: node mapgen/experiments/2026-10-20-underground-hole-sweep.mjs \
//          [baseUrl] [seed] [z]
//   baseUrl default http://localhost:8082/gen/tile · seed default 78633191 ·
//   z default 0 (the tile window names are DISPLAY chunks at that zoom).
import { PNG } from "pngjs";

const base = process.argv[2] ?? "http://localhost:8082/gen/tile";
const seed = process.argv[3] ?? "78633191";
const z = Number(process.argv[4] ?? 0);
const jobs = [];
for (let tx = 35; tx <= 45; tx++) for (let ty = 62; ty <= 74; ty++) jobs.push([tx, ty]);

async function one([tx, ty]) {
  try {
    const r = await fetch(`${base}/${seed}/${z}/${tx}/${ty}.png`, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) return { tx, ty, err: r.status };
    const img = PNG.sync.read(Buffer.from(await r.arrayBuffer()));
    let black = 0, lava = 0;
    const total = img.width * img.height;
    for (let i = 0; i < total; i++) {
      const q = 4 * i, r2 = img.data[q], g = img.data[q + 1], b = img.data[q + 2], a = img.data[q + 3];
      if (a < 10 || (r2 === 0 && g === 0 && b === 0)) black++;
      else if (r2 > 150 && g < 140 && b < 80) lava++;
    }
    return { tx, ty, black, lava, total };
  } catch (e) {
    return { tx, ty, err: String(e).slice(0, 60) };
  }
}

const results = [];
for (let i = 0; i < jobs.length; i += 8) {
  const batch = await Promise.all(jobs.slice(i, i + 8).map(one));
  results.push(...batch);
}
const errs = results.filter((r) => r.err);
const holes = results
  .filter((r) => !r.err && r.black > 8000)
  .sort((a, b) => b.black - a.black);
console.log("base:", base, "seed:", seed, "z:", z);
console.log("total tiles:", results.length, "errors:", errs.length, errs.slice(0, 4));
console.log("tiles with air (void > 8000 px):");
for (const h of holes) console.log(`  (${h.tx},${h.ty}) void=${h.black} lava=${h.lava} / ${h.total}`);
if (!holes.length) console.log("  NONE — every tile in the window is fully painted");
