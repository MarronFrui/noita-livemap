// 2026-10-16-dig145-fix-probe.mjs — DIG #145 instrument (I33): the kind-0
// r-site FRAME fix (V2 canvas→world px, C80) + the uid attr-law restoration
// (noise_type enum → [+0x220], mInsideNoiseType → [+0x224] with the ctor
// default 5, fbm [+0x228] ctor default 1, perlinCoef/scaleMin/Max ctor
// defaults), measured at the composed-lane level. Flags-ON lane (V2+V3;
// noiseChunkMask checks V2 first, so V2 = the live production path).
// No server — in-process noiseChunkMask against the extracted data; the
// user's :8082 untouched.
//
// METER-CLASS: E1 (solid-cell counts, fall/throw counts, mask-hash
// equality counts over same-def pairs, addNoise enum census).
//
// PREDICTIONS (pre-registered 2026-10-16 BEFORE the first post-fix run;
// falsifiers named; PRE-FIX baselines = previously measured numbers).
// The three tripwire fixtures' band windows were derived from the band law
// (bandParams mode arms + rampGate) BEFORE any run:
// P-1a empty(15,62) x seeds 78633191/500412504: 0 < solids < 2704
//      (textured — mode 1's noise arm jitters A/B per column, r ∈ ~0.64..0.81
//      across wy 1..511 ⇒ rp crosses the 0.5 gate). PRE-FIX: 0/2704 all six
//      (I33 field-fact addendum, dig #144 — the canvas y ≫ B saturated
//      rampGate at 1.0 with the capped field0 ⇒ a CONSTANT field < 0.5).
//      FALSIFIED if any chunk measures 0 (still collapsed) or 2704 (flood).
// P-1b lake(4,y)/lake_statue(6,y), y ∈ 62..68 x both seeds: the mode-3
//      slope (SlopeStartX −12000, SlopeDelta −0.37) at wx ≈ −15.8k slides
//      the window DOWN s ≈ +1.25..1.43k px ⇒ row 62 (wy 1..511) stays
//      legitimately air (the game's lake air gap above the water), and the
//      field crossing lands ~wy 1.7-2.1k = rows 65/66 (tilted with x).
//      PREDICTION: row-62 solids = 0, and >=1 textured chunk (0<s<2704)
//      within rows 62..68 per def per seed. FALSIFIED if the whole window
//      is all-air (the collapse persists) or any chunk all-solid.
// P-2  kind-1 pockets (solid_wall_hidden_cavern/teleroom/friend_1/
//      friend_4/solid_wall, ground band, both seeds): 0 fall-through
//      cells — the dig-#145 kind default (noiseKind = the [+0x224] ctor
//      default 5, never -1) removes the throw. PRE-FIX: every non-template
//      cell fell through (I33 addendum: noiseDispatch kind=-1 UNREAD).
//      FALSIFIED by ANY non-template null.
// P-3  kind-0 same-def pairs (H/V/far, ground band): mask hashes ALL
//      DIFFER — the field is a pure function of world px (world-anchored).
//      PRE-FIX: all-air masks ⇒ every pair identical (the falsifier
//      state). FALSIFIED by ANY identical pair.
// P-4  BitmapCaves (hills/desert/winter) same-def pairs: hashes IDENTICAL
//      — dig #144's per-chunk shape re-anchor (the direct cell read, dig
//      #121) is untouched by the flip (the V2 caves wrapper keeps its
//      canvas args). FALSIFIED by ANY differing pair.
// P-5  addNoise census over the ground band: values ∈ {3, 0} only —
//      noise_type=SIN_CAPPED_SIMPLEX ⇒ 3 (all 36 defs), absent ⇒ 0
//      (CE-35's measured {3,0}). FALSIFIED by any value outside {0,3} or
//      a noise_type-carrying def not measuring 3.
// P-6  fbm (ctor default 1 = ON for every def; the 6 live files all carry
//      mInsideNoiseFBM="1"): fbm4 varies over 16 world coords at kind 5
//      (non-constant). FALSIFIED by a constant output.
// P-7  (companion re-run, instrument mapgen/experiments/2026-10-15-
//      dig144-composed-trace.mjs --label dig145) lane shares: kind-0
//      filler noise-solid cells > 0 (PRE-FIX: noise-air-bg 78.2%, the
//      field all-air); kind-1 pockets noise-chunk-null → 0 (PRE-FIX
//      13.5%); the caves filler lane and its hashes unchanged (PRE-FIX
//      83.2-86.7% noise-solid-mat). FALSIFIED if kind-0 noise-solid stays
//      0, kind-1 nulls persist, or any caves pair hash flips.
// P-8  (companion re-run, C93 census SURFACE_V2=1 node mapgen/experiments/
//      2026-10-06-v2-chunk-census.mjs): falls 1625 → 0 (the kind-1 throw
//      path is closed); COMPUTES 663 → 2288. Density/texture counts are
//      REPORT-ONLY (the routing + default changes move values; no
//      prediction). FALSIFIED if any fall remains.
//
// Output: stdout table + mapgen/out/dig145-fix-probe.json
//
// ═══ RUN-1 AMENDMENT (2026-10-16, AFTER run 1, BEFORE run 2) ═══════════════
// Run 1 falsified/observed (report-only; the charter's out-of-prediction =
// a byte read, never accommodation):
//   • P-1a empty(15,62) = 0/2704 — mechanism READ: the (A)-debt ramp
//     instrument (makeGradAt) fed field0 up to ~102 (empty's LowNoise/
//     HighNoise −292.6/+234.1) ⇒ rp ≫ 0.85 ⇒ the case-3 arm's
//     acos(x·(1/1024)) went out of domain ⇒ NaN ⇒ air (verified in the
//     fresh dump: mulsd 0x11dfb50 → call 0x1033a22 @0x90ae7f..90ae87,
//     x at [ebp−0x44] = the raw world px; NaN→air = comiss-unordered ⇒
//     jbe, byte-faithful). FIX (byte-anchored): makeGradAt now clamps to
//     the C45 grid value law ±1.0 ⇒ rp ≤ 0.81 < 0.85 ⇒ the case-3 arm
//     unreachable on this lane ⇒ field = gradW·per + 0.871429·rp crosses
//     0.5. AMENDED P-1a: 0 < solids < 2704 at both seeds (falsifier: 0/2704).
//   • P-1b row-62 = 0 for the lakes — FALSIFIED by the seam branch my
//     hand arithmetic omitted (lx = gx&511 = 5 ≤ 41 ⇒ blend with the left
//     neighbor; measured lake ty62 = 7/13 solids at cx0, lake_statue
//     ty63 = 214 — the band matrix entries read exactly A=−1024/B=1024/
//     mode=3/slopeX=−12000/Δ=−0.37, verified). AMENDED P-1b: ≥1 textured
//     chunk (0<s<2704) within rows 62..68 per def per seed, NO row-level
//     zero-pin (falsifier: whole window all-air or any all-solid).
//   • M2/M3/M4 run-1 were VACUOUS — biomeAt().biome.filename carries the
//     data/biome/ prefix (basename fix) and the pockets live at rows
//     63..100, not 62 (layout read this session: solid_wall 834 cells,
//     hidden_cavern 4, friend_1/friend_4/teleroom 1 each, rows 62..100).
//   • M3 empty: a SINGLE ground cell exists in this world ((15,62)) ⇒ the
//     pair law rides on lake (11 cells) + lake_statue (3 cells).
// AMENDED P-2: over the 841 non-template pocket cells/seed, 0 fall-through.

process.env.SURFACE_V2 ??= "1"; // must precede the lib imports (module-load flags)
process.env.SURFACE_V3 ??= "1";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
const { noiseChunkMask, NOISE_TYPE_KIND } = await import("../lib/noise-terrain.mjs");
const { fbm4 } = await import("../lib/noise-proto.mjs");

// biomeAt().biome.filename carries the data/biome/ prefix — match basenames
const base = (fn) => (fn ?? "").split("/").pop();

const config = loadBiomeConfig("/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data");
const SEEDS = [78633191, 500412504];
const SKY_ROWS = 48;
const hash = (m) => crypto.createHash("sha256").update(Buffer.from(m)).digest("hex");
const solidsOf = (r) => [...r.mask].reduce((a, v) => a + v, 0);

const out = { m1_tripwire: [], m2_kind1: [], m3_kind0_pairs: [], m4_caves_pairs: [], m5_routing: null, m6_fbm: null };
const rows = [];

// ---- M1: the I33 tripwire (kind-0 filler ground chunks) -------------------
// empty pinned at (15,62); the lake family scanned rows 62..68 (P-1b: the
// mode-3 slope slides its window down at these x).
for (const seed of SEEDS) {
  for (const [tx, ty, fn] of [[15, 62, "empty.xml"]]) {
    const r = noiseChunkMask(config, tx, ty, seed);
    const rec = { tx, ty, fn, seed, nullChunk: !r, solids: r ? solidsOf(r) : null };
    if (r && base(r.def.filename) !== fn) rec.defect = `def=${r.def.filename}`;
    out.m1_tripwire.push(rec);
    rows.push(`M1 ${fn} (${tx},${ty}) seed ${seed}: ${r ? `${rec.solids}/2704 solids` : "NULL"}`);
  }
  for (const [tx, fn] of [[4, "lake.xml"], [6, "lake_statue.xml"]]) {
    const perRow = [];
    for (let ty = 62; ty <= 68; ty++) {
      const r = noiseChunkMask(config, tx, ty, seed);
      const s = r ? solidsOf(r) : null;
      const at = biomeAt(config, tx, ty - SKY_ROWS); // what lives there (a NULL = wrong def/template, not a throw)
      perRow.push({ ty, solids: s, nullChunk: !r, def: base(at?.biome?.filename) });
      out.m1_tripwire.push({ tx, ty, fn, seed, nullChunk: !r, solids: s, def: base(at?.biome?.filename) });
    }
    rows.push(`M1 ${fn} (${tx},62..68) seed ${seed}: ${perRow.map((p) => `ty${p.ty}=${p.nullChunk ? `NULL(${p.def})` : p.solids}`).join(" ")}`);
  }
}

// ---- M2: kind-1 pockets stop throwing -------------------------------------
// (the pocket defs live BELOW the surface band — rows 63..100 — per the
// kind-default probe's discovery window; basename match + non-template.)
for (const seed of SEEDS) {
  for (const fn of ["solid_wall_hidden_cavern.xml", "teleroom.xml", "friend_1.xml", "friend_4.xml", "solid_wall.xml"]) {
    let measured = 0, nulls = 0, templates = 0, solids = 0;
    const at0 = [];
    for (let ty = 62; ty <= 100; ty++) {
      for (let tx = 0; tx <= 70; tx++) {
        const at = biomeAt(config, tx, ty - SKY_ROWS);
        if (!at?.biome || base(at.biome.filename) !== fn) continue;
        if (at.biome.templateFile) { templates++; continue; }
        measured++;
        const r = noiseChunkMask(config, tx, ty, seed);
        if (!r) { nulls++; at0.push(`${tx}_${ty}`); } else solids += solidsOf(r);
      }
    }
    out.m2_kind1.push({ fn, seed, measured, nulls, templates, solids, nullCells: at0 });
    rows.push(`M2 ${fn} seed ${seed}: ${measured} cells (${templates} template-skip) — ${nulls} fall-through${at0.length ? ` at ${at0.slice(0, 6).join(",")}` : ""}, ${solids} solids`);
  }
}

// ---- M3/M4: anchor laws (kind-0 world-anchored vs caves per-chunk) --------
const anchorPairs = (fn, seed, band) => {
  const cells = [];
  for (let tx = 0; tx <= 70; tx++) {
    for (const ty of band) {
      const at = biomeAt(config, tx, ty - SKY_ROWS);
      if (!at?.biome || at.biome.templateFile || base(at.biome.filename) !== fn) continue;
      const r = noiseChunkMask(config, tx, ty, seed);
      if (r) cells.push({ tx, ty, h: hash(r.mask), s: solidsOf(r) });
    }
  }
  const pairs = [];
  for (const c of cells) {
    const h = cells.find((o) => o.tx === c.tx + 1 && o.ty === c.ty);
    const v = cells.find((o) => o.tx === c.tx && o.ty === c.ty + 1);
    if (h && !pairs.some((p) => p.kind === "H" && p.a.tx === c.tx && p.a.ty === c.ty)) pairs.push({ kind: "H", a: c, b: h });
    if (v && !pairs.some((p) => p.kind === "V" && p.a.tx === c.tx && p.a.ty === c.ty)) pairs.push({ kind: "V", a: c, b: v });
  }
  if (cells.length >= 2) pairs.push({ kind: "far", a: cells[0], b: cells[cells.length - 1] });
  return { cells, pairs: pairs.map((p) => ({ ...p, same: p.a.h === p.b.h })) };
};
for (const seed of SEEDS) {
  for (const fn of ["empty.xml", "lake.xml", "lake_statue.xml"]) {
    const { cells, pairs } = anchorPairs(fn, seed, [62, 63]);
    for (const p of pairs) {
      out.m3_kind0_pairs.push({ fn, seed, ...p });
      rows.push(`M3 ${fn} seed ${seed} ${p.kind} (${p.a.tx},${p.a.ty})-(${p.b.tx},${p.b.ty}): ${p.same ? "IDENTICAL" : "differ"} [${p.a.s}/${p.b.s} solids]`);
    }
    if (!pairs.length) rows.push(`M3 ${fn} seed ${seed}: no same-def pair in window (${cells.map((c) => `${c.tx}_${c.ty}:${c.s}`).join(" ") || "0 cells"})`);
  }
  for (const fn of ["hills.xml", "desert.xml", "winter.xml"]) {
    const { cells, pairs } = anchorPairs(fn, seed, [62, 63, 64]);
    for (const p of pairs) {
      out.m4_caves_pairs.push({ fn, seed, ...p });
      rows.push(`M4 ${fn} seed ${seed} ${p.kind} (${p.a.tx},${p.a.ty})-(${p.b.tx},${p.b.ty}): ${p.same ? "IDENTICAL" : "differ"} [${p.a.s}/${p.b.s} solids]`);
    }
    if (!pairs.length) rows.push(`M4 ${fn} seed ${seed}: no same-def pair in window (${cells.length} cells)`);
  }
}

// ---- M5: the addNoise routing census (ground band, seed A) ----------------
{
  const seed = SEEDS[0];
  const census = new Map();
  let noiseDefs = 0, attrless = 0;
  for (let tx = 0; tx <= 70; tx++) {
    const at = biomeAt(config, tx, 62 - SKY_ROWS);
    if (!at?.biome || at.biome.templateFile) continue;
    const v = NOISE_TYPE_KIND[at.biome.noiseType] ?? 0;
    census.set(v, (census.get(v) ?? 0) + 1);
    if (at.biome.noiseType) noiseDefs++; else attrless++;
  }
  out.m5_routing = { seed, census: Object.fromEntries(census), noiseDefs, attrless };
  rows.push(`M5 addNoise census (ground band tx0..70, seed ${seed}): ${JSON.stringify(out.m5_routing.census)} over ${noiseDefs} noise_type + ${attrless} attr-less cells`);
}

// ---- M6: fbm texture (the ctor-default-1 fbm path) ------------------------
{
  const samples = [];
  for (let i = 0; i < 16; i++) samples.push(fbm4(137.25 + i * 91.7, -220.5 + i * 53.3, 5));
  const distinct = new Set(samples.map((v) => v.toFixed(9))).size;
  out.m6_fbm = { samples: samples.map((v) => +v.toFixed(9)), distinct };
  rows.push(`M6 fbm4(kind 5) over 16 world coords: ${distinct} distinct values ${distinct > 1 ? "(varies)" : "(CONSTANT — FALSIFIED)"}`);
}

console.log(rows.join("\n"));
const outFile = path.join(REPO, "mapgen/out/dig145-fix-probe.json");
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`\nwrote ${path.relative(REPO, outFile)}`);
