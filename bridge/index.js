import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';

const BRIDGE_PORT = Number(process.env.BRIDGE_PORT) || 8080;

function getCandidatePaths() {
  if (process.env.TELEMETRY_PATH) {
    return [process.env.TELEMETRY_PATH];
  }

  const home = os.homedir();

  if (process.platform === 'win32') {
    return [
      path.join(
        home,
        'AppData/LocalLow/Nolla_Games_Noita/save00/noita-live-map-telemetry.json'
      ),
    ];
  }

  const buildPath = (usersDir, user) =>
    path.join(
      usersDir,
      user,
      'AppData/LocalLow/Nolla_Games_Noita/save00/noita-live-map-telemetry.json'
    );

  // WSL: Noita runs natively on Windows, but the bridge runs in WSL.
  // The Windows C: drive is mounted at /mnt/c/.
  const wslUsersDir = '/mnt/c/Users';
  const excludedWslUsers = new Set([
    'Public',
    'Default',
    'Default User',
    'All Users',
  ]);

  let wslUsers = [];
  try {
    wslUsers = fs
      .readdirSync(wslUsersDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !excludedWslUsers.has(name));
  } catch {
    // Not running under WSL, or /mnt/c not available.
  }

  if (wslUsers.length > 0) {
    return wslUsers.map((user) => buildPath(wslUsersDir, user));
  }

  // Linux / Proton: the file lives inside the Proton prefix. We scan
  // drive_c/users/ (the real directory) because Node.js cannot always read
  // the dosdevices/c: symlink with a colon in its name.
  const protonPrefix = path.join(
    home,
    '.local/share/Steam/steamapps/compatdata/881100/pfx'
  );
  const protonUsersDir = path.join(protonPrefix, 'drive_c/users');
  const protonDosdevicesUsersDir = path.join(protonPrefix, 'dosdevices/c:/users');

  let protonUsers = [];
  try {
    protonUsers = fs
      .readdirSync(protonUsersDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    // drive_c/users not readable; fall back to common names below.
  }

  if (protonUsers.length === 0) {
    protonUsers = ['steamuser', os.userInfo().username];
  }

  const candidates = protonUsers.map((user) => buildPath(protonUsersDir, user));
  try {
    if (fs.statSync(protonDosdevicesUsersDir).isDirectory()) {
      for (const user of protonUsers) {
        candidates.push(buildPath(protonDosdevicesUsersDir, user));
      }
    }
  } catch {
    // dosdevices/c: not available.
  }

  return candidates;
}

function resolveTelemetryPath() {
  const candidates = getCandidatePaths();

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fall back to the first candidate and log a warning later.
  return candidates[0];
}

const TELEMETRY_PATH = resolveTelemetryPath();

const wss = new WebSocketServer({ port: BRIDGE_PORT, host: '0.0.0.0' });

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

if (!fs.existsSync(TELEMETRY_PATH)) {
  console.log(`Telemetry file not found yet. If the path is wrong, set TELEMETRY_PATH.`);
}
