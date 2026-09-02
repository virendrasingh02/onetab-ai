import { Button, Hint } from '@org/ui';
import { Copy, Minus, Square, X } from 'lucide-react';
import { NO_DRAG } from './drag-region.js';
import { useDesktop } from './desktop-provider.js';

/**
 * Minimise / maximise / close, drawn by us because the shell runs frameless
 * (`titleBarStyle: 'hidden'`). macOS keeps its own traffic lights, so this
 * renders nothing there — `DesktopTitleBarInset` reserves the matching space
 * on that platform instead.
 *
 * Self-guarding so any screen can drop it in without re-deriving the
 * platform/fullscreen checks: nothing in the browser, nothing on macOS,
 * nothing once full screen hides the OS chrome entirely (the controls would
 * be a dead cluster floating over an otherwise borderless window).
 */
export function DesktopWindowControls() {
  const { isDesktop, appInfo, windowState, minimize, toggleMaximize, close } =
    useDesktop();

  if (!isDesktop || !appInfo?.usesCustomTitleBar || windowState.isFullScreen)
    return null;
  if (appInfo.platform === 'darwin') return null;

  return (
    // Every interactive child must opt out of the drag region or the click
    // is swallowed by the window move handler.
    <div style={NO_DRAG} className="gap-0.5 flex items-center">
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
          aria-label={
            windowState.isMaximized ? 'Restore window' : 'Maximise window'
          }
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
  );
}
