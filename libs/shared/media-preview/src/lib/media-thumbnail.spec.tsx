import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMediaPreviewStore } from './media-preview-store.js';
import { MediaPreviewTrigger } from './media-thumbnail.js';
import type { MediaItem } from './types.js';

function item(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: overrides.id ?? 'item',
    name: 'file.png',
    mimeType: 'image/png',
    category: 'image',
    ...overrides,
  };
}

afterEach(() => {
  useMediaPreviewStore.getState().close();
});

describe('MediaPreviewTrigger', () => {
  it('opens the preview with a single-item gallery by default', async () => {
    const target = item({ id: 'a' });
    render(
      <MediaPreviewTrigger item={target}>
        <span>thumb</span>
      </MediaPreviewTrigger>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open file.png' }));

    const state = useMediaPreviewStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.items).toEqual([target]);
    expect(state.activeIndex).toBe(0);
  });

  it('opens at the clicked item within a larger gallery', async () => {
    const gallery = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];
    render(
      <MediaPreviewTrigger item={gallery[2]} items={gallery}>
        <span>thumb</span>
      </MediaPreviewTrigger>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open file.png' }));

    const state = useMediaPreviewStore.getState();
    expect(state.items).toEqual(gallery);
    expect(state.activeIndex).toBe(2);
  });

  it('uses an explicit index over indexOf', async () => {
    const gallery = [item({ id: 'a' }), item({ id: 'a' })];
    render(
      <MediaPreviewTrigger item={gallery[1]} items={gallery} index={1}>
        <span>thumb</span>
      </MediaPreviewTrigger>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open file.png' }));
    expect(useMediaPreviewStore.getState().activeIndex).toBe(1);
  });
});
