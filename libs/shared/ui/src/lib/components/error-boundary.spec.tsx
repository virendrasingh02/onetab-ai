import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './error-boundary.js';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  // React logs caught render errors to console.error; silence the expected noise.
  beforeAll(() =>
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  );
  afterAll(() => vi.restoreAllMocks());

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows the fallback state when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('reports the error through onError', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('kaboom');
  });

  it('uses a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(error) => <p>Custom: {error.message}</p>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom: kaboom')).toBeInTheDocument();
  });
});
