import { describe, expect, it } from 'vitest';
import { dueDatePresets, formatDueDate } from './due-date';

describe('due-date presets', () => {
  it('offers Friday and Monday from a Tuesday, all at end of day', () => {
    const tuesday = new Date(2026, 10, 17, 9, 30); // Tue 17 Nov 2026
    const presets = dueDatePresets(tuesday);
    expect(presets.map((p) => p.label)).toEqual([
      'Today',
      'Tomorrow',
      'This Friday',
      'Next Monday',
      'In 2 weeks',
    ]);
    expect(presets[2].date.getDate()).toBe(20);
    expect(presets[3].date.getDate()).toBe(23);
    for (const p of presets) expect(p.date.getHours()).toBe(23);
  });

  it('drops presets that would duplicate Tomorrow', () => {
    const thursday = new Date(2026, 10, 19, 9); // Friday is tomorrow
    expect(dueDatePresets(thursday).map((p) => p.label)).not.toContain(
      'This Friday',
    );
    const sunday = new Date(2026, 10, 22, 9); // Monday is tomorrow
    expect(dueDatePresets(sunday).map((p) => p.label)).not.toContain(
      'Next Monday',
    );
  });
});

describe('formatDueDate', () => {
  const now = new Date(2026, 10, 18, 10);
  it('labels near dates relatively and flags overdue', () => {
    expect(formatDueDate(new Date(2026, 10, 18, 23).toISOString(), now)).toBe(
      'Today',
    );
    expect(formatDueDate(new Date(2026, 10, 19, 1).toISOString(), now)).toBe(
      'Tomorrow',
    );
    expect(formatDueDate(new Date(2026, 10, 16).toISOString(), now)).toMatch(
      /^Overdue · /,
    );
    expect(formatDueDate('not-a-date', now)).toBe('No due date');
  });
});
