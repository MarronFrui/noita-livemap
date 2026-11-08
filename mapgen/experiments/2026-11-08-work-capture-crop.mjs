// Crop the capture (seed 78633191, middle segment) for canvas cols [x0,x1] rows [y0,y1] at DZI level L, stacked vertically per row-range list "y0-y1,y0-y1".
import { repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import path from 'node:path'; import fs from 'node:fs'; import sharp from 'sharp';
const [x0,x1,ranges,L,out] = process.argv.slice(2);
const n = 512 >> (17-Number(L)); const B='https://regular-main-branch-middle.acidflow.stream/maps/regular-main-branch-middle/regular-main-branch-middle-2024-08-12-78633191_files';
const cache = path.join(repoRoot,'mapgen/out/cache/tiles');
async function tilePath(ti,tj){ const cp=path.join(cache,`regular-main-branch-middle-2024-08-12-78633191-${L}-${ti}_${tj}.webp`); if(!fs.existsSync(cp)){const r=await fetch(`${B}/${L}/${ti}_${tj}.webp`); if(!r.ok) return null; fs.writeFileSync(cp,Buffer.from(await r.arrayBuffer()));} return cp; }
async function region(px0,py0,W,H){ const comps=[]; for(let ti=px0>>9; ti*512<px0+W; ti++) for(let tj=py0>>9; tj*512<py0+H; tj++){ const cp=await tilePath(ti,tj); if(!cp) continue; const m=await sharp(cp).metadata(); const l=ti>0?2:0,t=tj>0?2:0; const gx=ti*512,gy=tj*512; const w=Math.min(512,m.width-l),h=Math.min(512,m.height-t);
  const ix0=Math.max(gx,px0),iy0=Math.max(gy,py0),ix1=Math.min(gx+w,px0+W),iy1=Math.min(gy+h,py0+H); if(ix1<=ix0||iy1<=iy0) continue;
  comps.push({input:await sharp(cp).extract({left:l+ix0-gx,top:t+iy0-gy,width:ix1-ix0,height:iy1-iy0}).png().toBuffer(),left:ix0-px0,top:iy0-py0}); }
  return sharp({create:{width:W,height:H,channels:3,background:'#f0f'}}).composite(comps).png().toBuffer(); }
const rs = ranges.split(',').map(s=>s.split('-').map(Number)); const W=(x1-x0+1)*n; let top=0; const comps=[];
for(const [a,b] of rs){ const H=(b-a+1)*n; comps.push({input:await region(x0*n,a*n,W,H),left:0,top}); top+=H+6; }
await sharp({create:{width:W,height:top-6,channels:3,background:'#f0f'}}).composite(comps).png().toFile(out); console.log('wrote',out,W,top-6);
