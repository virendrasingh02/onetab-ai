import {
  toggleRegistryItem,
  useWorkflows,
  type WorkflowRegistryItem,
} from '@org/hooks';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Page,
  PageHeader,
  PageSection,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@org/ui';
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

/**
 * Kept as an alias so existing importers of `WorkflowItem` keep working. The
 * list itself now comes from the shared registry the sidebar reads, so the two
 * cannot drift.
 */
export type WorkflowItem = WorkflowRegistryItem;

type TriggerType = WorkflowRegistryItem['triggerType'];

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  /** Icon name from `ICON_REGISTRY` — the registry is persisted, so it stores a name. */
  icon: string;
  /** The shape of the automation, in the order it runs. */
  steps: string[];
}

/**
 * The pre-built catalogue. Adding one writes a real workflow into the registry
 * — disabled and with no run history — so it shows up in the sidebar and can be
 * opened in the canvas like any other.
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

const TRIGGER_ICON: Record<TriggerType, typeof Webhook> = {
  WEBHOOK: Webhook,
  CRON: Clock,
  EVENT: Zap,
};

type WorkflowTab = 'all' | 'prebuilt' | 'mine';

export function WorkflowListView() {
  const [workflows, saveWorkflows] = useWorkflows();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as WorkflowTab | null;
  const [tab, setTab] = useState<WorkflowTab>(urlTab ?? 'all');
  const navigate = useNavigate();

  useEffect(() => {
    if (urlTab) {
      setTab(urlTab);
    }
  }, [urlTab]);

  /* Relative to the `automations` route, so the `/w/:workspaceSlug` prefix does
     not have to be rebuilt here. */
  const openBuilder = () => navigate('builder');

  /**
   * Adding and removing are the same action, as on the agents page: the
   * template's id becomes the workflow's id, so a second click on a card that
   * says "Added" takes it back out again.
   */
  const toggleTemplate = (template: WorkflowTemplate) => {
    saveWorkflows(
      toggleRegistryItem(workflows, {
        id: template.id,
        name: template.name,
        icon: template.icon,
        detail: TRIGGER_LABEL[template.triggerType],
        triggerType: template.triggerType,
        /* Off until someone opens it and wires up the credentials. */
        isActive: false,
        totalExecutions: 0,
        lastRun: 'Never',
      }),
    );
    setTab('all');
  };

  return (
    <Page>
      <PageHeader
        title="Automations"
        description="Workflows that run on a trigger — on a schedule, a webhook, or an event in your workspace."
        icon={<Zap />}
        accent="amber"
        actions={
          <>
            <Button onClick={openBuilder} size="lg" leadingIcon={<Plus />}>
              New
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-foreground"
                  aria-label="More automation options"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={openBuilder} className="gap-2">
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span>Create new workflow</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => navigate('logs')}
                  className="gap-2"
                >
                  <Activity className="size-3.5 text-muted-foreground" />
                  <span>Execution logs</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setTab('prebuilt')}
                  className="gap-2"
                >
                  <Workflow className="size-3.5 text-muted-foreground" />
                  <span>Browse templates</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        toolbar={
          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next as WorkflowTab)}
          >
            <TabsList variant="underline" aria-label="Filter automations">
              <TabsTrigger variant="underline" value="all">
                All
              </TabsTrigger>
              <TabsTrigger variant="underline" value="prebuilt">
                Templates
              </TabsTrigger>
              <TabsTrigger variant="underline" value="mine">
                Managed by you
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {tab === 'all' ? (
        <>
          {workflows.length > 0 ? (
            <PageSection title={`Managed by you (${workflows.length})`}>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {workflows.map((workflow) => (
                  <li key={workflow.id}>
                    <SavedWorkflowCard workflow={workflow} onOpen={openBuilder} />
                  </li>
                ))}
              </ul>
            </PageSection>
          ) : null}

          <PageSection title={`Templates (${workflowTemplates.length})`}>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workflowTemplates.map((template) => (
                <li key={template.id}>
                  <TemplateCard
                    template={template}
                    added={workflows.some((entry) => entry.id === template.id)}
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
              <Button leadingIcon={<Plus />} onClick={openBuilder}>
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
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflows.map((workflow) => (
              <li key={workflow.id}>
                <SavedWorkflowCard workflow={workflow} onOpen={openBuilder} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflowTemplates.map((template) => (
            <li key={template.id}>
              <TemplateCard
                template={template}
                added={workflows.some((entry) => entry.id === template.id)}
                onToggle={() => toggleTemplate(template)}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

/* --------------------------------------------------------------- parts ---- */

const TRIGGER_LABEL: Record<TriggerType, string> = {
  WEBHOOK: 'Webhook',
  CRON: 'Cron',
  EVENT: 'Event',
};

function SavedWorkflowCard({
  workflow,
  onOpen,
}: {
  workflow: WorkflowRegistryItem;
  onOpen: () => void;
}) {
  const TriggerIcon = TRIGGER_ICON[workflow.triggerType];

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
              {workflow.totalExecutions}
            </dd>
          </div>
          <div className="gap-1 flex">
            <dt>Last run:</dt>
            <dd className="font-medium text-foreground">{workflow.lastRun}</dd>
          </div>
        </dl>
      </div>

      <div className="gap-2 flex">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
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
  onToggle,
}: {
  template: WorkflowTemplate;
  added: boolean;
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
        leadingIcon={added ? <Check className="text-success" /> : <Plus />}
      >
        {added ? 'Added' : 'Use template'}
        <span className="sr-only"> — {template.name}</span>
      </Button>
    </Card>
  );
}
