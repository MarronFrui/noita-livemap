-- dig #158 — the I31 full-grid caves dump, scripted (the C133 run sheet).
-- Run INSIDE Cheat Engine's Lua engine (Ctrl+Alt+L → paste → Execute) while
-- noita_dev.exe is attached and the target world (seed 78633191) is LOADED
-- and GENERATED (the caves grid = (name,seed)-cached per C49; a fresh boot
-- right after world load is fine — post-Init).
--
-- What it does (the byte laws, X121/X122 fresh, C133):
--   1. AOBScans the 8-byte adjacency pair  00 00 80 3F 00 00 34 45
--      = f32 1.0 at owner+0x90 then f32 2560.0 at owner+0x94
--      (the C48 marker (w*0.5)/0.1 for a 512-wide cave grid; the ctor writes
--      both adjacent — 8f9536 movl $0x3f800000,0x90(%esi) then 8f95b1
--      movss xmm0,[esi+0x94]).
--   2. Per hit: owner := hit − 0x90; re-validates the marker bits
--      (readInteger(owner+0x94) == 0x45200000) and the stride W
--      (readInteger(owner+0x9c) == 512 — [0x9c] = W, the dig-#121 law;
--      the 1*1-grid family self-excludes via its 5.0 marker).
--   3. Dumps 0x80024 bytes starting AT the hit (owner+0x90): the 0x24-byte
--      validation header + the caves grid INLINE at owner+0xb4 (idx =
--      W*y + x; the sampler gate = f32 > 0.51 @0x11dfa94) -> per-hit file.
--   4. Prints a Summary to the Lua console; the WSL side ingests via:
--        node mapgen/experiments/2026-10-17-dig158-ce-caves-ingest.mjs \
--             /mnt/c/Users/xan98/Desktop/ce-caves/*.bin
--
-- CAVEATS: the world seed tolerance = whatever world the game holds — do
-- NOT rename the files by hand; the ingest keys on the CONTENT (the port
-- compare re-derives def identity from the grid geometry).
-- If writeBytesToFile errors on the directory, run the script twice (the
-- mkdir step precedes the dumps but the console prints it either way).

local SEED          = 78633191
local USERNAME_FALL = 'xan98'
local OUT_DIR       = string.format([[C:\Users\%s\Desktop\ce-caves]], os.getenv('USERNAME') or USERNAME_FALL)
local PATTERN       = '00 00 80 3F 00 00 34 45'
local OWNER_OFFSET  = 0x90        -- the hit address = owner+0x90
local DUMP_SIZE     = 0x80024     -- 0x24 header + 512*256*4 grid
local EXPECT_STRIDE = 512
local MARKER_BITS   = 0x45200000  -- f32 2560.0

local function fmtAddr(a) return string.format('%08X', a) end

-- 0. make the output dir
os.execute(string.format([[cmd /c if not exist "%s" mkdir "%s"]], OUT_DIR, OUT_DIR))
print('[ce-caves] out dir: ' .. OUT_DIR)

-- 1. the pattern scan
local hits = AOBScan(PATTERN)
if (hits == nil) or (hits.Count == 0) then
  print('[ce-caves] FAIL: no hits for the pattern ' .. PATTERN)
  print('[ce-caves] hints: is noita_dev.exe attached? is the world generated?')
  return
end
print(string.format('[ce-caves] %d pattern hit(s)', hits.Count))

-- 2/3. validate + dump (each read/dump pcall-guarded: a false-positive hit
-- may point into protected memory and a hard throw would abort the sweep)
local kept, skipped = 0, 0
local base = OUT_DIR .. '\\'
for i = 0, hits.Count - 1 do
  local hit = tonumber(hits[i])
  local owner = hit - OWNER_OFFSET
  local okM, marker  = pcall(readInteger, owner + 0x94)
  local okS, stride = pcall(readInteger, owner + 0x9c)
  if not okM or not okS or marker ~= MARKER_BITS or stride ~= EXPECT_STRIDE then
    skipped = skipped + 1
    print(string.format('[ce-caves] skip %s: okM=%s marker=%s okS=%s stride=%s (want 0x45200000 / 512)',
      fmtAddr(hit), tostring(okM), okM and marker and fmtAddr(marker) or 'nil', tostring(okS), okS and stride and tostring(stride) or 'nil'))
  else
    kept = kept + 1
    local path = string.format('%scaves-%02d.w%08X.p%s-%d.bin', base, kept, owner, fmtAddr(hit), SEED)
    local okW = pcall(writeBytesToFile, path, hit, DUMP_SIZE)
    if not okW then
      print('[ce-caves] DUMP FAIL: ' .. path)
    else
      -- console summary: the first cell + a min/max over the first row
      local okG, g0 = pcall(readFloat, hit + 0x24); if not okG then g0 = -1 end
      local lo, hi = math.huge, -math.huge
      for k = 0, 511 do
        local ok, v = pcall(readFloat, hit + 0x24 + 4 * k)
        if ok and v ~= nil then
          if v < lo then lo = v end
          if v > hi then hi = v end
        end
      end
      print(string.format('[ce-caves] dump %s: owner=%s stride=%d marker=2560 grid[0]=%.4f row0[min=%.4f max=%.4f]',
        path, fmtAddr(owner), stride, g0, lo, hi))
    end
  end
end
hits.destroy()

print(string.format('[ce-caves] DONE — kept %d, skipped %d. Fetch them in WSL:', kept, skipped))
print('  node mapgen/experiments/2026-10-17-dig158-ce-caves-ingest.mjs /mnt/c/*/Desktop/ce-caves/*.bin')
if kept == 0 then
  print('[ce-caves] NOTHING KEPT — if every hit skipped on the marker, CE attached the wrong process; if it found nothing, the world is not the seeded one')
end
