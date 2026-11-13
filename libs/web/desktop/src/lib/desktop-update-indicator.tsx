import { Button, Hint } from '@org/ui';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useDesktop } from './desktop-provider.js';
import { DesktopUpdateDialog } from './desktop-update-dialog.js';

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
  const { isDesktop, updateStatus, installUpdate, checkForUpdates } =
    useDesktop();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!isDesktop) return null;

  // Mounted in every state: it opens itself (and stays open) for a mandatory
  // update, and on request otherwise.
  const dialog = (
    <DesktopUpdateDialog
      isOpenOverride={dialogOpen}
      onCloseOverride={() => setDialogOpen(false)}
    />
  );

  if (updateStatus.state === 'available') {
    return (
      <>
        {dialog}
        <Hint
          label={
            updateStatus.mandatory
              ? 'Mandatory update required'
              : `Version ${updateStatus.version} is available`
          }
        >
          <Button
            variant={updateStatus.mandatory ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setDialogOpen(true)}
            aria-label={`Update to version ${updateStatus.version}`}
            className="gap-1 px-2 text-xs font-medium h-7 cursor-pointer"
          >
            <Download className="size-3.5" />
            <span className="sm:inline hidden">
              {updateStatus.mandatory ? 'Update Required' : 'Update'}
            </span>
          </Button>
        </Hint>
      </>
    );
  }

  if (updateStatus.state === 'downloading') {
    return (
      <>
        {dialog}
        <Hint label={`Downloading update… ${updateStatus.percent}%`}>
          <div className="gap-1.5 px-2 h-7 text-xs font-medium flex items-center rounded-md text-muted-foreground">
            <Download
              className="size-3.5 animate-pulse shrink-0 text-primary"
              aria-hidden
            />
            <span className="tabular-nums">{updateStatus.percent}%</span>
          </div>
        </Hint>
      </>
    );
  }

  if (updateStatus.state === 'ready') {
    return (
      <>
        {dialog}
        <Hint
          label={`Version ${updateStatus.version} is ready — restart to finish installing`}
        >
          <Button
            variant="primary"
            size="sm"
            onClick={() => void installUpdate()}
            aria-label="Restart to install update"
            className="gap-1 px-2 text-xs font-medium h-7 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span className="sm:inline hidden">Restart to update</span>
          </Button>
        </Hint>
      </>
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
