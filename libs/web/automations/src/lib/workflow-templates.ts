/**
 * Ready-to-run starting points for common automations. Each is a real graph
 * of steps the engine runs (see `workflow-catalog.ts`) — the earlier
 * templates were a trigger followed by placeholder "ACTION" cards that did
 * nothing and relied on triggers that do not exist. A template is created
 * paused; the one or two things it needs from you (a knowledge base, a
 * schedule) are marked in its description.
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  trigger: 'MANUAL' | 'CRON' | 'EVENT';
  steps: string[];
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
    description: 'Search the web for a topic and write a short, sourced brief. Run it with {"input": {"topic": "…"}}.',
    trigger: 'MANUAL',
    steps: ['On request', 'Search the web', 'Write the brief'],
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
    name: 'Answer from your knowledge base',
    description: 'Look up a question in a knowledge base and answer it with citations. Pick the knowledge base first.',
    trigger: 'MANUAL',
    steps: ['On request', 'Search knowledge', 'Answer'],
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
    description: 'When a task is created, classify it and suggest a priority and next step.',
    trigger: 'EVENT',
    steps: ['Task created', 'Classify', 'Suggest next step'],
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
    name: 'Daily task digest',
    description: 'Every weekday at 09:00, summarise open tasks and save the digest as a document.',
    trigger: 'CRON',
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
            input: '{\n  "title": "Daily digest",\n  "content": "{{digest.aiOutput}}"\n}',
          },
        },
      ]),
    }),
  },
  {
    id: 'draft-approve-file',
    name: 'Draft, approve, then file',
    description: 'Draft an announcement, wait for approval, then save it as a document.',
    trigger: 'MANUAL',
    steps: ['On request', 'Draft', 'Approval', 'Save a doc'],
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
            input: '{\n  "title": "Announcement",\n  "content": "{{draft.aiOutput}}"\n}',
          },
        },
      ]),
    }),
  },
];
