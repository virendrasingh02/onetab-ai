import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  QRCode,
} from "@org/ui";
import { cn } from "@org/utils";
import {
  Apple,
  CheckCircle2,
  Download,
  ExternalLink,
  Laptop,
  Play,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useState } from "react";
import { openExternal } from "./desktop-api.js";
import { useAppDownload, type UseAppDownloadOptions } from "./use-app-download.js";

export interface AppDownloadCardProps extends UseAppDownloadOptions {
  className?: string;
}

export function AppDownloadCard({ className, config, workspaceId }: AppDownloadCardProps) {
  const {
    environment,
    desktopOptions,
    mobileOptions,
    trackDownload,
  } = useAppDownload({ config, workspaceId });

  const [showQrCode, setShowQrCode] = useState(false);
  const [selectedMobileStore, setSelectedMobileStore] = useState<"ios" | "android">(
    environment.os === "android" ? "android" : "ios",
  );

  const activeMobileOption = mobileOptions.find((m) => m.platform === selectedMobileStore) ?? mobileOptions[0];

  const handleDownload = (opt: (typeof desktopOptions)[0], source = "settings_card") => {
    trackDownload(opt, source);
    void openExternal(opt.url);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* 1. Desktop Application Card */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Laptop className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">OneTab AI Desktop Application</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Native multi-platform desktop shell with system notifications, tray, and global shortcuts.
                </CardDescription>
              </div>
            </div>
            {environment.isNativeApp ? (
              <Badge variant="success" className="gap-1 text-[11px] font-medium">
                <CheckCircle2 className="size-3" />
                <span>Installed & Active</span>
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-[11px]">
                Web Client Mode
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {desktopOptions.map((opt) => (
              <div
                key={opt.platform}
                className={cn(
                  "p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3",
                  opt.isPrimaryForUser
                    ? "border-primary/50 bg-primary/5 shadow-xs"
                    : "border-border/70 bg-card hover:border-border-strong",
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{opt.label}</span>
                    {opt.isPrimaryForUser && (
                      <Badge variant="primary" className="text-[9px] px-1.5 py-0 font-bold">
                        Your OS
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Direct installer package ({opt.storeOrFormat})
                  </p>
                </div>

                <Button
                  variant={opt.isPrimaryForUser ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleDownload(opt, "desktop_card")}
                  className="w-full gap-1.5 text-xs font-medium cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Download {opt.os === "windows" ? "Windows" : opt.os === "macos" ? "macOS" : "Linux"}</span>
                </Button>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-surface-muted/50 border border-border/50 text-[11px] text-muted-foreground flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              <span>
                Code-signed binaries with auto-updates and encrypted local vault integration.
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span>Deep-Link Protocol:</span>
              <code className="px-1 py-0.5 bg-background rounded border border-border">mie://</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Mobile Application Card */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-accent/15 text-accent-foreground">
                <Smartphone className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">OneTab AI Mobile App</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Stay synchronized on iOS and Android with fast mobile channels, tasks, and notifications.
                </CardDescription>
              </div>
            </div>
            {environment.isStandalone && (
              <Badge variant="neutral" className="gap-1 text-[11px]">
                <span>PWA Standalone</span>
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Store options */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Get the official application directly from the store for your mobile operating system:
              </p>

              <div className="space-y-2">
                {mobileOptions.map((opt) => (
                  <div
                    key={opt.platform}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between transition-colors",
                      opt.isPrimaryForUser
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-surface-inset flex items-center justify-center border border-border">
                        {opt.platform === "ios" ? (
                          <Apple className="size-5 text-foreground" />
                        ) : (
                          <Play className="size-4 text-foreground fill-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground">{opt.label}</span>
                          {opt.isPrimaryForUser && (
                            <Badge variant="primary" className="text-[9px] px-1.5 py-0">
                              Your Phone
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{opt.storeOrFormat}</span>
                      </div>
                    </div>

                    <Button
                      variant={opt.isPrimaryForUser ? "primary" : "outline"}
                      size="sm"
                      onClick={() => handleDownload(opt, "mobile_card")}
                      className="gap-1 text-xs cursor-pointer"
                    >
                      <span>Open Store</span>
                      <ExternalLink className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQrCode(!showQrCode)}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <QrCode className="size-3.5" />
                <span>{showQrCode ? "Hide QR Code" : "Scan QR code with phone"}</span>
              </Button>
            </div>

            {/* QR Code Scanner preview */}
            <div className="p-4 rounded-xl border border-border/70 bg-surface-muted/30 flex flex-col items-center justify-center text-center space-y-3">
              <div className="flex items-center gap-1.5 p-1 bg-background rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setSelectedMobileStore("ios")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
                    selectedMobileStore === "ios"
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  iOS App
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMobileStore("android")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
                    selectedMobileStore === "android"
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Android App
                </button>
              </div>

              <div className="p-2 bg-white rounded-xl shadow-xs border border-border/60">
                <QRCode
                  value={activeMobileOption.url}
                  size={128}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>

              <span className="text-[11px] text-muted-foreground">
                Scan with your phone camera to open {activeMobileOption.storeOrFormat}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
