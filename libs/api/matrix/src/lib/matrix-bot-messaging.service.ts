import { Injectable } from '@nestjs/common';
import {
  formatSystemEventFallbackText,
  type StructuredChatMessage,
} from '@org/types';
import { MatrixAdminService } from './matrix-admin.service.js';

/** A human-readable fallback for clients that don't understand a given
 *  structured message type — the same summaries `MatrixClient.sendStructuredMessage`
 *  builds in `@org/matrix-client`, kept in sync deliberately so a room reads the
 *  same way regardless of which side posted the event. */
function fallbackBodyFor(event: StructuredChatMessage): string {
  const body = fallbackText(event);
  return body.length > MAX_FALLBACK_BODY_CHARS
    ? `${body.slice(0, MAX_FALLBACK_BODY_CHARS)}…`
    : body;
}

function fallbackText(event: StructuredChatMessage): string {
  switch (event.type) {
    case 'mie.ai.agent':
      return event.responseText || event.summary || 'AI Agent Response';
    case 'mie.app.response':
      return event.title || 'App Response';
    case 'mie.approval':
      return `Approval Required: ${event.title}`;
    case 'mie.form':
      return `Form: ${event.title}`;
    case 'mie.workflow':
      return `Workflow: ${event.title}`;
    case 'mie.system_event':
      return formatSystemEventFallbackText(event);
    default:
      return 'Application Message';
  }
}

/**
 * Synapse rejects any event over 64 KiB ("event too large"), and a reply whose
 * tools returned scraped pages or search results easily blows past that, so
 * the whole turn failed to post. Tool inputs/outputs are diagnostics shown
 * in a collapsed panel, so they are clipped first; only if that is not enough
 * is the answer itself shortened. The budget leaves room for the fallback
 * body and the relation/envelope around the event.
 */
const MAX_STRUCTURED_BYTES = 24 * 1024;
const MAX_TOOL_DETAIL_CHARS = 1500;
const MAX_FALLBACK_BODY_CHARS = 2000;

function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
}

function clip(value: unknown, maxChars: number): unknown {
  if (value === undefined || value === null) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined || text.length <= maxChars) return value;
  return `${text.slice(0, maxChars)}… (truncated)`;
}

export function fitStructuredEvent(
  event: StructuredChatMessage,
  maxBytes = MAX_STRUCTURED_BYTES,
): StructuredChatMessage {
  if (event.type !== 'mie.ai.agent' || byteSize(event) <= maxBytes)
    return event;

  let fitted = {
    ...event,
    tools: event.tools?.map((tool) => ({
      ...tool,
      input: clip(tool.input, MAX_TOOL_DETAIL_CHARS),
      output: clip(tool.output, MAX_TOOL_DETAIL_CHARS),
    })),
  };
  if (byteSize(fitted) <= maxBytes) return fitted;

  fitted = {
    ...fitted,
    tools: fitted.tools?.map((tool) => ({
      ...tool,
      input: undefined,
      output: undefined,
    })),
  };
  const overflow = byteSize(fitted) - maxBytes;
  if (overflow <= 0 || !fitted.responseText) return fitted;

  const keep = Math.max(0, fitted.responseText.length - overflow - 64);
  return {
    ...fitted,
    responseText: `${fitted.responseText.slice(0, keep)}

… (reply shortened to fit)`,
  };
}

/**
 * Posts structured application messages (an agent's response, an app's card,
 * an approval request) into a Matrix room as a bot identity, from the API.
 *
 * This is the server-side twin of `MatrixClient.sendStructuredMessage` /
 * `updateStructuredMessage` in `@org/matrix-client` — those only ever run
 * client-side, driven by a signed-in human's own session, so agents and apps
 * (which have no browser session of their own) need this to speak at all.
 * The `content` shape is reproduced field-for-field so `extractStructuredEvent`
 * (`packages/matrix-client/src/lib/mappers.ts`) parses either side identically
 * — the entire render pipeline (`MessageRenderer`, the card registry) needs no
 * changes to understand a bot-authored message.
 */
@Injectable()
export class MatrixBotMessagingService {
  constructor(private readonly admin: MatrixAdminService) {}

  /**
   * Posts a plain `m.text` message as a bot identity, returning its event id.
   *
   * For the cases that don't need a structured card — an agent tool posting a
   * status line into a channel, say. The bot must already be a joined member of
   * the room; the caller arranges that (`MatrixAdminService.joinRoomAs`).
   */
  async sendText(
    roomId: string,
    senderMatrixId: string,
    text: string,
    options: { replyToId?: string; threadRootId?: string } = {},
  ): Promise<string> {
    const relatesTo: Record<string, unknown> = {};
    if (options.threadRootId) {
      relatesTo['rel_type'] = 'm.thread';
      relatesTo['event_id'] = options.threadRootId;
      relatesTo['m.in_reply_to'] = {
        event_id: options.replyToId ?? options.threadRootId,
      };
      relatesTo['is_falling_back'] = !options.replyToId;
    } else if (options.replyToId) {
      relatesTo['m.in_reply_to'] = { event_id: options.replyToId };
    }

    return this.admin.sendEventAs(roomId, senderMatrixId, 'm.room.message', {
      msgtype: 'm.text',
      body: text,
      ...(Object.keys(relatesTo).length > 0
        ? { 'm.relates_to': relatesTo }
        : {}),
    });
  }

  /** Posts a new structured message, returning its event id. */
  async sendStructured(
    roomId: string,
    senderMatrixId: string,
    event: StructuredChatMessage,
    options: {
      fallbackBody?: string;
      replyToId?: string;
      threadRootId?: string;
      /**
       * Matrix user ids to highlight — triggers each one's push rules (sound,
       * badge, unread) via Matrix's own notification pipeline, without a
       * room-wide ping. Used by `SystemEventPublisherService` so "you were
       * added to #channel" reaches the person added, respecting their own
       * notification preferences exactly like an `@mention` would (brief §24).
       */
      mentionUserIds?: string[];
    } = {},
  ): Promise<string> {
    event = fitStructuredEvent(event);
    const fallbackBody = options.fallbackBody || fallbackBodyFor(event);

    const relatesTo: Record<string, unknown> = {};
    if (options.threadRootId) {
      relatesTo['rel_type'] = 'm.thread';
      relatesTo['event_id'] = options.threadRootId;
      relatesTo['m.in_reply_to'] = {
        event_id: options.replyToId ?? options.threadRootId,
      };
      relatesTo['is_falling_back'] = !options.replyToId;
    } else if (options.replyToId) {
      relatesTo['m.in_reply_to'] = { event_id: options.replyToId };
    }

    return this.admin.sendEventAs(roomId, senderMatrixId, 'm.room.message', {
      msgtype: event.type,
      body: fallbackBody,
      // One copy only: `extractStructuredEvent` reads `mie_event` first, and
      // every extra copy counts against the 64 KiB event limit.
      mie_event: event,
      ...(Object.keys(relatesTo).length > 0
        ? { 'm.relates_to': relatesTo }
        : {}),
      ...(options.mentionUserIds?.length
        ? { 'm.mentions': { user_ids: options.mentionUserIds } }
        : {}),
    });
  }

  /**
   * Edits an existing structured message in place — an agent turn moving
   * `queued` → `running` → `completed`, a tool call resolving. Matrix's own
   * `/sync` delivers the edit to every open client, which is what lets an
   * agent's progress read as "streaming" without a WebSocket/SSE layer.
   */
  async updateStructured(
    roomId: string,
    senderMatrixId: string,
    eventId: string,
    event: StructuredChatMessage,
    options: { fallbackBody?: string; threadRootId?: string } = {},
  ): Promise<void> {
    event = fitStructuredEvent(event);
    const fallbackBody = options.fallbackBody || fallbackBodyFor(event);

    // Clients apply `m.new_content`; the outer content is only the text
    // fallback, so the event is not repeated there.
    await this.admin.sendEventAs(roomId, senderMatrixId, 'm.room.message', {
      msgtype: event.type,
      body: `* ${fallbackBody}`,
      'm.new_content': {
        msgtype: event.type,
        body: fallbackBody,
        mie_event: event,
      },
      'm.relates_to': {
        rel_type: 'm.replace',
        event_id: eventId,
        ...(options.threadRootId
          ? { 'm.in_reply_to': { event_id: options.threadRootId } }
          : {}),
      },
    });
  }
}
