import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@org/ui";
import { cn } from "@org/utils";
import {
  ChevronDown,
  Clock,
  Download,
  Laptop,
  Smartphone,
  X,
} from "lucide-react";
import { openExternal } from "./desktop-api.js";
import { useAppDownload, type UseAppDownloadOptions } from "./use-app-download.js";

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
    desktopOptions,
    snooze,
    dismiss,
    selectDesktopPlatform,
    trackDownload,
  } = useAppDownload({ config, workspaceId });

  if (!shouldShowPrompt || !primaryOption) {
    return null;
  }

  const isMobile = environment.isMobile;

  const handleDownload = (option = primaryOption) => {
    trackDownload(option, "banner");
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
      aria-label={isMobile ? "Mobile app download prompt" : "Desktop app download prompt"}
      className={cn(
        "gap-3 px-3 py-2 text-xs shadow-xs relative flex flex-wrap items-center justify-between overflow-hidden rounded-xl",
        "border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-accent/10 text-foreground transition-all duration-300",
        className,
      )}
    >
      {/* Left: Icon, Headline & Subtitle */}
      <div className="gap-3 min-w-0 flex flex-1 items-center">
        <div className="size-8 shadow-inner relative flex shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {isMobile ? (
            <Smartphone className="size-4 animate-pulse" aria-hidden />
          ) : (
            <Laptop className="size-4 animate-pulse" aria-hidden />
          )}
          <span className="-top-1 -right-1 size-2.5 absolute flex" aria-hidden>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="size-2.5 relative inline-flex rounded-full bg-primary"></span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="gap-2 flex flex-wrap items-center">
            <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground">
              {isMobile ? "Get the mobile app" : "Get the desktop app"}
            </h4>
            <span className="hidden md:inline-block text-[11px] text-muted-foreground">
              {isMobile
                ? "Use the faster, more focused mobile experience."
                : "Install the desktop app for a faster, native experience."}
            </span>
          </div>
          <p className="md:hidden text-[11px] text-muted-foreground truncate">
            {isMobile
              ? "Faster, focused mobile experience"
              : "Native desktop notifications & speed"}
          </p>
        </div>
      </div>

      {/* Right: Platform Selector & Action Buttons */}
      <div className="gap-2 flex shrink-0 items-center">
        {/* Desktop Platform Selector (when on desktop web) */}
        {!isMobile && desktopOptions.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2 text-xs bg-background/80 hover:bg-accent cursor-pointer"
                aria-label="Select desktop operating system"
              >
                <span className="hidden sm:inline text-muted-foreground">Platform:</span>
                <span className="font-medium">{primaryOption.storeOrFormat}</span>
                <ChevronDown className="size-3 opacity-60 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Choose Desktop Installer
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {desktopOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.platform}
                  onClick={() => {
                    selectDesktopPlatform(opt.os);
                  }}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <Laptop className="size-3.5 text-primary" />
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.storeOrFormat}</span>
                  </div>
                  {opt.platform === primaryOption.platform && (
                    <span className="text-[10px] text-primary font-bold">Current</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Remind Me / Snooze Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 sm:px-2.5 text-xs bg-background/80 hover:bg-accent cursor-pointer"
              aria-label="Snooze or dismiss app prompt"
            >
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Remind Me</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              Remind Me Later
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleSnooze(24)} className="text-xs cursor-pointer">
              In 24 hours
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSnooze(72)} className="text-xs cursor-pointer">
              In 3 days
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSnooze(168)} className="text-xs cursor-pointer">
              In 1 week
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDismiss}
              className="text-xs text-destructive focus:text-destructive cursor-pointer"
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
          className="h-8 gap-1.5 px-3 text-xs shadow-sm font-medium cursor-pointer"
          aria-label={
            isMobile
              ? `Download mobile app for ${primaryOption.storeOrFormat}`
              : `Download desktop app for ${primaryOption.label}`
          }
        >
          <Download className="size-3.5" />
          <span>{isMobile ? "Download App" : "Download App"}</span>
        </Button>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={() => handleSnooze(24)}
          title="Close (remind tomorrow)"
          aria-label="Close app download banner"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
