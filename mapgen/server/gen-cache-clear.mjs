// gen-cache-clear — wipe the generated-world disk cache (mapgen/out/gen-cache)
// so the next `npm run gen:server` request regenerates from scratch.
//
//   npm run gen:clear                      # everything (all revisions, all seeds)
//   npm run gen:clear -- --seed 78633191   # one seed, all revisions
//
// NOTE: if `npm run gen:server` is currently running, use its /gen/clear
// endpoints instead — the server keeps generated worlds in memory, so
// deleting the files under a running process does not invalidate it.

import { clearGenCache } from "./gen-cache.mjs";

let seed = null;
const args = process.argv.slice(2);
const seedIdx = args.indexOf("--seed");
if (seedIdx >= 0) {
  const v = Number(args[seedIdx + 1]);
  if (!Number.isFinite(v) || v < 0) {
    console.error("[gen-cache] usage: npm run gen:clear [-- --seed <n>]");
    process.exit(1);
  }
  seed = v >>> 0;
}

const removed = clearGenCache({ seed });
if (removed.length === 0) console.log("[gen-cache] nothing to clear");
for (const p of removed) console.log(`[gen-cache] removed ${p}`);
console.log(
  `[gen-cache] done — cleared ${seed === null ? "ALL seeds (all revisions)" : `seed ${seed} (all revisions)`}`
);
