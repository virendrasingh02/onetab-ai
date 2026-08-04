import { escapeRegExp, initials, slugify, truncate } from './string.js';

describe('initials', () => {
  it('takes the first and last word for multi-word names', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Mary  Jane  Watson')).toBe('MW');
  });

  it('takes the first two characters for a single word', () => {
    expect(initials('grace')).toBe('GR');
  });

  it('falls back to a placeholder for blank input', () => {
    expect(initials('   ')).toBe('?');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Product Launch')).toBe('product-launch');
  });

  it('strips diacritics rather than dropping the letter', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu');
  });

  it('collapses runs of separators and trims them', () => {
    expect(slugify('  --Hello___World!!  ')).toBe('hello-world');
  });

  it('caps length so a slug cannot overflow the column', () => {
    expect(slugify('a'.repeat(200))).toHaveLength(80);
  });
});

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('appends an ellipsis when cutting', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });
});

describe('escapeRegExp', () => {
  it('escapes characters that would otherwise be regex syntax', () => {
    const escaped = escapeRegExp('a.b*c');
    expect(new RegExp(escaped).test('a.b*c')).toBe(true);
    expect(new RegExp(escaped).test('axbxc')).toBe(false);
  });
});
