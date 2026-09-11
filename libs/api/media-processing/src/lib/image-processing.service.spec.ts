import { describe, it, expect, beforeEach } from 'vitest';
import sharp from 'sharp';
import { ImageProcessingService } from './image-processing.service.js';
import { ImageSecurityService } from './image-security.service.js';
import {
  InvalidCropException,
  InvalidDimensionsException,
  InvalidImageException,
  PixelLimitExceededException,
} from './image-processing.errors.js';

describe('ImageProcessingService & ImageSecurityService', () => {
  let security: ImageSecurityService;
  let service: ImageProcessingService;

  // Helper to create valid test image buffers in memory
  async function createTestImage(
    width = 200,
    height = 200,
    format: 'png' | 'jpeg' | 'webp' = 'png',
    channels: 3 | 4 = 3,
  ): Promise<Buffer> {
    const s = sharp({
      create: {
        width,
        height,
        channels,
        background: { r: 128, g: 64, b: 200 },
      },
    });
    if (format === 'jpeg') return s.jpeg().toBuffer();
    if (format === 'webp') return s.webp().toBuffer();
    return s.png().toBuffer();
  }

  beforeEach(() => {
    security = new ImageSecurityService();
    service = new ImageProcessingService(security);
  });

  describe('Security & Validation', () => {
    it('sniffs real image formats from magic bytes', async () => {
      const png = await createTestImage(50, 50, 'png');
      const jpeg = await createTestImage(50, 50, 'jpeg');
      const webp = await createTestImage(50, 50, 'webp');

      expect(security.sniffFormat(png)?.format).toBe('png');
      expect(security.sniffFormat(jpeg)?.format).toBe('jpeg');
      expect(security.sniffFormat(webp)?.format).toBe('webp');
      expect(security.sniffFormat(Buffer.from('not an image'))).toBeNull();
    });

    it('rejects malicious SVG containing scripts or XXE', () => {
      const scriptSvg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`;
      expect(() => security.validateSvg(scriptSvg)).toThrow(InvalidImageException);

      const onloadSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>`;
      expect(() => security.validateSvg(onloadSvg)).toThrow(InvalidImageException);

      const xxeSvg = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>`;
      expect(() => security.validateSvg(xxeSvg)).toThrow(InvalidImageException);

      const ssrfSvg = `<svg><image href="http://169.254.169.254/latest/meta-data/" /></svg>`;
      expect(() => security.validateSvg(ssrfSvg)).toThrow(InvalidImageException);

      const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red" /></svg>`;
      expect(() => security.validateSvg(safeSvg)).not.toThrow();
    });

    it('enforces SSRF protection for remote URLs', () => {
      expect(() => security.assertSafeRemoteUrl('http://localhost:3000/image.png')).toThrow(
        InvalidImageException,
      );
      expect(() => security.assertSafeRemoteUrl('http://127.0.0.1/image.png')).toThrow(
        InvalidImageException,
      );
      expect(() => security.assertSafeRemoteUrl('http://192.168.1.1/image.png')).toThrow(
        InvalidImageException,
      );
      expect(() => security.assertSafeRemoteUrl('http://10.0.0.5/image.png')).toThrow(
        InvalidImageException,
      );
      expect(() => security.assertSafeRemoteUrl('https://example.com/image.png')).not.toThrow();
    });

    it('defends against decompression bombs exceeding pixel limits', () => {
      expect(() => security.assertDimensions(10000, 10000)).toThrow(
        PixelLimitExceededException,
      );
      expect(() => security.assertDimensions(1920, 1080)).not.toThrow();
    });
  });

  describe('Metadata & Statistics', () => {
    it('extracts metadata accurately without full decode', async () => {
      const buffer = await createTestImage(400, 250, 'png');
      const meta = await service.getMetadata(buffer);

      expect(meta.width).toBe(400);
      expect(meta.height).toBe(250);
      expect(meta.format).toBe('png');
      expect(meta.mimeType).toBe('image/png');
      expect(meta.aspectRatio).toBe(1.6);
      expect(meta.size).toBe(buffer.byteLength);
    });

    it('computes channel statistics and dominant color', async () => {
      const buffer = await createTestImage(100, 100, 'png');
      const stats = await service.getStatistics(buffer);

      expect(stats.channels.length).toBeGreaterThanOrEqual(3);
      expect(stats.dominant).toBeDefined();
    });
  });

  describe('Transformations', () => {
    it('resizes with various fit strategies', async () => {
      const buffer = await createTestImage(600, 400, 'png');

      // Cover 200x200
      const cover = await service.resize(buffer, {
        width: 200,
        height: 200,
        fit: 'cover',
      });
      expect(cover.width).toBe(200);
      expect(cover.height).toBe(200);

      // Inside 200x200 (aspect ratio preserved)
      const inside = await service.resize(buffer, {
        width: 200,
        height: 200,
        fit: 'inside',
      });
      expect(inside.width).toBe(200);
      expect(inside.height).toBe(133);

      // Contain with padding
      const contain = await service.resize(buffer, {
        width: 300,
        height: 300,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      });
      expect(contain.width).toBe(300);
      expect(contain.height).toBe(300);
    });

    it('crops image and validates coordinates', async () => {
      const buffer = await createTestImage(500, 500, 'png');
      const cropped = await service.crop(buffer, {
        left: 50,
        top: 50,
        width: 200,
        height: 150,
      });

      expect(cropped.width).toBe(200);
      expect(cropped.height).toBe(150);

      await expect(
        service.crop(buffer, { left: -1, top: 0, width: 100, height: 100 }),
      ).rejects.toThrow(InvalidCropException);
    });

    it('rotates, flips, and auto-orients images', async () => {
      const buffer = await createTestImage(300, 200, 'png');

      const rotated = await service.rotate(buffer, 90);
      expect(rotated.width).toBe(200);
      expect(rotated.height).toBe(300);

      const flipped = await service.flip(buffer);
      expect(flipped.width).toBe(300);
      expect(flipped.height).toBe(200);
    });

    it('converts formats and handles compression', async () => {
      const pngBuffer = await createTestImage(200, 200, 'png');

      const webp = await service.convert(pngBuffer, { format: 'webp', quality: 80 });
      expect(webp.format).toBe('webp');
      expect(webp.mimeType).toBe('image/webp');
      expect(webp.buffer.length).toBeGreaterThan(0);

      const jpeg = await service.convert(pngBuffer, { format: 'jpeg', quality: 85 });
      expect(jpeg.format).toBe('jpeg');
      expect(jpeg.mimeType).toBe('image/jpeg');

      const avif = await service.convert(pngBuffer, { format: 'avif', quality: 75 });
      expect(avif.format).toBe('avif');
      expect(avif.mimeType).toBe('image/avif');
    });

    it('applies filters: blur, grayscale, tint, normalize', async () => {
      const buffer = await createTestImage(100, 100, 'png');

      const filtered = await service.process(buffer, {
        grayscale: true,
        blur: 1.5,
        sharpen: true,
        normalize: true,
      });

      expect(filtered.width).toBe(100);
      expect(filtered.height).toBe(100);
    });

    it('accepts a bare sharpen sigma, same as processImageSchema sends', async () => {
      const buffer = await createTestImage(100, 100, 'png');

      // A number used to fall through to the boolean-false branch silently —
      // this just has to not throw and to still produce a valid image.
      const filtered = await service.process(buffer, { sharpen: 2.5 });

      expect(filtered.width).toBe(100);
      expect(filtered.height).toBe(100);
    });

    it('rejects a resize target beyond the maximum allowed output dimensions', async () => {
      const buffer = await createTestImage(100, 100, 'png');

      await expect(
        service.resize(buffer, { width: 50_000, height: 200 }),
      ).rejects.toThrow(InvalidDimensionsException);
      await expect(
        service.resize(buffer, { width: 200, height: 50_000 }),
      ).rejects.toThrow(InvalidDimensionsException);
    });

    it('generates standardized thumbnails and variant batches', async () => {
      const buffer = await createTestImage(800, 800, 'png');

      const thumb = await service.generateThumbnail(buffer);
      expect(thumb.width).toBe(320);
      expect(thumb.height).toBe(320);
      expect(thumb.format).toBe('webp');

      const variants = await service.generateVariants(buffer, ['thumbnail', 'small', 'medium']);
      expect(variants['thumbnail']).toBeDefined();
      expect(variants['small']).toBeDefined();
      expect(variants['medium']).toBeDefined();
      expect(variants['thumbnail'].width).toBe(320);
    });

    it('processes avatar with standardized square dimensions', async () => {
      const buffer = await createTestImage(600, 400, 'jpeg');
      const { main, variants } = await service.processAvatar(buffer, 256);

      expect(main.width).toBe(256);
      expect(main.height).toBe(256);
      expect(main.format).toBe('webp');
      expect(variants[32]).toBeDefined();
      expect(variants[64]).toBeDefined();
      expect(variants[128]).toBeDefined();
      expect(variants[512]).toBeDefined();
      expect(variants[32].width).toBe(32);
      expect(variants[512].width).toBe(512);
    });

    it('composites overlays with blending and positioning', async () => {
      const base = await createTestImage(400, 400, 'png');
      const badge = await createTestImage(80, 80, 'png');

      const result = await service.composite(base, [
        {
          input: badge,
          gravity: 'southeast',
          blend: 'over',
        },
      ]);

      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });
  });
});
