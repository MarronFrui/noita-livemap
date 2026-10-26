// right_stub_background.png palette + alpha — the raw backdrop blit source.
import { readPng } from '/home/marron/work/Noita-livemap/mapgen/lib/images.mjs';
const p = '/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/biome_impl/mountain/right_stub_background.png';
const img = readPng(p);
const N = img.width * img.height;
const h = new Map;
let Np = 0;
for (let i = 0; i < N; i++) {
  const q = 4 * i, a = img.data[q+3];
  if (a < 10) { h.set('alpha0', (h.get('alpha0')??0)+1); continue; }
  Np++;
  const c = `${img.data[q]},${img.data[q+1]},${img.data[q+2]}`;
  h.set(c, (h.get(c)??0)+1);
}
console.log(`${p} ${img.width}x${img.height}: opaque=${Np}/${N}`);
console.log([...h.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([c,n])=>`${c}:${n}`).join(' | '));
// also the material png
const p2 = '/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/biome_impl/mountain/right_stub.png';
const img2 = readPng(p2);
const N2 = img2.width * img2.height; const h2 = new Map; let Np2 = 0;
for (let i = 0; i < N2; i++) {
  const q = 4*i, a = img2.data[q+3];
  if (a < 10) { h2.set('alpha0', (h2.get('alpha0')??0)+1); continue; }
  Np2++;
  const c = `${img2.data[q]},${img2.data[q+1]},${img2.data[q+2]}`;
  h2.set(c, (h2.get(c)??0)+1);
}
console.log(`${p2} ${img2.width}x${img2.height}: opaque=${Np2}/${N2}`);
console.log([...h2.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([c,n])=>`${c}:${n}`).join(' | '));
