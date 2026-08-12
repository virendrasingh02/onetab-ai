import {
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
import { RefreshCw } from 'lucide-react';
import { useDesktop } from './desktop-provider.js';
import { useDesktopPreference } from './use-desktop-preference.js';

const UPDATE_LABELS: Record<string, string> = {
  idle: 'Not checked yet',
  checking: 'Checking…',
  available: 'Update available — downloading',
  downloading: 'Downloading…',
  ready: 'Restart to install',
  'not-available': 'Up to date',
  error: 'Check failed',
};

function Row({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-xs font-medium">
          {title}
        </Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/**
 * Desktop-only preferences, for the workspace settings screen.
 *
 * Returns `null` in the browser rather than rendering disabled switches: a
 * control the user cannot ever turn on is noise, not information.
 */
export function DesktopSettingsCard() {
  const { isDesktop, appInfo, updateStatus, checkForUpdates } = useDesktop();
  const [launchAtLogin, setLaunchAtLogin] = useDesktopPreference('launchAtLogin', false);
  const [minimizeToTray, setMinimizeToTray] = useDesktopPreference(
    'minimizeToTray',
    appInfo?.platform === 'darwin',
  );

  if (!isDesktop) return null;

  const checking = updateStatus.state === 'checking' || updateStatus.state === 'downloading';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Desktop app</CardTitle>
        <CardDescription className="text-xs">
          Settings that apply only to the installed app on this computer.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <Row
          id="desktop-launch-at-login"
          title="Launch at login"
          description="Start OneTab AI in the background when you sign in to this computer."
          checked={launchAtLogin}
          onCheckedChange={setLaunchAtLogin}
        />

        <Separator />

        <Row
          id="desktop-minimize-to-tray"
          title="Keep running in the background"
          description="Closing the window hides it to the tray so notifications keep arriving."
          checked={minimizeToTray}
          onCheckedChange={setMinimizeToTray}
        />

        <Separator />

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-medium">
              Version {appInfo?.version ?? '—'}
              {appInfo && !appInfo.isPackaged ? ' (development build)' : ''}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {appInfo?.isMas
                ? 'Updates are managed via the App Store'
                : (UPDATE_LABELS[updateStatus.state] ?? '')}
              {!appInfo?.isMas && updateStatus.state === 'error'
                ? ` — ${updateStatus.message}`
                : ''}
            </p>
          </div>
          {!appInfo?.isMas && (
            <Button
              variant="outline"
              size="sm"
              loading={checking}
              onClick={() => void checkForUpdates()}
              leadingIcon={<RefreshCw className="size-3.5" />}
            >
              Check for updates
            </Button>
          )}
        </div>

        <p className="pt-1 text-[11px] text-subtle">
          Electron {appInfo?.electronVersion} · Chromium {appInfo?.chromeVersion} ·{' '}
          {appInfo?.platform} {appInfo?.arch}
        </p>
      </CardContent>
    </Card>
  );
}
