-- Noita RNG Probe
-- Entry point: dumps the RNG truth table once, on the first world update.

local probe = dofile_once("mods/noita-livemap-rng-probe/files/probe.lua")

function OnWorldPostUpdate()
    probe.update()
end
