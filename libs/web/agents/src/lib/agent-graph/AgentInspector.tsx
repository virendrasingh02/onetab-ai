/**
 * The right rail. Three views over the same graph:
 *
 *  - **Node** — the selected node's fields, rendered from its spec.
 *  - **Agent** — the whole draft flattened into the record that would be saved.
 *  - **Issues** — what the validator found, each row focusing its node.
 *
 * None of it holds state: every edit goes straight back to `useAgentGraph`.
 */

import {
  Badge,
  Button,
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';
import type { Edge } from '@xyflow/react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Copy,
  MousePointerClick,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  CATEGORY_LABEL,
  accentFor,
  specFor,
  type FieldSpec,
  type NodeConfig,
} from './agent-graph-model.js';
import type { AgentFlowNode, AgentSummary, GraphIssue } from './use-agent-graph.js';
import { HANDLE } from './use-agent-graph.js';

export interface AgentInspectorProps {
  nodes: AgentFlowNode[];
  edges: Edge[];
  selected: AgentFlowNode | null;
  issues: GraphIssue[];
  summary: AgentSummary;
  onFieldChange: (nodeId: string, fieldKey: string, value: unknown) => void;
  onSelect: (nodeId: string | null) => void;
  onDuplicate: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  className?: string;
}

export function AgentInspector({
  nodes,
  edges,
  selected,
  issues,
  summary,
  onFieldChange,
  onSelect,
  onDuplicate,
  onDelete,
  className,
}: AgentInspectorProps) {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;

  return (
    <div
      className={cn(
        'shadow-xs flex flex-col rounded-xl border bg-surface overflow-hidden',
        className,
      )}
    >
      <Tabs defaultValue="node" className="flex min-h-0 flex-1 flex-col">
        <div className="px-3 pt-3 pb-2 border-b">
          <TabsList className="w-full">
            <TabsTrigger value="node">Node</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="issues">
              Issues
              {issues.length > 0 ? (
                <Badge
                  variant={errorCount > 0 ? 'destructive' : 'warning'}
                  className="ml-1 text-[9px]"
                >
                  {issues.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="node" className="min-h-0">
          <NodeTab
            nodes={nodes}
            edges={edges}
            selected={selected}
            issues={issues}
            onFieldChange={onFieldChange}
            onSelect={onSelect}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </TabsContent>

        <TabsContent value="agent" className="min-h-0">
          <ScrollArea className="h-full">
            <AgentTab summary={summary} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="issues" className="min-h-0">
          <ScrollArea className="h-full">
            <IssuesTab issues={issues} onSelect={onSelect} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------ node tab ---- */

function NodeTab({
  nodes,
  edges,
  selected,
  issues,
  onFieldChange,
  onSelect,
  onDuplicate,
  onDelete,
}: Omit<AgentInspectorProps, 'summary' | 'className'>) {
  const connections = useMemo(() => {
    if (!selected) return { incoming: [], outgoing: [] };
    const label = (nodeId: string) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return nodeId;
      return node.data.kind === 'agent'
        ? String(node.data.config['name'] || 'Agent core')
        : specFor(node.data.kind).label;
    };

    return {
      incoming: edges
        .filter((edge) => edge.target === selected.id)
        .map((edge) => ({ id: edge.id, label: label(edge.source) })),
      outgoing: edges
        .filter((edge) => edge.source === selected.id)
        .map((edge) => ({
          id: edge.id,
          label: label(edge.target),
          capability: edge.sourceHandle === HANDLE.cap,
        })),
    };
  }, [edges, nodes, selected]);

  if (!selected) {
    return (
      <div className="px-5 py-10 flex flex-col items-center text-center">
        <span
          aria-hidden
          className="mb-3 size-10 flex items-center justify-center rounded-xl bg-muted text-muted-foreground"
        >
          <MousePointerClick className="size-5" />
        </span>
        <p className="text-xs font-medium text-foreground">No node selected</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a node on the canvas to edit what it does, or drag one in from the
          library.
        </p>
      </div>
    );
  }

  const spec = specFor(selected.data.kind);
  const accent = accentFor(selected.data.kind);
  const Icon = spec.icon;
  const nodeIssues = issues.filter((issue) => issue.nodeId === selected.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 py-3 gap-2.5 flex items-start border-b">
        <span
          aria-hidden
          className={cn(
            'size-8 flex shrink-0 items-center justify-center rounded-lg',
            accent.chip,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              accent.text,
            )}
          >
            {CATEGORY_LABEL[spec.category]}
          </p>
          <h3 className="text-sm font-semibold truncate text-foreground">
            {spec.label}
          </h3>
          <p className="text-[10px] font-mono truncate text-subtle">{selected.id}</p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-4 space-y-4">
          {nodeIssues.length > 0 ? (
            <ul className="space-y-1">
              {nodeIssues.map((issue) => (
                <li
                  key={issue.id}
                  className={cn(
                    'gap-1.5 px-2 py-1.5 flex items-start rounded-md text-[11px] leading-snug',
                    issue.severity === 'error'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-warning/10 text-warning',
                  )}
                >
                  <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Keyed by node as well as field: `NumberInput` keeps the in-progress
              text locally, and two nodes of the same kind share field keys — so
              without the node id the draft would follow the selection. */}
          {spec.fields.map((field) => (
            <FieldControl
              key={`${selected.id}-${field.key}`}
              field={field}
              config={selected.data.config}
              onChange={(value) => onFieldChange(selected.id, field.key, value)}
            />
          ))}

          <section className="pt-1 space-y-1.5">
            <h4 className="gap-1.5 flex items-center text-[11px] font-semibold text-foreground">
              <ArrowLeftRight className="size-3 text-muted-foreground" aria-hidden />
              Connections
            </h4>
            {connections.incoming.length === 0 &&
            connections.outgoing.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Not wired to anything yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {connections.incoming.map((edge) => (
                  <li
                    key={edge.id}
                    className="gap-1.5 px-2 py-1 flex items-center rounded-md text-[11px] bg-surface-inset text-muted-foreground"
                  >
                    <span className="text-subtle">in ←</span>
                    <span className="truncate text-foreground">{edge.label}</span>
                  </li>
                ))}
                {connections.outgoing.map((edge) => (
                  <li
                    key={edge.id}
                    className="gap-1.5 px-2 py-1 flex items-center rounded-md text-[11px] bg-surface-inset text-muted-foreground"
                  >
                    <span className="text-subtle">
                      {edge.capability ? 'feeds →' : 'out →'}
                    </span>
                    <span className="truncate text-foreground">{edge.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>

      <div className="px-4 py-3 gap-2 flex border-t">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={Boolean(spec.singleton)}
          leadingIcon={<Copy />}
          onClick={() => onDuplicate(selected.id)}
        >
          Duplicate
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          leadingIcon={<Trash2 />}
          onClick={() => {
            onDelete(selected.id);
            onSelect(null);
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- field control ---- */

interface FieldControlProps {
  field: FieldSpec;
  config: NodeConfig;
  onChange: (value: unknown) => void;
}

function FieldControl({ field, config, onChange }: FieldControlProps) {
  const id = useId();
  const hintId = field.hint ? `${id}-hint` : undefined;
  const value = config[field.key];

  const hint = field.hint ? (
    <p id={hintId} className="text-[10px] leading-snug text-muted-foreground">
      {field.hint}
    </p>
  ) : null;

  if (field.type === 'toggle') {
    return (
      <div className="gap-3 flex items-start justify-between">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-xs">
            {field.label}
          </Label>
          {hint}
        </div>
        <Switch
          id={id}
          checked={value === true}
          aria-describedby={hintId}
          onCheckedChange={onChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {field.label}
        {'required' in field && field.required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>

      {field.type === 'textarea' ? (
        <Textarea
          id={id}
          rows={field.rows ?? 4}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono leading-relaxed"
        />
      ) : null}

      {field.type === 'text' ? (
        <Input
          id={id}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value)}
          className={field.mono ? 'font-mono' : undefined}
        />
      ) : null}

      {field.type === 'number' ? (
        <NumberInput
          id={id}
          field={field}
          value={typeof value === 'number' ? value : 0}
          describedBy={hintId}
          onChange={onChange}
        />
      ) : null}

      {field.type === 'select' ? (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger id={id} aria-describedby={hintId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {hint}
    </div>
  );
}

/**
 * A number field that lets you finish typing.
 *
 * Driving `<input type="number">` straight off the coerced config value makes
 * the field unusable: clearing it snaps to 0, and "0." or "-" — both legal
 * halfway states — parse to something else and get written back under the
 * cursor. So the keystrokes live here as text, and only a value that actually
 * parses is pushed into the graph. Blur re-syncs, which discards a half-typed
 * entry rather than leaving the field disagreeing with the node.
 */
function NumberInput({
  id,
  field,
  value,
  describedBy,
  onChange,
}: {
  id: string;
  field: Extract<FieldSpec, { type: 'number' }>;
  value: number;
  describedBy?: string;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(() => String(value));

  return (
    <Input
      id={id}
      type="number"
      min={field.min}
      max={field.max}
      step={field.step}
      value={draft}
      aria-describedby={describedBy}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const parsed = Number(next);
        if (next.trim() !== '' && Number.isFinite(parsed)) onChange(parsed);
      }}
      onBlur={() => setDraft(String(value))}
      className="font-mono"
    />
  );
}

/* ----------------------------------------------------------- agent tab ---- */

function AgentTab({ summary }: { summary: AgentSummary }) {
  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{summary.name}</h3>
        <p className="text-xs text-muted-foreground">{summary.role}</p>
        <Badge variant="primary" className="mt-1.5 text-[9px] uppercase">
          {summary.autonomy}
        </Badge>
      </div>

      {summary.objective ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {summary.objective}
        </p>
      ) : null}

      <SummaryRow
        label="Model"
        values={
          summary.model ? [`${summary.provider ?? '—'} / ${summary.model}`] : []
        }
        empty="No model wired in"
      />
      <SummaryRow
        label="Instructions"
        values={
          summary.promptLength > 0 ? [`${summary.promptLength} characters`] : []
        }
        empty="No instructions node"
      />
      <SummaryRow
        label="Memory"
        values={summary.memory ? [summary.memory] : []}
        empty="Stateless"
      />
      <SummaryRow label="Tools" values={summary.tools} empty="No tools granted" />
      <SummaryRow
        label="Knowledge"
        values={summary.knowledge}
        empty="No retrieval sources"
      />
      <SummaryRow
        label="Guardrails"
        values={summary.guardrails}
        empty="No policies"
      />
      <SummaryRow label="Triggers" values={summary.triggers} empty="Manual only" />
      <SummaryRow label="Outputs" values={summary.outputs} empty="Delivers nowhere" />
    </div>
  );
}

function SummaryRow({
  label,
  values,
  empty,
}: {
  label: string;
  values: string[];
  empty: string;
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
        {label}
      </h4>
      {values.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">{empty}</p>
      ) : (
        <ul className="gap-1 flex flex-wrap">
          {values.map((entry, index) => (
            <li key={`${entry}-${index}`}>
              <Badge variant="neutral" className="font-mono text-[10px]">
                {entry}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- issues tab ---- */

function IssuesTab({
  issues,
  onSelect,
}: {
  issues: GraphIssue[];
  onSelect: (nodeId: string | null) => void;
}) {
  if (issues.length === 0) {
    return (
      <div className="px-5 py-10 flex flex-col items-center text-center">
        <span
          aria-hidden
          className="mb-3 size-10 flex items-center justify-center rounded-xl bg-accent-green-soft text-accent-green"
        >
          <CheckCircle2 className="size-5" />
        </span>
        <p className="text-xs font-medium text-foreground">The graph is valid</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Every required field is filled and the agent core is fully wired.
        </p>
      </div>
    );
  }

  return (
    <ul className="p-2 space-y-1">
      {issues.map((issue) => {
        const isError = issue.severity === 'error';
        const Icon = isError ? XCircle : AlertTriangle;

        return (
          <li key={issue.id}>
            <button
              type="button"
              disabled={!issue.nodeId}
              onClick={() => issue.nodeId && onSelect(issue.nodeId)}
              className={cn(
                'w-full gap-2 px-2 py-2 flex items-start rounded-lg text-left',
                'transition-colors duration-(--duration-fast)',
                'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                issue.nodeId ? 'hover:bg-selected' : 'cursor-default',
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  'mt-px size-3.5 shrink-0',
                  isError ? 'text-destructive' : 'text-warning',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] leading-snug text-foreground">
                  {issue.message}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-subtle">
                  {issue.severity}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
