// dig #129: the ART-FIRST census — the per-chunk init()
// LoadPixelScene lane (VERIFIED §12 layer 1, 256 callsites measured
// this session + (104)'s 214 in the same tree) is the surface band's
// visible crust; the SURFACE_V3 caves-field render paints no art at all
// (the "homogeneous noise" verdict). This instrument extracts every
// LoadPixelScene call from data/scripts/biomes/**/*.lua: which biome
// file, which scene PNG (+ visual/background), the position expressions,
// boolean flags — the DATA the compositor dig will wire
// (render law: sky rows → art crust → caves field below the crust).
// No binary reads; pure game-data. Cite: data/scripts/biomes (the
// LocalLow unpack root), the dig's own run.
//
// Output: mapgen/out/artlane-2026-10-13.json
import fs from "node:fs";
import path from "node:path";
import { findNoitaDataDir, repoRoot } from "../lib/paths.mjs";

function walk(dir, out = []) {
  let es;
  try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".lua")) out.push(p);
  }
  return out;
}

const dataDir = findNoitaDataDir();
const scriptsDir = path.join(dataDir, "scripts");
const files = walk(path.join(scriptsDir, "biomes"));

const CALL_RE = /LoadPixelScene\s*\(/g;

// top-level comma split (paren/brace depth-aware; lua strings kept whole)
function splitArgs(s) {
  const args = [];
  let depth = 0, cur = "", str = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (str) {
      cur += ch;
      if (ch === "\\" && i + 1 < s.length) { cur += s[++i]; continue; }
      if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'") { str = ch; cur += ch; continue; }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) { args.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

const calls = [];
const filesSummary = [];
for (const f of files) {
  const rel = "data/scripts/" + path.relative(scriptsDir, f).replaceAll("\\", "/");
  const src = fs.readFileSync(f, "utf8");
  const hits = [];
  RE_CALL: {
    let m;
    while ((m = CALL_RE.exec(src))) {
      // capture the balanced body after the '('
      let i = CALL_RE.lastIndex; // after the '('
      // rewind: CALL_RE consumed '('
      const start = m.index + m[0].length; // first char inside parens
      let depth = 1, str = null, end = -1;
      for (let j = start; j < src.length; j++) {
        const ch = src[j];
        if (str) {
          if (ch === "\\") continue;
          if (ch === str) str = null;
          continue;
        }
        if (ch === '"' || ch === "'") { str = ch; continue; }
        if ((ch === "(" || ch === "{" || ch === "[")) depth++;
        if ((ch === ")" || ch === "}" || ch === "]")) {
          depth--;
          if (depth === 0) { end = j; break; }
        }
      }
      if (end < 0) continue;
      void i;
      const args = splitArgs(src.slice(start, end));
      const line = (src.slice(0, m.index).match(/\n/g) ?? []).length + 1;
      const [scene = "", visual = "", px = "", py = "", bg = "", clip = "", ...rest] = args;
      const clean = (s) => String(s).replaceAll('"', "").replace(/^data\//, "");
      const sceneP = scene.startsWith('"') ? clean(scene) : null;
      hits.push({
        line, argc: args.length,
        scene: sceneP,
        visual: visual.startsWith('"') ? clean(visual) : visual,
        background: bg.startsWith('"') ? clean(bg) : bg,
        px, py,
        clip,
        flags: rest.join(","),
        dynamicPosition: !/-?\d+$/.test(px) || !/-?\d+$/.test(py),
      });
    }
  }
  if (hits.length) {
    filesSummary.push({ file: rel, calls: hits.length });
    for (const h of hits) calls.push({ file: rel, ...h });
  }
}

const normScene = (s) => String(s).replace(/^data\//, "");
// Scene resolution: (1) the literal path; (2) the game's own SHIPPED form —
// the pixel-scene packer folds raw PNGs into biomes_impl/spliced/<name>
// (.plz buffer + placement xml, pos_x/pos_y explicit) — the user's rule
// stands: a complete game ships complete assets, so a "missing" verdict is
// never issued without checking the shipped form first; (3) dynamic Lua
// expressions (".."-concat) are UNRESOLVABLE STATICALLY, not missing.
const sceneStat = (rel) => fs.existsSync(path.join(dataDir, rel));
const sceneResolve = (c) => {
  const raw = String(c.scene ?? "");
  if (raw.includes("..")) return { state: "dynamic-expr", rel: raw };
  const rel = normScene(raw);
  if (sceneStat(rel)) return { state: "resolved", rel };
  const base = rel.split("/").pop();
  const spliced = "biome_impl/spliced/" + base;
  if (sceneStat(spliced)) return { state: "resolved-spliced", rel: spliced };
  if (sceneStat(spliced.replace(/\.png$/, ""))) return { state: "resolved-spliced", rel: spliced.replace(/\.png$/, "") };
  return { state: "unresolved", rel };
};
const unresolvedPaths = {};
const unresolved = [];
for (const c of calls) {
  if (!c.scene) continue;
  const s = sceneResolve(c);
  c.sceneState = s.state;
  if (s.state === "resolved-spliced") { s.splicedRel = s.rel; c.sceneSpliced = s.rel; }
  else if (s.state === "unresolved") { unresolved.push({ file: c.file, line: c.line, scene: c.scene }); unresolvedPaths[c.scene] = (unresolvedPaths[c.scene] ?? 0) + 1; }
}
const counts = {
  resolved: calls.filter((c) => c.sceneState === "resolved").length,
  resolvedSpliced: calls.filter((c) => c.sceneState === "resolved-spliced").length,
  dynamicExpr: calls.filter((c) => c.sceneState === "dynamic-expr").length,
  unresolved: calls.filter((c) => c.sceneState === "unresolved").length,
};
const uniques = {};
for (const c of calls) uniques[c.scene ?? "(none)"] = (uniques[c.scene ?? "(none)"] ?? 0) + 1;

const out = {
  when: "2026-10-13",
  source: "<unpak-data>/scripts/biomes/**/*.lua",
  total: calls.length,
  files: filesSummary.length,
  uniqueScenes: Object.keys(uniques).length,
  missingOnDisk: 0, // superseded by the resolution counts (a complete game ships complete assets — the resolution path decides, never a bare stat)
  sceneResolution: counts,
  unresolvedPaths,
  dynamicPosition: calls.filter((c) => c.dynamicPosition).length,
  note: "LoadPixelScene(scene_png, visual_png, x_expr, y_expr, background_png, clip?, flags...) — positional; x/y often variables (chunk-local). Shipped art = biomes_impl/spliced/<name> (.plz + placement xml WITH explicit pos_x/pos_y) — the compositor reads the spliced form; the raw lua paths are the dev-tree names.",
  calls, filesSummary, uniques,
};
const outPath = path.join(repoRoot, "mapgen/extractions/artlane-2026-10-13.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`calls ${calls.length} in ${filesSummary.length} files · unique scenes ${out.uniqueScenes} · resolution: ${counts.resolved} literal / ${counts.resolvedSpliced} spliced-shipped / ${counts.dynamicExpr} lua-concat / ${counts.unresolved} unresolved`);
console.log("top scenes:", JSON.stringify(Object.entries(uniques).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ×${v}`)));
console.log("-> " + outPath.replace(repoRoot, "."));
