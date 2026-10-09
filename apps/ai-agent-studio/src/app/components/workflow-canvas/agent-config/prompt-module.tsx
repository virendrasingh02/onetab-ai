import {
  AppSelect,
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  Switch,
  Textarea,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  estimateTokens,
  jsonSchemaError,
  PROMPT_TONES,
  promptVariableDefaults,
  promptVariableRefs,
  resolvePromptVariables,
  RUNTIME_VARIABLE_ROOTS,
  type AgentPromptSettings,
  type PromptExample,
  type PromptOutputFormat,
  type PromptTone,
  type PromptVariable,
} from '@org/types';
import { ArrowDown, ArrowUp, Braces, CheckCircle2, ExternalLink, FileText, FlaskConical, GitCompare, History, Loader2, Play, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Edge, Node } from '@xyflow/react';
import { readAgentModules, type ModuleIssue } from './agent-module-model.js';
import {
  IssueList,
  LoadError,
  OutputBlock,
  SectionEmpty,
  SettingField,
  SettingSection,
  SettingSwitch,
  StatGrid,
  StringListEditor,
  fieldDomId,
  useSections,
} from './config-primitives.js';
import type { ModuleEditorProps } from './module-drawer.js';
import { runModelTest, type ModelTestResult } from './model-test.js';
import { ResultCard } from './result-card.js';
import { diffLines } from './text-diff.js';
import { findModel, useAgentVersionsWithGraphs, useAiModels, useModelOptions, usePromptTemplates, useWorkspaceId } from './use-agent-config-data.js';

const SNIPPETS: Array<{ label: string; text: string }> = [
  { label: 'Role', text: '## Role\nYou are …, helping … with ….\n' },
  { label: 'Scope', text: '## Scope\nYou handle: …\nYou don’t handle: … (say so and point to …).\n' },
  { label: 'Steps', text: '## Steps\n1. Understand the request.\n2. Look up what you need with your tools.\n3. Answer, citing where the facts came from.\n' },
  { label: 'Output format', text: '## Output format\nStart with a one-line answer, then the details as short bullet points.\n' },
  { label: 'If unsure', text: 'If you are not sure, say what you would need to know rather than guessing.\n' },
];

const FORMAT_OPTIONS: Array<{ value: PromptOutputFormat; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'text', label: 'Text' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
];

interface PromptTestCase {
  id: string;
  input: string;
  /** The reply must contain this (case-insensitive) to pass. */
  expect: string;
}

const issuesFor = (issues: ModuleIssue[], ...fields: string[]) => issues.filter((i) => i.field && fields.includes(i.field));
const errorFor = (issues: ModuleIssue[], field: string) => issues.find((i) => i.field === field && i.level === 'error')?.message ?? null;

const newId = () => Math.random().toString(36).slice(2, 9);

export function PromptModule({ view, agent, nodes, issues, readOnly, setConfig, actions, jumpTo, testSignal }: ModuleEditorProps) {
  const prompt = view.prompt;
  const s = prompt.settings;
  const agentCfg = ((agent.data as { config?: Record<string, unknown> } | undefined)?.config ?? {}) as Record<string, unknown>;
  const rules = (agentCfg['rules'] ?? {}) as { always?: string[]; askBefore?: string[]; never?: string[] };

  const setSettings = (patch: Partial<AgentPromptSettings>) => setConfig(view.agentId, { promptSettings: { ...s, ...patch } });
  const setText = (text: string) => setConfig(prompt.textNodeId, { [prompt.textKey]: text });
  const setRules = (patch: Partial<typeof rules>) => setConfig(view.agentId, { rules: { ...rules, ...patch } });

  const textRef = useRef<HTMLTextAreaElement>(null);
  const insertAtCursor = (snippet: string) => {
    const el = textRef.current;
    const current = prompt.text;
    if (!el) return setText(`${current}${current && !current.endsWith('\n') ? '\n' : ''}${snippet}`);
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const tokens = estimateTokens(prompt.composed);
  const refs = useMemo(() => promptVariableRefs(prompt.composed), [prompt.composed]);
  const undeclared = refs.filter((r) => !s.variables.some((v) => v.name === r) && !RUNTIME_VARIABLE_ROOTS.includes(r.split('.')[0]) && !nodes.some((n) => n.id === r.split('.')[0]));
  const textNodeLabel = prompt.fromPromptNode ? String((nodes.find((n) => n.id === prompt.textNodeId)?.data as { label?: string } | undefined)?.label ?? 'Prompt') : null;

  return (
    <>
      <SettingSection id="overview" title="Overview" description="What the agent is told on every turn, at a glance.">
        <StatGrid
          items={[
            { label: 'Tokens', value: `~${tokens.toLocaleString()}` },
            { label: 'Characters', value: prompt.composed.length.toLocaleString() },
            { label: 'Variables', value: refs.length },
            { label: 'Examples', value: `${s.examples.filter((e) => e.enabled).length} on` },
            { label: 'Output', value: FORMAT_OPTIONS.find((f) => f.value === s.output.format)?.label },
            { label: 'Stored on', value: textNodeLabel ? `“${textNodeLabel}” card` : 'This agent' },
          ]}
        />
        <IssueList issues={issues} onJump={jumpTo} empty="No problems found in this prompt." />
      </SettingSection>

      <SettingSection id="instructions" title="Instructions" description="Who the agent is and what it should do." issues={issuesFor(issues, 'instructions', 'objective')}>
        <SettingField field="role" label="Role" htmlFor="cfg-role" hint="A short job title — also how a supervisor sees this agent.">
          <Input id="cfg-role" inputSize="sm" value={prompt.role} disabled={readOnly} placeholder="e.g. Billing specialist" onChange={(e) => setConfig(view.agentId, { role: e.target.value })} />
        </SettingField>
        <SettingField field="objective" label="Objective" htmlFor="cfg-objective">
          <Textarea id="cfg-objective" minRows={2} maxRows={6} value={s.objective} disabled={readOnly} placeholder="The outcome this agent is responsible for" onChange={(e) => setSettings({ objective: e.target.value })} className="text-xs" />
        </SettingField>
        <SettingField field="persona" label="Persona" htmlFor="cfg-persona" hint="Optional: background or voice the agent speaks with.">
          <Textarea id="cfg-persona" minRows={1} maxRows={4} value={s.persona} disabled={readOnly} placeholder="e.g. A patient senior support engineer" onChange={(e) => setSettings({ persona: e.target.value })} className="text-xs" />
        </SettingField>
        <SettingField
          field="instructions"
          label="System instructions"
          htmlFor="cfg-instructions"
          error={errorFor(issues, 'instructions')}
          hint={
            textNodeLabel ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                Stored on the plugged-in “{textNodeLabel}” card — editing here edits that card.
                <button type="button" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline" onClick={() => actions.selectNode(prompt.textNodeId)}>
                  Open card <ExternalLink className="size-3" />
                </button>
              </span>
            ) : (
              'Markdown works. Use {{variables}} for values filled in at run time.'
            )
          }
          aside={
            <div className="flex items-center gap-0.5">
              <VariableInsert variables={s.variables} stepIds={nodes.filter((n) => n.id !== agent.id).map((n) => n.id)} disabled={readOnly} onInsert={(v) => insertAtCursor(`{{${v}}}`)} />
              <SnippetMenu disabled={readOnly} onInsert={insertAtCursor} />
            </div>
          }
        >
          <Textarea
            ref={textRef}
            id="cfg-instructions"
            minRows={8}
            maxRows={24}
            value={prompt.text}
            disabled={readOnly}
            invalid={Boolean(errorFor(issues, 'instructions'))}
            placeholder={'## Role\nYou are…\n\n## Scope\n…'}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-[11px] leading-relaxed"
          />
        </SettingField>
        <TemplatePicker disabled={readOnly} onUse={(text, mode) => setText(mode === 'replace' ? text : `${prompt.text}${prompt.text.trim() ? '\n\n' : ''}${text}`)} />
      </SettingSection>

      <SettingSection id="goals" title="Goals & rules" description="Each item becomes a bullet in the prompt." issues={issuesFor(issues, 'goals', 'constraints')}>
        <SettingField label="Goals">
          <StringListEditor field="goals" items={s.goals} onChange={(goals) => setSettings({ goals })} placeholder="Add a goal (Enter)" emptyText="No goals yet." />
        </SettingField>
        <SettingField label="Constraints">
          <StringListEditor field="constraints" items={s.constraints} onChange={(constraints) => setSettings({ constraints })} placeholder="Add a constraint" emptyText="No constraints yet." />
        </SettingField>
        <SettingField label="A good answer…" hint="Success criteria the agent checks its answer against.">
          <StringListEditor field="successCriteria" items={s.successCriteria} onChange={(successCriteria) => setSettings({ successCriteria })} placeholder="e.g. Includes the order number" />
        </SettingField>
      </SettingSection>

      <SettingSection
        id="variables"
        title="Variables"
        description="Values filled into {{placeholders}} when the agent runs: from the run’s input and earlier steps, else these defaults."
        issues={issuesFor(issues, 'variables')}
        actions={
          undeclared.length > 0 && !readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setSettings({ variables: [...s.variables, ...undeclared.map((name) => ({ name }))] })}
            >
              Add {undeclared.length} from prompt
            </Button>
          ) : undefined
        }
      >
        <VariablesEditor variables={s.variables} used={refs} readOnly={readOnly} onChange={(variables) => setSettings({ variables })} />
        <IssueList issues={issuesFor(issues, 'variables')} onJump={jumpTo} />
      </SettingSection>

      <SettingSection id="examples" title="Examples" description="Few-shot examples: replies to imitate, and replies to avoid." issues={issuesFor(issues, 'examples')}>
        <ExamplesEditor examples={s.examples} readOnly={readOnly} onChange={(examples) => setSettings({ examples })} />
      </SettingSection>

      <SettingSection id="output" title="Output" description="Enforced on every reply, not just suggested." issues={issuesFor(issues, 'output', 'tone')}>
        <SettingField field="output" label="Response format" error={errorFor(issues, 'output')}>
          <SegmentedControl
            aria-label="Response format"
            size="sm"
            options={FORMAT_OPTIONS}
            value={s.output.format}
            onChange={(format) => !readOnly && setSettings({ output: { ...s.output, format } })}
          />
        </SettingField>
        {s.output.format === 'json' && (
          <SettingField
            field="outputSchema"
            label="JSON Schema (optional)"
            htmlFor="cfg-schema"
            error={jsonSchemaError(s.output.schema)}
            hint="The reply must be a JSON object matching this schema."
            aside={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={readOnly || !s.output.schema.trim() || Boolean(jsonSchemaError(s.output.schema))}
                onClick={() => setSettings({ output: { ...s.output, schema: JSON.stringify(JSON.parse(s.output.schema), null, 2) } })}
              >
                Format
              </Button>
            }
          >
            <Textarea
              id="cfg-schema"
              minRows={5}
              maxRows={16}
              value={s.output.schema}
              disabled={readOnly}
              invalid={Boolean(jsonSchemaError(s.output.schema))}
              placeholder={'{\n  "type": "object",\n  "properties": { "answer": { "type": "string" } },\n  "required": ["answer"]\n}'}
              onChange={(e) => setSettings({ output: { ...s.output, schema: e.target.value } })}
              className="font-mono text-[11px]"
            />
          </SettingField>
        )}
        <SettingField field="tone" label="Tone" htmlFor="cfg-tone">
          <AppSelect
            id="cfg-tone"
            size="sm"
            value={s.tone}
            disabled={readOnly}
            options={PROMPT_TONES.map((t) => ({ value: t.value, label: t.label, description: t.instruction || 'No tone instruction' }))}
            onValueChange={(tone) => setSettings({ tone: tone as PromptTone })}
          />
        </SettingField>
      </SettingSection>

      <SettingSection id="reasoning" title="Reasoning" description="How the agent works through a request.">
        <SettingSwitch field="plan" label="Plan before acting" hint="Lists the steps and tools it needs first." checked={s.reasoning.plan} onChange={(plan) => setSettings({ reasoning: { ...s.reasoning, plan } })} />
        <SettingSwitch field="selfCheck" label="Check its own answer" hint="Reviews the answer against goals and constraints, then fixes it." checked={s.reasoning.selfCheck} onChange={(selfCheck) => setSettings({ reasoning: { ...s.reasoning, selfCheck } })} />
        <SettingSwitch field="askWhenUnclear" label="Ask when unclear" hint="Asks one clarifying question instead of guessing." checked={s.reasoning.askWhenUnclear} onChange={(askWhenUnclear) => setSettings({ reasoning: { ...s.reasoning, askWhenUnclear } })} />
      </SettingSection>

      <SettingSection id="guardrails" title="Guardrails" description="Safety rules. Owner rules on the agent always apply as well — a canvas can add rules, never remove them.">
        <SettingSwitch field="citeSources" label="Cite sources" hint="Names the document or tool behind each fact." checked={s.safety.citeSources} onChange={(citeSources) => setSettings({ safety: { ...s.safety, citeSources } })} />
        <SettingSwitch field="noFabrication" label="Don’t make things up" hint="Says “I don’t know” rather than inventing facts or links." checked={s.safety.noFabrication} onChange={(noFabrication) => setSettings({ safety: { ...s.safety, noFabrication } })} />
        <SettingSwitch field="protectPersonalData" label="Protect personal data" hint="Avoids repeating emails, phone and ID numbers." checked={s.safety.protectPersonalData} onChange={(protectPersonalData) => setSettings({ safety: { ...s.safety, protectPersonalData } })} />
        <SettingField field="escalation" label="Hand over to a person when…" htmlFor="cfg-escalation">
          <Textarea id="cfg-escalation" minRows={1} maxRows={4} value={s.safety.escalation} disabled={readOnly} placeholder="e.g. the customer asks for a refund over $500" onChange={(e) => setSettings({ safety: { ...s.safety, escalation: e.target.value } })} className="text-xs" />
        </SettingField>
        <SettingField label="Always">
          <StringListEditor field="rulesAlways" items={rules.always ?? []} onChange={(always) => setRules({ always })} placeholder="e.g. Reply in the customer’s language" />
        </SettingField>
        <SettingField label="Ask before">
          <StringListEditor field="rulesAskBefore" items={rules.askBefore ?? []} onChange={(askBefore) => setRules({ askBefore })} placeholder="e.g. Issuing a refund" />
        </SettingField>
        <SettingField label="Never">
          <StringListEditor field="rulesNever" items={rules.never ?? []} onChange={(never) => setRules({ never })} placeholder="e.g. Share internal pricing" />
        </SettingField>
      </SettingSection>

      <PromptTesting view={view} agentCfg={agentCfg} setConfig={setConfig} readOnly={readOnly} testSignal={testSignal} />
      <PromptVersions view={view} agent={agent} readOnly={readOnly} setConfig={setConfig} />
    </>
  );
}

/* ---------------------------------------------------------- variables -- */

function VariableInsert({ variables, stepIds, onInsert, disabled }: { variables: PromptVariable[]; stepIds: string[]; onInsert: (name: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const groups: Array<{ label: string; items: string[] }> = [
    { label: 'Declared', items: variables.map((v) => v.name) },
    { label: 'Run input', items: ['input.message', 'input.query', 'trigger.payload', '__last'] },
    { label: 'Earlier steps', items: stepIds.slice(0, 30).map((id) => `${id}.output`) },
  ];
  const f = filter.trim().toLowerCase();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="xs" disabled={disabled} aria-label="Insert a variable">
          <Braces className="size-3.5" />
          Variable
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <Input inputSize="sm" autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter variables" aria-label="Filter variables" className="mb-2 text-xs" />
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {groups.map((g) => {
            const items = g.items.filter((i) => !f || i.toLowerCase().includes(f));
            if (!items.length) return null;
            return (
              <div key={g.label}>
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                <div className="flex flex-wrap gap-1">
                  {items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        onInsert(item);
                        setOpen(false);
                      }}
                      className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      {`{{${item}}}`}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SnippetMenu({ onInsert, disabled }: { onInsert: (text: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="xs" disabled={disabled} aria-label="Insert a prompt block">
          <Plus className="size-3.5" />
          Block
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        {SNIPPETS.map((snip) => (
          <button
            key={snip.label}
            type="button"
            onClick={() => {
              onInsert(snip.text);
              setOpen(false);
            }}
            className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {snip.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function TemplatePicker({ onUse, disabled }: { onUse: (text: string, mode: 'replace' | 'append') => void; disabled?: boolean }) {
  const [wanted, setWanted] = useState(false);
  const templates = usePromptTemplates(wanted);
  const [selected, setSelected] = useState('');
  const chosen = templates.data?.find((t) => t.id === selected);
  if (!wanted) {
    return (
      <Button type="button" variant="outline" size="xs" disabled={disabled} onClick={() => setWanted(true)}>
        <FileText className="size-3.5" />
        Start from a template…
      </Button>
    );
  }
  if (templates.error) return <LoadError what="prompt templates" error={templates.error} onRetry={() => void templates.refetch()} />;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-raised/40 p-2.5">
      <AppSelect
        size="sm"
        searchable
        loading={templates.isLoading}
        placeholder="Choose a template"
        aria-label="Prompt template"
        value={selected}
        options={(templates.data ?? []).map((t) => ({ value: t.id, label: t.title, description: `${t.category}${t.isSystem ? ' · built-in' : ''}` }))}
        emptyText="No templates in this workspace yet"
        onValueChange={setSelected}
      />
      {chosen && <OutputBlock label="Preview">{chosen.promptText}</OutputBlock>}
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="xs" onClick={() => setWanted(false)}>
          Cancel
        </Button>
        <Button type="button" variant="outline" size="xs" disabled={!chosen} onClick={() => chosen && onUse(chosen.promptText, 'append')}>
          Append
        </Button>
        <Button type="button" size="xs" disabled={!chosen} onClick={() => chosen && onUse(chosen.promptText, 'replace')}>
          Replace
        </Button>
      </div>
    </div>
  );
}

function VariablesEditor({ variables, used, readOnly, onChange }: { variables: PromptVariable[]; used: string[]; readOnly: boolean; onChange: (v: PromptVariable[]) => void }) {
  const update = (i: number, patch: Partial<PromptVariable>) => onChange(variables.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div id={fieldDomId('variables')} className="space-y-2 scroll-mt-16">
      {variables.length === 0 ? (
        <SectionEmpty icon={Braces} title="No declared variables">
          Declare a variable to give it a default and a description.
        </SectionEmpty>
      ) : (
        variables.map((v, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border bg-surface-raised/40 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted-foreground">{'{{'}</span>
              <Input inputSize="sm" value={v.name} disabled={readOnly} aria-label="Variable name" placeholder="customer.name" invalid={!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(v.name)} onChange={(e) => update(i, { name: e.target.value.trim() })} className="font-mono text-[11px]" />
              <span className="font-mono text-[11px] text-muted-foreground">{'}}'}</span>
              {!used.includes(v.name) && <Badge variant="neutral" className="h-4 shrink-0 px-1 text-[9px]">unused</Badge>}
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${v.name}`} onClick={() => onChange(variables.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input inputSize="sm" value={v.defaultValue ?? ''} disabled={readOnly} aria-label={`Default for ${v.name}`} placeholder="Default value" onChange={(e) => update(i, { defaultValue: e.target.value || undefined })} className="text-xs" />
              <Input inputSize="sm" value={v.description ?? ''} disabled={readOnly} aria-label={`Description of ${v.name}`} placeholder="Description" onChange={(e) => update(i, { description: e.target.value || undefined })} className="text-xs" />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Switch checked={Boolean(v.required)} disabled={readOnly} onCheckedChange={(required) => update(i, { required: required || undefined })} aria-label={`${v.name} is required`} />
              Required
            </label>
          </div>
        ))
      )}
      {!readOnly && (
        <Button type="button" variant="outline" size="xs" onClick={() => onChange([...variables, { name: `variable_${variables.length + 1}` }])}>
          <Plus className="size-3.5" />
          Declare variable
        </Button>
      )}
    </div>
  );
}

function ExamplesEditor({ examples, readOnly, onChange }: { examples: PromptExample[]; readOnly: boolean; onChange: (e: PromptExample[]) => void }) {
  const update = (i: number, patch: Partial<PromptExample>) => onChange(examples.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...examples];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div id={fieldDomId('examples')} className="space-y-2 scroll-mt-16">
      {examples.length === 0 && (
        <SectionEmpty icon={FileText} title="No examples">
          One or two good examples often steer an agent better than more instructions.
        </SectionEmpty>
      )}
      {examples.map((ex, i) => (
        <div key={ex.id} className={cn('space-y-2 rounded-lg border p-2.5', ex.enabled ? 'border-border bg-surface-raised/40' : 'border-dashed border-border opacity-70')}>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-foreground">Example {i + 1}</span>
            <SegmentedControl
              aria-label={`Example ${i + 1} kind`}
              size="sm"
              options={[
                { value: 'positive', label: 'Imitate' },
                { value: 'negative', label: 'Avoid' },
              ]}
              value={ex.kind}
              onChange={(kind) => !readOnly && update(i, { kind: kind as PromptExample['kind'] })}
            />
            <span className="ml-auto flex items-center">
              <Switch checked={ex.enabled} disabled={readOnly} onCheckedChange={(enabled) => update(i, { enabled })} aria-label={`Use example ${i + 1}`} />
              {!readOnly && (
                <>
                  <Button type="button" variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" disabled={i === examples.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange(examples.filter((_, j) => j !== i))} aria-label={`Remove example ${i + 1}`}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </span>
          </div>
          <Textarea minRows={1} maxRows={6} value={ex.input} disabled={readOnly} aria-label={`Example ${i + 1} input`} placeholder="Input" invalid={ex.enabled && !ex.input.trim()} onChange={(e) => update(i, { input: e.target.value })} className="text-xs" />
          <Textarea minRows={2} maxRows={10} value={ex.output} disabled={readOnly} aria-label={`Example ${i + 1} reply`} placeholder={ex.kind === 'negative' ? 'A reply to avoid' : 'The ideal reply'} invalid={ex.enabled && !ex.output.trim()} onChange={(e) => update(i, { output: e.target.value })} className="text-xs" />
        </div>
      ))}
      {!readOnly && (
        <Button type="button" variant="outline" size="xs" onClick={() => onChange([...examples, { id: newId(), input: '', output: '', kind: 'positive', enabled: true }])}>
          <Plus className="size-3.5" />
          Add example
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ testing -- */

function PromptTesting({
  view,
  agentCfg,
  setConfig,
  readOnly,
  testSignal,
}: {
  view: ModuleEditorProps['view'];
  agentCfg: Record<string, unknown>;
  setConfig: ModuleEditorProps['setConfig'];
  readOnly: boolean;
  testSignal: number;
}) {
  const workspaceId = useWorkspaceId();
  const models = useAiModels();
  const { hidden } = useSections();
  const model = view.llm.resolved?.model ?? '';
  const [input, setInput] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [compareModel, setCompareModel] = useState('');
  const [results, setResults] = useState<ModelTestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const compareOptions = useModelOptions(compareModel);

  useEffect(() => {
    if (testSignal > 0) inputRef.current?.focus();
  }, [testSignal]);

  const refs = promptVariableRefs(view.prompt.composed);
  const defaults = promptVariableDefaults(view.prompt.settings);
  const resolved = resolvePromptVariables(view.prompt.composed, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')), defaults);

  const run = async () => {
    if (!model) {
      toast.error('Pick a model in the LLM module first');
      return;
    }
    setRunning(true);
    setResults(null);
    const targets = [model, ...(compareModel && compareModel !== model ? [compareModel] : [])];
    const out = await Promise.all(
      targets.map((m) =>
        runModelTest(
          workspaceId,
          { model: m, system: resolved.text, user: input || 'Hello! What can you help me with?', temperature: view.llm.temperature, maxTokens: view.llm.maxTokens },
          findModel(models.data, m),
        ),
      ),
    );
    setResults(out);
    setRunning(false);
  };

  // Regression cases are saved with the agent (`promptTests`) so anyone can re-run them.
  const cases: PromptTestCase[] = Array.isArray(agentCfg['promptTests']) ? (agentCfg['promptTests'] as PromptTestCase[]) : [];
  const setCases = (next: PromptTestCase[]) => setConfig(view.agentId, { promptTests: next.length ? next : undefined });
  const [caseResults, setCaseResults] = useState<Record<string, { pass: boolean; output: string; error?: string }>>({});
  const [runningCases, setRunningCases] = useState(false);
  const runCases = async () => {
    if (!model || cases.length === 0) return;
    setRunningCases(true);
    const entries = await Promise.all(
      cases.map(async (c) => {
        const r = await runModelTest(workspaceId, { model, system: resolved.text, user: c.input, temperature: view.llm.temperature, maxTokens: view.llm.maxTokens }, findModel(models.data, model));
        const pass = r.ok && (!c.expect.trim() || r.output.toLowerCase().includes(c.expect.trim().toLowerCase()));
        return [c.id, { pass, output: r.output, error: r.error }] as const;
      }),
    );
    setCaseResults(Object.fromEntries(entries));
    setRunningCases(false);
  };
  if (hidden.has('testing')) return null;

  return (
    <SettingSection id="testing" title="Testing" description="Runs the prompt for real on the agent’s model (counts toward AI usage). Tools and knowledge aren’t used here — test the whole agent from the run console.">
      {refs.length > 0 && (
        <SettingField label="Variable values for this test">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {refs.map((r) => (
              <Input key={r} inputSize="sm" value={values[r] ?? ''} placeholder={defaults[r] ? `${r} (default: ${defaults[r]})` : r} aria-label={`Value for ${r}`} onChange={(e) => setValues((v) => ({ ...v, [r]: e.target.value }))} className="font-mono text-[11px]" />
            ))}
          </div>
        </SettingField>
      )}
      <OutputBlock label={`Resolved prompt · ~${estimateTokens(resolved.text).toLocaleString()} tokens`}>{resolved.text || '(empty)'}</OutputBlock>
      {resolved.missing.length > 0 && <p className="text-[11px] text-warning">Left unfilled: {resolved.missing.map((m) => `{{${m}}}`).join(', ')}</p>}
      <SettingField field="testInput" label="Test message" htmlFor="cfg-test-input">
        <Textarea ref={inputRef} id="cfg-test-input" minRows={2} maxRows={8} value={input} placeholder="What a person would send the agent" onChange={(e) => setInput(e.target.value)} className="text-xs" />
      </SettingField>
      <SettingField label="Compare with another model (optional)">
        <AppSelect size="sm" searchable value={compareModel} placeholder="None" aria-label="Comparison model" loading={compareOptions.isLoading} options={[{ label: 'Compare', options: [{ value: '', label: 'None' }] }, ...compareOptions.groups]} onValueChange={setCompareModel} />
      </SettingField>
      <Button type="button" size="sm" onClick={() => void run()} disabled={running || !model}>
        {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        {running ? 'Running…' : model ? `Run on ${model}` : 'Pick a model first'}
      </Button>
      {results && (
        <div className={cn('grid gap-2', results.length > 1 && 'sm:grid-cols-2')}>
          {results.map((r) => (
            <ResultCard key={r.model} result={r} />
          ))}
        </div>
      )}

      <div className="space-y-2 border-t border-border/70 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-foreground">Regression cases</p>
          <div className="flex gap-1">
            {!readOnly && (
              <Button type="button" variant="outline" size="xs" onClick={() => setCases([...cases, { id: newId(), input: input || '', expect: '' }])}>
                <Plus className="size-3.5" />
                Add case
              </Button>
            )}
            <Button type="button" size="xs" onClick={() => void runCases()} disabled={runningCases || cases.length === 0 || !model}>
              {runningCases ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
              Run all
            </Button>
          </div>
        </div>
        {cases.length === 0 && <p className="text-[11px] text-muted-foreground">Save inputs with an expected phrase; re-run them after every prompt change. Saved with the agent.</p>}
        {cases.map((c, i) => {
          const res = caseResults[c.id];
          return (
            <div key={c.id} className="space-y-1.5 rounded-lg border border-border bg-surface-raised/40 p-2">
              <div className="flex items-center gap-1.5">
                {res ? res.pass ? <CheckCircle2 className="size-3.5 text-success" aria-label="Passed" /> : <XCircle className="size-3.5 text-destructive" aria-label="Failed" /> : <span className="size-3.5" />}
                <Input inputSize="sm" value={c.input} disabled={readOnly} placeholder="Input" aria-label={`Case ${i + 1} input`} onChange={(e) => setCases(cases.map((x) => (x.id === c.id ? { ...x, input: e.target.value } : x)))} className="text-xs" />
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove case ${i + 1}`} onClick={() => setCases(cases.filter((x) => x.id !== c.id))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <Input inputSize="sm" value={c.expect} disabled={readOnly} placeholder="Reply must contain… (optional)" aria-label={`Case ${i + 1} expected phrase`} onChange={(e) => setCases(cases.map((x) => (x.id === c.id ? { ...x, expect: e.target.value } : x)))} className="text-xs" />
              {res && (res.error ? <OutputBlock tone="error">{res.error}</OutputBlock> : <OutputBlock>{res.output}</OutputBlock>)}
            </div>
          );
        })}
      </div>
    </SettingSection>
  );
}

/* ----------------------------------------------------------- versions -- */

function PromptVersions({ view, agent, readOnly, setConfig }: Pick<ModuleEditorProps, 'view' | 'agent' | 'readOnly' | 'setConfig'>) {
  const { hidden, collapsed } = useSections();
  const visible = !hidden.has('versions') && !collapsed.has('versions');
  // Versions belong to the saved agent (the route's id); `view.agentId` is the node on its canvas.
  const { agentId: savedAgentId } = useParams<{ agentId: string }>();
  const versions = useAgentVersionsWithGraphs(savedAgentId, visible);
  const [comparing, setComparing] = useState<number | null>(null);

  const history = useMemo(
    () =>
      (versions.data ?? []).map((v) => {
        let prompt: { text: string; composed: string; settings: unknown; role: string } | null = null;
        try {
          const graph = v.graphJson ? (JSON.parse(v.graphJson) as { nodes?: Node[]; edges?: Edge[]; settings?: unknown }) : null;
          const versionAgent = graph?.nodes?.find((n) => n.id === agent.id);
          if (graph?.nodes && versionAgent) {
            const p = readAgentModules(versionAgent, graph.nodes, graph.edges ?? [], graph.settings).prompt;
            prompt = { text: p.text, composed: p.composed, settings: (versionAgent.data as { config?: Record<string, unknown> })?.config?.['promptSettings'], role: p.role };
          }
        } catch {
          prompt = null;
        }
        return { version: v, prompt };
      }),
    [versions.data, agent.id],
  );

  const current = history.find((h) => h.version.version === comparing);
  return (
    <SettingSection id="versions" title="Versions" description="This agent’s prompt in each saved version. Restoring puts it in the draft — Save to keep it.">
      {versions.isLoading && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin" />Loading versions…</p>}
      {versions.error && <LoadError what="versions" error={versions.error} onRetry={() => void versions.refetch()} />}
      {versions.data && history.length === 0 && <SectionEmpty icon={History} title="No saved versions yet">Save a version from the toolbar to start a history.</SectionEmpty>}
      <ul className="space-y-1.5">
        {history.map(({ version, prompt }) => {
          const same = prompt?.composed === view.prompt.composed;
          return (
            <li key={version.version} className="rounded-lg border border-border bg-surface-raised/40 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {version.versionTag ?? `v${version.version}`}
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{version.publishedAt ? new Date(version.publishedAt).toLocaleString() : ''}</span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{prompt ? (same ? 'Same as now' : version.changeSummary || 'Different prompt') : 'This agent isn’t in that version'}</p>
                </div>
                {prompt && !same && (
                  <>
                    <Button type="button" variant="ghost" size="xs" onClick={() => setComparing(comparing === version.version ? null : version.version)} aria-expanded={comparing === version.version}>
                      <GitCompare className="size-3.5" />
                      Compare
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={readOnly}
                      onClick={() => {
                        setConfig(view.prompt.textNodeId, { [view.prompt.textKey]: prompt.text });
                        setConfig(view.agentId, { promptSettings: prompt.settings ?? undefined, role: prompt.role || undefined });
                        toast.success(`Restored the prompt from ${version.versionTag ?? `v${version.version}`} into the draft`);
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Restore
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {current?.prompt && <DiffView before={current.prompt.composed} after={view.prompt.composed} />}
    </SettingSection>
  );
}

function DiffView({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">That version → now</p>
      <pre tabIndex={0} aria-label="Differences" className="max-h-72 overflow-auto rounded-lg border border-border bg-surface-inset py-1 font-mono text-[11px] leading-relaxed">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              'whitespace-pre-wrap break-words px-2',
              l.kind === 'added' && 'bg-success/10 text-success-text',
              l.kind === 'removed' && 'bg-destructive/10 text-destructive line-through decoration-destructive/40',
            )}
          >
            <span aria-hidden className="mr-1.5 select-none opacity-60">{l.kind === 'added' ? '+' : l.kind === 'removed' ? '−' : ' '}</span>
            <span className="sr-only">{l.kind === 'added' ? 'Added: ' : l.kind === 'removed' ? 'Removed: ' : ''}</span>
            {l.text || ' '}
          </div>
        ))}
      </pre>
    </div>
  );
}

