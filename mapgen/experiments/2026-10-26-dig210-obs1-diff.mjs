// obs-1 instrument v2: per-pixel class-channel diff OUR RENDER vs CAPTURE
// (seed 78633191) for chunks (33..38, canvas y 61..62 = capture Y13/Y14).
import { ensureWorld, worldColorAt } from '/home/marron/work/Noita-livemap/mapgen/lib/world-gen.mjs';
import { findNoitaDataDir, repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import { readPng } from '/home/marron/work/Noita-livemap/mapgen/lib/images.mjs';
import path from 'node:path';
const dataDir = findNoitaDataDir();
const cacheDir = path.join(path.resolve(repoRoot), 'mapgen/out/gen-cache/r3i');
const SEED = 78633191;
const world = ensureWorld(SEED, dataDir, { cacheDir });
await world.ready;

const famOf = (r,g,b) => {
  if (r <= 2 && g <= 2 && b <= 2) return 'black';
  const dark = (r === 13&&g===14&&b===18)||(r===12&&g===13&&b===17)||(r===16&&g===16&&b===18)||(r===21&&g===23&&b===30);
  if (dark) return 'airDark';
  const soil = (r===70&&g===65&&b===40)||(r===64&&g===58&&b===41)||(r===89&&g===83&&b===59)||(r===81&&g===74&&b===49);
  if (soil) return 'soil';
  const rock = (r===39&&g===40&&b===45)||(r===36&&g===37&&b===42)||(r===42&&g===43&&b===48);
  if (rock) return 'rock';
  const water = (r===39&&g===67&&b===63)||(r===42&&g===70&&b===67)||(r===39&&g===66&&b===62)||(r===45&&g===73&&b===71);
  if (water) return 'water';
  return 'other';
};

for (const ty of [61, 62]) {
  const bty = ty - 48;
  for (let cx = 33; cx <= 38; cx++) {
    const ref = readPng(`/home/marron/work/Noita-livemap/mapgen/out/ref/${cx}_${bty}.png`);
    if (!ref) { console.log(`(${cx},${ty}) ref ${cx}_${bty} missing`); continue; }
    const conf = new Map(); const refMarg = new Map(); const match = new Map(); let NSAMP = 0;
    for (let y = 0; y < 512; y += 2) {
      for (let x = 0; x < 512; x += 2) {
        const wx = cx*512 + x, wy = ty*512 + y;
        const c = worldColorAt(world, wx, wy);
        const mine = c ? famOf(c[0],c[1],c[2]) : 'air';
        const q = 4 * (y * ref.width + x);
        const a = ref.data[q+3];
        const refClass = (a < 10 || (ref.data[q]<=2 && ref.data[q+1]<=2 && ref.data[q+2]<=2)) ? 'air' : famOf(ref.data[q], ref.data[q+1], ref.data[q+2]);
        refMarg.set(refClass, (refMarg.get(refClass)??0)+1);
        conf.set(mine, (conf.get(mine)??0)+1);
        if (mine === refClass) match.set(mine, (match.get(mine)??0)+1);
        NSAMP++;
      }
    }
    const fmt = (m, tot) => [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([k,n]) => `${k}:${Math.round(n/tot*100)}%`).join(' ');
    console.log(`(${cx},Y${bty}) REF   : ${fmt(refMarg, NSAMP)}`);
    console.log(`      OURS  : ${fmt(conf, NSAMP)}`);
  }
}
