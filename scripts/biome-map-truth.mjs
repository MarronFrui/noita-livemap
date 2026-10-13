// biome-map truth probe: decode biome_map.png column 35 rows 0..14 via _biomes_all.xml
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { findNoitaDataDir } from "../mapgen/lib/paths.mjs";

const dataDir = findNoitaDataDir();
const map = PNG.sync.read(fs.readFileSync(path.join(dataDir, "biome_impl/biome_map.png")));
const xml = fs.readFileSync(path.join(dataDir, "biome/_biomes_all.xml"), "utf-8");
const colors = new Map();
for (const mm of xml.matchAll(/<Biome[\s\S]*?<\/Biome>/g)) {
  const block = mm[0];
  const fn = (block.match(/filename="([^"]+)"/) ?? [])[1];
  const hexRe = block.match(/biome_color="([0-9a-fA-F]+)"/);
  if (fn && hexRe) colors.set(hexRe[1].slice(-6).toUpperCase(), fn);
}
for (let row = 0; row <= 14; row++) {
  const p = 4 * (row * map.width + 35);
  const hex = [map.data[p], map.data[p + 1], map.data[p + 2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  console.log("biome row", row, "px", hex, "→", colors.get(hex) ?? "(no biome-table entry)");
}
