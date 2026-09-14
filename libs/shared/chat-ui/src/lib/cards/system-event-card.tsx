import type {
  Message,
  SystemActivityEventContent,
  SystemEventEntity,
} from '@org/types';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  UserAvatar,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
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
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ReactionPicker, formatFullTimestamp, formatShortTimestamp } from '../chat-bubble.js';

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

const EVENT_TYPE_ICONS: Partial<Record<SystemActivityEventContent['eventType'], LucideIcon>> = {
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
  channel_renamed: Pencil,
  channel_archived: Archive,
  channel_unarchived: ArchiveRestore,
  permissions_changed: ShieldCheck,
};

/** A small circular marker for the event's own icon — separate from the
 * target's avatar, the way a Slack-style activity row pairs a glyph with a
 * photo (brief §9, §21 `<SystemEventIcon>`). */
export function SystemEventIcon({
  eventType,
}: {
  eventType: SystemActivityEventContent['eventType'];
}) {
  const Icon = EVENT_TYPE_ICONS[eventType] ?? Hash;
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
    >
      <Icon className="size-3.5" />
    </span>
  );
}

const ENTITY_BADGE_LABEL: Partial<Record<SystemEventEntity['kind'], string>> = {
  app: 'APP',
  agent: 'AI AGENT',
  coworker: 'AI COWORKER',
};

/** The `APP` / `AI AGENT` / `AI COWORKER` type indicator (brief §10). Absent
 * for a plain user or channel — those need no disambiguating badge. */
export function SystemEventEntityBadge({ kind }: { kind: SystemEventEntity['kind'] }) {
  const label = ENTITY_BADGE_LABEL[kind];
  if (!label) return null;
  return (
    <Badge variant="neutral" className="h-4 px-1.5 text-[9px] font-semibold tracking-wide">
      {label}
    </Badge>
  );
}

/** One named entity (a user, app, agent, coworker or channel), clickable when
 * the host can open something for it and not a deleted/unknown row (brief
 * §10, §20). Shared by the actor and the target — an "entity" either way. */
export function SystemEventEntityName({
  entity,
  onClick,
  className,
  weight = 'medium',
}: {
  entity: SystemEventEntity;
  onClick?: (entity: SystemEventEntity) => void;
  className?: string;
  weight?: 'medium' | 'semibold';
}) {
  const clickable = !!onClick && !entity.isDeleted && entity.id;
  const label = entity.isDeleted ? `Deleted ${entityKindLabel(entity.kind)}` : entity.name;

  if (!clickable) {
    return (
      <span className={cn(weight === 'semibold' ? 'font-semibold' : 'font-medium', className)}>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(entity)}
      className={cn(
        'rounded-sm text-left hover:underline focus-visible:underline focus-visible:outline-none',
        weight === 'semibold' ? 'font-semibold' : 'font-medium',
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

/** Small avatar/icon for one entity — a photo for a user, a gradient tile for
 * an app/agent/coworker (via the existing avatar system's seeded gradient),
 * or a plain `#` glyph for a channel, which has no avatar of its own. */
export function SystemEventEntityAvatar({ entity }: { entity: SystemEventEntity }) {
  if (entity.kind === 'channel') {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Hash className="size-4" />
      </span>
    );
  }
  return (
    <UserAvatar
      name={entity.name}
      src={entity.avatarUrl}
      seed={entity.id ?? entity.name}
      size="sm"
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
      return { lead: `had their role changed in ${inConversation}`, withActor: true };
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
  const actor = event.actor;

  return (
    <p className="text-sm text-muted-foreground">
      {event.eventType === 'channel_renamed' && event.target ? (
        <>
          renamed this channel to{' '}
          <SystemEventEntityName entity={{ ...event.target, kind: 'channel' }} className="text-foreground" />
        </>
      ) : (
        lead
      )}
      {withActor && actor ? (
        <>
          {' by '}
          <SystemEventEntityName entity={actor} onClick={onViewEntity} className="text-foreground" />
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
    <Hint label={formatFullTimestamp(timestamp)}>
      <time
        dateTime={new Date(timestamp).toISOString()}
        className="shrink-0 cursor-default text-[11px] text-muted-foreground tabular-nums"
      >
        {formatShortTimestamp(timestamp)}
      </time>
    </Hint>
  );
}

// --- actions / more menu -----------------------------------------------------

export interface SystemEventActionDescriptor {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
}

export interface SystemEventActionsContext {
  canManage?: boolean;
  onViewEntity?: (entity: SystemEventEntity) => void;
  onCopyEvent?: () => void;
  onDelete?: () => void;
}

/**
 * The More-menu entries for one event — dynamically aware of what the event
 * actually names, so "View app" only appears on an app event and "Delete
 * event" only for someone who can manage the conversation (brief §11, §12).
 */
export function getSystemEventActions(
  event: SystemActivityEventContent,
  ctx: SystemEventActionsContext,
): SystemEventActionDescriptor[] {
  const actions: SystemEventActionDescriptor[] = [];

  actions.push({
    id: 'copy_event',
    label: 'Copy event',
    icon: Copy,
    onSelect: () => ctx.onCopyEvent?.(),
  });

  const target = event.target;
  if (target && !target.isDeleted && target.id && ctx.onViewEntity) {
    actions.push({
      id: 'view_target',
      label: `View ${entityKindLabel(target.kind)}`,
      icon: target.kind === 'user' ? UserRoundCheck : Bot,
      onSelect: () => ctx.onViewEntity?.(target),
    });
  }

  if (ctx.canManage && ctx.onDelete) {
    actions.push({
      id: 'delete_event',
      label: 'Delete event',
      icon: Trash2,
      destructive: true,
      onSelect: () => ctx.onDelete?.(),
    });
  }

  return actions;
}

/** The hover toolbar — reactions (when the event type allows them) plus the
 * dynamic More menu (brief §11). Reuses the exact reaction infrastructure
 * every other message uses (`onReact` → the same backend/Matrix reaction
 * path `ChatBubble` calls), never a second implementation (brief §13). */
function SystemEventActions({
  event,
  onReact,
  actions,
}: {
  event: SystemActivityEventContent;
  onReact?: (key: string) => void;
  actions: SystemEventActionDescriptor[];
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReactionOpen, setIsReactionOpen] = useState(false);
  const showReact = event.capabilities.reactions && onReact;

  return (
    <div
      className={cn(
        '-top-3.5 right-4 p-0.5 absolute z-20 items-center rounded-lg border border-border bg-surface-raised shadow-lg',
        isMenuOpen || isReactionOpen
          ? 'flex'
          : 'hidden group-focus-within/message:flex group-hover/message:flex',
      )}
    >
      {showReact ? (
        <ReactionPicker onSelect={onReact} open={isReactionOpen} onOpenChange={setIsReactionOpen}>
          <button
            aria-label="Add a reaction"
            className="size-7 touch-target flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Smile className="size-4" />
          </button>
        </ReactionPicker>
      ) : null}

      {actions.length > 0 ? (
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="More actions"
              className={cn(
                'size-7 touch-target flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                isMenuOpen && 'bg-accent text-foreground',
              )}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={4}
            className="w-52 z-50 border-border bg-popover text-popover-foreground shadow-overlay"
          >
            {actions.map((action, index) => (
              <ReactNodeMenuItem key={action.id} action={action} showSeparatorBefore={action.destructive && index > 0} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function ReactNodeMenuItem({
  action,
  showSeparatorBefore,
}: {
  action: SystemEventActionDescriptor;
  showSeparatorBefore?: boolean;
}): ReactNode {
  const Icon = action.icon;
  return (
    <>
      {showSeparatorBefore ? <DropdownMenuSeparator /> : null}
      <DropdownMenuItem
        onSelect={action.onSelect}
        className={cn('hover:bg-accent', action.destructive && 'text-destructive-text')}
      >
        <Icon className="mr-2 size-4" />
        {action.label}
      </DropdownMenuItem>
    </>
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
  const primaryEntity = event.target ?? event.actor;

  const handleCopyEvent = () => {
    void navigator.clipboard
      ?.writeText(message.body)
      .then(() => toast.success('Event copied'));
  };

  const actions = getSystemEventActions(event, {
    canManage,
    onViewEntity,
    onCopyEvent: handleCopyEvent,
    onDelete,
  });

  return (
    <article
      data-message-id={message.id}
      aria-label={message.body}
      className={cn(
        'group/message relative mx-4 my-1 flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent/40',
        isHighlighted && 'ring-2 ring-primary/60',
      )}
    >
      {primaryEntity ? (
        <SystemEventEntityAvatar entity={primaryEntity} />
      ) : (
        <SystemEventIcon eventType={event.eventType} />
      )}

      <div className="min-w-0 flex-1">
        {primaryEntity ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <SystemEventEntityName entity={primaryEntity} onClick={onViewEntity} weight="semibold" />
            <SystemEventEntityBadge kind={primaryEntity.kind} />
          </div>
        ) : null}
        <SystemEventAction event={event} onViewEntity={onViewEntity} />
      </div>

      <SystemEventTimestamp timestamp={event.occurredAt || message.timestamp} />

      <SystemEventActions event={event} onReact={onReact} actions={actions} />

      {message.reactions.length > 0 ? (
        <ul className="pointer-events-none absolute -bottom-2 left-10 flex list-none gap-1">
          {message.reactions.map((reaction) => (
            <li
              key={reaction.key}
              className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-surface-raised px-1.5 py-0.5 text-[11px]"
            >
              <span aria-hidden>{reaction.key}</span>
              <span className="tabular-nums">{reaction.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
