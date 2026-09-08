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

  // MaterialComponents of the biome's <Materials> (for procedural fills)
  const materialBands = [...xml.matchAll(/<MaterialComponent\b[\s\S]*?<\/MaterialComponent>/g)]
    .map((b) => ({
      name: (b[0].match(/material_name="([^"]*)"/) ?? [])[1],
      min: Number((b[0].match(/material_min="([^"]*)"/) ?? [])[1] ?? 0),
      max: Number((b[0].match(/material_max="([^"]*)"/) ?? [])[1] ?? 0),
      rare: (b[0].match(/is_rare="([^"]*)"/) ?? [])[1] === "1",
      limitMinY: (b[0].match(/limit_min_y="([^"]*)"/) ?? [])[1],
      limitMaxY: (b[0].match(/limit_max_y="([^"]*)"/) ?? [])[1],
    }))
    .filter((b) => b.name && Number.isFinite(b.min) && Number.isFinite(b.max))
    .map((b) => ({ ...b, limitMinY: b.limitMinY != null ? Number(b.limitMinY) : null, limitMaxY: b.limitMaxY != null ? Number(b.limitMaxY) : null }));

  return {
    filename,
    name: name || path.basename(filename, ".xml"),
    templateFile,
    randomMaterials: flatRandomMaterials,
    materialBands,
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

  // Virtual map: the game samples the biome map with clamped coordinates, so
  // the world extends 48 chunks above (sky), 48 below (deep) and 1 column east
  // of the 70x48 png (hosted-ref DZI: 36352x73728 px = 71x144 chunks, TopLeft
  // world (-17920,-31744)). Virtual row = biome ty + V_OFF_Y; col 70 = col 69.
  const V_OFF_Y = 48;
  const vmap = {
    width: map.width + 1,
    height: map.height + 2 * V_OFF_Y,
    data: new Uint8Array((map.width + 1) * (map.height + 2 * V_OFF_Y) * 4),
  };
  for (let vy = 0; vy < vmap.height; vy++) {
    const ty = Math.min(Math.max(vy - V_OFF_Y, 0), map.height - 1);
    for (let vx = 0; vx < vmap.width; vx++) {
      const tx = Math.min(vx, map.width - 1);
      const s = 4 * (ty * map.width + tx);
      const d = 4 * (vy * vmap.width + vx);
      vmap.data[d] = map.data[s];
      vmap.data[d + 1] = map.data[s + 1];
      vmap.data[d + 2] = map.data[s + 2];
      vmap.data[d + 3] = 255;
    }
  }

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
    // template biomes (no wang atlas) are drawn by the template renderer
    def.template = !def.templateFile;
    // Wang areas are computed over the CLAMPED virtual map (edge biomes extend
    // into sky/deep: the_end down, the_sky up, robobase down). Template-biome
    // areas stay in-map (their renderers place content themselves).
    const areaMap = def.templateFile ? vmap : map;
    def.areas = computeAreas(areaMap, entry.color);
    if (def.templateFile) {
      // wang areas live in virtual-map rows; shift back to biome coords (y1 can be -48)
      for (const a of def.areas) {
        a.y1 -= V_OFF_Y;
        a.y2 -= V_OFF_Y;
      }
    }
    if (def.areas.length > 0) {
      biomes.set(entry.color, def);
    }
  }

  return { map, vmap, V_OFF_Y, biomeOffsetY, biomes };
}

export function biomeAt(config, tx, ty) {
  // biome coords: tx 0..70, ty -48..95 (clamped virtual map)
  if (tx < 0 || ty < -config.V_OFF_Y || tx >= config.vmap.width || ty >= config.vmap.height - config.V_OFF_Y) {
    return undefined;
  }
  const i = 4 * ((ty + config.V_OFF_Y) * config.vmap.width + tx);
  const color = rgbToRgbaInt(
    config.vmap.data[i],
    config.vmap.data[i + 1],
    config.vmap.data[i + 2]
  );
  const biome = config.biomes.get(color);
  if (!biome) return undefined;
  const area = biome.areas.find(
    (a) => tx >= a.x1 && tx <= a.x2 && ty >= a.y1 && ty <= a.y2
  );
  if (!area) return undefined;
  return { color, biome, area };
}
