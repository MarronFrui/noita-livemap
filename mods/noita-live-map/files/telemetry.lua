-- Noita Live Map Telemetry
-- Reads player state and writes it to Noita's sandboxed mod-data file.

local telemetry = {}

local WRITE_INTERVAL = 0.1 -- seconds (~10 Hz)
local OUTPUT_FILENAME = "noita-live-map-telemetry.json"

local last_write_time = -1

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

--- Write the telemetry payload as a single-line JSON object.
-- Uses ModDataFileSetText so the file lives in the sandboxed mod-data folder
-- (save00/mod_data/<mod_id>/...) and no unrestricted API access is required.
local function write_telemetry(payload)
    local json = string.format(
        '{"seed":%s,"x":%d,"y":%d,"biome":"%s","ts":%d}',
        tostring(payload.seed),
        payload.x,
        payload.y,
        escape_json_string(payload.biome),
        payload.ts
    )

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
