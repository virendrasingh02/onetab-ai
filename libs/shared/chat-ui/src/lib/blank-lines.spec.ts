import { describe, expect, it } from 'vitest';
import { compactBlankLineCount, compactBlankLines } from './blank-lines.js';

describe('compactBlankLineCount', () => {
  it('halves, rounds up and caps at 3', () => {
    expect([0, 1, 2, 3, 6, 20].map(compactBlankLineCount)).toEqual([
      0, 1, 1, 2, 3, 3,
    ]);
  });
});

describe('compactBlankLines', () => {
  const blanks = (n: number) => '\n'.repeat(n + 1);

  it('compacts each run independently', () => {
    expect(compactBlankLines(`a${blanks(1)}b`)).toBe(`a${blanks(1)}b`);
    expect(compactBlankLines(`a${blanks(6)}b${blanks(20)}c`)).toBe(
      `a${blanks(3)}b${blanks(3)}c`,
    );
  });

  it('treats whitespace-only lines as blank', () => {
    expect(compactBlankLines('a\n  \n\t\n \nb')).toBe('a\n\n\nb');
  });

  it('leaves blank lines inside fenced code alone', () => {
    const code = '```\nx\n\n\n\n\ny\n```';
    expect(compactBlankLines(`a\n\n\n\n\n\n\n${code}`)).toBe(`a\n\n\n\n${code}`);
  });
});
