import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Progress } from '@org/ui';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useDesktop } from './desktop-provider.js';

/**
 * Full update modal for desktop clients.
 *
 * Handles:
 * 1. Optional update available: User can review release notes, choose to update now, or defer ("Later").
 * 2. Mandatory update required: The client is below the minimum supported version or the release was marked mandatory.
 *    The dialog is blocking, backdrop clicking / closing is disabled, and the user must update to continue.
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
  const { isDesktop, updateStatus, downloadUpdate, installUpdate, appMetadata } = useDesktop();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  if (!isDesktop) return null;

  const isAvailable = updateStatus.state === 'available';
  const isDownloading = updateStatus.state === 'downloading';
  const isReady = updateStatus.state === 'ready';

  const isMandatory =
    isAvailable && Boolean(updateStatus.mandatory || updateStatus.forceUpdate);

  const currentVersion = isAvailable ? updateStatus.version : isReady ? updateStatus.version : null;

  // If the user dismissed an optional update, keep it hidden until explicit click
  const isDismissed = !isMandatory && currentVersion && dismissedVersion === currentVersion;

  const shouldOpen =
    isOpenOverride ?? ((isMandatory || (isAvailable && !isDismissed) || isDownloading || isReady) && Boolean(currentVersion));

  const handleClose = () => {
    if (isMandatory) return; // Non-dismissible
    if (currentVersion) setDismissedVersion(currentVersion);
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
          <div className="flex items-center gap-2">
            {isMandatory ? (
              <div className="size-8 rounded-md bg-destructive/10 text-destructive flex items-center justify-center">
                <ShieldAlert className="size-4" />
              </div>
            ) : (
              <div className="size-8 rounded-md bg-accent-blue/10 text-accent-blue flex items-center justify-center">
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
                  : `Version ${updateStatus.state === 'available' ? updateStatus.version : ''} is Available`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isMandatory
                  ? 'Your current desktop version is no longer supported by the platform.'
                  : 'A new version of OneTab AI is ready for your system.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {isMandatory && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>Action Required to Continue</span>
              </div>
              <p className="text-[11px] text-destructive/90">
                To protect security and data integrity, you must update to version {updateStatus.state === 'available' ? updateStatus.version : ''} or newer before resuming work.
              </p>
            </div>
          )}

          <div className="bg-muted/40 p-3 rounded-md space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Installed Version:</span>
              <span className="font-mono">{appMetadata.version}</span>
            </div>
            {currentVersion && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Version:</span>
                <span className="font-semibold font-mono text-foreground">v{currentVersion}</span>
              </div>
            )}
          </div>

          {/* Downloading state */}
          {isDownloading && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Downloading update package…</span>
                <span className="tabular-nums">{updateStatus.percent}%</span>
              </div>
              <Progress value={updateStatus.percent} className="h-2" />
            </div>
          )}

          {/* Ready state */}
          {isReady && (
            <div className="p-3 bg-success/10 border border-success/20 rounded-md text-success text-xs flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Update package verified and ready. Restart application to complete.</span>
            </div>
          )}

          {/* Release Notes */}
          {isAvailable && updateStatus.releaseNotes && (
            <div className="space-y-1">
              <div className="font-medium text-foreground">What&apos;s New:</div>
              <div className="p-3 bg-card border rounded-md max-h-36 overflow-y-auto whitespace-pre-wrap text-muted-foreground text-[11px]">
                {updateStatus.releaseNotes}
              </div>
            </div>
          )}
        </div>

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
              <span>Update Now</span>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
