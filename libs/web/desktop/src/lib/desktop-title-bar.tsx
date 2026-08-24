import { Button, Hint } from '@org/ui';
import { Copy, Minus, Square, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useDesktop } from './desktop-provider.js';

/**
 * `-webkit-app-region` has no Tailwind utility and is not a standard CSS
 * property, so it is applied inline rather than through an arbitrary class that
 * a future Tailwind upgrade might reinterpret.
 */
const DRAG: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties;
const NO_DRAG: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties;

/**
 * The window's own title bar.
 *
 * The shell runs frameless (`titleBarStyle: 'hidden'`) so the app owns the full
 * window height — which means the drag region and the minimise/maximise/close
 * buttons are ours to draw. macOS still renders its traffic lights, so there
 * only the drag strip and a left inset are needed.
 *
 * Deliberately no app name/title text: the workspace name and every action a
 * user can take already live one row down in `AppHeader`, so a center label
 * here would only repeat chrome the app has elsewhere. What is left is a bare
 * drag strip — window controls stay pinned to the corner a user expects them
 * in (the OS convention `DesktopTitleBar` mirrors), rather than drifting down
 * toward content-level UI like the profile menu.
 *
 * Rendered by `AppShell`; returns `null` in a browser.
 */
export function DesktopTitleBar() {
  const { isDesktop, appInfo, windowState, minimize, toggleMaximize, close } = useDesktop();

  // Full screen hides the OS chrome entirely; keeping our strip would leave a
  // dead bar at the top of an otherwise borderless window.
  if (!isDesktop || !appInfo?.usesCustomTitleBar || windowState.isFullScreen) return null;

  const isMac = appInfo.platform === 'darwin';

  return (
    <div
      style={DRAG}
      onDoubleClick={toggleMaximize}
      className="flex h-8 shrink-0 select-none items-center gap-2 border-b border-border bg-sidebar px-2"
    >
      {isMac ? <div style={{ width: appInfo.titleBarInset }} aria-hidden /> : null}

      {/* Empty drag surface where a center title used to sit — keeps the
          strip grabbable across its full width without labelling it. */}
      <div className="min-w-0 flex-1" aria-hidden />

      {isMac ? null : (
        // Every interactive child must opt out of the drag region or the click
        // is swallowed by the window move handler.
        <div style={NO_DRAG} className="flex items-center gap-0.5">
          <Hint label="Minimise">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-sm"
              onClick={minimize}
              aria-label="Minimise window"
            >
              <Minus className="size-3.5" />
            </Button>
          </Hint>

          <Hint label={windowState.isMaximized ? 'Restore' : 'Maximise'}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-sm"
              onClick={toggleMaximize}
              aria-label={windowState.isMaximized ? 'Restore window' : 'Maximise window'}
            >
              {windowState.isMaximized ? (
                <Copy className="size-3" />
              ) : (
                <Square className="size-3" />
              )}
            </Button>
          </Hint>

          <Hint label="Close">
            <Button
              variant="ghost"
              size="icon-sm"
              /* Native window chrome turns the close control red on hover; the
                 destructive token is that red, and unlike the literal it keeps
                 its paired foreground legible in both themes. */
              className="size-7 rounded-sm hover:bg-destructive hover:text-destructive-foreground"
              onClick={close}
              aria-label="Close window"
            >
              <X className="size-3.5" />
            </Button>
          </Hint>
        </div>
      )}
    </div>
  );
}
