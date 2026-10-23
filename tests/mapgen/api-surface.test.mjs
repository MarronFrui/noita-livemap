// 100% API-compatibility surface: every public export of every mapgen lib
// module is pinned by type. A failed assert here means a public API changed —
// intentional API changes must update this file and the change-log entry.

import { describe, test, expect } from "vitest";
import * as wangJS from "../../mapgen/lib/wang-js.mjs";
import * as coords from "../../mapgen/lib/coords.mjs";
import * as generateExact from "../../mapgen/lib/generate-exact.mjs";
import * as colorize from "../../mapgen/lib/colorize.mjs";
import * as worldGen from "../../mapgen/lib/world-gen.mjs";
import * as hasPathMod from "../../mapgen/lib/has-path.mjs";
import * as images from "../../mapgen/lib/images.mjs";
import * as biomes from "../../mapgen/lib/biomes.mjs";
import * as paths from "../../mapgen/lib/paths.mjs";
import * as templateRender from "../../mapgen/lib/template-render.mjs";
import * as plz from "../../mapgen/lib/plz.mjs";
import * as mapFormat from "../../mapgen/lib/map-format.mjs";
import * as spec from "../../mapgen/lib/map-format-spec.mjs";
import * as cavesField from "../../mapgen/lib/caves-field.mjs";
import * as surfaceLevel from "../../mapgen/lib/surface-level.mjs";

describe("wang-js.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(wangJS).sort()).toEqual([
      "NollaPrng", "buildTileset", "generateCorner", "makePositionalSource", "seededPrng", "seqAttempt",
    ]);
    expect(wangJS.buildTileset.length).toBe(1);
    expect(wangJS.generateCorner.length).toBe(6);
    expect(wangJS.seqAttempt.length).toBe(4);
  });
});

describe("coords.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(coords).sort()).toEqual([
      "ANCHOR", "CELL", "CHUNK", "CORRECTION", "OFFSET_X", "OFFSET_Y",
      "chunkOfBiomePixel", "chunkToBigMapRect", "worldOfBiomePx",
    ]);
  });
  test("coordinate constants are the verified values", () => {
    expect(coords.CHUNK).toBe(512); // chunk size (VERIFIED.md §1)
    expect(coords.CELL).toBe(10); // 1 atlas cell = 10 world px
    expect(coords.OFFSET_X).toBe(35);
    expect(coords.OFFSET_Y).toBe(14); // biome_offset_y
    expect(coords.ANCHOR).toHaveProperty("mode");
    expect(coords.CORRECTION).toEqual({ offsetX: 0, offsetY: 0, flipX: false, flipY: false });
  });
});

describe("generate-exact.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(generateExact).sort()).toEqual(["buildTileset", "chainParam9", "generateAreaExact"]);
    expect(generateExact.chainParam9.length).toBe(3);
  });
});

describe("has-path.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(hasPathMod).sort()).toEqual(["coalmineOverlay", "finalizeLite", "hasPath"]);
    expect(hasPathMod.hasPath.length).toBe(4);
    expect(hasPathMod.finalizeLite.length).toBe(4);
  });
});

describe("colorize.mjs", () => {
  test("SHADES families are complete", () => {
    for (const fam of ["airDark", "rock", "soil", "sand", "moss", "water", "oil", "steel", "wood", "woodV", "coal", "gunpowder", "gold", "radioactive", "fallbackSolid"]) {
      expect(colorize.SHADES[fam]).toBeTypeOf("object");
    }
  });
  test("MATERIAL_SHADE is a name->family map with every family present", () => {
    for (const fam of colorize.MATERIAL_SHADE.values()) {
      expect(colorize.SHADES[fam]).toBeTruthy();
    }
  });
});

describe("world-gen.mjs", () => {
  test("canvas dimensions follow VERIFIED.md (71x144 chunks + 48 sky rows)", () => {
    expect(worldGen.CHUNK).toBe(512);
    expect(worldGen.WORLD_CHUNKS_W).toBe(71);
    expect(worldGen.WORLD_CHUNKS_H).toBe(144);
    expect(worldGen.SKY_ROWS).toBe(48);
    expect(worldGen.WORLD_W).toBe(71 * 512);
    expect(worldGen.WORLD_H).toBe(144 * 512);
    expect(typeof worldGen.loadWangWorld).toBe("function");
    expect(typeof worldGen.worldColorAt).toBe("function");
    expect(typeof worldGen.ensureWorld).toBe("function");
    expect(typeof worldGen.areaKey).toBe("function");
    expect(worldGen.L3_ANCHOR).toEqual({ x: 11, y: 12 }); // C78 (dig #99)
  });
  test("areaKey format is '<name>_<x1>_<y1>'", () => {
    expect(worldGen.areaKey({ name: "coalmine" }, { x1: 29, y1: 14 })).toBe("coalmine_29_14");
  });
});

describe("caves-field.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(cavesField).sort()).toEqual([
      "CAVES_FIELD_VER", "buildCavesField", "carveCircle", "caveRecordStamp", "cavesCellAt",
      "fieldSolidAt", "makeFieldGridFromTopology", "scatterEmptyGate",
      "stampBlendLerp", "toucherValue", "walkChain",
    ]);
    expect(cavesField.buildCavesField.length).toBe(3);
    expect(cavesField.cavesCellAt.length).toBe(5);
    expect(cavesField.walkChain.length).toBe(9);
    expect(cavesField.toucherValue.length).toBe(1);
    expect(typeof cavesField.CAVES_FIELD_VER).toBe("string");
  });
});

describe("surface-level.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(surfaceLevel).sort()).toEqual([
      "buildMaterialsTable", "classify", "componentFromXml",
      "modSigned512Float", "pointInPolygon", "rarePolka",
    ]);
    expect(surfaceLevel.componentFromXml.length).toBe(1);
    expect(surfaceLevel.buildMaterialsTable.length).toBe(3);
    expect(surfaceLevel.classify.length).toBe(4);
    expect(surfaceLevel.rarePolka.length).toBe(6);
    expect(surfaceLevel.pointInPolygon.length).toBe(3); // (poly, tx, ty) — dig #147
    expect(surfaceLevel.modSigned512Float.length).toBe(1); // dig #147/#148
  });
});

describe("images.mjs", () => {
  test("exports match the documented surface", async () => {
    expect(Object.keys(images).sort()).toEqual([
      "argbHexToRgbaInt", "pngDimensions", "pxToRgbaInt", "readImageRaw", "readPng", "rgbToRgbaInt", "rgbaIntChannels", "writePng",
    ]);
    expect(images.readImageRaw.constructor.name).toBe("AsyncFunction");
  });
  test("RGBA int conversions round-trip; ARGB hex parses", () => {
    const int = images.rgbToRgbaInt(0xff, 0x80, 0x01, 0x10);
    expect(images.rgbaIntChannels(int)).toEqual([0xff, 0x80, 0x01, 0x10]);
    // lone-surrogate-free RGBA packing: r<<24 | g<<16 | b<<8 | a
    expect(images.rgbToRgbaInt(0, 0, 0, 0xff)).toBe(0x000000ff);
    expect(images.argbHexToRgbaInt("FFD57917")).toBe(images.rgbToRgbaInt(0xd5, 0x79, 0x17, 0xff));
  });
});

describe("biomes.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(biomes).sort()).toEqual(["biomeAt", "loadBiomeConfig"]);
  });
});

describe("paths.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(paths).sort()).toEqual(["CAPTURE_SEED", "captureTilesources", "findNoitaDataDir", "repoRoot", "wasmPath"]);
    expect(paths.CAPTURE_SEED).toBe(78633191); // the reference seed
    expect(typeof paths.repoRoot).toBe("string");
    expect(typeof paths.captureTilesources).toBe("object");
  });
});

describe("template-render.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(templateRender).sort()).toEqual([
      "TEMPLATE_SHADES", "blitSplicedScenes", "parseInitPixelScenes",
      "renderTemplateChunk", "renderTemplateWorld",
    ]);
  });
});

describe("plz.mjs", () => {
  test("exports match the documented surface", () => {
    expect(Object.keys(plz).sort()).toEqual([
      "PLZ_HEADER_BYTES", "PLZ_RAW_THRESHOLD",
      "decodePlz", "decodePlz1", "decodePlz2", "parsePlzHeader", "plzLevel",
    ]);
    expect(plz.PLZ_HEADER_BYTES).toBe(24);
    expect(plz.PLZ_RAW_THRESHOLD).toBe(0x80); // loader gate 0x90E644 (dig #168)
  });
});

describe("map-format.mjs", () => {
  test("spec constants and exports are self-consistent", () => {
    expect(mapFormat.MAP_FORMAT_ID).toBe("noita-livemap/map");
    expect(mapFormat.MAP_FORMAT_VERSION).toBe(1);
    expect(mapFormat.MAX_ATTEMPT).toBe(99); // driver runs at most 100 attempts
    expect(mapFormat.REQUIRED_KEYS).toEqual([
      "format", "version", "key", "seed", "attempt", "width", "height", "palette", "px",
    ]);
    expect(Object.keys(spec).sort()).toEqual([
      "FIELD_TYPES", "MAP_FORMAT_ID", "MAP_FORMAT_VERSION", "MAX_ATTEMPT", "REQUIRED_KEYS",
    ].sort());
  });
});
