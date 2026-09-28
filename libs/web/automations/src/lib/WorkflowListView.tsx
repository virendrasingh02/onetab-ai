import type { AutomationWorkflowDetail } from '@org/types';
import {
  ActionDropdownMenu,
  Badge,
  Button,
  Card,
  EmptyState,
  EntityContextMenu,
  ErrorState,
  LoadingState,
  PageSection,
  toast,
  type EntityAction,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import { CalendarClock, Hand, MoreHorizontal, Play, Plus, Workflow, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowMutations, useWorkflows } from './use-automations.js';
import { WORKFLOW_EVENTS } from './workflow-catalog.js';
import { buildWorkflowActions, downloadWorkflowConfig } from './workflow-actions.js';
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from './workflow-templates.js';

/**
 * Kept as an alias so existing importers of `WorkflowItem` keep working. The
 * list comes straight from the workspace's `AutomationWorkflow` rows, the same
 * source the sidebar reads, so the two cannot drift.
 */
export type WorkflowItem = AutomationWorkflowDetail;

function aiPath(slug: string | undefined, ...rest: string[]) {
  return [`/w/${slug ?? ''}/ai`, ...rest].join('/');
}

/** How a workflow starts, in words. */
export function describeTrigger(triggerType: string): { label: string; icon: typeof Zap } {
  if (triggerType === 'CRON') return { label: 'On a schedule', icon: CalendarClock };
  const event = WORKFLOW_EVENTS.find((e) => e.value === triggerType);
  if (event) return { label: event.label, icon: Zap };
  return { label: 'On request', icon: Hand };
}

/**
 * AI Workspace → Workflows: the workspace's workflows and ready-made ones to
 * start from. A workflow opens in the canvas editor.
 */
export function WorkflowListView() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const workflowsQuery = useWorkflows(workspaceId);
  const { create, update, remove, trigger } = useWorkflowMutations(workspaceId);
  const workflows = workflowsQuery.data ?? [];

  const open = (id?: string) => navigate(aiPath(slug, 'workflows', id ?? 'new'));

  const runNow = (workflow: AutomationWorkflowDetail) =>
    trigger.mutate(
      { workflowId: workflow.id },
      {
        onSuccess: (result) =>
          toast[result.status === 'FAILED' ? 'error' : 'success'](
            result.status === 'FAILED'
              ? `“${workflow.name}” failed`
              : result.status === 'WAITING_APPROVAL'
                ? `“${workflow.name}” is waiting for approval`
                : `“${workflow.name}” ran`,
            {
              action: {
                label: 'Open run',
                onClick: () => navigate(`${aiPath(slug, 'runs')}?run=${result.runId}`),
              },
            },
          ),
        onError: (err) =>
          toast.error(`Could not run “${workflow.name}”`, {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );

  const actionsFor = (workflow: AutomationWorkflowDetail): EntityAction[] =>
    buildWorkflowActions({
      workflow,
      path: aiPath(slug, 'workflows', workflow.id),
      onOpen: () => open(workflow.id),
      onRun: can('create') ? () => runNow(workflow) : undefined,
      onSetActive: (isActive) => update.mutateAsync({ workflowId: workflow.id, input: { isActive } }),
      onViewHistory: () => navigate(`${aiPath(slug, 'runs')}?type=WORKFLOW&entity=${workflow.id}`),
      onDuplicate: can('create')
        ? async () => {
            const copy = await create.mutateAsync({
              name: `${workflow.name} (copy)`,
              description: workflow.description ?? undefined,
              triggerType: workflow.triggerType,
              nodesJson: workflow.nodesJson,
              edgesJson: workflow.edgesJson,
              isActive: false,
            });
            toast.success(`Duplicated “${workflow.name}”`, {
              description: 'The copy starts paused.',
              action: { label: 'Open', onClick: () => open(copy.id) },
            });
          }
        : undefined,
      onExport: () => downloadWorkflowConfig(workflow),
      onDelete: () => remove.mutateAsync(workflow.id),
    });

  /** Always a new, paused workflow — a template can be used more than once. */
  const startFromTemplate = (template: WorkflowTemplate) => {
    const graph = template.build();
    const taken = new Set(workflows.map((w) => w.name));
    let name = template.name;
    for (let n = 2; taken.has(name); n++) name = `${template.name} (${n})`;
    create.mutate(
      {
        name,
        description: template.description,
        triggerType: graph.triggerType,
        nodesJson: JSON.stringify(graph.nodes),
        edgesJson: JSON.stringify(graph.edges),
        isActive: false,
      },
      {
        onSuccess: (wf) => {
          toast.success(`Created “${name}”`, { description: 'It starts paused. Check each step, test it, then publish.' });
          open(wf.id);
        },
        onError: () => toast.error(`Could not create “${template.name}”`),
      },
    );
  };

  if (workflowsQuery.isLoading) return <LoadingState label="Loading workflows…" />;
  if (workflowsQuery.isError) {
    return <ErrorState title="Couldn’t load workflows" onRetry={() => workflowsQuery.refetch()} />;
  }

  return (
    <div className="space-y-8">
      <PageSection
        title={`Workflows (${workflows.length})`}
        actions={
          can('create') ? (
            <Button size="sm" leadingIcon={<Plus />} onClick={() => open()}>
              New workflow
            </Button>
          ) : undefined
        }
      >
        {workflows.length === 0 ? (
          <EmptyState
            icon={<Workflow />}
            title="No workflows yet"
            description="A workflow runs steps in order when its trigger fires — ask an agent, search knowledge, branch on a condition, wait for approval. Start from a template below or build one."
            action={
              can('create') ? (
                <Button leadingIcon={<Plus />} onClick={() => open()}>
                  Build a workflow
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workflows.map((workflow) => (
              <li key={workflow.id}>
                <WorkflowCard
                  workflow={workflow}
                  onOpen={() => open(workflow.id)}
                  onRun={can('create') ? () => runNow(workflow) : undefined}
                  running={trigger.isPending && trigger.variables?.workflowId === workflow.id}
                  actions={() => actionsFor(workflow)}
                />
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      {can('create') ? (
        <PageSection title="Start from a template" description="Each creates a new workflow, paused until you publish it.">
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {WORKFLOW_TEMPLATES.map((template) => (
              <li key={template.id}>
                <TemplateCard template={template} busy={create.isPending} onUse={() => startFromTemplate(template)} />
              </li>
            ))}
          </ul>
        </PageSection>
      ) : null}
    </div>
  );
}

function WorkflowCard({
  workflow,
  onOpen,
  onRun,
  running,
  actions,
}: {
  workflow: AutomationWorkflowDetail;
  onOpen: () => void;
  onRun?: () => void;
  running: boolean;
  actions: () => EntityAction[];
}) {
  const trigger = describeTrigger(workflow.triggerType);
  const TriggerIcon = trigger.icon;
  return (
    <EntityContextMenu actions={actions} scope={`workflow:${workflow.id}`} entityType="workflow" entity={workflow} label={workflow.name}>
      <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-border-strong">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="neutral" className="gap-1 text-[10px]">
            <TriggerIcon className="size-3" aria-hidden />
            {trigger.label}
          </Badge>
          <Badge variant={workflow.isActive ? 'success' : 'neutral'} className="text-[10px]">
            {workflow.isActive ? 'On' : 'Paused'}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="text-left text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {workflow.name}
        </button>
        {workflow.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{workflow.description}</p> : null}
        <p className="mt-auto text-[11px] text-muted-foreground">
          {workflow._count?.executions ?? 0} runs · updated {formatRelative(workflow.updatedAt)}
        </p>
        <div className="flex gap-2">
          {onRun ? (
            <Button variant="secondary" size="sm" className="flex-1" onClick={onRun} loading={running} leadingIcon={<Play />}>
              Run now<span className="sr-only"> — {workflow.name}</span>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="flex-1" onClick={onOpen}>
            Open<span className="sr-only"> {workflow.name}</span>
          </Button>
          <ActionDropdownMenu
            actions={actions}
            scope={`workflow:${workflow.id}`}
            entityType="workflow"
            entity={workflow}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${workflow.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            }
          />
        </div>
      </Card>
    </EntityContextMenu>
  );
}

function TemplateCard({ template, busy, onUse }: { template: WorkflowTemplate; busy: boolean; onUse: () => void }) {
  const trigger = describeTrigger(template.trigger === 'EVENT' ? 'task.created' : template.trigger);
  const TriggerIcon = trigger.icon;
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <Badge variant="neutral" className="w-fit gap-1 text-[10px]">
        <TriggerIcon className="size-3" aria-hidden />
        {trigger.label}
      </Badge>
      <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{template.description}</p>
      <ol aria-label={`Steps in ${template.name}`} className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        {template.steps.map((step, index) => (
          <li key={step} className="flex items-center gap-1">
            {index > 0 ? <span aria-hidden>→</span> : null}
            <span className="rounded-md border bg-surface-inset px-1.5 py-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <Button variant="outline" size="sm" className="mt-auto" onClick={onUse} disabled={busy} leadingIcon={<Plus />}>
        Use template<span className="sr-only"> — {template.name}</span>
      </Button>
    </Card>
  );
}
