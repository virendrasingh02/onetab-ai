import {
  useNotificationDisplayPreferences,
  useUserPreferences,
} from '@org/common';
import { notificationService } from '@org/notifications';
import type {
  NotificationDismissDuration,
  NotificationPosition,
  NotificationSize,
} from '@org/types';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  openSystemSettings,
  useCapabilities,
  useSystemSettingsSupported,
  useTaskbarFlashSupported,
} from '@org/web-desktop';
import {
  AlignJustify,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Laptop,
  PhoneCall,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

export function NotificationDisplaySettingsPanel({
  workspaceId: _workspaceId,
}: {
  workspaceId?: string;
}) {
  const { notifications, updateNotificationPreferences } =
    useNotificationDisplayPreferences();
  const { resetPreferences } = useUserPreferences();
  const capabilities = useCapabilities();
  const isTaskbarFlashSupported = useTaskbarFlashSupported();
  const isSystemSettingsSupported = useSystemSettingsSupported();

  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const handleTestNotification = async () => {
    setTestSending(true);
    await notificationService.notify({
      title: 'OneTab AI Notification',
      body: 'Real-time alert preferences are working smoothly!',
      type: 'success',
    });
    setTestSending(false);
    setTestSuccess(true);
    setTimeout(() => setTestSuccess(false), 3000);
  };

  const handleOpenTaskbarSettings = async () => {
    await openSystemSettings('taskbar');
  };

  const handlePositionSelect = (position: NotificationPosition) => {
    updateNotificationPreferences({ position });
  };

  const handleSizeSelect = (size: NotificationSize) => {
    updateNotificationPreferences({ size });
  };

  const handleDurationSelect = (value: string) => {
    const duration =
      value === 'never'
        ? null
        : (parseInt(value, 10) as NotificationDismissDuration);
    updateNotificationPreferences({ dismissDuration: duration });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Heading & Test Trigger */}
      <div className="sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight gap-2 flex items-center text-foreground">
            <Bell className="size-4.5 text-primary" />
            <span>Notification Display</span>
          </h2>
          <p className="text-xs mt-0.5 text-muted-foreground">
            Control toast appearance, on-screen positioning, privacy previews,
            and Windows taskbar flashing.
          </p>
        </div>

        <div className="gap-2 flex shrink-0 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={resetPreferences}
            className="h-8 text-xs gap-1.5"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={testSending}
            onClick={handleTestNotification}
            className="h-8 text-xs gap-1.5 shadow-xs"
          >
            {testSuccess ? (
              <>
                <CheckCircle2 className="size-3.5" />
                <span>Test Alert Sent!</span>
              </>
            ) : (
              <>
                <Bell className="size-3.5" />
                <span>Send Test Alert</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 1. Privacy, Preview & Call Suppression */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
          Privacy & Focus Rules
        </h3>

        <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border bg-surface-inset shadow-xs">
          {/* Content Preview Switch */}
          <div className="p-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40">
            <div className="gap-3 flex items-start">
              <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {notifications.showContentPreview ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium text-foreground">
                  Show notification message previews
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  When turned off, notification body contents are redacted to
                  protect sensitive messages from passersby.
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.showContentPreview}
              onCheckedChange={(checked) =>
                updateNotificationPreferences({ showContentPreview: checked })
              }
            />
          </div>

          {/* During Calls & Meetings Switch */}
          <div className="p-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40">
            <div className="gap-3 flex items-start">
              <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PhoneCall className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-foreground">
                  Show notifications during calls & meetings
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  When turned off, non-critical alerts are silenced while you
                  are active in a voice call, huddle, or video meeting.
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.showDuringCalls}
              onCheckedChange={(checked) =>
                updateNotificationPreferences({ showDuringCalls: checked })
              }
            />
          </div>

          {/* Flash Taskbar Switch */}
          <div className="p-4 sm:flex-row sm:items-center gap-4 flex flex-col justify-between transition-colors hover:bg-accent/40">
            <div className="gap-3 flex items-start">
              <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Laptop className="size-4" />
              </div>
              <div>
                <div className="gap-2 flex items-center">
                  <h4 className="text-xs font-medium text-foreground">
                    Flash taskbar when notification arrives
                  </h4>
                  {capabilities.isDesktop && (
                    <Badge variant="neutral" className="py-0 px-1.5 text-[9px]">
                      Windows Desktop
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Flashes the desktop application icon when you receive a
                  message in the background.
                </p>
                {!isTaskbarFlashSupported && (
                  <p className="mt-1 text-[10.5px] text-warning-text italic">
                    Note: Taskbar flashing requires the OneTab Windows desktop
                    app.
                  </p>
                )}
              </div>
            </div>
            <div className="gap-2.5 sm:self-auto flex items-center self-end">
              {isSystemSettingsSupported && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenTaskbarSettings}
                  className="h-8 text-xs gap-1.5 shrink-0"
                >
                  <span>OS Taskbar Settings</span>
                  <ExternalLink className="size-3 text-muted-foreground" />
                </Button>
              )}
              <Switch
                checked={notifications.flashTaskbar}
                onCheckedChange={(checked) =>
                  updateNotificationPreferences({ flashTaskbar: checked })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Position on Screen */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
            Position on Screen
          </h3>
          <p className="text-xs mt-0.5 px-1 text-muted-foreground">
            Choose which corner of the display in-app toast banners appear.
          </p>
        </div>

        <div className="gap-3 max-w-lg grid grid-cols-2">
          {(
            [
              { id: 'top-left', label: 'Top Left', defaultBadge: false },
              { id: 'top-right', label: 'Top Right', defaultBadge: false },
              { id: 'bottom-left', label: 'Bottom Left', defaultBadge: false },
              { id: 'bottom-right', label: 'Bottom Right', defaultBadge: true },
            ] as const
          ).map((pos) => {
            const isSelected = notifications.position === pos.id;
            return (
              <div
                key={pos.id}
                role="button"
                tabIndex={0}
                onClick={() => handlePositionSelect(pos.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handlePositionSelect(pos.id);
                  }
                }}
                className={cn(
                  'p-3 gap-2 flex cursor-pointer items-center justify-between rounded-xl border text-left transition-all select-none',
                  isSelected
                    ? 'font-semibold border-primary/80 bg-primary/5 text-foreground shadow-xs ring-2 ring-primary/20'
                    : 'hover:border-border-focus border-border bg-surface-inset text-muted-foreground hover:bg-accent/30',
                )}
              >
                <div className="gap-2 flex items-center">
                  <span className="text-xs">{pos.label}</span>
                  {pos.defaultBadge && (
                    <Badge variant="neutral" className="py-0 px-1 text-[9px]">
                      Default
                    </Badge>
                  )}
                </div>
                {isSelected && (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Notification Size & Dismiss Duration */}
      <div className="sm:grid-cols-2 gap-6 grid grid-cols-1">
        {/* Size Selection */}
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Banner Size
            </h3>
            <p className="text-xs mt-0.5 px-1 text-muted-foreground">
              Choose compact or relaxed toast banners.
            </p>
          </div>

          <div className="gap-3 grid grid-cols-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSizeSelect('comfy')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  handleSizeSelect('comfy');
              }}
              className={cn(
                'p-3 flex cursor-pointer items-center justify-between rounded-xl border text-left transition-all select-none',
                notifications.size === 'comfy'
                  ? 'border-primary/80 bg-primary/5 shadow-xs ring-2 ring-primary/20'
                  : 'hover:border-border-focus border-border bg-surface-inset hover:bg-accent/30',
              )}
            >
              <div className="gap-2 flex items-center">
                <AlignJustify className="size-4 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  Comfy
                </span>
              </div>
              {notifications.size === 'comfy' && (
                <CheckCircle2 className="size-4 text-primary" />
              )}
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSizeSelect('compact')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  handleSizeSelect('compact');
              }}
              className={cn(
                'p-3 flex cursor-pointer items-center justify-between rounded-xl border text-left transition-all select-none',
                notifications.size === 'compact'
                  ? 'border-primary/80 bg-primary/5 shadow-xs ring-2 ring-primary/20'
                  : 'hover:border-border-focus border-border bg-surface-inset hover:bg-accent/30',
              )}
            >
              <div className="gap-2 flex items-center">
                <Sparkles className="size-4 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  Compact
                </span>
              </div>
              {notifications.size === 'compact' && (
                <CheckCircle2 className="size-4 text-primary" />
              )}
            </div>
          </div>
        </div>

        {/* Dismiss Duration */}
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Dismiss Duration
            </h3>
            <p className="text-xs mt-0.5 px-1 text-muted-foreground">
              How long alerts stay visible before fading away.
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border bg-surface-inset">
            <Select
              value={
                notifications.dismissDuration === null
                  ? 'never'
                  : String(notifications.dismissDuration)
              }
              onValueChange={handleDurationSelect}
            >
              <SelectTrigger className="h-8 text-xs border-border bg-surface">
                <div className="gap-2 flex items-center">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="5 seconds" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3000" className="text-xs">
                  3 seconds (Fast)
                </SelectItem>
                <SelectItem value="5000" className="text-xs">
                  5 seconds (Default)
                </SelectItem>
                <SelectItem value="10000" className="text-xs">
                  10 seconds
                </SelectItem>
                <SelectItem value="15000" className="text-xs">
                  15 seconds
                </SelectItem>
                <SelectItem value="30000" className="text-xs">
                  30 seconds
                </SelectItem>
                <SelectItem value="never" className="text-xs">
                  Never (Sticky until closed)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
