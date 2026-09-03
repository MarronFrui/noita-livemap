// Node loader for noita-tools' prebuilt noita_random.wasm.
// ABI mirrors vendor/noita-tools/.../mapWasm.ts (see wasm_in.cpp for the C++ side).
// WASM built by noitool's author from the decompiled game; treated as a black box.

import fs from "node:fs";
import { wasmPath } from "./paths.mjs";

export async function loadWang() {
  const bytes = fs.readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const wasm = instance.exports;
  wasm._initialize();

  const heap = () => new Uint8Array(wasm.memory.buffer);

  const writeBytes = (bytes) => {
    const ptr = wasm.malloc(bytes.length);
    heap().set(bytes, ptr);
    return { ptr, len: bytes.length };
  };

  const readRgba = (ptr, width, height) =>
    heap().slice(ptr, ptr + 4 * width * height);

  const worldSeed = (seed) => wasm.SetWorldSeedRaw(seed >>> 0);

  // Generate one biome area at game resolution.
  // Mirrors MapInfoProvider.getMapHandler + generate_map + toBig (index.ts:328-386)
  const generateArea = ({
    seed,
    color,
    area,
    atlasPngBytes,
    isCoalMine,
    shouldBlockOutRooms,
    randomMaterials,
  }) => {
    worldSeed(seed);

    const w = wasm.GetWidthFromPixRaw(area.x1, area.x2 + 1);
    const h = wasm.GetWidthFromPixRaw(area.y1, area.y2 + 1);

    let rmPtr = 0;
    if (randomMaterials && randomMaterials.length) {
      rmPtr = wasm.malloc(randomMaterials.length * 4);
      new Uint32Array(wasm.memory.buffer, rmPtr, randomMaterials.length).set(
        randomMaterials
      );
    }

    const handle = wasm.MapHandlerNew(
      w,
      h,
      color,
      isCoalMine ? 1 : 0,
      shouldBlockOutRooms ? 1 : 0,
      rmPtr,
      area.x1,
      area.y1
    );

    const png = writeBytes(atlasPngBytes);
    wasm.MapHandlerGenerateMap(handle, png.ptr, png.len);
    wasm.free(png.ptr);

    wasm.MapHandlerToBig(handle);

    const bigMapPtr = wasm.MapHandlerBigMapPtr(handle);
    const bigWidth = w * 10;
    const bigHeight = h * 10;
    const bigMap = readRgba(bigMapPtr, bigWidth, bigHeight);

    // Where does this area sit in world space? (anchor for coords.mjs)
    const worldX = wasm.GetGlobalPosX(area.x1, area.y1);
    const worldY = wasm.GetGlobalPosY(area.x1, area.y1);

    const mapPtr = wasm.MapHandlerMapPtr(handle);
    const map = readRgba(mapPtr, w, h); // 1 color per 10x10 cell (raw wang map)

    wasm.MapHandlerDelete(handle);
    if (rmPtr) wasm.free(rmPtr);

    return { w, h, bigWidth, bigHeight, bigMap, map, worldX, worldY };
  };

  return { wasm, generateArea, worldSeed };
}
