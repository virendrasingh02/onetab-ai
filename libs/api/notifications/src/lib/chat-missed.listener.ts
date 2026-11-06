import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type ChatMessageMissedEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { NotificationCenterService } from './notification-center.service.js';

const MAX_BODY_LENGTH = 1000;

/** Matrix prefixes a reply with the quoted message; the reply is what's new. */
function withoutReplyQuote(body: string): string {
  return body.replace(/^(> .*\n)+\n?/, '').trim();
}

export function previewOf(event: ChatMessageMissedEvent): string | null {
  // An encrypted body is unreadable here, and must never be guessed at.
  if (event.isEncrypted) return null;
  switch (event.content['msgtype']) {
    case 'm.image':
      return 'Sent a photo';
    case 'm.video':
      return 'Sent a video';
    case 'm.audio':
      return 'Sent an audio file';
    case 'm.file':
      return 'Sent a file';
    default: {
      const body = event.content['body'];
      if (typeof body !== 'string') return 'Sent a message';
      return withoutReplyQuote(body).slice(0, MAX_BODY_LENGTH) || 'Sent a message';
    }
  }
}

/**
 * Words a message for someone whose clients are all closed. The same titles as
 * the client's, built from what the server can see.
 */
@Injectable()
export class ChatMissedListener {
  private readonly logger = new Logger(ChatMissedListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly center: NotificationCenterService,
  ) {}

  @OnEvent(AppEvent.ChatMessageMissed, { async: true })
  async onMissed(event: ChatMessageMissedEvent): Promise<void> {
    try {
      const [user, agent, channel] = await Promise.all([
        this.prisma.user.findFirst({
          where: { matrixUserId: event.senderMatrixId },
          select: { id: true, name: true, displayName: true },
        }),
        this.prisma.aIAgent.findFirst({
          where: { matrixUserId: event.senderMatrixId },
          select: { name: true },
        }),
        this.prisma.channel.findFirst({
          where: { matrixRoomId: event.roomId },
          select: { name: true },
        }),
      ]);

      const sender = user?.displayName ?? user?.name ?? agent?.name ?? 'Someone';
      const relation = event.content['m.relates_to'] as
        | { rel_type?: string; event_id?: string }
        | undefined;
      const threadRootId =
        relation?.rel_type === 'm.thread' ? relation.event_id : undefined;

      let title = sender;
      if (channel) {
        title = event.isMention
          ? `${sender} mentioned you in #${channel.name}`
          : threadRootId
            ? `${sender} replied in #${channel.name}`
            : `${sender} in #${channel.name}`;
      }

      await this.center.reportChatMessage(event.recipientId, {
        roomId: event.roomId,
        eventId: event.eventId,
        title,
        body: previewOf(event),
        threadRootId,
        senderId: user?.id ?? null,
        isMention: event.isMention,
        isGroup: event.isGroup,
      });
    } catch (error) {
      // One message must not take the poll down with it.
      this.logger.warn(`Missed chat ${event.eventId} failed: ${String(error)}`);
    }
  }
}
