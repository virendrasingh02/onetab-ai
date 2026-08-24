import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { setAsDefaultProtocolClient: vi.fn(), getPath: vi.fn(() => '/mock/userData') },
  BrowserWindow: class {},
  screen: {},
  shell: { openExternal: vi.fn() },
}));

const { deepLinkFromArgv, parseDeepLink, isSupportedProtocol } = await import('./deep-link.js');

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
