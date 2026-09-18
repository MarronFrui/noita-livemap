// mapcap artifact JSON specs — validate every analyzed capture on disk
// against the output contract of mapcap/analyze-capture.mjs
// (manifest.json / analysis.json / chunks/). Ground-truth data lives in
// gitignored mapcap/out/<name>/; the suite degrades to a skip when absent.

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "vitest";
import { repoRoot } from "../helpers/data.mjs";

const OUT_DIR = path.join(repoRoot, "mapcap/out");

function listRuns() {
  try {
    return fs
      .readdirSync(OUT_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((n) => {
        const d = path.join(OUT_DIR, n);
        return fs.existsSync(path.join(d, "manifest.json")) && fs.existsSync(path.join(d, "analysis.json"));
      });
  } catch {
    return [];
  }
}

const runs = listRuns();

describe.skipIf(runs.length === 0)("mapcap capture manifests (manifest.json)", () => {
  test.each(runs)("%s: manifest conforms to the analyzer output spec", (name) => {
    const m = JSON.parse(fs.readFileSync(path.join(OUT_DIR, name, "manifest.json"), "utf-8"));
    expect(typeof m.name).toBe("string");
    // older analyzer runs predate the --seed/--origin CLI flags
    if (m.seed !== null) {
      expect(m.seed).toBeGreaterThanOrEqual(0);
      expect(m.seed).toBeLessThanOrEqual(0xffffffff);
    }
    expect(m.source).toBeTypeOf("string");
    expect(m.stitchedSize).toEqual([expect.any(Number), expect.any(Number)]);
    if (m.origin !== null) expect(m.origin).toEqual([expect.any(Number), expect.any(Number)]);
    expect(m.grid.chunk).toBe(512);
    expect(m.grid.cx).toEqual([expect.any(Number), expect.any(Number)]);
    expect(m.grid.cy).toEqual([expect.any(Number), expect.any(Number)]);
    expect(m.worldRect).toHaveLength(4);
    expect(Number.isFinite(Date.parse(m.createdAt))).toBe(true);
    expect(m.chunks).toBeGreaterThan(0);
  });
});

describe.skipIf(runs.length === 0)("mapcap per-chunk analysis (analysis.json)", () => {
  const rows = [];
  for (const name of runs) {
    rows.push([name, JSON.parse(fs.readFileSync(path.join(OUT_DIR, name, "analysis.json"), "utf8"))]);
  }
  test.each(rows.map(([n, a]) => [n, a]))("%s: top-level contract { tileOverlap, seams, chunks }", (name, a) => {
    expect(Object.keys(a).sort()).toEqual(["chunks", "seams", "tileOverlap"]);
    const to = a.tileOverlap;
    if (to === null) {
      // pre-analysis runs (e.g. run1, parallax ON) skipped tile-overlap stats
      return;
    }
    expect(to.pairs).toBeTypeOf("number");
    expect(to.meanDiff).toBeGreaterThan(0);
    expect(to.identPct).toBeGreaterThan(95); // capture stability floor (mapcap/README: 99.6%+)
    expect(to.worstPairs[0]).toMatchObject({ at: expect.any(Array), mean: expect.any(Number), max: expect.any(Number) });
    expect(Array.isArray(a.seams.vertical)).toBe(true);
    expect(Array.isArray(a.seams.horizontal)).toBe(true);
  });

  test(`chunk rows carry the documented classification schema (${rows[0][0]})`, () => {
    const a = rows[0][1];
    expect(a.chunks.length).toBeGreaterThan(0);
    for (const c of a.chunks.slice(0, 20)) {
      expect(typeof c.cx).toBe("number");
      expect(typeof c.cy).toBe("number");
      expect(typeof c.label).toBe("string");
      expect(c.conf).toBeGreaterThanOrEqual(0);
      expect(c.meanLum).toBeGreaterThanOrEqual(0);
      expect(c.noiseRms).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(c.frac).slice(0, 3)) {
        expect(typeof v).toBe("number");
        expect(Number.isNaN(v)).toBe(false);
      }
    }
  });
});

describe.skipIf(runs.length === 0)("chunk PNG slices match the manifest grid", () => {
  test.each(runs.length > 0 ? [[runs[0]]] : [])("%s: manifest.chunks == chunk files on disk", (name) => {
    const m = JSON.parse(fs.readFileSync(path.join(OUT_DIR, name, "manifest.json"), "utf8"));
    const chunksDir = path.join(OUT_DIR, name, "chunks");
    const files = fs.readdirSync(chunksDir).filter((f) => /^chunk_-?\d+_-?\d+\.png$/.test(f));
    expect(files.length).toBe(m.chunks);
  });
});
