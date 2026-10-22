import { outputSchemaFields, type ConnectorSummary } from '@org/types';
import type { Edge, Node } from '@xyflow/react';

export interface VariableOption {
  /** The `{{…}}` text inserted into a field. */
  token: string;
  hint: string;
  /** Where it comes from, for grouping in the picker. */
  group: 'step' | 'field' | 'run';
}

/** Variables the engine puts in every run's context (`engineContext` in the workflow engine). */
export const RUN_VARIABLES: readonly VariableOption[] = [
  { token: '{{agent.name}}', hint: "This agent's name", group: 'run' },
  { token: '{{agent.objective}}', hint: "The agent's objective", group: 'run' },
  { token: '{{now.date}}', hint: 'Today, yyyy-mm-dd', group: 'run' },
  { token: '{{now.time}}', hint: 'Current time, hh:mm', group: 'run' },
  { token: '{{now.long}}', hint: 'Weekday, day month year', group: 'run' },
  { token: '{{now.timezone}}', hint: 'Run time zone', group: 'run' },
  { token: '{{run.id}}', hint: "This run's id", group: 'run' },
  { token: '{{workspaceId}}', hint: 'The workspace id', group: 'run' },
];

/** Every node that can feed `nodeId`; its output is in the run context under that node's id. */
export function upstreamNodes(nodeId: string, nodes: readonly Node[], edges: readonly Edge[]): Node[] {
  const seen = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const e of edges) {
      if (e.target === current && !seen.has(e.source)) {
        seen.add(e.source);
        queue.push(e.source);
      }
    }
  }
  return nodes.filter((n) => seen.has(n.id) && n.id !== nodeId);
}

const nodeTitle = (n: Node): string => String((n.data as Record<string, unknown> | undefined)?.['title'] ?? n.type ?? n.id);

/** The connector action a canvas card runs, resolved against the live manifests. */
function capabilityOf(node: Node, connectors: readonly ConnectorSummary[]) {
  if (String(node.type ?? '').toUpperCase() !== 'APP_CONNECTOR_ACTION') return undefined;
  const config = ((node.data as Record<string, unknown> | undefined)?.['config'] ?? {}) as Record<string, unknown>;
  const provider = String(config['provider'] ?? config['connectorId'] ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  const actionId = String(config['actionId'] ?? '');
  return connectors.find((c) => c.provider === provider)?.capabilities.find((cap) => cap.id === actionId);
}

/**
 * What the variable picker offers for `node`: each upstream step's output,
 * the typed fields a connector step declares (`{{step.messages.0.subject}}`),
 * then the variables every run has.
 */
export function variableOptions(
  node: Node | null,
  nodes: readonly Node[],
  edges: readonly Edge[],
  connectors: readonly ConnectorSummary[] = [],
): VariableOption[] {
  const options: VariableOption[] = [];
  if (node) {
    for (const up of upstreamNodes(node.id, nodes, edges)) {
      options.push({ token: `{{${up.id}}}`, hint: `Output of ${nodeTitle(up)}`, group: 'step' });
      const fields = outputSchemaFields(capabilityOf(up, connectors)?.outputSchema);
      for (const f of fields) {
        options.push({
          token: `{{${up.id}.${f.path}}}`,
          hint: `${nodeTitle(up)} · ${f.type}${f.description ? ` · ${f.description}` : ''}`,
          group: 'field',
        });
      }
    }
  }
  return [...options, ...RUN_VARIABLES];
}
