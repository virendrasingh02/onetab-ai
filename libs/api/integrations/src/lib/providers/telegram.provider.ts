import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface TelegramAuth extends Record<string, string> {
  botToken: string;
}

const compactUpdate = (u: any) => {
  const m = u.message ?? u.edited_message ?? u.channel_post ?? {};
  return {
    update_id: u.update_id,
    chatId: m.chat?.id ?? null,
    chatTitle: m.chat?.title ?? m.chat?.username ?? m.chat?.first_name ?? null,
    from: m.from ? (m.from.username ?? m.from.first_name ?? String(m.from.id)) : null,
    text: m.text ?? m.caption ?? '',
    messageId: m.message_id ?? null,
    date: m.date ? new Date(m.date * 1000).toISOString() : null,
  };
};

/**
 * Telegram Bot API with a bot token from @BotFather. Incoming messages are read
 * with `getUpdates`, which only works while the bot has no webhook set.
 */
@Injectable()
export class TelegramProvider extends RestConnector<TelegramAuth> {
  readonly providerId = 'TELEGRAM';
  protected readonly app = 'Telegram';
  protected readonly requiredFields = ['botToken'] as const;
  protected readonly secrets = ['botToken'];

  protected capabilities() {
    return {
      displayName: 'Telegram',
      description: 'Bot conversations and agent commands — read messages sent to your bot and reply in any chat it is in.',
      category: 'Communication',
      connectorCategory: 'communication',
      authType: 'API_KEY_HEADER' as const,
      scopes: [
        { scope: 'read', description: 'Read messages sent to the bot', required: true },
        { scope: 'send', description: 'Send messages as the bot (each asks for approval)' },
      ],
      credentialFields: [{ key: 'botToken', label: 'Bot token', secret: true, placeholder: '123456:ABC-DEF…', help: 'Message @BotFather on Telegram → /newbot (or /token for an existing bot).' }],
    };
  }

  protected override validate(auth: TelegramAuth) {
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(auth.botToken)) throw new BadRequestException('That doesn’t look like a Telegram bot token (123456:ABC…).');
  }

  protected target(auth: TelegramAuth) {
    return { baseUrl: `https://api.telegram.org/bot${auth.botToken}` };
  }

  /** Telegram wraps every reply in `{ ok, result }`. */
  private static result<T = any>(data: any): T {
    if (!data?.ok) throw new BadRequestException(`Telegram: ${data?.description ?? 'request failed'}`);
    return data.result as T;
  }

  protected async ping(_auth: TelegramAuth, call: RestCall) {
    const me = TelegramProvider.result(await call('GET', '/getMe'));
    return { label: `@${me.username}`, accountId: String(me.id) };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [{ id: 'new_message', label: 'New message to the bot', description: 'Starts the agent for each message people send to the bot.', pollActionId: 'get_updates', itemsPath: 'updates', idField: 'update_id' }];
  }

  protected actions(): RestAction<TelegramAuth>[] {
    const chatId = str('Chat id (a number) or @channelusername.');
    return [
      action({ id: 'get_updates', label: 'Get new messages', description: 'Recent messages people sent to the bot (the last 24 hours).', level: 'read', properties: { limit: num('Max updates (default 25).') } }, async ({ input, call }) => {
        const result = TelegramProvider.result<any[]>(await call('GET', '/getUpdates', { params: { limit: boundedInt(input['limit'], 25, 1, 100), allowed_updates: JSON.stringify(['message', 'edited_message', 'channel_post']) } }));
        const updates = result.map(compactUpdate);
        return { message: `Found ${updates.length} update(s).`, data: { updates } };
      }),
      action({ id: 'get_chat', label: 'Get chat', description: 'Details about a chat the bot is in.', level: 'read', properties: { chatId }, required: ['chatId'] }, async ({ input, call }) => {
        const { chatId } = requireText(input, 'chatId');
        const c = TelegramProvider.result(await call('GET', '/getChat', { params: { chat_id: chatId } }));
        return { message: 'Fetched the chat.', data: { chat: { id: c.id, type: c.type, title: c.title ?? c.username ?? c.first_name ?? null, description: c.description ?? null } } };
      }),
      action(
        { id: 'send_message', label: 'Send message', description: 'Send a text message as the bot.', level: 'write', properties: { chatId, text: str('Message text (up to 4096 characters).'), replyToMessageId: num('Reply to this message id.') }, required: ['chatId', 'text'] },
        async ({ input, call }) => {
          const { chatId, text } = requireText(input, 'chatId', 'text');
          if (text.length > 4096) throw new BadRequestException('Telegram messages are limited to 4096 characters.');
          const m = TelegramProvider.result(await call('POST', '/sendMessage', { data: compactObject({ chat_id: chatId, text, reply_to_message_id: input['replyToMessageId'] }) }));
          return { message: 'Message sent.', data: { messageId: m.message_id, chatId: m.chat?.id } };
        },
      ),
      action(
        { id: 'send_photo', label: 'Send photo', description: 'Send a photo from a public URL.', level: 'write', properties: { chatId, photoUrl: str('Public https URL of the image.'), caption: str('Caption.') }, required: ['chatId', 'photoUrl'] },
        async ({ input, call }) => {
          const { chatId, photoUrl } = requireText(input, 'chatId', 'photoUrl');
          if (!/^https:\/\//i.test(photoUrl)) throw new BadRequestException('photoUrl must be an https URL.');
          const m = TelegramProvider.result(await call('POST', '/sendPhoto', { data: compactObject({ chat_id: chatId, photo: photoUrl, caption: textOf(input['caption']) }) }));
          return { message: 'Photo sent.', data: { messageId: m.message_id } };
        },
      ),
    ];
  }
}
