import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@org/auth';
import { useChatPreferences } from '@org/common';
import {
  channelAgentsApi,
  channelAppsApi,
  channelApi,
  coworkersApi,
  queryKeys,
} from '@org/api-client';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  canManageChannelMembers,
  evaluateMention,
  type ComposerContext,
  type ComposerReachability,
  type DetectedMention,
  type RoomMember,
  type WorkspaceRole,
} from '@org/types';
import {
  useComposerWarningStore,
  type ComposerWarningState,
  type ComposerWarningTarget,
} from '@org/chat-ui';

export interface ComposerControlResult {
  warning: ComposerWarningState | null;
  dismissWarning: () => void;
  onMentionsChange: (mentions: DetectedMention[]) => void;
  viewerCanManage: boolean;
}

export function useComposerControl(
  context: ComposerContext | undefined,
  members: RoomMember[] = [],
): ComposerControlResult {
  const currentUser = useCurrentUser();
  const currentWorkspace = useCurrentWorkspace();
  const { chat } = useChatPreferences();
  const [currentMentions, setCurrentMentions] = useState<DetectedMention[]>([]);

  const workspaceId = context?.workspaceId ?? currentWorkspace.workspaceId;
  const channelId = context?.channelId;
  /*
   * A thread reply's `ComposerContext` carries the parent channel's
   * `channelId` (see `chat-surface.tsx`'s `threadComposerContext`), so a
   * thread inside a channel should get the exact same reachable-members /
   * linked-agent / viewer-can-manage data the channel's own composer gets —
   * gating this on `surfaceKind === 'channel'` alone silently dropped all of
   * it for threads, so mentioning an unlinked agent in a channel thread never
   * warned or offered "Add to channel". Cross-room thread contexts (see
   * `ThreadsView`'s inbox) carry no `channelId`, so they correctly fall
   * through to the non-channel branch below.
   */
  const isChannel = !!workspaceId && !!channelId;

  // Channel members query to determine viewer's channelRole
  const channelMembersQuery = useQuery({
    queryKey: queryKeys.channels.members(workspaceId ?? '', channelId ?? ''),
    queryFn: () => channelApi.members(workspaceId as string, channelId as string),
    enabled: isChannel,
    staleTime: 30_000,
  });

  // Channel linked agents
  const channelAgentsQuery = useQuery({
    queryKey: queryKeys.channels.agents(workspaceId ?? '', channelId ?? ''),
    queryFn: () => channelAgentsApi.list(workspaceId as string, channelId as string),
    enabled: isChannel,
    staleTime: 30_000,
  });

  // Channel linked coworkers
  const channelCoworkersQuery = useQuery({
    queryKey: queryKeys.channels.coworkers(workspaceId ?? '', channelId ?? ''),
    queryFn: () =>
      coworkersApi.listChannelCoworkers(workspaceId as string, channelId as string),
    enabled: isChannel,
    staleTime: 30_000,
  });

  // Channel linked apps
  const channelAppsQuery = useQuery({
    queryKey: queryKeys.channels.apps(workspaceId ?? '', channelId ?? ''),
    queryFn: () =>
      channelAppsApi.list(workspaceId as string, channelId as string),
    enabled: isChannel,
    staleTime: 30_000,
  });

  // Viewer permission calculation
  const viewerCanManage = useMemo(() => {
    if (!isChannel) return false;
    const member = channelMembersQuery.data?.find(
      (m) => m.user.id === currentUser?.id,
    );
    return canManageChannelMembers({
      channelRole: member?.role ?? null,
      workspaceRole: (currentWorkspace.role as WorkspaceRole) ?? null,
    });
  }, [
    isChannel,
    channelMembersQuery.data,
    currentUser?.id,
    currentWorkspace.role,
  ]);

  // Reachable sets per kind
  const reachable = useMemo<ComposerReachability>(() => {
    const userIds = new Set(members.map((m) => m.userId));

    if (!isChannel) {
      return {
        userIds,
        agentIds: new Set(),
        coworkerIds: new Set(),
        appIds: new Set(),
      };
    }

    const agentIds = new Set(
      (channelAgentsQuery.data ?? [])
        .filter((a) => a.isEnabled)
        .map((a) => a.agentId),
    );

    const coworkerIds = new Set(
      (channelCoworkersQuery.data ?? [])
        .filter((c) => c.isEnabled)
        .map((c) => c.coworkerId),
    );

    const appIds = new Set(
      (channelAppsQuery.data ?? [])
        .filter((app) => app.isEnabled)
        .map((app) => app.integrationId),
    );

    return {
      userIds,
      agentIds,
      coworkerIds,
      appIds,
    };
  }, [
    members,
    isChannel,
    channelAgentsQuery.data,
    channelCoworkersQuery.data,
    channelAppsQuery.data,
  ]);

  // Unreachable targets calculation
  const targets = useMemo<ComposerWarningTarget[]>(() => {
    if (
      !context ||
      currentMentions.length === 0 ||
      chat?.mentionWarningsEnabled === false
    ) {
      return [];
    }
    const list: ComposerWarningTarget[] = [];
    const seen = new Set<string>();

    for (const mention of currentMentions) {
      if (seen.has(mention.id)) continue;
      seen.add(mention.id);

      const evaluation = evaluateMention(mention, {
        surfaceKind: context.surfaceKind,
        reachable,
        viewerCanManage,
      });

      if (!evaluation.reachable) {
        list.push({
          id: mention.id,
          name: mention.displayName || mention.id,
          kind: mention.kind,
          addAction: evaluation.addAction,
        });
      }
    }

    return list;
  }, [
    context,
    currentMentions,
    reachable,
    viewerCanManage,
    chat?.mentionWarningsEnabled,
  ]);

  const signature = useMemo(
    () => targets.map((t) => t.id).sort().join(','),
    [targets],
  );

  const conversationKey =
    context?.roomId ?? context?.channelId ?? context?.peerId ?? '';

  const isDismissed = useComposerWarningStore((s) =>
    s.isDismissed(conversationKey, signature),
  );

  const warning = useMemo<ComposerWarningState | null>(() => {
    if (targets.length === 0 || isDismissed) return null;
    return { targets };
  }, [targets, isDismissed]);

  const dismissWarning = useCallback(() => {
    if (conversationKey && signature) {
      useComposerWarningStore.getState().dismiss(conversationKey, signature);
    }
  }, [conversationKey, signature]);

  const onMentionsChange = useCallback((mentions: DetectedMention[]) => {
    setCurrentMentions(mentions);
  }, []);

  return {
    warning,
    dismissWarning,
    onMentionsChange,
    viewerCanManage,
  };
}
