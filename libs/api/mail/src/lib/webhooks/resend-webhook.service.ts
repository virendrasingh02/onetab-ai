import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type EmailDeliveryStatus } from '@org/database';
import * as crypto from 'crypto';

export interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    [key: string]: unknown;
  };
}

/** Lifecycle order of a delivery; bounces and complaints are final. */
const STATUS_RANK: Record<EmailDeliveryStatus, number> = {
  QUEUED: 0,
  SENDING: 0,
  FAILED: 0,
  SENT: 1,
  DELIVERED: 2,
  OPENED: 3,
  CLICKED: 4,
  BOUNCED: 5,
  COMPLAINED: 5,
};

@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  /**
   * Verifies Resend webhook signature using Svix HMAC-SHA256 standard.
   */
  verifySignature(
    rawBody: string | Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');
    // In dev / test environments with no secret set, allow with warning
    if (!secret) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.warn('RESEND_WEBHOOK_SECRET is not configured in production.');
        return false;
      }
      return true;
    }

    const svixId = (headers['svix-id'] as string) || '';
    const svixTimestamp = (headers['svix-timestamp'] as string) || '';
    const svixSignature = (headers['svix-signature'] as string) || '';

    if (!svixId || !svixTimestamp || !svixSignature) {
      return false;
    }

    // Verify timestamp to prevent replay attacks (allow 5-minute clock drift)
    const timestampMs = parseInt(svixTimestamp, 10) * 1000;
    const now = Date.now();
    if (isNaN(timestampMs) || Math.abs(now - timestampMs) > 5 * 60 * 1000) {
      return false;
    }

    try {
      const payloadString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const signaturePayload = `${svixId}.${svixTimestamp}.${payloadString}`;

      // Secret may start with "whsec_"
      const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;
      const keyBuffer = Buffer.from(secretKey, 'base64');

      const expectedHmac = crypto
        .createHmac('sha256', keyBuffer.length > 0 ? keyBuffer : secretKey)
        .update(signaturePayload)
        .digest('base64');

      // The signature header can be space-separated versions e.g. "v1,g0hM... v1,xxx"
      const signatures = svixSignature.split(' ');
      for (const sig of signatures) {
        const [version, signature] = sig.split(',');
        if (version === 'v1' && signature) {
          const expectedBuffer = Buffer.from(expectedHmac);
          const sigBuffer = Buffer.from(signature);
          if (
            expectedBuffer.length === sigBuffer.length &&
            crypto.timingSafeEqual(expectedBuffer, sigBuffer)
          ) {
            return true;
          }
        }
      }
    } catch (err) {
      this.logger.error('Error verifying Resend webhook signature', err);
      return false;
    }

    return false;
  }

  /**
   * Processes a verified Resend webhook event and updates internal delivery records.
   */
  async handleEvent(payload: ResendWebhookPayload): Promise<void> {
    const eventType = payload.type;
    const emailId = payload.data?.email_id || payload.data?.id;

    if (!emailId) {
      this.logger.warn(`Resend webhook received with no email_id: ${eventType}`);
      return;
    }

    const eventStatusMap: Record<string, { status: EmailDeliveryStatus; timestampField?: string }> = {
      'email.sent': { status: 'SENT' as EmailDeliveryStatus, timestampField: 'sentAt' },
      'email.delivered': { status: 'DELIVERED' as EmailDeliveryStatus, timestampField: 'deliveredAt' },
      'email.bounced': { status: 'BOUNCED' as EmailDeliveryStatus, timestampField: 'bouncedAt' },
      'email.complained': { status: 'COMPLAINED' as EmailDeliveryStatus, timestampField: 'complainedAt' },
      'email.opened': { status: 'OPENED' as EmailDeliveryStatus, timestampField: 'openedAt' },
      'email.clicked': { status: 'CLICKED' as EmailDeliveryStatus, timestampField: 'clickedAt' },
    };

    const mapping = eventStatusMap[eventType];
    if (!mapping) {
      this.logger.log(`Ignoring unhandled Resend webhook event: ${eventType}`);
      return;
    }

    this.logger.log({
      event: 'resend.webhook_received',
      type: eventType,
      providerMessageId: emailId,
      status: mapping.status,
    });

    if (!this.prisma) {
      return;
    }

    try {
      if (mapping.timestampField) {
        await this.prisma.emailDelivery.updateMany({
          where: { providerMessageId: emailId },
          data: { [mapping.timestampField]: new Date() },
        });
      }
      // Events can arrive out of order; only ever move the status forward so a
      // late `delivered` cannot overwrite `opened`, nor anything undo a bounce.
      const rank = STATUS_RANK[mapping.status];
      await this.prisma.emailDelivery.updateMany({
        where: {
          providerMessageId: emailId,
          status: { in: (Object.keys(STATUS_RANK) as EmailDeliveryStatus[]).filter((st) => STATUS_RANK[st] < rank) },
        },
        data: { status: mapping.status },
      });
    } catch (err) {
      this.logger.error(`Failed to update email delivery from webhook for id ${emailId}`, err);
    }
  }
}
