// scripts/precommit-gates-lib.mjs — the PURE decision core of the precommit
// battery gate (dig #156, I36's registered fix forms (a)+(b); extracted so
// vitest can test the gate without importing the gate CLI's side effects).
//
// I36 (opened dig #148): the full battery truncated silently under the
// surface-compositor IPC watchdog — two of three 2026-10-16 runs reported
// only 9/22 files / 205 tests — and the gate read only the exit code, so the
// two truncated runs' outcomes were UNMEASURED (I36). The fix = capture the
// output, parse vitest's own summary totals, and refuse any run whose total
// ≠ the tracked baseline (form (a) — count law, independent of the exit
// code), with ONE retry whose trigger = the observed watchdog stall class
// (form (b) — `Timeout calling "onTaskUpdate"`); a retried run must then hit
// the baseline or the gate refuses (never masks, never lowers the bar).
// Form (c) (splitting the heavy files) NOT taken: the parser removes the
// truncation risk without doubling battery latency. The charter bar holds:
// counts RUN, not skip — the baseline ALSO pins the skipped count.

// The watchdog stall class seen at the (146)/I36 journal (the vitest worker
// RPC timeout): lines like `Error: Timeout calling "onTaskUpdate" (2 × 5006ms)`.
export const STALL_RE = /Timeout calling "(?:onTaskUpdate|onCountTaskStart|onUserLog)"/;

// parseVitestSummary — the `Tests N passed | M skipped (T)` tail line
// (vitest 2/3 summary, indented): fields in any order, one trailing `(total)`.
// Returns null when no Tests line is found (= truncated BEFORE the summary
// = the pre-summary abort class; the caller treats null as refuse-too).
// total falls back to the fields' sum when the trailer is absent.
export function parseVitestSummary(output) {
  const line = (/^[ \t]*Tests\s+(.*)$/m.exec(output ?? "") ?? [])[1];
  if (line === undefined) return null;
  const fields = {};
  for (const f of line.matchAll(/(\d+) (passed|failed|skipped|todo)/g)) fields[f[2]] = Number(f[1]);
  const pt = /\((\d+)\)\s*$/.exec(line);
  const total = pt ? Number(pt[1]) : (Object.values(fields).reduce((a, b) => a + b, 0) || null);
  return {
    passed: fields.passed ?? null,
    failed: fields.failed ?? 0,
    skipped: fields.skipped ?? 0,
    todo: fields.todo ?? 0,
    total,
  };
}

// parseVitestFiles — the `Test Files  A passed | B skipped (T)` line, same shape.
export function parseVitestFiles(output) {
  const line = (/^[ \t]*Test Files\s+(.*)$/m.exec(output ?? "") ?? [])[1];
  if (line === undefined) return null;
  const fields = {};
  for (const f of line.matchAll(/(\d+) (passed|failed|skipped|todo)/g)) fields[f[2]] = Number(f[1]);
  const pt = /\((\d+)\)\s*$/.exec(line);
  const total = pt ? Number(pt[1]) : (Object.values(fields).reduce((a, b) => a + b, 0) || null);
  return { passed: fields.passed ?? null, failed: fields.failed ?? 0, skipped: fields.skipped ?? 0, total };
}

// decideBattery — the gate's pure verdict. inputs: run = { exitCode, output,
// summary|null; files|null }, baseline = the tracked JSON
// { testsTotal, testsSkipped, filesTotal }, retries = how many retries were
// spent so far (0 or 1). Verdicts: "ok" | "retry" | "refuse".
export function decideBattery(run, baseline, { retries = 0 } = {}) {
  const b = baseline ?? {};
  if (!Number.isInteger(b.testsTotal) || b.testsTotal < 1) {
    return { verdict: "refuse", reason: "the battery baseline is missing/unreadable (scripts/precommit-baseline.json) — the count law has no reference" };
  }
  const stalled = (run.output ?? "").match(STALL_RE) != null;
  const summary = run.summary ?? parseVitestSummary(run.output);
  const files = run.files ?? parseVitestFiles(run.output);
  const nonZeroExit = run.exitCode !== 0;

  const mismatch = [];
  if (summary === null) mismatch.push("no Tests summary line in the battery output (truncated or abort-before-summary)");
  else {
    if (summary.total !== b.testsTotal) {
      mismatch.push(`Tests total ${summary.total} ≠ the baseline ${b.testsTotal} (the I36 truncation class: a partial run is REFUSED regardless of the exit code)`);
    }
    if (summary.failed !== 0) mismatch.push(`${summary.failed} test(s) failed`);
    if (Number.isInteger(b.testsSkipped) && summary.skipped !== b.testsSkipped) {
      mismatch.push(`Tests skipped ${summary.skipped} ≠ the baseline ${b.testsSkipped} (skips are never a green mask)`);
    } else if (!Number.isInteger(b.testsSkipped)) {
      mismatch.push(`the baseline pins no testsSkipped field — pin it (the count law is TOTAL + SKIPPED)`);
    }
  }
  if (files) {
    if (files.total !== b.filesTotal) mismatch.push(`test files total ${files.total} ≠ the baseline ${b.filesTotal}`);
  }
  if (nonZeroExit) mismatch.push(`battery exit code ${run.exitCode} ≠ 0`);

  if (mismatch.length === 0) {
    return { verdict: "ok", reason: `totals match the baseline (${b.filesTotal} files / ${b.testsTotal} tests, ${b.testsSkipped} skipped), exit 0`, retried: retries };
  }
  if (stalled && retries < 1) {
    return { verdict: "retry", reason: `the watchdog stall class matched (${mismatch.join("; ")}) — retrying the battery once (I36 form (b)); per-gate-attempt behavior is journaled`, retried: retries };
  }
  return { verdict: "refuse", reason: `${mismatch.join("; ")}${stalled ? " — the stall class persisted past the retry" : ""} — commit REFUSED (fix the gates or land a registered re-count)` };
}
