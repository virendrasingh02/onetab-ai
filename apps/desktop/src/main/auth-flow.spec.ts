import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
const openExternal = vi.fn();

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/userData') },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
  shell: { openExternal: (url: string) => openExternal(url) },
}));

vi.mock('./window.js', () => ({
  getMainWindow: () => ({ isDestroyed: () => false, webContents: { send } }),
  showMainWindow: vi.fn(),
}));

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('node:fs', () => ({
  existsSync: () => false,
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const auth = await import('./auth.js');
const { IPC_EVENT } = await import('../shared/ipc.js');

function flowStatuses() {
  return send.mock.calls
    .filter(([channel]) => channel === IPC_EVENT.authFlowStatus)
    .map(([, status]) => status.state);
}

function pendingState(): string {
  const url = new URL(openExternal.mock.calls.at(-1)?.[0] as string);
  return url.searchParams.get('state') as string;
}

beforeEach(() => {
  send.mockClear();
  openExternal.mockReset();
  openExternal.mockResolvedValue(undefined);
});

afterEach(() => {
  auth.cancelBrowserLogin();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('browser sign-in flow', () => {
  it('opens the login page with a PKCE challenge and reports waiting', async () => {
    await auth.startBrowserLogin('http://localhost:4200');
    const url = new URL(openExternal.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('desktop')).toBe('true');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(flowStatuses()).toEqual(['waiting']);
  });

  it('opens the register page for sign-up', async () => {
    await auth.startBrowserLogin('http://localhost:4200', 'sign-up');
    expect(new URL(openExternal.mock.calls[0][0] as string).pathname).toBe('/register');
  });

  it('reports an error when the browser cannot be opened', async () => {
    openExternal.mockRejectedValue(new Error('no browser'));
    await expect(auth.startBrowserLogin('http://localhost:4200')).resolves.toBe(false);
    expect(flowStatuses()).toEqual(['error']);
  });

  it('treats a callback with no pending attempt as expired', async () => {
    await expect(auth.handleAuthCallback('code', 'state', 'http://api')).resolves.toBe(false);
    expect(flowStatuses()).toEqual(['expired']);
  });

  it('rejects a mismatched state without consuming the attempt', async () => {
    await auth.startBrowserLogin('http://localhost:4200');
    const state = pendingState();
    await auth.handleAuthCallback('code', 'someone-else', 'http://api');
    expect(flowStatuses()).toEqual(['waiting', 'error']);

    // The real callback still works afterwards.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: null, accessToken: 'a', refreshToken: 'r' }),
      }),
    );
    await expect(auth.handleAuthCallback('code', state, 'http://api')).resolves.toBe(true);
    expect(flowStatuses().at(-1)).toBe('success');

    // A duplicate of the same callback right after success stays silent.
    const before = flowStatuses().length;
    await expect(auth.handleAuthCallback('code', state, 'http://api')).resolves.toBe(false);
    expect(flowStatuses()).toHaveLength(before);
  });

  it('classifies a rejected exchange as expired', async () => {
    await auth.startBrowserLogin('http://localhost:4200');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad code' }),
    );
    await auth.handleAuthCallback('code', pendingState(), 'http://api');
    expect(flowStatuses().at(-1)).toBe('expired');
  });

  it('reports cancellation from the app and from the browser', async () => {
    await auth.startBrowserLogin('http://localhost:4200');
    auth.cancelBrowserLogin();
    expect(flowStatuses().at(-1)).toBe('cancelled');

    await auth.startBrowserLogin('http://localhost:4200');
    auth.handleAuthCallbackError('cancelled', pendingState());
    expect(flowStatuses().at(-1)).toBe('cancelled');
  });

  it('times out an abandoned attempt', async () => {
    vi.useFakeTimers();
    await auth.startBrowserLogin('http://localhost:4200');
    vi.advanceTimersByTime(auth.BROWSER_LOGIN_TIMEOUT_MS + 1);
    expect(flowStatuses().at(-1)).toBe('timeout');
    await auth.handleAuthCallback('code', 'any', 'http://api');
    expect(flowStatuses().at(-1)).toBe('expired');
  });
});
