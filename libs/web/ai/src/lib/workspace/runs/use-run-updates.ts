import { automationsApi, queryKeys } from '@org/api-client';
import { RealtimeEventType, useRealtime } from '@org/realtime';
import type { AIRunUpdatePayload, StudioGraphEdge, StudioGraphNode } from '@org/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Keeps every open run, agent and the Studio home current while agents run —
 * `WorkflowEngineService` broadcasts `ai.run.updated` when a step starts, when
 * it finishes and when the run ends, so nothing has to refresh the page.
 * Mounted once per AI screen; the run queries keep a slow poll as a fallback
 * for when the realtime connection is down.
 */
export function useAIRunUpdates(workspaceId: string | undefined) {
  const { bus } = useRealtime();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    const unsubscribe = bus.on<AIRunUpdatePayload>(RealtimeEventType.AIRunUpdated, (event) => {
      const payload = event.payload;
      if (!payload?.runId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiExecutions.detail(workspaceId, payload.runId) });
      // Lists, Studio summaries and approvals are refreshed app-wide (coalesced)
      // by the realtime layer, so this screen only follows its own run.
    });
    return unsubscribe;
  }, [bus, queryClient, workspaceId]);
}

/** The last `ai.run.updated` for one run — what step it is on right now. */
export function useLiveRunStep(runId: string | null | undefined) {
  const { bus } = useRealtime();
  const [live, setLive] = useState<AIRunUpdatePayload | null>(null);
  useEffect(() => {
    setLive(null);
    if (!runId) return;
    return bus.on<AIRunUpdatePayload>(RealtimeEventType.AIRunUpdated, (event) => {
      if (event.payload?.runId === runId) setLive(event.payload);
    });
  }, [bus, runId]);
  return live;
}

export interface RunGraph {
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
}

/** A workflow run's graph, for step names and the steps still to come. */
export function useRunGraph(workspaceId: string | undefined, entityType: string | undefined, entityId: string | undefined, given?: RunGraph) {
  return useQuery({
    queryKey: queryKeys.automations.detail(workspaceId ?? '', entityId ?? ''),
    queryFn: () => automationsApi.get(workspaceId as string, entityId as string),
    enabled: Boolean(workspaceId && entityId && entityType === 'WORKFLOW' && !given),
    staleTime: 60_000,
    select: (workflow): RunGraph => ({
      nodes: safeParse(workflow.nodesJson),
      edges: safeParse(workflow.edgesJson),
    }),
  });
}

function safeParse<T>(json: string | null | undefined): T[] {
  try {
    const value = JSON.parse(json ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * The main path through a graph from its trigger: each step's first normal
 * successor (a condition's "yes" branch first). Used to show the steps a
 * running agent has not reached yet, in order.
 */
export function mainPath(graph: RunGraph | undefined): StudioGraphNode[] {
  if (!graph?.nodes.length) return [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const incoming = new Set(graph.edges.map((e) => e.target));
  const start =
    graph.nodes.find((n) => nodeType(n) === 'TRIGGER' || nodeType(n) === 'START') ??
    graph.nodes.find((n) => !incoming.has(n.id)) ??
    graph.nodes[0]!;
  const path: StudioGraphNode[] = [];
  const seen = new Set<string>();
  let current: StudioGraphNode | undefined = start;
  while (current && !seen.has(current.id)) {
    path.push(current);
    seen.add(current.id);
    const out = graph.edges.filter((e) => e.source === current!.id && e.sourceHandle !== 'error' && e.sourceHandle !== 'false');
    const next = out.find((e) => e.sourceHandle === 'true') ?? out[0];
    current = next ? byId.get(next.target) : undefined;
  }
  return path;
}

export function nodeType(node: StudioGraphNode | undefined): string {
  return String(node?.type ?? node?.data?.['type'] ?? '').toUpperCase();
}

export function nodeLabel(node: StudioGraphNode | undefined, fallback: string): string {
  const label = node?.data?.['label'];
  return typeof label === 'string' && label.trim() ? label : fallback;
}
