-- Noita RNG Probe (v3)
-- Dumps ground-truth data to the save folder:
--   noita-rng-probe2-<seed>.csv          RNG truth table (v2)        [skipped if exists]
--   noita-rng-probe3-entities-<seed>.csv item entities (spawn facts) [this run's payload]
--   noita-rng-probe4-sequences-<seed>.csv chunk-origin RNG sequences  [skipped if exists]
--   noita-rng-probe2-meta.json / noita-rng-probe3-meta.json
--   probe-debug.log
--
-- v3 (spawn-equation observables): after a warmup phase the camera sweeps the
-- spawn band (biome rows 12..17, cols 30..45 = Mines → Coal Pits), letting
-- chunks generate in sweep order. Protocol (2026-09-04): run the sweep FIRST,
-- then the noita-mapcap area capture afterwards, with mapcap's disable-physics
-- ON for the whole session (dev build) — frozen physics means items are
-- recorded at their exact spawn position (no fall drift) and produce no
-- physics debris. Items are the paint-immune observables: each implies "the
-- wang cell here had the spawn color for this item class".
-- Waypoint order = row-major (ty asc, tx asc) — part of the observation protocol.
--
-- All phases are idempotent: outputs that already exist for this seed are
-- skipped, so a re-run only does what is missing.

local probe = {}

local DEBUG_LOG_PATH = "mods/noita-livemap-rng-probe/probe-debug.log"

local done = false
local phase = "boot"

-- v2 truth-table bounds (unchanged)
local STEP = 10
local X_MIN, X_MAX = -6144, 6144
local Y_MIN, Y_MAX = -1024, 6144

-- v3 sweep parameters
local WARMUP_FRAMES = 600 -- 10 s: let the spawn area settle first
local DWELL_FRAMES = 45   -- per waypoint (~0.75 s)
local COLLECT_FROM = 20   -- start collecting this many frames after arrival
local RADIUS = 360        -- entity query radius around the waypoint (< 256+512 so overlap is small)
local TX_MIN, TX_MAX = 30, 45 -- biome cols (world chunks cx = tx-35 → -5..10)
local TY_MIN, TY_MAX = 12, 17 -- biome rows (world chunks cy = ty-14 → -2..3)

local wps, wpi, dwell = {}, 0, 0
local seen, rows = {}, {}
local ent_n = 0
local skip_counts = { nofile = 0, filtered = 0 }

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

local function file_exists(path)
    local f = io.open(path, "r")
    if f then f:close() return true end
    return false
end

local function build_waypoints()
    local w = {}
    for ty = TY_MIN, TY_MAX do
        for tx = TX_MIN, TX_MAX do
            w[#w + 1] = { x = (tx - 35) * 512 + 256, y = (ty - 14) * 512 + 256 }
        end
    end
    return w
end

local function collect_at(wp)
    local entities = EntityGetInRadius(wp.x, wp.y, RADIUS) or {}
    for _, eid in ipairs(entities) do
        if not seen[eid] then
            seen[eid] = true
            local ok, fname = pcall(EntityGetFilename, eid)
            if ok and fname then
                if fname:find("data/entities/items/", 1, true) then
                    local lx, ly = EntityGetTransform(eid)
                    if lx then
                        ent_n = ent_n + 1
                        rows[ent_n] = string.format("%.0f,%.0f,%s", lx, ly, fname)
                    end
                else
                    skip_counts.filtered = skip_counts.filtered + 1
                end
            else
                skip_counts.nofile = skip_counts.nofile + 1
            end
        end
    end
end

function probe.update()
    if done then return end
    local frame = GameGetFrameNum()

    if phase == "boot" then
        local seed_str = StatsGetValue("world_seed") or "0"

        -- v2: RNG truth table (skip if already dumped for this seed)
        local csv_path = resolve_output_path("noita-rng-probe2-" .. seed_str .. ".csv")
        if file_exists(csv_path) then
            log_debug("v2 skipped (exists, seed " .. seed_str .. ")")
        else
            local started = os.time()
            local rows2, n = {}, 0
            for y = Y_MIN, Y_MAX, STEP do
                for x = X_MIN, X_MAX, STEP do
                    SetRandomSeed(x, y)
                    local s01a = Random(0, 1)
                    local s01b = Random(0, 1)
                    local s02a = Random(0, 2)
                    local s02b = Random(0, 2)
                    n = n + 1
                    rows2[n] = string.format(
                        "%d,%d,%d,%d,%d,%d,%d,%d",
                        x, y,
                        ProceduralRandomi(x, y, 0, 1),
                        ProceduralRandomi(x, y, 0, 2),
                        s01a, s01b, s02a, s02b
                    )
                end
            end
            local f = io.open(csv_path, "w")
            if f then
                f:write("x,y,pr01,pr02,s01a,s01b,s02a,s02b\n")
                f:write(table.concat(rows2, "\n"))
                f:write("\n")
                f:close()
                local meta_file = io.open(resolve_output_path("noita-rng-probe2-meta.json"), "w")
                if meta_file then
                    meta_file:write(string.format(
                        '{"seed":"%s","step":%d,"x_min":%d,"x_max":%d,"y_min":%d,"y_max":%d,"rows":%d,"ts":%d}',
                        seed_str, STEP, X_MIN, X_MAX, Y_MIN, Y_MAX, n, os.time()
                    ))
                    meta_file:close()
                end
                log_debug(string.format("v2 dumped %d rows (seed %s) in %ds", n, seed_str, os.time() - started))
            else
                log_debug("v2 dump failed")
            end
        end

        -- v4: chunk-origin sequences (skip if already dumped for this seed)
        local seq_path = resolve_output_path("noita-rng-probe4-sequences-" .. seed_str .. ".csv")
        if file_exists(seq_path) then
            log_debug("v4 skipped (exists, seed " .. seed_str .. ")")
        else
            local seq_rows, seq_n = {}, 0
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
            local sf = io.open(seq_path, "w")
            if sf then
                sf:write("ox,oy,anchor1..8,randf1..4088\n")
                sf:write(table.concat(seq_rows, "\n"))
                sf:write("\n")
                sf:close()
                log_debug(string.format("v4 dumped %d chunk sequences (seed %s)", seq_n, seed_str))
            else
                log_debug("v4 dump failed")
            end
        end

        -- v3 gate: skip the sweep if this seed already has a non-trivial dump
        local ent_path = resolve_output_path("noita-rng-probe3-entities-" .. seed_str .. ".csv")
        local prior_rows = 0
        local pf = file_exists(ent_path) and io.open(ent_path, "r")
        if pf then
            local content = pf:read("*a") or ""
            pf:close()
            for _ in content:gmatch("[^\n]+") do prior_rows = prior_rows + 1 end
            prior_rows = prior_rows - 1 -- minus header
        end
        if prior_rows > 0 then
            log_debug("v3 skipped (exists with " .. prior_rows .. " rows, seed " .. seed_str .. ")")
            GamePrint("[probe] dump already exists for seed " .. seed_str .. " - nothing to do (delete the CSV to re-run)")
            done = true
            return
        end

        phase = "warmup"
        return
    end

    if phase == "warmup" then
        if frame >= WARMUP_FRAMES then
            wps = build_waypoints()
            wpi, dwell = 1, 0
            seen, rows, ent_n = {}, {}, 0
            skip_counts = { nofile = 0, filtered = 0 }
            GameSetCameraFree(true)
            GamePrint("[probe] sweep starting - camera will move on its own")
            log_debug(string.format("v3 sweep started: %d waypoints, dwell %d, radius %d", #wps, DWELL_FRAMES, RADIUS))
            phase = "sweep"
        end
        return
    end

    if phase == "sweep" then
        local wp = wps[wpi]
        if not wp then
            phase = "write"
            return
        end
        dwell = dwell + 1
        if dwell == 1 then
            GameSetCameraPos(wp.x, wp.y)
        elseif dwell % 10 == 0 then
            -- mapcap-style wiggle: nudges chunk generation along
            GameSetCameraPos(wp.x + math.random(-8, 8), wp.y + math.random(-8, 8))
        end
        if dwell >= COLLECT_FROM then
            collect_at(wp)
        end
        if dwell >= DWELL_FRAMES then
            if wpi % 16 == 0 then
                log_debug(string.format("v3 sweep: %d/%d stops, %d items so far", wpi, #wps, ent_n))
            end
            wpi = wpi + 1
            dwell = 0
            if wpi > #wps then
                phase = "write"
            end
        end
        return
    end

    if phase == "write" then
        GameSetCameraFree(false)
        local seed_str = StatsGetValue("world_seed") or "0"
        local ent_path = resolve_output_path("noita-rng-probe3-entities-" .. seed_str .. ".csv")
        local f = io.open(ent_path, "w")
        if f then
            f:write("x,y,file\n")
            if ent_n > 0 then
                f:write(table.concat(rows, "\n"))
                f:write("\n")
            end
            f:close()
            local meta_file = io.open(resolve_output_path("noita-rng-probe3-meta.json"), "w")
            if meta_file then
                meta_file:write(string.format(
                    '{"seed":"%s","waypoints":%d,"tx_min":%d,"tx_max":%d,"ty_min":%d,"ty_max":%d,"dwell_frames":%d,"collect_from":%d,"radius":%d,"entities":%d,"filtered":%d,"nofile":%d,"ts":%d}',
                    seed_str, #wps, TX_MIN, TX_MAX, TY_MIN, TY_MAX, DWELL_FRAMES, COLLECT_FROM, RADIUS, ent_n, skip_counts.filtered, skip_counts.nofile, os.time()
                ))
                meta_file:close()
            end
            log_debug(string.format("v3 dumped %d entities, %d filtered, %d nofile (seed %s)", ent_n, skip_counts.filtered, skip_counts.nofile, seed_str))
            print("[noita-rng-probe] v3 dumped " .. ent_n .. " items for seed " .. seed_str)
            GamePrint("[probe] done: " .. ent_n .. " items dumped - camera released")
        else
            log_debug("v3 dump failed")
            GamePrint("[probe] dump FAILED - see probe-debug.log")
        end
        done = true
        return
    end
end

return probe
