import { app } from 'electron';
import { IPC_EVENT, type DesktopUserActivityPayload } from '../shared/ipc.js';
import { logger } from './logger.js';
import { getMainWindow, showMainWindow } from './window.js';

let pendingActivity: DesktopUserActivityPayload | null = null;

/**
 * Sets the current Apple Handoff user activity. macOS only.
 */
export function setUserActivity(
  activityType: string,
  userInfo: Record<string, unknown> = {},
  webpageURL?: string,
): boolean {
  if (process.platform !== 'darwin' || typeof app.setUserActivity !== 'function') {
    return false;
  }

  try {
    app.setUserActivity(activityType, userInfo, webpageURL);
    logger.info('Handoff', `Set user activity: ${activityType}`);
    return true;
  } catch (error) {
    logger.warn('Handoff', `Failed to set user activity ${activityType}`, error);
    return false;
  }
}

/**
 * Invalidates the current Apple Handoff user activity.
 */
export function invalidateUserActivity(): void {
  if (process.platform !== 'darwin' || typeof app.invalidateCurrentActivity !== 'function') {
    return;
  }

  try {
    app.invalidateCurrentActivity();
    logger.info('Handoff', 'Invalidated current user activity');
  } catch (error) {
    logger.warn('Handoff', 'Failed to invalidate user activity', error);
  }
}

/**
 * Gets the current activity type if any.
 */
export function getCurrentActivityType(): string | null {
  if (process.platform !== 'darwin' || typeof app.getCurrentActivityType !== 'function') {
    return null;
  }
  try {
    return app.getCurrentActivityType();
  } catch {
    return null;
  }
}

/**
 * Dispatches an activity resumed via Apple Handoff from another device.
 */
export function dispatchHandoffActivity(payload: DesktopUserActivityPayload): void {
  logger.info('Handoff', `Dispatching continued handoff activity: ${payload.activityType}`);

  const window = getMainWindow();
  if (!window || window.webContents.isLoading()) {
    pendingActivity = payload;
    return;
  }

  showMainWindow();
  window.webContents.send(IPC_EVENT.handoffActivity, payload);
}

/**
 * Flushes any pending handoff activity once the renderer has finished loading.
 */
export function flushPendingHandoff(): void {
  if (!pendingActivity) return;
  const payload = pendingActivity;
  pendingActivity = null;

  const window = getMainWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_EVENT.handoffActivity, payload);
  }
}
