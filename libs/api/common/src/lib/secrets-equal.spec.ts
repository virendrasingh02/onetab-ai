import { describe, expect, it } from 'vitest';
import { secretsEqual } from './tokens';

describe('secretsEqual', () => {
  it('matches identical secrets', () => {
    expect(secretsEqual('abc', 'abc')).toBe(true);
  });
  it('rejects different or different-length secrets', () => {
    expect(secretsEqual('abc', 'abd')).toBe(false);
    expect(secretsEqual('abc', 'abcd')).toBe(false);
  });
  it('never matches when either side is unset (unconfigured secret)', () => {
    expect(secretsEqual(undefined, undefined)).toBe(false);
    expect(secretsEqual('', '')).toBe(false);
    expect(secretsEqual('x', undefined)).toBe(false);
  });
});
