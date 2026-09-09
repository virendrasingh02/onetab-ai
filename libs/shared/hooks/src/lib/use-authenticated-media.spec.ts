import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureAuthenticatedMediaFetcher,
  fetchAuthenticatedMediaBlob,
  isAuthenticatedMediaUrl,
  useAuthenticatedMediaSrc,
} from './use-authenticated-media.js';

const AUTH_URL =
  'https://matrix.example.com/_matrix/client/v1/media/download/example.com/abc123';
const PLAIN_URL = 'https://cdn.example.com/logo.png';

describe('isAuthenticatedMediaUrl', () => {
  it('matches the authenticated download and thumbnail routes', () => {
    expect(isAuthenticatedMediaUrl(AUTH_URL)).toBe(true);
    expect(
      isAuthenticatedMediaUrl(
        'https://matrix.example.com/_matrix/client/v1/media/thumbnail/example.com/abc123',
      ),
    ).toBe(true);
  });

  it('does not match ordinary URLs', () => {
    expect(isAuthenticatedMediaUrl(PLAIN_URL)).toBe(false);
    expect(isAuthenticatedMediaUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isAuthenticatedMediaUrl('blob:https://app.example.com/abc')).toBe(
      false,
    );
  });
});

describe('useAuthenticatedMediaSrc', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:resolved');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    configureAuthenticatedMediaFetcher(null);
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('passes through a URL that does not need authentication', () => {
    const { result } = renderHook(() => useAuthenticatedMediaSrc(PLAIN_URL));
    expect(result.current).toBe(PLAIN_URL);
  });

  it('passes through null/undefined unchanged', () => {
    const { result: nullResult } = renderHook(() =>
      useAuthenticatedMediaSrc(null),
    );
    expect(nullResult.current).toBeNull();

    const { result: undefinedResult } = renderHook(() =>
      useAuthenticatedMediaSrc(undefined),
    );
    expect(undefinedResult.current).toBeUndefined();
  });

  it('resolves an authenticated URL to a blob URL once the fetcher is configured', async () => {
    const url = `${AUTH_URL}/needs-fetcher`;
    const fetcher = vi.fn(
      async () => new Response(new Blob(['x']), { status: 200 }),
    );
    configureAuthenticatedMediaFetcher(fetcher);

    const { result } = renderHook(() => useAuthenticatedMediaSrc(url));

    // Unresolved until the fetch completes — callers should show their
    // normal loading/fallback state, never the raw (401-bound) URL.
    expect(result.current).toBeUndefined();

    await waitFor(() => expect(result.current).toBe('blob:resolved'));
    expect(fetcher).toHaveBeenCalledWith(url);
  });

  it('falls back to undefined when no fetcher is configured', async () => {
    const url = `${AUTH_URL}/no-fetcher`;
    const { result } = renderHook(() => useAuthenticatedMediaSrc(url));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBeUndefined();
  });

  it('falls back to undefined on a failed fetch', async () => {
    const url = `${AUTH_URL}/failure`;
    configureAuthenticatedMediaFetcher(async () => new Response(null, { status: 403 }));

    const { result } = renderHook(() => useAuthenticatedMediaSrc(url));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBeUndefined();
  });

  it('reuses one fetch for the same URL across multiple consumers', async () => {
    const url = `${AUTH_URL}/shared`;
    const fetcher = vi.fn(
      async () => new Response(new Blob(['x']), { status: 200 }),
    );
    configureAuthenticatedMediaFetcher(fetcher);

    const first = renderHook(() => useAuthenticatedMediaSrc(url));
    const second = renderHook(() => useAuthenticatedMediaSrc(url));

    await waitFor(() => expect(first.result.current).toBe('blob:resolved'));
    await waitFor(() => expect(second.result.current).toBe('blob:resolved'));

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('fetchAuthenticatedMediaBlob', () => {
  afterEach(() => {
    configureAuthenticatedMediaFetcher(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the configured fetcher for authenticated URLs', async () => {
    const expected = new Blob(['payload']);
    configureAuthenticatedMediaFetcher(
      async () => new Response(expected, { status: 200 }),
    );

    const blob = await fetchAuthenticatedMediaBlob(`${AUTH_URL}/download`);
    expect(blob).not.toBeNull();
  });

  it('uses a plain fetch for non-authenticated URLs', async () => {
    const plainFetch = vi.fn(
      async () => new Response(new Blob(['plain']), { status: 200 }),
    );
    vi.stubGlobal('fetch', plainFetch);

    const blob = await fetchAuthenticatedMediaBlob(PLAIN_URL);

    expect(plainFetch).toHaveBeenCalledWith(PLAIN_URL);
    expect(blob).not.toBeNull();
  });
});
