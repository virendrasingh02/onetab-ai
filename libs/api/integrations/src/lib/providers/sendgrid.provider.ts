import { BadRequestException, Injectable } from '@nestjs/common';
import { action, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface SendGridAuth extends Record<string, string> {
  apiKey: string;
  /** A verified sender (Single Sender or an authenticated domain). */
  fromEmail: string;
  fromName: string;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** One or more comma-separated addresses, each checked, at most 50. */
export function parseRecipients(value: unknown): string[] {
  const list = textOf(value).split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) throw new BadRequestException('Add at least one recipient.');
  if (list.length > 50) throw new BadRequestException('At most 50 recipients per email.');
  for (const address of list) if (!EMAIL.test(address)) throw new BadRequestException(`'${address}' is not an email address.`);
  return [...new Set(list.map((a) => a.toLowerCase()))];
}

/**
 * SendGrid v3 with an API key restricted to Mail Send (and, for the stats
 * reads, Stats read access). Sending always asks for approval; the sender is
 * fixed by the connection so an agent can’t send as someone else.
 */
@Injectable()
export class SendGridProvider extends RestConnector<SendGridAuth> {
  readonly providerId = 'SENDGRID';
  protected readonly app = 'SendGrid';
  protected readonly requiredFields = ['apiKey', 'fromEmail'] as const;
  protected readonly secrets = ['apiKey'];

  protected capabilities() {
    return {
      displayName: 'SendGrid',
      description: 'Transactional email — send messages from your verified sender and check delivery stats and bounces.',
      category: 'Email',
      connectorCategory: 'email' as const,
      authType: 'API_KEY_HEADER' as const,
      scopes: [
        { scope: 'mail.send', description: 'Send email (each message asks for approval)', required: true },
        { scope: 'stats.read', description: 'Read delivery stats and bounces' },
      ],
      credentialFields: [
        { key: 'apiKey', label: 'API key', secret: true, placeholder: 'SG.…', help: 'Settings → API Keys → Restricted access: Mail Send (+ Stats / Suppressions read for delivery checks).' },
        { key: 'fromEmail', label: 'From email', placeholder: 'notifications@company.com', help: 'Must be a verified sender in SendGrid.' },
        { key: 'fromName', label: 'From name', optional: true, placeholder: 'Acme Notifications' },
      ],
    };
  }

  protected override validate(auth: SendGridAuth) {
    if (!auth.apiKey.startsWith('SG.')) throw new BadRequestException('That doesn’t look like a SendGrid API key (SG.…).');
    if (!EMAIL.test(auth.fromEmail)) throw new BadRequestException('From email is not an email address.');
  }

  protected target(auth: SendGridAuth) {
    return { baseUrl: 'https://api.sendgrid.com/v3', headers: { Authorization: `Bearer ${auth.apiKey}` } };
  }

  protected async ping(auth: SendGridAuth, call: RestCall) {
    // A Mail-Send-only key can read its own scopes, which proves it is valid.
    const res = await call('GET', '/scopes');
    const scopes = (res.scopes ?? []) as string[];
    if (!scopes.includes('mail.send')) throw new BadRequestException('This API key can’t send mail — give it Mail Send access.');
    return { label: auth.fromEmail };
  }

  protected actions(): RestAction<SendGridAuth>[] {
    return [
      action(
        {
          id: 'send_email',
          label: 'Send email',
          description: 'Send an email from the connection’s verified sender.',
          level: 'write',
          properties: { to: str('Recipient(s), comma-separated.'), subject: str('Subject.'), text: str('Plain-text body.'), html: str('HTML body (optional).'), replyTo: str('Reply-to address (optional).') },
          required: ['to', 'subject', 'text'],
        },
        async ({ auth, input, call }) => {
          const { subject, text } = requireText(input, 'subject', 'text');
          const to = parseRecipients(input['to']);
          const replyTo = textOf(input['replyTo']);
          if (replyTo && !EMAIL.test(replyTo)) throw new BadRequestException('replyTo is not an email address.');
          await call('POST', '/mail/send', {
            data: {
              personalizations: [{ to: to.map((email) => ({ email })) }],
              from: { email: auth.fromEmail, ...(auth.fromName ? { name: auth.fromName } : {}) },
              ...(replyTo ? { reply_to: { email: replyTo } } : {}),
              subject,
              content: [{ type: 'text/plain', value: text }, ...(textOf(input['html']) ? [{ type: 'text/html', value: textOf(input['html']) }] : [])],
            },
          });
          // 202 Accepted: SendGrid queued it; delivery is visible in stats/activity.
          return { message: `Email accepted by SendGrid for ${to.length} recipient(s).`, data: { accepted: true, to, subject } };
        },
      ),
      action({ id: 'get_stats', label: 'Delivery stats', description: 'Requests, delivered, bounces, opens and spam reports per day.', level: 'read', properties: { days: num('Last N days (default 7).') } }, async ({ input, call }) => {
        const start = new Date(Date.now() - boundedInt(input['days'], 7, 1, 90) * 86_400_000).toISOString().slice(0, 10);
        const rows = (await call('GET', '/stats', { params: { start_date: start, aggregated_by: 'day' } })) as any[];
        const days = rows.map((d) => ({ date: d.date, ...(d.stats?.[0]?.metrics ?? {}) }));
        return { message: `Fetched stats for ${days.length} day(s).`, data: { days } };
      }),
      action({ id: 'list_bounces', label: 'List bounces', description: 'Recent bounced addresses with the reason.', level: 'read', properties: { limit: num('Max results (default 20).') } }, async ({ input, call }) => {
        const rows = (await call('GET', '/suppression/bounces', { params: { limit: boundedInt(input['limit'], 20, 1, 500) } })) as any[];
        const bounces = rows.map((b) => ({ email: b.email, reason: b.reason ?? null, status: b.status ?? null, at: b.created ? new Date(b.created * 1000).toISOString() : null }));
        return { message: `Found ${bounces.length} bounce(s).`, data: { bounces } };
      }),
    ];
  }
}
