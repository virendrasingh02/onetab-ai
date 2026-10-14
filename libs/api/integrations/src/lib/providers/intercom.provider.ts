import { Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface IntercomAuth extends Record<string, string> {
  token: string;
  /** us (default), eu or au — where the workspace's data lives. */
  region: string;
}

const HOSTS: Record<string, string> = { us: 'https://api.intercom.io', eu: 'https://api.eu.intercom.io', au: 'https://api.au.intercom.io' };

const compactConversation = (c: any) => ({
  id: c.id,
  state: c.state,
  title: c.title ?? null,
  open: c.open,
  read: c.read,
  createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
  updatedAt: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : null,
  contact: c.contacts?.contacts?.[0]?.id ?? c.source?.author?.id ?? null,
  preview: String(c.source?.body ?? '').replace(/<[^>]+>/g, '').slice(0, 500),
});

const compactContact = (c: any) => ({ id: c.id, role: c.role, name: c.name ?? null, email: c.email ?? null, phone: c.phone ?? null, createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null });

/** Intercom with an access token (Developer Hub → your app → Authentication). */
@Injectable()
export class IntercomProvider extends RestConnector<IntercomAuth> {
  readonly providerId = 'INTERCOM';
  protected readonly app = 'Intercom';
  protected readonly requiredFields = ['token'] as const;
  protected readonly secrets = ['token'];

  protected capabilities() {
    return {
      displayName: 'Intercom',
      description: 'Customer conversations and contacts — read the inbox, find people and reply as an admin.',
      category: 'Customer support',
      connectorCategory: 'customer_support',
      authType: 'BEARER' as const,
      scopes: [
        { scope: 'read', description: 'Read conversations and contacts', required: true },
        { scope: 'write', description: 'Reply and create contacts (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'token', label: 'Access token', secret: true, help: 'Developer Hub → your app → Configure → Authentication.' },
        { key: 'region', label: 'Data region', placeholder: 'us', optional: true, help: 'us (default), eu or au.' },
      ],
    };
  }

  protected target(auth: IntercomAuth) {
    return { baseUrl: HOSTS[(auth.region ?? 'us').toLowerCase()] ?? HOSTS['us'], headers: { Authorization: `Bearer ${auth.token}`, 'Intercom-Version': '2.11' } };
  }

  protected async ping(_auth: IntercomAuth, call: RestCall) {
    const me = await call('GET', '/me');
    return { label: me.app?.name ?? me.name ?? 'your workspace', accountId: String(me.id ?? ''), email: me.email };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [{ id: 'new_conversation', label: 'New conversation', description: 'Starts the agent for each new conversation.', pollActionId: 'list_conversations', itemsPath: 'conversations', idField: 'id' }];
  }

  protected actions(): RestAction<IntercomAuth>[] {
    return [
      action({ id: 'list_conversations', label: 'List conversations', description: 'Recent conversations, newest first.', level: 'read', properties: { limit: num('Max results (default 20).') } }, async ({ input, call }) => {
        const data = await call('GET', '/conversations', { params: { per_page: boundedInt(input['limit'], 20, 1, 60), sort: 'created_at', order: 'desc' } });
        const conversations = ((data.conversations ?? []) as any[]).map(compactConversation);
        return { message: `Found ${conversations.length} conversation(s).`, data: { conversations } };
      }),
      action({ id: 'get_conversation', label: 'Get conversation', description: 'A conversation with its messages.', level: 'read', properties: { conversationId: str('The conversation id.') }, required: ['conversationId'] }, async ({ input, call }) => {
        const { conversationId } = requireText(input, 'conversationId');
        const data = await call('GET', `/conversations/${encodeURIComponent(conversationId)}`);
        const parts = ((data.conversation_parts?.conversation_parts ?? []) as any[])
          .filter((p) => p.body)
          .map((p) => ({ id: p.id, type: p.part_type, author: p.author?.name ?? p.author?.type, body: String(p.body).replace(/<[^>]+>/g, '').slice(0, 1500), createdAt: p.created_at ? new Date(p.created_at * 1000).toISOString() : null }));
        return { message: `Fetched the conversation (${parts.length} message(s)).`, data: { conversation: compactConversation(data), messages: parts } };
      }),
      action({ id: 'search_contacts', label: 'Find contact', description: 'Look a contact up by email.', level: 'read', properties: { email: str('Email address.') }, required: ['email'] }, async ({ input, call }) => {
        const { email } = requireText(input, 'email');
        const data = await call('POST', '/contacts/search', { data: { query: { field: 'email', operator: '=', value: email } } });
        const contacts = ((data.data ?? []) as any[]).map(compactContact);
        return { message: `Found ${contacts.length} contact(s).`, data: { contacts } };
      }),
      action({ id: 'create_contact', label: 'Create contact', description: 'Add a user or lead.', level: 'write', properties: { email: str('Email.'), name: str('Name.'), role: str('user or lead (default user).', { enum: ['user', 'lead'] }) }, required: ['email'] }, async ({ input, call }) => {
        const { email } = requireText(input, 'email');
        const data = await call('POST', '/contacts', { data: compactObject({ role: textOf(input['role']) || 'user', email, name: textOf(input['name']) }) });
        return { message: `Created contact ${email}.`, data: { contact: compactContact(data) } };
      }),
      action({ id: 'reply_to_conversation', label: 'Reply to conversation', description: 'Send a reply to the customer as the connected admin.', level: 'write', properties: { conversationId: str('The conversation id.'), body: str('Reply text.') }, required: ['conversationId', 'body'] }, async ({ input, call }) => {
        const { conversationId, body } = requireText(input, 'conversationId', 'body');
        const me = await call('GET', '/me');
        const data = await call('POST', `/conversations/${encodeURIComponent(conversationId)}/reply`, { data: { message_type: 'comment', type: 'admin', admin_id: String(me.id), body } });
        return { message: 'Reply sent.', data: { conversation: compactConversation(data) } };
      }),
    ];
  }
}
