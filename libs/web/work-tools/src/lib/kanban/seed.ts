import type {
  BoardLabel,
  BoardMember,
  BoardState,
  KanbanCard,
} from './types.js';

/**
 * Starter content. Only used the first time the board renders — after that the
 * reducer's persisted state wins.
 */

const MEMBERS: BoardMember[] = [
  { id: 'm_you', name: 'You' },
  { id: 'm_admin', name: 'Admin' },
  { id: 'm_dev', name: 'Dev User' },
  { id: 'm_sam', name: 'Sam Okafor' },
];

const LABELS: BoardLabel[] = [
  { id: 'l_platform', name: 'Platform', color: 'blue' },
  { id: 'l_ai', name: 'AI', color: 'violet' },
  { id: 'l_design', name: 'Design', color: 'pink' },
  { id: 'l_bug', name: 'Bug', color: 'rose' },
  { id: 'l_docs', name: 'Docs', color: 'teal' },
  { id: 'l_infra', name: 'Infra', color: 'amber' },
];

/** `yyyy-mm-dd` for today shifted by `days`, in the viewer's own timezone. */
function relativeDay(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function card(
  partial: Partial<KanbanCard> & { id: string; title: string },
): KanbanCard {
  return {
    description: '',
    labelIds: [],
    memberIds: [],
    dueComplete: false,
    priority: 'MEDIUM',
    checklist: [],
    comments: [],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function createSeedBoard(): BoardState {
  return {
    title: 'Projects',
    labels: LABELS,
    members: MEMBERS,
    currentMemberId: 'm_you',
    lists: [
      {
        id: 'list_backlog',
        title: 'Backlog',
        cards: [
          card({
            id: 'c_trip',
            title: 'Planning Trip',
            description: 'Itinerary, bookings, and team travel plan.',
            icon: 'Package',
            iconColor: '#f97316',
            issuesCount: 0,
            priority: 'MEDIUM',
          }),
        ],
      },
      {
        id: 'list_planned',
        title: 'Planned',
        cards: [
          card({
            id: 'c_website',
            title: 'Design Website',
            description: 'Responsive website redesign and design system update.',
            icon: 'Heart',
            iconColor: '#e11d48',
            dueDate: relativeDay(14),
            issuesCount: 0,
            priority: 'HIGH',
          }),
        ],
      },
      {
        id: 'list_doing',
        title: 'In Progress',
        cards: [
          card({
            id: 'c_kanban',
            title: 'Kanban Board Refactor',
            description: 'Drag & drop, Linear filters, and AI prompt search.',
            icon: 'Rocket',
            iconColor: '#8b5cf6',
            issuesCount: 3,
            priority: 'URGENT',
          }),
        ],
      },
      {
        id: 'list_done',
        title: 'Completed',
        cards: [
          card({
            id: 'c_brand',
            title: 'Logo & Brand Guidelines',
            description: 'Finalized vector logos and typography spec.',
            icon: 'Sparkles',
            iconColor: '#3b82f6',
            issuesCount: 0,
            dueComplete: true,
            priority: 'LOW',
          }),
        ],
      },
    ],
  };
}
