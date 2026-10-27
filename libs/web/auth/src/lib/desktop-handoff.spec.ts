import { ApiError } from '@org/api-client';
import { beforeEach, vi } from 'vitest';
import {
  authorizeDesktopHandoff,
  desktopCallbackUrl,
  desktopCancelUrl,
  isSignedOutError,
  readDesktopHandoff,
  withDesktopHandoff,
} from './desktop-handoff.js';

const api = vi.hoisted(() => ({
  authorizeDesktop: vi.fn(),
  refreshSession: vi.fn(),
}));

// Mirrors the real module's shape: `authApi` throws `ApiError`, and `toApiError`
// only understands axios failures, so it reports status 0 for an `ApiError`.
vi.mock('@org/api-client', () => {
  class ApiError extends Error {
    constructor(readonly status: number) {
      super('Unauthorized');
    }
  }
  return {
    ApiError,
    authApi: { authorizeDesktop: api.authorizeDesktop },
    refreshSession: api.refreshSession,
    toApiError: (error: unknown) => ({
      status: error instanceof ApiError ? 0 : ((error as { status?: number }).status ?? 0),
    }),
  };
});

const HANDOFF = new URLSearchParams({
  desktop: 'true',
  state: 'st/at+e',
  code_challenge: 'abc',
  code_challenge_method: 'S256',
  returnTo: 'https://evil.example',
});

describe('desktop hand-off helpers', () => {
  it('reads a complete hand-off and rejects partial ones', () => {
    expect(readDesktopHandoff(HANDOFF)).toEqual({ state: 'st/at+e', codeChallenge: 'abc' });
    expect(readDesktopHandoff(new URLSearchParams('desktop=true&state=x'))).toBeNull();
    expect(readDesktopHandoff(new URLSearchParams('state=x&code_challenge=y'))).toBeNull();
  });

  it('carries only the hand-off params between auth pages', () => {
    const next = withDesktopHandoff('/register', HANDOFF);
    const params = new URLSearchParams(next.split('?')[1]);
    expect(next.startsWith('/register?')).toBe(true);
    expect(params.get('state')).toBe('st/at+e');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.has('returnTo')).toBe(false);
    expect(withDesktopHandoff('/login', new URLSearchParams())).toBe('/login');
  });

  it('encodes the callback and cancel deep links', () => {
    expect(desktopCallbackUrl('c&d', 'st/at+e')).toBe(
      'onetab://auth/callback?code=c%26d&state=st%2Fat%2Be',
    );
    expect(desktopCancelUrl('s')).toBe('onetab://auth/callback?error=cancelled&state=s');
  });
});

describe('authorizeDesktopHandoff', () => {
  const handoff = { state: 'st', codeChallenge: 'ch' };

  beforeEach(() => {
    api.authorizeDesktop.mockReset();
    api.refreshSession.mockReset();
  });

  it('mints the callback link straight away for a live session', async () => {
    api.authorizeDesktop.mockResolvedValue({ code: 'abc' });
    await expect(authorizeDesktopHandoff(handoff)).resolves.toBe(
      'onetab://auth/callback?code=abc&state=st',
    );
    expect(api.refreshSession).not.toHaveBeenCalled();
  });

  it('renews an aged-out access token once and then succeeds', async () => {
    api.authorizeDesktop
      .mockRejectedValueOnce(new ApiError(401))
      .mockResolvedValueOnce({ code: 'fresh' });
    api.refreshSession.mockResolvedValue('new-token');

    await expect(authorizeDesktopHandoff(handoff)).resolves.toBe(
      'onetab://auth/callback?code=fresh&state=st',
    );
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    expect(api.authorizeDesktop).toHaveBeenCalledTimes(2);
  });

  it('surfaces a refresh the API refuses as a signed-out error, without a second mint', async () => {
    api.authorizeDesktop.mockRejectedValue(new ApiError(401));
    api.refreshSession.mockRejectedValue(new ApiError(401));

    const failure = await authorizeDesktopHandoff(handoff).catch((error: unknown) => error);
    expect(isSignedOutError(failure)).toBe(true);
    expect(api.authorizeDesktop).toHaveBeenCalledTimes(1);
  });

  it('does not renew for failures that are not about the session', async () => {
    api.authorizeDesktop.mockRejectedValue(new ApiError(500));
    const failure = await authorizeDesktopHandoff(handoff).catch((error: unknown) => error);
    expect(isSignedOutError(failure)).toBe(false);
    expect(api.refreshSession).not.toHaveBeenCalled();
  });
});
