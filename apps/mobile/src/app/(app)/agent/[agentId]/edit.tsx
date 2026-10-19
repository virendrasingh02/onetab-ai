import { agentsApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from '../../../../lib/alert';
import { AgentForm } from '../../../../components/agent-form';
import { QueryBoundary, Screen } from '../../../../components/ui';
import { useWorkspace } from '../../../../lib/workspace';

export default function EditAgentScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();

  const agent = useQuery({
    queryKey: queryKeys.agents.detail(workspaceId, agentId),
    queryFn: () => agentsApi.get(workspaceId, agentId),
  });

  const save = useMutation({
    mutationFn: (values: {
      name: string;
      role: string;
      description: string;
      systemPrompt: string;
      welcomeMessage: string;
    }) => agentsApi.update(workspaceId, agentId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agents.all(workspaceId),
      });
      router.back();
    },
    onError: (error) => Alert.alert('Could not save', error.message),
  });

  return (
    <Screen>
      <QueryBoundary query={agent}>
        {(a) => (
          <AgentForm
            initial={{
              name: a.name,
              role: a.role ?? '',
              description: a.description ?? '',
              systemPrompt: a.systemPrompt ?? '',
              welcomeMessage: a.welcomeMessage ?? '',
            }}
            submitLabel="Save changes"
            submitting={save.isPending}
            onSubmit={(values) => save.mutate(values)}
          />
        )}
      </QueryBoundary>
    </Screen>
  );
}
