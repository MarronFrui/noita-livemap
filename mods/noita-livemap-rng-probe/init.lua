-- Noita RNG Probe
-- Entry point: dumps RNG truth tables + spawn observables on first world update.
-- (Seed forcing removed — use a dedicated seed mod instead.)

local probe = dofile_once("mods/noita-livemap-rng-probe/files/probe.lua")

function OnWorldPostUpdate()
    probe.update()
end
