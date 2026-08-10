import { app } from 'electron';
import { DEEP_LINK_PROTOCOL, IPC_EVENT, type DesktopDeepLink } from '../shared/ipc.js';
import { getMainWindow, showMainWindow } from './window.js';

/**
 * Deep links that arrive before the renderer is ready. The OS can launch the
 * app *with* a link, which happens long before `did-finish-load`, so the last
 * one is held here and replayed once the window exists.
 */
let pending: DesktopDeepLink | null = null;

/** `onetab://w/acme/inbox` and `onetab:///w/acme/inbox` both mean `/w/acme/inbox`. */
export function parseDeepLink(raw: string): DesktopDeepLink | null {
  if (!raw.startsWith(`${DEEP_LINK_PROTOCOL}://`)) return null;

  try {
    const url = new URL(raw);
    const path = `${url.hostname}${url.pathname}`.replace(/^\/+/, '');
    return {
      route: `/${path}${url.search}${url.hash}`,
      raw,
    };
  } catch {
    return null;
  }
}

export function registerProtocol(): void {
  if (process.defaultApp) {
    // In `electron .` dev runs the executable is Electron itself, so the OS
    // needs the script path too or it will launch a bare Electron shell.
    const script = process.argv[1];
    if (script) {
      app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, process.execPath, [script]);
    }
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
  }
}

export function dispatchDeepLink(raw: string | undefined | null): void {
  if (!raw) return;
  const link = parseDeepLink(raw);
  if (!link) return;

  const window = getMainWindow();
  if (!window || window.webContents.isLoading()) {
    pending = link;
    return;
  }

  showMainWindow();
  window.webContents.send(IPC_EVENT.deepLink, link);
}

/** Windows and Linux pass the link as an argv entry rather than an event. */
export function deepLinkFromArgv(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`));
}

export function flushPendingDeepLink(): void {
  if (!pending) return;
  const link = pending;
  pending = null;
  getMainWindow()?.webContents.send(IPC_EVENT.deepLink, link);
}
