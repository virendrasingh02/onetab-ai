export interface WorkflowNodeData {
  label: string;
  subtitle?: string;
  config?: Record<string, any>;
  [key: string]: any;
}

export interface StudioTemplate {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'automation' | 'support' | 'writer' | 'data' | 'multi-agent';
  icon: string;
  recommendedModel: string;
  recommendedProvider: string;
  tags: string[];
  requiredTools: string[];
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: WorkflowNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    sourceHandle?: string;
  }>;
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: 'web-research-agent',
    name: 'Web Research Agent',
    description: 'Searches the web via Firecrawl, scrapes target sources, and produces a structured research briefing with citations.',
    category: 'research',
    icon: 'Globe',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Firecrawl', 'Web Search', 'Research', 'Markdown'],
    requiredTools: ['firecrawl_search', 'firecrawl_scrape'],
    nodes: [
      {
        id: 'start-1',
        type: 'START',
        position: { x: 50, y: 180 },
        data: { label: 'Start Entry', subtitle: 'User search query' },
      },
      {
        id: 'search-1',
        type: 'FIRECRAWL_SEARCH',
        position: { x: 300, y: 180 },
        data: {
          label: 'Firecrawl Search',
          subtitle: 'Search web indexes',
          config: { query: '{{input.query}}', limit: 5 },
        },
      },
      {
        id: 'agent-1',
        type: 'AGENT',
        position: { x: 580, y: 180 },
        data: {
          label: 'Research Synthesizer',
          subtitle: 'Extract facts & cite sources',
          config: {
            instructions: 'Analyze search results and write a factual executive summary with bullet points and source links.',
            model: 'llama3:latest',
            temperature: 0.3,
          },
        },
      },
      {
        id: 'transform-1',
        type: 'TRANSFORM',
        position: { x: 860, y: 180 },
        data: {
          label: 'Format Report',
          subtitle: 'Clean markdown & metadata',
          config: { template: '{{agent.output}}' },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1120, y: 180 },
        data: { label: 'Research Completed', subtitle: 'Deliver report' },
      },
    ],
    edges: [
      { id: 'e1-2', source: 'start-1', target: 'search-1' },
      { id: 'e2-3', source: 'search-1', target: 'agent-1' },
      { id: 'e3-4', source: 'agent-1', target: 'transform-1' },
      { id: 'e4-5', source: 'transform-1', target: 'end-1' },
    ],
  },
  {
    id: 'deep-research-agent',
    name: 'Deep Research Agent',
    description: 'Multi-stage deep research: crawl authoritative domains, extract entities, evaluate findings, and format report.',
    category: 'research',
    icon: 'Search',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Firecrawl Crawl', 'Multi-step', 'Synthesis'],
    requiredTools: ['firecrawl_search', 'firecrawl_crawl', 'firecrawl_extract'],
    nodes: [
      {
        id: 'node-start',
        type: 'START',
        position: { x: 40, y: 160 },
        data: { label: 'Research Topic', subtitle: 'Deep inquiry goal' },
      },
      {
        id: 'node-search',
        type: 'FIRECRAWL_SEARCH',
        position: { x: 280, y: 160 },
        data: { label: 'Identify Authorities', subtitle: 'Firecrawl top sources', config: { query: '{{input.topic}}', limit: 3 } },
      },
      {
        id: 'node-crawl',
        type: 'FIRECRAWL_CRAWL',
        position: { x: 540, y: 160 },
        data: { label: 'Crawl Deep Pages', subtitle: 'Extract subpages', config: { url: '{{search.topUrl}}', limit: 4 } },
      },
      {
        id: 'node-agent',
        type: 'AGENT',
        position: { x: 800, y: 160 },
        data: { label: 'Deep Analyst', subtitle: 'Triangulate findings', config: { instructions: 'Triangulate data points across all crawled documents. Highlight contradictions and conclusions.' } },
      },
      {
        id: 'node-end',
        type: 'END',
        position: { x: 1060, y: 160 },
        data: { label: 'Complete Deep Brief', subtitle: 'Final dossier' },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-search' },
      { id: 'e2', source: 'node-search', target: 'node-crawl' },
      { id: 'e3', source: 'node-crawl', target: 'node-agent' },
      { id: 'e4', source: 'node-agent', target: 'node-end' },
    ],
  },
  {
    id: 'competitor-research',
    name: 'Competitor Research',
    description: 'Searches competitors in your market, scrapes their feature matrix and pricing plans, and outputs comparison table.',
    category: 'research',
    icon: 'TrendingUp',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Market Intel', 'Firecrawl', 'Comparison'],
    requiredTools: ['firecrawl_search', 'firecrawl_scrape'],
    nodes: [
      { id: 'c1', type: 'START', position: { x: 60, y: 180 }, data: { label: 'Competitor Name', subtitle: 'Target company or URL' } },
      { id: 'c2', type: 'FIRECRAWL_SEARCH', position: { x: 300, y: 180 }, data: { label: 'Find Pricing & Product', subtitle: 'Firecrawl search', config: { query: '{{input.competitor}} pricing features' } } },
      { id: 'c3', type: 'FIRECRAWL_SCRAPE', position: { x: 560, y: 180 }, data: { label: 'Scrape Pricing Page', subtitle: 'Extract raw tables' } },
      { id: 'c4', type: 'AGENT', position: { x: 820, y: 180 }, data: { label: 'Competitive Analyst', subtitle: 'Build matrix', config: { instructions: 'Build a comparative breakdown of tiers, pricing, and key features.' } } },
      { id: 'c5', type: 'END', position: { x: 1080, y: 180 }, data: { label: 'Deliver Comparison Matrix', subtitle: 'Markdown table' } },
    ],
    edges: [
      { id: 'ec1', source: 'c1', target: 'c2' },
      { id: 'ec2', source: 'c2', target: 'c3' },
      { id: 'ec3', source: 'c3', target: 'c4' },
      { id: 'ec4', source: 'c4', target: 'c5' },
    ],
  },
  {
    id: 'website-monitoring',
    name: 'Website Monitoring Agent',
    description: 'Scrapes a target website, analyzes content for updates or outages, and alerts with human confirmation.',
    category: 'automation',
    icon: 'Activity',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Monitoring', 'Cron', 'Alerts'],
    requiredTools: ['firecrawl_scrape'],
    nodes: [
      { id: 'w1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'Scheduled Trigger', subtitle: 'Hourly check' } },
      { id: 'w2', type: 'FIRECRAWL_SCRAPE', position: { x: 290, y: 180 }, data: { label: 'Scrape Page', subtitle: 'Fetch current HTML/MD', config: { url: '{{input.url}}' } } },
      { id: 'w3', type: 'AGENT', position: { x: 540, y: 180 }, data: { label: 'Diff Detector', subtitle: 'Compare against memory', config: { instructions: 'Check if there are breaking changes, price updates, or downtime messages.' } } },
      { id: 'w4', type: 'IF_ELSE', position: { x: 790, y: 180 }, data: { label: 'Has Critical Change?', subtitle: 'Condition check', config: { variable: 'hasChange', operator: 'equals', value: 'true' } } },
      { id: 'w5', type: 'USER_APPROVAL', position: { x: 1040, y: 120 }, data: { label: 'Approve Alert', subtitle: 'Confirm broadcast', config: { action: 'Send critical website alert' } } },
      { id: 'w6', type: 'END', position: { x: 1280, y: 180 }, data: { label: 'Done', subtitle: 'Logged' } },
    ],
    edges: [
      { id: 'ew1', source: 'w1', target: 'w2' },
      { id: 'ew2', source: 'w2', target: 'w3' },
      { id: 'ew3', source: 'w3', target: 'w4' },
      { id: 'ew4', source: 'w4', target: 'w5', label: 'True', sourceHandle: 'true' },
      { id: 'ew5', source: 'w4', target: 'w6', label: 'False', sourceHandle: 'false' },
      { id: 'ew6', source: 'w5', target: 'w6' },
    ],
  },
  {
    id: 'price-monitoring',
    name: 'Price Monitoring Agent',
    description: 'Tracks ecommerce or SaaS pricing, triggers approval if price drops below target threshold.',
    category: 'automation',
    icon: 'Tag',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['E-Commerce', 'Pricing', 'Conditional'],
    requiredTools: ['firecrawl_extract'],
    nodes: [
      { id: 'p1', type: 'START', position: { x: 60, y: 180 }, data: { label: 'Check Schedule', subtitle: 'Daily run' } },
      { id: 'p2', type: 'FIRECRAWL_EXTRACT', position: { x: 300, y: 180 }, data: { label: 'Extract Price', subtitle: 'Extract current price float', config: { prompt: 'Extract numeric price' } } },
      { id: 'p3', type: 'IF_ELSE', position: { x: 560, y: 180 }, data: { label: 'Price <= Target?', subtitle: 'Threshold check', config: { variable: 'price', operator: '<=', value: '100' } } },
      { id: 'p4', type: 'USER_APPROVAL', position: { x: 820, y: 120 }, data: { label: 'Approve Purchase', subtitle: 'Human signoff' } },
      { id: 'p5', type: 'END', position: { x: 1080, y: 180 }, data: { label: 'Summary Complete', subtitle: 'Log record' } },
    ],
    edges: [
      { id: 'ep1', source: 'p1', target: 'p2' },
      { id: 'ep2', source: 'p2', target: 'p3' },
      { id: 'ep3', source: 'p3', target: 'p4', label: 'Yes' },
      { id: 'ep4', source: 'p3', target: 'p5', label: 'No' },
      { id: 'ep5', source: 'p4', target: 'p5' },
    ],
  },
  {
    id: 'content-writer',
    name: 'Content Writer Agent',
    description: 'Researches a topic on the web, outlines key sections, drafts an engaging article, and requests editor review.',
    category: 'writer',
    icon: 'PenTool',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Copywriting', 'SEO', 'Editorial'],
    requiredTools: ['firecrawl_search'],
    nodes: [
      { id: 'cw1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'Article Topic & Tone', subtitle: 'Input prompt' } },
      { id: 'cw2', type: 'FIRECRAWL_SEARCH', position: { x: 290, y: 180 }, data: { label: 'Research Keywords', subtitle: 'Find trending angles' } },
      { id: 'cw3', type: 'AGENT', position: { x: 540, y: 180 }, data: { label: 'Staff Writer', subtitle: 'Draft article with headers', config: { instructions: 'Write a comprehensive 800-word article following SEO best practices and natural storytelling.' } } },
      { id: 'cw4', type: 'USER_APPROVAL', position: { x: 800, y: 180 }, data: { label: 'Editorial Signoff', subtitle: 'Review & approve publication' } },
      { id: 'cw5', type: 'END', position: { x: 1060, y: 180 }, data: { label: 'Publish Ready', subtitle: 'Ready for CMS' } },
    ],
    edges: [
      { id: 'ecw1', source: 'cw1', target: 'cw2' },
      { id: 'ecw2', source: 'cw2', target: 'cw3' },
      { id: 'ecw3', source: 'cw3', target: 'cw4' },
      { id: 'ecw4', source: 'cw4', target: 'cw5' },
    ],
  },
  {
    id: 'customer-support-agent',
    name: 'Customer Support Agent',
    description: 'Answers customer questions using workspace knowledge base & docs, escalates to human if unresolved.',
    category: 'support',
    icon: 'LifeBuoy',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Support', 'RAG', 'Escalation'],
    requiredTools: ['search_docs'],
    nodes: [
      { id: 'cs1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'Inbound Ticket', subtitle: 'Customer inquiry' } },
      { id: 'cs2', type: 'MCP_TOOL', position: { x: 290, y: 180 }, data: { label: 'Query Knowledge', subtitle: 'Search documentation', config: { toolName: 'search_docs' } } },
      { id: 'cs3', type: 'AGENT', position: { x: 540, y: 180 }, data: { label: 'Support Specialist', subtitle: 'Generate empathetic answer', config: { instructions: 'Provide helpful, clear troubleshooting steps based strictly on our docs.' } } },
      { id: 'cs4', type: 'IF_ELSE', position: { x: 800, y: 180 }, data: { label: 'Confidence High?', subtitle: 'Threshold check' } },
      { id: 'cs5', type: 'USER_APPROVAL', position: { x: 1040, y: 100 }, data: { label: 'Tier-2 Human Escalation', subtitle: 'Require rep approval' } },
      { id: 'cs6', type: 'END', position: { x: 1260, y: 180 }, data: { label: 'Ticket Resolved', subtitle: 'Reply sent' } },
    ],
    edges: [
      { id: 'ecs1', source: 'cs1', target: 'cs2' },
      { id: 'ecs2', source: 'cs2', target: 'cs3' },
      { id: 'ecs3', source: 'cs3', target: 'cs4' },
      { id: 'ecs4', source: 'cs4', target: 'cs5', label: 'No' },
      { id: 'ecs5', source: 'cs4', target: 'cs6', label: 'Yes' },
      { id: 'ecs6', source: 'cs5', target: 'cs6' },
    ],
  },
  {
    id: 'lead-research-agent',
    name: 'Lead Research Agent',
    description: 'Enriches inbound sales leads by looking up company details, recent news, and tech stack.',
    category: 'research',
    icon: 'Briefcase',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Sales', 'Enrichment', 'Firecrawl'],
    requiredTools: ['firecrawl_search', 'firecrawl_scrape'],
    nodes: [
      { id: 'lr1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'Lead Company Domain', subtitle: 'e.g. acme.com' } },
      { id: 'lr2', type: 'FIRECRAWL_SEARCH', position: { x: 290, y: 180 }, data: { label: 'Search News & Funding', subtitle: 'Company recent updates' } },
      { id: 'lr3', type: 'FIRECRAWL_SCRAPE', position: { x: 540, y: 180 }, data: { label: 'Scrape Homepage', subtitle: 'Extract value proposition' } },
      { id: 'lr4', type: 'AGENT', position: { x: 800, y: 180 }, data: { label: 'Sales Intelligence', subtitle: 'Synthesize dossier', config: { instructions: 'Summarize company profile: headcount, industry, key problem solved, and suggested outreach pitch.' } } },
      { id: 'lr5', type: 'END', position: { x: 1060, y: 180 }, data: { label: 'CRM Ready Dossier', subtitle: 'Structured lead brief' } },
    ],
    edges: [
      { id: 'elr1', source: 'lr1', target: 'lr2' },
      { id: 'elr2', source: 'lr2', target: 'lr3' },
      { id: 'elr3', source: 'lr3', target: 'lr4' },
      { id: 'elr4', source: 'lr4', target: 'lr5' },
    ],
  },
  {
    id: 'meeting-summary-agent',
    name: 'Meeting Summary Agent',
    description: 'Takes meeting transcript, synthesizes decisions and action items, and generates Kanban tasks.',
    category: 'automation',
    icon: 'Video',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Meeting', 'Productivity', 'Tasks'],
    requiredTools: ['create_task'],
    nodes: [
      { id: 'ms1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'Meeting Transcript', subtitle: 'Raw conversation text' } },
      { id: 'ms2', type: 'AGENT', position: { x: 300, y: 180 }, data: { label: 'Meeting Minutes AI', subtitle: 'Extract decisions & owners', config: { instructions: 'Extract all agreed decisions, open items, and specific tasks with assignees.' } } },
      { id: 'ms3', type: 'MCP_TOOL', position: { x: 560, y: 180 }, data: { label: 'Create Kanban Task', subtitle: 'Sync with workspace board', config: { toolName: 'create_task' } } },
      { id: 'ms4', type: 'END', position: { x: 820, y: 180 }, data: { label: 'Summary Distributed', subtitle: 'Action items posted' } },
    ],
    edges: [
      { id: 'ems1', source: 'ms1', target: 'ms2' },
      { id: 'ems2', source: 'ms2', target: 'ms3' },
      { id: 'ems3', source: 'ms3', target: 'ms4' },
    ],
  },
  {
    id: 'data-analysis-agent',
    name: 'Data Analysis Agent',
    description: 'Ingests CSV or metrics data, computes key indicators, identifies outliers, and drafts insights.',
    category: 'data',
    icon: 'BarChart2',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Analytics', 'Data', 'Insights'],
    requiredTools: [],
    nodes: [
      { id: 'da1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'Input Dataset', subtitle: 'JSON / CSV records' } },
      { id: 'da2', type: 'TRANSFORM', position: { x: 300, y: 180 }, data: { label: 'Calculate Metrics', subtitle: 'Aggregate totals & averages' } },
      { id: 'da3', type: 'AGENT', position: { x: 560, y: 180 }, data: { label: 'Data Scientist AI', subtitle: 'Uncover patterns & correlations', config: { instructions: 'Explain what numbers indicate, spot seasonal shifts and risk factors.' } } },
      { id: 'da4', type: 'END', position: { x: 820, y: 180 }, data: { label: 'Executive Insights', subtitle: 'Actionable takeaways' } },
    ],
    edges: [
      { id: 'eda1', source: 'da1', target: 'da2' },
      { id: 'eda2', source: 'da2', target: 'da3' },
      { id: 'eda3', source: 'da3', target: 'da4' },
    ],
  },
  {
    id: 'knowledge-assistant',
    name: 'Knowledge Assistant',
    description: 'RAG copilot with memory: recalls previous company decisions and searches all internal docs.',
    category: 'support',
    icon: 'Brain',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Knowledge Base', 'Memory', 'RAG'],
    requiredTools: ['search_docs', 'list_memory'],
    nodes: [
      { id: 'ka1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'Employee Question', subtitle: 'Workspace query' } },
      { id: 'ka2', type: 'MCP_TOOL', position: { x: 290, y: 180 }, data: { label: 'Recall Memory', subtitle: 'Workspace facts', config: { toolName: 'list_memory' } } },
      { id: 'ka3', type: 'MCP_TOOL', position: { x: 540, y: 180 }, data: { label: 'Search Docs', subtitle: 'Find relevant files', config: { toolName: 'search_docs' } } },
      { id: 'ka4', type: 'AGENT', position: { x: 800, y: 180 }, data: { label: 'Company Assistant', subtitle: 'Synthesize answer with citations', config: { instructions: 'Answer questions clearly using only confirmed company documentation and memory.' } } },
      { id: 'ka5', type: 'END', position: { x: 1060, y: 180 }, data: { label: 'Accurate Answer', subtitle: 'Verified response' } },
    ],
    edges: [
      { id: 'eka1', source: 'ka1', target: 'ka2' },
      { id: 'eka2', source: 'ka2', target: 'ka3' },
      { id: 'eka3', source: 'ka3', target: 'ka4' },
      { id: 'eka4', source: 'ka4', target: 'ka5' },
    ],
  },
  {
    id: 'api-automation-agent',
    name: 'API Automation Agent',
    description: 'Listens for triggers, orchestrates external HTTP endpoints, transforms response payload, and notifies team.',
    category: 'automation',
    icon: 'Cpu',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Webhooks', 'HTTP API', 'Integration'],
    requiredTools: ['send_channel_message'],
    nodes: [
      { id: 'aa1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'API Trigger', subtitle: 'Incoming payload' } },
      { id: 'aa2', type: 'HTTP_REQUEST', position: { x: 300, y: 180 }, data: { label: 'Call Microservice', subtitle: 'HTTP POST /sync', config: { url: 'https://api.example.com/data', method: 'GET' } } },
      { id: 'aa3', type: 'TRANSFORM', position: { x: 560, y: 180 }, data: { label: 'Format Summary', subtitle: 'Map fields' } },
      { id: 'aa4', type: 'MCP_TOOL', position: { x: 820, y: 180 }, data: { label: 'Notify Channel', subtitle: 'Post to #updates', config: { toolName: 'send_channel_message' } } },
      { id: 'aa5', type: 'END', position: { x: 1080, y: 180 }, data: { label: 'Flow Finished', subtitle: 'Success' } },
    ],
    edges: [
      { id: 'eaa1', source: 'aa1', target: 'aa2' },
      { id: 'eaa2', source: 'aa2', target: 'aa3' },
      { id: 'eaa3', source: 'aa3', target: 'aa4' },
      { id: 'eaa4', source: 'aa4', target: 'aa5' },
    ],
  },
  {
    id: 'email-assistant',
    name: 'Email Assistant',
    description: 'Categorizes incoming email, crafts contextual professional reply, and awaits human send approval.',
    category: 'support',
    icon: 'Mail',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Email', 'Approval', 'Communication'],
    requiredTools: [],
    nodes: [
      { id: 'ea1', type: 'START', position: { x: 50, y: 180 }, data: { label: 'Inbound Email', subtitle: 'Sender & message body' } },
      { id: 'ea2', type: 'AGENT', position: { x: 300, y: 180 }, data: { label: 'Email Drafter', subtitle: 'Compose thoughtful reply', config: { instructions: 'Draft a polite and clear email reply addressing each question.' } } },
      { id: 'ea3', type: 'USER_APPROVAL', position: { x: 560, y: 180 }, data: { label: 'Approve Send', subtitle: 'Human verification required', config: { action: 'Send outgoing email' } } },
      { id: 'ea4', type: 'END', position: { x: 820, y: 180 }, data: { label: 'Email Dispatched', subtitle: 'Delivered to inbox' } },
    ],
    edges: [
      { id: 'eea1', source: 'ea1', target: 'ea2' },
      { id: 'eea2', source: 'ea2', target: 'ea3' },
      { id: 'eea3', source: 'ea3', target: 'ea4' },
    ],
  },
  {
    id: 'multi-agent-research',
    name: 'Multi-Agent Research',
    description: 'Supervisor orchestrates dedicated Researcher, Writer, and Analyst sub-agents in a coordinated workflow.',
    category: 'multi-agent',
    icon: 'Users',
    recommendedModel: 'llama3:latest',
    recommendedProvider: 'ollama',
    tags: ['Supervisor', 'Multi-Agent', 'Sub-agents'],
    requiredTools: ['firecrawl_search', 'firecrawl_scrape'],
    nodes: [
      { id: 'ma1', type: 'START', position: { x: 50, y: 220 }, data: { label: 'Research Objective', subtitle: 'User mission' } },
      { id: 'ma2', type: 'AGENT', position: { x: 300, y: 220 }, data: { label: 'Supervisor Agent', subtitle: 'Decomposes task into sub-goals', config: { instructions: 'Coordinate specialist agents and plan sub-tasks.' } } },
      { id: 'ma3', type: 'FIRECRAWL_SEARCH', position: { x: 580, y: 120 }, data: { label: 'Researcher Agent', subtitle: 'Collects live web data' } },
      { id: 'ma4', type: 'AGENT', position: { x: 580, y: 320 }, data: { label: 'Analyst Agent', subtitle: 'Evaluates veracity and trends', config: { instructions: 'Cross-examine findings and eliminate hallucinations.' } } },
      { id: 'ma5', type: 'AGENT', position: { x: 860, y: 220 }, data: { label: 'Lead Author Agent', subtitle: 'Synthesizes master report', config: { instructions: 'Merge analysis and research into a polished final brief.' } } },
      { id: 'ma6', type: 'END', position: { x: 1120, y: 220 }, data: { label: 'Master Report Done', subtitle: 'Delivered' } },
    ],
    edges: [
      { id: 'ema1', source: 'ma1', target: 'ma2' },
      { id: 'ema2', source: 'ma2', target: 'ma3' },
      { id: 'ema3', source: 'ma2', target: 'ma4' },
      { id: 'ema4', source: 'ma3', target: 'ma5' },
      { id: 'ema5', source: 'ma4', target: 'ma5' },
      { id: 'ema6', source: 'ma5', target: 'ma6' },
    ],
  },
];
