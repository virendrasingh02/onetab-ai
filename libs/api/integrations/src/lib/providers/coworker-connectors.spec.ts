import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { bambooSubdomain, BambooHRProvider } from './bamboohr.provider.js';
import { BitbucketProvider } from './bitbucket.provider.js';
import { circleProjectSlug, CircleCiProvider } from './circleci.provider.js';
import { assertDocuSignBaseUri, DocuSignProvider } from './docusign.provider.js';
import { gitlabOrigin, GitLabProvider } from './gitlab.provider.js';
import { assertQuickBooksQuery, QuickBooksProvider } from './quickbooks.provider.js';
import { parseRecipients, SendGridProvider } from './sendgrid.provider.js';
import { XeroProvider } from './xero.provider.js';
import { flattenZohoRecords, ZohoPeopleProvider, zohoDataCenter } from './zoho-people.provider.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
import type { SSRFGuardService } from '../core/ssrf-guard.service.js';

vi.mock('axios', () => ({ default: { request: vi.fn() } }));
const request = axios.request as unknown as ReturnType<typeof vi.fn>;
const reply = (status: number, data: unknown = {}) => ({ status, data, headers: {} });
const ssrf = { agents: {} } as unknown as SSRFGuardService;
const config = (values: Record<string, string> = {}) => ({ get: (k: string) => values[k] }) as unknown as ConfigService;
const bundle = (provider: string, b: Record<string, string>): ResolvedCredential => ({
  id: 'int-1',
  provider,
  scopeType: 'WORKSPACE',
  accessToken: JSON.stringify(b),
  metadata: {},
  scopes: [],
});
const oauth = (provider: string, metadata: Record<string, unknown>): ResolvedCredential => ({
  id: 'int-1',
  provider,
  scopeType: 'WORKSPACE',
  accessToken: 'at-123',
  metadata,
  scopes: [],
});

afterEach(() => request.mockReset());

describe('coworker connectors', () => {
  const restProviders = [
    new GitLabProvider(ssrf),
    new BitbucketProvider(ssrf),
    new CircleCiProvider(ssrf),
    new SendGridProvider(ssrf),
    new BambooHRProvider(ssrf),
    new ZohoPeopleProvider(ssrf),
  ];
  const oauthProviders = [new QuickBooksProvider(ssrf, config()), new XeroProvider(ssrf, config()), new DocuSignProvider(ssrf, config())];

  it.each([...restProviders, ...oauthProviders].map((p) => [p.providerId, p] as const))(
    '%s: writes ask for approval and triggers poll a real read action',
    (_id, p) => {
      const actions = p.getActions();
      expect(actions.length).toBeGreaterThan(2);
      for (const a of actions) {
        expect(a.requiresConfirmation).toBe(a.permissionLevel !== 'read');
        expect(Object.keys(a)).not.toContain('run');
      }
      for (const t of p.getTriggers()) expect(actions.find((a) => a.id === t.pollActionId)?.permissionLevel).toBe('read');
    },
  );

  it('REST connectors list their secrets among the credential fields', () => {
    for (const p of restProviders) {
      const keys = p.getCapabilities().credentialFields!.map((f) => f.key);
      for (const s of p.secretFields()) expect(keys).toContain(s);
    }
  });

  it('OAuth connectors say honestly when the server has no OAuth app', async () => {
    for (const p of oauthProviders) {
      expect(p.getCapabilities().authType).toBe('OAUTH2');
      expect(p.isServerConfigured()).toBe(false);
      await expect(p.getAuthorizationUrl('state')).rejects.toThrow(/isn’t set up on this server/);
    }
    const configured = new XeroProvider(ssrf, config({ XERO_CLIENT_ID: 'id', XERO_CLIENT_SECRET: 's' }));
    expect(configured.isServerConfigured()).toBe(true);
    const url = new URL(await configured.getAuthorizationUrl('st'));
    expect(url.origin + url.pathname).toBe('https://login.xero.com/identity/connect/authorize');
    expect(url.searchParams.get('scope')).toContain('offline_access');
    expect(url.searchParams.get('state')).toBe('st');
  });

  it('QuickBooks reads the company from the callback and calls its realm', async () => {
    const qb = new QuickBooksProvider(ssrf, config({ QUICKBOOKS_CLIENT_ID: 'id', QUICKBOOKS_CLIENT_SECRET: 's' }));
    request
      .mockResolvedValueOnce(reply(200, { access_token: 'at', refresh_token: 'rt', expires_in: 3600 }))
      .mockResolvedValueOnce(reply(200, { CompanyInfo: { CompanyName: 'Acme Ltd' } }));
    const token = await qb.handleCallback('code', 'state', { params: { realmId: '9130' } });
    expect(request.mock.calls[0][0].auth).toEqual({ username: 'id', password: 's' });
    expect(request.mock.calls[0][0].retries ?? 0).toBe(0);
    expect(token).toMatchObject({ accessToken: 'at', refreshToken: 'rt', accountName: 'Acme Ltd', metadata: { realmId: '9130' } });

    request.mockResolvedValueOnce(reply(200, { QueryResponse: { Invoice: [{ Id: '7', DocNumber: '1001', TotalAmt: 50, Balance: 50 }] } }));
    const out = await qb.executeAction(oauth('QUICKBOOKS', { realmId: '9130' }), 'list_invoices', { unpaidOnly: true });
    const call = request.mock.calls[2][0];
    expect(call.url).toBe('https://quickbooks.api.intuit.com/v3/company/9130/query');
    expect(call.headers.Authorization).toBe('Bearer at-123');
    expect(call.params.query).toContain("WHERE Balance > '0'");
    expect((out.data as any).invoices[0]).toMatchObject({ id: '7', number: '1001' });
  });

  it('QuickBooks only runs a single SELECT over known entities', () => {
    expect(assertQuickBooksQuery("select * from Bill where Balance > '0';")).toBe("select * from Bill where Balance > '0'");
    expect(() => assertQuickBooksQuery('select * from Employee')).toThrow();
    expect(() => assertQuickBooksQuery('delete Invoice')).toThrow();
    expect(() => assertQuickBooksQuery('select * from Bill; select * from Invoice')).toThrow();
  });

  it('Xero picks the authorised organisation and sends its tenant id', async () => {
    const xero = new XeroProvider(ssrf, config({ XERO_CLIENT_ID: 'id', XERO_CLIENT_SECRET: 's' }));
    request
      .mockResolvedValueOnce(reply(200, { access_token: 'at', refresh_token: 'rt2', expires_in: 1800 }))
      .mockResolvedValueOnce(reply(200, [{ tenantId: 't-1', tenantName: 'Demo Co', tenantType: 'ORGANISATION' }]));
    const token = await xero.handleCallback('code', 'state');
    expect(token.metadata).toEqual({ tenantId: 't-1', tenantName: 'Demo Co' });

    request.mockResolvedValueOnce(reply(200, { Invoices: [{ InvoiceID: 'i-1', Status: 'DRAFT' }] }));
    await xero.executeAction(oauth('XERO', { tenantId: 't-1' }), 'create_draft_invoice', { contactId: 'c', description: 'Work', unitAmount: 10, accountCode: '200' });
    const call = request.mock.calls[2][0];
    expect(call.headers['xero-tenant-id']).toBe('t-1');
    expect(call.data.Invoices[0]).toMatchObject({ Type: 'ACCREC', Status: 'DRAFT' });
  });

  it('a refresh returns the rotated refresh token', async () => {
    const xero = new XeroProvider(ssrf, config({ XERO_CLIENT_ID: 'id', XERO_CLIENT_SECRET: 's' }));
    request.mockResolvedValueOnce(reply(200, { access_token: 'new', refresh_token: 'rotated', expires_in: 1800 }));
    const out = await xero.refreshToken('old');
    expect(out).toMatchObject({ accessToken: 'new', refreshToken: 'rotated' });
    expect(request.mock.calls[0][0].data).toBe('grant_type=refresh_token&refresh_token=old');
  });

  it('DocuSign only trusts DocuSign hosts for the account base URI', () => {
    expect(assertDocuSignBaseUri('https://na3.docusign.net/')).toBe('https://na3.docusign.net');
    expect(() => assertDocuSignBaseUri('https://evil.example.com')).toThrow();
    expect(() => assertDocuSignBaseUri('http://na3.docusign.net')).toThrow();
    expect(() => assertDocuSignBaseUri('https://docusign.net.evil.io')).toThrow();
  });

  it('DocuSign sends a template through the account base URI', async () => {
    request.mockResolvedValueOnce(reply(201, { envelopeId: 'env-1', status: 'sent' }));
    const out = await new DocuSignProvider(ssrf, config()).executeAction(
      oauth('DOCUSIGN', { docusignAccountId: 'acc', baseUri: 'https://demo.docusign.net' }),
      'send_from_template',
      { templateId: 't', roleName: 'Signer', signerName: 'Ada L', signerEmail: 'ada@x.co' },
    );
    expect(request.mock.calls[0][0].url).toBe('https://demo.docusign.net/restapi/v2.1/accounts/acc/envelopes');
    expect(out).toMatchObject({ success: true, data: { envelope: { id: 'env-1' } } });
  });

  it('validates hosts and identifiers before any request', () => {
    expect(gitlabOrigin('')).toBe('https://gitlab.com');
    expect(gitlabOrigin('https://git.acme.io/x')).toBe('https://git.acme.io');
    expect(() => gitlabOrigin('http://git.acme.io')).toThrow();
    expect(() => gitlabOrigin('https://u:p@git.acme.io')).toThrow();
    expect(circleProjectSlug('gh/acme/api')).toBe('gh/acme/api');
    expect(() => circleProjectSlug('../../me')).toThrow();
    expect(bambooSubdomain('Acme.bamboohr.com')).toBe('acme');
    expect(() => bambooSubdomain('evil.com/x')).toThrow();
    expect(zohoDataCenter('')).toBe('com');
    expect(() => zohoDataCenter('evil.io')).toThrow();
    expect(parseRecipients('a@x.co, B@x.co,a@x.co')).toEqual(['a@x.co', 'b@x.co']);
    expect(() => parseRecipients('nope')).toThrow();
  });

  it('GitLab uses the private-token header against the instance', async () => {
    request.mockResolvedValueOnce(reply(200, [{ id: 5, status: 'failed', ref: 'main', sha: 'abcdef1234', web_url: 'u' }]));
    const out = await new GitLabProvider(ssrf).executeAction(bundle('GITLAB', { token: 'glpat-x', baseUrl: '' }), 'list_pipelines', { project: 'acme/api', status: 'failed' });
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://gitlab.com/api/v4/projects/acme%2Fapi/pipelines');
    expect(call.headers['PRIVATE-TOKEN']).toBe('glpat-x');
    expect((out.data as any).pipelines[0]).toMatchObject({ id: 5, status: 'failed', sha: 'abcdef12' });
  });

  it('SendGrid sends from the connection’s sender only', async () => {
    request.mockResolvedValueOnce(reply(202, ''));
    const out = await new SendGridProvider(ssrf).executeAction(
      bundle('SENDGRID', { apiKey: 'SG.key', fromEmail: 'noreply@acme.io', fromName: 'Acme' }),
      'send_email',
      { to: 'x@y.co', subject: 'Hi', text: 'Body', from: 'ceo@acme.io' },
    );
    const call = request.mock.calls[0][0];
    expect(call.data.from).toEqual({ email: 'noreply@acme.io', name: 'Acme' });
    expect(call.data.personalizations[0].to).toEqual([{ email: 'x@y.co' }]);
    expect(out.success).toBe(true);
  });

  it('Zoho People exchanges the refresh token once and flattens records', async () => {
    request
      .mockResolvedValueOnce(reply(200, { access_token: 'zat', expires_in: 3600 }))
      .mockResolvedValueOnce(reply(200, { response: { status: 0, result: [{ '111': [{ FirstName: 'Ada', LastName: 'L', EmailID: 'ada@x.co' }] }] } }))
      .mockResolvedValueOnce(reply(200, { response: { status: 0, result: [] } }));
    const zoho = new ZohoPeopleProvider(ssrf);
    const cred = bundle('ZOHO_PEOPLE', { clientId: 'cid-zoho-unique', clientSecret: 's', refreshToken: 'r', dataCenter: 'in' });
    const out = await zoho.executeAction(cred, 'list_employees', {});
    await zoho.executeAction(cred, 'list_leave_records', {});
    expect(request.mock.calls[0][0].url).toBe('https://accounts.zoho.in/oauth/v2/token');
    expect(request.mock.calls[1][0].headers.Authorization).toBe('Zoho-oauthtoken zat');
    expect(request.mock.calls[2][0].url).toBe('https://people.zoho.in/people/api/forms/leave/getRecords');
    expect(request).toHaveBeenCalledTimes(3);
    expect((out.data as any).employees[0]).toMatchObject({ id: '111', name: 'Ada L', email: 'ada@x.co' });
    expect(flattenZohoRecords({ response: { status: 1, errors: { code: 7024, message: 'No records found' } } })).toEqual([]);
    expect(() => flattenZohoRecords({ response: { status: 1, errors: { code: 7011, message: 'Invalid form' } } })).toThrow(/Invalid form/);
  });
});
