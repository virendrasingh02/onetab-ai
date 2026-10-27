import { Notification } from 'electron';
import { logger } from './logger.js';

/**
 * Shown the first time the window is closed into the tray. Without it the
 * window just disappears, which reads as a crash — and the people who then
 * relaunch find nothing wrong, only a second invisible copy to quit.
 */
export function showTrayHint(onClick: () => void): void {
  if (!Notification.isSupported()) return;

  try {
    const notification = new Notification({
      title: 'Onetab AI is still running',
      body:
        process.platform === 'win32'
          ? 'It keeps running in the system tray so your notifications keep arriving. Look for it near the clock (the ^ arrow), and right-click the icon to quit.'
          : 'It keeps running in the system tray so your notifications keep arriving. Right-click the tray icon to quit.',
      silent: true,
    });
    notification.on('click', onClick);
    notification.show();
  } catch (error) {
    logger.debug('Tray', 'Could not show the close-to-tray hint', error);
  }
}
