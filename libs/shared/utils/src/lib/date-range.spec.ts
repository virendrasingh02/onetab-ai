import {
  DATE_RANGE_PRESETS,
  getDateRangeLabel,
  parseDateRangeParams,
  parseIsoDay,
  resolveDateRange,
  resolveQueryWindow,
  toDateRangeQuery,
  writeDateRangeParams,
  type DateRangePreset,
} from './date-range.js';

/** Thursday 24 Sep 2026, mid-afternoon local time. */
const NOW = new Date(2026, 8, 24, 15, 30);

function query(preset: DateRangePreset, weekStartsOn: 0 | 1 = 0) {
  return toDateRangeQuery({ preset }, { now: NOW, weekStartsOn });
}

describe('resolveDateRange presets', () => {
  it.each<[DateRangePreset, string, string]>([
    ['today', '2026-09-24', '2026-09-24'],
    ['yesterday', '2026-09-23', '2026-09-23'],
    ['last_7_days', '2026-09-18', '2026-09-24'],
    ['last_30_days', '2026-08-26', '2026-09-24'],
    ['last_90_days', '2026-06-27', '2026-09-24'],
    ['this_week', '2026-09-20', '2026-09-24'],
    ['last_week', '2026-09-13', '2026-09-19'],
    ['this_month', '2026-09-01', '2026-09-24'],
    ['last_month', '2026-08-01', '2026-08-31'],
  ])('%s → %s…%s', (preset, from, to) => {
    expect(query(preset)).toEqual({ from, to });
  });

  it('honours a Monday week start', () => {
    expect(query('this_week', 1)).toEqual({ from: '2026-09-21', to: '2026-09-24' });
    expect(query('last_week', 1)).toEqual({ from: '2026-09-14', to: '2026-09-20' });
  });

  it('counts inclusive days', () => {
    expect(resolveDateRange({ preset: 'last_7_days' }, { now: NOW }).days).toBe(7);
    expect(resolveDateRange({ preset: 'today' }, { now: NOW }).days).toBe(1);
  });

  it('covers every advertised preset', () => {
    for (const { id } of DATE_RANGE_PRESETS) {
      expect(() => resolveDateRange({ preset: id }, { now: NOW })).not.toThrow();
    }
  });
});

describe('custom ranges', () => {
  it('keeps the chosen calendar days exactly', () => {
    expect(
      toDateRangeQuery(
        { preset: 'custom', from: '2026-09-01', to: '2026-09-10' },
        { now: NOW },
      ),
    ).toEqual({ from: '2026-09-01', to: '2026-09-10' });
  });

  it('normalises a reversed pick', () => {
    expect(
      toDateRangeQuery(
        { preset: 'custom', from: '2026-09-10', to: '2026-09-01' },
        { now: NOW },
      ),
    ).toEqual({ from: '2026-09-01', to: '2026-09-10' });
  });

  it('labels a custom range by its span', () => {
    expect(
      getDateRangeLabel({ preset: 'custom', from: '2026-09-01', to: '2026-09-24' }),
    ).toBe('Sep 1, 2026 – Sep 24, 2026');
    expect(getDateRangeLabel({ preset: 'last_30_days' })).toBe('Last 30 days');
  });
});

describe('parseIsoDay', () => {
  it('parses as local midnight, never UTC', () => {
    const d = parseIsoDay('2026-09-01');
    expect(d?.getDate()).toBe(1);
    expect(d?.getHours()).toBe(0);
  });

  it('rejects impossible and malformed dates', () => {
    expect(parseIsoDay('2026-02-30')).toBeNull();
    expect(parseIsoDay('2026-9-1')).toBeNull();
    expect(parseIsoDay('2026-09-01T00:00:00Z')).toBeNull();
    expect(parseIsoDay(undefined)).toBeNull();
  });
});

describe('URL params round-trip', () => {
  it('round-trips presets and custom ranges', () => {
    const preset = writeDateRangeParams(new URLSearchParams('tab=x'), {
      preset: 'last_7_days',
    });
    expect(preset.get('tab')).toBe('x');
    expect(parseDateRangeParams(preset)).toEqual({ preset: 'last_7_days' });

    const custom = writeDateRangeParams(preset, {
      preset: 'custom',
      from: '2026-09-01',
      to: '2026-09-02',
    });
    expect(parseDateRangeParams(custom)).toEqual({
      preset: 'custom',
      from: '2026-09-01',
      to: '2026-09-02',
    });

    // Switching back to a preset clears the custom bounds.
    const back = writeDateRangeParams(custom, { preset: 'today' });
    expect(back.has('from')).toBe(false);
  });

  it('falls back on garbage', () => {
    expect(parseDateRangeParams(new URLSearchParams('range=nope'))).toEqual({
      preset: 'last_30_days',
    });
    expect(
      parseDateRangeParams(new URLSearchParams('range=custom&from=bad&to=2026-01-01')),
    ).toEqual({ preset: 'last_30_days' });
  });
});

describe('resolveQueryWindow', () => {
  it('builds a half-open window from explicit days', () => {
    const w = resolveQueryWindow({ from: '2026-09-01', to: '2026-09-10' }, { now: NOW });
    expect(w.days).toBe(10);
    expect(w.since).toEqual(new Date(2026, 8, 1));
    expect(w.until).toEqual(new Date(2026, 8, 11));
    expect(w.previousSince).toEqual(new Date(2026, 7, 22));
  });

  it('falls back to a trailing window of `days`', () => {
    const w = resolveQueryWindow({ days: 7 }, { now: NOW });
    expect(w.since).toEqual(new Date(2026, 8, 18));
    expect(w.until).toEqual(new Date(2026, 8, 25));
  });

  it('caps the scan length', () => {
    const w = resolveQueryWindow(
      { from: '2020-01-01', to: '2026-09-24' },
      { now: NOW, maxDays: 30 },
    );
    expect(w.days).toBe(30);
    expect(w.since).toEqual(new Date(2026, 7, 26));
  });
});
