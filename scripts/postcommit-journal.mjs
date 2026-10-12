// scripts/postcommit-journal.mjs — runs from .githooks/post-commit for EVERY
// executed commit. /verify + /status cross-reference this journal: a commit
// whose timestamp has no matching commit-msg gate entry = a --no-verify (or
// hook-less) bypass → flagged as a registered process failure.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const hash = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const ts = Math.floor(Date.now() / 1000);
const isDig = /^dig #/.test(execSync("git log -1 --format=%s", { encoding: "utf8" }));
const line = `${ts} commit ${hash}${isDig ? " DIG" : ""}\n`;
const journal = path.join(process.cwd(), "mapgen/extractions/.gate-journal.log");
fs.appendFileSync(journal, line);
process.exit(0);
