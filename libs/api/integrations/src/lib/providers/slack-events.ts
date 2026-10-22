import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ConnectorInboundEvent } from '../core/provider-adapter.interface.js';

/** Slack rejects a signature older than this; so do we (replay protection). */
const MAX_AGE_SECONDS = 5 * 60;

/**
 * Checks an Events API push the way Slack documents: `v0=` + HMAC-SHA256 of
 * `v0:<timestamp>:<exact body>` under the app's signing secret, with a
 * timestamp no more than five minutes from `nowMs`.
 */
export function verifySlackSignature(
  signingSecret: string | undefined,
  rawBody: string,
  headers: Record<string, string>,
  nowMs: number = Date.now(),
): boolean {
  if (!signingSecret) return false;
  const timestamp = headers['x-slack-request-timestamp'];
  const given = headers['x-slack-signature'];
  if (!timestamp || !given) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(nowMs / 1000 - seconds) > MAX_AGE_SECONDS) return false;
  const expected = `v0=${createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`, 'utf8').digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface SlackPush {
  challenge?: string;
  /** The Slack workspace (`team_id`) the push belongs to. */
  accountId?: string;
  events: ConnectorInboundEvent[];
}

/** Message subtypes that are bookkeeping, not something a person said. */
const IGNORED_SUBTYPES = new Set([
  'message_changed',
  'message_deleted',
  'channel_join',
  'channel_leave',
  'bot_message',
  'message_replied',
]);

/** Turns a verified Events API body into trigger events. */
export function parseSlackPush(payload: unknown): SlackPush {
  if (!payload || typeof payload !== 'object') return { events: [] };
  const body = payload as Record<string, unknown>;
  if (body['type'] === 'url_verification') {
    return { challenge: typeof body['challenge'] === 'string' ? (body['challenge'] as string) : '', events: [] };
  }
  if (body['type'] !== 'event_callback') return { events: [] };

  const accountId = typeof body['team_id'] === 'string' ? (body['team_id'] as string) : undefined;
  const event = body['event'];
  const deliveryId = typeof body['event_id'] === 'string' ? (body['event_id'] as string) : '';
  if (!event || typeof event !== 'object' || !deliveryId) return { accountId, events: [] };
  const e = event as Record<string, unknown>;

  const item = {
    ts: e['ts'],
    text: e['text'],
    user: e['user'],
    channel: e['channel'],
    thread_ts: e['thread_ts'],
    team: accountId,
  };

  if (e['type'] === 'app_mention') {
    return { accountId, events: [{ eventId: deliveryId, triggerId: 'mention', item }] };
  }
  if (e['type'] === 'message') {
    const subtype = typeof e['subtype'] === 'string' ? (e['subtype'] as string) : '';
    // Bots (including this platform's own posts) never start an agent: that is how loops begin.
    if (e['bot_id'] || IGNORED_SUBTYPES.has(subtype)) return { accountId, events: [] };
    return { accountId, events: [{ eventId: deliveryId, triggerId: 'message_posted', item }] };
  }
  return { accountId, events: [] };
}
