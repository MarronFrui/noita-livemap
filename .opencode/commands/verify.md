---
description: Run the full dig gate battery (tests + oracle bars + C97 A/B)
---

Run the gate battery in this order and report each result explicitly
(name the expectation before the run — honest gating):

0. Mandatory-gate wiring: `git config core.hooksPath .githooks` must
   resolve (self-heal if unset) — the dig gates in
   `scripts/precommit-gates.mjs` run at commit time, git-natively.

1. `npm test` — must be all-pass. Verify the data-dependent suites RAN
   (not skipped): the report must show the oracle describe blocks
   executing when the data is present. Report test count vs the last
   baseline (grep the newest ABOUT_MATH entry for "Tests").
2. C97 A/B (`SURFACE_V2=1`, then `SURFACE_V3=1`, then
   `SURFACE_V2=1 SURFACE_V3=1`):
   - v2 IoU must equal the last registry baseline (grep "v2" bit
     identity in the newest entry) — otherwise a cache rev bump review
     is required.
   - v3 / v2v3: record IoU + fG vs fR and state the delta direction
     honestly (mask-neutral or not). Compare against the baseline
     numbers in the newest ABOUT_MATH entry — do not trust any
     summary's numbers; grep the file.
3. Registry cross-check (grep): next-free slots are consistent across
   all four registries; no unresolved OVERTURNED claim without a
   correcting pointer.

Report: a table of gates, each green/red/changed, and whether the
current work is committable.

Final step — the BYPASS audit (machine): every commit must have a
gate-journal entry within ±150s of its creation timestamp; a commit
without one = a `--no-verify`/hook-less bypass — list them; the
charter treats the bypass as a registered process failure. Verify:

!`node -e '
const fs = require("fs");
const { execSync } = require("child_process");
const commits = execSync("git log --format=\"%ct %h %s\" -30", {encoding:"utf8"}).trim().split("\n").map(l => { const [t, h, ...s] = l.split(" "); return { t: +t, h, s: s.join(" ") }; });
let journal = [];
try { journal = fs.readFileSync("mapgen/extractions/.gate-journal.log", "utf8").trim().split("\n"); } catch {}
const jts = journal.filter(l => l.includes(" commit-msg ok")).map(l => +l.split(" ")[0]);
const js = jts.length ? Math.min(...jts) - 300 : Infinity; // grandfather pre-journal commits
const bypassed = commits.filter(c => c.s.startsWith("dig #") && c.t > js && !jts.some(j => Math.abs(j - c.t) < 150));
console.log(bypassed.length ? "BYPASS DETECT: " + bypassed.map(c => c.h + " " + c.s.slice(0, 40)).join("; ") : "no dig-commit bypasses detected (journal coverage complete)");
'`
