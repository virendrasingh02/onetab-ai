/**
 * Invisible CAPTCHA (Cloudflare Turnstile) for the public auth routes the API
 * guards with `CaptchaGuard`. Configured once at app start with the site key;
 * with no key it does nothing and requests go out unchanged (the API guard is
 * likewise a no-op until `CAPTCHA_SECRET_KEY` is set).
 */

const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Auth routes the API protects with `CaptchaGuard`. */
const PROTECTED_PATH =
  /\/auth\/(register|login|forgot-password|password-reset\/request|magic-link(\/request|\/resend)?|email-verification\/send)$/;

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widget: string) => void;
  reset: (widget: string) => void;
  remove: (widget: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let siteKey: string | null = null;
let scriptPromise: Promise<TurnstileApi> | null = null;

export function configureCaptcha(key: string | null | undefined): void {
  siteKey = key?.trim() || null;
}

export function isCaptchaProtectedPath(url: string | undefined): boolean {
  return !!url && PROTECTED_PATH.test(url.split('?')[0]);
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error('CAPTCHA failed to load'));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('CAPTCHA failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Resolves a fresh single-use token, or `null` when CAPTCHA is not configured. */
export async function getCaptchaToken(): Promise<string | null> {
  if (!siteKey || typeof document === 'undefined') return null;
  const turnstile = await loadTurnstile();
  const host = document.createElement('div');
  document.body.appendChild(host);
  try {
    return await new Promise<string>((resolve, reject) => {
      const widget = turnstile.render(host, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token: string) => resolve(token),
        'error-callback': () => reject(new Error('CAPTCHA failed')),
        'timeout-callback': () => reject(new Error('CAPTCHA timed out')),
      });
      turnstile.execute(widget);
    });
  } finally {
    host.remove();
  }
}
