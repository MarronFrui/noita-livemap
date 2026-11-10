// The Work (Heaven / Hell) — the y-wrap law (C186).
//
// BYTES (noita_dev.exe, sha256 d2f7dbef…0285):
// - ProceduralTerrain::Init 0x905fb0 builds ONE world wang material image P
//   (`push 0xb8; new; call 0x8f9470` @0x907323..0x907346 → [ebp−0x294]) sized
//   to the BIOME MAP only: grid ctor 0x8f95c0(P, floor(W·512/10),
//   floor(H·512/10)) @0x907358..0x90738f with W = [this+0x50] = 70,
//   H = [this+0x54] = 48 ⇒ P = 3584 × 2457 cells (1 cell = 10 px). P is the
//   debug dump `temptemp/_biomes_all_wang.png` (0x1174fa8, @0x90870d) and is
//   stored to [config+0x1d4] @0x908583 (C65's "fifth writer").
// - EVERY P read goes through the u16 getter 0x9fe4e0, which WRAPS both axes
//   by positive modulo before indexing: x<0 → x + (1 − x/w)·w, y<0 likewise
//   with h; x ≥ w → x % w; y ≥ h → y % h.
// - The cell loop 0x90d860 (field > 0.5 gate @0x90dbd0) reads P at
//   round(Noise_Warp(world px)) — the warp's ×0.1 frame (C26) ⇒ P's world
//   period = 2457 cells = 24570 px vertically (35840 px horizontally).
// - P's material id − 1 < 1 (the template's grey/white placeholder art) ⇒
//   the cell is classified by the CHUNK's OWN biome: BiomeMaterials_Classify
//   0x8f5030 on [config+0x2a4] with v = 0x908e70(x, y, field) (@0x90dd0e..
//   0x90dd7e), whose body (byte-read @0x908e70..0x908f37) is
//     m = 0x8fc900(f32(x·0.035), f32(y·0.07))            (= latticeVal2d)
//     t = m · 15.5
//     s = Simplex2D((f32(x)+t)·0.0489275, (f32(y)+t)·0.0489275)
//     v = field + s · ((field − 0.5)·0.5)² · 5.35 · 0.95;  v = max(v, 0.5)
//   with consts 0x11dfc98 = 0.035 (f64), 0x11dfce8 = 0.07 (f64),
//   0x11e01b0 = 15.5f, 0x11df944 = 0.0489275f, 0x11dfa94 = 0.5f,
//   0x11e00b4 = 5.35f, 0x11dfbac = 0.95f.
// - BitmapNoise::LoadFromImageData 0x8f9ab0: a non-material colour's field =
//   (R + G + R)/3/255 (the luminance arm) — the grey ramp IS the field
//   (white = 1.0); a material colour = explicit material (field ±1, id 1 =
//   air ⇒ −1); script colours set no field (stay 0 ⇒ air).
//
// CONSEQUENCE (capture-verified, seed 78633191): the rows above and below
// the 48-row biome map read the MAIN band's wang content at y mod 24570 px,
// and the chunk biome there is the vmap clamp of biome-map row 0 / row 47 —
// the_sky / the_end on cols 27..41 — whose <Materials> re-classify every
// placeholder cell (Heaven = cloud, Hell = skullrock); explicit materials
// (sand, water…) pass through. Holy-mountain / noise rows have no P content
// ⇒ air gaps. Layout match: mapgen/experiments/2026-11-08-work-layout-match.mjs.

import { latticeVal2d, simplex2d } from "./noise-proto.mjs";
import { classify } from "./surface-level.mjs";

export const WORK_P_ROWS = Math.floor((48 * 512) / 10); // 2457 cells (Init @0x907358..0x90738f)
export const WORK_PERIOD_Y = WORK_P_ROWS * 10; // 24570 px

const f = Math.fround;
const pmod = (a, n) => ((a % n) + n) % n;

// canvas px (band top = bandTop) → the main-band canvas px P is read at
export function workWrapY(gy, bandTop) {
  return bandTop + pmod(gy - bandTop, WORK_PERIOD_Y);
}

// 0x908e70 — the classify value for a P-empty cell (header for the bytes)
export function workClassifyValue(x, y, field) {
  const m = latticeVal2d(f(x * 0.035), f(y * 0.07));
  const t = f(m * f(15.5));
  const k = f(0.04892750084400177);
  const s = simplex2d(f(f(f(x) + t) * k), f(f(f(y) + t) * k));
  const d = f(f(field - 0.5) * 0.5);
  const amp = f(f(f(d * d) * f(5.349999904632568)) * f(0.949999988079071));
  const v = f(f(s * amp) + field);
  return 0.5 > v ? 0.5 : v;
}

// One raw atlas cell (post-flood, pre-shade) → the per-pixel Work verdict.
// Returns { air: true } | { material: name }.
//   materials: Map hex → material name (colorize.loadMaterials)
//   table: the Work biome's classify table (noise-terrain.ensureSurfaceTable)
//   x, y: GAME world px (the sampler's own coordinates)
export function workCellAt(r, g, b, materials, table, x, y) {
  if (r === 0 && g === 0 && b === 0) return AIR;
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  const mat = materials.get(hex);
  if (mat) return mat === "air" ? AIR : { material: mat }; // explicit id (id 1 = air)
  if (r !== g || g !== b) return AIR; // script/marker colours: no field ⇒ air
  // the luminance arm: field = (R + G + R)/3/255 = g/255 on the grey ramp
  const field = f(f(f(r / 255 + g / 255) + r / 255) / 3);
  if (!(field > 0.5)) return AIR; // the sampler's field > 0.5 gate (@0x90dbd0)
  if (!table) return AIR; // mBiomeMaterials == 0 ⇒ skip (@0x90dd01)
  const v = workClassifyValue(x, y, field);
  const rec = classify(table, Math.round(x), Math.round(y), v);
  return rec?.name ? { material: rec.name } : AIR;
}
const AIR = Object.freeze({ air: true });
