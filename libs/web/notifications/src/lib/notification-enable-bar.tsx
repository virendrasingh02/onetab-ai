import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
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
import { useCallback, useEffect, useState } from 'react';
import { isDesktop, notify } from '@org/web-desktop';
import {
  useNotificationPreferenceMutations,
  useNotificationPreferences,
  usePushDeviceMutations,
} from './use-notifications.js';

const SNOOZE_STORAGE_KEY = 'onetab:notifications:enable-bar:snooze-until';
const DISMISSED_STORAGE_KEY = 'onetab:notifications:enable-bar:dismissed';

export interface UseNotificationPermissionBarReturn {
  permission: NotificationPermission | 'unsupported';
  shouldShow: boolean;
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
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (isDesktop) return 'granted';
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
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
        title: 'OneTab AI Desktop',
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

    if (typeof window === 'undefined' || !('Notification' in window)) return false;
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

  const resetBarState = useCallback(() => {
    setSnoozedUntil(null);
    setIsDismissed(false);
    try {
      window.localStorage.removeItem(SNOOZE_STORAGE_KEY);
      window.localStorage.removeItem(DISMISSED_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const isSnoozed = snoozedUntil !== null && Date.now() < snoozedUntil;
  const shouldShow = permission === 'default' && !isSnoozed && !isDismissed;

  return {
    permission,
    shouldShow,
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
    const success = await requestPermission();
    setIsSubmitting(false);

    if (success) {
      if (workspaceId && preferences.data) {
        update.mutate({ pushEnabled: true });
      }

      // Register Push Device with Backend API
      let pushKey = '';
      try {
        pushKey = localStorage.getItem('onetab:notifications:push-key') || '';
        if (!pushKey) {
          pushKey = `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          localStorage.setItem('onetab:notifications:push-key', pushKey);
        }
      } catch {
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
      setTimeout(() => setGrantedToast(false), 4000);
    }
  };

  if (grantedToast) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-between border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 backdrop-blur-md transition-all duration-300',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
          </div>
          <span className="font-medium">
            Desktop notifications enabled! You will stay updated on activity.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs border-emerald-500/30 hover:bg-emerald-500/20"
          onClick={() => setGrantedToast(false)}
        >
          Got it
        </Button>
      </div>
    );
  }

  if (!shouldShow && permission !== 'denied') {
    return null;
  }

  if (permission === 'denied') {
    return (
      <div
        className={cn(
          'relative flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 backdrop-blur-md',
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate">
            Notifications are blocked in your browser settings. Unblock them in your site settings to receive alerts.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs border-amber-500/30 hover:bg-amber-500/20"
          onClick={dismissPermanently}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  const isMentionsOnly = preferences.data?.mentionsOnly ?? false;

  return (
    <div
      className={cn(
        'relative flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-gradient-to-r from-primary/10 via-background to-accent/10 px-4 py-2.5 shadow-sm backdrop-blur-md transition-all duration-300',
        className,
      )}
      role="region"
      aria-label="Notification setup bar"
    >
      {/* Left: Icon & Headline */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-inner">
          <BellRing className="size-4 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex size-2.5 rounded-full bg-primary"></span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold tracking-tight text-foreground">
              Enable Real-time Notifications
            </h4>
            <Badge variant="primary" className="text-[10px] py-0 px-1.5 h-4 font-medium">
              Recommended
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            Stay in sync with mentions, messages, and important workspace activity.
          </p>
        </div>
      </div>

      {/* Right: Actions & Options */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Quick Preference Selector */}
        {workspaceId && preferences.data ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs bg-background/80 hover:bg-accent"
              >
                <Settings2 className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Scope:</span>
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
              <DropdownMenuSeparator />
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
                {!isMentionsOnly && <Check className="size-3.5 ml-auto text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => update.mutate({ mentionsOnly: true })}
                className="gap-2 text-xs"
              >
                <BellRing className="size-3.5 text-amber-500" />
                <div className="flex flex-col">
                  <span>Mentions Only</span>
                  <span className="text-[10px] text-muted-foreground">
                    Direct @mentions & DMs
                  </span>
                </div>
                {isMentionsOnly && <Check className="size-3.5 ml-auto text-primary" />}
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
              className="h-8 gap-1.5 text-xs bg-background/80 hover:bg-accent"
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
          className="h-8 gap-1.5 text-xs px-3 shadow-sm font-medium"
        >
          <BellRing className="size-3.5" />
          <span>Enable Notifications</span>
        </Button>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => snooze(24)}
          title="Close (remind tomorrow)"
        >
          <X className="size-4" />
          <span className="sr-only">Close bar</span>
        </Button>
      </div>
    </div>
  );
}
