// Wang Lab dashboard — supervises the search worker.
const $ = (id) => document.getElementById(id);
const worker = new Worker(new URL("./lab-worker.mjs", import.meta.url), { type: "module" });

let grids = null;
let running = false;
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
  if (history.length < 2) return;
  const maxD = 389, maxT = history[history.length - 1].t;
  ctx.strokeStyle = "#8fd3ff";
  ctx.beginPath();
  for (const [t, d] of history) {
    const x = (t / maxT) * (cv.width - 10) + 5;
    const y = cv.height - 5 - (d / maxD) * (cv.height - 10);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  // noise reference: ~log2(scored) for random walks
  ctx.strokeStyle = "#4a5666";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  const scoredNow = Number($("scored").textContent.replace(/\s/g, "")) || 1;
  const noise = Math.min(389, Math.log2(Math.max(scoredNow, 2)) + 2);
  const ny = cv.height - 5 - (noise / maxD) * (cv.height - 10);
  ctx.moveTo(5, ny);
  ctx.lineTo(cv.width - 5, ny);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#4a5666";
  ctx.fillText(`noise floor ~log2(N) = ${noise.toFixed(0)}`, 8, ny - 4);
}

$("start").addEventListener("click", () => {
  if (!grids) { log("grids not loaded yet", "done"); return; }
  const config = {
    templates: { S1: $("tS1").checked, S2: $("tS2").checked, P: $("tP").checked },
    batchSize: 20000,
  };
  history.length = 0;
  worker.postMessage({ type: "start", grids, seed: "78633191", config });
  running = true;
  startT = Date.now();
  setButtons();
  log("search started");
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
  if (evt.type === "progress") {
    $("scored").textContent = evt.scored.toLocaleString("en-US");
    $("deepest").textContent = evt.deepest;
    const elapsed = (Date.now() - startT) / 1000;
    $("rate").textContent = Math.round(evt.scored / Math.max(1, elapsed)).toLocaleString("en-US");
    $("elapsed").textContent = elapsed.toFixed(0) + "s";
    $("progressFill").style.width = Math.min(100, (evt.deepest / 389) * 100) + "%";
    history.push([elapsed, evt.deepest]);
    drawChart();
  } else if (evt.type === "best") {
    $("deepest").textContent = evt.depth;
    $("deepestInfo").textContent = JSON.stringify(evt.info);
    log(`new best: depth ${evt.depth} — ${JSON.stringify(evt.info)}`, "best");
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
