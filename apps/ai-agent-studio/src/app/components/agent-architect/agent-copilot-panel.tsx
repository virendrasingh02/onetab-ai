import { agentArchitectApi, agentGraphsApi } from '@org/api-client';
import {
  applyGraphEdits,
  compileStudioGraph,
  describeCronExpression,
  describeFlowLine,
  diffStudioGraphs,
  explainStudioGraph,
  suggestNextActions,
  type ArchitectDiagnosisResult,
  type ArchitectOptimizeResult,
  type GraphEditOp,
  type StudioCanvasGraph,
  type StudioGraphIssue,
} from '@org/types';
import { Badge, Button, Switch, Textarea, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CircleAlert,
  ExternalLink,
  Gauge,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChangeList, FlowLine, IssueList, errorText, integrationsHref } from './architect-ui.js';

/** A proposed change waiting for Apply, or one already applied (and undoable). */
interface Proposal {
  graph: StudioCanvasGraph;
  changes: string[];
  issues: StudioGraphIssue[];
  flow: string;
  summary: string;
  state: 'pending' | 'applying' | 'applied' | 'discarded' | 'undone';
  version?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  notes?: string[];
  proposal?: Proposal;
  diagnosis?: ArchitectDiagnosisResult;
  optimization?: ArchitectOptimizeResult;
  /** Shows the "Open Integrations" link. */
  connect?: boolean;
  by?: string;
}

export interface AgentCopilotPanelProps {
  workspaceId: string;
  workspaceSlug: string;
  agentId: string;
  agentName: string;
  /** The canvas as it is now (may hold unsaved changes). */
  graph: StudioCanvasGraph;
  /** Puts a graph on the canvas, saves it and records a version. Returns the version number. */
  onApply: (graph: StudioCanvasGraph, summary: string) => Promise<number | undefined>;
  onRunTest: () => void;
  onClose: () => void;
  /** Opens with this greeting (an agent fresh from "Create with one prompt"). */
  welcome?: boolean;
  className?: string;
}

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

type Intent = 'explain' | 'debug' | 'optimize' | 'test' | 'permissions' | 'missing' | 'edit';

/** What kind of request it is — editing goes to the API, the rest is answered from the graph and its runs. */
function intentOf(text: string): Intent {
  const t = text.toLowerCase();
  if (/^(explain|how does|what does|walk me through|describe)\b|how (does )?(this|it) work/.test(t)) return 'explain';
  // A question about a failure — not a request that mentions one ("retry failed calls").
  if (/\b(why (did|does|is|was)|what went wrong|debug|find out why|(keeps|kept) failing|(is|it'?s) (broken|failing|not working)|last run fail\w*)\b/.test(t)) return 'debug';
  if (/\b(faster|optimi[sz]e|cheaper|reduce (cost|calls|tokens)|speed (it )?up|make (it|this) better|improve)\b/.test(t)) return 'optimize';
  if (/^(run (a )?test|test (it|this|the agent)|test)\b/.test(t)) return 'test';
  if (/\b(check permissions|what can (it|this agent) (do|access)|secure|security)\b/.test(t)) return 'permissions';
  if (/\b(what do i (still )?need|what'?s missing|still need to connect)\b/.test(t)) return 'missing';
  return 'edit';
}

function permissionSummary(graph: StudioCanvasGraph): string {
  const tools = graph.nodes.filter((n) => n.type === 'MCP_TOOL').map((n) => ({ label: n.data.label, tool: String(n.data.config?.['toolName'] ?? ''), app: n.data.config?.['needsConnection'] }));
  // A step waits for a person when an approval card gates it, or sits right before it.
  const gated = new Set(graph.nodes.filter((n) => n.type === 'USER_APPROVAL' && typeof n.data.config?.['gates'] === 'string').map((n) => String(n.data.config['gates'])));
  for (const e of graph.edges) {
    if (['USER_APPROVAL', 'HUMAN_REVIEW'].includes(graph.nodes.find((n) => n.id === e.source)?.type ?? '')) gated.add(e.target);
  }
  const agents = graph.nodes.filter((n) => ['AGENT', 'SUB_AGENT', 'AGENT_COORDINATOR'].includes(n.type));
  const lines: string[] = [];
  if (!tools.length && !agents.length) return 'It doesn’t use any tools yet.';
  for (const t of tools) {
    const id = graph.nodes.find((n) => n.data.label === t.label)?.id;
    lines.push(`• ${t.label}: ${t.tool || (t.app ? `waits for ${String(t.app)}` : 'no tool picked')}${id && gated.has(id) ? ' — only after your approval' : ''}`);
  }
  for (const a of agents) {
    const own = Array.isArray(a.data.config?.['tools']) ? (a.data.config['tools'] as string[]) : [];
    lines.push(`• ${a.data.label} (AI): ${own.length ? `may use ${own.join(', ')}` : 'no tools of its own — it only reads what earlier steps gathered'}`);
  }
  return `Here’s what it can do. Test runs read for real but never write; live runs act with the owner’s access, and the runtime refuses anything outside it.\n${lines.join('\n')}`;
}

/**
 * The Agent Copilot: change the agent in plain words, and ask it to explain,
 * debug, optimise or test. Every change is a proposal with its computed
 * diff; Apply saves it as a new version, Undo restores the one before.
 */
export function AgentCopilotPanel({
  workspaceId,
  workspaceSlug,
  agentId,
  agentName,
  graph,
  onApply,
  onRunTest,
  onClose,
  welcome,
  className,
}: AgentCopilotPanelProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: nextId(),
      role: 'assistant',
      text: welcome
        ? `I built ${agentName}. ${explainStudioGraph(graph)}`
        : `Tell me what to change — “add Slack notifications”, “run it every Monday at 9”, “add approval before sending”. I’ll show exactly what changes before anything is saved.`,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;

  const { data: runs = [] } = useQuery({
    queryKey: ['canvas-agent-runs', workspaceId, agentId],
    queryFn: () => agentGraphsApi.listRuns(workspaceId, agentId),
    staleTime: 15_000,
  });
  const { data: activation, refetch: refetchActivation } = useQuery({
    queryKey: ['canvas-agent-activation', workspaceId, agentId],
    queryFn: () => agentGraphsApi.activation(workspaceId, agentId),
    staleTime: 30_000,
  });
  const [switching, setSwitching] = useState(false);

  const suggestions = useMemo(
    () => suggestNextActions(graph, { hasRuns: runs.length > 0, lastRunFailed: runs[0]?.status === 'FAILED', knowledgeBases: 1 }),
    [graph, runs],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const say = (m: Omit<Message, 'id'>) => setMessages((list) => [...list, { ...m, id: nextId() }]);
  const updateProposal = (id: string, patch: Partial<Proposal>) =>
    setMessages((list) => list.map((m) => (m.id === id && m.proposal ? { ...m, proposal: { ...m.proposal, ...patch } } : m)));

  /** A proposal from ops computed here (diagnosis and optimisation fixes). */
  const proposeOps = (ops: GraphEditOp[], summary: string, intro: string) => {
    const before = graphRef.current;
    const { graph: next, errors } = applyGraphEdits(before, ops);
    const diff = diffStudioGraphs(before, next);
    say({
      role: 'assistant',
      text: intro,
      ...(errors.length ? { notes: errors } : {}),
      proposal: { graph: next, changes: diff.summary, issues: compileStudioGraph(next).issues, flow: describeFlowLine(next), summary, state: 'pending' },
    });
  };

  const handle = async (text: string) => {
    const command = text.trim();
    if (!command || busy) return;
    setInput('');
    say({ role: 'user', text: command });
    const intent = intentOf(command);
    const current = graphRef.current;
    const graphJson = JSON.stringify(current);
    try {
      switch (intent) {
        case 'explain': {
          say({ role: 'assistant', text: explainStudioGraph(current), notes: [`Workflow: ${describeFlowLine(current)}`] });
          return;
        }
        case 'test': {
          onRunTest();
          say({ role: 'assistant', text: 'I opened the run console. Test runs read real data but don’t send or change anything, and approvals are simulated.' });
          return;
        }
        case 'permissions': {
          say({ role: 'assistant', text: permissionSummary(current) });
          return;
        }
        case 'missing': {
          const waiting = current.nodes.filter((n) => n.data.config?.['needsConnection'] && !n.data.config?.['toolName']);
          const issues = compileStudioGraph(current).issues.filter((i) => i.level === 'error');
          say({
            role: 'assistant',
            text: issues.length ? `${issues.length === 1 ? 'One thing stops' : `${issues.length} things stop`} a live run:` : 'Nothing is missing — it can run live.',
            notes: issues.map((i) => i.message),
            connect: waiting.length > 0,
          });
          return;
        }
        case 'debug': {
          setBusy('Reading the last runs…');
          const diagnosis = await agentArchitectApi.diagnose(workspaceId, agentId, graphJson);
          say({ role: 'assistant', text: diagnosis.summary, diagnosis, connect: diagnosis.findings.some((f) => f.connect) });
          if (diagnosis.ops.length) proposeOps(diagnosis.ops, 'Retry the steps that failed temporarily', 'I can make the steps that failed temporarily retry on their own:');
          return;
        }
        case 'optimize': {
          setBusy('Looking for waste…');
          const optimization = await agentArchitectApi.optimize(workspaceId, agentId, graphJson);
          say({
            role: 'assistant',
            text: optimization.suggestions.length
              ? `It makes ${optimization.aiCalls} AI call${optimization.aiCalls === 1 ? '' : 's'} and ${optimization.toolCalls} tool call${optimization.toolCalls === 1 ? '' : 's'} per run. Here’s what I’d change:`
              : `It makes ${optimization.aiCalls} AI call${optimization.aiCalls === 1 ? '' : 's'} and ${optimization.toolCalls} tool call${optimization.toolCalls === 1 ? '' : 's'} per run, and I don’t see waste to remove.`,
            optimization,
          });
          return;
        }
        default: {
          setBusy('Working out the change…');
          const res = await agentArchitectApi.edit(workspaceId, { command, graphJson });
          const connect = res.notes.some((n) => /connect/i.test(n));
          if (!res.changedAnything) {
            say({ role: 'assistant', text: res.explanation || 'Nothing on the workflow needs to change for that.', notes: res.notes, connect });
            return;
          }
          say({
            role: 'assistant',
            text: res.explanation,
            notes: res.notes,
            connect,
            by: res.by === 'ai' ? `Worked out by ${res.model ?? 'AI'}` : undefined,
            proposal: { graph: res.graph, changes: res.changes, issues: res.issues, flow: res.flow, summary: command.slice(0, 200), state: 'pending' },
          });
        }
      }
    } catch (err) {
      say({ role: 'assistant', text: errorText(err, 'That didn’t work.'), notes: ['Nothing was changed.'] });
    } finally {
      setBusy(null);
    }
  };

  const undoGraphs = useRef(new Map<string, StudioCanvasGraph>());
  const apply = async (message: Message) => {
    if (!message.proposal) return;
    const previous = graphRef.current;
    updateProposal(message.id, { state: 'applying' });
    try {
      const version = await onApply(message.proposal.graph, message.proposal.summary);
      // Undo puts back exactly the graph that was there before.
      undoGraphs.current.set(message.id, previous);
      updateProposal(message.id, { state: 'applied', version });
      queryClient.invalidateQueries({ queryKey: ['canvas-agent-activation', workspaceId, agentId] });
    } catch (err) {
      updateProposal(message.id, { state: 'pending' });
      toast.error(errorText(err, 'The change couldn’t be saved.'));
    }
  };

  const undo = async (message: Message) => {
    const previous = undoGraphs.current.get(message.id);
    if (!previous || !message.proposal) return;
    updateProposal(message.id, { state: 'applying' });
    try {
      await onApply(previous, `Undid: ${message.proposal.summary}`.slice(0, 200));
      updateProposal(message.id, { state: 'undone' });
    } catch (err) {
      updateProposal(message.id, { state: 'applied' });
      toast.error(errorText(err, 'Undo couldn’t be saved.'));
    }
  };

  const toggleActivation = async (active: boolean) => {
    setSwitching(true);
    try {
      await agentGraphsApi.setActivation(workspaceId, agentId, active);
      await refetchActivation();
      toast.success(active ? 'It now runs on its schedule.' : 'Scheduled runs are off.');
    } catch (err) {
      say({ role: 'assistant', text: errorText(err, active ? 'It couldn’t be switched on.' : 'It couldn’t be switched off.') });
    } finally {
      setSwitching(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void handle(input);
  };

  const schedule = activation?.schedule;

  return (
    <aside
      aria-label="Agent Copilot"
      className={cn(
        'flex h-full w-full shrink-0 flex-col border-l border-border bg-surface shadow-lg sm:w-96',
        'max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Agent Copilot</h2>
            <p className="truncate text-[11px] text-muted-foreground">{graph.nodes.length} steps · {agentName}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close Copilot">
          <X />
        </Button>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised/40 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Runs on its own</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {schedule ? `${describeCronExpression(schedule.cron)}${schedule.timezone ? ` (${schedule.timezone})` : ''}` : 'No schedule — ask me to “run it every weekday at 9”'}
          </p>
        </div>
        <Switch
          checked={!!activation?.active}
          disabled={switching || (!activation?.active && !schedule)}
          onCheckedChange={(v) => void toggleActivation(v)}
          aria-label="Run on its schedule"
        />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[92%] space-y-2 rounded-xl px-3 py-2 text-xs leading-relaxed',
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground',
              )}
            >
              <p className="whitespace-pre-line">{m.text}</p>
              {m.by && <p className="text-[10px] text-muted-foreground">{m.by}</p>}
              {m.notes?.length ? (
                <ul className="space-y-0.5">
                  {m.notes.map((n, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground">• {n}</li>
                  ))}
                </ul>
              ) : null}
              {m.connect && (
                <Button size="xs" variant="outline" asChild>
                  <a href={integrationsHref(workspaceSlug)} target="_blank" rel="noreferrer">
                    Open Integrations <ExternalLink className="size-3" aria-hidden />
                  </a>
                </Button>
              )}

              {m.diagnosis && m.diagnosis.findings.length > 0 && (
                <ul className="space-y-1.5">
                  {m.diagnosis.findings.map((f, i) => (
                    <li key={i} className="rounded-lg border border-border bg-surface p-2">
                      <p className="flex items-center gap-1.5 font-medium">
                        <CircleAlert className="size-3 text-destructive-text" aria-hidden /> {f.step}
                        <Badge variant={f.retryable ? 'info' : 'warning'}>{f.retryable ? 'Retry is safe' : 'Needs a fix'}</Badge>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{f.message}</p>
                      <p className="text-[11px] text-foreground">{f.hint}</p>
                    </li>
                  ))}
                </ul>
              )}
              {m.diagnosis?.retrySafe && m.diagnosis.status === 'FAILED' && (
                <Button size="xs" variant="outline" onClick={onRunTest} className="gap-1">
                  <RotateCcw className="size-3" /> Retry in the run console
                </Button>
              )}

              {m.optimization && (
                <div className="space-y-1.5">
                  {m.optimization.runs.count > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Last {m.optimization.runs.count} runs: {Math.round((m.optimization.runs.failureRate ?? 0) * 100)}% failed
                      {m.optimization.runs.avgLatencyMs != null ? `, ${(m.optimization.runs.avgLatencyMs / 1000).toFixed(1)}s on average` : ''}
                      {m.optimization.runs.avgTokens != null ? `, ${Math.round(m.optimization.runs.avgTokens)} tokens` : ''}.
                    </p>
                  )}
                  {m.optimization.suggestions.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border bg-surface p-2">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">{s.detail}</p>
                      {s.ops && (
                        <Button size="xs" variant="outline" className="mt-1.5 gap-1" onClick={() => proposeOps(s.ops!, s.title, `Here’s “${s.title}”:`)}>
                          <Gauge className="size-3" /> Preview this change
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {m.proposal && (
                <div className="space-y-2 rounded-lg border border-border bg-surface p-2.5">
                  <ChangeList changes={m.proposal.changes} />
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">Workflow after</p>
                    <FlowLine flow={m.proposal.flow} />
                  </div>
                  <IssueList issues={m.proposal.issues.filter((i) => i.level === 'error')} />
                  {m.proposal.state === 'pending' && (
                    <div className="flex gap-1.5">
                      <Button size="xs" onClick={() => void apply(m)} className="gap-1">
                        <Check className="size-3" /> Apply
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => updateProposal(m.id, { state: 'discarded' })}>
                        Discard
                      </Button>
                    </div>
                  )}
                  {m.proposal.state === 'applying' && (
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" aria-hidden /> Saving…
                    </p>
                  )}
                  {m.proposal.state === 'applied' && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1 text-[11px] text-success-text">
                        <Check className="size-3" aria-hidden /> Applied{m.proposal.version ? ` · saved as version ${m.proposal.version}` : ''}
                      </p>
                      <Button size="xs" variant="ghost" onClick={() => void undo(m)} className="gap-1">
                        <RotateCcw className="size-3" /> Undo
                      </Button>
                    </div>
                  )}
                  {m.proposal.state === 'discarded' && <p className="text-[11px] text-muted-foreground">Discarded — nothing changed.</p>}
                  {m.proposal.state === 'undone' && <p className="text-[11px] text-muted-foreground">Undone — the previous workflow is back.</p>}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> {busy}
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <div className="flex flex-wrap gap-1" aria-label="Suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!!busy}
              onClick={() => void handle(s)}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="copilot-input" className="sr-only">Ask the Copilot</label>
          <Textarea
            id="copilot-input"
            rows={2}
            value={input}
            disabled={!!busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handle(input);
              }
            }}
            placeholder="Add Slack · Use Claude · Run every Monday at 9…"
            className="min-h-0 resize-none text-xs"
          />
          <div className="flex flex-col gap-1">
            <Button type="button" variant="ghost" size="icon-sm" onClick={onRunTest} aria-label="Run a test" title="Run a test">
              <Play />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => void handle('Why did the last run fail?')} aria-label="Debug the last run" title="Debug the last run" disabled={!!busy}>
              <Stethoscope />
            </Button>
          </div>
          <Button type="submit" size="icon" disabled={!input.trim() || !!busy} aria-label="Send">
            <Send />
          </Button>
        </form>
      </div>
    </aside>
  );
}
