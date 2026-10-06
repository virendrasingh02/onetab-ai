import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import type { Connection, Edge, Node } from '@xyflow/react';
import {
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  Flame,
  Folder,
  GitBranch,
  Info,
  Play,
  Repeat,
  StickyNote,
  UserCheck,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AGENT_SLOTS } from './agent-slots.js';
import { CATALOG_NODES } from './node-library.js';

/** Tools an agent node can have attached (ids stored in `config.tools`). */
export const AGENT_TOOLS: { id: string; name: string }[] = [
  { id: 'search_docs', name: 'Knowledge / Document Search' },
  { id: 'firecrawl_search', name: 'Firecrawl Web Search' },
  { id: 'firecrawl_scrape', name: 'Firecrawl Scrape' },
  { id: 'create_task', name: 'Kanban Task Creator' },
  { id: 'send_channel_message', name: 'Chat Channel Post' },
];

/** Icon for a node type: the catalog's own icon, else a family fallback. */
export function getNodeIcon(type: string | undefined): LucideIcon {
  const t = (type || '').toUpperCase();
  const fromCatalog = CATALOG_NODES.find((n) => n.type === t)?.icon;
  if (fromCatalog) return fromCatalog;
  if (t === 'START' || t.startsWith('TRIGGER')) return Play;
  if (t === 'END' || t === 'OUTPUT') return CheckCircle2;
  if (t.includes('AGENT') || t.startsWith('AI_') || t.includes('LLM')) return Bot;
  if (t.startsWith('FIRECRAWL')) return Flame;
  if (t.includes('TOOL') || t.includes('MCP')) return Wrench;
  if (t.includes('CODE') || t.includes('TRANSFORM')) return Code2;
  if (t.includes('IF') || t.includes('CONDITION') || t.includes('SWITCH')) return GitBranch;
  if (t.includes('LOOP')) return Repeat;
  if (t.includes('APPROVAL') || t.startsWith('HUMAN')) return UserCheck;
  if (t.includes('NOTE')) return StickyNote;
  if (t.includes('GROUP') || t.includes('STAGE')) return Folder;
  return Cpu;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  running: { label: 'Running', className: 'border-primary/30 bg-primary/10 text-primary' },
  success: { label: 'Done', className: 'border-success/30 bg-success/10 text-success' },
  failed: { label: 'Failed', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  waiting: { label: 'Waiting', className: 'border-warning/30 bg-warning/10 text-warning' },
};

/** Status chip for a node's last run, or null while it's idle / never ran. */
export function getStatusBadge(status: unknown) {
  return typeof status === 'string' ? STATUS_BADGE[status] ?? null : null;
}

const HANDLE_LABELS: Record<string, string> = {
  true: 'True branch',
  false: 'False branch',
  ...Object.fromEntries(AGENT_SLOTS.map((slot) => [slot.id, `${slot.label} slot`])),
};

const CATEGORY_LABELS: Record<string, string> = {
  triggers: 'Trigger',
  ai: 'AI',
  tools: 'Tool',
  logic: 'Logic',
  transform: 'Data',
  human: 'Human',
  output: 'Output',
};

/** Short "what kind of step" label, e.g. Trigger / AI / Human. */
function kindLabel(type: string | undefined) {
  const t = (type || '').toUpperCase();
  const category = CATALOG_NODES.find((n) => n.type === t)?.category;
  if (category && CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  if (t === 'START' || t.startsWith('TRIGGER')) return 'Trigger';
  if (t === 'END' || t === 'OUTPUT') return 'Output';
  if (t.includes('AGENT') || t.startsWith('AI_') || t.includes('LLM')) return 'AI';
  if (t.includes('APPROVAL') || t.startsWith('HUMAN')) return 'Human';
  if (t.startsWith('KB_') || t.includes('VECTOR') || t.includes('RETRIEVAL') || t.includes('KNOWLEDGE')) return 'Knowledge';
  if (t.startsWith('FIRECRAWL') || t.includes('TOOL') || t.includes('MCP') || t.includes('HTTP')) return 'Tool';
  if (t.includes('IF') || t.includes('CONDITION') || t.includes('LOOP')) return 'Logic';
  return 'Step';
}

function nodeLabel(node: Node | undefined) {
  return String(node?.data?.label || node?.id || 'Unknown step');
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md border border-border bg-surface-raised px-1.5 text-[11px] font-semibold text-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionHeader({ title, hint, aside }: { title: string; hint: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="flex items-center gap-2">
        {aside}
        <span title={hint} aria-label={hint} className="text-muted-foreground">
          <Info className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

function NodeOption({ node }: { node: Node }) {
  const Icon = getNodeIcon(node.type);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{nodeLabel(node)}</span>
    </span>
  );
}

/**
 * One wired connection: a status/handle chip on a tree branch, then a picker to
 * re-point the connection at another step (or remove it).
 */
function WireRow({
  badge,
  value,
  candidates,
  onChange,
  onRemove,
  disabled,
}: {
  badge: { label: string; className?: string } | null;
  value: string;
  candidates: Node[];
  onChange: (nodeId: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative pl-6">
      {/* tree branch: dot on the rail, elbow into the picker */}
      <span className="absolute left-0.5 top-1.5 size-2 rounded-full border border-muted-foreground/60 bg-surface" />
      <span className="absolute left-[6px] top-3.5 h-[calc(100%-1.75rem)] w-3 rounded-bl-md border-b border-l border-muted-foreground/40" />
      {badge ? <Chip className={cn('mb-1.5', badge.className)}>{badge.label}</Chip> : <div className="h-1" />}
      <div className="flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full border border-muted-foreground/60 bg-surface" />
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="h-8 min-w-0 flex-1 rounded-lg bg-surface-raised text-[13px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                <NodeOption node={n} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove connection"
            title="Remove connection"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddWire({
  placeholder,
  candidates,
  onAdd,
}: {
  placeholder: string;
  candidates: Node[];
  onAdd: (nodeId: string) => void;
}) {
  if (candidates.length === 0) return null;
  return (
    // value="" + a fresh key after each pick resets the trigger back to the placeholder
    <Select value="" onValueChange={onAdd}>
      <SelectTrigger className="ml-6 h-8 w-[calc(100%-1.5rem)] rounded-lg border-dashed bg-transparent text-xs text-muted-foreground">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {candidates.map((n) => (
          <SelectItem key={n.id} value={n.id}>
            <NodeOption node={n} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface NodeWiringPanelProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  readOnly?: boolean;
  onRewireEdge: (edgeId: string, patch: Partial<Pick<Edge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>>) => void;
  onDeleteEdge: (edgeId: string) => void;
  onConnect: (connection: Connection) => void;
  onUpdateConfig: (key: string, value: unknown) => void;
}

/**
 * The inspector's Wiring tab: what feeds this step, what it feeds, and (for agents)
 * which tools are attached. Every row edits the real canvas edges, so the graph
 * and this panel never disagree.
 */
export function NodeWiringPanel({
  node,
  nodes,
  edges,
  readOnly,
  onRewireEdge,
  onDeleteEdge,
  onConnect,
  onUpdateConfig,
}: NodeWiringPanelProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const others = nodes.filter((n) => n.id !== node.id);
  const inputs = edges.filter((e) => e.target === node.id);
  const outputs = edges.filter((e) => e.source === node.id);
  const nodeType = (node.type || '').toUpperCase();
  const isAgent = nodeType.includes('AGENT') || nodeType.startsWith('AI_') || nodeType.includes('LLM');
  const tools = (((node.data as any)?.config?.tools as string[]) || []).filter(Boolean);

  const badgeFor = (edge: Edge, other: Node | undefined) => {
    const handle = edge.sourceHandle ? HANDLE_LABELS[edge.sourceHandle] : undefined;
    if (handle) return { label: handle };
    const status = getStatusBadge(other?.data?.status);
    if (status) return status;
    return { label: kindLabel(other?.type) };
  };

  const unwiredInputs = others.filter((n) => !inputs.some((e) => e.source === n.id));
  const unwiredOutputs = others.filter((n) => !outputs.some((e) => e.target === n.id));

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionHeader
          title="Inputs"
          hint="Steps that run before this one and pass it their output"
          aside={inputs.length === 0 ? <Chip>Nothing wired</Chip> : null}
        />
        <div className="space-y-2">
          {inputs.map((edge) => (
            <WireRow
              key={edge.id}
              badge={badgeFor(edge, byId.get(edge.source))}
              value={edge.source}
              candidates={others}
              disabled={readOnly}
              onChange={(source) => onRewireEdge(edge.id, { source, sourceHandle: null })}
              onRemove={() => onDeleteEdge(edge.id)}
            />
          ))}
          {!readOnly && (
            <AddWire
              key={`in-${inputs.length}`}
              placeholder="Add an input…"
              candidates={unwiredInputs}
              onAdd={(source) => onConnect({ source, target: node.id, sourceHandle: null, targetHandle: null })}
            />
          )}
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionHeader
          title="Outputs"
          hint="Steps that run after this one"
          aside={outputs.length === 0 ? <Chip>Nothing wired</Chip> : null}
        />
        <div className="space-y-2">
          {outputs.map((edge) => (
            <WireRow
              key={edge.id}
              badge={badgeFor(edge, byId.get(edge.target))}
              value={edge.target}
              candidates={others}
              disabled={readOnly}
              onChange={(target) => onRewireEdge(edge.id, { target, targetHandle: null })}
              onRemove={() => onDeleteEdge(edge.id)}
            />
          ))}
          {!readOnly && (
            <AddWire
              key={`out-${outputs.length}`}
              placeholder="Add an output…"
              candidates={unwiredOutputs}
              onAdd={(target) => onConnect({ source: node.id, target, sourceHandle: null, targetHandle: null })}
            />
          )}
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionHeader
          title="Attachments"
          hint={isAgent ? 'Tools this agent may call while it runs' : 'Only agent steps take tool attachments'}
          aside={tools.length === 0 ? <Chip>Nothing wired</Chip> : null}
        />
        {isAgent && (
          <div className="flex flex-wrap gap-1.5">
            {AGENT_TOOLS.map((tool) => {
              const attached = tools.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={attached}
                  onClick={() =>
                    onUpdateConfig('tools', attached ? tools.filter((t) => t !== tool.id) : [...tools, tool.id])
                  }
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                    attached
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    readOnly && 'pointer-events-none opacity-60',
                  )}
                >
                  <Wrench className="size-3" />
                  {tool.name}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
