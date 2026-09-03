-- Noita RNG Probe
-- Writes a truth table of the game's RNG functions to the save folder:
--   noita-rng-probe-<seed>.csv   one row per position: x, y, ProceduralRandomi(x,y,0,255),
--                                then 8 successive draws of SetRandomSeed(x,y)+Random(0,255)
--   noita-rng-probe-meta.json    world seed, grid params, timestamp
--
-- Runs once, on the first world update. Re-dumps on every new game start.

local probe = {}

local DEBUG_LOG_PATH = "mods/noita-livemap-rng-probe/probe-debug.log"
local done = false

local STEP = 10      -- world px between grid positions
local HALF = 1280    -- grid spans [-HALF, HALF] (±5 chunks around origin)
local DRAWS = 8      -- successive Random() draws per position

--- Append a line to the on-disk debug log.
local function log_debug(message)
    local line = "[" .. os.time() .. "] " .. tostring(message) .. "\n"
    local file, err = io.open(DEBUG_LOG_PATH, "a")
    if file then
        file:write(line)
        file:close()
    else
        print("[noita-rng-probe] Failed to write debug log: " .. tostring(err))
    end
end

--- Resolve output path inside the current Noita save folder (same as telemetry mod).
local function resolve_output_path(filename)
    local user_profile = os.getenv("USERPROFILE")
    if user_profile then
        return user_profile
            .. "\\AppData\\LocalLow\\Nolla_Games_Noita\\save00\\"
            .. filename
    end
    return "mods/noita-livemap-rng-probe/" .. filename
end

function probe.update()
    if done then
        return
    end
    done = true

    local seed_str = StatsGetValue("world_seed") or "0"
    local started = os.time()

    -- sanity probes with different ranges (semantics check)
    local range_probe = {}
    for i = 0, 7 do
        range_probe[i + 1] = ProceduralRandomi(i * 1000, i * 700, 0, i)
    end
    local f_probe = ProceduralRandomf(123, 456)

    local rows = {}
    local n = 0
    for y = -HALF, HALF, STEP do
        for x = -HALF, HALF, STEP do
            SetRandomSeed(x, y)
            local v = {}
            for i = 1, DRAWS do
                v[i] = Random(0, 255)
            end
            n = n + 1
            rows[n] = string.format(
                "%d,%d,%d,%s",
                x, y,
                ProceduralRandomi(x, y, 0, 255),
                table.concat(v, ",")
            )
        end
    end

    local csv_path = resolve_output_path("noita-rng-probe-" .. seed_str .. ".csv")
    local file, err = io.open(csv_path, "w")
    if file then
        file:write("x,y,proc_rand_i_0_255,seq1,seq2,seq3,seq4,seq5,seq6,seq7,seq8\n")
        file:write(table.concat(rows, "\n"))
        file:write("\n")
        file:close()
    else
        log_debug("Failed to write CSV to " .. csv_path .. ": " .. tostring(err))
        return
    end

    local meta_path = resolve_output_path("noita-rng-probe-meta.json")
    local meta_file = io.open(meta_path, "w")
    if meta_file then
        meta_file:write(string.format(
            '{"seed":"%s","step":%d,"half":%d,"draws":%d,"rows":%d,"ts":%d,"range_probe":[%s],"procedural_randomf_123_456":%s}',
            seed_str, STEP, HALF, DRAWS, n,
            os.time(),
            table.concat(range_probe, ","),
            tostring(f_probe)
        ))
        meta_file:close()
    end

    log_debug(string.format("dumped %d rows (seed %s) in %ds", n, seed_str, os.time() - started))
    print("[noita-rng-probe] dumped " .. n .. " rows for seed " .. seed_str)
end

return probe
