// obs-1 ground-truth leg: the CAPTURE (game's own render, seed 78633191) at
// the tree-west chunks (33..38, Y14) — black-air vs airDark-family vs soil
// vs water-family shares. readPng path from repo lib.
import { readPng } from '/home/marron/work/Noita-livemap/mapgen/lib/images.mjs';
const fam = {
  airDark: [[13,14,18],[12,13,17],[16,16,18],[21,23,30]],
  water: [[39,67,63],[42,70,67],[39,66,62],[45,73,71]],
  soil: [[70,65,40],[64,58,41],[89,83,59],[81,74,49]],
  rock: [[39,40,45],[36,37,42],[42,43,48]],
  fallbackSolid: [[90,90,95],[80,80,85]],
};
const famOf = (r,g,b) => {
  if (r <= 2 && g <= 2 && b <= 2) return 'black';
  for (const [name, list] of Object.entries(fam)) {
    for (const [cr,cg,cb] of list) {
      if (Math.abs(r-cr)<=1 && Math.abs(g-cg)<=1 && Math.abs(b-cb)<=1) return name;
    }
  }
  return 'other';
};
for (let cx = 33; cx <= 38; cx++) {
  const img = readPng(`/home/marron/work/Noita-livemap/mapgen/out/ref/${cx}_14.png`);
  if (!img) { console.log(`${cx}_14 missing`); continue; }
  const h = new Map();
  const top = new Map();
  const N = img.width * img.height;
  for (let i = 0; i < N; i++) {
    const q = 4 * i, a = img.data[q+3];
    let r=img.data[q], g=img.data[q+1], b=img.data[q+2];
    if (a < 10) { h.set('alpha0', (h.get('alpha0')??0)+1); continue; }
    h.set('opaque', (h.get('opaque')??0)+1);
    const f = famOf(r,g,b);
    h.set(f, (h.get(f)??0)+1);
    if (f !== 'black') top.set(`${r},${g},${b}`, (top.get(`${r},${g},${b}`)??0)+1);
  }
  const pct = (n) => ((n / N) * 100).toFixed(1);
  console.log(`${cx}_14: black=${pct(h.get('black')??0)}% airDark=${pct(h.get('airDark')??0)}% water=${pct(h.get('water')??0)}% soil=${pct(h.get('soil')??0)}% rock=${pct(h.get('rock')??0)}% fallbackSolid=${pct(h.get('fallbackSolid')??0)}% other=${pct(h.get('other')??0)}% alpha0=${pct(h.get('alpha0')??0)}%`);
  const t = [...top.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,n])=>`${c}:${pct(n)}%`);
  console.log(`   top non-black: ${t.join(' | ')}`);
}
