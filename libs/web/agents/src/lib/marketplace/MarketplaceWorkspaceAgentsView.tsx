import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AIAgentDetail } from '@org/types';
import {
  AiEntityAvatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
} from '@org/ui';
import { studioWorkspacePath } from '@org/platform';
import { Activity, ExternalLink, MessageSquare, Settings2 } from 'lucide-react';
import { ActiveBadge, MARKETPLACE_GRID_CLASS } from './marketplace-ui';

interface MarketplaceWorkspaceAgentsViewProps {
  agents: AIAgentDetail[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  workspaceSlug: string;
  searchQuery: string;
  /** Opens the AI Agent Studio (optionally at a path inside its workspace area). */
  onOpenStudio: (path?: string) => void;
}

function AgentCard({
  agent,
  onOpen,
  onEdit,
  onStudio,
}: {
  agent: AIAgentDetail;
  onOpen: () => void;
  onEdit: () => void;
  onStudio: () => void;
}) {
  const description = (agent.description ?? '').trim() || 'No description yet.';
  const runs = agent._count?.logs ?? 0;

  return (
    <Card className="p-4 justify-between">
      <div>
        <div className="mb-3 gap-3 flex items-start justify-between">
          <div className="min-w-0 gap-3 flex items-center">
            <AiEntityAvatar
              name={agent.name}
              kind="agent"
              avatarUrl={agent.avatarUrl}
              size="lg"
            />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold truncate text-foreground">
                {agent.name}
              </h4>
              <p className="text-xs truncate text-muted-foreground">
                {(agent.role ?? '').trim() || 'AI agent'}
              </p>
            </div>
          </div>
          <ActiveBadge active={agent.isActive} />
        </div>

        <p className="mb-3 text-xs leading-relaxed line-clamp-2 text-muted-foreground">
          {description}
        </p>

        <div className="gap-x-3 gap-y-1 flex flex-wrap items-center">
          <Badge variant="neutral">
            {agent.isMarketplace ? 'From Marketplace' : 'Built in Studio'}
          </Badge>
          <span
            title="Runs"
            className="gap-1 text-xs inline-flex items-center text-muted-foreground"
          >
            <Activity className="size-3.5" aria-hidden />
            {runs} {runs === 1 ? 'run' : 'runs'}
          </span>
        </div>
      </div>

      <div className="mt-4 gap-2 pt-3 flex items-center justify-between border-t border-border/60">
        <Button variant="outline" size="xs" onClick={onOpen}>
          <MessageSquare aria-hidden />
          Open
        </Button>
        <div className="gap-1 flex items-center">
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <Settings2 aria-hidden />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onStudio}
            title="Open in AI Agent Studio"
          >
            <ExternalLink aria-hidden />
            Studio
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** The workspace's own AI agents — the same list the sidebar's "AI Agents" section shows. */
export const MarketplaceWorkspaceAgentsView: React.FC<
  MarketplaceWorkspaceAgentsViewProps
> = ({
  agents,
  isLoading,
  isError,
  onRetry,
  workspaceSlug,
  searchQuery,
  onOpenStudio,
}) => {
  const navigate = useNavigate();

  const visible = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(needle) ||
        (a.role ?? '').toLowerCase().includes(needle) ||
        (a.description ?? '').toLowerCase().includes(needle),
    );
  }, [agents, searchQuery]);

  if (isLoading && agents.length === 0) {
    return <LoadingState label="Loading agents…" />;
  }
  if (isError && agents.length === 0) {
    return (
      <EmptyState
        title="Couldn’t load agents"
        description="Something went wrong reaching the server."
        action={
          onRetry ? (
            <Button variant="primary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (visible.length === 0) {
    return (
      <EmptyState
        title={searchQuery ? 'No matches' : 'No agents yet'}
        description={
          searchQuery
            ? `No workspace agent matches “${searchQuery}”.`
            : 'Install one from the Marketplace below, or build your own in the AI Agent Studio.'
        }
      />
    );
  }

  return (
    <div className={MARKETPLACE_GRID_CLASS}>
      {visible.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onOpen={() => navigate(`/w/${workspaceSlug}/agents/${agent.id}/chat`)}
          onEdit={() => navigate(`/w/${workspaceSlug}/ai/agents/${agent.id}`)}
          onStudio={() =>
            onOpenStudio(studioWorkspacePath(workspaceSlug, 'agents', agent.id))
          }
        />
      ))}
    </div>
  );
};
