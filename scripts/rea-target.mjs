#!/usr/bin/env node
// The REA target pin. Usage:
//   node scripts/rea-target.mjs            copy + verify noita_dev.exe → mapgen/re/target/ (idempotent)
//   node scripts/rea-target.mjs --check    the pin + the seed file (format + every seed = a function start)
//   node scripts/rea-target.mjs --path     print the pinned target's absolute path (for open_binary)
//   node scripts/rea-target.mjs --bundle <file>   size/md5/sha256 of an exported Evidence bundle (MANIFEST row)
// All human output goes to stderr except --path / --bundle results (stdout).
import fs from "node:fs";
import path from "node:path";
import {
  PINNED_SHA256, SEED_FILE, TARGET, sourceExe, sha256, md5,
  parseSeeds, peSections, functionStartVerdict,
} from "./rea-lib.mjs";

const log = (...a) => console.error("[rea-target]", ...a);
const die = (msg, code = 1) => { log(msg); process.exit(code); };

function pin() {
  if (fs.existsSync(TARGET)) {
    const buf = fs.readFileSync(TARGET);
    if (sha256(buf) === PINNED_SHA256) return buf;
    log(`existing ${TARGET} does not match the pin — re-copying`);
  }
  const src = sourceExe();
  if (!fs.existsSync(src)) die(`source exe not found: ${src} (set NOITA_EXE or NOITA_INSTALL_DIR)`);
  const buf = fs.readFileSync(src);
  const got = sha256(buf);
  if (got !== PINNED_SHA256) {
    die(
      `${src} sha256 ${got} ≠ the pinned ${PINNED_SHA256}.\n` +
      "  The game binary changed (Steam update?). Every VA in CONSTANTS/MANIFEST/VERIFIED and the seed file\n" +
      "  refers to the pinned build — do NOT analyze the new one as if it were the same. Restore the pinned\n" +
      "  exe (Steam depot / backup) or open a re-pin dig.",
      2,
    );
  }
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, buf);
  log(`pinned ${src} → ${TARGET}`);
  return buf;
}

const args = process.argv.slice(2);
if (args[0] === "--bundle") {
  const f = args[1] ?? die("usage: --bundle <file>");
  const buf = fs.readFileSync(f);
  console.log(`${path.basename(f)}\t${buf.length} B\tmd5 ${md5(buf)}\tsha256 ${sha256(buf)}`);
  process.exit(0);
}

const exe = pin();
if (args[0] === "--path") {
  console.log(TARGET);
  process.exit(0);
}
log(`target OK: ${TARGET} (sha256 ${PINNED_SHA256.slice(0, 16)}…)`);

if (args[0] === "--check") {
  const { entries, errors } = parseSeeds(fs.readFileSync(SEED_FILE, "utf8"));
  const pe = peSections(exe);
  for (const e of entries) {
    if (e.kind !== "function") continue;
    const v = functionStartVerdict(exe, pe, e.va);
    if (!v.ok) errors.push(`line ${e.line}: 0x${e.va.toString(16)} ${e.name ?? ""} — ${v.why}`);
  }
  if (errors.length) die(`seed file ${SEED_FILE}:\n  ${errors.join("\n  ")}`);
  log(`seed file OK: ${entries.length} seeds, all function starts`);
}
