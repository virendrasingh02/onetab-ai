import {
  agentVersionLabel,
  compileStudioGraph,
  describeEntityTool,
  flattenAgentTeam,
  isStudioGraph,
  studioGraphApps,
} from '@org/types';

export interface AgentContentsTool {
  key: string;
  label: string;
  /** Upper-case app key (`SLACK`); unset for built-in tools. */
  provider?: string;
}

/** What an agent is built from, for its card. */
export interface AgentContents {
  tools: AgentContentsTool[];
  /** Upper-case app keys, in the order they appear on the canvas. */
  apps: string[];
  knowledge: string[];
  /** Every agent on the canvas, sub-agents included. */
  agents: string[];
}

interface CanvasNode {
  type?: string;
  data?: {
    type?: string;
    label?: string;
    config?: Record<string, unknown>;
  };
}

const TOOL_STEP_TYPES = new Set(['MCP_TOOL', 'TOOL']);

function parseToolList(tools: unknown): string[] {
  try {
    const parsed: unknown =
      typeof tools === 'string' ? JSON.parse(tools) : tools;
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === 'string' && !!t)
      : [];
  } catch {
    return [];
  }
}

function toTool(name: string, apps: readonly string[]): AgentContentsTool {
  const info = describeEntityTool(name);
  if (info.provider)
    return { key: name, label: info.label, provider: info.provider };
  // An app the shared label table doesn't know, such as a custom connector.
  const app = apps.find((a) =>
    name.toLowerCase().startsWith(`${a.toLowerCase()}_`),
  );
  if (!app) return { key: name, label: info.label };
  const action = describeEntityTool(`${app}.${name.slice(app.length + 1)}`);
  return { key: name, label: action.label, provider: app };
}

/**
 * Reads the canvas, because that is what the agent runs: `AIAgent.tools` keeps
 * its creation defaults and misses every app and tool step added afterwards.
 * Agents with no canvas tools fall back to that list.
 */
export function agentContents(agent: {
  name?: string;
  tools?: unknown;
  graphJson?: string | null;
}): AgentContents {
  const stored = parseToolList(agent.tools);
  const out: AgentContents = { tools: [], apps: [], knowledge: [], agents: [] };
  const seen = new Set<string>();
  const addTool = (tool: AgentContentsTool) => {
    // `kb_search` and `search_docs`, or `SLACK.x` and `slack_x`, are one tool.
    const id = `${tool.provider ?? ''}:${tool.label.toLowerCase()}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.tools.push(tool);
  };
  const addApp = (app: string | undefined) => {
    if (app && !out.apps.includes(app)) out.apps.push(app);
  };

  if (isStudioGraph(agent.graphJson)) {
    const graph = JSON.parse(agent.graphJson as string) as {
      nodes?: CanvasNode[];
      edges?: unknown;
      settings?: unknown;
    };
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const team = compileStudioGraph(graph).agents.flatMap(flattenAgentTeam);
    const graphApps = studioGraphApps(agent.graphJson);
    graphApps.providers.forEach(addApp);

    for (const spec of team) {
      out.agents.push(spec.name);
      spec.tools.forEach((t) => addTool(toTool(t, graphApps.providers)));
    }
    graphApps.tools.forEach((t) => addTool(toTool(t, graphApps.providers)));

    const knowledgeNames = new Map<string, string>();
    for (const node of nodes) {
      const type = node.type ?? node.data?.type ?? '';
      const config = node.data?.config ?? {};
      const label = node.data?.label?.trim();
      if (type === 'KB_SEARCH' && typeof config['knowledgeBaseId'] === 'string')
        knowledgeNames.set(
          config['knowledgeBaseId'],
          label || 'Knowledge base',
        );
      if (!TOOL_STEP_TYPES.has(type)) continue;
      const toolName =
        typeof config['toolName'] === 'string' ? config['toolName'] : '';
      if (toolName) addTool(toTool(toolName, graphApps.providers));
      else if (label) {
        // Planner steps name the app before an action has been picked.
        const needs = config['needsConnection'];
        addTool({
          key: label,
          label,
          ...(typeof needs === 'string' && needs
            ? { provider: needs.toUpperCase() }
            : {}),
        });
      }
    }

    const knowledgeIds = new Set(
      team.flatMap((spec) => spec.knowledge.map((k) => k.knowledgeBaseId)),
    );
    out.knowledge = [...knowledgeIds].map(
      (id) => knowledgeNames.get(id) ?? 'Knowledge base',
    );
  }

  if (!out.tools.length) stored.forEach((t) => addTool(toTool(t, out.apps)));
  out.tools.forEach((t) => addApp(t.provider));
  return out;
}

export interface AgentVersionSummary {
  /** The version to show: the published one, else the newest snapshot. */
  label: string;
  published: boolean;
  publishedAt?: string;
  /** A newer unpublished snapshot, when there is one. */
  newerSnapshot?: string;
  total: number;
}

interface StoredVersion {
  version: number;
  versionTag?: string;
  status?: string;
  publishedAt?: string;
}

const newest = (versions: StoredVersion[]) =>
  versions.reduce((a, b) => (Number(b.version) > Number(a.version) ? b : a));

const versionLabel = (v: StoredVersion) =>
  agentVersionLabel(v).replace(/-snapshot$/, '');

/** The agent's version from `configuration.versions`, or null if none was ever saved. */
export function agentVersionSummary(
  configuration: { versions?: unknown } | null | undefined,
): AgentVersionSummary | null {
  const versions = Array.isArray(configuration?.versions)
    ? (configuration.versions as StoredVersion[])
    : [];
  if (!versions.length) return null;

  const latest = newest(versions);
  const published = versions.filter(
    (v) => v.status?.toUpperCase() === 'PUBLISHED',
  );
  if (!published.length)
    return {
      label: versionLabel(latest),
      published: false,
      total: versions.length,
    };

  const live = newest(published);
  return {
    label: versionLabel(live),
    published: true,
    ...(live.publishedAt ? { publishedAt: live.publishedAt } : {}),
    ...(latest.version > live.version
      ? { newerSnapshot: versionLabel(latest) }
      : {}),
    total: versions.length,
  };
}
