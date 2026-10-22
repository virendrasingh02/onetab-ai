import { describe, expect, it } from 'vitest';
import { parseReminder } from './slash-remind-parse.js';

// Wednesday 2026-10-21 10:00 local
const now = new Date(2026, 9, 21, 10, 0, 0);

describe('parseReminder', () => {
  it('parses relative offsets', () => {
    const r = parseReminder('me to call Bob in 30 minutes', now);
    expect(r?.who).toBe('me');
    expect(r?.what).toBe('call Bob');
    expect(r?.remindAt.getTime()).toBe(now.getTime() + 30 * 60_000);
  });

  it('parses tomorrow with a time', () => {
    const r = parseReminder('me submit report tomorrow at 9am', now);
    expect(r?.what).toBe('submit report');
    expect(r?.remindAt).toEqual(new Date(2026, 9, 22, 9, 0, 0));
  });

  it('rolls a past "at" time to tomorrow', () => {
    const r = parseReminder('me stretch at 8:30am', now);
    expect(r?.remindAt).toEqual(new Date(2026, 9, 22, 8, 30, 0));
  });

  it('returns who for a mention', () => {
    expect(parseReminder('@ana send deck at 3pm', now)?.who).toEqual({
      mention: 'ana',
    });
  });

  it('returns null without a time', () => {
    expect(parseReminder('me do the thing', now)).toBeNull();
  });
});
