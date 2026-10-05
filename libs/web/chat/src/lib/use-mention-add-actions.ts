import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  channelApi,
  channelAgentsApi,
  channelAppsApi,
  coworkersApi,
  matrixApi,
  queryKeys,
} from '@org/api-client';
import { ChannelRole, toPlatformUserId } from '@org/types';
import { toast } from '@org/ui';
import type { MentionNoticeTarget } from '@org/chat-ui';
import { useMatrix } from './matrix-provider.js';
import { useCreateConversation } from './use-create-conversation.js';

export interface UseMentionAddActionsOptions {
  workspaceId?: string;
  channelId?: string;
  roomId?: string | null;
  peerId?: string;
  slug?: string;
}

export interface MentionAddResult {
  /** Ids of the targets that were added. */
  added: string[];
  /** The first failure, worded for the notice. Unset when everything worked. */
  error?: string;
}

function describeError(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'That could not be completed. Try again.';
}

/**
 * Adds the people, agents, coworkers and apps a mention notice is about to the
 * conversation, in as few requests as possible: every person in one
 * `addMembers` call, one group for a DM, one call per agent/app (those
 * endpoints take one at a time). Never throws — partial success is normal, so
 * it reports what was added and the first thing that failed.
 */
export function useMentionAddActions({
  workspaceId,
  channelId,
  roomId,
  peerId,
  slug,
}: UseMentionAddActionsOptions): (
  targets: readonly MentionNoticeTarget[],
) => Promise<MentionAddResult> {
  const { client } = useMatrix();
  const createConversation = useCreateConversation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(
    async (targets) => {
      const added: string[] = [];
      let error: string | undefined;
      const fail = (err: unknown) => {
        error ??= typeof err === 'string' ? err : describeError(err);
      };
      const of = (action: MentionNoticeTarget['addAction']) =>
        targets.filter((target) => target.addAction === action);

      const needsChannel =
        of('channel-member').length +
          of('channel-agent').length +
          of('channel-app').length >
        0;
      if (needsChannel && (!workspaceId || !channelId)) {
        return { added, error: 'Channel not found.' };
      }
      const ws = workspaceId as string;
      const ch = channelId as string;

      const people = of('channel-member');
      if (people.length > 0) {
        try {
          await channelApi.addMembers(ws, ch, {
            userIds: people.map((person) => toPlatformUserId(person.id)),
            role: ChannelRole.MEMBER,
          });
          added.push(...people.map((person) => person.id));
          void queryClient.invalidateQueries({
            queryKey: queryKeys.channels.members(ws, ch),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.channels.all(ws),
          });
        } catch (err) {
          fail(err);
        }
      }

      // Agents and coworkers share the `channel-agent` action but not an
      // endpoint — dispatch on what the mention actually is.
      for (const target of of('channel-agent')) {
        try {
          if (target.kind === 'coworker') {
            await coworkersApi.addChannelCoworker(ws, ch, target.id);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.channels.coworkers(ws, ch),
            });
          } else {
            await channelAgentsApi.add(ws, ch, target.id);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.channels.agents(ws, ch),
            });
          }
          added.push(target.id);
        } catch (err) {
          fail(err);
        }
      }

      for (const target of of('channel-app')) {
        try {
          await channelAppsApi.add(ws, ch, target.id);
          void queryClient.invalidateQueries({
            queryKey: queryKeys.channels.apps(ws, ch),
          });
          added.push(target.id);
        } catch (err) {
          fail(err);
        }
      }

      const groupInvitees = of('group-dm-member');
      if (groupInvitees.length > 0) {
        if (!client || !roomId) {
          fail('Conversation not connected.');
        } else {
          try {
            // Matrix invites need the bridged Matrix id, not the platform id.
            const identities = await Promise.all(
              groupInvitees.map((person) =>
                matrixApi.peerIdentity(toPlatformUserId(person.id)),
              ),
            );
            await client.addToGroupDirectMessage(
              roomId,
              identities.map((identity) => identity.matrixUserId),
            );
            added.push(...groupInvitees.map((person) => person.id));
          } catch (err) {
            fail(err);
          }
        }
      }

      const newGroup = of('start-group');
      if (newGroup.length > 0) {
        if (!peerId) {
          fail('Could not tell who this conversation is with.');
        } else {
          try {
            const result = await createConversation.mutateAsync({
              peerIds: [
                peerId,
                ...newGroup.map((person) => toPlatformUserId(person.id)),
              ],
            });
            added.push(...newGroup.map((person) => person.id));
            toast.success('Started a group conversation.');
            navigate(
              slug
                ? `/w/${slug}/dms?room=${result.roomId}`
                : `?room=${result.roomId}`,
            );
          } catch (err) {
            fail(err);
          }
        }
      }

      return { added, error };
    },
    [
      workspaceId,
      channelId,
      roomId,
      peerId,
      slug,
      client,
      createConversation,
      navigate,
      queryClient,
    ],
  );
}
