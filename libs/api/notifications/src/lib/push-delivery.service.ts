import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const EXPO_BATCH_SIZE = 100;

interface NotificationCreatedEvent {
  recipientId: string;
  workspaceId: string;
  notification: {
    id: string;
    title: string;
    body: string | null;
    deepLink: string | null;
    kind: string;
  };
  unreadCount?: number;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Expo push tokens, as minted by `expo-notifications` on the device. */
export function isExpoPushToken(key: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(key);
}

function minutesOf(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Whether `now` falls inside the user's quiet hours, read in their own time
 * zone. The window may wrap midnight ("22:00"–"07:00"). A malformed window or
 * unknown zone never suppresses anything.
 */
export function isWithinQuietHours(
  now: Date,
  timeZone: string,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!start || !end) return false;
  const from = minutesOf(start);
  const to = minutesOf(end);
  if (from === null || to === null || from === to) return false;

  let local: number;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
    local = hour * 60 + minute;
  } catch {
    return false;
  }

  return from < to ? local >= from && local < to : local >= from || local < to;
}

/**
 * Delivers notification-centre rows to the recipient's phones.
 *
 * `PushRegistration` rows were being written by the devices endpoint but nothing
 * ever sent to them. This listens on the same `NotificationCreated` event the
 * realtime bridge uses, so every trigger that already reaches the bell also
 * reaches the lock screen — no per-feature wiring.
 *
 * Only Expo tokens (the mobile app) are handled here; the payload carries the
 * workspace-relative deep link so a tap lands on the same route the bell opens.
 * A token Expo reports as `DeviceNotRegistered` is revoked, which is how an
 * uninstalled app stops receiving traffic.
 */
@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent(AppEvent.NotificationCreated, { async: true })
  async onNotificationCreated(event: NotificationCreatedEvent): Promise<void> {
    try {
      await this.deliver(event);
    } catch (error) {
      // A push outage must never break the request that created the row.
      this.logger.warn(
        `Push delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deliver(
    event: NotificationCreatedEvent,
    now = new Date(),
  ): Promise<number> {
    if (this.config.get<string>('PUSH_DELIVERY_DISABLED') === 'true') return 0;

    const registrations = await this.prisma.pushRegistration.findMany({
      where: { userId: event.recipientId, revokedAt: null },
      select: { id: true, pushKey: true },
    });
    const targets = registrations.filter((r) => isExpoPushToken(r.pushKey));
    if (targets.length === 0) return 0;

    const [preference, user, workspace] = await Promise.all([
      this.prisma.notificationPreference.findUnique({
        where: {
          userId_workspaceId: {
            userId: event.recipientId,
            workspaceId: event.workspaceId,
          },
        },
        select: {
          pushEnabled: true,
          quietHoursStart: true,
          quietHoursEnd: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: event.recipientId },
        select: { timezone: true },
      }),
      this.prisma.workspace.findUnique({
        where: { id: event.workspaceId },
        select: { slug: true },
      }),
    ]);

    if (preference && !preference.pushEnabled) return 0;
    if (
      isWithinQuietHours(
        now,
        user?.timezone ?? 'UTC',
        preference?.quietHoursStart,
        preference?.quietHoursEnd,
      )
    ) {
      return 0;
    }

    const messages = targets.map((target) => ({
      to: target.pushKey,
      title: event.notification.title,
      body: event.notification.body ?? undefined,
      sound: 'default',
      badge: event.unreadCount,
      channelId: 'default',
      data: {
        notificationId: event.notification.id,
        kind: event.notification.kind,
        workspaceId: event.workspaceId,
        workspaceSlug: workspace?.slug ?? null,
        deepLink: event.notification.deepLink,
      },
    }));

    let delivered = 0;
    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
      const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
      const tickets = await this.send(batch);
      const stale: string[] = [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          delivered += 1;
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          const target = targets[i + index];
          if (target) stale.push(target.id);
        }
      });
      if (stale.length > 0) {
        await this.prisma.pushRegistration.updateMany({
          where: { id: { in: stale } },
          data: { revokedAt: now },
        });
      }
    }
    return delivered;
  }

  private async send(messages: unknown[]): Promise<ExpoPushTicket[]> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    // Required only when "enhanced push security" is on for the Expo project.
    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Expo push responded ${response.status}`);
    }
    const payload = (await response.json()) as { data?: ExpoPushTicket[] };
    return payload.data ?? [];
  }
}
