// canon-audit const-verifier contracts (I29 Stage 1, dig #124) — PE-backed
// spot checks: the verifier's VA→file mapping and const reads must agree
// with hand-checked examples from the open registries. Data-dependent:
// auto-skips without noita_dev.exe at the standard path.
import { describe, test, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  locateVa, readConst, exeVerified, C13,
} from "../../mapgen/experiments/2026-10-12-const-verifier.mjs";

const exe = "/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe";
const hasExe = existsSync(exe);

describe.skipIf(!hasExe)("const-verifier — the PE-backed spot checks (I29:124)", () => {
  test("exe md5 = C13 (the verified build)", () => {
    expect(exeVerified).toBe(true);
    expect(C13).toBe("8b611494212a69492dd0a4527d9c92e0");
  });

  test("the .rdata delta is the C57 flat mapping (VA−0x400E00)", () => {
    const L = locateVa(0x1199d40);
    expect(L.name).toBe(".rdata");
    expect(L.off).toBe(0x1199d40 - 0x400E00); // C57's rule reproduced
  });

  test("the .data delta is NOT the C57 rule — independent section mapping", () => {
    const L = locateVa(0x12eb000); // .data base
    expect(L.name).toBe(".data");
    expect(L.off).not.toBe(0x12eb000 - 0x400E00); // the flat rule must NOT apply here
  });

  test(".rdata f32 pins read back (C98/C101 spot pair)", () => {
    expect(readConst(0x11df9b4, 32)).toBeCloseTo(0.2, 7); // C101(a) coef 0.2
    expect(readConst(0x11e01e0, 32)).toBeCloseTo(25.0, 7); // the y/25 divisor
  });

  test(".rdata f64 pins read back (C98's f64 trio)", () => {
    expect(readConst(0x11dff38, 64)).toBeCloseTo(11.0, 12);
    expect(readConst(0x11dffd8, 64)).toBeCloseTo(81.0, 12);
  });

  test("the sign-sensitive twins are NEGATIVE in-file (the C81/C82 eyes-check)", () => {
    // the machine sweep initially flagged these; the bytes say −3 / −5 / −1
    // and the registry rows SAY the negatives — canon correct, parser naive
    expect(readConst(0x11e05f8, 64)).toBe(-3);
    expect(readConst(0x11e0610, 64)).toBe(-5);
    expect(readConst(0x11e05a8, 32)).toBe(-1);
  });

  test("BSS beyond .data RawSize = runtime-only (a cite class, not a const)", () => {
    const L = locateVa(0x1327670); // C47's CE-poked canvas offset
    expect(L.name).toBe(".data");
    expect(L.inRaw).toBe(false);
  });
});
