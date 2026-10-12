import { beforeEach, describe, expect, it } from 'vitest';
import {
  LOGIN_RETURN_WINDOW_MS,
  buildLoginUrl,
  buildLogoutUrl,
  cameBackFromLogin,
  clearLoginRedirect,
  markLoginRedirect,
} from './auth-redirect.js';

describe('buildLoginUrl', () => {
  it('sends the visitor to the web app sign-in and back to where they were', () => {
    const url = buildLoginUrl('http://localhost:4202/agents/a1?tab=build', 'http://localhost:4200');
    expect(url).toBe(
      'http://localhost:4200/login?returnTo=http%3A%2F%2Flocalhost%3A4202%2Fagents%2Fa1%3Ftab%3Dbuild',
    );
  });

  it('tolerates a trailing slash on the web app URL', () => {
    expect(buildLoginUrl('http://studio/x', 'https://app.example.com/')).toBe(
      'https://app.example.com/login?returnTo=http%3A%2F%2Fstudio%2Fx',
    );
  });

  it('omits returnTo when there is nowhere to return to', () => {
    expect(buildLoginUrl('', 'https://app.example.com')).toBe('https://app.example.com/login');
  });
});

describe('buildLogoutUrl', () => {
  it('signs out through the web app and comes back to Studio afterwards', () => {
    expect(buildLogoutUrl('http://localhost:4202/', 'http://localhost:4200')).toBe(
      'http://localhost:4200/logout?returnTo=http%3A%2F%2Flocalhost%3A4202%2F',
    );
  });
});

describe('redirect loop guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('is off until this tab has been sent to sign in', () => {
    expect(cameBackFromLogin()).toBe(false);
  });

  it('flags a signed-out return shortly after the redirect', () => {
    markLoginRedirect(1_000);
    expect(cameBackFromLogin(1_000 + 5_000)).toBe(true);
  });

  it('lets a stale tab redirect again once the window has passed', () => {
    markLoginRedirect(1_000);
    expect(cameBackFromLogin(1_000 + LOGIN_RETURN_WINDOW_MS + 1)).toBe(false);
  });

  it('is cleared once a session is found', () => {
    markLoginRedirect(1_000);
    clearLoginRedirect();
    expect(cameBackFromLogin(1_500)).toBe(false);
  });

  it('ignores a mark from the future (clock change) instead of looping on it', () => {
    markLoginRedirect(10_000);
    expect(cameBackFromLogin(1_000)).toBe(false);
  });
});
