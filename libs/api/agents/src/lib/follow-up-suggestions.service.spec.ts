import { describe, expect, it } from 'vitest';
import { parseFollowUps } from './follow-up-suggestions.service.js';

describe('parseFollowUps', () => {
  it('extracts, trims and de-duplicates suggestions from a fenced reply', () => {
    const raw = 'Sure:\n```json\n["Show overdue tasks", " show overdue tasks ", "Who owns RMM-1?"]\n```';
    expect(parseFollowUps(raw)).toEqual(['Show overdue tasks', 'Who owns RMM-1?']);
  });

  it('caps the list and drops non-strings and over-long items', () => {
    const raw = JSON.stringify(['a', 1, 'b', 'c', 'd', 'e', 'x'.repeat(200)]);
    expect(parseFollowUps(raw)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns nothing for unparseable output', () => {
    expect(parseFollowUps('no json here')).toEqual([]);
    expect(parseFollowUps('[oops')).toEqual([]);
  });
});
