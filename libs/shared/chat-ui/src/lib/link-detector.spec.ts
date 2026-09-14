import { describe, expect, it } from 'vitest';
import { detectLinks, normalizeUrl } from './link-detector.js';

describe('LinkDetector', () => {
  describe('detectLinks', () => {
    it('detects a single HTTP and HTTPS URL', () => {
      const text1 = 'Check out https://github.com for code.';
      const res1 = detectLinks(text1);
      expect(res1).toHaveLength(1);
      expect(res1[0].url).toBe('https://github.com');
      expect(res1[0].normalizedUrl).toBe('https://github.com');

      const text2 = 'Visit http://example.org today!';
      const res2 = detectLinks(text2);
      expect(res2).toHaveLength(1);
      expect(res2[0].url).toBe('http://example.org');
    });

    it('detects multiple links in the same message', () => {
      const text =
        'Here are two links: https://example.com and https://linear.app/issue/123';
      const res = detectLinks(text);
      expect(res).toHaveLength(2);
      expect(res[0].url).toBe('https://example.com');
      expect(res[1].url).toBe('https://linear.app/issue/123');
    });

    it('does not treat normal text as URLs', () => {
      const text = 'This is a message about example.com without protocol and file.txt or version 1.2.3';
      const res = detectLinks(text);
      expect(res).toHaveLength(0);
    });

    it('trims trailing punctuation from URLs', () => {
      const text = 'Look at this link (https://example.com/page), it is great. Also see https://test.com/path!';
      const res = detectLinks(text);
      expect(res).toHaveLength(2);
      expect(res[0].url).toBe('https://example.com/page');
      expect(res[1].url).toBe('https://test.com/path');
    });

    it('deduplicates identical URLs', () => {
      const text =
        'Duplicate link https://example.com and again https://example.com?utm_source=slack';
      const res = detectLinks(text);
      expect(res).toHaveLength(1);
      expect(res[0].url).toBe('https://example.com');
    });

    it('respects maxLinks limit', () => {
      const text =
        '1: https://a.com 2: https://b.com 3: https://c.com 4: https://d.com 5: https://e.com 6: https://f.com';
      const res = detectLinks(text, { maxLinks: 3 });
      expect(res).toHaveLength(3);
      expect(res.map((r) => r.url)).toEqual([
        'https://a.com',
        'https://b.com',
        'https://c.com',
      ]);
    });
  });

  describe('normalizeUrl', () => {
    it('strips tracking parameters while preserving content parameters', () => {
      const url =
        'https://youtube.com/watch?v=dQw4w9WgXcQ&utm_source=twitter&utm_medium=social&fbclid=abc';
      expect(normalizeUrl(url)).toBe(
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
      );
    });

    it('normalizes domain and removes fragments', () => {
      const url = 'HTTPS://EXAMPLE.COM:443/docs#heading-1';
      expect(normalizeUrl(url)).toBe('https://example.com/docs');
    });

    it('normalizes trailing slash on root', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    });
  });
});
