import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

interface PushNotification {
  event_id?: string;
  room_id?: string;
  sender?: string;
  counts?: { unread?: number; missed_calls?: number };
  devices?: { pushkey?: string; app_id?: string }[];
  prio?: string;
}

/**
 * Turns Matrix pushes into our own notifications.
 *
 * The pusher is registered with `format: event_id_only`, so what arrives here
 * is a pointer, not content. That is deliberate: message bodies never transit
 * a push service, which is the only way push and end-to-end encryption can
 * coexist honestly.
 */
@Injectable()
export class NotificationBridgeService {
  private readonly logger = new Logger(NotificationBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Handles one push and returns pushkeys the homeserver should stop using.
   *
   * Returning stale keys is how a push gateway prunes uninstalled devices; not
   * doing it leaves the homeserver retrying dead endpoints forever.
   */
  async handlePush(notification?: Record<string, unknown>): Promise<string[]> {
    if (!notification) return [];

    const push = notification as PushNotification;
    const rejected: string[] = [];

    if (!push.room_id) return rejected;

    const channel = await this.prisma.channel.findFirst({
      where: { matrixRoomId: push.room_id },
      select: { id: true, name: true, workspaceId: true },
    });

    if (!channel) {
      // A push for a room we do not track: nothing to deliver, but the device
      // registration itself is still valid.
      return rejected;
    }

    for (const device of push.devices ?? []) {
      if (!device.pushkey) continue;

      const registration = await this.prisma.pushRegistration.findUnique({
        where: { pushKey: device.pushkey },
        select: { id: true, userId: true, revokedAt: true },
      });

      if (!registration || registration.revokedAt) {
        rejected.push(device.pushkey);
        continue;
      }

      const preference = await this.prisma.notificationPreference.findUnique({
        where: {
          userId_workspaceId: {
            userId: registration.userId,
            workspaceId: channel.workspaceId,
          },
        },
        select: { pushEnabled: true, mutedChannelIds: true },
      });

      const muted =
        preference?.pushEnabled === false ||
        preference?.mutedChannelIds.includes(channel.id);

      if (muted) continue;

      // Delivery itself (Web Push / FCM) lands with the notification service;
      // the routing decision above is the part this bridge owns.
      this.logger.debug(
        `Notification for ${registration.userId} in #${channel.name}`,
      );
    }

    return rejected;
  }
}
