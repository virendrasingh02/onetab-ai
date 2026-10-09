import { Badge, Button, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import type { Edge, Node } from '@xyflow/react';
import { AlertTriangle, Bot, ChevronDown, ChevronRight, Network, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AGENT_SLOTS, agentHierarchy, type AgentTreeNode } from './agent-slots.js';
import { getNodeIcon } from './node-wiring-panel.js';

interface AgentOutlinePanelProps {
  nodes: Node[];
  edges: Edge[];
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
  className?: string;
}

const labelOf = (n: Node) => String((n.data as { label?: string } | undefined)?.label || n.type || 'Step');

function countAgents(trees: AgentTreeNode[]): { agents: number; teams: number; issues: number } {
  let agents = 0;
  let teams = 0;
  let issues = 0;
  const walk = (t: AgentTreeNode) => {
    agents++;
    issues += t.issues.length;
    if (t.children.length > 0) teams++;
    t.children.forEach(walk);
  };
  trees.forEach(walk);
  return { agents, teams, issues };
}

/**
 * Agents on the canvas as teams: each supervisor with its sub-agents nested
 * below, what's plugged into every agent and its setup issues. Click a row to
 * jump to it on the canvas; collapse an agent to hide what's plugged into it.
 */
export function AgentOutlinePanel({
  nodes,
  edges,
  onFocusNode,
  onClose,
  className,
}: AgentOutlinePanelProps) {
  const trees = useMemo(() => agentHierarchy(nodes, edges), [nodes, edges]);
  const totals = useMemo(() => countAgents(trees), [trees]);
  const [issuesOnly, setIssuesOnly] = useState(false);

  return (
    <div
      className={cn(
        'nowheel nodrag nopan flex w-72 flex-col overflow-hidden rounded-xl border border-border bg-surface/95 shadow-lg backdrop-blur-md',
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Network className="size-3.5 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">Agents</div>
          <div className="text-[10px] text-muted-foreground">
            {totals.agents} agent{totals.agents === 1 ? '' : 's'}
            {totals.teams > 0 && ` · ${totals.teams} team${totals.teams === 1 ? '' : 's'}`}
          </div>
        </div>
        {totals.issues > 0 && (
          <Button
            type="button"
            variant={issuesOnly ? 'secondary' : 'ghost'}
            size="xs"
            aria-pressed={issuesOnly}
            onClick={() => setIssuesOnly((v) => !v)}
            className="text-warning"
            title="Show only agents that need attention"
          >
            <AlertTriangle />
            {totals.issues}
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close agent outline">
          <X />
        </Button>
      </div>

      {trees.length === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">
          No agents yet. Add an AI Agent, or a Supervisor Agent to build a team.
        </div>
      ) : (
        <ScrollArea className="max-h-[min(60vh,480px)]">
          <ul className="space-y-0.5 p-1.5" role="tree" aria-label="Agents">
            {trees.map((tree) => (
              <AgentRow
                key={tree.agent.id}
                tree={tree}
                depth={0}
                issuesOnly={issuesOnly}
                onFocusNode={onFocusNode}
              />
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

function hasIssuesBelow(tree: AgentTreeNode): boolean {
  return tree.issues.length > 0 || tree.children.some(hasIssuesBelow);
}

function AgentRow({
  tree,
  depth,
  issuesOnly,
  onFocusNode,
}: {
  tree: AgentTreeNode;
  depth: number;
  issuesOnly: boolean;
  onFocusNode: (nodeId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (issuesOnly && !hasIssuesBelow(tree)) return null;
  const { agent, attachments, children, issues } = tree;
  const plugged = AGENT_SLOTS.filter((s) => s.id !== 'agents').flatMap((s) =>
    attachments[s.id].map((n) => ({ slot: s.label, node: n })),
  );
  const hasBody = plugged.length > 0 || children.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasBody ? open : undefined}>
      <div
        className="group/row flex items-center gap-1 rounded-md pr-1 hover:bg-surface-raised"
        style={{ paddingLeft: depth * 14 }}
      >
        <button
          type="button"
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground',
            !hasBody && 'invisible',
          )}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fold' : 'Unfold'}
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        <button
          type="button"
          onClick={() => onFocusNode(agent.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
          title={`Go to ${labelOf(agent)}`}
        >
          {children.length > 0 ? (
            <Network className="size-3.5 shrink-0 text-primary" />
          ) : (
            <Bot className="size-3.5 shrink-0 text-primary" />
          )}
          <span className="truncate text-[11px] font-medium text-foreground">{labelOf(agent)}</span>
          {children.length > 0 && (
            <Badge variant="primary" className="h-4 shrink-0 px-1 text-[9px]">
              {children.length}
            </Badge>
          )}
        </button>
        {issues.length > 0 && (
          <span className="shrink-0 text-warning" title={issues.join('\n')}>
            <AlertTriangle className="size-3" />
          </span>
        )}
      </div>

      {open && hasBody && (
        <ul role="group">
          {plugged.map(({ slot, node }) => {
            const Icon = getNodeIcon(node.type);
            return (
              <li key={node.id} role="treeitem">
                <button
                  type="button"
                  onClick={() => onFocusNode(node.id)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md py-0.5 pr-1 text-left hover:bg-surface-raised',
                  )}
                  style={{ paddingLeft: (depth + 1) * 14 + 20 }}
                  title={`Go to ${labelOf(node)}`}
                >
                  <Icon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-[10px] text-foreground">{labelOf(node)}</span>
                  <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">{slot}</span>
                </button>
              </li>
            );
          })}
          {children.map((child) => (
            <AgentRow
              key={child.agent.id}
              tree={child}
              depth={depth + 1}
              issuesOnly={issuesOnly}
              onFocusNode={onFocusNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
