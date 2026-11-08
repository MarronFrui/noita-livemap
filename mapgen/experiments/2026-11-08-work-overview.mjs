// Render our canvas rows [y0,y1] cols [x0,x1] at 1/S scale + the capture at the same scale, side by side.
import { ensureWorld, worldColorAt } from '/home/marron/work/Noita-livemap/mapgen/lib/world-gen.mjs';
import { findNoitaDataDir, repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import path from 'node:path'; import fs from 'node:fs';
import sharp from 'sharp';
const [x0,x1,y0,y1,S,out] = process.argv.slice(2).map((v,i)=>i<5?Number(v):v);
const world = ensureWorld(78633191, findNoitaDataDir(), { cacheDir: path.join(repoRoot,'mapgen/out/gen-cache/r3i') });
await world.ready;
const n = 512/S, W=(x1-x0+1)*n, H=(y1-y0+1)*n;
const buf = Buffer.alloc(W*H*3);
for (let ty=y0; ty<=y1; ty++) for (let tx=x0; tx<=x1; tx++) for (let j=0;j<n;j++) for (let i=0;i<n;i++) {
  const c = worldColorAt(world, tx*512+i*S, ty*512+j*S);
  const p = 3*(((ty-y0)*n+j)*W + (tx-x0)*n+i);
  if (c) { buf[p]=c[0]; buf[p+1]=c[1]; buf[p+2]=c[2]; }
}
// capture: level L where 1/S scale: 17 - log2(S)
const L = 17 - Math.log2(S);
const B='https://regular-main-branch-middle.acidflow.stream/maps/regular-main-branch-middle/regular-main-branch-middle-2024-08-12-78633191_files';
const cache = path.join(repoRoot,'mapgen/out/cache/tiles'); 
const comps=[]; 
const px0=x0*n, py0=y0*n, px1=(x1+1)*n, py1=(y1+1)*n;
for (let ti=Math.floor(px0/512); ti*512<px1; ti++) for (let tj=Math.floor(py0/512); tj*512<py1; tj++) {
  const cp = path.join(cache, `regular-main-branch-middle-2024-08-12-78633191-${L}-${ti}_${tj}.webp`);
  if (!fs.existsSync(cp)) { const r = await fetch(`${B}/${L}/${ti}_${tj}.webp`); if(!r.ok) continue; fs.writeFileSync(cp, Buffer.from(await r.arrayBuffer())); }
  const left = ti>0?2:0, top=tj>0?2:0;
  const img = await sharp(cp).extract({left, top, width: Math.min(512, (await sharp(cp).metadata()).width-left), height: Math.min(512,(await sharp(cp).metadata()).height-top)}).png().toBuffer();
  const meta = await sharp(img).metadata();
  // crop region intersect
  const gx=ti*512, gy=tj*512;
  const ix0=Math.max(gx,px0), iy0=Math.max(gy,py0), ix1=Math.min(gx+meta.width,px1), iy1=Math.min(gy+meta.height,py1);
  if (ix1<=ix0||iy1<=iy0) continue;
  comps.push({ input: await sharp(img).extract({left:ix0-gx, top:iy0-gy, width:ix1-ix0, height:iy1-iy0}).png().toBuffer(), left: W+8+ix0-px0, top: iy0-py0 });
}
await sharp({create:{width:2*W+8,height:H,channels:3,background:'#ff00ff'}})
  .composite([{input: buf, raw:{width:W,height:H,channels:3}, left:0, top:0}, ...comps]).png().toFile(out);
console.log('wrote', out, 2*W+8, H);
