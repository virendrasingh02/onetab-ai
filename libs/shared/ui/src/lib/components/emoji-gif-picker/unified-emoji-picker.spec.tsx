import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURATED_STICKER_PACKS, StickerSourceProvider, type StickerSource } from './sticker-source-context.js';
import { GifSourceProvider, type GifSource } from './gif-source-context.js';
import { UnifiedEmojiPicker } from './unified-emoji-picker.js';
import { UnifiedEmojiPickerPopover } from './unified-emoji-picker-popover.js';
import { usePickerRecents } from './use-picker-recents.js';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
  );
  usePickerRecents.setState({ emojis: [], gifs: [], stickers: [] });
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mockGif = (id: string, title: string) => ({
  id,
  title,
  url: `https://example.test/${id}.gif`,
  previewUrl: `https://example.test/${id}-preview.gif`,
  width: 200,
  height: 200,
});

function makeGifSource(): GifSource {
  return {
    trending: vi.fn().mockResolvedValue({
      items: [mockGif('g1', 'trending cat'), mockGif('g2', 'trending dog')],
      next: '',
    }),
    search: vi.fn().mockResolvedValue({
      items: [mockGif('g-search', 'searched gif')],
      next: '',
    }),
    categories: vi.fn().mockResolvedValue(['celebrate', 'cheers']),
  };
}

function makeStickerSource(): StickerSource {
  return {
    getPacks: vi.fn().mockResolvedValue([
      {
        id: 'test-pack',
        name: 'Test Pack',
        icon: '🚀',
        stickers: [
          {
            id: 's1',
            packId: 'test-pack',
            name: 'Rocket Sticker',
            url: 'https://example.test/s1.png',
            alt: 'Rocket Blast',
            tags: ['space', 'rocket'],
          },
          {
            id: 's2',
            packId: 'test-pack',
            name: 'Star Sticker',
            url: 'https://example.test/s2.png',
            alt: 'Gold Star',
            tags: ['star', 'shine'],
          },
        ],
      },
    ]),
    search: vi.fn().mockResolvedValue([
      {
        id: 's-search',
        packId: 'test-pack',
        name: 'Found Sticker',
        url: 'https://example.test/found.png',
        alt: 'Found Sticker Alt',
        tags: ['found'],
      },
    ]),
  };
}

describe('UnifiedEmojiPicker', () => {
  it('renders all three tabs: Emoji, GIFs, and Stickers', () => {
    render(
      <UnifiedEmojiPicker
        onEmojiSelect={vi.fn()}
        onGifSelect={vi.fn()}
        onStickerSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: /emoji/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /gifs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /stickers/i })).toBeInTheDocument();
  });

  it('switches between tabs and shows appropriate content', async () => {
    const user = userEvent.setup();
    const gifSource = makeGifSource();
    const stickerSource = makeStickerSource();

    render(
      <GifSourceProvider value={gifSource}>
        <StickerSourceProvider value={stickerSource}>
          <UnifiedEmojiPicker
            onEmojiSelect={vi.fn()}
            onGifSelect={vi.fn()}
            onStickerSelect={vi.fn()}
          />
        </StickerSourceProvider>
      </GifSourceProvider>,
    );

    // Initial tab is Emoji
    expect(screen.getByPlaceholderText('Search emoji…')).toBeInTheDocument();

    // Switch to GIFs tab
    await user.click(screen.getByRole('tab', { name: /gifs/i }));
    expect(await screen.findByPlaceholderText('Search GIFs…')).toBeInTheDocument();
    expect(await screen.findByTitle('trending cat')).toBeInTheDocument();

    // Switch to Stickers tab
    await user.click(screen.getByRole('tab', { name: /stickers/i }));
    expect(await screen.findByPlaceholderText('Search stickers…')).toBeInTheDocument();
    expect(await screen.findByTitle('Rocket Sticker')).toBeInTheDocument();
  });

  it('selects a GIF, invokes onGifSelect, and updates recents', async () => {
    const gifSource = makeGifSource();
    const onGifSelect = vi.fn();

    render(
      <GifSourceProvider value={gifSource}>
        <UnifiedEmojiPicker
          defaultTab="gifs"
          onEmojiSelect={vi.fn()}
          onGifSelect={onGifSelect}
          onStickerSelect={vi.fn()}
        />
      </GifSourceProvider>,
    );

    const gifBtn = await screen.findByTitle('trending cat');
    fireEvent.click(gifBtn);

    expect(onGifSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'g1', title: 'trending cat' }),
    );
    expect(usePickerRecents.getState().gifs[0]?.id).toBe('g1');
  });

  it('selects a sticker, invokes onStickerSelect, and updates recents', async () => {
    const stickerSource = makeStickerSource();
    const onStickerSelect = vi.fn();

    render(
      <StickerSourceProvider value={stickerSource}>
        <UnifiedEmojiPicker
          defaultTab="stickers"
          onEmojiSelect={vi.fn()}
          onGifSelect={vi.fn()}
          onStickerSelect={onStickerSelect}
        />
      </StickerSourceProvider>,
    );

    const stickerBtn = await screen.findByTitle('Rocket Sticker');
    fireEvent.click(stickerBtn);

    expect(onStickerSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', name: 'Rocket Sticker' }),
    );
    expect(usePickerRecents.getState().stickers[0]?.id).toBe('s1');
  });

  it('falls back to curated sticker packs when no source provider is mounted', async () => {
    render(
      <UnifiedEmojiPicker
        defaultTab="stickers"
        onEmojiSelect={vi.fn()}
        onGifSelect={vi.fn()}
        onStickerSelect={vi.fn()}
      />,
    );

    // First curated pack is "Party Vibes"
    const partyVibesElements = await screen.findAllByText('Party Vibes');
    expect(partyVibesElements.length).toBeGreaterThan(0);
    expect(screen.getByTitle('Celebrate')).toBeInTheDocument();
  });

  it('searches stickers across packs', async () => {
    const stickerSource = makeStickerSource();

    render(
      <StickerSourceProvider value={stickerSource}>
        <UnifiedEmojiPicker
          defaultTab="stickers"
          onEmojiSelect={vi.fn()}
          onGifSelect={vi.fn()}
          onStickerSelect={vi.fn()}
        />
      </StickerSourceProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText('Search stickers…'), {
      target: { value: 'found' },
    });

    await waitFor(() => expect(stickerSource.search).toHaveBeenCalledWith('found'));
    expect(await screen.findByTitle('Found Sticker')).toBeInTheDocument();
  });
});

describe('usePickerRecents bounded capacity', () => {
  it('caps emojis at 30, GIFs at 20, and stickers at 20', () => {
    const { pushEmoji, pushGif, pushSticker } = usePickerRecents.getState();

    for (let i = 0; i < 35; i++) pushEmoji(`emoji-${i}`);
    expect(usePickerRecents.getState().emojis).toHaveLength(30);
    expect(usePickerRecents.getState().emojis[0]).toBe('emoji-34');

    for (let i = 0; i < 25; i++) pushGif(mockGif(`g-${i}`, `g-${i}`));
    expect(usePickerRecents.getState().gifs).toHaveLength(20);
    expect(usePickerRecents.getState().gifs[0]?.id).toBe('g-24');

    for (let i = 0; i < 25; i++) {
      pushSticker({
        id: `s-${i}`,
        packId: 'p',
        name: `s-${i}`,
        url: `https://example.test/${i}.png`,
        alt: `s-${i}`,
      });
    }
    expect(usePickerRecents.getState().stickers).toHaveLength(20);
    expect(usePickerRecents.getState().stickers[0]?.id).toBe('s-24');
  });
});

describe('UnifiedEmojiPickerPopover', () => {
  it('opens and closes popover with trigger and manages selection events', () => {
    const onEmojiSelect = vi.fn();
    const onGifSelect = vi.fn();
    const onStickerSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <UnifiedEmojiPickerPopover
        open={true}
        onOpenChange={onOpenChange}
        onEmojiSelect={onEmojiSelect}
        onGifSelect={onGifSelect}
        onStickerSelect={onStickerSelect}
      >
        <button type="button">Trigger</button>
      </UnifiedEmojiPickerPopover>,
    );

    expect(screen.getByRole('tab', { name: /emoji/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /stickers/i })).toBeInTheDocument();
  });
});
