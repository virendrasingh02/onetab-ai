import { app } from 'electron';
import { HIDDEN_LAUNCH_ARG } from './startup.js';
import { logger } from './logger.js';
import { markQuitting } from './window.js';
import { DEEP_LINK_PROTOCOLS } from '../shared/ipc.js';

/**
 * Arguments a restart must not carry over: the deep link that started this run
 * would be replayed, and `--hidden` would hide a window the user just asked for.
 */
export function relaunchArgs(argv: readonly string[]): string[] {
  return argv.slice(1).filter((arg) => arg !== HIDDEN_LAUNCH_ARG && !DEEP_LINK_PROTOCOLS.some((protocol) => arg.startsWith(`${protocol}://`)));
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

export function quitApp(): void {
  logger.info('Lifecycle', 'Quitting application on request');
  markQuitting();
  app.quit();
}
