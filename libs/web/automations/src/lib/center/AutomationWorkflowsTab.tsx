import type { AutomationWorkflowDetail } from '@org/types';
import {
  ActionDropdownMenu,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  CodeInput,
  toast,
  type EntityAction,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import {
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Upload,
  Workflow,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowMutations, useWorkflows } from '../use-automations.js';
import { buildWorkflowActions, downloadWorkflowConfig } from '../workflow-actions.js';
import { describeTrigger } from '../WorkflowListView.js';
import { automationPath, type AutomationCenterTab } from './types.js';

export function AutomationWorkflowsTab({
  onOpenBuilder,
  onNavigateTab,
}: {
  onOpenBuilder?: (workflowId?: string) => void;
  onNavigateTab?: (tab: AutomationCenterTab) => void;
}) {
  const { workspaceId, slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');

  const workflowsQuery = useWorkflows(workspaceId);
  const { create, update, remove, trigger } = useWorkflowMutations(workspaceId);

  const workflows = workflowsQuery.data ?? [];

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = w.name.toLowerCase().includes(q);
        const matchesDesc = w.description?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesDesc) return false;
      }
      if (triggerFilter !== 'ALL' && w.triggerType !== triggerFilter) return false;
      if (statusFilter === 'ACTIVE' && !w.isActive) return false;
      if (statusFilter === 'PAUSED' && w.isActive) return false;
      return true;
    });
  }, [workflows, search, triggerFilter, statusFilter]);

  const openEditor = (id?: string) => {
    if (onOpenBuilder) {
      onOpenBuilder(id);
    } else {
      navigate(id ? `/w/${slug}/automations/builder/${id}` : `/w/${slug}/automations/builder/new`);
    }
  };

  const runNow = (workflow: AutomationWorkflowDetail) => {
    trigger.mutate(
      { workflowId: workflow.id },
      {
        onSuccess: (result) => {
          toast[result.status === 'FAILED' ? 'error' : 'success'](
            result.status === 'FAILED'
              ? `“${workflow.name}” failed`
              : result.status === 'WAITING_APPROVAL'
                ? `“${workflow.name}” is waiting for approval`
                : `“${workflow.name}” ran successfully`,
            {
              action: {
                label: 'Open run',
                onClick: () => {
                  if (onNavigateTab) onNavigateTab('runs');
                  else navigate(`${automationPath(slug, 'runs')}?run=${result.runId}`);
                },
              },
            },
          );
        },
        onError: (err) => {
          toast.error(`Could not run “${workflow.name}”`, {
            description: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importJson);
      if (!parsed.name || !parsed.nodes || !parsed.edges) {
        throw new Error('Missing name, nodes, or edges in workflow JSON');
      }

      await create.mutateAsync({
        name: parsed.name,
        description: parsed.description,
        triggerType: parsed.triggerType || 'MANUAL',
        nodesJson: typeof parsed.nodes === 'string' ? parsed.nodes : JSON.stringify(parsed.nodes),
        edgesJson: typeof parsed.edges === 'string' ? parsed.edges : JSON.stringify(parsed.edges),
        isActive: false,
      });

      toast.success(`Imported workflow “${parsed.name}”`, {
        description: 'Starts in paused state. You can review steps and activate.',
      });
      setImportOpen(false);
      setImportJson('');
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Invalid JSON file structure',
      });
    }
  };

  if (workflowsQuery.isLoading) {
    return <LoadingState label="Loading automations…" />;
  }

  if (workflowsQuery.isError) {
    return (
      <ErrorState
        title="Could not load automations"
        description="There was a problem fetching your automations."
        onRetry={() => void workflowsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search automations by name or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          <Select value={triggerFilter} onValueChange={setTriggerFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All triggers</SelectItem>
              <SelectItem value="MANUAL">On request</SelectItem>
              <SelectItem value="CRON">Schedule (Cron)</SelectItem>
              <SelectItem value="EVENT">Platform events</SelectItem>
              <SelectItem value="WEBHOOK">Inbound webhooks</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All status</SelectItem>
              <SelectItem value="ACTIVE">Active only</SelectItem>
              <SelectItem value="PAUSED">Paused only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 size-3.5" />
            Import JSON
          </Button>
          {can('create') && (
            <Button size="sm" onClick={() => openEditor()}>
              <Plus className="mr-1.5 size-3.5" />
              New automation
            </Button>
          )}
        </div>
      </div>

      {/* Workflows List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Workflow className="size-8" />}
          title={search || triggerFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No matching automations found' : 'No automations created yet'}
          description={
            search || triggerFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your search criteria or filters.'
              : 'Automations connect workspace triggers, AI agents, tools, and apps to run repetitive processes automatically.'
          }
          action={
            can('create') && (
              <Button onClick={() => openEditor()}>
                <Plus className="mr-1.5 size-4" /> Create first automation
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((wf) => {
            const triggerInfo = describeTrigger(wf.triggerType);
            const TriggerIcon = triggerInfo.icon;
            const runsCount = wf._count?.executions ?? 0;

            const actions: EntityAction[] = buildWorkflowActions({
              workflow: wf,
              path: `/w/${slug}/automations/builder/${wf.id}`,
              onOpen: () => openEditor(wf.id),
              onRun: can('create') ? () => runNow(wf) : undefined,
              onSetActive: (isActive) => update.mutateAsync({ workflowId: wf.id, input: { isActive } }),
              onViewHistory: () => {
                if (onNavigateTab) onNavigateTab('history');
                else navigate(`${automationPath(slug, 'history')}?entity=${wf.id}`);
              },
              onDuplicate: can('create')
                ? async () => {
                    const copy = await create.mutateAsync({
                      name: `${wf.name} (copy)`,
                      description: wf.description ?? undefined,
                      triggerType: wf.triggerType,
                      nodesJson: wf.nodesJson,
                      edgesJson: wf.edgesJson,
                      isActive: false,
                    });
                    toast.success(`Duplicated “${wf.name}”`);
                    openEditor(copy.id);
                  }
                : undefined,
              onExport: () => downloadWorkflowConfig(wf),
              onDelete: () => remove.mutateAsync(wf.id),
            });

            return (
              <Card
                key={wf.id}
                className={cn(
                  'flex flex-col justify-between rounded-xl border p-4 transition-all hover:border-border-hover hover:shadow-sm',
                  wf.isActive ? 'border-border/80 bg-surface' : 'border-border/40 bg-surface-muted/30 opacity-80',
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface-muted text-primary">
                        <TriggerIcon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <h4
                          onClick={() => openEditor(wf.id)}
                          className="cursor-pointer truncate text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {wf.name}
                        </h4>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          {triggerInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={wf.isActive}
                        onCheckedChange={(checked) =>
                          update.mutate({ workflowId: wf.id, input: { isActive: checked } })
                        }
                        title={wf.isActive ? 'Active - click to pause' : 'Paused - click to activate'}
                      />
                      <ActionDropdownMenu
                        actions={actions}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${wf.name}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                    </div>
                  </div>

                  {wf.description && (
                    <p className="mt-2.5 line-clamp-2 text-xs text-muted-foreground">
                      {wf.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{runsCount} runs · updated {formatRelative(wf.updatedAt)}</span>
                  <div className="flex items-center gap-1">
                    {can('create') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => runNow(wf)}
                        disabled={trigger.isPending}
                      >
                        <Play className="mr-1 size-3" />
                        Run
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => openEditor(wf.id)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Import JSON Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Workflow Configuration</DialogTitle>
            <DialogDescription>
              Paste the exported JSON definition of an automation workflow to recreate it in this workspace.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3 py-2">
            <CodeInput
              language="json"
              placeholder='{"name": "My Automation", "nodes": [...], "edges": [...]}'
              value={importJson}
              onChange={setImportJson}
              minRows={8}
              maxRows={16}
            />
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importJson.trim() || create.isPending}>
              Import Automation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
