import { agentArchitectApi, agentGraphsApi, agentsApi } from '@org/api-client';
import {
  applyGraphEdits,
  compileStudioGraph,
  describeCronExpression,
  describeFlowLine,
  diffStudioGraphs,
  explainStudioGraph,
  suggestNextActions,
  type AgentArchitectSpec,
  type ArchitectDiagnosisResult,
  type ArchitectOptimizeResult,
  type GraphEditOp,
  type StudioCanvasGraph,
  type StudioGraphIssue,
} from '@org/types';
import { useSpeechToText } from '@org/hooks';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Switch,
  toast,
  Label,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  Check,
  CircleAlert,
  Copy,
  CornerDownRight,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Hammer,
  Wand2,
  Bot,
  ScanSearch,
  Lightbulb,
  ListChecks,
  Loader2,
  Mic,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Stethoscope,
  Workflow,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CanvasNodeStatus } from '../workflow-canvas/run-console-drawer.js';
import type { NodeRunResult } from '../workflow-canvas/node-chrome.js';
import { ChangeList, FlowLine, IssueList, errorText, integrationsHref } from './architect-ui.js';
import { CopilotReviewCard } from './copilot-review-card.js';
import { CopilotRunCard } from './copilot-run-card.js';
import { reviewWorkflow, type WorkflowReview } from './workflow-review.js';

/** A proposed change waiting for Apply, or one already applied (and undoable). */
interface Proposal {
  graph: StudioCanvasGraph;
  changes: string[];
  issues: StudioGraphIssue[];
  flow: string;
  summary: string;
  state: 'pending' | 'applying' | 'applied' | 'discarded' | 'undone';
  version?: number;
  /** A whole new workflow from Create — Apply replaces the canvas, or it can become its own agent. */
  rebuild?: { spec: AgentArchitectSpec; savedAgentId?: string };
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
  /** A run started from the chat, followed live in the reply. */
  run?: { runId: string; mode: 'test' | 'live' };
  /** A full check of every step and wire. */
  review?: WorkflowReview;
}

/** What the composer does with what's typed. */
type ComposerMode = 'modify' | 'check' | 'test' | 'create';

const COMPOSER_MODES: { id: ComposerMode; label: string; placeholder: string; Icon: typeof Play }[] = [
  { id: 'modify', label: 'Modify', placeholder: 'Describe a change — “add Slack”, “run every Monday at 9”…', Icon: Wand2 },
  { id: 'check', label: 'Check', placeholder: 'Checks every step, connection and setting — just press Check', Icon: ScanSearch },
  { id: 'test', label: 'Test', placeholder: 'What should the agent get? Empty runs it as-is', Icon: Play },
  { id: 'create', label: 'Create', placeholder: 'Describe the agent to build from scratch…', Icon: Hammer },
];

export interface AgentCopilotPanelProps {
  workspaceId: string;
  workspaceSlug: string;
  agentId: string;
  agentName: string;
  /** The canvas as it is now (may hold unsaved changes). */
  graph: StudioCanvasGraph;
  /** Puts a graph on the canvas, saves it and records a version. Returns the version number. */
  onApply: (graph: StudioCanvasGraph, summary: string) => Promise<number | undefined>;
  /** Opens the full run console. */
  onRunTest: () => void;
  /** Frames a step on the canvas. */
  onFocusNode?: (nodeId: string) => void;
  /** Saves unsaved canvas changes: a run uses the saved graph. */
  onBeforeRun: () => Promise<void>;
  /** Live step states for the canvas while a chat run goes (null clears them). */
  onNodeStatuses?: (statuses: Record<string, CanvasNodeStatus> | null) => void;
  onNodeResults?: (results: Record<string, NodeRunResult>) => void;
  onClose: () => void;
  /** Opens with this greeting (an agent fresh from "Create with one prompt"). */
  welcome?: boolean;
  className?: string;
}

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

type Intent = 'explain' | 'debug' | 'optimize' | 'test' | 'permissions' | 'missing' | 'check' | 'create' | 'edit';

/** What kind of request it is — editing goes to the API, the rest is answered from the graph and its runs. */
function intentOf(text: string): Intent {
  const t = text.toLowerCase();
  if (/^(build|create|make|design|start over with|rebuild)( me)? (an? |the )?(new |whole |fresh )?(agent|workflow|flow)\b/.test(t)) return 'create';
  if (/^(explain|how does|what does|walk me through|describe)\b|how (does )?(this|it) work/.test(t)) return 'explain';
  // A question about a failure — not a request that mentions one ("retry failed calls").
  if (/\b(why (did|does|is|was)|what went wrong|debug|find out why|(keeps|kept) failing|(is|it'?s) (broken|failing|not working)|last run fail\w*)\b/.test(t)) return 'debug';
  if (/\b(faster|optimi[sz]e|cheaper|reduce (cost|calls|tokens)|speed (it )?up|make (it|this) better|improve)\b/.test(t)) return 'optimize';
  if (/^(run (a )?test|test (it|this|the agent)|test)\b/.test(t)) return 'test';
  if (/\b(check permissions|what can (it|this agent) (do|access)|secure|security)\b/.test(t)) return 'permissions';
  if (/\b(what do i (still )?need|what'?s missing|still need to connect)\b/.test(t)) return 'missing';
  if (/^(check|review|audit|validate|inspect)\b|\b(health ?check|is (it|everything|this) (ok|okay|working|connected|set up)|any (issues|problems|errors)|what'?s wrong)\b/.test(t)) return 'check';
  return 'edit';
}

/** "test it with: refund for order 42" → "refund for order 42"; a bare "run a test" → "". */
function testInputOf(text: string): string {
  const m = text.match(/\b(?:with|using|on|input)\s*[:\-–]?\s*(.+)$/is) ?? text.match(/:\s*(.+)$/s);
  return m ? m[1].trim().replace(/^["“'](.*)["”']$/s, '$1') : '';
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

/** A reply as plain text — what Copy and Download hand over. */
function messageToText(m: Message): string {
  const parts = [m.text];
  if (m.notes?.length) parts.push(m.notes.map((n) => `• ${n}`).join('\n'));
  if (m.diagnosis?.findings.length) {
    parts.push(m.diagnosis.findings.map((f) => `• ${f.step}: ${f.message}\n  ${f.hint}`).join('\n'));
  }
  if (m.optimization?.suggestions.length) {
    parts.push(m.optimization.suggestions.map((s) => `• ${s.title} — ${s.detail}`).join('\n'));
  }
  if (m.proposal) {
    parts.push(`Changes:\n${m.proposal.changes.map((c) => `• ${c}`).join('\n')}`);
    parts.push(`Workflow after: ${m.proposal.flow}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** "Save as PDF" through the browser's own print dialog — no PDF library needed. */
function printAsPdf(title: string, text: string): boolean {
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return false;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>body{font:14px/1.6 system-ui,sans-serif;margin:40px;color:#111}h1{font-size:18px;margin:0 0 16px}pre{white-space:pre-wrap;font:inherit}</style>` +
      `</head><body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(text)}</pre></body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
  return true;
}

/** Shortcuts behind the composer's "+": each is a real Copilot request. */
const QUICK_ACTIONS: { label: string; prompt: string; Icon: typeof Play }[] = [
  { label: 'Explain this workflow', prompt: 'Explain how this works', Icon: Lightbulb },
  { label: 'Debug the last run', prompt: 'Why did the last run fail?', Icon: Stethoscope },
  { label: 'Make it faster or cheaper', prompt: 'Optimize it', Icon: Gauge },
  { label: 'Check permissions', prompt: 'Check permissions', Icon: ShieldCheck },
  { label: 'What’s still missing?', prompt: 'What do I still need to connect?', Icon: ListChecks },
];

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
  onFocusNode,
  onBeforeRun,
  onNodeStatuses,
  onNodeResults,
  onClose,
  welcome,
  className,
}: AgentCopilotPanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<ComposerMode>('modify');
  const greeting = (built: boolean): Message => ({
    id: nextId(),
    role: 'assistant',
    text: built
      ? `I built ${agentName}. ${explainStudioGraph(graph)}`
      : `Everything happens right here:\n• Modify — “add Slack notifications”, “run it every Monday at 9”\n• Check — I go through every step, connection and setting, and suggest what to add\n• Test — run it with any input and watch each step\n• Create — describe an agent and I’ll build the whole workflow\nNothing is saved until you Apply.`,
  });
  const [messages, setMessages] = useState<Message[]>(() => [greeting(!!welcome)]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useSpeechToText();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const labels = useMemo(() => new Map(graph.nodes.map((n) => [n.id, String(n.data.label || n.type)])), [graph]);
  // The newest chat run is the one lit up on the canvas
  const latestRunMessageId = [...messages].reverse().find((m) => m.run)?.id;
  const [savingAgent, setSavingAgent] = useState<string | null>(null);

  // Clear the canvas highlights when the Copilot closes
  useEffect(() => () => onNodeStatuses?.(null), [onNodeStatuses]);

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

  // Dictated words land in the box when the mic stops, for review before sending
  useEffect(() => {
    if (dictation.listening || !dictation.finalText) return;
    setInput((cur) => `${cur}${cur && !cur.endsWith(' ') ? ' ' : ''}${dictation.finalText}`);
    dictation.reset();
    inputRef.current?.focus();
  }, [dictation.listening, dictation.finalText, dictation]);

  // The box grows with what's typed, up to a few lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input, dictation.interimText]);

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

  /** Saves, checks and starts a test run; the reply then follows it live. */
  const runTest = async (message: string) => {
    setBusy('Saving and checking the workflow…');
    await onBeforeRun();
    const check = await agentGraphsApi.validate(workspaceId, agentId);
    const blocking = check.issues.filter((i) => i.level === 'error');
    if (!check.valid || blocking.length) {
      say({
        role: 'assistant',
        text: `It can’t run yet — ${blocking.length === 1 ? 'one thing needs' : `${blocking.length} things need`} fixing first:`,
        notes: blocking.map((i) => (i.nodeId && labels.get(i.nodeId) ? `${labels.get(i.nodeId)}: ${i.message}` : i.message)),
        connect: blocking.some((i) => /connect/i.test(i.message)),
      });
      return;
    }
    setBusy('Starting the run…');
    const started = await agentGraphsApi.run(workspaceId, agentId, { mode: 'test', ...(message ? { message } : {}) });
    say({
      role: 'assistant',
      text: message
        ? `Testing with “${message}”. Test runs read real data but never send or change anything.`
        : 'Testing it as it is. Test runs read real data but never send or change anything.',
      run: { runId: started.runId, mode: 'test' },
    });
  };

  /** Checks every step, wire and setting — locally and with the server's own validator. */
  const checkWorkflow = async (focus: string) => {
    setBusy('Checking every step and connection…');
    const current = graphRef.current;
    let serverIssues: StudioGraphIssue[] = [];
    let serverChecked = true;
    try {
      serverIssues = (await agentGraphsApi.validate(workspaceId, agentId, JSON.stringify(current))).issues;
    } catch {
      serverChecked = false;
    }
    const review = reviewWorkflow(current, serverIssues);
    const { error, warning } = review.counts;
    say({
      role: 'assistant',
      text:
        error + warning === 0
          ? `I checked all ${review.steps.length} steps: each one is set up, connected on the right path and reachable from the trigger.`
          : `I checked all ${review.steps.length} steps. ${error ? `${error} problem${error === 1 ? '' : 's'} will stop or break a run` : 'Nothing blocks a run'}${warning ? `, and ${warning} thing${warning === 1 ? '' : 's'} could go wrong` : ''}. Fix any of them from here.`,
      notes: [
        ...(focus ? [`You asked about: ${focus}`] : []),
        ...(serverChecked ? [] : ['The server check couldn’t be reached — this covers the canvas only.']),
      ],
      review,
    });
  };

  /** Plans a whole workflow from a description, as a proposal that replaces the canvas. */
  const createFromScratch = async (prompt: string) => {
    setBusy('Planning the workflow — this can take a minute…');
    const res = await agentArchitectApi.understand(workspaceId, { prompt });
    const diff = diffStudioGraphs(graphRef.current, res.graph);
    const missing = res.spec.missingConfiguration.filter((m) => m.required).map((m) => `${m.title} — ${m.detail}`);
    say({
      role: 'assistant',
      text: `Here’s “${res.spec.agent.name}”: ${res.spec.agent.description}\nApply puts it on this canvas, or save it as a separate agent.`,
      notes: missing.length ? [`Before a live run: ${missing.join('; ')}`] : undefined,
      connect: res.spec.missingConfiguration.some((m) => m.kind === 'connection' || !!m.provider),
      by: res.plannedBy === 'ai' ? `Planned by ${res.model ?? 'AI'} in ${(res.durationMs / 1000).toFixed(0)}s` : 'Planned from a template',
      proposal: {
        graph: res.graph,
        changes: diff.summary,
        issues: res.issues,
        flow: res.flow,
        summary: `Rebuilt: ${prompt}`.slice(0, 200),
        state: 'pending',
        rebuild: { spec: res.spec },
      },
    });
  };

  /** A failed chat run offers the diagnosis right away. */
  const onRunSettled = useCallback((run: { status: string }) => {
    if (run.status.toUpperCase() !== 'FAILED') return;
    setMessages((list) => [
      ...list,
      { id: nextId(), role: 'assistant', text: 'That run failed. Ask “why did the last run fail?” and I’ll read it and suggest a fix.' },
    ]);
  }, []);

  /** Saves a Create proposal as its own agent instead of replacing this one. */
  const saveAsNewAgent = async (message: Message) => {
    const p = message.proposal;
    if (!p?.rebuild) return;
    const { spec } = p.rebuild;
    setSavingAgent(message.id);
    try {
      const created = await agentsApi.create(workspaceId, {
        name: spec.agent.name,
        role: `${spec.agent.category} agent`,
        description: spec.agent.description,
        systemPrompt: spec.agent.instructions,
        graphJson: JSON.stringify(p.graph),
        configuration: {
          category: spec.agent.category,
          icon: spec.agent.icon,
          tags: spec.agent.tags,
          lifecycle: 'draft',
          architect: { spec, prompt: p.summary.replace(/^Rebuilt: /, ''), createdAt: new Date().toISOString() },
        },
      });
      queryClient.invalidateQueries({ queryKey: ['agents', workspaceId] });
      updateProposal(message.id, { rebuild: { spec, savedAgentId: created.id } });
      toast.success(`${spec.agent.name} created.`, {
        action: { label: 'Open', onClick: () => navigate(`/agents/${created.id}?copilot=1`) },
      });
    } catch (err) {
      toast.error(errorText(err, 'The agent couldn’t be created.'));
    } finally {
      setSavingAgent(null);
    }
  };

  const handle = async (text: string, as: ComposerMode = 'modify') => {
    const command = text.trim();
    if (busy) return;
    // An empty Test still runs, and an empty Check checks everything
    if (!command && as !== 'test' && as !== 'check') return;
    setInput('');
    say({
      role: 'user',
      text:
        as === 'test' ? (command ? `Test with: ${command}` : 'Run a test')
        : as === 'create' ? `Create: ${command}`
        : as === 'check' ? (command ? `Check: ${command}` : 'Check every step')
        : command,
    });
    const intent: Intent = as === 'modify' ? intentOf(command) : as;
    const current = graphRef.current;
    const graphJson = JSON.stringify(current);
    try {
      switch (intent) {
        case 'explain': {
          say({ role: 'assistant', text: explainStudioGraph(current), notes: [`Workflow: ${describeFlowLine(current)}`] });
          return;
        }
        case 'test': {
          await runTest(as === 'test' ? command : testInputOf(command));
          return;
        }
        case 'create': {
          await createFromScratch(command);
          return;
        }
        case 'check': {
          await checkWorkflow(as === 'check' ? command : '');
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
      toast.success(
        active
          ? activation?.appTrigger
            ? `It now starts on ${activation.appTrigger.label}.`
            : 'It now runs on its schedule.'
          : 'It no longer runs by itself.',
      );
    } catch (err) {
      say({ role: 'assistant', text: errorText(err, active ? 'It couldn’t be switched on.' : 'It couldn’t be switched off.') });
    } finally {
      setSwitching(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dictation.listening) dictation.stop();
    void handle(input, mode);
  };

  const newChat = () => {
    if (busy) return;
    dictation.stop();
    undoGraphs.current.clear();
    setInput('');
    setMessages([greeting(false)]);
  };

  const copyMessage = async (m: Message) => {
    try {
      await navigator.clipboard.writeText(messageToText(m));
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1500);
    } catch {
      toast.error('Couldn’t copy — your browser blocked the clipboard.');
    }
  };

  const exportName = `${agentName.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'agent'}-copilot`;
  const downloadMessage = (m: Message, format: 'txt' | 'md' | 'pdf') => {
    const text = messageToText(m);
    if (format === 'pdf') {
      if (!printAsPdf(`${agentName} — Copilot`, text)) toast.error('Allow pop-ups to save as PDF.');
      return;
    }
    downloadText(`${exportName}.${format}`, format === 'md' ? `# ${agentName} — Copilot\n\n${text}\n` : text, format === 'md' ? 'text/markdown' : 'text/plain');
  };

  const schedule = activation?.schedule;
  const appTrigger = activation?.appTrigger ?? null;
  const runsOnItsOwnText = appTrigger
    ? appTrigger.lastError
      ? appTrigger.lastError
      : activation?.active
        ? `On ${appTrigger.label}${appTrigger.lastPolledAt ? ` · checked ${new Date(appTrigger.lastPolledAt).toLocaleTimeString()}` : ' · first check within 2 min'}`
        : `On ${appTrigger.label}`
    : schedule
      ? `${describeCronExpression(schedule.cron)}${schedule.timezone ? ` (${schedule.timezone})` : ''}`
      : 'No schedule or app event — ask me to “run it every weekday at 9”';

  const last = messages[messages.length - 1];
  const showSuggestions = !busy && last?.role === 'assistant' && last.proposal?.state !== 'pending' && suggestions.length > 0;
  const composerValue = dictation.listening
    ? `${input}${input && dictation.interimText ? ' ' : ''}${dictation.finalText}${dictation.finalText && dictation.interimText ? ' ' : ''}${dictation.interimText}`
    : input;

  const iconBtn = 'rounded-md';

  return (
    <aside
      aria-label="Agent Copilot"
      className={cn(
        'flex h-full w-full shrink-0 flex-col border-l border-border bg-surface shadow-lg sm:w-[400px]',
        'max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40',
        className,
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">Agent Copilot</h2>
            <p className="truncate text-[11px] text-muted-foreground">{graph.nodes.length} steps · {agentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" type="button" onClick={newChat} disabled={!!busy} className={iconBtn} aria-label="New chat" title="New chat">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" type="button" onClick={onClose} className={iconBtn} aria-label="Close Copilot" title="Close">
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* Runs on its own */}
      <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised/40 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Runs on its own</p>
          <p className={cn('truncate text-[11px]', appTrigger?.lastError ? 'text-warning-text' : 'text-muted-foreground')} title={runsOnItsOwnText}>
            {runsOnItsOwnText}
          </p>
        </div>
        <Switch
          checked={!!activation?.active}
          disabled={switching || (!activation?.active && !schedule && !appTrigger)}
          onCheckedChange={(v) => void toggleActivation(v)}
          aria-label={appTrigger ? 'Start on the app event' : 'Run on its schedule'}
        />
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md border border-border bg-surface-raised px-3.5 py-2 text-[13px] leading-relaxed text-foreground">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="group/msg space-y-2.5 text-[13px] leading-relaxed text-foreground">
              <p className="whitespace-pre-line">{m.text}</p>
              {m.by && <p className="text-[11px] text-muted-foreground">{m.by}</p>}
              {m.notes?.length ? (
                <ul className="space-y-1">
                  {m.notes.map((n, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                      {n}
                    </li>
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
                <ul className="space-y-2">
                  {m.diagnosis.findings.map((f, i) => (
                    <li key={i} className="space-y-1 rounded-xl border border-border bg-background p-3">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                        <CircleAlert className="size-3.5 text-destructive-text" aria-hidden /> {f.step}
                        <Badge variant={f.retryable ? 'info' : 'warning'}>{f.retryable ? 'Retry is safe' : 'Needs a fix'}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">{f.message}</p>
                      <p className="text-xs text-foreground">{f.hint}</p>
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
                <div className="space-y-2">
                  {m.optimization.runs.count > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Last {m.optimization.runs.count} runs: {Math.round((m.optimization.runs.failureRate ?? 0) * 100)}% failed
                      {m.optimization.runs.avgLatencyMs != null ? `, ${(m.optimization.runs.avgLatencyMs / 1000).toFixed(1)}s on average` : ''}
                      {m.optimization.runs.avgTokens != null ? `, ${Math.round(m.optimization.runs.avgTokens)} tokens` : ''}.
                    </p>
                  )}
                  {m.optimization.suggestions.map((s) => (
                    <div key={s.id} className="space-y-1 rounded-xl border border-border bg-background p-3">
                      <p className="text-xs font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.detail}</p>
                      {s.ops && (
                        <Button size="xs" variant="outline" className="mt-1 gap-1" onClick={() => proposeOps(s.ops!, s.title, `Here’s “${s.title}”:`)}>
                          <Gauge className="size-3" /> Preview this change
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* A proposed change, as a file-like card */}
              {m.proposal && (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-xl border border-border bg-background">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                        <Workflow className="size-3.5" aria-hidden /> proposed-change
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {m.proposal.changes.length} change{m.proposal.changes.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="max-h-64 space-y-3 overflow-y-auto p-3">
                      <ChangeList changes={m.proposal.changes} />
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">Workflow after</p>
                        <FlowLine flow={m.proposal.flow} />
                      </div>
                      <IssueList issues={m.proposal.issues.filter((i) => i.level === 'error')} />
                    </div>
                  </div>

                  {m.proposal.state === 'pending' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="xs" onClick={() => void apply(m)} className="gap-1">
                        <Check className="size-3" /> {m.proposal.rebuild ? 'Replace this canvas' : 'Apply'}
                      </Button>
                      {m.proposal.rebuild && !m.proposal.rebuild.savedAgentId && (
                        <Button size="xs" variant="outline" onClick={() => void saveAsNewAgent(m)} loading={savingAgent === m.id} className="gap-1">
                          <Bot className="size-3" /> Save as new agent
                        </Button>
                      )}
                      <Button size="xs" variant="ghost" onClick={() => updateProposal(m.id, { state: 'discarded' })}>
                        Discard
                      </Button>
                      {!m.proposal.rebuild && <span className="text-[11px] text-muted-foreground">Saves a new version you can undo</span>}
                    </div>
                  )}
                  {m.proposal.rebuild?.savedAgentId && (
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-success-text">
                      <Check className="size-3.5" aria-hidden /> Saved as {m.proposal.rebuild.spec.agent.name}
                      <Button
                        variant="link"
                        size="xs"
                        type="button"
                        onClick={() => navigate(`/agents/${m.proposal?.rebuild?.savedAgentId}?copilot=1`)}
                        className="h-auto gap-0.5 text-foreground"
                      >
                        Open it <ExternalLink className="size-3" aria-hidden />
                      </Button>
                    </p>
                  )}
                  {m.proposal.state === 'applying' && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" aria-hidden /> Saving…
                    </p>
                  )}
                  {m.proposal.state === 'applied' && (
                    <div className="flex items-center gap-2">
                      <p className="flex items-center gap-1 text-xs text-success-text">
                        <Check className="size-3.5" aria-hidden /> Applied{m.proposal.version ? ` · version ${m.proposal.version}` : ''}
                      </p>
                      <Button size="xs" variant="ghost" onClick={() => void undo(m)} className="gap-1">
                        <RotateCcw className="size-3" /> Undo
                      </Button>
                    </div>
                  )}
                  {m.proposal.state === 'discarded' && <p className="text-xs text-muted-foreground">Discarded — nothing changed.</p>}
                  {m.proposal.state === 'undone' && <p className="text-xs text-muted-foreground">Undone — the previous workflow is back.</p>}
                </div>
              )}

              {m.review && (
                <CopilotReviewCard review={m.review} onAsk={(p) => void handle(p)} onFocusStep={onFocusNode} disabled={!!busy} />
              )}

              {m.run && (
                <CopilotRunCard
                  workspaceId={workspaceId}
                  agentId={agentId}
                  runId={m.run.runId}
                  mode={m.run.mode}
                  labels={labels}
                  drivesCanvas={m.id === latestRunMessageId}
                  onNodeStatuses={onNodeStatuses}
                  onNodeResults={onNodeResults}
                  onOpenConsole={onRunTest}
                  onSettled={onRunSettled}
                />
              )}

              {/* Reply actions */}
              <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
                <Button variant="ghost" size="icon-sm" type="button" onClick={() => void copyMessage(m)} className={iconBtn} aria-label="Copy reply" title="Copy">
                  {copiedId === m.id ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" type="button" className={iconBtn} aria-label="Download reply" title="Download">
                      <Download className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="w-48">
                    <DropdownMenuLabel className="text-[11px] text-muted-foreground">Download as</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => downloadMessage(m, 'pdf')} className="gap-2 text-xs">
                      <FileText className="size-3.5" /> PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadMessage(m, 'md')} className="gap-2 text-xs">
                      <FileText className="size-3.5" /> Markdown (.md)
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadMessage(m, 'txt')} className="gap-2 text-xs">
                      <FileText className="size-3.5" /> Plain text (.txt)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ),
        )}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex gap-0.5" aria-hidden>
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            {busy}
          </p>
        )}

        {/* Follow-ups */}
        {showSuggestions && (
          <div className="flex flex-col items-end gap-2 pt-1" aria-label="Suggestions">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void handle(s)}
                className="group/sug inline-flex max-w-[90%] items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-left text-[13px] text-foreground transition-colors hover:border-border-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer"
              >
                <span>{s}</span>
                <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/sug:text-foreground" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-3 pb-2 pt-1">
        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-background transition-colors focus-within:border-primary/50"
        >
          <div role="radiogroup" aria-label="What to do" className="flex items-center gap-0.5 border-b border-border px-1.5 pt-1.5 pb-1">
            {COMPOSER_MODES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mode === id}
                onClick={() => {
                  setMode(id);
                  inputRef.current?.focus();
                }}
                className={cn(
                  'inline-flex h-6.5 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors cursor-pointer',
                  mode === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
                )}
              >
                <Icon className="size-3" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <Label htmlFor="copilot-input" className="sr-only">Ask the Copilot</Label>
          <Textarea id="copilot-input" ref={inputRef} rows={1} value={composerValue} readOnly={dictation.listening} disabled={!!busy} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (dictation.listening) dictation.stop();
                void handle(input, mode);
              }
            }} placeholder={dictation.listening ? 'Listening…' : COMPOSER_MODES.find((x) => x.id === mode)?.placeholder} className="max-h-40 min-h-11 resize-none text-[13px]" />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" type="button" disabled={!!busy} className={iconBtn} aria-label="Copilot actions" title="Copilot actions">
                    <Plus className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-56">
                  <DropdownMenuItem onSelect={() => void handle('', 'check')} className="gap-2 text-xs">
                    <ScanSearch className="size-3.5" /> Check every step
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handle('', 'test')} className="gap-2 text-xs">
                    <Play className="size-3.5" /> Run a test
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onRunTest} className="gap-2 text-xs">
                    <ExternalLink className="size-3.5" /> Open the full run console
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {QUICK_ACTIONS.map(({ label, prompt, Icon }) => (
                    <DropdownMenuItem key={label} onSelect={() => void handle(prompt)} className="gap-2 text-xs">
                      <Icon className="size-3.5" /> {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span
                className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground"
                title="The Copilot reads the whole canvas, including unsaved changes"
              >
                <Workflow className="size-3" aria-hidden /> Entire workflow
              </span>
            </div>
            <div className="flex items-center gap-1">
              {dictation.supported && (
                <Button variant="ghost" size="icon-sm"
                  type="button"
                  onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                  disabled={!!busy}
                  className={cn(iconBtn, dictation.listening && 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive')}
                  aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
                  aria-pressed={dictation.listening}
                  title={dictation.listening ? 'Stop dictation' : 'Dictate'}
                >
                  {dictation.listening ? <Square className="size-3 fill-current" /> : <Mic className="size-4" />}
                </Button>
              )}
              <button
                type="submit"
                disabled={(mode !== 'test' && mode !== 'check' && !input.trim()) || !!busy}
                aria-label={mode === 'check' ? 'Check' : mode === 'test' ? 'Run test' : mode === 'create' ? 'Build it' : 'Send'}
                title={mode === 'check' ? 'Check every step (Enter)' : mode === 'test' ? 'Run test (Enter)' : mode === 'create' ? 'Build it (Enter)' : 'Send (Enter)'}
                className={cn(
                  'flex h-8 items-center justify-center gap-1 rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary-hover active:scale-95',
                  'disabled:bg-surface-raised disabled:text-muted-foreground disabled:shadow-none cursor-pointer disabled:cursor-not-allowed',
                  mode === 'modify' ? 'w-8' : 'px-3 text-xs font-semibold',
                )}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : mode === 'test' ? (
                  <>
                    <Play className="size-3.5 fill-current" /> Run
                  </>
                ) : mode === 'check' ? (
                  <>
                    <ScanSearch className="size-3.5" /> Check
                  </>
                ) : mode === 'create' ? (
                  <>
                    <Hammer className="size-3.5" /> Build
                  </>
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
          </div>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Copilot can make mistakes — every change waits for your Apply.
        </p>
      </div>
    </aside>
  );
}
