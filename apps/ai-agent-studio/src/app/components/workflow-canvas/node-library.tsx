import { cn } from '@org/utils';
import {
  AlignLeft,
  Binary,
  Bot,
  Boxes,
  Clock,
  Code2,
  Cpu,
  Database,
  FileText,
  Flame,
  Folder,
  GitBranch,
  GitFork,
  Globe,
  Headphones,
  HelpCircle,
  Hourglass,
  Layers,
  MessageSquare,
  Network,
  Play,
  Plug,
  Plus,
  Repeat,
  ScrollText,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Split,
  StickyNote,
  StopCircle,
  Terminal,
  UserCheck,
  Variable,
  Zap,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { useConnectorCatalogNodes } from './connector-nodes.js';

export type NodeCategory =
  | 'all'
  | 'triggers'
  | 'connectors'
  | 'ai'
  | 'knowledge'
  | 'logic'
  | 'transform'
  | 'tools'
  | 'human'
  | 'output'
  | 'annotations';

export interface CatalogNodeItem {
  /** Unique id when several items share a type (one per connector capability). */
  key?: string;
  type: string;
  category: NodeCategory;
  label: string;
  subtitle: string;
  description: string;
  icon: any;
  badge?: string;
  defaultConfig?: Record<string, any>;
}

export const CATALOG_NODES: CatalogNodeItem[] = [
  // 1. TRIGGERS (Module 3.1)
  {
    type: 'START',
    category: 'triggers',
    label: 'Manual Trigger',
    subtitle: 'Start on Demand',
    description: 'Initial entry point for user prompts, testing runs, and manual invocations',
    icon: Play,
    badge: 'Trigger',
    defaultConfig: { triggerType: 'MANUAL', allowCustomInput: true },
  },
  {
    type: 'TRIGGER_CHAT',
    category: 'triggers',
    label: 'Chat Message Trigger',
    subtitle: 'User Inbound Message',
    description: 'Fired when a user sends a message via chat widget, Slack, or embed',
    icon: MessageSquare,
    badge: 'Trigger',
    defaultConfig: { channel: 'all', streamResponses: true },
  },
  {
    type: 'TRIGGER_SCHEDULE',
    category: 'triggers',
    label: 'Schedule Trigger',
    subtitle: 'Cron / Interval Timer',
    description: 'Executes automatically on a predefined cron schedule or periodic timer',
    icon: Clock,
    badge: 'Trigger',
    defaultConfig: { cron: '0 9 * * 1-5', timezone: 'UTC' },
  },
  {
    type: 'TRIGGER_WEBHOOK',
    category: 'triggers',
    label: 'Webhook Trigger',
    subtitle: 'Inbound HTTP POST/GET',
    description: 'Receives external webhook payloads from Stripe, GitHub, or web forms',
    icon: Globe,
    badge: 'Trigger',
    defaultConfig: { httpMethod: 'POST', authRequired: true },
  },
  {
    type: 'APP_CONNECTOR_TRIGGER',
    category: 'triggers',
    label: 'App Event',
    subtitle: 'New email, issue, message…',
    description: 'Starts the agent for each new item in a connected app — pick the app and the event in the inspector',
    icon: Zap,
    badge: 'Connector',
    defaultConfig: { input: {} },
  },
  {
    type: 'TRIGGER_APP_EVENT',
    category: 'triggers',
    label: 'App Event Trigger',
    subtitle: 'Platform Event Stream',
    description: 'Triggers on internal workspace events like record created or deal updated',
    icon: Zap,
    badge: 'Trigger',
    defaultConfig: { eventType: 'document.created' },
  },

  // 2. AI & REASONING (Module 3.2)
  {
    type: 'AGENT',
    category: 'ai',
    label: 'Autonomous AI Agent',
    subtitle: 'Goal-driven Reasoner',
    description: 'Autonomous LLM agent with tools, planning instructions, and memory',
    icon: Bot,
    badge: 'AI',
    defaultConfig: {
      instructions: 'You are an intelligent autonomous AI employee. Execute your assigned tasks carefully.',
      model: 'gpt-4o',
      temperature: 0.3,
      tools: ['firecrawl_search', 'kb_search'],
    },
  },
  {
    type: 'AGENT_COORDINATOR',
    category: 'ai',
    label: 'Supervisor Agent',
    subtitle: 'Multi-agent Team Lead',
    description: 'Leads a team: plug agents into its Sub-agents slot and it delegates work to them',
    icon: Network,
    badge: 'Team',
    defaultConfig: {
      instructions: 'You lead a team of specialist agents. Break the request down, delegate each part to the right sub-agent and combine their results.',
      model: 'gpt-4o',
      temperature: 0.2,
      delegation: 'router',
    },
  },
  {
    type: 'SUB_AGENT',
    category: 'ai',
    label: 'Specialist Sub-Agent',
    subtitle: 'Delegated Worker',
    description: 'Specialized worker agent focused on narrow tasks like research or code review',
    icon: Sparkles,
    badge: 'AI',
    defaultConfig: {
      role: 'Researcher',
      instructions: 'You are a specialist. Complete the part of the task you are given and report back clearly.',
      temperature: 0.2,
    },
  },
  {
    type: 'AI_CHAT_MODEL',
    category: 'ai',
    label: 'LLM / Chat Model',
    subtitle: 'Direct Model Query',
    description: 'Direct completion or chat model invocation without autonomous loop',
    icon: Cpu,
    badge: 'AI',
    defaultConfig: { model: 'gpt-4o', temperature: 0.7, maxTokens: 2048 },
  },
  {
    type: 'PROMPT_TEMPLATE',
    category: 'ai',
    label: 'Prompt',
    subtitle: 'System Prompt',
    description: 'Role, scope and rules an agent follows; plug it into an agent’s Prompt slot',
    icon: ScrollText,
    badge: 'AI',
    defaultConfig: {
      prompt: '## Role\nYou are a helpful assistant.\n\n## Scope\nDescribe what you handle.\n\n## Rules\n- Be concise.',
    },
  },
  {
    type: 'INTENT_CLASSIFIER',
    category: 'ai',
    label: 'Intent Classifier',
    subtitle: 'Route by User Intent',
    description: 'Classifies input text into predefined categories for conditional routing',
    icon: Layers,
    badge: 'AI',
    defaultConfig: { categories: ['Support', 'Sales', 'Billing', 'General'] },
  },
  {
    type: 'STRUCTURED_OUTPUT',
    category: 'ai',
    label: 'Structured Output',
    subtitle: 'Strict JSON Schema',
    description: 'Guarantees valid JSON output matching your defined schema',
    icon: Code2,
    badge: 'AI',
    defaultConfig: { schemaName: 'ExtractedData', schemaDefinition: '{\n  "summary": "string",\n  "status": "string"\n}' },
  },
  {
    type: 'AI_SUMMARIZER',
    category: 'ai',
    label: 'Summarizer',
    subtitle: 'Long Content Brief',
    description: 'Condenses documents and chat histories into bullet points or executive summaries',
    icon: AlignLeft,
    badge: 'AI',
    defaultConfig: { length: 'concise', format: 'bullet_points' },
  },
  {
    type: 'AI_GUARDRAIL',
    category: 'ai',
    label: 'AI Guardrails & Validator',
    subtitle: 'Safety & PII Redaction',
    description: 'Scans prompts and outputs for prompt injection, toxic language, and PII leaks',
    icon: Shield,
    badge: 'AI',
    defaultConfig: { blockPromptInjection: true, redactPII: true },
  },
  {
    type: 'MODEL_ROUTER',
    category: 'ai',
    label: 'Model Router & Fallback',
    subtitle: 'Dynamic Model Switching',
    description: 'Routes simple prompts to cheap models and complex queries to flagship LLMs',
    icon: Split,
    badge: 'AI',
    defaultConfig: { primaryModel: 'gpt-4o-mini', complexModel: 'gpt-4o', fallbackModel: 'claude-3-5-sonnet' },
  },

  // 3. KNOWLEDGE & RETRIEVAL (Module 3.3)
  {
    type: 'KB_SEARCH',
    category: 'knowledge',
    label: 'Knowledge Base Search',
    subtitle: 'Semantic & Hybrid RAG',
    description: 'Searches vector collections for top-k semantically relevant text chunks',
    icon: Search,
    badge: 'RAG',
    defaultConfig: { knowledgeBaseId: 'default-kb', topK: 4, minScore: 0.75 },
  },
  {
    type: 'DOC_RETRIEVAL',
    category: 'knowledge',
    label: 'Document Loader',
    subtitle: 'Parse PDF / DOCX / Web',
    description: 'Loads document text from URLs or cloud drives for runtime parsing',
    icon: FileText,
    badge: 'RAG',
    defaultConfig: { extractTables: true },
  },
  {
    type: 'EMBEDDING_MODEL',
    category: 'knowledge',
    label: 'Embedding Model',
    subtitle: 'Vectorize Text',
    description: 'Turns text into vectors for semantic search over an agent’s knowledge',
    icon: Binary,
    badge: 'RAG',
    defaultConfig: { model: 'text-embedding-3-small', dimensions: 1536 },
  },
  {
    type: 'RERANKER',
    category: 'knowledge',
    label: 'Context Reranker',
    subtitle: 'Cross-Encoder Reorder',
    description: 'Reorders retrieved candidate chunks to surface the highest relevance passages',
    icon: Layers,
    badge: 'RAG',
    defaultConfig: { topK: 3, model: 'cohere-rerank-v3' },
  },

  // 4. LOGIC & CONTROL FLOW (Module 3.4)
  {
    type: 'IF_ELSE',
    category: 'logic',
    label: 'If / Else Branch',
    subtitle: 'Conditional Fork',
    description: 'Evaluates expressions and forks execution to True or False handles',
    icon: GitBranch,
    badge: 'Flow',
    defaultConfig: { operator: 'equals', valueA: '', valueB: '' },
  },
  {
    type: 'SWITCH_CASE',
    category: 'logic',
    label: 'Switch / Router',
    subtitle: 'Multi-Way Branch',
    description: 'Matches variable against multiple case options and branches accordingly',
    icon: Split,
    badge: 'Flow',
    defaultConfig: { cases: ['High', 'Medium', 'Low'] },
  },
  {
    type: 'LOOP',
    category: 'logic',
    label: 'For Each Loop',
    subtitle: 'Iterate Over Array',
    description: 'Loops over array items sequentially or in parallel batches',
    icon: Repeat,
    badge: 'Flow',
    defaultConfig: { batchSize: 1, parallel: false },
  },
  {
    type: 'WAIT_DELAY',
    category: 'logic',
    label: 'Wait / Delay',
    subtitle: 'Execution Pause',
    description: 'Pauses workflow execution for a given duration before continuing',
    icon: Hourglass,
    badge: 'Flow',
    defaultConfig: { delaySeconds: 5 },
  },
  {
    type: 'PARALLEL_SPLIT',
    category: 'logic',
    label: 'Parallel Execution',
    subtitle: 'Concurrent Forks',
    description: 'Forks execution into multiple simultaneous branches to speed up tasks',
    icon: GitFork,
    badge: 'Flow',
    defaultConfig: { waitForAll: true },
  },

  // 5. DATA TRANSFORMATION (Module 3.5)
  {
    type: 'SET_VARIABLE',
    category: 'transform',
    label: 'Set Variable',
    subtitle: 'Store Workflow State',
    description: 'Assigns values to workflow, session, or global state variables',
    icon: Variable,
    badge: 'Data',
    defaultConfig: { variableName: 'myVar', scope: 'workflow' },
  },
  {
    type: 'DATA_MAPPER',
    category: 'transform',
    label: 'Map Data & Fields',
    subtitle: 'Object Transformer',
    description: 'Transforms keys, parses nested structures, and standardizes payload schemas',
    icon: Sliders,
    badge: 'Data',
    defaultConfig: { mappingRules: [{ sourceField: 'id', targetField: 'userId' }] },
  },
  {
    type: 'CODE_JAVASCRIPT',
    category: 'transform',
    label: 'Code (JavaScript)',
    subtitle: 'Custom Script',
    description: 'Executes lightweight sandboxed JavaScript for formatting, mapping, or math',
    icon: Code2,
    badge: 'Code',
    defaultConfig: { code: '// Access input via input\nreturn {\n  success: true,\n  timestamp: Date.now()\n};' },
  },
  {
    type: 'CODE_PYTHON',
    category: 'transform',
    label: 'Code (Python)',
    subtitle: 'Python 3 Script',
    description: 'Executes sandboxed Python script for scientific computation, data cleansing, or Pandas tasks',
    icon: Terminal,
    badge: 'Code',
    defaultConfig: { code: '# Access inputs via input_dict\nreturn {"processed": True, "count": len(input_dict.keys())}' },
  },

  // 6. TOOLS & INTEGRATIONS (Module 3.6)
  {
    type: 'HTTP_REQUEST',
    category: 'tools',
    label: 'HTTP Request (REST)',
    subtitle: 'Generic API Call',
    description: 'Invokes external REST API endpoints with custom headers, query, and payload',
    icon: Globe,
    badge: 'Tools',
    defaultConfig: { method: 'GET', url: 'https://api.example.com/data' },
  },
  {
    type: 'FIRECRAWL_SEARCH',
    category: 'tools',
    label: 'Firecrawl Search',
    subtitle: 'Live Web Search',
    description: 'Searches live web indexes and retrieves sanitized markdown pages and citations',
    icon: Flame,
    badge: 'Firecrawl',
    defaultConfig: { query: '{{input.query}}', limit: 3 },
  },
  {
    type: 'FIRECRAWL_EXTRACT',
    category: 'tools',
    label: 'Firecrawl Extract',
    subtitle: 'Schema Web Scraper',
    description: 'Crawls a specific website URL and extracts structured JSON fields',
    icon: Flame,
    badge: 'Firecrawl',
    defaultConfig: { prompt: 'Extract pricing and features' },
  },
  {
    type: 'MCP_TOOL',
    category: 'tools',
    label: 'MCP Tool Action',
    subtitle: 'Model Context Protocol',
    description: 'Calls a tool registered on a connected Model Context Protocol (MCP) server',
    icon: Plug,
    badge: 'MCP',
    defaultConfig: { serverName: 'Default MCP', toolName: 'search_database' },
  },
  {
    type: 'DB_QUERY',
    category: 'tools',
    label: 'Database Query (SQL)',
    subtitle: 'Postgres / MySQL / Mongo',
    description: 'Executes a parameterized SQL query or Mongo find operation against a connected database',
    icon: Database,
    badge: 'Tools',
    defaultConfig: { connectionId: 'pg-prod', query: 'SELECT * FROM users LIMIT 10' },
  },
  {
    type: 'SLACK_SEND',
    category: 'tools',
    label: 'Slack Notification',
    subtitle: 'Post Channel Alert',
    description: 'Sends rich notifications or interactive blocks to Slack channels',
    icon: MessageSquare,
    badge: 'Tools',
    defaultConfig: { channel: '#agent-alerts', asBot: true },
  },
  {
    type: 'APP_CONNECTOR_ACTION',
    category: 'tools',
    label: 'App Connector Action',
    subtitle: 'Connected SaaS Action',
    description: 'Runs an action or read in any connected app — pick the app and the action in the inspector',
    icon: Boxes,
    badge: 'Connector',
    defaultConfig: { input: {} },
  },

  // 7. HUMAN INTERACTION (Module 3.7)
  {
    type: 'USER_APPROVAL',
    category: 'human',
    label: 'Human Approval',
    subtitle: 'Approval Checkpoint',
    description: 'Pauses workflow execution and creates a review task in the Approval Center',
    icon: UserCheck,
    badge: 'Human',
    defaultConfig: { approverRole: 'Admin', timeoutHours: 24 },
  },
  {
    type: 'HUMAN_INPUT',
    category: 'human',
    label: 'Ask User Question',
    subtitle: 'Clarification Prompt',
    description: 'Prompts the human user to provide clarifying inputs before continuing',
    icon: HelpCircle,
    badge: 'Human',
    defaultConfig: { question: 'Please confirm purchase order number:' },
  },
  {
    type: 'ESCALATE_HUMAN',
    category: 'human',
    label: 'Escalate to Human Agent',
    subtitle: 'Support Handoff',
    description: 'Transfers live chat session to Zendesk or human support team with context summary',
    icon: Headphones,
    badge: 'Human',
    defaultConfig: { priority: 'high', queue: 'Tier 2 Support' },
  },

  // 8. OUTPUTS (Module 3.8)
  {
    type: 'END',
    category: 'output',
    label: 'Workflow Output',
    subtitle: 'Final Output Delivery',
    description: 'Completes workflow execution and delivers final aggregated response',
    icon: StopCircle,
    badge: 'Output',
    defaultConfig: { format: 'markdown' },
  },
  {
    type: 'CHAT_RESPONSE',
    category: 'output',
    label: 'Chat Response Stream',
    subtitle: 'Stream to Chat UI',
    description: 'Streams AI answer markdown, citations, and follow-up pills back to the user',
    icon: MessageSquare,
    badge: 'Output',
    defaultConfig: { stream: true, renderMarkdown: true },
  },
  {
    type: 'WEBHOOK_RESPONSE',
    category: 'output',
    label: 'Webhook Response',
    subtitle: 'Reply to HTTP Caller',
    description: 'Returns a custom HTTP status code and response body to the webhook caller',
    icon: Globe,
    badge: 'Output',
    defaultConfig: { statusCode: 200, contentType: 'application/json' },
  },

  // 9. ANNOTATIONS & CANVAS HELPERS
  {
    type: 'STICKY_NOTE',
    category: 'annotations',
    label: 'Sticky Note',
    subtitle: 'Canvas Note',
    description: 'Yellow sticky note for documentation, instructions, or team comments',
    icon: StickyNote,
    badge: 'Canvas',
    defaultConfig: { note: '### Workflow Notes\nDocument the workflow logic here.' },
  },
  {
    type: 'GROUP',
    category: 'annotations',
    label: 'Stage Group Box',
    subtitle: 'Visual Group Frame',
    description: 'Visual grouping boundary frame to organize complex stages',
    icon: Folder,
    badge: 'Canvas',
    defaultConfig: { label: 'Data Ingestion Stage' },
  },
];

export const CATEGORY_ITEMS: { id: NodeCategory; label: string; count: number }[] = [
  { id: 'all', label: 'All Nodes', count: CATALOG_NODES.length },
  { id: 'triggers', label: 'Triggers', count: CATALOG_NODES.filter((n) => n.category === 'triggers').length },
  { id: 'connectors', label: 'Apps & Connectors', count: CATALOG_NODES.filter((n) => n.type.startsWith('APP_CONNECTOR')).length },
  { id: 'ai', label: 'AI & Reasoning', count: CATALOG_NODES.filter((n) => n.category === 'ai').length },
  { id: 'knowledge', label: 'Knowledge & RAG', count: CATALOG_NODES.filter((n) => n.category === 'knowledge').length },
  { id: 'logic', label: 'Logic & Flow', count: CATALOG_NODES.filter((n) => n.category === 'logic').length },
  { id: 'transform', label: 'Data & Transform', count: CATALOG_NODES.filter((n) => n.category === 'transform').length },
  { id: 'tools', label: 'Tools & Integrations', count: CATALOG_NODES.filter((n) => n.category === 'tools').length },
  { id: 'human', label: 'Human in the Loop', count: CATALOG_NODES.filter((n) => n.category === 'human').length },
  { id: 'output', label: 'Outputs', count: CATALOG_NODES.filter((n) => n.category === 'output').length },
  { id: 'annotations', label: 'Canvas Annotations', count: CATALOG_NODES.filter((n) => n.category === 'annotations').length },
];

export function NodeLibrary({
  className,
  onAddNode,
}: {
  className?: string;
  onAddNode?: (nodeItem: CatalogNodeItem) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory>('all');
  const [search, setSearch] = useState('');
  const connectorNodes = useConnectorCatalogNodes();

  const filteredNodes = useMemo(() => {
    return [...CATALOG_NODES, ...connectorNodes].filter((node) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        node.category === selectedCategory ||
        (selectedCategory === 'connectors' && node.type.startsWith('APP_CONNECTOR'));
      const matchesSearch =
        search.trim() === '' ||
        node.label.toLowerCase().includes(search.toLowerCase()) ||
        node.subtitle.toLowerCase().includes(search.toLowerCase()) ||
        node.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, search, connectorNodes]);

  const onDragStart = (
    event: React.DragEvent,
    nodeData: CatalogNodeItem,
  ) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={cn(
        'flex h-full w-76 flex-col border-r border-border bg-surface select-none overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="border-b border-border p-3 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes & tools…"
            className="w-full rounded-lg border border-border bg-surface-raised pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
          {CATEGORY_ITEMS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'shrink-0 rounded-md px-2 py-1 font-medium transition-colors flex items-center gap-1',
                selectedCategory === cat.id
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
              )}
            >
              <span>{cat.label}</span>
              <span className="text-[9px] opacity-60">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Nodes List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Search className="size-6 text-muted-foreground/40 mb-2" />
            <div className="text-xs font-medium text-foreground">No nodes found</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Try searching for different keywords or select a different category.
            </p>
          </div>
        ) : (
          filteredNodes.map((item) => {
            const Icon = item.icon;
            const connectorId = item.defaultConfig?.connectorId;
            const isConnector = !!connectorId;

            return (
              <div
                key={item.key ?? item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                className="group relative flex cursor-grab flex-col rounded-xl border border-border bg-surface p-2.5 transition-all hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-xs active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-surface-raised text-primary group-hover:bg-primary/10 transition-colors p-1">
                      {isConnector && connectorId ? (
                        <AppConnectorIcon connectorId={connectorId} size={16} />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.badge && (
                      <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground border border-border/50">
                        {item.badge}
                      </span>
                    )}

                    {onAddNode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddNode(item);
                        }}
                        title={`Add ${item.label} to canvas`}
                        className="opacity-0 group-hover:opacity-100 flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
