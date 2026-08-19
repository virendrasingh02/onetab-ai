import { Button, Progress } from '@org/ui';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { useDesktop } from './desktop-provider.js';

/**
 * A one-line strip announcing an available update.
 *
 * Deliberately not a dialog or a toast: an update is never urgent enough to
 * interrupt what the user is typing, but it should stay visible until acted on,
 * which a toast would not.
 *
 * Renders nothing in the browser and nothing while idle.
 */
export function DesktopUpdateBanner() {
  const { isDesktop, appInfo, updateStatus, installUpdate, checkForUpdates } = useDesktop();

  if (!isDesktop || appInfo?.isMas) return null;

  if (updateStatus.state === 'downloading') {
    return (
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 text-[11px] text-muted-foreground">
        <Download className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="shrink-0">Downloading update…</span>
        <Progress
          value={updateStatus.percent}
          size="sm"
          label="Update download progress"
          className="max-w-48 flex-1"
        />
        <span className="tabular-nums">{updateStatus.percent}%</span>
      </div>
    );
  }

  if (updateStatus.state === 'ready') {
    return (
      <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-1 text-[11px] text-foreground">
        <RefreshCw className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="flex-1">
          Version {updateStatus.version} is ready. Restart to finish installing.
        </span>
        <Button size="sm" variant="primary" className="h-6 px-2" onClick={() => void installUpdate()}>
          Restart now
        </Button>
      </div>
    );
  }

  if (updateStatus.state === 'error') {
    return (
      <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-1 text-[11px] text-muted-foreground">
        <AlertTriangle className="size-3.5 shrink-0 text-warning-text" aria-hidden />
        <span className="flex-1 truncate" title={updateStatus.message}>
          Could not check for updates — {updateStatus.message}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2"
          onClick={() => void checkForUpdates()}
        >
          Try again
        </Button>
      </div>
    );
  }

  return null;
}
