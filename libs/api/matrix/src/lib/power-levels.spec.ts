import { describe, expect, it } from 'vitest';
import { samePowerLevels } from './matrix-admin.service.js';

describe('samePowerLevels', () => {
  const base = {
    events_default: 0,
    events: { 'm.room.name': 50, 'm.room.pinned_events': 0 },
    users: { '@a:hs': 100 },
  };

  it('treats key order and a missing events_default as equal', () => {
    expect(
      samePowerLevels(base, {
        users: { '@a:hs': 100 },
        events: { 'm.room.pinned_events': 0, 'm.room.name': 50 },
      }),
    ).toBe(true);
  });

  it('spots a new, changed or removed level', () => {
    expect(
      samePowerLevels(base, { ...base, events: { 'm.room.name': 50 } }),
    ).toBe(false);
    expect(samePowerLevels(base, { ...base, events_default: 50 })).toBe(false);
    expect(samePowerLevels(base, { ...base, users: { '@a:hs': 50 } })).toBe(
      false,
    );
  });
});
