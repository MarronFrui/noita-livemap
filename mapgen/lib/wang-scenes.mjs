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
//   - the call = name(x, y) with (x, y) = the engine's spawn-record position
//     10·t − 5 − G (0x909370, C191; see areaSceneCalls below).
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

// The engine's platform raytrace (C194; X226): the binding 0x7edc90 reads the
// four args as f32 and pre-sets out = (0, 0); the tracer 0x66bfb0 steps a unit
// vector from p1, testing each NEW integer cell (trunc, toward zero) with the
// predicate, while |pos − p1|² < min(round(|d|²), 2^20), at most 1024 steps:
//   - |d|² rounds to 0: out = p1, hit = blocks(trunc p2);
//   - a blocking cell: hit, out = the last position whose cell passed (p1 if
//     the first new cell blocks);
//   - the walk ends: miss, out = p2; > 1024 steps: miss, out stays (0, 0).
// Returns [did_hit, hit_x, hit_y].
export function raytracePlatforms(x1, y1, x2, y2, blocks) {
  const f = Math.fround;
  x1 = f(x1); y1 = f(y1); x2 = f(x2); y2 = f(y2);
  const dx = f(x2 - x1), dy = f(y2 - y1);
  const len2 = f(f(dx * dx) + f(dy * dy));
  const n = Math.trunc(f(len2 + 0.5));
  const len = f(Math.sqrt(len2));
  const ux = len > 0 ? f(dx / len) : 0, uy = len > 0 ? f(dy / len) : 0;
  if (n <= 0) return [!!blocks(Math.trunc(x2), Math.trunc(y2)), x1, y1];
  const lim = f(Math.min(n, 0x100000));
  let px = x1, py = y1, lastX = x1, lastY = y1;
  const d2 = () => { const a = f(px - x1), b = f(py - y1); return f(f(a * a) + f(b * b)); };
  for (let i = 1; d2() < lim; i++) {
    if (i > 0x400) return [false, 0, 0];
    px = f(px + ux); py = f(py + uy);
    const cx = Math.trunc(px), cy = Math.trunc(py);
    if (cx === Math.trunc(lastX) && cy === Math.trunc(lastY)) continue;
    if (blocks(cx, cy)) return [true, lastX, lastY];
    lastX = px; lastY = py;
  }
  return [false, x2, y2];
}

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
    // RaytracePlatforms (0x8227d0 → 0x7edc90 → the tracer 0x66bfb0, C194):
    // the byte-exact walk; the cell predicate ("a cell a character can stand
    // on") = this.blocksAt(x, y) when a terrain probe is attached, else
    // nothing blocks (A22: the init lane runs before the terrain exists) ⇒
    // the engine's miss output (false, x2, y2).
    this.blocksAt = null;
    reg("RaytracePlatforms", (Ls) =>
      raytracePlatforms(argNum(Ls, 1), argNum(Ls, 2), argNum(Ls, 3), argNum(Ls, 4), this.blocksAt ?? (() => false)));
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
    // the per-chunk init's background pieces (template-render's lane)
    this.backdrops = [];
    reg("LoadBackgroundSprite", (Ls) => {
      this.backdrops.push({ fn: this.current, bg: argStr(Ls, 1), x: argNum(Ls, 2), y: argNum(Ls, 3) });
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
  // call name(x, y, ...extra) — returns false when the global is not a
  // function (the per-chunk init takes (x, y, w, h))
  call(name, x, y, ...extra) {
    const L = this.L;
    lua.lua_getglobal(L, to_luastring(name));
    if (lua.lua_type(L, -1) !== lua.LUA_TFUNCTION) {
      lua.lua_pop(L, 1);
      return false;
    }
    this.current = name;
    pushJs(L, x);
    pushJs(L, y);
    for (const v of extra) pushJs(L, v);
    if (lua.lua_pcall(L, 2 + extra.length, 0, 0) !== lua.LUA_OK) {
      if (this.errors.length < 50) this.errors.push(`${name}(${x},${y}): ${to_jsstring(lua.lua_tostring(L, -1) ?? to_luastring("?"))}`);
      lua.lua_pop(L, 1);
    }
    this.current = null;
    return true;
  }
}

// Spawn triggers inside a placed pixel-scene image: the engine's spawn pass also walks the material image of a spliced /
// fixed scene — a px whose colour is registered in the HOSTING biome's spawn
// table calls that function at the px's world position (the spliced tree.png
// carries one 0xc2d0b4 px = mountain_tree.lua's spawn_pillars: the six
// pillars above the tree). `scenes` = [{ file, x, y }] in world px;
// hostFor(world px x, y) -> a WangLuaHost | null (the biome there).
// Returns the LoadPixelScene records the calls made.
export function sceneImageSpawnCalls(dataDir, scenes, hostFor, readImage) {
  const out = [];
  for (const sc of scenes) {
    const img = readImage(sc.file);
    if (!img) continue;
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        const q = 4 * (j * img.width + i);
        if (img.data[q + 3] < 128) continue;
        const c = (img.data[q] << 16) | (img.data[q + 1] << 8) | img.data[q + 2];
        if (c === 0 || c === INIT_COLOR) continue;
        const host = hostFor(sc.x + i, sc.y + j);
        const name = host?.table.get(c);
        if (!name) continue;
        const before = host.scenes.length;
        host.call(name, sc.x + i, sc.y + j);
        out.push(...host.scenes.slice(before));
      }
    }
  }
  return out;
}

// The scene calls for one area. `raw` = the area's out_map (RGB, w×h, the
// generator's accepted attempt — rawAreaMap), `host` = the biome's Lua host.
//
// The call position = the engine's spawn-record law (0x909370, the wang
// spawn collector; C191): per wang cell t of the biome's map-wide image,
// world_pos = (10·tx − 5 − (int)G2, 10·ty − 5 − (int)G1) with G2 = 17920,
// G1 = 7168 (C170) — the record's {x, y} is what CallSpawnFunction hands the
// Lua function (and so what ProceduralRandom(x, y) seeds on). The area's
// out_map pixel i sits at global cell tx = trunc(x1·51.2) + i (the per-term
// GetWidthFromPix frame, world-gen widthCells). This differs from the
// generator frame `(x1 − 35)·512 + 10·i` by 5..13 px, enough to reseed
// every ProceduralRandom pick. The record position is the game cell's
// origin: the bin content samples P through the C167 ±1 snap (rounding), so
// cell t covers [10·t − 5, 10·t + 5) − G (I60). The returned scenes are
// translated into the GENERATOR frame the bin lane renders (cell i at
// (x1 − 35)·512 + 10·i), keeping the game's zero offset from the trigger
// cell; `callX/callY` = the game-frame position.
export const SPAWN_G2 = 17920, SPAWN_G1 = 7168;
export function spawnCallOrigin(x1, y1) {
  return {
    x: 10 * Math.trunc((x1 * 512) / 10) - 5 - SPAWN_G2,
    y: 10 * Math.trunc((y1 * 512) / 10) - 5 - SPAWN_G1,
  };
}
export function areaSceneCalls(host, a, raw) {
  const before = host.scenes.length;
  const call = spawnCallOrigin(a.area.x1, a.area.y1);
  // generator-frame cell origin − game-frame cell origin (5..13 px per axis)
  const dx = (a.area.x1 - 35) * 512 - call.x, dy = (a.area.y1 - 14) * 512 - call.y;
  const { w, h, rgb } = raw;
  let calls = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = 3 * (j * w + i);
      const c = (rgb[p] << 16) | (rgb[p + 1] << 8) | rgb[p + 2];
      if (c === INIT_COLOR) continue;
      const name = host.table.get(c);
      if (!name) continue;
      if (host.call(name, call.x + 10 * i, call.y + 10 * j)) calls++;
    }
  }
  const scenes = host.scenes.slice(before).map((s) => ({ ...s, callX: s.x, callY: s.y, x: s.x + dx, y: s.y + dy }));
  return { calls, scenes };
}
