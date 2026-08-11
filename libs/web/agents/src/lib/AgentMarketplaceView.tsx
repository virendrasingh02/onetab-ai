import {
  toggleRegistryItem,
  useInstalledAgents,
  type RegistryItem,
} from '@org/hooks';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Page,
  PageHeader,
  SegmentedControl,
} from '@org/ui';
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

export interface AgentCard {
  id: string;
  name: string;
  role: string;
  description: string;
  tools: string[];
  provider: string;
}

/**
 * The pre-built catalogue — agents that ship with the workspace so a new
 * workspace has something to deploy before anyone opens the builder.
 */
const marketplaceAgents: AgentCard[] = [
  {
    id: '1',
    name: 'Agile sprint manager',
    role: 'Scrum master',
    description:
      'Summarises task progress, flags overdue work and organises sprint backlogs.',
    tools: ['create_task', 'search_docs', 'send_channel_message'],
    provider: 'ollama',
  },
  {
    id: '2',
    name: 'Code sentinel & reviewer',
    role: 'Tech lead',
    description:
      'Reviews pull requests, checks for security issues and writes documentation.',
    tools: ['search_docs', 'send_channel_message'],
    provider: 'openai',
  },
  {
    id: '3',
    name: 'Workspace knowledge curator',
    role: 'Docs architect',
    description:
      'Indexes workspace documents into vector storage and answers queries.',
    tools: ['search_docs'],
    provider: 'anthropic',
  },
];

type AgentTab = 'deployed' | 'prebuilt';

export function AgentMarketplaceView() {
  /*
   * Which agents are deployed lives in the shared registry rather than in local
   * state: the sidebar lists the deployed ones, and toggling here used to be
   * forgotten the moment you navigated away.
   */
  const [installed, saveInstalled] = useInstalledAgents();
  const [tab, setTab] = useState<AgentTab>('deployed');
  const navigate = useNavigate();

  /* Relative to the `agents` route, so the `/w/:workspaceSlug` prefix does not
     have to be rebuilt here. */
  const openBuilder = () => navigate('builder');

  const toggleInstall = (agent: AgentCard) =>
    saveInstalled(
      toggleRegistryItem(installed, {
        id: agent.id,
        name: agent.name,
        icon: 'Bot',
        detail: agent.role,
      }),
    );

  const remove = (id: string) =>
    saveInstalled(installed.filter((entry) => entry.id !== id));

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
            label: `Pre-built (${marketplaceAgents.length})`,
            hint: 'Agents that ship with the workspace, ready to deploy.',
          },
        ]}
      />

      {tab === 'deployed' ? (
        <DeployedAgents
          agents={installed}
          onNew={openBuilder}
          onBrowse={() => setTab('prebuilt')}
          onLogs={() => navigate('logs')}
          onRemove={remove}
        />
      ) : (
        <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
          {marketplaceAgents.map((agent) => (
            <li key={agent.id}>
              <PrebuiltAgentCard
                agent={agent}
                installed={installed.some((entry) => entry.id === agent.id)}
                onToggle={() => toggleInstall(agent)}
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
  agents: RegistryItem[];
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
        /* Anything not in the catalogue came out of the builder. */
        const fromCatalogue = marketplaceAgents.some(
          (entry) => entry.id === agent.id,
        );

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
                      {agent.detail ?? 'Agent'}
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
  agent: AgentCard;
  installed: boolean;
  onToggle: () => void;
}) {
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
            {agent.provider}
          </Badge>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {agent.description}
        </p>

        <ul
          aria-label={`Tools available to ${agent.name}`}
          className="mb-4 gap-1 flex flex-wrap"
        >
          {agent.tools.map((tool) => (
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
