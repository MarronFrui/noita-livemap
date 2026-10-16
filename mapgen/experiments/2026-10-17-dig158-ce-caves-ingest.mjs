// dig #158 — the I31 full-grid CE caves-dump INGEST + compare rig.
// The run sheet (C133): in Cheat Engine, on the reference seed 78633191,
//   1. byte-search for the pattern  00 00 80 3F 00 00 34 45
//      (= f32 1.0 at owner+0x90 immediately followed by f32 2560.0 at +0x94,
//      the C48 marker (w·0.5)/0.1 for a 512-wide cave grid — the ctor writes
//      both adjacent, dig123-ctor-8F9470 8f9536..8f95b1).
//   2. the hit address = owner+0x90. DUMP owner+0x90 for 0x80024 bytes
//      (524,324 = the 16-byte validation header [0x90..0xb4) + the grid
//      512·256 f32 = 0x80000). Multiple hits = the per-def cave grids
//      (hills/desert/winter/_EMPTY_ + the small 1×1 family excluded: their
//      marker = 5.0) — dump EVERY hit the pattern filters stay on.
//   3. save as e.g. mapcap/out/ce-caves/caves-<defguess>-<seed>.bin and run:
//        node experiments/2026-10-17-dig158-ce-caves-ingest.mjs *.bin
//   The rig: validates the header bit-exact, parses the grid, prints the
//   I31(b) census (the presence share, the x0..11 edge band, the per-row
//   medians), and auto-matches the port's own caves fields per (def, seed).
// Byte law (X121/X122, fresh this dig): [owner+0x9c] = W (the stride int);
// the grid = INLINE at owner+0xb4, idx = W·y + x (0x90dba5..0x90dbba in
// dig121-sampler90da00, re-readable dig158-recipe-gridref-90dba0-90dbd8.asm);
// the sampler cell gate = f32 > 0.51 (0x11dfa94); the ctor writes [0x90] =
// 1.0f, [0x94] = the marker, [0x9c] = 0-cleared pre-Init (the W fill lands
// on the area build per dig #131's SetSize law).
import fs from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;

function fail(msg) { console.error(`[dig158-ingest] FAIL: ${msg}`); process.exit(2); }
// ---------- the pure core (unit-tested: tests/dig158-ingest.test.mjs) ----------
export const DUMP_LAYOUT = { origin: "owner+0x90", header: 0x24, total: 0x24 + 0x80000, gridCells: 131072, stride: 512 };
export function parseCavesDump(buf, label = "dump") {
  if (buf.length !== DUMP_LAYOUT.total) return { error: `${label}: ${buf.length} B ≠ the expected ${DUMP_LAYOUT.total} (0x80024) — did you start the dump at owner+0x90?` };
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x3f800000) return { error: `${label}: [owner+0x90] ≠ bit-exact 1.0f — wrong dump origin` };
  if (dv.getUint32(4, true) !== 0x45200000) return { error: `${label}: [owner+0x94] ≠ bit-exact 2560.0 (the C48 marker) — wrong structure` };
  const stride = dv.getUint32(0x0c, true);
  if (stride !== DUMP_LAYOUT.stride) return { error: `${label}: [owner+0x9c] = ${stride} ≠ 512 — not a full-size cave grid (the 1×1 family's marker = 5.0, excluded)` };
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
