// dig #159 (v2) count tests — the CE caves-dump ingest's pure core
// (mapgen/experiments/2026-10-17-dig158-ce-caves-ingest.mjs parseCavesDump),
// the corrected layout (the dig-#158 v1 pattern = the wrong-struct
// conflation, struck: the dump origin = the CE hit P+0x94 itself).
import { describe, it, expect } from "vitest";
import { parseCavesDump, DUMP_LAYOUT } from "../mapgen/experiments/2026-10-17-dig158-ce-caves-ingest.mjs";

function makeDump({ marker = 2560.0, stride = 512, cells }) {
  const H = Buffer.alloc(0x20);
  H.writeUInt32LE(marker === 2560.0 ? 0x45200000 : new DataView(new Float32Array([marker]).buffer).getUint32(0, true), 0);
  // [0x04..0x08) = the [P+0x98] slot, don't care
  H.writeUInt32LE(stride, 8); // [P+0x9c] = W
  const g = Buffer.alloc(0x80000);
  cells?.(g);
  return Buffer.concat([H, g]);
}

describe("dig #159 — the caves-dump ingest core (the C133 v2 run sheet laws)", () => {
  it("LAYOUT: the 8-byte validation window + 0x80000 grid = 524,320 B; the stride pin = 512", () => {
    expect(DUMP_LAYOUT.total).toBe(524320);
    expect(DUMP_LAYOUT.header).toBe(0x20);
    expect(DUMP_LAYOUT.gridCells).toBe(131072);
  });

  it("a well-formed dump parses: the bit-exact header passes, the census computes", () => {
    const d = makeDump({ cells: (b) => {
      b.writeFloatLE(0.9, 4 * 0); b.writeFloatLE(0.9, 4 * 1); b.writeFloatLE(0.8, 4 * 512); // the x<12 band, rows 0..2
    } });
    const r = parseCavesDump(d);
    expect(r).not.toHaveProperty("error");
    expect(r.stride).toBe(512);
    expect(r.solidShare).toBe(+(3 / 131072).toFixed(5)); // the rig's own 5-digit shape
    expect(r.edgeCarveSum).toBe(3);
    expect(r.edgeCarveRowsCarved).toBe(2);
  });

  it("LAW: the C48 marker check = bit-exact 2560.0 — a wrong-structure dump refused", () => {
    const r = parseCavesDump(makeDump({ marker: 3712.0 }));
    expect(r.error).toContain("≠ bit-exact 2560.0");
  });

  it("LAW: the size check — a grid-only dump (0x80000) refused with the CE-hit hint", () => {
    const r = parseCavesDump(Buffer.alloc(0x80000));
    expect(r.error).toContain("524320");
    expect(r.error).toContain("P+0x94");
  });

  it("LAW: the 1×1-grid family excluded via the stride pin (its 512-wideness = no; the marker = 5.0 also self-censors the scan)", () => {
    const r = parseCavesDump(makeDump({ stride: 1 }));
    expect(r.error).toContain("[P+0x9c] = 1 ≠ 512");
  });
});
