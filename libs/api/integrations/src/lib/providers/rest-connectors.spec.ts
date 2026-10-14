import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AirtableProvider } from './airtable.provider.js';
import { AsanaProvider } from './asana.provider.js';
import { ClickUpProvider } from './clickup.provider.js';
import { HubSpotProvider } from './hubspot.provider.js';
import { IntercomProvider } from './intercom.provider.js';
import { jiraSite, JiraProvider, toAdf } from './jira.provider.js';
import { RazorpayProvider } from './razorpay.provider.js';
import { assertSelectOnly, salesforceOrigin, SalesforceProvider } from './salesforce.provider.js';
import { StripeProvider } from './stripe.provider.js';
import { TelegramProvider } from './telegram.provider.js';
import { wooOrigin, WooCommerceProvider } from './woocommerce.provider.js';
import { zendeskSubdomain, ZendeskProvider } from './zendesk.provider.js';
import { formEncode } from '../core/rest-connector.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
import type { SSRFGuardService } from '../core/ssrf-guard.service.js';

vi.mock('axios', () => ({ default: { request: vi.fn() } }));
const request = axios.request as unknown as ReturnType<typeof vi.fn>;
const reply = (status: number, data: unknown = {}) => ({ status, data, headers: {} });
const ssrf = { agents: {} } as unknown as SSRFGuardService;
const cred = (provider: string, bundle: Record<string, string>): ResolvedCredential => ({
  id: 'int-1',
  provider,
  scopeType: 'WORKSPACE',
  accessToken: JSON.stringify(bundle),
  metadata: {},
  scopes: [],
});

afterEach(() => request.mockReset());

describe('REST connectors', () => {
  const all = [
    new HubSpotProvider(ssrf),
    new JiraProvider(ssrf),
    new ClickUpProvider(ssrf),
    new AsanaProvider(ssrf),
    new ZendeskProvider(ssrf),
    new IntercomProvider(ssrf),
    new AirtableProvider(ssrf),
    new StripeProvider(ssrf),
    new RazorpayProvider(ssrf),
    new WooCommerceProvider(ssrf),
    new TelegramProvider(ssrf),
    new SalesforceProvider(ssrf),
  ];

  it.each(all.map((p) => [p.providerId, p] as const))(
    '%s: writes ask for approval, secrets are listed, triggers poll a real read action',
    (_id, p) => {
      const actions = p.getActions();
      expect(actions.length).toBeGreaterThan(2);
      for (const a of actions) expect(a.requiresConfirmation).toBe(a.permissionLevel !== 'read');
      const keys = p.getCapabilities().credentialFields!.map((f) => f.key);
      for (const s of p.secretFields()) expect(keys).toContain(s);
      for (const t of p.getTriggers()) {
        expect(actions.find((a) => a.id === t.pollActionId)?.permissionLevel).toBe('read');
      }
    },
  );

  it('never exposes the action runner in definitions', () => {
    for (const a of all[0].getActions()) expect(Object.keys(a)).not.toContain('run');
  });

  it('Stripe sends form-encoded bodies with a bearer key', async () => {
    request.mockResolvedValueOnce(reply(200, { id: 'cus_1', email: 'a@b.co' }));
    await new StripeProvider(ssrf).executeAction(cred('STRIPE', { apiKey: 'rk_test_abc' }), 'create_customer', {
      email: 'a@b.co',
      name: 'A B',
    });
    const call = request.mock.calls[0][0];
    expect(call.headers.Authorization).toBe('Bearer rk_test_abc');
    expect(call.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(call.data).toBe('email=a%40b.co&name=A%20B');
  });

  it('formEncode nests objects and arrays the way Stripe expects', () => {
    expect(formEncode({ metadata: { k: 'v' }, items: [{ price: 'p1' }] })).toBe(
      'metadata%5Bk%5D=v&items%5B0%5D%5Bprice%5D=p1',
    );
  });

  it('Salesforce allows only one SELECT and only Salesforce hosts', () => {
    expect(assertSelectOnly('SELECT Id FROM Lead;')).toBe('SELECT Id FROM Lead');
    expect(() => assertSelectOnly('DELETE FROM Lead')).toThrow();
    expect(() => assertSelectOnly('SELECT Id FROM Lead; SELECT Id FROM Account')).toThrow();
    expect(salesforceOrigin('acme.my.salesforce.com')).toBe('https://acme.my.salesforce.com');
    expect(() => salesforceOrigin('https://evil.example.com')).toThrow();
    expect(() => salesforceOrigin('https://salesforce.com.evil.io')).toThrow();
  });

  it('Salesforce fetches a client-credentials token, then queries with it', async () => {
    request
      .mockResolvedValueOnce(reply(200, { access_token: 'tok' }))
      .mockResolvedValueOnce(
        reply(200, { totalSize: 1, done: true, records: [{ attributes: { type: 'Lead' }, Id: '00Q000000000001AAA' }] }),
      );
    const out = await new SalesforceProvider(ssrf).executeAction(
      cred('SALESFORCE', { instanceUrl: 'https://acme.my.salesforce.com', clientId: 'cid-unique-1', clientSecret: 's' }),
      'query',
      { soql: 'SELECT Id FROM Lead' },
    );
    expect(request.mock.calls[0][0].url).toBe('https://acme.my.salesforce.com/services/oauth2/token');
    expect(request.mock.calls[1][0].headers.Authorization).toBe('Bearer tok');
    expect(out.success).toBe(true);
    expect((out.data as any).records[0]).toEqual({ type: 'Lead', Id: '00Q000000000001AAA' });
  });

  it('refuses hosts that could redirect credentials', () => {
    expect(jiraSite('Acme.atlassian.net')).toBe('acme');
    expect(() => jiraSite('evil.com/x')).toThrow();
    expect(zendeskSubdomain('acme.zendesk.com')).toBe('acme');
    expect(() => zendeskSubdomain('a.b.c')).toThrow();
    expect(() => wooOrigin('http://shop.example.com')).toThrow();
    expect(wooOrigin('shop.example.com/x')).toBe('https://shop.example.com');
  });

  it('Jira builds ADF paragraphs and uses the JQL search endpoint', async () => {
    expect(toAdf('a\n\nb').content).toHaveLength(2);
    request.mockResolvedValueOnce(reply(200, { issues: [{ key: 'P-1', id: '1', fields: { summary: 's' } }] }));
    const out = await new JiraProvider(ssrf).executeAction(
      cred('JIRA', { domain: 'acme', email: 'e@x.co', apiToken: 't' }),
      'search_issues',
      { jql: 'project = P' },
    );
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://acme.atlassian.net/rest/api/3/search/jql');
    expect(call.auth).toEqual({ username: 'e@x.co', password: 't' });
    expect((out.data as any).issues[0].key).toBe('P-1');
  });

  it('Telegram rejects malformed tokens and keeps the token out of errors', async () => {
    const t = new TelegramProvider(ssrf);
    expect((await t.testConnection({ botToken: 'nope' })).success).toBe(false);
    request.mockResolvedValueOnce(reply(401, { ok: false, description: 'Unauthorized' }));
    const out = await t.executeAction(
      cred('TELEGRAM', { botToken: '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }),
      'get_chat',
      { chatId: '1' },
    );
    expect(out.success).toBe(false);
    expect(out.message).not.toContain('AAAAAAAA');
  });

  it('turns an API refusal into a failed result instead of throwing', async () => {
    request.mockResolvedValueOnce(reply(403, { message: 'no scope' }));
    const out = await new HubSpotProvider(ssrf).executeAction(cred('HUBSPOT', { token: 't' }), 'search_contacts', {});
    expect(out.success).toBe(false);
    expect(out.message).toContain('HubSpot');
  });
});
