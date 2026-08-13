import type { AIAgentDetail } from '@org/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  SkeletonList,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Activity, Bot, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAgentMutations, useAgents } from './use-agents.js';

export function AgentMarketplaceView() {
  const { workspaceId } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const { remove } = useAgentMutations(workspaceId);

  const navigate = useNavigate();

  /* Relative to the `agents` route, so the `/w/:workspaceSlug` prefix does not
     have to be rebuilt here. */
  const openBuilder = () => navigate('builder');

  const installed = agents.data ?? [];

  return (
    <Page>
      <PageHeader
        title="Agents"
        description="Deploy specialised autonomous agents into your workspace."
        icon={<Bot />}
        accent="blue"
        actions={
          <Button leadingIcon={<Plus />} onClick={openBuilder}>
            New agent
          </Button>
        }
      />

      {agents.isLoading ? (
        <SkeletonList rows={3} />
      ) : agents.isError ? (
        <ErrorState
          title="Could not load your agents"
          description="Something went wrong reaching the server."
          onRetry={() => agents.refetch()}
        />
      ) : (
        <DeployedAgents
          agents={installed}
          onNew={openBuilder}
          onLogs={() => navigate('logs')}
          onRemove={(id) => remove.mutate(id)}
        />
      )}
    </Page>
  );
}

/* --------------------------------------------------------------- parts ---- */

function DeployedAgents({
  agents,
  onNew,
  onLogs,
  onRemove,
}: {
  agents: AIAgentDetail[];
  onNew: () => void;
  onLogs: () => void;
  onRemove: (id: string) => void;
}) {
  if (agents.length === 0) {
    return (
      <EmptyState
        icon={<Bot />}
        title="No agents deployed yet"
        description="Build one in the agent builder to give this workspace its first autonomous agent."
        action={
          <Button leadingIcon={<Plus />} onClick={onNew}>
            New agent
          </Button>
        }
      />
    );
  }

  return (
    <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
      {agents.map((agent) => {
        /* `isMarketplace` is set on rows deployed from the catalogue; anything
           else came out of the builder. */
        const fromCatalogue = agent.isMarketplace;

        return (
          <li key={agent.id}>
            <Card className="p-5 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
              <div className="mb-4 gap-2 flex items-start justify-between">
                <div className="min-w-0 gap-2.5 flex items-center">
                  <span
                    aria-hidden
                    className="size-9 flex shrink-0 items-center justify-center rounded-lg bg-accent-blue-soft text-accent-blue"
                  >
                    <Bot className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold truncate text-foreground">
                      {agent.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {agent.role || 'Agent'}
                    </p>
                  </div>
                </div>
                <Badge variant={fromCatalogue ? 'neutral' : 'primary'}>
                  {fromCatalogue ? 'Pre-built' : 'Custom'}
                </Badge>
              </div>

              <div className="gap-2 flex">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={onLogs}
                  leadingIcon={<Activity />}
                >
                  Activity
                  <span className="sr-only"> — {agent.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(agent.id)}
                  title={`Remove ${agent.name}`}
                >
                  <Trash2 className="text-destructive" aria-hidden />
                  <span className="sr-only">Remove {agent.name}</span>
                </Button>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
