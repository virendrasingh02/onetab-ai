export interface AIAgentCapability {
  name: string;
  description: string;
  icon?: string;
}

export interface ChannelAIAgent {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  model: string;
  avatarSeed: string;
  tags: string[];
  status: 'active' | 'idle' | 'paused';
  enabled: boolean;
  systemPrompt?: string;
  triggers: string[];
  capabilities: string[];
  addedAt: number;
}

export interface ChannelConnectedApp {
  id: string;
  name: string;
  slug: string;
  category: 'developer' | 'productivity' | 'monitoring' | 'collaboration' | 'custom';
  description: string;
  icon: string;
  status: 'connected' | 'paused' | 'error';
  enabled: boolean;
  botHandle: string;
  webhookUrl?: string;
  eventsCount: number;
  events: string[];
  addedAt: number;
}

export interface MessageActionOption {
  id: string;
  label: string;
  variant?: 'default' | 'primary' | 'destructive' | 'outline' | 'secondary';
  icon?: string;
  url?: string;
  actionPayload?: string;
}

export interface ChannelBotMessage {
  id: string;
  channelId: string;
  senderType: 'agent' | 'app';
  senderId: string;
  senderName: string;
  senderHandle: string;
  senderAvatarSeed: string;
  badgeLabel: string; // e.g. "AI AGENT", "BOT", "APP"
  badgeVariant?: 'primary' | 'neutral' | 'success' | 'warning' | 'violet';
  model?: string;
  timestamp: number;
  replyToHandle?: string;
  content: string;
  reasoning?: {
    summary: string;
    details: string;
    durationMs: number;
  };
  toolsExecuted?: Array<{
    name: string;
    status: 'success' | 'running' | 'failed';
    output: string;
  }>;
  embedCard?: {
    type: 'github_pr' | 'linear_issue' | 'sentry_alert' | 'standup_summary' | 'code_review' | 'doc_preview';
    title: string;
    url?: string;
    accentColor: string; // e.g. '#2563eb' | '#10b981' | '#ef4444' | '#8b5cf6'
    fields: Array<{ label: string; value: string; inline?: boolean }>;
    footer?: string;
  };
  codeBlock?: {
    language: string;
    code: string;
    filename?: string;
    isDiff?: boolean;
  };
  actions?: MessageActionOption[];
  feedback?: {
    helpful?: boolean;
    reactionCount?: number;
  };
}

export const PRESET_AI_AGENTS: Omit<ChannelAIAgent, 'addedAt'>[] = [
  {
    id: 'agent-copilot',
    name: 'OneTab Copilot',
    handle: '@copilot',
    role: 'Channel AI Assistant',
    description: 'Context-aware intelligence that analyzes channel history, drafts responses, and executes tools.',
    model: 'Gemini 2.5 Pro',
    avatarSeed: 'copilot',
    tags: ['Assistant', 'Summaries', 'Reasoning', 'Q&A'],
    status: 'active',
    enabled: true,
    triggers: ['@copilot', '/summarize', '/ask', '/explain'],
    capabilities: ['Channel History Retrieval', 'Multi-step Reasoning', 'Automated Summaries', 'Action Drafting'],
  },
  {
    id: 'agent-code-reviewer',
    name: 'Code Reviewer AI',
    handle: '@codereview',
    role: 'Lead Architect Bot',
    description: 'Automated code inspection, security vulnerability analysis, and AST-level performance feedback.',
    model: 'Claude 3.7 Sonnet',
    avatarSeed: 'codereview',
    tags: ['Engineering', 'Security', 'Refactor', 'Diffs'],
    status: 'active',
    enabled: true,
    triggers: ['@codereview', '/review', '/diff', '/lint-check'],
    capabilities: ['Static Analysis', 'Security Audit', 'Code Diff Highlighting', 'Inline Suggestions'],
  },
  {
    id: 'agent-triage',
    name: 'Incident & Error Triage',
    handle: '@triage',
    role: 'SRE & On-Call Copilot',
    description: 'Monitors runtime anomalies, correlates Sentry/Datadog logs, and generates mitigation steps.',
    model: 'GPT-4o',
    avatarSeed: 'triage',
    tags: ['Ops', 'Incidents', 'Logs', 'Paging'],
    status: 'active',
    enabled: true,
    triggers: ['@triage', '/incident', '/stacktrace', '/mitigate'],
    capabilities: ['Realtime Stacktrace Parsing', 'Blast Radius Assessment', 'On-call Escalation', 'Post-Mortem Drafting'],
  },
  {
    id: 'agent-standup',
    name: 'Daily Standup Bot',
    handle: '@standup',
    role: 'Agile Coordinator',
    description: 'Collects asynchronous updates from team members, flags blockers, and posts visual daily summaries.',
    model: 'Gemini 2.5 Flash',
    avatarSeed: 'standup',
    tags: ['Productivity', 'Standup', 'Blockers', 'Recap'],
    status: 'active',
    enabled: true,
    triggers: ['@standup', '/standup', '/blockers', '/recap'],
    capabilities: ['Async Prompt Scheduling', 'Blocker Detection', 'Sprint Goal Progress', 'Markdown Digest Generation'],
  },
  {
    id: 'agent-docs',
    name: 'Docs & Knowledge AI',
    handle: '@docs',
    role: 'Knowledge Base Synthesizer',
    description: 'Transforms discussions and architecture decisions into structured markdown docs in Notion or Wiki.',
    model: 'Claude 3.7 Sonnet',
    avatarSeed: 'docs',
    tags: ['Documentation', 'Research', 'Notion', 'Markdown'],
    status: 'active',
    enabled: false,
    triggers: ['@docs', '/doc', '/rfc', '/architecture'],
    capabilities: ['Decision Record Extraction', 'Markdown Documentation Generator', 'Cross-referencing Wiki'],
  },
  {
    id: 'agent-sql-analyst',
    name: 'SQL & Data Analyst',
    handle: '@data',
    role: 'BI & Metric Bot',
    description: 'Translates natural language questions into optimized SQL queries and chart visualizations.',
    model: 'Gemini 2.5 Pro',
    avatarSeed: 'sql-bot',
    tags: ['Data', 'Analytics', 'SQL', 'Metrics'],
    status: 'idle',
    enabled: false,
    triggers: ['@data', '/query', '/metrics', '/chart'],
    capabilities: ['Schema Understanding', 'Read-only SQL Generation', 'Metric Visualizations', 'Anomaly Detection'],
  },
];

export const PRESET_CHANNEL_APPS: Omit<ChannelConnectedApp, 'addedAt'>[] = [
  {
    id: 'app-github',
    name: 'GitHub',
    slug: 'github',
    category: 'developer',
    description: 'Stream pull request reviews, deployment alerts, and issue activity directly to this channel.',
    icon: 'github',
    status: 'connected',
    enabled: true,
    botHandle: '@github-app',
    eventsCount: 142,
    events: ['pull_request.opened', 'pull_request.review_submitted', 'workflow_run.completed', 'issues.assigned'],
  },
  {
    id: 'app-linear',
    name: 'Linear',
    slug: 'linear',
    category: 'productivity',
    description: 'Create, update, and track engineering roadmap issues with live 2-way thread sync.',
    icon: 'linear',
    status: 'connected',
    enabled: true,
    botHandle: '@linear-bot',
    eventsCount: 89,
    events: ['issue.created', 'issue.status_changed', 'issue.comment_created', 'cycle.started'],
  },
  {
    id: 'app-sentry',
    name: 'Sentry Error Monitor',
    slug: 'sentry',
    category: 'monitoring',
    description: 'Real-time uncaught exception alerts with stack traces and root-cause links.',
    icon: 'sentry',
    status: 'connected',
    enabled: true,
    botHandle: '@sentry-bot',
    eventsCount: 27,
    events: ['error.unhandled_exception', 'alert.p0_escalation', 'issue.resolved'],
  },
  {
    id: 'app-jira',
    name: 'Jira Software',
    slug: 'jira',
    category: 'productivity',
    description: 'Sync Jira sprint boards, story points, and release roadmaps with team discussions.',
    icon: 'jira',
    status: 'connected',
    enabled: false,
    botHandle: '@jira-bot',
    eventsCount: 12,
    events: ['jira:issue_updated', 'sprint_started'],
  },
  {
    id: 'app-figma',
    name: 'Figma',
    slug: 'figma',
    category: 'collaboration',
    description: 'Live notifications when design files are updated or comments are left on UI mocks.',
    icon: 'figma',
    status: 'connected',
    enabled: false,
    botHandle: '@figma-bot',
    eventsCount: 18,
    events: ['file_comment', 'file_version_update'],
  },
  {
    id: 'app-google-drive',
    name: 'Google Drive',
    slug: 'gdrive',
    category: 'collaboration',
    description: 'Doc sharing, comment alerts, and spreadsheet permission updates.',
    icon: 'gdrive',
    status: 'connected',
    enabled: false,
    botHandle: '@gdrive-bot',
    eventsCount: 9,
    events: ['doc_shared', 'comment_resolved'],
  },
];
