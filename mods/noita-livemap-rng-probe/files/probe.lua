-- Noita RNG Probe (v2)
-- Dumps a fill-sweep truth table to the save folder:
--   noita-rng-probe2-<seed>.csv
--     one row per position: x, y, ProceduralRandomi(x,y,0,1), ProceduralRandomi(x,y,0,2),
--     then SetRandomSeed(x,y) + Random(0,1)x2 + Random(0,2)x2
--   noita-rng-probe2-meta.json
--
-- Region: x in [-6144, 6144], y in [-1024, 6144] (spawn + Coal Pits band),
-- step 10 world px -> ~880k rows. Covers all candidate vertex lattice
-- positions (biome short sides 13/20/22... x10) with margin for anchor sweeps.
--
-- Runs once, on the first world update.

local probe = {}

local DEBUG_LOG_PATH = "mods/noita-livemap-rng-probe/probe-debug.log"
local done = false

local STEP = 10
local X_MIN, X_MAX = -6144, 6144
local Y_MIN, Y_MAX = -1024, 6144

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

    local rows = {}
    local n = 0
    for y = Y_MIN, Y_MAX, STEP do
        for x = X_MIN, X_MAX, STEP do
            SetRandomSeed(x, y)
            local s01a = Random(0, 1)
            local s01b = Random(0, 1)
            local s02a = Random(0, 2)
            local s02b = Random(0, 2)
            n = n + 1
            rows[n] = string.format(
                "%d,%d,%d,%d,%d,%d,%d,%d",
                x, y,
                ProceduralRandomi(x, y, 0, 1),
                ProceduralRandomi(x, y, 0, 2),
                s01a, s01b, s02a, s02b
            )
        end
    end

    local csv_path = resolve_output_path("noita-rng-probe2-" .. seed_str .. ".csv")
    local file, err = io.open(csv_path, "w")
    if file then
        file:write("x,y,pr01,pr02,s01a,s01b,s02a,s02b\n")
        file:write(table.concat(rows, "\n"))
        file:write("\n")
        file:close()
    else
        log_debug("v2 dump failed: " .. tostring(err))
        return
    end

    local meta_file = io.open(resolve_output_path("noita-rng-probe2-meta.json"), "w")
    if meta_file then
        meta_file:write(string.format(
            '{"seed":"%s","step":%d,"x_min":%d,"x_max":%d,"y_min":%d,"y_max":%d,"rows":%d,"ts":%d}',
            seed_str, STEP, X_MIN, X_MAX, Y_MIN, Y_MAX, n, os.time()
        ))
        meta_file:close()
    end

    log_debug(string.format("v2 dumped %d rows (seed %s) in %ds", n, seed_str, os.time() - started))

    -- v3: entity dump (spawn-function observables) — items/orbs/perks/chests
    -- present at world start. Each gives an exact "cell had color C" equation.
    local ent_rows = {}
    local ent_n = 0
    local entities = EntityGetInRadius(0, 512, 12288) or {}
    for _, eid in ipairs(entities) do
        local ok_name, fname = pcall(EntityGetFileName, eid)
        if ok_name and fname then
            local lx, ly = EntityGetTransform(eid)
            if lx and fname:find("orb", 1, true) or fname:find("perk", 1, true)
                or fname:find("chest", 1, true) or fname:find("wand", 1, true)
                or fname:find("heart", 1, true) or fname:find("potion", 1, true) then
                ent_n = ent_n + 1
                ent_rows[ent_n] = string.format("%.0f,%.0f,%s", lx, ly, fname)
            end
        end
    end
    local ent_path = resolve_output_path("noita-rng-probe3-entities-" .. seed_str .. ".csv")
    local ent_file = io.open(ent_path, "w")
    if ent_file then
        ent_file:write("x,y,file\n")
        ent_file:write(table.concat(ent_rows, "\n"))
        ent_file:write("\n")
        ent_file:close()
        log_debug(string.format("v3 dumped %d entities (seed %s)", ent_n, seed_str))
    end

    -- v4: long sequences per chunk origin (per-chunk-sequential-fill hypothesis).
    -- For each chunk origin in the spawn band: SetRandomSeed(origin) then
    -- 8x Random(0,255) (verifiable anchor) + 4088x Randomf() (full precision).
    local seq_rows = {}
    local seq_n = 0
    for cy = 12, 20 do
        for cx = 25, 48 do
            local ox = (cx - 35) * 512
            local oy = (cy - 14) * 512
            SetRandomSeed(ox, oy)
            local parts = {}
            for i = 1, 8 do
                parts[i] = Random(0, 255)
            end
            local floats = {}
            for i = 1, 4088 do
                floats[i] = string.format("%.17g", Randomf())
            end
            seq_n = seq_n + 1
            seq_rows[seq_n] = string.format(
                "%d,%d,%s,%s",
                ox, oy,
                table.concat(parts, ","),
                table.concat(floats, ",")
            )
        end
    end
    local seq_path = resolve_output_path("noita-rng-probe4-sequences-" .. seed_str .. ".csv")
    local seq_file = io.open(seq_path, "w")
    if seq_file then
        seq_file:write("ox,oy,anchor1..8,randf1..4088\n")
        seq_file:write(table.concat(seq_rows, "\n"))
        seq_file:write("\n")
        seq_file:close()
        log_debug(string.format("v4 dumped %d chunk sequences (seed %s)", seq_n, seed_str))
    else
        log_debug("v4 dump failed: " .. tostring(err))
    end

    print("[noita-rng-probe] v2 dumped " .. n .. " rows for seed " .. seed_str)
end

return probe
