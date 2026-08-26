import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomStatusItem {
  id: string;
  label: string;
  key: string;
  color?: string;
  isCustom?: boolean;
}

export interface CustomPriorityItem {
  id: string;
  label: string;
  key: string;
  color?: string;
  isCustom?: boolean;
}

export interface CustomLabelItem {
  id: string;
  name: string;
  color: string;
}

export interface CustomTeamItem {
  id: string;
  name: string;
}

export interface CustomSlackChannelItem {
  id: string;
  name: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CustomCardProperties {
  ticketId?: string;
  startDate?: string;
  targetDate?: string;
  team?: string;
  slackChannel?: string;
  labels?: string[];
  leadId?: string;
  memberIds?: string[];
  checklist?: ChecklistItem[];
  isStarred?: boolean;
}

export interface KanbanCustomState {
  statuses: CustomStatusItem[];
  priorities: CustomPriorityItem[];
  labels: CustomLabelItem[];
  teams: CustomTeamItem[];
  slackChannels: CustomSlackChannelItem[];
  ticketPrefix: string;
  cardProperties: Record<string, CustomCardProperties>;

  // Status Actions
  addStatus: (status: Omit<CustomStatusItem, 'isCustom'>) => void;
  updateStatus: (id: string, patch: Partial<CustomStatusItem>) => void;
  removeStatus: (id: string) => void;

  // Priority Actions
  addPriority: (priority: Omit<CustomPriorityItem, 'isCustom'>) => void;
  updatePriority: (id: string, patch: Partial<CustomPriorityItem>) => void;
  removePriority: (id: string) => void;

  // Label Actions
  addLabel: (label: Omit<CustomLabelItem, 'id'>) => CustomLabelItem;
  updateLabel: (id: string, patch: Partial<CustomLabelItem>) => void;
  removeLabel: (id: string) => void;

  // Team Actions
  addTeam: (team: Omit<CustomTeamItem, 'id'>) => void;
  removeTeam: (id: string) => void;

  // Slack Channel Actions
  addSlackChannel: (channel: Omit<CustomSlackChannelItem, 'id'>) => void;
  removeSlackChannel: (id: string) => void;

  // Ticket prefix
  setTicketPrefix: (prefix: string) => void;

  // Card properties
  setCardProperties: (cardId: string, patch: Partial<CustomCardProperties>) => void;
  getCardProperties: (cardId: string) => CustomCardProperties;
}

const DEFAULT_STATUSES: CustomStatusItem[] = [
  { id: 'BACKLOG', label: 'Backlog', key: '1', color: '#f59e0b', isCustom: false },
  { id: 'TODO', label: 'Planned', key: '2', color: '#94a3b8', isCustom: false },
  { id: 'IN_PROGRESS', label: 'In Progress', key: '3', color: '#eab308', isCustom: false },
  { id: 'DONE', label: 'Completed', key: '4', color: '#3b82f6', isCustom: false },
  { id: 'CANCELLED', label: 'Canceled', key: '5', color: '#64748b', isCustom: false },
];

const DEFAULT_PRIORITIES: CustomPriorityItem[] = [
  { id: 'NO_PRIORITY', label: 'No priority', key: '0', color: '#94a3b8', isCustom: false },
  { id: 'URGENT', label: 'Urgent', key: '1', color: '#ef4444', isCustom: false },
  { id: 'HIGH', label: 'High', key: '2', color: '#f97316', isCustom: false },
  { id: 'MEDIUM', label: 'Medium', key: '3', color: '#eab308', isCustom: false },
  { id: 'LOW', label: 'Low', key: '4', color: '#3b82f6', isCustom: false },
];

const DEFAULT_LABELS: CustomLabelItem[] = [
  { id: 'lbl-1', name: 'Design', color: '#8b5cf6' },
  { id: 'lbl-2', name: 'Frontend', color: '#3b82f6' },
  { id: 'lbl-3', name: 'Backend', color: '#10b981' },
  { id: 'lbl-4', name: 'Bug', color: '#ef4444' },
  { id: 'lbl-5', name: 'Feature', color: '#f59e0b' },
  { id: 'lbl-6', name: 'Security', color: '#ec4899' },
];

const DEFAULT_TEAMS: CustomTeamItem[] = [
  { id: 'tm-1', name: 'Designteam-link' },
  { id: 'tm-2', name: 'Engineering-core' },
  { id: 'tm-3', name: 'Product-ops' },
];

const DEFAULT_SLACK_CHANNELS: CustomSlackChannelItem[] = [
  { id: 'slk-1', name: 'Slack channel' },
  { id: 'slk-2', name: 'design-updates' },
  { id: 'slk-3', name: 'proj-website' },
];

export const useKanbanCustomStore = create<KanbanCustomState>()(
  persist(
    (set, get) => ({
      statuses: DEFAULT_STATUSES,
      priorities: DEFAULT_PRIORITIES,
      labels: DEFAULT_LABELS,
      teams: DEFAULT_TEAMS,
      slackChannels: DEFAULT_SLACK_CHANNELS,
      ticketPrefix: 'DES',
      cardProperties: {},

      addStatus: (status) =>
        set((state) => ({
          statuses: [
            ...state.statuses,
            { ...status, isCustom: true, key: status.key || `${state.statuses.length + 1}` },
          ],
        })),

      updateStatus: (id, patch) =>
        set((state) => ({
          statuses: state.statuses.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),

      removeStatus: (id) =>
        set((state) => ({
          statuses: state.statuses.filter((s) => s.id !== id),
        })),

      addPriority: (priority) =>
        set((state) => ({
          priorities: [
            ...state.priorities,
            { ...priority, isCustom: true, key: priority.key || `${state.priorities.length}` },
          ],
        })),

      updatePriority: (id, patch) =>
        set((state) => ({
          priorities: state.priorities.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removePriority: (id) =>
        set((state) => ({
          priorities: state.priorities.filter((p) => p.id !== id),
        })),

      addLabel: (label) => {
        const newLabel: CustomLabelItem = {
          id: `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...label,
        };
        set((state) => ({ labels: [...state.labels, newLabel] }));
        return newLabel;
      },

      updateLabel: (id, patch) =>
        set((state) => ({
          labels: state.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),

      removeLabel: (id) =>
        set((state) => ({
          labels: state.labels.filter((l) => l.id !== id),
        })),

      addTeam: (team) =>
        set((state) => ({
          teams: [
            ...state.teams,
            { id: `tm-${Date.now()}`, ...team },
          ],
        })),

      removeTeam: (id) =>
        set((state) => ({
          teams: state.teams.filter((t) => t.id !== id),
        })),

      addSlackChannel: (channel) =>
        set((state) => ({
          slackChannels: [
            ...state.slackChannels,
            { id: `slk-${Date.now()}`, ...channel },
          ],
        })),

      removeSlackChannel: (id) =>
        set((state) => ({
          slackChannels: state.slackChannels.filter((c) => c.id !== id),
        })),

      setTicketPrefix: (prefix) =>
        set({ ticketPrefix: prefix.trim().toUpperCase() || 'DES' }),

      setCardProperties: (cardId, patch) =>
        set((state) => ({
          cardProperties: {
            ...state.cardProperties,
            [cardId]: {
              ...(state.cardProperties[cardId] ?? {}),
              ...patch,
            },
          },
        })),

      getCardProperties: (cardId) => {
        const props = get().cardProperties[cardId] ?? {};
        const prefix = get().ticketPrefix || 'DES';

        // Auto-generate ticketId deterministically if not set
        if (!props.ticketId) {
          // Simple hash of cardId to number 100-999
          let hash = 0;
          for (let i = 0; i < cardId.length; i++) {
            hash = (hash << 5) - hash + cardId.charCodeAt(i);
            hash |= 0;
          }
          const num = Math.abs(hash % 900) + 100;
          props.ticketId = `${prefix}-${num}`;
        }

        return props;
      },
    }),
    {
      name: 'onetab_kanban_custom_store',
    },
  ),
);
