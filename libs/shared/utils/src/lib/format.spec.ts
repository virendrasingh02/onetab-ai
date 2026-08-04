import { formatBytes, formatCount } from './format.js';

describe('formatBytes', () => {
  it('reports whole bytes without a decimal point', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('scales to the largest fitting unit', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1_500_000)).toBe('1.4 MB');
  });

  it('treats non-positive and non-finite input as zero', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});

describe('formatCount', () => {
  it('leaves counts under a thousand alone', () => {
    expect(formatCount(999)).toBe('999');
  });

  it('abbreviates thousands and drops a trailing .0', () => {
    expect(formatCount(1250)).toBe('1.3k');
    expect(formatCount(2000)).toBe('2k');
  });

  it('abbreviates millions', () => {
    expect(formatCount(3_400_000)).toBe('3.4m');
  });
});
