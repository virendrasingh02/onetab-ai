/**
 * The agent canvas: node palette, React Flow graph and inspector, with a slim
 * toolbar and a status bar. It owns no agent state — the editor passes the
 * `useAgentGraph` controller in, because Save, Test and Publish (in the
 * editor's header) need the same graph.
 */

import { useTheme } from '@org/design-system';
import { Badge, Button, Hint, KbdShortcut, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel as FlowPanel,
  ReactFlow,
  useReactFlow,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Map as MapIcon,
  Maximize2,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useMemo, useState, type DragEvent } from 'react';
import {
  AgentInspector,
  AgentNodePalette,
  NODE_DRAG_TYPE,
  NodeIssueProvider,
  accentFor,
  isAgentNodeKind,
  nodeTypes,
  specFor,
  type AgentFlowNode,
  type AgentNodeKind,
  type useAgentGraph,
} from '../agent-graph/index.js';

export type AgentGraphController = ReturnType<typeof useAgentGraph>;

/** Half a card wide, a little less than half tall — centres a drop on the cursor. */
const DROP_OFFSET = { x: 120, y: 40 };

export interface AgentBuilderWorkbenchProps {
  graph: AgentGraphController;
  /** The viewer can look but not change anything (not the creator or an admin). */
  readOnly?: boolean;
}

export function AgentBuilderWorkbench({ graph, readOnly = false }: AgentBuilderWorkbenchProps) {
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const [showPalette, setShowPalette] = useState(!readOnly);
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

  const handleAddNode = useCallback(
    (kind: AgentNodeKind, position?: { x: number; y: number }) => {
      const spec = specFor(kind);
      if (!addNode(kind, position)) {
        toast.info(`${spec.label} is already placed`, {
          description: 'An agent has one of these; edit the existing one.',
        });
      }
    },
    [addNode],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (readOnly) return;
      const kind = event.dataTransfer.getData(NODE_DRAG_TYPE);
      if (!isAgentNodeKind(kind)) return;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      handleAddNode(kind, { x: point.x - DROP_OFFSET.x, y: point.y - DROP_OFFSET.y });
    },
    [handleAddNode, readOnly, screenToFlowPosition],
  );

  /* React Flow owns canvas selection; mirror it so the inspector, which is
     outside the canvas, follows a click on a card. */
  const onSelectionChange = useCallback(
    ({ nodes: picked }: OnSelectionChangeParams) => setSelectedId(picked[0]?.id ?? null),
    [setSelectedId],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-background px-3 py-1.5">
        {!readOnly ? (
          <Hint label={showPalette ? 'Hide node palette' : 'Show node palette'}>
            <Button
              variant={showPalette ? 'subtle' : 'ghost'}
              size="icon-sm"
              onClick={() => setShowPalette(!showPalette)}
              aria-label="Toggle node palette"
              aria-pressed={showPalette}
            >
              {showPalette ? <PanelLeftClose className="size-3.5" /> : <PanelLeft className="size-3.5" />}
            </Button>
          </Hint>
        ) : null}
        <Hint label={showInspector ? 'Hide inspector' : 'Show inspector'}>
          <Button
            variant={showInspector ? 'subtle' : 'ghost'}
            size="icon-sm"
            onClick={() => setShowInspector(!showInspector)}
            aria-label="Toggle inspector"
            aria-pressed={showInspector}
          >
            {showInspector ? <PanelRightClose className="size-3.5" /> : <PanelRight className="size-3.5" />}
          </Button>
        </Hint>
        <div className="mx-1 h-4 w-px bg-border" />
        <ValidationBadge errorCount={errorCount} warningCount={warningCount} />
        {readOnly ? (
          <Badge variant="neutral" className="text-[11px]">
            View only — ask the creator or an admin to change it
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {!readOnly ? (
            <>
              <Hint label="Line nodes up in rows">
                <Button variant="ghost" size="sm" leadingIcon={<LayoutGrid className="size-3.5" />} onClick={tidy}>
                  Tidy
                </Button>
              </Hint>
              <Hint label="Start over from the default graph">
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<RotateCcw className="size-3.5" />}
                  onClick={() => {
                    reset();
                    toast.info('Graph reset', { description: 'Save to keep it, or leave without saving.' });
                  }}
                >
                  Reset
                </Button>
              </Hint>
            </>
          ) : null}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {showPalette && !readOnly ? (
          <AgentNodePalette
            onAdd={handleAddNode}
            placedKinds={placedKinds}
            className="z-10 hidden h-full w-64 shrink-0 rounded-none border-t-0 border-r border-b-0 border-l-0 bg-surface md:flex"
          />
        ) : null}

        <div className="relative h-full min-w-0 flex-1 overflow-hidden bg-background">
          <div className="size-full" onDrop={onDrop} onDragOver={onDragOver}>
            <NodeIssueProvider value={issueMap}>
              <ReactFlow<AgentFlowNode>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={readOnly ? undefined : onNodesChange}
                onEdgesChange={readOnly ? undefined : onEdgesChange}
                onConnect={readOnly ? undefined : connect}
                isValidConnection={isValidConnection}
                onSelectionChange={onSelectionChange}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable
                colorMode={resolvedTheme}
                fitView
                minZoom={0.3}
                maxZoom={1.75}
                // The graph's `output` node type shares its name with React
                // Flow's built-in one, whose stylesheet boxes it in a white,
                // 150px-wide bordered card. Our node draws its own card.
                // (`\_` keeps Tailwind from reading `_` in a variant as a space.)
                className="[&_.react-flow\_\_edge-path]:stroke-[1.5] [&_.react-flow\_\_node-output]:!w-auto [&_.react-flow\_\_node-output]:!border-0 [&_.react-flow\_\_node-output]:!bg-transparent [&_.react-flow\_\_node-output]:!p-0 [&_.react-flow\_\_node-output]:!text-left [&_.react-flow\_\_node-output]:!shadow-none"
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} className="opacity-50" />
                <FlowPanel position="bottom-left" className="m-3">
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/90 p-1 text-muted-foreground shadow-md backdrop-blur">
                    <Hint label="Zoom in">
                      <Button variant="ghost" size="icon-sm" onClick={() => zoomIn()} aria-label="Zoom in" className="size-7">
                        <ZoomIn className="size-3.5" />
                      </Button>
                    </Hint>
                    <Hint label="Zoom out">
                      <Button variant="ghost" size="icon-sm" onClick={() => zoomOut()} aria-label="Zoom out" className="size-7">
                        <ZoomOut className="size-3.5" />
                      </Button>
                    </Hint>
                    <Hint label="Fit to view">
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
                    <div className="mx-0.5 my-auto h-3.5 w-px bg-border" />
                    <Hint label={showMiniMap ? 'Hide minimap' : 'Show minimap'}>
                      <Button
                        variant={showMiniMap ? 'subtle' : 'ghost'}
                        size="icon-sm"
                        onClick={() => setShowMiniMap(!showMiniMap)}
                        aria-label="Toggle minimap"
                        aria-pressed={showMiniMap}
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
                    className="m-3 hidden overflow-hidden rounded-lg border-border! bg-surface! shadow-md! sm:block"
                    nodeColor={(node) => accentFor((node as AgentFlowNode).data.kind).hex}
                  />
                ) : null}
                <FlowPanel position="top-left" className="m-3 hidden sm:block">
                  <EdgeLegend />
                </FlowPanel>
              </ReactFlow>
            </NodeIssueProvider>
          </div>
        </div>

        {showInspector ? (
          <AgentInspector
            nodes={nodes}
            edges={edges}
            selected={selected}
            issues={issues}
            summary={summary}
            readOnly={readOnly}
            onFieldChange={readOnly ? () => undefined : updateField}
            onSelect={focusNode}
            onDuplicate={readOnly ? () => undefined : duplicateNode}
            onDelete={readOnly ? () => undefined : removeNode}
            className={cn(
              'z-10 h-full shrink-0 rounded-none border-t-0 border-r-0 border-b-0 border-l bg-surface',
              // On narrow screens the inspector overlays the canvas instead of squeezing it.
              'absolute inset-y-0 right-0 w-full max-w-sm md:static md:w-80 lg:w-88',
            )}
          />
        ) : null}
      </div>

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

function ValidationBadge({ errorCount, warningCount }: { errorCount: number; warningCount: number }) {
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
      Ready
    </Badge>
  );
}

/**
 * The two edge styles carry different meaning, and nothing else on the canvas
 * says so — solid animated edges are the runtime path, dashed ones are wiring.
 */
function EdgeLegend() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/90 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-xs backdrop-blur">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-px w-5 bg-foreground/60" />
        Runs through
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-px w-5 bg-[repeating-linear-gradient(to_right,currentColor_0_4px,transparent_4px_8px)]"
        />
        Gives the agent
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
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-1.5 text-xs text-muted-foreground">
      <span className="font-mono">
        {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'} · {edgeCount} {edgeCount === 1 ? 'connection' : 'connections'}
        {errorCount + warningCount > 0 ? ` · ${errorCount} errors · ${warningCount} warnings` : ''}
      </span>
      <div className="flex items-center gap-4 text-[11px]">
        <span className="hidden items-center gap-1.5 text-muted-foreground/70 sm:inline-flex">
          <KbdShortcut keys={['Delete']} size="xs" variant="muted" /> delete ·{' '}
          <KbdShortcut keys={['mod', 'S']} size="xs" variant="muted" /> save
        </span>
        <span className={cn('flex items-center gap-1.5 font-medium', dirty ? 'text-warning' : 'text-muted-foreground')}>
          <span aria-hidden className={cn('size-1.5 rounded-full', dirty ? 'animate-pulse bg-warning' : 'bg-accent-green')} />
          {dirty ? 'Unsaved changes' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : 'All changes saved'}
        </span>
      </div>
    </div>
  );
}
