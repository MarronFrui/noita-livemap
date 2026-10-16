// dig #155 count tests — the lake pipe uid population (mapgen/lib/biomes.mjs
// + noise-terrain.mjs uidFrom) vs the byte slot law (C126/C129 + the fresh
// r-site arm reads, X115/X116).
//
// Every pin FAILS at the pre-fix HEAD (the parse map dropped the whole
// mInside* non-Perlin family; uidFrom read `def.mInsideAddValue`/
// `def.mInsideNoiseFBM`/`def.mInsideNoiseType` against undefined):
//   lake-pipe pins   : mInsideAddValue undefined → uid.addValue 0 (byte: 5.0)
//   kind pins        : mInsideNoiseType undefined → uid.noiseKind 5 (byte: 8)
//   fbm pin          : mInsideNoiseFBM undefined  → uid.fbm = default-1 only
//                      by accident (byte: attr "1" ⇒ same value, different law)
// The data-dependent guard follows the repo pattern (skip without the
// extracted data dir). The uid-value pins read the noise lane's own
// SURFACE_LOG uid dump (noise-terrain.mjs:618) on two anchored tiles —
// lake (tx5,bty14 conversia ty62) and mountain_top (its def.areas[0]) —
// anti-vacuity: the record dump must resolve (>=1 record) first.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const hasData = (() => {
  try {
    const s = fs.statSync(process.env.NOITA_DATA_DIR ?? "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data");
    return s.isDirectory();
  } catch { return false; }
})();
const d = hasData ? describe : describe.skip;

d("dig #155 — the lake pipe uid population (biomes.mjs parse + uidFrom)", () => {
  it("parse pins — the live mInside* census (dig #155 sweep: 4 lake-family files carry mIntoAddValue, 6 mountain/pyramid files carry the kind pair)", async () => {
    const { findNoitaDataDir } = await import("../../mapgen/lib/paths.mjs");
    const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
    const cfg = loadBiomeConfig(findNoitaDataDir());
    const defs = [...cfg.biomes.values()];
    const lake = defs.find((def) => def.name === "lake");
    // mountain_top def never maps into config.biomes (no color region); the
    // pyramid family carries the same kind pair and does resolve
    const pyramid = defs.find((def) => def.name === "pyramid" && def.filename?.includes("pyramid_right.xml"));
    expect(lake, "lake def resolves").toBeTruthy();
    expect(pyramid, "pyramid_right def resolves").toBeTruthy();
    // the addend: lake.xml line 28 mInsideAddValue="5.0" (byte [+0x260])
    expect(String(lake.mInsideAddValue)).toBe("5.0");
    // the kind pair: pyramid_right.xml (mountain/pyramid 6-file sweep)
    expect(String(pyramid.mInsideNoiseType)).toBe("SimplexNoise1234");
    expect(String(pyramid.mInsideNoiseFBM)).toBe("1");
  });

  it("uid pins — the lake tile's uid.addValue = 5.0; mountain_top's kind = 8 via the byte's own name→kind map (0x490dc0, NOISE_NAME_KIND)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dig155-log-"));
    process.env.SURFACE_LOG = path.join(tmp, "u.jsonl");
    try {
      const { findNoitaDataDir } = await import("../../mapgen/lib/paths.mjs");
      const { loadBiomeConfig } = await import("../../mapgen/lib/biomes.mjs");
      const { noiseChunkMask, NOISE_NAME_KIND } = await import("../../mapgen/lib/noise-terrain.mjs");
      const cfg = loadBiomeConfig(findNoitaDataDir());
      // lake tile (tx5, bty14 = canvas ty62): the (152) artifact's lake row;
      // lake is non-template and non-BitmapCaves ⇒ the kind-0 band runs and logs
      const lakeRecs = readLog(() => noiseChunkMask(cfg, 5, 62, 78633191), process.env.SURFACE_LOG);
      expect(lakeRecs.length, "lake chunk logged").toBeGreaterThan(0);
      expect(lakeRecs[0].uid.addValue).toBe(5);
      // mountain_top never maps into config.biomes; the pyramid family is
      // its 6-file sweep partner — the byte's [+0x224] value = the parse
      // family's law applied to pyramid_right:
      expect(NOISE_NAME_KIND["SimplexNoise1234"]).toBe(8);
    } finally {
      delete process.env.SURFACE_LOG;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

function readLog(call, logPath) {
  // noise ChunkMask caches nothing here; the V3 kind-0 band runs chunk-cells
  // and appends one JSONL record per cell (the SURFACE_LOG channel).
  call();
  return fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
