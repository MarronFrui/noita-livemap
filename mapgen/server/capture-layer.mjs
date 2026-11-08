// The capture-composite display layer (ISSUES A10) — moved out of
// genmap-server.mjs (2026-11-08) so the tile workers share it.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { repoRoot } from "../lib/paths.mjs";
import { worldColorAt } from "../lib/world-gen.mjs";

// ── capture-composite display layer (ISSUES A10) ───────────────────────────
// The game's runtime-computed lanes (the splice/fixed-scene driver fills, the
// deep fill bands) are only partially recovered — their cells currently show
// approximations. At the CAPTURED seed the viewer can instead take those world
// px straight from the capture tiles (mapgen/out/ref = noita-mapcap's own
// output for seed 78633191 = the game's true pixels, M-grade ground truth,
// mapcap/README). Frame law: canvas px = world px + (17920, 31744) (C145),
// so capture `X_Y.png` (the game chunk X−35, Y−14) = canvas chunk (X, Y+48),
// 1:1 px (empirically pinned: our tile 40_63 lava-family count = 81,897 vs
// the capture's 40_15 = 80,268, and 40_64 = 242,351 both).
// Scope honesty: the fill pixels are SEED-DEPENDENT, so the layer is
// registered at the captured seed only (the world-fixed landmark ART is
// seed-independent — I9 — but its driver fill is not). Display-only by
// construction: it wraps worldColorAt here in the server; the lib lanes and
// the E1/E2 instruments read the generator directly and are unaffected.
// Default OFF (user call 2026-10-21): the layer only ever shows the
// noitamap capture of seed 78633191 — a world that is never the live
// run's — so it is pointless at any other seed and a per-px lookup cost
// at this one. CAPTURE_LAYER=1 re-enables it globally (benchmark use at
// the demo seed); the viewer overrides per request with ?c=0 / ?c=1 on
// the tile URL. It dies when the field's noise law + the scene fill
// laws compose at the demo seed (the dig #177+ lane work).
export const CAPTURE_SEED = 78633191;
const CAPTURE_DIR = path.join(repoRoot, "mapgen/out/ref");
export const CAPTURE_DEFAULT = process.env.CAPTURE_LAYER === "1";
const captureTiles = new Map(); // "tx,ty" -> Uint8Array(512*512*3) | null (absent)
const captureLru = [];
function captureTileAt(tx, ty) {
  const key = `${tx},${ty}`;
  let t = captureTiles.get(key);
  if (t === undefined) {
    t = null; // miss sentinel — absent tiles are not re-read per px
    try {
      const png = PNG.sync.read(fs.readFileSync(path.join(CAPTURE_DIR, `${tx}_${ty - 48}.png`)));
      if (png.width === 512 && png.height === 512) {
        const rgb = new Uint8Array(512 * 512 * 3);
        for (let i = 0, p = 0; p < rgb.length; i += 4, p += 3) {
          rgb[p] = png.data[i]; rgb[p + 1] = png.data[i + 1]; rgb[p + 2] = png.data[i + 2];
        }
        t = rgb;
      }
    } catch { /* no capture coverage at this chunk */ }
    captureTiles.set(key, t);
    captureLru.push(key);
    if (captureLru.length > 192) captureTiles.delete(captureLru.shift());
  }
  return t;
}
export function worldColorComposedAt(world, seed, captureOn, wx, wy) {
  if (captureOn && seed === CAPTURE_SEED && wx >= 0 && wy >= 0) {
    const t = captureTileAt(Math.floor(wx / 512), Math.floor(wy / 512));
    if (t) {
      const p = 3 * ((wy & 511) * 512 + (wx & 511));
      return [t[p], t[p + 1], t[p + 2]];
    }
  }
  return worldColorAt(world, wx, wy);
}

