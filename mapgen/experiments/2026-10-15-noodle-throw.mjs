// 2026-10-15-noodle-throw.mjs — AUDIT diagnostic (no fix): stage-by-stage
// reproduction of the noise-lane chunk evaluation at HEAD for the DEAD
// (noiseAt null => black) and all-AIR filler defs, with the SILENT catches
// opened up: which stage throws, and for the all-air defs what the field /
// r-site actually produce. Lane mirror = the SURFACE_V2 branch of
// noiseChunkMask (the full-stack lane: SURFACE_V2 wins the branch).
// Run: SURFACE_V2=1 SURFACE_V3=1 node mapgen/experiments/2026-10-15-noodle-throw.mjs
// (METER-CLASS: E1 counts — solid/air/throw counts per chunk.)

const flags = `V2=${process.env.SURFACE_V2 ?? "-"} V3=${process.env.SURFACE_V3 ?? "-"}`;
const seed = Number(process.env.MASK_SEED ?? 78633191);
console.log(`[throw] flags ${flags} seed ${seed}`);

const { findNoitaDataDir } = await import("../lib/paths.mjs");
const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
// ensureSurfaceTable/biomeCfg/uidFrom/makeGradAt are internals — not part of
// noise-terrain.mjs's export surface (the API-surface test pins it) — so the
// instrument builds an export-augmented sibling at RUNTIME and deletes it
// right after import: no committed temp module, no lib change.
const fsp = await import("node:fs/promises");
const ntSrc = await fsp.readFile(new URL("../lib/noise-terrain.mjs", import.meta.url), "utf8");
const augmented = ntSrc.replace(/^function (ensureSurfaceTable|biomeCfg|uidFrom|makeGradAt)\(/gm, "export function $1(");
const tmpUrl = new URL("../lib/.audit-nt.generated.mjs", import.meta.url);
await fsp.writeFile(tmpUrl, augmented);
const nt = await import(tmpUrl.href);
await fsp.unlink(tmpUrl);
const proto = await import("../lib/noise-proto.mjs");
const { classify } = await import("../lib/surface-level.mjs");

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const SKY = 48, W = 71, CHUNK = 512, DEF_SEED = 0;

const errLine = (e) => `${e?.constructor?.name}: ${e?.message} | ${(e?.stack ?? "").split("\n").slice(1, 4).join(" << ")}`;

// probe cells: first band cell per interesting def (grid -1, ty 62..95)
const want = new Set(["solid_wall.xml", "solid_wall_tower.xml", "lava.xml", "temple_wall.xml", "lake.xml", "empty.xml", "desert.xml", "winter.xml"]);
const probes = [];
for (let ty = 62; ty <= 95 && probes.length < 12; ty++) {
  for (let tx = 0; tx < 71; tx++) {
    if (worldGridHasArea(tx, ty)) continue;
    const at = biomeAt(config, tx, ty - SKY);
    const fn = at ? at.biome.filename.split("/").pop() : null;
    if (fn && want.has(fn) && !probes.some((p) => p.fn === fn)) probes.push({ fn, tx, ty, def: at.biome });
    if (probes.length >= 12) break;
  }
}
function worldGridHasArea(_tx, _ty) {
  // mirror loadWangWorld's grid rule: templateFile biomes occupy the grid;
  // everything else is the noise lane. (Areas only exist for templateFile.)
  return false; // probes below are re-checked via def.templateFile
}

for (const p of probes) {
  if (p.def.templateFile) { console.log(`[throw] ${p.fn} (${p.tx},${p.ty}) HAS templateFile — skip`); continue; }
  console.log(`\n[throw] === ${p.fn} @ (${p.tx},${p.ty}) ===`);
  // 0) the real function (silent catches intact)
  let real = null, realErr = null;
  try { real = nt.noiseChunkMask(config, p.tx, p.ty, seed); } catch (e) { realErr = e; }
  if (realErr) console.log(`[throw]   noiseChunkMask ESCAPED throw: ${errLine(realErr)}`);
  else if (!real) console.log(`[throw]   noiseChunkMask => null (swallowed somewhere)`);
  else {
    let s = 0; for (const v of real.mask) s += v;
    console.log(`[throw]   noiseChunkMask => mask, solids=${s}/${real.mask.length}`);
  }
  // 1) stage replication (V2 lane frame)
  let table = null;
  try { table = nt.ensureSurfaceTable(dataDir, p.def); console.log(`[throw]   ensureSurfaceTable => ${table ? `OK comps=${table.components.length}` : "null"}`); }
  catch (e) { console.log(`[throw]   ensureSurfaceTable THREW: ${errLine(e)}`); table = null; }
  let uid;
  try {
    uid = nt.uidFrom(p.def, nt.biomeCfg(p.def));
    uid.driver = nt.makeBandDriver(config, seed);
    console.log(`[throw]   uidFrom+driver OK (noiseKind=${uid.noiseKind} gradWCoef=${uid.gradWCoef} perlinCoef=${uid.perlinCoef} addNoise=${uid.addNoise} band[A,B]=[${uid.gradStartY},${uid.gradEndY}])`);
  } catch (e) { console.log(`[throw]   uidFrom/driver THREW: ${errLine(e)}`); continue; }
  let gradAt = null, gradKind = "ramp";
  try { gradAt = nt.makeGradAtFromTopology(dataDir, p.def); if (gradAt) gradKind = "topology"; else gradAt = nt.makeGradAt(p.def); }
  catch (e) { console.log(`[throw]   gradAt build THREW: ${errLine(e)}`); continue; }
  // 2) cell loop with per-stage try/catch + field stats
  let nThrowSF = 0, nThrowCls = 0, firstErr = null, above = 0, n = 0;
  const vs = [];
  outer:
  for (let cy = 0; cy < 52; cy++) {
    for (let cx = 0; cx < 52; cx++) {
      const gx = p.tx * CHUNK + cx * 10 + 5;
      const gy = p.ty * CHUNK + cy * 10 + 5;
      let v;
      // dig #146: surfaceField no longer takes gradAt/valueOfP94 (field0
      // ≡ 1.0) — the gradAt build above is this probe's stage telemetry only.
      try { v = proto.surfaceField(uid, gx, gy, DEF_SEED); }
      catch (e) { nThrowSF++; firstErr = firstErr ?? { stage: `surfaceField`, e, gx, gy, cx, cy }; n++; break outer; }
      n++;
      if (vs.length < 5) vs.push(v);
      if (v > 0.5) {
        above++;
        if (table) {
          try { classify(table, gx, gy - 24576, v); }
          catch (e) { nThrowCls++; firstErr = firstErr ?? { stage: `classify`, e, gx, gy, cx, cy }; break outer; }
        }
      }
    }
  }
  const vMin = Math.min(...vs), vMax = Math.max(...vs);
  console.log(`[throw]   cells=${n} v>0.5=${above} sampleV=[${vs.map((x) => x.toFixed(4)).join(", ")}]`);
  if (firstErr) {
    console.log(`[throw]   FIRST THROW at ${firstErr.stage} cell(cx,cy)=(${firstErr.cx},${firstErr.cy}) g=(${firstErr.gx},${firstErr.gy}) after ${n} cells: ${errLine(firstErr.e)}`);
  } else if (real && !real.mask) {
    console.log(`[throw]   no stage threw in replication but real fn returned null?!`);
  }
}
process.exit(0);
