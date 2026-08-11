/**
 * The single owner of agent-builder state.
 *
 * The canvas, the palette, the inspector and the status bar all read and write
 * through this hook — no component keeps its own copy of a node's config, so a
 * field edited in the inspector repaints the card on the canvas, updates the
 * validation list and marks the draft dirty in one pass.
 *
 * Persistence is `localStorage`, the same stopgap the workspace registries use
 * until the agent endpoints exist.
 */

import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  coerceFieldValue,
  defaultConfigFor,
  specFor,
  type AgentNodeKind,
  type ConfigValue,
  type NodeConfig,
} from './agent-graph-model.js';

/* -------------------------------------------------------------- types ---- */

/**
 * React Flow requires node data to be assignable to `Record<string, unknown>`;
 * the intersection satisfies that without giving up the two fields we rely on.
 */
export type AgentNodeData = Record<string, unknown> & {
  kind: AgentNodeKind;
  config: NodeConfig;
};

export type AgentFlowNode = Node<AgentNodeData, AgentNodeKind>;

export interface AgentGraph {
  nodes: AgentFlowNode[];
  edges: Edge[];
}

export interface GraphIssue {
  id: string;
  severity: 'error' | 'warning';
  message: string;
  /** Set when the issue is attributable to one node, so it can be focused. */
  nodeId?: string;
}

/** The flattened view the inspector's summary tab renders. */
export interface AgentSummary {
  name: string;
  role: string;
  objective: string;
  autonomy: string;
  model: string | null;
  provider: string | null;
  promptLength: number;
  memory: string | null;
  tools: string[];
  knowledge: string[];
  triggers: string[];
  outputs: string[];
  guardrails: string[];
}

/* ------------------------------------------------------------ storage ---- */

const STORAGE_KEY = 'onetab_agent_graph_v1';
const STORAGE_EVENT = 'onetab_agent_graph_updated';

/* Handle ids. The spine and the capability wiring use different sockets so a
   capability can never be dropped into the trigger → agent → output chain. */
export const HANDLE = {
  in: 'in',
  out: 'out',
  caps: 'caps',
  cap: 'cap',
} as const;

let idCounter = 0;

function nextId(kind: AgentNodeKind): string {
  idCounter += 1;
  return `${kind}-${Date.now().toString(36)}-${idCounter}`;
}

function makeNode(
  kind: AgentNodeKind,
  position: { x: number; y: number },
  overrides: NodeConfig = {},
  id = nextId(kind),
): AgentFlowNode {
  return {
    id,
    type: kind,
    position,
    data: { kind, config: { ...defaultConfigFor(kind), ...overrides } },
  };
}

const COLUMN = 280;
const CAPABILITY_ROW_Y = 0;
const SPINE_ROW_Y = 320;

function seedGraph(): AgentGraph {
  const nodes: AgentFlowNode[] = [
    makeNode('model', { x: 0, y: CAPABILITY_ROW_Y }, {}, 'seed-model'),
    makeNode('prompt', { x: COLUMN, y: CAPABILITY_ROW_Y }, {}, 'seed-prompt'),
    makeNode('memory', { x: COLUMN * 2, y: CAPABILITY_ROW_Y }, {}, 'seed-memory'),
    makeNode(
      'knowledge',
      { x: COLUMN * 3, y: CAPABILITY_ROW_Y },
      {},
      'seed-knowledge',
    ),
    makeNode(
      'tool',
      { x: COLUMN * 4, y: CAPABILITY_ROW_Y },
      { toolId: 'send_channel_message', permission: 'write' },
      'seed-tool',
    ),
    makeNode('trigger', { x: 0, y: SPINE_ROW_Y }, {}, 'seed-trigger'),
    makeNode('guardrail', { x: COLUMN, y: SPINE_ROW_Y }, {}, 'seed-guardrail'),
    makeNode('agent', { x: COLUMN * 2, y: SPINE_ROW_Y }, {}, 'seed-agent'),
    makeNode('output', { x: COLUMN * 3, y: SPINE_ROW_Y }, {}, 'seed-output'),
  ];

  const edges: Edge[] = [
    spineEdge('seed-trigger', 'seed-guardrail'),
    spineEdge('seed-guardrail', 'seed-agent'),
    spineEdge('seed-agent', 'seed-output'),
    capEdge('seed-model', 'seed-agent'),
    capEdge('seed-prompt', 'seed-agent'),
    capEdge('seed-memory', 'seed-agent'),
    capEdge('seed-knowledge', 'seed-agent'),
    capEdge('seed-tool', 'seed-agent'),
  ];

  return { nodes, edges };
}

/** The runtime chain: animated, because something actually flows along it. */
function spineEdge(source: string, target: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    sourceHandle: HANDLE.out,
    targetHandle: HANDLE.in,
    type: 'smoothstep',
    animated: true,
  };
}

/** Capability wiring: dashed and static — configuration, not flow. */
function capEdge(source: string, target: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    sourceHandle: HANDLE.cap,
    targetHandle: HANDLE.caps,
    type: 'smoothstep',
    style: { strokeDasharray: '4 4' },
  };
}

function readGraph(): AgentGraph {
  if (typeof window === 'undefined') return seedGraph();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedGraph();
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as AgentGraph).nodes) ||
      !Array.isArray((parsed as AgentGraph).edges)
    ) {
      return seedGraph();
    }
    /* An empty canvas is a state a user can reach deliberately, so unlike a
       malformed payload it is kept rather than replaced with the seed. */
    return parsed as AgentGraph;
  } catch {
    return seedGraph();
  }
}

/* --------------------------------------------------------- validation ---- */

function isBlank(value: ConfigValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Everything wrong with the draft, ordered errors-first.
 *
 * Runs on every keystroke, so it stays a single pass over the nodes plus a
 * walk backwards along the spine — no repeated graph traversals per rule.
 */
export function validateGraph(graph: AgentGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const { nodes, edges } = graph;

  const cores = nodes.filter((node) => node.data.kind === 'agent');
  const core = cores[0];

  if (cores.length === 0) {
    issues.push({
      id: 'no-core',
      severity: 'error',
      message: 'The graph has no agent core. Add one from the palette.',
    });
  } else if (cores.length > 1) {
    for (const extra of cores.slice(1)) {
      issues.push({
        id: `duplicate-core-${extra.id}`,
        severity: 'error',
        message: 'Only one agent core is allowed per graph.',
        nodeId: extra.id,
      });
    }
  }

  /* Required fields, per the kind's own spec. */
  for (const node of nodes) {
    const spec = specFor(node.data.kind);
    for (const field of spec.fields) {
      const required = 'required' in field && field.required;
      if (required && isBlank(node.data.config[field.key])) {
        issues.push({
          id: `blank-${node.id}-${field.key}`,
          severity: 'error',
          message: `${spec.label}: "${field.label}" is empty.`,
          nodeId: node.id,
        });
      }
    }
  }

  if (core) {
    const capabilityKinds = new Set(
      edges
        .filter((edge) => edge.target === core.id && edge.targetHandle === HANDLE.caps)
        .map((edge) => nodes.find((node) => node.id === edge.source)?.data.kind)
        .filter((kind): kind is AgentNodeKind => Boolean(kind)),
    );

    if (!capabilityKinds.has('model')) {
      issues.push({
        id: 'no-model',
        severity: 'error',
        message: 'No model is wired into the agent core — it cannot reason.',
        nodeId: core.id,
      });
    }
    if (!capabilityKinds.has('prompt')) {
      issues.push({
        id: 'no-prompt',
        severity: 'error',
        message: 'No instructions node is wired into the agent core.',
        nodeId: core.id,
      });
    }

    /* Walk backwards along the spine to see whether any trigger reaches the
       core, so a trigger behind a chain of guardrails still counts. */
    const reachedFromCore = new Set<string>([core.id]);
    const queue = [core.id];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const edge of edges) {
        if (edge.target !== current || edge.targetHandle !== HANDLE.in) continue;
        if (reachedFromCore.has(edge.source)) continue;
        reachedFromCore.add(edge.source);
        queue.push(edge.source);
      }
    }

    const hasTrigger = nodes.some(
      (node) => node.data.kind === 'trigger' && reachedFromCore.has(node.id),
    );
    if (!hasTrigger) {
      issues.push({
        id: 'no-trigger',
        severity: 'warning',
        message: 'Nothing triggers this agent — it can only be run by hand.',
        nodeId: core.id,
      });
    }

    const hasOutput = edges.some(
      (edge) => edge.source === core.id && edge.sourceHandle === HANDLE.out,
    );
    if (!hasOutput) {
      issues.push({
        id: 'no-output',
        severity: 'warning',
        message: 'The agent core delivers nowhere. Connect an output node.',
        nodeId: core.id,
      });
    }

    /* Autonomy and privilege have to be argued for together: a hands-off agent
       holding write access with no policy in front of it is the combination
       worth flagging, not either half on its own. */
    const privilegedTool = nodes.find(
      (node) =>
        node.data.kind === 'tool' &&
        node.data.config['permission'] !== 'read' &&
        node.data.config['requiresApproval'] !== true,
    );
    const hasGuardrail = nodes.some((node) => node.data.kind === 'guardrail');
    if (
      core.data.config['autonomy'] === 'autonomous' &&
      privilegedTool &&
      !hasGuardrail
    ) {
      issues.push({
        id: 'unguarded-autonomy',
        severity: 'warning',
        message:
          'A fully autonomous agent holds a write tool with no guardrail in front of it.',
        nodeId: privilegedTool.id,
      });
    }
  }

  /* Duplicate tools waste a call budget and make the permission set ambiguous. */
  const seenTools = new Map<string, string>();
  for (const node of nodes) {
    if (node.data.kind !== 'tool') continue;
    const toolId = String(node.data.config['toolId'] ?? '');
    if (seenTools.has(toolId)) {
      issues.push({
        id: `duplicate-tool-${node.id}`,
        severity: 'warning',
        message: `"${toolId}" is granted twice.`,
        nodeId: node.id,
      });
    } else {
      seenTools.set(toolId, node.id);
    }
  }

  /* Orphans: placed but wired to nothing, so they do not affect a run. */
  for (const node of nodes) {
    const connected = edges.some(
      (edge) => edge.source === node.id || edge.target === node.id,
    );
    if (!connected) {
      issues.push({
        id: `orphan-${node.id}`,
        severity: 'warning',
        message: `${specFor(node.data.kind).label} is not connected to anything.`,
        nodeId: node.id,
      });
    }
  }

  return issues.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
  );
}

/** Flatten the graph into the record the summary tab and the save action read. */
export function summarise(graph: AgentGraph): AgentSummary {
  const byKind = (kind: AgentNodeKind) =>
    graph.nodes.filter((node) => node.data.kind === kind);

  const core = byKind('agent')[0];
  const model = byKind('model')[0];
  const prompt = byKind('prompt')[0];
  const memory = byKind('memory')[0];

  const text = (node: AgentFlowNode | undefined, key: string) =>
    node ? String(node.data.config[key] ?? '') : null;

  return {
    name: text(core, 'name') ?? 'Untitled agent',
    role: text(core, 'role') ?? '—',
    objective: text(core, 'objective') ?? '',
    autonomy: text(core, 'autonomy') ?? 'supervised',
    model: text(model, 'model'),
    provider: text(model, 'provider'),
    promptLength: (text(prompt, 'systemPrompt') ?? '').length,
    memory: memory ? String(memory.data.config['strategy'] ?? '') : null,
    tools: byKind('tool').map((node) => String(node.data.config['toolId'] ?? '')),
    knowledge: byKind('knowledge').map((node) =>
      String(node.data.config['collection'] ?? ''),
    ),
    triggers: byKind('trigger').map(
      (node) =>
        `${node.data.config['type'] ?? ''}: ${node.data.config['expression'] ?? ''}`,
    ),
    outputs: byKind('output').map(
      (node) =>
        `${node.data.config['channel'] ?? ''} → ${node.data.config['target'] ?? ''}`,
    ),
    guardrails: byKind('guardrail').map((node) =>
      String(node.data.config['policy'] ?? ''),
    ),
  };
}

/* ------------------------------------------------------------- layout ---- */

/**
 * Re-file every node into the two-row shape the model documents: capabilities
 * along the top, the runtime spine along the bottom. Hand-dragged positions are
 * discarded, which is the point — it is the "I have lost the thread" button.
 */
export function tidyLayout(nodes: AgentFlowNode[]): AgentFlowNode[] {
  const SPINE_ORDER: AgentNodeKind[] = ['trigger', 'guardrail', 'agent', 'output'];
  const CAP_ORDER: AgentNodeKind[] = [
    'model',
    'prompt',
    'memory',
    'knowledge',
    'tool',
  ];

  let capColumn = 0;
  const spineColumns = new Map<AgentNodeKind, number>(
    SPINE_ORDER.map((kind, index) => [kind, index]),
  );
  const spineStacked = new Map<AgentNodeKind, number>();

  /* Order first so the columns come out in the documented sequence regardless
     of the order nodes happen to sit in the array. */
  const ordered = [...nodes].sort((a, b) => {
    const rank = (node: AgentFlowNode) => {
      const capIndex = CAP_ORDER.indexOf(node.data.kind);
      return capIndex >= 0 ? capIndex : 100 + SPINE_ORDER.indexOf(node.data.kind);
    };
    return rank(a) - rank(b);
  });

  return ordered.map((node) => {
    if (CAP_ORDER.includes(node.data.kind)) {
      const x = capColumn * COLUMN;
      capColumn += 1;
      return { ...node, position: { x, y: CAPABILITY_ROW_Y } };
    }

    const column = spineColumns.get(node.data.kind) ?? SPINE_ORDER.length;
    const stack = spineStacked.get(node.data.kind) ?? 0;
    spineStacked.set(node.data.kind, stack + 1);
    return {
      ...node,
      position: { x: column * COLUMN, y: SPINE_ROW_Y + stack * 150 },
    };
  });
}

/* --------------------------------------------------------------- hook ---- */

export function useAgentGraph() {
  /*
   * Read storage once. `useRef(readGraph())` would have re-parsed the saved
   * graph on every render — and this screen re-renders on every keystroke.
   */
  const initial = useRef<AgentGraph | null>(null);
  if (initial.current === null) initial.current = readGraph();

  const [nodes, setNodes, onNodesChange] = useNodesState<AgentFlowNode>(
    initial.current.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initial.current.edges,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.current.nodes.find((node) => node.data.kind === 'agent')?.id ?? null,
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /*
   * Dirtiness is derived from what would actually be written, not from node
   * identity: React Flow replaces the node array on selection and hover too,
   * and those must not make the draft claim it has unsaved changes.
   */
  const signature = useMemo(
    () =>
      JSON.stringify({
        nodes: nodes.map((node) => [
          node.id,
          node.type,
          Math.round(node.position.x),
          Math.round(node.position.y),
          node.data.config,
        ]),
        edges: edges.map((edge) => [
          edge.id,
          edge.source,
          edge.target,
          edge.sourceHandle,
          edge.targetHandle,
        ]),
      }),
    [nodes, edges],
  );

  /* Lazily seeded on first render, so a freshly loaded draft is not dirty. */
  const savedSignature = useRef<string | null>(null);
  if (savedSignature.current === null) savedSignature.current = signature;
  const dirty = signature !== savedSignature.current;

  const selected = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const graph = useMemo<AgentGraph>(() => ({ nodes, edges }), [nodes, edges]);
  const issues = useMemo(() => validateGraph(graph), [graph]);
  const summary = useMemo(() => summarise(graph), [graph]);

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.length - errorCount;

  /** Kinds already placed, so the palette can grey out the singletons. */
  const placedKinds = useMemo(
    () => new Set(nodes.map((node) => node.data.kind)),
    [nodes],
  );

  /**
   * Selection lives on the nodes themselves, because React Flow reads it from
   * there — `selectedId` is a mirror kept in step by `onSelectionChange`. Going
   * through here is what lets the issues list focus a node the user never
   * clicked.
   */
  const focusNode = useCallback(
    (nodeId: string | null) => {
      setNodes((current) =>
        current.map((node) =>
          node.selected === (node.id === nodeId)
            ? node
            : { ...node, selected: node.id === nodeId },
        ),
      );
      setSelectedId(nodeId);
    },
    [setNodes],
  );

  const addNode = useCallback(
    (kind: AgentNodeKind, position?: { x: number; y: number }) => {
      if (specFor(kind).singleton && nodes.some((node) => node.data.kind === kind)) {
        return null;
      }
      /* Without a drop position, fan new nodes out below the spine rather than
         stacking them all on the same pixel. */
      const fallback = {
        x: (nodes.length % 5) * COLUMN,
        y: SPINE_ROW_Y + 180 + Math.floor(nodes.length / 5) * 150,
      };
      const created = { ...makeNode(kind, position ?? fallback), selected: true };
      setNodes((current) => [
        ...current.map((node) => (node.selected ? { ...node, selected: false } : node)),
        created,
      ]);
      setSelectedId(created.id);
      return created;
    },
    [nodes, setNodes],
  );

  const updateField = useCallback(
    (nodeId: string, fieldKey: string, raw: unknown) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          const field = specFor(node.data.kind).fields.find(
            (candidate) => candidate.key === fieldKey,
          );
          if (!field) return node;
          return {
            ...node,
            data: {
              ...node.data,
              config: {
                ...node.data.config,
                [fieldKey]: coerceFieldValue(field, raw),
              },
            },
          };
        }),
      );
    },
    [setNodes],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );
      setSelectedId((current) => (current === nodeId ? null : current));
    },
    [setNodes, setEdges],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = nodes.find((node) => node.id === nodeId);
      if (!source || specFor(source.data.kind).singleton) return;

      const copy: AgentFlowNode = {
        ...source,
        id: nextId(source.data.kind),
        selected: true,
        /* Offset so the copy is visibly a second card rather than one that
           looks like it silently replaced the original. */
        position: { x: source.position.x + 40, y: source.position.y + 40 },
        data: { ...source.data, config: { ...source.data.config } },
      };

      setNodes((current) => [
        ...current.map((node) => (node.selected ? { ...node, selected: false } : node)),
        copy,
      ]);
      setSelectedId(copy.id);
    },
    [nodes, setNodes],
  );

  const connect = useCallback(
    (connection: Connection) => {
      const capability = connection.sourceHandle === HANDLE.cap;
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: !capability,
            ...(capability ? { style: { strokeDasharray: '4 4' } } : {}),
          },
          current,
        ),
      );
    },
    [setEdges],
  );

  /**
   * Capability sockets and spine sockets are deliberately incompatible, and a
   * pair may only be wired once — React Flow would otherwise happily stack
   * duplicate edges on top of each other.
   */
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (connection.source === connection.target) return false;
      const wantsCaps = connection.sourceHandle === HANDLE.cap;
      if (wantsCaps !== (connection.targetHandle === HANDLE.caps)) return false;
      return !edges.some(
        (edge) =>
          edge.source === connection.source && edge.target === connection.target,
      );
    },
    [edges],
  );

  const tidy = useCallback(() => setNodes(tidyLayout), [setNodes]);

  const reset = useCallback(() => {
    const fresh = seedGraph();
    const coreId = fresh.nodes.find((node) => node.data.kind === 'agent')?.id ?? null;
    setNodes(fresh.nodes.map((node) => ({ ...node, selected: node.id === coreId })));
    setEdges(fresh.edges);
    setSelectedId(coreId);
  }, [setNodes, setEdges]);

  const save = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
      window.dispatchEvent(new Event(STORAGE_EVENT));
      savedSignature.current = signature;
      setSavedAt(new Date());
    } catch {
      /* Quota or private mode — the draft stays dirty, which is the honest state. */
    }
  }, [nodes, edges, signature]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    connect,
    isValidConnection,
    selected,
    selectedId,
    setSelectedId,
    focusNode,
    addNode,
    updateField,
    removeNode,
    duplicateNode,
    placedKinds,
    issues,
    errorCount,
    warningCount,
    summary,
    tidy,
    reset,
    save,
    dirty,
    savedAt,
  };
}
