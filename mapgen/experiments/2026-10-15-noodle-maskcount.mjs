// 2026-10-15-noodle-maskcount.mjs — AUDIT instrument (E1 presence counts):
// per filler chunk, does the noise lane produce (a) a DEAD chunk (noiseAt
// null => worldColorAt null => opaque black), (b) a mask whose solid
// fraction is 0 (all-air => flat bg art), ~0.5 (NOODLES), or 1 (all-solid)?
// Run with the lane flags in env BEFORE import (noise-terrain reads them
// at module load):
//   SURFACE_V2=1 SURFACE_V3=1 node mapgen/experiments/2026-10-15-noodle-maskcount.mjs
// Output: E1 table on stdout + mapgen/out/noodle-maskcount-<label>.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const label = process.argv[2] ?? `v2${process.env.SURFACE_V2 === "1" ? "1" : "0"}v3${process.env.SURFACE_V3 === "1" ? "1" : "0"}`;
const seed = Number(process.env.MASK_SEED ?? 78633191);

const { findNoitaDataDir } = await import(path.join(REPO, "mapgen/lib/paths.mjs"));
const { loadBiomeConfig, biomeAt } = await import(path.join(REPO, "mapgen/lib/biomes.mjs"));
const wg = await import(path.join(REPO, "mapgen/lib/world-gen.mjs"));

console.log(`[maskcount:${label}] env SURFACE_V2=${process.env.SURFACE_V2 ?? "-"} SURFACE_V3=${process.env.SURFACE_V3 ?? "-"} seed=${seed}`);

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const world = wg.ensureWorld(seed, dataDir, {
  cacheDir: path.join(REPO, "mapgen/out/gen-cache/r3i"),
});
await world.ready;

const SKY = 48, W = 71;
// E1 census over the whole underground band (ty 62..95): every cell with a
// def and no wang area (the noise-lane population), grouped by def.
const stats = new Map();
for (let ty = 62; ty <= 95; ty++) {
  for (let tx = 0; tx < 71; tx++) {
    if (world.grid[ty * W + tx] !== -1) continue;
    const at = biomeAt(config, tx, ty - SKY);
    const def = at ? at.biome.filename.split("/").pop() : "(null-no-def)";
    if (!stats.has(def)) stats.set(def, { def, chunks: 0, dead: 0, solids: [], attachMissing: typeof world.noiseSolidAt !== "function" });
    const s = stats.get(def);
    s.chunks++;
    const ch = world.noiseAt(tx, ty);
    if (!ch || !ch.mask) { s.dead++; s.solids.push(null); continue; }
    let sum = 0;
    for (let i = 0; i < ch.mask.length; i++) sum += ch.mask[i];
    s.solids.push(sum / ch.mask.length);
  }
}
const rows = [...stats.values()].sort((a, b) => b.chunks - a.chunks);
console.log(`[maskcount:${label}] E1 (chunk classes: DEAD=noiseAt null => every px black; AIR=0 solid; NOISE=0<f<1; SOLID=f=1)`);
for (const s of rows) {
  const live = s.solids.filter((v) => v !== null);
  const mean = live.length ? live.reduce((a, b) => a + b, 0) / live.length : 0;
  const dist = { DEAD: s.dead, AIR: live.filter((v) => v === 0).length, NOISE: live.filter((v) => v > 0 && v < 1).length, SOLID: live.filter((v) => v === 1).length };
  console.log(`[maskcount:${label}] ${s.def.padEnd(34)} chunks=${String(s.chunks).padStart(3)} ${JSON.stringify(dist)} meanSolid=${mean.toFixed(3)}`);
}
const out = path.join(REPO, "mapgen/out", `noodle-maskcount-${label}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  label, seed, flags: { v2: process.env.SURFACE_V2 ?? null, v3: process.env.SURFACE_V3 ?? null },
  rows: rows.map((s) => ({ def: s.def, chunks: s.chunks, dead: s.dead, solids: s.solids })),
}, null, 2));
console.log(`[maskcount:${label}] wrote ${out}`);
process.exit(0);
