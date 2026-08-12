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
import { Badge, Button, Page, PageHeader } from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Background,
  BackgroundVariant,
  Controls,
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
  Bot,
  CheckCircle2,
  LayoutGrid,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useCallback, useMemo, type DragEvent } from 'react';
import {
  AgentInspector,
  AgentNodePalette,
  NODE_DRAG_TYPE,
  NodeIssueProvider,
  accentFor,
  isAgentNodeKind,
  nodeTypes,
  useAgentGraph,
  type AgentFlowNode,
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
  const { screenToFlowPosition } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const { workspaceId } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const { create, update } = useAgentMutations(workspaceId);

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
      addNode(kind, { x: point.x - DROP_OFFSET.x, y: point.y - DROP_OFFSET.y });
    },
    [addNode, screenToFlowPosition],
  );

  /* React Flow owns canvas selection; mirror it so the inspector, which is
     outside the canvas, follows a click on a card. */
  const onSelectionChange = useCallback(
    ({ nodes: picked }: OnSelectionChangeParams) => {
      setSelectedId(picked[0]?.id ?? null);
    },
    [setSelectedId],
  );

  /**
   * Persist the graph, then publish the agent itself.
   *
   * The graph store keeps the canvas; the agent row is what the rest of the app
   * reads, so a save that only touched the store would leave the sidebar and
   * the directory showing the old name and role. An agent already carrying this
   * name is updated rather than duplicated — saving twice is an edit, not a
   * second agent.
   */
  const handleSave = useCallback(() => {
    save();

    const core = nodes.find((node) => node.data.kind === 'agent');
    if (!core || !workspaceId) return;

    const existing = agents.data?.find((agent) => agent.name === summary.name);
    if (existing) {
      update.mutate({
        agentId: existing.id,
        input: { name: summary.name, role: summary.role },
      });
      return;
    }

    create.mutate({ name: summary.name, role: summary.role });
  }, [agents.data, create, nodes, save, summary.name, summary.role, update, workspaceId]);

  const blocked = errorCount > 0;

  return (
    <Page width="full">
      <PageHeader
        title="Agent builder"
        description="Wire a model, instructions, tools and guardrails into a runnable agent."
        icon={<Bot />}
        accent="violet"
        actions={
          <>
            <ValidationBadge errorCount={errorCount} warningCount={warningCount} />
            <Button variant="outline" leadingIcon={<LayoutGrid />} onClick={tidy}>
              Tidy layout
            </Button>
            <Button variant="ghost" leadingIcon={<RotateCcw />} onClick={reset}>
              Reset
            </Button>
            <Button
              leadingIcon={<Save />}
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
          </>
        }
      />

      {/* A fixed canvas height, as `WorkflowCanvasView` uses: the shell owns the
          scrolling `<main>`, so sizing off `100vh` here overflows it by however
          tall the chrome happens to be. */}
      <div className="gap-3 lg:flex-row lg:h-160 flex flex-col">
        <AgentNodePalette
          onAdd={addNode}
          placedKinds={placedKinds}
          className="lg:w-60 lg:h-full h-64 shrink-0"
        />

        {/* An explicit height below `lg`: stacked in a column with no height of
            its own, `flex-1` would resolve against nothing and React Flow would
            render into a zero-height box. */}
        <div className="min-w-0 lg:h-full h-130 flex-1 rounded-xl border bg-background overflow-hidden relative">
          <div
            className="size-full"
            onDrop={onDrop}
            onDragOver={onDragOver}
            /* React Flow renders its own canvas here; the wrapper only exists
               to catch drops from the palette. */
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
                  gap={18}
                  size={1}
                  className="opacity-60"
                />
                <Controls
                  className="bg-surface! border-border! shadow-md!"
                  showInteractive={false}
                />
                <MiniMap
                  pannable
                  zoomable
                  className="bg-surface! border-border!"
                  nodeColor={(node) =>
                    accentFor((node as AgentFlowNode).data.kind).hex
                  }
                />
                <FlowPanel position="top-left">
                  <EdgeLegend />
                </FlowPanel>
              </ReactFlow>
            </NodeIssueProvider>
          </div>
        </div>

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
          className="lg:w-80 lg:h-full h-96 shrink-0"
        />
      </div>

      <StatusBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        errorCount={errorCount}
        warningCount={warningCount}
        dirty={dirty}
        savedAt={savedAt}
      />
    </Page>
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
      <Badge variant="destructive" className="px-2 py-1">
        <AlertTriangle aria-hidden />
        {errorCount} {errorCount === 1 ? 'error' : 'errors'}
      </Badge>
    );
  }
  if (warningCount > 0) {
    return (
      <Badge variant="warning" className="px-2 py-1">
        <AlertTriangle aria-hidden />
        {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="px-2 py-1">
      <CheckCircle2 aria-hidden />
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
    <div className="gap-3 px-2.5 py-1.5 flex items-center rounded-lg border bg-surface/90 text-[10px] backdrop-blur text-muted-foreground">
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
    <div className="mt-3 gap-x-4 gap-y-1 px-3 py-2 flex flex-wrap items-center rounded-lg border bg-surface text-[11px] text-muted-foreground">
      <span className="font-mono">
        {nodeCount} nodes · {edgeCount} connections
      </span>
      <span className="font-mono">
        {errorCount} errors · {warningCount} warnings
      </span>
      <span
        className={cn(
          'gap-1.5 flex items-center ml-auto',
          dirty ? 'text-warning' : 'text-muted-foreground',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-1.5 rounded-full',
            dirty ? 'bg-warning' : 'bg-accent-green',
          )}
        />
        {dirty
          ? 'Unsaved changes'
          : savedAt
            ? `Saved at ${savedAt.toLocaleTimeString()}`
            : 'No changes yet'}
      </span>
    </div>
  );
}
