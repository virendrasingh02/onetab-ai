import { matrixApi } from '@org/api-client';
import { useMutation } from '@tanstack/react-query';
import { useMatrix } from './matrix-provider.js';

export type CreatedConversation =
  | { kind: 'direct'; roomId: string; peerId: string }
  | { kind: 'group'; roomId: string }
  /** The picked people already share a channel — it was reused, not duplicated. */
  | { kind: 'channel'; roomId: string };

export interface CreateConversationInput {
  /** Workspace member / agent / app ids to include. The caller is implicit. */
  peerIds: string[];
  /** Optional name for a group conversation; ignored for a 1:1. */
  name?: string;
}

/**
 * Opens a direct conversation with one or more people.
 *
 * One peer resolves to a 1:1 DM, deep-linked `?user=<id>` exactly as before;
 * two or more create — or reuse — a group DM at `?room=<roomId>`. Peer ids are
 * mapped to Matrix ids server-side first (`matrixApi.peerIdentity`), which also
 * provisions an agent or app account on first contact.
 */
export function useCreateConversation() {
  const { client } = useMatrix();

  return useMutation<CreatedConversation, Error, CreateConversationInput>({
    mutationFn: async ({ peerIds, name }) => {
      if (!client) throw new Error('Chat is not connected.');

      const unique = [...new Set(peerIds)];
      if (unique.length === 0) throw new Error('Pick at least one person.');

      const identities = await Promise.all(
        unique.map((id) => matrixApi.peerIdentity(id)),
      );
      const matrixIds = identities.map((identity) => identity.matrixUserId);

      if (matrixIds.length === 1) {
        const roomId = await client.getOrCreateDirectMessage(matrixIds[0]);
        return { kind: 'direct', roomId, peerId: unique[0] };
      }

      const roomId = await client.getOrCreateGroupDirectMessage(
        matrixIds,
        name?.trim() || undefined,
      );
      // The room may be a pre-existing channel these people already share.
      return client.getRoom(roomId)?.kind === 'channel'
        ? { kind: 'channel', roomId }
        : { kind: 'group', roomId };
    },
  });
}
