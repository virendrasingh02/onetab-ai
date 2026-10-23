import { AppSelect, Field, Input, Label, Slider, Switch, Button } from '@org/ui';
import {
  DEFAULT_AGENT_RUN_LIMITS,
  MAX_AGENT_RUN_LIMITS,
  MAX_AGENT_TOOL_ROUNDS,
  PROMPT_TONES,
  type AgentAutonomy,
  type AgentPiiAction,
  type AgentRunLimits,
  type PromptTone,
} from '@org/types';
import type { Edge, Node } from '@xyflow/react';
import { Cpu, ExternalLink, Network, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { isSlotHost, supervisorOf } from '../workflow-canvas/agent-slots.js';
import { readAgentModules, type AgentModuleId } from '../workflow-canvas/agent-config/agent-module-model.js';
import { useModelOptions } from '../workflow-canvas/agent-config/use-agent-config-data.js';
import { AgentTabSection } from './agent-tab-page.js';

/** What the agent's saved runtime enforces on every answer and tool call. */
export interface AgentRuntimeDraft {
  pii?: AgentPiiAction;
  maxTokensPerRun?: number;
  autonomy?: AgentAutonomy;
}

interface AgentRuntimeSettingsProps {
  nodes: Node[];
  edges: Edge[];
  graphSettings: Record<string, unknown> | undefined;
  /** The agent's saved model (the canvas agent's own model, when set, wins). */
  primaryModel: string;
  onPrimaryModelChange: (model: string) => void;
  onUpdateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
  onGraphSettingsChange: (next: Record<string, unknown>) => void;
  runtime: AgentRuntimeDraft;
  onRuntimeChange: (patch: Partial<AgentRuntimeDraft>) => void;
  readOnly?: boolean;
  /** Opens a module drawer on the canvas for the lead agent. */
  onOpenModule: (agentId: string, module: AgentModuleId) => void;
}

const PII_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'redact', label: 'Redact', description: 'Replace emails, phone and card numbers with placeholders' },
  { value: 'block', label: 'Block', description: 'Refuse to send an answer that contains personal data' },
  { value: 'warn', label: 'Warn only', description: 'Deliver the answer and note it in the run trace' },
];

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** A number box that holds `undefined` for "use the default" and clamps when you leave it. */
function OptionalNumber({
  value,
  min,
  max,
  step,
  placeholder,
  disabled,
  onChange,
  ...rest
}: {
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
  id?: string;
}) {
  return (
    <Input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === '') return onChange(undefined);
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={(e) => {
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(clamp(Math.round(n), min, max));
      }}
    />
  );
}

/**
 * The agent settings that really change how it runs: the lead agent's model
 * and sampling, run limits, and what the saved runtime enforces. Everything
 * here reads and writes the same fields the canvas drawers do, so a change
 * here shows up there and the other way round.
 */
export function AgentRuntimeSettings({
  nodes,
  edges,
  graphSettings,
  primaryModel,
  onPrimaryModelChange,
  onUpdateNodeConfig,
  onGraphSettingsChange,
  runtime,
  onRuntimeChange,
  readOnly = false,
  onOpenModule,
}: AgentRuntimeSettingsProps) {
  const lead = useMemo(
    () => nodes.find((n) => isSlotHost(n.type) && !supervisorOf(n.id, edges)),
    [nodes, edges],
  );
  const view = useMemo(() => (lead ? readAgentModules(lead, nodes, edges, graphSettings) : null), [lead, nodes, edges, graphSettings]);

  const modelOptions = useModelOptions(view?.llm.model || primaryModel);
  const fallbackOptions = useModelOptions(view?.llm.fallbackModel);

  const limits = view?.subAgents.limits;
  const setLimit = (patch: Partial<AgentRunLimits>) => {
    const base = graphSettings ?? {};
    const next: Record<string, unknown> = { ...((base['limits'] as Record<string, unknown> | undefined) ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k];
      else next[k] = v;
    }
    onGraphSettingsChange({ ...base, limits: next });
  };
  const storedLimits = (graphSettings?.['limits'] ?? {}) as Partial<AgentRunLimits>;

  const llmTarget = view?.llm.targetNodeId;
  const leadId = view?.agentId;
  const tone = view?.prompt.settings.tone ?? 'neutral';
  const needsApproval = runtime.autonomy === 'supervised' || runtime.autonomy === 'semi';
  const canEditAgent = !readOnly && !!view;

  return (
    <>
      <AgentTabSection
        id="settings-model"
        title="Model & Behaviour"
        icon={<Cpu />}
        actions={
          leadId ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenModule(leadId, 'llm')} className="gap-1.5 text-xs">
              <ExternalLink className="size-3.5" />
              Open model drawer
            </Button>
          ) : undefined
        }
      >

        {!view && (
          <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-muted-foreground">
            Add an agent to the canvas to set its sampling, tone and tool rounds here. The model below is the default for
            every agent that doesn’t pick its own.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Default model"
            hint={
              view?.llm.model && view.llm.model !== primaryModel
                ? `The canvas agent runs on ${view.llm.model}, which takes precedence.`
                : undefined
            }
          >
            <AppSelect
              searchable
              value={primaryModel}
              loading={modelOptions.isLoading}
              disabled={readOnly}
              onValueChange={onPrimaryModelChange}
              options={modelOptions.groups}
            />
          </Field>
          <Field label="Fallback model" hint="Used when the main model’s provider isn’t connected.">
            <AppSelect
              searchable
              value={view?.llm.fallbackModel ?? ''}
              placeholder="None"
              loading={fallbackOptions.isLoading}
              disabled={!canEditAgent}
              onValueChange={(v) => llmTarget && onUpdateNodeConfig(llmTarget, { fallbackModel: v || undefined })}
              options={[{ label: 'Fallback', options: [{ value: '', label: 'None' }] }, ...fallbackOptions.groups]}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <Label htmlFor="agent-temperature">Temperature</Label>
              <span className="font-mono text-muted-foreground tabular-nums">{view?.llm.temperature ?? 'default'}</span>
            </div>
            <Slider
              id="agent-temperature"
              aria-label="Temperature"
              min={0}
              max={2}
              step={0.05}
              disabled={!canEditAgent}
              value={[view?.llm.temperature ?? 0.7]}
              onValueChange={([v]) => llmTarget && onUpdateNodeConfig(llmTarget, { temperature: Math.round(v * 100) / 100 })}
            />
          </div>
          <Field label="Max output tokens" hint="Caps each reply.">
            <OptionalNumber
              value={view?.llm.maxTokens}
              min={1}
              max={200_000}
              step={256}
              placeholder="Model default"
              disabled={!canEditAgent}
              onChange={(v) => llmTarget && onUpdateNodeConfig(llmTarget, { maxTokens: v === undefined ? undefined : Math.round(v) })}
            />
          </Field>
          <Field label="Tool rounds per turn" hint="How often the model may call tools before it must answer.">
            <OptionalNumber
              value={view?.llm.maxSteps}
              min={1}
              max={MAX_AGENT_TOOL_ROUNDS}
              placeholder={`Default (${MAX_AGENT_TOOL_ROUNDS})`}
              disabled={!canEditAgent}
              onChange={(v) => leadId && onUpdateNodeConfig(leadId, { maxSteps: v === undefined ? undefined : Math.round(v) })}
            />
          </Field>
        </div>

        <Field label="Tone" hint="Added to the agent’s instructions.">
          <AppSelect
            value={tone}
            disabled={!canEditAgent}
            onValueChange={(next) =>
              leadId &&
              view &&
              onUpdateNodeConfig(leadId, { promptSettings: { ...view.prompt.settings, tone: next as PromptTone } })
            }
            options={PROMPT_TONES.map((t) => ({ value: t.value, label: t.label, description: t.instruction || undefined }))}
          />
        </Field>
      </AgentTabSection>

      <AgentTabSection
        id="settings-limits"
        title="Run Limits"
        description="Hard ceilings on one run of the whole agent team, so a run can never loop or spend without end."
        icon={<Network />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Max steps" hint="Workflow steps the engine may run.">
            <OptionalNumber
              value={storedLimits.maxSteps}
              min={1}
              max={MAX_AGENT_RUN_LIMITS.maxSteps}
              placeholder={`Default (${DEFAULT_AGENT_RUN_LIMITS.maxSteps})`}
              disabled={readOnly}
              onChange={(v) => setLimit({ maxSteps: v })}
            />
          </Field>
          <Field label="Time limit (minutes)" hint="Stops a run that takes too long.">
            <OptionalNumber
              value={storedLimits.maxDurationMs === undefined ? undefined : Math.round(storedLimits.maxDurationMs / 60_000)}
              min={1}
              max={MAX_AGENT_RUN_LIMITS.maxDurationMs / 60_000}
              placeholder={`Default (${DEFAULT_AGENT_RUN_LIMITS.maxDurationMs / 60_000})`}
              disabled={readOnly}
              onChange={(v) => setLimit({ maxDurationMs: v === undefined ? undefined : v * 60_000 })}
            />
          </Field>
          <Field label="Run token cap" hint="Tokens across the whole run.">
            <OptionalNumber
              value={storedLimits.maxTokens}
              min={1_000}
              max={MAX_AGENT_RUN_LIMITS.maxTokens ?? 2_000_000}
              step={1_000}
              placeholder="No cap"
              disabled={readOnly}
              onChange={(v) => setLimit({ maxTokens: v })}
            />
          </Field>
        </div>
        {limits && (
          <p className="text-xs text-muted-foreground">
            Currently up to {limits.maxSteps} steps, {Math.round(limits.maxDurationMs / 60_000)} min
            {limits.maxTokens ? `, ${limits.maxTokens.toLocaleString()} tokens` : ''} per run.
          </p>
        )}
      </AgentTabSection>

      <AgentTabSection id="settings-safety" title="Safety & Guardrails" icon={<ShieldCheck />} className="gap-3">
        <div className="space-y-2 text-xs">
          <Field
            label="Personal data in answers"
            hint="Checks every reply for emails, phone numbers, card and SSN-style numbers. It matches patterns; it can’t find names or addresses."
          >
            <AppSelect
              value={runtime.pii ?? 'off'}
              disabled={readOnly}
              onValueChange={(v) => onRuntimeChange({ pii: v === 'off' ? undefined : (v as AgentPiiAction) })}
              options={PII_OPTIONS}
            />
          </Field>
          <Label
            htmlFor="agent-approval-gate"
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-surface-raised/40 p-2 hover:bg-surface-raised"
          >
            <span className="flex flex-col items-start gap-0.5">
              <span className="font-semibold text-foreground">Ask a person before changes</span>
              <span className="text-2xs font-normal text-muted-foreground">
                Tools that send, write or delete wait for approval. Read-only tools still run. A canvas agent that sets its
                own autonomy keeps it.
              </span>
            </span>
            <Switch
              id="agent-approval-gate"
              checked={needsApproval}
              disabled={readOnly}
              onCheckedChange={(on) => onRuntimeChange({ autonomy: on ? (runtime.autonomy === 'supervised' ? 'supervised' : 'semi') : 'autonomous' })}
            />
          </Label>
          <Field label="Max tokens per model call" hint="A hard cap on one completion, on top of any model setting.">
            <OptionalNumber
              value={runtime.maxTokensPerRun}
              min={100}
              max={200_000}
              step={256}
              placeholder="No cap"
              disabled={readOnly}
              onChange={(v) => onRuntimeChange({ maxTokensPerRun: v })}
            />
          </Field>
        </div>
      </AgentTabSection>
    </>
  );
}
