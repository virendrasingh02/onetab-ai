import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseSlackPush, verifySlackSignature } from './slack-events.js';

const SECRET = 'shh';
const NOW = 1_700_000_000_000;
const sign = (body: string, ts: string, secret = SECRET) =>
  `v0=${createHmac('sha256', secret).update(`v0:${ts}:${body}`, 'utf8').digest('hex')}`;

describe('verifySlackSignature', () => {
  const body = '{"type":"event_callback"}';
  const ts = String(NOW / 1000);
  const headers = (over: Record<string, string> = {}) => ({
    'x-slack-request-timestamp': ts,
    'x-slack-signature': sign(body, ts),
    ...over,
  });

  it('accepts a correctly signed, fresh push', () => {
    expect(verifySlackSignature(SECRET, body, headers(), NOW)).toBe(true);
  });

  it('rejects a wrong secret, a tampered body and missing headers', () => {
    expect(verifySlackSignature('other', body, headers(), NOW)).toBe(false);
    expect(verifySlackSignature(SECRET, body + ' ', headers(), NOW)).toBe(false);
    expect(verifySlackSignature(SECRET, body, {}, NOW)).toBe(false);
  });

  it('rejects when no signing secret is configured', () => {
    expect(verifySlackSignature(undefined, body, headers(), NOW)).toBe(false);
  });

  it('rejects a replay older than five minutes', () => {
    const old = String(NOW / 1000 - 6 * 60);
    expect(verifySlackSignature(SECRET, body, headers({ 'x-slack-request-timestamp': old, 'x-slack-signature': sign(body, old) }), NOW)).toBe(false);
  });
});

describe('parseSlackPush', () => {
  const push = (event: Record<string, unknown>) => ({ type: 'event_callback', team_id: 'T1', event_id: 'Ev1', event });

  it('echoes the url_verification challenge', () => {
    expect(parseSlackPush({ type: 'url_verification', challenge: 'abc' })).toEqual({ challenge: 'abc', events: [] });
  });

  it('turns a person’s message into message_posted for that Slack workspace', () => {
    const parsed = parseSlackPush(push({ type: 'message', ts: '1.2', text: 'hi', user: 'U1', channel: 'C1' }));
    expect(parsed.accountId).toBe('T1');
    expect(parsed.events).toEqual([
      { eventId: 'Ev1', triggerId: 'message_posted', item: expect.objectContaining({ text: 'hi', channel: 'C1', team: 'T1' }) },
    ]);
  });

  it('turns an @mention into mention', () => {
    const parsed = parseSlackPush(push({ type: 'app_mention', ts: '1.2', text: '<@B> help', user: 'U1', channel: 'C1' }));
    expect(parsed.events.map((e) => e.triggerId)).toEqual(['mention']);
  });

  it('never starts an agent from a bot, an edit or a delete', () => {
    expect(parseSlackPush(push({ type: 'message', bot_id: 'B1', text: 'x' })).events).toEqual([]);
    expect(parseSlackPush(push({ type: 'message', subtype: 'message_changed' })).events).toEqual([]);
    expect(parseSlackPush(push({ type: 'message', subtype: 'message_deleted' })).events).toEqual([]);
  });

  it('ignores event types it does not map, and junk', () => {
    expect(parseSlackPush(push({ type: 'reaction_added' })).events).toEqual([]);
    expect(parseSlackPush(null).events).toEqual([]);
    expect(parseSlackPush({ type: 'app_rate_limited' }).events).toEqual([]);
  });
});
