/**
 * Ready-to-run starting points for common automations. Each is a real graph
 * of steps the engine runs (see `workflow-catalog.ts`) — the earlier
 * templates were a trigger followed by placeholder "ACTION" cards that did
 * nothing and relied on triggers that do not exist. A template is created
 * paused; the one or two things it needs from you (a knowledge base, a
 * schedule) are marked in its description.
 */

export type TemplateCategory =
  | 'all'
  | 'ai'
  | 'productivity'
  | 'communication'
  | 'engineering'
  | 'support'
  | 'sync'
  | 'governance';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  trigger: 'MANUAL' | 'CRON' | 'EVENT' | 'WEBHOOK';
  steps: string[];
  tags: string[];
  estimatedTimeSaved: string;
  /** Builds the graph. Node ids are readable so `{{id.key}}` references are too. */
  build: () => { triggerType: string; nodes: unknown[]; edges: unknown[] };
}

type Step = { id: string; type: string; data: Record<string, unknown> };

function chain(steps: Step[]): { nodes: unknown[]; edges: unknown[] } {
  const nodes = steps.map((step, index) => ({
    id: step.id,
    type: step.type,
    position: { x: 240, y: 40 + index * 170 },
    data: { type: step.type, ...step.data },
  }));
  const edges = steps.slice(1).map((step, index) => ({
    id: `${steps[index]!.id}-${step.id}`,
    source: steps[index]!.id,
    target: step.id,
    animated: true,
  }));
  return { nodes, edges };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'research-brief',
    name: 'Research brief',
    description: 'Search the web for a topic and write a short, sourced brief with citations.',
    category: 'ai',
    trigger: 'MANUAL',
    tags: ['Web Search', 'Summarization', 'Firecrawl', 'LLM'],
    estimatedTimeSaved: '45 mins',
    steps: ['On request', 'Search the web', 'Write the brief', 'Output result'],
    build: () => ({
      triggerType: 'MANUAL',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Start', triggerKind: 'MANUAL' } },
        { id: 'search', type: 'FIRECRAWL_SEARCH', data: { label: 'Search the web', query: '{{input.topic}}', limit: 5 } },
        {
          id: 'brief',
          type: 'LLM',
          data: {
            label: 'Write the brief',
            prompt:
              'Write a five-bullet brief on {{input.topic}} from these search results. Cite the URL for each point.\n\n{{search.searchResult}}',
            temperature: 0.3,
          },
        },
        { id: 'result', type: 'OUTPUT', data: { label: 'Brief', template: '{{brief.aiOutput}}' } },
      ]),
    }),
  },
  {
    id: 'knowledge-answer',
    name: 'Answer from knowledge base',
    description: 'Look up questions in an internal knowledge base and produce verified answers with sources.',
    category: 'ai',
    trigger: 'MANUAL',
    tags: ['Q&A', 'Knowledge Base', 'Citations', 'RAG'],
    estimatedTimeSaved: '30 mins',
    steps: ['On request', 'Search knowledge', 'Answer', 'Output result'],
    build: () => ({
      triggerType: 'MANUAL',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Start', triggerKind: 'MANUAL' } },
        {
          id: 'lookup',
          type: 'KNOWLEDGE_RETRIEVAL',
          data: { label: 'Search knowledge', knowledgeBaseId: '', query: '{{input.text}}', topK: 4 },
        },
        {
          id: 'answer',
          type: 'LLM',
          data: {
            label: 'Answer',
            prompt:
              'Answer the question using only these passages, naming the document for each fact. If they do not answer it, say so.\n\nQuestion: {{input.text}}\n\nPassages: {{lookup.retrievedDocuments}}',
            temperature: 0.2,
          },
        },
        { id: 'result', type: 'OUTPUT', data: { label: 'Answer', template: '{{answer.aiOutput}}' } },
      ]),
    }),
  },
  {
    id: 'task-triage',
    name: 'Triage new tasks',
    description: 'When a task is created, classify it, suggest priority, and formulate actionable next steps.',
    category: 'productivity',
    trigger: 'EVENT',
    tags: ['Tasks', 'Triage', 'Classification', 'Automation'],
    estimatedTimeSaved: '15 mins',
    steps: ['Task created', 'Classify', 'Suggest next step', 'Output suggestion'],
    build: () => ({
      triggerType: 'task.created',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Task created', triggerKind: 'EVENT', event: 'task.created' } },
        {
          id: 'kind',
          type: 'CLASSIFIER',
          data: { label: 'Classify', input: '{{title}}', categories: 'bug, feature, question' },
        },
        {
          id: 'advice',
          type: 'LLM',
          data: {
            label: 'Suggest next step',
            prompt: 'A new {{kind.classification}} task was filed: "{{title}}". Suggest a priority (P1–P3) and one concrete next step.',
            temperature: 0.3,
          },
        },
        { id: 'result', type: 'OUTPUT', data: { label: 'Suggestion', template: '{{advice.aiOutput}}' } },
      ]),
    }),
  },
  {
    id: 'daily-digest',
    name: 'Daily stand-up task digest',
    description: 'Every weekday at 09:00, summarise active and blocked tasks into a formatted stand-up doc.',
    category: 'productivity',
    trigger: 'CRON',
    tags: ['Scheduled', 'Stand-up', 'Tasks', 'Docs'],
    estimatedTimeSaved: '20 mins',
    steps: ['Weekdays 09:00', 'List tasks', 'Summarise', 'Save a doc'],
    build: () => ({
      triggerType: 'CRON',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Weekdays 09:00', triggerKind: 'CRON', cron: '0 9 * * 1-5' } },
        { id: 'tasks', type: 'TOOL', data: { label: 'List tasks', toolName: 'list_tasks', input: '{}' } },
        {
          id: 'digest',
          type: 'LLM',
          data: {
            label: 'Summarise',
            prompt: 'Summarise these tasks for a morning stand-up: what is due, what is blocked, who owns what.\n\n{{tasks.toolResult}}',
            temperature: 0.3,
          },
        },
        {
          id: 'save',
          type: 'TOOL',
          data: {
            label: 'Save a doc',
            toolName: 'create_doc',
            input: '{\n  "title": "Daily standup digest",\n  "content": "{{digest.aiOutput}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'draft-approve-file',
    name: 'Draft announcement with approval',
    description: 'Draft a company announcement with AI, pause for human sign-off, and file into company notes.',
    category: 'governance',
    trigger: 'MANUAL',
    tags: ['Human in the loop', 'Approvals', 'Content Draft', 'Docs'],
    estimatedTimeSaved: '35 mins',
    steps: ['On request', 'Draft announcement', 'Approval required', 'Save doc'],
    build: () => ({
      triggerType: 'MANUAL',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Start', triggerKind: 'MANUAL' } },
        {
          id: 'draft',
          type: 'LLM',
          data: { label: 'Draft', prompt: 'Draft a short team announcement about: {{input.text}}', temperature: 0.5 },
        },
        { id: 'approve', type: 'HUMAN_APPROVAL', data: { label: 'Approval', action: 'Approve the announcement draft' } },
        {
          id: 'save',
          type: 'TOOL',
          data: {
            label: 'Save a doc',
            toolName: 'create_doc',
            input: '{\n  "title": "Team announcement",\n  "content": "{{draft.aiOutput}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'welcome-member-sequence',
    name: 'Welcome new workspace member',
    description: 'When a new member joins the workspace, compile a personalized greeting and setup checklist.',
    category: 'communication',
    trigger: 'EVENT',
    tags: ['Onboarding', 'Welcome', 'Team', 'Checklist'],
    estimatedTimeSaved: '15 mins',
    steps: ['Member joined', 'Generate welcome', 'Post message'],
    build: () => ({
      triggerType: 'member.joined',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Member joined', triggerKind: 'EVENT', event: 'member.joined' } },
        {
          id: 'msg',
          type: 'LLM',
          data: {
            label: 'Generate welcome',
            prompt: 'Draft a warm welcome note for {{userName}} who just joined our workspace with introductory tips.',
            temperature: 0.4,
          },
        },
        {
          id: 'notify',
          type: 'TOOL',
          data: {
            label: 'Post message',
            toolName: 'post_channel_message',
            input: '{\n  "channelId": "{{channelId}}",\n  "content": "{{msg.aiOutput}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'meeting-summary-actions',
    name: 'Meeting summary & follow-up tasks',
    description: 'When a video call ends, extract key decisions and automatically create follow-up action items.',
    category: 'productivity',
    trigger: 'EVENT',
    tags: ['Meetings', 'Action Items', 'Transcription', 'Tasks'],
    estimatedTimeSaved: '25 mins',
    steps: ['Meeting ended', 'Extract actions', 'Create task'],
    build: () => ({
      triggerType: 'meeting.ended',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Meeting ended', triggerKind: 'EVENT', event: 'meeting.ended' } },
        {
          id: 'extract',
          type: 'EXTRACT_DATA',
          data: {
            label: 'Extract actions',
            input: '{{notes}}',
            fields: 'action_items, decisions, attendees',
          },
        },
        {
          id: 'task',
          type: 'TOOL',
          data: {
            label: 'Create follow-up task',
            toolName: 'create_task',
            input: '{\n  "title": "Meeting Follow-up: {{title}}",\n  "description": "{{extract.extracted}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'webhook-task-ingest',
    name: 'Inbound webhook to task ingestion',
    description: 'Listen on an authenticated webhook endpoint, extract payload data, and file a Kanban work task.',
    category: 'sync',
    trigger: 'WEBHOOK',
    tags: ['Webhooks', 'Integration', 'API', 'Kanban'],
    estimatedTimeSaved: '20 mins',
    steps: ['Inbound webhook', 'Transform payload', 'Create task'],
    build: () => ({
      triggerType: 'WEBHOOK',
      ...chain([
        {
          id: 'start',
          type: 'TRIGGER',
          data: { label: 'Inbound webhook', triggerKind: 'WEBHOOK', webhookSecret: '' },
        },
        {
          id: 'transform',
          type: 'CODE',
          data: {
            label: 'Process webhook data',
            code: 'return {\n  title: input.subject || input.title || "External Webhook Item",\n  details: JSON.stringify(input, null, 2)\n};',
          },
        },
        {
          id: 'createTask',
          type: 'TOOL',
          data: {
            label: 'Create task',
            toolName: 'create_task',
            input: '{\n  "title": "{{transform.result.title}}",\n  "description": "{{transform.result.details}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'overdue-task-escalation',
    name: 'Overdue task escalation alert',
    description: 'Hourly scan catches overdue work items and broadcasts an urgent notice to the team channel.',
    category: 'productivity',
    trigger: 'EVENT',
    tags: ['Overdue', 'Escalation', 'Alerts', 'Deadlines'],
    estimatedTimeSaved: '15 mins',
    steps: ['Task overdue', 'Draft alert', 'Post notice'],
    build: () => ({
      triggerType: 'task.overdue',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Task overdue', triggerKind: 'EVENT', event: 'task.overdue' } },
        {
          id: 'draft',
          type: 'LLM',
          data: {
            label: 'Draft alert',
            prompt: 'Task "{{title}}" is past due (due on {{dueDate}}). Formulate a polite escalation reminder.',
            temperature: 0.2,
          },
        },
        {
          id: 'postAlert',
          type: 'TOOL',
          data: {
            label: 'Post notice',
            toolName: 'post_channel_message',
            input: '{\n  "content": "⚠️ **Overdue Alert:** {{draft.aiOutput}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'customer-ticket-classifier',
    name: 'Customer support ticket routing',
    description: 'Analyze inbound customer inquiries, classify priority and topic, and route to the correct team.',
    category: 'support',
    trigger: 'MANUAL',
    tags: ['Customer Support', 'Classification', 'Routing', 'SLA'],
    estimatedTimeSaved: '30 mins',
    steps: ['Inbound ticket', 'Classify inquiry', 'Route & create task'],
    build: () => ({
      triggerType: 'MANUAL',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Inbound ticket', triggerKind: 'MANUAL' } },
        {
          id: 'classify',
          type: 'CLASSIFIER',
          data: {
            label: 'Classify inquiry',
            input: '{{input.message}}',
            categories: 'billing, technical, feature_request, urgent_outage',
          },
        },
        {
          id: 'createTicketTask',
          type: 'TOOL',
          data: {
            label: 'Create support task',
            toolName: 'create_task',
            input: '{\n  "title": "[{{classify.classification}}] {{input.subject}}",\n  "description": "{{input.message}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'weekly-status-report',
    name: 'Weekly workspace status rollup',
    description: 'Every Friday at 17:00, generate an executive summary of completed projects and milestones.',
    category: 'productivity',
    trigger: 'CRON',
    tags: ['Reporting', 'Executive Summary', 'Weekly', 'Projects'],
    estimatedTimeSaved: '60 mins',
    steps: ['Friday 17:00', 'List projects', 'Summarise week', 'Save report'],
    build: () => ({
      triggerType: 'CRON',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Friday 17:00', triggerKind: 'CRON', cron: '0 17 * * 5' } },
        { id: 'projects', type: 'TOOL', data: { label: 'List projects', toolName: 'list_projects', input: '{}' } },
        {
          id: 'report',
          type: 'LLM',
          data: {
            label: 'Summarise week',
            prompt: 'Write an executive weekly progress report from these project statuses:\n\n{{projects.toolResult}}',
            temperature: 0.3,
          },
        },
        {
          id: 'save',
          type: 'TOOL',
          data: {
            label: 'Save report doc',
            toolName: 'create_doc',
            input: '{\n  "title": "Weekly Status Rollup",\n  "content": "{{report.aiOutput}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'api-health-monitor',
    name: 'Scheduled API health probe',
    description: 'Run an hourly probe against an external service URL and log response status or fail fast.',
    category: 'engineering',
    trigger: 'CRON',
    tags: ['DevOps', 'Health Check', 'HTTP Request', 'Monitoring'],
    estimatedTimeSaved: '20 mins',
    steps: ['Every hour', 'HTTP probe', 'Validate response'],
    build: () => ({
      triggerType: 'CRON',
      ...chain([
        { id: 'start', type: 'TRIGGER', data: { label: 'Every hour', triggerKind: 'CRON', cron: '0 * * * *' } },
        {
          id: 'probe',
          type: 'HTTP_REQUEST',
          data: { label: 'HTTP probe', method: 'GET', url: 'https://httpbin.org/status/200' },
        },
        {
          id: 'eval',
          type: 'CODE',
          data: {
            label: 'Validate response',
            code: 'return {\n  healthy: input.probe.statusCode === 200,\n  status: input.probe.statusCode,\n  checkedAt: new Date().toISOString()\n};',
          },
        },
      ]),
    }),
  },
];
