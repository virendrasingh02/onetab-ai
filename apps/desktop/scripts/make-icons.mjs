/**
 * Generates the placeholder desktop icons.
 *
 * These are flat brand-coloured rounded squares, not final artwork — swap
 * `resources/icon.png` for the real asset when branding lands and rerun this
 * only if you need the tray variant regenerated.
 *
 * Written by hand with zlib rather than pulling in an image library: the whole
 * job is one RGBA buffer and a CRC, and an icon generator is not worth a
 * dependency in the install graph.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixel) {
  // PNG scanlines are prefixed with a filter byte; 0 means "no filtering".
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Signed distance to a rounded square, used to antialias the edge. */
function roundedSquareAlpha(x, y, size, inset, radius) {
  const half = size / 2 - inset;
  const dx = Math.abs(x + 0.5 - size / 2) - (half - radius);
  const dy = Math.abs(y + 0.5 - size / 2) - (half - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const distance = outside + Math.min(Math.max(dx, dy), 0) - radius;
  return Math.max(0, Math.min(1, 0.5 - distance));
}

const BRAND = [110, 86, 207]; // #6E56CF

function appPixel(x, y, size) {
  const alpha = roundedSquareAlpha(x, y, size, size * 0.06, size * 0.22);
  // A subtle top-to-bottom lift keeps the tile from reading as a flat blob.
  const lift = 1 - (y / size) * 0.25;
  return [
    Math.round(BRAND[0] * lift),
    Math.round(BRAND[1] * lift),
    Math.round(BRAND[2] * lift + 30 * (1 - lift)),
    Math.round(alpha * 255),
  ];
}

/**
 * The tray glyph is a white silhouette: macOS renders it as a template image
 * and recolours it for light/dark menu bars.
 */
function trayPixel(x, y, size) {
  const alpha = roundedSquareAlpha(x, y, size, size * 0.09, size * 0.28);
  return [255, 255, 255, Math.round(alpha * 255)];
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'icon.png'), encodePng(512, appPixel));
writeFileSync(join(OUT_DIR, 'tray-icon.png'), encodePng(32, trayPixel));
writeFileSync(join(OUT_DIR, 'tray-icon@2x.png'), encodePng(64, trayPixel));

console.log(`Wrote icon.png, tray-icon.png and tray-icon@2x.png to ${OUT_DIR}`);
