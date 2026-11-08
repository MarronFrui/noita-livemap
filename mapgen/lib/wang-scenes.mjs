// The wang SPAWN-SCENE lane — the art the game loads INTO the wang layers.
//
// The wang fill (generate-exact.mjs) yields the area's out_map; the game then
// walks every out_map pixel and, when its colour is a registered spawn colour,
// calls the biome script's Lua function at that cell's world position. A
// family of those functions LoadPixelScene() pre-drawn art into the world —
// the blocked-out rooms (has-path.mjs blockOutRooms: the oil tanks, coal pits,
// shrines, gunpowder pools, puzzle rooms) and the free-standing structures
// (load_structures, load_pillar, load_catwalk, the snowcastle panels, the
// crypt's background scenes…). Without this lane those cells render as the
// bare black room the template leaves for the art (the "missing tiles").
//
// Law (all from the game's own files, nothing fitted):
//   - colour → function table = data/scripts/wang_scripts.csv (the engine's
//     defaults: ffff0aff load_pixel_scene, ffff0080 load_pixel_scene2, …)
//     overridden by the biome script's RegisterSpawnFunction(colour, name);
//     0xffffeedd "init" = the per-chunk init, owned by template-render.mjs.
//   - the call = name(x, y) with (x, y) = the cell's world position:
//     (area.x1 − 35)·512 + 10·i, (area.y1 − 14)·512 + 10·j (the frame the
//     hasPath main-path window uses, generate-exact's worldX/worldY).
//   - the functions run as the REAL biome Lua (fengari VM), with the engine
//     API the scene path needs backed by the byte-exact ports: SetRandomSeed /
//     Random / ProceduralRandom* = wang-js.mjs seededPrng (the Lua-oracle-
//     validated SetRandomSeed port), arities per the exe's own API doc strings
//     (Random(): float, Random(a): int 0..a, Random(a,b): int a..b;
//     ProceduralRandom(x,y): float, (x,y,a): int 0..a, (x,y,a,b): a..b).
//   - LoadPixelScene(mat, vis, x, y, bg, …, load_even_if_duplicate = false):
//     recorded; a repeat of the same (mat, vis, x, y) is dropped (the
//     duplicate rule in the signature).
//   - every other engine call (EntityLoad, …) = a no-op (CamelCase globals
//     resolve to a stub; entities are not map pixels).
// Known approximation: the call ORDER (row-major per area, areas in
// world.areas order) stands in for the game's chunk-streaming order; it only
// matters for is_unique scene tables (a unique scene is spent on first load).

import fs from "node:fs";
import path from "node:path";
import fengari from "fengari";
import { seededPrng } from "./wang-js.mjs";

const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

export const INIT_COLOR = 0xffeedd; // the per-chunk init — template-render's lane

// data/scripts/wang_scripts.csv → Map(rgb24 → function name)
export function loadWangScriptsCsv(dataDir) {
  const out = new Map();
  let txt = "";
  try {
    txt = fs.readFileSync(path.join(dataDir, "scripts/wang_scripts.csv"), "utf-8");
  } catch {
    return out;
  }
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [col, name] = line.split(",");
    if (!col || !name) continue;
    out.set(Number.parseInt(col, 16) & 0xffffff, name.trim());
  }
  return out;
}

// ---------------------------------------------------------------- Lua host --
const pushJs = (L, v) => {
  if (v === undefined || v === null) lua.lua_pushnil(L);
  else if (typeof v === "boolean") lua.lua_pushboolean(L, v);
  else if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) < 2 ** 52) lua.lua_pushinteger(L, v);
    else lua.lua_pushnumber(L, v);
  } else lua.lua_pushstring(L, to_luastring(String(v)));
};
const argStr = (L, i) => (lua.lua_type(L, i) === lua.LUA_TSTRING ? to_jsstring(lua.lua_tostring(L, i)) : "");
const argNum = (L, i) => (lua.lua_isnumber(L, i) ? lua.lua_tonumber(L, i) : 0);

// the Lua prelude: 5.1/LuaJIT names the scripts use + the engine-stub fallback
const PRELUDE = `
unpack = unpack or table.unpack
math.pow = math.pow or function(a, b) return a ^ b end
loadstring = loadstring or load
bit = bit or {
  band = function(a, b) return a & b end, bor = function(a, b) return a | b end,
  bxor = function(a, b) return a ~ b end, lshift = function(a, b) return a << b end,
  rshift = function(a, b) return a >> b end, bnot = function(a) return ~a end,
}
setmetatable(_G, { __index = function(t, k)
  if type(k) == "string" and string.match(k, "^%u%l") then return function() end end
  return nil
end })
`;

export class WangLuaHost {
  constructor(dataDir, scriptRel, seed, engineTable) {
    this.dataDir = dataDir;
    this.seed = seed >>> 0;
    this.rng = null;
    this.scenes = [];
    this.seen = new Set();
    this.table = new Map(engineTable);
    this.errors = [];
    const L = (this.L = lauxlib.luaL_newstate());
    lualib.luaL_openlibs(L);
    this.run(PRELUDE, "prelude");
    const loaded = new Set();
    const reg = (name, fn) => {
      lua.lua_pushjsfunction(L, (Ls) => {
        const r = fn(Ls, lua.lua_gettop(Ls));
        if (Array.isArray(r)) { r.forEach((v) => pushJs(Ls, v)); return r.length; }
        if (r === undefined) return 0;
        pushJs(Ls, r);
        return 1;
      });
      lua.lua_setglobal(L, to_luastring(name));
    };
    const doFile = (Ls, once) => {
      const rel = argStr(Ls, 1);
      if (once && loaded.has(rel)) return undefined;
      loaded.add(rel);
      this.runFile(rel);
      return undefined;
    };
    reg("dofile_once", (Ls) => doFile(Ls, true));
    reg("dofile", (Ls) => doFile(Ls, false));
    reg("print", () => undefined);
    reg("print_error", () => undefined);
    reg("RegisterSpawnFunction", (Ls) => {
      this.table.set(argNum(Ls, 1) & 0xffffff, argStr(Ls, 2));
      return undefined;
    });
    reg("SetRandomSeed", (Ls) => {
      this.rng = seededPrng(this.seed, argNum(Ls, 1), argNum(Ls, 2));
      return undefined;
    });
    reg("Random", (Ls, n) => {
      this.rng ??= seededPrng(this.seed, 0, 0);
      if (n === 0) return this.rng.next();
      if (n === 1) return this.rng.random(0, Math.trunc(argNum(Ls, 1)));
      return this.rng.random(Math.trunc(argNum(Ls, 1)), Math.trunc(argNum(Ls, 2)));
    });
    reg("Randomf", (Ls, n) => {
      this.rng ??= seededPrng(this.seed, 0, 0);
      const v = this.rng.next();
      if (n === 0) return v;
      if (n === 1) return v * argNum(Ls, 1);
      const a = argNum(Ls, 1), b = argNum(Ls, 2);
      return a + (b - a) * v;
    });
    const proc = (asInt) => (Ls, n) => {
      const g = seededPrng(this.seed, argNum(Ls, 1), argNum(Ls, 2));
      if (n <= 2) return asInt ? g.random(0, 1) : g.next();
      if (n === 3) return g.random(0, Math.trunc(argNum(Ls, 3)));
      const a = argNum(Ls, 3), b = argNum(Ls, 4);
      return asInt ? g.random(Math.round(a), Math.round(b)) : a + (b - a) * g.next();
    };
    reg("ProceduralRandom", proc(false));
    reg("ProceduralRandomf", proc(false));
    reg("ProceduralRandomi", proc(true));
    reg("GetParallelWorldPosition", () => [0, 0]); // the main world
    reg("SessionNumbersGetValue", () => "0");
    reg("LoadPixelScene", (Ls) => {
      const mat = argStr(Ls, 1), vis = argStr(Ls, 2);
      const x = argNum(Ls, 3), y = argNum(Ls, 4);
      const bg = argStr(Ls, 5);
      const dupOk = lua.lua_toboolean(Ls, 10);
      const k = `${mat}|${vis}|${x}|${y}`;
      if (!dupOk && this.seen.has(k)) return undefined;
      this.seen.add(k);
      this.scenes.push({ fn: this.current, mat, vis, bg, x, y });
      return undefined;
    });
    this.runFile(scriptRel);
  }
  run(src, name) {
    const L = this.L;
    const st = lauxlib.luaL_loadbuffer(L, to_luastring(src), null, to_luastring(name));
    if (st !== lua.LUA_OK || lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK) {
      this.errors.push(`${name}: ${to_jsstring(lua.lua_tostring(L, -1) ?? to_luastring("?"))}`);
      lua.lua_pop(L, 1);
      return false;
    }
    return true;
  }
  runFile(rel) {
    let src;
    try {
      src = fs.readFileSync(path.join(this.dataDir, rel.replace(/^data\//, "")), "utf-8");
    } catch {
      this.errors.push(`missing ${rel}`);
      return false;
    }
    return this.run(src, rel);
  }
  // call name(x, y) — returns false when the global is not a function
  call(name, x, y) {
    const L = this.L;
    lua.lua_getglobal(L, to_luastring(name));
    if (lua.lua_type(L, -1) !== lua.LUA_TFUNCTION) {
      lua.lua_pop(L, 1);
      return false;
    }
    this.current = name;
    pushJs(L, x);
    pushJs(L, y);
    if (lua.lua_pcall(L, 2, 0, 0) !== lua.LUA_OK) {
      if (this.errors.length < 50) this.errors.push(`${name}(${x},${y}): ${to_jsstring(lua.lua_tostring(L, -1) ?? to_luastring("?"))}`);
      lua.lua_pop(L, 1);
    }
    this.current = null;
    return true;
  }
}

// The scene calls for one area. `raw` = the area's out_map (RGB, w×h, the
// generator's accepted attempt — rawAreaMap), `host` = the biome's Lua host.
export function areaSceneCalls(host, a, raw) {
  const before = host.scenes.length;
  const ox = (a.area.x1 - 35) * 512, oy = (a.area.y1 - 14) * 512;
  const { w, h, rgb } = raw;
  let calls = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = 3 * (j * w + i);
      const c = (rgb[p] << 16) | (rgb[p + 1] << 8) | rgb[p + 2];
      if (c === INIT_COLOR) continue;
      const name = host.table.get(c);
      if (!name) continue;
      if (host.call(name, ox + 10 * i, oy + 10 * j)) calls++;
    }
  }
  return { calls, scenes: host.scenes.slice(before) };
}
