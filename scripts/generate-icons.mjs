import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(projectRoot, "icons");
const sizes = [16, 32, 48, 128];

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const projected =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared)
        );
  const closestX = x1 + projected * dx;
  const closestY = y1 + projected * dy;
  return Math.hypot(px - closestX, py - closestY);
}

function insideRoundedSquare(x, y) {
  const inset = 0.04;
  const radius = 0.22;
  const nearestX = Math.max(inset + radius, Math.min(1 - inset - radius, x));
  const nearestY = Math.max(inset + radius, Math.min(1 - inset - radius, y));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function pixelAt(x, y) {
  if (!insideRoundedSquare(x, y)) return [0, 0, 0, 0];

  const glow = Math.max(0, 1 - Math.hypot(x - 0.78, y - 0.14) / 0.8);
  const background = [
    Math.round(15 + 15 * glow),
    Math.round(24 + 33 * glow),
    Math.round(38 + 52 * glow),
    255
  ];

  const stroke = 0.047;
  const isLetter =
    distanceToSegment(x, y, 0.31, 0.25, 0.31, 0.75) < stroke ||
    distanceToSegment(x, y, 0.34, 0.5, 0.58, 0.27) < stroke ||
    distanceToSegment(x, y, 0.34, 0.5, 0.61, 0.74) < stroke;

  if (isLetter) return [244, 247, 251, 255];

  const outerMoon = Math.hypot(x - 0.7, y - 0.34) < 0.13;
  const moonCutout = Math.hypot(x - 0.76, y - 0.3) < 0.13;
  if (outerMoon && !moonCutout) return [119, 187, 237, 255];

  return background;
}

function createPng(size) {
  const bytesPerRow = size * 4 + 1;
  const raw = Buffer.alloc(bytesPerRow * size);

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * bytesPerRow;
    raw[rowOffset] = 0;

    for (let x = 0; x < size; x += 1) {
      const sampleX = (x + 0.5) / size;
      const sampleY = (y + 0.5) / size;
      const [red, green, blue, alpha] = pixelAt(sampleX, sampleY);
      const pixelOffset = rowOffset + 1 + x * 4;
      raw[pixelOffset] = red;
      raw[pixelOffset + 1] = green;
      raw[pixelOffset + 2] = blue;
      raw[pixelOffset + 3] = alpha;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync(outputDirectory, { recursive: true });
for (const size of sizes) {
  fs.writeFileSync(path.join(outputDirectory, `icon-${size}.png`), createPng(size));
}

console.log(`Generated Chrome icons: ${sizes.join(", ")}`);
