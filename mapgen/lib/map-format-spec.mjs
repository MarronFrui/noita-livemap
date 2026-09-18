// The map-format specification constants — the single source of the JSON
// contract that `map-format.mjs` implements and the tests assert against.

export const MAP_FORMAT_ID = "noita-livemap/map";
export const MAP_FORMAT_VERSION = 1;
export const REQUIRED_KEYS = Object.freeze([
  "format", "version", "key", "seed", "attempt", "width", "height", "palette", "px",
]);
export const FIELD_TYPES = Object.freeze({
  format: "string:exact(noita-livemap/map)",
  version: "integer:exact(1)",
  key: "string",
  seed: "uint32|null",
  attempt: "integer[0,99]|null",
  width: "positive integer",
  height: "positive integer",
  palette: "string[6-hex][]",
  px: "int[] (palette indices, len == width*height)",
});
export const MAX_ATTEMPT = 99; // the driver runs at most 100 attempts (A = 0..99)
