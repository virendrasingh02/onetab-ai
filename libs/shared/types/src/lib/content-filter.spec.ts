import { describe, expect, it } from 'vitest';
import { checkAllContent, checkContent } from './content-filter.js';

const blocked = (text: string) => !checkContent(text).allowed;

describe('checkContent blocks', () => {
  it.each([
    ['hate', 'you are a faggot'],
    ['child_safety', 'selling child porn here'],
    ['violence', 'go kill yourself'],
    ['violence', "I'm going to kill you"],
    ['violence', 'im gonna shoot up the office'],
  ])('%s: %s', (category, text) => {
    expect(checkContent(text)).toEqual({ allowed: false, category });
  });

  it.each([
    ['capitals', 'KILL YOURSELF'],
    ['lookalike characters', 'f4gg0t'],
    ['stretched letters', 'faaaggot'],
    ['punctuation between letters', 'f.a.g.g.o.t'],
    ['spaced letters', 'f a g g o t'],
    ['accents', 'fággot'],
    ['zero-width characters', 'fag​got'],
    ['curly apostrophes', 'I’m going to kill you'],
    ['extra spaces', 'kill    yourself'],
    ['plurals', 'faggots'],
  ])('survives %s', (_, text) => {
    expect(blocked(text)).toBe(true);
  });
});

describe('checkContent allows', () => {
  it.each([
    // Everyday work language around the blocked words.
    'kill the process on port 3000',
    'this bug is killing me',
    'I will shoot you an email',
    'my manager will kill me if this ships late',
    'we need to bomb-proof the rollout',
    // Innocent words containing a blocked word.
    'Scunthorpe United won',
    'skill matrix for the team',
    'a spicy chinkapin oak',
    'a chink in the armor',
    'spic and span',
    'Pakistan office opens Monday',
    'the kyshtym report',
    // Ordinary swearing is the workspace's business, not ours.
    'this damn build is shit',
    // Talking about safety work.
    'we reviewed the child safety policy',
    'Reports of self-harm go to the safety team',
    // Lone letters are not a spaced-out word.
    'plan a b or c',
    '',
  ])('%s', (text) => {
    expect(checkContent(text)).toEqual({ allowed: true });
  });

  it('treats null and undefined as nothing to check', () => {
    expect(checkContent(null).allowed).toBe(true);
    expect(checkContent(undefined).allowed).toBe(true);
  });
});

describe('hostile input', () => {
  it('stays fast on long near-miss text', () => {
    const started = Date.now();
    checkContent(`${'f.a.g.g.o.'.repeat(5000)}x`);
    checkContent('a '.repeat(50_000));
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('checkAllContent', () => {
  it('finds a problem in any field', () => {
    expect(checkAllContent('fine', null, 'kill yourself').allowed).toBe(false);
    expect(checkAllContent('fine', undefined).allowed).toBe(true);
  });
});
