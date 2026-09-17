import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { setBadgeCount: vi.fn() },
  Notification: Object.assign(
    vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      show: vi.fn(),
    })),
    { isSupported: vi.fn(() => true) },
  ),
}));

const loadSecureSession = vi.fn();
const refreshSecureSession = vi.fn();
vi.mock('./auth.js', () => ({
  loadSecureSession: (...args: unknown[]) => loadSecureSession(...args),
  refreshSecureSession: (...args: unknown[]) => refreshSecureSession(...args),
}));

const setTrayBadge = vi.fn();
vi.mock('./tray.js', () => ({
  setTrayBadge: (...args: unknown[]) => setTrayBadge(...args),
}));

const getMainWindow = vi.fn(() => null);
const showMainWindow = vi.fn();
vi.mock('./window.js', () => ({
  getMainWindow: (...args: unknown[]) => getMainWindow(...args),
  showMainWindow: (...args: unknown[]) => showMainWindow(...args),
}));

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { pollOnce: pollOnceForTest, resetBadgeOnSignOut, setApiUrlForBackgroundSync } = await import(
  './background-sync.js'
);

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('background sync poll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setApiUrlForBackgroundSync('http://api.test');
    getMainWindow.mockReturnValue(null);
  });

  it('does nothing when signed out', async () => {
    loadSecureSession.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await pollOnceForTest();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setTrayBadge).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sums unread counts across every workspace onto the badge', async () => {
    loadSecureSession.mockReturnValue({ accessToken: 'token-a' });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/workspaces')) {
        return jsonResponse([
          { id: 'w1', slug: 'acme' },
          { id: 'w2', slug: 'globex' },
        ]);
      }
      if (url.includes('/workspaces/w1/notifications/unread-count')) {
        return jsonResponse({ count: 3 });
      }
      if (url.includes('/workspaces/w2/notifications/unread-count')) {
        return jsonResponse({ count: 5 });
      }
      if (url.includes('/notifications?unreadOnly=true')) {
        return jsonResponse({ items: [] });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await pollOnceForTest();

    expect(setTrayBadge).toHaveBeenCalledWith(8);
    vi.unstubAllGlobals();
  });

  it('refreshes an expired access token once and retries', async () => {
    loadSecureSession.mockReturnValue({ accessToken: 'stale' });
    refreshSecureSession.mockResolvedValue({ accessToken: 'fresh' });

    const fetchMock = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      const auth = init?.headers?.['Authorization'];
      if (url.endsWith('/workspaces')) {
        if (auth === 'Bearer stale') return jsonResponse(null, 401);
        return jsonResponse([{ id: 'w1', slug: 'acme' }]);
      }
      if (url.includes('unread-count')) return jsonResponse({ count: 1 });
      if (url.includes('unreadOnly=true')) return jsonResponse({ items: [] });
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await pollOnceForTest();

    expect(refreshSecureSession).toHaveBeenCalledTimes(1);
    expect(setTrayBadge).toHaveBeenCalledWith(1);
    vi.unstubAllGlobals();
  });

  it('does not fire a native notification for the same id twice', async () => {
    loadSecureSession.mockReturnValue({ accessToken: 'token-a' });
    const { Notification } = await import('electron');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/workspaces')) return jsonResponse([{ id: 'w1', slug: 'acme' }]);
      if (url.includes('unread-count')) return jsonResponse({ count: 1 });
      if (url.includes('unreadOnly=true')) {
        return jsonResponse({
          items: [{ id: 'n1', title: 'New mention', body: 'hi', deepLink: 'inbox' }],
        });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await pollOnceForTest();
    await pollOnceForTest();

    expect(Notification).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('suppresses native notifications while the window is foreground, but keeps the badge live', async () => {
    loadSecureSession.mockReturnValue({ accessToken: 'token-a' });
    getMainWindow.mockReturnValue({
      isDestroyed: () => false,
      isVisible: () => true,
      isFocused: () => true,
    });
    const { Notification } = await import('electron');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/workspaces')) return jsonResponse([{ id: 'w1', slug: 'acme' }]);
      if (url.includes('unread-count')) return jsonResponse({ count: 2 });
      if (url.includes('unreadOnly=true')) {
        throw new Error('should not fetch recent notifications while foreground');
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await pollOnceForTest();

    expect(Notification).not.toHaveBeenCalled();
    expect(setTrayBadge).toHaveBeenCalledWith(2);
    vi.unstubAllGlobals();
  });

  it('resetBadgeOnSignOut zeroes the badge', () => {
    resetBadgeOnSignOut();
    expect(setTrayBadge).toHaveBeenCalledWith(0);
  });
});
