import { Fragment, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useChatPreferences } from '@org/common';
import {
  MentionNotice,
  useMentionNoticeStore,
  type MentionNoticeEntry,
  type MentionNoticeTarget,
  type TimelineEphemeralItem,
} from '@org/chat-ui';
import type { Message } from '@org/types';
import { toast } from '@org/ui';
import type { MentionAddResult } from './use-mention-add-actions.js';

/** How long the "Added …" confirmation lingers before the notice clears itself. */
const ADDED_LINGER_MS = 6_000;

export interface MentionNoticeRowProps {
  notice: MentionNoticeEntry;
  /** `useMentionAddActions(...)` for the conversation the notice is in. */
  onAddTargets: (
    targets: readonly MentionNoticeTarget[],
  ) => Promise<MentionAddResult>;
  className?: string;
}

/**
 * A live `MentionNotice`: wires its buttons to the real add endpoints, the
 * notice store, and the user's "mention reachability" chat preference (which
 * syncs server-side, so "Don't show again" holds on every device).
 */
export function MentionNoticeRow({
  notice,
  onAddTargets,
  className,
}: MentionNoticeRowProps) {
  const { chat, updateChatPreferences } = useChatPreferences();
  const { id, status } = notice;

  // Once everything is added, leave the confirmation up briefly, then go.
  useEffect(() => {
    if (status !== 'added') return;
    const timer = setTimeout(
      () => useMentionNoticeStore.getState().dismiss(id),
      ADDED_LINGER_MS,
    );
    return () => clearTimeout(timer);
  }, [id, status]);

  const handleAdd = useCallback(async () => {
    const store = useMentionNoticeStore.getState();
    const current = store.notices.find((n) => n.id === id);
    if (!current || current.status === 'adding') return;

    const addable = current.targets.filter((t) => t.addAction !== 'none');
    const pending = addable.filter((t) => !current.addedIds.includes(t.id));
    if (pending.length === 0) return;

    store.update(id, { status: 'adding', error: undefined });
    const result = await onAddTargets(pending);
    const addedIds = [...current.addedIds, ...result.added];
    const done = addable.every((t) => addedIds.includes(t.id));
    useMentionNoticeStore.getState().update(id, {
      addedIds,
      status: done ? 'added' : 'failed',
      error: done
        ? undefined
        : (result.error ?? 'Some of them could not be added. Try again.'),
    });
  }, [id, onAddTargets]);

  const handleDismiss = useCallback(
    () => useMentionNoticeStore.getState().dismiss(id),
    [id],
  );

  const handleDontShowAgain = useCallback(() => {
    const store = useMentionNoticeStore.getState();
    const cleared = store.notices;
    store.dismissAll();
    updateChatPreferences({ mentionWarningsEnabled: false });
    toast.success("You won't see these notices again.", {
      description:
        'Turn them back on in Settings › Chat & Messaging › Mention reachability warnings.',
      // Long enough to actually reach the Undo.
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          updateChatPreferences({ mentionWarningsEnabled: true });
          useMentionNoticeStore.setState((state) => ({
            notices: [...cleared, ...state.notices],
          }));
        },
      },
    });
  }, [updateChatPreferences]);

  // Switched off (possibly on another device) — hide anything still up.
  if (chat?.mentionWarningsEnabled === false) return null;

  const canAdd = notice.targets.some((t) => t.addAction !== 'none');

  return (
    <MentionNotice
      targets={notice.targets}
      surfaceKind={notice.surfaceKind}
      conversationName={notice.conversationName}
      peerName={notice.peerName}
      isPrivate={notice.isPrivate}
      timestamp={notice.createdAt}
      status={notice.status}
      addedIds={notice.addedIds}
      error={notice.error}
      onAdd={canAdd ? () => void handleAdd() : undefined}
      onDismiss={handleDismiss}
      onDontShowAgain={handleDontShowAgain}
      className={className}
    />
  );
}

/**
 * Feeds a room's notices into `MessageList` — the rows to weave in, and how
 * to render one by id.
 */
export function useMentionNoticeTimeline(
  notices: readonly MentionNoticeEntry[],
  onAddTargets: MentionNoticeRowProps['onAddTargets'],
): {
  ephemeralItems: TimelineEphemeralItem[];
  renderEphemeral: (id: string) => ReactNode;
} {
  const ephemeralItems = useMemo(
    () =>
      notices.map((notice) => ({
        id: notice.id,
        anchorId: notice.anchorId,
        timestamp: notice.createdAt,
      })),
    [notices],
  );

  const renderEphemeral = useCallback(
    (noticeId: string) => {
      const notice = notices.find((n) => n.id === noticeId);
      return notice ? (
        <MentionNoticeRow notice={notice} onAddTargets={onAddTargets} />
      ) : null;
    },
    [notices, onAddTargets],
  );

  return { ephemeralItems, renderEphemeral };
}

/**
 * For short, non-virtualised reply lists (thread panels): renders each reply
 * via `renderReply`, with any notice it raised directly beneath it, and
 * notices whose message is not in the list at the end.
 */
export function interleaveMentionNotices(
  replies: readonly Message[],
  notices: readonly MentionNoticeEntry[],
  renderReply: (reply: Message) => ReactNode,
  renderNotice: (notice: MentionNoticeEntry) => ReactNode,
): ReactNode[] {
  const placed = new Set<string>();
  const out: ReactNode[] = replies.map((reply) => {
    const below = notices.filter(
      (notice) =>
        !!notice.anchorId &&
        (notice.anchorId === reply.id || notice.anchorId === reply.transactionId),
    );
    for (const notice of below) placed.add(notice.id);
    return (
      <Fragment key={reply.id}>
        {renderReply(reply)}
        {below.map((notice) => (
          <Fragment key={notice.id}>{renderNotice(notice)}</Fragment>
        ))}
      </Fragment>
    );
  });
  for (const notice of notices) {
    if (!placed.has(notice.id)) {
      out.push(<Fragment key={notice.id}>{renderNotice(notice)}</Fragment>);
    }
  }
  return out;
}
