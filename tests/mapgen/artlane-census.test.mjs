// tests/mapgen/artlane-census.test.mjs — dig #129's E1 count-test pins for
// the ART-LANE census (visible-crust data; the compositor I32's input).
// Data-dependent: auto-skips without the extracted census artifact or the
// game data dir. The pins are the census's own output — the count-test's
// role: any future re-census change that shifts the numbers has to FAIL
// here and re-register before it can rewire the compositor.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const artifact = "mapgen/extractions/artlane-2026-10-13.json";
const hasArtifact = fs.existsSync(artifact);
const hasData = fs.existsSync("/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data/scripts");

describe.skipIf(!hasArtifact || !hasData)("artlane census (dig #129, I32 input)", () => {
  const j = JSON.parse(fs.readFileSync(artifact, "utf8"));

  it("pins the counts (E1: 256 calls / 134 files / 141 unique scenes)", () => {
    expect(j.total).toBe(256);
    expect(j.files).toBe(134);
    expect(j.uniqueScenes).toBe(141);
  });

  it("pins the scene resolution classes (239 literal / 4 spliced-shipped / 2 lua-concat / 11 unresolved)", () => {
    expect(j.sceneResolution).toEqual({
      resolved: 239, resolvedSpliced: 4, dynamicExpr: 2, unresolved: 11,
    });
    // the completeness rule: nothing is claimed "missing" — the shipped
    // form (spliced/<name>) decides, never a bare stat
    expect(j.missingOnDisk).toBe(0);
  });

  it("lists the unresolved references by name (the hall_2-4 family + 3 singles)", () => {
    const names = Object.keys(j.unresolvedPaths);
    expect(names.length).toBe(10); // 11 unresolved CALLS, 10 unique scene paths
    expect(names).toContain("biome_impl/mountain/hall_2.png");
    expect(names).toContain("biome_impl/mountain/hall_3_top.png");
    expect(names).toContain("biome_impl/mountain/hall_4_bottom.png");
    expect(names).toContain("biome_impl/endgame2.png");
    expect(names).toContain("biome_impl/mountain_lake_top.png");
    expect(names).toContain("biome_impl/temple/altar_top_boss_arena.png");
  });

  it("every resolved scene maps to a real file on disk under its OWN resolution class (the byte-completeness gate)", () => {
    const dataDir = "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";
    for (const c of j.calls) {
      if (c.sceneState !== "resolved" && c.sceneState !== "resolved-spliced") continue;
      const rel = c.sceneState === "resolved-spliced"
        ? "biome_impl/spliced/" + String(c.scene).replace(/^data\//, "").split("/").pop()
        : String(c.scene).replace(/^data\//, "");
      expect(fs.existsSync(path.join(dataDir, rel))).toBe(true);
    }
  });
});
