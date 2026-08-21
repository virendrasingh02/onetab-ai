import type { CardDefinition, CardStatus } from '@org/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// 10 PRODUCTION-READY BUILT-IN TEMPLATES & SYSTEM CARDS
// ---------------------------------------------------------------------------

export const SYSTEM_CARD_TEMPLATES: CardDefinition[] = [
  {
    cardId: 'crm-lead',
    version: 1,
    name: 'CRM Lead',
    description: 'Displays inbound sales leads, contact information, company details, and qualification stage.',
    category: 'crm',
    icon: 'Building2',
    visibility: 'global',
    status: 'published',
    tags: ['crm', 'sales', 'lead', 'customer'],
    supportedSurfaces: ['matrix', 'agent', 'workflow', 'dashboard', 'inbox'],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    publishedAt: 1700000000000,
    usageCount: 248,
    schema: {
      fields: {
        name: { name: 'name', label: 'Lead Name', type: 'string', required: true, defaultValue: 'Sarah Connor' },
        company: { name: 'company', label: 'Company', type: 'string', required: true, defaultValue: 'Cyberdyne Systems' },
        email: { name: 'email', label: 'Email', type: 'email', required: true, defaultValue: 's.connor@cyberdyne.com' },
        phone: { name: 'phone', label: 'Phone', type: 'string', defaultValue: '+1 (555) 019-2834' },
        dealValue: { name: 'dealValue', label: 'Estimated Value', type: 'number', defaultValue: 45000 },
        stage: {
          name: 'stage',
          label: 'Pipeline Stage',
          type: 'enum',
          defaultValue: 'Qualified',
          options: [
            { label: 'New', value: 'New' },
            { label: 'Contacted', value: 'Contacted' },
            { label: 'Qualified', value: 'Qualified' },
            { label: 'Proposal', value: 'Proposal' },
            { label: 'Won', value: 'Won' },
          ],
        },
      },
    },
    sampleData: {
      name: 'Sarah Connor',
      company: 'Cyberdyne Systems',
      email: 's.connor@cyberdyne.com',
      phone: '+1 (555) 019-2834',
      dealValue: 45000,
      stage: 'Qualified',
    },
    rootComponent: {
      id: 'root',
      type: 'container',
      style: { padding: '16px', borderRadius: '16px', background: 'surface', border: '1px solid border' },
      children: [
        {
          id: 'hdr',
          type: 'row',
          style: { justifyContent: 'between', alignItems: 'center', margin: '0 0 12px 0' },
          children: [
            {
              id: 'hdr-left',
              type: 'row',
              style: { alignItems: 'center', gap: '10px' },
              children: [
                { id: 'avatar', type: 'avatar', props: { name: '{{name}}', size: 'md' } },
                {
                  id: 'hdr-title-group',
                  type: 'column',
                  children: [
                    { id: 'title', type: 'heading', props: { text: '{{name}}', level: 3 } },
                    { id: 'subtitle', type: 'text', props: { text: '{{company}}', variant: 'muted', size: 'sm' } },
                  ],
                },
              ],
            },
            { id: 'status-badge', type: 'badge', props: { text: '{{stage}}', variant: 'primary' } },
          ],
        },
        {
          id: 'details-grid',
          type: 'grid',
          props: { columns: 2 },
          style: { gap: '8px', margin: '0 0 14px 0' },
          children: [
            { id: 'kv-email', type: 'key_value', props: { label: 'Email', value: '{{email}}' } },
            { id: 'kv-phone', type: 'key_value', props: { label: 'Phone', value: '{{phone}}' } },
            { id: 'kv-val', type: 'key_value', props: { label: 'Deal Value', value: '{{dealValue | currency}}' } },
            { id: 'kv-stage', type: 'key_value', props: { label: 'Status', value: '{{stage | uppercase}}' } },
          ],
        },
        {
          id: 'footer-actions',
          type: 'button_group',
          style: { justifyContent: 'end', gap: '8px' },
          children: [
            { id: 'btn-email', type: 'button', props: { label: 'Send Email', variant: 'outline', icon: 'Mail', actionId: 'email_lead' } },
            { id: 'btn-open', type: 'button', props: { label: 'Open in CRM', variant: 'primary', icon: 'ExternalLink', actionId: 'open_crm' } },
          ],
        },
      ],
    },
    actions: [
      { id: 'open_crm', type: 'open_url', label: 'Open in CRM', url: 'https://crm.onetab.ai/leads/{{id}}' },
      { id: 'email_lead', type: 'send_message', label: 'Email Lead' },
    ],
  },
  {
    cardId: 'github-pr',
    version: 1,
    name: 'GitHub Pull Request',
    description: 'Realtime Pull Request status, review approvals, diff summary, and merge action.',
    category: 'development',
    icon: 'GitPullRequest',
    visibility: 'global',
    status: 'published',
    tags: ['github', 'code', 'git', 'pr'],
    supportedSurfaces: ['matrix', 'agent', 'workflow', 'dashboard', 'inbox'],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    publishedAt: 1700000000000,
    usageCount: 512,
    schema: {
      fields: {
        repo: { name: 'repo', label: 'Repository', type: 'string', required: true, defaultValue: 'onetab-ai/engine' },
        prNumber: { name: 'prNumber', label: 'PR #', type: 'number', required: true, defaultValue: 142 },
        title: { name: 'title', label: 'Title', type: 'string', required: true, defaultValue: 'feat: add universal card AST compiler' },
        author: { name: 'author', label: 'Author', type: 'string', required: true, defaultValue: 'virendra' },
        branch: { name: 'branch', label: 'Branch', type: 'string', defaultValue: 'feature/card-builder' },
        checksPassing: { name: 'checksPassing', label: 'CI Checks Passed', type: 'boolean', defaultValue: true },
        additions: { name: 'additions', label: 'Additions (+)', type: 'number', defaultValue: 342 },
        deletions: { name: 'deletions', label: 'Deletions (-)', type: 'number', defaultValue: 18 },
      },
    },
    sampleData: {
      repo: 'onetab-ai/engine',
      prNumber: 142,
      title: 'feat: add universal card AST compiler',
      author: 'virendra',
      branch: 'feature/card-builder',
      checksPassing: true,
      additions: 342,
      deletions: 18,
    },
    rootComponent: {
      id: 'root',
      type: 'container',
      style: { padding: '16px', borderRadius: '16px', background: 'surface', border: '1px solid border' },
      children: [
        {
          id: 'header-row',
          type: 'row',
          style: { justifyContent: 'between', alignItems: 'center', margin: '0 0 10px 0' },
          children: [
            { id: 'repo-badge', type: 'badge', props: { text: '{{repo}} #{{prNumber}}', variant: 'outline' } },
            { id: 'ci-badge', type: 'badge', props: { text: 'CI Passing', variant: 'success' } },
          ],
        },
        { id: 'pr-title', type: 'heading', props: { text: '{{title}}', level: 3 }, style: { margin: '0 0 8px 0' } },
        {
          id: 'meta-row',
          type: 'row',
          style: { gap: '16px', margin: '0 0 12px 0' },
          children: [
            { id: 'author-txt', type: 'text', props: { text: 'Opened by @{{author}}', size: 'xs', variant: 'muted' } },
            { id: 'branch-txt', type: 'text', props: { text: 'branch: {{branch}}', size: 'xs', variant: 'muted' } },
            { id: 'diff-txt', type: 'text', props: { text: '+{{additions}} / -{{deletions}} lines', size: 'xs' } },
          ],
        },
        {
          id: 'footer-actions',
          type: 'button_group',
          style: { justifyContent: 'end', gap: '8px' },
          children: [
            { id: 'btn-view', type: 'button', props: { label: 'View on GitHub', variant: 'outline', icon: 'ExternalLink', actionId: 'view_github' } },
            { id: 'btn-merge', type: 'button', props: { label: 'Merge PR', variant: 'primary', icon: 'GitMerge', actionId: 'merge_pr' } },
          ],
        },
      ],
    },
    actions: [
      { id: 'view_github', type: 'open_url', label: 'View on GitHub', url: 'https://github.com/{{repo}}/pull/{{prNumber}}' },
      { id: 'merge_pr', type: 'call_api', label: 'Merge PR', requiresConfirmation: true, confirmationMessage: 'Are you sure you want to merge #{{prNumber}} into main?' },
    ],
  },
  {
    cardId: 'approval-request',
    version: 1,
    name: 'Approval Request',
    description: 'Human-in-the-loop authorization card with risk banner, side effects diff, and in-place resolve actions.',
    category: 'system',
    icon: 'ShieldAlert',
    visibility: 'global',
    status: 'published',
    tags: ['approval', 'security', 'governance'],
    supportedSurfaces: ['matrix', 'agent', 'workflow', 'notification', 'inbox'],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    publishedAt: 1700000000000,
    usageCount: 180,
    schema: {
      fields: {
        title: { name: 'title', label: 'Action Title', type: 'string', required: true, defaultValue: 'Publish Release v3.2.0' },
        requester: { name: 'requester', label: 'Requested By', type: 'string', required: true, defaultValue: 'Deployment Agent' },
        riskLevel: { name: 'riskLevel', label: 'Risk Level', type: 'enum', defaultValue: 'High', options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }, { label: 'Critical', value: 'Critical' }] },
        details: { name: 'details', label: 'Impact & Details', type: 'string', defaultValue: 'Will deploy artifacts to production and update active routing.' },
      },
    },
    sampleData: {
      title: 'Publish Release v3.2.0',
      requester: 'Deployment Agent',
      riskLevel: 'High',
      details: 'Will deploy artifacts to production and update active routing.',
    },
    rootComponent: {
      id: 'root',
      type: 'container',
      style: { padding: '16px', borderRadius: '16px', background: 'surface', border: '1px solid border' },
      children: [
        {
          id: 'hdr',
          type: 'row',
          style: { justifyContent: 'between', alignItems: 'center', margin: '0 0 10px 0' },
          children: [
            { id: 'risk-badge', type: 'badge', props: { text: '{{riskLevel}} Risk Action', variant: 'destructive' } },
            { id: 'req-txt', type: 'text', props: { text: 'By {{requester}}', size: 'xs', variant: 'muted' } },
          ],
        },
        { id: 'title', type: 'heading', props: { text: '{{title}}', level: 3 }, style: { margin: '0 0 6px 0' } },
        { id: 'details', type: 'paragraph', props: { text: '{{details}}' }, style: { margin: '0 0 14px 0' } },
        {
          id: 'footer-actions',
          type: 'button_group',
          style: { justifyContent: 'end', gap: '8px' },
          children: [
            { id: 'btn-reject', type: 'button', props: { label: 'Reject', variant: 'outline', icon: 'XCircle', actionId: 'reject' } },
            { id: 'btn-approve', type: 'button', props: { label: 'Approve & Execute', variant: 'primary', icon: 'CheckCircle2', actionId: 'approve' } },
          ],
        },
      ],
    },
    actions: [
      { id: 'approve', type: 'approve', label: 'Approve Action', variant: 'primary' },
      { id: 'reject', type: 'reject', label: 'Reject Action', variant: 'destructive' },
    ],
  },
  {
    cardId: 'agent-result',
    version: 1,
    name: 'AI Agent Result',
    description: 'Autonomous AI agent executive summary, tools breakdown, key findings, and recommended next steps.',
    category: 'ai',
    icon: 'Sparkles',
    visibility: 'global',
    status: 'published',
    tags: ['ai', 'agent', 'research', 'summary'],
    supportedSurfaces: ['matrix', 'agent', 'workflow', 'dashboard'],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    publishedAt: 1700000000000,
    usageCount: 640,
    schema: {
      fields: {
        agentName: { name: 'agentName', label: 'Agent Name', type: 'string', defaultValue: 'Research Synthesizer' },
        summary: { name: 'summary', label: 'Executive Summary', type: 'string', defaultValue: 'Analyzed 18 industry benchmark reports for Q3 market trends.' },
        sourcesCount: { name: 'sourcesCount', label: 'Sources Cited', type: 'number', defaultValue: 18 },
        duration: { name: 'duration', label: 'Duration', type: 'string', defaultValue: '12.4s' },
      },
    },
    sampleData: {
      agentName: 'Research Synthesizer',
      summary: 'Analyzed 18 industry benchmark reports for Q3 market trends.',
      sourcesCount: 18,
      duration: '12.4s',
    },
    rootComponent: {
      id: 'root',
      type: 'container',
      style: { padding: '16px', borderRadius: '16px', background: 'surface', border: '1px solid border' },
      children: [
        {
          id: 'hdr',
          type: 'row',
          style: { justifyContent: 'between', alignItems: 'center', margin: '0 0 10px 0' },
          children: [
            { id: 'agent-badge', type: 'badge', props: { text: 'AI Agent · {{agentName}}', variant: 'primary' } },
            { id: 'dur-badge', type: 'text', props: { text: '{{duration}}', size: 'xs', variant: 'muted' } },
          ],
        },
        { id: 'summary-text', type: 'paragraph', props: { text: '{{summary}}' }, style: { margin: '0 0 12px 0' } },
        {
          id: 'footer-actions',
          type: 'button_group',
          style: { justifyContent: 'end', gap: '8px' },
          children: [
            { id: 'btn-sources', type: 'button', props: { label: 'View {{sourcesCount}} Sources', variant: 'outline', icon: 'Search', actionId: 'view_sources' } },
            { id: 'btn-task', type: 'button', props: { label: 'Create Task', variant: 'primary', icon: 'Plus', actionId: 'create_task' } },
          ],
        },
      ],
    },
  },
  {
    cardId: 'task-card',
    version: 1,
    name: 'Task Card',
    description: 'Project task with priority indicator, due date, assignee, and completion toggle.',
    category: 'productivity',
    icon: 'CheckSquare',
    visibility: 'global',
    status: 'published',
    tags: ['task', 'project', 'productivity'],
    supportedSurfaces: ['matrix', 'agent', 'workflow', 'dashboard', 'inbox'],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    publishedAt: 1700000000000,
    usageCount: 420,
    schema: {
      fields: {
        title: { name: 'title', label: 'Task Title', type: 'string', required: true, defaultValue: 'Implement card registry schema' },
        assignee: { name: 'assignee', label: 'Assignee', type: 'string', defaultValue: 'Alex' },
        priority: { name: 'priority', label: 'Priority', type: 'enum', defaultValue: 'High', options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }] },
        dueDate: { name: 'dueDate', label: 'Due Date', type: 'date', defaultValue: '2026-08-25' },
        completed: { name: 'completed', label: 'Completed', type: 'boolean', defaultValue: false },
      },
    },
    sampleData: {
      title: 'Implement card registry schema',
      assignee: 'Alex',
      priority: 'High',
      dueDate: '2026-08-25',
      completed: false,
    },
    rootComponent: {
      id: 'root',
      type: 'container',
      style: { padding: '14px', borderRadius: '14px', background: 'surface', border: '1px solid border' },
      children: [
        {
          id: 'hdr',
          type: 'row',
          style: { justifyContent: 'between', alignItems: 'center', margin: '0 0 8px 0' },
          children: [
            { id: 'prio-badge', type: 'badge', props: { text: '{{priority}} Priority', variant: 'warning' } },
            { id: 'due-txt', type: 'text', props: { text: 'Due {{dueDate | date}}', size: 'xs', variant: 'muted' } },
          ],
        },
        { id: 'title', type: 'heading', props: { text: '{{title}}', level: 3 }, style: { margin: '0 0 8px 0' } },
        {
          id: 'footer-row',
          type: 'row',
          style: { justifyContent: 'between', alignItems: 'center' },
          children: [
            { id: 'assignee-txt', type: 'text', props: { text: 'Assigned to {{assignee}}', size: 'xs', variant: 'muted' } },
            { id: 'btn-complete', type: 'button', props: { label: 'Mark Done', variant: 'primary', icon: 'Check', actionId: 'toggle_done' } },
          ],
        },
      ],
    },
    actions: [
      { id: 'toggle_done', type: 'update_record', label: 'Toggle Complete' },
    ],
  },
];

// ---------------------------------------------------------------------------
// STORE STATE & ACTIONS
// ---------------------------------------------------------------------------

export interface CardRegistryState {
  cards: Record<string, CardDefinition>; // Keyed by cardId
  versions: Record<string, CardDefinition[]>; // Keyed by cardId -> array of versions
  searchQuery: string;
  selectedCategory: string;
  selectedStatus: string;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedStatus: (status: string) => void;
  getCard: (cardId: string, version?: number) => CardDefinition | undefined;
  registerCard: (card: CardDefinition) => void;
  updateCard: (card: CardDefinition) => void;
  publishVersion: (cardId: string) => CardDefinition | undefined;
  duplicateCard: (cardId: string, newName?: string) => CardDefinition | undefined;
  deleteCard: (cardId: string) => void;
  importCardJSON: (jsonString: string) => { success: boolean; card?: CardDefinition; error?: string };
  exportCardJSON: (cardId: string) => string | undefined;
  resetToDefaults: () => void;
}

export const useCardRegistryStore = create<CardRegistryState>()(
  persist(
    (set, get) => {
      // Build initial card maps from built-in templates
      const initialCards: Record<string, CardDefinition> = {};
      const initialVersions: Record<string, CardDefinition[]> = {};

      for (const tpl of SYSTEM_CARD_TEMPLATES) {
        initialCards[tpl.cardId] = tpl;
        initialVersions[tpl.cardId] = [tpl];
      }

      return {
        cards: initialCards,
        versions: initialVersions,
        searchQuery: '',
        selectedCategory: 'all',
        selectedStatus: 'all',

        setSearchQuery: (query) => set({ searchQuery: query }),
        setSelectedCategory: (category) => set({ selectedCategory: category }),
        setSelectedStatus: (status) => set({ selectedStatus: status }),

        getCard: (cardId, version) => {
          const state = get();
          const card = state.cards[cardId];
          if (!card) return undefined;

          if (version !== undefined && version !== null) {
            const versionList = state.versions[cardId] || [card];
            const matchingVersion = versionList.find((v) => v.version === version);
            if (matchingVersion) return matchingVersion;
          }

          return card;
        },

        registerCard: (card) =>
          set((state) => {
            const existingVersions = state.versions[card.cardId] || [];
            return {
              cards: { ...state.cards, [card.cardId]: card },
              versions: {
                ...state.versions,
                [card.cardId]: [...existingVersions.filter((v) => v.version !== card.version), card],
              },
            };
          }),

        updateCard: (updatedCard) =>
          set((state) => {
            const cardId = updatedCard.cardId;
            const updated = { ...updatedCard, updatedAt: Date.now() };
            const existingVersions = state.versions[cardId] || [];

            return {
              cards: { ...state.cards, [cardId]: updated },
              versions: {
                ...state.versions,
                [cardId]: [...existingVersions.filter((v) => v.version !== updated.version), updated],
              },
            };
          }),

        publishVersion: (cardId) => {
          const state = get();
          const card = state.cards[cardId];
          if (!card) return undefined;

          const newVersionNumber = (card.version || 1) + 1;
          const published: CardDefinition = {
            ...card,
            version: newVersionNumber,
            status: 'published',
            publishedAt: Date.now(),
            updatedAt: Date.now(),
          };

          get().registerCard(published);
          return published;
        },

        duplicateCard: (cardId, newName) => {
          const state = get();
          const original = state.cards[cardId];
          if (!original) return undefined;

          const newId = `${cardId}-copy-${Math.random().toString(36).slice(2, 6)}`;
          const duplicate: CardDefinition = {
            ...original,
            cardId: newId,
            name: newName || `${original.name} (Copy)`,
            version: 1,
            status: 'draft',
            usageCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            publishedAt: undefined,
          };

          get().registerCard(duplicate);
          return duplicate;
        },

        deleteCard: (cardId) =>
          set((state) => {
            const newCards = { ...state.cards };
            const newVersions = { ...state.versions };
            delete newCards[cardId];
            delete newVersions[cardId];
            return { cards: newCards, versions: newVersions };
          }),

        importCardJSON: (jsonString) => {
          try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.cardId || !parsed.name || !parsed.rootComponent) {
              return { success: false, error: 'Invalid card JSON: missing required fields (cardId, name, rootComponent)' };
            }

            const importedCard: CardDefinition = {
              ...parsed,
              version: parsed.version || 1,
              status: parsed.status || 'draft',
              category: parsed.category || 'custom',
              visibility: parsed.visibility || 'workspace',
              supportedSurfaces: parsed.supportedSurfaces || ['matrix', 'agent', 'workflow'],
              schema: parsed.schema || { fields: {} },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            get().registerCard(importedCard);
            return { success: true, card: importedCard };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Invalid JSON' };
          }
        },

        exportCardJSON: (cardId) => {
          const card = get().cards[cardId];
          if (!card) return undefined;
          return JSON.stringify(card, null, 2);
        },

        resetToDefaults: () => {
          const defaultCards: Record<string, CardDefinition> = {};
          const defaultVersions: Record<string, CardDefinition[]> = {};
          for (const tpl of SYSTEM_CARD_TEMPLATES) {
            defaultCards[tpl.cardId] = tpl;
            defaultVersions[tpl.cardId] = [tpl];
          }
          set({ cards: defaultCards, versions: defaultVersions });
        },
      };
    },
    {
      name: 'onetab-universal-card-registry',
    },
  ),
);
