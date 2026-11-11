import { createLiveLink } from './live-link.mjs';

const iframe = document.getElementById('noitamap-frame') as HTMLIFrameElement;

let iframeReady = iframe.contentDocument?.readyState === 'complete';

function sendToNoitamap(data: unknown) {
  if (iframeReady && iframe.contentWindow) {
    iframe.contentWindow.postMessage(data, '*');
  }
}

const BRIDGE_HOST = window.location.hostname || 'localhost';
const BRIDGE_URL = `ws://${BRIDGE_HOST}:8080`;

function onTelemetry(t: { x: number; y: number }) {
  sendToNoitamap({ type: 'noita-live-map:telemetry', x: t.x, y: t.y });
}

// The bridge connection is the explicit state machine in live-link.mjs
// (off/connecting/waiting/live/stale/retrying); this page only forwards
// telemetry into the noitamap iframe.
const link = createLiveLink({
  url: BRIDGE_URL,
  log: (m: string) => console.log(`[noita-live-map] ${m}`),
  onChange: (model: any, prev: any) => {
    if (model.telemetry && model.telemetry !== prev.telemetry) onTelemetry(model.telemetry);
  },
});

iframe.addEventListener('load', () => {
  iframeReady = true;
  // replay the last known position: telemetry that arrived before the map loaded was dropped
  const t = link.model.telemetry;
  if (t) sendToNoitamap({ type: 'noita-live-map:telemetry', x: t.x, y: t.y });
});

window.addEventListener('beforeunload', () => link.stop(), { once: true });

link.start();
