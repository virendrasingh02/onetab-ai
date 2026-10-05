import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackAuthEvent } from './auth-analytics.js';

describe('auth-analytics', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it('safely handles missing window in non-browser environments', () => {
    // @ts-expect-error simulating server/node environment
    delete globalThis.window;

    expect(() => {
      trackAuthEvent('auth_google_started', { method: 'google' });
    }).not.toThrow();
  });

  it('pushes event to window.dataLayer and calls window.gtag when available', () => {
    const dataLayer: unknown[] = [];
    const gtag = vi.fn();
    const dispatchEvent = vi.fn();

    // @ts-expect-error mock window
    globalThis.window = {
      dataLayer,
      gtag,
      dispatchEvent,
    };

    trackAuthEvent('auth_google_started', {
      method: 'google',
      hasReturnTo: true,
    });

    expect(dataLayer).toHaveLength(1);
    const dataLayerItem = dataLayer[0] as Record<string, unknown>;
    expect(dataLayerItem.event).toBe('auth_google_started');
    expect(dataLayerItem.method).toBe('google');
    expect(dataLayerItem.hasReturnTo).toBe(true);

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'auth_google_started', expect.objectContaining({
      event: 'auth_google_started',
      method: 'google',
      hasReturnTo: true,
    }));

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('sanitizes sensitive fields like passwords, tokens, and refresh tokens', () => {
    const dataLayer: unknown[] = [];

    // @ts-expect-error mock window
    globalThis.window = {
      dataLayer,
      dispatchEvent: vi.fn(),
    };

    trackAuthEvent('auth_password_login_success', {
      method: 'password',
      // @ts-expect-error sensitive property testing
      password: 'super-secret-password',
      token: 'raw-jwt-token',
      refreshToken: 'cookie-or-token',
      accessToken: 'access-token',
      secretToken: 'sensitive-secret',
      emailDomain: 'example.com',
    });

    const dataLayerItem = dataLayer[0] as Record<string, unknown>;
    expect(dataLayerItem.password).toBeUndefined();
    expect(dataLayerItem.token).toBeUndefined();
    expect(dataLayerItem.refreshToken).toBeUndefined();
    expect(dataLayerItem.accessToken).toBeUndefined();
    expect(dataLayerItem.secretToken).toBeUndefined();
    expect(dataLayerItem.emailDomain).toBe('example.com');
  });

  it('handles analytics errors silently without throwing', () => {
    // @ts-expect-error mock window throwing
    globalThis.window = {
      dataLayer: {
        push: () => {
          throw new Error('Analytics failed');
        },
      },
      dispatchEvent: vi.fn(),
    };

    expect(() => {
      trackAuthEvent('auth_apple_started', { method: 'apple' });
    }).not.toThrow();
  });
});
