import { describe, expect, it } from 'vitest';
import { resolveTextMentions, type MentionCandidate } from './mentions.js';

const members: MentionCandidate[] = [
  { id: 'u_ann', name: 'Ann', displayName: 'Ann Lee' },
  { id: 'u_bob', name: 'Bob Smith', displayName: null },
  { id: 'u_cara', name: 'cara', displayName: 'Cara' },
];

describe('resolveTextMentions', () => {
  it('returns nothing when there is no @', () => {
    expect(resolveTextMentions('just a normal comment', members)).toEqual([]);
  });

  it('matches a display name', () => {
    expect(resolveTextMentions('hey @Ann Lee can you look', members)).toEqual([
      'u_ann',
    ]);
  });

  it('matches on the fallback name when there is no display name', () => {
    expect(resolveTextMentions('ping @Bob Smith', members)).toEqual(['u_bob']);
  });

  it('is case-insensitive', () => {
    expect(resolveTextMentions('yo @CARA', members)).toEqual(['u_cara']);
  });

  it('prefers the longest matching name (@Ann Lee over @Ann)', () => {
    // "@Ann Lee" contains "@Ann" as a substring; only the full name should win
    // rather than every candidate whose name is a prefix.
    const onlyAnn = resolveTextMentions('@Ann Lee', members);
    expect(onlyAnn).toEqual(['u_ann']);
  });

  it('resolves several distinct people once each', () => {
    const ids = resolveTextMentions('@Ann Lee and @Cara and @Ann Lee again', members);
    expect(ids.sort()).toEqual(['u_ann', 'u_cara']);
  });

  it('drops an @handle that matches nobody', () => {
    expect(resolveTextMentions('@nobody here', members)).toEqual([]);
  });

  it('does not fire @Ann on @Annie (token boundary)', () => {
    expect(resolveTextMentions('welcome @Annie!', members)).toEqual([]);
  });

  it('does not fire on an email-like address', () => {
    expect(resolveTextMentions('reach me at bob@ann.example', members)).toEqual(
      [],
    );
  });

  it('matches at end of string with trailing punctuation', () => {
    expect(resolveTextMentions('done, thanks @Cara.', members)).toEqual([
      'u_cara',
    ]);
  });

  it('ignores blank candidate names', () => {
    const withBlank: MentionCandidate[] = [
      { id: 'u_x', name: '   ', displayName: '' },
    ];
    expect(resolveTextMentions('@ hello', withBlank)).toEqual([]);
  });
});
