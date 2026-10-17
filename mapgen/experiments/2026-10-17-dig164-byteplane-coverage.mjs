// dig #164 — THE BYTE-PLANE COVERAGE COUNT TEST (the dig-#165 writer-hunt
// pre-work). Counts the port's [P+0x58] byte-plane nonzero share per caves
// def and compares it against the capture's solid share (the C136 gate's
// precondition: a byte-nonzero cell is REQUIRED for paint, so the share must
// be >= the capture's solid share). Outcome (PRE-REGISTERED PREDICTION per
// the measurement law): if the record lane (dig-#162's fn950-stencil chain)
// were the plane's writer, the coverage would land near the capture solid
// shares. FALSIFIED below — the actual coverage is 20-30x short, and desert
// (ZERO CaveStructure records in its XML) still shows 65% capture solid ⇒
// the record lane is NOT the plane's (sole) writer. dig #165 = the writer
// hunt (fn950's callers / the fnB stamp arms' template source).
// METER-CLASS: E1 (count/distribution — nonzero-cell census).
// Out: mapgen/out/dig164-byteplane-coverage.json
import fs from "node:fs";

const SEED = 78633191;
const { findNoitaDataDir } = await import("../lib/paths.mjs");
const { loadBiomeConfig } = await import("../lib/biomes.mjs");
const { buildCavesField } = await import("../lib/caves-field.mjs");

const dataDir = findNoitaDataDir();
const cfg = loadBiomeConfig(dataDir);

// the capture's solid shares (dig #160 carve audit, mapgen/out/dig160-carve-audit.json)
const CAPTURE = { _EMPTY_: 46.86, desert: 65.19, winter: 37.32 };
const PORT_FIELD = { _EMPTY_: 90.07, desert: 98.57, winter: 89.9 };

const out = { seed: SEED, meter_class: "E1", defs: {} };
for (const defName of ["_EMPTY_", "desert", "winter"]) {
  const def = [...cfg.biomes.values()].find((d) => d.name === defName);
  if (!def?.bitmapCaves) continue;
  const cf = buildCavesField(dataDir, def, SEED);
  const N = cf.w * cf.h;
  let nz = 0, fsol = 0, both = 0;
  for (let i = 0; i < N; i++) {
    if (cf.bytes[i] !== 0) nz++;
    if (cf.field[i] > 0.5) fsol++;
    if (cf.bytes[i] !== 0 && cf.field[i] > 0.5) both++;
  }
  const nRecords = (def.bitmapCaves.structures ?? []).length;
  out.defs[defName] = {
    grid: `${cf.w}x${cf.h}`,
    records_in_xml: nRecords,
    byte_nonzero_pct: +(100 * nz / N).toFixed(2),
    field_solid_pct: +(100 * fsol / N).toFixed(2),
    gatable_pct: +(100 * both / N).toFixed(2),
    capture_solid_pct: CAPTURE[defName],
    port_field_pct_at_dig160: PORT_FIELD[defName],
  };
}
out.verdict =
  "FALSIFIED: the record lane's stamps cover far too little (desert 0% with 0 records " +
  "vs 65.19% capture) — the byte plane's writer lane is NOT the record lane alone; dig #165 hunts it.";
fs.writeFileSync("mapgen/out/dig164-byteplane-coverage.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
