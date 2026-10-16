// dig #155 probe — the lake-family uid-pipe counts (pre/post-fix value census).
// Runs the V3 kind-0 lane's noiseChunkMask on the four lake tiles with
// SURFACE_LOG=… and summarizes: the resolved uid slots (addValue/noiseKind),
// the field>0.5 gate counts, the solid counts (fG = solids/2704).
// Usage: SURFACE_V3=1 SURFACE_LOG=<path> node experiments/2026-10-17-dig155-lake-pipe-probe.mjs [label]
//            [--tiles 4,5,9,10] [--seed 78633191]   (tiles at bty 14, the lake band)
import fs from "node:fs";

const { findNoitaDataDir } = await import("../lib/paths.mjs");
const { loadBiomeConfig } = await import("../lib/biomes.mjs");
const { noiseChunkMask } = await import("../lib/noise-terrain.mjs");

const dataDir = findNoitaDataDir();
const cfg = loadBiomeConfig(dataDir);
const seed = process.argv.includes("--seed") ? Number(process.argv[process.argv.indexOf("--seed") + 1]) : 78633191;
const tilesArg = process.argv.includes("--tiles")
  ? Number(process.argv[process.argv.indexOf("--tiles") + 1].split(",").map(Number).at(0)) ?? [4, 5, 9, 10]
  : [4, 5, 9, 10];
const canv = (tx) => tx;
const BTY = 14;
const TTY = BTY + 48; // noiseChunkMask's frame = the canvas ty (biomeAt(config, tx, ty - SKY_ROWS))

const logPath = process.env.SURFACE_LOG;
const summary = [];
for (const tx of tilesArg) {
  const recs = [];
  if (logPath) fs.writeFileSync(logPath, ""); // fresh per tile
  try {
    const outcome = noiseChunkMask(cfg, tx, TTY, seed);
    summary.push({ tx, bty: BTY, ty: TTY, kind: outcome ? "chunk" : "null" });
    // noiseChunkMask returns {mask,...}; the JIT numbers come from the JSONL
  } catch (e) {
    summary.push({ tx, bty: BTY, threw: String(e).slice(0, 120) });
  }
  if (logPath && fs.existsSync(logPath)) {
    for (const line of fs.readFileSync(logPath, "utf8").split("\n")) {
      if (line.trim()) recs.push(JSON.parse(line));
    }
  }
  if (recs.length) {
    const uid0 = recs[0].uid ?? {};
    const above = recs.filter((r) => r.solid);
    const fields = recs.map((r) => r.field).filter((v) => typeof v === "number");
    const fsol = fields.filter((v) => v > 0.5).length;
    summary.push({
      tx, bty: BTY,
      uid_dump: {
        addValue: uid0.addValue, noiseKind: uid0.noiseKind, mode: uid0.mode,
        gradSlopeStartX: uid0.gradSlopeStartX, gradSlopeDelta: uid0.gradSlopeDelta,
        gradWCoef: uid0.gradWCoef, perlinCoef: uid0.perlinCoef,
        sx: uid0.sx, sy: uid0.sy, scaleMin: uid0.scaleMin, scaleMax: uid0.scaleMax,
        addNoise: uid0.addNoise, fbm: uid0.fbm,
      },
      gradKind: recs[0].gradKind,
      cells: recs.length,
      gatePass: fsol,
      solid: above.length,
      fG: +(above.length / 2704).toFixed(5),
      fieldMin: +Math.min(...fields).toFixed(4),
      fieldMax: +Math.max(...fields).toFixed(4),
      fieldMed: +fields.sort((a, b) => a - b)[fields.length >> 1].toFixed(4),
    });
  }
}
fs.writeFileSync(`mapgen/out/dig155-lake-pipe-${process.argv[2] ?? "unlabeled"}.json`, JSON.stringify({ probe: "2026-10-17-dig155", seed, label: process.argv[2] ?? "unlabeled", summary }, null, 1));
console.log(JSON.stringify(summary, null, 1));
