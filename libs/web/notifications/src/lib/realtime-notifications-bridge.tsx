import { resolveDeepLinkRoute } from '@org/platform';
import {
  RealtimeEventType,
  useRealtime,
  type NotificationCreatedPayload,
  type RealtimeEvent,
} from '@org/realtime';
import { useEffect } from 'react';
import { notificationService } from './notification-service.js';

export interface RealtimeNotificationsBridgeProps {
  /** The signed-in user's id — used to ignore the user's own actions. */
  currentUserId: string | undefined;
  /** Active workspace slug, for turning a relative `deepLink` into a route. */
  workspaceSlug: string | undefined;
}

/**
 * Turns the server's `notification.created` real-time events into an actual
 * toast + native desktop notification.
 *
 * Until this existed, `notification.created` only invalidated the bell's unread
 * query (in `RealtimeProvider`) — an @mention or a task assignment from a
 * teammate produced no toast and no OS notification while you were working; the
 * badge just caught up on its next poll. This closes that gap using the
 * notification service that was already built for it (call-suppression, content
 * -preview privacy, taskbar flash, preference handling) — it was only ever
 * wired to a "send test" button.
 *
 * Renders nothing. Mount it once, inside `RealtimeProvider`, somewhere that
 * only exists while the user is signed in and in a workspace (`AppShell`).
 */
export function RealtimeNotificationsBridge({
  currentUserId,
  workspaceSlug,
}: RealtimeNotificationsBridgeProps) {
  const { bus } = useRealtime();

  useEffect(() => {
    return bus.on<NotificationCreatedPayload>(
      RealtimeEventType.NotificationCreated,
      (event: RealtimeEvent<NotificationCreatedPayload>) => {
        const notification = event.payload?.notification;
        if (!notification) return;

        // The server already refuses to notify someone about their own action,
        // but a self-check here costs nothing and guards a stale payload.
        if (
          currentUserId &&
          notification.actorId &&
          notification.actorId === currentUserId
        ) {
          return;
        }

        // One browser, many tabs: every tab receives this over its own stream
        // (and again via the cross-tab broadcast). Let the first tab to see this
        // id own the toast so the user does not get one per open tab.
        if (event.id && !claimNotification(event.id)) return;

        const resolved = resolveDeepLinkRoute(notification.deepLink, {
          workspaceSlug,
        });
        const targetPath = resolved.route?.split(/[?#]/)[0];

        const focused =
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible' &&
          document.hasFocus();

        // Already looking at exactly what this is about — no interruption.
        if (
          focused &&
          targetPath &&
          typeof window !== 'undefined' &&
          window.location.pathname === targetPath
        ) {
          return;
        }

        const kind = notification.kind ?? '';
        const isMessageKind = /MESSAGE|MENTION|DM|COMMENT|REPLY/i.test(kind);
        const isMentionKind = /MENTION/i.test(kind);
        const isCriticalKind = /SECURITY|CRITICAL/i.test(kind);
        // An incoming huddle / call — the one cue allowed to be a touch more
        // distinguishable. Harmless until such a notification kind exists; it
        // then rings with the user-configurable "Incoming call" cue.
        const isCallKind = /\b(CALL|HUDDLE|RINGING)\b/i.test(kind);

        // Pick the calm cue that fits: incoming calls, then mentions and
        // security alerts, then the soft "message" tone for everything else.
        // A plain task / invite / doc notification keeps `info` + `message`.
        const soundEvent = isCallKind
          ? 'call'
          : isCriticalKind
            ? 'priority'
            : isMentionKind
              ? 'mention'
              : 'message';

        void notificationService.notify({
          id: notification.id,
          title: notification.title,
          body: notification.body ?? '',
          type: isMessageKind ? 'message' : 'info',
          priority:
            isCallKind || isCriticalKind
              ? 'critical'
              : isMentionKind
                ? 'high'
                : 'normal',
          soundEvent,
          route: resolved.route ?? undefined,
          workspaceId: notification.workspaceId,
          // Focused-but-elsewhere: a toast is enough, skip the OS-level
          // notification (and its sound). Backgrounded: the OS notification is
          // the whole point — it survives a hidden window.
          silent: focused,
        });
      },
    );
  }, [bus, currentUserId, workspaceSlug]);

  return null;
}

const CLAIMS_KEY = 'onetab:notifications:claims';
const CLAIM_TTL_MS = 90_000;

/**
 * First-caller-wins across the tabs of one browser, backed by `localStorage`.
 * Returns `true` for the tab that should act on this event id, `false` for the
 * rest. Best-effort — if storage is unavailable, every tab acts (the old
 * behaviour), which is safe, just noisier.
 */
function claimNotification(id: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(CLAIMS_KEY);
    const claims: Record<string, number> = raw ? JSON.parse(raw) : {};

    let changed = false;
    for (const key of Object.keys(claims)) {
      if (now - claims[key] > CLAIM_TTL_MS) {
        delete claims[key];
        changed = true;
      }
    }

    const mine = claims[id] === undefined;
    if (mine) {
      claims[id] = now;
      changed = true;
    }
    if (changed) {
      window.localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
    }
    return mine;
  } catch {
    return true;
  }
}
