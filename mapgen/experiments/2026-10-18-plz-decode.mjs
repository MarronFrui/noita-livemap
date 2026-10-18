// Dig #168 census — the full .plz pipeline (mapgen/lib/plz.mjs) over every
// shipped spliced scene piece + the two content pins:
//   1. mountain_lake/0.plz: decode -> cell == PNG color, all 262144
//   2. lavalake2/4.plz (rawLen 32 < 0x80 gate): verbatim cells == art at
//      (pos 2556,2048 - origin 2048,0) = (508,2048)
// Usage: node mapgen/experiments/2026-10-18-plz-decode.mjs

import fs from "node:fs";
import path from "node:path";
import { decodePlz, PLZ_RAW_THRESHOLD } from "../lib/plz.mjs";

const dataDir =
  process.env.NOITA_DATA_DIR ??
  "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";

// ---- walk every shipped plz ----
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".plz")) files.push(p);
  }
})(path.join(dataDir, "biome_impl/spliced"));

const census = { raw: 0, L1: 0, L2: 0, other: 0 };
let exact = 0, mismatched = 0, alphaOk = 0, alphaBad = 0;
const rows = [];
for (const f of files) {
  const buf = fs.readFileSync(f);
  let res;
  try {
    res = decodePlz(buf);
  } catch (err) {
    census.other++;
    rows.push(`  DECODE-FAIL ${path.relative(dataDir, f)}: ${err.message}`);
    mismatched++;
    continue;
  }
  const kind = res.raw ? "raw" : res.level === 1 ? "L1" : res.level === 2 ? "L2" : "other";
  census[kind]++;
  const ok = res.out.length === res.header.rawLen;
  ok ? exact++ : mismatched++;
  // cell alpha census: art cells are 0xffRRGGBB
  let bad = 0;
  for (let i = 0; i + 3 < res.out.length; i += 4) if (res.out[i + 3] !== 0xff) bad++;
  bad === 0 ? alphaOk++ : alphaBad++;
  if (!ok || bad !== 0) {
    rows.push(
      `  ${ok ? "len-OK" : `len-MISMATCH ${res.out.length}!=${res.header.rawLen}`} ` +
      `alpha-bad=${bad} ${path.relative(dataDir, f)}`
    );
  }
}
console.log("files:", files.length, JSON.stringify(census));
console.log("decode-exact:", exact, "mismatched:", mismatched,
  "| alpha-0xff-everywhere:", alphaOk, "alpha-varied (visual/transparent art):", alphaBad);
for (const r of rows) console.log(r);
console.log(`gate: rawLen < 0x${PLZ_RAW_THRESHOLD.toString(16)} -> verbatim`);

// ---- content pin 1: mountain_lake 0.plz vs PNG, cell-by-cell ----
const { PNG } = await import("pngjs");
function cellColorMatchesPlz(plzFile, pngFile) {
  const { header, out } = decodePlz(fs.readFileSync(plzFile));
  const png = PNG.sync.read(fs.readFileSync(pngFile));
  if (header.w !== png.width || header.h !== png.height) {
    return { mismatch: `dims ${header.w}x${header.h} vs png ${png.width}x${png.height}` };
  }
  let match = 0, mismatch = 0, firstBad = null;
  for (let i = 0; i < png.width * png.height; i++) {
    const q = i * 4;
    if (out[q] === png.data[q] && out[q + 1] === png.data[q + 1] &&
        out[q + 2] === png.data[q + 2] && out[q + 3] === png.data[q + 3]) match++;
    else {
      mismatch++;
      if (!firstBad) {
        firstBad = { i, plz: [...out.subarray(q, q + 4)], png: [...png.data.subarray(q, q + 4)] };
      }
    }
  }
  return { match, mismatch, firstBad };
}
const ml = cellColorMatchesPlz(
  path.join(dataDir, "biome_impl/spliced/mountain_lake/0.plz"),
  path.join(dataDir, "biome_impl/spliced/mountain_lake.png")
);
console.log("mountain_lake 0.plz vs PNG:", JSON.stringify(ml));

// ---- content pin 2: lavalake2/4.plz verbatim cells vs art at (508,2048) ----
{
  const buf = fs.readFileSync(path.join(dataDir, "biome_impl/spliced/lavalake2/4.plz"));
  const res = decodePlz(buf);
  const png = PNG.sync.read(fs.readFileSync(path.join(dataDir, "biome_impl/spliced/lavalake2.png")));
  const ox = 2556 - 2048, oy = 2048 - 0; // fragment pos - art origin
  let match = 0, mismatch = 0;
  for (let y = 0; y < res.header.h; y++) {
    for (let x = 0; x < res.header.w; x++) {
      const v = 4 * (y * res.header.w + x);
      const q = 4 * ((oy + y) * png.width + (ox + x));
      if (res.out[v] === png.data[q] && res.out[v + 1] === png.data[q + 1] &&
          res.out[v + 2] === png.data[q + 2] && res.out[v + 3] === png.data[q + 3]) match++;
      else {
        mismatch++;
        console.log(`  4.plz cell(${x},${y}) plz=[${[...res.out.subarray(v, v + 4)]}] png=[${[...png.data.subarray(q, q + 4)]}]`);
      }
    }
  }
  console.log("lavalake2 4.plz verbatim vs art@(508,2048):", match, "match /", mismatch, "mismatch");
}
