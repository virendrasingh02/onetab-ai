import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn, generateId } from '@org/utils';
import {
  BellRing,
  Check,
  ChevronDown,
  Clock,
  Settings2,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isDesktop, notify } from '@org/web-desktop';
import {
  useNotificationPreferenceMutations,
  useNotificationPreferences,
  usePushDeviceMutations,
} from './use-notifications.js';

const SNOOZE_STORAGE_KEY = 'onetab:notifications:enable-bar:snooze-until';
const DISMISSED_STORAGE_KEY = 'onetab:notifications:enable-bar:dismissed';
const BLOCKED_DISMISSED_STORAGE_KEY =
  'onetab:notifications:enable-bar:blocked-dismissed';

export interface UseNotificationPermissionBarReturn {
  permission: NotificationPermission | 'unsupported';
  shouldShow: boolean;
  /** Permission is blocked and the user hasn't dismissed the blocked notice. */
  showBlockedNotice: boolean;
  dismissBlockedNotice: () => void;
  isSnoozed: boolean;
  isDismissed: boolean;
  requestPermission: () => Promise<boolean>;
  snooze: (hours: number) => void;
  dismissPermanently: () => void;
  resetBarState: () => void;
}

/**
 * Hook managing browser notification permission state, local snooze durations,
 * and dismissal persistence.
 */
export function useNotificationPermissionBar(): UseNotificationPermissionBarReturn {
  const [permission, setPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (isDesktop) return 'granted';
    if (typeof window === 'undefined' || !('Notification' in window))
      return 'unsupported';
    return Notification.permission;
  });

  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem(SNOOZE_STORAGE_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  });

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(DISMISSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isBlockedNoticeDismissed, setIsBlockedNoticeDismissed] =
    useState<boolean>(() => {
      if (typeof window === 'undefined') return false;
      try {
        return (
          window.localStorage.getItem(BLOCKED_DISMISSED_STORAGE_KEY) === 'true'
        );
      } catch {
        return false;
      }
    });

  /*
   * Track the browser's live permission. Unblocking (or blocking) happens in
   * the browser's site settings, outside the app, so a one-time read goes
   * stale. The Permissions API fires `change` when it flips; focus /
   * visibility re-reads cover browsers whose `change` event is unreliable for
   * notifications (Safari, older Firefox).
   */
  useEffect(() => {
    if (isDesktop) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const sync = () => setPermission(Notification.permission);
    let status: PermissionStatus | null = null;
    let cancelled = false;

    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        status.addEventListener('change', sync);
      })
      .catch(() => {
        /* Permissions API unavailable for notifications — focus re-read covers it */
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    sync();

    return () => {
      cancelled = true;
      status?.removeEventListener('change', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Once the user unblocks, a later re-block should surface the notice again.
  useEffect(() => {
    if (permission === 'denied' || !isBlockedNoticeDismissed) return;
    setIsBlockedNoticeDismissed(false);
    try {
      window.localStorage.removeItem(BLOCKED_DISMISSED_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [permission, isBlockedNoticeDismissed]);

  useEffect(() => {
    if (snoozedUntil && Date.now() > snoozedUntil) {
      setSnoozedUntil(null);
      try {
        window.localStorage.removeItem(SNOOZE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [snoozedUntil]);

  const requestPermission = useCallback(async () => {
    if (isDesktop) {
      await notify({
        title: 'Onetab AI Desktop',
        body: 'Push and desktop notifications are active and ready.',
      });
      try {
        window.localStorage.removeItem(SNOOZE_STORAGE_KEY);
        window.localStorage.removeItem(DISMISSED_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setSnoozedUntil(null);
      setIsDismissed(false);
      return true;
    }

    if (typeof window === 'undefined' || !('Notification' in window))
      return false;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        try {
          window.localStorage.removeItem(SNOOZE_STORAGE_KEY);
          window.localStorage.removeItem(DISMISSED_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setSnoozedUntil(null);
        setIsDismissed(false);
      }
      return res === 'granted';
    } catch {
      return false;
    }
  }, []);

  const snooze = useCallback((hours: number) => {
    const until = Date.now() + hours * 60 * 60 * 1000;
    setSnoozedUntil(until);
    try {
      window.localStorage.setItem(SNOOZE_STORAGE_KEY, until.toString());
    } catch {
      /* ignore */
    }
  }, []);

  const dismissPermanently = useCallback(() => {
    setIsDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const dismissBlockedNotice = useCallback(() => {
    setIsBlockedNoticeDismissed(true);
    try {
      window.localStorage.setItem(BLOCKED_DISMISSED_STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const resetBarState = useCallback(() => {
    setSnoozedUntil(null);
    setIsDismissed(false);
    setIsBlockedNoticeDismissed(false);
    try {
      window.localStorage.removeItem(SNOOZE_STORAGE_KEY);
      window.localStorage.removeItem(DISMISSED_STORAGE_KEY);
      window.localStorage.removeItem(BLOCKED_DISMISSED_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const isSnoozed = snoozedUntil !== null && Date.now() < snoozedUntil;
  const shouldShow = permission === 'default' && !isSnoozed && !isDismissed;
  const showBlockedNotice =
    permission === 'denied' && !isBlockedNoticeDismissed;

  return {
    permission,
    shouldShow,
    showBlockedNotice,
    dismissBlockedNotice,
    isSnoozed,
    isDismissed,
    requestPermission,
    snooze,
    dismissPermanently,
    resetBarState,
  };
}

export interface NotificationEnableBarProps {
  workspaceId?: string;
  className?: string;
  onStateChange?: (enabled: boolean) => void;
}

/**
 * A top action bar prompting the user to enable notifications or customize reminder settings.
 */
export function NotificationEnableBar({
  workspaceId,
  className,
  onStateChange,
}: NotificationEnableBarProps) {
  const {
    permission,
    shouldShow,
    showBlockedNotice,
    dismissBlockedNotice,
    requestPermission,
    snooze,
    dismissPermanently,
  } = useNotificationPermissionBar();

  const preferences = useNotificationPreferences(workspaceId);
  const { update } = useNotificationPreferenceMutations(workspaceId);
  const { register: registerDevice } = usePushDeviceMutations();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [grantedToast, setGrantedToast] = useState(false);

  const handleEnable = async () => {
    setIsSubmitting(true);
    await requestPermission();
    setIsSubmitting(false);
  };

  /*
   * Register this device with the backend whenever permission *becomes*
   * granted — from the Enable button or from the user unblocking the site in
   * browser settings (observed live by the hook). Already-granted on mount is
   * not a transition, so reloads don't re-register.
   */
  const prevPermission = useRef(permission);
  useEffect(() => {
    const prev = prevPermission.current;
    prevPermission.current = permission;
    if (prev === permission || permission !== 'granted') return;

    if (workspaceId && preferences.data) {
      update.mutate({ pushEnabled: true });
    }

    // Register Push Device with Backend API
    let pushKey: string;
    try {
      pushKey = localStorage.getItem('onetab:notifications:push-key') || '';
      if (!pushKey) {
        pushKey = generateId('device');
        localStorage.setItem('onetab:notifications:push-key', pushKey);
      }
    } catch {
      // Storage blocked by policy: the device still registers, it just gets
      // a fresh key each time rather than a stable one.
      pushKey = `device-${Date.now()}`;
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const platform = isDesktop
      ? 'Desktop App'
      : /Mac/.test(ua)
        ? 'macOS'
        : /Win/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Web';
    const browser = /Chrome/.test(ua)
      ? 'Chrome'
      : /Firefox/.test(ua)
        ? 'Firefox'
        : /Safari/.test(ua)
          ? 'Safari'
          : 'Browser';

    registerDevice.mutate({
      pushKey,
      appId: isDesktop ? 'onetab-desktop' : 'onetab-web',
      deviceDisplayName: `${browser} on ${platform}`,
    });

    setGrantedToast(true);
    onStateChange?.(true);
    // Only the permission transition should trigger registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  useEffect(() => {
    if (!grantedToast) return;
    const t = setTimeout(() => setGrantedToast(false), 4000);
    return () => clearTimeout(t);
  }, [grantedToast]);

  if (grantedToast) {
    return (
      <div
        className={cn(
          'gap-3 h-8 pl-3 pr-1 text-xs flex items-center justify-between rounded-lg border border-success/25 bg-success/5 text-success-text',
          className,
        )}
      >
        <div className="gap-2 flex items-center">
          <Check className="size-3.5 shrink-0" />
          <span className="font-medium">
            Desktop notifications enabled! You will stay updated on activity.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs shrink-0 hover:bg-success/15"
          onClick={() => setGrantedToast(false)}
        >
          Got it
        </Button>
      </div>
    );
  }

  if (showBlockedNotice) {
    return (
      <div
        role="status"
        className={cn(
          'gap-3 h-8 pl-3 pr-1 text-xs flex items-center justify-between rounded-lg border border-warning/25 bg-warning/5 text-warning-text',
          className,
        )}
      >
        <div className="gap-2 min-w-0 flex items-center">
          <ShieldAlert className="size-3.5 shrink-0" />
          <span className="truncate">
            <span className="font-medium">Notifications are blocked.</span>{' '}
            <span className="text-muted-foreground">
              Allow them for this site in your browser&apos;s site settings —
              this bar will clear on its own.
            </span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs shrink-0 hover:bg-warning/15"
          onClick={dismissBlockedNotice}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  if (!shouldShow) {
    return null;
  }

  const isMentionsOnly = preferences.data?.mentionsOnly ?? false;

  return (
    <div
      className={cn(
        'gap-3 min-h-8 py-0.5 pl-2 pr-1 relative flex flex-wrap items-center justify-between rounded-lg border border-border/70 bg-gradient-to-r from-primary/10 via-card to-accent/10',
        className,
      )}
      role="region"
      aria-label="Notification setup bar"
    >
      {/* Left: Icon & Headline */}
      <div className="gap-3 min-w-0 flex flex-1 items-center">
        <div className="size-6 relative flex shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <BellRing className="size-3.5" />
          <span className="-top-0.5 -right-0.5 size-2 absolute flex">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="size-2 relative inline-flex rounded-full bg-primary"></span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="gap-2 flex items-center">
            <h4 className="text-xs font-medium text-foreground">
              Enable Real-time Notifications
            </h4>
          </div>
        </div>
      </div>

      {/* Right: Actions & Options */}
      <div className="gap-1.5 flex shrink-0 items-center">
        {/* Quick Preference Selector */}
        {workspaceId && preferences.data ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1.5 text-xs bg-background/80 hover:bg-accent"
              >
                <Settings2 className="size-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {isMentionsOnly ? 'Mentions Only' : 'All Activity'}
                </span>
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Notification Scope
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => update.mutate({ mentionsOnly: false })}
                className="gap-2 text-xs"
              >
                <Sparkles className="size-3.5 text-primary" />
                <div className="flex flex-col">
                  <span>All Activity</span>
                  <span className="text-[10px] text-muted-foreground">
                    Messages, mentions & replies
                  </span>
                </div>
                {!isMentionsOnly && (
                  <Check className="size-3.5 ml-auto text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => update.mutate({ mentionsOnly: true })}
                className="gap-2 text-xs"
              >
                <BellRing className="size-3.5 text-warning-text" />
                <div className="flex flex-col">
                  <span>Mentions Only</span>
                  <span className="text-[10px] text-muted-foreground">
                    Direct @mentions & DMs
                  </span>
                </div>
                {isMentionsOnly && (
                  <Check className="size-3.5 ml-auto text-primary" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {/* Option 2: Remind Me Later / Snooze Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1.5 text-xs bg-background/80 hover:bg-accent"
            >
              <Clock className="size-3.5 text-muted-foreground" />
              <span>Remind Me</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              Snooze Notification Bar
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => snooze(24)} className="text-xs">
              In 24 hours
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(72)} className="text-xs">
              In 3 days
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(168)} className="text-xs">
              In 1 week
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={dismissPermanently}
              className="text-xs text-destructive focus:text-destructive"
            >
              Don&apos;t ask again
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Option 1: Enable Notifications (Primary Action) */}
        <Button
          variant="primary"
          size="sm"
          loading={isSubmitting}
          onClick={() => void handleEnable()}
          className="h-6 gap-1.5 text-xs px-3 shadow-sm font-medium"
        >
          <BellRing className="size-3.5" />
          <span>Enable Notifications</span>
        </Button>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => snooze(24)}
          title="Close (remind tomorrow)"
        >
          <X className="size-3.5" />
          <span className="sr-only">Close bar</span>
        </Button>
      </div>
    </div>
  );
}
