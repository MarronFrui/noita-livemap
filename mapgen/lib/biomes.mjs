// Builds biome layout metadata from the extracted game data:
//  - biome map PNG (chunk -> biome color)
//  - _biomes_all.xml (color -> biome definition file)
//  - biome definition XMLs (name, wang template, random materials)
//  - connected-component areas per biome color (generation happens per area)
//
// Counterpart of noita-tools' dataScripts-generated maps.json, but read
// directly from data.wak contents. This is OUR wrapper; vendor/ stays read-only.

import fs from "node:fs";
import path from "node:path";
import { readPng, rgbToRgbaInt, argbHexToRgbaInt } from "./images.mjs";

function parseAttr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : undefined;
}

function parseBiomesToLoad(xml) {
  const biomes = [];
  const re = /<Biome\b([^>]*)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const filename = parseAttr(m[1], "biome_filename");
    const color = parseAttr(m[1], "color");
    if (filename && color) {
      biomes.push({ filename, color: argbHexToRgbaInt(color) });
    }
  }
  return biomes;
}

function parseBiomeDefinition(dataDir, filename) {
  const xml = fs.readFileSync(
    path.join(dataDir, filename.replace(/^data\//, "")),
    "utf-8"
  );

  // Root <Biome> may carry wang_template_file directly, otherwise it is on <Topology>
  const topo = xml.match(/<Topology\b([^>]*)>/);
  const attrs = topo ? topo[1] : xml.match(/<Biome\b([^>]*)>/)?.[1] ?? "";
  const templateFile = parseAttr(attrs, "wang_template_file");
  const name = (parseAttr(attrs, "name") || "").replace(/^\$biome_/, "");

  const randomMaterials = [];
  const rcRe = /<RandomColor\b([^>]*)\/?\s*>/g;
  let rc;
  while ((rc = rcRe.exec(xml))) {
    const from = parseAttr(rc[1], "input_color");
    const to = parseAttr(rc[1], "output_colors");
    if (!from || !to) continue;
    // C++ compares 24-bit RGB ints (see noita-tools hexRGBAtoIntRGB:
    // parseInt(hex.slice(0,6),16)), not RGBA ints.
    const toRgb24 = (hex) => {
      const v = argbHexToRgbaInt(hex);
      return (v >>> 8); // drop alpha byte: r<<16|g<<8|b
    };
    const toInts = to.split(",").map((h) => toRgb24(h.trim()));
    randomMaterials.push([toRgb24(from), toInts.length, ...toInts]);
  }
  const flatRandomMaterials = [randomMaterials.length, ...randomMaterials.flat()];

  return {
    filename,
    name: name || path.basename(filename, ".xml"),
    templateFile,
    randomMaterials: flatRandomMaterials,
    isCoalMine: false, // set below from name, mirrors noita-tools flags
    shouldBlockOutRooms: false,
  };
}

// 4-connected components over exact color matches -> bounding boxes
function computeAreas(map, color) {
  const { width, height, data } = map;
  const at = (x, y) =>
    rgbToRgbaInt(data[4 * (y * width + x)], data[4 * (y * width + x) + 1], data[4 * (y * width + x) + 2]);

  const visited = new Uint8Array(width * height);
  const areas = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || at(x, y) !== color) continue;
      let x1 = x, y1 = y, x2 = x, y2 = y;
      const stack = [idx];
      visited[idx] = 1;
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % width;
        const cy = (cur / width) | 0;
        if (cx < x1) x1 = cx;
        if (cx > x2) x2 = cx;
        if (cy < y1) y1 = cy;
        if (cy > y2) y2 = cy;
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && at(nx, ny) === color) {
            visited[nIdx] = 1;
            stack.push(nIdx);
          }
        }
      }
      areas.push({ x1, y1, x2, y2 });
    }
  }
  // Deterministic scan order (top-left first)
  areas.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  return areas;
}

export function loadBiomeConfig(dataDir) {
  const mapPath = path.join(dataDir, "biome_impl/biome_map.png");
  const mapPng = readPng(mapPath); // colorType 2 (RGB) in practice; pngjs normalizes to RGBA
  const map = {
    width: mapPng.width,
    height: mapPng.height,
    data: mapPng.data,
  };

  const xml = fs.readFileSync(path.join(dataDir, "biome/_biomes_all.xml"), "utf-8");
  const rootTag = xml.match(/<BiomesToLoad\b([^>]*)>/)?.[1] ?? "";
  const biomeOffsetY = Number(parseAttr(rootTag, "biome_offset_y") ?? 14);
  const entries = parseBiomesToLoad(xml);

  const biomes = new Map();
  for (const entry of entries) {
    if (biomes.has(entry.color)) continue;
    const def = parseBiomeDefinition(dataDir, entry.filename);
    def.isCoalMine = ["coalmine", "solid_wall_tower_1"].includes(def.name);
    def.shouldBlockOutRooms = [
      "coalmine",
      "excavationsite",
      "solid_wall_tower_1",
      "solid_wall_tower_2",
    ].includes(def.name);
    def.areas = computeAreas(map, entry.color);
    if (def.areas.length > 0 && def.templateFile) {
      biomes.set(entry.color, def);
    }
  }

  return { map, biomeOffsetY, biomes };
}

export function biomeAt(config, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= config.map.width || ty >= config.map.height) {
    return undefined;
  }
  const i = 4 * (ty * config.map.width + tx);
  const color = rgbToRgbaInt(
    config.map.data[i],
    config.map.data[i + 1],
    config.map.data[i + 2]
  );
  const biome = config.biomes.get(color);
  if (!biome) return undefined;
  const area = biome.areas.find(
    (a) => tx >= a.x1 && tx <= a.x2 && ty >= a.y1 && ty <= a.y2
  );
  if (!area) return undefined;
  return { color, biome, area };
}
