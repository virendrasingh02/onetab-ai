import { channelApi, queryKeys } from '@org/api-client';
import type { ChannelBookmark, ChannelSummary } from '@org/types';
import { toast } from '@org/ui';
import type {
  AddChannelMembersInput,
  ChannelPreferencesInput,
  CreateChannelInput,
  CreatePinInput,
  UpdateChannelInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useChannels(
  workspaceId: string | undefined,
  includeArchived = false,
) {
  return useQuery({
    queryKey: queryKeys.channels.list(workspaceId ?? '', includeArchived),
    queryFn: () => channelApi.list(workspaceId as string, includeArchived),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export interface GroupedChannels {
  favorites: ChannelSummary[];
  joined: ChannelSummary[];
  available: ChannelSummary[];
  archived: ChannelSummary[];
}

/**
 * Splits channels into the sidebar's sections.
 *
 * Ordering is stable and alphabetical inside each group so the sidebar does
 * not reshuffle as unrelated data refreshes.
 */
export function useGroupedChannels(
  channels: ChannelSummary[] | undefined,
): GroupedChannels {
  return useMemo(() => {
    const result: GroupedChannels = {
      favorites: [],
      joined: [],
      available: [],
      archived: [],
    };

    for (const channel of channels ?? []) {
      if (channel.isArchived) result.archived.push(channel);
      else if (channel.membership?.isFavorite) result.favorites.push(channel);
      else if (channel.membership) result.joined.push(channel);
      else result.available.push(channel);
    }

    const byName = (a: ChannelSummary, b: ChannelSummary) =>
      a.name.localeCompare(b.name);
    result.favorites.sort(byName);
    result.joined.sort(byName);
    result.available.sort(byName);
    result.archived.sort(byName);

    return result;
  }, [channels]);
}

export function useChannel(
  workspaceId: string | undefined,
  slug: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.channels.detail(workspaceId ?? '', slug ?? ''),
    queryFn: () => channelApi.bySlug(workspaceId as string, slug as string),
    enabled: !!workspaceId && !!slug,
    // A missing or forbidden channel is a 404 either way; retrying cannot help.
    retry: false,
  });
}

export function useChannelMembers(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.channels.members(workspaceId ?? '', channelId ?? ''),
    queryFn: () =>
      channelApi.members(workspaceId as string, channelId as string),
    enabled: !!workspaceId && !!channelId,
  });
}

export function useChannelPins(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.channels.pins(workspaceId ?? '', channelId ?? ''),
    queryFn: () => channelApi.pins(workspaceId as string, channelId as string),
    enabled: !!workspaceId && !!channelId,
  });
}

export function useChannelFiles(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.channels.files(workspaceId ?? '', channelId ?? ''),
    queryFn: () => channelApi.files(workspaceId as string, channelId as string),
    enabled: !!workspaceId && !!channelId,
  });
}

export function useCreateChannel(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateChannelInput) =>
      channelApi.create(workspaceId as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.channels.all(workspaceId ?? ''),
      });
    },
  });
}

export function useUpdateChannel(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      channelId,
      input,
    }: {
      channelId: string;
      input: UpdateChannelInput;
    }) => channelApi.update(workspaceId as string, channelId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.channels.all(workspaceId ?? ''),
      });
    },
  });
}

/**
 * Star/unstar a channel, applied optimistically.
 *
 * The star is a pure UI affordance in the sidebar; waiting for a round trip
 * makes it feel broken. The previous list is restored if the call fails.
 */
export function useChannelPreferences(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      channelId,
      input,
    }: {
      channelId: string;
      input: ChannelPreferencesInput;
    }) => channelApi.setPreferences(workspaceId as string, channelId, input),

    onMutate: async ({ channelId, input }) => {
      const key = queryKeys.channels.list(workspaceId ?? '', false);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChannelSummary[]>(key);

      const targetChannel = previous?.find((c) => c.id === channelId);
      const channelName = targetChannel ? `#${targetChannel.name}` : 'Channel';

      if (input.isFavorite !== undefined) {
        if (input.isFavorite) {
          toast.success(`Added ${channelName} to favorites`);
        } else {
          toast.info(`Removed ${channelName} from favorites`);
        }
      }

      if (input.isMuted !== undefined) {
        if (input.isMuted) {
          toast.info(`Muted ${channelName}`);
        } else {
          toast.success(`Unmuted ${channelName}`);
        }
      }

      queryClient.setQueryData<ChannelSummary[]>(key, (current) =>
        current?.map((channel) =>
          channel.id === channelId && channel.membership
            ? { ...channel, membership: { ...channel.membership, ...input } }
            : channel,
        ),
      );

      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.channels.all(workspaceId ?? ''),
      });
    },
  });
}

export function useArchiveChannel(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      channelId,
      archived,
    }: {
      channelId: string;
      archived: boolean;
    }) =>
      archived
        ? channelApi.archive(workspaceId as string, channelId)
        : channelApi.unarchive(workspaceId as string, channelId),
    onSuccess: (_data, { archived }) => {
      toast.success(archived ? 'Channel archived' : 'Channel unarchived');
      queryClient.invalidateQueries({
        queryKey: queryKeys.channels.all(workspaceId ?? ''),
      });
    },
  });
}

export function useMakeChannelPrivate(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) =>
      channelApi.makePrivate(workspaceId as string, channelId),
    onSuccess: () => {
      toast.success('Channel visibility set to private');
      queryClient.invalidateQueries({
        queryKey: queryKeys.channels.all(workspaceId ?? ''),
      });
    },
  });
}

export function useJoinChannel(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) =>
      channelApi.join(workspaceId as string, channelId),
    onSuccess: () => {
      toast.success('Joined channel');
      queryClient.invalidateQueries({
        queryKey: queryKeys.channels.all(workspaceId ?? ''),
      });
    },
  });
}

export function useChannelMemberMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidate = (channelId: string) =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.channels.members(workspaceId ?? '', channelId),
    });

  const add = useMutation({
    mutationFn: ({
      channelId,
      input,
    }: {
      channelId: string;
      input: AddChannelMembersInput;
    }) => channelApi.addMembers(workspaceId as string, channelId, input),
    onSuccess: (_data, { channelId }) => invalidate(channelId),
  });

  const remove = useMutation({
    mutationFn: ({
      channelId,
      userId,
    }: {
      channelId: string;
      userId: string;
    }) => channelApi.removeMember(workspaceId as string, channelId, userId),
    onSuccess: (_data, { channelId }) => invalidate(channelId),
  });

  return { add, remove };
}

export function usePinMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidate = (channelId: string) =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.channels.pins(workspaceId ?? '', channelId),
    });

  const create = useMutation({
    mutationFn: ({
      channelId,
      input,
    }: {
      channelId: string;
      input: CreatePinInput;
    }) => channelApi.createPin(workspaceId as string, channelId, input),
    onSuccess: (_data, { channelId }) => {
      toast.success('Message pinned to channel');
      invalidate(channelId);
    },
  });

  const remove = useMutation({
    mutationFn: ({ channelId, pinId }: { channelId: string; pinId: string }) =>
      channelApi.removePin(workspaceId as string, channelId, pinId),
    onSuccess: (_data, { channelId }) => {
      toast.info('Message unpinned');
      invalidate(channelId);
    },
  });

  return { create, remove };
}

/**
 * Manages pinned links and resources for a specific channel with localStorage persistence.
 */
export function useChannelBookmarks(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  const storageKey = useMemo(
    () =>
      `onetab_channel_bm_${workspaceId || 'default'}_${channelId || 'default'}`,
    [workspaceId, channelId],
  );

  const [bookmarks, setBookmarks] = useState<ChannelBookmark[]>(() => {
    if (typeof window === 'undefined' || !channelId) return [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !channelId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBookmarks(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setBookmarks([]);
  }, [storageKey, channelId]);

  const addBookmark = useCallback(
    (bookmark: Omit<ChannelBookmark, 'id'>) => {
      setBookmarks((prev) => {
        const newEntry: ChannelBookmark = {
          ...bookmark,
          id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };
        const updated = [...prev, newEntry];
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // ignore
        }
        toast.success(`Bookmark "${bookmark.label}" saved`);
        return updated;
      });
    },
    [storageKey],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      setBookmarks((prev) => {
        const target = prev.find((b) => b.id === id);
        const updated = prev.filter((b) => b.id !== id);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // ignore
        }
        toast.info(
          target ? `Bookmark "${target.label}" removed` : 'Bookmark removed',
        );
        return updated;
      });
    },
    [storageKey],
  );

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
  };
}
