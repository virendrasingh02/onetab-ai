import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, type ConnectorEventReceivedEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { IntegrationLoggerService } from '../core/integration-logger.service.js';
import { IntegrationManagerService } from '../core/integration-manager.service.js';

/**
 * Receives events a connected app pushes (a Shopify order paid, a WhatsApp
 * message) at `/webhooks/connectors/:integrationId`.
 *
 * The endpoint is public, so it trusts nothing it is told: it only answers for
 * a connection that exists and is connected, only for connectors that can
 * verify a push (signature checked against the secret stored — encrypted — with
 * that connection, over the exact bytes received), and records every delivery
 * once so a redelivery never starts an agent twice.
 */
@Injectable()
export class ConnectorWebhookService {
  private readonly logger = new Logger(ConnectorWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: IntegrationManagerService,
    private readonly audit: IntegrationLoggerService,
    private readonly events: EventEmitter2,
  ) {}

  async receive(
    integrationId: string,
    rawBody: string | undefined,
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<{ received: number; duplicates: number }> {
    const { integration, adapter, credential } = await this.open(integrationId);
    if (!adapter.verifyWebhook || !adapter.parseWebhookEvents) throw new NotFoundException();
    if (!rawBody || !adapter.verifyWebhook(credential, rawBody, normalizeHeaders(headers))) {
      this.logger.warn(`Rejected an unverified ${integration.provider} webhook for connection ${integrationId}.`);
      throw new UnauthorizedException('The signature could not be verified.');
    }

    const parsed = adapter.parseWebhookEvents(credential, payload, normalizeHeaders(headers));
    let received = 0;
    let duplicates = 0;
    for (const event of parsed) {
      const first = await this.recordOnce(integration.provider, integrationId, event.eventId, event.triggerId, event.item);
      if (!first) {
        duplicates += 1;
        continue;
      }
      received += 1;
      const emitted: ConnectorEventReceivedEvent = {
        workspaceId: integration.workspaceId,
        integrationId,
        provider: integration.provider,
        triggerId: event.triggerId,
        eventId: event.eventId,
        item: event.item,
        ownerUserId: integration.scopeType === 'USER' ? integration.userId : null,
      };
      this.events.emit(AppEvent.ConnectorEventReceived, emitted);
    }

    await this.audit.logAudit({
      integrationId,
      workspaceId: integration.workspaceId ?? undefined,
      action: 'WEBHOOK_PROCESSED',
      status: 'SUCCESS',
      durationMs: 0,
      details: { provider: integration.provider, received, duplicates },
    });
    return { received, duplicates };
  }

  /** The app's subscription handshake (WhatsApp's `hub.challenge`). */
  async challenge(integrationId: string, query: Record<string, string>): Promise<string> {
    const { adapter, credential } = await this.open(integrationId);
    const answer = adapter.webhookChallenge?.(credential, query) ?? null;
    if (answer === null) throw new ForbiddenException('The verification token does not match.');
    return answer;
  }

  private async open(integrationId: string) {
    const integration = await this.prisma.externalIntegration.findUnique({ where: { id: integrationId } });
    // The same answer for "no such connection" and "not usable", so ids can't be probed.
    if (!integration || integration.status !== 'CONNECTED') throw new NotFoundException();
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);
    return { integration, adapter, credential };
  }

  /** Records a delivery; false when this connection already received it. */
  private async recordOnce(
    provider: string,
    integrationId: string,
    eventId: string,
    eventType: string,
    item: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.prisma.integrationWebhookEvent.create({
        data: {
          provider,
          eventId: `${integrationId}:${eventId}`,
          eventType,
          payload: JSON.stringify(item).slice(0, 10_000),
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Header names arrive lower-cased from Node; this keeps adapters independent of that. */
function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(',') : String(v)]));
}
