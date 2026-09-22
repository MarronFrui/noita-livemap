# Current_work.md — TEMPORARY working file (delete when the P1 plan closes)

> **Scope:** living task tracker for the **surface level (P1)** plan.
> **This file is temporary — it gets DELETED when Phase 5 completes**
> (SURFACE_V3 dropped from the default render + VERIFIED §12 distill +
> final commit). Plans do NOT live in `mapgen/ISSUES.md` (that file is
> the defect registry only); session handovers live in the gitignored
> `SESSION_CONTEXT.md`.

## Methodology — standing mandate (user; no guess, all reconstruction)

1. **No guessing.** Every domain/byte fact carries a source verified
   **on disk this session** — never chat memory, prior-session
   summaries, or handovers. Untested inferences are labeled OPEN, not
   written as facts.
2. **All reconstruction.** Mechanisms come from `noita_dev.exe` byte
   reads (slab + true VA per CONSTANTS C13) and the game's own
   data/scripts, validated against captures. Approximations `(A)` are
   placeholders that get **REPLACED, never tuned** (ISSUES.md rules,
   2026-09-09 / 2026-09-19).
3. **Constants first.** Register every constant/byte-pin in
   `mapgen/CONSTANTS.md` as a `C##` row BEFORE it is used in code, in
   another doc entry, or in a hypothesis. Code comments cite
   `CONSTANTS.md::<C##>`.
4. **Evidence → canon.** New research lands in `mapgen/ABOUT_MATH.md`
   §6 (append-only; next free entry = **(85)**); settled truth
   distills to `mapgen/VERIFIED.md`; overturns move to VERIFIED §8 —
   never silent deletion. Defects only → `mapgen/ISSUES.md`.
5. **Gates every increment:** `npm test` baseline **177/177**, the
   **y224 byte bar 0/12 rms 0.0000**, floats `toBeBeCloseTo(...,7)`;
   every new lane stays **env-gated** (SURFACE_V3/PROC_FILL policy,
   ABOUT_MATH (52)) until Phase 5 — no flagged model in the default
   render.
6. **One dig → one commit** (docs included). When the session bloats:
   handover to `SESSION_CONTEXT.md`, fresh session.

## The plan — surface level (P1), phases 0–5

> LIVING DOCUMENT — amend freely as digs re-scope a phase; the
> research-driven changes are folded into the phase text itself (see
> the (82)/(84) adaptations in Phase 1) and noted under Status.

1. **[x] Phase 0 — inventory** (no new bytes; ~1 sitting): read the
   C37 detail body (CONSTANTS.md:715+) and the ABOUT_MATH:4413 block →
   write down exactly which inputs of `0x90a860` are read vs unread (the
   `[+0x220..0x268]` slot-fillers = the prime suspect: are they the
   Topology attrs? — **still unattributed**, folded into question A);
   inherit ISSUES I1's sub-hierarchy (P1 refines I1); data census of the
   Topology-param values for the P1 biome set (hills/desert/winter/
   lake/mountain*) + their `scripts/biomes/*.lua` init() bodies
   (stage-11, ⚠️ at ISSUES.md:84) = free ground truth / test fixtures;
   deliverable = §6 entry (82). → **done: dig #82, commit `216e032`.**
2. **[ ] Phase 1 — the consumer chain dig** (binary, the core of A):
   (a) caller census of surfaceField `0x90a860` → **DONE** (dig #83):
   driver true `0x908F40` = the only caller, kind-0 lane =
   `surfaceField(x+0.5, y+0.5, config)`; but its **indirect capture
   site + loop extent/y-range remain OPEN** (0 e8/e9 + 0 imm32);
   (b) slot-fillers via `"mGradientStartY"` string xrefs (C52
   technique) → **METHOD ELIMINATED** (entry (82): whole-exe attr-name
   imm32 scan = zero refs) — re-aimed to the XML-parse family
   `0x496a2e..0x4a97ed` (writes) + C37's `+0x220..0x268` (reads);
   (c) the gradient ramp arithmetic = **question A, OPEN** — entry (84)
   overturned the `[uid+0x1d4]` fill chain as the answer (it is
   Serialize → fn1/fn2 → seed-RNG C27 gen + BiomeSpawnScripts, not the
   ramp); (d) the `>0.5` gate's float-field writer (where `[+0xb4]` gets
   written) → **OPEN** (the reader is byte-read: C34, dig #83; the
   writer is not). Rows/entries landed: C54 (83), C56 (84), entries
   (83)+(84), tests green each dig.
3. **[ ] Phase 2 — the material ID ladder** (prerequisite B.2): the
   fillRandomMaterials / DECOR u16 content walk (frontier item 5,
   VERIFIED.md:186; ISSUES.md:82); the C32 resolver (`[this+0xb0]` /
   script map `[this+0xb4]` → material ID, VERIFIED.md:219) — the
   solid/air rung only for P1 (liquid branch = P3/P5, out of scope).
   Deliverable: the ladder table (field value → gate → u16 cell →
   material ID → color) as a CONSTANTS row + a test fixture. The
   A-resolver body **`0x8EE1B0`** (entry (82) UNREAD item 2) is its
   first read.
4. **[ ] Phase 3 — cross-lane composition** (prerequisite B.1): fnA
   y-drift span (queue #2, VERIFIED.md:551) — how far the caves band
   drifts vertically to where it meets the surface band; the inter-lane
   write order at surface cells (wang vs art vs noise vs caves — dig
   #81 settled only the caves-field's INTERNAL order) by reading the
   stage-9/10/11 writers in application order (§11 lifecycle table).
   Deliverable: one composition-order diagram, byte-cited per arrow =
   the render-gate's "composition order" clause.
5. **[ ] Phase 4 — port**: the surface-level evaluation into the noise
   lane (noise-terrain.mjs V2→real, or a new surface-level.mjs if
   cleaner), byte-cited comments per line-bank, constants already
   registered. Every new lane stays env-gated (SURFACE_V3/PROC_FILL
   policy, ABOUT_MATH (52)) until Phase 5 passes — no flagged model in
   the default render. Each increment: npm test (baseline 177/177) +
   the y224 byte bar (0/12, rms 0.0000) green; floats
   `toBeBeCloseTo(...,7)`.
6. **[ ] Phase 5 — validation ladder + gate open**: unit fixtures from
   the Phase-0 param census → evaluator outputs pinned by hand-computed
   byte-cited frames; capture compare on the P1 biomes
   (mountain/hills/desert/winter/lake) — surface-y line IoU vs the
   mapcap reference **only after the L3 anchor fit** (SESSION_CONTEXT
   next-step #2; absolute-y without the fitted anchor reimports the
   wall-hug artifact), predictable zones first
   (mapcap/PREDICTABLE_ZONES.md = zero-noise debugging); standing bars
   (y224 + battery) green; **user visual check = the final oracle**;
   only then: drop `SURFACE_V3` from the default render
   (noise-terrain.mjs:58; genmap-server.mjs:34 cache r3i → r3j),
   distill into VERIFIED.md §12, commit — **and delete this file.**

## Status & working order (updated per dig; 2026-09-22, after dig #84)

- **Landed:** dig #81 `2b0220b` · Phase 0 = dig #82 `216e032` ·
  Phase 1 spine = digs #83/#84 `0444f82`/`db6be07` (rows C54/C56,
  entries (83)(84), VERIFIED §8 rows 21–22). Tests 177/177, y224
  0/12 rms 0.0000.
- **Next (Phase 1 residuals, in order):**
  1. question A — mGradient WRITE hunt in the XML-parse family
     `0x496a2e..0x4a97ed` (StartY/EndY/HighNoise/LowNoise/NoiseScale),
     then the matching READ in C37's surfaceField config range
     `+0x220..0x268` (also answers Phase 0's open slot-attribution).
  2. the sampler wrap-arg contradiction: (83) said "dims on P at
     +0x20" vs dig #84's "P+0x20 = container block" — re-read the
     sampler's wrap call site.
  3. the `[+0xb4]` float-field WRITER (the gate's other half).
  4. driver `0x908F40` indirect capture site + loop extent/y-range.
- **Then:** Phase 2 (A-resolver `0x8EE1B0` → 132-B record walk →
  planters) → Phase 3 (fnA y-drift + inter-lane order) → Phase 4
  (gated port) → Phase 5 (fixtures → anchor-fit IoU → user visual →
  gate open) → **delete this file.**
