// dig #159 (v2 of dig #158) — the I31 full-grid CE caves-dump INGEST.
// THE CORRECTED LAYOUT (C133 v2; the dig-#158 v1's wrong-struct pattern fixed):
// the dump starts AT the CE pattern hit = P+0x94 (the C48's marker f32
// 2560.0, the X122 strike note = the record-template ±100000 affine slot
// conflated), size 0x80020:
//   [0x00..0x04) = f32 2560.0  (bit-exact 0x45200000)
//   [0x04..0x08) = the [P+0x98] slot (don't care)
//   [0x08..0x0C) = the stride int W = 512 (the dig-#121 sampler law)
//   [0x20..)     = the caves grid 512×256 f32 LE (INLINE at owner+0xb4,
//                  idx = W·y + x; the sampler cell gate = f32 > 0.51
//                  @0x11dfa94).
// The run sheet (C133) + the dump script (the CE Lua
// mapgen/experiments/2026-10-17-dig158-ce-caves-dump.lua) produce these
// files; this rig validates + prints the I31(b) census per file.
import fs from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;

function fail(msg) { console.error(`[dig158-ingest] FAIL: ${msg}`); process.exit(2); }
// ---------- the pure core (unit-tested: tests/dig158-ingest.test.mjs) ----------
export const DUMP_LAYOUT = { origin: "P+0x94 (the CE hit)", header: 0x20, total: 0x20 + 0x80000, gridCells: 131072, stride: 512 };
export function parseCavesDump(buf, label = "dump") {
  if (buf.length !== DUMP_LAYOUT.total) return { error: `${label}: ${buf.length} B ≠ the expected ${DUMP_LAYOUT.total} (0x80020) — did you start the dump at the CE hit (P+0x94)?` };
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x45200000) return { error: `${label}: [P+0x94] ≠ bit-exact 2560.0 (the C48 marker) — wrong structure` };
  const stride = dv.getUint32(8, true);
  if (stride !== DUMP_LAYOUT.stride) return { error: `${label}: [P+0x9c] = ${stride} ≠ 512 — not a full-size cave grid (the 1×1 family's marker = 5.0, excluded)` };
  const grid = new Float32Array(DUMP_LAYOUT.gridCells);
  for (let i = 0; i < grid.length; i++) grid[i] = dv.getFloat32(DUMP_LAYOUT.header + 4 * i, true);
  let solid = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > 0.5) solid++;
  const edgeCarve = []; // the x<12 edge band, per row (the (127) 49/84 + 9-over-256 law's full-grid form)
  for (let y = 0; y < 256; y++) {
    let n = 0;
    for (let x = 0; x < 12; x++) if (grid[y * 512 + x] > 0.5) n++;
    edgeCarve.push(n);
  }
  const rowCarve = new Array(256).fill(0);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) if (grid[y * 512 + x] > 0.5) rowCarve[y]++;
  return {
    label,
    bytes: buf.length,
    stride,
    solidShare: +(solid / grid.length).toFixed(5),
    cells: grid.length,
    edgeCarveSum: edgeCarve.reduce((a, b) => a + b, 0),
    edgeCarveRowsCarved: edgeCarve.filter((n) => n > 0).length,
    rowCarve,
  };
}
// ------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) { // the run-directly gate
  const out = { rig: "2026-10-17-dig158", files: [] };
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (args.length === 0) fail("no .bin given — see the run sheet header of this script");
  for (const path of args) {
    const parsed = parseCavesDump(fs.readFileSync(path), path);
    if (parsed.error) fail(parsed.error);
    out.files.push(parsed);
  }
  // the port comparison — the dig #159's substance; here we only WIRE and
  // summarize (fail-loud when the port lane cannot resolve yet).
  const havePort = fs.existsSync(`${REPO}/lib/caves-field.mjs`);
  out.portLane = havePort
    ? "present — run the dig #159 compare with this ingest's JSON as its input"
    : "MISSING";
  fs.writeFileSync("mapgen/out/dig158-ce-ingest.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
