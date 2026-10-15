// 2026-10-15-zoom-black-probe.mjs — AUDIT (no fix): characterize the user's
// "noise when zoomed in, black when zoomed out" report in the flags-ON lane.
// renderTile's z>0 path (genmap-server.mjs:120) is a majority-vote downsample
// that degenerates to a SINGLE center point-sample for scale<=10 (z1..z3,
// step==scale) => sparse noise filaments ("noodles") miss to air -> black.
// This probe fetches the SAME world region at z0..z4 and measures the black
// fraction, to confirm black climbs with zoom (the downsample artifact) vs a
// region-only black (which would be flat across z).
// METER-CLASS: E1 (black-pixel fraction per zoom; OPAQUE>=95%, MIXED 5-95%, COLORED<5%).
// Run: node mapgen/experiments/2026-10-15-zoom-black-probe.mjs   (hits a live
// flags-ON :8082 by default; BASE/SEED env to override. Read-only GET tiles.)

import { PNG } from "pngjs";

const BASE = process.env.BASE ?? "http://127.0.0.1:8082";
const SEED = Number(process.env.SEED ?? 78633191);

// representative base z0 coords (tx,ty): known noodle filler cells (rows 62..95)
// + the plains/holy-mountain surface band (middle-x, surface-y ~ ty 48..52).
const cells = [
  { label: "filler solid_wall (1,62)", tx: 1, ty: 62 },
  { label: "filler empty (12,70)", tx: 12, ty: 70 },
  { label: "filler mid (35,80)", tx: 35, ty: 80 },
  { label: "plains surface (35,49)", tx: 35, ty: 49 },
  { label: "plains surface (30,50)", tx: 30, ty: 50 },
  { label: "surface left (10,50)", tx: 10, ty: 50 },
];

function blackFrac(buf) {
  const png = PNG.sync.read(buf);
  const d = png.data;
  let black = 0, opaque = 0;
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] < 8) continue; // transparent = sky, not counted
    opaque++;
    if (d[p] < 6 && d[p + 1] < 6 && d[p + 2] < 6) black++;
  }
  return { blackFrac: opaque ? black / opaque : 0, opaque, black };
}
const cls = (b) => (b >= 0.95 ? "OPAQUE-BLACK" : b >= 0.05 ? "MIXED" : "COLORED");

for (const c of cells) {
  const row = [];
  for (let z = 0; z <= 6; z++) {
    const scale = 2 ** z;
    const x = Math.floor(c.tx / scale), y = Math.floor(c.ty / scale);
    const url = `${BASE}/gen/tile/${SEED}/${z}/${x}/${y}.png`;
    const r = await fetch(url);
    if (!r.ok) { row.push(`z${z}=HTTP${r.status}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const { blackFrac: b } = blackFrac(buf);
    row.push(`z${z}=${cls(b)}(${(b * 100).toFixed(0)}%)`);
  }
  console.log(`${c.label.padEnd(26)} ${row.join("  ")}`);
}
