// JSON map-format contract tests — the serialization spec is the only thing
// these tests depend on (no game data needed).

import { describe, test, expect } from "vitest";
import {
  serializeMapTiles, deserializeMapTiles, validateMapJson,
  MapFormatError, MAP_FORMAT_ID, MAP_FORMAT_VERSION, REQUIRED_KEYS,
} from "../../mapgen/lib/map-format.mjs";

const rgba = () => {
  // 4x3 uniform-ish rgb buffer: rows of colors AA / BB / dedup palette
  const rgb = Buffer.alloc(3 * 4 * 3);
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 4; x++) {
      const c = (x + y) % 3 === 0 ? 0 : (x + y) % 3 === 1 ? 128 : 255;
      const p = 3 * (y * 4 + x);
      rgb[p] = c; rgb[p + 1] = c; rgb[p + 2] = 0;
    }
  return rgb;
};

const validJson = () =>
  serializeMapTiles(rgba(), { width: 4, height: 3, key: "coalmine_29_14", seed: 78633191, attempt: 3 });

describe("serializeMapTiles produces spec-conformant JSON", () => {
  test("round-trips to the identical underlying buffer via the public meta fields", () => {
    const rgb = rgba();
    const json = serializeMapTiles(rgb, { width: 4, height: 3, key: "k", seed: 1, attempt: 0 });
    expect(json.format).toBe(MAP_FORMAT_ID);
    expect(json.version).toBe(MAP_FORMAT_VERSION);
    expect(Object.keys(json).sort()).toEqual([...REQUIRED_KEYS].sort());
    expect(json.width).toBe(4);
    expect(json.height).toBe(3);
    expect(json.px).toHaveLength(12);
    expect(json.palette).toEqual(["000000", "808000", "ffff00"]);
    expect(json.palette.every((c) => /^[0-9a-f]{6}$/.test(c))).toBe(true);
    const back = deserializeMapTiles(json);
    expect(Buffer.compare(back.rgb, rgb)).toBe(0);
    expect(back.key).toBe("k");
    expect(back.rgb).toBeInstanceOf(Buffer);
  });

  test("palette is deduplicated, row-major first-appearance order", () => {
    const rgb = Buffer.from([10, 20, 30, 10, 20, 30, 30, 20, 10, 0, 0, 0]);
    const json = serializeMapTiles(rgb, { width: 2, height: 2 });
    expect(json.palette).toEqual(["0a141e", "1e140a", "000000"]); // 0a,14,1e then repeat
    expect(json.px).toEqual([0, 0, 1, 2]);
  });

  test("JSON.stringify output is pure JSON and re-parses equal", () => {
    const json = validJson();
    const text = JSON.stringify(json);
    expect(JSON.parse(text)).toEqual(json);
    expect(typeof text).toBe("string");
    expect(() => JSON.stringify(json, null, 0)).not.toThrow();
  });

  test("attempt 0 is preserved (falsy-but-valid)", () => {
    const json = serializeMapTiles(rgba(), { width: 4, height: 3, attempt: 0 });
    expect(json.attempt).toBe(0);
    expect(validateMapJson(json).valid).toBe(true);
  });
});

describe("serializeMapTiles rejects malformed inputs (E_INPUT)", () => {
  test("rgb buffer length mismatch is rejected", () => {
    expect(() => serializeMapTiles(Buffer.alloc(4), { width: 4, height: 3 }))
      .toThrow(MapFormatError);
    try {
      serializeMapTiles(Buffer.alloc(4), { width: 4, height: 3 });
    } catch (e) {
      expect(e.code).toBe("E_INPUT");
    }
  });
  test("non-positive dims are rejected", () => {
    expect(() => serializeMapTiles(rgba(), { width: 0, height: 3 })).toThrow(/positive dims/);
    expect(() => serializeMapTiles(rgba(), { width: 4, height: -1 })).toThrow(MapFormatError);
  });
});

describe("validateMapJson — spec conformance diagnostics", () => {
  test("accepts a valid document with no errors and no spec warnings", () => {
    const diag = validateMapJson(validJson());
    expect(diag.valid).toBe(true);
    expect(diag.errors).toEqual([]);
    expect(diag.warnings).toEqual([]);
  });

  // [document, expected diagnostic code]
  const CASES = {
    E_MISSING: [() => { const j = validJson(); delete j.seed; return j; }, "E_MISSING"],
    E_FORMAT: [(j) => { j.format = "other/map"; return j; }, "E_FORMAT"],
    E_VERSION: [(j) => { j.version = 2; return j; }, "E_VERSION"],
    key_type: [(j) => { j.key = 42; return j; }, "E_TYPE"],
    attempt_hi: [(j) => { j.attempt = 100; return j; }, "E_RANGE"],
    attempt_lo: [(j) => { j.attempt = -1; return j; }, "E_RANGE"],
    seed_hi: [(j) => { j.seed = 4294967296; return j; }, "E_RANGE"],
    seed_frac: [(j) => { j.seed = 3.5; return j; }, "E_RANGE"],
    width: [(j) => { j.width = 0; return j; }, "E_TYPE"],
    height: [(j) => { j.height = -2; return j; }, "E_TYPE"],
    palette_type: [(j) => { j.palette = "ff00ff"; return j; }, "E_TYPE"],
    palette_case: [(j) => { j.palette = ["FFFFFF"]; return j; }, "E_PALETTE"],
    px_type: [(j) => { j.px = 12; return j; }, "E_TYPE"],
    px_len: [(j) => { j.px = new Array(11).fill(0); return j; }, "E_LEN"],
    px_index: [(j) => { j.px = new Array(12).fill(9); return j; }, "E_INDEX"],
  };
  test.each(Object.keys(CASES))("flags %s on mutated input", (name) => {
    const [mutate, code] = CASES[name];
    const json = validJson();
    const mutated = mutate(json);
    const diag = validateMapJson(mutated);
    expect(diag.valid).toBe(false);
    expect(diag.errors.some((e) => e.code === code)).toBe(true);
  });

  test("tolerates extra keys as warnings, not errors", () => {
    const json = { ...validJson(), note: "extra metadata ok" };
    const diag = validateMapJson(json);
    expect(diag.valid).toBe(true);
    expect(diag.warnings.some((w) => w.path === "note")).toBe(true);
  });

  test("rejects non-object JSON wholesale", () => {
    expect(validateMapJson(null).errors[0].code).toBe("E_TYPE");
    expect(validateMapJson([1, 2]).errors[0].code).toBe("E_TYPE");
    expect(validateMapJson("map").errors[0].code).toBe("E_TYPE");
  });
});

describe("deserializeMapTiles throws typed MapFormatErrors", () => {
  test("corrupt px index -> E_INDEX surfaced through deserialize", async () => {
    const json = validJson();
    json.px[0] = 999;
    let caught = null;
    try {
      deserializeMapTiles(json);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MapFormatError);
    expect(caught.code).toBe("E_INDEX");
  });
  test("wrong format id -> E_FORMAT surfaced through deserialize", () => {
    const json = validJson();
    json.format = "noita/other";
    expect(() => deserializeMapTiles(json)).toThrow(/invalid map JSON/);
  });
});
