import { Button, Input } from '@org/ui';
import { cn } from '@org/utils';
import type { Edge, Node } from '@xyflow/react';
import {
  ArrowRight,
  CornerDownRight,
  GitBranch,
  Plus,
  Route,
  Slash,
  Spline,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  EDGE_ROUTING_HINTS,
  EDGE_ROUTING_LABELS,
  isEdgeRouting,
  type EdgeRouting,
  type EdgeRoutingOverride,
} from './edge-routing';

const ROUTING_OPTIONS: { value: EdgeRouting; Icon: typeof Spline }[] = [
  { value: 'smooth', Icon: Spline },
  { value: 'step', Icon: CornerDownRight },
  { value: 'smart', Icon: Route },
  { value: 'straight', Icon: Slash },
];

interface EdgeDataInspectorProps {
  selectedEdge: Edge | null;
  nodes: Node[];
  /** The canvas-wide routing this connection follows unless it overrides it. */
  canvasRouting?: EdgeRouting;
  onUpdateEdge: (edgeId: string, patch: Partial<Edge>) => void;
  onDeleteEdge: (edgeId: string) => void;
  onInsertNodeOnEdge?: (edge: Edge) => void;
  onClose: () => void;
  className?: string;
}

export function EdgeDataInspector({
  selectedEdge,
  nodes,
  canvasRouting = 'smooth',
  onUpdateEdge,
  onDeleteEdge,
  onInsertNodeOnEdge,
  onClose,
  className,
}: EdgeDataInspectorProps) {
  // Hooks first: an early return before them changes the hook order between renders.
  const edgeData = (selectedEdge?.data || {}) as Record<string, any>;
  const currentLabel = String(selectedEdge?.label || edgeData.label || '');
  const [labelInput, setLabelInput] = useState(currentLabel);
  const [branchType, setBranchType] = useState<string>(
    edgeData.branch || (currentLabel.toLowerCase() === 'false' ? 'false' : 'true'),
  );
  if (!selectedEdge) return null;

  const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
  const targetNode = nodes.find((n) => n.id === selectedEdge.target);

  const handleSaveLabel = () => {
    const trimmed = labelInput.trim();
    onUpdateEdge(selectedEdge.id, {
      label: trimmed || undefined,
      data: {
        ...edgeData,
        label: trimmed || undefined,
        branch: branchType,
      },
    });
  };

  const routingOverride: EdgeRoutingOverride = isEdgeRouting(edgeData.routing) ? edgeData.routing : 'auto';
  const setRouting = (value: EdgeRoutingOverride) =>
    onUpdateEdge(selectedEdge.id, { data: { routing: value === 'auto' ? undefined : value } });

  const isConditional =
    sourceNode?.type?.includes('IF') ||
    sourceNode?.type?.includes('CONDITION') ||
    sourceNode?.type?.includes('SWITCH') ||
    Boolean(selectedEdge.sourceHandle) ||
    Boolean(currentLabel);

  return (
    <aside
      aria-label="Connection data inspector"
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-2xl select-none',
        'animate-in fade-in slide-in-from-right-2 duration-150',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-border/60">
        <GitBranch className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">Data Flow Connection</h3>
          <p className="truncate text-[10px] text-muted-foreground font-mono">{selectedEdge.id}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onDeleteEdge(selectedEdge.id)}
          className="text-muted-foreground hover:text-destructive"
          title="Delete connection"
          aria-label="Delete connection"
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          title="Close inspector"
          aria-label="Close"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Source -> Target Summary */}
        <div className="rounded-xl border border-border bg-surface-raised/40 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Execution Path
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex-1 rounded-lg bg-surface border border-border p-2">
              <div className="font-semibold text-foreground truncate">
                {sourceNode?.data?.label ? String(sourceNode.data.label) : selectedEdge.source}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Handle: {selectedEdge.sourceHandle || 'output (default)'}
              </div>
            </div>

            <ArrowRight className="size-4 text-muted-foreground shrink-0" />

            <div className="flex-1 rounded-lg bg-surface border border-border p-2">
              <div className="font-semibold text-foreground truncate">
                {targetNode?.data?.label ? String(targetNode.data.label) : selectedEdge.target}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Handle: {selectedEdge.targetHandle || 'input (default)'}
              </div>
            </div>
          </div>
        </div>

        {/* Routing: follow the canvas, or draw this one connection its own way */}
        <div className="space-y-2 rounded-xl border border-border bg-surface-raised/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Routing</div>
          <div role="radiogroup" aria-label="Connection routing" className="grid grid-cols-5 gap-1">
            <RoutingOption
              checked={routingOverride === 'auto'}
              onSelect={() => setRouting('auto')}
              label="Auto"
              title={`Follow the canvas (${EDGE_ROUTING_LABELS[canvasRouting]})`}
            >
              <span className="text-[10px] font-semibold">A</span>
            </RoutingOption>
            {ROUTING_OPTIONS.map(({ value, Icon }) => (
              <RoutingOption
                key={value}
                checked={routingOverride === value}
                onSelect={() => setRouting(value)}
                label={EDGE_ROUTING_LABELS[value]}
                title={EDGE_ROUTING_HINTS[value]}
              >
                <Icon className="size-3.5" />
              </RoutingOption>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {routingOverride === 'auto'
              ? `Follows the canvas: ${EDGE_ROUTING_LABELS[canvasRouting]}.`
              : `${EDGE_ROUTING_HINTS[routingOverride]} — for this connection only.`}
          </p>
        </div>

        {/* Condition / Branching Settings */}
        {isConditional && (
          <div className="space-y-2.5 rounded-xl border border-border bg-surface-raised/30 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Branch Condition
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Edge Label / Expression
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="e.g. True, False, amount > 1000"
                  className="h-8 text-xs font-mono"
                />
                <Button size="xs" onClick={handleSaveLabel} className="shrink-0 h-8">
                  Apply
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              {['true', 'false', 'fallback', 'custom'].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBranchType(b);
                    onUpdateEdge(selectedEdge.id, {
                      data: { ...edgeData, branch: b },
                    });
                  }}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize border transition-colors',
                    branchType === b
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-surface text-muted-foreground border-border hover:text-foreground',
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payload Schema & Simulation */}
        <div className="space-y-2 rounded-xl border border-border bg-surface-raised/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Data Flow Schema
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">
              JSON payload
            </span>
          </div>
          <div className="rounded-lg bg-surface border border-border p-2.5 font-mono text-[11px] text-muted-foreground overflow-x-auto">
            <pre>
              {JSON.stringify(
                {
                  fromStep: sourceNode?.id,
                  type: sourceNode?.type,
                  variable: '{{__last}}',
                  payload: {
                    status: 'success',
                    data: sourceNode?.data?.config || {},
                  },
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>

        {/* Quick Insert Node Between */}
        {onInsertNodeOnEdge && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInsertNodeOnEdge(selectedEdge)}
              className="w-full gap-2 text-xs border-dashed text-primary hover:bg-primary/10"
            >
              <Plus className="size-3.5" />
              <span>Insert Step Between Nodes</span>
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

function RoutingOption({
  checked,
  onSelect,
  label,
  title,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      title={title}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition-colors',
        checked
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-surface text-muted-foreground hover:text-foreground',
      )}
    >
      <span className="flex h-3.5 items-center">{children}</span>
      <span className="truncate max-w-full">{label}</span>
    </button>
  );
}
