// dig #156 — I36's registered fix under count tests. The gate's decision core
// (scripts/precommit-gates-lib.mjs) is THE count-tested subject:
//   (1) each law pin FAILS under the pre-fix law (the exit-code-only gate):
//       the truncated 205-test class, the pre-summary abort class, the skip
//       drift, the stall class — all now REFUSE/RETRY where the old gate
//       would have let an exit-0 truncated run pass;
//   (2) the baseline file itself is pinned (the count law's reference).
// These tests are data-INDEPENDENT (pure strings + the tracked JSON) — they
// run everywhere, always RUN (never skip).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parseVitestSummary, parseVitestFiles, decideBattery, STALL_RE } from "../scripts/precommit-gates-lib.mjs";

const BASE = JSON.parse(fs.readFileSync(new URL("../scripts/precommit-baseline.json", import.meta.url), "utf8"));

// the REAL 2026-10-17 tail shapes (the dig-#155 run + the (148)-era truncated one)
// the healthy tail = CONSTRUCTED from the tracked baseline (the decider's
// ok-path must accept the file's own counts; a literal snapshot would rust)
const TAIL_OK = [
  " ✓ tests/mapgen/coords.test.mjs (4 tests) 2ms",
  "",
  ` Test Files  ${BASE.filesTotal - 1} passed | 1 skipped (${BASE.filesTotal})`,
  `      Tests  ${BASE.testsTotal - BASE.testsSkipped} passed | ${BASE.testsSkipped} skipped (${BASE.testsTotal})`,
  "   Start at  00:31:26",
  "   Duration  269.81s (transform 218ms, setup 0ms, collect 2.90s, tests 266.15s, environment 0ms, prepare 81ms)",
  "",
].join("\n");

const TAIL_TRUNCATED = [ // the I36 class: the run aborted before reaching the end
  " ✓ tests/mapgen/prng.test.mjs (14 tests) 40ms",
  " STDERR: Timeout calling \"onTaskUpdate\": a vitest worker RPC stall (the I36/(146) journal class)",
  "",
  "── 9 of 22 test files (205 tests)…",
].join("\n");

const TAIL_PARTIAL_SUMMARY = [ // a partial run that DID reach a (wrong) summary
  " Test Files  9 passed (22)",
  "      Tests  205 passed (205)",
].join("\n");

const TAIL_SKIP_DRIFT = [ // counts RUN, not skip — a hard-skip inflates M
  " Test Files  20 passed | 3 skipped (23)",
  "      Tests  297 passed | 44 skipped (341)",
].join("\n");

const TAIL_FAIL = [
  " Test Files  21 passed | 1 failed (22)",
  "      Tests  337 passed | 1 failed | 3 skipped (341)",
].join("\n");

describe("dig #156 — the battery gate decision core (I36 forms (a)+(b)", () => {
  it("parse: the healthy tail → the baseline's pass/skip/total (files −1, pass+skip)", () => {
    const s = parseVitestSummary(TAIL_OK);
    expect(s).toEqual({
      passed: BASE.testsTotal - BASE.testsSkipped,
      failed: 0,
      skipped: BASE.testsSkipped,
      todo: 0,
      total: BASE.testsTotal,
    });
    const f = parseVitestFiles(TAIL_OK);
    expect(f).toEqual({
      passed: BASE.filesTotal - 1,
      failed: 0,
      skipped: 1,
      total: BASE.filesTotal,
    });
  });

  it("parse: the failed-run shape `337 passed | 1 failed | 3 skipped (341)` parses (the fail field refuses, the total still matches)", () => {
    const s = parseVitestSummary(TAIL_FAIL);
    expect(s.failed).toBe(1);
    expect(s.total).toBe(341);
  });

  it("LAW (a): the I36 truncated run (9 files / 205 tests via the partial summary) = REFUSE, exit 0 and no stall needed — FAILS under the old exit-code-only gate", () => {
    const run = { exitCode: 0, output: TAIL_PARTIAL_SUMMARY };
    const d = decideBattery(run, BASE, { retries: 0 });
    expect(d.verdict).toBe("refuse");
    expect(d.reason).toContain(`Tests total 205 ≠ the baseline ${BASE.testsTotal}`);
    expect(d.reason).toContain("≠ the baseline"); // the count law's shape itself
  });

  it("LAW (a): the pre-summary abort (no Tests line at all) = REFUSE", () => {
    const run = { exitCode: 0, output: " ✓ tests/mapgen/prng.test.mjs (14 tests) 40ms\n ⎯⎯ killed mid-run ⎯⎯\n" };
    const d = decideBattery(run, BASE, { retries: 0 });
    expect(d.verdict).toBe("refuse");
    expect(d.reason).toContain("no Tests summary line");
  });

  it("LAW (a): the skip drift (44 skipped vs 3) = REFUSE — the counts-RUN bar, machine-checked", () => {
    const d = decideBattery({ exitCode: 0, output: TAIL_SKIP_DRIFT }, BASE, { retries: 0 });
    expect(d.verdict).toBe("refuse");
    expect(d.reason).toContain("Tests skipped 44 ≠ the baseline 3");
  });

  it("LAW (a): a genuinely failed test (337/1/3/341, exit 1) = REFUSE (never retried past the stall law silently)", () => {
    const d = decideBattery({ exitCode: 1, output: TAIL_FAIL }, BASE, { retries: 0 });
    expect(d.verdict).toBe("refuse");
    expect(d.reason).toContain("1 test(s) failed");
  });

  it("LAW (b): the real truncated tail with the watchdog stall = RETRY once (the (146)-mitigation, first exercised); retry-exhausted = REFUSE with the journal context", () => {
    expect(STALL_RE.test(TAIL_TRUNCATED)).toBe(true);
    const first = decideBattery({ exitCode: 0, output: TAIL_TRUNCATED }, BASE, { retries: 0 });
    expect(first.verdict).toBe("retry");
    const second = decideBattery({ exitCode: 0, output: TAIL_TRUNCATED }, BASE, { retries: 1 });
    expect(second.verdict).toBe("refuse");
    expect(second.reason).toContain("stall class persisted past the retry");
  });

  it("LAW: the healthy tail = OK both fresh and after a satisfied retry", () => {
    expect(decideBattery({ exitCode: 0, output: TAIL_OK }, BASE, { retries: 0 }).verdict).toBe("ok");
    expect(decideBattery({ exitCode: 0, output: TAIL_OK }, BASE, { retries: 1 }).verdict).toBe("ok");
  });

  it("the tracked baseline is present, parseable, and pin-shaped (no reference = no law)", () => {
    expect(BASE.testsTotal).toBeTypeOf("number");
    expect(BASE.testsTotal).toBeGreaterThan(330); // the (155)-era 341 floor
    expect(BASE.testsSkipped).toBe(3);
    expect(BASE.filesTotal).toBeGreaterThan(23);
    expect(typeof BASE.source).toBe("string");
  });
});
