// tests/mapgen/template-init.test.mjs — dig #219: the per-chunk init(x, y, w, h)
// runs as the real biome Lua (template-render.mjs runInitScenes), so its
// branches decide what loads.
//
// COUNT-TEST NOTE (charter: must FAIL under the old law): the old law =
// parseInitPixelScenes, a static parse that loaded EVERY LoadPixelScene line
// of the init body in every owned chunk — both side caverns in both cavern
// chunks, both lava-pit pieces in every pit chunk, the hidden cavern in all
// of its chunks. Each pin below expects ONE branch.

import { describe, test, expect } from "vitest";
import { dataDir, hasNoitaData } from "../helpers/data.mjs";
import { loadBiomeConfig, biomeAt } from "../../mapgen/lib/biomes.mjs";
import { runInitScenes } from "../../mapgen/lib/template-render.mjs";
import { seededPrng } from "../../mapgen/lib/wang-js.mjs";

const names = (run) => run.scenes.map((s) => s.mat.split("/").pop());

describe.skipIf(!hasNoitaData())("dig #219 — init() runs as Lua", () => {
  test("snowcastle_cavern: ONE side cavern per seed, chosen by ProceduralRandom(0,0) > 0.5", () => {
    const cfg = loadBiomeConfig(dataDir);
    const def = biomeAt(cfg, 30, 24).biome;
    expect(def.filename).toBe("data/biome/snowcastle_cavern.xml");
    expect(biomeAt(cfg, 38, 24).biome).toBe(def);
    // seed 78633191: 0.1159 ⇒ left (the noitamap capture: the hourglass
    // cavern in chunk (30,24), plain wall in (38,24)); seed 999999: 0.7185 ⇒ right
    expect(seededPrng(78633191, 0, 0).next()).toBeLessThan(0.5);
    expect(seededPrng(999999, 0, 0).next()).toBeGreaterThan(0.5);
    expect(names(runInitScenes(dataDir, def, 78633191, -2560, 5120))).toEqual(["side_cavern_left.png"]);
    expect(names(runInitScenes(dataDir, def, 78633191, 1536, 5120))).toEqual([]);
    expect(names(runInitScenes(dataDir, def, 999999, -2560, 5120))).toEqual([]);
    expect(names(runInitScenes(dataDir, def, 999999, 1536, 5120))).toEqual(["side_cavern_right.png"]);
  });

  test("lavalake_pit: the cracked piece only at 2000 < y < 2400, the intact one elsewhere — never both", () => {
    const cfg = loadBiomeConfig(dataDir);
    const def = biomeAt(cfg, 42, 18).biome;
    expect(def.filename).toBe("data/biome/lavalake_pit.xml");
    expect(names(runInitScenes(dataDir, def, 78633191, 3584, 2048))).toEqual(["lavalake_pit_cracked.png"]);
    for (const y of [1024, 1536, 2560]) {
      expect(names(runInitScenes(dataDir, def, 78633191, 3584, y))).toEqual(["lavalake_pit.png"]);
    }
  });

  test("solid_wall_hidden_cavern: at most ONE of its chunks loads the cavern, per seed", () => {
    const cfg = loadBiomeConfig(dataDir);
    let def = null;
    const chunks = [];
    for (let ty = 0; ty < 48; ty++) for (let tx = 0; tx < 70; tx++) {
      const d = biomeAt(cfg, tx, ty)?.biome;
      if (d && /solid_wall_hidden_cavern\.xml$/.test(d.filename)) { def = d; chunks.push([tx, ty]); }
    }
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const seed of [78633191, 78633192, 78633193, 1, 2, 3, 999999]) {
      const loads = chunks.filter(([tx, ty]) => runInitScenes(dataDir, def, seed, (tx - 35) * 512, (ty - 14) * 512).scenes.length > 0);
      expect(loads.length).toBeLessThanOrEqual(1);
    }
  });

  test("C194 rainforest: init() runs clean with RaytracePlatforms (dig #219 left 5 Lua errors) — 4 hint statues + the portal hole, statues at the ray end + the script offset (no terrain probe, A22)", async () => {
    const { WangLuaHost, loadWangScriptsCsv } = await import("../../mapgen/lib/wang-scenes.mjs");
    const h = new WangLuaHost(dataDir, "data/scripts/biomes/rainforest.lua", 78633191, loadWangScriptsCsv(dataDir));
    for (let cx = -6; cx <= 4; cx++) for (let cy = 12; cy <= 16; cy++) h.call("init", cx * 512, cy * 512, 512, 512);
    expect(h.errors).toEqual([]);
    const st = h.scenes.filter((x) => /rainforest_statue_0/.test(x.mat));
    expect(st).toHaveLength(4);
    // statue 1 left: ray (−1, 0) × 100 misses ⇒ x2 = pos_x − 100, then −20
    const left = st.find((x) => /statue_01/.test(x.mat) && x.x < 0);
    const posX = seededPrng(78633191, 87, -254).random(-2450, -2250);
    expect(left.x).toBe(posX - 100 - 20);
  });
});

// dig #225 (C143's 'air' arm in blitScene): an air-keyed art cell (wang
// 000042) is EMPTY — the backdrop / the lanes below show. The old law painted
// air's own colour (0,0,66): the dark-blue pools of the HM tops.
describe.skipIf(!hasNoitaData())("dig #225 — blitScene skips air-keyed cells", () => {
  test("altar_top.png: its 25,589 air px leave the buffer unset (old law: painted (0,0,66))", async () => {
    const { blitScene } = await import("../../mapgen/lib/template-render.mjs");
    const { readPng } = await import("../../mapgen/lib/images.mjs");
    const img = readPng(`${dataDir}/biome_impl/temple/altar_top.png`);
    let air = 0, opaque = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] < 128) continue;
      if (img.data[i] === 0 && img.data[i + 1] === 0 && img.data[i + 2] === 66) air++;
      else if (!(img.data[i] === 0 && img.data[i + 1] === 0 && img.data[i + 2] === 0)) opaque++;
    }
    expect(air).toBe(25589);
    const buffers = new Map();
    const n = blitScene(buffers, dataDir, { materialBands: [] }, "data/biome_impl/temple/altar_top.png", null, 0, 0, "t", 1);
    let blue = 0;
    for (const [, b] of buffers) for (let o = 0; o < b.length; o += 3) if (b[o] === 0 && b[o + 1] === 0 && b[o + 2] === 66) blue++;
    expect(blue).toBe(0);
    expect(n).toBeLessThanOrEqual(opaque); // the air px are not written
  });
});

// dig #226: the same air arm in the fixed-scene lane (_pixel_scenes.xml art,
// blitFixedArt) and in the wang-bin colours (colorizeArea) — air-keyed px
// are empty. A synthetic 3×1 art: air | templebrick | air.
describe.skipIf(!hasNoitaData())("dig #226 — air-keyed px are empty in blitFixedArt and the bins", () => {
  test("blitFixedArt writes only the non-air px (old law: all 3, air as (0,0,66))", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { writePng } = await import("../../mapgen/lib/images.mjs");
    const { blitFixedArt } = await import("../../mapgen/lib/template-render.mjs");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "air-"));
    fs.mkdirSync(path.join(dir, "biome_impl"), { recursive: true });
    fs.copyFileSync(path.join(dataDir, "materials.xml"), path.join(dir, "materials.xml"));
    writePng(path.join(dir, "biome_impl", "t.png"), 3, 1, Uint8Array.from([0, 0, 66, 255, 120, 108, 66, 255, 0, 0, 66, 255]));
    const buffers = new Map();
    expect(blitFixedArt(buffers, dir, "data/biome_impl/t.png", null, 0, 0)).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  test("colorizeArea: an air-keyed bin cell = the bin-air shade (old law: air's colour (0,0,66))", async () => {
    const { colorizeArea, SHADES } = await import("../../mapgen/lib/colorize.mjs");
    const m = Buffer.from([0, 0, 66, 0, 0, 66, 0, 0, 66, 0, 0, 66]);
    colorizeArea(m, 2, 2, { dataDir, biomeName: "coalmine", biomeFile: "coalmine", seed: 1, worldX0: 0, worldY0: 0 });
    const air = new Set(SHADES.airDark.map((s) => s.rgb.join()));
    for (let i = 0; i < 4; i++) expect(air.has([m[3 * i], m[3 * i + 1], m[3 * i + 2]].join())).toBe(true);
  });
});


// dig #228 (C143: an `air` hit WRITES air): a later scene's air px clears an
// earlier scene's paint at that cell (the pyramid's boss_limbs.png over
// reward.png: the radioactive cells under boss_limbs' air were left green).
describe.skipIf(!hasNoitaData())("dig #228 — an air px clears earlier paint", () => {
  test("brick then air at the same px ⇒ the cell is AIR (TPL_AIR, I62; old law: the brick stays)", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { writePng } = await import("../../mapgen/lib/images.mjs");
    const { blitFixedArt } = await import("../../mapgen/lib/template-render.mjs");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "air2-"));
    fs.mkdirSync(path.join(dir, "biome_impl"), { recursive: true });
    fs.copyFileSync(path.join(dataDir, "materials.xml"), path.join(dir, "materials.xml"));
    writePng(path.join(dir, "biome_impl", "a.png"), 1, 1, Uint8Array.from([120, 108, 66, 255]));
    writePng(path.join(dir, "biome_impl", "b.png"), 1, 1, Uint8Array.from([0, 0, 66, 255]));
    const buffers = new Map();
    blitFixedArt(buffers, dir, "data/biome_impl/a.png", null, 0, 0);
    expect(buffers.get("35,62")[0]).not.toBe(9);
    blitFixedArt(buffers, dir, "data/biome_impl/b.png", null, 0, 0);
    expect([...buffers.get("35,62").slice(0, 3)]).toEqual([9, 9, 10]); // I62: AIR is a written state (TPL_AIR), not unset
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// dig #229 (C195 in the template lane): a SOLID scene material px = C185
// (its texture at the world px) — templebrick_static was a hand family
// (79,73,50)/(81,76,52); the capture (and C185) = (81,74,49)/(64,58,41)…
describe.skipIf(!hasNoitaData())("dig #229 — scene solids take C185", () => {
  test("a templebrick px of altar_top.png = templebrick_static's texture at that world px", async () => {
    const { blitScene } = await import("../../mapgen/lib/template-render.mjs");
    const { materialColorAt } = await import("../../mapgen/lib/colorize.mjs");
    const { readPng } = await import("../../mapgen/lib/images.mjs");
    const img = readPng(`${dataDir}/biome_impl/temple/altar_top.png`);
    let px = -1; for (let i = 0; i < img.width * img.height; i++) if (img.data[4 * i] === 120 && img.data[4 * i + 1] === 108 && img.data[4 * i + 2] === 66) { px = i; break; }
    const x = px % img.width, y = Math.floor(px / img.width);
    const buffers = new Map();
    blitScene(buffers, dataDir, { materialBands: [] }, "data/biome_impl/temple/altar_top.png", null, 0, 0, "t", 1);
    const b = buffers.get("35,62"); const o = 3 * (y * 512 + x);
    expect([b[o], b[o + 1], b[o + 2]]).toEqual(materialColorAt(dataDir, "templebrick_static", x, y));
  });
});
