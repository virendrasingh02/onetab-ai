import {
  AGENT_KINDS,
  AGENT_STEP_KINDS,
  describeTriggerShort,
  uniqueStepId,
  type AgentBlueprint,
  type AgentBlueprintParam,
  type AgentBlueprintStep,
  type AgentClarification,
  type AgentKind,
  type AgentStepKind,
  type PlanUnderstanding,
  type StudioCatalog,
} from '@org/types';
import {
  AppSelect,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  Input,
  SegmentedControl,
  Switch,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';
import { AlertTriangle, CircleHelp, Info, Plus, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { STEP_KIND_ICON } from '../studio-meta.js';
import { PermissionPanel } from './PermissionPanel.js';
import { ChannelPicker, DocPicker, ProjectPicker } from './pickers.js';
import { SchedulePanel } from './SchedulePanel.js';
import { StepEditor } from './StepEditor.js';

export interface PlanEditorProps {
  workspaceId: string | undefined;
  value: AgentBlueprint;
  onChange: (next: AgentBlueprint) => void;
  catalog: StudioCatalog | undefined;
  /** What the planner understood, shown above a fresh plan. */
  understanding?: PlanUnderstanding;
  /** Why the plan can't be edited here (e.g. the viewer does not own it). */
  readOnlyReason?: string;
}

const NEW_STEP: Record<AgentStepKind, Partial<AgentBlueprintStep>> = {
  collect: { title: 'Gather data', tool: 'find_tasks', input: { assignee: 'me', status: 'open' } },
  analyze: { title: 'Analyse', prompt: '' },
  generate: { title: 'Write the result', prompt: '' },
  action: { title: 'Take action', tool: 'create_doc', input: { title: '', content: '' } },
  approval: { title: 'Ask for approval' },
  notify: { title: 'Notify me', tool: 'notify_user', input: { title: '', body: '' } },
  condition: { title: 'Only continue when…', condition: '' },
  delegate: { title: 'Hand off to an agent', prompt: '' },
};

/**
 * The plan an agent carries, laid out to be read top to bottom and edited in
 * place: what it is for, when it runs, the steps (with why each is there),
 * where the result goes, what it may touch, and who hears about it.
 */
export function PlanEditor({ workspaceId, value, onChange, catalog, understanding, readOnlyReason }: PlanEditorProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const readOnly = Boolean(readOnlyReason);
  const set = (patch: Partial<AgentBlueprint>) => onChange({ ...value, ...patch });
  const setStep = (index: number, step: AgentBlueprintStep) => set({ steps: value.steps.map((s, i) => (i === index ? step : s)) });
  const moveStep = (index: number, delta: -1 | 1) => {
    const steps = [...value.steps];
    const [moved] = steps.splice(index, 1);
    steps.splice(index + delta, 0, moved!);
    set({ steps });
  };
  const removeStep = (index: number) => {
    const removed = value.steps[index]!;
    set({
      steps: value.steps.filter((_, i) => i !== index).map((s) => (s.uses ? { ...s, uses: s.uses.filter((u) => u !== removed.id) } : s)),
      output: value.output.fromStep === removed.id ? { ...value.output, fromStep: undefined } : value.output,
    });
  };
  const addStep = (kind: AgentStepKind) => {
    const template = NEW_STEP[kind];
    const id = uniqueStepId(template.title ?? kind, value.steps.map((s) => s.id));
    const step = { id, kind, title: template.title ?? kind, ...template } as AgentBlueprintStep;
    set({ steps: [...value.steps, step] });
    setExpanded(id);
  };

  return (
    <div className="space-y-4">
      {readOnlyReason ? (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-surface-inset p-3 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden /> {readOnlyReason}
        </p>
      ) : null}

      {understanding || value.source.fallbackReason || value.warnings.length || value.assumptions.length ? (
        <Understanding blueprint={value} understanding={understanding} />
      ) : null}

      <Section title="Agent">
        <fieldset disabled={readOnly} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <Field label="Name">
              <Input value={value.name} onChange={(e) => set({ name: e.target.value })} className="text-base font-semibold" />
            </Field>
            <Field label="Type">
              <AppSelect
                value={value.kind}
                onValueChange={(v) => set({ kind: v as AgentKind })}
                options={(Object.keys(AGENT_KINDS) as AgentKind[]).map((k) => ({ value: k, label: AGENT_KINDS[k].label, description: AGENT_KINDS[k].description }))}
              />
            </Field>
          </div>
          <Field label="Objective" hint="One sentence: what this agent achieves.">
            <Textarea rows={2} value={value.objective} onChange={(e) => set({ objective: e.target.value })} />
          </Field>
          <Field label="Writing guidance" optional hint="Tone, format or audience every writing step follows.">
            <Textarea rows={2} value={value.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value || undefined })} />
          </Field>
        </fieldset>
      </Section>

      {value.questions.length ? (
        <Section title="Needs your input" icon={<CircleHelp className="size-4 text-warning" aria-hidden />} tone="warning">
          <fieldset disabled={readOnly} className="space-y-3">
            {value.questions.map((q) => (
              <QuestionField key={q.id} workspaceId={workspaceId} question={q} blueprint={value} onChange={onChange} />
            ))}
          </fieldset>
        </Section>
      ) : null}

      <Section title="When it runs" description={describeTriggerShort(value.trigger)}>
        <fieldset disabled={readOnly}>
          <SchedulePanel workspaceId={workspaceId} trigger={value.trigger} onChange={(trigger) => set({ trigger, questions: resolveQuestions(value.questions, { ...value, trigger }) })} />
        </fieldset>
      </Section>

      <Section
        title={`Plan · ${value.steps.length} step${value.steps.length === 1 ? '' : 's'}`}
        description="Steps run top to bottom. Open a step to change what it does."
        actions={
          readOnly ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" leadingIcon={<Plus />}>
                  Add step
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {(Object.keys(AGENT_STEP_KINDS) as AgentStepKind[]).map((kind) => {
                  const Icon = STEP_KIND_ICON[kind];
                  return (
                    <DropdownMenuItem key={kind} onSelect={() => addStep(kind)}>
                      <Icon className="size-4" aria-hidden />
                      <div className="flex flex-col">
                        <span>{AGENT_STEP_KINDS[kind].label}</span>
                        <span className="text-xs text-muted-foreground">{AGENT_STEP_KINDS[kind].description}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      >
        {value.steps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No steps yet. Add one to start — gather data first, then write, then act.
          </p>
        ) : (
          <ol className="space-y-2">
            {value.steps.map((step, index) => (
              <StepEditor
                key={step.id}
                workspaceId={workspaceId}
                blueprint={value}
                step={step}
                index={index}
                catalog={catalog}
                expanded={expanded === step.id}
                onToggle={() => setExpanded((cur) => (cur === step.id ? null : step.id))}
                onChange={(next) => setStep(index, next)}
                onMove={(delta) => moveStep(index, delta)}
                onRemove={() => removeStep(index)}
                readOnly={readOnly}
              />
            ))}
          </ol>
        )}
      </Section>

      {value.params.some((p) => !value.questions.some((q) => q.paramKey === p.key)) ? (
        <Section title="Settings" description="Choices the steps use as {{params.…}}.">
          <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-2">
            {value.params
              .filter((p) => !value.questions.some((q) => q.paramKey === p.key))
              .map((param) => (
                <ParamField key={param.key} workspaceId={workspaceId} param={param} onChange={(v) => onChange(withParam(value, param.key, v))} />
              ))}
          </fieldset>
        </Section>
      ) : null}

      <Section title="Result">
        <fieldset disabled={readOnly} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="What it produces">
              <AppSelect
                value={value.output.format}
                onValueChange={(v) => set({ output: { ...value.output, format: v as AgentBlueprint['output']['format'] } })}
                options={[
                  { value: 'report', label: 'A report' },
                  { value: 'todo_list', label: 'A to-do list' },
                  { value: 'summary', label: 'A summary' },
                  { value: 'answer', label: 'An answer' },
                  { value: 'draft', label: 'A draft' },
                  { value: 'tasks', label: 'Tasks' },
                  { value: 'alert', label: 'An alert' },
                ]}
              />
            </Field>
            <Field label="The answer is" hint="Which step’s result the run shows as its result.">
              <AppSelect
                value={value.output.fromStep ?? '__last__'}
                onValueChange={(v) => set({ output: { ...value.output, fromStep: v === '__last__' ? undefined : v } })}
                options={[
                  { value: '__last__', label: 'The last writing step' },
                  ...value.steps.filter((s) => s.kind !== 'approval' && s.kind !== 'condition').map((s) => ({ value: s.id, label: s.title })),
                ]}
              />
            </Field>
          </div>
          <Field label="Where it goes" hint="Always kept with the run. Saving or posting it is a step in the plan.">
            <SegmentedControl
              aria-label="Where the result goes"
              size="sm"
              options={[
                { value: 'run', label: 'In the run' },
                { value: 'doc', label: 'A doc' },
                { value: 'channel', label: 'A channel' },
                { value: 'notification', label: 'Notify me' },
              ]}
              value={value.output.destination}
              onChange={(destination) => {
                const next = { ...value, output: { ...value.output, destination } };
                onChange({ ...next, questions: resolveQuestions(value.questions, next, destination === 'channel' && !value.output.channelSlug) });
              }}
            />
          </Field>
          {value.output.destination === 'channel' ? (
            <Field label="Channel">
              <ChannelPicker
                workspaceId={workspaceId}
                by="slug"
                value={value.output.channelSlug}
                onChange={(channelSlug) => {
                  const next = { ...value, output: { ...value.output, channelSlug } };
                  onChange({ ...next, questions: resolveQuestions(value.questions, next) });
                }}
              />
            </Field>
          ) : null}
        </fieldset>
      </Section>

      <Section title="Permissions" description="What this agent may read and change. It acts as you, and only sees what you can see.">
        <fieldset disabled={readOnly}>
          <PermissionPanel blueprint={value} catalog={catalog} onChange={(scopes) => set({ scopes })} />
        </fieldset>
      </Section>

      <Section title="Notifications" description="Only for runs nobody was watching — a schedule or an event.">
        <fieldset disabled={readOnly} className="space-y-2">
          <ToggleRow label="When it needs my approval" checked={value.notify.onApproval} onChange={(v) => set({ notify: { ...value.notify, onApproval: v } })} />
          <ToggleRow label="When it fails" checked={value.notify.onFailure} onChange={(v) => set({ notify: { ...value.notify, onFailure: v } })} />
          <ToggleRow label="When it finishes" checked={value.notify.onComplete} onChange={(v) => set({ notify: { ...value.notify, onComplete: v } })} />
        </fieldset>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  actions,
  icon,
  tone,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  tone?: 'warning';
  children: ReactNode;
}) {
  return (
    <Card className={cn('space-y-3 p-4', tone === 'warning' && 'border-warning/40 bg-warning/5')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon}
            {title}
          </h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-foreground">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Understanding({ blueprint, understanding }: { blueprint: AgentBlueprint; understanding?: PlanUnderstanding }) {
  const fromTemplate = blueprint.source.kind === 'template';
  // "Runs" already says when; don't repeat the schedule as an assumption.
  const assumptions = blueprint.assumptions.filter((a) => a.replace(/\.$/, '') !== understanding?.runsWhen);
  return (
    <Card className="space-y-3 border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-1 text-sm">
          {understanding ? (
            <>
              <p className="font-semibold text-foreground">What I understood</p>
              <p className="text-foreground">{understanding.summary}</p>
              <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-[auto_1fr]">
                <dt className="font-medium text-foreground">Runs</dt>
                <dd>{understanding.runsWhen}</dd>
                <dt className="font-medium text-foreground">Uses</dt>
                <dd>{understanding.uses.join(', ') || '—'}</dd>
                <dt className="font-medium text-foreground">Produces</dt>
                <dd>{understanding.produces}</dd>
              </dl>
            </>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {fromTemplate
              ? blueprint.source.fallbackReason
                ? `Started from a template because AI planning was unavailable (${blueprint.source.fallbackReason}). Check each step before you save.`
                : 'Started from a template.'
              : blueprint.source.kind === 'ai'
                ? `Planned by AI${blueprint.source.model ? ` (${blueprint.source.model})` : ''} from the tools this workspace really has.`
                : null}
          </p>
        </div>
      </div>
      {assumptions.length ? (
        <ul className="space-y-0.5 pl-6 text-xs text-muted-foreground">
          {assumptions.map((a) => (
            <li key={a} className="list-disc">{a}</li>
          ))}
        </ul>
      ) : null}
      {blueprint.warnings.length ? (
        <div role="alert" className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
          {blueprint.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-xs text-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              {w}
            </p>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function withParam(bp: AgentBlueprint, key: string, value: string): AgentBlueprint {
  const next = { ...bp, params: bp.params.map((p) => (p.key === key ? { ...p, value } : p)) };
  return { ...next, questions: resolveQuestions(bp.questions, next) };
}

/** Drops questions the plan now answers; adds the channel question when a channel destination has none. */
function resolveQuestions(questions: AgentClarification[], bp: AgentBlueprint, askChannel = false): AgentClarification[] {
  const open = questions.filter((q) => {
    if (q.paramKey) return !bp.params.find((p) => p.key === q.paramKey)?.value;
    if (q.field === 'output.channelSlug') return bp.output.destination === 'channel' && !bp.output.channelSlug;
    if (q.field === 'trigger.filter.channelId') return bp.trigger.kind === 'event' && bp.trigger.event === 'channel.message' && !bp.trigger.filter?.channelId;
    if (q.field === 'trigger.filter.projectId') return !bp.trigger.filter?.projectId;
    return true;
  });
  if (bp.trigger.kind === 'event' && bp.trigger.event === 'channel.message' && !bp.trigger.filter?.channelId && !open.some((q) => q.field === 'trigger.filter.channelId')) {
    open.push({ id: 'watch_channel', question: 'Which channel should it watch?', field: 'trigger.filter.channelId' });
  }
  if (askChannel && !open.some((q) => q.field === 'output.channelSlug')) {
    open.push({ id: 'post_channel', question: 'Which channel should it post to?', field: 'output.channelSlug' });
  }
  return open;
}

function QuestionField({
  workspaceId,
  question,
  blueprint,
  onChange,
}: {
  workspaceId: string | undefined;
  question: AgentClarification;
  blueprint: AgentBlueprint;
  onChange: (next: AgentBlueprint) => void;
}) {
  if (question.paramKey) {
    const param = blueprint.params.find((p) => p.key === question.paramKey);
    if (!param) return null;
    return <ParamField workspaceId={workspaceId} param={param} label={question.question} onChange={(v) => onChange(withParam(blueprint, param.key, v))} />;
  }
  if (question.field === 'trigger.filter.channelId') {
    return (
      <Field label={question.question}>
        <ChannelPicker
          workspaceId={workspaceId}
          value={blueprint.trigger.filter?.channelId}
          onChange={(channelId) => {
            const next = { ...blueprint, trigger: { ...blueprint.trigger, filter: { ...blueprint.trigger.filter, channelId } } };
            onChange({ ...next, questions: resolveQuestions(blueprint.questions, next) });
          }}
        />
      </Field>
    );
  }
  if (question.field === 'output.channelSlug') {
    return (
      <Field label={question.question}>
        <ChannelPicker
          workspaceId={workspaceId}
          by="slug"
          value={blueprint.output.channelSlug}
          onChange={(channelSlug) => {
            const next = { ...blueprint, output: { ...blueprint.output, channelSlug } };
            onChange({ ...next, questions: resolveQuestions(blueprint.questions, next) });
          }}
        />
      </Field>
    );
  }
  return <p className="text-sm text-foreground">{question.question}</p>;
}

function ParamField({
  workspaceId,
  param,
  label,
  onChange,
}: {
  workspaceId: string | undefined;
  param: AgentBlueprintParam;
  label?: string;
  onChange: (value: string) => void;
}) {
  const common = { workspaceId, value: param.value, onChange, 'aria-label': label ?? param.label };
  return (
    <Field label={label ?? param.label} required={param.required} optional={!param.required && !label} hint={param.hint}>
      {param.type === 'project' ? (
        <ProjectPicker {...common} allowNone={param.required ? undefined : 'Every active project'} />
      ) : param.type === 'channel' ? (
        <ChannelPicker {...common} />
      ) : param.type === 'doc' ? (
        <DocPicker {...common} />
      ) : (
        <Input value={param.value ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}
