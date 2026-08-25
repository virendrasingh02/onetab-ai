import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaItem } from '../types.js';
import { UnsupportedViewer } from './unsupported-viewer.js';

function item(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: 'a',
    name: 'design.sketch',
    mimeType: 'application/octet-stream',
    category: 'unknown',
    size: 4_800_000,
    ...overrides,
  };
}

describe('UnsupportedViewer', () => {
  it('shows the file name, size and a Download action', async () => {
    const onDownload = vi.fn();
    render(<UnsupportedViewer item={item({})} onDownload={onDownload} />);

    expect(screen.getByText('design.sketch')).toBeInTheDocument();
    expect(screen.getByText(/4\.6 MB/)).toBeInTheDocument();
    expect(screen.getByText('This file cannot be previewed here.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Download File/ }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('offers "Open externally" only for an http(s) url, never for a blob: url', () => {
    const { rerender } = render(
      <UnsupportedViewer item={item({ url: 'https://example.test/design.sketch' })} onDownload={vi.fn()} />,
    );
    expect(screen.getByRole('link', { name: /Open externally/ })).toBeInTheDocument();

    rerender(<UnsupportedViewer item={item({ url: 'blob:abcd-1234' })} onDownload={vi.fn()} />);
    expect(screen.queryByRole('link', { name: /Open externally/ })).not.toBeInTheDocument();
  });

  it('labels office documents distinctly from unknown files', () => {
    render(<UnsupportedViewer item={item({ category: 'office', mimeType: 'application/msword' })} onDownload={vi.fn()} />);
    expect(screen.getByText(/Office document/)).toBeInTheDocument();
  });
});
