import { CURATED_STICKER_PACKS } from '@org/types';
import { describe, expect, it } from 'vitest';
import { StickersService } from './stickers.service.js';

describe('StickersService', () => {
  const service = new StickersService({ get: () => undefined } as never);

  it('returns curated sticker packs', async () => {
    const packs = await service.getPacks();
    expect(packs.length).toBeGreaterThan(0);
    expect(packs[0].id).toBe(CURATED_STICKER_PACKS[0].id);
    expect(packs[0].stickers.length).toBeGreaterThan(0);
  });

  it('searches stickers across all packs by name or tag', async () => {
    const results = await service.searchStickers('celebrate');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((s) => s.name.toLowerCase().includes('celebrate') || s.tags?.includes('celebrate'))).toBe(true);
  });

  it('returns all stickers when query is empty', async () => {
    const all = await service.searchStickers('');
    const totalExpected = CURATED_STICKER_PACKS.reduce((acc, p) => acc + p.stickers.length, 0);
    expect(all).toHaveLength(totalExpected);
  });
});
