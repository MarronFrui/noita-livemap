#!/usr/bin/env node
// I15 (mapgen/ISSUES.md): missing-elements inventory.
//
// Walks the game's own data (biome XMLs -> lua scripts -> wang_scripts.csv)
// and inventories every element class per biome, then classifies each as
// RENDERED / PARTIAL / VISUAL-ONLY / MISSING by our genmap pipeline.
//
// Answers "which element produced this anomaly" by lookup: when the map shows
// noise or a hole, find the biome in the report and see which element class
// we don't render there.
//
// Sources (verified on disk this session):
// - data/biome/*.xml          — Topology (wang_template_file, lua_script)
//                               + Materials + RandomMaterials
// - data/scripts/biomes/*.lua — RegisterSpawnFunction(0xAARRGGBB, name),
//                               g_* tables with material_file/visual_file
//                               (LoadPixelScene) + entity files
// - data/scripts/wang_scripts.csv — wang tile trigger color -> spawn function
// - data/biome/_pixel_scenes.xml  — global spliced scenes + background images
//
// Output: mapgen/out/inventory.md (+ JSON to stdout optional).

import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";

const dataDir = process.env.NOITA_DATA_DIR || findNoitaDataDir();

// ------------------------------------------------------------ color helpers
const rgbaIntToHex = (int) => (int >>> 0).toString(16).padStart(8, "0");

// Element classes recognized from wang_scripts.csv + RegisterSpawnFunction.
// What our pipeline renders today (template-render.mjs / colorize.mjs):
//  - trigger colors -> air (spawn-band consumed, nothing drawn)
//  - 0x9678xx structure loaders -> air (entity props NOT drawn — invisible)
//  - pixel scenes via load_pixel_scene/load_pixel_scene2 -> blitScene
//    (material PNG -> material shades, visual PNG overlay)
const ENTITY_CLASSES = new Set([
  "spawn_small_enemies", "spawn_big_enemies", "spawn_items", "spawn_props",
  "spawn_props2", "spawn_props3", "spawn_lamp", "spawn_unique_enemy",
  "spawn_unique_enemy2", "spawn_unique_enemy3", "spawn_ghostlamp",
  "spawn_candles", "spawn_potion_altar", "spawn_potions", "spawn_apparition",
  "spawn_heart", "spawn_wands", "spawn_portal", "spawn_end_portal",
  "spawn_orb", "spawn_perk", "spawn_all_perks", "spawn_wand_trap",
  "spawn_wand_trap_ignite", "spawn_wand_trap_electricity_source",
  "spawn_wand_trap_electricity", "spawn_moon", "spawn_collapse",
  "load_structures", "load_large_structures", "load_i_structures",
]);

// --------------------------------------------------------------- XML parser
function parseBiomeXml(file) {
  const txt = fs.readFileSync(file, "utf-8");
  const topology = txt.match(/<Topology\b[\s\S]*?(\/>|<\/Topology>)/)?.[0] ?? "";
  const attr = (name) => topology.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`))?.[1];
  const materials = [...txt.matchAll(/<Material\s+([^>]*?)\/?>/g)].map((m) => {
    const a = (n) => m[1].match(new RegExp(`${n}\\s*=\\s*"([^"]*)"`))?.[1];
    return {
      name: a("name"),
      min: parseFloat(a("min") ?? "0"),
      max: parseFloat(a("max") ?? "0"),
      rare: (a("rare") ?? "0") === "1",
    };
  });
  const randomColors = [...txt.matchAll(/<RandomColor\s+([^>]*?)\/?>/g)].map((m) => {
    const a = (n) => m[1].match(new RegExp(`${n}\\s*=\\s*"([^"]*)"`))?.[1];
    return { input: a("input_color"), output: a("output_colors") };
  });
  return {
    file: path.basename(file),
    type: attr("type"),
    lua: attr("lua_script"),
    templateFile: attr("wang_template_file"),
    materials,
    randomColors,
  };
}

// --------------------------------------------------------------- lua parser
function parseBiomeLua(file) {
  const txt = fs.readFileSync(file, "utf-8");
  const registered = [...txt.matchAll(/RegisterSpawnFunction\(\s*(0x[0-9a-fA-F]+)\s*,\s*"([^"]+)"\s*\)/g)]
    .map((m) => ({ color: rgbaIntToHex(parseInt(m[1], 16)), fn: m[2] }));
  // g_* pixel-scene tables: entries with material_file/visual_file
  const scenes = [];
  for (const tbl of txt.matchAll(/g_(\w+)\s*=\s*\{/g)) {
    const name = tbl[1];
    const start = tbl.index + tbl[0].length;
    let depth = 1, i = start;
    while (depth > 0 && i < txt.length) {
      if (txt[i] === "{") depth++;
      else if (txt[i] === "}") depth--;
      i++;
    }
    const body = txt.slice(start, i - 1);
    for (const e of body.matchAll(/material_file\s*=\s*"([^"]+)"/g)) {
      scenes.push({ table: `g_${name}`, material: e[1] });
    }
  }
  // entity files referenced anywhere (props/structures/enemies)
  const entities = [...new Set(
    [...txt.matchAll(/entity\s*=\s*"([^"]+\.xml)"/g)].map((m) => m[1])
  )];
  return { registered, scenes, entities };
}

// ------------------------------------------------------------ wang scripts
function parseWangScripts(file) {
  const rows = fs.readFileSync(file, "utf-8").split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
  const map = new Map();
  for (const row of rows) {
    const [color, fn] = row.split(",");
    map.set(color.toLowerCase(), fn);
  }
  return map;
}

// -------------------------------------------------------------------- main
const wangScripts = parseWangScripts(path.join(dataDir, "scripts/wang_scripts.csv"));
const biomeDir = path.join(dataDir, "biome");
const biomeFiles = fs.readdirSync(biomeDir).filter((f) => f.endsWith(".xml") && !f.startsWith("_"));

const report = [];
for (const bf of biomeFiles.sort()) {
  const xml = parseBiomeXml(path.join(biomeDir, bf));
  const entry = {
    biome: xml.file,
    type: xml.type,
    wang: xml.templateFile ? path.basename(xml.templateFile) : null,
    lua: xml.lua ? path.basename(xml.lua) : null,
    randomColors: xml.randomColors.length,
    materials: xml.materials.length,
    spawnFns: [],
    pixelScenes: [],
    entities: [],
    wangColors: [],
  };
  if (xml.lua) {
    const luaPath = path.join(dataDir, xml.lua.replace(/^data\//, ""));
    if (fs.existsSync(luaPath)) {
      const lua = parseBiomeLua(luaPath);
      entry.spawnFns = lua.registered;
      entry.pixelScenes = lua.scenes;
      entry.entities = lua.entities;
      // which wang trigger colors map to registered functions
      for (const [color, fn] of wangScripts) {
        if (lua.registered.some((r) => r.fn === fn)) entry.wangColors.push(color);
      }
    }
  }
  report.push(entry);
}

// ------------------------------------------------------------ render status
// Per-element-class verdict against our pipeline (mapgen/lib/template-render.mjs):
//   RENDERED   = we draw real content (pixel scenes, material fills)
//   AIR-HOLE   = trigger color consumed -> air; nothing drawn (entity classes)
//   PARTIAL    = some paths drawn, others not
//   NOT-APPL   = element class not used by this biome
const verdictFor = (entry) => {
  const classes = [];
  const sceneCount = entry.pixelScenes.length;
  const hasScenes = sceneCount > 0;
  for (const r of entry.spawnFns) {
    let status;
    if (r.fn.startsWith("load_pixel_scene")) status = hasScenes ? "RENDERED" : "PARTIAL";
    else if (ENTITY_CLASSES.has(r.fn)) status = "AIR-HOLE"; // registered but invisible
    else status = "PARTIAL"; // custom fn we don't port (vines, fungi, ...)
    classes.push({ ...r, status });
  }
  return classes;
};

// ----------------------------------------------------------------- emit md
const out = [];
out.push("# Missing-elements inventory (I15)\n");
out.push(`> Generated by \`mapgen/experiments/2026-09-17-element-inventory.mjs\` from game data at \`${dataDir}\`.`);
out.push("> Verdicts: RENDERED = pipeline draws it · AIR-HOLE = trigger consumed, nothing drawn · PARTIAL = not ported.\n");

const byStatus = { "RENDERED": 0, "AIR-HOLE": 0, "PARTIAL": 0 };
let totalEls = 0;
for (const entry of report) {
  const classes = verdictFor(entry);
  if (classes.length === 0 && entry.pixelScenes.length === 0) continue;
  out.push(`## ${entry.biome} (${entry.type ?? "?"})\n`);
  out.push(`- wang template: \`${entry.wang}\` · lua: \`${entry.lua}\``);
  out.push(`- materials: ${entry.materials} · randomColor placeholders: ${entry.randomColors}`);
  if (entry.pixelScenes.length) {
    out.push(`- pixel scenes (${entry.pixelScenes.length}):`);
    for (const s of entry.pixelScenes) out.push(`  - ${s.table}: \`${s.material}\``);
  }
  if (classes.length) {
    out.push(`- spawn functions (wang trigger colors):`);
    for (const c of classes) {
      byStatus[c.status]++;
      totalEls++;
      out.push(`  - \`${c.color}\` → ${c.fn} — **${c.status}**`);
    }
  }
  if (entry.entities.length) {
    out.push(`- entities (${entry.entities.length}): ${entry.entities.slice(0, 8).map((e) => `\`${path.basename(e)}\``).join(", ")}${entry.entities.length > 8 ? " …" : ""}`);
  }
  out.push("");
}

out.push(`\n## Totals\n`);
out.push(`| status | count |`);
out.push(`| ------ | ----- |`);
for (const [k, v] of Object.entries(byStatus)) out.push(`| ${k} | ${v} |`);
out.push(`| total | ${totalEls} |`);

const outDir = path.join(repoRoot, "mapgen/out");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "inventory.md");
fs.writeFileSync(outPath, out.join("\n") + "\n");

console.log(`Wrote ${outPath}`);
console.log(`Biomes scanned: ${report.length}, elements classified: ${totalEls}`);
const summary = Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(" ");
console.log(summary);
