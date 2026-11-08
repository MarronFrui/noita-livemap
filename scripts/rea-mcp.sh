#!/usr/bin/env bash
# Launch the REA MCP server for this repo (wired in .mcp.json for Claude Code
# and opencode.json for opencode). stdout is the MCP stdio channel — every
# diagnostic below goes to stderr.
#
# Overridable env (defaults = this machine's layout, see AGENTS.md):
#   REA_GHIDRA_DIR (~/tools/ghidra)   REA_JAVA_HOME (~/tools/jdk)
#   GHIDRA_HEADLESS_MAXMEM (6G)       REA_GHIDRA_STARTUP_TIMEOUT_MS (8 h)
#   REA_VERSION (6.4.0)               REA_SEEDS=0 disables the Ghidra seed file
#   NOITA_EXE / NOITA_INSTALL_DIR     the source of the pinned target
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export GHIDRA_INSTALL_DIR="${REA_GHIDRA_DIR:-$HOME/tools/ghidra}"
export JAVA_HOME="${REA_JAVA_HOME:-$HOME/tools/jdk}"
export GHIDRA_HEADLESS_MAXMEM="${GHIDRA_HEADLESS_MAXMEM:-6G}"
export REA_GHIDRA_STARTUP_TIMEOUT_MS="${REA_GHIDRA_STARTUP_TIMEOUT_MS:-28800000}"
export REA_ANALYSIS_PROVIDER="${REA_ANALYSIS_PROVIDER:-ghidra}"
if [ "${REA_SEEDS:-1}" != "0" ]; then
  export REA_GHIDRA_SEED_FILE="$ROOT/mapgen/re/noita_dev.seeds.tsv"
fi

# Pin the target (copy + sha256 check). A failure is reported but does not
# block the server: REA stays usable for other targets.
node "$ROOT/scripts/rea-target.mjs" 1>&2 || echo "[rea-mcp] WARNING: target pin failed (see above)" >&2

exec npx -y "rea-agents@${REA_VERSION:-6.4.0}" mcp
