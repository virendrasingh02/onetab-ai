import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Separator,
  Switch,
} from '@org/ui';
import { FEATURE_REGISTRY, type FeatureState } from '@org/platform';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpCircle,
  Bell,
  CheckCircle2,
  Download,
  ExternalLink,
  Info,
  Link2,
  Power,
  RefreshCw,
  RotateCcw,
  Shield,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDesktop } from './desktop-provider.js';
import { getDesktopApi, notify, openExternal } from './desktop-api.js';
import { PlatformDiagnosticsLink } from './platform-diagnostics-link.js';
import { useAllFeatures } from './use-feature.js';
import { DesktopDiagnosticsCard } from './desktop-diagnostics-card.js';
import { useDesktopPreference } from './use-desktop-preference.js';
import { useDesktopStartup } from './use-desktop-startup.js';

const DISTRIBUTION_LABELS: Record<string, string> = {
  'mac-app-store': 'Mac App Store',
  'microsoft-store': 'Microsoft Store',
};

/** States that keep a feature visible in Settings but flag it as not fully working here. */
const LIMITED_STATES = new Set<FeatureState>([
  'DISABLED',
  'REQUIRES_PERMISSION',
  'REQUIRES_PLAN',
  'STORE_RESTRICTED',
  'COMING_SOON',
]);

const UPDATE_LABELS: Record<string, string> = {
  idle: 'Ready to check for updates',
  checking: 'Checking for updates…',
  available: 'A new version is available',
  downloading: 'Downloading update…',
  ready: 'Update downloaded — restart to install',
  'not-available': 'Onetab AI is up to date',
  unsupported: 'Updates managed externally / Dev build',
  error: 'Update check failed',
};

function Row({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="gap-4 py-3 flex items-start justify-between">
      <div className="min-w-0 space-y-0.5">
        <Label
          htmlFor={id}
          className={`text-xs font-medium ${disabled ? 'text-muted-foreground' : ''}`}
        >
          {title}
        </Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Desktop-only preferences, for the workspace settings screen.
 */
export function DesktopSettingsCard() {
  const {
    isDesktop,
    appInfo,
    appMetadata,
    capabilities,
    updateStatus,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  } = useDesktop();

  const [startup, updateStartup] = useDesktopStartup();
  // Mirrors `defaultMinimizeToTray` in the shell, which answers for it once the
  // preference has loaded: Linux often has no tray, so it stays opt-in there.
  const [minimizeToTray, setMinimizeToTray] = useDesktopPreference(
    'minimizeToTray',
    appInfo?.platform === 'darwin' || appInfo?.platform === 'win32',
  );
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] =
    useDesktopPreference('desktopNotificationsEnabled', true);
  // Mirrors the shell's default: updates download in the background so they only need a restart.
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useDesktopPreference(
    'autoDownloadUpdates',
    true,
  );
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [clearedRecentDocs, setClearedRecentDocs] = useState(false);

  const allFeatures = useAllFeatures();
  const userFacingFeatures = useMemo(
    () =>
      allFeatures.filter(
        (f) => FEATURE_REGISTRY[f.id]?.uiRelevance === 'user-facing',
      ),
    [allFeatures],
  );
  const availableFeatures = userFacingFeatures.filter(
    (f) => f.state === 'AVAILABLE',
  );
  const limitedFeatures = userFacingFeatures.filter((f) =>
    LIMITED_STATES.has(f.state),
  );
  const webOnlyFeatures = userFacingFeatures.filter(
    (f) => f.state === 'WEB_ONLY' || f.state === 'EXTERNAL',
  );

  if (!isDesktop) return null;

  const checking = updateStatus.state === 'checking';
  const downloading = updateStatus.state === 'downloading';
  const isStoreManaged =
    appInfo?.distribution === 'mac-app-store' ||
    appInfo?.distribution === 'microsoft-store';
  const storeLabel = appInfo?.distribution
    ? DISTRIBUTION_LABELS[appInfo.distribution]
    : undefined;

  const handleTestNotification = async () => {
    const sent = await notify({
      title: 'Onetab AI Desktop Notification',
      body: 'Native desktop notifications and deep link routing are functioning correctly!',
      route: '/settings',
    });
    if (sent) {
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);
    }
  };

  const handleClearRecentDocs = async () => {
    const api = getDesktopApi();
    if (api?.app.clearRecentDocuments) {
      await api.app.clearRecentDocuments();
      setClearedRecentDocs(true);
      setTimeout(() => setClearedRecentDocs(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. APPLICATION & STARTUP */}
      <Card>
        <CardHeader>
          <div className="gap-2 flex items-center">
            <Power className="size-4 text-primary" />
            <CardTitle className="text-sm">
              Desktop Application &amp; Startup
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Manage system-level background execution and automatic launch
            preferences.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <Row
            id="desktop-launch-at-login"
            title="Launch at login"
            description="Automatically start Onetab AI in the background when you log in to your computer."
            checked={startup?.openAtLogin ?? false}
            onCheckedChange={(value) =>
              void updateStartup({ openAtLogin: value })
            }
            disabled={!capabilities.autoLaunch || !startup?.supported}
          />
          {startup && !startup.supported && startup.reason && (
            <p className="pb-2 text-[11px] text-muted-foreground">
              {startup.reason}
            </p>
          )}

          <Separator />

          <Row
            id="desktop-start-hidden"
            title="Start minimized to the tray"
            description="When launched at login, stay in the background instead of opening a window."
            checked={startup?.startHidden ?? true}
            onCheckedChange={(value) =>
              void updateStartup({ startHidden: value })
            }
            disabled={!startup?.supported || !startup.openAtLogin}
          />

          <Separator />

          <Row
            id="desktop-minimize-to-tray"
            title="Keep running in background (Tray)"
            description="Closing the main window minimizes to the system tray so instant notifications keep arriving."
            checked={minimizeToTray}
            onCheckedChange={setMinimizeToTray}
          />

          {appInfo?.platform === 'win32' && (
            <>
              <Separator />
              <div className="gap-4 py-2 pt-3 flex items-center justify-between">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium">
                    Windows Jump List &amp; Tasks
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Right-click the taskbar icon to jump to any of your
                    workspaces, or to Search and the AI Assistant.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearRecentDocs}
                  leadingIcon={
                    clearedRecentDocs ? (
                      <CheckCircle2 className="size-3.5 text-success" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )
                  }
                >
                  {clearedRecentDocs ? 'Cleared' : 'Clear Recent Tasks'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. NOTIFICATIONS & INTEGRATION */}
      <Card>
        <CardHeader>
          <div className="gap-2 flex items-center">
            <Bell className="size-4 text-primary" />
            <CardTitle className="text-sm">
              Native Desktop Notifications
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Configure OS notification banners and taskbar/dock badges.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <Row
            id="desktop-notifications-toggle"
            title="Enable OS system notifications"
            description="Receive native alerts for AI agent task completions, workflow runs, mentions, and DMs."
            checked={desktopNotificationsEnabled}
            onCheckedChange={setDesktopNotificationsEnabled}
            disabled={!capabilities.notifications}
          />

          <div className="gap-4 pt-2 flex items-center justify-between">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium">Test Desktop Notifications</p>
              <p className="text-[11px] text-muted-foreground">
                Trigger a sample native toast to verify OS permissions and
                action handling.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNotification}
              disabled={!capabilities.notifications}
              leadingIcon={
                testNotificationSent ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  <Bell className="size-3.5" />
                )
              }
            >
              {testNotificationSent ? 'Sent!' : 'Send Test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. DEEP LINKS & PROTOCOLS */}
      <Card>
        <CardHeader>
          <div className="gap-2 flex items-center">
            <Link2 className="size-4 text-primary" />
            <CardTitle className="text-sm">
              Custom Protocol &amp; Deep Links
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            External applications, browser handoffs, and notifications route
            into this client.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          <div className="gap-4 py-2 flex items-center justify-between">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium">Registered Protocols</p>
              <p className="text-[11px] text-muted-foreground">
                Active OS scheme handlers for seamless web-to-desktop handoff.
              </p>
            </div>
            <div className="gap-2 flex">
              <Badge variant="neutral" className="font-mono text-[10px]">
                onetab://
              </Badge>
              <Badge variant="neutral" className="font-mono text-[10px]">
                mie://
              </Badge>
            </div>
          </div>

          <div className="p-3 text-xs space-y-1 rounded-lg border border-border/70 bg-surface-muted/30 text-muted-foreground">
            <p className="font-medium gap-1.5 flex items-center text-foreground">
              <Shield className="size-3.5 text-primary" /> Secure
              Single-Instance Dispatching
            </p>
            <p className="text-[11px]">
              Deep links authenticate via PKCE verification and restrict
              navigation strictly to allowed in-app workspaces, channels,
              agents, and workflows.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. APPLICATION UPDATES */}
      <Card>
        <CardHeader>
          <div className="gap-2 flex items-center">
            <ArrowUpCircle className="size-4 text-primary" />
            <CardTitle className="text-sm">Application Updates</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Manage software versions and security updates.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <div className="gap-4 py-2 flex items-center justify-between">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium gap-2 flex items-center">
                <span>Version {appMetadata.version}</span>
                {appInfo && !appInfo.isPackaged && (
                  <Badge variant="neutral" className="text-[9px] uppercase">
                    Development
                  </Badge>
                )}
                {storeLabel && (
                  <Badge variant="neutral" className="text-[9px] uppercase">
                    {storeLabel}
                  </Badge>
                )}
              </p>
              <p className="gap-1.5 flex items-center text-[11px] text-muted-foreground">
                {updateStatus.state === 'error' ? (
                  <AlertCircle className="size-3 text-destructive" />
                ) : updateStatus.state === 'ready' ||
                  updateStatus.state === 'available' ? (
                  <ArrowUpCircle className="size-3 text-primary" />
                ) : (
                  <Info className="size-3 text-muted-foreground" />
                )}
                <span>
                  {isStoreManaged
                    ? `Updates are managed via ${storeLabel}`
                    : (UPDATE_LABELS[updateStatus.state] ?? 'Up to date')}
                  {updateStatus.state === 'error'
                    ? ` — ${updateStatus.message}`
                    : ''}
                  {updateStatus.state === 'downloading'
                    ? ` (${updateStatus.percent}%)`
                    : ''}
                </span>
              </p>
            </div>

            <div className="gap-2 flex items-center">
              {updateStatus.state === 'ready' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void installUpdate()}
                  leadingIcon={<RotateCcw className="size-3.5" />}
                >
                  Restart &amp; Install
                </Button>
              ) : updateStatus.state === 'available' ? (
                <Button
                  variant="primary"
                  size="sm"
                  loading={downloading}
                  onClick={() => void downloadUpdate()}
                  leadingIcon={<Download className="size-3.5" />}
                >
                  Download Update
                </Button>
              ) : !isStoreManaged ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={checking}
                  onClick={() => void checkForUpdates()}
                  leadingIcon={<RefreshCw className="size-3.5" />}
                >
                  Check for Updates
                </Button>
              ) : null}
            </div>
          </div>

          {!isStoreManaged && (
            <>
              <Separator />
              <Row
                id="desktop-auto-download-updates"
                title="Download updates automatically"
                description="New versions download in the background and install the next time you restart Onetab AI."
                checked={autoDownloadUpdates}
                onCheckedChange={setAutoDownloadUpdates}
              />
            </>
          )}
        </CardContent>
      </Card>

      <DesktopDiagnosticsCard />

      {/* 5. PLATFORM & FEATURES — grouped by @org/platform's evaluated state, not a
          hardcoded per-platform list, so a new store policy changes this
          automatically. HIDDEN/OS_UNSUPPORTED features never appear here at
          all — see FeatureState's Hide vs Disable rule. */}
      <Card>
        <CardHeader>
          <div className="gap-2 flex items-center">
            <Shield className="size-4 text-primary" />
            <CardTitle className="text-sm">Platform &amp; Features</CardTitle>
          </div>
          <CardDescription className="text-xs">
            What this {storeLabel ?? appInfo?.platform ?? 'desktop'} build can
            and can&apos;t do natively.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-3 text-xs">
          {availableFeatures.length > 0 && (
            <div className="space-y-1">
              {availableFeatures.map((f) => (
                <div
                  key={f.id}
                  className="gap-2 flex items-center text-foreground"
                >
                  <CheckCircle2 className="size-3.5 shrink-0 text-success-text" />
                  <span>{FEATURE_REGISTRY[f.id]?.name ?? f.id}</span>
                </div>
              ))}
            </div>
          )}

          {limitedFeatures.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-border/60">
              <p className="font-medium tracking-wide text-[10px] text-muted-foreground uppercase">
                Limited in this build
              </p>
              {limitedFeatures.map((f) => (
                <div
                  key={f.id}
                  className="gap-2 flex items-start text-muted-foreground"
                  title={f.reason ?? undefined}
                >
                  <AlertTriangle className="size-3.5 shrink-0 text-warning-text" />
                  <span>{FEATURE_REGISTRY[f.id]?.name ?? f.id}</span>
                </div>
              ))}
            </div>
          )}

          {webOnlyFeatures.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-border/60">
              <p className="font-medium tracking-wide text-[10px] text-muted-foreground uppercase">
                Web-only from here
              </p>
              {webOnlyFeatures.map((f) => (
                <div
                  key={f.id}
                  className="gap-2 flex items-center text-muted-foreground"
                >
                  <ArrowRight className="size-3.5 shrink-0" />
                  <span>{FEATURE_REGISTRY[f.id]?.name ?? f.id}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-border/60">
            <PlatformDiagnosticsLink />
          </div>
        </CardContent>
      </Card>

      {/* 6. PUBLISHER & ABOUT INFORMATION */}
      <Card>
        <CardHeader>
          <div className="gap-2 flex items-center">
            <Info className="size-4 text-primary" />
            <CardTitle className="text-sm">
              About {appMetadata.productName}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Product details, publisher metadata, and legal terms.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          <div className="sm:grid-cols-2 gap-3 text-xs grid grid-cols-1">
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">
                Publisher
              </span>
              <p className="font-medium text-foreground">
                {appMetadata.publisher}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">
                Build Identifier
              </span>
              <p className="font-mono text-[11px] text-foreground">
                {appMetadata.build}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">
                Runtime Engine
              </span>
              <p className="text-foreground">
                Electron {appInfo?.electronVersion || '—'} · Chromium{' '}
                {appInfo?.chromeVersion || '—'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">
                System Architecture
              </span>
              <p className="text-foreground">
                {appInfo?.platform || 'desktop'} ({appInfo?.arch || 'x64'})
              </p>
            </div>
          </div>

          <Separator className="my-2" />

          <div className="gap-4 pt-1 text-xs flex flex-wrap items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {appMetadata.copyright}
            </p>
            <div className="gap-3 flex items-center">
              <button
                type="button"
                onClick={() => void openExternal(appMetadata.website)}
                className="gap-1 text-xs inline-flex items-center text-primary hover:underline"
              >
                Website <ExternalLink className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => void openExternal(appMetadata.privacyUrl)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => void openExternal(appMetadata.termsUrl)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => void openExternal(appMetadata.supportUrl)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Support
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
