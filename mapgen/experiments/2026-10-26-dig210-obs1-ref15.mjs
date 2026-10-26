import { readPng } from '/home/marron/work/Noita-livemap/mapgen/lib/images.mjs';
const fam = {
  airDark: [[13,14,18],[12,13,17],[16,16,18],[21,23,30]],
  caveBgAlt: [[21,23,25],[12,13,14],[29,33,35],[31,35,37]],
  water: [[39,67,63],[42,70,67],[39,66,62],[45,73,71]],
  soil: [[70,65,40],[64,58,41],[89,83,59],[81,74,49]],
  rock: [[39,40,45],[36,37,42],[42,43,48]],
};
const famOf = (r,g,b) => {
  if (r <= 2 && g <= 2 && b <= 2) return 'black';
  for (const [name, list] of Object.entries(fam)) {
    for (const [cr,cg,cb] of list) if (Math.abs(r-cr)<=1 && Math.abs(g-cg)<=1 && Math.abs(b-cb)<=1) return name;
  }
  return 'other';
};
for (const bty of [14,15]) {
  for (let cx = 37; cx <= 39; cx++) {
    const img = readPng(`/home/marron/work/Noita-livemap/mapgen/out/ref/${cx}_${bty}.png`);
    if (!img) { console.log(`${cx}_${bty} missing`); continue; }
    const h = new Map(); const top = new Map();
    const N = img.width * img.height;
    for (let i = 0; i < N; i++) {
      const q = 4 * i, a = img.data[q+3];
      if (a < 10) { h.set('alpha0', (h.get('alpha0')??0)+1); continue; }
      h.set('opaque', (h.get('opaque')??0)+1);
      const f = famOf(img.data[q],img.data[q+1],img.data[q+2]);
      h.set(f, (h.get(f)??0)+1);
      if (f !== 'black') top.set(`${img.data[q]},${img.data[q+1]},${img.data[q+2]}`, (top.get(`${img.data[q]},${img.data[q+1]},${img.data[q+2]}`)??0)+1);
    }
    const pct = (n) => ((n / N) * 100).toFixed(1);
    console.log(`${cx}_${bty}: air=${pct(h.get('alpha0')??0)} black=${pct(h.get('black')??0)} airDark=${pct(h.get('airDark')??0)} caveAlt=${pct(h.get('caveBgAlt')??0)} water=${pct(h.get('water')??0)} soil=${pct(h.get('soil')??0)} rock=${pct(h.get('rock')??0)} other=${pct(h.get('other')??0)}%`);
    console.log(`   top: ${[...top.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,n])=>`${c}:${pct(n)}%`).join(' | ')}`);
  }
}
