import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface ZendeskAuth extends Record<string, string> {
  subdomain: string;
  email: string;
  apiToken: string;
}

/** `acme` or `acme.zendesk.com` → `acme`; anything else is refused. */
export function zendeskSubdomain(value: string): string {
  const sub = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.zendesk\.com\/?$/, '');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(sub)) throw new BadRequestException('Zendesk subdomain should look like acme or acme.zendesk.com.');
  return sub;
}

const compactTicket = (t: any) => ({
  id: t.id,
  subject: t.subject,
  status: t.status,
  priority: t.priority ?? null,
  requesterId: t.requester_id,
  assigneeId: t.assignee_id ?? null,
  tags: t.tags ?? [],
  createdAt: t.created_at,
  updatedAt: t.updated_at,
  description: typeof t.description === 'string' ? t.description.slice(0, 2000) : '',
});

/** Zendesk Support with an agent email and API token (Admin Center → Apps and integrations → APIs). */
@Injectable()
export class ZendeskProvider extends RestConnector<ZendeskAuth> {
  readonly providerId = 'ZENDESK';
  protected readonly app = 'Zendesk';
  protected readonly requiredFields = ['subdomain', 'email', 'apiToken'] as const;
  protected readonly secrets = ['apiToken'];

  protected capabilities() {
    return {
      displayName: 'Zendesk',
      description: 'Tickets, customers and support workflows — search, create, reply to and update tickets.',
      category: 'Customer support',
      connectorCategory: 'customer_support',
      authType: 'BEARER' as const,
      scopes: [
        { scope: 'read', description: 'Read tickets and users', required: true },
        { scope: 'write', description: 'Create tickets and reply (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'subdomain', label: 'Zendesk subdomain', placeholder: 'acme.zendesk.com' },
        { key: 'email', label: 'Agent email' },
        { key: 'apiToken', label: 'API token', secret: true, help: 'Admin Center → Apps and integrations → APIs → Zendesk API → add a token.' },
      ],
    };
  }

  protected override validate(auth: ZendeskAuth) {
    zendeskSubdomain(auth.subdomain);
  }

  protected target(auth: ZendeskAuth) {
    return { baseUrl: `https://${zendeskSubdomain(auth.subdomain)}.zendesk.com/api/v2`, basic: { username: `${auth.email}/token`, password: auth.apiToken } };
  }

  protected async ping(_auth: ZendeskAuth, call: RestCall) {
    const { user } = await call('GET', '/users/me.json');
    return { label: user?.name ?? user?.email ?? 'your account', accountId: String(user?.id ?? ''), email: user?.email };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [{ id: 'new_ticket', label: 'New ticket', description: 'Starts the agent for each new ticket.', pollActionId: 'list_tickets', itemsPath: 'tickets', idField: 'id' }];
  }

  protected actions(): RestAction<ZendeskAuth>[] {
    const ticketId = str('The ticket id.');
    return [
      action({ id: 'list_tickets', label: 'List tickets', description: 'Newest tickets first.', level: 'read', properties: { limit: num('Max results (default 25).') } }, async ({ input, call }) => {
        const data = await call('GET', '/tickets.json', { params: { sort_by: 'created_at', sort_order: 'desc', per_page: boundedInt(input['limit'], 25, 1, 100) } });
        const tickets = ((data.tickets ?? []) as any[]).map(compactTicket);
        return { message: `Found ${tickets.length} ticket(s).`, data: { tickets } };
      }),
      action({ id: 'search_tickets', label: 'Search tickets', description: 'Zendesk search syntax, e.g. status:open priority:high.', level: 'read', properties: { query: str('Search query.'), limit: num('Max results (default 25).') }, required: ['query'] }, async ({ input, call }) => {
        const { query } = requireText(input, 'query');
        const data = await call('GET', '/search.json', { params: { query: `type:ticket ${query}`, per_page: boundedInt(input['limit'], 25, 1, 100) } });
        const tickets = ((data.results ?? []) as any[]).map(compactTicket);
        return { message: `Found ${tickets.length} ticket(s).`, data: { tickets } };
      }),
      action({ id: 'get_ticket', label: 'Get ticket', description: 'Fetch one ticket.', level: 'read', properties: { ticketId }, required: ['ticketId'] }, async ({ input, call }) => {
        const { ticketId } = requireText(input, 'ticketId');
        const data = await call('GET', `/tickets/${encodeURIComponent(ticketId)}.json`);
        return { message: `Fetched ticket ${data.ticket.id}.`, data: { ticket: compactTicket(data.ticket) } };
      }),
      action({ id: 'list_comments', label: 'List ticket comments', description: 'The conversation on a ticket.', level: 'read', properties: { ticketId }, required: ['ticketId'] }, async ({ input, call }) => {
        const { ticketId } = requireText(input, 'ticketId');
        const data = await call('GET', `/tickets/${encodeURIComponent(ticketId)}/comments.json`);
        const comments = ((data.comments ?? []) as any[]).map((c) => ({ id: c.id, authorId: c.author_id, public: c.public, body: String(c.plain_body ?? c.body ?? '').slice(0, 2000), createdAt: c.created_at }));
        return { message: `Read ${comments.length} comment(s).`, data: { comments } };
      }),
      action(
        { id: 'create_ticket', label: 'Create ticket', description: 'Open a ticket on behalf of a customer.', level: 'write', properties: { subject: str('Subject.'), body: str('First message.'), requesterEmail: str('Customer email.'), requesterName: str('Customer name.'), priority: str('low, normal, high or urgent.', { enum: ['low', 'normal', 'high', 'urgent'] }) }, required: ['subject', 'body'] },
        async ({ input, call }) => {
          const { subject, body } = requireText(input, 'subject', 'body');
          const email = textOf(input['requesterEmail']);
          const data = await call('POST', '/tickets.json', {
            data: { ticket: { subject, comment: { body }, ...compactObject({ priority: textOf(input['priority']) }), ...(email ? { requester: compactObject({ email, name: textOf(input['requesterName']) }) } : {}) } },
          });
          return { message: `Created ticket ${data.ticket.id}.`, data: { ticket: compactTicket(data.ticket) } };
        },
      ),
      action(
        { id: 'reply_to_ticket', label: 'Reply to ticket', description: 'Add a public reply (visible to the customer) or an internal note.', level: 'write', properties: { ticketId, body: str('Message.'), internal: { type: 'boolean', description: 'true = internal note, not visible to the customer.' } }, required: ['ticketId', 'body'] },
        async ({ input, call }) => {
          const { ticketId, body } = requireText(input, 'ticketId', 'body');
          const data = await call('PUT', `/tickets/${encodeURIComponent(ticketId)}.json`, { data: { ticket: { comment: { body, public: input['internal'] !== true } } } });
          return { message: input['internal'] === true ? 'Internal note added.' : 'Reply sent to the customer.', data: { ticket: compactTicket(data.ticket) } };
        },
      ),
      action(
        { id: 'update_ticket', label: 'Update ticket', description: 'Change a ticket’s status or priority.', level: 'write', properties: { ticketId, status: str('new, open, pending, hold, solved.', { enum: ['new', 'open', 'pending', 'hold', 'solved'] }), priority: str('low, normal, high or urgent.', { enum: ['low', 'normal', 'high', 'urgent'] }) }, required: ['ticketId'] },
        async ({ input, call }) => {
          const { ticketId } = requireText(input, 'ticketId');
          const data = await call('PUT', `/tickets/${encodeURIComponent(ticketId)}.json`, { data: { ticket: compactObject({ status: textOf(input['status']), priority: textOf(input['priority']) }) } });
          return { message: 'Updated the ticket.', data: { ticket: compactTicket(data.ticket) } };
        },
      ),
    ];
  }
}
