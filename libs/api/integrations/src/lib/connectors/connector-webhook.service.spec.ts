import { describe, expect, it, vi } from 'vitest';
import { AppEvent } from '@org/api-common';
import { ConnectorWebhookService } from './connector-webhook.service.js';

function setup(overrides: { verify?: boolean; status?: string; events?: any[]; duplicate?: boolean } = {}) {
  const adapter = {
    verifyWebhook: vi.fn(() => overrides.verify ?? true),
    parseWebhookEvents: vi.fn(() => overrides.events ?? [{ eventId: 'e1', triggerId: 'order_paid', item: { id: 1 } }]),
    webhookChallenge: vi.fn((_c: unknown, q: Record<string, string>) => (q['hub.verify_token'] === 'ok' ? q['hub.challenge'] : null)),
  };
  const prisma = {
    externalIntegration: {
      findUnique: vi.fn(async () => ({ id: 'int-1', provider: 'SHOPIFY', workspaceId: 'ws-1', scopeType: 'WORKSPACE', userId: null, status: overrides.status ?? 'CONNECTED' })),
    },
    integrationWebhookEvent: { create: vi.fn(async () => { if (overrides.duplicate) throw new Error('unique'); }) },
  };
  const manager = { resolveCredential: vi.fn(async () => ({ adapter, credential: { id: 'int-1', accessToken: '{}' } })) };
  const audit = { logAudit: vi.fn(async () => undefined) };
  const events = { emit: vi.fn() };
  const service = new ConnectorWebhookService(prisma as any, manager as any, audit as any, events as any);
  return { service, adapter, prisma, events };
}

describe('ConnectorWebhookService', () => {
  it('verifies, records once and emits a trigger event for each delivery', async () => {
    const { service, events, prisma } = setup();
    const result = await service.receive('int-1', '{"id":1}', { id: 1 }, { 'X-Shopify-Topic': 'orders/paid' });
    expect(result).toEqual({ received: 1, duplicates: 0 });
    expect(prisma.integrationWebhookEvent.create.mock.calls[0][0].data.eventId).toBe('int-1:e1');
    expect(events.emit).toHaveBeenCalledWith(
      AppEvent.ConnectorEventReceived,
      expect.objectContaining({ workspaceId: 'ws-1', provider: 'SHOPIFY', triggerId: 'order_paid', eventId: 'e1', ownerUserId: null }),
    );
  });

  it('rejects an unverified push without recording or emitting anything', async () => {
    const { service, events, prisma } = setup({ verify: false });
    await expect(service.receive('int-1', '{}', {}, {})).rejects.toThrow(/signature/);
    expect(prisma.integrationWebhookEvent.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('rejects a push with no raw body to verify', async () => {
    const { service } = setup();
    await expect(service.receive('int-1', undefined, {}, {})).rejects.toThrow(/signature/);
  });

  it('never starts an agent twice for a redelivered event', async () => {
    const { service, events } = setup({ duplicate: true });
    expect(await service.receive('int-1', '{}', {}, {})).toEqual({ received: 0, duplicates: 1 });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('answers the same way for a missing or disconnected connection', async () => {
    const { service } = setup({ status: 'REVOKED' });
    await expect(service.receive('int-1', '{}', {}, {})).rejects.toThrow();
    await expect(service.challenge('int-1', {})).rejects.toThrow();
  });

  it('echoes a subscription challenge only for the right token', async () => {
    const { service } = setup();
    await expect(service.challenge('int-1', { 'hub.verify_token': 'ok', 'hub.challenge': '42' })).resolves.toBe('42');
    await expect(service.challenge('int-1', { 'hub.verify_token': 'nope', 'hub.challenge': '42' })).rejects.toThrow(/token/);
  });
});
