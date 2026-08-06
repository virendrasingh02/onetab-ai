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
    title: 'Product board',
    labels: LABELS,
    members: MEMBERS,
    currentMemberId: 'm_you',
    lists: [
      {
        id: 'list_backlog',
        title: 'Backlog',
        cards: [
          card({
            id: 'c_wiki',
            title: 'Document & wiki hierarchy',
            description:
              'Notion-like block editor with page nesting, backlinks and a slash menu.',
            labelIds: ['l_docs', 'l_design'],
            priority: 'HIGH',
            checklist: [
              { id: 'ci_1', text: 'Block schema', done: true },
              { id: 'ci_2', text: 'Slash command menu', done: false },
              { id: 'ci_3', text: 'Page tree sidebar', done: false },
            ],
          }),
          card({
            id: 'c_search',
            title: 'Hybrid search across docs and chat',
            description: 'Blend BM25 keyword hits with Qdrant vector results.',
            labelIds: ['l_ai'],
            memberIds: ['m_sam'],
            priority: 'MEDIUM',
          }),
        ],
      },
      {
        id: 'list_todo',
        title: 'To do',
        cards: [
          card({
            id: 'c_ollama',
            title: 'Connect Ollama model runner',
            description: 'Enable local LLM inference with nomic-embed-text.',
            labelIds: ['l_ai', 'l_infra'],
            memberIds: ['m_dev'],
            dueDate: relativeDay(4),
            priority: 'MEDIUM',
            comments: [
              {
                id: 'cm_1',
                authorId: 'm_admin',
                body: 'Pin the model version before we benchmark.',
                createdAt: new Date(Date.now() - 36e5 * 30).toISOString(),
              },
            ],
          }),
          card({
            id: 'c_perms',
            title: 'Workspace role & permission matrix',
            labelIds: ['l_platform'],
            dueDate: relativeDay(-1),
            priority: 'URGENT',
          }),
        ],
      },
      {
        id: 'list_doing',
        title: 'In progress',
        cards: [
          card({
            id: 'c_kanban',
            title: 'Kanban board — drag & drop',
            description:
              'Cards drag between lists, lists reorder, and every change persists.',
            labelIds: ['l_platform', 'l_design'],
            memberIds: ['m_you', 'm_dev'],
            dueDate: relativeDay(0),
            priority: 'URGENT',
            checklist: [
              { id: 'ci_4', text: 'Card drag & drop', done: true },
              { id: 'ci_5', text: 'List reordering', done: true },
              { id: 'ci_6', text: 'Filters and search', done: true },
              { id: 'ci_7', text: 'Card details panel', done: true },
            ],
          }),
        ],
      },
      {
        id: 'list_review',
        title: 'In review',
        cards: [
          card({
            id: 'c_upload',
            title: 'Chunked upload retries drop the last part',
            labelIds: ['l_bug'],
            memberIds: ['m_sam'],
            dueDate: relativeDay(1),
            priority: 'HIGH',
          }),
        ],
      },
      {
        id: 'list_done',
        title: 'Done',
        cards: [
          card({
            id: 'c_qdrant',
            title: 'Set up Qdrant vector collection',
            description:
              'workspace_docs collection configured for RAG embeddings.',
            labelIds: ['l_ai', 'l_infra'],
            memberIds: ['m_admin'],
            dueDate: relativeDay(-6),
            dueComplete: true,
            priority: 'HIGH',
          }),
        ],
      },
    ],
  };
}
