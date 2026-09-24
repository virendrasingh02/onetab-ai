import { cn } from '@org/utils';
import {
  Activity,
  Bot,
  Brain,
  Code2,
  Cpu,
  Database,
  Flame,
  GitBranch,
  Globe,
  Layers,
  Play,
  Repeat,
  Search,
  ShieldAlert,
  Sparkles,
  StopCircle,
  Timer,
  UserCheck,
  Variable,
  Wrench,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

export type NodeCategory =
  | 'all'
  | 'core'
  | 'ai'
  | 'firecrawl'
  | 'tools'
  | 'logic'
  | 'data'
  | 'human'
  | 'advanced';

export interface CatalogNodeItem {
  type: string;
  category: NodeCategory;
  label: string;
  subtitle: string;
  description: string;
  icon: typeof Bot;
  badge?: string;
  defaultConfig?: Record<string, any>;
}

export const CATALOG_NODES: CatalogNodeItem[] = [
  // Core
  {
    type: 'START',
    category: 'core',
    label: 'Start Entry',
    subtitle: 'Entrypoint',
    description: 'Initial entry point for user prompts and webhook payloads',
    icon: Play,
    badge: 'Core',
    defaultConfig: { triggerType: 'MANUAL' },
  },
  {
    type: 'END',
    category: 'core',
    label: 'End / Output',
    subtitle: 'Final delivery',
    description: 'Terminates workflow and outputs the aggregated response',
    icon: StopCircle,
    badge: 'Core',
    defaultConfig: { format: 'markdown' },
  },

  // AI & Reasoning
  {
    type: 'AGENT',
    category: 'ai',
    label: 'AI Agent',
    subtitle: 'Model Execution',
    description: 'Autonomous LLM agent with tools, prompt instructions, and memory',
    icon: Bot,
    badge: 'AI',
    defaultConfig: {
      instructions: 'You are an intelligent assistant. Execute your assigned task with diligence.',
      model: 'llama3:latest',
      temperature: 0.7,
      tools: ['search_docs'],
    },
  },
  {
    type: 'SUB_AGENT',
    category: 'ai',
    label: 'Sub-Agent',
    subtitle: 'Specialist Delegate',
    description: 'Specialized agent delegated specific sub-tasks by the supervisor',
    icon: Sparkles,
    badge: 'AI',
    defaultConfig: { role: 'Researcher', model: 'llama3:latest' },
  },

  // Firecrawl Web Intelligence
  {
    type: 'FIRECRAWL_SEARCH',
    category: 'firecrawl',
    label: 'Firecrawl Search',
    subtitle: 'Web Search API',
    description: 'Searches live web indexes and retrieves content and citations',
    icon: Flame,
    badge: 'Firecrawl',
    defaultConfig: { query: '{{input.query}}', limit: 5 },
  },
  {
    type: 'FIRECRAWL_SCRAPE',
    category: 'firecrawl',
    label: 'Firecrawl Scrape',
    subtitle: 'HTML to Markdown',
    description: 'Scrapes target URL and cleans into LLM-ready markdown',
    icon: Globe,
    badge: 'Firecrawl',
    defaultConfig: { url: 'https://news.ycombinator.com', onlyMainContent: true },
  },
  {
    type: 'FIRECRAWL_CRAWL',
    category: 'firecrawl',
    label: 'Firecrawl Crawl',
    subtitle: 'Multi-page Spider',
    description: 'Recursively crawls an entire domain or documentation site',
    icon: Layers,
    badge: 'Firecrawl',
    defaultConfig: { url: 'https://docs.example.com', limit: 5 },
  },
  {
    type: 'FIRECRAWL_EXTRACT',
    category: 'firecrawl',
    label: 'Firecrawl Extract',
    subtitle: 'Structured Extraction',
    description: 'Extracts validated JSON entities from any URL using AI schemas',
    icon: Zap,
    badge: 'Firecrawl',
    defaultConfig: { prompt: 'Extract pricing tiers and features' },
  },

  // Tools & MCP
  {
    type: 'MCP_TOOL',
    category: 'tools',
    label: 'MCP Tool',
    subtitle: 'Model Context Protocol',
    description: 'Executes an MCP tool from connected local or remote MCP servers',
    icon: Wrench,
    badge: 'MCP',
    defaultConfig: { toolName: 'search_docs', input: {} },
  },
  {
    type: 'HTTP_REQUEST',
    category: 'tools',
    label: 'HTTP Request / API',
    subtitle: 'REST Endpoint',
    description: 'Calls external HTTP APIs with custom headers, method, and body',
    icon: Cpu,
    badge: 'API',
    defaultConfig: { method: 'GET', url: 'https://api.example.com/data' },
  },

  // Logic & Flow Control
  {
    type: 'IF_ELSE',
    category: 'logic',
    label: 'If / Else Branch',
    subtitle: 'Conditional Gate',
    description: 'Branches workflow execution based on variable evaluation',
    icon: GitBranch,
    badge: 'Logic',
    defaultConfig: { variable: 'status', operator: 'equals', value: 'approved' },
  },
  {
    type: 'WHILE_LOOP',
    category: 'logic',
    label: 'While Loop',
    subtitle: 'Iteration Control',
    description: 'Repeats a sub-flow while a boolean condition remains satisfied',
    icon: Repeat,
    badge: 'Logic',
    defaultConfig: { maxIterations: 5 },
  },

  // Data & Computation
  {
    type: 'TRANSFORM',
    category: 'data',
    label: 'Transform / Template',
    subtitle: 'Data Mapping',
    description: 'Maps, interpolates variables, and transforms JSON data payloads',
    icon: Code2,
    badge: 'Data',
    defaultConfig: { template: 'Summary: {{agent.output}}' },
  },
  {
    type: 'VARIABLE',
    category: 'data',
    label: 'Variable Setter',
    subtitle: 'State Variable',
    description: 'Sets or updates a shared workflow context variable',
    icon: Variable,
    badge: 'Data',
    defaultConfig: { name: 'leadScore', value: '100' },
  },

  // Human in the Loop
  {
    type: 'USER_APPROVAL',
    category: 'human',
    label: 'User Approval',
    subtitle: 'Human Gate',
    description: 'Pauses workflow execution until an operator confirms or rejects',
    icon: UserCheck,
    badge: 'Human',
    defaultConfig: { action: 'Approve sensitive action', required: true },
  },

  // Advanced
  {
    type: 'WAIT',
    category: 'advanced',
    label: 'Wait / Delay',
    subtitle: 'Pause Timer',
    description: 'Pauses workflow for a specified number of seconds',
    icon: Timer,
    badge: 'Timer',
    defaultConfig: { delayMs: 2000 },
  },
];

const CATEGORIES: Array<{ id: NodeCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Core' },
  { id: 'ai', label: 'AI' },
  { id: 'firecrawl', label: 'Firecrawl' },
  { id: 'tools', label: 'Tools' },
  { id: 'logic', label: 'Logic' },
  { id: 'data', label: 'Data' },
  { id: 'human', label: 'Human' },
  { id: 'advanced', label: 'Advanced' },
];

export function NodeLibrary({ className }: { className?: string }) {
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory>('all');
  const [search, setSearch] = useState('');

  const filteredNodes = CATALOG_NODES.filter((node) => {
    const matchesCategory =
      selectedCategory === 'all' || node.category === selectedCategory;
    const matchesSearch =
      node.label.toLowerCase().includes(search.toLowerCase()) ||
      node.description.toLowerCase().includes(search.toLowerCase()) ||
      node.type.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const onDragStart = (e: React.DragEvent, node: CatalogNodeItem) => {
    e.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        type: node.type,
        label: node.label,
        subtitle: node.subtitle,
        config: node.defaultConfig || {},
      }),
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={cn(
        'flex h-full w-72 flex-col border-r border-border bg-surface select-none',
        className,
      )}
    >
      {/* Header & Search */}
      <div className="border-b border-border p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-foreground">Node Library</div>
          <span className="text-[10px] text-muted-foreground">
            Drag to canvas
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search nodes & tools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-surface-raised pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Categories horizontal scroll / pill bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors',
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-raised text-muted-foreground hover:text-foreground',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nodes list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredNodes.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No nodes found
          </div>
        ) : (
          filteredNodes.map((node) => {
            const Icon = node.icon;
            return (
              <div
                key={node.type}
                draggable
                onDragStart={(e) => onDragStart(e, node)}
                className="group flex cursor-grab items-start gap-2.5 rounded-xl border border-border bg-surface-raised/40 p-2.5 transition-all hover:border-primary/50 hover:bg-surface-raised active:cursor-grabbing hover:shadow-xs"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface border border-border group-hover:border-primary/30 group-hover:text-primary transition-colors text-muted-foreground">
                  <Icon className="size-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {node.label}
                    </span>
                    {node.badge && (
                      <span className="rounded bg-surface px-1 py-0.2 text-[9px] font-medium text-muted-foreground border border-border shrink-0">
                        {node.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
                    {node.description}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
