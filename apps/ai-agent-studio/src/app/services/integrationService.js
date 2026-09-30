import { storage } from './storage.js';
import { INITIAL_INTEGRATIONS } from './mockData.js';

const STORAGE_KEY = 'integrations_catalog';
const CUSTOM_TOOLS_KEY = 'custom_api_tools';
const MCP_SERVERS_KEY = 'mcp_servers_registry';

function loadIntegrations() {
  const cached = storage.get(STORAGE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  storage.set(STORAGE_KEY, INITIAL_INTEGRATIONS);
  return INITIAL_INTEGRATIONS;
}

export const integrationService = {
  async getIntegrations() {
    return loadIntegrations();
  },

  async toggleConnection(integrationId, connect = true, accountDetails = '') {
    const list = loadIntegrations();
    const updated = list.map((item) => {
      if (item.id === integrationId) {
        return {
          ...item,
          status: connect ? 'connected' : 'disconnected',
          connectedAccount: connect ? (accountDetails || 'Connected Account') : undefined,
        };
      }
      return item;
    });
    storage.set(STORAGE_KEY, updated);
    return updated.find((i) => i.id === integrationId);
  },

  // Custom API Tools Builder
  async getCustomTools() {
    const cached = storage.get(CUSTOM_TOOLS_KEY);
    if (cached) return cached;
    const defaults = [
      {
        id: 'tool-clearbit',
        name: 'Clearbit Company Enrichment API',
        description: 'Enriches company domain with employee count, industry, and annual revenue.',
        method: 'GET',
        endpoint: 'https://company.clearbit.com/v2/companies/find',
        headers: { Authorization: 'Bearer sk_live_***' },
        queryParams: [{ key: 'domain', example: 'airbnb.com' }],
        requestBodySchema: '',
        responseSchema: '{\n  "name": "string",\n  "employees": "number",\n  "industry": "string"\n}',
        version: '1.0.0',
        createdAt: '2026-03-20T12:00:00Z',
      },
      {
        id: 'tool-sendgrid',
        name: 'SendGrid Transactional Email API',
        description: 'Dispatches templated confirmation emails to customer leads.',
        method: 'POST',
        endpoint: 'https://api.sendgrid.com/v3/mail/send',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer SG.***' },
        requestBodySchema: '{\n  "to": "string",\n  "subject": "string",\n  "html": "string"\n}',
        responseSchema: '{\n  "status": "queued",\n  "messageId": "string"\n}',
        version: '1.2.0',
        createdAt: '2026-03-22T14:30:00Z',
      },
    ];
    storage.set(CUSTOM_TOOLS_KEY, defaults);
    return defaults;
  },

  async saveCustomTool(toolData) {
    const tools = await this.getCustomTools();
    const isEdit = !!toolData.id;
    const id = toolData.id || `tool-${Date.now().toString(36)}`;
    const saved = {
      ...toolData,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: toolData.createdAt || new Date().toISOString(),
    };

    const updated = isEdit ? tools.map((t) => (t.id === id ? saved : t)) : [saved, ...tools];
    storage.set(CUSTOM_TOOLS_KEY, updated);
    return saved;
  },

  async deleteCustomTool(toolId) {
    const tools = await this.getCustomTools();
    const updated = tools.filter((t) => t.id !== toolId);
    storage.set(CUSTOM_TOOLS_KEY, updated);
    return { success: true };
  },

  async testApiTool(tool, sampleParams = {}) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      status: 200,
      statusText: 'OK',
      durationMs: 340,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '499',
      },
      body: {
        success: true,
        endpointCalled: tool.endpoint,
        method: tool.method,
        simulatedPayload: sampleParams,
        data: {
          id: `res-${Math.floor(Math.random() * 100000)}`,
          status: 'verified',
          timestamp: new Date().toISOString(),
          details: 'Mock API execution succeeded with valid schema response.',
        },
      },
    };
  },

  // MCP Servers Registry
  async getMcpServers() {
    const cached = storage.get(MCP_SERVERS_KEY);
    if (cached) return cached;
    const defaults = [
      {
        id: 'mcp-fs',
        name: 'Local Filesystem & Markdown MCP',
        url: 'http://localhost:8120/sse',
        transport: 'SSE',
        status: 'CONNECTED',
        tools: [
          { name: 'read_file', description: 'Reads file content from workspace directory' },
          { name: 'write_file', description: 'Writes or updates files in sandbox' },
          { name: 'list_directory', description: 'Lists file hierarchy' },
        ],
      },
      {
        id: 'mcp-database',
        name: 'Database Schema & Query MCP',
        url: 'stdio:postgres-mcp-server',
        transport: 'STDIO',
        status: 'CONNECTED',
        tools: [
          { name: 'describe_tables', description: 'Returns relational SQL table schemas' },
          { name: 'run_readonly_query', description: 'Executes guarded read queries' },
        ],
      },
      {
        id: 'mcp-browser',
        name: 'Playwright Browser Automation MCP',
        url: 'http://localhost:8125/sse',
        transport: 'SSE',
        status: 'STANDBY',
        tools: [
          { name: 'browse_page', description: 'Navigates to URL and takes screenshots' },
          { name: 'click_element', description: 'Clicks CSS selector on active page' },
        ],
      },
    ];
    storage.set(MCP_SERVERS_KEY, defaults);
    return defaults;
  },

  async addMcpServer(serverData) {
    const list = await this.getMcpServers();
    const newServer = {
      id: `mcp-${Date.now().toString(36)}`,
      name: serverData.name,
      url: serverData.url,
      transport: serverData.transport || 'SSE',
      status: 'CONNECTED',
      tools: [
        { name: `${serverData.name.toLowerCase().replace(/\s+/g, '_')}_query`, description: 'Primary query tool' },
        { name: `${serverData.name.toLowerCase().replace(/\s+/g, '_')}_inspect`, description: 'Schema inspector tool' },
      ],
    };
    const updated = [newServer, ...list];
    storage.set(MCP_SERVERS_KEY, updated);
    return newServer;
  },

  async removeMcpServer(serverId) {
    const list = await this.getMcpServers();
    const updated = list.filter((s) => s.id !== serverId);
    storage.set(MCP_SERVERS_KEY, updated);
    return { success: true };
  },
};
