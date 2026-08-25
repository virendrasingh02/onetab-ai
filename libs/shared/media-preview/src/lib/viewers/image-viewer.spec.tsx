import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils.js';
import type { MediaItem } from '../types.js';
import { ImageViewer } from './image-viewer.js';

const item: MediaItem = {
  id: 'a',
  name: 'photo.png',
  mimeType: 'image/png',
  category: 'image',
  url: 'https://example.test/photo.png',
};

function setup() {
  const onNext = vi.fn();
  const onPrevious = vi.fn();
  const onDownload = vi.fn();
  renderWithProviders(
    <ImageViewer item={item} url={item.url as string} onNext={onNext} onPrevious={onPrevious} onDownload={onDownload} />,
  );
  return { onNext, onPrevious, onDownload };
}

describe('ImageViewer', () => {
  it('starts at Fit and zooms in/out via the toolbar buttons', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Fit' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('button', { name: '125%' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByRole('button', { name: '100%' })).toBeInTheDocument();
  });

  it('zooms via the keyboard (+/-) and resets via 0', async () => {
    setup();
    await userEvent.keyboard('+');
    expect(screen.getByRole('button', { name: '125%' })).toBeInTheDocument();
    await userEvent.keyboard('0');
    expect(screen.getByRole('button', { name: 'Fit' })).toBeInTheDocument();
  });

  it('does not go below the minimum or above the maximum zoom', async () => {
    setup();
    for (let i = 0; i < 20; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    }
    expect(screen.getByRole('button', { name: '400%' })).toBeInTheDocument();

    for (let i = 0; i < 20; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    }
    expect(screen.getByRole('button', { name: '25%' })).toBeInTheDocument();
  });

  it('resets zoom via the Reset button', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.getByRole('button', { name: 'Fit' })).toBeInTheDocument();
  });
});
