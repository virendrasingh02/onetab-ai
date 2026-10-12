import { compileStudioGraph, type StudioCanvasGraph, type StudioGraphIssue } from '@org/types';
import type { Node, Edge } from '@xyflow/react';
import { agentIssues, getSlot, isSlotHost } from '../workflow-canvas/agent-slots.js';

/**
 * A full check of an agent's workflow, for the Copilot's "Check": every step's
 * settings (the run compiler's own checks, plus the server's when given), how
 * the steps are wired — what never runs, what leads nowhere, which branch is
 * empty — and what would make it work better. Pure, so it is tested directly.
 */

export type CheckLevel = 'ok' | 'warning' | 'error';

export interface CheckProblem {
  level: 'error' | 'warning';
  message: string;
  /** What to ask the Copilot to fix it. */
  fix: string;
}

export interface StepCheck {
  id: string;
  label: string;
  type: string;
  level: CheckLevel;
  problems: CheckProblem[];
}

export interface ReviewSuggestion {
  title: string;
  detail: string;
  /** The Copilot request that adds it. */
  prompt: string;
}

export interface WorkflowReview {
  steps: StepCheck[];
  /** Problems with the workflow as a whole, not one step. */
  general: CheckProblem[];
  suggestions: ReviewSuggestion[];
  counts: { ok: number; warning: number; error: number };
  /** 100 = nothing to fix. */
  score: number;
}

const isTrigger = (t: string) => /^START$|TRIGGER/.test(t);
const isTerminal = (t: string) => /^(OUTPUT|END|RESPONSE|FINAL_OUTPUT)$/.test(t);
const isDecoration = (t: string) => /NOTE|STICKY|ANNOTATION|GROUP|STAGE|FRAME/.test(t);
const isOutward = (n: StudioCanvasGraph['nodes'][number]) =>
  ['SLACK_SEND', 'EMAIL_SEND', 'TEAMS_SEND_MESSAGE'].includes(n.type) ||
  /send|post|create|update|delete|reply|write/i.test(String(n.data.config?.['toolName'] ?? '')) ||
  !!n.data.config?.['needsConnection'];

export function reviewWorkflow(graph: StudioCanvasGraph, serverIssues: StudioGraphIssue[] = []): WorkflowReview {
  const nodes = graph.nodes.filter((n) => !isDecoration(n.type.toUpperCase()));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const labelOf = (id: string) => byId.get(id)?.data.label || byId.get(id)?.type || id;
  const problems = new Map<string, CheckProblem[]>(nodes.map((n) => [n.id, []]));
  const general: CheckProblem[] = [];
  const seen = new Set<string>();

  const add = (nodeId: string | undefined, level: 'error' | 'warning', message: string, fix?: string) => {
    const key = `${nodeId ?? ''}|${message.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    const problem = { level, message, fix: fix ?? (nodeId ? `Fix “${labelOf(nodeId)}”: ${message}` : `Fix this: ${message}`) };
    const list = nodeId ? problems.get(nodeId) : undefined;
    if (list) list.push(problem);
    else general.push(problem);
  };

  // 1. Each step's settings: what the run compiler and the server would refuse or skip
  for (const i of [...compileStudioGraph(graph).issues, ...serverIssues]) add(i.nodeId, i.level, i.message);

  // 2. Agents: a model and instructions to work from
  const xyNodes = nodes as unknown as Node[];
  const xyEdges = graph.edges as unknown as Edge[];
  for (const n of nodes) {
    if (!isSlotHost(n.type)) continue;
    const already = problems.get(n.id) ?? [];
    for (const msg of agentIssues(n as unknown as Node, xyNodes, xyEdges)) {
      // The compiler already says when there are no instructions
      if (/prompt/i.test(msg) && already.some((p) => /instruction|prompt/i.test(p.message))) continue;
      add(n.id, /^No model/.test(msg) ? 'warning' : 'error', msg);
    }
  }

  // 3. Wiring
  const flowEdges = graph.edges.filter((e) => !getSlot(e.sourceHandle) && byId.has(e.source) && byId.has(e.target));
  const attachments = new Set(graph.edges.filter((e) => getSlot(e.sourceHandle)).map((e) => e.target));
  const triggers = nodes.filter((n) => isTrigger(n.type.toUpperCase()));

  if (!triggers.length && nodes.length) {
    add(undefined, 'error', 'Nothing starts this agent — there is no trigger.', 'Add a manual trigger at the start of the workflow');
  }

  // What a run reaches from a trigger (attachments come along with their agent)
  const reached = new Set<string>();
  const queue = triggers.map((t) => t.id);
  while (queue.length) {
    const id = queue.shift() as string;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const e of graph.edges) if (e.source === id && byId.has(e.target)) queue.push(e.target);
  }
  if (triggers.length) {
    for (const n of nodes) {
      if (reached.has(n.id)) continue;
      add(
        n.id,
        'warning',
        attachments.has(n.id) ? 'Plugged into an agent that never runs.' : 'Not connected to the flow, so it never runs.',
        `Connect “${labelOf(n.id)}” into the flow where it belongs, or remove it`,
      );
    }
  }

  // What leads to an Output step, walking the flow backwards
  const terminals = nodes.filter((n) => isTerminal(n.type.toUpperCase()));
  if (terminals.length) {
    const leads = new Set<string>();
    const back = terminals.map((t) => t.id);
    while (back.length) {
      const id = back.shift() as string;
      if (leads.has(id)) continue;
      leads.add(id);
      for (const e of flowEdges) if (e.target === id) back.push(e.source);
    }
    for (const n of nodes) {
      if (leads.has(n.id) || attachments.has(n.id) || !reached.has(n.id)) continue;
      const outgoing = flowEdges.some((e) => e.source === n.id);
      add(
        n.id,
        'warning',
        outgoing ? 'Its path never reaches the Output step.' : 'Nothing comes after it, so its result goes nowhere.',
        `Connect “${labelOf(n.id)}” on to the next step or the Output`,
      );
    }
  }

  // If / Else with an empty side
  for (const n of nodes) {
    if (n.type.toUpperCase() !== 'IF_ELSE') continue;
    const handles = new Set(flowEdges.filter((e) => e.source === n.id).map((e) => e.sourceHandle ?? ''));
    for (const side of ['true', 'false'] as const) {
      if (!handles.has(side)) {
        add(n.id, 'warning', `The “${side}” branch goes nowhere — runs that take it just stop.`, `Connect the ${side} branch of “${labelOf(n.id)}” to a step`);
      }
    }
  }

  // 4. Results
  const steps: StepCheck[] = nodes.map((n) => {
    const list = problems.get(n.id) ?? [];
    return {
      id: n.id,
      label: n.data.label || n.type,
      type: n.type,
      level: list.some((p) => p.level === 'error') ? 'error' : list.length ? 'warning' : 'ok',
      problems: list,
    };
  });
  // Problems first, then the flow's own order
  const rank: Record<CheckLevel, number> = { error: 0, warning: 1, ok: 2 };
  steps.sort((a, b) => rank[a.level] - rank[b.level]);

  const all = [...general, ...steps.flatMap((s) => s.problems)];
  const errors = all.filter((p) => p.level === 'error').length;
  const warnings = all.length - errors;

  return {
    steps,
    general,
    suggestions: suggestImprovements(graph, nodes),
    counts: { ok: steps.filter((s) => s.level === 'ok').length, warning: warnings, error: errors },
    score: Math.max(0, 100 - errors * 20 - warnings * 6),
  };
}

/** What isn't there yet but would make it more reliable or more useful. */
function suggestImprovements(graph: StudioCanvasGraph, nodes: StudioCanvasGraph['nodes']): ReviewSuggestion[] {
  const types = new Set(nodes.map((n) => n.type.toUpperCase()));
  const agents = nodes.filter((n) => isSlotHost(n.type));
  const slotted = (slot: string) =>
    agents.some((a) => graph.edges.some((e) => e.source === a.id && e.sourceHandle === slot));
  const out: ReviewSuggestion[] = [];

  if (![...types].some(isTerminal) && nodes.length > 1) {
    out.push({ title: 'Add an Output step', detail: 'Every run then ends with one clear answer you can read and reuse.', prompt: 'Add an output step at the end' });
  }
  if (nodes.some(isOutward) && !types.has('USER_APPROVAL') && !types.has('HUMAN_REVIEW')) {
    out.push({ title: 'Approve before it sends', detail: 'It writes to other apps — a person checks each message or change first.', prompt: 'Add human approval before sending' });
  }
  if (nodes.some((n) => /TOOL|ACTION|SEND/.test(n.type.toUpperCase())) && !nodes.some((n) => Number(n.data.config?.['retries'] ?? 0) >= 2)) {
    out.push({ title: 'Retry failed app calls', detail: 'A slow or flaky app no longer fails the whole run.', prompt: 'Retry failed app calls 3 times' });
  }
  if (agents.length && !slotted('embedding') && !types.has('KB_SEARCH') && !types.has('KNOWLEDGE_RETRIEVAL')) {
    out.push({ title: 'Give it your knowledge', detail: 'Answers come from your own docs instead of the model’s memory.', prompt: 'Use our company knowledge base' });
  }
  if (agents.length && !slotted('tools') && !nodes.some((n) => /TOOL|ACTION/.test(n.type.toUpperCase()))) {
    out.push({ title: 'Let it act, not just answer', detail: 'Plug an app action into the agent’s Tools so it can look things up or do the work.', prompt: 'Add the app actions this agent needs as tools' });
  }
  if (![...types].some((t) => /^TRIGGER_(SCHEDULE|APP|WEBHOOK)/.test(t))) {
    out.push({ title: 'Run it on its own', detail: 'Start it on a schedule or when something happens in an app, not only by hand.', prompt: 'Run it every weekday at 9 AM' });
  }
  if (agents.length >= 2 && !types.has('AGENT_COORDINATOR')) {
    out.push({ title: 'Coordinate the agents', detail: 'A supervisor hands each part to the right agent and joins their answers.', prompt: 'Turn this into a multi-agent system' });
  }
  if (!nodes.some((n) => /NOTIFY|SLACK|EMAIL|TEAMS/.test(n.type.toUpperCase()))) {
    out.push({ title: 'Tell someone when it fails', detail: 'A failed run sends a message instead of failing quietly.', prompt: 'Notify me on Slack when a run fails' });
  }
  return out.slice(0, 5);
}
