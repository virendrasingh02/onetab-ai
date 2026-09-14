import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  type ChannelAiEntityEnabledChangedEvent,
  type ChannelAiEntityLinkedEvent,
  type ChannelAiEntityUnlinkedEvent,
  type ChannelAppEnabledChangedEvent,
  type ChannelAppLinkedEvent,
  type ChannelAppUnlinkedEvent,
  type ChannelArchiveChangedEvent,
  type ChannelMembershipChangedEvent,
  type ChannelUpdatedEvent,
  type IntegrationConnectedEvent,
  type IntegrationDisconnectedEvent,
} from '@org/api-common';
import type { SystemEventType } from '@org/types';
import { SystemEventPublisherService } from './system-event-publisher.service.js';

/**
 * Turns the platform's own domain events into unified System/Activity Event
 * posts (brief §1, §22).
 *
 * Producers (`ChannelService`, `AgentsService`, `CoworkersService`,
 * `IntegrationsService`) emit; this listens — the same seam
 * `MatrixMembershipListener` and `DomainEventsListener` already use. A
 * handler here only ever fires *after* the producer's write already
 * succeeded (an `AppEvent` is emitted post-commit, never speculatively), so
 * the timeline never shows an action that didn't actually happen (brief §8).
 */
@Injectable()
export class SystemEventsListener {
  private readonly logger = new Logger(SystemEventsListener.name);

  constructor(private readonly publisher: SystemEventPublisherService) {}

  @OnEvent(AppEvent.ChannelMembershipChanged)
  async onChannelMembershipChanged(event: ChannelMembershipChangedEvent): Promise<void> {
    await this.safe(async () => {
      const room = await this.publisher.resolveChannelRoom(event.channelId);
      if (!room) return;

      const isSelf = event.actorId === event.userId;
      const eventType: SystemEventType =
        event.action === 'join'
          ? isSelf
            ? 'member_joined'
            : 'member_added'
          : isSelf
            ? 'member_left'
            : 'member_removed';

      const [actor, target] = await Promise.all([
        this.publisher.resolveUser(event.actorId),
        this.publisher.resolveUser(event.userId),
      ]);

      // Only tell the person it's actually about — never the whole room —
      // and only when someone else acted on their behalf (brief §24).
      const mentionMatrixUserIds =
        !isSelf && event.userId
          ? await this.publisher
              .resolveUserMatrixId(event.userId)
              .then((id) => (id ? [id] : undefined))
          : undefined;

      await this.publisher.publish({
        eventType,
        conversationType: 'channel',
        roomId: room.roomId,
        conversationId: event.channelId,
        conversationName: room.name,
        workspaceId: room.workspaceId,
        actor,
        target,
        idempotencyKey: `channel-member:${event.channelId}:${event.userId}:${event.action}:${event.actorId ?? 'system'}`,
        mentionMatrixUserIds,
      });
    }, `channel membership (${event.channelId}/${event.userId})`);
  }

  @OnEvent(AppEvent.ChannelAiEntityLinked)
  async onChannelAiEntityLinked(event: ChannelAiEntityLinkedEvent): Promise<void> {
    await this.postAiEntityEvent(event, event.entityType === 'agent' ? 'agent_added' : 'coworker_added', 'linked');
  }

  @OnEvent(AppEvent.ChannelAiEntityUnlinked)
  async onChannelAiEntityUnlinked(event: ChannelAiEntityUnlinkedEvent): Promise<void> {
    await this.postAiEntityEvent(
      event,
      event.entityType === 'agent' ? 'agent_removed' : 'coworker_removed',
      'unlinked',
    );
  }

  @OnEvent(AppEvent.ChannelAiEntityEnabledChanged)
  async onChannelAiEntityEnabledChanged(event: ChannelAiEntityEnabledChangedEvent): Promise<void> {
    const eventType: SystemEventType = event.isEnabled
      ? event.entityType === 'agent'
        ? 'agent_enabled'
        : 'coworker_enabled'
      : event.entityType === 'agent'
        ? 'agent_disabled'
        : 'coworker_disabled';
    await this.postAiEntityEvent(event, eventType, event.isEnabled ? 'enabled' : 'disabled');
  }

  private async postAiEntityEvent(
    event: {
      channelId: string;
      workspaceId: string;
      actorId: string | null;
      entityId: string;
      entityType: 'agent' | 'coworker';
    },
    eventType: SystemEventType,
    causeTag: string,
  ): Promise<void> {
    await this.safe(async () => {
      const room = await this.publisher.resolveChannelRoom(event.channelId);
      if (!room) return;

      const [actor, target] = await Promise.all([
        this.publisher.resolveUser(event.actorId),
        this.publisher.resolveAiEntity(event.entityId, event.entityType),
      ]);

      await this.publisher.publish({
        eventType,
        conversationType: 'channel',
        roomId: room.roomId,
        conversationId: event.channelId,
        conversationName: room.name,
        workspaceId: room.workspaceId,
        actor,
        target,
        idempotencyKey: `channel-${event.entityType}:${event.channelId}:${event.entityId}:${causeTag}`,
      });
    }, `channel ${event.entityType} link (${event.channelId}/${event.entityId})`);
  }

  @OnEvent(AppEvent.ChannelAppLinked)
  async onChannelAppLinked(event: ChannelAppLinkedEvent): Promise<void> {
    await this.postAppEvent(event, 'app_added', 'linked');
  }

  @OnEvent(AppEvent.ChannelAppUnlinked)
  async onChannelAppUnlinked(event: ChannelAppUnlinkedEvent): Promise<void> {
    await this.postAppEvent(event, 'app_removed', 'unlinked');
  }

  @OnEvent(AppEvent.ChannelAppEnabledChanged)
  async onChannelAppEnabledChanged(event: ChannelAppEnabledChangedEvent): Promise<void> {
    await this.postAppEvent(
      event,
      event.isEnabled ? 'app_enabled' : 'app_disabled',
      event.isEnabled ? 'enabled' : 'disabled',
    );
  }

  private async postAppEvent(
    event: { channelId: string; workspaceId: string; actorId: string | null; integrationId: string },
    eventType: SystemEventType,
    causeTag: string,
  ): Promise<void> {
    await this.safe(async () => {
      const room = await this.publisher.resolveChannelRoom(event.channelId);
      if (!room) return;

      const [actor, target] = await Promise.all([
        this.publisher.resolveUser(event.actorId),
        this.publisher.resolveApp(event.integrationId),
      ]);

      await this.publisher.publish({
        eventType,
        conversationType: 'channel',
        roomId: room.roomId,
        conversationId: event.channelId,
        conversationName: room.name,
        workspaceId: room.workspaceId,
        actor,
        target,
        idempotencyKey: `channel-app:${event.channelId}:${event.integrationId}:${causeTag}`,
      });
    }, `channel app link (${event.channelId}/${event.integrationId})`);
  }

  @OnEvent(AppEvent.ChannelArchiveChanged)
  async onChannelArchiveChanged(event: ChannelArchiveChangedEvent): Promise<void> {
    await this.safe(async () => {
      const room = await this.publisher.resolveChannelRoom(event.channelId);
      if (!room) return;

      const actor = await this.publisher.resolveUser(event.actorId);

      await this.publisher.publish({
        eventType: event.archived ? 'channel_archived' : 'channel_unarchived',
        conversationType: 'channel',
        roomId: room.roomId,
        conversationId: event.channelId,
        conversationName: room.name,
        workspaceId: room.workspaceId,
        actor,
        target: { kind: 'channel', id: event.channelId, name: room.name },
        idempotencyKey: `channel-archive:${event.channelId}:${event.archived}:${Date.now()}`,
      });
    }, `channel archive (${event.channelId})`);
  }

  @OnEvent(AppEvent.ChannelUpdated)
  async onChannelUpdated(event: ChannelUpdatedEvent): Promise<void> {
    const newName = event.name;
    if (!event.nameChanged || !newName) return; // Only a rename is timeline-worthy here.
    await this.safe(async () => {
      const room = await this.publisher.resolveChannelRoom(event.channelId);
      if (!room) return;

      const actor = await this.publisher.resolveUser(event.actorId);

      await this.publisher.publish({
        eventType: 'channel_renamed',
        conversationType: 'channel',
        roomId: room.roomId,
        conversationId: event.channelId,
        conversationName: room.name,
        workspaceId: room.workspaceId,
        actor,
        target: { kind: 'channel', id: event.channelId, name: newName },
        idempotencyKey: `channel-renamed:${event.channelId}:${newName}`,
      });
    }, `channel renamed (${event.channelId})`);
  }

  @OnEvent(AppEvent.IntegrationConnected)
  async onIntegrationConnected(event: IntegrationConnectedEvent): Promise<void> {
    await this.postIntegrationLifecycleEvent(event, 'app_connected', 'connected');
  }

  @OnEvent(AppEvent.IntegrationDisconnected)
  async onIntegrationDisconnected(event: IntegrationDisconnectedEvent): Promise<void> {
    await this.postIntegrationLifecycleEvent(event, 'app_disconnected', 'disconnected');
  }

  private async postIntegrationLifecycleEvent(
    event: { workspaceId: string | null; actorId: string | null; integrationId: string },
    eventType: SystemEventType,
    causeTag: string,
  ): Promise<void> {
    await this.safe(async () => {
      // Only meaningful once the app has a DM room a human actually opened —
      // otherwise there is no timeline to post into yet (brief §4).
      const room = await this.publisher.resolveAppRoom(event.integrationId);
      if (!room) return;

      const [actor, target] = await Promise.all([
        this.publisher.resolveUser(event.actorId),
        this.publisher.resolveApp(event.integrationId),
      ]);

      await this.publisher.publish({
        eventType,
        conversationType: 'app',
        roomId: room.roomId,
        conversationId: event.integrationId,
        conversationName: target.name,
        workspaceId: room.workspaceId,
        actor,
        target,
        idempotencyKey: `app-lifecycle:${event.integrationId}:${causeTag}`,
      });
    }, `integration lifecycle (${event.integrationId})`);
  }

  /** Every handler's errors are contained here — a failed timeline post must
   * never fail (or retry-loop) the domain operation that triggered it. */
  private async safe(fn: () => Promise<void>, label: string): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.warn(`System event handler failed for ${label}: ${String(error)}`);
    }
  }
}
