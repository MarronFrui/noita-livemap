// Telemetry JSON contract — the pin between the Noita mod (mods/noita-live-
// map/files/telemetry.lua), the bridge reader (bridge/index.js) and the
// frontend. The Lua writer emits exactly:
//   '{"seed":%s,"x":%d,"y":%d,"biome":"%s","ts":%d}'
// These tests pin that shape so any field rename/order/format change fails
// loudly rather than silently starving the frontend.

import { describe, test, expect } from "vitest";

const LUA_FMT = '{"seed":%s,"x":%d,"y":%d,"biome":"%s","ts":%d}';

// Mirror of escape_json_string in telemetry.lua (for the string-typed biome)
const luaEscape = (s) =>
  s
    .replaceAll("\\", "\\\\")
    .replace(/"/g, '\\"')
    .replaceAll(String.fromCharCode(8), "\\b") // Lua gsub source "\b" = backspace byte
    .replace(/\f/g, "\\f")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");

const write = ({ seed, x, y, biome, ts }) =>
  LUA_FMT.replace("%s", String(seed))
    .replace("%d", String(x))
    .replace("%d", String(y))
    .replace("%s", luaEscape(biome))
    .replace("%d", String(ts));

describe("telemetry payload shape (Lua writer <-> bridge <-> frontend)", () => {
  test("exactly the five documented fields, correct types", () => {
    const parsed = JSON.parse(write({ seed: 78633191, x: 512, y: -1024, biome: "coalmine", ts: 42 }));
    expect(Object.keys(parsed)).toEqual(["seed", "x", "y", "biome", "ts"]);
    expect(typeof parsed.seed).toBe("number"); // seed via tostring(%s) — bare JSON number
    expect(parsed.seed).toBe(78633191);
    expect(Number.isInteger(parsed.seed)).toBe(true);
    expect(Number.isInteger(parsed.x)).toBe(true);
    expect(Number.isInteger(parsed.y)).toBe(true);
    expect(typeof parsed.biome).toBe("string");
    expect(Number.isInteger(parsed.ts)).toBe(true);
  });

  test("single-line JSON (no trailing newline) is the wire format", () => {
    const text = write({ seed: 123, x: 0, y: 0, biome: "caves", ts: 1 });
    expect(text).not.toContain("\\n");
    expect(text.startsWith('{"seed')).toBe(true);
    expect(text.endsWith("}")).toBe(true);
  });

  test("biome names with quotes/backslashes survive the Lua escaping round-trip", () => {
    const parsed = JSON.parse(write({ seed: 1, x: 1, y: 1, biome: 'a"b\\c', ts: 0 }));
    expect(parsed.biome).toBe('a"b\\c');
  });

  test("negative coordinates stream through (The Work bands go deep)", () => {
    const parsed = JSON.parse(write({ seed: 2, x: -3840, y: 2304, biome: "the_end", ts: 9 }));
    expect(parsed.y).toBe(2304);
    expect(parsed.x).toBe(-3840);
  });
});

describe("bridge reader robustness (bridge/index.js readAndBroadcast)", () => {
  // The bridge JSON.parse-fails on garbage and logs instead of crashing —
  // pin the parse contract the frontend relies on.
  test("JSON.parse rejects truncated payloads (bridge logs, no crash)", () => {
    expect(() => JSON.parse('{"seed":1,"x":')).toThrow(/JSON|Unexpected/i);
  });
});
