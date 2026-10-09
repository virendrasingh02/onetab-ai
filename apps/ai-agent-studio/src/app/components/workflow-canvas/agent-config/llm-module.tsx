import { aiApi } from '@org/api-client';
import { AIModelIcon, AppSelect, Badge, Button, Progress, Slider, Textarea } from '@org/ui';
import { cn } from '@org/utils';
import { estimateTokens, MAX_AGENT_TOOL_ROUNDS, type ProviderConnectionTestResult } from '@org/types';
import { Activity, ExternalLink, Loader2, Play, PlugZap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IssueList, LoadError, NumberSetting, SettingField, SettingSection, StatGrid, fieldDomId, useSections } from './config-primitives.js';
import type { ModuleEditorProps } from './module-drawer.js';
import { runModelTest, type ModelTestResult } from './model-test.js';
import { ResultCard } from './result-card.js';
import { estimateCost, findModel, formatCost, modelCapabilities, providerFor, useAiModels, useAiProviders, useModelOptions, useWorkspaceId } from './use-agent-config-data.js';

const CAPABILITY_LABELS: Array<[key: string, label: string]> = [
  ['toolCalling', 'Tools'],
  ['structuredOutput', 'Structured output'],
  ['streaming', 'Streaming'],
  ['reasoning', 'Reasoning'],
  ['vision', 'Vision'],
  ['longContext', 'Long context'],
];

export function LlmModule({ view, nodes, issues, readOnly, setConfig, actions, jumpTo, testSignal }: ModuleEditorProps) {
  const workspaceId = useWorkspaceId();
  const llm = view.llm;
  const target = llm.targetNodeId;
  const models = useAiModels();
  const providers = useAiProviders();
  const options = useModelOptions(llm.model || llm.resolved?.model);
  const fallbackOptions = useModelOptions(llm.fallbackModel);
  const effectiveModel = llm.model || llm.resolved?.model || '';
  const meta = findModel(models.data, effectiveModel);
  const provider = providerFor(providers.data, meta);
  const caps = modelCapabilities(meta);
  const connected = !provider || provider.status === 'CONNECTED' || !provider.requiresApiKey;
  const { hidden } = useSections();

  const promptTokens = estimateTokens(view.prompt.composed);
  const outputBudget = llm.maxTokens ?? meta?.maxTokens ?? 2048;
  const contextWindow = meta?.contextWindow;
  const perTurn = estimateCost(meta, promptTokens + 500, outputBudget);
  const cardLabel = llm.fromLlmNode ? String((nodes.find((n) => n.id === target)?.data as { label?: string } | undefined)?.label ?? 'LLM') : null;
  const hasTools = view.tools.entries.length > 0 || view.subAgents.members.length > 0;

  const [connection, setConnection] = useState<ProviderConnectionTestResult | null>(null);
  const [checking, setChecking] = useState(false);
  const testProvider = async () => {
    if (!meta) return;
    setChecking(true);
    try {
      setConnection(await aiApi.testProvider(workspaceId, meta.provider, meta.model));
    } catch (e) {
      setConnection({ provider: meta.provider, model: meta.model, status: 'ERROR', latencyMs: null, detail: e instanceof Error ? e.message : String(e), checkedAt: new Date().toISOString() });
    } finally {
      setChecking(false);
    }
  };

  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ModelTestResult | null>(null);
  const [running, setRunning] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (testSignal > 0) messageRef.current?.focus();
  }, [testSignal]);
  const runTest = async () => {
    if (!effectiveModel) return;
    setRunning(true);
    setResult(await runModelTest(workspaceId, { model: effectiveModel, system: view.prompt.composed, user: message || 'Reply with one short sentence introducing yourself.', temperature: llm.temperature, maxTokens: llm.maxTokens }, meta));
    setRunning(false);
  };

  return (
    <>
      <SettingSection id="overview" title="Overview">
        {(models.error || providers.error) && <LoadError what="the model list" error={models.error ?? providers.error} onRetry={options.refetch} />}
        <StatGrid
          items={[
            { label: 'Model', value: effectiveModel || 'None' },
            { label: 'Provider', value: provider?.name ?? meta?.provider ?? '—' },
            { label: 'Status', value: models.isLoading ? 'Checking…' : !meta ? 'Unknown' : connected ? 'Connected' : 'Not connected' },
            { label: 'Context', value: contextWindow ? `${Math.round(contextWindow / 1000)}k tokens` : '—' },
            { label: 'Max output', value: meta?.maxTokens ? meta.maxTokens.toLocaleString() : '—' },
            { label: 'Set on', value: cardLabel ? `“${cardLabel}” card` : llm.resolved?.inherited && !llm.model ? 'Supervisor' : 'This agent' },
          ]}
        />
        <IssueList
          issues={[
            ...(meta && !connected
              ? [{ level: 'warning' as const, message: `${provider?.name ?? meta.provider} isn’t connected in this workspace — runs use the fallback model, else the agent’s saved model.`, section: 'model', field: 'model' }]
              : []),
            ...issues,
          ]}
          onJump={jumpTo}
          empty="Model settings look good."
        />
      </SettingSection>

      <SettingSection id="model" title="Model" issues={issues.filter((i) => i.section === 'model')}>
        <SettingField
          field="model"
          label="Model"
          htmlFor="cfg-model"
          hint={
            cardLabel ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                Stored on the plugged-in “{cardLabel}” card.
                <button type="button" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline" onClick={() => actions.selectNode(target)}>
                  Open card <ExternalLink className="size-3" />
                </button>
              </span>
            ) : view.subAgents.isSupervised ? (
              'Leave empty to use the supervisor’s model.'
            ) : undefined
          }
        >
          <AppSelect
            id="cfg-model"
            size="sm"
            searchable
            loading={options.isLoading}
            value={llm.model}
            placeholder={llm.resolved?.inherited ? `Inherit (${llm.resolved.model})` : 'Choose a model'}
            disabled={readOnly}
            options={[...(view.subAgents.isSupervised && !llm.fromLlmNode ? [{ label: 'Inherit', options: [{ value: '', label: 'Use the supervisor’s model' }] }] : []), ...options.groups]}
            emptyText="No models are enabled in this workspace"
            onValueChange={(model) => setConfig(target, { model: model || undefined })}
          />
        </SettingField>
        {meta && (
          <div className="flex flex-wrap items-center gap-1.5">
            <AIModelIcon modelId={meta.model} size={14} />
            {CAPABILITY_LABELS.map(([key, label]) => (
              <Badge key={key} variant={(caps as Record<string, boolean | undefined>)[key] ? 'success' : 'neutral'} className={cn('h-5 px-1.5 text-[10px]', !(caps as Record<string, boolean | undefined>)[key] && 'line-through opacity-60')}>
                {label}
              </Badge>
            ))}
          </div>
        )}
        {meta && hasTools && caps.toolCalling === false && (
          <p className="text-[11px] text-warning">This model doesn’t advertise tool calling, but the agent has tools or sub-agents.</p>
        )}
        {meta && view.prompt.settings.output.format === 'json' && caps.structuredOutput === false && (
          <p className="text-[11px] text-muted-foreground">JSON replies are requested in the prompt; this model has no native structured-output mode.</p>
        )}
        {meta && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised/40 px-2.5 py-2">
            <span className={cn('size-2 rounded-full', connected ? 'bg-success' : 'bg-warning')} aria-hidden />
            <span className="min-w-0 flex-1 text-[11px] text-foreground">
              {provider?.name ?? meta.provider} — {connected ? 'connected' : 'not connected: add its API key in AI settings'}
              {connection && <span className="block text-muted-foreground">{connection.status} · {connection.latencyMs !== null ? `${connection.latencyMs} ms · ` : ''}{connection.detail}</span>}
            </span>
            <Button type="button" variant="outline" size="xs" onClick={() => void testProvider()} disabled={checking}>
              {checking ? <Loader2 className="size-3 animate-spin" /> : <PlugZap className="size-3" />}
              Check
            </Button>
          </div>
        )}
      </SettingSection>

      <SettingSection id="generation" title="Generation" issues={issues.filter((i) => i.section === 'generation')}>
        <div id={fieldDomId('temperature')} className="space-y-1.5 scroll-mt-16">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-foreground">Temperature</span>
            <span className="tabular-nums text-muted-foreground">
              {llm.temperature ?? 'default'} · {(llm.temperature ?? 0.7) < 0.4 ? 'Precise' : (llm.temperature ?? 0.7) > 1.2 ? 'Very creative' : 'Balanced'}
            </span>
          </div>
          <Slider
            min={0}
            max={2}
            step={0.05}
            value={[llm.temperature ?? 0.7]}
            disabled={readOnly}
            aria-label="Temperature"
            onValueChange={([v]) => setConfig(target, { temperature: Math.round(v * 100) / 100 })}
          />
        </div>
        <NumberSetting
          field="maxTokens"
          label="Max output tokens"
          value={llm.maxTokens}
          min={1}
          max={meta?.maxTokens}
          step={256}
          placeholder={meta?.maxTokens ? `Model limit ${meta.maxTokens.toLocaleString()}` : 'Model default'}
          hint="Caps each reply. The workspace’s own cost guardrail still applies."
          onChange={(v) => setConfig(target, { maxTokens: v === undefined ? undefined : Math.round(v) })}
        />
      </SettingSection>

      <SettingSection id="routing" title="Fallback" description="Tried when the main model’s provider isn’t connected in this workspace; if neither is, the agent uses its own saved model and the run says so." issues={issues.filter((i) => i.section === 'routing')}>
        <SettingField field="fallbackModel" label="Fallback model" htmlFor="cfg-fallback">
          <AppSelect
            id="cfg-fallback"
            size="sm"
            searchable
            loading={fallbackOptions.isLoading}
            value={llm.fallbackModel}
            placeholder="None"
            disabled={readOnly}
            options={[{ label: 'Fallback', options: [{ value: '', label: 'None' }] }, ...fallbackOptions.groups]}
            onValueChange={(fallbackModel) => setConfig(target, { fallbackModel: fallbackModel || undefined })}
          />
        </SettingField>
      </SettingSection>

      <SettingSection id="runtime" title="Runtime">
        <NumberSetting
          field="maxSteps"
          label="Tool rounds per turn"
          value={llm.maxSteps}
          min={1}
          max={MAX_AGENT_TOOL_ROUNDS}
          placeholder={`Default (${MAX_AGENT_TOOL_ROUNDS})`}
          hint="How many times the model may call tools before it must answer."
          onChange={(v) => setConfig(view.agentId, { maxSteps: v === undefined ? undefined : Math.round(v) })}
        />
        <p className="text-[11px] text-muted-foreground">Run-wide time, step and token budgets are under Sub-agents → Limits; they cover the whole team.</p>
      </SettingSection>

      <SettingSection id="usage" title="Usage & cost" description="Estimates for one turn, before tools and knowledge add context.">
        <StatGrid
          items={[
            { label: 'Prompt', value: `~${promptTokens.toLocaleString()} tok` },
            { label: 'Output cap', value: `${outputBudget.toLocaleString()} tok` },
            { label: 'Max per turn', value: formatCost(perTurn) },
            { label: 'Input price', value: meta?.pricing?.inputPricePerMillion !== undefined ? `$${meta.pricing.inputPricePerMillion}/M` : '—' },
            { label: 'Output price', value: meta?.pricing?.outputPricePerMillion !== undefined ? `$${meta.pricing.outputPricePerMillion}/M` : '—' },
            { label: 'Pricing', value: meta?.pricing?.pricingType ?? meta?.pricingType ?? '—' },
          ]}
        />
        {contextWindow ? (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Context used by prompt + output cap</span>
              <span className="tabular-nums">{Math.min(100, Math.round(((promptTokens + outputBudget) / contextWindow) * 100))}%</span>
            </div>
            <Progress value={Math.min(100, ((promptTokens + outputBudget) / contextWindow) * 100)} aria-label="Context window used" />
          </div>
        ) : null}
      </SettingSection>

      {!hidden.has('testing') && (
        <SettingSection id="testing" title="Testing" description="One real call with this agent’s prompt and settings (counts toward AI usage).">
          <Textarea ref={messageRef} minRows={2} maxRows={6} value={message} placeholder="Test message (optional)" aria-label="Test message" onChange={(e) => setMessage(e.target.value)} className="text-xs" />
          <div className="flex gap-1.5">
            <Button type="button" size="sm" onClick={() => void runTest()} disabled={running || !effectiveModel}>
              {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              {running ? 'Calling…' : 'Test model'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={actions.runAgentTest}>
              <Activity className="size-3.5" />
              Test whole agent
            </Button>
          </div>
          {result && <ResultCard result={result} />}
        </SettingSection>
      )}
    </>
  );
}
