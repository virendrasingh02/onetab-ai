import type { AIAgentDetail } from '@org/types';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Page,
  SkeletonList,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Activity, Bot, MoreHorizontal, Plus, Trash2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAgentMutations, useAgents } from './use-agents.js';

interface AgentTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  category: string;
  tools: string[];
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'tpl_code_reviewer',
    name: 'Code Reviewer Agent',
    role: 'Engineering Assistant',
    description: 'Analyzes pull requests for code quality, security vulnerabilities, and test coverage.',
    category: 'Engineering',
    tools: ['GitHub Integration', 'Code Analysis', 'Channel Alert'],
  },
  {
    id: 'tpl_support_bot',
    name: 'Support Triage Bot',
    role: 'Customer Support',
    description: 'Classifies support tickets, drafts responses, and escalates urgent issues.',
    category: 'Support',
    tools: ['Inbox Triage', 'KB Search', 'Auto Responder'],
  },
  {
    id: 'tpl_researcher',
    name: 'Deep Research Agent',
    role: 'Research & Intelligence',
    description: 'Gathers web & document research, extracts insights, and formats structured summaries.',
    category: 'Research',
    tools: ['Web Search', 'Document Parser', 'Doc Generator'],
  },
  {
    id: 'tpl_standup_bot',
    name: 'Standup Digest Agent',
    role: 'Operations',
    description: 'Collects daily updates from team members and compiles concise standup summaries.',
    category: 'Operations',
    tools: ['Cron Scheduler', 'Activity Tracker', 'Channel Digest'],
  },
];

type AgentTab = 'all' | 'templates' | 'mine';

export function AgentMarketplaceView() {
  const { workspaceId } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const { create, remove } = useAgentMutations(workspaceId);
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as AgentTab | null;
  const [tab, setTab] = useState<AgentTab>(urlTab ?? 'all');

  const navigate = useNavigate();

  useEffect(() => {
    if (urlTab) {
      setTab(urlTab);
    }
  }, [urlTab]);

  /* Relative to the `agents` route, so the `/w/:workspaceSlug` prefix does not
     have to be rebuilt here. */
  const openBuilder = () => navigate('builder');

  const installed = agents.data ?? [];

  const handleUseTemplate = (template: AgentTemplate) => {
    create.mutate(
      {
        name: template.name,
        role: template.role,
        systemPrompt: template.description,
        isMarketplace: true,
        model: 'gpt-4o',
      },
      {
        onSuccess: () => {
          setTab('all');
        },
      },
    );
  };

  return (
    <Page>
      {/* Header section matching reference image design */}
      <div className="mb-6 border-b border-border/60 pb-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            AI Agents
          </h1>

          <div className="flex items-center gap-2">
            <Button
              onClick={openBuilder}
              className="h-9 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-[#059669] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#047857] sm:text-sm"
            >
              <Plus className="size-4" />
              <span>New</span>
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 text-muted-foreground hover:text-foreground"
                  aria-label="More options"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={openBuilder} className="gap-2 text-xs">
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span>Create new agent</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('logs')} className="gap-2 text-xs">
                  <Activity className="size-3.5 text-muted-foreground" />
                  <span>Activity logs</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTab('templates')} className="gap-2 text-xs">
                  <Bot className="size-3.5 text-muted-foreground" />
                  <span>Browse templates</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Underline tab strip */}
        <div className="flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={cn(
              'relative pb-3 transition-colors',
              tab === 'all'
                ? 'border-b-2 border-primary font-semibold text-foreground'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setTab('templates')}
            className={cn(
              'relative pb-3 transition-colors',
              tab === 'templates'
                ? 'border-b-2 border-primary font-semibold text-foreground'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Templates
          </button>

          <button
            type="button"
            onClick={() => setTab('mine')}
            className={cn(
              'relative pb-3 transition-colors',
              tab === 'mine'
                ? 'border-b-2 border-primary font-semibold text-foreground'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Managed by you
          </button>
        </div>
      </div>

      {agents.isLoading ? (
        <SkeletonList rows={3} />
      ) : agents.isError ? (
        <ErrorState
          title="Could not load your agents"
          description="Something went wrong reaching the server."
          onRetry={() => agents.refetch()}
        />
      ) : tab === 'all' ? (
        <div className="space-y-6">
          {installed.length > 0 ? (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Managed by you ({installed.length})
              </h2>
              <DeployedAgents
                agents={installed}
                onNew={openBuilder}
                onLogs={() => navigate('logs')}
                onRemove={(id) => remove.mutate(id)}
              />
            </div>
          ) : null}

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Templates ({AGENT_TEMPLATES.length})
            </h2>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {AGENT_TEMPLATES.map((template) => (
                <li key={template.id}>
                  <AgentTemplateCard
                    template={template}
                    onUse={() => handleUseTemplate(template)}
                    isCreating={create.isPending}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : tab === 'mine' ? (
        <DeployedAgents
          agents={installed}
          onNew={openBuilder}
          onLogs={() => navigate('logs')}
          onRemove={(id) => remove.mutate(id)}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AGENT_TEMPLATES.map((template) => (
            <li key={template.id}>
              <AgentTemplateCard
                template={template}
                onUse={() => handleUseTemplate(template)}
                isCreating={create.isPending}
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
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => {
        /* `isMarketplace` is set on rows deployed from the catalogue; anything
           else came out of the builder. */
        const fromCatalogue = agent.isMarketplace;

        return (
          <li key={agent.id}>
            <Card className="h-full justify-between p-5 transition-colors duration-(--duration-fast) hover:border-border-strong">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue-soft text-accent-blue"
                  >
                    <Bot className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-foreground">
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

              <div className="flex gap-2">
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

function AgentTemplateCard({
  template,
  onUse,
  isCreating,
}: {
  template: AgentTemplate;
  onUse: () => void;
  isCreating: boolean;
}) {
  return (
    <Card className="h-full justify-between p-5 transition-colors duration-(--duration-fast) hover:border-border-strong">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge variant="neutral">{template.category}</Badge>
          <Badge variant="primary">Template</Badge>
        </div>

        <h2 className="mb-1 text-sm font-semibold text-foreground">
          {template.name}
        </h2>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {template.role}
        </p>

        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {template.description}
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {template.tools.map((tool) => (
            <span
              key={tool}
              className="rounded-md border bg-surface-inset px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        className="w-full"
        onClick={onUse}
        loading={isCreating}
        leadingIcon={<Zap className="size-3.5 text-amber-400" />}
      >
        Use template
        <span className="sr-only"> — {template.name}</span>
      </Button>
    </Card>
  );
}
