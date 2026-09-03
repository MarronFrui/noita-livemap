import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export function findNoitaDataDir() {
  if (process.env.NOITA_DATA_DIR) {
    return process.env.NOITA_DATA_DIR;
  }

  // Windows
  if (process.platform === "win32") {
    return path.join(
      os.homedir(),
      "AppData/LocalLow/Nolla_Games_Noita/data"
    );
  }

  // WSL: scan Windows user folders (same strategy as bridge/index.js)
  const wslUsersDir = "/mnt/c/Users";
  const excluded = new Set(["Public", "Default", "Default User", "All Users"]);
  try {
    const users = fs
      .readdirSync(wslUsersDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !excluded.has(e.name))
      .map((e) => e.name);
    for (const user of users) {
      const candidate = path.join(
        wslUsersDir,
        user,
        "AppData/LocalLow/Nolla_Games_Noita/data"
      );
      if (fs.existsSync(path.join(candidate, "materials.xml"))) {
        return candidate;
      }
    }
  } catch {
    // not WSL
  }

  // Linux / Proton
  return path.join(
    os.homedir(),
    ".local/share/Steam/steamapps/compatdata/881100/pfx/drive_c/users/steamuser/AppData/LocalLow/Nolla_Games_Noita/data"
  );
}

export const wasmPath = path.join(
  repoRoot,
  "vendor/noita-tools/src/services/SeedInfo/noita_random/noita_random.wasm"
);

export const captureTilesources = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "vendor/noitamap/src/data/tilesources.json"),
    "utf-8"
  )
);

// Seed of the regular-main-branch capture (the ground truth we diff against).
// Source: vendor/noitamap/src/data/map_definitions.json + tilesources.json
export const CAPTURE_SEED = 78633191;
