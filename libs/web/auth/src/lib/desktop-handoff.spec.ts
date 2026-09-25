import {
  desktopCallbackUrl,
  desktopCancelUrl,
  readDesktopHandoff,
  withDesktopHandoff,
} from './desktop-handoff.js';

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
