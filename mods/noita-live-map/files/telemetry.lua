-- Noita Live Map Telemetry
-- Reads player state and writes it to a JSON file on disk.

local telemetry = {}

local WRITE_INTERVAL = 0.1 -- seconds (~10 Hz)
local OUTPUT_FILENAME = "noita-live-map-telemetry.json"

local last_write_time = -1
local output_path = nil

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

--- Try to determine the best output path.
-- Prefer the Windows LocalLow save folder when available, otherwise fall back
-- to Noita's mod-data directory (ModDataFileSetText).
local function resolve_output_path()
    if output_path then
        return output_path
    end

    local user_profile = os.getenv("USERPROFILE")
    if user_profile then
        output_path = user_profile
            .. "\\AppData\\LocalLow\\Nolla_Games_Noita\\save00\\"
            .. OUTPUT_FILENAME
    else
        output_path = OUTPUT_FILENAME
    end

    return output_path
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
    local file = io.open(path, "w")

    if file then
        file:write(json)
        file:close()
        return
    end

    -- Fallback to Noita's sandboxed mod data directory if direct I/O fails.
    ModDataFileSetText(OUTPUT_FILENAME, json)
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
