// dig #169 count test — the bitmap_noise_file census (C144; entry (169)).
//
// FAILS UNDER THE OLD LAW'S ARITHMETIC BY CONSTRUCTION: the dig-#146/C122
// claim (now §8 row 55-corrected) asserted "mBitmapNoise has 0 hits across
// data/ ⇒ there is NO per-biome P grid in shipped data … DEAD for shipped
// data" — i.e. an expected count of ZERO attr-carrying defs. The fresh
// dig-#169 sweep reads exactly FOUR shipped biome defs carrying the attr,
// all pointing at topology_lake.png (512×256 RGB), and the mountain_lake
// anchor carrying NONE (the two-regime law: non-P biomes = the record-lane
// floor; the lake family = the P-wire question, #170). Under the old
// 0-hit arithmetic this suite's census pins (4, not 0) fail.
//
// Data-dependent guard follows the repo pattern (skip without the
// extracted data dir — the suite RUNS in the gate battery where the data
// dir is present).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR =
  process.env.NOITA_DATA_DIR ??
  "/mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/data";

const hasData = (() => {
  try {
    return fs.statSync(DATA_DIR).isDirectory();
  } catch {
    return false;
  }
})();
const d = hasData ? describe : describe.skip;

const ATTR_CARRYING = [
  "lake.xml",
  "lake_blood.xml",
  "lake_deep.xml",
  "lake_statue.xml",
];
const TOPOLOGY_PNG = path.join("biome_impl", "topology_lake.png");

d("dig #169 — the bitmap_noise_file census (C144; fails the old 0-hit law)", () => {
  it("exactly 4 shipped biome XMLs carry bitmap_noise_file (old law: 0)", () => {
    const biomeDir = path.join(DATA_DIR, "biome");
    const carriers = fs
      .readdirSync(biomeDir)
      .filter((f) => f.endsWith(".xml"))
      .filter((f) =>
        fs.readFileSync(path.join(biomeDir, f), "utf8").includes("bitmap_noise_file"),
      )
      .sort();
    // the old C122 arithmetic expected NO carrier (the "0 hits" premise);
    // the dig-#169 fresh sweep pins the exact set of four
    expect(carriers).toEqual([...ATTR_CARRYING].sort());
  });

  it("every carrier points at data/biome_impl/topology_lake.png", () => {
    const biomeDir = path.join(DATA_DIR, "biome");
    for (const f of ATTR_CARRYING) {
      const xml = fs.readFileSync(path.join(biomeDir, f), "utf8");
      const m = xml.match(/bitmap_noise_file\s*=\s*"([^"]+)"/);
      expect(m, `${f} carries the attr form`).toBeTruthy();
      expect(m[1]).toBe("data/biome_impl/topology_lake.png");
    }
  });

  it("the mountain_lake anchor carries NO bitmap_noise_file (the non-P regime)", () => {
    const xml = fs.readFileSync(path.join(DATA_DIR, "biome", "mountain_lake.xml"), "utf8");
    expect(xml.includes("bitmap_noise_file")).toBe(false);
    expect(xml.includes("mBitmapNoise")).toBe(false);
  });

  it("topology_lake.png exists with the pinned IHDR dims 512×256 RGB", () => {
    const png = fs.readFileSync(path.join(DATA_DIR, TOPOLOGY_PNG));
    // PNG signature + IHDR: width/height = big-endian u32 at 16/20,
    // bit depth @24 = 8, color type @25 = 2 (truecolor RGB)
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(256);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(2);
  });
});
