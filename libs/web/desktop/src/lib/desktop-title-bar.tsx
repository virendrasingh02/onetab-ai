import { useDesktop } from './desktop-provider.js';
import { DesktopTitleBarInset } from './desktop-title-bar-inset.js';
import { DesktopWindowControls } from './desktop-window-controls.js';
import { DRAG } from './drag-region.js';
import { useWindowChromeStore } from './window-chrome-store.js';

/**
 * The fallback window chrome: a bare drag strip plus minimise/maximise/close,
 * for screens with no header of their own to carry them.
 *
 * The shell runs frameless (`titleBarStyle: 'hidden'`) so the app owns the
 * full window height — every screen needs *some* way to move and close the
 * window. `AppHeader` draws the same drag strip and controls into its own
 * row once a workspace is open and claims the row via `useWindowChromeStore`
 * so the two never stack; this renders only while nothing has claimed it —
 * login, onboarding, the admin console.
 *
 * No app name/title text: on the screens this actually renders for there is
 * nothing to label yet, and on the screens that would have something to say
 * (a workspace name), `AppHeader` already says it one level down instead of
 * repeating it here.
 *
 * Rendered by `DesktopChrome`; returns `null` in a browser.
 */
export function DesktopTitleBar() {
  const { isDesktop, appInfo, windowState, toggleMaximize } = useDesktop();
  const claimedElsewhere = useWindowChromeStore((state) => state.claims > 0);

  // Full screen hides the OS chrome entirely; keeping our strip would leave a
  // dead bar at the top of an otherwise borderless window.
  if (!isDesktop || !appInfo?.usesCustomTitleBar || windowState.isFullScreen) return null;
  if (claimedElsewhere) return null;

  return (
    <div
      style={DRAG}
      onDoubleClick={toggleMaximize}
      className="flex h-8 shrink-0 select-none items-center gap-2 border-b border-border bg-sidebar px-2"
    >
      <DesktopTitleBarInset />

      {/* Empty drag surface where a center title used to sit — keeps the
          strip grabbable across its full width without labelling it. */}
      <div className="min-w-0 flex-1" aria-hidden />

      <DesktopWindowControls />
    </div>
  );
}
