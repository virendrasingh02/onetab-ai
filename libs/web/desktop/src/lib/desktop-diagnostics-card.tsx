import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  confirm,
  Label,
  Separator,
  Switch,
  toast,
} from '@org/ui';
import { Activity, FolderOpen, Power, RefreshCw, RotateCcw } from 'lucide-react';
import { getDesktopApi, type DesktopPathKey } from './desktop-api.js';
import { useDesktopDiagnostics } from './use-desktop-diagnostics.js';
import { useDesktopPreference } from './use-desktop-preference.js';

const FOLDERS: Array<{ key: DesktopPathKey; label: string }> = [
  { key: 'logs', label: 'Logs' },
  { key: 'userData', label: 'App data' },
  { key: 'crashDumps', label: 'Crash reports' },
];

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <p className="break-words text-xs text-foreground">{value}</p>
    </div>
  );
}

/**
 * Desktop application control + a read-only health snapshot: restart/quit,
 * the GPU toggle (which needs a restart), folders, protocol registration and
 * per-process load. Rendered only inside the Electron shell.
 */
export function DesktopDiagnosticsCard() {
  const { diagnostics, loading, error, refresh } = useDesktopDiagnostics();
  const [hardwareAcceleration, setHardwareAcceleration] = useDesktopPreference(
    'hardwareAcceleration',
    true,
  );

  const api = getDesktopApi();
  if (!api) return null;

  // The saved choice only takes effect on the next launch.
  const restartPending =
    diagnostics !== null && hardwareAcceleration !== diagnostics.gpu.hardwareAccelerationEnabled;

  const restart = async () => {
    const ok = await confirm({
      title: 'Restart Onetab AI?',
      description: 'The app closes and reopens. Any call in progress will end.',
      confirmLabel: 'Restart',
    });
    if (ok) await api.app.relaunch();
  };

  const quit = async () => {
    const ok = await confirm({
      title: 'Quit Onetab AI?',
      description: 'You will stop receiving desktop notifications until you open the app again.',
      confirmLabel: 'Quit',
    });
    if (ok) await api.app.quit();
  };

  const openFolder = async (key: DesktopPathKey, label: string) => {
    const opened = await api.app.openPath(key);
    if (!opened) toast.error(`Could not open the ${label.toLowerCase()} folder.`);
  };

  const totalMemoryMb = diagnostics
    ? Math.round(diagnostics.metrics.reduce((sum, m) => sum + m.workingSetKb, 0) / 1024)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <CardTitle className="text-sm">Application &amp; Diagnostics</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Restart the app, tune graphics, and inspect how it is running on this computer.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="desktop-hardware-acceleration" className="text-xs font-medium">
              Hardware acceleration
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Use the graphics card for smoother rendering. Turn off if you see flicker or blank
              areas.{restartPending ? ' Restart to apply.' : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {restartPending && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void restart()}
                leadingIcon={<RotateCcw className="size-3.5" />}
              >
                Restart
              </Button>
            )}
            <Switch
              id="desktop-hardware-acceleration"
              checked={hardwareAcceleration}
              onCheckedChange={setHardwareAcceleration}
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-medium">Application control</p>
            <p className="text-[11px] text-muted-foreground">
              Restart to recover from a stuck state, or quit fully (closing the window may only
              hide it).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void restart()}
              leadingIcon={<RotateCcw className="size-3.5" />}
            >
              Restart
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void quit()}
              leadingIcon={<Power className="size-3.5" />}
            >
              Quit
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium">System snapshot</p>
          <Button
            variant="ghost"
            size="sm"
            loading={loading}
            onClick={() => void refresh()}
            leadingIcon={<RefreshCw className="size-3.5" />}
          >
            Refresh
          </Button>
        </div>

        {error && !diagnostics && (
          <p className="text-[11px] text-destructive">Diagnostics are unavailable right now.</p>
        )}

        {diagnostics && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fact
                label="System"
                value={`${diagnostics.runtime.platform} ${diagnostics.runtime.osVersion} (${diagnostics.runtime.arch}${diagnostics.runtime.runningUnderTranslation ? ', translated' : ''})`}
              />
              <Fact
                label="Language"
                value={`${diagnostics.locale.app} (system ${diagnostics.locale.system})`}
              />
              <Fact
                label="Graphics"
                value={`${diagnostics.gpu.renderer ?? 'Unknown GPU'} · ${diagnostics.gpu.hardwareAccelerationEnabled ? 'accelerated' : 'software'}`}
              />
              <Fact
                label="Screen reader support"
                value={diagnostics.accessibilitySupportEnabled ? 'Active' : 'Not detected'}
              />
              <Fact label="Running for" value={formatUptime(diagnostics.identity.uptimeSeconds)} />
              <Fact
                label="Memory (all processes)"
                value={`${totalMemoryMb} MB across ${diagnostics.metrics.length} processes`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-muted/30 p-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-medium">Link handlers</p>
                <p className="text-[11px] text-muted-foreground">
                  Whether this computer opens these links in Onetab AI.
                </p>
              </div>
              <div className="flex gap-2">
                {diagnostics.protocols.map((protocol) => (
                  <Badge
                    key={protocol.scheme}
                    variant={protocol.registered ? 'success' : 'warning'}
                    className="font-mono text-[10px]"
                  >
                    {protocol.scheme}://{protocol.registered ? '' : ' not set'}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {FOLDERS.map(({ key, label }) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => void openFolder(key, label)}
                  leadingIcon={<FolderOpen className="size-3.5" />}
                >
                  {label}
                </Button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
