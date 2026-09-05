// Ghidra headless analysis watcher — samples the analysis process and log,
// writes lab/ghidra-status.json for the dashboard's live progress panel.
// Run: node mapgen/ghidra-watch.mjs   (background: setsid ... &)

import fs from "node:fs";
import { execSync } from "node:child_process";

const LOG = process.env.HOME + "/work/ghidra-logs/analysis.log";
const OUT = new URL("../lab/ghidra-status.json", import.meta.url).pathname;
const PROJECT = process.env.HOME + "/work/ghidra-projects";
const startedAt = Date.now(); // watcher start ≈ analysis start (± minutes)

function alive() {
  try { execSync("pgrep -f analyzeHeadless", { stdio: "ignore" }); return true; }
  catch { return false; }
}

function dirSize(dir) {
  let total = 0;
  try {
    for (const f of fs.readdirSync(dir, { recursive: true })) {
      const st = fs.statSync(dir + "/" + f);
      if (st.isFile()) total += st.size;
    }
  } catch { /* project dir may not exist yet */ }
  return total;
}

function tick() {
  let lastLine = "", done = false, logSize = 0, pct = null;
  try {
    const raw = fs.readFileSync(LOG, "utf-8");
    logSize = raw.length;
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    lastLine = lines[lines.length - 1] || "";
    // progress percentages from Ghidra's task monitor, e.g. "INFO ... 42%"
    for (const m of raw.matchAll(/(\d{1,3})%/g)) pct = +m[1];
    if (/ANALYSIS COMPLETED|Analysis succeeded|Saving project|INFO  .*succeeded/i.test(raw) && !alive()) done = true;
  } catch { /* log not created yet */ }
  const status = {
    ts: Date.now(),
    alive: alive(),
    done: done || (!alive() && logSize > 0),
    elapsedSec: Math.round((Date.now() - startedAt) / 1000),
    lastLine: lastLine.slice(0, 160),
    pct,
    projectBytes: dirSize(PROJECT),
    logSize,
  };
  try { fs.writeFileSync(OUT, JSON.stringify(status, null, 1)); } catch { /* transient */ }
  console.log(`[${new Date().toLocaleTimeString()}] alive=${status.alive} elapsed=${status.elapsedSec}s db=${(status.projectBytes / 1e6).toFixed(1)}MB ${status.lastLine.slice(0, 80)}`);
}

setInterval(tick, 5000);
tick();
