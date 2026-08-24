import { useDesktop } from './desktop-provider.js';

/**
 * Reserves the space macOS's native traffic lights sit over (positioned by
 * `trafficLightPosition` in the main process), so our own leftmost content
 * does not render underneath them.
 *
 * Self-guarding, matching `DesktopWindowControls`: nothing in the browser,
 * nothing outside macOS, nothing once full screen hides the OS chrome.
 */
export function DesktopTitleBarInset() {
  const { isDesktop, appInfo, windowState } = useDesktop();

  if (!isDesktop || !appInfo?.usesCustomTitleBar || windowState.isFullScreen) return null;
  if (appInfo.platform !== 'darwin') return null;

  return <div style={{ width: appInfo.titleBarInset }} aria-hidden />;
}
