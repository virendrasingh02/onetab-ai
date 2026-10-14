import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { connectorRequest, ConnectorHttpError } from '../core/connector-http.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';
import type {
  ConnectorInboundEvent,
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';
import { boundedInt, parseCredentialBundle, requireText, textOf } from './credential-json.js';

const APP = 'WhatsApp';
const GRAPH = 'https://graph.facebook.com/v21.0';

interface WhatsAppAuth extends Record<string, string> {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  appSecret: string;
  verifyToken: string;
}

/**
 * Meta error codes worth explaining in plain words. Meta enforces its own
 * messaging policy (opt-in, the 24-hour window, approved templates, quality
 * limits); the connector surfaces those refusals instead of working around them.
 */
const POLICY_ERRORS: Record<number, string> = {
  131047: 'More than 24 hours have passed since this customer last wrote to you, so WhatsApp only allows an approved template message now.',
  131026: 'This number can’t receive the message (not on WhatsApp, or the customer hasn’t accepted WhatsApp’s terms).',
  131030: 'This number isn’t on the list of allowed recipients for the test phone number.',
  131049: 'WhatsApp declined to deliver this message to keep the customer experience healthy (marketing limit).',
  132000: 'The template’s parameters don’t match what the template expects.',
  132001: 'That template doesn’t exist in this language, or isn’t approved yet.',
  130429: 'WhatsApp’s sending rate limit was reached. Try again later.',
  131056: 'Too many messages were sent to this number in a short time. Try again later.',
};

/** `+91 98765-43210` → `919876543210`; null when it can't be a phone number. */
export function toWhatsAppNumber(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function isTrue(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

function readAuth(accessToken: string): WhatsAppAuth {
  return parseCredentialBundle<WhatsAppAuth>(accessToken, APP, ['phoneNumberId', 'accessToken']);
}

function describeMetaError(error: ConnectorHttpError): string {
  return POLICY_ERRORS[Number(error.providerCode)] ?? error.message;
}

/**
 * WhatsApp Business Cloud API (Meta Graph). The person brings a permanent
 * system-user access token and the phone number id from their own Meta app;
 * nothing is shared with Mie's own Meta credentials.
 *
 * Sending is deliberately narrow and policy-aware: every send needs the
 * customer's opt-in to be asserted, free-form text only works inside the
 * 24-hour customer-service window, and anything else must be an approved
 * template. Both sends require approval in the agent builder.
 */
@Injectable()
export class WhatsAppProvider implements ProviderAdapter {
  readonly providerId = 'WHATSAPP';

  constructor(private readonly ssrf: SSRFGuardService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'WhatsApp Business',
      description: 'Message customers on WhatsApp through the Cloud API: approved templates, replies inside the 24-hour window, and incoming messages.',
      category: 'Communication',
      connectorCategory: 'communication',
      authType: 'BEARER',
      supportsSync: false,
      supportsWebhooks: true,
      supportsMessaging: true,
      supportsCustomEndpoints: false,
      scopes: [
        { scope: 'whatsapp_business_messaging', description: 'Send messages from your business number', required: true },
        { scope: 'whatsapp_business_management', description: 'List your approved message templates' },
      ],
      credentialFields: [
        { key: 'phoneNumberId', label: 'Phone number ID', placeholder: '1090000000000000', help: 'WhatsApp → API Setup in your Meta app.' },
        { key: 'accessToken', label: 'Access token', secret: true, help: 'Use a permanent system-user token, not the 24-hour test token.' },
        { key: 'businessAccountId', label: 'WhatsApp Business Account ID', optional: true, help: 'Needed to list your message templates.' },
        { key: 'appSecret', label: 'App secret', secret: true, optional: true, help: 'Needed to verify incoming-message webhooks.' },
        { key: 'verifyToken', label: 'Webhook verify token', secret: true, optional: true, help: 'Any string you also enter in Meta’s webhook setup.' },
      ],
    };
  }

  secretFields(): string[] {
    return ['accessToken', 'appSecret', 'verifyToken'];
  }

  private async call<T = any>(
    auth: WhatsAppAuth,
    method: 'GET' | 'POST',
    path: string,
    options: { params?: Record<string, unknown>; data?: unknown } = {},
  ) {
    return connectorRequest<T>(APP, {
      method,
      url: `${GRAPH}${path}`,
      headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: 'application/json' },
      params: options.params,
      data: options.data,
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const auth = readAuth(credential.accessToken);
    const { data } = await this.call(auth, 'GET', `/${encodeURIComponent(auth.phoneNumberId)}`, {
      params: { fields: 'display_phone_number,verified_name,quality_rating' },
    });
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: auth.phoneNumberId,
      name: data.verified_name || data.display_phone_number,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { displayPhoneNumber: data.display_phone_number, qualityRating: data.quality_rating },
    };
  }

  async disconnect(): Promise<void> {
    // The token belongs to the person's Meta app; they revoke it there.
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    return { success: true, eventType: 'whatsapp.webhook', data: payload };
  }

  async testConnection(
    config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const auth = credential ? readAuth(credential.accessToken) : readAuth(JSON.stringify(config));
      const { data } = await this.call(auth, 'GET', `/${encodeURIComponent(auth.phoneNumberId)}`, {
        params: { fields: 'display_phone_number,verified_name,quality_rating' },
      });
      return {
        success: true,
        message: `Connected to ${data.verified_name ?? 'WhatsApp'} (${data.display_phone_number ?? auth.phoneNumberId}).`,
        details: { quality: data.quality_rating, displayName: data.verified_name ?? data.display_phone_number },
      };
    } catch (error) {
      return { success: false, message: `WhatsApp connection failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /* ----------------------------------------------------------- webhooks -- */

  verifyWebhook(credential: ResolvedCredential, rawBody: string, headers: Record<string, string>): boolean {
    const auth = readAuth(credential.accessToken);
    const given = headers['x-hub-signature-256'];
    if (!auth.appSecret || !given) return false;
    const expected = `sha256=${createHmac('sha256', auth.appSecret).update(rawBody, 'utf8').digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  webhookChallenge(credential: ResolvedCredential, query: Record<string, string>): string | null {
    const auth = readAuth(credential.accessToken);
    if (query['hub.mode'] !== 'subscribe' || !auth.verifyToken) return null;
    const given = Buffer.from(query['hub.verify_token'] ?? '');
    const wanted = Buffer.from(auth.verifyToken);
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
    return query['hub.challenge'] ?? null;
  }

  parseWebhookEvents(credential: ResolvedCredential, payload: unknown): ConnectorInboundEvent[] {
    const auth = readAuth(credential.accessToken);
    const events: ConnectorInboundEvent[] = [];
    const entries = (payload as any)?.entry;
    if (!Array.isArray(entries)) return events;
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        // Only messages sent to this connection's own number.
        if (!value || (value.metadata?.phone_number_id && String(value.metadata.phone_number_id) !== auth.phoneNumberId)) continue;
        for (const m of value.messages ?? []) {
          const contact = (value.contacts ?? []).find((c: any) => c.wa_id === m.from);
          events.push({
            eventId: String(m.id),
            triggerId: 'message_received',
            item: {
              id: m.id,
              from: m.from,
              name: contact?.profile?.name,
              type: m.type,
              text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '',
              timestamp: m.timestamp,
            },
          });
        }
      }
    }
    return events;
  }

  getTriggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'message_received',
        label: 'Message received',
        description: 'Starts the agent when a customer writes to your WhatsApp number. Needs the app secret, verify token and a Meta webhook.',
        delivery: 'webhook',
        itemsPath: '',
        idField: 'id',
      },
    ];
  }

  /* ------------------------------------------------------------- actions -- */

  getActions(): AppActionDefinition[] {
    const optIn = {
      type: 'boolean',
      description: 'Confirm the customer agreed to receive WhatsApp messages from you. Required by WhatsApp’s policy; sends are refused without it.',
    };
    return [
      {
        id: 'get_phone_number',
        label: 'Get number status',
        description: 'Show the business number’s name and quality rating.',
        inputSchema: { type: 'object', properties: {} },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_templates',
        label: 'List message templates',
        description: 'List approved message templates (the only messages allowed outside the 24-hour window).',
        inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['APPROVED', 'PENDING', 'REJECTED'] }, limit: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'send_template_message',
        label: 'Send template message',
        description: 'Send an approved template to a customer, filling its {{1}}, {{2}}… placeholders in order.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'The customer’s phone number with country code.' },
            templateName: { type: 'string' },
            languageCode: { type: 'string', description: 'For example en_US. Defaults to en_US.' },
            bodyParameters: { type: 'array', items: { type: 'string' }, description: 'Values for the body placeholders, in order.' },
            customerOptedIn: optIn,
          },
          required: ['to', 'templateName', 'customerOptedIn'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'send_text_message',
        label: 'Send text reply',
        description: 'Send a free-form message. WhatsApp only delivers it within 24 hours of the customer’s last message.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'The customer’s phone number with country code.' },
            text: { type: 'string' },
            customerOptedIn: optIn,
          },
          required: ['to', 'text', 'customerOptedIn'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const auth = readAuth(credential.accessToken);
    try {
      switch (actionId) {
        case 'get_phone_number': {
          const { data } = await this.call(auth, 'GET', `/${encodeURIComponent(auth.phoneNumberId)}`, {
            params: { fields: 'display_phone_number,verified_name,quality_rating,messaging_limit_tier' },
          });
          return { success: true, message: 'Fetched the number’s status.', data };
        }
        case 'list_templates': {
          if (!auth.businessAccountId) {
            return { success: false, message: 'Add the WhatsApp Business Account ID to this connection to list templates.' };
          }
          const { data } = await this.call(auth, 'GET', `/${encodeURIComponent(auth.businessAccountId)}/message_templates`, {
            params: { limit: boundedInt(input['limit'], 25, 1, 100), status: textOf(input['status']) || 'APPROVED' },
          });
          const templates = (data.data ?? []).map((t: any) => ({
            name: t.name,
            language: t.language,
            category: t.category,
            status: t.status,
            body: (t.components ?? []).find((c: any) => c.type === 'BODY')?.text,
          }));
          return { success: true, message: `Found ${templates.length} template(s).`, data: { templates } };
        }
        case 'send_template_message': {
          const to = this.recipient(input);
          const { templateName } = requireText(input, 'templateName');
          const params = Array.isArray(input['bodyParameters']) ? (input['bodyParameters'] as unknown[]).map((v) => String(v ?? '')) : [];
          return await this.send(auth, {
            to,
            type: 'template',
            template: {
              name: templateName,
              language: { code: textOf(input['languageCode']) || 'en_US' },
              ...(params.length ? { components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] } : {}),
            },
          });
        }
        case 'send_text_message': {
          const to = this.recipient(input);
          const { text } = requireText(input, 'text');
          return await this.send(auth, { to, type: 'text', text: { body: text.slice(0, 4096), preview_url: false } });
        }
        default:
          throw new BadRequestException(`Unknown WhatsApp action '${actionId}'.`);
      }
    } catch (error) {
      if (error instanceof ConnectorHttpError) return { success: false, message: describeMetaError(error) };
      throw error;
    }
  }

  /** The recipient, only once the customer’s opt-in has been asserted. */
  private recipient(input: Record<string, unknown>): string {
    if (!isTrue(input['customerOptedIn'])) {
      throw new BadRequestException('WhatsApp only allows messaging customers who agreed to it. Set “customerOptedIn” once you have their consent.');
    }
    const to = toWhatsAppNumber(input['to']);
    if (!to) throw new BadRequestException('“to” must be a phone number with its country code, for example +14155550123.');
    return to;
  }

  private async send(auth: WhatsAppAuth, body: Record<string, unknown>): Promise<AppActionResult> {
    try {
      const { data } = await this.call(auth, 'POST', `/${encodeURIComponent(auth.phoneNumberId)}/messages`, {
        data: { messaging_product: 'whatsapp', recipient_type: 'individual', ...body },
      });
      const id = data.messages?.[0]?.id;
      return { success: true, message: 'WhatsApp message sent.', data: { messageId: id, to: body['to'] } };
    } catch (error) {
      if (error instanceof ConnectorHttpError) return { success: false, message: describeMetaError(error) };
      throw error;
    }
  }
}
