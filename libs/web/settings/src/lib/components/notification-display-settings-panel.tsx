import {
  useNotificationDisplayPreferences,
  useUserPreferences,
} from '@org/common';
import {
  notificationService,
  useNotificationPermissionBar,
} from '@org/notifications';
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
import React, { useState } from 'react';

export function NotificationDisplaySettingsPanel({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const { notifications, updateNotificationPreferences } =
    useNotificationDisplayPreferences();
  const { resetPreferences } = useUserPreferences();
  const notifBarState = useNotificationPermissionBar(workspaceId);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            <span>Notification Display</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Control alert appearance, on-screen positioning, privacy previews, and Windows taskbar flashing.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
          Privacy & Focus Rules
        </h3>

        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
          {/* Content Preview Switch */}
          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
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
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  When turned off, notification body contents are redacted to protect sensitive messages from passersby.
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
          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <PhoneCall className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-foreground">
                  Show notifications during calls & meetings
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  When turned off, non-critical alerts are silenced while you are active in a voice call, huddle, or video meeting.
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
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Laptop className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-medium text-foreground">
                    Flash taskbar when notification arrives
                  </h4>
                  {capabilities.isDesktop && (
                    <Badge variant="neutral" className="text-[9px] py-0 px-1.5">
                      Windows Desktop
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Flashes the desktop application icon when you receive a message in the background.
                </p>
                {!isTaskbarFlashSupported && (
                  <p className="text-[10.5px] text-amber-600 dark:text-amber-400 mt-1 italic">
                    Note: Taskbar flashing requires the OneTab Windows desktop app.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 self-end sm:self-auto">
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
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
            Position on Screen
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 px-1">
            Choose which corner of the display in-app toast banners appear.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-lg">
          {(
            [
              { id: 'top-left', label: 'Top Left' },
              { id: 'top-right', label: 'Top Right' },
              { id: 'bottom-left', label: 'Bottom Left' },
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
                  'p-3 rounded-xl border transition-all cursor-pointer select-none text-left flex items-center justify-between gap-2',
                  isSelected
                    ? 'border-primary/80 bg-primary/5 ring-2 ring-primary/20 shadow-xs font-semibold text-foreground'
                    : 'border-border bg-surface-inset hover:border-border-focus hover:bg-accent/30 text-muted-foreground',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs">{pos.label}</span>
                  {pos.defaultBadge && (
                    <Badge variant="neutral" className="text-[9px] py-0 px-1">
                      Default
                    </Badge>
                  )}
                </div>
                {isSelected && (
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Notification Size & Dismiss Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Size Selection */}
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Banner Size
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 px-1">
              Choose compact or relaxed toast banners.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSizeSelect('comfy')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSizeSelect('comfy');
              }}
              className={cn(
                'p-3 rounded-xl border transition-all cursor-pointer select-none text-left flex items-center justify-between',
                notifications.size === 'comfy'
                  ? 'border-primary/80 bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border bg-surface-inset hover:border-border-focus hover:bg-accent/30',
              )}
            >
              <div className="flex items-center gap-2">
                <AlignJustify className="size-4 text-primary" />
                <span className="text-xs font-medium text-foreground">Comfy</span>
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
                if (e.key === 'Enter' || e.key === ' ') handleSizeSelect('compact');
              }}
              className={cn(
                'p-3 rounded-xl border transition-all cursor-pointer select-none text-left flex items-center justify-between',
                notifications.size === 'compact'
                  ? 'border-primary/80 bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border bg-surface-inset hover:border-border-focus hover:bg-accent/30',
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-xs font-medium text-foreground">Compact</span>
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
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Dismiss Duration
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 px-1">
              How long alerts stay visible before fading away.
            </p>
          </div>

          <div className="bg-surface-inset rounded-xl border border-border p-2">
            <Select
              value={
                notifications.dismissDuration === null
                  ? 'never'
                  : String(notifications.dismissDuration)
              }
              onValueChange={handleDurationSelect}
            >
              <SelectTrigger className="h-9 text-xs bg-surface border-border">
                <div className="flex items-center gap-2">
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
