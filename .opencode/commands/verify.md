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
