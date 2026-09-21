-- ═══════════════════════════════════════════════════════════════════════
-- CE BREAKPOINT-FREE PINPOINT PICKUP v5 — for the fnB/fnC1 layer probe.
--
-- WHERE TO RUN: STAND AT SPAWN on seed 78633191 (same run as your first
-- two pickups — do NOT re-enter a world; the caves grids are baked AT
-- WORLD LOAD and only get stale when a run ends). The script reads
-- purely from already-baked config/grid memory — NO map movement needed.
--
-- Paste the whole output back (there are no interactive prompts).
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
  for k = 0, count - 1 do out[#out+1] = string.format('%.6f', readFloat(addr + k * stride) or -7) end
  return table.concat(out, ' ')
end
local function i32s(addr, n)
  local out = {}
  for k = 0, n - 1 do out[#out+1] = tostring(readInteger(addr + k * 4) or 0) end
  return table.concat(out, ' ')
end

print('══════ PINPOINT PICKUP v5 (spawn, same seed) ══════')
print('moduleBase = ' .. string.format('%08X', getAddress('noita_dev.exe') or 0))
print('worldseed = ' .. string.format('%d', readInteger(getAddress('noita_dev.exe') - 0x400000 + 0x1327ffc) or -1))

local ok, hits = pcall(AOBScan, 'C70E6A3D00000040')
if not ok or not hits then print('scan failed: ' .. tostring(hits)); return end
if hits.Count == 0 then print('scan: 0 hits — need a loaded world'); hits.destroy(); return end
local seen, uids = {}, {}
for i = 0, math.min(hits.Count - 1, 45) do
  local a = tonumber(hits[i], 16)
  if a and not seen[a] then seen[a] = true; uids[#uids+1] = a - 0x244 end
end
hits.destroy()
print('uid candidates: ' .. #uids)

-- ══ V6a: the FULL knob-struct byte-dump per uid — closes the [+0x24] f32
-- and every slot the fnB/fnC2 bodies read ([+0x1c], [+0x3c/0x40],
-- [+0x28/0x2c], [+0x34/0x38], [+0x4c/0x50], [+0x54/0x58], [+0x74/0x78]).
print('── V6a uid P-slot dump (structP = [uid+0x1d4])')
for i = 1, math.min(#uids, 45) do
  local uid = uids[i]
  local P = readInteger(uid + 0x1d4)
  if P and P ~= 0 then
    local w = readInteger(P) or 0
    local h = readInteger(P + 4) or 0
    print('  uid ' .. string.format('%08X', uid) .. ' P=' .. string.format('%08X', P)
      .. ' ' .. w .. 'x' .. h
      .. ' [P+0x94]=' .. string.format('%.4f', readFloat(P + 0x94) or -7))
    -- the f32 window the bodies actually read:
    print('    f32 +0x1c..+0x4c: ' .. f100(P + 0x1c, 13)     -- 0x1c,0x20,0x24,0x28,0x2c,0x30,0x34,0x38,0x3c,0x40,0x44,0x48,0x4c
      .. '  | +0x50..0x60: ' .. f100(P + 0x50, 5))
    -- the int slots (cave-count pairs / vector heads):
    print('    i32 +0x1c..+0x3c: ' .. i32s(P + 0x1c, 9))
    -- the record-vector head (the C32-list candidates at +0x80):
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
    -- the C32 record list [{x,y,B,B-1}] — the +0x80 vector head:
    local rec0, rec1 = readInteger(P + 0x7c), readInteger(P + 0x80)
    if rec0 and rec1 and rec1 > rec0 then
      local n = math.min(math.floor((rec1 - rec0) / 16), 12)
      local out = {}
      for k = 0, n - 1 do
        local bx = readInteger(rec0 + k * 16)
        local by = readInteger(rec0 + k * 16 + 4)
        local tail = hexb(rec0 + k * 16 + 8, 8)
        out[#out+1] = bx .. ',' .. by .. ':' .. tostring(tail)
      end
      print('    [P+0x7c/0x80] records n<=' .. n .. ' (x,y,then 8B raw): '
        .. table.concat(out, ' | '))
    end
    -- V6e-retargeted: the A-resolver fn ptr on the REAL owner ([P+0xb0]):
    local fn = readInteger(P + 0xb0)
    print('    resolver [+0xb0] = ' .. (fn and string.format('%08X', fn) or 'NIL')
      .. (fn and fn ~= 0 and (' first32 = ' .. hexb(fn, 32)) or ''))
    -- C37-evaluator-side: the [+0xd4] u16 grid (the material-interp lane):
    local u16 = readInteger(P + 0xd4)
    print('    [P+0xd4] u16-grid=' .. string.format('%08X', u16 or 0))
    -- name slot [+0x90] (the reader 0xb78e0's target):
    local namePtr = readInteger(P + 0x90)
    local name = '?'
    if namePtr and namePtr ~= 0 then
      name = (readString(namePtr) or readString(namePtr, 32) or '?')
    end
    print('    [P+0x90] key name = ' .. tostring(name))
  end
end

-- ══ V6b: the name-keyed std::map @0x132aae8 — the corrected MSVC layout
print('── V6b the BitmapCaves map (@0x132aae8; count 4 from C47)')
local base = getAddress('noita_dev.exe') - 0x400000
local root = readInteger(base + 0x132aae8)
local cnt  = readInteger(base + 0x132aaec)
print('    root=' .. string.format('%08X', root or 0) .. ' count=' .. tostring(cnt))
local node = root
for k = 1, 64 do
  if not node or node == 0 then break end
  -- MSVC RBTree x86: {_Left(0) _Parent(4) _Right(8) _Color/_Isnil(0xc..0xf), _Val @0x10+}
  local left   = readInteger(node + 0x0) or 0
  local parent = readInteger(node + 0x4) or 0
  local right  = readInteger(node + 0x8) or 0
  local kbytes = hexb(node + 0xc, 32)              -- color/isnil + key + value head
  local valP   = readInteger(node + 0x20) or 0
  print('    node @' .. string.format('%08X', node)
    .. ' L=' .. string.format('%08X', left)
    .. ' P=' .. string.format('%08X', parent)
    .. ' R=' .. string.format('%08X', right)
    .. ' val?=' .. string.format('%08X', valP))
  print('      raw32 from +0xc = ' .. (kbytes or 'NIL'))
  -- read the P+0x94 signature off whatever valP points at (sanity):
  if valP and valP ~= 0 then
    print('        [val+0x94]=' .. string.format('%.4f', readFloat(valP + 0x94) or -7)
      .. '  ' .. tostring(readInteger(valP) or 0) .. 'x' .. tostring(readInteger(valP + 4) or 0))
  end
  -- inorder-ish walk: descend left once, then follow parents; keep it shallow:
  node = right
end
-- NOTE: if the right-child walk above prints nothing sensible, the paste
-- of the key16 strings + the val pointer positions closes it anyway.

-- ══ V6c: the SECOND validation sample — a different-seed run
print('══════ END PINPOINT v5 ══════')
print('══════ NOW: open a NEW RUN at a DIFFERENT seed (e.g. 78633192 or 999123), stay at spawn and run this script again — paste both outputs ══════')
