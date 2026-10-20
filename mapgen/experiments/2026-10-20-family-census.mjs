// 2026-10-20 — the family census (the surface-band acceptance meter): exact
// color-family counts for one 512×512 tile PNG — void (alpha<10), pure black,
// lava (r>150 && g<140 && b<80), plus the top-6 non-lava rgb families. The
// instrument behind the (39,62) lavalake2-zone bars and the lava-tile family
// comparisons (METER-CLASS: E1 — presence/family counts of 262,144 px).
//
// Measured this session (seed 78633191; capture tile = mapgen/out/ref/39_14
// vs our served tile 39/62):
//   capture: grey rock (39,40,45) 157,169 px + olive soil (70,65,40)+(95,87,49)
//            56,380 px + sky family 21,669 px
//   ours:    olive (53,57,35)+(82,79,45) 206,928 px + grey 13,088 px + sky 0
// → the surfaceField v-range is flattened vs the game's (dig #177 target).
// Sky accounting: the sky = the pure-black count here (the BLACK-air + stars
// backdrop, dig #133 — verified: our sky-band tile 40/55 = 260,582 black px
// of 262,144 with star px as the sparse non-black families; capture 39_14's
// black 21,669 = the sky above the silhouette). A prior note claiming the sky
// lives in a (12,16,25) family = FALSIFIED this session by that census.
//
// Usage: node mapgen/experiments/2026-10-20-family-census.mjs <tile.png>
import { readPng } from "../lib/images.mjs";

const [f] = process.argv.slice(2);
if (!f) {
  console.error("usage: node mapgen/experiments/2026-10-20-family-census.mjs <tile.png>");
  process.exit(1);
}
const img = readPng(f);
let unset = 0, black = 0, lava = 0, other = 0;
const total = img.width * img.height;
const fams = new Map();
for (let i = 0; i < total; i++) {
  const q = 4 * i, r = img.data[q], g = img.data[q + 1], b = img.data[q + 2], a = img.data[q + 3];
  if (a < 10) { unset++; continue; }
  if (r === 0 && g === 0 && b === 0) { black++; continue; }
  if (r > 150 && g < 140 && b < 80) { lava++; continue; }
  other++;
  const k = `${r},${g},${b}`;
  fams.set(k, (fams.get(k) || 0) + 1);
}
const top = [...fams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log(f.split("/").pop(), { total, unset, black, lava, other }, "top:", top);
