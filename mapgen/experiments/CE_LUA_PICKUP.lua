-- ═══════════════════════════════════════════════════════════════════════
-- CE Lua PICKUP v3 — run AFTER walking INTO the snowy/deep band.
-- Adds multi-row dumps of BOTH grids (the 260×260 per-biome template AND
-- the 3584×2457 world-state grid) + skips the 1×1 placeholders.
-- ═══════════════════════════════════════════════════════════════════════
local function hexb(addr, n)
  local b = readBytes(addr, n, true)
  if not b then return 'NIL' end
  local s = ''
  for i, v in ipairs(b) do s = s .. string.format('%02X', v) end
  return s
end
local function f100(addr, count, stride)
  stride = stride or 4
  local out = {}
  for k = 0, count - 1 do out[#out+1] = string.format('%.4f', readFloat(addr + k * stride) or -1) end
  return table.concat(out, ' ')
end

print('══════ CE PICKUP v3 — paste the whole output back ══════')
print('moduleBase = ' .. string.format('%08X', getAddress('noita_dev.exe') or 0))

local ok, hits1 = pcall(AOBScan, 'C70E6A3D00000040')
if not ok or not hits1 then print('scan failed'); return end
print('scan hits: ' .. hits1.Count)

local seen, cands = {}, {}
for i = 0, math.min(hits1.Count - 1, 45) do
  local a = tonumber(hits1[i], 16)
  if a and not seen[a] then seen[a] = true; cands[#cands+1] = a end
end

for i = 1, math.min(#cands, 45) do
  local uid = cands[i] - 0x244
  local P = readInteger(uid + 0x1d4)
  local w = P and readInteger(P) or 0
  local h = P and readInteger(P + 4) or 0
  local px = P and readInteger(P + 0x18) or 0
  local interesting = px and px ~= 0 and w * h > 1
  -- skip the junky 1×1 placeholders in this pass:
  if interesting then
    print('── uid @ ' .. string.format('%08X', uid))
    print('    addNoise=' .. tostring(readInteger(uid + 0x220))
      .. ' noiseType=' .. tostring(readInteger(uid + 0x224))
      .. ' ScaleXf64bytes=' .. hexb(uid + 0x230, 8)
      .. ' ScaleMin/Max=' .. tostring(readFloat(uid + 0x244)) .. '/' .. tostring(readFloat(uid + 0x248))
      .. ' MultG/MultP=' .. tostring(readFloat(uid + 0x264)) .. '/' .. tostring(readFloat(uid + 0x268)))
    print('    grid ' .. w .. 'x' .. h .. ' cnt=' .. tostring(readInteger(P + 8)) .. ' px=' .. string.format('%08X', px))
    -- sample rows: for the world-grid (3584x2457) use several depths; for per-biome (260x260) a few columns
    local rowsToTry = h > 2000 and { 0, 400, 800, 1200, 1600, 2000, 2400 } or { 0, 64, 128, 200 }
    for _, r in ipairs(rowsToTry) do
      local vals = {}
      for k = 0, 11 do vals[#vals+1] = string.format('%.4f', readFloat(px + (r * w + 512 + k) * 4) or -1) end
      print('    row y=' .. tostring(r) .. ' @x=1010: ' .. table.concat(vals, ' '))
    end
  end
end
if hits1.destroy then hits1.destroy() end
print('══════════════════════ END ═══════════════════════')

-- ═══════════════ v4 probes (dig #26 follow-ups, 2026-09-21) ═══════════════
-- SELF-CONTAINED (fixed after the nil-cands error: does its own AOBScan,
-- does not depend on the v3 loop's locals). Run this part alone or
-- together with v3 — both work.
print('════════ v4 PROBES — paste everything below too ═════════')
print('moduleBase = ' .. string.format('%08X', getAddress('noita_dev.exe') or 0))

local ok4, scanned = pcall(AOBScan, 'C70E6A3D00000040')
if not ok4 or not scanned then
  print('v4 scan failed — AOBScan errored: ' .. tostring(scanned))
  return
end
if scanned.Count == 0 then
  print('v4 scan: 0 hits — the uid anchor pattern is not in memory (paused at a screen without biome config?): stand at spawn with a world loaded and rerun')
  scanned.destroy()
  return
end
local local_cands = {}
local seen2 = {}
for i = 0, math.min(scanned.Count - 1, 45) do
  local a = tonumber(scanned[i], 16)
  if a and not seen2[a] then seen2[a] = true; local_cands[#local_cands+1] = a end
end
if scanned.destroy then scanned.destroy() end
print('v4 uid candidates: ' .. #local_cands)

-- Probe V4a: the [uid+0x240..0x24f] byte block — pins the slope flag's
-- XML source ([+0x24c]) and whether Squared/Clamped/Scaled bytes are live.
print('── V4a uid config byte-block +0x240..0x24f')
for i = 1, math.min(#local_cands, 45) do
  local uid = local_cands[i] - 0x244
  print('  uid @ ' .. string.format('%08X', uid)
    .. ' bytes240..24f = ' .. hexb(uid + 0x240, 16))
end

-- Probe V4b: the C24 runtime config doubles (EngineConfig registry).
-- Slab globals 0x1327670 / 0x13289a8 are BSS (runtime) — never statically
-- readable. Absolute addresses; moduleBase assumed 0x400000 for a
-- non-ASLR exe (noita_dev.exe is not ASLR'd; if the base above differs,
-- offset = base - 0x400000 + addr).
local function abs(a) return getAddress('noita_dev.exe') - 0x400000 + a end
print('── V4b BIOME_PATH_FIND_WORLD_POS doubles')
print('    gMinX(0x1327670) d64 bytes = ' .. hexb(abs(0x1327670), 8))
print('    gMaxX(0x13289a8) d64 bytes = ' .. hexb(abs(0x13289a8), 8))

-- Probe V4c: the BitmapCaves band-stack grid factory — the 0xb8 object
-- std::map @0x132aae8: read 2 ints (map size) + first node's key/value,
-- and the grid counter/dims, to confirm the name-keyed grid instances.
print('── V4c BitmapCaves std::map @0x132aae8')
local mroot = readInteger(abs(0x132aae8))
local mcnt = readInteger(abs(0x132aaec))
print('    map root/header @ ' .. string.format('%08X', mroot or 0)
  .. ' (colored count ' .. tostring(mcnt) .. ')')

-- Probe V4d (the A-channel resolver): [P+0xb0] came back NIL in the
-- first run (the registered verdict in CONSTANTS.md C47): P = the
-- cave-GRID builder object does NOT carry the resolver. The resolver
-- hunt target = the BitmapNoise instances (C32's `this` classes);
-- keep this probe here for a later run at the right object.
print('── V4d [P+0xb0] A-resolver fn ptrs')
for i = 1, math.min(#local_cands, 12) do
  local uid = local_cands[i] - 0x244
  local P = readInteger(uid + 0x1d4)
  if P and P ~= 0 then
    local fn = readInteger(P + 0xb0)
    if fn and fn ~= 0 then
      print('  uid ' .. string.format('%08X', uid) .. ' P=' .. string.format('%08X', P)
        .. ' resolver fn = ' .. string.format('%08X', fn)
        .. ' first16 = ' .. hexb(abs(fn), 16))
    else
      print('  uid ' .. string.format('%08X', uid) .. ' resolver = NIL')
    end
  end
end

-- Probe V4e: the C44 band-stack object (+0x94 poro-draw field + band
-- stacks) — dump the LIVE band-stack roll/-0x128/-0x108/-0x100 frame
-- window values of the most recently built caves_setup object, so the
-- (33) chain bases ([-0x128] = d·3.0+1.0 etc.) can be verified at
-- runtime. Sweeps the 0x132aae8 entries' +0x94.
print('── V4e [grid+0x94] seed-field values')
local node = mroot
for k = 1, 12 do
  if not node or node == 0 then break end
  local keyPtr = readInteger(node + 0x4)
  if keyPtr and keyPtr ~= 0 then
    print('  node ' .. k .. ': key bytes = ' .. (hexb(node, 16) or 'NIL'))
  end
  node = readInteger(node + 0x8)
end

-- Probe V4f: [P+0x94] per-grid draw state (the C27 f32 = f32(d*200000-100000))
-- for the cave-grid builders reachable from the uid loop.
print('── V4f [P+0x94] cave-grid seed fields')
for i = 1, math.min(#local_cands, 45) do
  local uid = local_cands[i] - 0x244
  local P = readInteger(uid + 0x1d4)
  if P and P ~= 0 then
    print('  uid ' .. string.format('%08X', uid) .. ' [P+0x94] = '
      .. string.format('%.6f', readFloat(P + 0x94) or -7))
  end
end

-- Probe V4g: the DENSE validation dump for the caves-field port —
-- for each unique grid pointer: the y=0 band (32 values) + a y-stride
-- sweep at x=1010 (every 8 rows). Compare against the port's build
-- byte-for-byte (CONSTANTS.md C47 anchor).
print('── V4g dense grid dump (validation target)')
local seenP = {}
for i = 1, math.min(#local_cands, 45) do
  local uid = local_cands[i] - 0x244
  local P = readInteger(uid + 0x1d4)
  if P and P ~= 0 then
    local w = readInteger(P) or 0
    local h = readInteger(P + 4) or 0
    local px = readInteger(P + 0x18) or 0
    if px ~= 0 and w * h > 1 and not seenP[px] then
      seenP[px] = true
      local vals = {}
      for k = 0, 31 do vals[#vals+1] = string.format('%.6f', readFloat(px + k * 4) or -7) end
      print('  grid@' .. string.format('%08X', px) .. ' ' .. w .. 'x' .. h .. ' y=0 x0..31: ' .. table.concat(vals, ' '))
      for _, r in ipairs({16, 32, 48, 64, 96, 128, 160, 192, 224}) do
        local row = {}
        for k = 0, 11 do row[#row+1] = string.format('%.6f', readFloat(px + (r * w + k) * 4) or -7) end
        print('    y=' .. r .. ' x0..11: ' .. table.concat(row, ' '))
      end
    end
  end
end
print('══════════ END v4 ═══════════')
-- NOTE: run this TWICE — once standing in the snow entrance, once after
-- walking DEEPER in (10+ screen-widths). Non-zero "row y=..." lines = the
-- live banding-stack writes (W5); zero lines there = unfilled cells.
