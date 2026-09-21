// Builds biome layout metadata from the extracted game data:
//  - biome map PNG (chunk -> biome color)
//  - _biomes_all.xml (color -> biome definition file)
//  - biome definition XMLs (name, wang template, random materials)
//  - connected-component areas per biome color (generation happens per area)
//
// mapgen/biomes.mjs — parses _biomes_all.xml + biome XMLs + biome_map.png
// (70×48, RGB); connected-component areas per color. This is OUR wrapper;
// vendor/ stays read-only. @prov noitool traces (annotated inline): the
// randomMaterials int-encoding note and the isCoalMine/shouldBlockOutRooms
// name-list flags below are noitool-derived approximations pending
// binary pinning (see the 2026-09-19 standing rule in CONSTANTS.md).

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
  // static_tile="1" biomes (barren/darkness/boss_sky/potion_mimics/watchtower)
  // carry an artworks fg PNG + bg mask instead of a herringbone wang atlas —
  // their first-row wang header is all zeros, so the corner-type fill path
  // cannot run. Rendered by the static-tile lane in world-gen.mjs.
  const staticTile = (parseAttr(attrs, "static_tile") ?? "") === "1";
  const name = (parseAttr(attrs, "name") || "").replace(/^\$biome_/, "");

  const randomMaterials = [];
  const rcRe = /<RandomColor\b([^>]*)\/?\s*>/g;
  let rc;
  while ((rc = rcRe.exec(xml))) {
    const from = parseAttr(rc[1], "input_color");
    const to = parseAttr(rc[1], "output_colors");
    if (!from || !to) continue;
    // C++ compares 24-bit RGB ints (see noita-tools hexRGBAtoIntRGB:
    // parseInt(hex.slice(0,6),16)), not RGBA ints. @prov noitool (the
    // int encoding claim; validated against noitool's C++ — the in-binary
    // 24-bit compare form is NOT yet independently pinned; treat as
    // approximation until pinned — see CONSTANTS.md rule).
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
    staticTile,
    luaScript: parseAttr(attrs, "lua_script"), // the per-chunk 0xffffeedd init lane
    randomMaterials: flatRandomMaterials,

  // Per-biome procedural-terrain noise params (shape side, P1 surface level).
  // Read directly from the biome XMLs' <Topology> block (2026-09-20 dig #8 —
  // the params the binary's noise-terrain family consumes). @data-verified:
  // extracted config = the engine's own input; the BLEND structure
  // (gradient ramp + noise) is a recorded TODO, not yet wired to the port.
  noiseType: parseAttr(attrs, "noise_type"),
  mGradientAddNoise: parseAttr(attrs, "mGradientAddNoise"),
  mGradientEndY: parseAttr(attrs, "mGradientEndY"),
  mGradientStartY: parseAttr(attrs, "mGradientStartY"),
  mGradientHighNoise: parseAttr(attrs, "mGradientHighNoise"),
  mGradientLowNoise: parseAttr(attrs, "mGradientLowNoise"),
  mGradientMaxY: parseAttr(attrs, "mGradientMaxY"),
  mGradientMinY: parseAttr(attrs, "mGradientMinY"),
  mGradientNoiseScale: parseAttr(attrs, "mGradientNoiseScale"),
  mGradientSinMultipleMax: parseAttr(attrs, "mGradientSinMultipleMax"),
  mGradientSinMultipleMin: parseAttr(attrs, "mGradientSinMultipleMin"),
  mGradientType: parseAttr(attrs, "mGradientType"),
  mInsidePerlinClamped: parseAttr(attrs, "mInsidePerlinClamped"),
  mInsidePerlinFunc: parseAttr(attrs, "mInsidePerlinFunc"),
  mInsidePerlinScaleMax: parseAttr(attrs, "mInsidePerlinScaleMax"),
  mInsidePerlinScaleMin: parseAttr(attrs, "mInsidePerlinScaleMin"),
  mInsidePerlinScaleX: parseAttr(attrs, "mInsidePerlinScaleX"),
  mInsidePerlinScaleY: parseAttr(attrs, "mInsidePerlinScaleY"),
  mInsidePerlinScaled: parseAttr(attrs, "mInsidePerlinScaled"),
  mInsidePerlinSquared: parseAttr(attrs, "mInsidePerlinSquared"),
  mMultiplierGradient: parseAttr(attrs, "mMultiplierGradient"),
  mMultiplierPerlin: parseAttr(attrs, "mMultiplierPerlin"), // winter.xml only in the current set (CE (35) slot value for +0x268)
    // dig #24 (2026-09-21): the C39 IMAGE-LANE source = the `bitmap_noise_file`
    // attr (the SetSize+Load wrapper's loader chain true 0x8fa930 → the
    // LoadImage ‑plz/PNG path). Carried verbatim for the noise lane's
    // gradAt (the lake family only in the current set; topology_*.png =
    // 512×256 = the CE's grid shape).
    bitmapNoiseFile: parseAttr(attrs, "bitmap_noise_file"),
    // dig #30 (2026-09-21): the BitmapCaves block (the band-stack builder's
    // data side; fn C1 sizes the grid from size_x/size_y per the (38) byte
    // read, and fnB consumes the structure knobs — the C50 consumer read
    // (blob-strength (min,max) pair [+0x74]/[+0x78] → Random interp → the
    // 0x4ee130 blob-setter)). Extracted verbatim for the SURFACE_V3 lane.
    // The 10 CaveStructure children (image_file, aabb, count, strength).
    bitmapCaves: (() => {
      const m = xml.match(/<BitmapCaves\b([\s\S]*?)<\/BitmapCaves>/);
      if (!m) return null;
      const block = m[0];
      const head = block.match(/<BitmapCaves\b([^>]*)>/)?.[1] ?? "";
      const num = (a, k) => {
        const v = (head.match(new RegExp(`${k}="([^"]*)"`)) ?? [])[1];
        return v != null ? Number(v) : null;
      };
      const structures = [...block.matchAll(/<CaveStructure\b([^>]*?)\/?>/g)].map(
        (c) => {
          const a = c[1] ?? "";
          return {
            imageFile: (a.match(/image_file="([^"]*)"/) ?? [])[1] ?? null,
            aabbMinX: Number((a.match(/aabb_min_x="([^"]*)"/) ?? [])[1] ?? 0),
            aabbMaxX: Number((a.match(/aabb_max_x="([^"]*)"/) ?? [])[1] ?? 0),
            aabbMinY: Number((a.match(/aabb_min_y="([^"]*)"/) ?? [])[1] ?? 0),
            aabbMaxY: Number((a.match(/aabb_max_y="([^"]*)"/) ?? [])[1] ?? 0),
            countMin: Number((a.match(/count_min="([^"]*)"/) ?? [])[1] ?? 0),
            countMax: Number((a.match(/count_max="([^"]*)"/) ?? [])[1] ?? 0),
            strengthMin: Number((a.match(/strength_min="([^"]*)"/) ?? [])[1] ?? 0),
            strengthMax: Number((a.match(/strength_max="([^"]*)"/) ?? [])[1] ?? 0),
          };
        }
      );
      return {
        name: (head.match(/name="([^"]*)"/) ?? [])[1] ?? null,
        sizeX: num(head, "size_x"),
        sizeY: num(head, "size_y"),
        blobCavesCountMin: num(head, "blob_caves_count_min"),
        blobCavesCountMax: num(head, "blob_caves_count_max"),
        blobCavesRadiusMin: num(head, "blob_caves_radius_min"),
        blobCavesRadiusMax: num(head, "blob_caves_radius_max"),
        blobCavesStrengthMin: num(head, "blob_caves_strength_min"),
        blobCavesStrengthMax: num(head, "blob_caves_strength_max"),
        caveChildsMin: num(head, "cave_childs_min"),
        caveChildsMax: num(head, "cave_childs_max"),
        caveCountMin: num(head, "cave_count_min"),
        caveCountMax: num(head, "cave_count_max"),
        caveStrengthMin: num(head, "cave_strength_min"),
        caveStrengthMax: num(head, "cave_strength_max"),
        mountainCountMin: num(head, "mountain_count_min"),
        mountainCountMax: num(head, "mountain_count_max"),
        mountainSizeMin: num(head, "mountain_size_min"),
        mountainSizeMax: num(head, "mountain_size_max"),
        surfaceCaveChildsMin: num(head, "surface_cave_childs_min"),
        surfaceCaveChildsMax: num(head, "surface_cave_childs_max"),
        surfaceCavesCountMin: num(head, "surface_caves_count_min"),
        surfaceCavesCountMax: num(head, "surface_caves_count_max"),
        doBeginningPaths: num(head, "do_beginning_paths"),
        doBeginningDown: num(head, "do_beginning_down"),
        structures,
      };
    })(),
    materialBands,
    // Binary-exact flag derivation (2026-09-19 dig #2, ABOUT_MATH 2026-09-19
    // (8); CONSTANTS.md C19/C20 — replaces the @prov noitool NAME-LIST flags):
    // the driver gates blockOutRooms by std::string/template-path equality
    // against "data/wang_tiles/{coalmine,excavationsite}.png" (only these 3
    // template-path literals exist in the whole binary), and hasPath's
    // coalmine arms (mark walk + stairs band) gate on the coalmine.png path
    // via the same compare. The biome NAME is never consulted in-binary —
    // e.g. every tower_* sub-biome maps to one of the two paths regardless
    // of its name.
    isCoalMine: false, // set below from templateFile == coalmine.png (C20)
    shouldBlockOutRooms: false, // set below from templateFile ∈ {coalmine.png, excavationsite.png} (C19)
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
    // 2026-09-19 dig: flags key off the wang TEMPLATE PATH (the binary's own
    // selection rule; CONSTANTS.md C19/C20), not the biome name. Currently
    // resolves the same 4 biomes as before for the rendered set — PLUS the
    // ones the name lists missed: tower_* (name "tower" — out of the name
    // namespace) and _EMPTY_ (color ffFF8080, also coalmine.png; no biome-map
    // px today).
    def.isCoalMine = def.templateFile === "data/wang_tiles/coalmine.png";
    def.shouldBlockOutRooms =
      def.templateFile === "data/wang_tiles/coalmine.png" ||
      def.templateFile === "data/wang_tiles/excavationsite.png";
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
