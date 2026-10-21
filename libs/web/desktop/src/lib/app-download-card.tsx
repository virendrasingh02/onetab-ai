import { hasConfiguredDownloadUrl, type DesktopPlatform } from "@org/platform";
import {
  Badge,
  Button,
  QRCode,
  SettingsBadge,
  SettingsCard,
  SettingsGroup,
  SettingsRow,
} from "@org/ui";
import { cn } from "@org/utils";
import {
  Apple,
  CheckCircle2,
  Download,
  ExternalLink,
  Laptop,
  Monitor,
  Play,
  RefreshCw,
  Smartphone,
  Terminal,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  getDesktopApi,
  openExternal,
  type DesktopAppInfo,
  type DesktopUpdateStatus,
} from "./desktop-api.js";
import { useAppDownload, type UseAppDownloadOptions } from "./use-app-download.js";

/**
 * A published desktop build, as `GET /app-versions/downloads` returns it.
 * Declared structurally so this lib stays free of `@org/types`.
 */
export interface DesktopReleaseInfo {
  os: DesktopPlatform;
  version: string;
  buildNumber: string;
  releaseDate: string;
  downloadUrl: string;
  releaseNotes: string | null;
}

export interface AppDownloadCardProps extends UseAppDownloadOptions {
  className?: string;
  /** Current published builds. Omitted/empty = nothing published yet. */
  desktopReleases?: DesktopReleaseInfo[];
  releasesLoading?: boolean;
}

const OS_META: Record<DesktopPlatform, { name: string; icon: ReactNode }> = {
  windows: { name: "Windows", icon: <Monitor /> },
  macos: { name: "macOS", icon: <Apple /> },
  linux: { name: "Linux", icon: <Terminal /> },
};

/** `process.platform` (what the desktop shell reports) → download OS key. */
const NODE_PLATFORM_OS: Record<DesktopAppInfo["platform"], DesktopPlatform> = {
  win32: "windows",
  darwin: "macos",
  linux: "linux",
};

function formatReleaseDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Settings → Apps & Downloads.
 *
 * Desktop installers come from the admin-managed release list (the same rows
 * the desktop updater checks), so a version shown here is one that was really
 * published. An OS with no published build — and no deployment-level link —
 * says so instead of offering a dead download. Mobile store links are shown
 * only when the deployment configured them; the built-in defaults are
 * placeholders.
 */
export function AppDownloadCard({
  className,
  config,
  workspaceId,
  desktopReleases,
  releasesLoading,
}: AppDownloadCardProps) {
  const { environment, desktopOptions, mobileOptions, trackDownload } = useAppDownload({
    config,
    workspaceId,
  });

  const desktopApi = getDesktopApi();
  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus>({ state: "idle" });

  useEffect(() => {
    if (!desktopApi) return;
    let cancelled = false;
    void desktopApi
      .getAppInfo()
      .then((info) => {
        if (!cancelled) setAppInfo(info);
      })
      .catch(() => undefined);
    const unsubscribe = desktopApi.updates.onStatus(setUpdateStatus);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [desktopApi]);

  const checkForUpdates = async () => {
    if (!desktopApi) return;
    setUpdateStatus({ state: "checking" });
    try {
      setUpdateStatus(await desktopApi.updates.check());
    } catch (error) {
      setUpdateStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Update check failed",
      });
    }
  };

  const releaseByOs = new Map((desktopReleases ?? []).map((r) => [r.os, r]));
  const configuredMobile = mobileOptions.filter((opt) =>
    hasConfiguredDownloadUrl(opt.platform),
  );
  const [qrPlatform, setQrPlatform] = useState(configuredMobile[0]?.platform);
  const qrOption =
    configuredMobile.find((opt) => opt.platform === qrPlatform) ?? configuredMobile[0];

  const open = (url: string, platform: DesktopPlatform | "ios" | "android", source: string) => {
    const option = [...desktopOptions, ...mobileOptions].find((o) => o.platform === platform);
    if (option) trackDownload({ ...option, url }, source);
    void openExternal(url);
  };

  return (
    <div className={cn("space-y-8", className)}>
      {desktopApi && (
        <SettingsGroup title="This device">
          <SettingsCard divided>
            <SettingsRow
              icon={<Laptop />}
              title="OneTab AI Desktop"
              badge={
                <SettingsBadge tone="success">
                  <CheckCircle2 className="size-3 mr-1 inline" />
                  Installed
                </SettingsBadge>
              }
              description={
                appInfo
                  ? `Version ${appInfo.version} · ${OS_META[NODE_PLATFORM_OS[appInfo.platform]].name} ${appInfo.arch}`
                  : "Reading version…"
              }
            >
              <div className="gap-2 flex items-center">
                <UpdateStatusLabel status={updateStatus} />
                {updateStatus.state === "available" ? (
                  <Button size="sm" onClick={() => void desktopApi.updates.download()}>
                    <Download className="size-3.5 mr-1" />
                    Download {updateStatus.version}
                  </Button>
                ) : updateStatus.state === "ready" ? (
                  <Button size="sm" onClick={() => void desktopApi.updates.install()}>
                    Restart to update
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={updateStatus.state === "checking"}
                    onClick={() => void checkForUpdates()}
                  >
                    <RefreshCw className="size-3.5 mr-1" />
                    Check for updates
                  </Button>
                )}
              </div>
            </SettingsRow>
          </SettingsCard>
        </SettingsGroup>
      )}

      <SettingsGroup
        title="Desktop app"
        description="Native notifications, tray, global shortcuts and auto-updates."
      >
        <SettingsCard divided>
          {desktopOptions.map((opt) => {
            const os = opt.platform as DesktopPlatform;
            const release = releaseByOs.get(os);
            const fallbackUrl = hasConfiguredDownloadUrl(os) ? opt.url : null;
            const url = release?.downloadUrl ?? fallbackUrl;
            const isCurrentOs = !environment.isMobile && environment.os === os;

            return (
              <SettingsRow
                key={os}
                icon={OS_META[os].icon}
                title={OS_META[os].name}
                badge={isCurrentOs ? <SettingsBadge tone="violet">Your OS</SettingsBadge> : null}
                description={
                  releasesLoading
                    ? "Checking for the latest build…"
                    : release
                      ? `Version ${release.version} · ${opt.storeOrFormat} · released ${formatReleaseDate(release.releaseDate)}`
                      : url
                        ? opt.storeOrFormat
                        : "No build published yet"
                }
              >
                <Button
                  size="sm"
                  variant={isCurrentOs ? "primary" : "outline"}
                  disabled={!url}
                  onClick={() => url && open(url, os, "settings_desktop")}
                >
                  <Download className="size-3.5 mr-1" />
                  {url ? "Download" : "Not available"}
                </Button>
              </SettingsRow>
            );
          })}
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title="Mobile app"
        description="Channels, tasks and push notifications on iOS and Android."
      >
        <SettingsCard divided>
          {mobileOptions.map((opt) => {
            const configured = hasConfiguredDownloadUrl(opt.platform);
            return (
              <SettingsRow
                key={opt.platform}
                icon={opt.platform === "ios" ? <Apple /> : <Play />}
                title={opt.platform === "ios" ? "iPhone & iPad" : "Android"}
                badge={
                  configured ? null : <SettingsBadge tone="neutral">Coming soon</SettingsBadge>
                }
                description={
                  configured ? opt.storeOrFormat : "Not yet listed in the store"
                }
              >
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!configured}
                  onClick={() => open(opt.url, opt.platform as "ios" | "android", "settings_mobile")}
                >
                  Open store
                  <ExternalLink className="size-3 ml-1" />
                </Button>
              </SettingsRow>
            );
          })}

          {qrOption && !environment.isMobile && (
            <div className="p-5 gap-5 flex flex-wrap items-center">
              <div className="p-2 rounded-xl border border-border bg-white">
                <QRCode value={qrOption.url} size={112} bgColor="#ffffff" fgColor="#000000" />
              </div>
              <div className="min-w-0 space-y-2 flex-1 basis-48">
                <p className="text-sm font-semibold text-foreground gap-1.5 flex items-center">
                  <Smartphone className="size-4 text-muted-foreground" />
                  Scan to install on your phone
                </p>
                <p className="text-xs text-muted-foreground">
                  Point your camera at the code to open {qrOption.storeOrFormat}.
                </p>
                {configuredMobile.length > 1 && (
                  <div className="gap-1 p-1 inline-flex rounded-lg border border-border bg-surface-inset">
                    {configuredMobile.map((opt) => (
                      <button
                        key={opt.platform}
                        type="button"
                        onClick={() => setQrPlatform(opt.platform)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                          qrOption.platform === opt.platform
                            ? "bg-surface text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {opt.platform === "ios" ? "iOS" : "Android"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

function UpdateStatusLabel({ status }: { status: DesktopUpdateStatus }) {
  const text =
    status.state === "not-available"
      ? "You're up to date"
      : status.state === "downloading"
        ? `Downloading… ${Math.round(status.percent)}%`
        : status.state === "unsupported"
          ? "Updates are managed by your app store"
          : status.state === "error"
            ? status.message
            : null;
  if (!text) return null;
  return (
    <Badge
      variant={status.state === "error" ? "destructive" : "neutral"}
      className="text-[11px] font-normal"
    >
      {text}
    </Badge>
  );
}
