import { readPng } from '/home/marron/work/Noita-livemap/mapgen/lib/images.mjs';
const p = '/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/weather_gfx/background_cave_04_alt.png';
const img = readPng(p);
const N = img.width * img.height; const h = new Map; let Np = 0;
for (let i = 0; i < N; i++) {
  const q = 4*i, a = img.data[q+3];
  if (a < 10) { h.set('alpha0', (h.get('alpha0')??0)+1); continue; }
  Np++;
  const c = `${img.data[q]},${img.data[q+1]},${img.data[q+2]}`;
  h.set(c, (h.get(c)??0)+1);
}
console.log(`${p} ${img.width}x${img.height}: opaque=${Np}/${N}`);
console.log([...h.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([c,n])=>`${c}:${n}`).join(' | '));
