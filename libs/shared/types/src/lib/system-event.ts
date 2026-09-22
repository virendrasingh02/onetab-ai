/**
 * The unified System/Activity Event architecture.
 *
 * A `SystemActivityEventContent` is one more `StructuredChatMessage` variant
 * (`chat.ts`) — it rides the exact same Matrix room, timeline, pagination,
 * reaction and realtime-sync pipeline as every other message, posted by a
 * bot identity via `MatrixBotMessagingService`/`MatrixClient.sendStructuredMessage`
 * (see `@org/api-matrix`'s `SystemEventPublisherService`). There is
 * deliberately no separate `SystemEvent` database table: Matrix is already
 * this platform's persisted, ordered, realtime conversation timeline, so a
 * membership change, an app being added, or an agent joining a channel is
 * "just another message" the existing pipeline already knows how to store,
 * sync, paginate and react to.
 *
 * Producers never fabricate one of these directly from a client — they are
 * always the result of a successful domain operation (`ChannelService`,
 * `AgentsService`, `CoworkersService`, `IntegrationsService`, …) emitting an
 * `AppEvent` that `SystemEventsListener` turns into exactly one timeline
 * post (brief §22, §30).
 */

/** Which kind of conversation an event occurred in (brief §2). */
export type SystemEventConversationType =
  | 'channel'
  | 'dm'
  | 'group_dm'
  | 'ai_agent'
  | 'app'
  | 'coworker';

/**
 * Every lifecycle event the architecture understands (brief §1). New event
 * types are additive — nothing here is ever renamed once shipped, since the
 * `eventType` string is persisted (in Matrix) forever.
 */
export type SystemEventType =
  | 'member_joined'
  | 'member_left'
  | 'member_added'
  | 'member_removed'
  | 'member_role_changed'
  | 'member_promoted'
  | 'member_demoted'
  | 'app_added'
  | 'app_removed'
  | 'app_connected'
  | 'app_disconnected'
  | 'app_enabled'
  | 'app_disabled'
  | 'agent_added'
  | 'agent_removed'
  | 'agent_joined'
  | 'agent_left'
  | 'agent_enabled'
  | 'agent_disabled'
  | 'coworker_added'
  | 'coworker_removed'
  | 'coworker_enabled'
  | 'coworker_disabled'
  | 'channel_created'
  | 'channel_renamed'
  | 'channel_archived'
  | 'channel_unarchived'
  | 'channel_description_updated'
  | 'permissions_changed'
  | 'conversation_created'
  | 'conversation_archived'
  | 'conversation_restored'
  | 'custom';

export type SystemEventEntityKind = 'user' | 'app' | 'agent' | 'coworker' | 'channel';

/**
 * A denormalized snapshot of who/what an event names, resolved once at post
 * time. IDs are the source of truth for a *live* lookup ("open this app's
 * details"), but the label the event renders always comes from this snapshot
 * — so a later rename never rewrites history, and a later delete/deactivate
 * degrades to `isDeleted` rather than a broken or missing name (brief §19–20).
 */
export interface SystemEventEntity {
  kind: SystemEventEntityKind;
  /** Our own row id. Null only for an entity the platform never had a row for
   * (e.g. a bare display name recovered from a stale Matrix membership). */
  id: string | null;
  name: string;
  avatarUrl?: string;
  /** True once the underlying row is gone/deactivated at render time. */
  isDeleted?: boolean;
  /** `kind: 'app'` only — the integration's provider key, for icon lookup. */
  provider?: string;
}

/** Which of the existing message interactions make sense for one event type
 * (brief §14). Reused verbatim by `getSystemEventActions` on the client. */
export interface SystemEventCapabilities {
  reactions: boolean;
  threading: boolean;
  sharing: boolean;
  reply: boolean;
}

/**
 * Event types worth letting people discuss inline — anything that changes
 * *what's in the room* (a member, an app, an agent, a permission) rather than
 * a one-line lifecycle blip (someone leaving, a rename).
 */
const THREADABLE_EVENT_TYPES = new Set<SystemEventType>([
  'member_added',
  'app_added',
  'app_connected',
  'agent_added',
  'coworker_added',
  'permissions_changed',
  'member_role_changed',
  'member_promoted',
  'member_demoted',
]);

/** Default capability matrix for an event type (brief §14). */
export function getSystemEventCapabilities(
  eventType: SystemEventType,
): SystemEventCapabilities {
  return {
    reactions: true,
    threading: THREADABLE_EVENT_TYPES.has(eventType),
    sharing: true,
    // A system event is never itself an inline reply target — "reply" here
    // would mean quoting it, which doesn't read as a sentence.
    reply: false,
  };
}

/**
 * The structured content one system/activity event carries as a Matrix
 * message (`StructuredChatMessage` variant `mie.system_event`).
 */
export interface SystemActivityEventContent {
  type: 'mie.system_event';
  version?: string;
  eventType: SystemEventType;
  conversationType: SystemEventConversationType;
  conversationId: string;
  conversationName?: string;
  workspaceId?: string;
  /** Who performed the action. Null for a system-initiated event (a cron
   * sweep expiring a temporary membership, say) — never fabricated. */
  actor: SystemEventEntity | null;
  /** What the action targets — the member/app/agent/coworker in question. */
  target: SystemEventEntity | null;
  /** A second entity the sentence names, e.g. a role granted alongside a member. */
  secondaryTarget?: SystemEventEntity | null;
  /** Extra, non-sensitive rendering/audit context. Never credentials, tokens,
   * or anything from `ExternalIntegration.configJson`/`encryptedAccessToken`. */
  metadata?: Record<string, unknown>;
  /** Ms since epoch — the actual domain-operation time, independent of
   * whatever timestamp Matrix itself stamps the event with. */
  occurredAt: number;
  /** Dedupe key so retries/duplicate emits never post the same fact twice
   * (brief §30) — see `SystemEventPublisherService`. */
  idempotencyKey: string;
  capabilities: SystemEventCapabilities;
}

/**
 * Plain-English fallback sentence for a system event — the Matrix `body`
 * clients without the renderer fall back to, and the base every localized
 * `systemEvents.*` string in `@org/i18n` mirrors (kept deliberately in sync,
 * the same way `matrix-bot-messaging.service.ts`'s `fallbackBodyFor` mirrors
 * `MatrixClient.sendStructuredMessage`'s client-side summaries).
 */
export function formatSystemEventFallbackText(
  event: Pick<
    SystemActivityEventContent,
    'eventType' | 'actor' | 'target' | 'secondaryTarget' | 'conversationName' | 'conversationType'
  >,
): string {
  const actorName = event.actor?.name ?? 'Someone';
  const targetName = event.target?.name ?? 'Something';
  const secondaryName = event.secondaryTarget?.name;
  const inConversation =
    event.conversationType === 'channel' && event.conversationName
      ? `#${event.conversationName}`
      : 'this conversation';

  switch (event.eventType) {
    case 'member_joined':
      return `${targetName} joined ${inConversation}`;
    case 'member_left':
      return `${targetName} left ${inConversation}`;
    case 'member_added':
      return `${targetName} was added to ${inConversation} by ${actorName}`;
    case 'member_removed':
      return `${targetName} was removed from ${inConversation} by ${actorName}`;
    case 'member_role_changed':
      return secondaryName
        ? `${actorName} changed ${targetName}'s role to ${secondaryName}`
        : `${actorName} changed ${targetName}'s role`;
    case 'member_promoted':
      return `${actorName} promoted ${targetName}${secondaryName ? ` to ${secondaryName}` : ''}`;
    case 'member_demoted':
      return `${actorName} demoted ${targetName}${secondaryName ? ` to ${secondaryName}` : ''}`;
    case 'app_added':
      return `${targetName} app was added to ${inConversation} by ${actorName}`;
    case 'app_removed':
      return `${targetName} app was removed from ${inConversation} by ${actorName}`;
    case 'app_connected':
      return `${targetName} app was connected by ${actorName}`;
    case 'app_disconnected':
      return `${targetName} app was disconnected by ${actorName}`;
    case 'app_enabled':
      return `${actorName} enabled the ${targetName} app in ${inConversation}`;
    case 'app_disabled':
      return `${actorName} disabled the ${targetName} app in ${inConversation}`;
    case 'agent_added':
      return `${targetName} was added to ${inConversation} by ${actorName}`;
    case 'agent_removed':
      return `${targetName} was removed from ${inConversation} by ${actorName}`;
    case 'agent_joined':
      return `${targetName} joined ${inConversation}`;
    case 'agent_left':
      return `${targetName} left ${inConversation}`;
    case 'agent_enabled':
      return `${actorName} enabled ${targetName} in ${inConversation}`;
    case 'agent_disabled':
      return `${actorName} disabled ${targetName} in ${inConversation}`;
    case 'coworker_added':
      return `${targetName} was added to ${inConversation} by ${actorName}`;
    case 'coworker_removed':
      return `${targetName} was removed from ${inConversation} by ${actorName}`;
    case 'coworker_enabled':
      return `${actorName} enabled ${targetName} in ${inConversation}`;
    case 'coworker_disabled':
      return `${actorName} disabled ${targetName} in ${inConversation}`;
    case 'channel_created':
      return `${actorName} created ${inConversation}`;
    case 'conversation_created':
      return secondaryName
        ? `${actorName} created this group conversation with ${secondaryName}`
        : `${actorName} created this group conversation`;
    case 'channel_renamed':
      return `${actorName} renamed this channel to #${targetName}`;
    case 'channel_archived':
      return `${actorName} archived ${inConversation}`;
    case 'channel_unarchived':
      return `${actorName} restored ${inConversation}`;
    case 'channel_description_updated':
      return `${actorName} updated the channel description`;
    case 'permissions_changed':
      return `${actorName} changed permissions for ${targetName}`;
    case 'conversation_created':
      return `${actorName} started this conversation`;
    case 'conversation_archived':
      return `${actorName} archived this conversation`;
    case 'conversation_restored':
      return `${actorName} restored this conversation`;
    case 'custom':
    default:
      return `${actorName} updated ${targetName}`;
  }
}
