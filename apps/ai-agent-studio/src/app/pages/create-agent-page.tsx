import { agentArchitectApi, agentGraphsApi, agentStudioApi, agentsApi, knowledgeApi } from '@org/api-client';
import {
  applyRecommendations,
  compileStudioGraph,
  describeCronExpression,
  describeFlowLine,
  refreshSpecConnections,
  specToStudioGraph,
  type AgentArchitectSpec,
  type ArchitectStep,
  type ArchitectUnderstandResult,
  type MissingConfigItem,
} from '@org/types';
import { Alert, AlertDescription, AlertTitle, Badge, Button, Input, Page, Textarea, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  ExternalLink,
  FileUp,
  LayoutTemplate,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ConnectionBadge, FlowLine, IssueList, errorText, integrationsHref } from '../components/agent-architect/architect-ui.js';
import { PROMPT_SUGGESTIONS, PROMPT_TEMPLATES } from '../data/prompt-templates.js';
import { useStudioSession } from '../session-guard.js';

type Phase = 'describe' | 'understanding' | 'plan' | 'building' | 'built';

interface BuildStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'waiting' | 'failed';
  detail?: string;
}

const RECENT_KEY = 'onetab_studio_recent_prompts';
const DOMAINS = ['HR', 'Sales', 'Marketing', 'Accounts', 'Support', 'Banking & Insurance', 'Ecommerce'];

const SCHEDULE_PRESETS: Array<{ label: string; cron: string | null }> = [
  { label: 'When I run it', cron: null },
  { label: 'Weekdays at 9:00', cron: '0 9 * * 1-5' },
  { label: 'Every day at 8:00', cron: '0 8 * * *' },
  { label: 'Every Monday at 9:00', cron: '0 9 * * 1' },
  { label: 'Every day at 18:00', cron: '0 18 * * *' },
];

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function rememberPrompt(prompt: string) {
  try {
    const next = [prompt, ...readRecent().filter((p) => p !== prompt)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode / blocked storage: recent prompts are only a convenience.
  }
}

const STEP_KIND_LABEL: Record<ArchitectStep['kind'], string> = {
  collect: 'Reads',
  analyze: 'Analyses',
  generate: 'Writes',
  action: 'Acts',
  approval: 'Approval',
  notify: 'Notifies',
  condition: 'Decides',
  delegate: 'Hands off',
  knowledge: 'Knowledge',
};

/**
 * "Create with one prompt" — describe the agent, check what the Studio
 * understood, fill in only what's missing, and build it. The plan comes from
 * the real planner against this workspace's tools and apps; the build creates
 * the agent through the normal agent routes and checks it on the server.
 */
export function CreateAgentPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>('describe');
  const [prompt, setPrompt] = useState(() => params.get('prompt') ?? '');
  const [result, setResult] = useState<ArchitectUnderstandResult | null>(null);
  const [spec, setSpec] = useState<AgentArchitectSpec | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [addition, setAddition] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [build, setBuild] = useState<BuildStep[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [suggestion, setSuggestion] = useState(0);
  const requestRef = useRef(0);
  const planHeadingRef = useRef<HTMLHeadingElement>(null);
  const autoStarted = useRef(false);

  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ['knowledge-bases', activeWorkspace.id],
    queryFn: () => knowledgeApi.list(activeWorkspace.id),
    staleTime: 60_000,
  });

  // Rotating example under the prompt box.
  useEffect(() => {
    if (phase !== 'describe') return;
    const timer = setInterval(() => setSuggestion((i) => (i + 1) % PROMPT_SUGGESTIONS.length), 3_500);
    return () => clearInterval(timer);
  }, [phase]);

  // Planning can take most of a minute with a large model — show that it's working, honestly.
  useEffect(() => {
    if (phase !== 'understanding') return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1_000);
    return () => clearInterval(timer);
  }, [phase]);

  const understand = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length < 3) return;
      const id = ++requestRef.current;
      setError(null);
      setPhase('understanding');
      rememberPrompt(trimmed);
      setRecent(readRecent());
      try {
        const res = await agentArchitectApi.understand(activeWorkspace.id, { prompt: trimmed });
        if (id !== requestRef.current) return;
        setResult(res);
        setSpec(res.spec);
        setAccepted(res.spec.recommendations.filter((r) => r.recommended).map((r) => r.id));
        setDeferred([]);
        setPhase('plan');
        requestAnimationFrame(() => planHeadingRef.current?.focus());
      } catch (err) {
        if (id !== requestRef.current) return;
        setError(errorText(err, 'The Studio couldn’t plan this agent.'));
        setPhase('describe');
      }
    },
    [activeWorkspace.id],
  );

  // `/create?prompt=…&go=1` (from the Home prompt box) plans straight away.
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    const initial = params.get('prompt');
    if (initial && params.get('go') === '1') {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('go');
        return next;
      }, { replace: true });
      void understand(initial);
    }
  }, [params, setParams, understand]);

  const finalSpec = useMemo(() => (spec ? applyRecommendations(spec, accepted) : null), [spec, accepted]);
  const preview = useMemo(() => (finalSpec ? specToStudioGraph(finalSpec) : null), [finalSpec]);
  const flow = useMemo(() => (preview ? describeFlowLine(preview) : ''), [preview]);
  const issues = useMemo(() => (preview ? compileStudioGraph(preview).issues : []), [preview]);
  const missing = useMemo(
    () => (finalSpec?.missingConfiguration ?? []).filter((m) => !deferred.includes(m.id)),
    [finalSpec, deferred],
  );

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    void understand(prompt);
  };

  const updateSpec = (fn: (draft: AgentArchitectSpec) => void) => {
    setSpec((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      fn(next);
      next.approvals = next.steps.filter((s) => s.kind === 'approval' || s.requiresApproval).map((s) => s.id);
      return next;
    });
  };

  const removeStep = (id: string) =>
    updateSpec((d) => {
      d.steps = d.steps.filter((s) => s.id !== id);
    });

  const setSchedule = (cron: string | null) =>
    updateSpec((d) => {
      d.trigger = cron
        ? { kind: 'schedule', cron, timezone: d.trigger.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, label: describeCronExpression(cron) }
        : { kind: 'manual', label: 'When you run it' };
      d.missingConfiguration = d.missingConfiguration.filter((m) => m.kind !== 'schedule');
    });

  const pickKnowledge = (kb: { id: string; name: string }) =>
    updateSpec((d) => {
      d.knowledge = { ...d.knowledge, enabled: true, knowledgeBaseId: kb.id, name: kb.name };
      d.missingConfiguration = d.missingConfiguration.filter((m) => m.kind !== 'knowledge');
      for (const s of d.steps) if (s.kind === 'knowledge') s.title = `Search ${kb.name}`;
    });

  const recheckConnections = async () => {
    if (!spec) return;
    setCheckingConnections(true);
    try {
      const catalog = await agentStudioApi.catalog(activeWorkspace.id);
      const next = refreshSpecConnections(spec, {
        connectedApps: catalog.apps.filter((a) => a.status === 'CONNECTED').map((a) => a.provider),
        appActions: Object.fromEntries(catalog.apps.map((a) => [a.provider, a.actions.map((x) => ({ tool: x.tool, label: x.label, access: x.access }))])),
        knowledgeBases,
      });
      const before = spec.missingConfiguration.filter((m) => m.kind === 'connection').length;
      const after = next.missingConfiguration.filter((m) => m.kind === 'connection').length;
      setSpec(next);
      toast.success(before === after ? 'No new connections yet.' : `${before - after} connection${before - after === 1 ? '' : 's'} ready.`);
    } catch (err) {
      toast.error(errorText(err, 'Couldn’t check your connections.'));
    } finally {
      setCheckingConnections(false);
    }
  };

  const setBuildStep = (id: string, patch: Partial<BuildStep>) =>
    setBuild((steps) => steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  /** Creates the agent through the normal routes, then checks it — every line is a real call. */
  const buildAgent = async () => {
    if (!finalSpec || !preview) return;
    const blocking = issues.filter((i) => i.level === 'error');
    const appSteps = finalSpec.apps.map((a) => ({ id: `app_${a.provider}`, label: a.connected ? `${a.label} connected` : `Waiting for ${a.label} connection`, status: 'pending' as const }));
    setBuild([
      { id: 'design', label: 'Designing the workflow', status: 'done', detail: `${preview.nodes.length} steps` },
      { id: 'validate', label: 'Checking the workflow', status: 'pending' },
      { id: 'create', label: 'Creating the agent', status: 'pending' },
      { id: 'version', label: 'Saving version 1', status: 'pending' },
      { id: 'server', label: 'Validating on the server', status: 'pending' },
      ...(finalSpec.knowledge.enabled ? [{ id: 'knowledge', label: 'Connecting knowledge', status: 'pending' as const }] : []),
      ...appSteps,
    ]);
    setPhase('building');

    setBuildStep('validate', {
      status: 'done',
      detail: blocking.length ? `${blocking.length} thing${blocking.length === 1 ? '' : 's'} to finish before a live run` : 'Ready to run',
    });

    setBuildStep('create', { status: 'running' });
    let agentId: string;
    try {
      const created = await agentsApi.create(activeWorkspace.id, {
        name: finalSpec.agent.name,
        role: `${finalSpec.agent.category} agent`,
        description: finalSpec.agent.description,
        systemPrompt: finalSpec.agent.instructions,
        graphJson: JSON.stringify(preview),
        configuration: {
          category: finalSpec.agent.category,
          icon: finalSpec.agent.icon,
          tags: finalSpec.agent.tags,
          lifecycle: 'draft',
          architect: { spec: finalSpec, prompt: finalSpec.source.prompt, createdAt: new Date().toISOString() },
        },
      });
      agentId = created.id;
      setCreatedId(agentId);
      setBuildStep('create', { status: 'done', detail: finalSpec.agent.name });
    } catch (err) {
      const message = errorText(err, 'The agent couldn’t be created.');
      setBuildStep('create', {
        status: 'failed',
        detail: /permission/i.test(message) ? `${message} Ask a workspace admin to create it, or to let members create agents (Settings → AI).` : message,
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });

    setBuildStep('version', { status: 'running' });
    try {
      await agentsApi.createVersion(activeWorkspace.id, agentId, 'Initial agent — created from a prompt');
      setBuildStep('version', { status: 'done' });
    } catch (err) {
      setBuildStep('version', { status: 'failed', detail: errorText(err, 'The first version wasn’t saved. You can save one from Versions.') });
    }

    setBuildStep('server', { status: 'running' });
    try {
      const check = await agentGraphsApi.validate(activeWorkspace.id, agentId);
      const errors = check.issues.filter((i) => i.level === 'error');
      setBuildStep('server', {
        status: errors.length ? 'waiting' : 'done',
        detail: errors.length ? errors.map((e) => e.message).join(' ') : 'The runtime can run it',
      });
    } catch (err) {
      setBuildStep('server', { status: 'failed', detail: errorText(err, 'The server check didn’t run.') });
    }

    if (finalSpec.knowledge.enabled) {
      setBuildStep('knowledge', finalSpec.knowledge.knowledgeBaseId ? { status: 'done', detail: finalSpec.knowledge.name } : { status: 'waiting', detail: 'Pick a knowledge base on the Knowledge step' });
    }
    for (const app of finalSpec.apps) {
      setBuildStep(`app_${app.provider}`, app.connected ? { status: 'done' } : { status: 'waiting', detail: `Connect ${app.label} in Integrations` });
    }
    setPhase('built');
  };

  const allRecommendations = spec?.recommendations ?? [];

  /* ---------------------------------------------------------------- views -- */

  if (phase === 'describe' || phase === 'understanding') {
    const busy = phase === 'understanding';
    return (
      <Page width="wide" padding="none" className="mx-auto w-full max-w-4xl space-y-8 py-4 sm:py-10">
        <section className="space-y-4 text-center" aria-labelledby="create-heading">
          <Badge variant="primary" className="mx-auto gap-1">
            <Sparkles className="size-3" aria-hidden /> Create with one prompt · any domain
          </Badge>
          <h1 id="create-heading" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Describe the agents you need.
            <span className="block text-muted-foreground">AI Agent Studio builds the workflow.</span>
          </h1>
          <p className="text-sm text-muted-foreground">{DOMAINS.join(', ')} — any domain, any workflow.</p>
        </section>

        <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
          <label htmlFor="agent-prompt" className="sr-only">
            What do you want your agent to do?
          </label>
          <Textarea
            id="agent-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            disabled={busy}
            rows={4}
            maxLength={4_000}
            placeholder={`What do you want your agent to do? e.g. “${PROMPT_SUGGESTIONS[suggestion]}”`}
            className="min-h-28 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to="/templates">
                  <LayoutTemplate className="size-3.5" /> Start from template
                </Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to="/agents?import=1">
                  <FileUp className="size-3.5" /> Import existing workflow
                </Link>
              </Button>
            </div>
            <Button type="submit" size="lg" disabled={busy || prompt.trim().length < 3} className="gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
              {busy ? 'Understanding…' : 'Create agent'}
            </Button>
          </div>
        </form>

        <div aria-live="polite">
          {busy && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                Understanding what you want and planning it with your workspace’s tools and apps…
              </div>
              <p className="text-xs text-muted-foreground">
                {elapsed}s — a full plan from the AI model can take up to a minute. If no model can plan it, the closest template is used and the plan says so.
              </p>
              <div className="space-y-2" aria-hidden>
                <div className="h-3 w-2/3 animate-pulse rounded bg-surface-raised" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-raised" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-surface-raised" />
              </div>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertTitle>Nothing was built</AlertTitle>
              <AlertDescription>
                {error}
                <Button variant="outline" size="xs" className="ml-2" onClick={() => submit()}>
                  <RefreshCw className="size-3" /> Try again
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {!busy && (
          <>
            <section aria-label="Suggestions" className="flex flex-wrap justify-center gap-2">
              {PROMPT_SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => setPrompt(s)} className="rounded-full">
                  {s}
                </Button>
              ))}
            </section>

            {recent.length > 0 && (
              <section aria-labelledby="recent-heading" className="space-y-2">
                <h2 id="recent-heading" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden /> Recent prompts
                </h2>
                <ul className="space-y-1">
                  {recent.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => setPrompt(p)}
                        className="w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="templates-heading" className="space-y-3">
              <h2 id="templates-heading" className="text-sm font-semibold text-foreground">
                Or start from a template
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PROMPT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPrompt(t.prompt)}
                    className="group rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{t.title}</span>
                      <Badge variant="neutral">{t.domain}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{t.prompt}</p>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </Page>
    );
  }

  if (!spec || !finalSpec || !preview) return null;

  if (phase === 'building' || phase === 'built') {
    const failed = build.some((b) => b.status === 'failed' && b.id === 'create');
    const waiting = build.filter((b) => b.status === 'waiting');
    return (
      <Page width="wide" padding="none" className="mx-auto w-full max-w-2xl space-y-6 py-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">{phase === 'built' && !failed ? 'Your agent is built' : 'Building your agent'}</h1>
          <p className="text-sm text-muted-foreground">{finalSpec.agent.name}</p>
        </header>
        <ol className="space-y-2 rounded-xl border border-border bg-surface p-4" aria-live="polite">
          {build.map((step) => (
            <li key={step.id} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5" aria-hidden>
                {step.status === 'done' && <CircleCheck className="size-4 text-success-text" />}
                {step.status === 'running' && <Loader2 className="size-4 animate-spin text-primary" />}
                {step.status === 'pending' && <span className="block size-4 rounded-full border border-border" />}
                {step.status === 'waiting' && <span className="block size-4 rounded-full border-2 border-warning bg-warning/20" />}
                {step.status === 'failed' && <CircleAlert className="size-4 text-destructive-text" />}
              </span>
              <div className="min-w-0">
                <p className={cn('font-medium', step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground')}>
                  {step.label}
                  <span className="sr-only"> — {step.status}</span>
                </p>
                {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
              </div>
            </li>
          ))}
        </ol>

        {phase === 'built' && !failed && createdId && (
          <div className="space-y-3">
            {waiting.length > 0 ? (
              <Alert variant="warning">
                <CircleAlert aria-hidden />
                <AlertTitle>Almost ready — {waiting.length === 1 ? 'one thing' : `${waiting.length} things`} left</AlertTitle>
                <AlertDescription>
                  You can test it now (reads run for real, nothing is sent). A live run needs the items above.
                  {finalSpec.apps.some((a) => !a.connected) && (
                    <a href={integrationsHref(activeWorkspace.slug)} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 font-medium underline">
                      Open Integrations <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="success">
                <CircleCheck aria-hidden />
                <AlertTitle>Ready to test</AlertTitle>
                <AlertDescription>Run a test to see each step, then publish it or switch on its schedule.</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(`/agents/${createdId}?copilot=1&test=1`)} className="gap-1.5">
                <Play className="size-4" /> Run a test
              </Button>
              <Button variant="outline" onClick={() => navigate(`/agents/${createdId}?copilot=1`)} className="gap-1.5">
                <Bot className="size-4" /> Open in Studio
              </Button>
            </div>
          </div>
        )}
        {failed && (
          <Button variant="outline" onClick={() => setPhase('plan')} className="gap-1.5">
            <ArrowLeft className="size-4" /> Back to the plan
          </Button>
        )}
      </Page>
    );
  }

  // phase === 'plan'
  const result_ = result!;
  const currentCron = finalSpec.trigger.kind === 'schedule' ? (finalSpec.trigger.cron ?? null) : null;
  // The request's own schedule ("weekdays at 6 PM") is a choice too, not just the presets.
  const schedulePresets =
    currentCron && !SCHEDULE_PRESETS.some((p) => p.cron === currentCron)
      ? [{ label: describeCronExpression(currentCron), cron: currentCron }, ...SCHEDULE_PRESETS]
      : SCHEDULE_PRESETS;
  const triggerPreset = schedulePresets.find((p) => (p.cron ?? null) === currentCron);

  return (
    <Page width="wide" padding="none" className="mx-auto w-full max-w-6xl space-y-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setPhase('describe')} className="gap-1.5">
          <ArrowLeft className="size-3.5" /> Edit prompt
        </Button>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {result_.plannedBy === 'ai' ? (
            <span>Planned by {result_.model ?? 'AI'} in {Math.round(result_.durationMs / 1000)}s</span>
          ) : (
            <span>Started from a template{finalSpec.source.fallbackReason ? ` — ${finalSpec.source.fallbackReason}` : ''}</span>
          )}
          <Button variant="ghost" size="xs" onClick={() => void understand(prompt)} className="gap-1">
            <RefreshCw className="size-3" /> Regenerate
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* The plan */}
        <section className="space-y-5 rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="plan-heading">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">I understand what you want to build.</p>
            <h1 ref={planHeadingRef} tabIndex={-1} id="plan-heading" className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground outline-none">
              {editingName ? (
                <Input
                  autoFocus
                  defaultValue={finalSpec.agent.name}
                  aria-label="Agent name"
                  className="h-8 max-w-sm"
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name) updateSpec((d) => void (d.agent.name = name));
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                />
              ) : (
                <>
                  {finalSpec.agent.name}
                  <Button variant="ghost" size="icon-xs" onClick={() => setEditingName(true)} aria-label="Rename agent">
                    <Pencil />
                  </Button>
                </>
              )}
              <Badge variant="primary">{finalSpec.agent.category}</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">{finalSpec.goal}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">It will</h2>
            <ol className="space-y-1.5">
              {finalSpec.steps.map((step, i) => (
                <li key={step.id} className="group flex items-start gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-accent/40">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">{step.title}</span>
                      <Badge variant="neutral">{STEP_KIND_LABEL[step.kind]}</Badge>
                      {step.requiresApproval && (
                        <Badge variant="info" className="gap-1">
                          <ShieldCheck className="size-3" aria-hidden /> After your approval
                        </Badge>
                      )}
                      {step.app && <Badge variant="warning">Needs {finalSpec.apps.find((a) => a.provider === step.app)?.label ?? step.app}</Badge>}
                    </div>
                    {step.why && <p className="text-xs text-muted-foreground">{step.why}</p>}
                  </div>
                  <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => removeStep(step.id)} aria-label={`Remove “${step.title}”`} disabled={finalSpec.steps.length <= 1}>
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow</h2>
            <FlowLine flow={flow} />
            {finalSpec.team && (
              <p className="text-xs text-muted-foreground">
                A coordinator delegates to {finalSpec.team.members.length} specialists: {finalSpec.team.members.map((m) => m.name).join(', ')}.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Runs</h2>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="When it runs">
                {schedulePresets.map((p) => (
                  <Button
                    key={p.label}
                    variant={triggerPreset === p ? 'primary' : 'outline'}
                    size="xs"
                    aria-pressed={triggerPreset === p}
                    onClick={() => setSchedule(p.cron)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {finalSpec.trigger.label}
                {finalSpec.trigger.kind === 'schedule' && finalSpec.trigger.timezone ? ` (${finalSpec.trigger.timezone})` : ''}
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uses</h2>
              <div className="flex flex-wrap gap-1.5">
                {finalSpec.apps.map((a) => (
                  <ConnectionBadge key={a.provider} label={a.label} connected={a.connected} />
                ))}
                {finalSpec.knowledge.enabled && (
                  <Badge variant={finalSpec.knowledge.knowledgeBaseId ? 'success' : 'warning'} className="gap-1">
                    <BookOpen className="size-3" aria-hidden /> {finalSpec.knowledge.name ?? 'Knowledge base'}
                  </Badge>
                )}
                {finalSpec.inputs.filter((i) => i !== 'Knowledge').map((i) => (
                  <Badge key={i} variant="neutral">{i}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {finalSpec.approvals.length ? `Waits for your approval at ${finalSpec.approvals.length} point${finalSpec.approvals.length === 1 ? '' : 's'}.` : 'Never waits for approval.'}
                {' '}Produces: {finalSpec.outputs.join(', ')}.
              </p>
            </div>
          </div>

          {(finalSpec.assumptions.length > 0 || finalSpec.warnings.length > 0 || issues.length > 0) && (
            <details className="rounded-lg border border-border bg-surface-raised/40 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground">
                Assumptions and checks ({finalSpec.assumptions.length + finalSpec.warnings.length + issues.length})
              </summary>
              <div className="mt-2 space-y-2">
                {finalSpec.assumptions.map((a, i) => (
                  <p key={`a${i}`} className="text-muted-foreground">• {a}</p>
                ))}
                {finalSpec.warnings.map((w, i) => (
                  <p key={`w${i}`} className="text-warning-text">• {w}</p>
                ))}
                <IssueList issues={issues} />
              </div>
            </details>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!addition.trim()) return;
              const next = `${prompt.trim()}\nAlso: ${addition.trim()}`;
              setPrompt(next);
              setAddition('');
              void understand(next);
            }}
          >
            <label htmlFor="add-requirement" className="sr-only">Add a requirement</label>
            <Input id="add-requirement" value={addition} onChange={(e) => setAddition(e.target.value)} placeholder="Add a requirement — e.g. “also post a summary in #sales”" className="h-8" />
            <Button type="submit" variant="outline" size="md" disabled={!addition.trim()} className="gap-1">
              <Plus className="size-3.5" /> Add
            </Button>
          </form>
        </section>

        {/* What's missing, recommendations, build */}
        <aside className="space-y-4" aria-label="Finish setting it up">
          <section className="space-y-3 rounded-xl border border-border bg-surface p-4" aria-labelledby="missing-heading">
            <h2 id="missing-heading" className="text-sm font-semibold text-foreground">
              {missing.length ? `I can build this. I only need ${missing.length === 1 ? 'one thing' : `${missing.length} things`}:` : 'Nothing is missing.'}
            </h2>
            {missing.map((item, i) => (
              <MissingCard
                key={item.id}
                index={i + 1}
                item={item}
                workspaceSlug={activeWorkspace.slug}
                knowledgeBases={knowledgeBases}
                onSchedule={setSchedule}
                onKnowledge={pickKnowledge}
                onDefer={() => setDeferred((d) => [...d, item.id])}
              />
            ))}
            {finalSpec.apps.some((a) => !a.connected) && (
              <Button variant="outline" size="sm" onClick={recheckConnections} disabled={checkingConnections} className="w-full gap-1.5">
                {checkingConnections ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                I’ve connected them — check again
              </Button>
            )}
            {!missing.length && <p className="text-xs text-muted-foreground">Everything it needs is already connected.</p>}
          </section>

          {allRecommendations.length > 0 && (
            <section className="space-y-2 rounded-xl border border-border bg-surface p-4" aria-labelledby="rec-heading">
              <h2 id="rec-heading" className="text-sm font-semibold text-foreground">I recommend</h2>
              <ul className="space-y-1.5">
                {allRecommendations.map((r) => {
                  const on = accepted.includes(r.id);
                  return (
                    <li key={r.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-accent/50">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setAccepted((a) => (on ? a.filter((x) => x !== r.id) : [...a, r.id]))}
                          className="mt-0.5 size-3.5 accent-[var(--color-primary)]"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-foreground">{r.title}</span>
                          <span className="block text-[11px] text-muted-foreground">{r.reason}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex gap-1.5 pt-1">
                <Button variant="ghost" size="xs" onClick={() => setAccepted(allRecommendations.filter((r) => r.recommended).map((r) => r.id))}>
                  Use recommended setup
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setAccepted([])}>
                  None
                </Button>
              </div>
            </section>
          )}

          <Button size="xl" className="w-full gap-2" onClick={buildAgent}>
            <Zap className="size-4" /> Build it
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Creates the agent as a draft. Nothing runs until you test or switch it on.
          </p>
        </aside>
      </div>
    </Page>
  );
}

function MissingCard({
  index,
  item,
  workspaceSlug,
  knowledgeBases,
  onSchedule,
  onKnowledge,
  onDefer,
}: {
  index: number;
  item: MissingConfigItem;
  workspaceSlug: string;
  knowledgeBases: Array<{ id: string; name: string }>;
  onSchedule: (cron: string | null) => void;
  onKnowledge: (kb: { id: string; name: string }) => void;
  onDefer: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-raised/40 p-3">
      <div>
        <p className="text-xs font-semibold text-foreground">
          {index}. {item.title}
        </p>
        <p className="text-[11px] text-muted-foreground">{item.detail}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.kind === 'connection' && (
          <Button size="xs" asChild>
            <a href={integrationsHref(workspaceSlug)} target="_blank" rel="noreferrer">
              {item.options[0] ?? 'Connect'} <ExternalLink className="size-3" aria-hidden />
            </a>
          </Button>
        )}
        {item.kind === 'data_source' &&
          item.options.map((o) =>
            /upload|csv/i.test(o) ? (
              <Button key={o} size="xs" variant="outline" asChild>
                <Link to="/knowledge">{o}</Link>
              </Button>
            ) : /workspace/i.test(o) ? (
              <Button key={o} size="xs" variant="outline" onClick={onDefer}>
                {o}
              </Button>
            ) : (
              <Button key={o} size="xs" variant="outline" asChild>
                <a href={integrationsHref(workspaceSlug)} target="_blank" rel="noreferrer">
                  Connect {o}
                </a>
              </Button>
            ),
          )}
        {item.kind === 'schedule' &&
          SCHEDULE_PRESETS.filter((p) => p.cron).map((p) => (
            <Button key={p.label} size="xs" variant="outline" onClick={() => onSchedule(p.cron)}>
              {p.label}
            </Button>
          ))}
        {item.kind === 'knowledge' &&
          (knowledgeBases.length ? (
            knowledgeBases.slice(0, 5).map((kb) => (
              <Button key={kb.id} size="xs" variant="outline" onClick={() => onKnowledge(kb)}>
                <BookOpen className="size-3" /> {kb.name}
              </Button>
            ))
          ) : (
            <Button size="xs" variant="outline" asChild>
              <Link to="/knowledge">
                <FileUp className="size-3" /> Upload documents
              </Link>
            </Button>
          ))}
        {(item.kind === 'channel' || item.kind === 'param') && <span className="text-[11px] text-muted-foreground">You’ll choose this on the canvas.</span>}
        {item.kind !== 'connection' && (
          <Button size="xs" variant="ghost" onClick={onDefer} className="gap-1">
            <Check className="size-3" /> Later
          </Button>
        )}
      </div>
    </div>
  );
}
