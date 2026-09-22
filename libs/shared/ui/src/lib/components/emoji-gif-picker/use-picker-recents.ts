import type { GifItem, StickerItem } from '@org/types';
import { create } from 'zustand';

/**
 * "Frequently used" for the central unified picker (emojis, GIFs, and stickers).
 *
 * Per-browser only, mirrored to localStorage the same way chat drafts are
 * ({@link file://libs/shared/chat-ui/src/lib/drafts-store.ts}). Never leaves
 * the device — recents are a convenience, not shared state.
 */

const STORAGE_KEY = 'onetab_picker_recents';
const MAX_EMOJIS = 30;
const MAX_GIFS = 20;
const MAX_STICKERS = 20;

export interface PickerRecentsShape {
  emojis: string[];
  gifs: GifItem[];
  stickers: StickerItem[];
}

export interface PickerRecentsState extends PickerRecentsShape {
  pushEmoji: (emoji: string) => void;
  pushGif: (gif: GifItem) => void;
  pushSticker: (sticker: StickerItem) => void;
  clear: () => void;
}

function load(): PickerRecentsShape {
  if (typeof window === 'undefined') return { emojis: [], gifs: [], stickers: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { emojis: [], gifs: [], stickers: [] };
    const parsed = JSON.parse(raw) as Partial<PickerRecentsShape>;
    return {
      emojis: Array.isArray(parsed.emojis) ? parsed.emojis.slice(0, MAX_EMOJIS) : [],
      gifs: Array.isArray(parsed.gifs) ? parsed.gifs.slice(0, MAX_GIFS) : [],
      stickers: Array.isArray(parsed.stickers) ? parsed.stickers.slice(0, MAX_STICKERS) : [],
    };
  } catch {
    return { emojis: [], gifs: [], stickers: [] };
  }
}

function persist(state: PickerRecentsShape): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        emojis: state.emojis,
        gifs: state.gifs,
        stickers: state.stickers,
      }),
    );
  } catch {
    // Storage quota / disabled — the in-memory copy still works this session.
  }
}

export const usePickerRecents = create<PickerRecentsState>((set, get) => ({
  ...load(),

  pushEmoji: (emoji) => {
    const next = [emoji, ...get().emojis.filter((e) => e !== emoji)].slice(
      0,
      MAX_EMOJIS,
    );
    set({ emojis: next });
    persist({ emojis: next, gifs: get().gifs, stickers: get().stickers });
  },

  pushGif: (gif) => {
    const next = [gif, ...get().gifs.filter((g) => g.id !== gif.id)].slice(
      0,
      MAX_GIFS,
    );
    set({ gifs: next });
    persist({ emojis: get().emojis, gifs: next, stickers: get().stickers });
  },

  pushSticker: (sticker) => {
    const next = [sticker, ...get().stickers.filter((s) => s.id !== sticker.id)].slice(
      0,
      MAX_STICKERS,
    );
    set({ stickers: next });
    persist({ emojis: get().emojis, gifs: get().gifs, stickers: next });
  },

  clear: () => {
    set({ emojis: [], gifs: [], stickers: [] });
    persist({ emojis: [], gifs: [], stickers: [] });
  },
}));
