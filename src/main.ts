type Telemetry = {
  seed: number | string;
  x: number;
  y: number;
  biome: string;
  ts: number;
};

// Seed used for the regular-main-branch tile capture on noitamap.com.
// Source: https://github.com/acidflow-noita/noitamap
const MAP_CAPTURE_SEED = 786433191;

const seedEl = document.getElementById('seed')!;
const biomeEl = document.getElementById('biome')!;
const positionEl = document.getElementById('position')!;
const statusEl = document.getElementById('status')!;
const warningEl = document.getElementById('seed-warning')!;
const iframe = document.getElementById('noitamap-frame') as HTMLIFrameElement;

let followPlayer = false;
let iframeReady = false;

function sendToNoitamap(data: unknown) {
  if (iframeReady && iframe.contentWindow) {
    iframe.contentWindow.postMessage(data, '*');
  }
}

iframe.addEventListener('load', () => {
  iframeReady = true;
  statusEl.textContent = 'Map loaded';
});

// In case the iframe is already loaded when this script runs.
if (iframe.contentDocument?.readyState === 'complete') {
  iframeReady = true;
}

const ws = new WebSocket('ws://localhost:8080');

ws.addEventListener('open', () => {
  statusEl.textContent = iframeReady ? 'Connected to bridge' : 'Connected to bridge, waiting for map…';
});

ws.addEventListener('message', (event) => {
  try {
    const data: Telemetry = JSON.parse(event.data);
    const currentSeed = Number(data.seed);

    seedEl.textContent = String(data.seed);
    biomeEl.textContent = data.biome;
    positionEl.textContent = `${data.x}, ${data.y}`;
    statusEl.textContent = `Last update: ${new Date(data.ts * 1000).toLocaleTimeString()}`;

    if (!Number.isNaN(currentSeed) && currentSeed !== MAP_CAPTURE_SEED) {
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
    }

    sendToNoitamap({
      type: 'noita-live-map:telemetry',
      x: data.x,
      y: data.y,
    });

    if (followPlayer) {
      sendToNoitamap({ type: 'noita-live-map:pan-to-player' });
    }
  } catch (err) {
    console.error('Failed to parse telemetry:', err);
  }
});

ws.addEventListener('close', () => {
  statusEl.textContent = 'Disconnected from bridge';
});

ws.addEventListener('error', (err) => {
  console.error('WebSocket error:', err);
  statusEl.textContent = 'Bridge connection error';
});

// Follow-player toggle
const followLabel = document.createElement('label');
followLabel.style.cssText = 'display: block; margin-top: 8px; font-size: 11px; cursor: pointer; pointer-events: auto;';
followLabel.innerHTML = '<input type="checkbox" style="margin-right: 4px;"> Follow player';
followLabel.querySelector('input')!.addEventListener('change', (ev) => {
  followPlayer = (ev.target as HTMLInputElement).checked;
  if (followPlayer) {
    sendToNoitamap({ type: 'noita-live-map:pan-to-player' });
  }
});
document.getElementById('telemetry-overlay')!.appendChild(followLabel);
