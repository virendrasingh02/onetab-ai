import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

/**
 * The secret a connection's inbound webhooks are signed with (GitHub's
 * "Secret" field). Derived — not stored — from the server key and the
 * connection id, so every connection has its own, nothing extra is persisted
 * and it can be shown again to the person who set the webhook up.
 */
export function deriveWebhookSecret(config: Pick<ConfigService, 'get'>, integrationId: string): string {
  const root = config.get<string>('ENCRYPTION_KEY') || config.get<string>('JWT_ACCESS_SECRET');
  if (!root) throw new Error('ENCRYPTION_KEY or JWT_ACCESS_SECRET must be configured.');
  return createHmac('sha256', root).update(`webhook:${integrationId}`).digest('hex');
}
