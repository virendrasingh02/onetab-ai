import { app } from 'electron';
import { HIDDEN_LAUNCH_ARG } from './startup.js';
import { logger } from './logger.js';
import { getMainWindow, markQuitting, showMainWindow } from './window.js';
import { DEEP_LINK_PROTOCOLS } from '../shared/ipc.js';

/**
 * Arguments a restart must not carry over: the deep link that started this run
 * would be replayed, and `--hidden` would hide a window the user just asked for.
 */
export function relaunchArgs(argv: readonly string[]): string[] {
  return argv
    .slice(1)
    .filter(
      (arg) =>
        arg !== HIDDEN_LAUNCH_ARG &&
        !DEEP_LINK_PROTOCOLS.some((protocol) => arg.startsWith(`${protocol}://`)),
    );
}

/**
 * A graceful restart: relaunch is registered first, then the normal quit path
 * runs so `before-quit` / `will-quit` cleanup (shortcuts, tray, static server)
 * still happens. `app.exit()` would skip all of it.
 */
export function restartApp(): void {
  logger.info('Lifecycle', 'Restarting application');
  markQuitting();
  // An AppImage's executable path changes on every mount; APPIMAGE is stable.
  const appImage = process.env['APPIMAGE'];
  app.relaunch({
    ...(appImage ? { execPath: appImage } : {}),
    args: relaunchArgs(process.argv),
  });
  app.quit();
}

export function quitApp(exitCode?: number): void {
  logger.info('Lifecycle', `Quitting application on request (code: ${exitCode ?? 0})`);
  markQuitting();
  if (typeof exitCode === 'number' && exitCode !== 0) {
    process.exitCode = exitCode;
  }
  app.quit();
}

/**
 * Focuses the application: makes it the active app on macOS and focuses the primary window.
 */
export function focusApp(): void {
  try {
    if (typeof app.focus === 'function') {
      app.focus({ steal: true });
    }
  } catch (error) {
    logger.debug('Lifecycle', 'app.focus failed', error);
  }
  showMainWindow();
  raiseAboveForegroundLock();
}

/**
 * Windows only lets the foreground process hand out focus, and a relaunch makes
 * the short-lived second instance the foreground one - so `focus()` from here
 * just flashes the taskbar button and the window stays buried. Pinning it on
 * top for a moment is the accepted way to bring it forward anyway.
 */
function raiseAboveForegroundLock(): void {
  if (process.platform !== 'win32') return;
  const window = getMainWindow();
  if (!window || window.isDestroyed() || window.isAlwaysOnTop()) return;
  window.setAlwaysOnTop(true);
  window.moveTop();
  window.focus();
  window.setAlwaysOnTop(false);
}

/**
 * Shows the native About panel if configured.
 */
export function showAboutPanel(): void {
  try {
    if (typeof app.showAboutPanel === 'function') {
      app.showAboutPanel();
    }
  } catch (error) {
    logger.warn('Lifecycle', 'Failed to show native about panel', error);
  }
}

/**
 * Triggers dock bouncing on macOS.
 */
export function dockBounce(type: 'critical' | 'informational' = 'informational'): number {
  if (process.platform === 'darwin' && app.dock?.bounce) {
    try {
      return app.dock.bounce(type);
    } catch {
      return -1;
    }
  }
  return -1;
}
