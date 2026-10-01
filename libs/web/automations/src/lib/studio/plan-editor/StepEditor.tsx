import {
  AGENT_STEP_KINDS,
  PLATFORM_TOOLS,
  describeAgentScope,
  scopeForTool,
  stepResultKey,
  type AgentBlueprint,
  type AgentBlueprintStep,
  type AgentFailurePolicy,
  type AgentStepKind,
  type StudioCatalog,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Checkbox,
  copyToClipboard,
  Field,
  Hint,
  Input,
  Switch,
  Textarea,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useAgents } from '@org/web-agents';
import { ArrowDown, ArrowUp, Braces, ChevronDown, ChevronRight, ListChecks, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { APP_META, STEP_KIND_ICON } from '../studio-meta.js';

const TOOL_KINDS = new Set<AgentStepKind>(['collect', 'action', 'notify']);
const WRITING_KINDS = new Set<AgentStepKind>(['analyze', 'generate']);
const DATA_KINDS = new Set<AgentStepKind>(['collect', 'analyze', 'generate', 'delegate']);

interface ParamSchema {
  type?: string;
  enum?: string[];
  description?: string;
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** Tool choices, grouped by the part of the platform, then connected apps. */
function toolOptions(catalog: StudioCatalog | undefined, kind: AgentStepKind) {
  const wantsWrite = kind !== 'collect';
  const groups = new Map<string, Array<{ value: string; label: string; description?: string }>>();
  for (const tool of catalog?.tools ?? []) {
    if (kind === 'collect' && tool.access === 'write') continue;
    if (wantsWrite && tool.access === 'read') continue;
    const group = APP_META[tool.app]?.label ?? 'Other';
    groups.set(group, [...(groups.get(group) ?? []), { value: tool.name, label: tool.label, description: tool.description }]);
  }
  for (const app of catalog?.apps ?? []) {
    const actions = app.actions.filter((a) => (kind === 'collect' ? a.access === 'read' : a.access !== 'read'));
    if (actions.length) {
      groups.set(app.name, actions.map((a) => ({ value: a.tool, label: a.label, description: a.description })));
    }
  }
  return [...groups.entries()].map(([label, options]) => ({ label, options }));
}

export interface StepEditorProps {
  workspaceId: string | undefined;
  blueprint: AgentBlueprint;
  step: AgentBlueprintStep;
  index: number;
  catalog: StudioCatalog | undefined;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: AgentBlueprintStep) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

/** One step of the plan: a readable row, and — opened — everything about it, editable. */
export function StepEditor({
  workspaceId,
  blueprint,
  step,
  index,
  catalog,
  expanded,
  onToggle,
  onChange,
  onMove,
  onRemove,
  readOnly,
}: StepEditorProps) {
  const Icon = STEP_KIND_ICON[step.kind];
  const tool = step.tool ? catalog?.tools.find((t) => t.name === step.tool) : undefined;
  const appAction = step.tool ? catalog?.apps.flatMap((a) => a.actions).find((a) => a.tool === step.tool) : undefined;
  const toolLabel = tool?.label ?? appAction?.label ?? (step.tool ? PLATFORM_TOOLS[step.tool]?.label ?? step.tool : null);
  const scope = step.tool ? scopeForTool(step.tool, appAction?.access) : null;
  const panelId = `step-panel-${step.id}`;
  const earlier = blueprint.steps.slice(0, index);
  const set = (patch: Partial<AgentBlueprintStep>) => onChange({ ...step, ...patch });

  return (
    <li className={cn('rounded-xl border bg-surface transition-colors', expanded ? 'border-primary/40' : 'border-border')}>
      <div className="flex items-start gap-3 p-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-xs font-semibold tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <button
          type="button"
          className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
        >
          <span className="flex flex-wrap items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium text-foreground">{step.title}</span>
            {expanded ? <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
          </span>
          {step.why ? <span className="mt-0.5 block text-xs text-muted-foreground">{step.why}</span> : null}
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">{AGENT_STEP_KINDS[step.kind].label}</Badge>
            {toolLabel ? <Badge variant="neutral" className="text-[10px]">{toolLabel}</Badge> : null}
            {step.requiresApproval || step.kind === 'approval' ? (
              <Badge variant="warning" className="text-[10px]">
                <ShieldCheck className="size-3" aria-hidden /> Needs approval
              </Badge>
            ) : null}
            {step.onFailure === 'continue' ? <Badge variant="info" className="text-[10px]">Carries on if it fails</Badge> : null}
            {step.onFailure === 'retry' ? <Badge variant="info" className="text-[10px]">Retries</Badge> : null}
            {scope && !blueprint.scopes.includes(scope) ? (
              <Badge variant="destructive" className="text-[10px]">Missing permission: {describeAgentScope(scope).label}</Badge>
            ) : null}
          </span>
        </button>
        {!readOnly ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <Hint label="Move up">
              <Button variant="ghost" size="icon-xs" aria-label={`Move “${step.title}” up`} disabled={index === 0} onClick={() => onMove(-1)}>
                <ArrowUp />
              </Button>
            </Hint>
            <Hint label="Move down">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Move “${step.title}” down`}
                disabled={index === blueprint.steps.length - 1}
                onClick={() => onMove(1)}
              >
                <ArrowDown />
              </Button>
            </Hint>
            <Hint label="Remove step">
              <Button variant="ghost" size="icon-xs" aria-label={`Remove “${step.title}”`} onClick={onRemove}>
                <Trash2 />
              </Button>
            </Hint>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div id={panelId} className="space-y-3 border-t border-border p-3">
          <fieldset disabled={readOnly} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Step">
                <Input value={step.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Kind">
                <AppSelect
                  value={step.kind}
                  onValueChange={(v) => {
                    const kind = v as AgentStepKind;
                    onChange({
                      ...step,
                      kind,
                      ...(TOOL_KINDS.has(kind) ? {} : { tool: undefined, input: undefined, requiresApproval: undefined }),
                      ...(WRITING_KINDS.has(kind) ? { prompt: step.prompt ?? '' } : {}),
                    });
                  }}
                  options={(Object.keys(AGENT_STEP_KINDS) as AgentStepKind[]).map((k) => ({
                    value: k,
                    label: AGENT_STEP_KINDS[k].label,
                    description: AGENT_STEP_KINDS[k].description,
                  }))}
                />
              </Field>
            </div>
            <Field label="Why it’s in the plan" optional>
              <Input value={step.why ?? ''} onChange={(e) => set({ why: e.target.value })} placeholder="What this step contributes" />
            </Field>

            {TOOL_KINDS.has(step.kind) ? (
              <ToolFields workspaceId={workspaceId} step={step} earlier={earlier} blueprint={blueprint} catalog={catalog} onChange={onChange} />
            ) : null}

            {WRITING_KINDS.has(step.kind) ? (
              <>
                <Field
                  label={step.kind === 'analyze' ? 'What to work out' : 'What to write'}
                  hint="Earlier steps’ results are added automatically, with rules against making anything up."
                >
                  <Textarea rows={5} value={step.prompt ?? ''} onChange={(e) => set({ prompt: e.target.value })} />
                </Field>
                <UsesPicker step={step} earlier={earlier} onChange={(uses) => set({ uses: uses.length ? uses : undefined })} />
              </>
            ) : null}

            {step.kind === 'condition' ? (
              <Field
                label="Continue only when"
                hint={'A value and a comparison, e.g. triage.aiOutput contains "IMPORTANT", find.toolResult.count > 0, exists event.channelId.'}
              >
                <Input className="font-mono" value={step.condition ?? ''} onChange={(e) => set({ condition: e.target.value })} />
              </Field>
            ) : null}

            {step.kind === 'delegate' ? <DelegateFields workspaceId={workspaceId} step={step} onChange={onChange} /> : null}

            {step.kind === 'approval' ? (
              <p className="text-xs text-muted-foreground">
                The run pauses here and shows the latest draft. The approver can edit it before approving; the rest of the run uses their version.
              </p>
            ) : null}

            {step.kind !== 'approval' && step.kind !== 'condition' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="If it fails">
                  <AppSelect
                    value={step.onFailure ?? 'stop'}
                    onValueChange={(v) => set({ onFailure: v === 'stop' ? undefined : (v as AgentFailurePolicy) })}
                    options={[
                      { value: 'stop', label: 'Stop the run', description: 'Retries once for reads and writing, then stops' },
                      { value: 'retry', label: 'Retry a few times', description: 'Waits longer each time, then stops' },
                      { value: 'continue', label: 'Carry on without it', description: 'Later steps are told it failed' },
                    ]}
                  />
                </Field>
                {step.onFailure === 'retry' ? (
                  <Field label="Retries">
                    <Input type="number" min={0} max={5} value={step.retries ?? 2} onChange={(e) => set({ retries: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })} />
                  </Field>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        </div>
      ) : null}
    </li>
  );
}

function ToolFields({
  step,
  earlier,
  blueprint,
  catalog,
  onChange,
}: {
  workspaceId: string | undefined;
  step: AgentBlueprintStep;
  earlier: AgentBlueprintStep[];
  blueprint: AgentBlueprint;
  catalog: StudioCatalog | undefined;
  onChange: (next: AgentBlueprintStep) => void;
}) {
  const [asJson, setAsJson] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(step.input ?? {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const groups = useMemo(() => toolOptions(catalog, step.kind), [catalog, step.kind]);
  const tool = catalog?.tools.find((t) => t.name === step.tool);
  const appAction = catalog?.apps.flatMap((a) => a.actions).find((a) => a.tool === step.tool);
  const params: Array<[string, ParamSchema]> = tool
    ? Object.entries(tool.parameters as Record<string, ParamSchema>)
    : (appAction?.inputs ?? []).map((name) => [name, { type: 'string' }]);
  const input = step.input ?? {};
  const setInput = (key: string, value: unknown) => {
    const next = { ...input };
    if (value === '' || value === undefined) delete next[key];
    else next[key] = value;
    onChange({ ...step, input: next });
  };
  const refs = [
    ...earlier.filter((s) => DATA_KINDS.has(s.kind)).map((s) => `{{${s.id}.${stepResultKey(s)}}}`),
    '{{input.text}}',
    '{{now.date}}',
    ...blueprint.params.map((p) => `{{params.${p.key}}}`),
    ...(blueprint.trigger.kind === 'event' ? ['{{event}}'] : []),
  ];

  return (
    <div className="space-y-3">
      <Field label="Tool" hint={tool ? tool.description : appAction?.description}>
        <AppSelect
          value={step.tool}
          onValueChange={(v) => onChange({ ...step, tool: v, input: {} })}
          options={groups}
          searchable
          placeholder="Choose what this step uses"
        />
      </Field>
      {step.kind !== 'collect' ? (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <span className="text-sm">
            <span className="block font-medium text-foreground">Ask for approval first</span>
            <span className="block text-xs text-muted-foreground">The run pauses and shows the draft before this step acts.</span>
          </span>
          <Switch checked={!!step.requiresApproval} onCheckedChange={(checked) => onChange({ ...step, requiresApproval: checked || undefined })} />
        </label>
      ) : null}
      {step.tool ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Inputs</span>
            <Button
              variant="ghost"
              size="xs"
              leadingIcon={asJson ? <ListChecks /> : <Braces />}
              onClick={() => {
                if (!asJson) setJsonText(JSON.stringify(input, null, 2));
                setAsJson((v) => !v);
                setJsonError(null);
              }}
            >
              {asJson ? 'Edit as fields' : 'Edit as JSON'}
            </Button>
          </div>
          {asJson ? (
            <Field error={jsonError ?? undefined}>
              <Textarea
                rows={6}
                className="font-mono text-xs"
                value={jsonText}
                aria-label="Step input as JSON"
                onChange={(e) => {
                  setJsonText(e.target.value);
                  try {
                    const parsed = JSON.parse(e.target.value || '{}');
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Must be an object');
                    setJsonError(null);
                    onChange({ ...step, input: parsed });
                  } catch {
                    setJsonError('Not valid JSON yet — the last valid version is kept.');
                  }
                }}
              />
            </Field>
          ) : params.length === 0 ? (
            <p className="text-xs text-muted-foreground">This tool takes no inputs.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {params.map(([key, schema]) => {
                const optional = tool?.optional.includes(key) ?? false;
                const value = input[key];
                return (
                  <Field key={key} label={humanize(key)} optional={optional} hint={schema.description}>
                    {schema.type === 'boolean' ? (
                      <Switch checked={value === true || value === 'true'} onCheckedChange={(checked) => setInput(key, checked)} />
                    ) : schema.enum ? (
                      <AppSelect
                        value={typeof value === 'string' && value ? value : '__default__'}
                        onValueChange={(v) => setInput(key, v === '__default__' ? undefined : v)}
                        options={[{ value: '__default__', label: 'Default' }, ...schema.enum.map((e) => ({ value: e, label: e }))]}
                      />
                    ) : (
                      <Input
                        type={schema.type === 'number' ? 'number' : 'text'}
                        value={value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        onChange={(e) =>
                          setInput(key, schema.type === 'number' && e.target.value !== '' && !e.target.value.includes('{{') ? Number(e.target.value) : e.target.value)
                        }
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Values can use:{' '}
            {refs.map((ref) => (
              <button
                key={ref}
                type="button"
                className="mr-1 rounded bg-surface-raised px-1 font-mono text-[10px] text-foreground hover:bg-selected"
                onClick={() => void copyToClipboard(ref).then(() => toast.success(`Copied ${ref}`))}
              >
                {ref}
              </button>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function UsesPicker({
  step,
  earlier,
  onChange,
}: {
  step: AgentBlueprintStep;
  earlier: AgentBlueprintStep[];
  onChange: (uses: string[]) => void;
}) {
  const sources = earlier.filter((s) => DATA_KINDS.has(s.kind));
  if (sources.length === 0) return null;
  const chosen = new Set(step.uses ?? []);
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-muted-foreground">
        Reads from {chosen.size === 0 ? '— every earlier step (pick some to narrow it)' : ''}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {sources.map((s) => {
          const id = `uses-${step.id}-${s.id}`;
          return (
            <label key={s.id} htmlFor={id} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                id={id}
                checked={chosen.has(s.id)}
                onCheckedChange={(checked) => {
                  const next = new Set(chosen);
                  if (checked === true) next.add(s.id);
                  else next.delete(s.id);
                  onChange(sources.map((x) => x.id).filter((x) => next.has(x)));
                }}
              />
              {s.title}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function DelegateFields({
  workspaceId,
  step,
  onChange,
}: {
  workspaceId: string | undefined;
  step: AgentBlueprintStep;
  onChange: (next: AgentBlueprintStep) => void;
}) {
  const agents = useAgents(workspaceId);
  return (
    <div className="grid gap-3">
      <Field label="Hand off to" hint="An assistant agent with its own tools. It answers with what it did.">
        <AppSelect
          value={step.agentId}
          onValueChange={(v) => onChange({ ...step, agentId: v })}
          options={(agents.data ?? []).filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name, description: a.role }))}
          searchable
          loading={agents.isLoading}
          placeholder="Choose an agent"
          emptyText="No assistant agents yet."
        />
      </Field>
      <Field label="What to ask it">
        <Textarea rows={3} value={step.prompt ?? ''} onChange={(e) => onChange({ ...step, prompt: e.target.value })} />
      </Field>
    </div>
  );
}
