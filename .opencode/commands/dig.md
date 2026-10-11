---
description: Start one RE dig following the campaign protocol (AGENTS.md charter)
---

You are entering dig mode for: $ARGUMENTS

Live repo state (this shell block, not handovers):

!`git log --oneline -3 && git status --short && echo "--- open issues:" && grep -n "^- \[ \] \*\*I[0-9]" mapgen/ISSUES.md | sed 's/(opened.*//' && echo "--- registry positions:" && grep -oE "Next free: entry \*\*[0-9]+\*\*" mapgen/ABOUT_MATH.md | tail -1`

Protocol — every step is mandatory; if you cannot complete one, stop the
dig and report why instead of improvising (rules = AGENTS.md charter):

1. Read `SESSION_CONTEXT.md` (context loader) → the charter in AGENTS.md
   → the target issue + its rows in ISSUES.md §A. State the dig number
   (head entry + 1), the ONE question it answers, and — THE ANTI-LOOP
   GUARD (charter) — the NEW evidence it seeks (an unread byte window /
   new data / new instrument / named overturning evidence). If no NEW
   evidence exists, STOP: it is a repeat dig; move to the next queue
   item.
2. **Predict-then-read**: write your expected law in 1–2 sentences
   BEFORE opening the disasm; label agree/refute after.
3. **Full-window extraction**: dated-extract every enclosing
   function prologue→ret into `mapgen/extractions/` and add a manifest
   row (file, VA range, tool, exe md5 = C13). Re-derive EVERY number
   this session; a prior cite is a search hint, not evidence.
4. Derive the law; port it. Stream/budget laws get COUNT tests (0/1/N +
   the skip path). Register each new PE constant (CONSTANTS.md)
   before use. A surprise in the port = re-read the bytes, never
   accommodate it in code.
5. **A-register maintenance:** if the dig touched D-row lanes (ISSUES
   §A), the dig must end with fewer D-rows than it began with — or
   state exactly which remain and why (then the dig re-opens scope).
6. Gates (`/verify` battery): npm test green (oracle bars ran, not
   skipped); C97 v2 bit-identical unless the default render observably
   changed (cache rev review then). Report deltas vs the registry
   baselines — never vs chat memory.
7. Docs, same commit (in place, marked OVERTURNED): ABOUT_MATH §6 entry
   (dated), CONSTANTS, ISSUES (§A rows if touched + open/close),
   VERIFIED (§8 elimination row if a canon claim died + §12 if §12
   status changed), the method charter (AGENTS.md) if the dig exposed
   a process failure.
8. Commit `dig #N: <one-line finding>`, tree ends clean, and refresh
   `SESSION_CONTEXT.md` (the loader) before finishing. Report: the
   finding, deltas, D-rows remaining on the touched lanes, and the next
   queue item per VERIFIED §9 / Current_work's queue.
