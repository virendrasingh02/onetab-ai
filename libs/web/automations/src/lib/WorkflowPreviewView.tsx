/**
 * A workflow as the sidebar opens it — `/w/:slug/ai/workflows/:id` in the main app.
 *
 * Read-only: the same step cards the Studio editor draws, so people can see
 * what an automation does without leaving their workspace. Editing stays in
 * the AI Agent Studio, reached through `editUrl`. The header is the `PageBar`
 * + `PageTabBar` pair every other sidebar destination opens with.
 */

import { automationsApi, queryKeys } from '@org/api-client';
import {
  ActionDropdownMenu,
  AIRunStatusBadge,
  Badge,
  Button,
  EmptyState,
  Hint,
  LoadingState,
  PageBar,
  PageTabBar,
  Switch,
  Tabs,
  TabsContent,
  TabsTrigger,
  toast,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  useCanManageAIResource,
  useCurrentWorkspace,
  useWorkspaceFavorites,
  useWorkspacePermission,
} from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import { Background, Panel, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Activity,
  Clock,
  ExternalLink,
  MoreHorizontal,
  Play,
  Plug,
  Star,
  Workflow,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkflowExecutions, useWorkflowMutations } from './use-automations.js';
import {
  loadGraph,
  nodeTypes,
  workflowEdgeTypes,
  WorkflowCanvasControls,
  WorkflowMiniMap,
} from './WorkflowCanvasView.js';
import { buildWorkflowActions, downloadWorkflowConfig } from './workflow-actions.js';

/** Same glyphs and words the sidebar row uses for the trigger. */
const TRIGGER: Record<string, { label: string; icon: ReactNode }> = {
  WEBHOOK: { label: 'Webhook', icon: <Plug /> },
  CRON: { label: 'Scheduled', icon: <Clock /> },
  EVENT: { label: 'Event', icon: <Zap /> },
  MANUAL: { label: 'Manual', icon: <Play /> },
};

export function WorkflowPreviewView({ editUrl }: { editUrl: (workflowId: string) => string }) {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const canManageResource = useCanManageAIResource();
  const { isFavorite, toggleFavorite } = useWorkspaceFavorites(workspaceId);
  const { start, update, remove } = useWorkflowMutations(workspaceId);
  const [tab, setTab] = useState('steps');

  const detail = useQuery({
    queryKey: queryKeys.automations.detail(workspaceId ?? '', workflowId ?? ''),
    queryFn: () => automationsApi.get(workspaceId as string, workflowId as string),
    enabled: Boolean(workspaceId && workflowId),
  });
  const workflow = detail.data ?? null;
  const graph = useMemo(() => loadGraph(workflow), [workflow]);

  if (detail.isLoading) return <LoadingState fullPage label="Opening automation…" />;
  if (!workflow) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <EmptyState
          icon={<Workflow />}
          title="Automation not found"
          description="It may have been deleted, or it belongs to another workspace."
        />
      </div>
    );
  }

  const canEdit = canManageResource(workflow.creatorId);
  const trigger = TRIGGER[workflow.triggerType];
  const steps = graph.nodes.length;
  const runs = workflow._count?.executions ?? 0;
  const favorite = isFavorite('workflow', workflow.id);
  const path = `/w/${slug ?? ''}/ai/workflows/${workflow.id}`;
  const openStudio = () => window.open(editUrl(workflow.id), '_blank', 'noopener');

  const run = async () => {
    try {
      await start.mutateAsync(workflow.id);
      toast.success(`“${workflow.name}” started`);
    } catch (err) {
      toast.error('The run could not start', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const actions = () =>
    buildWorkflowActions({
      workflow,
      path,
      onOpen: openStudio,
      onRun: can('create') ? () => start.mutateAsync(workflow.id) : undefined,
      onSetActive: canEdit
        ? (active) => update.mutateAsync({ workflowId: workflow.id, input: { isActive: active } })
        : undefined,
      onViewHistory: () => setTab('runs'),
      onExport: () => downloadWorkflowConfig(workflow),
      onDelete: canEdit
        ? async () => {
            await remove.mutateAsync(workflow.id);
            navigate(`/w/${slug ?? ''}`);
          }
        : undefined,
    }).map((action) => (action.id === 'open' ? { ...action, label: 'Edit in Studio', icon: ExternalLink } : action));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <PageBar
        hasTabs
        icon={trigger?.icon ?? <Workflow />}
        title={workflow.name}
        meta={
          <>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Automation
            </Badge>
            <Badge variant={workflow.isActive ? 'success' : 'neutral'} className="shrink-0 text-[10px]">
              {workflow.isActive ? 'On' : 'Paused'}
            </Badge>
            <div className="flex items-center gap-0.5">
              <Hint label={favorite ? 'Remove from favorites' : 'Add to favorites'}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={favorite}
                  aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={() => toggleFavorite('workflow', workflow.id)}
                  className={favorite ? 'text-warning' : undefined}
                >
                  <Star className={cn('size-4', favorite && 'fill-current text-accent-amber')} />
                </Button>
              </Hint>
              <ActionDropdownMenu
                actions={actions}
                entityType="workflow"
                entity={workflow}
                align="start"
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Options for ${workflow.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
            </div>
          </>
        }
        actions={
          <>
            {canEdit ? (
              <Hint label={workflow.isActive ? 'Pause — schedules and events stop starting it' : 'Switch on'}>
                <span className="flex items-center">
                  <Switch
                    checked={workflow.isActive}
                    disabled={update.isPending}
                    onCheckedChange={(on) => update.mutate({ workflowId: workflow.id, input: { isActive: on } })}
                    aria-label="Automation on"
                  />
                </span>
              </Hint>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Play />}
              loading={start.isPending}
              disabled={!can('create')}
              onClick={() => void run()}
            >
              Run now
            </Button>
            <Button size="sm" leadingIcon={<ExternalLink />} onClick={openStudio}>
              {canEdit ? 'Edit in Studio' : 'Open in Studio'}
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <PageTabBar
          end={
            <span className="hidden truncate text-xs text-muted-foreground md:inline">
              {[
                trigger?.label ?? workflow.triggerType,
                `${steps} ${steps === 1 ? 'step' : 'steps'}`,
                `Updated ${formatRelative(workflow.updatedAt)}`,
              ].join(' · ')}
            </span>
          }
        >
          <TabsTrigger value="steps" icon={<Workflow className="size-4" aria-hidden />}>
            Steps
          </TabsTrigger>
          <TabsTrigger value="runs" icon={<Activity className="size-4" aria-hidden />}>
            Runs{runs ? ` · ${runs}` : ''}
          </TabsTrigger>
        </PageTabBar>

        <TabsContent value="steps" className="relative mt-0 min-h-0 flex-1">
          <div role="region" aria-label="Automation steps" className="absolute inset-0">
            {/* Uncontrolled, so React Flow keeps the measured sizes the minimap needs; a save remounts it */}
            <ReactFlowProvider key={`${workflow.id}:${workflow.updatedAt}`}>
              <ReactFlow
                defaultNodes={graph.nodes}
                defaultEdges={graph.edges}
                nodeTypes={nodeTypes}
                edgeTypes={workflowEdgeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                minZoom={0.2}
                proOptions={{ hideAttribution: true }}
                fitView
                // Same opening framing as the Studio canvas: small graphs stay at a readable 100%
                // (extra top room keeps the description panel off the first step)
                fitViewOptions={{
                  maxZoom: 1,
                  minZoom: 0.3,
                  padding: workflow.description ? { top: '96px', bottom: '72px', x: '48px' } : 0.2,
                }}
              >
                {workflow.description ? (
                  <Panel position="top-left" className="!m-0 !left-5 !top-5 max-md:!right-5">
                    <p className="max-w-sm rounded-[14px] border border-border bg-surface px-3 py-2 text-xs leading-snug text-muted-foreground shadow-sm">
                      {workflow.description}
                    </p>
                  </Panel>
                ) : null}
                <WorkflowCanvasControls />
                <WorkflowMiniMap />
                <Background gap={18} size={1} color="color-mix(in oklab, var(--color-muted-foreground) 30%, transparent)" />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <WorkflowRuns workspaceId={workspaceId} workflowId={workflow.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Workflow executions record SUCCESS / WAITING; the shared badge speaks AI-run statuses. */
const EXECUTION_STATUS: Record<string, string> = {
  SUCCESS: 'COMPLETED',
  WAITING: 'WAITING_APPROVAL',
};

function WorkflowRuns({ workspaceId, workflowId }: { workspaceId: string | undefined; workflowId: string }) {
  const executions = useWorkflowExecutions(workspaceId, workflowId);
  if (executions.isLoading) return <LoadingState label="Loading runs…" />;
  const rows = executions.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Activity />}
        title="No runs yet"
        description="Run it now, or let its trigger start it — every run is recorded here."
      />
    );
  }
  return (
    <ul className="mx-auto max-w-3xl divide-y divide-border rounded-lg border border-border bg-surface">
      {rows.map((execution) => {
        const ms = new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime();
        return (
          <li key={execution.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <AIRunStatusBadge status={EXECUTION_STATUS[execution.status] ?? execution.status} />
              <span className="truncate text-foreground">{formatRelative(execution.startedAt)}</span>
            </div>
            {Number.isFinite(ms) && ms >= 0 ? (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
