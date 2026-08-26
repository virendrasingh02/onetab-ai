import { Injectable, Logger } from '@nestjs/common';
import type { MatrixTimelineEvent } from './matrix-sync.service.js';

/** Returns `true` once a handler has claimed the event — no further handler runs. */
export type MatrixInboundHandler = (
  event: MatrixTimelineEvent,
) => Promise<boolean>;

/**
 * Routes inbound room messages to whichever feature module owns the room,
 * without `MatrixModule` importing back into `AgentsModule`/`IntegrationsModule`.
 *
 * `MatrixModule` cannot depend on the feature modules that need its bot
 * identities and messaging — that would be circular, since those modules
 * already import `MatrixModule` for `MatrixBotMessagingService`. So instead
 * of `MatrixSyncService` calling `AgentsService` directly, each feature module
 * registers a handler here on startup (`AgentMatrixBridgeService`,
 * `AppMatrixBridgeService`, both `OnModuleInit`), and `MatrixSyncService`
 * dispatches through this registry — the dependency points one way.
 */
@Injectable()
export class MatrixInboundRouterService {
  private readonly logger = new Logger(MatrixInboundRouterService.name);
  private readonly handlers: MatrixInboundHandler[] = [];

  /** Registers a handler. Order is registration order — first claim wins. */
  register(handler: MatrixInboundHandler): void {
    this.handlers.push(handler);
  }

  /** Offers the event to each handler in turn until one claims it. */
  async dispatch(event: MatrixTimelineEvent): Promise<boolean> {
    for (const handler of this.handlers) {
      try {
        if (await handler(event)) return true;
      } catch (error) {
        // One handler's failure must not stop the others from getting a
        // chance, and must not fail the transaction the event arrived in.
        this.logger.error(
          `Inbound handler failed for ${event.event_id}: ${String(error)}`,
        );
      }
    }
    return false;
  }
}
