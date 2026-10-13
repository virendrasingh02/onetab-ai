import { aiExecutionsApi, approvalsApi } from '@org/api-client';
import { toast } from '@org/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type RunAction = 'pause' | 'resume' | 'cancel' | 'retry';

/**
 * The run-control and approval-decision mutations shared by the Studio run
 * console and the Copilot run card. `surface` only names where the decision
 * was made, in the approval's audit comment.
 */
export function useCanvasRunControls({
  workspaceId,
  runId,
  setRunId,
  surface,
}: {
  workspaceId: string;
  runId: string | null;
  setRunId: (runId: string) => void;
  surface: 'Studio' | 'Copilot';
}) {
  const queryClient = useQueryClient();
  const refreshRun = () =>
    queryClient.invalidateQueries({ queryKey: ['canvas-run', workspaceId] });

  const control = useMutation({
    mutationFn: async (action: RunAction) => {
      if (!runId) return;
      if (action === 'retry') {
        const retried = (await aiExecutionsApi.retry(workspaceId, runId)) as {
          executionId?: string;
        };
        if (retried.executionId) setRunId(retried.executionId);
        return;
      }
      await aiExecutionsApi[action](workspaceId, runId);
    },
    onSettled: refreshRun,
    meta: { errorMessage: 'That didn’t work on this run.' },
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      approvalsApi.decide(workspaceId, id, {
        decision,
        comment: `${decision === 'APPROVED' ? 'Approved' : 'Rejected'} in the ${surface}`,
      }),
    onSuccess: (_d, v) => {
      toast.success(
        v.decision === 'APPROVED'
          ? 'Approved — the run continues.'
          : 'Rejected — the run stops here.',
      );
      refreshRun();
    },
    meta: { errorMessage: 'Couldn’t record the decision.' },
  });

  return { control, decide };
}
