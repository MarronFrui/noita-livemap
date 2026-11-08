// Solid-mask IoU between capture rows: heaven r vs hell 96+r vs main 48+r (cols 27..41, DZI level 15 = 1/4 scale).
// Solid = not black-air and not the hell backdrop (luma test + a "bg" family test: in hell the air shows background_the_end.png).
import { repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import path from 'node:path'; import fs from 'node:fs'; import sharp from 'sharp';
const L=15, n=128, X0=27, X1=41; const B='https://regular-main-branch-middle.acidflow.stream/maps/regular-main-branch-middle/regular-main-branch-middle-2024-08-12-78633191_files';
const cache=path.join(repoRoot,'mapgen/out/cache/tiles'); const T=new Map();
async function tile(ti,tj){const k=ti+'_'+tj; if(T.has(k)) return T.get(k); const cp=path.join(cache,`regular-main-branch-middle-2024-08-12-78633191-${L}-${ti}_${tj}.webp`);
 if(!fs.existsSync(cp)){const r=await fetch(`${B}/${L}/${ti}_${tj}.webp`); if(!r.ok){T.set(k,null);return null;} fs.writeFileSync(cp,Buffer.from(await r.arrayBuffer()));}
 const {data,info}=await sharp(cp).removeAlpha().raw().toBuffer({resolveWithObject:true}); const t={data,info,l:ti>0?2:0,t:tj>0?2:0}; T.set(k,t); return t;}
async function mask(ty){ const W=(X1-X0+1)*n, m=new Uint8Array(W*n); for(let j=0;j<n;j++) for(let i=0;i<W;i++){ const gx=X0*n+i, gy=ty*n+j; const t=await tile(gx>>9,gy>>9); if(!t) continue;
  const p=3*(((gy&511)+t.t)*t.info.width+(gx&511)+t.l); const r=t.data[p],g=t.data[p+1],b=t.data[p+2]; m[j*W+i]= (r+g+b>90)?1:0; } return m; }
const iou=(a,b)=>{let I=0,U=0; for(let k=0;k<a.length;k++){I+=a[k]&b[k]; U+=a[k]|b[k];} return U?(I/U).toFixed(3):'  -  ';};
const fill=a=>(a.reduce((s,v)=>s+v,0)/a.length).toFixed(2);
console.log('  r  fillH fillM fillD  H~D   H~M   D~M');
for(let r=Number(process.argv[2]??14); r<=Number(process.argv[3]??47); r++){ const H=await mask(r), M=await mask(48+r), D=await mask(96+r); console.log(String(r).padStart(3), fill(H), fill(M), fill(D), iou(H,D), iou(H,M), iou(D,M)); }
