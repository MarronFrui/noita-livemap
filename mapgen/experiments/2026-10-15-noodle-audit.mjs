// 2026-10-15-noodle-audit.mjs — AUDIT instrument (the "noodle chunks are
// black" report; audit-only, no fix). HTTP-classifies known filler cells
// (the biome-map filler defs, canvas rows >= 62, grid -1) against a
// genmap server on a DEDICATED port (never the user's :8082):
//   500            -> escaping throw = black in the viewer (route catch)
//   OPAQUE-BLACK   -> 200, worldColorAt null at >=95% of px (caught path)
//   MIXED          -> 200, black 5..95%
//   COLORED        -> 200, black <5% (noise solids + bg art present)
// METER-CLASS: E1 (presence counts steer; no shape metric consulted).
//
// Run (one server per run, sequential):
//   node mapgen/experiments/2026-10-15-noodle-audit.mjs --label HEAD-full \
//     --port 8093 --env SURFACE_V2=1 --env SURFACE_V3=1
//   node mapgen/experiments/2026-10-15-noodle-audit.mjs --label wt98183fc-full \
//     --server <wt>/mapgen/server/genmap-server.mjs --cwd <wt> --port 8094 \
//     --env SURFACE_V2=1 --env SURFACE_V3=1
// Output: table on stdout + mapgen/out/noodle-audit-<label>.json

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { findNoitaDataDir } from "../lib/paths.mjs";
import { loadBiomeConfig, biomeAt } from "../lib/biomes.mjs";
import { loadWangWorld } from "../lib/world-gen.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const optsAll = (name) => {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}`) out.push(argv[i + 1]);
  return out;
};
const label = opt("label", "run");
const port = Number(opt("port", 8093));
const serverPath = path.resolve(opt("server", path.join(REPO, "mapgen/server/genmap-server.mjs")));
const cwd = path.resolve(opt("cwd", path.dirname(path.dirname(serverPath))));
const seed = Number(opt("seed", 78633191));
const envFlags = optsAll("env"); // K=V pairs
const base = `http://localhost:${port}`;

// ---- cell selection (filler defs + controls) -----------------------------
const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const world = loadWangWorld(dataDir);
const SKY = 48, W = 71;
const FILLER_DEFS = ["empty.xml", "solid_wall.xml", "lava.xml", "temple_wall.xml", "lake.xml", "winter.xml", "desert.xml", "hills.xml"];
const cells = [];
{
  const byDef = new Map();
  for (let ty = 62; ty <= 95; ty++) {
    for (let tx = 0; tx < 71; tx++) {
      if (world.grid[ty * W + tx] !== -1) continue;
      const at = biomeAt(config, tx, ty - SKY);
      const fn = at ? at.biome.filename.split("/").pop() : "(null)";
      if (!byDef.has(fn)) byDef.set(fn, []);
      byDef.get(fn).push({ tx, ty, def: fn, kind: "filler" });
    }
  }
  for (const name of FILLER_DEFS) {
    const list = byDef.get(name) ?? [];
    if (!list.length) continue;
    const picks = [list[0], list[(list.length / 2) | 0], list[list.length - 1]];
    for (const p of picks) if (!cells.some((c) => c.tx === p.tx && c.ty === p.ty)) cells.push(p);
  }
  // camera-proximity cells (the viewer spawns at world 35*512,62*512)
  for (const [tx, ty] of [[35, 62], [34, 62], [36, 62], [35, 63]]) {
    if (world.grid[ty * W + tx] !== -1) continue;
    const at = biomeAt(config, tx, ty - SKY);
    const fn = at ? at.biome.filename.split("/").pop() : "(null)";
    if (!cells.some((c) => c.tx === tx && c.ty === ty)) cells.push({ tx, ty, def: fn, kind: "camera" });
  }
  // controls: one wang-area chunk (underground) + the sky chunk 34,14
  let wang = null;
  for (let ty = 63; ty <= 95 && !wang; ty++)
    for (let tx = 0; tx < 71 && !wang; tx++)
      if (world.grid[ty * W + tx] >= 0 && world.maps === undefined) wang = { tx, ty, def: "wang-area", kind: "control" };
  if (wang) cells.push(wang);
  cells.push({ tx: 34, ty: 14, def: "sky", kind: "control" });
}

// ---- HTTP helpers --------------------------------------------------------
async function get(url) {
  try {
    const r = await fetch(url);
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, buf };
  } catch (e) {
    return { status: -1, buf: Buffer.alloc(0), err: String(e?.message ?? e) };
  }
}
function classify(z, status, buf) {
  if (status !== 200) return { cls: status >= 500 ? "500" : status > 0 ? String(status) : "ERR" };
  let png;
  try { png = PNG.sync.read(buf); } catch (e) { return { cls: "BADPNG" }; }
  const d = png.data;
  let black = 0, total = png.width * png.height;
  const colors = new Map();
  for (let i = 0; i < total; i++) {
    const q = 4 * i;
    const r = d[q], g = d[q + 1], b = d[q + 2];
    if (r === 0 && g === 0 && b === 0) black++;
    const key = (r << 16) | (g << 8) | b;
    colors.set(key, (colors.get(key) ?? 0) + 1);
  }
  const blackFrac = black / total;
  const cls = blackFrac >= 0.95 ? "OPAQUE-BLACK" : blackFrac >= 0.05 ? "MIXED" : "COLORED";
  const top = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, n]) => `#${k.toString(16).padStart(6, "0")}:${(100 * n / total).toFixed(1)}%`);
  return { cls, blackFrac: +blackFrac.toFixed(4), distinct: colors.size, top };
}

// ---- server lifecycle ----------------------------------------------------
const child = spawn(process.execPath, [serverPath], {
  cwd,
  env: { ...process.env, GENMAP_PORT: String(port), ...Object.fromEntries(envFlags.map((kv) => kv.split("="))) },
  stdio: ["ignore", "pipe", "pipe"],
});
const logs = [];
child.stdout.on("data", (d) => logs.push(String(d)));
child.stderr.on("data", (d) => logs.push(String(d)));
const kill = () => { try { child.kill("SIGTERM"); } catch { /* gone */ } };
process.on("exit", kill);

async function waitReady(timeoutMs = 900000) {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < timeoutMs) {
    if (child.exitCode != null) return { ready: false, why: `server exited ${child.exitCode}: ${logs.slice(-4).join("")}` };
    const s = await get(`${base}/gen/status/${seed}`);
    if (s.status === 200) {
      const j = JSON.parse(Buffer.from(s.buf).toString());
      last = `${j.done}/${j.total} errors=${(j.errors ?? []).length}`;
      if (j.ready) return { ready: true, errors: (j.errors ?? []).length, log: logs.join("") };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ready: false, why: `timeout: ${last}` };
}

// ---- main ----------------------------------------------------------------
const rd = await waitReady();
if (!rd.ready) {
  console.log(`[${label}] SERVER NOT READY: ${rd.why}`);
  kill();
  process.exit(1);
}
const rows = [];
for (const c of cells) {
  const z0 = await get(`${base}/gen/tile/${seed}/0/${c.tx}/${c.ty}.png`);
  const c0 = classify(0, z0.status, z0.buf);
  const z1 = await get(`${base}/gen/tile/${seed}/1/${Math.floor(c.tx / 2)}/${Math.floor(c.ty / 2)}.png`);
  const c1 = classify(1, z1.status, z1.buf);
  rows.push({ ...c, z0: c0, z1: c1, bytes: z0.buf.length });
  const f = (x) => `${x.cls}${x.blackFrac !== undefined ? ` blk=${(x.blackFrac * 100).toFixed(1)}%` : ""}`;
  console.log(`[${label}] ${c.kind.padEnd(7)} ${c.def.padEnd(18)} (${c.tx},${c.ty}) z0=${f(c0)}  z1=${f(c1)}${c0.top ? "  top=" + c0.top.slice(0, 3).join(" ") : ""}`);
}
// rollup: E1 presence counts per class (filler cells only)
const filler = rows.filter((r) => r.kind !== "control");
const tally = {};
for (const r of filler) tally[r.z0.cls] = (tally[r.z0.cls] ?? 0) + 1;
console.log(`[${label}] E1 TALLY (filler z0, n=${filler.length}): ${JSON.stringify(tally)}`);
for (const r of rows.filter((r) => r.kind === "control"))
  console.log(`[${label}] CONTROL ${r.def} (${r.tx},${r.ty}) z0=${r.z0.cls}${r.z0.blackFrac !== undefined ? " blk=" + (r.z0.blackFrac * 100).toFixed(1) + "%" : ""}`);
const out = path.join(REPO, "mapgen/out", `noodle-audit-${label}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ label, port, seed, envFlags, serverPath, cwd, rows, serverLogTail: logs.slice(-30) }, null, 2));
console.log(`[${label}] wrote ${out}`);
kill();
process.exit(0);
