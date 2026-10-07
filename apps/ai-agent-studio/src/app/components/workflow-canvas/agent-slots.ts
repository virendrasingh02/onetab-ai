import type { Connection, Edge, Node } from '@xyflow/react';
import { CATALOG_NODES, type CatalogNodeItem } from './node-library.js';

/**
 * Agent "slots": the named attachment points on an agent node (Prompt, LLM,
 * Embeddings, Tools, Sub-agents). Each slot is a source handle whose id is the
 * slot id; the agent's unnamed handle stays the normal "run the next step"
 * output, so graphs saved before slots existed keep their wiring.
 *
 * The Sub-agents slot makes multi-agent teams: an agent delegates to the agents
 * plugged into it, which can have their own slots (and teams) in turn. Teams
 * form a tree: no cycles, one supervisor per agent.
 */
export type AgentSlotId = 'prompt' | 'llm' | 'embedding' | 'tools' | 'agents';

export interface AgentSlotDef {
  id: AgentSlotId;
  label: string;
  hint: string;
  /** Prompt and LLM take one node; a new one replaces the old wire. */
  multiple: boolean;
  /** Node types this slot accepts (upper-case). */
  accepts: (type: string) => boolean;
}

const TOOL_TYPES = new Set(CATALOG_NODES.filter((n) => n.category === 'tools').map((n) => n.type));
const KNOWLEDGE_TYPES = new Set(CATALOG_NODES.filter((n) => n.category === 'knowledge').map((n) => n.type));

export const AGENT_SLOTS: AgentSlotDef[] = [
  {
    id: 'prompt',
    label: 'Prompt',
    hint: 'System prompt the agent follows',
    multiple: false,
    accepts: (t) => t === 'PROMPT_TEMPLATE',
  },
  {
    id: 'llm',
    label: 'LLM',
    hint: 'Model the agent reasons with',
    multiple: false,
    accepts: (t) => t === 'AI_CHAT_MODEL' || t === 'MODEL_ROUTER' || t === 'LLM_ROUTER',
  },
  {
    id: 'embedding',
    label: 'Embeddings',
    hint: 'Knowledge the agent can retrieve from',
    multiple: true,
    accepts: (t) => KNOWLEDGE_TYPES.has(t) || t === 'VECTOR_SEARCH' || t === 'KNOWLEDGE_RETRIEVAL',
  },
  {
    id: 'tools',
    label: 'Tools',
    hint: 'Actions the agent may call',
    multiple: true,
    accepts: (t) => TOOL_TYPES.has(t) || t === 'TOOL' || t === 'MCP' || t === 'GITHUB_ACTION' || t === 'EMAIL_SEND',
  },
  {
    id: 'agents',
    label: 'Sub-agents',
    hint: 'Agents this one delegates work to',
    multiple: true,
    accepts: (t) => SLOT_HOSTS.has(t),
  },
];

const SLOT_BY_ID = new Map(AGENT_SLOTS.map((s) => [s.id, s]));

/** Node types that render slot rows (other AI nodes keep a single output). */
const SLOT_HOSTS = new Set(['AGENT', 'SUB_AGENT', 'AGENT_COORDINATOR']);

export const isSlotHost = (type: string | undefined) => SLOT_HOSTS.has((type || '').toUpperCase());

export const getSlot = (handle: string | null | undefined) =>
  handle ? SLOT_BY_ID.get(handle as AgentSlotId) : undefined;

/** Catalog entries that can be plugged into a slot, for its "+" menu. */
export function slotCatalog(slotId: AgentSlotId): CatalogNodeItem[] {
  const slot = SLOT_BY_ID.get(slotId);
  return slot ? CATALOG_NODES.filter((n) => slot.accepts(n.type)) : [];
}

/** True for an edge that attaches a node to an agent slot (drawn dashed, laid out beside the agent). */
export const isAttachmentEdge = (edge: Pick<Edge, 'sourceHandle'>) => Boolean(getSlot(edge.sourceHandle));

/**
 * Whether a drag-connection is allowed. Slot handles only accept compatible
 * node types; everything else connects freely.
 */
export function isValidSlotConnection(connection: Connection | Edge, nodes: Node[], edges: Edge[] = []): boolean {
  return slotConnectionError(connection, nodes, edges) === null;
}

/** Why a slot connection isn't allowed (for toasts), or null when it is. */
export function slotConnectionError(connection: Connection | Edge, nodes: Node[], edges: Edge[] = []): string | null {
  if (connection.source === connection.target) return 'A step can’t connect to itself';
  const slot = getSlot(connection.sourceHandle);
  if (!slot) return null;
  const target = nodes.find((n) => n.id === connection.target);
  if (!target || !slot.accepts((target.type || '').toUpperCase())) return `That step can’t go in ${slot.label}`;
  if (slot.id === 'agents') {
    const supervisor = supervisorOf(target.id, edges);
    if (supervisor && supervisor !== connection.source) return 'That agent already reports to another supervisor';
    if (teamOf(target.id, edges).has(connection.source)) {
      return 'That would make a loop: this agent already reports to that one';
    }
  }
  return null;
}

const isTeamEdge = (e: Pick<Edge, 'sourceHandle'>) => e.sourceHandle === 'agents';

/** The agent this one is a sub-agent of, if any. */
export function supervisorOf(agentId: string, edges: Edge[]): string | undefined {
  return edges.find((e) => isTeamEdge(e) && e.target === agentId)?.source;
}

/** Every agent below this one in its team (sub-agents, their sub-agents, ...). */
export function teamOf(agentId: string, edges: Edge[]): Set<string> {
  const seen = new Set<string>();
  const stack = [agentId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    for (const e of edges) {
      if (isTeamEdge(e) && e.source === id && !seen.has(e.target)) {
        seen.add(e.target);
        stack.push(e.target);
      }
    }
  }
  return seen;
}

/**
 * Applies a new connection, honouring single-node slots: wiring a second
 * Prompt / LLM replaces the previous wire instead of stacking.
 */
export function withSlotConnection(edges: Edge[], edge: Edge): Edge[] {
  const slot = getSlot(edge.sourceHandle);
  const kept =
    slot && !slot.multiple
      ? edges.filter((e) => !(e.source === edge.source && e.sourceHandle === edge.sourceHandle))
      : edges;
  if (kept.some((e) => e.source === edge.source && e.target === edge.target && e.sourceHandle === edge.sourceHandle)) {
    return kept;
  }
  return [...kept, edge];
}

/** Sibling order for layout: slot attachments first (in row order), then True, main output, False. */
export function handleOrder(handle: string | null | undefined): number {
  const slotIndex = AGENT_SLOTS.findIndex((s) => s.id === handle);
  if (slotIndex >= 0) return slotIndex - AGENT_SLOTS.length;
  return handle === 'true' ? 0 : handle === 'false' ? 2 : 1;
}

/** What is plugged into each slot of an agent, for the node's rows and the inspector. */
export function slotAttachments(agentId: string, nodes: Node[], edges: Edge[]): Record<AgentSlotId, Node[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const result: Record<AgentSlotId, Node[]> = { prompt: [], llm: [], embedding: [], tools: [], agents: [] };
  for (const e of edges) {
    if (e.source !== agentId) continue;
    const slot = getSlot(e.sourceHandle);
    const target = byId.get(e.target);
    if (slot && target) result[slot.id].push(target);
  }
  return result;
}

/**
 * Where a node newly attached to a slot goes: a column right of the agent,
 * below the attachments already there (auto layout tidies precisely later).
 */
export function attachmentPosition(agent: Node, nodes: Node[], edges: Edge[]): { x: number; y: number } {
  const width = agent.measured?.width ?? 280;
  const x = agent.position.x + width + 120;
  const attached = Object.values(slotAttachments(agent.id, nodes, edges)).flat();
  let y = Math.max(
    agent.position.y - 160,
    ...attached.map((n) => n.position.y + (n.measured?.height ?? 120) + GAP),
  );
  // Slide down past anything already in the way (e.g. the agent's next step)
  for (let guard = 0; guard < nodes.length; guard++) {
    const blocker = nodes.find((n) => overlaps(n, x, y));
    if (!blocker) break;
    y = blocker.position.y + (blocker.measured?.height ?? 120) + GAP;
  }
  return { x, y };
}

const GAP = 32;
/** Footprint reserved for a newly attached node before it has been measured. */
const NEW_NODE = { width: 260, height: 220 };

function overlaps(n: Node, x: number, y: number): boolean {
  const w = n.measured?.width ?? 240;
  const h = n.measured?.height ?? 120;
  return (
    x < n.position.x + w + GAP &&
    x + NEW_NODE.width + GAP > n.position.x &&
    y < n.position.y + h + GAP &&
    y + NEW_NODE.height + GAP > n.position.y
  );
}

export type DelegationMode = 'router' | 'sequential' | 'parallel' | 'review_loop';

export const DELEGATION_MODES: { value: DelegationMode; label: string; hint: string }[] = [
  { value: 'router', label: 'Router', hint: 'Picks the best sub-agent for each request' },
  { value: 'sequential', label: 'Sequential', hint: 'Hands work down the team in order' },
  { value: 'parallel', label: 'Parallel', hint: 'Runs every sub-agent and merges their answers' },
  { value: 'review_loop', label: 'Review', hint: 'Workers go in order, then the reviewer checks their work' },
];

export interface AgentTreeNode {
  agent: Node;
  attachments: Record<AgentSlotId, Node[]>;
  children: AgentTreeNode[];
  issues: string[];
}

/**
 * Agents arranged as teams: top-level agents (no supervisor) with their
 * sub-agents nested below, each with what's plugged into it and its setup issues.
 */
export function agentHierarchy(nodes: Node[], edges: Edge[]): AgentTreeNode[] {
  const seen = new Set<string>();
  const build = (agent: Node): AgentTreeNode => {
    seen.add(agent.id);
    const attachments = slotAttachments(agent.id, nodes, edges);
    return {
      agent,
      attachments,
      issues: agentIssues(agent, nodes, edges),
      children: attachments.agents.filter((a) => !seen.has(a.id)).map(build),
    };
  };
  return nodes.filter((n) => isSlotHost(n.type) && !supervisorOf(n.id, edges)).map(build);
}

const configOf = (n: Node | undefined) => (n?.data as { config?: Record<string, unknown> } | undefined)?.config ?? {};

/** The model an agent runs on: its LLM slot, its own setting, else its supervisor's (sub-agents inherit). */
export function resolveAgentModel(
  agentId: string,
  nodes: Node[],
  edges: Edge[],
): { model: string; inherited: boolean } | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  let id: string | undefined = agentId;
  while (id && !visited.has(id)) {
    visited.add(id);
    const llm = slotAttachments(id, nodes, edges).llm[0];
    const model = configOf(llm).model ?? configOf(byId.get(id)).model;
    if (typeof model === 'string' && model) return { model, inherited: id !== agentId };
    id = supervisorOf(id, edges);
  }
  return null;
}

/** Plain-language setup problems for one agent, shown on the node and in the outline. */
export function agentIssues(agent: Node, nodes: Node[], edges: Edge[]): string[] {
  const issues: string[] = [];
  const attached = slotAttachments(agent.id, nodes, edges);
  if (!resolveAgentModel(agent.id, nodes, edges)) issues.push('No model: plug in an LLM or pick one in settings');
  const prompt = attached.prompt[0];
  const promptText = String((prompt ? configOf(prompt).prompt : configOf(agent).instructions) ?? '').trim();
  if (!promptText) {
    issues.push(prompt ? 'The plugged-in prompt is empty' : 'No prompt: plug in a Prompt or write instructions');
  }
  if ((agent.type || '').toUpperCase() === 'AGENT_COORDINATOR' && attached.agents.length === 0) {
    issues.push('Supervisor has no sub-agents to delegate to');
  }
  return issues;
}

const isCollapsed = (n: Node | undefined) => Boolean((n?.data as { collapsed?: boolean } | undefined)?.collapsed);

/**
 * Nodes hidden because an agent above them is collapsed: everything plugged into
 * a collapsed agent and, through Sub-agents, everything below it.
 */
export function collapsedNodeIds(nodes: Node[], edges: Edge[]): Set<string> {
  const hidden = new Set<string>();
  const hideBelow = (agentId: string) => {
    for (const e of edges) {
      if (e.source !== agentId || !getSlot(e.sourceHandle) || hidden.has(e.target)) continue;
      hidden.add(e.target);
      hideBelow(e.target);
    }
  };
  for (const n of nodes) if (isSlotHost(n.type) && isCollapsed(n)) hideBelow(n.id);
  return hidden;
}

/** Collapsed agents above a node, outermost first: expand these to reveal it. */
export function collapsedAncestors(nodeId: string, nodes: Node[], edges: Edge[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: string[] = [];
  const visited = new Set<string>();
  let id: string | undefined = nodeId;
  while (id && !visited.has(id)) {
    visited.add(id);
    const current: string = id;
    const owner: string | undefined = edges.find((e) => e.target === current && getSlot(e.sourceHandle))?.source;
    if (owner && isCollapsed(byId.get(owner))) chain.unshift(owner);
    id = owner;
  }
  return chain;
}
