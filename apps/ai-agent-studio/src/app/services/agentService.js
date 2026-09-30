import { agentsApi } from '@org/api-client';
import { storage } from './storage.js';
import { INITIAL_AGENTS } from './mockData.js';

const STORAGE_KEY = 'agents_list';

function loadCachedAgents() {
  const cached = storage.get(STORAGE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }
  storage.set(STORAGE_KEY, INITIAL_AGENTS);
  return INITIAL_AGENTS;
}

function saveCachedAgents(agents) {
  storage.set(STORAGE_KEY, agents);
}

/**
 * Normalizes an API AIAgent or cached agent into standard Studio shape
 */
function normalizeAgent(raw) {
  if (!raw) return null;
  const config = typeof raw.configuration === 'object' && raw.configuration !== null
    ? raw.configuration
    : {};

  let parsedTools = [];
  if (Array.isArray(raw.tools)) {
    parsedTools = raw.tools;
  } else if (typeof raw.tools === 'string') {
    try {
      parsedTools = JSON.parse(raw.tools);
    } catch {
      parsedTools = [];
    }
  }

  return {
    ...raw,
    role: raw.role || 'Assistant Specialist',
    description: raw.description || '',
    status: config.status || (raw.isActive ? 'published' : 'draft'),
    model: raw.model || 'gpt-4o',
    provider: raw.provider || 'OpenAI',
    systemPrompt: raw.systemPrompt || '',
    tools: parsedTools,
    configuration: config,
    stats: config.stats || {
      totalRuns: 0,
      successRate: 100,
      avgDuration: '0s',
      costEstimate: '$0.00',
    },
    deployment: config.deployment || {
      environments: ['development'],
      widgetEnabled: false,
    },
  };
}

export const agentService = {
  async getAgents(workspaceId) {
    if (workspaceId) {
      try {
        const live = await agentsApi.list(workspaceId);
        if (Array.isArray(live)) {
          const normalized = live.map(normalizeAgent);
          saveCachedAgents(normalized);
          return normalized;
        }
      } catch (err) {
        console.warn('Backend agentsApi.list failed, falling back to local cache:', err);
      }
    }
    return loadCachedAgents().map(normalizeAgent);
  },

  async getAgentById(workspaceId, agentId) {
    if (workspaceId && agentId) {
      try {
        const live = await agentsApi.get(workspaceId, agentId);
        if (live) {
          const normalized = normalizeAgent(live);
          return normalized;
        }
      } catch (err) {
        console.warn('Backend agentsApi.get failed, falling back to local cache:', err);
      }
    }

    const agents = loadCachedAgents();
    const found = agents.find((a) => a.id === agentId);
    if (!found) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return normalizeAgent(found);
  },

  async createAgent(workspaceId, data) {
    const config = {
      status: 'draft',
      theme: data.configuration?.theme || data.theme || 'emerald',
      icon: data.configuration?.icon || data.icon || 'Bot',
      avatar: data.configuration?.avatar || data.avatar || '',
      category: data.configuration?.category || data.category || 'Customer Support',
      tags: data.configuration?.tags || data.tags || ['General'],
      owner: data.configuration?.owner || data.owner || null,
      environment: data.configuration?.environment || data.environment || 'development',
      ...(data.configuration || {}),
    };

    const payload = {
      name: data.name || 'Untitled Agent',
      role: data.role || 'Assistant Specialist',
      description: data.description || 'Configured via AI Agent Studio',
      systemPrompt: data.systemPrompt || 'You are an intelligent AI agent.',
      provider: data.provider || 'OpenAI',
      model: data.model || 'gpt-4o',
      tools: data.tools || ['search_docs'],
      avatarUrl: data.avatarUrl || config.avatar || null,
      configuration: config,
      graphJson: data.graphJson || JSON.stringify({
        schemaVersion: '1.0.0',
        name: data.name || 'Untitled Agent',
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
            data: { label: data.name || 'Primary Reasoner', subtitle: `${data.model || 'gpt-4o'}`, config: { model: data.model || 'gpt-4o' } },
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
      }),
    };

    if (workspaceId) {
      try {
        const created = await agentsApi.create(workspaceId, payload);
        if (created) {
          const normalized = normalizeAgent(created);
          const cached = loadCachedAgents();
          saveCachedAgents([normalized, ...cached]);
          return normalized;
        }
      } catch (err) {
        console.warn('Backend agentsApi.create failed, falling back to local creation:', err);
      }
    }

    const agents = loadCachedAgents();
    const newId = `agent-${Date.now().toString(36)}`;
    const newAgent = normalizeAgent({
      id: newId,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configuration: config,
    });

    agents.unshift(newAgent);
    saveCachedAgents(agents);
    return newAgent;
  },

  async updateAgent(workspaceId, agentId, patch) {
    if (workspaceId && agentId) {
      try {
        const updated = await agentsApi.update(workspaceId, agentId, patch);
        if (updated) {
          const normalized = normalizeAgent(updated);
          const agents = loadCachedAgents();
          const idx = agents.findIndex((a) => a.id === agentId);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], ...normalized };
            saveCachedAgents(agents);
          }
          return normalized;
        }
      } catch (err) {
        console.warn('Backend agentsApi.update failed, updating local cache:', err);
      }
    }

    const agents = loadCachedAgents();
    const index = agents.findIndex((a) => a.id === agentId);
    if (index === -1) throw new Error('Agent not found');

    const updated = normalizeAgent({
      ...agents[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    agents[index] = updated;
    saveCachedAgents(agents);
    return updated;
  },

  async deleteAgent(workspaceId, agentId) {
    if (workspaceId && agentId) {
      try {
        await agentsApi.remove(workspaceId, agentId);
      } catch (err) {
        console.warn('Backend agentsApi.remove failed:', err);
      }
    }

    const agents = loadCachedAgents();
    const index = agents.findIndex((a) => a.id === agentId);
    if (index !== -1) {
      agents[index] = {
        ...agents[index],
        deletedAt: new Date().toISOString(),
        configuration: {
          ...(agents[index].configuration || {}),
          status: 'deleted',
        },
      };
      saveCachedAgents(agents);
    }
    return { success: true };
  },

  async restoreAgent(workspaceId, agentId) {
    const agents = loadCachedAgents();
    const index = agents.findIndex((a) => a.id === agentId);
    if (index !== -1) {
      delete agents[index].deletedAt;
      agents[index].configuration = {
        ...(agents[index].configuration || {}),
        status: 'draft',
      };
      saveCachedAgents(agents);
      if (workspaceId) {
        try {
          await agentsApi.update(workspaceId, agentId, { isActive: true });
        } catch {}
      }
      return agents[index];
    }
    throw new Error('Agent not found in trash');
  },

  async permanentDeleteAgent(workspaceId, agentId) {
    if (workspaceId && agentId) {
      try {
        await agentsApi.remove(workspaceId, agentId);
      } catch {}
    }
    const agents = loadCachedAgents();
    const filtered = agents.filter((a) => a.id !== agentId);
    saveCachedAgents(filtered);
    return { success: true };
  },

  async renameAgent(workspaceId, agentId, newName) {
    return this.updateAgent(workspaceId, agentId, {
      name: newName.trim(),
    });
  },

  async archiveAgent(workspaceId, agentId) {
    return this.updateAgent(workspaceId, agentId, {
      configuration: {
        status: 'archived',
      },
    });
  },

  async unarchiveAgent(workspaceId, agentId) {
    return this.updateAgent(workspaceId, agentId, {
      configuration: {
        status: 'draft',
      },
    });
  },

  async duplicateAgent(workspaceId, agentId) {
    const existing = await this.getAgentById(workspaceId, agentId);
    const duplicated = await this.createAgent(workspaceId, {
      ...existing,
      name: `${existing.name} (Copy)`,
      configuration: {
        ...(existing.configuration || {}),
        status: 'draft',
      },
    });
    return duplicated;
  },

  async createFromExistingWorkflow(workspaceId, sourceAgentId, newMetadata) {
    const source = await this.getAgentById(workspaceId, sourceAgentId);
    return this.createAgent(workspaceId, {
      ...newMetadata,
      graphJson: source.graphJson,
      tools: source.tools,
      model: newMetadata.model || source.model,
      systemPrompt: newMetadata.systemPrompt || source.systemPrompt,
      configuration: {
        ...(source.configuration || {}),
        ...(newMetadata.configuration || {}),
        status: 'draft',
      },
    });
  },

  async publishAgent(workspaceId, agentId) {
    if (workspaceId && agentId) {
      try {
        const res = await agentsApi.publish(workspaceId, agentId);
        if (res?.agent) return normalizeAgent(res.agent);
      } catch (err) {
        console.warn('Backend agentsApi.publish failed:', err);
      }
    }
    return this.updateAgent(workspaceId, agentId, {
      status: 'published',
      publishedAt: new Date().toISOString(),
      deployment: {
        environments: ['production', 'staging'],
        widgetEnabled: true,
        publicLink: `https://onetab.ai/agent/${agentId}`,
        webhookUrl: `https://api.onetab.ai/v1/agents/${agentId}/webhook`,
      },
    });
  },

  async unpublishAgent(workspaceId, agentId) {
    if (workspaceId && agentId) {
      try {
        const res = await agentsApi.unpublish(workspaceId, agentId);
        if (res?.agent) return normalizeAgent(res.agent);
      } catch (err) {
        console.warn('Backend agentsApi.unpublish failed:', err);
      }
    }
    return this.updateAgent(workspaceId, agentId, {
      status: 'draft',
    });
  },

  async getVersions(workspaceId, agentId) {
    if (workspaceId && agentId) {
      try {
        const live = await agentsApi.getVersions(workspaceId, agentId);
        if (Array.isArray(live) && live.length > 0) return live;
      } catch (err) {
        console.warn('Backend agentsApi.getVersions failed:', err);
      }
    }
    const versionsKey = `agent_versions_${agentId}`;
    const cached = storage.get(versionsKey);
    if (cached) return cached;

    const defaults = [
      {
        version: 1,
        versionTag: 'v1.0.0-initial',
        publishedAt: new Date().toISOString(),
        changeSummary: 'Initial baseline draft snapshot',
        status: 'DRAFT',
      },
    ];
    storage.set(versionsKey, defaults);
    return defaults;
  },

  async createVersion(workspaceId, agentId, changeSummary) {
    if (workspaceId && agentId) {
      try {
        const created = await agentsApi.createVersion(workspaceId, agentId, changeSummary);
        if (created) return created;
      } catch (err) {
        console.warn('Backend agentsApi.createVersion failed:', err);
      }
    }
    const versions = await this.getVersions(workspaceId, agentId);
    const nextVerNum = (versions[0]?.version || 1) + 1;
    const newVer = {
      version: nextVerNum,
      versionTag: `v${nextVerNum}.0.0-snapshot`,
      publishedAt: new Date().toISOString(),
      changeSummary: changeSummary || 'Workflow configuration snapshot',
      status: 'SNAPSHOT',
    };
    const updated = [newVer, ...versions];
    storage.set(`agent_versions_${agentId}`, updated);
    return newVer;
  },

  async restoreVersion(workspaceId, agentId, versionNumber) {
    if (workspaceId && agentId) {
      try {
        await agentsApi.restoreVersion(workspaceId, agentId, versionNumber);
      } catch (err) {
        console.warn('Backend agentsApi.restoreVersion failed:', err);
      }
    }
    await this.updateAgent(workspaceId, agentId, {
      updatedAt: new Date().toISOString(),
    });
    return { success: true, restoredVersion: versionNumber };
  },

  exportAgent(agent) {
    const exportObject = {
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      agent: {
        name: agent.name,
        role: agent.role,
        description: agent.description,
        model: agent.model,
        provider: agent.provider,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        tools: agent.tools,
        graphJson: agent.graphJson,
      },
    };
    return JSON.stringify(exportObject, null, 2);
  },

  async importAgent(workspaceId, jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
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
    } catch {
      throw new Error('Invalid agent JSON format');
    }
  },
};
