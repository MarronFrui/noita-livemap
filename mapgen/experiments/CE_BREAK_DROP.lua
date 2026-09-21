-- CE BREAKPOINT-FREE PINPOINT PICKUP v5.2 -- for the fnB/fnC1 layer probe.
-- WHERE TO RUN: STAND AT SPAWN on seed 78633191 (same run as your first
-- two pickups - do NOT re-enter a world; the caves grids are baked AT
-- WORLD LOAD and only get stale when a run ends). The script reads
-- purely from already-baked config/grid memory - NO map movement needed.
-- Paste the whole output back (there are no interactive prompts).

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
  for k = 0, count - 1 do out[#out+1] = string.format('%.6f', readFloat(addr + k * stride) or -7) end
  return table.concat(out, ' ')
end
local function i32s(addr, n)
  local out = {}
  for k = 0, n - 1 do out[#out+1] = tostring(readInteger(addr + k * 4) or 0) end
  return table.concat(out, ' ')
end

print('==== PINPOINT PICKUP v5.2 (spawn, same seed) ====')
print('moduleBase = ' .. string.format('%08X', getAddress('noita_dev.exe') or 0))
local baseAddr = getAddress('noita_dev.exe') - 0x400000
print('worldseed = ' .. tostring(readInteger(baseAddr + 0x1327ffc) or -1))

local ok, hits = pcall(AOBScan, 'C70E6A3D00000040')
if not ok or not hits then print('scan failed: ' .. tostring(hits)); return end
if hits.Count == 0 then print('scan: 0 hits - need a loaded world'); hits.destroy(); return end
local seen, uids = {}, {}
for i = 0, math.min(hits.Count - 1, 45) do
  local a = tonumber(hits[i], 16)
  if a and not seen[a] then seen[a] = true; uids[#uids+1] = a - 0x244 end
end
hits.destroy()
print('uid candidates: ' .. #uids)

-- == V6a: the FULL knob-struct dump per uid (structP = [uid+0x1d4])
print('-- V6a uid P-slot dump')
for i = 1, math.min(#uids, 45) do
  local uid = uids[i]
  local okUid, errUid = pcall(function()
    local P = readInteger(uid + 0x1d4)
    if not P or P == 0 then
      print('  uid ' .. string.format('%08X', uid) .. ' P=NIL')
      return
    end
    local w = readInteger(P) or 0
    local h = readInteger(P + 4) or 0
    print('  uid ' .. string.format('%08X', uid) .. ' P=' .. string.format('%08X', P)
      .. ' ' .. w .. 'x' .. h
      .. ' [P+0x94]=' .. string.format('%.4f', readFloat(P + 0x94) or -7))
    -- the f32 window the bodies actually read:
    print('    f32 +0x1c..+0x4c: ' .. f100(P + 0x1c, 13)
      .. ' | +0x50..0x60: ' .. f100(P + 0x50, 5))
    -- the int slots (cave-count pairs / vector heads):
    print('    i32 +0x1c..+0x3c: ' .. i32s(P + 0x1c, 9))
    -- the record-vector head candidate:
    print('    +0x80 vec: head=' .. hexb(P + 0x80, 16))
    -- the blob-stamp knob candidates ([P+0x24] f32 + others per dig #28):
    print('    f32 +0x24=' .. string.format('%.6f', readFloat(P + 0x24) or -7)
      .. ' +0x60=' .. string.format('%.6f', readFloat(P + 0x60) or -7)
      .. ' +0x64..0x70: ' .. f100(P + 0x64, 4)
      .. ' +0x74=' .. string.format('%.6f', readFloat(P + 0x74) or -7)
      .. ' +0x78=' .. string.format('%.6f', readFloat(P + 0x78) or -7))
    -- the byte grid deref: close [+0x58] = the mMaterialData art-byte lane
    local bg = readInteger(P + 0x58)
    if bg and bg ~= 0 then
      print('    byte-grid [+0x58] @' .. string.format('%08X', bg) .. ' first64: '
        .. hexb(bg, 64))
    end
    -- the C32 record list candidate - guarded: both must look like heap
    -- addresses and the size must be sane.
    local rec0, rec1 = readInteger(P + 0x7c), readInteger(P + 0x80)
    if rec0 and rec1 and rec0 > 0x1000000 and rec1 > rec0
       and (rec1 - rec0) < 0x100000 and (rec1 - rec0) % 16 == 0 then
      local n = math.min(math.floor((rec1 - rec0) / 16), 12)
      local out = {}
      for k = 0, n - 1 do
        local bx = readInteger(rec0 + k * 16)
        local by = readInteger(rec0 + k * 16 + 4)
        if bx and by then
          out[#out+1] = bx .. ',' .. by .. ':' .. tostring(hexb(rec0 + k * 16 + 8, 8))
        else
          out[#out+1] = '<unreadable rec ' .. k .. '>'
          break
        end
      end
      print('    [P+0x7c/0x80] records n<=' .. n .. ': ' .. table.concat(out, ' | '))
    else
      print('    [P+0x7c/0x80] NOT a pointer pair: ' .. hexb(P + 0x7c, 8) .. ' / ' .. hexb(P + 0x80, 8))
    end
    -- the A-resolver fn ptr on the REAL owner ([P+0xb0]):
    local fn = readInteger(P + 0xb0)
    if fn and fn ~= 0 then
      print('    resolver [+0xb0] = ' .. string.format('%08X', fn) .. ' first32 = ' .. hexb(fn, 32))
    else
      print('    resolver [+0xb0] = NIL')
    end
    -- the C37-evaluator-side [+0xd4] u16 grid:
    local u16 = readInteger(P + 0xd4)
    print('    [P+0xd4] u16-grid=' .. string.format('%08X', u16 or 0))
    -- name slot [+0x90]:
    local namePtr = readInteger(P + 0x90)
    if namePtr and namePtr ~= 0 then
      local nm = readString(namePtr, 24)
      if not nm then nm = 'raw ' .. hexb(namePtr, 24) end
      print('    [P+0x90] key name = ' .. nm)
    else
      print('    [P+0x90] = NIL')
    end
  end)
  if not okUid then
    print('  uid ' .. string.format('%08X', uid) .. ' ERR: ' .. tostring(errUid))
  end
end

-- == V6b: the name-keyed std::map @0x132aae8 - corrected MSVC RBTree layout
print('-- V6b the BitmapCaves map (@0x132aae8; count 4 from C47)')
local root = readInteger(baseAddr + 0x132aae8)
local cnt  = readInteger(baseAddr + 0x132aaec)
print('    root=' .. string.format('%08X', root or 0) .. ' count=' .. tostring(cnt))
local node = root
for k = 1, 64 do
  if not node or node == 0 then break end
  -- MSVC RBTree x86: {_Left(0) _Parent(4) _Right(8) _Color/_Isnil(0xc..0xf), _Val @0x10+}
  local left   = readInteger(node + 0x0) or 0
  local parent = readInteger(node + 0x4) or 0
  local right  = readInteger(node + 0x8) or 0
  print('    node @' .. string.format('%08X', node)
    .. ' L=' .. string.format('%08X', left)
    .. ' P=' .. string.format('%08X', parent)
    .. ' R=' .. string.format('%08X', right)
    .. ' raw(0xc..0x2c)=' .. (hexb(node + 0xc, 32) or 'NIL'))
  local valP = readInteger(node + 0x20)
  if valP and valP ~= 0 then
    print('      [val+0x94]=' .. string.format('%.4f', readFloat(valP + 0x94) or -7)
      .. '  ' .. tostring(readInteger(valP) or 0) .. 'x' .. tostring(readInteger(valP + 4) or 0))
  end
  node = right
end

-- == V6c: NOW open a NEW RUN at a different seed (e.g. 78633192 or 999123),
-- stay at spawn and run this script again; paste both outputs.
print('==== END PINPOINT v5.2 ====')
