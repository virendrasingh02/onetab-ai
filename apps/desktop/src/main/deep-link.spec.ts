import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { setAsDefaultProtocolClient: vi.fn(), getPath: vi.fn(() => '/mock/userData') },
  BrowserWindow: class {},
  screen: {},
  shell: { openExternal: vi.fn() },
}));

const send = vi.fn();
const moveMainWindowToCurrentDisplay = vi.fn();
vi.mock('./window.js', () => ({
  getMainWindow: () => ({ isDestroyed: () => false, webContents: { isLoading: () => false, send } }),
  showMainWindow: vi.fn(),
  moveMainWindowToCurrentDisplay,
}));

const { deepLinkFromArgv, dispatchDeepLink, parseDeepLink, isSupportedProtocol, isSafeRoute } =
  await import('./deep-link.js');

describe('dispatchDeepLink command links (Jump List)', () => {
  it('sends allowlisted commands to the renderer instead of navigating', async () => {
    send.mockClear();
    await dispatchDeepLink('onetab://command/open-search');
    expect(send).toHaveBeenCalledWith('onetab:event/command', 'open-search');
  });

  it('moves the window for move-to-current-display without telling the renderer', async () => {
    send.mockClear();
    await dispatchDeepLink('onetab://command/move-to-current-display');
    expect(moveMainWindowToCurrentDisplay).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('drops unknown commands', async () => {
    send.mockClear();
    await dispatchDeepLink('onetab://command/quit-everything');
    expect(send).not.toHaveBeenCalled();
  });

  it('still forwards ordinary routes as deep links', async () => {
    send.mockClear();
    await dispatchDeepLink('onetab://w/acme');
    expect(send).toHaveBeenCalledWith('onetab:event/deep-link', expect.objectContaining({ route: '/w/acme' }));
  });
});

describe('isSupportedProtocol', () => {
  it('accepts onetab and mie protocols', () => {
    expect(isSupportedProtocol('onetab://open')).toBe(true);
    expect(isSupportedProtocol('mie://chat/123')).toBe(true);
  });

  it('rejects unsupported protocols', () => {
    expect(isSupportedProtocol('https://example.com')).toBe(false);
    expect(isSupportedProtocol('file:///etc/passwd')).toBe(false);
    expect(isSupportedProtocol('javascript:alert(1)')).toBe(false);
  });
});

describe('parseDeepLink', () => {
  it.each([
    ['onetab://w/acme/inbox', '/w/acme/inbox'],
    ['onetab:///w/acme/inbox', '/w/acme/inbox'],
    ['onetab://inbox', '/inbox'],
    ['onetab://invite/abc123', '/invite/abc123'],
    ['onetab://w/acme/search?q=hello', '/w/acme/search?q=hello'],
    ['onetab://w/acme/docs#section-2', '/w/acme/docs#section-2'],
    ['mie://open', '/open'],
    ['mie://chat/123', '/chat/123'],
    ['mie://agent/coder-456', '/agent/coder-456'],
    ['mie://workflow/wf-789', '/workflow/wf-789'],
    ['mie://notification/notif-101', '/notification/notif-101'],
    ['mie://settings', '/settings'],
    ['onetab://auth/callback?code=abc123xyz&state=state_nonce', '/auth/callback?code=abc123xyz&state=state_nonce'],
  ])('maps %s to %s', (raw, route) => {
    const link = parseDeepLink(raw);
    expect(link?.route).toBe(route);
  });

  it('extracts query parameters properly', () => {
    const link = parseDeepLink('onetab://auth/callback?code=secret_code_123&state=my_nonce_state');
    expect(link).not.toBeNull();
    expect(link?.params?.['code']).toBe('secret_code_123');
    expect(link?.params?.['state']).toBe('my_nonce_state');
  });

  it.each([
    'https://evil.example/x',
    'file:///etc/passwd',
    'onetabx://w/acme',
    'not a url',
    '',
  ])('rejects %s', (raw) => {
    expect(parseDeepLink(raw)).toBeNull();
  });
});

describe('deepLinkFromArgv', () => {
  it('finds onetab:// link in argv', () => {
    expect(deepLinkFromArgv(['electron.exe', '.', 'onetab://w/acme/inbox'])).toBe(
      'onetab://w/acme/inbox',
    );
  });

  it('finds mie:// link in argv', () => {
    expect(deepLinkFromArgv(['electron.exe', '.', 'mie://agent/coder-1'])).toBe(
      'mie://agent/coder-1',
    );
  });

  it('returns undefined for an ordinary launch without deep links', () => {
    expect(deepLinkFromArgv(['electron.exe', '--enable-logging'])).toBeUndefined();
  });
});

describe('deep link destination safety', () => {
  it.each([
    `onetab://w/acme/${'a'.repeat(3000)}`,
    'onetab://w/acme/%00',
    'onetab://w/acme/%0d%0a',
  ])('rejects %s', (raw) => {
    expect(parseDeepLink(raw)).toBeNull();
  });

  // The WHATWG URL parser resolves dot segments (including %2e) before we see
  // the path, so these cannot escape: whatever survives is a normal in-app route.
  it.each([
    'onetab://w/acme/../../etc',
    'onetab://w/acme/%2e%2e/admin',
    'onetab:////evil.example/x',
  ])('never yields a traversal or scheme-relative route for %s', (raw) => {
    const route = parseDeepLink(raw)?.route;
    if (route === undefined) return;
    expect(route.startsWith('/')).toBe(true);
    expect(route.startsWith('//')).toBe(false);
    expect(route.split('/')).not.toContain('..');
  });

  it('isSafeRoute rejects traversal, backslashes and embedded schemes directly', () => {
    expect(isSafeRoute('/w/../x')).toBe(false);
    expect(isSafeRoute('/w/%2e%2e/x')).toBe(false);
    expect(isSafeRoute('/w\\evil')).toBe(false);
    expect(isSafeRoute('//evil.example')).toBe(false);
    expect(isSafeRoute('/javascript:alert(1)')).toBe(false);
    expect(isSafeRoute('/w/acme/inbox?x=1#y')).toBe(true);
  });

  it('still accepts ordinary routes with queries', () => {
    expect(parseDeepLink('onetab://w/acme/search?q=a%20b')?.route).toBe('/w/acme/search?q=a%20b');
  });
});
