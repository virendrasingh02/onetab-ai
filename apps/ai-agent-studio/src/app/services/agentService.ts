import { agentsApi } from '@org/api-client';
import { aiEntityAvatarFromLegacy, type AIAgent, type AIAgentDetail } from '@org/types';

/**
 * Agents as Studio uses them. Everything here goes to the platform API and a
 * failure throws: Studio no longer keeps a local copy of agents to show or
 * "save" to when the server can't be reached, because a list that quietly
 * falls back to sample agents (or a delete that only happened in the browser)
 * is worse than an error the person can see and retry.
 */

type Config = Record<string, unknown>;

/** Platform default model (NVIDIA Nemotron 3 Super) — matches the API's AI_DEFAULT_MODEL. */
export const DEFAULT_AGENT_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
/** Provider of {@link DEFAULT_AGENT_MODEL}. */
export const DEFAULT_AGENT_PROVIDER = 'nvidia';

export interface StudioAgent extends Omit<AIAgentDetail, 'configuration' | 'tools' | 'status'> {
  tools: unknown[];
  configuration: Config;
  /** Studio's lifecycle status (draft, published, archived, deleted…), not the coworker presence. */
  status: string;
  stats: { totalRuns: number; successRate: number; avgDuration: string; costEstimate: string };
  deployment: Record<string, unknown>;
  deletedAt?: string | null;
}

/** What a create or import needs; everything else gets a sensible default. */
export interface AgentDraft {
  name?: string;
  role?: string;
  description?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  tools?: unknown[];
  avatarUrl?: string | null;
  graphJson?: string | null;
  configuration?: Config;
  // Legacy create-form fields, folded into `configuration`.
  theme?: string;
  icon?: string;
  avatar?: string;
  category?: string;
  tags?: string[];
  owner?: unknown;
  environment?: string;
  [key: string]: unknown;
}

const asConfig = (value: unknown): Config =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Config) : {};

function parseTools(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** An API agent in the shape Studio's pages read. */
export function normalizeAgent(raw: AIAgent | AIAgentDetail): StudioAgent {
  const record = raw as unknown as Record<string, unknown>;
  const config = asConfig(record['configuration']);
  const stats = asConfig(config['stats']);
  return {
    ...(raw as unknown as StudioAgent),
    role: raw.role || 'Assistant Specialist',
    description: raw.description || '',
    status: String(config['status'] || (raw.isActive ? 'published' : 'draft')),
    model: raw.model || DEFAULT_AGENT_MODEL,
    provider: raw.provider || (raw.model ? 'OpenAI' : DEFAULT_AGENT_PROVIDER),
    systemPrompt: raw.systemPrompt || '',
    tools: parseTools(record['tools']),
    configuration: config,
    deletedAt: typeof config['deletedAt'] === 'string' ? (config['deletedAt'] as string) : null,
    stats: {
      totalRuns: Number(stats['totalRuns'] ?? 0),
      successRate: Number(stats['successRate'] ?? 100),
      avgDuration: String(stats['avgDuration'] ?? '0s'),
      costEstimate: String(stats['costEstimate'] ?? '$0.00'),
    },
    deployment: asConfig(config['deployment']),
  };
}

/** The graph a new agent starts with: trigger → agent → output. */
function starterGraph(name: string, model: string): string {
  return JSON.stringify({
    schemaVersion: '1.0.0',
    name,
    nodes: [
      {
        id: 'start-1',
        type: 'START',
        position: { x: 100, y: 200 },
        data: { label: 'Workflow Trigger', subtitle: 'Manual execution & API trigger', config: { triggerType: 'MANUAL' } },
      },
      {
        id: 'agent-1',
        type: 'AGENT',
        position: { x: 420, y: 180 },
        data: { label: name, subtitle: model, config: { model } },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 780, y: 200 },
        data: { label: 'Workflow Output', subtitle: 'Final response delivery' },
      },
    ],
    edges: [
      { id: 'e1-2', source: 'start-1', target: 'agent-1', animated: true },
      { id: 'e2-3', source: 'agent-1', target: 'end-1' },
    ],
  });
}

/**
 * The API replaces `configuration` wholesale, so a partial configuration patch
 * is merged onto the saved one first.
 */
async function mergedConfiguration(workspaceId: string, agentId: string, patch: Config): Promise<Config> {
  const current = await agentsApi.get(workspaceId, agentId);
  return { ...asConfig((current as unknown as Record<string, unknown>)['configuration']), ...patch };
}

export const agentService = {
  async getAgents(workspaceId: string): Promise<StudioAgent[]> {
    const list = await agentsApi.list(workspaceId);
    return list.map(normalizeAgent);
  },

  async getAgentById(workspaceId: string, agentId: string): Promise<StudioAgent> {
    return normalizeAgent(await agentsApi.get(workspaceId, agentId));
  },

  async createAgent(workspaceId: string, data: AgentDraft): Promise<StudioAgent> {
    const name = data.name || 'Untitled Agent';
    const model = data.model || DEFAULT_AGENT_MODEL;
    const configuration: Config = {
      status: 'draft',
      theme: data.configuration?.['theme'] || data.theme || 'emerald',
      icon: data.configuration?.['icon'] || data.icon || 'Bot',
      avatar: data.configuration?.['avatar'] || data.avatar || '',
      category: data.configuration?.['category'] || data.category || 'Customer Support',
      tags: data.configuration?.['tags'] || data.tags || ['General'],
      owner: data.configuration?.['owner'] || data.owner || null,
      environment: data.configuration?.['environment'] || data.environment || 'development',
      ...(data.configuration || {}),
    };

    const created = await agentsApi.create(workspaceId, {
      name,
      role: data.role || 'Assistant Specialist',
      description: data.description || 'Configured via AI Agent Studio',
      systemPrompt: data.systemPrompt || 'You are an intelligent AI agent.',
      provider: data.provider || (data.model ? 'OpenAI' : DEFAULT_AGENT_PROVIDER),
      model,
      tools: (data.tools as string[] | undefined) || ['search_docs'],
      // One identity everywhere: a photo, or the icon + colour as `icon:<icon>:<color>`.
      avatarUrl: aiEntityAvatarFromLegacy(data.avatarUrl as string | undefined, configuration),
      configuration,
      graphJson: data.graphJson || starterGraph(name, model),
    });
    return normalizeAgent(created);
  },

  async updateAgent(
    workspaceId: string,
    agentId: string,
    patch: Parameters<typeof agentsApi.update>[2],
  ): Promise<StudioAgent> {
    const body = patch.configuration
      ? { ...patch, configuration: await mergedConfiguration(workspaceId, agentId, patch.configuration) }
      : patch;
    return normalizeAgent(await agentsApi.update(workspaceId, agentId, body));
  },

  async renameAgent(workspaceId: string, agentId: string, newName: string) {
    return this.updateAgent(workspaceId, agentId, { name: newName.trim() });
  },

  /** Moves an agent to Trash: stops it running and marks it, on the server. */
  async deleteAgent(workspaceId: string, agentId: string) {
    return this.updateAgent(workspaceId, agentId, {
      isActive: false,
      configuration: { status: 'deleted', deletedAt: new Date().toISOString() },
    });
  },

  async restoreAgent(workspaceId: string, agentId: string) {
    return this.updateAgent(workspaceId, agentId, {
      isActive: true,
      configuration: { status: 'draft', deletedAt: null },
    });
  },

  /** Removes the agent for good. */
  async permanentDeleteAgent(workspaceId: string, agentId: string) {
    await agentsApi.remove(workspaceId, agentId);
    return { success: true };
  },

  async archiveAgent(workspaceId: string, agentId: string) {
    return this.updateAgent(workspaceId, agentId, { configuration: { status: 'archived' } });
  },

  async unarchiveAgent(workspaceId: string, agentId: string) {
    return this.updateAgent(workspaceId, agentId, { configuration: { status: 'draft' } });
  },

  async duplicateAgent(workspaceId: string, agentId: string) {
    const existing = await this.getAgentById(workspaceId, agentId);
    return this.createAgent(workspaceId, {
      name: `${existing.name} (Copy)`,
      role: existing.role,
      description: existing.description ?? undefined,
      systemPrompt: existing.systemPrompt,
      provider: existing.provider,
      model: existing.model,
      tools: existing.tools,
      avatarUrl: existing.avatarUrl,
      graphJson: existing.graphJson,
      configuration: { ...existing.configuration, status: 'draft', deletedAt: null },
    });
  },

  async createFromExistingWorkflow(workspaceId: string, sourceAgentId: string, newMetadata: AgentDraft) {
    const source = await this.getAgentById(workspaceId, sourceAgentId);
    return this.createAgent(workspaceId, {
      ...newMetadata,
      graphJson: source.graphJson,
      tools: source.tools,
      model: newMetadata.model || source.model,
      systemPrompt: newMetadata.systemPrompt || source.systemPrompt,
      configuration: { ...source.configuration, ...(newMetadata.configuration || {}), status: 'draft' },
    });
  },

  exportAgent(agent: StudioAgent): string {
    return JSON.stringify(
      {
        schemaVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        agent: {
          name: agent.name,
          role: agent.role,
          description: agent.description,
          model: agent.model,
          provider: agent.provider,
          systemPrompt: agent.systemPrompt,
          temperature: (agent as unknown as Record<string, unknown>)['temperature'],
          tools: agent.tools,
          graphJson: agent.graphJson,
        },
      },
      null,
      2,
    );
  },

  async importAgent(workspaceId: string, jsonString: string) {
    let parsed: { agent?: AgentDraft } & AgentDraft;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid agent JSON format');
    }
    const data = parsed.agent || parsed;
    return this.createAgent(workspaceId, {
      name: `${data.name || 'Imported Agent'} (Imported)`,
      role: data.role,
      description: data.description,
      model: data.model,
      provider: data.provider,
      systemPrompt: data.systemPrompt,
      tools: data.tools,
      graphJson: data.graphJson,
    });
  },
};
