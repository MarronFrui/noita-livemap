// mapgen/experiments/2026-10-12-const-verifier.mjs — I29 Stage 1 (a).
// Machine-verifies the registered constants in mapgen/CONSTANTS.md against
// the actual noita_dev.exe using the PE SECTION TABLE for VA→file mapping
// (NOT the flat −0x400E00 rule, which is .rdata-only — C57 confirmed exact
// for rdata; .data uses −0x401A00).
//
// Verdicts (JSON: mapgen/out/canon-audit-2026-10-12.json):
//   MATCH    pinned decimal == bytes at VA under the declared width (either
//            width when ambiguous)
//   MISMATCH neither width decodes to the pinned value — a CANDIDATE only;
//            eyes re-check before any correction (charter)
//   SIGN?    the row text signed the value elsewhere / ± semantics — eyes
//   RUNTIME  .data BSS beyond RawSize (runtime-poked by design)
//   CODE     cite is inside .text (a function cite, not a const)
//   UNMAPPED the VA is outside the PE section map
//
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const exe = "/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe";
const md5 = execSync(`md5sum '${exe}'`, { encoding: "utf8" }).split(" ")[0];
export const C13 = "8b611494212a69492dd0a4527d9c92e0";
export const exeVerified = md5 === C13;
const asMain = process.argv[1] && process.argv[1].endsWith("const-verifier.mjs");
if (!exeVerified && asMain) {
  console.error(`exe md5 ${md5} ≠ C13 — refusing to verify against a different build`);
  process.exit(2);
}

// ---- PE section map ---------------------------------------------------------
const buf = fs.readFileSync(exe);
const e = buf.readUInt32LE(0x3c);
const nsec = buf.readUInt16LE(e + 6);
const optSize = buf.readUInt16LE(e + 20);
const opt = e + 24;
const pe32 = buf.readUInt16LE(opt) === 0x10b;
const base = buf.readUInt32LE(opt + 28);
const sections = [];
for (let i = 0; i < nsec; i++) {
  const s = opt + optSize + i * 40;
  sections.push({
    name: buf.subarray(s, s + 8).toString().replace(/\0+$/, ""),
    va0: base + buf.readUInt32LE(s + 12),
    vsize: buf.readUInt32LE(s + 8),
    roff: buf.readUInt32LE(s + 20),
    rsize: buf.readUInt32LE(s + 16),
  });
}
const locate = (va) => {
  const s = sections.find((x) => va >= x.va0 && va < x.va0 + x.vsize);
  if (!s) return { name: "?VA-UNMAPPED" };
  const off = va - s.va0;
  return { name: s.name, off: s.roff + off, inRaw: off < s.rsize };
};
const readF = (va, width) => {
  const L = locate(va);
  if (!("off" in L) || !L.inRaw) return null;
  try { return width === 64 ? buf.readDoubleLE(L.off) : buf.readFloatLE(L.off); } catch { return null; }
};
export { locate as locateVa, readF as readConst };
if (!asMain) {
  console.error(`(const-verifier) imported as a module — run it directly for the full sweep`);
} else {
  main();
}
function main() {
  // ---- pair extraction from CONSTANTS.md ------------------------------------
  const text = fs.readFileSync("mapgen/CONSTANTS.md", "utf8");
  const NUM = "[-+]?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?";
  const rows = [];
  for (const line of text.split("\n")) {
    const rm = line.match(/^\| (C\d+) \|/);
    if (!rm) continue;
    const id = rm[1];
    const t = line.replace(/[−]/g, "-"); // unicode minus → ascii
    const pairs = [];
    const push = (v, va, w) => {
      const n = Number(v);
      if (!Number.isFinite(n) || !/^-?\d+\.\d+(?:[eE][+-]?\d+)?$/.test(v)) return; // floats only
      const digits = w == null ? null : String(w).replace(/^f/, "");
      const W = digits === null ? null : Number(digits);
      if (digits !== null && W !== 32 && W !== 64) return; // garbage width → eyes
      pairs.push({ v, n, va: Number.parseInt(va, 16), w: W });
    };
    for (const m of t.matchAll(new RegExp(`(${NUM})\\s*(?:f(32|64)\\s*)?[@@]\\s*(0x[0-9a-fA-F]{5,8})`, "g"))) push(m[1], m[3], m[2]);
    for (const m of t.matchAll(new RegExp(`(0x[0-9a-fA-F]{5,8})\\]?\\s*=\\s*(?:f(32|64)\\s*[-+]?)?(?:\\*\\*)?\\s*(${NUM})`, "g"))) push(m[3], m[1], m[2]);
    for (const m of t.matchAll(new RegExp(`(${NUM})\\s*[=]\\s*(?:\\*\\*)?\\\`(0x[0-9a-fA-F]{5,8})\\\``, "g"))) push(m[1], m[2], null);
    for (const m of t.matchAll(new RegExp(`(${NUM})\\s+(?:f(32|64)\\s+)?\\\`(0x[0-9a-fA-F]{5,8})\\\``, "g"))) push(m[1], m[3], m[2]);
    rows.push({ id, pairs });
  }

  // ---- verify -------------------------------------------------------------------
  const report = [];
  const tally = { MATCH: 0, MISMATCH: 0, RUNTIME: 0, CODE: 0, UNMAPPED: 0 };
  for (const { id, pairs } of rows) {
    if (!pairs.length) { report.push({ id, verdicts: [] }); continue; }
    const verdicts = [];
    for (const { v, n, va, w } of pairs) {
      const L = locate(va);
      const cls = L.name === "?VA-UNMAPPED" ? "UNMAPPED" : L.name === ".text" ? "CODE" : L.name === ".data" && !L.inRaw ? "RUNTIME" : "CONST";
      let verdict = cls;
      if (cls === "CONST") {
        const widths = w ? [w] : [32, 64];
        const got = widths.map((W) => readF(va, W));
        const matches = got.some((g, i) => closeEnough(g, n, widths[i]));
        verdict = matches ? "MATCH" : "MISMATCH";
      }
      tally[verdict]++;
      verdicts.push({ v, va: `0x${va.toString(16)}`, want: w ? `f${w}` : null, cls, verdict });
    }
    report.push({ id, verdicts });
  }
  function closeEnough(got, want, width) {
    if (got == null) return false;
    const eps = width === 64 ? Math.abs(want) * 1e-12 + 1e-300 : Math.abs(want) * 1e-6 + 1e-30;
    return Math.abs(got - want) <= eps;
  }

  const mismatches = report.flatMap((r) => r.verdicts.filter((x) => x.verdict === "MISMATCH").map((x) => ({ c: r.id, ...x })));
  console.log(`# C-rows: ${rows.length}`);
  console.log(`# const-pair verdict tally:`, JSON.stringify(tally));
  if (tally.MISMATCH) {
    console.log(`\n# MISMATCH candidates (eyes-stage; do NOT auto-correct):`);
    for (const m of mismatches) {
      const va = Number.parseInt(m.va.slice(2), 16);
      console.log(`  ${m.c} ${m.va} want=${m.v} f64=${readF(va, 64)} f32=${readF(va, 32)}`);
    }
  }
  fs.mkdirSync("mapgen/out", { recursive: true });
  fs.writeFileSync("mapgen/out/canon-audit-2026-10-12.json", JSON.stringify({ tally, report }, null, 1));
  console.log(`\n# json -> mapgen/out/canon-audit-2026-10-12.json`);
}
