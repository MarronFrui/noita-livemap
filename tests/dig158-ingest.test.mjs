// dig #158 count tests — the CE caves-dump ingest's pure core
// (mapgen/experiments/2026-10-17-dig158-ce-caves-ingest.mjs parseCavesDump).
// Every law pin FAILS under (i) no core at all (pre-dig) or (ii) the raw
// CLI-only rig; the pins assert the specific refusal reason strings + the
// self-verifying header bit-laws (X121/X122 fresh; C133's run sheet).
import { describe, it, expect } from "vitest";
import { parseCavesDump, DUMP_LAYOUT } from "../mapgen/experiments/2026-10-17-dig158-ce-caves-ingest.mjs";

function makeDump({ origin = "0x90", marker = 2560.0, stride = 512, cells }) {
  const H = Buffer.alloc(0x24);
  if (origin === "0x90") H.writeUInt32LE(0x3f800000, 0); // 1.0f at +0x90
  H.writeFloatLE(marker, 4); // 0x45200000 bit-exact for 2560.0
  H.writeUInt32LE(stride, 0x0c); // the W stride (0x11DDB7… [0x9c−0x90])
  const g = Buffer.alloc(0x80000);
  const f32 = cells ?? (() => {
    const arr = Buffer.alloc(0x80000);
    arr.writeFloatLE(0.9, 0); arr.writeFloatLE(0.6, 4); arr.writeFloatLE(0.2, 8);
    return arr;
  })();
  return Buffer.concat([H, f32]);
}

describe("dig #158 — the caves-dump ingest core (the C133 run sheet laws)", () => {
  it("LAYOUT: 0x24 header + 0x80000 grid = 524,324 B total; the stride pin = 512", () => {
    expect(DUMP_LAYOUT.total).toBe(524324);
    expect(DUMP_LAYOUT.header).toBe(0x24);
    expect(DUMP_LAYOUT.gridCells).toBe(131072);
  });

  it("a well-formed dump parses: the bit-exact header passes, the census computes", () => {
    const d = makeDump({
      cells: (() => {
        const b = Buffer.alloc(0x80000);
        // 3 solid cells in the x<12 edge band, rows 0..2 (the I31(b) census law)
        b.writeFloatLE(0.9, 4 * 0); b.writeFloatLE(0.9, 4 * 1); b.writeFloatLE(0.8, 4 * 512);
        return b;
      })(),
    });
    const r = parseCavesDump(d);
    expect(r).not.toHaveProperty("error");
    expect(r.stride).toBe(512);
    expect(r.solidShare).toBe(+(3 / 131072).toFixed(5)); // the rig's own 5-digit shape
    expect(r.edgeCarveSum).toBe(3);
    expect(r.edgeCarveRowsCarved).toBe(2);
  });

  it("LAW: a dump that started at the grid base (not owner+0x90) = refused — the bit-exact 1.0f at +0x00 is the origin proof", () => {
    const bad = makeDump({ origin: "grid-base" });
    const r = parseCavesDump(bad);
    expect(r.error).toContain("≠ bit-exact 1.0f");
  });

  it("LAW: the C48 marker check = bit-exact 2560.0 (a sloppily-typed 2560.0 ≈ variant does NOT ride the same bytes — the refusal is on the structure)", () => {
    const bad = makeDump({ marker: 2500.0 });
    const r = parseCavesDump(bad);
    expect(r.error).toContain("≠ bit-exact 2560.0");
  });

  it("LAW: the size check — a grid-only dump (0x80000) refused with the owner+0x90 hint", () => {
    const r = parseCavesDump(Buffer.alloc(0x80000));
    expect(r.error).toContain("524324");
    expect(r.error).toContain("owner+0x90");
  });

  it("LAW: the 1×1-grid family excluded — the marker doubles the filter (a 5.0-marker grid fails the bit-exact 2560.0 check BEFORE the stride pin fires)", () => {
    const bad = makeDump({ marker: 5.0, stride: 1 });
    const r = parseCavesDump(bad);
    expect(r.error).toContain("≠ bit-exact 2560.0");
  });
});
