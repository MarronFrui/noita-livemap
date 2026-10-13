// scripts/precommit-gates.mjs — MANDATORY commit gates (charter enforcement).
//
// Wired via `.githooks/pre-commit` + `.githooks/commit-msg` (core.hooksPath).
// Runs git-natively at commit time — no session, prompt, or agent can skip
// it (only the git-native `--no-verify` escape, which is treated as a
// process failure to be registered). Machine-checkable structure in this
// script; the full test battery runs whenever mapgen/tests code is staged.
//
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const fail = (m) => {
  console.error(`\n[precommit-gates] FAIL: ${m}`);
  process.exit(1);
};
const ok = (m) => console.log(`[precommit-gates] ok: ${m}`);
const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8", cwd: process.cwd() });
  } catch (e) {
    fail(`command failed: ${cmd}\n${e.stdout ?? ""}${e.stderr ?? e.message}`);
  }
};

const staged = sh("git diff --cached --name-only --diff-filter=ACM")
  .split("\n").filter(Boolean);

const mode = process.argv[2] === "post-commit"
  ? "post-commit"
  : process.argv[2] && fs.existsSync(process.argv[2]) ? "commit-msg" : "pre-commit";

if (mode === "commit-msg") runCommitMsg(process.argv[2], staged);
else if (mode === "post-commit") runPostCommit();
else runPreCommit(staged);

// ── commit-msg: dig-commit structure (the dig protocol, machine-enforced) ──
function runCommitMsg(msgFile, staged) {
  const msg = fs.readFileSync(msgFile, "utf8");  const m = /^dig #(\d+):/.exec(msg);
  if (!m) return ok("non-dig commit — no dig structure required");

  const n = Number(m[1]);
  // Compare against the HEAD (committed) version, not the working tree —
  // the dig's own entry (N) + next-free (N+1) ARE part of the staged diff.
  // Entry-numbering counts EVERY dated entry header (line-anchored `- **YYYY-MM-DD (N) —`):
  // docs-only entries occupy slots too (the (128) retrospective), so dig #N = the
  // entry axis, not "the last dig's number".
  const headDoc = (() => {
    try { return execSync(`git show HEAD:mapgen/ABOUT_MATH.md`, { encoding: "utf8" }); }
    catch { return ""; }
  })();
  const prevHead = Math.max(...[...headDoc.matchAll(/^- \*\*20\d\d-\d\d-\d\d \((\d+)\) — /gm)].map(m => Number(m[1])), 0);
  const nextFree = prevHead + 1;
  if (n !== nextFree) {
    fail(`dig #${n} ≠ head-entry+1 (${nextFree}) — fix the dig numbering or the skipped registry entry first`);
  }
  for (const need of ["mapgen/ABOUT_MATH.md", "mapgen/CONSTANTS.md", "mapgen/ISSUES.md", "mapgen/VERIFIED.md"]) {
    if (!staged.includes(need)) {
      fail(`dig commits land all four registries in the same commit — missing ${need}`);
    }
  }
  const addedAbout = sh("git diff --cached -U0 -- mapgen/ABOUT_MATH.md")
    .split("\n").filter((l) => l.startsWith("+")).map((l) => l.slice(1)).join(" ")
    .replace(/\s+/g, " "); // the 'Next free' phrase wraps mid-line in some entries
  for (const need of [`(${n}) — dig #${n}`, `Next free: entry **(${n + 1})**`]) {
    if (!addedAbout.includes(need)) {
      fail(`ABOUT_MATH must gain the dated entry "(${n}) — dig #${n}" and refresh 'Next free: entry **(${n + 1})**'`);
    }
    // the anti-loop guard, made mechanical: every dig entry names its NEW
    // evidence (charter). Grandfathered for digs ≤124 (the charter landed
    // after them).
    if (n >= 125 && !addedAbout.includes("**NEW EVIDENCE:**")) {
      fail(`the dig entry must declare '**NEW EVIDENCE:**' (the anti-loop guard, made schema)`);
    }
  }
  // the loader guard: the context loader must ride the dig (refreshed BEFORE
  // the commit — /dig step 8), mechanically checked since it is gitignored.
  const loader = path.join(process.cwd(), "SESSION_CONTEXT.md");
  if (fs.existsSync(loader)) {
    const lt = fs.readFileSync(loader, "utf8");
    if (!lt.includes(`dig #${n}`)) {
      fail(`SESSION_CONTEXT.md must reference 'dig #${n}' BEFORE the dig commit (refresh-then-commit, /dig step 8)`);
    }
  } else fail("SESSION_CONTEXT.md (the context loader) is missing");
  const codeChanged = staged.some((f) => /^mapgen\/(lib|server|pipeline|experiments)\/.*\.mjs$/.test(f));
  const testsChanged = staged.some((f) => /^tests\/.*\.mjs$/.test(f));
  if (codeChanged && !testsChanged) {
    fail("mapgen code staged without tests — every lane law lands with its count tests");
  }
  journal("commit-msg");
  return ok(`dig #${n} structure`);
}

// ---- the gate journal (bypass telemetry) ------------------------------------
// Written by BOTH gated modes at gate-pass time. The post-commit hook
// (`runPostCommit`, same script) writes the `commit <hash>` line per executed
// commit — /verify + /status cross-reference the two line kinds: a commit
// whose timestamp has no matching commit-msg gate entry = a --no-verify (or
// hook-less) bypass → a registered process failure.
function journal(mode) {
  try {
    fs.appendFileSync(path.join(process.cwd(), "mapgen/extractions/.gate-journal.log"),
      `${Math.floor(Date.now() / 1000)} ${mode} ok\n`);
  } catch {} // journal failure must not block a gated commit
}

// ── post-commit: the executed-commit journal (bypass telemetry; the hook ─────
// passes the literal 'post-commit' arg — no commit tree work, always ok).
function runPostCommit() {
  const hash = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const isDig = /^dig #/.test(execSync("git log -1 --format=%s", { encoding: "utf8" }));
  try {
    fs.appendFileSync(path.join(process.cwd(), "mapgen/extractions/.gate-journal.log"),
      `${Math.floor(Date.now() / 1000)} commit ${hash}${isDig ? " DIG" : ""}\n`);
  } catch {}
  process.exit(0);
}

// ── pre-commit: gate battery + citation resolvability ──────────────────────
function runPreCommit(staged) {
  // 1. Full test battery when any mapgen/tests code is staged. The suite
  //    includes the data-dependent oracle bars; a hard-skip also fails (2).
  const codeChanged = staged.some(
    (f) => /^mapgen\/(lib|server|pipeline|experiments)\/.*\.(mjs|js)$/.test(f) || /^tests\/.*\.mjs$/.test(f)
  );
  if (codeChanged) {
    console.log("[precommit-gates] mapgen/tests code staged — running the FULL gate battery (npm test)…");
    try {
      execSync("npm test", { stdio: "inherit", cwd: process.cwd() });
      ok("npm test (full battery incl. oracle bars)");
    } catch {
      fail("npm test — fix the gates before committing (this is charter, not courtesy)");
    }
  } else ok("no mapgen/tests code staged — test battery not required");

  // 2/3. Per-staged-doc citation hygiene on ADDED lines only (grandfathers
  //      historical text; new rot is the regression).
  const docs = staged.filter((f) => f.endsWith(".md"));
  for (const f of docs) {
    if (!fs.existsSync(f)) continue;
    const added = sh(`git diff --cached -U0 -- ${shQuote(f)}`).split("\n")
      .filter((l) => l.startsWith("+")).join("\n");
    const tmpCite = added.match(/\/tmp\/[A-Za-z0-9._\/-]+/);
    if (tmpCite) {
      fail(`${f}: new /tmp citation "${tmpCite[0]}" — /tmp is volatile (the (102)–(123) era orphaned cites); cite a manifest row`);
    }
    for (const m of added.matchAll(/mapgen\/extractions\/([A-Za-z0-9._-]+)/g)) {
      if (m[1] === "MANIFEST.md" || m[1].startsWith(".")) continue; // manifest + internal dot-files are not citeable extractions
      const p = path.join("mapgen/extractions", m[1]);
      if (!fs.existsSync(p)) fail(`${f}: extraction cite ${p} does not exist on disk`);
      const manifest = fs.existsSync("mapgen/extractions/MANIFEST.md")
        ? fs.readFileSync("mapgen/extractions/MANIFEST.md", "utf8") : fail("MANIFEST.md missing");
      if (!manifest.includes(m[1])) fail(`${f}: extraction cite ${m[1]} has no manifest row`);
    }
  }

  // 4. The document-set law (charter 'Document laws'): the .md set is
  //    CLOSED — a newly added .md outside the allowlist is refused. A
  //    fact's home is the registry that already owns its kind.
  const addedFiles = sh("git diff --cached --name-status --diff-filter=A")
    .split("\n").filter((l) => l.startsWith("A\t")).map((l) => l.slice(2));
  const mdAllow = new Set([
    "AGENTS.md", "README.md", "mapgen/README.md", "mapgen/ABOUT_MATH.md",
    "mapgen/VERIFIED.md", "mapgen/CONSTANTS.md", "mapgen/ISSUES.md",
    "mapgen/extractions/MANIFEST.md", "mapcap/README.md",
  ]);
  const badMd = addedFiles.filter((f) => f.endsWith(".md") && !mdAllow.has(f));
  if (badMd.length) {
    fail(`new .md file(s) refused — the document set is CLOSED (charter 'Document laws'): ${badMd.join(", ")}. A fact's home is the registry that already owns its kind`);
  }
  if (addedFiles.some((f) => f.endsWith(".md"))) {
    ok("document-set law: no new .md outside the closed set");
  }

  // 5. The measurement-regime gate (charter 'Measurement law', entry (128)).
  //    Per-entry tagging is the law (charter); the machine-checkable floor
  //    is commit-level: text newly ADDED to the append-only evidence log
  //    that cites an A/B scalar (IoU/fG/rms/meanAbs/C79/C97 family) must
  //    carry 'METER-CLASS:' in the same added text — an untagged meter
  //    reading is exactly the (121)–(127) misread class the regime exists
  //    to stop.
  if (staged.includes("mapgen/ABOUT_MATH.md")) {
    const addedAbout = sh("git diff --cached -U0 -- mapgen/ABOUT_MATH.md")
      .split("\n").filter((l) => l.startsWith("+")).map((l) => l.slice(1)).join(" ");
    const citesMeter = /\b(IoU|iouShift|dyOpt|profL1|fG|fR|meanAbs|meanAbsDiff|rms)\b|\bC79\b|\bC97\b/.test(addedAbout);
    if (citesMeter) {
      if (!addedAbout.includes("METER-CLASS:")) {
        fail("ABOUT_MATH added text cites meter metrics (IoU/fG/rms/meanAbs/C79/C97 family) without a 'METER-CLASS:' tag — charter 'Measurement law', entry (128): tag the run E0/E1/E2/E3 and record its pre-registered 'PREDICTION:' line");
      }
      ok("meter-tag check: METER-CLASS present (entry (128) regime)");
    }
  }
  journal("pre-commit");
  return ok("citation hygiene");
}



function shQuote(s) {
  return `'${s.replaceAll("'", `'\\''`)}'`;
}
