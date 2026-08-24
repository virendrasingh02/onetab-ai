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
import { notify, openExternal } from './desktop-api.js';
import { PlatformDiagnosticsLink } from './platform-diagnostics-link.js';
import { useAllFeatures } from './use-feature.js';
import { useDesktopPreference } from './use-desktop-preference.js';

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
  'not-available': 'OneTab AI is up to date',
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
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className={`text-xs font-medium ${disabled ? 'text-muted-foreground' : ''}`}>
          {title}
        </Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
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

  const [launchAtLogin, setLaunchAtLogin] = useDesktopPreference('launchAtLogin', false);
  const [minimizeToTray, setMinimizeToTray] = useDesktopPreference(
    'minimizeToTray',
    appInfo?.platform === 'darwin',
  );
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useDesktopPreference(
    'desktopNotificationsEnabled',
    true,
  );
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  const allFeatures = useAllFeatures();
  const userFacingFeatures = useMemo(
    () => allFeatures.filter((f) => FEATURE_REGISTRY[f.id]?.uiRelevance === 'user-facing'),
    [allFeatures],
  );
  const availableFeatures = userFacingFeatures.filter((f) => f.state === 'AVAILABLE');
  const limitedFeatures = userFacingFeatures.filter((f) => LIMITED_STATES.has(f.state));
  const webOnlyFeatures = userFacingFeatures.filter(
    (f) => f.state === 'WEB_ONLY' || f.state === 'EXTERNAL',
  );

  if (!isDesktop) return null;

  const checking = updateStatus.state === 'checking';
  const downloading = updateStatus.state === 'downloading';
  const isStoreManaged =
    appInfo?.distribution === 'mac-app-store' || appInfo?.distribution === 'microsoft-store';
  const storeLabel = appInfo?.distribution ? DISTRIBUTION_LABELS[appInfo.distribution] : undefined;

  const handleTestNotification = async () => {
    const sent = await notify({
      title: 'OneTab AI Desktop Notification',
      body: 'Native desktop notifications and deep link routing are functioning correctly!',
      route: '/settings',
    });
    if (sent) {
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. APPLICATION & STARTUP */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Power className="size-4 text-primary" />
            <CardTitle className="text-sm">Desktop Application & Startup</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Manage system-level background execution and automatic launch preferences.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <Row
            id="desktop-launch-at-login"
            title="Launch at login"
            description="Automatically start OneTab AI in the background when you log in to your computer."
            checked={launchAtLogin}
            onCheckedChange={setLaunchAtLogin}
            disabled={!capabilities.autoLaunch}
          />

          <Separator />

          <Row
            id="desktop-minimize-to-tray"
            title="Keep running in background (Tray)"
            description="Closing the main window minimizes to the system tray so instant notifications keep arriving."
            checked={minimizeToTray}
            onCheckedChange={setMinimizeToTray}
          />
        </CardContent>
      </Card>

      {/* 2. NOTIFICATIONS & INTEGRATION */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <CardTitle className="text-sm">Native Desktop Notifications</CardTitle>
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

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium">Test Desktop Notifications</p>
              <p className="text-[11px] text-muted-foreground">
                Trigger a sample native toast to verify OS permissions and action handling.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNotification}
              disabled={!capabilities.notifications}
              leadingIcon={testNotificationSent ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Bell className="size-3.5" />}
            >
              {testNotificationSent ? 'Sent!' : 'Send Test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. DEEP LINKS & PROTOCOLS */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            <CardTitle className="text-sm">Custom Protocol & Deep Links</CardTitle>
          </div>
          <CardDescription className="text-xs">
            External applications, browser handoffs, and notifications route into this client.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium">Registered Protocols</p>
              <p className="text-[11px] text-muted-foreground">
                Active OS scheme handlers for seamless web-to-desktop handoff.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="neutral" className="font-mono text-[10px]">onetab://</Badge>
              <Badge variant="neutral" className="font-mono text-[10px]">mie://</Badge>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-surface-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <Shield className="size-3.5 text-primary" /> Secure Single-Instance Dispatching
            </p>
            <p className="text-[11px]">
              Deep links authenticate via PKCE verification and restrict navigation strictly to allowed in-app workspaces, channels, agents, and workflows.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. APPLICATION UPDATES */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="size-4 text-primary" />
            <CardTitle className="text-sm">Application Updates</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Manage software versions and security updates.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium flex items-center gap-2">
                <span>Version {appMetadata.version}</span>
                {appInfo && !appInfo.isPackaged && (
                  <Badge variant="neutral" className="text-[9px] uppercase">Development</Badge>
                )}
                {storeLabel && (
                  <Badge variant="neutral" className="text-[9px] uppercase">{storeLabel}</Badge>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                {updateStatus.state === 'error' ? (
                  <AlertCircle className="size-3 text-destructive" />
                ) : updateStatus.state === 'ready' || updateStatus.state === 'available' ? (
                  <ArrowUpCircle className="size-3 text-primary" />
                ) : (
                  <Info className="size-3 text-muted-foreground" />
                )}
                <span>
                  {isStoreManaged
                    ? `Updates are managed via ${storeLabel}`
                    : (UPDATE_LABELS[updateStatus.state] ?? 'Up to date')}
                  {updateStatus.state === 'error' ? ` — ${updateStatus.message}` : ''}
                  {updateStatus.state === 'downloading' ? ` (${updateStatus.percent}%)` : ''}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {updateStatus.state === 'ready' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void installUpdate()}
                  leadingIcon={<RotateCcw className="size-3.5" />}
                >
                  Restart & Install
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
        </CardContent>
      </Card>

      {/* 5. PLATFORM & FEATURES — grouped by @org/platform's evaluated state, not a
          hardcoded per-platform list, so a new store policy changes this
          automatically. HIDDEN/OS_UNSUPPORTED features never appear here at
          all — see FeatureState's Hide vs Disable rule. */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <CardTitle className="text-sm">Platform &amp; Features</CardTitle>
          </div>
          <CardDescription className="text-xs">
            What this {storeLabel ?? appInfo?.platform ?? 'desktop'} build can and can&apos;t do natively.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-3 text-xs">
          {availableFeatures.length > 0 && (
            <div className="space-y-1">
              {availableFeatures.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="size-3.5 shrink-0 text-success-text" />
                  <span>{FEATURE_REGISTRY[f.id]?.name ?? f.id}</span>
                </div>
              ))}
            </div>
          )}

          {limitedFeatures.length > 0 && (
            <div className="space-y-1 border-t border-border/60 pt-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Limited in this build
              </p>
              {limitedFeatures.map((f) => (
                <div key={f.id} className="flex items-start gap-2 text-muted-foreground" title={f.reason ?? undefined}>
                  <AlertTriangle className="size-3.5 shrink-0 text-warning-text" />
                  <span>{FEATURE_REGISTRY[f.id]?.name ?? f.id}</span>
                </div>
              ))}
            </div>
          )}

          {webOnlyFeatures.length > 0 && (
            <div className="space-y-1 border-t border-border/60 pt-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Web-only from here
              </p>
              {webOnlyFeatures.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRight className="size-3.5 shrink-0" />
                  <span>{FEATURE_REGISTRY[f.id]?.name ?? f.id}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border/60 pt-2">
            <PlatformDiagnosticsLink />
          </div>
        </CardContent>
      </Card>

      {/* 6. PUBLISHER & ABOUT INFORMATION */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="size-4 text-primary" />
            <CardTitle className="text-sm">About {appMetadata.productName}</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Product details, publisher metadata, and legal terms.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[11px]">Publisher</span>
              <p className="font-medium text-foreground">{appMetadata.publisher}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[11px]">Build Identifier</span>
              <p className="font-mono text-foreground text-[11px]">{appMetadata.build}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[11px]">Runtime Engine</span>
              <p className="text-foreground">
                Electron {appInfo?.electronVersion || '—'} · Chromium {appInfo?.chromeVersion || '—'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[11px]">System Architecture</span>
              <p className="text-foreground">
                {appInfo?.platform || 'desktop'} ({appInfo?.arch || 'x64'})
              </p>
            </div>
          </div>

          <Separator className="my-2" />

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
            <p className="text-[11px] text-muted-foreground">{appMetadata.copyright}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void openExternal(appMetadata.website)}
                className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
              >
                Website <ExternalLink className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => void openExternal(appMetadata.privacyUrl)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => void openExternal(appMetadata.termsUrl)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => void openExternal(appMetadata.supportUrl)}
                className="text-muted-foreground hover:text-foreground text-xs"
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
