import { describe, expect, it } from 'vitest';
import { normalizeProfileWebsite, updateProfileSchema } from './profile.schema.js';

describe('normalizeProfileWebsite', () => {
  it('adds https:// to a bare domain', () => {
    expect(normalizeProfileWebsite('example.com')).toBe('https://example.com/');
    expect(normalizeProfileWebsite(' http://a.io/x ')).toBe('http://a.io/x');
  });

  it('rejects non-http schemes and non-hosts', () => {
    expect(normalizeProfileWebsite('javascript:alert(1)')).toBeNull();
    expect(normalizeProfileWebsite('data:text/html,hi')).toBeNull();
    expect(normalizeProfileWebsite('not a url')).toBeNull();
    expect(normalizeProfileWebsite('')).toBeNull();
  });
});

describe('updateProfileSchema profile extras', () => {
  const base = { name: 'Ada Lovelace' };

  it('accepts the form’s empty-string defaults', () => {
    const r = updateProfileSchema.safeParse({
      ...base,
      website: '',
      github: '',
      coverUrl: '',
      location: '',
    });
    expect(r.success).toBe(true);
  });

  it('validates website, github and cover', () => {
    expect(updateProfileSchema.safeParse({ ...base, website: 'javascript:alert(1)' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...base, github: '@ada-l' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ ...base, github: 'ada/../x' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...base, coverUrl: 'data:image/png;base64,iVBORw0K' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ ...base, coverUrl: 'https://x.io/a.png' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ ...base, coverUrl: '/users/abc123/cover?v=1760000000000' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ ...base, coverUrl: '/users/abc/../cover?v=1' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...base, coverUrl: 'https://x.io/a.png) ; color:red' }).success).toBe(false);
  });
});
