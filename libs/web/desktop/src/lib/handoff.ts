import { useEffect, useState } from 'react';
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

export interface OpenDesktopAppOptions {
  route: string;
  requestId?: string;
  params?: Record<string, string>;
  fallbackUrl?: string;
  timeout?: number;
}

const DEFAULT_WEB_BASE_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ||
  (import.meta.env?.['VITE_APP_URL'] as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200');

/**
 * Checks if the current client is running on a mobile device or browser.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  const isSmallScreen = window.innerWidth <= 768;
  return mobileRegex.test(userAgent) || isSmallScreen;
}

/**
 * React hook that returns whether the client is on a mobile device/viewport.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileDevice());

  useEffect(() => {
    const check = () => setIsMobile(isMobileDevice());
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

/**
 * Opens a route in the desktop app if available, or navigates in the web browser.
 */
export async function openAppOrWeb(options: OpenAppOrWebOptions): Promise<boolean> {
  const api = getDesktopApi();
  if (api) {
    return api.handoff.openAppOrWeb(options);
  }

  const cleanRoute = options.route.startsWith('/') ? options.route : `/${options.route}`;
  const desktopProtocolUrl = `mie:/${cleanRoute}`;
  const webTarget = options.fallbackUrl || `${DEFAULT_WEB_BASE_URL}${cleanRoute}`;

  return openDesktopOrFallback({
    desktopUrl: desktopProtocolUrl,
    webUrl: webTarget,
  });
}

/**
 * Seamlessly triggers the desktop application protocol from mobile/web with requestId/params.
 */
export async function openDesktopApp({
  route,
  requestId,
  params = {},
  fallbackUrl,
  timeout = 1500,
}: OpenDesktopAppOptions): Promise<boolean> {
  const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
  const query = new URLSearchParams();

  if (requestId) {
    query.set('request', requestId);
  }
  for (const [k, v] of Object.entries(params)) {
    query.set(k, v);
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const desktopProtocolUrl = `mie://${cleanRoute}${queryString}`;
  const defaultWebTarget = fallbackUrl || `${DEFAULT_WEB_BASE_URL}/${cleanRoute}${queryString}`;

  return openDesktopOrFallback({
    desktopUrl: desktopProtocolUrl,
    webUrl: defaultWebTarget,
    timeout,
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

    // Attempt protocol launch via hidden iframe or location dispatch
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
        if (webUrl) {
          window.location.href = webUrl;
        }
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
