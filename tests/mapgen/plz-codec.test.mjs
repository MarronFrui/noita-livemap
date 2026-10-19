// tests/mapgen/plz-codec.test.mjs — dig #168: the .plz container codec
// (mapgen/lib/plz.mjs) + THE SPLICE PAINT-CLASSIFICATION LAW (blitSplicedScenes'
// air/miss skips, template-render.mjs).
//
// Claim levels: the codec windows = B (BYTE, this-session full-window reads —
// MANIFEST X137/X138/X139); the census/content pins = M (MEASURED, this
// script); the render counts = E1 count law (see the count-test comment).
//
// COUNT-TEST NOTE (charter: a replacement test must FAIL under the old law's
// arithmetic): TWO laws pin this lane. (1) dig #168's classification: the OLD
// law = skip pure-black only; air cells painted with fallbackSolid, miss cells
// painted with the ART's RAW RGB — chunk "40,62" then has miss-painted =
// 104075; the pin below (0) fails that arithmetic. (2) dig #170's grey-fill
// law (C145): pure-grey placeholder px (104653 at alpha>=10) fill with the
// HOSTING BIOME's MaterialComponent band shades; the OLD law (grey =
// keep-content skip, unset 183144) fails the new unset/paint pins by
// construction. Both laws are capture-counted (E1: the #168 truth table in
// ABOUT entry (168); the #170 fill/defer split — art-grey cells are capture
// SOLID 104002/104002 = 100.000% while art-black "below shows" is 46.2% dark
// — in ABOUT entry (170)), NOT derived from the tile IoU.
//
// SCOPE: the count law pins the exported blitSplicedScenes on a fresh map —
// chunk 40,62's full-render content is byte-identical to that blit (M:
// mapgen/experiments/2026-10-18-splice-chunk-equiv.mjs, byteEqual true,
// 48783 ms full render vs 1825 ms splice-only). No whole-world render runs
// in this file: that single ~49 s sync span sits on vitest single-fork's
// 60 s worker-RPC cliff (the I36 `Timeout calling "onTaskUpdate"` class).
//
// The codec section needs no game data; the census/render sections auto-skip
// without it (they RUN in this repo's gates — data is present there).

import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  PLZ_HEADER_BYTES, PLZ_RAW_THRESHOLD,
  decodePlz, decodePlz1, decodePlz2, parsePlzHeader, plzLevel,
} from "../../mapgen/lib/plz.mjs";

const DATA_DIR = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const hasData = fs.existsSync(DATA_DIR + "/biome_impl/spliced");

// ---- helpers -------------------------------------------------------------
function makePlzFile({ ver = 1, w = 4, h = 2, bpp = 4, rawLen, payload }) {
  const head = Buffer.alloc(PLZ_HEADER_BYTES);
  head.writeUInt32LE(ver, 0);
  head.writeUInt32LE(w, 4);
  head.writeUInt32LE(h, 8);
  head.writeUInt32LE(bpp, 12);
  head.writeUInt32LE(payload.length, 16);
  head.writeUInt32LE(rawLen, 20);
  return Buffer.concat([head, payload]);
}
// literal-only payload: ctrl bytes = len-1 (<= 31), data verbatim.
// level = the dispatcher tag for the FIRST ctrl: (level-1)<<5 | (n-1) —
// the level decoder masks it back with &0x1f (window law).
function literalPayload(bytes, level = 1) {
  const parts = [];
  let i = 0;
  while (i < bytes.length) {
    const n = Math.min(32, bytes.length - i);
    const ctrl = (n - 1) | ((level - 1) << 5);
    parts.push(Buffer.from([i === 0 ? ctrl : n - 1]), bytes.subarray(i, i + n));
    i += n;
  }
  return Buffer.concat(parts);
}

describe("plz codec — format vectors (dig #168, byte law)", () => {
  test("header parse: 6 x u32 LE, short buffers throw", () => {
    const f = makePlzFile({ rawLen: 8, payload: Buffer.alloc(8) });
    expect(parsePlzHeader(f)).toEqual({ ver: 1, w: 4, h: 2, bpp: 4, compLen: 8, rawLen: 8 });
    expect(() => parsePlzHeader(f.subarray(0, 20))).toThrow(/short header/);
    expect(() => parsePlzHeader(Buffer.concat([f.subarray(0, 24), Buffer.from([1, 2])])))
      .toThrow(/short payload/);
  });

  test("dispatcher tag: level = (payload[0] >> 5) + 1", () => {
    expect(plzLevel(Buffer.from([32]))).toBe(2); // 0b001_00000
    expect(plzLevel(Buffer.from([63]))).toBe(2); // 0b001_11111
    expect(plzLevel(Buffer.from([0]))).toBe(1); //  0b000_00000
    expect(plzLevel(Buffer.from([31]))).toBe(1);
    expect(plzLevel(Buffer.from([64]))).toBe(3); //  0b010_00000 (never shipped)
    expect(plzLevel(Buffer.from([0xff]))).toBe(8); // the raw-file first byte (4.plz)
  });

  test("THE RAW GATE: rawLen < 0x80 -> verbatim, no dispatch (4.plz shape)", () => {
    // payload[0] = 0xff would dispatch as level 8 = reject — but the gate
    // comes first (loader 0x90E644), exactly like the shipped 4.plz.
    const payload = Buffer.from([0xff, 0, 0, 0, 0xaa, 0xbb, 0xcc, 0xdd]);
    expect(payload.length).toBeLessThan(PLZ_RAW_THRESHOLD);
    const f = makePlzFile({ rawLen: payload.length, payload });
    const res = decodePlz(f);
    expect(res.raw).toBe(true);
    expect(res.level).toBeNull();
    expect([...res.out]).toEqual([...payload]);
  });

  test("dispatch rejection: level >= 3 throws (dispatcher returns 0)", () => {
    const payload = Buffer.concat([Buffer.from([64]), Buffer.alloc(200)]); // level 3
    const f = makePlzFile({ rawLen: 200, payload });
    expect(plzLevel(payload)).toBe(3);
    expect(() => decodePlz(f)).toThrow(/unsupported level 3/);
  });

  test("dispatch routes rawLen >= 0x80 streams to the level decoder", () => {
    const bytes = Buffer.alloc(130).map((_, i) => (i * 7) & 0xff);
    // level-2 stream: first ctrl carries the 0b001 tag (masked back by the decoder)
    const p2 = literalPayload(bytes, 2);
    expect(p2[0]).toBe(31 | 0x20);
    const r2 = decodePlz(makePlzFile({ w: 130, h: 1, rawLen: 130, payload: p2 }));
    expect(r2.raw).toBe(false);
    expect(r2.level).toBe(2);
    expect(Buffer.compare(r2.out, bytes)).toBe(0);
    // level-1 stream: first ctrl top bits 000 -> dispatcher 0x422980
    const p1 = literalPayload(bytes, 1);
    expect(p1[0]).toBe(31);
    const r1 = decodePlz(makePlzFile({ w: 130, h: 1, rawLen: 130, payload: p1 }));
    expect(r1.level).toBe(1);
    expect(Buffer.compare(r1.out, bytes)).toBe(0);
  });

  test("level-1 vectors: literal, match, RLE, the SINGLE ext byte", () => {
    // literal
    expect([...decodePlz1(Buffer.from([4, 1, 2, 3, 4, 5]), 5)]).toEqual([1, 2, 3, 4, 5]);
    // literal chain: ctrl bytes re-read while input remains
    expect([...decodePlz1(Buffer.from([2, 1, 2, 3, 2, 4, 5, 6]), 6)])
      .toEqual([1, 2, 3, 4, 5, 6]);
    // match: ctrl 64 = len 1, hi 0; low 3 -> dist 4; +3 written
    expect([...decodePlz1(Buffer.from([3, 0xaa, 0xbb, 0xcc, 0xdd, 64, 3]), 8)])
      .toEqual([0xaa, 0xbb, 0xcc, 0xdd, 0xaa, 0xbb, 0xcc, 0xdd]);
    // RLE: low 0 -> dist 1 -> repeat last byte (total = len + 3)
    expect([...decodePlz1(Buffer.from([0, 0xee, 0x40, 0x00]), 5)])
      .toEqual([0xee, 0xee, 0xee, 0xee, 0xee]);
    // ext len: ctrl 224 -> len 6; ONE ext byte 3 -> len 9; dist 1 -> +12 of p3
    const p = [0xaa, 0xbb, 0xcc, 0xdd];
    expect([...decodePlz1(Buffer.from([3, ...p, 224, 3, 0]), 16)])
      .toEqual([...p, ...Array(12).fill(0xdd)]);
    // bounds failure -> throw (the asm returns 0 at 0x422B44)
    expect(() => decodePlz1(Buffer.from([31, ...Buffer.alloc(32)]), 20)).toThrow(/out-lit/);
    // back: payload[0] is masked (always a literal); the MATCH is ctrl 0x40
    // on a later byte: len 1, low 5 -> dist 6 > op 1 -> underflow
    expect(() => decodePlz1(Buffer.from([0x00, 0xaa, 0x40, 0x05]), 16)).toThrow(/back/);
  });

  test("level-2 vectors: literal, ext-len 0xff chain, ext-dist BE16+0x1fff+1", () => {
    // ext-len: ctrl 224 -> len 6; bytes 0xff,0x05 -> len 266; dist 1
    const prefix = Buffer.alloc(32, 0x77);
    const res2 = decodePlz2(Buffer.concat([
      Buffer.from([31]), prefix, Buffer.from([224, 0xff, 0x05, 0x00]),
    ]), 32 + 269);
    expect(res2.length).toBe(301);
    expect(res2.subarray(0, 32).equals(prefix)).toBe(true);
    expect([...new Set(res2.subarray(32))]).toEqual([0x77]); // RLE of last byte
    // ext-dist: ctrl 255 -> len 6 (ext byte 0x00), hi 0x1f00, low 0xff ->
    // dist = BE16 + 0x1fff + 1 = 0x2001 = 8193 -> copies out[0..8]
    const big = literalPayload(Buffer.alloc(8193, 0x5a));
    const stream = Buffer.concat([big, Buffer.from([255, 0x00, 0xff, 0x00, 0x01])]);
    const r = decodePlz2(stream, 8193 + 9);
    expect(r.length).toBe(8202);
    expect([...r.subarray(8193)]).toEqual(Array(9).fill(0x5a));
    // back-bounds failure -> throw (asm return 0 at 0x423214): after the
    // 10-byte literal, ctrl 0x40 with low 10 -> dist 11 > op 10 -> underflow
    expect(() => decodePlz2(Buffer.concat([literalPayload(Buffer.alloc(10)), Buffer.from([0x40, 0x0a])]), 100))
      .toThrow(/back/);
  });
});

describe.skipIf(!hasData)("plz census + splice paint law (dig #168, measured)", () => {
  test("every shipped spliced .plz decodes exactly through the gate+dispatch pipeline", async () => {
    const { decodePlz } = await import("../../mapgen/lib/plz.mjs");
    const root = path.join(DATA_DIR, "biome_impl/spliced");
    const files = [];
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".plz")) files.push(p);
      }
    })(root);
    const census = { raw: 0, L1: 0, L2: 0, other: 0 };
    for (const f of files) {
      const res = decodePlz(fs.readFileSync(f));
      const kind = res.raw ? "raw" : res.level === 1 ? "L1" : res.level === 2 ? "L2" : "other";
      census[kind]++;
      expect(res.out.length, f).toBe(res.header.rawLen);
    }
    expect(files.length).toBe(97);
    // 90 FastLZ-2 + 6 FastLZ-1 + 1 verbatim (lavalake2/4.plz, rawLen 32 < 128)
    expect(census).toEqual({ raw: 1, L1: 6, L2: 90, other: 0 });
  });

  test("mountain_lake 0.plz decodes byte-identical to mountain_lake.png (262144/262144)", async () => {
    const { decodePlz } = await import("../../mapgen/lib/plz.mjs");
    const { readPng } = await import("../../mapgen/lib/images.mjs");
    const res = decodePlz(fs.readFileSync(path.join(DATA_DIR, "biome_impl/spliced/mountain_lake/0.plz")));
    const png = readPng(path.join(DATA_DIR, "biome_impl/spliced/mountain_lake.png"));
    expect([res.header.w, res.header.h]).toEqual([png.width, png.height]);
    let match = 0;
    for (let q = 0; q < png.data.length; q += 4) {
      if (res.out[q] === png.data[q] && res.out[q + 1] === png.data[q + 1] &&
          res.out[q + 2] === png.data[q + 2] && res.out[q + 3] === png.data[q + 3]) match++;
    }
    expect(match).toBe(262144);
  });

  test("lavalake2/4.plz = the raw-gate file: verbatim cells match the art at its xml pos", async () => {
    const { decodePlz } = await import("../../mapgen/lib/plz.mjs");
    const { readPng } = await import("../../mapgen/lib/images.mjs");
    const dir = path.join(DATA_DIR, "biome_impl/spliced");
    const xml = fs.readFileSync(path.join(dir, "lavalake2.xml"), "utf-8");
    const entry = xml.match(/material_filename="[^"]*lavalake2\/4\.plz" pos_x="(-?\d+)" pos_y="(-?\d+)"/);
    expect(entry).not.toBeNull();
    const res = decodePlz(fs.readFileSync(path.join(dir, "lavalake2/4.plz")));
    expect(res.raw).toBe(true);
    expect(res.header.rawLen).toBe(32); // 4x2 cells, compLen == rawLen
    // art origin (2048, 0): the fragment at pos (x, y) = art pixels (x-2048, y)
    const ox = Number(entry[1]) - 2048, oy = Number(entry[2]);
    const png = readPng(path.join(dir, "lavalake2.png"));
    let match = 0;
    for (let y = 0; y < res.header.h; y++) {
      for (let x = 0; x < res.header.w; x++) {
        const v = 4 * (y * res.header.w + x);
        const q = 4 * ((oy + y) * png.width + (ox + x));
        if (res.out[v] === png.data[q] && res.out[v + 1] === png.data[q + 1] &&
            res.out[v + 2] === png.data[q + 2] && res.out[v + 3] === png.data[q + 3]) match++;
      }
    }
    expect(match).toBe(8);
  });

  test("THE PAINT-CLASSIFICATION LAW: mountain_lake art = air 56209 / miss 104075 / hit 79000 / black 22860", async () => {
    const { readPng } = await import("../../mapgen/lib/images.mjs");
    const { loadMaterials } = await import("../../mapgen/lib/colorize.mjs");
    const img = readPng(path.join(DATA_DIR, "biome_impl/spliced/mountain_lake.png"));
    const materials = loadMaterials(DATA_DIR);
    let air = 0, black = 0, miss = 0, hit = 0;
    const hitNames = new Map();
    for (let q = 0; q < img.data.length; q += 4) {
      if (img.data[q + 3] < 10) { black++; continue; }
      const r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
      if (r === 0 && g === 0 && b === 0) { black++; continue; }
      const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      const m = materials.get(hex);
      if (!m) { miss++; continue; } // raw art detail: the cell keeps its content
      if (m === "air") { air++; continue; }
      hit++;
      hitNames.set(m, (hitNames.get(m) ?? 0) + 1);
    }
    expect({ air, miss, hit, black }).toEqual({
      air: 56209, miss: 104075, hit: 79000, black: 22860,
    });
    expect([...hitNames].sort()).toEqual([["rock_hard", 18540], ["water", 60460]]);
    // materials.xml has no 000000 key: pure black = a miss by lookup too
    expect(materials.get("000000") ?? null).toBeNull();
  });

  test("THE SPLICE COUNT LAW (dig #170): chunk 40,62 band-fills the grey placeholder, keeps the below-shows cells unset", async () => {
    const { blitSplicedScenes, TEMPLATE_SHADES } = await import("../../mapgen/lib/template-render.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const { loadMaterials, MATERIAL_SHADE, SHADES } = await import("../../mapgen/lib/colorize.mjs");
    const { readPng } = await import("../../mapgen/lib/images.mjs");

    // SCOPED PIN (dig #168, re-measured dig #170): chunk 40,62's FULL
    // renderTemplateWorld content == a splice-only blit into a fresh map,
    // byte-identical — measured by
    // mapgen/experiments/2026-10-18-splice-chunk-equiv.mjs (M: byteEqual
    // true; both laws, same config+seed args). The full render is ONE ~50 s
    // sync span — right at vitest single-fork's 60 s worker-RPC cliff (the
    // I36 `Timeout calling "onTaskUpdate"` class) — so the count law pins
    // blitSplicedScenes directly. No other pass touches the chunk
    // (biomeAt(40,62) = the_end, template:false; the extension leaves
    // non-lava/tower/wall/lake defs void).
    const config = loadBiomeConfig(DATA_DIR);
    const buffers = new Map();
    blitSplicedScenes(buffers, DATA_DIR, config, 78633191);
    const buf = buffers.get("40,62"); // world (2560,0): +35/+62 canvas key
    expect(buf).toBeDefined();

    let unset = 0;
    let paintedTotal = 0;
    const painted = new Map();
    const key = (i) => (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2];
    for (let i = 0; i < buf.length; i += 3) {
      if (buf[i] === 9 && buf[i + 1] === 9 && buf[i + 2] === 9) { unset++; continue; }
      paintedTotal++;
      const k = key(i);
      painted.set(k, (painted.get(k) ?? 0) + 1);
    }
    // dig #170 (the grey-fill law, C145 fix B): mountain_lake's own
    // 104002 pure-grey px (alpha>=10 — there are NO grey px at alpha
    // 10..127) fill with the hosting biome's shades, PLUS 651
    // fill-THROUGH cells: lavalake2.png (2560x2392 at game (2048,0),
    // blitted BEFORE mountain_lake, SPLICE_PNGS order) overlaps this
    // chunk, and its grey->band fill lands under mountain_lake's
    // below-shows cells (transparent 56209 + black 22860 + non-grey miss
    // 73 = 79142 skip cells, of which 651 keep lavalake2's fill; M: the
    // per-cell attribution instrument is this test's own blit-vs-art scan,
    // and mapgen/experiments/2026-10-19-dig170-lake-band-counts.mjs
    // reproduces the totals). Hence unset = 79142 - 651 = 78491 and fill
    // = 104002 + 651 = 104653. OLD law (grey = keep-content for BOTH
    // scenes): unset 183144 / fill 0 → FAILS these pins by construction.
    //
    // dig #172 re-pins painted.size: the fill is now the game's driver law
    // (classify(surfaceField) — noise-terrain surfaceFillLane), so the
    // distinct-color count = 4 water + 3 rock_hard (the art hits, same as
    // #170) + the lane's classify shades: 3 sand (95,87,49 / 132,114,54 /
    // 62,69,85 — the dark sand_static family per the capture census) +
    // 2 soil (70,65,40 / 64,58,41) + 4 coal (the RARE comp's polka arm,
    // 25 px — the byte law's rare path riding along). FAIL-UNDER-OLD: the
    // #170 fill gave 12 (5 fbm shades incl. the fallback slab 90,90,95 /
    // 80,80,85, NO soil, NO dark sand) — the two family assertions below
    // fail that arithmetic directly.
    expect(unset).toBe(78491);
    expect(painted.size).toBe(16); // 4 water + 3 rock_hard + 3 sand + 2 soil + 4 coal
    // the law, not the incidental count: the fill paints the classifying
    // MATERIALS' shades (soil + the dark sand here) and never the fallback
    // slab (the old law's 90,90,95 / 80,80,85 family)
    expect(painted.has(0x464128), "the soil shade (70,65,40) is painted").toBe(true);
    expect(painted.has(0x5f5731), "the dark sand shade (95,87,49) is painted").toBe(true);
    expect(painted.has(0x5a5a5f) || painted.has(0x505055), "no fallback slab colors").toBe(false);

    // the raw-art miss colors must never reach the buffer (the dig #168
    // guard; still 0 under the #170 fill — the fill paints MATERIAL shades,
    // never the art's own RGB)
    const img = readPng(path.join(DATA_DIR, "biome_impl/spliced/mountain_lake.png"));
    const materials = loadMaterials(DATA_DIR);
    const missHex = new Set();
    for (let q = 0; q < img.data.length; q += 4) {
      if (img.data[q + 3] < 10) continue;
      const r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
      if (r === 0 && g === 0 && b === 0) continue;
      const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      if (!materials.get(hex)) missHex.add(hex);
    }
    let missPainted = 0;
    for (let i = 0; i < buf.length; i += 3) {
      if (missHex.has(key(i).toString(16).padStart(6, "0"))) missPainted++;
    }
    expect(missPainted).toBe(0); // OLD law (pre-#168): 104075 -> FAILS

    // the hit cells paint their wang material's shades, exact counts
    // (dig #168 pins, unchanged by #170)
    const inSet = (set) => {
      let n = 0;
      for (let i = 0; i < buf.length; i += 3) if (set.has(key(i))) n++;
      return n;
    };
    const waterSet = new Set(
      (SHADES[MATERIAL_SHADE.get("water")] ?? []).map((s) =>
        (s.rgb[0] << 16) | (s.rgb[1] << 8) | s.rgb[2])
    );
    const rockSet = new Set(
      TEMPLATE_SHADES.rock_hard.map((s) => (s.rgb[0] << 16) | (s.rgb[1] << 8) | s.rgb[2])
    );
    expect(inSet(waterSet)).toBe(60460);
    expect(inSet(rockSet)).toBe(18540);
    // the dig #170 fill count: everything painted beyond the art hits
    expect(paintedTotal - 60460 - 18540).toBe(104653);
  });
});
