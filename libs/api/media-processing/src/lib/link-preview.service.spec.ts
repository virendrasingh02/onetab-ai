import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkPreviewService } from './link-preview.service.js';

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;
  let mockCache: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };
    service = new LinkPreviewService(mockCache as any);
  });

  describe('URL Normalization', () => {
    it('normalizes scheme and hostname to lowercase', () => {
      const normalized = service.normalizeUrl('HTTPS://EXAMPLE.COM/Path');
      expect(normalized).toBe('https://example.com/Path');
    });

    it('strips tracking parameters (utm_*, fbclid, gclid, ref, etc.)', () => {
      const raw =
        'https://example.com/article?utm_source=twitter&utm_medium=social&utm_campaign=launch&fbclid=12345&gclid=67890&ref=producthunt&valid_param=keep_me';
      const normalized = service.normalizeUrl(raw);
      expect(normalized).toBe('https://example.com/article?valid_param=keep_me');
    });

    it('removes URL fragments', () => {
      const raw = 'https://example.com/docs/intro#section-2';
      const normalized = service.normalizeUrl(raw);
      expect(normalized).toBe('https://example.com/docs/intro');
    });

    it('removes default ports (:80 for http and :443 for https)', () => {
      expect(service.normalizeUrl('http://example.com:80/home')).toBe(
        'http://example.com/home',
      );
      expect(service.normalizeUrl('https://example.com:443/home')).toBe(
        'https://example.com/home',
      );
      expect(service.normalizeUrl('https://example.com:8443/home')).toBe(
        'https://example.com:8443/home',
      );
    });

    it('normalizes trailing slash on root URL', () => {
      expect(service.normalizeUrl('https://example.com/')).toBe(
        'https://example.com',
      );
    });
  });

  describe('SSRF Protection - IP & Host Validation', () => {
    it('blocks loopback IPv4 addresses (127.0.0.0/8)', () => {
      expect(service.isPrivateOrBlockedIp('127.0.0.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('127.1.2.3')).toBe(true);
    });

    it('blocks RFC 1918 private IPv4 addresses (10.x, 172.16-31.x, 192.168.x)', () => {
      expect(service.isPrivateOrBlockedIp('10.0.0.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('10.255.255.254')).toBe(true);
      expect(service.isPrivateOrBlockedIp('172.16.0.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('172.31.255.255')).toBe(true);
      expect(service.isPrivateOrBlockedIp('192.168.1.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('192.168.0.254')).toBe(true);
    });

    it('blocks cloud metadata IP (169.254.169.254) and link-local', () => {
      expect(service.isPrivateOrBlockedIp('169.254.169.254')).toBe(true);
      expect(service.isPrivateOrBlockedIp('169.254.0.1')).toBe(true);
    });

    it('blocks Carrier-grade NAT (100.64.0.0/10)', () => {
      expect(service.isPrivateOrBlockedIp('100.64.0.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('100.127.255.254')).toBe(true);
    });

    it('blocks multicast and broadcast IPv4 addresses', () => {
      expect(service.isPrivateOrBlockedIp('224.0.0.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('255.255.255.255')).toBe(true);
      expect(service.isPrivateOrBlockedIp('0.0.0.0')).toBe(true);
    });

    it('blocks IPv6 loopback, unspecified, and unique local addresses', () => {
      expect(service.isPrivateOrBlockedIp('::1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('::')).toBe(true);
      expect(service.isPrivateOrBlockedIp('fc00::1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('fd12:3456:789a::1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('fe80::1')).toBe(true);
    });

    it('blocks IPv4-mapped IPv6 addresses for private ranges', () => {
      expect(service.isPrivateOrBlockedIp('::ffff:127.0.0.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('::ffff:10.0.0.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('::ffff:192.168.1.1')).toBe(true);
      expect(service.isPrivateOrBlockedIp('::ffff:169.254.169.254')).toBe(true);
    });

    it('allows public IPv4 addresses', () => {
      expect(service.isPrivateOrBlockedIp('8.8.8.8')).toBe(false);
      expect(service.isPrivateOrBlockedIp('1.1.1.1')).toBe(false);
      expect(service.isPrivateOrBlockedIp('93.184.216.34')).toBe(false);
      expect(service.isPrivateOrBlockedIp('140.82.121.3')).toBe(false);
    });

    it('rejects disallowed protocols (ftp, file, javascript, data)', async () => {
      await expect(
        service.validateUrlSecurity(new URL('ftp://example.com')),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateUrlSecurity(new URL('file:///etc/passwd')),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateUrlSecurity(new URL('javascript:alert(1)')),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects URLs containing username and password', async () => {
      await expect(
        service.validateUrlSecurity(new URL('https://admin:secret@example.com')),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks localhost and internal domains', async () => {
      await expect(
        service.validateUrlSecurity(new URL('http://localhost:3000')),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateUrlSecurity(new URL('http://app.local')),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateUrlSecurity(new URL('http://service.internal')),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateUrlSecurity(new URL('http://metadata.google.internal')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('HTML & Metadata Extraction', () => {
    it('extracts OpenGraph metadata correctly', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>HTML Title</title>
            <meta property="og:title" content="OpenGraph Title" />
            <meta property="og:description" content="OpenGraph Description" />
            <meta property="og:image" content="https://example.com/og-image.jpg" />
            <meta property="og:site_name" content="Example Site" />
            <meta property="og:type" content="article" />
            <link rel="icon" href="/assets/favicon.png" />
          </head>
          <body>Hello</body>
        </html>
      `;

      const meta = service.extractMetadata(html, 'https://example.com/post/1');
      expect(meta.title).toBe('OpenGraph Title');
      expect(meta.description).toBe('OpenGraph Description');
      expect(meta.image).toBe('https://example.com/og-image.jpg');
      expect(meta.siteName).toBe('Example Site');
      expect(meta.mediaType).toBe('article');
      expect(meta.domain).toBe('example.com');
      expect(meta.favicon).toBe('https://example.com/assets/favicon.png');
    });

    it('falls back to Twitter card metadata if OpenGraph is absent', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Standard Title</title>
            <meta name="twitter:title" content="Twitter Title" />
            <meta name="twitter:description" content="Twitter Description" />
            <meta name="twitter:image" content="/images/twitter-card.png" />
          </head>
          <body></body>
        </html>
      `;

      const meta = service.extractMetadata(html, 'https://sub.domain.com/');
      expect(meta.title).toBe('Twitter Title');
      expect(meta.description).toBe('Twitter Description');
      expect(meta.image).toBe('https://sub.domain.com/images/twitter-card.png');
      expect(meta.domain).toBe('sub.domain.com');
    });

    it('falls back to HTML <title> and meta description when social tags are absent', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>My Simple Webpage</title>
            <meta name="description" content="A simple description of the webpage." />
            <link rel="shortcut icon" href="https://example.org/favicon.ico" />
          </head>
          <body></body>
        </html>
      `;

      const meta = service.extractMetadata(html, 'https://example.org/about');
      expect(meta.title).toBe('My Simple Webpage');
      expect(meta.description).toBe('A simple description of the webpage.');
      expect(meta.favicon).toBe('https://example.org/favicon.ico');
    });

    it('sanitizes HTML tags and entities in titles and descriptions', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="&lt;script&gt;alert('xss')&lt;/script&gt; <b>Bold &amp; Beautiful</b>" />
            <meta property="og:description" content="Click <a href='evil.com'>here</a> &quot;now&quot;!" />
          </head>
        </html>
      `;

      const meta = service.extractMetadata(html, 'https://example.com');
      expect(meta.title).not.toContain('<b>');
      expect(meta.title).toContain('Bold & Beautiful');
      expect(meta.description).not.toContain('<a');
      expect(meta.description).toContain('Click here "now"!');
    });
  });

  describe('Caching & Deduplication', () => {
    it('returns cached preview when present without re-fetching', async () => {
      const cachedPreview = {
        id: 'preview_123',
        url: 'https://example.com',
        normalizedUrl: 'https://example.com',
        title: 'Cached Title',
        domain: 'example.com',
        status: 'ready' as const,
        visibility: 'visible' as const,
      };

      mockCache.get.mockResolvedValue(cachedPreview);

      const result = await service.getPreview('https://example.com');
      expect(result).toEqual(cachedPreview);
      expect(mockCache.get).toHaveBeenCalledWith(
        'link-preview:https://example.com',
      );
    });

    it('stores message visibility override in cache', async () => {
      await service.setMessageVisibility('msg_456', 'hidden');
      expect(mockCache.set).toHaveBeenCalledWith(
        'link-preview:visibility:msg_456',
        'hidden',
        expect.any(Number),
      );
    });
  });
});
