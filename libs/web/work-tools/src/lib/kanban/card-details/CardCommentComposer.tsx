import { queryKeys, uploadApi } from '@org/api-client';
import { Composer, insertIntoComposer } from '@org/chat-ui';
import type { ComposerMessageMeta, RoomMember } from '@org/types';
import { toast } from '@org/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { BoardMember } from '../types.js';

/** The chat drafts store keys this composer's draft per task. */
export const commentConversationId = (cardId: string) =>
  `task-comment:${cardId}`;

/** People picked from the `@` menu, as platform user ids. */
export function mentionedUserIds(meta?: ComposerMessageMeta): string[] {
  const ids = (meta?.mentions ?? [])
    .filter((mention) => mention.kind === 'user')
    .map((mention) => mention.id);
  return [...new Set(ids)];
}

export interface CardCommentComposerProps {
  workspaceId: string | undefined;
  cardId: string;
  members: BoardMember[];
  currentUserId?: string;
  canComment: boolean;
  /** Text to drop into the box, e.g. a Brain² summary to review before posting. */
  prefill: string | null;
  onPrefillTaken: () => void;
  /** Rejects when the comment could not be sent or queued. */
  onSend: (content: string, mentionedUserIds: string[]) => Promise<unknown>;
}

/**
 * The task's comment box: the same composer as chat (rich text, `@` mention
 * chips, emoji, attachments, drafts), scoped to the board's people.
 */
export function CardCommentComposer({
  workspaceId,
  cardId,
  members,
  currentUserId,
  canComment,
  prefill,
  onPrefillTaken,
  onSend,
}: CardCommentComposerProps) {
  const queryClient = useQueryClient();
  const conversationId = commentConversationId(cardId);

  const roster = useMemo<RoomMember[]>(
    () =>
      members.map((member) => ({
        userId: member.id,
        displayName: member.displayName ?? member.name,
        avatarUrl: member.avatarUrl,
        powerLevel: 0,
        membership: 'join',
      })),
    [members],
  );

  useEffect(() => {
    if (prefill === null) return;
    insertIntoComposer(conversationId, prefill);
    onPrefillTaken();
  }, [prefill, onPrefillTaken, conversationId]);

  const attach = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await uploadApi.upload(workspaceId as string, file, {
          contextType: 'ISSUE',
          contextId: cardId,
        });
      }
      return files;
    },
    onSuccess: (files) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.uploads.all(workspaceId ?? ''),
      });
      toast.success(
        files.length === 1
          ? `${files[0]?.name} added to Files`
          : `${files.length} files added to Files`,
      );
    },
    meta: { errorMessage: 'Could not upload that file.' },
  });

  const send = async (body: string, meta?: ComposerMessageMeta) => {
    try {
      await onSend(body, mentionedUserIds(meta));
    } catch {
      // The editor cleared on send; put the text back to retry. The
      // mutation already toasted the failure.
      insertIntoComposer(conversationId, body);
    }
  };

  return (
    <Composer
      conversationId={conversationId}
      workspaceId={workspaceId}
      surfaceKind="thread"
      members={roster}
      currentUserId={currentUserId}
      canMentionGroups={false}
      slashCommands={[]}
      linkPreviewsEnabled={false}
      placeholder="Write a comment… @ to mention"
      readOnlyMessage={
        canComment
          ? undefined
          : "You can read this conversation, but your role can't comment here."
      }
      onSend={send}
      onAttach={
        workspaceId ? (files) => attach.mutate(Array.from(files)) : undefined
      }
      className="px-0 pt-0 sm:px-0 sm:pt-0 static z-auto bg-transparent"
    />
  );
}
