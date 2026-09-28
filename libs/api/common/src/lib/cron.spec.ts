import { describe, expect, it } from 'vitest';
import { isCronDue, isValidCronExpression } from './cron.js';

describe('isCronDue', () => {
  const at = new Date(2026, 8, 28, 9, 30); // Mon 28 Sep 2026, 09:30 local

  it.each([
    ['* * * * *', true],
    ['30 9 * * *', true],
    ['*/15 * * * *', true],
    ['0 9 * * *', false],
    ['30 9 * * 1-5', true],
    ['30 9 * * 0,6', false],
    ['30 9 28 9 *', true],
    ['25-35/5 9 * * *', true],
  ])('%s → %s', (expression, expected) => {
    expect(isCronDue(expression, at)).toBe(expected);
  });

  it('never fires a malformed expression', () => {
    expect(isCronDue('30 9 * *', at)).toBe(false);
    expect(isValidCronExpression('30 9 * *')).toBe(false);
    expect(isValidCronExpression(' 0 9 * * 1 ')).toBe(true);
  });
});
