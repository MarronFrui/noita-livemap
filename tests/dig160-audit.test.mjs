// dig #160 smoke test — the carve-audit instrument's import safety (the
// run-directly gate keeps the audit off the import path) + the law's
// structural pins that the audit's numbers depend on.
import { describe, it, expect } from "vitest";

describe("dig #160 — the carve-audit instrument", () => {
  it("imports without executing the audit (the run-directly gate)", async () => {
    const mod = await import("../mapgen/experiments/2026-10-17-dig160-carve-audit.mjs");
    expect(mod).toBeTypeOf("object");
  });

  it("the audit's committed artifact exists and carries the per-def verdict keys", async () => {
    const fs = await import("node:fs");
    const p = "mapgen/out/dig160-carve-audit.json";
    expect(fs.existsSync(p)).toBe(true);
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(j.perDef._EMPTY_).toBeTruthy();
    expect(j.perDef.desert).toBeTruthy();
    expect(j.perDef.winter).toBeTruthy();
    // the capture's solid shares (the count-law reference for the #161 port)
    expect(j.perDef._EMPTY_.capMean).toBeGreaterThan(30);
    expect(j.perDef.winter.capMean).toBeLessThan(50);
  });
});
