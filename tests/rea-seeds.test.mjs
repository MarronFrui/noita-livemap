// The REA Ghidra seed file (mapgen/re/noita_dev.seeds.tsv) — the names Ghidra
// applies when REA opens noita_dev.exe. (1) data-free: the file parses under
// rea-agents' own seed rules (a bad line makes open_binary fail) and the
// parser rejects each malformed shape; (2) exe-gated: every function seed is a
// real function start in the pinned build (a mid-function seed would make
// Ghidra carve a bogus function and mislabel every decompile through it).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  SEED_FILE, TARGET, PINNED_SHA256, sourceExe, sha256,
  parseSeeds, peSections, functionStartVerdict,
} from "../scripts/rea-lib.mjs";

const seeds = parseSeeds(fs.readFileSync(SEED_FILE, "utf8"));

function pinnedExe() {
  for (const p of [TARGET, sourceExe()]) {
    if (!fs.existsSync(p)) continue;
    const buf = fs.readFileSync(p);
    if (sha256(buf) === PINNED_SHA256) return buf;
  }
  return null;
}
const exe = pinnedExe();

describe("REA seed file — format (data-free)", () => {
  it("parses with no errors and carries named function seeds", () => {
    expect(seeds.errors).toEqual([]);
    expect(seeds.entries.length).toBeGreaterThan(50);
    for (const e of seeds.entries) {
      expect(e.kind).toBe("function");
      expect(e.name).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
    }
  });

  it("the parser rejects every malformed shape REA rejects", () => {
    const bad = [
      "8ed490\tfunction\tX",          // no 0x prefix
      "0x8ed490\tfunc\tX",            // unknown kind
      "0x8ed490\tlabel",              // label without a name
      "0x8ed490\tcode\tX",            // code with a name
      "0x8ed490\tfunction\ta b",      // whitespace in the name
      "0x8ed490 function X",          // spaces instead of tabs
      "0x1\tfunction\tA\n0x1\tfunction\tB", // duplicate address
      "0x1\tfunction\tA\n0x2\tfunction\tA", // duplicate name (project rule)
    ];
    for (const text of bad) expect(parseSeeds(text).errors.length, text).toBeGreaterThan(0);
    expect(parseSeeds("# comment\n\n0x401000\tfunction\tOk\n").errors).toEqual([]);
  });
});

describe.skipIf(!exe)("REA seed file — function starts in the pinned exe", () => {
  it("every function seed lands on a function start inside .text", () => {
    const pe = peSections(exe);
    const bad = seeds.entries
      .map((e) => ({ e, v: functionStartVerdict(exe, pe, e.va) }))
      .filter(({ v }) => !v.ok)
      .map(({ e, v }) => `0x${e.va.toString(16)} ${e.name}: ${v.why}`);
    expect(bad).toEqual([]);
  });

  it("the check rejects a known mid-function address (0x90e220, inside the plz loader)", () => {
    expect(functionStartVerdict(exe, peSections(exe), 0x90e220).ok).toBe(false);
  });
});
