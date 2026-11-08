// E1 instrument (dig #215): our Work render vs the capture (seed 78633191), per chunk, cols 29..39 step 2,
// strip rows (heaven r, hell 96+r). Each side binarized at its OWN luma quantile q (darkest q = "hole"),
// so the meter scores LAYOUT, not palette; IoU of hole masks. Control: ours shifted one column.
import { ensureWorld, worldColorAt } from '/home/marron/work/Noita-livemap/mapgen/lib/world-gen.mjs';
import { findNoitaDataDir, repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import path from 'node:path'; import fs from 'node:fs'; import sharp from 'sharp';
const world = ensureWorld(78633191, findNoitaDataDir(), { cacheDir: path.join(repoRoot,'mapgen/out/gen-cache/r3i') }); await world.ready;
const L=14, n=64, S=8; const B='https://regular-main-branch-middle.acidflow.stream/maps/regular-main-branch-middle/regular-main-branch-middle-2024-08-12-78633191_files';
const cache=path.join(repoRoot,'mapgen/out/cache/tiles'); const T=new Map();
async function tile(ti,tj){const k=ti+'_'+tj; if(T.has(k)) return T.get(k); const cp=path.join(cache,`regular-main-branch-middle-2024-08-12-78633191-${L}-${ti}_${tj}.webp`);
 if(!fs.existsSync(cp)){const r=await fetch(`${B}/${L}/${ti}_${tj}.webp`); fs.writeFileSync(cp,Buffer.from(await r.arrayBuffer()));}
 const {data,info}=await sharp(cp).removeAlpha().raw().toBuffer({resolveWithObject:true}); const t={data,info,l:ti>0?2:0,t:tj>0?2:0}; T.set(k,t); return t;}
async function capL(tx,ty){const a=new Float32Array(n*n); for(let j=0;j<n;j++)for(let i=0;i<n;i++){const gx=tx*n+i,gy=ty*n+j; const t=await tile(gx>>9,gy>>9); const p=3*(((gy&511)+t.t)*t.info.width+(gx&511)+t.l); a[j*n+i]=0.3*t.data[p]+0.59*t.data[p+1]+0.11*t.data[p+2];} return a;}
function ourL(tx,ty){const a=new Float32Array(n*n); for(let j=0;j<n;j++)for(let i=0;i<n;i++){const c=worldColorAt(world,tx*512+i*S,ty*512+j*S); a[j*n+i]=c?0.3*c[0]+0.59*c[1]+0.11*c[2]:0;} return a;}
const bin=(a,q)=>{const s=[...a].sort((x,y)=>x-y); const th=s[Math.floor(q*s.length)]; return a.map(v=>v<=th?1:0);};
const iou=(a,b)=>{let I=0,U=0; for(let k=0;k<a.length;k++){I+=a[k]&b[k];U+=a[k]|b[k];} return U?I/U:1;};
const q=0.4, rows=[14,15,17,18,20,21,22,24,25,27,28,29,31,32,33,35,36,37,38,43,44,45,46,47], cols=[29,31,33,35,37,39];
for (const [band,off] of (process.argv[2]==='main'?[['main',48]]:[['heaven',0],['hell',96]])) { const s=[], c=[];
  for (const r of rows) for (const x of cols) { const C=bin(await capL(x,off+r),q); s.push(iou(C,bin(ourL(x,off+r),q))); c.push(iou(C,bin(ourL(x+1,off+r),q))); }
  const m=a=>(a.reduce((p,v)=>p+v,0)/a.length).toFixed(3);
  console.log(`${band}: chunks=${s.length} q=${q} ours~capture ${m(s)}  control(ours col+1) ${m(c)}`); }
