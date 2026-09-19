// mapgen/experiments/2026-09-20-noise-band-smoke.mjs — F3 integration smoke.
// Renders a crop of the deep band (the_end walls, I5/I6 zone) through the
// integrated pipeline (wang + finalize + template overlay + noise terrain)
// and saves a PNG for eyeball + a solid-density number.
import { ensureWorld, worldColorAt, CHUNK } from "../lib/world-gen.mjs";
import { findNoitaDataDir } from "../lib/paths.mjs";
import { writePng } from "../lib/images.mjs";

const DATA = findNoitaDataDir();

const SEED = 78633191;
const world = ensureWorld(SEED, DATA, {});
await world.ready;
console.log("areas:", world.areas.length, "errors:", world.errors.size);

// Deep band: canvas rows ty 96..100 (the_end wall zone, below the hell sea).
// Save a 1024x512 crop at canvas (0, CHUNK*96)..(1024, CHUNK*100).
const W = 1024, H = 512, ox = 0, oy = 96 * CHUNK;
const rgb = Buffer.alloc(W * H * 3);
let solid = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let c = worldColorAt(world, ox + x, oy + y);
    if (c === null) c = [18, 16, 14]; // dark background for visibility
    if (c[0] === 0x1b && c[1] === 0x1b && c[2] === 0x1b) solid++;
    else if (c[0] === 0x6a) solid++; // surface-band solid cells
    const o = 3 * (y * W + x);
    rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
  }
}
console.log("deep-band solid density:", (solid / (W * H)).toFixed(4));
writePng("/tmp/opencode/noise-band-smoke.png", W, H, rgb);
console.log("saved /tmp/opencode/noise-band-smoke.png");
