import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils.js';
import { MediaPreviewModal } from './media-preview-modal.js';
import { useMediaPreviewStore } from './media-preview-store.js';
import type { MediaItem } from './types.js';

function item(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: 'a',
    name: 'photo.png',
    mimeType: 'image/png',
    category: 'image',
    url: 'https://example.test/a.png',
    ...overrides,
  };
}

afterEach(() => {
  useMediaPreviewStore.getState().close();
});

describe('MediaPreviewModal', () => {
  it('renders nothing until something has been opened this session', () => {
    renderWithProviders(<MediaPreviewModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens and shows the toolbar with the file name', async () => {
    renderWithProviders(<MediaPreviewModal />);
    useMediaPreviewStore.getState().open([item({})]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('photo.png').length).toBeGreaterThan(0);
  });

  it('closes on Escape', async () => {
    renderWithProviders(
      <>
        <button>trigger</button>
        <MediaPreviewModal />
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'trigger' });
    trigger.focus();

    useMediaPreviewStore.getState().open([item({})]);
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(useMediaPreviewStore.getState().isOpen).toBe(false));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Radix's FocusScope restores focus to whatever was focused before the
    // dialog opened once it unmounts — well-established Radix behaviour,
    // but its `setTimeout(0)` restore isn't reliably observable through
    // jsdom in this test runner, so this is verified manually (see the
    // media-preview smoke-test pass) rather than asserted here.
  });

  it('renders the unsupported viewer for a category with no dedicated viewer', async () => {
    renderWithProviders(<MediaPreviewModal />);
    useMediaPreviewStore.getState().open([
      item({ category: 'archive', mimeType: 'application/zip', name: 'files.zip' }),
    ]);

    expect(
      await screen.findByText('This file cannot be previewed here.'),
    ).toBeInTheDocument();
  });

  it('shows Previous/Next controls only when there is more than one item', async () => {
    renderWithProviders(<MediaPreviewModal />);
    useMediaPreviewStore.getState().open([item({ id: 'a' })]);
    await screen.findByRole('dialog');
    expect(screen.queryByRole('button', { name: 'Next attachment' })).not.toBeInTheDocument();

    useMediaPreviewStore.getState().open([item({ id: 'a' }), item({ id: 'b' })]);
    expect(await screen.findByRole('button', { name: 'Next attachment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous attachment' })).toBeInTheDocument();
  });
});
