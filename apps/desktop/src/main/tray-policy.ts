export const MINIMIZE_TO_TRAY_KEY = 'minimizeToTray';
export const TRAY_HINT_SHOWN_KEY = 'trayHintShown';

/**
 * Whether closing the window keeps the app running in the tray, before the
 * user has chosen. Windows and macOS have a dependable tray / menu bar, and a
 * chat app that quits when its window closes silently stops delivering
 * notifications. Linux desktops frequently have no tray at all (stock GNOME),
 * where hiding the window would leave nothing to click — it stays opt-in there.
 */
export function defaultMinimizeToTray(platform: NodeJS.Platform): boolean {
  return platform === 'win32' || platform === 'darwin';
}

/**
 * - `quit`: let the close go through (the app exits with its last window on
 *   Windows/Linux).
 * - `hide`: keep running in the tray.
 * - `hide-with-hint`: same, but this is the first time, and a window that
 *   vanishes with no explanation reads as the app having crashed.
 */
export type CloseAction = 'quit' | 'hide' | 'hide-with-hint';

export function resolveCloseAction(state: {
  quitting: boolean;
  minimizeToTray: boolean;
  hintShown: boolean;
  /** macOS keeps the app in the Dock by convention, so no explanation is needed. */
  platform: NodeJS.Platform;
}): CloseAction {
  if (state.quitting || !state.minimizeToTray) return 'quit';
  if (state.hintShown || state.platform === 'darwin') return 'hide';
  return 'hide-with-hint';
}
