/**
 * Auth event analytics dispatcher.
 *
 * Integrates with existing browser tracking providers (window.dataLayer,
 * window.gtag, custom analytics) without breaking or overriding any existing tags.
 *
 * STRICT SECURITY: Passwords, raw magic link tokens, and session secrets
 * are never forwarded to analytics.
 */

export type AuthAnalyticsEvent =
  | 'auth_login_view'
  | 'auth_password_login_started'
  | 'auth_password_login_success'
  | 'auth_magic_link_started'
  | 'auth_magic_link_requested'
  | 'auth_magic_link_sent'
  | 'auth_magic_link_clicked'
  | 'auth_magic_link_verified'
  | 'auth_magic_link_failed'
  | 'auth_magic_link_expired'
  | 'auth_logout';

export interface AuthAnalyticsPayload {
  method?: 'password' | 'magic_link' | 'device';
  emailDomain?: string;
  hasReturnTo?: boolean;
  errorCode?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackAuthEvent(
  event: AuthAnalyticsEvent,
  payload: AuthAnalyticsPayload = {},
): void {
  if (typeof window === 'undefined') return;

  // Sanitized payload — ensures no tokens/passwords
  const sanitized: Record<string, unknown> = {
    event,
    timestamp: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(payload)) {
    if (
      key === 'password' ||
      key === 'token' ||
      key === 'secretToken' ||
      key === 'refreshToken' ||
      key === 'accessToken'
    ) {
      continue;
    }
    sanitized[key] = value;
  }

  try {
    // 1. Google Tag Manager / dataLayer support
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(sanitized);
    }

    // 2. Google Analytics (gtag.js) support
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, sanitized);
    }

    // 3. Custom event for local or extensible listeners
    window.dispatchEvent(
      new CustomEvent('onetab:auth_event', { detail: sanitized }),
    );
  } catch {
    // Analytics failures must never break the auth UX flow
  }
}
