import { Injectable } from '@nestjs/common';
import {
  CURATED_STICKER_PACKS,
  type StickerItem,
  type StickerPack,
} from '@org/types';

/**
 * Service to manage and serve data-driven sticker packs.
 *
 * Caches packs and search results in memory for high-performance retrieval.
 * Serves {@link CURATED_STICKER_PACKS} out of the box with zero setup needed.
 */
@Injectable()
export class StickersService {
  private packsCache: StickerPack[] = CURATED_STICKER_PACKS;

  async getPacks(): Promise<StickerPack[]> {
    return this.packsCache;
  }

  async searchStickers(query: string): Promise<StickerItem[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return this.packsCache.flatMap((p) => p.stickers);
    }

    const allStickers = this.packsCache.flatMap((p) => p.stickers);
    return allStickers.filter((sticker) => {
      const matchName = sticker.name.toLowerCase().includes(q);
      const matchAlt = sticker.alt.toLowerCase().includes(q);
      const matchTag = sticker.tags?.some((t) => t.toLowerCase().includes(q));
      return matchName || matchAlt || matchTag;
    });
  }
}
