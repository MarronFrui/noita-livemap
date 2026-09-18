// map-format — JSON-serializable representation of generated map data.
//
// Purpose: every map/area/chunk produced by the pipeline can be dumped to
// JSON (and loaded back), so tests can validate ANY generator output against
// a written specification instead of eyeballing PNGs. The palette-encoded
// layout keeps files small while remaining plain JSON.
//
// Spec (version 1):
// {
//   "format":   "noita-livemap/map",  // required, exact
//   "version":  1,                    // required, integer
//   "key":      "coalmine_29_14",     // identifier (area key or "ch_cx_cy")
//   "seed":     number|null,          // world seed the map was generated for
//   "attempt":  0..99|null,           // accepted driver attempt (null = no accept)
//   "width":    positive int,         // px (atlas px; 1 px = 10 world px)
//   "height":   positive int,
//   "palette":  ["rrggbb", ...],      // unique display colors, row-major first use
//   "px":       [int, ...]            // palette indices, row-major, len = w*h
// }
// Extra keys are tolerated (warnings, not errors) so metadata can be added
// without breaking validators.

import * as formatSpec from "./map-format-spec.mjs";

export const MAP_FORMAT_ID = formatSpec.MAP_FORMAT_ID;
export const MAP_FORMAT_VERSION = formatSpec.MAP_FORMAT_VERSION;
export const REQUIRED_KEYS = formatSpec.REQUIRED_KEYS;
export const FIELD_TYPES = formatSpec.FIELD_TYPES;
export const MAX_ATTEMPT = formatSpec.MAX_ATTEMPT;

export class MapFormatError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MapFormatError";
    this.code = code;
  }
}

const hex6 = (r, g, b) =>
  `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

// Serialize an RGB buffer (3 bytes/px, row-major) into the JSON spec.
export function serializeMapTiles(rgb, { width, height, key = "", seed = null, attempt = null } = {}) {
  if (!rgb || width <= 0 || height <= 0) {
    throw new MapFormatError("E_INPUT", "serializeMapTiles requires rgb buffer and positive dims");
  }
  if (rgb.length !== 3 * width * height) {
    throw new MapFormatError("E_INPUT", `rgb length ${rgb.length} != 3*${width}*${height}`);
  }
  const palette = [];
  const paletteIndex = new Map();
  const px = new Array(width * height);
  for (let i = 0, o = 0; i < width * height; i++, o += 3) {
    const hex = hex6(rgb[o], rgb[o + 1], rgb[o + 2]);
    let idx = paletteIndex.get(hex);
    if (idx === undefined) {
      idx = palette.length;
      paletteIndex.set(hex, idx);
      palette.push(hex);
    }
    px[i] = idx;
  }
  return {
    format: MAP_FORMAT_ID,
    version: MAP_FORMAT_VERSION,
    key,
    seed: seed === null ? null : seed >>> 0,
    attempt: attempt ? Math.trunc(attempt) >>> 0 : attempt,
    width: Math.trunc(width),
    height: Math.trunc(height),
    palette,
    px,
  };
}

// Inverse of serializeMapTiles. Throws MapFormatError on any spec violation.
export function deserializeMapTiles(json) {
  const diag = validateMapJson(json);
  if (!diag.valid) {
    throw new MapFormatError(diag.errors[0].code, `invalid map JSON: ${diag.errors[0].message}`);
  }
  const rgb = Buffer.alloc(json.width * json.height * 3);
  for (let i = 0, o = 0; i < json.px.length; i++, o += 3) {
    const hex = json.palette[json.px[i]];
    rgb[o] = parseInt(hex.slice(0, 2), 16);
    rgb[o + 1] = parseInt(hex.slice(2, 4), 16);
    rgb[o + 2] = parseInt(hex.slice(4, 6), 16);
  }
  const { px, ...meta } = json;
  return { ...meta, width: json.width, height: json.height, palette: [...json.palette], rgb };
}

// Validate a JSON value against the spec. Never throws; returns
// { valid, errors: [{code, path, message}], warnings: [{path, message}] }.
export function validateMapJson(json) {
  const errors = [];
  const warnings = [];
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return { valid: false, errors: [{ code: "E_TYPE", path: "", message: "map JSON must be an object" }], warnings };
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in json)) {
      errors.push({ code: "E_MISSING", path: key, message: `missing required key "${key}"` });
    }
  }
  if (json.format !== MAP_FORMAT_ID) {
    errors.push({ code: "E_FORMAT", path: "format", message: `format must be "${MAP_FORMAT_ID}"` });
  }
  if (json.version !== MAP_FORMAT_VERSION) {
    errors.push({ code: "E_VERSION", path: "version", message: `unsupported version ${json.version}` });
  }
  if (typeof json.key !== "string") {
    errors.push({ code: "E_TYPE", path: "key", message: "key must be a string" });
  }
  if (json.seed !== null && typeof json.seed !== "number") {
    errors.push({ code: "E_TYPE", path: "seed", message: "seed must be a number or null" });
  } else if (typeof json.seed === "number" && !(json.seed >= 0 && json.seed <= 4294967295 && Number.isInteger(json.seed))) {
    errors.push({ code: "E_RANGE", path: "seed", message: "seed must be a uint32" });
  }
  if (json.attempt !== null && typeof json.attempt !== "number") {
    errors.push({ code: "E_TYPE", path: "attempt", message: "attempt must be a number or null" });
  } else if (typeof json.attempt === "number" && !(json.attempt >= 0 && json.attempt <= MAX_ATTEMPT && Number.isInteger(json.attempt))) {
    errors.push({ code: "E_RANGE", path: "attempt", message: `attempt must be an integer in [0, ${MAX_ATTEMPT}]` });
  }
  const dimsOk = {},
    numKeys = ["width", "height"];
  for (const k of numKeys) {
    const v = json[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
      errors.push({ code: "E_TYPE", path: k, message: `${k} must be a positive integer` });
      dimsOk[k] = false;
    } else dimsOk[k] = true;
  }
  if (Array.isArray(json.palette)) {
    for (let i = 0; i < json.palette.length; i++) {
      if (!/^[0-9a-f]{6}$/.test(json.palette[i])) {
        errors.push({ code: "E_PALETTE", path: `palette[${i}]`, message: `"${json.palette[i]}" is not a 6-digit lowercase hex color` });
        break;
      }
    }
  } else {
    errors.push({ code: "E_TYPE", path: "palette", message: "palette must be an array" });
  }
  if (dimsOk.width && dimsOk.height) {
    const n = json.width * json.height;
    if (Array.isArray(json.px)) {
      if (json.px.length !== n) {
        errors.push({ code: "E_LEN", path: "px", message: `px length ${json.px.length} != width*height = ${n}` });
      } else if (Array.isArray(json.palette) && json.palette.every((c) => /^[0-9a-f]{6}$/.test(c))) {
        for (let i = 0; i < json.px.length; i++) {
          if (!Number.isInteger(json.px[i]) || json.px[i] < 0 || json.px[i] >= json.palette.length) {
            errors.push({ code: "E_INDEX", path: `px[${i}]`, message: `palette index ${json.px[i]} out of range (palette size ${json.palette.length})` });
            break;
          }
        }
      }
    } else {
      errors.push({ code: "E_TYPE", path: "px", message: "px must be an array" });
    }
  } else {
    errors.push({ code: "E_DEPENDS", path: "px", message: "dims invalid; px not checked" });
  }
  for (const k of Object.keys(json)) {
    if (!REQUIRED_KEYS.includes(k)) warnings.push({ path: k, message: `"${k}" is not part of spec v${MAP_FORMAT_VERSION}` });
  }
  return { valid: errors.length === 0, errors, warnings };
}
