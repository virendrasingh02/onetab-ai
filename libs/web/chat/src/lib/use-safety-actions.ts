import { queryKeys, safetyApi } from '@org/api-client';
import type { Message } from '@org/types';
import { confirm, toast } from '@org/ui';
import type { CreateContentReportInput } from '@org/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

/** Chat knows a sender by platform id or Matrix id, depending on the room source. */
const senderRef = (senderId: string) =>
  senderId.startsWith('@') ? { matrixUserId: senderId } : { userId: senderId };

/**
 * Report and block for chat. The homeserver hides blocked senders through
 * `m.ignored_user_list`; filtering here too covers a timeline already loaded
 * and a homeserver that could not be updated.
 */
export function useSafetyActions(
  messages: Message[],
  myUserId: string | undefined,
) {
  const queryClient = useQueryClient();
  const blocks = useQuery({
    queryKey: queryKeys.safety.blocks(),
    queryFn: () => safetyApi.blocks(),
    staleTime: 60_000,
  });

  const visibleMessages = useMemo(() => {
    const blocked = new Set(
      (blocks.data ?? []).flatMap((block) =>
        block.matrixUserId
          ? [block.userId, block.matrixUserId]
          : [block.userId],
      ),
    );
    if (blocked.size === 0) return messages;
    return messages.filter(
      (message) =>
        message.senderId === myUserId || !blocked.has(message.senderId),
    );
  }, [blocks.data, messages, myUserId]);

  const reportMessage = useCallback(
    (message: Message, reason: CreateContentReportInput['reason']) => {
      const ref = senderRef(message.senderId);
      safetyApi
        .report({
          targetType: 'MESSAGE',
          targetId: message.id,
          targetUserId: ref.userId,
          targetMatrixUserId: ref.matrixUserId,
          reason,
          excerpt: message.body?.slice(0, 4000),
        })
        .then(() => toast.success('Report sent. Our team will review it.'))
        .catch(() => toast.error('Could not send the report. Try again.'));
    },
    [],
  );

  const blockSender = useCallback(
    async (message: Message) => {
      const accepted = await confirm({
        title: `Block ${message.senderName ?? 'this person'}?`,
        description:
          'You will stop seeing their messages. You can undo this later.',
        confirmLabel: 'Block',
        destructive: true,
      });
      if (!accepted) return;
      try {
        await safetyApi.block(senderRef(message.senderId));
        await queryClient.invalidateQueries({
          queryKey: queryKeys.safety.blocks(),
        });
        toast.success('Blocked.');
      } catch {
        toast.error('Could not block this person. Try again.');
      }
    },
    [queryClient],
  );

  return { visibleMessages, reportMessage, blockSender };
}
