import { useCurrentUser } from '@org/auth';
import { channelApi, matrixApi, queryKeys } from '@org/api-client';
import type { ChannelSummary } from '@org/types';
import { useMembers } from '@org/web-members';
import { useWorkspaceStore } from '@org/web-workspace';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type {
  RecipientChannel,
  RecipientPerson,
} from './new-message-recipients.js';
import { peerKindOf } from './peer-kind.js';
import { useCreateConversation } from './use-create-conversation.js';
import { useGroupDirectMessages } from './use-chat.js';

/** Ids of existing group DMs in the destination list, kept apart from channel ids. */
const GROUP_PREFIX = 'group:';

export interface ShareDestination {
  roomId: string;
  href: string;
  label: string;
}

/** "#general", "#general and Zeeshan", "#general, Zeeshan and 2 others". */
export function summariseDestinations(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  const rest = labels.length - 2;
  return `${labels[0]}, ${labels[1]} and ${rest} other${rest === 1 ? '' : 's'}`;
}

/**
 * Where something can be sent: the channels the viewer may post to, their
 * group DMs and the workspace's people, plus the step that turns a picked set
 * into rooms (creating DMs where needed). Shared by "Forward message" and
 * "Share in chat" so both offer the same destinations.
 */
export function useShareDestinations() {
  // The store, not the route: these dialogs also open outside a chat page.
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const workspaceId = workspace?.id;
  const slug = workspace?.slug;
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);
  const groups = useGroupDirectMessages();
  const createConversation = useCreateConversation();
  const queryClient = useQueryClient();

  // Same cache entry as the sidebar's `useChannels`, so this is usually warm.
  const channels = useQuery({
    queryKey: queryKeys.channels.list(workspaceId ?? '', false),
    queryFn: () => channelApi.list(workspaceId as string, false),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const peopleOptions = useMemo<RecipientPerson[]>(
    () =>
      (members.data ?? []).map((member) => ({
        id: member.user.id,
        name: member.user.displayName ?? member.user.name,
        handle: member.user.name,
        avatarUrl: member.user.avatarUrl,
        presence: member.user.presence,
        kind: peerKindOf(member.user.id),
        isSelf: member.user.id === currentUser?.id,
        statusText: member.user.statusText,
      })),
    [members.data, currentUser?.id],
  );

  // Channels the viewer is in and may post to, then their group DMs.
  const channelOptions = useMemo<RecipientChannel[]>(() => {
    const postable = ((channels.data ?? []) as ChannelSummary[])
      .filter(
        (channel) =>
          channel.membership && channel.canPost && !channel.isArchived,
      )
      .map<RecipientChannel>((channel) => ({
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        isPrivate: channel.visibility === 'PRIVATE',
        kind: 'channel',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const groupRows = groups.map<RecipientChannel>((group) => ({
      id: `${GROUP_PREFIX}${group.roomId}`,
      name: group.name,
      slug: group.roomId,
      isPrivate: true,
      kind: 'group',
    }));
    return [...postable, ...groupRows];
  }, [channels.data, groups]);

  /** Turns the picked tokens into rooms, creating DMs where needed. */
  const resolveDestinations = useCallback(
    async ({
      channelIds,
      peopleIds,
      bundle = false,
    }: {
      channelIds: string[];
      peopleIds: string[];
      /** One group conversation with all the people, instead of a DM each. */
      bundle?: boolean;
    }): Promise<ShareDestination[]> => {
      const destinations: ShareDestination[] = [];

      for (const id of channelIds) {
        const option = channelOptions.find((channel) => channel.id === id);
        if (!option) continue;
        if (option.kind === 'group') {
          const roomId = id.slice(GROUP_PREFIX.length);
          destinations.push({
            roomId,
            href: `/w/${slug}/dms?room=${roomId}`,
            label: option.name,
          });
          continue;
        }
        const { roomId } = await queryClient.fetchQuery({
          queryKey: queryKeys.matrix.channelRoom(id),
          queryFn: () => matrixApi.channelRoom(id),
          staleTime: Infinity,
        });
        destinations.push({
          roomId,
          href: `/w/${slug}/channels/${option.slug}`,
          label: `#${option.name}`,
        });
      }

      const nameOf = (id: string) =>
        peopleOptions.find((person) => person.id === id)?.name ?? 'someone';

      if (bundle) {
        const created = await createConversation.mutateAsync({
          peerIds: peopleIds,
        });
        destinations.push({
          roomId: created.roomId,
          href:
            created.kind === 'direct'
              ? `/w/${slug}/dms/${created.peerId}`
              : `/w/${slug}/dms?room=${created.roomId}`,
          label: 'a new group',
        });
      } else {
        // One at a time: parallel creates can race into duplicate DM rooms.
        for (const id of peopleIds) {
          const created = await createConversation.mutateAsync({
            peerIds: [id],
          });
          destinations.push({
            roomId: created.roomId,
            href:
              created.kind === 'direct'
                ? `/w/${slug}/dms/${created.peerId}`
                : `/w/${slug}/dms?room=${created.roomId}`,
            label: id === currentUser?.id ? 'yourself' : nameOf(id),
          });
        }
      }

      // A person already reached through a picked group, say: send once.
      const seen = new Set<string>();
      return destinations.filter((destination) =>
        seen.has(destination.roomId)
          ? false
          : (seen.add(destination.roomId), true),
      );
    },
    [
      channelOptions,
      slug,
      queryClient,
      createConversation,
      peopleOptions,
      currentUser?.id,
    ],
  );

  return {
    peopleOptions,
    channelOptions,
    resolveDestinations,
    currentUserId: currentUser?.id,
    isLoading: members.isLoading,
  };
}
