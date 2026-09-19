// Exact port of the hasPath rejection rule. Authority: our Ghidra asm
// verification of noita_dev.exe + game-side oracle validation (8/8
// accept/reject; VERIFIED.md §5). The historical origin was the vendored
// noitool reconstruction, which is now OBSOLETE — never port noitool code
// unchecked (its shipped coalmine-hax constants are a silent no-op); this
// file's behavior is pinned by the oracle, not by noitool.
//
// 2026-09-18 REWRITE (F2 dig): three binary-verified corrections applied —
// (1) the room-marker table is now the 11-entry literal list from FUN_00901580
//     (0x9015c4-0x90160f); noitool missed 0x00ac64 and 0x70d7a0.
// (2) the coalmine overlay constants match the overlay data (0x006400 /
//     0x000064 — noitool's 0x004000/0x0040 made the hax a silent no-op here
//     too; both mutations are now ACTIVE).
// (3) undoCoalMineHax uses the corrected constants as well.
// In-binary semantics still TODO (documented): the fill walk ordering of
// FUN_0090450 (fillMainPath detail).
// 2026-09-19 F2 dig: blockOutRooms rewritten to the binary's exact
// ray-walk room-growth semantics (FUN_00901510 ray counts + FUN_009013f0
// record fill, read this session; proof anchor CONSTANTS.md::C13
// byte-pinned this session at slab 0x50124d). The old ShadeOfGrey-run-on
// heuristic is GONE: rays stop at the first non-black cell, room rect ends
// are EXCLUSIVE (record = {startX,startY,endX,endY}, strict-< fill).
// Semantics (map = RGB, 3 bytes/px, w*h ATLAS px — 1 px = 10 world px):
//   hasPath(map):
//     shouldBlockOutRooms -> blockOutRooms(BLACK -> WHITE)   [mutates map]
//     isCoalMine          -> doCoalMineHax(overlay)          [mutates map]
//     path_map = copy; isValid():
//       coalmine -> start_x = 142; else mainPath -> fillMainPath() (fills band, start_x)
//       [start_x=142 (0x8e) is @prov noitool — the binary shows the mark is
//        a cell COLOR (0xFF420000), not a hardcoded x; the 142 constant is
//        unverified approximation debt, see CONSTANTS rule + ledger F2]
//       HasPathToBottom(start_x, fixed_x = mainPath):
//         fixed_x -> findPath(start_x, 0)
//         else    -> scan x from start_x: coffee -> floodfill to black & retry same x;
//                    black -> findPath(x, 0); on failure x++ (visited state PERSISTS)
//   Search: greedy best-first flood, priority |y - targetY| then FIFO;
//     neighbors tried up/left/right/down; start cell pushed WITHOUT walkability
//     check; visited cells painted PURPLE on the map; one Search instance is
//     REUSED across the scan (visited/heap persist — union-of-frontiers).
//   traversable: BLACK, COFFEE(0xc0ffee), FROZEN_VAULT_MINT(0xcff7c8), HELL_GREEN(0x8aff80)
//
// Verdicts -> ABOUT_MATH §6 / VERIFIED.md. Oracle: accepted attempts
// {excav 91: A=0, excav 92: A=3, excav 93: A=1} from the chain-vs-spawn run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "./paths.mjs";

const COLOR_PURPLE = 0x7f007f;
const COLOR_BLACK = 0x000000;
const COLOR_WHITE = 0xffffff;
const COLOR_COFFEE = 0xc0ffee;
const COLOR_FROZEN_VAULT_MINT = 0xcff7c8;
const COLOR_HELL_GREEN = 0x8aff80;
const NO_PARENT = 0xffffffff;
const BIOME_PATH_FIND_WORLD_POS_MIN_X = 159;
const BIOME_PATH_FIND_WORLD_POS_MAX_X = 223;

// Binary-verified room-marker table (noita_dev.exe FUN_00901580, literal
// compares at 0x9015c4-0x90160f, RGBA LE). 11 entries — noitool's shipped
// 9-color list was incomplete (it missed 0x00ac64 and the 0x70d7a0 shade).
// Sorted for the linear lookup.
const blockedColors = [
  0x00ac64, 0x00ac6e, 0x70d79e, 0x70d79f, 0x70d7a0, 0x70d7a1,
  0x7868ff, 0xc35700, 0xff0080, 0xff00ff, 0xff0aff,
];

const createRGB = (r, g, b) => ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
const getPixel3 = (map, pos) => (map[pos] << 16) | (map[pos + 1] << 8) | map[pos + 2];
const getPixel = (map, w, x, y) => getPixel3(map, 3 * (w * y + x));
const setPixel = (map, w, x, y, color) => {
  const p = 3 * (w * y + x);
  map[p] = (color >> 16) & 0xff;
  map[p + 1] = (color >> 8) & 0xff;
  map[p + 2] = color & 0xff;
};

function isBlockedColor(color) {
  for (const c of blockedColors) if (c === color) return true;
  return false;
}

function fill(map, w, x1, x2, y1, y2, color) {
  for (let x = x1; x <= x2; x++)
    for (let y = y1; y <= y2; y++) setPixel(map, w, x, y, color);
}

function floodFill(map, width, height, initialX, initialY, fromColor, toColor) {
  if (initialX >= width || initialY >= height) return;
  const visited = new Uint8Array(width * height);
  const stack = [[initialX, initialY]];
  visited[width * initialY + initialX] = 1;
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    setPixel(map, width, x, y, toColor);
    const next = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of next) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const p = width * ny + nx;
      if (visited[p]) continue;
      const nc = getPixel3(map, p * 3);
      if (nc !== fromColor || nc === toColor) continue;
      visited[p] = 1;
      stack.push([nx, ny]);
    }
  }
}

// node heap: priority |y - targetY| asc, then insertion order asc
class NodeHeap {
  constructor(targetY) { this.items = []; this.targetY = targetY; }
  less(a, b) {
    const pa = Math.abs(a.y - this.targetY), pb = Math.abs(b.y - this.targetY);
    if (pa !== pb) return pa < pb;
    return a.order < b.order;
  }
  push(n) {
    const it = this.items;
    it.push(n);
    let i = it.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(it[i], it[parent])) break;
      [it[i], it[parent]] = [it[parent], it[i]];
      i = parent;
    }
  }
  pop() {
    const it = this.items;
    const top = it[0];
    const last = it.pop();
    if (it.length > 0) {
      it[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let best = i;
        if (l < it.length && this.less(it[l], it[best])) best = l;
        if (r < it.length && this.less(it[r], it[best])) best = r;
        if (best === i) break;
        [it[i], it[best]] = [it[best], it[i]];
        i = best;
      }
    }
    return top;
  }
  get len() { return this.items.length; }
}

class Search {
  constructor(map, width, height, targetX, targetY, parents) {
    this.map = map; this.width = width; this.height = height;
    this.targetX = targetX; this.targetY = targetY;
    this.parents = parents;
    this.visited = new Uint8Array(width * height);
    this.heap = new NodeHeap(targetY);
    this.endPos = NO_PARENT;
    this.order = 0;
  }
  pos(x, y) { return this.width * y + x; }
  findPath(x, y) {
    const start = this.pos(x, y);
    this.setVisited(x, y);
    this.parents[start] = NO_PARENT;
    this.heap.push({ x, y, parent: NO_PARENT, order: this.order++ });
    while (this.heap.len > 0) {
      const n = this.heap.pop();
      if (this.atTarget(n)) { this.endPos = this.pos(n.x, n.y); return true; }
      this.tryNext(n.x, n.y - 1, n);
      this.tryNext(n.x - 1, n.y, n);
      this.tryNext(n.x + 1, n.y, n);
      this.tryNext(n.x, n.y + 1, n);
    }
    return false;
  }
  tryNext(x, y, n) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    if (this.isVisited(x, y)) return false;
    if (!this.traversable(x, y)) return false;
    const p = this.pos(x, y);
    this.parents[p] = this.pos(n.x, n.y);
    this.setVisited(x, y);
    this.heap.push({ x, y, parent: p, order: this.order++ });
    return true;
  }
  setVisited(x, y) {
    const p = this.pos(x, y);
    setPixel(this.map, this.width, x, y, COLOR_PURPLE);
    this.visited[p] = 1;
  }
  isVisited(x, y) { return this.visited[this.pos(x, y)]; }
  traversable(x, y) {
    const c = getPixel(this.map, this.width, x, y);
    return c === COLOR_BLACK || c === COLOR_COFFEE || c === COLOR_FROZEN_VAULT_MINT || c === COLOR_HELL_GREEN;
  }
  atTarget(n) { return this.targetY === n.y; }
}

// --- coalmine overlay: game data; read once from the vendored (obsolete)
// noitool repo file, which is used purely as a data container ---
let _overlay = null;
export function coalmineOverlay() {
  if (_overlay) return _overlay;
  const src = fs.readFileSync(
    path.join(repoRoot, "vendor/noita-tools/src/services/SeedInfo/noita_random/src/wang/coalmine_hax.cpp"),
    "utf-8"
  );
  const m = src.match(/coalmine_overlay\[\]\s*=\s*\{([^}]*)\}/s);
  if (!m) throw new Error("coalmine_overlay not found in vendored coalmine_hax.cpp");
  const bytes = Uint8Array.from(
    m[1].split(",").map((s) => s.trim()).filter(Boolean).map((s) => parseInt(s, 16) & 0xff)
  );
  if (bytes.length % (256 * 3) !== 0) throw new Error(`overlay size ${bytes.length} not 256-wide RGB`);
  _overlay = { bytes, rows: bytes.length / (256 * 3) };
  return _overlay;
}

function doCoalMineHax(map, width, height) {
  const ov = coalmineOverlay();
  if (ov.rows < height) throw new Error(`overlay rows ${ov.rows} < height ${height}`);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const op = 3 * (256 * y + x);
      const pix = (ov.bytes[op] << 16) | (ov.bytes[op + 1] << 8) | ov.bytes[op + 2];
      // 2026-09-18 binary dig: the overlay data's real values are 0x006400 /
      // 0x000064 (VERIFIED §8/ledger F2). noitool's own code compared against
      // 0x004000/0x0040 — a silent no-op — and this port used to copy those
      // constants. The values below match the actual overlay data.
      if (pix === 0x006400) { /* main rock portion */
        setPixel(map, width, x, y, COLOR_WHITE);
      } else if (pix === 0x000064) { /* blue - looks like air */
        setPixel(map, width, x, y, COLOR_BLACK);
      } else if (pix === 0xfefefe) { /* white - stairs, used in path finding */
        map[3 * (width * y + x)] = 0x0a;
        map[3 * (width * y + x) + 1] = 0x33;
        map[3 * (width * y + x) + 2] = 0x44;
      }
    }
  }
}

// undoCoalMineHax (finalize step): reset the overlay-forced tiles.
// 2026-09-18: constants corrected to the overlay data's real values
// (0x006400/0x000064; noitool's 0x004000/0x0040 were a silent no-op).
function undoCoalMineHax(map, width, height) {
  const ov = coalmineOverlay();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const op = 3 * (256 * y + x);
      const pix = (ov.bytes[op] << 16) | (ov.bytes[op + 1] << 8) | ov.bytes[op + 2];
      if (pix === 0x006400 || pix === 0x000064 || pix === 0xfefefe) {
        setPixel(map, width, x, y, COLOR_BLACK);
      }
    }
  }
}

// finalize-lite for the renderer: the parts of the game's finalize() we can
// already apply deterministically (undoCoalMineHax + fillBlockedRooms(BLACK)).
// ClearPath / fillC0ffee / fillRandomMaterials remain TODO. @prov noitool:
// everything in this block below the 2026-09-18 REWRITE corrections is
// structurally noitool-derived and only pinned via oracle — tag carries the
// no-guessing debt until F2 replaces them from the binary.
export function finalizeLite(map, width, height, { isCoalMine, blockList }) {
  if (isCoalMine) undoCoalMineHax(map, width, height);
  for (const b of blockList) {
    // 0x901450-family black blit (slab 0x500c50, read 2026-09-19): per
    // 16-byte record, EXCLUSIVE ends, per-cell bounds check. blockList
    // records (from blockOutRooms / hasPath) carry ends in that convention.
    blitRect(map, width, height, b, COLOR_BLACK);
  }
}

// --- 2026-09-19 binary-exact room growth (FUN_00901510 / FUN_009013f0 /
// FUN_00901580, bytes verified this session; semantics: ABOUT_MATH 2026-09-19
// entry). ---

// FUN_00901510 (slab 0x500d10, called twice from the marker walker at slab
// 0x500e29/0x500e40): step from (x,y) by (dx,dy), counting while the cell's
// low-24-bit color (`testl $0xffffff`) is BLACK; first non-black cell stops
// the ray and is NOT counted; bounds-checked each step; max 0x2710 steps.
// Returns the black run length N; the room rect end = start + N (exclusive).
function rayWalk(map, width, height, x, y, dx, dy) {
  let count = 0;
  for (let i = 0; i < 0x2710; i++) {
    if (x < 0 || y < 0 || x >= width || y >= height) break;
    if (getPixel(map, width, x, y) !== 0) break;
    count++;
    x += dx; y += dy;
  }
  return count;
}

// FUN_009013f0 (slab 0x500bf0; the finalize black blit FUN_0090450-family at
// slab 0x500c50 is the same exclusive-end, per-cell-bounds-checked record
// loop): rect = { startX, startY, endX, endY } with EXCLUSIVE x/y ends,
// strict-< fill.
function blitRect(map, width, height, rect, color) {
  for (let y = rect.startY; y < rect.endY; y++)
    for (let x = rect.startX; x < rect.endX; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      setPixel(map, width, x, y, color);
    }
}

// FUN_00901580 (slab 0x500d80): scan row-major; on an 11-way marker dword
// compare hit (the binary tests the full RGBA dword — on this RGB buffer the
// 24-bit blockedColors test is equivalent), dispatch two rays from
// (x+1, y+1): (1,0) right, then (0,1) down; rect =
// {x+1, y+1, x+1+rightLen, y+1+downLen}; fill it targetColor (binary pushes
// 0xFFFFFFFF = white at the single call site slab 0x500e51); push the record
// (-- 16-byte record in-binary; degenerate zero-area records included).
// NO ShadeOfGrey anywhere in-binary — the old grey-run-on heuristic is an
// eliminated approximation; rays stop at the first non-black cell.
function blockOutRooms(map, width, height, targetColor, blockList) {
  const posMax = width * height;
  for (let pos = 0; pos < posMax; pos++) {
    const color = getPixel3(map, pos * 3);
    if (!isBlockedColor(color)) continue;
    const x = pos % width, y = Math.floor(pos / width);
    const startX = x + 1, startY = y + 1;
    const endX = startX + rayWalk(map, width, height, startX, startY, 1, 0);
    const endY = startY + rayWalk(map, width, height, startX, startY, 0, 1);
    blitRect(map, width, height, { startX, startY, endX, endY }, targetColor);
    blockList.push({ startX, startY, endX, endY });
  }
}

// hasPath (oracle-validated against the game). `mapIn` (RGB w*h*3) is mutated
// ONLY where the game's out_map is mutated in place: blockOutRooms whites +
// coalmine hax. The pathfinding search runs on a SEPARATE COPY (path_map),
// so the purple visited-trail never lands on the returned terrain.
// Returns { ok, blockList, endNode }.
export function hasPath(mapIn, width, height, opts) {
  const { isCoalMine = false, shouldBlockOutRooms = false, worldX = 0, worldY = 0 } = opts ?? {};
  const map = mapIn; // blockOutRooms/hax mutate in place, mirroring the C++
  const blockList = [];
  if (shouldBlockOutRooms) blockOutRooms(map, width, height, COLOR_WHITE, blockList);
  if (isCoalMine) doCoalMineHax(map, width, height);

  // the search paints PURPLE on visited cells — it must not touch the
  // terrain buffer; run it on a copy (the game's path_map)
  const pathMap = Buffer.from(mapIn);
  const parents = new Uint32Array(width * height).fill(NO_PARENT);

  const isMainPath = () => {
    const fillXFrom = Math.trunc((BIOME_PATH_FIND_WORLD_POS_MIN_X - worldX * 512.0) / 10);
    const fillXTo = fillXFrom + Math.trunc((BIOME_PATH_FIND_WORLD_POS_MAX_X - BIOME_PATH_FIND_WORLD_POS_MIN_X) / 10);
    return { mainPath: worldY < 29 && fillXTo > 0 && fillXFrom > 0 && width > fillXFrom && fillXTo < width + fillXFrom, fillXFrom, fillXTo };
  };
  const { mainPath, fillXFrom, fillXTo } = isMainPath();

  let pathStartX = 0;
  if (isCoalMine) {
    pathStartX = 0x8e; // @prov noitool (start_x=142): approximation debt (see header)
  } else if (mainPath) {
    // fillMainPath runs under usemap = path → band fill on path_map
    fill(pathMap, width, fillXFrom, fillXTo, 0, 6, COLOR_BLACK);
    pathStartX = fillXFrom;
  }

  // HasPathToBottom — everything below (scan, coffee floods, search) reads
  // and mutates path_map under usemap = path
  const search = new Search(pathMap, width, height, 0, height - 1, parents);
  let endNode = NO_PARENT;
  let ok = false;
  if (mainPath) {
    ok = search.findPath(pathStartX, 0);
    if (ok) endNode = search.endPos;
  } else {
    let x = pathStartX;
    while (x < width) {
      const c = getPixel(pathMap, width, x, 0);
      if (c !== COLOR_BLACK && c !== COLOR_COFFEE) { x++; continue; }
      if (c === COLOR_COFFEE) {
        floodFill(pathMap, width, height, x, 0, COLOR_COFFEE, COLOR_BLACK);
        continue;
      }
      if (search.findPath(x, 0)) { endNode = search.endPos; ok = true; break; }
      x++;
    }
  }
  return { ok, blockList, endNode };
}
