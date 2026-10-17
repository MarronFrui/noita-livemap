-- dig #159 — the I31 full-grid caves dump, scripted (the C133 v2 run sheet —
-- the dig-#158 pattern's WRONG-STRUCT conflation corrected: the C48
-- grid-owner's marker [P+0x94] = f32 2560.0 EXACT (the C48 oracle json;
-- LE bytes 00 00 20 45), NOT the record-template's ±100000-affine slot).
-- Run INSIDE Cheat Engine's Lua engine (Ctrl+Alt+L → paste → Execute) while
-- noita_dev.exe is attached and the target world (seed 78633191) is LOADED
-- and GENERATED.
--
-- What it does (X121 fresh: [owner+0x9c] = W; the grid INLINE at owner+0xb4):
--   1. AOBScans  00 00 20 45 ?? ?? ?? ?? 00 02 00 00
--      = f32 2560.0 at [P+0x94], 4 don't-care bytes ([P+0x98]),
--      then the stride int W = 512 at [P+0x9c] (LE 00 02 00 00).
--   2. Per hit: owner := hit − 0x94; belt re-validations per hit.
--   3. Dumps 0x80020 bytes starting AT the hit (= P+0x94): the 8-byte
--      validation window + the 512×256 f32 grid (the grid base = hit+0x20,
--      idx = W·y + x; the game's own cell gate = f32 > 0.51 @0x11dfa94).
--   4. Out dir = %USERPROFILE%\AppData\LocalLow\Nolla_Games_Noita\ce-caves
--      (the game's own data area; NOTHING touches the Desktop).
--   5. Post-run on the WSL side:
--        node mapgen/experiments/2026-10-17-dig158-ce-caves-ingest.mjs \
--             /mnt/c/Users/xan98/AppData/LocalLow/Nolla_Games_Noita/ce-caves/*.bin

local SEED      = 78633191
local OUT_DIR   = os.getenv('USERNAME')
  and string.format([[C:\Users\%s\AppData\LocalLow\Nolla_Games_Noita\ce-caves]], os.getenv('USERNAME'))
  or  [[C:\Users\xan98\AppData\LocalLow\Nolla_Games_Noita\ce-caves]]
local PATTERN       = '00 00 20 45 ?? ?? ?? ?? 00 02 00 00'
local OWNER_OFFSET  = 0x94          -- the hit address = P+0x94
local DUMP_SIZE     = 0x80020       -- 8 B validation window + 512*256*4 grid
local EXPECT_STRIDE = 512
local MARKER_BITS   = 0x45200000    -- f32 2560.0

local function fmtAddr(a) return string.format('%08X', a) end

os.execute(string.format([[cmd /c if not exist "%s" mkdir "%s"]], OUT_DIR, OUT_DIR))
print('[ce-caves] out dir: ' .. OUT_DIR)

local hits = AOBScan(PATTERN)
if (hits == nil) or (hits.Count == 0) then
  print('[ce-caves] FAIL: no hits for the pattern ' .. PATTERN)
  print('[ce-caves] hints: the right noita world (78633191) loaded & generated? CE attached to noita_dev.exe?')
  return
end
print(string.format('[ce-caves] %d pattern hit(s)', hits.Count))

local kept, skipped = 0, 0
local base = OUT_DIR .. '\\'
for i = 0, hits.Count - 1 do
  local hit = tonumber(hits[i])
  local owner = hit - OWNER_OFFSET
  local okM, marker  = pcall(readInteger, hit)          -- belt: the bits the scan matched
  local okS, stride  = pcall(readInteger, hit + 8)      -- [P+0x9c] = W
  if not okM or not okS or marker ~= MARKER_BITS or stride ~= EXPECT_STRIDE then
    skipped = skipped + 1
    print(string.format('[ce-caves] skip %s: marker=%s stride=%s (want 2560.0/512)',
      fmtAddr(hit), okM and marker and fmtAddr(marker) or 'nil', okS and stride and tostring(stride) or 'nil'))
  else
    kept = kept + 1
    local path = string.format('%scaves-%02d.p%s-%d.bin', base, kept, fmtAddr(hit), SEED)
    local okW = pcall(writeBytesToFile, path, hit, DUMP_SIZE)
    if not okW then
      print('[ce-caves] DUMP FAIL: ' .. path)
    else
      -- console summary: the first cell + a min/max over the first row
      local okG, g0 = pcall(readFloat, hit + 0x20); if not okG then g0 = -1 end
      local lo, hi = math.huge, -math.huge
      for k = 0, 511 do
        local ok, v = pcall(readFloat, hit + 0x20 + 4 * k)
        if ok and v ~= nil then
          if v < lo then lo = v end
          if v > hi then hi = v end
        end
      end
      print(string.format('[ce-caves] dump %s: owner=%s stride=%d grid[0]=%.4f row0[min=%.4f max=%.4f]',
        path, fmtAddr(owner), stride, g0, lo, hi))
    end
  end
end
hits.destroy()

print(string.format('[ce-caves] DONE — kept %d, skipped %d', kept, skipped))
if kept == 0 then
  print('[ce-caves] NOTHING KEPT: the world is not the seeded one, or CE attached the wrong process')
end
