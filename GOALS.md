# Campaign goal stack — Noita mapgen RE

This file is the plan of record for the mapgen campaign. The **live
state** lives in the four registries (`mapgen/ABOUT_MATH.md` §6,
`mapgen/CONSTANTS.md`, `mapgen/ISSUES.md`, `mapgen/VERIFIED.md` §8/§12)
and is derived fresh every session (`/status`) — never copy numbers from
here into work or docs. `SESSION_CONTEXT.md` was RETIRED 2026-10-12 (stale
since entry (110); archived at `docs/history/SESSION_CONTEXT-archived-2026-09-28.md`,
history only).

## The primary goal (non-negotiable)

Reproduce the game's world **exactly** for the live seed from our own
reconstruction of the binary — no captured tiles. Success measure: for
every surface biome, the generated tile's solid 2-D mask matches the
capture's mask **after registration only** (best vertical shift), on the
reference seed first, then arbitrary seeds. Registration-tolerant, not
"similarity-tolerant": a value that is solid in-game must be solid in the
port at the same cell.

Secondary (roadmap): seed-prediction features (shifts, shops, perks) once
the world is right.

## Why a month went into the surface band — and the fix

Forensics (as of dig #123): the surface band's LAWS are now arriving
correct on the first read, but the campaign spent its first month
because three compromises compounded:

1. **Wrong laws lived long.** Laws were read from prior sessions' cited
   windows instead of from the enclosing function's full extent — the
   C51 count-law mispin survived 10 digs (including a re-read whose
   window started *past* the count roll).
2. **Stream equivalence was never established**, so every downstream
   lane's "the laws are right, the positions are wrong" could not be
   verified — and each new law's IoU A/B was masked by stream noise.
   (Root cause: the walk lane's per-roll draw counts are still MODEL,
   not bytes.)
3. **The metric was the dashboard.** C97's IoU cannot separate
   "law wrong" from "stream shifted", so improvement was invisible and
   temptation to tune existed. (We held the no-tuning line; the
   instrument was the weak part.)

## Method charter (the process rules that fix 1–3)

1. **Full-window reads.** Every byte claim is derived THIS session from
   a dated extraction covering the enclosing function(s) from prologue
   to the last `ret` — never from a prior session's cite, never from a
   window bounded by old addresses. Numbers without a this-session
   extraction do not enter docs or code.
2. **Count tests for stream laws.** Any law that consumes draws is
   tested as counts (0 / 1 / N cases), plus an end-to-end stream-trace
   comparison against the game, before any shape metric is consulted.
3. **Stream truth before shape truth.** The stream trace (draws consumed
   per phase boundary vs the game's disassembly) is the convergence
   instrument; C97 IoU is only interpreted after the stream trace is
   byte-clean through a lane.
4. **No silent deferrals.** A model-not-byte lane stays in the FLAGGED
   register with a named dig in the queue. Deferrals have positions,
   not moods.
5. **No tuning.** If a metric worsens while correctness improves, commit
   anyway and say so in the docs (precedents: digs #122, #123).
6. **One dig = one commit.** Port + tests + gates + the four registries
   land together; the tree ends clean. `/dig` enforces the protocol.

## Milestone ladder (in order — do not skip ahead)

- **M1 — Wang core (COMPLETE, oracle-verified).** Fill engine,
  sub-seeds, hasPath: prediction for regular areas.
- **M2 — Surface-band writer census (closed as of dig #123)** every
  float/byte writer in fnA/fnB identified; the record lane proven
  draws-only (I28); the walk = setter flag=1 carve (I26). The
  remaining unknown-stamp-source: the y0 bump bell (x10..28) —
  unmodeled raise lane, candidates: walk-position divergence or I27.
- **M3 — STREAM TRUTH (current frontier, highest leverage).** The walk
  lane's per-roll draw counts → byte laws (fnA window read), then
  everything downstream inherits a correct stream. Deliverable: the
  stream-trace instrument green through walk → loop B/C → records →
  L2/L3. This is the dig that converts the campaign's remaining
  "adjust" residue into derivations.
- **M4 — Published-object join (I27) + kind-0 r-eval/P-chain (I21).**
  The remaining stamp sources for the surface band.
- **M5 — The V2 lane (I23): the game's real cell loop.** This is what
  the DEFAULT render must eventually use; the product endgame.
- **M6 — Convergence.** C97 after-registration IoU → 1.0 per biome; then
  vertical (z) / content layers; then ROADMAP's prediction features.

## Escalation rule

If M3's read shows the walk's draw budget is not deterministically
readable (e.g. the roll counts depend on data outside fnA), RE-RANK:
stop downstream lane work, resolve that specific dependency absolutely
next — never accumulate work that rests on an unverified stream.
