import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type AgentChangedEvent } from '@org/api-common';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixAuthService } from './matrix-auth.service.js';

/**
 * Keeps an AI agent's / coworker's Matrix bot account in step with its row.
 *
 * DMs with an AI entity are ordinary Matrix rooms, so the entity needs a real
 * Matrix identity whose name and photo match what the sidebar shows. Without
 * this the account was only created lazily on the first DM open and never
 * updated — a renamed coworker kept its old name in chat, and a deleted one
 * left a live bot behind.
 *
 * Best-effort by contract: the producer's write has already succeeded, so a
 * homeserver hiccup is logged, never thrown.
 */
@Injectable()
export class AiEntityMatrixListener {
  private readonly logger = new Logger(AiEntityMatrixListener.name);

  constructor(
    private readonly auth: MatrixAuthService,
    private readonly admin: MatrixAdminService,
  ) {}

  @OnEvent(AppEvent.AgentChanged)
  async onAgentChanged(event: AgentChangedEvent): Promise<void> {
    if (event.kind !== 'entity' || !this.admin.isEnabled) return;

    try {
      switch (event.action) {
        case 'created':
        case 'updated':
        case 'published':
          await this.auth.syncAiEntityIdentity(event.agentId);
          break;
        case 'deleted':
          if (event.matrixUserId) await this.admin.deactivateUser(event.matrixUserId);
          break;
        default:
          break;
      }
    } catch (error) {
      this.logger.warn(
        `Matrix sync for AI entity ${event.agentId} (${event.action}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
