-- Noita Wang Lab
-- Injects a controlled minimal wang biome (16-tile atlas) as a 5x2-chunk
-- rectangle at biome px tx 2..6, ty 36..37 (world x -16896..-14336,
-- y 11264..12288). Tile placements self-report via registered spawn-color
-- callbacks. Lab session: enable this mod + a seed mod ONLY (no rng-probe —
-- both drive the camera).
--
-- NOTE: biome spawn callbacks run in a sandbox WITHOUT io — file writes live
-- HERE (mod context owns lab_log / lab_chunk; lab.lua is a thin shim whose
-- callbacks call these globals).

-- 1) register the lab biome in _biomes_all.xml (runtime patch, idempotent)
local xml = ModTextFileGetContent("data/biome/_biomes_all.xml")
if not xml:find("wanglab%.xml") then
  local entry = '\n\t<Biome biome_filename="mods/noita-wang-lab/files/biome/wanglab.xml" color="ff0a0b0c"></Biome>\n'
  xml = xml:gsub("</BiomesToLoad>", entry .. "</BiomesToLoad>")
  ModTextFileSetContent("data/biome/_biomes_all.xml", xml)
  print("[wang-lab] biome entry injected")
end

-- 2) point the game at our biome-map loader (stock map + lab rectangle)
ModMagicNumbersFileAdd("mods/noita-wang-lab/files/magic_numbers.xml")

-- 3) file writers (mod context = io available). One CSV per seed; per-call
-- append; header written on first open of each session.
local rows = 0
local function resolve()
  local up = os.getenv("USERPROFILE")
  local dir = up and (up .. "\\AppData\\LocalLow\\Nolla_Games_Noita\\save00\\") or "mods/noita-wang-lab/"
  local seed = tostring(StatsGetValue("world_seed") or "0")
  return dir .. "noita-wang-lab-tiles-" .. seed .. ".csv"
end

function lab_log(idx, is_h, a, b, c, d, e, f, x, y)
  local fh = io.open(resolve(), "a")
  if fh then
    if rows == 0 then fh:write("tile,is_h,a,b,c,d,e,f,x,y\n") end
    fh:write(string.format("%d,%d,%d,%d,%d,%d,%d,%d,%d,%d\n", idx, is_h, a, b, c, d, e, f, x, y))
    fh:close()
    rows = rows + 1
  end
end

function lab_chunk(x, y)
  local fh = io.open(resolve(), "a")
  if fh then
    fh:write(string.format("#chunk,%d,%d\n", x, y))
    fh:close()
  end
end

-- 4) auto-visit: teleport the camera across the lab rect so all its chunks
-- generate (spawn callbacks fire on placement)
local frame = 0
local visited = false
local function visit(x, y)
  GameSetCameraFree(true)
  GameSetCameraPos(x, y)
end

function OnWorldPostUpdate()
  if visited then return end
  frame = frame + 1
  if frame == 600 then
    visit(-16640, 11520) -- lab left
    GamePrint("[wang-lab] visiting lab area...")
  elseif frame == 900 then
    visit(-16128, 11776)
  elseif frame == 1200 then
    visit(-15616, 11776) -- lab center
  elseif frame == 1500 then
    visit(-15104, 12032)
  elseif frame == 1800 then
    visit(-14592, 11776) -- lab right
  elseif frame > 2100 then
    GameSetCameraFree(false)
    visited = true
    GamePrint("[wang-lab] done - " .. rows .. " rows dumped")
  elseif frame % 300 == 0 and frame > 600 then
    GamePrint("[wang-lab] rows so far: " .. rows)
  end
end
