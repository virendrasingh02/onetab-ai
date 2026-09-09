import type { AutomationWorkflowDetail } from '@org/types';
import {
  Badge,
  Button,
  Card,
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  LoadingState,
  PageSection,
  Tabs,
  TabsList,
  TabsTrigger,
  toast,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Activity,
  Check,
  Clock,
  MoreHorizontal,
  Play,
  Plus,
  SlidersHorizontal,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkflowMutations, useWorkflows } from './use-automations.js';

/**
 * Kept as an alias so existing importers of `WorkflowItem` keep working. The
 * list now comes straight from the workspace's `AutomationWorkflow` rows, the
 * same source the sidebar reads, so the two cannot drift.
 */
export type WorkflowItem = AutomationWorkflowDetail;

type TriggerType = 'WEBHOOK' | 'CRON' | 'EVENT';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  /** Icon name — informational only; the card resolves its own icon by trigger. */
  icon: string;
  /** The shape of the automation, in the order it runs. */
  steps: string[];
}

/**
 * The pre-built catalogue. "Use template" writes a real, disabled workflow into
 * the workspace with a starter React Flow graph, so it shows up in the sidebar
 * and opens in the canvas like any other.
 */
const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'tpl_pr_review',
    name: 'Pull request → AI review → channel alert',
    description:
      'Reviews every incoming pull request and posts the summary where the team is watching.',
    triggerType: 'WEBHOOK',
    icon: 'Plug',
    steps: ['GitHub webhook', 'AI code review', 'Post to channel'],
  },
  {
    id: 'tpl_standup',
    name: 'Daily standup digest',
    description:
      'Collects yesterday’s task activity each morning and posts a per-person digest.',
    triggerType: 'CRON',
    icon: 'Clock',
    steps: ['Every weekday 09:00', 'Summarise activity', 'Post digest'],
  },
  {
    id: 'tpl_overdue',
    name: 'Overdue task escalation',
    description:
      'Watches task due dates and nudges the assignee, then their lead if it stays overdue.',
    triggerType: 'EVENT',
    icon: 'Zap',
    steps: ['Task overdue', 'Notify assignee', 'Escalate after 24h'],
  },
  {
    id: 'tpl_meeting_notes',
    name: 'Meeting recap → doc',
    description:
      'Turns a finished meeting into a summary document with the action items pulled out.',
    triggerType: 'EVENT',
    icon: 'FileText',
    steps: ['Meeting ended', 'Summarise transcript', 'Create doc'],
  },
  {
    id: 'tpl_inbox_triage',
    name: 'Inbox triage & routing',
    description:
      'Classifies new inbox items hourly and routes each one to the right channel or owner.',
    triggerType: 'CRON',
    icon: 'Inbox',
    steps: ['Hourly sweep', 'Classify items', 'Route to owner'],
  },
];

const TRIGGER_ICON: Record<string, typeof Webhook> = {
  WEBHOOK: Webhook,
  CRON: Clock,
  EVENT: Zap,
};

const TRIGGER_LABEL: Record<string, string> = {
  WEBHOOK: 'Webhook',
  CRON: 'Cron',
  EVENT: 'Event',
};

/**
 * Turn a template into a React Flow graph the canvas can open: a trigger node
 * followed by one action node per step, wired in a line.
 */
function templateToGraph(template: WorkflowTemplate): {
  nodesJson: string;
  edgesJson: string;
} {
  const nodes = [
    {
      id: 'node-trigger',
      type: 'TRIGGER',
      position: { x: 120, y: 80 },
      data: { label: `${TRIGGER_LABEL[template.triggerType]} trigger`, subtitle: template.steps[0] ?? '' },
    },
    ...template.steps.slice(1).map((step, i) => ({
      id: `node-step-${i}`,
      type: 'ACTION',
      position: { x: 120, y: 220 + i * 140 },
      data: { label: step, subtitle: '' },
    })),
  ];
  const edges = nodes.slice(0, -1).map((n, i) => ({
    id: `edge-${i}`,
    source: n.id,
    target: nodes[i + 1].id,
    animated: true,
  }));
  return { nodesJson: JSON.stringify(nodes), edgesJson: JSON.stringify(edges) };
}

type WorkflowTab = 'all' | 'prebuilt' | 'mine';

export function WorkflowListView() {
  const { workspaceId } = useCurrentWorkspace();
  const workflowsQuery = useWorkflows(workspaceId);
  const { create, remove, trigger } = useWorkflowMutations(workspaceId);

  const workflows = workflowsQuery.data ?? [];

  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as WorkflowTab | null;
  const [tab, setTab] = useState<WorkflowTab>(urlTab ?? 'all');
  const navigate = useNavigate();

  useEffect(() => {
    if (urlTab) setTab(urlTab);
  }, [urlTab]);

  const openBuilder = (workflowId?: string) =>
    navigate(workflowId ? `builder?id=${workflowId}` : 'builder');

  const runNow = (workflow: AutomationWorkflowDetail) => {
    trigger.mutate(
      { workflowId: workflow.id },
      {
        onSuccess: () =>
          toast.success(`Triggered "${workflow.name}"`, {
            description: 'A run was queued — check the execution logs.',
          }),
        onError: () =>
          toast.error(`Could not trigger "${workflow.name}"`),
      },
    );
  };

  /**
   * Adding and removing are the same action: the workflow that carries the
   * template's name is the one a second click takes back out.
   */
  const toggleTemplate = (template: WorkflowTemplate) => {
    if (!workspaceId) return;
    const existing = workflows.find((w) => w.name === template.name);
    if (existing) {
      void confirm({
        title: `Remove the “${template.name}” automation?`,
        description:
          'The workflow and any steps you wired up are deleted for the whole workspace. This cannot be undone.',
        confirmLabel: 'Remove automation',
        destructive: true,
      }).then((ok) => {
        if (ok)
          remove.mutate(existing.id, {
            onSuccess: () => toast.info(`Removed "${template.name}"`),
          });
      });
      return;
    }
    const graph = templateToGraph(template);
    create.mutate(
      {
        name: template.name,
        description: template.description,
        triggerType: template.triggerType,
        nodesJson: graph.nodesJson,
        edgesJson: graph.edgesJson,
      },
      {
        onSuccess: (wf) => {
          toast.success(`Added "${template.name}"`, {
            description: 'Disabled until you open it and wire up the steps.',
          });
          setTab('all');
          navigate(`builder?id=${wf.id}`);
        },
        onError: () => toast.error(`Could not add "${template.name}"`),
      },
    );
  };

  if (workflowsQuery.isLoading) {
    return (
      <div className="min-h-0 flex flex-1 flex-col p-6">
        <LoadingState label="Loading automations…" />
      </div>
    );
  }

  if (workflowsQuery.isError) {
    return (
      <div className="min-h-0 flex flex-1 flex-col p-6">
        <ErrorState
          title="Couldn’t load automations"
          description="The workflow list failed to load."
          onRetry={() => workflowsQuery.refetch()}
        />
      </div>
    );
  }

  const templateIsAdded = (template: WorkflowTemplate) =>
    workflows.some((w) => w.name === template.name);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Zap
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Automations
              </h2>
              <Badge
                variant="neutral"
                className="px-1.5 py-0 h-4.5 text-[11px]"
              >
                {workflows.length} workflows
              </Badge>
            </div>
          </div>

          <div className="gap-2 flex items-center">
            <Button
              onClick={() => openBuilder()}
              size="sm"
              className="h-7 text-xs gap-1"
              leadingIcon={<Plus className="size-3.5" />}
            >
              New Workflow
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="More automation options"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => openBuilder()}
                  className="gap-2 text-xs"
                >
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span>Create new workflow</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => navigate('logs')}
                  className="gap-2 text-xs"
                >
                  <Activity className="size-3.5 text-muted-foreground" />
                  <span>Execution logs</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setTab('prebuilt')}
                  className="gap-2 text-xs"
                >
                  <Workflow className="size-3.5 text-muted-foreground" />
                  <span>Browse templates</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next as WorkflowTab)}
          >
            <TabsList variant="underline" size="sm" className="border-b-0">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="prebuilt">Templates</TabsTrigger>
              <TabsTrigger value="mine">Managed by you</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {tab === 'all' ? (
            <>
              {workflows.length > 0 ? (
                <PageSection title={`Managed by you (${workflows.length})`}>
                  <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
                    {workflows.map((workflow) => (
                      <li key={workflow.id}>
                        <SavedWorkflowCard
                          workflow={workflow}
                          onOpen={() => openBuilder(workflow.id)}
                          onRun={() => runNow(workflow)}
                          running={trigger.isPending}
                        />
                      </li>
                    ))}
                  </ul>
                </PageSection>
              ) : null}

              <PageSection title={`Templates (${workflowTemplates.length})`}>
                <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
                  {workflowTemplates.map((template) => (
                    <li key={template.id}>
                      <TemplateCard
                        template={template}
                        added={templateIsAdded(template)}
                        busy={create.isPending || remove.isPending}
                        onToggle={() => toggleTemplate(template)}
                      />
                    </li>
                  ))}
                </ul>
              </PageSection>
            </>
          ) : tab === 'mine' ? (
            workflows.length === 0 ? (
              <EmptyState
                icon={<Workflow />}
                title="No workflows yet"
                description="Build one on the canvas, or add a pre-built automation and edit it from there."
                action={
                  <Button leadingIcon={<Plus />} onClick={() => openBuilder()}>
                    Create workflow
                  </Button>
                }
                secondaryAction={
                  <Button variant="ghost" onClick={() => setTab('prebuilt')}>
                    Browse pre-built workflows
                  </Button>
                }
              />
            ) : (
              <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
                {workflows.map((workflow) => (
                  <li key={workflow.id}>
                    <SavedWorkflowCard
                      workflow={workflow}
                      onOpen={() => openBuilder(workflow.id)}
                      onRun={() => runNow(workflow)}
                      running={trigger.isPending}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
              {workflowTemplates.map((template) => (
                <li key={template.id}>
                  <TemplateCard
                    template={template}
                    added={templateIsAdded(template)}
                    busy={create.isPending || remove.isPending}
                    onToggle={() => toggleTemplate(template)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- parts ---- */

function SavedWorkflowCard({
  workflow,
  onOpen,
  onRun,
  running,
}: {
  workflow: AutomationWorkflowDetail;
  onOpen: () => void;
  onRun: () => void;
  running: boolean;
}) {
  const TriggerIcon = TRIGGER_ICON[workflow.triggerType] ?? Zap;

  return (
    <Card className="p-5 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
      <div>
        <div className="mb-3 gap-2 flex items-center justify-between">
          <Badge variant="warning" className="font-mono uppercase">
            <TriggerIcon aria-hidden />
            {workflow.triggerType}
          </Badge>
          <Badge variant={workflow.isActive ? 'success' : 'neutral'}>
            {workflow.isActive ? 'Active' : 'Disabled'}
          </Badge>
        </div>

        <h2 className="mb-2 text-sm font-semibold text-foreground">
          {workflow.name}
        </h2>

        <dl className="mb-4 gap-4 text-xs flex items-center text-muted-foreground">
          <div className="gap-1 flex">
            <dt>Runs:</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {workflow._count?.executions ?? 0}
            </dd>
          </div>
          <div className="gap-1 flex">
            <dt>Updated:</dt>
            <dd className="font-medium text-foreground">
              {new Date(workflow.updatedAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="gap-2 flex">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={onRun}
          disabled={running}
          leadingIcon={<Play className="text-success" />}
        >
          Run now
          <span className="sr-only"> — {workflow.name}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpen}
          title={`Edit ${workflow.name}`}
        >
          <SlidersHorizontal aria-hidden />
          <span className="sr-only">Edit {workflow.name}</span>
        </Button>
      </div>
    </Card>
  );
}

function TemplateCard({
  template,
  added,
  busy,
  onToggle,
}: {
  template: WorkflowTemplate;
  added: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const TriggerIcon = TRIGGER_ICON[template.triggerType];

  return (
    <Card className="p-5 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
      <div>
        <div className="mb-3 gap-2 flex items-center justify-between">
          <Badge variant="warning" className="font-mono uppercase">
            <TriggerIcon aria-hidden />
            {template.triggerType}
          </Badge>
          {added ? <Badge variant="success">Added</Badge> : null}
        </div>

        <h2 className="mb-2 text-sm font-semibold text-foreground">
          {template.name}
        </h2>

        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {template.description}
        </p>

        {/* The steps read as a sequence, so they are chevron-separated rather
            than a bag of badges like an agent's tools. */}
        <ol
          aria-label={`Steps in ${template.name}`}
          className="mb-4 gap-1 flex flex-wrap items-center text-[11px] text-muted-foreground"
        >
          {template.steps.map((step, index) => (
            <li key={step} className="gap-1 flex items-center">
              {index > 0 ? <span aria-hidden>→</span> : null}
              <span className="px-1.5 py-0.5 rounded-md border bg-surface-inset">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <Button
        variant={added ? 'outline' : 'primary'}
        size="sm"
        className="w-full"
        onClick={onToggle}
        disabled={busy}
        leadingIcon={added ? <Check className="text-success" /> : <Plus />}
      >
        {added ? 'Added' : 'Use template'}
        <span className="sr-only"> — {template.name}</span>
      </Button>
    </Card>
  );
}
