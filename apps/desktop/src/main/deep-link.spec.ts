import { describe, expect, it, vi } from 'vitest';

// `deep-link.ts` pulls in `app` at module scope, and `window.ts` behind it —
// neither loads without an Electron runtime.
vi.mock('electron', () => ({
  app: { setAsDefaultProtocolClient: vi.fn() },
  BrowserWindow: class {},
  screen: {},
  shell: {},
}));

const { deepLinkFromArgv, parseDeepLink } = await import('./deep-link.js');

describe('parseDeepLink', () => {
  it.each([
    // The OS is inconsistent about how many slashes survive, and the first
    // segment lands in `hostname` rather than `pathname` either way.
    ['onetab://w/acme/inbox', '/w/acme/inbox'],
    ['onetab:///w/acme/inbox', '/w/acme/inbox'],
    ['onetab://inbox', '/inbox'],
    ['onetab://invite/abc123', '/invite/abc123'],
    ['onetab://w/acme/search?q=hello', '/w/acme/search?q=hello'],
    ['onetab://w/acme/docs#section-2', '/w/acme/docs#section-2'],
  ])('maps %s to %s', (raw, route) => {
    expect(parseDeepLink(raw)?.route).toBe(route);
  });

  it.each([
    // Anything not on our scheme must not reach the router: these arrive from
    // the OS and are attacker-supplied as far as the app is concerned.
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
  it('finds the link Windows and Linux append to argv', () => {
    expect(deepLinkFromArgv(['electron.exe', '.', 'onetab://w/acme/inbox'])).toBe(
      'onetab://w/acme/inbox',
    );
  });

  it('returns undefined for an ordinary launch', () => {
    expect(deepLinkFromArgv(['electron.exe', '--enable-logging'])).toBeUndefined();
  });
});
