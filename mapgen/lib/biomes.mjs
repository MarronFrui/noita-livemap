// Builds biome layout metadata from the extracted game data:
//  - biome map PNG (70×48 RGB, chunk -> biome color)
//  - _biomes_all.xml (color -> biome definition file)
//  - biome definition XMLs (name, wang template, random materials)
//  - connected-component areas per biome color (generation happens per area)
// @prov noitool: the randomMaterials int encoding (annotated inline) is an
// approximation pending binary pinning (CONSTANTS.md rule).

import fs from "node:fs";
import path from "node:path";
import { readPng, rgbToRgbaInt, argbHexToRgbaInt } from "./images.mjs";
import { simplex2DDeriv } from "./noise-proto.mjs"; // 0x8fc020 (the biome-edge displacement)

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
  // background_image = the air backdrop art composited behind the terrain
  // (I32; e.g. coalmine = weather_gfx/background_coalmine; "" ⇒ the
  // biome_color fill). Some defs carry it on the root <Biome> tag instead of
  // <Topology>, so both are scanned.
  const backgroundImage =
    parseAttr(attrs, "background_image") ??
    parseAttr(xml.match(/<Biome\b[^>]*>/)?.[1] ?? "", "background_image") ??
    "";
  // C184, the backdrop clip pair: background_image_height -> f32 [cfg+0xa0]
  // (@0x49cf4e..0x49cf65), limit_background_image -> u8 [cfg+0xa4]
  // (@0x49cf81..0x49cf98); ctor defaults 0x43610000 = 225.0f (@0x495ecf) and
  // 1 (@0x495ed9). Consumer = the per-chunk backdrop builder 0x72c180: with
  // the limit on, the backdrop starts at max(chunk top, height) and is
  // skipped when height > chunk bottom.
  const rootAttrs = xml.match(/<Biome\b([^>]*)>/)?.[1] ?? "";
  const bgHeightAttr = parseAttr(attrs, "background_image_height") ?? parseAttr(rootAttrs, "background_image_height");
  const bgLimitAttr = parseAttr(attrs, "limit_background_image") ?? parseAttr(rootAttrs, "limit_background_image");
  const backgroundImageHeight = bgHeightAttr != null && Number.isFinite(Number(bgHeightAttr)) ? Number(bgHeightAttr) : 225;
  const limitBackgroundImage = bgLimitAttr != null ? bgLimitAttr.trim() !== "0" : true;
  // static_tile="1" biomes (barren/darkness/boss_sky/potion_mimics/watchtower)
  // carry an artworks fg PNG + bg mask instead of a herringbone wang atlas —
  // their first-row wang header is all zeros, so the corner-type fill path
  // cannot run. Rendered by the static-tile lane in world-gen.mjs.
  const staticTile = (parseAttr(attrs, "static_tile") ?? "") === "1";
  // the static tile's background mask (attr @0x49bb39 → [cfg+0x1fc]; its
  // consumer is unread). Measured (E1, barren/darkness/potion_mimics): an
  // fg-air cell under a black mask px renders the sky, under a white px the
  // biome's background_image. world-gen.mjs staticBgMasked.
  const staticTileBgMask = parseAttr(attrs, "static_tile_bg_mask") || null;
  // the Topology's generator TYPE (word-anchored: parseAttr would match the
  // "type" inside noise_type). roadblock.xml is the only biome typed
  // BIOME_WANG_TILE without a wang_template_file; its chunk (33,11) is all
  // sky in the capture (E1), so it generates no terrain (noise-terrain.mjs
  // noiseChunkMask skips it).
  const topologyType = (attrs.match(/(?:^|\s)type\s*=\s*"([^"]*)"/) ?? [])[1] ?? null;
  // C187, the biome-edge flags: noise_biome_edges / big_noise_biome_edges / fat_biome_edges -> u8
  // [cfg+0xc4/0xc5/0xc6] (@0x49d03e / 0x49d06f / 0x49d0a0); the config ctor
  // writes dword 0x101 to +0xc4 (@0x495efc) ⇒ defaults 1 / 1 / 0.
  const flagAttr = (n, dflt) => {
    const v = parseAttr(attrs, n) ?? parseAttr(rootAttrs, n);
    return v != null ? v.trim() !== "0" : dflt;
  };
  const noiseBiomeEdges = flagAttr("noise_biome_edges", true);
  const bigNoiseBiomeEdges = flagAttr("big_noise_biome_edges", true);
  const fatBiomeEdges = flagAttr("fat_biome_edges", false);
  const name = (parseAttr(attrs, "name") || "").replace(/^\$biome_/, "");

  const randomMaterials = [];
  const rcRe = /<RandomColor\b([^>]*)\/?\s*>/g;
  let rc;
  while ((rc = rcRe.exec(xml))) {
    const from = parseAttr(rc[1], "input_color");
    const to = parseAttr(rc[1], "output_colors");
    if (!from || !to) continue;
    // Compared as 24-bit RGB ints, not RGBA. @prov noitool (hexRGBAtoIntRGB);
    // the in-binary compare form is not pinned — approximation.
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
    staticTileBgMask,
    topologyType,
    backgroundImage,
    backgroundImageHeight,
    limitBackgroundImage,
    noiseBiomeEdges,
    bigNoiseBiomeEdges,
    fatBiomeEdges,
    luaScript: parseAttr(attrs, "lua_script"), // the per-chunk 0xffffeedd init lane
    randomMaterials: flatRandomMaterials,

  // Per-biome procedural-terrain noise params, read verbatim from <Topology>
  // (the engine's own input to the noise-terrain family).
  noiseType: parseAttr(attrs, "noise_type"),
  mGradientAddNoise: parseAttr(attrs, "mGradientAddNoise"),
  mGradientEndY: parseAttr(attrs, "mGradientEndY"),
  mGradientStartY: parseAttr(attrs, "mGradientStartY"),
  mGradientHighNoise: parseAttr(attrs, "mGradientHighNoise"),
  mGradientLowNoise: parseAttr(attrs, "mGradientLowNoise"),
  mGradientMaxY: parseAttr(attrs, "mGradientMaxY"),
  mGradientMinY: parseAttr(attrs, "mGradientMinY"),
  mGradientNoiseScale: parseAttr(attrs, "mGradientNoiseScale"),
  // slope keys (C118: → [+0x278]/[+0x280], the mode-3 linear span; ctor
  // defaults 0 / 0.01 per C116). Only the lake family sets them.
  mGradientSlopeDelta: parseAttr(attrs, "mGradientSlopeDelta"),
  mGradientSlopeStartX: parseAttr(attrs, "mGradientSlopeStartX"),
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
  // the mInside* slots (C130): mInsideNoiseType → [+0x224], mInsideNoiseFBM
  // → [+0x228] (mountain_top/mountain_floating_island + pyramid family),
  // mInsideAddValue → [+0x260] (lake family, "5.0"), mInsideOffsetBySeed →
  // [+0x24d] (no shipped file sets it; ctor clears it per C126).
  mInsideAddValue: parseAttr(attrs, "mInsideAddValue"),
  mInsideNoiseFBM: parseAttr(attrs, "mInsideNoiseFBM"),
  mInsideNoiseType: parseAttr(attrs, "mInsideNoiseType"),
  mInsideOffsetBySeed: parseAttr(attrs, "mInsideOffsetBySeed"),
  mMultiplierGradient: parseAttr(attrs, "mMultiplierGradient"),
  mMultiplierPerlin: parseAttr(attrs, "mMultiplierPerlin"), // winter.xml only (slot +0x268)
    // C39 image-lane source (loader chain true 0x8fa930 → LoadImage);
    // consumed by the noise lane's gradAt (lake family; topology_*.png =
    // 512×256).
    bitmapNoiseFile: parseAttr(attrs, "bitmap_noise_file"),
    // the BitmapCaves block (the band-stack builder's data side: fn C1 sizes
    // the grid from size_x/size_y; fnB consumes the structure knobs, C50 —
    // blob-strength pair [+0x74]/[+0x78] → the 0x4ee130 blob-setter), plus
    // its CaveStructure children. Extracted verbatim.
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
    // C19/C20: the driver gates blockOutRooms by template-path equality
    // against "data/wang_tiles/{coalmine,excavationsite}.png", and hasPath's
    // coalmine arms gate on the coalmine.png path the same way. The biome
    // name is never consulted (tower_* sub-biomes map by path).
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
    // flags key off the wang template path (C19/C20), not the biome name
    def.isCoalMine = def.templateFile === "data/wang_tiles/coalmine.png";
    def.shouldBlockOutRooms =
      def.templateFile === "data/wang_tiles/coalmine.png" ||
      def.templateFile === "data/wang_tiles/excavationsite.png";
    // template biomes (no wang atlas) are drawn by the template renderer
    def.template = !def.templateFile;
    // C186: wang areas live in-map. The game builds one wang image P over the
    // 70x48 biome map only (Init 0x905fb0: grid ctor 0x8f95c0(P,
    // floor(70*512/10), floor(48*512/10)) @0x90738f) and every read wraps
    // (getter 0x9fe4e0), so rows above/below the map re-read the main band
    // (the-work.mjs).
    def.areas = computeAreas(map, entry.color);
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

// --- C187: GetBiomeAt 0x909da0 — the biome-edge law ------------------------
// The per-cell biome lookup (the field driver 0x908f40 calls it first, at
// every cell). Frame: X = x + [this+0x38], Y = y + [this+0x40] with
// [+0x38] = W·0.5·512 and [+0x40] = biome_offset_y·512 (Init @0x906c19..
// 0x906c4d) ⇒ X/Y = BIOME-MAP px; in the display frame X = wx, Y = wy − 48·512.
// Chunk fetch 0x909c70: cx = pmod(X>>9, W), cy = clamp(Y>>9, 0, H−1).
//   B = chunk(cx, cy); !B ⇒ null; !B.noise || B.fat ⇒ B.
//   lx = trunc(X)&511, ly = trunc(Y)&511; probe the neighbours in byte order
//   (lx≤41: W; ly≤41: N; lx≥471: E; ly≥471: S; then NW, SW, NE, SE) — the
//   FIRST that differs from B is N. None ⇒ B. !N.noise ⇒ B.
//   both big: n = simplex2DDeriv(X·0.05, Y·0.05)·11
//             X' = trunc(X + sin(Y·0.005)·30 + n), Y' = Y + cos(X·0.005)·30 + n
//   else:     n = simplex2DDeriv(X·0.05, Y·0.05)·2.5; X' = trunc(X + n), Y' = Y + n
//   M = chunk(X'>>9, trunc(Y')>>9); M && M.noise ⇒ M, else B.
// consts: 0x11dfcb0 = 0.05, 0x11dff38 = 11, 0x11dfbc0 = 0.005, 0x11dff68 = 30,
// 0x11dfe98 = 2.5 (f64); sin = 0x1033a34 → _libm_sse2_sin_precise, cos =
// 0x1033a22 → _libm_sse2_cos_precise (IAT 0x114a520 / 0x114a514).
export function biomeChunkDef(config, cx, cy) {
  const W = config.map.width, H = config.map.height;
  const x = ((cx % W) + W) % W, y = Math.min(Math.max(cy, 0), H - 1);
  const i = 4 * (y * W + x);
  const d = config.map.data;
  return config.biomes.get(rgbToRgbaInt(d[i], d[i + 1], d[i + 2])) ?? null;
}
const EDGE_PROBES = [[-1, 0, 1, 0], [0, -1, 0, 1], [1, 0, 2, 0], [0, 1, 0, 2],
  [-1, -1, 1, 1], [-1, 1, 1, 2], [1, -1, 2, 1], [1, 1, 2, 2]]; // dx, dy, lx test, ly test (1 = ≤41, 2 = ≥471, 0 = any)
export function biomeAtPixel(config, X, Y) {
  const xi = Math.trunc(X), yi = Math.trunc(Y);
  const cx = xi >> 9, cy = yi >> 9, lx = xi & 511, ly = yi & 511;
  const B = biomeChunkDef(config, cx, cy);
  if (!B || !B.noiseBiomeEdges || B.fatBiomeEdges) return B;
  // 0x909c70 re-clamps the probe row, so a probe past the map edge reads the
  // clamped row (the byte pushes cy±1 computed from the CLAMPED cy @[esp+0xc]).
  const ccy = Math.min(Math.max(cy, 0), config.map.height - 1);
  const ok = (t, l) => t === 0 || (t === 1 ? l <= 41 : l >= 471);
  let N = null;
  for (const [dx, dy, tx, ty] of EDGE_PROBES) {
    if (!ok(tx, lx) || !ok(ty, ly)) continue;
    const c = biomeChunkDef(config, cx + dx, ccy + dy);
    if (c !== B) { N = c; break; }
  }
  if (!N || !N.noiseBiomeEdges) return B;
  let X2, Y2;
  if (B.bigNoiseBiomeEdges && N.bigNoiseBiomeEdges) {
    const n = simplex2DDeriv(X * 0.05, Y * 0.05) * 11;
    X2 = Math.trunc(Math.sin(Y * 0.005) * 30 + n + X);
    Y2 = Math.cos(X * 0.005) * 30 + n + Y;
  } else {
    const n = simplex2DDeriv(X * 0.05, Y * 0.05) * 2.5;
    X2 = Math.trunc(n + X);
    Y2 = n + Y;
  }
  const M = biomeChunkDef(config, X2 >> 9, Math.trunc(Y2) >> 9);
  return M && M.noiseBiomeEdges ? M : B;
}
