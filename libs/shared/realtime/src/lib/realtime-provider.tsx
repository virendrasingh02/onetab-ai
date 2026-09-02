import { getAccessToken } from '@org/api-client';
import { queryKeys } from '@org/api-client';
import type { UserPresence } from '@org/types';
import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { PresenceService } from './presence-service.js';
import { RealtimeClient } from './realtime-client.js';
import { RealtimeEventBus, type RealtimeEventHandler } from './realtime-event-bus.js';
import {
  RealtimeEventType,
  type CommentCreatedPayload,
  type NotificationCreatedPayload,
  type NotificationReadPayload,
  type ProjectUpdatedPayload,
  type RealtimeConnectionState,
  type RealtimeEvent,
  type TaskCreatedPayload,
  type TaskDeletedPayload,
  type TaskUpdatedPayload,
} from './types.js';

// --- Context Definitions ---------------------------------------------------

interface RealtimeContextValue {
  client: RealtimeClient | null;
  connectionState: RealtimeConnectionState;
  isConnected: boolean;
  bus: RealtimeEventBus;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface PresenceContextValue {
  presenceService: PresenceService | null;
  presenceMap: Record<string, UserPresence>;
  getPresence: (userId: string) => UserPresence;
  isOnline: (userId: string) => boolean;
  setLocalPresence: (
    status: 'online' | 'away' | 'busy' | 'offline',
    statusText?: string,
    statusEmoji?: string,
  ) => Promise<void>;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

// --- Realtime Provider -----------------------------------------------------

export interface RealtimeProviderProps {
  children: ReactNode;
  userId?: string | null;
  workspaceId?: string | null;
  baseUrl?: string;
}

export function RealtimeProvider({
  children,
  userId,
  workspaceId,
  baseUrl,
}: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const [bus] = useState(() => new RealtimeEventBus());
  const [client, setClient] = useState<RealtimeClient | null>(null);
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>('disconnected');

  // Initialize RealtimeClient
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      if (client) {
        client.dispose();
        setClient(null);
        setConnectionState('disconnected');
      }
      return;
    }

    const instance = new RealtimeClient({
      bus,
      workspaceId,
      baseUrl,
      autoConnect: true,
    });

    setConnectionState(instance.getState());
    const unsubState = instance.onStateChange((state) => {
      setConnectionState(state);
    });

    setClient(instance);

    return () => {
      unsubState();
      instance.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, baseUrl]);

  // Sync workspace updates
  useEffect(() => {
    if (client) {
      client.setWorkspace(workspaceId ?? null);
    }
  }, [client, workspaceId]);

  // Automated TanStack Query Cache Integration
  useEffect(() => {
    const ws = workspaceId ?? '';

    // 1. Notification Created
    const unsubNotifCreated = bus.on<NotificationCreatedPayload>(
      RealtimeEventType.NotificationCreated,
      (event: RealtimeEvent<NotificationCreatedPayload>) => {
        const payload = event.payload;
        if (!payload || !payload.notification) return;

        // Invalidate or patch unread counts
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.unreadCount(ws),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.list(ws, false),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.list(ws, true),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.feed(ws),
        });
      },
    );

    // 2. Notification Read
    const unsubNotifRead = bus.on<NotificationReadPayload>(
      RealtimeEventType.NotificationRead,
      () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.unreadCount(ws),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.list(ws, false),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.list(ws, true),
        });
      },
    );

    // 3. Task Created / Updated / Deleted / Assigned / Kanban
    const unsubTaskCreated = bus.on<TaskCreatedPayload>(
      RealtimeEventType.TaskCreated,
      () => {
        queryClient.invalidateQueries({
          queryKey: ['work-tools', ws, 'tasks'],
        });
      },
    );

    const unsubTaskUpdated = bus.on<TaskUpdatedPayload>(
      RealtimeEventType.TaskUpdated,
      (event: RealtimeEvent<TaskUpdatedPayload>) => {
        const taskId = event.payload?.taskId;
        if (taskId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.workTools.task(ws, taskId),
          });
        }
        queryClient.invalidateQueries({
          queryKey: ['work-tools', ws, 'tasks'],
        });
      },
    );

    const unsubTaskDeleted = bus.on<TaskDeletedPayload>(
      RealtimeEventType.TaskDeleted,
      () => {
        queryClient.invalidateQueries({
          queryKey: ['work-tools', ws, 'tasks'],
        });
      },
    );

    const unsubKanban = bus.on(RealtimeEventType.KanbanUpdated, () => {
      queryClient.invalidateQueries({
        queryKey: ['work-tools', ws, 'tasks'],
      });
    });

    // 4. Comments
    const unsubComment = bus.on<CommentCreatedPayload>(
      RealtimeEventType.CommentCreated,
      (event: RealtimeEvent<CommentCreatedPayload>) => {
        const taskId = event.payload?.taskId;
        if (taskId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.workTools.taskComments(ws, taskId),
          });
        }
      },
    );

    // 5. Projects
    const unsubProject = bus.on<ProjectUpdatedPayload>(
      RealtimeEventType.ProjectUpdated,
      (event: RealtimeEvent<ProjectUpdatedPayload>) => {
        const projectId = event.payload?.projectId;
        if (projectId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.workTools.project(ws, projectId),
          });
        }
        queryClient.invalidateQueries({
          queryKey: ['work-tools', ws, 'projects'],
        });
      },
    );

    // 6. Channels
    const unsubChannelCreated = bus.on(
      RealtimeEventType.ChannelCreated,
      () => {
        queryClient.invalidateQueries({
          queryKey: ['channels', ws],
        });
      },
    );
    const unsubChannelUpdated = bus.on(
      RealtimeEventType.ChannelUpdated,
      () => {
        queryClient.invalidateQueries({
          queryKey: ['channels', ws],
        });
      },
    );
    const unsubChannelDeleted = bus.on(
      RealtimeEventType.ChannelDeleted,
      () => {
        queryClient.invalidateQueries({
          queryKey: ['channels', ws],
        });
      },
    );

    // 7. Workspace Members & Invitations
    const unsubMember = bus.on(
      RealtimeEventType.WorkspaceMemberUpdated,
      () => {
        queryClient.invalidateQueries({
          queryKey: ['members', ws],
        });
      },
    );
    const unsubInvite = bus.on(
      RealtimeEventType.InvitationCreated,
      () => {
        queryClient.invalidateQueries({
          queryKey: ['invitations', ws],
        });
      },
    );

    return () => {
      unsubNotifCreated();
      unsubNotifRead();
      unsubTaskCreated();
      unsubTaskUpdated();
      unsubTaskDeleted();
      unsubKanban();
      unsubComment();
      unsubProject();
      unsubChannelCreated();
      unsubChannelUpdated();
      unsubChannelDeleted();
      unsubMember();
      unsubInvite();
    };
  }, [bus, queryClient, workspaceId]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      client,
      connectionState,
      isConnected: connectionState === 'connected',
      bus,
    }),
    [client, connectionState, bus],
  );

  return (
    <RealtimeContext.Provider value={value}>
      <PresenceProvider userId={userId} workspaceId={workspaceId} bus={bus}>
        {children}
      </PresenceProvider>
    </RealtimeContext.Provider>
  );
}

// --- Presence Provider -----------------------------------------------------

export interface PresenceProviderProps {
  children: ReactNode;
  userId?: string | null;
  workspaceId?: string | null;
  bus: RealtimeEventBus;
}

export function PresenceProvider({
  children,
  userId,
  workspaceId,
  bus,
}: PresenceProviderProps) {
  const [presenceService, setPresenceService] =
    useState<PresenceService | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>(
    {},
  );

  useEffect(() => {
    const service = new PresenceService({
      bus,
      userId,
      workspaceId,
    });

    setPresenceService(service);
    setPresenceMap(service.getAllPresence());

    const unsub = service.onPresenceChange((_uid, _presence) => {
      setPresenceMap({ ...service.getAllPresence() });
    });

    return () => {
      unsub();
      service.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, bus]);

  useEffect(() => {
    if (presenceService) {
      presenceService.setContext(userId ?? null, workspaceId ?? null);
    }
  }, [presenceService, userId, workspaceId]);

  const getPresence = useCallback(
    (uid: string): UserPresence => {
      if (presenceMap[uid]) return presenceMap[uid];
      if (presenceService) return presenceService.getPresence(uid);
      return {
        userId: uid,
        status: 'offline',
        lastSeenAt: null,
      };
    },
    [presenceMap, presenceService],
  );

  const isOnline = useCallback(
    (uid: string): boolean => {
      return getPresence(uid).status === 'online';
    },
    [getPresence],
  );

  const setLocalPresence = useCallback(
    async (
      status: 'online' | 'away' | 'busy' | 'offline',
      statusText?: string,
      statusEmoji?: string,
    ) => {
      if (presenceService) {
        await presenceService.setLocalPresence(status, statusText, statusEmoji);
      }
    },
    [presenceService],
  );

  const value = useMemo<PresenceContextValue>(
    () => ({
      presenceService,
      presenceMap,
      getPresence,
      isOnline,
      setLocalPresence,
    }),
    [presenceService, presenceMap, getPresence, isOnline, setLocalPresence],
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

// --- Reusable Hooks --------------------------------------------------------

/**
 * Access the core real-time connection state and event bus.
 */
export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return ctx;
}

/**
 * Subscribe to a specific real-time event type with automatic cleanup.
 */
export function useRealtimeSubscription<T = any>(
  eventType: RealtimeEventType | string,
  handler: RealtimeEventHandler<T>,
  deps: React.DependencyList = [],
): void {
  const { bus } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsub = bus.on<T>(eventType, (e) => {
      handlerRef.current(e);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, eventType, ...deps]);
}

/**
 * Access live user presence state.
 * If userId is passed, returns that user's specific presence details.
 */
export function usePresence(userId?: string) {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }

  const userPresence = userId ? ctx.getPresence(userId) : null;

  return {
    presence: userPresence,
    status: userPresence?.status ?? 'offline',
    isOnline: userPresence?.status === 'online',
    isAway: userPresence?.status === 'away',
    isOffline: userPresence?.status === 'offline' || !userPresence,
    lastSeenAt: userPresence?.lastSeenAt ?? null,
    presenceMap: ctx.presenceMap,
    getPresence: ctx.getPresence,
    setLocalPresence: ctx.setLocalPresence,
  };
}

/**
 * Quick boolean / status indicator hook for avatars and member lists.
 */
export function useOnlineStatus(userId: string | undefined): 'online' | 'away' | 'busy' | 'offline' {
  const ctx = useContext(PresenceContext);
  if (!ctx || !userId) return 'offline';
  const presence = ctx.getPresence(userId);
  return presence.status ?? 'offline';
}

/**
 * Hook to retrieve the entire workspace presence map.
 */
export function useUserPresenceMap(): Record<string, UserPresence> {
  const ctx = useContext(PresenceContext);
  return ctx?.presenceMap ?? {};
}
