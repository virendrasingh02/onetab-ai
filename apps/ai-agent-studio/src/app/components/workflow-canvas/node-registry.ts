import {
  Binary,
  Bot,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileText,
  Flame,
  Folder,
  GitBranch,
  GitFork,
  Globe,
  Hourglass,
  Layers,
  MessageSquare,
  Network,
  Play,
  Plug,
  Repeat,
  ScrollText,
  Search,
  Sliders,
  Sparkles,
  Split,
  StickyNote,
  Terminal,
  UserCheck,
  Variable,
  Wrench,
  Zap,
} from 'lucide-react';
import type { NodeCategory } from './node-library.js';

export type HandleType =
  | 'flow'
  | 'string'
  | 'json'
  | 'tool'
  | 'memory'
  | 'prompt'
  | 'condition'
  | 'error'
  | 'any';

export interface NodeHandleDefinition {
  id: string;
  label: string;
  type: HandleType;
  position: 'left' | 'right' | 'top' | 'bottom';
  description?: string;
  required?: boolean;
}

export interface NodeRegistryItem {
  type: string;
  category: NodeCategory;
  label: string;
  subtitle: string;
  description: string;
  icon: any;
  color?: string;
  badge?: string;
  version?: string;
  inputs: NodeHandleDefinition[];
  outputs: NodeHandleDefinition[];
  configSchema?: Record<string, any>;
  defaultConfig?: Record<string, any>;
  capabilities?: string[];
  permissions?: string[];
  resizable?: boolean;
  runtime?: 'client' | 'server' | 'model' | 'connector';
  validation?: (config: Record<string, any>) => string[];
}

/**
 * Scalable Node Registry for AI Agent Studio.
 * Allows nodes to be registered, discovered, and validated independently.
 */
class AgentNodeRegistry {
  private registry = new Map<string, NodeRegistryItem>();

  constructor() {
    this.registerDefaults();
  }

  register(item: NodeRegistryItem): void {
    this.registry.set(item.type.toUpperCase(), item);
  }

  get(type: string): NodeRegistryItem | undefined {
    return this.registry.get(type.toUpperCase());
  }

  getAll(): NodeRegistryItem[] {
    return Array.from(this.registry.values());
  }

  getByCategory(category: NodeCategory | 'all'): NodeRegistryItem[] {
    if (category === 'all') return this.getAll();
    return this.getAll().filter((n) => n.category === category);
  }

  search(query: string): NodeRegistryItem[] {
    if (!query.trim()) return this.getAll();
    const q = query.toLowerCase();
    return this.getAll().filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.subtitle.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        (n.capabilities && n.capabilities.some((c) => c.toLowerCase().includes(q))),
    );
  }

  validate(type: string, config: Record<string, any>): string[] {
    const item = this.get(type);
    if (!item || !item.validation) return [];
    return item.validation(config);
  }

  private registerDefaults(): void {
    const defaultNodes: NodeRegistryItem[] = [
      // 1. Triggers
      {
        type: 'START',
        category: 'triggers',
        label: 'Manual Trigger',
        subtitle: 'Start on Demand',
        description: 'Initial entry point for user prompts, testing runs, and manual invocations',
        icon: Play,
        color: '#10b981',
        badge: 'Trigger',
        version: '1.0.0',
        inputs: [],
        outputs: [{ id: 'output', label: 'Start Flow', type: 'flow', position: 'right' }],
        defaultConfig: { triggerType: 'MANUAL', allowCustomInput: true },
        runtime: 'server',
      },
      {
        type: 'TRIGGER_CHAT',
        category: 'triggers',
        label: 'Chat Message Trigger',
        subtitle: 'User Inbound Message',
        description: 'Fired when a user sends a message via chat widget, Slack, or embed',
        icon: MessageSquare,
        color: '#10b981',
        badge: 'Trigger',
        version: '1.0.0',
        inputs: [],
        outputs: [
          { id: 'output', label: 'User Message', type: 'string', position: 'right' },
          { id: 'metadata', label: 'Sender Info', type: 'json', position: 'right' },
        ],
        defaultConfig: { channel: 'all', streamResponses: true },
        runtime: 'server',
      },
      {
        type: 'TRIGGER_SCHEDULE',
        category: 'triggers',
        label: 'Schedule Trigger',
        subtitle: 'Cron / Interval Timer',
        description: 'Executes automatically on a predefined cron schedule or periodic timer',
        icon: Clock,
        color: '#10b981',
        badge: 'Trigger',
        version: '1.0.0',
        inputs: [],
        outputs: [{ id: 'output', label: 'Tick Flow', type: 'flow', position: 'right' }],
        defaultConfig: { cron: '0 9 * * 1-5', timezone: 'UTC' },
        runtime: 'server',
      },
      {
        type: 'TRIGGER_WEBHOOK',
        category: 'triggers',
        label: 'Webhook Trigger',
        subtitle: 'Inbound HTTP POST/GET',
        description: 'Receives external webhook payloads from Stripe, GitHub, or web forms',
        icon: Globe,
        color: '#10b981',
        badge: 'Trigger',
        version: '1.0.0',
        inputs: [],
        outputs: [
          { id: 'output', label: 'Payload', type: 'json', position: 'right' },
          { id: 'headers', label: 'Headers', type: 'json', position: 'right' },
        ],
        defaultConfig: { httpMethod: 'POST', authRequired: true },
        runtime: 'server',
      },
      {
        type: 'APP_CONNECTOR_TRIGGER',
        category: 'triggers',
        label: 'App Event Trigger',
        subtitle: 'New email, issue, message…',
        description: 'Starts the agent for each new item in a connected app',
        icon: Zap,
        color: '#0ea5e9',
        badge: 'Connector',
        version: '1.0.0',
        inputs: [],
        outputs: [
          { id: 'output', label: 'Event Item', type: 'json', position: 'right' },
        ],
        defaultConfig: { input: {} },
        runtime: 'connector',
      },

      // 2. AI & Agents
      {
        type: 'AGENT',
        category: 'ai',
        label: 'Autonomous AI Agent',
        subtitle: 'Goal-driven Reasoner',
        description: 'Autonomous LLM agent with tools, planning instructions, and memory',
        icon: Bot,
        color: '#6366f1',
        badge: 'AI',
        version: '2.0.0',
        inputs: [
          { id: 'input', label: 'Input Goal', type: 'flow', position: 'left' },
          { id: 'prompt', label: 'Prompt', type: 'prompt', position: 'left' },
          { id: 'llm', label: 'Model', type: 'flow', position: 'left' },
          { id: 'knowledge', label: 'Knowledge', type: 'memory', position: 'left' },
          { id: 'tools', label: 'Tools', type: 'tool', position: 'left' },
          { id: 'agents', label: 'Sub-agents', type: 'flow', position: 'left' },
        ],
        outputs: [
          { id: 'output', label: 'Response', type: 'string', position: 'right' },
          { id: 'tool_call', label: 'Tool Call', type: 'tool', position: 'right' },
          { id: 'error', label: 'Error', type: 'error', position: 'right' },
        ],
        defaultConfig: {
          instructions: 'You are an intelligent autonomous AI employee. Execute your assigned tasks carefully.',
          model: 'gpt-4o',
          temperature: 0.3,
          tools: ['firecrawl_search', 'kb_search'],
        },
        runtime: 'model',
      },
      {
        type: 'AGENT_COORDINATOR',
        category: 'ai',
        label: 'Supervisor Agent',
        subtitle: 'Multi-agent Team Lead',
        description: 'Leads a team: delegates work to specialists and combines results',
        icon: Network,
        color: '#6366f1',
        badge: 'Team',
        version: '2.0.0',
        inputs: [
          { id: 'input', label: 'Task Input', type: 'flow', position: 'left' },
          { id: 'agents', label: 'Team Members', type: 'flow', position: 'left' },
        ],
        outputs: [
          { id: 'output', label: 'Final Output', type: 'string', position: 'right' },
          { id: 'delegation', label: 'Sub-tasks', type: 'json', position: 'right' },
        ],
        defaultConfig: {
          instructions: 'You lead a team of specialist agents. Break the request down, delegate each part to the right sub-agent and combine their results.',
          model: 'gpt-4o',
          temperature: 0.2,
          delegation: 'router',
        },
        runtime: 'model',
      },
      {
        type: 'SUB_AGENT',
        category: 'ai',
        label: 'Specialist Sub-Agent',
        subtitle: 'Delegated Worker',
        description: 'Specialized worker agent focused on narrow tasks like research or review',
        icon: Sparkles,
        color: '#8b5cf6',
        badge: 'AI',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Assigned Task', type: 'flow', position: 'left' }],
        outputs: [{ id: 'output', label: 'Task Result', type: 'string', position: 'right' }],
        defaultConfig: { role: 'Researcher', temperature: 0.2 },
        runtime: 'model',
      },
      {
        type: 'AI_CHAT_MODEL',
        category: 'ai',
        label: 'LLM / Chat Model',
        subtitle: 'Direct Model Query',
        description: 'Direct completion or chat model invocation without autonomous loop',
        icon: Cpu,
        color: '#6366f1',
        badge: 'AI',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Prompt / Input', type: 'flow', position: 'left' }],
        outputs: [
          { id: 'output', label: 'Model Text', type: 'string', position: 'right' },
          { id: 'error', label: 'Error', type: 'error', position: 'right' },
        ],
        defaultConfig: { model: 'gpt-4o', temperature: 0.7, maxTokens: 2048 },
        runtime: 'model',
      },
      {
        type: 'PROMPT_TEMPLATE',
        category: 'ai',
        label: 'Prompt Template',
        subtitle: 'System Instructions',
        description: 'Role, scope and rules an agent follows; plugs into Prompt slots',
        icon: ScrollText,
        color: '#6366f1',
        badge: 'AI',
        version: '1.0.0',
        inputs: [],
        outputs: [{ id: 'output', label: 'Prompt Text', type: 'prompt', position: 'right' }],
        defaultConfig: {
          prompt: '## Role\nYou are a helpful assistant.\n\n## Scope\nDescribe what you handle.\n\n## Rules\n- Be concise.',
        },
        runtime: 'client',
      },
      {
        type: 'INTENT_CLASSIFIER',
        category: 'ai',
        label: 'Intent Classifier',
        subtitle: 'Route by User Intent',
        description: 'Classifies input text into predefined categories for conditional routing',
        icon: Layers,
        color: '#8b5cf6',
        badge: 'AI',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Text Input', type: 'string', position: 'left' }],
        outputs: [
          { id: 'output', label: 'Category', type: 'string', position: 'right' },
          { id: 'confidence', label: 'Confidence', type: 'string', position: 'right' },
        ],
        defaultConfig: { categories: ['Support', 'Sales', 'Billing', 'General'] },
        runtime: 'model',
      },

      // 3. Knowledge & RAG
      {
        type: 'KB_SEARCH',
        category: 'knowledge',
        label: 'Knowledge Base Search',
        subtitle: 'Semantic & Hybrid RAG',
        description: 'Searches vector collections for top-k semantically relevant chunks',
        icon: Search,
        color: '#0ea5e9',
        badge: 'RAG',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Query', type: 'string', position: 'left' }],
        outputs: [{ id: 'output', label: 'Relevant Passages', type: 'memory', position: 'right' }],
        defaultConfig: { knowledgeBaseId: 'default-kb', topK: 4, minScore: 0.75 },
        runtime: 'server',
      },
      {
        type: 'DOC_RETRIEVAL',
        category: 'knowledge',
        label: 'Document Loader',
        subtitle: 'Parse PDF / DOCX / Web',
        description: 'Loads document text from files, URLs or cloud storage',
        icon: FileText,
        color: '#0ea5e9',
        badge: 'RAG',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Document URL/Path', type: 'string', position: 'left' }],
        outputs: [{ id: 'output', label: 'Parsed Text', type: 'string', position: 'right' }],
        defaultConfig: { extractTables: true },
        runtime: 'server',
      },
      {
        type: 'EMBEDDING_MODEL',
        category: 'knowledge',
        label: 'Embedding Model',
        subtitle: 'Vectorize Text',
        description: 'Turns text into dense vectors for semantic search',
        icon: Binary,
        color: '#0ea5e9',
        badge: 'RAG',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Input Text', type: 'string', position: 'left' }],
        outputs: [{ id: 'output', label: 'Vector Float Array', type: 'json', position: 'right' }],
        defaultConfig: { model: 'text-embedding-3-small', dimensions: 1536 },
        runtime: 'model',
      },

      // 4. Logic & Flow
      {
        type: 'IF_ELSE',
        category: 'logic',
        label: 'If / Else Branch',
        subtitle: 'Conditional Fork',
        description: 'Evaluates expressions and forks execution to True or False branches',
        icon: GitBranch,
        color: '#8b5cf6',
        badge: 'Flow',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Input Data', type: 'flow', position: 'left' }],
        outputs: [
          { id: 'true', label: 'True', type: 'condition', position: 'right' },
          { id: 'false', label: 'False', type: 'condition', position: 'right' },
        ],
        defaultConfig: { operator: 'equals', valueA: '', valueB: '' },
        runtime: 'server',
      },
      {
        type: 'SWITCH_CASE',
        category: 'logic',
        label: 'Switch / Router',
        subtitle: 'Multi-Way Branch',
        description: 'Matches variable against multiple case options and branches accordingly',
        icon: Split,
        color: '#8b5cf6',
        badge: 'Flow',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Input Value', type: 'flow', position: 'left' }],
        outputs: [
          { id: 'case_1', label: 'Case 1', type: 'condition', position: 'right' },
          { id: 'case_2', label: 'Case 2', type: 'condition', position: 'right' },
          { id: 'default', label: 'Default', type: 'condition', position: 'right' },
        ],
        defaultConfig: { cases: ['High', 'Medium', 'Low'] },
        runtime: 'server',
      },
      {
        type: 'LOOP',
        category: 'logic',
        label: 'For Each Loop',
        subtitle: 'Iterate Over Array',
        description: 'Loops over array items sequentially or in parallel batches',
        icon: Repeat,
        color: '#8b5cf6',
        badge: 'Flow',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Array Input', type: 'flow', position: 'left' }],
        outputs: [
          { id: 'each', label: 'Each Item', type: 'flow', position: 'right' },
          { id: 'done', label: 'When Done', type: 'flow', position: 'right' },
        ],
        defaultConfig: { batchSize: 1, parallel: false },
        runtime: 'server',
      },
      {
        type: 'PARALLEL_SPLIT',
        category: 'logic',
        label: 'Parallel Execution',
        subtitle: 'Concurrent Forks',
        description: 'Forks execution into multiple simultaneous branches',
        icon: GitFork,
        color: '#8b5cf6',
        badge: 'Flow',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Inbound', type: 'flow', position: 'left' }],
        outputs: [
          { id: 'branch_1', label: 'Branch 1', type: 'flow', position: 'right' },
          { id: 'branch_2', label: 'Branch 2', type: 'flow', position: 'right' },
        ],
        defaultConfig: { waitForAll: true },
        runtime: 'server',
      },
      {
        type: 'WAIT_DELAY',
        category: 'logic',
        label: 'Wait / Delay',
        subtitle: 'Execution Pause',
        description: 'Pauses workflow execution for a given duration before continuing',
        icon: Hourglass,
        color: '#8b5cf6',
        badge: 'Flow',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Before Pause', type: 'flow', position: 'left' }],
        outputs: [{ id: 'output', label: 'After Pause', type: 'flow', position: 'right' }],
        defaultConfig: { delaySeconds: 5 },
        runtime: 'server',
      },

      // 5. Data & Transform
      {
        type: 'SET_VARIABLE',
        category: 'transform',
        label: 'Set Variable',
        subtitle: 'Store Workflow State',
        description: 'Assigns values to workflow, session, or global state variables',
        icon: Variable,
        color: '#0ea5e9',
        badge: 'Data',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Source Value', type: 'flow', position: 'left' }],
        outputs: [{ id: 'output', label: 'Next Step', type: 'flow', position: 'right' }],
        defaultConfig: { variableName: 'myVar', scope: 'workflow' },
        runtime: 'server',
      },
      {
        type: 'DATA_MAPPER',
        category: 'transform',
        label: 'Map Data & Fields',
        subtitle: 'Object Transformer',
        description: 'Transforms keys, parses nested structures, and standardizes schemas',
        icon: Sliders,
        color: '#0ea5e9',
        badge: 'Data',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Raw Object', type: 'json', position: 'left' }],
        outputs: [{ id: 'output', label: 'Mapped Object', type: 'json', position: 'right' }],
        defaultConfig: { mappingRules: [{ sourceField: 'id', targetField: 'userId' }] },
        runtime: 'server',
      },
      {
        type: 'CODE_JAVASCRIPT',
        category: 'transform',
        label: 'Code (JavaScript)',
        subtitle: 'Custom Script',
        description: 'Executes lightweight sandboxed JavaScript for formatting, mapping, or math',
        icon: Code2,
        color: '#f59e0b',
        badge: 'Code',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Script Input', type: 'flow', position: 'left' }],
        outputs: [{ id: 'output', label: 'Return Value', type: 'json', position: 'right' }],
        defaultConfig: { code: '// Access input via input\nreturn {\n  success: true,\n  timestamp: Date.now()\n};' },
        resizable: true,
        runtime: 'server',
      },
      {
        type: 'CODE_PYTHON',
        category: 'transform',
        label: 'Code (Python)',
        subtitle: 'Python 3 Script',
        description: 'Executes sandboxed Python script for scientific computation or data cleansing',
        icon: Terminal,
        color: '#f59e0b',
        badge: 'Code',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Script Input', type: 'flow', position: 'left' }],
        outputs: [{ id: 'output', label: 'Return Value', type: 'json', position: 'right' }],
        defaultConfig: { code: '# Access inputs via input_dict\nreturn {"processed": True}' },
        resizable: true,
        runtime: 'server',
      },

      // 6. Tools & Integrations
      {
        type: 'HTTP_REQUEST',
        category: 'tools',
        label: 'HTTP Request (REST)',
        subtitle: 'Generic API Call',
        description: 'Invokes external REST API endpoints with custom headers, query, and payload',
        icon: Globe,
        color: '#6366f1',
        badge: 'Tools',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Trigger', type: 'flow', position: 'left' }],
        outputs: [
          { id: 'output', label: 'Response Body', type: 'json', position: 'right' },
          { id: 'status', label: 'Status Code', type: 'string', position: 'right' },
          { id: 'error', label: 'Error', type: 'error', position: 'right' },
        ],
        defaultConfig: { method: 'GET', url: 'https://api.example.com/data' },
        runtime: 'server',
      },
      {
        type: 'FIRECRAWL_SEARCH',
        category: 'tools',
        label: 'Web Search (Firecrawl)',
        subtitle: 'Real-time Web SERP',
        description: 'Queries live web search engines and returns markdown content for top citations',
        icon: Flame,
        color: '#f59e0b',
        badge: 'Tools',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Query', type: 'string', position: 'left' }],
        outputs: [
          { id: 'output', label: 'Search Results', type: 'json', position: 'right' },
          { id: 'markdown', label: 'Markdown', type: 'string', position: 'right' },
        ],
        defaultConfig: { query: 'latest tech news', limit: 5 },
        runtime: 'server',
      },
      {
        type: 'FIRECRAWL_SCRAPE',
        category: 'tools',
        label: 'Web Scraper (Firecrawl)',
        subtitle: 'Clean Markdown Scrape',
        description: 'Extracts full LLM-ready markdown and metadata from any public URL',
        icon: Flame,
        color: '#f59e0b',
        badge: 'Tools',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Target URL', type: 'string', position: 'left' }],
        outputs: [
          { id: 'output', label: 'Clean Markdown', type: 'string', position: 'right' },
          { id: 'metadata', label: 'Page Metadata', type: 'json', position: 'right' },
        ],
        defaultConfig: { url: 'https://example.com', onlyMainContent: true },
        runtime: 'server',
      },
      {
        type: 'MCP_TOOL',
        category: 'tools',
        label: 'MCP Tool',
        subtitle: 'Model Context Protocol',
        description: 'Executes tools provided by linked MCP servers or local platform plugins',
        icon: Wrench,
        color: '#6366f1',
        badge: 'Tools',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Arguments', type: 'tool', position: 'left' }],
        outputs: [{ id: 'output', label: 'Tool Output', type: 'json', position: 'right' }],
        defaultConfig: { toolName: 'execute_tool' },
        runtime: 'server',
      },
      {
        type: 'APP_CONNECTOR_ACTION',
        category: 'connectors',
        label: 'App Action',
        subtitle: 'Run connected app action',
        description: 'Runs an action in a connected app (Slack, Teams, Gmail, GitHub, Linear…)',
        icon: Plug,
        color: '#0ea5e9',
        badge: 'Connector',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Action Params', type: 'flow', position: 'left' }],
        outputs: [
          { id: 'output', label: 'Action Result', type: 'json', position: 'right' },
          { id: 'error', label: 'Error', type: 'error', position: 'right' },
        ],
        defaultConfig: { input: {} },
        runtime: 'connector',
      },

      // 7. Human in the Loop
      {
        type: 'USER_APPROVAL',
        category: 'human',
        label: 'Human Approval',
        subtitle: 'Review Gate',
        description: 'Pauses the workflow and requests explicit reviewer approval before continuing',
        icon: UserCheck,
        color: '#f43f5e',
        badge: 'Human',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Draft to Review', type: 'flow', position: 'left' }],
        outputs: [
          { id: 'approved', label: 'Approved', type: 'flow', position: 'right' },
          { id: 'rejected', label: 'Rejected', type: 'flow', position: 'right' },
        ],
        defaultConfig: { timeoutHours: 24, prompt: 'Please review and approve this action.' },
        runtime: 'server',
      },

      // 8. Outputs
      {
        type: 'END',
        category: 'output',
        label: 'Workflow Output',
        subtitle: 'Finalize Execution',
        description: 'Concludes the workflow and yields structured output back to caller or API',
        icon: CheckCircle2,
        color: '#10b981',
        badge: 'Output',
        version: '1.0.0',
        inputs: [{ id: 'input', label: 'Final Result', type: 'flow', position: 'left' }],
        outputs: [],
        defaultConfig: { responseKey: 'result' },
        runtime: 'server',
      },

      // 9. Annotations & Structure
      {
        type: 'STICKY_NOTE',
        category: 'annotations',
        label: 'Sticky Note',
        subtitle: 'Documentation',
        description: 'Freeform sticky note for architecture diagrams and team instructions',
        icon: StickyNote,
        color: '#fbbf24',
        badge: 'Note',
        version: '1.0.0',
        inputs: [],
        outputs: [],
        defaultConfig: { text: '', color: 'yellow' },
        resizable: true,
        runtime: 'client',
      },
      {
        type: 'GROUP',
        category: 'annotations',
        label: 'Stage / Group',
        subtitle: 'Container Box',
        description: 'Groups related workflow steps together visually with resize handles',
        icon: Folder,
        color: '#64748b',
        badge: 'Group',
        version: '1.0.0',
        inputs: [],
        outputs: [],
        defaultConfig: { title: 'Stage 1' },
        resizable: true,
        runtime: 'client',
      },
    ];

    for (const item of defaultNodes) {
      this.register(item);
    }
  }
}

export const agentNodeRegistry = new AgentNodeRegistry();
export const getAllRegistryNodes = () => agentNodeRegistry.getAll();
export const getRegistryNode = (type: string) => agentNodeRegistry.get(type);
export const getNodeDefinition = (type: string) => {
  const norm = type.toUpperCase();
  if (norm === 'AI_AGENT') return agentNodeRegistry.get('AGENT');
  if (norm === 'LLM') return agentNodeRegistry.get('AI_CHAT_MODEL');
  if (norm === 'HUMAN_APPROVAL') return agentNodeRegistry.get('USER_APPROVAL');
  if (norm === 'FIRECRAWL') return agentNodeRegistry.get('FIRECRAWL_SEARCH');
  if (norm === 'CONDITION') return agentNodeRegistry.get('IF_ELSE');
  if (['SLACK', 'TEAMS', 'GMAIL', 'GITHUB', 'LINEAR', 'JIRA'].includes(norm)) {
    return agentNodeRegistry.get('APP_CONNECTOR_ACTION');
  }
  return agentNodeRegistry.get(norm);
};
export { AgentNodeRegistry };
