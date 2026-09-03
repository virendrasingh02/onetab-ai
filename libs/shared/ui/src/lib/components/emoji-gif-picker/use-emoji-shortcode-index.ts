import { useEffect, useState } from 'react';

/**
 * Shared emoji index for the `:shortcode:` typeahead.
 *
 * Built from the same {@link https://emojibase.dev | Emojibase} dataset the
 * visual `<EmojiPicker>` renders (frimousse), so shortcodes, labels and the
 * grid never drift apart. Loaded once, lazily, on first use — the JSON is
 * ~1900 entries and no menu needs it until someone types `:`.
 */

export interface EmojiShortcodeEntry {
  /** The emoji character. */
  char: string;
  /** Human label, e.g. "grinning face". */
  label: string;
  /** e.g. `["grinning"]` — what the user types between the colons. */
  shortcodes: string[];
  /** Search synonyms, e.g. `["happy", "smile", "teeth"]`. */
  tags: string[];
}

interface CompactEmoji {
  hexcode: string;
  label: string;
  unicode: string;
  group?: number;
  order?: number;
  tags?: string[];
}

let indexPromise: Promise<EmojiShortcodeEntry[]> | null = null;

async function loadIndex(): Promise<EmojiShortcodeEntry[]> {
  const [dataMod, shortcodesMod] = await Promise.all([
    import('emojibase-data/en/compact.json'),
    import('emojibase-data/en/shortcodes/emojibase.json'),
  ]);

  const data = (dataMod.default ?? dataMod) as unknown as CompactEmoji[];
  const shortcodes = (shortcodesMod.default ?? shortcodesMod) as unknown as Record<
    string,
    string | string[]
  >;

  return data
    // `group` is only set on real, categorised emoji — skips regional
    // indicators and other bare codepoints that have no shortcode anyway.
    .filter((emoji) => emoji.group !== undefined)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((emoji) => {
      const raw = shortcodes[emoji.hexcode];
      return {
        char: emoji.unicode,
        label: emoji.label,
        shortcodes: raw ? (Array.isArray(raw) ? raw : [raw]) : [],
        tags: emoji.tags ?? [],
      };
    });
}

/** Returns `[]` until the dataset resolves, then the full index. */
export function useEmojiShortcodeIndex(): EmojiShortcodeEntry[] {
  const [index, setIndex] = useState<EmojiShortcodeEntry[]>([]);

  useEffect(() => {
    let alive = true;
    indexPromise ??= loadIndex().catch(() => {
      // A failed load leaves the menu empty rather than throwing — reset so a
      // later mount can retry.
      indexPromise = null;
      return [] as EmojiShortcodeEntry[];
    });
    void indexPromise.then((entries) => {
      if (alive) setIndex(entries);
    });
    return () => {
      alive = false;
    };
  }, []);

  return index;
}

/**
 * Ranked lookup for a `:query` — exact shortcode first, then prefix, then
 * substring in a shortcode, then a tag hit. Caps the result for the menu.
 */
export function searchEmojiShortcodes(
  index: EmojiShortcodeEntry[],
  query: string,
  limit = 10,
): EmojiShortcodeEntry[] {
  const needle = query.toLowerCase().trim();
  if (!needle) return [];

  const scored: { entry: EmojiShortcodeEntry; score: number }[] = [];
  for (const entry of index) {
    let score = 0;
    if (entry.shortcodes.includes(needle)) score = 4;
    else if (entry.shortcodes.some((code) => code.startsWith(needle))) score = 3;
    else if (entry.shortcodes.some((code) => code.includes(needle))) score = 2;
    else if (entry.tags.some((tag) => tag.includes(needle))) score = 1;
    if (score > 0) scored.push({ entry, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}
