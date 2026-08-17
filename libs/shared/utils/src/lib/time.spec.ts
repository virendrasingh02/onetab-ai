import {
  describeTimezone,
  formatTimeInZone,
  formatZoneDifference,
  formatZoneOffset,
  isValidTimezone,
  listTimezones,
  zoneOffsetMinutes,
} from './time.js';

/** 2026-08-17T12:00:00Z — inside northern-hemisphere summer time. */
const SUMMER = new Date('2026-08-17T12:00:00.000Z');
/** 2026-01-17T12:00:00Z — the same clock reading, in winter. */
const WINTER = new Date('2026-01-17T12:00:00.000Z');

describe('formatTimeInZone', () => {
  it('renders the wall clock of the zone, not the runner', () => {
    expect(formatTimeInZone(SUMMER, 'UTC')).toBe('12:00');
    expect(formatTimeInZone(SUMMER, 'Asia/Kolkata')).toBe('17:30');
    expect(formatTimeInZone(SUMMER, 'America/New_York')).toBe('08:00');
  });

  it('stays 24-hour so it matches the app’s other timestamps', () => {
    expect(formatTimeInZone(new Date('2026-08-17T23:05:00Z'), 'UTC')).toBe('23:05');
    expect(formatTimeInZone(new Date('2026-08-17T00:05:00Z'), 'UTC')).toBe('00:05');
  });

  it('adds seconds on request', () => {
    expect(formatTimeInZone(new Date('2026-08-17T12:00:07Z'), 'UTC', { seconds: true })).toBe(
      '12:00:07',
    );
  });

  it('falls back to local formatting for an unknown zone', () => {
    expect(formatTimeInZone(SUMMER, 'Mars/Olympus')).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('zoneOffsetMinutes', () => {
  it('reads half-hour and quarter-hour zones exactly', () => {
    expect(zoneOffsetMinutes('Asia/Kolkata', SUMMER)).toBe(330);
    expect(zoneOffsetMinutes('Asia/Kathmandu', SUMMER)).toBe(345);
  });

  it('follows daylight saving rather than a fixed offset', () => {
    expect(zoneOffsetMinutes('Europe/London', SUMMER)).toBe(60);
    expect(zoneOffsetMinutes('Europe/London', WINTER)).toBe(0);
  });

  it('is zero for UTC and for an unknown zone', () => {
    expect(zoneOffsetMinutes('UTC', SUMMER)).toBe(0);
    expect(zoneOffsetMinutes('Nowhere/Fictional', SUMMER)).toBe(0);
  });
});

describe('formatZoneOffset', () => {
  it('labels whole, fractional and zero offsets', () => {
    expect(formatZoneOffset('Asia/Kolkata', SUMMER)).toBe('GMT+5:30');
    expect(formatZoneOffset('Asia/Tokyo', SUMMER)).toBe('GMT+9');
    expect(formatZoneOffset('UTC', SUMMER)).toBe('GMT');
  });

  it('uses a minus sign for zones behind UTC', () => {
    expect(formatZoneOffset('America/New_York', SUMMER)).toBe('GMT−4');
  });
});

describe('formatZoneDifference', () => {
  it('describes the gap in the viewer’s direction', () => {
    expect(formatZoneDifference('Asia/Tokyo', 'UTC', SUMMER)).toBe('9h ahead');
    expect(formatZoneDifference('America/New_York', 'UTC', SUMMER)).toBe('4h behind');
  });

  it('includes the minutes of a fractional gap', () => {
    expect(formatZoneDifference('Asia/Kolkata', 'UTC', SUMMER)).toBe('5h 30m ahead');
  });

  it('says so when the zones agree at that instant', () => {
    expect(formatZoneDifference('Europe/London', 'UTC', WINTER)).toBe('same time as you');
  });
});

describe('describeTimezone', () => {
  it('leads with the city and un-escapes underscores', () => {
    expect(describeTimezone('America/New_York')).toBe('New York, America');
    expect(describeTimezone('Asia/Kolkata')).toBe('Kolkata, Asia');
  });

  it('passes single-segment zones through', () => {
    expect(describeTimezone('UTC')).toBe('UTC');
  });
});

describe('isValidTimezone', () => {
  it('accepts IANA ids and rejects anything else', () => {
    expect(isValidTimezone('Europe/Berlin')).toBe(true);
    expect(isValidTimezone('Europe/Atlantis')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });
});

describe('listTimezones', () => {
  it('is sorted, includes UTC, and has no duplicates', () => {
    const zones = listTimezones();
    expect(zones).toContain('UTC');
    expect(zones).toEqual([...zones].sort((a, b) => a.localeCompare(b)));
    expect(new Set(zones).size).toBe(zones.length);
  });
});
