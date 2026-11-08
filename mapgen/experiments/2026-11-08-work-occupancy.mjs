// Per-chunk non-black share in the capture (seed 78633191) for canvas rows [y0,y1], cols [x0,x1], via DZI level 13 (1/16).
import { repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import path from 'node:path'; import fs from 'node:fs'; import sharp from 'sharp';
const [x0,x1,y0,y1] = process.argv.slice(2).map(Number);
const L=13, n=32, B='https://regular-main-branch-middle.acidflow.stream/maps/regular-main-branch-middle/regular-main-branch-middle-2024-08-12-78633191_files';
const cache = path.join(repoRoot,'mapgen/out/cache/tiles'); const tiles = new Map();
async function tile(ti,tj){ const k=ti+'_'+tj; if(tiles.has(k)) return tiles.get(k);
  const cp = path.join(cache, `regular-main-branch-middle-2024-08-12-78633191-${L}-${ti}_${tj}.webp`);
  if (!fs.existsSync(cp)) { const r=await fetch(`${B}/${L}/${ti}_${tj}.webp`); if(!r.ok){tiles.set(k,null);return null;} fs.writeFileSync(cp,Buffer.from(await r.arrayBuffer())); }
  const {data,info} = await sharp(cp).removeAlpha().raw().toBuffer({resolveWithObject:true}); const t={data,info,left:ti>0?2:0,top:tj>0?2:0}; tiles.set(k,t); return t; }
const out=[];
for (let ty=y0; ty<=y1; ty++){ const row=[]; for (let tx=x0; tx<=x1; tx++){ let nb=0,tot=0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){ const gx=tx*n+i, gy=ty*n+j; const t=await tile(gx>>9, gy>>9); if(!t) continue;
    const lx=(gx&511)+t.left, ly=(gy&511)+t.top; if(lx>=t.info.width||ly>=t.info.height) continue; const p=3*(ly*t.info.width+lx); tot++; if(t.data[p]+t.data[p+1]+t.data[p+2]>24) nb++; }
  row.push(tot? Math.round(nb/tot*9):'?'); } out.push(String(ty).padStart(3)+' '+row.join('')); }
console.log('    '+Array.from({length:x1-x0+1},(_,i)=>String((x0+i)%10)).join('')); console.log(out.join('\n'));
