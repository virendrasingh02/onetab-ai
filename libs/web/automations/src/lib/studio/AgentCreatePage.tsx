import { blueprintBlockers, findAgentTemplate, type AgentBlueprint, type PlanUnderstanding } from '@org/types';
import { Button, Card, ErrorState, Hint, Skeleton, Textarea, toast } from '@org/ui';
import { aiWorkspacePath, errorText, studioAgentPath, useAIRunUpdates } from '@org/web-ai';
import { useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import { ArrowLeft, FlaskConical, Play, Power, RotateCcw, Save, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EXAMPLE_REQUESTS } from './StudioHome.js';
import { PlanEditor } from './plan-editor/PlanEditor.js';
import { usePlanAgent, useStudioCatalog, useStudioMutations } from './use-studio.js';

type Finish = 'draft' | 'test' | 'run' | 'activate';

/**
 * AI Mode: say what you want done, get a plan made of the tools this
 * workspace really has, change anything, then save it — as a draft, with a
 * test run, running straight away, or switched on.
 */
export function AgentCreatePage() {
  const { workspaceId, slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const catalog = useStudioCatalog(workspaceId);
  const plan = usePlanAgent(workspaceId);
  const { create, run } = useStudioMutations(workspaceId);
  const [request, setRequest] = useState(params.get('prompt') ?? '');
  const [blueprint, setBlueprint] = useState<AgentBlueprint | null>(null);
  const [understanding, setUnderstanding] = useState<PlanUnderstanding | undefined>();
  const [busy, setBusy] = useState<Finish | null>(null);
  // The plan's progress lives here, not on the mutation: a plan started from
  // the mount effect loses its MutationObserver to StrictMode's re-subscribe,
  // so `plan.isPending` would never clear. The promise always settles.
  const [planning, setPlanning] = useState<string | null>(null);
  const [planError, setPlanError] = useState<unknown>(null);
  const latestPlan = useRef(0);
  const started = useRef(false);
  useAIRunUpdates(workspaceId);

  const startPlan = async (prompt: string, templateId?: string) => {
    const attempt = ++latestPlan.current;
    setBlueprint(null);
    setPlanError(null);
    setPlanning(templateId ? findAgentTemplate(templateId)?.name ?? prompt : prompt);
    try {
      const result = await plan.mutateAsync({ prompt, ...(templateId ? { templateId } : {}) });
      if (attempt !== latestPlan.current) return;
      setBlueprint(result.blueprint);
      setUnderstanding(result.understanding);
    } catch (error) {
      if (attempt === latestPlan.current) setPlanError(error);
    } finally {
      if (attempt === latestPlan.current) setPlanning(null);
    }
  };

  // `?prompt=` from the Home box, or `?template=` from the gallery, plans straight away.
  useEffect(() => {
    if (started.current || !workspaceId) return;
    const templateId = params.get('template');
    const template = findAgentTemplate(templateId);
    const prompt = params.get('prompt');
    if (template) {
      started.current = true;
      void startPlan(template.name, template.id);
    } else if (prompt?.trim()) {
      started.current = true;
      void startPlan(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const blockers = blueprint ? blueprintBlockers(blueprint) : [];
  const finish = async (how: Finish) => {
    if (!blueprint) return;
    setBusy(how);
    try {
      const saved = await create.mutateAsync({ blueprint, activate: how === 'activate' });
      if (how === 'test' || how === 'run') {
        const started = await run.mutateAsync({ id: saved.id, mode: how === 'test' ? 'test' : 'live' });
        navigate(`${studioAgentPath(slug, saved.id, 'runs')}&run=${started.runId}`);
      } else {
        toast.success(how === 'activate' ? `“${saved.name}” is on` : `Saved “${saved.name}” as a draft`);
        navigate(studioAgentPath(slug, saved.id));
      }
    } catch {
      // The mutations report their own errors.
    } finally {
      setBusy(null);
    }
  };

  if (!can('create')) {
    return (
      <div className="p-6">
        <ErrorState title="You can’t create agents in this workspace" description="Ask a workspace admin for access." />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex min-h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 py-1.5 backdrop-blur-md sm:px-6">
        <Button variant="ghost" size="icon-sm" asChild aria-label="Back to AI Agent Studio">
          <Link to={aiWorkspacePath(slug)}>
            <ArrowLeft />
          </Link>
        </Button>
        <Sparkles className="size-4 text-muted-foreground" aria-hidden />
        <h1 className="truncate text-sm font-semibold text-foreground">{blueprint ? blueprint.name || 'New agent' : 'New agent'}</h1>
        {blueprint ? (
          <Button variant="ghost" size="sm" className="ml-auto" leadingIcon={<RotateCcw />} onClick={() => setBlueprint(null)}>
            Start over
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-6 p-3 pb-32 sm:p-6 sm:pb-32">
          {!blueprint && planning === null ? (
            <Card className="space-y-4 p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">What should this agent do?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Describe it the way you’d ask a colleague — what, when, and where the result should go. You’ll see the plan before anything is saved.
                </p>
              </div>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (request.trim()) void startPlan(request.trim());
                }}
              >
                <label htmlFor="agent-request" className="sr-only">
                  Describe the agent
                </label>
                <Textarea
                  id="agent-request"
                  autoFocus
                  rows={4}
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && request.trim()) void startPlan(request.trim());
                  }}
                  placeholder="e.g. Every evening at 6, prepare my daily report from what I completed, my meetings and project activity. Let me approve it, then save it as a doc."
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Ctrl + Enter to plan</span>
                  <Button type="submit" leadingIcon={<Sparkles />} disabled={!request.trim()}>
                    Plan it
                  </Button>
                </div>
              </form>
              {planError ? (
                <ErrorState title="Couldn’t plan that" description={errorText(planError)} onRetry={() => request.trim() && void startPlan(request.trim())} />
              ) : null}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Try one of these</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_REQUESTS.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setRequest(example);
                        void startPlan(example);
                      }}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {planning !== null ? <Planning request={planning} /> : null}

          {blueprint ? (
            <PlanEditor workspaceId={workspaceId} value={blueprint} onChange={setBlueprint} catalog={catalog.data} understanding={understanding} />
          ) : null}
        </div>
      </div>

      {blueprint ? (
        <footer className="sticky bottom-0 z-20 border-t border-border bg-background/95 px-3 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2">
            <p className="mr-auto min-w-0 text-xs text-muted-foreground" aria-live="polite">
              {blockers.length ? `Before it can run: ${blockers.join(' ')}` : 'Nothing is saved until you choose.'}
            </p>
            <Button variant="ghost" leadingIcon={<Save />} loading={busy === 'draft'} disabled={!!busy} onClick={() => void finish('draft')}>
              Save draft
            </Button>
            <Hint label="Runs the plan for real reads but simulates every change and approval">
              <Button variant="outline" leadingIcon={<FlaskConical />} loading={busy === 'test'} disabled={!!busy} onClick={() => void finish('test')}>
                Save &amp; test
              </Button>
            </Hint>
            {blueprint.trigger.kind === 'manual' ? (
              <Button leadingIcon={<Play />} loading={busy === 'run'} disabled={!!busy || blockers.length > 0} onClick={() => void finish('run')}>
                Save &amp; run now
              </Button>
            ) : (
              <Button leadingIcon={<Power />} loading={busy === 'activate'} disabled={!!busy || blockers.length > 0} onClick={() => void finish('activate')}>
                Save &amp; switch on
              </Button>
            )}
          </div>
        </footer>
      ) : null}
    </div>
  );
}

/** One honest status while the plan is drafted: it is a single model call. */
function Planning({ request }: { request: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Card className="space-y-4 p-5" aria-busy="true">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary motion-safe:animate-pulse" aria-hidden />
        <div className="min-w-0" role="status">
          <p className="text-sm font-semibold text-foreground">Planning with your workspace’s tools and connected apps…</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">“{request}” · {seconds}s</p>
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </Card>
  );
}
