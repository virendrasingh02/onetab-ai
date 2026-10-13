import { coworkerTemplateKey, type AICoworkerDetail } from '@org/types';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useMemo } from 'react';
import { useCoworkers } from './use-coworkers.js';

/**
 * The workspace's built-in Assistant coworker — the same `AIAgent` row, Matrix
 * identity and DM room as any other coworker, seeded into every workspace.
 * AI Home and the docked copilot are views onto that one conversation.
 *
 * `useCoworkers` seeds the defaults on first listing, so the row may need a
 * moment (or a refetch) on a brand-new workspace.
 */
export function useAssistantCoworker() {
  const { workspaceId } = useCurrentWorkspace();
  const query = useCoworkers(workspaceId);
  const assistant = useMemo<AICoworkerDetail | undefined>(
    () =>
      query.data?.find(
        (cw) => coworkerTemplateKey(cw.configuration) === 'assistant',
      ),
    [query.data],
  );
  return { assistant, workspaceId, ...query };
}
