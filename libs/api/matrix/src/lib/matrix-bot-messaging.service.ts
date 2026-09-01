import { Injectable } from '@nestjs/common';
import type { StructuredChatMessage } from '@org/types';
import { MatrixAdminService } from './matrix-admin.service.js';

/** A human-readable fallback for clients that don't understand a given
 *  structured message type — the same summaries `MatrixClient.sendStructuredMessage`
 *  builds in `@org/matrix-client`, kept in sync deliberately so a room reads the
 *  same way regardless of which side posted the event. */
function fallbackBodyFor(event: StructuredChatMessage): string {
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
    default:
      return 'Application Message';
  }
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
  ): Promise<string> {
    return this.admin.sendEventAs(roomId, senderMatrixId, 'm.room.message', {
      msgtype: 'm.text',
      body: text,
    });
  }

  /** Posts a new structured message, returning its event id. */
  async sendStructured(
    roomId: string,
    senderMatrixId: string,
    event: StructuredChatMessage,
    options: { fallbackBody?: string; replyToId?: string } = {},
  ): Promise<string> {
    const fallbackBody = options.fallbackBody || fallbackBodyFor(event);

    return this.admin.sendEventAs(roomId, senderMatrixId, 'm.room.message', {
      msgtype: event.type,
      body: fallbackBody,
      mie_event: event,
      [event.type]: event,
      'org.onetab.structured_event': event,
      ...(options.replyToId
        ? { 'm.relates_to': { 'm.in_reply_to': { event_id: options.replyToId } } }
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
    options: { fallbackBody?: string } = {},
  ): Promise<void> {
    const fallbackBody = options.fallbackBody || fallbackBodyFor(event);

    await this.admin.sendEventAs(roomId, senderMatrixId, 'm.room.message', {
      msgtype: event.type,
      body: `* ${fallbackBody}`,
      mie_event: event,
      [event.type]: event,
      'org.onetab.structured_event': event,
      'm.new_content': {
        msgtype: event.type,
        body: fallbackBody,
        mie_event: event,
        [event.type]: event,
        'org.onetab.structured_event': event,
      },
      'm.relates_to': { rel_type: 'm.replace', event_id: eventId },
    });
  }
}
