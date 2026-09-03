import type { GifItem } from '@org/types';
import { create } from 'zustand';

/**
 * "Frequently used" for the central picker.
 *
 * Per-browser only, mirrored to localStorage the same way chat drafts are
 * ({@link file://libs/shared/chat-ui/src/lib/drafts-store.ts}). Never leaves
 * the device — recents are a convenience, not shared state.
 */

const STORAGE_KEY = 'onetab_picker_recents';
const MAX_EMOJIS = 24;
const MAX_GIFS = 12;

interface PersistShape {
  emojis: string[];
  gifs: GifItem[];
}

interface PickerRecentsState extends PersistShape {
  pushEmoji: (emoji: string) => void;
  pushGif: (gif: GifItem) => void;
  clear: () => void;
}

function load(): PersistShape {
  if (typeof window === 'undefined') return { emojis: [], gifs: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { emojis: [], gifs: [] };
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    return {
      emojis: Array.isArray(parsed.emojis) ? parsed.emojis.slice(0, MAX_EMOJIS) : [],
      gifs: Array.isArray(parsed.gifs) ? parsed.gifs.slice(0, MAX_GIFS) : [],
    };
  } catch {
    return { emojis: [], gifs: [] };
  }
}

function persist(state: PersistShape): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ emojis: state.emojis, gifs: state.gifs }),
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
    persist({ emojis: next, gifs: get().gifs });
  },

  pushGif: (gif) => {
    const next = [gif, ...get().gifs.filter((g) => g.id !== gif.id)].slice(
      0,
      MAX_GIFS,
    );
    set({ gifs: next });
    persist({ emojis: get().emojis, gifs: next });
  },

  clear: () => {
    set({ emojis: [], gifs: [] });
    persist({ emojis: [], gifs: [] });
  },
}));
