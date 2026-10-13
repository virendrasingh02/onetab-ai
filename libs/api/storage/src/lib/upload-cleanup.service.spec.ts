import { describe, expect, it } from 'vitest';
import { findOrphanKeys } from './upload-cleanup.service.js';

describe('findOrphanKeys', () => {
  const logo = 'ws1/db/db696555-75cc-4034-876e-97cd03ac2897.webp';
  const upload = 'ws1/ab/ab11-photo.jpg';

  it('keeps every key a row points at', () => {
    expect(findOrphanKeys([logo, upload], [logo, upload])).toEqual([]);
  });

  it('reports a key no row points at', () => {
    const stray = 'ws1/cd/cd22-stray.png';
    expect(findOrphanKeys([logo, upload, stray], [logo, upload])).toEqual([
      stray,
    ]);
  });

  it('keeps renditions of a live original, drops those of a dead one', () => {
    const kept = 'ws1/ab/ab11-photo.thumbnail.webp';
    const dropped = 'ws1/cd/cd22-gone.large.webp';
    expect(findOrphanKeys([kept, dropped], [upload])).toEqual([dropped]);
  });

  it('never touches user avatars, which no row keys', () => {
    expect(
      findOrphanKeys(
        ['avatars/u1/avatar.webp', 'avatars/u1/avatar_64.webp'],
        [],
      ),
    ).toEqual([]);
  });
});
