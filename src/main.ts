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

const ws = new WebSocket('ws://localhost:8080');

ws.addEventListener('open', () => {
  statusEl.textContent = 'Connected to bridge';
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
