import {
  getAppLogoUrl,
  splitAppConnectionName,
  type Message,
  type SystemActivityEventContent,
  type SystemEventEntity,
} from '@org/types';
import {
  ActionDropdownMenu,
  type EntityAction,
  UserAvatar,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { MessageTime } from '../message-time.js';
import { EntityKindBadge } from '../entity-kind-badge.js';
import { AppLogoAvatar } from '../app-logo-avatar.js';
import { useAiEntity, useAppEntity } from './agent-avatar-context.js';
import {
  Archive,
  ArchiveRestore,
  Bot,
  Copy,
  Hash,
  type LucideIcon,
  MoreHorizontal,
  Pencil,
  Plug,
  PlugZap,
  ShieldCheck,
  Smile,
  Trash2,
  UserMinus,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import {
  MessageToolbarShell,
  ReactionPicker,
  TOOLBAR_BTN,
  TOOLBAR_ICON,
} from '../chat-bubble.js';
import { ReactionBar } from '../reaction-bar.js';

export interface SystemEventCardProps {
  message: Message;
  event: SystemActivityEventContent;
  isHighlighted?: boolean;
  /** Whether the viewer may manage this conversation — gates "Delete event" /
   * "Hide event" in the More menu (brief §12). */
  canManage?: boolean;
  onReact?: (key: string) => void;
  /** A named entity was clicked — the host resolves `kind` to whatever it
   * already uses to open a profile/details view (brief §10, §11). */
  onViewEntity?: (entity: SystemEventEntity) => void;
  onOpenThread?: () => void;
  onDelete?: () => void;
}

// --- icon + badge -----------------------------------------------------------

const EVENT_TYPE_ICONS: Partial<
  Record<SystemActivityEventContent['eventType'], LucideIcon>
> = {
  member_joined: UserRoundCheck,
  member_added: UserPlus,
  member_left: UserRoundX,
  member_removed: UserMinus,
  member_role_changed: ShieldCheck,
  member_promoted: ShieldCheck,
  member_demoted: ShieldCheck,
  app_added: Plug,
  app_removed: Plug,
  app_connected: PlugZap,
  app_disconnected: Plug,
  app_enabled: PlugZap,
  app_disabled: Plug,
  agent_added: Bot,
  agent_removed: Bot,
  agent_joined: Bot,
  agent_left: Bot,
  agent_enabled: Bot,
  agent_disabled: Bot,
  coworker_added: Bot,
  coworker_removed: Bot,
  coworker_enabled: Bot,
  coworker_disabled: Bot,
  conversation_created: Users,
  channel_renamed: Pencil,
  channel_archived: Archive,
  channel_unarchived: ArchiveRestore,
  permissions_changed: ShieldCheck,
};

type EventTone = 'success' | 'danger' | 'info' | 'warning' | 'neutral';

const TONE_CLASSES: Record<EventTone, string> = {
  success: 'bg-success/15 text-success-text',
  danger: 'bg-destructive/10 text-destructive-text',
  info: 'bg-info/15 text-info-text',
  warning: 'bg-warning/15 text-warning-text',
  neutral: 'bg-muted text-muted-foreground',
};

/** Semantic colour for an event: arrivals read green, departures red, state
 * changes blue/amber — so a long run of activity rows is scannable at a glance. */
function getEventTone(
  eventType: SystemActivityEventContent['eventType'],
): EventTone {
  switch (eventType) {
    case 'member_joined':
    case 'member_added':
    case 'app_added':
    case 'app_connected':
    case 'app_enabled':
    case 'agent_added':
    case 'agent_joined':
    case 'agent_enabled':
    case 'coworker_added':
    case 'coworker_enabled':
    case 'channel_unarchived':
    case 'conversation_created':
      return 'success';
    case 'member_left':
    case 'member_removed':
    case 'app_removed':
    case 'app_disconnected':
    case 'app_disabled':
    case 'agent_removed':
    case 'agent_left':
    case 'agent_disabled':
    case 'coworker_removed':
    case 'coworker_disabled':
      return 'danger';
    case 'channel_archived':
    case 'permissions_changed':
      return 'warning';
    case 'member_role_changed':
    case 'member_promoted':
    case 'member_demoted':
    case 'channel_renamed':
    case 'channel_description_updated':
      return 'info';
    default:
      return 'neutral';
  }
}

/** A small circular, tone-tinted marker for the event's own icon. It sits
 * inline before the sentence; the gutter is reserved for the entity avatar so
 * activity rows line up with message rows (brief §9, §21 `<SystemEventIcon>`). */
export function SystemEventIcon({
  eventType,
}: {
  eventType: SystemActivityEventContent['eventType'];
}) {
  const Icon = EVENT_TYPE_ICONS[eventType] ?? Hash;
  return (
    <span
      aria-hidden
      className={cn(
        'size-5 flex shrink-0 items-center justify-center rounded-full',
        TONE_CLASSES[getEventTone(eventType)],
      )}
    >
      <Icon className="size-3" />
    </span>
  );
}

/** The `APP` / `AI AGENT` / `AI COWORKER` type indicator (brief §10) — the
 * exact badges `ChatBubble` shows next to a sender. Absent for a plain user or
 * channel — those need no disambiguating badge. */
export function SystemEventEntityBadge({
  kind,
}: {
  kind: SystemEventEntity['kind'];
}) {
  if (kind === 'coworker' || kind === 'agent' || kind === 'app') {
    return <EntityKindBadge kind={kind} />;
  }
  return null;
}

/** One named entity (a user, app, agent, coworker or channel), clickable when
 * the host can open something for it and not a deleted/unknown row (brief
 * §10, §20). Shared by the actor and the target — an "entity" either way. */
const ENTITY_NAME_WEIGHT_CLASS: Record<'medium' | 'semibold' | 'bold', string> =
  {
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

export function SystemEventEntityName({
  entity,
  onClick,
  className,
  weight = 'medium',
}: {
  entity: SystemEventEntity;
  onClick?: (entity: SystemEventEntity) => void;
  className?: string;
  weight?: 'medium' | 'semibold' | 'bold';
}) {
  const clickable = !!onClick && !entity.isDeleted && entity.id;
  const label = entity.isDeleted
    ? `Deleted ${entityKindLabel(entity.kind)}`
    : entity.name;
  const weightClass = ENTITY_NAME_WEIGHT_CLASS[weight];

  if (!clickable) {
    return (
      <span className={cn('leading-5', weightClass, className)}>{label}</span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(entity)}
      className={cn(
        'leading-5 rounded-sm text-left hover:underline focus-visible:underline focus-visible:outline-none',
        weightClass,
        className,
      )}
    >
      {label}
    </button>
  );
}

function entityKindLabel(kind: SystemEventEntity['kind']): string {
  switch (kind) {
    case 'app':
      return 'app';
    case 'agent':
      return 'AI agent';
    case 'coworker':
      return 'AI coworker';
    case 'channel':
      return 'channel';
    default:
      return 'user';
  }
}

/**
 * Normalize an app entity for display. Events posted before the API began
 * snapshotting a clean app name carry the raw connection name
 * (`"Asana · balram"`) and no logo, so the split + static-logo lookup happens
 * here too — old and new rows render identically.
 */
export function normalizeSystemEventEntity(
  entity: SystemEventEntity,
): SystemEventEntity {
  if (entity.kind !== 'app' || entity.isDeleted) return entity;
  const { appName, accountLabel } = splitAppConnectionName(entity.name);
  return {
    ...entity,
    name: appName || entity.name,
    accountLabel: entity.accountLabel ?? accountLabel,
    avatarUrl: entity.avatarUrl ?? getAppLogoUrl(entity.provider, appName),
  };
}

/**
 * The entity as it is *now*: a renamed app/agent/coworker shows its current
 * name and logo from the API (via the host's live resolvers), falling back to
 * the snapshot the event was posted with when the row is gone or unknown.
 */
export function useLiveSystemEventEntity(
  entity: SystemEventEntity | null,
): SystemEventEntity | null {
  const isApp = entity?.kind === 'app' && !entity.isDeleted;
  const isAi =
    (entity?.kind === 'agent' || entity?.kind === 'coworker') &&
    !entity.isDeleted;
  const liveApp = useAppEntity(isApp ? (entity?.id ?? undefined) : undefined);
  const liveAi = useAiEntity(isAi ? (entity?.id ?? undefined) : undefined);
  if (!entity) return null;
  if (isApp) {
    const base = normalizeSystemEventEntity(entity);
    return liveApp
      ? {
          ...base,
          name: liveApp.name,
          avatarUrl: liveApp.logoUrl ?? base.avatarUrl,
          accountLabel: liveApp.accountLabel,
          provider: liveApp.provider,
        }
      : base;
  }
  if (isAi && liveAi) {
    return {
      ...entity,
      name: liveAi.name,
      avatarUrl: liveAi.avatarUrl ?? entity.avatarUrl,
    };
  }
  return entity;
}

/** Small avatar/icon for one entity — a photo for a user, a gradient tile for
 * an app/agent/coworker (via the existing avatar system's seeded gradient),
 * or a plain `#` glyph for a channel, which has no avatar of its own. */
export function SystemEventEntityAvatar({
  entity,
}: {
  entity: SystemEventEntity;
}) {
  if (entity.kind === 'channel') {
    return (
      <span className="size-10 flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Hash className="size-4" />
      </span>
    );
  }
  if (entity.kind === 'app') {
    return <AppLogoAvatar logoUrl={entity.avatarUrl} />;
  }
  return (
    <UserAvatar
      name={entity.name}
      src={entity.avatarUrl}
      seed={entity.id ?? entity.name}
      size="md"
      className={cn(
        'size-10 rounded-full shadow-xs',
        entity.kind === 'agent' && 'ring-2 ring-primary/40',
      )}
      indicator={false}
    />
  );
}

// --- the sentence ------------------------------------------------------------

interface SentenceParts {
  /** Text before the actor mention (or the whole sentence, when `withActor`
   * is false — e.g. "joined #general"). */
  lead: string;
  /** Whether to append "by {actor}" — false for self-driven lifecycle events
   * (a member joining/leaving of their own accord) where naming an "actor"
   * would just repeat the target (brief §6, §7). */
  withActor: boolean;
}

function getSentenceParts(event: SystemActivityEventContent): SentenceParts {
  const inConversation =
    event.conversationType === 'channel' && event.conversationName
      ? `#${event.conversationName}`
      : 'this conversation';

  switch (event.eventType) {
    case 'member_joined':
      return { lead: `joined ${inConversation}`, withActor: false };
    case 'member_left':
      return { lead: `left ${inConversation}`, withActor: false };
    case 'member_added':
      return { lead: `was added to ${inConversation}`, withActor: true };
    case 'member_removed':
      return { lead: `was removed from ${inConversation}`, withActor: true };
    case 'member_role_changed':
    case 'member_promoted':
    case 'member_demoted':
      return {
        lead: `had their role changed in ${inConversation}`,
        withActor: true,
      };
    case 'app_added':
      return { lead: `was added to ${inConversation}`, withActor: true };
    case 'app_removed':
      return { lead: `was removed from ${inConversation}`, withActor: true };
    case 'app_connected':
      return { lead: 'was connected', withActor: true };
    case 'app_disconnected':
      return { lead: 'was disconnected', withActor: true };
    case 'app_enabled':
      return { lead: `was enabled in ${inConversation}`, withActor: true };
    case 'app_disabled':
      return { lead: `was disabled in ${inConversation}`, withActor: true };
    case 'agent_added':
    case 'coworker_added':
      return { lead: `was added to ${inConversation}`, withActor: true };
    case 'agent_removed':
    case 'coworker_removed':
      return { lead: `was removed from ${inConversation}`, withActor: true };
    case 'agent_joined':
      return { lead: `joined ${inConversation}`, withActor: false };
    case 'agent_left':
      return { lead: `left ${inConversation}`, withActor: false };
    case 'agent_enabled':
    case 'coworker_enabled':
      return { lead: `was enabled in ${inConversation}`, withActor: true };
    case 'agent_disabled':
    case 'coworker_disabled':
      return { lead: `was disabled in ${inConversation}`, withActor: true };
    case 'channel_renamed':
      return { lead: 'renamed this channel', withActor: true };
    case 'conversation_created':
      return {
        lead: event.secondaryTarget?.name
          ? `created this group conversation with ${event.secondaryTarget.name}`
          : 'created this group conversation',
        withActor: true,
      };
    case 'channel_archived':
      return { lead: `archived ${inConversation}`, withActor: true };
    case 'channel_unarchived':
      return { lead: `restored ${inConversation}`, withActor: true };
    case 'channel_description_updated':
      return { lead: 'updated the channel description', withActor: true };
    case 'permissions_changed':
      return { lead: 'had permissions changed', withActor: true };
    default:
      return { lead: 'was updated', withActor: true };
  }
}

/**
 * The sentence line — "was added to #agent45 by VR", "joined #engineering" —
 * built from the same template every locale-aware fallback body uses
 * (`formatSystemEventFallbackText` in `@org/types`), just rendered as JSX so
 * the actor stays a clickable name instead of flattened text (brief §21
 * `<SystemEventAction>`/`<SystemEventContext>`).
 */
export function SystemEventAction({
  event,
  onViewEntity,
}: {
  event: SystemActivityEventContent;
  onViewEntity?: (entity: SystemEventEntity) => void;
}) {
  const { lead, withActor } = getSentenceParts(event);
  const actor = useLiveSystemEventEntity(event.actor);

  return (
    <p className="m-0 text-sm leading-5 text-muted-foreground">
      {event.eventType === 'channel_renamed' && event.target ? (
        <>
          renamed this channel to{' '}
          <SystemEventEntityName
            entity={{ ...event.target, kind: 'channel' }}
            className="text-foreground"
          />
        </>
      ) : (
        lead
      )}
      {withActor && actor ? (
        <>
          {' by '}
          <SystemEventEntityName
            entity={actor}
            onClick={onViewEntity}
            className="text-foreground"
          />
        </>
      ) : null}
    </p>
  );
}

/** Thin timestamp wrapper matching `ChatBubble`'s own — same tooltip, same
 * relative/absolute formatting, so a system event reads like any other
 * timeline row (brief §9, §21 `<SystemEventTimestamp>`). */
export function SystemEventTimestamp({ timestamp }: { timestamp: number }) {
  return (
    <MessageTime
      timestamp={timestamp}
      className="font-medium text-xs shrink-0 cursor-pointer text-muted-foreground hover:underline"
    />
  );
}

// --- actions -------------------------------------------------------------------

/** The hover toolbar — reactions (when the event type allows them) plus the
 * same "⋯" menu every message row has. Reuses the exact reaction infrastructure
 * every other message uses (`onReact` → the same backend/Matrix reaction path
 * `ChatBubble` calls), never a second implementation (brief §13). */
function SystemEventActions({
  message,
  event,
  onReact,
  onCopy,
  onDelete,
}: {
  message: Message;
  event: SystemActivityEventContent;
  onReact?: (key: string) => void;
  onCopy: () => void;
  onDelete?: () => void;
}) {
  const [isReactionOpen, setIsReactionOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const showReact = event.capabilities.reactions && onReact;

  const buildActions = (): EntityAction[] => [
    {
      id: 'copy-text',
      group: 'share',
      label: 'Copy event',
      icon: Copy,
      run: onCopy,
    },
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete event…',
      icon: Trash2,
      destructive: true,
      hidden: !onDelete,
      run: onDelete,
    },
  ];

  return (
    <MessageToolbarShell visible={isReactionOpen || isMenuOpen}>
      {showReact ? (
        <ReactionPicker
          onSelect={onReact}
          open={isReactionOpen}
          onOpenChange={setIsReactionOpen}
        >
          <button aria-label="Add a reaction" className={TOOLBAR_BTN}>
            <Smile className={cn(TOOLBAR_ICON, 'group-hover/btn:rotate-12')} />
          </button>
        </ReactionPicker>
      ) : null}
      <ActionDropdownMenu
        open={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        actions={buildActions}
        entityType="message"
        entity={message}
        scope={`message:${message.id}`}
        contentClassName="w-56"
        trigger={
          <button
            aria-label="More actions"
            className={cn(
              TOOLBAR_BTN,
              isMenuOpen && 'bg-foreground/[0.06] text-foreground',
            )}
          >
            <MoreHorizontal className={TOOLBAR_ICON} />
          </button>
        }
      />
    </MessageToolbarShell>
  );
}

// --- the card ----------------------------------------------------------------

/**
 * `<SystemEvent>` — the unified activity/system-event timeline row (brief
 * §9, §21). Every lifecycle event (member join/leave/add/remove, app/agent/
 * coworker add/remove/enable/disable, channel rename/archive) renders through
 * this one component; only the sentence and icon vary per `eventType`, so a
 * new event type never needs a new UI implementation — just a case in
 * `getSentenceParts`/`EVENT_TYPE_ICONS` above.
 */
export function SystemEventCard({
  message,
  event,
  isHighlighted = false,
  canManage = false,
  onReact,
  onViewEntity,
  onDelete,
}: SystemEventCardProps) {
  const primaryEntity = useLiveSystemEventEntity(event.target ?? event.actor);

  const handleCopyEvent = () => {
    void navigator.clipboard
      ?.writeText(message.body)
      .then(() => toast.success('Event copied'));
  };

  return (
    <article
      data-message-id={message.id}
      aria-label={message.body}
      className={cn(
        'group/message min-h-11 gap-4 px-4 py-1.5 text-sm relative flex items-center transition-colors hover:bg-accent/60',
        isHighlighted && 'border-l-2 border-l-primary',
      )}
    >
      <div className="w-10 flex shrink-0 justify-center self-start">
        {primaryEntity ? (
          <SystemEventEntityAvatar entity={primaryEntity} />
        ) : (
          <SystemEventIcon eventType={event.eventType} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {primaryEntity ? (
          <header className="gap-2 flex items-baseline">
            <SystemEventEntityName
              entity={primaryEntity}
              onClick={onViewEntity}
              weight="bold"
              className="text-message text-foreground"
            />
            <span
              title={
                primaryEntity.accountLabel
                  ? `Connected as ${primaryEntity.accountLabel}`
                  : undefined
              }
            >
              <SystemEventEntityBadge kind={primaryEntity.kind} />
            </span>
            <SystemEventTimestamp
              timestamp={event.occurredAt || message.timestamp}
            />
          </header>
        ) : null}
        <div className="gap-1.5 flex items-center">
          {primaryEntity ? (
            <SystemEventIcon eventType={event.eventType} />
          ) : null}
          <SystemEventAction event={event} onViewEntity={onViewEntity} />
          {primaryEntity ? null : (
            <SystemEventTimestamp
              timestamp={event.occurredAt || message.timestamp}
            />
          )}
        </div>
        {message.reactions.length > 0 ? (
          <div className="mt-1">
            <ReactionBar
              reactions={message.reactions}
              onToggle={onReact ? (key) => onReact(key) : undefined}
            />
          </div>
        ) : null}
      </div>

      <SystemEventActions
        message={message}
        event={event}
        onReact={onReact}
        onCopy={handleCopyEvent}
        onDelete={canManage ? onDelete : undefined}
      />
    </article>
  );
}
