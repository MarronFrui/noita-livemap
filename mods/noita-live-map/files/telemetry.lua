-- Noita Live Map Telemetry
-- Reads player state and writes it to a JSON file on disk.

local telemetry = {}

local WRITE_INTERVAL = 0.1 -- seconds (~10 Hz)
local OUTPUT_FILENAME = "noita-live-map-telemetry.json"
local DEBUG_LOG_PATH = "mods/noita-live-map/noita-live-map-debug.log"

local last_write_time = -1

--- Append a line to the on-disk debug log.
local function log_debug(message)
    local line = "[" .. os.time() .. "] " .. tostring(message) .. "\n"
    local file, err = io.open(DEBUG_LOG_PATH, "a")
    if file then
        file:write(line)
        file:close()
    else
        print("[noita-live-map] Failed to write debug log: " .. tostring(err))
    end
end

--- Escape a string for safe inclusion in a JSON value.
local function escape_json_string(s)
    s = tostring(s)
    s = s:gsub("\\", "\\\\")
    s = s:gsub('"', '\\"')
    s = s:gsub("\b", "\\b")
    s = s:gsub("\f", "\\f")
    s = s:gsub("\n", "\\n")
    s = s:gsub("\r", "\\r")
    s = s:gsub("\t", "\\t")
    return s
end

--- Resolve the output path inside the current Noita save folder.
local function resolve_output_path()
    local user_profile = os.getenv("USERPROFILE")
    if user_profile then
        return user_profile
            .. "\\AppData\\LocalLow\\Nolla_Games_Noita\\save00\\"
            .. OUTPUT_FILENAME
    end

    -- Fallback: write next to the mod folder. This only works if the mod
    -- folder is writable (true for local dev installs, not Workshop).
    return "mods/noita-live-map/" .. OUTPUT_FILENAME
end

--- Write the telemetry payload as a single-line JSON object.
local function write_telemetry(payload)
    local json = string.format(
        '{"seed":%s,"x":%d,"y":%d,"biome":"%s","ts":%d}',
        tostring(payload.seed),
        payload.x,
        payload.y,
        escape_json_string(payload.biome),
        payload.ts
    )

    local path = resolve_output_path()
    local file, err = io.open(path, "w")

    if file then
        file:write(json)
        file:close()
    else
        log_debug("[noita-live-map] Failed to write telemetry to " .. path .. ": " .. tostring(err))
    end
end

--- Gather player state and write it to disk, throttled to ~10 Hz.
function telemetry.update()
    local now = GameGetRealWorldTimeSinceStarted()
    if now - last_write_time < WRITE_INTERVAL then
        return
    end
    last_write_time = now

    local players = EntityGetWithTag("player_unit")
    if not players or #players == 0 then
        return
    end

    local player = players[1]
    local x, y = EntityGetTransform(player)
    if not x or not y then
        return
    end

    local biome = BiomeMapGetName(x, y) or "unknown"
    local seed_str = StatsGetValue("world_seed") or "0"
    local seed_num = tonumber(seed_str)

    write_telemetry({
        seed = seed_num or seed_str,
        x = math.floor(x + 0.5),
        y = math.floor(y + 0.5),
        biome = biome,
        ts = os.time(),
    })
end

return telemetry
