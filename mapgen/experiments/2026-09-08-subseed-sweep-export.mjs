// Export fast-lookup key grids for the C sub-seed sweeper.
// For each seed (91/92/93) and each odd-parity offset (dI in [-6..6],
// dJ in [-6..10], dI-dJ odd — even parity is structurally impossible:
// key-informative would map to cc=1 gen classes, always color 0):
//   expected[j][i] = key color at (I,J) = (i-dI, j-dJ) if that key vertex is
//   informative and in range, else 0xFF (no check).
// Format: u32 magic, u32 xmax, u32 ymax, u32 nOff, then per offset:
// i16 dI, i16 dJ, xmax*ymax bytes.

import fs from "node:fs";
import { repoRoot } from "../lib/paths.mjs";

const W = 256, H = 102, S = 4;
const xmax = Math.floor(W / S) + 6; // 70
const ymax = Math.floor((H + 4) / S) + 6; // 32

const grids = JSON.parse(fs.readFileSync(repoRoot + "/mapgen/out/oracle/lab-vertex-grids.json", "utf8"));

const offsets = [];
for (let dJ = -6; dJ <= 10; dJ++) {
  for (let dI = -6; dI <= 6; dI++) {
    if (((dI - dJ) % 2 + 2) % 2 === 1) offsets.push([dI, dJ]);
  }
}
console.log(`offsets: ${offsets.length} (odd parity) of 221`);

fs.mkdirSync("/tmp/opencode/subsweep", { recursive: true });
for (const seed of ["78633191", "78633192", "78633193"]) {
  const g = grids[seed].grid;
  const inf = new Map();
  for (const [k, color] of Object.entries(g)) {
    const [I, J] = k.split(",").map(Number);
    if (((((I - J) % 4) + 4) % 4) % 2 === 0) inf.set(I + "," + J, color);
  }
  const bufs = [];
  const head = Buffer.alloc(16);
  head.writeUInt32LE(0x5355424b, 0); // "SUBK"
  head.writeUInt32LE(xmax, 4);
  head.writeUInt32LE(ymax, 8);
  head.writeUInt32LE(offsets.length, 12);
  bufs.push(head);
  for (const [dI, dJ] of offsets) {
    const o = Buffer.alloc(4);
    o.writeInt16LE(dI, 0);
    o.writeInt16LE(dJ, 2);
    bufs.push(o);
    const gbuf = Buffer.alloc(xmax * ymax, 0xff);
    for (let j = 0; j < ymax; j++) {
      for (let i = 0; i < xmax; i++) {
        const v = inf.get((i - dI) + "," + (j - dJ));
        if (v !== undefined) gbuf[j * xmax + i] = v;
      }
    }
    bufs.push(gbuf);
  }
  const out = Buffer.concat(bufs);
  fs.writeFileSync(`/tmp/opencode/subsweep/key_${seed.slice(-2)}.bin`, out);
  console.log(`${seed}: ${out.length} bytes -> /tmp/opencode/subsweep/key_${seed.slice(-2)}.bin`);
}
