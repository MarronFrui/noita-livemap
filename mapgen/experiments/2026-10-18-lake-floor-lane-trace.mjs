// Lake-floor lane trace (dig #169 instrument, I39a): attribute EVERY cell of
// tile (40,14) = the mountain_lake splice site to the worldColorAt lane that
// paints it (area-bin / template art / noise / none), and cross-tabulate vs
// the art class (blitSplicedScenes' paint classification, C143) and the
// capture (ref solidity + mean color). Answers "what OUR floor is made of"
// and "what the GAME shows at each deferral class" — the I39a census that
// frames the floor-spawn read. Lane = C79's (SURFACE_V3=1 required).
// Output: console tables + mapgen/out/lake-floor-lane-trace.json (M-grade).
//
// The lane mirror below re-implements worldColorAt's ty>=62 branch ORDER
// (world-gen.mjs:157-221) and is VALIDATED per cell against the real
// worldColorAt output — any mismatch fails the run (exit 1).
//
// PREDICTION (pre-registered before the first run, per the charter):
// P1 lane census: template lane = exactly 79000 cells (the splice art — the
//    dig-#168 count law says the lake chunk's buffer holds NO seeded-fBm
//    fill), area lane = 0 (mountain_lake's wang_template_file="" ⇒ no grid
//    entry). FALSIFIER: template != 79000 or area > 0 (either = I39's "A5
//    seeded-fBm fill" claim was right about the LAKE after all).
// P2 floor source: >=80% of the red (ref-solid/gen-air) cells attribute to
//    the NOISE lane's air arm — our floor = the V3 evaluator chain saying
//    AIR where the game's terrain is solid. FALSIFIER: the red cells are
//    mostly `none` (bg/detached) or template-lane.
// P3 water: the ref's water cells stay inside the art's water hits (extra
//    water outside the art <= 2% of the tile) — no game-side water-fill law
//    beyond the scene. FALSIFIER: >5% extra water = the game fills the bowl
//    itself (a floor-spawn law to read).

import fs from "node:fs";
import path from "node:path";

const LANE_V3 = process.env.SURFACE_V3 === "1";
if (!LANE_V3) { console.error("refusing: SURFACE_V3=1 required (C79 lane)"); process.exit(2); }

const { findNoitaDataDir, repoRoot, CAPTURE_SEED } = await import("../lib/paths.mjs");
const { ensureWorld, worldColorAt, SKY_ROWS, CHUNK, WORLD_CHUNKS_W } =
  await import("../lib/world-gen.mjs");
const { biomeAt } = await import("../lib/biomes.mjs");
const { readPng } = await import("../lib/images.mjs");
const { loadMaterials, materialColorByName } = await import("../lib/colorize.mjs");

const AIR_THRESHOLD = 24;
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const TX = 40, BTY = 14;

const cacheDir = path.join(repoRoot, "mapgen/out/gen-cache/r3i");
const dataDir = findNoitaDataDir();
const world = ensureWorld(CAPTURE_SEED, dataDir, { cacheDir });
await world.ready;

const ref = readPng(path.join(repoRoot, `mapgen/out/ref/${TX}_${BTY}.png`));
const art = readPng(path.join(dataDir, "biome_impl/spliced/mountain_lake.png"));
const materials = loadMaterials(dataDir);

// ---- art classification (mirror of blitSplicedScenes' law, C143) ---------
function artClass(q) {
  const a = art.data[q + 3];
  if (a < 10) return "trans"; // alpha<10: scene air, below shows
  const r = art.data[q], g = art.data[q + 1], b = art.data[q + 2];
  if (r === 0 && g === 0 && b === 0) return "black";
  const hex = r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
  const name = materials.get(hex);
  if (name === undefined) return "miss";
  if (name === "air") return "air-hit";
  return `hit:${name}`;
}

// ---- the lane mirror (worldColorAt ty>=62 branch, world-gen.mjs:157-221) --
function laneAt(gx, gy) {
  const tx = Math.floor(gx / CHUNK), ty = Math.floor(gy / CHUNK);
  const idx = world.grid[ty * WORLD_CHUNKS_W + tx];
  if (idx >= 0) {
    const a = world.areas[idx];
    const m = world.maps.get(a.key);
    if (m) {
      const lx = gx - a.area.x1 * CHUNK, ly = gy - (a.area.y1 + SKY_ROWS) * CHUNK;
      if (lx >= 0 && ly >= 0 && lx < m.w * 10 && ly < m.h * 10) {
        const ax = Math.floor(lx / 10), ay = Math.floor(ly / 10);
        const p = 3 * (ay * m.w + ax);
        const r = m.rgb[p], g = m.rgb[p + 1], b = m.rgb[p + 2];
        const airDark = (r === 13 && g === 14 && b === 18) || (r === 12 && g === 13 && b === 17)
          || (r === 16 && g === 16 && b === 18) || (r === 21 && g === 23 && b === 30);
        return { lane: airDark ? "area-bg" : "area", rgb: [r, g, b] };
      }
    }
  }
  const key = `${tx},${ty}`;
  const buf = world.templates?.get(key);
  if (buf) {
    const o = 3 * ((gy - ty * CHUNK) * CHUNK + (gx - tx * CHUNK));
    if (buf[o] !== 9 || buf[o + 1] !== 9 || buf[o + 2] !== 9) {
      return { lane: "template", rgb: [buf[o], buf[o + 1], buf[o + 2]] };
    }
  }
  const nz = world.noiseSolidAt?.(gx, gy);
  if (nz != null) {
    const mat = world.noiseMatAt?.(gx, gy);
    let rgb = null;
    if (mat && mat.idx !== 255 && mat.names && mat.names[mat.idx] && world.dataDir) {
      rgb = materialColorByName(world.dataDir, mat.names[mat.idx]);
    }
    if (nz) {
      const dark = ty - SKY_ROWS > 26 || ty - SKY_ROWS < -6;
      const shade = rgb ?? [(dark ? 0x1b : 0x6a), (dark ? 0x1b : 0x5a), (dark ? 0x1b : 0x44)];
      return { lane: "noise-solid", rgb: shade };
    }
    const bgr = world.bgImageAt?.(tx, ty, gx, gy);
    return { lane: bgr ? "noise-air-bg" : "noise-air-null", rgb: bgr ?? null };
  }
  return { lane: "none", rgb: null };
}

// ---- the census ----------------------------------------------------------
const N = 512 * 512;
const laneCensus = new Map();
const biomeCensus = new Map();
const classTable = new Map();
const bands = [];
for (let b = 0; b < 16; b++) bands.push({ y0: b * 32, n: 0, fR: 0, fG: 0, refOnly: 0, genOnly: 0, missN: 0, missR: 0, missG: 0 });
let mismatches = 0, mismatchEx = [];
let refOnly = 0, genOnly = 0, fRtot = 0, fGtot = 0;
// water probes (P3): ref water-ish = blue-dominant non-dark
const isWater = (r, g, b) => b > 60 && b > r + 30 && g > 30;
let refWaterOutsideArt = 0, artWaterNotRefWater = 0;

for (let j = 0; j < 512; j++) {
  for (let i = 0; i < 512; i++) {
    const px = TX * CHUNK + i, py = (BTY + SKY_ROWS) * CHUNK + j;
    const gx = px + 11, gy = py + 12;
    const { lane, rgb } = laneAt(gx, gy);
    const col = worldColorAt(world, px, py);
    const same = (rgb === null && col === null)
      || (rgb !== null && col !== null && rgb[0] === col[0] && rgb[1] === col[1] && rgb[2] === col[2]);
    if (!same) {
      mismatches++;
      if (mismatchEx.length < 3) mismatchEx.push({ px, py, lane, mirror: rgb, real: col });
    }
    laneCensus.set(lane, (laneCensus.get(lane) ?? 0) + 1);
    const def = biomeAt(world.config, Math.floor(gx / CHUNK), Math.floor(gy / CHUNK) - SKY_ROWS)?.biome;
    const bname = def?.name ?? "?";
    biomeCensus.set(bname, (biomeCensus.get(bname) ?? 0) + 1);

    const rq = 4 * (j * 512 + i);
    const ac = artClass(rq);
    const rr = ref.data[rq], rg = ref.data[rq + 1], rb = ref.data[rq + 2];
    const rSolid = lum(rr, rg, rb) >= AIR_THRESHOLD ? 1 : 0;
    const gSolid = col ? (lum(col[0], col[1], col[2]) >= AIR_THRESHOLD ? 1 : 0) : 0;

    let t = classTable.get(ac);
    if (!t) t = { n: 0, refSolid: 0, genSolid: 0, lanes: new Map(), refR: 0, refG: 0, refB: 0, genR: 0, genG: 0, genB: 0, genN: 0 };
    t.n++; t.refSolid += rSolid; t.genSolid += gSolid;
    t.lanes.set(lane, (t.lanes.get(lane) ?? 0) + 1);
    t.refR += rr; t.refG += rg; t.refB += rb;
    if (col) { t.genR += col[0]; t.genG += col[1]; t.genB += col[2]; t.genN++; }
    classTable.set(ac, t);

    if (rSolid && !gSolid) refOnly++;
    if (!rSolid && gSolid) genOnly++;
    fRtot += rSolid; fGtot += gSolid;
    const band = bands[Math.floor(j / 32)];
    band.n++; band.fR += rSolid; band.fG += gSolid;
    if (rSolid && !gSolid) band.refOnly++;
    if (!rSolid && gSolid) band.genOnly++;
    if (ac === "miss") { band.missN++; band.missR += rSolid; band.missG += gSolid; }

    if (isWater(rr, rg, rb) && !(ac === "hit:water")) refWaterOutsideArt++;
    if (ac === "hit:water" && !isWater(rr, rg, rb)) artWaterNotRefWater++;
  }
}

if (mismatches > 0) {
  console.error(`LANE MIRROR INVALID: ${mismatches} cells disagree with worldColorAt`, JSON.stringify(mismatchEx));
  process.exit(1);
}

// ---- report --------------------------------------------------------------
const pct = (x) => (100 * x / N).toFixed(3) + "%";
console.log(`tile ${TX}_${BTY}  (lane mirror = worldColorAt, mismatches 0)`);
console.log("lane census:");
for (const [k, v] of [...laneCensus.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${String(v).padStart(7)}  ${pct(v)}`);
console.log("biome census:");
for (const [k, v] of [...biomeCensus.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${String(v).padStart(7)}  ${pct(v)}`);
console.log("art class × ref/gen:");
for (const [k, t] of [...classTable.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const lanes = [...t.lanes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l, c]) => `${l}:${c}`).join(" ");
  const mean = (r, g, b, n) => n ? `(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})` : "-";
  console.log(`  ${k.padEnd(14)} n=${String(t.n).padStart(6)} refSolid=${(t.refSolid / t.n).toFixed(3)} genSolid=${(t.genSolid / t.n).toFixed(3)} refMean=${mean(t.refR, t.refG, t.refB, t.n)} genMean=${mean(t.genR, t.genG, t.genB, t.genN)} [${lanes}]`);
}
console.log(`fR=${(fRtot / N).toFixed(5)}  fG=${(fGtot / N).toFixed(5)}  refOnly=${refOnly} (${pct(refOnly)})  genOnly=${genOnly} (${pct(genOnly)})`);
console.log("row bands (32 rows each):  miss* = the art-deferred cells only (the game's floor vs ours)");
for (const b of bands) console.log(`  y${String(b.y0).padStart(4)}..${String(b.y0 + 31).padStart(4)}  fR=${(b.fR / b.n).toFixed(3)} fG=${(b.fG / b.n).toFixed(3)} refOnly=${String(b.refOnly).padStart(5)} genOnly=${String(b.genOnly).padStart(5)}   miss refSolid=${b.missN ? (b.missR / b.missN).toFixed(3) : "-"} genSolid=${b.missN ? (b.missG / b.missN).toFixed(3) : "-"} (n=${b.missN})`);
console.log(`P3 water: refWaterOutsideArt=${refWaterOutsideArt} (${pct(refWaterOutsideArt)})  artWaterNotRefWater=${artWaterNotRefWater}`);

const out = {
  tile: `${TX}_${BTY}`, seed: CAPTURE_SEED, lane: "SURFACE_V3",
  mirrorMismatches: mismatches,
  laneCensus: Object.fromEntries(laneCensus),
  biomeCensus: Object.fromEntries(biomeCensus),
  refOnly, genOnly, fR: fRtot / N, fG: fGtot / N,
  water: { refWaterOutsideArt, artWaterNotRefWater },
  bands: bands.map((b) => ({ y0: b.y0, fR: b.fR / b.n, fG: b.fG / b.n, refOnly: b.refOnly, genOnly: b.genOnly, missN: b.missN, missRefSolid: b.missN ? b.missR / b.missN : null, missGenSolid: b.missN ? b.missG / b.missN : null })),
  classes: Object.fromEntries([...classTable.entries()].map(([k, t]) => [k, {
    n: t.n, refSolid: t.refSolid / t.n, genSolid: t.genSolid / t.n,
    lanes: Object.fromEntries(t.lanes),
    refMean: [Math.round(t.refR / t.n), Math.round(t.refG / t.n), Math.round(t.refB / t.n)],
    genMean: t.genN ? [Math.round(t.genR / t.genN), Math.round(t.genG / t.genN), Math.round(t.genB / t.genN)] : null,
  }])),
};
fs.writeFileSync(path.join(repoRoot, "mapgen/out/lake-floor-lane-trace.json"), JSON.stringify(out, null, 1));
console.log("wrote mapgen/out/lake-floor-lane-trace.json");
