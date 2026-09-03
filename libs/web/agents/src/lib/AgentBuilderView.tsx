/**
 * Agent builder — a node graph rather than a form.
 *
 * Three columns: the node library, the React Flow canvas, and an inspector that
 * edits whatever is selected. All three read and write one `useAgentGraph`
 * store, so an edit anywhere repaints the canvas card, re-runs validation and
 * updates the flattened agent summary in the same pass.
 *
 * Saving writes the graph to storage *and* upserts the agent into the shared
 * workspace registry, which is what puts it in the sidebar.
 */

import { useTheme } from '@org/design-system';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Hint,
  KbdShortcut,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel as FlowPanel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAgentMutations, useAgents } from './use-agents.js';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  LayoutGrid,
  Map as MapIcon,
  Maximize2,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  RotateCcw,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AgentInspector,
  AgentNodePalette,
  NODE_DRAG_TYPE,
  NodeIssueProvider,
  accentFor,
  isAgentNodeKind,
  nodeTypes,
  specFor,
  useAgentGraph,
  type AgentFlowNode,
  type AgentNodeKind,
} from './agent-graph/index.js';

export function AgentBuilderView() {
  const [searchParams] = useSearchParams();
  const editAgentId = searchParams.get('agentId');
  const editAgentName = searchParams.get('name');

  return (
    <ReactFlowProvider
      key={editAgentId || editAgentName || 'new_agent_builder'}
    >
      <AgentBuilderCanvas />
    </ReactFlowProvider>
  );
}

/** Half a card wide, a little less than half tall — centres a drop on the cursor. */
const DROP_OFFSET = { x: 120, y: 40 };

function AgentBuilderCanvas() {
  const { workspaceId, slug } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const { create, update, remove } = useAgentMutations(workspaceId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const editAgentId = searchParams.get('agentId');
  const editAgentName = searchParams.get('name');
  const editAgentRole = searchParams.get('role');
  const editAgentModel = searchParams.get('model');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const targetAgent = useMemo(() => {
    if (!agents.data) return null;
    return agents.data.find(
      (a) =>
        (editAgentId && a.id === editAgentId) ||
        (editAgentName && a.name.toLowerCase() === editAgentName.toLowerCase()),
    );
  }, [agents.data, editAgentId, editAgentName]);

  const initialConfig = useMemo(() => {
    if (targetAgent) {
      return {
        name: targetAgent.name,
        role: targetAgent.role,
        model: targetAgent.model,
        systemPrompt: targetAgent.systemPrompt,
      };
    }
    if (editAgentName) {
      return {
        name: editAgentName,
        role: editAgentRole || 'Assistant',
        model: editAgentModel || 'gpt-4o',
      };
    }
    return {
      name: 'New AI Agent',
      role: 'Assistant',
      model: 'gpt-4o',
    };
  }, [targetAgent, editAgentName, editAgentRole, editAgentModel]);

  const graph = useAgentGraph({
    agentId: editAgentId,
    initialConfig,
  });

  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const { resolvedTheme } = useTheme();

  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    connect,
    isValidConnection,
    selected,
    focusNode,
    setSelectedId,
    addNode,
    updateField,
    removeNode,
    duplicateNode,
    placedKinds,
    issues,
    errorCount,
    warningCount,
    summary,
    tidy,
    reset,
    save,
    dirty,
    savedAt,
  } = graph;

  const issueMap = useMemo(() => {
    const errors = new Set<string>();
    const warnings = new Set<string>();
    for (const issue of issues) {
      if (!issue.nodeId) continue;
      (issue.severity === 'error' ? errors : warnings).add(issue.nodeId);
    }
    return { errors, warnings };
  }, [issues]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/w/${slug}/agents`);
    }
  }, [navigate, slug]);

  const handleAddNode = useCallback(
    (kind: AgentNodeKind, position?: { x: number; y: number }) => {
      const spec = specFor(kind);
      const created = addNode(kind, position);
      if (created) {
        toast.success(`Added ${spec.label}`, {
          description: 'Node placed onto canvas.',
        });
      } else {
        toast.info(`${spec.label} is already placed`, {
          description: 'This is a singleton node and can only appear once.',
        });
      }
    },
    [addNode],
  );

  const handleTidy = useCallback(() => {
    tidy();
    toast.info('Layout tidied', {
      description: 'Nodes automatically aligned across the canvas.',
    });
  }, [tidy]);

  const handleReset = useCallback(() => {
    reset();
    toast.info('Graph reset', {
      description: 'Canvas restored to default agent template.',
    });
  }, [reset]);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(NODE_DRAG_TYPE);
      if (!isAgentNodeKind(kind)) return;

      const point = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      handleAddNode(kind, {
        x: point.x - DROP_OFFSET.x,
        y: point.y - DROP_OFFSET.y,
      });
    },
    [handleAddNode, screenToFlowPosition],
  );

  /* React Flow owns canvas selection; mirror it so the inspector, which is
     outside the canvas, follows a click on a card. */
  const onSelectionChange = useCallback(
    ({ nodes: picked }: OnSelectionChangeParams) => {
      setSelectedId(picked[0]?.id ?? null);
    },
    [setSelectedId],
  );

  const blocked = errorCount > 0;

  /**
   * Persist the graph, then publish the agent itself.
   */
  const handleSave = useCallback(() => {
    if (blocked) {
      toast.error('Cannot save agent', {
        description: `Please resolve the ${errorCount} error${errorCount > 1 ? 's' : ''} in the Issues tab first.`,
      });
      return;
    }

    save();

    const core = nodes.find((node) => node.data.kind === 'agent');
    if (!core || !workspaceId) return;

    const existing =
      targetAgent ||
      (editAgentId
        ? agents.data?.find((agent) => agent.id === editAgentId)
        : null);

    if (existing) {
      update.mutate(
        {
          agentId: existing.id,
          input: { name: summary.name, role: summary.role },
        },
        {
          onSuccess: () => {
            toast.success('Agent saved', {
              description: `"${summary.name}" changes were saved.`,
            });
          },
          onError: () => {
            toast.error('Failed to save agent');
          },
        },
      );
      return;
    }

    create.mutate(
      { name: summary.name, role: summary.role },
      {
        onSuccess: () => {
          toast.success('Agent published', {
            description: `"${summary.name}" is now available in your workspace.`,
          });
        },
        onError: () => {
          toast.error('Failed to publish agent');
        },
      },
    );
  }, [
    agents.data,
    blocked,
    create,
    editAgentId,
    errorCount,
    nodes,
    save,
    summary.name,
    summary.role,
    targetAgent,
    update,
    workspaceId,
  ]);

  const handleDeleteAgent = useCallback(() => {
    if (!targetAgent) return;
    const name = targetAgent.name;
    remove.mutate(targetAgent.id, {
      onSuccess: () => {
        toast.info('Agent deleted', {
          description: `"${name}" was deleted from this workspace.`,
        });
        setIsDeleteOpen(false);
        navigate(`/w/${slug}/agents`);
      },
      onError: () => {
        toast.error('Failed to delete agent');
      },
    });
  }, [navigate, remove, slug, targetAgent]);

  // Keyboard shortcut for Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const displayName = summary.name || targetAgent?.name || 'Agent builder';

  return (
    <div className="min-h-160 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-background select-none">
      {/* Channel-style Header */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <Hint label="Back to AI Agents">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleBack}
                aria-label="Back to AI Agents"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Hint>

            <div className="h-4 w-px shrink-0 bg-border" />

            <div className="min-w-0 gap-2 flex items-center">
              <div className="size-7 shadow-2xs flex shrink-0 items-center justify-center rounded-md bg-accent-violet-soft text-accent-violet">
                <Bot className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 gap-1.5 flex items-center">
                <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                  {displayName}
                </h2>
                <Badge
                  variant={targetAgent ? 'primary' : 'neutral'}
                  className="px-1.5 py-0 font-medium shrink-0 text-[10px]"
                >
                  {targetAgent ? 'Editing' : 'Builder'}
                </Badge>
              </div>
            </div>

            <span className="xl:inline-block text-xs max-w-md ml-1 pl-2.5 hidden truncate border-l border-border/80 text-muted-foreground">
              Wire a model, instructions, tools and guardrails into a runnable
              agent.
            </span>
          </div>

          <div className="gap-1.5 sm:gap-2 flex items-center">
            {/* Panel Toggles */}
            <Hint
              label={showPalette ? 'Hide node palette' : 'Show node palette'}
            >
              <Button
                variant={showPalette ? 'subtle' : 'outline'}
                size="icon-sm"
                onClick={() => setShowPalette(!showPalette)}
                aria-label="Toggle node palette"
                className="text-muted-foreground hover:text-foreground"
              >
                {showPalette ? (
                  <PanelLeftClose className="size-3.5" />
                ) : (
                  <PanelLeft className="size-3.5" />
                )}
              </Button>
            </Hint>

            <Hint label={showInspector ? 'Hide inspector' : 'Show inspector'}>
              <Button
                variant={showInspector ? 'subtle' : 'outline'}
                size="icon-sm"
                onClick={() => setShowInspector(!showInspector)}
                aria-label="Toggle inspector"
                className="text-muted-foreground hover:text-foreground"
              >
                {showInspector ? (
                  <PanelRightClose className="size-3.5" />
                ) : (
                  <PanelRight className="size-3.5" />
                )}
              </Button>
            </Hint>

            <div className="h-4 mx-0.5 w-px shrink-0 bg-border" />

            <ValidationBadge
              errorCount={errorCount}
              warningCount={warningCount}
            />

            <Hint label="Auto arrange node layout">
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<LayoutGrid className="size-3.5" />}
                onClick={handleTidy}
              >
                Tidy layout
              </Button>
            </Hint>

            <Hint label="Reset graph">
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw className="size-3.5" />}
                onClick={handleReset}
              >
                Reset
              </Button>
            </Hint>

            {targetAgent ? (
              <Hint label={`Delete ${targetAgent.name}`}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsDeleteOpen(true)}
                  aria-label="Delete agent"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </Hint>
            ) : null}

            <Button
              size="sm"
              leadingIcon={<Save className="size-3.5" />}
              onClick={handleSave}
              disabled={blocked}
              title={
                blocked
                  ? 'Fix the errors in the Issues tab before saving.'
                  : undefined
              }
            >
              {dirty ? 'Save agent' : 'Saved'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main 3-Column Workspace */}
      <div className="min-h-0 relative flex flex-1 overflow-hidden">
        {/* Left Palette */}
        {showPalette ? (
          <AgentNodePalette
            onAdd={handleAddNode}
            placedKinds={placedKinds}
            className="w-72 z-10 h-full shrink-0 rounded-none border-t-0 border-r border-b-0 border-l-0 bg-surface"
          />
        ) : null}

        {/* Canvas Center */}
        <div className="min-w-0 relative h-full flex-1 overflow-hidden bg-background">
          <div className="size-full" onDrop={onDrop} onDragOver={onDragOver}>
            <NodeIssueProvider value={issueMap}>
              <ReactFlow<AgentFlowNode>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={connect}
                isValidConnection={isValidConnection}
                onSelectionChange={onSelectionChange}
                colorMode={resolvedTheme}
                fitView
                minZoom={0.3}
                maxZoom={1.75}
                proOptions={{ hideAttribution: false }}
                className="[&_.react-flow__edge-path]:stroke-[1.5]"
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1.2}
                  className="opacity-50"
                />

                {/* Floating Bottom-Left Canvas Controls */}
                <FlowPanel position="bottom-left" className="m-3">
                  <div className="gap-1 p-1 backdrop-blur flex items-center rounded-lg border border-border bg-surface/90 text-muted-foreground shadow-md">
                    <Hint label="Zoom in">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => zoomIn()}
                        aria-label="Zoom in"
                        className="size-7"
                      >
                        <ZoomIn className="size-3.5" />
                      </Button>
                    </Hint>
                    <Hint label="Zoom out">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => zoomOut()}
                        aria-label="Zoom out"
                        className="size-7"
                      >
                        <ZoomOut className="size-3.5" />
                      </Button>
                    </Hint>
                    <Hint label="Fit canvas to view">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => fitView({ padding: 0.2, duration: 400 })}
                        aria-label="Fit canvas to view"
                        className="size-7"
                      >
                        <Maximize2 className="size-3.5" />
                      </Button>
                    </Hint>
                    <div className="h-3.5 mx-0.5 my-auto w-px bg-border" />
                    <Hint label={showMiniMap ? 'Hide minimap' : 'Show minimap'}>
                      <Button
                        variant={showMiniMap ? 'subtle' : 'ghost'}
                        size="icon-sm"
                        onClick={() => setShowMiniMap(!showMiniMap)}
                        aria-label="Toggle minimap"
                        className="size-7"
                      >
                        <MapIcon className="size-3.5" />
                      </Button>
                    </Hint>
                  </div>
                </FlowPanel>

                {showMiniMap ? (
                  <MiniMap
                    pannable
                    zoomable
                    className="m-3 overflow-hidden rounded-lg border-border! bg-surface! shadow-md!"
                    nodeColor={(node) =>
                      accentFor((node as AgentFlowNode).data.kind).hex
                    }
                  />
                ) : null}

                <FlowPanel position="top-left" className="m-3">
                  <EdgeLegend />
                </FlowPanel>
              </ReactFlow>
            </NodeIssueProvider>
          </div>
        </div>

        {/* Right Inspector */}
        {showInspector ? (
          <AgentInspector
            nodes={nodes}
            edges={edges}
            selected={selected}
            issues={issues}
            summary={summary}
            onFieldChange={updateField}
            onSelect={focusNode}
            onDuplicate={duplicateNode}
            onDelete={removeNode}
            className="w-80 lg:w-88 z-10 h-full shrink-0 rounded-none border-t-0 border-r-0 border-b-0 border-l bg-surface"
          />
        ) : null}
      </div>

      {/* Docked Bottom Status Bar */}
      <StatusBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        errorCount={errorCount}
        warningCount={warningCount}
        dirty={dirty}
        savedAt={savedAt}
      />

      {/* Delete Agent Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="gap-2 flex items-center text-destructive">
              <AlertTriangle className="size-5" />
              Delete Agent
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{targetAgent?.name}</strong>?
              This will permanently remove its capabilities and configurations
              from this workspace.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteAgent}
              loading={remove.isPending}
              leadingIcon={<Trash2 className="size-4" />}
            >
              Delete Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------------------------------------- parts ---- */

function ValidationBadge({
  errorCount,
  warningCount,
}: {
  errorCount: number;
  warningCount: number;
}) {
  if (errorCount > 0) {
    return (
      <Badge
        variant="destructive"
        className="gap-1 px-2 py-0.5 text-xs font-normal"
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        {errorCount} {errorCount === 1 ? 'error' : 'errors'}
      </Badge>
    );
  }
  if (warningCount > 0) {
    return (
      <Badge
        variant="warning"
        className="gap-1 px-2 py-0.5 text-xs font-normal"
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1 px-2 py-0.5 text-xs font-normal">
      <CheckCircle2 className="size-3.5" aria-hidden />
      Valid
    </Badge>
  );
}

/**
 * The two edge styles carry different meaning, and nothing else on the canvas
 * says so — solid animated edges are the runtime path, dashed ones are wiring.
 */
function EdgeLegend() {
  return (
    <div className="gap-3 px-2.5 py-1.5 backdrop-blur flex items-center rounded-lg border border-border bg-surface/90 text-[10px] text-muted-foreground shadow-xs">
      <span className="gap-1.5 flex items-center">
        <span aria-hidden className="w-5 h-px bg-foreground/60" />
        Runtime path
      </span>
      <span className="gap-1.5 flex items-center">
        <span
          aria-hidden
          className="w-5 h-px bg-[repeating-linear-gradient(to_right,currentColor_0_4px,transparent_4px_8px)]"
        />
        Capability wiring
      </span>
    </div>
  );
}

function StatusBar({
  nodeCount,
  edgeCount,
  errorCount,
  warningCount,
  dirty,
  savedAt,
}: {
  nodeCount: number;
  edgeCount: number;
  errorCount: number;
  warningCount: number;
  dirty: boolean;
  savedAt: Date | null;
}) {
  return (
    <div className="px-4 py-1.5 text-xs gap-3 flex shrink-0 flex-wrap items-center justify-between border-t border-border bg-surface text-muted-foreground">
      <div className="gap-3 flex items-center">
        <span className="font-medium gap-1.5 flex items-center font-mono text-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'} · {edgeCount}{' '}
          {edgeCount === 1 ? 'connection' : 'connections'}
        </span>
        <span className="h-3 w-px bg-border" />
        <span className="font-mono text-[11px]">
          {errorCount === 0 && warningCount === 0 ? (
            <span className="text-accent-green">✓ Graph valid</span>
          ) : (
            <span
              className={errorCount > 0 ? 'text-destructive' : 'text-warning'}
            >
              {errorCount} {errorCount === 1 ? 'error' : 'errors'} ·{' '}
              {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
            </span>
          )}
        </span>
      </div>

      <div className="gap-4 flex items-center text-[11px]">
        <span className="sm:inline-flex gap-1.5 hidden items-center text-muted-foreground/70">
          <KbdShortcut keys={['Delete']} size="xs" variant="muted" /> delete ·{' '}
          <KbdShortcut shortcut="Space+Drag" size="xs" variant="muted" /> pan ·{' '}
          <KbdShortcut keys={['mod', 'S']} size="xs" variant="muted" /> save
        </span>

        <span
          className={cn(
            'gap-1.5 font-medium flex items-center',
            dirty ? 'text-warning' : 'text-muted-foreground',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              dirty ? 'animate-pulse bg-warning' : 'bg-accent-green',
            )}
          />
          {dirty
            ? 'Unsaved changes'
            : savedAt
              ? `Saved at ${savedAt.toLocaleTimeString()}`
              : 'All changes saved'}
        </span>
      </div>
    </div>
  );
}
