import { CURATED_GIFS, type GifItem, type GifPage } from '@org/types';
import { createContext, useContext, type ReactNode } from 'react';

export { CURATED_GIFS, type GifItem, type GifPage };

/**
 * How `<GifPicker>` gets its GIFs.
 *
 * `@org/ui` stays free of data-fetching deps, so the app injects this once —
 * see `<GifSourceProvider>` in `apps/web/src/app/providers.tsx`, wired to
 * `gifsApi` from `@org/api-client`. With no provider the picker falls back to
 * {@link CURATED_GIFS}, so the GIF tab still works, just without live search.
 */
export interface GifSource {
  trending: (pos?: string) => Promise<GifPage>;
  search: (query: string, pos?: string) => Promise<GifPage>;
  categories: () => Promise<string[]>;
}

const GifSourceContext = createContext<GifSource | null>(null);

export function GifSourceProvider({
  value,
  children,
}: {
  value: GifSource;
  children: ReactNode;
}) {
  return (
    <GifSourceContext.Provider value={value}>{children}</GifSourceContext.Provider>
  );
}

/** `null` when no provider is mounted — callers fall back to {@link CURATED_GIFS}. */
export function useGifSource(): GifSource | null {
  return useContext(GifSourceContext);
}
