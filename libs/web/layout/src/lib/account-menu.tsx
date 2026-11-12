import type { CurrentUser } from '@org/types';
import {
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Hint,
  IconButton,
  toast,
  UserAvatar,
  useStatusModalStore,
} from '@org/ui';
import {
  useAccounts,
  useAuthStore,
  useLogout,
  useRemoveAccount,
} from '@org/auth';
import { userApi } from '@org/api-client';
import { usePresence } from '@org/realtime';
import { cn } from '@org/utils';
import {
  isDesktop,
  NO_DRAG,
  openDesktopApp,
  openExternal,
  useAppDownload,
} from '@org/web-desktop';
import {
  Bell,
  BellOff,
  Clock,
  CreditCard,
  Download,
  Laptop,
  LogOut,
  Settings,
  Sliders,
  Smartphone,
  Smile,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface AccountMenuProps {
  user: CurrentUser;
  workspaceSlug: string;
  /** Names the workspace in the sign-out item. */
  workspaceName?: string;
  /** Where the menu opens: below the header, or beside the app rail. */
  side?: 'bottom' | 'right';
  className?: string;
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: 'numeric',
});

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/** "Until 3:30 PM" / "Until tomorrow at 9:00 AM" / "Until Mon, Nov 16 at …". */
export function formatPauseExpiry(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) {
    return null;
  }

  const time = timeFormatter.format(date);
  if (isSameDay(date, now)) return `Until ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(date, tomorrow)) return `Until tomorrow at ${time}`;

  return `Until ${dayFormatter.format(date)} at ${time}`;
}

/** Tomorrow, 9:00 local time. */
export function tomorrowAt9(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** The coming Monday (never today), 9:00 local time. */
export function nextMondayAt9(now: Date = new Date()): Date {
  const d = new Date(now);
  const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

// Note: DropdownMenuShortcut draws a *string* child as keycaps, so hint text
// below (a time, a platform) is wrapped in a <span> to render as plain text.
const PAUSE_PRESETS: ReadonlyArray<{ label: string; minutes: number }> = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

/** The signed-in user's avatar and the menu it opens. */
export function AccountMenu({
  user,
  workspaceSlug,
  workspaceName,
  side = 'bottom',
  className,
}: AccountMenuProps) {
  const logout = useLogout();
  const removeAccount = useRemoveAccount();
  const { accounts, activeAccountId } = useAccounts();
  const navigate = useNavigate();
  const { environment, primaryOption, trackDownload } = useAppDownload();
  const openStatusModal = useStatusModalStore((s) => s.openStatusModal);
  const setUser = useAuthStore((s) => s.setUser);
  const [saving, setSaving] = useState(false);

  // Live, server-backed presence (heartbeat + SSE) is the source of truth.
  // Before the first heartbeat lands there is no entry for us ("offline"), so
  // fall back to the persisted presence on the user record — we're plainly
  // here, so that reads as active rather than offline.
  const { status: liveStatus, setManualAway } = usePresence(user.id);
  const selfStatus =
    liveStatus !== 'offline'
      ? liveStatus
      : user.presence === 'BUSY'
        ? 'busy'
        : user.presence === 'AWAY'
          ? 'away'
          : 'online';
  const isSelfAway = selfStatus === 'away';
  // "Pause notifications" is stored as BUSY presence, the same flag the
  // status modal's toggle writes. The pause window is the status expiry; the
  // server's expiry sweep lifts BUSY when it lapses.
  const isPaused = selfStatus === 'busy';
  const pauseExpiry = isPaused ? formatPauseExpiry(user.statusExpiresAt) : null;
  const hasStatus = Boolean(user.statusText || user.statusEmoji);
  const settingsPath = (section: string) =>
    `/w/${workspaceSlug}/settings/${section}`;

  const runStatusUpdate = async (
    update: () => Promise<CurrentUser>,
    success: string,
    failure: string,
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      setUser(await update());
      toast.success(success);
    } catch {
      toast.error(failure);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAway = async () => {
    const goingAway = !isSelfAway;
    try {
      // Persists server-side (POST /realtime/presence) and syncs every device.
      await setManualAway(goingAway);
      toast.success(goingAway ? 'Status set to away' : 'Status set to active');
    } catch {
      toast.error('Could not update your status. Please try again.');
    }
  };

  const pauseNotifications = (until: Date) => {
    const when = formatPauseExpiry(until);
    void runStatusUpdate(
      () =>
        userApi.updateStatus({
          statusText: user.statusText ?? null,
          statusEmoji: user.statusEmoji ?? null,
          statusExpiresAt: until.toISOString(),
          presence: 'BUSY',
        }),
      when
        ? `Notifications paused ${when.charAt(0).toLowerCase()}${when.slice(1)}`
        : 'Notifications paused',
      'Could not pause notifications. Please try again.',
    );
  };

  const resumeNotifications = () =>
    void runStatusUpdate(
      () =>
        userApi.updateStatus({
          statusText: user.statusText ?? null,
          statusEmoji: user.statusEmoji ?? null,
          statusExpiresAt: null,
          presence: 'ONLINE',
        }),
      'Notifications resumed',
      'Could not resume notifications. Please try again.',
    );

  // Clearing the status text must not end an active pause: keep its expiry
  // (and BUSY presence, which an omitted `presence` leaves untouched).
  const clearStatus = () =>
    void runStatusUpdate(
      () =>
        isPaused
          ? userApi.updateStatus({
              statusText: null,
              statusEmoji: null,
              statusExpiresAt: user.statusExpiresAt ?? null,
            })
          : userApi.clearStatus(),
      'Status cleared',
      'Could not clear your status. Please try again.',
    );

  const handle = `@${user.username || user.email.split('@')[0]}`;
  const statusLabel = isPaused
    ? 'Notifications paused'
    : isSelfAway
      ? 'Away'
      : 'Active';
  const statusTone = isPaused || isSelfAway ? 'text-warning' : 'text-success';

  return (
    <DropdownMenu>
      <Hint side={side} label="Account">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            style={NO_DRAG}
            className={cn(
              'flex touch-target cursor-pointer items-center justify-center rounded-full transition-transform outline-none hover:scale-105 focus-visible:ring-1 focus-visible:ring-ring',
              className,
            )}
            aria-label="Account menu"
          >
            <UserAvatar
              name={user.displayName ?? user.name}
              src={user.avatarUrl}
              seed={user.id}
              size="sm"
              presence={selfStatus}
              statusEmoji={user.statusEmoji}
              statusText={user.statusText}
            />
          </button>
        </DropdownMenuTrigger>
      </Hint>

      <DropdownMenuContent
        side={side}
        align="end"
        className="w-72 p-1.5 select-none"
      >
        {/* Identity row — opens the profile settings page. */}
        <DropdownMenuItem
          onSelect={() => navigate(settingsPath('profile'))}
          className="gap-3 p-2"
        >
          <UserAvatar
            name={user.displayName ?? user.name}
            src={user.avatarUrl}
            seed={user.id}
            size="md"
            presence={selfStatus}
            className="size-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate text-foreground">
              {user.displayName ?? user.name}
            </p>
            <div className="gap-1.5 mt-0.5 text-xs min-w-0 flex items-center text-muted-foreground">
              <span className="truncate font-mono">{handle}</span>
              <span aria-hidden="true">·</span>
              <span className={cn('font-medium shrink-0', statusTone)}>
                {statusLabel}
              </span>
            </div>
          </div>
        </DropdownMenuItem>

        {/* Custom status — the field opens the status modal; X clears it. */}
        <div className="px-0.5 py-1 relative flex items-center">
          <button
            type="button"
            onClick={openStatusModal}
            className={cn(
              'gap-2.5 px-3 py-2 text-xs font-medium flex w-full items-center rounded-btn border border-border bg-surface-inset/60 text-left text-muted-foreground transition-colors hover:bg-surface-inset hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
              hasStatus && 'pr-9',
            )}
          >
            {user.statusEmoji ? (
              <span className="text-sm shrink-0 leading-none" aria-hidden>
                {user.statusEmoji}
              </span>
            ) : (
              <Smile className="size-4 shrink-0" />
            )}
            <span
              className={cn('truncate', user.statusText && 'text-foreground')}
            >
              {user.statusText || 'Update your status'}
            </span>
          </button>
          {hasStatus && (
            <Hint label="Clear status">
              <IconButton
                aria-label="Clear status"
                size="icon-xs"
                disabled={saving}
                onClick={clearStatus}
                className="right-2 absolute"
              >
                <X />
              </IconButton>
            </Hint>
          )}
        </div>

        <DropdownMenuItem onSelect={() => void handleToggleAway()}>
          <span
            aria-hidden
            className={cn(
              'size-2 mx-0.5 shrink-0 rounded-full',
              isSelfAway ? 'bg-success' : 'bg-warning',
            )}
          />
          <span>
            Set yourself as <strong>{isSelfAway ? 'active' : 'away'}</strong>
          </span>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {isPaused ? (
              <BellOff className="size-3.5 text-warning" />
            ) : (
              <Bell className="size-3.5 text-muted-foreground" />
            )}
            <span className="flex-1">
              {isPaused ? 'Notifications paused' : 'Pause notifications'}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6} className="w-60">
            {isPaused && (
              <>
                <DropdownMenuItem
                  disabled={saving}
                  onSelect={resumeNotifications}
                  description={pauseExpiry ?? undefined}
                >
                  <Bell className="size-3.5 text-muted-foreground" />
                  <span>Resume notifications</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>
              {isPaused ? 'Change pause' : 'Pause for'}
            </DropdownMenuLabel>
            {PAUSE_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.minutes}
                disabled={saving}
                onSelect={() =>
                  pauseNotifications(
                    new Date(Date.now() + preset.minutes * 60_000),
                  )
                }
              >
                {preset.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              disabled={saving}
              onSelect={() => pauseNotifications(tomorrowAt9())}
            >
              <span>Until tomorrow</span>
              <DropdownMenuShortcut>
                <span>{timeFormatter.format(tomorrowAt9())}</span>
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={saving}
              onSelect={() => pauseNotifications(nextMondayAt9())}
            >
              <span>Until next week</span>
              <DropdownMenuShortcut>
                <span>Mon</span>
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openStatusModal}>
              Custom…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => navigate(settingsPath('language'))}
            >
              <Clock className="size-3.5 text-muted-foreground" />
              <span>Working hours</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigate(settingsPath('notifications'))}
            >
              <Settings className="size-3.5 text-muted-foreground" />
              <span>Notification settings</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => navigate(settingsPath('appearance'))}>
          <Sliders className="size-3.5 text-muted-foreground" />
          <span>Preferences</span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => navigate(settingsPath('profile'))}>
          <Settings className="size-3.5 text-muted-foreground" />
          <span>Account settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => navigate(settingsPath('billing'))}>
          <CreditCard className="size-3.5 text-muted-foreground" />
          <span>Plans & Billing</span>
        </DropdownMenuItem>

        {/* App download / open desktop app (web only) */}
        {!isDesktop && (
          <>
            <DropdownMenuSeparator />
            {environment.isMobile ? (
              primaryOption && (
                <DropdownMenuItem
                  onSelect={() => {
                    trackDownload(primaryOption, 'account_menu');
                    void openExternal(primaryOption.url);
                  }}
                  className="text-primary"
                >
                  <Smartphone className="size-3.5" />
                  <span>Get Mobile App</span>
                  <DropdownMenuShortcut className="uppercase">
                    <span>{environment.os === 'ios' ? 'iOS' : 'Android'}</span>
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              )
            ) : (
              <>
                {primaryOption && (
                  <DropdownMenuItem
                    onSelect={() => {
                      trackDownload(primaryOption, 'account_menu');
                      void openExternal(primaryOption.url);
                    }}
                    className="text-primary"
                  >
                    <Download className="size-3.5" />
                    <span>Download Desktop App</span>
                    <DropdownMenuShortcut className="uppercase">
                      <span>{primaryOption.storeOrFormat.split(' ')[0]}</span>
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => void openDesktopApp({ route: 'open' })}
                >
                  <Laptop className="size-3.5 text-muted-foreground" />
                  <span>Open Desktop App</span>
                </DropdownMenuItem>
              </>
            )}
          </>
        )}

        <DropdownMenuSeparator />

        {/*
          Sign out of the *current account* only. If another account is
          linked, `useRemoveAccount` drops this one and switches to the
          most recent remaining account's workspace; it falls through to
          /login only when nothing is left. A separate item ends every
          linked session at once, shown just when there is more than one.
        */}
        <DropdownMenuItem
          variant="destructive"
          disabled={removeAccount.isPending}
          onSelect={() => {
            void confirm({
              title: `Sign out of ${workspaceName ?? 'this workspace'}?`,
              description:
                'This ends your session for this account. You will need to sign in again to come back.',
              confirmLabel: 'Sign out',
              destructive: true,
            }).then((ok) => {
              if (ok) removeAccount.mutate(activeAccountId ?? user.id);
            });
          }}
        >
          <LogOut className="size-3.5" />
          <span>Sign out of {workspaceName ?? 'this workspace'}</span>
        </DropdownMenuItem>

        {accounts.length > 1 && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => logout.mutate()}
          >
            <LogOut className="size-3.5" />
            <span>Sign out of all accounts</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
