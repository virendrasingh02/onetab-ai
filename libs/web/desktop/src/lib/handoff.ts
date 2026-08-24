import { getDesktopApi, isDesktop, openExternal } from './desktop-api.js';

export interface OpenAppOrWebOptions {
  route: string;
  fallbackUrl?: string;
}

export interface DesktopDetectionOptions {
  desktopUrl: string;
  webUrl: string;
  timeout?: number;
}

const DEFAULT_WEB_BASE_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ||
  (import.meta.env?.['VITE_APP_URL'] as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200');

/**
 * Opens a route in the desktop app if available, or navigates in the web browser.
 */
export async function openAppOrWeb(options: OpenAppOrWebOptions): Promise<boolean> {
  const api = getDesktopApi();
  if (api) {
    return api.handoff.openAppOrWeb(options);
  }

  const cleanRoute = options.route.startsWith('/') ? options.route : `/${options.route}`;
  const desktopProtocolUrl = `onetab:/${cleanRoute}`;
  const webTarget = options.fallbackUrl || `${DEFAULT_WEB_BASE_URL}${cleanRoute}`;

  return openDesktopOrFallback({
    desktopUrl: desktopProtocolUrl,
    webUrl: webTarget,
  });
}

/**
 * Attempts to launch a desktop deep-link with a graceful timeout fallback to web application.
 */
export async function openDesktopOrFallback({
  desktopUrl,
  webUrl,
  timeout = 1500,
}: DesktopDetectionOptions): Promise<boolean> {
  if (isDesktop) {
    window.location.href = desktopUrl;
    return true;
  }

  if (typeof window === 'undefined') return false;

  return new Promise<boolean>((resolve) => {
    let hasHidden = false;

    const onVisibilityChange = () => {
      if (document.hidden) {
        hasHidden = true;
      }
    };

    const onBlur = () => {
      hasHidden = true;
    };

    document.addEventListener('visibilitychange', onVisibilityChange, { once: true });
    window.addEventListener('blur', onBlur, { once: true });

    // Attempt protocol launch
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = desktopUrl;
    document.body.appendChild(iframe);

    setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      try {
        document.body.removeChild(iframe);
      } catch {
        // ignore
      }

      if (!hasHidden) {
        // Desktop app did not handle or launch, navigate to web fallback
        window.location.href = webUrl;
        resolve(false);
      } else {
        resolve(true);
      }
    }, timeout);
  });
}

/**
 * Opens an in-app path inside the external web browser from desktop client.
 */
export async function openInBrowser(route: string): Promise<boolean> {
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;
  const fullUrl = `${DEFAULT_WEB_BASE_URL}${cleanRoute}`;
  return openExternal(fullUrl);
}
