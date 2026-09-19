import { loadWangWorld, SKY_ROWS } from "../lib/world-gen.mjs";
import { findNoitaDataDir } from "../lib/paths.mjs";
import { noiseChunkMask, noiseSolidAt } from "../lib/noise-terrain.mjs";
const w = loadWangWorld(findNoitaDataDir());
const r = noiseChunkMask(w.config, 45, 48);
console.log("mask?", !!r);
if (r) {
  let s = 0; for (const v of r.mask) s += v;
  console.log("solid cells:", s, "of", r.mask.length);
  console.log("sample evaluator2(45+0.5+159, 48+0.5+223):", (await import("../lib/noise-proto.mjs")).evaluator2(45.5+159, 48.5+223, 1.0));
  console.log("noiseSolidAt probe:", noiseSolidAt(Object.assign(w, {noiseAt: (tx,ty)=>r, }), 45*512+10, 48*512+10));
}
