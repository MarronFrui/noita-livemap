// dig #210 obs (1) — THE TREE-WEST WATER probe.
// User field observation: "the chunk immediately west of the tree displays
// water — there's no water there." Diagnostic state (interrupted): chunks
// (35-38, 62) dominated by RGB (13,14,18)+(21,23,30) = the colorize airDark
// SHADE family, inside noise-lane chunks where the sky law should return
// black+stars for air (ty=62 = bty 14, the datum row; the #177 law).
//
// This probe (the registered repro instrument, per the session discipline:
// one observation → one probe):
//   1. worldColorAt per-pixel exact-color histogram for chunks
//      cols 33..38 × ty 61..62, on seeds 123456789 / 78633191 / 78633192.
//   2. BRANCH attribution for every airDark-family & water-family pixel
//      (a mimic of worldColorAt's ty>=62 arm order — replicating
//       world-gen.mjs lines 188..272 in probe-local code).
//   3. noiseChunkMask per chunk: mask solid counts + matIdx->matNames
//      histograms (the matIdx-histogram dump, not color guessing).
//   4. The owning area record per chunk (which lane owns the chunk at all).
//   5. noiseChunkMask called DIRECTLY (no catch) — a throw is logged, not
//      silently null (obs 4's suspected hole, scoped to these chunks here).
import { ensureWorld, worldColorAt } from '/home/marron/work/Noita-livemap/mapgen/lib/world-gen.mjs';
import { noiseChunkMask, ensureBiomeBackdrop } from '/home/marron/work/Noita-livemap/mapgen/lib/noise-terrain.mjs';
import { SHADES } from '/home/marron/work/Noita-livemap/mapgen/lib/colorize.mjs';
import { findNoitaDataDir, repoRoot } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';
import path from 'node:path';

const dataDir = findNoitaDataDir();
const cacheDir = path.join(repoRoot, 'mapgen/out/gen-cache/r3i');

const AIRDARK = new Set(SHADES.airDark.map((s) => `[${s.rgb[0]},${s.rgb[1]},${s.rgb[2]}]`));
const WATER = new Set(SHADES.water.map((s) => `[${s.rgb[0]},${s.rgb[1]},${s.rgb[2]}]`));
const key = (r, g, b) => `[${r},${g},${b}]`;

const COLS = [33, 34, 35, 36, 37, 38];
const ROWS = [61, 62];
const CHUNK = 512;
const SKY_ROWS = 48;
const L3 = { x: 11, y: 12 };
const WORLD_CHUNKS_W = 71;

// The ty>=62-arm mimic (world-gen.mjs lines 188..272 order), returning
// [branch, rgb] — used ONLY on pixels whose worldColorAt return lands in an
// interesting family.
function mimic(world, wx, wy) {
  const gx = wx + L3.x, gy = wy + L3.y;
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
        if (AIRDARK.has(key(r, g, b))) {
          const bd = ensureBiomeBackdrop(world.dataDir, a.def);
          if (bd) {
            const bx = ((lx % bd.w) + bd.w) % bd.w, by = ((ly % bd.h) + bd.h) % bd.h;
            const q = 4 * (by * bd.w + bx);
            return ['bin-airDark->backdrop', [bd.pixels[q], bd.pixels[q + 1], bd.pixels[q + 2]]];
          }
          return ['bin-airDark-NO-bg', [r, g, b]]; // the raw-airDark leak arm
        }
        return ['bin-terrain', [r, g, b]];
      }
    }
  }
  const ttx = Math.floor(wx / CHUNK), tty = Math.floor(wy / CHUNK);
  const buf = world.templates?.get(`${ttx},${tty}`);
  if (buf) {
    const o = 3 * ((wy - tty * CHUNK) * CHUNK + (wx - ttx * CHUNK));
    if (buf[o] !== 9 || buf[o + 1] !== 9 || buf[o + 2] !== 9)
      return ['template', [buf[o], buf[o + 1], buf[o + 2]]];
  }
  const nz = world.noiseSolidAt?.(gx, gy);
  if (nz != null) {
    if (nz) return ['noise-solid', null];
    if (ty === 62) return ['sky(row62)', null];
    return ['bgImage', null];
  }
  return ['off-area-air', null];
}

for (const SEED of [123456789, 78633191, 78633192]) {
  console.log(`\n=============== SEED ${SEED} ===============`);
  const world = ensureWorld(SEED, dataDir, { cacheDir });
  await world.ready;

  // the tree's own area(s) (which defs occupy the tree cols)
  for (const a of world.areas) {
    const fn = path.basename(a.def?.filename ?? '');
    if (fn.startsWith('mountain_tree')) {
      console.log(`tree area: ${fn} key=${a.key} rect x1=${a.area.x1} y1=${a.area.y1} x2=${a.area.x2} y2=${a.area.y2}`);
    }
  }

  for (const ty of ROWS) {
    for (const cx of COLS) {
      // owner record dump — direct from the grid, no assumptions
      const idx = world.grid[ty * WORLD_CHUNKS_W + cx];
      const a = idx >= 0 ? world.areas[idx] : null;
      const rec = a ? `idx=${idx} key=${a.key} rect=x${a.area.x1}..${a.area.x2}/y${a.area.y1}..${a.area.y2} def=${path.basename(a.def?.filename ?? '')}` : 'idx<0 (no area)';
      const mapOk = a ? (world.maps.has(a.key) ? 'yes' : 'MISSING') : '--';
      console.log(`\nchunk(${cx},${ty}) grid owner: ${rec} map=${mapOk}`);

      // worldColorAt full-color histogram (ALL chunks)
      const h = new Map; const byBranch = new Map;
      let airDarkPx = 0, waterPx = 0;
      for (let y = 0; y < CHUNK; y += 2) for (let x = 0; x < CHUNK; x += 2) {
        const wx = cx * CHUNK + x, wy = ty * CHUNK + y;
        const c = worldColorAt(world, wx, wy);
        if (!c) { h.set('null', (h.get('null') ?? 0) + 1); continue; }
        const k = key(c[0], c[1], c[2]);
        h.set(k, (h.get(k) ?? 0) + 1);
        if (AIRDARK.has(k) || WATER.has(k)) {
          if (AIRDARK.has(k)) airDarkPx++; else waterPx++;
          const m = mimic(world, wx, wy) ?? ['mimic-null'];
          byBranch.set(m[0], (byBranch.get(m[0]) ?? 0) + 1);
        }
      }
      const top = [...h.entries()].sort((p, q) => q[1] - p[1]).slice(0, 10)
        .map(([k, n]) => `${k}:${((n / (CHUNK / 2 * CHUNK / 2)) * 100).toFixed(1)}%`);
      console.log(`  colors: ${top.join(' | ')}\n  airDarkPx=${airDarkPx} waterPx=${waterPx} byBranch: ${[...byBranch.entries()].map(([b, n]) => `${b}=${n}`).join(' ')}`);

      // noiseChunkMask DIRECT (no catch): a throw is evidence, not silence.
      let direct = 'not-a-noise-chunk(null)';
      try {
        const ch = noiseChunkMask(world.config, cx, ty, SEED);
        if (ch) {
          const hist = new Map;
          let solid = 0;
          for (let k = 0; k < ch.mask.length; k++) if (ch.mask[k]) solid++;
          if (ch.matIdx) {
            for (let k = 0; k < ch.matIdx.length; k++) {
              const i = ch.matIdx[k];
              hist.set(i, (hist.get(i) ?? 0) + 1);
            }
          }
          const names = ch.matNames ?? [];
          const topM = [...hist.entries()].sort((p, q) => q[1] - p[1]).slice(0, 6)
            .map(([i, n]) => `${i === 255 ? 'air/255' : `${names[i] ?? 'name?'}#${i}`}:${n}`);
          direct = `mask solid ${solid}/${ch.mask.length} matIdx[${topM.join(' ')}]`;
        }
      } catch (e) {
        direct = `THROWN: ${e.message}`;
      }
      console.log(`  noiseChunkMask(${cx},${ty}) direct: ${direct}`);
    }
  }
}
