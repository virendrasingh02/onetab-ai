import { app } from 'electron';
import { resolve } from 'node:path';
import {
  DEEP_LINK_PROTOCOLS,
  IPC_EVENT,
  type DesktopCommand,
  type DesktopDeepLink,
  type DesktopProtocolStatus,
} from '../shared/ipc.js';
import { handleAuthCallback, handleAuthCallbackError } from './auth.js';
import { JUMP_LIST_COMMANDS } from './jump-list.js';
import { triggerBackgroundSyncNow } from './background-sync.js';
import { logger } from './logger.js';
import { getMainWindow, moveMainWindowToCurrentDisplay, showMainWindow } from './window.js';

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

/** Longest link accepted; real routes are far shorter, and argv can be attacker-shaped. */
const MAX_DEEP_LINK_LENGTH = 2048;

/**
 * A link can only ever name a route *inside* the renderer, so anything that
 * could escape it — traversal, scheme-relative or backslash tricks, control
 * characters, an embedded scheme — is dropped here rather than trusted to the
 * renderer's router.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

export function isSafeRoute(route: string): boolean {
  if (route.length > MAX_DEEP_LINK_LENGTH) return false;
  if (CONTROL_OR_BACKSLASH.test(route)) return false;
  if (!route.startsWith('/') || route.startsWith('//')) return false;
  const path = route.split(/[?#]/, 1)[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (CONTROL_OR_BACKSLASH.test(decoded)) return false;
  if (decoded.split('/').some((segment) => segment === '..' || segment === '.')) return false;
  return !/^\/*[a-z][a-z0-9+.-]*:/i.test(decoded);
}

/**
 * Parses and sanitizes a custom protocol deep-link URL into a valid in-app route.
 */
export function parseDeepLink(raw: string): DesktopDeepLink | null {
  if (!raw || raw.length > MAX_DEEP_LINK_LENGTH || !isSupportedProtocol(raw)) return null;

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
    if (!isSafeRoute(route)) {
      logger.warn('DeepLink', 'Rejected an unsafe deep link route');
      return null;
    }

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

/**
 * In dev the OS must be told to launch `electron <script>`, not bare
 * `electron`, and the script path has to be absolute for that to work.
 */
function protocolClientArgs(): { path?: string; args?: string[] } {
  if (!process.defaultApp) return {};
  const script = process.argv[1];
  return script ? { path: process.execPath, args: [resolve(script)] } : {};
}

export function registerProtocol(): void {
  const { path, args } = protocolClientArgs();
  for (const protocol of DEEP_LINK_PROTOCOLS) {
    // Returns false when the OS refuses (e.g. policy-locked defaults); that is
    // worth knowing about but never fatal.
    if (!app.setAsDefaultProtocolClient(protocol, path, args)) {
      logger.warn('DeepLink', `The OS refused to register ${protocol}://`);
    }
  }
  logger.info('DeepLink', `Registered custom protocols: ${DEEP_LINK_PROTOCOLS.join(', ')}`);
}

export function removeProtocolHandler(scheme: string): boolean {
  if (!isSupportedProtocol(`${scheme}://`)) return false;
  const { path, args } = protocolClientArgs();
  const success = app.removeAsDefaultProtocolClient(scheme, path, args);
  logger.info('DeepLink', `Removed default protocol client for ${scheme}://: ${success}`);
  return success;
}

/** Whether the OS currently routes each scheme to this app (for Settings). */
export function listProtocolStatus(): DesktopProtocolStatus[] {
  const { path, args } = protocolClientArgs();
  return DEEP_LINK_PROTOCOLS.map((scheme) => ({
    scheme,
    registered: app.isDefaultProtocolClient(scheme, path, args),
  }));
}

export async function dispatchDeepLink(raw: string | undefined | null): Promise<void> {
  if (!raw) return;
  const link = parseDeepLink(raw);
  if (!link) return;

  logger.info('DeepLink', `Dispatching deep link: ${link.route}`);

  // The browser sign-in hand-off. Never forwarded to the renderer: its
  // `/auth/callback` route exists for the *browser* tab, and replaying it in
  // the shell would bounce straight back to `onetab://`. Success and every
  // failure are reported through the auth flow-status event instead.
  if (link.route.startsWith('/auth/callback')) {
    const params = link.params ?? {};
    if (params['code'] && params['state']) {
      const handled = await handleAuthCallback(params['code'], params['state'], configuredApiUrl);
      if (handled) triggerBackgroundSyncNow();
    } else if (params['error']) {
      handleAuthCallbackError(params['error'], params['state']);
    }
    showMainWindow();
    return;
  }

  const window = getMainWindow();
  if (!window || window.webContents.isLoading()) {
    pending = link;
    return;
  }

  deliver(link);
}

/**
 * `onetab://command/<name>` — the Jump List's way of acting on the running app
 * (open search, move the window) instead of navigating. Only the allowlisted
 * names do anything; any other `/command/…` link is dropped.
 */
function commandFromRoute(route: string): string | null | undefined {
  const match = /^\/command\/([a-z-]+)\/?(?:[?#].*)?$/.exec(route);
  if (!match) return route.startsWith('/command/') ? null : undefined;
  return (JUMP_LIST_COMMANDS as readonly string[]).includes(match[1]) ? match[1] : null;
}

function deliver(link: DesktopDeepLink): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) return;

  const command = commandFromRoute(link.route);
  if (command === null) {
    logger.warn('DeepLink', 'Ignored an unknown command link');
    showMainWindow();
    return;
  }
  if (command === 'move-to-current-display') {
    moveMainWindowToCurrentDisplay();
    return;
  }

  showMainWindow();
  if (command) {
    window.webContents.send(IPC_EVENT.command, command as DesktopCommand);
  } else {
    window.webContents.send(IPC_EVENT.deepLink, link);
  }
}

/** Windows and Linux pass deep link in argv. */
export function deepLinkFromArgv(argv: string[]): string | undefined {
  return argv.find((arg) => isSupportedProtocol(arg));
}

export function flushPendingDeepLink(): void {
  if (!pending) return;
  const link = pending;
  pending = null;
  deliver(link);
}
