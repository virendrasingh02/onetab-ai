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
import { Badge, Button, Hint, toast } from '@org/ui';
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
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
  /* `screenToFlowPosition` — used to place a dropped node under the cursor —
     only exists inside the provider, so the screen body is a child. */
  return (
    <ReactFlowProvider>
      <AgentBuilderCanvas />
    </ReactFlowProvider>
  );
}

/** Half a card wide, a little less than half tall — centres a drop on the cursor. */
const DROP_OFFSET = { x: 120, y: 40 };

function AgentBuilderCanvas() {
  const graph = useAgentGraph();
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const { workspaceId, slug } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const { create, update } = useAgentMutations(workspaceId);
  const navigate = useNavigate();

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
      navigate(`/w/${slug}/agents?tab=all`);
    }
  }, [navigate, slug]);

  const handleAddNode = useCallback(
    (kind: AgentNodeKind, position?: { x: number; y: number }) => {
      const spec = specFor(kind);
      addNode(kind, position);
      toast.success(`Added ${spec.label}`, {
        description: 'Node placed onto canvas.',
      });
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

      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      handleAddNode(kind, { x: point.x - DROP_OFFSET.x, y: point.y - DROP_OFFSET.y });
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

    const existing = agents.data?.find((agent) => agent.name === summary.name);
    if (existing) {
      update.mutate(
        {
          agentId: existing.id,
          input: { name: summary.name, role: summary.role },
        },
        {
          onSuccess: () => {
            toast.success('Agent saved', {
              description: `"${summary.name}" has been updated.`,
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
  }, [agents.data, blocked, create, errorCount, nodes, save, summary.name, summary.role, update, workspaceId]);

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

  return (
    <div className="h-[calc(100vh-3.5rem)] min-h-160 flex flex-col bg-background overflow-hidden select-none">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Hint label="Back to AI Agents">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleBack}
                aria-label="Back to AI Agents"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Hint>

            <div className="h-4 w-px bg-border shrink-0" />

            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-violet-soft text-accent-violet shadow-2xs">
                <Bot className="size-4" aria-hidden />
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {summary.name || 'Agent builder'}
                </h2>
                <Badge variant="neutral" className="px-1.5 py-0 text-[10px] font-medium shrink-0">
                  Builder
                </Badge>
              </div>
            </div>

            <span className="hidden xl:inline-block text-xs text-muted-foreground truncate max-w-md ml-1 pl-2.5 border-l border-border/80">
              Wire a model, instructions, tools and guardrails into a runnable agent.
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Panel Toggles */}
            <Hint label={showPalette ? 'Hide node palette' : 'Show node palette'}>
              <Button
                variant={showPalette ? 'subtle' : 'outline'}
                size="icon-sm"
                onClick={() => setShowPalette(!showPalette)}
                aria-label="Toggle node palette"
                className="text-muted-foreground hover:text-foreground"
              >
                {showPalette ? <PanelLeftClose className="size-3.5" /> : <PanelLeft className="size-3.5" />}
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
                {showInspector ? <PanelRightClose className="size-3.5" /> : <PanelRight className="size-3.5" />}
              </Button>
            </Hint>

            <div className="h-4 w-px bg-border shrink-0 mx-0.5" />

            <ValidationBadge errorCount={errorCount} warningCount={warningCount} />

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
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* Left Palette */}
        {showPalette ? (
          <AgentNodePalette
            onAdd={handleAddNode}
            placedKinds={placedKinds}
            className="w-72 h-full border-r border-t-0 border-b-0 border-l-0 rounded-none bg-surface shrink-0 z-10"
          />
        ) : null}

        {/* Canvas Center */}
        <div className="flex-1 min-w-0 h-full relative bg-background overflow-hidden">
          <div
            className="size-full"
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
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
                  <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-surface/90 shadow-md backdrop-blur text-muted-foreground">
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
                    <div className="h-3.5 w-px bg-border my-auto mx-0.5" />
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
                    className="bg-surface! border-border! shadow-md! rounded-lg overflow-hidden m-3"
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
            className="w-80 lg:w-88 h-full border-l border-t-0 border-b-0 border-r-0 rounded-none bg-surface shrink-0 z-10"
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
      <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-xs font-normal">
        <AlertTriangle className="size-3.5" aria-hidden />
        {errorCount} {errorCount === 1 ? 'error' : 'errors'}
      </Badge>
    );
  }
  if (warningCount > 0) {
    return (
      <Badge variant="warning" className="gap-1 px-2 py-0.5 text-xs font-normal">
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
    <div className="gap-3 px-2.5 py-1.5 flex items-center rounded-lg border border-border bg-surface/90 text-[10px] backdrop-blur text-muted-foreground shadow-xs">
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
    <div className="px-4 py-1.5 border-t border-border bg-surface text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-mono text-foreground font-medium flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" />
          {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'} · {edgeCount} {edgeCount === 1 ? 'connection' : 'connections'}
        </span>
        <span className="h-3 w-px bg-border" />
        <span className="font-mono text-[11px]">
          {errorCount === 0 && warningCount === 0 ? (
            <span className="text-accent-green">✓ Graph valid</span>
          ) : (
            <span className={errorCount > 0 ? 'text-destructive' : 'text-warning'}>
              {errorCount} {errorCount === 1 ? 'error' : 'errors'} · {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[11px]">
        <span className="hidden sm:inline text-muted-foreground/70">
          <kbd className="px-1 py-0.5 rounded bg-surface-raised border border-border text-[10px] font-mono">Del</kbd> delete · <kbd className="px-1 py-0.5 rounded bg-surface-raised border border-border text-[10px] font-mono">Space+Drag</kbd> pan · <kbd className="px-1 py-0.5 rounded bg-surface-raised border border-border text-[10px] font-mono">Ctrl+S</kbd> save
        </span>

        <span
          className={cn(
            'gap-1.5 flex items-center font-medium',
            dirty ? 'text-warning' : 'text-muted-foreground',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              dirty ? 'bg-warning animate-pulse' : 'bg-accent-green',
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
