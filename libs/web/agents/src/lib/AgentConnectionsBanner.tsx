import { Button } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Plug } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAgentConnections } from './use-agents.js';

/**
 * Shown above a conversation with a published agent when it acts in apps the
 * signed-in member hasn't connected. The agent works through each person's own
 * accounts, so each member connects once; nothing renders when all are set.
 */
export function AgentConnectionsBanner({ agentId }: { agentId: string }) {
  const { workspaceId, slug } = useCurrentWorkspace();
  const navigate = useNavigate();
  const { data } = useAgentConnections(workspaceId, agentId);

  const missing = (data ?? []).filter((app) => !app.connected);
  if (missing.length === 0) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
      <Plug className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-foreground">
        Connect your {missing.map((app) => app.label).join(', ')}{' '}
        <span className="text-muted-foreground">
          so this agent can work in your account.
        </span>
      </p>
      <Button
        size="sm"
        onClick={() => navigate(`/w/${slug}/integrations`)}
      >
        Connect
      </Button>
    </div>
  );
}
