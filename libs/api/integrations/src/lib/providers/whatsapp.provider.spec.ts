import axios from 'axios';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toWhatsAppNumber, WhatsAppProvider } from './whatsapp.provider.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
import type { SSRFGuardService } from '../core/ssrf-guard.service.js';

vi.mock('axios', () => ({ default: { request: vi.fn() } }));
const request = axios.request as unknown as ReturnType<typeof vi.fn>;
const reply = (status: number, data: unknown = {}) => ({ status, data, headers: {} });

const credential: ResolvedCredential = {
  id: 'int-2',
  provider: 'WHATSAPP',
  scopeType: 'WORKSPACE',
  accessToken: JSON.stringify({ phoneNumberId: '111', accessToken: 'EAAtoken', businessAccountId: '222', appSecret: 'appsecret', verifyToken: 'verify-me' }),
  metadata: {},
  scopes: [],
};

describe('WhatsAppProvider', () => {
  let provider: WhatsAppProvider;
  beforeEach(() => {
    provider = new WhatsAppProvider({ agents: {} } as unknown as SSRFGuardService);
  });
  afterEach(() => request.mockReset());

  it('normalises phone numbers to digits with a country code', () => {
    expect(toWhatsAppNumber('+91 98765-43210')).toBe('919876543210');
    expect(toWhatsAppNumber('12345')).toBeNull();
    expect(toWhatsAppNumber('not a number')).toBeNull();
  });

  it('gates both sends behind confirmation', () => {
    const actions = provider.getActions();
    for (const id of ['send_template_message', 'send_text_message']) {
      expect(actions.find((a) => a.id === id)).toMatchObject({ permissionLevel: 'write', requiresConfirmation: true });
    }
  });

  it('refuses to message anyone whose opt-in has not been asserted — before any request', async () => {
    await expect(provider.executeAction(credential, 'send_template_message', { to: '+14155550123', templateName: 'order_update' })).rejects.toThrow(/agreed/);
    await expect(provider.executeAction(credential, 'send_text_message', { to: '+14155550123', text: 'Hi', customerOptedIn: 'false' })).rejects.toThrow(/agreed/);
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects an unusable phone number', async () => {
    await expect(provider.executeAction(credential, 'send_text_message', { to: 'abc', text: 'Hi', customerOptedIn: true })).rejects.toThrow(/phone number/);
  });

  it('sends an approved template with its body parameters in order', async () => {
    request.mockResolvedValueOnce(reply(200, { messages: [{ id: 'wamid.1' }] }));
    const result = await provider.executeAction(credential, 'send_template_message', {
      to: '+1 (415) 555-0123',
      templateName: 'order_update',
      bodyParameters: ['#1001', '$10.00'],
      customerOptedIn: 'true',
    });
    expect(result).toMatchObject({ success: true, data: { messageId: 'wamid.1', to: '14155550123' } });
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://graph.facebook.com/v21.0/111/messages');
    expect(call.headers.Authorization).toBe('Bearer EAAtoken');
    expect(call.data.template).toEqual({
      name: 'order_update',
      language: { code: 'en_US' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: '#1001' }, { type: 'text', text: '$10.00' }] }],
    });
  });

  it('explains Meta’s 24-hour-window refusal in plain words', async () => {
    request.mockResolvedValueOnce(reply(400, { error: { code: 131047, message: 'Re-engagement message' } }));
    const result = await provider.executeAction(credential, 'send_text_message', { to: '+14155550123', text: 'Hi', customerOptedIn: true });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/24 hours/);
  });

  it('verifies the Meta signature and answers the subscription handshake only with the right token', () => {
    const body = '{"entry":[]}';
    const sig = `sha256=${createHmac('sha256', 'appsecret').update(body).digest('hex')}`;
    expect(provider.verifyWebhook(credential, body, { 'x-hub-signature-256': sig })).toBe(true);
    expect(provider.verifyWebhook(credential, body, { 'x-hub-signature-256': 'sha256=00' })).toBe(false);
    expect(provider.webhookChallenge(credential, { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '1158201444' })).toBe('1158201444');
    expect(provider.webhookChallenge(credential, { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'x' })).toBeNull();
  });

  it('turns incoming messages for this number into events, ignoring other numbers', () => {
    const payload = {
      entry: [
        {
          changes: [
            { value: { metadata: { phone_number_id: '111' }, contacts: [{ wa_id: '4915', profile: { name: 'Ana' } }], messages: [{ id: 'wamid.A', from: '4915', type: 'text', text: { body: 'Where is my order?' }, timestamp: '1' }] } },
            { value: { metadata: { phone_number_id: '999' }, messages: [{ id: 'wamid.B', from: '1', type: 'text', text: { body: 'x' } }] } },
          ],
        },
      ],
    };
    expect(provider.parseWebhookEvents(credential, payload)).toEqual([
      { eventId: 'wamid.A', triggerId: 'message_received', item: expect.objectContaining({ from: '4915', name: 'Ana', text: 'Where is my order?' }) },
    ]);
  });
});
