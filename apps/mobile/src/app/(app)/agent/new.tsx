import { agentsApi, queryKeys } from '@org/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert } from '../../../lib/alert';
import { AgentForm } from '../../../components/agent-form';
import { AppText, Screen } from '../../../components/ui';
import { useWorkspace } from '../../../lib/workspace';

export default function NewAgentScreen() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (values: {
      name: string;
      role: string;
      description: string;
      systemPrompt: string;
      welcomeMessage: string;
    }) =>
      agentsApi
        .create(workspaceId, {
          name: values.name,
          role: values.role || undefined,
          description: values.description || undefined,
          systemPrompt: values.systemPrompt || undefined,
        })
        .then(async (agent) => {
          if (values.welcomeMessage) {
            await agentsApi.update(workspaceId, agent.id, {
              welcomeMessage: values.welcomeMessage,
            });
          }
          return agent;
        }),
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agents.all(workspaceId),
      });
      router.replace({
        pathname: '/agent/[agentId]',
        params: { agentId: agent.id },
      });
    },
    // Plan limits and permissions are enforced by the API; show its reason.
    onError: (error) =>
      Alert.alert('Could not create the agent', error.message),
  });

  return (
    <Screen>
      <AppText variant="muted">
        Start with the basics here. Tools, knowledge and multi-step graphs are
        configured in AI Agent Studio on the web.
      </AppText>
      <AgentForm
        initial={{
          name: '',
          role: '',
          description: '',
          systemPrompt: '',
          welcomeMessage: '',
        }}
        submitLabel="Create agent"
        submitting={create.isPending}
        onSubmit={(values) => create.mutate(values)}
      />
    </Screen>
  );
}
