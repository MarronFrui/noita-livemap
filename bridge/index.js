import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';

const BRIDGE_PORT = Number(process.env.BRIDGE_PORT) || 8080;

function getTelemetryPath() {
  if (process.env.TELEMETRY_PATH) {
    return process.env.TELEMETRY_PATH;
  }

  const home = os.homedir();

  if (process.platform === 'win32') {
    return path.join(
      home,
      'AppData/LocalLow/Nolla_Games_Noita/save00/mod_data/noita-live-map/noita-live-map-telemetry.json'
    );
  }

  // Linux/Proton fallback
  return path.join(
    home,
    '.local/share/Steam/steamapps/compatdata/881100/pfx/dosdevices/c:/users/steamuser/AppData/LocalLow/Nolla_Games_Noita/save00/mod_data/noita-live-map/noita-live-map-telemetry.json'
  );
}

const TELEMETRY_PATH = getTelemetryPath();

const wss = new WebSocketServer({ port: BRIDGE_PORT });

function broadcast(data) {
  const payload = JSON.stringify(data);
  let sent = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
      sent += 1;
    }
  });

  return sent;
}

function readAndBroadcast() {
  if (!fs.existsSync(TELEMETRY_PATH)) {
    return;
  }

  try {
    const content = fs.readFileSync(TELEMETRY_PATH, 'utf-8');
    const data = JSON.parse(content);
    const sent = broadcast(data);

    if (sent > 0) {
      console.log(`[${new Date().toISOString()}] broadcast → ${sent} client(s)`, data);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] failed to read telemetry:`, err.message);
  }
}

chokidar
  .watch(TELEMETRY_PATH, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 50,
    },
  })
  .on('add', readAndBroadcast)
  .on('change', readAndBroadcast)
  .on('error', (err) => {
    console.error('Watcher error:', err);
  });

wss.on('connection', (ws) => {
  console.log('Client connected');
  readAndBroadcast();

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log(`Bridge watching: ${TELEMETRY_PATH}`);
console.log(`WebSocket server: ws://localhost:${BRIDGE_PORT}`);
