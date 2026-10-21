import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { connectorRequest } from '../core/connector-http.js';
import { OAuthRestConnector, oauthAction, type OAuthAction, type OAuthCall } from '../core/oauth-rest-connector.js';
import { num, str } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

const compactEnvelope = (e: any) => ({
  id: e.envelopeId,
  subject: e.emailSubject ?? null,
  status: e.status,
  sentAt: e.sentDateTime ?? null,
  completedAt: e.completedDateTime ?? null,
  statusChangedAt: e.statusChangedDateTime ?? null,
  sender: e.sender ? { name: e.sender.userName ?? null, email: e.sender.email ?? null } : null,
});

/** DocuSign's own hosts only — the account base URI comes from DocuSign and is still checked. */
export function assertDocuSignBaseUri(value: unknown): string {
  const uri = textOf(value);
  let host: string;
  try {
    const url = new URL(uri);
    if (url.protocol !== 'https:') throw new Error();
    host = url.hostname;
  } catch {
    throw new UnauthorizedException('This DocuSign connection has no valid account URL — reconnect it.');
  }
  if (!/(^|\.)docusign\.(net|com)$/i.test(host)) throw new UnauthorizedException('This DocuSign connection points at an unexpected host — reconnect it.');
  return uri.replace(/\/+$/, '');
}

/**
 * DocuSign eSignature (Authorization Code Grant). The account and its regional
 * base URI come from `/oauth/userinfo` at connect time. Sending or voiding an
 * envelope asks for approval. `DOCUSIGN_ENVIRONMENT=demo` uses the developer sandbox.
 */
@Injectable()
export class DocuSignProvider extends OAuthRestConnector {
  readonly providerId = 'DOCUSIGN';
  protected readonly app = 'DocuSign';
  protected readonly envPrefix = 'DOCUSIGN';
  protected readonly callbackPath = 'docusign';
  protected readonly defaultScopes = ['signature'];
  protected get authorizeUrl() {
    return `${this.authHost()}/oauth/auth`;
  }
  protected get tokenUrl() {
    return `${this.authHost()}/oauth/token`;
  }

  private authHost() {
    return this.config.get<string>('DOCUSIGN_ENVIRONMENT') === 'demo' ? 'https://account-d.docusign.com' : 'https://account.docusign.com';
  }

  protected capabilities() {
    return {
      displayName: 'DocuSign',
      description: 'eSignature — track envelopes and send documents for signature from templates (sending asks for approval).',
      category: 'HR & People',
      connectorCategory: 'hr' as const,
      scopes: [{ scope: 'signature', description: 'Read envelopes and templates; send and void envelopes (asks for approval)', required: true }],
    };
  }

  protected target(accessToken: string, metadata: Record<string, unknown>) {
    const accountId = textOf(metadata['docusignAccountId']);
    if (!accountId) throw new UnauthorizedException('This DocuSign connection has no account on record — reconnect it.');
    return {
      baseUrl: `${assertDocuSignBaseUri(metadata['baseUri'])}/restapi/v2.1/accounts/${encodeURIComponent(accountId)}`,
      headers: { Authorization: `Bearer ${accessToken}` },
    };
  }

  protected async describeAccount(accessToken: string) {
    const res = await connectorRequest<any>(this.app, {
      method: 'GET',
      url: `${this.authHost()}/oauth/userinfo`,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
    const accounts = (res.data?.accounts ?? []) as any[];
    const account = accounts.find((a) => a.is_default) ?? accounts[0];
    if (!account?.account_id) throw new UnauthorizedException('This DocuSign user has no eSignature account.');
    return {
      label: account.account_name || res.data?.email || 'DocuSign account',
      accountId: account.account_id,
      email: res.data?.email,
      metadata: { docusignAccountId: account.account_id, baseUri: assertDocuSignBaseUri(account.base_uri), accountName: account.account_name ?? null },
    };
  }

  protected async ping(call: OAuthCall, metadata: Record<string, unknown>) {
    await call('GET', '/templates', { params: { count: 1 } });
    return String(metadata['accountName'] ?? 'DocuSign account');
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      { id: 'envelope_completed', label: 'Envelope completed', description: 'Starts the agent when an envelope is fully signed.', pollActionId: 'list_envelopes', defaultInput: { status: 'completed' }, itemsPath: 'envelopes', idField: 'id' },
    ];
  }

  protected actions(): OAuthAction[] {
    return [
      oauthAction(
        { id: 'list_envelopes', label: 'List envelopes', description: 'Envelopes changed in the last N days, newest first.', level: 'read', properties: { days: num('Look back this many days (default 30).'), status: str('sent, delivered, completed, declined, voided…'), limit: num('Max results (default 20).') } },
        async ({ input, call }) => {
          const from = new Date(Date.now() - boundedInt(input['days'], 30, 1, 365) * 86_400_000).toISOString();
          const res = await call('GET', '/envelopes', { params: { from_date: from, order_by: 'last_modified', order: 'desc', count: boundedInt(input['limit'], 20, 1, 100), ...(textOf(input['status']) ? { status: textOf(input['status']) } : {}) } });
          const envelopes = ((res?.envelopes ?? []) as any[]).map(compactEnvelope);
          return { message: `Found ${envelopes.length} envelope(s).`, data: { envelopes } };
        },
      ),
      oauthAction({ id: 'get_envelope', label: 'Get envelope', description: 'Status and recipients of one envelope.', level: 'read', properties: { envelopeId: str('Envelope id.') }, required: ['envelopeId'] }, async ({ input, call }) => {
        const { envelopeId } = requireText(input, 'envelopeId');
        const id = encodeURIComponent(envelopeId);
        const [envelope, recipients] = await Promise.all([call('GET', `/envelopes/${id}`), call('GET', `/envelopes/${id}/recipients`)]);
        const signers = ((recipients?.signers ?? []) as any[]).map((s) => ({ name: s.name, email: s.email, status: s.status, signedAt: s.signedDateTime ?? null }));
        return { message: 'Fetched the envelope.', data: { envelope: { ...compactEnvelope(envelope), signers } } };
      }),
      oauthAction({ id: 'list_templates', label: 'List templates', description: 'Templates that can be sent for signature.', level: 'read', properties: { search: str('Text to match in the name.') } }, async ({ input, call }) => {
        const res = await call('GET', '/templates', { params: { count: 50, ...(textOf(input['search']) ? { search_text: textOf(input['search']) } : {}) } });
        const templates = ((res?.envelopeTemplates ?? []) as any[]).map((t) => ({ id: t.templateId, name: t.name, description: t.description ?? null, updatedAt: t.lastModified ?? null }));
        return { message: `Found ${templates.length} template(s).`, data: { templates } };
      }),
      oauthAction(
        {
          id: 'send_from_template',
          label: 'Send for signature',
          description: 'Send a template to one signer. The email goes out immediately.',
          level: 'write',
          properties: { templateId: str('Template id.'), roleName: str('The template role to fill, e.g. Signer.'), signerName: str('Signer’s full name.'), signerEmail: str('Signer’s email.'), emailSubject: str('Email subject (optional).') },
          required: ['templateId', 'roleName', 'signerName', 'signerEmail'],
        },
        async ({ input, call }) => {
          const { templateId, roleName, signerName, signerEmail } = requireText(input, 'templateId', 'roleName', 'signerName', 'signerEmail');
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) throw new BadRequestException('signerEmail is not an email address.');
          const res = await call('POST', '/envelopes', {
            data: { templateId, status: 'sent', ...(textOf(input['emailSubject']) ? { emailSubject: textOf(input['emailSubject']) } : {}), templateRoles: [{ roleName, name: signerName, email: signerEmail }] },
          });
          return { message: `Sent for signature to ${signerEmail}.`, data: { envelope: { id: res?.envelopeId, status: res?.status ?? 'sent' } } };
        },
      ),
      oauthAction({ id: 'void_envelope', label: 'Void envelope', description: 'Cancel an in-flight envelope; signers can no longer sign it.', level: 'destructive', properties: { envelopeId: str('Envelope id.'), reason: str('Why it is voided (shown to recipients).') }, required: ['envelopeId', 'reason'] }, async ({ input, call }) => {
        const { envelopeId, reason } = requireText(input, 'envelopeId', 'reason');
        await call('PUT', `/envelopes/${encodeURIComponent(envelopeId)}`, { data: { status: 'voided', voidedReason: reason } });
        return { message: 'Envelope voided.', data: { envelope: { id: envelopeId, status: 'voided' } } };
      }),
    ];
  }
}
