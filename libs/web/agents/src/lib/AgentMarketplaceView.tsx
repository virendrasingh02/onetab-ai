import type { AIAgentDetail, MarketplaceAgent } from '@org/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  SegmentedControl,
  SkeletonList,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Activity,
  Bot,
  Cpu,
  Download,
  Plus,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentCatalogue, useAgentMutations, useAgents } from './use-agents.js';

/** `tools` crosses the wire as a JSON-encoded array of tool names. */
function parseTools(tools: string): string[] {
  try {
    const parsed: unknown = JSON.parse(tools);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

type AgentTab = 'deployed' | 'prebuilt';

export function AgentMarketplaceView() {
  const { workspaceId } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const catalogue = useAgentCatalogue();
  const { create, remove } = useAgentMutations(workspaceId);

  const [tab, setTab] = useState<AgentTab>('deployed');
  const navigate = useNavigate();

  /* Relative to the `agents` route, so the `/w/:workspaceSlug` prefix does not
     have to be rebuilt here. */
  const openBuilder = () => navigate('builder');

  const installed = agents.data ?? [];
  const templates = catalogue.data ?? [];

  /*
   * Catalogue entries are templates, not rows: deploying one writes a new agent
   * with its own id. Matching on name is what tells us a template is already
   * deployed, since the ids cannot line up.
   */
  const deployedNames = new Set(installed.map((agent) => agent.name));

  const deploy = (template: MarketplaceAgent) => {
    const existing = installed.find((agent) => agent.name === template.name);
    if (existing) {
      remove.mutate(existing.id);
      return;
    }
    create.mutate({
      name: template.name,
      role: template.role,
      description: template.description,
      systemPrompt: template.systemPrompt,
      tools: parseTools(template.tools),
      isMarketplace: true,
    });
  };

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

      <SegmentedControl<AgentTab>
        aria-label="Agent list"
        value={tab}
        onChange={setTab}
        className="mb-4 self-start"
        options={[
          { value: 'deployed', label: `Your agents (${installed.length})` },
          {
            value: 'prebuilt',
            label: `Pre-built (${templates.length})`,
            hint: 'Agents that ship with the workspace, ready to deploy.',
          },
        ]}
      />

      {tab === 'deployed' ? (
        agents.isLoading ? (
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
            onBrowse={() => setTab('prebuilt')}
            onLogs={() => navigate('logs')}
            onRemove={(id) => remove.mutate(id)}
          />
        )
      ) : catalogue.isLoading ? (
        <SkeletonList rows={3} />
      ) : catalogue.isError ? (
        <ErrorState
          title="Could not load the catalogue"
          description="Something went wrong reaching the server."
          onRetry={() => catalogue.refetch()}
        />
      ) : (
        <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
          {templates.map((template) => (
            <li key={template.id}>
              <PrebuiltAgentCard
                agent={template}
                installed={deployedNames.has(template.name)}
                onToggle={() => deploy(template)}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

/* --------------------------------------------------------------- parts ---- */

function DeployedAgents({
  agents,
  onNew,
  onBrowse,
  onLogs,
  onRemove,
}: {
  agents: AIAgentDetail[];
  onNew: () => void;
  onBrowse: () => void;
  onLogs: () => void;
  onRemove: (id: string) => void;
}) {
  if (agents.length === 0) {
    return (
      <EmptyState
        icon={<Bot />}
        title="No agents deployed yet"
        description="Build one in the agent builder, or deploy one of the pre-built agents to start from something that already works."
        action={
          <Button leadingIcon={<Plus />} onClick={onNew}>
            New agent
          </Button>
        }
        secondaryAction={
          <Button variant="ghost" onClick={onBrowse}>
            Browse pre-built agents
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

function PrebuiltAgentCard({
  agent,
  installed,
  onToggle,
}: {
  agent: MarketplaceAgent;
  installed: boolean;
  onToggle: () => void;
}) {
  const tools = parseTools(agent.tools);
  return (
    <Card className="p-5 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
      <div>
        <div className="mb-3 gap-2 flex items-start justify-between">
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
              <p className="text-xs text-muted-foreground">{agent.role}</p>
            </div>
          </div>
          <Badge variant="neutral" className="font-mono uppercase">
            <Cpu className="text-accent-violet" aria-hidden />
            {tools.length} tools
          </Badge>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {agent.description}
        </p>

        <ul
          aria-label={`Tools available to ${agent.name}`}
          className="mb-4 gap-1 flex flex-wrap"
        >
          {tools.map((tool) => (
            <li key={tool}>
              <Badge variant="primary" className="font-mono">
                <Wrench aria-hidden />
                {tool}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <Button
        variant={installed ? 'outline' : 'primary'}
        size="sm"
        className="w-full"
        onClick={onToggle}
        leadingIcon={
          installed ? <ShieldCheck className="text-success" /> : <Download />
        }
      >
        {installed ? 'Deployed' : 'Deploy'}
        <span className="sr-only"> — {agent.name}</span>
      </Button>
    </Card>
  );
}
