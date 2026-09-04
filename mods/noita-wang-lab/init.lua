-- Noita Wang Lab
-- Injects a controlled minimal wang biome (16-tile atlas) as a 5x2-chunk
-- rectangle at biome px tx 2..6, ty 36..37 (world x -16896..-14336,
-- y 11264..12288) — far from the analysis window. Tile placements self-report
-- via registered spawn-color callbacks. Lab session: enable this mod + a seed
-- mod ONLY (no rng-probe — both drive the camera). After the auto-visit the
-- CSV is complete; quit to menu.

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

-- 3) auto-visit: teleport the camera across the lab rect so all its chunks
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
    GamePrint("[wang-lab] done - tiles dumped to noita-wang-lab-tiles CSV")
  end
end
