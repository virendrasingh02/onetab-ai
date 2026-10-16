import { agentsApi } from '@org/api-client';
import type { StudioTemplate } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useStudioSession } from '../session-guard.js';

/** The agent templates the API offers this workspace. */
export function useStudioTemplates() {
  const { activeWorkspace } = useStudioSession();
  const query = useQuery<StudioTemplate[]>({
    queryKey: ['agent-templates', activeWorkspace.id],
    queryFn: () => agentsApi.listTemplates(activeWorkspace.id),
    staleTime: 10 * 60_000,
  });
  return { templates: query.data ?? [], isLoading: query.isLoading, error: query.error };
}
