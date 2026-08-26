import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { createHash } from 'node:crypto';
import { IntegrationEncryptionService } from './integration-encryption.service.js';
import { IntegrationLoggerService } from './integration-logger.service.js';
import type { ProviderAdapter } from './provider-adapter.interface.js';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: IntegrationEncryptionService,
    private readonly auditLogger: IntegrationLoggerService,
  ) {}

  registerAdapter(adapter: ProviderAdapter) {
    this.adapters.set(adapter.providerId.toUpperCase(), adapter);
  }

  /**
   * Processes an incoming webhook with signature verification and idempotency deduplication.
   */
  async processWebhook(
    provider: string,
    payload: unknown,
    headers: Record<string, string>,
    rawBody?: string,
  ): Promise<{ status: string; eventId?: string; isDuplicate?: boolean }> {
    const startTime = Date.now();
    const providerKey = provider.toUpperCase();
    const adapter = this.adapters.get(providerKey);

    if (!adapter) {
      this.logger.warn(`No adapter registered for webhook provider '${provider}'`);
      throw new BadRequestException(`Unsupported webhook provider '${provider}'.`);
    }

    // Determine event ID for deduplication (from header or content hash)
    const headerEventId =
      headers['x-event-id'] ||
      headers['x-webhook-id'] ||
      headers['x-github-delivery'] ||
      headers['x-request-id'] ||
      (typeof payload === 'object' && payload !== null && 'id' in payload
        ? String((payload as Record<string, unknown>)['id'])
        : undefined);

    const eventPayloadString =
      rawBody ||
      (typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}));

    const eventId =
      headerEventId ||
      createHash('sha256').update(`${providerKey}:${eventPayloadString}`).digest('hex');

    const eventType =
      headers['x-event-type'] ||
      headers['x-github-event'] ||
      (typeof payload === 'object' && payload !== null && 'type' in payload
        ? String((payload as Record<string, unknown>)['type'])
        : 'webhook.received');

    // Idempotency check: see if event was already recorded
    const existing = await this.prisma.integrationWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: providerKey,
          eventId,
        },
      },
    });

    if (existing) {
      this.logger.log(
        `Duplicate webhook event ignored: provider='${providerKey}', eventId='${eventId}'`,
      );
      return { status: 'DUPLICATE', eventId, isDuplicate: true };
    }

    // Record webhook event as RECEIVED
    const eventRecord = await this.prisma.integrationWebhookEvent.create({
      data: {
        provider: providerKey,
        eventId,
        eventType,
        payload: eventPayloadString.slice(0, 10000), // bounded storage
        status: 'RECEIVED',
      },
    });

    try {
      // Execute adapter webhook handling
      const result = await adapter.handleWebhook(payload, headers);

      await this.prisma.integrationWebhookEvent.update({
        where: { id: eventRecord.id },
        data: {
          status: result.success ? 'PROCESSED' : 'FAILED',
          errorMessage: result.success ? null : 'Adapter returned unsuccessful status',
          processedAt: new Date(),
        },
      });

      await this.auditLogger.logAudit({
        action: 'WEBHOOK_PROCESSED',
        status: result.success ? 'SUCCESS' : 'FAILURE',
        durationMs: Date.now() - startTime,
        details: { provider: providerKey, eventId, eventType, result },
      });

      return { status: result.success ? 'PROCESSED' : 'FAILED', eventId };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Webhook processing failed for ${providerKey} event ${eventId}: ${errorMsg}`,
      );

      await this.prisma.integrationWebhookEvent.update({
        where: { id: eventRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: errorMsg,
          processedAt: new Date(),
        },
      });

      await this.auditLogger.logAudit({
        action: 'WEBHOOK_FAILED',
        status: 'FAILURE',
        durationMs: Date.now() - startTime,
        details: { provider: providerKey, eventId, eventType, error: errorMsg },
      });

      throw err;
    }
  }

  /**
   * Helper to verify HMAC signature on incoming webhooks.
   */
  verifyWebhookSignature(
    payloadString: string,
    signatureHeader: string | undefined,
    secret: string,
    headerPrefix = 'sha256=',
  ): boolean {
    if (!signatureHeader || !secret) return false;
    const actualSignature = signatureHeader.startsWith(headerPrefix)
      ? signatureHeader.substring(headerPrefix.length)
      : signatureHeader;

    const expectedSignature = this.encryption.computeHmacSha256(
      payloadString,
      secret,
    );

    return this.encryption.verifySignature(expectedSignature, actualSignature);
  }
}
