import { Button, Hint } from '@org/ui';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { useDesktop } from './desktop-provider.js';

/**
 * A compact "app update" control meant to dock next to the profile menu —
 * the desktop equivalent of the small update dot most native apps hang off
 * the account avatar, rather than a strip of its own above the content.
 *
 * A full-width banner cost every screen a permanent row for something that
 * is background information the rest of the time, and it only ever said
 * anything in the "downloading" / "ready" / "error" states — `available`
 * (an update exists but hasn't started downloading) fell through and showed
 * nothing at all. This covers every state that needs an action and renders
 * next to the identity control users already glance at, instead of a row
 * users had to notice was new.
 *
 * `DesktopSettingsCard` remains the full detail view (version, "Check for
 * updates" when idle) — this is only the in-the-moment nudge.
 *
 * Renders nothing in the browser, and nothing while there is no update to
 * act on (`idle` / `checking` / `not-available` / `unsupported`).
 */
export function DesktopUpdateIndicator() {
  const { isDesktop, updateStatus, downloadUpdate, installUpdate, checkForUpdates } = useDesktop();

  if (!isDesktop) return null;

  if (updateStatus.state === 'available') {
    return (
      <Hint label={`Version ${updateStatus.version} is available`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void downloadUpdate()}
          aria-label={`Download version ${updateStatus.version}`}
          className="gap-1 px-2 text-xs font-medium h-7 cursor-pointer"
        >
          <Download className="size-3.5" />
          <span className="sm:inline hidden">Update</span>
        </Button>
      </Hint>
    );
  }

  if (updateStatus.state === 'downloading') {
    return (
      <Hint label={`Downloading update… ${updateStatus.percent}%`}>
        <div className="gap-1.5 px-2 h-7 text-xs font-medium text-muted-foreground flex items-center rounded-md">
          <Download className="size-3.5 shrink-0 animate-pulse text-primary" aria-hidden />
          <span className="tabular-nums">{updateStatus.percent}%</span>
        </div>
      </Hint>
    );
  }

  if (updateStatus.state === 'ready') {
    return (
      <Hint label={`Version ${updateStatus.version} is ready — restart to finish installing`}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void installUpdate()}
          aria-label="Restart to install update"
          className="gap-1 px-2 text-xs font-medium h-7 cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          <span className="sm:inline hidden">Restart</span>
        </Button>
      </Hint>
    );
  }

  if (updateStatus.state === 'error') {
    return (
      <Hint label={`Could not check for updates — ${updateStatus.message}`}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void checkForUpdates()}
          aria-label="Retry checking for updates"
          className="size-7 rounded-md text-warning-text hover:text-warning-text"
        >
          <AlertTriangle className="size-3.5" />
        </Button>
      </Hint>
    );
  }

  return null;
}
