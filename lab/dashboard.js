// Wang Lab dashboard — supervises the search worker.
const $ = (id) => document.getElementById(id);
const worker = new Worker(new URL("./lab-worker.mjs", import.meta.url), { type: "module" });

let grids = null;
let gridsFp = "";
let running = false;
const LEDGER = "wanglab-sweeps-ledger-v1";
let ledger = {};
try { ledger = JSON.parse(localStorage.getItem(LEDGER) || "{}"); } catch { ledger = {}; }
function saveLedger() { localStorage.setItem(LEDGER, JSON.stringify(ledger)); }
function gridsFingerprint(g) { // djb2 — ledger auto-invalidates when the answer key changes
  const str = JSON.stringify(g); let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
let startT = 0;
const history = []; // {t, deepest}

fetch("/mapgen/out/oracle/lab-vertex-grids.json")
  .then((r) => r.json())
  .then((g) => { grids = g; drawGrid(); log("grids loaded — ready"); })
  .catch(() => log("FAILED to load lab-vertex-grids.json — run the recovery experiment first", "done"));

function log(text, cls) {
  const el = document.createElement("div");
  if (cls) el.className = cls;
  el.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  const feed = $("log");
  feed.prepend(el);
}

function drawGrid() {
  const cv = $("grid"), ctx = cv.getContext("2d");
  const S = 4, COLS = 70, ROWS = 31;
  ctx.fillStyle = "#0b0e12";
  ctx.fillRect(0, 0, cv.width, cv.height);
  const classOf = (i, j) => (((i - j) % 4) + 4) % 4;
  for (const [key, color] of Object.entries(grids["78633191"].grid)) {
    const [I, J] = key.split(",").map(Number);
    const cl = classOf(I, J);
    ctx.fillStyle = cl === 1 || cl === 3 ? "#3a4450" : color === 0 ? "#ffd479" : "#8fd3ff";
    ctx.fillRect(I * S, J * S, S - 1, S - 1);
  }
}

function drawChart() {
  const cv = $("chart"), ctx = cv.getContext("2d");
  ctx.fillStyle = "#0b0e12";
  ctx.fillRect(0, 0, cv.width, cv.height);
  const scoredNow = Number($("scored").textContent.replace(/[^\d]/g, "")) || 1;
  // two noise references: prefix walks (log2(N) vertices) and full-walk
  // positional scoring (selection max of a 389-sample binomial ≈ 50% + 4σ)
  const prefixNoise = (100 * (Math.log2(Math.max(scoredNow, 2)) + 2)) / 389;
  const fullNoise = 50 + 4 * 100 * Math.sqrt(0.25 / 389);
  const deepestNow = history.length ? history[history.length - 1][1] : 0;
  const yMax = Math.min(100, Math.max(30, Math.ceil(fullNoise * 1.35), Math.ceil(deepestNow * 1.4)));
  const maxT = Math.max(10, history.length ? history[history.length - 1].t : 10);
  const X = (t) => (t / maxT) * (cv.width - 44) + 38;
  const Y = (d) => cv.height - 18 - (d / yMax) * (cv.height - 28);
  // gridlines + labels
  ctx.font = "10px monospace";
  ctx.strokeStyle = "#1d2530";
  for (let g = 0; g <= 4; g++) {
    const d = (yMax / 4) * g;
    ctx.beginPath();
    ctx.moveTo(38, Y(d));
    ctx.lineTo(cv.width - 5, Y(d));
    ctx.stroke();
    ctx.fillStyle = "#5a6a7a";
    ctx.fillText(d.toFixed(0), 8, Y(d) + 3);
  }
  // noise floor (dashed)
  ctx.strokeStyle = "#c9873a";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(38, Y(noise));
  ctx.lineTo(cv.width - 5, Y(noise));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#c9873a";
  ctx.fillText(`prefix noise ${prefixNoise.toFixed(1)}%`, 42, Y(prefixNoise) - 4);
  ctx.fillText(`full-walk noise ${fullNoise.toFixed(1)}%`, 42, Y(fullNoise) - 4);
  ctx.strokeStyle = "#c9873a";
  ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(38, Y(fullNoise)); ctx.lineTo(cv.width - 5, Y(fullNoise)); ctx.stroke();
  ctx.setLineDash([]);
  // data trend
  if (history.length >= 2) {
    ctx.strokeStyle = "#8fd3ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [t, d] of history) ctx.lineTo(X(t), Y(d));
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = "#5a6a7a";
  ctx.fillText("elapsed s →", cv.width - 80, cv.height - 5);
}

$("start").addEventListener("click", () => {
  if (!grids) { log("grids not loaded yet", "done"); return; }
  const fp = gridsFingerprint(grids);
  const skipKeys = Object.entries(ledger)
    .filter(([k, v]) => v.fp === fp)
    .map(([k]) => k.split("|").slice(1).join("|")); // strip fp prefix
  const config = {
    templates: { S1: $("tS1").checked, S2: $("tS2").checked, P: $("tP").checked },
    batchSize: 20000,
    skipKeys,
  };
  if ($("deep").checked) { config.missBudget = 40; config.s1Warmups = [0, 1, 2, 3]; }
  history.length = 0;
  worker.postMessage({ type: "start", grids, seed: "78633191", config });
  running = true;
  skippedCount = 0;
  startT = Date.now();
  setButtons();
  const pending = Object.values(ledger).filter((v) => v.fp === gridsFingerprint(grids)).length;
  log(`search started — ledger: ${pending} completed sub-sweeps will be skipped`);
});

$("pause").addEventListener("click", () => {
  worker.postMessage({ type: "pause" });
  $("pause").textContent = "Resume";
  $("pause").dataset.paused = "1";
  log("paused");
});

$("stop").addEventListener("click", () => {
  worker.postMessage({ type: "stop" });
  running = false;
  setButtons();
  log("stop requested", "done");
});

function setButtons() {
  $("start").disabled = running;
  $("pause").disabled = !running;
  $("stop").disabled = !running;
}

worker.onmessage = (e) => {
  const evt = e.data;
  if (evt.type === "sweepDone" || evt.type === "skipped") { /* handled below */ }
  if (evt.type === "progress") {
    $("scored").textContent = evt.scored.toLocaleString("en-US");
    $("deepest").textContent = evt.deepest;
    const acc = evt.accuracy ?? (100 * evt.deepest) / 389;
    $("accuracy").textContent = acc.toFixed(2) + "%";
    const elapsed = (Date.now() - startT) / 1000;
    $("rate").textContent = Math.round(evt.scored / Math.max(1, elapsed)).toLocaleString("en-US");
    $("elapsed").textContent = elapsed.toFixed(0) + "s";
    $("progressFill").style.width = Math.min(100, acc) + "%";
    history.push([elapsed, evt.accuracy ?? (100 * evt.deepest) / 389]);
    drawChart();
  } else if (evt.type === "best") {
    $("deepest").textContent = evt.depth;
    $("deepestInfo").textContent = JSON.stringify(evt.info);
    log(`new best: depth ${evt.depth} — ${JSON.stringify(evt.info)}`, "best");
  } else if (evt.type === "sweepDone") {
    ledger[gridsFp + "|" + evt.key] = { fp: gridsFp, ts: Date.now(), accuracy: evt.accuracy };
    saveLedger();
  } else if (evt.type === "skipped") {
    skippedCount++;
  } else if (evt.type === "done") {
    running = false;
    setButtons();
    $("state").textContent = evt.reason;
    log(`search ${evt.reason} — scored ${evt.scored}, deepest ${evt.deepest}${evt.winner ? " — WINNER: " + JSON.stringify(evt.winner) : ""}`, "done");
    if (evt.winner) log("WINNER — verify ran in-engine; solution saved by CLI for disk writes", "done");
  }
};

// state ticker
setInterval(() => {
  if (running) $("state").textContent = $("pause").dataset.paused ? "paused" : "running";
}, 500);
