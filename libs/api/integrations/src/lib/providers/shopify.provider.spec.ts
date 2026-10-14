import axios from 'axios';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeShopDomain, ShopifyProvider } from './shopify.provider.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
import type { SSRFGuardService } from '../core/ssrf-guard.service.js';

vi.mock('axios', () => ({ default: { request: vi.fn() } }));
const request = axios.request as unknown as ReturnType<typeof vi.fn>;
const reply = (status: number, data: unknown = {}) => ({ status, data, headers: {} });

const credential = (extra: Record<string, string> = {}): ResolvedCredential => ({
  id: 'int-1',
  provider: 'SHOPIFY',
  scopeType: 'WORKSPACE',
  accessToken: JSON.stringify({ shopDomain: 'https://My-Store.myshopify.com/admin', accessToken: 'shpat_secret', apiSecret: 'whsec', ...extra }),
  metadata: {},
  scopes: [],
});

describe('ShopifyProvider', () => {
  let provider: ShopifyProvider;
  beforeEach(() => {
    provider = new ShopifyProvider({ agents: { httpAgent: undefined, httpsAgent: undefined } } as unknown as SSRFGuardService);
  });
  afterEach(() => request.mockReset());

  it('only accepts Shopify’s own hosts, whatever form the address is typed in', () => {
    expect(normalizeShopDomain('https://My-Store.myshopify.com/admin')).toBe('my-store.myshopify.com');
    expect(() => normalizeShopDomain('evil.example.com')).toThrow(/myshopify\.com/);
    expect(() => normalizeShopDomain('169.254.169.254')).toThrow();
    expect(() => normalizeShopDomain('a.myshopify.com.evil.com')).toThrow();
  });

  it('declares credential fields, secrets and the destructive actions that need confirmation', () => {
    const caps = provider.getCapabilities();
    expect(caps.credentialFields?.map((f) => f.key)).toEqual(['shopDomain', 'accessToken', 'apiSecret']);
    expect(provider.secretFields()).toEqual(['accessToken', 'apiSecret']);
    const actions = provider.getActions();
    for (const id of ['cancel_order', 'refund_order']) {
      const a = actions.find((x) => x.id === id);
      expect(a?.permissionLevel).toBe('destructive');
      expect(a?.requiresConfirmation).toBe(true);
    }
    expect(actions.filter((a) => a.permissionLevel === 'read').length).toBeGreaterThanOrEqual(4);
  });

  it('sends the token as a header to the shop’s Admin API and returns compact orders', async () => {
    request.mockResolvedValueOnce(
      reply(200, {
        orders: [{ id: 1, name: '#1001', total_price: '10.00', currency: 'USD', email: 'a@b.c', customer: { id: 5, first_name: 'Ana', phone: '+14155550123', sms_marketing_consent: { state: 'subscribed' } }, line_items: [{ title: 'Tee', quantity: 2, price: '5.00' }] }],
      }),
    );
    const result = await provider.executeAction(credential(), 'list_orders', { limit: 5 });
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://my-store.myshopify.com/admin/api/2025-01/orders.json');
    expect(call.headers['X-Shopify-Access-Token']).toBe('shpat_secret');
    expect(result.success).toBe(true);
    const orders = (result.data as { orders: any[] }).orders;
    expect(orders[0]).toMatchObject({ id: 1, name: '#1001', customer: { smsConsent: 'subscribed', phone: '+14155550123' } });
  });

  it('refuses to refund more than what is left and reports a missing payment', async () => {
    request.mockResolvedValueOnce(
      reply(200, { transactions: [{ id: 9, kind: 'sale', status: 'success', amount: '100.00', currency: 'USD', gateway: 'bogus' }, { id: 10, kind: 'refund', status: 'success', amount: '30.00' }] }),
    );
    const tooMuch = await provider.executeAction(credential(), 'refund_order', { orderId: '1', amount: 80 });
    expect(tooMuch).toMatchObject({ success: false });
    expect(tooMuch.message).toMatch(/70/);
    expect(request).toHaveBeenCalledTimes(1); // no refund was posted

    request.mockResolvedValueOnce(reply(200, { transactions: [] }));
    expect(await provider.executeAction(credential(), 'refund_order', { orderId: '2' })).toMatchObject({ success: false });
  });

  it('refunds the remaining balance against the original payment when no amount is given', async () => {
    request
      .mockResolvedValueOnce(reply(200, { transactions: [{ id: 9, kind: 'sale', status: 'success', amount: '100.00', currency: 'USD', gateway: 'bogus' }] }))
      .mockResolvedValueOnce(reply(201, { refund: { id: 77 } }));
    const result = await provider.executeAction(credential(), 'refund_order', { orderId: '1', reason: 'damaged' });
    expect(result).toMatchObject({ success: true, data: { refundId: 77, amount: 100 } });
    const body = request.mock.calls[1][0].data.refund;
    expect(body.transactions[0]).toMatchObject({ parent_id: 9, amount: '100', kind: 'refund', gateway: 'bogus' });
    expect(body.notify).toBe(false);
  });

  it('turns an API refusal into a failed result rather than throwing', async () => {
    request.mockResolvedValueOnce(reply(403, { errors: 'Access denied' }));
    const result = await provider.executeAction(credential(), 'list_products', {});
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/permission/);
  });

  it('verifies webhook signatures over the exact body and rejects forgeries', () => {
    const body = JSON.stringify({ id: 1 });
    const sig = createHmac('sha256', 'whsec').update(body).digest('base64');
    expect(provider.verifyWebhook(credential(), body, { 'x-shopify-hmac-sha256': sig })).toBe(true);
    expect(provider.verifyWebhook(credential(), `${body} `, { 'x-shopify-hmac-sha256': sig })).toBe(false);
    expect(provider.verifyWebhook(credential(), body, {})).toBe(false);
    expect(provider.verifyWebhook(credential({ apiSecret: '' }), body, { 'x-shopify-hmac-sha256': sig })).toBe(false);
  });

  it('maps the Shopify topic to a trigger and uses the webhook id for de-duplication', () => {
    const events = provider.parseWebhookEvents(credential(), { id: 5, name: '#1005', total_price: '9.00' }, { 'x-shopify-topic': 'orders/paid', 'x-shopify-webhook-id': 'wh-1' });
    expect(events).toEqual([expect.objectContaining({ eventId: 'wh-1', triggerId: 'order_paid' })]);
    expect(provider.parseWebhookEvents(credential(), {}, { 'x-shopify-topic': 'products/update' })).toEqual([]);
  });
});
