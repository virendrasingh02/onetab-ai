import {
  useNotificationDisplayPreferences,
  useUserPreferences,
} from '@org/common';
import {
  notificationService,
  useNotificationSoundControls,
  useWorkspaceSoundMuteControl,
} from '@org/notifications';
import type {
  NotificationDismissDuration,
  NotificationPosition,
  NotificationSize,
  NotificationSoundEvent,
} from '@org/types';
import {
  Badge,
  Button,
  NOTIFICATION_SOUND_EVENT_LABELS,
  NOTIFICATION_SOUND_PROFILE_OPTIONS,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
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
  AtSign,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Laptop,
  MessageSquare,
  Phone,
  PhoneCall,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState } from 'react';

const SOUND_EVENT_ORDER: NotificationSoundEvent[] = [
  'message',
  'dm',
  'mention',
  'priority',
  'call',
  'success',
];

const SOUND_EVENT_ICON: Record<
  NotificationSoundEvent,
  typeof MessageSquare
> = {
  message: MessageSquare,
  dm: Bell,
  mention: AtSign,
  priority: ShieldAlert,
  call: Phone,
  success: CheckCircle2,
};

export function NotificationDisplaySettingsPanel({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const { notifications, updateNotificationPreferences } =
    useNotificationDisplayPreferences();
  const { resetPreferences } = useUserPreferences();
  const capabilities = useCapabilities();
  const isTaskbarFlashSupported = useTaskbarFlashSupported();
  const isSystemSettingsSupported = useSystemSettingsSupported();

  const {
    sound,
    reduceDistractionActive,
    setEnabled: setSoundEnabled,
    setVolume: setSoundVolume,
    setProfile: setSoundProfile,
    setOnlyWhenUnfocused: setSoundOnlyWhenUnfocused,
    setEventEnabled: setSoundEventEnabled,
    preview: previewSound,
  } = useNotificationSoundControls();
  const [workspaceSoundMuted, setWorkspaceSoundMuted] =
    useWorkspaceSoundMuteControl(workspaceId);

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

      {/* 1.5 Notification Sounds */}
      <div className="space-y-3">
        <div className="px-1 flex items-end justify-between">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Notification Sounds
            </h3>
            <p className="text-xs mt-0.5 text-muted-foreground">
              Soft, short audio cues for meaningful notifications. Sounds are
              never the only signal — badges, unread dots and banners are
              unchanged.
            </p>
          </div>
        </div>

        <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border bg-surface-inset shadow-xs">
          {/* Master switch */}
          <div className="p-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40">
            <div className="gap-3 flex items-start">
              <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {sound.enabled ? (
                  <BellRing className="size-4" />
                ) : (
                  <VolumeX className="size-4" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium text-foreground">
                  Play notification sounds
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Turn off to silence every notification sound everywhere. Visual
                  notifications keep working.
                </p>
              </div>
            </div>
            <Switch
              checked={sound.enabled}
              onCheckedChange={setSoundEnabled}
              aria-label="Play notification sounds"
            />
          </div>

          {/* Master volume */}
          <div
            className={cn(
              'p-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40',
              !sound.enabled && 'opacity-50',
            )}
          >
            <div className="gap-3 flex items-start">
              <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {sound.volume < 0.05 ? (
                  <VolumeX className="size-4" />
                ) : sound.volume < 0.5 ? (
                  <Volume1 className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium text-foreground">
                  Master volume
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  All cues sit deliberately low, under speech.
                </p>
              </div>
            </div>
            <div className="gap-3 w-44 flex items-center">
              <Slider
                value={[Math.round(sound.volume * 100)]}
                min={0}
                max={100}
                step={5}
                disabled={!sound.enabled}
                onValueChange={([value]) => setSoundVolume((value ?? 0) / 100)}
                aria-label="Master notification volume"
              />
              <span className="text-[11px] tabular-nums w-8 text-right text-muted-foreground">
                {Math.round(sound.volume * 100)}%
              </span>
            </div>
          </div>

          {/* Sound profile */}
          <div
            className={cn(
              'p-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40',
              !sound.enabled && 'opacity-50',
            )}
          >
            <div className="gap-3 flex items-start">
              <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-foreground">
                  Sound profile
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {NOTIFICATION_SOUND_PROFILE_OPTIONS.find(
                    (option) => option.id === sound.profile,
                  )?.description ?? 'Choose a tone palette.'}
                </p>
              </div>
            </div>
            <div className="gap-2 flex items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!sound.enabled}
                onClick={() => previewSound('message')}
                className="size-8 p-0 shrink-0"
                aria-label="Preview sound profile"
              >
                <Play className="size-3.5" />
              </Button>
              <Select
                value={sound.profile}
                onValueChange={(value) =>
                  setSoundProfile(value as typeof sound.profile)
                }
                disabled={!sound.enabled}
              >
                <SelectTrigger className="w-32 h-8 text-xs border-border bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_SOUND_PROFILE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.id}
                      value={option.id}
                      className="text-xs"
                    >
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Only when unfocused */}
          <div
            className={cn(
              'p-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40',
              !sound.enabled && 'opacity-50',
            )}
          >
            <div className="gap-3 flex items-start">
              <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Eye className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-foreground">
                  Only when I&rsquo;m not viewing the conversation
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Skip the sound when the relevant channel or DM is already open
                  in front of you. New-message and DM cues are always skipped for
                  the conversation on screen.
                </p>
              </div>
            </div>
            <Switch
              checked={sound.onlyWhenUnfocused}
              onCheckedChange={setSoundOnlyWhenUnfocused}
              disabled={!sound.enabled}
              aria-label="Play sounds only when not viewing the conversation"
            />
          </div>

          {/* Per-workspace mute */}
          <div className="p-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40">
            <div className="gap-3 flex items-start">
              <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <VolumeX className="size-4" />
              </div>
              <div>
                <div className="gap-2 flex items-center">
                  <h4 className="text-xs font-medium text-foreground">
                    Mute notification sounds in this workspace
                  </h4>
                  <Badge variant="neutral" className="py-0 px-1.5 text-[9px]">
                    This workspace
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Silences sounds for this workspace only. Your other workspaces
                  and their settings are untouched.
                </p>
              </div>
            </div>
            <Switch
              checked={workspaceSoundMuted}
              onCheckedChange={setWorkspaceSoundMuted}
              disabled={!workspaceId}
              aria-label="Mute notification sounds in this workspace"
            />
          </div>
        </div>

        {/* Sounds by type */}
        <div
          className={cn(
            'divide-y divide-border/40 overflow-hidden rounded-2xl border border-border bg-surface-inset shadow-xs',
            !sound.enabled && 'opacity-50',
          )}
        >
          <div className="p-3 px-4">
            <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Sounds by type
            </h4>
          </div>
          {SOUND_EVENT_ORDER.map((event) => {
            const Icon = SOUND_EVENT_ICON[event];
            return (
              <div
                key={event}
                className="p-3 px-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40"
              >
                <div className="gap-3 flex items-center">
                  <div className="size-7 flex shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {NOTIFICATION_SOUND_EVENT_LABELS[event]}
                  </span>
                </div>
                <div className="gap-2 flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!sound.enabled}
                    onClick={() => previewSound(event)}
                    className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Preview ${NOTIFICATION_SOUND_EVENT_LABELS[event]} sound`}
                  >
                    <Play className="size-3" />
                  </Button>
                  <Switch
                    checked={sound.events[event] !== false}
                    onCheckedChange={(checked) =>
                      setSoundEventEnabled(event, checked)
                    }
                    disabled={!sound.enabled}
                    aria-label={`${NOTIFICATION_SOUND_EVENT_LABELS[event]} sound`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          The master switch, volume, profile and per-type choices apply to every
          workspace you&rsquo;re in. Muted channels, muted DMs, &ldquo;mentions
          only&rdquo; and quiet hours are per workspace and already control which
          notifications make a sound here.
          {reduceDistractionActive && (
            <>
              {' '}
              Your system &ldquo;reduced motion&rdquo; setting is on, so ambient
              cues (new message, success) are held back and the volume is eased
              down automatically.
            </>
          )}
        </p>
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
