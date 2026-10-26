// who owns template chunk (38,62)? renderTemplateWorld's writer = the biome
// defs whose `template` is set, per their def.areas rects; the composition
// is per-chunk from the def's own scene/xml list. Print the candidates.
import { loadBiomeConfig } from '/home/marron/work/Noita-livemap/mapgen/lib/biomes.mjs';
import { findNoitaDataDir } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
const dataDir = findNoitaDataDir();
const cfg = loadBiomeConfig(dataDir);
for (const [colorInt, def] of cfg.biomes) {
  if (!def.template) continue;
  for (const a of def.areas ?? []) {
    // print rect if it plausibly touches the tree region (x 33..40, y to 15)
    if (a.x2 >= 33 && a.x1 <= 40 && a.y1 <= 15 && a.y2 >= 7) {
      console.log(`def=${def.filename} template=${def.template} area x${a.x1}..${a.x2} y${a.y1}..${a.y2}`);
    }
  }
}
