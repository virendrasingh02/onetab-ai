import { toggleRegistryItem, useInstalledAgents } from '@org/hooks';
import { Badge, Button, Card, Page, PageHeader } from '@org/ui';
import { Bot, Cpu, Download, ShieldCheck, Wrench } from 'lucide-react';

export interface AgentCard {
  id: string;
  name: string;
  role: string;
  description: string;
  tools: string[];
  provider: string;
}

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

export function AgentMarketplaceView() {
  /*
   * Which agents are deployed lives in the shared registry rather than in local
   * state: the sidebar lists the deployed ones, and toggling here used to be
   * forgotten the moment you navigated away.
   */
  const [installed, saveInstalled] = useInstalledAgents();
  const agents = marketplaceAgents;

  const toggleInstall = (agent: AgentCard) =>
    saveInstalled(
      toggleRegistryItem(installed, {
        id: agent.id,
        name: agent.name,
        icon: 'Bot',
        detail: agent.role,
      }),
    );

  return (
    <Page>
      <PageHeader
        title="Agents"
        description="Deploy specialised autonomous agents into your workspace."
        icon={<Bot />}
        accent="blue"
      />

      <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
        {agents.map((agent) => {
          const isInstalled = installed.some((entry) => entry.id === agent.id);

          return (
            <li key={agent.id}>
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
                        <p className="text-xs text-muted-foreground">
                          {agent.role}
                        </p>
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
                  variant={isInstalled ? 'outline' : 'primary'}
                  size="sm"
                  className="w-full"
                  onClick={() => toggleInstall(agent)}
                  leadingIcon={
                    isInstalled ? (
                      <ShieldCheck className="text-success" />
                    ) : (
                      <Download />
                    )
                  }
                >
                  {isInstalled ? 'Installed' : 'Deploy'}
                  <span className="sr-only"> — {agent.name}</span>
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
