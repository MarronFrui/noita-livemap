// Lab search engine — shared by the CLI optimizer and the Vite dashboard
// worker. PURE ESM: no Node imports (runs in browsers/workers too).
//
// The search compares candidate vertex-coloring schemes against the observed
// lab grids with the exact-match prefilter: a wrong candidate dies at its
// first mismatched vertex; a true model walks all informative vertices clean.
//
// Consumption model: the stbhw fill colors ALL vertices first (row-major over
// the vertex grid) before any tile-choice draws — so the vertex prefix of the
// stream is choice-draw-independent. repReduce is OFF in this engine (the
// game's setting is unknown; a true base model would still match everywhere
// except rep-reduced vertices).

import { NollaPrng, seededPrng } from "./wang-js.mjs";
export { seededPrng }; // re-export for integrity tests and tooling

// Bump when walk semantics change (scan order, class rule, consumption rule,
// scoring) — invalidates any persisted sweep ledger.
export const SEARCH_VERSION = "2.1.0";

export const DRAW = {
  random: (rng, cc) => (cc === 1 ? 0 : rng.random(0, cc - 1)),
  nextUmod: (rng, cc) => rng.nextU() % cc,
  nextmul: (rng, cc) => Math.floor(rng.next() * cc),
  nextUhalf: (rng, cc) => (rng.nextU() >>> 1) % cc,
  // warm-up variants: the game may discard draws before the used one
  random_w2: (rng, cc) => { rng.random(0, 1); return cc === 1 ? 0 : rng.random(0, cc - 1); },
  nextUmod_w2: (rng, cc) => { rng.nextU(); return rng.nextU() % cc; },
  // multi-draw: two draws combined (sum mod cc) — catches xor/add schemes
  nextU2sum: (rng, cc) => (rng.nextU() + rng.nextU()) % cc,
};

export const classOf = (i, j) => (((i - j) % 4) + 4) % 4;

export const NC = [2, 1, 2, 1];
export const S = 4;

// observed vertices for one seed from the recovery JSON (binary classes only)
export function observedVertices(grids, seed) {
  const out = [];
  for (const [key, color] of Object.entries(grids[seed].grid)) {
    const [I, J] = key.split(",").map(Number);
    if (classOf(I, J) === 1 || classOf(I, J) === 3) continue;
    out.push({ I, J, color });
  }
  return out;
}

export function makeScanList(W, H) {
  const VMAX_I = Math.floor(W / S) + 6, VMAX_J = Math.floor(H / S) + 6;
  const list = [];
  for (let j = 0; j < VMAX_J; j++) for (let i = 0; i < VMAX_I; i++) list.push([i, j]);
  return list;
}

const yieldToMessages = () => new Promise((r) => setTimeout(r, 0));

export class LabSearch {
  // grids: recovery JSON; seed: main seed string; area: {x0,y0}, dims {W,H}
  // config: { templates: {S1:true,S2:true,P:true}, aligns, draws, s2MaxK, batchSize }
  constructor({ grids, seed, area, dims, config }) {
    this.grids = grids;
    this.seed = seed;
    this.area = area;
    this.dims = dims;
    this.config = config;
    this.obs = observedVertices(grids, seed);
    this.obsMap = new Map(this.obs.map((v) => [v.I + "," + v.J, v.color]));
    this.scanList = makeScanList(dims.W, dims.H);
    this.skipKeys = new Set(config.skipKeys || []);
    this.scored = 0;
    this.deepest = 0;
    this.deepestInfo = null;
    this.winner = null;
    this.state = "idle"; // idle | running | paused | done | stopped
    this._stop = false;
    this._pause = false;
    this._listeners = [];
  }

  on(cb) { this._listeners.push(cb); }
  emit(evt) { for (const cb of this._listeners) cb(evt); }
  pause() { if (this.state === "running") this._pause = true; }
  resume() { if (this.state === "paused") { this._pause = false; } }
  stop() { this._stop = true; this._pause = false; }

  // walk: depth = informative vertices matched. missBudget = tolerated
  // mismatches (0 = exact-match prefilter; >0 catches schemes like
  // rep-reduction that legally re-color a minority of vertices)
  walk(makeRng, draw, dI, dJ, obsAt, missBudget = 0) {
    const rng = makeRng();
    let depth = 0, miss = 0;
    for (let idx = 0; idx < this.scanList.length; idx++) {
      const [i, j] = this.scanList[idx];
      const c = draw(rng, NC[classOf(i, j)]);
      const want = obsAt[idx];
      if (want !== undefined) {
        if (c === want) depth++;
        else if (++miss > missBudget) return { depth, alive: false };
      }
    }
    return { depth, alive: true };
  }

  skey(...parts) { return [this.seed, SEARCH_VERSION, ...parts].join("|"); }

  aligns() { return this.config.aligns || [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, -1], [1, 1], [-1, -1]]; }
  draws() {
    const names = this.config.draws || Object.keys(DRAW);
    return names.map((n) => [n, DRAW[n]]);
  }

  async run() {
    this.state = "running";
    const cfg = this.config;
    const aligns = this.aligns();
    const draws = this.draws();
    const ws = Number(this.seed) >>> 0;

    if (cfg.templates.S1) {
      const warmups = cfg.s1Warmups || [0];
      // anchor list mode (e.g. biome-grid seeding): sweep explicit points
      const anchorPts = cfg.s1Anchors
        ? cfg.s1Anchors.flatMap(([ax, ay]) => [
            [ax, ay],
            [ax * 512, ay * 512],
            [ax * 512, (ay + 1) * 512 - 1],
            [(ax + 1) * 512 - 1, ay * 512],
            [(ax + 1) * 512 - 1, (ay + 1) * 512 - 1],
          ])
        : null;
      const pts =
        anchorPts ||
        (() => {
          const a = [];
          for (let sy = this.area.y0; sy < this.area.y0 + this.dims.H * 10; sy++)
            for (let sx = this.area.x0; sx < this.area.x0 + this.dims.W * 10; sx++) a.push([sx, sy]);
          return a;
        })();
      for (const warm of warmups) {
        for (const [dname, draw] of draws) {
          for (const [dI, dJ] of aligns) {
            const key = this.skey("S1", "w" + warm, dname, dI + "," + dJ, "b" + (cfg.missBudget || 0));
            if (this.skipKeys.has(key)) { this.emit({ type: "skipped", key }); continue; }
            const obsAt = this.scanList.map(([i, j]) => this.obsMap.get(i - dI + "," + (j - dJ)));
            for (const [sx, sy] of pts) {
              const { depth, alive } = this.walk(
                () => {
                  const r = seededPrng(ws, sx, sy);
                  for (let w = 0; w < warm; w++) r.next();
                  return r;
                },
                draw, dI, dJ, obsAt, cfg.missBudget
              );
              this.scored++;
              if (depth > this.deepest) {
                this.deepest = depth;
                this.deepestInfo = { template: "S1", draw: dname, dI, dJ, sx, sy, warm };
                this.emit({ type: "best", depth, info: this.deepestInfo });
              }
              if (alive && depth >= this.obs.length * 0.9) {
                this.winner = { template: "S1", draw: dname, dI, dJ, sx, sy, warm, depth };
                this.finish("hit");
                return;
              }
              if (this.scored % cfg.batchSize === 0) {
                this.emit({ type: "progress", scored: this.scored, deepest: this.deepest, accuracy: (100 * this.deepest) / this.obs.length });
                await yieldToMessages();
                if (this._pause && !this._stop) this.emit({ type: "control", what: "paused" });
                while (this._pause && !this._stop) await yieldToMessages();
                if (this._stop) { this.finish("stopped"); return; }
                this.emit({ type: "control", what: "resumed" });
              }
            }
            this.emit({ type: "sweepDone", key, accuracy: (100 * this.deepest) / this.obs.length });
          }
        }
      }
    }

    if (cfg.templates.S2) {
      const maxK = cfg.s2MaxK || 200000;
      for (const [dname, draw] of draws) {
        for (const [dI, dJ] of aligns) {
          const key = this.skey("S2", dname, dI + "," + dJ, "b" + (cfg.missBudget || 0));
          if (this.skipKeys.has(key)) { this.emit({ type: "skipped", key }); continue; }
          const obsAt = this.scanList.map(([i, j]) => this.obsMap.get(i - dI + "," + (j - dJ)));
          const base = new NollaPrng(ws);
          base.setRandomFromWorldSeed(ws);
          for (let k = 0; k <= maxK; k++) {
            // incremental: skip k and k+1 share the base stream — advance one
            // draw per step instead of re-skipping from scratch (O(maxK) total)
            const u = base.nextU();
            const { depth, alive } = this.walk(() => new NollaPrng(u), draw, dI, dJ, obsAt, cfg.missBudget);
            this.scored++;
            if (depth > this.deepest) {
              this.deepest = depth;
              this.deepestInfo = { template: "S2", draw: dname, dI, dJ, k };
              this.emit({ type: "best", depth, info: this.deepestInfo });
            }
            if (alive && depth >= this.obs.length * 0.9) { this.winner = { template: "S2", draw: dname, dI, dJ, k, depth }; this.finish("hit"); return; }
            if (this.scored % cfg.batchSize === 0) {
              this.emit({ type: "progress", scored: this.scored, deepest: this.deepest, accuracy: (100 * this.deepest) / this.obs.length });
              await yieldToMessages();
              if (this._pause && !this._stop) this.emit({ type: "control", what: "paused" });
              while (this._pause && !this._stop) await yieldToMessages();
              if (this._stop) { this.finish("stopped"); return; }
              this.emit({ type: "control", what: "resumed" });
            }
          }
          this.emit({ type: "sweepDone", key, accuracy: (100 * this.deepest) / this.obs.length });
        }
      }
    }

    if (cfg.templates.P) {
      const obsList = this.obs;
      const UNITS = {
        worldPx: (I, J) => [this.area.x0 + (I - 2) * S * 10, this.area.y0 + (J - 2) * S * 10],
        cell: (I, J) => [Math.floor((this.area.x0 + (I - 2) * S * 10) / 10), Math.floor((this.area.y0 + (J - 2) * S * 10) / 10)],
        vertexIdx: (I, J) => [I, J],
        chunk: (I, J) => [Math.floor((this.area.x0 + (I - 2) * S * 10) / 512), Math.floor((this.area.y0 + (J - 2) * S * 10) / 512)],
      };
      for (const [unit, fn] of Object.entries(UNITS)) {
        const range = unit === "vertexIdx" ? 4 : unit === "chunk" ? 2 : unit === "cell" ? 8 : 40;
        const pkey = this.skey("P", unit, "b" + (cfg.missBudget || 0));
        if (this.skipKeys.has(pkey)) { this.emit({ type: "skipped", pkey }); continue; }
        for (let dx = -range; dx <= range; dx++)
          for (let dy = -range; dy <= range; dy++)
            for (const [dname, draw] of draws) {
              let m = 0;
              for (const v of obsList) {
                const [bx, by] = fn(v.I, v.J);
                if (draw(seededPrng(ws, bx + dx, by + dy), 2) === v.color) m++;
              }
              this.scored++;
              const depth = Math.round((m / obsList.length) * this.obs.length);
              if (depth > this.deepest) {
                this.deepest = depth;
                this.deepestInfo = { template: "P", unit, dx, dy, draw: dname, pct: +(100 * m / obsList.length).toFixed(2) };
                this.emit({ type: "best", depth, info: this.deepestInfo });
              }
              if (m === obsList.length) { this.winner = { template: "P", unit, dx, dy, draw: dname }; this.finish("hit"); return; }
              if (this.scored % cfg.batchSize === 0) {
                this.emit({ type: "progress", scored: this.scored, deepest: this.deepest, accuracy: (100 * this.deepest) / this.obs.length });
                await yieldToMessages();
                if (this._pause && !this._stop) this.emit({ type: "control", what: "paused" });
                while (this._pause && !this._stop) await yieldToMessages();
                if (this._stop) { this.finish("stopped"); return; }
                this.emit({ type: "control", what: "resumed" });
              }
            }
        this.emit({ type: "sweepDone", key: pkey });
      }
    }

    this.finish(this.winner ? "hit" : "exhausted");
  }

  finish(reason) {
    this.state = reason === "stopped" ? "stopped" : "done";
    this.emit({ type: "done", reason, winner: this.winner, scored: this.scored, deepest: this.deepest, accuracy: (100 * this.deepest) / this.obs.length, deepestInfo: this.deepestInfo });
  }
}

