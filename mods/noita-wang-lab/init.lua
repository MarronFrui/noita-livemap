-- Noita Wang Lab
-- Injects a controlled minimal wang biome (16-tile atlas) as a 5x2-chunk
-- rectangle at biome px tx 2..6, ty 36..37 (world x -16896..-14336,
-- y 11264..12288). Tile placements self-report via registered spawn-color
-- callbacks. Lab session: enable this mod + a seed mod ONLY (no rng-probe —
-- both drive the camera).
--
-- DATA CHANNEL: biome spawn callbacks run in a sandbox WITHOUT io and without
-- sight of mod globals — they push rows into the game's global store
-- (GlobalsSetValue, "wanglab_*" keys); THIS context (has io) drains them to
-- save00/noita-wang-lab-tiles-<seed>.csv.

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

-- 3) CSV writer (mod context owns io). Rows arrive via the global store.
local rows = 0
local drained = 0
local function resolve()
  local up = os.getenv("USERPROFILE")
  local dir = up and (up .. "\\AppData\\LocalLow\\Nolla_Games_Noita\\save00\\") or "mods/noita-wang-lab/"
  local seed = tostring(StatsGetValue("world_seed") or "0")
  return dir .. "noita-wang-lab-tiles-" .. seed .. ".csv"
end

local function drain()
  local count = tonumber(GlobalsGetValue("wanglab_count", "0") or "0")
  if count <= drained then return end
  local fh = io.open(resolve(), "a")
  if not fh then return end
  if rows == 0 then fh:write("seed,tile,is_h,a,b,c,d,e,f,x,y\n") end
  while drained < count do
    drained = drained + 1
    local row = GlobalsGetValue("wanglab_r_" .. drained, "")
    if row ~= "" then
      fh:write(row .. "\n")
      rows = rows + 1
    end
  end
  fh:close()
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
  drain()
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
    drain()
    GamePrint("[wang-lab] done - " .. rows .. " rows dumped")
  elseif frame % 300 == 0 and frame > 600 then
    drain()
    GamePrint("[wang-lab] rows so far: " .. rows)
  end
end
