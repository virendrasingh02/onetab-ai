import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  channelApi,
  channelAgentsApi,
  channelAppsApi,
  coworkersApi,
  queryKeys,
} from '@org/api-client';
import { ChannelRole, type AddAction } from '@org/types';
import { toast } from '@org/ui';
import { useMatrix } from './matrix-provider.js';
import { useCreateConversation } from './use-create-conversation.js';

export interface UseComposerAddActionsOptions {
  workspaceId?: string;
  channelId?: string;
  roomId?: string | null;
  peerId?: string;
  slug?: string;
}

export function useComposerAddActions({
  workspaceId,
  channelId,
  roomId,
  peerId,
  slug,
}: UseComposerAddActionsOptions) {
  const { client } = useMatrix();
  const createConversation = useCreateConversation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleAdd = useCallback(
    async (targetId: string, addAction: AddAction) => {
      try {
        switch (addAction) {
          case 'channel-member': {
            if (!workspaceId || !channelId) {
              toast.error('Channel not found.');
              return;
            }
            await channelApi.addMembers(workspaceId, channelId, {
              userIds: [targetId],
              role: ChannelRole.MEMBER,
            });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.channels.members(workspaceId, channelId),
            });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.channels.all(workspaceId),
            });
            toast.success('Member added to channel.');
            break;
          }

          case 'channel-agent': {
            if (!workspaceId || !channelId) {
              toast.error('Channel not found.');
              return;
            }
            if (targetId.startsWith('coworker-')) {
              await coworkersApi.addChannelCoworker(
                workspaceId,
                channelId,
                targetId,
              );
              await queryClient.invalidateQueries({
                queryKey: queryKeys.channels.coworkers(workspaceId, channelId),
              });
              toast.success('AI Coworker connected to channel.');
            } else {
              await channelAgentsApi.add(workspaceId, channelId, targetId);
              await queryClient.invalidateQueries({
                queryKey: queryKeys.channels.agents(workspaceId, channelId),
              });
              toast.success('AI Agent added to channel.');
            }
            break;
          }

          case 'channel-app': {
            if (!workspaceId || !channelId) {
              toast.error('Channel not found.');
              return;
            }
            await channelAppsApi.add(workspaceId, channelId, targetId);
            await queryClient.invalidateQueries({
              queryKey: queryKeys.channels.apps(workspaceId, channelId),
            });
            toast.success('App connected to channel.');
            break;
          }

          case 'group-dm-member': {
            if (!client || !roomId) {
              toast.error('Conversation not connected.');
              return;
            }
            await client.addToGroupDirectMessage(roomId, [targetId]);
            toast.success('Person added to conversation.');
            break;
          }

          case 'start-group': {
            if (!peerId) {
              toast.error('Current peer not identified.');
              return;
            }
            const result = await createConversation.mutateAsync({
              peerIds: [peerId, targetId],
            });
            toast.success('Started a group conversation.');
            if (slug) {
              navigate(`/w/${slug}/dms?room=${result.roomId}`);
            } else {
              navigate(`?room=${result.roomId}`);
            }
            break;
          }

          default:
            break;
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Action could not be completed.';
        toast.error(message);
      }
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

  return { handleAdd };
}
