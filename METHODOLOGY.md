# METHODOLOGY.md — the RE method system (byte-exact track)

**Objective:** reconstruct Noita's world generation byte-exactly from
`noita_dev.exe` such that the port produces the game's own values.
Success is defined in `GOALS.md` (primary goal + ladder); this file
owns **how** we work. Goals → `GOALS.md`; RE evidence → `ABOUT_MATH.md`
§6; canon → `VERIFIED.md`; defects and open questions → `ISSUES.md`.

**Amendment rule:** this file is a living charter. When a dig exposes a
process failure (or a control rule proves unnecessary), append an
amendment row to §7 IN THE SAME COMMIT as the dig. The rules here bind
all future digs; `/dig` enforces them.

The history of failure is the design input: every rule below cites the
recorded incident that motivated it. A rule without an incident is a
hypothesis — proposed rules go through a dig-sized trial before entry.

---

## 1. The claim contract (levels of certainty)

Every technical claim carries exactly one LEVEL tag; mixing levels in
one statement is forbidden (a mixed sentence is two claims, two tags):

| Level | Meaning | Requirements to exist | May be used for |
| --- | --- | --- | --- |
| **B** — BYTE | Derived this session from a dated full-function extraction | VA cites + extraction manifest row (§2) + in-place registry entry | porting, canon, elimination, anything |
| **M** — MEASURED | Derived from an instrument run (oracle JSON, C97 A/B, diff transport) | instrument spec (C-registered) + artifact path + seed/params | validating/refuting B-claims; gates; regressions |
| **D** — DEBT/MODEL | A stand-in for an unread mechanism | all of: named in the §6 register, FLAGGED in code, owning issue exists, queue position assigned | nothing load-bearing; never cited without its D-tag |

**Purification law:** the campaign's approximation count is the number
of D-rows on the active path (§6). Each dig on the active path must
end with strictly fewer D-rows touching its lanes than it started
with, or it must state explicitly which D-rows remain and why (a dig
that cannot decrease the register re-opens its scope — it picked the
wrong dig).

**Anti-loop guard (read this before every dig):** the campaign's two
recorded dig loops both had the same signature — a dig re-investigated
a region without new evidence. Control: a dig declares, *before
extraction*, (a) the NEW evidence it seeks (an unread byte window, a
new data source, a new instrument, or named overturning evidence),
and (b) which registry entry/claim it touches. If both cannot be
stated, the dig is a repeat; pick the next queue item instead
(incidents: the count-law loop of digs #61→#122; the I25—I22 revisit).

---

## 2. Extraction protocol (the C51 control)

The campaign's most expensive failure: a mispinned law (C51's count
roll) survived ~10 digs **because reads were bounded by prior
sessions' citations** — dig #122's re-read window began *past* the
count roll. If a claim's window cannot fit in an extraction someone
actually re-derived this session, it does not exist.

1. **Full-window rule:** a dig's byte reads cover the enclosing
   function(s) from prologue to final `ret` — the loop heads, epilogues
   and callee boundaries included — for each claim byte-window.
2. **Manifest:** every extraction lands in `mapgen/extractions/`
   (gitignored, path-stable — the old `/tmp/opencode/...` citations
   rot); later docs cite manifest rows, not ad-hoc paths. A manifest
   row = file, VA range, tool, extraction date, exe md5 (must equal
   C13's `8b611494212a69492dd0a4527d9c92e0`).
3. **Fresh on session:** this session must re-derive (not re-believe)
   every number it encodes; a prior session's cite is a search hint —
   AGENTS.md/R constitution.
4. **Reload before port:** when the port of a law reveals a surprising
   formula (sign, inversion, constant), STOP and re-read the exact
   instructions before "explaining" the surprise in code — a surprise
   in the port is a failing read, not a fact to accommodate.
   (Incident: dig #123's `trunc(−x)` negative-intermediate idiom read
   as "counts DOWN"; the sub's minuend slot decided the truth.)

## 3. Registration & PE hygiene

Unchanged and mandatory (they intercept re-occurring traps):

- Every PE constant is registered in `CONSTANTS.md` before first use,
  with width and the exact const VA; f32-vs-f64 is stated explicitly.
- SSE leaves EFLAGS alone; SSE compares read EFLAGS via the
  `ucomis…lahf…test $0x44,%ah…jp` idiom — asserts skip the print, not
  the draw (measure draw consumption, don't pattern-match control flow
  near asserts).
- VA conventions: file = true VA − `0x400E00` (C57); old-session cites
  may be shifted `+0x800` — recompute, never copy "true VAs" between
  sessions without re-check.

## 4. Test doctrine (the 2-group control)

- **Stream/budget laws get COUNT tests**: 0 / 1 / N cases, plus the
  record's ≤0 skip path. A boolean ("did it draw?") test is a bug in
  the test suite, not a weaker version of a test.
  (Incident: dig #123's resolver budget drew 1 instead of
  once-per-group until the 2-group unit test demanded 7.)
- Discriminating tests: when a law replaces an old misread, the new
  test must FAIL under the old law's arithmetic (the count-law test
  asserted 2 where the old law returned 6 — that's what makes the test
  a refutation, not a snapshot).
- Data-dependent suites must RUN (not skip) in gates when the data is
  present; `/verify` enforces this (an oracle bar that "passes by
  skipping" has verified nothing).
- Each port law keeps a test whose failure modes are attributed: if a
  gate fails, the test design must make it assignable to a lane.

## 5. The stream-first convergence theorem (the blind-IoU control)

**Recorded lesson:** with a modelled lane upstream in the RNG stream,
every downstream law's positions are wrong, and no shape metric can
distinguish "law wrong" from "stream shifted" (incidents: digs
#118–#123's flat ±0.0004 IoU despite two full writer-model rewrites).

Therefore:
1. The port maintains a **stream-trace instrument** (built dig #124
   with the fnA walk read): per-phase draw totals + the consumption
   site census, machine-checkable.
2. A lane's shape-metric claims (C97 IoU) are only interpreted after
   the stream trace is clean THROUGH that lane and every lane upstream
   of it.
3. Downstream "law corrects" while an upstream lane is still D-level are
   recorded as stream-neutral facts of the law, never as IoU claims.

## 6. The approximation register (live; the purification scoreboard)

Ports marked D are debt, not products. Purification = this table
shrinks; per the purification law (§1), digs on the active path must
decrease their lanes' D-rows. Rows are demoted (D→B/M) ONLY by the
dig that reads their bytes; they are never silently deleted (the
correction moves to VERIFIED §8 per the two-layer doc rule).

| id | stand-in | location | owning issue | the read that removes it |
| --- | --- | --- | --- | --- |
| A1 | `walkChain` per-roll draw counts are MODEL, not byte-laws | `caves-field.mjs` header, `walkChain` | — (M3, GOALS ladder) | **dig #124: the fnA walk window, full extent** |
| A2 | spawn selector / coin-hit draws skipped (`~0.15 draws/point`) | `caves-field.mjs` `walkChain` spawn lane | rides I21's data-parse frontier | fnA read + then the spawn-key parse dig |
| A3 | y-drift span | `caves-field.mjs` header | I24 (deferred) | same fnA window as A1 |
| A4 | F2/G2 widened consts UNPINNED + MOD12 corner-hash reading + `noiseKind` dispatch | `noise-proto.mjs` 467/475/501/647 | I21 family | the kind-0 r-eval/P-chain dig |
| A5 | `colorize` band/vein approx; `template-render` seeded-fBm fill; `biomes.mjs` noitool-derived name-list flags; `has-path` noitool-derived start_x | respective lib files | product-render debt, blocked on the noise-task (I23/M5) | the I23 V2-lane read family |
| A6 | C32 fallback-grey bake per-biome "A-resolver = open" | `caves-field.mjs` ~798 | possible STALE DEBT — digs #87/#88 read `0x8EE1B0`'s arms | staleness re-check: demote or correct at next caves-lane dig |

Legend for locations: "caves-field.mjs" = `mapgen/lib/caves-field.mjs`.

## 7. Amendment log (appended-only)

| v | date | change | motivated by |
| --- | --- | --- | --- |
| 1 | 2026-10-12 | Initial charter: claim contract (B/M/D), full-window extraction + manifest, count-test doctrine, stream-first theorem, approximation register + purification law, anti-loop guard. | the month-long surface-band stall forensics: C51 mispin (#61→#123), the walk draw-budget deferral trail, IoU-blind A/B (#118–#123), Session-Context handover rot, and dig #123's caught 2-group test bug. |
