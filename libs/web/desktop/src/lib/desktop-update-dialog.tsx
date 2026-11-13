import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  Progress,
} from '@org/ui';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useDesktop } from './desktop-provider.js';

/**
 * Full update modal for desktop clients.
 *
 * Handles:
 * 1. Optional update available: opened on request (the header's Update
 *    button) to review notes and update now or defer ("Later"). Optional
 *    updates normally download in the background and never need this.
 * 2. Mandatory update required: opens by itself and stays blocking through
 *    download and restart — backdrop / Escape / "Later" are disabled.
 * 3. Downloading state: Progress bar indicator.
 * 4. Ready state: "Restart and Install" button.
 */
export function DesktopUpdateDialog({
  isOpenOverride,
  onCloseOverride,
}: {
  isOpenOverride?: boolean;
  onCloseOverride?: () => void;
} = {}) {
  const {
    isDesktop,
    updateStatus,
    downloadUpdate,
    installUpdate,
    appMetadata,
  } = useDesktop();
  if (!isDesktop) return null;

  const isAvailable = updateStatus.state === 'available';
  const isDownloading = updateStatus.state === 'downloading';
  const isReady = updateStatus.state === 'ready';

  // Carried through downloading/ready by the shell, so a required update never
  // turns dismissable halfway through.
  const isMandatory =
    (isAvailable &&
      Boolean(updateStatus.mandatory || updateStatus.forceUpdate)) ||
    ((isDownloading || isReady) && Boolean(updateStatus.mandatory));

  const currentVersion = isAvailable || isReady ? updateStatus.version : null;

  const shouldOpen =
    isMandatory ||
    Boolean(isOpenOverride && (isAvailable || isDownloading || isReady));

  const handleClose = () => {
    if (isMandatory) return; // Non-dismissible
    onCloseOverride?.();
  };

  return (
    <Dialog open={shouldOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => {
          if (isMandatory) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isMandatory) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="gap-2 flex items-center">
            {isMandatory ? (
              <div className="size-8 flex items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <ShieldAlert className="size-4" />
              </div>
            ) : (
              <div className="size-8 flex items-center justify-center rounded-md bg-accent-blue/10 text-accent-blue">
                <Sparkles className="size-4" />
              </div>
            )}
            <div>
              <DialogTitle className="text-base font-semibold">
                {isMandatory
                  ? 'Mandatory Update Required'
                  : isReady
                    ? 'Update Ready to Install'
                    : isDownloading
                      ? 'Downloading Update…'
                      : `Version ${currentVersion ?? ''} is Available`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isMandatory
                  ? 'Your current desktop version is no longer supported by the platform.'
                  : 'A new version of Onetab AI is ready for your system.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3 text-xs">
          {isMandatory && (
            <div className="p-3 space-y-1 rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
              <div className="font-semibold gap-1.5 flex items-center">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>Action Required to Continue</span>
              </div>
              <p className="text-[11px] text-destructive/90">
                To protect security and data integrity, you must update to{' '}
                {currentVersion
                  ? `version ${currentVersion}`
                  : 'the latest version'}{' '}
                or newer before resuming work.
              </p>
            </div>
          )}

          <div className="p-3 space-y-1 rounded-md bg-muted/40">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Installed Version:</span>
              <span className="font-mono">{appMetadata.version}</span>
            </div>
            {currentVersion && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Version:</span>
                <span className="font-semibold font-mono text-foreground">
                  v{currentVersion}
                </span>
              </div>
            )}
          </div>

          {/* Downloading state */}
          {isDownloading && (
            <div className="space-y-2 py-2">
              <div className="text-xs font-medium flex justify-between">
                <span>Downloading update package…</span>
                <span className="tabular-nums">{updateStatus.percent}%</span>
              </div>
              <Progress value={updateStatus.percent} className="h-2" />
            </div>
          )}

          {/* Ready state */}
          {isReady && (
            <div className="p-3 text-xs gap-2 flex items-center rounded-md border border-success/20 bg-success/10 text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                Update package verified and ready. Restart application to
                complete.
              </span>
            </div>
          )}

          {/* No in-app updater: the installer page was opened in the browser */}
          {isAvailable && updateStatus.openedInBrowser && (
            <div className="p-3 text-xs gap-2 flex items-start rounded-md border border-accent-blue/20 bg-accent-blue/10">
              <ExternalLink className="size-4 mt-0.5 shrink-0 text-accent-blue" />
              <span>
                The download page opened in your browser. Run the installer,
                then restart Onetab AI to finish updating.
              </span>
            </div>
          )}

          {/* Release Notes */}
          {isAvailable && updateStatus.releaseNotes && (
            <div className="space-y-1">
              <div className="font-medium text-foreground">
                What&apos;s New:
              </div>
              <div className="p-3 max-h-36 overflow-y-auto rounded-md border bg-card text-[11px] whitespace-pre-wrap text-muted-foreground">
                {updateStatus.releaseNotes}
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="gap-2">
          {!isMandatory && !isDownloading && (
            <Button variant="outline" size="sm" onClick={handleClose}>
              Later
            </Button>
          )}

          {isReady ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void installUpdate()}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              <span>Restart & Install</span>
            </Button>
          ) : isAvailable ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void downloadUpdate()}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              <span>
                {updateStatus.openedInBrowser
                  ? 'Open download page again'
                  : 'Update Now'}
              </span>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
