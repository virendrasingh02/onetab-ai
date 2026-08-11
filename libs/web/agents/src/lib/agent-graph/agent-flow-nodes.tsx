/**
 * The card React Flow paints for every node.
 *
 * There is one component, not nine: each kind's icon, accent, sockets and
 * summary line come from `NODE_SPECS`, so a card is a rendering of the spec
 * rather than a hand-written variant that can drift from it.
 */

import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import { Badge } from '@org/ui';
import { cn } from '@org/utils';
import { AlertTriangle } from 'lucide-react';
import { createContext, useContext } from 'react';
import {
  CATEGORY_LABEL,
  NODE_KINDS,
  accentFor,
  specFor,
} from './agent-graph-model.js';
import { HANDLE, type AgentFlowNode } from './use-agent-graph.js';

/**
 * Node ids the validator has an opinion about.
 *
 * Passed by context rather than folded into node data: the validator derives
 * these from the graph, and writing them back into the nodes it just read
 * would make every keystroke a graph mutation.
 */
export interface NodeIssueMap {
  errors: ReadonlySet<string>;
  warnings: ReadonlySet<string>;
}

const NodeIssueContext = createContext<NodeIssueMap>({
  errors: new Set(),
  warnings: new Set(),
});

export const NodeIssueProvider = NodeIssueContext.Provider;

const HANDLE_BASE =
  'size-2.5! border-2! border-background! transition-transform hover:scale-125!';

export function AgentFlowNodeCard({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const spec = specFor(data.kind);
  const accent = accentFor(data.kind);
  const Icon = spec.icon;
  const { errors, warnings } = useContext(NodeIssueContext);

  const hasError = errors.has(id);
  const hasWarning = !hasError && warnings.has(id);
  const isCore = data.kind === 'agent';

  const title = isCore
    ? String(data.config['name'] || 'Untitled agent')
    : spec.label;

  return (
    <div
      className={cn(
        'w-60 rounded-xl border-2 bg-surface shadow-sm',
        'transition-[border-color,box-shadow] duration-(--duration-fast)',
        isCore && 'w-64',
        selected
          ? 'border-primary shadow-md ring-2 ring-primary/25'
          : hasError
            ? 'border-destructive/60'
            : accent.border,
      )}
    >
      {spec.handles.in ? (
        <Handle
          id={HANDLE.in}
          type="target"
          position={Position.Left}
          className={cn(HANDLE_BASE, accent.handle)}
        />
      ) : null}
      {spec.handles.caps ? (
        <Handle
          id={HANDLE.caps}
          type="target"
          position={Position.Top}
          className={cn(HANDLE_BASE, 'bg-border-strong!')}
        />
      ) : null}

      <div className="px-3 py-2.5">
        <div className="gap-2 flex items-start">
          <span
            aria-hidden
            className={cn(
              'size-7 flex shrink-0 items-center justify-center rounded-lg',
              accent.chip,
            )}
          >
            <Icon className="size-3.5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="gap-1.5 flex items-center">
              <span
                className={cn(
                  'text-[9px] font-semibold uppercase tracking-wider',
                  accent.text,
                )}
              >
                {CATEGORY_LABEL[spec.category]}
              </span>
              {hasError || hasWarning ? (
                <AlertTriangle
                  className={cn(
                    'size-3',
                    hasError ? 'text-destructive' : 'text-warning',
                  )}
                  aria-label={hasError ? 'Has errors' : 'Has warnings'}
                />
              ) : null}
            </div>
            <h4 className="text-xs font-semibold truncate text-foreground">
              {title}
            </h4>
          </div>
        </div>

        <p className="mt-2 text-[10px] font-mono truncate text-muted-foreground">
          {spec.summary(data.config)}
        </p>

        {isCore ? (
          <Badge variant="primary" className="mt-2 text-[9px] uppercase">
            {String(data.config['autonomy'] ?? 'supervised')}
          </Badge>
        ) : null}
      </div>

      {spec.handles.out ? (
        <Handle
          id={HANDLE.out}
          type="source"
          position={Position.Right}
          className={cn(HANDLE_BASE, accent.handle)}
        />
      ) : null}
      {spec.handles.cap ? (
        <Handle
          id={HANDLE.cap}
          type="source"
          position={Position.Bottom}
          className={cn(HANDLE_BASE, accent.handle)}
        />
      ) : null}
    </div>
  );
}

/**
 * Every kind resolves to the same component. React Flow still needs the map,
 * because the node's `type` is what it looks up.
 */
export const nodeTypes: NodeTypes = Object.fromEntries(
  NODE_KINDS.map((kind) => [kind, AgentFlowNodeCard]),
) as NodeTypes;
