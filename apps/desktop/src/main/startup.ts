import { app } from 'electron';
import type { DesktopStartupRequest, DesktopStartupState } from '../shared/ipc.js';
import { detectDistribution } from './capabilities.js';
import { logger } from './logger.js';
import { getPreference, setPreference } from './store.js';

/**
 * The flag the login item is registered with, so a launch by the OS can be told
 * apart from a launch by the user. macOS reports this natively
 * (`wasOpenedAtLogin`); Windows only gives us the arguments we registered.
 */
export const HIDDEN_LAUNCH_ARG = '--hidden';

function unsupportedReason(): string | null {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return 'Launch at login is not available on this operating system.';
  }
  // An unpackaged run would register `electron.exe` itself as the login item.
  if (!app.isPackaged) return 'Launch at login is only available in installed builds.';
  if (detectDistribution() === 'mac-app-store') {
    return 'Launch at login is managed by macOS for App Store builds.';
  }
  return null;
}

/** True when the OS started this process as a login item. */
export function wasLaunchedAtLogin(argv: readonly string[] = process.argv): boolean {
  if (argv.includes(HIDDEN_LAUNCH_ARG)) return true;
  if (process.platform !== 'darwin') return false;
  try {
    return app.getLoginItemSettings().wasOpenedAtLogin;
  } catch {
    return false;
  }
}

/** Whether the window should stay hidden on this launch. */
export function shouldStartHidden(argv: readonly string[] = process.argv): boolean {
  return wasLaunchedAtLogin(argv) && getPreference('startHidden', true);
}

function loginItemQuery() {
  // On Windows the registry entry is keyed by its arguments, so the query has
  // to repeat them or it reports "not a login item".
  return process.platform === 'win32' ? { args: [HIDDEN_LAUNCH_ARG] } : undefined;
}

/**
 * The OS is the source of truth for `openAtLogin`: a user can switch the item
 * off in Task Manager or System Settings, and a stale saved preference must not
 * claim otherwise.
 */
export function getStartupState(): DesktopStartupState {
  const reason = unsupportedReason();
  const startHidden = getPreference('startHidden', true);
  const launchedAtLogin = wasLaunchedAtLogin();

  if (reason) {
    return { supported: false, reason, openAtLogin: false, startHidden, launchedAtLogin };
  }

  let openAtLogin = getPreference('launchAtLogin', false);
  try {
    openAtLogin = app.getLoginItemSettings(loginItemQuery()).openAtLogin;
  } catch (error) {
    logger.warn('Startup', 'Could not read the login-item state', error);
  }
  return { supported: true, openAtLogin, startHidden, launchedAtLogin };
}

export function setStartupState(request: DesktopStartupRequest): DesktopStartupState {
  if (typeof request !== 'object' || request === null) {
    throw new TypeError('Invalid startup request.');
  }
  const current = getStartupState();
  const openAtLogin =
    typeof request.openAtLogin === 'boolean' ? request.openAtLogin : current.openAtLogin;
  const startHidden =
    typeof request.startHidden === 'boolean' ? request.startHidden : current.startHidden;

  setPreference('startHidden', startHidden);
  setPreference('launchAtLogin', openAtLogin);

  if (!current.supported) return getStartupState();

  try {
    app.setLoginItemSettings({
      openAtLogin,
      // `openAsHidden` is macOS-only and deprecated from macOS 13, where
      // `wasOpenedAtLogin` is still reported; the argument covers Windows.
      openAsHidden: startHidden,
      args: startHidden ? [HIDDEN_LAUNCH_ARG] : [],
    });
  } catch (error) {
    logger.error('Startup', 'Failed to update the login item', error);
  }

  return getStartupState();
}

/**
 * Re-applies the saved choice on launch so an app that moved (update, reinstall
 * to a new path) keeps pointing the login item at the current executable.
 */
export function syncLoginItemOnLaunch(): void {
  if (unsupportedReason()) return;
  if (!getPreference('launchAtLogin', false)) return;
  setStartupState({});
}
