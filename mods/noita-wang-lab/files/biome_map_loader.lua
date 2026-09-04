-- Loads the stock biome map, then paints the lab rectangle (5x2 chunks).
BiomeMapSetSize(70, 48)
BiomeMapLoadImage(0, 0, "data/biome_impl/biome_map.png")
for ty = 36, 37 do
  for tx = 2, 6 do
    BiomeMapSetPixel(tx, ty, 0xff0a0b0c)
  end
end
print("[wang-lab] biome map ready, lab rect painted (tx 2..6, ty 36..37)")
