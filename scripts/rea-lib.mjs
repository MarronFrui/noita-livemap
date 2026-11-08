// REA (reverse-engineering MCP) helpers: the pinned RE target, the Ghidra
// seed-file parser (mirrors rea-agents' parseGhidraSeeds rules) and a PE
// function-start check. Pure ESM, no deps — used by scripts/rea-target.mjs
// and tests/rea-seeds.test.mjs.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The binary every VA in the registries refers to (noita_dev.exe, build 2025-01-26). */
export const PINNED_SHA256 = "d2f7dbeff72b785bdadd068870343d2821cf4bd2f6c58125fe6a90a1b0900285";
export const SEED_FILE = path.join(ROOT, "mapgen/re/noita_dev.seeds.tsv");
export const TARGET = path.join(ROOT, "mapgen/re/target/noita_dev.exe");
export const DEFAULT_SOURCE = "/mnt/e/Programmes/Steam/steamapps/common/Noita/noita_dev.exe";

/** Where the original exe lives: NOITA_EXE, else NOITA_INSTALL_DIR/noita_dev.exe, else the AGENTS.md path. */
export function sourceExe(env = process.env) {
  if (env.NOITA_EXE) return env.NOITA_EXE;
  if (env.NOITA_INSTALL_DIR) return path.join(env.NOITA_INSTALL_DIR, "noita_dev.exe");
  return DEFAULT_SOURCE;
}

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
export const md5 = (buf) => createHash("md5").update(buf).digest("hex");

/**
 * Parse a seed file with rea-agents' rules: `address<TAB>kind[<TAB>name]`,
 * blank / `#` lines ignored, address 0x-hex, kind ∈ {function, code, label},
 * name without whitespace (≤ 255 chars here), label needs a name, code takes none.
 * Additionally (project rule) names must be unique.
 */
export function parseSeeds(text) {
  const entries = [];
  const errors = [];
  const seenAddr = new Set();
  const seenName = new Map();
  text.split("\n").forEach((raw, i) => {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const n = i + 1;
    if (line.trim() === "" || line.startsWith("#")) return;
    const fields = line.split("\t");
    if (fields.length < 2 || fields.length > 3) return errors.push(`line ${n}: expected address<TAB>kind[<TAB>name]`);
    const [address, kind, name] = fields;
    if (!/^0x[0-9a-fA-F]{1,16}$/.test(address)) return errors.push(`line ${n}: address must be 0x-prefixed hex`);
    if (!["function", "code", "label"].includes(kind)) return errors.push(`line ${n}: kind must be function, code or label`);
    if (name !== undefined && (name.length === 0 || name.length > 255 || /[\s\0]/.test(name)))
      return errors.push(`line ${n}: name must be 1..255 characters without whitespace`);
    if (kind === "label" && name === undefined) return errors.push(`line ${n}: a label seed requires a name`);
    if (kind === "code" && name !== undefined) return errors.push(`line ${n}: a code seed takes no name`);
    const va = Number.parseInt(address, 16);
    const key = `${va.toString(16)}:${kind}`;
    if (seenAddr.has(key)) return errors.push(`line ${n}: duplicate ${kind} seed at ${address}`);
    seenAddr.add(key);
    if (name !== undefined) {
      if (seenName.has(name)) return errors.push(`line ${n}: name ${name} already used on line ${seenName.get(name)}`);
      seenName.set(name, n);
    }
    entries.push({ line: n, va, kind, name });
  });
  return { entries, errors };
}

/** Minimal PE32 section table: VA → file offset. */
export function peSections(buf) {
  const pe = buf.readUInt32LE(0x3c);
  if (buf.toString("latin1", pe, pe + 4) !== "PE\0\0") throw new Error("not a PE file");
  const nsec = buf.readUInt16LE(pe + 6);
  const optSize = buf.readUInt16LE(pe + 20);
  const imageBase = buf.readUInt32LE(pe + 24 + 28);
  const sections = [];
  for (let i = 0, o = pe + 24 + optSize; i < nsec; i++, o += 40) {
    sections.push({
      name: buf.toString("latin1", o, o + 8).replace(/\0.*$/s, ""),
      va: imageBase + buf.readUInt32LE(o + 12),
      vsize: buf.readUInt32LE(o + 8),
      raw: buf.readUInt32LE(o + 20),
      rawSize: buf.readUInt32LE(o + 16),
    });
  }
  const toFile = (va) => {
    const s = sections.find((s) => va >= s.va && va < s.va + Math.min(s.vsize, s.rawSize));
    return s ? { section: s.name, offset: va - s.va + s.raw } : null;
  };
  return { imageBase, sections, toFile };
}

/**
 * Heuristic function-start check for MSVC x86 code: inside .text, and either
 * preceded by int3/ret/nop padding (or a `ret imm16`), or opening with the
 * `push ebp; mov ebp,esp` prologue.
 */
export function functionStartVerdict(buf, pe, va) {
  const m = pe.toFile(va);
  if (!m || m.section !== ".text") return { ok: false, why: "not inside .text" };
  const prev = buf[m.offset - 1];
  const head = buf.subarray(m.offset, m.offset + 3);
  const padded = prev === 0xcc || prev === 0xc3 || prev === 0x90 || buf[m.offset - 3] === 0xc2;
  const prologue = head[0] === 0x55 && head[1] === 0x8b && head[2] === 0xec;
  return padded || prologue
    ? { ok: true }
    : { ok: false, why: `prev byte 0x${prev.toString(16)}, head ${[...head].map((b) => b.toString(16).padStart(2, "0")).join(" ")} — looks mid-function` };
}
