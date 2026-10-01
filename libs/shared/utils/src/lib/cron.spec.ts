import { describe, expect, it } from 'vitest';
import { cronMatches, isValidCron, nextCronRun, parseScheduleText, zonedParts } from './cron.js';

describe('cronMatches', () => {
  it('reads the schedule in the given time zone', () => {
    // 12:30 UTC is 18:00 in Kolkata (UTC+5:30).
    const at = new Date('2026-09-30T12:30:00Z');
    expect(cronMatches('0 18 * * *', at, 'Asia/Kolkata')).toBe(true);
    expect(cronMatches('0 18 * * *', at, 'UTC')).toBe(false);
    expect(cronMatches('30 12 * * *', at, 'UTC')).toBe(true);
  });

  it('supports weekday ranges and lists', () => {
    const wednesday = new Date('2026-09-30T09:00:00Z');
    expect(cronMatches('0 9 * * 1-5', wednesday, 'UTC')).toBe(true);
    expect(cronMatches('0 9 * * 0,6', wednesday, 'UTC')).toBe(false);
  });

  it('supports L for the last day of the month', () => {
    expect(cronMatches('0 17 L * *', new Date('2026-09-30T17:00:00Z'), 'UTC')).toBe(true);
    expect(cronMatches('0 17 L * *', new Date('2026-09-29T17:00:00Z'), 'UTC')).toBe(false);
    expect(cronMatches('0 17 L * *', new Date('2026-02-28T17:00:00Z'), 'UTC')).toBe(true);
  });

  it('falls back to the host clock for an unknown zone', () => {
    const at = new Date('2026-09-30T12:30:00Z');
    expect(zonedParts(at, 'Not/AZone')).toEqual(zonedParts(at));
  });
});

describe('nextCronRun', () => {
  it('finds the next weekday evening', () => {
    // Friday 20:00 UTC → next weekday 18:00 is Monday.
    const next = nextCronRun('0 18 * * 1-5', new Date('2026-10-02T20:00:00Z'), 'UTC');
    expect(next?.toISOString()).toBe('2026-10-05T18:00:00.000Z');
  });

  it('is strictly after the starting minute', () => {
    const next = nextCronRun('0 9 * * *', new Date('2026-09-30T09:00:00Z'), 'UTC');
    expect(next?.toISOString()).toBe('2026-10-01T09:00:00.000Z');
  });

  it('handles steps and zones', () => {
    const next = nextCronRun('*/15 * * * *', new Date('2026-09-30T10:07:00Z'), 'UTC');
    expect(next?.toISOString()).toBe('2026-09-30T10:15:00.000Z');
    const kolkata = nextCronRun('0 8 * * *', new Date('2026-09-30T00:00:00Z'), 'Asia/Kolkata');
    expect(kolkata?.toISOString()).toBe('2026-09-30T02:30:00.000Z');
  });

  it('returns null for an invalid expression', () => {
    expect(nextCronRun('0 9 * *')).toBeNull();
    expect(isValidCron('0 9 * *')).toBe(false);
    expect(isValidCron('0 18 * * 1-5')).toBe(true);
    expect(isValidCron('0 17 L * *')).toBe(true);
  });
});

describe('parseScheduleText', () => {
  it.each([
    ['Every morning create my todo list from today’s meetings', '0 8 * * *'],
    ['Prepare my daily work report at 6 PM', '0 18 * * *'],
    ['every weekday at 6:30pm', '30 18 * * 1-5'],
    ['Every evening create my daily report', '0 18 * * *'],
    ['Create a weekly project report every Friday afternoon', '0 14 * * 5'],
    ['each Monday morning', '0 8 * * 1'],
    ['every month-end', '0 17 L * *'],
    ['monthly at 10am', '0 10 1 * *'],
    ['check every hour', '0 * * * *'],
    ['every 2 hours', '0 */2 * * *'],
  ])('%s → %s', (text, cron) => {
    expect(parseScheduleText(text)?.cron).toBe(cron);
  });

  it('reports whether a clock time was stated', () => {
    expect(parseScheduleText('every weekday at 6 pm')?.explicitTime).toBe(true);
    expect(parseScheduleText('every weekday morning')?.explicitTime).toBe(false);
  });

  it('reports whether the words said when in the day at all', () => {
    expect(parseScheduleText('every weekday morning')?.timeGiven).toBe(true);
    expect(parseScheduleText('every 2 hours')?.timeGiven).toBe(true);
    // "Daily" alone only gets the 9 AM default — a plan's own hour should win.
    expect(parseScheduleText('Daily work report')).toEqual({ cron: '0 9 * * *', explicitTime: false, timeGiven: false });
  });

  it('returns null when there is no recurrence', () => {
    expect(parseScheduleText('Review my project and tell me what is blocked')).toBeNull();
    expect(parseScheduleText('Read this document and create a project plan')).toBeNull();
  });
});
