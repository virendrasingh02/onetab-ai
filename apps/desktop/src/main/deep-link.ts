import { app } from 'electron';
import {
  DEEP_LINK_PROTOCOLS,
  IPC_EVENT,
  type DesktopDeepLink,
} from '../shared/ipc.js';
import { handleAuthCallback } from './auth.js';
import { logger } from './logger.js';
import { getMainWindow, showMainWindow } from './window.js';

let pending: DesktopDeepLink | null = null;
let configuredApiUrl = 'http://localhost:3000/api/v1';

export function setApiUrlForDeepLinks(url: string): void {
  configuredApiUrl = url;
}

/**
 * Validates protocol against allowed schemes (`onetab://` and `mie://`).
 */
export function isSupportedProtocol(raw: string): boolean {
  for (const protocol of DEEP_LINK_PROTOCOLS) {
    if (raw.startsWith(`${protocol}://`)) return true;
  }
  return false;
}

/**
 * Parses and sanitizes a custom protocol deep-link URL into a valid in-app route.
 */
export function parseDeepLink(raw: string): DesktopDeepLink | null {
  if (!raw || !isSupportedProtocol(raw)) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname;
    const pathname = url.pathname;

    const cleanPath = `${host}${pathname}`.replace(/^\/+/, '');

    // Normalize well-known short links:
    // mie://chat/123 -> /chat/123 or /w/default/chat/123
    // mie://agent/123 -> /agents/123/chat
    // onetab://auth/callback -> /auth/callback
    const params: Record<string, string> = {};
    for (const [k, v] of url.searchParams.entries()) {
      params[k] = v;
    }

    const route = `/${cleanPath}${url.search}${url.hash}`;

    return {
      route,
      raw,
      params,
    };
  } catch (error) {
    logger.warn('DeepLink', 'Failed to parse malformed deep link', { raw, error });
    return null;
  }
}

export function registerProtocol(): void {
  for (const protocol of DEEP_LINK_PROTOCOLS) {
    if (process.defaultApp) {
      const script = process.argv[1];
      if (script) {
        app.setAsDefaultProtocolClient(protocol, process.execPath, [script]);
      }
    } else {
      app.setAsDefaultProtocolClient(protocol);
    }
  }
  logger.info('DeepLink', `Registered custom protocols: ${DEEP_LINK_PROTOCOLS.join(', ')}`);
}

export async function dispatchDeepLink(raw: string | undefined | null): Promise<void> {
  if (!raw) return;
  const link = parseDeepLink(raw);
  if (!link) return;

  logger.info('DeepLink', `Dispatching deep link: ${link.route}`);

  // Special handling for auth callback
  if (link.route.startsWith('/auth/callback') && link.params?.['code'] && link.params?.['state']) {
    const handled = await handleAuthCallback(
      link.params['code'],
      link.params['state'],
      configuredApiUrl,
    );
    if (handled) {
      // Do not navigate renderer to raw auth callback query; the auth session change event will route to workspace
      return;
    }
  }

  const window = getMainWindow();
  if (!window || window.webContents.isLoading()) {
    pending = link;
    return;
  }

  showMainWindow();
  window.webContents.send(IPC_EVENT.deepLink, link);
}

/** Windows and Linux pass deep link in argv. */
export function deepLinkFromArgv(argv: string[]): string | undefined {
  return argv.find((arg) => isSupportedProtocol(arg));
}

export function flushPendingDeepLink(): void {
  if (!pending) return;
  const link = pending;
  pending = null;
  const window = getMainWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_EVENT.deepLink, link);
  }
}
