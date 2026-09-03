import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmojiGifPicker } from './emoji-gif-picker.js';
import { GifPicker } from './gif-picker.js';
import { GifSourceProvider, type GifSource } from './gif-source-context.js';
import { searchEmojiShortcodes, type EmojiShortcodeEntry } from './use-emoji-shortcode-index.js';
import { usePickerRecents } from './use-picker-recents.js';

/** frimousse fetches the Emojibase dataset on mount — keep it off the network. */
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
  );
  usePickerRecents.setState({ emojis: [], gifs: [] });
  try {
    localStorage.clear();
  } catch {
    /* jsdom always has it, but be safe */
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const gif = (id: string, title: string) => ({
  id,
  title,
  url: `https://example.test/${id}.gif`,
  previewUrl: `https://example.test/${id}-preview.gif`,
  width: 200,
  height: 200,
});

function makeSource(): GifSource {
  return {
    trending: vi.fn().mockResolvedValue({
      items: [gif('t1', 'trending one'), gif('t2', 'trending two')],
      next: '',
    }),
    search: vi.fn().mockResolvedValue({
      items: [gif('s1', 'a happy cat')],
      next: '',
    }),
    categories: vi.fn().mockResolvedValue(['cats', 'dogs']),
  };
}

describe('EmojiGifPicker', () => {
  it('shows the GIF tab only when onGifSelect is provided', () => {
    const { rerender } = render(
      <EmojiGifPicker onEmojiSelect={vi.fn()} />,
    );
    expect(screen.queryByRole('tab', { name: /gif/i })).not.toBeInTheDocument();

    rerender(
      <EmojiGifPicker onEmojiSelect={vi.fn()} onGifSelect={vi.fn()} />,
    );
    expect(screen.getByRole('tab', { name: /gif/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /emoji/i })).toBeInTheDocument();
  });
});

describe('GifPicker', () => {
  it('loads trending from the source and selects a GIF', async () => {
    const source = makeSource();
    const onGifSelect = vi.fn();
    render(
      <GifSourceProvider value={source}>
        <GifPicker onGifSelect={onGifSelect} />
      </GifSourceProvider>,
    );

    const first = await screen.findByTitle('trending one');
    expect(source.trending).toHaveBeenCalled();

    fireEvent.click(first);
    expect(onGifSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
    );
    expect(usePickerRecents.getState().gifs[0]?.id).toBe('t1');
  });

  it('searches the source when the query changes', async () => {
    const source = makeSource();
    render(
      <GifSourceProvider value={source}>
        <GifPicker onGifSelect={vi.fn()} />
      </GifSourceProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText('Search Tenor…'), {
      target: { value: 'cat' },
    });

    await waitFor(() => expect(source.search).toHaveBeenCalledWith('cat'));
    expect(await screen.findByTitle('a happy cat')).toBeInTheDocument();
  });

  it('falls back to the curated set with no provider', async () => {
    render(<GifPicker onGifSelect={vi.fn()} />);
    // CURATED_GIFS titles include "Thumbs up"
    expect(await screen.findByTitle('Thumbs up')).toBeInTheDocument();
    expect(screen.queryByText('Powered by Tenor')).not.toBeInTheDocument();
  });
});

describe('usePickerRecents', () => {
  it('keeps emoji MRU and de-duplicates', () => {
    const { pushEmoji } = usePickerRecents.getState();
    pushEmoji('😀');
    pushEmoji('🎉');
    pushEmoji('😀');
    expect(usePickerRecents.getState().emojis).toEqual(['😀', '🎉']);
  });

  it('caps GIF recents at 12', () => {
    const { pushGif } = usePickerRecents.getState();
    for (let i = 0; i < 20; i++) pushGif(gif(`g${i}`, `g${i}`));
    expect(usePickerRecents.getState().gifs).toHaveLength(12);
    expect(usePickerRecents.getState().gifs[0]?.id).toBe('g19');
  });
});

describe('searchEmojiShortcodes', () => {
  const index: EmojiShortcodeEntry[] = [
    { char: '🚀', label: 'rocket', shortcodes: ['rocket'], tags: ['launch', 'space'] },
    { char: '🎸', label: 'guitar', shortcodes: ['guitar'], tags: ['rock', 'music'] },
    { char: '😀', label: 'grinning face', shortcodes: ['grinning'], tags: ['happy'] },
  ];

  it('ranks an exact shortcode above a tag hit', () => {
    const results = searchEmojiShortcodes(index, 'rock');
    expect(results[0]?.char).toBe('🚀'); // "rock" is a prefix of shortcode "rocket"
    expect(results.map((r) => r.char)).toContain('🎸'); // tag "rock"
  });

  it('returns nothing for an empty query', () => {
    expect(searchEmojiShortcodes(index, '')).toEqual([]);
  });
});
