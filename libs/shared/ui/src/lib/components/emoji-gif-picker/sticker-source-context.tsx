import {
  CURATED_STICKER_PACKS,
  type StickerItem,
  type StickerPack,
} from '@org/types';
import { createContext, useContext, type ReactNode } from 'react';

export { CURATED_STICKER_PACKS, type StickerItem, type StickerPack };

/**
 * How `<StickerPicker>` gets its packs and stickers.
 *
 * `@org/ui` stays free of data-fetching dependencies. The application shell
 * injects this provider, wired to `stickersApi` from `@org/api-client`.
 * With no provider mounted, the picker falls back to {@link CURATED_STICKER_PACKS},
 * so the sticker tab works with zero configuration.
 */
export interface StickerSource {
  getPacks: () => Promise<StickerPack[]>;
  search: (query: string) => Promise<StickerItem[]>;
}

const StickerSourceContext = createContext<StickerSource | null>(null);

export function StickerSourceProvider({
  value,
  children,
}: {
  value: StickerSource;
  children: ReactNode;
}) {
  return (
    <StickerSourceContext.Provider value={value}>
      {children}
    </StickerSourceContext.Provider>
  );
}

/** `null` when no provider is mounted — callers fall back to {@link CURATED_STICKER_PACKS}. */
export function useStickerSource(): StickerSource | null {
  return useContext(StickerSourceContext);
}
