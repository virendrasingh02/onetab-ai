import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcMain: {}, nativeTheme: {}, WebContentsView: class {} }));

const { FIND_BAR_CHANNEL, findBarBounds, findBarHtml, formatFindCount } = await import('./find-bar.js');

describe('formatFindCount', () => {
  it('is empty before a search, then counts', () => {
    expect(formatFindCount(null)).toBe('');
    expect(formatFindCount({ activeMatchOrdinal: 3, matches: 12 })).toBe('3 of 12');
    expect(formatFindCount({ activeMatchOrdinal: 0, matches: 0 })).toBe('No results');
  });
});

describe('findBarBounds', () => {
  it('pins the bar top-right, below the title strip', () => {
    expect(findBarBounds(1380)).toEqual({ x: 1380 - 360 - 16, y: 40, width: 360, height: 44 });
  });

  it('shrinks rather than overflowing a narrow window', () => {
    const bounds = findBarBounds(300);
    expect(bounds.x).toBeGreaterThanOrEqual(16);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(300 - 16);
  });
});

describe('find bar page', () => {
  it('loads nothing from the network', () => {
    const html = findBarHtml(false);
    expect(html).not.toMatch(/<(script|link|img)[^>]+(src|href)=/i);
    expect(findBarHtml(true)).not.toBe(html);
  });

  it('uses the same channels as its sandboxed preload', () => {
    const preload = readFileSync(join(import.meta.dirname, '..', 'find-preload.ts'), 'utf8');
    for (const channel of Object.values(FIND_BAR_CHANNEL)) expect(preload).toContain(`'${channel}'`);
  });
});
