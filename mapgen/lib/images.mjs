import fs from "node:fs";
import { PNG } from "pngjs";

export function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

export function writePng(filePath, width, height, rgba) {
  const png = new PNG({ width, height });
  Buffer.from(rgba).copy(png.data, 0, 0, width * height * 4);
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

export async function readImageRaw(filePath) {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

// PNG header peek (no full decode): IHDR width/height at bytes 16..24
export function pngDimensions(filePath) {
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(24);
  fs.readSync(fd, header, 0, 24, 0);
  fs.closeSync(fd);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

// Colors are handled as RGBA ints: (r<<24)|(g<<16)|(b<<8)|a
export function pxToRgbaInt(data, i) {
  return (data[i] << 24 | data[i + 1] << 16 | data[i + 2] << 8 | data[i + 3]) >>> 0;
}

export function rgbToRgbaInt(r, g, b, a = 0xff) {
  return (r << 24 | g << 16 | b << 8 | a) >>> 0;
}

export function rgbaIntChannels(int) {
  return [(int >>> 24) & 0xff, (int >>> 16) & 0xff, (int >>> 8) & 0xff, int & 0xff];
}

// Game XML files use ARGB hex strings ("FFD57917"); convert to our RGBA int.
export function argbHexToRgbaInt(hex) {
  const s = hex.replace(/^#/, "");
  const a = parseInt(s.slice(0, 2), 16);
  const r = parseInt(s.slice(2, 4), 16);
  const g = parseInt(s.slice(4, 6), 16);
  const b = parseInt(s.slice(6, 8), 16);
  return rgbToRgbaInt(r, g, b, a);
}
