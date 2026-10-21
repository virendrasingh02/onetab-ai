import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatChatTime,
  formatDuration,
  formatLimit,
  initials,
  lastDaysRange,
  relativeTime,
  statusTone,
} from './format';

describe('format helpers', () => {
  it('formats relative time', () => {
    const now = Date.parse('2026-10-19T12:00:00Z');
    expect(relativeTime('2026-10-19T11:59:50Z', now)).toBe('just now');
    expect(relativeTime('2026-10-19T11:30:00Z', now)).toBe('30m ago');
    expect(relativeTime('2026-10-19T09:00:00Z', now)).toBe('3h ago');
    expect(relativeTime(null, now)).toBe('—');
  });

  it('formats sizes, durations and plan limits', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatDuration(450)).toBe('450ms');
    expect(formatDuration(75_000)).toBe('1m 15s');
    expect(formatLimit(3, -1)).toBe('3 / Unlimited');
    expect(formatLimit(3, 10, 'GB')).toBe('3 / 10 GB');
  });

  it('formats WhatsApp-style chat timestamps', () => {
    const now = new Date('2026-10-21T15:00:00Z').getTime();
    // Today
    const today = new Date('2026-10-21T11:30:00Z');
    expect(formatChatTime(today, now)).toBeTruthy();
    // Yesterday
    const yesterday = new Date('2026-10-20T14:00:00Z');
    expect(formatChatTime(yesterday, now)).toBe('Yesterday');
    // Empty
    expect(formatChatTime(null, now)).toBe('');
  });

  it('derives initials and status tones', () => {
    expect(initials('Ana Maria Lopez')).toBe('AL');
    expect(initials('')).toBe('?');
    expect(statusTone('SUCCESS')).toBe('success');
    expect(statusTone('waiting_approval')).toBe('warning');
    expect(statusTone('RUNNING')).toBe('info');
    expect(statusTone('FAILED')).toBe('danger');
  });

  it('builds an analytics date range', () => {
    const range = lastDaysRange(7, new Date('2026-10-19T00:00:00Z'));
    expect(range).toEqual({
      from: '2026-10-12T00:00:00.000Z',
      to: '2026-10-19T00:00:00.000Z',
    });
  });
});
