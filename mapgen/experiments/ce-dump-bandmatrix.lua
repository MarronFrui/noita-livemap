-- Cheat Engine Lua script: dump the PT (procedural terrain) band-matrix.
-- Output: C:\Users\xan98\AppData\LocalLow\Nolla_Games_Noita\bandmatrix.csv
--
-- NOTE: Noita is 32-bit, so pointers are 4 bytes (not 8).
-- PT+0x8c array: w*h entries, 4 bytes each.
--
-- HOW TO USE:
--   1. Start Noita, load a world (seed 78633191), walk around so terrain generates.
--   2. Open Cheat Engine, attach to the Noita process.
--   3. Table -> Show Cheat Table Lua Script, paste this, click Execute.
--   4. Check the CE Lua console for "Done" or error messages.
--   5. The CSV is written to the Noita data directory.

local OUT_PATH = "C:\\Users\\xan98\\AppData\\LocalLow\\Nolla_Games_Noita\\bandmatrix.csv"

local function toAddr(entry)
  if type(entry) == "number" then return entry end
  local a = getAddress(entry)
  if a then return a end
  return tonumber(entry, 16)
end

-- Step 1: Find winter band config structs (f64 NoiseScale 0.00128571 at +0x290)
local bandConfigs = {}
local aob = AOBScan("15 AA BC 99 A8 10 55 3F", "R-W")
if not aob then aob = AOBScan("15 AA BC 99 A8 10 55 3F", "") end

if aob then
  for i = 0, aob.Count - 1 do
    local addr = toAddr(aob[i])
    if not addr then goto skip end
    local base = addr - 0x290
    local mode = readInteger(base + 0x288) or -999
    if mode >= 0 and mode <= 10 then
      local dup = false
      for _, bc in ipairs(bandConfigs) do
        if bc == base then dup = true; break end
      end
      if not dup then
        table.insert(bandConfigs, base)
      end
    end
    ::skip::
  end
  aob.destroy()
end

print("Found " .. #bandConfigs .. " band config structs")
if #bandConfigs == 0 then
  print("ERROR: No band configs found")
  return
end

-- Step 2: Find PT struct (w=70, h=48, cap=3360).
-- The PT+0x8c field is a 4-byte pointer to the band-matrix array.
-- The array has w*h entries, 4 bytes each.
-- We search for the PT struct by scanning for w=70, h=48 at +0x70/+0x74.
local ptHits = {}
local aob2 = AOBScan("46 00 00 00 30 00 00 00", "R-W")
if not aob2 then aob2 = AOBScan("46 00 00 00 30 00 00 00", "") end

if aob2 then
  for i = 0, math.min(aob2.Count - 1, 10000) do
    local addr = toAddr(aob2[i])
    if not addr then goto skip2 end
    local candidate = addr - 0x70
    local w = readInteger(candidate + 0x70) or 0
    local h = readInteger(candidate + 0x74) or 0
    local cap = readInteger(candidate + 0x78) or 0
    if w == 70 and h == 48 and cap == 3360 then
      local arr = readInteger(candidate + 0x8c) or 0  -- 4-byte ptr in 32-bit
      if arr ~= 0 then
        local found = false
        for _, bc in ipairs(bandConfigs) do
          for j = 0, 3359 do
            if readInteger(arr + j*4) == bc then
              found = true
              break
            end
          end
          if found then break end
        end
        local dup = false
        for _, p in ipairs(ptHits) do
          if p == candidate then dup = true; break end
        end
        if not dup then
          table.insert(ptHits, candidate)
          print("  PT at " .. string.format("0x%X", candidate) .. "  arr=" .. string.format("0x%X", arr) .. (found and " (has winter ptr)" or ""))
        end
      end
    end
    ::skip2::
  end
  aob2.destroy()
end

if #ptHits == 0 then
  print("ERROR: No PT found.")
  return
end

print("Found " .. #ptHits .. " PT structs")

-- Step 3: Dump
local f = io.open(OUT_PATH, "w")
if not f then
  print("ERROR: Cannot open " .. OUT_PATH)
  return
end

f:write("idx,col,row,ptr,mode,gradStartY,gradEndY,gradNoiseScale,gradLowNoise,gradHighNoise\n")

for _, pt in ipairs(ptHits) do
  local arr = readInteger(pt + 0x8c) or 0  -- 4-byte ptr
  if arr == 0 then goto skip3 end
  local w = readInteger(pt + 0x70) or 0
  local h = readInteger(pt + 0x74) or 0
  if w < 1 or h < 1 then goto skip3 end
  print("  Dumping PT at " .. string.format("0x%X", pt) .. "  w=" .. w .. " h=" .. h)
  for idx = 0, w*h - 1 do
    local ptr = readInteger(arr + idx*4) or 0  -- 4-byte ptr
    local col = idx % w
    local row = (idx / w) | 0
    local mode, sy, ey, ns, lo, hi = "", "", "", "", "", ""
    if ptr ~= 0 then
      mode = readInteger(ptr + 0x288) or ""
      sy = readFloat(ptr + 0x270) or ""
      ey = readFloat(ptr + 0x274) or ""
      ns = readDouble(ptr + 0x290) or ""
      lo = readFloat(ptr + 0x298) or ""
      hi = readFloat(ptr + 0x29c) or ""
    end
    f:write(string.format("%d,%d,%d,0x%X,%s,%s,%s,%s,%s,%s\n",
      idx, col, row, ptr, mode, sy, ey, ns, lo, hi))
  end
  ::skip3::
end

f:close()
print("Done. Output written to " .. OUT_PATH)