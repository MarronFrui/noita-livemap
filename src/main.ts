import './style.css';

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
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastCenterTime = 0;
const FOLLOW_CENTER_INTERVAL = 2000; // ms

function sendToNoitamap(data: unknown) {
  if (iframeReady && iframe.contentWindow) {
    iframe.contentWindow.postMessage(data, '*');
  }
}

iframe.addEventListener('load', () => {
  iframeReady = true;
  updateStatus();
});

// In case the iframe is already loaded when this script runs.
if (iframe.contentDocument?.readyState === 'complete') {
  iframeReady = true;
}

function updateStatus() {
  if (!ws) {
    statusEl.textContent = 'Connecting to bridge…';
    return;
  }

  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      statusEl.textContent = 'Connecting to bridge…';
      break;
    case WebSocket.OPEN:
      statusEl.textContent = iframeReady ? 'Connected to bridge' : 'Connected to bridge, waiting for map…';
      break;
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
      statusEl.textContent = 'Disconnected from bridge';
      break;
  }
}

const BRIDGE_HOST = window.location.hostname || 'localhost';
const BRIDGE_URL = `ws://${BRIDGE_HOST}:8080`;

function connectWebSocket() {
  if (ws) {
    return;
  }

  console.log(`[noita-live-map] Connecting to ${BRIDGE_URL}`);
  ws = new WebSocket(BRIDGE_URL);
  updateStatus();

  window.addEventListener('beforeunload', () => {
    if (ws) {
      ws.close();
      ws = null;
    }
  }, { once: true });

  ws.addEventListener('open', () => {
    console.log('[noita-live-map] WebSocket connected');
    updateStatus();
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
        const now = Date.now();
        if (now - lastCenterTime >= FOLLOW_CENTER_INTERVAL) {
          lastCenterTime = now;
          sendToNoitamap({ type: 'noita-live-map:center-on-player' });
        }
      }
    } catch (err) {
      console.error('[noita-live-map] Failed to parse telemetry:', err);
    }
  });

  ws.addEventListener('close', () => {
    console.warn('[noita-live-map] WebSocket closed');
    ws = null;
    updateStatus();
    scheduleReconnect();
  });

  ws.addEventListener('error', (err) => {
    console.error('[noita-live-map] WebSocket error:', err);
    statusEl.textContent = 'Bridge connection error';
  });
}

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, 2000);
}

connectWebSocket();

// Map controls
const controlsContainer = document.createElement('div');
controlsContainer.style.cssText = 'margin-top: 8px; pointer-events: auto;';

const centerButton = document.createElement('button');
centerButton.textContent = 'Center on player';
centerButton.style.cssText = 'font-size: 11px; padding: 4px 8px; cursor: pointer;';
centerButton.addEventListener('click', () => {
  sendToNoitamap({ type: 'noita-live-map:center-on-player' });
});
controlsContainer.appendChild(centerButton);

const followLabel = document.createElement('label');
followLabel.style.cssText = 'display: block; margin-top: 6px; font-size: 11px; cursor: pointer;';
followLabel.innerHTML = '<input type="checkbox" style="margin-right: 4px;"> Follow player (every 2s)';
followLabel.querySelector('input')!.addEventListener('change', (ev) => {
  followPlayer = (ev.target as HTMLInputElement).checked;
  if (followPlayer) {
    lastCenterTime = Date.now();
    sendToNoitamap({ type: 'noita-live-map:center-on-player' });
  }
});
controlsContainer.appendChild(followLabel);

const telemetryOverlay = document.getElementById('telemetry-overlay')!;
telemetryOverlay.appendChild(controlsContainer);

// Collapse/expand telemetry panel
const telemetryToggle = document.getElementById('telemetry-toggle') as HTMLButtonElement;
let telemetryCollapsed = false;

telemetryToggle.addEventListener('click', () => {
  telemetryCollapsed = !telemetryCollapsed;
  telemetryOverlay.classList.toggle('collapsed', telemetryCollapsed);
  telemetryToggle.textContent = telemetryCollapsed ? '+' : '−';
  telemetryToggle.setAttribute(
    'aria-label',
    telemetryCollapsed ? 'Expand telemetry' : 'Collapse telemetry'
  );
});
