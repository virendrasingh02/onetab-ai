import { describe, expect, it } from 'vitest';
import { describeReminderTime, reminderPresets } from './reminder-presets.js';

describe('reminderPresets', () => {
  // Wednesday 2026-09-23, 14:30 local time.
  const now = new Date(2026, 8, 23, 14, 30, 0);

  it('offers relative times from now', () => {
    const [twenty, hour, three] = reminderPresets(now);
    expect(twenty.at.getTime() - now.getTime()).toBe(20 * 60_000);
    expect(hour.at.getTime() - now.getTime()).toBe(60 * 60_000);
    expect(three.at.getTime() - now.getTime()).toBe(180 * 60_000);
  });

  it('puts "tomorrow" at 9:00 the next morning', () => {
    const tomorrow = reminderPresets(now).find((p) => p.id === 'tomorrow');
    expect(tomorrow?.at).toEqual(new Date(2026, 8, 24, 9, 0, 0));
  });

  it('puts "next week" at 9:00 on the coming Monday', () => {
    const nextWeek = reminderPresets(now).find((p) => p.id === 'next-week');
    expect(nextWeek?.at).toEqual(new Date(2026, 8, 28, 9, 0, 0));
  });

  it('never lands "next week" on today when today is Monday', () => {
    const monday = new Date(2026, 8, 28, 8, 0, 0);
    const nextWeek = reminderPresets(monday).find((p) => p.id === 'next-week');
    expect(nextWeek?.at).toEqual(new Date(2026, 9, 5, 9, 0, 0));
  });
});

describe('describeReminderTime', () => {
  const now = new Date(2026, 8, 23, 14, 30, 0);

  it('says today / tomorrow for the next two days', () => {
    expect(describeReminderTime(new Date(2026, 8, 23, 15, 0), now)).toMatch(/^today at /);
    expect(describeReminderTime(new Date(2026, 8, 24, 9, 0), now)).toMatch(/^tomorrow at /);
  });
});
