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
