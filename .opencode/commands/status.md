---
description: Derive live campaign status from the registries (no stale handovers)
---

Produce the campaign status report. Derive EVERYTHING live — no numbers
from memory or stale files; state the source next to each number.

Cheap facts first:

!`echo "=== HEAD ===" && git log --oneline -5 && echo && git status --short && echo "=== registry positions ===" && grep -cE "^- \*\*2026-" mapgen/ABOUT_MATH.md | xargs echo "evidence entries:" && grep -cE "^\| C[0-9]+" mapgen/CONSTANTS.md | xargs echo "constants rows:" && sed -n "/## 8. Eliminated/,/## 9/p" mapgen/VERIFIED.md | grep -cE "^\| [0-9]+" | xargs echo "eliminated rows:" && grep -oE "Next free: entry \*\*[0-9]+\*\*" mapgen/ABOUT_MATH.md | tail -1`

!`echo "=== OPEN issues (ranked as in file) ===" && grep -n "^- \[ \] \*\*I[0-9]" mapgen/ISSUES.md | cut -c1-160 && echo && echo "=== FLAGGED (model-not-byte) in code+docs ===" && grep -rn "FLAGGED" mapgen/*.md mapgen/lib/*.mjs | cut -c1-160`

Then, using the shell tool yourself (not injected):
- last three dig commits' themes (git log),
- the top three items of VERIFIED §9 / GOALS.md ladder M3–M5 and which
  one is next,
- C97 latest baselines from the newest ABOUT_MATH entry (grep the tail),
- anything whose only support is a stale file (SESSION_CONTEXT.md) —
  and say so.

End with: the next dig's target AND the single question it answers.
