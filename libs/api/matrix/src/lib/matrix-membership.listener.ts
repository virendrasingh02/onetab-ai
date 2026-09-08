import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  type ChannelMembershipChangedEvent,
  type ChannelUpdatedEvent,
  type WorkspaceMembershipChangedEvent,
} from '@org/api-common';
import { WorkspaceRole } from '@org/types';
import { MatrixAuthService } from './matrix-auth.service.js';
import { MatrixSpaceService } from './matrix-space.service.js';

/**
 * Turns our own membership domain events into immediate Matrix mirrors.
 *
 * Producers (`ChannelService`, `MemberService`) emit; this listens — the same
 * seam `NotificationsModule` uses. Every call is best-effort: the underlying
 * sync methods already swallow homeserver failures to a warning, and
 * `MatrixReconcilerService` is the convergence backstop, so a handler here
 * never fails the HTTP request that emitted the event.
 */
@Injectable()
export class MatrixMembershipListener {
  private readonly logger = new Logger(MatrixMembershipListener.name);

  constructor(
    private readonly auth: MatrixAuthService,
    private readonly space: MatrixSpaceService,
  ) {}

  @OnEvent(AppEvent.ChannelMembershipChanged)
  async onChannelMembershipChanged(
    event: ChannelMembershipChangedEvent,
  ): Promise<void> {
    try {
      await this.auth.syncChannelMembership(
        event.channelId,
        event.userId,
        event.action,
      );
      // A channel ADMIN gets PL50 in the room; a demotion is left to the
      // reconciler rather than risking a stomp on a deliberately elevated user.
      if (event.action === 'join' && event.role === 'ADMIN') {
        await this.auth.syncChannelPowerLevel(
          event.channelId,
          event.userId,
          50,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Channel membership mirror failed for ${event.userId}: ${String(error)}`,
      );
    }
  }

  @OnEvent(AppEvent.ChannelUpdated)
  async onChannelUpdated(event: ChannelUpdatedEvent): Promise<void> {
    // Only a posting-policy change needs a power-level reconcile.
    if (!event.posting) return;
    try {
      await this.auth.applyChannelPostingPolicy(event.channelId);
    } catch (error) {
      this.logger.warn(
        `Channel posting-policy mirror failed for ${event.channelId}: ${String(
          error,
        )}`,
      );
    }
  }

  @OnEvent(AppEvent.WorkspaceMembershipChanged)
  async onWorkspaceMembershipChanged(
    event: WorkspaceMembershipChangedEvent,
  ): Promise<void> {
    try {
      if (event.action === 'role') {
        if (event.role) {
          await this.space.syncSpacePowerLevel(
            event.workspaceId,
            event.userId,
            event.role as WorkspaceRole,
          );
        }
        return;
      }

      await this.space.syncSpaceMembership(
        event.workspaceId,
        event.userId,
        event.action,
      );
    } catch (error) {
      this.logger.warn(
        `Workspace membership mirror failed for ${event.userId}: ${String(error)}`,
      );
    }
  }
}
