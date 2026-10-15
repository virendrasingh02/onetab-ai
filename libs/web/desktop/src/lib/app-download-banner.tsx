import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ChevronDown,
  Clock,
  Download,
  Laptop,
  Smartphone,
  X,
} from 'lucide-react';
import { openExternal } from './desktop-api.js';
import {
  useAppDownload,
  type UseAppDownloadOptions,
} from './use-app-download.js';

export interface AppDownloadBannerProps extends UseAppDownloadOptions {
  className?: string;
  onDismiss?: () => void;
  onDownloadClick?: (platform: string) => void;
}

export function AppDownloadBanner({
  className,
  onDismiss,
  onDownloadClick,
  config,
  workspaceId,
}: AppDownloadBannerProps) {
  const {
    environment,
    shouldShowPrompt,
    primaryOption,
    snooze,
    dismiss,
    trackDownload,
  } = useAppDownload({ config, workspaceId });

  if (!shouldShowPrompt || !primaryOption) {
    return null;
  }

  const isMobile = environment.isMobile;

  const handleDownload = (option = primaryOption) => {
    trackDownload(option, 'banner');
    onDownloadClick?.(option.platform);
    void openExternal(option.url);
  };

  const handleSnooze = (hours: number) => {
    snooze(hours);
    onDismiss?.();
  };

  const handleDismiss = () => {
    dismiss();
    onDismiss?.();
  };

  return (
    <div
      role="region"
      aria-label={
        isMobile ? 'Mobile app download prompt' : 'Desktop app download prompt'
      }
      className={cn(
        'text-xs text-foreground transition-all duration-300',
        isMobile
          ? // Phones: a slim in-flow row above the bottom tab bar.
            'm-1.5 mt-0 gap-3 px-3 py-2 relative flex flex-wrap items-center justify-between overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-accent/10 shadow-xs'
          : // Desktop: a compact card at the foot of the sidebar. It used
            // to be a full-width row under the three panes, permanently
            // taking vertical space from every page until dismissed.
            'mx-2 mb-2 gap-2.5 p-3 flex shrink-0 flex-col rounded-xl border border-border bg-card shadow-xs',
        className,
      )}
    >
      {/* Icon, headline & subtitle */}
      <div className="gap-3 min-w-0 flex flex-1 items-center">
        <div className="size-8 relative flex shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          {isMobile ? (
            <Smartphone className="size-4" aria-hidden />
          ) : (
            <Laptop className="size-4" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold tracking-tight text-foreground">
            {isMobile ? 'Get the mobile app' : 'Get the desktop app'}
          </h4>
          <p className="truncate text-[11px] text-muted-foreground">
            {isMobile
              ? 'Faster, focused mobile experience'
              : 'Native notifications and a faster app'}
          </p>
        </div>

        {!isMobile ? (
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0 -mt-4 -mr-1.5 self-start cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => handleSnooze(24)}
            title="Close (remind tomorrow)"
            aria-label="Close app download banner"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {/* Actions */}
      <div
        className={cn(
          'gap-2 flex shrink-0 items-center',
          !isMobile && 'min-w-0',
        )}
      >
        {/* Remind Me / Snooze Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 sm:px-2.5 text-xs cursor-pointer bg-background/80 hover:bg-accent"
              aria-label="Snooze or dismiss app prompt"
            >
              <Clock className="size-3.5 text-muted-foreground" />
              <span className={isMobile ? 'sm:inline hidden' : 'sr-only'}>
                Remind Me
              </span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              Remind Me Later
            </DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => handleSnooze(24)}
              className="text-xs cursor-pointer"
            >
              In 24 hours
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleSnooze(72)}
              className="text-xs cursor-pointer"
            >
              In 3 days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleSnooze(168)}
              className="text-xs cursor-pointer"
            >
              In 1 week
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDismiss}
              className="text-xs cursor-pointer text-destructive focus:text-destructive"
            >
              Don&apos;t ask again
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Primary Download Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleDownload(primaryOption)}
          className={cn(
            'h-8 gap-1.5 px-3 text-xs font-medium cursor-pointer shadow-sm',
            !isMobile && 'min-w-0 flex-1',
          )}
          aria-label={
            isMobile
              ? `Download mobile app for ${primaryOption.storeOrFormat}`
              : `Download desktop app for ${primaryOption.label}`
          }
        >
          <Download className="size-3.5" />
          <span>Download</span>
        </Button>

        {/* Close button — desktop has its own in the card header. */}
        {isMobile ? (
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => handleSnooze(24)}
          title="Close (remind tomorrow)"
          aria-label="Close app download banner"
        >
          <X className="size-4" />
        </Button>
        ) : null}
      </div>
    </div>
  );
}
