import { integrationsApi } from '@org/api-client';
import { CONNECTOR_CATALOG, CONNECTOR_CATEGORIES } from './connectorCatalog.js';
import { storage } from './storage.js';

const STORAGE_CONNECTIONS_KEY = 'onetab_connector_connections';
const STORAGE_FAVORITES_KEY = 'onetab_connector_favorites';
const STORAGE_RECENT_ACTIONS_KEY = 'onetab_connector_recent_actions';
const STORAGE_AUDIT_LOGS_KEY = 'onetab_connector_audit_logs';
const STORAGE_CUSTOM_CONNECTORS_KEY = 'onetab_connector_custom_connectors';

/**
 * Initial mock connections for seamless out-of-the-box experience
 */
const DEFAULT_CONNECTIONS = [
  {
    id: 'conn-teams-corp',
    workspaceId: 'default',
    connectorId: 'microsoft_teams',
    name: 'Company Teams (Primary)',
    provider: 'MICROSOFT_TEAMS',
    authType: 'OAUTH2',
    status: 'CONNECTED',
    accountName: 'Engineering Workspace Lead',
    accountEmail: 'engineering-lead@company.com',
    scopes: ['Team.ReadBasic.All', 'Channel.ReadBasic.All', 'ChannelMessage.Send', 'OnlineMeetings.ReadWrite'],
    metadata: {
      tenantId: 'tenant-enterprise-01',
      organization: 'Acme Global Corp',
      defaultChannel: 'General',
    },
    createdBy: 'admin-usr-1',
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-04-01T12:00:00Z',
    lastSyncAt: '2026-04-08T08:30:00Z',
    health: 'HEALTHY',
  },
  {
    id: 'conn-teams-client',
    workspaceId: 'default',
    connectorId: 'microsoft_teams',
    name: 'Client Services Teams',
    provider: 'MICROSOFT_TEAMS',
    authType: 'OAUTH2',
    status: 'CONNECTED',
    accountName: 'Client Advisory Partner',
    accountEmail: 'client-partner@consulting.com',
    scopes: ['ChannelMessage.Send', 'ChatMessage.Send'],
    metadata: {
      tenantId: 'tenant-client-partner-99',
      organization: 'Partner Network',
    },
    createdBy: 'admin-usr-1',
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-04-02T14:00:00Z',
    lastSyncAt: '2026-04-08T08:00:00Z',
    health: 'HEALTHY',
  },
  {
    id: 'conn-slack-corp',
    workspaceId: 'default',
    connectorId: 'slack',
    name: 'OneTab Workspace Slack',
    provider: 'SLACK',
    authType: 'OAUTH2',
    status: 'CONNECTED',
    accountName: 'OneTab Bot',
    accountEmail: 'bot@onetab.ai',
    scopes: ['channels:read', 'chat:write', 'search:read'],
    metadata: { team: 'OneTab Engineering' },
    createdBy: 'admin-usr-1',
    createdAt: '2026-03-10T11:00:00Z',
    updatedAt: '2026-04-05T09:00:00Z',
    health: 'HEALTHY',
  },
  {
    id: 'conn-gmail-support',
    workspaceId: 'default',
    connectorId: 'gmail',
    name: 'Support Operations Gmail',
    provider: 'GMAIL',
    authType: 'OAUTH2',
    status: 'CONNECTED',
    accountName: 'Support Desk Lead',
    accountEmail: 'support-ops@company.com',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    createdBy: 'admin-usr-1',
    createdAt: '2026-03-12T14:00:00Z',
    updatedAt: '2026-04-04T16:00:00Z',
    health: 'HEALTHY',
  },
  {
    id: 'conn-github-core',
    workspaceId: 'default',
    connectorId: 'github',
    name: 'Primary GitHub Org',
    provider: 'GITHUB',
    authType: 'OAUTH2',
    status: 'CONNECTED',
    accountName: 'onetab-ai-org',
    scopes: ['repo', 'workflow', 'read:org'],
    createdBy: 'admin-usr-1',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-04-01T11:00:00Z',
    health: 'HEALTHY',
  },
];

const INITIAL_AUDIT_LOGS = [
  {
    id: 'log-1',
    connectorId: 'microsoft_teams',
    actionName: 'Send Channel Message',
    user: 'Alex Johnson (Admin)',
    status: 'SUCCESS',
    timestamp: '2026-04-08T09:42:00Z',
    durationMs: 240,
    connectionName: 'Company Teams (Primary)',
    details: 'Delivered Sprint 42 summary to #General',
  },
  {
    id: 'log-2',
    connectorId: 'microsoft_teams',
    actionName: 'Create Meeting',
    user: 'AI Incident Assistant',
    status: 'SUCCESS',
    timestamp: '2026-04-08T08:15:00Z',
    durationMs: 310,
    connectionName: 'Company Teams (Primary)',
    details: 'Scheduled War Room meeting with 4 participants',
  },
  {
    id: 'log-3',
    connectorId: 'slack',
    actionName: 'Send Channel Message',
    user: 'Release Agent',
    status: 'SUCCESS',
    timestamp: '2026-04-08T07:30:00Z',
    durationMs: 180,
    connectionName: 'OneTab Workspace Slack',
    details: 'Posted deploy notification to #releases',
  },
  {
    id: 'log-4',
    connectorId: 'gmail',
    actionName: 'Send Email',
    user: 'Support Triage Bot',
    status: 'SUCCESS',
    timestamp: '2026-04-07T18:22:00Z',
    durationMs: 420,
    connectionName: 'Support Operations Gmail',
    details: 'Sent customer acknowledgment for ticket #9812',
  },
];

function loadStoredConnections() {
  const cached = storage.get(STORAGE_CONNECTIONS_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  storage.set(STORAGE_CONNECTIONS_KEY, DEFAULT_CONNECTIONS);
  return DEFAULT_CONNECTIONS;
}

function saveStoredConnections(connections) {
  storage.set(STORAGE_CONNECTIONS_KEY, connections);
}

function loadFavorites() {
  const cached = storage.get(STORAGE_FAVORITES_KEY);
  if (cached && Array.isArray(cached)) return cached;
  const defaults = ['microsoft_teams', 'slack', 'gmail', 'github', 'firecrawl'];
  storage.set(STORAGE_FAVORITES_KEY, defaults);
  return defaults;
}

function loadCustomConnectors() {
  const cached = storage.get(STORAGE_CUSTOM_CONNECTORS_KEY);
  if (cached && Array.isArray(cached)) return cached;
  return [];
}

function saveCustomConnectors(connectors) {
  storage.set(STORAGE_CUSTOM_CONNECTORS_KEY, connectors);
}

export const connectorService = {
  getCategories() {
    return CONNECTOR_CATEGORIES;
  },

  /**
   * Fetches the entire connector catalog, cross-referenced with active connections and custom user connectors.
   */
  async getConnectors(workspaceId) {
    const connections = loadStoredConnections();
    const favorites = loadFavorites();
    const custom = loadCustomConnectors();

    // In a live backend environment, try to pull registered providers
    let liveProviders = [];
    if (workspaceId) {
      try {
        const live = await integrationsApi.getProviders(workspaceId);
        if (Array.isArray(live)) liveProviders = live;
      } catch {
        // Fall back gracefully to catalog
      }
    }

    const fullCatalog = [...CONNECTOR_CATALOG, ...custom];

    return fullCatalog.map((connector) => {
      const appConns = connections.filter((c) => c.connectorId === connector.id);
      const isConnected = appConns.some((c) => c.status === 'CONNECTED');
      const isFavorite = favorites.includes(connector.id);

      return {
        ...connector,
        status: isConnected ? 'connected' : 'disconnected',
        connectionsCount: appConns.length,
        connections: appConns,
        isFavorite,
      };
    });
  },

  async createCustomConnector(workspaceId, connectorData) {
    const custom = loadCustomConnectors();
    const newConnector = {
      id: connectorData.id || `custom_${Date.now().toString(36)}`,
      name: connectorData.name,
      category: connectorData.category || 'custom',
      icon: connectorData.icon || 'Code',
      color: connectorData.color || '#0ea5e9',
      authType: connectorData.authType || 'API_KEY',
      description: connectorData.description || 'Custom user-defined connector',
      verified: false,
      version: 'v1.0.0',
      status: 'connected',
      providerKey: (connectorData.name || 'CUSTOM').toUpperCase().replace(/\s+/g, '_'),
      customIconUrl: connectorData.customIconUrl || null,
      actions: connectorData.actions || [
        { id: 'execute_request', name: 'Execute Request', description: 'Invoke custom API endpoint' },
      ],
      triggers: connectorData.triggers || [
        { id: 'inbound_webhook', name: 'Inbound Webhook', description: 'Receives custom webhook events' },
      ],
      createdAt: new Date().toISOString(),
    };

    const updated = [newConnector, ...custom];
    saveCustomConnectors(updated);

    // Auto-create initial connection if credentials provided
    if (connectorData.apiKey || connectorData.baseUrl) {
      await this.createConnection(workspaceId, newConnector.id, {
        name: `${newConnector.name} Default`,
        accountName: connectorData.accountName || 'Primary Account',
        metadata: {
          baseUrl: connectorData.baseUrl,
          headerName: connectorData.headerName || 'Authorization',
        },
      });
    }

    return newConnector;
  },

  async getConnectorById(connectorId, workspaceId) {
    const connectors = await this.getConnectors(workspaceId);
    const found = connectors.find((c) => c.id === connectorId);
    if (!found) {
      throw new Error(`Connector '${connectorId}' not found in catalog.`);
    }
    return found;
  },

  async getConnections(workspaceId, connectorId) {
    const all = loadStoredConnections();
    return all.filter((c) => {
      if (connectorId && c.connectorId !== connectorId) return false;
      return true;
    });
  },

  async createConnection(workspaceId, connectorId, data) {
    const all = loadStoredConnections();
    const connector = CONNECTOR_CATALOG.find((c) => c.id === connectorId);

    const newConnection = {
      id: `conn-${connectorId}-${Date.now().toString(36)}`,
      workspaceId: workspaceId || 'default',
      connectorId,
      name: data.name || `${connector?.name || 'App'} Connection`,
      provider: connector?.providerKey || connectorId.toUpperCase(),
      authType: connector?.authType || 'OAUTH2',
      status: 'CONNECTED',
      accountName: data.accountName || 'Connected Account',
      accountEmail: data.accountEmail || 'user@company.com',
      scopes: data.scopes || ['read', 'write'],
      metadata: data.metadata || {},
      createdBy: 'current-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      health: 'HEALTHY',
    };

    const updated = [newConnection, ...all];
    saveStoredConnections(updated);

    this.recordAuditLog({
      connectorId,
      actionName: 'Create Connection',
      user: 'Current User',
      status: 'SUCCESS',
      connectionName: newConnection.name,
      details: `Added new connection for ${connector?.name || connectorId}`,
    });

    return newConnection;
  },

  async updateConnection(connectionId, patch) {
    const all = loadStoredConnections();
    const updated = all.map((c) => {
      if (c.id === connectionId) {
        return {
          ...c,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });
    saveStoredConnections(updated);
    return updated.find((c) => c.id === connectionId);
  },

  async deleteConnection(connectionId) {
    const all = loadStoredConnections();
    const target = all.find((c) => c.id === connectionId);
    const updated = all.filter((c) => c.id !== connectionId);
    saveStoredConnections(updated);

    if (target) {
      this.recordAuditLog({
        connectorId: target.connectorId,
        actionName: 'Delete Connection',
        user: 'Current User',
        status: 'SUCCESS',
        connectionName: target.name,
        details: `Deleted connection ${target.name}`,
      });
    }

    return { success: true };
  },

  async testConnection(connectionId) {
    await new Promise((r) => setTimeout(r, 600));
    const all = loadStoredConnections();
    const target = all.find((c) => c.id === connectionId);

    if (!target) {
      return { success: false, message: 'Connection not found.' };
    }

    return {
      success: true,
      status: 'HEALTHY',
      durationMs: 280,
      accountName: target.accountName,
      accountEmail: target.accountEmail,
      message: `Successfully connected to ${target.name}. API response: 200 OK`,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Executes or simulates an action on an App Connector
   */
  async testAction(connectorId, actionId, input = {}, connectionId = null) {
    const startTime = Date.now();
    await new Promise((r) => setTimeout(r, 450));
    const durationMs = Date.now() - startTime;

    const connector = CONNECTOR_CATALOG.find((c) => c.id === connectorId);
    const action = connector?.actions?.find((a) => a.id === actionId);

    // Resolve dynamic expressions if any
    const resolvedInput = {};
    for (const [k, v] of Object.entries(input)) {
      resolvedInput[k] = this.resolveExpressions(String(v ?? ''), {
        agent: { output: 'AI Generated Analysis', summary: 'Executive project update for Q2' },
        trigger: { message: 'Inbound customer inquiry' },
        user: { email: 'alex@company.com', name: 'Alex Johnson' },
        workspace: { name: 'Acme OneTab' },
      });
    }

    let output = {};

    if (connectorId === 'microsoft_teams') {
      if (actionId === 'send_channel_message') {
        output = {
          success: true,
          messageId: `msg-${Date.now().toString(36)}`,
          teamId: resolvedInput.teamId || 'Engineering',
          channelId: resolvedInput.channelId || 'General',
          contentDelivered: resolvedInput.content || 'Test message',
          webUrl: 'https://teams.microsoft.com/l/message/General',
          timestamp: new Date().toISOString(),
        };
      } else if (actionId === 'create_meeting') {
        output = {
          success: true,
          meetingId: `mtg-${Date.now().toString(36)}`,
          subject: resolvedInput.subject || 'AI Agent Sync Meeting',
          joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/bridge-01',
          startDateTime: resolvedInput.startDateTime || new Date().toISOString(),
          endDateTime: resolvedInput.endDateTime || new Date(Date.now() + 3600000).toISOString(),
        };
      } else if (actionId === 'search_messages') {
        output = {
          success: true,
          count: 3,
          messages: [
            { id: 'm-1', body: 'Architecture review notes', channel: 'Engineering' },
            { id: 'm-2', body: 'Sprint goals finalized', channel: 'General' },
          ],
        };
      } else {
        output = {
          success: true,
          action: actionId,
          data: { status: 'OK', recordsProcessed: 1 },
        };
      }
    } else {
      output = {
        success: true,
        actionId,
        inputApplied: resolvedInput,
        result: `Executed action "${action?.name || actionId}" successfully`,
        timestamp: new Date().toISOString(),
      };
    }

    this.recordAuditLog({
      connectorId,
      actionName: action?.name || actionId,
      user: 'Current User',
      status: 'SUCCESS',
      durationMs,
      connectionName: connectionId || 'Default Connection',
      details: `Executed test for ${action?.name || actionId}`,
    });

    return {
      status: 'SUCCESS',
      statusCode: 200,
      durationMs,
      output,
    };
  },

  /**
   * Evaluates {{expression}} strings against context variables
   */
  resolveExpressions(template = '', context = {}) {
    if (!template || typeof template !== 'string') return template;
    return template.replace(/\{\{([^{}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      let val = context;
      for (const p of parts) {
        if (val && typeof val === 'object' && p in val) {
          val = val[p];
        } else {
          return match;
        }
      }
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
  },

  async toggleFavorite(connectorId) {
    const favorites = loadFavorites();
    const exists = favorites.includes(connectorId);
    const next = exists ? favorites.filter((id) => id !== connectorId) : [...favorites, connectorId];
    storage.set(STORAGE_FAVORITES_KEY, next);
    return next;
  },

  getMetrics(connectorId) {
    if (connectorId === 'microsoft_teams') {
      return {
        totalExecutions: 1420,
        successRate: 99.2,
        avgLatencyMs: 245,
        mostUsedAction: 'Send Channel Message',
        lastExecuted: '12 minutes ago',
        actionsCount: 14,
        triggersCount: 3,
        activeConnections: 2,
      };
    }
    return {
      totalExecutions: 654,
      successRate: 98.7,
      avgLatencyMs: 310,
      mostUsedAction: 'Execute Action',
      lastExecuted: '1 hour ago',
      actionsCount: 6,
      triggersCount: 2,
      activeConnections: 1,
    };
  },

  getAuditLogs(connectorId) {
    const all = storage.get(STORAGE_AUDIT_LOGS_KEY) || INITIAL_AUDIT_LOGS;
    if (connectorId) {
      return all.filter((l) => l.connectorId === connectorId);
    }
    return all;
  },

  recordAuditLog(logEntry) {
    const all = storage.get(STORAGE_AUDIT_LOGS_KEY) || INITIAL_AUDIT_LOGS;
    const entry = {
      id: `log-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      ...logEntry,
    };
    const updated = [entry, ...all.slice(0, 99)];
    storage.set(STORAGE_AUDIT_LOGS_KEY, updated);
  },

  /**
   * Pre-built workflow templates that incorporate App Connectors
   */
  getTemplates() {
    return [
      {
        id: 'tmpl-github-teams',
        title: 'GitHub Issues → Microsoft Teams Alert',
        category: 'DevOps & Alerts',
        description: 'Monitors incoming repository issues, generates an executive summary with AI, and notifies the Engineering Teams channel.',
        apps: ['github', 'microsoft_teams'],
        icon: 'MessageSquare',
      },
      {
        id: 'tmpl-gmail-summary-teams',
        title: 'Gmail Customer Lead → Teams Notification',
        category: 'Customer Support',
        description: 'Extracts customer requirements from inbound emails and alerts the sales team on Microsoft Teams with drafted response.',
        apps: ['gmail', 'microsoft_teams'],
        icon: 'Mail',
      },
      {
        id: 'tmpl-calendar-teams-meeting',
        title: 'Calendar Event → Auto Teams Meeting Link',
        category: 'Productivity',
        description: 'Schedules a Microsoft Teams online conference bridge automatically whenever a project milestone meeting is booked.',
        apps: ['google_calendar', 'microsoft_teams'],
        icon: 'Calendar',
      },
      {
        id: 'tmpl-jira-slack',
        title: 'Jira Critical Bug → Slack Channel Broadcast',
        category: 'Engineering',
        description: 'Broadcasts urgent P0 bugs created in Jira directly to the on-call incident response channel.',
        apps: ['jira', 'slack'],
        icon: 'CheckSquare',
      },
      {
        id: 'tmpl-hubspot-email-followup',
        title: 'CRM Lead → Personalized Email Follow-up',
        category: 'Sales & CRM',
        description: 'When a new lead enters HubSpot, analyzes company profile and drafts an intro email.',
        apps: ['hubspot', 'gmail'],
        icon: 'Users',
      },
    ];
  },
};
