import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils.js';
import type { MediaItem } from '../types.js';
import { PdfViewer } from './pdf-viewer.js';

interface FakeLoadingTask {
  promise: Promise<unknown>;
  destroy: () => void;
  /** Real pdf.js callers assign this *after* `getDocument()` returns, they
   * never pass it as a constructor option — the mock below mirrors that. */
  onPassword?: (callback: (password: string) => void, reason: number) => void;
}

function makeFakePage(pageNumber: number) {
  return {
    getViewport: ({ scale = 1 }: { scale?: number; rotation?: number } = {}) => ({
      width: 600 * scale,
      height: 800 * scale,
    }),
    render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
    getTextContent: () =>
      Promise.resolve({ items: [{ str: `Needle only appears on page ${pageNumber}` }] }),
  };
}

function makeFakeDoc(numPages: number) {
  return {
    numPages,
    getPage: (pageNumber: number) => Promise.resolve(makeFakePage(pageNumber)),
    destroy: vi.fn(),
  };
}

// `vi.mock` factories can only reference values reached through
// `vi.hoisted()` — anything else risks the mock silently not applying
// (a plain outer `let`/`const` isn't guaranteed to be hoisted correctly
// ahead of it). A mutable `.current` on a hoisted ref is how each test below
// swaps in its own `getDocument` behaviour without re-mocking the module.
const { getDocumentImplRef, PasswordResponses } = vi.hoisted(() => ({
  getDocumentImplRef: {
    current: (): FakeLoadingTask => ({ promise: Promise.resolve(), destroy: () => undefined }),
  },
  PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 },
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  PasswordResponses,
  TextLayer: class {
    render() {
      return Promise.resolve();
    }
  },
  getDocument: () => getDocumentImplRef.current(),
}));

function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'doc-1',
    name: 'report.pdf',
    mimeType: 'application/pdf',
    category: 'pdf',
    ...overrides,
  };
}

beforeEach(() => {
  getDocumentImplRef.current = () => ({ promise: Promise.resolve(makeFakeDoc(3)), destroy: vi.fn() });
});

describe('PdfViewer', () => {
  it('shows the page count once the document loads', async () => {
    renderWithProviders(<PdfViewer item={item()} url="https://example.test/report.pdf" onDownload={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('1'));
    expect(screen.getByText('/ 3')).toBeInTheDocument();
  });

  it('navigates to a page via the page number input', async () => {
    renderWithProviders(<PdfViewer item={item()} url="https://example.test/report.pdf" onDownload={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('1'));

    const pageInput = screen.getByLabelText('Page number');
    await userEvent.clear(pageInput);
    await userEvent.type(pageInput, '2{Enter}');

    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('2'));
  });

  it('clamps the page number input to the valid range', async () => {
    renderWithProviders(<PdfViewer item={item()} url="https://example.test/report.pdf" onDownload={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('1'));

    const pageInput = screen.getByLabelText('Page number');
    await userEvent.clear(pageInput);
    await userEvent.type(pageInput, '999{Enter}');

    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('3'));
  });

  it('opens and closes the search panel', async () => {
    renderWithProviders(<PdfViewer item={item()} url="https://example.test/report.pdf" onDownload={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('1'));

    await userEvent.click(screen.getByRole('button', { name: 'Search in document' }));
    expect(screen.getByPlaceholderText('Search in document')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.queryByPlaceholderText('Search in document')).not.toBeInTheDocument();
  });

  it('finds a match and jumps to its page', async () => {
    renderWithProviders(<PdfViewer item={item()} url="https://example.test/report.pdf" onDownload={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('1'));

    await userEvent.click(screen.getByRole('button', { name: 'Search in document' }));
    await userEvent.type(screen.getByPlaceholderText('Search in document'), 'page 2');

    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('2'));
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
  });

  it('shows a password prompt for an encrypted PDF and unlocks on the correct password', async () => {
    let resolveDoc!: (doc: unknown) => void;
    const docPromise = new Promise((resolve) => {
      resolveDoc = resolve as (doc: unknown) => void;
    });

    getDocumentImplRef.current = () => {
      const task: FakeLoadingTask = { promise: docPromise, destroy: vi.fn() };
      // The real hook assigns `task.onPassword` synchronously right after
      // `getDocument()` returns — deferring to a microtask here simulates
      // pdf.js discovering a password is required only once that assignment
      // has actually happened.
      queueMicrotask(() => {
        // pdf.js calls `onPassword` again (with a reason of
        // INCORRECT_PASSWORD) on every wrong attempt, each time handing back
        // the *next* callback to submit a retry through — reusing the same
        // function for that is what the real API does too, not a
        // simplification specific to this mock.
        const attemptPassword = (password: string) => {
          if (password === 'correct') {
            resolveDoc(makeFakeDoc(3));
          } else {
            task.onPassword?.(attemptPassword, PasswordResponses.INCORRECT_PASSWORD);
          }
        };
        task.onPassword?.(attemptPassword, PasswordResponses.NEED_PASSWORD);
      });
      return task;
    };

    renderWithProviders(<PdfViewer item={item()} url="https://example.test/secret.pdf" onDownload={vi.fn()} />);

    expect(await screen.findByText('This PDF is password protected')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('PDF password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText('Incorrect password. Try again.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('PDF password'));
    await userEvent.type(screen.getByLabelText('PDF password'), 'correct');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => expect(screen.getByLabelText('Page number')).toHaveValue('1'));
  });

  it('shows an error state with a Download action when the document fails to load', async () => {
    getDocumentImplRef.current = () => ({
      promise: Promise.reject(new Error('The file may be corrupted or unavailable.')),
      destroy: vi.fn(),
    });
    const onDownload = vi.fn();

    renderWithProviders(<PdfViewer item={item()} url="https://example.test/broken.pdf" onDownload={onDownload} />);

    expect(await screen.findByText('Unable to preview this PDF')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});
