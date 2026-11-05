import { Fragment, type ReactNode } from 'react';
import { AtSign, Bot, CheckCircle2, Plug } from 'lucide-react';
import { Button } from '@org/ui';
import type { AddAction, ComposerSurfaceKind } from '@org/types';
import type {
  MentionNoticeStatus,
  MentionNoticeTarget,
} from './mention-notice-store.js';
import { PrivateNoticeRow } from './private-notice-row.js';

/** The name the notice is "from" — the platform itself, not a person. */
export const MENTION_NOTICE_SENDER = 'Onetab';

/** Past this many names the sentence summarises the rest as "N others". */
const MAX_NAMED_TARGETS = 3;

export interface MentionNoticeCopyInput {
  targets: MentionNoticeTarget[];
  surfaceKind?: ComposerSurfaceKind;
  conversationName?: string;
  peerName?: string;
  isPrivate?: boolean;
}

export interface MentionNoticeCopy {
  /** Follows "You mentioned {names}" — e.g. "but it isn't in #design." */
  clause: string;
  /** The consequence / next step, in a quieter line underneath. */
  detail: string;
  /** Label for the add button, or null when the viewer cannot add anyone. */
  actionLabel: string | null;
}

function isOneToOne(surfaceKind: ComposerSurfaceKind): boolean {
  return (
    surfaceKind === 'agent' ||
    surfaceKind === 'coworker' ||
    surfaceKind === 'app'
  );
}

function isChannelLike(surfaceKind: ComposerSurfaceKind): boolean {
  return surfaceKind === 'channel' || surfaceKind === 'thread';
}

/** Where the message went, in words: `#design`, "this private channel", … */
export function describeConversation(
  surfaceKind: ComposerSurfaceKind = 'channel',
  conversationName?: string,
  isPrivate?: boolean,
): string {
  if (isChannelLike(surfaceKind)) {
    if (isPrivate) return 'this private channel';
    return conversationName ? `#${conversationName}` : 'this channel';
  }
  return 'this conversation';
}

export function formatActionLabel(addAction: AddAction): string | null {
  switch (addAction) {
    case 'channel-member':
    case 'channel-agent':
    case 'channel-app':
      return 'Add to channel';
    case 'group-dm-member':
      return 'Add to conversation';
    case 'start-group':
      return 'Start a group';
    default:
      return null;
  }
}

/**
 * Everything the notice says, derived from who was mentioned and where — kept
 * pure (and exported) so the wording is unit-testable without rendering.
 */
export function getMentionNoticeCopy({
  targets,
  surfaceKind = 'channel',
  conversationName,
  peerName,
  isPrivate,
}: MentionNoticeCopyInput): MentionNoticeCopy {
  const single = targets.length === 1;
  const onlyThings = targets.every((t) => t.kind !== 'user');
  // "it" for one app/agent, "they" for a person or several of anything.
  const it = single && onlyThings;
  const where = describeConversation(surfaceKind, conversationName, isPrivate);

  if (isOneToOne(surfaceKind)) {
    const peer = peerName ? `@${peerName}` : 'the other participant';
    return {
      clause: `but this conversation is just between you and ${peer}.`,
      detail: it
        ? "It won't see your message here."
        : "They won't see your message here.",
      actionLabel: null,
    };
  }

  const clause = it
    ? `but it isn't in ${where}.`
    : `but they aren't in ${where}.`;
  const addable = targets.filter((t) => t.addAction !== 'none');
  const actionLabel = addable[0]
    ? formatActionLabel(addable[0].addAction)
    : null;

  if (surfaceKind === 'dm') {
    return {
      clause,
      detail: 'Start a group conversation to bring them in.',
      actionLabel,
    };
  }

  if (surfaceKind === 'group-dm') {
    return {
      clause,
      detail: it
        ? "It won't see your message unless you add it."
        : "They won't see your message unless you add them.",
      actionLabel,
    };
  }

  // Channels and their threads.
  if (addable.length === 0) {
    return {
      clause,
      detail: it
        ? 'Only channel admins can add it — ask one if it should be here.'
        : 'Only channel admins can add them — ask one if they should be here.',
      actionLabel: null,
    };
  }

  let detail: string;
  if (addable.length < targets.length) {
    detail = 'You can add some of them here; the rest need a channel admin.';
  } else if (it) {
    detail =
      targets[0].kind === 'app'
        ? "It won't see or act on your message until it's added."
        : "It won't see or reply to your message until it's added.";
  } else if (onlyThings) {
    detail = "They won't see your message until they're added.";
  } else {
    detail = "They won't be notified unless you add them.";
  }

  return { clause, detail, actionLabel };
}

/** "Added @GitHub to #design." — shown in place of the actions on success. */
export function getMentionNoticeSuccess({
  targets,
  surfaceKind = 'channel',
  conversationName,
  isPrivate,
}: MentionNoticeCopyInput): string {
  const names = joinNames(targets.map((t) => `@${t.name}`));
  if (surfaceKind === 'dm') return `Started a group with ${names}.`;
  const where = isChannelLike(surfaceKind)
    ? isPrivate || !conversationName
      ? 'this channel'
      : `#${conversationName}`
    : 'this conversation';
  return `Added ${names} to ${where}.`;
}

/** Plain-text "A, B and C" (with "N others" past the cap). */
function joinNames(names: string[]): string {
  const shown = names.slice(0, MAX_NAMED_TARGETS);
  const rest = names.length - shown.length;
  if (rest > 0) shown.push(rest === 1 ? '1 other' : `${rest} others`);
  if (shown.length <= 1) return shown[0] ?? '';
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

function TargetIcon({ kind }: { kind: MentionNoticeTarget['kind'] }) {
  if (kind === 'app') return <Plug className="size-3" aria-hidden />;
  if (kind === 'agent' || kind === 'coworker') {
    return <Bot className="size-3" aria-hidden />;
  }
  return null;
}

/** One mentioned name, styled like the mention pills in a sent message. */
function TargetChip({ target }: { target: MentionNoticeTarget }) {
  return (
    <span className="gap-0.5 px-1 font-semibold inline-flex items-center rounded-md bg-mention align-baseline text-[0.9em] text-mention-foreground">
      <TargetIcon kind={target.kind} />@{target.name}
    </span>
  );
}

/** The chips joined into a sentence fragment: "@A, @B and 2 others". */
function TargetList({ targets }: { targets: MentionNoticeTarget[] }) {
  const shown = targets.slice(0, MAX_NAMED_TARGETS);
  const rest = targets.length - shown.length;
  const parts: ReactNode[] = shown.map((t) => (
    <TargetChip key={t.id} target={t} />
  ));
  if (rest > 0) {
    parts.push(
      <span key="rest" className="font-semibold">
        {rest === 1 ? '1 other' : `${rest} others`}
      </span>,
    );
  }
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? (index === parts.length - 1 ? ' and ' : ', ') : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

export interface MentionNoticeProps extends MentionNoticeCopyInput {
  /** When the triggering message was sent. */
  timestamp: number;
  status?: MentionNoticeStatus;
  /** Targets added so far — the success line names only these. */
  addedIds?: readonly string[];
  /** Shown under the actions when the last add attempt failed. */
  error?: string;
  /** Adds every target the viewer may add. Omitted → no add button. */
  onAdd?: () => void;
  onDismiss: () => void;
  /** Turns these notices off for good (the user's chat preference). */
  onDontShowAgain?: () => void;
  className?: string;
}

/**
 * The "Only visible to you" notice that follows a message mentioning someone
 * — a person, AI agent, coworker or app — who isn't in the conversation, with
 * one-click ways to add them, dismiss it, or never be told again.
 *
 * A {@link PrivateNoticeRow}, so it looks like any other row in the timeline.
 */
export function MentionNotice({
  targets,
  surfaceKind = 'channel',
  conversationName,
  peerName,
  isPrivate,
  timestamp,
  status = 'idle',
  addedIds,
  error,
  onAdd,
  onDismiss,
  onDontShowAgain,
  className,
}: MentionNoticeProps) {
  if (targets.length === 0) return null;

  const copyInput = {
    targets,
    surfaceKind,
    conversationName,
    peerName,
    isPrivate,
  };
  const copy = getMentionNoticeCopy(copyInput);
  const added = status === 'added';
  const adding = status === 'adding';
  const plainNames = joinNames(targets.map((t) => `@${t.name}`));

  return (
    <PrivateNoticeRow
      ariaLabel={`Only visible to you. You mentioned ${plainNames}, ${copy.clause}`}
      avatar={
        <span
          aria-hidden
          className="size-10 flex items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <AtSign className="size-4" />
        </span>
      }
      name={MENTION_NOTICE_SENDER}
      timestamp={timestamp}
      onDismiss={onDismiss}
      className={className}
      actions={
        <>
          {!added && copy.actionLabel && onAdd ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={adding}
              onClick={onAdd}
            >
              {status === 'failed' ? 'Try again' : copy.actionLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={adding}
            onClick={onDismiss}
          >
            {added ? 'Done' : 'Dismiss'}
          </Button>
          {!added && onDontShowAgain ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={adding}
              onClick={onDontShowAgain}
            >
              Don&apos;t show again
            </Button>
          ) : null}
        </>
      }
    >
      {added ? (
        <p className="gap-1.5 flex items-center text-message text-foreground">
          <CheckCircle2
            className="size-4 shrink-0 text-success-text"
            aria-hidden
          />
          <span>
            {getMentionNoticeSuccess({
              ...copyInput,
              targets: addedIds?.length
                ? targets.filter((t) => addedIds.includes(t.id))
                : targets,
            })}
          </span>
        </p>
      ) : (
        <>
          <p className="leading-relaxed text-message text-foreground">
            You mentioned <TargetList targets={targets} />, {copy.clause}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{copy.detail}</p>
        </>
      )}

      {error && !added ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
    </PrivateNoticeRow>
  );
}
