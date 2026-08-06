#!/usr/bin/env node
/**
 * Draws the extension's toolbar icons.
 *
 * Chrome will not load a manifest whose icons are missing, and the four sizes
 * must be real rasters. Generating them from the design tokens keeps the icon
 * in step with the palette and avoids committing an asset nobody can regenerate
 * — the alternative was four opaque binaries and a note saying "ask design".
 *
 * Usage: node scripts/generate-extension-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'extension',
  'public',
  'icons',
);

const SIZES = [16, 32, 48, 128];

/** `--primary` and `--primary-foreground` from @org/design-system. */
const VIOLET = [0x6e, 0x56, 0xcf];
const FOREGROUND = [0xfa, 0xfa, 0xfa];

// --- PNG encoding ------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
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

/** Encodes RGBA pixel data as a PNG. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // 10..12 stay zero: deflate compression, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter byte; 0 means "none", which
  // compresses fine for artwork this small and keeps the encoder trivial.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Drawing -----------------------------------------------------------------

/** Signed distance to a rounded square centred on the origin. */
function roundedSquareCoverage(x, y, half, radius) {
  const dx = Math.abs(x) - (half - radius);
  const dy = Math.abs(y) - (half - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside - radius;
}

/**
 * Signed distance to a four-pointed sparkle.
 *
 * An astroid — |x|^n + |y|^n = r^n with n below 1 — gives concave sides and
 * sharp points on the axes, which is the sparkle shape without hand-plotting a
 * path.
 */
function sparkleDistance(x, y, radius) {
  const n = 0.62;
  const value =
    Math.pow(Math.abs(x) / radius, n) + Math.pow(Math.abs(y) / radius, n);
  return (value - 1) * radius * 0.5;
}

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4);
  // 3x3 supersampling: these are rendered at 16px, where unantialiased
  // diagonals read as noise.
  const samples = 3;
  const half = size / 2;
  const radius = size * 0.22;
  const sparkleRadius = size * 0.3;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = px + (sx + 0.5) / samples - half;
          const y = py + (sy + 0.5) / samples - half;

          if (roundedSquareCoverage(x, y, half, radius) <= 0) bg++;
          if (sparkleDistance(x, y, sparkleRadius) <= 0) fg++;
        }
      }

      const total = samples * samples;
      const alpha = bg / total;
      const mark = fg / total;
      const offset = (py * size + px) * 4;

      // Composite the mark over the tile, then the tile over transparency.
      for (let channel = 0; channel < 3; channel++) {
        rgba[offset + channel] = Math.round(
          VIOLET[channel] * (1 - mark) + FOREGROUND[channel] * mark,
        );
      }
      rgba[offset + 3] = Math.round(alpha * 255);
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, draw(size));
  console.log(`  wrote icons/icon-${size}.png`);
}
