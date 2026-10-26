import { describe, expect, it } from 'vitest';
import {
  canSeeWith,
  computeProfileCompletion,
  isValidMonthDay,
  nextAnniversary,
  nextOccurrence,
  normalizeCelebrationPrefs,
  normalizePrivacy,
  parseYMD,
  todayInZone,
  yearsOfService,
} from './people.js';

const ymd = (s: string) =>
  parseYMD(s) as NonNullable<ReturnType<typeof parseYMD>>;

describe('nextOccurrence', () => {
  it('returns today when the date is today', () => {
    expect(nextOccurrence(3, 4, ymd('2026-03-04'))).toEqual({
      y: 2026,
      m: 3,
      d: 4,
    });
  });
  it('rolls to next year once passed', () => {
    expect(nextOccurrence(3, 4, ymd('2026-03-05'))).toEqual({
      y: 2027,
      m: 3,
      d: 4,
    });
  });
  it('maps Feb 29 to Feb 28 in non-leap years and keeps it in leap years', () => {
    expect(nextOccurrence(2, 29, ymd('2026-01-10'))).toEqual({
      y: 2026,
      m: 2,
      d: 28,
    });
    expect(nextOccurrence(2, 29, ymd('2028-01-10'))).toEqual({
      y: 2028,
      m: 2,
      d: 29,
    });
  });
});

describe('years of service / anniversaries', () => {
  it('counts completed years only', () => {
    expect(yearsOfService(ymd('2020-06-15'), ymd('2026-06-14'))).toBe(5);
    expect(yearsOfService(ymd('2020-06-15'), ymd('2026-06-15'))).toBe(6);
  });
  it('handles a Feb 29 joiner in a non-leap year', () => {
    expect(yearsOfService(ymd('2020-02-29'), ymd('2023-02-27'))).toBe(2);
    expect(yearsOfService(ymd('2020-02-29'), ymd('2023-02-28'))).toBe(3);
  });
  it('is zero before the start date', () => {
    expect(yearsOfService(ymd('2030-01-01'), ymd('2026-01-01'))).toBe(0);
  });
  it('a joiner this year has their first anniversary next year', () => {
    const a = nextAnniversary(ymd('2026-09-01'), ymd('2026-10-26'));
    expect(a.date).toEqual({ y: 2027, m: 9, d: 1 });
    expect(a.years).toBe(1);
    expect(a.isMilestone).toBe(true);
  });
  it('flags milestones', () => {
    expect(
      nextAnniversary(ymd('2021-11-01'), ymd('2026-10-26')).isMilestone,
    ).toBe(true); // 5
    expect(
      nextAnniversary(ymd('2022-11-01'), ymd('2026-10-26')).isMilestone,
    ).toBe(false); // 4
  });
});

describe('todayInZone', () => {
  it('reads the calendar date in the given zone', () => {
    const now = new Date('2026-10-26T23:30:00Z');
    expect(todayInZone(now, 'UTC')).toMatchObject({
      y: 2026,
      m: 10,
      d: 26,
      hour: 23,
    });
    expect(todayInZone(now, 'Asia/Kolkata')).toMatchObject({
      y: 2026,
      m: 10,
      d: 27,
      hour: 5,
    });
  });
  it('falls back to UTC for an invalid zone', () => {
    expect(todayInZone(new Date('2026-10-26T10:00:00Z'), 'Not/AZone').d).toBe(
      26,
    );
  });
});

describe('validation helpers', () => {
  it('validates month/day, allowing Feb 29', () => {
    expect(isValidMonthDay(2, 29)).toBe(true);
    expect(isValidMonthDay(2, 30)).toBe(false);
    expect(isValidMonthDay(13, 1)).toBe(false);
  });
  it('rejects impossible dates', () => {
    expect(parseYMD('2026-02-30')).toBeNull();
    expect(parseYMD('nope')).toBeNull();
  });
});

describe('privacy', () => {
  it('defaults to private birthday and hidden year', () => {
    expect(normalizePrivacy(undefined)).toMatchObject({
      birthday: 'PRIVATE',
      hideBirthYear: true,
    });
    expect(normalizePrivacy({ birthday: 'bogus' }).birthday).toBe('PRIVATE');
  });
  it('audience rules', () => {
    expect(canSeeWith('PRIVATE', { isSelf: false, sameTeam: true })).toBe(
      false,
    );
    expect(canSeeWith('PRIVATE', { isSelf: true, sameTeam: false })).toBe(true);
    expect(canSeeWith('TEAM', { isSelf: false, sameTeam: true })).toBe(true);
    expect(canSeeWith('TEAM', { isSelf: false, sameTeam: false })).toBe(false);
    expect(canSeeWith('WORKSPACE', { isSelf: false, sameTeam: false })).toBe(
      true,
    );
  });
  it('rejects unsupported lead times', () => {
    expect(normalizeCelebrationPrefs({ daysBefore: 5 }).daysBefore).toBe(0);
    expect(normalizeCelebrationPrefs({ daysBefore: 3 }).daysBefore).toBe(3);
  });
});

describe('computeProfileCompletion', () => {
  it('is dynamic and optional fields never lower the score', () => {
    const empty = computeProfileCompletion({});
    expect(empty.percent).toBe(0);
    const full = computeProfileCompletion({
      avatarUrl: 'x',
      name: 'A',
      jobTitle: 'Eng',
      location: 'Pune',
      timezone: 'Asia/Kolkata',
      bio: 'hi',
      skills: ['ts'],
      department: 'R&D',
      team: 'Core',
      joiningDate: '2020-01-01',
    });
    expect(full.percent).toBe(100);
    expect(full.missing.map((m) => m.key)).toEqual([
      'phone',
      'interests',
      'links',
      'birthday',
    ]);
  });
  it('filled optional fields add credit', () => {
    const a = computeProfileCompletion({ name: 'A' });
    const b = computeProfileCompletion({ name: 'A', phone: '1' });
    expect(b.percent).toBeGreaterThan(a.percent);
  });
});
