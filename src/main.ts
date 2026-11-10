import { createLiveLink, describe } from './live-link.mjs';

// Seed used for the regular-main-branch tile capture on noitamap.com.
// Source: vendor/noitamap/src/data/map_definitions.json + tilesources.json
const MAP_CAPTURE_SEED = 78633191;

const seedEl = document.getElementById('seed')!;
const biomeEl = document.getElementById('biome')!;
const positionEl = document.getElementById('position')!;
const statusEl = document.getElementById('status')!;
const warningEl = document.getElementById('seed-warning')!;
const iframe = document.getElementById('noitamap-frame') as HTMLIFrameElement;
const telemetryOverlay = document.getElementById('telemetry-overlay')!;

let followPlayer = false;
let iframeReady = iframe.contentDocument?.readyState === 'complete';
let lastCenterTime = 0;
const FOLLOW_CENTER_INTERVAL = 2000; // ms

function sendToNoitamap(data: unknown) {
  if (iframeReady && iframe.contentWindow) {
    iframe.contentWindow.postMessage(data, '*');
  }
}

const BRIDGE_HOST = window.location.hostname || 'localhost';
const BRIDGE_URL = `ws://${BRIDGE_HOST}:8080`;

// The bridge connection is the explicit state machine in live-link.mjs
// (off/connecting/waiting/live/stale/retrying); this page only renders it.
const link = createLiveLink({
  url: BRIDGE_URL,
  log: (m: string) => console.log(`[noita-live-map] ${m}`),
  onChange: (model: any, prev: any) => {
    if (model.telemetry && model.telemetry !== prev.telemetry) onTelemetry(model.telemetry);
    renderStatus();
  },
});

function renderStatus() {
  const model = link.model;
  const { text, tone } = describe(model);
  let line = text;
  if (model.state === 'live' && model.telemetry?.ts != null) {
    line = `Live · updated ${new Date(model.telemetry.ts * 1000).toLocaleTimeString()}`;
  }
  if (!iframeReady) line += ' · waiting for map…';
  statusEl.textContent = line;
  statusEl.dataset.tone = tone;
  telemetryOverlay.dataset.link = model.state;
}

function onTelemetry(t: { seed: number | null; seedText: string; x: number; y: number; biome: string }) {
  seedEl.textContent = t.seedText;
  biomeEl.textContent = t.biome;
  positionEl.textContent = `${t.x}, ${t.y}`;
  warningEl.style.display = t.seed != null && t.seed !== MAP_CAPTURE_SEED ? 'block' : 'none';

  sendToNoitamap({ type: 'noita-live-map:telemetry', x: t.x, y: t.y });

  if (followPlayer) {
    const now = Date.now();
    if (now - lastCenterTime >= FOLLOW_CENTER_INTERVAL) {
      lastCenterTime = now;
      sendToNoitamap({ type: 'noita-live-map:center-on-player' });
    }
  }
}

iframe.addEventListener('load', () => {
  iframeReady = true;
  // replay the last known position: telemetry that arrived before the map loaded was dropped
  const t = link.model.telemetry;
  if (t) sendToNoitamap({ type: 'noita-live-map:telemetry', x: t.x, y: t.y });
  renderStatus();
});

window.addEventListener('beforeunload', () => link.stop(), { once: true });

link.start();

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
followLabel.innerHTML =
  '<input type="checkbox" style="margin-right: 4px;"> Follow player (every 2s)';
followLabel.querySelector('input')!.addEventListener('change', (ev) => {
  followPlayer = (ev.target as HTMLInputElement).checked;
  if (followPlayer) {
    lastCenterTime = Date.now();
    sendToNoitamap({ type: 'noita-live-map:center-on-player' });
  }
});
controlsContainer.appendChild(followLabel);

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
    telemetryCollapsed ? 'Expand telemetry' : 'Collapse telemetry',
  );
});
