---
description: Start one RE dig following the campaign protocol (GOALS.md)
---

You are entering dig mode for: $ARGUMENTS

Live repo state (this shell block, not handovers):

!`git log --oneline -3 && git status --short && echo "--- open issues:" && grep -n "^- \[ \] \*\*I[0-9]" mapgen/ISSUES.md | sed 's/(opened.*//' && echo "--- registry positions:" && grep -oE "Next free: entry \*\*[0-9]+\*\*" mapgen/ABOUT_MATH.md | tail -1 && grep -n "^\*\*UPDATE" mapgen/ABOUT_MATH.md 2>/dev/null | tail -1`

Protocol — every step is mandatory; if you cannot complete one, stop the
dig and report why instead of improvising:

1. Read `GOALS.md` (goal stack + method charter) and re-read the target
   issue in `mapgen/ISSUES.md`. State the dig number (head entry + 1)
   and the SINGLE question this dig answers.
2. **Full-window reads**: dated-extract every enclosing function from
   prologue to final `ret` covering the claim surface. Re-derive EVERY
   number you will encode, this session, from that extraction — a prior
   session's cite is a search hint, not evidence. (Historical failure
   mode: C51's count law survived 10 digs via stale windows.)
3. Derive the law; write it down; port it. Stream/budget laws get COUNT
   tests (0 / 1 / N cases) — never boolean. Register any new PE constant
   in CONSTANTS before first use.
4. Gates (`/verify` battery): npm test green INCLUDING the data-dependent
   oracle bars (verify they ran, not skipped); C97 A/B v2 must be
   bit-identical unless the default observably changed (bump the
   gen-cache rev only then). Report deltas vs the registry baselines.
5. Docs, same commit: ABOUT_MATH §6 entry (append, dated), CONSTANTS
   (new C-row + OVERTURNED corrections marked in place), ISSUES
   (open/close), VERIFIED (§8 row if a claim was eliminated + §12 if §8
   status changed).
6. Commit `dig #N: <one-line finding>`, tree ends clean. Report: the
   finding, the deltas, what stays FLAGGED (model-not-byte), and the
   next queue item per GOALS.md's ladder.
