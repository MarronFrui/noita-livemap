// 2026-10-18-splice-chunk-equiv.mjs — dig #168 test-scoping evidence (M):
// chunk "40,62" = world (2560,0) = the mountain_lake splice origin. The
// count law in tests/mapgen/plz-codec.test.mjs pins this chunk's buffer.
// Claim: the chunk's FULL renderTemplateWorld content == a splice-only
// blit into a fresh map (no other pass touches it: the area loop skips it
// — biomeAt(40,62) = the_end, template:false; renderWorldExtension leaves
// non-lava/tower/wall/lake defs void; blitFixedScenes/art-crust origins
// don't cover it). If byte-equal, the test may pin blitSplicedScenes
// directly instead of rendering the whole world (a >60s sync span that
// trips the vitest single-fork RPC watchdog, cf. I36).
// Reproduction: node mapgen/experiments/2026-10-18-splice-chunk-equiv.mjs

import { renderTemplateWorld, blitSplicedScenes } from "../lib/template-render.mjs";
import { loadBiomeConfig } from "../lib/biomes.mjs";

const DATA_DIR = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
const KEY = "40,62";

function stats(buf) {
  if (!buf) return null;
  let unset = 0;
  const colors = new Map();
  for (let i = 0; i < buf.length; i += 3) {
    if (buf[i] === 9 && buf[i + 1] === 9 && buf[i + 2] === 9) { unset++; continue; }
    const k = `${buf[i]},${buf[i + 1]},${buf[i + 2]}`;
    colors.set(k, (colors.get(k) || 0) + 1);
  }
  return { unset, painted: buf.length / 3 - unset, colors };
}

const t0 = Date.now();
const config = loadBiomeConfig(DATA_DIR);
const full = renderTemplateWorld(DATA_DIR, config, 78633191);
const tFull = Date.now() - t0;

const t1 = Date.now();
const fresh = new Map();
// dig #170: same config+seed args as the full render — the splice lane's
// grey -> band fill resolves the hosting biome through config
blitSplicedScenes(fresh, DATA_DIR, config, 78633191);
const tSplice = Date.now() - t1;

const a = full.get(KEY);
const b = fresh.get(KEY);
const sa = stats(a), sb = stats(b);
const byteEqual = !!a && !!b && a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

console.log(`full render: ${tFull} ms; splice-only: ${tSplice} ms`);
console.log(`full    chunk ${KEY}: unset=${sa?.unset} painted=${sa?.painted} colors=${sa?.colors.size}`);
console.log(`splice  chunk ${KEY}: unset=${sb?.unset} painted=${sb?.painted} colors=${sb?.colors.size}`);
console.log(`byteEqual = ${byteEqual}`);
if (sa && sb) {
  console.log(`full colors:    ${[...sa.colors.entries()].map(([k, v]) => `${k}:${v}`).join(" | ")}`);
  console.log(`splice colors:  ${[...sb.colors.entries()].map(([k, v]) => `${k}:${v}`).join(" | ")}`);
}
process.exit(byteEqual ? 0 : 1);
