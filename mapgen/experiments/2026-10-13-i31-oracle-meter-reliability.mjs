// 2026-10-13 — dig #127 follow-up analysis (I31): is the C48 oracle-row rms
// meter RELIABLE as a differential verdict for the I30 exit-law port?
// Classes:
//   (1) presence  — carved-cell COUNT per sampled row (count-law; shift-blind)
//   (2) displacement — best-shifted rms in a (dx,dy) ±6/±8 window
//   (3) plain rms — what entry (127)/I31 currently report (reproduction check)
// The pre-patch field comes from `git show HEAD~1:mapgen/lib/caves-field.mjs`
// imported as a sibling module (untracked, unlinked at exit).
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";
import { loadBiomeConfig } from "../lib/biomes.mjs";
import { buildCavesField as buildPost } from "../lib/caves-field.mjs";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tmpMod = path.join(repoRoot, "mapgen/lib/caves-field-pre127.tmp.mjs");
const src = execSync("git show HEAD~1:mapgen/lib/caves-field.mjs", {
  cwd: repoRoot, encoding: "utf8", maxBuffer: 1 << 26,
});
writeFileSync(tmpMod, src);
let buildPre;
try {
  ({ buildCavesField: buildPre } = await import(pathToFileURL(tmpMod).href));
} finally {
  // keep until after both builds in case of import laziness — see below
}

const dataDir = findNoitaDataDir();
const oracle = JSON.parse(
  readFileSync(path.join(repoRoot, "mapgen/out/oracle/caves-grid-2026-09-21.json"), "utf8")
);
const grid = oracle["grid_0x26599020"];
const config = loadBiomeConfig(dataDir);
let def = null;
for (const d of config.biomes.values()) {
  if (d && d.bitmapCaves && d.bitmapCaves.name === "bitmap_hills") { def = d; break; }
}
if (!def) { console.error("no biome def carries bitmap_hills"); process.exit(1); }

const post = buildPost(dataDir, def, 78633191);
const pre = buildPre(dataDir, def, 78633191);
unlinkSync(tmpMod); // untrack the sibling copy

const rows = Object.keys(grid).filter((k) => /^y\d+$/.test(k))
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

const rms = (a, b) => {
  let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s / a.length);
};
const carved = (v) => v < 0.9999; // anything the writers touched

console.log("row    refCarved preCarved postCarved   rmsPre  rmsPostAdd  |  bestRmsPre  bestRmsPost (shift ±dx6 ±dy8 over the FULL field)");
let sumRef = 0, sumPre = 0, sumPost = 0;
for (const k of rows) {
  const y = Number(k.slice(1));
  const ref = grid[k];
  const preRow = ref.map((_, i) => pre.field[y * pre.w + i]);
  const postRow = ref.map((_, i) => post.field[y * post.w + i]);
  const rc = ref.filter(carved).length;
  const pc = preRow.filter(carved).length;
  const qc = postRow.filter(carved).length;
  sumRef += rc; sumPre += pc; sumPost += qc;
  const best = (field, w) => {
    let m = Infinity;
    for (let dy = -8; dy <= 8; dy++) {
      const yy = y + dy; if (yy < 0 || yy >= field.length / w) continue;
      for (let dx = -6; dx <= 6; dx++) {
        const cand = ref.map((_, i) => {
          const xx = i + dx;
          return (xx >= 0 && xx < w) ? field[yy * w + xx] : 1;
        });
        m = Math.min(m, rms(cand, ref));
      }
    }
    return m;
  };
  const bP = best(pre.field, pre.w), bQ = best(post.field, post.w);
  console.log(
    `${k.padEnd(6)} ${String(rc).padStart(9)} ${String(pc).padStart(10)} ${String(qc).padStart(11)}   ` +
    `${rms(preRow, ref).toFixed(4)}  ${rms(postRow, ref).toFixed(4)}  |  ${bP.toFixed(4)}  ${bQ.toFixed(4)}`
  );
}
const rc0 = grid["y0_x0_31"].filter(carved).length;
const pc0 = Array.from({ length: 32 }, (_, i) => pre.field[i]).filter(carved).length;
const qc0 = Array.from({ length: 32 }, (_, i) => post.field[i]).filter(carved).length;
console.log(`y0x0..31 ${rc0} / ${pc0} / ${qc0} (the image-lane writer is not in this port — context only)`);
console.log(`Σ carved ref/pre/post (12-sample rows): ${sumRef} / ${sumPre} / ${sumPost}`);
console.log(`shift-tolerant Σ(best-rms): measured — post-patch does NOT recover under the window ⇒ the divergence is presence-type (see I31 + entry (127) AMEND), not registration.`);
