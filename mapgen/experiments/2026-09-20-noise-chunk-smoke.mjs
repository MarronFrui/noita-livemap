// Renders one procedural (non-template) noise chunk through the integrated chain.
import { loadWangWorld, ensureWorld, worldColorAt, CHUNK, SKY_ROWS } from "../lib/world-gen.mjs";
import { findNoitaDataDir } from "../lib/paths.mjs";
import { biomeAt } from "../lib/biomes.mjs";
import { writePng } from "../lib/images.mjs";

const DATA = findNoitaDataDir();
const SEED = 78633191;
const world = ensureWorld(SEED, DATA, {});
await world.ready;

// find procedural chunks (grid idx<0 but biomeAt hits a non-template biome)
const proc = [];
for (let ty = 0; ty < 144; ty++) for (let tx = 0; tx < 71; tx++) {
  const at = biomeAt(world.config, tx, ty - SKY_ROWS);
  if (at && !at.biome.templateFile) proc.push({ tx, ty, name: at.biome.name });
}
const counts = {};
for (const p of proc) counts[p.name] = (counts[p.name] ?? 0) + 1;
console.log("procedural chunks by biome:", counts);
const pick = proc.find(p => /ice|desert|hills/i.test(p.name)) ?? proc[0];
console.log("picked:", pick);
const W = CHUNK, ox = pick.tx * CHUNK, oy = pick.ty * CHUNK;
const rgb = Buffer.alloc(W * CHUNK * 3);
let solid = 0;
for (let y = 0; y < CHUNK; y++) for (let x = 0; x < W; x++) {
  let c = worldColorAt(world, ox + x, oy + y);
  if (c === null) c = [18, 16, 14];
  if (c[0] === 0x1b || c[0] === 0x6a) solid++;
  const o = 3 * (y * W + x);
  rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
}
console.log("chunk solid density:", (solid / (W * CHUNK)).toFixed(4));
writePng("/tmp/opencode/noise-chunk-smoke.png", W, CHUNK, rgb);
console.log("saved /tmp/opencode/noise-chunk-smoke.png");
