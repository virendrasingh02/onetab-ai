import { Injectable } from '@nestjs/common';
import {
  IMAGE_SECURITY_LIMITS,
  SupportedInputFormat,
} from './image-processing.constants.js';
import {
  ImageTooLargeException,
  InvalidImageException,
  PixelLimitExceededException,
} from './image-processing.errors.js';

export interface SniffedImage {
  format: SupportedInputFormat;
  mimeType: string;
}

@Injectable()
export class ImageSecurityService {

  /**
   * Sniffs magic bytes to detect real format independent of file extensions.
   * Returns null if the buffer is not a supported image.
   */
  sniffFormat(buffer: Buffer): SniffedImage | null {
    if (!buffer || buffer.length < 4) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { format: 'jpeg', mimeType: 'image/jpeg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { format: 'png', mimeType: 'image/png' };
    }

    // GIF: GIF87a or GIF89a
    if (
      buffer.length >= 6 &&
      buffer.toString('ascii', 0, 4) === 'GIF8' &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      return { format: 'gif', mimeType: 'image/gif' };
    }

    // WebP: RIFF....WEBP
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return { format: 'webp', mimeType: 'image/webp' };
    }

    // AVIF: ....ftypavif or ....ftypavis
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      const brand = buffer.toString('ascii', 8, 12);
      if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
        return { format: 'avif', mimeType: 'image/avif' };
      }
    }

    // TIFF: II*. or MM.*
    if (
      (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
      (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
    ) {
      return { format: 'tiff', mimeType: 'image/tiff' };
    }

    // SVG: Look for <svg or <?xml ... <svg in the first 1024 bytes
    const head = buffer.slice(0, Math.min(buffer.length, 1024)).toString('utf8').trim();
    if (head.startsWith('<?xml') || head.includes('<svg')) {
      if (/<svg[\s>]/i.test(head)) {
        return { format: 'svg', mimeType: 'image/svg+xml' };
      }
    }

    return null;
  }

  /**
   * Asserts image file buffer meets basic size constraints.
   */
  assertFileSize(buffer: Buffer): void {
    if (!buffer || buffer.length === 0) {
      throw new InvalidImageException('Image buffer is empty.');
    }
    if (buffer.length > IMAGE_SECURITY_LIMITS.MAX_FILE_BYTES) {
      throw new ImageTooLargeException(
        buffer.length,
        IMAGE_SECURITY_LIMITS.MAX_FILE_BYTES,
      );
    }
  }

  /**
   * Validates dimensions before decode to stop decompression bombs.
   */
  assertDimensions(width?: number, height?: number): void {
    if (!width || !height) return;

    if (
      width > IMAGE_SECURITY_LIMITS.MAX_WIDTH ||
      height > IMAGE_SECURITY_LIMITS.MAX_HEIGHT
    ) {
      throw new PixelLimitExceededException(
        width,
        height,
        IMAGE_SECURITY_LIMITS.MAX_PIXELS,
      );
    }

    const pixels = width * height;
    if (pixels > IMAGE_SECURITY_LIMITS.MAX_PIXELS) {
      throw new PixelLimitExceededException(
        width,
        height,
        IMAGE_SECURITY_LIMITS.MAX_PIXELS,
      );
    }
  }

  /**
   * Validates SVG content against script injection, external entity expansion, and SSRF.
   */
  validateSvg(content: string | Buffer): void {
    const text = typeof content === 'string' ? content : content.toString('utf8');

    if (Buffer.byteLength(text, 'utf8') > IMAGE_SECURITY_LIMITS.MAX_SVG_BYTES) {
      throw new ImageTooLargeException(
        Buffer.byteLength(text, 'utf8'),
        IMAGE_SECURITY_LIMITS.MAX_SVG_BYTES,
      );
    }

    // Disallow XML entity definitions (XXE / billion laughs)
    if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*\[/i.test(text)) {
      throw new InvalidImageException('SVG contains forbidden entity definitions (XXE protection).');
    }

    // Disallow script tags
    if (/<script[\s>]/i.test(text) || /<\/script>/i.test(text)) {
      throw new InvalidImageException('SVG contains forbidden embedded executable scripts.');
    }

    // Disallow inline event handlers (onload, onclick, onerror, etc.)
    if (/\son[a-zA-Z]+\s*=/i.test(text)) {
      throw new InvalidImageException('SVG contains forbidden event handlers.');
    }

    // Disallow javascript: pseudo-protocol
    if (/href\s*=\s*["']?\s*javascript:/i.test(text) || /xlink:href\s*=\s*["']?\s*javascript:/i.test(text)) {
      throw new InvalidImageException('SVG contains forbidden javascript: URI references.');
    }

    // Disallow foreignObject tags that can embed arbitrary HTML
    if (/<foreignObject[\s>]/i.test(text)) {
      throw new InvalidImageException('SVG contains forbidden foreignObject elements.');
    }

    // Disallow external remote resource fetching (SSRF via SVG image hrefs)
    if (/(?:href|src)\s*=\s*["']?https?:\/\//i.test(text)) {
      throw new InvalidImageException('SVG contains forbidden external URL references.');
    }
  }

  /**
   * SSRF protection for remote URLs if platform ever imports from remote URLs.
   */
  assertSafeRemoteUrl(urlStr: string): void {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new InvalidImageException('Invalid URL protocol. Only http and https are allowed.');
      }
      const host = parsed.hostname.toLowerCase();
      // Block localhost, internal IP ranges (127.0.0.1, 10.x, 192.168.x, 172.16-31.x, 169.254.x, [::1])
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host.endsWith('.local') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.startsWith('169.254.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      ) {
        throw new InvalidImageException('Forbidden private or internal network address.');
      }
    } catch (e) {
      if (e instanceof InvalidImageException) throw e;
      throw new InvalidImageException('Invalid remote image URL.');
    }
  }
}
