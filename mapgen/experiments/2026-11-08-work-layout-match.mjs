// Layout match between capture bands: per-chunk, binarize each band at its own luma quantile q (darkest q = "hole"),
// so a recolour (hell red rock, heaven grey) cannot bias the score; IoU of the hole masks. Also tests shifted offsets.
import { repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import path from 'node:path'; import fs from 'node:fs'; import sharp from 'sharp';
const L=14, n=64; const B='https://regular-main-branch-middle.acidflow.stream/maps/regular-main-branch-middle/regular-main-branch-middle-2024-08-12-78633191_files';
const cache=path.join(repoRoot,'mapgen/out/cache/tiles'); const T=new Map();
async function tile(ti,tj){const k=ti+'_'+tj; if(T.has(k)) return T.get(k); const cp=path.join(cache,`regular-main-branch-middle-2024-08-12-78633191-${L}-${ti}_${tj}.webp`);
 if(!fs.existsSync(cp)){const r=await fetch(`${B}/${L}/${ti}_${tj}.webp`); if(!r.ok){T.set(k,null);return null;} fs.writeFileSync(cp,Buffer.from(await r.arrayBuffer()));}
 const {data,info}=await sharp(cp).removeAlpha().raw().toBuffer({resolveWithObject:true}); const t={data,info,l:ti>0?2:0,t:tj>0?2:0}; T.set(k,t); return t;}
async function luma(tx,ty){ const a=new Float32Array(n*n); for(let j=0;j<n;j++)for(let i=0;i<n;i++){const gx=tx*n+i,gy=ty*n+j; const t=await tile(gx>>9,gy>>9); const p=3*(((gy&511)+t.t)*t.info.width+(gx&511)+t.l); a[j*n+i]=0.3*t.data[p]+0.59*t.data[p+1]+0.11*t.data[p+2];} return a;}
const bin=(a,q)=>{const s=[...a].sort((x,y)=>x-y); const th=s[Math.floor(q*s.length)]; return a.map(v=>v<=th?1:0);};
const iou=(a,b)=>{let I=0,U=0; for(let k=0;k<a.length;k++){I+=a[k]&b[k];U+=a[k]|b[k];} return I/U;};
const q=0.4; const rows=(process.argv[2]??'27,28,29,31,32,33,35,36,37,43,44,45,46,47').split(',').map(Number); const cols=[29,31,33,35,37,39];
const acc={HD:[],HM:[],DM:[],DMx:[]};
for(const r of rows) for(const c of cols){ const H=bin(await luma(c,r),q), M=bin(await luma(c,48+r),q), D=bin(await luma(c,96+r),q), Mx=bin(await luma(c+1,48+r),q);
  acc.HD.push(iou(H,D)); acc.HM.push(iou(H,M)); acc.DM.push(iou(D,M)); acc.DMx.push(iou(D,Mx)); }
const mean=a=>(a.reduce((s,v)=>s+v,0)/a.length).toFixed(3);
console.log(`chunks=${acc.HD.length} q=${q}  H~D ${mean(acc.HD)}  H~M ${mean(acc.HM)}  D~M ${mean(acc.DM)}  D~M(col+1 control) ${mean(acc.DMx)}  (chance ≈ ${(q*q/(2*q-q*q)).toFixed(3)})`);
