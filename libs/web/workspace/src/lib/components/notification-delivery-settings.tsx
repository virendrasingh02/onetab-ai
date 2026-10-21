import {
  useNotificationPermissionBar,
  useNotificationPreferenceMutations,
  useNotificationPreferences,
  usePushDeviceMutations,
  usePushDevices,
} from '@org/notifications';
import type { NotificationPreference } from '@org/types';
import {
  Button,
  confirm,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsBadge,
  SettingsCard,
  SettingsGroup,
  SettingsRow,
  Switch,
  toast,
} from '@org/ui';
import { notify } from '@org/web-desktop';
import {
  AtSign,
  Bell,
  Mail,
  Monitor,
  Moon,
  Smartphone,
  Trash2,
} from 'lucide-react';

type PreferencePatch = Partial<
  Omit<NotificationPreference, 'id' | 'userId' | 'workspaceId'>
>;

const HOURS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, '0')}:00`,
);

function hourLabel(hhmm: string) {
  const [h] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(
    new Date(2000, 0, 1, h),
  );
}

/**
 * Settings → Notifications: where this workspace's notifications reach you.
 *
 * Every control writes the per-workspace `NotificationPreference` row, which
 * the server already enforces: `pushEnabled` and quiet hours gate phone pushes
 * (PushDeliveryService, read in your profile timezone), `emailEnabled` gates
 * non-security email from this workspace (the mail pipeline's preference
 * check), and `mentionsOnly` plus quiet hours gate in-app message sounds.
 */
export function NotificationDeliverySettings({
  workspaceId,
}: {
  workspaceId: string | undefined;
}) {
  const prefsQuery = useNotificationPreferences(workspaceId);
  const { update } = useNotificationPreferenceMutations(workspaceId);
  const devicesQuery = usePushDevices();
  const { revoke } = usePushDeviceMutations();
  const browser = useNotificationPermissionBar();

  const prefs = prefsQuery.data;
  const loading = prefsQuery.isLoading || !prefs;
  const quietStart = prefs?.quietHoursStart ?? null;
  const quietEnd = prefs?.quietHoursEnd ?? null;
  const quietOn = !!(quietStart && quietEnd);

  const patch = (input: PreferencePatch, success?: string) =>
    update.mutate(input, {
      onSuccess: () => success && toast.success(success),
      onError: () => toast.error('Could not save notification settings.'),
    });

  const sendTestAlert = async () => {
    const shown = await notify({
      title: 'Notifications are working',
      body: 'This is how alerts from OneTab AI will appear on this device.',
    });
    if (!shown) toast.error('This device did not show the notification.');
  };

  const removeDevice = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Stop notifications on ${name}?`,
      description:
        'This device will stop receiving push notifications until you sign in on it again.',
      confirmLabel: 'Remove device',
      destructive: true,
    });
    if (!ok) return;
    revoke.mutate(id, {
      onSuccess: () => toast.success('Device removed'),
      onError: () => toast.error('Could not remove that device.'),
    });
  };

  const devices = devicesQuery.data ?? [];

  return (
    <div className="space-y-8">
      <SettingsGroup
        title="What notifies you"
        description="Applies to this workspace only."
      >
        <SettingsCard divided>
          <SettingsRow
            icon={<AtSign />}
            title="Only direct mentions"
            description="Play message sounds only when someone @mentions you or messages you directly. Per-channel levels still apply."
          >
            <Switch
              checked={prefs?.mentionsOnly ?? false}
              disabled={loading}
              onCheckedChange={(mentionsOnly) => patch({ mentionsOnly })}
              aria-label="Only direct mentions"
            />
          </SettingsRow>
          <SettingsRow
            icon={<Moon />}
            title="Quiet hours"
            description="Silences phone pushes and message sounds during this window, in your profile timezone."
            badge={
              quietStart && quietEnd ? (
                <SettingsBadge tone="violet">
                  {hourLabel(quietStart)}–{hourLabel(quietEnd)}
                </SettingsBadge>
              ) : null
            }
          >
            <Switch
              checked={quietOn}
              disabled={loading}
              onCheckedChange={(on) =>
                patch(
                  on
                    ? { quietHoursStart: '22:00', quietHoursEnd: '08:00' }
                    : { quietHoursStart: null, quietHoursEnd: null },
                )
              }
              aria-label="Quiet hours"
            />
          </SettingsRow>
          {quietOn && (
            <SettingsRow nested title="Window" description="From → to (can wrap past midnight).">
              <div className="gap-2 flex items-center">
                {(['quietHoursStart', 'quietHoursEnd'] as const).map((key, i) => (
                  <div key={key} className="gap-2 flex items-center">
                    {i === 1 && <span className="text-xs text-muted-foreground">to</span>}
                    <Select
                      value={prefs?.[key] ?? undefined}
                      onValueChange={(v) => patch({ [key]: v })}
                    >
                      <SelectTrigger
                        className="w-28 h-8 text-xs"
                        aria-label={i === 0 ? 'Quiet hours start' : 'Quiet hours end'}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {HOURS.map((hhmm) => (
                          <SelectItem key={hhmm} value={hhmm} className="text-xs">
                            {hourLabel(hhmm)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </SettingsRow>
          )}
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Where they reach you">
        <SettingsCard divided>
          <SettingsRow
            icon={<Monitor />}
            title="This browser"
            description={
              browser.permission === 'granted'
                ? 'Desktop banners are on for this browser.'
                : browser.permission === 'denied'
                  ? 'Blocked — allow notifications for this site in your browser settings.'
                  : browser.permission === 'unsupported'
                    ? 'This browser does not support notifications.'
                    : 'Desktop banners are off until you allow them.'
            }
            badge={
              browser.permission === 'granted' ? (
                <SettingsBadge tone="success">On</SettingsBadge>
              ) : browser.permission === 'denied' ? (
                <SettingsBadge tone="danger">Blocked</SettingsBadge>
              ) : null
            }
          >
            {browser.permission === 'granted' ? (
              <Button size="sm" variant="outline" onClick={() => void sendTestAlert()}>
                <Bell className="size-3.5 mr-1" />
                Send test
              </Button>
            ) : browser.permission === 'default' ? (
              <Button size="sm" onClick={() => void browser.requestPermission()}>
                Turn on
              </Button>
            ) : null}
          </SettingsRow>

          <SettingsRow
            icon={<Smartphone />}
            title="Mobile push"
            description="Push notifications to the OneTab AI app on your phone."
          >
            <Switch
              checked={prefs?.pushEnabled ?? true}
              disabled={loading}
              onCheckedChange={(pushEnabled) => patch({ pushEnabled })}
              aria-label="Mobile push"
            />
          </SettingsRow>

          <SettingsRow
            icon={<Mail />}
            title="Email"
            description="Emails from this workspace, like task assignments and meeting invites. Security and sign-in emails are always sent."
          >
            <Switch
              checked={prefs?.emailEnabled ?? true}
              disabled={loading}
              onCheckedChange={(emailEnabled) => patch({ emailEnabled })}
              aria-label="Email notifications"
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title="Your devices"
        description="Devices signed in to receive push notifications. Shared across all your workspaces."
      >
        <SettingsCard divided>
          {devicesQuery.isLoading ? (
            <p className="p-5 text-xs text-muted-foreground">Loading devices…</p>
          ) : devices.length === 0 ? (
            <p className="p-5 text-xs text-muted-foreground">
              No devices yet. Install the mobile app or turn on browser notifications to add one.
            </p>
          ) : (
            devices.map((device) => {
              const name = device.deviceDisplayName || device.appId;
              return (
                <SettingsRow
                  key={device.id}
                  icon={/mobile|ios|android|expo/i.test(device.appId) ? <Smartphone /> : <Monitor />}
                  title={name}
                  description={`Added ${new Date(device.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}`}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={revoke.isPending}
                    onClick={() => void removeDevice(device.id, name)}
                    aria-label={`Remove ${name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </SettingsRow>
              );
            })
          )}
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}
