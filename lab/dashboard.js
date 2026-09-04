// Wang Lab dashboard — search runs IN-PAGE (no worker), chunked async so the
// UI stays responsive. All wiring is direct: if the numbers tick, it's alive.
import { LabSearch, SEARCH_VERSION } from "../mapgen/lib/lab-search.mjs";
import gridsData from "../mapgen/out/oracle/lab-vertex-grids.json";

const $ = (id) => document.getElementById(id);
const grids = gridsData;
let search = null;
let startT = 0;
let lastEventT = 0;
let lastScored = 0;
const history = [];

const LEDGER = "wanglab-sweeps-ledger-v1";
let ledger = {};
try { ledger = JSON.parse(localStorage.getItem(LEDGER) || "{}"); } catch { ledger = {}; }
const saveLedger = () => localStorage.setItem(LEDGER, JSON.stringify(ledger));
function gridsFingerprint(g) {
  const str = JSON.stringify(g);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function log(text, cls) {
  const el = document.createElement("div");
  if (cls) el.className = cls;
  el.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  const feed = $("log");
  feed.prepend(el);
}

// ---- tile map: the answer key, as placed rectangles (herringbone layout) ----
function drawTileMap() {
  const cv = $("tilemap");
  const ctx = cv.getContext("2d");
  const bb = grids.bbox && grids.bbox["78633191"];
  if (!bb) throw new Error("no bbox in grids JSON");
  const PX = 3;
  cv.width = (bb.mxx - bb.mnx + 1) * PX;
  cv.height = (bb.mxy - bb.mny + 1) * PX;
  const ctx2 = cv.getContext("2d");
  ctx2.fillStyle = "#0b0e12";
  ctx2.fillRect(0, 0, cv.width, cv.height);
  const hue = (i) => `hsl(${(i * 137.5) % 360} 65% 55%)`;
  const pls = (grids["78633191"].placements || []);
  for (const p of pls) {
    ctx2.fillStyle = hue(p.tile);
    ctx2.fillRect((p.X - bb.mnx) * PX, (p.Y - bb.mny) * PX, (p.isH ? 8 : 4) * PX - 1, (p.isH ? 4 : 8) * PX - 1);
  }
  ctx2.fillStyle = "#0b0e12aa";
  ctx2.font = "10px monospace";
  ctx2.fillText(`tile map · seed 91 · ${pls.length} placed tiles · static (the answer key)`, 4, cv.height - 4);
}

// ---- trend chart: accuracy % over elapsed time, with noise references ----
function drawChart() {
  const cv = $("chart"), ctx = cv.getContext("2d");
  ctx.fillStyle = "#0b0e12";
  ctx.fillRect(0, 0, cv.width, cv.height);
  const scoredNow = search ? search.scored : 1;
  const prefixNoise = (100 * (Math.log2(Math.max(scoredNow, 2)) + 2)) / 548;
  const fullNoise = 50 + 4 * 100 * Math.sqrt(0.25 / 548);
  const deepestNow = search ? search.deepest : 0;
  const yMax = Math.min(100, Math.max(30, Math.ceil(fullNoise * 1.5), Math.ceil(deepestNow * 1.4)));
  const maxT = Math.max(10, (Date.now() - startT) / 1000);
  const X = (t) => (t / maxT) * (cv.width - 44) + 38;
  const Y = (d) => cv.height - 18 - (d / yMax) * (cv.height - 28);
  ctx.font = "10px monospace";
  ctx.strokeStyle = "#1d2530";
  for (let g = 0; g <= 4; g++) {
    const d = (yMax / 4) * g;
    ctx.beginPath(); ctx.moveTo(38, Y(d)); ctx.lineTo(cv.width - 5, Y(d)); ctx.stroke();
    ctx.fillStyle = "#5a6a7a";
    ctx.fillText(d.toFixed(0) + "%", 6, Y(d) + 3);
  }
  const ref = (v, label, color) => {
    ctx.strokeStyle = color; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(38, Y(v)); ctx.lineTo(cv.width - 5, Y(v)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.fillText(label, 42, Y(v) - 4);
  };
  ref(prefixNoise, `prefix noise (S) ${prefixNoise.toFixed(1)}%`, "#c9873a");
  ref(fullNoise, `full-walk noise (P) ${fullNoise.toFixed(1)}%`, "#c9873a");
  if (history.length >= 2) {
    ctx.strokeStyle = "#8fd3ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [t, acc] of history) ctx.lineTo(X(t), Y(acc));
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = "#5a6a7a";
  ctx.fillText("elapsed s →", cv.width - 80, cv.height - 5);
}

// ---- engine event wiring ----
function wire(s) {
  s.on((evt) => {
    lastEventT = Date.now();
    if (evt.type === "progress") {
      $("scored").textContent = evt.scored.toLocaleString("en-US");
      const acc = evt.accuracy ?? 0;
      $("accuracy").textContent = acc.toFixed(2) + "%";
      $("deepest").textContent = evt.deepest;
      const elapsed = (Date.now() - startT) / 1000;
      $("rate").textContent = Math.round(evt.scored / Math.max(1, elapsed)).toLocaleString("en-US");
      $("elapsed").textContent = elapsed.toFixed(0) + "s";
      $("progressFill").style.width = Math.min(100, acc) + "%";
      history.push([elapsed, acc]);
      if (history.length > 2000) history.splice(0, history.length - 2000);
      drawChart();
    } else if (evt.type === "best") {
      $("deepestInfo").textContent = JSON.stringify(evt.info);
      log(`new best: accuracy ${(100 * evt.depth / 548).toFixed(1)}% — ${JSON.stringify(evt.info)}`, "best");
    } else if (evt.type === "sweepDone") {
      ledger[gridsFingerprint(grids) + "|" + evt.key] = { fp: gridsFingerprint(grids), ts: Date.now(), accuracy: evt.accuracy };
      saveLedger();
    } else if (evt.type === "done") {
      $("state").textContent = evt.reason;
      $("accuracy").textContent = (evt.accuracy ?? 0).toFixed(2) + "%";
      setButtons(evt.reason);
      log(`search ${evt.reason} — scored ${evt.scored}, accuracy ${(evt.accuracy ?? 0).toFixed(2)}%${evt.winner ? " — WINNER: " + JSON.stringify(evt.winner) : ""}`, "done");
    }
  });
}

function setButtons(state) {
  const running = state === undefined && search && search.state === "running";
  $("start").disabled = !!running;
  $("pause").disabled = !running;
  $("stop").disabled = !running;
  if (state) { $("pause").textContent = "Pause"; delete $("pause").dataset.paused; }
}

$("start").addEventListener("click", () => {
  const config = {
    templates: { S1: $("tS1").checked, S2: $("tS2").checked, P: $("tP").checked },
    batchSize: 20000,
  };
  if ($("deep").checked) { config.missBudget = 40; config.s1Warmups = [0, 1, 2, 3]; }
  const fp = gridsFingerprint(grids);
  config.skipKeys = Object.entries(ledger).filter(([, v]) => v.fp === fp).map(([k]) => k.split("|").slice(1).join("|"));
  history.length = 0;
  startT = Date.now();
  lastEventT = Date.now();
  search = new LabSearch({ grids, seed: "78633191", area: { x0: -16896, y0: 11264 }, dims: { W: 256, H: 102 }, config });
  wire(search);
  setButtons();
  $("state").textContent = "running";
  const pending = Object.values(ledger).filter((v) => v.fp === fp).length;
  log(`search started — ${pending} ledgered sub-sweeps will be skipped (engine ${SEARCH_VERSION})`);
  search.run().catch((err) => {
    $("state").textContent = "CRASHED";
    log("engine crashed: " + (err && err.stack ? err.stack.split("\n").slice(0, 3).join(" | ") : String(err)), "done");
  });
});

$("pause").addEventListener("click", () => {
  if (!search) return;
  if ($("pause").dataset.paused) {
    search.resume();
    delete $("pause").dataset.paused;
    $("pause").textContent = "Pause";
    log("resumed");
  } else {
    search.pause();
    $("pause").dataset.paused = "1";
    $("pause").textContent = "Resume";
    log("paused");
  }
});

$("stop").addEventListener("click", () => {
  if (!search) return;
  search.stop();
  log("stop requested", "done");
});

// heartbeat: aliveness is self-evident — if "since event" grows, it's dead
setInterval(() => {
  const since = ((Date.now() - lastEventT) / 1000).toFixed(0);
  $("heartbeat").textContent = search && search.state === "running" ? `${since}s ago (rate ${$("rate").textContent}/s)` : "—";
  if (running_()) drawChart();
}, 1000);
function running_() { return search && search.state === "running"; }

try {
  drawTileMap();
  const n = Object.keys(grids["78633191"].grid).length;
  log(`grids imported — ${n} vertices for seed 91 (engine ${SEARCH_VERSION})`);
} catch (err) {
  log("grids load FAILED: " + err.message, "done");
}
