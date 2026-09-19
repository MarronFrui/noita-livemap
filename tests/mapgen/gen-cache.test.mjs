// gen-cache.mjs (server) contracts: whole-cache and seed-scoped clearing,
// missing-root tolerance. Runs against a temp tree — never the real cache.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test, expect } from "vitest";
import { clearGenCache, GEN_CACHE_ROOT } from "../../mapgen/server/gen-cache.mjs";

function mkCache() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gen-cache-test-"));
  for (const [rev, seeds] of [["r3c", ["100", "200"]], ["r3d", ["100", "300"]]]) {
    for (const s of seeds) {
      const dir = path.join(root, rev, s);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "coalmine_29_14.bin"), Buffer.alloc(12));
    }
  }
  return root;
}

const listSeeds = (root) => {
  const out = [];
  for (const rev of fs.readdirSync(root)) {
    for (const s of fs.readdirSync(path.join(root, rev))) out.push(`${rev}/${s}`);
  }
  return out.sort();
};

describe("clearGenCache", () => {
  test("GEN_CACHE_ROOT is the repo's gen-cache dir", () => {
    expect(GEN_CACHE_ROOT.replace(/\\/g, "/")).toMatch(/mapgen\/out\/gen-cache$/);
  });

  test("seed=null clears every revision and seed", () => {
    const root = mkCache();
    const removed = clearGenCache({ root });
    expect(removed.sort()).toEqual(["r3c", "r3d"]);
    expect(fs.readdirSync(root)).toEqual([]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("seed-scoped clear removes that seed under every revision, keeps the rest", () => {
    const root = mkCache();
    const removed = clearGenCache({ root, seed: 100 });
    expect(removed.sort()).toEqual(["r3c/100", "r3d/100"]);
    expect(listSeeds(root)).toEqual(["r3c/200", "r3d/300"]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("tolerates a missing cache root and unknown seeds (no-op, [])", () => {
    expect(clearGenCache({ root: path.join(os.tmpdir(), "gen-cache-missing-xyz") })).toEqual([]);
    const root = mkCache();
    expect(clearGenCache({ root, seed: 999 })).toEqual([]);
    expect(listSeeds(root)).toEqual(["r3c/100", "r3c/200", "r3d/100", "r3d/300"]);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
