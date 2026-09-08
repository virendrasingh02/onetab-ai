import { describe, it, expect } from 'vitest';
import {
  isScheduledStatusActive,
  localWallClock,
  pickActiveScheduledStatus,
  scheduledStatusWindowEnd,
  type ScheduledStatusRule,
} from './scheduled-status.js';

function rule(over: Partial<ScheduledStatusRule> = {}): ScheduledStatusRule {
  return {
    id: 'r1',
    isEnabled: true,
    priority: 0,
    recurrence: 'WEEKDAYS',
    startAt: null,
    endAt: null,
    startMinute: 9 * 60,
    endMinute: 11 * 60,
    daysOfWeek: [],
    activeFrom: null,
    activeUntil: null,
    timezone: 'America/New_York',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

// 2026-09-08 is a Tuesday. 14:30 UTC = 10:30 America/New_York (EDT, -4).
const TUE_1030_NY = new Date('2026-09-08T14:30:00.000Z');
const TUE_0800_NY = new Date('2026-09-08T12:00:00.000Z');
const SAT_1030_NY = new Date('2026-09-12T14:30:00.000Z');

describe('localWallClock', () => {
  it('renders wall time in the given zone', () => {
    const l = localWallClock(TUE_1030_NY, 'America/New_York');
    expect(l.minuteOfDay).toBe(10 * 60 + 30);
    expect(l.dayOfWeek).toBe(2); // Tuesday
    expect(l.ymd).toBe('2026-09-08');
  });

  it('crosses the date line correctly', () => {
    const l = localWallClock(TUE_1030_NY, 'Asia/Tokyo'); // +9 → 23:30 same day
    expect(l.minuteOfDay).toBe(23 * 60 + 30);
    expect(l.ymd).toBe('2026-09-08');
  });
});

describe('isScheduledStatusActive — recurring', () => {
  it('WEEKDAYS 9–11 is active at Tue 10:30, not at 08:00, not on Saturday', () => {
    expect(isScheduledStatusActive(rule(), TUE_1030_NY)).toBe(true);
    expect(isScheduledStatusActive(rule(), TUE_0800_NY)).toBe(false);
    expect(isScheduledStatusActive(rule(), SAT_1030_NY)).toBe(false);
  });

  it('DAILY ignores the day of week', () => {
    expect(
      isScheduledStatusActive(rule({ recurrence: 'DAILY' }), SAT_1030_NY),
    ).toBe(true);
  });

  it('WEEKLY honours daysOfWeek', () => {
    expect(
      isScheduledStatusActive(
        rule({ recurrence: 'WEEKLY', daysOfWeek: [1, 3, 5] }),
        TUE_1030_NY,
      ),
    ).toBe(false);
    expect(
      isScheduledStatusActive(
        rule({ recurrence: 'WEEKLY', daysOfWeek: [2] }),
        TUE_1030_NY,
      ),
    ).toBe(true);
  });

  it('respects activeFrom / activeUntil instants', () => {
    expect(
      isScheduledStatusActive(
        rule({ activeFrom: '2026-09-10T00:00:00.000Z' }),
        TUE_1030_NY,
      ),
    ).toBe(false);
    expect(
      isScheduledStatusActive(
        rule({ activeUntil: '2026-09-01T00:00:00.000Z' }),
        TUE_1030_NY,
      ),
    ).toBe(false);
    expect(
      isScheduledStatusActive(
        rule({
          activeFrom: '2026-09-01T00:00:00.000Z',
          activeUntil: '2026-12-01T00:00:00.000Z',
        }),
        TUE_1030_NY,
      ),
    ).toBe(true);
  });

  it('is inactive when disabled or when the window does not increase', () => {
    expect(isScheduledStatusActive(rule({ isEnabled: false }), TUE_1030_NY)).toBe(
      false,
    );
    expect(
      isScheduledStatusActive(
        rule({ startMinute: 600, endMinute: 600 }),
        TUE_1030_NY,
      ),
    ).toBe(false);
  });
});

describe('isScheduledStatusActive — one-time', () => {
  const oneTime = rule({
    recurrence: 'ONE_TIME',
    startMinute: null,
    endMinute: null,
    startAt: '2026-09-08T14:00:00.000Z',
    endAt: '2026-09-08T15:00:00.000Z',
  });
  it('is active inside the absolute window only, end-exclusive', () => {
    expect(isScheduledStatusActive(oneTime, TUE_1030_NY)).toBe(true);
    expect(
      isScheduledStatusActive(oneTime, new Date('2026-09-08T15:00:00.000Z')),
    ).toBe(false);
    expect(
      isScheduledStatusActive(oneTime, new Date('2026-09-08T13:59:00.000Z')),
    ).toBe(false);
  });
});

describe('pickActiveScheduledStatus — conflict rule', () => {
  it('highest priority wins', () => {
    const low = rule({ id: 'low', priority: 1 });
    const high = rule({ id: 'high', priority: 5 });
    expect(pickActiveScheduledStatus([low, high], TUE_1030_NY)?.id).toBe('high');
  });

  it('ties break to the most recently updated, then id', () => {
    const older = rule({ id: 'a', updatedAt: '2026-09-01T00:00:00.000Z' });
    const newer = rule({ id: 'b', updatedAt: '2026-09-05T00:00:00.000Z' });
    expect(pickActiveScheduledStatus([older, newer], TUE_1030_NY)?.id).toBe('b');

    const sameTime1 = rule({ id: 'x', updatedAt: '2026-09-05T00:00:00.000Z' });
    const sameTime2 = rule({ id: 'y', updatedAt: '2026-09-05T00:00:00.000Z' });
    expect(
      pickActiveScheduledStatus([sameTime2, sameTime1], TUE_1030_NY)?.id,
    ).toBe('x');
  });

  it('returns null when nothing is active', () => {
    expect(pickActiveScheduledStatus([rule()], TUE_0800_NY)).toBeNull();
    expect(pickActiveScheduledStatus([], TUE_1030_NY)).toBeNull();
  });
});

describe('scheduledStatusWindowEnd', () => {
  it('recurring → today at endMinute, one-time → endAt', () => {
    expect(
      scheduledStatusWindowEnd(rule(), TUE_1030_NY).toISOString(),
    ).toBe('2026-09-08T15:00:00.000Z'); // 11:00 NY

    expect(
      scheduledStatusWindowEnd(
        rule({
          recurrence: 'ONE_TIME',
          endAt: '2026-09-08T18:00:00.000Z',
        }),
        TUE_1030_NY,
      ).toISOString(),
    ).toBe('2026-09-08T18:00:00.000Z');
  });
});
