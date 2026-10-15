// 2026-10-15-kind-default-probe.mjs — dig #144 pre-port measurement (no fix).
// For the kind=-1 (no noise_type) black-pocket defs, compare the CURRENT port
// (noiseKind=-1 => surfaceField throws => DEAD => black) against the proposed
// byte-faithful default (noiseKind=5 = the uid ctor default, C59/C43 [+0x224]=5).
// Verifies forcing kind=5 yields a sensible mostly-solid mask (solid_wall) and
// does not throw, BEFORE the product patch. METER-CLASS: E1 (solid/air/throw counts).
// Run: SURFACE_V2=1 SURFACE_V3=1 node mapgen/experiments/2026-10-15-kind-default-probe.mjs

const { findNoitaDataDir } = await import("../lib/paths.mjs");
const { loadBiomeConfig, biomeAt } = await import("../lib/biomes.mjs");
const fsp = await import("node:fs/promises");
const ntSrc = await fsp.readFile(new URL("../lib/noise-terrain.mjs", import.meta.url), "utf8");
const augmented = ntSrc.replace(/^function (ensureSurfaceTable|biomeCfg|uidFrom|makeGradAt)\(/gm, "export function $1(");
const tmpUrl = new URL("../lib/.audit-nt.generated.mjs", import.meta.url);
await fsp.writeFile(tmpUrl, augmented);
const nt = await import(tmpUrl.href);
await fsp.unlink(tmpUrl);
const proto = await import("../lib/noise-proto.mjs");

const dataDir = findNoitaDataDir();
const config = loadBiomeConfig(dataDir);
const SKY = 48, W = 71, CHUNK = 512, DEF_SEED = 0;

// the black-pocket defs + empty.xml (kind-5 control)
const want = new Set(["solid_wall.xml", "solid_wall_hidden_cavern.xml", "lava.xml", "temple_wall.xml", "teleroom.xml", "friend_1.xml", "empty.xml"]);
const found = new Map();
for (let ty = 62; ty <= 100 && found.size < want.size; ty++) {
  for (let tx = 0; tx < W; tx++) {
    const at = biomeAt(config, tx, ty - SKY);
    if (!at) continue;
    const fn = at.biome.filename.split("/").pop();
    if (want.has(fn) && !found.has(fn) && !at.biome.templateFile) found.set(fn, { tx, ty, def: at.biome });
  }
}

for (const [fn, p] of found) {
  const gradAt = (() => { try { return nt.makeGradAtFromTopology(dataDir, p.def) ?? nt.makeGradAt(p.def); } catch { return nt.makeGradAt(p.def); } })();
  const base = nt.uidFrom(p.def, nt.biomeCfg(p.def));
  base.driver = nt.makeBandDriver(config, 78633191);
  for (const kind of [-1, 5]) {
    const uid = { ...base, noiseKind: kind, noiseTypeInt: kind };
    let solid = 0, air = 0, thr = 0, firstErr = null, n = 0;
    outer:
    for (let cy = 0; cy < 52; cy++) for (let cx = 0; cx < 52; cx++) {
      const gx = p.tx * CHUNK + cx * 10 + 5, gy = p.ty * CHUNK + cy * 10 + 5;
      let v; n++;
      try { v = proto.surfaceField(uid, gx, gy, gradAt, 0, DEF_SEED); }
      catch (e) { thr++; firstErr = firstErr ?? e.message; break outer; }
      if (v > 0.5) solid++; else air++;
    }
    const tag = kind === -1 ? "CURRENT(-1)" : "PROPOSED(5)";
    console.log(`${fn.padEnd(28)} ${tag.padEnd(11)} solid=${String(solid).padStart(3)} air=${String(air).padStart(3)} throw=${thr}${firstErr ? `  [${firstErr}]` : ""}`);
  }
}
