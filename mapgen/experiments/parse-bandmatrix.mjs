// Parse the CE band-matrix CSV dump and compare against the port's biomeAt
// lookup. Usage: node parse-bandmatrix.mjs <path-to-csv>
import fs from 'node:fs';
import { loadBiomeConfig, biomeAt } from '/home/marron/work/Noita-livemap/mapgen/lib/biomes.mjs';
import { findNoitaDataDir } from '/home/marron/work/Noita-livemap/mapgen/lib/paths.mjs';

const csvPath = process.argv[2];
if (!csvPath) { console.error('Usage: node parse-bandmatrix.mjs <csv>'); process.exit(1); }
const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
const header = lines[0].split(',');
const rows = lines.slice(1).map(l => {
  const p = l.split(',');
  return { idx:+p[0], col:+p[1], row:+p[2], ptr:p[3], mode:p[4], sy:+p[5], ey:+p[6], ns:+p[7], lo:+p[8], hi:+p[9] };
});

const dataDir = findNoitaDataDir();
const cfg = loadBiomeConfig(dataDir);

// Group by (mode, sy, ey, ns, lo, hi) -> list of (col,row) and the port's biome
const groups = new Map();
for (const r of rows) {
  if (r.ptr === '0x0') continue;
  const key = `${r.mode}|${r.sy}|${r.ey}|${r.ns}|${r.lo}|${r.hi}`;
  if (!groups.has(key)) groups.set(key, []);
  const at = biomeAt(cfg, r.col, r.row - 48 + 14); // biome map coords: ty = biome row
  // Actually biome coords: col 0..69, row 0..47 (biome map). The PT grid is 70x48 = biome map.
  const at2 = biomeAt(cfg, r.col, r.row);
  const biomeName = at2 ? at2.biome.name : 'UNDEFINED';
  groups.get(key).push({ col: r.col, row: r.row, biome: biomeName });
}

console.log('Distinct band-param groups (game):', groups.size);
for (const [key, cells] of groups) {
  const biomes = [...new Set(cells.map(c => c.biome))];
  console.log(`\n  params: ${key}`);
  console.log(`  cells: ${cells.length}, biomes (port lookup): ${biomes.join(', ')}`);
  console.log(`  sample cells: ${cells.slice(0,5).map(c=>`(${c.col},${c.row})`).join(' ')}`);
}

// Check: for each game band group, does the port's biomeAt agree?
let mismatches = 0;
for (const r of rows) {
  if (r.ptr === '0x0') continue;
  const at = biomeAt(cfg, r.col, r.row);
  const portBiome = at ? at.biome.name : 'UNDEFINED';
  // The game's band params identify the biome. Match by params.
  // Winter params: mode=1, sy=-1024, ey=1024, ns=0.00128571, lo=-292.571, hi=234.057
  const isWinter = r.mode==='1' && Math.abs(r.sy+1024)<1 && Math.abs(r.ey-1024)<1;
  if (isWinter && portBiome !== 'winter' && portBiome !== '_EMPTY_') {
    mismatches++;
    if (mismatches <= 10) console.log(`  MISMATCH: cell (${r.col},${r.row}) game=winter params but port=${portBiome}`);
  }
}
console.log('\nWinter-param cells where port disagrees:', mismatches);