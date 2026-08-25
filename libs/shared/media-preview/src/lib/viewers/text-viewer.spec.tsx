import { render, screen, waitFor } from '@testing-library/react';
import type { MediaItem } from '../types.js';
import { TextViewer } from './text-viewer.js';

function item(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: 'a',
    name: 'notes.txt',
    mimeType: 'text/plain',
    category: 'text',
    ...overrides,
  };
}

describe('TextViewer', () => {
  it('renders inlineText immediately, without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<TextViewer item={item({ inlineText: 'export const x = 1;', language: 'typescript' })} />);

    expect(screen.getByText('export')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('fetches content from url when there is no inlineText', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('hello world'),
    } as Response);

    render(<TextViewer item={item()} url="https://example.test/notes.txt" />);

    await waitFor(() => expect(screen.getByText('hello world')).toBeInTheDocument());
  });

  it('shows an error state when the fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, text: () => Promise.resolve('') } as Response);

    render(<TextViewer item={item()} url="https://example.test/missing.txt" />);

    await waitFor(() =>
      expect(screen.getByText('Preview unavailable')).toBeInTheDocument(),
    );
  });

  it('styles diff lines by +/- prefix', () => {
    const content = ['+++ b/file', '+added line', '-removed line', ' context'].join('\n');
    render(<TextViewer item={item({ inlineText: content, isDiff: true, language: 'diff' })} />);

    expect(screen.getByText(/added line/).closest('div')).toHaveClass('bg-emerald-500/10');
    expect(screen.getByText(/removed line/).closest('div')).toHaveClass('bg-red-500/10');
  });
});
