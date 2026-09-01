import { channelApi, queryKeys, workToolsApi } from '@org/api-client';
import type { ChannelBookmark, ChannelSummary } from '@org/types';
import type { ChatAppEntity } from '@org/chat-ui';
import { toast } from '@org/ui';
import type {
  AddChannelMembersInput,
  ChannelPreferencesInput,
  CreateChannelInput,
  CreateDocumentInput,
  CreatePinInput,
  CreateTaskInput,
  UpdateChannelInput,
  UpdateTaskInput,
} from '@org/validation';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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
 * #general is pinned to the top of the joined channels list (Slack-style),
 * followed by alphabetical order for other channels.
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

    const byPriorityAndName = (a: ChannelSummary, b: ChannelSummary) => {
      const isGeneralA = a.slug === 'general' || a.name === 'general';
      const isGeneralB = b.slug === 'general' || b.name === 'general';
      if (isGeneralA && !isGeneralB) return -1;
      if (!isGeneralA && isGeneralB) return 1;
      return a.name.localeCompare(b.name);
    };

    result.favorites.sort(byPriorityAndName);
    result.joined.sort(byPriorityAndName);
    result.available.sort(byPriorityAndName);
    result.archived.sort(byPriorityAndName);

    return result;
  }, [channels]);
}

/**
 * Resolves the default channel according to priority:
 * 1. User's last selected channel in this workspace
 * 2. Workspace General channel (`#general`)
 * 3. Legacy Public channel (`#public`) if general not found
 * 4. First joined channel
 * 5. First available channel
 * 6. undefined
 */
export function resolveDefaultChannel(
  channels: ChannelSummary[] | undefined,
  preferredSlug?: string | null,
): ChannelSummary | undefined {
  if (!channels || channels.length === 0) return undefined;

  if (preferredSlug) {
    const preferred = channels.find(
      (c) => c.slug === preferredSlug && !c.isArchived,
    );
    if (preferred) return preferred;
  }

  const general = channels.find(
    (c) => (c.slug === 'general' || c.name === 'general') && !c.isArchived,
  );
  if (general) return general;

  const publicChannel = channels.find(
    (c) => (c.slug === 'public' || c.name === 'public') && !c.isArchived,
  );
  if (publicChannel) return publicChannel;

  const joined = channels.find((c) => c.membership && !c.isArchived);
  if (joined) return joined;

  return channels.find((c) => !c.isArchived) ?? channels[0];
}

/**
 * A channel's full detail, for the page that owns one channel at a time.
 *
 * Switching between channels changes this query's key, and the naive result —
 * `data` going back to `undefined` until the new one resolves — is what made
 * the channel page unmount its entire viewport (header, tabs, conversation) on
 * every switch: see `ChannelPage`. Two things prevent that:
 *
 *  - `initialData` seeds the new key from the channel list already sitting in
 *    the cache (the sidebar fetched it to render itself), so opening a channel
 *    reachable from the sidebar never shows a loading state at all — the
 *    detail query still runs in the background to pick up anything the list's
 *    lighter shape left out.
 *  - `placeholderData: keepPreviousData` covers the rest: a channel that is
 *    *not* in the cached list (a fresh invite link, an unjoined channel opened
 *    from search) keeps showing whatever was on screen until the new channel's
 *    data actually arrives, rather than blanking the page in between.
 */
export function useChannel(
  workspaceId: string | undefined,
  slug: string | undefined,
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.channels.detail(workspaceId ?? '', slug ?? ''),
    queryFn: () => channelApi.bySlug(workspaceId as string, slug as string),
    enabled: !!workspaceId && !!slug,
    // A missing or forbidden channel is a 404 either way; retrying cannot help.
    retry: false,
    initialData: () => {
      if (!workspaceId || !slug) return undefined;
      const list = queryClient.getQueryData<ChannelSummary[]>(
        queryKeys.channels.list(workspaceId, false),
      );
      return list?.find((channel) => channel.slug === slug);
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(
        queryKeys.channels.list(workspaceId ?? '', false),
      )?.dataUpdatedAt,
    placeholderData: keepPreviousData,
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

/**
 * Tasks and documents are workspace-scoped in the schema (no `channelId`), so
 * these fetch the whole workspace set and the channel view surfaces them for
 * context. The query keys match the canonical `queryKeys.workTools.*` shape so
 * the cache is shared with the work-tools screens rather than fragmented.
 */
export function useChannelTasks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workTools.tasks(workspaceId ?? ''),
    queryFn: () => workToolsApi.tasks(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

export function useChannelDocuments(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workTools.documents(workspaceId ?? ''),
    queryFn: () => workToolsApi.documents(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useChannelAppEntities(
  workspaceId: string | undefined,
  channelId?: string,
  channelName?: string,
) {
  const tasksQuery = useChannelTasks(workspaceId);
  const docsQuery = useChannelDocuments(workspaceId);

  const entities: ChatAppEntity[] = useMemo(() => {
    const list: ChatAppEntity[] = [];

    // Map tasks / kanban cards
    for (const task of tasksQuery.data ?? []) {
      list.push({
        id: task.id,
        kind: 'task',
        title: task.title,
        description: task.description ?? undefined,
        channelId,
        channelName: channelName ?? 'general',
        status: task.status,
        priority: task.priority ?? undefined,
        assigneeId: task.assignee?.id,
        assigneeName: task.assignee?.displayName ?? task.assignee?.name,
        assigneeAvatarUrl: task.assignee?.avatarUrl ?? undefined,
        updatedAt: task.updatedAt,
        createdAt: task.createdAt,
        raw: task,
      });
    }

    // Map documents
    for (const doc of docsQuery.data ?? []) {
      list.push({
        id: doc.id,
        kind: 'document',
        title: doc.title,
        description: typeof doc.content === 'string' ? doc.content.slice(0, 160) : undefined,
        channelId,
        channelName: channelName ?? 'general',
        authorName: doc.author?.displayName ?? doc.author?.name,
        authorAvatarUrl: doc.author?.avatarUrl ?? undefined,
        updatedAt: doc.updatedAt,
        createdAt: doc.createdAt,
        raw: doc,
      });
    }

    return list;
  }, [tasksQuery.data, docsQuery.data, channelId, channelName]);

  return {
    entities,
    isLoading: tasksQuery.isLoading || docsQuery.isLoading,
    isError: tasksQuery.isError || docsQuery.isError,
    error: (tasksQuery.error?.message || docsQuery.error?.message) ?? null,
    refetch: () => {
      void tasksQuery.refetch();
      void docsQuery.refetch();
    },
  };
}

export function useChannelEntityMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const ws = workspaceId ?? '';

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(ws),
    });
  };

  const createTask = useMutation({
    mutationFn: (input: CreateTaskInput) => workToolsApi.createTask(ws, input),
    onSuccess: () => {
      toast.success('Task created');
      invalidate();
    },
  });

  const updateTask = useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: UpdateTaskInput;
    }) => workToolsApi.updateTask(ws, taskId, input),
    onSuccess: () => {
      toast.success('Task updated');
      invalidate();
    },
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => workToolsApi.deleteTask(ws, taskId),
    onSuccess: () => {
      toast.info('Task deleted');
      invalidate();
    },
  });

  const createDocument = useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      workToolsApi.createDocument(ws, input),
    onSuccess: () => {
      toast.success('Document created');
      invalidate();
    },
  });

  return {
    createTask,
    updateTask,
    deleteTask,
    createDocument,
  };
}

