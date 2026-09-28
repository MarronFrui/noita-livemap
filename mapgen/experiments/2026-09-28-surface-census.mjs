#!/usr/bin/env node
// P1 surface census (2026-09-28) — depth-bounded call-graph closure from the
// surface-driver seeds over the Ghidra whole-program export, with
// high-in-degree utility pruning, joined with on-disk dump coverage and
// doc-mention coverage (the "coverage map" join from SESSION_CONTEXT
// 2026-09-27 P1).
//
// Inputs : ~/work/ghidra-logs/p0_functions.csv (entry,name,size)
//          ~/work/ghidra-logs/p0_calls.csv     (from,to)  direct calls only
//          ~/work/ghidra-logs/*.c              dumps (VA-parseable names)
//          repo docs *.md                      mentioned addresses
// Outputs: ~/work/ghidra-logs/surface-region-2026-09-28.csv + stdout summary
//
// Notes / known limits:
//  - edges are DIRECT calls only (P0Export.java): virtual-dispatch callees are
//    invisible, so both in-degree and closure are UNDER-estimates.
//  - a high-in-degree node is treated as shared utility and not expanded;
//    region membership keeps seeds + low-in-degree nodes only.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const GH = process.env.GHIDRA_LOGS || path.join(os.homedir(), "work", "ghidra-logs");
const REPO = path.resolve(new URL("../..", import.meta.url).pathname);

const SEEDS = [0x792580, 0x908f40]; // caller body FUN_00792580 + driver FUN_00908f40
const MAX_DEPTH = 6;
const INDEG_KEEP = 10; // keep/expand nodes called by <= this many distinct call sites
const THRESHOLDS = [5, 10, 20]; // sensitivity report
const VA_LO = 0x400000, VA_HI = 0x1200000; // plausible image-VA window (filters magic constants in docs)

// ---- load function table -------------------------------------------------
const fnRows = [];
const byEntry = new Map();
for (const line of fs.readFileSync(path.join(GH, "p0_functions.csv"), "utf8").split("\n").slice(1)) {
  if (!line) continue;
  const i1 = line.indexOf(","), i2 = line.lastIndexOf(",");
  const entry = parseInt(line.slice(0, i1), 16);
  const name = line.slice(i1 + 1, i2);
  const size = parseInt(line.slice(i2 + 1), 10);
  const row = { entry, name, size };
  fnRows.push(row);
  byEntry.set(entry, row);
}
fnRows.sort((a, b) => a.entry - b.entry);
const entries = fnRows.map((r) => r.entry);

function enclosing(va) {
  let lo = 0, hi = fnRows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = fnRows[mid];
    if (va < r.entry) hi = mid - 1;
    else if (va >= r.entry + r.size) lo = mid + 1;
    else return r;
  }
  return null;
}

// ---- load call edges, in-degree ------------------------------------------
const outEdges = new Map();
const inDeg = new Map();
let edgeCount = 0;
for (const line of fs.readFileSync(path.join(GH, "p0_calls.csv"), "utf8").split("\n").slice(1)) {
  if (!line) continue;
  const [f, t] = line.split(",");
  const from = parseInt(f, 16), to = parseInt(t, 16);
  if (!outEdges.has(from)) outEdges.set(from, []);
  outEdges.get(from).push(to);
  inDeg.set(to, (inDeg.get(to) || 0) + 1);
  edgeCount++;
}

// ---- dump coverage (filename VAs) ----------------------------------------
const dumpVa = new Set();
for (const f of fs.readdirSync(GH)) {
  const m = f.match(/([0-9a-f]{6,8})\.c$/);
  if (m) dumpVa.add(parseInt(m[1], 16));
}
function hasDump(entry) {
  if (dumpVa.has(entry)) return true;
  // dump filename may hold a VA anywhere inside the function
  for (const va of dumpVa) if (va >= entry && va < entry + (byEntry.get(entry)?.size || 0)) return true;
  return false;
}

// ---- doc-mention coverage -------------------------------------------------
const DOC_FILES = [
  "mapgen/ghidra-ledger.md", "mapgen/CONSTANTS.md", "mapgen/VERIFIED.md",
  "mapgen/ABOUT_MATH.md", "mapgen/ISSUES.md", "SESSION_CONTEXT.md", "Current_work.md",
];
const mentioned = new Set();
let docAddrs = 0;
for (const rel of DOC_FILES) {
  const p = path.join(REPO, rel);
  if (!fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, "utf8");
  for (const m of txt.matchAll(/0x([0-9a-fA-F]{5,8})\b/g)) {
    const va = parseInt(m[1], 16);
    if (va < VA_LO || va > VA_HI) continue;
    docAddrs++;
    const r = enclosing(va);
    if (r) mentioned.add(r.entry);
  }
}

// ---- BFS closure with pruning --------------------------------------------
function closure(thr) {
  const depth = new Map();
  const kept = [];
  const skipped = [];
  const q = SEEDS.map((e) => [e, 0]);
  for (const [s] of q) depth.set(s, 0);
  while (q.length) {
    const [e, d] = q.shift();
    const deg = inDeg.get(e) || 0;
    const isSeed = SEEDS.includes(e);
    const keep = isSeed || deg <= thr;
    if (keep) kept.push(e); else skipped.push(e);
    if (d >= MAX_DEPTH || !keep) continue;
    for (const t of outEdges.get(e) || []) {
      if (!depth.has(t)) { depth.set(t, d + 1); q.push([t, d + 1]); }
    }
  }
  return { depth, kept, skipped };
}

// ---- run + report ----------------------------------------------------------
console.log(`# P1 surface census — seeds=${SEEDS.map((s) => "0x" + s.toString(16)).join(",")} depth<=${MAX_DEPTH}`);
console.log(`# function table: ${fnRows.length} fns | direct edges: ${edgeCount} | dump VAs: ${dumpVa.size} | doc addresses in range: ${docAddrs} (mapped to ${mentioned.size} fns)`);

let best = null;
for (const thr of THRESHOLDS) {
  const { kept } = closure(thr);
  const bytes = kept.reduce((s, e) => s + (byEntry.get(e)?.size || 0), 0);
  console.log(`threshold inDeg<=${thr}: region=${kept.length} fns, ${bytes} body bytes (${(bytes / 1048576).toFixed(2)} MB)`);
  if (thr === INDEG_KEEP) best = { thr, kept };
}

const { depth, kept, skipped } = closure(INDEG_KEEP);
const perDepth = new Map();
for (const e of kept) perDepth.set(depth.get(e), (perDepth.get(depth.get(e)) || 0) + 1);
console.log(`\n# chosen threshold: inDeg<=${INDEG_KEEP}`);
console.log(`# per-depth (kept): ${[...perDepth.entries()].sort((a, b) => a[0] - b[0]).map(([d, n]) => `d${d}=${n}`).join(" ")}`);
console.log(`# reached-but-pruned (utility): ${skipped.length}`);

// sanity: known members must be present
for (const must of [0x908f40, 0x908cb0, 0x8f5030]) {
  if (!kept.includes(must)) console.log(`!! SANITY FAIL: expected 0x${must.toString(16)} in region`);
}

// coverage join
let dumped = 0, ment = 0, both = 0;
for (const e of kept) {
  const d = hasDump(e), m = mentioned.has(e);
  if (d) dumped++;
  if (m) ment++;
  if (d && m) both++;
}
console.log(`# coverage: dumped=${dumped}/${kept.length} (${((100 * dumped) / kept.length).toFixed(1)}%) doc-mentioned=${ment}/${kept.length} (${((100 * ment) / kept.length).toFixed(1)}%) both=${both}`);
console.log(`# covered by NEITHER = ${kept.length - dumped - (ment - both)} (the true unread territory of this region)`);

// largest members
const top = [...kept].sort((a, b) => (byEntry.get(b)?.size || 0) - (byEntry.get(a)?.size || 0)).slice(0, 10);
console.log("# largest region members:");
for (const e of top) {
  const r = byEntry.get(e);
  console.log(`   0x${e.toString(16)} ${String(r.size).padStart(6)}B d${depth.get(e)} ind=${inDeg.get(e) || 0} ${hasDump(e) ? "DUMP" : "     "}${mentioned.has(e) ? " DOC" : ""} ${r.name}`);
}

// most-connected excluded (top utility hubs)
const skipTop = [...new Set(skipped)].sort((a, b) => (inDeg.get(b) || 0) - (inDeg.get(a) || 0)).slice(0, 10);
console.log("# top excluded utility hubs (inDeg):");
for (const e of skipTop) {
  const r = byEntry.get(e);
  console.log(`   0x${e.toString(16)} ind=${inDeg.get(e) || 0} ${r ? r.name : "?"}`);
}

// ---- write region CSV ------------------------------------------------------
const out = path.join(GH, "surface-region-2026-09-28.csv");
const lines = ["entry,name,size,depth,indeg,dumped,mentioned"];
for (const e of [...kept].sort((a, b) => a - b)) {
  const r = byEntry.get(e);
  if (!r) continue;
  lines.push(`0x${e.toString(16)},${r.name},${r.size},${depth.get(e)},${inDeg.get(e) || 0},${hasDump(e) ? 1 : 0},${mentioned.has(e) ? 1 : 0}`);
}
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(`# wrote ${out} (${kept.length} rows)`);
