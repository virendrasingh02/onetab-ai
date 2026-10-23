import { describe, expect, it, vi } from 'vitest';

vi.mock('@org/web-desktop', () => ({ getDesktopApi: () => undefined }));

import { isPublicAuthPath, redirectPathFromAuthState } from './use-auth.js';

describe('isPublicAuthPath', () => {
  it('keeps signed-out visitors on invitation and auth pages', () => {
    expect(isPublicAuthPath('/invite/abc123')).toBe(true);
    expect(isPublicAuthPath('/login')).toBe(true);
    expect(isPublicAuthPath('/auth/magic-link/verify')).toBe(true);
    expect(isPublicAuthPath('/verify-email')).toBe(true);
  });

  it('treats workspace pages as protected', () => {
    expect(isPublicAuthPath('/w/acme')).toBe(false);
    expect(isPublicAuthPath('/workspaces/new')).toBe(false);
    expect(isPublicAuthPath('/')).toBe(false);
  });
});

describe('redirectPathFromAuthState', () => {
  it('returns to the stashed location after sign-in', () => {
    expect(
      redirectPathFromAuthState({ from: { pathname: '/w/acme/c/general', search: '?msg=1', hash: '' } }),
    ).toBe('/w/acme/c/general?msg=1');
    expect(redirectPathFromAuthState(null, '/x')).toBe('/x');
  });
});
