-- Noita Live Map Telemetry
-- Entry point: called by the game once the mod is loaded.

local telemetry = dofile_once("mods/noita-live-map/files/telemetry.lua")

function OnWorldPostUpdate()
    telemetry.update()
end
