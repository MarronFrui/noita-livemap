// 2026-10-15-sweep-black.mjs — AUDIT (no fix): sweep a world ROW across all
// tx at a given zoom, measuring black fraction, to LOCATE the regions the user
// reports black (frozen field, plains/holy-mountain surface). Complements the
// zoom probe (which found my 6 guessed cells colored at all z).
// METER-CLASS: E1 (black-pixel fraction per tile).
// Run: node mapgen/experiments/2026-10-15-sweep-black.mjs [ty] [z]   (default ty=49 z=0; hits live :8082)

import { PNG } from "pngjs";
const BASE = process.env.BASE ?? "http://127.0.0.1:8082";
const SEED = Number(process.env.SEED ?? 78633191);
const ty = Number(process.argv[2] ?? 49);
const z = Number(process.argv[3] ?? 0);
const scale = 2 ** z;

function blackFrac(buf) {
  const png = PNG.sync.read(buf);
  const d = png.data;
  let black = 0, opaque = 0;
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] < 8) continue;
    opaque++;
    if (d[p] < 6 && d[p + 1] < 6 && d[p + 2] < 6) black++;
  }
  return opaque ? black / opaque : 0;
}

const gw = Math.ceil(71 / 1); // world chunks wide ~71 (z0); clamp by server 404s
let line = "";
const hits = [];
for (let tx = 0; tx <= 70; tx++) {
  const x = Math.floor(tx / scale), y = Math.floor(ty / scale);
  const r = await fetch(`${BASE}/gen/tile/${SEED}/${z}/${x}/${y}.png`);
  if (!r.ok) { line += "X"; continue; }
  const b = blackFrac(Buffer.from(await r.arrayBuffer()));
  const ch = b >= 0.95 ? "#" : b >= 0.5 ? "+" : b >= 0.05 ? "." : " ";
  line += ch;
  if (b >= 0.5) hits.push(`${tx}( ${(b * 100).toFixed(0)}% )`);
}
console.log(`ty=${ty} z=${z} scale=${scale}  tx 0..70  legend: '#'=>=95%black '+'=50-95% '.'=5-50% ' '=colored`);
console.log(line);
console.log(`black-majority tiles: ${hits.length ? hits.join(" ") : "none"}`);
